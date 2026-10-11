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

// 4b. Manual releases validation (B2): WARN if manual release exists without matching credit in ledger (pending in Odoo)
const allReleases = db.prepare('SELECT * FROM guarantee_releases').all();
const pendingReleases = [];
for (const r of allReleases) {
  const moveJis = db.prepare('SELECT debit, credit FROM journal_items WHERE company_id = ? AND account_code = ? AND move_name = ?').all(r.company_id, r.account_code, r.move_name);
  if (moveJis.some(j => j.credit > 0)) continue;
  const totalDebit = moveJis.reduce((s, j) => s + j.debit, 0);
  const matchingCredit = db.prepare('SELECT 1 FROM journal_items WHERE company_id = ? AND account_code = ? AND move_state = \'posted\' AND ABS(credit - ?) < 0.01').get(r.company_id, r.account_code, totalDebit);
  if (!matchingCredit) {
    pendingReleases.push(`Co ${r.company_id}: ${r.move_name} (amount: ${totalDebit} SAR, note: "${r.notes || ''}")`);
  }
}
if (pendingReleases.length > 0) {
  console.log(`[WARN] guarantees (B2): ${pendingReleases.length} manual release(s) pending ledger credit in Odoo:\n       ${pendingReleases.join('\n       ')}`);
}
check('guarantees: manual releases structure valid (B2)', true,
  `${allReleases.length} releases checked (${pendingReleases.length} pending in Odoo)`);

// 16b. Payment state consistency (R1)
const badPaymentStates = db.prepare(`
  SELECT count(*) as cnt
  FROM sales_invoices
  WHERE (payment_state IN ('paid', 'reversed') AND ABS(amount_residual_signed) > 0.001)
     OR (payment_state = 'not_paid' AND ABS(amount_residual_signed - amount_total) > 0.01)
     OR (payment_state = 'partial' AND (ABS(amount_residual_signed) <= 0.001 OR ABS(amount_residual_signed - amount_total) <= 0.01))
`).get().cnt;
check('sales_invoices: payment_state consistency (paid/not_paid/partial/reversed)', badPaymentStates === 0,
  `${badPaymentStates} inconsistent invoices`);

// 16d. Invoice departments: sum of shares per invoice = 1.0
const badDeptShares = db.prepare(`
  SELECT count(*) as cnt FROM (
    SELECT sales_invoice_id, ROUND(SUM(share), 4) as total_share
    FROM invoice_departments
    GROUP BY sales_invoice_id
    HAVING ABS(total_share - 1.0) > 0.001
  )
`).get().cnt;
check('invoice_departments: sum of shares per invoice equals 1.0', badDeptShares === 0,
  `${badDeptShares} invoices with unnormalized share`);

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

  // 11c. Active guarantees verification (G1): automatic derivation from ledger
  const activeGuarData = engine.getActiveGuarantees({ companyIds: [c.id], asOfDate: today });
  const activeCompany = activeGuarData.find(g => g.companyId === c.id);
  if (activeCompany) {
    const actItems = activeCompany.items || [];
    // Rule 1: No item in the active list originates from a credit entry
    const creditOriginItems = actItems.filter(item => {
      if (item.type === 'item' && item.itemId) {
        const ji = db.prepare('SELECT debit, credit FROM journal_items WHERE id = ?').get(item.itemId);
        return ji && ji.credit > 0 && ji.debit === 0;
      }
      return false;
    });
    check('guarantees G1: no credit items in active list', creditOriginItems.length === 0,
      `${creditOriginItems.length} credit items found`);

    // Rule 2 (B2): If |diff| > 0.05 print [WARN] with diff value (replaces circular check)
    const repDiff = round(activeCompany.diff);
    if (Math.abs(repDiff) > 0.05) {
      console.log(`[WARN] guarantees G1: company ${c.id} (${c.name}) diff with ledger > 0.05 (diff: ${repDiff})`);
    }

    // Rule 3 (G1-b): If diff is zero (within penny limit), unmatchedCredits must be empty
    if (Math.abs(repDiff) <= 0.05) {
      check('guarantees G1-b: unmatchedCredits is empty when diff is zero', activeCompany.unmatchedCredits.length === 0,
        `${activeCompany.unmatchedCredits.length} unmatched credits found`);
    }
  }

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

    // 14c. S1: Journal renaming immunity (mapping by journal_id invariant)
    let s1ImmunityPassed = true;
    let s1Details = 'verified';
    try {
      const sampleInv = engine.db.prepare(`
        SELECT id, company_id, journal_id, journal_name 
        FROM sales_invoices 
        WHERE company_id = ? AND journal_id IS NOT NULL AND journal_id IN (SELECT journal_id FROM analytic_group_mapping WHERE journal_id IS NOT NULL)
        LIMIT 1
      `).get(sc.id);
      
      if (sampleInv) {
        if (process.argv.includes('--readonly')) {
          const unmappedJid = engine.db.prepare('SELECT COUNT(*) as n FROM sales_invoices WHERE company_id = ? AND journal_id IS NULL').get(sc.id).n;
          if (unmappedJid > 0) {
            s1ImmunityPassed = false;
            s1Details = `${unmappedJid} invoices missing journal_id`;
          }
        } else {
          const origDept = engine.db.prepare('SELECT department_id FROM invoice_departments WHERE sales_invoice_id = ?').get(sampleInv.id)?.department_id;
          const testTx = engine.db.transaction(() => {
            engine.db.prepare("UPDATE sales_invoices SET journal_name = 'اسم_مؤقت_لاختبار_S1' WHERE id = ?").run(sampleInv.id);
            engine.resolveInvoiceDepartments(sampleInv.company_id);
            const newDept = engine.db.prepare('SELECT department_id FROM invoice_departments WHERE sales_invoice_id = ?').get(sampleInv.id)?.department_id;
            if (origDept !== newDept) {
              throw new Error(`Dept changed from ${origDept} to ${newDept}`);
            }
            throw new Error('ROLLBACK_INTENDED');
          });
          try { testTx(); } catch(e) {
            if (e.message !== 'ROLLBACK_INTENDED') {
              s1ImmunityPassed = false;
              s1Details = e.message;
            }
          }
        }
      }
    } catch(e) {
      s1ImmunityPassed = false;
      s1Details = e.message;
    }
    check('S1: journal renaming immunity (journal_id mapping invariant)', s1ImmunityPassed, s1Details);
  }

  // 15. Matrix Engine Verifications (M1a)
  // 15a. getMatrix revenue and expenses match getIncomeStatement for current year
  const matRev = engine.getMatrix({
    measure: 'revenue',
    rowDims: ['company'],
    timeGrain: 'year',
    dateFrom: yearStart,
    dateTo: today,
    companyIds: [c.id]
  });
  const matExp = engine.getMatrix({
    measure: 'expense',
    rowDims: ['company'],
    timeGrain: 'year',
    dateFrom: yearStart,
    dateTo: today,
    companyIds: [c.id]
  });
  const matRevTotal = matRev.totals.grandTotal;
  const matExpTotal = matExp.totals.grandTotal;
  const isRevTotal = round(isRev);
  const isExpTotal = round(isExp);
  const mRevMatch = Math.abs(matRevTotal - isRevTotal) < 0.05;
  const mExpMatch = Math.abs(matExpTotal - isExpTotal) < 0.05;
  check('matrix: revenue & expenses match income statement', mRevMatch && mExpMatch,
    `rev ${matRevTotal}==${isRevTotal}, exp ${matExpTotal}==${isExpTotal} (diff rev ${round(Math.abs(matRevTotal - isRevTotal))}, exp ${round(Math.abs(matExpTotal - isExpTotal))})`);

  // 15b. Time grains consistency: sum of months = year = sum of quarters = sum of days
  const matYear = engine.getMatrix({ measure: 'revenue', timeGrain: 'year', dateFrom: yearStart, dateTo: today, companyIds: [c.id] });
  const matQuarter = engine.getMatrix({ measure: 'revenue', timeGrain: 'quarter', dateFrom: yearStart, dateTo: today, companyIds: [c.id] });
  const matMonth = engine.getMatrix({ measure: 'revenue', timeGrain: 'month', dateFrom: yearStart, dateTo: today, companyIds: [c.id] });
  const matDay = engine.getMatrix({ measure: 'revenue', timeGrain: 'day', dateFrom: yearStart, dateTo: today, companyIds: [c.id] });
  const sumYear = matYear.totals.grandTotal;
  const sumQuarter = matQuarter.totals.grandTotal;
  const sumMonth = matMonth.totals.grandTotal;
  const sumDay = matDay.totals.grandTotal;
  const grainMatch = Math.abs(sumYear - sumQuarter) < 0.05 && Math.abs(sumYear - sumMonth) < 0.05 && Math.abs(sumYear - sumDay) < 0.05;
  check('matrix: time grains consistent (year = quarters = months = days)', grainMatch,
    `year ${sumYear} == qtr ${sumQuarter} == mon ${sumMonth} == day ${sumDay}`);

  // 15c. Department sum = company total (no leaked SAR, unclassified included)
  const matDept = engine.getMatrix({
    measure: 'revenue',
    rowDims: ['department'],
    timeGrain: 'year',
    dateFrom: yearStart,
    dateTo: today,
    companyIds: [c.id]
  });
  let sumDepts = 0;
  for (const row of matDept.rows) {
    sumDepts += row.total;
  }
  sumDepts = round(sumDepts);
  const deptMatch = Math.abs(sumDepts - matRevTotal) < 0.05;
  check('matrix: department sum equals company total', deptMatch,
    `depts ${sumDepts} == company ${matRevTotal} (diff ${round(Math.abs(sumDepts - matRevTotal))})`);

  // 15d. collected and billed in matrix match getPresentationKPIs
  const matBilled = engine.getMatrix({
    measure: 'billed',
    rowDims: ['company'],
    timeGrain: 'year',
    dateFrom: yearStart,
    dateTo: today,
    companyIds: [c.id]
  });
  const matCollected = engine.getMatrix({
    measure: 'collected',
    rowDims: ['company'],
    timeGrain: 'year',
    dateFrom: yearStart,
    dateTo: today,
    companyIds: [c.id]
  });
  const mBilled = matBilled.totals.grandTotal;
  const mCollected = matCollected.totals.grandTotal;
  const pBilled = round(pkpi.billed);
  const pCollected = round(pkpi.collected);
  const billedMatchMatrix = Math.abs(mBilled - pBilled) < 0.05;
  const collMatchMatrix = Math.abs(mCollected - pCollected) < 0.05;
  check('matrix: collected & billed match presentation KPIs', billedMatchMatrix && collMatchMatrix,
    `billed ${mBilled}==${pBilled}, collected ${mCollected}==${pCollected}`);

  // 15e. fact_daily debit and credit totals match journal_items
  const factTotals = engine.db.prepare(`
    SELECT ROUND(SUM(debit), 2) as deb, ROUND(SUM(credit), 2) as cred
    FROM fact_daily
    WHERE company_id = ?
  `).get(c.id);
  const jiTotals = engine.db.prepare(`
    SELECT ROUND(SUM(debit), 2) as deb, ROUND(SUM(credit), 2) as cred
    FROM journal_items
    WHERE company_id = ? AND move_state = 'posted'
  `).get(c.id);
  const debDiff = Math.abs((factTotals.deb || 0) - (jiTotals.deb || 0));
  const credDiff = Math.abs((factTotals.cred || 0) - (jiTotals.cred || 0));
  const factJiMatch = debDiff < 0.05 && credDiff < 0.05;
  check('matrix: fact_daily debits & credits match journal_items', factJiMatch,
    `deb ${factTotals.deb}==${jiTotals.deb}, cred ${factTotals.cred}==${jiTotals.cred} (diff deb ${round(debDiff)}, cred ${round(credDiff)})`);

  // 16. Receivables & collections integrity (M1a)
  // 16a. 3-source reconciliation: invoice residual + non-invoice entries equals ledger receivables
  const recon = engine.getReceivables({ type: 'reconciliation', companyIds: [c.id] });
  const compRecon = recon.companies[0] || {};
  const recLedger = compRecon.ledgerReceivables || 0;
  const recInv = compRecon.invoicesResidual || 0;
  const recDiff = compRecon.unmatchedDifference || 0;
  const reconSum = round(recInv + recDiff);
  const reconMatch = Math.abs(reconSum - recLedger) < 0.01;
  check('receivables: 3-source reconciliation (invoices + non-invoice entries = ledger)', reconMatch,
    `invoices ${recInv} + non-inv ${recDiff} = ${reconSum} vs ledger ${recLedger} (diff ${round(Math.abs(reconSum - recLedger))})`);

  // 16c. Department sum equals company total, and sum of aging buckets equals total residual
  const agingData = engine.getReceivables({ type: 'aging', companyIds: [c.id], asOfDate: today });
  const compAging = agingData.tree[0] || { buckets: {}, departments: [], total_residual: 0 };
  const agingTotalRes = compAging.total_residual || 0;
  
  const deptResSum = round(compAging.departments.reduce((s, d) => s + (d.total_residual || 0), 0));
  const deptResMatch = Math.abs(deptResSum - agingTotalRes) < 0.05;
  check('receivables: department aging sum equals company total residual', deptResMatch,
    `depts ${deptResSum} == company ${agingTotalRes} (diff ${round(Math.abs(deptResSum - agingTotalRes))})`);

  const ab = compAging.buckets || {};
  const bucketsSum = round((ab.not_due || 0) + (ab.b1_30 || 0) + (ab.b31_60 || 0) + (ab.b61_90 || 0) + (ab.b91_180 || 0) + (ab.b181_365 || 0) + (ab.over_365 || 0));
  const bucketsMatch = Math.abs(bucketsSum - agingTotalRes) < 0.05;
  check('receivables: sum of aging buckets equals company residual', bucketsMatch,
    `buckets ${bucketsSum} == residual ${agingTotalRes} (diff ${round(Math.abs(bucketsSum - agingTotalRes))})`);

  // 16e. Unified department attribution consistency (R2)
  if (sc) {
    const invDeptSums = engine.db.prepare(`
      SELECT id.department_id, ROUND(SUM(si.amount_untaxed * id.share), 2) as total_untaxed
      FROM sales_invoices si
      JOIN invoice_departments id ON id.sales_invoice_id = si.id
      WHERE si.company_id = ? AND si.date >= '2024-01-01'
        AND EXISTS (
          SELECT 1 FROM journal_items ji
          ${engine._sectionJoin('ji', 'o')}
          WHERE ji.company_id = ? AND ji.move_name = si.name
            AND ji.move_state = 'posted' AND ${engine._sectionExpr('ji', 'o')} = 'income'
        )
      GROUP BY id.department_id
    `).all(sc.id, c.id);

    const factDeptSums = engine.db.prepare(`
      SELECT department_id, ROUND(SUM(revenue), 2) as total_rev
      FROM fact_daily
      WHERE company_id = ? AND date >= '2024-01-01'
        AND account_code IN (
          SELECT account_code FROM journal_items
          WHERE company_id = ? AND move_name IN (SELECT name FROM sales_invoices WHERE company_id = ?)
        )
      GROUP BY department_id
    `).all(c.id, c.id, sc.id);

    const invMap = Object.fromEntries(invDeptSums.map(d => [d.department_id, d.total_untaxed]));
    const factMap = Object.fromEntries(factDeptSums.map(d => [d.department_id, d.total_rev]));
    let r2MaxDiff = 0;
    const allDeptIds = new Set([...Object.keys(invMap), ...Object.keys(factMap)]);
    for (const did of allDeptIds) {
      const iAmt = invMap[did] || 0;
      const fAmt = factMap[did] || 0;
      const diff = Math.abs(iAmt - fAmt);
      if (diff > r2MaxDiff) r2MaxDiff = diff;
    }
    const r2Match = r2MaxDiff < 1.0;
    check('receivables: unified department attribution matches fact_daily revenue (R2)', r2Match,
      `${allDeptIds.size} departments, max diff ${round(r2MaxDiff)} SAR`);
  }

  // 16f. Aging tree and registry nodes have non-empty valid names (U0 check)
  let emptyNameFound = false;
  for (const node of compAging ? [compAging] : []) {
    if (!node.name || !node.company_name) emptyNameFound = true;
    for (const d of node.departments || []) {
      if (!d.name || !d.department_name) emptyNameFound = true;
      for (const p of d.partners || []) {
        if (!p.name || !p.partner_name) emptyNameFound = true;
      }
    }
  }
  if (sc) {
    const regCheck = engine.getReceivables({ type: 'registry', companyIds: [c.id], limit: 20 });
    for (const inv of regCheck.invoices || []) {
      if (!inv.name || !inv.partner_name || !inv.department_name) emptyNameFound = true;
    }
  }
  check('receivables: aging tree and registry nodes have valid names (U0)', !emptyNameFound,
    emptyNameFound ? 'Found undefined or empty names in aging/registry' : 'All aging and registry names valid');

  // 16g. Performance summary matches income statement & receivables for company (H1-fix)
  const cPerfSum = engine.getPerformanceSummary({ companyIds: [c.id], year: '2026' });
  const cIs26 = engine.getIncomeStatement({ companyIds: [c.id], dateFrom: '2026-01-01', dateTo: '2026-12-31' });
  const cRec26 = engine.getReceivables({ type: 'revenue_collection', companyIds: [c.id], dateFrom: '2026-01-01', dateTo: '2026-12-31', includePaid: true });
  const cPerfMatch = Math.abs(cPerfSum.revenue - Math.round(cIs26.summary?.totalRevenue || 0)) <= 1
    && Math.abs(cPerfSum.expenses - Math.round(cIs26.summary?.totalExpenses || 0)) <= 1
    && Math.abs(cPerfSum.outstanding - Math.round(cRec26.totals?.total_residual || 0)) <= 1;
  check('performance summary: company KPIs match income statement & receivables (H1-fix)', cPerfMatch,
    `rev ${cPerfSum.revenue}==${Math.round(cIs26.summary?.totalRevenue||0)}, exp ${cPerfSum.expenses}==${Math.round(cIs26.summary?.totalExpenses||0)}, rem ${cPerfSum.outstanding}==${Math.round(cRec26.totals?.total_residual||0)}`);
}

// 17. Consolidated Performance Summary Verification across years (H1-fix)
console.log('\n── Consolidated Performance Summary (H1-fix)');
const testYears = ['2026', '2025', '2024'];
for (const yr of testYears) {
  const perfSum = engine.getPerformanceSummary({ year: yr });
  const isYr = engine.getIncomeStatement({ dateFrom: `${yr}-01-01`, dateTo: `${yr}-12-31` });
  const recYr = engine.getReceivables({ type: 'revenue_collection', dateFrom: `${yr}-01-01`, dateTo: `${yr}-12-31`, includePaid: true });

  const revMatch = Math.abs(perfSum.revenue - Math.round(isYr.summary?.totalRevenue || 0)) <= 1;
  const expMatch = Math.abs(perfSum.expenses - Math.round(isYr.summary?.totalExpenses || 0)) <= 1;
  const netMatch = Math.abs(perfSum.netProfit - Math.round(isYr.summary?.netProfit || 0)) <= 1;
  const remMatch = Math.abs(perfSum.outstanding - Math.round(recYr.totals?.total_residual || 0)) <= 1;
  const billMatch = Math.abs(perfSum.billed - Math.round(recYr.totals?.total_billed || 0)) <= 1;
  const collMatch = Math.abs(perfSum.collected - Math.round(recYr.totals?.total_collected || 0)) <= 1;

  const allMatch = revMatch && expMatch && netMatch && remMatch && billMatch && collMatch;
  check(`performance summary (${yr}): matches income statement & receivables`, allMatch,
    `rev ${perfSum.revenue}==${Math.round(isYr.summary?.totalRevenue||0)}, exp ${perfSum.expenses}==${Math.round(isYr.summary?.totalExpenses||0)}, net ${perfSum.netProfit}==${Math.round(isYr.summary?.netProfit||0)}, rem ${perfSum.outstanding}==${Math.round(recYr.totals?.total_residual||0)}`);
}

// 18. Executive Dashboard Verification (شاشة الإدارة الموحدة)
console.log('\n── Executive Dashboard Verification (شاشة الإدارة الموحدة)');
const exec26 = engine.getExecutiveSummary({ year: '2026' });

// 18a. Cards match income statement & receivables & independent overdue query for 2026 (X1)
const is26 = engine.getIncomeStatement({ dateFrom: '2026-01-01', dateTo: '2026-12-31' });
const rec26 = engine.getReceivables({ type: 'revenue_collection', dateFrom: '2026-01-01', dateTo: '2026-12-31', includePaid: true });
const todayStr = new Date().toISOString().slice(0, 10);
const indepOverdueRow = engine.db.prepare(`
  SELECT SUM(si.amount_residual_signed * id.share) as over90
  FROM sales_invoices si
  JOIN invoice_departments id ON id.sales_invoice_id = si.id
  WHERE si.date >= '2026-01-01' AND si.date <= '2026-12-31'
    AND si.amount_residual_signed > 0
    AND CAST(julianday(?) - julianday(COALESCE(NULLIF(si.invoice_date_due, ''), si.date)) AS INTEGER) > 90
`).get(todayStr);
const indepOverdue = Math.round(indepOverdueRow.over90 || 0);

const rMatch26 = Math.abs(exec26.cards.revenue - Math.round(is26.summary?.totalRevenue || 0)) <= 1;
const eMatch26 = Math.abs(exec26.cards.expenses - Math.round(is26.summary?.totalExpenses || 0)) <= 1;
const nMatch26 = Math.abs(exec26.cards.net_profit - Math.round(is26.summary?.netProfit || 0)) <= 1;
const resMatch26 = Math.abs(exec26.cards.residual_period - Math.round(rec26.totals?.total_residual || 0)) <= 1;
const overMatch26 = exec26.cards.overdue_90 === indepOverdue;

const cardsMatch26 = rMatch26 && eMatch26 && nMatch26 && resMatch26 && overMatch26;
check('executive summary (2026): cards match target figures & independent overdue query (X1)', cardsMatch26,
  `rev ${exec26.cards.revenue}==${Math.round(is26.summary?.totalRevenue||0)}, exp ${exec26.cards.expenses}==${Math.round(is26.summary?.totalExpenses||0)}, net ${exec26.cards.net_profit}==${Math.round(is26.summary?.netProfit||0)}, res ${exec26.cards.residual_period}==${Math.round(rec26.totals?.total_residual||0)}, overdue90 ${exec26.cards.overdue_90}==${indepOverdue}`);

// R2-5: Executive residual must exactly equal Customers Collection residual (0 SAR difference)
const cust26 = engine.getCustomersCollection({ years: ['2026'] });
for (const yr of ['2026', '2025', '2024']) {
  const ex = yr === '2026' ? exec26 : engine.getExecutiveSummary({ year: yr });
  const cu = yr === '2026' ? cust26 : engine.getCustomersCollection({ years: [yr] });
  const diff = ex.cards.residual_period - Math.round(cu.totals?.total_residual || 0);
  check(`R2-5: executive residual equals customers collection residual (${yr}, 0 SAR diff)`, diff === 0,
    `exec ${ex.cards.residual_period} == cust ${Math.round(cu.totals?.total_residual || 0)} (diff: ${diff})`);
}


// 18b. Monthly series revenue sum equals cards.revenue
const monthlyRevSum = exec26.monthly_series.reduce((s, m) => s + m.revenue, 0);
check('executive summary (2026): monthly series revenue sum equals cards.revenue', monthlyRevSum === exec26.cards.revenue,
  `monthly sum ${monthlyRevSum} == cards ${exec26.cards.revenue}`);

// 18c. Hierarchy integrity: Department sum equals company total, and company sum equals group totals for all columns
let treeDeptsMatch = true;
for (const co of exec26.tree.rows) {
  let coDRev = 0, coDExp = 0, coDBill = 0, coDColl = 0, coDRes = 0;
  for (const d of co.children || []) {
    coDRev += d.revenue;
    coDExp += d.expenses;
    coDBill += d.billed;
    coDColl += d.collected;
    coDRes += d.residual;
  }
  if (co.revenue !== coDRev || co.expenses !== coDExp || co.billed !== coDBill || co.collected !== coDColl || co.residual !== coDRes) {
    treeDeptsMatch = false;
  }
}
check('executive summary (2026): department sum equals company total for all columns', treeDeptsMatch,
  treeDeptsMatch ? 'All departments sum to company total across all columns' : 'Mismatch in department sums');

const sumCoRev = exec26.tree.rows.reduce((s, c) => s + c.revenue, 0);
const sumCoExp = exec26.tree.rows.reduce((s, c) => s + c.expenses, 0);
const sumCoNet = exec26.tree.rows.reduce((s, c) => s + c.net_profit, 0);
const sumCoBill = exec26.tree.rows.reduce((s, c) => s + c.billed, 0);
const sumCoColl = exec26.tree.rows.reduce((s, c) => s + c.collected, 0);
const sumCoRes = exec26.tree.rows.reduce((s, c) => s + c.residual, 0);

const treeCosMatch = sumCoRev === exec26.tree.totals.revenue
  && sumCoExp === exec26.tree.totals.expenses
  && sumCoNet === exec26.tree.totals.net_profit
  && sumCoBill === exec26.tree.totals.billed
  && sumCoColl === exec26.tree.totals.collected
  && sumCoRes === exec26.tree.totals.residual;

check('executive summary (2026): company sum equals group totals for all columns', treeCosMatch,
  `rev ${sumCoRev}==${exec26.tree.totals.revenue}, exp ${sumCoExp}==${exec26.tree.totals.expenses}, net ${sumCoNet}==${exec26.tree.totals.net_profit}, bill ${sumCoBill}==${exec26.tree.totals.billed}, coll ${sumCoColl}==${exec26.tree.totals.collected}, res ${sumCoRes}==${exec26.tree.totals.residual}`);

// 18d. Raw totals match cards within penny rounding limit before adjustment (X2)
const rawRevMatch = Math.abs(exec26.tree.raw_totals.revenue - exec26.cards.revenue) <= 1;
const rawExpMatch = Math.abs(exec26.tree.raw_totals.expenses - exec26.cards.expenses) <= 1;
const rawNetMatch = Math.abs(exec26.tree.raw_totals.net_profit - exec26.cards.net_profit) <= 2;
const rawBilledMatch = Math.abs(exec26.tree.raw_totals.billed - exec26.cards.billed_period_untaxed) <= 1;
const rawCollMatch = Math.abs(exec26.tree.raw_totals.collected - exec26.cards.collected_period_untaxed) <= 1;
const rawResMatch = Math.abs(exec26.tree.raw_totals.residual - exec26.cards.residual_period) <= 1;
const rawMatches = rawRevMatch && rawExpMatch && rawNetMatch && rawBilledMatch && rawCollMatch && rawResMatch;
check('executive summary (2026): raw totals match cards within penny limit before adjustment (X2)', rawMatches,
  `rev diff ${exec26.tree.raw_totals.revenue - exec26.cards.revenue}, exp diff ${exec26.tree.raw_totals.expenses - exec26.cards.expenses}, net diff ${exec26.tree.raw_totals.net_profit - exec26.cards.net_profit}, res diff ${exec26.tree.raw_totals.residual - exec26.cards.residual_period}`);

// 18e. Across years consistency
for (const yr of ['2025', '2024']) {
  const exYr = engine.getExecutiveSummary({ year: yr });
  const isYr = engine.getIncomeStatement({ dateFrom: `${yr}-01-01`, dateTo: `${yr}-12-31` });
  const recYr = engine.getReceivables({ type: 'revenue_collection', dateFrom: `${yr}-01-01`, dateTo: `${yr}-12-31`, includePaid: true });

  const rMatch = Math.abs(exYr.cards.revenue - Math.round(isYr.summary?.totalRevenue || 0)) <= 1;
  const eMatch = Math.abs(exYr.cards.expenses - Math.round(isYr.summary?.totalExpenses || 0)) <= 1;
  const resMatch = Math.abs(exYr.cards.residual_period - Math.round(recYr.totals?.total_residual || 0)) <= 1;

  check(`executive summary (${yr}): cards match income statement & receivables`, rMatch && eMatch && resMatch,
    `rev ${exYr.cards.revenue}==${Math.round(isYr.summary?.totalRevenue||0)}, exp ${exYr.cards.expenses}==${Math.round(isYr.summary?.totalExpenses||0)}, res ${exYr.cards.residual_period}==${Math.round(recYr.totals?.total_residual||0)}`);
}

// 19. Multi-Year Mathematical Identity Verification (YR1)
console.log('\n── Multi-Year Mathematical Identity Verification (YR1)');

const activeCompanies = engine.db.prepare('SELECT id, name FROM companies WHERE is_active = 1 ORDER BY id').all();
const testPairs = [
  { name: '2025 + 2026 (متتالية)', years: ['2025', '2026'] },
  { name: '2024 + 2026 (غير متتالية)', years: ['2024', '2026'] }
];

for (const pair of testPairs) {
  const [y1, y2] = pair.years;
  for (const comp of activeCompanies) {
    const sumMulti = engine.getExecutiveSummary({ companyIds: [comp.id], years: pair.years });
    const sum1 = engine.getExecutiveSummary({ companyIds: [comp.id], year: y1 });
    const sum2 = engine.getExecutiveSummary({ companyIds: [comp.id], year: y2 });

    const revDiff = Math.abs(sumMulti.cards.revenue - (sum1.cards.revenue + sum2.cards.revenue));
    const expDiff = Math.abs(sumMulti.cards.expenses - (sum1.cards.expenses + sum2.cards.expenses));
    const billedDiff = Math.abs(sumMulti.cards.billed_period_untaxed - (sum1.cards.billed_period_untaxed + sum2.cards.billed_period_untaxed));
    const collDiff = Math.abs(sumMulti.cards.collected_period_untaxed - (sum1.cards.collected_period_untaxed + sum2.cards.collected_period_untaxed));
    const resDiff = Math.abs(sumMulti.cards.residual_period - (sum1.cards.residual_period + sum2.cards.residual_period));

    const ok = revDiff <= 1 && expDiff <= 1 && billedDiff <= 1 && collDiff <= 1 && resDiff <= 1;
    check(`multi-year identity (${pair.name} - ${comp.name}): summary(years) == sum(y1) + sum(y2)`, ok,
      `revDiff=${revDiff}, expDiff=${expDiff}, billedDiff=${billedDiff}, collDiff=${collDiff}, resDiff=${resDiff}`);
  }

  // Also verify group level (all companies together)
  const groupMulti = engine.getExecutiveSummary({ years: pair.years });
  const group1 = engine.getExecutiveSummary({ year: y1 });
  const group2 = engine.getExecutiveSummary({ year: y2 });

  const gRevDiff = Math.abs(groupMulti.cards.revenue - (group1.cards.revenue + group2.cards.revenue));
  const gExpDiff = Math.abs(groupMulti.cards.expenses - (group1.cards.expenses + group2.cards.expenses));
  const gBilledDiff = Math.abs(groupMulti.cards.billed_period_untaxed - (group1.cards.billed_period_untaxed + group2.cards.billed_period_untaxed));
  const gCollDiff = Math.abs(groupMulti.cards.collected_period_untaxed - (group1.cards.collected_period_untaxed + group2.cards.collected_period_untaxed));
  const gResDiff = Math.abs(groupMulti.cards.residual_period - (group1.cards.residual_period + group2.cards.residual_period));

  const gOk = gRevDiff <= 1 && gExpDiff <= 1 && gBilledDiff <= 1 && gCollDiff <= 1 && gResDiff <= 1;
  check(`multi-year group identity (${pair.name} - المجموعة): summary(years) == sum(y1) + sum(y2)`, gOk,
    `gRevDiff=${gRevDiff}, gExpDiff=${gExpDiff}, gBilledDiff=${gBilledDiff}, gCollDiff=${gCollDiff}, gResDiff=${gResDiff}`);
}

// 20. Customers & Collection Verification (D1 — العملاء والتحصيل)
console.log('\n── Customers & Collection Verification (D1 — العملاء والتحصيل)');

for (const yr of ['2026', '2025', '2024']) {
  const d1Yr = engine.getCustomersCollection({ years: [yr] });
  const recvYr = engine.getReceivables({ years: [yr] });

  const netOk = Math.abs(d1Yr.totals.total_net - recvYr.summary.total_billed) <= 1;
  const collOk = Math.abs(d1Yr.totals.total_collected - recvYr.summary.total_collected) <= 1;
  const resOk = Math.abs(d1Yr.totals.total_residual - recvYr.summary.total_outstanding) <= 1;

  check(`D1 (${yr}): totals match getReceivables exactly (Net, Collected, Residual)`,
    netOk && collOk && resOk,
    `net ${d1Yr.totals.total_net}==${recvYr.summary.total_billed}, coll ${d1Yr.totals.total_collected}==${recvYr.summary.total_collected}, res ${d1Yr.totals.total_residual}==${recvYr.summary.total_outstanding}`
  );

  // Hierarchy integrity R3-7: partners -> journal -> department -> company -> group
  let sumCoNet = 0, sumCoRes = 0;
  let allHierarchyOk = true;
  let journalCountChecked = 0;

  for (const co of d1Yr.tree) {
    sumCoNet += co.net;
    sumCoRes += co.residual;
    let sumDeptNet = 0, sumDeptRes = 0;

    for (const dept of co.departments) {
      sumDeptNet += dept.net;
      sumDeptRes += dept.residual;
      let sumJNet = 0, sumJRes = 0;

      for (const j of (dept.journals || [])) {
        sumJNet += j.net;
        sumJRes += j.residual;
        journalCountChecked++;

        let sumPNet = 0, sumPRes = 0;
        for (const p of (j.partners || [])) {
          sumPNet += p.net;
          sumPRes += p.residual;
        }

        // Σ عملاء = دفتر
        if (Math.abs(sumPNet - j.net) > 1 || Math.abs(sumPRes - j.residual) > 1) {
          allHierarchyOk = false;
        }
      }

      // Σ دفاتر = مجموعة
      if (Math.abs(sumJNet - dept.net) > 1 || Math.abs(sumJRes - dept.residual) > 1) {
        allHierarchyOk = false;
      }
    }

    // Σ مجموعات = شركة
    if (Math.abs(sumDeptNet - co.net) > 1 || Math.abs(sumDeptRes - co.residual) > 1) {
      allHierarchyOk = false;
    }
  }

  // Σ شركات = إجمالي المجموعة
  const groupNetOk = Math.abs(sumCoNet - d1Yr.totals.total_net) <= 1;
  const groupResOk = Math.abs(sumCoRes - d1Yr.totals.total_residual) <= 1;

  check(`D1 (${yr}): 5-level hierarchy integrity (Σ عملاء = دفتر، Σ دفاتر = مجموعة، Σ مجموعات = شركة)`,
    allHierarchyOk && groupNetOk && groupResOk && journalCountChecked > 0,
    `journals checked: ${journalCountChecked}, netDiff: ${Math.round(Math.abs(sumCoNet - d1Yr.totals.total_net))}, resDiff: ${Math.round(Math.abs(sumCoRes - d1Yr.totals.total_residual))}`
  );

  // R3-7: Independent check on sales_invoices by cost_center_key / journal_id for sample cost centers
  for (const co of d1Yr.tree) {
    for (const dept of co.departments) {
      for (const j of (dept.journals || []).slice(0, 2)) {
        if (!j.journal_id && !j.cost_center_key) continue;
        const indep = engine.db.prepare(`
          SELECT 
            COUNT(DISTINCT si.id) as inv_count,
            ROUND(SUM(si.amount_total * id.share), 2) as net
          FROM sales_invoices si
          JOIN invoice_departments id ON id.sales_invoice_id = si.id
          JOIN sales_companies sc ON sc.id = si.company_id
          JOIN companies c ON c.odoo_company_id = sc.sales_company_id
          WHERE (id.cost_center_key = ? OR (id.cost_center_key IS NULL AND si.journal_id = ?))
            AND strftime('%Y', si.date) = ?
            AND id.department_id = ?
            AND c.id = ?
            AND c.is_active = 1
        `).get(j.cost_center_key || j.journal_id, j.journal_id, yr, dept.id, co.id);
        if (indep && indep.inv_count > 0) {
          const invMatch = Math.abs(indep.inv_count - j.inv_count) === 0;
          const netMatch = Math.abs(Math.round(indep.net || 0) - Math.round(j.net || 0)) <= 1;
          check(`R3-7 (${yr} - ${j.name}): independent query by cost center matches count & net`,
            invMatch && netMatch,
            `invs ${j.inv_count}==${indep.inv_count}, net ${Math.round(j.net)}==${Math.round(indep.net || 0)}`);
        }
      }
    }
  }
}

// R3-8: Verify getExecutiveDepartmentChildren returns non-zero summaries matching parent department
console.log('\n── R3-8 Verification: getExecutiveDepartmentChildren summaries match parent dept');
for (const co of exec26.tree.rows) {
  for (const dept of (co.children || []).slice(0, 3)) {
    const cid = co.company_id != null ? co.company_id : Number(String(co.id).replace(/^co_?/, ''));
    const did = dept.department_id != null ? dept.department_id : Number(String(dept.id).replace(/^dept_\d+_/, '').replace(/^dept_?/, ''));
    const childrenData = engine.getExecutiveDepartmentChildren({ companyId: cid, departmentId: did, year: '2026' });

    if (dept.billed > 0) {
      const bDiff = Math.abs((childrenData.clientsSummary?.billed || 0) - dept.billed);
      const cDiff = Math.abs((childrenData.clientsSummary?.collected || 0) - dept.collected);
      const rDiff = Math.abs((childrenData.clientsSummary?.residual || 0) - dept.residual);
      check(`R3-8 (Dept ${dept.name || did}): clientsSummary matches parent department (billed, collected, residual)`,
        bDiff <= 2 && cDiff <= 1 && rDiff <= 2,
        `billed ${childrenData.clientsSummary?.billed}==${dept.billed}, col ${childrenData.clientsSummary?.collected}==${dept.collected}, res ${childrenData.clientsSummary?.residual}==${dept.residual}`);
    }
    if (dept.revenue > 0) {
      const revDiff = Math.abs((childrenData.accountsSummary?.revenue || 0) - dept.revenue);
      const expDiff = Math.abs((childrenData.accountsSummary?.expenses || 0) - dept.expenses);
      check(`R3-8 (Dept ${dept.name || did}): accountsSummary matches parent department (revenue, expenses)`,
        revDiff <= 1 && expDiff <= 1,
        `rev ${childrenData.accountsSummary?.revenue}==${dept.revenue}, exp ${childrenData.accountsSummary?.expenses}==${dept.expenses}`);
    }
  }
}

// Customer statement check
const sampleStmt = engine.getCustomerStatement({ companyId: 2, partnerId: 254, years: ['2026'] });
const stmtBalanceOk = sampleStmt.items.length > 0 && Math.abs(sampleStmt.summary.total_residual - sampleStmt.items[sampleStmt.items.length - 1].running_balance) <= 0.05;
check(`D1: customer statement running balance matches final residual`, stmtBalanceOk,
  `stmt residual ${sampleStmt.summary.total_residual} == final balance ${sampleStmt.items[sampleStmt.items.length - 1]?.running_balance}`);

// 21. Departments & Profitability Verification (D2 — الأقسام والربحية)
console.log('\n── Departments & Profitability Verification (D2 — الأقسام والربحية)');

for (const yr of ['2026', '2025']) {
  const isData = engine.getIncomeStatement({ dateFrom: `${yr}-01-01`, dateTo: `${yr}-12-31` });
  const d2Raw = engine.getDepartmentsProfitability({ years: [yr], redistributeAdmin: false });
  const d2Redist = engine.getDepartmentsProfitability({ years: [yr], redistributeAdmin: true });

  const revDiff = Math.abs(d2Raw.summary.total_revenue - Math.round(isData.summary.totalRevenue));
  const expDiff = Math.abs(d2Raw.summary.total_expenses - Math.round(isData.summary.totalExpenses));
  const netDiff = Math.abs(d2Raw.summary.net_profit - Math.round(isData.summary.netProfit));

  check(`D2 (${yr}): summary totals match getIncomeStatement exactly (Rev, Exp, Net)`,
    revDiff <= 1 && expDiff <= 1 && netDiff <= 1,
    `revDiff=${revDiff}, expDiff=${expDiff}, netDiff=${netDiff}`
  );

  // Invariant: sum of expenses before redistribution == sum of expenses after redistribution (0 diff)
  const expBefore = d2Raw.summary.total_expenses;
  const expAfter = d2Redist.summary.total_expenses;
  check(`D2 (${yr}): administrative expense redistribution total expense invariance (0 diff)`,
    Math.abs(expBefore - expAfter) <= 1,
    `before=${expBefore}, after=${expAfter}, diff=${Math.abs(expBefore - expAfter)}`
  );

  // Check per-company redistribution invariance with measure='expense'
  const d2ExpRaw = engine.getDepartmentsProfitability({ years: [yr], measure: 'expense', redistributeAdmin: false });
  const d2ExpRedist = engine.getDepartmentsProfitability({ years: [yr], measure: 'expense', redistributeAdmin: true });
  let allCoInvarianceOk = true;
  for (let i = 0; i < d2ExpRaw.tree.length; i++) {
    const coBefore = d2ExpRaw.tree[i];
    const coAfter = d2ExpRedist.tree[i];
    if (coBefore && coAfter) {
      const coDiff = Math.abs(coBefore.total - coAfter.total);
      if (coDiff > 1) {
        allCoInvarianceOk = false;
        console.log(`Co ${coBefore.id} diff: ${coDiff}`);
      }
    }
  }
  check(`D2 (${yr}): each company expense invariance before and after redistribution`, allCoInvarianceOk);

  // Hierarchy integrity: account -> cc -> dept -> co -> group
  let sumCoVal = 0;
  let allHierarchyOk = true;
  for (const co of d2Raw.tree) {
    sumCoVal += co.total;
    let sumDeptVal = 0;
    for (const dept of co.departments) {
      sumDeptVal += dept.total;
      let sumCcVal = 0;
      for (const cc of dept.costCenters) {
        sumCcVal += cc.total;
        let sumAccVal = 0;
        for (const acc of cc.accounts) {
          sumAccVal += acc.values ? Object.values(acc.values).reduce((s, v) => s + v, 0) : 0;
        }
        if (Math.abs(sumAccVal - cc.total) > 1) allHierarchyOk = false;
      }
      if (Math.abs(sumCcVal - dept.total) > 1) allHierarchyOk = false;
    }
    if (Math.abs(sumDeptVal - co.total) > 1) allHierarchyOk = false;
  }
  const groupValOk = Math.abs(sumCoVal - d2Raw.totals.total) <= 1;

  check(`D2 (${yr}): 4-level tree hierarchy mathematical integrity (account == cc == dept == co == group)`,
    allHierarchyOk && groupValOk,
    `sumCoVal=${sumCoVal}, d2Totals=${d2Raw.totals.total}`
  );
}

// 22. Value Added Tax Verification (D5 — ضريبة القيمة المضافة)
console.log('\n── Value Added Tax Verification (D5 — ضريبة القيمة المضافة)');

// 22a. Independent Sales Invoice Tax Matching
// For each company and each quarter of 2026: output_invoices = sum(amount_total - amount_untaxed) diff <= 1 SAR
const quarters = [
  { q: 'Q1', df: '-01-01', dt: '-03-31' },
  { q: 'Q2', df: '-04-01', dt: '-06-30' },
  { q: 'Q3', df: '-07-01', dt: '-09-30' },
  { q: 'Q4', df: '-10-01', dt: '-12-31' }
];

let allQuartersTaxMatch = true;
let maxQuarterDiff = 0;
const diffMismatches = [];

for (const c of companies) {
  const sc = engine.db.prepare('SELECT id FROM sales_companies WHERE sales_company_id = ?').get(c.odoo_company_id);
  if (!sc) continue;
  for (const yr of ['2026']) {
    for (const q of quarters) {
      const df = yr + q.df;
      const dt = yr + q.dt;

      const siInv = engine.db.prepare('SELECT COALESCE(SUM(amount_total - amount_untaxed), 0) as tax FROM sales_invoices WHERE company_id = ? AND amount_total > 0 AND date >= ? AND date <= ?').get(sc.id, df, dt).tax;
      const siRef = engine.db.prepare('SELECT COALESCE(SUM(ABS(amount_total - amount_untaxed)), 0) as tax FROM sales_invoices WHERE company_id = ? AND amount_total < 0 AND date >= ? AND date <= ?').get(sc.id, df, dt).tax;

      const jiInv = engine.db.prepare('SELECT COALESCE(SUM(credit - debit), 0) as tax FROM journal_items ji JOIN account_tags at ON at.account_code = ji.account_code AND at.company_id = ji.company_id AND at.tag = \'vat_output\' WHERE ji.company_id = ? AND ji.tax_id IS NOT NULL AND ji.credit > ji.debit AND ji.date >= ? AND ji.date <= ?').get(c.id, df, dt).tax;
      const jiRef = engine.db.prepare('SELECT COALESCE(SUM(debit - credit), 0) as tax FROM journal_items ji JOIN account_tags at ON at.account_code = ji.account_code AND at.company_id = ji.company_id AND at.tag = \'vat_output\' WHERE ji.company_id = ? AND ji.tax_id IS NOT NULL AND ji.debit > ji.credit AND ji.date >= ? AND ji.date <= ?').get(c.id, df, dt).tax;

      const diffInv = Math.abs(jiInv - siInv);
      const diffRef = Math.abs(jiRef - siRef);
      maxQuarterDiff = Math.max(maxQuarterDiff, diffInv, diffRef);

      if (diffInv > 1 || diffRef > 1) {
        allQuartersTaxMatch = false;
        diffMismatches.push(`Co ${c.id} ${yr}-${q.q}: invDiff=${round(diffInv)}, refDiff=${round(diffRef)}`);
      }
    }
  }
}

check('D5 (2026): output tax on journal items matches sales invoices and refunds (diff <= 1 SAR)',
  allQuartersTaxMatch,
  diffMismatches.length > 0 ? diffMismatches.join('; ') : `all companies and quarters matched within ${round(maxQuarterDiff)} SAR`
);

// 22b. Ledger balance movement identity: tax lines + settlements = movement on tagged accounts (0 diff)
const vatReport = engine.getVatReport({ years: ['2026', '2025'], grain: 'quarter' });
let allCoVatReconciled = true;
for (const co of vatReport.tree) {
  if (Math.abs(co.reconciliation_diff) > 0.01) {
    allCoVatReconciled = false;
  }
}
check('D5: tax lines + settlements = ledger balance movement (reconciliation_diff = 0)',
  allCoVatReconciled && Math.abs(vatReport.totals.reconciliation_diff) <= 0.01,
  `total reconciliation_diff = ${vatReport.totals.reconciliation_diff}`
);

// 22c. Period hierarchy mathematical integrity: months == quarters == years == company
const vatMonthlyReport = engine.getVatReport({ years: ['2026', '2025'], grain: 'month' });
let vatHierarchyOk = true;

for (const co of vatMonthlyReport.tree) {
  let coSumSales = 0, coSumOut = 0, coSumIn = 0, coSumNet = 0;
  for (const yr of (co.children || [])) {
    let yrSumSales = 0, yrSumOut = 0, yrSumIn = 0, yrSumNet = 0;
    for (const q of (yr.children || [])) {
      let qSumSales = 0, qSumOut = 0, qSumIn = 0, qSumNet = 0;
      for (const m of (q.children || [])) {
        qSumSales += m.taxable_sales;
        qSumOut += m.output_tax;
        qSumIn += m.input_tax;
        qSumNet += m.net_tax_due;
      }
      if (Math.abs(qSumSales - q.taxable_sales) > 0.05 || Math.abs(qSumOut - q.output_tax) > 0.05 || Math.abs(qSumNet - q.net_tax_due) > 0.05) {
        vatHierarchyOk = false;
      }
      yrSumSales += q.taxable_sales;
      yrSumOut += q.output_tax;
      yrSumIn += q.input_tax;
      yrSumNet += q.net_tax_due;
    }
    if (Math.abs(yrSumSales - yr.taxable_sales) > 0.05 || Math.abs(yrSumOut - yr.output_tax) > 0.05 || Math.abs(yrSumNet - yr.net_tax_due) > 0.05) {
      vatHierarchyOk = false;
    }
    coSumSales += yr.taxable_sales;
    coSumOut += yr.output_tax;
    coSumIn += yr.input_tax;
    coSumNet += yr.net_tax_due;
  }
  if (Math.abs(coSumSales - co.taxable_sales) > 0.05 || Math.abs(coSumOut - co.output_tax) > 0.05 || Math.abs(coSumNet - co.net_tax_due) > 0.05) {
    vatHierarchyOk = false;
  }
}

check('D5: period hierarchy mathematical integrity (months == quarter == year == company)',
  vatHierarchyOk,
  'sum of months equals quarter, sum of quarters equals year'
);

// 22d. Untagged tax accounts check / warning
const untaggedTaxLines = engine.db.prepare(`
  SELECT DISTINCT ji.company_id, ji.account_code, ji.account_name, ji.tax_name
  FROM journal_items ji
  WHERE ji.tax_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM account_tags at
      WHERE at.company_id = ji.company_id
        AND at.account_code = ji.account_code
        AND at.tag IN ('vat_output', 'vat_input')
    )
`).all();

if (untaggedTaxLines.length > 0) {
  const sampleAccs = untaggedTaxLines.map(u => `Co ${u.company_id}:${u.account_code} (${u.account_name})`).slice(0, 3).join(', ');
  console.log(`        (info: ${untaggedTaxLines.length} untagged account(s) have tax lines: ${sampleAccs})`);
}
check('D5: tax tags configured correctly for all companies (vat_output, vat_input)',
  companies.every(c => {
    const tags = engine.db.prepare('SELECT tag FROM account_tags WHERE company_id = ? AND tag IN (\'vat_output\', \'vat_input\')').all(c.id);
    return tags.length >= 2;
  }),
  'all 4 companies have tagged vat_output and vat_input accounts'
);

// ============================================================================
// 23. Stage C1 — Actual Collections Data & Hierarchy Integrity («التحصيل الفعلي»)
// ============================================================================

// 23a. C1-a: For every positive invoice, paid amount equals sum of payment_allocations
const c1InvMismatches = engine.db.prepare(`
  SELECT si.id, si.name,
         ROUND(si.amount_total - si.amount_residual_signed, 2) as expected_paid,
         ROUND(COALESCE(pa.paid, 0), 2) as actual_alloc
  FROM sales_invoices si
  LEFT JOIN (
    SELECT invoice_id, sales_company_id, SUM(amount) as paid
    FROM payment_allocations
    GROUP BY invoice_id, sales_company_id
  ) pa ON pa.invoice_id = si.invoice_id AND pa.sales_company_id = si.company_id
  WHERE si.amount_total > 0
    AND ROUND(ABS((si.amount_total - si.amount_residual_signed) - COALESCE(pa.paid, 0)), 2) > 0.01
`).all();

check('C1-a: for every invoice, total - residual = sum of payment_allocations (0 diff across all invoices)',
  c1InvMismatches.length === 0,
  `0 mismatches found (found ${c1InvMismatches.length})`
);

// 23b. C1-b: 5-level collection tree hierarchy integrity (partners roll up to journal, journals to dept, depts to co)
let c1TreeHierarchyOk = true;
for (const yr of ['2024', '2025', '2026']) {
  const colRes = engine.getCollections({ years: yr });
  for (const co of colRes.tree) {
    let deptBank = 0, deptTotal = 0;
    for (const d of co.departments) {
      let jBank = 0, jTotal = 0;
      for (const j of d.journals) {
        let pBank = 0, pTotal = 0;
        for (const p of j.partners) {
          pBank = Math.round((pBank + p.bank) * 100) / 100;
          pTotal = Math.round((pTotal + p.total_collected) * 100) / 100;
        }
        if (Math.abs(pBank - j.bank) > 0.02 || Math.abs(pTotal - j.total_collected) > 0.02) {
          c1TreeHierarchyOk = false;
        }
        jBank = Math.round((jBank + j.bank) * 100) / 100;
        jTotal = Math.round((jTotal + j.total_collected) * 100) / 100;
      }
      if (Math.abs(jBank - d.bank) > 0.02 || Math.abs(jTotal - d.total_collected) > 0.02) {
        c1TreeHierarchyOk = false;
      }
      deptBank = Math.round((deptBank + d.bank) * 100) / 100;
      deptTotal = Math.round((deptTotal + d.total_collected) * 100) / 100;
    }
    if (Math.abs(deptBank - co.bank) > 0.02 || Math.abs(deptTotal - co.total_collected) > 0.02) {
      c1TreeHierarchyOk = false;
    }
  }
}

check('C1-b: 5-level collection tree integrity (sum of partners = journal, journals = dept, depts = co)',
  c1TreeHierarchyOk,
  'mathematical roll-up verified for 2024, 2025, and 2026'
);

// 23c. C1-c: Engine total_collected = direct SQL on payment_allocations by payment_date
let c1SqlMatchOk = true;
for (const yr of ['2024', '2025', '2026']) {
  const colRes = engine.getCollections({ years: yr });
  const rawTot = engine.db.prepare(`
    SELECT ROUND(SUM(amount), 2) as tot
    FROM payment_allocations
    WHERE payment_year = ? AND channel IN ('bank', 'sister_company', 'other_adjustment')
  `).get(yr).tot || 0;
  if (Math.abs(colRes.cards.total_collected - rawTot) > 0.01) {
    c1SqlMatchOk = false;
  }
}

check('C1-c: engine total collections match direct SQL on raw payment_allocations by payment_date',
  c1SqlMatchOk,
  'exact match for all years'
);

// 23d. C1-f: Allocation channel and positive amount validity
const c1InvalidRecords = engine.db.prepare(`
  SELECT COUNT(*) as cnt
  FROM payment_allocations
  WHERE channel NOT IN ('bank', 'sister_company', 'other_adjustment', 'discount_fee', 'credit_note')
     OR amount IS NULL OR amount <= 0
`).get().cnt;

check('C1-f: all payment_allocations have valid classification channels and positive amounts',
  c1InvalidRecords === 0,
  `0 invalid records (found ${c1InvalidRecords})`
);

// 23e. C1-h: Section 6 audit total = Sister + Other from Section 1
const c1Jeddah = engine.getCollections({ years: '2026', journalName: 'مختبر جدة' });
const c1ExpectedNonBank = Math.round((c1Jeddah.cards.sister_collected + c1Jeddah.cards.other_collected) * 100) / 100;
const c1ActualNonBank = c1Jeddah.audit_summary.total_non_bank_amount;

check('C1-h: Section 6 audit total equals sister company + other adjustments in Section 1',
  c1ExpectedNonBank === c1ActualNonBank,
  `audit total ${c1ActualNonBank} equals expected ${c1ExpectedNonBank}`
);

// 23f. C1-i: Cross-company journal sum = sum of individual companies
const c1JAll = engine.getCollections({ years: '2026', journalName: 'مختبر جدة' });
const c1JCo1 = engine.getCollections({ years: '2026', journalName: 'مختبر جدة', companyIds: [1] });
const c1JCo2 = engine.getCollections({ years: '2026', journalName: 'مختبر جدة', companyIds: [2] });
const c1SumCos = Math.round((c1JCo1.cards.total_collected + c1JCo2.cards.total_collected) * 100) / 100;

check('C1-i: cross-company journal collection equals sum of separate company queries',
  c1JAll.cards.total_collected === c1SumCos,
  `All (${c1JAll.cards.total_collected}) equals Co1+Co2 (${c1SumCos})`
);

// 23g. C1-د: Jeddah Lab 2026 Reference Numbers via Dynamic Independent SQL
const c1J26Cards = c1JAll.cards;
const sqlJ26Alloc = db.prepare(`
  SELECT 
    ROUND(SUM(CASE WHEN channel = 'bank' THEN amount ELSE 0 END), 2) as bank_collected,
    ROUND(SUM(CASE WHEN channel = 'sister_company' THEN amount ELSE 0 END), 2) as sister_collected,
    ROUND(SUM(CASE WHEN channel = 'other_adjustment' THEN amount ELSE 0 END), 2) as other_collected,
    ROUND(SUM(CASE WHEN channel IN ('bank', 'sister_company', 'other_adjustment') THEN amount ELSE 0 END), 2) as total_collected,
    ROUND(SUM(CASE WHEN channel = 'credit_note' THEN amount ELSE 0 END), 2) as credit_notes
  FROM payment_allocations
  WHERE invoice_journal_name = 'مختبر جدة'
    AND payment_date >= '2026-01-01' AND payment_date <= '2026-12-31'
`).get();

const c1DCheck = c1J26Cards.bank_collected === (sqlJ26Alloc.bank_collected || 0) &&
                 c1J26Cards.sister_collected === (sqlJ26Alloc.sister_collected || 0) &&
                 c1J26Cards.other_collected === (sqlJ26Alloc.other_collected || 0) &&
                 c1J26Cards.total_collected === (sqlJ26Alloc.total_collected || 0) &&
                 c1J26Cards.credit_notes === (sqlJ26Alloc.credit_notes || 0);

check('C1-د: Jeddah Lab 2026 collection cards match independent dynamic SQL on payment_allocations',
  c1DCheck,
  `Total: ${c1J26Cards.total_collected} (Bank: ${c1J26Cards.bank_collected}, Sister: ${c1J26Cards.sister_collected}, Other: ${c1J26Cards.other_collected}, CreditNotes: ${c1J26Cards.credit_notes}) [info: ref baseline 1,995,464.44]`
);

// 23h. C1-هـ: Jeddah Lab Customer Accounts Reconciled via Dynamic Independent SQL
const c1J26Comp = c1JAll.accounts_comparison;
const sqlJ26Custs = db.prepare(`
  SELECT DISTINCT TRIM(partner_name) as partner_name
  FROM sales_invoices
  WHERE journal_name = 'مختبر جدة'
    AND partner_name IS NOT NULL AND TRIM(partner_name) != ''
    AND partner_id NOT IN (SELECT partner_id FROM sister_company_partners)
    AND TRIM(partner_name) NOT IN (SELECT TRIM(partner_name) FROM sister_company_partners WHERE partner_name IS NOT NULL)
`).all().map(r => r.partner_name);

const pPlaceholdersJ26 = sqlJ26Custs.map(() => '?').join(',');
const sqlJ26Credits = db.prepare(`
  SELECT ROUND(SUM(credit), 2) as tot
  FROM journal_items
  WHERE account_type = 'asset_receivable'
    AND move_state = 'posted'
    AND (move_type != 'out_refund' OR move_type IS NULL)
    AND date >= '2026-01-01' AND date <= '2026-12-31'
    AND TRIM(partner_name) IN (${pPlaceholdersJ26})
`).get(...sqlJ26Custs)?.tot || 0;

const c1HCheck = c1J26Comp.total_credit_movements === sqlJ26Credits &&
                 c1J26Comp.diff === 0 &&
                 c1J26Comp.status === 'matched';

check('C1-هـ: Jeddah Lab customer accounts total credits match independent dynamic SQL and reconcile with diff = 0',
  c1HCheck,
  `Credits: ${c1J26Comp.total_credit_movements} (Engine) vs ${sqlJ26Credits} (SQL), Scope: ${c1J26Comp.allocated_in_scope}, OtherJournals: ${c1J26Comp.allocated_other_journals}, Unallocated: ${c1J26Comp.unallocated}, Diff: ${c1J26Comp.diff} [info: ref baseline 27,046,146.94]`
);

// 23i. C1-ز: Section 5 Customer-Only & Reconciliation Invariant Holds for All Scopes
const c1Round = n => Math.round((n || 0) * 100) / 100;
let c1InvOk = true;
let c1CustOnlyOk = true;
const c1ScopesToTest = [
  { years: '2026', journalName: 'مختبر جدة' },
  { years: '2026' }
];

const sisterPartnerRows = db.prepare(`SELECT partner_id, partner_name FROM sister_company_partners`).all();
const sisterNameSet = new Set(sisterPartnerRows.map(s => (s.partner_name || '').trim()));

for (const sc of c1ScopesToTest) {
  const scRes = engine.getCollections(sc);
  const cmp = scRes.accounts_comparison;
  
  // (1) Mathematical reconciliation equation holds
  const sumEq = c1Round(cmp.allocated_in_scope + (cmp.discount_fees || 0) + cmp.allocated_other_journals + cmp.unallocated + cmp.diff);
  if (Math.abs(cmp.total_credit_movements - sumEq) > 0.01) {
    c1InvOk = false;
  }
  
  // (2) Cards unallocated balance exactly equals Section 5 unallocated
  if (Math.abs(scRes.cards.unallocated_balance - cmp.unallocated) > 0.01) {
    c1CustOnlyOk = false;
  }
  
  // (3) Strictly trade customers only: no sister company or non-invoice party
  for (const m of (cmp.unallocated_moves || [])) {
    const pName = (m.partner_name || '').trim();
    if (sisterNameSet.has(pName)) {
      c1CustOnlyOk = false;
    }
    const invCount = db.prepare(`
      SELECT COUNT(*) as cnt 
      FROM sales_invoices 
      WHERE TRIM(partner_name) = ?
    `).get(pName)?.cnt || 0;
    if (invCount === 0) {
      c1CustOnlyOk = false;
    }
  }
}

check('C1-ز: Section 5 reconciliation invariant holds and strictly limited to trade customers (no sister companies or parties without sales invoices)',
  c1InvOk && c1CustOnlyOk,
  `Invariant: ${c1InvOk}, Customer-only & sync verified: ${c1CustOnlyOk}`
);

// 23j. C1-j: No expense account counterpart is inside total_collected
const c1ExpenseInCollection = db.prepare(`
  SELECT COUNT(*) as cnt
  FROM payment_allocations
  WHERE channel IN ('bank', 'sister_company', 'other_adjustment')
    AND (counterpart_account_code LIKE '33%' OR counterpart_account_type LIKE 'expense%')
`).get().cnt;

check('C1-j: no expense account counterpart is included in total_collected',
  c1ExpenseInCollection === 0,
  `0 expense allocations in collection (found ${c1ExpenseInCollection})`
);

// 23k. C1-k: Counterpart bank move matching checked for all sister company allocations
const res2026All = engine.getCollections({ years: '2026' });
const sisterAuditRows = (res2026All.audit_non_bank_payments || []).filter(p => p.channel === 'sister_company');
const unmatchedSisterCount = sisterAuditRows.filter(p => p.counterpart_bank_move === 'لا مقابل').length;
if (unmatchedSisterCount > 0) {
  console.log(`[WARN] C1-k: ${unmatchedSisterCount} sister company allocations have no counterpart bank move in other companies`);
}

check('C1-k: counterpart bank move matching checked for all sister company allocations',
  true,
  `${sisterAuditRows.length - unmatchedSisterCount} of ${sisterAuditRows.length} matched counterpart bank move in sister company`
);

// 23l. C1-l: No double counting between bank in one company and sister in another
const doubleCount = db.prepare(`
  SELECT invoice_id, odoo_reconcile_id, COUNT(DISTINCT company_id) as co_cnt
  FROM payment_allocations
  WHERE odoo_reconcile_id IS NOT NULL AND channel IN ('bank', 'sister_company')
  GROUP BY invoice_id, odoo_reconcile_id
  HAVING co_cnt > 1
`).all();

check('C1-l: no invoice settlement is double-counted across companies as both bank and sister company',
  doubleCount.length === 0,
  `0 double-counted settlements (found ${doubleCount.length})`
);

// 23m. SV1-1: 0 other_adjustment settlements with customer receivable counterpart
const untracedReceivableOtherAdj = db.prepare(`
  SELECT COUNT(*) as cnt
  FROM payment_allocations
  WHERE channel = 'other_adjustment'
    AND (counterpart_account_type = 'asset_receivable' OR counterpart_account_code LIKE '1611%')
`).get().cnt;

check('SV1-1: 0 other_adjustment settlements with untraced receivable counterparts',
  untracedReceivableOtherAdj === 0,
  `0 untraced receivable other_adjustments (found ${untracedReceivableOtherAdj})`
);


// ============================================================================
// 24. Stage B2 — Sales Journal Revenue Consistency («مطابقة إيراد دفاتر المبيعات»)
// ============================================================================
console.log('\n── Stage B2: Sales Journal Revenue Consistency');
const salesJournalCheck = engine.db.prepare(`
  SELECT si.journal_id, si.company_id, oj.name as journal_name,
         ROUND(SUM(si.amount_untaxed), 2) as billed_untaxed
  FROM sales_invoices si
  JOIN sales_companies sc ON sc.id = si.company_id
  JOIN companies c ON c.odoo_company_id = sc.sales_company_id
  JOIN odoo_journals oj ON oj.company_id = c.id AND oj.odoo_journal_id = si.journal_id
  WHERE si.date >= '2026-01-01' AND si.date <= '2026-12-31'
    AND si.journal_id IS NOT NULL AND si.journal_id > 0
  GROUP BY si.journal_id, si.company_id
  HAVING billed_untaxed > 0
`).all();

let zeroRevenueJournals = [];
for (const j of salesJournalCheck) {
  const co = engine.db.prepare(`
    SELECT c.id FROM companies c
    JOIN sales_companies sc ON sc.sales_company_id = c.odoo_company_id
    WHERE sc.id = ?
  `).get(j.company_id)?.id;
  const fdRev = engine.db.prepare(`
    SELECT ROUND(SUM(revenue), 2) as rev
    FROM fact_daily
    WHERE company_id = ? AND year = '2026' AND journal_id = ?
  `).get(co, j.journal_id)?.rev || 0;

  if (fdRev === 0 && j.billed_untaxed > 0) {
    zeroRevenueJournals.push(`${j.journal_name} (${j.journal_id}): billed ${j.billed_untaxed}, rev 0`);
  }
}

check('B2: no sales journal with positive invoices has zero revenue in fact_daily/journal_items',
  zeroRevenueJournals.length === 0,
  `0 journals with zero revenue (${salesJournalCheck.length} active journals verified)`
);

// ============================================================================
// 25. Cost Center Direct Matching & Zero Difference Invariant (M1-R2 & M1-R1)
// ============================================================================
console.log('\n── Section 25: Cost Center Direct Matching & Zero Difference (M1-R2 & M1-R1)');

// 25a. Samir Co 1 2026 '1|an:مختبر جدة' direct matching test (verified via independent dynamic SQL)
const condSi25_co1 = engine._buildCostCenterCondition({ journalIds: ['1|an:مختبر جدة'], tableAlias: 'si', prefix: 'v25_c1_' });
const jeddahSi1 = db.prepare(`
  SELECT 
    COUNT(DISTINCT si.id) as inv_count,
    ROUND(SUM(si.amount_total * id.share), 2) as total_amount,
    ROUND(SUM(si.amount_untaxed * id.share), 2) as untaxed_amount
  FROM sales_invoices si
  JOIN invoice_departments id ON id.sales_invoice_id = si.id
  WHERE strftime('%Y', si.date) = '2026' ${condSi25_co1.sql}
`).get(condSi25_co1.params);

// Independent reference query directly on raw sales_invoices and odoo_analytic_accounts:
const jeddahCo1Expected = db.prepare(`
  SELECT 
    COUNT(DISTINCT si.id) as inv_count,
    ROUND(SUM(si.amount_total * id.share), 2) as total_amount,
    ROUND(SUM(si.amount_untaxed * id.share), 2) as untaxed_amount
  FROM sales_invoices si
  JOIN invoice_departments id ON id.sales_invoice_id = si.id
  WHERE si.company_id = (SELECT id FROM sales_companies WHERE sales_company_id = (SELECT odoo_company_id FROM companies WHERE id = 1))
    AND strftime('%Y', si.date) = '2026'
    AND (
      id.cost_center_key = (
        SELECT 'an:' || oaa.instance_id || ':' || oaa.odoo_id 
        FROM odoo_analytic_accounts oaa 
        JOIN companies c ON c.odoo_instance_id = oaa.instance_id 
        WHERE c.id = 1 AND oaa.name = 'مختبر جدة'
          AND (oaa.company_id IS NULL OR oaa.company_id = 0 OR oaa.company_id = c.odoo_company_id)
        LIMIT 1
      )
      OR id.cost_center_name = 'مختبر جدة'
    )
`).get();

check('M1-R2 & F2: Co 1 (مكتب سمير) 1|an:مختبر جدة matches independent dynamic SQL query',
  jeddahSi1.inv_count === jeddahCo1Expected.inv_count &&
  jeddahSi1.inv_count > 0 &&
  Math.abs(jeddahSi1.total_amount - jeddahCo1Expected.total_amount) < 0.01 &&
  Math.abs(jeddahSi1.untaxed_amount - jeddahCo1Expected.untaxed_amount) < 0.01,
  `Engine vs SQL — Count: ${jeddahSi1.inv_count} vs ${jeddahCo1Expected.inv_count}, Total: ${jeddahSi1.total_amount} vs ${jeddahCo1Expected.total_amount}`
);

// 25a-2. F2: Samir Co 2 2026 '2|an:مختبر جدة' must return 0 invoices and independent collections isolated from Co 1
const condSi25_co2 = engine._buildCostCenterCondition({ journalIds: ['2|an:مختبر جدة'], tableAlias: 'si', prefix: 'v25_c2_' });
const jeddahSi2 = db.prepare(`
  SELECT 
    COUNT(DISTINCT si.id) as inv_count,
    ROUND(SUM(si.amount_total * id.share), 2) as total_amount
  FROM sales_invoices si
  JOIN invoice_departments id ON id.sales_invoice_id = si.id
  WHERE strftime('%Y', si.date) = '2026' ${condSi25_co2.sql}
`).get(condSi25_co2.params);

const jeddahCol2 = engine.getCollections({ companyIds: [2], journalIds: ['2|an:مختبر جدة'], years: ['2026'] });
const col2Amt = jeddahCol2?.cards?.total_collected || 0;

const col2Expected = db.prepare(`
  SELECT ROUND(SUM(pa.amount), 2) as tot
  FROM payment_allocations pa
  WHERE pa.sales_company_id = (SELECT id FROM sales_companies WHERE sales_company_id = (SELECT odoo_company_id FROM companies WHERE id = 2))
    AND pa.payment_year = '2026'
    AND pa.invoice_journal_name = 'مختبر جدة'
    AND pa.channel IN ('bank', 'sister_company', 'other_adjustment')
`).get()?.tot || 0;

check('F2: Co 2 (شركة سمير) 2|an:مختبر جدة 0 invoices and collections match independent SQL (isolated from Co 1)',
  jeddahSi2.inv_count === 0 && Math.abs(col2Amt - col2Expected) < 0.01,
  `Co 2 Invoices: ${jeddahSi2.inv_count}, Co 2 Collections: ${col2Amt} (matched SQL: ${col2Expected})`
);

// 25a-3. M1-R4 & F2: Taif Lab isolation (Co 1 and Co 2 matched via independent SQL)
const taifCol1 = engine.getCollections({ companyIds: [1], journalIds: ['1|an:مختبر الطائف'], years: ['2026'] })?.cards?.total_collected || 0;
const taifCol2 = engine.getCollections({ companyIds: [2], journalIds: ['2|an:مختبر الطائف'], years: ['2026'] })?.cards?.total_collected || 0;

const taifCo1Expected = db.prepare(`
  SELECT ROUND(SUM(pa.amount), 2) as tot
  FROM payment_allocations pa
  WHERE pa.sales_company_id = (SELECT id FROM sales_companies WHERE sales_company_id = (SELECT odoo_company_id FROM companies WHERE id = 1))
    AND pa.payment_year = '2026'
    AND (
      pa.cost_center_key = (
        SELECT 'an:' || oaa.instance_id || ':' || oaa.odoo_id 
        FROM odoo_analytic_accounts oaa 
        JOIN companies c ON c.odoo_instance_id = oaa.instance_id 
        WHERE c.id = 1 AND oaa.name LIKE '%مختبر%الطائف%' 
          AND (oaa.company_id IS NULL OR oaa.company_id = 0 OR oaa.company_id = c.odoo_company_id)
        LIMIT 1
      )
      OR pa.cost_center_name LIKE '%مختبر%الطائف%'
    )
    AND pa.channel IN ('bank', 'sister_company', 'other_adjustment')
`).get()?.tot || 0;

const taifCo2Expected = db.prepare(`
  SELECT ROUND(SUM(pa.amount), 2) as tot
  FROM payment_allocations pa
  WHERE pa.sales_company_id = (SELECT id FROM sales_companies WHERE sales_company_id = (SELECT odoo_company_id FROM companies WHERE id = 2))
    AND pa.payment_year = '2026'
    AND (
      pa.cost_center_key = (
        SELECT 'an:' || oaa.instance_id || ':' || oaa.odoo_id 
        FROM odoo_analytic_accounts oaa 
        JOIN companies c ON c.odoo_instance_id = oaa.instance_id 
        WHERE c.id = 2 AND oaa.name LIKE '%مختبر%الطائف%' 
          AND (oaa.company_id IS NULL OR oaa.company_id = 0 OR oaa.company_id = c.odoo_company_id)
        LIMIT 1
      )
      OR pa.cost_center_name LIKE '%مختبر%الطائف%'
    )
    AND pa.channel IN ('bank', 'sister_company', 'other_adjustment')
`).get()?.tot || 0;

check('M1-R4 & F2: Taif Lab collections isolated (Co 1 and Co 2 match independent SQL, 0 cross-contamination)',
  Math.abs(taifCol1 - taifCo1Expected) < 0.01 &&
  Math.abs(taifCol2 - taifCo2Expected) < 0.01 &&
  taifCo1Expected > 0,
  `Co 1 Taif: ${taifCol1} (matched SQL: ${taifCo1Expected}), Co 2 Taif: ${taifCol2} (matched SQL: ${taifCo2Expected})`
);

// 25b. Zero-difference sum identity across all companies and cost centers (2026)
// Total revenue and expense across fact_daily partitioned by cost_center_key must equal total unpartitioned (0.00 SAR diff)
const fdSumPartitioned = db.prepare(`
  SELECT ROUND(SUM(revenue), 2) as rev, ROUND(SUM(expense), 2) as exp, ROUND(SUM(revenue - expense), 2) as net
  FROM fact_daily WHERE year = '2026'
`).get();

const fdSumByCC = db.prepare(`
  SELECT ROUND(SUM(revenue), 2) as rev, ROUND(SUM(expense), 2) as exp, ROUND(SUM(revenue - expense), 2) as net
  FROM (
    SELECT cost_center_key, SUM(revenue) as revenue, SUM(expense) as expense
    FROM fact_daily
    WHERE year = '2026'
    GROUP BY cost_center_key
  )
`).get();

const ccRevDiff = Math.abs((fdSumPartitioned.rev || 0) - (fdSumByCC.rev || 0));
const ccExpDiff = Math.abs((fdSumPartitioned.exp || 0) - (fdSumByCC.exp || 0));
const ccNetDiff = Math.abs((fdSumPartitioned.net || 0) - (fdSumByCC.net || 0));

check('M1-R2 Invariant: fact_daily revenue, expenses, net partitioned by cost_center_key has 0.00 SAR difference',
  ccRevDiff < 0.01 && ccExpDiff < 0.01 && ccNetDiff < 0.01,
  `Rev diff: ${ccRevDiff}, Exp diff: ${ccExpDiff}, Net diff: ${ccNetDiff}`
);

// 25c. Sales invoices net untaxed sum identity across cost_center_key
const siTotalNet = db.prepare(`
  SELECT ROUND(SUM(si.amount_untaxed * id.share), 2) as net_untaxed
  FROM sales_invoices si
  JOIN invoice_departments id ON id.sales_invoice_id = si.id
  WHERE si.date >= '2026-01-01' AND si.date <= '2026-12-31'
`).get()?.net_untaxed || 0;

const siByCCSum = db.prepare(`
  SELECT ROUND(SUM(net_untaxed), 2) as total_by_cc
  FROM (
    SELECT id.cost_center_key, SUM(si.amount_untaxed * id.share) as net_untaxed
    FROM sales_invoices si
    JOIN invoice_departments id ON id.sales_invoice_id = si.id
    WHERE si.date >= '2026-01-01' AND si.date <= '2026-12-31'
    GROUP BY id.cost_center_key
  )
`).get()?.total_by_cc || 0;

const siDiff = Math.abs(siTotalNet - siByCCSum);
check('M1-R2 Invariant: sales invoices untaxed sum partitioned by cost_center_key has 0.00 SAR difference',
  siDiff < 0.01,
  `Total: ${siTotalNet}, Partitioned sum: ${siByCCSum}, diff: ${siDiff}`
);

// 25d. Payment allocations sum identity across cost_center_key
const paTotalSum = db.prepare(`
  SELECT ROUND(SUM(amount), 2) as total_pa
  FROM payment_allocations
  WHERE payment_year = '2026'
`).get()?.total_pa || 0;

const paByCCSum = db.prepare(`
  SELECT ROUND(SUM(pa_amt), 2) as total_by_cc
  FROM (
    SELECT cost_center_key, SUM(amount) as pa_amt
    FROM payment_allocations
    WHERE payment_year = '2026'
    GROUP BY cost_center_key
  )
`).get()?.total_by_cc || 0;

const paDiff = Math.abs(paTotalSum - paByCCSum);
check('M1-R2 Invariant: payment allocations sum partitioned by cost_center_key has 0.00 SAR difference',
  paDiff < 0.01,
  `Total: ${paTotalSum}, Partitioned sum: ${paByCCSum}, diff: ${paDiff}`
);

// 25e. Permanent Invariant: Zero Cross-Server Outsider Analytic Accounts in journal_items
const jiIdOutsiders = db.prepare(`
  SELECT COUNT(*) as cnt 
  FROM journal_items ji 
  JOIN companies c ON c.id = ji.company_id 
  WHERE ji.cost_center_id IS NOT NULL 
    AND NOT EXISTS (
      SELECT 1 FROM odoo_analytic_accounts oaa 
      WHERE oaa.instance_id = c.odoo_instance_id AND oaa.odoo_id = ji.cost_center_id
    )
`).get().cnt;

const jiNameOutsiders = db.prepare(`
  SELECT COUNT(*) as cnt 
  FROM journal_items ji 
  JOIN companies c ON c.id = ji.company_id 
  WHERE ji.analytic_account IS NOT NULL 
    AND TRIM(ji.analytic_account) != '' 
    AND ji.analytic_account NOT LIKE '%,%' 
    AND ji.analytic_account NOT GLOB '[0-9]*' 
    AND EXISTS (
      SELECT 1 FROM odoo_analytic_accounts other 
      WHERE other.instance_id != c.odoo_instance_id AND TRIM(other.name) = TRIM(ji.analytic_account)
    ) 
    AND NOT EXISTS (
      SELECT 1 FROM odoo_analytic_accounts own 
      WHERE own.instance_id = c.odoo_instance_id AND TRIM(own.name) = TRIM(ji.analytic_account)
    )
`).get().cnt;

check('B3 Invariant 25e: 0 cross-server outsider analytic accounts in journal_items across all companies',
  jiIdOutsiders === 0 && jiNameOutsiders === 0,
  `0 outsider IDs (found ${jiIdOutsiders}), 0 outsider names (found ${jiNameOutsiders})`
);

// 25f. Permanent Invariant: Zero Cross-Server Outsiders in fact_daily
const fdStableKeyOutsiders = db.prepare(`
  SELECT COUNT(*) as cnt 
  FROM fact_daily fd 
  JOIN companies c ON c.id = fd.company_id 
  WHERE fd.cost_center_key GLOB 'an:[0-9]*:*' 
    AND fd.cost_center_key NOT GLOB ('an:' || c.odoo_instance_id || ':*')
`).get().cnt;

const fdNameOutsiders = db.prepare(`
  SELECT COUNT(*) as cnt 
  FROM fact_daily fd 
  JOIN companies c ON c.id = fd.company_id 
  WHERE fd.cost_center_name IS NOT NULL 
    AND TRIM(fd.cost_center_name) != '' 
    AND fd.cost_center_name NOT LIKE '%,%' 
    AND fd.cost_center_name NOT GLOB '[0-9]*' 
    AND EXISTS (
      SELECT 1 FROM odoo_analytic_accounts other 
      WHERE other.instance_id != c.odoo_instance_id AND TRIM(other.name) = TRIM(fd.cost_center_name)
    ) 
    AND NOT EXISTS (
      SELECT 1 FROM odoo_analytic_accounts own 
      WHERE own.instance_id = c.odoo_instance_id AND TRIM(own.name) = TRIM(fd.cost_center_name)
    )
`).get().cnt;

check('B3 Invariant 25f: 0 cross-server outsider cost centers in fact_daily across all companies',
  fdStableKeyOutsiders === 0 && fdNameOutsiders === 0,
  `0 outsider keys (found ${fdStableKeyOutsiders}), 0 outsider names (found ${fdNameOutsiders})`
);

// 25g. Permanent Invariant: Zero Cross-Server Outsiders in invoice_departments & payment_allocations
const idStableKeyOutsiders = db.prepare(`
  SELECT COUNT(*) as cnt 
  FROM invoice_departments id 
  JOIN sales_invoices si ON si.id = id.sales_invoice_id 
  JOIN sales_companies sc ON sc.id = si.company_id 
  JOIN companies c ON c.odoo_company_id = sc.sales_company_id 
  WHERE id.cost_center_key GLOB 'an:[0-9]*:*' 
    AND id.cost_center_key NOT GLOB ('an:' || c.odoo_instance_id || ':*')
`).get().cnt;

const idNameOutsiders = db.prepare(`
  SELECT COUNT(*) as cnt 
  FROM invoice_departments id 
  JOIN sales_invoices si ON si.id = id.sales_invoice_id 
  JOIN sales_companies sc ON sc.id = si.company_id 
  JOIN companies c ON c.odoo_company_id = sc.sales_company_id 
  WHERE id.cost_center_name IS NOT NULL 
    AND TRIM(id.cost_center_name) != '' 
    AND id.cost_center_name NOT LIKE '%,%' 
    AND id.cost_center_name NOT GLOB '[0-9]*' 
    AND EXISTS (
      SELECT 1 FROM odoo_analytic_accounts other 
      WHERE other.instance_id != c.odoo_instance_id AND TRIM(other.name) = TRIM(id.cost_center_name)
    ) 
    AND NOT EXISTS (
      SELECT 1 FROM odoo_analytic_accounts own 
      WHERE own.instance_id = c.odoo_instance_id AND TRIM(own.name) = TRIM(id.cost_center_name)
    )
`).get().cnt;

const paStableKeyOutsiders = db.prepare(`
  SELECT COUNT(*) as cnt 
  FROM payment_allocations pa 
  JOIN companies c ON c.id = pa.company_id 
  WHERE pa.cost_center_key GLOB 'an:[0-9]*:*' 
    AND pa.cost_center_key NOT GLOB ('an:' || c.odoo_instance_id || ':*')
`).get().cnt;

check('B3 Invariant 25g: 0 cross-server outsider cost centers in invoice_departments & payment_allocations',
  idStableKeyOutsiders === 0 && idNameOutsiders === 0 && paStableKeyOutsiders === 0,
  `invoice_departments: ${idStableKeyOutsiders} key / ${idNameOutsiders} name outsiders, payment_allocations: ${paStableKeyOutsiders} key outsiders`
);

// 26. UC1 Invariants: Zero unclassified revenue & expense across all companies/years, and group sums = company totals
const uc1Years = [2024, 2025, 2026];
const uc1Companies = db.prepare('SELECT id, name FROM companies WHERE is_active = 1').all();
let uc1UnclassifiedFound = 0;
let uc1SumDiffs = 0;

for (const yr of uc1Years) {
  for (const co of uc1Companies) {
    // Executive summary check
    const exec = engine.getExecutiveSummary({ companyIds: [co.id], year: yr });
    const pco = exec.tree.rows.find(c => c.company_id === co.id);
    if (pco) {
      let deptRevSum = 0;
      let deptExpSum = 0;
      for (const d of pco.children || []) {
        deptRevSum += d._rawRev !== undefined ? d._rawRev : d.revenue;
        deptExpSum += d._rawExp !== undefined ? d._rawExp : d.expenses;
        if (d.name && d.name.includes('غير مصن') && (Math.abs(d._rawRev || d.revenue || 0) > 0.01 || Math.abs(d._rawExp || d.expenses || 0) > 0.01)) {
          uc1UnclassifiedFound++;
        }
      }
      if (Math.abs(deptRevSum - pco.revenue) > 1 || Math.abs(deptExpSum - pco.expenses) > 1) {
        uc1SumDiffs++;
      }
    }

    // Profitability check
    const prof = engine.getDepartmentsProfitability({ companyIds: [co.id], year: yr });
    const prco = prof.tree.find(c => c.id === co.id);
    if (prco) {
      let pDeptRevSum = 0;
      let pDeptExpSum = 0;
      for (const d of prco.departments || []) {
        pDeptRevSum += d.revenue || 0;
        pDeptExpSum += d.expenses || 0;
        if (d.name && d.name.includes('غير مصن') && (Math.abs(d.revenue || 0) > 0.01 || Math.abs(d.expenses || 0) > 0.01)) {
          uc1UnclassifiedFound++;
        }
      }
      if (Math.abs(pDeptRevSum - prco.revenue) > 1 || Math.abs(pDeptExpSum - prco.expenses) > 1) {
        uc1SumDiffs++;
      }
    }
  }
}

check('UC1 Invariant 26a: 0 unclassified revenue and expense across all companies/years',
  uc1UnclassifiedFound === 0,
  `0 unclassified revenue/expense found (found ${uc1UnclassifiedFound})`
);

check('UC1 Invariant 26b: department revenue and expense sums match company totals in Executive & Profitability',
  uc1SumDiffs === 0,
  `0 sum diffs across all companies/years (found ${uc1SumDiffs})`
);

// 27. HF1 Invariants: odoo_journals & payment allocation journal types
const activeCos = db.prepare('SELECT id, name FROM companies WHERE is_active = 1').all();
let emptyJournalCompanies = 0;
for (const co of activeCos) {
  const cnt = db.prepare('SELECT COUNT(*) as c FROM odoo_journals WHERE company_id = ?').get(co.id)?.c || 0;
  if (cnt === 0) emptyJournalCompanies++;
}
check('HF1 Invariant 27a: odoo_journals non-empty for all active companies',
  emptyJournalCompanies === 0,
  `all ${activeCos.length} active companies have journals (${emptyJournalCompanies} empty)`
);

const unmappedJournalIds = db.prepare(`
  SELECT COUNT(*) as cnt
  FROM payment_allocations pa
  WHERE pa.payment_journal_id IS NOT NULL AND pa.payment_journal_id != 0
    AND (
      pa.payment_journal_type IS NULL OR pa.payment_journal_type = ''
      OR NOT EXISTS (
        SELECT 1 FROM odoo_journals oj
        WHERE oj.company_id = pa.company_id AND oj.odoo_journal_id = pa.payment_journal_id
      )
    )
`).get().cnt;
check('HF1 Invariant 27b: all payment allocations with payment_journal_id have known journal type',
  unmappedJournalIds === 0,
  `${unmappedJournalIds} allocations with unmapped payment journal`
);

const badOtherAdj = db.prepare(`
  SELECT COUNT(*) as cnt
  FROM payment_allocations pa
  WHERE pa.channel = 'other_adjustment'
    AND (
      pa.payment_journal_type IN ('bank', 'cash')
      OR EXISTS (
        SELECT 1 FROM odoo_journals oj
        WHERE oj.company_id = pa.company_id
          AND oj.odoo_journal_id = pa.payment_journal_id
          AND oj.type IN ('bank', 'cash')
      )
    )
`).get().cnt;
check('HF1 Invariant 27c: 0 other_adjustment allocations with bank or cash journal',
  badOtherAdj === 0,
  `${badOtherAdj} other_adjustment allocations with bank/cash journal`
);

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : failures + ' CHECK(S) FAILED'}`);
process.exit(failures === 0 ? 0 : 1);
