const Database = require('better-sqlite3');
const db = new Database('./data/mizaniat.db', { fileMustExist: true });

// Check move_types stored in sales_invoices
console.log('=== Move types in sales_invoices ===');
const types = db.prepare(`
  SELECT 
    CASE 
      WHEN name LIKE 'INV%' THEN 'INV (Invoice)'
      WHEN name LIKE 'RINV%' THEN 'RINV (Refund)'
      WHEN name LIKE 'MISC%' THEN 'MISC (Miscellaneous)'
      WHEN name LIKE 'BNK%' THEN 'BNK (Bank)'
      WHEN name LIKE 'PBNK%' THEN 'PBNK (Bank Payment)'
      WHEN name LIKE 'BILL%' THEN 'BILL'
      WHEN name LIKE 'ELC%' THEN 'ELC'
      WHEN name LIKE 'TA%' THEN 'TA (Tax)'
      ELSE 'OTHER: ' || SUBSTR(name, 1, 10)
    END as type,
    COUNT(*) as cnt
  FROM sales_invoices
  WHERE state != 'draft'
  GROUP BY type
  ORDER BY cnt DESC
`).all();
types.forEach(r => console.log(`  ${r.type}: ${r.cnt}`));

// Check: raw_data move_type distribution
console.log('\n=== move_type from raw_data ===');
const mtypes = db.prepare(`SELECT raw_data FROM sales_invoices WHERE state != 'draft' LIMIT 5000`).all();
const mtypeMap = {};
mtypes.forEach(r => {
  try {
    const p = JSON.parse(r.raw_data || '{}');
    const mt = p.move_type || 'UNKNOWN';
    mtypeMap[mt] = (mtypeMap[mt] || 0) + 1;
  } catch(e) { mtypeMap['PARSE_ERROR'] = (mtypeMap['PARSE_ERROR'] || 0) + 1; }
});
Object.entries(mtypeMap).sort((a,b) => b[1]-a[1]).forEach(([k,v]) => console.log(`  ${k}: ${v}`));
