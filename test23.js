const db = require('./server/db/connection').getDb();
const inv = db.prepare(`SELECT raw_data FROM sales_invoices WHERE name LIKE '%INVJ/2025/00117%'`).all();
console.log(JSON.stringify(inv.map(i=>JSON.parse(i.raw_data)), null, 2));
