const http = require('http');
http.get('http://localhost:3090/api/sales/customer-hierarchy', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    try {
      const hierarchy = JSON.parse(data);
      Object.keys(hierarchy).forEach(company => {
        console.log(`Company: ${company}`);
        Object.keys(hierarchy[company]).forEach(group => {
           console.log(`  Group: ${group}`);
        });
      });
    } catch(e) { console.log(e); }
  });
});
