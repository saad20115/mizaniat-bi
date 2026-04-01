const db = require('./node_modules/better-sqlite3')('data/mizaniat.db');
const https = require('https');
const http = require('http');

function jsonRpc(url, method, params) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const postData = JSON.stringify({ jsonrpc: "2.0", method: method, params: params || {}, id: 1 });
    const req = protocol.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
      timeout: 120000
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  const companies = db.prepare(`
    SELECT sc.id, sc.name, sc.sales_company_id, si.url, si.username, si.api_key 
    FROM sales_companies sc 
    JOIN sales_instances si ON sc.sales_instance_id = si.id 
    WHERE sc.is_active = 1
  `).all();

  let baseUrl = companies[0].url.replace(/\/+$/, '');
  if (baseUrl.includes('/api/')) baseUrl = baseUrl.split('/api/')[0];

  // Auth once
  const dbRes = await jsonRpc(`${baseUrl}/web/database/list`, 'call', {});
  const dbName = dbRes.result[0];
  const authRes = await jsonRpc(`${baseUrl}/web/session/authenticate`, 'call', {
    db: dbName, login: companies[0].username, password: companies[0].api_key
  });
  const uid = authRes.result?.uid;
  if (!uid) { console.error('Auth failed!'); return; }

  for (const company of companies) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Company: ${company.name} (id=${company.id}, odoo_company_id=${company.sales_company_id})`);
    
    // Odoo count
    const odooCount = await jsonRpc(`${baseUrl}/jsonrpc`, 'call', {
      service: "object", method: "execute_kw",
      args: [dbName, uid, company.api_key,
        "account.move", "search_count",
        [[
          ["move_type", "in", ["out_invoice", "out_refund", "out_receipt"]],
          ["company_id", "=", parseInt(company.sales_company_id)],
          ["state", "=", "posted"]
        ]]
      ]
    });
    
    const odooTotal = await jsonRpc(`${baseUrl}/jsonrpc`, 'call', {
      service: "object", method: "execute_kw",
      args: [dbName, uid, company.api_key,
        "account.move", "read_group",
        [[
          ["move_type", "in", ["out_invoice", "out_refund", "out_receipt"]],
          ["company_id", "=", parseInt(company.sales_company_id)],
          ["state", "=", "posted"]
        ]],
        { fields: ["amount_total_signed:sum"], groupby: ["move_type"] }
      ]
    });
    
    const dbCount = db.prepare(`SELECT COUNT(*) as cnt FROM sales_invoices WHERE company_id = ? AND LOWER(state) = 'posted'`).get(company.id);
    const dbTotal = db.prepare(`SELECT SUM(amount_total) as tot FROM sales_invoices WHERE company_id = ? AND LOWER(state) = 'posted'`).get(company.id);
    
    console.log(`Odoo posted count: ${odooCount.result}`);
    console.log(`Our DB posted count: ${dbCount.cnt}`);
    console.log(`Difference: ${odooCount.result - dbCount.cnt} records`);
    
    if (odooTotal.result) {
      let odooSum = odooTotal.result.reduce((s, g) => s + (g.amount_total_signed || 0), 0);
      console.log(`Odoo total: ${odooSum.toFixed(2)}`);
      console.log(`Our DB total: ${dbTotal.tot?.toFixed(2) || 0}`);
      console.log(`Amount difference: ${(odooSum - (dbTotal.tot || 0)).toFixed(2)}`);
    }
    
    // Check corrupted names
    const corrupted = db.prepare(`SELECT COUNT(*) as cnt FROM sales_invoices WHERE company_id = ? AND partner_name LIKE '%�%'`).get(company.id);
    if (corrupted.cnt > 0) {
      console.log(`⚠️  Corrupted partner names: ${corrupted.cnt} records`);
    }
  }
}

main().catch(console.error);
