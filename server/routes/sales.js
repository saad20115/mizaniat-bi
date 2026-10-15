const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');
const SalesSyncEngine = require('../services/sales-sync-engine');
const CacheService = require('../services/cache');

let salesSyncEngineInstance = null;
function getSalesSyncEngine() {
  if (!salesSyncEngineInstance) salesSyncEngineInstance = new SalesSyncEngine();
  return salesSyncEngineInstance;
}

let cachedAttribution = null;
let cachedAttributionTime = 0;

// CC1: the sales views read the one attribution of each invoice (invoice_departments, built from
// the Odoo analytic distribution and the explicit journal defaults). No name matching, no
// "first rule" and no preferred department: an invoice without department shows under its own
// cost-center name.
function refreshMappingsCache(db) {
  const now = Date.now();
  if (cachedAttribution && now - cachedAttributionTime < 60000) {
    return { attribution: cachedAttribution };
  }
  const map = new Map();
  for (const r of db.prepare(`
    SELECT idp.sales_invoice_id, idp.share, idp.cost_center_name, g.name AS group_name
    FROM invoice_departments idp
    LEFT JOIN analytic_groups g ON g.id = idp.department_id
    ORDER BY idp.sales_invoice_id, idp.cost_center_key, idp.department_id
  `).all()) {
    if (!map.has(r.sales_invoice_id)) map.set(r.sales_invoice_id, []);
    const cc = (r.cost_center_name || '').trim() || 'بدون مركز تكلفة';
    map.get(r.sales_invoice_id).push({ groupName: (r.group_name || '').trim() || cc, ccName: cc, share: r.share });
  }
  cachedAttribution = map;
  cachedAttributionTime = now;
  return { attribution: map };
}

function determineClassification(inv, attribution) {
  const amt = parseFloat(inv.amount_total) || 0;
  let moveType = '', journalName = '';
  try {
    const p = inv.raw_data ? JSON.parse(inv.raw_data) : {};
    moveType = p.move_type || '';
    journalName = (p.journal_name || '').trim();
  } catch(e) {}
  const parts = (attribution && attribution.get(inv.id)) || [{ groupName: 'بدون مجموعة', ccName: 'بدون مركز تكلفة', share: 1 }];
  return {
    groupName: parts.map(p => p.groupName).join(' / '),
    ccName: parts.map(p => p.ccName).join(' / '),
    parts,
    moveType,
    amt,
    journalName
  };
}

router.get('/companies', (req, res) => {
  const db = getDb();
  const companies = db.prepare(`
    SELECT c.*, oi.name as instance_name, oi.url as instance_url,
      (SELECT COUNT(*) FROM sales_invoices WHERE company_id = c.id) as item_count,
      (SELECT MAX(date) FROM sales_invoices WHERE company_id = c.id) as last_entry_date
    FROM sales_companies c
    LEFT JOIN sales_instances oi ON oi.id = c.sales_instance_id
    ORDER BY c.name
  `).all();
  res.json(companies);
});

router.post('/companies', (req, res) => {
  const db = getDb();
  const { sales_instance_id, sales_company_id, name, currency, color } = req.body;
  const result = db.prepare(`
    INSERT INTO sales_companies (sales_instance_id, sales_company_id, name, currency, color)
    VALUES (?, ?, ?, ?, ?)
  `).run(sales_instance_id, sales_company_id || 1, name, currency || 'SAR', color || '#10b981');
  CacheService.flush();
  res.json({ id: result.lastInsertRowid, success: true });
});

router.put('/companies/:id', (req, res) => {
  const db = getDb();
  const { name, currency, color, is_active, sales_instance_id } = req.body;
  db.prepare(`
    UPDATE sales_companies SET name = COALESCE(?, name), currency = COALESCE(?, currency),
    color = COALESCE(?, color), is_active = COALESCE(?, is_active),
    sales_instance_id = COALESCE(?, sales_instance_id) WHERE id = ?
  `).run(name, currency, color, is_active, sales_instance_id, req.params.id);
  CacheService.flush();
  res.json({ success: true });
});

router.delete('/companies/:id', (req, res) => {
  try {
    const db = getDb();
    const cid = req.params.id;
    // Clear dependencies to avoid foreign key errors
    db.prepare('DELETE FROM sales_invoices WHERE company_id = ?').run(cid);
    db.prepare('DELETE FROM sales_sync_logs WHERE company_id = ?').run(cid);
    db.prepare('DELETE FROM sales_elimination_rules WHERE source_company_id = ? OR target_company_id = ?').run(cid, cid);
    db.prepare('DELETE FROM sales_companies WHERE id = ?').run(cid);
    CacheService.flush();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ===== SALES INSTANCES =====
router.get('/instances', (req, res) => {
  const db = getDb();
  const instances = db.prepare('SELECT id, name, url, username FROM sales_instances ORDER BY name').all();
  res.json(instances);
});

router.post('/instances', (req, res) => {
  const { name, url, username, api_key } = req.body;
  const db = getDb();
  db.prepare('INSERT INTO sales_instances (name, url, username, api_key) VALUES (?, ?, ?, ?)').run(name, url, username, api_key);
  res.json({ success: true });
});

router.put('/instances/:id', (req, res) => {
  const db = getDb();
  const { name, url, db_name, username, api_key, is_active } = req.body;
  db.prepare(`
    UPDATE sales_instances SET 
    name = COALESCE(?, name), url = COALESCE(?, url), db_name = COALESCE(?, db_name),
    username = COALESCE(?, username), api_key = COALESCE(?, api_key),
    is_active = COALESCE(?, is_active), updated_at = datetime('now')
    WHERE id = ?
  `).run(name, url, db_name, username, api_key, is_active, req.params.id);
  res.json({ success: true });
});

router.delete('/instances/:id', (req, res) => {
  try {
    const db = getDb();
    const count = db.prepare('SELECT COUNT(*) as c FROM sales_companies WHERE sales_instance_id = ?').get(req.params.id);
    if (count && count.c > 0) {
      return res.status(400).json({ success: false, message: 'لا يمكن حذف الاتصال لوجود شركات مرتبطة به. يرجى حذف الشركات أولاً.' });
    }
    db.prepare('DELETE FROM sales_instances WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/instances/:id/test', async (req, res) => {
  try {
    const db = getDb();
    const instance = db.prepare('SELECT * FROM sales_instances WHERE id = ?').get(req.params.id);
    if (!instance) return res.status(404).json({ error: 'Instance not found' });
    
    const companyId = req.body.company_id || 1;
    const engine = getSalesSyncEngine();
    
    let baseUrlRaw = instance.url.replace(/\/+$/, '');
    if (!baseUrlRaw.startsWith('http')) baseUrlRaw = 'https://' + baseUrlRaw;
    const baseUrl = baseUrlRaw.includes('/api/customer_invoices') ? baseUrlRaw.split('/api/customer_invoices')[0] : baseUrlRaw;
    const fullUrl = `${baseUrl}/api/customer_invoices?company_id=${companyId}`;
    
    const rawData = await engine._httpRequest(fullUrl, instance.username, instance.api_key);
    const parsed = JSON.parse(rawData);
    
    let count = Array.isArray(parsed) ? parsed.length : (parsed.data ? parsed.data.length : (parsed.result ? parsed.result.length : '?'));
    
    res.json({ success: true, message: `الاتصال ناجح! تم العثور على ${count} فاتورة` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/test-connection', async (req, res) => {
  try {
    const { url, username, password, company_id } = req.body;
    if (!url || !username || !password) {
      return res.status(400).json({ success: false, message: 'يجب تقديم الرابط واسم المستخدم وكلمة المرور' });
    }
    
    const engine = getSalesSyncEngine();
    let baseUrlRaw = url.replace(/\/+$/, '');
    if (!baseUrlRaw.startsWith('http')) baseUrlRaw = 'https://' + baseUrlRaw;
    const baseUrl = baseUrlRaw.includes('/api/customer_invoices') ? baseUrlRaw.split('/api/customer_invoices')[0] : baseUrlRaw;
    const compId = company_id || 1;
    const fullUrl = `${baseUrl}/api/customer_invoices?company_id=${compId}`;
    
    const rawData = await engine._httpRequest(fullUrl, username, password);
    const parsed = JSON.parse(rawData);
    
    let count = Array.isArray(parsed) ? parsed.length : (parsed.data ? parsed.data.length : (parsed.result ? parsed.result.length : '?'));
    res.json({ success: true, message: `الاتصال المبدئي يعمل بنجاح! تم قراءة ${count} فاتورة` });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

// ===== ELIMINATION RULES =====
router.get('/eliminations', (req, res) => {
  const db = getDb();
  const rules = db.prepare(`
    SELECT er.*, 
      sc.name as source_company_name, 
      tc.name as target_company_name
    FROM sales_elimination_rules er
    LEFT JOIN sales_companies sc ON sc.id = er.source_company_id
    LEFT JOIN sales_companies tc ON tc.id = er.target_company_id
    ORDER BY er.created_at DESC
  `).all();
  res.json(rules);
});

router.post('/eliminations', (req, res) => {
  const db = getDb();
  const { name, description, rule_type, source_company_id, target_company_id, source_account_code, target_account_code } = req.body;
  const result = db.prepare(`
    INSERT INTO sales_elimination_rules (name, description, rule_type, source_company_id, target_company_id, source_account_code, target_account_code)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(name, description || '', rule_type || 'account_match', source_company_id, target_company_id, source_account_code, target_account_code);
  CacheService.flush();
  res.json({ id: result.lastInsertRowid, success: true });
});

// ===== SYNC =====
router.post('/sync/company/:companyId', async (req, res) => {
  try {
    const engine = getSalesSyncEngine();
    const companyId = parseInt(req.params.companyId);
    res.json({ started: true, message: 'بدأت عملية المزامنة (نظام المبيعات)' });
    
    engine.syncCompany(companyId).then(result => {
      CacheService.flush();
      console.log(`[Sales API] Sync completed for company ${companyId}:`, result);
    }).catch(err => {
      console.error(`[Sales API] Sync failed for company ${companyId}:`, err.message);
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sync/progress/:companyId', (req, res) => {
  const engine = getSalesSyncEngine();
  res.json(engine.getProgress(parseInt(req.params.companyId)));
});

router.post('/sync/all', async (req, res) => {
  try {
    const SyncEngine = require('../services/sync-engine');
    const engine = new SyncEngine();
    res.json({ started: true, message: 'بدأت المزامنة الموحدة لجميع الشركات (القيود، الفواتير، التسويات، والأقسام)' });
    
    engine.syncAllUnified().then(results => {
      console.log('[Sales API] Unified sync all completed:', results);
    }).catch(err => {
      console.error('[Sales API] Unified sync all failed:', err.message);
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sync/status', (req, res) => {
  const engine = getSalesSyncEngine();
  res.json(engine.getSyncStatus());
});

// ===== SYNC ======
// ... existing sync endpoints are here, adding scheduler and notifs below

router.get('/settings/schedule', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare("SELECT key, value FROM sales_app_settings WHERE key IN ('sync_enabled','sync_interval_hours')").all();
    const settings = {};
    for (const r of rows) settings[r.key] = r.value;
    
    const { getSchedulerStatus } = require('../cron/sales_scheduler');
    const status = getSchedulerStatus();
    
    res.json({
      enabled: settings.sync_enabled === 'true',
      intervalHours: parseInt(settings.sync_interval_hours) || 2,
      running: status.running,
      schedule: status.schedule
    });
  } catch (err) {
    const { getSchedulerStatus } = require('../cron/sales_scheduler');
    const status = getSchedulerStatus();
    res.json({
      enabled: false,
      intervalHours: 2,
      running: status.running,
      schedule: status.schedule
    });
  }
});

router.post('/settings/schedule', (req, res) => {
  try {
    const { enabled, intervalHours } = req.body;
    const db = getDb();
    
    db.prepare("INSERT OR REPLACE INTO sales_app_settings (key, value) VALUES ('sync_enabled', ?)").run(enabled ? 'true' : 'false');
    db.prepare("INSERT OR REPLACE INTO sales_app_settings (key, value) VALUES ('sync_interval_hours', ?)").run((intervalHours || 2).toString());
    
    const { reschedule, getSchedulerStatus } = require('../cron/sales_scheduler');
    reschedule(intervalHours || 2, enabled);
    
    res.json(getSchedulerStatus());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/notifications', (req, res) => {
  try {
    const db = getDb();
    const limit = req.query.limit || 10;
    const notifs = db.prepare('SELECT * FROM sales_sync_notifications ORDER BY id DESC LIMIT ?').all(limit);
    res.json(notifs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/notifications/clear', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM sales_sync_notifications').run();
  res.json({ success: true });
});
router.get('/invoices', (req, res) => {
  try {
    const db = getDb();
    const { search, companyIds, masterCompanyIds, dateFrom, dateTo, state, limit, offset, costCenters } = req.query;
    
    let sql = `
      SELECT si.*, c.name as company_name 
      FROM sales_invoices si
      LEFT JOIN sales_companies c ON c.id = si.company_id
      WHERE si.state != 'draft'
    `;
    const params = [];
    
    if (search) {
      sql += ` AND (si.name LIKE ? OR si.partner_name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }
    if (companyIds) {
      const ids = companyIds.split(',').map(n => parseInt(n)).filter(n => !isNaN(n));
      if (ids.length > 0) {
        sql += ` AND si.company_id IN (${ids.map(() => '?').join(',')})`;
        params.push(...ids);
      }
    }
    if (masterCompanyIds) {
      const ids = masterCompanyIds.split(',').map(n => parseInt(n)).filter(n => !isNaN(n));
      if (ids.length > 0) {
        sql += ` AND si.company_id IN (
          SELECT sc.id 
          FROM sales_companies sc
          JOIN companies c ON c.odoo_company_id = sc.sales_company_id
          WHERE c.id IN (${ids.map(() => '?').join(',')})
        )`;
        params.push(...ids);
      }
    }
    // (SQL costCenters filtering removed because it checks raw journal_items and fails to match CC/Group names. We filter in-memory instead)
    if (dateFrom) {
      sql += ` AND si.date >= ?`;
      params.push(dateFrom);
    }
    if (dateTo) {
      sql += ` AND si.date <= ?`;
      params.push(dateTo);
    }
    if (state) {
      sql += ` AND si.state = ?`;
      params.push(state);
    }
    
    sql += ` ORDER BY si.date DESC, si.id DESC`;
    const allMatchingDateComp = db.prepare(sql).all(...params);

    // Apply in-memory costCenter filtering
    const { attribution } = refreshMappingsCache(db);

    let filteredItems = allMatchingDateComp;
    const ccsArray = costCenters ? costCenters.split(',').map(c => c.trim()).filter(c => c) : [];

    // Attach classification to ALL to filter properly
    allMatchingDateComp.forEach(inv => {
      const cl = determineClassification(inv, attribution);
      inv.group_name = cl.groupName;
      inv.cost_center = cl.ccName;
      inv._cc_parts = cl.parts.map(p => p.ccName);
    });

    if (ccsArray.length > 0) {
      filteredItems = allMatchingDateComp.filter(inv => {
        if (inv._cc_parts.some(cc => ccsArray.includes(cc))) return true;
        if (ccsArray.includes('بدون مركز') && inv._cc_parts.includes('بدون مركز تكلفة')) return true;
        return false;
      });
    }

    // Now compute totals from filteredItems
    const total = filteredItems.length;
    let amount_total = 0, amount_untaxed = 0, total_paid = 0;
    filteredItems.forEach(inv => {
      amount_total += (inv.amount_total || 0);
      try {
        const p = inv.raw_data ? JSON.parse(inv.raw_data) : {};
        amount_untaxed += (parseFloat(p.amount_untaxed) || 0);
        total_paid += (parseFloat(p.total_paid) || 0);
      } catch(e) {}
    });
    const totals = { amount_total, amount_untaxed, total_paid };

    // Apply pagination to sliced items
    const l = parseInt(limit) || 50;
    const o = parseInt(offset) || 0;
    const items = filteredItems.slice(o, o + l);
    
    // Extract unique states
    const states = db.prepare("SELECT DISTINCT state FROM sales_invoices WHERE state IS NOT NULL AND state != '' AND state != 'draft'").all().map(r => r.state);
    
    res.json({ items, total, states, totals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// New detailed hierarchical sales data endpoint
router.get('/customer-hierarchy', (req, res) => {
  try {
    const db = getDb();
    const { companyIds, masterCompanyIds, dateFrom, dateTo, state, costCenters } = req.query;
    
    // Fetch all sales invoices matching filters
    let sql = `
      SELECT si.id, si.company_id, si.name, si.amount_total, si.raw_data, si.partner_name, c.name as company_name
      FROM sales_invoices si
      LEFT JOIN sales_companies c ON c.id = si.company_id
      WHERE si.state != 'draft'
    `;
    const params = [];
    
    if (companyIds) {
      const ids = companyIds.split(',').map(n => parseInt(n)).filter(n => !isNaN(n));
      if (ids.length > 0) {
        sql += ` AND si.company_id IN (${ids.map(() => '?').join(',')})`;
        params.push(...ids);
      }
    }
    if (masterCompanyIds) {
      const ids = masterCompanyIds.split(',').map(n => parseInt(n)).filter(n => !isNaN(n));
      if (ids.length > 0) {
        sql += ` AND si.company_id IN (
          SELECT sc.id 
          FROM sales_companies sc
          JOIN companies c ON c.odoo_company_id = sc.sales_company_id
          WHERE c.id IN (${ids.map(() => '?').join(',')})
        )`;
        params.push(...ids);
      }
    }
    if (dateFrom) {
      sql += ` AND si.date >= ?`;
      params.push(dateFrom);
    }
    if (dateTo) {
      sql += ` AND si.date <= ?`;
      params.push(dateTo);
    }
    if (state) {
      sql += ` AND si.state = ?`;
      params.push(state);
    }
    
    const invoices = db.prepare(sql).all(...params);

    const { attribution } = refreshMappingsCache(db);
    const ccsArray = costCenters ? costCenters.split(',').map(c => c.trim()).filter(c => c) : [];

    const hierarchy = {};

    invoices.forEach(inv => {
      // Skip non-sales entries (MISC, BNK, PBNK, TA, CSH entries are NOT sales invoices)
      const invName = (inv.name || '').trim();
      const isRealSales = invName.startsWith('INV') || invName.startsWith('RINV') ||
                          invName.startsWith('ELC') || invName.startsWith('RELC') ||
                          invName.startsWith('sal') || invName.startsWith('old');
      let moveTypeRaw = '';
      const company = (inv.company_name || 'أخرى').trim();
      const partner = (inv.partner_name || 'غير معروف').trim();
      let paid = 0, unt = 0;
      try {
        const p = inv.raw_data ? JSON.parse(inv.raw_data) : {};
        paid = parseFloat(p.total_paid) || 0;
        unt = parseFloat(p.amount_untaxed) || 0;
        moveTypeRaw = p.move_type || '';
      } catch(e) {}
      // Only include actual sales invoices and credit notes
      if (!isRealSales && moveTypeRaw !== 'Customer Invoice' && moveTypeRaw !== 'Customer Credit Note' && moveTypeRaw !== 'out_invoice' && moveTypeRaw !== 'out_refund') return;

      const cl = determineClassification(inv, attribution);
      const { moveType, amt } = cl;

      // An invoice split over several cost centers contributes its share to each of them
      for (const part of cl.parts) {
        const { groupName, ccName } = part;
        const share = part.share === null || part.share === undefined ? 1 : part.share;
        if (ccsArray.length > 0) {
          if (!ccsArray.includes(ccName) && !(ccsArray.includes('بدون مركز') && (!ccName || ccName === 'بدون مركز تكلفة'))) continue;
        }

        if (!hierarchy[company]) hierarchy[company] = {};
        if (!hierarchy[company][groupName]) hierarchy[company][groupName] = {};
        if (!hierarchy[company][groupName][ccName]) hierarchy[company][groupName][ccName] = {};

        if (!hierarchy[company][groupName][ccName][partner]) {
          hierarchy[company][groupName][ccName][partner] = {
            total: 0, untaxed: 0, tax: 0, refunds: 0, paid: 0, rem: 0
          };
        }

        const stats = hierarchy[company][groupName][ccName][partner];
        if (moveType === 'Customer Credit Note' || moveType === 'out_refund') {
          stats.refunds += Math.abs(amt) * share;
        } else {
          stats.total += amt * share;
          stats.untaxed += unt * share;
          stats.tax += (amt - unt) * share;
        }
        stats.paid += paid * share;
        stats.rem = stats.total - stats.refunds - stats.paid;
      }
    });

    res.json({ success: true, hierarchy });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
