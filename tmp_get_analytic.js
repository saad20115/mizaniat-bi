const db = require('better-sqlite3')('data/mizaniat.db');
const res = db.prepare(`SELECT DISTINCT analytic_account FROM journal_items WHERE analytic_account LIKE '%حج%' OR analytic_account LIKE '%تنسيقي%' OR analytic_account LIKE '%Hajj%'`).all();
console.log(JSON.stringify(res, null, 2));
process.exit(0);
