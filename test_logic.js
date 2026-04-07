const { getDb } = require('./server/db/connection');
const db = getDb();
  
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

const invoices = db.prepare(`SELECT company_id, name, amount_total, raw_data, partner_name 
      FROM sales_invoices si WHERE si.state != 'draft'`).all();

const hierarchy = {}; 
invoices.forEach(inv => {
  const amt = parseFloat(inv.amount_total) || 0;
  let paid = 0, unt = 0, moveType = '', journalName = '';
  
  try {
    const p = inv.raw_data ? JSON.parse(inv.raw_data) : {};
    paid = parseFloat(p.total_paid) || 0;
    unt = parseFloat(p.amount_untaxed) || 0;
    moveType = p.move_type || '';
    journalName = (p.journal_name || '').trim();
    if (!inv.company_name) inv.company_name = p.company_name;
  } catch(e) {}
  
  const company = (inv.company_name || 'أخرى').trim();
  const partner = (inv.partner_name || 'غير معروف').trim();
  
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
  
  if (!hierarchy[company]) hierarchy[company] = {};
  if (!hierarchy[company][groupName]) hierarchy[company][groupName] = {};
  if (!hierarchy[company][groupName][ccName]) hierarchy[company][groupName][ccName] = {};
  
  if (!hierarchy[company][groupName][ccName][partner]) {
    hierarchy[company][groupName][ccName][partner] = {
      total: 0, untaxed: 0, tax: 0, refunds: 0, paid: 0, rem: 0
    };
  }
  
  const stats = hierarchy[company][groupName][ccName][partner];
  
  if (moveType === 'Customer Credit Note' || moveType === 'out_refund' || amt < 0) {
    stats.refunds += Math.abs(amt);
  } else {
    stats.total += amt;
    stats.untaxed += unt;
    stats.tax += (amt - unt);
  }
  stats.paid += paid;
});

// Now let's calculate totals like the frontend:
let gtGross = 0;
Object.keys(hierarchy).forEach(coName => {
  const coGroups = hierarchy[coName];
  Object.keys(coGroups).forEach(grpName => {
    const grpCCs = coGroups[grpName];
    Object.keys(grpCCs).forEach(ccName => {
      const ccPartners = grpCCs[ccName];
      Object.keys(ccPartners).forEach(ptName => {
         gtGross += ccPartners[ptName].total;
      });
    });
  });
});

console.log("Total Gross Across Hierarchy:", gtGross);
