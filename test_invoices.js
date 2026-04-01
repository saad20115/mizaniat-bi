const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3090,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => {
    const { token } = JSON.parse(data);
    
    // Now fetch invoices
    const req2 = http.request({
      hostname: 'localhost',
      port: 3090,
      path: '/api/sales/invoices?limit=5',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }, (res2) => {
      let data2 = '';
      res2.on('data', (chunk) => data2 += chunk);
      res2.on('end', () => {
        console.log('Status:', res2.statusCode);
        console.log('Response:', data2.slice(0, 500));
      });
    });
    
    req2.end();
  });
});

req.write(JSON.stringify({ email: 'saadm7294@gmail.com', password: '123' })); // Using '123' password since this might be the admin
req.end();
