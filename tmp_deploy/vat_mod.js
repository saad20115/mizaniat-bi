
async function renderVAT(body, d, yrs, selectedCCs) {
  body.innerHTML = '<div class="bi-empty">⏳ جاري حساب الضريبة...</div>';
  try {
    const selectedCos = d._selectedCos || [];
    const params = { limit: 50000 };
    if (selectedCos.length > 0) params.masterCompanyIds = selectedCos.join(',');
    
    // We get dateFrom and dateTo from the UI elements since we don't have them in 'd' explicitly
    const df = document.querySelector('#date-from')?.value;
    const dt = document.querySelector('#date-to')?.value;
    if (df) params.dateFrom = df;
    if (dt) params.dateTo = dt;
    if (selectedCCs && selectedCCs.length > 0) params.costCenters = selectedCCs.join(',');
    
    const data = await api.sales.getInvoices(params);
    if (!data || !data.items) {
      body.innerHTML = '<div class="bi-empty">لا توجد سيولة بيانات مبيعات لعرض الضريبة</div>';
      return;
    }
    
    let grossSales = 0, taxSales = 0;
    let grossRefunds = 0, taxRefunds = 0;
    const byCompany = {};
    
    data.items.forEach(inv => {
      // Exclude draft invoices
      if (inv.state === 'draft') return;
      
      const amt = parseFloat(inv.amount_total) || 0;
      let unt = 0;
      let moveType = '';
      try {
        const p = inv.raw_data ? JSON.parse(inv.raw_data) : {};
        unt = parseFloat(p.amount_untaxed) || 0;
        moveType = p.move_type || '';
      } catch(e) {}
      
      const isRefund = (moveType === 'Customer Credit Note' || moveType === 'out_refund' || amt < 0);
      const absAmt = Math.abs(amt);
      const absUnt = Math.abs(unt);
      const tax = absAmt - absUnt;
      
      const coName = inv.company_name && inv.company_name.trim() !== '' ? inv.company_name : 'أخرى';
      if (!byCompany[coName]) {
        byCompany[coName] = { salesGross: 0, salesTax: 0, refundGross: 0, refundTax: 0 };
      }
      
      if (isRefund) {
        grossRefunds += absAmt;
        taxRefunds += tax;
        byCompany[coName].refundGross += absAmt;
        byCompany[coName].refundTax += tax;
      } else {
        grossSales += absAmt;
        taxSales += tax;
        byCompany[coName].salesGross += absAmt;
        byCompany[coName].salesTax += tax;
      }
    });
    
    const netTax = taxSales - taxRefunds;
    
    let html = `
      <style>
        .vat-grid { display: grid; grid-template-columns: repeat(10, 1fr); gap: 16px; margin-bottom: 24px; }
        .vat-card { background: rgba(255,255,255,0.02); border-radius: 16px; padding: 20px; display: flex; flex-direction: column; justify-content: center; border: 1px solid rgba(255,255,255,0.05); }
        .vat-lbl { font-size: 0.95rem; color: rgba(255,255,255,0.6); margin-bottom: 8px; font-weight: 600; }
        .vat-val { font-size: 1.6rem; font-weight: 800; font-family: var(--font-en); }
        .vc-2 { grid-column: span 2; }
      </style>
      
      <div class="page-title" style="margin-bottom:var(--space-xl);font-size:1.4rem;">🧾 تحليل ضريبة القيمة المضافة (المخرجات)</div>
      
      <div class="vat-grid">
        <div class="vat-card vc-2" style="border-right: 4px solid var(--accent-blue);">
          <div class="vat-lbl">إجمالي المبيعات (شامل الضريبة)</div>
          <div class="vat-val" style="color:var(--accent-blue);">${formatNumber(grossSales)}</div>
        </div>
        <div class="vat-card vc-2" style="border-right: 4px solid var(--accent-purple);">
          <div class="vat-lbl">ضريبة المبيعات</div>
          <div class="vat-val" style="color:var(--accent-purple);">${formatNumber(taxSales)}</div>
        </div>
        <div class="vat-card vc-2" style="border-right: 4px solid var(--accent-amber);">
          <div class="vat-lbl">إجمالي المرتجعات</div>
          <div class="vat-val" style="color:var(--accent-amber);">${formatNumber(grossRefunds)}</div>
        </div>
        <div class="vat-card vc-2" style="border-right: 4px solid #f87171;">
          <div class="vat-lbl">ضريبة المرتجعات</div>
          <div class="vat-val" style="color:#f87171;">${formatNumber(taxRefunds)}</div>
        </div>
        <div class="vat-card vc-2" style="border-right: 4px solid var(--accent-emerald); background:rgba(16,185,129,0.05);">
          <div class="vat-lbl">صافي الضريبة المحصلة (المستحقة)</div>
          <div class="vat-val" style="color:var(--accent-emerald);">${formatNumber(netTax)}</div>
        </div>
      </div>
      
      <div class="card" style="margin-top:var(--space-xl);">
        <h3 style="margin-bottom:var(--space-md);color:var(--text-white);">📊 توزيع الضريبة حسب الشركات</h3>
        <div class="data-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>الشركة</th>
                <th style="text-align:left;">إجمالي المبيعات</th>
                <th style="text-align:left;color:var(--accent-purple);">ضريبة المبيعات</th>
                <th style="text-align:left;">المرتجعات</th>
                <th style="text-align:left;color:#f87171;">ضريبة المرتجعات</th>
                <th style="text-align:left;color:var(--accent-emerald);">صافي الضريبة المستحقة</th>
              </tr>
            </thead>
            <tbody>
              ${Object.keys(byCompany).sort((a,b) => (byCompany[b].salesTax - byCompany[b].refundTax) - (byCompany[a].salesTax - byCompany[a].refundTax)).map(coName => {
                const c = byCompany[coName];
                const net = c.salesTax - c.refundTax;
                return \`
                  <tr>
                    <td><strong>\${coName}</strong></td>
                    <td style="text-align:left;font-family:var(--font-en);">\${formatNumber(c.salesGross)}</td>
                    <td style="text-align:left;font-family:var(--font-en);color:var(--accent-purple);font-weight:bold;">\${formatNumber(c.salesTax)}</td>
                    <td style="text-align:left;font-family:var(--font-en);">\${formatNumber(c.refundGross)}</td>
                    <td style="text-align:left;font-family:var(--font-en);color:#f87171;">\${formatNumber(c.refundTax)}</td>
                    <td style="text-align:left;font-family:var(--font-en);color:var(--accent-emerald);font-weight:bold;font-size:1.1em;">\${formatNumber(net)}</td>
                  </tr>
                \`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    \`;
    
    body.innerHTML = html;
  } catch (err) {
    console.error('Error in renderVAT:', err);
    body.innerHTML = '<div class="bi-empty" style="color:red;">❌ حدث خطأ أثناء حساب الضريبة</div>';
  }
}
