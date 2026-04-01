const { getDb } = require('../db/connection');
const OdooConnector = require('./odoo-connector');

class SyncEngine {
  constructor() {
    this.db = getDb();
    this._progress = {}; // track progress per company
  }

  /**
   * Sync journal items for a company in chunks (for large datasets)
   */
  async syncCompany(companyId, onProgress) {
    const company = this.db.prepare('SELECT * FROM companies WHERE id = ?').get(companyId);
    if (!company) throw new Error(`Company ${companyId} not found`);

    const instance = this.db.prepare('SELECT * FROM odoo_instances WHERE id = ?').get(company.odoo_instance_id);
    if (!instance) throw new Error(`Odoo instance not found for company ${companyId}`);

    // Create sync log
    const log = this.db.prepare(`
      INSERT INTO sync_logs (company_id, sync_type, status) VALUES (?, 'full', 'running')
    `).run(companyId);
    const logId = log.lastInsertRowid;

    this._progress[companyId] = { status: 'fetching', fetched: 0, inserted: 0, total: 0, phase: 'جاري جلب البيانات من أودو...' };

    try {
      const connector = new OdooConnector(instance.url, instance.username, instance.api_key);
      console.log(`[Sync] Fetching journal items for company: ${company.name} (Odoo ID: ${company.odoo_company_id})`);

      this._progress[companyId].phase = 'جاري جلب البيانات من أودو... قد يستغرق عدة دقائق';
      const response = await connector.fetchJournalItems(company.odoo_company_id);
      
      // Handle different response formats
      let items = [];
      let dataSource = 'unknown';
      
      if (response && response.source && response.data) {
        // New format from connector: {source: 'rpc'|'custom_api', data: [...]}
        items = Array.isArray(response.data) ? response.data : [];
        dataSource = response.source;
      } else if (Array.isArray(response)) {
        items = response;
        dataSource = 'custom_api';
      } else if (response && response.data && Array.isArray(response.data)) {
        items = response.data;
      } else if (response && response.result && Array.isArray(response.result)) {
        items = response.result;
      } else if (response && typeof response === 'object') {
        for (const key of Object.keys(response)) {
          if (Array.isArray(response[key]) && response[key].length > 0) {
            items = response[key];
            break;
          }
        }
      }

      const totalItems = items.length;
      console.log(`[Sync] Received ${totalItems} journal items for ${company.name} (source: ${dataSource})`);
      
      // Log field names from first item and save raw sample for debugging
      if (items.length > 0) {
        const fields = Object.keys(items[0]);
        console.log(`[Sync] Fields in API response (${fields.length}): ${fields.join(', ')}`);
        
        // Save raw sample to file for inspection
        const fs = require('fs');
        const samplePath = require('path').join(__dirname, '..', '..', `raw_sample_company_${company.odoo_company_id}.json`);
        fs.writeFileSync(samplePath, JSON.stringify(items.slice(0, 3), null, 2), 'utf-8');
        
        // Auto-detect company name from data
        // RPC: company_id = [id, "name"], Custom API: company_id = "name string"
        const firstItem = items[0];
        let companyName = null;
        if (Array.isArray(firstItem.company_id)) {
          companyName = firstItem.company_id[1] || null;
        } else if (typeof firstItem.company_id === 'string' && firstItem.company_id) {
          companyName = firstItem.company_id;
        }
        companyName = companyName || firstItem.company_name || firstItem.company || null;
        
        if (companyName && companyName !== company.name) {
          console.log(`[Sync] Auto-updating company name: "${company.name}" → "${companyName}"`);
          this.db.prepare('UPDATE companies SET name = ? WHERE id = ?').run(companyName, companyId);
        }
      }
      
      // Initialize for normalizer company detection
      this._detectedCompanyName = null;

      // Fetch analytic account names for RPC data (IDs -> names)
      this._analyticMap = {};
      if (dataSource === 'rpc') {
        try {
          this._progress[companyId].phase = 'جاري جلب أسماء الحسابات التحليلية...';
          this._analyticMap = await connector.fetchAnalyticAccounts();
        } catch (e) {
          console.log(`[Sync] Could not fetch analytic accounts: ${e.message}`);
        }
      }
      
      this._journalMappings = {};
      const mappings = this.db.prepare('SELECT original_name, mapped_name FROM journal_name_mappings WHERE company_id = ?').all(companyId);
      for (const m of mappings) {
        this._journalMappings[m.original_name] = m.mapped_name;
      }
      
      this._progress[companyId] = { status: 'processing', fetched: totalItems, inserted: 0, total: totalItems, phase: `تم جلب ${totalItems} سجل. جاري المعالجة...` };

      // Process in chunks of 500
      const CHUNK_SIZE = 500;
      const totalChunks = Math.ceil(totalItems / CHUNK_SIZE);

      // Clear existing data for this company first
      this.db.prepare('DELETE FROM journal_items WHERE company_id = ?').run(companyId);
      this.db.prepare('DELETE FROM company_accounts WHERE company_id = ?').run(companyId);

      const insertItem = this.db.prepare(`
        INSERT INTO journal_items (
          company_id, odoo_line_id, account_code, account_name, account_type,
          partner_name, partner_id, analytic_account, label,
          debit, credit, balance, currency, date,
          journal_name, journal_type, move_name, move_ref, move_state,
          fiscal_year, period
        ) VALUES (
          @company_id, @odoo_line_id, @account_code, @account_name, @account_type,
          @partner_name, @partner_id, @analytic_account, @label,
          @debit, @credit, @balance, @currency, @date,
          @journal_name, @journal_type, @move_name, @move_ref, @move_state,
          @fiscal_year, @period
        )
      `);

      const accountsSet = new Map();
      let totalInserted = 0;

      for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
        const start = chunkIdx * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, totalItems);
        const chunk = items.slice(start, end);

        // Insert chunk in a transaction
        const insertChunk = this.db.transaction(() => {
          for (const item of chunk) {
            const normalized = this._normalizeItem(item, companyId);
            try {
              insertItem.run(normalized);
            } catch (e) {
              // Skip malformed rows silently
              console.warn(`[Sync] Skip row: ${e.message}`);
            }

            // Track unique accounts
            const accKey = normalized.account_code;
            if (accKey && !accountsSet.has(accKey)) {
              accountsSet.set(accKey, {
                code: normalized.account_code,
                name: normalized.account_name || '',
                type: normalized.account_type || ''
              });
            }
          }
        });

        insertChunk();
        totalInserted += chunk.length;

        const pct = Math.round((totalInserted / totalItems) * 100);
        this._progress[companyId] = {
          status: 'processing',
          fetched: totalItems,
          inserted: totalInserted,
          total: totalItems,
          phase: `جاري الإدخال... ${totalInserted}/${totalItems} (${pct}%) — الدفعة ${chunkIdx + 1}/${totalChunks}`
        };

        console.log(`[Sync] ${company.name}: chunk ${chunkIdx + 1}/${totalChunks} (${totalInserted}/${totalItems})`);
      }

      // Insert discovered accounts
      const insertAccount = this.db.prepare(`
        INSERT OR IGNORE INTO company_accounts (company_id, code, name, account_type)
        VALUES (?, ?, ?, ?)
      `);
      const insertAccTx = this.db.transaction(() => {
        for (const [, acc] of accountsSet) {
          insertAccount.run(companyId, acc.code, acc.name, acc.type);
        }
      });
      insertAccTx();

      // Update sync log
      this.db.prepare(`
        UPDATE sync_logs SET status = 'completed', records_synced = ?, completed_at = datetime('now')
        WHERE id = ?
      `).run(totalInserted, logId);

      this._progress[companyId] = {
        status: 'completed',
        fetched: totalItems,
        inserted: totalInserted,
        total: totalItems,
        phase: `اكتمل! تم إدخال ${totalInserted} سجل و ${accountsSet.size} حساب`
      };

      console.log(`[Sync] Completed sync for ${company.name}: ${totalInserted} items, ${accountsSet.size} accounts`);
      return { success: true, count: totalInserted, accounts: accountsSet.size };

    } catch (err) {
      this.db.prepare(`
        UPDATE sync_logs SET status = 'failed', error_message = ?, completed_at = datetime('now')
        WHERE id = ?
      `).run(err.message, logId);

      this._progress[companyId] = {
        status: 'failed',
        phase: `فشل: ${err.message}`
      };

      console.error(`[Sync] Failed for ${company.name}: ${err.message}`);
      throw err;
    }
  }

  /**
   * Get import progress for a company
   */
  getProgress(companyId) {
    return this._progress[companyId] || { status: 'idle', phase: '' };
  }

  /**
   * Sync all active companies concurrently (parallel across servers)
   */
  async syncAll() {
    const companies = this.db.prepare('SELECT * FROM companies WHERE is_active = 1').all();

    console.log(`[Sync] Starting concurrent sync for ${companies.length} companies...`);

    // Run all company syncs in parallel
    const settled = await Promise.allSettled(
      companies.map(company =>
        this.syncCompany(company.id)
          .then(result => ({ company: company.name, ...result }))
          .catch(err => ({ company: company.name, success: false, error: err.message }))
      )
    );

    const results = settled.map(s => s.status === 'fulfilled' ? s.value : { success: false, error: s.reason?.message || 'Unknown error' });
    console.log(`[Sync] Concurrent sync completed for ${results.length} companies`);
    return results;
  }

  /**
   * Normalize an Odoo journal item to our schema
   * 
   * Handles TWO source formats:
   * 1) RPC (search_read): account_id=[id,"code name"], journal_id=[id,"name"], 
   *    move_id=[id,"name"], partner_id=[id,"name"] or false, name, ref, balance, etc.
   * 2) Custom API: account_id="code name", partner_id="name string", company_id="name string"
   */
  _normalizeItem(item, companyId) {
    const date = item.date || '';
    const year = date ? date.substring(0, 4) : '';
    const month = date ? date.substring(5, 7) : '';

    // Helper: extract name from [id, name] array or return string as-is
    const extractName = (val) => {
      if (!val || val === false) return '';
      if (Array.isArray(val)) return val[1] || '';
      return String(val);
    };

    // --- Account ---
    let accountCode = '';
    let accountName = '';
    const rawAccount = extractName(item.account_id);
    if (rawAccount) {
      const match = rawAccount.match(/^(\d+)\s+(.+)$/);
      if (match) {
        accountCode = match[1];
        accountName = match[2];
      } else {
        accountName = rawAccount;
      }
    }

    // --- Partner ---
    const partnerName = extractName(item.partner_id) || item.partner_name || '';

    // --- Journal ---
    let journalName = String(extractName(item.journal_id) || item.journal_name || item.journal || '').trim();
    // Remove unicode replacement characters if any garbled text happened
    journalName = journalName.replace(/\uFFFD/g, '');
    
    // Apply manual mappings if any
    if (this._journalMappings && this._journalMappings[journalName]) {
      journalName = this._journalMappings[journalName];
    }


    // --- Move (entry number) ---
    const moveName = item.move_name || extractName(item.move_id) || item.move || '';

    // --- Reference ---
    const moveRef = item.ref || item.move_ref || '';

    // --- Label/Description ---
    const label = item.name || item.label || '';

    // --- Analytic ---
    let analyticAccount = '';
    if (item.analytic && item.analytic !== '' && item.analytic !== 'False' && item.analytic !== false) {
      analyticAccount = String(item.analytic);
    }
    // analytic_distribution from RPC is an object {id: percentage}, from custom API is a string
    if (!analyticAccount && item.analytic_distribution && 
        item.analytic_distribution !== 'False' && item.analytic_distribution !== false) {
      if (typeof item.analytic_distribution === 'object') {
        // RPC format: {analytic_account_id: percentage} — resolve IDs to names
        const ids = Object.keys(item.analytic_distribution);
        const names = ids.map(id => {
          if (this._analyticMap && this._analyticMap[id]) return this._analyticMap[id];
          return id; // fallback to ID if name not found
        });
        analyticAccount = names.join(', ');
      } else {
        analyticAccount = String(item.analytic_distribution).trim().replace(/\uFFFD/g, '');
      }
    }
    
    if (analyticAccount) {
      analyticAccount = analyticAccount.trim().replace(/\uFFFD/g, '');
    }

    // --- Company name (for auto-detection) ---
    // Store company name from data for auto-update
    if (!this._detectedCompanyName && item.company_id) {
      if (Array.isArray(item.company_id)) {
        this._detectedCompanyName = item.company_id[1];
      } else if (typeof item.company_id === 'string') {
        this._detectedCompanyName = item.company_id;
      }
    }

    const debit = parseFloat(item.debit) || 0;
    const credit = parseFloat(item.credit) || 0;

    return {
      company_id: companyId,
      odoo_line_id: (typeof item.id === 'number') ? item.id : null,
      account_code: accountCode,
      account_name: accountName,
      account_type: item.account_type || '',
      partner_name: partnerName,
      partner_id: null,
      analytic_account: analyticAccount,
      label: label,
      debit: debit,
      credit: credit,
      balance: (item.balance !== undefined ? parseFloat(item.balance) : 0) || (debit - credit),
      currency: item.currency || 'SAR',
      date: date,
      journal_name: journalName,
      journal_type: item.journal_type || '',
      move_name: moveName,
      move_ref: moveRef,
      move_state: item.parent_state || item.move_state || item.state || 'posted',
      fiscal_year: year,
      period: month ? `${year}-${month}` : year
    };
  }

  /**
   * Get sync status for all companies
   */
  getSyncStatus() {
    return this.db.prepare(`
      SELECT 
        sl.*,
        c.name as company_name
      FROM sync_logs sl
      LEFT JOIN companies c ON c.id = sl.company_id
      ORDER BY sl.started_at DESC
      LIMIT 50
    `).all();
  }
}

module.exports = SyncEngine;
