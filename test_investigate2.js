const Database = require('better-sqlite3');
const db = new Database('./data/mizaniat.db', { fileMustExist: true });

// 1. Groups (no company_id)
console.log('=== 1. Analytic Groups ===');
const groups = db.prepare('SELECT * FROM analytic_groups').all();
groups.forEach(g => console.log(`  id=${g.id} | name=${g.name}`));

// 2. Group Mapping columns
console.log('\n=== 2. analytic_group_mapping columns ===');
db.prepare("PRAGMA table_info('analytic_group_mapping')").all().forEach(c => console.log(`  ${c.name} (${c.type})`));

// 3. Group Mappings  
console.log('\n=== 3. All Group Mappings ===');
const mappings = db.prepare(`
  SELECT m.*, g.name as group_name
  FROM analytic_group_mapping m
  JOIN analytic_groups g ON g.id = m.group_id
`).all();
mappings.forEach(m => {
  const keys = Object.keys(m).filter(k => !['group_name'].includes(k));
  const extra = keys.map(k => `${k}=${m[k]}`).join(' | ');
  console.log(`  group=${m.group_name} | ${extra}`);
});

// 4. Sales Companies
console.log('\n=== 4. Sales Companies ===');
db.prepare('SELECT * FROM sales_companies').all().forEach(c => console.log(`  id=${c.id} | name=${c.name} | sales_company_id=${c.sales_company_id}`));

// 5. Master Companies
console.log('\n=== 5. Master Companies ===');
const masterCos = db.prepare('SELECT id, name, odoo_company_id FROM companies').all();
masterCos.forEach(c => console.log(`  id=${c.id} | name=${c.name} | odoo_id=${c.odoo_company_id}`));

// 6. journal_items per company - analytic_accounts
console.log('\n=== 6. Analytic accounts per company (journal_items) ===');
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

// 7. Check: which company's invoices are being classified as "مشاريع الحج" by looking at sales_invoices 
// with move_names that match journal_items with analytic_account related to Hajj
console.log('\n=== 7. Sales invoices where journal_items links to مشاريع حج analytic ===');
// First find Hajj-related analytic accounts from mappings
const hajjMappings = db.prepare(`
  SELECT m.analytic_account FROM analytic_group_mapping m
  JOIN analytic_groups g ON g.id = m.group_id
  WHERE g.name LIKE '%حج%'
`).all();
console.log('  Hajj cost centers:', hajjMappings.map(m => m.analytic_account).join(', '));

// Check which companies have invoices with these analytic accounts
const hajjCCs = hajjMappings.map(m => m.analytic_account);
if (hajjCCs.length > 0) {
  const placeholders = hajjCCs.map(() => '?').join(',');
  const invsByCo = db.prepare(`
    SELECT ji.company_id, c.name as company_name, ji.analytic_account, COUNT(DISTINCT ji.move_name) as inv_count
    FROM journal_items ji
    LEFT JOIN companies c ON c.id = ji.company_id
    WHERE ji.analytic_account IN (${placeholders})
    AND ji.move_name IS NOT NULL
    GROUP BY ji.company_id, ji.analytic_account
    ORDER BY ji.company_id
  `).all(...hajjCCs);
  
  invsByCo.forEach(r => {
    console.log(`  Company ${r.company_id} (${r.company_name}): ${r.analytic_account} -> ${r.inv_count} invoices`);
  });
}

// 8. Cross-check: Sales invoice from company 3 (مكتب المهندس سمير) that has a journal_items with analytic matching Hajj
console.log('\n=== 8. Sample: Company 3 invoices matched to Hajj ===');
const co3hajj = db.prepare(`
  SELECT si.name, si.partner_name, si.company_id, sc.name as company_name, ji.analytic_account
  FROM sales_invoices si
  JOIN sales_companies sc ON sc.id = si.company_id
  JOIN journal_items ji ON ji.move_name = si.name
  WHERE si.company_id = 3
  AND ji.analytic_account IN (${hajjCCs.map(()=>'?').join(',')})
  GROUP BY si.name
  LIMIT 10
`).all(...hajjCCs);
co3hajj.forEach(r => {
  console.log(`  ${r.name} | ${r.partner_name} | salesco=${r.company_id} (${r.company_name}) | cc=${r.analytic_account}`);
});

// 9. The CORE problem: do move_names overlap between companies?
console.log('\n=== 9. Move names that exist in BOTH sales_invoices AND journal_items from DIFFERENT companies ===');
const overlap = db.prepare(`
  SELECT si.name, si.company_id as sales_co, sc.name as sales_co_name, 
         ji.company_id as ji_co, c.name as ji_co_name, ji.analytic_account
  FROM sales_invoices si
  JOIN sales_companies sc ON sc.id = si.company_id
  JOIN journal_items ji ON ji.move_name = si.name
  JOIN companies c ON c.id = ji.company_id
  WHERE ji.analytic_account IS NOT NULL AND ji.analytic_account != ''
  GROUP BY si.name, si.company_id, ji.company_id
  HAVING si.company_id != ji.company_id
  LIMIT 20
`).all();
if (overlap.length === 0) {
  console.log('  No cross-company overlap detected');
} else {
  console.log(`  Found ${overlap.length} cross-company overlaps!`);
  overlap.forEach(r => {
    console.log(`  ${r.name}: sales_co=${r.sales_co}(${r.sales_co_name}) vs ji_co=${r.ji_co}(${r.ji_co_name}) cc=${r.analytic_account}`);
  });
}
