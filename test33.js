const http = require('http');
http.get('http://localhost:3090/api/sales/customer-hierarchy', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    console.log(data);
  });
});
