const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');
const SalesSyncEngine = require('../services/sales-sync-engine');

let salesSyncEngineInstance = null;
function getSalesSyncEngine() {
  if (!salesSyncEngineInstance) salesSyncEngineInstance = new SalesSyncEngine();
  return salesSyncEngineInstance;
}

let cachedRefToJournalMap = null;
let cachedRefToJournalMapTime = 0;

let cachedGlobalMappingMap = null;
let cachedGlobalMappingMapTime = 0;
let cachedInvoiceCostCenters = null;
let cachedInvoiceCostCentersTime = 0;
let cachedSalesToMasterMap = null;

function refreshMappingsCache(db) {
  const now = Date.now();
  if (cachedGlobalMappingMap && now - cachedGlobalMappingMapTime < 60000 &&
      cachedInvoiceCostCenters && now - cachedInvoiceCostCentersTime < 60000) {
    return { globalMappingMap: cachedGlobalMappingMap, invoiceCostCenters: cachedInvoiceCostCenters, salesToMasterMap: cachedSalesToMasterMap };
  }

  // Group mappings
  const mappingsDb = db.prepare(`
    SELECT m.analytic_account as cost_center, m.journal_name, g.name as group_name 
    FROM analytic_group_mapping m
    JOIN analytic_groups g ON g.id = m.group_id
  `).all();
  
  const map = {};
  mappingsDb.forEach(m => {
    const jName = (m.journal_name || m.cost_center || '').trim();
    if (jName) {
      if (!map[jName]) map[jName] = [];
      map[jName].push({ 
        group_name: m.group_name || 'بدون مجموعة', 
        cost_center: m.cost_center || 'بدون مركز',
        raw_analytic: (m.cost_center || '').trim(),
        rule_journal: (m.journal_name || '').trim()
      });
    }
  });
  cachedGlobalMappingMap = map;
  cachedGlobalMappingMapTime = now;

  // Build COMPANY-AWARE cost center map: key = "move_name::company_id" -> analytic_account
  // When multiple journal_items exist for the same move_name+company, keep the most specific (non-empty, longest name)
  const ccMap = {};
  const allCC = db.prepare(`SELECT move_name, company_id, analytic_account FROM journal_items WHERE move_name IS NOT NULL AND analytic_account IS NOT NULL AND analytic_account != ''`).all();
  allCC.forEach(row => { 
    const key = `${row.move_name}::${row.company_id}`;
    const existing = ccMap[key];
    // Only overwrite if no existing value, or if new value is longer (more specific)
    if (!existing || row.analytic_account.length > existing.length) {
      ccMap[key] = row.analytic_account;
    }
  });
  cachedInvoiceCostCenters = ccMap;
  cachedInvoiceCostCentersTime = now;

  // Build sales_company_id -> master_company_id mapping
  // sales_companies.sales_company_id = companies.odoo_company_id
  const s2m = {};
  try {
    const salesCos = db.prepare('SELECT id, sales_company_id FROM sales_companies').all();
    const masterCos = db.prepare('SELECT id, odoo_company_id FROM companies').all();
    salesCos.forEach(sc => {
      const mc = masterCos.find(mc => mc.odoo_company_id === sc.sales_company_id);
      if (mc) s2m[sc.id] = mc.id;
    });
  } catch(e) {}
  cachedSalesToMasterMap = s2m;
  
  return { globalMappingMap: map, invoiceCostCenters: ccMap, salesToMasterMap: s2m };
}

function determineClassification(inv, globalMappingMap, invoiceCostCenters, refToJournalMap, salesToMasterMap) {
  let groupName = 'بدون مجموعة';
  let ccName = 'بدون مركز تكلفة';
  
  const amt = parseFloat(inv.amount_total) || 0;
  let moveType = '', journalName = '', num = '';
  try {
    const p = inv.raw_data ? JSON.parse(inv.raw_data) : {};
    moveType = p.move_type || '';
    journalName = (p.journal_name || '').trim();
    num = (p.name || p.invoice_number || '').trim();
    
    if (['Customer Credit Note', 'out_refund'].includes(moveType) || amt < 0) {
      const pRef = (p.reference || '').trim();
      if (!journalName && pRef && refToJournalMap[pRef]) {
        journalName = refToJournalMap[pRef];
      }
    }
  } catch(e) {}

  const partner = inv.partner_name || 'غير معروف';
  const moveName = inv.name || num;

  // Resolve the invoice's sales company_id to the master company_id
  const salesCompanyId = inv.company_id;
  const masterCompanyId = (salesToMasterMap || {})[salesCompanyId] || salesCompanyId;

  // PRIORITY 1: Exact analytic account from journal_items — COMPANY-AWARE
  const companyKey = `${moveName}::${masterCompanyId}`;
  const exactCC = invoiceCostCenters[companyKey];
  if (exactCC) {
    let found = false;
    let exactMatches = [];
    for (const key of Object.keys(globalMappingMap)) {
      const ms = globalMappingMap[key].filter(r => r.raw_analytic === exactCC);
      exactMatches.push(...ms);
    }
    
    if (exactMatches.length > 0) {
      // 1. Prefer match where rule_journal matches invoice journalName exactly
      // 2. Otherwise prefer match where rule_journal is empty (applies to all journals)
      // 3. Otherwise just pick the first one
      let match = exactMatches.find(r => r.rule_journal && r.rule_journal === journalName) ||
                  exactMatches.find(r => !r.rule_journal) ||
                  exactMatches[0];
                  
      groupName = match.group_name;
      ccName = match.cost_center;
      found = true;
    }
    
    // Step B: Only if no exact match, try partial (includes) — but prefer shorter matches and matching journals
    if (!found) {
      let partialMatches = [];
      for (const key of Object.keys(globalMappingMap)) {
        for (const r of globalMappingMap[key]) {
          if (exactCC.includes(r.raw_analytic) || r.raw_analytic.includes(exactCC)) {
            partialMatches.push(r);
          }
        }
      }
      
      if (partialMatches.length > 0) {
        // Sort by how close the lengths are (most specific), then by journal match
        partialMatches.sort((a, b) => {
          const diffA = Math.abs(a.raw_analytic.length - exactCC.length);
          const diffB = Math.abs(b.raw_analytic.length - exactCC.length);
          if (diffA !== diffB) return diffA - diffB; // Smaller diff first
          // If lengths are equal, prefer matching journal
          const aJrnMatch = (a.rule_journal === journalName) ? 1 : (!a.rule_journal ? 0 : -1);
          const bJrnMatch = (b.rule_journal === journalName) ? 1 : (!b.rule_journal ? 0 : -1);
          return bJrnMatch - aJrnMatch; // Higher match score first
        });
        
        const bestMatch = partialMatches[0];
        groupName = bestMatch.group_name;
        ccName = bestMatch.cost_center;
        found = true;
      }
    }
    if (!found) {
      ccName = exactCC;
      if (exactCC.includes('العقد الموحد')) groupName = 'العقد الموحد';
    }
    return { groupName, ccName, moveType, amt, journalName };
  }

  // PRIORITY 2: Journal name fallback
  let rules = globalMappingMap[journalName];
  if (!rules) {
    const partialKey = Object.keys(globalMappingMap).find(k => k && journalName.includes(k));
    if (partialKey) {
      rules = globalMappingMap[partialKey];
    } else if (journalName.includes('العقد الموحد')) {
      groupName = 'العقد الموحد';
      if (journalName.includes('مكه') || journalName.includes('ليث') || journalName.includes('خليص')) {
        ccName = 'مشروع العقد الموحد مكه شركة الكهرباء';
      } else {
        ccName = 'مشروع العقد الموحد المدينه شركة الكهرباء';
      }
    }
  }

  if (rules && rules.length > 0) {
    if (rules.length === 1) {
      groupName = rules[0].group_name;
      ccName = rules[0].cost_center;
    } else {
      const exactMatch = rules.find(r => partner.includes(r.raw_analytic) || r.raw_analytic.includes(partner));
      if (exactMatch) {
        groupName = exactMatch.group_name;
        ccName = exactMatch.cost_center;
      } else {
        const defaultRule = rules.find(r => r.group_name.includes('الحج')) || rules[0];
        groupName = defaultRule.group_name;
        ccName = partner;
      }
    }
  }
  
  return { groupName, ccName, moveType, amt, journalName };
}


// ===== COMPANIES =====
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
  res.json({ id: result.lastInsertRowid, success: true });
});

// ===== SYNC =====
router.post('/sync/company/:companyId', async (req, res) => {
  try {
    const engine = getSalesSyncEngine();
    const companyId = parseInt(req.params.companyId);
    res.json({ started: true, message: 'بدأت عملية المزامنة (نظام المبيعات)' });
    
    engine.syncCompany(companyId).then(result => {
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
    const engine = getSalesSyncEngine();
    res.json({ started: true, message: 'بدأت مزامنة بيانات المبيعات للشركات' });
    
    engine.syncAll().then(results => {
      console.log('[Sales API] Sync all completed:', results);
    }).catch(err => {
      console.error('[Sales API] Sync all failed:', err.message);
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
          JOIN companies c ON (c.odoo_company_id = sc.sales_company_id OR c.name = sc.name)
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
    const { globalMappingMap, invoiceCostCenters, salesToMasterMap } = refreshMappingsCache(db);
    const quickRefMap = {};
    allMatchingDateComp.forEach(inv => {
      try { const p = JSON.parse(inv.raw_data || '{}'); if (p.name && p.journal_name) quickRefMap[p.name] = p.journal_name; } catch(e) {}
    });

    let filteredItems = allMatchingDateComp;
    const ccsArray = costCenters ? costCenters.split(',').map(c => c.trim()).filter(c => c) : [];
    
    // Attach classification to ALL to filter properly
    allMatchingDateComp.forEach(inv => {
      const cl = determineClassification(inv, globalMappingMap, invoiceCostCenters, quickRefMap, salesToMasterMap);
      inv.group_name = cl.groupName;
      inv.cost_center = cl.ccName;
    });

    if (ccsArray.length > 0) {
      filteredItems = allMatchingDateComp.filter(inv => {
        if (ccsArray.includes(inv.cost_center)) return true;
        if (ccsArray.includes('بدون مركز') && (!inv.cost_center || inv.cost_center === 'بدون مركز تكلفة')) return true;
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
      SELECT si.company_id, si.name, si.amount_total, si.raw_data, si.partner_name, c.name as company_name 
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
          JOIN companies c ON (c.odoo_company_id = sc.sales_company_id OR c.name = sc.name)
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
    
    const { globalMappingMap, invoiceCostCenters, salesToMasterMap } = refreshMappingsCache(db);
    
    // Build ref-to-journal map for credit notes
    if (!cachedRefToJournalMap || Date.now() - cachedRefToJournalMapTime > 60000) {
      cachedRefToJournalMap = {};
      const allRefs = db.prepare(`SELECT raw_data FROM sales_invoices WHERE raw_data LIKE '%journal_name%'`).all();
      allRefs.forEach(row => {
         try {
           const p = row.raw_data ? JSON.parse(row.raw_data) : {};
           const jn = (p.journal_name || '').trim();
           const num = (p.invoice_number || p.name || '').trim();
           if (jn && num) cachedRefToJournalMap[num] = jn;
         } catch(e) {}
      });
      cachedRefToJournalMapTime = Date.now();
    }
    const refToJournalMap = cachedRefToJournalMap;
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
      
      const cl = determineClassification(inv, globalMappingMap, invoiceCostCenters, refToJournalMap, salesToMasterMap);
      const { groupName, ccName, moveType, amt } = cl;
      
      if (ccsArray.length > 0) {
        if (!ccsArray.includes(ccName) && !(ccsArray.includes('بدون مركز') && (!ccName || ccName === 'بدون مركز تكلفة'))) return;
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
      if (moveType === 'Customer Credit Note' || moveType === 'out_refund' || amt < 0) {
        stats.refunds += Math.abs(amt);
      } else {
        stats.total += amt;
        stats.untaxed += unt;
        stats.tax += (amt - unt);
      }
      stats.paid += paid;
      stats.rem = stats.total - stats.refunds - stats.paid;
    });

    res.json({ success: true, hierarchy });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
