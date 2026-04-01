const db = require('./node_modules/better-sqlite3')('data/mizaniat.db');
const rows = db.prepare(`SELECT state, name, date, amount_total FROM sales_invoices WHERE partner_name LIKE '%الشركة السعودية للطاقة%' AND amount_total BETWEEN 12000 AND 12500`).all();
console.log('All invoices between 12000 and 12500:', rows);
