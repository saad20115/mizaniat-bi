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
   * Unified Period & Year Filter Generator (YR1)
   * Resolves multi-year arrays, single years, date ranges, and ALL into parameterized SQL and metadata.
   * @param {Object} opts { years, year, dateFrom, dateTo, asOfDate, defaultToCurrentYear }
   * @param {string} column Target date column (e.g. 'ji.date', 'si.date', 'fd.date')
   * @param {string} paramPrefix Prefix for bound parameter names
   * @returns {Object} { sql, params, label, refDate, yearsList, isAll, dateFrom, dateTo }
   */
  _periodFilter({ years, year, dateFrom, dateTo, asOfDate, defaultToCurrentYear = true } = {}, column = 'date', paramPrefix = 'p_') {
    const today = new Date().toISOString().slice(0, 10);
    const currentYear = new Date().getFullYear().toString();

    // 1. Explicit date range takes priority
    if (dateFrom || dateTo) {
      const df = dateFrom || '2000-01-01';
      const dt = dateTo || '2099-12-31';
      const refDate = asOfDate || (dt < today ? dt : today);
      const params = {};
      params[`${paramPrefix}df`] = df;
      params[`${paramPrefix}dt`] = dt;
      return {
        sql: `${column} >= @${paramPrefix}df AND ${column} <= @${paramPrefix}dt`,
        params,
        label: dateFrom && dateTo ? `${dateFrom} إلى ${dateTo}` : (dateFrom ? `من ${dateFrom}` : `إلى ${dateTo}`),
        refDate,
        yearsList: null,
        isAll: false,
        dateFrom: df,
        dateTo: dt
      };
    }

    // 2. Parse years / year
    let parsedYears = [];
    if (years !== undefined && years !== null && years !== '') {
      if (Array.isArray(years)) {
        parsedYears = years.map(String).map(s => s.trim()).filter(Boolean);
      } else if (typeof years === 'string') {
        parsedYears = years.split(',').map(s => s.trim()).filter(Boolean);
      }
    } else if (year !== undefined && year !== null && year !== '') {
      if (String(year).toUpperCase() === 'ALL') {
        parsedYears = ['ALL'];
      } else {
        parsedYears = [String(year).trim()];
      }
    }

    // 3. ALL filter
    if (parsedYears.includes('ALL')) {
      return {
        sql: '1=1',
        params: {},
        label: 'الكل',
        refDate: asOfDate || today,
        yearsList: ['ALL'],
        isAll: true,
        dateFrom: null,
        dateTo: null
      };
    }

    // Filter to valid 4-digit years
    parsedYears = parsedYears.filter(y => /^\d{4}$/.test(y));
    if (parsedYears.length === 0) {
      if (!defaultToCurrentYear) {
        return {
          sql: '1=1',
          params: {},
          label: 'الكل',
          refDate: asOfDate || today,
          yearsList: null,
          isAll: true,
          dateFrom: null,
          dateTo: null
        };
      }
      parsedYears = [currentYear];
    }

    // Deduplicate and sort chronologically
    parsedYears = Array.from(new Set(parsedYears)).sort();

    // RefDate rule (Rule X1: today if period covers today or future)
    const maxYear = parsedYears[parsedYears.length - 1];
    let refDate = asOfDate;
    if (!refDate) {
      if (parseInt(maxYear, 10) >= parseInt(currentYear, 10)) {
        refDate = today;
      } else {
        refDate = `${maxYear}-12-31`;
      }
    }

    const params = {};
    const placeholders = parsedYears.map((yr, idx) => {
      const pName = `${paramPrefix}yr_${idx}`;
      params[pName] = yr;
      return `@${pName}`;
    });

    const sql = `substr(${column}, 1, 4) IN (${placeholders.join(', ')})`;
    const label = parsedYears.join(' + ');

    return {
      sql,
      params,
      label,
      refDate,
      yearsList: parsedYears,
      isAll: false,
      dateFrom: parsedYears.length === 1 ? `${parsedYears[0]}-01-01` : null,
      dateTo: parsedYears.length === 1 ? `${parsedYears[0]}-12-31` : null
    };
  }

  /**
   * Get consolidated income statement
   */
  getIncomeStatement({ companyIds, dateFrom, dateTo, years, year, costCenter, project, useEliminations = false } = {}) {
    const params = {};
    let companyFilter = '';
    let dateFilter = '';
    let extraFilters = '';

    if (companyIds && companyIds.length > 0) {
      companyFilter = `AND ji.company_id IN (${companyIds.map((_, i) => `@cid${i}`).join(',')})`;
      companyIds.forEach((id, i) => { params[`cid${i}`] = id; });
    }

    // YR1: Unified period filter
    if (years !== undefined || year !== undefined || dateFrom || dateTo) {
      const period = this._periodFilter({ years, year, dateFrom, dateTo, defaultToCurrentYear: false }, 'ji.date', 'is_');
      if (period.sql !== '1=1') {
        dateFilter = ` AND ${period.sql}`;
        Object.assign(params, period.params);
      }
    }

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

    const measureExprMap = {
      'debit': 'SUM(ji.debit)',
      'credit': 'SUM(ji.credit)',
      'balance': 'SUM(ji.debit - ji.credit)',
      'count': 'COUNT(*)'
    };

    if (measure && !measureExprMap[measure]) {
      const err = new Error(`مقياس غير صالح: ${measure}`);
      err.status = 400;
      throw err;
    }
    const measureExpr = measureExprMap[measure] || 'SUM(ji.debit - ji.credit)';

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

    const rowList = (rows && rows.length > 0) ? rows : ['account'];
    for (const r of rowList) {
      if (!fieldMap[r]) {
        const err = new Error(`بعد غير صالح في الصفوف: ${r}`);
        err.status = 400;
        throw err;
      }
    }

    const colList = (columns && columns.length > 0) ? columns : ['period'];
    for (const c of colList) {
      if (!fieldMap[c]) {
        const err = new Error(`بعد غير صالح في الأعمدة: ${c}`);
        err.status = 400;
        throw err;
      }
    }

    const rowFields = rowList.map(r => fieldMap[r]).join(', ');
    const colFields = colList.map(c => fieldMap[c]).join(', ');
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

  /**
   * Unified Matrix engine (M1)
   * High performance multi-dimensional matrix aggregation from fact_daily.
   *
   * @param {Object} opts
   * @param {string} [opts.measure='revenue'] - revenue | expense | net | billed | collected
   * @param {string[]|string} [opts.rowDims=['company', 'department']] - company, department, analytic, account
   * @param {string} [opts.timeGrain='month'] - year | quarter | month | week | day
   * @param {string} [opts.dateFrom] - YYYY-MM-DD
   * @param {string} [opts.dateTo] - YYYY-MM-DD
   * @param {number[]|number} [opts.companyIds] - array of company IDs
   * @param {number[]|number} [opts.departmentIds] - array of department IDs (0 for unclassified)
   * @param {string} [opts.compare='none'] - none | prev_period | prev_year
   * @returns {Object} columns, rows tree, sparse cells, totals
   */
  getMatrix({
    measure = 'revenue',
    rowDims = ['company', 'department'],
    timeGrain = 'month',
    dateFrom,
    dateTo,
    years,
    year,
    companyIds,
    departmentIds,
    compare = 'none'
  } = {}) {
    const allowedMeasures = {
      revenue: 'fd.revenue',
      expense: 'fd.expense',
      net: '(fd.revenue - fd.expense)',
      billed: 'fd.billed',
      collected: 'fd.collected'
    };
    const measureExpr = allowedMeasures[measure] || allowedMeasures.revenue;

    const allowedGrains = {
      year: 'fd.year',
      quarter: 'fd.quarter',
      month: 'fd.month',
      week: 'fd.week_start',
      day: 'fd.date'
    };
    const grainExpr = allowedGrains[timeGrain] || allowedGrains.month;

    const dimDefs = {
      company: {
        keyCol: 'fd.company_id',
        labelCol: "COALESCE(c.name, 'شركة ' || fd.company_id)",
        join: 'LEFT JOIN companies c ON c.id = fd.company_id'
      },
      department: {
        keyCol: 'fd.department_id',
        labelCol: "COALESCE(ag.name, 'غير مصنّف')",
        join: 'LEFT JOIN analytic_groups ag ON ag.id = fd.department_id'
      },
      analytic: {
        keyCol: "CASE WHEN fd.analytic_account IS NULL OR fd.analytic_account = '' THEN 'بدون مركز' ELSE fd.analytic_account END",
        labelCol: "CASE WHEN fd.analytic_account IS NULL OR fd.analytic_account = '' THEN 'بدون مركز' ELSE fd.analytic_account END",
        join: ''
      },
      account: {
        keyCol: 'fd.account_code',
        labelCol: "COALESCE(ca.name, fd.account_code)",
        join: 'LEFT JOIN company_accounts ca ON ca.company_id = fd.company_id AND ca.code = fd.account_code'
      }
    };

    const validDims = (Array.isArray(rowDims) ? rowDims : (rowDims || '').split(',').map(s => s.trim()))
      .filter(d => dimDefs[d]);
    if (validDims.length === 0) validDims.push('company', 'department');

    const runAggregation = (dFrom, dTo) => {
      const selectCols = [];
      const joins = new Set();
      const groupByCols = [];

      validDims.forEach((dim, idx) => {
        const def = dimDefs[dim];
        selectCols.push(`${def.keyCol} as dim_${idx}_key`);
        selectCols.push(`${def.labelCol} as dim_${idx}_label`);
        groupByCols.push(`dim_${idx}_key`);
        groupByCols.push(`dim_${idx}_label`);
        if (def.join) joins.add(def.join);
      });

      selectCols.push(`${grainExpr} as time_key`);
      groupByCols.push(`time_key`);

      const whereClauses = [];
      const params = {};

      if (dFrom) {
        whereClauses.push('fd.date >= @dFrom');
        params.dFrom = dFrom;
      }
      if (dTo) {
        whereClauses.push('fd.date <= @dTo');
        params.dTo = dTo;
      }
      if (!dFrom && !dTo && (years || year)) {
        const matPeriod = this._periodFilter({ years, year, defaultToCurrentYear: false }, 'fd.date', 'mat_');
        if (matPeriod.sql !== '1=1') {
          whereClauses.push(matPeriod.sql);
          Object.assign(params, matPeriod.params);
        }
      }
      if (companyIds) {
        const cids = (Array.isArray(companyIds) ? companyIds : String(companyIds).split(',')).map(Number).filter(Boolean);
        if (cids.length > 0) whereClauses.push(`fd.company_id IN (${cids.join(',')})`);
      }
      if (departmentIds) {
        const dids = (Array.isArray(departmentIds) ? departmentIds : String(departmentIds).split(',')).map(Number).filter(n => !isNaN(n));
        if (dids.length > 0) whereClauses.push(`fd.department_id IN (${dids.join(',')})`);
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      const sql = `
        SELECT 
          ${selectCols.join(',\n          ')},
          ROUND(SUM(${measureExpr}), 2) as val
        FROM fact_daily fd
        ${Array.from(joins).join('\n        ')}
        ${whereSql}
        GROUP BY ${groupByCols.join(', ')}
        ORDER BY ${groupByCols.join(', ')}
      `;

      return this.db.prepare(sql).all(params);
    };

    const currentRows = runAggregation(dateFrom, dateTo);

    // Collect distinct time columns
    const timeSet = new Set();
    currentRows.forEach(r => { if (r.time_key) timeSet.add(r.time_key); });
    const timeColumns = Array.from(timeSet).sort();

    // Run comparison if requested
    let prevRows = [];
    let prevDateFrom = null;
    let prevDateTo = null;

    if (compare === 'prev_year' && dateFrom && dateTo) {
      const yFrom = parseInt(dateFrom.substring(0, 4)) - 1;
      const yTo = parseInt(dateTo.substring(0, 4)) - 1;
      prevDateFrom = `${yFrom}${dateFrom.substring(4)}`;
      prevDateTo = `${yTo}${dateTo.substring(4)}`;
      prevRows = runAggregation(prevDateFrom, prevDateTo);
    } else if (compare === 'prev_period' && dateFrom && dateTo) {
      const tFrom = new Date(dateFrom).getTime();
      const tTo = new Date(dateTo).getTime();
      const spanDays = Math.max(1, Math.round((tTo - tFrom) / (86400 * 1000))) + 1;
      const pTo = new Date(tFrom - 86400 * 1000);
      const pFrom = new Date(pTo.getTime() - (spanDays - 1) * 86400 * 1000);
      prevDateFrom = pFrom.toISOString().substring(0, 10);
      prevDateTo = pTo.toISOString().substring(0, 10);
      prevRows = runAggregation(prevDateFrom, prevDateTo);
    }

    // Build comparison map by path: key_0:key_1:... -> total
    const prevTotalsByPath = new Map();
    let prevGrandTotal = 0;
    prevRows.forEach(r => {
      prevGrandTotal += (r.val || 0);
      const pathKeys = [];
      for (let i = 0; i < validDims.length; i++) {
        pathKeys.push(r[`dim_${i}_key`]);
        const subPath = pathKeys.join(':::');
        prevTotalsByPath.set(subPath, (prevTotalsByPath.get(subPath) || 0) + (r.val || 0));
      }
    });

    // Build hierarchical tree
    const rootNodes = [];
    const nodeMap = new Map();
    const sparseCells = {};

    const colTotals = {};
    timeColumns.forEach(t => { colTotals[t] = 0; });
    let grandTotal = 0;

    for (const r of currentRows) {
      const val = r.val || 0;
      const tKey = r.time_key;
      if (tKey && colTotals[tKey] !== undefined) {
        colTotals[tKey] = Math.round((colTotals[tKey] + val) * 100) / 100;
      }
      grandTotal = Math.round((grandTotal + val) * 100) / 100;

      const pathKeys = [];
      let parentNode = null;

      for (let i = 0; i < validDims.length; i++) {
        const dimName = validDims[i];
        const keyVal = r[`dim_${i}_key`];
        const labelVal = r[`dim_${i}_label`];
        pathKeys.push(keyVal);
        const currPath = pathKeys.join(':::');
        const nodeId = pathKeys.map(k => String(k).replace(/[^a-zA-Z0-9_\u0600-\u06FF]/g, '_')).join('__');

        let node = nodeMap.get(currPath);
        if (!node) {
          node = {
            id: nodeId,
            dim: dimName,
            key: keyVal,
            label: labelVal,
            values: {},
            total: 0,
            prevTotal: Math.round((prevTotalsByPath.get(currPath) || 0) * 100) / 100,
            diff: 0,
            pct: null,
            children: []
          };
          nodeMap.set(currPath, node);

          if (parentNode) {
            parentNode.children.push(node);
          } else {
            rootNodes.push(node);
          }
        }

        if (tKey) {
          node.values[tKey] = Math.round(((node.values[tKey] || 0) + val) * 100) / 100;
        }
        node.total = Math.round((node.total + val) * 100) / 100;
        node.diff = Math.round((node.total - node.prevTotal) * 100) / 100;
        node.pct = node.prevTotal !== 0 ? Math.round((node.diff / Math.abs(node.prevTotal) * 100) * 10) / 10 : null;

        if (!sparseCells[nodeId]) sparseCells[nodeId] = {};
        if (tKey) {
          sparseCells[nodeId][tKey] = node.values[tKey];
        }

        parentNode = node;
      }
    }

    prevGrandTotal = Math.round(prevGrandTotal * 100) / 100;
    const grandDiff = Math.round((grandTotal - prevGrandTotal) * 100) / 100;
    const grandPct = prevGrandTotal !== 0 ? Math.round((grandDiff / Math.abs(prevGrandTotal) * 100) * 10) / 10 : null;

    let summaryKpis = { revenue: 0, expense: 0, net: 0 };
    try {
      const kWhere = [];
      const kParams = {};
      if (dateFrom) { kWhere.push('fd.date >= @dFrom'); kParams.dFrom = dateFrom; }
      if (dateTo) { kWhere.push('fd.date <= @dTo'); kParams.dTo = dateTo; }
      if (companyIds) {
        const cids = (Array.isArray(companyIds) ? companyIds : String(companyIds).split(',')).map(Number).filter(Boolean);
        if (cids.length > 0) kWhere.push(`fd.company_id IN (${cids.join(',')})`);
      }
      if (departmentIds) {
        const dids = (Array.isArray(departmentIds) ? departmentIds : String(departmentIds).split(',')).map(Number).filter(n => !isNaN(n));
        if (dids.length > 0) kWhere.push(`fd.department_id IN (${dids.join(',')})`);
      }
      const kWhereSql = kWhere.length > 0 ? `WHERE ${kWhere.join(' AND ')}` : '';
      const kRow = this.db.prepare(`
        SELECT 
          ROUND(SUM(revenue), 2) as revenue,
          ROUND(SUM(expense), 2) as expense,
          ROUND(SUM(revenue - expense), 2) as net
        FROM fact_daily fd
        ${kWhereSql}
      `).get(kParams);
      if (kRow) {
        summaryKpis = {
          revenue: kRow.revenue || 0,
          expense: kRow.expense || 0,
          net: kRow.net || 0
        };
      }
    } catch (e) {
      console.error('[getMatrix] Error getting summary KPIs:', e);
    }

    return {
      meta: {
        measure,
        rowDims: validDims,
        timeGrain,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        compare,
        prevDateFrom,
        prevDateTo
      },
      columns: timeColumns.map(t => ({ key: t, label: t })),
      rows: rootNodes,
      cells: sparseCells,
      totals: {
        columns: colTotals,
        grandTotal,
        prevGrandTotal,
        diff: grandDiff,
        pct: grandPct,
        kpis: summaryKpis
      }
    };
  }

  /**
   * Unified receivables and customer collections engine (M1a)
   * Supports:
   * 1. 'registry': Detailed invoice registry (matching Odoo invoices view)
   * 2. 'aging': Debt aging buckets (not_due, 1_30, 31_60, 61_90, 91_180, 181_365, over_365)
   *    Hierarchy: Company -> Department -> Customer -> Invoice
   * 3. 'collection_matrix': Billed vs Collected vs Outstanding matrix by invoice period
   * 4. 'reconciliation': Ledger receivables vs Invoice residuals reconciliation statement
   */
  getReceivables(options = {}) {
    const {
      type = 'registry',
      companyIds,
      departmentIds,
      partnerId,
      partnerName,
      paymentState,
      years,
      year,
      dateFrom,
      dateTo,
      timeGrain = 'month',
      search,
      sortBy = 'date',
      sortOrder = 'desc',
      page = 1,
      limit = 50,
      asOfDate
    } = options;

    const round = (n) => Math.round((n || 0) * 100) / 100;
    const recPeriod = this._periodFilter({ years, year, dateFrom, dateTo, asOfDate, defaultToCurrentYear: false }, 'si.date', 'rec_');
    const effectiveAsOfDate = recPeriod.refDate;

    // Resolve companies: map between companies.id (ledger 1..4) and sales_companies.id (sales 3..6)
    const coRows = this.db.prepare(`
      SELECT c.id as ledger_company_id, c.name as ledger_company_name, sc.id as sales_company_id, sc.name as sales_company_name
      FROM companies c
      JOIN sales_companies sc ON sc.sales_company_id = c.odoo_company_id
      WHERE c.is_active = 1
    `).all();

    const ledgerToSales = new Map();
    const salesToLedger = new Map();
    for (const r of coRows) {
      ledgerToSales.set(r.ledger_company_id, r.sales_company_id);
      salesToLedger.set(r.sales_company_id, r);
    }

    let targetSalesCoIds = [];
    if (companyIds && companyIds.length > 0) {
      const arr = Array.isArray(companyIds) ? companyIds.map(Number) : [Number(companyIds)];
      for (const cid of arr) {
        if (ledgerToSales.has(cid)) {
          targetSalesCoIds.push(ledgerToSales.get(cid));
        } else if (salesToLedger.has(cid)) {
          targetSalesCoIds.push(cid);
        }
      }
    } else {
      targetSalesCoIds = Array.from(ledgerToSales.values());
    }

    // Shared meta disclaimer
    const meta = {
      type,
      asOfDate: effectiveAsOfDate,
      periodLabel: recPeriod.label,
      disclaimer: 'المتبقي يمثل الوضع الحالي في النظام. تواريخ السداد التاريخية للمطابقات ستكتمل في المرحلة M2.'
    };

    // ===== 1. RECONCILIATION =====
    if (type === 'reconciliation') {
      const results = [];
      let grandLedger = 0;
      let grandInvoices = 0;
      let grandDiff = 0;

      for (const r of coRows) {
        if (companyIds && companyIds.length > 0 && !targetSalesCoIds.includes(r.sales_company_id)) {
          continue;
        }

        const ledgerBal = this.db.prepare(`
          SELECT COALESCE(SUM(debit - credit), 0) as total
          FROM journal_items
          WHERE company_id = ? AND account_type = 'asset_receivable' AND move_state = 'posted'
        `).get(r.ledger_company_id).total;

        const invResidual = this.db.prepare(`
          SELECT COALESCE(SUM(amount_residual_signed), 0) as total
          FROM sales_invoices
          WHERE company_id = ?
        `).get(r.sales_company_id).total;

        // Real unmatched non-sales entries (amount_residual != 0 in journal_items)
        const nonInvoiceResidualTotal = this.db.prepare(`
          SELECT COALESCE(SUM(amount_residual), 0) as total, COUNT(*) as cnt
          FROM journal_items
          WHERE company_id = ? AND account_type = 'asset_receivable' AND move_state = 'posted'
            AND ABS(amount_residual) > 0.001
            AND move_name NOT IN (SELECT name FROM sales_invoices WHERE company_id = ?)
        `).get(r.ledger_company_id, r.sales_company_id);

        const realDiff = round(nonInvoiceResidualTotal.total);

        // Paginated unmatched entries
        const p = Math.max(1, parseInt(page) || 1);
        const l = limit === 'all' || limit === 0 ? null : Math.max(1, parseInt(limit) || 50);
        const offset = l ? (p - 1) * l : 0;
        const limitClause = l ? `LIMIT ${l} OFFSET ${offset}` : '';

        const unmatchedEntries = this.db.prepare(`
          SELECT id, odoo_line_id, move_name, journal_name, date, partner_name,
                 debit, credit, (debit - credit) as net, amount_residual
          FROM journal_items
          WHERE company_id = ? AND account_type = 'asset_receivable' AND move_state = 'posted'
            AND ABS(amount_residual) > 0.001
            AND move_name NOT IN (SELECT name FROM sales_invoices WHERE company_id = ?)
          ORDER BY ABS(amount_residual) DESC, date DESC
          ${limitClause}
        `).all(r.ledger_company_id, r.sales_company_id);

        results.push({
          companyId: r.ledger_company_id,
          companyName: r.ledger_company_name,
          company_name: r.ledger_company_name,
          name: r.ledger_company_name,
          ledgerReceivables: round(ledgerBal),
          invoicesResidual: round(invResidual),
          unmatchedDifference: realDiff,
          unmatchedDescription: 'دفعات غير مطابقة وأرصدة أخرى',
          unmatchedEntriesCount: nonInvoiceResidualTotal.cnt,
          entries: unmatchedEntries,
          pagination: {
            page: p,
            limit: l,
            totalCount: nonInvoiceResidualTotal.cnt,
            totalPages: l ? Math.ceil(nonInvoiceResidualTotal.cnt / l) : 1
          }
        });

        grandLedger += ledgerBal;
        grandInvoices += invResidual;
        grandDiff += realDiff;
      }

      return {
        meta,
        companies: results,
        totals: {
          ledgerReceivables: round(grandLedger),
          invoicesResidual: round(grandInvoices),
          unmatchedDifference: round(grandDiff)
        }
      };
    }

    // ===== 2. AGING & REVENUE/COLLECTION HIERARCHY =====
    if (type === 'aging' || type === 'collection_tree' || type === 'revenue_collection') {
      const includePaid = options.includePaid || type === 'collection_tree' || type === 'revenue_collection';
      let whereClause = includePaid ? 'WHERE 1=1' : 'WHERE si.amount_residual_signed != 0';
      const params = { asOfDate: effectiveAsOfDate };

      if (targetSalesCoIds.length > 0) {
        whereClause += ` AND si.company_id IN (${targetSalesCoIds.join(',')})`;
      }
      if (departmentIds && departmentIds.length > 0) {
        const dArr = Array.isArray(departmentIds) ? departmentIds.map(Number) : [Number(departmentIds)];
        whereClause += ` AND id.department_id IN (${dArr.join(',')})`;
      }
      if (partnerId) {
        whereClause += ' AND si.partner_id = @partnerId';
        params.partnerId = Number(partnerId);
      }
      if (partnerName) {
        whereClause += ' AND si.partner_name LIKE @partnerName';
        params.partnerName = `%${partnerName}%`;
      }
      if (recPeriod.sql !== '1=1') {
        whereClause += ` AND ${recPeriod.sql}`;
        Object.assign(params, recPeriod.params);
      }

      const rows = this.db.prepare(`
        SELECT 
          si.company_id as sales_company_id,
          c.id as company_id,
          c.name as company_name,
          id.department_id,
          COALESCE(ag.name, 'غير مصنّف') as department_name,
          si.partner_id,
          COALESCE(NULLIF(TRIM(si.partner_name), ''), 'بدون عميل') as partner_name,
          si.id as invoice_id,
          si.name as invoice_name,
          si.date as invoice_date,
          COALESCE(NULLIF(si.invoice_date_due, ''), si.date) as due_date,
          si.payment_state,
          ROUND(si.amount_total * id.share, 2) as total_amount,
          ROUND((si.amount_total - si.amount_residual_signed) * id.share, 2) as collected_amount,
          ROUND(si.amount_residual_signed * id.share, 2) as residual_amount,
          CAST(julianday(@asOfDate) - julianday(COALESCE(NULLIF(si.invoice_date_due, ''), si.date)) AS INTEGER) as age_days
        FROM sales_invoices si
        JOIN sales_companies sc ON sc.id = si.company_id
        JOIN companies c ON c.odoo_company_id = sc.sales_company_id
        JOIN invoice_departments id ON id.sales_invoice_id = si.id
        LEFT JOIN analytic_groups ag ON ag.id = id.department_id
        ${whereClause}
        ORDER BY c.id, id.department_id, si.partner_name, residual_amount DESC
      `).all(params);

      const bucketTotals = { not_due: 0, b1_30: 0, b31_60: 0, b61_90: 0, b91_180: 0, b181_365: 0, over_365: 0, total_residual: 0, total_billed: 0, total_collected: 0 };
      const companyMap = new Map();

      function getBucketKey(age) {
        if (age <= 0) return 'not_due';
        if (age <= 30) return 'b1_30';
        if (age <= 60) return 'b31_60';
        if (age <= 90) return 'b61_90';
        if (age <= 180) return 'b91_180';
        if (age <= 365) return 'b181_365';
        return 'over_365';
      }

      for (const r of rows) {
        const bKey = getBucketKey(r.age_days);
        const res = r.residual_amount;
        const billed = r.total_amount;
        const coll = r.collected_amount;

        bucketTotals[bKey] += res;
        bucketTotals.total_residual += res;
        bucketTotals.total_billed += billed;
        bucketTotals.total_collected += coll;

        let comp = companyMap.get(r.company_id);
        if (!comp) {
          comp = {
            id: r.company_id,
            name: r.company_name,
            buckets: { not_due: 0, b1_30: 0, b31_60: 0, b61_90: 0, b91_180: 0, b181_365: 0, over_365: 0 },
            total_residual: 0,
            total_billed: 0,
            total_collected: 0,
            departments: new Map()
          };
          companyMap.set(r.company_id, comp);
        }
        comp.buckets[bKey] += res;
        comp.total_residual += res;
        comp.total_billed += billed;
        comp.total_collected += coll;

        let dept = comp.departments.get(r.department_id);
        if (!dept) {
          dept = {
            id: r.department_id,
            name: r.department_name,
            buckets: { not_due: 0, b1_30: 0, b31_60: 0, b61_90: 0, b91_180: 0, b181_365: 0, over_365: 0 },
            total_residual: 0,
            total_billed: 0,
            total_collected: 0,
            partners: new Map()
          };
          comp.departments.set(r.department_id, dept);
        }
        dept.buckets[bKey] += res;
        dept.total_residual += res;
        dept.total_billed += billed;
        dept.total_collected += coll;

        const pKey = r.partner_id || r.partner_name;
        let part = dept.partners.get(pKey);
        if (!part) {
          part = {
            id: r.partner_id,
            name: r.partner_name,
            buckets: { not_due: 0, b1_30: 0, b31_60: 0, b61_90: 0, b91_180: 0, b181_365: 0, over_365: 0 },
            total_residual: 0,
            total_billed: 0,
            total_collected: 0,
            invoices: []
          };
          dept.partners.set(pKey, part);
        }
        part.buckets[bKey] += res;
        part.total_residual += res;
        part.total_billed += billed;
        part.total_collected += coll;

        part.invoices.push({
          id: r.invoice_id,
          name: r.invoice_name,
          date: r.invoice_date,
          due_date: r.due_date,
          total: r.total_amount,
          collected: r.collected_amount,
          residual: r.residual_amount,
          payment_state: r.payment_state,
          age_days: r.age_days,
          bucket: bKey
        });
      }

      const roundBuckets = (b) => {
        const out = {};
        for (const [k, v] of Object.entries(b)) out[k] = round(v);
        return out;
      };

      const tree = Array.from(companyMap.values()).map(comp => {
        const compBuckets = roundBuckets(comp.buckets);
        const compBilled = round(comp.total_billed);
        const compCollected = round(comp.total_collected);
        const compResidual = round(comp.total_residual);
        return {
          id: comp.id,
          name: comp.name,
          company_name: comp.name,
          total_residual: compResidual,
          total_billed: compBilled,
          total_collected: compCollected,
          collection_rate: compBilled > 0 ? round((compCollected / compBilled) * 100) : 0,
          over_90: round((compBuckets.b91_180 || 0) + (compBuckets.b181_365 || 0) + (compBuckets.over_365 || 0)),
          buckets: compBuckets,
          departments: Array.from(comp.departments.values()).map(dept => {
            const deptBuckets = roundBuckets(dept.buckets);
            const deptBilled = round(dept.total_billed);
            const deptCollected = round(dept.total_collected);
            const deptResidual = round(dept.total_residual);
            return {
              id: dept.id,
              name: dept.name,
              department_name: dept.name,
              total_residual: deptResidual,
              total_billed: deptBilled,
              total_collected: deptCollected,
              collection_rate: deptBilled > 0 ? round((deptCollected / deptBilled) * 100) : 0,
              over_90: round((deptBuckets.b91_180 || 0) + (deptBuckets.b181_365 || 0) + (deptBuckets.over_365 || 0)),
              buckets: deptBuckets,
              partners: Array.from(dept.partners.values()).map(p => {
                const pBuckets = roundBuckets(p.buckets);
                const pBilled = round(p.total_billed);
                const pCollected = round(p.total_collected);
                const pResidual = round(p.total_residual);
                return {
                  id: p.id,
                  name: p.name,
                  partner_name: p.name,
                  total_residual: pResidual,
                  total_billed: pBilled,
                  total_collected: pCollected,
                  collection_rate: pBilled > 0 ? round((pCollected / pBilled) * 100) : 0,
                  over_90: round((pBuckets.b91_180 || 0) + (pBuckets.b181_365 || 0) + (pBuckets.over_365 || 0)),
                  buckets: pBuckets,
                  invoices: p.invoices.map(inv => ({
                    ...inv,
                    company_name: comp.name,
                    department_name: dept.name,
                    partner_name: p.name,
                    collection_rate: inv.total > 0 ? round((inv.collected / inv.total) * 100) : 0,
                    over_90: inv.age_days > 90 ? inv.residual : 0
                  }))
                };
              })
            };
          })
        };
      });

      const totalBilled = round(bucketTotals.total_billed);
      const totalCollected = round(bucketTotals.total_collected);
      const totalResidual = round(bucketTotals.total_residual);
      const totalBuckets = roundBuckets(bucketTotals);

      return {
        meta,
        buckets: [
          { key: 'not_due', label: 'غير مستحق' },
          { key: 'b1_30', label: '1 - 30 يوم' },
          { key: 'b31_60', label: '31 - 60 يوم' },
          { key: 'b61_90', label: '61 - 90 يوم' },
          { key: 'b91_180', label: '91 - 180 يوم' },
          { key: 'b181_365', label: '181 - 365 يوم' },
          { key: 'over_365', label: 'أكثر من 365 يوم' }
        ],
        tree,
        totals: {
          total_residual: totalResidual,
          total_billed: totalBilled,
          total_collected: totalCollected,
          collection_rate: totalBilled > 0 ? round((totalCollected / totalBilled) * 100) : 0,
          over_90: round((totalBuckets.b91_180 || 0) + (totalBuckets.b181_365 || 0) + (totalBuckets.over_365 || 0)),
          buckets: totalBuckets
        }
      };
    }

    // ===== 3. COLLECTION MATRIX =====
    if (type === 'collection_matrix') {
      let whereClause = 'WHERE 1=1';
      const params = {};

      if (targetSalesCoIds.length > 0) {
        whereClause += ` AND si.company_id IN (${targetSalesCoIds.join(',')})`;
      }
      if (departmentIds && departmentIds.length > 0) {
        const dArr = Array.isArray(departmentIds) ? departmentIds.map(Number) : [Number(departmentIds)];
        whereClause += ` AND id.department_id IN (${dArr.join(',')})`;
      }
      if (recPeriod.sql !== '1=1') {
        whereClause += ` AND ${recPeriod.sql}`;
        Object.assign(params, recPeriod.params);
      }

      let timeExpr = "strftime('%Y-%m', si.date)";
      if (timeGrain === 'year') timeExpr = "strftime('%Y', si.date)";
      else if (timeGrain === 'quarter') timeExpr = "strftime('%Y', si.date) || '-Q' || ((CAST(strftime('%m', si.date) AS INTEGER) + 2) / 3)";
      else if (timeGrain === 'week') timeExpr = "date(si.date, '-' || strftime('%w', si.date) || ' days')";
      else if (timeGrain === 'day') timeExpr = "si.date";

      const sql = `
        SELECT 
          c.id as company_id,
          c.name as company_name,
          id.department_id,
          COALESCE(ag.name, 'غير مصنّف') as department_name,
          ${timeExpr} as period,
          ROUND(SUM(si.amount_total * id.share), 2) as billed,
          ROUND(SUM((si.amount_total - si.amount_residual_signed) * id.share), 2) as collected,
          ROUND(SUM(si.amount_residual_signed * id.share), 2) as outstanding
        FROM sales_invoices si
        JOIN sales_companies sc ON sc.id = si.company_id
        JOIN companies c ON c.odoo_company_id = sc.sales_company_id
        JOIN invoice_departments id ON id.sales_invoice_id = si.id
        LEFT JOIN analytic_groups ag ON ag.id = id.department_id
        ${whereClause}
        GROUP BY c.id, id.department_id, period
        ORDER BY c.id, id.department_id, period ASC
      `;

      const matrixRows = this.db.prepare(sql).all(params);
      const periodsSet = new Set();
      matrixRows.forEach(r => { if (r.period) periodsSet.add(r.period); });
      const periods = Array.from(periodsSet).sort();

      const totalBilled = round(matrixRows.reduce((s, r) => s + r.billed, 0));
      const totalCollected = round(matrixRows.reduce((s, r) => s + r.collected, 0));
      const totalOutstanding = round(matrixRows.reduce((s, r) => s + r.outstanding, 0));

      return {
        meta: { ...meta, timeGrain },
        periods,
        rows: matrixRows,
        summary: {
          total_billed: totalBilled,
          total_collected: totalCollected,
          total_outstanding: totalOutstanding,
          collection_rate: totalBilled !== 0 ? round((totalCollected / totalBilled) * 100) : 0
        }
      };
    }

    // ===== 4. REGISTRY (Default) =====
    let whereClause = 'WHERE 1=1';
    const params = { asOfDate: effectiveAsOfDate };

    if (targetSalesCoIds.length > 0) {
      whereClause += ` AND si.company_id IN (${targetSalesCoIds.join(',')})`;
    }
    if (departmentIds && departmentIds.length > 0) {
      const dArr = Array.isArray(departmentIds) ? departmentIds.map(Number) : [Number(departmentIds)];
      whereClause += ` AND EXISTS (SELECT 1 FROM invoice_departments _id WHERE _id.sales_invoice_id = si.id AND _id.department_id IN (${dArr.join(',')}))`;
    }
    if (paymentState) {
      if (Array.isArray(paymentState)) {
        whereClause += ` AND si.payment_state IN (${paymentState.map(s => `'${s}'`).join(',')})`;
      } else {
        whereClause += ' AND si.payment_state = @paymentState';
        params.paymentState = paymentState;
      }
    }
    if (recPeriod.sql !== '1=1') {
      whereClause += ` AND ${recPeriod.sql}`;
      Object.assign(params, recPeriod.params);
    }
    if (partnerId) {
      whereClause += ' AND si.partner_id = @partnerId';
      params.partnerId = Number(partnerId);
    }
    if (partnerName) {
      whereClause += ' AND si.partner_name LIKE @partnerName';
      params.partnerName = `%${partnerName}%`;
    }
    if (search) {
      whereClause += ' AND (si.name LIKE @search OR si.partner_name LIKE @search)';
      params.search = `%${search}%`;
    }

    const summary = this.db.prepare(`
      SELECT 
        COUNT(*) as total_count,
        ROUND(COALESCE(SUM(si.amount_total), 0), 2) as total_billed,
        ROUND(COALESCE(SUM(si.amount_total - si.amount_residual_signed), 0), 2) as total_collected,
        ROUND(COALESCE(SUM(si.amount_residual_signed), 0), 2) as total_outstanding,
        ROUND(COALESCE(AVG(CAST(julianday(@asOfDate) - julianday(COALESCE(NULLIF(si.invoice_date_due, ''), si.date)) AS INTEGER)), 0), 1) as avg_age_days
      FROM sales_invoices si
      ${whereClause}
    `).get(params);

    const sortMap = {
      date: 'si.date',
      invoice_date_due: 'si.invoice_date_due',
      name: 'si.name',
      partner_name: 'si.partner_name',
      amount_total: 'si.amount_total',
      amount_residual_signed: 'si.amount_residual_signed',
      collected: '(si.amount_total - si.amount_residual_signed)',
      age_days: 'age_days'
    };
    const sortCol = sortMap[sortBy] || 'si.date';
    const orderDir = (sortOrder || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const p = Math.max(1, parseInt(page) || 1);
    const l = limit === 'all' || limit === 0 ? null : Math.max(1, parseInt(limit) || 50);
    const offset = l ? (p - 1) * l : 0;
    const limitClause = l ? `LIMIT ${l} OFFSET ${offset}` : '';

    const invoices = this.db.prepare(`
      SELECT 
        si.id,
        si.name,
        si.date,
        si.invoice_date_due,
        si.partner_id,
        si.partner_name,
        si.journal_id,
        si.journal_name,
        c.id as company_id,
        c.name as company_name,
        si.amount_total,
        si.amount_untaxed,
        si.amount_residual_signed,
        ROUND(si.amount_total - si.amount_residual_signed, 2) as collected,
        si.payment_state,
        CAST(julianday(@asOfDate) - julianday(COALESCE(NULLIF(si.invoice_date_due, ''), si.date)) AS INTEGER) as age_days
      FROM sales_invoices si
      JOIN sales_companies sc ON sc.id = si.company_id
      JOIN companies c ON c.odoo_company_id = sc.sales_company_id
      ${whereClause}
      ORDER BY ${sortCol} ${orderDir}, si.id DESC
      ${limitClause}
    `).all(params);

    const invoiceIds = invoices.map(i => i.id);
    if (invoiceIds.length > 0) {
      const depts = this.db.prepare(`
        SELECT id.sales_invoice_id, id.department_id, id.share, COALESCE(ag.name, 'غير مصنّف') as department_name
        FROM invoice_departments id
        LEFT JOIN analytic_groups ag ON ag.id = id.department_id
        WHERE id.sales_invoice_id IN (${invoiceIds.join(',')})
      `).all();

      const deptsByInv = {};
      for (const d of depts) {
        if (!deptsByInv[d.sales_invoice_id]) deptsByInv[d.sales_invoice_id] = [];
        deptsByInv[d.sales_invoice_id].push(d);
      }

      for (const inv of invoices) {
        const invDepts = deptsByInv[inv.id] || [];
        inv.departments = invDepts;
        inv.department_name = invDepts.map(d => d.department_name).join('، ');
      }
    }

    return {
      meta,
      pagination: {
        page: p,
        limit: l,
        totalCount: summary.total_count,
        totalPages: l ? Math.ceil(summary.total_count / l) : 1
      },
      summary: {
        total_billed: summary.total_billed,
        total_collected: summary.total_collected,
        total_outstanding: summary.total_outstanding,
        collection_rate: summary.total_billed !== 0 ? round((summary.total_collected / summary.total_billed) * 100) : 0,
        avg_age_days: summary.avg_age_days
      },
      invoices
    };
  }

  /**
   * Resolve and rebuild invoice departments according to unified rule (R2):
   * 1. Analytic account of income lines for that move in journal_items -> group_id (proportional by line amount)
   * 2. If no income lines or none mapped to an analytic group -> journal_name via analytic_group_mapping.journal_name
   * 3. Otherwise unclassified (0)
   */
  resolveInvoiceDepartments(companyId) {
    const targetCompanies = companyId 
      ? [companyId] 
      : this.db.prepare('SELECT id FROM sales_companies WHERE is_active = 1').all().map(c => c.id);

    let totalAllocations = 0;

    for (const scId of targetCompanies) {
      const coRow = this.db.prepare(`
        SELECT c.id as ledger_company_id 
        FROM companies c 
        JOIN sales_companies sc ON sc.sales_company_id = c.odoo_company_id 
        WHERE sc.id = ?
      `).get(scId);
      const ledgerCid = coRow ? coRow.ledger_company_id : scId;

      // Build mappings with ORDER BY id ASC for deterministic resolution matching fact_daily
      const journalMap = {};
      this.db.prepare(`
        SELECT journal_name, group_id 
        FROM analytic_group_mapping 
        WHERE company_id = ? AND journal_name IS NOT NULL AND journal_name != ''
        ORDER BY id ASC
      `).all(ledgerCid).forEach(r => {
        const k = (r.journal_name || '').trim();
        if (journalMap[k] === undefined) journalMap[k] = r.group_id;
      });

      const analyticMap = {};
      this.db.prepare(`
        SELECT analytic_account, group_id 
        FROM analytic_group_mapping 
        WHERE company_id = ? AND analytic_account IS NOT NULL AND analytic_account != ''
        ORDER BY id ASC
      `).all(ledgerCid).forEach(r => {
        const k = (r.analytic_account || '').trim();
        if (analyticMap[k] === undefined) analyticMap[k] = r.group_id;
      });

      // Preload income lines for this ledger company
      const incomeLines = this.db.prepare(`
        SELECT ji.move_name, ji.analytic_account, ABS(ji.credit - ji.debit) as amt
        FROM journal_items ji
        ${this._sectionJoin('ji', 'o')}
        WHERE ji.company_id = ?
          AND ji.move_state = 'posted'
          AND ${this._sectionExpr('ji', 'o')} = 'income'
      `).all(ledgerCid);

      const incomeByMove = {};
      for (const l of incomeLines) {
        if (!incomeByMove[l.move_name]) incomeByMove[l.move_name] = [];
        incomeByMove[l.move_name].push({
          analytic: (l.analytic_account || '').trim(),
          amt: l.amt || 0
        });
      }

      // Delete existing allocations
      this.db.prepare(`
        DELETE FROM invoice_departments 
        WHERE sales_invoice_id IN (SELECT id FROM sales_invoices WHERE company_id = ?)
      `).run(scId);

      const insertDept = this.db.prepare(`
        INSERT OR REPLACE INTO invoice_departments (sales_invoice_id, department_id, share)
        VALUES (?, ?, ?)
      `);

      const invoices = this.db.prepare('SELECT id, name, journal_name FROM sales_invoices WHERE company_id = ?').all(scId);

      const insertAll = this.db.transaction(() => {
        for (const inv of invoices) {
          let deptShares = [];

          // Rule 1: Analytic account from income lines (proportional)
          const lines = incomeByMove[inv.name];
          if (lines && lines.length > 0) {
            const groupAmounts = {};
            let totalMappedAmt = 0;
            for (const line of lines) {
              if (line.analytic && analyticMap[line.analytic] !== undefined) {
                const gid = analyticMap[line.analytic];
                groupAmounts[gid] = (groupAmounts[gid] || 0) + line.amt;
                totalMappedAmt += line.amt;
              }
            }

            if (totalMappedAmt > 0) {
              deptShares = Object.entries(groupAmounts).map(([gid, amt]) => ({
                deptId: parseInt(gid),
                share: Math.round((amt / totalMappedAmt) * 10000) / 10000
              }));
              const sSum = deptShares.reduce((s, d) => s + d.share, 0);
              if (deptShares.length > 0 && Math.abs(sSum - 1.0) > 0.00001) {
                deptShares[0].share = Math.round((deptShares[0].share + (1.0 - sSum)) * 10000) / 10000;
              }
            }
          }

          // Rule 2: Journal name fallback
          if (deptShares.length === 0) {
            const jname = (inv.journal_name || '').trim();
            if (jname && journalMap[jname] !== undefined) {
              deptShares = [{ deptId: journalMap[jname], share: 1.0 }];
            } else {
              deptShares = [{ deptId: 0, share: 1.0 }];
            }
          }

          for (const ds of deptShares) {
            insertDept.run(inv.id, ds.deptId, ds.share);
            totalAllocations++;
          }
        }
      });

      insertAll();
    }

    return totalAllocations;
  }

  /**
   * Get list of invoices where analytic department differs from journal department (R2 conflict monitor)
   */
  getDepartmentConflicts(options = {}) {
    const { companyId } = options;
    const compRows = this.db.prepare(`
      SELECT c.id as ledger_cid, sc.id as sales_cid, c.name as company_name
      FROM companies c
      JOIN sales_companies sc ON sc.sales_company_id = c.odoo_company_id AND sc.name = c.name
      WHERE c.is_active = 1 ${companyId ? 'AND c.id = ?' : ''}
    `).all(...(companyId ? [companyId] : []));

    const conflicts = [];

    for (const c of compRows) {
      const journalMap = {};
      this.db.prepare(`
        SELECT journal_name, group_id, ag.name as group_name
        FROM analytic_group_mapping agm
        JOIN analytic_groups ag ON ag.id = agm.group_id
        WHERE company_id = ? AND journal_name IS NOT NULL AND journal_name != ''
        ORDER BY agm.id ASC
      `).all(c.ledger_cid).forEach(r => {
        const k = (r.journal_name || '').trim();
        if (journalMap[k] === undefined) journalMap[k] = { id: r.group_id, name: r.group_name };
      });

      const analyticMap = {};
      this.db.prepare(`
        SELECT analytic_account, group_id, ag.name as group_name
        FROM analytic_group_mapping agm
        JOIN analytic_groups ag ON ag.id = agm.group_id
        WHERE company_id = ? AND analytic_account IS NOT NULL AND analytic_account != ''
        ORDER BY agm.id ASC
      `).all(c.ledger_cid).forEach(r => {
        const k = (r.analytic_account || '').trim();
        if (analyticMap[k] === undefined) analyticMap[k] = { id: r.group_id, name: r.group_name };
      });

      const incomeLines = this.db.prepare(`
        SELECT ji.move_name, ji.analytic_account, ABS(ji.credit - ji.debit) as amt
        FROM journal_items ji
        ${this._sectionJoin('ji', 'o')}
        WHERE ji.company_id = ?
          AND ji.move_state = 'posted'
          AND ${this._sectionExpr('ji', 'o')} = 'income'
      `).all(c.ledger_cid);

      const incomeByMove = {};
      for (const l of incomeLines) {
        if (!incomeByMove[l.move_name]) incomeByMove[l.move_name] = [];
        incomeByMove[l.move_name].push(l);
      }

      const invoices = this.db.prepare(`
        SELECT id, name, journal_name, date, partner_name, amount_total, amount_untaxed, amount_residual_signed
        FROM sales_invoices
        WHERE company_id = ?
      `).all(c.sales_cid);

      for (const inv of invoices) {
        const jname = (inv.journal_name || '').trim();
        const journalDept = jname && journalMap[jname] ? journalMap[jname] : null;

        const lines = incomeByMove[inv.name] || [];
        let analyticDepts = [];
        for (const l of lines) {
          const aname = (l.analytic_account || '').trim();
          if (aname && analyticMap[aname]) {
            analyticDepts.push({
              deptId: analyticMap[aname].id,
              deptName: analyticMap[aname].name,
              analytic: aname,
              amt: l.amt
            });
          }
        }

        if (journalDept && analyticDepts.length > 0) {
          const diffDept = analyticDepts.some(d => d.deptId !== journalDept.id);
          if (diffDept) {
            conflicts.push({
              companyId: c.ledger_cid,
              companyName: c.company_name,
              invoiceId: inv.id,
              invoiceName: inv.name,
              date: inv.date,
              partnerName: inv.partner_name,
              amountTotal: inv.amount_total,
              amountUntaxed: inv.amount_untaxed,
              amountResidual: inv.amount_residual_signed,
              journalName: jname,
              journalDeptId: journalDept.id,
              journalDeptName: journalDept.name,
              analyticAccounts: analyticDepts.map(d => d.analytic).join(', '),
              analyticDeptId: analyticDepts[0].deptId,
              analyticDeptName: analyticDepts[0].deptName,
              resolvedDepartmentName: analyticDepts[0].deptName,
              resolutionRule: 'الحساب التحليلي لأسطر الإيراد (الأولوية الأولى الموحدة)'
            });
          }
        }
      }
    }

    return {
      totalConflicts: conflicts.length,
      totalUntaxedAmount: Math.round(conflicts.reduce((s, c) => s + (c.amountUntaxed || 0), 0) * 100) / 100,
      conflicts
    };
  }

  /**
   * Get consolidated Performance & Collections KPI summary
   * Revenue & Expenses from getIncomeStatement (excluding tax)
   * Receivables, Billed, Collected, Outstanding from getReceivables
   */
  getPerformanceSummary({ companyIds, years, year, dateFrom, dateTo } = {}) {
    const period = this._periodFilter({ years, year, dateFrom, dateTo, defaultToCurrentYear: true }, 'ji.date', 'ps_');

    const cIds = companyIds && companyIds.length > 0
      ? (Array.isArray(companyIds) ? companyIds.map(Number) : String(companyIds).split(',').map(Number))
      : null;

    // 1. P&L from getIncomeStatement
    const is = this.getIncomeStatement({
      companyIds: cIds,
      years: period.yearsList,
      dateFrom: period.dateFrom,
      dateTo: period.dateTo
    });
    const revenue = Math.round(is.summary?.totalRevenue || 0);
    const expenses = Math.round(is.summary?.totalExpenses || 0);
    const netProfit = Math.round(is.summary?.netProfit !== undefined ? is.summary.netProfit : (revenue - expenses));

    // 2. Receivables from getReceivables (includePaid: true for accurate billed/collected in period)
    const rec = this.getReceivables({
      type: 'revenue_collection',
      companyIds: cIds,
      years: period.yearsList,
      dateFrom: period.dateFrom,
      dateTo: period.dateTo,
      asOfDate: period.refDate,
      includePaid: true
    });

    const billed = Math.round(rec.totals?.total_billed || 0);
    const collected = Math.round(rec.totals?.total_collected || 0);
    const outstanding = Math.round(rec.totals?.total_residual || 0);
    const over90 = Math.round(rec.totals?.over_90 || 0);
    const collectionRate = billed > 0 ? Math.round((collected / billed) * 1000) / 10 : 0;

    return {
      revenue,
      expenses,
      netProfit,
      outstanding,
      billed,
      collected,
      over90,
      collectionRate,
      raw: {
        revenue: is.summary?.totalRevenue || 0,
        expenses: is.summary?.totalExpenses || 0,
        netProfit: is.summary?.netProfit || 0,
        outstanding: rec.totals?.total_residual || 0,
        billed: rec.totals?.total_billed || 0,
        collected: rec.totals?.total_collected || 0
      }
    };
  }

  /**
   * Unified Executive Dashboard Data Engine:
   * Returns:
   * 1. 5 KPI Summary cards (untaxed revenue, expenses, net profit & margin, untaxed collected & rate, period residual & overdue)
   * 2. Monthly Trend Series (revenue, expenses, cash collected)
   * 3. Hierarchical Performance & Collection Tree (Company -> Department -> Clients / Accounts) with Sticky Footer Totals
   * 4. Folded Aging Tree (Company -> Department -> Client with 7 buckets)
   */
  getExecutiveSummary({ companyIds, years, year, dateFrom, dateTo, asOfDate, fullTree = false, includeAging = false }) {
    const period = this._periodFilter({ years, year, dateFrom, dateTo, asOfDate, defaultToCurrentYear: true }, 'si.date', 'exec_');
    const isAll = period.isAll;
    const refDate = period.refDate;
    const df = period.dateFrom;
    const dt = period.dateTo;

    // Company mappings
    const coRows = this.db.prepare(`
      SELECT c.id as ledger_cid, c.name as ledger_name, sc.id as sales_cid, sc.name as sales_name
      FROM companies c
      JOIN sales_companies sc ON sc.sales_company_id = c.odoo_company_id
      WHERE c.is_active = 1
      ORDER BY c.id ASC
    `).all();

    const ledgerToSales = new Map();
    const salesToLedger = new Map();
    for (const r of coRows) {
      ledgerToSales.set(r.ledger_cid, r.sales_cid);
      salesToLedger.set(r.sales_cid, r);
    }

    let targetLedgerIds = coRows.map(r => r.ledger_cid);
    let targetSalesIds = coRows.map(r => r.sales_cid);

    if (companyIds && companyIds.length > 0) {
      const rawIds = Array.isArray(companyIds) ? companyIds.map(Number) : String(companyIds).split(',').map(Number);
      targetLedgerIds = [];
      targetSalesIds = [];
      for (const id of rawIds) {
        if (ledgerToSales.has(id)) {
          targetLedgerIds.push(id);
          targetSalesIds.push(ledgerToSales.get(id));
        } else if (salesToLedger.has(id)) {
          targetSalesIds.push(id);
          targetLedgerIds.push(salesToLedger.get(id).ledger_cid);
        }
      }
      if (targetLedgerIds.length === 0) targetLedgerIds = [-1];
      if (targetSalesIds.length === 0) targetSalesIds = [-1];
    }

    // 1. Cards P&L
    const is = this.getIncomeStatement({
      companyIds: targetLedgerIds,
      years: period.yearsList,
      dateFrom: period.dateFrom,
      dateTo: period.dateTo
    });
    const rawRev = is.summary?.totalRevenue || 0;
    const rawExp = is.summary?.totalExpenses || 0;
    const revenue = Math.round(rawRev);
    const expenses = Math.round(rawExp);
    const net_profit = Math.round(rawRev - rawExp);
    const margin = revenue > 0 ? Math.round((net_profit / revenue) * 1000) / 10 : 0;

    // 2. Invoices & Untaxed Collection
    let invWhere = `WHERE si.company_id IN (${targetSalesIds.join(',')})`;
    const invParams = {};
    if (period.sql !== '1=1') {
      invWhere += ` AND ${period.sql}`;
      Object.assign(invParams, period.params);
    }

    const invList = this.db.prepare(`
      SELECT 
        si.id,
        si.name as invoice_name,
        si.company_id as sales_cid,
        c.id as ledger_cid,
        c.name as company_name,
        id.department_id,
        COALESCE(ag.name, 'غير مصنّف') as department_name,
        si.partner_id,
        COALESCE(NULLIF(TRIM(si.partner_name), ''), 'بدون عميل') as partner_name,
        si.amount_untaxed,
        si.amount_total,
        si.amount_residual_signed,
        si.date as invoice_date,
        COALESCE(NULLIF(si.invoice_date_due, ''), si.date) as due_date,
        si.payment_state,
        id.share,
        CAST(julianday(@refDate) - julianday(COALESCE(NULLIF(si.invoice_date_due, ''), si.date)) AS INTEGER) as age_days
      FROM sales_invoices si
      JOIN sales_companies sc ON sc.id = si.company_id
      JOIN companies c ON c.odoo_company_id = sc.sales_company_id
      JOIN invoice_departments id ON id.sales_invoice_id = si.id
      LEFT JOIN analytic_groups ag ON ag.id = id.department_id
      ${invWhere}
    `).all({ ...invParams, refDate });

    let rawBilled = 0;
    let rawCollected = 0;
    let rawResidual = 0;
    let rawOverdue90 = 0;

    // Map: ledger_cid -> dept_id -> partner_id -> clientData
    const invMap = new Map();
    for (const inv of invList) {
      const tot = inv.amount_total || 0;
      const untax = inv.amount_untaxed || 0;
      const res = inv.amount_residual_signed || 0;
      const share = inv.share || 1;

      const billed = untax * share;
      const residual = res * share;
      let collected = 0;
      if (tot !== 0) {
        const paidRatio = (tot - res) / tot;
        collected = (untax * paidRatio) * share;
      }

      rawBilled += billed;
      rawCollected += collected;
      rawResidual += residual;
      if (residual > 0 && inv.age_days > 90) {
        rawOverdue90 += residual;
      }

      const lCid = inv.ledger_cid;
      if (!invMap.has(lCid)) invMap.set(lCid, new Map());
      const dMap = invMap.get(lCid);

      const dId = inv.department_id || 0;
      if (!dMap.has(dId)) {
        dMap.set(dId, {
          dept_id: dId,
          dept_name: inv.department_name,
          billed: 0,
          collected: 0,
          residual: 0,
          clients: new Map()
        });
      }
      const dData = dMap.get(dId);
      dData.billed += billed;
      dData.collected += collected;
      dData.residual += residual;

      const pKey = inv.partner_id || inv.partner_name;
      if (!dData.clients.has(pKey)) {
        dData.clients.set(pKey, {
          partner_id: inv.partner_id,
          name: inv.partner_name,
          billed: 0,
          collected: 0,
          residual: 0,
          invoices: []
        });
      }
      const cData = dData.clients.get(pKey);
      cData.billed += billed;
      cData.collected += collected;
      cData.residual += residual;
      cData.invoices.push({
        id: inv.id,
        name: inv.invoice_name,
        date: inv.invoice_date,
        due_date: inv.due_date,
        amount_untaxed: inv.amount_untaxed,
        amount_total: inv.amount_total,
        amount_residual: inv.amount_residual_signed,
        payment_state: inv.payment_state,
        age_days: inv.age_days
      });
    }

    const billed_period_untaxed = Math.round(rawBilled);
    const collected_period_untaxed = Math.round(rawCollected);
    const collection_rate_untaxed = billed_period_untaxed > 0 ? Math.round((collected_period_untaxed / billed_period_untaxed) * 1000) / 10 : 0;
    const residual_period = Math.round(rawResidual);
    const overdue_90 = Math.round(rawOverdue90);

    const cards = {
      revenue,
      expenses,
      net_profit,
      profit_margin: margin,
      collected_period_untaxed,
      billed_period_untaxed,
      collection_rate_untaxed,
      residual_period,
      overdue_90
    };

    // 3. Monthly Series from fact_daily
    let fdWhere = `WHERE fd.company_id IN (${targetLedgerIds.join(',')})`;
    const fdParams = {};
    if (period.sql !== '1=1') {
      const fdPeriod = this._periodFilter({ years: period.yearsList, dateFrom: period.dateFrom, dateTo: period.dateTo }, 'fd.date', 'fd_');
      if (fdPeriod.sql !== '1=1') {
        fdWhere += ` AND ${fdPeriod.sql}`;
        Object.assign(fdParams, fdPeriod.params);
      }
    }

    const ARABIC_MONTHS = {
      '01': 'يناير', '02': 'فبراير', '03': 'مارس', '04': 'أبريل',
      '05': 'مايو', '06': 'يونيو', '07': 'يوليو', '08': 'أغسطس',
      '09': 'سبتمبر', '10': 'أكتوبر', '11': 'نوفمبر', '12': 'ديسمبر'
    };

    const isMultiYear = isAll || (period.yearsList && period.yearsList.length > 1);

    let monthlyRows = [];
    if (isMultiYear) {
      monthlyRows = this.db.prepare(`
        SELECT 
          fd.year as grain_key,
          fd.year as grain_label,
          ROUND(SUM(fd.revenue), 2) as rev,
          ROUND(SUM(fd.expense), 2) as exp,
          ROUND(SUM(fd.collected), 2) as col
        FROM fact_daily fd
        ${fdWhere}
        GROUP BY fd.year
        ORDER BY fd.year ASC
      `).all(fdParams);
    } else {
      monthlyRows = this.db.prepare(`
        SELECT 
          fd.month as grain_key,
          fd.month as grain_label,
          ROUND(SUM(fd.revenue), 2) as rev,
          ROUND(SUM(fd.expense), 2) as exp,
          ROUND(SUM(fd.collected), 2) as col
        FROM fact_daily fd
        ${fdWhere}
        GROUP BY fd.month
        ORDER BY fd.month ASC
      `).all(fdParams);
    }

    const monthly_series = monthlyRows.map(r => {
      let label = r.grain_label;
      if (!isMultiYear && r.grain_key && r.grain_key.includes('-')) {
        const [y, m] = r.grain_key.split('-');
        label = `${ARABIC_MONTHS[m] || m} ${y}`;
      }
      return {
        key: r.grain_key,
        label,
        is_year: isMultiYear,
        revenue: Math.round(r.rev || 0),
        expenses: Math.round(r.exp || 0),
        collected_cash: Math.round(r.col || 0)
      };
    });

    const sumMonthlyRev = monthly_series.reduce((s, m) => s + m.revenue, 0);
    const revDiff = revenue - sumMonthlyRev;
    if (revDiff !== 0 && monthly_series.length > 0) {
      const maxMonthlyAllowedDiff = Math.max(2.0, Math.ceil(monthly_series.length * 0.5));
      if (Math.abs(revDiff) > maxMonthlyAllowedDiff) {
        throw new Error(`[ExecutiveSummary] Discrepancy in monthly series revenue too large: target=${revenue}, sumMonthlyRev=${sumMonthlyRev}, diff=${revDiff}, limit=${maxMonthlyAllowedDiff}. Rounding adjustment rejected.`);
      }
      let maxIdx = 0;
      for (let i = 1; i < monthly_series.length; i++) {
        if (monthly_series[i].revenue > monthly_series[maxIdx].revenue) maxIdx = i;
      }
      monthly_series[maxIdx].revenue += revDiff;
    }

    // 4. Accounts from fact_daily for Tree
    const fdAccounts = this.db.prepare(`
      SELECT 
        fd.company_id as ledger_cid,
        fd.department_id,
        COALESCE(ag.name, 'غير مصنّف') as department_name,
        fd.account_code,
        COALESCE(ca.name, fd.account_code) as account_name,
        SUM(fd.revenue) as revenue,
        SUM(fd.expense) as expense
      FROM fact_daily fd
      LEFT JOIN analytic_groups ag ON ag.id = fd.department_id
      LEFT JOIN company_accounts ca ON ca.company_id = fd.company_id AND ca.code = fd.account_code
      ${fdWhere}
      GROUP BY fd.company_id, fd.department_id, fd.account_code
      HAVING (SUM(fd.revenue) != 0 OR SUM(fd.expense) != 0)
      ORDER BY fd.company_id, fd.department_id, revenue DESC, expense DESC
    `).all(fdParams);

    const accMap = new Map();
    for (const row of fdAccounts) {
      const lCid = row.ledger_cid;
      if (!accMap.has(lCid)) accMap.set(lCid, new Map());
      const dMap = accMap.get(lCid);

      const dId = row.department_id || 0;
      if (!dMap.has(dId)) {
        dMap.set(dId, {
          dept_id: dId,
          dept_name: row.department_name,
          revenue: 0,
          expense: 0,
          accounts: []
        });
      }
      const dData = dMap.get(dId);
      dData.revenue += (row.revenue || 0);
      dData.expense += (row.expense || 0);
      dData.accounts.push({
        code: row.account_code,
        name: row.account_name,
        revenue: row.revenue || 0,
        expense: row.expense || 0
      });
    }

    function adjustListRounding(list, key, target, cascadeChildKey, maxAllowed = 1.0) {
      if (!list || list.length === 0) return;
      const current = list.reduce((s, it) => s + (it[key] || 0), 0);
      const diff = target - current;
      const limit = Math.max(maxAllowed, Math.ceil(list.length * 0.5));
      if (Math.abs(diff) > limit) {
        throw new Error(`[ExecutiveSummary] Discrepancy too large in ${key}: target=${target}, current=${current}, diff=${diff}, limit=${limit}. Rounding adjustment rejected.`);
      }
      if (diff !== 0) {
        let maxIdx = 0;
        for (let i = 1; i < list.length; i++) {
          if (Math.abs(list[i][key] || 0) > Math.abs(list[maxIdx][key] || 0)) maxIdx = i;
        }
        list[maxIdx][key] += diff;
        if (key === 'revenue' || key === 'expenses') {
          list[maxIdx].net_profit = (list[maxIdx].revenue || 0) - (list[maxIdx].expenses || 0);
        }
        if (cascadeChildKey && list[maxIdx].children && list[maxIdx].children.length > 0) {
          adjustListRounding(list[maxIdx].children, key, list[maxIdx][key], false, 2.0);
        }
      }
    }

    // 5. Build Tree
    const companies = [];
    let grandRev = 0, grandExp = 0, grandBilled = 0, grandCollected = 0, grandResidual = 0;

    for (const cid of targetLedgerIds) {
      const coMeta = coRows.find(c => c.ledger_cid === cid);
      const coName = coMeta ? coMeta.ledger_name : `شركة ${cid}`;

      const dInv = invMap.get(cid) || new Map();
      const dAcc = accMap.get(cid) || new Map();
      const allDeptIds = new Set([...dInv.keys(), ...dAcc.keys()]);

      let coRev = 0, coExp = 0, coBilled = 0, coCollected = 0, coResidual = 0;
      const depts = [];

      for (const dId of allDeptIds) {
        const invDept = dInv.get(dId);
        const accDept = dAcc.get(dId);

        const deptName = (invDept && invDept.dept_name) || (accDept && accDept.dept_name) || (dId === 0 ? 'غير مصنّف' : `قسم ${dId}`);
        const dRev = accDept ? accDept.revenue : 0;
        const dExp = accDept ? accDept.expense : 0;
        const dBilled = invDept ? invDept.billed : 0;
        const dCollected = invDept ? invDept.collected : 0;
        const dResidual = invDept ? invDept.residual : 0;

        coRev += dRev;
        coExp += dExp;
        coBilled += dBilled;
        coCollected += dCollected;
        coResidual += dResidual;

        const clientCount = invDept && invDept.clients ? invDept.clients.size : 0;
        const accountCount = accDept && accDept.accounts ? accDept.accounts.length : 0;
        const hasChildren = clientCount > 0 || accountCount > 0;

        const clientsList = [];
        if (fullTree && invDept && invDept.clients) {
          for (const [pKey, cl] of invDept.clients.entries()) {
            const cBilled = Math.round(cl.billed);
            const cColl = Math.round(cl.collected);
            const cRes = Math.round(cl.residual);
            const cRate = cBilled > 0 ? Math.round((cColl / cBilled) * 1000) / 10 : 0;
            clientsList.push({
              id: `client_${cid}_${dId}_${cl.partner_id || pKey}`,
              partner_id: cl.partner_id,
              name: cl.name,
              billed: cBilled,
              collected: cColl,
              residual: cRes,
              collection_rate: cRate,
              revenue: null,
              expenses: null,
              net_profit: null,
              margin: null,
              invoices: cl.invoices
            });
          }
          clientsList.sort((a, b) => b.billed - a.billed);
        }

        const accountsList = [];
        if (fullTree && accDept && accDept.accounts) {
          for (const ac of accDept.accounts) {
            const aRev = Math.round(ac.revenue);
            const aExp = Math.round(ac.expense);
            const aNet = aRev - aExp;
            const aMargin = aRev > 0 ? Math.round((aNet / aRev) * 1000) / 10 : 0;
            accountsList.push({
              id: `acc_${cid}_${dId}_${ac.code}`,
              code: ac.code,
              name: ac.name,
              revenue: aRev,
              expenses: aExp,
              net_profit: aNet,
              margin: aMargin,
              billed: null,
              collected: null,
              residual: null,
              collection_rate: null
            });
          }
          accountsList.sort((a, b) => (b.revenue - b.expenses) - (a.revenue - a.expenses));
        }

        const dNet = Math.round(dRev - dExp);
        const dMargin = dRev > 0 ? Math.round((dNet / dRev) * 1000) / 10 : 0;
        const dRate = dBilled > 0 ? Math.round((dCollected / dBilled) * 1000) / 10 : 0;

        const subGroups = [];
        if (fullTree && clientsList.length > 0) {
          subGroups.push({
            id: `sub_clients_${cid}_${dId}`,
            name: 'العملاء',
            isGroup: true,
            billed: Math.round(dBilled),
            collected: Math.round(dCollected),
            residual: Math.round(dResidual),
            collection_rate: dRate,
            revenue: null,
            expenses: null,
            net_profit: null,
            margin: null,
            children: clientsList
          });
        }
        if (fullTree && accountsList.length > 0) {
          subGroups.push({
            id: `sub_accounts_${cid}_${dId}`,
            name: 'الحسابات',
            isGroup: true,
            revenue: Math.round(dRev),
            expenses: Math.round(dExp),
            net_profit: dNet,
            margin: dMargin,
            billed: null,
            collected: null,
            residual: null,
            collection_rate: null,
            children: accountsList
          });
        }

        depts.push({
          id: `dept_${cid}_${dId}`,
          department_id: dId,
          name: deptName,
          has_children: hasChildren,
          client_count: clientCount,
          account_count: accountCount,
          _rawRev: dRev,
          _rawExp: dExp,
          _rawBilled: dBilled,
          _rawColl: dCollected,
          _rawRes: dResidual,
          revenue: Math.round(dRev),
          expenses: Math.round(dExp),
          net_profit: dNet,
          margin: dMargin,
          billed: Math.round(dBilled),
          collected: Math.round(dCollected),
          collection_rate: dRate,
          residual: Math.round(dResidual),
          children: subGroups
        });
      }

      depts.sort((a, b) => b.revenue - a.revenue);

      const rawCoRev = depts.reduce((s, d) => s + (d._rawRev !== undefined ? d._rawRev : d.revenue), 0);
      const rawCoExp = depts.reduce((s, d) => s + (d._rawExp !== undefined ? d._rawExp : d.expenses), 0);
      const rawCoBilled = depts.reduce((s, d) => s + (d._rawBilled !== undefined ? d._rawBilled : d.billed), 0);
      const rawCoColl = depts.reduce((s, d) => s + (d._rawColl !== undefined ? d._rawColl : d.collected), 0);
      const rawCoRes = depts.reduce((s, d) => s + (d._rawRes !== undefined ? d._rawRes : d.residual), 0);

      const coSumRev = Math.round(rawCoRev);
      const coSumExp = Math.round(rawCoExp);
      const coSumNet = coSumRev - coSumExp;
      const coSumBilled = Math.round(rawCoBilled);
      const coSumColl = Math.round(rawCoColl);
      const coSumRes = Math.round(rawCoRes);
      const coMargin = coSumRev > 0 ? Math.round((coSumNet / coSumRev) * 1000) / 10 : 0;
      const coRate = coSumBilled > 0 ? Math.round((coSumColl / coSumBilled) * 1000) / 10 : 0;

      // Adjust depts within this company to match the company rounded total (diff <= 1 SAR)
      adjustListRounding(depts, 'revenue', coSumRev);
      adjustListRounding(depts, 'expenses', coSumExp);
      adjustListRounding(depts, 'billed', coSumBilled);
      adjustListRounding(depts, 'collected', coSumColl);
      adjustListRounding(depts, 'residual', coSumRes);

      companies.push({
        id: `co_${cid}`,
        company_id: cid,
        name: coName,
        revenue: coSumRev,
        expenses: coSumExp,
        net_profit: coSumNet,
        margin: coMargin,
        billed: coSumBilled,
        collected: coSumColl,
        collection_rate: coRate,
        residual: coSumRes,
        children: depts
      });
    }

    companies.sort((a, b) => b.revenue - a.revenue);

    const raw_totals = {
      revenue: companies.reduce((s, c) => s + c.revenue, 0),
      expenses: companies.reduce((s, c) => s + c.expenses, 0),
      net_profit: companies.reduce((s, c) => s + c.net_profit, 0),
      billed: companies.reduce((s, c) => s + c.billed, 0),
      collected: companies.reduce((s, c) => s + c.collected, 0),
      residual: companies.reduce((s, c) => s + c.residual, 0)
    };

    // Align company hierarchy to exact target totals (from getIncomeStatement and getReceivables)
    adjustListRounding(companies, 'revenue', revenue, true);
    adjustListRounding(companies, 'expenses', expenses, true);
    adjustListRounding(companies, 'billed', billed_period_untaxed, true);
    adjustListRounding(companies, 'collected', collected_period_untaxed, true);
    adjustListRounding(companies, 'residual', residual_period, true);

    const totRev = companies.reduce((s, c) => s + c.revenue, 0);
    const totExp = companies.reduce((s, c) => s + c.expenses, 0);
    const totNet = totRev - totExp;
    const totBilled = companies.reduce((s, c) => s + c.billed, 0);
    const totColl = companies.reduce((s, c) => s + c.collected, 0);
    const totRes = companies.reduce((s, c) => s + c.residual, 0);
    const totMargin = totRev > 0 ? Math.round((totNet / totRev) * 1000) / 10 : 0;
    const totRate = totBilled > 0 ? Math.round((totColl / totBilled) * 1000) / 10 : 0;

    const totals = {
      revenue: totRev,
      expenses: totExp,
      net_profit: totNet,
      margin: totMargin,
      billed: totBilled,
      collected: totColl,
      collection_rate: totRate,
      residual: totRes
    };

    // Cards reflect unified group totals exactly
    cards.revenue = totRev;
    cards.expenses = totExp;
    cards.net_profit = totNet;
    cards.profit_margin = totMargin;
    cards.billed_period_untaxed = totBilled;
    cards.collected_period_untaxed = totColl;
    cards.collection_rate_untaxed = totRate;
    cards.residual_period = totRes;

    // 6. Aging Section
    let aging = { tree: [], totals: {}, loaded: false };
    if (includeAging) {
      aging = this.getReceivables({
        type: 'aging',
        companyIds: targetLedgerIds,
        years: period.yearsList,
        dateFrom: period.dateFrom,
        dateTo: period.dateTo,
        asOfDate: refDate,
        includePaid: false
      });
      aging.loaded = true;
    }

    return {
      meta: {
        period_label: period.label,
        years: period.yearsList,
        is_multi_year: isMultiYear,
        refDate: period.refDate
      },
      cards,
      monthly_series,
      tree: {
        rows: companies,
        totals,
        raw_totals
      },
      aging: {
        tree: aging.tree || [],
        totals: aging.totals || {},
        loaded: !!aging.loaded
      }
    };
  }

  /**
   * Lazy-fetch department children (clients and/or accounts)
   */
  getExecutiveDepartmentChildren({ companyId, departmentId, kind = 'both', years, year, dateFrom, dateTo }) {
    const period = this._periodFilter({ years, year, dateFrom, dateTo, defaultToCurrentYear: true }, 'si.date', 'dept_');
    const cid = Number(companyId);
    const did = Number(departmentId);

    // Map company to sales company
    const coRow = this.db.prepare(`
      SELECT c.id as ledger_cid, sc.id as sales_cid
      FROM companies c
      JOIN sales_companies sc ON sc.sales_company_id = c.odoo_company_id
      WHERE c.id = ?
    `).get(cid);
    const salesCid = coRow?.sales_cid;

    let clients = [];
    if ((kind === 'clients' || kind === 'both') && salesCid) {
      let invWhere = `WHERE si.company_id = @salesCid AND id.department_id = @did`;
      const invParams = { salesCid, did };
      if (period.sql !== '1=1') {
        invWhere += ` AND ${period.sql}`;
        Object.assign(invParams, period.params);
      }

      const rawClients = this.db.prepare(`
        SELECT 
          si.partner_id,
          COALESCE(NULLIF(TRIM(si.partner_name), ''), 'بدون عميل') as partner_name,
          SUM(si.amount_untaxed * id.share) as raw_billed,
          SUM(CASE WHEN si.amount_total != 0 
                   THEN (si.amount_untaxed * ((si.amount_total - si.amount_residual_signed) / si.amount_total)) * id.share 
                   ELSE 0 END) as raw_collected,
          SUM(si.amount_residual_signed * id.share) as raw_residual,
          COUNT(DISTINCT si.id) as invoice_count
        FROM sales_invoices si
        JOIN invoice_departments id ON id.sales_invoice_id = si.id
        ${invWhere}
        GROUP BY si.partner_id, partner_name
        ORDER BY raw_billed DESC
      `).all(invParams);

      clients = rawClients.map(c => {
        const billed = Math.round(c.raw_billed || 0);
        const collected = Math.round(c.raw_collected || 0);
        const residual = Math.round(c.raw_residual || 0);
        const rate = billed > 0 ? Math.round((collected / billed) * 1000) / 10 : 0;
        return {
          id: `client_${cid}_${did}_${c.partner_id || c.partner_name}`,
          company_id: cid,
          department_id: did,
          partner_id: c.partner_id,
          name: c.partner_name,
          billed,
          collected,
          residual,
          collection_rate: rate,
          invoice_count: c.invoice_count,
          revenue: null,
          expenses: null,
          net_profit: null,
          margin: null
        };
      });
    }

    let accounts = [];
    if (kind === 'accounts' || kind === 'both') {
      let fdWhere = `WHERE fd.company_id = @cid AND fd.department_id = @did`;
      const fdParams = { cid, did };
      if (period.sql !== '1=1') {
        const fdPeriod = this._periodFilter({ years: period.yearsList, dateFrom: period.dateFrom, dateTo: period.dateTo }, 'fd.date', 'fd_');
        if (fdPeriod.sql !== '1=1') {
          fdWhere += ` AND ${fdPeriod.sql}`;
          Object.assign(fdParams, fdPeriod.params);
        }
      }

      const rawAccounts = this.db.prepare(`
        SELECT 
          fd.account_code,
          COALESCE(ca.name, fd.account_code) as account_name,
          SUM(fd.revenue) as revenue,
          SUM(fd.expense) as expense
        FROM fact_daily fd
        LEFT JOIN company_accounts ca ON ca.company_id = fd.company_id AND ca.code = fd.account_code
        ${fdWhere}
        GROUP BY fd.account_code
        HAVING (SUM(fd.revenue) != 0 OR SUM(fd.expense) != 0)
        ORDER BY revenue DESC, expense DESC
      `).all(fdParams);

      accounts = rawAccounts.map(a => {
        const rev = Math.round(a.revenue || 0);
        const exp = Math.round(a.expense || 0);
        const net = rev - exp;
        const margin = rev > 0 ? Math.round((net / rev) * 1000) / 10 : 0;
        return {
          id: `acc_${cid}_${did}_${a.account_code}`,
          account_code: a.account_code,
          name: a.account_name,
          revenue: rev,
          expenses: exp,
          net_profit: net,
          margin,
          billed: null,
          collected: null,
          residual: null,
          collection_rate: null
        };
      });
    }

    return { clients, accounts };
  }

  /**
   * Lazy-fetch client invoices for slide-over drawer (filters by department when provided)
   */
  getExecutiveClientInvoices({ companyId, partnerId, departmentId, years, year, dateFrom, dateTo, asOfDate }) {
    const period = this._periodFilter({ years, year, dateFrom, dateTo, asOfDate, defaultToCurrentYear: true }, 'si.date', 'cinv_');
    const refDate = period.refDate;
    const cid = Number(companyId);
    const did = departmentId !== undefined && departmentId !== 'null' && departmentId !== '' ? Number(departmentId) : null;
    const pid = partnerId !== undefined && partnerId !== 'null' && partnerId !== '' ? Number(partnerId) : null;

    const coRow = this.db.prepare(`
      SELECT c.id as ledger_cid, sc.id as sales_cid
      FROM companies c
      JOIN sales_companies sc ON sc.sales_company_id = c.odoo_company_id
      WHERE c.id = ?
    `).get(cid);
    const salesCid = coRow?.sales_cid;

    let invWhere = `WHERE si.company_id = @salesCid`;
    const invParams = { salesCid, refDate };
    if (pid !== null && !isNaN(pid)) {
      invWhere += ' AND si.partner_id = @pid';
      invParams.pid = pid;
    }
    if (did !== null && !isNaN(did)) {
      invWhere += ' AND id.department_id = @did';
      invParams.did = did;
    }
    if (period.sql !== '1=1') {
      invWhere += ` AND ${period.sql}`;
      Object.assign(invParams, period.params);
    }

    const joinClause = (did !== null && !isNaN(did))
      ? 'JOIN invoice_departments id ON id.sales_invoice_id = si.id'
      : '';

    const rows = this.db.prepare(`
      SELECT DISTINCT
        si.id,
        si.name as invoice_name,
        si.partner_id,
        COALESCE(NULLIF(TRIM(si.partner_name), ''), 'بدون عميل') as partner_name,
        si.amount_untaxed,
        si.amount_total,
        si.amount_residual_signed,
        si.date as invoice_date,
        COALESCE(NULLIF(si.invoice_date_due, ''), si.date) as due_date,
        si.payment_state,
        CAST(julianday(@refDate) - julianday(COALESCE(NULLIF(si.invoice_date_due, ''), si.date)) AS INTEGER) as age_days
      FROM sales_invoices si
      ${joinClause}
      ${invWhere}
      ORDER BY si.date DESC
    `).all(invParams);

    const partnerName = rows[0]?.partner_name || 'عميل';
    return {
      company_id: cid,
      department_id: did,
      partner_id: pid,
      partner_name: partnerName,
      invoices: rows
    };
  }

  /**
   * Lazy-fetch full aging hierarchy
   */
  getExecutiveAging({ companyIds, years, year, dateFrom, dateTo, asOfDate, includeInvoices = false }) {
    const period = this._periodFilter({ years, year, dateFrom, dateTo, asOfDate, defaultToCurrentYear: true }, 'si.date', 'aging_');
    const refDate = period.refDate;

    let targetLedgerIds;
    if (companyIds) {
      targetLedgerIds = (Array.isArray(companyIds) ? companyIds : String(companyIds).split(',')).map(Number).filter(Boolean);
    } else {
      targetLedgerIds = this.db.prepare('SELECT id FROM companies WHERE is_active = 1 ORDER BY id').all().map(r => r.id);
    }
    if (targetLedgerIds.length === 0) targetLedgerIds = [-1];

    const aging = this.getReceivables({
      type: 'aging',
      companyIds: targetLedgerIds,
      years: period.yearsList,
      dateFrom: period.dateFrom,
      dateTo: period.dateTo,
      asOfDate: refDate,
      includePaid: false
    });

    let tree = aging.tree || [];
    if (!includeInvoices) {
      tree = tree.map(co => ({
        ...co,
        departments: (co.departments || []).map(dept => ({
          ...dept,
          partners: (dept.partners || []).map(p => {
            const { invoices, ...rest } = p;
            return rest;
          })
        }))
      }));
    }

    return {
      tree,
      totals: aging.totals || {}
    };
  }

  /**
   * G1: Get active bank guarantees automatically derived from the general ledger
   * Rules:
   * 1. Credit lines are releases, never displayed as guarantees.
   * 2. Auto matching: each credit matches the oldest unmatched debit of exact same amount (diff < 0.01) with date <= credit.date.
   * 3. Opening balance entries with guarantee_sub_items: only unreleased sub-items (is_released = 0) are displayed.
   * 4. Manual overrides (guarantee_releases) remain in effect as additional exceptions.
   */
  getActiveGuarantees({ companyIds, asOfDate } = {}) {
    const today = asOfDate || new Date().toISOString().slice(0, 10);
    let ids;
    if (companyIds) {
      ids = (Array.isArray(companyIds) ? companyIds : String(companyIds).split(',')).map(Number).filter(Boolean);
    } else {
      ids = this.db.prepare('SELECT id FROM companies ORDER BY id').all().map(c => c.id);
    }

    const results = [];

    for (const cid of ids) {
      const company = this.db.prepare('SELECT name FROM companies WHERE id = ?').get(cid);
      if (!company) continue;

      const tagRows = this.db.prepare(`
        SELECT account_code FROM account_tags 
        WHERE company_id = ? AND tag = 'guarantee'
        ORDER BY account_code
      `).all(cid);

      if (!tagRows.length) continue;

      const companyActiveItems = [];
      const companyReleasedItems = [];
      const accountsSummary = [];

      for (const { account_code } of tagRows) {
        // 1. Ledger items up to asOfDate
        const items = this.db.prepare(`
          SELECT ji.id, ji.company_id, ji.account_code, ji.account_name, ji.move_name, ji.date, 
                 ji.debit, ji.credit, (ji.debit - ji.credit) as balance, ji.label, ji.partner_name
          FROM journal_items ji
          WHERE ji.company_id = ? AND ji.account_code = ? AND ji.move_state = 'posted' AND ji.date <= ?
          ORDER BY ji.date ASC, ji.id ASC
        `).all(cid, account_code, today);

        const ledgerDebits = items.reduce((s, x) => s + x.debit, 0);
        const ledgerCredits = items.reduce((s, x) => s + x.credit, 0);
        const ledgerBalance = Math.round((ledgerDebits - ledgerCredits) * 100) / 100;

        // Manual releases / overrides
        const manualReleases = this.db.prepare(`
          SELECT move_name, released_date, notes 
          FROM guarantee_releases 
          WHERE company_id = ? AND account_code = ?
        `).all(cid, account_code);
        const manualReleaseMap = new Map();
        manualReleases.forEach(r => manualReleaseMap.set(r.move_name, r));

        // Sub-items
        const subItems = this.db.prepare(`
          SELECT * FROM guarantee_sub_items 
          WHERE parent_company_id = ? AND parent_account_code = ?
          ORDER BY created_at ASC
        `).all(cid, account_code);

        const parentMovesWithSubs = new Set(subItems.map(s => s.parent_move_name));

        const debits = [];
        const credits = [];

        for (const item of items) {
          if (item.debit > 0) {
            debits.push({ ...item, matched: false });
          } else if (item.credit > 0) {
            credits.push({ ...item, matched: false });
          }
        }

        // Automatic matching against direct debits
        for (const credit of credits) {
          for (const debit of debits) {
            if (!debit.matched && !parentMovesWithSubs.has(debit.move_name)) {
              if (Math.abs(debit.debit - credit.credit) < 0.01 && debit.date <= credit.date) {
                debit.matched = true;
                debit.matchedBy = credit;
                credit.matched = true;
                credit.matchedTo = debit;
                break;
              }
            }
          }
        }

        // Secondary matching: match remaining credits against released sub-items
        const releasedSubs = subItems.filter(s => s.is_released).map(s => ({ ...s, remaining: s.amount }));

        // Pass 1: Exact matches first (credit amount == remaining)
        for (const credit of credits) {
          if (credit.matched) continue;
          for (const rSub of releasedSubs) {
            if (rSub.remaining > 0 && Math.abs(rSub.remaining - credit.credit) < 0.01) {
              credit.matched = true;
              credit.matchedSub = rSub;
              rSub.remaining = 0;
              break;
            }
          }
        }

        // Pass 2: Multiple credits matching one released sub-item (e.g. 3 x 20,000 = 60,000)
        for (const credit of credits) {
          if (credit.matched) continue;
          for (const rSub of releasedSubs) {
            if (rSub.remaining > 0 && rSub.remaining >= credit.credit - 0.01) {
              credit.matched = true;
              credit.matchedSub = rSub;
              rSub.remaining = Math.round((rSub.remaining - credit.credit) * 100) / 100;
              break;
            }
          }
        }

        // Collect active items
        const activeForAccount = [];

        // A) Active sub-items for opening parent entries
        for (const parentMove of parentMovesWithSubs) {
          const parentItem = items.find(x => x.move_name === parentMove && x.debit > 0);
          const subs = subItems.filter(s => s.parent_move_name === parentMove && !s.is_released);
          for (const s of subs) {
            activeForAccount.push({
              id: `sub_${s.id}`,
              subItemId: s.id,
              companyId: cid,
              accountCode: account_code,
              accountName: parentItem?.account_name || account_code,
              account: parentItem?.account_name || account_code,
              moveName: parentMove,
              date: parentItem?.date || today,
              description: s.description,
              amount: s.amount,
              partner: parentItem?.partner_name || '',
              type: 'sub',
              isReleased: false,
              releaseNotes: s.notes || ''
            });
          }
        }

        // B) Active direct debits (not parent with subs, not matched by credit, not in manual releases)
        for (const debit of debits) {
          if (parentMovesWithSubs.has(debit.move_name)) continue;
          if (debit.matched) continue;
          if (manualReleaseMap.has(debit.move_name)) continue;

          activeForAccount.push({
            id: `item_${debit.id}`,
            itemId: debit.id,
            companyId: cid,
            accountCode: account_code,
            accountName: debit.account_name,
            account: debit.account_name,
            moveName: debit.move_name,
            date: debit.date,
            description: debit.label || debit.account_name,
            amount: debit.debit,
            partner: debit.partner_name || '',
            type: 'item',
            isReleased: false,
            releaseNotes: ''
          });
        }

        // C) Released debits and sub-items (for admin management visibility)
        const releasedForAccount = [];
        for (const debit of debits) {
          if (parentMovesWithSubs.has(debit.move_name)) continue;
          if (manualReleaseMap.has(debit.move_name)) {
            const rel = manualReleaseMap.get(debit.move_name);
            releasedForAccount.push({
              id: `manual_rel_${debit.id}`,
              itemId: debit.id,
              companyId: cid,
              accountCode: account_code,
              accountName: debit.account_name,
              moveName: debit.move_name,
              date: debit.date,
              description: debit.label || debit.account_name,
              amount: debit.debit,
              partner: debit.partner_name || '',
              type: 'item',
              isReleased: true,
              matchType: 'manual',
              releaseNotes: rel.notes || 'استثناء يدوي',
              releasedDate: rel.released_date
            });
          } else if (debit.matched) {
            releasedForAccount.push({
              id: `auto_rel_${debit.id}`,
              itemId: debit.id,
              companyId: cid,
              accountCode: account_code,
              accountName: debit.account_name,
              moveName: debit.move_name,
              date: debit.date,
              description: debit.label || debit.account_name,
              amount: debit.debit,
              partner: debit.partner_name || '',
              type: 'item',
              isReleased: true,
              matchType: 'auto',
              releaseNotes: `مفرج تلقائياً: مطابق مع ${debit.matchedBy?.move_name || ''}`,
              releasedDate: debit.matchedBy?.date
            });
          }
        }
        for (const s of subItems.filter(x => x.is_released)) {
          const parentItem = items.find(x => x.move_name === s.parent_move_name && x.debit > 0);
          releasedForAccount.push({
            id: `sub_rel_${s.id}`,
            subItemId: s.id,
            companyId: cid,
            accountCode: account_code,
            accountName: parentItem?.account_name || account_code,
            moveName: s.parent_move_name,
            date: parentItem?.date || today,
            description: s.description,
            amount: s.amount,
            partner: parentItem?.partner_name || '',
            type: 'sub',
            isReleased: true,
            matchType: 'sub',
            releaseNotes: s.notes || '',
            releasedDate: s.released_date
          });
        }

        // Sort active items by date
        activeForAccount.sort((a, b) => a.date.localeCompare(b.date));

        const activeTotal = Math.round(activeForAccount.reduce((s, x) => s + x.amount, 0) * 100) / 100;
        const diff = Math.round((activeTotal - ledgerBalance) * 100) / 100;
        const unmatchedCredits = credits.filter(c => !c.matched);

        accountsSummary.push({
          accountCode: account_code,
          account_code: account_code,
          accountName: items[0]?.account_name || account_code,
          account_name: items[0]?.account_name || account_code,
          total_debit: ledgerDebits,
          total_credit: ledgerCredits,
          balance: activeTotal,
          ledgerBalance,
          activeTotal,
          diff,
          activeCount: activeForAccount.length,
          unmatchedCredits: unmatchedCredits.map(c => ({
            id: c.id,
            moveName: c.move_name,
            date: c.date,
            amount: c.credit,
            label: c.label || ''
          }))
        });

        companyActiveItems.push(...activeForAccount);
        companyReleasedItems.push(...releasedForAccount);
      }

      const companyLedgerBalance = Math.round(accountsSummary.reduce((s, a) => s + a.ledgerBalance, 0) * 100) / 100;
      const companyActiveTotal = Math.round(companyActiveItems.reduce((s, a) => s + a.amount, 0) * 100) / 100;
      const companyDiff = Math.round((companyActiveTotal - companyLedgerBalance) * 100) / 100;
      const allUnmatchedCredits = accountsSummary.flatMap(a => a.unmatchedCredits);

      const pendingReleases = companyReleasedItems.filter(r => r.matchType === 'manual');
      const pendingAmount = Math.round(pendingReleases.reduce((s, r) => s + (r.amount || 0), 0) * 100) / 100;
      const isPendingOdoo = Math.abs(companyDiff) > 0.05 && Math.abs(Math.abs(companyDiff) - pendingAmount) <= 0.05;

      results.push({
        companyId: cid,
        companyName: company.name,
        items: companyActiveItems,
        releasedItems: companyReleasedItems,
        accounts: accountsSummary,
        accountsSummary,
        totalAmount: companyActiveTotal,
        ledgerBalance: companyLedgerBalance,
        diff: companyDiff,
        unmatchedCredits: allUnmatchedCredits,
        pendingAmount,
        pendingReleases,
        isPendingOdoo,
        date: today
      });
    }

    return results;
  }

  /**
   * G1: Get guarantee entries for admin management
   * Only returns debits (issuances). Never returns credit entries as guarantee lines.
   * Includes release status, match type ('auto'|'manual'|'breakdown'), and notes.
   */
  getGuaranteesAdminList({ companyIds, asOfDate } = {}) {
    const today = asOfDate || new Date().toISOString().slice(0, 10);
    let ids;
    if (companyIds) {
      ids = (Array.isArray(companyIds) ? companyIds : String(companyIds).split(',')).map(Number).filter(Boolean);
    } else {
      ids = this.db.prepare('SELECT id FROM companies ORDER BY id').all().map(c => c.id);
    }

    const results = [];

    for (const cid of ids) {
      const company = this.db.prepare('SELECT name FROM companies WHERE id = ?').get(cid);
      if (!company) continue;

      const tagRows = this.db.prepare(`
        SELECT account_code FROM account_tags 
        WHERE company_id = ? AND tag = 'guarantee'
        ORDER BY account_code
      `).all(cid);

      if (!tagRows.length) continue;

      const items = [];
      let totalDebits = 0;
      let totalCredits = 0;

      for (const { account_code } of tagRows) {
        const allRows = this.db.prepare(`
          SELECT ji.id, ji.company_id, ji.account_code, ji.account_name, ji.move_name, ji.date,
                 ji.debit, ji.credit, (ji.debit - ji.credit) as balance, ji.label, ji.partner_name
          FROM journal_items ji
          WHERE ji.company_id = ? AND ji.account_code = ? AND ji.move_state = 'posted' AND ji.date <= ?
          ORDER BY ji.date ASC, ji.id ASC
        `).all(cid, account_code, today);

        allRows.forEach(r => {
          totalDebits += r.debit;
          totalCredits += r.credit;
        });

        const manualReleases = this.db.prepare(`
          SELECT move_name, released_date, notes 
          FROM guarantee_releases 
          WHERE company_id = ? AND account_code = ?
        `).all(cid, account_code);
        const manualReleaseMap = new Map();
        manualReleases.forEach(r => manualReleaseMap.set(r.move_name, r));

        const subItems = this.db.prepare(`
          SELECT * FROM guarantee_sub_items 
          WHERE parent_company_id = ? AND parent_account_code = ?
          ORDER BY created_at ASC
        `).all(cid, account_code);
        const parentMovesWithSubs = new Set(subItems.map(s => s.parent_move_name));

        const debits = [];
        const credits = [];
        for (const r of allRows) {
          if (r.debit > 0) debits.push({ ...r, matched: false });
          else if (r.credit > 0) credits.push({ ...r, matched: false });
        }

        // Auto-match credits against debits
        for (const credit of credits) {
          for (const debit of debits) {
            if (!debit.matched && !parentMovesWithSubs.has(debit.move_name)) {
              if (Math.abs(debit.debit - credit.credit) < 0.01 && debit.date <= credit.date) {
                debit.matched = true;
                debit.matchedBy = credit;
                credit.matched = true;
                break;
              }
            }
          }
        }

        // Build admin item rows (Debits ONLY, no credits!)
        for (const debit of debits) {
          const manualRel = manualReleaseMap.get(debit.move_name);
          let isReleased = 0;
          let releasedDate = null;
          let releaseNotes = '';
          let matchType = null;

          if (parentMovesWithSubs.has(debit.move_name)) {
            const subs = subItems.filter(s => s.parent_move_name === debit.move_name);
            const allSubsReleased = subs.length > 0 && subs.every(s => s.is_released);
            isReleased = allSubsReleased ? 1 : 0;
            matchType = 'breakdown';
          } else if (debit.matched) {
            isReleased = 1;
            releasedDate = debit.matchedBy?.date || null;
            releaseNotes = `إفراج تلقائي: مطابق مع ${debit.matchedBy?.move_name || ''}`;
            matchType = 'auto';
          } else if (manualRel) {
            isReleased = 1;
            releasedDate = manualRel.released_date;
            releaseNotes = manualRel.notes || 'تعليم يدوي';
            matchType = 'manual';
          }

          items.push({
            id: debit.id,
            companyId: cid,
            account_code: debit.account_code,
            account_name: debit.account_name,
            move_name: debit.move_name,
            date: debit.date,
            label: debit.label,
            partner_name: debit.partner_name,
            debit: debit.debit,
            credit: 0,
            balance: debit.debit,
            amount: debit.debit,
            is_released: isReleased,
            released_date: releasedDate,
            release_notes: releaseNotes,
            match_type: matchType
          });
        }
      }

      // Sort items descending by date for admin view
      items.sort((a, b) => b.date.localeCompare(a.date));

      const ledgerBalance = Math.round((totalDebits - totalCredits) * 100) / 100;

      if (items.length) {
        results.push({
          companyId: cid,
          companyName: company.name,
          ledgerBalance,
          items
        });
      }
    }

    return results;
  }

  /**
   * D1 — Customers & Collection (العملاء والتحصيل)
   * Single source: sales_invoices + invoice_departments
   * Hierarchy: Company -> Department -> Customer -> Invoice
   * Columns: Billed | Returns | Net | Collected | Remaining | % Rate | Aging Days
   */
  getCustomersCollection({ companyIds, years, year, dateFrom, dateTo, asOfDate, includeInvoices = false }) {
    const period = this._periodFilter({ years, year, dateFrom, dateTo, asOfDate, defaultToCurrentYear: true }, 'si.date', 'cc_');
    const refDate = period.refDate;

    const round = (n) => Math.round((n || 0) * 100) / 100;
    const bucketOf = (days) => {
      if (days <= 0) return 'not_due';
      if (days <= 30) return 'b1_30';
      if (days <= 60) return 'b31_60';
      if (days <= 90) return 'b61_90';
      if (days <= 180) return 'b91_180';
      if (days <= 365) return 'b181_365';
      return 'over_365';
    };

    const coRows = this.db.prepare(`
      SELECT c.id as ledger_cid, c.name as ledger_name, sc.id as sales_cid, sc.name as sales_name
      FROM companies c
      JOIN sales_companies sc ON sc.sales_company_id = c.odoo_company_id
      WHERE c.is_active = 1
      ORDER BY c.id
    `).all();

    const ledgerToSales = new Map();
    const salesToLedger = new Map();
    for (const r of coRows) {
      ledgerToSales.set(r.ledger_cid, r.sales_cid);
      salesToLedger.set(r.sales_cid, r);
    }

    let targetSalesIds = coRows.map(r => r.sales_cid);
    if (companyIds && companyIds.length > 0) {
      const arr = Array.isArray(companyIds) ? companyIds.map(Number) : String(companyIds).split(',').map(Number);
      targetSalesIds = [];
      for (const id of arr) {
        if (ledgerToSales.has(id)) targetSalesIds.push(ledgerToSales.get(id));
        else if (salesToLedger.has(id)) targetSalesIds.push(id);
      }
      if (targetSalesIds.length === 0) targetSalesIds = [-1];
    }

    let invWhere = `WHERE si.company_id IN (${targetSalesIds.join(',')})`;
    const invParams = { refDate };
    if (period.sql !== '1=1') {
      invWhere += ` AND ${period.sql}`;
      Object.assign(invParams, period.params);
    }

    const rows = this.db.prepare(`
      SELECT 
        c.id as ledger_cid,
        c.name as ledger_name,
        id.department_id,
        COALESCE(NULLIF(TRIM(ag.name), ''), 'غير مصنف') as department_name,
        si.partner_id,
        COALESCE(NULLIF(TRIM(si.partner_name), ''), 'بدون عميل') as partner_name,
        si.id as invoice_id,
        si.name as invoice_name,
        si.date as invoice_date,
        COALESCE(NULLIF(si.invoice_date_due, ''), si.date) as due_date,
        si.amount_untaxed,
        si.amount_total,
        si.amount_residual_signed,
        si.payment_state,
        id.share,
        CAST(julianday(@refDate) - julianday(COALESCE(NULLIF(si.invoice_date_due, ''), si.date)) AS INTEGER) as age_days
      FROM sales_invoices si
      JOIN sales_companies sc ON sc.id = si.company_id
      JOIN companies c ON c.odoo_company_id = sc.sales_company_id
      JOIN invoice_departments id ON id.sales_invoice_id = si.id
      LEFT JOIN analytic_groups ag ON ag.id = id.department_id
      ${invWhere}
      ORDER BY c.id, department_name, partner_name, si.date DESC
    `).all(invParams);

    const coMap = new Map();
    const returnsList = [];

    for (const r of rows) {
      const share = r.share || 1;
      const tot = (r.amount_total || 0) * share;
      const res = (r.amount_residual_signed || 0) * share;
      const isRet = r.amount_total < 0;
      const billedVal = isRet ? 0 : tot;
      const returnVal = isRet ? Math.abs(tot) : 0;
      const netVal = tot;
      const residualVal = res;
      const collectedVal = netVal - residualVal;
      const ageDays = r.age_days || 0;
      const bKey = bucketOf(ageDays);

      if (isRet) {
        returnsList.push({
          id: r.invoice_id,
          invoice_name: r.invoice_name,
          date: r.invoice_date,
          due_date: r.due_date,
          company_id: r.ledger_cid,
          company_name: r.ledger_name,
          department_id: r.department_id,
          department_name: r.department_name,
          partner_id: r.partner_id,
          partner_name: r.partner_name,
          amount_untaxed: Math.abs((r.amount_untaxed || 0) * share),
          amount_total: Math.abs(tot),
          residual: Math.abs(res),
          payment_state: r.payment_state
        });
      }

      if (!coMap.has(r.ledger_cid)) {
        coMap.set(r.ledger_cid, {
          id: r.ledger_cid,
          name: r.ledger_name,
          type: 'co',
          billed: 0,
          returns: 0,
          net: 0,
          collected: 0,
          residual: 0,
          overdue_90: 0,
          weighted_age_sum: 0,
          buckets: { not_due: 0, b1_30: 0, b31_60: 0, b61_90: 0, b91_180: 0, b181_365: 0, over_365: 0 },
          departmentsMap: new Map()
        });
      }
      const co = coMap.get(r.ledger_cid);
      co.billed += billedVal;
      co.returns += returnVal;
      co.net += netVal;
      co.residual += residualVal;
      co.collected += collectedVal;
      if (ageDays > 90 && residualVal > 0) co.overdue_90 += residualVal;
      if (residualVal > 0) co.weighted_age_sum += (ageDays * residualVal);
      co.buckets[bKey] += residualVal;

      co.inv_count = (co.inv_count || 0) + 1;
      const deptMap = co.departmentsMap;
      if (!deptMap.has(r.department_id)) {
        deptMap.set(r.department_id, {
          id: r.department_id,
          name: r.department_name,
          company_id: r.ledger_cid,
          type: 'dept',
          inv_count: 0,
          billed: 0,
          returns: 0,
          net: 0,
          collected: 0,
          residual: 0,
          overdue_90: 0,
          weighted_age_sum: 0,
          buckets: { not_due: 0, b1_30: 0, b31_60: 0, b61_90: 0, b91_180: 0, b181_365: 0, over_365: 0 },
          partnersMap: new Map()
        });
      }
      const dept = deptMap.get(r.department_id);
      dept.inv_count = (dept.inv_count || 0) + 1;
      dept.billed += billedVal;
      dept.returns += returnVal;
      dept.net += netVal;
      dept.residual += residualVal;
      dept.collected += collectedVal;
      if (ageDays > 90 && residualVal > 0) dept.overdue_90 += residualVal;
      if (residualVal > 0) dept.weighted_age_sum += (ageDays * residualVal);
      dept.buckets[bKey] += residualVal;

      const pMap = dept.partnersMap;
      const pid = r.partner_id || 0;
      if (!pMap.has(pid)) {
        pMap.set(pid, {
          id: pid,
          name: r.partner_name,
          partner_id: pid,
          company_id: r.ledger_cid,
          department_id: r.department_id,
          type: 'partner',
          _canLoad: true,
          inv_count: 0,
          billed: 0,
          returns: 0,
          net: 0,
          collected: 0,
          residual: 0,
          overdue_90: 0,
          weighted_age_sum: 0,
          buckets: { not_due: 0, b1_30: 0, b31_60: 0, b61_90: 0, b91_180: 0, b181_365: 0, over_365: 0 },
          invoices: []
        });
      }
      const partner = pMap.get(pid);
      partner.inv_count = (partner.inv_count || 0) + 1;
      partner.billed += billedVal;
      partner.returns += returnVal;
      partner.net += netVal;
      partner.residual += residualVal;
      partner.collected += collectedVal;
      if (ageDays > 90 && residualVal > 0) partner.overdue_90 += residualVal;
      if (residualVal > 0) partner.weighted_age_sum += (ageDays * residualVal);
      partner.buckets[bKey] += residualVal;

      if (includeInvoices) {
        partner.invoices.push({
          id: r.invoice_id,
          name: r.invoice_name,
          invoice_date: r.invoice_date,
          due_date: r.due_date,
          amount_untaxed: (r.amount_untaxed || 0) * share,
          amount_total: tot,
          amount_residual_signed: res,
          payment_state: r.payment_state,
          age_days: ageDays,
          isReturn: isRet,
          bucket: bKey
        });
      }
    }

    let grandBilled = 0, grandReturns = 0, grandNet = 0, grandCollected = 0, grandResidual = 0, grandOverdue90 = 0;
    const grandBuckets = { not_due: 0, b1_30: 0, b31_60: 0, b61_90: 0, b91_180: 0, b181_365: 0, over_365: 0 };

    const tree = [];
    for (const co of coMap.values()) {
      co.billed = round(co.billed);
      co.returns = round(co.returns);
      co.net = round(co.net);
      co.residual = round(co.residual);
      co.collected = round(co.collected);
      co.overdue_90 = round(co.overdue_90);
      co.collection_rate = co.net > 0 ? round((co.collected / co.net) * 100) : 0;
      co.avg_age = co.residual > 0 ? Math.round(co.weighted_age_sum / co.residual) : 0;

      grandBilled += co.billed;
      grandReturns += co.returns;
      grandNet += co.net;
      grandCollected += co.collected;
      grandResidual += co.residual;
      grandOverdue90 += co.overdue_90;
      for (const k of Object.keys(grandBuckets)) {
        co.buckets[k] = round(co.buckets[k]);
        grandBuckets[k] += co.buckets[k];
      }

      const departments = [];
      for (const dept of co.departmentsMap.values()) {
        dept.billed = round(dept.billed);
        dept.returns = round(dept.returns);
        dept.net = round(dept.net);
        dept.residual = round(dept.residual);
        dept.collected = round(dept.collected);
        dept.overdue_90 = round(dept.overdue_90);
        dept.collection_rate = dept.net > 0 ? round((dept.collected / dept.net) * 100) : 0;
        dept.avg_age = dept.residual > 0 ? Math.round(dept.weighted_age_sum / dept.residual) : 0;
        for (const k of Object.keys(dept.buckets)) {
          dept.buckets[k] = round(dept.buckets[k]);
        }

        const partners = [];
        for (const p of dept.partnersMap.values()) {
          p.billed = round(p.billed);
          p.returns = round(p.returns);
          p.net = round(p.net);
          p.residual = round(p.residual);
          p.collected = round(p.collected);
          p.overdue_90 = round(p.overdue_90);
          p.collection_rate = p.net > 0 ? round((p.collected / p.net) * 100) : 0;
          p.avg_age = p.residual > 0 ? Math.round(p.weighted_age_sum / p.residual) : 0;
          for (const k of Object.keys(p.buckets)) {
            p.buckets[k] = round(p.buckets[k]);
          }
          delete p.weighted_age_sum;
          partners.push(p);
        }
        delete dept.partnersMap;
        delete dept.weighted_age_sum;
        dept.partners = partners;
        departments.push(dept);
      }
      delete co.departmentsMap;
      delete co.weighted_age_sum;
      co.departments = departments;
      tree.push(co);
    }

    const totals = {
      inv_count: rows.length,
      total_billed: round(grandBilled),
      total_returns: round(grandReturns),
      total_net: round(grandNet),
      total_collected: round(grandCollected),
      total_residual: round(grandResidual),
      overdue_90: round(grandOverdue90),
      collection_rate: grandNet > 0 ? round((grandCollected / grandNet) * 100) : 0,
      buckets: Object.fromEntries(Object.entries(grandBuckets).map(([k, v]) => [k, round(v)]))
    };

    return {
      meta: {
        period_label: period.label,
        years: period.yearsList,
        refDate: period.refDate
      },
      totals,
      tree,
      returns_list: returnsList
    };
  }

  /**
   * D1 — Customer Account Statement (كشف حساب العميل)
   * Sequential transaction ledger with running balance
   */
  getCustomerStatement({ companyId, partnerId, departmentId, years, year, dateFrom, dateTo, asOfDate }) {
    const period = this._periodFilter({ years, year, dateFrom, dateTo, asOfDate, defaultToCurrentYear: true }, 'si.date', 'stmt_');
    const refDate = period.refDate;
    const cid = Number(companyId);
    const pid = Number(partnerId);
    const did = departmentId !== undefined && departmentId !== 'null' && departmentId !== '' ? Number(departmentId) : null;

    const coRow = this.db.prepare(`
      SELECT c.id as ledger_cid, c.name as ledger_name, sc.id as sales_cid, sc.name as sales_name
      FROM companies c
      JOIN sales_companies sc ON sc.sales_company_id = c.odoo_company_id
      WHERE c.id = ?
    `).get(cid);
    const salesCid = coRow?.sales_cid;

    let invWhere = `WHERE si.company_id = @salesCid AND si.partner_id = @pid`;
    const invParams = { salesCid, pid, refDate };
    if (did !== null && !isNaN(did)) {
      invWhere += ` AND id.department_id = @did`;
      invParams.did = did;
    }
    if (period.sql !== '1=1') {
      invWhere += ` AND ${period.sql}`;
      Object.assign(invParams, period.params);
    }

    const joinClause = (did !== null && !isNaN(did))
      ? 'JOIN invoice_departments id ON id.sales_invoice_id = si.id'
      : '';

    const rows = this.db.prepare(`
      SELECT DISTINCT
        si.id,
        si.name as doc_number,
        si.date as doc_date,
        COALESCE(NULLIF(si.invoice_date_due, ''), si.date) as due_date,
        si.partner_id,
        COALESCE(NULLIF(TRIM(si.partner_name), ''), 'بدون عميل') as partner_name,
        si.amount_untaxed,
        si.amount_total,
        si.amount_residual_signed,
        si.payment_state,
        CAST(julianday(@refDate) - julianday(COALESCE(NULLIF(si.invoice_date_due, ''), si.date)) AS INTEGER) as age_days
      FROM sales_invoices si
      ${joinClause}
      ${invWhere}
      ORDER BY si.date ASC, si.id ASC
    `).all(invParams);

    let runningBalance = 0;
    let totalBilled = 0;
    let totalReturns = 0;
    let totalPaid = 0;

    const items = rows.map(r => {
      const isReturn = r.amount_total < 0;
      const debit = isReturn ? 0 : r.amount_total;
      const credit = isReturn ? Math.abs(r.amount_total) : (r.amount_total - r.amount_residual_signed);
      const paid = isReturn ? 0 : (r.amount_total - r.amount_residual_signed);

      if (isReturn) {
        totalReturns += Math.abs(r.amount_total);
      } else {
        totalBilled += r.amount_total;
      }
      totalPaid += paid;
      runningBalance += r.amount_residual_signed;

      return {
        id: r.id,
        doc_number: r.doc_number,
        date: r.doc_date,
        due_date: r.due_date,
        type: isReturn ? 'return' : 'invoice',
        type_label: isReturn ? 'إشعار دائن (مرتجع)' : 'فاتورة مبيعات',
        debit: Math.round(debit * 100) / 100,
        credit: Math.round(credit * 100) / 100,
        paid: Math.round(paid * 100) / 100,
        residual: Math.round(r.amount_residual_signed * 100) / 100,
        running_balance: Math.round(runningBalance * 100) / 100,
        payment_state: r.payment_state,
        age_days: r.age_days
      };
    });

    return {
      partner: {
        id: pid,
        name: rows[0]?.partner_name || 'العميل'
      },
      company: {
        id: cid,
        name: coRow?.ledger_name || `شركة ${cid}`
      },
      period_label: period.label,
      summary: {
        total_billed: Math.round(totalBilled * 100) / 100,
        total_returns: Math.round(totalReturns * 100) / 100,
        net_billed: Math.round((totalBilled - totalReturns) * 100) / 100,
        total_paid: Math.round(totalPaid * 100) / 100,
        total_residual: Math.round(runningBalance * 100) / 100,
        doc_count: rows.length,
        invoices_count: rows.filter(r => r.amount_total >= 0).length,
        returns_count: rows.filter(r => r.amount_total < 0).length
      },
      items
    };
  }

  /**
   * Helper: query expenses with admin cost redistribution
   * Used by External API & Departments Profitability
   */
  getAdminExpenseRedistribution({ companyId, dateFrom, dateTo, includeMonthly, ccFilter }) {
    const cid = Number(companyId);
    const company = this.db.prepare('SELECT id, name FROM companies WHERE id = ?').get(cid);
    if (!company) return [];

    const p = { companyId: cid, dateFrom, dateTo };

    // 1. Load group mappings and redistributable flags
    const groupMap = {};
    const redistSet = new Set();
    const mappings = this.db.prepare(`
      SELECT m.analytic_account, m.redistributable, g.id as group_id, g.name as group_name
      FROM analytic_group_mapping m
      JOIN analytic_groups g ON g.id = m.group_id
      WHERE m.company_id = ?
    `).all(cid);
    for (const m of mappings) {
      groupMap[m.analytic_account] = { id: m.group_id, name: m.group_name };
      if (m.redistributable) redistSet.add(m.analytic_account);
    }

    // 2. Query expenses per cost center (aggregated)
    const ccExpenseRows = this.db.prepare(`
      SELECT COALESCE(NULLIF(analytic_account,''),'بدون مركز') as cost_center,
        COALESCE(SUM(debit - credit), 0) as expenses
      FROM journal_items
      WHERE company_id = @companyId AND date >= @dateFrom AND date <= @dateTo
        AND move_state = 'posted'
        AND account_type IN ('expense','expense_direct','expense_depreciation')
      GROUP BY cost_center
    `).all(p);

    // 3. Query revenue per cost center
    const ccRevenueRows = this.db.prepare(`
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

    let totalTargetRevenue = 0;
    targetCCs.forEach(cc => { totalTargetRevenue += ccRevMap[cc] || 0; });

    const ccAllocation = {};
    let allocSum = 0;
    const allocEntries = targetCCs.map(cc => {
      const rev = ccRevMap[cc] || 0;
      const ratio = totalTargetRevenue > 0 ? rev / totalTargetRevenue : (targetCCs.length > 0 ? 1 / targetCCs.length : 0);
      const alloc = adminTotalExp > 0 ? Math.round(adminTotalExp * ratio) : 0;
      allocSum += alloc;
      return { cc, alloc, rev };
    });

    if (adminTotalExp > 0 && allocEntries.length > 0) {
      const rem = Math.round(adminTotalExp) - allocSum;
      if (rem !== 0) {
        let maxIdx = 0, maxRev = -1;
        allocEntries.forEach((e, i) => { if (e.rev > maxRev) { maxRev = e.rev; maxIdx = i; } });
        allocEntries[maxIdx].alloc += rem;
      }
    }
    allocEntries.forEach(e => { ccAllocation[e.cc] = e.alloc; });

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
        GROUP BY cost_center, account_code
        ORDER BY cost_center, account_code
      `;
    }

    const rows = this.db.prepare(sql).all(p);
    const results = [];
    const ccExpenseDetail = {};
    for (const row of rows) {
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

  /**
   * Stage D2: Departments & Profitability (الأقسام والربحية)
   * 4-level TreeTable: Company -> Department -> Cost Center -> Account
   * Single measure: revenue | expense | net
   * Administrative Expense Redistribution toggle switch
   */
  getDepartmentsProfitability({
    companyIds,
    years,
    year,
    dateFrom,
    dateTo,
    measure = 'net',
    timeGrain = 'quarter',
    redistributeAdmin = false
  } = {}) {
    const period = this._periodFilter({ years, year, dateFrom, dateTo, defaultToCurrentYear: true }, 'fd.date', 'd2_');

    let targetLedgerIds;
    if (companyIds) {
      targetLedgerIds = (Array.isArray(companyIds) ? companyIds : String(companyIds).split(',')).map(Number).filter(Boolean);
    } else {
      targetLedgerIds = this.db.prepare('SELECT id FROM companies WHERE is_active = 1 ORDER BY id').all().map(r => r.id);
    }
    if (targetLedgerIds.length === 0) targetLedgerIds = [-1];

    const allowedGrains = {
      year: { col: 'fd.year', fmt: k => String(k) },
      quarter: { 
        col: 'fd.quarter', 
        fmt: k => {
          const parts = String(k).split('-Q');
          const qNames = { '1': 'الربع الأول', '2': 'الربع الثاني', '3': 'الربع الثالث', '4': 'الربع الرابع' };
          return parts.length === 2 ? `${qNames[parts[1]] || ('Q' + parts[1])} ${parts[0]}` : k;
        }
      },
      month: { 
        col: 'fd.month', 
        fmt: k => {
          const months = {
            '01': 'يناير', '02': 'فبراير', '03': 'مارس', '04': 'أبريل',
            '05': 'مايو', '06': 'يونيو', '07': 'يوليو', '08': 'أغسطس',
            '09': 'سبتمبر', '10': 'أكتوبر', '11': 'نوفمبر', '12': 'ديسمبر'
          };
          const parts = String(k).split('-');
          return parts.length === 2 ? `${months[parts[1]] || parts[1]} ${parts[0]}` : k;
        }
      }
    };

    const grainDef = allowedGrains[timeGrain] || allowedGrains.quarter;
    const inCoClause = `fd.company_id IN (${targetLedgerIds.join(',')})`;

    // 1. Query redistributable mappings
    const redistRows = this.db.prepare(`
      SELECT company_id, analytic_account, redistributable
      FROM analytic_group_mapping
      WHERE redistributable = 1
    `).all();
    const redistSet = new Set(redistRows.map(r => `${r.company_id}_${(r.analytic_account || '').trim()}`));

    // 2. Fetch aggregated rows from fact_daily
    const rows = this.db.prepare(`
      SELECT 
        fd.company_id,
        COALESCE(c.name, 'شركة ' || fd.company_id) as company_name,
        fd.department_id,
        COALESCE(ag.name, 'غير مصنّف') as department_name,
        COALESCE(NULLIF(TRIM(fd.analytic_account), ''), 'بدون مركز') as cost_center,
        fd.account_code,
        COALESCE(ca.name, fd.account_code) as account_name,
        ${grainDef.col} as period_key,
        COALESCE(SUM(fd.revenue), 0) as revenue,
        COALESCE(SUM(fd.expense), 0) as expense
      FROM fact_daily fd
      LEFT JOIN companies c ON c.id = fd.company_id
      LEFT JOIN analytic_groups ag ON ag.id = fd.department_id
      LEFT JOIN company_accounts ca ON ca.company_id = fd.company_id AND ca.code = fd.account_code
      WHERE ${inCoClause} AND ${period.sql}
      GROUP BY fd.company_id, fd.department_id, cost_center, fd.account_code, period_key
      ORDER BY fd.company_id, fd.department_id, cost_center, fd.account_code, period_key
    `).all(period.params);

    // Discover all unique periods
    const periodKeysSet = new Set();
    for (const r of rows) if (r.period_key) periodKeysSet.add(r.period_key);
    const sortedPeriodKeys = Array.from(periodKeysSet).sort();
    const columns = sortedPeriodKeys.map(k => ({ key: k, label: grainDef.fmt(k) }));

    // 3. Build Cost Center level revenue/expenses per period for redistribution calculation
    // 3. Build 4-level Tree: Company -> Department -> Cost Center -> Account
    const treeMap = new Map();
    let grandRev = 0, grandExp = 0, grandNet = 0, grandAdminRedist = 0;
    const grandPeriodValues = Object.fromEntries(sortedPeriodKeys.map(k => [k, 0]));

    for (const r of rows) {
      const cid = r.company_id;
      const did = r.department_id || 0;
      const cc = r.cost_center;
      const acc = r.account_code;
      const pk = r.period_key;
      const isRedist = redistSet.has(`${cid}_${cc}`);

      if (isRedist) grandAdminRedist += r.expense;

      if (!treeMap.has(cid)) {
        treeMap.set(cid, {
          id: cid,
          name: r.company_name,
          type: 'co',
          revenue: 0,
          expenses: 0,
          net: 0,
          allocated_admin: 0,
          values: Object.fromEntries(sortedPeriodKeys.map(k => [k, 0])),
          deptsMap: new Map()
        });
      }
      const co = treeMap.get(cid);

      const deptsMap = co.deptsMap;
      if (!deptsMap.has(did)) {
        deptsMap.set(did, {
          id: did,
          name: r.department_name,
          company_id: cid,
          type: 'dept',
          revenue: 0,
          expenses: 0,
          net: 0,
          allocated_admin: 0,
          values: Object.fromEntries(sortedPeriodKeys.map(k => [k, 0])),
          ccsMap: new Map()
        });
      }
      const dept = deptsMap.get(did);

      const ccsMap = dept.ccsMap;
      if (!ccsMap.has(cc)) {
        ccsMap.set(cc, {
          id: cc,
          name: cc,
          company_id: cid,
          department_id: did,
          type: 'cc',
          is_redistributable: isRedist,
          revenue: 0,
          expenses: 0,
          net: 0,
          allocated_admin: 0,
          values: Object.fromEntries(sortedPeriodKeys.map(k => [k, 0])),
          accountsMap: new Map()
        });
      }
      const ccNode = ccsMap.get(cc);

      const accountsMap = ccNode.accountsMap;
      if (!accountsMap.has(acc)) {
        accountsMap.set(acc, {
          id: acc,
          code: acc,
          name: r.account_name,
          company_id: cid,
          department_id: did,
          cost_center: cc,
          type: 'account',
          revenue: 0,
          expenses: 0,
          net: 0,
          values: Object.fromEntries(sortedPeriodKeys.map(k => [k, 0])),
          rev_by_period: {},
          exp_by_period: {}
        });
      }
      const accNode = accountsMap.get(acc);

      accNode.revenue += r.revenue;
      accNode.expenses += r.expense;
      accNode.net += (r.revenue - r.expense);
      accNode.rev_by_period[pk] = (accNode.rev_by_period[pk] || 0) + r.revenue;
      accNode.exp_by_period[pk] = (accNode.exp_by_period[pk] || 0) + r.expense;

      ccNode.revenue += r.revenue;
      ccNode.expenses += r.expense;
      dept.revenue += r.revenue;
      dept.expenses += r.expense;
      co.revenue += r.revenue;
      co.expenses += r.expense;

      grandRev += r.revenue;
      grandExp += r.expense;
    }

    // Finalize Tree and apply redistribution
    const tree = [];
    for (const co of treeMap.values()) {
      // Calculate redistribution allocations per period for this company
      const ccAllocations = {};
      if (redistributeAdmin) {
        for (const pk of sortedPeriodKeys) {
          let adminExp = 0;
          for (const dept of co.deptsMap.values()) {
            for (const cc of dept.ccsMap.values()) {
              if (cc.is_redistributable) {
                for (const a of cc.accountsMap.values()) {
                  adminExp += Math.round(a.exp_by_period[pk] || 0);
                }
              }
            }
          }

          if (adminExp <= 0) continue;

          const targetCCs = [];
          for (const dept of co.deptsMap.values()) {
            for (const cc of dept.ccsMap.values()) {
              if (!cc.is_redistributable) {
                let rev = 0, exp = 0;
                for (const a of cc.accountsMap.values()) {
                  rev += Math.round(a.rev_by_period[pk] || 0);
                  exp += Math.round(a.exp_by_period[pk] || 0);
                }
                targetCCs.push({ key: `${dept.id}_${cc.name}`, rev, exp });
              }
            }
          }

          if (targetCCs.length === 0) continue;

          let totalBase = targetCCs.reduce((s, c) => s + c.rev, 0);
          const useExpBase = totalBase === 0;
          if (useExpBase) totalBase = targetCCs.reduce((s, c) => s + c.exp, 0);

          let sumAlloc = 0;
          const allocEntries = targetCCs.map(c => {
            const base = useExpBase ? c.exp : c.rev;
            const ratio = totalBase > 0 ? (base / totalBase) : (1 / targetCCs.length);
            const alloc = Math.round(adminExp * ratio);
            sumAlloc += alloc;
            return { key: c.key, alloc, base };
          });

          const remainder = adminExp - sumAlloc;
          if (remainder !== 0) {
            let maxIdx = 0, maxBase = -1;
            allocEntries.forEach((e, i) => {
              if (e.base > maxBase) { maxBase = e.base; maxIdx = i; }
            });
            allocEntries[maxIdx].alloc += remainder;
          }

          for (const e of allocEntries) {
            ccAllocations[`${co.id}_${pk}_${e.key}`] = e.alloc;
          }
        }
      }

      co.departments = [];
      for (const dept of co.deptsMap.values()) {
        dept.costCenters = [];
        for (const cc of dept.ccsMap.values()) {
          cc.accounts = Array.from(cc.accountsMap.values());
          delete cc.accountsMap;

          // Compute account period values
          for (const a of cc.accounts) {
            for (const pk of sortedPeriodKeys) {
              const rev = a.rev_by_period[pk] || 0;
              const exp = a.exp_by_period[pk] || 0;
              const val = measure === 'revenue' ? rev : (measure === 'expense' ? exp : (rev - exp));
              a.values[pk] = Math.round(val);
            }
            a.total = Object.values(a.values).reduce((s, v) => s + v, 0);
          }

          // Apply CC period values & redistribution
          for (const pk of sortedPeriodKeys) {
            const alloc = (redistributeAdmin && !cc.is_redistributable) ? (ccAllocations[`${co.id}_${pk}_${dept.id}_${cc.name}`] || 0) : 0;
            cc.allocated_admin += alloc;

            if (redistributeAdmin) {
              if (cc.is_redistributable) {
                if (measure === 'expense') cc.values[pk] = 0;
                else if (measure === 'revenue') cc.values[pk] = cc.accounts.reduce((s, a) => s + (a.values[pk] || 0), 0);
                else cc.values[pk] = Math.round(cc.accounts.reduce((s, a) => s + (a.rev_by_period?.[pk] || 0), 0));
              } else {
                const baseVal = cc.accounts.reduce((s, a) => s + (a.values[pk] || 0), 0);
                if (measure === 'expense') cc.values[pk] = baseVal + alloc;
                else if (measure === 'net') cc.values[pk] = baseVal - alloc;
                else cc.values[pk] = baseVal;
              }
            } else {
              cc.values[pk] = cc.accounts.reduce((s, a) => s + (a.values[pk] || 0), 0);
            }
            dept.values[pk] = (dept.values[pk] || 0) + cc.values[pk];
          }

          cc.total = Object.values(cc.values).reduce((s, v) => s + v, 0);
          cc.net = cc.revenue - (cc.expenses + cc.allocated_admin);
          cc.margin = cc.revenue > 0 ? Math.round((cc.net / cc.revenue) * 1000) / 10 : 0;
          dept.costCenters.push(cc);
        }

        for (const pk of sortedPeriodKeys) {
          co.values[pk] = (co.values[pk] || 0) + dept.values[pk];
        }
        dept.total = Object.values(dept.values).reduce((s, v) => s + v, 0);
        dept.allocated_admin = dept.costCenters.reduce((s, c) => s + c.allocated_admin, 0);
        dept.net = dept.revenue - (dept.expenses + dept.allocated_admin);
        dept.margin = dept.revenue > 0 ? Math.round((dept.net / dept.revenue) * 1000) / 10 : 0;
        delete dept.ccsMap;
        co.departments.push(dept);
      }

      for (const pk of sortedPeriodKeys) {
        grandPeriodValues[pk] = (grandPeriodValues[pk] || 0) + co.values[pk];
      }
      co.total = Object.values(co.values).reduce((s, v) => s + v, 0);
      co.allocated_admin = co.departments.reduce((s, d) => s + d.allocated_admin, 0);
      co.net = co.revenue - (co.expenses + co.allocated_admin);
      co.margin = co.revenue > 0 ? Math.round((co.net / co.revenue) * 1000) / 10 : 0;
      delete co.deptsMap;
      tree.push(co);
    }

    let grandTotal = Object.values(grandPeriodValues).reduce((s, v) => s + v, 0);
    grandNet = grandRev - grandExp;

    const targetGrandTotal = Math.round(measure === 'revenue' ? grandRev : (measure === 'expense' ? grandExp : grandNet));
    const grandRemainder = grandTotal - targetGrandTotal;

    if (grandRemainder !== 0 && tree.length > 0 && sortedPeriodKeys.length > 0) {
      // Reconcile rounding remainder so table footer equals summary card exactly (Claude B6)
      let maxCo = tree[0];
      for (const co of tree) if (Math.abs(co.total) > Math.abs(maxCo.total)) maxCo = co;
      if (maxCo && maxCo.departments && maxCo.departments.length > 0) {
        let maxDept = maxCo.departments[0];
        for (const dept of maxCo.departments) if (Math.abs(dept.total) > Math.abs(maxDept.total)) maxDept = dept;
        if (maxDept && maxDept.costCenters && maxDept.costCenters.length > 0) {
          let maxCc = maxDept.costCenters[0];
          for (const cc of maxDept.costCenters) if (Math.abs(cc.total) > Math.abs(maxCc.total)) maxCc = cc;
          if (maxCc && maxCc.accounts && maxCc.accounts.length > 0) {
            let maxAcc = maxCc.accounts[0];
            for (const a of maxCc.accounts) if (Math.abs(a.total) > Math.abs(maxAcc.total)) maxAcc = a;
            const lastPk = sortedPeriodKeys[sortedPeriodKeys.length - 1];
            if (lastPk) {
              maxAcc.values[lastPk] = (maxAcc.values[lastPk] || 0) - grandRemainder;
              maxAcc.total -= grandRemainder;
              maxCc.values[lastPk] = (maxCc.values[lastPk] || 0) - grandRemainder;
              maxCc.total -= grandRemainder;
              maxDept.values[lastPk] = (maxDept.values[lastPk] || 0) - grandRemainder;
              maxDept.total -= grandRemainder;
              maxCo.values[lastPk] = (maxCo.values[lastPk] || 0) - grandRemainder;
              maxCo.total -= grandRemainder;
              grandPeriodValues[lastPk] = (grandPeriodValues[lastPk] || 0) - grandRemainder;
              grandTotal = targetGrandTotal;
            }
          }
        }
      }
    }

    return {
      meta: {
        period_label: period.label,
        years: period.yearsList,
        measure,
        timeGrain,
        redistributeAdmin
      },
      summary: {
        total_revenue: Math.round(grandRev),
        total_expenses: Math.round(grandExp),
        net_profit: Math.round(grandNet),
        profit_margin: grandRev > 0 ? Math.round((grandNet / grandRev) * 1000) / 10 : 0,
        admin_expenses_redistributed: Math.round(grandAdminRedist)
      },
      columns,
      tree,
      totals: {
        values: grandPeriodValues,
        total: grandTotal,
        revenue: Math.round(grandRev),
        expenses: Math.round(grandExp),
        net: Math.round(grandNet)
      }
    };
  }

  /**
   * VAT Consolidated Report Engine (D5)
   * Calculates taxable sales/purchases, output/input VAT, net VAT due, and settlements.
   * Derives data strictly from journal item lines tagged vat_output, vat_input, and vat_settlement.
   * Tree hierarchy: Company -> Year -> Quarter -> Month
   * Default view grain: 'vat_period' (Monthly for company 2, Quarterly for others)
   */
  getVatReport({ companyIds, years, dateFrom, dateTo, grain = 'vat_period' } = {}) {
    const period = this._periodFilter({ years, dateFrom, dateTo }, 'ji.date', 'vat_');

    let targetCompanies = [];
    if (companyIds) {
      const cids = Array.isArray(companyIds)
        ? companyIds.map(Number).filter(n => !isNaN(n))
        : String(companyIds).split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
      if (cids.length > 0) {
        targetCompanies = this.db.prepare(`
          SELECT id, name, vat_period, color, short_name 
          FROM companies 
          WHERE id IN (${cids.map(() => '?').join(',')}) AND is_active = 1 
          ORDER BY id
        `).all(...cids);
      }
    }
    if (targetCompanies.length === 0) {
      targetCompanies = this.db.prepare('SELECT id, name, vat_period, color, short_name FROM companies WHERE is_active = 1 ORDER BY id').all();
    }

    const coIds = targetCompanies.map(c => c.id);
    if (coIds.length === 0) {
      return {
        cards: { taxable_sales: 0, output_tax: 0, taxable_purchases: 0, input_tax: 0, net_tax_due: 0, settlements: 0, ledger_balance: 0, last_completed_period: '' },
        tree: [],
        totals: { taxable_sales: 0, output_tax: 0, output_invoices: 0, output_refunds: 0, taxable_purchases: 0, input_tax: 0, input_bills: 0, input_refunds: 0, net_tax_due: 0, settlements: 0, ledger_balance: 0, reconciliation_diff: 0 },
        meta: { period_label: period.label, years: period.yearsList, grain }
      };
    }

    const ARABIC_MONTHS = ['', 'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    const ARABIC_QUARTERS = { '1': 'الربع الأول', '2': 'الربع الثاني', '3': 'الربع الثالث', '4': 'الربع الرابع' };

    const inCoClause = `ji.company_id IN (${coIds.join(',')})`;

    // Tax lines aggregation by company and month
    const taxLinesSql = `
      SELECT 
        ji.company_id,
        strftime('%Y-%m', ji.date) as month,
        ROUND(SUM(CASE WHEN at.tag = 'vat_output' AND (ji.credit >= ji.debit) THEN ji.tax_base_amount 
                       WHEN at.tag = 'vat_output' AND (ji.debit > ji.credit) THEN -ji.tax_base_amount 
                       ELSE 0 END), 2) as taxable_sales,
        ROUND(SUM(CASE WHEN at.tag = 'vat_output' AND ji.credit > 0 THEN ji.credit ELSE 0 END), 2) as output_invoices,
        ROUND(SUM(CASE WHEN at.tag = 'vat_output' AND ji.debit > 0 THEN ji.debit ELSE 0 END), 2) as output_refunds,
        ROUND(SUM(CASE WHEN at.tag = 'vat_output' THEN ji.credit - ji.debit ELSE 0 END), 2) as output_tax,
        ROUND(SUM(CASE WHEN at.tag = 'vat_input' AND (ji.debit >= ji.credit) THEN ji.tax_base_amount 
                       WHEN at.tag = 'vat_input' AND (ji.credit > ji.debit) THEN -ji.tax_base_amount 
                       ELSE 0 END), 2) as taxable_purchases,
        ROUND(SUM(CASE WHEN at.tag = 'vat_input' AND ji.debit > 0 THEN ji.debit ELSE 0 END), 2) as input_bills,
        ROUND(SUM(CASE WHEN at.tag = 'vat_input' AND ji.credit > 0 THEN ji.credit ELSE 0 END), 2) as input_refunds,
        ROUND(SUM(CASE WHEN at.tag = 'vat_input' THEN ji.debit - ji.credit ELSE 0 END), 2) as input_tax
      FROM journal_items ji
      JOIN account_tags at ON at.company_id = ji.company_id AND at.account_code = ji.account_code
      WHERE ${inCoClause}
        AND ji.tax_id IS NOT NULL
        AND at.tag IN ('vat_output', 'vat_input')
        AND ${period.sql}
      GROUP BY ji.company_id, strftime('%Y-%m', ji.date)
    `;
    const taxLinesRows = this.db.prepare(taxLinesSql).all(period.params);

    // Settlements aggregation by company and month
    const settlementsSql = `
      SELECT 
        ji.company_id,
        strftime('%Y-%m', ji.date) as month,
        ROUND(SUM(CASE WHEN at.tag = 'vat_output' THEN ji.debit - ji.credit 
                       WHEN at.tag = 'vat_input' THEN ji.credit - ji.debit 
                       WHEN at.tag = 'vat_settlement' THEN ji.debit - ji.credit 
                       ELSE 0 END), 2) as settlements
      FROM journal_items ji
      JOIN account_tags at ON at.company_id = ji.company_id AND at.account_code = ji.account_code
      WHERE ${inCoClause}
        AND ji.tax_id IS NULL
        AND at.tag IN ('vat_output', 'vat_input', 'vat_settlement')
        AND ${period.sql}
      GROUP BY ji.company_id, strftime('%Y-%m', ji.date)
    `;
    const settlementRows = this.db.prepare(settlementsSql).all(period.params);

    // Cumulative ledger balance by company up to refDate/dateTo
    const ledgerSql = `
      SELECT 
        ji.company_id,
        ROUND(SUM(CASE WHEN at.tag IN ('vat_output', 'vat_settlement') THEN ji.credit - ji.debit 
                       WHEN at.tag = 'vat_input' THEN -(ji.debit - ji.credit)
                       ELSE 0 END), 2) as balance
      FROM journal_items ji
      JOIN account_tags at ON at.company_id = ji.company_id AND at.account_code = ji.account_code
      WHERE ${inCoClause}
        AND at.tag IN ('vat_output', 'vat_input', 'vat_settlement')
        ${period.dateTo ? 'AND ji.date <= @ledger_dt' : ''}
      GROUP BY ji.company_id
    `;
    const ledgerParams = period.dateTo ? { ledger_dt: period.dateTo } : {};
    const ledgerRows = this.db.prepare(ledgerSql).all(ledgerParams);
    const ledgerBalanceByCo = {};
    for (const r of ledgerRows) {
      ledgerBalanceByCo[r.company_id] = r.balance || 0;
    }

    // Build map: [company_id][month] -> data
    const monthDataMap = {};
    for (const r of taxLinesRows) {
      if (!monthDataMap[r.company_id]) monthDataMap[r.company_id] = {};
      monthDataMap[r.company_id][r.month] = {
        taxable_sales: r.taxable_sales || 0,
        output_invoices: r.output_invoices || 0,
        output_refunds: r.output_refunds || 0,
        output_tax: r.output_tax || 0,
        taxable_purchases: r.taxable_purchases || 0,
        input_bills: r.input_bills || 0,
        input_refunds: r.input_refunds || 0,
        input_tax: r.input_tax || 0,
        settlements: 0
      };
    }
    for (const r of settlementRows) {
      if (!monthDataMap[r.company_id]) monthDataMap[r.company_id] = {};
      if (!monthDataMap[r.company_id][r.month]) {
        monthDataMap[r.company_id][r.month] = {
          taxable_sales: 0, output_invoices: 0, output_refunds: 0, output_tax: 0,
          taxable_purchases: 0, input_bills: 0, input_refunds: 0, input_tax: 0,
          settlements: 0
        };
      }
      monthDataMap[r.company_id][r.month].settlements = r.settlements || 0;
    }

    // Construct hierarchy: Company -> Year -> Quarter -> Month
    const tree = [];
    const grandTotals = {
      taxable_sales: 0, output_tax: 0, output_invoices: 0, output_refunds: 0,
      taxable_purchases: 0, input_tax: 0, input_bills: 0, input_refunds: 0,
      net_tax_due: 0, settlements: 0, ledger_balance: 0, reconciliation_diff: 0
    };

    for (const co of targetCompanies) {
      const coMap = monthDataMap[co.id] || {};
      const sortedMonths = Object.keys(coMap).sort().reverse();
      
      const yearsMap = {};

      for (const mStr of sortedMonths) {
        const [yStr, mNumStr] = mStr.split('-');
        const mNum = parseInt(mNumStr, 10);
        const qNum = Math.ceil(mNum / 3);
        const qKey = `${yStr}-Q${qNum}`;

        if (!yearsMap[yStr]) {
          yearsMap[yStr] = {
            id: `co_${co.id}_${yStr}`,
            type: 'year',
            company_id: co.id,
            period_key: yStr,
            name: yStr,
            year: yStr,
            taxable_sales: 0, output_tax: 0, output_invoices: 0, output_refunds: 0,
            taxable_purchases: 0, input_tax: 0, input_bills: 0, input_refunds: 0,
            net_tax_due: 0, settlements: 0,
            quartersMap: {}
          };
        }

        const yNode = yearsMap[yStr];
        if (!yNode.quartersMap[qKey]) {
          yNode.quartersMap[qKey] = {
            id: `co_${co.id}_${qKey}`,
            type: 'quarter',
            company_id: co.id,
            period_key: qKey,
            name: `${ARABIC_QUARTERS[qNum]} ${yStr}`,
            quarter_number: qNum,
            year: yStr,
            taxable_sales: 0, output_tax: 0, output_invoices: 0, output_refunds: 0,
            taxable_purchases: 0, input_tax: 0, input_bills: 0, input_refunds: 0,
            net_tax_due: 0, settlements: 0,
            months: []
          };
        }

        const qNode = yNode.quartersMap[qKey];
        const mData = coMap[mStr];
        const mNet = Math.round((mData.output_tax - mData.input_tax) * 100) / 100;
        
        const mNode = {
          id: `co_${co.id}_${mStr}`,
          type: 'month',
          company_id: co.id,
          period_key: mStr,
          name: `${ARABIC_MONTHS[mNum]} ${yStr}`,
          month_number: mNum,
          quarter_number: qNum,
          year: yStr,
          taxable_sales: mData.taxable_sales,
          output_tax: mData.output_tax,
          output_invoices: mData.output_invoices,
          output_refunds: mData.output_refunds,
          taxable_purchases: mData.taxable_purchases,
          input_tax: mData.input_tax,
          input_bills: mData.input_bills,
          input_refunds: mData.input_refunds,
          net_tax_due: mNet,
          settlements: mData.settlements,
          reconciliation_diff: 0
        };

        qNode.months.push(mNode);

        qNode.taxable_sales = Math.round((qNode.taxable_sales + mData.taxable_sales) * 100) / 100;
        qNode.output_tax = Math.round((qNode.output_tax + mData.output_tax) * 100) / 100;
        qNode.output_invoices = Math.round((qNode.output_invoices + mData.output_invoices) * 100) / 100;
        qNode.output_refunds = Math.round((qNode.output_refunds + mData.output_refunds) * 100) / 100;
        qNode.taxable_purchases = Math.round((qNode.taxable_purchases + mData.taxable_purchases) * 100) / 100;
        qNode.input_tax = Math.round((qNode.input_tax + mData.input_tax) * 100) / 100;
        qNode.input_bills = Math.round((qNode.input_bills + mData.input_bills) * 100) / 100;
        qNode.input_refunds = Math.round((qNode.input_refunds + mData.input_refunds) * 100) / 100;
        qNode.settlements = Math.round((qNode.settlements + mData.settlements) * 100) / 100;
        qNode.net_tax_due = Math.round((qNode.output_tax - qNode.input_tax) * 100) / 100;

        yNode.taxable_sales = Math.round((yNode.taxable_sales + mData.taxable_sales) * 100) / 100;
        yNode.output_tax = Math.round((yNode.output_tax + mData.output_tax) * 100) / 100;
        yNode.output_invoices = Math.round((yNode.output_invoices + mData.output_invoices) * 100) / 100;
        yNode.output_refunds = Math.round((yNode.output_refunds + mData.output_refunds) * 100) / 100;
        yNode.taxable_purchases = Math.round((yNode.taxable_purchases + mData.taxable_purchases) * 100) / 100;
        yNode.input_tax = Math.round((yNode.input_tax + mData.input_tax) * 100) / 100;
        yNode.input_bills = Math.round((yNode.input_bills + mData.input_bills) * 100) / 100;
        yNode.input_refunds = Math.round((yNode.input_refunds + mData.input_refunds) * 100) / 100;
        yNode.settlements = Math.round((yNode.settlements + mData.settlements) * 100) / 100;
        yNode.net_tax_due = Math.round((yNode.output_tax - yNode.input_tax) * 100) / 100;
      }

      const coNode = {
        id: `co_${co.id}`,
        type: 'company',
        company_id: co.id,
        name: co.name,
        vat_period: co.vat_period || 'quarterly',
        color: co.color || '#3b82f6',
        taxable_sales: 0, output_tax: 0, output_invoices: 0, output_refunds: 0,
        taxable_purchases: 0, input_tax: 0, input_bills: 0, input_refunds: 0,
        net_tax_due: 0, settlements: 0,
        ledger_balance: ledgerBalanceByCo[co.id] || 0,
        reconciliation_diff: 0,
        children: []
      };

      const sortedYears = Object.keys(yearsMap).sort().reverse();
      for (const yStr of sortedYears) {
        const yNode = yearsMap[yStr];
        const quarters = Object.values(yNode.quartersMap).sort((a, b) => b.quarter_number - a.quarter_number);
        for (const q of quarters) {
          q.months.sort((a, b) => b.month_number - a.month_number);
          q.children = q.months;
        }
        yNode.children = quarters;
        delete yNode.quartersMap;

        coNode.children.push(yNode);

        coNode.taxable_sales = Math.round((coNode.taxable_sales + yNode.taxable_sales) * 100) / 100;
        coNode.output_tax = Math.round((coNode.output_tax + yNode.output_tax) * 100) / 100;
        coNode.output_invoices = Math.round((coNode.output_invoices + yNode.output_invoices) * 100) / 100;
        coNode.output_refunds = Math.round((coNode.output_refunds + yNode.output_refunds) * 100) / 100;
        coNode.taxable_purchases = Math.round((coNode.taxable_purchases + yNode.taxable_purchases) * 100) / 100;
        coNode.input_tax = Math.round((coNode.input_tax + yNode.input_tax) * 100) / 100;
        coNode.input_bills = Math.round((coNode.input_bills + yNode.input_bills) * 100) / 100;
        coNode.input_refunds = Math.round((coNode.input_refunds + yNode.input_refunds) * 100) / 100;
        coNode.settlements = Math.round((coNode.settlements + yNode.settlements) * 100) / 100;
        coNode.net_tax_due = Math.round((coNode.output_tax - coNode.input_tax) * 100) / 100;
      }

      tree.push(coNode);

      grandTotals.taxable_sales = Math.round((grandTotals.taxable_sales + coNode.taxable_sales) * 100) / 100;
      grandTotals.output_tax = Math.round((grandTotals.output_tax + coNode.output_tax) * 100) / 100;
      grandTotals.output_invoices = Math.round((grandTotals.output_invoices + coNode.output_invoices) * 100) / 100;
      grandTotals.output_refunds = Math.round((grandTotals.output_refunds + coNode.output_refunds) * 100) / 100;
      grandTotals.taxable_purchases = Math.round((grandTotals.taxable_purchases + coNode.taxable_purchases) * 100) / 100;
      grandTotals.input_tax = Math.round((grandTotals.input_tax + coNode.input_tax) * 100) / 100;
      grandTotals.input_bills = Math.round((grandTotals.input_bills + coNode.input_bills) * 100) / 100;
      grandTotals.input_refunds = Math.round((grandTotals.input_refunds + coNode.input_refunds) * 100) / 100;
      grandTotals.settlements = Math.round((grandTotals.settlements + coNode.settlements) * 100) / 100;
      grandTotals.net_tax_due = Math.round((grandTotals.output_tax - grandTotals.input_tax) * 100) / 100;
      grandTotals.ledger_balance = Math.round((grandTotals.ledger_balance + coNode.ledger_balance) * 100) / 100;
    }

    // Last completed filing period description for single company card
    let lastCompletedDesc = '';
    if (targetCompanies.length === 1) {
      const singleCo = targetCompanies[0];
      const now = new Date();
      if (singleCo.vat_period === 'monthly') {
        const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prevY = prevMonthDate.getFullYear();
        const prevM = prevMonthDate.getMonth() + 1;
        const prevMKey = `${prevY}-${String(prevM).padStart(2, '0')}`;
        const prevData = monthDataMap[singleCo.id]?.[prevMKey];
        const prevDue = prevData ? Math.round((prevData.output_tax - prevData.input_tax) * 100) / 100 : null;
        lastCompletedDesc = `${ARABIC_MONTHS[prevM]} ${prevY}` + (prevDue !== null ? ` (مستحق: ${prevDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س)` : '');
      } else {
        const curQ = Math.floor(now.getMonth() / 3) + 1;
        let prevQ = curQ - 1;
        let prevQYear = now.getFullYear();
        if (prevQ < 1) { prevQ = 4; prevQYear--; }
        const prevQKey = `${prevQYear}-Q${prevQ}`;
        const yNode = tree[0]?.children?.find(y => y.year == prevQYear);
        const qNode = yNode?.children?.find(q => q.period_key == prevQKey);
        const prevDue = qNode ? qNode.net_tax_due : null;
        lastCompletedDesc = `${ARABIC_QUARTERS[prevQ]} ${prevQYear}` + (prevDue !== null ? ` (مستحق: ${prevDue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ر.س)` : '');
      }
    }

    return {
      cards: {
        taxable_sales: grandTotals.taxable_sales,
        output_tax: grandTotals.output_tax,
        taxable_purchases: grandTotals.taxable_purchases,
        input_tax: grandTotals.input_tax,
        net_tax_due: grandTotals.net_tax_due,
        settlements: grandTotals.settlements,
        ledger_balance: grandTotals.ledger_balance,
        last_completed_period: lastCompletedDesc
      },
      tree,
      totals: grandTotals,
      meta: {
        period_label: period.label,
        years: period.yearsList,
        grain,
        companies_count: targetCompanies.length
      }
    };
  }

  /**
   * VAT Period Details (D5 Slide-over)
   * Fetches tax summary, breakdown by tax type (including zero/exempt), document lines, and settlements.
   */
  getVatDetails({ companyId, period, dateFrom, dateTo } = {}) {
    if (!companyId) throw new Error('companyId is required');

    let df = dateFrom;
    let dt = dateTo;

    if (!df || !dt) {
      if (period) {
        if (/^\d{4}-\d{2}$/.test(period)) {
          df = `${period}-01`;
          const [y, m] = period.split('-').map(Number);
          const lastDay = new Date(y, m, 0).getDate();
          dt = `${period}-${String(lastDay).padStart(2, '0')}`;
        } else if (/^\d{4}-Q[1-4]$/.test(period)) {
          const y = period.slice(0, 4);
          const q = parseInt(period.slice(6), 10);
          const qRanges = {
            1: [`${y}-01-01`, `${y}-03-31`],
            2: [`${y}-04-01`, `${y}-06-30`],
            3: [`${y}-07-01`, `${y}-09-30`],
            4: [`${y}-10-01`, `${y}-12-31`]
          };
          [df, dt] = qRanges[q];
        } else if (/^\d{4}$/.test(period)) {
          df = `${period}-01-01`;
          dt = `${period}-12-31`;
        }
      }
    }

    if (!df || !dt) {
      const curYear = new Date().getFullYear();
      df = `${curYear}-01-01`;
      dt = `${curYear}-12-31`;
    }

    // 1. Summary
    const summaryRow = this.db.prepare(`
      SELECT 
        ROUND(SUM(CASE WHEN at.tag = 'vat_output' AND (ji.credit >= ji.debit) THEN ji.tax_base_amount 
                       WHEN at.tag = 'vat_output' AND (ji.debit > ji.credit) THEN -ji.tax_base_amount 
                       ELSE 0 END), 2) as taxable_sales,
        ROUND(SUM(CASE WHEN at.tag = 'vat_output' AND ji.credit > 0 THEN ji.credit ELSE 0 END), 2) as output_invoices,
        ROUND(SUM(CASE WHEN at.tag = 'vat_output' AND ji.debit > 0 THEN ji.debit ELSE 0 END), 2) as output_refunds,
        ROUND(SUM(CASE WHEN at.tag = 'vat_output' THEN ji.credit - ji.debit ELSE 0 END), 2) as output_tax,
        ROUND(SUM(CASE WHEN at.tag = 'vat_input' AND (ji.debit >= ji.credit) THEN ji.tax_base_amount 
                       WHEN at.tag = 'vat_input' AND (ji.credit > ji.debit) THEN -ji.tax_base_amount 
                       ELSE 0 END), 2) as taxable_purchases,
        ROUND(SUM(CASE WHEN at.tag = 'vat_input' AND ji.debit > 0 THEN ji.debit ELSE 0 END), 2) as input_bills,
        ROUND(SUM(CASE WHEN at.tag = 'vat_input' AND ji.credit > 0 THEN ji.credit ELSE 0 END), 2) as input_refunds,
        ROUND(SUM(CASE WHEN at.tag = 'vat_input' THEN ji.debit - ji.credit ELSE 0 END), 2) as input_tax
      FROM journal_items ji
      JOIN account_tags at ON at.company_id = ji.company_id AND at.account_code = ji.account_code
      WHERE ji.company_id = ?
        AND ji.tax_id IS NOT NULL
        AND at.tag IN ('vat_output', 'vat_input')
        AND ji.date >= ? AND ji.date <= ?
    `).get(companyId, df, dt) || {};

    const settlementsRow = this.db.prepare(`
      SELECT 
        ROUND(SUM(CASE WHEN at.tag = 'vat_output' THEN ji.debit - ji.credit 
                       WHEN at.tag = 'vat_input' THEN ji.credit - ji.debit 
                       WHEN at.tag = 'vat_settlement' THEN ji.debit - ji.credit 
                       ELSE 0 END), 2) as settlements
      FROM journal_items ji
      JOIN account_tags at ON at.company_id = ji.company_id AND at.account_code = ji.account_code
      WHERE ji.company_id = ?
        AND ji.tax_id IS NULL
        AND at.tag IN ('vat_output', 'vat_input', 'vat_settlement')
        AND ji.date >= ? AND ji.date <= ?
    `).get(companyId, df, dt) || {};

    const summary = {
      taxable_sales: summaryRow.taxable_sales || 0,
      output_tax: summaryRow.output_tax || 0,
      output_invoices: summaryRow.output_invoices || 0,
      output_refunds: summaryRow.output_refunds || 0,
      taxable_purchases: summaryRow.taxable_purchases || 0,
      input_tax: summaryRow.input_tax || 0,
      input_bills: summaryRow.input_bills || 0,
      input_refunds: summaryRow.input_refunds || 0,
      net_tax_due: Math.round(((summaryRow.output_tax || 0) - (summaryRow.input_tax || 0)) * 100) / 100,
      settlements: settlementsRow.settlements || 0
    };

    // 2. Breakdown by tax type (including standard rates and 0%/exempt)
    const standardTaxes = this.db.prepare(`
      SELECT 
        COALESCE(ot.tax_id, ji.tax_id, 0) as tax_id,
        COALESCE(ot.name, ji.tax_name, 'أخرى') as name,
        COALESCE(ot.type_tax_use, CASE WHEN at.tag = 'vat_output' THEN 'sale' ELSE 'purchase' END) as type_tax_use,
        COALESCE(ot.amount, 15) as rate,
        ROUND(SUM(CASE WHEN at.tag = 'vat_output' THEN (CASE WHEN ji.credit >= ji.debit THEN ji.tax_base_amount ELSE -ji.tax_base_amount END)
                       WHEN at.tag = 'vat_input' THEN (CASE WHEN ji.debit >= ji.credit THEN ji.tax_base_amount ELSE -ji.tax_base_amount END)
                       ELSE 0 END), 2) as base_amount,
        ROUND(SUM(CASE WHEN at.tag = 'vat_output' THEN ji.credit - ji.debit
                       WHEN at.tag = 'vat_input' THEN ji.debit - ji.credit
                       ELSE 0 END), 2) as tax_amount,
        COUNT(*) as count
      FROM journal_items ji
      JOIN account_tags at ON at.company_id = ji.company_id AND at.account_code = ji.account_code
      LEFT JOIN odoo_taxes ot ON ot.tax_id = ji.tax_id
      WHERE ji.company_id = ?
        AND ji.tax_id IS NOT NULL
        AND at.tag IN ('vat_output', 'vat_input')
        AND ji.date >= ? AND ji.date <= ?
      GROUP BY ot.tax_id, ot.name, ot.type_tax_use
      ORDER BY type_tax_use DESC, tax_amount DESC
    `).all(companyId, df, dt);

    // Also get zero-rated or exempt sales from tax_ids
    const zeroSaleTaxIds = this.db.prepare(`SELECT tax_id, name, amount FROM odoo_taxes WHERE amount = 0 AND type_tax_use = 'sale'`).all();
    const zeroTaxRows = [];
    for (const zt of zeroSaleTaxIds) {
      const zRow = this.db.prepare(`
        SELECT 
          ROUND(SUM(ji.credit - ji.debit), 2) as base_amount,
          COUNT(*) as count
        FROM journal_items ji
        WHERE ji.company_id = ?
          AND ji.tax_id IS NULL
          AND ji.tax_ids LIKE '%' || ? || '%'
          AND ji.account_type LIKE 'income%'
          AND ji.date >= ? AND ji.date <= ?
      `).get(companyId, zt.tax_id, df, dt);

      if (zRow && zRow.count > 0 && Math.abs(zRow.base_amount || 0) > 0) {
        zeroTaxRows.push({
          tax_id: zt.tax_id,
          name: zt.name,
          type_tax_use: 'sale',
          rate: 0,
          base_amount: zRow.base_amount || 0,
          tax_amount: 0,
          count: zRow.count
        });
      }
    }

    const byTaxType = [...standardTaxes, ...zeroTaxRows];

    // 3. Document Lines (up to 500 lines)
    const documents = this.db.prepare(`
      SELECT 
        ji.id,
        ji.move_name,
        COALESCE(ji.partner_name, '') as partner_name,
        ji.date,
        ji.account_code,
        COALESCE(ji.tax_name, '') as tax_name,
        ji.tax_base_amount,
        ROUND(CASE WHEN at.tag = 'vat_output' THEN ji.credit - ji.debit ELSE ji.debit - ji.credit END, 2) as tax_amount,
        COALESCE(ji.move_type, '') as move_type,
        ji.debit,
        ji.credit,
        at.tag as tax_role,
        CASE WHEN (at.tag = 'vat_output' AND ji.debit > ji.credit) OR (at.tag = 'vat_input' AND ji.credit > ji.debit) THEN 1 ELSE 0 END as is_refund
      FROM journal_items ji
      JOIN account_tags at ON at.company_id = ji.company_id AND at.account_code = ji.account_code
      WHERE ji.company_id = ?
        AND ji.tax_id IS NOT NULL
        AND at.tag IN ('vat_output', 'vat_input')
        AND ji.date >= ? AND ji.date <= ?
      ORDER BY ji.date DESC, ji.id DESC
      LIMIT 500
    `).all(companyId, df, dt);

    // 4. Settlement Lines (up to 100 lines)
    const settlementMoves = this.db.prepare(`
      SELECT 
        ji.id,
        ji.move_name,
        COALESCE(ji.partner_name, '') as partner_name,
        ji.date,
        COALESCE(ji.label, '') as label,
        ji.debit,
        ji.credit,
        ji.account_code,
        COALESCE(ji.account_name, '') as account_name
      FROM journal_items ji
      JOIN account_tags at ON at.company_id = ji.company_id AND at.account_code = ji.account_code
      WHERE ji.company_id = ?
        AND ji.tax_id IS NULL
        AND at.tag IN ('vat_output', 'vat_input', 'vat_settlement')
        AND ji.date >= ? AND ji.date <= ?
      ORDER BY ji.date DESC, ji.id DESC
      LIMIT 100
    `).all(companyId, df, dt);

    return {
      company_id: companyId,
      period: period || `${df} إلى ${dt}`,
      date_from: df,
      date_to: dt,
      summary,
      by_tax_type: byTaxType,
      documents,
      settlement_moves: settlementMoves
    };
  }
}

module.exports = ConsolidationEngine;
