const http = require('http');
http.get('http://localhost:3090/api/sales/customer-hierarchy?dateFrom=2024-01-01', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    const rawData = JSON.parse(data);
    const { hierarchy } = rawData;
    let foundAlOqood = false;
    let foundJamal = false;
    
    Object.keys(hierarchy).forEach(company => {
      Object.keys(hierarchy[company]).forEach(group => {
        if (group.includes('العقد الموحد')) {
           foundAlOqood = true;
           console.log(`Found Al Oqood in ${company}`);
        }
        if (group.includes('مشاريع الحج')) {
           foundJamal = true;
           console.log(`Found Hajj Projects in ${company}`);
           const ccKeys = Object.keys(hierarchy[company][group]);
           console.log(`Hajj Cost Centers:`, ccKeys.slice(0, 5));
        }
      });
    });
    console.log("Success: ", foundAlOqood, foundJamal);
  });
});
