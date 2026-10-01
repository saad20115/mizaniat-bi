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
      const connector = new OdooConnector(instance.url, instance.username, instance.api_key, instance.db_name);
      console.log(`[Sync] Fetching journal items for company: ${company.name} (Odoo ID: ${company.odoo_company_id})`);

      this._progress[companyId].phase = 'جاري جلب البيانات من أودو... قد يستغرق عدة دقائق';
      const response = await connector.fetchJournalItems(company.odoo_company_id);

      // Remember an auto-detected database name so later syncs don't need to guess
      if (connector.dbName && !instance.db_name) {
        this.db.prepare('UPDATE odoo_instances SET db_name = ? WHERE id = ?').run(connector.dbName, instance.id);
      }

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

      // Never wipe a company's data because Odoo returned nothing
      const existing = this.db.prepare('SELECT COUNT(*) AS n FROM journal_items WHERE company_id = ?').get(companyId).n;
      if (totalItems === 0 && existing > 0) {
        throw new Error(`أودو أرجع 0 قيود بينما يوجد ${existing} محلياً — أُلغيت المزامنة للحفاظ على البيانات`);
      }
      
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

      const insertAccount = this.db.prepare(`
        INSERT OR IGNORE INTO company_accounts (company_id, code, name, account_type)
        VALUES (?, ?, ?, ?)
      `);

      const accountsSet = new Map();
      let totalInserted = 0;

      // Guarantee releases / sub-items are user data linked to (account_code, move_name).
      // Entry numbers can change between syncs (e.g. synthetic AUTO/ names replaced by
      // real Odoo numbers), so remember each linked entry's fingerprint to re-link it.
      const linkedEntries = this.db.prepare(`
        SELECT ji.account_code, ji.move_name, MIN(ji.date) AS date,
               ROUND(SUM(ji.debit), 2) AS debit, ROUND(SUM(ji.credit), 2) AS credit
        FROM journal_items ji
        WHERE ji.company_id = @cid AND (
          EXISTS (SELECT 1 FROM guarantee_releases gr WHERE gr.company_id = ji.company_id
                  AND gr.account_code = ji.account_code AND gr.move_name = ji.move_name)
          OR EXISTS (SELECT 1 FROM guarantee_sub_items gs WHERE gs.parent_company_id = ji.company_id
                  AND gs.parent_account_code = ji.account_code AND gs.parent_move_name = ji.move_name))
        GROUP BY ji.account_code, ji.move_name
      `).all({ cid: companyId });

      // Replace the company's data in ONE transaction: readers keep seeing the
      // previous complete snapshot until commit, and a failure leaves it intact.
      const replaceAll = this.db.transaction(() => {
        this.db.prepare('DELETE FROM journal_items WHERE company_id = ?').run(companyId);
        this.db.prepare('DELETE FROM company_accounts WHERE company_id = ?').run(companyId);

        for (const item of items) {
          const normalized = this._normalizeItem(item, companyId);
          insertItem.run(normalized);
          totalInserted++;

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

        for (const [, acc] of accountsSet) {
          insertAccount.run(companyId, acc.code, acc.name, acc.type);
        }

        this._generateSyntheticMoveNames(companyId);
        this._relinkGuarantees(companyId, linkedEntries);
      });

      this._progress[companyId].phase = `جاري حفظ ${totalItems} سجل...`;
      replaceAll();
      console.log(`[Sync] ${company.name}: replaced with ${totalInserted} items`);

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
   * Custom-API data has no entry numbers: give each line a deterministic placeholder.
   */
  _generateSyntheticMoveNames(companyId) {
    const emptyMoveItems = this.db.prepare(`
      SELECT id, date, debit, credit FROM journal_items
      WHERE company_id = ? AND (move_name IS NULL OR move_name = '')
      ORDER BY date, debit, credit, id
    `).all(companyId);
    if (emptyMoveItems.length === 0) return;

    const updateMove = this.db.prepare('UPDATE journal_items SET move_name = ? WHERE id = ?');
    const seen = {};
    for (const item of emptyMoveItems) {
      const baseKey = `${item.date}_${item.debit}_${item.credit}`;
      seen[baseKey] = (seen[baseKey] || 0) + 1;
      const seq = seen[baseKey];
      updateMove.run(`AUTO/${item.date}/${item.debit}_${item.credit}${seq > 1 ? '_' + seq : ''}`, item.id);
    }
    console.log(`[Sync] Generated ${emptyMoveItems.length} synthetic move_names for company ${companyId}`);
  }

  /**
   * Re-link guarantee records whose entry number changed, by matching the same
   * account, date and amounts. Records that can't be matched unambiguously are
   * kept (never deleted) and reported.
   */
  _relinkGuarantees(companyId, linkedEntries) {
    const stillExists = this.db.prepare(
      'SELECT 1 FROM journal_items WHERE company_id = ? AND account_code = ? AND move_name = ? LIMIT 1');
    const findCandidates = this.db.prepare(`
      SELECT move_name FROM journal_items
      WHERE company_id = @cid AND account_code = @account_code AND date = @date
      GROUP BY move_name
      HAVING ROUND(SUM(debit), 2) = @debit AND ROUND(SUM(credit), 2) = @credit
    `);
    const updReleases = this.db.prepare(
      'UPDATE guarantee_releases SET move_name = ? WHERE company_id = ? AND account_code = ? AND move_name = ?');
    const updSubItems = this.db.prepare(
      'UPDATE guarantee_sub_items SET parent_move_name = ? WHERE parent_company_id = ? AND parent_account_code = ? AND parent_move_name = ?');

    for (const e of linkedEntries) {
      if (stillExists.get(companyId, e.account_code, e.move_name)) continue;
      const candidates = findCandidates.all({ cid: companyId, ...e });
      if (candidates.length === 1) {
        const newName = candidates[0].move_name;
        updReleases.run(newName, companyId, e.account_code, e.move_name);
        updSubItems.run(newName, companyId, e.account_code, e.move_name);
        console.log(`[Sync] Re-linked guarantee ${e.account_code} ${e.move_name} → ${newName}`);
      } else {
        console.warn(`[Sync] Guarantee ${e.account_code} ${e.move_name} could not be re-linked (${candidates.length} matches) — kept as is`);
      }
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
