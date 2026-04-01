const https = require('https');

async function testRpc(method, params, session_id) {
  return new Promise(resolve => {
    const postData = JSON.stringify({ jsonrpc: "2.0", method: method, params: params || {}, id: 1 });
    const req = https.request('https://aboghaliaoffice.com/jsonrpc', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Cookie': session_id ? `session_id=${session_id}` : ''
      }
    }, (res) => {
      let setCookie = res.headers['set-cookie'];
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ response: JSON.parse(data), setCookie }));
    }).on('error', err => resolve({ error: err.message }));
    req.write(postData);
    req.end();
  });
}

testRpc('call', { service: "common", method: "authenticate", args: ["second_odoo_17", "saad@aboghaliaoffice.com", "014603", {}] }).then(authRes => {
  const uid = authRes.response.result;
  console.log('uid', uid);
  if (!uid) return;
  
  testRpc('call', {
    service: "object",
    method: "execute_kw",
    args: [
      "second_odoo_17", uid, "014603",
      "account.move", "search_read",
      [[["move_type", "in", ["out_refund", "out_receipt"]]]],
      { limit: 3, fields: ["name", "partner_id", "invoice_date", "amount_total_signed", "state", "amount_untaxed_signed", "amount_residual_signed", "company_id", "payment_state"] }
    ]
  }).then(res => {
    console.log(JSON.stringify(res.response.result, null, 2));
  });
});
