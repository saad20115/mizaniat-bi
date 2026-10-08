const { getDb } = require('../db/connection');
const OdooConnector = require('./odoo-connector');

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

  async syncCompany(companyId) {
    const db = getDb();
    const logStmt = db.prepare('INSERT INTO sales_sync_logs (company_id, sync_type, status, error_message) VALUES (?, ?, ?, ?)');
    let logId;
    
    try {
      this._updateProgress(companyId, { status: 'running', phase: 'تهيئة الخادم والاتصال بأودو...', inserted: 0, total: 0 });
      const logResult = logStmt.run(companyId, 'full', 'running', null);
      logId = logResult.lastInsertRowid;

      const company = db.prepare('SELECT * FROM sales_companies WHERE id = ?').get(companyId);
      if (!company) throw new Error('الشركة غير موجودة');

      // Match Odoo instance and resolve database name
      const masterCo = db.prepare(`
        SELECT c.id as master_company_id, c.name as master_company_name,
               oi.id as odoo_instance_id, oi.url as odoo_url, oi.db_name, oi.username, oi.api_key
        FROM companies c
        JOIN odoo_instances oi ON oi.id = c.odoo_instance_id
        WHERE c.odoo_company_id = ?
      `).get(company.sales_company_id);

      const instance = db.prepare('SELECT * FROM sales_instances WHERE id = ?').get(company.sales_instance_id);

      let url, username, apiKey, dbName;
      if (masterCo) {
        url = masterCo.odoo_url;
        username = masterCo.username;
        apiKey = masterCo.api_key;
        dbName = masterCo.db_name;
      } else if (instance) {
        url = instance.url;
        username = instance.username;
        apiKey = instance.api_key;
        dbName = instance.db_name;
        if (!dbName) {
          const cleanUrl = instance.url.replace(/\/api\/.*$/, '').replace(/\/+$/, '');
          const matchedOdoo = db.prepare(`
            SELECT * FROM odoo_instances 
            WHERE ? LIKE url || '%' OR url LIKE ? || '%'
          `).get(cleanUrl, cleanUrl);
          if (matchedOdoo) dbName = matchedOdoo.db_name;
        }
      } else {
        throw new Error('لا يوجد اتصال منسوب لهذه الشركة');
      }

      // Persist db_name to sales_instances if missing
      if (instance && !instance.db_name && dbName) {
        db.prepare('UPDATE sales_instances SET db_name = ? WHERE id = ?').run(dbName, instance.id);
      }

      this._updateProgress(companyId, { phase: 'جلب الفواتير والإشعارات الدائنة عبر Odoo RPC...', total: 100, inserted: 10 });
      
      const connector = new OdooConnector(url, username, apiKey, dbName);
      const moves = await connector.fetchSalesMoves(company.sales_company_id);

      // Data safety check: never wipe existing records if Odoo returns 0 records
      const existingCount = db.prepare('SELECT count(*) as c FROM sales_invoices WHERE company_id = ?').get(companyId).c;
      if ((!moves || moves.length === 0) && existingCount > 0) {
        throw new Error(`أرجع أودو 0 سجل للشركة ${company.name} التي تحوي ${existingCount} سجل سابق — أُلغيت المزامنة لحماية البيانات`);
      }

      this._updateProgress(companyId, { phase: 'جارِ إعداد البيانات وحفظها...', total: (moves || []).length, inserted: 0 });

      const insertStmt = db.prepare(`
        INSERT INTO sales_invoices (
          company_id, invoice_id, name, partner_name, partner_id, journal_id, journal_name,
          date, invoice_date_due, amount_total, amount_untaxed, amount_residual_signed, payment_state, state, raw_data
        )
        VALUES (
          @company_id, @invoice_id, @name, @partner_name, @partner_id, @journal_id, @journal_name,
          @date, @invoice_date_due, @amount_total, @amount_untaxed, @amount_residual_signed, @payment_state, @state, @raw_data
        )
      `);

      // Delete + insert + rebuild departments in single transaction for atomic update
      const insertMany = db.transaction((rows) => {
        db.prepare('DELETE FROM sales_invoices WHERE company_id = ?').run(companyId);
        let count = 0;
        for (const r of rows) {
          const invId = r.id || 0;
          const name = (r.name || '').trim();
          const partnerName = Array.isArray(r.partner_id) ? r.partner_id[1] : (r.partner_id || 'عميل غير معروف');
          const partnerId = Array.isArray(r.partner_id) ? r.partner_id[0] : (r.partner_id || null);
          const journalId = Array.isArray(r.journal_id) ? r.journal_id[0] : (r.journal_id || null);
          const journalName = Array.isArray(r.journal_id) ? r.journal_id[1] : (r.journal_id || '');
          const date = r.invoice_date || '';
          const dueDate = r.invoice_date_due || r.invoice_date || '';
          const totalSigned = parseFloat(r.amount_total_signed) || 0;
          const untaxedSigned = parseFloat(r.amount_untaxed_signed) || 0;
          const residualSigned = parseFloat(r.amount_residual_signed) || 0;
          const totalPaid = totalSigned - residualSigned;
          const isRefund = r.move_type === 'out_refund';
          const moveType = isRefund ? 'Customer Credit Note' : 'Customer Invoice';

          const rawData = {
            id: invId,
            invoice_number: name,
            name: name,
            partner_name: partnerName,
            partner_id: r.partner_id,
            invoice_date: date,
            invoice_date_due: dueDate,
            amount_total_signed: totalSigned,
            amount_untaxed_signed: untaxedSigned,
            amount_untaxed: untaxedSigned,
            amount_residual_signed: residualSigned,
            total_paid: totalPaid,
            status: 'Posted',
            state: 'posted',
            move_type: moveType,
            reference: (r.ref || '').trim(),
            payment_status: r.payment_state || '',
            payment_state: r.payment_state || '',
            journal_id: r.journal_id,
            journal_name: journalName,
            company_id: companyId
          };

          insertStmt.run({
            company_id: companyId,
            invoice_id: invId,
            name: name,
            partner_name: partnerName,
            partner_id: partnerId,
            journal_id: journalId,
            journal_name: journalName,
            date: date,
            invoice_date_due: dueDate,
            amount_total: totalSigned,
            amount_untaxed: untaxedSigned,
            amount_residual_signed: residualSigned,
            payment_state: r.payment_state || '',
            state: 'posted',
            raw_data: JSON.stringify(rawData)
          });
          count++;
          if (count % 250 === 0) {
            this._updateProgress(companyId, { inserted: count, phase: 'حفظ الفواتير...' });
          }
        }

        // Rebuild invoice departments in same transaction
        this.rebuildInvoiceDepartments(companyId);

        return count;
      });

      const totalInserted = insertMany(moves || []);

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

  /**
   * Rebuild invoice_departments for a given sales company (or all companies).
   * Attribution order:
   * 1. journal_name -> group_id via analytic_group_mapping.journal_name
   * 2. analytic_account of income lines for the same move in journal_items -> group_id (proportional)
   * 3. otherwise unclassified (0)
   */
  rebuildInvoiceDepartments(companyId) {
    const ConsolidationEngine = require('./consolidation');
    const engine = new ConsolidationEngine(getDb());
    return engine.resolveInvoiceDepartments(companyId);
  }

  rebuildAllInvoiceDepartments() {
    this.rebuildInvoiceDepartments(null);
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

    // Automatically sync payment allocations for all companies
    try {
      const { syncAllPaymentAllocations } = require('../scripts/sync-payment-allocations');
      await syncAllPaymentAllocations();
    } catch (e) {
      console.error('[SalesSyncEngine] Error syncing payment allocations:', e.message);
      try {
        db.prepare('INSERT INTO sync_notifications (type, message, details) VALUES (?, ?, ?)').run(
          'error',
          `فشل تحديث تسويات السداد: ${e.message}`,
          JSON.stringify({ error: e.message })
        );
      } catch (_) {}
      throw e;
    }

    return results;
  }
}

module.exports = SalesSyncEngine;
