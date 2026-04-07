const SalesSyncEngine = require('./server/services/sales-sync-engine');
const db = require('./server/db/connection').getDb();

async function hack() {
  const engine = new SalesSyncEngine();
  
  // monkey patch
  const origRpc = engine._jsonRpcRequest.bind(engine);
  engine._jsonRpcRequest = async function(...args) {
    const res = await origRpc(...args);
    if (args[1] === 'call' && args[2].method === 'execute_kw') {
      const result = res.result || [];
      const invoice = result.find(r => r.name === 'RINVJ/2026/00002');
      console.log('ODOO INVOICE FROM RPC:', invoice);
    }
    return res;
  }
  
  await engine.syncCompany(4);
}

hack();
