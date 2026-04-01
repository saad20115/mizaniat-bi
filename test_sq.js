const db = require('better-sqlite3')('data/mizaniat.db');

const masterCompanyIds = [1]; 
const sql = `
  SELECT si.id, si.name as invoice_name, si.company_id, sc.name as sales_company_name
  FROM sales_invoices si
  LEFT JOIN sales_companies sc ON sc.id = si.company_id
  WHERE si.state != 'draft'
  AND si.company_id IN (
    SELECT sc2.id 
    FROM sales_companies sc2
    JOIN companies c ON (c.odoo_company_id = sc2.sales_company_id OR c.name = sc2.name)
    WHERE c.id IN (?)
  )
`;

console.log("Testing with master company id = 1");
const res1 = db.prepare(sql).all(1);
console.log(`Found ${res1.length} invoices. Example:`, res1[0]);

const sqlAll = `
  SELECT COUNT(*) as c FROM sales_invoices WHERE state != 'draft'
`;
console.log("Total non-draft invoices:", db.prepare(sqlAll).get().c);
