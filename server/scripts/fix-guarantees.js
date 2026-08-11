#!/usr/bin/env node
/**
 * Guarantee Data Repair Script v2
 * 
 * Fixes:
 * 1. Generates synthetic move_names for entries with empty move_name
 * 2. Re-links guarantee_sub_items to new move_names
 * 3. Cleans up incorrect guarantee_releases 
 * 4. Restores sub-items for the aggregated 2023-12-31 entry
 * 
 * Run: node server/scripts/fix-guarantees.js
 */

const path = require('path');
process.env.DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');

const { getDb } = require('../db/connection');
const db = getDb();

console.log('=== Guarantee Data Repair v2 ===\n');

// Step 1: Generate synthetic move_names for ALL entries with empty move_name
console.log('--- Step 1: Generating synthetic move_names ---');
const emptyMoveItems = db.prepare(`
  SELECT id, company_id, date, debit, credit, account_code FROM journal_items
  WHERE (move_name IS NULL OR move_name = '')
  ORDER BY company_id, date, debit, credit, id
`).all();

if (emptyMoveItems.length > 0) {
  console.log(`Found ${emptyMoveItems.length} entries with empty move_name`);
  const updateMove = db.prepare('UPDATE journal_items SET move_name = ? WHERE id = ?');
  const seen = {};
  const genTx = db.transaction(() => {
    for (const item of emptyMoveItems) {
      const companyKey = `${item.company_id}`;
      if (!seen[companyKey]) seen[companyKey] = {};
      const baseKey = `${item.date}_${item.debit}_${item.credit}`;
      seen[companyKey][baseKey] = (seen[companyKey][baseKey] || 0) + 1;
      const seq = seen[companyKey][baseKey];
      const syntheticName = `AUTO/${item.date}/${item.debit}_${item.credit}${seq > 1 ? '_' + seq : ''}`;
      updateMove.run(syntheticName, item.id);
    }
  });
  genTx();
  
  // Count per company
  const byCompany = {};
  emptyMoveItems.forEach(i => {
    byCompany[i.company_id] = (byCompany[i.company_id] || 0) + 1;
  });
  Object.entries(byCompany).forEach(([cid, cnt]) => {
    console.log(`  Company ${cid}: ${cnt} entries updated`);
  });
} else {
  console.log('  No entries with empty move_name found ✅');
}

// Step 2: Find the new move_name for the 2023-12-31 aggregated entry (company 2)
console.log('\n--- Step 2: Re-linking sub-items ---');
const dec2023Entry = db.prepare(`
  SELECT move_name, account_code, (debit - credit) as balance
  FROM journal_items
  WHERE company_id = 2 AND date = '2023-12-31' AND account_name LIKE '%ضمان%'
  LIMIT 1
`).get();

if (dec2023Entry) {
  console.log(`  Found 2023-12-31 entry: move=${dec2023Entry.move_name}, acc=${dec2023Entry.account_code}, bal=${dec2023Entry.balance}`);
  
  // Check if sub-items exist for the OLD parent
  const oldSubs = db.prepare(`
    SELECT COUNT(*) as cnt FROM guarantee_sub_items
    WHERE parent_company_id = 2 AND parent_move_name = 'MISC/2023/12/0001'
  `).get();
  
  if (oldSubs.cnt > 0) {
    // Update sub-items to point to new move_name
    db.prepare(`
      UPDATE guarantee_sub_items 
      SET parent_move_name = ?, parent_account_code = ?
      WHERE parent_company_id = 2 AND parent_move_name = 'MISC/2023/12/0001'
    `).run(dec2023Entry.move_name, dec2023Entry.account_code);
    console.log(`  Re-linked ${oldSubs.cnt} sub-items from MISC/2023/12/0001 -> ${dec2023Entry.move_name}`);
  } else {
    // Sub-items were already deleted, need to restore them
    console.log('  Sub-items were deleted, restoring from backup data...');
    
    const subsToRestore = [
      { desc: 'الضمان البنكي لمشروع وزارة الاسكان', amt: 96600, released: 1 },
      { desc: 'ضمان مشروع مني كدانه الصيانه', amt: 889935, released: 1 },
      { desc: 'ضمانات بلدي', amt: 60000, released: 1 },
      { desc: 'ضمان نهائي مشروع الجامعه', amt: 88830, released: 0 },
      { desc: 'ضمان مشروع تطوير مكه', amt: 54875, released: 1 },
      { desc: 'ضمان الاتفاقيه الاطاريه العام', amt: 50000, released: 0 },
      { desc: 'ضمان كهرباء مكه عقد 4128', amt: 132328, released: 0 },
      { desc: 'ضمان كهرباء مكه عقد 7126', amt: 86667, released: 0 },
      { desc: 'ضمان كهرباء جدة عقد 4190', amt: 132328, released: 0 },
      { desc: 'ضمان كهرباء جدة عقد 508', amt: 130000, released: 0 },
      { desc: 'خطاب', amt: 143692.5, released: 1 },
      { desc: 'ضمان', amt: 200000, released: 1 },
    ];
    
    const insertSub = db.prepare(`
      INSERT INTO guarantee_sub_items (parent_company_id, parent_account_code, parent_move_name, description, amount, is_released)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const restoreTx = db.transaction(() => {
      for (const sub of subsToRestore) {
        insertSub.run(2, dec2023Entry.account_code, dec2023Entry.move_name, sub.desc, sub.amt, sub.released);
      }
    });
    restoreTx();
    console.log(`  ✅ Restored ${subsToRestore.length} sub-items under ${dec2023Entry.move_name}`);
  }
} else {
  console.log('  ⚠️  2023-12-31 entry not found for company 2');
}

// Step 3: Clean up ALL guarantee_releases for company 2 (they were all wrong due to empty move_name)
console.log('\n--- Step 3: Cleaning up incorrect releases ---');
const relCount2 = db.prepare('SELECT COUNT(*) as cnt FROM guarantee_releases WHERE company_id = 2').get().cnt;
if (relCount2 > 0) {
  db.prepare('DELETE FROM guarantee_releases WHERE company_id = 2').run();
  console.log(`  Deleted ${relCount2} incorrect release records for company 2`);
  console.log('  ⚠️  You will need to manually re-release the correct guarantees');
} else {
  console.log('  No releases for company 2 ✅');
}

// Step 4: Clean up orphaned releases for other companies
console.log('\n--- Step 4: Cleaning orphaned records for other companies ---');
const orphanedOther = db.prepare(`
  DELETE FROM guarantee_releases
  WHERE company_id != 2 AND NOT EXISTS (
    SELECT 1 FROM journal_items ji
    WHERE ji.company_id = guarantee_releases.company_id
      AND ji.account_code = guarantee_releases.account_code
      AND ji.move_name = guarantee_releases.move_name
  )
`).run();
console.log(`  Cleaned ${orphanedOther.changes} orphaned releases for other companies`);

// Step 5: Final report
console.log('\n--- Final Report ---');
const companies = db.prepare('SELECT DISTINCT id, name FROM companies').all();
const today = new Date().toISOString().slice(0, 10);

for (const co of companies) {
  const items = db.prepare(`
    SELECT ji.move_name, ji.date, (ji.debit - ji.credit) as balance,
      CASE WHEN gr.id IS NOT NULL THEN 1 ELSE 0 END as is_released
    FROM journal_items ji
    LEFT JOIN guarantee_releases gr ON gr.company_id = ji.company_id AND gr.account_code = ji.account_code AND gr.move_name = ji.move_name
    WHERE ji.company_id = ? AND ji.account_name LIKE '%ضمان%' AND ji.move_state = 'posted' AND ji.date <= ?
  `).all(co.id, today);
  
  if (items.length === 0) continue;
  
  const pending = items.filter(i => !i.is_released);
  const released = items.filter(i => i.is_released);
  const pendingAmt = pending.reduce((s, i) => s + Math.abs(i.balance), 0);
  const releasedAmt = released.reduce((s, i) => s + Math.abs(i.balance), 0);
  
  // Sub-items count
  const subCount = db.prepare(`
    SELECT COUNT(*) as cnt FROM guarantee_sub_items WHERE parent_company_id = ?
  `).get(co.id).cnt;
  
  console.log(`  ${co.name}:`);
  console.log(`    ضمانات: ${items.length} | معلقة: ${pending.length} (${pendingAmt.toLocaleString()}) | مفرج: ${released.length} (${releasedAmt.toLocaleString()})`);
  console.log(`    تفاصيل: ${subCount} بند`);
}

console.log('\n=== REPAIR COMPLETE ===');
