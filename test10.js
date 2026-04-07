const db = require('./server/db/connection').getDb();
const invs = db.prepare(`SELECT raw_data FROM sales_invoices WHERE partner_name LIKE '%روابط الحياة%' AND (raw_data LIKE '%Credit Note%' OR amount_total < 0)`).all();
console.log(JSON.stringify(invs.map(i=>JSON.parse(i.raw_data)), null, 2));
