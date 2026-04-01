const db = require('./node_modules/better-sqlite3')('data/mizaniat.db');

// 1. All entries for this partner in 2026 (any name variant)
const all = db.prepare(`
  SELECT partner_name, 
         json_extract(raw_data, '$.move_type') as mt, 
         COUNT(*) as cnt, 
         SUM(amount_total) as tot, 
         SUM(CAST(json_extract(raw_data, '$.amount_untaxed') AS REAL)) as untax,
         SUM(CAST(json_extract(raw_data, '$.total_paid') AS REAL)) as paid
  FROM sales_invoices 
  WHERE partner_name LIKE '%السعودي%طاق%' 
    AND date LIKE '2026%' 
    AND LOWER(state) = 'posted'
  GROUP BY partner_name, mt
`).all();
console.log('=== All partner name variants for Saudi Energy 2026 ===');
console.table(all);

// 2. Check total count
const count = db.prepare(`
  SELECT COUNT(*) as cnt FROM sales_invoices 
  WHERE partner_name LIKE '%السعودي%طاق%' 
    AND date LIKE '2026%' 
    AND LOWER(state) = 'posted'
`).get();
console.log('\nTotal invoice count:', count.cnt);

// 3. Check the corrupted name entries more closely
const corrupted = db.prepare(`
  SELECT name, partner_name, date, amount_total, 
         json_extract(raw_data, '$.move_type') as mt,
         json_extract(raw_data, '$.amount_untaxed') as untax
  FROM sales_invoices 
  WHERE partner_name LIKE '%السعودي%طاق%' 
    AND partner_name != 'الشركة السعودية للطاقة'
    AND partner_name NOT LIKE '%دلتا%'
    AND date LIKE '2026%'
`).all();
console.log('\n=== Corrupted name entries ===');
console.table(corrupted);

// 4. Grand total calculation (what Odoo should show)
const grandInv = db.prepare(`
  SELECT SUM(amount_total) as tot, 
         SUM(CAST(json_extract(raw_data, '$.amount_untaxed') AS REAL)) as untax,
         SUM(CAST(json_extract(raw_data, '$.total_paid') AS REAL)) as paid
  FROM sales_invoices 
  WHERE partner_name LIKE '%السعودي%طاق%' 
    AND partner_name NOT LIKE '%دلتا%'
    AND date LIKE '2026%' 
    AND LOWER(state) = 'posted'
    AND (json_extract(raw_data, '$.move_type') = 'Customer Invoice' 
         OR json_extract(raw_data, '$.move_type') IS NULL)
`).get();
console.log('\n=== Gross Invoices Only (excluding credit notes, excluding Delta) ===');
console.log('Total:', grandInv.tot, '| Untaxed:', grandInv.untax, '| Paid:', grandInv.paid);
console.log('Odoo Total: 8,248,243.85 | Odoo Untaxed: 7,172,385.60 | Odoo Paid: 3,710,458.67');
console.log('Difference Total:', (8248243.85 - grandInv.tot).toFixed(2));
console.log('Difference Untaxed:', (7172385.60 - grandInv.untax).toFixed(2));

// 5. Check if there are any out_invoice types stored differently  
const types = db.prepare(`
  SELECT json_extract(raw_data, '$.move_type') as mt, COUNT(*) as cnt
  FROM sales_invoices 
  WHERE partner_name LIKE '%السعودي%طاق%' 
    AND partner_name NOT LIKE '%دلتا%'
    AND date LIKE '2026%' 
    AND LOWER(state) = 'posted'
  GROUP BY mt
`).all();
console.log('\n=== Move types ===');
console.table(types);

// 6. Check the API endpoint query
const apiQuery = db.prepare(`
  SELECT company_id, COUNT(*) as cnt, SUM(amount_total) as tot
  FROM sales_invoices 
  WHERE partner_name LIKE '%السعودي%طاق%' 
    AND partner_name NOT LIKE '%دلتا%'
    AND date LIKE '2026%' 
    AND LOWER(state) = 'posted'
  GROUP BY company_id
`).all();
console.log('\n=== By company_id ===');
console.table(apiQuery);
