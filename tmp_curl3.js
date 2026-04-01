const https = require('https');

async function testUrl(path) {
  return new Promise(resolve => {
    https.get('https://aboghaliaoffice.com' + path, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ path, response: data }));
    }).on('error', err => resolve({ path, error: err.message }));
  });
}

testUrl('/jsonrpc').then(console.log);
testUrl('/web/database/list').then(console.log);
