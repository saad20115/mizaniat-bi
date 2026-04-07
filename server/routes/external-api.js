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

// ─────────────────────────────────────────────
// Helper: query expenses with admin cost redistribution
// Returns expense data with allocatedAdmin and totalExpenses
// (matching the presentation redistribution table logic)
// ─────────────────────────────────────────────
function queryExpenses(db, cid, dateFrom, dateTo, includeMonthly, ccFilter) {
  const company = db.prepare('SELECT id, name FROM companies WHERE id = ?').get(cid);
  if (!company) return [];

  const p = { companyId: cid, dateFrom, dateTo };

  // 1. Load group mappings and redistributable flags
  const groupMap = {};
  const redistSet = new Set();
  const mappings = db.prepare(
    `SELECT m.analytic_account, m.redistributable, g.id as group_id, g.name as group_name
     FROM analytic_group_mapping m
     JOIN analytic_groups g ON g.id = m.group_id
     WHERE m.company_id = ?`
  ).all(cid);
  for (const m of mappings) {
    groupMap[m.analytic_account] = { id: m.group_id, name: m.group_name };
    if (m.redistributable) redistSet.add(m.analytic_account);
  }

  // 2. Query expenses per cost center (aggregated) — needed for redistribution calculation
  const ccExpenseRows = db.prepare(`
    SELECT COALESCE(NULLIF(analytic_account,''),'بدون مركز') as cost_center,
      COALESCE(SUM(debit - credit), 0) as expenses
    FROM journal_items
    WHERE company_id = @companyId AND date >= @dateFrom AND date <= @dateTo
      AND move_state = 'posted'
      AND account_type IN ('expense','expense_direct','expense_depreciation')
    GROUP BY cost_center
  `).all(p);

  // 3. Query revenue per cost center — needed for distribution ratio
  const ccRevenueRows = db.prepare(`
    SELECT COALESCE(NULLIF(analytic_account,''),'بدون مركز') as cost_center,
      COALESCE(SUM(credit - debit), 0) as revenue
    FROM journal_items
    WHERE company_id = @companyId AND date >= @dateFrom AND date <= @dateTo
      AND move_state = 'posted'
      AND account_type IN ('income','income_other')
    GROUP BY cost_center
  `).all(p);

  const ccExpMap = {}; ccExpenseRows.forEach(r => { ccExpMap[r.cost_center] = r.expenses; });
  const ccRevMap = {}; ccRevenueRows.forEach(r => { ccRevMap[r.cost_center] = r.revenue; });

  // 4. Calculate admin total expenses and target CC revenue totals
  let adminTotalExp = 0;
  const allCCs = new Set([...Object.keys(ccExpMap), ...Object.keys(ccRevMap)]);
  const targetCCs = [];
  allCCs.forEach(cc => {
    if (redistSet.has(cc)) {
      adminTotalExp += ccExpMap[cc] || 0;
    } else {
      targetCCs.push(cc);
    }
  });

  // revenue-based distribution (matching presentation.js method='revenue')
  let totalTargetRevenue = 0;
  targetCCs.forEach(cc => { totalTargetRevenue += ccRevMap[cc] || 0; });

  // Calculate allocation per target CC
  const ccAllocation = {};
  let allocSum = 0;
  const allocEntries = targetCCs.map(cc => {
    const rev = ccRevMap[cc] || 0;
    const ratio = totalTargetRevenue > 0 ? rev / totalTargetRevenue : (targetCCs.length > 0 ? 1 / targetCCs.length : 0);
    const alloc = adminTotalExp > 0 ? Math.round(adminTotalExp * ratio) : 0;
    allocSum += alloc;
    return { cc, alloc, rev };
  });

  // Fix rounding remainder — assign to CC with highest revenue
  if (adminTotalExp > 0 && allocEntries.length > 0) {
    const rem = adminTotalExp - allocSum;
    if (rem !== 0) {
      let maxIdx = 0, maxRev = 0;
      allocEntries.forEach((e, i) => { if (e.rev > maxRev) { maxRev = e.rev; maxIdx = i; } });
      allocEntries[maxIdx].alloc += rem;
    }
  }
  allocEntries.forEach(e => { ccAllocation[e.cc] = e.alloc; });

  // 5. Query detail expense rows (monthly or aggregated)
  let sql;
  if (includeMonthly) {
    sql = `
      SELECT COALESCE(NULLIF(analytic_account,''),'بدون مركز') as cost_center,
        account_code, account_name, account_type,
        CAST(strftime('%m', date) AS INTEGER) as month,
        CAST(strftime('%Y', date) AS INTEGER) as year,
        COALESCE(SUM(debit - credit), 0) as expenses
      FROM journal_items
      WHERE company_id = @companyId AND date >= @dateFrom AND date <= @dateTo
        AND move_state = 'posted'
        AND account_type IN ('expense','expense_direct','expense_depreciation')
      GROUP BY cost_center, account_code, account_name, account_type, year, month
      ORDER BY cost_center, account_code, year, month
    `;
  } else {
    sql = `
      SELECT COALESCE(NULLIF(analytic_account,''),'بدون مركز') as cost_center,
        account_code, account_name, account_type,
        COALESCE(SUM(debit - credit), 0) as expenses
      FROM journal_items
      WHERE company_id = @companyId AND date >= @dateFrom AND date <= @dateTo
        AND move_state = 'posted'
        AND account_type IN ('expense','expense_direct','expense_depreciation')
      GROUP BY cost_center, account_code, account_name, account_type
      ORDER BY cost_center, account_code
    `;
  }
  const rows = db.prepare(sql).all(p);

  // 6. Build results — exclude admin CCs, add allocation to target CCs
  const results = [];
  // Group rows by CC to aggregate totalExpenses at CC level
  const ccExpenseDetail = {};
  for (const row of rows) {
    // Skip redistributable (admin) CCs
    if (redistSet.has(row.cost_center)) continue;
    if (ccFilter && !ccFilter.includes(row.cost_center)) continue;
    if (!ccExpenseDetail[row.cost_center]) ccExpenseDetail[row.cost_center] = [];
    ccExpenseDetail[row.cost_center].push(row);
  }

  for (const [cc, ccRows] of Object.entries(ccExpenseDetail)) {
    const group = groupMap[cc] || null;
    const ccOrigExp = ccExpMap[cc] || 0;
    const ccAllocated = ccAllocation[cc] || 0;
    const ccTotalExp = ccOrigExp + ccAllocated;
    const ccRev = ccRevMap[cc] || 0;

    for (const row of ccRows) {
      const entry = {
        companyId: company.id,
        companyName: company.name,
        costCenter: row.cost_center,
        groupId: group?.id || null,
        groupName: group?.name || null,
        accountCode: row.account_code,
        accountName: row.account_name,
        originalExpenses: row.expenses,
        allocatedAdmin: ccAllocated,
        totalExpenses: ccTotalExp,
        revenue: ccRev,
        dateFrom,
        dateTo,
      };
      if (includeMonthly) { entry.month = row.month; entry.year = row.year; }
      results.push(entry);
    }
  }

  return results;
}

// ─────────────────────────────────────────────
// GET /expenses — single date range
// ─────────────────────────────────────────────
router.get('/expenses', (req, res) => {
  try {
    const db = getDb();
    const { companyIds, dateFrom, costCenters, groupIds, monthly } = req.query;
    const dateTo = req.query.dateTo || new Date().toISOString().slice(0, 10);

    if (!companyIds || !dateFrom) {
      return res.status(400).json({
        error: 'companyIds and dateFrom are required',
        usage: '/api/external/expenses?companyIds=1,2&dateFrom=2025-01-01'
      });
    }

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
      results.push(...queryExpenses(db, cid, dateFrom, dateTo, includeMonthly, ccFilter));
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
        return res.status(400).json({ error: 'Each period must have dateFrom' });
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
      if (!period.dateFrom) continue;
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
