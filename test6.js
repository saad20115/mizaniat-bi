const db = require('./server/db/connection').getDb();
const invoices = db.prepare(`SELECT raw_data FROM sales_invoices WHERE partner_name LIKE '%روابط الحياة%' LIMIT 1`).all();
const inv = JSON.parse(invoices[0].raw_data);
const invJg = inv.journal_name.trim();

const mappingsDb = db.prepare(`SELECT m.analytic_account as cost_center, m.journal_name, g.name as group_name FROM analytic_group_mapping m JOIN analytic_groups g ON g.id = m.group_id WHERE m.journal_name LIKE '%مختبر جدة%' LIMIT 1`).all();
const mapJg = mappingsDb[0].journal_name.trim();

console.log("INV length:", invJg.length);
console.log("INV charcodes:", Array.from(invJg).map(c => c.charCodeAt(0)));
console.log("MAP length:", mapJg.length);
console.log("MAP charcodes:", Array.from(mapJg).map(c => c.charCodeAt(0)));
console.log("EQUAL?", invJg === mapJg);
