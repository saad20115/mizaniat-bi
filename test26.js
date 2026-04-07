const db = require('./server/db/connection').getDb();
const invs = db.prepare(`SELECT DISTINCT json_extract(raw_data, '$.journal_name') as jname FROM sales_invoices WHERE json_extract(raw_data, '$.journal_name') LIKE 'العقد الموحد%'`).all();
console.log(invs.map(i => i.jname));
