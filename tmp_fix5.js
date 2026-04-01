const fs = require('fs');
let code = fs.readFileSync('d:/mizaniat/client/js/pages/presentation.js', 'utf8');

code = code.replace(
  "      if (moveType === 'Customer Credit Note' || moveType === 'out_refund' || amt < 0) {\n        // Handled in totalRefunds\n      } else {\n        totalSales += amt;\n        totalUntaxed += unt;\n        totalTax += (amt - unt);\n      }",
  "      if (moveType === 'Customer Credit Note' || moveType === 'out_refund' || amt < 0) {\n        byPartner[partner].refunds += Math.abs(amt);\n      } else {\n        totalSales += amt;\n        totalUntaxed += unt;\n        totalTax += (amt - unt);\n        byPartner[partner].total += amt;\n        byPartner[partner].untaxed += unt;\n        byPartner[partner].tax += (amt - unt);\n      }"
);

// We need to make sure we don't double add to byPartner if it's already added at the end of the loop
// Wait! Let's check what's at the end of the loop in presentation.js
// Ah! I should view the loop content first.
