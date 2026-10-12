/**
 * DC1: permanent invariants for the «مقارنة الأقسام» tab (getDepartmentsComparison).
 * Called from verify-data.js. No expected figures are written here: every check compares the
 * new function with another engine function or with a query on the raw tables.
 */

// Tax lines that exist in Odoo itself on a P&L account, identified by (company_id, move_name).
// They are printed with their amount on every run; anything not listed here fails the check.
const KNOWN_TAX_LINES_ON_PNL = [
  { company_id: 3, move_name: 'MISC/2025/06/0161' }
];

const CASH_CHANNELS = "('bank', 'sister_company', 'other_adjustment')";
const MEASURES = ['revenue', 'expenses', 'collected_invoices', 'remaining', 'residual_gross', 'cash_collected', 'cash_collected_gross', 'other_open', 'other_open_gross'];
const DERIVED = ['net_profit', 'billed', 'open_total', 'open_total_gross', 'cash_vat'];

function runDepartmentsComparisonChecks({ engine, db, check }) {
  console.log('\n── Departments Comparison (DC1 — مقارنة الأقسام)');
  const fmt = (n) => Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const companies = db.prepare('SELECT id, name FROM companies WHERE is_active = 1 ORDER BY id').all();
  const salesCid = (cid) => engine._getSalesCid(cid);

  // Years come from the data itself
  const years = db.prepare(`
    SELECT y FROM (
      SELECT DISTINCT year AS y FROM fact_daily WHERE revenue != 0 OR expense != 0
      UNION SELECT DISTINCT payment_year FROM payment_allocations
      UNION SELECT DISTINCT substr(date, 1, 4) FROM sales_invoices
    ) WHERE y GLOB '[0-9][0-9][0-9][0-9]' ORDER BY y
  `).all().map(r => r.y);
  const periods = [...years, 'ALL'];

  // ── A. Basis proof: revenue / expenses come from income / expense accounts only, with no tax lines inside
  const pnlOutside = db.prepare(`SELECT COUNT(*) n FROM fact_daily WHERE (revenue != 0 OR expense != 0) AND section NOT IN ('income', 'expense')`).get().n;
  check('DC1-A1: fact_daily revenue/expense rows sit on income/expense sections only', pnlOutside === 0, `${pnlOutside} rows outside`);

  const vatTagged = db.prepare(`
    SELECT COUNT(*) n FROM fact_daily fd
    JOIN account_tags t ON t.company_id = fd.company_id AND t.account_code = fd.account_code
    WHERE t.tag LIKE 'vat%' AND (fd.revenue != 0 OR fd.expense != 0)
  `).get().n;
  check('DC1-A2: no VAT-tagged account contributes to revenue/expense', vatTagged === 0, `${vatTagged} rows`);

  const taxLines = db.prepare(`
    SELECT ji.company_id, ji.move_name, ji.date, ji.account_code, ROUND(SUM(ji.debit - ji.credit), 2) AS amount, COUNT(*) AS n
    FROM journal_items ji
    ${engine._sectionJoin('ji', 'o')}
    WHERE ${engine._sectionExpr('ji', 'o')} IN ('income', 'expense')
      AND ji.move_state = 'posted'
      AND ji.tax_id IS NOT NULL AND ji.tax_id != 0
    GROUP BY ji.company_id, ji.move_name, ji.account_code
  `).all();
  const isKnownTaxLine = (r) => KNOWN_TAX_LINES_ON_PNL.some(k => k.company_id === r.company_id && k.move_name === r.move_name);
  const unknownTaxLines = taxLines.filter(r => !isKnownTaxLine(r));
  const taxLinesDetail = taxLines.length === 0
    ? '0 tax lines'
    : taxLines.map(r => `company ${r.company_id} ${r.move_name} (${r.date}) account ${r.account_code}: ${fmt(r.amount)} SAR`).join('; ');
  check('DC1-A3: no tax line (tax_line) is posted on an income/expense account',
    taxLines.length === 0, taxLinesDetail, taxLines.length > 0 && unknownTaxLines.length === 0);

  // ── B. Exceptions list: allocations whose invoice is missing / ambiguous / has amount_total = 0 (expected zero)
  const dupInvoices = db.prepare(`SELECT COUNT(*) n FROM (SELECT 1 FROM sales_invoices GROUP BY company_id, invoice_id HAVING COUNT(*) > 1)`).get().n;
  const excRow = db.prepare(`
    SELECT
      SUM(CASE WHEN pa.invoice_id IS NULL THEN 1 ELSE 0 END) AS no_invoice,
      SUM(CASE WHEN pa.invoice_id IS NOT NULL AND si.id IS NULL THEN 1 ELSE 0 END) AS not_found,
      SUM(CASE WHEN si.id IS NOT NULL AND (si.amount_total IS NULL OR si.amount_total = 0) THEN 1 ELSE 0 END) AS zero_total,
      ROUND(SUM(CASE WHEN si.id IS NULL OR si.amount_total IS NULL OR si.amount_total = 0 THEN pa.amount ELSE 0 END), 2) AS amount
    FROM payment_allocations pa
    LEFT JOIN sales_invoices si ON si.company_id = pa.sales_company_id AND si.invoice_id = pa.invoice_id
    WHERE pa.channel IN ${CASH_CHANNELS}
  `).get();
  const excCount = (excRow.no_invoice || 0) + (excRow.not_found || 0) + (excRow.zero_total || 0);
  check('DC1-B1: exceptions list is empty (allocations without invoice / invoice not found / invoice amount_total = 0)',
    excCount === 0 && dupInvoices === 0,
    `count ${excCount} (no invoice ${excRow.no_invoice || 0}, not found ${excRow.not_found || 0}, total=0 ${excRow.zero_total || 0}), amount ${fmt(excRow.amount || 0)} SAR, duplicated invoice ids ${dupInvoices}`);
  const apiAll = engine.getDepartmentsComparison({ years: ['ALL'] });
  check('DC1-B2: API exceptions list equals the raw-table exceptions (count and amount)',
    apiAll.exceptions.count === excCount && Math.abs(apiAll.exceptions.amount - (excRow.amount || 0)) < 0.005,
    `api ${apiAll.exceptions.count} / ${fmt(apiAll.exceptions.amount)} vs raw ${excCount} / ${fmt(excRow.amount || 0)}`);

  // ── C. Per invoice: net cash collected across all years never exceeds its amount_untaxed
  const overCollected = db.prepare(`
    SELECT COUNT(*) n, MAX(over_by) AS max_over FROM (
      SELECT SUM(pa.amount * si.amount_untaxed / si.amount_total) - si.amount_untaxed AS over_by
      FROM payment_allocations pa
      JOIN sales_invoices si ON si.company_id = pa.sales_company_id AND si.invoice_id = pa.invoice_id
      WHERE pa.channel IN ${CASH_CHANNELS} AND si.amount_total != 0
      GROUP BY si.id
      HAVING over_by > 0.01
    )
  `).get();
  check('DC1-C1: per invoice, net collected across all years <= amount_untaxed (+0.01)', overCollected.n === 0,
    `${overCollected.n} invoices over, max ${fmt(overCollected.max_over || 0)}`);

  // ── D. Scenario matrix: every year + ALL, with / without company, group and cost-center filters
  const scenarios = [];
  for (const p of periods) {
    scenarios.push({ label: `${p} / all companies`, args: { years: [p] }, period: p, plain: true });
    for (const c of companies) {
      scenarios.push({ label: `${p} / company ${c.id}`, args: { years: [p], companyIds: [c.id] }, period: p, plain: true, companyId: c.id });
    }
    const periodSql = p === 'ALL' ? '1=1' : `year = '${p}'`;
    const topCc = db.prepare(`
      SELECT company_id, cost_center_key FROM fact_daily
      WHERE ${periodSql} AND cost_center_key IS NOT NULL AND TRIM(cost_center_key) != ''
      GROUP BY company_id, cost_center_key HAVING SUM(revenue) != 0
      ORDER BY SUM(revenue) DESC LIMIT 1
    `).get();
    if (topCc) {
      scenarios.push({ label: `${p} / cost center ${topCc.company_id}|${topCc.cost_center_key}`, args: { years: [p], costCenters: [`${topCc.company_id}|${topCc.cost_center_key}`] }, period: p });
    }
    const topGroup = db.prepare(`
      SELECT department_id FROM fact_daily WHERE ${periodSql} AND department_id > 0
      GROUP BY department_id HAVING SUM(revenue) != 0 ORDER BY SUM(revenue) DESC LIMIT 1
    `).get();
    if (topGroup) {
      scenarios.push({ label: `${p} / group ${topGroup.department_id}`, args: { years: [p], departmentIds: [topGroup.department_id] }, period: p });
      scenarios.push({ label: `${p} / group ${topGroup.department_id} / company ${companies[0].id}`, args: { years: [p], departmentIds: [topGroup.department_id], companyIds: [companies[0].id] }, period: p });
    }
  }

  const fails = { exec: [], incomeStmt: [], cash: [], vatIndep: [], collInv: [], perCompany: [], sums: [], identity: [], unclassified: [], open: [], openRaw: [], openOrder: [], highlights: [], unlinked: [] };
  let maxUntaxedOverGross = 0;
  let leafCount = 0;
  const table = [];

  for (const sc of scenarios) {
    const dc = engine.getDepartmentsComparison(sc.args);
    const exec = engine.getExecutiveSummary(sc.args);
    const col = engine.getCollections(sc.args);
    const t = dc.totals;

    // D1. departments total = executive cards
    if (t.revenue !== exec.cards.revenue || t.expenses !== exec.cards.expenses) {
      fails.exec.push(`${sc.label}: rev ${t.revenue} vs ${exec.cards.revenue}, exp ${t.expenses} vs ${exec.cards.expenses}`);
    }

    // D2. departments total = income statement of the same period (no cost-center / group filter there)
    let isRev = null;
    if (sc.plain) {
      const is = engine.getIncomeStatement({ years: [sc.period], companyIds: sc.companyId ? [sc.companyId] : undefined });
      isRev = Math.round(is.summary.totalRevenue || 0);
      const isExp = Math.round(is.summary.totalExpenses || 0);
      if (t.revenue !== isRev || t.expenses !== isExp) {
        fails.incomeStmt.push(`${sc.label}: rev ${t.revenue} vs IS ${isRev}, exp ${t.expenses} vs IS ${isExp}`);
      }
    }

    // D3. net cash + excluded VAT share (+ exceptions) = collections tab total_collected, to the halala
    const cashSum = dc.cash_exact.net + dc.cash_exact.vat_excluded + dc.cash_exact.exceptions_gross;
    const cashDiff = Math.round((cashSum - col.cards.total_collected) * 100) / 100;
    if (cashDiff !== 0 || t.cash_collected !== Math.round(dc.cash_exact.net) || t.cash_collected_gross !== Math.round(dc.cash_exact.gross - dc.cash_exact.exceptions_gross)) {
      fails.cash.push(`${sc.label}: net ${dc.cash_exact.net} + vat ${dc.cash_exact.vat_excluded} vs total_collected ${col.cards.total_collected} (diff ${cashDiff}); row totals ${t.cash_collected}/${t.cash_collected_gross}`);
    }

    // D4. the excluded VAT share recomputed independently from the raw tables
    if (sc.plain) {
      const where = [`pa.channel IN ${CASH_CHANNELS}`];
      if (sc.period !== 'ALL') where.push(`pa.payment_year = '${sc.period}'`);
      if (sc.companyId) where.push(`pa.company_id = ${Number(sc.companyId)}`);
      const vatRow = db.prepare(`
        SELECT SUM(pa.amount * (si.amount_total - si.amount_untaxed) / si.amount_total) AS vat
        FROM payment_allocations pa
        JOIN sales_invoices si ON si.company_id = pa.sales_company_id AND si.invoice_id = pa.invoice_id
        WHERE ${where.join(' AND ')} AND si.amount_total != 0
      `).get();
      if (Math.abs((vatRow.vat || 0) - dc.cash_exact.vat_excluded) >= 0.015) {
        fails.vatIndep.push(`${sc.label}: api vat ${dc.cash_exact.vat_excluded} vs raw ${Math.round((vatRow.vat || 0) * 100) / 100}`);
      }
    }

    // D5. «collected from period invoices» and its tax-inclusive residual = executive tab; billed within rounding of it
    if (t.collected_invoices !== exec.cards.collected_period_untaxed || t.residual_gross !== exec.cards.residual_period
      || Math.abs(t.billed - exec.cards.billed_period_untaxed) > 1) {
      fails.collInv.push(`${sc.label}: collected ${t.collected_invoices} vs ${exec.cards.collected_period_untaxed}, residual ${t.residual_gross} vs ${exec.cards.residual_period}, billed ${t.billed} vs ${exec.cards.billed_period_untaxed}`);
    }

    // D6. aggregated department = sum of its rows per company as the executive tab shows them
    const perCell = new Map();
    for (const d of dc.tree) {
      for (const cc of d.children) {
        for (const leaf of cc.children) {
          leafCount++;
          const k = `${leaf.company_id}|${d.department_id}`;
          if (!perCell.has(k)) perCell.set(k, { revenue: 0, expenses: 0, collected_invoices: 0, residual_gross: 0 });
          const acc = perCell.get(k);
          for (const m of Object.keys(acc)) acc[m] += leaf[m];
        }
      }
    }
    const execCells = new Map();
    for (const co of exec.tree.rows) for (const d of co.children) execCells.set(`${co.company_id}|${d.department_id}`, d);
    for (const k of new Set([...perCell.keys(), ...execCells.keys()])) {
      const mine = perCell.get(k) || { revenue: 0, expenses: 0, collected_invoices: 0, residual_gross: 0 };
      const ex = execCells.get(k) || { revenue: 0, expenses: 0, collected: 0, residual: 0 };
      if (mine.revenue !== ex.revenue || mine.expenses !== ex.expenses || mine.collected_invoices !== ex.collected || mine.residual_gross !== ex.residual) {
        fails.perCompany.push(`${sc.label} cell ${k}: mine ${JSON.stringify(mine)} vs exec rev ${ex.revenue} exp ${ex.expenses} coll ${ex.collected} res ${ex.residual}`);
      }
    }

    // D7. parent = sum of displayed children at every level (difference 0) + row identities
    const sumOf = (nodes, m) => nodes.reduce((s, n) => s + n[m], 0);
    const checkNode = (node, label) => {
      if (node.net_profit !== node.revenue - node.expenses || node.billed !== node.collected_invoices + node.remaining
        || node.open_total !== node.remaining + node.other_open || node.open_total_gross !== node.residual_gross + node.other_open_gross
        || node.cash_vat !== node.cash_collected_gross - node.cash_collected) {
        fails.identity.push(`${sc.label} ${label}`);
      }
      if (node.open_total < node.remaining) fails.openOrder.push(`${sc.label} ${label}: open ${node.open_total} < remaining ${node.remaining}`);
      maxUntaxedOverGross = Math.max(maxUntaxedOverGross, node.open_total - node.open_total_gross, node.cash_collected - node.cash_collected_gross, node.remaining - node.residual_gross);
      if (node.remaining !== 0 && node.residual_gross === 0) fails.identity.push(`${sc.label} ${label}: remaining ${node.remaining} on a fully paid row`);
      if (node.children) {
        for (const m of [...MEASURES, ...DERIVED]) {
          if (sumOf(node.children, m) !== node[m]) fails.sums.push(`${sc.label} ${label}: ${m} ${node[m]} != children ${sumOf(node.children, m)}`);
        }
        node.children.forEach(ch => checkNode(ch, `${label} > ${ch.name}`));
      }
    };
    checkNode({ ...t, children: dc.tree }, 'TOTAL');

    // D8. no «غير مصنّف» bucket for revenue / expenses
    for (const d of dc.tree) {
      if ((d.department_id === 0 || d.name === 'غير مصنّف') && (d.revenue !== 0 || d.expenses !== 0)) {
        fails.unclassified.push(`${sc.label}: ${d.name} rev ${d.revenue} exp ${d.expenses}`);
      }
    }

    // D9. total remaining (all open invoices up to the cut-off) = customers tab residual at the same cut-off
    const cutoff = dc.meta.open_cutoff_date;
    const custArgs = { companyIds: sc.args.companyIds, departmentIds: sc.args.departmentIds, costCenters: sc.args.costCenters };
    const cust = engine.getCustomersCollection(cutoff ? { ...custArgs, dateTo: cutoff } : { ...custArgs, years: ['ALL'] });
    const openDiff = Math.abs(dc.open_exact.gross - cust.totals.total_residual);
    if (openDiff > 0.02 || dc.open_exact.untaxed > dc.open_exact.gross + 0.005
      || Math.abs(t.open_total_gross - dc.open_exact.gross) > 1 || Math.abs(t.open_total - dc.open_exact.untaxed) > 1) {
      fails.open.push(`${sc.label}: open gross ${dc.open_exact.gross} vs customers tab ${cust.totals.total_residual}; untaxed ${dc.open_exact.untaxed}; row totals ${t.open_total}/${t.open_total_gross}`);
    }
    if (sc.plain) {
      const where = [`LOWER(si.state) = 'posted'`];
      if (cutoff) where.push(`si.date <= '${cutoff}'`);
      if (sc.companyId) where.push(`si.company_id = ${Number(salesCid(sc.companyId))}`);
      const raw = db.prepare(`SELECT SUM(si.amount_residual_signed) AS r FROM sales_invoices si WHERE ${where.join(' AND ')}`).get().r || 0;
      if (Math.abs(raw - dc.open_exact.gross) >= 0.015) fails.openRaw.push(`${sc.label}: api ${dc.open_exact.gross} vs SUM(amount_residual_signed) ${Math.round(raw * 100) / 100}`);
    }

    // D10. highlight cards = the table's own sort (value and department)
    const h = dc.highlights;
    const best = (list, key, dir) => list.slice().sort((a, b) => (dir * (b[key] - a[key])) || (a.department_id - b.department_id))[0];
    const expTop = best(dc.tree.filter(d => d.net_profit > 0), 'net_profit', 1);
    const expOpen = best(dc.tree.filter(d => d.open_total > 0), 'open_total', 1);
    const expWeak = dc.tree.filter(d => d.billed > 0 && d.remaining > 0)
      .sort((a, b) => (a.collected_invoices / a.billed - b.collected_invoices / b.billed) || (b.remaining - a.remaining) || (a.department_id - b.department_id))[0];
    const lossList = dc.tree.filter(d => d.expenses > d.revenue);
    const expLossLargest = best(lossList, 'net_profit', -1);
    const same = (card, exp, key) => (!card && !exp) || (card && exp && card.department_id === exp.department_id && card[key] === exp[key]);
    const lossOk = (!h.loss_departments && lossList.length === 0) || (h.loss_departments && h.loss_departments.count === lossList.length
      && h.loss_departments.total_departments === dc.tree.length
      && h.loss_departments.total_shortfall === lossList.reduce((s, d) => s + (d.expenses - d.revenue), 0)
      && h.loss_departments.largest.department_id === expLossLargest.department_id
      && h.loss_departments.largest.shortfall === expLossLargest.expenses - expLossLargest.revenue);
    if (!same(h.top_profit, expTop, 'net_profit') || !same(h.largest_open, expOpen, 'open_total') || !same(h.weakest_collection, expWeak, 'remaining') || !lossOk) {
      fails.highlights.push(sc.label);
    }

    // D11. unlinked payments card = collections tab (count and amount)
    if (dc.unlinked_payments.count !== col.cards.unallocated_lines_count || Math.abs(dc.unlinked_payments.amount - col.cards.unallocated_balance) >= 0.005) {
      fails.unlinked.push(`${sc.label}: ${dc.unlinked_payments.count}/${dc.unlinked_payments.amount} vs ${col.cards.unallocated_lines_count}/${col.cards.unallocated_balance}`);
    }

    if (sc.plain && !sc.companyId) {
      table.push({
        period: sc.period,
        revenue: fmt(t.revenue), 'exec/IS': `${fmt(exec.cards.revenue)} / ${fmt(isRev)}`,
        expenses: fmt(t.expenses),
        'cash net': fmt(dc.cash_exact.net), 'vat excluded': fmt(dc.cash_exact.vat_excluded), 'collections tab': fmt(col.cards.total_collected), 'cash diff': cashDiff.toFixed(2),
        'collected inv.': fmt(t.collected_invoices), 'exec collected': fmt(exec.cards.collected_period_untaxed),
        'open gross': fmt(dc.open_exact.gross), 'customers tab': fmt(cust.totals.total_residual)
      });
    }
  }

  const n = scenarios.length;
  const report = (name, list) => check(`${name} [${n} scenarios: ${periods.join(', ')} × all/each company/top cost center/top group]`, list.length === 0,
    list.length === 0 ? 'difference 0 in all scenarios' : `${list.length} mismatches — ${list.slice(0, 3).join(' | ')}`);
  report('DC1-D1: sum of department revenue/expenses = executive cards', fails.exec);
  report('DC1-D2: sum of department revenue/expenses = income statement (same period)', fails.incomeStmt);
  report('DC1-D3: net cash collected + excluded VAT share = collections tab total_collected (0.00)', fails.cash);
  report('DC1-D4: excluded VAT share = independent recomputation from raw tables', fails.vatIndep);
  report('DC1-D5: collected from period invoices and its tax-inclusive residual = executive tab (billed within 1 SAR rounding)', fails.collInv);
  report('DC1-D6: aggregated department = its per-company rows as shown in the executive tab', fails.perCompany);
  report(`DC1-D7a: parent = sum of displayed children at every level (${leafCount} leaf rows)`, fails.sums);
  report('DC1-D7b: row identities (net = revenue − expenses; billed = collected + remaining; total remaining = period remaining + other open)', fails.identity);
  report('DC1-D8: no «غير مصنّف» bucket carries revenue or expenses', fails.unclassified);
  report('DC1-D9a: total remaining (tax-inclusive) = customers tab residual at the same cut-off; tax-exclusive <= tax-inclusive', fails.open);
  report('DC1-D9b: total remaining (tax-inclusive) = SUM(amount_residual_signed) of posted invoices up to the cut-off', fails.openRaw);
  report('DC1-D9c: total remaining >= remaining of period invoices on every row', fails.openOrder);
  report('DC1-D10: highlight cards = result of sorting the table rows (department and value)', fails.highlights);
  report('DC1-D11: unlinked payments card = collections tab (count and amount)', fails.unlinked);
  check('DC1-D12: on every row the tax-exclusive figure never exceeds its tax-inclusive companion (cash, period remaining, total remaining)',
    maxUntaxedOverGross <= 0, `max excess ${maxUntaxedOverGross} SAR`);

  console.log('\n  DC1 invariants table (all companies):');
  console.table(table);
}

module.exports = { runDepartmentsComparisonChecks };
