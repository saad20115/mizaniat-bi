const https = require('https');
const url = 'https://aboghaliaoffice.com/api/customer_invoices?company_id=1';
const auth = 'Basic ' + Buffer.from('saad@aboghaliaoffice.com:014603').toString('base64');
https.get(url, { headers: { 'Authorization': auth } }, (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        console.log('Array length:', parsed.length);
        console.log('First item:', JSON.stringify(parsed[0], null, 2));
      } else if (parsed.result && Array.isArray(parsed.result)) {
        console.log('Result array length:', parsed.result.length);
        console.log('First item:', JSON.stringify(parsed.result[0], null, 2));
      } else {
        console.log('Object keys:', Object.keys(parsed));
        console.log('First data item:', parsed.data ? JSON.stringify(parsed.data[0], null, 2) : 'no data array');
      }
    } catch(e) {
      console.log('Parse error:', e.message);
      console.log('Raw:', data.substring(0, 500));
    }
  });
}).on('error', e => console.log('req error:', e.message));
