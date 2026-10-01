/**
 * Data & report correctness checks — read-only.
 * Run after every sync or report-logic change:  npm run verify
 *
 * Each check prints PASS / FAIL. Exit code 1 if any non-accepted check fails.
 * KNOWN_ODOO_ISSUES lists differences that exist in Odoo itself (not app bugs);
 * remove an entry once the accountant fixes it in Odoo.
 */
const { getDb } = require('../db/connection');
const ConsolidationEngine = require('../services/consolidation');

const KNOWN_ODOO_ISSUES = {
  // company_id: expected debit-credit difference (SAR) and why
  // (none) - INVJ/2025/00117 revenue line restored in Odoo on 2026-09-30
};

const db = getDb();
const engine = new ConsolidationEngine();
const today = new Date().toISOString().slice(0, 10);
const yearStart = `${today.slice(0, 4)}-01-01`;
const round = (n) => Math.round((n || 0) * 100) / 100;
const companies = db.prepare('SELECT id, name, odoo_company_id FROM companies WHERE is_active = 1 ORDER BY id').all();

let failures = 0;
function check(name, ok, detail = '', accepted = false) {
  const tag = ok ? 'PASS' : (accepted ? 'KNOWN' : 'FAIL');
  if (!ok && !accepted) failures++;
  console.log(`[${tag}] ${name}${detail ? ' — ' + detail : ''}`);
}

// 1. Only posted data is stored
const nonPosted = db.prepare("SELECT COUNT(*) n FROM journal_items WHERE move_state != 'posted'").get().n;
check('journal_items: posted entries only', nonPosted === 0, `${nonPosted} non-posted lines`);
const nonPostedSales = db.prepare("SELECT COUNT(*) n FROM sales_invoices WHERE LOWER(state) != 'posted'").get().n;
check('sales_invoices: posted invoices only', nonPostedSales === 0, `${nonPostedSales} non-posted invoices`);

// 2. No corrupted Arabic text (U+FFFD)
const corrupted = db.prepare(`SELECT COUNT(*) n FROM journal_items
  WHERE instr(account_name || partner_name || label || journal_name, char(65533)) > 0`).get().n;
check('journal_items: no corrupted text', corrupted === 0, `${corrupted} lines`);

// 3. Real entry numbers (no synthetic AUTO/ names)
const synthetic = db.prepare("SELECT COUNT(*) n FROM journal_items WHERE move_name LIKE 'AUTO/%'").get().n;
check('journal_items: real entry numbers', synthetic === 0, `${synthetic} synthetic`);

// 4. Guarantee records all linked to an existing entry
const orphanSub = db.prepare(`SELECT COUNT(*) n FROM guarantee_sub_items gs WHERE NOT EXISTS (
  SELECT 1 FROM journal_items ji WHERE ji.company_id = gs.parent_company_id
    AND ji.account_code = gs.parent_account_code AND ji.move_name = gs.parent_move_name)`).get().n;
const orphanRel = db.prepare(`SELECT COUNT(*) n FROM guarantee_releases gr WHERE NOT EXISTS (
  SELECT 1 FROM journal_items ji WHERE ji.company_id = gr.company_id
    AND ji.account_code = gr.account_code AND ji.move_name = gr.move_name)`).get().n;
check('guarantees: all linked to entries', orphanSub + orphanRel === 0, `${orphanSub} sub-items, ${orphanRel} releases unlinked`);

for (const c of companies) {
  console.log(`\n── Company ${c.id}: ${c.name}`);

  // 5. Debits = credits
  const dc = db.prepare("SELECT SUM(debit) - SUM(credit) diff FROM journal_items WHERE company_id = ? AND move_state = 'posted'").get(c.id);
  const diff = round(dc.diff);
  const known = KNOWN_ODOO_ISSUES[c.id];
  check('debit = credit', Math.abs(diff) < 0.01, `diff ${diff}`, known && Math.abs(diff - known.diff) < 0.01);
  if (known && Math.abs(diff - known.diff) < 0.01) console.log(`        (known Odoo issue: ${known.reason})`);

  // 6. Balance sheet: assets = liabilities + equity (equity must include earnings)
  const bs = engine.getBalanceSheet({ companyIds: [c.id], asOfDate: today });
  const s = bs.summary;
  const gap = round(s.totalAssets - (s.totalLiabilities + s.totalEquity));
  const bsAccepted = known && Math.abs(gap - known.diff) < 0.01;
  check('balance sheet balances', Math.abs(gap) < 0.01, `assets ${round(s.totalAssets)} vs liab+equity ${round(s.totalLiabilities + s.totalEquity)} (gap ${gap})`, bsAccepted);

  // 7. Trial balance: income/expense accounts open each fiscal year at zero
  const tb = engine.getTrialBalance({ companyId: c.id, dateFrom: yearStart, dateTo: today });
  const plOpening = tb.accounts
    .filter(a => /^(income|expense)/.test(a.account_type || ''))
    .reduce((sum, a) => sum + a.open_debit - a.open_credit, 0);
  check('trial balance: P&L accounts open at zero', Math.abs(plOpening) < 0.01, `net P&L opening ${round(plOpening)}`);

  // 8. Trial balance closing columns balance
  const tbNet = tb.accounts.reduce((sum, a) => sum + a.close_debit - a.close_credit, 0);
  check('trial balance: closing balanced', Math.abs(tbNet) < 0.01, `net ${round(tbNet)}`, known && Math.abs(round(tbNet) - known.diff) < 0.01);

  // 9. Dashboard assets = balance-sheet assets at the period end (balances, not movements)
  const kpi = engine.getDashboardKPIs({ companyIds: [c.id], dateFrom: yearStart, dateTo: today });
  check('dashboard: total assets = balance sheet', Math.abs(round(kpi.totalAssets) - round(s.totalAssets)) < 0.01,
    `dashboard ${round(kpi.totalAssets)} vs balance sheet ${round(s.totalAssets)}`);

  // 10. Cash flow: opening cash + net flow = closing cash
  const cf = engine.getCashFlow({ companyIds: [c.id], dateFrom: yearStart, dateTo: today });
  const cfNet = (cf.operating.reduce((sum, i) => sum + i.amount, 0) +
                 cf.investing.reduce((sum, i) => sum + i.amount, 0) +
                 cf.financing.reduce((sum, i) => sum + i.amount, 0));
  const cfOpen = cf.summary ? cf.summary.openingCash : 0;
  const cfClose = cf.summary ? cf.summary.closingCash : 0;
  const cfDiff = round(cfOpen + cfNet - cfClose);
  check('cash flow: opening + net flow = closing', Math.abs(cfDiff) < 0.01,
    `open ${round(cfOpen)} + net ${round(cfNet)} vs close ${round(cfClose)} (diff ${cfDiff})`);

  // 11. Presentation: KPIs match single source of truth (income statement, balance sheet, cash)
  const pkpi = engine.getPresentationKPIs({ companyId: c.id, dateFrom: yearStart, dateTo: today });
  const isRev = engine.getIncomeStatement({ companyIds: [c.id], dateFrom: yearStart, dateTo: today }).summary.totalRevenue;
  const isExp = engine.getIncomeStatement({ companyIds: [c.id], dateFrom: yearStart, dateTo: today }).summary.totalExpenses;
  const pCash = engine.db.prepare(`
    SELECT COALESCE(SUM(debit - credit), 0) as total 
    FROM journal_items ji
    WHERE company_id = ? AND date <= ? AND ${engine._cashFilter('ji')} AND move_state = 'posted'
  `).get(c.id, today).total;

  const revMatch = Math.abs(round(pkpi.revenue) - round(isRev)) < 0.01;
  const expMatch = Math.abs(round(pkpi.expenses) - round(isExp)) < 0.01;
  const astMatch = Math.abs(round(pkpi.assets) - round(s.totalAssets)) < 0.01;
  const liabMatch = Math.abs(round(pkpi.liabilities) - round(s.totalLiabilities)) < 0.01;
  const cashMatch = Math.abs(round(pkpi.cash) - round(pCash)) < 0.01;

  check('presentation: KPIs match financial reports', revMatch && expMatch && astMatch && liabMatch && cashMatch,
    `rev ${round(pkpi.revenue)}==${round(isRev)}, exp ${round(pkpi.expenses)}==${round(isExp)}, ast ${round(pkpi.assets)}==${round(s.totalAssets)}, liab ${round(pkpi.liabilities)}==${round(s.totalLiabilities)}, cash ${round(pkpi.cash)}==${round(pCash)}`);

  // 11b. Bank guarantees separation (F1): cash + guarantees = raw asset_cash
  const rawCash = engine.db.prepare(`
    SELECT COALESCE(SUM(debit - credit), 0) as total 
    FROM journal_items 
    WHERE company_id = ? AND date <= ? AND account_type = 'asset_cash' AND move_state = 'posted'
  `).get(c.id, today).total;
  const cashGuarSum = round(pkpi.cash + pkpi.guarantees);
  const rawCashDiff = Math.abs(cashGuarSum - round(rawCash));
  check('guarantees separation: cash + guarantees = raw asset_cash', rawCashDiff < 0.01,
    `cash ${round(pkpi.cash)} + guar ${round(pkpi.guarantees)} = ${cashGuarSum} vs raw ${round(rawCash)} (diff ${round(rawCashDiff)})`);

  // 12. Accurate collection metrics (F2): billed, collected, remaining match independent calculation
  const pCheck = { companyId: c.id, dateFrom: yearStart, dateTo: today };
  engine.db.exec(`
    CREATE TEMP TABLE IF NOT EXISTS _chk_inc_moves (company_id INTEGER, move_name TEXT, PRIMARY KEY(company_id, move_name));
    CREATE TEMP TABLE IF NOT EXISTS _chk_csh_moves (company_id INTEGER, move_name TEXT, PRIMARY KEY(company_id, move_name));
    DELETE FROM _chk_inc_moves;
    DELETE FROM _chk_csh_moves;
  `);
  engine.db.prepare(`
    INSERT OR IGNORE INTO _chk_inc_moves (company_id, move_name)
    SELECT DISTINCT ji.company_id, ji.move_name
    FROM journal_items ji
    ${engine._sectionJoin('ji', 'o')}
    WHERE ji.company_id = @companyId AND ji.move_state = 'posted'
      AND ${engine._sectionExpr('ji', 'o')} = 'income' AND ji.date >= @dateFrom AND ji.date <= @dateTo
  `).run(pCheck);
  engine.db.prepare(`
    INSERT OR IGNORE INTO _chk_csh_moves (company_id, move_name)
    SELECT DISTINCT ji.company_id, ji.move_name
    FROM journal_items ji
    WHERE ji.company_id = @companyId AND ji.move_state = 'posted'
      AND ${engine._cashFilter('ji')} AND ji.date >= @dateFrom AND ji.date <= @dateTo
  `).run(pCheck);

  const indBilled = engine.db.prepare(`
    SELECT COALESCE(SUM(ji.debit - ji.credit), 0) as total
    FROM journal_items ji
    JOIN _chk_inc_moves im ON im.company_id = ji.company_id AND im.move_name = ji.move_name
    WHERE ji.company_id = @companyId AND ji.account_type = 'asset_receivable'
      AND ji.move_state = 'posted' AND ji.date >= @dateFrom AND ji.date <= @dateTo
  `).get(pCheck).total;

  const indCollected = engine.db.prepare(`
    SELECT COALESCE(SUM(ji.credit - ji.debit), 0) as total
    FROM journal_items ji
    JOIN _chk_csh_moves cm ON cm.company_id = ji.company_id AND cm.move_name = ji.move_name
    WHERE ji.company_id = @companyId AND ji.account_type = 'asset_receivable'
      AND ji.move_state = 'posted' AND ji.date >= @dateFrom AND ji.date <= @dateTo
  `).get(pCheck).total;

  const indRemaining = engine.db.prepare(`
    SELECT COALESCE(SUM(ji.debit - ji.credit), 0) as total
    FROM journal_items ji
    WHERE ji.company_id = @companyId AND ji.account_type = 'asset_receivable'
      AND ji.move_state = 'posted' AND ji.date <= @dateTo
  `).get(pCheck).total;

  const billedMatch = Math.abs(round(pkpi.billed) - round(indBilled)) < 0.01;
  const collMatch = Math.abs(round(pkpi.collected) - round(indCollected)) < 0.01;
  const remMatch = Math.abs(round(pkpi.remaining) - round(indRemaining)) < 0.01;

  check('collection: billed, collected & remaining accurate', billedMatch && collMatch && remMatch,
    `billed ${round(pkpi.billed)}==${round(indBilled)}, collected ${round(pkpi.collected)}==${round(indCollected)}, remaining ${round(pkpi.remaining)}==${round(indRemaining)} (rate ${(pkpi.collectionRate||0).toFixed(1)}%)`);

  // 13. Detailed trial balance by partner (T6b): account totals match general trial balance
  const dtb = engine.getDetailedTrialBalance({ companyId: c.id, dateFrom: yearStart, dateTo: today });
  const tbMap = Object.fromEntries(tb.accounts.map(a => [a.account_code, (a.close_debit - a.close_credit)]));
  const dtbMap = {};
  for (const row of dtb.accounts) {
    dtbMap[row.account_code] = (dtbMap[row.account_code] || 0) + (row.close_debit - row.close_credit);
  }
  let dtbMatch = true;
  let dtbDiffMax = 0;
  for (const [code, net] of Object.entries(dtbMap)) {
    const tbNet = tbMap[code] || 0;
    const diff = Math.abs(net - tbNet);
    if (diff > 0.01) {
      dtbMatch = false;
      dtbDiffMax = Math.max(dtbDiffMax, diff);
    }
  }
  check('detailed trial balance: partner sums match trial balance', dtbMatch,
    `${Object.keys(dtbMap).length} accounts verified (max diff ${round(dtbDiffMax)})`);

  // 14. Sales invoices & refunds integrity (S1)
  const sc = engine.db.prepare('SELECT id FROM sales_companies WHERE sales_company_id = ?').get(c.odoo_company_id);
  if (sc) {
    // 14a. No non-sales entries (MISC, PBNK, BNK, TA, PCSH)
    const nonSales = engine.db.prepare(`
      SELECT count(*) as cnt FROM sales_invoices
      WHERE company_id = ? AND (name LIKE 'MISC%' OR name LIKE 'PBNK%' OR name LIKE 'BNK%' OR name LIKE 'TA%' OR name LIKE 'PCSH%')
    `).get(sc.id).cnt;
    check('sales_invoices: no non-sales entries', nonSales === 0, `${nonSales} non-sales entries found`);

    // 14b. Per-document amounts match journal receivables net (V1)
    const mismatchCount = engine.db.prepare(`
      WITH ji_recv AS (
        SELECT move_name, SUM(debit - credit) as net
        FROM journal_items
        WHERE company_id = ? AND account_type = 'asset_receivable' AND move_state = 'posted'
        GROUP BY move_name
      )
      SELECT COUNT(*) as cnt
      FROM sales_invoices si
      JOIN ji_recv ji ON ji.move_name = si.name
      WHERE si.company_id = ? AND ABS(si.amount_total - ji.net) > 0.01
    `).get(c.id, sc.id).cnt;
    check('sales_invoices: per-document amounts match journal receivables', mismatchCount === 0,
      `${mismatchCount} document amount mismatches`);

    // Informative report (non-failing): ledger moves with income + receivable not in sales_invoices
    const unlinked = engine.db.prepare(`
      SELECT ji.move_name,
             SUBSTR(ji.move_name, 1, INSTR(ji.move_name, '/') - 1) as prefix
      FROM journal_items ji
      WHERE ji.company_id = ? AND ji.move_state = 'posted'
      GROUP BY ji.move_name
      HAVING SUM(CASE WHEN ji.account_type LIKE 'income%' THEN 1 ELSE 0 END) > 0
         AND SUM(CASE WHEN ji.account_type = 'asset_receivable' THEN 1 ELSE 0 END) > 0
         AND ji.move_name NOT IN (SELECT name FROM sales_invoices WHERE company_id = ?)
    `).all(c.id, sc.id);
    if (unlinked.length > 0) {
      const prefixes = [...new Set(unlinked.map(u => u.prefix || 'none'))].join(', ');
      console.log(`        (info: ${unlinked.length} ledger move(s) with income+receivable not in sales_invoices: ${prefixes})`);
    }
  }
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
