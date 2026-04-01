const db = require('./node_modules/better-sqlite3')('data/mizaniat.db');

// Find ALL corrupted partner names and their correct versions
const corrupted = db.prepare(`
  SELECT si.id, si.name as inv_name, si.partner_name, si.company_id, si.date
  FROM sales_invoices si
  WHERE si.partner_name LIKE '%�%'
`).all();

console.log(`Found ${corrupted.length} records with corrupted partner names:\n`);
console.table(corrupted.map(r => ({ id: r.id, inv_name: r.inv_name, corrupted_name: r.partner_name, company_id: r.company_id, date: r.date })));

// For each corrupted record, find the correct partner name from other records with same invoice pattern
for (const rec of corrupted) {
  // Try to find the correct name by looking at the raw_data from JSON-RPC or by matching invoice amount
  const raw = db.prepare(`SELECT raw_data FROM sales_invoices WHERE id = ?`).get(rec.id);
  if (raw) {
    const parsed = JSON.parse(raw.raw_data);
    console.log(`\nInvoice ${rec.inv_name}: corrupted="${rec.partner_name}" | raw partner_name="${parsed.partner_name}"`);
  }
}
