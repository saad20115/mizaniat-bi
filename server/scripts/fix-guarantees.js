#!/usr/bin/env node
/**
 * Guarantee Data Repair Script
 * 
 * Fixes:
 * 1. Removes orphaned guarantee_releases (no matching journal_item)
 * 2. Removes orphaned guarantee_sub_items (no matching parent journal_item)
 * 3. Reports current state after cleanup
 * 
 * Run: node server/scripts/fix-guarantees.js
 */

const path = require('path');

// Set data path to match server config
process.env.DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', '..', 'data');

const { getDb } = require('../db/connection');
const db = getDb();

console.log('=== Guarantee Data Repair ===\n');

// 1. Show current state
const relCount = db.prepare('SELECT COUNT(*) as cnt FROM guarantee_releases').get().cnt;
const subCount = db.prepare('SELECT COUNT(*) as cnt FROM guarantee_sub_items').get().cnt;
console.log(`Before cleanup: ${relCount} releases, ${subCount} sub-items\n`);

// 2. Find and remove orphaned releases
const orphanedReleases = db.prepare(`
  SELECT gr.* FROM guarantee_releases gr
  WHERE NOT EXISTS (
    SELECT 1 FROM journal_items ji
    WHERE ji.company_id = gr.company_id
      AND ji.account_code = gr.account_code
      AND ji.move_name = gr.move_name
  )
`).all();

if (orphanedReleases.length > 0) {
  console.log(`Found ${orphanedReleases.length} orphaned releases:`);
  orphanedReleases.forEach(r => console.log(`  ❌ cid:${r.company_id} acc:${r.account_code} move:${r.move_name}`));
  
  const del = db.prepare(`
    DELETE FROM guarantee_releases
    WHERE NOT EXISTS (
      SELECT 1 FROM journal_items ji
      WHERE ji.company_id = guarantee_releases.company_id
        AND ji.account_code = guarantee_releases.account_code
        AND ji.move_name = guarantee_releases.move_name
    )
  `).run();
  console.log(`  → Deleted ${del.changes} orphaned releases\n`);
} else {
  console.log('✅ No orphaned releases found\n');
}

// 3. Find and remove orphaned sub-items
const orphanedSubs = db.prepare(`
  SELECT gsi.* FROM guarantee_sub_items gsi
  WHERE NOT EXISTS (
    SELECT 1 FROM journal_items ji
    WHERE ji.company_id = gsi.parent_company_id
      AND ji.account_code = gsi.parent_account_code
      AND ji.move_name = gsi.parent_move_name
  )
`).all();

if (orphanedSubs.length > 0) {
  console.log(`Found ${orphanedSubs.length} orphaned sub-items:`);
  orphanedSubs.forEach(s => console.log(`  ❌ cid:${s.parent_company_id} move:${s.parent_move_name} desc:${s.description} amt:${s.amount}`));
  
  const del = db.prepare(`
    DELETE FROM guarantee_sub_items
    WHERE NOT EXISTS (
      SELECT 1 FROM journal_items ji
      WHERE ji.company_id = guarantee_sub_items.parent_company_id
        AND ji.account_code = guarantee_sub_items.parent_account_code
        AND ji.move_name = guarantee_sub_items.parent_move_name
    )
  `).run();
  console.log(`  → Deleted ${del.changes} orphaned sub-items\n`);
} else {
  console.log('✅ No orphaned sub-items found\n');
}

// 4. Show final state
const relCountAfter = db.prepare('SELECT COUNT(*) as cnt FROM guarantee_releases').get().cnt;
const subCountAfter = db.prepare('SELECT COUNT(*) as cnt FROM guarantee_sub_items').get().cnt;
console.log(`After cleanup: ${relCountAfter} releases, ${subCountAfter} sub-items`);

// 5. Show current guarantees summary
const companies = db.prepare('SELECT DISTINCT id, name FROM companies').all();
console.log('\n=== Current Guarantees Summary ===');
for (const co of companies) {
  const today = new Date().toISOString().slice(0, 10);
  const items = db.prepare(`
    SELECT 
      CASE WHEN gr.id IS NOT NULL THEN 1 ELSE 0 END as is_released,
      (ji.debit - ji.credit) as balance
    FROM journal_items ji
    LEFT JOIN guarantee_releases gr ON gr.company_id = ji.company_id AND gr.account_code = ji.account_code AND gr.move_name = ji.move_name
    WHERE ji.company_id = ? AND ji.account_name LIKE '%ضمان%' AND ji.move_state = 'posted' AND ji.date <= ?
  `).all(co.id, today);
  
  if (items.length === 0) continue;
  
  const pending = items.filter(i => !i.is_released);
  const released = items.filter(i => i.is_released);
  const pendingAmt = pending.reduce((s, i) => s + Math.abs(i.balance), 0);
  const releasedAmt = released.reduce((s, i) => s + Math.abs(i.balance), 0);
  
  console.log(`  ${co.name}:`);
  console.log(`    معلقة: ${pending.length} (${pendingAmt.toLocaleString('en-US', {minimumFractionDigits: 2})})`);
  console.log(`    مفرج: ${released.length} (${releasedAmt.toLocaleString('en-US', {minimumFractionDigits: 2})})`);
}

console.log('\n=== REPAIR COMPLETE ===');
