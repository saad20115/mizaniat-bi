const fs = require('fs');
let code = fs.readFileSync('server/routes/sales.js', 'utf8');

// Inside /customer-hierarchy:
const regexHierarchy = /const mappingsDb = db\.prepare.*?cachedRefToJournalMapTime = Date\.now\(\);\s*\}\s*const refToJournalMap = cachedRefToJournalMap;\s*invoices\.forEach\(inv => \{.*?let rules = globalMappingMap.*?stats\.rem = stats\.total - stats\.refunds - stats\.paid;\s*\}\);/s;

const hierarchyReplacement = `
    const { globalMappingMap, invoiceCostCenters } = refreshMappingsCache(db);
    
    // Build GLOBAL ref-to-journal map
    if (!cachedRefToJournalMap || Date.now() - cachedRefToJournalMapTime > 60000) {
      cachedRefToJournalMap = {};
      const allRefs = db.prepare(\`SELECT raw_data FROM sales_invoices WHERE raw_data LIKE '%journal_name%'\`).all();
      allRefs.forEach(row => {
         try {
           const p = row.raw_data ? JSON.parse(row.raw_data) : {};
           const jn = (p.journal_name || '').trim();
           const num = (p.invoice_number || p.name || '').trim();
           if (jn && num) cachedRefToJournalMap[num] = jn;
         } catch(e) {}
      });
      cachedRefToJournalMapTime = Date.now();
    }
    const refToJournalMap = cachedRefToJournalMap;

    invoices.forEach(inv => {
      const company = inv.company_name || 'أخرى';
      const partner = inv.partner_name || 'غير معروف';
      let paid = 0, unt = 0;
      try {
        const p = inv.raw_data ? JSON.parse(inv.raw_data) : {};
        paid = parseFloat(p.total_paid) || 0;
        unt = parseFloat(p.amount_untaxed) || 0;
      } catch(e) {}
      
      const cl = determineClassification(inv, globalMappingMap, invoiceCostCenters, refToJournalMap);
      const groupName = cl.groupName;
      const ccName = cl.ccName;
      const moveType = cl.moveType;
      const amt = cl.amt;

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
      stats.rem = stats.total - stats.refunds - stats.paid;
    });
`;

code = code.replace(regexHierarchy, hierarchyReplacement.trim());

fs.writeFileSync('server/routes/sales.js', code);
