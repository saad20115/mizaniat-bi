const db = require('./server/db/connection').getDb();
const invoices = db.prepare(`SELECT * FROM sales_invoices WHERE partner_name LIKE '%روابط الحياة%'`).all();

const refToJournalMap = {};
invoices.forEach(inv => {
  try {
    const p = inv.raw_data ? JSON.parse(inv.raw_data) : {};
    const jn = (p.journal_name || '').trim();
    const num = (p.invoice_number || inv.invoice_number || inv.name || '').trim();
    if (jn && num) {
      refToJournalMap[num] = jn;
    }
  } catch(e) {}
});

invoices.forEach(inv => {
  try {
    const p = inv.raw_data ? JSON.parse(inv.raw_data) : {};
    let journalName = (p.journal_name || '').trim();
    const ref = (p.reference || '').trim();
    if (!journalName && ref) {
      const match = Object.keys(refToJournalMap).find(k => ref.includes(k));
      if (match) journalName = refToJournalMap[match];
    }
    console.log(`Invoice: ${p.invoice_number}, DB Journal: ${p.journal_name}, Map fallback: ${journalName}`);
  } catch(e) {}
});
