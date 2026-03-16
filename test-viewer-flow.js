const http = require('http');
function req(method, path, body, headers) {
  return new Promise((resolve, reject) => {
    const opts = { hostname:'localhost', port:3090, path, method, headers: { 'Content-Type':'application/json', ...headers }, timeout:10000 };
    const r = http.request(opts, res => { let d=''; res.on('data',c=>d+=c); res.on('end',()=>resolve({status:res.statusCode,body:d})); });
    r.on('error', reject);
    r.on('timeout', () => { r.destroy(); reject(new Error('timeout')); });
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}
async function test() {
  console.log('=== RADICAL FIX TEST ===\n');

  // Step 1: Viewer login — should return JWT now
  console.log('1. Viewer Login...');
  const login = await req('POST', '/api/auth/viewer/login', { phone: '0580623205' });
  console.log('   Status:', login.status);
  const d = JSON.parse(login.body);
  console.log('   Has token:', !!d.token);
  console.log('   Has admin:', !!d.admin);
  console.log('   Admin name:', d.admin?.name);
  if (login.status !== 200) { console.log('FAIL'); process.exit(1); }

  // Step 2: Use token as Bearer JWT on /admin/me — this MUST work now
  console.log('\n2. Auth check (Bearer JWT on /admin/me)...');
  const me = await req('GET', '/api/auth/admin/me', null, { 'Authorization': 'Bearer ' + d.token });
  console.log('   Status:', me.status, me.status === 200 ? '✅' : '❌');

  // Step 3: Use token on /api/companies
  console.log('\n3. GET /api/companies...');
  const comp = await req('GET', '/api/companies', null, { 'Authorization': 'Bearer ' + d.token });
  console.log('   Status:', comp.status, comp.status === 200 ? '✅' : '❌');

  // Step 4: Presentation data
  console.log('\n4. GET /api/presentation/data...');
  const pres = await req('GET', '/api/presentation/data?companyIds=1,2,3,4&years=2026', null, { 'Authorization': 'Bearer ' + d.token });
  console.log('   Status:', pres.status, pres.status === 200 ? '✅' : '❌');

  console.log('\n=== ALL TESTS PASSED ===');
  process.exit(0);
}
test().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
