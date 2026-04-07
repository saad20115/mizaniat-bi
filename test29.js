const db = require('./server/db/connection').getDb();
console.log(db.prepare("SELECT m.id, m.analytic_account, m.journal_name, g.name as group_name FROM analytic_group_mapping m JOIN analytic_groups g ON m.group_id = g.id WHERE m.company_id = 3").all());
