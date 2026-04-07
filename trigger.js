(async () => {
  const SalesSyncEngine = require('./server/services/sales-sync-engine');
  const engine = new SalesSyncEngine();
  console.log("Syncing...");
  try {
    const results = await engine.syncAll();
    console.log(results);
  } catch(e) {
    console.error(e);
  }
})();
