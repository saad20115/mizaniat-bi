const DB = require('better-sqlite3');
const db = new DB('data/mizaniat.db');
const row = db.prepare("SELECT raw_data FROM sales_invoices WHERE raw_data IS NOT NULL LIMIT 1").get();
if (row && row.raw_data) {
  const parsed = JSON.parse(row.raw_data);
  console.log(JSON.stringify(Object.keys(parsed), null, 2));
} else {
  console.log('No data found');
}
