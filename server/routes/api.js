const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');
const ConsolidationEngine = require('../services/consolidation');
const CacheService = require('../services/cache');
const SyncEngine = require('../services/sync-engine');
const OdooConnector = require('../services/odoo-connector');
const { reschedule, getSchedulerStatus } = require('../cron/scheduler');

// Helper to parse companyIds from query
function parseCompanyIds(query) {
  if (!query.companyIds) return null;
  if (Array.isArray(query.companyIds)) return query.companyIds.map(Number);
  return query.companyIds.split(',').map(Number).filter(n => !isNaN(n));
}

// ===== COMPANIES =====
router.get('/companies', (req, res) => {
  const db = getDb();
  const companies = db.prepare(`
    SELECT c.*, oi.name as instance_name, oi.url as instance_url,
      (SELECT COUNT(*) FROM journal_items WHERE company_id = c.id) as item_count,
      (SELECT MAX(date) FROM journal_items WHERE company_id = c.id) as last_entry_date
    FROM companies c
    LEFT JOIN odoo_instances oi ON oi.id = c.odoo_instance_id
    ORDER BY c.name
  `).all();
  res.json(companies);
});

router.post('/companies', (req, res) => {
  const db = getDb();
  const { odoo_instance_id, odoo_company_id, name, currency, color } = req.body;
  const result = db.prepare(`
    INSERT INTO companies (odoo_instance_id, odoo_company_id, name, currency, color)
    VALUES (?, ?, ?, ?, ?)
  `).run(odoo_instance_id, odoo_company_id, name, currency || 'SAR', color || '#3b82f6');
  res.json({ id: result.lastInsertRowid, success: true });
});

router.put('/companies/:id', (req, res) => {
  const db = getDb();
  const { name, currency, color, is_active, odoo_instance_id } = req.body;
  db.prepare(`
    UPDATE companies SET name = COALESCE(?, name), currency = COALESCE(?, currency),
    color = COALESCE(?, color), is_active = COALESCE(?, is_active),
    odoo_instance_id = COALESCE(?, odoo_instance_id) WHERE id = ?
  `).run(name, currency, color, is_active, odoo_instance_id, req.params.id);
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
  const connector = new OdooConnector(instance.url, instance.username, instance.api_key);
  const result = await connector.testConnection(companyId);
  res.json(result);
});

// ===== REPORTS =====
router.get('/reports/dashboard', (req, res) => {
  const companyIds = parseCompanyIds(req.query);
  const { dateFrom, dateTo } = req.query;
  const cacheKey = CacheService.makeKey('dashboard', { companyIds, dateFrom, dateTo });
  
  const cached = CacheService.get(cacheKey);
  if (cached) return res.json(cached);

  const engine = new ConsolidationEngine();
  const data = engine.getDashboardKPIs({ companyIds, dateFrom, dateTo });
  CacheService.set(cacheKey, data);
  res.json(data);
});

router.get('/reports/income-statement', (req, res) => {
  const companyIds = parseCompanyIds(req.query);
  const { dateFrom, dateTo, costCenter, project, useEliminations } = req.query;
  const cacheKey = CacheService.makeKey('income', req.query);
  
  const cached = CacheService.get(cacheKey);
  if (cached) return res.json(cached);

  const engine = new ConsolidationEngine();
  const data = engine.getIncomeStatement({ 
    companyIds, dateFrom, dateTo, costCenter, project,
    useEliminations: useEliminations === 'true'
  });
  CacheService.set(cacheKey, data);
  res.json(data);
});

router.get('/reports/balance-sheet', (req, res) => {
  const companyIds = parseCompanyIds(req.query);
  const { asOfDate, costCenter, useEliminations } = req.query;
  const cacheKey = CacheService.makeKey('balance', req.query);
  
  const cached = CacheService.get(cacheKey);
  if (cached) return res.json(cached);

  const engine = new ConsolidationEngine();
  const data = engine.getBalanceSheet({ 
    companyIds, asOfDate, costCenter,
    useEliminations: useEliminations === 'true'
  });
  CacheService.set(cacheKey, data);
  res.json(data);
});

router.get('/reports/cash-flow', (req, res) => {
  const companyIds = parseCompanyIds(req.query);
  const { dateFrom, dateTo } = req.query;
  const cacheKey = CacheService.makeKey('cashflow', req.query);
  
  const cached = CacheService.get(cacheKey);
  if (cached) return res.json(cached);

  const engine = new ConsolidationEngine();
  const data = engine.getCashFlow({ companyIds, dateFrom, dateTo });
  CacheService.set(cacheKey, data);
  res.json(data);
});

router.get('/reports/pivot', (req, res) => {
  const companyIds = parseCompanyIds(req.query);
  const { dateFrom, dateTo, measure } = req.query;
  const rows = req.query.rows ? req.query.rows.split(',') : ['account'];
  const columns = req.query.columns ? req.query.columns.split(',') : ['period'];
  const cacheKey = CacheService.makeKey('pivot', req.query);
  
  const cached = CacheService.get(cacheKey);
  if (cached) return res.json(cached);

  const engine = new ConsolidationEngine();
  const data = engine.getPivotData({ companyIds, dateFrom, dateTo, rows, columns, measure });
  CacheService.set(cacheKey, data);
  res.json(data);
});

router.get('/reports/trial-balance', (req, res) => {
  const { companyId, dateFrom, dateTo, costCenter } = req.query;
  const cacheKey = CacheService.makeKey('trial-balance', req.query);
  
  const cached = CacheService.get(cacheKey);
  if (cached) return res.json(cached);

  const engine = new ConsolidationEngine();
  const data = engine.getTrialBalance({ companyId: companyId ? parseInt(companyId) : null, dateFrom, dateTo, costCenter });
  CacheService.set(cacheKey, data);
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
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Delete a group
router.delete('/analytic-groups/:id', (req, res) => {
  try {
    const { getDb } = require('../db/connection');
    const db = getDb();
    db.prepare('DELETE FROM analytic_groups WHERE id = ?').run(req.params.id);
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
    const insertStmt = db.prepare('INSERT INTO analytic_group_mapping (company_id, analytic_account, group_id, redistributable, journal_name) VALUES (?, ?, ?, ?, ?)');
    
    db.transaction(() => {
      deleteStmt.run(parseInt(companyId));
      for (const m of mappings) {
        if (m.analytic_account && m.group_id) {
          insertStmt.run(parseInt(companyId), m.analytic_account, parseInt(m.group_id), m.redistributable ? 1 : 0, m.journal_name || null);
        }
      }
    })();
    
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
    
    const { getDb } = require('../db/connection');
    const db = getDb();
    const cid = parseInt(companyId);
    
    // Parse account codes filter
    const codes = accountCodes ? accountCodes.split(',').map(c => c.trim()) : [];
    let accountFilter = '';
    const params = { companyId: cid, dateFrom, dateTo };
    
    if (codes.length > 0) {
      accountFilter = `AND ji.account_code IN (${codes.map((c, i) => { params[`code${i}`] = c; return `@code${i}`; }).join(',')})`;
    } else {
      // Default: receivable, payable account types
      accountFilter = `AND ji.account_type IN ('asset_receivable', 'liability_payable')`;
    }
    
    // Opening balances (before dateFrom)
    const openingRows = db.prepare(`
      SELECT 
        ji.account_code, MIN(ji.account_name) as account_name,
        CASE WHEN ji.partner_name IS NULL OR TRIM(ji.partner_name) = '' THEN 'بدون شريك' ELSE TRIM(ji.partner_name) END as partner_name,
        MAX(ji.partner_id) as partner_id,
        SUM(ji.debit) as total_debit,
        SUM(ji.credit) as total_credit
      FROM journal_items ji
      WHERE ji.move_state = 'posted'
        AND ji.company_id = @companyId
        AND (ji.move_name IS NULL OR ji.move_name NOT LIKE 'CLOSING/%')
        ${accountFilter}
        AND ji.date < @dateFrom
      GROUP BY ji.account_code, CASE WHEN ji.partner_name IS NULL OR TRIM(ji.partner_name) = '' THEN 'بدون شريك' ELSE TRIM(ji.partner_name) END
    `).all(params);
    
    // Period movement (between dateFrom and dateTo)
    const periodRows = db.prepare(`
      SELECT 
        ji.account_code, MIN(ji.account_name) as account_name,
        CASE WHEN ji.partner_name IS NULL OR TRIM(ji.partner_name) = '' THEN 'بدون شريك' ELSE TRIM(ji.partner_name) END as partner_name,
        MAX(ji.partner_id) as partner_id,
        SUM(ji.debit) as total_debit,
        SUM(ji.credit) as total_credit
      FROM journal_items ji
      WHERE ji.move_state = 'posted'
        AND ji.company_id = @companyId
        AND (ji.move_name IS NULL OR ji.move_name NOT LIKE 'CLOSING/%')
        ${accountFilter}
        AND ji.date >= @dateFrom AND ji.date <= @dateTo
      GROUP BY ji.account_code, CASE WHEN ji.partner_name IS NULL OR TRIM(ji.partner_name) = '' THEN 'بدون شريك' ELSE TRIM(ji.partner_name) END
    `).all(params);
    
    // Merge data
    const accountMap = {};
    
    // Helper to create empty entry
    const makeEntry = (row) => ({
      account_code: row.account_code,
      account_name: row.account_name,
      partner_name: row.partner_name,
      partner_id: row.partner_id,
      raw_open_debit: 0, raw_open_credit: 0,
      period_debit: 0, period_credit: 0,
      open_debit: 0, open_credit: 0,
      close_debit: 0, close_credit: 0,
    });
    
    for (const row of openingRows) {
      const key = `${row.account_code}::${row.partner_name}`;
      if (!accountMap[key]) accountMap[key] = makeEntry(row);
      accountMap[key].raw_open_debit += row.total_debit || 0;
      accountMap[key].raw_open_credit += row.total_credit || 0;
    }
    
    for (const row of periodRows) {
      const key = `${row.account_code}::${row.partner_name}`;
      if (!accountMap[key]) accountMap[key] = makeEntry(row);
      accountMap[key].period_debit += row.total_debit || 0;
      accountMap[key].period_credit += row.total_credit || 0;
    }
    
    // Calculate net balances per accounting standards
    let accounts = Object.values(accountMap).map(a => {
      // Opening: net balance (debit or credit)
      const openNet = a.raw_open_debit - a.raw_open_credit;
      if (openNet >= 0) {
        a.open_debit = openNet;
        a.open_credit = 0;
      } else {
        a.open_debit = 0;
        a.open_credit = Math.abs(openNet);
      }
      
      // Period: gross debit / credit (already set)
      
      // Closing: opening net + period movement
      const closeNet = openNet + a.period_debit - a.period_credit;
      if (closeNet >= 0) {
        a.close_debit = closeNet;
        a.close_credit = 0;
      } else {
        a.close_debit = 0;
        a.close_credit = Math.abs(closeNet);
      }
      
      // Remove raw fields
      delete a.raw_open_debit;
      delete a.raw_open_credit;
      
      return a;
    });
    
    // Filter out completely zero accounts to ensure no empty/no-movement entries appear
    accounts = accounts.filter(a => 
      a.open_debit !== 0 || a.open_credit !== 0 || 
      a.period_debit !== 0 || a.period_credit !== 0 || 
      a.close_debit !== 0 || a.close_credit !== 0
    );

    // Sort: by account_code then partner_name
    accounts.sort((a, b) => {
      if (a.account_code !== b.account_code) return a.account_code.localeCompare(b.account_code);
      return (a.partner_name || '').localeCompare(b.partner_name || '');
    });
    
    // Get distinct accounts for filter dropdown
    const distinctAccounts = db.prepare(`
      SELECT DISTINCT ji.account_code, MIN(ji.account_name) as account_name, ji.account_type
      FROM journal_items ji
      WHERE ji.company_id = @companyId AND ji.move_state = 'posted'
        AND ji.account_type IN ('asset_receivable', 'liability_payable', 'asset_current', 'liability_current')
      GROUP BY ji.account_code
      ORDER BY ji.account_code
    `).all({ companyId: cid });
    
    res.json({ accounts, distinctAccounts });
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
router.get('/filters', (req, res) => {
  const companyIds = parseCompanyIds(req.query);
  const engine = new ConsolidationEngine();
  const data = engine.getFilterOptions({ companyIds });
  res.json(data);
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
    const { url, username, password, company_id } = req.body;
    if (!url || !username || !password) {
      return res.status(400).json({ success: false, message: 'يجب تقديم الرابط واسم المستخدم وكلمة المرور' });
    }
    const connector = new OdooConnector(url, username, password);
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
    res.json({ started: true, message: 'بدأت مزامنة جميع الشركات' });
    
    engine.syncAll().then(results => {
      CacheService.flush();
      console.log('[API] Sync all completed:', results);
    }).catch(err => {
      console.error('[API] Sync all failed:', err.message);
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
router.get('/presentation/data', (req, res) => {
  try {
    const { companyIds, years } = req.query;
    const customFrom = req.query.dateFrom || null;
    const customTo = req.query.dateTo || null;
    console.log('[Presentation] Query:', { companyIds, years, customFrom, customTo });
    const db = getDb();
    const ids = companyIds ? companyIds.split(',').map(Number) : [];
    const yearList = years ? years.split(',') : [];
    
    function getKpis(cid, dateFrom, dateTo) {
      const p = { companyId: cid, dateFrom, dateTo };
      const qr = (sql) => db.prepare(sql).get(p)?.total || 0;
      const rev = qr(`SELECT COALESCE(SUM(credit)-SUM(debit),0) as total FROM journal_items WHERE company_id=@companyId AND date>=@dateFrom AND date<=@dateTo AND account_type IN ('income','income_other') AND move_state='posted'`);
      const exp = qr(`SELECT COALESCE(SUM(debit)-SUM(credit),0) as total FROM journal_items WHERE company_id=@companyId AND date>=@dateFrom AND date<=@dateTo AND account_type IN ('expense','expense_direct','expense_depreciation') AND move_state='posted'`);
      const ast = qr(`SELECT COALESCE(SUM(debit)-SUM(credit),0) as total FROM journal_items WHERE company_id=@companyId AND date<=@dateTo AND account_type LIKE 'asset%' AND move_state='posted'`);
      const liab = qr(`SELECT COALESCE(SUM(credit)-SUM(debit),0) as total FROM journal_items WHERE company_id=@companyId AND date<=@dateTo AND account_type LIKE 'liability%' AND move_state='posted'`);
      const today = new Date().toISOString().slice(0, 10);
      const cash = db.prepare(`SELECT COALESCE(SUM(debit)-SUM(credit),0) as total FROM journal_items WHERE company_id=@companyId AND date<=@today AND account_name LIKE '%ضمان%' AND move_state='posted'`).get({...p, today})?.total || 0;
      // Closing receivables = balance at end of period
      const closingRecv = qr(`SELECT COALESCE(SUM(debit)-SUM(credit),0) as total FROM journal_items WHERE company_id=@companyId AND date<=@dateTo AND account_type='asset_receivable' AND move_state='posted'`);
      // Opening receivables = balance before the period starts
      const openingRecv = qr(`SELECT COALESCE(SUM(debit)-SUM(credit),0) as total FROM journal_items WHERE company_id=@companyId AND date<@dateFrom AND account_type='asset_receivable' AND move_state='posted'`);
      const pay = qr(`SELECT COALESCE(SUM(credit)-SUM(debit),0) as total FROM journal_items WHERE company_id=@companyId AND date<=@dateTo AND account_type='liability_payable' AND move_state='posted'`);
      const topAcc = db.prepare(`SELECT account_code,account_name,SUM(debit) as total_debit,SUM(credit) as total_credit FROM journal_items WHERE company_id=@companyId AND date>=@dateFrom AND date<=@dateTo AND move_state='posted' GROUP BY account_code ORDER BY (SUM(debit)+SUM(credit)) DESC LIMIT 5`).all(p);
      // Collected = opening receivables + period revenue - closing receivables
      const collected = openingRecv + rev - closingRecv;
      const remaining = rev - collected;
      return {
        revenue: rev, expenses: exp, netIncome: rev - exp,
        assets: ast, liabilities: liab, equity: ast - liab,
        cash, receivables: closingRecv, openingReceivables: openingRecv,
        collected, remaining, payables: pay,
        profitMargin: rev > 0 ? ((rev - exp) / rev * 100) : 0,
        expenseRatio: rev > 0 ? (exp / rev * 100) : 0,
        collectionRate: rev > 0 ? (collected / rev * 100) : 0,
        remainingRate: rev > 0 ? (remaining / rev * 100) : 0,
        topAccounts: topAcc,
      };
    }
    
    function sumKpis(arr) {
      const t = { revenue:0,expenses:0,netIncome:0,assets:0,liabilities:0,equity:0,cash:0,receivables:0,openingReceivables:0,collected:0,remaining:0,payables:0 };
      for (const k of arr) for (const key of Object.keys(t)) t[key] += k[key] || 0;
      t.profitMargin = t.revenue > 0 ? (t.netIncome / t.revenue * 100) : 0;
      t.expenseRatio = t.revenue > 0 ? (t.expenses / t.revenue * 100) : 0;
      t.collectionRate = t.revenue > 0 ? (t.collected / t.revenue * 100) : 0;
      t.remainingRate = t.revenue > 0 ? (t.remaining / t.revenue * 100) : 0;
      return t;
    }
    
    function getHierarchyData(cid, dateFrom, dateTo) {
      const p = { companyId: cid, dateFrom, dateTo };
      
      // Revenue/Expenses by CostCenter + Partner
      const ccPartner = db.prepare(`
        SELECT COALESCE(NULLIF(analytic_account,''),'بدون مركز') as cc,
          COALESCE(NULLIF(partner_name,''),'بدون شريك') as partner,
          COALESCE(SUM(CASE WHEN account_type IN ('income','income_other') THEN credit-debit ELSE 0 END),0) as revenue,
          COALESCE(SUM(CASE WHEN account_type IN ('expense','expense_direct','expense_depreciation') THEN debit-credit ELSE 0 END),0) as expenses
        FROM journal_items
        WHERE company_id=@companyId AND date>=@dateFrom AND date<=@dateTo AND move_state='posted'
        GROUP BY cc, partner
      `).all(p);
      
      // Receivables by partner
      const recvClose = db.prepare(`SELECT COALESCE(NULLIF(partner_name,''),'بدون شريك') as partner, SUM(debit-credit) as bal FROM journal_items WHERE company_id=@companyId AND date<=@dateTo AND account_type='asset_receivable' AND move_state='posted' GROUP BY partner`).all(p);
      const recvOpen = db.prepare(`SELECT COALESCE(NULLIF(partner_name,''),'بدون شريك') as partner, SUM(debit-credit) as bal FROM journal_items WHERE company_id=@companyId AND date<@dateFrom AND account_type='asset_receivable' AND move_state='posted' GROUP BY partner`).all(p);
      const closeMap = Object.fromEntries(recvClose.map(r=>[r.partner,r.bal]));
      const openMap = Object.fromEntries(recvOpen.map(r=>[r.partner,r.bal]));
      
      // Build costCenters → partners hierarchy
      // First: compute per-partner total revenue (across all CCs) for proportional distribution
      const partnerTotalRev = {};
      for (const row of ccPartner) {
        partnerTotalRev[row.partner] = (partnerTotalRev[row.partner] || 0) + row.revenue;
      }
      // Per-partner global collected
      const partnerGlobalCollected = {};
      for (const partner of Object.keys(partnerTotalRev)) {
        const opn = openMap[partner] || 0, cls = closeMap[partner] || 0;
        partnerGlobalCollected[partner] = opn + partnerTotalRev[partner] - cls;
      }

      const ccMap = {};
      for (const row of ccPartner) {
        if (!ccMap[row.cc]) ccMap[row.cc] = { name: row.cc, revenue:0, expenses:0, partners:[] };
        ccMap[row.cc].revenue += row.revenue;
        ccMap[row.cc].expenses += row.expenses;
        // Distribute collected proportionally by revenue share within this partner
        const totalRevForPartner = partnerTotalRev[row.partner] || 0;
        const revShare = totalRevForPartner > 0 ? (row.revenue / totalRevForPartner) : 0;
        const collected = (partnerGlobalCollected[row.partner] || 0) * revShare;
        const remaining = row.revenue - collected;
        ccMap[row.cc].partners.push({
          name: row.partner, revenue: row.revenue, expenses: row.expenses,
          netIncome: row.revenue - row.expenses, collected, remaining,
          collectionRate: row.revenue > 0 ? (collected/row.revenue*100) : 0,
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
        SELECT COALESCE(NULLIF(analytic_account,''),'بدون مركز') as cc,
          account_code, account_name, account_type,
          SUM(debit) as total_debit, SUM(credit) as total_credit
        FROM journal_items
        WHERE company_id=@companyId AND date>=@dateFrom AND date<=@dateTo AND move_state='posted'
          AND account_type IN ('income','income_other','expense','expense_direct','expense_depreciation')
        GROUP BY cc, account_code ORDER BY (SUM(debit)+SUM(credit)) DESC
      `).all(p);
      
      const atMap = {};
      for (const row of ccAccount) {
        if (!atMap[row.cc]) atMap[row.cc] = { name: row.cc, revenue:0, expenses:0, accounts:[] };
        const isIncome = row.account_type.startsWith('income');
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
        SELECT account_code, account_name, account_type,
          COALESCE(NULLIF(analytic_account,''),'\u0628\u062f\u0648\u0646 \u0645\u0631\u0643\u0632') as cc,
          CAST(strftime('%m', date) AS INTEGER) as month,
          COALESCE(SUM(CASE WHEN account_type IN ('income','income_other') THEN credit-debit ELSE 0 END),0) as revenue,
          COALESCE(SUM(CASE WHEN account_type IN ('expense','expense_direct','expense_depreciation') THEN debit-credit ELSE 0 END),0) as expenses
        FROM journal_items
        WHERE company_id=@companyId AND date>=@dateFrom AND date<=@dateTo AND move_state='posted'
          AND account_type IN ('income','income_other','expense','expense_direct','expense_depreciation')
        GROUP BY account_code, account_name, account_type, cc, month
        ORDER BY cc, account_code, month
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
        // Recalculate collection based on adjusted revenue
        kpis.remaining = kpis.revenue - kpis.collected;
        kpis.collectionRate = kpis.revenue > 0 ? (kpis.collected / kpis.revenue * 100) : 0;
        kpis.remainingRate = kpis.revenue > 0 ? (kpis.remaining / kpis.revenue * 100) : 0;

        const entry = { companyId: cid, companyName: company.name, currency: company.currency || 'SAR', kpis, topAccounts: kpis.topAccounts, costCenters: hd.costCenters, accountTree: hd.accountTree, pivotData: pivot };
        delete entry.kpis.topAccounts;
        companies.push(entry);
        allKpis.push(entry.kpis);
      }
      yearlyData[yr] = { companies, totals: sumKpis(companies.map(c => c.kpis)), dateFrom, dateTo };
    }
    
    res.json({ yearlyData, years: yearList, grandTotals: sumKpis(allKpis) });
  } catch (err) {
    console.error('Presentation data error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ===== GUARANTEE MANAGEMENT =====
// List all guarantee journal items with release status
router.get('/guarantees', (req, res) => {
  try {
    const companyIds = parseCompanyIds(req.query);
    const db = getDb();
    const ids = companyIds || db.prepare('SELECT id FROM companies').all().map(c => c.id);
    const today = new Date().toISOString().slice(0, 10);
    const results = [];
    for (const cid of ids) {
      const company = db.prepare('SELECT name FROM companies WHERE id = ?').get(cid);
      if (!company) continue;
      const items = db.prepare(`
        SELECT ji.id, ji.account_code, ji.account_name, ji.move_name, ji.date, ji.label,
          ji.partner_name, ji.debit, ji.credit, (ji.debit - ji.credit) as balance,
          CASE WHEN gr.id IS NOT NULL THEN 1 ELSE 0 END as is_released,
          gr.released_date, gr.notes as release_notes
        FROM journal_items ji
        LEFT JOIN guarantee_releases gr ON gr.company_id = ji.company_id AND gr.account_code = ji.account_code AND gr.move_name = ji.move_name
        WHERE ji.company_id = ? AND ji.account_name LIKE '%ضمان%' AND ji.move_state = 'posted' AND ji.date <= ?
        ORDER BY ji.date DESC
      `).all(cid, today);
      if (items.length) {
        results.push({ companyId: cid, companyName: company.name, items });
      }
    }
    res.json(results);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Mark a guarantee as released
router.post('/guarantees/release', (req, res) => {
  try {
    const { companyId, accountCode, moveName, releasedDate, notes } = req.body;
    const db = getDb();
    db.prepare(`INSERT OR REPLACE INTO guarantee_releases (company_id, account_code, move_name, released_date, notes) VALUES (?, ?, ?, ?, ?)`)
      .run(companyId, accountCode, moveName, releasedDate || new Date().toISOString().slice(0, 10), notes || '');
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
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Sub-items: delete
router.delete('/guarantee-sub-items/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM guarantee_sub_items WHERE id = ?').run(req.params.id);
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
      sql += ` WHERE ji.company_id = ? AND ji.account_name LIKE '%ضمان%' AND ji.move_state = 'posted' AND ji.date <= ?`;
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
    const db = getDb();
    if (!companyIds || !companyIds.length) return res.json([]);
    const today = new Date().toISOString().slice(0, 10);
    const results = [];
    for (const cid of companyIds) {
      const company = db.prepare('SELECT name FROM companies WHERE id = ?').get(cid);
      if (!company) continue;
      const items = db.prepare(`
        SELECT ji.account_code, ji.account_name, ji.move_name, ji.date, ji.label,
          ji.partner_name, ji.debit, ji.credit, (ji.debit - ji.credit) as balance,
          CASE WHEN gr.id IS NOT NULL THEN 1 ELSE 0 END as is_released
        FROM journal_items ji
        LEFT JOIN guarantee_releases gr ON gr.company_id = ji.company_id AND gr.account_code = ji.account_code AND gr.move_name = ji.move_name
        WHERE ji.company_id = ? AND ji.account_name LIKE '%ضمان%' AND ji.move_state = 'posted' AND ji.date <= ?
        ORDER BY ji.date
      `).all(cid, today);

      const pendingItems = [];
      for (const item of items) {
        const subs = db.prepare(`SELECT * FROM guarantee_sub_items WHERE parent_company_id = ? AND parent_account_code = ? AND parent_move_name = ? ORDER BY created_at`).all(cid, item.account_code, item.move_name);
        if (subs.length > 0) {
          subs.filter(s => !s.is_released).forEach(s => {
            pendingItems.push({ description: s.description, amount: s.amount, date: item.date, account: item.account_name, moveName: item.move_name, partner: item.partner_name, type: 'sub' });
          });
        } else if (!item.is_released) {
          pendingItems.push({ description: item.label || item.account_name, amount: Math.abs(item.balance), date: item.date, account: item.account_name, moveName: item.move_name, partner: item.partner_name, type: 'item' });
        }
      }
      if (pendingItems.length) {
        results.push({ companyId: cid, companyName: company.name, items: pendingItems, date: today });
      }
    }
    res.json(results);
  } catch (err) { res.status(500).json({ error: err.message }); }
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

module.exports = router;
