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

function determineClassification(inv, globalMappingMap, invoiceCostCenters, refToJournalMap, salesToMasterMap) {
  let groupName = 'بدون مجموعة';
  let ccName = 'بدون مركز تكلفة';
  
  const amt = parseFloat(inv.amount_total) || 0;
  let moveType = '', journalName = '', num = '';
  try {
    const p = inv.raw_data ? JSON.parse(inv.raw_data) : {};
    moveType = p.move_type || '';
    journalName = (p.journal_name || '').trim();
    num = (p.name || p.invoice_number || '').trim();
  } catch(e) {}

  const partner = inv.partner_name || 'غير معروف';
  const moveName = inv.name || num;

  const salesCompanyId = inv.company_id;
  const masterCompanyId = (salesToMasterMap || {})[salesCompanyId] || salesCompanyId;

  const companyKey = `${moveName}::${masterCompanyId}`;
  const exactCC = invoiceCostCenters[companyKey];
  
  console.log(`\n--- TRACING INVOICE ${inv.name} ---`);
  console.log(`moveName=${moveName}, salesCo=${salesCompanyId}, masterCo=${masterCompanyId}, partner=${partner}, amt=${amt}`);
  console.log(`journalName=${journalName}, companyKey=${companyKey}, exactCC=${exactCC}`);

  if (exactCC) {
    let found = false;
    let exactMatches = [];
    for (const key of Object.keys(globalMappingMap)) {
      const ms = globalMappingMap[key].filter(r => r.raw_analytic === exactCC);
      if (ms.length > 0) exactMatches.push(...ms);
    }
    
    console.log(`Found ${exactMatches.length} EXACT matches in mapping:`);
    exactMatches.forEach(em => console.log(`  group=${em.group_name}, cc=${em.cost_center}, rule_journal='${em.rule_journal}'`));

    if (exactMatches.length > 0) {
      let match1 = exactMatches.find(r => r.rule_journal && r.rule_journal === journalName);
      let match2 = exactMatches.find(r => !r.rule_journal);
      let match3 = exactMatches[0];
      
      console.log(`  match1 (exact journal) = `, match1);
      console.log(`  match2 (empty journal) = `, match2);

      let match = match1 || match2 || match3;
      groupName = match.group_name;
      ccName = match.cost_center;
      found = true;
      console.log(`  => Chosen match: group=${groupName}, cc=${ccName}`);
    } else {
        console.log(`  => NO EXACT MATCH FOUND`);
    }
    
    if (!found) {
      // Step B
      console.log(`  => Step B lookup...`);
    }
  } else {
    console.log(`  No exactCC found in journal_items lookup`);
  }
}

const { globalMappingMap, invoiceCostCenters, salesToMasterMap } = refreshMappingsCache(db);
const inv = db.prepare(`SELECT * FROM sales_invoices WHERE name = 'INV/2026/00020'`).get();
if (inv) determineClassification(inv, globalMappingMap, invoiceCostCenters, {}, salesToMasterMap);

const oldInv = db.prepare(`SELECT * FROM sales_invoices WHERE name = 'INV/2025/00001' AND company_id = 5`).get();
if (oldInv) determineClassification(oldInv, globalMappingMap, invoiceCostCenters, {}, salesToMasterMap);
