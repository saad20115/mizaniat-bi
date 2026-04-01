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
  const company = db.prepare(`SELECT sc.*, si.url, si.username, si.api_key 
    FROM sales_companies sc 
    JOIN sales_instances si ON sc.sales_instance_id = si.id 
    WHERE sc.id = 4`).get();
  
  console.log('Company:', company.name);
  console.log('sales_company_id:', company.sales_company_id);
  
  let baseUrl = company.url.replace(/\/+$/, '');
  if (baseUrl.includes('/api/')) baseUrl = baseUrl.split('/api/')[0];
  console.log('Base URL:', baseUrl);
  
  // Authenticate
  const dbRes = await jsonRpc(`${baseUrl}/web/database/list`, 'call', {});
  const dbName = dbRes.result[0];
  console.log('DB:', dbName);
  
  const authRes = await jsonRpc(`${baseUrl}/web/session/authenticate`, 'call', {
    db: dbName, login: company.username, password: company.api_key
  });
  const uid = authRes.result?.uid;
  console.log('UID:', uid);
  
  if (!uid) { console.error('Auth failed!'); return; }
  
  // Query Odoo directly: Count ALL posted invoices for Saudi Energy in 2026
  // partner_id for "الشركة السعودية للطاقة" - we need to find it first
  const partnerSearch = await jsonRpc(`${baseUrl}/jsonrpc`, 'call', {
    service: "object", method: "execute_kw",
    args: [dbName, uid, company.api_key,
      "res.partner", "search_read",
      [[["name", "ilike", "الشركة السعودية للطاقة"]]],
      { fields: ["id", "name"], limit: 10 }
    ]
  });
  console.log('\n=== Partner search results ===');
  console.log(partnerSearch.result);
  
  if (!partnerSearch.result || partnerSearch.result.length === 0) {
    console.log('Partner not found!');
    return;
  }
  
  const partnerId = partnerSearch.result[0].id;
  console.log('Using partner_id:', partnerId);
  
  // Get ALL moves for this partner in 2026
  const odooMoves = await jsonRpc(`${baseUrl}/jsonrpc`, 'call', {
    service: "object", method: "execute_kw",
    args: [dbName, uid, company.api_key,
      "account.move", "search_read",
      [[
        ["partner_id", "=", partnerId],
        ["state", "=", "posted"],
        ["invoice_date", ">=", "2026-01-01"],
        ["invoice_date", "<=", "2026-12-31"],
        ["move_type", "in", ["out_invoice", "out_refund", "out_receipt"]],
        ["company_id", "=", parseInt(company.sales_company_id)]
      ]],
      { fields: ["name", "move_type", "amount_total_signed", "amount_untaxed_signed", "amount_residual_signed", "invoice_date", "payment_state"], limit: 50000 }
    ]
  });
  
  const moves = odooMoves.result || [];
  console.log('\n=== Odoo direct query results ===');
  console.log('Total moves from Odoo:', moves.length);
  
  let odooInvoices = moves.filter(m => m.move_type === 'out_invoice');
  let odooRefunds = moves.filter(m => m.move_type === 'out_refund');
  
  console.log('Odoo invoices:', odooInvoices.length);
  console.log('Odoo refunds:', odooRefunds.length);
  
  let odooInvTotal = odooInvoices.reduce((s, m) => s + m.amount_total_signed, 0);
  let odooRefTotal = odooRefunds.reduce((s, m) => s + m.amount_total_signed, 0);
  let odooUntaxInv = odooInvoices.reduce((s, m) => s + m.amount_untaxed_signed, 0);
  let odooUntaxRef = odooRefunds.reduce((s, m) => s + m.amount_untaxed_signed, 0);
  
  console.log('\nOdoo Invoice total:', odooInvTotal.toFixed(2), '| Untaxed:', odooUntaxInv.toFixed(2));
  console.log('Odoo Refund total:', odooRefTotal.toFixed(2), '| Untaxed:', odooUntaxRef.toFixed(2));
  console.log('Odoo NET total:', (odooInvTotal + odooRefTotal).toFixed(2), '| NET Untaxed:', (odooUntaxInv + odooUntaxRef).toFixed(2));
  
  // Now compare with our DB
  const dbData = db.prepare(`
    SELECT COUNT(*) as cnt, SUM(amount_total) as tot, 
           SUM(CAST(json_extract(raw_data, '$.amount_untaxed') AS REAL)) as untax
    FROM sales_invoices 
    WHERE partner_name = 'الشركة السعودية للطاقة' 
      AND date LIKE '2026%' 
      AND LOWER(state) = 'posted'
  `).get();
  console.log('\nOur DB: Count:', dbData.cnt, '| Total:', dbData.tot, '| Untaxed:', dbData.untax);
  
  // Find missing invoices
  const dbInvoiceNames = new Set(
    db.prepare(`SELECT name FROM sales_invoices WHERE partner_name = 'الشركة السعودية للطاقة' AND date LIKE '2026%'`).all().map(r => r.name)
  );
  
  const missing = moves.filter(m => !dbInvoiceNames.has(m.name));
  console.log('\n=== MISSING from our DB ===');
  console.log('Missing count:', missing.length);
  if (missing.length > 0) {
    let missingTotal = missing.reduce((s, m) => s + m.amount_total_signed, 0);
    console.log('Missing total:', missingTotal.toFixed(2));
    console.table(missing.map(m => ({ name: m.name, type: m.move_type, total: m.amount_total_signed, date: m.invoice_date })));
  }
}

main().catch(console.error);
