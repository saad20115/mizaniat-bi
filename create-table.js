const { getDb } = require('./server/db/connection');
const db = getDb();
db.exec(`
    CREATE TABLE IF NOT EXISTS journal_name_mappings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      original_name TEXT NOT NULL,
      mapped_name TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (company_id) REFERENCES companies(id),
      UNIQUE(company_id, original_name)
    );
`);
console.log("Table created.");
process.exit(0);
