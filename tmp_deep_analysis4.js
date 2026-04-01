const db = require('./node_modules/better-sqlite3')('data/mizaniat.db');

// CRITICAL FINDING: The Aboghalia API returns invoices WITH payment_status='Reversed' which are ORIGINAL invoices that have been reversed by credit notes.
// In Odoo, when you reverse an invoice, BOTH the original invoice AND the credit note exist.
// The Aboghalia API returns: original invoices (including reversed ones) as move_type='Customer Invoice'
// The JSON-RPC returns: credit notes as move_type='out_refund' 
// BOTH exist in the DB. So the calculation is DOUBLE-counting the reversed amounts!

// The real question: In Odoo's partner total, does it include reversed invoices?
// Answer: YES, in Odoo, reversed invoices still have state='posted', so they count in totals.
// The credit note cancels them out. So the net effect is zero.

// Our issue: The JSON-RPC credit notes have NEGATIVE amount_total.
// The original reversed invoices have POSITIVE amount_total.
// When both are summed, they should cancel out.

// But wait - the credit notes from JSON-RPC are stored with negative amounts.
// And the original invoices from API are stored with positive amounts.
// So the NET should be correct IF both are present.

// Let's verify: Saudi Energy reversed invoices vs credit notes
console.log('=== REVERSED invoices for Saudi Energy 2026 ===');
const reversed = db.prepare(`
  SELECT name, amount_total, json_extract(raw_data, '$.payment_status') as ps
  FROM sales_invoices 
  WHERE partner_name = 'الشركة السعودية للطاقة' 
    AND date LIKE '2026%'
    AND json_extract(raw_data, '$.payment_status') = 'Reversed'
  ORDER BY amount_total DESC
`).all();
console.table(reversed);
let reversedSum = reversed.reduce((s, r) => s + r.amount_total, 0);
console.log('Sum of reversed invoices:', reversedSum.toFixed(2));

console.log('\n=== CREDIT NOTES (negative) for Saudi Energy 2026 ===');
const creditNotes = db.prepare(`
  SELECT name, amount_total
  FROM sales_invoices 
  WHERE partner_name = 'الشركة السعودية للطاقة' 
    AND date LIKE '2026%'
    AND amount_total < 0
  ORDER BY amount_total ASC
`).all();
console.table(creditNotes);
let cnSum = creditNotes.reduce((s, r) => s + r.amount_total, 0);
console.log('Sum of credit notes:', cnSum.toFixed(2));

// Grand totals
const grand = db.prepare(`
  SELECT SUM(amount_total) as tot,
         SUM(CAST(json_extract(raw_data, '$.amount_untaxed') AS REAL)) as untax,
         SUM(CAST(json_extract(raw_data, '$.total_paid') AS REAL)) as paid,
         COUNT(*) as cnt
  FROM sales_invoices 
  WHERE partner_name = 'الشركة السعودية للطاقة' 
    AND date LIKE '2026%'
    AND LOWER(state) = 'posted'
`).get();
console.log('\n=== Grand Total (ALL entries including reversed + credit notes) ===');
console.log('Total:', grand.tot, '| Untaxed:', grand.untax, '| Paid:', grand.paid, '| Count:', grand.cnt);
console.log('\nOdoo expects: Total=8,248,243.85 | Untaxed=7,172,385.60 | Paid=3,710,458.67');
console.log('Difference Total:', (8248243.85 - grand.tot).toFixed(2));

// Now check: The API has negative-amount entries for Saudi Energy
// These are credit notes returned by the Aboghalia API itself (not JSON-RPC)
const negativeFromAPI = db.prepare(`
  SELECT name, amount_total, json_extract(raw_data, '$.move_type') as mt
  FROM sales_invoices 
  WHERE partner_name = 'الشركة السعودية للطاقة' 
    AND date LIKE '2026%'
    AND amount_total < 0
`).all();
console.log('\n=== Negative entries for Saudi Energy 2026 ===');
console.table(negativeFromAPI);
