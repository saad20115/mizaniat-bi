const https = require('https');

async function testRpc(path, method, params) {
  return new Promise(resolve => {
    const postData = JSON.stringify({ jsonrpc: "2.0", method: "call", params: params || {}, id: 1 });
    const req = https.request('https://aboghaliaoffice.com' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ path, response: data }));
    }).on('error', err => resolve({ path, error: err.message }));
    req.write(postData);
    req.end();
  });
}

testRpc('/web/database/list').then(console.log);
