const http = require('http');

http.get('http://localhost:3090/api/sales/customer-hierarchy', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      if (!parsed.hierarchy) {
        console.log("No hierarchy in response:", parsed);
        return;
      }
      
      const hierarchy = parsed.hierarchy;
      const companies = Object.keys(hierarchy);
      console.log(`Found ${companies.length} companies in hierarchy.`);
      
      let allGroups = new Set();
      let allCCs = new Set();
      let mappedInvoices = 0;
      let unmappedInvoices = 0;
      
      companies.forEach(company => {
        const groups = hierarchy[company];
        Object.keys(groups).forEach(group => {
          allGroups.add(group);
          const ccs = groups[group];
          Object.keys(ccs).forEach(cc => {
            allCCs.add(cc);
            const partners = ccs[cc];
            const ptCount = Object.keys(partners).length;
            if (group === 'بدون مجموعة') {
              unmappedInvoices += ptCount;
            } else {
              mappedInvoices += ptCount;
            }
          });
        });
      });
      
      console.log(`\n=== API HIERARCHY SUMMARY ===`);
      console.log(`Groups found: ${Array.from(allGroups).join(', ')}`);
      console.log(`Mapped Unique Partners: ${mappedInvoices}`);
      console.log(`Unmapped Unique Partners ('بدون مجموعة'): ${unmappedInvoices}`);
      
      // Let's print the actual tree for the first company
      if (companies.length > 0) {
        const c0 = companies[0];
        console.log(`\n=== TREE FOR COMPANY: ${c0} ===`);
        const g0 = Object.keys(hierarchy[c0]);
        g0.forEach(g => {
          console.log(` - Group: ${g}`);
          Object.keys(hierarchy[c0][g]).forEach(cc => {
            console.log(`    - CC: ${cc} (Partners: ${Object.keys(hierarchy[c0][g][cc]).length})`);
          });
        });
      }
      
    } catch (e) {
      console.log("Error parsing backend response:", e.message);
      console.log("Raw response snippet:", data.substring(0, 500));
    }
  });
}).on('error', err => {
  console.log("Error fetching API:", err.message);
});
