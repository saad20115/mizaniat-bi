const Database = require('better-sqlite3');
const db = new Database('./data/mizaniat.db', { fileMustExist: true });

// Which company does "عميل نقدي تراخيص سكن جماعي" belong to in sales_invoices?
console.log('=== 1. "عميل نقدي تراخيص سكن جماعي" invoices ===');
const inv = db.prepare(`
  SELECT si.name, si.company_id, sc.name as co_name, si.partner_name, si.amount_total, si.raw_data
  FROM sales_invoices si
  JOIN sales_companies sc ON sc.id = si.company_id
  WHERE si.partner_name LIKE '%تراخيص سكن%' OR si.partner_name LIKE '%نقدي%'
`).all();
inv.forEach(r => {
  let jn = '';
  try { const p = JSON.parse(r.raw_data || '{}'); jn = p.journal_name || ''; } catch(e) {}
  console.log(`  ${r.name} | sales_co=${r.company_id} (${r.co_name}) | partner=${r.partner_name} | amt=${r.amount_total} | journal=${jn}`);
});

// Check journal_items for these invoices to see which analytic_account they get
console.log('\n=== 2. journal_items for these invoices ===');
inv.forEach(r => {
  const ji = db.prepare(`
    SELECT ji.company_id, c.name as co_name, ji.analytic_account, ji.move_name
    FROM journal_items ji
    JOIN companies c ON c.id = ji.company_id
    WHERE ji.move_name = ?
  `).all(r.name);
  if (ji.length > 0) {
    ji.forEach(j => console.log(`  ${r.name} -> ji_co=${j.company_id} (${j.co_name}) | cc=${j.analytic_account}`));
  } else {
    console.log(`  ${r.name} -> NO journal_items match`);
  }
});

// Also check: "المختبر البيئي" group mapping
console.log('\n=== 3. "المختبر البيئي" group mapping ===');
const envMap = db.prepare(`
  SELECT m.analytic_account, m.journal_name, g.name 
  FROM analytic_group_mapping m
  JOIN analytic_groups g ON g.id = m.group_id
  WHERE g.name LIKE '%المختبر البيئي%'
`).all();
envMap.forEach(r => console.log(`  group=${r.name} | cc=${r.analytic_account} | journal=${r.journal_name}`));

// Also check: "قسم الاشراف" mapping  
console.log('\n=== 4. "قسم الاشراف" group mapping ===');
const eshrafMap = db.prepare(`
  SELECT m.analytic_account, m.journal_name, g.name 
  FROM analytic_group_mapping m
  JOIN analytic_groups g ON g.id = m.group_id
  WHERE g.name LIKE '%اشراف%' OR m.analytic_account LIKE '%رخص%' OR m.analytic_account LIKE '%خبر%'
`).all();
eshrafMap.forEach(r => console.log(`  group=${r.name} | cc=${r.analytic_account} | journal=${r.journal_name}`));

// Check: What analytic_account does "رخص السكن" map to in journal_items for company 3 (master)?
console.log('\n=== 5. journal_items with analytic like "رخص" or "تشغيلي" for company 3 ===');
const co3 = db.prepare(`
  SELECT ji.move_name, ji.analytic_account, ji.company_id
  FROM journal_items ji
  WHERE ji.company_id = 3 AND (ji.analytic_account LIKE '%رخص%' OR ji.analytic_account LIKE '%تشغيلي%')
  LIMIT 10
`).all();
co3.forEach(r => console.log(`  ${r.move_name} | co=${r.company_id} | cc=${r.analytic_account}`));

// What does "تشغيلي" map to?
console.log('\n=== 6. "تشغيلي" mapping ===');
const tashMap = db.prepare(`
  SELECT m.analytic_account, m.journal_name, g.name 
  FROM analytic_group_mapping m
  JOIN analytic_groups g ON g.id = m.group_id
  WHERE m.analytic_account LIKE '%تشغيلي%'
`).all();
tashMap.forEach(r => console.log(`  group=${r.name} | cc=${r.analytic_account} | journal=${r.journal_name}`));
