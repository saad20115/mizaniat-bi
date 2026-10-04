const https = require('https');
const http = require('http');

class OdooConnector {
  constructor(url, username, apiKey, dbName) {
    this.baseUrl = this._extractBaseUrl(url);
    this.username = username;
    this.apiKey = apiKey;
    this.dbName = dbName || null;
    this.uid = null;
    this.authHeader = 'Basic ' + Buffer.from(`${username}:${apiKey}`).toString('base64');
    console.log(`[OdooConnector] Base URL: ${this.baseUrl}, User: ${username}, DB: ${this.dbName || '(auto)'}`);
  }

  _extractBaseUrl(input) {
    let url = input.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
    try {
      const parsed = new URL(url);
      return parsed.origin;
    } catch (e) {
      return url.replace(/\/api\/.*$/, '').replace(/\/+$/, '');
    }
  }

  /**
   * Call Odoo's standard external JSON-RPC endpoint (/jsonrpc).
   * Stateless (no session cookie) and accepts either a password or an API key.
   */
  async _jsonRpc(service, method, args, timeoutMs = 120000) {
    const result = await this._httpPost(`${this.baseUrl}/jsonrpc`, {
      jsonrpc: '2.0',
      method: 'call',
      id: Date.now(),
      params: { service, method, args }
    }, {}, timeoutMs);

    const data = JSON.parse(result.body);
    if (data.error) {
      throw new Error(data.error.data?.message || data.error.message || 'RPC Error');
    }
    return data.result;
  }

  /**
   * Resolve the database name: use the configured one, otherwise ask the
   * server (works only when the server allows listing databases).
   */
  async _resolveDb() {
    if (this.dbName) return this.dbName;
    let dbs;
    try {
      dbs = await this._jsonRpc('db', 'list', []);
    } catch (e) {
      throw new Error('اسم قاعدة بيانات أودو مطلوب — الخادم لا يسمح بعرض قواعد البيانات');
    }
    if (!Array.isArray(dbs) || dbs.length !== 1) {
      throw new Error(`اسم قاعدة بيانات أودو مطلوب — الخادم يحتوي على ${Array.isArray(dbs) ? dbs.length : 0} قاعدة`);
    }
    this.dbName = dbs[0];
    return this.dbName;
  }

  async _authenticate() {
    if (this.uid) return this.uid;
    const db = await this._resolveDb();
    const uid = await this._jsonRpc('common', 'authenticate', [db, this.username, this.apiKey, {}]);
    if (!uid) throw new Error('فشل تسجيل الدخول إلى أودو — تأكد من اسم المستخدم وكلمة المرور');
    this.uid = uid;
    console.log(`[OdooConnector] Authenticated on ${this.baseUrl} (db=${db}, uid=${uid})`);
    return uid;
  }

  /**
   * Call a model method via execute_kw
   */
  async _rpcCall(model, method, args, kwargs = {}) {
    const uid = await this._authenticate();
    return this._jsonRpc('object', 'execute_kw',
      [this.dbName, uid, this.apiKey, model, method, args, kwargs],
      300000  // 5 min timeout for RPC calls
    );
  }

  /**
   * Fetch ALL journal items for a company using Odoo RPC (search_read)
   * This gets the full data including name, journal, move, ref
   */
  async fetchJournalItemsRPC(companyId) {
    const FIELDS = [
      'name',           // البيان
      'account_id',     // الحساب [id, name]
      'partner_id',     // الشريك [id, name]
      'journal_id',     // اليومية [id, name]
      'move_id',        // القيد [id, name]
      'move_name',      // رقم القيد
      'ref',            // المرجع
      'debit',          // مدين
      'credit',         // دائن
      'balance',        // الرصيد
      'amount_residual',// المتبقي غير المطابق
      'date',           // التاريخ
      'analytic_distribution', // توزيع تحليلي
      'company_id',     // الشركة [id, name]
      'account_type',   // نوع الحساب (v17)
      'parent_state',   // حالة القيد (draft/posted/cancel)
    ];

    const PAGE_SIZE = 500;
    let offset = 0;
    let allItems = [];
    
    console.log(`[OdooConnector] Fetching via RPC: account.move.line (company_id=${companyId})`);

    while (true) {
      const records = await this._rpcCall(
        'account.move.line',
        'search_read',
        [[
          ['company_id', '=', companyId],
          ['parent_state', '=', 'posted'],
          ['display_type', 'not in', ['line_section', 'line_note']]
        ]],
        {
          fields: FIELDS,
          limit: PAGE_SIZE,
          offset: offset,
          order: 'id'  // stable ordering so pages don't shift while paginating
        }
      );

      if (!records || records.length === 0) break;
      
      allItems = allItems.concat(records);
      console.log(`[OdooConnector] RPC fetched ${allItems.length} records...`);
      
      if (records.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    console.log(`[OdooConnector] RPC total: ${allItems.length} records for company ${companyId}`);
    return allItems;
  }

  /**
   * Fetch all analytic account names to resolve IDs from analytic_distribution
   */
  async fetchAnalyticAccounts() {
    try {
      const records = await this._rpcCall(
        'account.analytic.account',
        'search_read',
        [[]],
        {
          fields: ['id', 'name', 'code'],
          limit: 5000
        }
      );
      
      // Build ID -> name map
      const map = {};
      for (const r of (records || [])) {
        map[String(r.id)] = r.code ? `${r.code} ${r.name}` : r.name;
      }
      console.log(`[OdooConnector] Fetched ${Object.keys(map).length} analytic accounts`);
      return map;
    } catch (err) {
      console.log(`[OdooConnector] Failed to fetch analytic accounts: ${err.message}`);
      return {};
    }
  }

  /**
   * Fetch journal items — tries RPC first, falls back to custom API
   */
  async fetchJournalItems(companyId) {
    // No fallback to the custom API endpoint: it carries no entry state, so drafts
    // and cancelled entries would slip into reports. If RPC fails, the sync fails
    // and the previously synced data stays in place.
    const rpcData = await this.fetchJournalItemsRPC(companyId);
    return { source: 'rpc', data: rpcData || [] };
  }

  async _request(endpoint, retries = 3) {
    const fullUrl = `${this.baseUrl}${endpoint}`;
    console.log(`[OdooConnector] Request: ${fullUrl}`);
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const data = await this._httpGet(fullUrl);
        return JSON.parse(data);
      } catch (err) {
        console.error(`[OdooConnector] Attempt ${attempt}/${retries} failed: ${err.message}`);
        if (attempt === retries) throw err;
        await this._delay(attempt * 2000);
      }
    }
  }

  _httpGet(url) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const req = protocol.get(url, {
        headers: {
          'Authorization': this.authHeader,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        timeout: 300000
      }, (res) => {
        if (res.statusCode === 401) return reject(new Error('فشل المصادقة'));
        if (res.statusCode === 403) return reject(new Error('ممنوع الوصول (403)'));
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        // Collect raw bytes: decoding each chunk separately corrupts Arabic
        // characters that straddle chunk boundaries (U+FFFD in names).
        const chunks = [];
        res.on('data', chunk => { chunks.push(chunk); });
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        res.on('error', reject);
      });
      req.on('timeout', () => { req.destroy(); reject(new Error('انتهت المهلة')); });
      req.on('error', (err) => {
        if (err.code === 'ENOTFOUND') reject(new Error(`لم يتم العثور على الخادم`));
        else if (err.code === 'ECONNREFUSED') reject(new Error('الخادم رفض الاتصال'));
        else reject(err);
      });
    });
  }

  _httpPost(url, body, extraHeaders = {}, timeoutMs = 120000) {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const postData = JSON.stringify(body);
      const urlObj = new URL(url);
      let settled = false;
      
      const done = (fn, val) => { if (!settled) { settled = true; fn(val); } };

      // Hard deadline: ensures we never hang longer than timeoutMs
      const hardTimer = setTimeout(() => {
        req.destroy();
        done(reject, new Error(`Hard timeout: request took longer than ${timeoutMs/1000}s`));
      }, timeoutMs + 5000); // small grace period over socket timeout
      
      const req = protocol.request({
        hostname: urlObj.hostname,
        port: urlObj.port || (url.startsWith('https') ? 443 : 80),
        path: urlObj.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          ...extraHeaders
        },
        timeout: timeoutMs
      }, (res) => {
        const chunks = [];
        const cookies = res.headers['set-cookie'] || [];
        res.on('data', chunk => { chunks.push(chunk); });
        res.on('end', () => {
          clearTimeout(hardTimer);
          done(resolve, { body: Buffer.concat(chunks).toString('utf8'), cookies, status: res.statusCode });
        });
        res.on('error', (err) => { clearTimeout(hardTimer); req.destroy(); done(reject, err); });
      });
      
      req.on('timeout', () => { clearTimeout(hardTimer); req.destroy(); done(reject, new Error(`Socket timeout (${timeoutMs/1000}s)`)); });
      req.on('error', (err) => { clearTimeout(hardTimer); req.destroy(); done(reject, err); });
      req.write(postData);
      req.end();
    });
  }

  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Fetch customer invoices and credit notes for a company via standard JSON-RPC
   * move_type in ['out_invoice', 'out_refund'] and state = 'posted'
   */
  async fetchSalesMoves(companyId) {
    return this._rpcCall(
      'account.move',
      'search_read',
      [[
        ['move_type', 'in', ['out_invoice', 'out_refund']],
        ['state', '=', 'posted'],
        ['company_id', '=', parseInt(companyId)]
      ]],
      {
        fields: [
          'name',
          'partner_id',
          'invoice_date',
          'invoice_date_due',
          'amount_total_signed',
          'amount_untaxed_signed',
          'amount_residual_signed',
          'state',
          'payment_state',
          'ref',
          'move_type',
          'journal_id',
          'company_id'
        ],
        limit: 100000,
        order: 'id'
      }
    );
  }

  async testConnection(companyId = 1) {
    try {
      const result = await this.fetchJournalItems(companyId);
      const items = result.data || result;
      const count = Array.isArray(items) ? items.length : '?';
      const source = result.source || 'unknown';
      return { success: true, message: `الاتصال ناجح عبر ${source === 'rpc' ? 'Odoo RPC' : 'Custom API'}! تم العثور على ${count} سجل` };
    } catch (err) {
      return { success: false, message: err.message };
    }
  }
}

module.exports = OdooConnector;
