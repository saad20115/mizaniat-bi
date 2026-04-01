const db = require('./node_modules/better-sqlite3')('data/mizaniat.db');
const rows = db.prepare(`SELECT DISTINCT partner_name, SUM(amount_total) FROM sales_invoices WHERE partner_name LIKE '%السعودي%طاق%' AND date LIKE '2026%' AND LOWER(state) = 'posted' GROUP BY partner_name`).all();
console.log(rows);
