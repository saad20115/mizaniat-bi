const { getDb } = require('./server/db/connection');
const db = getDb();
console.log(db.prepare("SELECT DISTINCT journal_name FROM journal_items WHERE journal_name IS NOT NULL LIMIT 20").all());
process.exit(0);
