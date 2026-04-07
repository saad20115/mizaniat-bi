const db = require('./server/db/connection').getDb();
const invoices = db.prepare(`SELECT raw_data FROM sales_invoices WHERE partner_name LIKE '%الميال%' LIMIT 2`).all();
console.log(JSON.stringify(invoices.map(r=>JSON.parse(r.raw_data)), null, 2));
