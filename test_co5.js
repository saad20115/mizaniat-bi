const Database = require('better-sqlite3');
const http = require('http');
const jwt = require('jsonwebtoken');
const db = new Database('./data/mizaniat.db', { fileMustExist: true });

// Simulate exactly what determineClassification does for company 5 (sales) = company 3 (master)
// Find ALL invoices from sales_co=5 that would be classified as "المختبر البيئي"
console.log('=== sales_co=5 invoices that might match "تشغيلي" or "الاداره" ===');
const co5invs = db.prepare(`SELECT si.name, si.partner_name, si.amount_total FROM sales_invoices si WHERE si.company_id = 5 AND si.state != 'draft'`).all();

// Build the same map the server builds
const allCC = db.prepare(`SELECT move_name, company_id, analytic_account FROM journal_items WHERE move_name IS NOT NULL AND analytic_account IS NOT NULL AND analytic_account != ''`).all();
const ccMap = {};
allCC.forEach(row => { 
  const key = `${row.move_name}::${row.company_id}`;
  const existing = ccMap[key];
  if (!existing || row.analytic_account.length > existing.length) {
    ccMap[key] = row.analytic_account;
  }
});

// sales_co 5 -> master_co 3
const masterCoId = 3;

let envLabCount = 0;
co5invs.forEach(inv => {
  const key = `${inv.name}::${masterCoId}`;
  const cc = ccMap[key];
  if (cc && (cc === 'تشغيلي' || cc === 'الاداره')) {
    envLabCount++;
    console.log(`  ${inv.name} | ${inv.partner_name} | amt=${inv.amount_total} | cc=${cc}`);
  }
});
console.log(`\nTotal: ${envLabCount} invoices from sales_co=5 matching "المختبر البيئي" via journal_items company 3`);

// Also check: what if we check master_co=4 too? (maybe we're mapping wrong?)
console.log('\n=== Check ALL master companies for sales_co=5 invoices ===');
const masterCos = [1,2,3,4];
masterCos.forEach(mc => {
  let found = 0;
  co5invs.forEach(inv => {
    const key = `${inv.name}::${mc}`;
    const cc = ccMap[key];
    if (cc) found++;
  });
  console.log(`  master_co=${mc}: ${found}/${co5invs.length} invoices have journal_items entries`);
});

// Verify the mapping: sales_co=5 -> which master_co?
console.log('\n=== Company Mapping Verification ===');
const sc = db.prepare('SELECT * FROM sales_companies WHERE id = 5').get();
const mc = db.prepare('SELECT * FROM companies WHERE odoo_company_id = ?').get(sc.sales_company_id);
console.log(`  sales_co 5: name="${sc.name}" sales_company_id=${sc.sales_company_id}`);
console.log(`  maps to master_co ${mc.id}: name="${mc.name}" odoo_id=${mc.odoo_company_id}`);
