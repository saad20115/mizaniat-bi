// Full test of both Sales and Sales Details tabs
const http = require('http');

function httpGet(path, cookie) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'localhost', port: 3090, path, headers: {} };
    if (cookie) opts.headers.Cookie = cookie;
    http.get(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers }); }
        catch(e) { resolve({ status: res.statusCode, body: data, headers: res.headers }); }
      });
    }).on('error', reject);
  });
}

function httpPost(path, body) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const opts = { hostname: 'localhost', port: 3090, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) }
    };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers }); }
        catch(e) { resolve({ status: res.statusCode, body: data, headers: res.headers }); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('=== TEST 1: Login ===');
  const login = await httpPost('/api/auth/login', { email: 'admin', password: 'admin' });
  if (login.status !== 200 || !login.body.token) {
    console.log('Login failed:', login.status, login.body);
    // Try different credentials
    const login2 = await httpPost('/api/auth/login', { email: 'admin@mizaniat.com', password: 'admin123' });
    if (login2.status !== 200) {
      console.log('Login2 failed:', login2.status, login2.body);
      return;
    }
    var token = login2.body.token;
  } else {
    var token = login.body.token;
  }
  console.log('✅ Login OK, token:', token ? token.substring(0, 20) + '...' : 'MISSING');

  const auth = `token=${token}`;

  // TEST 2: Sales Invoices (Sales Tab)
  console.log('\n=== TEST 2: Sales Invoices (Sales Tab) ===');
  const salesRes = await httpGet('/api/sales/invoices?limit=10&dateFrom=2025-01-01&dateTo=2025-12-31', auth);
  if (salesRes.status === 200 && salesRes.body.items) {
    console.log(`✅ Got ${salesRes.body.total} invoices, showing first 3:`);
    salesRes.body.items.slice(0, 3).forEach(inv => {
      console.log(`  📄 ${inv.name} | Partner: ${inv.partner_name} | Group: ${inv.group_name || 'N/A'} | CC: ${inv.cost_center || 'N/A'} | Amount: ${inv.amount_total}`);
    });
    
    // Check distribution
    const groups = {};
    const ccs = {};
    salesRes.body.items.forEach(inv => {
      const g = inv.group_name || 'بدون مجموعة';
      const c = inv.cost_center || 'بدون مركز تكلفة';
      groups[g] = (groups[g] || 0) + 1;
      ccs[c] = (ccs[c] || 0) + 1;
    });
    console.log('\n  Groups distribution (first 10 items):');
    Object.entries(groups).forEach(([g, c]) => console.log(`    📂 ${g}: ${c} invoices`));
    console.log('\n  Cost Centers distribution (first 10 items):');
    Object.entries(ccs).slice(0, 5).forEach(([cc, c]) => console.log(`    🏗️ ${cc}: ${c} invoices`));
  } else {
    console.log('❌ Sales invoices failed:', salesRes.status, salesRes.body);
  }

  // TEST 3: Customer Hierarchy (Sales Details Tab)
  console.log('\n=== TEST 3: Customer Hierarchy (Sales Details Tab) ===');
  const hierRes = await httpGet('/api/sales/customer-hierarchy?dateFrom=2025-01-01&dateTo=2025-12-31', auth);
  if (hierRes.status === 200 && hierRes.body.hierarchy) {
    const h = hierRes.body.hierarchy;
    const companies = Object.keys(h);
    console.log(`✅ Got hierarchy with ${companies.length} companies`);
    
    let totalWithoutGroup = 0;
    let totalWithGroup = 0;
    
    companies.forEach(company => {
      console.log(`\n  🏢 ${company}:`);
      Object.keys(h[company]).forEach(group => {
        const ccs = Object.keys(h[company][group]);
        let groupTotal = 0;
        ccs.forEach(cc => {
          Object.values(h[company][group][cc]).forEach(pt => {
            groupTotal += pt.total || 0;
          });
        });
        
        if (group === 'بدون مجموعة') {
          totalWithoutGroup += groupTotal;
        } else {
          totalWithGroup += groupTotal;
        }
        
        console.log(`    📂 ${group} (${ccs.length} مراكز) — إجمالي: ${Math.round(groupTotal).toLocaleString()}`);
        ccs.slice(0, 3).forEach(cc => {
          const partners = Object.keys(h[company][group][cc]);
          let ccTotal = 0;
          partners.forEach(p => { ccTotal += h[company][group][cc][p].total || 0; });
          console.log(`      🏗️ ${cc} (${partners.length} عملاء) — ${Math.round(ccTotal).toLocaleString()}`);
        });
        if (ccs.length > 3) console.log(`      ... و ${ccs.length - 3} مراكز أخرى`);
      });
    });
    
    console.log(`\n=== ملخص التوزيع ===`);
    console.log(`  ✅ مع مجموعة: ${Math.round(totalWithGroup).toLocaleString()}`);
    console.log(`  ⚠️ بدون مجموعة: ${Math.round(totalWithoutGroup).toLocaleString()}`);
    const pct = totalWithGroup + totalWithoutGroup > 0 ? 
      ((totalWithGroup / (totalWithGroup + totalWithoutGroup)) * 100).toFixed(1) : 0;
    console.log(`  📊 نسبة التصنيف: ${pct}%`);
  } else {
    console.log('❌ Hierarchy failed:', hierRes.status, hierRes.body);
  }

  // TEST 4: Check for duplicate groups
  console.log('\n=== TEST 4: Check for Duplicate Groups ===');
  if (hierRes.status === 200 && hierRes.body.hierarchy) {
    const h = hierRes.body.hierarchy;
    const allGroups = new Set();
    Object.keys(h).forEach(co => {
      Object.keys(h[co]).forEach(g => allGroups.add(g));
    });
    console.log('All unique groups:');
    [...allGroups].forEach(g => console.log(`  📂 ${g}`));
    
    // Check for duplicates like "العقد الموحد" vs "العقد الموحد (المجموعة)"
    const groupNames = [...allGroups];
    const duplicates = groupNames.filter(g1 => 
      groupNames.some(g2 => g1 !== g2 && (g1.includes(g2) || g2.includes(g1)))
    );
    if (duplicates.length > 0) {
      console.log('\n⚠️ Possible duplicate groups:');
      duplicates.forEach(d => console.log(`  ⚠️ ${d}`));
    } else {
      console.log('\n✅ No duplicate groups found!');
    }
  }
}

main().catch(console.error);
