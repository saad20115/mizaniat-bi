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
const { getDb } = require('../db/connection');

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
const APP_PORT = process.env.PORT || 3090;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.callbacks = new Map();
    this.consoleErrors = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(err);
      this.ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
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

  if (process.platform === 'win32') {
    try {
      const { execSync } = require('child_process');
      execSync('powershell -NoProfile -Command "$p = (Get-NetTCPConnection -LocalPort 9231 -ErrorAction SilentlyContinue).OwningProcess; if ($p) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }"', { stdio: 'ignore' });
    } catch (e) {}
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

  await sleep(2500);

  try {
    const targets = await getJson(`http://localhost:${DEBUG_PORT}/json`);
    const pageTarget = targets.find(t => t.type === 'page') || targets[0];
    if (!pageTarget) throw new Error('No page target found on Chrome CDP');

    const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

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
    for (let attempts = 0; attempts < 20; attempts++) {
      await sleep(500);
      const ready = await cdp.eval('!!document.querySelector("#exec-chart-container svg")');
      if (ready) {
        chartRendered = true;
        break;
      }
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

    // Click clients group to reveal clients
    const clientsGrpKey = await cdp.eval(`
      (() => {
        const grpRow = document.querySelector('#exec-tree-table-container [data-path-key*="/grp:clients"]');
        if (grpRow) { grpRow.click(); return grpRow.dataset.pathKey; }
        return null;
      })()
    `);
    assert(!!clientsGrpKey, 'Clients group clicked');
    await sleep(1500);

    const clientRowsCount = await cdp.eval('document.querySelectorAll("#exec-tree-table-container [data-path-key*=\\"/grp:clients/p:\\"]").length');
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
    await sleep(5000);

    const ag2_all = await cdp.eval(`
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
    assert(ag2_all.rows > 0 && !ag2_all.emptyMsg, 'AG2 ALL: Aging table populated and no empty message');
    assert(ag2_all.headerVal != null && ag2_all.headerVal === ag2_all.footerVal, `AG2 ALL: Header total matches table footer (${ag2_all.headerVal})`);

    // Switch to 2025
    console.log('  Switching period to 2025...');
    await cdp.eval('document.querySelector("#yr-slicer .yr-chip[data-year=\\"2025\\"]")?.click()');
    await sleep(4000);

    const ag2_2025 = await cdp.eval(`
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
    assert(ag2_2025.rows > 0 && !ag2_2025.emptyMsg, 'AG2 2025: Aging table populated and no empty message');
    assert(ag2_2025.headerVal != null && ag2_2025.headerVal === ag2_2025.footerVal, `AG2 2025: Header total matches table footer (${ag2_2025.headerVal})`);

    // (B) Main Table client rows preserved & mathematical sum == department
    console.log('  Checking Main TreeTable department client rows under 2025...');
    const clientRows2025 = await cdp.eval('document.querySelectorAll("#exec-tree-table-container [data-path-key*=\\"/grp:clients/p:\\"]").length');
    assert(clientRows2025 > 0, `Main TreeTable client rows automatically re-fetched and preserved for 2025: ${clientRows2025} clients`);

    // Verify client sum matches department row in 2025
    const deptMatch2025 = await cdp.eval(`
      (() => {
        const clientRows = Array.from(document.querySelectorAll('#exec-tree-table-container [data-path-key*="/grp:clients/p:"]'));
        let clientResidualSum = 0;
        clientRows.forEach(r => {
          const cells = r.querySelectorAll('td');
          const lastCell = cells[cells.length - 1]; // residual column is last
          const num = lastCell ? parseInt(lastCell.textContent.replace(/[^\\d]/g, '') || '0', 10) : 0;
          clientResidualSum += num;
        });

        const firstClient = clientRows[0];
        const deptKey = firstClient ? firstClient.dataset.pathKey.split('/grp:')[0] : null;
        const deptRow = deptKey ? document.querySelector('#exec-tree-table-container [data-path-key=\"' + deptKey + '\"]') : document.querySelector('#exec-tree-table-container [data-path-key*=\"/dept:\"]');
        const deptCells = deptRow ? deptRow.querySelectorAll('td') : [];
        const deptResidual = deptCells.length ? parseInt(deptCells[deptCells.length - 1].textContent.replace(/[^\\d]/g, '') || '0', 10) : 0;

        return {
          clientResidualSum,
          deptResidual,
          clientCount: clientRows.length,
          diff: Math.abs(clientResidualSum - deptResidual)
        };
      })()
    `);
    assert(deptMatch2025 && deptMatch2025.diff <= deptMatch2025.clientCount, `Main TreeTable client sum matches department row within rounding tolerance (diff: ${deptMatch2025.diff} SAR, clients: ${deptMatch2025.clientCount})`);

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
    await sleep(500);
    const still2026 = await cdp.eval('document.querySelector("#yr-slicer .yr-chip[data-year=\\"2026\\"]")?.classList.contains("active")');
    // ──────────────────────────────────────────
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

    const partnerRowsCount = await cdp.eval(`document.querySelectorAll('#cust-tree-container tr[data-path-key^="${firstDeptRow}/partner:"]').length`);
    assert(partnerRowsCount > 0, `D1: Expanded department revealed ${partnerRowsCount} partners`);

    const firstPartnerRow = await cdp.eval(`document.querySelector('#cust-tree-container tr[data-path-key^="${firstDeptRow}/partner:"]')?.getAttribute('data-path-key')`);
    
    // Lazy load invoices
    console.log('  Testing D1 lazy loading of invoices...');
    await cdp.eval(`document.querySelector('#cust-tree-container tr[data-path-key="${firstPartnerRow}"]')?.click()`);
    let invoiceRowsCount = 0;
    for (let attempts = 0; attempts < 10; attempts++) {
      await sleep(500);
      invoiceRowsCount = await cdp.eval(`document.querySelectorAll('#cust-tree-container tr[data-path-key^="${firstPartnerRow}/invoice:"]').length`);
      if (invoiceRowsCount > 0) break;
    }
    assert(invoiceRowsCount > 0, `D1: Lazy-loaded ${invoiceRowsCount} invoices under customer`);

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
    assert(kpiCount >= 5 && firstKpiVal && firstKpiVal.length > 0, `D2: 5 KPI cards populated (Revenue: ${firstKpiVal.trim()})`);

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
    // TEST 6.7: D3 — Bank Guarantees Tab (الضمانات البنكية)
    // ──────────────────────────────────────────
    console.log('\n--- 6.7. D3: Bank Guarantees Tab Interactive Test ---');
    await cdp.eval('document.querySelector(".bi-tab[data-tab=\\"guarantees\\"]")?.click()');
    await sleep(3500);

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
    await sleep(3500);

    const isVatVisible = await cdp.eval('document.querySelector("#vat-main-content")?.style.display !== "none"');
    assert(isVatVisible, 'D5: VAT tab rendered and visible');

    // 4 KPI cards
    const vatKpiCount = await cdp.eval('document.querySelectorAll("#vat-main-content .exec-card").length');
    const firstVatCardVal = await cdp.eval('document.querySelector("#vat-main-content .exec-card .exec-num")?.textContent');
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
    // TEST 6.9: D4 — 5 Presentation Tabs Consolidation
    // ──────────────────────────────────────────
    console.log('\n--- 6.9. D4: Presentation Tabs Consolidation (5 Clean Tabs) ---');
    const visibleTabs = await cdp.eval(`
      (() => {
        const tabs = [...document.querySelectorAll('#bi-tabs .bi-tab')];
        return tabs
          .filter(t => t.style.display !== 'none' && window.getComputedStyle(t).display !== 'none')
          .map(t => t.dataset.tab);
      })()
    `);
    const expectedTabs = ['executive', 'customers', 'profitability', 'guarantees', 'vat'];
    const tabsMatch = visibleTabs.length === 5 && expectedTabs.every(t => visibleTabs.includes(t));
    assert(tabsMatch, `D4: Exactly 5 clean tabs visible: [${visibleTabs.join(', ')}]`);

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
    await sleep(3500);
    const viewerVatVisible = await cdp.eval('document.querySelector("#vat-main-content")?.style.display !== "none"');
    const viewerVatRows = await cdp.eval('document.querySelectorAll("#vat-tree-container tr[data-tree-row=\\"true\\"]").length');
    assert(viewerVatVisible && viewerVatRows > 0, `Viewer opened VAT tab successfully with ${viewerVatRows} rows`);

    // ──────────────────────────────────────────
    // TEST 8: Zero Console Errors
    // ──────────────────────────────────────────
    console.log('\n--- 8. Browser Console Error Check ---');
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
  }
}

runVerifyUI();
