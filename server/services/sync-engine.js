const { getDb } = require('../db/connection');
const OdooConnector = require('./odoo-connector');

class SyncEngine {
  constructor() {
    this.db = getDb();
    this._progress = {}; // track progress per company
    this._instanceAnalyticCache = new Map();
  }

  /**
   * Fetch and persist analytic accounts scoped per Odoo instance
   */
  async getOrFetchAnalyticAccounts(instance, connector) {
    if (this._instanceAnalyticCache.has(instance.id)) {
      return this._instanceAnalyticCache.get(instance.id);
    }

    const prevCount = this.db.prepare(
      'SELECT COUNT(*) as cnt FROM odoo_analytic_accounts WHERE instance_id = ?'
    ).get(instance.id)?.cnt || 0;

    let analyticData;
    try {
      analyticData = await connector.fetchAnalyticAccounts();
    } catch (err) {
      if (prevCount > 0) {
        throw new Error(`فشل جلب الحسابات التحليلية للخادم ${instance.id} (يوجد ${prevCount} حساب مسجل سابقاً): ${err.message}`);
      }
      throw err;
    }

    const records = analyticData?.records || [];
    if (records.length === 0 && prevCount > 0) {
      throw new Error(`أودو أرجع 0 حساب تحليلي للخادم ${instance.id} بينما يوجد ${prevCount} حساب سابقاً — أُلغيت المزامنة منعاً لسقوط مراكز التكلفة`);
    }

    const map = {};
    for (const r of records) {
      map[r.id] = (r.name || '').trim();
    }

    const insAnalytic = this.db.prepare(`
      INSERT INTO odoo_analytic_accounts (instance_id, odoo_id, name, code, plan_id, company_id, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(instance_id, odoo_id) DO UPDATE SET
        name = excluded.name,
        code = excluded.code,
        plan_id = excluded.plan_id,
        company_id = excluded.company_id,
        is_active = excluded.is_active
    `);

    const saveTx = this.db.transaction(() => {
      for (const r of records) {
        const planId = Array.isArray(r.plan_id) ? r.plan_id[0] : (r.plan_id || null);
        const compId = Array.isArray(r.company_id) ? r.company_id[0] : (r.company_id || null);
        insAnalytic.run(
          instance.id,
          r.id,
          (r.name || '').trim(),
          r.code ? String(r.code).trim() : null,
          planId,
          compId,
          r.is_active !== undefined ? r.is_active : 1
        );
      }
    });
    saveTx();
    console.log(`[Sync] Synced ${records.length} analytic accounts for instance ${instance.id}`);

    const res = { map, records };
    this._instanceAnalyticCache.set(instance.id, res);
    return res;
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

      // Fetch analytic account names for RPC data (IDs -> names) strictly scoped per instance
      let companyAnalyticMap = {};
      if (dataSource === 'rpc') {
        this._progress[companyId].phase = 'جاري جلب أسماء الحسابات التحليلية...';
        const analyticRes = await this.getOrFetchAnalyticAccounts(instance, connector);
        companyAnalyticMap = analyticRes.map || {};

        // Fetch and save taxes
        try {
          this._progress[companyId].phase = 'جاري جلب الضرائب...';
          const taxes = await connector.fetchTaxesRPC(company.odoo_company_id);
          const insTax = this.db.prepare(`
            INSERT INTO odoo_taxes (instance_id, tax_id, company_odoo_id, name, amount, type_tax_use)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(instance_id, tax_id) DO UPDATE SET
              name = excluded.name,
              amount = excluded.amount,
              type_tax_use = excluded.type_tax_use,
              company_odoo_id = excluded.company_odoo_id
          `);
          for (const t of (taxes || [])) {
            const coId = Array.isArray(t.company_id) ? t.company_id[0] : (t.company_id || company.odoo_company_id);
            insTax.run(instance.id, t.id, coId, t.name || '', typeof t.amount === 'number' ? t.amount : 0, t.type_tax_use || '');
          }
          console.log(`[Sync] Synced ${taxes.length} taxes for instance ${instance.id}`);
        } catch (e) {
          console.log(`[Sync] Could not sync taxes: ${e.message}`);
        }
      }
      
      const companyJournalMappings = {};
      const mappings = this.db.prepare('SELECT original_name, mapped_name FROM journal_name_mappings WHERE company_id = ?').all(companyId);
      for (const m of mappings) {
        companyJournalMappings[m.original_name] = m.mapped_name;
      }

      const companyContext = {
        companyId,
        instanceId: instance.id,
        analyticMap: companyAnalyticMap,
        journalMappings: companyJournalMappings,
        detectedCompanyName: null
      };
      
      this._progress[companyId] = { status: 'processing', fetched: totalItems, inserted: 0, total: totalItems, phase: `تم جلب ${totalItems} سجل. جاري المعالجة...` };

      const insertItem = this.db.prepare(`
        INSERT INTO journal_items (
          company_id, odoo_line_id, account_code, account_name, account_type,
          partner_name, partner_id, analytic_account, cost_center_id, label,
          debit, credit, balance, amount_residual, currency, date,
          journal_id, journal_name, journal_type, move_name, move_ref, move_state,
          fiscal_year, period,
          tax_id, tax_name, tax_base_amount, tax_ids, move_type
        ) VALUES (
          @company_id, @odoo_line_id, @account_code, @account_name, @account_type,
          @partner_name, @partner_id, @analytic_account, @cost_center_id, @label,
          @debit, @credit, @balance, @amount_residual, @currency, @date,
          @journal_id, @journal_name, @journal_type, @move_name, @move_ref, @move_state,
          @fiscal_year, @period,
          @tax_id, @tax_name, @tax_base_amount, @tax_ids, @move_type
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
          const normalized = this._normalizeItem(item, companyContext);
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
        this.rebuildFactDaily(companyId);
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
      ORDER BY move_name ASC
    `);
    const updReleases = this.db.prepare(
      'UPDATE guarantee_releases SET move_name = ? WHERE company_id = ? AND account_code = ? AND move_name = ?');
    const updSubItems = this.db.prepare(
      'UPDATE guarantee_sub_items SET parent_move_name = ? WHERE parent_company_id = ? AND parent_account_code = ? AND parent_move_name = ?');

    const usedCandidates = new Set();
    const existingLinked = this.db.prepare(`
      SELECT move_name FROM guarantee_releases WHERE company_id = ?
      UNION
      SELECT parent_move_name FROM guarantee_sub_items WHERE parent_company_id = ?
    `).all(companyId, companyId).map(r => r.move_name);
    for (const m of existingLinked) {
      if (m && !m.startsWith('AUTO/')) usedCandidates.add(m);
    }

    // Group unlinked entries by fingerprint
    const unlinkedByFp = new Map();
    for (const e of linkedEntries) {
      if (stillExists.get(companyId, e.account_code, e.move_name)) continue;
      const fp = `${e.account_code}|${e.date}|${e.debit}|${e.credit}`;
      if (!unlinkedByFp.has(fp)) unlinkedByFp.set(fp, []);
      unlinkedByFp.get(fp).push(e);
    }

    for (const [, entries] of unlinkedByFp) {
      const e0 = entries[0];
      const allCandidates = findCandidates.all({ cid: companyId, ...e0 });
      const available = allCandidates.filter(c => !usedCandidates.has(c.move_name));

      if (available.length === 1 && entries.length === 1) {
        const newName = available[0].move_name;
        usedCandidates.add(newName);
        updReleases.run(newName, companyId, e0.account_code, e0.move_name);
        updSubItems.run(newName, companyId, e0.account_code, e0.move_name);
        console.log(`[Sync] Re-linked guarantee ${e0.account_code} ${e0.move_name} → ${newName}`);
      } else if (available.length >= entries.length) {
        for (let i = 0; i < entries.length; i++) {
          const entry = entries[i];
          const newName = available[i].move_name;
          usedCandidates.add(newName);
          updReleases.run(newName, companyId, entry.account_code, entry.move_name);
          updSubItems.run(newName, companyId, entry.account_code, entry.move_name);
          console.log(`[Sync] Re-linked guarantee ${entry.account_code} ${entry.move_name} → ${newName} (multi-match ${i+1}/${entries.length})`);
        }
      } else {
        for (const entry of entries) {
          console.warn(`[Sync] Guarantee ${entry.account_code} ${entry.move_name} could not be re-linked (${available.length} available candidates for ${entries.length} entries) — kept as is`);
        }
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
  _normalizeItem(item, contextOrCompanyId) {
    const isContext = typeof contextOrCompanyId === 'object' && contextOrCompanyId !== null;
    const companyId = isContext ? contextOrCompanyId.companyId : contextOrCompanyId;
    const analyticMap = isContext ? contextOrCompanyId.analyticMap : (this._analyticMap || {});
    const journalMappings = isContext ? contextOrCompanyId.journalMappings : (this._journalMappings || {});

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
    const journalId = Array.isArray(item.journal_id) ? item.journal_id[0] : (typeof item.journal_id === 'number' ? item.journal_id : (parseInt(item.journal_id) || null));
    let journalName = String(extractName(item.journal_id) || item.journal_name || item.journal || '').trim();
    // Remove unicode replacement characters if any garbled text happened
    journalName = journalName.replace(/\uFFFD/g, '');
    
    // Apply manual mappings if any
    if (journalMappings && journalMappings[journalName]) {
      journalName = journalMappings[journalName];
    }


    // --- Move (entry number) ---
    const moveName = item.move_name || extractName(item.move_id) || item.move || '';

    // --- Reference ---
    const moveRef = item.ref || item.move_ref || '';

    // --- Label/Description ---
    const label = item.name || item.label || '';

    // --- Analytic ---
    let analyticAccount = '';
    let costCenterId = null;
    if (item.analytic && item.analytic !== '' && item.analytic !== 'False' && item.analytic !== false) {
      analyticAccount = String(item.analytic);
    }
    // analytic_distribution from RPC is an object {id: percentage}, from custom API is a string
    if (!analyticAccount && item.analytic_distribution && 
        item.analytic_distribution !== 'False' && item.analytic_distribution !== false) {
      if (typeof item.analytic_distribution === 'object') {
        // RPC format: {analytic_account_id: percentage} — resolve IDs to names
        const ids = Object.keys(item.analytic_distribution);
        const validId = ids.find(id => analyticMap && analyticMap[id] !== undefined);
        costCenterId = validId ? (parseInt(validId, 10) || null) : null;
        const names = ids.map(id => {
          if (analyticMap && analyticMap[id]) return analyticMap[id];
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

    // --- Tax fields (D5) ---
    let taxId = null;
    let taxName = '';
    if (item.tax_line_id) {
      if (Array.isArray(item.tax_line_id)) {
        taxId = item.tax_line_id[0];
        taxName = item.tax_line_id[1] || '';
      } else if (typeof item.tax_line_id === 'number') {
        taxId = item.tax_line_id;
      }
    }
    const taxBaseAmount = (item.tax_base_amount !== undefined && item.tax_base_amount !== null) ? parseFloat(item.tax_base_amount) || 0 : 0;
    let taxIds = null;
    if (item.tax_ids && item.tax_ids !== false) {
      taxIds = Array.isArray(item.tax_ids) ? JSON.stringify(item.tax_ids) : String(item.tax_ids);
    }
    const moveType = item.move_type ? String(item.move_type) : null;

    return {
      company_id: companyId,
      odoo_line_id: (typeof item.id === 'number') ? item.id : null,
      account_code: accountCode,
      account_name: accountName,
      account_type: item.account_type || '',
      partner_name: partnerName,
      partner_id: null,
      analytic_account: analyticAccount,
      cost_center_id: costCenterId,
      label: label,
      debit: debit,
      credit: credit,
      balance: (item.balance !== undefined ? parseFloat(item.balance) : 0) || (debit - credit),
      amount_residual: parseFloat(item.amount_residual) || 0,
      currency: item.currency || 'SAR',
      date: date,
      journal_id: journalId,
      journal_name: journalName,
      journal_type: item.journal_type || '',
      move_name: moveName,
      move_ref: moveRef,
      move_state: item.parent_state || item.move_state || item.state || 'posted',
      fiscal_year: year,
      period: month ? `${year}-${month}` : year,
      tax_id: taxId,
      tax_name: taxName,
      tax_base_amount: taxBaseAmount,
      tax_ids: taxIds,
      move_type: moveType
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

  /**
   * Rebuild fact_daily table for a given company (or all companies).
   * Aggregates posted journal_items by date, account, section, department, and analytic account.
   */
  rebuildFactDaily(companyId) {
    const ConsolidationEngine = require('./consolidation');
    const engine = new ConsolidationEngine(this.db);

    const companies = companyId ? [companyId] : this.db.prepare('SELECT id FROM companies').all().map(c => c.id);

    this.db.exec(`
      CREATE TEMP TABLE IF NOT EXISTS _temp_fact_income (
        move_name TEXT PRIMARY KEY
      );
      CREATE TEMP TABLE IF NOT EXISTS _temp_fact_cash (
        move_name TEXT PRIMARY KEY
      );
    `);

    for (const cid of companies) {
      this.db.prepare('DELETE FROM fact_daily WHERE company_id = ?').run(cid);
      this.db.exec(`
        DELETE FROM _temp_fact_income;
        DELETE FROM _temp_fact_cash;
      `);

      this.db.prepare(`
        INSERT OR IGNORE INTO _temp_fact_income (move_name)
        SELECT DISTINCT ji.move_name
        FROM journal_items ji
        ${engine._sectionJoin('ji', 'o')}
        WHERE ji.company_id = ?
          AND ji.move_state = 'posted'
          AND ${engine._sectionExpr('ji', 'o')} = 'income'
      `).run(cid);

      this.db.prepare(`
        INSERT OR IGNORE INTO _temp_fact_cash (move_name)
        SELECT DISTINCT ji.move_name
        FROM journal_items ji
        WHERE ji.company_id = ?
          AND ji.move_state = 'posted'
          AND ${engine._cashFilter('ji')}
      `).run(cid);

      this.db.prepare(`
        INSERT INTO fact_daily (
          company_id,
          date,
          year,
          quarter,
          month,
          week_start,
          account_code,
          section,
          department_id,
          analytic_account,
          journal_name,
          journal_id,
          cost_center_key,
          cost_center_name,
          debit,
          credit,
          revenue,
          expense,
          billed,
          collected
        )
        SELECT
          ji.company_id,
          ji.date,
          strftime('%Y', ji.date) as year,
          strftime('%Y', ji.date) || '-Q' || ((CAST(strftime('%m', ji.date) AS INTEGER) + 2) / 3) as quarter,
          strftime('%Y-%m', ji.date) as month,
          date(ji.date, '-' || strftime('%w', ji.date) || ' days') as week_start,
          ji.account_code,
          ${engine._sectionExpr('ji', 'o')} as section,
          COALESCE(
            (SELECT m1.group_id 
             FROM analytic_group_mapping m1 
             WHERE m1.company_id = ji.company_id 
               AND (
                 (ji.analytic_account IS NOT NULL AND ji.analytic_account != '' AND (m1.analytic_account = ji.analytic_account OR REPLACE(m1.analytic_account, '  ', ' ') = REPLACE(ji.analytic_account, '  ', ' ')))
                 OR
                 (ji.cost_center_id IS NOT NULL AND ji.cost_center_id > 0 AND EXISTS (
                   SELECT 1 FROM companies c 
                   JOIN odoo_analytic_accounts oa ON oa.instance_id = c.odoo_instance_id AND oa.odoo_id = ji.cost_center_id
                   WHERE c.id = ji.company_id AND (oa.name = m1.analytic_account OR REPLACE(oa.name, '  ', ' ') = REPLACE(m1.analytic_account, '  ', ' '))
                 ))
               )
             ORDER BY m1.id ASC
             LIMIT 1),
            (SELECT m0.group_id 
             FROM analytic_group_mapping m0 
             WHERE m0.company_id = ji.company_id 
               AND m0.journal_id = ji.journal_id 
               AND ji.journal_id IS NOT NULL 
               AND ji.journal_id > 0 
             ORDER BY m0.id ASC
             LIMIT 1),
            (SELECT m2.group_id 
             FROM analytic_group_mapping m2 
             WHERE m2.company_id = ji.company_id 
               AND m2.journal_name = ji.journal_name 
               AND ji.journal_name IS NOT NULL 
               AND ji.journal_name != '' 
             ORDER BY m2.id ASC
             LIMIT 1),
            0
          ) as department_id,
          COALESCE(ji.analytic_account, '') as analytic_account,
          COALESCE(ji.journal_name, '') as journal_name,
          COALESCE(ji.journal_id, 0) as journal_id,
          COALESCE(
            CASE 
              WHEN ji.cost_center_id IS NOT NULL AND ji.cost_center_id > 0
              THEN 'an:' || (SELECT odoo_instance_id FROM companies WHERE id = ji.company_id) || ':' || ji.cost_center_id
              WHEN ji.analytic_account IS NOT NULL AND TRIM(ji.analytic_account) != '' 
              THEN COALESCE(
                (SELECT 'an:' || oa.instance_id || ':' || oa.odoo_id
                 FROM companies c
                 JOIN odoo_analytic_accounts oa ON oa.instance_id = c.odoo_instance_id 
                   AND (oa.company_id IS NULL OR oa.company_id = 0 OR oa.company_id = c.odoo_company_id)
                   AND (oa.name = TRIM(ji.analytic_account) OR REPLACE(oa.name, '  ', ' ') = REPLACE(TRIM(ji.analytic_account), '  ', ' '))
                 WHERE c.id = ji.company_id
                 ORDER BY CASE WHEN oa.company_id = c.odoo_company_id THEN 0 ELSE 1 END, oa.odoo_id ASC
                 LIMIT 1),
                'an:' || TRIM(ji.analytic_account)
              )
              ELSE (
                SELECT COALESCE(
                  (SELECT 'an:' || oa.instance_id || ':' || oa.odoo_id
                   FROM companies c
                   JOIN odoo_analytic_accounts oa ON oa.instance_id = c.odoo_instance_id 
                     AND (oa.company_id IS NULL OR oa.company_id = 0 OR oa.company_id = c.odoo_company_id)
                     AND (oa.name = TRIM(m.analytic_account) OR REPLACE(oa.name, '  ', ' ') = REPLACE(TRIM(m.analytic_account), '  ', ' '))
                   WHERE c.id = ji.company_id
                   ORDER BY CASE WHEN oa.company_id = c.odoo_company_id THEN 0 ELSE 1 END, oa.odoo_id ASC
                   LIMIT 1),
                  'an:' || TRIM(m.analytic_account)
                )
                FROM analytic_group_mapping m
                WHERE m.company_id = ji.company_id AND m.journal_id = ji.journal_id AND m.analytic_account IS NOT NULL AND m.analytic_account != ''
                LIMIT 1
              )
            END,
            'j:' || COALESCE(ji.journal_id, 0)
          ) as cost_center_key,
          COALESCE(
            CASE 
              WHEN ji.cost_center_id IS NOT NULL AND ji.cost_center_id > 0
              THEN (
                SELECT oa.name 
                FROM companies c 
                JOIN odoo_analytic_accounts oa ON oa.instance_id = c.odoo_instance_id AND oa.odoo_id = ji.cost_center_id
                WHERE c.id = ji.company_id
                LIMIT 1
              )
              WHEN ji.analytic_account IS NOT NULL AND TRIM(ji.analytic_account) != '' 
              THEN TRIM(ji.analytic_account)
              ELSE (
                SELECT TRIM(m.analytic_account)
                FROM analytic_group_mapping m
                WHERE m.company_id = ji.company_id AND m.journal_id = ji.journal_id AND m.analytic_account IS NOT NULL AND m.analytic_account != ''
                LIMIT 1
              )
            END,
            NULLIF(TRIM(ji.journal_name), ''),
            'بدون دفتر'
          ) as cost_center_name,
          ROUND(SUM(ji.debit), 2) as debit,
          ROUND(SUM(ji.credit), 2) as credit,
          ROUND(SUM(CASE 
            WHEN ${engine._sectionExpr('ji', 'o')} = 'income' THEN ji.credit - ji.debit 
            ELSE 0 
          END), 2) as revenue,
          ROUND(SUM(CASE 
            WHEN ${engine._sectionExpr('ji', 'o')} = 'expense' THEN ji.debit - ji.credit 
            ELSE 0 
          END), 2) as expense,
          ROUND(SUM(CASE 
            WHEN ji.account_type = 'asset_receivable' AND im.move_name IS NOT NULL 
            THEN ji.debit - ji.credit 
            ELSE 0 
          END), 2) as billed,
          ROUND(SUM(CASE 
            WHEN ji.account_type = 'asset_receivable' AND cm.move_name IS NOT NULL 
            THEN ji.credit - ji.debit 
            ELSE 0 
          END), 2) as collected
        FROM journal_items ji
        ${engine._sectionJoin('ji', 'o')}
        LEFT JOIN _temp_fact_income im ON im.move_name = ji.move_name
        LEFT JOIN _temp_fact_cash cm ON cm.move_name = ji.move_name
        WHERE ji.company_id = ?
          AND ji.move_state = 'posted'
        GROUP BY 
          ji.company_id,
          ji.date,
          ji.account_code,
          section,
          department_id,
          COALESCE(ji.analytic_account, ''),
          COALESCE(ji.journal_name, ''),
          COALESCE(ji.journal_id, 0),
          cost_center_key,
          cost_center_name
      `).run(cid);
    }
  }

  /**
   * S1 Unified Sync Pipeline:
   * 1. Journal Items (SyncEngine.syncAll)
   * 2. Sales Invoices (SalesSyncEngine.syncAll)
   * 3. Invoice Departments Resolution (ConsolidationEngine.resolveInvoiceDepartments)
   * 4. Payment Allocations (syncAllPaymentAllocations)
   * 5. Final Cache Flush & Fact Table verification
   */
  async syncAllUnified(progressCallback) {
    const startTime = Date.now();
    console.log('[UnifiedSync] 🚀 Starting complete unified sync sequence...');
    
    const results = {
      stages: {},
      duration: 0,
      success: true
    };

    try {
      // Stage 1: Journal entries
      if (progressCallback) progressCallback({ stage: 1, name: 'قيود اليومية', progress: 10 });
      console.log('[UnifiedSync] Stage 1/4: Syncing journal items...');
      const journalResults = await this.syncAll();
      results.stages.journal_items = {
        success: journalResults.every(r => r.success),
        records: journalResults.reduce((s, r) => s + (r.count || 0), 0)
      };

      // Stage 2: Sales invoices
      if (progressCallback) progressCallback({ stage: 2, name: 'فواتير المبيعات', progress: 40 });
      console.log('[UnifiedSync] Stage 2/4: Syncing sales invoices...');
      const SalesSyncEngine = require('./sales-sync-engine');
      const salesEngine = new SalesSyncEngine();
      const salesResults = await salesEngine.syncAll();
      results.stages.sales_invoices = {
        success: salesResults.every(r => r.status !== 'failed'),
        records: salesResults.reduce((s, r) => s + (r.records_synced || 0), 0)
      };

      // Stage 2.5: Rebuild invoice departments for newly synced sales invoices
      const ConsolidationEngine = require('./consolidation');
      const consolidation = new ConsolidationEngine(this.db);
      consolidation.resolveInvoiceDepartments();

      // Stage 3: Payment allocations
      if (progressCallback) progressCallback({ stage: 3, name: 'تسويات السداد', progress: 70 });
      console.log('[UnifiedSync] Stage 3/4: Syncing payment allocations...');
      const { syncAllPaymentAllocations } = require('../scripts/sync-payment-allocations');
      const paResult = await syncAllPaymentAllocations();
      results.stages.payment_allocations = {
        success: paResult.success,
        totalAllocations: paResult.totalAllocations
      };

      // Stage 4: Invoice departments reconciliation
      if (progressCallback) progressCallback({ stage: 4, name: 'إعادة بناء الأقسام', progress: 85 });
      console.log('[UnifiedSync] Stage 4/4: Rebuilding invoice departments...');
      const deptAllocations = consolidation.resolveInvoiceDepartments();
      results.stages.invoice_departments = {
        success: true,
        allocations: deptAllocations
      };

      // Final Step: Cache Flush
      const CacheService = require('./cache');
      CacheService.flush();
      
      results.duration = Math.round((Date.now() - startTime) / 1000);
      if (progressCallback) progressCallback({ stage: 4, name: 'اكتملت المزامنة بنجاح', progress: 100, done: true });
      console.log(`[UnifiedSync] 🎉 Completed full unified sync in ${results.duration}s!`);
      return results;
    } catch (err) {
      console.error('[UnifiedSync] ❌ Pipeline failed:', err.message);
      results.success = false;
      results.error = err.message;
      results.duration = Math.round((Date.now() - startTime) / 1000);
      throw err;
    }
  }
}

module.exports = SyncEngine;
