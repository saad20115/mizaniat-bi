const db = require('better-sqlite3')('./data/mizaniat.db');
const r = db.prepare("SELECT si.name, si.raw_data FROM sales_invoices si WHERE si.partner_name LIKE '%تراخيص سكن%' AND si.company_id=5").all();
r.forEach(i => {
  try { const p = JSON.parse(i.raw_data); console.log(i.name, 'journal=' + p.journal_name, 'type=' + p.move_type); } catch(e) { console.log(i.name, 'no raw'); }
});

// Check: what does "الاداره" map to (multiple mappings?)
console.log('\n=== "الاداره" in group mappings ===');
db.prepare("SELECT m.analytic_account, m.journal_name, g.name FROM analytic_group_mapping m JOIN analytic_groups g ON g.id = m.group_id WHERE m.analytic_account LIKE '%ادار%'").all()
  .forEach(r => console.log(`  group=${r.name} | cc=${r.analytic_account} | journal=${r.journal_name}`));
