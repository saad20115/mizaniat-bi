const SalesSyncEngine = require('./server/services/sales-sync-engine');
const { getDb } = require('./server/db/connection');

async function check() {
  const engine = new SalesSyncEngine();
  console.log('Syncing company 6...');
  try {
    const res = await engine.syncCompany(6);
    console.log('Sync result:', res);
    
    const db = getDb();
    const refunds = db.prepare("SELECT COUNT(*) as c FROM sales_invoices WHERE company_id = 6 AND json_extract(raw_data, '$.move_type') = 'Customer Credit Note'").get();
    console.log('Refunds in DB now:', refunds);
  } catch(err) {
    console.error('Err:', err);
  }
}
check();
