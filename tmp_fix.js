const fs = require('fs');
let code = fs.readFileSync('server/routes/sales.js', 'utf8');

// 1. Build the global helper functions and cache initialization at the top
const injection1 = `
let cachedGlobalMappingMap = null;
let cachedGlobalMappingMapTime = 0;
let cachedInvoiceCostCenters = null;
let cachedInvoiceCostCentersTime = 0;

function refreshMappingsCache(db) {
  const now = Date.now();
  if (cachedGlobalMappingMap && now - cachedGlobalMappingMapTime < 60000 && 
      cachedInvoiceCostCenters && now - cachedInvoiceCostCentersTime < 60000) {
    return { globalMappingMap: cachedGlobalMappingMap, invoiceCostCenters: cachedInvoiceCostCenters };
  }

  // Fetch group mappings perfectly bypassing strict company branch linkages
  const mappingsDb = db.prepare(\`
    SELECT m.analytic_account as cost_center, m.journal_name, g.name as group_name 
    FROM analytic_group_mapping m
    JOIN analytic_groups g ON g.id = m.group_id
  \`).all();
  
  const map = {};
  mappingsDb.forEach(m => {
    const jName = (m.journal_name || m.cost_center || '').trim();
    if (jName) {
      if (!map[jName]) map[jName] = [];
      map[jName].push({ 
        group_name: m.group_name || 'بدون مجموعة', 
        cost_center: m.cost_center || 'بدون مركز',
        raw_analytic: (m.cost_center || '').trim()
      });
    }
  });
  
  cachedGlobalMappingMap = map;
  cachedGlobalMappingMapTime = Date.now();

  const ccMap = {};
  const allCC = db.prepare(\`SELECT move_name, analytic_account FROM journal_items WHERE move_name IS NOT NULL AND analytic_account IS NOT NULL AND analytic_account != ''\`).all();
  allCC.forEach(row => { ccMap[row.move_name] = row.analytic_account; });
  
  cachedInvoiceCostCenters = ccMap;
  cachedInvoiceCostCentersTime = Date.now();
  
  return { globalMappingMap: map, invoiceCostCenters: ccMap };
}

function determineClassification(inv, globalMappingMap, invoiceCostCenters, refToJournalMap) {
  let groupName = 'بدون مجموعة';
  let ccName = 'بدون مركز تكلفة';
  
  const amt = parseFloat(inv.amount_total) || 0;
  let moveType = '', journalName = '', num = '';
  try {
    const p = inv.raw_data ? JSON.parse(inv.raw_data) : {};
    moveType = p.move_type || '';
    journalName = (p.journal_name || '').trim();
    num = (p.name || p.invoice_number || '').trim();
    
    if (['Customer Credit Note', 'out_refund'].includes(moveType) || amt < 0) {
      const pRef = (p.reference || '').trim();
      if (!journalName && pRef && refToJournalMap[pRef]) {
        journalName = refToJournalMap[pRef];
      }
      if (!journalName) {
        journalName = 'مرتجعات مبيعات';
      }
    }
  } catch(e) {}

  const partner = inv.partner_name || 'غير معروف';
  const moveName = inv.name || num;

  // FIRST PRIORITY: Exact Analytic Account from journal_items APIS !!
  const exactCC = invoiceCostCenters[moveName];
  if (exactCC) {
    // If we have an exact analytic_account from journal_items, lookup its group using the group mapping rule array:
    // We search across globalMappingMap for any rule whose raw_analytic matches exactCC
    let found = false;
    for (const key of Object.keys(globalMappingMap)) {
      const match = globalMappingMap[key].find(r => exactCC.includes(r.raw_analytic) || r.raw_analytic.includes(exactCC));
      if (match) {
        groupName = match.group_name;
        ccName = match.cost_center;
        found = true;
        break;
      }
    }
    // If we found the exact Cost Center but no mapped group, we use that Cost Center directly!
    if (!found) {
      ccName = exactCC;
      groupName = 'بدون مجموعة';
      // Specific fallback heuristics just in case:
      if (exactCC.includes('العقد الموحد')) {
        groupName = 'العقد الموحد';
      }
    }
    return { groupName, ccName, moveType, amt, journalName };
  }

  // SECOND PRIORITY: Journal Fallback Matching
  let rules = globalMappingMap[journalName];
  if (!rules) {
    const partialKey = Object.keys(globalMappingMap).find(k => k && journalName.includes(k));
    if (partialKey) {
      rules = globalMappingMap[partialKey];
    } else if (journalName.includes('العقد الموحد')) {
      groupName = 'العقد الموحد';
      if (journalName.includes('مكه') || journalName.includes('ليث') || journalName.includes('خليص')) {
        ccName = 'مشروع العقد الموحد مكه شركة الكهرباء';
      } else {
        ccName = 'مشروع العقد الموحد المدينه شركة الكهرباء';
      }
    }
  }

  if (rules && rules.length > 0) {
    if (rules.length === 1) {
      groupName = rules[0].group_name;
      ccName = rules[0].cost_center;
    } else {
      const exactMatch = rules.find(r => partner.includes(r.raw_analytic) || r.raw_analytic.includes(partner));
      if (exactMatch) {
        groupName = exactMatch.group_name;
        ccName = exactMatch.cost_center;
      } else {
        const defaultRule = rules.find(r => r.group_name.includes('الحج')) || rules[0];
        groupName = defaultRule.group_name;
        ccName = partner;
      }
    }
  }
  
  return { groupName, ccName, moveType, amt, journalName };
}
`;

// Insert the helper at the top before // ===== SALES INVOICES DATA =====
code = code.replace('// ===== SALES INVOICES DATA =====', injection1 + '\n\n// ===== SALES INVOICES DATA =====');

// Now inside the paginated GET '/'
// We need to attach groupName and ccName to the `items` array returned.
const itemsProcessing = `
    const items = db.prepare(sql).all(...params);
    
    // Attach classification to items for frontend "Sales Tab"
    const { globalMappingMap, invoiceCostCenters } = refreshMappingsCache(db);
    // Cached ref to journal map is still scoped later, let's just create a quick local one or ignore refs for the simple tabular view!
    // Actually we can just build a quick ref map from the items 
    const quickRefMap = {};
    items.forEach(inv=>{
      try{ const p=JSON.parse(inv.raw_data||'{}'); if(p.name && p.journal_name) quickRefMap[p.name]=p.journal_name; }catch(e){}
    });
    
    items.forEach(inv => {
       const cl = determineClassification(inv, globalMappingMap, invoiceCostCenters, quickRefMap);
       inv.group_name = cl.groupName;
       inv.cost_center = cl.ccName;
    });
`;
code = code.replace('const items = db.prepare(sql).all(...params);', itemsProcessing);

fs.writeFileSync('server/routes/sales.js', code);
