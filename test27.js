const db = require('./server/db/connection').getDb();
const invs = db.prepare(`SELECT raw_data FROM sales_invoices WHERE company_name LIKE '%جمال%' LIMIT 5`).all();
console.log(JSON.stringify(invs.map(i=>JSON.parse(i.raw_data)), null, 2));
