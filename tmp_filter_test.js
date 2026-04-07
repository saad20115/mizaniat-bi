const http = require('http');

http.get('http://localhost:3090/api/sales/customer-hierarchy?dateFrom=2026-01-01&dateTo=2026-12-31&costCenters=' + encodeURIComponent('المختبرات'), (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      console.log('Success:', parsed.success);
      if (parsed.hierarchy) {
        console.log(JSON.stringify(parsed.hierarchy, null, 2).slice(0, 500) + '...');
      }
    } catch(e) { console.error('Error parsing JSON:', data); }
  });
});
