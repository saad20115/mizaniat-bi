const db = require('./node_modules/better-sqlite3')('data/mizaniat.db');
const rows = db.prepare(`SELECT state, invoice_number, amount_total FROM sales_invoices WHERE partner_name LIKE '%الشركة السعودية للطاقة%' AND date LIKE '2026%' AND amount_total = 12237.70`).all();
const draftRows = db.prepare(`SELECT state, invoice_number, amount_total FROM sales_invoices WHERE partner_name LIKE '%الشركة السعودية للطاقة%' AND date LIKE '2026%' AND LOWER(state) = 'draft'`).all();
console.log('Specific invoice:', rows);
console.log('Draft invoices:', draftRows);
