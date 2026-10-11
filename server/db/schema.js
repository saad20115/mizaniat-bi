const { getDb } = require('./connection');

function initializeSchema() {
  const db = getDb();

  db.exec(`
    -- Odoo instance connections
    CREATE TABLE IF NOT EXISTS odoo_instances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      db_name TEXT,
      username TEXT NOT NULL,
      api_key TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Companies synced from Odoo
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      odoo_instance_id INTEGER NOT NULL,
      odoo_company_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      currency TEXT DEFAULT 'SAR',
      is_active INTEGER DEFAULT 1,
      color TEXT DEFAULT '#3b82f6',
      vat_period TEXT DEFAULT 'quarterly',
      short_name TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (odoo_instance_id) REFERENCES odoo_instances(id),
      UNIQUE(odoo_instance_id, odoo_company_id)
    );

    -- Unified chart of accounts (the standardized mapping target)
    CREATE TABLE IF NOT EXISTS unified_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name_ar TEXT NOT NULL,
      name_en TEXT,
      account_type TEXT NOT NULL,
      parent_id INTEGER,
      level INTEGER DEFAULT 0,
      is_group INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (parent_id) REFERENCES unified_accounts(id)
    );

    -- Accounts from each company (raw from Odoo)
    CREATE TABLE IF NOT EXISTS company_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      odoo_account_id INTEGER,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      account_type TEXT,
      unified_account_id INTEGER,
      is_mapped INTEGER DEFAULT 0,
      FOREIGN KEY (company_id) REFERENCES companies(id),
      FOREIGN KEY (unified_account_id) REFERENCES unified_accounts(id)
    );

    -- Cost centers from Odoo (analytic accounts)
    CREATE TABLE IF NOT EXISTS cost_centers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      odoo_analytic_id INTEGER,
      code TEXT,
      name TEXT NOT NULL,
      unified_cost_center_id INTEGER,
      FOREIGN KEY (company_id) REFERENCES companies(id)
    );

    -- Odoo analytic accounts synced per instance (B3)
    CREATE TABLE IF NOT EXISTS odoo_analytic_accounts (
      instance_id INTEGER NOT NULL,
      odoo_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      code TEXT,
      plan_id INTEGER,
      company_id INTEGER,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY(instance_id, odoo_id)
    );
    CREATE INDEX IF NOT EXISTS idx_odoo_analytic_inst_id ON odoo_analytic_accounts(instance_id, odoo_id);
    CREATE INDEX IF NOT EXISTS idx_odoo_analytic_inst_name ON odoo_analytic_accounts(instance_id, name);

    -- Unified cost centers
    CREATE TABLE IF NOT EXISTS unified_cost_centers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name_ar TEXT NOT NULL,
      name_en TEXT
    );

    -- Partner account configuration (per-company mapping for detailed trial balance)
    CREATE TABLE IF NOT EXISTS partner_account_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      account_category TEXT NOT NULL,
      account_code TEXT NOT NULL,
      account_name TEXT,
      FOREIGN KEY (company_id) REFERENCES companies(id),
      UNIQUE(company_id, account_category)
    );

    -- Analytic account groups (for classifying analytic accounts)
    CREATE TABLE IF NOT EXISTS analytic_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#3b82f6',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Mapping analytic accounts to groups (per company)
    CREATE TABLE IF NOT EXISTS analytic_group_mapping (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      analytic_account TEXT NOT NULL,
      group_id INTEGER NOT NULL,
      FOREIGN KEY (company_id) REFERENCES companies(id),
      FOREIGN KEY (group_id) REFERENCES analytic_groups(id) ON DELETE CASCADE,
      UNIQUE(company_id, analytic_account)
    );

    -- Manual consolidation mapping for journal names
    CREATE TABLE IF NOT EXISTS journal_name_mappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      original_name TEXT NOT NULL,
      mapped_name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (company_id) REFERENCES companies(id),
      UNIQUE(company_id, original_name)
    );

    -- S1: Synced Odoo journals with exact type and name
    CREATE TABLE IF NOT EXISTS odoo_journals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      odoo_journal_id INTEGER NOT NULL,
      company_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (company_id) REFERENCES companies(id),
      UNIQUE(company_id, odoo_journal_id)
    );

    -- Admin users (email + password login)
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      last_login TEXT
    );

    -- Allowed viewers (phone numbers that can view presentations)
    CREATE TABLE IF NOT EXISTS allowed_viewers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL UNIQUE,
      name TEXT DEFAULT '',
      is_active INTEGER DEFAULT 1,
      created_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (created_by) REFERENCES admin_users(id)
    );

    -- Viewer sessions (track viewer login tokens)
    CREATE TABLE IF NOT EXISTS viewer_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      token TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );

    -- Presentation share tokens (for read-only public slideshow links)
    CREATE TABLE IF NOT EXISTS presentation_shares (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      title TEXT DEFAULT 'عرض تقديمي',
      company_id INTEGER,
      date_from TEXT,
      date_to TEXT,
      slides_config TEXT DEFAULT '{}',
      speed INTEGER DEFAULT 8,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT
    );

    -- Journal entries (header)
    CREATE TABLE IF NOT EXISTS journal_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      odoo_move_id INTEGER,
      name TEXT,
      ref TEXT,
      date TEXT NOT NULL,
      journal_type TEXT,
      state TEXT DEFAULT 'posted',
      partner_name TEXT,
      partner_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (company_id) REFERENCES companies(id)
    );

    -- Journal items (lines) - the core financial data
    CREATE TABLE IF NOT EXISTS journal_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      journal_entry_id INTEGER,
      odoo_line_id INTEGER,
      account_code TEXT,
      account_name TEXT,
      account_type TEXT,
      unified_account_id INTEGER,
      partner_name TEXT,
      partner_id INTEGER,
      analytic_account TEXT,
      cost_center_id INTEGER,
      label TEXT,
      debit REAL DEFAULT 0,
      credit REAL DEFAULT 0,
      balance REAL DEFAULT 0,
      amount_residual REAL DEFAULT 0,
      currency TEXT DEFAULT 'SAR',
      date TEXT NOT NULL,
      journal_name TEXT,
      journal_type TEXT,
      move_name TEXT,
      move_ref TEXT,
      move_state TEXT DEFAULT 'posted',
      fiscal_year TEXT,
      period TEXT,
      tax_id INTEGER,
      tax_name TEXT,
      tax_base_amount REAL DEFAULT 0,
      tax_ids TEXT,
      move_type TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (company_id) REFERENCES companies(id),
      FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id),
      FOREIGN KEY (unified_account_id) REFERENCES unified_accounts(id)
    );

    -- Tax Report configuration
    CREATE TABLE IF NOT EXISTS tax_report_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL UNIQUE,
      input_accounts TEXT DEFAULT '[]',
      output_accounts TEXT DEFAULT '[]',
      excluded_journals TEXT DEFAULT '[]',
      excluded_move_names TEXT DEFAULT '[]',
      FOREIGN KEY (company_id) REFERENCES companies(id)
    );

    -- Intercompany elimination rules
    CREATE TABLE IF NOT EXISTS elimination_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      rule_type TEXT NOT NULL DEFAULT 'account_match',
      source_company_id INTEGER,
      target_company_id INTEGER,
      source_account_code TEXT,
      target_account_code TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (source_company_id) REFERENCES companies(id),
      FOREIGN KEY (target_company_id) REFERENCES companies(id)
    );

    -- Sync logs
    CREATE TABLE IF NOT EXISTS sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER,
      sync_type TEXT NOT NULL DEFAULT 'full',
      status TEXT NOT NULL DEFAULT 'running',
      records_synced INTEGER DEFAULT 0,
      error_message TEXT,
      started_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      FOREIGN KEY (company_id) REFERENCES companies(id)
    );

    -- ==========================================
    -- SALES SYSTEM (ISOLATED)
    -- ==========================================
    
    -- Sales API instances
    CREATE TABLE IF NOT EXISTS sales_instances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      db_name TEXT,
      username TEXT NOT NULL,
      api_key TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Sales Companies
    CREATE TABLE IF NOT EXISTS sales_companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sales_instance_id INTEGER NOT NULL,
      sales_company_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      currency TEXT DEFAULT 'SAR',
      is_active INTEGER DEFAULT 1,
      color TEXT DEFAULT '#10b981',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (sales_instance_id) REFERENCES sales_instances(id),
      UNIQUE(sales_instance_id, sales_company_id)
    );

    -- Sales Elimination Rules
    CREATE TABLE IF NOT EXISTS sales_elimination_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      rule_type TEXT NOT NULL DEFAULT 'account_match',
      source_company_id INTEGER,
      target_company_id INTEGER,
      source_account_code TEXT,
      target_account_code TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (source_company_id) REFERENCES sales_companies(id),
      FOREIGN KEY (target_company_id) REFERENCES sales_companies(id)
    );

    -- Sales Sync logs
    CREATE TABLE IF NOT EXISTS sales_sync_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER,
      sync_type TEXT NOT NULL DEFAULT 'full',
      status TEXT NOT NULL DEFAULT 'running',
      records_synced INTEGER DEFAULT 0,
      error_message TEXT,
      started_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      FOREIGN KEY (company_id) REFERENCES sales_companies(id)
    );

    -- Sales Invoices
    CREATE TABLE IF NOT EXISTS sales_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      invoice_id INTEGER,
      name TEXT,
      partner_name TEXT,
      partner_id INTEGER,
      journal_id INTEGER,
      journal_name TEXT,
      date TEXT,
      invoice_date_due TEXT,
      amount_total REAL DEFAULT 0,
      amount_untaxed REAL DEFAULT 0,
      amount_residual_signed REAL DEFAULT 0,
      payment_state TEXT,
      state TEXT,
      raw_data TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (company_id) REFERENCES sales_companies(id)
    );

    -- Invoice department allocation (M1a)
    CREATE TABLE IF NOT EXISTS invoice_departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sales_invoice_id INTEGER NOT NULL,
      department_id INTEGER NOT NULL DEFAULT 0,
      share REAL NOT NULL DEFAULT 1.0,
      cost_center_key TEXT,
      cost_center_name TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      odoo_invoice_id INTEGER DEFAULT 0,
      company_id INTEGER DEFAULT 0,
      FOREIGN KEY (sales_invoice_id) REFERENCES sales_invoices(id) ON DELETE CASCADE,
      UNIQUE(sales_invoice_id, department_id, cost_center_key)
    );

    -- Sales App settings (key-value store for schedule)
    CREATE TABLE IF NOT EXISTS sales_app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- User UI Preferences (for Executive View custom settings)
    CREATE TABLE IF NOT EXISTS ui_preferences (
      user_type TEXT NOT NULL,
      user_id TEXT NOT NULL,
      pref_key TEXT NOT NULL,
      value_json TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (user_type, user_id, pref_key)
    );

    -- Sales Sync notifications
    CREATE TABLE IF NOT EXISTS sales_sync_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL DEFAULT 'success',
      message TEXT NOT NULL,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Default sales sync settings
    INSERT OR IGNORE INTO sales_app_settings (key, value) VALUES ('sync_enabled', 'false');
    INSERT OR IGNORE INTO sales_app_settings (key, value) VALUES ('sync_interval_hours', '2');

    -- Performance indexes
    CREATE INDEX IF NOT EXISTS idx_journal_items_company ON journal_items(company_id);
    CREATE INDEX IF NOT EXISTS idx_journal_items_date ON journal_items(date);
    CREATE INDEX IF NOT EXISTS idx_journal_items_account ON journal_items(account_code);
    CREATE INDEX IF NOT EXISTS idx_journal_items_account_type ON journal_items(account_type);
    CREATE INDEX IF NOT EXISTS idx_journal_items_unified ON journal_items(unified_account_id);
    CREATE INDEX IF NOT EXISTS idx_journal_items_fiscal ON journal_items(fiscal_year, period);
    CREATE INDEX IF NOT EXISTS idx_journal_items_company_date ON journal_items(company_id, date);
    CREATE INDEX IF NOT EXISTS idx_journal_items_company_move ON journal_items(company_id, move_name);
    CREATE INDEX IF NOT EXISTS idx_journal_items_comp_actype ON journal_items(company_id, account_type);
    CREATE INDEX IF NOT EXISTS idx_company_accounts_company ON company_accounts(company_id);
    CREATE INDEX IF NOT EXISTS idx_company_accounts_unified ON company_accounts(unified_account_id);
    CREATE INDEX IF NOT EXISTS idx_journal_entries_company ON journal_entries(company_id);
    CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date);
    CREATE INDEX IF NOT EXISTS idx_journal_items_partner_name ON journal_items(partner_name);
    CREATE INDEX IF NOT EXISTS idx_journal_items_receivable_fast ON journal_items(company_id, account_type, move_state, date);
    CREATE INDEX IF NOT EXISTS idx_journal_items_partner_rec ON journal_items(partner_name, account_type, move_state);

    -- App settings (key-value store)
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Sync notifications (history of auto-sync results)
    CREATE TABLE IF NOT EXISTS sync_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL DEFAULT 'success',
      message TEXT NOT NULL,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Guarantee releases (track which guarantees have been released)
    CREATE TABLE IF NOT EXISTS guarantee_releases (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      account_code TEXT NOT NULL,
      move_name TEXT NOT NULL,
      released_date TEXT DEFAULT (date('now')),
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (company_id) REFERENCES companies(id),
      UNIQUE(company_id, account_code, move_name)
    );

    -- Guarantee sub-items (manual breakdowns of aggregated guarantee entries)
    CREATE TABLE IF NOT EXISTS guarantee_sub_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      parent_company_id INTEGER NOT NULL,
      parent_account_code TEXT NOT NULL,
      parent_move_name TEXT NOT NULL,
      description TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0,
      is_released INTEGER DEFAULT 0,
      released_date TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (parent_company_id) REFERENCES companies(id)
    );

    -- Default sync settings
    INSERT OR IGNORE INTO app_settings (key, value) VALUES ('sync_enabled', 'false');
    INSERT OR IGNORE INTO app_settings (key, value) VALUES ('sync_interval_hours', '2');
    
    -- Sales app settings
    CREATE TABLE IF NOT EXISTS sales_app_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    INSERT OR IGNORE INTO sales_app_settings (key, value) VALUES ('sync_enabled', 'false');
    INSERT OR IGNORE INTO sales_app_settings (key, value) VALUES ('sync_interval_hours', '2');
    
    -- Sales sync notifications
    CREATE TABLE IF NOT EXISTS sales_sync_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Add redistributable and journal_name columns to analytic_group_mapping if not exists
  try {
    db.prepare(`ALTER TABLE analytic_group_mapping ADD COLUMN redistributable INTEGER DEFAULT 0`).run();
    console.log('[DB] Added redistributable column to analytic_group_mapping');
  } catch (e) { /* column already exists */ }

  try {
    db.prepare(`ALTER TABLE analytic_group_mapping ADD COLUMN journal_name TEXT`).run();
    console.log('[DB] Added journal_name column to analytic_group_mapping');
  } catch (e) { /* column already exists */ }

  // S1: Add journal_id column to analytic_group_mapping
  try {
    db.prepare(`ALTER TABLE analytic_group_mapping ADD COLUMN journal_id INTEGER`).run();
    console.log('[DB] Added journal_id column to analytic_group_mapping');
  } catch (e) { /* column already exists */ }

  // S1: Add journal_id column to journal_items
  try {
    db.prepare(`ALTER TABLE journal_items ADD COLUMN journal_id INTEGER`).run();
    console.log('[DB] Added journal_id column to journal_items');
  } catch (e) { /* column already exists */ }

  // S1: Migrate existing journal_name rows in analytic_group_mapping to journal_id
  try {
    const mappings = db.prepare(`
      SELECT id, company_id, journal_name 
      FROM analytic_group_mapping 
      WHERE (journal_id IS NULL OR journal_id = 0) AND journal_name IS NOT NULL AND journal_name != ''
    `).all();
    
    if (mappings.length > 0) {
      const updateStmt = db.prepare('UPDATE analytic_group_mapping SET journal_id = ? WHERE id = ?');
      const findJidStmt = db.prepare(`
        SELECT DISTINCT invoice_journal_id as journal_id 
        FROM payment_allocations 
        WHERE company_id = ? AND (TRIM(invoice_journal_name) = ? OR invoice_journal_name = ?)
        LIMIT 1
      `);
      const findSalesJidStmt = db.prepare(`
        SELECT DISTINCT si.journal_id
        FROM sales_invoices si
        JOIN sales_companies sc ON sc.id = si.company_id
        JOIN companies c ON c.odoo_company_id = sc.sales_company_id
        WHERE c.id = ? AND (TRIM(si.journal_name) = ? OR si.journal_name = ?)
        LIMIT 1
      `);
      
      let count = 0;
      for (const m of mappings) {
        const cleanName = (m.journal_name || '').trim();
        let found = findJidStmt.get(m.company_id, cleanName, m.journal_name);
        if (!found || !found.journal_id) {
          found = findSalesJidStmt.get(m.company_id, cleanName, m.journal_name);
        }
        if (found && found.journal_id) {
          updateStmt.run(found.journal_id, m.id);
          count++;
        }
      }
      if (count > 0) {
        console.log(`[DB] S1: Migrated ${count} analytic_group_mapping rows with journal_id`);
      }
    }
  } catch (e) {
    console.warn('[DB] Migration of journal_id in analytic_group_mapping:', e.message);
  }

  // U1 Migration: Map journal_id=65 'فواتير عملاء قسم الاشراف' to group 4 'قسم الاشراف' in company 2
  try {
    const existing = db.prepare(`SELECT id FROM analytic_group_mapping WHERE company_id = 2 AND journal_id = 65`).get();
    if (!existing) {
      db.prepare(`
        INSERT INTO analytic_group_mapping (company_id, analytic_account, group_id, redistributable, journal_name, journal_id)
        VALUES (2, '', 4, 0, 'فواتير عملاء قسم الاشراف', 65)
      `).run();
      console.log('[DB] U1: Added analytic_group_mapping for company 2, journal_id 65 -> group 4 (قسم الاشراف)');
    }
  } catch (e) {
    console.warn('[DB] U1 journal 65 mapping error:', e.message);
  }

  // U1 Migration: Update invoice_departments and fact_daily for journal_id=65 and zero-amount invoices of 'an:مشروع العقد الموحد مكه شركة الكهرباء'
  try {
    db.prepare(`
      UPDATE invoice_departments
      SET department_id = 4
      WHERE company_id IN (SELECT id FROM sales_companies WHERE sales_company_id = 2)
        AND cost_center_key = 'j:65' AND department_id = 0
    `).run();

    db.prepare(`
      UPDATE invoice_departments
      SET department_id = 15
      WHERE company_id IN (SELECT id FROM sales_companies WHERE sales_company_id = 2)
        AND cost_center_key = 'an:مشروع العقد الموحد مكه شركة الكهرباء' AND department_id = 0
    `).run();

    db.prepare(`
      UPDATE fact_daily
      SET department_id = 4
      WHERE company_id = 2 AND journal_id = 65 AND (department_id = 0 OR department_id IS NULL)
    `).run();
  } catch (e) {
    console.warn('[DB] U1 invoice_departments update error:', e.message);
  }

  // M1-R4: Normalize double spaces in Taif Lab cost center keys across all tables
  try {
    db.prepare(`UPDATE invoice_departments SET cost_center_key = 'an:مختبر الطائف', cost_center_name = 'مختبر الطائف' WHERE cost_center_key = 'an:مختبر  الطائف'`).run();
    db.prepare(`UPDATE payment_allocations SET cost_center_key = 'an:مختبر الطائف', cost_center_name = 'مختبر الطائف' WHERE cost_center_key = 'an:مختبر  الطائف'`).run();
    db.prepare(`UPDATE fact_daily SET cost_center_key = 'an:مختبر الطائف', cost_center_name = 'مختبر الطائف' WHERE cost_center_key = 'an:مختبر  الطائف'`).run();
  } catch (e) {
    console.warn('[DB] M1-R4 Taif key normalization error:', e.message);
  }

  // D5 VAT Migrations
  try {
    db.prepare(`ALTER TABLE companies ADD COLUMN vat_period TEXT DEFAULT 'quarterly'`).run();
    console.log('[DB] Added vat_period column to companies');
  } catch (e) { /* column already exists */ }

  try {
    db.prepare(`UPDATE companies SET vat_period = 'monthly' WHERE id = 2 AND (vat_period IS NULL OR vat_period = 'quarterly')`).run();
  } catch (e) {}

  // RESP1 Short Names Migration
  try {
    db.prepare(`ALTER TABLE companies ADD COLUMN short_name TEXT`).run();
    console.log('[DB] Added short_name column to companies');
  } catch (e) { /* column already exists */ }

  try {
    db.prepare(`UPDATE companies SET short_name = name WHERE short_name IS NULL OR short_name = '' OR short_name != name`).run();
  } catch (e) {}

  for (const col of [
    { name: 'tax_id', type: 'INTEGER' },
    { name: 'tax_name', type: 'TEXT' },
    { name: 'tax_base_amount', type: 'REAL DEFAULT 0' },
    { name: 'tax_ids', type: 'TEXT' },
    { name: 'move_type', type: 'TEXT' }
  ]) {
    try {
      db.prepare(`ALTER TABLE journal_items ADD COLUMN ${col.name} ${col.type}`).run();
      console.log(`[DB] Added ${col.name} column to journal_items`);
    } catch (e) { /* column already exists */ }
  }

  try {
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_journal_items_tax ON journal_items(company_id, tax_id)`).run();
  } catch (e) {}

  // The legacy CLOSING journal_items cleanup was removed because it caused
  // a massive 4-minute full table scan on startup for large databases.
  // Legacy closing entries have already been purged in the initial migration.

  // Create closing_entries table (drop old version if schema changed)
  try {
    db.prepare(`SELECT fiscal_year FROM closing_entries LIMIT 1`).get();
  } catch (e) {
    // Column doesn't exist or table doesn't exist, drop and recreate
    db.exec(`DROP TABLE IF EXISTS closing_entries`);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS closing_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      fiscal_year TEXT NOT NULL,
      date_from TEXT NOT NULL,
      date_to TEXT NOT NULL,
      target_account TEXT NOT NULL,
      target_account_name TEXT,
      lines_json TEXT NOT NULL,
      total_debit REAL DEFAULT 0,
      total_credit REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(company_id, fiscal_year)
    );

    -- Account section overrides (e.g. classifying owner/retained earnings accounts as equity)
    CREATE TABLE IF NOT EXISTS account_section_overrides (
      company_id INTEGER,
      account_code TEXT,
      section TEXT,
      PRIMARY KEY(company_id, account_code)
    );

    INSERT OR IGNORE INTO account_section_overrides (company_id, account_code, section) VALUES
      (1, '200002', 'equity'),
      (2, '200002', 'equity'),
      (2, '200003', 'equity'),
      (3, '290001', 'equity'),
      (3, '290011', 'equity'),
      (4, '201033', 'equity');

    -- Account tags (e.g. tagging specific accounts with role/behavior tags like 'guarantee', 'vat_output', 'vat_input', 'vat_settlement')
    CREATE TABLE IF NOT EXISTS account_tags (
      company_id INTEGER,
      account_code TEXT,
      tag TEXT,
      PRIMARY KEY(company_id, account_code, tag)
    );

    INSERT OR IGNORE INTO account_tags (company_id, account_code, tag) VALUES
      (2, '14110002', 'guarantee'),
      (3, '0110012', 'guarantee'),
      (1, '201017', 'vat_output'),
      (1, '104041', 'vat_input'),
      (1, '202003', 'vat_settlement'),
      (2, '201017', 'vat_output'),
      (2, '14110006', 'vat_input'),
      (3, '201017', 'vat_output'),
      (3, '104041', 'vat_input'),
      (4, '201017', 'vat_output'),
      (4, '111053', 'vat_input');

    -- Odoo Taxes (for D5 VAT classification & rates)
    CREATE TABLE IF NOT EXISTS odoo_taxes (
      instance_id INTEGER NOT NULL,
      tax_id INTEGER NOT NULL,
      company_odoo_id INTEGER,
      name TEXT NOT NULL,
      amount REAL DEFAULT 0,
      type_tax_use TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY(instance_id, tax_id)
    );

    -- Performance indexes for sales_invoices
    CREATE INDEX IF NOT EXISTS idx_sales_invoices_comp_name ON sales_invoices(company_id, name);
    CREATE INDEX IF NOT EXISTS idx_sales_invoices_comp_date ON sales_invoices(company_id, date);
    CREATE INDEX IF NOT EXISTS idx_sales_invoices_comp_inv_id ON sales_invoices(company_id, invoice_id);

    -- Fact daily table for matrix reporting & rapid aggregations (M1)
    CREATE TABLE IF NOT EXISTS fact_daily (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      year TEXT NOT NULL,
      quarter TEXT NOT NULL,
      month TEXT NOT NULL,
      week_start TEXT NOT NULL,
      account_code TEXT NOT NULL,
      section TEXT NOT NULL,
      department_id INTEGER NOT NULL DEFAULT 0,
      analytic_account TEXT DEFAULT '',
      journal_name TEXT DEFAULT '',
      journal_id INTEGER DEFAULT 0,
      debit REAL DEFAULT 0,
      credit REAL DEFAULT 0,
      revenue REAL DEFAULT 0,
      expense REAL DEFAULT 0,
      billed REAL DEFAULT 0,
      collected REAL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_fact_daily_comp_date ON fact_daily(company_id, date);
    CREATE INDEX IF NOT EXISTS idx_fact_daily_comp_year ON fact_daily(company_id, year);
    CREATE INDEX IF NOT EXISTS idx_fact_daily_comp_quarter ON fact_daily(company_id, quarter);
    CREATE INDEX IF NOT EXISTS idx_fact_daily_comp_month ON fact_daily(company_id, month);
    CREATE INDEX IF NOT EXISTS idx_fact_daily_comp_week ON fact_daily(company_id, week_start);
    CREATE INDEX IF NOT EXISTS idx_fact_daily_comp_dept ON fact_daily(company_id, department_id);
    CREATE INDEX IF NOT EXISTS idx_fact_daily_comp_acc ON fact_daily(company_id, account_code);
    CREATE INDEX IF NOT EXISTS idx_analytic_group_mapping_lookup ON analytic_group_mapping(company_id, analytic_account);
    CREATE INDEX IF NOT EXISTS idx_analytic_group_mapping_journal ON analytic_group_mapping(company_id, journal_name);
    CREATE INDEX IF NOT EXISTS idx_analytic_group_mapping_journal_id ON analytic_group_mapping(company_id, journal_id);
  `);

  // Add columns to sales_invoices if not existing (must run before indexes)
  const addSalesInvoiceCol = (col, type) => {
    try { db.prepare(`ALTER TABLE sales_invoices ADD COLUMN ${col} ${type}`).run(); } catch (e) {}
  };
  addSalesInvoiceCol('partner_id', 'INTEGER');
  addSalesInvoiceCol('journal_id', 'INTEGER');
  addSalesInvoiceCol('journal_name', 'TEXT');
  addSalesInvoiceCol('invoice_date_due', 'TEXT');
  addSalesInvoiceCol('amount_untaxed', 'REAL DEFAULT 0');
  addSalesInvoiceCol('amount_residual_signed', 'REAL DEFAULT 0');
  addSalesInvoiceCol('payment_state', 'TEXT');

  try {
    db.prepare('ALTER TABLE journal_items ADD COLUMN amount_residual REAL DEFAULT 0').run();
  } catch (e) {}
  try {
    db.prepare('ALTER TABLE fact_daily ADD COLUMN journal_id INTEGER DEFAULT 0').run();
  } catch (e) {}
  try {
    db.prepare('ALTER TABLE fact_daily ADD COLUMN cost_center_key TEXT').run();
  } catch (e) {}
  try {
    db.prepare('ALTER TABLE fact_daily ADD COLUMN cost_center_name TEXT').run();
  } catch (e) {}
  try {
    db.prepare('ALTER TABLE invoice_departments ADD COLUMN odoo_invoice_id INTEGER DEFAULT 0').run();
  } catch (e) {}
  try {
    db.prepare('ALTER TABLE invoice_departments ADD COLUMN company_id INTEGER DEFAULT 0').run();
  } catch (e) {}
  try {
    db.prepare('ALTER TABLE invoice_departments ADD COLUMN cost_center_key TEXT').run();
  } catch (e) {}
  try {
    db.prepare('ALTER TABLE invoice_departments ADD COLUMN cost_center_name TEXT').run();
  } catch (e) {}
  try {
    db.prepare('ALTER TABLE payment_allocations ADD COLUMN cost_center_key TEXT').run();
  } catch (e) {}
  try {
    db.prepare('ALTER TABLE payment_allocations ADD COLUMN cost_center_name TEXT').run();
  } catch (e) {}
  try {
    db.prepare('ALTER TABLE odoo_analytic_accounts ADD COLUMN is_active INTEGER DEFAULT 1').run();
  } catch (e) {}

  db.exec(`
    -- Performance indexes for journal_items, sales_invoices, invoice_departments & fact_daily (M1a/B1/B2/M1)
    CREATE INDEX IF NOT EXISTS idx_ji_co_odoo_line ON journal_items(company_id, odoo_line_id);
    CREATE INDEX IF NOT EXISTS idx_sales_invoices_due ON sales_invoices(company_id, invoice_date_due);
    CREATE INDEX IF NOT EXISTS idx_sales_invoices_partner ON sales_invoices(company_id, partner_id);
    CREATE INDEX IF NOT EXISTS idx_sales_invoices_payment ON sales_invoices(company_id, payment_state);
    CREATE INDEX IF NOT EXISTS idx_inv_dept_invoice ON invoice_departments(sales_invoice_id);
    CREATE INDEX IF NOT EXISTS idx_inv_dept_dept ON invoice_departments(department_id);
    CREATE INDEX IF NOT EXISTS idx_inv_dept_odoo ON invoice_departments(company_id, odoo_invoice_id);
    CREATE INDEX IF NOT EXISTS idx_inv_dept_cc ON invoice_departments(company_id, cost_center_key);
    CREATE INDEX IF NOT EXISTS idx_fact_daily_comp_journal ON fact_daily(company_id, journal_id);
    CREATE INDEX IF NOT EXISTS idx_fact_daily_comp_cc ON fact_daily(company_id, cost_center_key);

    -- Sister company partner configuration (for identifying payments received through sister companies)
    CREATE TABLE IF NOT EXISTS sister_company_partners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      partner_id INTEGER NOT NULL,
      partner_name TEXT NOT NULL,
      sister_company_name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(company_id, partner_id)
    );

    -- Payment allocations from Odoo account.partial.reconcile (C1)
    CREATE TABLE IF NOT EXISTS payment_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      sales_company_id INTEGER NOT NULL,
      odoo_company_id INTEGER NOT NULL,
      odoo_reconcile_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      full_reconcile_id INTEGER,

      -- Invoice details (Debit line)
      invoice_id INTEGER,
      invoice_name TEXT NOT NULL,
      invoice_date TEXT NOT NULL,
      invoice_year TEXT NOT NULL,
      invoice_journal_id INTEGER,
      invoice_journal_name TEXT,
      cost_center_key TEXT,
      cost_center_name TEXT,
      partner_id INTEGER,
      partner_name TEXT,
      department_id INTEGER DEFAULT 0,
      department_name TEXT DEFAULT 'غير مصنف',

      -- Payment details (Credit line)
      payment_line_id INTEGER,
      payment_move_name TEXT NOT NULL,
      payment_move_type TEXT NOT NULL,
      payment_date TEXT NOT NULL,
      payment_year TEXT NOT NULL,
      payment_quarter TEXT NOT NULL,
      payment_month TEXT NOT NULL,
      payment_journal_id INTEGER,
      payment_journal_name TEXT,
      payment_journal_type TEXT,
      payment_label TEXT,

      -- Counterpart details
      counterpart_account_code TEXT,
      counterpart_account_name TEXT,
      counterpart_account_type TEXT,
      counterpart_partner_id INTEGER,
      counterpart_partner_name TEXT,
      counterpart_share REAL DEFAULT 1.0,

      -- Channel classification
      channel TEXT NOT NULL,
      channel_label TEXT NOT NULL,
      sister_company_name TEXT,

      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(company_id, odoo_reconcile_id, counterpart_account_code, department_id, cost_center_key)
    );

    CREATE INDEX IF NOT EXISTS idx_pa_comp_date ON payment_allocations(company_id, payment_date);
    CREATE INDEX IF NOT EXISTS idx_pa_comp_year ON payment_allocations(company_id, payment_year);
    CREATE INDEX IF NOT EXISTS idx_pa_comp_month ON payment_allocations(company_id, payment_month);
    CREATE INDEX IF NOT EXISTS idx_pa_invoice_year ON payment_allocations(company_id, invoice_year);
    CREATE INDEX IF NOT EXISTS idx_pa_journal ON payment_allocations(company_id, invoice_journal_id);
    CREATE INDEX IF NOT EXISTS idx_pa_partner ON payment_allocations(company_id, partner_id);
    CREATE INDEX IF NOT EXISTS idx_pa_channel ON payment_allocations(company_id, channel);
    CREATE INDEX IF NOT EXISTS idx_pa_dept ON payment_allocations(company_id, department_id);
    CREATE INDEX IF NOT EXISTS idx_pa_invoice_id ON payment_allocations(invoice_id);
    CREATE INDEX IF NOT EXISTS idx_pa_inv_journal_name ON payment_allocations(invoice_journal_name);
    CREATE INDEX IF NOT EXISTS idx_pa_payment_move ON payment_allocations(company_id, payment_move_name);
    CREATE INDEX IF NOT EXISTS idx_pa_partner_name ON payment_allocations(partner_name);
    CREATE INDEX IF NOT EXISTS idx_pa_comp_inv_id ON payment_allocations(sales_company_id, invoice_id);
    CREATE INDEX IF NOT EXISTS idx_pa_cost_center ON payment_allocations(company_id, cost_center_key);
  `);

  // Seed default sister company partner mappings
  try {
    const scpCount = db.prepare('SELECT COUNT(*) as cnt FROM sister_company_partners').get().cnt;
    if (scpCount === 0) {
      const insScp = db.prepare(`
        INSERT OR IGNORE INTO sister_company_partners (company_id, partner_id, partner_name, sister_company_name)
        VALUES (?, ?, ?, ?)
      `);
      // Instance 7: Co 1 & Co 2
      insScp.run(1, 7, 'شركة سمير صالح سليمان ابو غلية للاستشارات الهندسية مهنية شخص واحد', 'شركة سمير صالح سليمان ابو غلية');
      insScp.run(2, 1, 'مكتب المهندس سمير صالح ابو غلية للاستشارات الهندسية', 'مكتب المهندس سمير صالح ابو غلية');
      // Instance 8: Co 3 & Co 4
      insScp.run(3, 11, 'شركة جمال بكر حريري للاستشارات الهندسية', 'شركة جمال بكر حريري للاستشارات الهندسية');
      insScp.run(4, 10, 'شركة جمال بكر حريري للاستشارات الهندسية مهنية شخص واحد', 'شركة جمال بكر حريري للاستشارات الهندسية مهنية');
    }
  } catch (e) {
    console.error('[DB] Error seeding sister_company_partners:', e.message);
  }

  console.log('[DB] Schema initialized successfully');

  // Seed default admin user if none exists (runs every startup, not just on first seed)
  try {
    const adminCount = db.prepare('SELECT COUNT(*) as count FROM admin_users').get();
    if (adminCount.count === 0) {
      const email = process.env.ADMIN_EMAIL;
      const password = process.env.ADMIN_PASSWORD;
      if (!email || !password) {
        console.log('[DB] No admin user exists. Set ADMIN_EMAIL and ADMIN_PASSWORD in environment to create initial admin.');
      } else {
        const { hashPassword } = require('../middleware/auth');
        const passwordHash = hashPassword(password);
        db.prepare('INSERT INTO admin_users (email, password_hash, name) VALUES (?, ?, ?)')
          .run(email, passwordHash, 'مدير النظام');
        console.log(`[DB] Initial admin created: ${email}`);
      }
    }
  } catch (e) {
    console.log('[DB] Admin seed:', e.message);
  }

  // Ensure fact_daily is populated if empty and journal_items exists
  try {
    const factCount = db.prepare('SELECT COUNT(*) as count FROM fact_daily').get();
    const jiCount = db.prepare('SELECT COUNT(*) as count FROM journal_items').get();
    if (factCount.count === 0 && jiCount.count > 0) {
      console.log('[DB] Populating fact_daily for existing journal items...');
      const SyncEngine = require('../services/sync-engine');
      const syncEngine = new SyncEngine(db);
      syncEngine.rebuildFactDaily();
      const newFactCount = db.prepare('SELECT COUNT(*) as count FROM fact_daily').get();
      console.log(`[DB] fact_daily populated with ${newFactCount.count} records`);
    }
  } catch (e) {
    console.log('[DB] fact_daily init error:', e.message);
  }

  // Backfill sales_invoices columns and invoice_departments if needed (M1a)
  try {
    const nullResidualCount = db.prepare(`SELECT COUNT(*) as cnt FROM sales_invoices WHERE partner_id IS NULL AND raw_data IS NOT NULL`).get().cnt;
    if (nullResidualCount > 0) {
      console.log(`[DB] Backfilling ${nullResidualCount} sales_invoices from raw_data...`);
      const updateStmt = db.prepare(`
        UPDATE sales_invoices
        SET partner_id = @partner_id,
            journal_id = @journal_id,
            journal_name = @journal_name,
            invoice_date_due = @invoice_date_due,
            amount_untaxed = @amount_untaxed,
            amount_residual_signed = @amount_residual_signed,
            payment_state = @payment_state
        WHERE id = @id
      `);
      const rows = db.prepare(`SELECT id, date, raw_data FROM sales_invoices WHERE partner_id IS NULL AND raw_data IS NOT NULL`).all();
      db.transaction(() => {
        for (const r of rows) {
          let p = {};
          try { p = JSON.parse(r.raw_data); } catch (e) {}
          updateStmt.run({
            id: r.id,
            partner_id: Array.isArray(p.partner_id) ? p.partner_id[0] : (p.partner_id || null),
            journal_id: Array.isArray(p.journal_id) ? p.journal_id[0] : (p.journal_id || null),
            journal_name: p.journal_name || '',
            invoice_date_due: p.invoice_date_due || p.invoice_date || r.date || null,
            amount_untaxed: parseFloat(p.amount_untaxed_signed ?? p.amount_untaxed) || 0,
            amount_residual_signed: parseFloat(p.amount_residual_signed) || 0,
            payment_state: p.payment_state || p.payment_status || ''
          });
        }
      })();
      console.log(`[DB] Backfill completed.`);
    }

    const invDeptCount = db.prepare(`SELECT COUNT(*) as cnt FROM invoice_departments`).get().cnt;
    const invCount = db.prepare(`SELECT COUNT(*) as cnt FROM sales_invoices`).get().cnt;
    if (invDeptCount === 0 && invCount > 0) {
      console.log(`[DB] Populating invoice_departments...`);
      const SalesSyncEngine = require('../services/sales-sync-engine');
      const salesSync = new SalesSyncEngine();
      salesSync.rebuildAllInvoiceDepartments();
      const newInvDeptCount = db.prepare(`SELECT COUNT(*) as cnt FROM invoice_departments`).get().cnt;
      console.log(`[DB] invoice_departments populated with ${newInvDeptCount} records.`);
    }
  } catch (e) {
    console.log('[DB] Sales invoice backfill error:', e.message);
  }

  // Backfill fact_daily cost centers if needed (M1-R2)
  try {
    const unmappedFdCount = db.prepare(`SELECT COUNT(*) as cnt FROM fact_daily WHERE cost_center_key IS NULL`).get().cnt;
    if (unmappedFdCount > 0) {
      console.log(`[DB] Backfilling ${unmappedFdCount} fact_daily rows with cost centers...`);
      const ConsolidationEngine = require('../services/consolidation');
      const engine = new ConsolidationEngine();
      const updateStmt = db.prepare('UPDATE fact_daily SET cost_center_key = ?, cost_center_name = ? WHERE id = ?');
      const rows = db.prepare('SELECT id, company_id, analytic_account, journal_id, journal_name FROM fact_daily WHERE cost_center_key IS NULL').all();
      db.transaction(() => {
        for (const r of rows) {
          const cc = engine.resolveCostCenter({
            companyId: r.company_id,
            analyticAccount: r.analytic_account,
            journalId: r.journal_id,
            journalName: r.journal_name
          });
          updateStmt.run(cc.key, cc.name, r.id);
        }
      })();
      console.log('[DB] fact_daily cost centers backfill completed.');
    }
  } catch (e) {
    console.log('[DB] fact_daily cost center backfill error:', e.message);
  }
}

module.exports = { initializeSchema };
