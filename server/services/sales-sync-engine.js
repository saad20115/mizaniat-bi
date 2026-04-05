const { getDb } = require('../db/connection');
const https = require('https');
const http = require('http');

class SalesSyncEngine {
  constructor() {
    this.progressMap = new Map();
  }

  getSyncStatus() {
    try {
      const db = getDb();
      return db.prepare(`
        SELECT sl.*, c.name as company_name 
        FROM sales_sync_logs sl
        LEFT JOIN sales_companies c ON c.id = sl.company_id
        ORDER BY sl.started_at DESC LIMIT 50
      `).all();
    } catch(e) { return []; }
  }

  getProgress(companyId) {
    return this.progressMap.get(companyId) || { status: 'idle', phase: '', inserted: 0, total: 0 };
  }

  _updateProgress(companyId, data) {
    this.progressMap.set(companyId, { ...(this.progressMap.get(companyId) || {}), ...data });
  }

  _httpRequest(url, username, password) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const authHeader = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
      
      const req = protocol.get(url, {
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json'
        },
        timeout: 120000
      }, (res) => {
        if (res.statusCode === 401) return reject(new Error('فشل المصادقة'));
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => resolve(data));
      });
      
      req.on('timeout', () => { req.destroy(); reject(new Error('انتهت المهلة')); });
      req.on('error', reject);
    });
  }

  _jsonRpcRequest(url, method, params) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const postData = JSON.stringify({ jsonrpc: "2.0", method: method, params: params || {}, id: Math.floor(Math.random()*1000) });
      
      const req = protocol.request(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        },
        timeout: 120000
      }, (res) => {
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(data)); } catch(e) { reject(e); }
        });
      });
      
      req.on('timeout', () => { req.destroy(); reject(new Error('انتهت مهلة استدعاء RPC')); });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  async syncCompany(companyId) {
    const db = getDb();
    const logStmt = db.prepare('INSERT INTO sales_sync_logs (company_id, sync_type, status, error_message) VALUES (?, ?, ?, ?)');
    let logId;
    
    try {
      this._updateProgress(companyId, { status: 'running', phase: 'تهيئة الخادم...', inserted: 0, total: 0 });
      const logResult = logStmt.run(companyId, 'full', 'running', null);
      logId = logResult.lastInsertRowid;

      const company = db.prepare('SELECT * FROM sales_companies WHERE id = ?').get(companyId);
      if (!company) throw new Error('الشركة غير موجودة');

      const instance = db.prepare('SELECT * FROM sales_instances WHERE id = ?').get(company.sales_instance_id);
      if (!instance) throw new Error('لا يوجد اتصال منسوب لهذه الشركة');

      this._updateProgress(companyId, { phase: 'جلب الفواتير من الخادم...', total: 100, inserted: 10 });
      
      // Build standard Aboghalia API URL
      let baseUrl = instance.url.replace(/\/+$/, '');
      if (baseUrl.includes('/api/customer_invoices')) {
        baseUrl = baseUrl.split('/api/customer_invoices')[0];
      }
      const fullUrl = `${baseUrl}/api/customer_invoices?company_id=${company.sales_company_id}`;
      
      const rawData = await this._httpRequest(fullUrl, instance.username, instance.api_key);
      const parsed = JSON.parse(rawData);
      
      // Check response structure
      let invoices = [];
      if (Array.isArray(parsed)) invoices = parsed;
      else if (parsed.data && Array.isArray(parsed.data)) invoices = parsed.data;
      else if (parsed.result && Array.isArray(parsed.result)) invoices = parsed.result;
      else throw new Error('بنية البيانات المستلمة غير مدعومة');

      // Odoo JSON-RPC: fetch ALL moves to fix corrupted names and fill missing invoices
      try {
        this._updateProgress(companyId, { phase: 'جارِ المطابقة وتصحيح البيانات عبر Odoo...' });
        
        const dbRes = await this._jsonRpcRequest(`${baseUrl}/web/database/list`, 'call', {});
        const odooDbs = dbRes.result || [];
        
        if (odooDbs.length > 0) {
          const dbName = odooDbs[0];
          
          const authRes = await this._jsonRpcRequest(`${baseUrl}/web/session/authenticate`, 'call', {
            db: dbName, login: instance.username, password: instance.api_key
          });
          const uid = authRes.result?.uid || (typeof authRes.result === 'number' ? authRes.result : null);
          
          if (uid) {
            const odooRes = await this._jsonRpcRequest(`${baseUrl}/jsonrpc`, 'call', {
              service: "object",
              method: "execute_kw",
              args: [
                dbName, uid, instance.api_key,
                "account.move", "search_read",
                [[
                  ["move_type", "in", ["out_invoice", "out_refund", "out_receipt", "entry"]],
                  ["company_id", "=", parseInt(company.sales_company_id)]
                ]],
                { 
                  fields: ["name", "partner_id", "invoice_date", "amount_total_signed", "state", "amount_untaxed_signed", "amount_residual_signed", "company_id", "payment_state", "ref", "move_type", "journal_id"],
                  limit: 50000 
                }
              ]
            });
            
            if (odooRes.result && Array.isArray(odooRes.result)) {
              // Build lookup map from Odoo's clean data (keyed by invoice name)
              const odooMap = new Map();
              for (const r of odooRes.result) {
                const name = r.name || '';
                odooMap.set(name, {
                  id: r.id,
                  invoice_number: r.name,
                  partner_name: r.partner_id ? r.partner_id[1] : 'عميل غير معروف',
                  invoice_date: r.invoice_date,
                  amount_total_signed: r.amount_total_signed,
                  amount_untaxed: r.amount_untaxed_signed,
                  total_paid: r.amount_total_signed - r.amount_residual_signed,
                  status: r.state === 'posted' ? 'Posted' : 'Draft',
                  move_type: (r.move_type === 'out_refund' || r.move_type === 'out_receipt' || r.move_type === 'entry') ? 'Customer Credit Note' : 'Customer Invoice',
                  reference: r.ref || '',
                  payment_status: r.payment_state || '',
                  journal_name: r.journal_id ? r.journal_id[1] : ''
                });
              }
              
              console.log(`[Sales Sync] Odoo returned ${odooMap.size} records for company ${companyId}`);
              
              // Merge: for each API invoice, fix partner_name from Odoo if available
              // Also track which Odoo records are already covered
              const coveredNames = new Set();
              for (let i = 0; i < invoices.length; i++) {
                const invName = invoices[i].invoice_number || invoices[i].name || '';
                if (odooMap.has(invName)) {
                  const odooRecord = odooMap.get(invName);
                  // Preserve API data but fix partner_name and move_type from Odoo (clean UTF-8)
                  invoices[i].partner_name = odooRecord.partner_name;
                  invoices[i].move_type = odooRecord.move_type;
                  if (!invoices[i].reference && odooRecord.reference) {
                    invoices[i].reference = odooRecord.reference;
                  }
                  if (!invoices[i].journal_name && odooRecord.journal_name) {
                    invoices[i].journal_name = odooRecord.journal_name;
                  }
                  coveredNames.add(invName);
                }
              }
              
              // Add any Odoo records not found in the API data (missing invoices)
              let added = 0;
              for (const [name, record] of odooMap) {
                if (!coveredNames.has(name)) {
                  invoices.push(record);
                  added++;
                }
              }
              
              if (added > 0) {
                console.log(`[Sales Sync] Added ${added} missing invoices from Odoo for company ${companyId}`);
              }
            }
          }
        }
      } catch (rpcErr) {
        console.warn(`[Sales Sync] Odoo JSON-RPC failed for company ${companyId}:`, rpcErr.message);
      }

      // Update actual company name from API if present
      if (invoices.length > 0) {
        const actualCompanyName = invoices[0].company_name || invoices[0].company;
        if (actualCompanyName) {
          db.prepare('UPDATE sales_companies SET name = ? WHERE id = ?').run(actualCompanyName, companyId);
        }
      }

      this._updateProgress(companyId, { phase: 'جارِ إعداد البيانات للحفظ...', total: invoices.length, inserted: 0 });

      // Save to database
      db.prepare('DELETE FROM sales_invoices WHERE company_id = ?').run(companyId);
      
      const insertStmt = db.prepare(`
        INSERT INTO sales_invoices (company_id, invoice_id, name, partner_name, date, amount_total, state, raw_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const insertMany = db.transaction((rows) => {
        let count = 0;
        for (const row of rows) {
          // Extract fields based on Aboghalia API
          const invId = row.id || 0;
          const name = row.invoice_number || row.name || row.reference || '';
          const partnerName = row.partner_name || row.customer || '';
          const date = row.invoice_date || row.date || '';
          const amount = parseFloat(row.amount_total_signed || row.amount_total || row.total || 0);
          const state = row.status || row.state || '';

          insertStmt.run(companyId, invId, name, partnerName.toString(), date, amount, state, JSON.stringify(row));
          count++;
          if (count % 50 === 0) {
            this._updateProgress(companyId, { inserted: count, phase: 'حفظ الفواتير...' });
          }
        }
        return count;
      });

      const totalInserted = insertMany(invoices);

      db.prepare("UPDATE sales_sync_logs SET status = 'completed', records_synced = ?, completed_at = datetime('now') WHERE id = ?")
        .run(totalInserted, logId);
        
      this._updateProgress(companyId, { status: 'completed', phase: 'اكتملت مزامنة الفواتير بنجاح', inserted: totalInserted });
      return { success: true, records_synced: totalInserted };
      
    } catch(err) {
      if (logId) {
        db.prepare("UPDATE sales_sync_logs SET status = 'failed', error_message = ?, completed_at = datetime('now') WHERE id = ?")
          .run(err.message, logId);
      }
      this._updateProgress(companyId, { status: 'failed', phase: `حدث خطأ: ${err.message}` });
      throw err;
    }
  }

  async syncAll() {
    const db = getDb();
    const companies = db.prepare('SELECT id FROM sales_companies WHERE is_active = 1').all();
    const results = [];
    for (const c of companies) {
      try {
        const res = await this.syncCompany(c.id);
        results.push({ company_id: c.id, status: 'success', ...res });
      } catch (err) {
        results.push({ company_id: c.id, status: 'failed', error: err.message });
      }
    }
    return results;
  }
}

module.exports = SalesSyncEngine;
