// Find the mapping between sales_companies and companies
const Database = require('better-sqlite3');
const db = new Database('./data/mizaniat.db', { fileMustExist: true });

console.log('=== Sales Companies -> Master Companies Mapping ===');
const salesCos = db.prepare('SELECT * FROM sales_companies').all();
const masterCos = db.prepare('SELECT * FROM companies').all();

salesCos.forEach(sc => {
  // Try to match by odoo_company_id or name
  const byOdoo = masterCos.find(mc => mc.odoo_company_id === sc.sales_company_id);
  const byName = masterCos.find(mc => mc.name === sc.name || sc.name.includes(mc.name) || mc.name.includes(sc.name));
  const match = byOdoo || byName;
  console.log(`  sales_co id=${sc.id} (${sc.name}) | sales_company_id=${sc.sales_company_id}`);
  console.log(`    -> master_co id=${match?.id || 'NONE'} (${match?.name || 'NONE'}) | odoo_id=${match?.odoo_company_id || 'NONE'}`);
});

// Also check: sales_companies columns  
console.log('\n=== sales_companies columns ===');
db.prepare("PRAGMA table_info('sales_companies')").all().forEach(c => console.log(`  ${c.name} (${c.type})`));

console.log('\n=== sales_invoices columns (relevant) ===');
db.prepare("PRAGMA table_info('sales_invoices')").all()
  .filter(c => ['id','name','company_id','partner_name','state'].includes(c.name))
  .forEach(c => console.log(`  ${c.name} (${c.type})`));
