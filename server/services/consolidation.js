const { getDb } = require('../db/connection');

class ConsolidationEngine {
  constructor() {
    this.db = getDb();
  }

  /**
   * Get consolidated income statement
   */
  getIncomeStatement({ companyIds, dateFrom, dateTo, costCenter, project, useEliminations = false }) {
    const params = {};
    let companyFilter = '';
    let dateFilter = '';
    let extraFilters = '';

    if (companyIds && companyIds.length > 0) {
      companyFilter = `AND ji.company_id IN (${companyIds.map((_, i) => `@cid${i}`).join(',')})`;
      companyIds.forEach((id, i) => { params[`cid${i}`] = id; });
    }
    if (dateFrom) { dateFilter += ' AND ji.date >= @dateFrom'; params.dateFrom = dateFrom; }
    if (dateTo) { dateFilter += ' AND ji.date <= @dateTo'; params.dateTo = dateTo; }
    if (costCenter) { extraFilters += ' AND ji.analytic_account = @costCenter'; params.costCenter = costCenter; }
    if (project) { extraFilters += ' AND ji.move_ref LIKE @project'; params.project = `%${project}%`; }

    // Revenue accounts (income types)
    const revenue = this.db.prepare(`
      SELECT 
        ji.account_code, ji.account_name, ji.account_type,
        ji.company_id, c.name as company_name,
        SUM(ji.credit - ji.debit) as amount
      FROM journal_items ji
      JOIN companies c ON c.id = ji.company_id
      WHERE ji.account_type IN ('income', 'income_other', 'revenue')
        AND ji.move_state = 'posted'
        ${companyFilter} ${dateFilter} ${extraFilters}
      GROUP BY ji.account_code, ji.account_name, ji.company_id
      ORDER BY ji.account_code
    `).all(params);

    // Expense accounts
    const expenses = this.db.prepare(`
      SELECT 
        ji.account_code, ji.account_name, ji.account_type,
        ji.company_id, c.name as company_name,
        SUM(ji.debit - ji.credit) as amount
      FROM journal_items ji
      JOIN companies c ON c.id = ji.company_id
      WHERE ji.account_type IN ('expense', 'expense_direct_cost', 'expense_depreciation', 'cost_of_revenue')
        AND ji.move_state = 'posted'
        ${companyFilter} ${dateFilter} ${extraFilters}
      GROUP BY ji.account_code, ji.account_name, ji.company_id
      ORDER BY ji.account_code
    `).all(params);

    // Calculate eliminations if requested
    let eliminations = [];
    if (useEliminations && companyIds && companyIds.length > 1) {
      eliminations = this._calculateEliminations(companyIds, dateFrom, dateTo);
    }

    return this._buildIncomeStatement(revenue, expenses, eliminations, companyIds);
  }

  /**
   * Get consolidated balance sheet
   */
  getBalanceSheet({ companyIds, asOfDate, costCenter, useEliminations = false }) {
    const params = {};
    let companyFilter = '';
    let dateFilter = '';
    let extraFilters = '';

    if (companyIds && companyIds.length > 0) {
      companyFilter = `AND ji.company_id IN (${companyIds.map((_, i) => `@cid${i}`).join(',')})`;
      companyIds.forEach((id, i) => { params[`cid${i}`] = id; });
    }
    if (asOfDate) { dateFilter = ' AND ji.date <= @asOfDate'; params.asOfDate = asOfDate; }
    if (costCenter) { extraFilters += ' AND ji.analytic_account = @costCenter'; params.costCenter = costCenter; }

    // Assets
    const assets = this.db.prepare(`
      SELECT 
        ji.account_code, ji.account_name, ji.account_type,
        ji.company_id, c.name as company_name,
        SUM(ji.debit - ji.credit) as amount
      FROM journal_items ji
      JOIN companies c ON c.id = ji.company_id
      WHERE ji.account_type IN ('asset_receivable', 'asset_cash', 'asset_current', 'asset_non_current', 'asset_prepayments', 'asset_fixed')
        AND ji.move_state = 'posted'
        ${companyFilter} ${dateFilter} ${extraFilters}
      GROUP BY ji.account_code, ji.account_name, ji.company_id
      ORDER BY ji.account_code
    `).all(params);

    // Liabilities
    const liabilities = this.db.prepare(`
      SELECT 
        ji.account_code, ji.account_name, ji.account_type,
        ji.company_id, c.name as company_name,
        SUM(ji.credit - ji.debit) as amount
      FROM journal_items ji
      JOIN companies c ON c.id = ji.company_id
      WHERE ji.account_type IN ('liability_payable', 'liability_current', 'liability_non_current', 'liability_credit_card')
        AND ji.move_state = 'posted'
        ${companyFilter} ${dateFilter} ${extraFilters}
      GROUP BY ji.account_code, ji.account_name, ji.company_id
      ORDER BY ji.account_code
    `).all(params);

    // Equity
    const equity = this.db.prepare(`
      SELECT 
        ji.account_code, ji.account_name, ji.account_type,
        ji.company_id, c.name as company_name,
        SUM(ji.credit - ji.debit) as amount
      FROM journal_items ji
      JOIN companies c ON c.id = ji.company_id
      WHERE ji.account_type IN ('equity', 'equity_unaffected')
        AND ji.move_state = 'posted'
        ${companyFilter} ${dateFilter} ${extraFilters}
      GROUP BY ji.account_code, ji.account_name, ji.company_id
      ORDER BY ji.account_code
    `).all(params);

    let eliminations = [];
    if (useEliminations && companyIds && companyIds.length > 1) {
      eliminations = this._calculateEliminations(companyIds, null, asOfDate);
    }

    return this._buildBalanceSheet(assets, liabilities, equity, eliminations, companyIds);
  }

  /**
   * Get cash flow statement
   */
  getCashFlow({ companyIds, dateFrom, dateTo }) {
    const params = {};
    let companyFilter = '';
    let dateFilter = '';

    if (companyIds && companyIds.length > 0) {
      companyFilter = `AND ji.company_id IN (${companyIds.map((_, i) => `@cid${i}`).join(',')})`;
      companyIds.forEach((id, i) => { params[`cid${i}`] = id; });
    }
    if (dateFrom) { dateFilter += ' AND ji.date >= @dateFrom'; params.dateFrom = dateFrom; }
    if (dateTo) { dateFilter += ' AND ji.date <= @dateTo'; params.dateTo = dateTo; }

    // Operating activities (income/expense accounts)
    const operating = this.db.prepare(`
      SELECT 
        ji.account_code, ji.account_name, ji.account_type,
        ji.company_id, c.name as company_name,
        SUM(ji.debit - ji.credit) as amount
      FROM journal_items ji
      JOIN companies c ON c.id = ji.company_id
      WHERE ji.account_type IN ('income', 'income_other', 'expense', 'expense_direct_cost', 'expense_depreciation', 'revenue', 'cost_of_revenue',
        'asset_receivable', 'liability_payable', 'asset_current', 'liability_current')
        AND ji.move_state = 'posted'
        ${companyFilter} ${dateFilter}
      GROUP BY ji.account_type, ji.company_id
      ORDER BY ji.account_type
    `).all(params);

    // Investing activities (fixed assets)
    const investing = this.db.prepare(`
      SELECT 
        ji.account_type,
        ji.company_id, c.name as company_name,
        SUM(ji.debit - ji.credit) as amount
      FROM journal_items ji
      JOIN companies c ON c.id = ji.company_id
      WHERE ji.account_type IN ('asset_non_current', 'asset_fixed')
        AND ji.move_state = 'posted'
        ${companyFilter} ${dateFilter}
      GROUP BY ji.account_type, ji.company_id
    `).all(params);

    // Financing activities (equity, long-term liabilities)
    const financing = this.db.prepare(`
      SELECT 
        ji.account_type,
        ji.company_id, c.name as company_name,
        SUM(ji.credit - ji.debit) as amount
      FROM journal_items ji
      JOIN companies c ON c.id = ji.company_id
      WHERE ji.account_type IN ('equity', 'equity_unaffected', 'liability_non_current')
        AND ji.move_state = 'posted'
        ${companyFilter} ${dateFilter}
      GROUP BY ji.account_type, ji.company_id
    `).all(params);

    return { operating, investing, financing };
  }

  /**
   * Get pivot table data
   */
  getPivotData({ companyIds, dateFrom, dateTo, rows, columns, measure }) {
    const params = {};
    let companyFilter = '';
    let dateFilter = '';

    if (companyIds && companyIds.length > 0) {
      companyFilter = `AND ji.company_id IN (${companyIds.map((_, i) => `@cid${i}`).join(',')})`;
      companyIds.forEach((id, i) => { params[`cid${i}`] = id; });
    }
    if (dateFrom) { dateFilter += ' AND ji.date >= @dateFrom'; params.dateFrom = dateFrom; }
    if (dateTo) { dateFilter += ' AND ji.date <= @dateTo'; params.dateTo = dateTo; }

    const measureExpr = {
      'debit': 'SUM(ji.debit)',
      'credit': 'SUM(ji.credit)',
      'balance': 'SUM(ji.debit - ji.credit)',
      'count': 'COUNT(*)'
    }[measure] || 'SUM(ji.debit - ji.credit)';

    const fieldMap = {
      'company': 'c.name',
      'account': 'ji.account_code',
      'account_name': 'ji.account_name',
      'account_type': 'ji.account_type',
      'period': 'ji.period',
      'fiscal_year': 'ji.fiscal_year',
      'journal': 'ji.journal_name',
      'partner': 'ji.partner_name',
      'cost_center': 'ji.analytic_account'
    };

    const rowFields = (rows || ['account']).map(r => fieldMap[r] || r).join(', ');
    const colFields = (columns || ['period']).map(c => fieldMap[c] || c).join(', ');
    const allFields = `${rowFields}, ${colFields}`;

    const query = `
      SELECT ${allFields}, ${measureExpr} as value
      FROM journal_items ji
      JOIN companies c ON c.id = ji.company_id
      WHERE ji.move_state = 'posted'
        ${companyFilter} ${dateFilter}
      GROUP BY ${allFields}
      ORDER BY ${rowFields}
    `;

    return this.db.prepare(query).all(params);
  }

  /**
   * Get trial balance for a single company
   */
  getTrialBalance({ companyId, dateFrom, dateTo, costCenter }) {
    const params = {};
    let companyFilter = '';
    let extraFilters = '';

    if (companyId) {
      companyFilter = 'AND ji.company_id = @companyId';
      params.companyId = companyId;
    }
    if (costCenter) { extraFilters += ' AND ji.analytic_account = @costCenter'; params.costCenter = costCenter; }

    // Opening balances: all transactions BEFORE dateFrom
    let openingRows = [];
    if (dateFrom) {
      const openParams = { ...params, dateFrom };
      openingRows = this.db.prepare(`
        SELECT 
          ji.account_code, MIN(ji.account_name) as account_name, ji.account_type,
          SUM(ji.debit) as total_debit,
          SUM(ji.credit) as total_credit
        FROM journal_items ji
        WHERE ji.move_state = 'posted'
          AND (ji.move_name IS NULL OR ji.move_name NOT LIKE 'CLOSING/%')
          ${companyFilter} ${extraFilters}
          AND ji.date < @dateFrom
        GROUP BY ji.account_code
        ORDER BY ji.account_code
      `).all(openParams);
    }

    // Period movement: transactions between dateFrom and dateTo
    let periodParams = { ...params };
    let periodDateFilter = '';
    if (dateFrom) { periodDateFilter += ' AND ji.date >= @dateFrom'; periodParams.dateFrom = dateFrom; }
    if (dateTo) { periodDateFilter += ' AND ji.date <= @dateTo'; periodParams.dateTo = dateTo; }

    const periodRows = this.db.prepare(`
      SELECT 
        ji.account_code, MIN(ji.account_name) as account_name, ji.account_type,
        SUM(ji.debit) as total_debit,
        SUM(ji.credit) as total_credit
      FROM journal_items ji
      WHERE ji.move_state = 'posted'
        AND (ji.move_name IS NULL OR ji.move_name NOT LIKE 'CLOSING/%')
        ${companyFilter} ${extraFilters}
        ${periodDateFilter}
      GROUP BY ji.account_code
      ORDER BY ji.account_code
    `).all(periodParams);

    // Merge into unified account list
    const accounts = {};
    
    for (const row of openingRows) {
      if (!accounts[row.account_code]) {
        accounts[row.account_code] = {
          account_code: row.account_code,
          account_name: row.account_name,
          account_type: row.account_type,
          open_debit: 0, open_credit: 0,
          period_debit: 0, period_credit: 0,
          close_debit: 0, close_credit: 0
        };
      }
      // Opening balance = net amount placed in debit or credit column
      const openNet = (row.total_debit || 0) - (row.total_credit || 0);
      accounts[row.account_code].open_debit = openNet > 0 ? openNet : 0;
      accounts[row.account_code].open_credit = openNet < 0 ? Math.abs(openNet) : 0;
    }

    // Apply closing entries to opening balances (virtual application)
    // Only applies closing entries from PRIOR fiscal years
    // Example: if viewing 2025, apply closing entries for 2024 and earlier
    if (dateFrom && companyId) {
      try {
        const currentFY = dateFrom.substring(0, 4);
        const cid = parseInt(companyId);
        const closingEntries = this.db.prepare(`
          SELECT * FROM closing_entries 
          WHERE company_id = @cid AND fiscal_year <= @currentFY
          ORDER BY fiscal_year
        `).all({ cid, currentFY });

        console.log(`[TrialBalance] Checking closing entries: companyId=${cid}, currentFY=${currentFY}, found=${closingEntries.length}`);

        for (const ce of closingEntries) {
          const lines = JSON.parse(ce.lines_json || '[]');
          for (const line of lines) {
            const code = line.account_code;
            if (accounts[code]) {
              accounts[code].open_debit += (line.debit || 0);
              accounts[code].open_credit += (line.credit || 0);
            } else {
              accounts[code] = {
                account_code: code,
                account_name: line.account_name || code,
                account_type: line.account_type || '',
                open_debit: line.debit || 0,
                open_credit: line.credit || 0,
                period_debit: 0, period_credit: 0,
                close_debit: 0, close_credit: 0
              };
            }
          }
          // Recalculate net opening for affected accounts
          for (const acc of Object.values(accounts)) {
            const net = acc.open_debit - acc.open_credit;
            acc.open_debit = net > 0 ? net : 0;
            acc.open_credit = net < 0 ? Math.abs(net) : 0;
          }
        }
      } catch (e) {
        console.log('[TrialBalance] Closing entries not applied:', e.message);
      }
    }

    for (const row of periodRows) {
      if (!accounts[row.account_code]) {
        accounts[row.account_code] = {
          account_code: row.account_code,
          account_name: row.account_name,
          account_type: row.account_type,
          open_debit: 0, open_credit: 0,
          period_debit: 0, period_credit: 0,
          close_debit: 0, close_credit: 0
        };
      }
      // Period movements: show raw totals
      accounts[row.account_code].period_debit = row.total_debit || 0;
      accounts[row.account_code].period_credit = row.total_credit || 0;
    }

    // Calculate closing balances: opening net + period net
    for (const acc of Object.values(accounts)) {
      const openNet = acc.open_debit - acc.open_credit;
      const periodNet = acc.period_debit - acc.period_credit;
      const closeNet = openNet + periodNet;
      acc.close_debit = closeNet > 0 ? closeNet : 0;
      acc.close_credit = closeNet < 0 ? Math.abs(closeNet) : 0;
    }

    // Sort by account code
    const sorted = Object.values(accounts).sort((a, b) => 
      a.account_code.localeCompare(b.account_code)
    );

    return { accounts: sorted };
  }

  /**
   * Get dashboard KPIs
   */
  getDashboardKPIs({ companyIds, dateFrom, dateTo }) {
    const params = {};
    let companyFilter = '';
    let dateFilter = '';

    if (companyIds && companyIds.length > 0) {
      companyFilter = `AND ji.company_id IN (${companyIds.map((_, i) => `@cid${i}`).join(',')})`;
      companyIds.forEach((id, i) => { params[`cid${i}`] = id; });
    }
    if (dateFrom) { dateFilter += ' AND ji.date >= @dateFrom'; params.dateFrom = dateFrom; }
    if (dateTo) { dateFilter += ' AND ji.date <= @dateTo'; params.dateTo = dateTo; }

    const revenue = this.db.prepare(`
      SELECT COALESCE(SUM(ji.credit - ji.debit), 0) as total
      FROM journal_items ji
      WHERE ji.account_type IN ('income', 'income_other', 'revenue')
        AND ji.move_state = 'posted'
        ${companyFilter} ${dateFilter}
    `).get(params);

    const expenses = this.db.prepare(`
      SELECT COALESCE(SUM(ji.debit - ji.credit), 0) as total
      FROM journal_items ji
      WHERE ji.account_type IN ('expense', 'expense_direct_cost', 'expense_depreciation', 'cost_of_revenue')
        AND ji.move_state = 'posted'
        ${companyFilter} ${dateFilter}
    `).get(params);

    const assets = this.db.prepare(`
      SELECT COALESCE(SUM(ji.debit - ji.credit), 0) as total
      FROM journal_items ji
      WHERE ji.account_type IN ('asset_receivable', 'asset_cash', 'asset_current', 'asset_non_current', 'asset_prepayments', 'asset_fixed')
        AND ji.move_state = 'posted'
        ${companyFilter} ${dateFilter}
    `).get(params);

    const liabilities = this.db.prepare(`
      SELECT COALESCE(SUM(ji.credit - ji.debit), 0) as total
      FROM journal_items ji
      WHERE ji.account_type IN ('liability_payable', 'liability_current', 'liability_non_current', 'liability_credit_card')
        AND ji.move_state = 'posted'
        ${companyFilter} ${dateFilter}
    `).get(params);

    const cash = this.db.prepare(`
      SELECT COALESCE(SUM(ji.debit - ji.credit), 0) as total
      FROM journal_items ji
      WHERE ji.account_type = 'asset_cash'
        AND ji.move_state = 'posted'
        ${companyFilter} ${dateFilter}
    `).get(params);

    // Revenue by period
    const revenueByPeriod = this.db.prepare(`
      SELECT ji.period, COALESCE(SUM(ji.credit - ji.debit), 0) as total
      FROM journal_items ji
      WHERE ji.account_type IN ('income', 'income_other', 'revenue')
        AND ji.move_state = 'posted'
        ${companyFilter} ${dateFilter}
      GROUP BY ji.period
      ORDER BY ji.period
    `).all(params);

    // Expenses by type
    const expensesByType = this.db.prepare(`
      SELECT ji.account_type, COALESCE(SUM(ji.debit - ji.credit), 0) as total
      FROM journal_items ji
      WHERE ji.account_type IN ('expense', 'expense_direct_cost', 'expense_depreciation', 'cost_of_revenue')
        AND ji.move_state = 'posted'
        ${companyFilter} ${dateFilter}
      GROUP BY ji.account_type
    `).all(params);

    // Revenue by company
    const revenueByCompany = this.db.prepare(`
      SELECT c.name as company_name, c.color, COALESCE(SUM(ji.credit - ji.debit), 0) as total
      FROM journal_items ji
      JOIN companies c ON c.id = ji.company_id
      WHERE ji.account_type IN ('income', 'income_other', 'revenue')
        AND ji.move_state = 'posted'
        ${companyFilter} ${dateFilter}
      GROUP BY ji.company_id
    `).all(params);

    // Expenses by company
    const expensesByCompany = this.db.prepare(`
      SELECT c.name as company_name, c.color, COALESCE(SUM(ji.debit - ji.credit), 0) as total
      FROM journal_items ji
      JOIN companies c ON c.id = ji.company_id
      WHERE ji.account_type IN ('expense', 'expense_direct_cost', 'expense_depreciation', 'cost_of_revenue')
        AND ji.move_state = 'posted'
        ${companyFilter} ${dateFilter}
      GROUP BY ji.company_id
    `).all(params);

    // Expenses by period (monthly)
    const expensesByPeriod = this.db.prepare(`
      SELECT ji.period, COALESCE(SUM(ji.debit - ji.credit), 0) as total
      FROM journal_items ji
      WHERE ji.account_type IN ('expense', 'expense_direct_cost', 'expense_depreciation', 'cost_of_revenue')
        AND ji.move_state = 'posted'
        ${companyFilter} ${dateFilter}
      GROUP BY ji.period
      ORDER BY ji.period
    `).all(params);

    return {
      totalRevenue: revenue.total,
      totalExpenses: expenses.total,
      netProfit: revenue.total - expenses.total,
      totalAssets: assets.total,
      totalLiabilities: liabilities.total,
      cashPosition: cash.total,
      revenueByPeriod,
      expensesByPeriod,
      expensesByType,
      revenueByCompany,
      expensesByCompany
    };
  }

  /**
   * Calculate intercompany eliminations
   */
  _calculateEliminations(companyIds, dateFrom, dateTo) {
    const rules = this.db.prepare(`
      SELECT * FROM elimination_rules WHERE is_active = 1
    `).all();

    const eliminations = [];

    for (const rule of rules) {
      if (rule.rule_type === 'account_match') {
        const params = {};
        let dateFilter = '';
        if (dateFrom) { dateFilter += ' AND ji.date >= @dateFrom'; params.dateFrom = dateFrom; }
        if (dateTo) { dateFilter += ' AND ji.date <= @dateTo'; params.dateTo = dateTo; }

        // Find matching intercompany transactions
        const sourceItems = this.db.prepare(`
          SELECT SUM(ji.debit) as total_debit, SUM(ji.credit) as total_credit
          FROM journal_items ji
          WHERE ji.company_id = @sourceCompany
            AND ji.account_code = @accountCode
            AND ji.move_state = 'posted'
            ${dateFilter}
        `).get({ ...params, sourceCompany: rule.source_company_id, accountCode: rule.source_account_code });

        if (sourceItems && (sourceItems.total_debit > 0 || sourceItems.total_credit > 0)) {
          eliminations.push({
            rule_name: rule.name,
            source_company_id: rule.source_company_id,
            target_company_id: rule.target_company_id,
            debit: sourceItems.total_debit || 0,
            credit: sourceItems.total_credit || 0
          });
        }
      }
    }

    return eliminations;
  }

  /**
   * Build income statement response structure
   */
  _buildIncomeStatement(revenue, expenses, eliminations, companyIds) {
    const groupByAccount = (items) => {
      const groups = {};
      for (const item of items) {
        if (!groups[item.account_code]) {
          groups[item.account_code] = {
            account_code: item.account_code,
            account_name: item.account_name,
            account_type: item.account_type,
            companies: {},
            total: 0
          };
        }
        groups[item.account_code].companies[item.company_id] = {
          company_name: item.company_name,
          amount: item.amount
        };
        groups[item.account_code].total += item.amount;
      }
      return Object.values(groups);
    };

    const revenueItems = groupByAccount(revenue);
    const expenseItems = groupByAccount(expenses);

    const totalRevenue = revenueItems.reduce((sum, item) => sum + item.total, 0);
    const totalExpenses = expenseItems.reduce((sum, item) => sum + item.total, 0);
    const eliminationTotal = eliminations.reduce((sum, e) => sum + (e.debit - e.credit), 0);

    return {
      revenue: revenueItems,
      expenses: expenseItems,
      eliminations,
      summary: {
        totalRevenue,
        totalExpenses,
        eliminationAdjustment: eliminationTotal,
        netProfit: totalRevenue - totalExpenses - eliminationTotal
      }
    };
  }

  /**
   * Build balance sheet response structure
   */
  _buildBalanceSheet(assets, liabilities, equity, eliminations, companyIds) {
    const groupByAccount = (items) => {
      const groups = {};
      for (const item of items) {
        if (!groups[item.account_code]) {
          groups[item.account_code] = {
            account_code: item.account_code,
            account_name: item.account_name,
            account_type: item.account_type,
            companies: {},
            total: 0
          };
        }
        groups[item.account_code].companies[item.company_id] = {
          company_name: item.company_name,
          amount: item.amount
        };
        groups[item.account_code].total += item.amount;
      }
      return Object.values(groups);
    };

    return {
      assets: groupByAccount(assets),
      liabilities: groupByAccount(liabilities),
      equity: groupByAccount(equity),
      eliminations,
      summary: {
        totalAssets: assets.reduce((s, i) => s + i.amount, 0),
        totalLiabilities: liabilities.reduce((s, i) => s + i.amount, 0),
        totalEquity: equity.reduce((s, i) => s + i.amount, 0)
      }
    };
  }

  /**
   * Get available filters data
   */
  getFilterOptions({ companyIds }) {
    const params = {};
    let companyFilter = '';

    if (companyIds && companyIds.length > 0) {
      companyFilter = `WHERE ji.company_id IN (${companyIds.map((_, i) => `@cid${i}`).join(',')})`;
      companyIds.forEach((id, i) => { params[`cid${i}`] = id; });
    }

    const periods = this.db.prepare(`
      SELECT DISTINCT ji.period FROM journal_items ji ${companyFilter} ORDER BY ji.period
    `).all(params).map(r => r.period);

    const fiscalYears = this.db.prepare(`
      SELECT DISTINCT ji.fiscal_year FROM journal_items ji ${companyFilter} ORDER BY ji.fiscal_year
    `).all(params).map(r => r.fiscal_year);

    const accountTypes = this.db.prepare(`
      SELECT DISTINCT ji.account_type FROM journal_items ji ${companyFilter} ORDER BY ji.account_type
    `).all(params).map(r => r.account_type);

    const costCenters = this.db.prepare(`
      SELECT DISTINCT ji.analytic_account FROM journal_items ji 
      ${companyFilter ? companyFilter + ' AND' : 'WHERE'} ji.analytic_account IS NOT NULL AND ji.analytic_account != ''
      ORDER BY ji.analytic_account
    `).all(params).map(r => r.analytic_account);

    return { periods, fiscalYears, accountTypes, costCenters };
  }
}

module.exports = ConsolidationEngine;
