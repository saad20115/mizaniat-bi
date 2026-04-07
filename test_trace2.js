const Database = require('better-sqlite3');
const db = new Database('./data/mizaniat.db', { fileMustExist: true });

const invs = db.prepare(`SELECT * FROM sales_invoices WHERE company_id = 5 AND partner_name LIKE '%تراخيص سكن%' AND (name LIKE '%2026%' OR date LIKE '%2026%')`).all();
console.log(`Found ${invs.length} invoices`);
invs.forEach(inv => {
  let moveType = '', journalName = '', num = '';
  try {
    const p = inv.raw_data ? JSON.parse(inv.raw_data) : {};
    moveType = p.move_type || '';
    journalName = (p.journal_name || '').trim();
    num = (p.name || p.invoice_number || '').trim();
  } catch(e) {}
  
  const moveName = inv.name || num;
  const masterCompanyId = 3; // mapping for company 5
  
  const ccRows = db.prepare(`SELECT * FROM journal_items WHERE move_name = ? AND company_id = ? AND analytic_account != ''`).all(moveName, masterCompanyId);
  console.log(`${moveName} | amt=${inv.amount_total} | journal=${journalName} | type=${moveType}`);
  ccRows.forEach(r => console.log(`  JI: ${r.analytic_account}`));
});
