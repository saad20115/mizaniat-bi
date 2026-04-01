const sqlite = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', '..', 'data', 'mizaniat.db');
const db = new sqlite(dbPath);

console.log('Creating missing tables for Sales integration...');

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sales_app_settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    
    INSERT OR IGNORE INTO sales_app_settings (key, value) VALUES ('sync_enabled', 'false');
    INSERT OR IGNORE INTO sales_app_settings (key, value) VALUES ('sync_interval_hours', '2');
  `);
  console.log('Created sales_app_settings');
} catch (e) {
  console.error('Error creating sales_app_settings', e);
}

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sales_sync_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  console.log('Created sales_sync_notifications');
} catch (e) {
  console.error('Error creating sales_sync_notifications', e);
}

console.log('Done.');
