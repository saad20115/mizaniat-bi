const { getDb } = require('./server/db/connection');
const db = getDb();
  
const mappings = db.prepare(`
  SELECT sc.id as sales_company_id, m.analytic_account as cost_center, m.journal_name, g.name as group_name
  FROM analytic_group_mapping m
  JOIN analytic_groups g ON g.id = m.group_id
  JOIN companies c ON c.id = m.company_id
  JOIN sales_companies sc ON (c.odoo_company_id = sc.sales_company_id OR c.name = sc.name)
`).all();

const mappingMap = {};
mappings.forEach(m => {
  const cId = m.sales_company_id;
  if (!mappingMap[cId]) mappingMap[cId] = [];
  mappingMap[cId].push((m.journal_name || m.cost_center || '').trim());
});

console.log("Joined SC keys:", Object.keys(mappingMap));
console.log("SC=1 Journals:", mappingMap[1]);
console.log("SC=3 Journals:", mappingMap[3]);
