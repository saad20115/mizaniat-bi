const { getDb } = require('./server/db/connection');
const db = getDb();
const results = db.prepare('SELECT raw_data FROM sales_invoices WHERE partner_name LIKE "%روابط الحياة%" LIMIT 2').all();
require('fs').writeFileSync('tmp_links.json', JSON.stringify(results.map(r => JSON.parse(r.raw_data)), null, 2));
