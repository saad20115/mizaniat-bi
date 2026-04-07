const db = require('./server/db/connection').getDb();
const https = require('https');
const http = require('http');

async function checkOdoo() {
  const instance = db.prepare('SELECT * FROM sales_instances LIMIT 1').get();
  
  function jsonRpcRequest(url, method, params) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const postData = JSON.stringify({ jsonrpc: "2.0", method: method, params: params || {}, id: 1 });
      const req = protocol.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => resolve(JSON.parse(data)));
      });
      req.write(postData);
      req.end();
    });
  }

  let baseUrl = instance.url.replace(/\/+$/, '');
  const dbRes = await jsonRpcRequest(`${baseUrl}/web/database/list`, 'call', {});
  const dbName = dbRes.result[0];
  
  const authRes = await jsonRpcRequest(`${baseUrl}/web/session/authenticate`, 'call', {
    db: dbName, login: instance.username, password: instance.api_key
  });
  const uid = authRes.result.uid;
  
  const odooRes = await jsonRpcRequest(`${baseUrl}/jsonrpc`, 'call', {
    service: "object",
    method: "execute_kw",
    args: [
      dbName, uid, instance.api_key,
      "account.move", "search_read",
      [[["name", "=", "RINVJ/2026/00002"]]],
      { fields: ["name", "partner_id", "journal_id", "move_type"] }
    ]
  });
  
  console.log(JSON.stringify(odooRes.result, null, 2));
}

checkOdoo();
