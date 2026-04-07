const Database = require('better-sqlite3');
const db = new Database('./data/mizaniat.db', { fileMustExist: true });

function refreshMappingsCache(db) {
  const mappingsDb = db.prepare(`SELECT m.analytic_account as cost_center, m.journal_name, g.name as group_name FROM analytic_group_mapping m JOIN analytic_groups g ON g.id = m.group_id`).all();
  const map = {};
  mappingsDb.forEach(m => {
    const jName = (m.journal_name || m.cost_center || '').trim();
    if (jName) {
      if (!map[jName]) map[jName] = [];
      map[jName].push({ 
        group_name: m.group_name || 'بدون مجموعة', 
        cost_center: m.cost_center || 'بدون مركز',
        raw_analytic: (m.cost_center || '').trim(),
        rule_journal: (m.journal_name || '').trim()
      });
    }
  });
  
  const ccMap = {};
  const allCC = db.prepare(`SELECT move_name, company_id, analytic_account FROM journal_items WHERE move_name IS NOT NULL AND analytic_account IS NOT NULL AND analytic_account != ''`).all();
  allCC.forEach(row => { 
    const key = `${row.move_name}::${row.company_id}`;
    const existing = ccMap[key];
    if (!existing || row.analytic_account.length > existing.length) {
      ccMap[key] = row.analytic_account;
    }
  });

  const s2m = {};
  try {
    const salesCos = db.prepare('SELECT id, sales_company_id FROM sales_companies').all();
    const masterCos = db.prepare('SELECT id, odoo_company_id FROM companies').all();
    salesCos.forEach(sc => {
      const mc = masterCos.find(mc => mc.odoo_company_id === sc.sales_company_id);
      if (mc) s2m[sc.id] = mc.id;
    });
  } catch(e) {}
  
  return { globalMappingMap: map, invoiceCostCenters: ccMap, salesToMasterMap: s2m };
}

const { globalMappingMap, invoiceCostCenters, salesToMasterMap } = refreshMappingsCache(db);

const salesCode = require('./server/routes/sales.js');

const inv13 = db.prepare(`SELECT * FROM sales_invoices WHERE name = 'INV/2026/00013'`).get();
const rinv1 = db.prepare(`SELECT * FROM sales_invoices WHERE name = 'RINV/2026/00001'`).get();

function testDetermine(inv) {
  // Extracting logic directly from the sales.js file string
  const fileContent = require('fs').readFileSync('./server/routes/sales.js', 'utf-8');
  const funcMatch = fileContent.match(/function determineClassification\([\s\S]*?\n\}/);
  if (!funcMatch) return;
  const fn = eval('(' + funcMatch[0] + ')');
  const res = fn(inv, globalMappingMap, invoiceCostCenters, {}, salesToMasterMap);
  console.log(`${inv.name}: ${JSON.stringify(res)}`);
}

testDetermine(inv13);
testDetermine(rinv1);
