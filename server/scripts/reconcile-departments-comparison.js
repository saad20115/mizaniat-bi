/**
 * DC1 independent audit: recompute every column of the «مقارنة الأقسام» tab per department
 * straight from the stored tables with plain SQL (no engine query builders, no rounding helpers),
 * then compare with what the tab's function returns.
 *
 * Usage: node server/scripts/reconcile-departments-comparison.js [year|ALL] [companyId]
 * Read-only. Exit code 1 if any department differs by more than the rounding allowance.
 *
 * Department attribution is the stored one (fact_daily.department_id, invoice_departments, payment_allocations);
 * the ledger total is cross-checked against journal_items separately at the end.
 */
const path = require('path');
const Database = require('better-sqlite3');
const ConsolidationEngine = require('../services/consolidation');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'mizaniat.db');
const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });

const yearArg = process.argv[2] || String(new Date().getFullYear());
const companyArg = process.argv[3] ? Number(process.argv[3]) : null;
const isAll = yearArg.toUpperCase() === 'ALL';
// The tab pins each (company, department) cell to the executive tab's displayed integer, and that tab moves its
// own rounding remainders into one department per company; a department total can therefore sit a few SAR
// away from the rounded raw sum. Anything beyond this allowance is a real difference.
const ALLOWANCE = 3;

const companies = db.prepare(`
  SELECT c.id AS ledger_cid, sc.id AS sales_cid, c.name
  FROM companies c JOIN sales_companies sc ON sc.sales_company_id = c.odoo_company_id
  WHERE c.is_active = 1 ORDER BY c.id
`).all().filter(c => !companyArg || c.ledger_cid === companyArg);
const ledgerIds = companies.map(c => c.ledger_cid).join(',');
const salesIds = companies.map(c => c.sales_cid).join(',');
const cutoff = isAll ? null : `${yearArg}-12-31`;

// Same identity rule as the app: a real group keeps its id; an unmapped cost center stands on its own key
const deptKey = (departmentId, costCenterKey) => (departmentId > 0 ? `g:${departmentId}` : `cc:${(costCenterKey || '').trim()}`);
const rows = new Map();
const names = new Map();
const row = (key, name) => {
  if (!rows.has(key)) rows.set(key, { revenue: 0, expenses: 0, cash_net: 0, cash_gross: 0, collected: 0, remaining: 0, residual_gross: 0, open: 0, open_gross: 0 });
  if (name && !names.has(key)) names.set(key, name);
  return rows.get(key);
};
const groupNames = new Map(db.prepare('SELECT id, name FROM analytic_groups').all().map(g => [g.id, g.name]));
const nameOf = (departmentId, ccName) => (departmentId > 0 && groupNames.get(departmentId)) || (ccName || '').trim() || 'غير مصنّف';

// 1. Revenue / expenses
for (const r of db.prepare(`
  SELECT department_id, cost_center_key, MAX(cost_center_name) AS cc_name, SUM(revenue) AS rev, SUM(expense) AS exp
  FROM fact_daily
  WHERE company_id IN (${ledgerIds}) ${isAll ? '' : `AND date >= '${yearArg}-01-01' AND date <= '${yearArg}-12-31'`}
  GROUP BY department_id, cost_center_key
  HAVING SUM(revenue) != 0 OR SUM(expense) != 0
`).all()) {
  const x = row(deptKey(r.department_id, r.cost_center_key), nameOf(r.department_id, r.cc_name));
  x.revenue += r.rev;
  x.expenses += r.exp;
}

// 2. Cash collected in the period (by payment date), net of each invoice's VAT share
for (const r of db.prepare(`
  SELECT pa.department_id, pa.cost_center_key, MAX(pa.cost_center_name) AS cc_name,
    SUM(pa.amount) AS gross,
    SUM(pa.amount * si.amount_untaxed / si.amount_total) AS net
  FROM payment_allocations pa
  JOIN sales_invoices si ON si.company_id = pa.sales_company_id AND si.invoice_id = pa.invoice_id
  WHERE pa.company_id IN (${ledgerIds})
    AND pa.channel IN ('bank', 'sister_company', 'other_adjustment')
    AND si.amount_total != 0
    ${isAll ? '' : `AND substr(pa.payment_date, 1, 4) = '${yearArg}'`}
  GROUP BY pa.department_id, pa.cost_center_key
`).all()) {
  const x = row(deptKey(r.department_id, r.cost_center_key), nameOf(r.department_id, r.cc_name));
  x.cash_net += r.net;
  x.cash_gross += r.gross;
}

// 3. Invoices: period invoices (collected / remaining) and every open invoice up to the cut-off
for (const r of db.prepare(`
  SELECT d.department_id, d.cost_center_key, MAX(d.cost_center_name) AS cc_name,
    SUM(CASE WHEN ${isAll ? '1=1' : `substr(si.date, 1, 4) = '${yearArg}'`} AND si.amount_total != 0
      THEN si.amount_untaxed * (si.amount_total - si.amount_residual_signed) / si.amount_total * d.share ELSE 0 END) AS collected,
    SUM(CASE WHEN ${isAll ? '1=1' : `substr(si.date, 1, 4) = '${yearArg}'`} AND si.amount_total != 0
      THEN si.amount_untaxed * si.amount_residual_signed / si.amount_total * d.share ELSE 0 END) AS remaining,
    SUM(CASE WHEN ${isAll ? '1=1' : `substr(si.date, 1, 4) = '${yearArg}'`} THEN si.amount_residual_signed * d.share ELSE 0 END) AS residual_gross,
    SUM(CASE WHEN si.amount_total != 0 THEN si.amount_untaxed * si.amount_residual_signed / si.amount_total * d.share ELSE 0 END) AS open_untaxed,
    SUM(si.amount_residual_signed * d.share) AS open_gross
  FROM sales_invoices si
  JOIN invoice_departments d ON d.sales_invoice_id = si.id
  WHERE si.company_id IN (${salesIds}) ${cutoff ? `AND si.date <= '${cutoff}'` : ''}
  GROUP BY d.department_id, d.cost_center_key
`).all()) {
  if (!r.collected && !r.remaining && !r.residual_gross && !r.open_untaxed && !r.open_gross) continue;
  const x = row(deptKey(r.department_id, r.cost_center_key), nameOf(r.department_id, r.cc_name));
  x.collected += r.collected;
  x.remaining += r.remaining;
  x.residual_gross += r.residual_gross;
  x.open += r.open_untaxed;
  x.open_gross += r.open_gross;
}

// 4. The tab's own output
const engine = new ConsolidationEngine(db);
const api = engine.getDepartmentsComparison({ years: [isAll ? 'ALL' : yearArg], companyIds: companyArg ? [companyArg] : undefined });
const apiRows = new Map();
for (const d of api.tree) {
  const key = d.is_unmapped_cost_center ? `cc:${d.children[0].cost_center_key}` : `g:${d.department_id}`;
  apiRows.set(key, d);
}

const COLS = [
  ['revenue', 'revenue', 'الإيرادات'],
  ['expenses', 'expenses', 'المصروفات'],
  ['cash_net', 'cash_collected', 'النقد المحصَّل'],
  ['cash_gross', 'cash_collected_gross', 'النقد شامل الضريبة'],
  ['collected', 'collected_invoices', 'المحصَّل من فواتير الفترة'],
  ['remaining', 'remaining', 'المتبقي من فواتير الفترة'],
  ['residual_gross', 'residual_gross', 'المتبقي شامل الضريبة'],
  ['open', 'open_total', 'إجمالي المتبقي'],
  ['open_gross', 'open_total_gross', 'إجمالي المتبقي شامل الضريبة']
];
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const out = [];
let maxDiff = 0;
let bad = 0;
const totalsRaw = Object.fromEntries(COLS.map(c => [c[0], 0]));
for (const key of new Set([...rows.keys(), ...apiRows.keys()])) {
  const raw = rows.get(key) || row(key);
  const a = apiRows.get(key);
  const line = { القسم: (a ? a.name : names.get(key) || key).slice(0, 30) };
  let rowMax = 0;
  for (const [rk, ak, label] of COLS) {
    const apiVal = a ? a[ak] : 0;
    const diff = apiVal - raw[rk];
    totalsRaw[rk] += raw[rk];
    rowMax = Math.max(rowMax, Math.abs(diff));
    line[label] = `${fmt(apiVal)} | ${fmt(raw[rk])}`;
  }
  line['أكبر فرق'] = rowMax.toFixed(2);
  line['الحالة'] = rowMax <= ALLOWANCE ? 'مطابق' : 'فرق';
  if (rowMax > ALLOWANCE) bad++;
  maxDiff = Math.max(maxDiff, rowMax);
  out.push({ sort: a ? a.revenue : raw.revenue, line });
}
out.sort((x, y) => y.sort - x.sort);

console.log(`\nDC1 reconciliation — period ${isAll ? 'ALL' : yearArg}${companyArg ? `, company ${companyArg}` : ', all companies'} (each cell: tab | recomputed from tables)`);
console.table(out.map(o => o.line));

const totLine = {};
let totMax = 0;
for (const [rk, ak, label] of COLS) {
  const diff = api.totals[ak] - totalsRaw[rk];
  totMax = Math.max(totMax, Math.abs(diff));
  totLine[label] = `${fmt(api.totals[ak])} | ${totalsRaw[rk].toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
console.log('Totals (tab | recomputed, to the halala):');
console.table([totLine]);

// 5. Ledger cross-check: income / expense accounts in journal_items (posted) vs the tab totals
const ji = db.prepare(`
  SELECT
    SUM(CASE WHEN COALESCE(o.section, CASE WHEN ji.account_type LIKE 'income%' THEN 'income' WHEN ji.account_type LIKE 'expense%' THEN 'expense' END) = 'income' THEN ji.credit - ji.debit ELSE 0 END) AS rev,
    SUM(CASE WHEN COALESCE(o.section, CASE WHEN ji.account_type LIKE 'income%' THEN 'income' WHEN ji.account_type LIKE 'expense%' THEN 'expense' END) = 'expense' THEN ji.debit - ji.credit ELSE 0 END) AS exp
  FROM journal_items ji
  LEFT JOIN account_section_overrides o ON o.company_id = ji.company_id AND o.account_code = ji.account_code
  WHERE ji.move_state = 'posted' AND ji.company_id IN (${ledgerIds})
    ${isAll ? '' : `AND ji.date >= '${yearArg}-01-01' AND ji.date <= '${yearArg}-12-31'`}
`).get();
console.log(`Ledger (journal_items, income/expense accounts): revenue ${fmt(ji.rev || 0)} vs tab ${fmt(api.totals.revenue)} · expenses ${fmt(ji.exp || 0)} vs tab ${fmt(api.totals.expenses)}`);
const ledgerOk = Math.round(ji.rev || 0) === api.totals.revenue && Math.round(ji.exp || 0) === api.totals.expenses;

console.log(`\nDepartments: ${out.length} · largest department difference: ${maxDiff.toFixed(2)} SAR · largest total difference: ${totMax.toFixed(2)} SAR · departments beyond ${ALLOWANCE} SAR: ${bad} · ledger totals ${ledgerOk ? 'match' : 'DIFFER'}`);
process.exit(bad === 0 && totMax <= 1 && ledgerOk ? 0 : 1);
