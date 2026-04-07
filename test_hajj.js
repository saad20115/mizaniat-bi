const Database = require('better-sqlite3');
const db = new Database('./data/mizaniat.db', { fileMustExist: true });

// Check: which company has "المجلس التنسيقي" invoices in journal_items?
console.log('=== المجلس التنسيقي - which company in journal_items? ===');
const majlis = db.prepare(`
  SELECT ji.company_id, c.name, ji.analytic_account, COUNT(*) as cnt
  FROM journal_items ji
  JOIN companies c ON c.id = ji.company_id
  WHERE ji.analytic_account LIKE '%المجلس التنسيقي%'
  GROUP BY ji.company_id
`).all();
majlis.forEach(r => console.log(`  Company ${r.company_id} (${r.name}): ${r.cnt} items | cc=${r.analytic_account}`));

// Check: which company has these invoices in sales_invoices?
console.log('\n=== المجلس التنسيقي invoices - which sales company? ===');
const majlisInvs = db.prepare(`
  SELECT si.name, si.company_id, sc.name as co_name, si.partner_name
  FROM sales_invoices si
  JOIN sales_companies sc ON sc.id = si.company_id
  JOIN journal_items ji ON ji.move_name = si.name AND ji.analytic_account LIKE '%المجلس التنسيقي%'
  GROUP BY si.name
  LIMIT 10
`).all();
majlisInvs.forEach(r => console.log(`  ${r.name} | sales_co=${r.company_id} (${r.co_name}) | partner=${r.partner_name}`));

// Also check: Company mapping interpretation
console.log('\n=== Company ID Mapping ===');
const salesCos = db.prepare('SELECT id, sales_company_id, name FROM sales_companies').all();
const masterCos = db.prepare('SELECT id, odoo_company_id, name FROM companies').all();
salesCos.forEach(sc => {
  const mc = masterCos.find(mc => mc.odoo_company_id === sc.sales_company_id);
  console.log(`  sales_co ${sc.id} -> master_co ${mc?.id || 'NONE'} : ${sc.name}`);
});

// Check: company 4 (sales) = company 2 (master), what analytic "مشاريع الحج" entries exist? 
console.log('\n=== Company 2 (master) - Hajj analytic entries ===');
const co2hajj = db.prepare(`
  SELECT ji.move_name, ji.analytic_account, COUNT(*) as cnt
  FROM journal_items ji
  WHERE ji.company_id = 2 AND ji.analytic_account LIKE '%المجلس%'
  GROUP BY ji.move_name
  LIMIT 10
`).all();
co2hajj.forEach(r => console.log(`  ${r.move_name}: ${r.analytic_account} (${r.cnt})`));

// And finally: what are the hajj mappings for Company 2 in the GROUP MAPPING table?
console.log('\n=== Group mapping for "مشاريع الحج" and "المجلس التنسيقي" ===');
const hajjMap = db.prepare(`
  SELECT m.analytic_account, m.journal_name, g.name 
  FROM analytic_group_mapping m
  JOIN analytic_groups g ON g.id = m.group_id
  WHERE m.analytic_account LIKE '%المجلس%' OR g.name LIKE '%حج%'
`).all();
hajjMap.forEach(r => console.log(`  group=${r.name} | cc=${r.analytic_account} | journal=${r.journal_name}`));
