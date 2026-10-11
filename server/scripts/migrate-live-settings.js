/**
 * Production Settings Migration Script (idempotent)
 * Migrates system settings and schema configurations from a verified manifest
 * to the target database without modifying user-entered data or secrets.
 *
 * Usage:
 *   node server/scripts/migrate-live-settings.js [--dry-run] [--db <path>]
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { initializeSchema } = require('../db/schema');

const isDryRun = process.argv.includes('--dry-run');
const dbArgIdx = process.argv.indexOf('--db');
const targetDbPath = dbArgIdx !== -1 && process.argv[dbArgIdx + 1]
  ? path.resolve(process.argv[dbArgIdx + 1])
  : path.resolve(process.env.DB_PATH || path.join(__dirname, '..', '..', 'data', 'mizaniat.db'));

const manifestPath = path.join(__dirname, '..', 'data', 'live-settings-manifest.json');

if (!fs.existsSync(manifestPath)) {
  console.error(`❌ Manifest file not found at: ${manifestPath}`);
  process.exit(1);
}

if (!fs.existsSync(targetDbPath)) {
  console.error(`❌ Target database not found at: ${targetDbPath}`);
  process.exit(1);
}

console.log('================================================================');
console.log(`🔧 Mizaniat Settings Migration Script ${isDryRun ? '(DRY-RUN MODE)' : '(LIVE MODE)'}`);
console.log(`📂 Target Database: ${targetDbPath}`);
console.log(`📄 Manifest File:   ${manifestPath}`);
console.log('================================================================\n');

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
const db = new Database(targetDbPath);
db.pragma('journal_mode = WAL');

async function runMigration() {
  const stats = {
    instancesUpdated: 0,
    companiesUpdated: 0,
    overridesInserted: 0,
    tagsInserted: 0,
    sisterPartnersInserted: 0,
    analyticGroupsInserted: 0,
    analyticMappingsInserted: 0,
    analyticMappingsUpdated: 0,
    conflicts: []
  };

  // 1. Take safety backup before making changes in non-dry-run mode
  if (!isDryRun) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = targetDbPath.replace(/\.db$/, `.pre-migration-${timestamp}.db`);
    console.log(`📦 Taking pre-migration safety backup: ${backupPath}...`);
    await db.backup(backupPath);
    console.log('  ✓ Pre-migration backup created successfully.\n');
  } else {
    console.log('🔍 DRY-RUN: Skipping backup creation.\n');
  }

  // 1b. Initialize target schema and verify required tables exist
  console.log('── Step 0: Target Schema Initialization and Table Verification');
  initializeSchema(db);
  const requiredTables = [
    'odoo_instances', 'companies', 'account_section_overrides',
    'account_tags', 'sister_company_partners', 'analytic_groups',
    'analytic_group_mapping', 'odoo_journals'
  ];
  for (const t of requiredTables) {
    const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(t);
    if (!exists) {
      throw new Error(`Required table "${t}" does not exist in target database after initialization!`);
    }
  }
  console.log(`  ✓ Schema initialized and all ${requiredTables.length} required tables verified.\n`);

  // 2. odoo_instances.db_name
  console.log('── Step 1: Odoo Instances db_name Migration');
  const updateInstanceStmt = db.prepare('UPDATE odoo_instances SET db_name = ? WHERE id = ?');
  for (const inst of manifest.odoo_instances || []) {
    const cur = db.prepare('SELECT id, name, db_name FROM odoo_instances WHERE id = ?').get(inst.id);
    if (!cur) continue;
    if (cur.db_name !== inst.db_name) {
      console.log(`  [Instance ${inst.id}] Updating db_name: "${cur.db_name || ''}" → "${inst.db_name}"`);
      if (!isDryRun) updateInstanceStmt.run(inst.db_name, inst.id);
      stats.instancesUpdated++;
    } else {
      console.log(`  [Instance ${inst.id}] db_name already matches ("${inst.db_name}").`);
    }
  }

  // 3. companies (vat_period, short_name)
  console.log('\n── Step 2: Companies Settings (vat_period, short_name)');
  const updateCompanyStmt = db.prepare('UPDATE companies SET vat_period = ?, short_name = ? WHERE id = ?');
  for (const comp of manifest.companies || []) {
    const cur = db.prepare('SELECT id, name, vat_period, short_name FROM companies WHERE id = ?').get(comp.id);
    if (!cur) continue;
    const vatPeriodMatch = cur.vat_period === comp.vat_period;
    const shortNameMatch = cur.short_name === comp.short_name;
    if (!vatPeriodMatch || !shortNameMatch) {
      console.log(`  [Company ${comp.id}] Updating vat_period: "${cur.vat_period}" → "${comp.vat_period}", short_name: "${cur.short_name || ''}" → "${comp.short_name}"`);
      if (!isDryRun) updateCompanyStmt.run(comp.vat_period, comp.short_name, comp.id);
      stats.companiesUpdated++;
    } else {
      console.log(`  [Company ${comp.id}] vat_period and short_name already match.`);
    }
  }

  // 4. account_section_overrides
  console.log('\n── Step 3: Account Section Overrides');
  const insOverrideStmt = db.prepare(`
    INSERT INTO account_section_overrides (company_id, account_code, section)
    VALUES (?, ?, ?)
    ON CONFLICT(company_id, account_code) DO UPDATE SET section = excluded.section
  `);
  for (const ovr of manifest.account_section_overrides || []) {
    const cur = db.prepare('SELECT section FROM account_section_overrides WHERE company_id = ? AND account_code = ?').get(ovr.company_id, ovr.account_code);
    if (!cur || cur.section !== ovr.section) {
      console.log(`  [Override] Co ${ovr.company_id}, Account ${ovr.account_code}: "${cur ? cur.section : '(none)'}" → "${ovr.section}"`);
      if (!isDryRun) insOverrideStmt.run(ovr.company_id, ovr.account_code, ovr.section);
      stats.overridesInserted++;
    }
  }
  console.log(`  ✓ Overrides synced: ${stats.overridesInserted} updated/inserted.`);

  // 5. account_tags
  console.log('\n── Step 4: Account Tags');
  const insTagStmt = db.prepare('INSERT OR IGNORE INTO account_tags (company_id, account_code, tag) VALUES (?, ?, ?)');
  for (const tag of manifest.account_tags || []) {
    const cur = db.prepare('SELECT 1 FROM account_tags WHERE company_id = ? AND account_code = ? AND tag = ?').get(tag.company_id, tag.account_code, tag.tag);
    if (!cur) {
      console.log(`  [Tag] Adding tag "${tag.tag}" for Co ${tag.company_id}, Account ${tag.account_code}`);
      if (!isDryRun) insTagStmt.run(tag.company_id, tag.account_code, tag.tag);
      stats.tagsInserted++;
    }
  }
  console.log(`  ✓ Tags synced: ${stats.tagsInserted} newly inserted.`);

  // 6. sister_company_partners
  console.log('\n── Step 5: Sister Company Partners');
  const insSisterStmt = db.prepare(`
    INSERT INTO sister_company_partners (company_id, partner_id, partner_name, sister_company_name)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(company_id, partner_id) DO UPDATE SET
      partner_name = excluded.partner_name,
      sister_company_name = excluded.sister_company_name
  `);
  for (const sp of manifest.sister_company_partners || []) {
    const cur = db.prepare('SELECT partner_name, sister_company_name FROM sister_company_partners WHERE company_id = ? AND partner_id = ?').get(sp.company_id, sp.partner_id);
    if (!cur || cur.sister_company_name !== sp.sister_company_name) {
      console.log(`  [SisterPartner] Co ${sp.company_id}, Partner ${sp.partner_id} (${sp.partner_name}) → "${sp.sister_company_name}"`);
      if (!isDryRun) insSisterStmt.run(sp.company_id, sp.partner_id, sp.partner_name, sp.sister_company_name);
      stats.sisterPartnersInserted++;
    }
  }
  console.log(`  ✓ Sister partners synced: ${stats.sisterPartnersInserted} updated/inserted.`);

  // 7. analytic_groups (Merge: never delete live rows)
  console.log('\n── Step 6: Analytic Groups (Merge)');
  const insGroupStmt = db.prepare(`
    INSERT OR IGNORE INTO analytic_groups (id, name, color, sort_order)
    VALUES (?, ?, ?, ?)
  `);
  for (const grp of manifest.analytic_groups || []) {
    const cur = db.prepare('SELECT id, name FROM analytic_groups WHERE id = ? OR name = ?').get(grp.id, grp.name);
    if (!cur) {
      console.log(`  [AnalyticGroup] Adding new group "${grp.name}" (ID: ${grp.id})`);
      if (!isDryRun) insGroupStmt.run(grp.id, grp.name, grp.color, grp.sort_order);
      stats.analyticGroupsInserted++;
    }
  }
  console.log(`  ✓ Analytic groups merged: ${stats.analyticGroupsInserted} new groups.`);

  // 8. analytic_group_mapping (Merge: never delete live rows)
  console.log('\n── Step 7: Analytic Group Mapping (Merge & Journal Enrichment)');
  const insMappingStmt = db.prepare(`
    INSERT INTO analytic_group_mapping (company_id, analytic_account, group_id, redistributable, journal_name, journal_id)
    VALUES (@company_id, @analytic_account, @group_id, @redistributable, @journal_name, @journal_id)
  `);
  const updMappingJournalStmt = db.prepare(`
    UPDATE analytic_group_mapping
    SET journal_id = COALESCE(journal_id, @journal_id),
        journal_name = COALESCE(journal_name, @journal_name)
    WHERE company_id = @company_id AND analytic_account = @analytic_account
  `);

  for (const m of manifest.analytic_group_mapping || []) {
    const cur = db.prepare(`
      SELECT id, group_id, redistributable, journal_name, journal_id
      FROM analytic_group_mapping
      WHERE company_id = ? AND analytic_account = ?
    `).get(m.company_id, m.analytic_account);

    if (!cur) {
      console.log(`  [Mapping Insert] Co ${m.company_id}: "${m.analytic_account}" -> Group ${m.group_id} (jid: ${m.journal_id || 'null'})`);
      if (!isDryRun) insMappingStmt.run(m);
      stats.analyticMappingsInserted++;
    } else {
      // Check for conflict or journal_id enrichment
      if (cur.group_id !== m.group_id) {
        stats.conflicts.push({
          company_id: m.company_id,
          analytic_account: m.analytic_account,
          target_group_id: cur.group_id,
          manifest_group_id: m.group_id,
          resolution: 'kept target group_id (no override)'
        });
      }
      if ((!cur.journal_id && m.journal_id) || (!cur.journal_name && m.journal_name)) {
        if (!isDryRun) updMappingJournalStmt.run(m);
        stats.analyticMappingsUpdated++;
      }
    }
  }
  console.log(`  ✓ Analytic group mappings merged: ${stats.analyticMappingsInserted} inserted, ${stats.analyticMappingsUpdated} enriched with journal metadata.`);
  if (stats.conflicts.length > 0) {
    console.log(`  ⚠️ Conflicts encountered and preserved: ${stats.conflicts.length}`);
    for (const c of stats.conflicts) {
      console.log(`     - Co ${c.company_id}, Account: "${c.analytic_account}" — Live Group ${c.target_group_id} vs Manifest Group ${c.manifest_group_id} (${c.resolution})`);
    }
  }

  // Print final summary
  console.log('\n================================================================');
  console.log(`🎉 Migration Completed ${isDryRun ? '(DRY-RUN ONLY - NO WRITES PERFORMED)' : 'SUCCESSFULLY'}`);
  console.log('================================================================');
  console.log(`• Instances Updated:          ${stats.instancesUpdated}`);
  console.log(`• Companies Settings Updated:  ${stats.companiesUpdated}`);
  console.log(`• Section Overrides Synced:   ${stats.overridesInserted}`);
  console.log(`• Account Tags Synced:        ${stats.tagsInserted}`);
  console.log(`• Sister Partners Synced:     ${stats.sisterPartnersInserted}`);
  console.log(`• Analytic Groups Added:      ${stats.analyticGroupsInserted}`);
  console.log(`• Analytic Mappings Added:    ${stats.analyticMappingsInserted}`);
  console.log(`• Analytic Mappings Enriched: ${stats.analyticMappingsUpdated}`);
  console.log(`• Conflicts Preserved:        ${stats.conflicts.length}`);
  console.log('================================================================\n');

  db.close();
}

runMigration().catch(err => {
  console.error('\n❌ Migration failed with fatal error:', err);
  db.close();
  process.exit(1);
});
