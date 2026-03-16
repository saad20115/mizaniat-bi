const db = require('better-sqlite3')('./data/mizaniat.db');

// Check cost_center data
const cc = db.prepare(`
  SELECT cost_center_id, analytic_account, COUNT(*) as cnt
  FROM journal_items
  WHERE company_id=2 AND cost_center_id IS NOT NULL AND cost_center_id!=''
  AND move_state='posted' AND date>='2024-01-01' AND date<='2024-12-31'
  GROUP BY cost_center_id
  ORDER BY cnt DESC LIMIT 10
`).all();
console.log('=== Cost Centers (company 2, 2024) ===');
cc.forEach(r => console.log(`CC: "${r.cost_center_id}" | Analytic: "${r.analytic_account}" | Entries: ${r.cnt}`));

// Check analytic_account data
const aa = db.prepare(`
  SELECT analytic_account, COUNT(*) as cnt
  FROM journal_items
  WHERE company_id=2 AND analytic_account IS NOT NULL AND analytic_account!=''
  AND move_state='posted' AND date>='2024-01-01' AND date<='2024-12-31'
  GROUP BY analytic_account
  ORDER BY cnt DESC LIMIT 10
`).all();
console.log('\n=== Analytic Accounts (company 2, 2024) ===');
aa.forEach(r => console.log(`"${r.analytic_account}" | Entries: ${r.cnt}`));

// Revenue by cost center
const revCC = db.prepare(`
  SELECT COALESCE(analytic_account,'بدون مركز') as cc,
    SUM(credit)-SUM(debit) as rev
  FROM journal_items
  WHERE company_id=2 AND account_type IN ('income','income_other')
  AND move_state='posted' AND date>='2024-01-01' AND date<='2024-12-31'
  GROUP BY cc ORDER BY rev DESC LIMIT 10
`).all();
console.log('\n=== Revenue by Cost Center (company 2, 2024) ===');
revCC.forEach(r => console.log(`"${r.cc}" | Revenue: ${r.rev?.toFixed(0)}`));

// Financial accounts
const accts = db.prepare(`
  SELECT account_code, account_name, account_type,
    SUM(debit) as d, SUM(credit) as c
  FROM journal_items
  WHERE company_id=2 AND account_type IN ('income','income_other','expense','expense_direct')
  AND move_state='posted' AND date>='2024-01-01' AND date<='2024-12-31'
  GROUP BY account_code ORDER BY (SUM(debit)+SUM(credit)) DESC LIMIT 10
`).all();
console.log('\n=== Top Financial Accounts (company 2, 2024) ===');
accts.forEach(r => console.log(`${r.account_code} ${r.account_name} (${r.account_type}) D:${r.d?.toFixed(0)} C:${r.c?.toFixed(0)}`));

// Stats
const stats = db.prepare(`
  SELECT 
    COUNT(DISTINCT CASE WHEN analytic_account IS NOT NULL AND analytic_account!='' THEN analytic_account END) as cc_count,
    COUNT(DISTINCT account_code) as acct_count,
    COUNT(DISTINCT partner_name) as partner_count
  FROM journal_items WHERE company_id=2 AND move_state='posted'
`).get();
console.log(`\nStats: Cost Centers=${stats.cc_count}, Accounts=${stats.acct_count}, Partners=${stats.partner_count}`);
