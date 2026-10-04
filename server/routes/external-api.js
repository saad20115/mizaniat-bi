/**
 * External API for Budget Estimation Program
 * Isolated from main api.js — safe to modify without affecting existing features.
 * 
 * Endpoints:
 *   GET  /api/external/expenses     — Expense data with single date range
 *   POST /api/external/expenses     — Expense data with MULTIPLE periods per cost center
 *   GET  /api/external/cost-centers — List of cost centers
 *   GET  /api/external/groups       — Analytic groups
 *   GET  /api/external/companies    — Companies list
 */

const express = require('express');
const router = express.Router();
const { getDb } = require('../db/connection');
const ConsolidationEngine = require('../services/consolidation');

// ─────────────────────────────────────────────
// Helper: query expenses with admin cost redistribution
// Returns expense data with allocatedAdmin and totalExpenses
// (matching the presentation redistribution table logic)
// ─────────────────────────────────────────────
function queryExpenses(db, cid, dateFrom, dateTo, includeMonthly, ccFilter) {
  const engine = new ConsolidationEngine(db);
  return engine.getAdminExpenseRedistribution(cid, dateFrom, dateTo, includeMonthly, ccFilter);
}

// ─────────────────────────────────────────────
// GET /expenses — single date range
// ─────────────────────────────────────────────
router.get('/expenses', (req, res) => {
  try {
    const db = getDb();
    const { companyIds, dateFrom, costCenters, groupIds, monthly } = req.query;
    const dateTo = req.query.dateTo || new Date().toISOString().slice(0, 10);

    if (!companyIds) {
      return res.status(400).json({
        error: 'companyIds is required',
        usage: '/api/external/expenses?companyIds=1,2'
      });
    }

    const effectiveDateFrom = dateFrom || '2000-01-01';

    const ids = companyIds.split(',').map(Number).filter(n => !isNaN(n));
    if (ids.length === 0) return res.status(400).json({ error: 'Invalid companyIds' });

    // Build cost center filter
    let ccFilter = null;
    if (costCenters) ccFilter = costCenters.split(',').map(s => s.trim()).filter(Boolean);
    if (groupIds) {
      const gids = groupIds.split(',').map(Number).filter(n => !isNaN(n));
      if (gids.length > 0) {
        const placeholders = gids.map(() => '?').join(',');
        const mappings = db.prepare(`SELECT DISTINCT analytic_account FROM analytic_group_mapping WHERE group_id IN (${placeholders})`).all(...gids);
        const groupCCs = mappings.map(m => m.analytic_account);
        ccFilter = ccFilter ? ccFilter.filter(cc => groupCCs.includes(cc)) : groupCCs;
      }
    }

    const includeMonthly = monthly === 'true' || monthly === '1';
    const results = [];
    for (const cid of ids) {
      results.push(...queryExpenses(db, cid, effectiveDateFrom, dateTo, includeMonthly, ccFilter));
    }

    let totalExpenses = 0;
    const accountSet = new Set();
    results.forEach(r => { totalExpenses += r.totalExpenses; accountSet.add(r.accountCode); });

    res.json({
      filters: { companyIds: ids, dateFrom, dateTo, costCenters: ccFilter || 'all', monthly: includeMonthly },
      summary: { totalExpenses, totalAccounts: accountSet.size, totalRows: results.length },
      data: results,
    });
  } catch (err) {
    console.error('[External API] Expenses error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// POST /expenses — MULTIPLE periods per cost center
//
// Body format:
// {
//   "companyIds": [1,2,3],
//   "monthly": true,
//   "periods": [
//     { "dateFrom": "2025-08-01", "dateTo": "2026-03-16", "costCenters": ["المجلس التنسيقي"] },
//     { "dateFrom": "2025-10-01", "costCenters": ["مشروع أ", "مشروع ب"] },
//     { "dateFrom": "2025-10-01", "groupIds": [2] }
//   ]
// }
//
// Each period can have:
//   dateFrom  (required) — start date
//   dateTo    (optional) — defaults to today
//   costCenters (optional) — specific cost center names
//   groupIds    (optional) — group IDs to derive cost centers from
// ─────────────────────────────────────────────
router.post('/expenses', (req, res) => {
  try {
    const db = getDb();
    const { companyIds, periods, monthly } = req.body;

    if (!companyIds || !Array.isArray(companyIds) || companyIds.length === 0) {
      return res.status(400).json({ error: 'companyIds array is required' });
    }
    if (!periods || !Array.isArray(periods) || periods.length === 0) {
      return res.status(400).json({
        error: 'periods array is required',
        usage: {
          companyIds: [1, 2],
          monthly: true,
          periods: [
            { dateFrom: '2025-08-01', costCenters: ['المجلس التنسيقي'] },
            { dateFrom: '2025-10-01', groupIds: [2] }
          ]
        }
      });
    }

    const ids = companyIds.map(Number).filter(n => !isNaN(n));
    const includeMonthly = monthly === true || monthly === 'true';
    const allResults = [];
    const today = new Date().toISOString().slice(0, 10);

    for (const period of periods) {
      if (!period.dateFrom) {
        period.dateFrom = '2000-01-01';
      }
      const dateTo = period.dateTo || today;

      // Build cost center filter for this period
      let ccFilter = null;
      if (period.costCenters && Array.isArray(period.costCenters)) {
        ccFilter = period.costCenters.map(s => s.trim()).filter(Boolean);
      }
      if (period.groupIds && Array.isArray(period.groupIds)) {
        const gids = period.groupIds.map(Number).filter(n => !isNaN(n));
        if (gids.length > 0) {
          const placeholders = gids.map(() => '?').join(',');
          const mappings = db.prepare(`SELECT DISTINCT analytic_account FROM analytic_group_mapping WHERE group_id IN (${placeholders})`).all(...gids);
          const groupCCs = mappings.map(m => m.analytic_account);
          ccFilter = ccFilter ? ccFilter.filter(cc => groupCCs.includes(cc)) : groupCCs;
        }
      }

      for (const cid of ids) {
        allResults.push(...queryExpenses(db, cid, period.dateFrom, dateTo, includeMonthly, ccFilter));
      }
    }

    let totalExpenses = 0;
    const accountSet = new Set();
    allResults.forEach(r => { totalExpenses += r.totalExpenses; accountSet.add(r.accountCode); });

    res.json({
      filters: { companyIds: ids, periods: periods.length, monthly: includeMonthly },
      summary: { totalExpenses, totalAccounts: accountSet.size, totalRows: allResults.length },
      data: allResults,
    });
  } catch (err) {
    console.error('[External API] Multi-period expenses error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// GET /expenses/query — multi-period via GET link
// Accepts the same JSON config as POST, but base64-encoded in the URL:
//   /api/external/expenses/query?config=BASE64_ENCODED_JSON
// This allows sharing the query as a simple URL.
// ─────────────────────────────────────────────
router.get('/expenses/query', (req, res) => {
  try {
    const { config } = req.query;
    if (!config) {
      return res.status(400).json({
        error: 'config parameter is required (base64-encoded JSON)',
        usage: '/api/external/expenses/query?config=BASE64_JSON'
      });
    }

    let body;
    try {
      body = JSON.parse(Buffer.from(config, 'base64').toString('utf8'));
    } catch (e) {
      return res.status(400).json({ error: 'Invalid config: must be base64-encoded JSON' });
    }

    const db = getDb();
    const { companyIds, periods, monthly } = body;

    if (!companyIds || !Array.isArray(companyIds) || companyIds.length === 0) {
      return res.status(400).json({ error: 'companyIds array is required in config' });
    }
    if (!periods || !Array.isArray(periods) || periods.length === 0) {
      return res.status(400).json({ error: 'periods array is required in config' });
    }

    const ids = companyIds.map(Number).filter(n => !isNaN(n));
    const includeMonthly = monthly === true || monthly === 'true';
    const allResults = [];
    const today = new Date().toISOString().slice(0, 10);

    for (const period of periods) {
      if (!period.dateFrom) {
        period.dateFrom = '2000-01-01';
      }
      const dateTo = period.dateTo || today;
      let ccFilter = null;
      if (period.costCenters && Array.isArray(period.costCenters)) {
        ccFilter = period.costCenters.map(s => s.trim()).filter(Boolean);
      }
      if (period.groupIds && Array.isArray(period.groupIds)) {
        const gids = period.groupIds.map(Number).filter(n => !isNaN(n));
        if (gids.length > 0) {
          const placeholders = gids.map(() => '?').join(',');
          const mappings = db.prepare(`SELECT DISTINCT analytic_account FROM analytic_group_mapping WHERE group_id IN (${placeholders})`).all(...gids);
          const groupCCs = mappings.map(m => m.analytic_account);
          ccFilter = ccFilter ? ccFilter.filter(cc => groupCCs.includes(cc)) : groupCCs;
        }
      }
      for (const cid of ids) {
        allResults.push(...queryExpenses(db, cid, period.dateFrom, dateTo, includeMonthly, ccFilter));
      }
    }

    let totalExpenses = 0;
    const accountSet = new Set();
    allResults.forEach(r => { totalExpenses += r.totalExpenses; accountSet.add(r.accountCode); });

    res.json({
      filters: { companyIds: ids, periods: periods.length, monthly: includeMonthly },
      summary: { totalExpenses, totalAccounts: accountSet.size, totalRows: allResults.length },
      data: allResults,
    });
  } catch (err) {
    console.error('[External API] Query expenses error:', err);
    res.status(500).json({ error: err.message });
  }
});
// ─────────────────────────────────────────────
// GET /cost-centers
// ─────────────────────────────────────────────
router.get('/cost-centers', (req, res) => {
  try {
    const db = getDb();
    const { companyIds } = req.query;
    let sql = `
      SELECT DISTINCT COALESCE(NULLIF(analytic_account,''),'بدون مركز') as name, company_id
      FROM journal_items WHERE move_state = 'posted'
    `;
    const params = [];
    if (companyIds) {
      const ids = companyIds.split(',').map(Number).filter(n => !isNaN(n));
      if (ids.length > 0) {
        sql += ` AND company_id IN (${ids.map(() => '?').join(',')})`;
        params.push(...ids);
      }
    }
    sql += ` ORDER BY name`;
    const rows = db.prepare(sql).all(...params);

    const mappings = db.prepare(
      `SELECT m.analytic_account, m.company_id, g.id as group_id, g.name as group_name, m.redistributable
       FROM analytic_group_mapping m JOIN analytic_groups g ON g.id = m.group_id`
    ).all();
    const mapLookup = {};
    for (const m of mappings) mapLookup[`${m.company_id}_${m.analytic_account}`] = m;

    const result = rows.map(r => {
      const m = mapLookup[`${r.company_id}_${r.name}`];
      return { name: r.name, companyId: r.company_id, groupId: m?.group_id || null, groupName: m?.group_name || null, redistributable: m?.redistributable === 1 };
    });
    res.json({ total: result.length, data: result });
  } catch (err) {
    console.error('[External API] Cost centers error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// GET /groups
// ─────────────────────────────────────────────
router.get('/groups', (req, res) => {
  try {
    const db = getDb();
    const groups = db.prepare('SELECT id, name, color, sort_order FROM analytic_groups ORDER BY sort_order, name').all();
    res.json({ total: groups.length, data: groups });
  } catch (err) {
    console.error('[External API] Groups error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// GET /companies
// ─────────────────────────────────────────────
router.get('/companies', (req, res) => {
  try {
    const db = getDb();
    const companies = db.prepare('SELECT id, name, currency FROM companies ORDER BY name').all();
    res.json({ total: companies.length, data: companies });
  } catch (err) {
    console.error('[External API] Companies error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────
// GET /special-expenses (Hajj & Coordination Council)
// Custom pre-configured ranges:
// - Council: >= 2025-08-01
// - Hajj: >= 2025-10-01
// ─────────────────────────────────────────────
router.get('/special-expenses', (req, res) => {
  try {
    const db = getDb();
    const today = new Date().toISOString().slice(0, 10);
    const rows = db.prepare(`
      SELECT 
        company_id as companyId,
        (SELECT name FROM companies WHERE id = company_id) as companyName,
        COALESCE(NULLIF(analytic_account,''),'بدون مركز') as costCenter,
        account_code as accountCode, 
        account_name as accountName, 
        date,
        (debit - credit) as expenses,
        CASE 
          WHEN analytic_account LIKE '%تنسيقي%' THEN 'المجلس التنسيقي'
          ELSE 'مشاريع الحج'
        END as projectCategory
      FROM journal_items
      WHERE move_state = 'posted'
        AND account_type IN ('expense','expense_direct','expense_depreciation')
        AND (
          ( (analytic_account LIKE '%تنسيقي%') AND date >= '2025-08-01' )
          OR
          ( (analytic_account LIKE '%حج%' OR analytic_account LIKE '%Hajj%') AND date >= '2025-10-01' )
        )
      ORDER BY date DESC
    `).all();

    let totalCouncil = 0;
    let totalHajj = 0;
    rows.forEach(r => {
      if (r.projectCategory === 'المجلس التنسيقي') totalCouncil += r.expenses;
      else totalHajj += r.expenses;
    });

    res.json({
      filters: { 
        councilFrom: '2025-08-01', 
        hajjFrom: '2025-10-01', 
        dateTo: today 
      },
      summary: { 
        totalExpenses: totalCouncil + totalHajj,
        totalCouncil,
        totalHajj,
        totalRows: rows.length
      },
      data: rows
    });
  } catch (err) {
    console.error('[External API] Special expenses error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
