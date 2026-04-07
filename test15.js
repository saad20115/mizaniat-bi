(async () => {
  const db = require('./server/db/connection').getDb();
  const SalesSyncEngine = require('./server/services/sales-sync-engine');
  
  // Hack the class temporarily to print RINVJ details
  const origSync = SalesSyncEngine.prototype.syncCompany;
  const fs = require('fs');
  const code = fs.readFileSync('./server/services/sales-sync-engine.js', 'utf8');
  
  const testEngine = new SalesSyncEngine();
  try {
    await testEngine.syncCompany(4); // Company 4
  } catch(e) {
    console.error(e);
  }
  
  // We will check the database row after!
  const invs = db.prepare(`SELECT raw_data FROM sales_invoices WHERE raw_data LIKE '%RINVJ/2026/00002%'`).all();
  console.log(JSON.stringify(invs.map(i=>JSON.parse(i.raw_data)), null, 2));
})();
