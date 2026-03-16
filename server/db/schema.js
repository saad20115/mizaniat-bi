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
      currency TEXT DEFAULT 'SAR',
      date TEXT NOT NULL,
      journal_name TEXT,
      journal_type TEXT,
      move_name TEXT,
      move_ref TEXT,
      move_state TEXT DEFAULT 'posted',
      fiscal_year TEXT,
      period TEXT,
      FOREIGN KEY (company_id) REFERENCES companies(id),
      FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id),
      FOREIGN KEY (unified_account_id) REFERENCES unified_accounts(id)
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

    -- Performance indexes
    CREATE INDEX IF NOT EXISTS idx_journal_items_company ON journal_items(company_id);
    CREATE INDEX IF NOT EXISTS idx_journal_items_date ON journal_items(date);
    CREATE INDEX IF NOT EXISTS idx_journal_items_account ON journal_items(account_code);
    CREATE INDEX IF NOT EXISTS idx_journal_items_account_type ON journal_items(account_type);
    CREATE INDEX IF NOT EXISTS idx_journal_items_unified ON journal_items(unified_account_id);
    CREATE INDEX IF NOT EXISTS idx_journal_items_fiscal ON journal_items(fiscal_year, period);
    CREATE INDEX IF NOT EXISTS idx_journal_items_company_date ON journal_items(company_id, date);
    CREATE INDEX IF NOT EXISTS idx_company_accounts_company ON company_accounts(company_id);
    CREATE INDEX IF NOT EXISTS idx_company_accounts_unified ON company_accounts(unified_account_id);
    CREATE INDEX IF NOT EXISTS idx_journal_entries_company ON journal_entries(company_id);
    CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date);

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
  `);

  // Add redistributable column to analytic_group_mapping if not exists
  try {
    db.prepare(`ALTER TABLE analytic_group_mapping ADD COLUMN redistributable INTEGER DEFAULT 0`).run();
    console.log('[DB] Added redistributable column to analytic_group_mapping');
  } catch (e) { /* column already exists */ }

  // Clean up legacy CLOSING journal_items from old approach
  try {
    const cleaned = db.prepare(`DELETE FROM journal_items WHERE move_name LIKE 'CLOSING/%'`).run();
    if (cleaned.changes > 0) {
      console.log(`[DB] Cleaned up ${cleaned.changes} legacy closing journal_items`);
    }
  } catch (e) { /* ignore if column doesn't exist */ }

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
    )
  `);

  console.log('[DB] Schema initialized successfully');

  // Seed default admin user if none exists (runs every startup, not just on first seed)
  try {
    const adminCount = db.prepare('SELECT COUNT(*) as count FROM admin_users').get();
    if (adminCount.count === 0) {
      const { hashPassword } = require('../middleware/auth');
      const passwordHash = hashPassword('123456');
      db.prepare('INSERT INTO admin_users (email, password_hash, name) VALUES (?, ?, ?)')
        .run('saadm7294@gmail.com', passwordHash, 'مدير النظام');
      console.log('[DB] Default admin created: saadm7294@gmail.com');
    }
  } catch (e) {
    console.log('[DB] Admin seed:', e.message);
  }
}

module.exports = { initializeSchema };
