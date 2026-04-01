const { getDb } = require('./server/db/connection');

function runCleanup() {
  const db = getDb();
  
  // Clean up journal_items
  const items = db.prepare("SELECT id, journal_name FROM journal_items WHERE journal_name IS NOT NULL AND journal_name != ''").all();
  let updatedItems = 0;
  
  const updateStmt = db.prepare("UPDATE journal_items SET journal_name = ? WHERE id = ?");
  db.transaction(() => {
    for (const item of items) {
      const original = item.journal_name;
      let cleaned = original.trim().replace(/\uFFFD/g, '');
      if (cleaned !== original) {
        updateStmt.run(cleaned, item.id);
        updatedItems++;
      }
    }
  })();
  
  // Clean up analytic mappings
  const mappings = db.prepare("SELECT company_id, analytic_account, journal_name FROM analytic_group_mapping WHERE journal_name IS NOT NULL AND journal_name != ''").all();
  let updatedMappings = 0;
  
  const updateMappingStmt = db.prepare("UPDATE analytic_group_mapping SET journal_name = ? WHERE company_id = ? AND analytic_account = ?");
  db.transaction(() => {
    for (const mapping of mappings) {
      const original = mapping.journal_name;
      let cleaned = original.trim().replace(/\uFFFD/g, '');
      if (cleaned !== original) {
        updateMappingStmt.run(cleaned, mapping.company_id, mapping.analytic_account);
        updatedMappings++;
      }
    }
  })();
  
  console.log(`Cleanup complete!`);
  console.log(`Updated journal_items: ${updatedItems}`);
  console.log(`Updated analytic_group_mappings: ${updatedMappings}`);
}

runCleanup();
process.exit(0);
