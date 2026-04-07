const db = require('./server/db/connection').getDb();

const mappingsDb = db.prepare(`
  SELECT m.analytic_account as cost_center, m.journal_name, g.name as group_name 
  FROM analytic_group_mapping m
  JOIN analytic_groups g ON g.id = m.group_id
`).all();

const globalMappingMap = {};
mappingsDb.forEach(m => {
  const jName = (m.journal_name || m.cost_center || '').trim();
  if (jName) {
    globalMappingMap[jName] = { 
      group_name: m.group_name || 'بدون مجموعة', 
      cost_center: m.cost_center || 'بدون مركز' 
    };
  }
});

const invoices = db.prepare(`SELECT raw_data FROM sales_invoices WHERE partner_name LIKE '%الميال%' LIMIT 1`).all();
const inv = JSON.parse(invoices[0].raw_data);
const journalName = (inv.journal_name || '').trim();

let groupName = 'بدون مجموعة';
let ccName = 'بدون مركز تكلفة';

if (globalMappingMap[journalName]) {
  groupName = globalMappingMap[journalName].group_name;
  ccName = globalMappingMap[journalName].cost_center;
} else {
  const partialKey = Object.keys(globalMappingMap).find(k => k && journalName.includes(k));
  if (partialKey) {
    groupName = globalMappingMap[partialKey].group_name;
    ccName = globalMappingMap[partialKey].cost_center;
  }
}

console.log("Journal:", journalName);
console.log("Group:", groupName);
console.log("CC:", ccName);
