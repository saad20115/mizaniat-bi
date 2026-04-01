const https = require('https');
https.get('https://aboghaliaoffice.com/api/customer_invoices?company_id=1', (res) => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) {
        console.log('Array of', parsed.length, 'items. First item:', JSON.stringify(parsed[0], null, 2));
      } else {
        console.log('Object keys:', Object.keys(parsed));
        if (parsed.data) {
          console.log('First data item:', JSON.stringify(parsed.data[0] || {}, null, 2));
        } else if (parsed.result) {
          console.log('First result item:', JSON.stringify(parsed.result[0] || {}, null, 2));
        } else {
          console.log(JSON.stringify(parsed).substring(0, 500));
        }
      }
    } catch(e) {
      console.log('Failed to parse:', e.message);
      console.log('Raw:', data.substring(0, 500));
    }
  });
}).on('error', e => console.log('req error:', e.message));
