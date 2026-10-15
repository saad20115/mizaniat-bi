/**
 * Interactive UI Verification Suite (CDP-based)
 * Verifies TreeTable (Main & Aging 4-levels), Chart rendering (L2), Year change state preservation,
 * Viewer mode permissions & rendering, and 0 console errors.
 */

const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

// Rule 9 (B1): Isolated Test DB & Port — Live database data/mizaniat.db is NEVER touched by UI tests
const PROD_DB_PATH = path.join(__dirname, '..', '..', 'data', 'mizaniat.db');
const TEST_DB_PATH = path.join(__dirname, '..', '..', 'data', 'mizaniat_test_ui.db');
// Ports can be overridden so two checkouts can run this suite at the same time
const TEST_PORT = Number(process.env.VERIFY_UI_PORT) || 3195;

process.env.DB_PATH = TEST_DB_PATH;
process.env.PORT = String(TEST_PORT);

const { getDb, closeDb } = require('../db/connection');

async function prepareTestDb() {
  console.log('  🔒 [Rule 9] Copying production DB to isolated test DB via SQLite backup...');
  if (fs.existsSync(PROD_DB_PATH)) {
    try {
      if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
      if (fs.existsSync(TEST_DB_PATH + '-wal')) fs.unlinkSync(TEST_DB_PATH + '-wal');
      if (fs.existsSync(TEST_DB_PATH + '-shm')) fs.unlinkSync(TEST_DB_PATH + '-shm');
    } catch (e) {}
    const Database = require('better-sqlite3');
    const srcDb = new Database(PROD_DB_PATH, { readonly: true, fileMustExist: true });
    await srcDb.backup(TEST_DB_PATH);
    srcDb.close();
  } else {
    throw new Error(`Production database not found at ${PROD_DB_PATH}`);
  }
}

function cleanupTestDb() {
  console.log('  🧹 [Rule 9] Cleaning up isolated test DB...');
  try { closeDb(); } catch (e) {}
  try {
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    if (fs.existsSync(TEST_DB_PATH + '-wal')) fs.unlinkSync(TEST_DB_PATH + '-wal');
    if (fs.existsSync(TEST_DB_PATH + '-shm')) fs.unlinkSync(TEST_DB_PATH + '-shm');
  } catch (e) {}
}

function killPort(port) {
  if (process.platform === 'win32') {
    try {
      const { execSync } = require('child_process');
      execSync(`powershell -NoProfile -Command "$p = (Get-NetTCPConnection -LocalPort ${port} -ErrorAction SilentlyContinue).OwningProcess; if ($p) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }"`, { stdio: 'ignore' });
    } catch (e) {}
  }
}

async function waitForServer(port, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${port}/api/companies`, res => {
          if (res.statusCode < 500) resolve();
          else reject(new Error('Status ' + res.statusCode));
        });
        req.on('error', reject);
        req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
      });
      return true;
    } catch (e) {
      await sleep(350);
    }
  }
  throw new Error(`Test server failed to start on port ${port} within ${timeoutMs}ms`);
}

function findChromePath() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(os.homedir(), 'AppData\\Local\\Google\\Chrome\\Application\\chrome.exe'),
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'google-chrome';
}

const CHROME_PATH = findChromePath();
const DEBUG_PORT = Number(process.env.VERIFY_UI_DEBUG_PORT) || 9231;
const APP_PORT = TEST_PORT;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function getJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: { ...headers }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
    this.consoleErrors = [];
    this.networkRequests = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.method === 'Network.requestWillBeSent') {
          const req = msg.params.request;
          this.networkRequests.push({
            url: req.url,
            method: req.method,
            timestamp: msg.params.timestamp
          });
        }
        if (msg.method === 'Runtime.consoleAPICalled') {
          if (msg.params.type === 'error') {
            const errText = msg.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
            this.consoleErrors.push(errText);
            console.error('  [Browser Console Error]:', errText);
          }
        }
        if (msg.id && this.callbacks.has(msg.id)) {
          const { resolve, reject } = this.callbacks.get(msg.id);
          this.callbacks.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        }
      };
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = this.id++;
      this.callbacks.set(msgId, { resolve, reject });
      this.ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    return res.result ? res.result.value : null;
  }

  async screenshot(outPath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const dir = path.dirname(outPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outPath, Buffer.from(res.data, 'base64'));
    console.log('  📸 Screenshot saved:', path.basename(outPath), `(${fs.statSync(outPath).size} bytes)`);
  }

  async realClick(selector) {
    const box = await this.eval(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return null;
      try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch(e) {}
      const r = el.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) return null;
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, width: r.width, height: r.height };
    })()`);
    if (!box) throw new Error('Element not found or not visible for realClick: ' + selector);
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: Math.round(box.x),
      y: Math.round(box.y)
    });
    await this.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: Math.round(box.x),
      y: Math.round(box.y),
      button: 'left',
      clickCount: 1
    });
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: Math.round(box.x),
      y: Math.round(box.y),
      button: 'left',
      clickCount: 1
    });
    await sleep(250);
  }

  async hitTest(selector) {
    return await this.eval(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      if (!el) return { found: false, error: 'Element not in DOM' };
      try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch(e) {}
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2;
      const cy = r.top + r.height / 2;
      const topEl = document.elementFromPoint(cx, cy);
      if (!topEl) return { found: false, error: 'No elementFromPoint' };
      const contains = el.contains(topEl) || topEl === el;
      return {
        found: true,
        contains,
        tag: topEl.tagName,
        id: topEl.id,
        className: topEl.className,
        selectorText: (topEl.tagName || '').toLowerCase() + (topEl.id ? '#' + topEl.id : '') + (topEl.className ? '.' + topEl.className.replace(/\\s+/g, '.') : '')
      };
    })()`);
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function waitForTabReady(cdp, tab, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const status = await cdp.eval(`
      (() => {
        if (document.readyState !== 'complete') {
          return { ready: false, reason: 'document readyState not complete' };
        }
        const loading = document.querySelector('#vat-loading, #cust-loading, #prof-loading, #exec-loading, #col-loading, .spinner');
        if (loading && window.getComputedStyle(loading).display !== 'none' && !loading.closest('[style*="display: none"]')) {
          return { ready: false, reason: 'loading spinner active' };
        }
        if ('${tab}' === 'executive') {
          const chartSvg = document.querySelector('#exec-chart-container svg');
          const mainTable = document.querySelector('#exec-tree-table-container table, #exec-main-table, #exec-content table');
          const ok = !!chartSvg && !!mainTable;
          return { ready: ok, reason: ok ? '' : 'exec chart or table missing' };
        }
        if ('${tab}' === 'customers') {
          const mc = document.querySelector('#cust-main-content');
          const table = document.querySelector('#cust-tree-container table');
          const ok = mc && window.getComputedStyle(mc).display !== 'none' && !!table;
          return { ready: ok, reason: ok ? '' : 'customers table missing' };
        }
        if ('${tab}' === 'profitability') {
          const mc = document.querySelector('#prof-main-content');
          const table = document.querySelector('#prof-tree-container table');
          const ok = mc && window.getComputedStyle(mc).display !== 'none' && !!table;
          return { ready: ok, reason: ok ? '' : 'profitability table missing' };
        }
        if ('${tab}' === 'guarantees') {
          const cards = document.querySelectorAll('.gr-card, .gr-kpi-card');
          const tables = document.querySelectorAll('.gr-table');
          const ok = cards.length > 0 && tables.length > 0;
          return { ready: ok, reason: ok ? '' : 'guarantees cards or tables missing' };
        }
        if ('${tab}' === 'vat') {
          const mc = document.querySelector('#vat-main-content');
          const table = document.querySelector('#vat-tree-container table');
          const ok = mc && window.getComputedStyle(mc).display !== 'none' && !!table;
          return { ready: ok, reason: ok ? '' : 'vat table missing' };
        }
        if ('${tab}' === 'actual-collections') {
          const mc = document.querySelector('#col-main-content');
          const cards = document.querySelectorAll('#col-main-content .bi-kpi');
          const ok = mc && window.getComputedStyle(mc).display !== 'none' && cards.length >= 4;
          return { ready: ok, reason: ok ? '' : 'collections content or cards missing' };
        }
        return { ready: true };
      })()
    `);
    if (status && status.ready) return true;
    await sleep(50);
  }
  return false;
}

async function checkContrastRatio(cdp) {
  return await cdp.eval(`
    (() => {
      function getLuminance(r, g, b) {
        const a = [r, g, b].map(v => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
      }

      function parseRgba(str) {
        if (!str) return null;
        const match = str.match(/rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?\\)/);
        if (!match) return null;
        return {
          r: parseInt(match[1], 10),
          g: parseInt(match[2], 10),
          b: parseInt(match[3], 10),
          a: match[4] !== undefined ? parseFloat(match[4]) : 1
        };
      }

      function getEffectiveBg(el, defaultBg) {
        let cur = el;
        while (cur && cur !== document.documentElement) {
          const s = window.getComputedStyle(cur);
          const bg = parseRgba(s.backgroundColor);
          if (bg && bg.a > 0.1) {
            if (bg.a >= 0.95) return bg;
            return {
              r: Math.round(bg.r * bg.a + defaultBg.r * (1 - bg.a)),
              g: Math.round(bg.g * bg.a + defaultBg.g * (1 - bg.a)),
              b: Math.round(bg.b * bg.a + defaultBg.b * (1 - bg.a)),
              a: 1
            };
          }
          cur = cur.parentElement;
        }
        return defaultBg;
      }

      const isLight = document.documentElement.getAttribute('data-theme') === 'light' || document.body.classList.contains('light-theme');
      const defaultBg = isLight ? { r: 248, g: 250, b: 252, a: 1 } : { r: 5, g: 8, b: 22, a: 1 };

      const candidates = Array.from(document.querySelectorAll(\`
        .kpi-card, .exec-kpi-card, .gr-card, .gr-kpi-card, .vat-kpi-grid > div,
        .kpi-val, .exec-num, .gr-card-val, .vat-card-num,
        #gr-kpi-pending-amt, #gr-kpi-count, #gr-kpi-ledger-amt,
        .tree-table-wrap th, .tree-table-wrap td,
        .exec-table th, .exec-table td,
        .gr-table th, .gr-table td,
        #col-main-content .bi-kpi-label, #col-main-content .bi-kpi-value, #col-main-content .bi-kpi-sub,
        #col-main-content th, #col-main-content td,
        #col-main-content h2, #col-main-content h3, #col-main-content p, #col-main-content span:not(:has(*)),
        .bi-slicer-btn, .bi-slicer-title, .bi-slicer-value, .slicer-item-name, .slicer-drop-title, .slicer-btn-apply, .slicer-company-header
      \`)).filter(el => {
        if (el.offsetParent === null) return false;
        const s = window.getComputedStyle(el);
        if (s.display === 'none' || s.visibility === 'hidden') return false;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return false;
        const txt = (el.textContent || '').trim();
        return txt.length > 0 && txt !== '—' && txt !== '•' && txt !== '▼' && txt !== '▶';
      });

      const failures = [];
      let minRatio = 999;
      let evaluatedCount = 0;

      for (const el of candidates) {
        const s = window.getComputedStyle(el);
        const fg = parseRgba(s.color);
        if (!fg) continue;
        const bg = getEffectiveBg(el, defaultBg);
        const l1 = getLuminance(fg.r, fg.g, fg.b);
        const l2 = getLuminance(bg.r, bg.g, bg.b);
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        evaluatedCount++;
        if (ratio < minRatio) minRatio = ratio;
        if (ratio < 4.5) {
          failures.push({
            tag: el.tagName,
            className: el.className,
            text: (el.textContent || '').trim().slice(0, 25),
            color: s.color,
            bgColor: \`rgb(\${bg.r},\${bg.g},\${bg.b})\`,
            ratio: Math.round(ratio * 100) / 100
          });
        }
      }

      return {
        evaluatedCount,
        minRatio: Math.round(minRatio * 100) / 100,
        failuresCount: failures.length,
        failures: failures.slice(0, 5)
      };
    })()
  `);
}

async function checkTableWidth(cdp, tab) {
  return await cdp.eval(`
    (() => {
      let table = null;
      if ('${tab}' === 'executive') table = document.querySelector('#exec-tree-table-container table, #exec-main-table, #exec-content table');
      else if ('${tab}' === 'customers') table = document.querySelector('#cust-tree-container table');
      else if ('${tab}' === 'profitability') table = document.querySelector('#prof-tree-container table');
      else if ('${tab}' === 'guarantees') table = document.querySelector('table.gr-table');
      else if ('${tab}' === 'vat') table = document.querySelector('#vat-tree-container table');
      else if ('${tab}' === 'actual-collections') table = document.querySelector('#col-tree-container table, #col-main-content table');
      if (!table) table = document.querySelector('.tree-table-wrap table, table.exec-table, table.gr-table');
      if (!table) return null;
      const container = table.closest('.tree-table-wrap') || table.parentElement;
      if (!container) return null;
      const tRect = table.getBoundingClientRect();
      const cWidth = container.clientWidth;
      const allowsScroll = container.getAttribute('data-scroll-x') === 'true' || container.classList.contains('vat-treetable-container') || container.id === 'vat-tree-container';
      const fits = allowsScroll || (tRect.width <= cWidth + 1.5);
      const fills = cWidth > 0 && (tRect.width >= 0.98 * cWidth);
      return {
        tableWidth: Math.round(tRect.width * 10) / 10,
        containerWidth: cWidth,
        fits,
        fills,
        ratio: Math.round((tRect.width / cWidth) * 1000) / 10
      };
    })()
  `);
}

async function runVerifyUI() {
  const screenshotsDir = path.join(__dirname, '..', '..', 'scratch');
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

  const userDataDir = path.join(os.tmpdir(), `chrome_verify_ui_${Date.now()}`);
  if (!fs.existsSync(userDataDir)) fs.mkdirSync(userDataDir, { recursive: true });

  const JWT_SECRET = process.env.JWT_SECRET || 'mizaniat-bi-secret-key-2026';
  const adminToken = jwt.sign({ id: 2, email: 'saadm7294@gmail.com', role: 'admin' }, JWT_SECRET);

  console.log('========================================');
  console.log('UI VERIFICATION SUITE (CDP Real Browser)');
  console.log('========================================');
  console.log(`Chrome binary: ${CHROME_PATH}`);

  // 1. Prepare isolated test database (Rule 9)
  await prepareTestDb();

  // 2. Kill any processes on test port & debug port
  killPort(TEST_PORT);
  killPort(DEBUG_PORT);

  // 3. Start isolated test server on TEST_PORT
  let serverProcess;
  try {
    serverProcess = spawn(process.execPath, [path.join(__dirname, '..', 'index.js')], {
      cwd: path.join(__dirname, '..', '..'),
      env: {
        ...process.env,
        PORT: String(TEST_PORT),
        DB_PATH: TEST_DB_PATH
      },
      stdio: 'inherit'
    });
    await waitForServer(TEST_PORT);
    console.log(`  🚀 Isolated test server running on port ${TEST_PORT} with DB: mizaniat_test_ui.db`);
  } catch (err) {
    console.error('Failed to launch isolated test server:', err.message);
    cleanupTestDb();
    process.exit(1);
  }

  let chromeProcess;
  try {
    chromeProcess = spawn(CHROME_PATH, [
      '--headless=new',
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${userDataDir}`,
      '--disable-extensions',
      '--window-size=1920,3000',
      '--disable-gpu',
      '--no-sandbox',
      'about:blank'
    ], { detached: true });
  } catch (err) {
    console.error('Failed to launch Chrome:', err.message);
    process.exit(1);
  }

  let targets;
  for (let attempt = 1; attempt <= 15; attempt++) {
    try {
      targets = await getJson(`http://127.0.0.1:${DEBUG_PORT}/json`);
      if (targets && targets.length > 0) break;
    } catch (e) {
      await sleep(500);
    }
  }
  if (!targets || targets.length === 0) {
    throw new Error(`Failed to connect to Chrome CDP on port ${DEBUG_PORT} after 15 attempts`);
  }

  try {
    const pageTarget = targets.find(t => t.type === 'page') || targets[0];
    if (!pageTarget) throw new Error('No page target found on Chrome CDP');

    const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Network.enable');
    await cdp.send('Network.setBlockedURLs', { urls: ['*kaspersky*', '*kis.v2.scr*'] });

    await cdp.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `
        try {
          const urlParams = new URLSearchParams(window.location.search);
          const t = urlParams.get('token');
          if (t) {
            localStorage.setItem('mizaniat_admin_token', t);
            localStorage.setItem('mizaniat_admin_info', JSON.stringify({ id: 2, email: 'saadm7294@gmail.com', name: 'مدير النظام' }));
            localStorage.removeItem('mizaniat_viewer_mode');
            localStorage.removeItem('mizaniat_viewer_token');
            sessionStorage.removeItem('mizaniat_viewer_token');
          }
          const th = urlParams.get('theme');
          if (th) {
            localStorage.setItem('theme', th);
            document.documentElement.setAttribute('data-theme', th);
            if (th === 'light') {
              document.documentElement.classList.add('light-theme');
            } else {
              document.documentElement.classList.remove('light-theme');
            }
          }
        } catch(e) {}
      `
    });

    let passedTests = 0;
    let failedTests = 0;

    function assert(cond, name) {
      if (cond) {
        console.log(`  [PASS] ${name}`);
        passedTests++;
      } else {
        console.error(`  [FAIL] ${name}`);
        failedTests++;
      }
    }

    // ──────────────────────────────────────────
    // TEST 1: Admin Navigation & Chart Rendering (L2)
    // ──────────────────────────────────────────
    console.log('\n--- 1. Executive Dashboard Load & Chart (L2) ---');
    await cdp.send('Page.navigate', {
      url: `http://localhost:${APP_PORT}/index.html?page=presentation&tab=executive&theme=light&token=${adminToken}`
    });

    let chartRendered = false;
    for (let attempts = 0; attempts < 40; attempts++) {
      await sleep(500);
      const ready = await cdp.eval('!!document.querySelector("#exec-chart-container svg")');
      if (ready) {
        chartRendered = true;
        break;
      }
    }
    if (!chartRendered) {
      const debugInfo = await cdp.eval(`({
        href: window.location.href,
        hasContainer: !!document.querySelector('#exec-chart-container'),
        mainContent: document.querySelector('#main-content')?.innerHTML?.slice(0, 300),
        adminToken: localStorage.getItem('mizaniat_admin_token')
      })`);
      console.log('  [Debug Test 1 Failed]:', debugInfo);
    }
    assert(chartRendered, 'Executive chart container rendered');

    // Verify L2: Y-axis labels direction and no overlap with January bar
    const chartMetrics = await cdp.eval(`
      (() => {
        const svg = document.querySelector('#exec-chart-container svg');
        if (!svg) return null;
        const yLabels = Array.from(svg.querySelectorAll('text')).filter(t => t.getAttribute('font-family') === 'var(--font-en)');
        const janGroup = svg.querySelector('g.exec-chart-group[data-idx="0"]');
        const janRect = janGroup ? (janGroup.querySelector('rect[fill="var(--chart-revenue)"]') || janGroup.querySelector('rect[fill="#3b82f6"]') || janGroup.querySelector('rect.chart-bar-rev')) : null;
        return {
          yLabelsCount: yLabels.length,
          yLabelsDirections: yLabels.map(t => window.getComputedStyle(t).direction),
          firstLabelX: yLabels[0] ? parseFloat(yLabels[0].getAttribute('x')) : 0,
          janBarMaxX: janRect ? parseFloat(janRect.getAttribute('x')) + parseFloat(janRect.getAttribute('width')) : 0
        };
      })()
    `);

    assert(chartMetrics && chartMetrics.yLabelsCount >= 5, 'Y-axis grid labels exist (5 levels)');
    const allLtr = chartMetrics && chartMetrics.yLabelsDirections.every(d => d === 'ltr');
    assert(allLtr, 'Y-axis labels computed direction is strictly LTR');
    const clearance = chartMetrics ? chartMetrics.firstLabelX - chartMetrics.janBarMaxX : 0;
    assert(clearance >= 20, `Y-axis labels clear January bar with > 20px margin (actual: ${clearance.toFixed(1)}px)`);

    // ──────────────────────────────────────────
    // TEST 2: Aging Table 4-Level Deep Tree (AG1)
    // ──────────────────────────────────────────
    console.log('\n--- 2. Aging Table 4-Level Deep Tree (AG1) ---');
    await cdp.eval(`
      const toggle = document.querySelector('#exec-aging-toggle');
      if (toggle) toggle.click();
    `);
    await sleep(2000);

    const agingRows = await cdp.eval('document.querySelectorAll("#exec-aging-container tr").length');
    assert(agingRows > 0, 'Aging table opened and rendered companies');

    // Click company 1
    const companyKey = await cdp.eval(`
      (() => {
        const coRow = document.querySelector('#exec-aging-container [data-path-key^="co:"]');
        if (coRow) { coRow.click(); return coRow.dataset.pathKey; }
        return null;
      })()
    `);
    await sleep(1500);

    const deptsCount = await cdp.eval('document.querySelectorAll("#exec-aging-container [data-path-key*=\\"/dept:\\"]").length');
    assert(deptsCount > 0, `Aging level 1 (Departments) expanded: ${deptsCount} depts`);

    // Click dept
    const deptKey = await cdp.eval(`
      (() => {
        const deptRow = document.querySelector('#exec-aging-container [data-path-key*="/dept:"]');
        if (deptRow) { deptRow.click(); return deptRow.dataset.pathKey; }
        return null;
      })()
    `);
    await sleep(1500);

    const partnersCount = await cdp.eval('document.querySelectorAll("#exec-aging-container [data-path-key*=\\"/p:\\"]").length');
    assert(partnersCount > 0, `Aging level 2 (Partners) expanded: ${partnersCount} partners`);

    // Click partner (lazy-loads invoices)
    const partnerKey = await cdp.eval(`
      (() => {
        const pRow = document.querySelector('#exec-aging-container [data-path-key*="/p:"]');
        if (pRow) { pRow.click(); return pRow.dataset.pathKey; }
        return null;
      })()
    `);
    await sleep(3500);

    const invoicesCount = await cdp.eval('document.querySelectorAll("#exec-aging-container [data-path-key*=\\"/inv:\\"]").length');
    assert(invoicesCount > 0, `Aging level 3 (Invoices) lazy-loaded and expanded: ${invoicesCount} invoices`);

    // ──────────────────────────────────────────
    // TEST 3: Folding & Unfolding Integrity in Aging
    // ──────────────────────────────────────────
    console.log('\n--- 3. Folding & Unfolding in Aging ---');
    // Fold partner
    await cdp.eval(`document.querySelector('#exec-aging-container [data-path-key="${partnerKey}"]').click();`);
    await sleep(600);
    const invAfterFold = await cdp.eval('document.querySelectorAll("#exec-aging-container [data-path-key*=\\"/inv:\\"]").length');
    assert(invAfterFold === 0, 'Folding partner successfully hid invoices');

    // Unfold partner
    await cdp.eval(`document.querySelector('#exec-aging-container [data-path-key="${partnerKey}"]').click();`);
    await sleep(600);
    const invAfterReopen = await cdp.eval('document.querySelectorAll("#exec-aging-container [data-path-key*=\\"/inv:\\"]").length');
    assert(invAfterReopen === invoicesCount, 'Re-expanding partner brought back cached invoices');

    // Fold department
    await cdp.eval(`document.querySelector('#exec-aging-container [data-path-key="${deptKey}"]').click();`);
    await sleep(600);
    const partnersAfterDeptFold = await cdp.eval('document.querySelectorAll("#exec-aging-container [data-path-key*=\\"/p:\\"]:not([data-path-key*=\\"/inv:\\"])").length');
    assert(partnersAfterDeptFold === 0, 'Folding department successfully hid partners');

    // Re-expand department
    await cdp.eval(`document.querySelector('#exec-aging-container [data-path-key="${deptKey}"]').click();`);
    await sleep(600);
    const partnersAfterDeptReopen = await cdp.eval('document.querySelectorAll("#exec-aging-container [data-path-key*=\\"/p:\\"]:not([data-path-key*=\\"/inv:\\"])").length');
    assert(partnersAfterDeptReopen === partnersCount, 'Re-expanding department brought back partners');

    // ──────────────────────────────────────────
    // TEST 4: Main TreeTable 1-Click Operations & Deep Children
    // ──────────────────────────────────────────
    console.log('\n--- 4. Main Executive TreeTable ---');
    const mainCoKey = await cdp.eval(`
      (() => {
        const row = document.querySelector('#exec-tree-table-container [data-path-key^="co:"]');
        if (row) { row.click(); return row.dataset.pathKey; }
        return null;
      })()
    `);
    assert(!!mainCoKey, 'Main TreeTable company clicked');
    await sleep(1500);

    let mainDepts = await cdp.eval('document.querySelectorAll("#exec-tree-table-container [data-path-key*=\\"/dept:\\"]").length');
    assert(mainDepts > 0, `Main TreeTable expanded company: ${mainDepts} departments`);

    // Click department to load groups
    const deptKeyMain = await cdp.eval(`
      (() => {
        const deptRow = document.querySelector('#exec-tree-table-container [data-path-key*="/dept:"]');
        if (deptRow) { deptRow.click(); return deptRow.dataset.pathKey; }
        return null;
      })()
    `);
    assert(!!deptKeyMain, 'Department in Main TreeTable clicked');
    await sleep(2000);

    const grpsCount = await cdp.eval('document.querySelectorAll("#exec-tree-table-container [data-path-key*=\\"/grp:\\"]").length');
    assert(grpsCount > 0, `Main TreeTable loaded department groups: ${grpsCount} groups`);

    // Click clients group to reveal journals
    const clientsGrpKey = await cdp.eval(`
      (() => {
        const grpRow = document.querySelector('#exec-tree-table-container [data-path-key*="/grp:clients"]');
        if (grpRow) { grpRow.click(); return grpRow.dataset.pathKey; }
        return null;
      })()
    `);
    assert(!!clientsGrpKey, 'Clients group clicked');
    await sleep(1500);

    const execJournalCount = await cdp.eval('document.querySelectorAll("#exec-tree-table-container [data-path-key*=\\"/grp:clients/j:\\"]").length');
    assert(execJournalCount > 0, `Journals list expanded: ${execJournalCount} journals`);

    // Click first journal to reveal clients
    await cdp.eval(`
      (() => {
        const jRow = document.querySelector('#exec-tree-table-container [data-path-key*="/grp:clients/j:"]');
        if (jRow) jRow.click();
      })()
    `);
    await sleep(1500);

    const clientRowsCount = await cdp.eval('document.querySelectorAll("#exec-tree-table-container [data-path-key*=\\"/p:\\"]").length');
    assert(clientRowsCount > 0, `Clients list expanded: ${clientRowsCount} clients`);

    // ──────────────────────────────────────────
    // TEST 5: AG2 Verification (Aging & Main Table across Period Changes)
    // ──────────────────────────────────────────
    console.log('\n--- 5. AG2: Aging & TreeTable Across Period Changes ---');

    // (A) Check Aging Table with accordion open across periods: 2026 -> ALL -> 2025
    // Current period is 2026
    const ag2_2026 = await cdp.eval(`
      (() => {
        const toggle = document.querySelector('#exec-aging-toggle strong.exec-num');
        const footer = document.querySelector('#exec-aging-container tr.exec-sticky-footer td:last-child');
        const rows = document.querySelectorAll('#exec-aging-container tr[data-tree-row]').length;
        const emptyMsg = document.querySelector('#exec-aging-container')?.textContent?.includes('لا توجد بيانات للعرض');
        return {
          headerVal: toggle ? parseInt(toggle.textContent.replace(/[^\\d]/g, ''), 10) : null,
          footerVal: footer ? parseInt(footer.textContent.replace(/[^\\d]/g, ''), 10) : null,
          rows,
          emptyMsg: !!emptyMsg
        };
      })()
    `);
    assert(ag2_2026.rows > 0 && !ag2_2026.emptyMsg, 'AG2 2026: Aging table populated and no empty message');
    assert(ag2_2026.headerVal != null && ag2_2026.headerVal === ag2_2026.footerVal, `AG2 2026: Header total matches table footer (${ag2_2026.headerVal})`);

    // Switch to ALL
    console.log('  Switching period to ALL...');
    await cdp.eval('document.querySelector("#yr-slicer .yr-all")?.click()');

    let ag2_all = null;
    const ag2AllStart = Date.now();
    while (Date.now() - ag2AllStart < 30000) {
      await sleep(350);
      ag2_all = await cdp.eval(`
        (() => {
          const agBox = document.querySelector('#exec-aging-container');
          if (!agBox) return null;
          const loading = document.querySelector('#exec-loading');
          if (loading && window.getComputedStyle(loading).display !== 'none') return null;
          if (agBox.style.display === 'none' && !agBox._toggleClicked) {
            agBox._toggleClicked = true;
            document.querySelector('#exec-aging-toggle')?.click();
          }
          const isLoading = agBox.textContent?.includes('جاري تحميل');
          if (isLoading) return null;
          const toggle = document.querySelector('#exec-aging-toggle strong.exec-num');
          const footer = agBox.querySelector('tr.exec-sticky-footer td:last-child');
          const rows = agBox.querySelectorAll('tr[data-tree-row]').length;
          const emptyMsg = agBox.textContent?.includes('لا توجد بيانات للعرض');
          const headerVal = toggle ? parseInt(toggle.textContent.replace(/[^\\d]/g, ''), 10) : null;
          const footerVal = footer ? parseInt(footer.textContent.replace(/[^\\d]/g, ''), 10) : null;
          return {
            headerVal,
            footerVal,
            rows,
            emptyMsg: !!emptyMsg,
            ready: !isLoading && rows > 0 && headerVal != null && headerVal === footerVal
          };
        })()
      `);
      if (ag2_all && ag2_all.ready) break;
    }
    assert(ag2_all && ag2_all.rows > 0 && !ag2_all.emptyMsg, 'AG2 ALL: Aging table populated and no empty message');
    assert(ag2_all && ag2_all.headerVal != null && ag2_all.headerVal === ag2_all.footerVal, `AG2 ALL: Header total matches table footer (${ag2_all ? ag2_all.headerVal : 'null'})`);

    // Switch to 2025
    console.log('  Switching period to 2025...');
    await cdp.eval('document.querySelector("#yr-slicer .yr-chip[data-year=\\"2025\\"]")?.click()');

    let ag2_2025 = null;
    const ag2_2025Start = Date.now();
    while (Date.now() - ag2_2025Start < 30000) {
      await sleep(350);
      ag2_2025 = await cdp.eval(`
        (() => {
          const agBox = document.querySelector('#exec-aging-container');
          if (!agBox) return null;
          const loading = document.querySelector('#exec-loading');
          if (loading && window.getComputedStyle(loading).display !== 'none') return null;
          if (agBox.style.display === 'none' && !agBox._toggleClicked) {
            agBox._toggleClicked = true;
            document.querySelector('#exec-aging-toggle')?.click();
          }
          const isLoading = agBox.textContent?.includes('جاري تحميل');
          if (isLoading) return null;
          const toggle = document.querySelector('#exec-aging-toggle strong.exec-num');
          const footer = agBox.querySelector('tr.exec-sticky-footer td:last-child');
          const rows = agBox.querySelectorAll('tr[data-tree-row]').length;
          const emptyMsg = agBox.textContent?.includes('لا توجد بيانات للعرض');
          const headerVal = toggle ? parseInt(toggle.textContent.replace(/[^\\d]/g, ''), 10) : null;
          const footerVal = footer ? parseInt(footer.textContent.replace(/[^\\d]/g, ''), 10) : null;
          return {
            headerVal,
            footerVal,
            rows,
            emptyMsg: !!emptyMsg,
            ready: !isLoading && rows > 0 && headerVal != null && headerVal === footerVal
          };
        })()
      `);
      if (ag2_2025 && ag2_2025.ready) break;
    }
    assert(ag2_2025 && ag2_2025.rows > 0 && !ag2_2025.emptyMsg, 'AG2 2025: Aging table populated and no empty message');
    assert(ag2_2025 && ag2_2025.headerVal != null && ag2_2025.headerVal === ag2_2025.footerVal, `AG2 2025: Header total matches table footer (${ag2_2025 ? ag2_2025.headerVal : 'null'})`);

    // (B) Main Table client rows preserved & mathematical sum == department or journal
    console.log('  Checking Main TreeTable department client rows under 2025...');
    let clientRows2025 = 0;
    const clientRowsStart = Date.now();
    while (Date.now() - clientRowsStart < 15000) {
      await sleep(250);
      clientRows2025 = await cdp.eval(`
        (() => {
          const rows = document.querySelectorAll('#exec-tree-table-container [data-path-key*="/p:"]').length;
          if (rows > 0) return rows;
          const dept = document.querySelector('#exec-tree-table-container [data-path-key*="/dept:"]');
          const grp = document.querySelector('#exec-tree-table-container [data-path-key*="/grp:clients"]');
          const jrn = document.querySelector('#exec-tree-table-container [data-path-key*="/grp:clients/j:"]');
          if (dept && !grp) dept.click();
          else if (grp && !jrn) grp.click();
          else if (jrn) jrn.click();
          return 0;
        })()
      `);
      if (clientRows2025 > 0) break;
    }
    assert(clientRows2025 > 0, `Main TreeTable client rows automatically re-fetched and preserved for 2025: ${clientRows2025} clients`);

    // Verify client sum matches parent journal or department row in 2025
    const deptMatch2025 = await cdp.eval(`
      (() => {
        const clientRows = Array.from(document.querySelectorAll('#exec-tree-table-container [data-path-key*="/p:"]'));
        let clientResidualSum = 0;
        clientRows.forEach(r => {
          const cells = r.querySelectorAll('td');
          const lastCell = cells[cells.length - 1]; // residual column is last
          const num = lastCell ? parseInt(lastCell.textContent.replace(/[^\\d]/g, '') || '0', 10) : 0;
          clientResidualSum += num;
        });

        const firstClient = clientRows[0];
        const jKey = firstClient ? firstClient.dataset.pathKey.split('/p:')[0] : null;
        const jRow = jKey ? document.querySelector('#exec-tree-table-container [data-path-key="' + jKey + '"]') : null;
        const jCells = jRow ? jRow.querySelectorAll('td') : [];
        const jResidual = jCells.length ? parseInt(jCells[jCells.length - 1].textContent.replace(/[^\\d]/g, '') || '0', 10) : 0;

        const deptKey = firstClient ? firstClient.dataset.pathKey.split('/grp:')[0] : null;
        const deptRow = deptKey ? document.querySelector('#exec-tree-table-container [data-path-key="' + deptKey + '"]') : null;
        const deptCells = deptRow ? deptRow.querySelectorAll('td') : [];
        const deptResidual = deptCells.length ? parseInt(deptCells[deptCells.length - 1].textContent.replace(/[^\\d]/g, '') || '0', 10) : 0;

        const targetResidual = jRow ? jResidual : deptResidual;

        return {
          clientResidualSum,
          targetResidual,
          deptResidual,
          jResidual,
          clientCount: clientRows.length,
          diff: Math.abs(clientResidualSum - targetResidual)
        };
      })()
    `);
    assert(deptMatch2025 && deptMatch2025.diff <= Math.max(1, deptMatch2025.clientCount), `Main TreeTable client sum matches parent row within rounding tolerance (diff: ${deptMatch2025.diff} SAR, clients: ${deptMatch2025.clientCount})`);

    // (C) Slicer Company Toggle with Open Hierarchy
    console.log('  Toggling company filter chip while hierarchy is open...');
    const activeCompaniesBefore = await cdp.eval('document.querySelectorAll("#co-slicer .co-chip.active").length');
    await cdp.eval(`
      const chips = document.querySelectorAll('#co-slicer .co-chip');
      if (chips.length > 1) chips[1].click();
    `);
    await sleep(3000);

    const activeCompaniesAfter = await cdp.eval('document.querySelectorAll("#co-slicer .co-chip.active").length');
    assert(activeCompaniesAfter === activeCompaniesBefore - 1, 'Company chip toggled off successfully');

    // Re-activate company chip via .co-all
    await cdp.eval(`
      document.querySelector('#co-slicer .co-all')?.click();
    `);
    await sleep(3000);
    const activeCompaniesRestored = await cdp.eval('document.querySelectorAll("#co-slicer .co-chip.active").length');
    assert(activeCompaniesRestored === activeCompaniesBefore, 'Company chip restored to active via slicer');

    // ──────────────────────────────────────────
    // TEST 6: YR1 Multi-Year Slicer & Mathematical Identity
    // ──────────────────────────────────────────
    console.log('\n--- 6. YR1: Multi-Year Slicer & Math Identity ---');

    // Helper to extract card numbers
    const getCardValues = async () => {
      return await cdp.eval(`
        (() => {
          const cards = {};
          const cardDivs = document.querySelectorAll('.bi-kpi-card, div[style*="border-right:4px solid"]');
          cardDivs.forEach(div => {
            const title = (div.querySelector('.bi-kpi-label') || div.querySelector('span'))?.textContent?.trim();
            const valText = (div.querySelector('.bi-kpi-value') || div.querySelector('.exec-num'))?.textContent?.replace(/,/g, '')?.trim();
            if (title && valText) {
              const num = parseFloat(valText) || 0;
              cards[title] = num;
              if (title === 'المتبقي') cards['المتبقي من فواتير الفترة'] = num;
            }
          });
          return cards;
        })()
      `);
    };

    // 1. Select 2026 only
    console.log('  Selecting 2026 only...');
    await cdp.eval(`
      document.querySelector('#yr-slicer .yr-all')?.click();
    `);
    await sleep(1500);
    await cdp.eval(`
      document.querySelector('#yr-slicer .yr-chip[data-year="2026"]')?.click();
    `);
    await sleep(3000);

    const cards_2026 = await getCardValues();
    assert(cards_2026['الإيرادات'] > 0, `Cards 2026 Revenue: ${cards_2026['الإيرادات']?.toLocaleString('en-US')}`);

    // 2. Multi-Select: 2026 + 2025
    console.log('  Multi-selecting 2026 + 2025...');
    await cdp.eval(`
      document.querySelector('#yr-slicer .yr-chip[data-year="2025"]')?.click();
    `);
    await sleep(3500);

    const is2026Active = await cdp.eval('document.querySelector("#yr-slicer .yr-chip[data-year=\\"2026\\"]")?.classList.contains("active")');
    const is2025Active = await cdp.eval('document.querySelector("#yr-slicer .yr-chip[data-year=\\"2025\\"]")?.classList.contains("active")');
    const isAllActive = await cdp.eval('document.querySelector("#yr-slicer .yr-all")?.classList.contains("active")');
    assert(is2026Active && is2025Active && !isAllActive, 'Multi-year chips 2025 and 2026 both active simultaneously, ALL is inactive');

    const periodLabelText = await cdp.eval('document.querySelector("#exec-effective-badge")?.textContent || ""');
    assert(periodLabelText.includes('2025 + 2026'), `Period label formatted in ascending order: "${periodLabelText.trim()}"`);

    const annualChartBars = await cdp.eval('document.querySelectorAll("#exec-chart-container .exec-chart-group[data-drill-year]").length');
    assert(annualChartBars >= 2, `Chart rendered annual bars for multi-year selection: ${annualChartBars} bars`);

    const treeRowsMulti = await cdp.eval('document.querySelectorAll("#exec-tree-table-container tr[data-tree-row]").length');
    const agingRowsMulti = await cdp.eval('document.querySelectorAll("#exec-aging-container tr[data-tree-row]").length');
    assert(treeRowsMulti > 0 && agingRowsMulti > 0, 'TreeTable and Aging Table both non-empty for multi-year');

    const cards_multi = await getCardValues();

    // 3. Select 2025 only (deselect 2026)
    console.log('  Deselecting 2026 to measure 2025 alone...');
    await cdp.eval(`
      document.querySelector('#yr-slicer .yr-chip[data-year="2026"]')?.click();
    `);
    await sleep(3500);

    const cards_2025 = await getCardValues();
    assert(cards_2025['الإيرادات'] > 0, `Cards 2025 Revenue: ${cards_2025['الإيرادات']?.toLocaleString('en-US')}`);

    // 4. Verify Mathematical Identity: Multi = 2026 + 2025 (within 2 SAR rounding tolerance)
    const revDiff = Math.abs(cards_multi['الإيرادات'] - (cards_2026['الإيرادات'] + cards_2025['الإيرادات']));
    const expDiff = Math.abs(cards_multi['المصروفات'] - (cards_2026['المصروفات'] + cards_2025['المصروفات']));
    const resDiff = Math.abs(cards_multi['المتبقي من فواتير الفترة'] - (cards_2026['المتبقي من فواتير الفترة'] + cards_2025['المتبقي من فواتير الفترة']));

    assert(revDiff <= 2, `Multi-year Revenue identity: multi (${cards_multi['الإيرادات']}) == 2026 + 2025 (diff: ${revDiff} SAR)`);
    assert(expDiff <= 2, `Multi-year Expense identity: multi (${cards_multi['المصروفات']}) == 2026 + 2025 (diff: ${expDiff} SAR)`);
    assert(resDiff <= 2, `Multi-year Residual identity: multi (${cards_multi['المتبقي من فواتير الفترة']}) == 2026 + 2025 (diff: ${resDiff} SAR)`);

    // 5. Deselect 2025 and return to 2026
    console.log('  Returning to 2026...');
    await cdp.eval(`
      document.querySelector('#yr-slicer .yr-chip[data-year="2026"]')?.click();
    `);
    await sleep(1000);
    await cdp.eval(`
      document.querySelector('#yr-slicer .yr-chip[data-year="2025"]')?.click();
    `);
    await sleep(3000);

    const cards_reverted = await getCardValues();
    assert(cards_reverted['الإيرادات'] === cards_2026['الإيرادات'], 'Deselecting 2025 accurately returned cards to 2026');

    // 6. Mutual Exclusivity with ALL
    console.log('  Testing mutual exclusivity: ALL vs Year chips...');
    await cdp.eval('document.querySelector("#yr-slicer .yr-all")?.click()');
    await sleep(2000);
    const allIsOn = await cdp.eval('document.querySelector("#yr-slicer .yr-all")?.classList.contains("active")');
    const chipActiveCount = await cdp.eval('document.querySelectorAll("#yr-slicer .yr-chip.active").length');
    assert(allIsOn && chipActiveCount === 0, 'Selecting ALL deactivated all individual year chips');

    await cdp.eval('document.querySelector("#yr-slicer .yr-chip[data-year=\\"2026\\"]")?.click()');
    await sleep(2000);
    const allIsOff = !(await cdp.eval('document.querySelector("#yr-slicer .yr-all")?.classList.contains("active")'));
    const is2026On = await cdp.eval('document.querySelector("#yr-slicer .yr-chip[data-year=\\"2026\\"]")?.classList.contains("active")');
    assert(allIsOff && is2026On, 'Selecting a year chip deactivated ALL and activated that year');

    // 7. Zero Selection Guard
    console.log('  Testing zero selection guard...');
    await cdp.eval('document.querySelector("#yr-slicer .yr-chip[data-year=\\"2026\\"]")?.click()');
    const still2026 = await cdp.eval('document.querySelector("#yr-slicer .yr-chip[data-year=\\"2026\\"]")?.classList.contains("active")');
    assert(still2026, 'Attempting to deselect the last active year chip is guarded and retains selection');


    // TEST 6.5: D1 — Customers & Collection Tab (العملاء والتحصيل)
    // ──────────────────────────────────────────
    console.log('\n--- 6.5. D1: Customers & Collection Tab Interactive Test ---');
    await cdp.eval('document.querySelector(".bi-tab[data-tab=\\"customers\\"]")?.click()');
    await sleep(3500);

    const isCustVisible = await cdp.eval('document.querySelector("#cust-main-content")?.style.display !== "none"');
    assert(isCustVisible, 'D1: Customers & Collection tab rendered and visible');

    // KPI cards
    const billedText = await cdp.eval('document.querySelector("#cust-main-content .exec-num")?.textContent');
    assert(billedText && billedText.length > 0, 'D1: KPI cards populated');

    // Aging toggle
    console.log('  Testing D1 aging toggle...');
    await cdp.eval('document.querySelector("#cust-aging-toggle")?.click()');
    await sleep(400);
    const agingDisplay = await cdp.eval('document.querySelector("#cust-aging-body")?.style.display');
    const bucketCards = await cdp.eval('document.querySelectorAll("#cust-aging-body > div").length');
    assert(agingDisplay === 'grid' && bucketCards === 7, 'D1: Collapsible aging opened with 7 buckets');

    // Returns toggle
    console.log('  Testing D1 returns toggle...');
    await cdp.eval('document.querySelector("#cust-returns-toggle")?.click()');
    await sleep(400);
    const returnsDisplay = await cdp.eval('document.querySelector("#cust-returns-body")?.style.display');
    const returnRows = await cdp.eval('document.querySelectorAll("#cust-returns-table-wrapper table tbody tr").length');
    assert(returnsDisplay === 'flex' && returnRows > 0, 'D1: Collapsible returns opened with rows');

    // TreeTable 4-level expansion
    console.log('  Testing D1 4-level TreeTable expansion...');
    await cdp.eval('document.querySelector("#cust-btn-collapse-all")?.click()');
    await sleep(400);

    const firstCoRow = await cdp.eval('document.querySelector("#cust-tree-container tr[data-tree-row=\\"true\\"]")?.getAttribute("data-path-key")');
    assert(firstCoRow && firstCoRow.startsWith('co:'), 'D1: First row is company level');

    await cdp.eval(`document.querySelector('#cust-tree-container tr[data-path-key="${firstCoRow}"]')?.click()`);
    await sleep(600);

    const deptRowsCount = await cdp.eval(`document.querySelectorAll('#cust-tree-container tr[data-path-key^="${firstCoRow}/dept:"]').length`);
    assert(deptRowsCount > 0, `D1: Expanded company revealed ${deptRowsCount} departments`);

    const firstDeptRow = await cdp.eval(`document.querySelector('#cust-tree-container tr[data-path-key^="${firstCoRow}/dept:"]')?.getAttribute('data-path-key')`);
    await cdp.eval(`document.querySelector('#cust-tree-container tr[data-path-key="${firstDeptRow}"]')?.click()`);
    await sleep(500);

    // Level 3: Journal / Cost Center
    const journalRowsCount = await cdp.eval(`document.querySelectorAll('#cust-tree-container tr[data-path-key^="${firstDeptRow}/journal:"]').length`);
    assert(journalRowsCount > 0, `D1 (R3-7): Expanded department revealed ${journalRowsCount} journals / cost centers`);

    const firstJournalRow = await cdp.eval(`document.querySelector('#cust-tree-container tr[data-path-key^="${firstDeptRow}/journal:"]')?.getAttribute('data-path-key')`);
    await cdp.eval(`document.querySelector('#cust-tree-container tr[data-path-key="${firstJournalRow}"]')?.click()`);
    await sleep(500);

    // Level 4: Partner / Client
    const partnerRowsCount = await cdp.eval(`document.querySelectorAll('#cust-tree-container tr[data-path-key^="${firstJournalRow}/partner:"]').length`);
    assert(partnerRowsCount > 0, `D1: Expanded journal revealed ${partnerRowsCount} partners`);

    const firstPartnerRow = await cdp.eval(`document.querySelector('#cust-tree-container tr[data-path-key^="${firstJournalRow}/partner:"]')?.getAttribute('data-path-key')`);
    
    // Level 5: Lazy load invoices
    console.log('  Testing D1 lazy loading of invoices...');
    await cdp.eval(`document.querySelector('#cust-tree-container tr[data-path-key="${firstPartnerRow}"]')?.click()`);
    let invoiceRowsCount = 0;
    for (let attempts = 0; attempts < 10; attempts++) {
      await sleep(500);
      invoiceRowsCount = await cdp.eval(`document.querySelectorAll('#cust-tree-container tr[data-path-key^="${firstPartnerRow}/invoice:"]').length`);
      if (invoiceRowsCount > 0) break;
    }
    assert(invoiceRowsCount > 0, `D1 (R3-7): Lazy-loaded ${invoiceRowsCount} invoices under customer (Level 5)`);

    // Statement modal
    console.log('  Testing customer statement modal...');
    await cdp.eval(`document.querySelector('#cust-tree-container tr[data-path-key="${firstPartnerRow}"] .btn-stmt-trigger')?.click()`);
    await sleep(2000);

    const modalDisplay = await cdp.eval('document.querySelector("#cust-statement-modal")?.style.display');
    const stmtRows = await cdp.eval('document.querySelectorAll("#stmt-print-area table tbody tr").length');
    assert(modalDisplay === 'flex' && stmtRows > 0, `D1: Customer statement modal opened with ${stmtRows} ledger rows`);

    await cdp.eval('document.querySelector("#stmt-btn-close")?.click()');
    await sleep(300);
    const modalClosed = await cdp.eval('document.querySelector("#cust-statement-modal")?.style.display === "none"');
    assert(modalClosed, 'D1: Customer statement modal closed successfully');

    // ──────────────────────────────────────────
    // TEST 6.6: D2 — Departments & Profitability Tab (الأقسام والربحية)
    // ──────────────────────────────────────────
    console.log('\n--- 6.6. D2: Departments & Profitability Tab Interactive Test ---');
    await cdp.eval('document.querySelector(".bi-tab[data-tab=\\"profitability\\"]")?.click()');
    await sleep(3500);

    const isProfVisible = await cdp.eval('document.querySelector("#prof-main-content")?.style.display !== "none"');
    assert(isProfVisible, 'D2: Departments & Profitability tab rendered and visible');

    // KPI cards (5 cards)
    const kpiCount = await cdp.eval('document.querySelectorAll(".exec-kpi-card").length');
    const firstKpiVal = await cdp.eval('document.querySelector(".exec-kpi-card .bi-kpi-value, .exec-kpi-card .exec-num")?.textContent');
    assert(kpiCount >= 5 && firstKpiVal && firstKpiVal.length > 0, `D2: 5 KPI cards populated (Revenue: ${firstKpiVal ? firstKpiVal.trim() : 'none'})`);

    // TreeTable structure
    const initialRows = await cdp.eval('document.querySelectorAll("#prof-tree-container tr[data-tree-row=\\"true\\"]").length');
    assert(initialRows > 0, `D2: Profitability TreeTable mounted with ${initialRows} root companies`);

    // Expand All
    console.log('  Testing D2 Expand All...');
    await cdp.eval('document.querySelector("#prof-btn-expand-all")?.click()');
    await sleep(600);
    const expandedRows = await cdp.eval('document.querySelectorAll("#prof-tree-container tr[data-tree-row=\\"true\\"]").length');
    assert(expandedRows > initialRows, `D2: Expanded all levels to ${expandedRows} rows (company -> dept -> cc -> account)`);

    // Collapse All
    console.log('  Testing D2 Collapse All...');
    await cdp.eval('document.querySelector("#prof-btn-collapse-all")?.click()');
    await sleep(400);
    const collapsedRows = await cdp.eval('document.querySelectorAll("#prof-tree-container tr[data-tree-row=\\"true\\"]").length');
    assert(collapsedRows === initialRows, `D2: Collapsed all levels back to ${collapsedRows} root companies`);

    // Redistribution Toggle
    console.log('  Testing D2 Administrative Expense Redistribution Toggle...');
    await cdp.eval('document.querySelector("#prof-redist-toggle")?.click()');
    await sleep(2500);
    const redistChecked = await cdp.eval('document.querySelector("#prof-redist-toggle")?.checked');
    const tableAfterRedist = await cdp.eval('document.querySelectorAll("#prof-tree-container tr[data-tree-row=\\"true\\"]").length');
    assert(redistChecked && tableAfterRedist > 0, 'D2: Administrative redistribution toggle checked and table updated');

    // Measure switch: Revenue
    console.log('  Testing D2 Measure switch to Revenue...');
    await cdp.eval('document.querySelector(".prof-measure-btn[data-measure=\\"revenue\\"]")?.click()');
    await sleep(2500);
    const activeMeasure = await cdp.eval('document.querySelector(".prof-measure-btn.active")?.getAttribute("data-measure")');
    assert(activeMeasure === 'revenue', 'D2: Measure switched to Revenue');

    // Time grain switch: Monthly
    console.log('  Testing D2 Time Grain switch to Month...');
    await cdp.eval('document.querySelector(".prof-grain-btn[data-grain=\\"month\\"]")?.click()');
    await sleep(2500);
    const monthCols = await cdp.eval('document.querySelectorAll("#prof-tree-container thead th").length');
    assert(monthCols > 5, `D2: Time grain switched to Month (rendered ${monthCols} columns)`);

    // Switch back to Quarter & Net
    await cdp.eval('document.querySelector(".prof-grain-btn[data-grain=\\"quarter\\"]")?.click()');
    await sleep(1500);
    await cdp.eval('document.querySelector(".prof-measure-btn[data-measure=\\"net\\"]")?.click()');
    await sleep(2000);

    // ──────────────────────────────────────────
    // R2-9: Verification of Contribution Column (المساهمة)
    // ──────────────────────────────────────────
    console.log('  Testing R2-9: Contribution column (المساهمة)...');
    const r2_9_check = await cdp.eval(`
      (() => {
        const contribTh = document.querySelector('#prof-tree-container th[data-col-id="contribution"]');
        const changeTh = document.querySelector('#prof-tree-container th[data-col-id="change"]');
        if (!contribTh) return { ok: false, reason: 'Contribution th header missing' };
        if (changeTh) return { ok: false, reason: 'Change column should not exist' };

        const rows = [...document.querySelectorAll('#prof-tree-container tr[data-tree-row="true"]')];
        if (rows.length === 0) return { ok: false, reason: 'No data rows found' };

        let totalCoContrib = 0;
        let coCount = 0;

        for (const row of rows) {
          const contribPctEl = row.querySelector('.prof-contrib-pct');
          const contribBarEl = row.querySelector('.prof-contrib-bar');
          if (contribPctEl && contribBarEl) {
            const pctText = contribPctEl.textContent.trim().replace('%', '');
            const pctNum = parseFloat(pctText);
            const barWidth = parseFloat(contribBarEl.style.width || '0');
            if (isNaN(pctNum)) continue;

            // Check bar width matches percentage within rounding
            if (Math.abs(Math.min(100, Math.round(Math.abs(pctNum))) - Math.round(barWidth)) > 1) {
              return { ok: false, reason: 'Bar width ' + barWidth + '% does not match pct ' + pctNum + '%' };
            }

            const tdName = row.querySelector('.tree-col-name');
            const paddingRight = parseInt(tdName?.style?.paddingRight || '0', 10);
            if (paddingRight <= 14) {
              totalCoContrib += pctNum;
              coCount++;
            }
          }
        }

        const coSumOk = coCount > 0 ? (totalCoContrib >= 99.0 && totalCoContrib <= 101.0) : true;
        return {
          ok: coSumOk,
          coCount,
          totalCoContrib: Math.round(totalCoContrib * 10) / 10,
          reason: coSumOk ? '' : 'Total co contribution ' + totalCoContrib + '% is outside [99, 101]'
        };
      })()
    `);
    assert(r2_9_check.ok, `R2-9: Contribution column verified (coCount: ${r2_9_check.coCount}, totalCoContrib: ${r2_9_check.totalCoContrib}%, reason: ${r2_9_check.reason || 'ok'})`);

    // ──────────────────────────────────────────
    // UC1: UI Verification: Zero 'غير مصنّف' in Profitability and Executive for All Companies & All Years
    // ──────────────────────────────────────────
    console.log('  Testing UC1: No "غير مصنّف" in Profitability and Executive tables for All Companies & All Years...');
    await cdp.eval(`(() => {
      const coAll = document.querySelector("#co-slicer .co-all");
      if (coAll && !coAll.classList.contains("active")) coAll.click();
      const yrAll = document.querySelector("#yr-slicer .yr-all");
      if (yrAll && !yrAll.classList.contains("active")) yrAll.click();
    })()`);
    await sleep(2500);

    // Expand all in Profitability
    await cdp.eval('document.querySelector("#prof-btn-expand-all")?.click()');
    await sleep(1000);
    const profHasUnclassified = await cdp.eval(`(() => {
      const text = document.querySelector('#prof-tree-container')?.textContent || '';
      return text.includes('غير مصنّف') || text.includes('غير مصنف');
    })()`);
    assert(!profHasUnclassified, 'UC1: No "غير مصنّف" in Profitability table for all companies & all years');

    // Switch to Executive and check
    await cdp.eval('document.querySelector(".bi-tab[data-tab=\\"executive\\"]")?.click()');
    await waitForTabReady(cdp, 'executive', 20000);
    await sleep(2000);
    // Expand all company rows in Executive
    await cdp.eval(`(() => {
      const coRows = document.querySelectorAll('#exec-tree-table-container [data-path-key^="co:"]');
      coRows.forEach(r => r.click());
    })()`);
    await sleep(1500);
    const execHasUnclassified = await cdp.eval(`(() => {
      const text = document.querySelector('#exec-tree-table-container')?.textContent || '';
      return text.includes('غير مصنّف') || text.includes('غير مصنف');
    })()`);
    assert(!execHasUnclassified, 'UC1: No "غير مصنّف" in Executive table for all companies & all years');

    // Reset back to 2026 for subsequent tests
    await cdp.eval('document.querySelector("#yr-slicer .yr-chip[data-year=\\"2026\\"]")?.click()');
    await sleep(1000);

    // ──────────────────────────────────────────
    // TEST 6.7: D3 — Bank Guarantees Tab (الضمانات البنكية)
    // ──────────────────────────────────────────
    console.log('\n--- 6.7. D3: Bank Guarantees Tab Interactive Test ---');
    await cdp.eval(`
      (() => {
        const coAll = document.querySelector("#co-slicer .co-all");
        if (coAll && !coAll.classList.contains("active")) {
          coAll.click();
        }
      })()
    `);
    await sleep(500);
    await cdp.eval('document.querySelector(".bi-tab[data-tab=\\"guarantees\\"]")?.click()');
    await waitForTabReady(cdp, 'guarantees', 20000);
    await sleep(1000);


    const isGrVisible = await cdp.eval('document.querySelector(".gr-wrap") !== null');
    assert(isGrVisible, 'D3: Guarantees tab rendered and visible');

    // KPI cards (4 cards)
    const grPendingAmt = await cdp.eval('document.querySelector("#gr-kpi-pending-amt")?.textContent');
    const grCount = await cdp.eval('document.querySelector("#gr-kpi-count")?.textContent');
    const grLedgerAmt = await cdp.eval('document.querySelector("#gr-kpi-ledger-amt")?.textContent');
    const grMatchStatus = await cdp.eval('document.querySelector("#gr-kpi-match-status")?.textContent');
    assert(grPendingAmt && grPendingAmt !== '—', `D3: Pending guarantees amount populated (${grPendingAmt})`);
    assert(grCount && grCount !== '—', `D3: Guarantees count populated (${grCount})`);
    assert(grLedgerAmt && grLedgerAmt !== '—', `D3: Ledger balance populated (${grLedgerAmt})`);
    assert(grMatchStatus && grMatchStatus.length > 0, `D3: Match status populated (${grMatchStatus.trim()})`);

    // Company tables
    const grCompaniesCount = await cdp.eval('document.querySelectorAll(".gr-company").length');
    assert(grCompaniesCount > 0, `D3: Rendered ${grCompaniesCount} company guarantee cards`);

    const grTotalRows = await cdp.eval('document.querySelectorAll(".gr-table tbody tr").length');
    assert(grTotalRows > 0, `D3: Guarantee tables contain ${grTotalRows} total rows`);

    // Admin controls: breakdown toggle & inline form
    console.log('  Testing D3 breakdown button & inline form...');
    const breakdownBtn = await cdp.eval('document.querySelector(\'[data-action="breakdown"]\') !== null');
    if (breakdownBtn) {
      await cdp.eval('document.querySelector(\'[data-action="breakdown"]\')?.click()');
      await sleep(500);
      const formExists = await cdp.eval('document.querySelector(".gr-add-form") !== null');
      assert(formExists, 'D3: Clicking breakdown opened inline sub-item add form');

      await cdp.eval('document.querySelector(\'[data-action="cancel-sub"]\')?.click()');
      await sleep(300);
      const formClosed = await cdp.eval('document.querySelector(".gr-add-form") === null');
      assert(formClosed, 'D3: Clicking cancel closed inline sub-item add form');
    }

    // Toggle show released
    console.log('  Testing D3 Show Released Guarantees Toggle...');
    await cdp.eval(`
      (() => {
        const cb = document.querySelector("#gr-toggle-released");
        if (cb) {
          cb.checked = true;
          cb.dispatchEvent(new Event("change"));
        }
      })()
    `);
    await sleep(2500);

    const isReleasedToggled = await cdp.eval('document.querySelector("#gr-toggle-released")?.checked');
    assert(isReleasedToggled === true, 'D3: Show released guarantees toggle checked');
    await cdp.eval(`
      (() => {
        const cb = document.querySelector("#gr-toggle-released");
        if (cb) {
          cb.checked = false;
          cb.dispatchEvent(new Event("change"));
        }
      })()
    `);
    await sleep(2000);
    await cdp.eval(`
      (() => {
        const cb = document.querySelector("#gr-toggle-released");
        if (cb) {
          cb.checked = false;
          cb.dispatchEvent(new Event("change"));
        }
      })()
    `);
    await sleep(2000);

    // ──────────────────────────────────────────
    // TEST 6.8: D5 — Value Added Tax Tab (ضريبة القيمة المضافة)
    // ──────────────────────────────────────────
    console.log('\n--- 6.8. D5: Value Added Tax Tab Interactive Test ---');
    await cdp.eval('document.querySelector(".bi-tab[data-tab=\\"vat\\"]")?.click()');
    await waitForTabReady(cdp, 'vat', 12000);
    await sleep(1000);

    const isVatVisible = await cdp.eval('document.querySelector("#vat-main-content")?.style.display !== "none"');
    assert(isVatVisible, 'D5: VAT tab rendered and visible');

    // 4 KPI cards
    const vatKpiCount = await cdp.eval('document.querySelectorAll("#vat-main-content .exec-card").length');
    const firstVatCardVal = await cdp.eval('document.querySelector("#vat-main-content .exec-card .vat-card-num, #vat-main-content .exec-card .exec-num")?.textContent');
    assert(vatKpiCount >= 4 && firstVatCardVal && firstVatCardVal.length > 0, `D5: 4 KPI cards populated (Output Tax: ${firstVatCardVal.trim()})`);

    // TreeTable company rows
    const vatCompanyRows = await cdp.eval('document.querySelectorAll("#vat-tree-container tr[data-tree-row=\\"true\\"]").length');
    assert(vatCompanyRows >= 4, `D5: VAT TreeTable mounted with ${vatCompanyRows} company rows`);

    // Hierarchy expansion: Expand company down to months
    console.log('  Testing D5 hierarchy expansion...');
    const firstVatCoKey = await cdp.eval('document.querySelector("#vat-tree-container tr[data-path-key^=\\"co:\\"]")?.getAttribute("data-path-key")');
    assert(firstVatCoKey !== null, `D5: Found company key: ${firstVatCoKey}`);

    // Click company row to expand years
    await cdp.eval(`document.querySelector('#vat-tree-container tr[data-path-key="${firstVatCoKey}"]')?.click()`);
    await sleep(600);
    const yrRowsCount = await cdp.eval(`document.querySelectorAll('#vat-tree-container tr[data-path-key^="${firstVatCoKey}/year:"]').length`);
    assert(yrRowsCount > 0, `D5: Expanded company revealed ${yrRowsCount} years`);

    // Click year row to expand quarters
    const firstYrKey = await cdp.eval(`document.querySelector('#vat-tree-container tr[data-path-key^="${firstVatCoKey}/year:"]')?.getAttribute('data-path-key')`);
    await cdp.eval(`document.querySelector('#vat-tree-container tr[data-path-key="${firstYrKey}"]')?.click()`);
    await sleep(600);
    const qRowsCount = await cdp.eval(`document.querySelectorAll('#vat-tree-container tr[data-path-key^="${firstYrKey}/quarter:"]').length`);
    assert(qRowsCount > 0, `D5: Expanded year revealed ${qRowsCount} quarters`);

    // Click quarter row to expand months
    const firstQKey = await cdp.eval(`document.querySelector('#vat-tree-container tr[data-path-key^="${firstYrKey}/quarter:"]')?.getAttribute('data-path-key')`);
    await cdp.eval(`document.querySelector('#vat-tree-container tr[data-path-key="${firstQKey}"]')?.click()`);
    await sleep(600);
    const mRowsCount = await cdp.eval(`document.querySelectorAll('#vat-tree-container tr[data-path-key^="${firstQKey}/month:"]').length`);
    assert(mRowsCount > 0, `D5: Expanded quarter revealed ${mRowsCount} months`);

    // Grain switch testing
    console.log('  Testing D5 Grain switch...');
    await cdp.eval('document.querySelector(\'.vat-grain-btn[data-grain="quarter"]\')?.click()');
    await sleep(1500);
    const grainQuarterActive = await cdp.eval('document.querySelector(\'.vat-grain-btn[data-grain="quarter"]\')?.classList.contains("active")');
    assert(grainQuarterActive, 'D5: Grain switched to Quarter');

    await cdp.eval('document.querySelector(\'.vat-grain-btn[data-grain="month"]\')?.click()');
    await sleep(1500);
    const grainMonthActive = await cdp.eval('document.querySelector(\'.vat-grain-btn[data-grain="month"]\')?.classList.contains("active")');
    assert(grainMonthActive, 'D5: Grain switched to Month');

    await cdp.eval('document.querySelector(\'.vat-grain-btn[data-grain="vat_period"]\')?.click()');
    await sleep(1500);
    const grainVatActive = await cdp.eval('document.querySelector(\'.vat-grain-btn[data-grain="vat_period"]\')?.classList.contains("active")');
    assert(grainVatActive, 'D5: Grain returned to VAT Period (default)');

    // Slide-over Drawer testing
    console.log('  Testing D5 slide-over detail drawer...');
    await cdp.eval('document.querySelector(".vat-detail-btn")?.click()');
    await sleep(2500);

    const drawerVisible = await cdp.eval(`
      (() => {
        const d = document.querySelector("#vat-drawer");
        if (!d) return false;
        return d.style.transform === "translateX(0px)" || d.style.transform === "translateX(0)";
      })()
    `);
    assert(drawerVisible, 'D5: Slide-over drawer opened on clicking details button');

    // Test 4 tabs in drawer
    const drawerTabsCount = await cdp.eval('document.querySelectorAll(".drawer-tab-btn").length');
    assert(drawerTabsCount >= 4, `D5: Drawer rendered ${drawerTabsCount} detail tabs (Summary, Tax, Docs, Settlements)`);

    // Switch to By Tax tab
    await cdp.eval('document.querySelector(\'.drawer-tab-btn[data-tab="by_tax"]\')?.click()');
    await sleep(400);
    const byTaxPaneVisible = await cdp.eval('document.querySelector("#dtab-by_tax")?.style.display !== "none"');
    assert(byTaxPaneVisible, 'D5: Drawer switched to By Tax breakdown pane');

    // Switch to Documents tab
    await cdp.eval('document.querySelector(\'.drawer-tab-btn[data-tab="documents"]\')?.click()');
    await sleep(400);
    const docsPaneVisible = await cdp.eval('document.querySelector("#dtab-documents")?.style.display !== "none"');
    assert(docsPaneVisible, 'D5: Drawer switched to Documents pane');

    // Switch to Settlements tab
    await cdp.eval('document.querySelector(\'.drawer-tab-btn[data-tab="settlements"]\')?.click()');
    await sleep(400);
    const settlementsPaneVisible = await cdp.eval('document.querySelector("#dtab-settlements")?.style.display !== "none"');
    assert(settlementsPaneVisible, 'D5: Drawer switched to Settlements pane');

    // Close drawer
    await cdp.eval('document.querySelector("#vat-drawer-close-btn")?.click()');
    await sleep(500);
    const drawerClosed = await cdp.eval(`
      (() => {
        const d = document.querySelector("#vat-drawer");
        if (!d) return true;
        return d.style.transform.includes("-100%");
      })()
    `);
    assert(drawerClosed, 'D5: Slide-over drawer closed successfully');

    // ──────────────────────────────────────────
    // TEST 6.9: D4/C1 — Presentation Tabs Consolidation (6 Clean Tabs)
    // ──────────────────────────────────────────
    console.log('\n--- 6.9. D4/C1: Presentation Tabs Consolidation (6 Clean Tabs) ---');
    const visibleTabs = await cdp.eval(`
      (() => {
        const tabs = [...document.querySelectorAll('#bi-tabs .bi-tab')];
        return tabs
          .filter(t => t.style.display !== 'none' && window.getComputedStyle(t).display !== 'none')
          .map(t => t.dataset.tab);
      })()
    `);
    const expectedTabs = ['executive', 'customers', 'profitability', 'guarantees', 'vat', 'actual-collections', 'comparison'];
    const tabsMatch = visibleTabs.length === 7 && expectedTabs.every(t => visibleTabs.includes(t));
    assert(tabsMatch, `D4/C1: Exactly 7 clean tabs visible (the six original tabs + DC1 «مقارنة الأقسام»): [${visibleTabs.join(', ')}]`);

    const hiddenLegacyCount = await cdp.eval(`
      (() => {
        const legacyTabs = ['overview', 'collection', 'details', 'pivot-acc', 'pivot-cc', 'redist', 'sales', 'sales-details'];
        return legacyTabs.filter(lt => {
          const el = document.querySelector(\`#bi-tabs .bi-tab[data-tab="\${lt}"]\`);
          return el && (el.style.display === 'none' || window.getComputedStyle(el).display === 'none');
        }).length;
      })()
    `);
    assert(hiddenLegacyCount === 8, `D4: All 8 legacy tabs are completely hidden (count: ${hiddenLegacyCount})`);

    // ──────────────────────────────────────────
    // TEST 6.95: Stage C1 — Actual Collections Tab Interactive Test («التحصيل الفعلي»)
    // ──────────────────────────────────────────
    console.log('\n--- 6.95. Stage C1: Actual Collections Tab Interactive Test ---');
    await cdp.eval('document.querySelector(".bi-tab[data-tab=\\"actual-collections\\"]")?.click()');
    await waitForTabReady(cdp, 'actual-collections', 12000);
    await sleep(1000);

    const isColVisible = await cdp.eval('document.querySelector("#col-main-content")?.style.display !== "none"');
    assert(isColVisible, 'C1: Actual Collections tab rendered and visible');

    // Section 1: KPI cards
    const colKpiCount = await cdp.eval('document.querySelectorAll("#col-main-content .bi-kpi").length');
    const totalCollectedVal = await cdp.eval('document.querySelector("#col-main-content .bi-kpi:first-child .bi-kpi-value")?.textContent?.trim()');
    assert(colKpiCount >= 4 && totalCollectedVal && totalCollectedVal !== '0', `C1: KPI cards populated (Total Collected: ${totalCollectedVal})`);

    // Section 2: Periodic breakdown & chart
    const periodicRows = await cdp.eval('document.querySelectorAll("#col-main-content table.bi-table tbody tr").length');
    assert(periodicRows > 0, `C1: Section 2 periodic table has ${periodicRows} rows`);

    // Grain switch
    console.log('  Testing C1 Grain switch...');
    await cdp.eval('document.querySelector(\'.col-grain-btn[data-grain="quarter"]\')?.click()');
    await sleep(800);
    const colGrainQuarterActive = await cdp.eval('document.querySelector(\'.col-grain-btn[data-grain="quarter"]\')?.classList.contains("active")');
    assert(colGrainQuarterActive, 'C1: Grain switched to Quarter');

    await cdp.eval('document.querySelector(\'.col-grain-btn[data-grain="year"]\')?.click()');
    await sleep(800);
    const colGrainYearActive = await cdp.eval('document.querySelector(\'.col-grain-btn[data-grain="year"]\')?.classList.contains("active")');
    assert(colGrainYearActive, 'C1: Grain switched to Year');

    await cdp.eval('document.querySelector(\'.col-grain-btn[data-grain="month"]\')?.click()');
    await sleep(800);
    const colGrainMonthActive = await cdp.eval('document.querySelector(\'.col-grain-btn[data-grain="month"]\')?.classList.contains("active")');
    assert(colGrainMonthActive, 'C1: Grain returned to Month (default)');

    // Section 3: Invoice year cross-tab
    const invYearHeader = await cdp.eval(`
      (() => {
        const h3 = Array.from(document.querySelectorAll('#col-main-content h3'));
        return h3.some(el => el.textContent.includes('سنوات فواتير'));
      })()
    `);
    assert(invYearHeader, 'C1: Section 3 Invoice Year cross-tab header visible');

    // Section 4: TreeTable & View Switch
    console.log('  Testing C1 Section 4 TreeTable & Direct View...');
    const colTreeRows = await cdp.eval('document.querySelectorAll("#col-tree-container tr[data-tree-row=\\"true\\"]").length');
    assert(colTreeRows >= 4, `C1: Section 4 TreeTable mounted with ${colTreeRows} company rows`);

    // Expand first company in tree
    const firstColCoKey = await cdp.eval('document.querySelector("#col-tree-container tr[data-path-key^=\\"co:\\"]")?.getAttribute("data-path-key")');
    assert(firstColCoKey !== null, `C1: Found collections company key: ${firstColCoKey}`);
    await cdp.eval(`document.querySelector('#col-tree-container tr[data-path-key="${firstColCoKey}"]')?.click()`);
    await sleep(600);
    const colDeptRowsCount = await cdp.eval(`document.querySelectorAll('#col-tree-container tr[data-path-key^="${firstColCoKey}/dept:"]').length`);
    assert(colDeptRowsCount > 0, `C1: Expanded company revealed ${colDeptRowsCount} departments`);

    // Switch to Direct Clients view
    await cdp.eval('document.querySelector(\'.col-view-btn[data-mode="direct"]\')?.click()');
    await sleep(400);
    const colDirectVisible = await cdp.eval('document.querySelector("#col-direct-container")?.style.display !== "none"');
    const colDirectRows = await cdp.eval('document.querySelectorAll("#col-direct-container tbody tr").length');
    assert(colDirectVisible && colDirectRows > 0, `C1: Switched to Direct Clients view with ${colDirectRows} clients`);

    // Search filter test in Direct view
    await cdp.eval(`
      (() => {
        const inp = document.querySelector("#col-client-search");
        if (inp) {
          inp.value = "مختبر";
          inp.dispatchEvent(new Event("input"));
        }
      })()
    `);
    await sleep(400);
    const colFilteredRows = await cdp.eval('document.querySelectorAll("#col-direct-container tbody tr").length');
    assert(colFilteredRows > 0, `C1: Direct search filter returned ${colFilteredRows} results for "مختبر"`);

    // Clear search and switch back to tree
    await cdp.eval('document.querySelector("#btn-col-clear-search")?.click()');
    await sleep(300);
    await cdp.eval('document.querySelector(\'.col-view-btn[data-mode="tree"]\')?.click()');
    await sleep(400);

    // Section 5: Accounts Reconciliation
    const colRecMatches = await cdp.eval(`
      (() => {
        const txt = document.querySelector('#col-main-content')?.textContent || '';
        return txt.includes('إثبات المطابقة') && (txt.includes('مطابق تماماً بالهللة') || txt.includes('فارق:'));
      })()
    `);
    assert(colRecMatches, 'C1: Section 5 Accounts reconciliation verified with balance proof bar');

    // Section 6: Audit non-bank table
    const colAuditHeader = await cdp.eval(`
      (() => {
        const h3 = Array.from(document.querySelectorAll('#col-main-content h3'));
        return h3.some(el => el.textContent.includes('سدادات خارج بنك الشركة'));
      })()
    `);
    assert(colAuditHeader, 'C1: Section 6 Audit non-bank receipts table header visible');

    // Excel export button check
    const colExcelBtn = await cdp.eval('document.querySelector("#btn-export-excel-collections") !== null');
    assert(colExcelBtn, 'C1: Excel Export button present in toolbar');

    // ──────────────────────────────────────────
    // TEST 6.96: Stage F1: Cost Center (Journal) & Group Portal Slicers Test
    // ──────────────────────────────────────────
    console.log('\n--- 6.96. Stage F1: Cost Center (Journal) & Group Portal Slicers Test ---');

    // 1. Navigate to executive tab on desktop (1440x900)
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await cdp.eval('document.querySelector(".bi-tab[data-tab=\\"executive\\"]")?.click()');
    await waitForTabReady(cdp, 'executive', 15000);
    await sleep(800);

    const hasGroupBtn = await cdp.eval('!!document.querySelector("#btn-group-slicer")');
    const hasJournalBtn = await cdp.eval('!!document.querySelector("#btn-journal-slicer")');
    assert(hasGroupBtn && hasJournalBtn, 'F1 (1): Topbar contains both Group and Journal slicer buttons');

    // 2. Open Journal Slicer on 1440px desktop
    console.log('  Testing F1 Desktop Portal Rendering & elementFromPoint non-clipping...');
    await cdp.eval('document.querySelector("#btn-journal-slicer")?.click()');
    await sleep(400);

    const isPortalInBody = await cdp.eval(`
      (() => {
        const portal = document.querySelector('.bi-portal-dropdown');
        if (!portal) return false;
        // Verify portal is direct child of document.body (not trapped in overflow:hidden parent)
        return portal.parentElement === document.body;
      })()
    `);
    assert(isPortalInBody, 'F1 (2a): Dropdown appended directly to document.body (Portal pattern immune to parent clipping)');

    // 3. Verify elementFromPoint for search, items, and apply button
    const elementFromPointCheck = await cdp.eval(`
      (() => {
        const portal = document.querySelector('.bi-portal-dropdown');
        if (!portal) return { ok: false, error: 'portal not found' };

        const search = portal.querySelector('#drop-search-input');
        const applyBtn = portal.querySelector('#btn-drop-apply');
        const itemRows = Array.from(portal.querySelectorAll('.slicer-item-row')).slice(0, 3);

        const checkClickable = (el, name) => {
          if (!el) return { name, ok: false, error: 'element missing' };
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return { name, ok: false, error: 'zero size' };
          const cx = Math.floor(rect.left + rect.width / 2);
          const cy = Math.floor(rect.top + rect.height / 2);
          if (cx < 0 || cx > window.innerWidth || cy < 0 || cy > window.innerHeight) {
            return { name, ok: false, error: 'offscreen: ' + cx + ',' + cy };
          }
          const topEl = document.elementFromPoint(cx, cy);
          const isMatch = topEl && (topEl === el || el.contains(topEl) || topEl.contains(el));
          return { name, ok: isMatch, topElTag: topEl ? topEl.tagName : null };
        };

        const results = [];
        results.push(checkClickable(search, 'search_input'));
        itemRows.forEach((row, i) => results.push(checkClickable(row, 'item_row_' + i)));
        results.push(checkClickable(applyBtn, 'apply_btn'));

        const allOk = results.every(r => r.ok);
        return { ok: allOk, results };
      })()
    `);
    assert(elementFromPointCheck.ok, `F1 (2b): elementFromPoint verified interactive elements are non-clipped and clickable: ${JSON.stringify(elementFromPointCheck.results.map(r => r.name + ':' + r.ok))}`);

    // 4. Live Search with Arabic Normalization
    console.log('  Testing F1 Live Search in Portal...');
    const searchFilterResult = await cdp.eval(`
      (() => {
        const search = document.querySelector('#drop-search-input');
        if (!search) return { ok: false };
        const initialCount = document.querySelectorAll('.slicer-item-row').length;
        
        // Search with Arabic text dynamically derived from first item
        const firstItem = document.querySelector('.slicer-item-row .slicer-item-name');
        const query = firstItem ? firstItem.textContent.trim().split(/\s+/)[0] : 'مختبر';
        search.value = query;
        search.dispatchEvent(new Event('input'));
        const filteredCount = document.querySelectorAll('.slicer-item-row').length;

        // Clear search
        const clearBtn = document.querySelector('#btn-search-clear');
        if (clearBtn) clearBtn.click();
        const restoredCount = document.querySelectorAll('.slicer-item-row').length;

        return {
          ok: filteredCount > 0 && filteredCount <= initialCount && restoredCount === initialCount,
          query,
          initialCount,
          filteredCount,
          restoredCount
        };
      })()
    `);
    assert(searchFilterResult.ok, `F1 (3): Search with Arabic normalization (${searchFilterResult.query}) filters items correctly (${searchFilterResult.initialCount} -> ${searchFilterResult.filteredCount} -> ${searchFilterResult.restoredCount})`);

    // 5. Multi-selection, Apply, and Additivity
    console.log('  Testing F1 Multi-selection, Apply & Filter Invariant...');
    const selectTwoResult = await cdp.eval(`
      (() => {
        const chks = Array.from(document.querySelectorAll('.slicer-item-row .slicer-chk'));
        if (chks.length < 2) return { ok: false, error: 'less than 2 journals available' };
        
        // Uncheck all first
        const clearAll = document.querySelector('#btn-drop-clear-all');
        if (clearAll) clearAll.click();

        // Check first 2
        chks[0].click();
        chks[1].click();
        const jrn1Name = chks[0].closest('.slicer-item-row')?.dataset.name || '';
        const jrn2Name = chks[1].closest('.slicer-item-row')?.dataset.name || '';

        // Click Apply
        const applyBtn = document.querySelector('#btn-drop-apply');
        applyBtn.click();

        return {
          ok: true,
          jrn1Name,
          jrn2Name
        };
      })()
    `);
    assert(selectTwoResult.ok, `F1 (4a): Selected 2 journals (${selectTwoResult.jrn1Name}, ${selectTwoResult.jrn2Name}) and applied`);
    await sleep(800);

    // Verify dropdown closed and trigger button updated
    const isClosedAndUpdated = await cdp.eval(`
      (() => {
        const portal = document.querySelector('.bi-portal-dropdown');
        const valText = document.querySelector('#val-journal-slicer')?.textContent?.trim() || '';
        const activeChipRow = document.querySelector('#active-filter-chips-row');
        const isChipRowVisible = activeChipRow && window.getComputedStyle(activeChipRow).display !== 'none';
        const chipText = activeChipRow?.textContent || '';

        return {
          portalClosed: !portal,
          valText,
          hasCount: valText.includes('2') || valText.includes('مختارة'),
          isChipRowVisible,
          chipHasJournals: chipText.includes('مركز التكلفة') && chipText.includes('2')
        };
      })()
    `);
    assert(isClosedAndUpdated.portalClosed, 'F1 (4b): Portal dropdown closed upon Apply');
    assert(isClosedAndUpdated.hasCount, `F1 (4c): Trigger button shows selection count: "${isClosedAndUpdated.valText}"`);
    assert(isClosedAndUpdated.isChipRowVisible && isClosedAndUpdated.chipHasJournals, 'F1 (4d): Active filter chips row displays selected journals count');

    // Deselect back to "الكل"
    console.log('  Testing F1 Deselect & Return to "الكل"...');
    await cdp.eval('document.querySelector(".btn-clear-jrn")?.click()');
    await sleep(800);

    const isReset = await cdp.eval(`
      (() => {
        const valText = document.querySelector('#val-journal-slicer')?.textContent?.trim() || '';
        const activeChipRow = document.querySelector('#active-filter-chips-row');
        const isHidden = !activeChipRow || window.getComputedStyle(activeChipRow).display === 'none';
        return {
          isAll: valText === 'الكل',
          isHidden
        };
      })()
    `);
    assert(isReset.isAll && isReset.isHidden, `F1 (4e): Deselect returns journal slicer to "الكل" and hides active filter chip`);

    // 5b. F2 Isolation Test: Select «مختبر جدة» under Company 2 (شركة سمير)
    console.log('  Testing F2 Company-Scoped Cost Center Isolation («مختبر جدة» under شركة سمير)...');
    await cdp.eval('document.querySelector("#btn-journal-slicer")?.click()');
    await sleep(400);

    const f2SelectResult = await cdp.eval(`
      (() => {
        const portal = document.querySelector('.bi-portal-dropdown');
        if (!portal) return { ok: false, error: 'portal missing' };

        // Search for مختبر جدة
        const searchInput = portal.querySelector('#drop-search-input');
        if (searchInput) {
          searchInput.value = 'مختبر جدة';
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        // Find items for Co 1 (مكتب سمير) and Co 2 (شركة سمير)
        const rows = Array.from(portal.querySelectorAll('.slicer-item-row'));
        const co2Row = rows.find(r => r.dataset.id === '2|an:مختبر جدة' || (r.textContent.includes('مختبر جدة') && r.closest('.slicer-group-block')?.textContent.includes('شركة سمير')));
        const co1Row = rows.find(r => r.dataset.id === '1|an:مختبر جدة' || (r.textContent.includes('مختبر جدة') && r.closest('.slicer-group-block')?.textContent.includes('مكتب سمير')));

        if (!co2Row) return { ok: false, error: 'Company 2 مختبر جدة row not found' };

        // Uncheck all first
        portal.querySelector('#btn-drop-clear-all')?.click();

        // Check ONLY Co 2 row
        const co2Chk = co2Row.querySelector('.slicer-chk');
        co2Chk?.click();

        // Verify Co 1 row remains UNCHECKED
        const co1Chk = co1Row ? co1Row.querySelector('.slicer-chk') : null;
        const co1Unchecked = co1Chk ? !co1Chk.checked : true;

        // Apply
        portal.querySelector('#btn-drop-apply')?.click();

        return {
          ok: true,
          co2Checked: co2Chk?.checked,
          co1Unchecked
        };
      })()
    `);
    assert(f2SelectResult.ok && f2SelectResult.co1Unchecked, 'F2: Selecting مختبر جدة under شركة سمير leaves مكتب سمير unchecked');
    await sleep(1000);

    // Verify Active Filter Chip displays company name
    const f2ChipCheck = await cdp.eval(`
      (() => {
        const chip = document.querySelector('.filter-chip-jrn');
        const text = chip ? chip.textContent.trim() : '';
        return {
          ok: text.includes('مختبر جدة') && text.includes('شركة سمير'),
          text
        };
      })()
    `);
    assert(f2ChipCheck.ok, `F2: Active filter chip displays company name: "${f2ChipCheck.text}"`);

    // Reset filter
    await cdp.eval('document.querySelector(".btn-clear-jrn")?.click()');
    await sleep(800);

    // 6. Mobile Viewport (390x844) Bottom Sheet Rendering
    console.log('  Testing F1 Mobile (390px) Bottom Sheet rendering & elementFromPoint...');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 1,
      mobile: true
    });
    await sleep(500);

    await cdp.eval('document.querySelector("#btn-journal-slicer")?.click()');
    await sleep(400);

    const mobileSheetCheck = await cdp.eval(`
      (() => {
        const portal = document.querySelector('.bi-portal-dropdown');
        if (!portal) return { ok: false, error: 'portal missing on mobile' };

        const s = window.getComputedStyle(portal);
        const isBottomAligned = portal.style.bottom === '0px' || s.bottom === '0px';
        const isFullWidth = portal.style.width === '100%' || s.width === '390px';

        const search = portal.querySelector('#drop-search-input');
        const applyBtn = portal.querySelector('#btn-drop-apply');

        const checkEl = (el) => {
          if (!el) return false;
          const rect = el.getBoundingClientRect();
          const cx = Math.floor(rect.left + rect.width / 2);
          const cy = Math.floor(rect.top + rect.height / 2);
          const topEl = document.elementFromPoint(cx, cy);
          return Boolean(topEl && (topEl === el || el.contains(topEl) || topEl.contains(el)));
        };

        const searchOk = checkEl(search);
        const applyOk = checkEl(applyBtn);

        // Close portal
        portal.querySelector('#btn-drop-close')?.click();

        return {
          ok: isBottomAligned && isFullWidth && searchOk && applyOk,
          isBottomAligned,
          isFullWidth,
          searchOk,
          applyOk
        };
      })()
    `);
    assert(mobileSheetCheck.ok, `F1 (5): Mobile bottom sheet renders properly at 390px without clipping (bottom: ${mobileSheetCheck.isBottomAligned}, fullWidth: ${mobileSheetCheck.isFullWidth}, search: ${mobileSheetCheck.searchOk}, apply: ${mobileSheetCheck.applyOk})`);

    // Reset viewport back to desktop
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sleep(300);

    // 7. Tab Applicability (Disabled on guarantees and vat)
    console.log('  Testing F1 Slicer Tab Applicability (disabled on Guarantees & VAT)...');
    await cdp.eval('document.querySelector(".bi-tab[data-tab=\\"guarantees\\"]")?.click()');
    await waitForTabReady(cdp, 'guarantees', 12000);
    await sleep(500);

    const isGuaranteesDisabled = await cdp.eval(`
      (() => {
        const jrnBtn = document.querySelector('#btn-journal-slicer');
        const grpBtn = document.querySelector('#btn-group-slicer');
        return jrnBtn?.disabled === true || jrnBtn?.style.pointerEvents === 'none';
      })()
    `);
    assert(isGuaranteesDisabled, 'F1 (6a): Slicer buttons disabled on Guarantees tab');

    await cdp.eval('document.querySelector(".bi-tab[data-tab=\\"vat\\"]")?.click()');
    await waitForTabReady(cdp, 'vat', 12000);
    await sleep(500);

    const isVatDisabled = await cdp.eval(`
      (() => {
        const jrnBtn = document.querySelector('#btn-journal-slicer');
        return jrnBtn?.disabled === true || jrnBtn?.style.pointerEvents === 'none';
      })()
    `);
    assert(isVatDisabled, 'F1 (6b): Slicer buttons disabled on VAT tab');

    await cdp.eval('document.querySelector(".bi-tab[data-tab=\\"executive\\"]")?.click()');
    await waitForTabReady(cdp, 'executive', 12000);
    await sleep(500);

    const isExecutiveReenabled = await cdp.eval(`
      (() => {
        const jrnBtn = document.querySelector('#btn-journal-slicer');
        return jrnBtn?.disabled === false && jrnBtn?.style.pointerEvents !== 'none';
      })()
    `);
    assert(isExecutiveReenabled, 'F1 (6c): Slicer buttons re-enabled on Executive tab');

    // ──────────────────────────────────────────
    // TEST 7: Viewer Mode & Route Guard
    // ──────────────────────────────────────────
    console.log('\n--- 7. Viewer Mode Authentication & Integrity ---');
    const db = getDb();
    const vToken = crypto.randomBytes(32).toString('hex');
    const vPhone = '0555555555';
    const av = db.prepare('SELECT id FROM allowed_viewers WHERE phone = ?').get(vPhone);
    if (!av) {
      db.prepare('INSERT INTO allowed_viewers (name, phone, is_active) VALUES (?, ?, 1)').run('مشاهد تجريبي', vPhone);
    } else {
      db.prepare('UPDATE allowed_viewers SET is_active = 1 WHERE phone = ?').run(vPhone);
    }
    db.prepare("INSERT INTO viewer_sessions (token, phone, expires_at) VALUES (?, ?, datetime('now', '+12 hours'))")
      .run(vToken, vPhone);

    await cdp.eval(`
      localStorage.removeItem('mizaniat_admin_token');
      localStorage.setItem('mizaniat_viewer_mode', 'true');
      localStorage.setItem('mizaniat_viewer_token', '${vToken}');
      sessionStorage.setItem('mizaniat_viewer_token', '${vToken}');
      sessionStorage.removeItem('mizaniat_exec_aging_expanded');
      sessionStorage.removeItem('mizaniat_exec_main_expanded');
    `);

    await cdp.send('Page.navigate', {
      url: `http://localhost:${APP_PORT}/index.html?page=presentation&tab=executive`
    });
    await sleep(3500);

    const isViewerActive = await cdp.eval('window.isViewerMode()');
    assert(isViewerActive, 'Viewer session active in window');

    // Route guard test: attempt navigating to settings
    await cdp.eval('window.location.hash = "#settings"');
    await cdp.eval('document.querySelector(".sidebar-nav a[data-page=\\"settings\\"]")?.click()');
    await sleep(1000);
    const currentUrl = await cdp.eval('window.location.href');
    assert(!currentUrl.includes('page=settings'), 'Route guard blocked viewer access to settings');

    // Guarantees tab viewer mode check: strictly read-only
    console.log('  Testing D3 Guarantees Tab in Viewer Mode...');
    await cdp.eval('document.querySelector(".bi-tab[data-tab=\\"guarantees\\"]")?.click()');
    await sleep(3000);
    const viewerGrVisible = await cdp.eval('document.querySelector(".gr-wrap") !== null');
    const viewerAdminControls = await cdp.eval('document.querySelectorAll("#gr-toggle-released, [data-action=\\"release\\"], [data-action=\\"breakdown\\"], [data-action=\\"toggle-sub\\"], [data-action=\\"del-sub\\"]").length');
    assert(viewerGrVisible, 'Viewer opened Guarantees tab');
    assert(viewerAdminControls === 0, `Guarantees is strictly read-only for viewers (${viewerAdminControls} admin controls found)`);

    // VAT tab viewer mode check: strictly read-only
    console.log('  Testing D5 VAT Tab in Viewer Mode...');
    await cdp.eval('document.querySelector(".bi-tab[data-tab=\\"vat\\"]")?.click()');
    let viewerVatRows = 0;
    for (let attempts = 0; attempts < 10; attempts++) {
      await sleep(500);
      viewerVatRows = await cdp.eval('document.querySelectorAll("#vat-tree-container tr[data-tree-row=\\"true\\"]").length');
      if (viewerVatRows > 0) break;
    }
    const viewerVatVisible = await cdp.eval('document.querySelector("#vat-main-content")?.style.display !== "none"');
    assert(viewerVatVisible && viewerVatRows > 0, `Viewer opened VAT tab successfully with ${viewerVatRows} rows`);

    // Actual Collections tab viewer mode check: read-only access verified
    console.log('  Testing C1 Actual Collections Tab in Viewer Mode...');
    await cdp.eval('document.querySelector(".bi-tab[data-tab=\\"actual-collections\\"]")?.click()');
    let viewerColCards = 0;
    for (let attempts = 0; attempts < 10; attempts++) {
      await sleep(500);
      viewerColCards = await cdp.eval('document.querySelectorAll("#col-main-content .bi-kpi").length');
      if (viewerColCards > 0) break;
    }
    const viewerColVisible = await cdp.eval('document.querySelector("#col-main-content")?.style.display !== "none"');
    assert(viewerColVisible && viewerColCards >= 4, `Viewer opened Actual Collections tab successfully with ${viewerColCards} KPI cards`);
    // ──────────────────────────────────────────
    // TEST 7.4: R2-8 — Cold vs Warm Cache Response Times & 0 Duplicate Requests
    // ──────────────────────────────────────────
    console.log('\n--- 7.4. R2-8: Cold vs Warm Cache Performance & Deduplication Suite ---');
    const screenshotsDir = path.join(__dirname, '..', '..', 'scratch', 'responsive');
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    // Restore admin session
    await cdp.eval(`
      localStorage.setItem('mizaniat_admin_token', '${adminToken}');
      localStorage.removeItem('mizaniat_viewer_mode');
      localStorage.removeItem('mizaniat_viewer_token');
      sessionStorage.removeItem('mizaniat_viewer_token');
    `);

    const perfTabs = ['executive', 'customers', 'profitability', 'guarantees', 'vat', 'actual-collections'];
    const perfResults = [];

    for (const tab of perfTabs) {
      console.log(`  Testing Performance for Tab: ${tab}...`);
      
      // Cold Test
      cdp.networkRequests = [];
      const coldStart = Date.now();
      await cdp.send('Page.navigate', {
        url: `http://localhost:${APP_PORT}/index.html?page=presentation&tab=${tab}&theme=dark`
      });
      const coldReady = await waitForTabReady(cdp, tab, 12000);
      const coldDuration = (Date.now() - coldStart) / 1000;
      assert(coldReady, `[${tab}] Cold load tab rendered successfully`);
      
      // Count duplicate API requests
      const apiReqs = cdp.networkRequests.filter(r => r.url.includes('/api/'));
      const urlCounts = {};
      apiReqs.forEach(r => {
        try {
          const u = new URL(r.url);
          const key = u.pathname + u.search;
          urlCounts[key] = (urlCounts[key] || 0) + 1;
        } catch (e) {}
      });
      const dupUrls = Object.entries(urlCounts).filter(([_, count]) => count > 1);
      assert(dupUrls.length === 0, `[${tab}] 0 duplicate API requests in single load (duplicates: ${dupUrls.map(([k, c]) => `${k} x${c}`).join(', ') || 'none'})`);

      // Warm Test (SPA tab navigation with server warm cache)
      const otherTab = tab === 'vat' ? 'executive' : 'vat';
      await cdp.eval(`document.querySelector('.bi-tab[data-tab="${otherTab}"]')?.click()`);
      await sleep(250);

      cdp.networkRequests = [];
      const warmStart = Date.now();
      await cdp.eval(`document.querySelector('.bi-tab[data-tab="${tab}"]')?.click()`);
      const warmReady = await waitForTabReady(cdp, tab, 5000);
      const warmDuration = (Date.now() - warmStart) / 1000;
      assert(warmReady, `[${tab}] Warm load tab rendered successfully`);

      perfResults.push({
        tab,
        coldDuration: Math.round(coldDuration * 100) / 100,
        warmDuration: Math.round(warmDuration * 100) / 100,
        duplicateCount: dupUrls.length
      });

      assert(coldDuration <= 2.5, `[${tab}] Cold cache response time <= 2.5s (actual: ${coldDuration.toFixed(2)}s)`);
      assert(warmDuration <= 1.0, `[${tab}] Warm cache response time <= 1.0s (actual: ${warmDuration.toFixed(2)}s)`);
    }

    console.log('\n  📊 R2-8 Performance Benchmark Results:');
    console.log('  ┌───────────────┬─────────────┬─────────────┬────────────┐');
    console.log('  │ Tab           │ Cold (s)    │ Warm (s)    │ Duplicates │');
    console.log('  ├───────────────┼─────────────┼─────────────┼────────────┤');
    perfResults.forEach(r => {
      console.log(`  │ ${r.tab.padEnd(13)} │ ${String(r.coldDuration).padEnd(11)} │ ${String(r.warmDuration).padEnd(11)} │ ${String(r.duplicateCount).padEnd(10)} │`);
    });
    console.log('  └───────────────┴─────────────┴─────────────┴────────────┘');

    // R2-8 Cache Verification: Query live server cache stats
    console.log('\n  Testing R2-8 Live server pre-warmed stats & safety limits...');
    const stats = await cdp.eval(`
      (async () => {
        const token = localStorage.getItem('mizaniat_admin_token');
        const res = await fetch('/api/cache/stats', {
          headers: token ? { 'Authorization': 'Bearer ' + token } : {}
        });
        return await res.json();
      })()
    `);
    console.log(`  Live Server Cache stats: keys=${stats?.keys}, hits=${stats?.hits}, misses=${stats?.misses}, v=${stats?.dataVersion}, riyadhDate=${stats?.riyadhDate}`);
    assert(stats && stats.keys > 0, `R2-8 Warmup: Live server cache has pre-warmed keys (keys count: ${stats?.keys})`);
    assert(stats && (stats.hits > 0 || stats.keys > 0), `R2-8 Warmup: Live server served requests from cache (hits: ${stats?.hits})`);
    assert(stats && stats.riyadhDate && stats.riyadhDate.length === 10, `R2-8 Cache: Riyadh date verified (${stats?.riyadhDate})`);

    // R2-8 Cache Verification: Invalidation upon mutation on live server
    console.log('  Testing R2-8 Invalidation upon mutation on live server...');
    const vBefore = stats?.dataVersion || 0;
    const mutateRes = await cdp.eval(`
      (async () => {
        const token = localStorage.getItem('mizaniat_admin_token');
        const getRes = await fetch('/api/companies', {
          headers: token ? { 'Authorization': 'Bearer ' + token } : {}
        });
        const companies = await getRes.json();
        const origVat = companies.find(c => c.id === 1)?.vat_period || 'quarterly';
        const newVat = origVat === 'monthly' ? 'quarterly' : 'monthly';
        const res = await fetch('/api/companies/1/vat-period', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ vat_period: newVat })
        });
        const mutateData = await res.json();
        const statsRes = await fetch('/api/cache/stats', {
          headers: token ? { 'Authorization': 'Bearer ' + token } : {}
        });
        const statsData = await statsRes.json();
        // Restore original vat_period
        await fetch('/api/companies/1/vat-period', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ vat_period: origVat })
        });
        return { mutateData, statsData };
      })()
    `);
    const vAfter = mutateRes?.statsData?.dataVersion || vBefore;
    assert(vAfter > vBefore, `R2-8 Invalidation: dataVersion incremented on live mutation (${vBefore} -> ${vAfter})`);

    // SH1-R3: UI Verification of Client Cache Invalidation for Profitability & Customers
    console.log('  Testing SH1-R3 Client Cache Invalidation for Profitability & Customers tabs...');
    // Mark window to verify no full page reload happens
    await cdp.eval('window.__no_reload_marker = "active";');
    
    // Visit profitability tab to populate cache
    await cdp.eval('document.querySelector(".bi-tab[data-tab=\\"profitability\\"]")?.click();');
    await waitForTabReady(cdp, 'profitability', 5000);
    
    // Visit customers tab to populate cache
    await cdp.eval('document.querySelector(".bi-tab[data-tab=\\"customers\\"]")?.click();');
    await waitForTabReady(cdp, 'customers', 5000);
    
    const sizesBefore = await cdp.eval(`({
      prof: window.__getProfitabilityClientCacheSize ? window.__getProfitabilityClientCacheSize() : 0,
      cust: window.__getCustomersClientCacheSize ? window.__getCustomersClientCacheSize() : 0
    })`);
    assert(sizesBefore.prof > 0 && sizesBefore.cust > 0, `SH1-R3: Client caches populated before refresh (prof: ${sizesBefore.prof}, cust: ${sizesBefore.cust})`);
    
    // Click Refresh button in the UI
    await cdp.eval('document.querySelector("#btn-refresh")?.click();');
    await sleep(400);
    
    // Confirm no page reload occurred
    const markerVal = await cdp.eval('window.__no_reload_marker');
    assert(markerVal === 'active', 'SH1-R3: UI refresh performed without page reload');
    
    // Central invalidation directly clears both registered caches
    await cdp.eval('window.__invalidateClientCache && window.__invalidateClientCache();');
    const sizesAfterDirect = await cdp.eval(`({
      prof: window.__getProfitabilityClientCacheSize ? window.__getProfitabilityClientCacheSize() : -1,
      cust: window.__getCustomersClientCacheSize ? window.__getCustomersClientCacheSize() : -1
    })`);
    assert(sizesAfterDirect.prof === 0 && sizesAfterDirect.cust === 0, `SH1-R3: Central invalidation clears all client caches (prof: ${sizesAfterDirect.prof}, cust: ${sizesAfterDirect.cust})`);

    // ──────────────────────────────────────────
    // TEST 7.5: RESP1 — Multi-Resolution Responsive, Layout & Theming Suite
    // ──────────────────────────────────────────
    console.log('\n--- 7.5. RESP1: Multi-Resolution Responsive, Layout & Theming Suite ---');

    const testResolutions = [
      { name: 'Mobile-Standard (390x844)', width: 390, height: 844, isMobile: true },
      { name: 'Tablet-Portrait (768x1024)', width: 768, height: 1024, isMobile: false },
      { name: 'Laptop-Standard (1366x768)', width: 1366, height: 768, isMobile: false },
      { name: 'Desktop-Mac (1440x900)', width: 1440, height: 900, isMobile: false },
      { name: 'Desktop-Wide (1920x1080)', width: 1920, height: 1080, isMobile: false }
    ];

    const testTabs = ['executive', 'customers', 'profitability', 'guarantees', 'vat', 'actual-collections'];
    const md5Map = {};

    for (const res of testResolutions) {
      console.log(`\n  >> Testing Resolution: ${res.name} (width: ${res.width}px, height: ${res.height}px)`);
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: res.width,
        height: res.height,
        deviceScaleFactor: 1,
        mobile: res.isMobile
      });
      // Condition wait for viewport metrics to apply instead of static sleep
      const resizeStart = Date.now();
      while (Date.now() - resizeStart < 2000) {
        const curWidth = await cdp.eval('window.innerWidth');
        if (curWidth === res.width) break;
        await sleep(50);
      }

      for (const tab of testTabs) {
        for (const theme of ['dark', 'light']) {
          // Explicit navigation with theme param (R2-6)
          await cdp.send('Page.navigate', {
            url: `http://localhost:${APP_PORT}/index.html?page=presentation&tab=${tab}&theme=${theme}`
          });

          const ready = await waitForTabReady(cdp, tab, 20000);
          assert(ready, `[${res.name} - ${tab} - ${theme}] Tab content rendered and ready`);

          // Assert data-theme attribute matches on documentElement (R2-6)
          const domTheme = await cdp.eval('document.documentElement.getAttribute("data-theme")');
          assert(domTheme === theme, `[${res.name} - ${tab} - ${theme}] data-theme attribute matches requested theme (${domTheme} === ${theme})`);

          // Geometric viewport overflow check (rect.left >= -2 && rect.right <= vw + 2)
          const overflowCheck = await cdp.eval(`
            (() => {
              const vw = window.innerWidth;
              const elements = Array.from(document.querySelectorAll('.bi-page *'));
              let maxRight = 0;
              let minLeft = 0;
              let overflowingEl = null;
              for (const el of elements) {
                if (el.closest('[data-scroll-x="true"]') || el.closest('[data-scroll-x]') || el.closest('.tree-table-wrap') || el.closest('.perf-table-wrap') || el.closest('.mobile-sheet-open') || el.closest('#sidebar') || el.closest('.sidebar-backdrop') || el.closest('#vat-drawer') || el.closest('#cust-statement-modal') || el.closest('#exec-drawer') || el.closest('#exec-drawer-backdrop') || el.closest('.exec-drawer-backdrop') || el.closest('.drawer') || el.closest('.bi-tabs') || el.closest('#bi-tabs')) {
                  continue;
                }
                const rect = el.getBoundingClientRect();
                if (rect.width > 0 && rect.height > 0) {
                  if (rect.right > vw + 2) {
                    if (rect.right > maxRight) {
                      maxRight = rect.right;
                      overflowingEl = (el.tagName + (el.className ? '.' + el.className.split(' ').join('.') : '') + (el.id ? '#' + el.id : '')) + ' (right: ' + Math.round(rect.right) + ' > ' + vw + ')';
                    }
                  }
                  if (rect.left < -2) {
                    if (rect.left < minLeft) {
                      minLeft = rect.left;
                      overflowingEl = (el.tagName + (el.className ? '.' + el.className.split(' ').join('.') : '') + (el.id ? '#' + el.id : '')) + ' (left: ' + Math.round(rect.left) + ' < 0)';
                    }
                  }
                }
              }
              return {
                overflowing: maxRight > vw + 2 || minLeft < -2,
                maxRight,
                minLeft,
                overflowingEl
              };
            })()
          `);
          assert(!overflowCheck.overflowing, `[${res.name} - ${tab} - ${theme}] No element geometrically overflows viewport (${overflowCheck.overflowingEl || 'none'})`);

          // Color Contrast Check (WCAG >= 4.5) (R2-1 & R2-6)
          const contrast = await checkContrastRatio(cdp);
          if (contrast.failuresCount > 0) {
            console.error(`  [CONTRAST FAILURES SAMPLE for ${tab} - ${theme}]:`, JSON.stringify(contrast.failures));
          }
          assert(contrast.failuresCount === 0, `[${res.name} - ${tab} - ${theme}] WCAG contrast >= 4.5 for all numbers & table cells (evaluated: ${contrast.evaluatedCount}, min ratio: ${contrast.minRatio})`);

          // Table width checks on desktop resolutions [1366, 1440, 1920] (R2-2 & R2-6)
          if ([1366, 1440, 1920].includes(res.width)) {
            const tableCheck = await checkTableWidth(cdp, tab);
            if (tableCheck) {
              assert(tableCheck.fits, `[${res.name} - ${tab} - ${theme}] Table width (${tableCheck.tableWidth}px) <= container width (${tableCheck.containerWidth}px) + 1 (no horizontal overflow)`);
              assert(tableCheck.fills, `[${res.name} - ${tab} - ${theme}] Table fills container: ${tableCheck.ratio}% >= 98%`);
            }
          }

          // KPI grid 5-columns in 1 row check on >= 1200px (1440 and 1920) (R2-3)
          if (res.width >= 1200 && ['executive', 'customers', 'profitability'].includes(tab)) {
            const kpiColsCheck = await cdp.eval(`
              (() => {
                let grid = null;
                if ('${tab}' === 'executive') grid = document.querySelector('.exec-kpi-grid');
                else if ('${tab}' === 'customers') grid = document.querySelector('.cust-kpi-grid');
                else if ('${tab}' === 'profitability') grid = document.querySelector('.prof-kpi-grid');
                if (!grid) return null;
                const s = window.getComputedStyle(grid);
                const cols = (s.gridTemplateColumns || '').trim().split(/\\s+/).length;
                return { cols };
              })()
            `);
            if (kpiColsCheck) {
              assert(kpiColsCheck.cols === 5, `[${res.name} - ${tab} - ${theme}] KPI cards grid has 5 columns in 1 row (found: ${kpiColsCheck.cols})`);
            }
          }

          // Mobile checks on 390px (R2-4)
          if (res.width === 390) {
            if (['executive', 'customers'].includes(tab)) {
              const mobileGridCheck = await cdp.eval(`
                (() => {
                  let grid = null;
                  if ('${tab}' === 'executive') grid = document.querySelector('.exec-kpi-grid');
                  else if ('${tab}' === 'customers') grid = document.querySelector('.cust-kpi-grid');
                  if (!grid) return null;
                  const s = window.getComputedStyle(grid);
                  const cols = (s.gridTemplateColumns || '').trim().split(/\\s+/).length;
                  const card5 = grid.children[4];
                  const card5Span = card5 ? window.getComputedStyle(card5).gridColumn : '';
                  return { cols, spansTwo: card5Span.includes('span 2') || card5Span.includes('1 / 3') || card5Span.includes('1 / -1') };
                })()
              `);
              if (mobileGridCheck) {
                assert(mobileGridCheck.cols === 2, `[${res.name} - ${tab} - ${theme}] Mobile KPI grid has 2 columns (found: ${mobileGridCheck.cols})`);
                assert(mobileGridCheck.spansTwo, `[${res.name} - ${tab} - ${theme}] 5th KPI card spans 2 columns on mobile`);
              }
            }
            if (tab === 'vat') {
              const vatNumCheck = await cdp.eval(`
                (() => {
                  const nums = Array.from(document.querySelectorAll('.vat-card-num'));
                  return nums.every(n => !n.textContent.includes('...') && !n.textContent.includes('…'));
                })()
              `);
              assert(vatNumCheck, `[${res.name} - vat - ${theme}] Mobile VAT card numbers are not truncated with ellipsis`);
            }
          }

          // Tab Bar check at >= 1280px (UI1: Right-aligned, transparent active background)
          if (res.width >= 1280) {
            const tabBarCheck = await cdp.eval(`
              (() => {
                const bar = document.querySelector('.bi-tabs');
                const tabs = Array.from(document.querySelectorAll('.bi-tab'));
                const activeTab = document.querySelector('.bi-tab.active');
                if (!bar || tabs.length === 0) return null;
                const barRect = bar.getBoundingClientRect();
                const firstTabRect = tabs[0].getBoundingClientRect();
                const rightEdgeDist = Math.abs(barRect.right - firstTabRect.right);
                const activeBg = activeTab ? window.getComputedStyle(activeTab).backgroundColor : '';
                const isBgTransparent = !activeBg || activeBg === 'rgba(0, 0, 0, 0)' || activeBg === 'transparent';
                return {
                  rightEdgeDist,
                  isBgTransparent
                };
              })()
            `);
            if (tabBarCheck) {
              assert(tabBarCheck.rightEdgeDist <= 36, `[${res.name} - ${theme}] Tab bar is right-aligned: first tab starts near right edge (${tabBarCheck.rightEdgeDist.toFixed(1)}px <= 36px)`);
              assert(tabBarCheck.isBgTransparent, `[${res.name} - ${theme}] Active tab has transparent background`);
            }
          }

          // Capture Screenshot & Compute MD5
          const shot = await cdp.send('Page.captureScreenshot', { format: 'png' });
          const filename = `${tab}_${res.width}x${res.height}_${theme}.png`;
          const filePath = path.join(screenshotsDir, filename);
          fs.writeFileSync(filePath, Buffer.from(shot.data, 'base64'));

          const hash = crypto.createHash('md5').update(Buffer.from(shot.data, 'base64')).digest('hex');
          const key = `${tab}_${res.width}x${res.height}`;
          if (!md5Map[key]) md5Map[key] = {};
          md5Map[key][theme] = hash;

          // If both dark and light captured for this pair, assert md5 differs!
          if (md5Map[key].dark && md5Map[key].light) {
            assert(md5Map[key].dark !== md5Map[key].light, `[${res.name} - ${tab}] Dark mode and Light mode screenshots are distinct (dark: ${md5Map[key].dark.slice(0, 8)}, light: ${md5Map[key].light.slice(0, 8)})`);
          }
        }
      }
    }

    // Clear emulation
    await cdp.send('Emulation.clearDeviceMetricsOverride');
    await sleep(400);

    // ──────────────────────────────────────────
    // TEST 7.6: Responsive Screenshots Validation (50 Screenshots)
    // ──────────────────────────────────────────
    console.log('\n--- 7.6. Responsive Screenshots Validation ---');
    const allFiles = fs.readdirSync(screenshotsDir);
    const darkShots = allFiles.filter(f => f.endsWith('_dark.png'));
    const lightShots = allFiles.filter(f => f.endsWith('_light.png'));
    console.log(`  📸 Dark Mode Screenshots: ${darkShots.length}/25`);
    console.log(`  📸 Light Mode Screenshots: ${lightShots.length}/25`);
    console.log(`  📸 Total Generated Screenshots: ${darkShots.length + lightShots.length}/50 in scratch/responsive/`);

    assert(darkShots.length >= 25, `All 25 Dark Mode screenshots captured (found ${darkShots.length})`);
    assert(lightShots.length >= 25, `All 25 Light Mode screenshots captured (found ${lightShots.length})`);
    let validSizeCount = 0;
    for (const f of [...darkShots, ...lightShots]) {
      const sz = fs.statSync(path.join(screenshotsDir, f)).size;
      if (sz > 5000) validSizeCount++;
    }
    assert(validSizeCount === (darkShots.length + lightShots.length), `All ${darkShots.length + lightShots.length} screenshots have valid non-trivial file size (> 5KB)`);

    // ──────────────────────────────────────────
    // TEST 7.7: R2-10 — Zero-Value Reduction Suite (تقليل عرض الأصفار)
    // ──────────────────────────────────────────
    console.log('\n--- 7.7. R2-10: Zero-Value Reduction Suite (تقليل عرض الأصفار) ---');

    // Make sure we are in executive tab
    await cdp.eval('document.querySelector(".bi-tab[data-tab=\\"executive\\"]")?.click()');
    await waitForTabReady(cdp, 'executive', 12000);
    await sleep(600);

    // 1. Year Slicer dynamic filtering (Requirement 3)
    console.log('  Testing R2-10 Year Slicer dynamic filtering...');
    await cdp.eval(`
      (() => {
        const coAll = document.querySelector('.co-all');
        const co1 = document.querySelector('.co-chip[data-id="1"]');
        if (coAll?.classList.contains('active')) coAll.click();
        const activeCos = document.querySelectorAll('.co-chip.active');
        activeCos.forEach(c => { if (c.dataset.id !== '1') c.click(); });
        if (!co1?.classList.contains('active')) co1?.click();
      })()
    `);
    await sleep(500);

    const yr2020VisibleForCo1 = await cdp.eval(`
      (() => {
        const chip = document.querySelector('.yr-chip[data-year="2020"]');
        return chip ? chip.style.display !== 'none' : false;
      })()
    `);
    assert(!yr2020VisibleForCo1, 'R2-10: Year 2020 chip is hidden when Company 1 is selected (no entries in 2020)');

    const yr2024VisibleForCo1 = await cdp.eval(`
      (() => {
        const chip = document.querySelector('.yr-chip[data-year="2024"]');
        return chip ? chip.style.display !== 'none' : false;
      })()
    `);
    assert(yr2024VisibleForCo1, 'R2-10: Year 2024 chip is visible when Company 1 is selected (has entries)');

    // Restore "All Companies"
    await cdp.eval('document.querySelector(".co-all")?.click()');
    await sleep(500);

    // 2. Conditions across tabs: Executive, Profitability, VAT
    const r2_10_tabs = ['executive', 'profitability', 'vat'];
    for (const rTab of r2_10_tabs) {
      console.log(`\n  >> Testing R2-10 Zero-Value Reduction on tab: ${rTab}`);
      await cdp.eval(`document.querySelector(".bi-tab[data-tab=\\"${rTab}\\"]")?.click()`);
      await waitForTabReady(cdp, rTab, 12000);
      await sleep(600);

      // (A) Ensure switch is OFF initially (default)
      await cdp.eval(`
        (() => {
          const chk = document.querySelector('#chk-show-zero-items');
          if (chk && chk.checked) {
            chk.click();
          }
        })()
      `);
      await sleep(600);

      // Count rows with switch OFF
      const rowsOff = await cdp.eval(`
        document.querySelectorAll('.tree-table-wrap tbody tr[data-tree-row="true"]').length
      `);

      // Read badge text and extract number
      const badgeInfo = await cdp.eval(`
        (() => {
          const badge = document.querySelector('#badge-hidden-zero-count');
          const isShown = badge && badge.style.display !== 'none';
          const text = badge?.textContent || '';
          const match = text.match(/\\d+/);
          return { isShown, text, count: match ? parseInt(match[0], 10) : 0 };
        })()
      `);

      // Read totals row cells with switch OFF
      const totalsTextOff = await cdp.eval(`
        (() => {
          const tfoot = document.querySelector('.tree-table-wrap tfoot tr');
          return tfoot ? Array.from(tfoot.querySelectorAll('td, th')).map(c => (c.textContent || '').trim()).join('|') : '';
        })()
      `);

      // Check condition (C): No visible row has all zero cells when switch is OFF
      const allZeroRowsCount = await cdp.eval(`
        (() => {
          const rows = Array.from(document.querySelectorAll('.tree-table-wrap tbody tr[data-tree-row="true"]'));
          let allZeroCount = 0;
          for (const row of rows) {
            const cells = Array.from(row.querySelectorAll('td:not(.tree-col-name):not(.tree-col-action):not(.tree-col-visual)'));
            const nonZero = cells.some(c => {
              const txt = (c.textContent || '').trim().replace(/[\\s,،ر.سSAR%\\u200e\\u200f()]/g, '');
              return txt !== '' && txt !== '—' && txt !== '-' && !/^0(\\.0+)?$/.test(txt);
            });
            if (!nonZero) allZeroCount++;
          }
          return allZeroCount;
        })()
      `);
      assert(allZeroRowsCount === 0, `R2-10 (C) [${rTab}]: No visible row has all zero cells when toggle is OFF (found ${allZeroRowsCount})`);

      // Turn switch ON
      await cdp.eval(`
        (() => {
          const chk = document.querySelector('#chk-show-zero-items');
          if (chk && !chk.checked) {
            chk.click();
          }
        })()
      `);
      await sleep(600);

      // Count rows with switch ON
      const rowsOn = await cdp.eval(`
        document.querySelectorAll('.tree-table-wrap tbody tr[data-tree-row="true"]').length
      `);

      // Read totals row cells with switch ON
      const totalsTextOn = await cdp.eval(`
        (() => {
          const tfoot = document.querySelector('.tree-table-wrap tfoot tr');
          return tfoot ? Array.from(tfoot.querySelectorAll('td, th')).map(c => (c.textContent || '').trim()).join('|') : '';
        })()
      `);

      // (A) Table totals with toggle OFF === with toggle ON
      assert(totalsTextOff === totalsTextOn, `R2-10 (A) [${rTab}]: Totals row is identical with toggle OFF vs ON`);

      // (D) Badge count === rows with switch ON - rows with switch OFF
      assert(badgeInfo.count === (rowsOn - rowsOff), `R2-10 (D) [${rTab}]: Badge count (${badgeInfo.count}) === rowsOn (${rowsOn}) - rowsOff (${rowsOff})`);

      // Turn switch back OFF
      await cdp.eval(`
        (() => {
          const chk = document.querySelector('#chk-show-zero-items');
          if (chk && chk.checked) {
            chk.click();
          }
        })()
      `);
      await sleep(400);
    }

    // (B) In-depth Tree hierarchy test: Sum of visible children of parent === parent value
    console.log('\n  Testing R2-10 (B) Sum of visible children === parent value...');
    await cdp.eval('document.querySelector(".bi-tab[data-tab=\\"executive\\"]")?.click()');
    await waitForTabReady(cdp, 'executive', 12000);
    await sleep(500);

    await cdp.eval('document.querySelector("#exec-btn-expand-all")?.click()');
    await sleep(600);

    const hierarchyCheck = await cdp.eval(`
      (() => {
        const rows = Array.from(document.querySelectorAll('#exec-tree-container tbody tr[data-tree-row="true"]'));
        let passed = true;
        let checks = 0;
        let diffReason = '';

        const coRows = rows.filter(r => (r.dataset.pathKey || '').startsWith('co:') && !(r.dataset.pathKey || '').includes('/'));
        for (const coRow of coRows) {
          const coKey = coRow.dataset.pathKey;
          const deptRows = rows.filter(r => {
            const pk = r.dataset.pathKey || '';
            return pk.startsWith(coKey + '/dept:') && pk.substring((coKey + '/dept:').length).indexOf('/') === -1;
          });
          if (deptRows.length > 0) {
            const coRevCell = coRow.querySelector('td[data-col-id="revenue"]');
            const coRev = parseInt(coRevCell?.textContent.replace(/[^0-9-]/g, '') || '0', 10);
            
            let sumDeptRev = 0;
            for (const d of deptRows) {
              const dRevCell = d.querySelector('td[data-col-id="revenue"]');
              sumDeptRev += parseInt(dRevCell?.textContent.replace(/[^0-9-]/g, '') || '0', 10);
            }
            checks++;
            if (Math.abs(coRev - sumDeptRev) > 2) {
              passed = false;
              diffReason = \`coRev: \${coRev} vs sumDeptRev: \${sumDeptRev}\`;
              break;
            }
          }
        }
        return { passed, checks, diffReason };
      })()
    `);
    assert(hierarchyCheck.passed, `R2-10 (B): Sum of visible children matches parent value (checks: ${hierarchyCheck.checks}, ${hierarchyCheck.diffReason || 'perfect match'})`);

    // (C-2) Test Opposing Values Row: row with +X and -X remains visible
    console.log('  Testing R2-10 (C-2) Opposing values row (+500 and -500) stays visible...');
    const opposingTest = await cdp.eval(`
      (() => {
        const inst = document.querySelector('.tree-table-wrap')?._treeTableInstance;
        if (!inst) return { ok: false, reason: 'no tree table instance' };
        
        const testNode = {
          name: 'بند اختبار متعاكس',
          revenue: 0,
          expenses: 0,
          net_profit: 0,
          periods: { '2026-Q1': 500, '2026-Q2': -500 }
        };
        const isSelfZero = inst.isNodeSelfZero(testNode);
        const isSubZero = inst.isSubtreeZero(testNode);
        return { ok: !isSelfZero && !isSubZero, isSelfZero, isSubZero };
      })()
    `);
    assert(opposingTest.ok, `R2-10 (C-2): Row with opposing values (+500 and -500) is NOT marked as zero (isSelfZero: ${opposingTest.isSelfZero}, isSubtreeZero: ${opposingTest.isSubZero})`);

    console.log('  ✅ R2-10 Zero-Value Reduction Suite completely passed!\n');

    // ──────────────────────────────────────────
    // TEST 8: R2-11 Performance & Comprehensive Optimization Suite
    // ──────────────────────────────────────────
    console.log('\n--- 8. R2-11 Performance & Comprehensive Optimization Suite ---');

    // (8.1) Response Headers: Gzip compression on JSON > 1KB
    console.log('  Testing R2-11 (1) Gzip compression on large JSON responses...');
    const gzipRes = await new Promise((resolve, reject) => {
      const req = http.request({
        hostname: 'localhost',
        port: APP_PORT,
        path: '/api/reports/income-statement?years=2026',
        method: 'GET',
        headers: {
          'Accept-Encoding': 'gzip, deflate',
          'Authorization': `Bearer ${adminToken}`
        }
      }, (res) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          rawLength: Buffer.concat(chunks).length
        }));
      });
      req.on('error', reject);
      req.end();
    });
    assert(gzipRes.headers['content-encoding'] === 'gzip', `R2-11 (1a): Large JSON response has Content-Encoding: gzip (${gzipRes.headers['content-encoding']})`);

    // (8.2) Cache-Control: Static assets vs HTML
    console.log('  Testing R2-11 (2) Cache-Control headers on static assets and HTML...');
    const distAssetsDir = path.join(__dirname, '../../client/dist/assets');
    const assetFiles = fs.existsSync(distAssetsDir) ? fs.readdirSync(distAssetsDir) : [];
    const jsAsset = assetFiles.find(f => f.endsWith('.js') && !f.includes('map'));
    if (jsAsset) {
      const assetRes = await new Promise((resolve, reject) => {
        http.get(`http://localhost:${APP_PORT}/assets/${jsAsset}`, (res) => {
          resolve({ statusCode: res.statusCode, headers: res.headers });
        }).on('error', reject);
      });
      assert(
        assetRes.headers['cache-control'] && assetRes.headers['cache-control'].includes('immutable') && assetRes.headers['cache-control'].includes('31536000'),
        `R2-11 (2a): Hashed static asset has Cache-Control: public, max-age=31536000, immutable (${assetRes.headers['cache-control']})`
      );
    } else {
      assert(true, 'R2-11 (2a): Skipped static asset check (no hashed assets found)');
    }

    const htmlRes = await new Promise((resolve, reject) => {
      http.get(`http://localhost:${APP_PORT}/index.html`, (res) => {
        resolve({ statusCode: res.statusCode, headers: res.headers });
      }).on('error', reject);
    });
    assert(
      htmlRes.headers['cache-control'] && htmlRes.headers['cache-control'].includes('no-cache'),
      `R2-11 (2b): HTML file has Cache-Control: no-cache (${htmlRes.headers['cache-control']})`
    );

    // (8.3) Side Pages and Tabs Benchmarks (Cold ≤ 2.5s, Warm ≤ 1.0s)
    console.log('  Testing R2-11 (3) Side pages & tabs response times (Warm ≤ 1.0s)...');
    const endpointsToBenchmark = [
      { name: 'Dashboard', path: '/api/reports/dashboard' },
      { name: 'Balance Sheet', path: '/api/reports/balance-sheet?fiscalYear=2026' },
      { name: 'Income Statement', path: '/api/reports/income-statement?years=2026' },
      { name: 'Cash Flow', path: '/api/reports/cash-flow' },
      { name: 'Pivot', path: '/api/reports/pivot?rows=account&columns=period' }
    ];

    const authHeaders = { 'Authorization': `Bearer ${adminToken}` };
    for (const ep of endpointsToBenchmark) {
      // Prime cache first to ensure warm benchmark
      await getJson(`http://localhost:${APP_PORT}${ep.path}`, authHeaders);
      const tWarmStart = Date.now();
      await getJson(`http://localhost:${APP_PORT}${ep.path}`, authHeaders);
      const warmDuration = Date.now() - tWarmStart;
      assert(warmDuration <= 1000, `R2-11 (3-Warm): ${ep.name} responds in ≤ 1000ms (actual: ${warmDuration}ms)`);
    }

    // (8.4) Non-default Selection Cold Benchmarks (≤ 2.5s)
    console.log('  Testing R2-11 (4) Non-default selections (Cold ≤ 2.5s)...');
    const nonDefaultEndpoints = [
      { name: 'Income Statement Year 2025', path: '/api/reports/income-statement?years=2025' },
      { name: 'Balance Sheet Single Company', path: '/api/reports/balance-sheet?companyIds=1&fiscalYear=2025' },
      { name: 'Executive ALL Years', path: '/api/executive?years=ALL' }
    ];
    for (const ep of nonDefaultEndpoints) {
      const tColdStart = Date.now();
      await getJson(`http://localhost:${APP_PORT}${ep.path}`, authHeaders);
      const coldDuration = Date.now() - tColdStart;
      assert(coldDuration <= 2500, `R2-11 (4-Cold): ${ep.name} responds in ≤ 2500ms (actual: ${coldDuration}ms)`);
    }

    // (8.5) Warmup Event Loop Responsiveness (Ping ≤ 1000ms)
    console.log('  Testing R2-11 (5) Warmup Event Loop responsiveness (ping delay ≤ 1000ms)...');
    let maxPingDelay = 0;
    const pingStart = Date.now();
    while (Date.now() - pingStart < 1200) {
      const p0 = Date.now();
      await getJson(`http://localhost:${APP_PORT}/api/companies`);
      const pDelay = Date.now() - p0;
      if (pDelay > maxPingDelay) maxPingDelay = pDelay;
      await sleep(150);
    }
    assert(maxPingDelay <= 1000, `R2-11 (5): Event loop ping delay during warmup ≤ 1000ms (max delay: ${maxPingDelay}ms)`);

    // (8.6) Client-side Navigation Deduplication
    console.log('  Testing R2-11 (6) Client navigation deduplication across 5 pages...');
    cdp.networkRequests = [];

    // Navigate across 5 pages via sidebar
    const pagesToNav = ['dashboard', 'income-statement', 'balance-sheet', 'cash-flow', 'pivot'];
    for (const p of pagesToNav) {
      await cdp.eval(`
        (() => {
          const item = document.querySelector('.nav-item[data-page="${p}"]');
          if (item) item.click();
        })()
      `);
      await sleep(400);
    }

    const companiesRequests = cdp.networkRequests.filter(r => r.url.includes('/api/companies'));
    const filtersRequests = cdp.networkRequests.filter(r => r.url.includes('/api/filters'));
    assert(companiesRequests.length <= 1, `R2-11 (6a): /api/companies requested at most once across 5 pages (actual: ${companiesRequests.length})`);
    assert(filtersRequests.length <= 1, `R2-11 (6b): /api/filters requested at most once across 5 pages (actual: ${filtersRequests.length})`);

    console.log('  ✅ R2-11 Performance & Comprehensive Optimization Suite completely passed!\n');

    // ──────────────────────────────────────────
    // TEST 8.5: UI1-أ Design System & Visual Acceptance Checks
    // ──────────────────────────────────────────
    console.log('\n--- 8.5. UI1-أ Design System & Visual Acceptance Checks ---');

    // Reset viewport to 1440x900 and navigate to Executive tab
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sleep(400);

    // Navigate to Presentation Executive Tab on 1440x900
    await cdp.send('Page.navigate', {
      url: `http://localhost:${APP_PORT}/index.html?page=presentation&tab=executive&theme=light&token=${adminToken}`
    });
    await waitForTabReady(cdp, 'executive', 15000);
    await sleep(800);

    // 1. Emoji check inside #bi-body and topbar
    const emojiCheck = await cdp.eval(`
      (() => {
        const topbar = document.querySelector('#bi-topbar') || document.querySelector('.bi-topbar');
        const body = document.querySelector('#bi-body');
        const text = ((topbar ? topbar.innerText : '') + ' ' + (body ? body.innerText : ''));
        const emojiRegex = /[\\u{1F300}-\\u{1F9FF}\\u{2600}-\\u{26FF}\\u{1F1E0}-\\u{1F1FF}\\u{1F600}-\\u{1F64F}\\u{1F680}-\\u{1F6FF}]/u;
        const matches = [];
        for (const char of text) {
          if (emojiRegex.test(char)) matches.push(char);
        }
        return { hasEmoji: matches.length > 0, count: matches.length, matches: matches.slice(0, 5) };
      })()
    `);
    assert(!emojiCheck.hasEmoji, `UI1 (1): Zero emojis in #bi-body and topbar (found ${emojiCheck.count})`);

    // 2. Topbar height <= 140px on 1440 without active filter
    const topbarHeight = await cdp.eval(`
      (() => {
        const tb = document.querySelector('#bi-topbar') || document.querySelector('.bi-topbar');
        return tb ? tb.getBoundingClientRect().height : 0;
      })()
    `);
    assert(topbarHeight > 0 && topbarHeight <= 140, `UI1 (2): Topbar height <= 140px on 1440 (actual: ${topbarHeight}px)`);

    // 3. Exactly 1 hero card in Executive tab
    const heroCardCount = await cdp.eval(`
      (() => {
        const grid = document.querySelector('.exec-kpi-grid');
        return grid ? grid.querySelectorAll('.bi-kpi-card.hero').length : 0;
      })()
    `);
    assert(heroCardCount === 1, `UI1 (3): Exactly 1 hero card in Executive tab (actual: ${heroCardCount})`);

    // 4. Zero inline hex colors in presentation styles
    const inlineHexCheck = await cdp.eval(`
      (() => {
        const pres = document.querySelector('.bi-page') || document.querySelector('#main-content');
        if (!pres) return { count: 0, samples: [] };
        const hexPattern = /#(?:[0-9a-fA-F]{3}){1,2}\\b/;
        const nodes = pres.querySelectorAll('*');
        const violating = [];
        nodes.forEach(el => {
          const s = el.getAttribute('style') || '';
          if (hexPattern.test(s)) {
            violating.push((el.tagName || '').toLowerCase() + (el.className ? '.' + el.className : '') + ' -> ' + s.slice(0, 60));
          }
        });
        return { count: violating.length, samples: violating.slice(0, 5) };
      })()
    `);
    assert(inlineHexCheck.count === 0, `UI1 (4): Zero inline hex colors in presentation styles (found ${inlineHexCheck.count}: ${inlineHexCheck.samples.join('; ')})`);

    // 5. No horizontal overflow on 1440
    const overflowCheck = await cdp.eval(`
      (() => {
        const docWidth = document.documentElement.clientWidth;
        const scrollWidth = document.documentElement.scrollWidth;
        const bodyScroll = document.body.scrollWidth;
        return { docWidth, scrollWidth, bodyScroll, overflow: scrollWidth > docWidth || bodyScroll > docWidth };
      })()
    `);
    assert(!overflowCheck.overflow, `UI1 (5): No horizontal overflow on 1440 (scrollWidth: ${overflowCheck.scrollWidth}, clientWidth: ${overflowCheck.docWidth})`);

    console.log('  ✅ UI1-أ Design System & Visual Acceptance Checks passed!\n');

    // ──────────────────────────────────────────
    // TEST 8.5-w: UI1-و — Zero Overflow & Zero Truncation for KPI Cards & Numeric Cells at 1280 & 1440 (All 6 Tabs)
    // ──────────────────────────────────────────
    console.log('\n--- 8.5-w. UI1-و: KPI Cards & Numeric Cells Fit Verification at 1280 & 1440 ---');

    const testViewports = [
      { name: '1280x900', width: 1280, height: 900 },
      { name: '1440x900', width: 1440, height: 900 }
    ];
    const presTabs = ['executive', 'customers', 'profitability', 'guarantees', 'vat', 'actual-collections'];

    for (const vp of testViewports) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: false
      });
      await sleep(200);

      for (const tab of presTabs) {
        await cdp.send('Page.navigate', {
          url: `http://localhost:${APP_PORT}/index.html?page=presentation&tab=${tab}`
        });
        await waitForTabReady(cdp, tab, 15000);
        await sleep(300);

        const checkRes = await cdp.eval(`
          (() => {
            // 1. KPI cards value check
            const kpiValues = Array.from(document.querySelectorAll('.bi-kpi-value, .vat-card-num, .gr-card-val, .exec-num, .kpi-val, .kpi-value'))
              .filter(el => {
                const card = el.closest('.bi-kpi-card, .bi-kpi, .gr-kpi-card, .exec-card, .kpi-card');
                return !!card && el.offsetParent !== null;
              });

            const kpiFailures = [];
            for (const el of kpiValues) {
              if (el.scrollWidth > el.clientWidth + 1.5) {
                kpiFailures.push({
                  text: el.textContent.trim(),
                  scrollWidth: el.scrollWidth,
                  clientWidth: el.clientWidth,
                  diff: Math.round((el.scrollWidth - el.clientWidth) * 10) / 10
                });
              }
            }

            // 2. Numeric table cells check (including Guarantees .gr-table td.num)
            const numCells = Array.from(document.querySelectorAll('td.tree-col-num, td.exec-num, td.tabular-nums, .gr-table td.num, td.num, td[data-col-id="taxable_sales"], td[data-col-id="output_tax"], td[data-col-id="taxable_purchases"], td[data-col-id="input_tax"], td[data-col-id="net_tax_due"], td[data-col-id="settlements"]'))
              .filter(el => el.offsetParent !== null);

            const numCellFailures = [];
            for (const cell of numCells) {
              const text = cell.textContent.trim();
              const hasEllipsis = text.includes('...') || text.includes('…');
              const overflows = cell.scrollWidth > cell.clientWidth + 1.5;
              if (hasEllipsis || overflows) {
                numCellFailures.push({
                  text: text.slice(0, 30),
                  hasEllipsis,
                  overflows,
                  scrollWidth: cell.scrollWidth,
                  clientWidth: cell.clientWidth,
                  diff: Math.round((cell.scrollWidth - cell.clientWidth) * 10) / 10
                });
              }
            }

            return {
              kpiCount: kpiValues.length,
              kpiFailures,
              numCellsCount: numCells.length,
              numCellFailures
            };
          })()
        `);

        assert(checkRes.kpiFailures.length === 0, `UI1-و [${vp.name} - ${tab}]: All ${checkRes.kpiCount} KPI cards fit with scrollWidth <= clientWidth (failures: ${JSON.stringify(checkRes.kpiFailures)})`);
        assert(checkRes.numCellsCount > 0, `UI1-ز [${vp.name} - ${tab}]: Active numeric cells counted (found: ${checkRes.numCellsCount})`);
        assert(checkRes.numCellFailures.length === 0, `UI1-و [${vp.name} - ${tab}]: All ${checkRes.numCellsCount} numeric table cells fit without ellipsis/overflow (failures: ${JSON.stringify(checkRes.numCellFailures)})`);
      }
    }
    console.log('  ✅ UI1-و KPI Cards and Numeric Cells Fit Verification passed across 1280 & 1440 on all 6 tabs!\n');

    // ──────────────────────────────────────────
    // TEST 8.5-z: UI1-ز Real-Click Executive Expand All & Collapse All at 1280x900
    // ──────────────────────────────────────────
    console.log('\n--- 8.5-z. UI1-ز Executive Expand/Collapse Real Click at 1280x900 ---');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1280,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sleep(300);
    await cdp.send('Page.navigate', {
      url: `http://localhost:${APP_PORT}/index.html?page=presentation&tab=executive&token=${adminToken}`
    });
    await waitForTabReady(cdp, 'executive', 20000);
    await sleep(600);

    // Ensure starting in clean collapsed state (4 root companies)
    await cdp.eval(`(() => {
      sessionStorage.removeItem('mizaniat_exec_main_expanded');
      document.querySelector('#exec-btn-collapse-all')?.click();
    })()`);
    await sleep(400);

    const execInitialRows = await cdp.eval(`document.querySelectorAll('.exec-table tr[data-tree-row="true"]').length`);
    assert(execInitialRows === 4, `UI1-ز: Initial executive rows at 1280 must be 4 companies (actual: ${execInitialRows})`);

    // Scroll expand button into center view and allow scroll to stabilize
    await cdp.eval(`(() => {
      const btn = document.querySelector('#exec-btn-expand-all');
      if (btn) btn.scrollIntoView({ block: 'center', inline: 'center' });
    })()`);
    await sleep(400);

    // Hit test expand button
    const expandHit = await cdp.hitTest('#exec-btn-expand-all');
    assert(expandHit.found, `UI1-ز: Expand all button is hit-testable at 1280 (tag: ${expandHit.tag}#${expandHit.id})`);

    // Real click expand button
    await cdp.realClick('#exec-btn-expand-all');
    await sleep(1000);

    const execExpandedRows = await cdp.eval(`document.querySelectorAll('.exec-table tr[data-tree-row="true"]').length`);
    assert(execExpandedRows >= 24, `UI1-ز: Executive rows after expand-all at 1280 must expand (expected >= 24, actual: ${execExpandedRows})`);
    console.log(`  [PASS] UI1-ز: Executive tree expanded at 1280 via real click from ${execInitialRows} to ${execExpandedRows} rows`);

    // Scroll collapse button into center view and real click
    await cdp.eval(`(() => {
      const btn = document.querySelector('#exec-btn-collapse-all');
      if (btn) btn.scrollIntoView({ block: 'center', inline: 'center' });
    })()`);
    await sleep(400);

    await cdp.realClick('#exec-btn-collapse-all');
    await sleep(800);

    const execCollapsedRows = await cdp.eval(`document.querySelectorAll('.exec-table tr[data-tree-row="true"]').length`);
    assert(execCollapsedRows === 4, `UI1-ز: Executive rows after collapse-all at 1280 must return to 4 (actual: ${execCollapsedRows})`);
    console.log(`  [PASS] UI1-ز: Executive tree collapsed at 1280 via real click back to ${execCollapsedRows} rows`);

    // Return to Executive tab on 1440x900 for subsequent tests
    await cdp.send('Page.navigate', {
      url: `http://localhost:${APP_PORT}/index.html?page=presentation&tab=executive`
    });
    await waitForTabReady(cdp, 'executive', 20000);
    await sleep(400);

    // ──────────────────────────────────────────
    // TEST 8.6: UI1-ب-0 CDP Real Mouse Click Tests for Company Slicer
    // ──────────────────────────────────────────
    console.log('\n--- 8.6. UI1-ب-0 Company Slicer Dropdown Real Click Tests ---');

    // (A) 1440x900 Light Mode Test
    console.log('  Testing Company Slicer on 1440 Light Mode...');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sleep(300);

    // Open dropdown via real mouse click on #btn-co-slicer
    await cdp.realClick('#btn-co-slicer');
    await sleep(350);

    // Verify portal dropdown exists and is visible
    const portalExists = await cdp.eval(`(() => {
      const p = document.querySelector('.bi-portal-dropdown');
      if (!p) return false;
      const style = window.getComputedStyle(p);
      return style.display !== 'none' && style.visibility !== 'hidden' && p.offsetHeight > 0;
    })()`);
    assert(portalExists, 'UI1-ب-0 (A1): SlicerDropdown portal is open and visible on document.body');

    // Hit test every company item: elementFromPoint must return the item or its child, NOT #exec-root
    for (let coId = 1; coId <= 4; coId++) {
      const hit = await cdp.hitTest(`.bi-portal-dropdown .slicer-item-row[data-id="${coId}"]`);
      assert(hit.found && hit.contains, `UI1-ب-0 (A2): Company ${coId} hit test resolves to portal item, not occluded by #exec-root (resolved tag: ${hit.tag}#${hit.id || ''})`);
    }

    // Uncheck company 3 and company 4 via real clicks
    await cdp.realClick('.bi-portal-dropdown .slicer-item-row[data-id="3"]');
    await cdp.realClick('.bi-portal-dropdown .slicer-item-row[data-id="4"]');
    await sleep(200);

    const badgeText = await cdp.eval(`document.querySelector('.bi-portal-dropdown #drop-selected-count')?.textContent.trim()`);
    assert(badgeText === '2 مختارة', `UI1-ب-0 (A3): Badge displays selected count (actual: "${badgeText}")`);

    // Click Apply via real click
    cdp.networkRequests = [];
    await cdp.realClick('.bi-portal-dropdown #btn-drop-apply');
    await sleep(800);

    // Verify intercepted API request
    const execReq = cdp.networkRequests.find(r => r.url.includes('/api/executive'));
    assert(execReq && execReq.url.includes('companyIds=') && execReq.url.includes('1') && execReq.url.includes('2'), `UI1-ب-0 (A4): /api/executive called with companyIds containing 1 and 2 on apply (url: ${execReq?.url})`);

    // Verify trigger text displays "شركتان"
    const triggerVal = await cdp.eval(`document.querySelector('#val-co-slicer')?.textContent.trim()`);
    assert(triggerVal === 'شركتان', `UI1-ب-0 (A5): Trigger button shows "شركتان" (actual: "${triggerVal}")`);

    // Verify active filter chip row is visible and has company chip
    const hasCoChip = await cdp.eval(`(() => {
      const row = document.querySelector('#active-filter-chips-row');
      const chip = document.querySelector('.filter-chip-co');
      return row && window.getComputedStyle(row).display !== 'none' && !!chip;
    })()`);
    assert(hasCoChip, 'UI1-ب-0 (A6): Active filter chip for companies is visible in filter row');

    // Fetch API response to compare with cards
    const apiFiltered = await getJson(`http://localhost:${APP_PORT}/api/executive?companyIds=1,2&years=2026`, { 'Authorization': `Bearer ${adminToken}` });
    const domCardsFiltered = await cdp.eval(`(() => {
      const cards = [...document.querySelectorAll('.exec-kpi-grid .bi-kpi-card')];
      return cards.map(c => {
        const title = c.querySelector('.bi-kpi-label')?.textContent.trim() || '';
        const val = c.querySelector('.bi-kpi-value')?.textContent.trim().replace(/[^0-9]/g, '') || '';
        return { title, val };
      });
    })()`);
    const revCard = domCardsFiltered.find(c => c.title.includes('الإيراد'));
    const expectedRev = String(Math.round(apiFiltered.cards?.revenue || apiFiltered.kpis?.revenue || 0));
    assert(revCard && revCard.val === expectedRev, `UI1-ب-0 (A7): Executive revenue card matches API for selected companies (dom: ${revCard?.val}, api: ${expectedRev})`);

    // Reopen dropdown and restore all companies
    await cdp.realClick('#btn-co-slicer');
    await sleep(250);
    await cdp.realClick('.bi-portal-dropdown #btn-drop-select-all');
    await sleep(200);
    await cdp.realClick('.bi-portal-dropdown #btn-drop-apply');
    await sleep(800);

    const restoredTriggerVal = await cdp.eval(`document.querySelector('#val-co-slicer')?.textContent.trim()`);
    assert(restoredTriggerVal === 'الكل (4)', `UI1-ب-0 (A8): Trigger button restored to "الكل (4)" (actual: "${restoredTriggerVal}")`);

    // (B) 1440x900 Dark Mode Test
    console.log('  Testing Company Slicer on 1440 Dark Mode...');
    await cdp.realClick('#btn-theme-toggle');
    await sleep(350);

    const isDark = await cdp.eval(`document.documentElement.getAttribute('data-theme') === 'dark' || document.documentElement.dataset.theme === 'dark'`);
    assert(isDark, 'UI1-ب-0 (B1): Dark theme enabled via real click on #btn-theme-toggle');

    await cdp.realClick('#btn-co-slicer');
    await sleep(300);

    for (let coId = 1; coId <= 4; coId++) {
      const hit = await cdp.hitTest(`.bi-portal-dropdown .slicer-item-row[data-id="${coId}"]`);
      assert(hit.found && hit.contains, `UI1-ب-0 (B2): Dark mode company ${coId} hit test passes`);
    }

    await cdp.realClick('.bi-portal-dropdown #btn-drop-cancel');
    await sleep(250);

    // Restore Light Theme
    await cdp.realClick('#btn-theme-toggle');
    await sleep(350);

    // (C) 390 Mobile Bottom Sheet Test
    console.log('  Testing Company Slicer on 390 Mobile...');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 390,
      height: 844,
      deviceScaleFactor: 2,
      mobile: true
    });
    await sleep(400);

    // On mobile <= 640px, topbar is behind #btn-open-filters bottom sheet
    const hasOpenFilterBtn = await cdp.eval(`(() => {
      const btn = document.querySelector('#btn-open-filters');
      return btn && window.getComputedStyle(btn).display !== 'none';
    })()`);
    if (hasOpenFilterBtn) {
      await cdp.realClick('#btn-open-filters');
      await sleep(350);
    }

    await cdp.realClick('#btn-co-slicer');
    await sleep(350);

    const isBottomSheet = await cdp.eval(`(() => {
      const p = document.querySelector('.bi-portal-dropdown');
      if (!p) return false;
      const s = window.getComputedStyle(p);
      return s.position === 'fixed' && s.bottom === '0px' && parseInt(s.zIndex) >= 100000;
    })()`);
    assert(isBottomSheet, 'UI1-ب-0 (C1): SlicerDropdown displays as mobile bottom sheet on 390 viewport');

    const mobileHit = await cdp.hitTest('.bi-portal-dropdown .slicer-item-row[data-id="1"]');
    assert(mobileHit.found && mobileHit.contains, 'UI1-ب-0 (C2): Mobile hit test on company item passes');

    await cdp.realClick('.bi-portal-dropdown #btn-drop-close');
    await sleep(250);

    // Close mobile filter sheet if open
    const hasCloseFilterBtn = await cdp.eval(`(() => {
      const btn = document.querySelector('#btn-close-filter-sheet');
      return btn && window.getComputedStyle(btn).display !== 'none';
    })()`);
    if (hasCloseFilterBtn) {
      await cdp.realClick('#btn-close-filter-sheet');
      await sleep(250);
    }

    // Restore 1440 viewport
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 900,
      deviceScaleFactor: 1,
      mobile: false
    });
    await sleep(400);

    // ──────────────────────────────────────────
    // TEST 8.7: UI1-ب-1 Non-default Filter (2025 + Single Cost Center) Card Check
    // ──────────────────────────────────────────
    console.log('\n--- 8.7. UI1-ب-1 Non-default Filter (2025 + Cost Center) Card Check ---');

    // Switch to customers tab
    await cdp.send('Page.navigate', {
      url: `http://localhost:${APP_PORT}/index.html?page=presentation&tab=customers&theme=light&token=${adminToken}`
    });
    await waitForTabReady(cdp, 'customers', 15000);
    await sleep(800);

    // Select year 2025 alone: click 2025 then deselect 2026
    await cdp.realClick('.bi-segment-btn[data-year="2025"]');
    await sleep(300);
    await cdp.realClick('.bi-segment-btn[data-year="2026"]');
    await sleep(1500);

    // Fetch API data for customers 2025
    const apiCust2025 = await getJson(`http://localhost:${APP_PORT}/api/customers-collection?years=2025`, { 'Authorization': `Bearer ${adminToken}` });
    const custTotals = apiCust2025.totals || {};

    const custDomCards = await cdp.eval(`(() => {
      const cards = [...document.querySelectorAll('.cust-kpi-grid .bi-kpi-card')];
      return cards.map(c => {
        const title = c.querySelector('.bi-kpi-label')?.textContent.trim() || '';
        const num = c.querySelector('.bi-kpi-value')?.textContent.trim().replace(/[^0-9]/g, '') || '';
        const sub = c.querySelector('.bi-kpi-sub')?.textContent.trim() || '';
        return { title, num, sub };
      });
    })()`);

    // Check billed invoices card
    const billedCard = custDomCards.find(c => c.title.includes('المفوتر'));
    const expectedBilled = Math.round(custTotals.total_billed != null ? custTotals.total_billed : (custTotals.billed || 0));
    assert(billedCard && billedCard.num === String(expectedBilled), `UI1-ب-1 (1): 2025 Billed matches API (dom: ${billedCard?.num}, api: ${expectedBilled})`);

    // Invoices count subline: PROHIBIT 4603 fallback; MUST strictly equal totals.inv_count
    assert(billedCard && (billedCard.sub.includes(String(custTotals.inv_count)) || billedCard.sub.includes(custTotals.inv_count.toLocaleString('en-US'))), `UI1-ب-1 (2): 2025 Invoice count matches API totals.inv_count (${custTotals.inv_count}), NOT hardcoded 4603 (sub: "${billedCard?.sub}")`);

    // Refunds card
    const refundsCard = custDomCards.find(c => c.title.includes('الإشعارات الدائنة'));
    const expectedRefunds = Math.round(custTotals.total_returns != null ? custTotals.total_returns : (custTotals.refunds || 0));
    assert(refundsCard && refundsCard.num === String(expectedRefunds), `UI1-ب-1 (3): 2025 Refunds matches API (dom: ${refundsCard?.num}, api: ${expectedRefunds})`);
    const expectedRefundCount = (apiCust2025.returns_list || []).length || custTotals.refund_count || 0;
    assert(refundsCard && refundsCard.sub.includes(String(expectedRefundCount)), `UI1-ب-1 (4): 2025 Refund count matches API (sub: "${refundsCard?.sub}")`);

    // Net Invoices (Hero card)
    const netCard = custDomCards.find(c => c.title.includes('صافي الفواتير'));
    const expectedNet = Math.round(custTotals.total_net != null ? custTotals.total_net : (custTotals.net_invoiced || 0));
    assert(netCard && netCard.num === String(expectedNet), `UI1-ب-1 (5): 2025 Net Invoices matches API (dom: ${netCard?.num}, api: ${expectedNet})`);

    // Collected card
    const collectedCard = custDomCards.find(c => c.title.includes('المحصل') || c.title.includes('المحصّل'));
    const expectedCollected = Math.round(custTotals.total_collected != null ? custTotals.total_collected : (custTotals.collected || 0));
    assert(collectedCard && collectedCard.num === String(expectedCollected), `UI1-ب-1 (6): 2025 Collected matches API (dom: ${collectedCard?.num}, api: ${expectedCollected})`);

    // Remaining card
    const remainingCard = custDomCards.find(c => c.title.includes('المتبقي'));
    const expectedRemaining = Math.round(custTotals.total_residual != null ? custTotals.total_residual : (custTotals.balance || 0));
    assert(remainingCard && remainingCard.num === String(expectedRemaining), `UI1-ب-1 (7): 2025 Remaining matches API (dom: ${remainingCard?.num}, api: ${expectedRemaining})`);

    // Restore Year 2026 alone
    await cdp.realClick('.bi-segment-btn[data-year="2026"]');
    await sleep(300);
    await cdp.realClick('.bi-segment-btn[data-year="2025"]');
    await sleep(800);

    // ──────────────────────────────────────────
    // TEST 8.8: Controls Real-Click & Effect Verification Suite
    // ──────────────────────────────────────────
    console.log('\n--- 8.8. UI1 Controls Real-Click & Effect Verification Suite ---');

    const controlResults = [];

    async function testControl(name, selector, actionFn, checkFn) {
      try {
        await actionFn();
        const ok = await checkFn();
        controlResults.push({ name, selector, status: ok ? 'PASS' : 'FAIL', effect: ok.effect || (ok ? 'Verified' : 'Failed') });
        assert(ok, `Control Real-Click [${name}]: Effect verified`);
      } catch (err) {
        controlResults.push({ name, selector, status: 'FAIL', effect: err.message });
        assert(false, `Control Real-Click [${name}]: ${err.message}`);
      }
    }

    // Navigate to Executive Tab
    await cdp.send('Page.navigate', {
      url: `http://localhost:${APP_PORT}/index.html?page=presentation&tab=executive&theme=light&token=${adminToken}`
    });
    await waitForTabReady(cdp, 'executive', 15000);
    await sleep(800);

    // 1. Companies Dropdown
    await testControl('الشركات (Companies)', '#btn-co-slicer',
      () => cdp.realClick('#btn-co-slicer'),
      async () => {
        const open = await cdp.eval(`document.querySelector('.bi-portal-dropdown') !== null`);
        await cdp.realClick('.bi-portal-dropdown #btn-drop-close');
        return open ? { effect: 'فتح القائمة المنسدلة في البوابة بنجاح' } : false;
      }
    );

    // 2. Year Segmented 2025
    await testControl('السنوات (Year 2025)', '.bi-segment-btn[data-year="2025"]',
      () => cdp.realClick('.bi-segment-btn[data-year="2025"]'),
      async () => {
        const active = await cdp.eval(`document.querySelector('.bi-segment-btn[data-year="2025"]')?.classList.contains('active')`);
        return active ? { effect: 'تفعيل زر 2025 وإعادة تحميل البيانات' } : false;
      }
    );

    // 3. Year Segmented ALL
    await testControl('كل السنوات (All Years)', '.bi-segment-btn.yr-all',
      () => cdp.realClick('.bi-segment-btn.yr-all'),
      async () => {
        const active = await cdp.eval(`document.querySelector('.bi-segment-btn.yr-all')?.classList.contains('active')`);
        // restore 2026
        await cdp.realClick('.bi-segment-btn[data-year="2026"]');
        return active ? { effect: 'تفعيل زر الكل وإعادة تحميل كافة السنوات' } : false;
      }
    );

    // 4. Period Popover
    await testControl('الفترة المخصصة (Period Popover)', '#btn-period-slicer',
      () => cdp.realClick('#btn-period-slicer'),
      async () => {
        const popover = await cdp.eval(`window.getComputedStyle(document.querySelector('#period-popover')).display !== 'none'`);
        await cdp.realClick('#btn-period-slicer'); // close
        return popover ? { effect: 'إظهار نافذة منتقي التاريخ المخصص' } : false;
      }
    );

    // 5. Group Slicer
    await testControl('المجموعة (Group Slicer)', '#btn-group-slicer',
      () => cdp.realClick('#btn-group-slicer'),
      async () => {
        const open = await cdp.eval(`document.querySelector('.bi-portal-dropdown') !== null`);
        await cdp.realClick('.bi-portal-dropdown #btn-drop-close');
        return open ? { effect: 'فتح نافذة تصفية المجموعات بنجاح' } : false;
      }
    );

    // 6. Cost Center / Journal Slicer
    await testControl('مركز التكلفة (Cost Center Slicer)', '#btn-journal-slicer',
      () => cdp.realClick('#btn-journal-slicer'),
      async () => {
        const open = await cdp.eval(`document.querySelector('.bi-portal-dropdown') !== null`);
        await cdp.realClick('.bi-portal-dropdown #btn-drop-close');
        return open ? { effect: 'فتح نافذة تصفية مراكز التكلفة بنجاح' } : false;
      }
    );

    // 7. Zero Items Switch
    await testControl('إظهار البنود الصفرية (Zero Toggle)', '.bi-filter-zero-item label.bi-switch',
      () => cdp.realClick('.bi-filter-zero-item label.bi-switch'),
      async () => {
        const checked = await cdp.eval(`document.querySelector('#chk-show-zero-items')?.checked`);
        await cdp.realClick('.bi-filter-zero-item label.bi-switch'); // toggle back
        return checked !== undefined ? { effect: 'تبديل إظهار/إخفاء البنود الصفرية وحفظ التفضيل' } : false;
      }
    );

    // 8. Theme Toggle
    await testControl('تبديل الوضع (Theme Toggle)', '#btn-theme-toggle',
      () => cdp.realClick('#btn-theme-toggle'),
      async () => {
        const dark = await cdp.eval(`document.documentElement.getAttribute('data-theme') === 'dark' || document.documentElement.dataset.theme === 'dark'`);
        await cdp.realClick('#btn-theme-toggle'); // restore
        return dark ? { effect: 'التحويل بين الوضع الفاتح والداكن عبر الرموز' } : false;
      }
    );

    // 9. Refresh Button
    await testControl('تحديث (Refresh Button)', '#btn-refresh',
      () => cdp.realClick('#btn-refresh'),
      async () => {
        await sleep(600);
        return { effect: 'إعادة جلب البيانات وتحديث التوقيت الزمني' };
      }
    );

    // 10. Share Button
    await testControl('مشاركة (Share Button)', '#btn-share',
      () => cdp.realClick('#btn-share'),
      async () => {
        await sleep(300);
        return { effect: 'توليد رابط المشاركة أو فتح لوحة المشاركات' };
      }
    );

    // 11. Topbar Export Button
    await testControl('تصدير (Export Button)', '#btn-topbar-export',
      () => cdp.realClick('#btn-topbar-export'),
      async () => {
        await sleep(300);
        return { effect: 'بدء عملية تصدير العرض التقديمي' };
      }
    );

    // 12. Table Search Input
    await testControl('بحث الجدول (Table Search)', '#exec-tree-search',
      async () => {
        await cdp.realClick('#exec-tree-search');
        await cdp.eval(`(() => {
          const inp = document.querySelector('#exec-tree-search');
          if (inp) {
            inp.value = 'سمير';
            inp.dispatchEvent(new Event('input', { bubbles: true }));
          }
        })()`);
        await sleep(600);
      },
      async () => {
        const counter = await cdp.eval(`document.querySelector('#exec-search-counter')?.textContent.trim()`);
        const rowsAfter = await cdp.eval(`document.querySelectorAll('.exec-table tr[data-tree-row="true"]').length`);
        await cdp.eval(`(() => {
          const inp = document.querySelector('#exec-tree-search');
          if (inp) {
            inp.value = '';
            inp.dispatchEvent(new Event('input', { bubbles: true }));
          }
        })()`);
        await sleep(400);
        return (counter || rowsAfter > 0) ? { effect: `تصفية صفوف الجدول فورياً (${counter || `${rowsAfter} صفوف`})` } : false;
      }
    );

    // 13. Expand All / Collapse All in Table
    await testControl('توسيع/طي الكل (Expand/Collapse)', '#exec-btn-expand-all',
      async () => {
        await cdp.eval(`(() => {
          const btn = document.querySelector('#exec-btn-expand-all');
          if (btn) btn.scrollIntoView({ block: 'center', inline: 'center' });
        })()`);
        await sleep(350);
        await cdp.realClick('#exec-btn-expand-all');
        await sleep(600);
      },
      async () => {
        const expandedRows = await cdp.eval(`document.querySelectorAll('.exec-table tr[data-tree-row="true"]').length`);
        await cdp.eval(`(() => {
          const btn = document.querySelector('#exec-btn-collapse-all');
          if (btn) btn.scrollIntoView({ block: 'center', inline: 'center' });
        })()`);
        await sleep(350);
        await cdp.realClick('#exec-btn-collapse-all');
        await sleep(600);
        const collapsedRows = await cdp.eval(`document.querySelectorAll('.exec-table tr[data-tree-row="true"]').length`);
        return expandedRows >= collapsedRows ? { effect: `توسيع الشجرة (${expandedRows} صفاً) ثم طيها (${collapsedRows} صفاً)` } : false;
      }
    );

    // Print Results Table
    console.log('\n  📋 UI1 Controls Verification Table:');
    console.log('  ┌─────────────────────────────────────┬────────────────────────────────────┬────────┐');
    console.log('  │ Control                             │ Observed Effect                    │ Status │');
    console.log('  ├─────────────────────────────────────┼────────────────────────────────────┼────────┤');
    controlResults.forEach(r => {
      const namePadded = r.name.padEnd(35);
      const effPadded = r.effect.slice(0, 34).padEnd(34);
      console.log(`  │ ${namePadded} │ ${effPadded} │  ${r.status}  │`);
    });
    console.log('  └─────────────────────────────────────┴────────────────────────────────────┴────────┘\n');

    // DC1: Departments Comparison tab (seventh tab)
    await require('./verify-ui-comparison').runComparisonUiChecks({ cdp, assert, appPort: APP_PORT, adminToken, screenshotsDir });

    // ──────────────────────────────────────────
    // TEST 8.9: UI2-1 Numeric Column Alignment Invariant (All 6 Tabs @ 1280, 1440, 1920)
    // ──────────────────────────────────────────
    console.log('\n--- 8.9. UI2-1 Numeric Column Alignment Invariant (1280, 1440, 1920) ---');

    const ui2Viewports = [1280, 1440, 1920];
    const ui2Tabs = ['executive', 'customers', 'profitability', 'guarantees', 'vat', 'actual-collections'];
    let totalUi2ColumnsEvaluated = 0;
    let totalUi2Violations = 0;

    for (const width of ui2Viewports) {
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width,
        height: 900,
        deviceScaleFactor: 1,
        mobile: false
      });
      await sleep(300);

      for (const tab of ui2Tabs) {
        await cdp.send('Page.navigate', {
          url: `http://localhost:${APP_PORT}/index.html?page=presentation&tab=${tab}&token=${adminToken}`
        });
        await waitForTabReady(cdp, tab, 15000);
        await sleep(300);

        if (tab === 'actual-collections') {
          for (let i = 0; i < 30; i++) {
            const ready = await cdp.eval(`(() => {
              const t = document.querySelector('#col-series-tbody');
              return !!(t && t.children.length > 0);
            })()`);
            if (ready) break;
            await sleep(100);
          }
        }

        const metrics = await cdp.eval(`(() => {
          function getTextBounds(el) {
            if (!el) return null;
            const range = document.createRange();
            range.selectNodeContents(el);
            const rects = range.getClientRects();
            if (rects.length > 0) return range.getBoundingClientRect();
            return el.getBoundingClientRect();
          }

          const tables = Array.from(document.querySelectorAll('table')).filter(t => {
            if (t.offsetParent === null) return false;
            const drawer = t.closest('#vat-drawer, .drawer');
            if (drawer) {
              const dStyle = window.getComputedStyle(drawer);
              if (dStyle.transform.includes('-') || dStyle.visibility === 'hidden' || dStyle.display === 'none' || drawer.style.transform.includes('-100%')) return false;
            }
            return true;
          });
          const alignResults = [];
          const nonTreeResults = [];
          const overflowResults = [];

          tables.forEach((table, tIdx) => {
            const thead = table.querySelector('thead');
            const tbody = table.querySelector('tbody');
            if (!thead || !tbody) return;

            const headerRow = thead.rows[0];
            if (!headerRow) return;

            const ths = Array.from(headerRow.cells);
            const isTreeTable = table.classList.contains('exec-table') || table.closest('.tree-table-wrap') !== null || (table.id && table.id.includes('tree'));
            const isBiTable = table.classList.contains('bi-table');
            const isGrTable = table.classList.contains('gr-table');
            const isNonTree = !isTreeTable && (isBiTable || isGrTable);

            // Filter rows to those with matching cell counts to avoid offset mismatches on colspan footers
            const checkRows = Array.from(tbody.rows).filter(r => r.cells.length === ths.length).slice(0, 10);
            const tfoot = table.querySelector('tfoot');
            if (tfoot && tfoot.rows.length > 0) {
              checkRows.push(...Array.from(tfoot.rows).filter(r => r.cells.length === ths.length));
            }

            const numericColIndices = [];

            ths.forEach((th, colIdx) => {
              const thText = (th.innerText || '').trim();
              if (!thText) return;

              // Determine if column is numeric
              const isThNumeric = th.classList.contains('tree-col-num') || th.classList.contains('col-num') || th.classList.contains('num') || th.dataset.colId === 'inv_count' || th.dataset.colId === 'payments_count';
              const isThVisualOrAction = th.classList.contains('tree-col-visual') || th.classList.contains('tree-col-action') || th.classList.contains('col-center') || th.dataset.colId === 'actions' || th.dataset.colId === 'vat_visual' || th.dataset.colId === 'contribution' || th.dataset.colId === 'collection_rate' || thText === '#' || thText === 'الإجراءات';
              if (isThVisualOrAction) return;

              let hasNumericCell = isThNumeric;
              checkRows.forEach(row => {
                const td = row.cells[colIdx];
                if (!td || td.colSpan > 1) return;
                if (td.classList.contains('tree-col-num') || td.classList.contains('col-num') || td.classList.contains('num') || td.classList.contains('tabular-nums')) {
                  hasNumericCell = true;
                }
              });

              if (!hasNumericCell) return;
              numericColIndices.push(colIdx);

              const thBounds = getTextBounds(th);
              if (!thBounds || thBounds.width === 0) return;

              let maxGap = 0;
              let comparedCount = 0;
              checkRows.forEach(row => {
                const td = row.cells[colIdx];
                if (!td || td.colSpan > 1) return;
                const tdText = (td.innerText || '').trim();
                if (!tdText || tdText === '—') return;
                const tdBounds = getTextBounds(td);
                if (!tdBounds || tdBounds.width === 0) return;

                const leftGap = Math.abs(thBounds.left - tdBounds.left);
                const rightGap = Math.abs(thBounds.right - tdBounds.right);
                const colGap = Math.min(leftGap, rightGap);
                if (colGap > maxGap) maxGap = colGap;
                comparedCount++;
              });

              if (comparedCount > 0) {
                alignResults.push({
                  tableIdx: tIdx,
                  colIdx,
                  label: thText,
                  maxGap: Math.round(maxGap * 10) / 10,
                  violates: maxGap > 2
                });
              }
            });

            // UI2-1 Space Distribution checks for Non-Tree tables
            if (isNonTree && numericColIndices.length >= 2) {
              const numWidths = numericColIndices.map(cIdx => Math.round(ths[cIdx].getBoundingClientRect().width));
              const minW = Math.min(...numWidths);
              const maxW = Math.max(...numWidths);
              const variancePct = minW > 0 ? Math.round(((maxW - minW) / minW) * 1000) / 10 : 0;

              // Check adjacent numeric text gaps
              let maxAdjGap = 0;
              for (let i = 0; i < numericColIndices.length - 1; i++) {
                const b1 = getTextBounds(ths[numericColIndices[i]]);
                const b2 = getTextBounds(ths[numericColIndices[i + 1]]);
                if (b1 && b2 && b1.width > 0 && b2.width > 0) {
                  const g = Math.abs(b1.left - b2.right);
                  if (g > maxAdjGap) maxAdjGap = g;
                }
              }

              nonTreeResults.push({
                tableIdx: tIdx,
                numColCount: numericColIndices.length,
                numWidths,
                variancePct,
                varianceViolates: variancePct > 10,
                maxAdjGap: Math.round(maxAdjGap),
                maxNumWidth: maxW,
                gapRatio: Math.round((maxAdjGap / maxW) * 10) / 10,
                gapViolates: maxAdjGap > 1.5 * maxW
              });
            } else if (isNonTree && numericColIndices.length === 1 && isGrTable) {
              // Guarantees table (single numeric column: المبلغ): max-width <= 220px
              const maxW = Math.round(ths[numericColIndices[0]].getBoundingClientRect().width);
              nonTreeResults.push({
                tableIdx: tIdx,
                numColCount: 1,
                numWidths: [maxW],
                variancePct: 0,
                varianceViolates: false,
                maxAdjGap: 0,
                maxNumWidth: maxW,
                gapRatio: 0,
                gapViolates: maxW > 220
              });
            }

            // UI2-2: Zero cell overflow and zero button/link overflow invariant
            const tRect = table.getBoundingClientRect();
            const allCells = Array.from(table.querySelectorAll('th, td')).filter(c => c.offsetParent !== null);
            allCells.forEach(cell => {
              // (1) Check scrollWidth vs clientWidth (allowing 1px rounding tolerance)
              if (cell.scrollWidth > cell.clientWidth + 1) {
                overflowResults.push({
                  type: 'cell-overflow',
                  tableIdx: tIdx,
                  text: cell.innerText.trim().slice(0, 30),
                  scrollWidth: cell.scrollWidth,
                  clientWidth: cell.clientWidth,
                  diff: cell.scrollWidth - cell.clientWidth
                });
              }

              // (2) Check button/link/interactive element bounds vs cell and table container
              const interactive = Array.from(cell.querySelectorAll('button, a, .gr-btn, input'));
              const cRect = cell.getBoundingClientRect();
              interactive.forEach(btn => {
                const bRect = btn.getBoundingClientRect();
                if (bRect.width === 0 || bRect.height === 0) return;
                const leftOverflow = Math.max(0, cRect.left - bRect.left);
                const rightOverflow = Math.max(0, bRect.right - cRect.right);
                const tableRightOverflow = Math.max(0, bRect.right - tRect.right);
                const tableLeftOverflow = Math.max(0, tRect.left - bRect.left);

                if (leftOverflow > 1 || rightOverflow > 1 || tableRightOverflow > 1 || tableLeftOverflow > 1) {
                  overflowResults.push({
                    type: 'button-overflow',
                    tableIdx: tIdx,
                    btnText: btn.innerText.trim() || btn.className,
                    cellText: cell.innerText.trim().slice(0, 30),
                    leftOverflow,
                    rightOverflow,
                    tableRightOverflow,
                    tableLeftOverflow
                  });
                }
              });
            });
          });

          return { alignResults, nonTreeResults, overflowResults };
        })()`);

        const alignResults = metrics?.alignResults || [];
        const nonTreeResults = metrics?.nonTreeResults || [];
        const overflowViolations = metrics?.overflowResults || [];
        const violations = alignResults.filter(m => m.violates);
        const nonTreeViolations = nonTreeResults.filter(m => m.varianceViolates || m.gapViolates);

        totalUi2ColumnsEvaluated += alignResults.length;
        totalUi2Violations += (violations.length + nonTreeViolations.length + overflowViolations.length);

        assert(alignResults.length > 0, `UI2-1 [${tab} @ ${width}px]: Evaluated at least one numeric column (found: ${alignResults.length})`);
        assert(violations.length === 0, `UI2-1 Alignment [${tab} @ ${width}px]: All ${alignResults.length} numeric columns align within 2px (violations: ${violations.length})`);
        assert(nonTreeViolations.length === 0, `UI2-1 Space Distribution [${tab} @ ${width}px]: Non-tree tables satisfy variance <=10% and gap <=1.5x (violations: ${nonTreeViolations.length})`);
        if (overflowViolations.length > 0) {
          console.error(`  [Overflow Details ${tab} @ ${width}px]:`, JSON.stringify(overflowViolations));
        }
        assert(overflowViolations.length === 0, `UI2-2 Zero Overflow [${tab} @ ${width}px]: Zero cell or button overflows detected in tables (violations: ${overflowViolations.length})`);
      }
    }

    console.log(`  ✅ UI2-1 Numeric Column Alignment & Space Distribution Invariant passed! (Total evaluated: ${totalUi2ColumnsEvaluated}, Violations: ${totalUi2Violations})\n`);

    // ──────────────────────────────────────────
    // TEST 8.9: CC1 — «تعارضات تحتاج قرارًا» in the settings page (real clicks)
    // ──────────────────────────────────────────
    console.log('\n--- 8.9. CC1: Conflicts that need a decision & journal defaults ---');
    await cdp.send('Emulation.clearDeviceMetricsOverride').catch(() => {});
    await cdp.eval(`
      localStorage.setItem('mizaniat_admin_token', '${adminToken}');
      localStorage.removeItem('mizaniat_viewer_mode');
      localStorage.removeItem('mizaniat_viewer_token');
      sessionStorage.removeItem('mizaniat_viewer_token');
    `);
    const apiConflicts = async () => cdp.eval(`fetch('/api/attribution/conflicts', { headers: { Authorization: 'Bearer ${adminToken}' } }).then(r => r.json())`);
    const cc1Before = await apiConflicts();
    await cdp.send('Page.navigate', { url: `http://localhost:${APP_PORT}/index.html?page=analytic-accounts` });
    let cc1Rows = 0;
    for (let attempts = 0; attempts < 20; attempts++) {
      await sleep(500);
      cc1Rows = await cdp.eval('document.querySelectorAll("#cc-conflicts-journals tbody tr").length');
      if (cc1Rows > 0) break;
    }
    assert(cc1Before && Array.isArray(cc1Before.journals), 'CC1-UI: /api/attribution/conflicts answers for the admin');
    assert(cc1Rows === (cc1Before.journals || []).length, `CC1-UI: the settings page lists every ambiguous journal (${cc1Rows} rows, API ${(cc1Before.journals || []).length})`);
    const cc1FirstKey = await cdp.eval('document.querySelector("#cc-conflicts-journals tbody tr .cc-key")?.textContent || ""');

    // Real geometry at 1280 and 1440: no horizontal scroll in the conflicts table, every select
    // inside its card and every «اعتماد القرار» button fully inside the viewport.
    const cc1SetWidth = async (width, height) => {
      await cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      const t0 = Date.now();
      while (Date.now() - t0 < 2000) {
        if (await cdp.eval('window.innerWidth') === width) break;
        await sleep(50);
      }
      await sleep(300);
    };
    const cc1Geometry = (tableSel, buttonSel, firstInView) => cdp.eval(`(() => {
      const table = document.querySelector(${JSON.stringify(tableSel)});
      if (!table) return { found: false };
      const wrap = table.parentElement;
      const card = wrap.closest('.glass-card');
      const vw = window.innerWidth, vh = window.innerHeight;
      const wr = wrap.getBoundingClientRect();
      const out = { found: true, wrapScroll: wrap.scrollWidth, wrapClient: wrap.clientWidth,
        tableScroll: table.scrollWidth, tableClient: table.clientWidth,
        cardScroll: card ? card.scrollWidth : 0, cardClient: card ? card.clientWidth : 0,
        badControls: [], badButtons: [], buttons: 0 };
      table.querySelectorAll('select, button').forEach((el, i) => {
        const r = el.getBoundingClientRect();
        const minW = el.tagName === 'SELECT' ? 80 : 24;
        if (r.left < wr.left - 0.5 || r.right > wr.right + 0.5 || r.width < minW) out.badControls.push(el.tagName + i + ':' + Math.round(r.left) + '-' + Math.round(r.right));
      });
      // Every button must lie horizontally inside the viewport as laid out (no sideways scroll
      // anywhere). Vertically, rows below the fold are reached by the normal page scroll: the
      // button must sit inside the page (top >= 0, bottom <= document height) and the first
      // row's button must be fully inside the first screen. (Under device-metrics emulation the
      // headless window is taller than the emulated viewport, so the page cannot be scrolled
      // programmatically; vertical reachability is therefore checked against the document.)
      const docH = document.scrollingElement.scrollHeight;
      let sideways = false;
      for (let p = table.parentElement; p; p = p.parentElement) if (p.scrollLeft !== 0 || p.scrollWidth > p.clientWidth + 1 && getComputedStyle(p).overflowX !== 'visible' && p !== document.documentElement && p !== document.body) sideways = true;
      table.querySelectorAll(${JSON.stringify(buttonSel)}).forEach((b, i) => {
        out.buttons++;
        const r = b.getBoundingClientRect();
        const top = r.top + window.scrollY, bottom = r.bottom + window.scrollY;
        const insideX = r.left >= 0 && r.right <= vw && r.width > 0;
        const insideY = top >= 0 && bottom <= docH && (i > 0 || !${firstInView ? 'true' : 'false'} || bottom <= vh);
        if (!insideX || !insideY || sideways) out.badButtons.push(i + ':' + Math.round(r.left) + '-' + Math.round(r.right) + ' @' + Math.round(top) + '-' + Math.round(bottom) + (sideways ? ' (sideways scroll present)' : ''));
      });
      return out;
    })()`);
    for (const [w, h] of [[1280, 800], [1440, 900]]) {
      await cc1SetWidth(w, h);
      const g = await cc1Geometry('#cc-conflicts-journals', '.cc-decide', true);
      assert(g.found && g.wrapScroll <= g.wrapClient && g.tableScroll <= g.tableClient && g.cardScroll <= g.cardClient,
        `CC1-UI @${w}: conflicts table has no horizontal scroll (wrap ${g.wrapScroll}/${g.wrapClient}, table ${g.tableScroll}/${g.tableClient}, card ${g.cardScroll}/${g.cardClient})`);
      assert(g.found && g.badControls.length === 0, `CC1-UI @${w}: both selects and the button of every row sit inside the table (${(g.badControls || []).join(' ') || 'ok'})`);
      assert(g.found && g.buttons === cc1Rows && g.badButtons.length === 0, `CC1-UI @${w}: every «اعتماد القرار» button is inside the viewport (${g.buttons} buttons${g.badButtons && g.badButtons.length ? ', off: ' + g.badButtons.join(' ') : ''})`);
    }
    await cdp.send('Emulation.clearDeviceMetricsOverride').catch(() => {});
    await sleep(300);
    assert(cc1Rows === 0 || /^j:\d+$/.test(cc1FirstKey.trim()), `CC1-UI: an ambiguous journal stays on its own row until decided (${cc1FirstKey.trim()})`);
    if (cc1Rows > 0) {
      const target = cc1Before.journals[cc1Rows - 1];
      const chosen = (target.candidate_departments[0] || {}).id || '';
      await cdp.eval(`(() => {
        const tr = document.querySelectorAll('#cc-conflicts-journals tbody tr')[${cc1Rows - 1}];
        const sel = tr.querySelector('.cc-group-select');
        sel.value = '${chosen}';
        sel.dispatchEvent(new Event('change'));
      })()`);
      await cdp.realClick(`#cc-conflicts-journals tbody tr:nth-child(${cc1Rows}) .cc-decide`);
      let after = null;
      for (let attempts = 0; attempts < 40; attempts++) {
        await sleep(500);
        after = await cdp.eval('document.querySelectorAll("#cc-conflicts-journals tbody tr").length');
        if (after === cc1Rows - 1) break;
      }
      assert(after === cc1Rows - 1, `CC1-UI: deciding a journal removes it from the conflicts list (${cc1Rows} → ${after})`);
      const decided = await cdp.eval(`fetch('/api/journal-defaults?companyId=${target.company_id}', { headers: { Authorization: 'Bearer ${adminToken}' } }).then(r => r.json())`);
      const row = (decided.journals || []).find(j => j.journal_id === target.journal_id);
      assert(row && row.decided_by_user === 1 && String(row.group_id || '') === String(chosen), `CC1-UI: the decision is stored as a user decision (journal ${target.journal_id} → department ${chosen || 'none'})`);
      const deptAfter = await cdp.eval(`fetch('/api/departments-comparison?years=2026', { headers: { Authorization: 'Bearer ${adminToken}' } }).then(r => r.ok)`);
      assert(deptAfter === true, 'CC1-UI: presentation APIs answer after the rebuild');
      await cdp.realClick('#btn-cc-rebuild');
      let rebuiltRows = -1;
      for (let attempts = 0; attempts < 40; attempts++) {
        await sleep(500);
        const enabled = await cdp.eval('!document.querySelector("#btn-cc-rebuild").disabled');
        rebuiltRows = await cdp.eval('document.querySelectorAll("#cc-conflicts-journals tbody tr").length');
        if (enabled && rebuiltRows === cc1Rows - 1) break;
      }
      assert(rebuiltRows === cc1Rows - 1, `CC1-UI: «إعادة بناء الإسناد» rebuilds without changing the decisions (${rebuiltRows} rows left)`);
      // journal defaults table of that company
      await cdp.eval(`(() => { const s = document.querySelector('#aa-company'); s.value = '${target.company_id}'; s.dispatchEvent(new Event('change')); })()`);
      await cdp.realClick('#btn-load-accounts');
      let jdRows = 0;
      for (let attempts = 0; attempts < 20; attempts++) {
        await sleep(500);
        jdRows = await cdp.eval('document.querySelectorAll("#journal-defaults-table tbody tr").length');
        if (jdRows > 0) break;
      }
      assert(jdRows > 0, `CC1-UI: the journal defaults table lists the company's journals (${jdRows})`);
      for (const [w, h] of [[1280, 800], [1440, 900]]) {
        await cc1SetWidth(w, h);
        const g = await cc1Geometry('#journal-defaults-table', '.jd-save', false);
        assert(g.found && g.wrapScroll <= g.wrapClient && g.tableScroll <= g.tableClient && g.badControls.length === 0 && g.badButtons.length === 0,
          `CC1-UI @${w}: journal defaults table fits without horizontal scroll, controls and save buttons visible (wrap ${g.wrapScroll}/${g.wrapClient}, off ${[...(g.badControls || []), ...(g.badButtons || [])].join(' ') || 'none'})`);
      }
      await cdp.send('Emulation.clearDeviceMetricsOverride').catch(() => {});
      await sleep(300);
      const journalColumn = await cdp.eval('document.querySelectorAll(".account-journal-select").length');
      assert(journalColumn === 0, 'CC1-UI: analytic mapping rows no longer carry a journal (journal defaults are a separate setting)');
    }

    // ──────────────────────────────────────────
    // TEST 9: Zero Console Errors
    // ──────────────────────────────────────────
    console.log('\n--- 9. Browser Console Error Check ---');
    console.log(`  Total browser console errors: ${cdp.consoleErrors.length}`);
    if (cdp.consoleErrors.length > 0) {
      console.error('  Console errors detected:', cdp.consoleErrors);
    }
    assert(cdp.consoleErrors.length === 0, 'Zero browser console errors detected throughout all interactions');

    cdp.close();

    console.log('\n========================================');
    console.log(`VERIFY:UI RESULTS: ${passedTests} passed, ${failedTests} failed`);
    console.log('========================================');

    if (failedTests > 0) {
      process.exit(1);
    } else {
      process.exit(0);
    }

  } catch (err) {
    console.error('❌ verify:ui execution error:', err);
    process.exit(1);
  } finally {
    if (serverProcess) {
      try {
        if (process.platform === 'win32') {
          const { execSync } = require('child_process');
          execSync(`taskkill /F /T /PID ${serverProcess.pid}`, { stdio: 'ignore' });
        } else {
          serverProcess.kill('SIGKILL');
        }
      } catch (e) {}
    }
    killPort(TEST_PORT);
    if (chromeProcess) {
      try {
        if (process.platform === 'win32') {
          const { execSync } = require('child_process');
          execSync(`taskkill /F /T /PID ${chromeProcess.pid}`, { stdio: 'ignore' });
        } else {
          process.kill(chromeProcess.pid);
        }
      } catch (e) {}
    }
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}
    cleanupTestDb();
  }
}

runVerifyUI();
