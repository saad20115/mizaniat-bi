const { getDb } = require('../db/connection');

class ConsolidationEngine {
  constructor() {
    this.db = getDb();
  }

  _sectionExpr(tableAlias = 'ji', overrideAlias = 'o') {
    return `CASE 
      WHEN ${overrideAlias}.section IS NOT NULL THEN ${overrideAlias}.section 
      WHEN ${tableAlias}.account_type LIKE 'asset%' THEN 'asset' 
      WHEN ${tableAlias}.account_type LIKE 'liability%' THEN 'liability' 
      WHEN ${tableAlias}.account_type LIKE 'equity%' THEN 'equity' 
      WHEN ${tableAlias}.account_type LIKE 'income%' THEN 'income' 
      WHEN ${tableAlias}.account_type LIKE 'expense%' THEN 'expense' 
      ELSE 'other' 
    END`;
  }

  _sectionJoin(tableAlias = 'ji', overrideAlias = 'o') {
    return `LEFT JOIN account_section_overrides ${overrideAlias} ON ${overrideAlias}.company_id = ${tableAlias}.company_id AND ${overrideAlias}.account_code = ${tableAlias}.account_code`;
  }

  _cashFilter(alias = 'ji') {
    return `${alias}.account_type = 'asset_cash' AND NOT EXISTS (
      SELECT 1 FROM account_tags _t 
      WHERE _t.company_id = ${alias}.company_id 
        AND _t.account_code = ${alias}.account_code 
        AND _t.tag = 'guarantee'
    )`;
  }

  _guaranteeFilter(alias = 'ji') {
    return `EXISTS (
      SELECT 1 FROM account_tags _t 
      WHERE _t.company_id = ${alias}.company_id 
        AND _t.account_code = ${alias}.account_code 
        AND _t.tag = 'guarantee'
    )`;
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
      ${this._sectionJoin('ji', 'o')}
      WHERE ${this._sectionExpr('ji', 'o')} = 'income'
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
      ${this._sectionJoin('ji', 'o')}
      WHERE ${this._sectionExpr('ji', 'o')} = 'expense'
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

    const effectiveDate = asOfDate || new Date().toISOString().split('T')[0];
    const fyYear = effectiveDate.substring(0, 4);
    const fyStart = `${fyYear}-01-01`;

    // Assets
    const assets = this.db.prepare(`
      SELECT 
        ji.account_code, ji.account_name, ji.account_type,
        ji.company_id, c.name as company_name,
        SUM(ji.debit - ji.credit) as amount,
        CASE WHEN ${this._guaranteeFilter('ji')} THEN 1 ELSE 0 END as is_guarantee
      FROM journal_items ji
      JOIN companies c ON c.id = ji.company_id
      ${this._sectionJoin('ji', 'o')}
      WHERE ${this._sectionExpr('ji', 'o')} = 'asset'
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
      ${this._sectionJoin('ji', 'o')}
      WHERE ${this._sectionExpr('ji', 'o')} = 'liability'
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
      ${this._sectionJoin('ji', 'o')}
      WHERE ${this._sectionExpr('ji', 'o')} = 'equity'
        AND ji.move_state = 'posted'
        ${companyFilter} ${dateFilter} ${extraFilters}
      GROUP BY ji.account_code, ji.account_name, ji.company_id
      ORDER BY ji.account_code
    `).all(params);

    // Virtual closing lines:
    // RE-CALC: prior P&L before fyStart
    const reCalcRows = this.db.prepare(`
      SELECT 
        ji.company_id, c.name as company_name,
        SUM(ji.credit - ji.debit) as amount
      FROM journal_items ji
      JOIN companies c ON c.id = ji.company_id
      ${this._sectionJoin('ji', 'o')}
      WHERE ${this._sectionExpr('ji', 'o')} IN ('income', 'expense')
        AND ji.move_state = 'posted'
        ${companyFilter}
        AND ji.date < @fyStart
        ${extraFilters}
      GROUP BY ji.company_id
    `).all({ ...params, fyStart });

    for (const row of reCalcRows) {
      equity.push({
        account_code: 'RE-CALC',
        account_name: 'أرباح مرحّلة (محسوبة)',
        account_type: 'equity',
        company_id: row.company_id,
        company_name: row.company_name,
        amount: row.amount || 0
      });
    }

    // CYE: current year P&L from fyStart to asOfDate
    let cyeDateFilter = ' AND ji.date >= @fyStart';
    if (asOfDate) {
      cyeDateFilter += ' AND ji.date <= @asOfDate';
    }
    const cyeRows = this.db.prepare(`
      SELECT 
        ji.company_id, c.name as company_name,
        SUM(ji.credit - ji.debit) as amount
      FROM journal_items ji
      JOIN companies c ON c.id = ji.company_id
      ${this._sectionJoin('ji', 'o')}
      WHERE ${this._sectionExpr('ji', 'o')} IN ('income', 'expense')
        AND ji.move_state = 'posted'
        ${companyFilter}
        ${cyeDateFilter}
        ${extraFilters}
      GROUP BY ji.company_id
    `).all({ ...params, fyStart });

    for (const row of cyeRows) {
      equity.push({
        account_code: 'CYE',
        account_name: 'أرباح السنة الحالية',
        account_type: 'equity',
        company_id: row.company_id,
        company_name: row.company_name,
        amount: row.amount || 0
      });
    }

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

    // Direct Cash Flow Method:
    // Identify all posted journal entries that involve cash accounts (excluding guarantees).
    this.db.exec(`
      CREATE TEMP TABLE IF NOT EXISTS _temp_cf_moves (
        company_id INTEGER,
        move_name TEXT,
        PRIMARY KEY(company_id, move_name)
      );
      DELETE FROM _temp_cf_moves;
    `);

    this.db.prepare(`
      INSERT OR IGNORE INTO _temp_cf_moves (company_id, move_name)
      SELECT DISTINCT ji.company_id, ji.move_name
      FROM journal_items ji
      WHERE ${this._cashFilter('ji')}
        AND ji.move_state = 'posted'
        ${companyFilter} ${dateFilter}
    `).run(params);

    // Query non-cash counterparties in those cash moves
    // Cash inflow (Debit Cash) = Counterparty Credit (credit - debit > 0)
    // Cash outflow (Credit Cash) = Counterparty Debit (credit - debit < 0)
    const nonCashLines = this.db.prepare(`
      SELECT 
        ji.account_code, ji.account_name, ji.account_type,
        ${this._sectionExpr('ji', 'o')} as section,
        CASE WHEN ${this._guaranteeFilter('ji')} THEN 1 ELSE 0 END as is_guarantee,
        SUM(ji.credit - ji.debit) as amount
      FROM journal_items ji
      JOIN _temp_cf_moves m ON m.company_id = ji.company_id AND m.move_name = ji.move_name
      ${this._sectionJoin('ji', 'o')}
      WHERE ji.move_state = 'posted'
        AND NOT (${this._cashFilter('ji')})
        ${companyFilter} ${dateFilter}
      GROUP BY ji.account_code, ji.account_name, ji.account_type, section, is_guarantee
    `).all(params);

    const opMap = {};
    const invMap = {};
    const finMap = {};

    for (const line of nonCashLines) {
      if (Math.abs(line.amount) < 0.0001) continue;
      const sec = line.section;
      const type = line.account_type || '';

      let targetMap;
      let displayType = type;

      if (line.is_guarantee) {
        targetMap = opMap;
        displayType = 'bank_guarantees';
      } else if (sec === 'income' || sec === 'expense') {
        targetMap = opMap;
      } else if (sec === 'equity') {
        targetMap = finMap;
        displayType = 'equity';
      } else if (sec === 'asset') {
        if (type === 'asset_fixed' || type === 'asset_non_current') {
          targetMap = invMap;
        } else {
          targetMap = opMap;
        }
      } else if (sec === 'liability') {
        if (type === 'liability_non_current') {
          targetMap = finMap;
        } else {
          targetMap = opMap;
        }
      } else {
        targetMap = opMap;
      }

      if (!targetMap[displayType]) {
        targetMap[displayType] = { account_type: displayType, amount: 0 };
      }
      targetMap[displayType].amount += line.amount;
    }

    const operating = Object.values(opMap);
    const investing = Object.values(invMap);
    const financing = Object.values(finMap);

    // Opening and closing cash balances
    let cashOpenFilter = '';
    let cashCloseFilter = '';
    const cashParams = { ...params };
    if (dateFrom) {
      cashOpenFilter = ' AND ji.date < @dateFrom';
    }
    if (dateTo) {
      cashCloseFilter = ' AND ji.date <= @dateTo';
    }

    const openingCash = dateFrom ? (this.db.prepare(`
      SELECT COALESCE(SUM(ji.debit - ji.credit), 0) as total
      FROM journal_items ji
      WHERE ${this._cashFilter('ji')}
        AND ji.move_state = 'posted'
        ${companyFilter} ${cashOpenFilter}
    `).get(cashParams).total) : 0;

    const closingCash = this.db.prepare(`
      SELECT COALESCE(SUM(ji.debit - ji.credit), 0) as total
      FROM journal_items ji
      WHERE ${this._cashFilter('ji')}
        AND ji.move_state = 'posted'
        ${companyFilter} ${cashCloseFilter}
    `).get(cashParams).total;

    const netCashFlow = (
      operating.reduce((s, i) => s + i.amount, 0) +
      investing.reduce((s, i) => s + i.amount, 0) +
      financing.reduce((s, i) => s + i.amount, 0)
    );

    return {
      operating,
      investing,
      financing,
      summary: {
        openingCash,
        netCashFlow,
        closingCash
      }
    };
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

    // Opening balances:
    // - Asset, liability, equity: all transactions BEFORE dateFrom
    // - Income, expense: only transactions BETWEEN fyStart and dateFrom
    // - Prior income/expense before fyStart: placed into virtual RE-CALC opening row
    let openingRows = [];
    let priorNetRow = null;

    if (dateFrom) {
      const fyYear = dateFrom.substring(0, 4);
      const fyStart = `${fyYear}-01-01`;
      const openParams = { ...params, dateFrom, fyStart };

      openingRows = this.db.prepare(`
        SELECT 
          ji.account_code, MIN(ji.account_name) as account_name, ji.account_type,
          SUM(ji.debit) as total_debit,
          SUM(ji.credit) as total_credit
        FROM journal_items ji
        ${this._sectionJoin('ji', 'o')}
        WHERE ji.move_state = 'posted'
          AND (ji.move_name IS NULL OR ji.move_name NOT LIKE 'CLOSING/%')
          ${companyFilter} ${extraFilters}
          AND (
            (${this._sectionExpr('ji', 'o')} IN ('asset', 'liability', 'equity') AND ji.date < @dateFrom)
            OR
            (${this._sectionExpr('ji', 'o')} IN ('income', 'expense') AND ji.date >= @fyStart AND ji.date < @dateFrom)
          )
        GROUP BY ji.account_code
        ORDER BY ji.account_code
      `).all(openParams);

      priorNetRow = this.db.prepare(`
        SELECT SUM(ji.credit - ji.debit) as net_equity
        FROM journal_items ji
        ${this._sectionJoin('ji', 'o')}
        WHERE ji.move_state = 'posted'
          AND (ji.move_name IS NULL OR ji.move_name NOT LIKE 'CLOSING/%')
          ${companyFilter} ${extraFilters}
          AND ${this._sectionExpr('ji', 'o')} IN ('income', 'expense')
          AND ji.date < @fyStart
      `).get(openParams);
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

    // Add virtual RE-CALC opening row if there is prior year P&L movement
    if (priorNetRow && priorNetRow.net_equity) {
      const priorNet = priorNetRow.net_equity;
      accounts['RE-CALC'] = {
        account_code: 'RE-CALC',
        account_name: 'أرباح مرحّلة (محسوبة)',
        account_type: 'equity',
        open_debit: priorNet < 0 ? Math.abs(priorNet) : 0,
        open_credit: priorNet > 0 ? priorNet : 0,
        period_debit: 0, period_credit: 0,
        close_debit: 0, close_credit: 0
      };
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
   * Get detailed trial balance grouped by account and partner
   * Applies proper fyStart rules (P&L resets each fiscal year), _sectionExpr classification
   */
  getDetailedTrialBalance({ companyId, dateFrom, dateTo, accountCodes }) {
    const cid = parseInt(companyId);
    const codes = accountCodes ? (Array.isArray(accountCodes) ? accountCodes : accountCodes.split(',').map(c => c.trim()).filter(Boolean)) : [];
    
    const params = { companyId: cid, dateFrom, dateTo };
    let accountFilter = '';
    if (codes.length > 0) {
      accountFilter = `AND ji.account_code IN (${codes.map((c, i) => { params[`code${i}`] = c; return `@code${i}`; }).join(',')})`;
    } else {
      // Default: receivables and payables accounts
      accountFilter = `AND ji.account_type IN ('asset_receivable', 'liability_payable')`;
    }

    const fyYear = dateFrom ? dateFrom.substring(0, 4) : new Date().getFullYear();
    const fyStart = `${fyYear}-01-01`;
    params.fyStart = fyStart;

    // Opening balances:
    // - Asset, liability, equity: all transactions BEFORE dateFrom
    // - Income, expense: only transactions BETWEEN fyStart and dateFrom
    const openingRows = this.db.prepare(`
      SELECT 
        ji.account_code, MIN(ji.account_name) as account_name, ji.account_type,
        CASE WHEN ji.partner_name IS NULL OR TRIM(ji.partner_name) = '' THEN 'بدون شريك' ELSE TRIM(ji.partner_name) END as partner_name,
        MAX(ji.partner_id) as partner_id,
        SUM(ji.debit) as total_debit,
        SUM(ji.credit) as total_credit
      FROM journal_items ji
      ${this._sectionJoin('ji', 'o')}
      WHERE ji.move_state = 'posted'
        AND ji.company_id = @companyId
        AND (ji.move_name IS NULL OR ji.move_name NOT LIKE 'CLOSING/%')
        ${accountFilter}
        AND (
          (${this._sectionExpr('ji', 'o')} IN ('asset', 'liability', 'equity') AND ji.date < @dateFrom)
          OR
          (${this._sectionExpr('ji', 'o')} IN ('income', 'expense') AND ji.date >= @fyStart AND ji.date < @dateFrom)
        )
      GROUP BY ji.account_code, CASE WHEN ji.partner_name IS NULL OR TRIM(ji.partner_name) = '' THEN 'بدون شريك' ELSE TRIM(ji.partner_name) END
    `).all(params);

    // Period movement: between dateFrom and dateTo
    const periodRows = this.db.prepare(`
      SELECT 
        ji.account_code, MIN(ji.account_name) as account_name, ji.account_type,
        CASE WHEN ji.partner_name IS NULL OR TRIM(ji.partner_name) = '' THEN 'بدون شريك' ELSE TRIM(ji.partner_name) END as partner_name,
        MAX(ji.partner_id) as partner_id,
        SUM(ji.debit) as total_debit,
        SUM(ji.credit) as total_credit
      FROM journal_items ji
      ${this._sectionJoin('ji', 'o')}
      WHERE ji.move_state = 'posted'
        AND ji.company_id = @companyId
        AND (ji.move_name IS NULL OR ji.move_name NOT LIKE 'CLOSING/%')
        ${accountFilter}
        AND ji.date >= @dateFrom AND ji.date <= @dateTo
      GROUP BY ji.account_code, CASE WHEN ji.partner_name IS NULL OR TRIM(ji.partner_name) = '' THEN 'بدون شريك' ELSE TRIM(ji.partner_name) END
    `).all(params);

    const accountMap = {};
    const makeEntry = (row) => ({
      account_code: row.account_code,
      account_name: row.account_name,
      account_type: row.account_type,
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

    let accounts = Object.values(accountMap).map(a => {
      const openNet = a.raw_open_debit - a.raw_open_credit;
      if (openNet >= 0) {
        a.open_debit = openNet;
        a.open_credit = 0;
      } else {
        a.open_debit = 0;
        a.open_credit = Math.abs(openNet);
      }
      const closeNet = openNet + a.period_debit - a.period_credit;
      if (closeNet >= 0) {
        a.close_debit = closeNet;
        a.close_credit = 0;
      } else {
        a.close_debit = 0;
        a.close_credit = Math.abs(closeNet);
      }
      delete a.raw_open_debit;
      delete a.raw_open_credit;
      return a;
    });

    accounts = accounts.filter(a =>
      a.open_debit !== 0 || a.open_credit !== 0 ||
      a.period_debit !== 0 || a.period_credit !== 0 ||
      a.close_debit !== 0 || a.close_credit !== 0
    );

    accounts.sort((a, b) => {
      if (a.account_code !== b.account_code) return a.account_code.localeCompare(b.account_code);
      return (a.partner_name || '').localeCompare(b.partner_name || '');
    });

    const distinctAccounts = this.db.prepare(`
      SELECT DISTINCT ji.account_code, MIN(ji.account_name) as account_name, ji.account_type
      FROM journal_items ji
      WHERE ji.company_id = @companyId AND ji.move_state = 'posted'
        AND ji.account_type IN ('asset_receivable', 'liability_payable', 'asset_current', 'liability_current')
      GROUP BY ji.account_code
      ORDER BY ji.account_code
    `).all({ companyId: cid });

    return { accounts, distinctAccounts };
  }

  /**
   * Get dashboard KPIs
   */
  getDashboardKPIs({ companyIds, dateFrom, dateTo }) {
    const params = {};
    let companyFilter = '';
    let periodDateFilter = '';
    let asOfFilter = '';

    if (companyIds && companyIds.length > 0) {
      companyFilter = `AND ji.company_id IN (${companyIds.map((_, i) => `@cid${i}`).join(',')})`;
      companyIds.forEach((id, i) => { params[`cid${i}`] = id; });
    }
    if (dateFrom) { periodDateFilter += ' AND ji.date >= @dateFrom'; params.dateFrom = dateFrom; }
    if (dateTo) { 
      periodDateFilter += ' AND ji.date <= @dateTo'; 
      asOfFilter = ' AND ji.date <= @dateTo';
      params.dateTo = dateTo; 
    }

    const revenue = this.db.prepare(`
      SELECT COALESCE(SUM(ji.credit - ji.debit), 0) as total
      FROM journal_items ji
      ${this._sectionJoin('ji', 'o')}
      WHERE ${this._sectionExpr('ji', 'o')} = 'income'
        AND ji.move_state = 'posted'
        ${companyFilter} ${periodDateFilter}
    `).get(params);

    const expenses = this.db.prepare(`
      SELECT COALESCE(SUM(ji.debit - ji.credit), 0) as total
      FROM journal_items ji
      ${this._sectionJoin('ji', 'o')}
      WHERE ${this._sectionExpr('ji', 'o')} = 'expense'
        AND ji.move_state = 'posted'
        ${companyFilter} ${periodDateFilter}
    `).get(params);

    const assets = this.db.prepare(`
      SELECT COALESCE(SUM(ji.debit - ji.credit), 0) as total
      FROM journal_items ji
      ${this._sectionJoin('ji', 'o')}
      WHERE ${this._sectionExpr('ji', 'o')} = 'asset'
        AND ji.move_state = 'posted'
        ${companyFilter} ${asOfFilter}
    `).get(params);

    const liabilities = this.db.prepare(`
      SELECT COALESCE(SUM(ji.credit - ji.debit), 0) as total
      FROM journal_items ji
      ${this._sectionJoin('ji', 'o')}
      WHERE ${this._sectionExpr('ji', 'o')} = 'liability'
        AND ji.move_state = 'posted'
        ${companyFilter} ${asOfFilter}
    `).get(params);

    const cash = this.db.prepare(`
      SELECT COALESCE(SUM(ji.debit - ji.credit), 0) as total
      FROM journal_items ji
      WHERE ${this._cashFilter('ji')}
        AND ji.move_state = 'posted'
        ${companyFilter} ${asOfFilter}
    `).get(params);

    const guarantees = this.db.prepare(`
      SELECT COALESCE(SUM(ji.debit - ji.credit), 0) as total
      FROM journal_items ji
      WHERE ${this._guaranteeFilter('ji')}
        AND ji.move_state = 'posted'
        ${companyFilter} ${asOfFilter}
    `).get(params);

    // Revenue by period
    const revenueByPeriod = this.db.prepare(`
      SELECT ji.period, COALESCE(SUM(ji.credit - ji.debit), 0) as total
      FROM journal_items ji
      ${this._sectionJoin('ji', 'o')}
      WHERE ${this._sectionExpr('ji', 'o')} = 'income'
        AND ji.move_state = 'posted'
        ${companyFilter} ${periodDateFilter}
      GROUP BY ji.period
      ORDER BY ji.period
    `).all(params);

    // Expenses by type
    const expensesByType = this.db.prepare(`
      SELECT ji.account_type, COALESCE(SUM(ji.debit - ji.credit), 0) as total
      FROM journal_items ji
      ${this._sectionJoin('ji', 'o')}
      WHERE ${this._sectionExpr('ji', 'o')} = 'expense'
        AND ji.move_state = 'posted'
        ${companyFilter} ${periodDateFilter}
      GROUP BY ji.account_type
    `).all(params);

    // Revenue by company
    const revenueByCompany = this.db.prepare(`
      SELECT c.name as company_name, c.color, COALESCE(SUM(ji.credit - ji.debit), 0) as total
      FROM journal_items ji
      JOIN companies c ON c.id = ji.company_id
      ${this._sectionJoin('ji', 'o')}
      WHERE ${this._sectionExpr('ji', 'o')} = 'income'
        AND ji.move_state = 'posted'
        ${companyFilter} ${periodDateFilter}
      GROUP BY ji.company_id
    `).all(params);

    // Expenses by company
    const expensesByCompany = this.db.prepare(`
      SELECT c.name as company_name, c.color, COALESCE(SUM(ji.debit - ji.credit), 0) as total
      FROM journal_items ji
      JOIN companies c ON c.id = ji.company_id
      ${this._sectionJoin('ji', 'o')}
      WHERE ${this._sectionExpr('ji', 'o')} = 'expense'
        AND ji.move_state = 'posted'
        ${companyFilter} ${periodDateFilter}
      GROUP BY ji.company_id
    `).all(params);

    // Expenses by period (monthly)
    const expensesByPeriod = this.db.prepare(`
      SELECT ji.period, COALESCE(SUM(ji.debit - ji.credit), 0) as total
      FROM journal_items ji
      ${this._sectionJoin('ji', 'o')}
      WHERE ${this._sectionExpr('ji', 'o')} = 'expense'
        AND ji.move_state = 'posted'
        ${companyFilter} ${periodDateFilter}
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
      guarantees: guarantees.total,
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
            is_guarantee: item.is_guarantee ? 1 : 0,
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

  /**
   * Get presentation KPIs for a single company
   * Single source of truth for /presentation/data
   */
  getPresentationKPIs({ companyId, dateFrom, dateTo }) {
    const is = this.getIncomeStatement({
      companyIds: [companyId],
      dateFrom,
      dateTo
    });
    const bs = this.getBalanceSheet({
      companyIds: [companyId],
      asOfDate: dateTo
    });

    const rev = is.summary.totalRevenue;
    const exp = is.summary.totalExpenses;
    const ast = bs.summary.totalAssets;
    const liab = bs.summary.totalLiabilities;
    const eq = bs.summary.totalEquity;

    const p = { companyId, dateFrom, dateTo };
    const qr = (sql) => this.db.prepare(sql).get(p)?.total || 0;

    const cash = qr(`
      SELECT COALESCE(SUM(debit - credit), 0) as total 
      FROM journal_items ji
      WHERE company_id = @companyId AND date <= @dateTo AND ${this._cashFilter('ji')} AND move_state = 'posted'
    `);

    const guarantees = qr(`
      SELECT COALESCE(SUM(debit - credit), 0) as total 
      FROM journal_items ji
      WHERE company_id = @companyId AND date <= @dateTo AND ${this._guaranteeFilter('ji')} AND move_state = 'posted'
    `);

    const closingRecv = qr(`
      SELECT COALESCE(SUM(debit - credit), 0) as total 
      FROM journal_items 
      WHERE company_id = @companyId AND date <= @dateTo AND account_type = 'asset_receivable' AND move_state = 'posted'
    `);

    const openingRecv = qr(`
      SELECT COALESCE(SUM(debit - credit), 0) as total 
      FROM journal_items 
      WHERE company_id = @companyId AND date < @dateFrom AND account_type = 'asset_receivable' AND move_state = 'posted'
    `);

    const pay = qr(`
      SELECT COALESCE(SUM(credit - debit), 0) as total 
      FROM journal_items 
      WHERE company_id = @companyId AND date <= @dateTo AND account_type = 'liability_payable' AND move_state = 'posted'
    `);

    const topAcc = this.db.prepare(`
      SELECT account_code, account_name, SUM(debit) as total_debit, SUM(credit) as total_credit 
      FROM journal_items 
      WHERE company_id = @companyId AND date >= @dateFrom AND date <= @dateTo AND move_state = 'posted' 
      GROUP BY account_code 
      ORDER BY (SUM(debit) + SUM(credit)) DESC 
      LIMIT 5
    `).all(p);

    // F2: Accurate collection logic
    // billed = debit of asset_receivable in moves having an income line (invoices inclusive of tax)
    // collected = (credit - debit) of asset_receivable in moves having an asset_cash line (actual receipts)
    // remaining = closing balance of receivables
    this.db.exec(`
      CREATE TEMP TABLE IF NOT EXISTS _temp_income_moves (
        company_id INTEGER,
        move_name TEXT,
        PRIMARY KEY(company_id, move_name)
      );
      CREATE TEMP TABLE IF NOT EXISTS _temp_cash_moves (
        company_id INTEGER,
        move_name TEXT,
        PRIMARY KEY(company_id, move_name)
      );
      DELETE FROM _temp_income_moves;
      DELETE FROM _temp_cash_moves;
    `);

    this.db.prepare(`
      INSERT OR IGNORE INTO _temp_income_moves (company_id, move_name)
      SELECT DISTINCT ji.company_id, ji.move_name
      FROM journal_items ji
      ${this._sectionJoin('ji', 'o')}
      WHERE ji.company_id = @companyId
        AND ji.move_state = 'posted'
        AND ${this._sectionExpr('ji', 'o')} = 'income'
        AND ji.date >= @dateFrom AND ji.date <= @dateTo
    `).run(p);

    this.db.prepare(`
      INSERT OR IGNORE INTO _temp_cash_moves (company_id, move_name)
      SELECT DISTINCT ji.company_id, ji.move_name
      FROM journal_items ji
      WHERE ji.company_id = @companyId
        AND ji.move_state = 'posted'
        AND ${this._cashFilter('ji')}
        AND ji.date >= @dateFrom AND ji.date <= @dateTo
    `).run(p);

    const billed = qr(`
      SELECT COALESCE(SUM(ji.debit - ji.credit), 0) as total
      FROM journal_items ji
      JOIN _temp_income_moves im ON im.company_id = ji.company_id AND im.move_name = ji.move_name
      WHERE ji.company_id = @companyId
        AND ji.account_type = 'asset_receivable'
        AND ji.move_state = 'posted'
        AND ji.date >= @dateFrom AND ji.date <= @dateTo
    `);

    const collected = qr(`
      SELECT COALESCE(SUM(ji.credit - ji.debit), 0) as total
      FROM journal_items ji
      JOIN _temp_cash_moves cm ON cm.company_id = ji.company_id AND cm.move_name = ji.move_name
      WHERE ji.company_id = @companyId
        AND ji.account_type = 'asset_receivable'
        AND ji.move_state = 'posted'
        AND ji.date >= @dateFrom AND ji.date <= @dateTo
    `);

    const remaining = closingRecv;
    const collectionRate = billed > 0 ? (collected / billed * 100) : 0;

    return {
      revenue: rev,
      expenses: exp,
      netIncome: rev - exp,
      assets: ast,
      liabilities: liab,
      equity: eq,
      cash,
      guarantees,
      receivables: closingRecv,
      openingReceivables: openingRecv,
      billed,
      collected,
      remaining,
      payables: pay,
      profitMargin: rev > 0 ? ((rev - exp) / rev * 100) : 0,
      expenseRatio: rev > 0 ? (exp / rev * 100) : 0,
      collectionRate,
      remainingRate: billed > 0 ? (remaining / billed * 100) : 0,
      topAccounts: topAcc
    };
  }
}

module.exports = ConsolidationEngine;
