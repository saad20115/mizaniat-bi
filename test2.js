const db = require('./server/db/connection').getDb();
const results = db.prepare(`SELECT raw_data, company_id FROM sales_invoices WHERE partner_name LIKE '%روابط الحياة%' LIMIT 2`).all();
console.log(JSON.stringify(results.map(r => JSON.parse(r.raw_data)), null, 2));
