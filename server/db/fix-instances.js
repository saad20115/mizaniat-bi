/**
 * Migration script: Fix multi-server instance assignments
 * 
 * Problem: All 4 companies point to one instance (aboghaliaoffice.com)
 * Fix: Create 2 clean instances, reassign companies correctly
 * 
 * Run once: node server/db/fix-instances.js
 */
const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', '..', 'data', 'mizaniat.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = OFF');

console.log('\n=== Fix Odoo Instances Migration ===\n');

// 1. Read current state
const oldInstances = db.prepare('SELECT * FROM odoo_instances').all();
const oldCompanies = db.prepare('SELECT * FROM companies').all();

console.log('Current instances:', oldInstances.length);
oldInstances.forEach(i => console.log(`  ID ${i.id}: ${i.name} — ${i.url} — user: ${i.username}`));

console.log('\nCurrent companies:');
oldCompanies.forEach(c => console.log(`  ID ${c.id}: ${c.name} (odoo_id=${c.odoo_company_id}) → instance_id=${c.odoo_instance_id}`));

// 2. Get existing api_keys so we don't lose them
const aboGhaliaInst = oldInstances.find(i => i.url && i.url.includes('aboghaliaoffice'));
const jbhInst = oldInstances.find(i => i.url && i.url.includes('jbhconsulting'));

const aboGhaliaKey = aboGhaliaInst ? aboGhaliaInst.api_key : '';
const jbhKey = jbhInst ? jbhInst.api_key : '';

console.log(`\nDetected aboghaliaoffice key exists: ${!!aboGhaliaKey}`);
console.log(`Detected jbhconsulting key exists: ${!!jbhKey}`);

// 3. Run migration in transaction
const migrate = db.transaction(() => {
  // Remove foreign key constraints temporarily by updating companies first
  // Point all companies to a temp safe value
  db.prepare('UPDATE companies SET odoo_instance_id = 0').run();
  
  // Delete all old instances
  db.prepare('DELETE FROM odoo_instances').run();
  
  // Create two clean instances with correct base URLs
  const inst1 = db.prepare(`
    INSERT INTO odoo_instances (name, url, db_name, username, api_key, is_active)
    VALUES ('خادم أبو غلية - aboghaliaoffice.com', 'https://aboghaliaoffice.com', '', 'saad@aboghaliaoffice.com', ?, 1)
  `).run(aboGhaliaKey);
  
  const inst2 = db.prepare(`
    INSERT INTO odoo_instances (name, url, db_name, username, api_key, is_active)
    VALUES ('خادم حريري - jbhconsultingsa.com', 'https://jbhconsultingsa.com', '', 'saad@aboghaliaoffice.com', ?, 1)
  `).run(jbhKey);
  
  const aboGhaliaId = inst1.lastInsertRowid;
  const jbhId = inst2.lastInsertRowid;
  
  console.log(`\nCreated instance ${aboGhaliaId}: aboghaliaoffice.com`);
  console.log(`Created instance ${jbhId}: jbhconsultingsa.com`);
  
  // Reassign companies:
  // odoo_company_id 1, 2 → aboghaliaoffice.com
  // odoo_company_id 4, 5 → jbhconsultingsa.com
  for (const company of oldCompanies) {
    let targetInstanceId;
    if (company.odoo_company_id === 1 || company.odoo_company_id === 2) {
      targetInstanceId = aboGhaliaId;
    } else if (company.odoo_company_id === 4 || company.odoo_company_id === 5) {
      targetInstanceId = jbhId;
    } else {
      // Default to aboghaliaoffice
      targetInstanceId = aboGhaliaId;
    }
    
    db.prepare('UPDATE companies SET odoo_instance_id = ? WHERE id = ?')
      .run(targetInstanceId, company.id);
    
    console.log(`  Company ${company.id} (odoo_id=${company.odoo_company_id}) → instance ${targetInstanceId}`);
  }
});

try {
  migrate();
  
  // 4. Verify
  console.log('\n=== Verification ===\n');
  const newInstances = db.prepare('SELECT id, name, url, username FROM odoo_instances').all();
  const newCompanies = db.prepare(`
    SELECT c.id, c.name, c.odoo_company_id, c.odoo_instance_id, oi.name as instance_name, oi.url as instance_url
    FROM companies c
    LEFT JOIN odoo_instances oi ON oi.id = c.odoo_instance_id
  `).all();
  
  console.log('Instances:');
  newInstances.forEach(i => console.log(`  ✅ ID ${i.id}: ${i.name} — ${i.url} — ${i.username}`));
  
  console.log('\nCompanies:');
  newCompanies.forEach(c => console.log(`  ✅ ${c.name} (odoo_id=${c.odoo_company_id}) → ${c.instance_name} (${c.instance_url})`));
  
  console.log('\n✅ Migration completed successfully!\n');
} catch (err) {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
}

db.close();
