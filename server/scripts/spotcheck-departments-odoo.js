/**
 * DC1 spot check against Odoo itself (read-only): for every department of the «مقارنة الأقسام» tab,
 * recompute from live Odoo records and compare with the tab.
 *
 *   - Revenue / expenses: posted account.move.line on income / expense accounts in the year, attributed to the
 *     department through the line's analytic distribution (Odoo data only; the mapping analytic account -> group is the app's setting).
 *   - Collected / remaining of the year's invoices and total remaining: account.move amounts read from Odoo now,
 *     attributed with the app's stored invoice -> department shares.
 *
 * «النقد المحصَّل في الفترة» (by payment date) is NOT recomputed here; it is tied to the collections tab by verify-data.
 * Usage: node server/scripts/spotcheck-departments-odoo.js [year]
 * Uses the credentials stored in the database; prints none of them. Writes nothing.
 */
const path = require('path');
const Database = require('better-sqlite3');
const OdooConnector = require('../services/odoo-connector');
const ConsolidationEngine = require('../services/consolidation');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'mizaniat.db');
const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
const year = process.argv[2] || String(new Date().getFullYear());
const fmt = (n) => Math.round(n).toLocaleString('en-US');

async function readAll(conn, model, domain, fields, ctx) {
  const out = [];
  const PAGE = 2000;
  for (let offset = 0; ; offset += PAGE) {
    const rows = await conn._rpcCall(model, 'search_read', [domain], { fields, limit: PAGE, offset, order: 'id', ...ctx });
    if (!rows || rows.length === 0) break;
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

(async () => {
  const quiet = console.log;
  const engine = new ConsolidationEngine(db);
  const tab = engine.getDepartmentsComparison({ years: [year] });
  const tabByKey = new Map();
  for (const d of tab.tree) tabByKey.set(d.is_unmapped_cost_center ? `cc:${d.children[0].cost_center_key}` : `g:${d.department_id}`, d);

  // (company, analytic account, income|expense) -> department key, from the app's stored attribution.
  // The app's mapping can depend on the journal, so one analytic account may sit in a group for its sales
  // and stand alone for its costs; the side (income / expense) is therefore part of the key.
  const ccDept = new Map();
  for (const r of db.prepare(`
    SELECT company_id, cost_center_key, section, department_id, SUM(ABS(revenue) + ABS(expense)) AS weight
    FROM fact_daily WHERE cost_center_key IS NOT NULL AND section IN ('income', 'expense')
    GROUP BY company_id, cost_center_key, section, department_id ORDER BY weight ASC`).all()) {
    ccDept.set(`${r.company_id}|${r.cost_center_key}|${r.section}`, r.department_id > 0 ? `g:${r.department_id}` : `cc:${r.cost_center_key}`);
  }
  const overrides = new Map(db.prepare('SELECT company_id, account_code, section FROM account_section_overrides').all().map(o => [`${o.company_id}|${o.account_code}`, o.section]));
  const odoo = new Map();
  const bucket = (k) => { if (!odoo.has(k)) odoo.set(k, { revenue: 0, expenses: 0, collected: 0, remaining: 0, open: 0 }); return odoo.get(k); };
  const notes = [];

  const instances = db.prepare('SELECT * FROM odoo_instances WHERE is_active = 1').all();
  for (const inst of instances) {
    console.log = () => {};
    const conn = new OdooConnector(inst.url, inst.username, inst.api_key, inst.db_name);
    const companies = db.prepare(`
      SELECT c.id, c.odoo_company_id, sc.id AS sales_cid FROM companies c
      JOIN sales_companies sc ON sc.sales_company_id = c.odoo_company_id
      WHERE c.odoo_instance_id = ? AND c.is_active = 1`).all(inst.id);
    for (const co of companies) {
      const ctx = { context: { allowed_company_ids: [co.odoo_company_id] } };

      // 1. P&L lines of the year
      const lines = await readAll(conn, 'account.move.line', [
        ['company_id', '=', co.odoo_company_id], ['parent_state', '=', 'posted'],
        ['date', '>=', `${year}-01-01`], ['date', '<=', `${year}-12-31`],
        ['display_type', 'not in', ['line_section', 'line_note']],
        '|', ['account_id.account_type', '=like', 'income%'], ['account_id.account_type', '=like', 'expense%']
      ], ['balance', 'analytic_distribution', 'account_id', 'account_type'], ctx);
      let unattributed = 0;
      for (const l of lines) {
        const code = String(l.account_id?.[1] || '').trim().split(/\s+/)[0];
        const section = overrides.get(`${co.id}|${code}`) || (String(l.account_type).startsWith('income') ? 'income' : 'expense');
        if (section !== 'income' && section !== 'expense') continue;
        const amount = section === 'income' ? -l.balance : l.balance;
        const dist = l.analytic_distribution && typeof l.analytic_distribution === 'object' ? Object.entries(l.analytic_distribution) : [];
        if (dist.length === 0) { unattributed += amount; continue; }
        for (const [ids, pct] of dist) {
          // a key may list several analytic accounts (one per plan); the app's cost center is the first one it knows
          const id = String(ids).split(',').map(s => s.trim()).find(a => ccDept.has(`${co.id}|an:${inst.id}:${a}|${section}`));
          const key = id ? ccDept.get(`${co.id}|an:${inst.id}:${id}|${section}`) : null;
          if (!key) { unattributed += amount * (pct / 100); continue; }
          bucket(key)[section === 'income' ? 'revenue' : 'expenses'] += amount * (pct / 100);
        }
      }
      if (Math.abs(unattributed) >= 0.5) notes.push(`company ${co.id}: ${fmt(unattributed)} SAR of ${year} P&L lines carry no analytic account known to the app`);

      // 2. Customer invoices: the year's invoices and every open one up to the end of the year
      const moves = await readAll(conn, 'account.move', [
        ['company_id', '=', co.odoo_company_id], ['state', '=', 'posted'], ['move_type', 'in', ['out_invoice', 'out_refund']],
        ['invoice_date', '<=', `${year}-12-31`],
        '|', ['invoice_date', '>=', `${year}-01-01`], ['amount_residual', '!=', 0]
      ], ['invoice_date', 'amount_untaxed_signed', 'amount_total_signed', 'amount_residual_signed'], ctx);
      const shares = db.prepare(`
        SELECT si.invoice_id, d.department_id, d.cost_center_key, d.share
        FROM sales_invoices si JOIN invoice_departments d ON d.sales_invoice_id = si.id
        WHERE si.company_id = ?`).all(co.sales_cid);
      const sharesByInvoice = new Map();
      for (const s of shares) { if (!sharesByInvoice.has(s.invoice_id)) sharesByInvoice.set(s.invoice_id, []); sharesByInvoice.get(s.invoice_id).push(s); }
      let unknownInvoices = 0;
      for (const m of moves) {
        const sh = sharesByInvoice.get(m.id);
        if (!sh) { unknownInvoices++; continue; }
        const total = m.amount_total_signed, untaxed = m.amount_untaxed_signed, residual = m.amount_residual_signed;
        const inYear = String(m.invoice_date).slice(0, 4) === year;
        for (const s of sh) {
          const b = bucket(s.department_id > 0 ? `g:${s.department_id}` : `cc:${(s.cost_center_key || '').trim()}`);
          if (total !== 0) {
            const remainingUntaxed = untaxed * residual / total * s.share;
            if (inYear) { b.collected += untaxed * (total - residual) / total * s.share; b.remaining += remainingUntaxed; }
            b.open += remainingUntaxed;
          }
        }
      }
      if (unknownInvoices > 0) notes.push(`company ${co.id}: ${unknownInvoices} Odoo invoice(s) not in the app yet (created after the last sync)`);
    }
    console.log = quiet;
  }

  const COLS = [['revenue', 'revenue', 'الإيرادات'], ['expenses', 'expenses', 'المصروفات'], ['collected', 'collected_invoices', 'المحصَّل من فواتير الفترة'], ['remaining', 'remaining', 'المتبقي من فواتير الفترة'], ['open', 'open_total', 'إجمالي المتبقي']];
  const rows = [];
  let worst = 0;
  for (const key of new Set([...tabByKey.keys(), ...odoo.keys()])) {
    const t = tabByKey.get(key);
    const o = odoo.get(key) || bucket(key);
    const line = { القسم: (t ? t.name : key).slice(0, 30) };
    let rowMax = 0;
    for (const [ok, tk, label] of COLS) {
      const tv = t ? t[tk] : 0;
      rowMax = Math.max(rowMax, Math.abs(tv - o[ok]));
      line[label] = `${fmt(tv)} | ${fmt(o[ok])}`;
    }
    line['أكبر فرق'] = fmt(rowMax);
    worst = Math.max(worst, rowMax);
    rows.push({ sort: t ? t.revenue : 0, line });
  }
  rows.sort((a, b) => b.sort - a.sort);
  console.log(`\nDC1 spot check against Odoo — ${year} (each cell: tab | Odoo now)`);
  console.table(rows.map(r => r.line));
  const sync = db.prepare(`SELECT MAX(completed_at) AS t FROM sync_logs WHERE sync_type = 'payment_allocations' AND status = 'completed'`).get();
  console.log(`Last completed sync in this database copy: ${sync && sync.t ? sync.t : 'unknown'} · largest department difference: ${fmt(worst)} SAR (Odoo records created after that sync are not in the tab yet)`);
  for (const n of notes) console.log('note: ' + n);
})().catch(e => { console.log = console.info; console.error('spot check failed:', String(e.message).slice(0, 300)); process.exit(1); });
