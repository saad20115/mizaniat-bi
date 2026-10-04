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
    await sleep(3500);

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
    assert(still2026, 'Attempting to deselect the last active year was prevented (at least 1 year required)');

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
      try { process.kill(chromeProcess.pid); } catch (e) {}
    }
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}
  }
}

runVerifyUI();
