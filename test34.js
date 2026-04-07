const db = require('./server/db/connection').getDb();

const invoices = db.prepare(`
   SELECT si.name, si.amount_total, si.raw_data, si.partner_name, c.name as company_name 
   FROM sales_invoices si
   LEFT JOIN sales_companies c ON c.id = si.company_id
   WHERE si.company_id = 3
`).all();

const mappingsDb = db.prepare(`
   SELECT m.analytic_account as cost_center, m.journal_name, g.name as group_name 
   FROM analytic_group_mapping m
   JOIN analytic_groups g ON g.id = m.group_id
`).all();

const globalMappingMap = {};
mappingsDb.forEach(m => {
   const jName = (m.journal_name || m.cost_center || '').trim();
   if (jName) {
      if (!globalMappingMap[jName]) globalMappingMap[jName] = [];
      globalMappingMap[jName].push({ 
         group_name: m.group_name || 'بدون مجموعة', 
         cost_center: m.cost_center || 'بدون مركز',
         raw_analytic: (m.cost_center || '').trim()
      });
   }
});

const hierarchy = {};

invoices.forEach(inv => {
   let p = {}, journalName = '', ref = '';
   try { p = JSON.parse(inv.raw_data); } catch(e) {}
   journalName = (p.journal_name || '').trim();
   ref = (p.reference || '').trim();
   
   let groupName = 'بدون مجموعة';
   let ccName = 'بدون مركز تكلفة';
   const company = inv.company_name || 'أخرى';
   const partner = inv.partner_name || 'غير معروف';

   let rules = globalMappingMap[journalName];

   if (!rules) {
      const partialKey = Object.keys(globalMappingMap).find(k => k && journalName.includes(k));
      if (partialKey) {
         rules = globalMappingMap[partialKey];
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

   if (!hierarchy[groupName]) hierarchy[groupName] = {};
   if (!hierarchy[groupName][ccName]) hierarchy[groupName][ccName] = 1;
   else hierarchy[groupName][ccName]++;
});

console.log(JSON.stringify(hierarchy, null, 2));
