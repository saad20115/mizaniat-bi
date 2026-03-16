const https = require('https');
const http = require('http');

class OdooConnector {
  constructor(url, username, apiKey) {
    this.baseUrl = this._extractBaseUrl(url);
    this.username = username;
    this.apiKey = apiKey;
    this.authHeader = 'Basic ' + Buffer.from(`${username}:${apiKey}`).toString('base64');
    this.sessionCookie = null;
    console.log(`[OdooConnector] Base URL: ${this.baseUrl}, User: ${username}`);
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
   * Authenticate via Odoo web session to get RPC access
   */
  async _webLogin() {
    if (this.sessionCookie) return this.sessionCookie;
    
    console.log(`[OdooConnector] Authenticating via web session...`);
    const body = {
      jsonrpc: '2.0',
      method: 'call',
      id: 1,
      params: {
        db: '', // will be auto-detected
        login: this.username,
        password: this.apiKey
      }
    };

    const result = await this._httpPost(`${this.baseUrl}/web/session/authenticate`, body);
    
    if (result.cookies && result.cookies.length > 0) {
      const sessionCookie = result.cookies
        .map(c => c.split(';')[0])
        .filter(c => c.includes('session_id'))
        .join('; ');
      
      if (sessionCookie) {
        this.sessionCookie = sessionCookie;
        console.log(`[OdooConnector] Web session authenticated successfully`);
        return this.sessionCookie;
      }
    }

    // Check if there's a db selector needed
    const data = JSON.parse(result.body);
    if (data.error) {
      console.log(`[OdooConnector] Web auth error:`, data.error.message || data.error.data?.message);
    }
    throw new Error('فشل تسجيل الدخول عبر الجلسة — تأكد من البيانات');
  }

  /**
   * Call Odoo RPC endpoint
   */
  async _rpcCall(model, method, args, kwargs = {}) {
    const cookie = await this._webLogin();
    
    const body = {
      jsonrpc: '2.0',
      method: 'call',
      id: Date.now(),
      params: {
        model: model,
        method: method,
        args: args,
        kwargs: kwargs
      }
    };

    const result = await this._httpPost(
      `${this.baseUrl}/web/dataset/call_kw/${model}/${method}`,
      body,
      { 'Cookie': cookie },
      300000  // 5 min timeout for RPC calls
    );
    
    const data = JSON.parse(result.body);
    if (data.error) {
      throw new Error(data.error.message || data.error.data?.message || 'RPC Error');
    }
    return data.result;
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
        [[['company_id', '=', companyId], ['display_type', 'not in', ['line_section', 'line_note']]]],
        {
          fields: FIELDS,
          limit: PAGE_SIZE,
          offset: offset,
          order: 'date desc, id desc'
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
    // Try RPC first for full data
    try {
      const rpcData = await this.fetchJournalItemsRPC(companyId);
      if (rpcData && rpcData.length > 0) {
        return { source: 'rpc', data: rpcData };
      }
    } catch (err) {
      console.log(`[OdooConnector] RPC failed, falling back to custom API: ${err.message}`);
    }

    // Fallback: custom API endpoint
    const endpoint = `/api/custom_journal_items_all?company_id=${companyId}`;
    const result = await this._request(endpoint);
    return { source: 'custom_api', data: Array.isArray(result) ? result : (result.data || result.result || result) };
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
        let data = '';
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => resolve(data));
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
        let data = '';
        const cookies = res.headers['set-cookie'] || [];
        res.on('data', chunk => { data += chunk; });
        res.on('end', () => { clearTimeout(hardTimer); done(resolve, { body: data, cookies, status: res.statusCode }); });
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
