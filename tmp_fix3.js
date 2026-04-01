const fs = require('fs');
let code = fs.readFileSync('d:/mizaniat/client/js/pages/presentation.js', 'utf8');

const targetBlock = `      byPartner[partner].total += amt;
      if (moveType === 'Customer Credit Note' || moveType === 'out_refund') byPartner[partner].refunds += Math.abs(amt);
      byPartner[partner].untaxed += unt;
      byPartner[partner].tax += (amt - unt);
      byPartner[partner].paid += paid;
      byPartner[partner].rem = byPartner[partner].total - byPartner[partner].paid;`;

const newBlock = `      if (moveType === 'Customer Credit Note' || moveType === 'out_refund' || amt < 0) {
        byPartner[partner].refunds += Math.abs(amt);
      } else {
        byPartner[partner].total += amt;
        byPartner[partner].untaxed += unt;
        byPartner[partner].tax += (amt - unt);
      }
      
      // We assume paid accumulates normally (it might be positive or negative from Odoo based on reconciliation).
      // If paid is absolute for both invoices and refunds, we just sum it. Usually paid = Math.abs(paid) from API if it's already reconciled.
      // Actually, from JSON-rpc, we did total_paid: r.amount_total_signed - r.amount_residual_signed.
      // So paid is inherently negative for refunds if they are paid/reconciled. So summing it works nicely.
      byPartner[partner].paid += paid;
      
      // Calculate remaining mathematically: Gross Sales - Refunds - Net Paid.
      // Wait, if paid is already negative for refunds, then (total - refunds) is the net invoiced.
      // If a refund is reconciled, its residual is 0. So paid = -100.
      // Net paid = sum of positive payments and negative refunds.
      // So effectively Remaining = byPartner[partner].total - byPartner[partner].refunds - byPartner[partner].paid;
      byPartner[partner].rem = byPartner[partner].total - byPartner[partner].refunds - byPartner[partner].paid;`;

code = code.replace(targetBlock, newBlock);

fs.writeFileSync('d:/mizaniat/client/js/pages/presentation.js', code);
console.log('Done replacement');
