const db = require('./node_modules/better-sqlite3')('data/mizaniat.db');
const rows = db.prepare(`SELECT company_id, json_extract(raw_data, '$.move_type') as mt, state, SUM(amount_total) as tot, SUM(CAST(json_extract(raw_data, '$.amount_untaxed') AS REAL)) as untax, SUM(CAST(json_extract(raw_data, '$.total_paid') AS REAL)) as paid FROM sales_invoices WHERE partner_name LIKE '%الشركة السعودية للطاقة%' AND date LIKE '2026%' AND LOWER(state) IN ('posted') GROUP BY company_id, mt`).all();
console.log(rows);
