const db = require('./node_modules/better-sqlite3')('data/mizaniat.db');
const rows = db.prepare("SELECT raw_data FROM sales_invoices LIMIT 5").all();
console.log(JSON.stringify(rows.map(r => JSON.parse(r.raw_data)), null, 2));
