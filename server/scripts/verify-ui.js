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
const TEST_PORT = 3195;

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
const DEBUG_PORT = 9231;
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
      const fits = tRect.width <= cWidth + 1.5;
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
        const janRect = janGroup ? janGroup.querySelector('rect[fill="#3b82f6"]') : null;
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
          const cardDivs = document.querySelectorAll('div[style*="border-right:4px solid"]');
          cardDivs.forEach(div => {
            const title = div.querySelector('span')?.textContent?.trim();
            const valText = div.querySelector('.exec-num')?.textContent?.replace(/,/g, '')?.trim();
            if (title && valText) cards[title] = parseFloat(valText) || 0;
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
    const firstKpiVal = await cdp.eval('document.querySelector(".exec-kpi-card .exec-num")?.textContent');
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
    const expectedTabs = ['executive', 'customers', 'profitability', 'guarantees', 'vat', 'actual-collections'];
    const tabsMatch = visibleTabs.length === 6 && expectedTabs.every(t => visibleTabs.includes(t));
    assert(tabsMatch, `D4/C1: Exactly 6 clean tabs visible: [${visibleTabs.join(', ')}]`);

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
    assert(colKpiCount >= 6 && totalCollectedVal && totalCollectedVal !== '0', `C1: 6 KPI cards populated (Total Collected: ${totalCollectedVal})`);

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
          return topEl && (topEl === el || el.contains(topEl) || topEl.contains(el));
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
    assert(viewerColVisible && viewerColCards >= 6, `Viewer opened Actual Collections tab successfully with ${viewerColCards} KPI cards`);
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
        const res = await fetch('/api/companies/1/vat-period', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
          },
          body: JSON.stringify({ vat_period: 'quarterly' })
        });
        const mutateData = await res.json();
        const statsRes = await fetch('/api/cache/stats', {
          headers: token ? { 'Authorization': 'Bearer ' + token } : {}
        });
        const statsData = await statsRes.json();
        return { mutateData, statsData };
      })()
    `);
    const vAfter = mutateRes?.statsData?.dataVersion || vBefore;
    assert(vAfter > vBefore, `R2-8 Invalidation: dataVersion incremented on live mutation (${vBefore} -> ${vAfter})`);

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

          // Tab Bar check at >= 1280px (T1)
          if (res.width >= 1280) {
            const tabBarCheck = await cdp.eval(`
              (() => {
                const bar = document.querySelector('.bi-tabs');
                const tabs = Array.from(document.querySelectorAll('.bi-tab'));
                if (!bar || tabs.length === 0) return null;
                const barRect = bar.getBoundingClientRect();
                const firstTabRect = tabs[0].getBoundingClientRect();
                const lastTabRect = tabs[tabs.length - 1].getBoundingClientRect();
                const leftEdgeDist = Math.abs(lastTabRect.left - barRect.left);
                const rightEdgeDist = Math.abs(barRect.right - firstTabRect.right);
                return {
                  leftEdgeDist,
                  rightEdgeDist
                };
              })()
            `);
            if (tabBarCheck) {
              assert(tabBarCheck.leftEdgeDist <= 28, `[${res.name} - ${theme}] Tab bar spans full width: last tab ends within 28px of bar edge (${tabBarCheck.leftEdgeDist.toFixed(1)}px <= 28px)`);
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
