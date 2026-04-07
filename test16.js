async function testIt() {
  const db = require('./server/db/connection').getDb();
  const instance = db.prepare('SELECT * FROM sales_instances LIMIT 1').get();
  
  const https = require('https'); const http = require('http');
  function req(url, method, params) {
    return new Promise((resolve) => {
      const pData = JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 });
      const r = http.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => {
        let data = ''; res.on('data', c => data+=c); res.on('end', () => resolve(JSON.parse(data)));
      });
      r.write(pData); r.end();
    });
  }

  const baseUrl = instance.url.replace(/\/+$/, '');
  const dbRes = await req(`${baseUrl}/web/database/list`, 'call', {});
  const authRes = await req(`${baseUrl}/web/session/authenticate`, 'call', { db: dbRes.result[0], login: instance.username, password: instance.api_key });
  
  const odooRes = await req(`${baseUrl}/jsonrpc`, 'call', {
    service: "object", method: "execute_kw",
    args: [ dbRes.result[0], authRes.result.uid, instance.api_key, "account.move", "search_read", 
            [[["name", "=", "RINVJ/2026/00002"]]], { fields: ["name", "journal_id"] } ]
  });
  
  console.log(JSON.stringify(odooRes.result));
}
testIt();
