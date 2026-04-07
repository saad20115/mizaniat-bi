// Deep investigation: understand the company-specific mapping structure
const Database = require('better-sqlite3');
const db = new Database('./data/mizaniat.db', { fileMustExist: true });

// 1. Check analytic_groups structure (do groups belong to specific companies?)
console.log('=== 1. Analytic Groups ===');
const groups = db.prepare('SELECT * FROM analytic_groups').all();
groups.forEach(g => console.log(`  id=${g.id} | name=${g.name} | company_id=${g.company_id || 'NULL'}`));

// 2. Check analytic_group_mapping structure
console.log('\n=== 2. Group Mappings (sample) ===');
const mappings = db.prepare(`
  SELECT m.*, g.name as group_name, g.company_id as group_company_id
  FROM analytic_group_mapping m
  JOIN analytic_groups g ON g.id = m.group_id
  LIMIT 20
`).all();
mappings.forEach(m => console.log(`  group=${m.group_name} | cc=${m.analytic_account} | journal=${m.journal_name} | group_co=${m.group_company_id || 'NULL'} | map_co=${m.company_id || 'NULL'}`));

// 3. Check sales_companies
console.log('\n=== 3. Sales Companies ===');
const salesCos = db.prepare('SELECT * FROM sales_companies').all();
salesCos.forEach(c => console.log(`  id=${c.id} | name=${c.name} | sales_company_id=${c.sales_company_id}`));

// 4. Check companies (master)
console.log('\n=== 4. Master Companies ===');
const masterCos = db.prepare('SELECT id, name, odoo_company_id FROM companies').all();
masterCos.forEach(c => console.log(`  id=${c.id} | name=${c.name} | odoo_id=${c.odoo_company_id}`));

// 5. Which groups exist for which companies?
console.log('\n=== 5. Groups per Company ===');
const groupsByCo = db.prepare(`
  SELECT g.company_id, c.name as company_name, g.name as group_name
  FROM analytic_groups g
  LEFT JOIN companies c ON c.id = g.company_id
  ORDER BY g.company_id, g.name
`).all();
groupsByCo.forEach(g => console.log(`  co_id=${g.company_id} | co=${g.company_name || 'NULL'} | group=${g.group_name}`));

// 6. Check journal_items - does it have company_id?
console.log('\n=== 6. journal_items columns ===');
const jiCols = db.prepare("PRAGMA table_info('journal_items')").all();
jiCols.forEach(c => console.log(`  ${c.name} (${c.type})`));

// 7. Check which company_ids have "مشاريع الحج" in analytic_group_mapping
console.log('\n=== 7. "مشاريع الحج" mapping details ===');
const hajjMappings = db.prepare(`
  SELECT m.*, g.name as group_name, g.company_id as group_company_id
  FROM analytic_group_mapping m
  JOIN analytic_groups g ON g.id = m.group_id
  WHERE g.name LIKE '%حج%'
`).all();
hajjMappings.forEach(m => console.log(`  cc=${m.analytic_account} | journal=${m.journal_name} | group_co=${m.group_company_id}`));

// 8. Check which sales invoices show "مشاريع الحج" incorrectly 
// by checking what analytic_account exists in journal_items for each company
console.log('\n=== 8. Sample: analytic_accounts per company in journal_items ===');
const ccPerCo = db.prepare(`
  SELECT company_id, analytic_account, COUNT(*) as cnt
  FROM journal_items 
  WHERE analytic_account IS NOT NULL AND analytic_account != ''
  GROUP BY company_id, analytic_account
  ORDER BY company_id, cnt DESC
`).all();

let lastCo = null;
ccPerCo.forEach(r => {
  if (r.company_id !== lastCo) {
    const coName = masterCos.find(c => c.id === r.company_id)?.name || 'Unknown';
    console.log(`\n  Company ${r.company_id} (${coName}):`);
    lastCo = r.company_id;
  }
  console.log(`    ${r.analytic_account}: ${r.cnt} items`);
});
