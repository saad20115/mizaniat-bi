const db = require('./server/db/connection').getDb();
const invs = db.prepare(`SELECT raw_data FROM sales_invoices WHERE partner_name LIKE '%الشركة السعودية للطاقة%' LIMIT 10`).all();
console.log(JSON.stringify(invs.map(i=>JSON.parse(i.raw_data)), null, 2));
