const db = require('./server/db/connection').getDb();
const mappingsDb = db.prepare('SELECT m.analytic_account as cost_center, m.journal_name, g.name as group_name FROM analytic_group_mapping m JOIN analytic_groups g ON g.id = m.group_id').all();
const globalMappingMap = {};
mappingsDb.forEach(m => {
  const jName = (m.journal_name || m.cost_center || '').trim();
  if (jName) {
    globalMappingMap[jName] = { group_name: m.group_name || 'بدون مجموعة', cost_center: m.cost_center || 'بدون مركز' };
  }
});
console.log(globalMappingMap['مختبر جدة']);
