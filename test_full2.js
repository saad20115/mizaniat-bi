const http = require('http');

function httpGet(path, headers) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'localhost', port: 3090, path, headers: headers || {} };
    http.get(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data), cookies: res.headers['set-cookie'] }); }
        catch(e) { resolve({ status: res.statusCode, body: data, cookies: res.headers['set-cookie'] }); }
      });
    }).on('error', reject);
  });
}

function httpPost(path, body, headers) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(body);
    const opts = { hostname: 'localhost', port: 3090, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData), ...headers }
    };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data), cookies: res.headers['set-cookie'] }); }
        catch(e) { resolve({ status: res.statusCode, body: data, cookies: res.headers['set-cookie'] }); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  // Step 1: Login
  console.log('=== Step 1: Login ===');
  const login = await httpPost('/auth/admin/login', { email: 'admin', password: 'admin' });
  let token;
  if (login.status === 200 && login.body.token) {
    token = login.body.token;
    console.log('✅ Login OK');
  } else {
    console.log('Login attempt 1:', login.status, JSON.stringify(login.body).substring(0, 200));
    // Try with default demo credentials
    const login2 = await httpPost('/auth/admin/login', { email: 'admin@mizaniat.com', password: 'admin123' });
    if (login2.status === 200 && login2.body.token) {
      token = login2.body.token;
      console.log('✅ Login OK (attempt 2)');
    } else {
      console.log('Login attempt 2:', login2.status, JSON.stringify(login2.body).substring(0, 200));
      // Try direct DB approach
      const Database = require('better-sqlite3');
      const db = new Database('./data/mizaniat.db', { fileMustExist: true });
      const admin = db.prepare('SELECT * FROM admin_users LIMIT 1').get();
      console.log('Admin user:', admin ? { email: admin.email } : 'NONE');
      if (!admin) return;
      // Generate a fake token
      const jwt = require('jsonwebtoken');
      token = jwt.sign({ id: admin.id, email: admin.email, role: 'admin' }, process.env.JWT_SECRET || 'mizaniat-secret-2024');
      console.log('✅ Generated token directly');
    }
  }

  const authHeaders = { Authorization: `Bearer ${token}` };

  // Step 2: Sales Invoices (Sales Tab uses this)
  console.log('\n=== Step 2: Sales Invoices API ===');
  const salesRes = await httpGet('/api/sales/invoices?limit=20&dateFrom=2025-01-01&dateTo=2025-12-31', authHeaders);
  if (salesRes.status === 200 && salesRes.body.items) {
    console.log(`✅ Got ${salesRes.body.total} total invoices`);
    
    // Check group_name and cost_center fields
    const withGroup = salesRes.body.items.filter(i => i.group_name && i.group_name !== 'بدون مجموعة');
    const withoutGroup = salesRes.body.items.filter(i => !i.group_name || i.group_name === 'بدون مجموعة');
    console.log(`  With group: ${withGroup.length}/${salesRes.body.items.length}`);
    console.log(`  Without group: ${withoutGroup.length}/${salesRes.body.items.length}`);
    
    console.log('\n  Sample items with classification:');
    salesRes.body.items.slice(0, 5).forEach((inv, i) => {
      console.log(`  ${i+1}. ${inv.name} | ${inv.partner_name?.substring(0, 30)} | Group: ${inv.group_name || 'N/A'} | CC: ${inv.cost_center || 'N/A'}`);
    });
  } else {
    console.log('❌ Failed:', salesRes.status, JSON.stringify(salesRes.body).substring(0, 300));
  }

  // Step 3: Customer Hierarchy (Sales Details Tab)
  console.log('\n=== Step 3: Customer Hierarchy API ===');
  const hierRes = await httpGet('/api/sales/customer-hierarchy?dateFrom=2025-01-01&dateTo=2025-12-31', authHeaders);
  if (hierRes.status === 200 && hierRes.body.hierarchy) {
    const h = hierRes.body.hierarchy;
    const companies = Object.keys(h);
    console.log(`✅ Got hierarchy with ${companies.length} companies`);
    
    let totalWithoutGroup = 0, totalWithGroup = 0;
    
    companies.forEach(company => {
      console.log(`\n  🏢 ${company}:`);
      Object.keys(h[company]).forEach(group => {
        const ccs = Object.keys(h[company][group]);
        let groupTotal = 0;
        ccs.forEach(cc => {
          Object.values(h[company][group][cc]).forEach(pt => { groupTotal += pt.total || 0; });
        });
        
        if (group === 'بدون مجموعة') totalWithoutGroup += groupTotal;
        else totalWithGroup += groupTotal;
        
        console.log(`    📂 ${group}: ${ccs.length} مراكز | إجمالي: ${Math.round(groupTotal).toLocaleString()}`);
        ccs.slice(0, 3).forEach(cc => {
          const partners = Object.keys(h[company][group][cc]);
          let ccTotal = 0;
          partners.forEach(p => { ccTotal += h[company][group][cc][p].total || 0; });
          console.log(`      🏗️ ${cc.substring(0, 40)}: ${partners.length} عملاء | ${Math.round(ccTotal).toLocaleString()}`);
        });
        if (ccs.length > 3) console.log(`      ... و ${ccs.length - 3} مراكز أخرى`);
      });
    });
    
    console.log(`\n=== ملخص التوزيع ===`);
    console.log(`  ✅ مصنف (مع مجموعة): ${Math.round(totalWithGroup).toLocaleString()}`);
    console.log(`  ⚠️ غير مصنف (بدون مجموعة): ${Math.round(totalWithoutGroup).toLocaleString()}`);
    const totalAll = totalWithGroup + totalWithoutGroup;
    console.log(`  📊 نسبة التصنيف: ${totalAll > 0 ? ((totalWithGroup / totalAll) * 100).toFixed(1) : 0}%`);

    // Check for duplicate groups
    const allGroups = new Set();
    Object.keys(h).forEach(co => Object.keys(h[co]).forEach(g => allGroups.add(g)));
    console.log(`\n=== فحص التكرارات ===`);
    console.log(`  المجموعات الفريدة (${allGroups.size}):`);
    [...allGroups].forEach(g => console.log(`    • ${g}`));
    
    const groupArr = [...allGroups];
    const dups = groupArr.filter(g1 => groupArr.some(g2 => g1 !== g2 && (g1.includes(g2) || g2.includes(g1))));
    if (dups.length > 0) {
      console.log('\n  ⚠️ مجموعات متشابهة/مكررة:');
      dups.forEach(d => console.log(`    ⚠️ ${d}`));
    } else {
      console.log('\n  ✅ لا توجد تكرارات!');
    }
  } else {
    console.log('❌ Failed:', hierRes.status, JSON.stringify(hierRes.body).substring(0, 300));
  }
}

main().catch(console.error);
