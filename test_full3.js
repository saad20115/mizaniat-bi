const http = require('http');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');

const JWT_SECRET = 'mizaniat-bi-secret-key-2026';

function httpGet(path, headers) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: 'localhost', port: 3090, path, headers: headers || {} };
    http.get(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    }).on('error', reject);
  });
}

async function main() {
  // Generate valid token
  const db = new Database('./data/mizaniat.db', { fileMustExist: true });
  const admin = db.prepare('SELECT * FROM admin_users LIMIT 1').get();
  const token = jwt.sign({ id: admin.id, email: admin.email, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
  const authHeaders = { Authorization: `Bearer ${token}` };
  console.log('✅ Auth ready\n');

  // TEST A: Sales Invoices (used by Sales Tab)
  console.log('=== TEST A: Sales Invoices (تبويب المبيعات) ===');
  const salesRes = await httpGet('/api/sales/invoices?limit=20&dateFrom=2025-01-01&dateTo=2025-12-31', authHeaders);
  if (salesRes.status === 200 && salesRes.body.items) {
    console.log(`✅ Total: ${salesRes.body.total} invoices`);
    
    const withGroup = salesRes.body.items.filter(i => i.group_name && i.group_name !== 'بدون مجموعة');
    const withoutGroup = salesRes.body.items.filter(i => !i.group_name || i.group_name === 'بدون مجموعة');
    console.log(`  مصنف: ${withGroup.length}/${salesRes.body.items.length} | غير مصنف: ${withoutGroup.length}/${salesRes.body.items.length}`);
    
    console.log('\n  عينة:');
    salesRes.body.items.slice(0, 5).forEach((inv, i) => {
      console.log(`  ${i+1}. ${inv.name} | ${(inv.partner_name||'').substring(0, 35)} | G: ${inv.group_name || '—'} | CC: ${(inv.cost_center || '—').substring(0, 30)}`);
    });
  } else {
    console.log('❌ Failed:', salesRes.status, JSON.stringify(salesRes.body).substring(0, 300));
  }

  // TEST B: Customer Hierarchy (used by Sales Details Tab)  
  console.log('\n=== TEST B: Customer Hierarchy (تبويب تفاصيل المبيعات) ===');
  const hierRes = await httpGet('/api/sales/customer-hierarchy?dateFrom=2025-01-01&dateTo=2025-12-31', authHeaders);
  if (hierRes.status === 200 && hierRes.body.hierarchy) {
    const h = hierRes.body.hierarchy;
    const companies = Object.keys(h);
    console.log(`✅ ${companies.length} شركات`);
    
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
        
        console.log(`    📂 ${group}: ${ccs.length} مراكز | ${Math.round(groupTotal).toLocaleString()}`);
        ccs.slice(0, 4).forEach(cc => {
          const partners = Object.keys(h[company][group][cc]);
          let ccTotal = 0;
          partners.forEach(p => { ccTotal += h[company][group][cc][p].total || 0; });
          console.log(`      🏗️ ${cc.substring(0, 45)}: ${partners.length} عميل | ${Math.round(ccTotal).toLocaleString()}`);
        });
        if (ccs.length > 4) console.log(`      ... +${ccs.length - 4} مراكز`);
      });
    });
    
    const totalAll = totalWithGroup + totalWithoutGroup;
    console.log(`\n${'='.repeat(50)}`);
    console.log(`  ✅ مصنف: ${Math.round(totalWithGroup).toLocaleString()}`);
    console.log(`  ⚠️ غير مصنف: ${Math.round(totalWithoutGroup).toLocaleString()}`);
    console.log(`  📊 نسبة التصنيف: ${totalAll > 0 ? ((totalWithGroup / totalAll) * 100).toFixed(1) : 0}%`);

    // Duplicate check
    const allGroups = new Set();
    Object.keys(h).forEach(co => Object.keys(h[co]).forEach(g => allGroups.add(g)));
    console.log(`\n=== فحص التكرارات ===`);
    [...allGroups].forEach(g => console.log(`  • ${g}`));
    const groupArr = [...allGroups];
    const dups = groupArr.filter(g1 => groupArr.some(g2 => g1 !== g2 && (g1.includes(g2) || g2.includes(g1))));
    if (dups.length > 0) {
      console.log('\n  ⚠️ مجموعات مكررة:');
      dups.forEach(d => console.log(`    ⚠️ ${d}`));
    } else {
      console.log('\n  ✅ لا توجد تكرارات!');
    }
  } else {
    console.log('❌ Failed:', hierRes.status, JSON.stringify(hierRes.body).substring(0, 300));
  }

  // TEST C: Hierarchy with different date range (2024)
  console.log('\n=== TEST C: Hierarchy 2024 ===');
  const hier2024 = await httpGet('/api/sales/customer-hierarchy?dateFrom=2024-01-01&dateTo=2024-12-31', authHeaders);
  if (hier2024.status === 200 && hier2024.body.hierarchy) {
    const h = hier2024.body.hierarchy;
    let tw = 0, two = 0;
    Object.keys(h).forEach(co => Object.keys(h[co]).forEach(g => {
      Object.keys(h[co][g]).forEach(cc => Object.values(h[co][g][cc]).forEach(pt => {
        if (g === 'بدون مجموعة') two += pt.total || 0; else tw += pt.total || 0;
      }));
    }));
    console.log(`  ✅ مصنف: ${Math.round(tw).toLocaleString()} | غير مصنف: ${Math.round(two).toLocaleString()} | نسبة: ${((tw/(tw+two))*100).toFixed(1)}%`);
  } else {
    console.log('❌ Failed:', hier2024.status);
  }
}

main().catch(console.error);
