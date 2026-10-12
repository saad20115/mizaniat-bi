/**
 * DC1: UI checks for the «مقارنة الأقسام» tab, run from verify-ui.js with its CDP client.
 * Every control is exercised with real mouse events (Input.dispatchMouseEvent).
 * Expected figures are always read from the API at run time; nothing is hard-coded.
 */
const path = require('path');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function runComparisonUiChecks({ cdp, assert, appPort, adminToken, screenshotsDir }) {
  console.log('\n--- DC1. Departments Comparison tab (مقارنة الأقسام) ---');
  const base = `http://localhost:${appPort}/index.html?page=presentation&tab=comparison&token=${adminToken}`;
  const tableSel = '#dc-tree-container table';

  const setViewport = (width, height, mobile = false) =>
    cdp.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });

  const waitFor = async (expr, timeoutMs = 20000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (await cdp.eval(`!!(${expr})`)) return true;
      await sleep(50);
    }
    return false;
  };
  const open = async (theme, extra = '') => {
    await cdp.send('Page.navigate', { url: `${base}&theme=${theme}${extra}` });
    const ok = await waitFor(`document.querySelector('${tableSel} tbody tr[data-tree-row="true"]')`);
    await sleep(250);
    return ok;
  };
  const api = (query) => cdp.eval(`fetch('/api/departments-comparison?${query}', { headers: { Authorization: 'Bearer ${adminToken}' } }).then(r => r.json())`);
  const rowCount = () => cdp.eval(`document.querySelectorAll('${tableSel} tbody tr[data-tree-row="true"]').length`);
  const digits = `(s) => (s || '').replace(/[^0-9()-]/g, '')`;
  const money = (n) => { const v = Math.round(n); return v < 0 ? `(${Math.abs(v)})` : String(Math.abs(v)); };

  // ── 1. Load, title, cards, numbers = API
  await setViewport(1440, 900);
  const loaded = await open('light');
  assert(loaded, 'DC1: tab renders its table');
  const activeYear = await cdp.eval(`(document.querySelector('.yr-chip.active') || {}).dataset?.year || ''`);
  const data = await api(`years=${activeYear}`);

  const head = await cdp.eval(`(() => {
    const d = ${digits};
    const card = (k) => d(document.querySelector('[data-dc-card="' + k + '"] .bi-kpi-value')?.textContent);
    const main = document.querySelector('#dc-main-content');
    const emoji = /[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{26FF}\\u{1F1E0}-\\u{1F1FF}]/u;
    return {
      title: document.querySelector('#dc-title')?.textContent.replace(/\\s+/g, ' ').trim(),
      activeTab: document.querySelector('.bi-tab.active')?.dataset.tab,
      cards: document.querySelectorAll('#dc-kpi-grid .bi-kpi-card').length,
      heroes: document.querySelectorAll('#dc-main-content .bi-kpi-card.hero').length,
      heroKey: document.querySelector('#dc-main-content .bi-kpi-card.hero')?.dataset.dcCard,
      revenue: card('revenue'), expenses: card('expenses'), net: card('net_profit'), cash: card('cash_collected'), open: card('open_total'),
      cashGross: d(document.querySelector('#dc-cash-gross')?.textContent),
      openGross: d(document.querySelector('#dc-open-gross')?.textContent),
      unlinkedAmount: d(document.querySelector('#dc-unlinked-amount')?.textContent),
      unlinkedCount: d(document.querySelector('#dc-unlinked-count')?.textContent),
      highlights: [...document.querySelectorAll('#dc-highlight-grid .dc-highlight')].map(h => ({ key: h.dataset.dcHighlight, dept: h.dataset.deptId, value: d(h.querySelector('.dc-highlight-value')?.textContent) })),
      hasEmoji: emoji.test(main.textContent),
      explainerSentences: (document.querySelector('#dc-explainer')?.textContent.match(/\\./g) || []).length,
      headers: [...document.querySelectorAll('${tableSel} thead th.tree-col-num')].map(th => th.textContent.replace(/\\s+/g, ' ').trim()),
      totals: [...document.querySelectorAll('#dc-totals-row td.tree-col-num .dc-cell-main')].map(s => d(s.textContent)),
      deptRows: document.querySelectorAll('${tableSel} tbody tr[data-node-type="dept"]').length,
      firstDept: document.querySelector('${tableSel} tbody tr[data-node-type="dept"] .tree-node-name')?.textContent.trim(),
      chartGroups: document.querySelectorAll('#dc-chart-container .dc-chart-group').length,
      chartBars: document.querySelectorAll('#dc-chart-container .dc-chart-bar').length
    };
  })()`);

  assert(head.activeTab === 'comparison' && head.title === `مقارنة الأقسام — ${activeYear}`, `DC1: title is «مقارنة الأقسام — {الفترة}» (actual: ${head.title})`);
  assert(head.cards === 6 && head.heroes === 1 && head.heroKey === 'net_profit', `DC1: six totals cards with exactly one hero = net profit (cards ${head.cards}, heroes ${head.heroes})`);
  const c = data.cards;
  assert(head.revenue === money(c.revenue) && head.expenses === money(c.expenses) && head.net === money(c.net_profit)
    && head.cash === money(c.cash_collected) && head.open === money(c.open_total)
    && head.cashGross === money(c.cash_collected_gross) && head.openGross === money(c.open_total_gross),
    `DC1: card figures equal the API (revenue ${head.revenue}, expenses ${head.expenses}, net ${head.net}, cash ${head.cash}, total remaining ${head.open})`);
  assert(head.unlinkedCount === String(data.unlinked_payments.count) && head.unlinkedAmount === money(data.unlinked_payments.amount),
    `DC1: unlinked payments card equals the API (count ${head.unlinkedCount}, amount ${head.unlinkedAmount})`);
  const hk = Object.keys(data.highlights);
  const hlOk = head.highlights.length === hk.length && head.highlights.every(h => {
    const a = data.highlights[h.key];
    if (!a) return false;
    if (h.key === 'top_profit') return String(a.department_id) === h.dept && h.value === money(a.net_profit);
    if (h.key === 'largest_open') return String(a.department_id) === h.dept && h.value === money(a.open_total);
    if (h.key === 'weakest_collection') return String(a.department_id) === h.dept && h.value === a.collection_rate.toFixed(1).replace('.', '');
    return String(a.largest.department_id) === h.dept && h.value === money(a.total_shortfall);
  });
  assert(hlOk, `DC1: highlight cards equal the API highlights (${head.highlights.map(h => h.key).join(', ')})`);
  const t = data.totals;
  const expTotals = [t.revenue, t.expenses, t.net_profit, t.cash_collected, t.collected_invoices, t.remaining, t.open_total].map(money);
  assert(JSON.stringify(head.totals) === JSON.stringify(expTotals), `DC1: totals row equals the API totals (${head.totals.join(' | ')})`);
  const visibleDepts = data.tree.filter(d => ['revenue', 'expenses', 'net_profit', 'cash_collected', 'collected_invoices', 'remaining', 'open_total'].some(k => d[k] !== 0)).length;
  assert(head.deptRows === visibleDepts && head.firstDept === data.tree[0].name, `DC1: every department with figures is listed, largest revenue first (${head.deptRows} rows, first: ${head.firstDept})`);
  assert(head.headers.length === 7 && head.headers.every(h => h.includes('بدون ضريبة')), 'DC1: seven numeric columns, each header states its basis «بدون ضريبة»');
  assert(head.explainerSentences === 2, `DC1: explainer above the table has two sentences (actual: ${head.explainerSentences})`);
  assert(!head.hasEmoji, 'DC1: no emoji in the tab');
  const chartDepts = data.tree.filter(d => d.revenue !== 0 || d.expenses !== 0 || d.cash_collected !== 0).length;
  assert(head.chartGroups === chartDepts && head.chartBars === chartDepts * 3, `DC1: chart shows three bars for each of the ${chartDepts} departments with figures`);

  // ── 2. Layout at every size and theme: nothing clipped, headers aligned with values, columns even
  const layoutProbe = `(() => {
    const out = { clipped: [], align: [], widths: [], labelOverlap: 0 };
    const root = document.documentElement;
    out.pageOverflow = root.scrollWidth - root.clientWidth;
    for (const card of document.querySelectorAll('#dc-kpi-grid .bi-kpi-card, #dc-highlight-grid .dc-highlight')) {
      const cr = card.getBoundingClientRect();
      for (const el of card.querySelectorAll('.bi-kpi-value, .bi-kpi-sub, .bi-kpi-label, .dc-highlight-value, .dc-highlight-sub')) {
        const range = document.createRange(); range.selectNodeContents(el);
        const r = range.getBoundingClientRect();
        if (r.width > 0 && (r.left < cr.left - 0.5 || r.right > cr.right + 0.5 || r.bottom > cr.bottom + 0.5)) out.clipped.push('card:' + el.textContent.trim().slice(0, 24));
      }
    }
    const table = document.querySelector('${tableSel}');
    const wrap = document.querySelector('#dc-tree-container');
    out.tableOverflow = table.getBoundingClientRect().width - wrap.clientWidth;
    const textRect = (el) => { const range = document.createRange(); range.selectNodeContents(el); return range.getBoundingClientRect(); };
    for (const td of table.querySelectorAll('td.tree-col-num')) {
      const tr = td.getBoundingClientRect();
      for (const el of td.querySelectorAll('.dc-cell-main, .dc-cell-sub')) {
        const r = textRect(el);
        if (r.width > 0 && (r.left < tr.left - 0.5 || r.right > tr.right + 0.5)) out.clipped.push('cell:' + el.textContent.trim().slice(0, 24));
      }
    }
    for (const th of table.querySelectorAll('thead th.tree-col-num')) {
      const colId = th.getAttribute('data-col-id');
      const thRect = th.getBoundingClientRect();
      out.widths.push(Math.round(thRect.width * 10) / 10);
      const label = th.querySelector('.dc-th-label');
      const lr = textRect(label);
      if (lr.left < thRect.left - 0.5 || lr.right > thRect.right + 0.5) out.clipped.push('th:' + colId);
      const cell = table.querySelector('tbody td[data-col-id="' + colId + '"] .dc-cell-main');
      if (cell) out.align.push(Math.round(Math.abs(lr.right - textRect(cell).right) * 10) / 10);
    }
    const labels = [...document.querySelectorAll('#dc-chart-container .dc-chart-label')].map(l => l.getBoundingClientRect());
    for (let i = 1; i < labels.length; i++) {
      // RTL: each next label sits to the left of the previous one
      if (labels[i].right > labels[i - 1].left + 0.5) out.labelOverlap++;
    }
    out.chartPlotHeight = document.querySelector('#dc-chart-container .dc-chart-plot')?.getBoundingClientRect().height || 0;
    out.chartCardHeight = document.querySelector('#dc-chart-card')?.getBoundingClientRect().height || 0;
    return out;
  })()`;

  const sizes = [
    { name: '1920', w: 1920, h: 1080, mobile: false },
    { name: '1440', w: 1440, h: 900, mobile: false },
    { name: '1280', w: 1280, h: 800, mobile: false },
    { name: 'mobile', w: 390, h: 844, mobile: true }
  ];
  for (const size of sizes) {
    for (const theme of ['light', 'dark']) {
      await setViewport(size.w, size.h, size.mobile);
      // «كل السنوات» carries the widest figures, so clipping is checked there as well
      for (const [label, extra] of [['selected year', ''], ['all years', '&year=ALL']]) {
        const ok = await open(theme, extra);
        const m = ok ? await cdp.eval(layoutProbe) : null;
        const tag = `DC1 [${size.name} · ${theme} · ${label}]`;
        if (!m) { assert(false, `${tag}: tab renders`); continue; }
        assert(m.clipped.length === 0, `${tag}: no number or label is clipped (${m.clipped.length === 0 ? 'none' : m.clipped.slice(0, 4).join(', ')})`);
        assert(m.pageOverflow <= 1, `${tag}: no horizontal page scroll (overflow ${m.pageOverflow}px)`);
        if (!size.mobile) {
          assert(m.tableOverflow <= 1, `${tag}: table fits its card without horizontal scroll (overflow ${Math.round(m.tableOverflow)}px)`);
        }
        assert(Math.max(...m.align) <= 2, `${tag}: header text aligned with its column values within 2px (max ${Math.max(...m.align)}px)`);
        assert(Math.max(...m.widths) - Math.min(...m.widths) <= 1, `${tag}: numeric columns evenly distributed (${Math.min(...m.widths)}–${Math.max(...m.widths)}px)`);
        assert(m.labelOverlap === 0 && m.chartPlotHeight > 0 && m.chartPlotHeight <= 200, `${tag}: chart has a fixed height (${Math.round(m.chartPlotHeight)}px plot) and no overlapping labels`);
      }
      if (size.name !== '1920') {
        await open(theme);
        const full = await cdp.eval(`Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)`);
        await setViewport(size.w, Math.min(full, 5000), size.mobile);
        await sleep(300);
        await cdp.screenshot(path.join(screenshotsDir, `dc1-${theme}-${size.name}.png`));
      }
    }
  }

  // ── 3. Controls, each with real mouse clicks
  await setViewport(1440, 1400);
  await open('light');
  const results = [];
  const control = async (name, fn) => {
    let effect;
    try { effect = await fn(); } catch (err) { effect = false; console.error(`  [DC1 control error] ${name}: ${err.message}`); }
    results.push({ name, effect: effect || 'no effect', ok: !!effect });
    assert(!!effect, `DC1 control (real click): ${name} — ${effect || 'no effect observed'}`);
  };
  const firstCol = (colId) => cdp.eval(`[...document.querySelectorAll('${tableSel} tbody tr[data-node-type="dept"] td[data-col-id="${colId}"] .dc-cell-main')].map(s => { const d = s.textContent.replace(/[^0-9()]/g, ''); return d.startsWith('(') ? -Number(d.replace(/[()]/g, '')) : Number(d); })`);
  const isSorted = (arr, dir) => arr.every((v, i) => i === 0 || (dir === 'desc' ? arr[i - 1] >= v : arr[i - 1] <= v));

  await control('توسيع الكل', async () => {
    const before = await rowCount();
    await cdp.realClick('#dc-btn-expand-all');
    const after = await rowCount();
    const levels = await cdp.eval(`['dept','cc','company'].map(k => document.querySelectorAll('${tableSel} tbody tr[data-node-type="' + k + '"]').length).join('/')`);
    return after > before ? `${before} → ${after} rows (dept/cc/company ${levels})` : false;
  });
  await control('طي الكل', async () => {
    const before = await rowCount();
    await cdp.realClick('#dc-btn-collapse-all');
    const after = await rowCount();
    return after < before && after === visibleDepts ? `${before} → ${after} rows` : false;
  });
  await control('فتح قسم بالنقر على صفه', async () => {
    const before = await rowCount();
    await cdp.realClick(`${tableSel} tbody tr[data-node-type="dept"] .tree-node-name`);
    const after = await rowCount();
    const kids = await cdp.eval(`document.querySelectorAll('${tableSel} tbody tr[data-node-type="cc"]').length`);
    await cdp.realClick(`${tableSel} tbody tr[data-node-type="dept"] .tree-node-name`);
    return after > before && kids === data.tree[0].children.length ? `${kids} cost centers shown, as in the API` : false;
  });
  await control('ترتيب من رأس العمود (المصروفات: الأكبر ثم الأصغر)', async () => {
    await cdp.realClick(`${tableSel} thead th[data-col-id="expenses"]`);
    const desc = await firstCol('expenses');
    const dirDesc = await cdp.eval(`document.querySelector('${tableSel} thead th[data-col-id="expenses"]').getAttribute('data-sort-dir')`);
    await cdp.realClick(`${tableSel} thead th[data-col-id="expenses"]`);
    const asc = await firstCol('expenses');
    const dirAsc = await cdp.eval(`document.querySelector('${tableSel} thead th[data-col-id="expenses"]').getAttribute('data-sort-dir')`);
    const totalsNow = await cdp.eval(`[...document.querySelectorAll('#dc-totals-row td.tree-col-num .dc-cell-main')].map(s => s.textContent.replace(/[^0-9()-]/g, ''))`);
    const ok = dirDesc === 'desc' && dirAsc === 'asc' && isSorted(desc, 'desc') && isSorted(asc, 'asc') && desc.length > 1 && desc[0] !== asc[0]
      && JSON.stringify(totalsNow) === JSON.stringify(expTotals);
    await cdp.realClick(`${tableSel} thead th[data-col-id="revenue"]`);
    return ok ? `largest first ${desc[0]}, then smallest first ${asc[0]}; totals unchanged` : false;
  });
  await control('ترتيب بإجمالي المتبقي', async () => {
    await cdp.realClick(`${tableSel} thead th[data-col-id="open_total"]`);
    const desc = await firstCol('open_total');
    const top = await cdp.eval(`document.querySelector('${tableSel} tbody tr[data-node-type="dept"] .tree-node-name').textContent.trim()`);
    const expTop = data.highlights.largest_open ? data.highlights.largest_open.name : null;
    await cdp.realClick(`${tableSel} thead th[data-col-id="revenue"]`);
    return isSorted(desc, 'desc') && (!expTop || top === expTop) ? `top row «${top}» = highlight card` : false;
  });
  await control('البحث', async () => {
    const before = await rowCount();
    const term = data.tree[0].children[0].name.trim().split(/\s+/).slice(0, 2).join(' ');
    await cdp.realClick('#dc-tree-search');
    await cdp.send('Input.insertText', { text: term });
    await sleep(600);
    const state = await cdp.eval(`({
      rows: document.querySelectorAll('${tableSel} tbody tr[data-tree-row="true"]').length,
      marks: document.querySelectorAll('${tableSel} mark.tree-search-match').length,
      counter: document.querySelector('#dc-search-counter')?.textContent,
      totals: [...document.querySelectorAll('#dc-totals-row td.tree-col-num .dc-cell-main')].map(s => s.textContent.replace(/[^0-9()-]/g, '')),
      cardRevenue: document.querySelector('[data-dc-card="revenue"] .bi-kpi-value').textContent.replace(/[^0-9()-]/g, '')
    })`);
    await cdp.realClick('#dc-btn-clear-search');
    await sleep(300);
    const after = await rowCount();
    const ok = state.marks > 0 && state.rows !== before && after === before
      && JSON.stringify(state.totals) === JSON.stringify(expTotals) && state.cardRevenue === money(c.revenue);
    return ok ? `«${term}»: ${state.counter}, ${state.rows} rows shown, totals unchanged, cleared back to ${after}` : false;
  });
  await control('عرض الدفعات غير المربوطة', async () => {
    if (data.unlinked_payments.count === 0) return 'no unlinked payments in this period (button hidden)';
    await cdp.realClick('#dc-btn-toggle-unlinked');
    const shown = await cdp.eval(`(() => { const l = document.querySelector('#dc-unlinked-list'); return getComputedStyle(l).display !== 'none' ? l.querySelectorAll('tbody tr').length : -1; })()`);
    await cdp.realClick('#dc-btn-toggle-unlinked');
    const hidden = await cdp.eval(`getComputedStyle(document.querySelector('#dc-unlinked-list')).display === 'none'`);
    return shown === data.unlinked_payments.moves.length && hidden ? `${shown} payments listed, then hidden` : false;
  });
  await control('تصدير Excel', async () => {
    await cdp.eval(`(() => { window.__dcExport = null; const orig = URL.createObjectURL; URL.createObjectURL = (blob) => { window.__dcExport = { size: blob.size, type: blob.type }; blob.text().then(t => { window.__dcExport.lines = t.split('\\r\\n').length; window.__dcExport.head = t.slice(0, 40); }); return orig.call(URL, blob); }; })()`);
    await cdp.realClick('#btn-tree-export-excel');
    await sleep(400);
    const ex = await cdp.eval('window.__dcExport');
    return ex && ex.size > 500 && ex.lines > visibleDepts + 3 ? `${ex.lines} lines, ${ex.size} bytes` : false;
  });
  await control('إظهار البنود الصفرية', async () => {
    const before = await rowCount();
    await cdp.realClick('.bi-filter-zero-item label.bi-switch');
    await waitFor(`document.querySelector('${tableSel} tbody tr[data-tree-row="true"]')`);
    await sleep(400);
    const on = await rowCount();
    await cdp.realClick('.bi-filter-zero-item label.bi-switch');
    await waitFor(`document.querySelector('${tableSel} tbody tr[data-tree-row="true"]')`);
    await sleep(400);
    const off = await rowCount();
    return on >= before && off === before && on === data.tree.length ? `${before} → ${on} rows (all ${data.tree.length} departments) → ${off}` : false;
  });
  await control('تغيير السنة', async () => {
    const other = await cdp.eval(`(() => { const chip = [...document.querySelectorAll('.yr-chip')].find(ch => !ch.classList.contains('active') && ch.style.display !== 'none'); return chip ? chip.dataset.year : null; })()`);
    if (!other) return false;
    await cdp.realClick(`.yr-chip[data-year="${other}"]`);
    await cdp.realClick(`.yr-chip[data-year="${activeYear}"]`);
    await waitFor(`document.querySelector('#dc-title')?.textContent.replace(/\\s+/g, ' ').trim() ==='مقارنة الأقسام — ${other}'`);
    await sleep(300);
    const d2 = await api(`years=${other}`);
    const shown = await cdp.eval(`({ title: document.querySelector('#dc-title').textContent.replace(/\\s+/g, ' ').trim(), revenue: document.querySelector('[data-dc-card="revenue"] .bi-kpi-value').textContent.replace(/[^0-9()-]/g, ''), cash: document.querySelector('[data-dc-card="cash_collected"] .bi-kpi-value').textContent.replace(/[^0-9()-]/g, '') })`);
    const ok = shown.title === `مقارنة الأقسام — ${other}` && shown.revenue === money(d2.cards.revenue) && shown.cash === money(d2.cards.cash_collected);
    await cdp.realClick(`.yr-chip[data-year="${activeYear}"]`);
    await cdp.realClick(`.yr-chip[data-year="${other}"]`);
    await waitFor(`document.querySelector('#dc-title')?.textContent.replace(/\\s+/g, ' ').trim() ==='مقارنة الأقسام — ${activeYear}'`);
    return ok ? `${other}: revenue ${shown.revenue}, cash ${shown.cash} = API` : false;
  });
  await control('تبديل الوضع الداكن', async () => {
    await cdp.realClick('#btn-theme-toggle');
    await sleep(400);
    const dark = await cdp.eval(`document.documentElement.getAttribute('data-theme')`);
    const stillThere = await cdp.eval(`!!document.querySelector('${tableSel} tbody tr[data-tree-row="true"]')`);
    await cdp.realClick('#btn-theme-toggle');
    await sleep(400);
    return dark === 'dark' && stillThere ? 'dark theme applied, tab still rendered' : false;
  });

  console.log('\n  DC1 controls (real clicks):');
  console.table(results.map(r => ({ control: r.name, effect: r.effect, status: r.ok ? 'PASS' : 'FAIL' })));

  // ── 4. Warm tab switch <= 0.3s, measured inside the page from the click to the rendered table
  await waitFor(`document.querySelector('${tableSel} tbody tr[data-tree-row="true"]')`);
  const timings = [];
  for (let i = 0; i < 3; i++) {
    await cdp.realClick('.bi-tab[data-tab="executive"]');
    await waitFor(`document.querySelector('#exec-chart-container svg')`);
    await sleep(300);
    await cdp.eval(`(() => {
      window.__dcSwitch = null;
      const tab = document.querySelector('.bi-tab[data-tab="comparison"]');
      tab.addEventListener('click', () => {
        const t0 = performance.now();
        const done = () => document.querySelector('${tableSel} tbody tr[data-tree-row="true"]') && document.querySelector('#dc-kpi-grid');
        const obs = new MutationObserver(() => { if (done()) { window.__dcSwitch = performance.now() - t0; obs.disconnect(); } });
        obs.observe(document.querySelector('#bi-body'), { childList: true, subtree: true });
      }, { capture: true, once: true });
    })()`);
    await cdp.realClick('.bi-tab[data-tab="comparison"]');
    await waitFor('window.__dcSwitch !== null', 5000);
    timings.push(await cdp.eval('window.__dcSwitch'));
  }
  const worst = Math.max(...timings.map(v => (v === null ? Infinity : v)));
  assert(worst <= 300, `DC1: warm tab switch <= 0.3s (three switches: ${timings.map(v => (v === null ? 'timeout' : Math.round(v) + 'ms')).join(', ')})`);

  // ── 5. Executive tab aging table: search + header sort (added on the owner's request), totals untouched
  console.log('\n--- DC1-b. Executive aging table: search and sort ---');
  await setViewport(1440, 1600);
  await cdp.send('Page.navigate', { url: `http://localhost:${appPort}/index.html?page=presentation&tab=executive&theme=light&token=${adminToken}` });
  await waitFor(`document.querySelector('#exec-aging-toggle')`);
  await sleep(500);
  if (!(await cdp.eval(`getComputedStyle(document.querySelector('#exec-aging-container')).display !== 'none'`))) {
    await cdp.realClick('#exec-aging-toggle');
  }
  const agSel = '#exec-aging-container table';
  const agReady = await waitFor(`document.querySelector('${agSel} tbody tr[data-tree-row="true"]')`);
  assert(agReady, 'Aging: table opens');
  const agYear = await cdp.eval(`(document.querySelector('.yr-chip.active') || {}).dataset?.year || ''`);
  const aging = await cdp.eval(`fetch('/api/executive/aging?years=${agYear}', { headers: { Authorization: 'Bearer ${adminToken}' } }).then(r => r.json())`);
  const agNum = `(s) => { const d = (s || '').replace(/[^0-9()]/g, ''); return d.startsWith('(') ? -Number(d.replace(/[()]/g, '')) : Number(d); }`;
  const agCol = (idx) => cdp.eval(`(() => { const n = ${agNum}; return [...document.querySelectorAll('${agSel} tbody tr[data-tree-row="true"]')].map(tr => n(tr.children[${idx}].textContent)); })()`);
  const agFooter = () => cdp.eval(`(() => { const n = ${agNum}; return [...document.querySelectorAll('${agSel} tfoot tr.exec-sticky-footer td')].slice(1).map(td => n(td.textContent)); })()`);
  const agWidth = () => cdp.eval(`(() => { const t = document.querySelector('${agSel}'); const w = document.querySelector('#exec-aging-container'); return { table: Math.round(t.getBoundingClientRect().width), box: w.clientWidth, cols: [...t.querySelectorAll('thead th')].map(th => Math.round(th.getBoundingClientRect().width)) }; })()`);
  const agWidthBefore = await agWidth();
  const footerBefore = await agFooter();
  const expFooter = ['not_due', 'b1_30', 'b31_60', 'b61_90', 'b91_180', 'b181_365', 'over_365'].map(k => Math.round(aging.totals.buckets[k] || 0)).concat(Math.round(aging.totals.total_residual || 0));
  assert(JSON.stringify(footerBefore) === JSON.stringify(expFooter), `Aging: totals row equals the API before any interaction (${footerBefore.join(' | ')})`);

  await cdp.eval(`(() => { const b = document.querySelector('#exec-aging-tools'); if (b) b.scrollIntoView({ block: 'center' }); })()`);
  await sleep(300);
  await cdp.realClick(`${agSel} thead th[data-col-id="total_residual"]`);
  const agDesc = await agCol(8);
  await cdp.realClick(`${agSel} thead th[data-col-id="total_residual"]`);
  const agAsc = await agCol(8);
  const sortedOk = agDesc.length > 1 && isSorted(agDesc, 'desc') && isSorted(agAsc, 'asc') && agDesc[0] === Math.max(...agDesc) && agAsc[0] === Math.min(...agAsc);
  assert(sortedOk, `Aging (real click): header sorts largest-first then smallest-first (${agDesc[0]} … ${agDesc[agDesc.length - 1]} → ${agAsc[0]} … ${agAsc[agAsc.length - 1]})`);
  await cdp.realClick(`${agSel} thead th[data-col-id="b1_30"]`);
  const agBucket = await agCol(2);
  assert(isSorted(agBucket, 'desc'), `Aging (real click): sorting by a bucket column works (1-30: ${agBucket.join(', ')})`);
  const footerSorted = await agFooter();
  assert(JSON.stringify(footerSorted) === JSON.stringify(expFooter), 'Aging: totals row unchanged after sorting');
  const agWidthAfter = await agWidth();
  assert(agWidthAfter.table === agWidthBefore.table && JSON.stringify(agWidthAfter.cols) === JSON.stringify(agWidthBefore.cols),
    `Aging: sort indicator leaves the table and column widths exactly as before (table ${agWidthBefore.table}px → ${agWidthAfter.table}px)`);

  const agTerm = (aging.tree[0]?.departments?.[0]?.name || '').trim();
  const agRowsBefore = await cdp.eval(`document.querySelectorAll('${agSel} tbody tr[data-tree-row="true"]').length`);
  await cdp.realClick('#exec-aging-search');
  await cdp.send('Input.insertText', { text: agTerm });
  await sleep(700);
  const agSearch = await cdp.eval(`({
    rows: document.querySelectorAll('${agSel} tbody tr[data-tree-row="true"]').length,
    marks: document.querySelectorAll('${agSel} mark.tree-search-match').length,
    counter: document.querySelector('#exec-aging-search-counter')?.textContent,
    subtotal: !!document.querySelector('${agSel} .tree-search-subtotal-row')
  })`);
  const footerSearch = await agFooter();
  assert(agTerm.length > 0 && agSearch.marks > 0 && agSearch.rows > 0 && !agSearch.subtotal && JSON.stringify(footerSearch) === JSON.stringify(expFooter),
    `Aging (real click + typing): search «${agTerm}» highlights matches (${agSearch.counter}), totals row unchanged`);
  await cdp.realClick('#exec-aging-search-clear');
  await sleep(400);
  const agRowsAfter = await cdp.eval(`document.querySelectorAll('${agSel} tbody tr[data-tree-row="true"]').length`);
  assert(agRowsAfter === agRowsBefore, `Aging (real click): clearing the search restores the rows (${agRowsBefore} → ${agSearch.rows} → ${agRowsAfter})`);
  await cdp.screenshot(path.join(screenshotsDir, 'dc1-aging-search-sort.png'));

  await setViewport(1920, 3000);
}

module.exports = { runComparisonUiChecks };
