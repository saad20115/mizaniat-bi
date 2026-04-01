const https = require('https');

const username = 'saad@aboghaliaoffice.com';
const password = '014603';
const auth = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');
const endpts = ['/api/customer_invoices?company_id=1&move_type=out_refund'];

async function testUrl(path) {
  return new Promise(resolve => {
    https.get('https://aboghaliaoffice.com' + path, {
      headers: { 'Authorization': auth, 'Accept': 'application/json' }
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        let parsed = JSON.parse(data);
        let items = parsed.data || parsed.result || parsed || [];
        resolve({ path, first: items.slice(0, 3).map(i => i.move_type) })
      });
    }).on('error', err => resolve({ path, error: err.message }));
  });
}

testUrl(endpts[0]).then(console.log);
