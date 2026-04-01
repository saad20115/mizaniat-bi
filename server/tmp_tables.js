const sqlite = require('better-sqlite3');
const db = new sqlite('d:/mizaniat/data/mizaniat.db');
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log(tables);
