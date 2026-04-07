const db = require('./server/db/connection').getDb();
const invoices = db.prepare(`SELECT raw_data FROM sales_invoices WHERE partner_name LIKE '%روابط الحياة%' AND raw_data LIKE '%Credit Note%'`).all();
console.log(JSON.stringify(invoices.map(i=>JSON.parse(i.raw_data)), null, 2));
