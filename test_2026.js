const http = require('http');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const db = new Database('./data/mizaniat.db', { fileMustExist: true });

const token = jwt.sign({ id: 1, email: 'admin', role: 'admin' }, 'mizaniat-bi-secret-key-2026', { expiresIn: '7d' });

function httpGet(path) {
  return new Promise((resolve, reject) => {
    http.get({ hostname: 'localhost', port: 3090, path, headers: { Authorization: `Bearer ${token}` } }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { resolve(data); }
      });
    }).on('error', reject);
  });
}

async function main() {
  // Test year 2026 (what the user sees)
  console.log('=== Hierarchy 2026 ===');
  const res = await httpGet('/api/sales/customer-hierarchy?dateFrom=2026-01-01&dateTo=2026-12-31');
  if (!res.hierarchy) { console.log('ERROR:', res); return; }
  
  const h = res.hierarchy;
  Object.keys(h).forEach(co => {
    console.log(`\n🏢 ${co}:`);
    Object.keys(h[co]).forEach(g => {
      const ccs = Object.keys(h[co][g]);
      let gTotal = 0;
      ccs.forEach(cc => Object.values(h[co][g][cc]).forEach(pt => gTotal += pt.total));
      console.log(`  📂 ${g}: ${ccs.length} مراكز | ${Math.round(gTotal).toLocaleString()}`);
      ccs.forEach(cc => {
        const partners = Object.keys(h[co][g][cc]);
        let ccTotal = 0;
        partners.forEach(p => ccTotal += h[co][g][cc][p].total);
        console.log(`    🏗️ ${cc}: ${partners.length} عميل | ${Math.round(ccTotal).toLocaleString()}`);
      });
    });
  });
  
  // Also test "all years" (no date filter, which is what happens when user selects multiple years)
  console.log('\n\n=== Hierarchy ALL (no date filter) ===');
  const res2 = await httpGet('/api/sales/customer-hierarchy?');
  if (!res2.hierarchy) { console.log('ERROR:', res2); return; }
  const h2 = res2.hierarchy;
  Object.keys(h2).forEach(co => {
    console.log(`\n🏢 ${co}:`);
    Object.keys(h2[co]).forEach(g => {
      const ccs = Object.keys(h2[co][g]);
      let gTotal = 0;
      ccs.forEach(cc => Object.values(h2[co][g][cc]).forEach(pt => gTotal += pt.total));
      if (g === 'المختبر البيئي') {
        console.log(`  📂 ${g}: ${ccs.length} مراكز | ${Math.round(gTotal).toLocaleString()} ⚠️ CHECK THIS`);
        ccs.forEach(cc => {
          const partners = Object.keys(h2[co][g][cc]);
          partners.forEach(p => {
            const pt = h2[co][g][cc][p];
            console.log(`    🏗️ ${cc} > ${p}: total=${pt.total} refunds=${pt.refunds}`);
          });
        });
      } else {
        console.log(`  📂 ${g}: ${ccs.length} مراكز | ${Math.round(gTotal).toLocaleString()}`);
      }
    });
  });
}

main().catch(console.error);
