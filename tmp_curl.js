const https = require('https');

const username = 'saad@aboghaliaoffice.com';
const password = '014603';
const auth = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');
const endpts = ['/api/customer_refunds?company_id=1', '/api/refunds?company_id=1', '/api/credit_notes?company_id=1', '/api/customer_invoices?company_id=1&move_type=out_refund'];

async function testUrl(path) {
  return new Promise(resolve => {
    https.get('https://aboghaliaoffice.com' + path, {
      headers: { 'Authorization': auth, 'Accept': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ path, status: res.statusCode, length: data.length }));
    }).on('error', err => resolve({ path, error: err.message }));
  });
}

async function run() {
  for (const p of endpts) {
    console.log(await testUrl(p));
  }
}
run();
