const db = require('./node_modules/better-sqlite3')('data/mizaniat.db');
const refunds = db.prepare("SELECT COUNT(*) as c FROM sales_invoices WHERE json_extract(raw_data, '$.move_type') LIKE '%Refund%' OR json_extract(raw_data, '$.move_type') LIKE '%Credit Note%'").get();
const allTypes = db.prepare("SELECT json_extract(raw_data, '$.move_type') as t, COUNT(*) as c FROM sales_invoices GROUP BY t").all();
console.log('Refund count:', refunds);
console.log('Move types:', allTypes);

const sampleRefund = db.prepare("SELECT raw_data FROM sales_invoices WHERE json_extract(raw_data, '$.move_type') LIKE '%Credit Note%' LIMIT 1").get();
if (sampleRefund) {
  console.log('Sample Refund:', JSON.parse(sampleRefund.raw_data));
}
