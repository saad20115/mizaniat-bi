const { getDb } = require('../db/connection');

class ConsolidationEngine {
  constructor(db) {
    this.db = db || getDb();
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

    // 1. Combined Revenue & Expenses
    const revExp = this.db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN ${this._sectionExpr('ji', 'o')} = 'income' THEN ji.credit - ji.debit ELSE 0 END), 0) as totalRevenue,
        COALESCE(SUM(CASE WHEN ${this._sectionExpr('ji', 'o')} = 'expense' THEN ji.debit - ji.credit ELSE 0 END), 0) as totalExpenses
      FROM journal_items ji
      ${this._sectionJoin('ji', 'o')}
      WHERE ji.move_state = 'posted'
        ${companyFilter} ${periodDateFilter}
    `).get(params);

    // 2. Combined Balance Sheet & Position KPIs
    const bsKpis = this.db.prepare(`
      SELECT 
        COALESCE(SUM(CASE WHEN ${this._sectionExpr('ji', 'o')} = 'asset' THEN ji.debit - ji.credit ELSE 0 END), 0) as totalAssets,
        COALESCE(SUM(CASE WHEN ${this._sectionExpr('ji', 'o')} = 'liability' THEN ji.credit - ji.debit ELSE 0 END), 0) as totalLiabilities,
        COALESCE(SUM(CASE WHEN ${this._cashFilter('ji')} THEN ji.debit - ji.credit ELSE 0 END), 0) as cashPosition,
        COALESCE(SUM(CASE WHEN ${this._guaranteeFilter('ji')} THEN ji.debit - ji.credit ELSE 0 END), 0) as guarantees
      FROM journal_items ji
      ${this._sectionJoin('ji', 'o')}
      WHERE ji.move_state = 'posted'
        ${companyFilter} ${asOfFilter}
    `).get(params);

    // 3. Combined Monthly Breakdown (Revenue & Expenses)
    const monthlySeries = this.db.prepare(`
      SELECT 
        ji.period,
        COALESCE(SUM(CASE WHEN ${this._sectionExpr('ji', 'o')} = 'income' THEN ji.credit - ji.debit ELSE 0 END), 0) as revenue,
        COALESCE(SUM(CASE WHEN ${this._sectionExpr('ji', 'o')} = 'expense' THEN ji.debit - ji.credit ELSE 0 END), 0) as expense
      FROM journal_items ji
      ${this._sectionJoin('ji', 'o')}
      WHERE ji.move_state = 'posted'
        ${companyFilter} ${periodDateFilter}
      GROUP BY ji.period
      ORDER BY ji.period
    `).all(params);

    const revenueByPeriod = monthlySeries.map(m => ({ period: m.period, total: m.revenue }));
    const expensesByPeriod = monthlySeries.map(m => ({ period: m.period, total: m.expense }));

    // 4. Combined Company Breakdown (Revenue & Expenses)
    const companySeries = this.db.prepare(`
      SELECT 
        c.name as company_name, 
        c.color,
        COALESCE(SUM(CASE WHEN ${this._sectionExpr('ji', 'o')} = 'income' THEN ji.credit - ji.debit ELSE 0 END), 0) as revenue,
        COALESCE(SUM(CASE WHEN ${this._sectionExpr('ji', 'o')} = 'expense' THEN ji.debit - ji.credit ELSE 0 END), 0) as expense
      FROM journal_items ji
      JOIN companies c ON c.id = ji.company_id
      ${this._sectionJoin('ji', 'o')}
      WHERE ji.move_state = 'posted'
        ${companyFilter} ${periodDateFilter}
      GROUP BY ji.company_id
    `).all(params);

    const revenueByCompany = companySeries.map(c => ({ company_name: c.company_name, color: c.color, total: c.revenue }));
    const expensesByCompany = companySeries.map(c => ({ company_name: c.company_name, color: c.color, total: c.expense }));

    // 5. Expenses by type
    const expensesByType = this.db.prepare(`
      SELECT ji.account_type, COALESCE(SUM(ji.debit - ji.credit), 0) as total
      FROM journal_items ji
      ${this._sectionJoin('ji', 'o')}
      WHERE ${this._sectionExpr('ji', 'o')} = 'expense'
        AND ji.move_state = 'posted'
        ${companyFilter} ${periodDateFilter}
      GROUP BY ji.account_type
    `).all(params);

    return {
      totalRevenue: revExp.totalRevenue,
      totalExpenses: revExp.totalExpenses,
      netProfit: revExp.totalRevenue - revExp.totalExpenses,
      totalAssets: bsKpis.totalAssets,
      totalLiabilities: bsKpis.totalLiabilities,
      cashPosition: bsKpis.cashPosition,
      guarantees: bsKpis.guarantees,
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
  getFilterOptions({ companyIds, scopedCostCenters }) {
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

    let costCenters = this.db.prepare(`
      SELECT DISTINCT ji.analytic_account FROM journal_items ji 
      ${companyFilter ? companyFilter + ' AND' : 'WHERE'} ji.analytic_account IS NOT NULL AND ji.analytic_account != ''
      ORDER BY ji.analytic_account
    `).all(params).map(r => r.analytic_account);

    const companyYearsRows = this.db.prepare(`
      SELECT DISTINCT ji.company_id, ji.fiscal_year 
      FROM journal_items ji 
      WHERE ji.fiscal_year IS NOT NULL AND ji.fiscal_year != ''
      ORDER BY ji.company_id, ji.fiscal_year
    `).all();

    let companyYears = {};
    for (const r of companyYearsRows) {
      const cid = String(r.company_id);
      if (!companyYears[cid]) companyYears[cid] = [];
      companyYears[cid].push(String(r.fiscal_year));
    }

    let groups = this.db.prepare(`
      SELECT id, name, color, sort_order 
      FROM analytic_groups 
      ORDER BY sort_order, name
    `).all();

    // UC1: Append unmapped cost centers with transactions as selectable groups
    const unmappedGroups = this._getUnmappedCostCenterGroups();
    for (const ug of unmappedGroups) {
      if (!groups.some(g => g.name === ug.name || g.id === ug.id)) {
        groups.push({
          id: ug.id,
          name: ug.name,
          color: ug.color,
          sort_order: ug.sort_order
        });
      }
    }

    let journalFilter = '';
    const jParams = {};
    if (companyIds && companyIds.length > 0) {
      journalFilter = `WHERE c.id IN (${companyIds.map((_, i) => `@cid${i}`).join(',')})`;
      companyIds.forEach((id, i) => { jParams[`cid${i}`] = id; });
    }

    const rawCostCenters = this.db.prepare(`
      SELECT 
        c.id as company_id,
        c.name as company_name,
        m.dominant_dept_id as group_id,
        ${this._groupNameSql('ag', 'id.cost_center_name')} as group_name,
        id.cost_center_key,
        id.cost_center_name,
        MIN(si.journal_id) as journal_id,
        GROUP_CONCAT(DISTINCT si.journal_id) as journal_ids,
        GROUP_CONCAT(DISTINCT COALESCE(NULLIF(TRIM(si.journal_name), ''), 'بدون دفتر')) as original_journals
      FROM sales_invoices si
      JOIN sales_companies sc ON sc.id = si.company_id
      JOIN companies c ON c.odoo_company_id = sc.sales_company_id
      JOIN invoice_departments id ON id.sales_invoice_id = si.id
      JOIN (
        SELECT id_sub.company_id, id_sub.cost_center_key, MAX(id_sub.department_id) as dominant_dept_id
        FROM invoice_departments id_sub
        GROUP BY id_sub.company_id, id_sub.cost_center_key
      ) m ON m.company_id = id.company_id AND m.cost_center_key = id.cost_center_key
      LEFT JOIN analytic_groups ag ON ag.id = m.dominant_dept_id
      ${journalFilter}
      GROUP BY c.id, id.cost_center_key, id.cost_center_name
      ORDER BY c.id, m.dominant_dept_id, id.cost_center_name
    `).all(jParams);

    let journals = rawCostCenters.map(r => {
      const cleanName = (r.cost_center_name || '').replace(/\s+/g, ' ').trim();
      const ccKey = r.cost_center_key || ('j:' + (r.journal_id || 0));
      const synthId = this._resolveGroupId(r.group_id, r.cost_center_key);
      return {
        id: `${r.company_id}|${ccKey}`,
        cost_center_key: r.cost_center_key,
        cost_center_name: cleanName,
        journal_id: r.journal_id,
        journal_ids: r.journal_ids,
        journal_name: cleanName,
        name: cleanName,
        company_id: r.company_id,
        company_name: r.company_name,
        group_id: synthId,
        group_name: r.group_name,
        original_journals: r.original_journals
      };
    });

    // UC1: Also include active cost centers from fact_daily if not present in journals
    const existingCcKeys = new Set(journals.map(j => `${j.company_id}|${j.cost_center_key}`));
    let fdJournalFilter = '';
    const fdJParams = {};
    if (companyIds && companyIds.length > 0) {
      fdJournalFilter = `WHERE fd.company_id IN (${companyIds.map((_, i) => `@fd_cid${i}`).join(',')}) AND fd.cost_center_key IS NOT NULL AND TRIM(fd.cost_center_key) != ''`;
      companyIds.forEach((id, i) => { fdJParams[`fd_cid${i}`] = id; });
    } else {
      fdJournalFilter = `WHERE fd.cost_center_key IS NOT NULL AND TRIM(fd.cost_center_key) != ''`;
    }

    const fdCostCenters = this.db.prepare(`
      SELECT 
        fd.company_id,
        COALESCE(c.name, 'شركة ' || fd.company_id) as company_name,
        fd.department_id as group_id,
        ${this._groupNameSql('ag', 'fd.cost_center_name')} as group_name,
        fd.cost_center_key,
        fd.cost_center_name,
        MIN(fd.journal_id) as journal_id,
        GROUP_CONCAT(DISTINCT fd.journal_id) as journal_ids,
        GROUP_CONCAT(DISTINCT COALESCE(NULLIF(TRIM(fd.journal_name), ''), 'بدون دفتر')) as original_journals
      FROM fact_daily fd
      LEFT JOIN companies c ON c.id = fd.company_id
      LEFT JOIN analytic_groups ag ON ag.id = fd.department_id
      ${fdJournalFilter}
      GROUP BY fd.company_id, fd.cost_center_key, fd.cost_center_name
      HAVING (SUM(fd.revenue) != 0 OR SUM(fd.expense) != 0)
    `).all(fdJParams);

    for (const r of fdCostCenters) {
      const ccKey = r.cost_center_key || ('j:' + (r.journal_id || 0));
      const pairKey = `${r.company_id}|${ccKey}`;
      if (!existingCcKeys.has(pairKey)) {
        existingCcKeys.add(pairKey);
        const cleanName = (r.cost_center_name || '').replace(/\s+/g, ' ').trim();
        const synthId = this._resolveGroupId(r.group_id, r.cost_center_key);
        journals.push({
          id: pairKey,
          cost_center_key: r.cost_center_key,
          cost_center_name: cleanName,
          journal_id: r.journal_id,
          journal_ids: r.journal_ids,
          journal_name: cleanName,
          name: cleanName,
          company_id: r.company_id,
          company_name: r.company_name,
          group_id: synthId,
          group_name: r.group_name,
          original_journals: r.original_journals
        });
      }
    }

    if (scopedCostCenters && Array.isArray(scopedCostCenters) && scopedCostCenters.length > 0) {
      const allowedPairs = new Set(scopedCostCenters.map(sc => `${sc.companyId}|${sc.costCenterKey}`));
      journals = journals.filter(j => allowedPairs.has(j.id) || allowedPairs.has(`${j.company_id}|${j.cost_center_key}`));
      for (const j of journals) {
        delete j.original_journals;
      }
      const allowedGroupIds = new Set(journals.map(j => j.group_id));
      groups = groups.filter(g => allowedGroupIds.has(g.id));
      costCenters = Array.from(new Set(journals.map(j => j.name || j.cost_center_name))).filter(Boolean);
      const allowedCids = new Set(scopedCostCenters.map(sc => String(sc.companyId)));
      const filteredCy = {};
      for (const [cid, yrs] of Object.entries(companyYears)) {
        if (allowedCids.has(cid)) filteredCy[cid] = yrs;
      }
      companyYears = filteredCy;
    }

    return { periods, fiscalYears, accountTypes, costCenters, companyYears, groups, journals };
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
        keyCol: "CASE WHEN fd.department_id > 0 THEN CAST(fd.department_id AS TEXT) ELSE 'cc:' || COALESCE(fd.cost_center_key, '') END",
        labelCol: this._groupNameSql('ag', 'fd.cost_center_name'),
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
        const cids = (Array.isArray(companyIds) ? companyIds : String(companyIds).split(',')).map(Number).filter(n => Number.isInteger(n) && !isNaN(n));
        if (cids.length > 0) {
          const cPh = cids.map((_, i) => `@fd_mat_c_${i}`).join(',');
          cids.forEach((c, i) => { params[`fd_mat_c_${i}`] = c; });
          whereClauses.push(`fd.company_id IN (${cPh})`);
        }
      }
      if (departmentIds) {
        const grpFilter = this._buildGroupCondition({ departmentIds, tableAlias: 'fd', prefix: 'fd_mat_d_' });
        if (grpFilter.sql) {
          whereClauses.push(grpFilter.sql.replace(/^\s*AND\s*/i, ''));
          Object.assign(params, grpFilter.params);
        }
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
        const cids = (Array.isArray(companyIds) ? companyIds : String(companyIds).split(',')).map(Number).filter(n => Number.isInteger(n) && !isNaN(n));
        if (cids.length > 0) {
          const cPh = cids.map((_, i) => `@fd_k_c_${i}`).join(',');
          cids.forEach((c, i) => { kParams[`fd_k_c_${i}`] = c; });
          kWhere.push(`fd.company_id IN (${cPh})`);
        }
      }
      if (departmentIds) {
        const grpFilter = this._buildGroupCondition({ departmentIds, tableAlias: 'fd', prefix: 'fd_k_d_' });
        if (grpFilter.sql) {
          kWhere.push(grpFilter.sql.replace(/^\s*AND\s*/i, ''));
          Object.assign(kParams, grpFilter.params);
        }
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
      asOfDate,
      scopedCostCenters
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
        const sPh = targetSalesCoIds.map((_, i) => `@rec_sc_${i}`).join(',');
        targetSalesCoIds.forEach((id, i) => { params[`rec_sc_${i}`] = id; });
        whereClause += ` AND si.company_id IN (${sPh})`;
      }
      if (departmentIds && departmentIds.length > 0) {
        const grpFilter = this._buildGroupCondition({ departmentIds, tableAlias: 'id', prefix: 'rec_d_' });
        if (grpFilter.sql) {
          whereClause += grpFilter.sql;
          Object.assign(params, grpFilter.params);
        }
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
      if (scopedCostCenters && Array.isArray(scopedCostCenters) && scopedCostCenters.length > 0) {
        const scopedCoMap = new Map();
        for (const sc of scopedCostCenters) {
          const cId = Number(sc.companyId);
          if (!scopedCoMap.has(cId)) scopedCoMap.set(cId, []);
          scopedCoMap.get(cId).push(sc.costCenterKey);
        }
        const scopeClauses = [];
        let sIdx = 0;
        for (const [cId, keys] of scopedCoMap.entries()) {
          const kPh = keys.map((_, i) => `@sc_aging_k_${sIdx}_${i}`).join(',');
          keys.forEach((k, i) => { params[`sc_aging_k_${sIdx}_${i}`] = k; });
          params[`sc_aging_cid_${sIdx}`] = cId;
          scopeClauses.push(`(c.id = @sc_aging_cid_${sIdx} AND id.cost_center_key IN (${kPh}))`);
          sIdx++;
        }
        if (scopeClauses.length > 0) {
          whereClause += ` AND (${scopeClauses.join(' OR ')})`;
        }
      }

      const rows = this.db.prepare(`
        SELECT 
          si.company_id as sales_company_id,
          c.id as company_id,
          c.name as company_name,
          id.department_id,
          id.cost_center_key,
          id.cost_center_name,
          ${this._groupNameSql('ag', 'id.cost_center_name')} as department_name,
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

        const did = this._resolveGroupId(r.department_id, r.cost_center_key);
        let dept = comp.departments.get(did);
        if (!dept) {
          dept = {
            id: did,
            name: r.department_name,
            buckets: { not_due: 0, b1_30: 0, b31_60: 0, b61_90: 0, b91_180: 0, b181_365: 0, over_365: 0 },
            total_residual: 0,
            total_billed: 0,
            total_collected: 0,
            partners: new Map()
          };
          comp.departments.set(did, dept);
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
        const sPh = targetSalesCoIds.map((_, i) => `@mat_sc_${i}`).join(',');
        targetSalesCoIds.forEach((id, i) => { params[`mat_sc_${i}`] = id; });
        whereClause += ` AND si.company_id IN (${sPh})`;
      }
      if (departmentIds && departmentIds.length > 0) {
        const grpFilter = this._buildGroupCondition({ departmentIds, tableAlias: 'id', prefix: 'mat_d_' });
        if (grpFilter.sql) {
          whereClause += grpFilter.sql;
          Object.assign(params, grpFilter.params);
        }
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
          id.cost_center_key,
          id.cost_center_name,
          ${this._groupNameSql('ag', 'id.cost_center_name')} as department_name,
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
      const sPh = targetSalesCoIds.map((_, i) => `@reg_sc_${i}`).join(',');
      targetSalesCoIds.forEach((id, i) => { params[`reg_sc_${i}`] = id; });
      whereClause += ` AND si.company_id IN (${sPh})`;
    }
    if (departmentIds && departmentIds.length > 0) {
      const grpFilter = this._buildGroupCondition({
        departmentIds,
        tableAlias: '_id',
        prefix: 'reg_d_',
        wrapExists: '_id.sales_invoice_id = si.id'
      });
      if (grpFilter.sql) {
        whereClause += grpFilter.sql;
        Object.assign(params, grpFilter.params);
      }
    }
    if (paymentState) {
      if (Array.isArray(paymentState)) {
        const psPh = paymentState.map((_, i) => `@reg_ps_${i}`).join(',');
        paymentState.forEach((s, i) => { params[`reg_ps_${i}`] = s; });
        whereClause += ` AND si.payment_state IN (${psPh})`;
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
        SELECT id.sales_invoice_id, id.department_id, id.cost_center_key, id.cost_center_name, id.share, ${this._groupNameSql('ag', 'id.cost_center_name')} as department_name
        FROM invoice_departments id
        LEFT JOIN analytic_groups ag ON ag.id = id.department_id
        WHERE id.sales_invoice_id IN (${invoiceIds.map(() => '?').join(',')})
      `).all(...invoiceIds);

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
  _getCompanyInfo(companyId, isSalesCompany = false) {
    if (!companyId) return null;
    const cacheKey = `${isSalesCompany ? 'sales:' : 'ledger:'}${companyId}`;
    if (!this._companyInfoCache) this._companyInfoCache = new Map();
    if (this._companyInfoCache.has(cacheKey)) {
      return this._companyInfoCache.get(cacheKey);
    }

    let row = null;
    if (isSalesCompany) {
      row = this.db.prepare(`
        SELECT 
          c.id as ledger_cid,
          c.odoo_instance_id as instance_id,
          c.odoo_company_id as odoo_company_id,
          sc.id as sales_cid
        FROM sales_companies sc
        JOIN companies c ON c.odoo_company_id = sc.sales_company_id
        WHERE sc.id = ?
        LIMIT 1
      `).get(companyId);
    } else {
      row = this.db.prepare(`
        SELECT 
          c.id as ledger_cid,
          c.odoo_instance_id as instance_id,
          c.odoo_company_id as odoo_company_id,
          sc.id as sales_cid
        FROM companies c
        LEFT JOIN sales_companies sc ON sc.sales_company_id = c.odoo_company_id
        WHERE c.id = ?
        LIMIT 1
      `).get(companyId);
    }

    // Fallback if not found by preferred type
    if (!row) {
      row = this.db.prepare(`
        SELECT 
          c.id as ledger_cid,
          c.odoo_instance_id as instance_id,
          c.odoo_company_id as odoo_company_id,
          sc.id as sales_cid
        FROM companies c
        LEFT JOIN sales_companies sc ON sc.sales_company_id = c.odoo_company_id
        WHERE c.id = ?
        LIMIT 1
      `).get(companyId) || this.db.prepare(`
        SELECT 
          c.id as ledger_cid,
          c.odoo_instance_id as instance_id,
          c.odoo_company_id as odoo_company_id,
          sc.id as sales_cid
        FROM sales_companies sc
        JOIN companies c ON c.odoo_company_id = sc.sales_company_id
        WHERE sc.id = ?
        LIMIT 1
      `).get(companyId);
    }

    this._companyInfoCache.set(cacheKey, row);
    return row;
  }

  _getCompanyInstanceId(companyId) {
    const info = this._getCompanyInfo(companyId);
    return info ? info.instance_id : null;
  }

  /**
   * M1: Unified Cost Center Resolver
   * Priority: Analytic Account on revenue lines -> fallback to Journal ID / Journal Name
   * Produces stable cost_center_key = an:<instance>:<analytic_id> when matched
   */
  resolveCostCenter({ companyId, analyticAccount, journalId, journalName, costCenterId }) {
    const compInfo = this._getCompanyInfo(companyId);
    const instanceId = compInfo ? compInfo.instance_id : null;
    const odooCompanyId = compInfo ? compInfo.odoo_company_id : null;
    let cleanAnalytic = (analyticAccount || '').replace(/\s+/g, ' ').trim();
    let cleanCostCenterId = costCenterId || null;

    if (!cleanAnalytic && !cleanCostCenterId && journalId && companyId) {
      try {
        const mapped = this.db.prepare(`
          SELECT analytic_account 
          FROM analytic_group_mapping 
          WHERE company_id = ? AND journal_id = ? AND analytic_account IS NOT NULL AND analytic_account != ''
          LIMIT 1
        `).get(companyId, journalId);
        if (mapped && mapped.analytic_account) {
          cleanAnalytic = mapped.analytic_account.replace(/\s+/g, ' ').trim();
        }
      } catch (e) {}
    }

    // Try resolving to stable odoo_analytic_accounts record
    if (instanceId) {
      let accRow = null;
      if (cleanCostCenterId) {
        accRow = this.db.prepare(`
          SELECT odoo_id, name 
          FROM odoo_analytic_accounts 
          WHERE instance_id = ? AND odoo_id = ?
        `).get(instanceId, cleanCostCenterId);
      }
      if (!accRow && cleanAnalytic) {
        accRow = this.db.prepare(`
          SELECT odoo_id, name 
          FROM odoo_analytic_accounts 
          WHERE instance_id = ? 
            AND (company_id IS NULL OR company_id = 0 OR company_id = ?)
            AND (name = ? OR REPLACE(name, '  ', ' ') = ?)
          ORDER BY CASE WHEN company_id = ? THEN 0 ELSE 1 END, odoo_id ASC
          LIMIT 1
        `).get(instanceId, odooCompanyId, cleanAnalytic, cleanAnalytic.replace(/\s+/g, ' '), odooCompanyId);
      }

      if (accRow) {
        return {
          key: `an:${instanceId}:${accRow.odoo_id}`,
          name: accRow.name,
          type: 'analytic',
          analytic_account: accRow.name,
          cost_center_id: accRow.odoo_id,
          instance_id: instanceId,
          journal_id: journalId || 0,
          journal_name: (journalName || '').trim()
        };
      }
    }

    if (cleanAnalytic) {
      return {
        key: instanceId ? `an:${instanceId}:${cleanAnalytic}` : `an:${cleanAnalytic}`,
        name: cleanAnalytic,
        type: 'analytic',
        analytic_account: cleanAnalytic,
        cost_center_id: cleanCostCenterId,
        instance_id: instanceId,
        journal_id: journalId || 0,
        journal_name: (journalName || '').trim()
      };
    }

    const cleanJName = (journalName || '').trim();
    const jId = journalId || 0;
    return {
      key: 'j:' + jId,
      name: cleanJName || (jId ? `دفتر ${jId}` : 'بدون دفتر'),
      type: 'journal',
      analytic_account: null,
      cost_center_id: null,
      instance_id: instanceId,
      journal_id: jId,
      journal_name: cleanJName || (jId ? `دفتر ${jId}` : 'بدون دفتر')
    };
  }

  /**
   * Resolve department attribution for all sales invoices based on rules:
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
      // S1: Map by journal_id first, fallback to journal_name
      const journalMap = {};
      this.db.prepare(`
        SELECT journal_id, journal_name, group_id 
        FROM analytic_group_mapping 
        WHERE company_id = ? AND ((journal_id IS NOT NULL AND journal_id > 0) OR (journal_name IS NOT NULL AND journal_name != ''))
        ORDER BY id ASC
      `).all(ledgerCid).forEach(r => {
        if (r.journal_id && journalMap['id:' + r.journal_id] === undefined) {
          journalMap['id:' + r.journal_id] = r.group_id;
        }
        const k = (r.journal_name || '').trim();
        if (k && journalMap[k] === undefined) journalMap[k] = r.group_id;
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
        SELECT ji.move_name, ji.analytic_account, ji.cost_center_id, ABS(ji.credit - ji.debit) as amt
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
          costCenterId: l.cost_center_id || null,
          amt: l.amt || 0
        });
      }

      // Delete existing allocations
      this.db.prepare(`
        DELETE FROM invoice_departments 
        WHERE sales_invoice_id IN (SELECT id FROM sales_invoices WHERE company_id = ?)
      `).run(scId);

      const insertDept = this.db.prepare(`
        INSERT OR REPLACE INTO invoice_departments (sales_invoice_id, department_id, share, odoo_invoice_id, company_id, cost_center_key, cost_center_name)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const invoices = this.db.prepare('SELECT id, invoice_id, name, journal_id, journal_name FROM sales_invoices WHERE company_id = ?').all(scId);

      const insertAll = this.db.transaction(() => {
        for (const inv of invoices) {
          let deptShares = [];

          // Rule 1: Analytic account from income lines (proportional)
          const lines = incomeByMove[inv.name];
          if (lines && lines.length > 0) {
            const groupAmounts = {};
            let totalMappedAmt = 0;
            for (const line of lines) {
              const cleanAnalytic = (line.analytic || '').trim();
              if (cleanAnalytic && analyticMap[cleanAnalytic] !== undefined) {
                const cc = this.resolveCostCenter({
                  companyId: ledgerCid,
                  analyticAccount: cleanAnalytic,
                  costCenterId: line.costCenterId,
                  journalId: inv.journal_id,
                  journalName: inv.journal_name
                });
                const gid = analyticMap[cleanAnalytic];
                const compKey = `${gid}:::${cc.key}:::${cc.name}`;
                groupAmounts[compKey] = (groupAmounts[compKey] || 0) + line.amt;
                totalMappedAmt += line.amt;
              }
            }

            if (totalMappedAmt > 0) {
              deptShares = Object.entries(groupAmounts).map(([compKey, amt]) => {
                const [gidStr, ccKey, ccName] = compKey.split(':::');
                return {
                  deptId: parseInt(gidStr, 10) || 0,
                  costCenterKey: ccKey,
                  costCenterName: ccName,
                  share: Math.round((amt / totalMappedAmt) * 10000) / 10000
                };
              });
              const sSum = deptShares.reduce((s, d) => s + d.share, 0);
              if (deptShares.length > 0 && Math.abs(sSum - 1.0) > 0.00001) {
                deptShares[0].share = Math.round((deptShares[0].share + (1.0 - sSum)) * 10000) / 10000;
              }
            } else if (Object.keys(groupAmounts).length > 0) {
              const entries = Object.keys(groupAmounts);
              const equalShare = Math.round((1.0 / entries.length) * 10000) / 10000;
              deptShares = entries.map((compKey, idx) => {
                const [gidStr, ccKey, ccName] = compKey.split(':::');
                return {
                  deptId: parseInt(gidStr, 10) || 0,
                  costCenterKey: ccKey,
                  costCenterName: ccName,
                  share: idx === 0 ? Math.round((1.0 - equalShare * (entries.length - 1)) * 10000) / 10000 : equalShare
                };
              });
            }
          }

          // Rule 2: Journal ID first, then journal name fallback
          if (deptShares.length === 0) {
            let matchedGid = undefined;
            if (inv.journal_id && journalMap['id:' + inv.journal_id] !== undefined) {
              matchedGid = journalMap['id:' + inv.journal_id];
            } else {
              const jname = (inv.journal_name || '').trim();
              if (jname && journalMap[jname] !== undefined) {
                matchedGid = journalMap[jname];
              }
            }
            const cc = this.resolveCostCenter({
              companyId: ledgerCid,
              analyticAccount: lines && lines[0] && lines[0].analytic ? lines[0].analytic : null,
              costCenterId: lines && lines[0] && lines[0].costCenterId ? lines[0].costCenterId : null,
              journalId: inv.journal_id,
              journalName: inv.journal_name
            });
            if (matchedGid === undefined && cc.key && cc.key.startsWith('an:')) {
              const cleanAnalytic = (cc.name || '').trim();
              if (cleanAnalytic && analyticMap[cleanAnalytic] !== undefined) {
                matchedGid = analyticMap[cleanAnalytic];
              }
            }
            deptShares = [{
              deptId: matchedGid !== undefined ? matchedGid : 0,
              costCenterKey: cc.key,
              costCenterName: cc.name,
              share: 1.0
            }];
          }

          for (const ds of deptShares) {
            insertDept.run(inv.id, ds.deptId, ds.share, inv.invoice_id || 0, scId, ds.costCenterKey, ds.costCenterName);
            totalAllocations++;
          }
        }
      });

      insertAll();

      // Rule 3: Post-allocation reconciliation - ensure cost centers inherit their dominant department
      // if any invoice ended up with department_id = 0 while the cost center has mapped department > 0
      this.db.prepare(`
        UPDATE invoice_departments
        SET department_id = (
          SELECT MAX(id2.department_id)
          FROM invoice_departments id2
          WHERE id2.company_id = invoice_departments.company_id
            AND (id2.cost_center_key = invoice_departments.cost_center_key OR id2.cost_center_name = invoice_departments.cost_center_name)
            AND id2.department_id > 0
        )
        WHERE company_id = ?
          AND department_id = 0
          AND (
            cost_center_key IN (
              SELECT cost_center_key
              FROM invoice_departments
              WHERE company_id = ? AND department_id > 0
            )
            OR cost_center_name IN (
              SELECT cost_center_name
              FROM invoice_departments
              WHERE company_id = ? AND department_id > 0
            )
          )
      `).run(scId, scId, scId);
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
        SELECT journal_id, journal_name, group_id, ag.name as group_name
        FROM analytic_group_mapping agm
        JOIN analytic_groups ag ON ag.id = agm.group_id
        WHERE company_id = ? AND ((journal_id IS NOT NULL AND journal_id > 0) OR (journal_name IS NOT NULL AND journal_name != ''))
        ORDER BY agm.id ASC
      `).all(c.ledger_cid).forEach(r => {
        if (r.journal_id && journalMap['id:' + r.journal_id] === undefined) {
          journalMap['id:' + r.journal_id] = { id: r.group_id, name: r.group_name };
        }
        const k = (r.journal_name || '').trim();
        if (k && journalMap[k] === undefined) journalMap[k] = { id: r.group_id, name: r.group_name };
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
        SELECT id, name, journal_id, journal_name, date, partner_name, amount_total, amount_untaxed, amount_residual_signed
        FROM sales_invoices
        WHERE company_id = ?
      `).all(c.sales_cid);

      for (const inv of invoices) {
        const jname = (inv.journal_name || '').trim();
        let journalDept = null;
        if (inv.journal_id && journalMap['id:' + inv.journal_id]) {
          journalDept = journalMap['id:' + inv.journal_id];
        } else if (jname && journalMap[jname]) {
          journalDept = journalMap[jname];
        }

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
   * M1: Unified bidirectional cost center & journal condition across all reports
   * Supports tableAlias:
   *  'fd' (fact_daily: journal_id, analytic_account, journal_name)
   *  'si' (sales_invoices / invoice_departments: si.journal_id, id.cost_center_key, id.cost_center_name)
   *  'pa' (payment_allocations: pa.invoice_journal_id, pa.cost_center_key, pa.cost_center_name, pa.invoice_journal_name)
   *  'id' (invoice_departments: id.cost_center_key, id.cost_center_name)
   */
  _getSalesCid(ledgerCid) {
    if (!this._ledgerToSalesMap) {
      this._ledgerToSalesMap = {};
      const rows = this.db.prepare(`
        SELECT c.id as ledger_cid, sc.id as sales_cid
        FROM companies c
        JOIN sales_companies sc ON sc.sales_company_id = c.odoo_company_id
      `).all();
      for (const r of rows) {
        this._ledgerToSalesMap[r.ledger_cid] = r.sales_cid;
      }
    }
    return this._ledgerToSalesMap[ledgerCid] || ledgerCid;
  }

  /**
   * UC1: Central SQL expression for group/department name.
   * Falls back to cost center name if group name is null/empty.
   */
  _groupNameSql(groupAlias = 'ag', ccNameCol = 'fd.cost_center_name') {
    return `COALESCE(NULLIF(TRIM(${groupAlias}.name), ''), NULLIF(TRIM(${ccNameCol}), ''), 'غير مصنّف')`;
  }

  /**
   * UC1: Deterministic positive integer ID derived from cost center key.
   * Range: 100000 - 999999 (distinguishable from normal group IDs 1..1000).
   */
  _deriveSyntheticGroupId(costCenterKey) {
    if (!costCenterKey) return 0;
    let hash = 0;
    const str = String(costCenterKey).trim();
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return 100000 + (Math.abs(hash) % 900000);
  }

  /**
   * UC1: Resolve group ID: returns real group ID if > 0, otherwise synthetic ID from cost center key.
   */
  _resolveGroupId(deptId, costCenterKey) {
    const n = Number(deptId);
    if (Number.isInteger(n) && n > 0) return n;
    return this._deriveSyntheticGroupId(costCenterKey);
  }

  /**
   * UC1: Returns map of synthetic group IDs to cost center metadata, and reverse map.
   */
  _getSyntheticGroupRegistry() {
    if (!this._syntheticGroupReg) {
      const rows = this.db.prepare(`
        SELECT DISTINCT cost_center_key, cost_center_name 
        FROM fact_daily 
        WHERE (department_id = 0 OR department_id IS NULL)
          AND cost_center_key IS NOT NULL 
          AND TRIM(cost_center_key) != ''
        UNION
        SELECT DISTINCT cost_center_key, cost_center_name 
        FROM invoice_departments 
        WHERE (department_id = 0 OR department_id IS NULL)
          AND cost_center_key IS NOT NULL 
          AND TRIM(cost_center_key) != ''
        UNION
        SELECT DISTINCT cost_center_key, cost_center_name 
        FROM payment_allocations 
        WHERE (department_id = 0 OR department_id IS NULL)
          AND cost_center_key IS NOT NULL 
          AND TRIM(cost_center_key) != ''
      `).all();

      const idToMeta = new Map();
      const keyToId = new Map();
      for (const r of rows) {
        const key = (r.cost_center_key || '').trim();
        const name = (r.cost_center_name || '').trim();
        if (!key) continue;
        const synthId = this._deriveSyntheticGroupId(key);
        idToMeta.set(synthId, { id: synthId, key, name });
        keyToId.set(key, synthId);
      }
      this._syntheticGroupReg = { idToMeta, keyToId };
    }
    return this._syntheticGroupReg;
  }

  /**
   * UC1: Returns unmapped cost centers formatted as standalone groups for slicers/filters.
   */
  _getUnmappedCostCenterGroups() {
    const rows = this.db.prepare(`
      SELECT DISTINCT cost_center_key, cost_center_name, SUM(revenue) as rev, SUM(expense) as exp
      FROM fact_daily
      WHERE (department_id = 0 OR department_id IS NULL)
        AND cost_center_name IS NOT NULL
        AND TRIM(cost_center_name) != ''
      GROUP BY cost_center_key, cost_center_name
      HAVING rev != 0 OR exp != 0
    `).all();

    const groups = [];
    for (const r of rows) {
      const key = r.cost_center_key.trim();
      const name = (r.cost_center_name || '').trim();
      const synthId = this._deriveSyntheticGroupId(key);
      groups.push({
        id: synthId,
        name: name,
        cost_center_key: key,
        color: 'var(--status-warning)',
        sort_order: 999
      });
    }
    return groups;
  }

  /**
   * UC1: Centralized department / group condition builder.
   * Handles both real group IDs (department_id IN (...)) and synthetic IDs (cost_center_key = ...).
   */
  _buildGroupCondition({ departmentIds, tableAlias = 'fd', prefix = 'grp_', wrapExists = null } = {}) {
    if (!departmentIds || departmentIds.length === 0) return { sql: '', params: {} };
    const dArr = (Array.isArray(departmentIds) ? departmentIds : String(departmentIds).split(','))
      .map(Number)
      .filter(n => Number.isInteger(n) && !isNaN(n));
    if (dArr.length === 0) return { sql: '', params: {} };

    const reg = this._getSyntheticGroupRegistry();
    const realIds = [];
    const synthMetas = [];

    for (const id of dArr) {
      if (reg.idToMeta.has(id)) {
        synthMetas.push(reg.idToMeta.get(id));
      } else if (id > 0) {
        realIds.push(id);
      }
    }

    const orParts = [];
    const params = {};

    if (realIds.length > 0) {
      const ph = realIds.map((_, i) => `@${prefix}r_${i}`).join(',');
      realIds.forEach((id, i) => { params[`${prefix}r_${i}`] = id; });
      if (wrapExists) {
        orParts.push(`EXISTS (SELECT 1 FROM invoice_departments _id WHERE ${wrapExists} AND _id.department_id IN (${ph}))`);
      } else {
        orParts.push(`${tableAlias}.department_id IN (${ph})`);
      }
    }

    if (synthMetas.length > 0) {
      synthMetas.forEach((meta, i) => {
        const kParam = `${prefix}k_${i}`;
        const nParam = `${prefix}n_${i}`;
        params[kParam] = meta.key;
        params[nParam] = meta.name;
        if (wrapExists) {
          orParts.push(`EXISTS (SELECT 1 FROM invoice_departments _id WHERE ${wrapExists} AND (_id.cost_center_key = @${kParam} OR _id.cost_center_name = @${nParam}))`);
        } else {
          orParts.push(`(${tableAlias}.cost_center_key = @${kParam} OR ${tableAlias}.cost_center_name = @${nParam})`);
        }
      });
    }

    if (orParts.length === 0) return { sql: '', params: {} };
    const sql = orParts.length === 1 ? ` AND ${orParts[0]}` : ` AND (${orParts.join(' OR ')})`;
    return { sql, params };
  }

  /**
   * Enforces pair identity: (company_id, cost_center_key)
   * Supports tableAlias:
   *  'fd' (fact_daily: fd.company_id, fd.cost_center_key)
   *  'si' (sales_invoices / invoice_departments: si.company_id, id.cost_center_key)
   *  'pa' (payment_allocations: pa.company_id, pa.cost_center_key)
   *  'id' (invoice_departments: id.company_id, id.cost_center_key)
   */
  _buildCostCenterCondition({ journalIds, costCenters, tableAlias = 'fd', prefix = 'jCC_', companyIds } = {}) {
    let sql = '';
    const params = {};
    const pairs = [];
    const namesSet = new Set();
    const ccKeySet = new Set();

    const addCostCenter = (val) => {
      if (val === null || val === undefined) return;
      const s = String(val).trim();
      if (!s || s === 'NaN' || s === 'null' || s === 'undefined') return;

      if (s.includes('|')) {
        const pipeIdx = s.indexOf('|');
        const coId = parseInt(s.slice(0, pipeIdx), 10);
        const ccKey = s.slice(pipeIdx + 1).trim();
        if (coId > 0 && ccKey) {
          pairs.push({ companyId: coId, costCenterKey: ccKey });
          ccKeySet.add(ccKey);
          if (ccKey.startsWith('an:')) namesSet.add(ccKey.slice(3).trim());
          else if (ccKey.startsWith('j:')) namesSet.add(ccKey.slice(2).trim());
        }
      } else {
        let bareKey = s;
        if (s.startsWith('an:') || s.startsWith('j:')) {
          bareKey = s;
        } else if (!isNaN(Number(s)) && Number(s) > 0 && !s.includes(' ')) {
          bareKey = 'j:' + Number(s);
        } else {
          bareKey = 'an:' + s;
        }
        ccKeySet.add(bareKey);
        if (bareKey.startsWith('an:')) namesSet.add(bareKey.slice(3).trim());
        else if (bareKey.startsWith('j:')) namesSet.add(bareKey.slice(2).trim());

        if (companyIds && companyIds.length > 0) {
          const cList = (Array.isArray(companyIds) ? companyIds : [companyIds]).map(Number).filter(n => Number.isInteger(n) && n > 0);
          for (const cid of cList) {
            pairs.push({ companyId: cid, costCenterKey: bareKey });
          }
        } else {
          pairs.push({ companyId: null, costCenterKey: bareKey });
        }
      }
    };

    if (costCenters && costCenters.length > 0) {
      const ccArr = Array.isArray(costCenters) ? costCenters : String(costCenters).split(',');
      ccArr.forEach(addCostCenter);
    }

    if (journalIds && journalIds.length > 0) {
      const jArr = Array.isArray(journalIds) ? journalIds : String(journalIds).split(',');
      jArr.forEach(addCostCenter);
    }

    const subConds = [];

    if (pairs.length > 0) {
      pairs.forEach((pair, i) => {
        const kParam = `${prefix}k_${i}`;
        params[kParam] = pair.costCenterKey;

        // Resolve dual matching (stable key, legacy name key, and display name)
        let altKey = null;
        let altName = null;
        if (pair.costCenterKey.startsWith('an:')) {
          const sub = pair.costCenterKey.slice(3).trim();
          const coId = pair.companyId;
          const compInfo = coId ? this._getCompanyInfo(coId) : null;
          const instId = compInfo ? compInfo.instance_id : null;
          const odooCompanyId = compInfo ? compInfo.odoo_company_id : null;

          if (/^\d+:\d+$/.test(sub)) {
            // sub is "instanceId:odooId", e.g. "7:27"
            const [iId, oId] = sub.split(':').map(Number);
            const row = this.db.prepare('SELECT name FROM odoo_analytic_accounts WHERE instance_id = ? AND odoo_id = ?').get(iId, oId);
            if (row) {
              altName = row.name;
              altKey = 'an:' + row.name;
            }
          } else {
            // sub is text name, e.g. "مختبر جدة"
            altName = sub;
            if (instId) {
              const row = this.db.prepare(`
                SELECT odoo_id, name 
                FROM odoo_analytic_accounts 
                WHERE instance_id = ? 
                  AND (company_id IS NULL OR company_id = 0 OR company_id = ?)
                  AND (name = ? OR REPLACE(name, '  ', ' ') = ?)
                ORDER BY CASE WHEN company_id = ? THEN 0 ELSE 1 END, odoo_id ASC
                LIMIT 1
              `).get(instId, odooCompanyId, sub, sub.replace(/\s+/g, ' '), odooCompanyId);
              if (row) {
                altKey = `an:${instId}:${row.odoo_id}`;
                altName = row.name;
              }
            } else {
              const row = this.db.prepare(`SELECT instance_id, odoo_id, name FROM odoo_analytic_accounts WHERE name = ? OR REPLACE(name, '  ', ' ') = ? LIMIT 1`).get(sub, sub.replace(/\s+/g, ' '));
              if (row) {
                altKey = `an:${row.instance_id}:${row.odoo_id}`;
                altName = row.name;
              }
            }
          }
        }

        if (altKey) ccKeySet.add(altKey);
        if (altName) namesSet.add(altName);

        // Determine column names based on tableAlias
        let ccCol = 'id.cost_center_key';
        let nameCol = 'id.cost_center_name';
        let coCol = 'id.company_id';
        let cidVal = pair.companyId;

        if (tableAlias === 'fd') {
          ccCol = 'fd.cost_center_key';
          nameCol = 'fd.cost_center_name';
          coCol = 'fd.company_id';
        } else if (tableAlias === 'pa') {
          ccCol = 'pa.cost_center_key';
          nameCol = 'pa.cost_center_name';
          coCol = 'pa.company_id';
        } else if (tableAlias === 'si') {
          ccCol = 'id.cost_center_key';
          nameCol = 'id.cost_center_name';
          coCol = 'si.company_id';
          if (pair.companyId) cidVal = this._getSalesCid(pair.companyId);
        } else if (tableAlias === 'id') {
          ccCol = 'id.cost_center_key';
          nameCol = 'id.cost_center_name';
          coCol = 'id.company_id';
          if (pair.companyId) cidVal = this._getSalesCid(pair.companyId);
        }

        const matchClauses = [`${ccCol} = @${kParam}`];
        if (altKey && altKey !== pair.costCenterKey) {
          const altParam = `${prefix}alt_${i}`;
          params[altParam] = altKey;
          matchClauses.push(`${ccCol} = @${altParam}`);
        }
        if (altName) {
          const nameParam = `${prefix}n_${i}`;
          params[nameParam] = altName;
          matchClauses.push(`${nameCol} = @${nameParam}`);
        }
        const matchExpr = matchClauses.length > 1 ? `(${matchClauses.join(' OR ')})` : matchClauses[0];

        if (cidVal) {
          const cParam = `${prefix}c_${i}`;
          params[cParam] = cidVal;
          subConds.push(`(${coCol} = @${cParam} AND ${matchExpr})`);
        } else {
          subConds.push(`(${matchExpr})`);
        }
      });
    }

    if (subConds.length > 0) {
      sql = ` AND (${subConds.join(' OR ')})`;
    }

    return { 
      sql, 
      params, 
      names: Array.from(namesSet), 
      costCenterKeys: Array.from(ccKeySet), 
      pairs 
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
  getExecutiveSummary({ companyIds, years, year, dateFrom, dateTo, asOfDate, fullTree = false, includeAging = false, departmentIds, journalIds, costCenters, scopedCostCenters }) {
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

    // fdWhere for fact_daily queries
    const fdParams = {};
    const lPh = targetLedgerIds.map((_, i) => `@exec_lc_${i}`).join(',');
    targetLedgerIds.forEach((id, i) => { fdParams[`exec_lc_${i}`] = id; });
    let fdWhere = `WHERE fd.company_id IN (${lPh})`;

    if (period.sql !== '1=1') {
      const fdPeriod = this._periodFilter({ years: period.yearsList, dateFrom: period.dateFrom, dateTo: period.dateTo }, 'fd.date', 'fd_');
      if (fdPeriod.sql !== '1=1') {
        fdWhere += ` AND ${fdPeriod.sql}`;
        Object.assign(fdParams, fdPeriod.params);
      }
    }

    if (departmentIds && departmentIds.length > 0) {
      const grpFilter = this._buildGroupCondition({ departmentIds, tableAlias: 'fd', prefix: 'exec_d_' });
      if (grpFilter.sql) {
        fdWhere += grpFilter.sql;
        Object.assign(fdParams, grpFilter.params);
      }
    }

    const ccFilter = this._buildCostCenterCondition({ journalIds, costCenters, tableAlias: 'fd', prefix: 'fdCC_' });
    if (ccFilter.sql) {
      fdWhere += ccFilter.sql;
      Object.assign(fdParams, ccFilter.params);
    }

    // 1. Cards P&L directly from fact_daily (ultra-fast O(1) indexed query vs full income statement tree)
    const pnlRow = this.db.prepare(`
      SELECT 
        COALESCE(SUM(fd.revenue), 0) as rawRev,
        COALESCE(SUM(fd.expense), 0) as rawExp
      FROM fact_daily fd
      ${fdWhere}
    `).get(fdParams);
    const rawRev = pnlRow ? pnlRow.rawRev : 0;
    const rawExp = pnlRow ? pnlRow.rawExp : 0;
    const revenue = Math.round(rawRev);
    const expenses = Math.round(rawExp);
    const net_profit = revenue - expenses;
    const margin = revenue > 0 ? Math.round((net_profit / revenue) * 1000) / 10 : 0;


    // 2. Invoices & Untaxed Collection
    const invParams = {};
    const sPh = targetSalesIds.map((_, i) => `@exec_sc_${i}`).join(',');
    targetSalesIds.forEach((id, i) => { invParams[`exec_sc_${i}`] = id; });
    let invWhere = `WHERE si.company_id IN (${sPh})`;

    if (period.sql !== '1=1') {
      invWhere += ` AND ${period.sql}`;
      Object.assign(invParams, period.params);
    }
    if (departmentIds && departmentIds.length > 0) {
      const grpFilterInv = this._buildGroupCondition({ departmentIds, tableAlias: 'id', prefix: 'exec_d_inv_' });
      if (grpFilterInv.sql) {
        invWhere += grpFilterInv.sql;
        Object.assign(invParams, grpFilterInv.params);
      }
    }
    if ((journalIds && journalIds.length > 0) || (costCenters && costCenters.length > 0)) {
      const ccFilterInv = this._buildCostCenterCondition({ journalIds, costCenters, tableAlias: 'si', prefix: 'execInvCC_' });
      if (ccFilterInv.sql) {
        invWhere += ccFilterInv.sql;
        Object.assign(invParams, ccFilterInv.params);
      }
    }

    let rawBilled = 0;
    let rawCollected = 0;
    let rawResidual = 0;
    let rawOverdue90 = 0;

    // Map: ledger_cid -> dept_id -> partner_id -> clientData
    const invMap = new Map();

    if (!fullTree) {
      const aggRows = this.db.prepare(`
        SELECT 
          c.id as ledger_cid,
          id.department_id,
          id.cost_center_key,
          id.cost_center_name,
          ${this._groupNameSql('ag', 'id.cost_center_name')} as department_name,
          COUNT(DISTINCT si.partner_id) as client_count,
          SUM(si.amount_untaxed * id.share) as billed,
          SUM(CASE WHEN si.amount_total != 0 THEN (si.amount_untaxed * (si.amount_total - si.amount_residual_signed) / si.amount_total) * id.share ELSE 0 END) as collected,
          SUM(si.amount_residual_signed * id.share) as residual,
          SUM(CASE WHEN si.amount_residual_signed > 0 AND CAST(julianday(@refDate) - julianday(COALESCE(NULLIF(si.invoice_date_due, ''), si.date)) AS INTEGER) > 90 THEN si.amount_residual_signed * id.share ELSE 0 END) as overdue_90
        FROM sales_invoices si
        JOIN sales_companies sc ON sc.id = si.company_id
        JOIN companies c ON c.odoo_company_id = sc.sales_company_id
        JOIN invoice_departments id ON id.sales_invoice_id = si.id
        LEFT JOIN analytic_groups ag ON ag.id = id.department_id
        ${invWhere}
        GROUP BY c.id, id.department_id, (CASE WHEN id.department_id > 0 THEN '' ELSE id.cost_center_key END)
      `).all({ ...invParams, refDate });

      for (const r of aggRows) {
        const billed = r.billed || 0;
        const collected = r.collected || 0;
        const residual = r.residual || 0;
        const overdue90 = r.overdue_90 || 0;

        rawBilled += billed;
        rawCollected += collected;
        rawResidual += residual;
        rawOverdue90 += overdue90;

        const lCid = r.ledger_cid;
        if (!invMap.has(lCid)) invMap.set(lCid, new Map());
        const dMap = invMap.get(lCid);

        const dId = this._resolveGroupId(r.department_id, r.cost_center_key);
        dMap.set(dId, {
          dept_id: dId,
          dept_name: r.department_name,
          billed,
          collected,
          residual,
          client_count: r.client_count || 0
        });
      }
    } else {
      const invList = this.db.prepare(`
        SELECT 
          si.id,
          si.name as invoice_name,
          si.company_id as sales_cid,
          c.id as ledger_cid,
          c.name as company_name,
          id.department_id,
          id.cost_center_key,
          id.cost_center_name,
          ${this._groupNameSql('ag', 'id.cost_center_name')} as department_name,
          si.partner_id,
          COALESCE(NULLIF(TRIM(si.partner_name), ''), 'بدون عميل') as partner_name,
          si.amount_untaxed,
          si.journal_id,
          COALESCE(NULLIF(TRIM(si.journal_name), ''), 'بدون دفتر') as journal_name,
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

        const dId = this._resolveGroupId(inv.department_id, inv.cost_center_key);
        if (!dMap.has(dId)) {
          dMap.set(dId, {
            dept_id: dId,
            dept_name: inv.department_name,
            billed: 0,
            collected: 0,
            residual: 0,
            clients: new Map(),
            journals: new Map()
          });
        }
        const dData = dMap.get(dId);
        dData.billed += billed;
        dData.collected += collected;
        dData.residual += residual;

        // Journal level mapping
        const jId = inv.journal_id !== null && inv.journal_id !== undefined ? inv.journal_id : 0;
        const jName = (inv.journal_name || '').trim() || 'بدون دفتر';
        if (!dData.journals.has(jId)) {
          dData.journals.set(jId, {
            journal_id: jId,
            name: jName,
            billed: 0,
            collected: 0,
            residual: 0,
            clients: new Map()
          });
        }
        const jData = dData.journals.get(jId);
        jData.billed += billed;
        jData.collected += collected;
        jData.residual += residual;

        const pKey = inv.partner_id || inv.partner_name;
        if (!jData.clients.has(pKey)) {
          jData.clients.set(pKey, {
            partner_id: inv.partner_id,
            name: inv.partner_name,
            billed: 0,
            collected: 0,
            residual: 0,
            invoices: []
          });
        }
        const jcData = jData.clients.get(pKey);
        jcData.billed += billed;
        jcData.collected += collected;
        jcData.residual += residual;

        const invItem = {
          id: inv.id,
          name: inv.invoice_name,
          date: inv.invoice_date,
          due_date: inv.due_date,
          amount_untaxed: inv.amount_untaxed,
          amount_total: inv.amount_total,
          amount_residual: inv.amount_residual_signed,
          payment_state: inv.payment_state,
          age_days: inv.age_days
        };
        jcData.invoices.push(invItem);

        // Keep flat client map for backward compatibility
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
        cData.invoices.push(invItem);
      }
    }

    const billed_period_untaxed = Math.round(rawBilled);
    const collected_period_untaxed = Math.round(rawCollected);
    const collection_rate_untaxed = billed_period_untaxed > 0 ? Math.round((collected_period_untaxed / billed_period_untaxed) * 1000) / 10 : 0;
    const residual_period = Math.round(Math.round(rawResidual * 100) / 100);
    const overdue_90 = Math.round(Math.round(rawOverdue90 * 100) / 100);

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
          ROUND(SUM(fd.expense), 2) as exp
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
          ROUND(SUM(fd.expense), 2) as exp
        FROM fact_daily fd
        ${fdWhere}
        GROUP BY fd.month
        ORDER BY fd.month ASC
      `).all(fdParams);
    }

    // Calculate monthly/yearly collections from payment_allocations (channels bank, sister_company, other_adjustment)
    let paTargetLedgerIds = [...targetLedgerIds];
    const explicitCoIds = [];
    if ((journalIds && journalIds.length > 0) || (costCenters && costCenters.length > 0)) {
      const chkFilter = this._buildCostCenterCondition({ journalIds, costCenters, tableAlias: 'dummy', prefix: 'chk_pa_' });
      if (chkFilter.pairs && chkFilter.pairs.length > 0) {
        for (const p of chkFilter.pairs) {
          if (p.companyId && !explicitCoIds.includes(p.companyId)) {
            explicitCoIds.push(p.companyId);
          }
        }
      }
    }
    if (explicitCoIds.length > 0) {
      paTargetLedgerIds = paTargetLedgerIds.filter(id => explicitCoIds.includes(id));
      if (paTargetLedgerIds.length === 0) paTargetLedgerIds = explicitCoIds;
    }
    if (scopedCostCenters && Array.isArray(scopedCostCenters) && scopedCostCenters.length > 0) {
      const scopedCids = Array.from(new Set(scopedCostCenters.map(sc => Number(sc.companyId)))).filter(Boolean);
      paTargetLedgerIds = paTargetLedgerIds.filter(id => scopedCids.includes(id));
      if (paTargetLedgerIds.length === 0) paTargetLedgerIds = scopedCids;
    }

    const paParams = {};
    const paCoPh = paTargetLedgerIds.map((_, i) => `@pa_m_cid_${i}`).join(',');
    paTargetLedgerIds.forEach((id, i) => { paParams[`pa_m_cid_${i}`] = id; });
    const paWhereClauses = [`pa.company_id IN (${paCoPh})`];

    const paPeriod = this._periodFilter({ years: period.yearsList, year: period.year, dateFrom: period.dateFrom, dateTo: period.dateTo }, 'pa.payment_date', 'pa_m_dt_');
    if (paPeriod.sql !== '1=1') {
      paWhereClauses.push(paPeriod.sql);
      Object.assign(paParams, paPeriod.params);
    }

    if (departmentIds && departmentIds.length > 0) {
      const grpFilter = this._buildGroupCondition({ departmentIds, tableAlias: 'pa', prefix: 'pa_m_dept_' });
      if (grpFilter.sql) {
        paWhereClauses.push(grpFilter.sql.replace(/^\s*AND\s*/i, ''));
        Object.assign(paParams, grpFilter.params);
      }
    }

    if ((journalIds && journalIds.length > 0) || (costCenters && costCenters.length > 0)) {
      const ccFilterPa = this._buildCostCenterCondition({ journalIds, costCenters, tableAlias: 'pa', prefix: 'pa_m_cc_' });
      if (ccFilterPa.sql) {
        paWhereClauses.push(ccFilterPa.sql.replace(/^\s*AND\s*/i, ''));
        Object.assign(paParams, ccFilterPa.params);
      }
    } else if (scopedCostCenters && Array.isArray(scopedCostCenters) && scopedCostCenters.length > 0) {
      const sMap = new Map();
      for (const sc of scopedCostCenters) {
        const cId = Number(sc.companyId);
        if (!sMap.has(cId)) sMap.set(cId, []);
        sMap.get(cId).push(sc.costCenterKey);
      }
      const sClauses = [];
      let sIdx = 0;
      for (const [cId, keys] of sMap.entries()) {
        const kPh = keys.map((_, i) => `@pa_m_sc_${sIdx}_${i}`).join(',');
        keys.forEach((k, i) => { paParams[`pa_m_sc_${sIdx}_${i}`] = k; });
        paParams[`pa_m_sc_cid_${sIdx}`] = cId;
        sClauses.push(`(pa.company_id = @pa_m_sc_cid_${sIdx} AND pa.cost_center_key IN (${kPh}))`);
        sIdx++;
      }
      if (sClauses.length > 0) {
        paWhereClauses.push(`(${sClauses.join(' OR ')})`);
      }
    }

    paWhereClauses.push(`pa.channel IN ('bank', 'sister_company', 'other_adjustment')`);
    const paWhereSql = `WHERE ${paWhereClauses.join(' AND ')}`;

    const paGrainCol = isMultiYear ? 'pa.payment_year' : 'pa.payment_month';
    const paRows = this.db.prepare(`
      SELECT 
        ${paGrainCol} as grain_key,
        ROUND(SUM(pa.amount), 2) as col
      FROM payment_allocations pa
      ${paWhereSql}
      GROUP BY ${paGrainCol}
      ORDER BY ${paGrainCol} ASC
    `).all(paParams);

    const paMap = new Map();
    let totalPaCol = 0;
    for (const r of paRows) {
      if (r.grain_key) {
        paMap.set(r.grain_key, r.col || 0);
        totalPaCol += (r.col || 0);
      }
    }

    const allGrainKeysSet = new Set(monthlyRows.map(r => r.grain_key));
    for (const k of paMap.keys()) {
      allGrainKeysSet.add(k);
    }
    const allGrainKeys = Array.from(allGrainKeysSet).sort();

    const monthlyRowMap = new Map();
    for (const r of monthlyRows) monthlyRowMap.set(r.grain_key, r);

    const monthly_series = allGrainKeys.map(k => {
      const r = monthlyRowMap.get(k);
      let label = r?.grain_label || k;
      if (!isMultiYear && k && k.includes('-')) {
        const [y, m] = k.split('-');
        label = `${ARABIC_MONTHS[m] || m} ${y}`;
      }
      const paCol = paMap.get(k) || 0;
      return {
        key: k,
        label,
        is_year: isMultiYear,
        revenue: Math.round(r?.rev || 0),
        expenses: Math.round(r?.exp || 0),
        collected_cash: Math.round(paCol)
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

    const sumMonthlyCol = monthly_series.reduce((s, m) => s + m.collected_cash, 0);
    const targetCol = Math.round(totalPaCol);
    const colDiff = targetCol - sumMonthlyCol;
    if (colDiff !== 0 && monthly_series.length > 0) {
      let maxColIdx = 0;
      for (let i = 1; i < monthly_series.length; i++) {
        if (monthly_series[i].collected_cash > monthly_series[maxColIdx].collected_cash) maxColIdx = i;
      }
      monthly_series[maxColIdx].collected_cash += colDiff;
    }

    // 4. Accounts from fact_daily for Tree (optimized CTE: aggregate first, then join metadata)
    const fdAccounts = this.db.prepare(`
      WITH agg AS (
        SELECT 
          fd.company_id as ledger_cid,
          fd.department_id,
          fd.cost_center_key,
          fd.cost_center_name,
          fd.account_code,
          SUM(fd.revenue) as revenue,
          SUM(fd.expense) as expense
        FROM fact_daily fd
        ${fdWhere}
        GROUP BY fd.company_id, fd.department_id, (CASE WHEN fd.department_id > 0 THEN '' ELSE fd.cost_center_key END), fd.account_code
        HAVING (SUM(fd.revenue) != 0 OR SUM(fd.expense) != 0)
      )
      SELECT 
        agg.ledger_cid,
        agg.department_id,
        agg.cost_center_key,
        agg.cost_center_name,
        ${this._groupNameSql('ag', 'agg.cost_center_name')} as department_name,
        agg.account_code,
        COALESCE(ca.name, agg.account_code) as account_name,
        agg.revenue,
        agg.expense
      FROM agg
      LEFT JOIN analytic_groups ag ON ag.id = agg.department_id
      LEFT JOIN company_accounts ca ON ca.company_id = agg.ledger_cid AND ca.code = agg.account_code
      ORDER BY agg.ledger_cid, agg.department_id, agg.revenue DESC, agg.expense DESC
    `).all(fdParams);


    const accMap = new Map();
    for (const row of fdAccounts) {
      const lCid = row.ledger_cid;
      if (!accMap.has(lCid)) accMap.set(lCid, new Map());
      const dMap = accMap.get(lCid);

      const dId = this._resolveGroupId(row.department_id, row.cost_center_key);
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
          adjustListRounding(list[maxIdx].children, key, list[maxIdx][key], true, 2.0);
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

        const clientCount = invDept ? (invDept.client_count !== undefined ? invDept.client_count : (invDept.clients ? invDept.clients.size : 0)) : 0;
        const accountCount = accDept && accDept.accounts ? accDept.accounts.length : 0;
        const hasChildren = clientCount > 0 || accountCount > 0;

        const journalsList = [];
        if (fullTree && invDept && invDept.journals) {
          for (const [jId, jObj] of invDept.journals.entries()) {
            const jBilled = Math.round(jObj.billed);
            const jColl = Math.round(jObj.collected);
            const jRes = Math.round(jObj.residual);
            const jRate = jBilled > 0 ? Math.round((jColl / jBilled) * 1000) / 10 : 0;
            const clientsList = [];
            for (const [pKey, cl] of jObj.clients.entries()) {
              const cBilled = Math.round(cl.billed);
              const cColl = Math.round(cl.collected);
              const cRes = Math.round(cl.residual);
              const cRate = cBilled > 0 ? Math.round((cColl / cBilled) * 1000) / 10 : 0;
              clientsList.push({
                id: `client_${cid}_${dId}_${jId}_${cl.partner_id || pKey}`,
                partner_id: cl.partner_id,
                name: cl.name,
                type: 'client',
                journal_id: jId,
                company_id: cid,
                department_id: dId,
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

            journalsList.push({
              id: `journal_${cid}_${dId}_${jId}`,
              journal_id: jId,
              name: jObj.name,
              type: 'journal',
              isJournal: true,
              company_id: cid,
              department_id: dId,
              billed: jBilled,
              collected: jColl,
              residual: jRes,
              collection_rate: jRate,
              revenue: null,
              expenses: null,
              net_profit: null,
              margin: null,
              children: clientsList
            });
          }
          journalsList.sort((a, b) => b.billed - a.billed);
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
        if (fullTree && journalsList.length > 0) {
          subGroups.push({
            id: `sub_clients_${cid}_${dId}`,
            name: 'العملاء',
            isGroup: true,
            isClients: true,
            company_id: cid,
            department_id: dId,
            billed: Math.round(dBilled),
            collected: Math.round(dCollected),
            residual: Math.round(dResidual),
            collection_rate: dRate,
            revenue: null,
            expenses: null,
            net_profit: null,
            margin: null,
            children: journalsList
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
  getExecutiveDepartmentChildren({ companyId, departmentId, kind = 'both', years, year, dateFrom, dateTo, journalIds, costCenters, targetRevenue, targetExpenses, targetBilled, targetCollected, targetResidual, scopedCostCenters }) {
    const period = this._periodFilter({ years, year, dateFrom, dateTo, defaultToCurrentYear: true }, 'si.date', 'dept_');
    const cid = Number(companyId);
    const did = Number(departmentId);

    let effTargetRev = targetRevenue;
    let effTargetExp = targetExpenses;
    let effTargetBilled = targetBilled;
    let effTargetCollected = targetCollected;
    let effTargetResidual = targetResidual;

    if (effTargetRev === undefined || effTargetExp === undefined || effTargetBilled === undefined) {
      try {
        const summary = this.getExecutiveSummary({
          years,
          year,
          dateFrom,
          dateTo,
          journalIds,
          costCenters,
          scopedCostCenters,
          fullTree: false
        });
        const co = summary?.tree?.rows?.find(c => c.company_id === cid || c.id === `co_${cid}`);
        const dept = co?.children?.find(d => d.department_id === did || d.id === `dept_${cid}_${did}`);
        if (dept) {
          if (effTargetRev === undefined && dept.revenue !== undefined) effTargetRev = dept.revenue;
          if (effTargetExp === undefined && dept.expenses !== undefined) effTargetExp = dept.expenses;
          if (effTargetBilled === undefined && dept.billed !== undefined) effTargetBilled = dept.billed;
          if (effTargetCollected === undefined && dept.collected !== undefined) effTargetCollected = dept.collected;
          if (effTargetResidual === undefined && dept.residual !== undefined) effTargetResidual = dept.residual;
        }
      } catch (e) {
        // Fallback to raw sums if summary lookup fails
      }
    }

    // Map company to sales company
    const coRow = this.db.prepare(`
      SELECT c.id as ledger_cid, sc.id as sales_cid
      FROM companies c
      JOIN sales_companies sc ON sc.sales_company_id = c.odoo_company_id
      WHERE c.id = ?
    `).get(cid);
    const salesCid = coRow?.sales_cid;

    let clients = [];
    let journals = [];
    let clientsSummary = {
      billed: 0,
      collected: 0,
      residual: 0,
      collection_rate: 0,
      invoice_count: 0
    };

    const synthMeta = this._getSyntheticGroupRegistry().idToMeta.get(did);

    if ((kind === 'clients' || kind === 'both') && salesCid) {
      let invWhere = synthMeta
        ? `WHERE si.company_id = @salesCid AND (id.cost_center_key = @synthKey OR id.cost_center_name = @synthName)`
        : `WHERE si.company_id = @salesCid AND id.department_id = @did`;
      const invParams = { salesCid, did, synthKey: synthMeta?.key, synthName: synthMeta?.name };
      if (period.sql !== '1=1') {
        invWhere += ` AND ${period.sql}`;
        Object.assign(invParams, period.params);
      }
      if (journalIds && journalIds.length > 0) {
        const ccFilter = this._buildCostCenterCondition({ journalIds, tableAlias: 'si', prefix: 'ejCC_' });
        if (ccFilter.sql) {
          invWhere += ccFilter.sql;
          Object.assign(invParams, ccFilter.params);
        }
      }

      const rawInvoices = this.db.prepare(`
        SELECT 
          si.journal_id,
          COALESCE(NULLIF(TRIM(si.journal_name), ''), 'بدون دفتر') as journal_name,
          id.cost_center_key,
          id.cost_center_name,
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
        GROUP BY id.cost_center_key, id.cost_center_name, si.partner_id, partner_name
        ORDER BY raw_billed DESC
      `).all(invParams);

      const jMap = new Map();
      let totalRawBilled = 0;
      let totalRawCollected = 0;
      let totalRawResidual = 0;

      const distinctInvs = this.db.prepare(`
        SELECT COUNT(DISTINCT si.id) as cnt
        FROM sales_invoices si
        JOIN invoice_departments id ON id.sales_invoice_id = si.id
        ${invWhere}
      `).get(invParams)?.cnt || 0;

      for (const row of rawInvoices) {
        totalRawBilled += (row.raw_billed || 0);
        totalRawCollected += (row.raw_collected || 0);
        totalRawResidual += (row.raw_residual || 0);

        const ccKey = row.cost_center_key || ('j:' + (row.journal_id || 0));
        const ccName = row.cost_center_name || row.journal_name || 'بدون دفتر';

        if (!jMap.has(ccKey)) {
          jMap.set(ccKey, {
            id: `journal_${cid}_${did}_${ccKey}`,
            journal_id: row.journal_id || 0,
            cost_center_key: ccKey,
            cost_center_name: ccName,
            name: ccName,
            type: 'journal',
            isJournal: true,
            company_id: cid,
            department_id: did,
            raw_billed: 0,
            raw_collected: 0,
            raw_residual: 0,
            invoice_count: 0,
            clients: []
          });
        }
        const jObj = jMap.get(ccKey);
        jObj.raw_billed += (row.raw_billed || 0);
        jObj.raw_collected += (row.raw_collected || 0);
        jObj.raw_residual += (row.raw_residual || 0);
        jObj.invoice_count += (row.invoice_count || 0);

        const cBilled = Math.round(row.raw_billed || 0);
        const cCollected = Math.round(row.raw_collected || 0);
        const cResidual = Math.round(row.raw_residual || 0);
        const cRate = cBilled > 0 ? Math.round((cCollected / cBilled) * 1000) / 10 : 0;

        const clientObj = {
          id: `client_${cid}_${did}_${ccKey}_${row.partner_id || row.partner_name}`,
          company_id: cid,
          department_id: did,
          journal_id: row.journal_id || 0,
          cost_center_key: ccKey,
          cost_center_name: ccName,
          partner_id: row.partner_id,
          name: row.partner_name,
          type: 'client',
          billed: cBilled,
          collected: cCollected,
          residual: cResidual,
          collection_rate: cRate,
          invoice_count: row.invoice_count,
          revenue: null,
          expenses: null,
          net_profit: null,
          margin: null
        };
        jObj.clients.push(clientObj);
        clients.push(clientObj);
      }

      journals = Array.from(jMap.values()).map(j => {
        const billed = Math.round(j.raw_billed || 0);
        const collected = Math.round(j.raw_collected || 0);
        const residual = Math.round(j.raw_residual || 0);
        const rate = billed > 0 ? Math.round((collected / billed) * 1000) / 10 : 0;
        return {
          id: j.id,
          journal_id: j.journal_id,
          cost_center_key: j.cost_center_key,
          cost_center_name: j.cost_center_name,
          name: j.name,
          type: 'journal',
          isJournal: true,
          company_id: j.company_id,
          department_id: j.department_id,
          billed,
          collected,
          residual,
          collection_rate: rate,
          invoice_count: j.invoice_count,
          revenue: null,
          expenses: null,
          net_profit: null,
          margin: null,
          clients: j.clients
        };
      });

      const sumBilled = effTargetBilled !== undefined ? effTargetBilled : Math.round(totalRawBilled);
      const sumCollected = effTargetCollected !== undefined ? effTargetCollected : Math.round(totalRawCollected);
      const sumResidual = effTargetResidual !== undefined ? effTargetResidual : Math.round(totalRawResidual);
      const sumRate = sumBilled > 0 ? Math.round((sumCollected / sumBilled) * 1000) / 10 : 0;
      clientsSummary = {
        billed: sumBilled,
        collected: sumCollected,
        residual: sumResidual,
        collection_rate: sumRate,
        invoice_count: distinctInvs
      };
    }

    let accounts = [];
    let accountsSummary = {
      revenue: 0,
      expenses: 0,
      net_profit: 0,
      margin: 0
    };
    if (kind === 'accounts' || kind === 'both') {
      let fdWhere = synthMeta
        ? `WHERE fd.company_id = @cid AND (fd.cost_center_key = @synthKey OR fd.cost_center_name = @synthName)`
        : `WHERE fd.company_id = @cid AND fd.department_id = @did`;
      const fdParams = { cid, did, synthKey: synthMeta?.key, synthName: synthMeta?.name };
      if (period.sql !== '1=1') {
        const fdPeriod = this._periodFilter({ years: period.yearsList, dateFrom: period.dateFrom, dateTo: period.dateTo }, 'fd.date', 'fd_');
        if (fdPeriod.sql !== '1=1') {
          fdWhere += ` AND ${fdPeriod.sql}`;
          Object.assign(fdParams, fdPeriod.params);
        }
      }
      const ccFilter = this._buildCostCenterCondition({ journalIds, tableAlias: 'fd', prefix: 'dcc_' });
      if (ccFilter.sql) {
        fdWhere += ccFilter.sql;
        Object.assign(fdParams, ccFilter.params);
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

      const rawTotRev = rawAccounts.reduce((s, a) => s + (a.revenue || 0), 0);
      const rawTotExp = rawAccounts.reduce((s, a) => s + (a.expense || 0), 0);
      const totRev = effTargetRev !== undefined ? effTargetRev : Math.round(rawTotRev);
      const totExp = effTargetExp !== undefined ? effTargetExp : Math.round(rawTotExp);
      const totNet = totRev - totExp;
      const totMargin = totRev > 0 ? Math.round((totNet / totRev) * 1000) / 10 : 0;
      accountsSummary = {
        revenue: totRev,
        expenses: totExp,
        net_profit: totNet,
        margin: totMargin
      };

      if (accounts.length > 0) {
        const accRevSum = accounts.reduce((s, a) => s + a.revenue, 0);
        const rDiff = totRev - accRevSum;
        if (rDiff !== 0) {
          let maxRevIdx = 0;
          for (let i = 1; i < accounts.length; i++) {
            if (Math.abs(accounts[i].revenue) > Math.abs(accounts[maxRevIdx].revenue)) maxRevIdx = i;
          }
          accounts[maxRevIdx].revenue += rDiff;
          accounts[maxRevIdx].net_profit = accounts[maxRevIdx].revenue - accounts[maxRevIdx].expenses;
        }

        const accExpSum = accounts.reduce((s, a) => s + a.expenses, 0);
        const eDiff = totExp - accExpSum;
        if (eDiff !== 0) {
          let maxExpIdx = 0;
          for (let i = 1; i < accounts.length; i++) {
            if (Math.abs(accounts[i].expenses) > Math.abs(accounts[maxExpIdx].expenses)) maxExpIdx = i;
          }
          accounts[maxExpIdx].expenses += eDiff;
          accounts[maxExpIdx].net_profit = accounts[maxExpIdx].revenue - accounts[maxExpIdx].expenses;
        }
      }
    }

    return { clients, journals, accounts, clientsSummary, accountsSummary };
  }

  /**
   * Lazy-fetch client invoices for slide-over drawer (filters by department when provided)
   */
  getExecutiveClientInvoices({ companyId, partnerId, departmentId, journalId, journal_id, costCenterKey, years, year, dateFrom, dateTo, asOfDate, scopedCostCenters }) {
    const pid = partnerId !== undefined && partnerId !== 'null' && partnerId !== '' ? Number(partnerId) : null;
    const defaultToCurrentYear = !pid;
    const period = this._periodFilter({ years, year, dateFrom, dateTo, asOfDate, defaultToCurrentYear }, 'si.date', 'cinv_');
    const refDate = period.refDate;
    const cid = Number(companyId);
    const did = departmentId !== undefined && departmentId !== 'null' && departmentId !== '' ? Number(departmentId) : null;
    const rawJid = journalId !== undefined ? journalId : journal_id;
    const jid = rawJid !== undefined && rawJid !== 'null' && rawJid !== '' ? Number(rawJid) : null;

    let scopeKeysForCompany = null;
    if (scopedCostCenters && Array.isArray(scopedCostCenters)) {
      scopeKeysForCompany = scopedCostCenters
        .filter(sc => Number(sc.companyId) === cid)
        .map(sc => sc.costCenterKey);
      if (scopeKeysForCompany.length === 0) {
        return {
          company_id: cid,
          department_id: did,
          journal_id: jid,
          cost_center_key: costCenterKey,
          partner_id: pid,
          partner_name: 'عميل',
          invoices: []
        };
      }
    }

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
    if (costCenterKey) {
      const bareCcKey = (typeof costCenterKey === 'string' && costCenterKey.includes('|'))
        ? costCenterKey.slice(costCenterKey.indexOf('|') + 1).trim()
        : costCenterKey;
      if (scopeKeysForCompany && !scopeKeysForCompany.includes(bareCcKey)) {
        return {
          company_id: cid,
          department_id: did,
          journal_id: jid,
          cost_center_key: costCenterKey,
          partner_id: pid,
          partner_name: 'عميل',
          invoices: []
        };
      }
      invWhere += ' AND id.cost_center_key = @costCenterKey';
      invParams.costCenterKey = bareCcKey;
    } else if (scopeKeysForCompany) {
      const skPh = scopeKeysForCompany.map((_, i) => `@sk_${i}`).join(',');
      scopeKeysForCompany.forEach((k, i) => { invParams[`sk_${i}`] = k; });
      invWhere += ` AND id.cost_center_key IN (${skPh})`;
    } else if (jid !== null && !isNaN(jid)) {
      invWhere += ' AND si.journal_id = @jid';
      invParams.jid = jid;
    }
    if (period.sql !== '1=1') {
      invWhere += ` AND ${period.sql}`;
      Object.assign(invParams, period.params);
    }

    const needsIdJoin = Boolean(
      (did !== null && !isNaN(did)) ||
      costCenterKey ||
      scopeKeysForCompany
    );
    const joinClause = needsIdJoin
      ? 'JOIN invoice_departments id ON id.sales_invoice_id = si.id'
      : '';

    const journalNameCol = needsIdJoin
      ? `COALESCE(NULLIF(TRIM(id.cost_center_name), ''), NULLIF(TRIM(si.journal_name), ''), 'بدون دفتر')`
      : `COALESCE(NULLIF(TRIM(si.journal_name), ''), 'بدون دفتر')`;

    const rows = this.db.prepare(`
      SELECT DISTINCT
        si.id,
        si.name as invoice_name,
        si.journal_id,
        ${journalNameCol} as journal_name,
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
      journal_id: jid,
      cost_center_key: costCenterKey,
      partner_id: pid,
      partner_name: partnerName,
      invoices: rows
    };
  }

  /**
   * Lazy-fetch full aging hierarchy
   */
  getExecutiveAging({ companyIds, years, year, dateFrom, dateTo, asOfDate, includeInvoices = false, scopedCostCenters }) {
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
      includePaid: false,
      scopedCostCenters
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
  getCustomersCollection({ companyIds, years, year, dateFrom, dateTo, asOfDate, includeInvoices = false, departmentIds, journalIds, costCenters }) {
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

    const invParams = { refDate };
    const sPh = targetSalesIds.map((_, i) => `@cust_sc_${i}`).join(',');
    targetSalesIds.forEach((id, i) => { invParams[`cust_sc_${i}`] = id; });
    let invWhere = `WHERE si.company_id IN (${sPh})`;

    if (period.sql !== '1=1') {
      invWhere += ` AND ${period.sql}`;
      Object.assign(invParams, period.params);
    }
    if (departmentIds && departmentIds.length > 0) {
      const grpFilter = this._buildGroupCondition({ departmentIds, tableAlias: 'id', prefix: 'cust_d_' });
      if (grpFilter.sql) {
        invWhere += grpFilter.sql;
        Object.assign(invParams, grpFilter.params);
      }
    }
    if ((journalIds && journalIds.length > 0) || (costCenters && costCenters.length > 0)) {
      const ccFilter = this._buildCostCenterCondition({ journalIds, costCenters, tableAlias: 'si', prefix: 'ccF_' });
      if (ccFilter.sql) {
        invWhere += ccFilter.sql;
        Object.assign(invParams, ccFilter.params);
      }
    }

    const rows = this.db.prepare(`
      SELECT 
        c.id as ledger_cid,
        c.name as ledger_name,
        id.department_id,
        ${this._groupNameSql('ag', 'id.cost_center_name')} as department_name,
        id.cost_center_key,
        id.cost_center_name,
        si.journal_id,
        COALESCE(NULLIF(TRIM(si.journal_name), ''), 'بدون دفتر') as journal_name,
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
      ORDER BY c.id, department_name, id.cost_center_name, partner_name, si.date DESC
    `).all(invParams);

    const coMap = new Map();
    const returnsList = [];
    const grandPartnerSet = new Set();

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
      const pid = r.partner_id || 0;
      const jid = r.journal_id || 0;
      const jName = (r.journal_name || '').trim() || 'بدون دفتر';
      const ccKey = r.cost_center_key || ('j:' + jid);
      const ccName = r.cost_center_name || jName;

      grandPartnerSet.add(pid);

      if (isRet) {
        returnsList.push({
          id: r.invoice_id,
          invoice_name: r.invoice_name,
          date: r.invoice_date,
          due_date: r.due_date,
          company_id: r.ledger_cid,
          company_name: r.ledger_name,
          department_id: this._resolveGroupId(r.department_id, r.cost_center_key),
          department_name: r.department_name,
          journal_id: jid,
          journal_name: jName,
          cost_center_key: ccKey,
          cost_center_name: ccName,
          partner_id: pid,
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
          inv_count: 0,
          billed: 0,
          returns: 0,
          net: 0,
          collected: 0,
          residual: 0,
          overdue_90: 0,
          weighted_age_sum: 0,
          buckets: { not_due: 0, b1_30: 0, b31_60: 0, b61_90: 0, b91_180: 0, b181_365: 0, over_365: 0 },
          departmentsMap: new Map(),
          partnerSet: new Set()
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
      co.partnerSet.add(pid);

      const deptMap = co.departmentsMap;
      const dId = this._resolveGroupId(r.department_id, r.cost_center_key);
      if (!deptMap.has(dId)) {
        deptMap.set(dId, {
          id: dId,
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
          journalsMap: new Map(),
          partnerSet: new Set()
        });
      }
      const dept = deptMap.get(dId);
      dept.inv_count = (dept.inv_count || 0) + 1;
      dept.billed += billedVal;
      dept.returns += returnVal;
      dept.net += netVal;
      dept.residual += residualVal;
      dept.collected += collectedVal;
      if (ageDays > 90 && residualVal > 0) dept.overdue_90 += residualVal;
      if (residualVal > 0) dept.weighted_age_sum += (ageDays * residualVal);
      dept.buckets[bKey] += residualVal;
      dept.partnerSet.add(pid);

      // Level 3: Cost Center (Node type remains 'journal' for TreeTable compatibility)
      const jMap = dept.journalsMap;
      if (!jMap.has(ccKey)) {
        jMap.set(ccKey, {
          id: ccKey,
          journal_id: jid,
          cost_center_key: ccKey,
          cost_center_name: ccName,
          name: ccName,
          company_id: r.ledger_cid,
          department_id: dId,
          type: 'journal',
          inv_count: 0,
          billed: 0,
          returns: 0,
          net: 0,
          collected: 0,
          residual: 0,
          overdue_90: 0,
          weighted_age_sum: 0,
          buckets: { not_due: 0, b1_30: 0, b31_60: 0, b61_90: 0, b91_180: 0, b181_365: 0, over_365: 0 },
          partnersMap: new Map(),
          partnerSet: new Set()
        });
      }
      const journal = jMap.get(ccKey);
      journal.inv_count = (journal.inv_count || 0) + 1;
      journal.billed += billedVal;
      journal.returns += returnVal;
      journal.net += netVal;
      journal.residual += residualVal;
      journal.collected += collectedVal;
      if (ageDays > 90 && residualVal > 0) journal.overdue_90 += residualVal;
      if (residualVal > 0) journal.weighted_age_sum += (ageDays * residualVal);
      journal.buckets[bKey] += residualVal;
      journal.partnerSet.add(pid);

      // Level 4: Partner / Client
      const pMap = journal.partnersMap;
      if (!pMap.has(pid)) {
        pMap.set(pid, {
          id: pid,
          name: r.partner_name,
          partner_id: pid,
          journal_id: jid,
          cost_center_key: ccKey,
          cost_center_name: ccName,
          company_id: r.ledger_cid,
          department_id: r.department_id,
          type: 'partner',
          _canLoad: true,
          inv_count: 0,
          client_count: 1,
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
          journal_id: r.journal_id,
          journal_name: r.journal_name,
          cost_center_key: ccKey,
          cost_center_name: ccName,
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
      co.client_count = co.partnerSet.size;

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
        dept.client_count = dept.partnerSet.size;
        for (const k of Object.keys(dept.buckets)) {
          dept.buckets[k] = round(dept.buckets[k]);
        }

        const journals = [];
        for (const journal of dept.journalsMap.values()) {
          journal.billed = round(journal.billed);
          journal.returns = round(journal.returns);
          journal.net = round(journal.net);
          journal.residual = round(journal.residual);
          journal.collected = round(journal.collected);
          journal.overdue_90 = round(journal.overdue_90);
          journal.collection_rate = journal.net > 0 ? round((journal.collected / journal.net) * 100) : 0;
          journal.avg_age = journal.residual > 0 ? Math.round(journal.weighted_age_sum / journal.residual) : 0;
          journal.client_count = journal.partnerSet.size;
          for (const k of Object.keys(journal.buckets)) {
            journal.buckets[k] = round(journal.buckets[k]);
          }

          const partners = [];
          for (const p of journal.partnersMap.values()) {
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
          delete journal.partnersMap;
          delete journal.partnerSet;
          delete journal.weighted_age_sum;
          journal.partners = partners;
          journals.push(journal);
        }

        delete dept.journalsMap;
        delete dept.partnerSet;
        delete dept.weighted_age_sum;
        dept.journals = journals;
        dept.partners = journals.flatMap(j => j.partners || []);
        departments.push(dept);
      }
      delete co.departmentsMap;
      delete co.partnerSet;
      delete co.weighted_age_sum;
      co.departments = departments;
      tree.push(co);
    }

    const totals = {
      inv_count: rows.length,
      client_count: grandPartnerSet.size,
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
  getCustomerStatement({ companyId, partnerId, departmentId, years, year, dateFrom, dateTo, asOfDate, scopedCostCenters }) {
    const period = this._periodFilter({ years, year, dateFrom, dateTo, asOfDate, defaultToCurrentYear: false }, 'si.date', 'stmt_');
    const refDate = period.refDate;
    const cid = Number(companyId);
    const pid = Number(partnerId);
    const did = departmentId !== undefined && departmentId !== 'null' && departmentId !== '' ? Number(departmentId) : null;

    let scopeKeysForCompany = null;
    if (scopedCostCenters && Array.isArray(scopedCostCenters)) {
      scopeKeysForCompany = scopedCostCenters
        .filter(sc => Number(sc.companyId) === cid)
        .map(sc => sc.costCenterKey);
      if (scopeKeysForCompany.length === 0) {
        return {
          partner: { id: pid, name: 'العميل' },
          company: { id: cid, name: `شركة ${cid}` },
          period_label: period.label,
          summary: { total_billed: 0, total_returns: 0, net_billed: 0, total_paid: 0, total_residual: 0, doc_count: 0, invoices_count: 0, returns_count: 0 },
          items: []
        };
      }
    }

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
    if (scopeKeysForCompany) {
      const skPh = scopeKeysForCompany.map((_, i) => `@stmt_sk_${i}`).join(',');
      scopeKeysForCompany.forEach((k, i) => { invParams[`stmt_sk_${i}`] = k; });
      invWhere += ` AND id.cost_center_key IN (${skPh})`;
    }
    if (period.sql !== '1=1') {
      invWhere += ` AND ${period.sql}`;
      Object.assign(invParams, period.params);
    }

    const needsIdJoin = Boolean((did !== null && !isNaN(did)) || scopeKeysForCompany);
    const joinClause = needsIdJoin
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
    redistributeAdmin = false,
    departmentIds,
    journalIds,
    costCenters
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
    const extraParams = {};
    const coPh = targetLedgerIds.map((_, i) => `@fd_cid_${i}`).join(',');
    targetLedgerIds.forEach((id, i) => { extraParams[`fd_cid_${i}`] = id; });
    const inCoClause = `fd.company_id IN (${coPh})`;

    let extraFilter = '';
    if (departmentIds && departmentIds.length > 0) {
      const grpFilter = this._buildGroupCondition({ departmentIds, tableAlias: 'fd', prefix: 'fd_dept_' });
      if (grpFilter.sql) {
        extraFilter += grpFilter.sql;
        Object.assign(extraParams, grpFilter.params);
      }
    }
    const ccFilter = this._buildCostCenterCondition({ journalIds, costCenters, tableAlias: 'fd', prefix: 'jF_' });
    if (ccFilter.sql) {
      extraFilter += ccFilter.sql;
      Object.assign(extraParams, ccFilter.params);
    }

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
        fd.cost_center_key,
        fd.cost_center_name,
        ${this._groupNameSql('ag', 'fd.cost_center_name')} as department_name,
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
      WHERE ${inCoClause} AND ${period.sql} ${extraFilter}
      GROUP BY fd.company_id, fd.department_id, (CASE WHEN fd.department_id > 0 THEN '' ELSE fd.cost_center_key END), cost_center, fd.account_code, period_key
      ORDER BY fd.company_id, fd.department_id, cost_center, fd.account_code, period_key
    `).all({ ...period.params, ...extraParams });

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
      const did = this._resolveGroupId(r.department_id, r.cost_center_key);
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
        net_profit: Math.round(grandRev) - Math.round(grandExp),
        profit_margin: Math.round(grandRev) > 0 ? Math.round(((Math.round(grandRev) - Math.round(grandExp)) / Math.round(grandRev)) * 1000) / 10 : 0,
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

  /**
   * C1: Get Actual Collections (التحصيل الفعلي)
   * Answers the 6 core executive management questions:
   * 1. «كم حصّلنا؟» - Summary KPI Cards (Total, Bank, Sister Co, Other Adjustments, Credit Notes, Unallocated)
   * 2. «شهرياً» - Periodic Series (Monthly/Quarterly/Annual) with R2-10
   * 3. «من أي سنوات فواتير؟» - Cross-tab of collections by invoice year
   * 4. «حسب الدفتر والعميل» - 5-level hierarchical tree & Direct Clients table
   * 5. «المقارنة بحسابات العملاء» - Accounts reconciliation with non-scope allocations & unallocated
   * 6. «سدادات خارج بنك الشركة» - Audit list for sister company and other adjustment payments
   */
  getCollections(options = {}) {
    const {
      companyIds,
      years,
      year,
      dateFrom,
      dateTo,
      asOfDate,
      departmentIds,
      journalIds,
      costCenters,
      costCenterKey,
      journalNames,
      journalName,
      partnerIds,
      partnerName,
      timeGrain = 'month',
      includeInvoices = false,
      scopedCostCenters
    } = options;

    const round = (n) => Math.round((n || 0) * 100) / 100;

    // Period filter applied on payment_date (date of actual receipt)
    const period = this._periodFilter({ years, year, dateFrom, dateTo, asOfDate, defaultToCurrentYear: true }, 'pa.payment_date', 'col_');
    const df = period.dateFrom;
    const dt = period.dateTo;

    // Company mappings
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

    let targetLedgerIds = coRows.map(r => r.ledger_cid);
    if (companyIds && companyIds.length > 0) {
      const arr = Array.isArray(companyIds) ? companyIds.map(Number) : String(companyIds).split(',').map(Number);
      targetLedgerIds = [];
      for (const id of arr) {
        if (ledgerToSales.has(id)) targetLedgerIds.push(id);
        else if (salesToLedger.has(id)) targetLedgerIds.push(salesToLedger.get(id).ledger_cid);
      }
      if (targetLedgerIds.length === 0) targetLedgerIds = [-1];
    }

    if (scopedCostCenters && Array.isArray(scopedCostCenters) && scopedCostCenters.length > 0) {
      const scopedCids = Array.from(new Set(scopedCostCenters.map(sc => Number(sc.companyId)))).filter(Boolean);
      targetLedgerIds = targetLedgerIds.filter(id => scopedCids.includes(id));
      if (targetLedgerIds.length === 0) targetLedgerIds = scopedCids;
    }

    // If cost center key or pairs contain explicit company IDs, restrict targetLedgerIds to those companies
    const explicitCoIds = [];
    if (costCenterKey && typeof costCenterKey === 'string' && costCenterKey.includes('|')) {
      const pCid = parseInt(costCenterKey.slice(0, costCenterKey.indexOf('|')), 10);
      if (pCid > 0) explicitCoIds.push(pCid);
    }
    if ((journalIds && journalIds.length > 0) || (costCenters && costCenters.length > 0)) {
      const ccFilter = this._buildCostCenterCondition({ journalIds, costCenters, tableAlias: 'dummy', prefix: 'chk_' });
      if (ccFilter.pairs && ccFilter.pairs.length > 0) {
        for (const p of ccFilter.pairs) {
          if (p.companyId && !explicitCoIds.includes(p.companyId)) {
            explicitCoIds.push(p.companyId);
          }
        }
      }
    }
    if (explicitCoIds.length > 0) {
      targetLedgerIds = targetLedgerIds.filter(id => explicitCoIds.includes(id));
      if (targetLedgerIds.length === 0) targetLedgerIds = explicitCoIds;
    }

    // Build dynamic WHERE clause for payment_allocations
    const params = {};
    const paCoPh = targetLedgerIds.map((_, i) => `@pa_cid_${i}`).join(',');
    targetLedgerIds.forEach((id, i) => { params[`pa_cid_${i}`] = id; });
    const whereClauses = [`pa.company_id IN (${paCoPh})`];

    if (period.sql !== '1=1') {
      whereClauses.push(period.sql);
      Object.assign(params, period.params);
    }

    if (departmentIds && departmentIds.length > 0) {
      const grpFilter = this._buildGroupCondition({ departmentIds, tableAlias: 'pa', prefix: 'pa_dept_' });
      if (grpFilter.sql) {
        whereClauses.push(grpFilter.sql.replace(/^\s*AND\s*/i, ''));
        Object.assign(params, grpFilter.params);
      }
    }

    if (costCenterKey) {
      const ccFilter = this._buildCostCenterCondition({ journalIds: [costCenterKey], tableAlias: 'pa', prefix: 'pacc_single_' });
      if (ccFilter.sql) {
        whereClauses.push(ccFilter.sql.replace(/^\s*AND\s*/i, ''));
        Object.assign(params, ccFilter.params);
      }
    } else if ((journalIds && journalIds.length > 0) || (costCenters && costCenters.length > 0)) {
      const ccFilter = this._buildCostCenterCondition({ journalIds, costCenters, tableAlias: 'pa', prefix: 'pacc_' });
      if (ccFilter.sql) {
        whereClauses.push(ccFilter.sql.replace(/^\s*AND\s*/i, ''));
        Object.assign(params, ccFilter.params);
      }
    } else if (scopedCostCenters && Array.isArray(scopedCostCenters) && scopedCostCenters.length > 0) {
      const sMap = new Map();
      for (const sc of scopedCostCenters) {
        const cId = Number(sc.companyId);
        if (!sMap.has(cId)) sMap.set(cId, []);
        sMap.get(cId).push(sc.costCenterKey);
      }
      const sClauses = [];
      let sIdx = 0;
      for (const [cId, keys] of sMap.entries()) {
        const kPh = keys.map((_, i) => `@pacc_sc_${sIdx}_${i}`).join(',');
        keys.forEach((k, i) => { params[`pacc_sc_${sIdx}_${i}`] = k; });
        params[`pacc_sc_cid_${sIdx}`] = cId;
        sClauses.push(`(pa.company_id = @pacc_sc_cid_${sIdx} AND pa.cost_center_key IN (${kPh}))`);
        sIdx++;
      }
      if (sClauses.length > 0) {
        whereClauses.push(`(${sClauses.join(' OR ')})`);
      }
    }

    // Extract distinct available journals in scope of companies & period (before journal filter is applied)
    const availParams = { ...period.params };
    const availCoPh = targetLedgerIds.map((_, i) => `@avail_cid_${i}`).join(',');
    targetLedgerIds.forEach((id, i) => { availParams[`avail_cid_${i}`] = id; });

    let availCcClause = '';
    if (scopedCostCenters && Array.isArray(scopedCostCenters) && scopedCostCenters.length > 0) {
      const sMap = new Map();
      for (const sc of scopedCostCenters) {
        const cId = Number(sc.companyId);
        if (!sMap.has(cId)) sMap.set(cId, []);
        sMap.get(cId).push(sc.costCenterKey);
      }
      const sClauses = [];
      let sIdx = 0;
      for (const [cId, keys] of sMap.entries()) {
        const kPh = keys.map((_, i) => `@avail_sc_${sIdx}_${i}`).join(',');
        keys.forEach((k, i) => { availParams[`avail_sc_${sIdx}_${i}`] = k; });
        availParams[`avail_sc_cid_${sIdx}`] = cId;
        sClauses.push(`(pa.company_id = @avail_sc_cid_${sIdx} AND pa.cost_center_key IN (${kPh}))`);
        sIdx++;
      }
      if (sClauses.length > 0) {
        availCcClause = `AND (${sClauses.join(' OR ')})`;
      }
    }

    const availableJournalRows = this.db.prepare(`
      SELECT DISTINCT pa.invoice_journal_name
      FROM payment_allocations pa
      WHERE pa.company_id IN (${availCoPh})
        ${availCcClause}
        ${period.sql !== '1=1' ? 'AND ' + period.sql : ''}
        AND pa.invoice_journal_name IS NOT NULL
      ORDER BY pa.invoice_journal_name
    `).all(availParams);
    let available_journals = Array.from(new Set(
      availableJournalRows
        .map(r => (r.invoice_journal_name || '').trim())
        .filter(n => n && n !== 'بدون دفتر')
    )).sort((a, b) => a.localeCompare('ar'));

    if (scopedCostCenters && Array.isArray(scopedCostCenters) && scopedCostCenters.length > 0) {
      const allowedNames = new Set();
      for (const sc of scopedCostCenters) {
        if (sc.costCenterName) allowedNames.add(sc.costCenterName.trim());
      }
      const cckParams = {};
      scopedCostCenters.forEach((sc, i) => { cckParams[`cck_${i}`] = sc.costCenterKey; });
      const cckPh = scopedCostCenters.map((_, i) => `@cck_${i}`).join(',');
      try {
        const idRows = this.db.prepare(`
          SELECT DISTINCT cost_center_name FROM invoice_departments WHERE cost_center_key IN (${cckPh})
        `).all(cckParams);
        idRows.forEach(r => { if (r.cost_center_name) allowedNames.add(r.cost_center_name.trim()); });
      } catch (e) {}
      available_journals = available_journals.filter(jn => allowedNames.has(jn));
      if (available_journals.length === 0 && allowedNames.size > 0) {
        available_journals = Array.from(allowedNames).sort((a, b) => a.localeCompare('ar'));
      }
    }

    const jNamesList = [];
    if (journalName && typeof journalName === 'string' && journalName.trim()) {
      jNamesList.push(journalName.trim());
    }
    if (journalNames) {
      const rawArr = Array.isArray(journalNames) ? journalNames : String(journalNames).split(',');
      for (const jn of rawArr) {
        if (jn && typeof jn === 'string') {
          const trimmed = jn.trim();
          if (trimmed && !jNamesList.includes(trimmed)) jNamesList.push(trimmed);
        }
      }
    }
    if (jNamesList.length > 0) {
      const jnConditions = jNamesList.map((_, idx) => `(TRIM(pa.invoice_journal_name) = @jName_${idx} OR pa.invoice_journal_name = @jName_${idx})`);
      jNamesList.forEach((jn, idx) => { params[`jName_${idx}`] = jn; });
      whereClauses.push(`(${jnConditions.join(' OR ')})`);
    }

    if (partnerIds && partnerIds.length > 0) {
      const pArr = (Array.isArray(partnerIds) ? partnerIds : [partnerIds]).map(Number).filter(n => Number.isInteger(n) && !isNaN(n));
      if (pArr.length > 0) {
        const pPh = pArr.map((_, i) => `@pa_part_${i}`).join(',');
        pArr.forEach((p, i) => { params[`pa_part_${i}`] = p; });
        whereClauses.push(`pa.partner_id IN (${pPh})`);
      }
    }

    if (partnerName && typeof partnerName === 'string' && partnerName.trim()) {
      whereClauses.push(`pa.partner_name LIKE @pNameFilter`);
      params.pNameFilter = `%${partnerName.trim()}%`;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // ── 1. «كم حصّلنا؟» - Summary KPI Cards
    const cardsRow = this.db.prepare(`
      SELECT 
        ROUND(SUM(CASE WHEN pa.channel IN ('bank', 'sister_company', 'other_adjustment') THEN pa.amount ELSE 0 END), 2) as total_collected,
        ROUND(SUM(CASE WHEN pa.channel = 'bank' THEN pa.amount ELSE 0 END), 2) as bank_collected,
        ROUND(SUM(CASE WHEN pa.channel = 'sister_company' THEN pa.amount ELSE 0 END), 2) as sister_collected,
        ROUND(SUM(CASE WHEN pa.channel = 'other_adjustment' THEN pa.amount ELSE 0 END), 2) as other_collected,
        ROUND(SUM(CASE WHEN pa.channel = 'discount_fee' THEN pa.amount ELSE 0 END), 2) as discount_fees,
        ROUND(SUM(CASE WHEN pa.channel = 'credit_note' THEN pa.amount ELSE 0 END), 2) as credit_notes,
        COUNT(DISTINCT pa.payment_move_name) as payments_count,
        COUNT(DISTINCT pa.invoice_name) as invoices_count,
        COUNT(DISTINCT pa.partner_id) as partners_count
      FROM payment_allocations pa
      ${whereSql}
    `).get(params);

    // Unallocated payments balance in scope (computed in Section 5 strictly for trade customers)
    const cards = {
      total_collected: cardsRow.total_collected || 0,
      bank_collected: cardsRow.bank_collected || 0,
      sister_collected: cardsRow.sister_collected || 0,
      other_collected: cardsRow.other_collected || 0,
      discount_fees: cardsRow.discount_fees || 0,
      credit_notes: cardsRow.credit_notes || 0,
      unallocated_balance: 0,
      payments_count: cardsRow.payments_count || 0,
      invoices_count: cardsRow.invoices_count || 0,
      partners_count: cardsRow.partners_count || 0,
      unallocated_lines_count: 0,
      note: 'المبالغ حسب تاريخ السداد بغض النظر عن تاريخ الفاتورة'
    };

    // ── 2. «شهرياً» - Periodic Series
    const grainCol = timeGrain === 'year' ? 'pa.payment_year' : (timeGrain === 'quarter' ? 'pa.payment_quarter' : 'pa.payment_month');
    const seriesRows = this.db.prepare(`
      SELECT 
        ${grainCol} as period,
        ROUND(SUM(CASE WHEN pa.channel = 'bank' THEN pa.amount ELSE 0 END), 2) as bank,
        ROUND(SUM(CASE WHEN pa.channel = 'sister_company' THEN pa.amount ELSE 0 END), 2) as sister_company,
        ROUND(SUM(CASE WHEN pa.channel = 'other_adjustment' THEN pa.amount ELSE 0 END), 2) as other_adjustment,
        ROUND(SUM(CASE WHEN pa.channel = 'discount_fee' THEN pa.amount ELSE 0 END), 2) as discount_fee,
        ROUND(SUM(CASE WHEN pa.channel IN ('bank', 'sister_company', 'other_adjustment') THEN pa.amount ELSE 0 END), 2) as total_collected,
        ROUND(SUM(CASE WHEN pa.channel = 'credit_note' THEN pa.amount ELSE 0 END), 2) as credit_notes,
        COUNT(DISTINCT pa.payment_move_name) as payments_count
      FROM payment_allocations pa
      ${whereSql}
      GROUP BY ${grainCol}
      HAVING total_collected > 0 OR credit_notes > 0 OR discount_fee > 0
      ORDER BY ${grainCol} ASC
    `).all(params);

    const monthNamesAr = {
      '01': 'يناير', '02': 'فبراير', '03': 'مارس', '04': 'أبريل',
      '05': 'مايو', '06': 'يونيو', '07': 'يوليو', '08': 'أغسطس',
      '09': 'سبتمبر', '10': 'أكتوبر', '11': 'نوفمبر', '12': 'ديسمبر'
    };

    const periodicSeries = seriesRows.map(r => {
      let label = r.period;
      if (timeGrain === 'month' && r.period && r.period.includes('-')) {
        const [yr, m] = r.period.split('-');
        label = `${monthNamesAr[m] || m} ${yr}`;
      } else if (timeGrain === 'quarter') {
        const qNames = { 'Q1': 'الربع الأول', 'Q2': 'الربع الثاني', 'Q3': 'الربع الثالث', 'Q4': 'الربع الرابع' };
        label = qNames[r.period] || r.period;
      }
      return {
        period: r.period,
        label,
        bank: r.bank || 0,
        sister_company: r.sister_company || 0,
        other_adjustment: r.other_adjustment || 0,
        discount_fee: r.discount_fee || 0,
        total_collected: r.total_collected || 0,
        credit_notes: r.credit_notes || 0,
        payments_count: r.payments_count || 0
      };
    });

    // ── 3. «من أي سنوات فواتير؟» - By Invoice Year
    const byInvYearRows = this.db.prepare(`
      SELECT 
        pa.invoice_year,
        c.name as company_name,
        ROUND(SUM(CASE WHEN pa.channel IN ('bank', 'sister_company', 'other_adjustment') THEN pa.amount ELSE 0 END), 2) as collected_amount,
        ROUND(SUM(CASE WHEN pa.channel = 'discount_fee' THEN pa.amount ELSE 0 END), 2) as discount_fees,
        ROUND(SUM(CASE WHEN pa.channel = 'credit_note' THEN pa.amount ELSE 0 END), 2) as credit_notes
      FROM payment_allocations pa
      JOIN companies c ON c.id = pa.company_id
      ${whereSql}
      GROUP BY pa.invoice_year, c.id
      ORDER BY pa.invoice_year DESC, c.id ASC
    `).all(params);

    const invYearMap = new Map();
    const activeCoNames = targetLedgerIds.map(cid => {
      const co = coRows.find(c => c.ledger_cid === cid);
      return co ? co.ledger_name : `الشركة ${cid}`;
    });

    let grandInvTotal = 0;
    for (const r of byInvYearRows) {
      if (!invYearMap.has(r.invoice_year)) {
        invYearMap.set(r.invoice_year, {
          invoice_year: r.invoice_year,
          total: 0,
          credit_notes: 0,
          companies: {}
        });
      }
      const entry = invYearMap.get(r.invoice_year);
      entry.companies[r.company_name] = r.collected_amount || 0;
      entry.total = round(entry.total + (r.collected_amount || 0));
      entry.credit_notes = round(entry.credit_notes + (r.credit_notes || 0));
      grandInvTotal = round(grandInvTotal + (r.collected_amount || 0));
    }

    const byInvoiceYear = Array.from(invYearMap.values()).map(e => ({
      invoice_year: e.invoice_year,
      total: e.total,
      credit_notes: e.credit_notes,
      pct_of_total: grandInvTotal > 0 ? round((e.total / grandInvTotal) * 100) : 0,
      companies: e.companies
    }));

    // ── 4. «حسب الدفتر والعميل» - Hierarchical Tree & Direct Clients View
    const detailedRows = this.db.prepare(`
      SELECT 
        pa.company_id,
        c.name as company_name,
        pa.department_id,
        COALESCE(NULLIF(TRIM(pa.department_name), ''), NULLIF(TRIM(pa.cost_center_name), ''), 'غير مصنّف') as department_name,
        pa.cost_center_key,
        pa.cost_center_name,
        pa.invoice_journal_id,
        pa.invoice_journal_name,
        pa.partner_id,
        pa.partner_name,
        ROUND(SUM(CASE WHEN pa.channel = 'bank' THEN pa.amount ELSE 0 END), 2) as bank,
        ROUND(SUM(CASE WHEN pa.channel = 'sister_company' THEN pa.amount ELSE 0 END), 2) as sister_company,
        ROUND(SUM(CASE WHEN pa.channel = 'other_adjustment' THEN pa.amount ELSE 0 END), 2) as other_adjustment,
        ROUND(SUM(CASE WHEN pa.channel = 'discount_fee' THEN pa.amount ELSE 0 END), 2) as discount_fee,
        ROUND(SUM(CASE WHEN pa.channel IN ('bank', 'sister_company', 'other_adjustment') THEN pa.amount ELSE 0 END), 2) as total_collected,
        ROUND(SUM(CASE WHEN pa.channel = 'credit_note' THEN pa.amount ELSE 0 END), 2) as credit_notes,
        COUNT(DISTINCT pa.payment_move_name) as payments_count,
        COUNT(DISTINCT pa.invoice_name) as invoices_count
      FROM payment_allocations pa
      JOIN companies c ON c.id = pa.company_id
      ${whereSql}
      GROUP BY pa.company_id, pa.department_id, pa.cost_center_key, pa.partner_id
      ORDER BY c.id, pa.department_name, pa.cost_center_name, total_collected DESC
    `).all(params);

    // Build 4-level Tree: Company -> Department -> Cost Center / Journal -> Partner
    const companyTree = [];
    const coMap = new Map();

    for (const r of detailedRows) {
      if (!coMap.has(r.company_id)) {
        const coNode = {
          id: `co:${r.company_id}`,
          company_id: r.company_id,
          name: r.company_name,
          type: 'company',
          bank: 0, sister_company: 0, other_adjustment: 0, discount_fee: 0, total_collected: 0, credit_notes: 0, payments_count: 0, invoices_count: 0,
          departments: [],
          deptMap: new Map()
        };
        coMap.set(r.company_id, coNode);
        companyTree.push(coNode);
      }
      const coNode = coMap.get(r.company_id);

      const did = this._resolveGroupId(r.department_id, r.cost_center_key);
      if (!coNode.deptMap.has(did)) {
        const deptNode = {
          id: `co:${r.company_id}/dept:${did}`,
          department_id: did,
          name: r.department_name,
          type: 'department',
          bank: 0, sister_company: 0, other_adjustment: 0, discount_fee: 0, total_collected: 0, credit_notes: 0, payments_count: 0, invoices_count: 0,
          journals: [],
          journalMap: new Map()
        };
        coNode.deptMap.set(did, deptNode);
        coNode.departments.push(deptNode);
      }
      const deptNode = coNode.deptMap.get(did);

      const jId = r.invoice_journal_id || 0;
      const ccKey = r.cost_center_key || ('j:' + jId);
      const ccName = r.cost_center_name || r.invoice_journal_name || 'بدون دفتر';

      if (!deptNode.journalMap.has(ccKey)) {
        const jNode = {
          id: `co:${r.company_id}/dept:${did}/j:${ccKey}`,
          cost_center_key: ccKey,
          cost_center_name: ccName,
          journal_id: jId,
          name: ccName,
          type: 'journal',
          bank: 0, sister_company: 0, other_adjustment: 0, discount_fee: 0, total_collected: 0, credit_notes: 0, payments_count: 0, invoices_count: 0,
          partners: []
        };
        deptNode.journalMap.set(ccKey, jNode);
        deptNode.journals.push(jNode);
      }
      const jNode = deptNode.journalMap.get(ccKey);

      const partnerNode = {
        id: `co:${r.company_id}/dept:${did}/j:${ccKey}/p:${r.partner_id}`,
        partner_id: r.partner_id,
        name: r.partner_name || 'عميل غير معروف',
        type: 'partner',
        cost_center_key: ccKey,
        cost_center_name: ccName,
        journal_id: jId,
        bank: r.bank,
        sister_company: r.sister_company,
        other_adjustment: r.other_adjustment,
        discount_fee: r.discount_fee,
        total_collected: r.total_collected,
        credit_notes: r.credit_notes,
        payments_count: r.payments_count,
        invoices_count: r.invoices_count,
        company_id: r.company_id,
        department_id: r.department_id,
        has_children: true
      };
      jNode.partners.push(partnerNode);

      // Roll up to journal
      jNode.bank = round(jNode.bank + r.bank);
      jNode.sister_company = round(jNode.sister_company + r.sister_company);
      jNode.other_adjustment = round(jNode.other_adjustment + r.other_adjustment);
      jNode.discount_fee = round(jNode.discount_fee + r.discount_fee);
      jNode.total_collected = round(jNode.total_collected + r.total_collected);
      jNode.credit_notes = round(jNode.credit_notes + r.credit_notes);
      jNode.payments_count += r.payments_count;
      jNode.invoices_count += r.invoices_count;

      // Roll up to department
      deptNode.bank = round(deptNode.bank + r.bank);
      deptNode.sister_company = round(deptNode.sister_company + r.sister_company);
      deptNode.other_adjustment = round(deptNode.other_adjustment + r.other_adjustment);
      deptNode.discount_fee = round(deptNode.discount_fee + r.discount_fee);
      deptNode.total_collected = round(deptNode.total_collected + r.total_collected);
      deptNode.credit_notes = round(deptNode.credit_notes + r.credit_notes);
      deptNode.payments_count += r.payments_count;
      deptNode.invoices_count += r.invoices_count;

      // Roll up to company
      coNode.bank = round(coNode.bank + r.bank);
      coNode.sister_company = round(coNode.sister_company + r.sister_company);
      coNode.other_adjustment = round(coNode.other_adjustment + r.other_adjustment);
      coNode.discount_fee = round(coNode.discount_fee + r.discount_fee);
      coNode.total_collected = round(coNode.total_collected + r.total_collected);
      coNode.credit_notes = round(coNode.credit_notes + r.credit_notes);
      coNode.payments_count += r.payments_count;
      coNode.invoices_count += r.invoices_count;
    }

    // Clean internal map structures from tree nodes
    for (const co of companyTree) {
      delete co.deptMap;
      for (const d of co.departments) {
        delete d.journalMap;
      }
    }

    // Direct Clients Table (sorted descending by total_collected)
    const directClientsMap = new Map();
    for (const r of detailedRows) {
      const pid = r.partner_id || 0;
      if (!directClientsMap.has(pid)) {
        directClientsMap.set(pid, {
          partner_id: pid,
          partner_name: r.partner_name || 'عميل غير معروف',
          company_name: r.company_name,
          department_name: r.department_name,
          cost_center_name: r.cost_center_name || r.invoice_journal_name || 'بدون دفتر',
          journal_name: r.cost_center_name || r.invoice_journal_name || 'بدون دفتر',
          bank: 0, sister_company: 0, other_adjustment: 0, discount_fee: 0, total_collected: 0, credit_notes: 0, payments_count: 0
        });
      }
      const entry = directClientsMap.get(pid);
      entry.bank = round(entry.bank + r.bank);
      entry.sister_company = round(entry.sister_company + r.sister_company);
      entry.other_adjustment = round(entry.other_adjustment + r.other_adjustment);
      entry.discount_fee = round(entry.discount_fee + r.discount_fee);
      entry.total_collected = round(entry.total_collected + r.total_collected);
      entry.credit_notes = round(entry.credit_notes + r.credit_notes);
      entry.payments_count += r.payments_count;
    }
    const clientsDirect = Array.from(directClientsMap.values()).sort((a, b) => b.total_collected - a.total_collected);

    // ── 5. «هل توجد دفعات من العملاء لم تُربط بفواتير؟» - Accounts Comparison & Proof
    // Scope of customers: Strictly trade customers (partners having at least 1 sales invoice in target companies)
    // EXCLUDING sister companies from sister_company_partners and parties without sales invoices.
    let scopePartnerNames = [];
    let scopePartnerIds = [];

    const sisterParams = {};
    const sisterCoPh = targetLedgerIds.map((_, i) => `@sis_cid_${i}`).join(',');
    targetLedgerIds.forEach((id, i) => { sisterParams[`sis_cid_${i}`] = id; });
    const sisterRows = this.db.prepare(`
      SELECT partner_id, partner_name
      FROM sister_company_partners
      WHERE company_id IN (${sisterCoPh})
    `).all(sisterParams);
    const sisterIdsSet = new Set(sisterRows.map(s => s.partner_id));
    const sisterNamesSet = new Set(sisterRows.map(s => (s.partner_name || '').trim()));

    const targetSalesCids = targetLedgerIds.map(cid => ledgerToSales.get(cid)).filter(Boolean);

    const invParams = [];
    const invConditions = [
      `si.partner_name IS NOT NULL AND TRIM(si.partner_name) != ''`
    ];
    if (targetSalesCids.length > 0) {
      const sCidPh = targetSalesCids.map(() => '?').join(',');
      invConditions.push(`si.company_id IN (${sCidPh})`);
      invParams.push(...targetSalesCids);
    } else {
      invConditions.push('1=0');
    }

    if (jNamesList.length > 0) {
      invConditions.push(`(TRIM(si.journal_name) IN (${jNamesList.map(() => '?').join(',')}) OR si.journal_name IN (${jNamesList.map(() => '?').join(',')}))`);
      invParams.push(...jNamesList, ...jNamesList);
    } else if ((journalIds && journalIds.length > 0) || (costCenters && costCenters.length > 0)) {
      const ccFilter = this._buildCostCenterCondition({ journalIds, costCenters, tableAlias: 'si', prefix: 'sec5si_' });
      const subConds = [];
      if (ccFilter.pairs && ccFilter.pairs.length > 0) {
        ccFilter.pairs.forEach((pair) => {
          const matchParts = ['id.cost_center_key = ?'];
          const matchVals = [pair.costCenterKey];
          if (pair.altKey && pair.altKey !== pair.costCenterKey) {
            matchParts.push('id.cost_center_key = ?');
            matchVals.push(pair.altKey);
          }
          if (pair.name) {
            matchParts.push('id.cost_center_name = ?');
            matchVals.push(pair.name);
          }
          const matchExpr = matchParts.length > 1 ? `(${matchParts.join(' OR ')})` : matchParts[0];

          if (pair.companyId) {
            const sc = this._getSalesCid(pair.companyId);
            subConds.push(`(si.company_id = ? AND ${matchExpr})`);
            invParams.push(sc, ...matchVals);
          } else {
            subConds.push(matchExpr);
            invParams.push(...matchVals);
          }
        });
      } else {
        if (ccFilter.costCenterKeys && ccFilter.costCenterKeys.length > 0) {
          const ph = ccFilter.costCenterKeys.map(() => '?').join(',');
          subConds.push(`id.cost_center_key IN (${ph})`);
          invParams.push(...ccFilter.costCenterKeys);
        }
        if (ccFilter.names && ccFilter.names.length > 0) {
          const placeholders = ccFilter.names.map(() => '?').join(',');
          subConds.push(`TRIM(si.journal_name) IN (${placeholders})`);
          invParams.push(...ccFilter.names);
        }
      }
      if (subConds.length > 0) {
        invConditions.push(`(${subConds.join(' OR ')})`);
      }
    }

    if (partnerIds && partnerIds.length > 0) {
      const pArr = (Array.isArray(partnerIds) ? partnerIds : [partnerIds]).map(Number).filter(n => Number.isInteger(n) && !isNaN(n));
      if (pArr.length > 0) {
        invConditions.push(`si.partner_id IN (${pArr.map(() => '?').join(',')})`);
        invParams.push(...pArr);
      }
    }

    if (partnerName && typeof partnerName === 'string' && partnerName.trim()) {
      invConditions.push(`si.partner_name LIKE ?`);
      invParams.push(`%${partnerName.trim()}%`);
    }

    const invPartners = this.db.prepare(`
      SELECT DISTINCT TRIM(si.partner_name) as partner_name, si.partner_id
      FROM sales_invoices si
      LEFT JOIN invoice_departments id ON id.sales_invoice_id = si.id
      WHERE ${invConditions.join(' AND ')}
    `).all(...invParams);

    for (const p of invPartners) {
      const pName = (p.partner_name || '').trim();
      if (!sisterIdsSet.has(p.partner_id) && !sisterNamesSet.has(pName)) {
        if (pName) scopePartnerNames.push(pName);
        if (p.partner_id > 0) scopePartnerIds.push(p.partner_id);
      }
    }
    scopePartnerNames = [...new Set(scopePartnerNames)];
    scopePartnerIds = [...new Set(scopePartnerIds)];

    if (scopePartnerNames.length === 0) scopePartnerNames = ['__NONE__'];

    // Build conditions for journal_items
    const pPlaceholders = scopePartnerNames.map(() => '?').join(',');
    const idPlaceholders = scopePartnerIds.map(() => '?').join(',');
    const idClause = scopePartnerIds.length > 0 ? ` OR ji.partner_id IN (${idPlaceholders})` : '';
    const jiPartnerWhere = ` AND (TRIM(ji.partner_name) IN (${pPlaceholders})${idClause})`;
    
    let jiPeriodWhere = '';
    const jiParams = [];
    if (df && dt) {
      jiPeriodWhere = ` AND ji.date >= ? AND ji.date <= ?`;
      jiParams.push(df, dt);
    }
    jiParams.push(...scopePartnerNames);
    if (scopePartnerIds.length > 0) {
      jiParams.push(...scopePartnerIds);
    }

    const coPlaceholders = targetLedgerIds.map(() => '?').join(',');

    // 1. Total credit movements on asset_receivable for customer scope (excluding credit notes)
    const totCreditsRow = this.db.prepare(`
      SELECT ROUND(SUM(ji.credit), 2) as tot
      FROM journal_items ji
      WHERE ji.company_id IN (${coPlaceholders})
        AND ji.account_type = 'asset_receivable'
        AND ji.move_state = 'posted'
        AND (ji.move_type != 'out_refund' OR ji.move_type IS NULL)
        ${jiPeriodWhere}
        ${jiPartnerWhere}
    `).get(...targetLedgerIds, ...jiParams);
    const totalCreditMovements = totCreditsRow ? (totCreditsRow.tot || 0) : 0;

    // 2. Allocations on OTHER journals for scope partners
    let otherBreakdown = [];
    let allocatedOther = 0;
    if (jNamesList.length > 0 || (journalIds && journalIds.length > 0) || (costCenters && costCenters.length > 0)) {
      let paOtherWhere = `WHERE pa.company_id IN (${coPlaceholders})
        AND pa.channel != 'credit_note'`;
      const paOtherParams = [...targetLedgerIds];
      if (df && dt) {
        paOtherWhere += ` AND pa.payment_date >= ? AND pa.payment_date <= ?`;
        paOtherParams.push(df, dt);
      }
      if (jNamesList.length > 0) {
        paOtherWhere += ` AND pa.invoice_journal_name NOT IN (${jNamesList.map(() => '?').join(',')})`;
        paOtherParams.push(...jNamesList);
      } else if ((journalIds && journalIds.length > 0) || (costCenters && costCenters.length > 0)) {
        const ccFilter = this._buildCostCenterCondition({ journalIds, costCenters, tableAlias: 'pa', prefix: 'sec5pa_' });
        const excludeConds = [];
        if (ccFilter.pairs && ccFilter.pairs.length > 0) {
          ccFilter.pairs.forEach((pair) => {
            const matchParts = ['pa.cost_center_key = ?'];
            const matchVals = [pair.costCenterKey];
            if (pair.altKey && pair.altKey !== pair.costCenterKey) {
              matchParts.push('pa.cost_center_key = ?');
              matchVals.push(pair.altKey);
            }
            if (pair.name) {
              matchParts.push('pa.cost_center_name = ?');
              matchVals.push(pair.name);
            }
            const matchExpr = matchParts.length > 1 ? `(${matchParts.join(' OR ')})` : matchParts[0];

            if (pair.companyId) {
              excludeConds.push(`(pa.company_id = ? AND ${matchExpr})`);
              paOtherParams.push(pair.companyId, ...matchVals);
            } else {
              excludeConds.push(matchExpr);
              paOtherParams.push(...matchVals);
            }
          });
        } else {
          if (ccFilter.names && ccFilter.names.length > 0) {
            const ph = ccFilter.names.map(() => '?').join(',');
            excludeConds.push(`TRIM(pa.invoice_journal_name) IN (${ph})`);
            paOtherParams.push(...ccFilter.names);
          }
          if (ccFilter.costCenterKeys && ccFilter.costCenterKeys.length > 0) {
            const ph = ccFilter.costCenterKeys.map(() => '?').join(',');
            excludeConds.push(`pa.cost_center_key IN (${ph})`);
            paOtherParams.push(...ccFilter.costCenterKeys);
          }
        }
        if (excludeConds.length > 0) {
          paOtherWhere += ` AND NOT (${excludeConds.join(' OR ')})`;
        }
      }
      const paIdClause = scopePartnerIds.length > 0 ? ` OR pa.partner_id IN (${idPlaceholders})` : '';
      paOtherWhere += ` AND (TRIM(pa.partner_name) IN (${pPlaceholders})${paIdClause})`;
      paOtherParams.push(...scopePartnerNames);
      if (scopePartnerIds.length > 0) {
        paOtherParams.push(...scopePartnerIds);
      }

      otherBreakdown = this.db.prepare(`
        SELECT 
          COALESCE(NULLIF(TRIM(pa.invoice_journal_name), ''), 'بدون دفتر') as journal_name,
          ROUND(SUM(pa.amount), 2) as amount
        FROM payment_allocations pa
        ${paOtherWhere}
        GROUP BY pa.invoice_journal_name
        ORDER BY amount DESC
      `).all(...paOtherParams);
      allocatedOther = round(otherBreakdown.reduce((s, j) => s + (j.amount || 0), 0));
    }

    // 3. Unallocated payment moves & residual balances for these customers
    const creditMoves = this.db.prepare(`
      SELECT 
        ji.company_id,
        c.name as company_name,
        ji.move_name,
        ji.date,
        TRIM(ji.partner_name) as partner_name,
        ROUND(SUM(ji.credit), 2) as move_credit
      FROM journal_items ji
      JOIN companies c ON c.id = ji.company_id
      WHERE ji.company_id IN (${coPlaceholders})
        AND ji.account_type = 'asset_receivable'
        AND ji.move_state = 'posted'
        AND ji.credit > 0
        AND (ji.move_type != 'out_refund' OR ji.move_type IS NULL)
        ${jiPeriodWhere}
        ${jiPartnerWhere}
      GROUP BY ji.company_id, ji.move_name
      ORDER BY move_credit DESC
    `).all(...targetLedgerIds, ...jiParams);

    const unallocMoves = [];
    for (const mc of creditMoves) {
      const paAllocRow = this.db.prepare(`
        SELECT ROUND(SUM(amount), 2) as tot_alloc
        FROM payment_allocations
        WHERE company_id = ? AND payment_move_name = ? AND channel != 'credit_note'
      `).get(mc.company_id, mc.move_name);

      const totAlloc = paAllocRow?.tot_alloc || 0;
      const unallocAmt = round(mc.move_credit - totAlloc);
      if (unallocAmt > 0.005) {
        unallocMoves.push({
          company_id: mc.company_id,
          company_name: mc.company_name,
          move_name: mc.move_name,
          date: mc.date,
          partner_name: mc.partner_name,
          amount: unallocAmt,
          is_partial: totAlloc > 0,
          type_label: totAlloc > 0 ? 'متبقي غير مخصص من دفعة سداد' : 'دفعة كاملة غير مربوطة بفاتورة',
          allocated_amount: totAlloc,
          move_credit: mc.move_credit
        });
      }
    }

    const unallocTotal = round(unallocMoves.reduce((s, m) => s + m.amount, 0));

    // Update cards unallocated values to match Section 5 customer scope
    cards.unallocated_balance = unallocTotal;
    cards.unallocated_lines_count = unallocMoves.length;

    const accountedFor = round(cards.total_collected + cards.discount_fees + allocatedOther + unallocTotal);
    const diff = round(Math.abs(totalCreditMovements - accountedFor));

    const accountsComparison = {
      customer_count: scopePartnerNames.filter(n => n !== '__NONE__').length,
      total_credit_movements: totalCreditMovements,
      allocated_in_scope: cards.total_collected,
      discount_fees: cards.discount_fees,
      allocated_other_journals: allocatedOther,
      unallocated: unallocTotal,
      accounted_for: accountedFor,
      diff: diff <= 0.01 ? 0 : diff,
      status: diff <= 0.01 ? 'matched' : 'diff',
      other_journals_breakdown: otherBreakdown,
      unallocated_moves: unallocMoves,
      equation_note: 'إجمالي الدائن (حركات القيود باستثناء الإشعارات) = مخصص لفواتير النطاق + خصومات ورسوم + مخصص لدفاتر أخرى + دفعات غير مخصصة + فروقات غير مفسرة'
    };

    if (scopedCostCenters && Array.isArray(scopedCostCenters) && scopedCostCenters.length > 0) {
      delete accountsComparison.allocated_other_journals;
      delete accountsComparison.other_journals_breakdown;
    }

    // ── 6. «سدادات خارج بنك الشركة» - Audit / Oversight List
    const auditNonBankPayments = this.db.prepare(`
      SELECT 
        pa.id,
        pa.company_id,
        c.name as company_name,
        pa.payment_move_name,
        pa.payment_date,
        pa.partner_id,
        pa.partner_name,
        pa.payment_label,
        pa.payment_journal_name,
        pa.counterpart_account_code,
        pa.counterpart_account_name,
        pa.counterpart_partner_name,
        pa.channel,
        pa.channel_label,
        pa.sister_company_name,
        pa.amount,
        pa.invoice_name,
        pa.invoice_date,
        pa.invoice_journal_name
      FROM payment_allocations pa
      JOIN companies c ON c.id = pa.company_id
      ${whereSql}
        AND pa.channel IN ('sister_company', 'other_adjustment')
      ORDER BY pa.payment_date DESC, pa.amount DESC
      LIMIT 250
    `).all(params);

    // Counterpart bank move lookup for sister_company entries
    const sisterAllocRows = auditNonBankPayments.filter(p => p.channel === 'sister_company');
    if (sisterAllocRows.length > 0) {
      const uniqueMoveKeys = [...new Set(sisterAllocRows.map(p => `${p.company_id}:${p.payment_move_name}`))];
      const moveTotalsMap = new Map();
      for (const k of uniqueMoveKeys) {
        const [cid, mName] = k.split(':');
        const r = this.db.prepare(`
          SELECT ROUND(SUM(debit), 2) as tot_debit
          FROM journal_items
          WHERE company_id = ? AND move_name = ?
        `).get(Number(cid), mName);
        moveTotalsMap.set(k, r?.tot_debit || 0);
      }

      const matchStmt = this.db.prepare(`
        SELECT ji.move_name, c.name as company_name, ji.debit
        FROM journal_items ji
        JOIN companies c ON c.id = ji.company_id
        WHERE ji.company_id != ?
          AND (ji.account_type = 'asset_cash' OR ji.journal_type IN ('bank', 'cash') OR ji.account_code LIKE '10%' OR ji.account_code LIKE '12%')
          AND (ABS(ji.debit - ?) < 0.05 OR ABS(ji.debit - ?) < 0.05)
          AND ji.date >= date(?, '-3 days') AND ji.date <= date(?, '+3 days')
        LIMIT 1
      `);

      for (const p of auditNonBankPayments) {
        if (p.channel === 'sister_company') {
          const moveTot = moveTotalsMap.get(`${p.company_id}:${p.payment_move_name}`) || p.amount;
          const match = matchStmt.get(p.company_id, p.amount, moveTot, p.payment_date, p.payment_date);
          p.counterpart_bank_move = match ? match.move_name : 'لا مقابل';
        } else {
          p.counterpart_bank_move = '—';
        }
      }
    } else {
      for (const p of auditNonBankPayments) {
        p.counterpart_bank_move = '—';
      }
    }

    const auditSummary = {
      total_non_bank_amount: round(auditNonBankPayments.reduce((s, p) => s + (p.amount || 0), 0)),
      transactions_count: auditNonBankPayments.length
    };

    return {
      period: period.label,
      date_from: df,
      date_to: dt,
      available_journals,
      cards,
      periodic_series: periodicSeries,
      by_invoice_year: byInvoiceYear,
      tree: companyTree,
      clients_direct: clientsDirect,
      accounts_comparison: accountsComparison,
      audit_non_bank_payments: auditNonBankPayments,
      audit_summary: auditSummary,
      totals: {
        bank: cards.bank_collected,
        sister_company: cards.sister_collected,
        other_adjustment: cards.other_collected,
        discount_fees: cards.discount_fees,
        total_collected: cards.total_collected,
        credit_notes: cards.credit_notes,
        payments_count: cards.payments_count,
        invoices_count: cards.invoices_count
      }
    };
  }

  /**
   * C1: Get detailed payment allocation records for a specific partner or invoice (Level 5 Lazy Load)
   */
  getCollectionPayments(options = {}) {
    const {
      companyId,
      partnerId,
      journalId,
      journalIds,
      costCenters,
      costCenterKey,
      journalNames,
      invoiceName,
      years,
      dateFrom,
      dateTo,
      channel,
      page = 1,
      limit = 100,
      scopedCostCenters
    } = options;

    const whereClauses = [];
    const params = {};

    if (companyId) {
      whereClauses.push('pa.company_id = @companyId');
      params.companyId = Number(companyId);
    }
    if (partnerId) {
      whereClauses.push('pa.partner_id = @partnerId');
      params.partnerId = Number(partnerId);
    }
    if ((journalIds && journalIds.length > 0) || (costCenters && costCenters.length > 0)) {
      const ccFilter = this._buildCostCenterCondition({ journalIds, costCenters, tableAlias: 'pa', prefix: 'paycc_' });
      if (ccFilter.sql) {
        whereClauses.push(ccFilter.sql.replace(/^\s*AND\s*/i, ''));
        Object.assign(params, ccFilter.params);
      }
    } else if (costCenterKey) {
      const ccFilter = this._buildCostCenterCondition({ journalIds: [costCenterKey], tableAlias: 'pa', prefix: 'paycc_single_' });
      if (ccFilter.sql) {
        whereClauses.push(ccFilter.sql.replace(/^\s*AND\s*/i, ''));
        Object.assign(params, ccFilter.params);
      }
    } else if (journalId) {
      whereClauses.push('pa.invoice_journal_id = @journalId');
      params.journalId = Number(journalId);
    } else if (scopedCostCenters && Array.isArray(scopedCostCenters) && scopedCostCenters.length > 0) {
      const sMap = new Map();
      for (const sc of scopedCostCenters) {
        const cId = Number(sc.companyId);
        if (!sMap.has(cId)) sMap.set(cId, []);
        sMap.get(cId).push(sc.costCenterKey);
      }
      const sClauses = [];
      let sIdx = 0;
      for (const [cId, keys] of sMap.entries()) {
        const kPh = keys.map((_, i) => `@pay_sc_${sIdx}_${i}`).join(',');
        keys.forEach((k, i) => { params[`pay_sc_${sIdx}_${i}`] = k; });
        params[`pay_sc_cid_${sIdx}`] = cId;
        sClauses.push(`(pa.company_id = @pay_sc_cid_${sIdx} AND pa.cost_center_key IN (${kPh}))`);
        sIdx++;
      }
      if (sClauses.length > 0) {
        whereClauses.push(`(${sClauses.join(' OR ')})`);
      }
    }
    if (journalNames) {
      const rawArr = Array.isArray(journalNames) ? journalNames : String(journalNames).split(',');
      const jList = [];
      for (const jn of rawArr) {
        if (jn && typeof jn === 'string') {
          const trimmed = jn.trim();
          if (trimmed && !jList.includes(trimmed)) jList.push(trimmed);
        }
      }
      if (jList.length > 0) {
        const jConditions = jList.map((_, idx) => `(TRIM(pa.invoice_journal_name) = @jName_${idx} OR pa.invoice_journal_name = @jName_${idx})`);
        jList.forEach((jn, idx) => { params[`jName_${idx}`] = jn; });
        whereClauses.push(`(${jConditions.join(' OR ')})`);
      }
    }
    if (invoiceName) {
      whereClauses.push('pa.invoice_name = @invoiceName');
      params.invoiceName = invoiceName;
    }
    if (channel) {
      whereClauses.push('pa.channel = @channel');
      params.channel = channel;
    }

    const period = this._periodFilter({ years, dateFrom, dateTo, defaultToCurrentYear: true }, 'pa.payment_date', 'cp_');
    if (period.sql !== '1=1') {
      whereClauses.push(period.sql);
      Object.assign(params, period.params);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    const offset = (Math.max(1, Number(page)) - 1) * Number(limit);

    const rows = this.db.prepare(`
      SELECT 
        pa.id,
        pa.channel,
        pa.channel_label,
        pa.payment_date,
        pa.partner_name,
        c.name as company_name,
        pa.invoice_name,
        pa.invoice_date,
        pa.payment_journal_name,
        pa.payment_move_name,
        pa.payment_label,
        pa.counterpart_account_code,
        pa.counterpart_account_name,
        pa.counterpart_partner_name,
        pa.amount,
        pa.sister_company_name,
        pa.cost_center_key,
        pa.cost_center_name
      FROM payment_allocations pa
      JOIN companies c ON c.id = pa.company_id
      ${whereSql}
      ORDER BY pa.payment_date DESC, pa.amount DESC
      LIMIT ${Number(limit)} OFFSET ${offset}
    `).all(params);

    const countRow = this.db.prepare(`
      SELECT COUNT(*) as total_count, ROUND(SUM(pa.amount), 2) as total_amount
      FROM payment_allocations pa
      ${whereSql}
    `).get(params);

    return {
      rows,
      total_count: countRow ? countRow.total_count : 0,
      total_amount: countRow ? (countRow.total_amount || 0) : 0,
      page: Number(page),
      limit: Number(limit)
    };
  }

  /**
   * F1-b: Deep Search across hierarchy for lazy-loaded or deep nodes
   * Matches: invoice number, move name, customer name, account code/name, journal name
   * Returns paths to auto-expand matching nodes in TreeTable
   */
  searchHierarchyPaths(options = {}) {
    const { companyIds, years, dateFrom, dateTo, query, scopedCostCenters } = options;
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return { matches: [] };
    }
    const qRaw = query.trim();
    const qClean = qRaw.replace(/[%_]/g, '');
    if (!qClean) return { matches: [] };

    function normAr(t) {
      if (!t) return '';
      return String(t)
        .replace(/[\u064B-\u065F\u0670]/g, '')
        .replace(/\u0640/g, '')
        .replace(/[أإآٱ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/[ىي]/g, 'ي')
        .replace(/[٠-٩]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    }
    const normQ = normAr(qClean);

    const matches = [];
    const limit = 50;

    // 1. Search in sales_invoices (for invoice numbers and customers)
    let invWhere = `WHERE (NORM_AR(si.name) LIKE @likeQ OR NORM_AR(si.partner_name) LIKE @likeQ OR NORM_AR(si.journal_name) LIKE @likeQ)`;
    const invParams = { likeQ: `%${normQ}%` };
    if (companyIds && companyIds.length > 0) {
      invWhere += ` AND c.id IN (${companyIds.map((_, i) => `@cid_${i}`).join(',')})`;
      companyIds.forEach((id, i) => { invParams[`cid_${i}`] = Number(id); });
    }
    if (dateFrom) {
      invWhere += ` AND si.date >= @df`;
      invParams.df = dateFrom;
    }
    if (dateTo) {
      invWhere += ` AND si.date <= @dt`;
      invParams.dt = dateTo;
    } else if (years && !years.includes('ALL')) {
      const yrArr = (Array.isArray(years) ? years : String(years).split(',')).map(y => y.trim()).filter(Boolean);
      if (yrArr.length > 0) {
        invWhere += ` AND strftime('%Y', si.date) IN (${yrArr.map((_, i) => `@yr_${i}`).join(',')})`;
        yrArr.forEach((y, i) => { invParams[`yr_${i}`] = y; });
      }
    }

    if (scopedCostCenters && Array.isArray(scopedCostCenters) && scopedCostCenters.length > 0) {
      const scopedCoMap = new Map();
      for (const sc of scopedCostCenters) {
        const cId = Number(sc.companyId);
        if (!scopedCoMap.has(cId)) scopedCoMap.set(cId, []);
        scopedCoMap.get(cId).push(sc.costCenterKey);
      }
      const scopeClauses = [];
      let sIdx = 0;
      for (const [cId, keys] of scopedCoMap.entries()) {
        const kPh = keys.map((_, i) => `@inv_sc_k_${sIdx}_${i}`).join(',');
        keys.forEach((k, i) => { invParams[`inv_sc_k_${sIdx}_${i}`] = k; });
        invParams[`inv_sc_cid_${sIdx}`] = cId;
        scopeClauses.push(`(c.id = @inv_sc_cid_${sIdx} AND id.cost_center_key IN (${kPh}))`);
        sIdx++;
      }
      if (scopeClauses.length > 0) {
        invWhere += ` AND (${scopeClauses.join(' OR ')})`;
      }
    }

    const idJoin = (scopedCostCenters && scopedCostCenters.length > 0)
      ? 'JOIN invoice_departments id ON id.sales_invoice_id = si.id'
      : 'LEFT JOIN invoice_departments id ON id.sales_invoice_id = si.id';

    const invoices = this.db.prepare(`
      SELECT 
        si.id,
        si.name as invoice_name,
        c.id as company_id,
        c.name as company_name,
        COALESCE(id.department_id, agm.group_id, 0) as department_id,
        ${this._groupNameSql('ag', 'id.cost_center_name')} as group_name,
        id.cost_center_key,
        id.cost_center_name,
        si.journal_id,
        COALESCE(NULLIF(TRIM(si.journal_name), ''), 'بدون دفتر') as journal_name,
        si.partner_id,
        si.partner_name,
        si.amount_total,
        si.amount_residual_signed
      FROM sales_invoices si
      JOIN sales_companies sc ON sc.id = si.company_id
      JOIN companies c ON c.odoo_company_id = sc.sales_company_id
      ${idJoin}
      LEFT JOIN analytic_group_mapping agm ON agm.company_id = c.id AND (agm.journal_id = si.journal_id OR TRIM(agm.journal_name) = TRIM(si.journal_name))
      LEFT JOIN analytic_groups ag ON ag.id = COALESCE(id.department_id, agm.group_id)
      ${invWhere}
      ORDER BY si.date DESC
      LIMIT ${limit}
    `).all(invParams);

    for (const inv of invoices) {
      const rawDeptId = inv.department_id || 0;
      const gId = this._resolveGroupId(rawDeptId, inv.cost_center_key);
      const ccKey = inv.cost_center_key || ('j:' + (inv.journal_id || 0));
      const jId = inv.journal_id !== undefined ? inv.journal_id : 0;
      const pId = inv.partner_id || inv.partner_name;
      matches.push({
        type: 'invoice',
        id: inv.id,
        name: inv.invoice_name,
        label: `${inv.invoice_name} (${inv.partner_name})`,
        company_id: inv.company_id,
        company_name: inv.company_name,
        group_id: gId,
        group_name: inv.group_name,
        cost_center_key: ccKey,
        cost_center_name: inv.cost_center_name || inv.journal_name,
        journal_id: inv.journal_id,
        journal_name: inv.journal_name,
        partner_id: inv.partner_id,
        partner_name: inv.partner_name,
        path: [
          `co:${inv.company_id}`,
          `dept:${gId}`,
          `journal:${ccKey}`,
          `partner:${inv.partner_id}`,
          `inv:${inv.id}`
        ],
        exec_path: [
          `co:${inv.company_id}`,
          `dept:${gId}`,
          `grp:clients`,
          `j:${ccKey}`,
          `p:${pId}`
        ]
      });
    }

    // 2. Search in journal_items (for move numbers, account codes/names)
    let jiWhere = `WHERE (NORM_AR(ji.move_name) LIKE @likeQ OR NORM_AR(ji.account_code) LIKE @likeQ OR NORM_AR(ji.account_name) LIKE @likeQ OR NORM_AR(ji.partner_name) LIKE @likeQ)`;
    const jiParams = { likeQ: `%${normQ}%` };
    if (companyIds && companyIds.length > 0) {
      jiWhere += ` AND ji.company_id IN (${companyIds.map((_, i) => `@cid_${i}`).join(',')})`;
      companyIds.forEach((id, i) => { jiParams[`cid_${i}`] = Number(id); });
    }
    if (dateFrom) {
      jiWhere += ` AND ji.date >= @df`;
      jiParams.df = dateFrom;
    }
    if (dateTo) {
      jiWhere += ` AND ji.date <= @dt`;
      jiParams.dt = dateTo;
    } else if (years && !years.includes('ALL')) {
      const yrArr = (Array.isArray(years) ? years : String(years).split(',')).map(y => y.trim()).filter(Boolean);
      if (yrArr.length > 0) {
        jiWhere += ` AND ji.fiscal_year IN (${yrArr.map((_, i) => `@yr_${i}`).join(',')})`;
        yrArr.forEach((y, i) => { jiParams[`yr_${i}`] = y; });
      }
    }

    if (scopedCostCenters && Array.isArray(scopedCostCenters) && scopedCostCenters.length > 0) {
      const nameMap = new Map();
      for (const sc of scopedCostCenters) {
        const cId = Number(sc.companyId);
        const rows = this.db.prepare(`
          SELECT DISTINCT cost_center_name FROM invoice_departments 
          WHERE cost_center_key = ?
        `).all(sc.costCenterKey);
        for (const r of rows) {
          if (r.cost_center_name) {
            if (!nameMap.has(cId)) nameMap.set(cId, new Set());
            nameMap.get(cId).add(r.cost_center_name.trim());
          }
        }
      }

      const jiScopeClauses = [];
      let jiIdx = 0;
      for (const [cid, names] of nameMap.entries()) {
        const nList = Array.from(names);
        if (nList.length > 0) {
          const nPh = nList.map((_, i) => `@ji_name_${jiIdx}_${i}`).join(',');
          nList.forEach((n, i) => { jiParams[`ji_name_${jiIdx}_${i}`] = n; });
          jiParams[`ji_cid_${jiIdx}`] = cid;
          jiScopeClauses.push(`(ji.company_id = @ji_cid_${jiIdx} AND ji.analytic_account IN (${nPh}))`);
          jiIdx++;
        }
      }
      if (jiScopeClauses.length > 0) {
        jiWhere += ` AND (${jiScopeClauses.join(' OR ')})`;
      } else {
        jiWhere += ` AND 1=0`;
      }
    }

    const entries = this.db.prepare(`
      SELECT DISTINCT
        ji.company_id,
        c.name as company_name,
        ji.move_name,
        ji.account_code,
        ji.account_name,
        ji.partner_id,
        ji.partner_name,
        ji.analytic_account
      FROM journal_items ji
      JOIN companies c ON c.id = ji.company_id
      ${jiWhere}
        AND ji.move_state = 'posted'
      LIMIT 25
    `).all(jiParams);

    for (const ent of entries) {
      matches.push({
        type: 'journal_item',
        name: ent.move_name || ent.account_name,
        label: `${ent.move_name ? ent.move_name + ' · ' : ''}${ent.account_code || ''} ${ent.account_name || ''}`,
        company_id: ent.company_id,
        company_name: ent.company_name,
        partner_id: ent.partner_id,
        partner_name: ent.partner_name,
        account_code: ent.account_code,
        account_name: ent.account_name,
        path: [
          `co:${ent.company_id}`,
          `node:${ent.account_code || ent.move_name}`
        ]
      });
    }

    return { matches, query: qRaw, total: matches.length };
  }

  /**
   * DC1: Departments comparison (مقارنة الأقسام) on ONE tax-exclusive basis.
   * Hierarchy: Department (analytic group, aggregated across companies) -> Cost Center -> Company.
   *
   * Columns:
   *  - revenue / expenses: fact_daily (income / expense accounts only), same scope as the executive tab.
   *  - cash_collected: payment_allocations by payment date, the same channels as the collections tab's
   *    total_collected (bank + sister_company + other_adjustment), NET of VAT per allocation:
   *    amount * (invoice.amount_untaxed / invoice.amount_total).
   *    Allocations whose invoice is missing, ambiguous or has amount_total = 0 are never assumed:
   *    they are excluded from the net figure and returned in `exceptions`.
   *  - collected_invoices / residual_gross: invoices dated in the period, pinned to the executive tab's figures.
   *  - remaining: the tax-exclusive part of what is still unpaid on period invoices (untaxed * residual / total);
   *    billed = collected_invoices + remaining on every row.
   *  - open_total: what is still unpaid today on ALL invoices dated up to the end of the selected period
   *    (= remaining of period invoices + open invoices dated outside the period, up to the cut-off).
   *
   * Rounding: every (company, department) cell is pinned to the integer the executive tab displays,
   * then split over cost centers by largest remainder, so parent == sum of displayed children at every level.
   */
  getDepartmentsComparison({ companyIds, years, year, dateFrom, dateTo, asOfDate, departmentIds, journalIds, costCenters, scopedCostCenters } = {}) {
    // Scoped share link: every query below is restricted to the link's (company, cost center) pairs inside its SQL.
    // A requested pair is honoured only when it belongs to the scope; with none requested, the whole scope applies.
    if (scopedCostCenters && Array.isArray(scopedCostCenters) && scopedCostCenters.length > 0) {
      const scopePairs = scopedCostCenters.map(sc => `${Number(sc.companyId)}|${sc.costCenterKey}`);
      const requested = [...(costCenters || []), ...(journalIds || [])].map(String).filter(v => scopePairs.includes(v));
      costCenters = requested.length > 0 ? Array.from(new Set(requested)) : scopePairs;
      journalIds = undefined;
      const scopeCompanyIds = Array.from(new Set(scopedCostCenters.map(sc => Number(sc.companyId))));
      const requestedCompanies = companyIds ? (Array.isArray(companyIds) ? companyIds : String(companyIds).split(',')).map(Number).filter(id => scopeCompanyIds.includes(id)) : [];
      companyIds = requestedCompanies.length > 0 ? requestedCompanies : scopeCompanyIds;
    }
    const round1 = (n) => Math.round(n * 10) / 10;
    const round2 = (n) => Math.round((n || 0) * 100) / 100;
    const cashChannelsSql = `pa.channel IN ('bank', 'sister_company', 'other_adjustment')`;

    // 1. Executive tab output for the same filters: the pinned targets per (company, department)
    const exec = this.getExecutiveSummary({
      companyIds, years, year, dateFrom, dateTo, asOfDate,
      fullTree: false, includeAging: false,
      departmentIds, journalIds, costCenters, scopedCostCenters
    });
    const execCompanies = exec.tree.rows;
    const targetLedgerIds = execCompanies.map(c => c.company_id);
    const companyNames = new Map(execCompanies.map(c => [c.company_id, c.name]));
    const execCells = new Map();
    const execDeptCount = new Map();
    for (const co of execCompanies) {
      execDeptCount.set(co.company_id, (co.children || []).length);
      for (const d of (co.children || [])) {
        execCells.set(`${co.company_id}|${d.department_id}`, d);
      }
    }

    // 2. Scope conditions (same builders as the executive and collections tabs)
    const period = this._periodFilter({ years, year, dateFrom, dateTo, asOfDate, defaultToCurrentYear: true }, 'si.date', 'dc_');
    const hasDept = departmentIds && departmentIds.length > 0;
    const hasCc = (journalIds && journalIds.length > 0) || (costCenters && costCenters.length > 0);

    const fdParams = {};
    const lPh = targetLedgerIds.map((_, i) => `@dc_lc_${i}`).join(',');
    targetLedgerIds.forEach((id, i) => { fdParams[`dc_lc_${i}`] = id; });
    let fdWhere = `WHERE fd.company_id IN (${lPh})`;
    if (period.sql !== '1=1') {
      const fdPeriod = this._periodFilter({ years: period.yearsList, dateFrom: period.dateFrom, dateTo: period.dateTo }, 'fd.date', 'dcfd_');
      if (fdPeriod.sql !== '1=1') {
        fdWhere += ` AND ${fdPeriod.sql}`;
        Object.assign(fdParams, fdPeriod.params);
      }
    }
    if (hasDept) {
      const g = this._buildGroupCondition({ departmentIds, tableAlias: 'fd', prefix: 'dc_d_' });
      fdWhere += g.sql;
      Object.assign(fdParams, g.params);
    }
    if (hasCc) {
      const cc = this._buildCostCenterCondition({ journalIds, costCenters, tableAlias: 'fd', prefix: 'dcFdCC_' });
      fdWhere += cc.sql;
      Object.assign(fdParams, cc.params);
    }

    const invParams = {};
    const salesIds = targetLedgerIds.map(id => this._getSalesCid(id));
    const sPh = salesIds.map((_, i) => `@dc_sc_${i}`).join(',');
    salesIds.forEach((id, i) => { invParams[`dc_sc_${i}`] = id; });
    let invWhere = `WHERE si.company_id IN (${sPh})`;
    if (period.sql !== '1=1') {
      invWhere += ` AND ${period.sql}`;
      Object.assign(invParams, period.params);
    }
    if (hasDept) {
      const g = this._buildGroupCondition({ departmentIds, tableAlias: 'id', prefix: 'dc_d_inv_' });
      invWhere += g.sql;
      Object.assign(invParams, g.params);
    }
    if (hasCc) {
      const cc = this._buildCostCenterCondition({ journalIds, costCenters, tableAlias: 'si', prefix: 'dcInvCC_' });
      invWhere += cc.sql;
      Object.assign(invParams, cc.params);
    }

    const paParams = {};
    const pPh = targetLedgerIds.map((_, i) => `@dc_pc_${i}`).join(',');
    targetLedgerIds.forEach((id, i) => { paParams[`dc_pc_${i}`] = id; });
    let paWhere = `WHERE pa.company_id IN (${pPh})`;
    const paPeriod = this._periodFilter({ years, year, dateFrom, dateTo, asOfDate, defaultToCurrentYear: true }, 'pa.payment_date', 'dcpa_');
    if (paPeriod.sql !== '1=1') {
      paWhere += ` AND ${paPeriod.sql}`;
      Object.assign(paParams, paPeriod.params);
    }
    if (hasDept) {
      const g = this._buildGroupCondition({ departmentIds, tableAlias: 'pa', prefix: 'dc_d_pa_' });
      paWhere += g.sql;
      Object.assign(paParams, g.params);
    }
    if (hasCc) {
      const cc = this._buildCostCenterCondition({ journalIds, costCenters, tableAlias: 'pa', prefix: 'dcPaCC_' });
      paWhere += cc.sql;
      Object.assign(paParams, cc.params);
    }

    // 3. Leaf rows per (company, department, cost center)
    const fdRows = this.db.prepare(`
      SELECT
        fd.company_id as cid,
        fd.department_id,
        fd.cost_center_key,
        fd.cost_center_name,
        ${this._groupNameSql('ag', 'fd.cost_center_name')} as department_name,
        SUM(fd.revenue) as revenue,
        SUM(fd.expense) as expense
      FROM fact_daily fd
      LEFT JOIN analytic_groups ag ON ag.id = fd.department_id
      ${fdWhere}
      GROUP BY fd.company_id, fd.department_id, fd.cost_center_key
      HAVING (SUM(fd.revenue) != 0 OR SUM(fd.expense) != 0)
    `).all(fdParams);

    const invRows = this.db.prepare(`
      SELECT
        c.id as cid,
        id.department_id,
        id.cost_center_key,
        id.cost_center_name,
        ${this._groupNameSql('ag', 'id.cost_center_name')} as department_name,
        SUM(si.amount_untaxed * id.share) as billed,
        SUM(CASE WHEN si.amount_total != 0 THEN (si.amount_untaxed * (si.amount_total - si.amount_residual_signed) / si.amount_total) * id.share ELSE 0 END) as collected,
        SUM(si.amount_residual_signed * id.share) as residual
      FROM sales_invoices si
      JOIN sales_companies sc ON sc.id = si.company_id
      JOIN companies c ON c.odoo_company_id = sc.sales_company_id
      JOIN invoice_departments id ON id.sales_invoice_id = si.id
      LEFT JOIN analytic_groups ag ON ag.id = id.department_id
      ${invWhere}
      GROUP BY c.id, id.department_id, id.cost_center_key
    `).all(invParams);

    // Open invoices dated up to the cut-off but outside the period (the period's own remainder comes from invRows)
    let cutoffDate = null;
    if (!period.isAll) {
      cutoffDate = period.dateTo || `${period.yearsList[period.yearsList.length - 1]}-12-31`;
    }
    let otherOpenRows = [];
    if (cutoffDate) {
      const ooParams = { dc_cutoff: cutoffDate, ...period.params };
      salesIds.forEach((id, i) => { ooParams[`dc_sc_${i}`] = id; });
      let ooWhere = `WHERE si.company_id IN (${sPh}) AND si.date <= @dc_cutoff AND NOT (${period.sql})`;
      if (hasDept) {
        const g = this._buildGroupCondition({ departmentIds, tableAlias: 'id', prefix: 'dc_d_oo_' });
        ooWhere += g.sql;
        Object.assign(ooParams, g.params);
      }
      if (hasCc) {
        const cc = this._buildCostCenterCondition({ journalIds, costCenters, tableAlias: 'si', prefix: 'dcOoCC_' });
        ooWhere += cc.sql;
        Object.assign(ooParams, cc.params);
      }
      otherOpenRows = this.db.prepare(`
        SELECT
          c.id as cid,
          id.department_id,
          id.cost_center_key,
          id.cost_center_name,
          ${this._groupNameSql('ag', 'id.cost_center_name')} as department_name,
          SUM(si.amount_residual_signed * id.share) as open_gross,
          SUM(CASE WHEN si.amount_total != 0 THEN (si.amount_untaxed * si.amount_residual_signed / si.amount_total) * id.share ELSE 0 END) as open_untaxed
        FROM sales_invoices si
        JOIN sales_companies sc ON sc.id = si.company_id
        JOIN companies c ON c.odoo_company_id = sc.sales_company_id
        JOIN invoice_departments id ON id.sales_invoice_id = si.id
        LEFT JOIN analytic_groups ag ON ag.id = id.department_id
        ${ooWhere}
          AND si.amount_residual_signed != 0
        GROUP BY c.id, id.department_id, id.cost_center_key
      `).all(ooParams);
    }

    // One row per (sales company, Odoo invoice id); n != 1 marks an ambiguous link
    const invLinkSql = `
      LEFT JOIN (
        SELECT company_id, invoice_id, COUNT(*) as n, MAX(amount_total) as amount_total, MAX(amount_untaxed) as amount_untaxed
        FROM sales_invoices
        GROUP BY company_id, invoice_id
      ) inv ON inv.company_id = pa.sales_company_id AND inv.invoice_id = pa.invoice_id
    `;
    const invUsableSql = `(inv.n = 1 AND inv.amount_total IS NOT NULL AND inv.amount_total != 0)`;

    const paRows = this.db.prepare(`
      SELECT
        pa.company_id as cid,
        pa.department_id,
        pa.cost_center_key,
        pa.cost_center_name,
        ${this._groupNameSql('ag', 'pa.cost_center_name')} as department_name,
        SUM(CASE WHEN ${cashChannelsSql} THEN pa.amount ELSE 0 END) as gross,
        SUM(CASE WHEN ${cashChannelsSql} AND ${invUsableSql} THEN pa.amount * inv.amount_untaxed / inv.amount_total ELSE 0 END) as net,
        SUM(CASE WHEN ${cashChannelsSql} AND NOT COALESCE(${invUsableSql}, 0) THEN pa.amount ELSE 0 END) as exception_gross
      FROM payment_allocations pa
      LEFT JOIN analytic_groups ag ON ag.id = pa.department_id
      ${invLinkSql}
      ${paWhere}
      GROUP BY pa.company_id, pa.department_id, pa.cost_center_key
    `).all(paParams);

    const exceptionItems = this.db.prepare(`
      SELECT
        pa.company_id,
        pa.invoice_id,
        pa.invoice_name,
        pa.partner_name,
        pa.payment_move_name,
        pa.payment_date,
        pa.amount,
        CASE
          WHEN pa.invoice_id IS NULL THEN 'no_invoice'
          WHEN inv.n IS NULL THEN 'invoice_not_found'
          WHEN inv.n != 1 THEN 'invoice_ambiguous'
          ELSE 'invoice_total_zero'
        END as reason
      FROM payment_allocations pa
      ${invLinkSql}
      ${paWhere}
        AND ${cashChannelsSql}
        AND NOT COALESCE(${invUsableSql}, 0)
      ORDER BY pa.amount DESC
    `).all(paParams);

    // 4. Merge into leaves
    const MEASURES = ['revenue', 'expenses', 'collected_invoices', 'remaining', 'residual_gross', 'cash_collected', 'cash_collected_gross', 'other_open', 'other_open_gross'];
    const leaves = new Map();
    const deptNames = new Map();
    const getLeaf = (r) => {
      const did = this._resolveGroupId(r.department_id, r.cost_center_key);
      const ccKey = (r.cost_center_key || '').trim();
      const key = `${did}|${ccKey}|${r.cid}`;
      if (!leaves.has(key)) {
        const raw = {};
        for (const m of MEASURES) raw[m] = 0;
        leaves.set(key, { did, ccKey, ccName: '', cid: r.cid, raw, val: {} });
      }
      const leaf = leaves.get(key);
      if (!leaf.ccName) leaf.ccName = (r.cost_center_name || '').replace(/\s+/g, ' ').trim();
      if (!deptNames.has(did) && r.department_name) deptNames.set(did, r.department_name);
      return leaf;
    };
    for (const r of fdRows) {
      const leaf = getLeaf(r);
      leaf.raw.revenue += r.revenue || 0;
      leaf.raw.expenses += r.expense || 0;
    }
    for (const r of invRows) {
      const leaf = getLeaf(r);
      leaf.raw.collected_invoices += r.collected || 0;
      leaf.raw.remaining += (r.billed || 0) - (r.collected || 0);
      leaf.raw.residual_gross += r.residual || 0;
    }
    let rawOtherOpen = 0, rawOtherOpenGross = 0;
    for (const r of otherOpenRows) {
      const leaf = getLeaf(r);
      leaf.raw.other_open += r.open_untaxed || 0;
      leaf.raw.other_open_gross += r.open_gross || 0;
      rawOtherOpen += r.open_untaxed || 0;
      rawOtherOpenGross += r.open_gross || 0;
    }
    let rawCashGross = 0, rawCashNet = 0, rawExceptionGross = 0;
    for (const r of paRows) {
      rawCashGross += r.gross || 0;
      rawCashNet += r.net || 0;
      rawExceptionGross += r.exception_gross || 0;
      if (!r.gross && !r.net) continue;
      const leaf = getLeaf(r);
      leaf.raw.cash_collected += r.net || 0;
      // The VAT-inclusive secondary figure covers the same allocations as the net one
      leaf.raw.cash_collected_gross += (r.gross || 0) - (r.exception_gross || 0);
    }

    // Largest-remainder split of an integer target over raw values
    const apportion = (items, measure, target, tolerance, label) => {
      const rawSum = items.reduce((s, it) => s + it.raw[measure], 0);
      if (Math.abs(target - rawSum) > tolerance) {
        throw new Error(`[DepartmentsComparison] ${label}: ${measure} target=${target} does not match its rows sum=${rawSum.toFixed(2)} (tolerance ${tolerance}).`);
      }
      for (const it of items) it.val[measure] = Math.round(it.raw[measure]);
      let diff = target - items.reduce((s, it) => s + it.val[measure], 0);
      const pool = items.filter(it => it.raw[measure] !== 0);
      const candidates = pool.length > 0 ? pool : items;
      while (diff !== 0) {
        const step = diff > 0 ? 1 : -1;
        let best = candidates[0];
        let bestRem = (best.raw[measure] - best.val[measure]) * step;
        for (const it of candidates) {
          const rem = (it.raw[measure] - it.val[measure]) * step;
          if (rem > bestRem) { best = it; bestRem = rem; }
        }
        best.val[measure] += step;
        diff -= step;
      }
    };

    // VAT-inclusive companion of an already-apportioned net measure: gross = net + rounded VAT share,
    // so a tax-free row shows the same figure on both lines and gross never drops below net by rounding.
    const apportionGross = (items, netMeasure, grossMeasure, target, label, pinned = false) => {
      const vatRaw = (it) => it.raw[grossMeasure] - it.raw[netMeasure];
      const vatVal = (it) => it.val[grossMeasure] - it.val[netMeasure];
      for (const it of items) it.val[grossMeasure] = it.val[netMeasure] + Math.round(vatRaw(it));
      let diff = target - items.reduce((s, it) => s + it.val[grossMeasure], 0);
      const pool = items.filter(it => Math.abs(vatRaw(it)) >= 0.005);
      if (diff !== 0 && (pool.length === 0 || Math.abs(diff) > pool.length + 1)) {
        if (!pinned) {
          throw new Error(`[DepartmentsComparison] ${label}: ${grossMeasure} target=${target} cannot be reached from its rows (diff ${diff}).`);
        }
        // The target is another tab's displayed integer: it wins over the net + VAT composition
        return false;
      }
      while (diff !== 0) {
        const step = diff > 0 ? 1 : -1;
        let best = pool[0];
        let bestRem = (vatRaw(best) - vatVal(best)) * step;
        for (const it of pool) {
          const rem = (vatRaw(it) - vatVal(it)) * step;
          if (rem > bestRem) { best = it; bestRem = rem; }
        }
        best.val[grossMeasure] += step;
        diff -= step;
      }
      return true;
    };

    // 5. Pin every (company, department) cell to the executive tab's displayed integers
    const cellLeaves = new Map();
    for (const leaf of leaves.values()) {
      const k = `${leaf.cid}|${leaf.did}`;
      if (!cellLeaves.has(k)) cellLeaves.set(k, []);
      cellLeaves.get(k).push(leaf);
    }
    const EXEC_FIELDS = { revenue: 'revenue', expenses: 'expenses', collected_invoices: 'collected', residual_gross: 'residual' };
    for (const k of new Set([...cellLeaves.keys(), ...execCells.keys()])) {
      const items = cellLeaves.get(k) || [];
      const cell = execCells.get(k);
      const cid = Number(k.split('|')[0]);
      // The executive tab pushes its own rounding remainders into one department per company
      const tolerance = 0.5 + Math.max(1, Math.ceil((execDeptCount.get(cid) || 0) * 0.5)) + 2;
      for (const [measure, execField] of Object.entries(EXEC_FIELDS)) {
        const target = cell ? (cell[execField] || 0) : 0;
        if (items.length === 0) {
          if (target !== 0) throw new Error(`[DepartmentsComparison] cell ${k}: executive ${execField}=${target} has no cost-center rows.`);
          continue;
        }
        apportion(items, measure, target, tolerance, `cell ${k}`);
      }
    }
    const allLeaves = Array.from(leaves.values());
    if (allLeaves.length > 0) {
      // Tax-exclusive remainder of period invoices: a row with nothing unpaid shows exactly zero
      apportion(allLeaves, 'remaining', Math.round(allLeaves.reduce((s, l) => s + l.raw.remaining, 0)), 0.5, 'remaining');
      // Its tax-inclusive companion stays pinned to the executive cell, composed as remaining + VAT where possible
      for (const [k, items] of cellLeaves.entries()) {
        const target = items.reduce((s, it) => s + it.val.residual_gross, 0);
        const pinnedVals = items.map(it => it.val.residual_gross);
        if (!apportionGross(items, 'remaining', 'residual_gross', target, `cell ${k}`, true)) {
          items.forEach((it, i) => { it.val.residual_gross = pinnedVals[i]; });
        }
      }
      apportion(allLeaves, 'cash_collected', Math.round(rawCashNet), 0.5, 'cash net');
      apportionGross(allLeaves, 'cash_collected', 'cash_collected_gross', Math.round(rawCashGross - rawExceptionGross), 'cash gross');
      apportion(allLeaves, 'other_open', Math.round(rawOtherOpen), 0.5, 'other open');
      apportionGross(allLeaves, 'other_open', 'other_open_gross', Math.round(rawOtherOpenGross), 'other open gross');
    }

    // 6. Build Department -> Cost Center -> Company tree (parents are sums of displayed children)
    const derive = (n) => {
      n.net_profit = n.revenue - n.expenses;
      n.margin = n.revenue > 0 ? round1((n.net_profit / n.revenue) * 100) : null;
      n.cash_vat = n.cash_collected_gross - n.cash_collected;
      n.billed = n.collected_invoices + n.remaining;
      n.collection_rate = n.billed > 0 ? round1((n.collected_invoices / n.billed) * 100) : null;
      n.open_total = n.remaining + n.other_open;
      n.open_total_gross = n.residual_gross + n.other_open_gross;
      return n;
    };
    const blank = () => Object.fromEntries(MEASURES.map(m => [m, 0]));
    const addInto = (target, src) => { for (const m of MEASURES) target[m] += src[m]; };

    const byRevenue = (a, b) => (b.revenue - a.revenue) || (b.expenses - a.expenses) || (b.cash_collected - a.cash_collected) || (b.open_total - a.open_total) || String(a.id).localeCompare(String(b.id));

    const deptMap = new Map();
    for (const leaf of allLeaves) {
      if (!deptMap.has(leaf.did)) {
        const isSynthetic = !(Number.isInteger(leaf.did) && leaf.did > 0 && leaf.did < 100000);
        deptMap.set(leaf.did, {
          id: `dept_${leaf.did}`,
          type: 'dept',
          department_id: leaf.did,
          name: deptNames.get(leaf.did) || (leaf.did === 0 ? 'غير مصنّف' : `قسم ${leaf.did}`),
          is_unmapped_cost_center: isSynthetic && leaf.did !== 0,
          ...blank(),
          ccMap: new Map()
        });
      }
      const dept = deptMap.get(leaf.did);
      if (!dept.ccMap.has(leaf.ccKey)) {
        dept.ccMap.set(leaf.ccKey, {
          id: `cc_${leaf.did}_${leaf.ccKey}`,
          type: 'cc',
          department_id: leaf.did,
          cost_center_key: leaf.ccKey,
          name: leaf.ccName || 'بدون مركز تكلفة',
          ...blank(),
          children: []
        });
      }
      const cc = dept.ccMap.get(leaf.ccKey);
      if (cc.name === 'بدون مركز تكلفة' && leaf.ccName) cc.name = leaf.ccName;
      const coNode = derive({
        id: `co_${leaf.did}_${leaf.ccKey}_${leaf.cid}`,
        type: 'company',
        department_id: leaf.did,
        cost_center_key: leaf.ccKey,
        company_id: leaf.cid,
        name: companyNames.get(leaf.cid) || `شركة ${leaf.cid}`,
        ...leaf.val
      });
      cc.children.push(coNode);
      addInto(cc, coNode);
      addInto(dept, coNode);
    }

    const totals = blank();
    const tree = [];
    for (const dept of deptMap.values()) {
      dept.children = Array.from(dept.ccMap.values()).map(cc => {
        cc.children.sort((a, b) => a.company_id - b.company_id);
        return derive(cc);
      }).sort(byRevenue);
      delete dept.ccMap;
      derive(dept);
      addInto(totals, dept);
      tree.push(dept);
    }
    tree.sort(byRevenue);
    derive(totals);

    for (const [measure, cardKey] of [['revenue', 'revenue'], ['expenses', 'expenses'], ['collected_invoices', 'collected_period_untaxed'], ['residual_gross', 'residual_period']]) {
      if (totals[measure] !== exec.cards[cardKey]) {
        throw new Error(`[DepartmentsComparison] total ${measure}=${totals[measure]} differs from executive card ${cardKey}=${exec.cards[cardKey]}.`);
      }
    }

    // 7. Customer payments not reconciled to invoices: outside both collection columns (as the collections tab reports them)
    const collections = this.getCollections({ companyIds: targetLedgerIds, years, year, dateFrom, dateTo, asOfDate, departmentIds, journalIds, costCenters, scopedCostCenters });
    const unlinkedMoves = (collections.accounts_comparison && collections.accounts_comparison.unallocated_moves) || [];

    // 8. Highlights, computed from the same department rows the table shows.
    // Ties are broken by the smaller department_id so the result is stable.
    const pick = (candidates, better) => candidates.reduce((best, d) => (best === null || better(d, best) ? d : best), null);
    const byId = (a, b) => a.department_id < b.department_id;
    const refOf = (d) => ({ department_id: d.department_id, name: d.name });
    const highlights = {};
    const topProfit = pick(tree.filter(d => d.net_profit > 0), (a, b) => a.net_profit > b.net_profit || (a.net_profit === b.net_profit && byId(a, b)));
    if (topProfit) highlights.top_profit = { ...refOf(topProfit), net_profit: topProfit.net_profit, margin: topProfit.margin };
    const largestOpen = pick(tree.filter(d => d.open_total > 0), (a, b) => a.open_total > b.open_total || (a.open_total === b.open_total && byId(a, b)));
    if (largestOpen) {
      highlights.largest_open = {
        ...refOf(largestOpen),
        open_total: largestOpen.open_total,
        open_total_gross: largestOpen.open_total_gross,
        share_of_total: totals.open_total > 0 ? round1((largestOpen.open_total / totals.open_total) * 100) : null
      };
    }
    // Lowest collected / billed on period invoices; compared as exact fractions (cross-multiplied), not rounded percents
    const weakest = pick(tree.filter(d => d.billed > 0 && d.remaining > 0), (a, b) => {
      const l = a.collected_invoices * b.billed, r = b.collected_invoices * a.billed;
      return l < r || (l === r && (a.remaining > b.remaining || (a.remaining === b.remaining && byId(a, b))));
    });
    if (weakest) highlights.weakest_collection = { ...refOf(weakest), collection_rate: weakest.collection_rate, remaining: weakest.remaining, billed: weakest.billed };
    const lossDepts = tree.filter(d => d.expenses > d.revenue);
    if (lossDepts.length > 0) {
      const largestLoss = pick(lossDepts, (a, b) => a.net_profit < b.net_profit || (a.net_profit === b.net_profit && byId(a, b)));
      highlights.loss_departments = {
        count: lossDepts.length,
        total_departments: tree.length,
        total_shortfall: lossDepts.reduce((sum, d) => sum + (d.expenses - d.revenue), 0),
        largest: { ...refOf(largestLoss), shortfall: largestLoss.expenses - largestLoss.revenue }
      };
    }

    const exceptionsGross = round2(rawExceptionGross);
    const cashGrossExact = round2(rawCashGross);
    const cashNetExact = round2(rawCashNet);

    return {
      meta: {
        period_label: period.label,
        years: period.yearsList,
        is_multi_year: exec.meta.is_multi_year,
        basis: 'untaxed',
        cash_channels: ['bank', 'sister_company', 'other_adjustment'],
        open_cutoff_date: cutoffDate,
        department_count: tree.length
      },
      cards: {
        revenue: totals.revenue,
        expenses: totals.expenses,
        net_profit: totals.net_profit,
        profit_margin: totals.margin,
        cash_collected: totals.cash_collected,
        cash_collected_gross: totals.cash_collected_gross,
        cash_vat: totals.cash_vat,
        collected_invoices: totals.collected_invoices,
        billed: totals.billed,
        collection_rate: totals.collection_rate,
        remaining: totals.remaining,
        residual_gross: totals.residual_gross,
        open_total: totals.open_total,
        open_total_gross: totals.open_total_gross
      },
      highlights,
      // Unrounded-to-halalas figures for reconciliation with the collections tab
      cash_exact: {
        gross: cashGrossExact,
        net: cashNetExact,
        vat_excluded: round2(cashGrossExact - cashNetExact - exceptionsGross),
        exceptions_gross: exceptionsGross
      },
      // Open receivables to the halala, for reconciliation with the customers tab at the same cut-off
      open_exact: {
        gross: round2(allLeaves.reduce((sum, l) => sum + l.raw.residual_gross + l.raw.other_open_gross, 0)),
        untaxed: round2(allLeaves.reduce((sum, l) => sum + l.raw.remaining + l.raw.other_open, 0))
      },
      unlinked_payments: {
        count: unlinkedMoves.length,
        amount: round2(unlinkedMoves.reduce((s, m) => s + (m.amount || 0), 0)),
        moves: unlinkedMoves
      },
      exceptions: {
        count: exceptionItems.length,
        amount: round2(exceptionItems.reduce((s, e) => s + (e.amount || 0), 0)),
        items: exceptionItems.slice(0, 200)
      },
      tree,
      totals
    };
  }
}

module.exports = ConsolidationEngine;
