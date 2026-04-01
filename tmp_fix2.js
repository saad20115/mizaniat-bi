const fs = require('fs');
let code = fs.readFileSync('d:/mizaniat/client/js/pages/presentation.js', 'utf8');

code = code.replace(
  "byPartner[partner] = { name: partner, total: 0, untaxed: 0, tax: 0, paid: 0, rem: 0 };",
  "byPartner[partner] = { name: partner, total: 0, untaxed: 0, tax: 0, paid: 0, rem: 0, refunds: 0 };"
);

code = code.replace(
  "byPartner[partner].total += amt;",
  "byPartner[partner].total += amt;\n      if (moveType === 'Customer Credit Note' || moveType === 'out_refund') byPartner[partner].refunds += Math.abs(amt);"
);

code = code.replace(
  '<th class="n">إجمالي قيمة المبيعات</th>',
  '<th class="n">إجمالي قيمة المبيعات</th>\n                <th class="n" style="color:#ef4444;">المرتجعات</th>'
);

code = code.replace(
  '<td class="n" style="color:#10b981;font-weight:700;">${fmt(p.total)}</td>',
  '<td class="n" style="color:#10b981;font-weight:700;">${fmt(p.total)}</td>\n            <td class="n" style="color:#ef4444;font-weight:bold;">${p.refunds > 0 ? fmt(p.refunds) : \'—\'}</td>'
);

code = code.replace(
  '<td colspan="8"',
  '<td colspan="9"'
);

fs.writeFileSync('d:/mizaniat/client/js/pages/presentation.js', code);
