const db = require('./node_modules/better-sqlite3')('data/mizaniat.db');

// 1. What is the sales_company_id for company 4?
const company = db.prepare(`SELECT * FROM sales_companies WHERE id = 4`).get();
console.log('=== Company 4 Config ===');
console.log('Name:', company.name);
console.log('sales_company_id:', company.sales_company_id);
console.log('instance_id:', company.sales_instance_id);

// 2. All companies and their sales_company_id
const allCompanies = db.prepare(`SELECT id, name, sales_company_id, sales_instance_id FROM sales_companies`).all();
console.log('\n=== All Companies ===');
console.table(allCompanies);

// 3. Check: does the Aboghalia API itself send credit notes (move_type) at all?
const apiMoveTypes = db.prepare(`
  SELECT json_extract(raw_data, '$.move_type') as mt, COUNT(*) as cnt, SUM(amount_total) as tot
  FROM sales_invoices 
  WHERE company_id = 4
  GROUP BY mt
`).all();
console.log('\n=== Move types in Company 4 data ===');
console.table(apiMoveTypes);

// 4. Credit notes across ALL companies
const allCreditNotes = db.prepare(`
  SELECT company_id, COUNT(*) as cnt, SUM(amount_total) as tot
  FROM sales_invoices 
  WHERE json_extract(raw_data, '$.move_type') = 'Customer Credit Note'
  GROUP BY company_id
`).all();
console.log('\n=== Credit Notes by company ===');
console.table(allCreditNotes);

// 5. Check total records per company
const recordsPerCompany = db.prepare(`
  SELECT company_id, COUNT(*) as cnt, SUM(amount_total) as tot
  FROM sales_invoices 
  GROUP BY company_id
`).all();
console.log('\n=== Records per company ===');
console.table(recordsPerCompany);

// 6. The Aboghalia custom API: does it already include some credit notes for other partners?
const apiCreditNotes = db.prepare(`
  SELECT partner_name, name, amount_total 
  FROM sales_invoices 
  WHERE company_id = 4 
    AND amount_total < 0
  ORDER BY amount_total ASC
  LIMIT 20
`).all();
console.log('\n=== Negative amount invoices in company 4 (from API) ===');
console.table(apiCreditNotes);

// 7. Check if Aboghalia API returns refund invoices naturally
const apiRefunds = db.prepare(`
  SELECT json_extract(raw_data, '$.move_type') as mt, json_extract(raw_data, '$.payment_status') as ps, 
         name, partner_name, amount_total
  FROM sales_invoices 
  WHERE company_id = 4 
    AND (json_extract(raw_data, '$.move_type') LIKE '%refund%' 
         OR json_extract(raw_data, '$.move_type') LIKE '%credit%'
         OR json_extract(raw_data, '$.payment_status') = 'Reversed')
  LIMIT 20
`).all();
console.log('\n=== Refund/Reversed entries from API ===');
console.table(apiRefunds);
