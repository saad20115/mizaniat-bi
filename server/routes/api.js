const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');
const ConsolidationEngine = require('../services/consolidation');
const CacheService = require('../services/cache');
const SyncEngine = require('../services/sync-engine');
const OdooConnector = require('../services/odoo-connector');
const { reschedule, getSchedulerStatus } = require('../cron/scheduler');
const { validateFilterQuery } = require('../middleware/validator');

router.use(validateFilterQuery);

// Helper to parse companyIds from query
function parseCompanyIds(query) {
  if (!query.companyIds) return null;
  if (Array.isArray(query.companyIds)) return query.companyIds.map(Number);
  return query.companyIds.split(',').map(Number).filter(n => !isNaN(n));
}

// ===== COMPANIES =====
router.get('/companies', async (req, res) => {
  const cacheKey = CacheService.makeKey('companies', {});
  const companies = await CacheService.getOrSet(cacheKey, () => {
    const db = getDb();
    return db.prepare(`
      SELECT c.*, oi.name as instance_name, oi.url as instance_url,
        (SELECT COUNT(*) FROM journal_items WHERE company_id = c.id) as item_count,
        (SELECT MAX(date) FROM journal_items WHERE company_id = c.id) as last_entry_date
      FROM companies c
      LEFT JOIN odoo_instances oi ON oi.id = c.odoo_instance_id
      ORDER BY c.name
    `).all();
  });
  res.json(companies);
});

router.post('/companies', (req, res) => {
  const db = getDb();
  const { odoo_instance_id, odoo_company_id, name, currency, color } = req.body;
  const result = db.prepare(`
    INSERT INTO companies (odoo_instance_id, odoo_company_id, name, currency, color)
    VALUES (?, ?, ?, ?, ?)
  `).run(odoo_instance_id, odoo_company_id, name, currency || 'SAR', color || '#3b82f6');
  CacheService.flush();
  res.json({ id: result.lastInsertRowid, success: true });
});

router.put('/companies/:id', (req, res) => {
  const db = getDb();
  const { name, currency, color, is_active, odoo_instance_id, vat_period, short_name } = req.body;
  db.prepare(`
    UPDATE companies SET
      name = COALESCE(?, name),
      currency = COALESCE(?, currency),
      color = COALESCE(?, color),
      is_active = COALESCE(?, is_active),
      odoo_instance_id = COALESCE(?, odoo_instance_id),
      vat_period = COALESCE(?, vat_period),
      short_name = COALESCE(?, short_name)
    WHERE id = ?
  `).run(name, currency, color, is_active, odoo_instance_id, vat_period, short_name, req.params.id);
  CacheService.flush();
  res.json({ success: true });
});

// ===== ODOO INSTANCES =====
router.get('/instances', (req, res) => {
  const db = getDb();
  const instances = db.prepare('SELECT id, name, url, db_name, username, is_active, created_at FROM odoo_instances').all();
  res.json(instances);
});

router.post('/instances', (req, res) => {
  const db = getDb();
  const { name, url, db_name, username, api_key } = req.body;
  const result = db.prepare(`
    INSERT INTO odoo_instances (name, url, db_name, username, api_key)
    VALUES (?, ?, ?, ?, ?)
  `).run(name, url, db_name || '', username, api_key);
  res.json({ id: result.lastInsertRowid, success: true });
});

router.put('/instances/:id', (req, res) => {
  const db = getDb();
  const { name, url, db_name, username, api_key, is_active } = req.body;
  db.prepare(`
    UPDATE odoo_instances SET 
    name = COALESCE(?, name), url = COALESCE(?, url), db_name = COALESCE(?, db_name),
    username = COALESCE(?, username), api_key = COALESCE(?, api_key),
    is_active = COALESCE(?, is_active), updated_at = datetime('now')
    WHERE id = ?
  `).run(name, url, db_name, username, api_key, is_active, req.params.id);
  res.json({ success: true });
});

router.delete('/instances/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM odoo_instances WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.post('/instances/:id/test', async (req, res) => {
  const db = getDb();
  const instance = db.prepare('SELECT * FROM odoo_instances WHERE id = ?').get(req.params.id);
  if (!instance) return res.status(404).json({ error: 'Instance not found' });
  
  const companyId = req.body.company_id || 1;
  const connector = new OdooConnector(instance.url, instance.username, instance.api_key, instance.db_name);
  const result = await connector.testConnection(companyId);
  res.json(result);
});

// ===== REPORTS =====
router.get('/reports/dashboard', async (req, res) => {
  const companyIds = parseCompanyIds(req.query);
  const { dateFrom, dateTo } = req.query;
  const cacheKey = CacheService.makeKey('dashboard', { companyIds, dateFrom, dateTo });
  const data = await CacheService.getOrSet(cacheKey, () => {
    const engine = new ConsolidationEngine();
    return engine.getDashboardKPIs({ companyIds, dateFrom, dateTo });
  });
  res.json(data);
});

router.get('/reports/income-statement', async (req, res) => {
  const companyIds = parseCompanyIds(req.query);
  const { dateFrom, dateTo, years, year, costCenter, project, useEliminations } = req.query;
  const cacheKey = CacheService.makeKey('income', req.query);
  const data = await CacheService.getOrSet(cacheKey, () => {
    const engine = new ConsolidationEngine();
    return engine.getIncomeStatement({ 
      companyIds, dateFrom, dateTo, years, year, costCenter, project,
      useEliminations: useEliminations === 'true'
    });
  });
  res.json(data);
});

router.get('/reports/balance-sheet', async (req, res) => {
  const companyIds = parseCompanyIds(req.query);
  const { asOfDate, costCenter, useEliminations, fiscalYear } = req.query;
  const cacheKey = CacheService.makeKey('balance', req.query);
  const data = await CacheService.getOrSet(cacheKey, () => {
    const engine = new ConsolidationEngine();
    return engine.getBalanceSheet({ 
      companyIds, asOfDate, costCenter,
      useEliminations: useEliminations === 'true',
      fiscalYear
    });
  });
  res.json(data);
});

router.get('/reports/cash-flow', async (req, res) => {
  const companyIds = parseCompanyIds(req.query);
  const { dateFrom, dateTo } = req.query;
  const cacheKey = CacheService.makeKey('cashflow', req.query);
  const data = await CacheService.getOrSet(cacheKey, () => {
    const engine = new ConsolidationEngine();
    return engine.getCashFlow({ companyIds, dateFrom, dateTo });
  });
  res.json(data);
});

router.get('/reports/pivot', async (req, res) => {
  const companyIds = parseCompanyIds(req.query);
  const { dateFrom, dateTo, measure } = req.query;
  const rows = req.query.rows ? req.query.rows.split(',') : ['account'];
  const columns = req.query.columns ? req.query.columns.split(',') : ['period'];
  const cacheKey = CacheService.makeKey('pivot', req.query);
  try {
    const data = await CacheService.getOrSet(cacheKey, () => {
      const engine = new ConsolidationEngine();
      return engine.getPivotData({ companyIds, dateFrom, dateTo, rows, columns, measure });
    });
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/reports/trial-balance', async (req, res) => {
  const { companyId, dateFrom, dateTo, costCenter } = req.query;
  const cacheKey = CacheService.makeKey('trial-balance', req.query);
  const data = await CacheService.getOrSet(cacheKey, () => {
    const engine = new ConsolidationEngine();
    return engine.getTrialBalance({ companyId: companyId ? parseInt(companyId) : null, dateFrom, dateTo, costCenter });
  });
  res.json(data);
});

// ===== PARTNER ACCOUNT CONFIG =====
const ACCOUNT_CATEGORIES = ['receivable', 'payable', 'employee_custody', 'employee_advance'];
const CATEGORY_LABELS = {
  receivable: 'الذمم المدينة',
  payable: 'الذمم الدائنة',
  employee_custody: 'عهد الموظفين',
  employee_advance: 'سلف الموظفين',
};

router.get('/partner-account-config', (req, res) => {
  try {
    const { companyId } = req.query;
    const { getDb } = require('../db/connection');
    const db = getDb();
    
    // Get saved config for this company (or all companies)
    let configs;
    if (companyId) {
      configs = db.prepare('SELECT * FROM partner_account_config WHERE company_id = ?').all(parseInt(companyId));
    } else {
      configs = db.prepare('SELECT * FROM partner_account_config ORDER BY company_id').all();
    }

    // Get all distinct accounts for dropdown selection
    let availableAccounts = [];
    if (companyId) {
      availableAccounts = db.prepare(`
        SELECT DISTINCT account_code, MIN(account_name) as account_name
        FROM journal_items
        WHERE company_id = ? AND move_state = 'posted'
        GROUP BY account_code ORDER BY account_code
      `).all(parseInt(companyId));
    }

    res.json({ configs, categories: ACCOUNT_CATEGORIES, labels: CATEGORY_LABELS, availableAccounts });
  } catch (err) {
    console.error('Partner config error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/partner-account-config', (req, res) => {
  try {
    const { companyId, mappings } = req.body;
    if (!companyId || !mappings) return res.status(400).json({ error: 'Missing data' });
    
    const { getDb } = require('../db/connection');
    const db = getDb();
    
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO partner_account_config (company_id, account_category, account_code, account_name)
      VALUES (?, ?, ?, ?)
    `);
    
    const saveAll = db.transaction((items) => {
      for (const m of items) {
        if (m.account_code) {
          stmt.run(parseInt(companyId), m.category, m.account_code, m.account_name || '');
        }
      }
    });
    
    saveAll(mappings);
    CacheService.flush();
    res.json({ success: true });
  } catch (err) {
    console.error('Save partner config error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== ANALYTIC ACCOUNT GROUPS =====

// Get all groups
router.get('/analytic-groups', (req, res) => {
  try {
    const { getDb } = require('../db/connection');
    const db = getDb();
    const groups = db.prepare('SELECT * FROM analytic_groups ORDER BY sort_order, name').all();
    res.json(groups);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Create a group
router.post('/analytic-groups', (req, res) => {
  try {
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: 'اسم المجموعة مطلوب' });
    const { getDb } = require('../db/connection');
    const db = getDb();
    const result = db.prepare('INSERT INTO analytic_groups (name, color) VALUES (?, ?)').run(name, color || '#3b82f6');
    CacheService.flush();
    res.json({ success: true, id: result.lastInsertRowid });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Update a group
router.put('/analytic-groups/:id', (req, res) => {
  try {
    const { name, color, sort_order } = req.body;
    const { getDb } = require('../db/connection');
    const db = getDb();
    db.prepare('UPDATE analytic_groups SET name = COALESCE(?, name), color = COALESCE(?, color), sort_order = COALESCE(?, sort_order) WHERE id = ?')
      .run(name, color, sort_order, req.params.id);
    CacheService.flush();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete a group
router.delete('/analytic-groups/:id', (req, res) => {
  try {
    const { getDb } = require('../db/connection');
    const db = getDb();
    db.prepare('DELETE FROM analytic_groups WHERE id = ?').run(req.params.id);
    CacheService.flush();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get distinct analytic accounts for a company
router.get('/analytic-accounts', (req, res) => {
  try {
    const { companyId } = req.query;
    if (!companyId) return res.status(400).json({ error: 'companyId required' });
    const { getDb } = require('../db/connection');
    const db = getDb();
    const accounts = db.prepare(`
      SELECT DISTINCT analytic_account, COUNT(*) as transaction_count
      FROM journal_items
      WHERE company_id = ? AND analytic_account IS NOT NULL AND analytic_account != ''
        AND move_state = 'posted'
      GROUP BY analytic_account
      ORDER BY analytic_account
    `).all(parseInt(companyId));
    res.json(accounts);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get group mappings for a company
router.get('/analytic-group-mappings', (req, res) => {
  try {
    const { companyId } = req.query;
    const { getDb } = require('../db/connection');
    const db = getDb();
    let mappings;
    if (companyId) {
      mappings = db.prepare(`
        SELECT m.*, m.redistributable, m.journal_name, g.name as group_name, g.color as group_color
        FROM analytic_group_mapping m
        JOIN analytic_groups g ON g.id = m.group_id
        WHERE m.company_id = ?
        ORDER BY g.sort_order, g.name
      `).all(parseInt(companyId));
    } else {
      mappings = db.prepare(`
        SELECT m.*, m.redistributable, m.journal_name, g.name as group_name, g.color as group_color
        FROM analytic_group_mapping m
        JOIN analytic_groups g ON g.id = m.group_id
        ORDER BY m.company_id, g.sort_order
      `).all();
    }
    res.json(mappings);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Save group mapping  
router.post('/analytic-group-mappings', (req, res) => {
  try {
    const { companyId, mappings } = req.body;
    if (!companyId || !mappings) return res.status(400).json({ error: 'Missing data' });
    const { getDb } = require('../db/connection');
    const db = getDb();
    
    const deleteStmt = db.prepare('DELETE FROM analytic_group_mapping WHERE company_id = ?');
    const insertStmt = db.prepare('INSERT INTO analytic_group_mapping (company_id, analytic_account, group_id, redistributable, journal_name, journal_id) VALUES (?, ?, ?, ?, ?, ?)');
    
    const findJidStmt = db.prepare(`
      SELECT COALESCE(
        (SELECT journal_id FROM sales_invoices WHERE company_id = ? AND (TRIM(journal_name) = ? OR journal_name = ?) AND journal_id > 0 LIMIT 1),
        (SELECT invoice_journal_id FROM payment_allocations WHERE company_id = ? AND (TRIM(invoice_journal_name) = ? OR invoice_journal_name = ?) AND invoice_journal_id > 0 LIMIT 1),
        (SELECT journal_id FROM journal_items WHERE company_id = ? AND (TRIM(journal_name) = ? OR journal_name = ?) AND journal_id > 0 LIMIT 1)
      ) as jid
    `);

    db.transaction(() => {
      deleteStmt.run(parseInt(companyId));
      for (const m of mappings) {
        if (m.analytic_account && m.group_id) {
          let jid = m.journal_id ? parseInt(m.journal_id) : null;
          if (!jid && m.journal_name) {
            const clean = (m.journal_name || '').trim();
            const r = findJidStmt.get(companyId, clean, m.journal_name, companyId, clean, m.journal_name, companyId, clean, m.journal_name);
            if (r?.jid) jid = r.jid;
          }
          insertStmt.run(parseInt(companyId), m.analytic_account, parseInt(m.group_id), m.redistributable ? 1 : 0, m.journal_name || null, jid);
        }
      }
    })();
    
    CacheService.flush();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get distinct journal names from journal items
router.get('/company-journal-names', (req, res) => {
  try {
    const { companyId } = req.query;
    if (!companyId) return res.status(400).json({ error: 'companyId required' });
    const { getDb } = require('../db/connection');
    const db = getDb();
    const rows = db.prepare('SELECT DISTINCT journal_name FROM journal_items WHERE company_id = ? AND journal_name IS NOT NULL AND journal_name != \'\' ORDER BY journal_name').all(parseInt(companyId));
    res.json(rows.map(r => r.journal_name));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get journal names with counts & mappings for consolidation
router.get('/journal-mappings', (req, res) => {
  try {
    const { companyId } = req.query;
    if (!companyId) return res.status(400).json({ error: 'companyId required' });
    const { getDb } = require('../db/connection');
    const db = getDb();
    
    // Get unique journal names directly from items to see what currently exists
    const journals = db.prepare(`
      SELECT journal_name, COUNT(*) as count 
      FROM journal_items 
      WHERE company_id = ? AND journal_name IS NOT NULL AND journal_name != ''
      GROUP BY journal_name
      ORDER BY journal_name
    `).all(parseInt(companyId));
    
    // Get stored mappings
    const mappings = db.prepare('SELECT * FROM journal_name_mappings WHERE company_id = ?').all(parseInt(companyId));
    
    res.json({ journals, mappings });
  } catch (err) { 
    console.error('journal-mappings error:', err);
    res.status(500).json({ error: err.message }); 
  }
});

// Perform manual journal name merge
router.post('/journal-mappings/merge', (req, res) => {
  try {
    const { companyId, sourceNames, targetName } = req.body;
    if (!companyId || !sourceNames || !sourceNames.length || !targetName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const { getDb } = require('../db/connection');
    const db = getDb();
    
    const insertMappingStmt = db.prepare(`
      INSERT OR REPLACE INTO journal_name_mappings (company_id, original_name, mapped_name)
      VALUES (?, ?, ?)
    `);
    
    // Create params for the IN clause
    const placeholders = sourceNames.map(() => '?').join(',');
    const updateJournalItemsStmt = db.prepare(`
      UPDATE journal_items
      SET journal_name = ?
      WHERE company_id = ? AND journal_name IN (${placeholders})
    `);
    
    const updateAnalyticMappingStmt = db.prepare(`
      UPDATE analytic_group_mapping
      SET journal_name = ?
      WHERE company_id = ? AND journal_name IN (${placeholders})
    `);
    
    db.transaction(() => {
      // 1. Add mappings so future syncs use the new targetName
      for (const name of sourceNames) {
        if (name !== targetName) {
          insertMappingStmt.run(companyId, name, targetName);
        }
      }
      
      // 2. Update existing journal items
      const updateParams = [targetName, companyId, ...sourceNames];
      updateJournalItemsStmt.run(...updateParams);
      
      // 3. Update existing analytic mapping journals
      updateAnalyticMappingStmt.run(...updateParams);
    })();
    
    // Flush cache to ensure dashboard/reports pick up the changes
    const CacheService = require('../services/cache');
    CacheService.flush();
    
    res.json({ success: true, targetName });
  } catch (err) { 
    console.error('Merge journals error:', err);
    res.status(500).json({ error: err.message }); 
  }
});
// Detailed trial balance by partner
router.get('/reports/detailed-trial-balance', (req, res) => {
  try {
    const { companyId, dateFrom, dateTo, accountCodes } = req.query;
    if (!companyId || !dateFrom || !dateTo) {
      return res.status(400).json({ error: 'Missing required params' });
    }
    
    const engine = new ConsolidationEngine();
    const result = engine.getDetailedTrialBalance({
      companyId,
      dateFrom,
      dateTo,
      accountCodes
    });
    
    res.json(result);
  } catch (err) {
    console.error('Detailed trial balance error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== CLOSING ENTRIES =====
router.post('/closing-entry', (req, res) => {
  try {
    const { companyId, dateFrom, dateTo, targetAccount, targetAccountName, lines } = req.body;
    if (!companyId || !dateFrom || !dateTo || !targetAccount || !lines?.length) {
      return res.status(400).json({ error: 'بيانات ناقصة' });
    }

    const { getDb } = require('../db/connection');
    const db = getDb();
    const fiscalYear = dateFrom.substring(0, 4);
    const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0);
    const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0);

    // Upsert: delete old then insert new
    db.prepare(`DELETE FROM closing_entries WHERE company_id = @companyId AND fiscal_year = @fiscalYear`)
      .run({ companyId: parseInt(companyId), fiscalYear });

    db.prepare(`
      INSERT INTO closing_entries (company_id, fiscal_year, date_from, date_to, target_account, target_account_name, lines_json, total_debit, total_credit)
      VALUES (@companyId, @fiscalYear, @dateFrom, @dateTo, @targetAccount, @targetAccountName, @linesJson, @totalDebit, @totalCredit)
    `).run({
      companyId: parseInt(companyId),
      fiscalYear, dateFrom, dateTo, targetAccount,
      targetAccountName: targetAccountName || '',
      linesJson: JSON.stringify(lines),
      totalDebit, totalCredit,
    });

    CacheService.flush();
    res.json({ success: true, linesCount: lines.length, fiscalYear });
  } catch (err) {
    console.error('Closing entry error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete closing entry
router.delete('/closing-entry', (req, res) => {
  try {
    const { companyId, fiscalYear } = req.query;
    if (!companyId || !fiscalYear) return res.status(400).json({ error: 'بيانات ناقصة' });

    const { getDb } = require('../db/connection');
    const db = getDb();
    const result = db.prepare(`DELETE FROM closing_entries WHERE company_id = @companyId AND fiscal_year = @fiscalYear`)
      .run({ companyId: parseInt(companyId), fiscalYear });

    CacheService.flush();
    res.json({ success: true, deleted: result.changes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List closing entries
router.get('/closing-entries', (req, res) => {
  try {
    const { companyId } = req.query;
    const { getDb } = require('../db/connection');
    const db = getDb();

    let filter = '';
    const params = {};
    if (companyId) {
      filter = 'AND ce.company_id = @companyId';
      params.companyId = parseInt(companyId);
    }

    const entries = db.prepare(`
      SELECT ce.*, c.name as company_name
      FROM closing_entries ce
      LEFT JOIN companies c ON c.id = ce.company_id
      WHERE 1=1 ${filter}
      ORDER BY ce.company_id, ce.fiscal_year DESC
    `).all(params);

    for (const entry of entries) {
      entry.lines = JSON.parse(entry.lines_json || '[]');
      delete entry.lines_json;
    }

    res.json({ entries });
  } catch (err) {
    console.error('List closing entries error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all accounts for a company (for closing entry dropdown)
router.get('/company-accounts', (req, res) => {
  try {
    const { companyId } = req.query;
    if (!companyId) return res.status(400).json({ error: 'companyId required' });

    const { getDb } = require('../db/connection');
    const db = getDb();
    const cid = parseInt(companyId);

    // Get ALL unique accounts from both journal_items and company_accounts
    const accounts = db.prepare(`
      SELECT account_code, account_name, account_type FROM (
        SELECT ji.account_code, MIN(ji.account_name) as account_name, ji.account_type
        FROM journal_items ji
        WHERE ji.company_id = @companyId
          AND (ji.move_name IS NULL OR ji.move_name NOT LIKE 'CLOSING/%')
        GROUP BY ji.account_code
        UNION
        SELECT ca.code as account_code, ca.name as account_name, ca.account_type
        FROM company_accounts ca
        WHERE ca.company_id = @companyId
      )
      GROUP BY account_code
      ORDER BY account_code
    `).all({ companyId: cid });

    res.json({ accounts });
  } catch (err) {
    console.error('Company accounts error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== FILTERS =====
router.get('/filters', async (req, res) => {
  const companyIds = parseCompanyIds(req.query);
  const cacheKey = CacheService.makeKey('filters', { companyIds });
  const data = await CacheService.getOrSet(cacheKey, () => {
    const engine = new ConsolidationEngine();
    return engine.getFilterOptions({ companyIds });
  });
  res.json(data);
});

// ===== TREE SEARCH (F1-b) =====
router.get('/search/tree', (req, res) => {
  try {
    const { query, dateFrom, dateTo } = req.query;
    const companyIds = parseCompanyIds(req.query);
    const years = parseYearsParam(req);
    const engine = new ConsolidationEngine();
    const result = engine.searchHierarchyPaths({ companyIds, years, dateFrom, dateTo, query });
    res.json(result);
  } catch (err) {
    console.error('[API /search/tree] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== ACCOUNTS & MAPPING =====
router.get('/accounts/company/:companyId', (req, res) => {
  const db = getDb();
  const accounts = db.prepare(`
    SELECT ca.*, ua.code as unified_code, ua.name_ar as unified_name
    FROM company_accounts ca
    LEFT JOIN unified_accounts ua ON ua.id = ca.unified_account_id
    WHERE ca.company_id = ?
    ORDER BY ca.code
  `).all(req.params.companyId);
  res.json(accounts);
});

router.get('/accounts/unified', (req, res) => {
  const db = getDb();
  const accounts = db.prepare('SELECT * FROM unified_accounts ORDER BY code').all();
  res.json(accounts);
});

router.post('/accounts/unified', (req, res) => {
  const db = getDb();
  const { code, name_ar, name_en, account_type, parent_id, is_group, sort_order } = req.body;
  const result = db.prepare(`
    INSERT INTO unified_accounts (code, name_ar, name_en, account_type, parent_id, is_group, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(code, name_ar, name_en || '', account_type, parent_id || null, is_group || 0, sort_order || 0);
  CacheService.flush();
  res.json({ id: result.lastInsertRowid, success: true });
});

router.post('/accounts/mapping', (req, res) => {
  const db = getDb();
  const { company_account_id, unified_account_id } = req.body;
  db.prepare(`
    UPDATE company_accounts SET unified_account_id = ?, is_mapped = 1 WHERE id = ?
  `).run(unified_account_id, company_account_id);
  
  // Also update journal items with this account's unified mapping
  const account = db.prepare('SELECT * FROM company_accounts WHERE id = ?').get(company_account_id);
  if (account) {
    db.prepare(`
      UPDATE journal_items SET unified_account_id = ? 
      WHERE company_id = ? AND account_code = ?
    `).run(unified_account_id, account.company_id, account.code);
  }
  
  CacheService.flush();
  res.json({ success: true });
});

// ===== ELIMINATION RULES =====
router.get('/eliminations', (req, res) => {
  const db = getDb();
  const rules = db.prepare(`
    SELECT er.*, 
      sc.name as source_company_name, 
      tc.name as target_company_name
    FROM elimination_rules er
    LEFT JOIN companies sc ON sc.id = er.source_company_id
    LEFT JOIN companies tc ON tc.id = er.target_company_id
    ORDER BY er.created_at DESC
  `).all();
  res.json(rules);
});

router.post('/eliminations', (req, res) => {
  const db = getDb();
  const { name, description, rule_type, source_company_id, target_company_id, source_account_code, target_account_code } = req.body;
  const result = db.prepare(`
    INSERT INTO elimination_rules (name, description, rule_type, source_company_id, target_company_id, source_account_code, target_account_code)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(name, description || '', rule_type || 'account_match', source_company_id, target_company_id, source_account_code, target_account_code);
  CacheService.flush();
  res.json({ id: result.lastInsertRowid, success: true });
});

// ===== SYNC (singleton engine for progress tracking) =====
let syncEngineInstance = null;
function getSyncEngine() {
  if (!syncEngineInstance) syncEngineInstance = new SyncEngine();
  return syncEngineInstance;
}

// Quick test connection with provided credentials (no save required)
router.post('/test-connection', async (req, res) => {
  try {
    const { url, username, password, db_name, company_id } = req.body;
    if (!url || !username || !password) {
      return res.status(400).json({ success: false, message: 'يجب تقديم الرابط واسم المستخدم وكلمة المرور' });
    }
    const connector = new OdooConnector(url, username, password, db_name);
    const result = await connector.testConnection(company_id || 1);
    res.json(result);
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

router.post('/sync/company/:companyId', async (req, res) => {
  try {
    const engine = getSyncEngine();
    // Start sync in background, return immediately
    const companyId = parseInt(req.params.companyId);
    res.json({ started: true, message: 'بدأت عملية المزامنة' });

    // Run sync after response
    engine.syncCompany(companyId).then(result => {
      CacheService.flush();
      console.log(`[API] Sync completed for company ${companyId}:`, result);
    }).catch(err => {
      console.error(`[API] Sync failed for company ${companyId}:`, err.message);
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sync/progress/:companyId', (req, res) => {
  const engine = getSyncEngine();
  const progress = engine.getProgress(parseInt(req.params.companyId));
  res.json(progress);
});

router.post('/sync/all', async (req, res) => {
  try {
    const engine = getSyncEngine();
    res.json({ started: true, message: 'بدأت المزامنة الموحدة لجميع الشركات (القيود، الفواتير، التسويات، والأقسام)' });
    
    engine.syncAllUnified().then(results => {
      console.log('[API] Unified sync completed:', results);
    }).catch(err => {
      console.error('[API] Unified sync failed:', err.message);
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sync/latest-status', (req, res) => {
  try {
    const { getDb } = require('../db/connection');
    const db = getDb();
    const s1 = db.prepare("SELECT MAX(completed_at) as t FROM sync_logs WHERE status = 'completed' AND (sync_type IS NULL OR sync_type = 'full')").get()?.t || null;
    const s2 = db.prepare("SELECT MAX(completed_at) as t FROM sales_sync_logs WHERE status = 'completed'").get()?.t || null;
    const s3 = db.prepare("SELECT MAX(completed_at) as t FROM sync_logs WHERE status = 'completed' AND sync_type = 'payment_allocations'").get()?.t
      || db.prepare("SELECT MAX(created_at) as t FROM payment_allocations").get()?.t || null;
    
    const timestamps = [s1, s2, s3].filter(Boolean);
    let earliest = null;
    if (timestamps.length > 0) {
      earliest = timestamps.reduce((min, t) => (t < min ? t : min), timestamps[0]);
    }

    res.json({
      earliest,
      stages: {
        journal_items: { label: 'قيود اليومية', timestamp: s1 },
        sales_invoices: { label: 'فواتير المبيعات', timestamp: s2 },
        payment_allocations: { label: 'تسويات السداد', timestamp: s3 }
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sync/status', (req, res) => {
  const engine = getSyncEngine();
  res.json(engine.getSyncStatus());
});

// ===== SYNC SCHEDULE MANAGEMENT =====
router.get('/sync/schedule', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare("SELECT key, value FROM app_settings WHERE key IN ('sync_enabled','sync_interval_hours')").all();
    const settings = {};
    for (const r of rows) settings[r.key] = r.value;
    const status = getSchedulerStatus();
    res.json({
      enabled: settings.sync_enabled === 'true',
      intervalHours: parseInt(settings.sync_interval_hours) || 2,
      running: status.running,
      schedule: status.schedule
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/sync/schedule', (req, res) => {
  try {
    const db = getDb();
    const { enabled, intervalHours } = req.body;
    const en = enabled ? 'true' : 'false';
    const hrs = parseInt(intervalHours) || 2;
    db.prepare("INSERT INTO app_settings (key, value, updated_at) VALUES ('sync_enabled', ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at").run(en);
    db.prepare("INSERT INTO app_settings (key, value, updated_at) VALUES ('sync_interval_hours', ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at").run(String(hrs));
    reschedule(hrs, enabled);
    const status = getSchedulerStatus();
    res.json({ success: true, enabled: enabled, intervalHours: hrs, running: status.running, schedule: status.schedule });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/sync/notifications', (req, res) => {
  try {
    const db = getDb();
    const notifications = db.prepare('SELECT * FROM sync_notifications ORDER BY id DESC LIMIT 20').all();
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/sync/notifications', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM sync_notifications').run();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ===== JOURNAL ITEMS (raw data) =====
router.get('/journal-items', (req, res) => {
  const db = getDb();
  const companyIds = parseCompanyIds(req.query);
  const { dateFrom, dateTo, accountCode, accountType, analyticAccount, search, limit, offset } = req.query;
  
  let where = ['1=1'];
  const params = {};
  
  if (companyIds && companyIds.length) {
    where.push(`company_id IN (${companyIds.map((_, i) => `@c${i}`).join(',')})`);
    companyIds.forEach((id, i) => { params[`c${i}`] = id; });
  }
  if (dateFrom) { where.push('date >= @dateFrom'); params.dateFrom = dateFrom; }
  if (dateTo) { where.push('date <= @dateTo'); params.dateTo = dateTo; }
  if (accountCode) { where.push('account_code = @accountCode'); params.accountCode = accountCode; }
  if (accountType) { where.push('account_type = @accountType'); params.accountType = accountType; }
  if (analyticAccount) { where.push('analytic_account = @analyticAccount'); params.analyticAccount = analyticAccount; }
  if (search) { 
    where.push(`(account_name LIKE @search OR account_code LIKE @search OR partner_name LIKE @search OR move_name LIKE @search OR analytic_account LIKE @search)`);
    params.search = `%${search}%`;
  }

  const total = db.prepare(`SELECT COUNT(*) as count FROM journal_items WHERE ${where.join(' AND ')}`).get(params);
  
  const items = db.prepare(`
    SELECT ji.*, c.name as company_name 
    FROM journal_items ji
    JOIN companies c ON c.id = ji.company_id
    WHERE ${where.join(' AND ')}
    ORDER BY ji.date DESC, ji.id DESC
    LIMIT @limit OFFSET @offset
  `).all({ ...params, limit: parseInt(limit) || 50, offset: parseInt(offset) || 0 });

  // Get distinct account types and analytic accounts for filtering
  const accountTypes = db.prepare(`SELECT DISTINCT account_type FROM journal_items WHERE account_type != '' ORDER BY account_type`).all();
  const analyticAccounts = db.prepare(`SELECT DISTINCT analytic_account FROM journal_items WHERE analytic_account IS NOT NULL AND analytic_account != '' ORDER BY analytic_account`).all();

  res.json({ items, total: total.count, accountTypes: accountTypes.map(a => a.account_type), analyticAccounts: analyticAccounts.map(a => a.analytic_account) });
});

// ===== VAT REPORT =====
router.get('/vat-report', (req, res) => {
  try {
    const db = getDb();
    const companyIds = parseCompanyIds(req.query);
    const { year, period } = req.query; // period: monthly | quarterly | annual

    if (!companyIds?.length || !year) {
      return res.status(400).json({ error: 'companyIds and year are required' });
    }

    const coPlaceholders = companyIds.map((_, i) => `@c${i}`).join(',');
    const params = {};
    companyIds.forEach((id, i) => { params[`c${i}`] = id; });
    params.yearStart = `${year}-01-01`;
    params.yearEnd = `${year}-12-31`;

    // Query all tax-related journal items for the selected companies and year
    // We only want posted entries during the year, excluding closing/opening entries and draft records
    const taxItems = db.prepare(`
      SELECT ji.company_id, c.name as company_name,
             ji.account_code, ji.account_name, ji.debit, ji.credit, ji.date, ji.period,
             ji.partner_name, ji.move_name, ji.move_ref as ref, ji.label
      FROM journal_items ji
      JOIN companies c ON c.id = ji.company_id
      WHERE ji.company_id IN (${coPlaceholders})
        AND ji.date >= @yearStart AND ji.date <= @yearEnd
        AND ji.move_state = 'posted'
        AND (ji.move_name IS NULL OR (ji.move_name NOT LIKE 'CLOSING/%' AND ji.move_name NOT LIKE '%OPN%'))
        AND (ji.account_name LIKE '%مدخلات%' OR ji.account_name LIKE '%مخرجات%')
        AND ji.account_name LIKE '%ضريب%'
      ORDER BY ji.date
    `).all(params);

    // Classify: input VAT (مدخلات) vs output VAT (مخرجات)
    const periodMode = period || 'monthly';
    const periodsMap = {};

    for (const item of taxItems) {
      let periodKey;
      const month = item.date?.substring(0, 7) || ''; // YYYY-MM
      const monthNum = parseInt(item.date?.substring(5, 7) || '1');

      if (periodMode === 'monthly') {
        periodKey = month;
      } else if (periodMode === 'quarterly') {
        const q = Math.ceil(monthNum / 3);
        periodKey = `${year}-Q${q}`;
      } else {
        periodKey = year;
      }

      if (!periodsMap[periodKey]) {
        periodsMap[periodKey] = { period: periodKey, inputVAT: 0, outputVAT: 0, items: [] };
      }

      const p = periodsMap[periodKey];
      const accName = (item.account_name || '').trim();
      const isInput = accName.includes('مدخلات');
      const isOutput = accName.includes('مخرجات');

      // Only process valid Input/Output accounts
      if (isInput || isOutput) {
        const type = isInput ? 'input' : 'output';
        const amount = isInput ? ((item.debit || 0) - (item.credit || 0)) : ((item.credit || 0) - (item.debit || 0));

        if (isInput) p.inputVAT += amount;
        else p.outputVAT += amount;

        // Add to details
        p.items.push({
          date: item.date,
          company: item.company_name,
          account: item.account_name,
          type: type,
          amount: amount,
          journalEntry: item.move_name,
          partner: item.partner_name || '',
          label: item.label || item.ref || ''
        });
      }
    }

    // Build sorted periods array
    const periods = Object.values(periodsMap).sort((a, b) => a.period.localeCompare(b.period));

    // Compute net for each period
    periods.forEach(p => {
      p.netVAT = p.outputVAT - p.inputVAT;
      p.inputVAT = Math.round(p.inputVAT * 100) / 100;
      p.outputVAT = Math.round(p.outputVAT * 100) / 100;
      p.netVAT = Math.round(p.netVAT * 100) / 100;
      p.items.sort((a, b) => (a.date > b.date ? 1 : -1));
    });

    // Summary
    const totalInput = periods.reduce((s, p) => s + p.inputVAT, 0);
    const totalOutput = periods.reduce((s, p) => s + p.outputVAT, 0);
    const totalNet = periods.reduce((s, p) => s + p.netVAT, 0);

    // Per-company breakdown
    const byCompany = {};
    for (const item of taxItems) {
      const cid = item.company_id;
      if (!byCompany[cid]) byCompany[cid] = { companyId: cid, companyName: item.company_name, inputVAT: 0, outputVAT: 0 };
      const accName = (item.account_name || '').trim();
      if (accName.includes('مدخلات')) {
        byCompany[cid].inputVAT += (item.debit || 0) - (item.credit || 0);
      } else if (accName.includes('مخرجات')) {
        byCompany[cid].outputVAT += (item.credit || 0) - (item.debit || 0);
      }
    }
    const companies = Object.values(byCompany).map(c => ({
      ...c,
      inputVAT: Math.round(c.inputVAT * 100) / 100,
      outputVAT: Math.round(c.outputVAT * 100) / 100,
      netVAT: Math.round((c.outputVAT - c.inputVAT) * 100) / 100
    }));

    res.json({
      year,
      periodMode,
      periods,
      companies,
      summary: {
        totalInput: Math.round(totalInput * 100) / 100,
        totalOutput: Math.round(totalOutput * 100) / 100,
        totalNet: Math.round(totalNet * 100) / 100
      }
    });
  } catch (err) {
    console.error('VAT report error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== TAX REPORT BUILDER (CUSTOM CONFIG) =====

router.get('/tax-report-config/:companyId', (req, res) => {
  try {
    const companyId = parseInt(req.params.companyId);
    if (isNaN(companyId)) return res.status(400).json({ error: 'Invalid company ID' });
    const db = getDb();
    
    // Fetch configuration
    const config = db.prepare('SELECT * FROM tax_report_config WHERE company_id = ?').get(companyId);
    
    let parsedConfig = { inputAccounts: [], outputAccounts: [], excludedJournals: [], excludedMoveNames: [] };
    if (config) {
      try {
        parsedConfig.inputAccounts = JSON.parse(config.input_accounts || '[]');
        parsedConfig.outputAccounts = JSON.parse(config.output_accounts || '[]');
        parsedConfig.excludedJournals = JSON.parse(config.excluded_journals || '[]');
        parsedConfig.excludedMoveNames = JSON.parse(config.excluded_move_names || '[]');
      } catch (e) {
        console.error('Error parsing tax report config JSON', e);
      }
    }

    // Fetch options for the builder
    const vatAccounts = db.prepare(`
      SELECT DISTINCT account_code, account_name 
      FROM journal_items 
      WHERE company_id = ? AND account_name LIKE '%ضريب%'
      ORDER BY account_code
    `).all(companyId);
    
    const journals = db.prepare(`
      SELECT DISTINCT journal_name 
      FROM journal_items 
      WHERE company_id = ? AND account_name LIKE '%ضريب%' AND journal_name IS NOT NULL AND journal_name != ''
      ORDER BY journal_name
    `).all(companyId);

    const moveNames = db.prepare(`
      SELECT move_name, 
             MAX(date) as date,
             MAX(journal_name) as journal,
             SUM(ABS(debit) + ABS(credit)) as total_vat,
             MAX(label) as label
      FROM journal_items 
      WHERE company_id = ? AND account_name LIKE '%ضريب%' AND move_name IS NOT NULL AND move_name != ''
      GROUP BY move_name
      ORDER BY total_vat DESC, date DESC
    `).all(companyId);

    res.json({
      config: parsedConfig,
      options: {
        vatAccounts,
        journals: journals.map(j => j.journal_name),
        moveNames
      }
    });
  } catch (err) {
    console.error('Get tax config error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/tax-report-config', (req, res) => {
  try {
    const { companyId, inputAccounts, outputAccounts, excludedJournals, excludedMoveNames } = req.body;
    if (!companyId) return res.status(400).json({ error: 'Company ID required' });
    
    const db = getDb();
    const stmt = db.prepare(`
      INSERT INTO tax_report_config (company_id, input_accounts, output_accounts, excluded_journals, excluded_move_names)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(company_id) DO UPDATE SET 
        input_accounts = excluded.input_accounts,
        output_accounts = excluded.output_accounts,
        excluded_journals = excluded.excluded_journals,
        excluded_move_names = excluded.excluded_move_names
    `);
    
    stmt.run(
      parseInt(companyId),
      JSON.stringify(inputAccounts || []),
      JSON.stringify(outputAccounts || []),
      JSON.stringify(excludedJournals || []),
      JSON.stringify(excludedMoveNames || [])
    );
    CacheService.flush();
    res.json({ success: true, message: 'Tax report configuration saved successfully' });
  } catch (err) {
    console.error('Save tax config error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/tax-report-custom', (req, res) => {
  try {
    const { companyId, year, period, inputAccounts, outputAccounts, excludedJournals, excludedMoveNames } = req.body;
    if (!companyId || !year) return res.status(400).json({ error: 'Missing parameters' });
    
    const db = getDb();
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    
    // Default to 'ضريب' if no specific accounts selected
    const allExpectedAccounts = [...(inputAccounts || []), ...(outputAccounts || [])];
    const hasSpecificAccounts = allExpectedAccounts.length > 0;
    
    let query = `
      SELECT ji.company_id, c.name as company_name,
             ji.account_code, ji.account_name, ji.debit, ji.credit, ji.date, ji.period,
             ji.partner_name, ji.move_name, ji.move_ref as ref, ji.label, ji.journal_name, ji.journal_type
      FROM journal_items ji
      JOIN companies c ON c.id = ji.company_id
      WHERE ji.company_id = ?
        AND ji.date >= ? AND ji.date <= ?
        AND ji.move_state = 'posted'
        AND ji.journal_type IN ('sale', 'purchase')
    `;
    
    const params = [parseInt(companyId), yearStart, yearEnd];
    
    if (hasSpecificAccounts) {
      const placeholders = allExpectedAccounts.map(() => '?').join(',');
      query += ` AND ji.account_name IN (${placeholders})`;
      allExpectedAccounts.forEach(acc => params.push(acc));
    } else {
      query += ` AND ji.account_name LIKE '%ضريب%'`;
    }

    query += ` ORDER BY ji.date`;
    
    const taxItems = db.prepare(query).all(params);
    
    // Grouping
    const periodMode = period || 'monthly';
    const periodsMap = {};
    
    for (const item of taxItems) {
      const monthNum = parseInt(item.date?.substring(5, 7) || '1');
      let periodKey = year;
      if (periodMode === 'monthly') periodKey = item.date?.substring(0, 7) || '';
      else if (periodMode === 'quarterly') periodKey = `${year}-Q${Math.ceil(monthNum / 3)}`;
      
      if (!periodsMap[periodKey]) {
        periodsMap[periodKey] = { 
          period: periodKey, 
          inputBase: 0, inputRefund: 0, inputVAT: 0, 
          outputBase: 0, outputRefund: 0, outputVAT: 0, 
          items: [] 
        };
      }
      
      const p = periodsMap[periodKey];
      const accName = (item.account_name || '').trim();
      
      const isInput = item.journal_type === 'purchase';
      const isOutput = item.journal_type === 'sale';

      if (hasSpecificAccounts) {
        // Enforce exact matching per side
        if (isInput && !(inputAccounts || []).includes(accName)) continue;
        if (isOutput && !(outputAccounts || []).includes(accName)) continue;
      }

      const type = isInput ? 'input' : 'output';
      
      let baseAmount = 0;
      let refundAmount = 0;
      
      if (isOutput) {
        baseAmount = item.credit || 0;
        refundAmount = item.debit || 0;
      } else {
        baseAmount = item.debit || 0;
        refundAmount = item.credit || 0;
      }
      
      const netAmount = baseAmount - refundAmount;
      
      if (isInput) {
        p.inputBase += baseAmount;
        p.inputRefund += refundAmount;
        p.inputVAT += netAmount;
      } else {
        p.outputBase += baseAmount;
        p.outputRefund += refundAmount;
        p.outputVAT += netAmount;
      }
      
      p.items.push({ 
        date: item.date, company: item.company_name, account: item.account_name, 
        type, baseAmount, refundAmount, netAmount,
        journalEntry: item.move_name, partner: item.partner_name || '', label: item.label || '' 
      });
    }
    
    const periodsArr = Object.values(periodsMap).sort((a,b) => a.period.localeCompare(b.period));
    periodsArr.forEach(p => {
      p.netVAT = Math.round((p.outputVAT - p.inputVAT)*100)/100;
      p.inputVAT = Math.round(p.inputVAT*100)/100;
      p.outputVAT = Math.round(p.outputVAT*100)/100;
      p.inputBase = Math.round(p.inputBase*100)/100;
      p.inputRefund = Math.round(p.inputRefund*100)/100;
      p.outputBase = Math.round(p.outputBase*100)/100;
      p.outputRefund = Math.round(p.outputRefund*100)/100;
    });
    
    res.json({
      year, periodMode, periods: periodsArr,
      summary: {
        totalInputBase: Math.round(periodsArr.reduce((s,p)=>s+p.inputBase,0)*100)/100,
        totalInputRefund: Math.round(periodsArr.reduce((s,p)=>s+p.inputRefund,0)*100)/100,
        totalInput: Math.round(periodsArr.reduce((s,p)=>s+p.inputVAT,0)*100)/100,
        totalOutputBase: Math.round(periodsArr.reduce((s,p)=>s+p.outputBase,0)*100)/100,
        totalOutputRefund: Math.round(periodsArr.reduce((s,p)=>s+p.outputRefund,0)*100)/100,
        totalOutput: Math.round(periodsArr.reduce((s,p)=>s+p.outputVAT,0)*100)/100,
        totalNet: Math.round(periodsArr.reduce((s,p)=>s+p.netVAT,0)*100)/100
      }
    });
  } catch(err) {
    console.error('Custom VAT error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==============================================
// ===== HELPER: PARSE & VALIDATE YEARS (YR1) =====
// ==============================================
function parseYearsParam(req) {
  const raw = req.query.years || req.query.year;
  if (!raw) return undefined;
  if (raw === 'ALL' || raw === 'all') return 'ALL';
  const list = Array.isArray(raw) ? raw : String(raw).split(',');
  const years = [];
  for (const item of list) {
    const trimmed = String(item).trim();
    if (!trimmed) continue;
    if (trimmed === 'ALL' || trimmed === 'all') return 'ALL';
    if (!/^\d{4}$/.test(trimmed)) {
      const err = new Error('سنة غير صالحة: يجب أن تتكون السنة من 4 أرقام');
      err.statusCode = 400;
      throw err;
    }
    years.push(trimmed);
  }
  return years.length > 0 ? years : undefined;
}

// ==============================================
// ===== MATRIX REPORT ENGINE (M1) =====
// ==============================================

router.get('/matrix', (req, res) => {
  try {
    const {
      measure,
      rowDims,
      timeGrain,
      dateFrom,
      dateTo,
      companyIds,
      departmentIds,
      compare
    } = req.query;

    const years = parseYearsParam(req);
    const engine = new ConsolidationEngine();
    const result = engine.getMatrix({
      measure,
      rowDims: rowDims ? (Array.isArray(rowDims) ? rowDims : String(rowDims).split(',')) : undefined,
      timeGrain,
      dateFrom,
      dateTo,
      years,
      companyIds: companyIds ? (Array.isArray(companyIds) ? companyIds : String(companyIds).split(',')) : undefined,
      departmentIds: departmentIds ? (Array.isArray(departmentIds) ? departmentIds : String(departmentIds).split(',')) : undefined,
      compare
    });

    res.json(result);
  } catch (err) {
    if (err.statusCode === 400) return res.status(400).json({ error: err.message });
    console.error('[API /matrix] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==============================================
// ===== RECEIVABLES & COLLECTIONS ENGINE (M1a) =====
// ==============================================

router.get('/receivables', (req, res) => {
  try {
    const {
      type,
      companyIds,
      departmentIds,
      partnerId,
      partnerName,
      paymentState,
      dateFrom,
      dateTo,
      timeGrain,
      search,
      sortBy,
      sortOrder,
      page,
      limit,
      asOfDate
    } = req.query;

    const years = parseYearsParam(req);
    const engine = new ConsolidationEngine();
    const result = engine.getReceivables({
      type: type || 'registry',
      companyIds: companyIds ? (Array.isArray(companyIds) ? companyIds : String(companyIds).split(',')) : undefined,
      departmentIds: departmentIds ? (Array.isArray(departmentIds) ? departmentIds : String(departmentIds).split(',')) : undefined,
      partnerId: partnerId ? parseInt(partnerId) : undefined,
      partnerName: partnerName || undefined,
      paymentState: paymentState ? (Array.isArray(paymentState) ? paymentState : String(paymentState).split(',')) : undefined,
      years,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      timeGrain: timeGrain || 'month',
      search: search || undefined,
      sortBy: sortBy || 'date',
      sortOrder: sortOrder || 'desc',
      page: page ? parseInt(page) : 1,
      limit: limit !== undefined ? (limit === 'all' ? 'all' : parseInt(limit)) : 50,
      asOfDate: asOfDate || undefined,
      includePaid: req.query.includePaid === 'true'
    });

    res.json(result);
  } catch (err) {
    if (err.statusCode === 400) return res.status(400).json({ error: err.message });
    console.error('[API /receivables] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==============================================
// ===== PERFORMANCE SUMMARY (H1-fix) =====
// ==============================================

router.get('/performance-summary', async (req, res) => {
  try {
    const { companyIds, dateFrom, dateTo } = req.query;
    const years = parseYearsParam(req);
    const cacheKey = CacheService.makeKey('performance-summary', { companyIds, years, dateFrom, dateTo });
    const result = await CacheService.getOrSet(cacheKey, () => {
      const engine = new ConsolidationEngine();
      return engine.getPerformanceSummary({
        companyIds: companyIds ? (Array.isArray(companyIds) ? companyIds : String(companyIds).split(',')) : undefined,
        years,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined
      });
    });
    res.json(result);
  } catch (err) {
    if (err.statusCode === 400) return res.status(400).json({ error: err.message });
    console.error('[API /performance-summary] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==============================================
// ===== EXECUTIVE DASHBOARD (لوحة الإدارة الموحدة) =====
// ==============================================

router.get('/executive', async (req, res) => {
  try {
    const { companyIds, dateFrom, dateTo, asOfDate, fullTree, includeAging, groupIds, departmentIds, journalIds, costCenters } = req.query;
    const years = parseYearsParam(req);
    const isFullTree = fullTree === 'true';
    const isIncludeAging = includeAging === 'true';
    const dIds = departmentIds || groupIds;
    const targetJournals = costCenters || journalIds;
    const jIds = targetJournals ? (Array.isArray(targetJournals) ? targetJournals : String(targetJournals).split(',')).map(s => (typeof s === 'string' ? s.trim() : s)).filter(Boolean) : undefined;
    const cacheKey = CacheService.makeKey('executive', { companyIds, years, dateFrom, dateTo, asOfDate, fullTree: isFullTree, includeAging: isIncludeAging, departmentIds: dIds, journalIds: jIds, costCenters: jIds });
    const result = await CacheService.getOrSet(cacheKey, () => {
      const engine = new ConsolidationEngine();
      return engine.getExecutiveSummary({
        companyIds: companyIds ? (Array.isArray(companyIds) ? companyIds : String(companyIds).split(',')) : undefined,
        years,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        asOfDate: asOfDate || undefined,
        fullTree: isFullTree,
        includeAging: isIncludeAging,
        departmentIds: dIds ? (Array.isArray(dIds) ? dIds : String(dIds).split(',')).map(Number) : undefined,
        journalIds: jIds,
        costCenters: jIds
      });
    });
    res.json(result);
  } catch (err) {
    if (err.statusCode === 400) return res.status(400).json({ error: err.message });
    console.error('[API /executive] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/executive/children', async (req, res) => {
  try {
    const { companyId, departmentId, kind, dateFrom, dateTo, journalIds, costCenters } = req.query;
    if (!companyId || departmentId === undefined) {
      return res.status(400).json({ error: 'companyId and departmentId are required' });
    }
    const years = parseYearsParam(req);
    const targetJournals = costCenters || journalIds;
    const jIds = targetJournals ? (Array.isArray(targetJournals) ? targetJournals : String(targetJournals).split(',')).map(s => (typeof s === 'string' ? s.trim() : s)).filter(Boolean) : undefined;
    const cacheKey = CacheService.makeKey('executive-children', { companyId: Number(companyId), departmentId: Number(departmentId), kind: kind || 'both', years, dateFrom, dateTo, journalIds: jIds, costCenters: jIds });
    const result = await CacheService.getOrSet(cacheKey, () => {
      const engine = new ConsolidationEngine();
      return engine.getExecutiveDepartmentChildren({
        companyId: Number(companyId),
        departmentId: Number(departmentId),
        kind: kind || 'both',
        years,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        journalIds: jIds,
        costCenters: jIds
      });
    });
    res.json(result);
  } catch (err) {
    if (err.statusCode === 400) return res.status(400).json({ error: err.message });
    console.error('[API /executive/children] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/executive/invoices', async (req, res) => {
  try {
    const { companyId, partnerId, departmentId, journalId, costCenterKey, dateFrom, dateTo, asOfDate } = req.query;
    if (!companyId) {
      return res.status(400).json({ error: 'companyId is required' });
    }
    const years = parseYearsParam(req);
    const jid = journalId ? Number(journalId) : undefined;
    const cacheKey = CacheService.makeKey('executive-invoices', { companyId: Number(companyId), partnerId, departmentId: departmentId ? Number(departmentId) : undefined, journalId: jid, costCenterKey, years, dateFrom, dateTo, asOfDate });
    const result = await CacheService.getOrSet(cacheKey, () => {
      const engine = new ConsolidationEngine();
      return engine.getExecutiveClientInvoices({
        companyId: Number(companyId),
        partnerId: partnerId || undefined,
        departmentId: departmentId ? Number(departmentId) : undefined,
        journalId: jid,
        costCenterKey: costCenterKey || undefined,
        years,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        asOfDate: asOfDate || undefined
      });
    });
    res.json(result);
  } catch (err) {
    if (err.statusCode === 400) return res.status(400).json({ error: err.message });
    console.error('[API /executive/invoices] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/executive/aging', async (req, res) => {
  try {
    const { companyIds, dateFrom, dateTo, asOfDate, includeInvoices } = req.query;
    const years = parseYearsParam(req);
    const isIncInv = includeInvoices === 'true';
    const cacheKey = CacheService.makeKey('executive-aging', { companyIds, years, dateFrom, dateTo, asOfDate, includeInvoices: isIncInv });
    const result = await CacheService.getOrSet(cacheKey, () => {
      const engine = new ConsolidationEngine();
      return engine.getExecutiveAging({
        companyIds: companyIds ? (Array.isArray(companyIds) ? companyIds : String(companyIds).split(',')) : undefined,
        years,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        asOfDate: asOfDate || undefined,
        includeInvoices: isIncInv
      });
    });
    res.json(result);
  } catch (err) {
    if (err.statusCode === 400) return res.status(400).json({ error: err.message });
    console.error('[API /executive/aging] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==============================================
// ===== D1: CUSTOMERS & COLLECTION (العملاء والتحصيل) =====
// ==============================================

router.get('/customers-collection', async (req, res) => {
  try {
    const { companyIds, dateFrom, dateTo, asOfDate, includeInvoices, groupIds, departmentIds, journalIds, costCenters } = req.query;
    const years = parseYearsParam(req);
    const isIncInv = includeInvoices === 'true';
    const dIds = departmentIds || groupIds;
    const targetJournals = costCenters || journalIds;
    const jIds = targetJournals ? (Array.isArray(targetJournals) ? targetJournals : String(targetJournals).split(',')).map(s => (typeof s === 'string' ? s.trim() : s)).filter(Boolean) : undefined;
    const cacheKey = CacheService.makeKey('customers-collection', { companyIds, years, dateFrom, dateTo, asOfDate, includeInvoices: isIncInv, departmentIds: dIds, journalIds: jIds, costCenters: jIds });
    const result = await CacheService.getOrSet(cacheKey, () => {
      const engine = new ConsolidationEngine();
      return engine.getCustomersCollection({
        companyIds: companyIds ? (Array.isArray(companyIds) ? companyIds : String(companyIds).split(',')) : undefined,
        years,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        asOfDate: asOfDate || undefined,
        includeInvoices: isIncInv,
        departmentIds: dIds ? (Array.isArray(dIds) ? dIds : String(dIds).split(',')).map(Number) : undefined,
        journalIds: jIds,
        costCenters: jIds
      });
    });
    res.json(result);
  } catch (err) {
    if (err.statusCode === 400) return res.status(400).json({ error: err.message });
    console.error('[API /customers-collection] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/customers-collection/statement', async (req, res) => {
  try {
    const { companyId, partnerId, departmentId, dateFrom, dateTo, asOfDate } = req.query;
    if (!companyId || !partnerId) {
      return res.status(400).json({ error: 'companyId and partnerId are required' });
    }
    const years = parseYearsParam(req);
    const cacheKey = CacheService.makeKey('customers-statement', { companyId: Number(companyId), partnerId: Number(partnerId), departmentId: departmentId ? Number(departmentId) : undefined, years, dateFrom, dateTo, asOfDate });
    const result = await CacheService.getOrSet(cacheKey, () => {
      const engine = new ConsolidationEngine();
      return engine.getCustomerStatement({
        companyId: Number(companyId),
        partnerId: Number(partnerId),
        departmentId: departmentId ? Number(departmentId) : undefined,
        years,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        asOfDate: asOfDate || undefined
      });
    });
    res.json(result);
  } catch (err) {
    if (err.statusCode === 400) return res.status(400).json({ error: err.message });
    console.error('[API /customers-collection/statement] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/customers-collection/invoices', async (req, res) => {
  try {
    const { companyId, partnerId, departmentId, journalId, dateFrom, dateTo, asOfDate } = req.query;
    if (!companyId) {
      return res.status(400).json({ error: 'companyId is required' });
    }
    const years = parseYearsParam(req);
    const jid = journalId ? Number(journalId) : undefined;
    const cacheKey = CacheService.makeKey('customers-invoices', { companyId: Number(companyId), partnerId: partnerId ? Number(partnerId) : undefined, departmentId: departmentId ? Number(departmentId) : undefined, journalId: jid, years, dateFrom, dateTo, asOfDate });
    const result = await CacheService.getOrSet(cacheKey, () => {
      const engine = new ConsolidationEngine();
      return engine.getExecutiveClientInvoices({
        companyId: Number(companyId),
        partnerId: partnerId ? Number(partnerId) : undefined,
        departmentId: departmentId ? Number(departmentId) : undefined,
        journalId: jid,
        years,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        asOfDate: asOfDate || undefined
      });
    });
    res.json(result);
  } catch (err) {
    if (err.statusCode === 400) return res.status(400).json({ error: err.message });
    console.error('[API /customers-collection/invoices] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==============================================
// Stage C1: Actual Collections (التحصيل الفعلي)
// ==============================================
router.get('/actual-collections', async (req, res) => {
  try {
    const {
      companyIds, dateFrom, dateTo, asOfDate,
      departmentIds, groupIds, journalIds, journalNames, journalName,
      partnerIds, partnerName, timeGrain, costCenters, costCenterKey
    } = req.query;

    const years = parseYearsParam(req);
    const targetDeptIds = departmentIds || groupIds;
    const dIds = targetDeptIds ? (Array.isArray(targetDeptIds) ? targetDeptIds : String(targetDeptIds).split(',')) : undefined;
    const jIds = journalIds ? (Array.isArray(journalIds) ? journalIds : String(journalIds).split(',')) : undefined;
    const pIds = partnerIds ? (Array.isArray(partnerIds) ? partnerIds : String(partnerIds).split(',')) : undefined;
    const cCenters = costCenters ? (Array.isArray(costCenters) ? costCenters : String(costCenters).split(',')) : undefined;
    const jNames = journalNames
      ? (Array.isArray(journalNames) ? journalNames : String(journalNames).split(',').map(s => s.trim()).filter(Boolean))
      : undefined;

    const cacheKey = CacheService.makeKey('actual-collections', {
      companyIds, years, dateFrom, dateTo, asOfDate,
      departmentIds: dIds, journalIds: jIds, costCenters: cCenters, costCenterKey,
      journalNames: jNames ? [...jNames].sort().join(',') : undefined,
      journalName,
      partnerIds: pIds, partnerName, timeGrain
    });

    const result = await CacheService.getOrSet(cacheKey, () => {
      const engine = new ConsolidationEngine();
      return engine.getCollections({
        companyIds: companyIds ? (Array.isArray(companyIds) ? companyIds : String(companyIds).split(',')) : undefined,
        years,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        asOfDate: asOfDate || undefined,
        departmentIds: dIds,
        journalIds: jIds,
        costCenters: cCenters,
        costCenterKey,
        journalNames: jNames,
        journalName,
        partnerIds: pIds,
        partnerName,
        timeGrain: timeGrain || 'month'
      });
    });

    res.json(result);
  } catch (err) {
    if (err.statusCode === 400) return res.status(400).json({ error: err.message });
    console.error('[API /actual-collections] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/actual-collections/payments', async (req, res) => {
  try {
    const { companyId, partnerId, journalId, costCenterKey, journalNames, invoiceName, dateFrom, dateTo, channel, page, limit } = req.query;
    const years = parseYearsParam(req);
    const jNames = journalNames
      ? (Array.isArray(journalNames) ? journalNames : String(journalNames).split(',').map(s => s.trim()).filter(Boolean))
      : undefined;

    const cacheKey = CacheService.makeKey('actual-collections-payments', {
      companyId, partnerId, journalId, costCenterKey,
      journalNames: jNames ? [...jNames].sort().join(',') : undefined,
      invoiceName, years, dateFrom, dateTo, channel, page, limit
    });

    const result = await CacheService.getOrSet(cacheKey, () => {
      const engine = new ConsolidationEngine();
      const resolvedCcKey = costCenterKey || (journalId && typeof journalId === 'string' && (journalId.startsWith('an:') || journalId.startsWith('jn:') || journalId.startsWith('j:')) ? journalId : undefined);
      const resolvedJid = journalId ? (typeof journalId === 'string' && (journalId.startsWith('an:') || journalId.startsWith('jn:') || journalId.startsWith('j:')) ? undefined : Number(journalId)) : undefined;
      return engine.getCollectionPayments({
        companyId: companyId ? Number(companyId) : undefined,
        partnerId: partnerId ? Number(partnerId) : undefined,
        journalId: resolvedJid,
        costCenterKey: resolvedCcKey,
        journalNames: jNames,
        invoiceName: invoiceName || undefined,
        years,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        channel: channel || undefined,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 100
      });
    });

    res.json(result);
  } catch (err) {
    if (err.statusCode === 400) return res.status(400).json({ error: err.message });
    console.error('[API /actual-collections/payments] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Stage D2: Departments & Profitability
router.get('/departments-profitability', async (req, res) => {
  try {
    const { companyIds, dateFrom, dateTo, year, measure, timeGrain, redistributeAdmin, groupIds, departmentIds, journalIds, costCenters } = req.query;
    const years = parseYearsParam(req);
    const isRedist = redistributeAdmin === 'true' || redistributeAdmin === '1';
    const dIds = departmentIds || groupIds;
    const cacheKey = CacheService.makeKey('departments-profitability', {
      companyIds,
      years,
      year: year || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      measure: measure || 'net',
      timeGrain: timeGrain || 'quarter',
      redistributeAdmin: isRedist,
      departmentIds: dIds,
      journalIds,
      costCenters
    });
    const result = await CacheService.getOrSet(cacheKey, () => {
      const engine = new ConsolidationEngine();
      return engine.getDepartmentsProfitability({
        companyIds: companyIds ? (Array.isArray(companyIds) ? companyIds : String(companyIds).split(',')) : undefined,
        years,
        year: year || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        measure: measure || 'net',
        timeGrain: timeGrain || 'quarter',
        redistributeAdmin: isRedist,
        departmentIds: dIds ? (Array.isArray(dIds) ? dIds : String(dIds).split(',')).map(Number) : undefined,
        journalIds: journalIds ? (Array.isArray(journalIds) ? journalIds : String(journalIds).split(',')).map(s => (typeof s === 'string' ? s.trim() : s)).filter(Boolean) : undefined,
        costCenters: costCenters ? (Array.isArray(costCenters) ? costCenters : String(costCenters).split(',')) : undefined
      });
    });
    res.json(result);
  } catch (err) {
    if (err.statusCode === 400) return res.status(400).json({ error: err.message });
    console.error('[API /departments-profitability] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==============================================
// ===== USER UI PREFERENCES (P4) =====
// ==============================================

const ALLOWED_PREF_KEYS = ['executive_view'];

router.get('/preferences/:key', (req, res) => {
  try {
    const { key } = req.params;
    if (!ALLOWED_PREF_KEYS.includes(key)) {
      return res.status(400).json({ error: 'المفتاح غير مسموح به' });
    }

    const { getDb } = require('../db/connection');
    const db = getDb();
    const userType = req.admin ? 'admin' : (req.viewer ? 'viewer' : 'anonymous');
    const userId = req.admin ? String(req.admin.id) : (req.viewer ? String(req.viewer.phone) : 'guest');

    const row = db.prepare(`
      SELECT value_json FROM ui_preferences 
      WHERE user_type = ? AND user_id = ? AND pref_key = ?
    `).get(userType, userId, key);

    if (!row) {
      return res.json({ found: false, data: null });
    }
    res.json({ found: true, data: JSON.parse(row.value_json) });
  } catch (err) {
    console.error('[API /preferences GET] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/preferences/:key', (req, res) => {
  try {
    const { key } = req.params;
    if (!ALLOWED_PREF_KEYS.includes(key)) {
      return res.status(400).json({ error: 'المفتاح غير مسموح به' });
    }

    const valueJson = JSON.stringify(req.body);
    if (Buffer.byteLength(valueJson, 'utf8') > 20480) {
      return res.status(413).json({ error: 'حجم البيانات يتجاوز الحد المسموح (20 كيلوبايت)' });
    }

    const { getDb } = require('../db/connection');
    const db = getDb();
    const userType = req.admin ? 'admin' : (req.viewer ? 'viewer' : 'anonymous');
    const userId = req.admin ? String(req.admin.id) : (req.viewer ? String(req.viewer.phone) : 'guest');

    db.prepare(`
      INSERT INTO ui_preferences (user_type, user_id, pref_key, value_json, updated_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_type, user_id, pref_key) DO UPDATE SET
        value_json = excluded.value_json,
        updated_at = datetime('now')
    `).run(userType, userId, key, valueJson);

    res.json({ success: true });
  } catch (err) {
    console.error('[API /preferences PUT] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==============================================
// ===== DATA QUALITY: DEPARTMENT CONFLICTS (R2) =====
// ==============================================

router.get('/data-quality/department-conflicts', (req, res) => {
  try {
    const { companyId } = req.query;
    const engine = new ConsolidationEngine();
    const result = engine.getDepartmentConflicts({
      companyId: companyId ? parseInt(companyId) : undefined
    });
    res.json(result);
  } catch (err) {
    console.error('[API /data-quality/department-conflicts] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==============================================
// ===== PRESENTATION SHARES =====

const crypto = require('crypto');

// List active shares
router.get('/presentation/shares', (req, res) => {
  try {
    const db = getDb();
    const shares = db.prepare('SELECT id, token, title, company_id, date_from, date_to, speed, created_at, expires_at FROM presentation_shares WHERE is_active = 1 ORDER BY created_at DESC').all();
    res.json(shares);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Create share
router.post('/presentation/share', (req, res) => {
  try {
    const { title, companyId, dateFrom, dateTo, speed, slidesConfig } = req.body;
    const token = crypto.randomUUID();
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO presentation_shares (token, title, company_id, date_from, date_to, speed, slides_config)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(token, title || 'عرض تقديمي', companyId || null, dateFrom || null, dateTo || null, speed || 8, JSON.stringify(slidesConfig || {}));
    res.json({ success: true, token, id: result.lastInsertRowid });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get share data (PUBLIC — no auth)
router.get('/presentation/share/:token', (req, res) => {
  try {
    const db = getDb();
    const share = db.prepare('SELECT * FROM presentation_shares WHERE token = ? AND is_active = 1').get(req.params.token);
    if (!share) return res.status(404).json({ error: 'Share not found or expired' });
    
    // Check expiry
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Share has expired' });
    }
    
    res.json({
      title: share.title,
      companyId: share.company_id,
      dateFrom: share.date_from,
      dateTo: share.date_to,
      speed: share.speed,
      slidesConfig: JSON.parse(share.slides_config || '{}'),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete share
router.delete('/presentation/share/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('UPDATE presentation_shares SET is_active = 0 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get presentation data (multi-company × multi-year)
router.get('/presentation/data', async (req, res) => {
  try {
    const { companyIds, years } = req.query;
    const customFrom = req.query.dateFrom || null;
    const customTo = req.query.dateTo || null;
    const cacheKey = CacheService.makeKey('presentation-data', { companyIds, years, customFrom, customTo });
    const data = await CacheService.getOrSet(cacheKey, () => {
      console.log('[Presentation] Query:', { companyIds, years, customFrom, customTo });
      const db = getDb();
      const engine = new ConsolidationEngine();
      const ids = companyIds ? companyIds.split(',').map(Number) : [];
      const yearList = years ? years.split(',') : [];
    
    function getKpis(cid, dateFrom, dateTo) {
      return engine.getPresentationKPIs({ companyId: cid, dateFrom, dateTo });
    }
    
    function sumKpis(arr) {
      const t = { revenue:0,expenses:0,netIncome:0,assets:0,liabilities:0,equity:0,cash:0,liquidCash:0,guarantees:0,receivables:0,openingReceivables:0,billed:0,collected:0,remaining:0,payables:0,workingCapital:0 };
      for (const k of arr) {
        for (const key of Object.keys(t)) t[key] += k[key] || 0;
      }
      t.profitMargin = t.revenue > 0 ? (t.netIncome / t.revenue * 100) : 0;
      t.expenseRatio = t.revenue > 0 ? (t.expenses / t.revenue * 100) : 0;
      t.collectionRate = t.billed > 0 ? (t.collected / t.billed * 100) : 0;
      t.remainingRate = t.billed > 0 ? (t.remaining / t.billed * 100) : 0;
      t.currentRatio = t.payables > 0 ? Number(((t.cash + t.receivables) / t.payables).toFixed(2)) : null;
      t.dsoDays = t.billed > 0 ? Math.round((t.remaining / t.billed) * 273) : 0;
      const mBurn = t.expenses / 9;
      t.cashRunwayMonths = mBurn > 0 ? Number((t.liquidCash / mBurn).toFixed(1)) : 999;
      return t;
    }
    
    function getHierarchyData(cid, dateFrom, dateTo) {
      const p = { companyId: cid, dateFrom, dateTo };
      
      // Ensure temp cash moves exist for actual partner collections
      db.exec(`
        CREATE TEMP TABLE IF NOT EXISTS _temp_cash_moves (
          company_id INTEGER,
          move_name TEXT,
          PRIMARY KEY(company_id, move_name)
        );
        DELETE FROM _temp_cash_moves;
      `);
      db.prepare(`
        INSERT OR IGNORE INTO _temp_cash_moves (company_id, move_name)
        SELECT DISTINCT ji.company_id, ji.move_name
        FROM journal_items ji
        WHERE ji.company_id = @companyId
          AND ji.move_state = 'posted'
          AND ${engine._cashFilter('ji')}
          AND ji.date >= @dateFrom AND ji.date <= @dateTo
      `).run(p);

      // Revenue/Expenses by CostCenter + Partner
      const ccPartner = db.prepare(`
        SELECT COALESCE(NULLIF(ji.analytic_account,''),'بدون مركز') as cc,
          COALESCE(NULLIF(ji.partner_name,''),'بدون شريك') as partner,
          COALESCE(SUM(CASE WHEN ${engine._sectionExpr('ji', 'o')} = 'income' THEN ji.credit - ji.debit ELSE 0 END),0) as revenue,
          COALESCE(SUM(CASE WHEN ${engine._sectionExpr('ji', 'o')} = 'expense' THEN ji.debit - ji.credit ELSE 0 END),0) as expenses
        FROM journal_items ji
        ${engine._sectionJoin('ji', 'o')}
        WHERE ji.company_id=@companyId AND ji.date>=@dateFrom AND ji.date<=@dateTo AND ji.move_state='posted'
        GROUP BY cc, partner
      `).all(p);
      
      // Receivables ending balance by partner
      const recvClose = db.prepare(`SELECT COALESCE(NULLIF(partner_name,''),'بدون شريك') as partner, SUM(debit-credit) as bal FROM journal_items WHERE company_id=@companyId AND date<=@dateTo AND account_type='asset_receivable' AND move_state='posted' GROUP BY partner`).all(p);
      const closeMap = Object.fromEntries(recvClose.map(r=>[r.partner,r.bal]));

      // Actual cash collected by partner
      const recvCashRows = db.prepare(`
        SELECT COALESCE(NULLIF(ji.partner_name,''),'بدون شريك') as partner,
               COALESCE(SUM(ji.credit - ji.debit), 0) as collected
        FROM journal_items ji
        JOIN _temp_cash_moves cm ON cm.company_id = ji.company_id AND cm.move_name = ji.move_name
        WHERE ji.company_id = @companyId AND ji.date >= @dateFrom AND ji.date <= @dateTo
          AND ji.account_type = 'asset_receivable' AND ji.move_state = 'posted'
        GROUP BY partner
      `).all(p);
      const partnerCashCollected = Object.fromEntries(recvCashRows.map(r=>[r.partner,r.collected]));
      
      // Build costCenters → partners hierarchy
      // First: compute per-partner total revenue (across all CCs) for proportional distribution
      const partnerTotalRev = {};
      for (const row of ccPartner) {
        partnerTotalRev[row.partner] = (partnerTotalRev[row.partner] || 0) + row.revenue;
      }

      const ccMap = {};
      for (const row of ccPartner) {
        if (!ccMap[row.cc]) ccMap[row.cc] = { name: row.cc, revenue:0, expenses:0, partners:[] };
        ccMap[row.cc].revenue += row.revenue;
        ccMap[row.cc].expenses += row.expenses;
        // Distribute collected proportionally by revenue share within this partner
        const totalRevForPartner = partnerTotalRev[row.partner] || 0;
        const revShare = totalRevForPartner > 0 ? (row.revenue / totalRevForPartner) : 0;
        const collected = (partnerCashCollected[row.partner] || 0) * revShare;
        const remaining = (closeMap[row.partner] || 0) * revShare;
        const billedEst = row.revenue * 1.15; // Est inclusive of 15% VAT
        ccMap[row.cc].partners.push({
          name: row.partner, revenue: row.revenue, expenses: row.expenses,
          netIncome: row.revenue - row.expenses, collected, remaining,
          collectionRate: billedEst > 0 ? (collected/billedEst*100) : 0,
          profitMargin: row.revenue > 0 ? ((row.revenue-row.expenses)/row.revenue*100) : 0,
        });
      }
      const costCenters = Object.values(ccMap).map(cc => {
        cc.netIncome = cc.revenue - cc.expenses;
        cc.profitMargin = cc.revenue > 0 ? (cc.netIncome/cc.revenue*100) : 0;
        const ccColl = cc.partners.reduce((s,pt)=>s+pt.collected,0);
        cc.collected = ccColl; cc.remaining = cc.revenue - ccColl;
        cc.collectionRate = cc.revenue > 0 ? (ccColl/cc.revenue*100) : 0;
        cc.partners.sort((a,b) => b.revenue - a.revenue);
        if (cc.partners.length > 25) cc.partners = cc.partners.slice(0,25);
        return cc;
      }).sort((a,b) => b.revenue - a.revenue);
      
      // Revenue/Expenses by CostCenter + Account
      const ccAccount = db.prepare(`
        SELECT COALESCE(NULLIF(ji.analytic_account,''),'بدون مركز') as cc,
          ji.account_code, ji.account_name, ji.account_type,
          ${engine._sectionExpr('ji', 'o')} as section,
          SUM(ji.debit) as total_debit, SUM(ji.credit) as total_credit
        FROM journal_items ji
        ${engine._sectionJoin('ji', 'o')}
        WHERE ji.company_id=@companyId AND ji.date>=@dateFrom AND ji.date<=@dateTo AND ji.move_state='posted'
          AND ${engine._sectionExpr('ji', 'o')} IN ('income', 'expense')
        GROUP BY cc, ji.account_code ORDER BY (SUM(ji.debit)+SUM(ji.credit)) DESC
      `).all(p);
      
      const atMap = {};
      for (const row of ccAccount) {
        if (!atMap[row.cc]) atMap[row.cc] = { name: row.cc, revenue:0, expenses:0, accounts:[] };
        const isIncome = row.section === 'income';
        const amount = isIncome ? (row.total_credit - row.total_debit) : (row.total_debit - row.total_credit);
        if (isIncome) atMap[row.cc].revenue += amount; else atMap[row.cc].expenses += amount;
        atMap[row.cc].accounts.push({
          code: row.account_code, name: row.account_name, type: isIncome ? 'income' : 'expense', amount,
        });
      }
      const accountTree = Object.values(atMap).map(cc => {
        cc.netIncome = cc.revenue - cc.expenses;
        cc.profitMargin = cc.revenue > 0 ? (cc.netIncome/cc.revenue*100) : 0;
        cc.accounts.sort((a,b) => Math.abs(b.amount) - Math.abs(a.amount));
        return cc;
      }).sort((a,b) => b.revenue - a.revenue);
      
      return { costCenters, accountTree };
    }

    // Monthly pivot data per account per company (includes cost center)
    function getPivotData(cid, dateFrom, dateTo) {
      const p = { companyId: cid, dateFrom, dateTo };
      const rows = db.prepare(`
        SELECT ji.account_code, ji.account_name, ji.account_type,
          ${engine._sectionExpr('ji', 'o')} as section,
          COALESCE(NULLIF(ji.analytic_account,''),'\u0628\u062f\u0648\u0646 \u0645\u0631\u0643\u0632') as cc,
          CAST(strftime('%m', ji.date) AS INTEGER) as month,
          COALESCE(SUM(CASE WHEN ${engine._sectionExpr('ji', 'o')} = 'income' THEN ji.credit - ji.debit ELSE 0 END),0) as revenue,
          COALESCE(SUM(CASE WHEN ${engine._sectionExpr('ji', 'o')} = 'expense' THEN ji.debit - ji.credit ELSE 0 END),0) as expenses
        FROM journal_items ji
        ${engine._sectionJoin('ji', 'o')}
        WHERE ji.company_id=@companyId AND ji.date>=@dateFrom AND ji.date<=@dateTo AND ji.move_state='posted'
          AND ${engine._sectionExpr('ji', 'o')} IN ('income', 'expense')
        GROUP BY ji.account_code, ji.account_name, ji.account_type, cc, month
        ORDER BY cc, ji.account_code, month
      `).all(p);
      return rows;
    }

    // Build data per year (or per custom date range)
    const yearlyData = {};
    const allKpis = [];
    
    // When custom dates provided, use single period with derived year
    const effectiveYears = (customFrom && customTo) ? [customFrom.substring(0, 4)] : yearList;
    
    for (const yr of effectiveYears) {
      const dateFrom = customFrom || `${yr}-01-01`, dateTo = customTo || `${yr}-12-31`;
      const companies = [];
      for (const cid of ids) {
        const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(cid);
        if (!company) continue;
        const kpis = getKpis(cid, dateFrom, dateTo);
        const hd = getHierarchyData(cid, dateFrom, dateTo);
        const pivot = getPivotData(cid, dateFrom, dateTo);

        // Derive revenue/expenses from accountTree (cc + account_code) — the proper financial grouping
        // accountTree is the authoritative source; partner grouping in costCenters is only for collection
        let hierRevenue = 0, hierExpenses = 0;
        const atRevenueMap = {};
        for (const at of hd.accountTree) {
          hierRevenue += at.revenue || 0;
          hierExpenses += at.expenses || 0;
          atRevenueMap[at.name] = { revenue: at.revenue || 0, expenses: at.expenses || 0 };
        }
        // Sync costCenters revenue/expenses from accountTree so all tabs agree
        for (const cc of hd.costCenters) {
          const atData = atRevenueMap[cc.name];
          if (atData) {
            cc.revenue = atData.revenue;
            cc.expenses = atData.expenses;
            cc.netIncome = atData.revenue - atData.expenses;
            cc.profitMargin = atData.revenue > 0 ? (cc.netIncome / atData.revenue * 100) : 0;
          }
        }
        kpis.revenue = hierRevenue;
        kpis.expenses = hierExpenses;
        kpis.netIncome = hierRevenue - hierExpenses;
        kpis.profitMargin = hierRevenue > 0 ? ((hierRevenue - hierExpenses) / hierRevenue * 100) : 0;
        kpis.expenseRatio = hierRevenue > 0 ? (hierExpenses / hierRevenue * 100) : 0;
        // Collection KPIs are already calculated accurately in ConsolidationEngine.getPresentationKPIs
        kpis.collectionRate = kpis.billed > 0 ? (kpis.collected / kpis.billed * 100) : 0;
        kpis.remainingRate = kpis.billed > 0 ? (kpis.remaining / kpis.billed * 100) : 0;

        const entry = { companyId: cid, companyName: company.name, currency: company.currency || 'SAR', kpis, topAccounts: kpis.topAccounts, costCenters: hd.costCenters, accountTree: hd.accountTree, pivotData: pivot };
        delete entry.kpis.topAccounts;
        companies.push(entry);
        allKpis.push(entry.kpis);
      }
      yearlyData[yr] = { companies, totals: sumKpis(companies.map(c => c.kpis)), dateFrom, dateTo };
    }
    
      return { yearlyData, years: yearList, grandTotals: sumKpis(allKpis) };
    });
    res.json(data);
  } catch (err) {
    console.error('Presentation data error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== GUARANTEE MANAGEMENT =====
// List all guarantee journal items with release status (admin)
router.get('/guarantees', async (req, res) => {
  try {
    const companyIds = parseCompanyIds(req.query);
    const asOfDate = req.query.asOfDate;
    const cacheKey = CacheService.makeKey('guarantees', { companyIds, asOfDate });
    const results = await CacheService.getOrSet(cacheKey, () => {
      const engine = new ConsolidationEngine();
      return engine.getActiveGuarantees({ companyIds, asOfDate });
    });
    res.json(results);
  } catch (err) {
    console.error('Guarantees error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Mark a guarantee as released
router.post('/guarantees/release', (req, res) => {
  try {
    const { companyId, accountCode, moveName, releasedDate, notes } = req.body;
    const db = getDb();
    db.prepare(`INSERT OR REPLACE INTO guarantee_releases (company_id, account_code, move_name, released_date, notes) VALUES (?, ?, ?, ?, ?)`)
      .run(companyId, accountCode, moveName, releasedDate || new Date().toISOString().slice(0, 10), notes || '');
    CacheService.flush();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Un-release a guarantee
router.delete('/guarantees/release', (req, res) => {
  try {
    const { companyId, accountCode, moveName } = req.query;
    const db = getDb();
    db.prepare('DELETE FROM guarantee_releases WHERE company_id = ? AND account_code = ? AND move_name = ?')
      .run(companyId, accountCode, moveName);
    CacheService.flush();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Sub-items: list for a specific parent guarantee
router.get('/guarantee-sub-items', (req, res) => {
  try {
    const { companyId, accountCode, moveName } = req.query;
    const db = getDb();
    const items = db.prepare(`SELECT * FROM guarantee_sub_items WHERE parent_company_id = ? AND parent_account_code = ? AND parent_move_name = ? ORDER BY created_at`).all(companyId, accountCode, moveName);
    res.json(items);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Sub-items: add
router.post('/guarantee-sub-items', (req, res) => {
  try {
    const { parentCompanyId, parentAccountCode, parentMoveName, description, amount, notes } = req.body;
    const db = getDb();
    const r = db.prepare(`INSERT INTO guarantee_sub_items (parent_company_id, parent_account_code, parent_move_name, description, amount, notes) VALUES (?, ?, ?, ?, ?, ?)`)
      .run(parentCompanyId, parentAccountCode, parentMoveName, description, amount || 0, notes || '');
    CacheService.flush();
    res.json({ success: true, id: r.lastInsertRowid });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Sub-items: toggle release
router.put('/guarantee-sub-items/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { isReleased, releasedDate } = req.body;
    const db = getDb();
    db.prepare(`UPDATE guarantee_sub_items SET is_released = ?, released_date = ? WHERE id = ?`)
      .run(isReleased ? 1 : 0, isReleased ? (releasedDate || new Date().toISOString().slice(0, 10)) : null, id);
    CacheService.flush();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Sub-items: delete
router.delete('/guarantee-sub-items/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM guarantee_sub_items WHERE id = ?').run(req.params.id);
    CacheService.flush();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Guarantee details for presentation (supports pendingOnly filter)
router.get('/guarantee-details', (req, res) => {
  try {
    const companyIds = parseCompanyIds(req.query);
    const pendingOnly = req.query.pendingOnly === 'true';
    const db = getDb();
    if (!companyIds || !companyIds.length) return res.json([]);
    const today = new Date().toISOString().slice(0, 10);
    const results = [];
    for (const cid of companyIds) {
      const company = db.prepare('SELECT name FROM companies WHERE id = ?').get(cid);
      if (!company) continue;
      let sql = `
        SELECT ji.account_code, ji.account_name,
          SUM(ji.debit) as total_debit, SUM(ji.credit) as total_credit,
          SUM(ji.debit - ji.credit) as balance
        FROM journal_items ji
      `;
      if (pendingOnly) {
        sql += ` LEFT JOIN guarantee_releases gr ON gr.company_id = ji.company_id AND gr.account_code = ji.account_code AND gr.move_name = ji.move_name`;
      }
      sql += ` WHERE ji.company_id = ? AND EXISTS (SELECT 1 FROM account_tags _t WHERE _t.company_id = ji.company_id AND _t.account_code = ji.account_code AND _t.tag = 'guarantee') AND ji.move_state = 'posted' AND ji.date <= ?`;
      if (pendingOnly) {
        sql += ` AND gr.id IS NULL`;
      }
      sql += ` GROUP BY ji.account_code, ji.account_name ORDER BY ji.account_code`;
      const accounts = db.prepare(sql).all(cid, today);
      if (accounts.length) {
        results.push({ companyId: cid, companyName: company.name, accounts, date: today });
      }
    }
    res.json(results);
  } catch (err) {
    console.error('Guarantee details error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Pending guarantees flat list (for presentation)
router.get('/guarantee-pending-list', (req, res) => {
  try {
    const companyIds = parseCompanyIds(req.query);
    const engine = new ConsolidationEngine();
    const data = engine.getActiveGuarantees({ companyIds, asOfDate: req.query.asOfDate });
    const results = data.filter(co => co.items && co.items.length > 0);
    res.json(results);
  } catch (err) {
    console.error('Guarantee pending list error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== ACCOUNT STATEMENT =====
// Get list of accounts for a company (for dropdown)
router.get('/account-statement/accounts', (req, res) => {
  try {
    const { companyId } = req.query;
    const db = getDb();
    if (!companyId) return res.json([]);
    const accounts = db.prepare(`
      SELECT DISTINCT account_code, account_name, account_type
      FROM journal_items
      WHERE company_id = ? AND move_state = 'posted'
      ORDER BY account_code
    `).all(parseInt(companyId));
    res.json(accounts);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get distinct partners for a company
router.get('/account-statement/partners', (req, res) => {
  try {
    const { companyId } = req.query;
    const db = getDb();
    if (!companyId) return res.json([]);
    const partners = db.prepare(`
      SELECT DISTINCT partner_name
      FROM journal_items
      WHERE company_id = ? AND move_state = 'posted' AND partner_name IS NOT NULL AND partner_name != ''
      ORDER BY partner_name
    `).all(parseInt(companyId));
    res.json(partners.map(p => p.partner_name));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Get account statement data
router.get('/account-statement', (req, res) => {
  try {
    const { companyId, accountCode, dateFrom, dateTo } = req.query;
    const db = getDb();
    if (!companyId || !accountCode) return res.status(400).json({ error: 'companyId and accountCode are required' });

    const cid = parseInt(companyId);

    // Account info
    const accountInfo = db.prepare(`
      SELECT DISTINCT account_code, account_name, account_type
      FROM journal_items WHERE company_id = ? AND account_code = ? LIMIT 1
    `).get(cid, accountCode) || { account_code: accountCode, account_name: '', account_type: '' };

    // Company info
    const company = db.prepare('SELECT name, currency FROM companies WHERE id = ?').get(cid) || { name: '', currency: 'SAR' };

    // Opening balance: sum of all posted transactions before dateFrom
    let openingBalance = 0;
    if (dateFrom) {
      const ob = db.prepare(`
        SELECT COALESCE(SUM(debit), 0) as totalDebit, COALESCE(SUM(credit), 0) as totalCredit
        FROM journal_items
        WHERE company_id = ? AND account_code = ? AND date < ? AND move_state = 'posted'
      `).get(cid, accountCode, dateFrom);
      openingBalance = (ob.totalDebit || 0) - (ob.totalCredit || 0);
    }

    // Journal items in the period
    let sql = `
      SELECT date, move_name, move_ref, label, partner_name, debit, credit,
             analytic_account, journal_name
      FROM journal_items
      WHERE company_id = ? AND account_code = ? AND move_state = 'posted'
    `;
    const params = [cid, accountCode];

    if (dateFrom) { sql += ' AND date >= ?'; params.push(dateFrom); }
    if (dateTo) { sql += ' AND date <= ?'; params.push(dateTo); }
    sql += ' ORDER BY date ASC, id ASC';

    const items = db.prepare(sql).all(...params);

    // Calculate running balance
    let runningBalance = openingBalance;
    const enrichedItems = items.map(item => {
      runningBalance += (item.debit || 0) - (item.credit || 0);
      return { ...item, runningBalance };
    });

    // Totals
    const totalDebit = items.reduce((s, i) => s + (i.debit || 0), 0);
    const totalCredit = items.reduce((s, i) => s + (i.credit || 0), 0);

    res.json({
      company,
      account: accountInfo,
      openingBalance,
      items: enrichedItems,
      totalDebit,
      totalCredit,
      closingBalance: openingBalance + totalDebit - totalCredit
    });
  } catch (err) {
    console.error('Account statement error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==============================================
// ===== VAT REPORT & DETAILS (D5) =====
// ==============================================

router.get('/vat', async (req, res) => {
  try {
    const { company_id, company_ids, companyId, years, year, date_from, date_to, dateFrom, dateTo, grain, detail } = req.query;
    const cids = company_ids || company_id || companyId;
    const y = years || year;
    const df = date_from || dateFrom;
    const dt = date_to || dateTo;
    const g = grain || 'vat_period';

    // Check if requesting single-period detail
    if (detail === 'true' || detail === '1') {
      const coId = parseInt(company_id || company_ids || companyId);
      const periodKey = req.query.period;
      const cacheKey = CacheService.makeKey('vat-details', { companyId: coId, period: periodKey, dateFrom: df, dateTo: dt });
      const result = await CacheService.getOrSet(cacheKey, () => {
        const engine = new ConsolidationEngine();
        return engine.getVatDetails({
          companyId: coId,
          period: periodKey,
          dateFrom: df,
          dateTo: dt
        });
      });
      return res.json(result);
    }

    const cacheKey = CacheService.makeKey('vat', { companyIds: cids, years: y, dateFrom: df, dateTo: dt, grain: g });
    const result = await CacheService.getOrSet(cacheKey, () => {
      const engine = new ConsolidationEngine();
      return engine.getVatReport({
        companyIds: cids,
        years: y,
        dateFrom: df,
        dateTo: dt,
        grain: g
      });
    });
    res.json(result);
  } catch (err) {
    console.error('[API /vat] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.get('/vat-details', async (req, res) => {
  try {
    const { company_id, companyId, period, date_from, date_to, dateFrom, dateTo } = req.query;
    const coId = parseInt(company_id || companyId);
    if (!coId) return res.status(400).json({ error: 'company_id is required' });
    const df = date_from || dateFrom;
    const dt = date_to || dateTo;

    const cacheKey = CacheService.makeKey('vat-details', { companyId: coId, period, dateFrom: df, dateTo: dt });
    const result = await CacheService.getOrSet(cacheKey, () => {
      const engine = new ConsolidationEngine();
      return engine.getVatDetails({
        companyId: coId,
        period,
        dateFrom: df,
        dateTo: dt
      });
    });
    res.json(result);
  } catch (err) {
    console.error('[API /vat-details] Error:', err);
    res.status(500).json({ error: err.message });
  }
});

router.put('/companies/:id/vat-period', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { vat_period } = req.body;
    if (!['monthly', 'quarterly'].includes(vat_period)) {
      return res.status(400).json({ error: 'دورية غير صالحة (monthly أو quarterly)' });
    }
    const db = getDb();
    db.prepare('UPDATE companies SET vat_period = ? WHERE id = ?').run(vat_period, id);
    CacheService.flush();
    res.json({ success: true, vat_period });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cache Stats & Health endpoint (R2-8)
router.get('/cache/stats', (req, res) => {
  res.json(CacheService.getStats());
});

module.exports = router;
