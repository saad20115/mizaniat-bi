const https = require('https');

async function testRpc(path, method, params) {
  return new Promise(resolve => {
    const postData = JSON.stringify({ jsonrpc: "2.0", method: method, params: params || {}, id: 1 });
    const req = https.request('https://aboghaliaoffice.com' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ path, response: JSON.parse(data) }));
    }).on('error', err => resolve({ path, error: err.message }));
    req.write(postData);
    req.end();
  });
}

testRpc('/web/session/authenticate', 'call', { db: 'second_odoo_17', login: 'saad@aboghaliaoffice.com', password: '014603' }).then(res => {
  console.log('auth result:', JSON.stringify(res, null, 2));
});
