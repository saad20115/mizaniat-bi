const db = require('better-sqlite3')('data/mizaniat.db');

const c = db.prepare('SELECT id, odoo_id, name FROM companies').all();
const sc = db.prepare('SELECT id, sales_company_id, name FROM sales_companies').all();

console.log('--- COMPANIES ---');
console.table(c);

console.log('\n--- SALES COMPANIES ---');
console.table(sc);

console.log('\n--- MAPPING TEST ---');
c.forEach(comp => {
  const mapped = db.prepare(`
    SELECT sc.id, sc.name 
    FROM sales_companies sc
    JOIN companies c ON (c.odoo_id = sc.sales_company_id OR c.name = sc.name)
    WHERE c.id = ?
  `).all(comp.id);
  console.log(`Master Company [ID: ${comp.id}] "${comp.name}" maps to Sales Companies:`, mapped);
});

console.log('\n--- INVOICE DISTRIBUTION ---');
const dist = db.prepare(`SELECT company_id, count(*) as count FROM sales_invoices GROUP BY company_id`).all();
console.table(dist);
