const db = require('./node_modules/better-sqlite3')('data/mizaniat.db');

// Check: how many invoices does the API return vs what we store?
// The sync says 8067 records were synced for company 4
// But how many are for Saudi Energy?
const totalCompany4 = db.prepare(`SELECT COUNT(*) as cnt FROM sales_invoices WHERE company_id = 4`).get();
console.log('Total records in DB for company 4:', totalCompany4.cnt);

// Check the Aboghalia API directly to see how many invoices it returns
const instance = db.prepare(`SELECT si.* FROM sales_instances si JOIN sales_companies sc ON sc.sales_instance_id = si.id WHERE sc.id = 4`).get();
console.log('\nInstance config:', instance ? { url: instance.url, user: instance.username } : 'NOT FOUND');

// Check: the refunds coming from JSON-RPC for Saudi Energy
const refunds = db.prepare(`
  SELECT name, partner_name, date, amount_total, 
         json_extract(raw_data, '$.move_type') as mt,
         json_extract(raw_data, '$.ref') as ref
  FROM sales_invoices 
  WHERE partner_name LIKE '%السعودي%طاق%' 
    AND partner_name NOT LIKE '%دلتا%'
    AND date LIKE '2026%' 
    AND LOWER(state) = 'posted'
    AND json_extract(raw_data, '$.move_type') = 'Customer Credit Note'
`).all();
console.log('\n=== Credit Notes for Saudi Energy 2026 ===');
console.table(refunds);
console.log('Total credit notes:', refunds.length);

// The big question: are the Credit Notes being stored but categorized differently?
// Or are there invoices in Odoo that the API doesn't return?

// Let's check a raw sample to see the data structure
const sample = db.prepare(`
  SELECT raw_data FROM sales_invoices 
  WHERE partner_name = 'الشركة السعودية للطاقة' 
    AND date LIKE '2026%' 
    AND LOWER(state) = 'posted'
  ORDER BY amount_total DESC
  LIMIT 1
`).get();
console.log('\n=== Sample raw_data (largest invoice) ===');
console.log(JSON.parse(sample.raw_data));

// Check: are there any out_refund entries from the regular API (not JSON-RPC)?
const outRefund = db.prepare(`
  SELECT COUNT(*) as cnt, SUM(amount_total) as tot 
  FROM sales_invoices 
  WHERE partner_name LIKE '%السعودي%طاق%' 
    AND partner_name NOT LIKE '%دلتا%'
    AND date LIKE '2026%' 
    AND (json_extract(raw_data, '$.move_type') = 'out_refund' 
         OR json_extract(raw_data, '$.move_type') = 'Customer Credit Note')
`).get();
console.log('\n=== All refund-type entries ===');
console.log(outRefund);

// Critical: The Odoo numbers include credit notes
// Odoo Total = 8,248,243.85 (net: invoices + credit notes)
// Our DB: Invoices = 7,536,622.92 (gross, with corrupted names)
// Our DB: Credit Notes = 0 (for this partner!)
// Difference = 711,620.93
// This means the refund entries from JSON-RPC were NOT associated with this partner!

// Let's check ALL credit notes in 2026
const allRefunds = db.prepare(`
  SELECT partner_name, COUNT(*) as cnt, SUM(amount_total) as tot
  FROM sales_invoices 
  WHERE date LIKE '2026%' 
    AND json_extract(raw_data, '$.move_type') = 'Customer Credit Note'
  GROUP BY partner_name
  ORDER BY tot ASC
  LIMIT 20
`).all();
console.log('\n=== All Credit Notes by partner 2026 ===');
console.table(allRefunds);
