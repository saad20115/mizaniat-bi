const Database = require('better-sqlite3');
const db = new Database('./data/mizaniat.db', { fileMustExist: true, timeout: 5000 });
const rows = db.prepare(`SELECT move_name, analytic_account FROM journal_items WHERE move_name LIKE '%INV%' AND analytic_account IS NOT NULL AND analytic_account != '' LIMIT 10`).all();
console.log(rows);
