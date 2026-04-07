const { getDb } = require('./server/db/connection');
const db = getDb();
  
const mappings = db.prepare(`
  SELECT m.company_id, m.analytic_account as cost_center, m.journal_name, g.name as group_name
  FROM analytic_group_mapping m
  JOIN analytic_groups g ON g.id = m.group_id
`).all();

const globalMappingMap = {};
mappings.forEach(m => {
  const jName = (m.journal_name || m.cost_center || '').trim();
  globalMappingMap[jName] = { group_name: m.group_name, cost_center: m.cost_center };
});

const invoices = db.prepare('SELECT company_id, raw_data FROM sales_invoices LIMIT 500').all();
let foundMatch = 0, failedMatch = 0;
let failedExamples = new Set();
  
invoices.forEach(inv => {
  let jName = '';
  try {
    const p = inv.raw_data ? JSON.parse(inv.raw_data) : {};
    jName = (p.journal_name || '').trim();
  } catch(e) {}
  
  if (globalMappingMap[jName]) {
    foundMatch++;
  } else {
    failedMatch++;
    failedExamples.add(`Journal:"${jName}"`);
  }
});
  
console.log(`\n=== INVOICE MATCH STATS ===`);
console.log(`Matches: ${foundMatch}`);
console.log(`Failures: ${failedMatch}`);
console.log(`\n=== FAILURE EXAMPLES (Top 10) ===`);
console.log(Array.from(failedExamples).slice(0, 10).join('\n'));
