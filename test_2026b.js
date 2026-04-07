const http = require('http');
const jwt = require('jsonwebtoken');

const token = jwt.sign({ id: 2, email: 'saadm7294@gmail.com', role: 'admin' }, 'mizaniat-bi-secret-key-2026', { expiresIn: '7d' });

function httpGet(path) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: 'localhost', port: 3090, path, headers: { Authorization: `Bearer ${token}` } }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { resolve(data); } });
    }).on('error', reject);
  });
}

async function main() {
  // Test year 2026
  console.log('=== Hierarchy 2026 ===');
  const res = await httpGet('/api/sales/customer-hierarchy?dateFrom=2026-01-01&dateTo=2026-12-31');
  if (!res.hierarchy) { console.log('ERROR:', JSON.stringify(res).substring(0,200)); return; }
  
  const h = res.hierarchy;
  Object.keys(h).forEach(co => {
    console.log(`\n🏢 ${co}:`);
    Object.keys(h[co]).forEach(g => {
      const ccs = Object.keys(h[co][g]);
      let gTotal = 0;
      ccs.forEach(cc => Object.values(h[co][g][cc]).forEach(pt => gTotal += pt.total));
      console.log(`  📂 ${g}: ${ccs.length} مراكز | ${Math.round(gTotal).toLocaleString()}`);
      
      if (g === 'المختبر البيئي' || g === 'الادارة') {
        ccs.forEach(cc => {
          const partners = Object.keys(h[co][g][cc]);
          partners.forEach(p => {
            const pt = h[co][g][cc][p];
            console.log(`    🏗️ ${cc} > ${p}: total=${pt.total} refunds=${pt.refunds}`);
          });
        });
      }
    });
  });
  
  // Test ALL dates
  console.log('\n\n=== Hierarchy ALL DATES ===');
  const res2 = await httpGet('/api/sales/customer-hierarchy?dateFrom=2020-01-01&dateTo=2030-12-31');
  if (!res2.hierarchy) { console.log('ERROR2:', JSON.stringify(res2).substring(0,200)); return; }
  const h2 = res2.hierarchy;
  Object.keys(h2).forEach(co => {
    console.log(`\n🏢 ${co}:`);
    Object.keys(h2[co]).forEach(g => {
      const ccs = Object.keys(h2[co][g]);
      let gTotal = 0;
      ccs.forEach(cc => Object.values(h2[co][g][cc]).forEach(pt => gTotal += pt.total));
      console.log(`  📂 ${g}: ${ccs.length} مراكز | ${Math.round(gTotal).toLocaleString()}`);
      if (g === 'المختبر البيئي') {
        ccs.forEach(cc => {
          const partners = Object.keys(h2[co][g][cc]);
          partners.forEach(p => {
            const pt = h2[co][g][cc][p];
            console.log(`    ⚠️ ${cc} > ${p}: total=${pt.total}`);
          });
        });
      }
    });
  });
}

main().catch(console.error);
