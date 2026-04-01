const db = require('./node_modules/better-sqlite3')('data/mizaniat.db');
const rows = db.prepare(`SELECT partner_name, name, state, amount_total FROM sales_invoices WHERE amount_total BETWEEN 12230 AND 12240 AND date LIKE '2026%' AND LOWER(state) = 'posted'`).all();
console.log(rows);
