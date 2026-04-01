const fs = require('fs');
let code = fs.readFileSync('d:/mizaniat/client/js/pages/presentation.js', 'utf8');

code = code.replace(
  /const t = data\.totals \|\| \{\};\s+let totalSales = t\.amount_total \|\| 0;\s+let totalUntaxed = t\.amount_untaxed \|\| 0;\s+let totalTax = totalSales - totalUntaxed;\s+let totalPaid = t\.total_paid \|\| 0;\s+let totalRem = totalSales - totalPaid;\s+let invCount = data\.total \|\| 0;/g,
  "let totalSales = 0;\n    let totalUntaxed = 0;\n    let totalTax = 0;\n    let totalPaid = 0;\n    let totalRem = 0;\n    let invCount = 0;"
);

code = code.replace(
  / \(\(data\.items \|\| \[\]\)\.forEach\(inv => \{\s+\/\/ Exclude draft invoices per user request\s+if \(inv\.state === 'draft'\) return;/g,
  " (data.items || []).forEach(inv => {\n      // Strictly ignore drafts and cancel states so KPIs match Odoo exactly\n      const s = (inv.state || inv.status || '').toLowerCase();\n      if (s === 'draft' || s === 'cancel' || s === 'cancelled') return;\n      invCount++;"
);

// We find the exact spot after catch(e){} to insert KPI accumulators
const catchE = "      } catch(e) {}";
// Inside the loop:
code = code.replace(
  catchE,
  catchE + "\n\n      if (moveType === 'Customer Credit Note' || moveType === 'out_refund' || amt < 0) {\n        // Handled in totalRefunds\n      } else {\n        totalSales += amt;\n        totalUntaxed += unt;\n        totalTax += (amt - unt);\n      }\n      totalPaid += paid;"
);

// We fix totalRem calculation before sorting
code = code.replace(
  "    // Sort all partners by total sales descending",
  "    totalRem = totalSales - totalRefunds - totalPaid;\n    // Sort all partners by total sales descending"
);

// Since totalSales is now Gross, remove + totalRefunds from KPI
code = code.replace(
  "${fmt(totalSales + totalRefunds)}",
  "${fmt(totalSales)}"
);

fs.writeFileSync('d:/mizaniat/client/js/pages/presentation.js', code);
console.log('Script 4 complete');
