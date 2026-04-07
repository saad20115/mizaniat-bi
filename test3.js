const db = require('./server/db/connection').getDb();
const q = db.prepare(`SELECT g.name as group_name, m.cost_center, m.journal_name FROM analytic_group_mapping m JOIN analytic_groups g ON g.id = m.group_id WHERE m.journal_name LIKE '%مختبر جدة%' OR m.journal_name LIKE '%مختبر%'`).all();
console.log(q);
