const { getDb } = require('../db/connection');

/**
 * Seed data for development/demonstration OR production
 * In production (ODOO_API_KEY env set), seeds real Odoo instance config
 * In dev, seeds fake demo data for testing
 */
function seedDemoData() {
  const db = getDb();
  
  // Check if data already exists
  const existing = db.prepare('SELECT COUNT(*) as count FROM companies').get();
  if (existing.count > 0) {
    console.log('[Demo] Data already exists, skipping seed');
    // Seed admin user if needed
    seedAdmin(db);
    return;
  }

  // Production mode: seed real Odoo config from environment variables
  if (process.env.ODOO_API_KEY) {
    console.log('[Production] Seeding real Odoo configuration...');
    seedProduction(db);
    seedAdmin(db);
    return;
  }

  console.log('[Demo] Seeding demo data...');

  const seed = db.transaction(() => {
    // Create demo Odoo instance
    db.prepare(`
      INSERT INTO odoo_instances (name, url, db_name, username, api_key)
      VALUES ('أبو غالية للمقاولات', 'https://aboghaliaoffice.com', 'odoo17', 'admin', 'demo-key')
    `).run();

    // Create two companies
    db.prepare(`
      INSERT INTO companies (odoo_instance_id, odoo_company_id, name, currency, color) VALUES
      (1, 1, 'شركة أبو غالية للمقاولات', 'SAR', '#3b82f6'),
      (1, 2, 'شركة أبو غالية للتطوير العقاري', 'SAR', '#10b981')
    `).run();

    // Create unified chart of accounts
    const unifiedAccounts = [
      // Assets
      ['1000', 'الأصول', 'Assets', 'asset_current', null, 1, 1],
      ['1100', 'النقد والبنوك', 'Cash & Banks', 'asset_cash', 1, 1, 2],
      ['1110', 'الصندوق', 'Cash', 'asset_cash', 2, 0, 3],
      ['1120', 'البنك', 'Bank', 'asset_cash', 2, 0, 4],
      ['1200', 'الذمم المدينة', 'Accounts Receivable', 'asset_receivable', 1, 1, 5],
      ['1210', 'ذمم العملاء', 'Customer Receivables', 'asset_receivable', 5, 0, 6],
      ['1300', 'المخزون', 'Inventory', 'asset_current', 1, 0, 7],
      ['1500', 'الأصول الثابتة', 'Fixed Assets', 'asset_fixed', 1, 1, 8],
      ['1510', 'المعدات والآلات', 'Equipment', 'asset_fixed', 8, 0, 9],
      ['1520', 'المركبات', 'Vehicles', 'asset_fixed', 8, 0, 10],
      // Liabilities
      ['2000', 'الالتزامات', 'Liabilities', 'liability_current', null, 1, 11],
      ['2100', 'الذمم الدائنة', 'Accounts Payable', 'liability_payable', 11, 1, 12],
      ['2110', 'ذمم الموردين', 'Supplier Payables', 'liability_payable', 12, 0, 13],
      ['2200', 'القروض', 'Loans', 'liability_non_current', 11, 0, 14],
      ['2300', 'مستحقات الموظفين', 'Employee Benefits', 'liability_current', 11, 0, 15],
      // Equity
      ['3000', 'حقوق الملكية', 'Equity', 'equity', null, 1, 16],
      ['3100', 'رأس المال', 'Capital', 'equity', 16, 0, 17],
      ['3200', 'الأرباح المبقاة', 'Retained Earnings', 'equity_unaffected', 16, 0, 18],
      // Revenue
      ['4000', 'الإيرادات', 'Revenue', 'income', null, 1, 19],
      ['4100', 'إيرادات المقاولات', 'Contracting Revenue', 'income', 19, 0, 20],
      ['4200', 'إيرادات التطوير العقاري', 'Real Estate Revenue', 'income', 19, 0, 21],
      ['4300', 'إيرادات أخرى', 'Other Revenue', 'income_other', 19, 0, 22],
      // Expenses
      ['5000', 'المصروفات', 'Expenses', 'expense', null, 1, 23],
      ['5100', 'تكلفة المبيعات', 'Cost of Sales', 'expense_direct_cost', 23, 0, 24],
      ['5200', 'الرواتب والأجور', 'Salaries & Wages', 'expense', 23, 0, 25],
      ['5300', 'الإيجارات', 'Rent', 'expense', 23, 0, 26],
      ['5400', 'المصاريف الإدارية', 'Administrative Expenses', 'expense', 23, 0, 27],
      ['5500', 'الاستهلاك', 'Depreciation', 'expense_depreciation', 23, 0, 28],
      ['5600', 'مصاريف المشاريع', 'Project Expenses', 'expense_direct_cost', 23, 0, 29],
    ];

    const insertUnified = db.prepare(`
      INSERT INTO unified_accounts (code, name_ar, name_en, account_type, parent_id, is_group, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const acc of unifiedAccounts) {
      insertUnified.run(...acc);
    }

    // Generate demo journal items for both companies
    const months = ['2025-01', '2025-02', '2025-03', '2025-04', '2025-05', '2025-06',
                     '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12'];
    
    const insertItem = db.prepare(`
      INSERT INTO journal_items (
        company_id, account_code, account_name, account_type,
        partner_name, analytic_account, label, debit, credit, balance,
        date, journal_name, journal_type, move_name, move_state, fiscal_year, period
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'posted', ?, ?)
    `);

    // Company 1: Construction company
    let moveNum = 1;
    for (const month of months) {
      const day = '15';
      const date = `${month}-${day}`;
      const year = month.substring(0, 4);

      // Revenue entries
      const revenue = 150000 + Math.random() * 100000;
      insertItem.run(1, '4100', 'إيرادات المقاولات', 'income', 'عميل أ', 'مشروع الرياض', 'إيرادات مقاولات', 0, revenue, -revenue, date, 'يومية المبيعات', 'sale', `INV/${year}/${String(moveNum++).padStart(4, '0')}`, year, month);
      insertItem.run(1, '1210', 'ذمم العملاء', 'asset_receivable', 'عميل أ', 'مشروع الرياض', 'إيرادات مقاولات', revenue, 0, revenue, date, 'يومية المبيعات', 'sale', `INV/${year}/${String(moveNum++).padStart(4, '0')}`, year, month);

      // Additional revenue
      const revenue2 = 80000 + Math.random() * 60000;
      insertItem.run(1, '4100', 'إيرادات المقاولات', 'income', 'عميل ب', 'مشروع جدة', 'إيرادات مقاولات - جدة', 0, revenue2, -revenue2, date, 'يومية المبيعات', 'sale', `INV/${year}/${String(moveNum++).padStart(4, '0')}`, year, month);
      insertItem.run(1, '1210', 'ذمم العملاء', 'asset_receivable', 'عميل ب', 'مشروع جدة', 'إيرادات مقاولات - جدة', revenue2, 0, revenue2, date, 'يومية المبيعات', 'sale', `INV/${year}/${String(moveNum++).padStart(4, '0')}`, year, month);

      // Cost of sales
      const cost = revenue * 0.6;
      insertItem.run(1, '5100', 'تكلفة المبيعات', 'expense_direct_cost', 'مورد أ', 'مشروع الرياض', 'تكلفة مواد', cost, 0, cost, date, 'يومية المشتريات', 'purchase', `BILL/${year}/${String(moveNum++).padStart(4, '0')}`, year, month);
      insertItem.run(1, '2110', 'ذمم الموردين', 'liability_payable', 'مورد أ', 'مشروع الرياض', 'تكلفة مواد', 0, cost, -cost, date, 'يومية المشتريات', 'purchase', `BILL/${year}/${String(moveNum++).padStart(4, '0')}`, year, month);

      // Salaries
      const salaries = 45000 + Math.random() * 10000;
      insertItem.run(1, '5200', 'الرواتب والأجور', 'expense', '', 'إداري', 'رواتب الموظفين', salaries, 0, salaries, date, 'يومية متنوعة', 'general', `JE/${year}/${String(moveNum++).padStart(4, '0')}`, year, month);
      insertItem.run(1, '1120', 'البنك', 'asset_cash', '', 'إداري', 'رواتب الموظفين', 0, salaries, -salaries, date, 'يومية متنوعة', 'general', `JE/${year}/${String(moveNum++).padStart(4, '0')}`, year, month);

      // Rent
      const rent = 15000;
      insertItem.run(1, '5300', 'الإيجارات', 'expense', 'المالك', 'إداري', 'إيجار المكتب', rent, 0, rent, date, 'يومية متنوعة', 'general', `JE/${year}/${String(moveNum++).padStart(4, '0')}`, year, month);
      insertItem.run(1, '1120', 'البنك', 'asset_cash', 'المالك', 'إداري', 'إيجار المكتب', 0, rent, -rent, date, 'يومية متنوعة', 'general', `JE/${year}/${String(moveNum++).padStart(4, '0')}`, year, month);

      // Admin expenses
      const admin = 8000 + Math.random() * 5000;
      insertItem.run(1, '5400', 'المصاريف الإدارية', 'expense', '', 'إداري', 'مصاريف إدارية', admin, 0, admin, date, 'يومية متنوعة', 'general', `JE/${year}/${String(moveNum++).padStart(4, '0')}`, year, month);
      insertItem.run(1, '1110', 'الصندوق', 'asset_cash', '', 'إداري', 'مصاريف إدارية', 0, admin, -admin, date, 'يومية متنوعة', 'general', `JE/${year}/${String(moveNum++).padStart(4, '0')}`, year, month);

      // Project expenses
      const projExp = 25000 + Math.random() * 15000;
      insertItem.run(1, '5600', 'مصاريف المشاريع', 'expense_direct_cost', '', 'مشروع الرياض', 'مصاريف مشروع', projExp, 0, projExp, date, 'يومية متنوعة', 'general', `JE/${year}/${String(moveNum++).padStart(4, '0')}`, year, month);
      insertItem.run(1, '1120', 'البنك', 'asset_cash', '', 'مشروع الرياض', 'مصاريف مشروع', 0, projExp, -projExp, date, 'يومية متنوعة', 'general', `JE/${year}/${String(moveNum++).padStart(4, '0')}`, year, month);

      // Cash receipts
      const receipt = revenue * 0.8;
      insertItem.run(1, '1120', 'البنك', 'asset_cash', 'عميل أ', '', 'تحصيل', receipt, 0, receipt, `${month}-25`, 'يومية البنك', 'bank', `BNK/${year}/${String(moveNum++).padStart(4, '0')}`, year, month);
      insertItem.run(1, '1210', 'ذمم العملاء', 'asset_receivable', 'عميل أ', '', 'تحصيل', 0, receipt, -receipt, `${month}-25`, 'يومية البنك', 'bank', `BNK/${year}/${String(moveNum++).padStart(4, '0')}`, year, month);

      // Depreciation
      const depreciation = 5000;
      insertItem.run(1, '5500', 'الاستهلاك', 'expense_depreciation', '', '', 'استهلاك أصول', depreciation, 0, depreciation, date, 'يومية متنوعة', 'general', `JE/${year}/${String(moveNum++).padStart(4, '0')}`, year, month);
      insertItem.run(1, '1510', 'المعدات والآلات', 'asset_fixed', '', '', 'استهلاك أصول', 0, depreciation, -depreciation, date, 'يومية متنوعة', 'general', `JE/${year}/${String(moveNum++).padStart(4, '0')}`, year, month);
    }

    // Company 2: Real Estate Development
    moveNum = 1;
    for (const month of months) {
      const day = '15';
      const date = `${month}-${day}`;
      const year = month.substring(0, 4);

      // Revenue
      const revenue = 200000 + Math.random() * 150000;
      insertItem.run(2, '4200', 'إيرادات التطوير العقاري', 'income', 'مشتري أ', 'مشروع السكني', 'بيع وحدة سكنية', 0, revenue, -revenue, date, 'يومية المبيعات', 'sale', `INV/${year}/${String(moveNum++).padStart(4, '0')}`, year, month);
      insertItem.run(2, '1210', 'ذمم العملاء', 'asset_receivable', 'مشتري أ', 'مشروع السكني', 'بيع وحدة سكنية', revenue, 0, revenue, date, 'يومية المبيعات', 'sale', `INV/${year}/${String(moveNum++).padStart(4, '0')}`, year, month);

      // Other revenue
      const otherRev = 20000 + Math.random() * 15000;
      insertItem.run(2, '4300', 'إيرادات أخرى', 'income_other', '', '', 'إيرادات تأجير', 0, otherRev, -otherRev, date, 'يومية متنوعة', 'general', `JE/${year}/${String(moveNum++).padStart(4, '0')}`, year, month);
      insertItem.run(2, '1120', 'البنك', 'asset_cash', '', '', 'إيرادات تأجير', otherRev, 0, otherRev, date, 'يومية متنوعة', 'general', `JE/${year}/${String(moveNum++).padStart(4, '0')}`, year, month);

      // Cost of sales
      const cost = revenue * 0.55;
      insertItem.run(2, '5100', 'تكلفة المبيعات', 'expense_direct_cost', 'مقاول أ', 'مشروع السكني', 'تكلفة بناء', cost, 0, cost, date, 'يومية المشتريات', 'purchase', `BILL/${year}/${String(moveNum++).padStart(4, '0')}`, year, month);
      insertItem.run(2, '2110', 'ذمم الموردين', 'liability_payable', 'مقاول أ', 'مشروع السكني', 'تكلفة بناء', 0, cost, -cost, date, 'يومية المشتريات', 'purchase', `BILL/${year}/${String(moveNum++).padStart(4, '0')}`, year, month);

      // Salaries
      const salaries = 55000 + Math.random() * 15000;
      insertItem.run(2, '5200', 'الرواتب والأجور', 'expense', '', 'إداري', 'رواتب', salaries, 0, salaries, date, 'يومية متنوعة', 'general', `JE/${year}/${String(moveNum++).padStart(4, '0')}`, year, month);
      insertItem.run(2, '1120', 'البنك', 'asset_cash', '', 'إداري', 'رواتب', 0, salaries, -salaries, date, 'يومية متنوعة', 'general', `JE/${year}/${String(moveNum++).padStart(4, '0')}`, year, month);

      // Rent
      const rent = 25000;
      insertItem.run(2, '5300', 'الإيجارات', 'expense', '', 'إداري', 'إيجار', rent, 0, rent, date, 'يومية متنوعة', 'general', `JE/${year}/${String(moveNum++).padStart(4, '0')}`, year, month);
      insertItem.run(2, '1120', 'البنك', 'asset_cash', '', 'إداري', 'إيجار', 0, rent, -rent, date, 'يومية متنوعة', 'general', `JE/${year}/${String(moveNum++).padStart(4, '0')}`, year, month);

      // Admin expenses
      const admin = 12000 + Math.random() * 8000;
      insertItem.run(2, '5400', 'المصاريف الإدارية', 'expense', '', 'إداري', 'مصاريف إدارية', admin, 0, admin, date, 'يومية متنوعة', 'general', `JE/${year}/${String(moveNum++).padStart(4, '0')}`, year, month);
      insertItem.run(2, '1110', 'الصندوق', 'asset_cash', '', 'إداري', 'مصاريف إدارية', 0, admin, -admin, date, 'يومية متنوعة', 'general', `JE/${year}/${String(moveNum++).padStart(4, '0')}`, year, month);

      // Cash receipts
      const receipt = revenue * 0.75;
      insertItem.run(2, '1120', 'البنك', 'asset_cash', 'مشتري أ', '', 'تحصيل', receipt, 0, receipt, `${month}-28`, 'يومية البنك', 'bank', `BNK/${year}/${String(moveNum++).padStart(4, '0')}`, year, month);
      insertItem.run(2, '1210', 'ذمم العملاء', 'asset_receivable', 'مشتري أ', '', 'تحصيل', 0, receipt, -receipt, `${month}-28`, 'يومية البنك', 'bank', `BNK/${year}/${String(moveNum++).padStart(4, '0')}`, year, month);
    }

    // Intercompany transaction (Company 1 provides contracting services to Company 2)
    insertItem.run(1, '4100', 'إيرادات المقاولات', 'income', 'شركة أبو غالية للتطوير العقاري', 'بين الشركات', 'خدمات مقاولات بين الشركات', 0, 500000, -500000, '2025-06-30', 'يومية المبيعات', 'sale', 'IC/2025/0001', '2025', '2025-06');
    insertItem.run(1, '1210', 'ذمم العملاء', 'asset_receivable', 'شركة أبو غالية للتطوير العقاري', 'بين الشركات', 'خدمات مقاولات بين الشركات', 500000, 0, 500000, '2025-06-30', 'يومية المبيعات', 'sale', 'IC/2025/0001', '2025', '2025-06');
    
    insertItem.run(2, '5100', 'تكلفة المبيعات', 'expense_direct_cost', 'شركة أبو غالية للمقاولات', 'بين الشركات', 'خدمات مقاولات من الشقيقة', 500000, 0, 500000, '2025-06-30', 'يومية المشتريات', 'purchase', 'IC/2025/0001', '2025', '2025-06');
    insertItem.run(2, '2110', 'ذمم الموردين', 'liability_payable', 'شركة أبو غالية للمقاولات', 'بين الشركات', 'خدمات مقاولات من الشقيقة', 0, 500000, -500000, '2025-06-30', 'يومية المشتريات', 'purchase', 'IC/2025/0001', '2025', '2025-06');

    // Opening balances
    // Company 1
    insertItem.run(1, '3100', 'رأس المال', 'equity', '', '', 'رصيد افتتاحي', 0, 2000000, -2000000, '2025-01-01', 'يومية الافتتاح', 'general', 'OPN/2025/0001', '2025', '2025-01');
    insertItem.run(1, '1120', 'البنك', 'asset_cash', '', '', 'رصيد افتتاحي', 1500000, 0, 1500000, '2025-01-01', 'يومية الافتتاح', 'general', 'OPN/2025/0001', '2025', '2025-01');
    insertItem.run(1, '1510', 'المعدات والآلات', 'asset_fixed', '', '', 'رصيد افتتاحي', 300000, 0, 300000, '2025-01-01', 'يومية الافتتاح', 'general', 'OPN/2025/0002', '2025', '2025-01');
    insertItem.run(1, '1520', 'المركبات', 'asset_fixed', '', '', 'رصيد افتتاحي', 200000, 0, 200000, '2025-01-01', 'يومية الافتتاح', 'general', 'OPN/2025/0003', '2025', '2025-01');

    // Company 2
    insertItem.run(2, '3100', 'رأس المال', 'equity', '', '', 'رصيد افتتاحي', 0, 5000000, -5000000, '2025-01-01', 'يومية الافتتاح', 'general', 'OPN/2025/0001', '2025', '2025-01');
    insertItem.run(2, '1120', 'البنك', 'asset_cash', '', '', 'رصيد افتتاحي', 3000000, 0, 3000000, '2025-01-01', 'يومية الافتتاح', 'general', 'OPN/2025/0001', '2025', '2025-01');
    insertItem.run(2, '1300', 'المخزون', 'asset_current', '', '', 'رصيد افتتاحي', 1500000, 0, 1500000, '2025-01-01', 'يومية الافتتاح', 'general', 'OPN/2025/0002', '2025', '2025-01');
    insertItem.run(2, '2200', 'القروض', 'liability_non_current', 'بنك التنمية', '', 'رصيد افتتاحي', 0, 1000000, -1000000, '2025-01-01', 'يومية الافتتاح', 'general', 'OPN/2025/0003', '2025', '2025-01');

    // Add elimination rule for intercompany transactions
    db.prepare(`
      INSERT INTO elimination_rules (name, description, rule_type, source_company_id, target_company_id, source_account_code, target_account_code)
      VALUES ('استبعاد خدمات المقاولات', 'استبعاد المعاملات بين شركة المقاولات وشركة التطوير', 'account_match', 1, 2, '4100', '5100')
    `).run();

    // Seed company accounts
    const company1Accounts = [
      [1, '1110', 'الصندوق', 'asset_cash'],
      [1, '1120', 'البنك', 'asset_cash'],
      [1, '1210', 'ذمم العملاء', 'asset_receivable'],
      [1, '1510', 'المعدات والآلات', 'asset_fixed'],
      [1, '1520', 'المركبات', 'asset_fixed'],
      [1, '2110', 'ذمم الموردين', 'liability_payable'],
      [1, '3100', 'رأس المال', 'equity'],
      [1, '4100', 'إيرادات المقاولات', 'income'],
      [1, '5100', 'تكلفة المبيعات', 'expense_direct_cost'],
      [1, '5200', 'الرواتب والأجور', 'expense'],
      [1, '5300', 'الإيجارات', 'expense'],
      [1, '5400', 'المصاريف الإدارية', 'expense'],
      [1, '5500', 'الاستهلاك', 'expense_depreciation'],
      [1, '5600', 'مصاريف المشاريع', 'expense_direct_cost'],
    ];

    const company2Accounts = [
      [2, '1110', 'الصندوق', 'asset_cash'],
      [2, '1120', 'البنك', 'asset_cash'],
      [2, '1210', 'ذمم العملاء', 'asset_receivable'],
      [2, '1300', 'المخزون', 'asset_current'],
      [2, '2110', 'ذمم الموردين', 'liability_payable'],
      [2, '2200', 'القروض', 'liability_non_current'],
      [2, '3100', 'رأس المال', 'equity'],
      [2, '4200', 'إيرادات التطوير العقاري', 'income'],
      [2, '4300', 'إيرادات أخرى', 'income_other'],
      [2, '5100', 'تكلفة المبيعات', 'expense_direct_cost'],
      [2, '5200', 'الرواتب والأجور', 'expense'],
      [2, '5300', 'الإيجارات', 'expense'],
      [2, '5400', 'المصاريف الإدارية', 'expense'],
    ];

    const insertAcc = db.prepare('INSERT INTO company_accounts (company_id, code, name, account_type) VALUES (?, ?, ?, ?)');
    for (const acc of [...company1Accounts, ...company2Accounts]) {
      insertAcc.run(...acc);
    }
  });

  seed();
  console.log('[Demo] Demo data seeded successfully');
  seedAdmin(db);
}

/**
 * Seed real Odoo configuration for production deployment
 * Uses environment variables:
 *   ODOO_API_KEY      — API key for aboghaliaoffice.com
 *   ODOO_API_KEY_2    — API key for jbhconsultingsa.com (defaults to ODOO_API_KEY)
 *   ODOO_USERNAME     — Odoo username (default: saad@aboghaliaoffice.com)
 */
function seedProduction(db) {
  const apiKey1 = process.env.ODOO_API_KEY || '';
  const apiKey2 = process.env.ODOO_API_KEY_2 || apiKey1;
  const username = process.env.ODOO_USERNAME || 'saad@aboghaliaoffice.com';

  const tx = db.transaction(() => {
    // Instance 1: أبو غلية
    const r1 = db.prepare(`
      INSERT INTO odoo_instances (name, url, db_name, username, api_key, is_active)
      VALUES ('خادم أبو غلية - aboghaliaoffice.com', 'https://aboghaliaoffice.com', '', ?, ?, 1)
    `).run(username, apiKey1);
    const inst1Id = r1.lastInsertRowid;

    // Instance 2: حريري
    const r2 = db.prepare(`
      INSERT INTO odoo_instances (name, url, db_name, username, api_key, is_active)
      VALUES ('خادم حريري - jbhconsultingsa.com', 'https://jbhconsultingsa.com', '', ?, ?, 1)
    `).run(username, apiKey2);
    const inst2Id = r2.lastInsertRowid;

    // Companies — mapping to correct Odoo instances
    db.prepare(`
      INSERT INTO companies (odoo_instance_id, odoo_company_id, name, currency, color) VALUES
      (?, 1, 'مكتب أبو غالية للاستشارات الهندسية', 'SAR', '#3b82f6'),
      (?, 2, 'شركة ابو غالية للمقاولات العامة', 'SAR', '#10b981'),
      (?, 5, 'شركة جمال بكر حريري للاستشارات الهندسية', 'SAR', '#f59e0b'),
      (?, 4, 'شركة جمال بكر حريري للمقاولات', 'SAR', '#ef4444')
    `).run(inst1Id, inst1Id, inst2Id, inst2Id);

    console.log(`[Production] Created instance ${inst1Id}: aboghaliaoffice.com (companies 1,2)`);
    console.log(`[Production] Created instance ${inst2Id}: jbhconsultingsa.com (companies 4,5)`);
    console.log(`[Production] Created 4 companies`);
  });

  tx();
  console.log('[Production] Real Odoo configuration seeded successfully');
}

/**
 * Seed default admin user if none exists
 */
function seedAdmin(db) {
  try {
    const adminCount = db.prepare('SELECT COUNT(*) as count FROM admin_users').get();
    if (adminCount.count === 0) {
      const { hashPassword } = require('../middleware/auth');
      const password = process.env.ADMIN_PASSWORD || '123456';
      const email = process.env.ADMIN_EMAIL || 'saadm7294@gmail.com';
      const passwordHash = hashPassword(password);
      db.prepare('INSERT INTO admin_users (email, password_hash, name) VALUES (?, ?, ?)')
        .run(email, passwordHash, 'مدير النظام');
      console.log(`[Seed] Default admin created: ${email}`);
    }
  } catch (e) {
    console.log('[Seed] Admin seeding deferred:', e.message);
  }
}

module.exports = { seedDemoData };
