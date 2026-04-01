import { api } from '../api.js';

export async function showTaxReportBuilder(container) {
  // Clear container
  container.innerHTML = `<div class="bi-empty">جاري تحميل مصمم التقرير الضريبي...</div>`;

  try {
    // 1. Fetch companies
    const companies = await api.getCompanies();
    if (!companies || companies.length === 0) {
      container.innerHTML = '<div class="bi-empty">لم يتم العثور على شركات.</div>';
      return;
    }

    // Default selections
    let selectedCo = companies[0].id;
    let selectedYear = new Date().getFullYear().toString();
    let selectedPeriod = 'monthly';

    // State for config
    let builderOptions = { vatAccounts: [], journals: [], moveNames: [] };
    let builderConfig = { inputAccounts: [], outputAccounts: [], excludedJournals: [], excludedMoveNames: [] };

    // Layout
    container.innerHTML = `
      <div class="bi-header">
        <h1 class="bi-title">مصمم التقرير الضريبي</h1>
        <div class="bi-actions">
          <select id="builder-co-select" class="bi-input">
            ${companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
          <select id="builder-year-select" class="bi-input">
            <option value="2023">2023</option>
            <option value="2024" selected>2024</option>
            <option value="2025">2025</option>
            <option value="2026">2026</option>
          </select>
          <select id="builder-period-select" class="bi-input">
            <option value="monthly" selected>شهري</option>
            <option value="quarterly">ربع سنوي</option>
            <option value="annual">سنوي</option>
          </select>
          <button id="btn-load-config" class="btn btn-primary">تحديث الإعدادات</button>
        </div>
      </div>
      
      <div class="bi-grid" style="grid-template-columns: 1fr; gap: 20px; align-items: start;">
        
        <div class="bi-card" style="max-width: 800px; margin: 0 auto;">
          <div class="bi-card-title">تخصيص الحسابات المستهدفة (اختياري)</div>
          <p style="color:#64748b; font-size:0.85rem; margin-bottom:16px;">
            تعتمد المنظومة ذكاءً آلياً لحساب ضرائب المبيعات والمشتريات تلقائياً من دفاترها، وتتجاهل قيود السداد. 
            إذا تُركت هذه الخيارات فارغة، سيتم تجميع أي حساب يحتوي على كلمة "ضريب".
          </p>
          
          <div style="margin-bottom: 16px;">
            <label style="display:block; margin-bottom: 8px; color: #94a3b8; font-size: 0.9rem;">حسابات مدخلات الضريبة (Input VAT)</label>
            <select id="builder-input-accs" multiple class="bi-input" style="height: 100px; width: 100%;">
              <option disabled>جاري التحميل...</option>
            </select>
          </div>

          <div style="margin-bottom: 16px;">
            <label style="display:block; margin-bottom: 8px; color: #94a3b8; font-size: 0.9rem;">حسابات مخرجات الضريبة (Output VAT)</label>
            <select id="builder-output-accs" multiple class="bi-input" style="height: 100px; width: 100%;">
              <option disabled>جاري التحميل...</option>
            </select>
          </div>
        </div>

      </div>

      <div style="display: flex; gap: 12px; margin-top: 20px;">
        <button id="btn-save-config" class="btn" style="background: #10b981; color: white; padding: 10px 24px;">حفظ الإعدادات</button>
        <button id="btn-run-report" class="btn btn-primary" style="padding: 10px 24px;">توليد التقرير بناءً على الإعدادات</button>
      </div>

      <div id="builder-results" style="margin-top: 30px;">
        <!-- Results will appear here -->
      </div>
    `;

    const elCo = document.getElementById('builder-co-select');
    const elYr = document.getElementById('builder-year-select');
    const elPe = document.getElementById('builder-period-select');
    
    const elInpAccs = document.getElementById('builder-input-accs');
    const elOutAccs = document.getElementById('builder-output-accs');
    const elResults = document.getElementById('builder-results');

    // Load config from server
    async function loadConfiguration() {
      try {
        const res = await api.getTaxReportConfig(selectedCo);
        builderOptions = res.options;
        builderConfig = res.config;
        
        // Populate DOM
        populateMultiSelect(document.getElementById('builder-input-accs'), builderOptions.vatAccounts, item => item.account_name, item => `${item.account_code} - ${item.account_name}`, builderConfig.inputAccounts);
        populateMultiSelect(document.getElementById('builder-output-accs'), builderOptions.vatAccounts, item => item.account_name, item => `${item.account_code} - ${item.account_name}`, builderConfig.outputAccounts);
        
      } catch (err) {
        console.error(err);
        alert('خطأ في تحميل الإعدادات: ' + err.message);
      }
    }

    function populateMultiSelect(selectEl, dataData, valFn, labelFn, selectedArr) {
      selectEl.innerHTML = '';
      dataData.forEach(item => {
        const val = valFn(item);
        const opt = document.createElement('option');
        opt.value = val;
        opt.innerText = labelFn(item);
        if (selectedArr && selectedArr.includes(val)) opt.selected = true;
        selectEl.appendChild(opt);
      });
    }

    function getSelectedValues(selectEl) {
      if (!selectEl) return [];
      return Array.from(selectEl.selectedOptions || []).map(o => o.value);
    }

    // Save config
    document.getElementById('btn-save-config').addEventListener('click', async () => {
      const payload = {
          companyId: selectedCo,
          inputAccounts: getSelectedValues(document.getElementById('builder-input-accs')),
          outputAccounts: getSelectedValues(document.getElementById('builder-output-accs'))
        };
      
      try {
        const res = await api.saveTaxReportConfig(payload);
        if (res.success) alert('تم حفظ الإعدادات بنجاح!');
      } catch (err) {
        alert('خطأ أثناء الحفظ: ' + err.message);
      }
    });

    // Run report
    document.getElementById('btn-run-report').addEventListener('click', async () => {
      elResults.innerHTML = `<div class="bi-empty">جاري بناء التقرير...</div>`;
      const payload = {
        companyId: selectedCo,
        year: elYr.value,
        period: elPe.value,
        inputAccounts: getSelectedValues(document.getElementById('builder-input-accs')),
        outputAccounts: getSelectedValues(document.getElementById('builder-output-accs'))
      };
      
      try {
        const reportData = await api.generateCustomTaxReport(payload);
        renderResults(reportData);
      } catch (err) {
        elResults.innerHTML = `<div class="bi-empty" style="color:#ef4444;">خطأ: ${err.message}</div>`;
      }
    });

    // Format helper
    const fmt = num => new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num || 0);

    // Render results
    function renderResults(data) {
      if (!data || !data.periods || data.periods.length === 0) {
        elResults.innerHTML = `<div class="bi-empty">لا توجد حركات ضريبية مطابقة لهذه الإعدادات.</div>`;
        return;
      }
      
      const summary = data.summary;
      const netColor = summary.totalNet >= 0 ? '#ef4444' : '#10b981';
      const netLabel = summary.totalNet >= 0 ? 'مستحقة للهيئة' : 'مستردة';

      const MONTH_NAMES = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
      const PERIOD_LABELS = { 'Q1': 'الربع الأول', 'Q2': 'الربع الثاني', 'Q3': 'الربع الثالث', 'Q4': 'الربع الرابع' };
      function periodLabel(p) {
        if (p.includes('-Q')) return PERIOD_LABELS[p.split('-')[1]] || p;
        if (p.length === 7) return MONTH_NAMES[parseInt(p.split('-')[1]) - 1] || p;
        return p;
      }

      const allItems = data.periods.flatMap(p => (p.items || []).map(item => ({...item, periodKey: p.period })));
      const detailsRows = allItems.map(item => {
        const typeLabel = item.type === 'input' ? '<span style="color:#10b981;">مشتريات</span>' : '<span style="color:#ef4444;">مبيعات</span>';
        const isRefund = item.refundAmount > 0;
        const refundFlag = isRefund ? '<span style="color:#f59e0b; font-size:0.75rem; background:rgba(245, 158, 11, 0.1); padding:2px 4px; border-radius:4px; margin-right:6px;">مرتجع</span>' : '';
        const amtColor = item.type === 'input' ? '#10b981' : '#ef4444';
        return `
          <tr class="vat-detail-row-custom" data-period="${item.periodKey}" style="display:none;background:rgba(255,255,255,0.02);">
            <td>${item.date}</td>
            <td style="font-size:0.9rem;">${item.company.length > 25 ? item.company.substring(0, 25) + '…' : item.company}</td>
            <td>${typeLabel} ${refundFlag}</td>
            <td style="font-size:0.85rem;color:rgba(255,255,255,0.6);">${item.journalEntry}</td>
            <td style="font-size:0.85rem;">${item.label} ${item.partner ? '<br><span style="color:#3b82f6;">' + item.partner + '</span>' : ''}</td>
            <td class="n" style="color:${amtColor};font-weight:600;">${fmt(Math.abs(item.netAmount))}</td>
          </tr>
        `;
      }).join('');

      elResults.innerHTML = `
        <!-- KPI Cards -->
        <div class="bi-kpi-row" style="margin-bottom:24px;">
          <div class="bi-kpi">
            <div class="bi-kpi-label">المبيعات الإجمالية</div>
            <div class="bi-kpi-value" style="color:#ef4444;">${fmt(summary.totalOutputBase)}</div>
            <div class="bi-kpi-sub" style="color:#ef4444;">يخصم منها مرتجعات: ${fmt(summary.totalOutputRefund)}</div>
          </div>
          <div class="bi-kpi">
            <div class="bi-kpi-label">المشتريات الإجمالية</div>
            <div class="bi-kpi-value" style="color:#10b981;">${fmt(summary.totalInputBase)}</div>
            <div class="bi-kpi-sub" style="color:#10b981;">يخصم منها مرتجعات: ${fmt(summary.totalInputRefund)}</div>
          </div>
          <div class="bi-kpi">
            <div class="bi-kpi-label">صافي الإقرار</div>
            <div class="bi-kpi-value" style="color:${netColor};">${fmt(Math.abs(summary.totalNet))}</div>
            <div class="bi-kpi-sub" style="color:${netColor};">${netLabel}</div>
          </div>
        </div>

        <div class="bi-card">
          <div class="bi-card-title">التقرير النهائي المبني وفق الإعدادات</div>
          <div style="overflow-x:auto;">
            <table class="bi-table">
              <thead>
                <tr>
                  <th>الفترة</th>
                  <th class="n">المبيعات</th>
                  <th class="n">مرتجعات המبيعات</th>
                  <th class="n">صافي المخرجات</th>
                  <th class="n">المشتريات</th>
                  <th class="n">مرتجعات المشتريات</th>
                  <th class="n">صافي المدخلات</th>
                  <th class="n">الضريبة المستحقة</th>
                  <th>التفاصيل</th>
                </tr>
              </thead>
              <tbody>
                ${data.periods.map(p => {
                  const pNetColor = p.netVAT >= 0 ? '#ef4444' : '#10b981';
                  const pStatus = p.netVAT >= 0 ? 'مستحقة' : 'مستردة';
                  return `<tr>
                    <td style="font-weight:700;">${periodLabel(p.period)}</td>
                    <td class="n" style="color:rgba(239, 68, 68, 0.7);">${fmt(p.outputBase)}</td>
                    <td class="n" style="color:rgba(239, 68, 68, 0.5);">${fmt(p.outputRefund)}</td>
                    <td class="n" style="color:#ef4444;font-weight:700">${fmt(p.outputVAT)}</td>
                    <td class="n" style="color:rgba(16, 185, 129, 0.7);">${fmt(p.inputBase)}</td>
                    <td class="n" style="color:rgba(16, 185, 129, 0.5);">${fmt(p.inputRefund)}</td>
                    <td class="n" style="color:#10b981;font-weight:700">${fmt(p.inputVAT)}</td>
                    <td class="n" style="color:${pNetColor};font-weight:800;">${fmt(Math.abs(p.netVAT))} <span style="font-size:0.75rem;font-weight:normal;">(${pStatus})</span></td>
                    <td><button class="btn btn-show-details-custom" data-period="${p.period}" style="font-size:0.8rem;padding:6px 12px;background:rgba(59,130,246,0.15);color:#60a5fa;border:1px solid rgba(59,130,246,0.3);border-radius:6px;cursor:pointer;">عرض القيود</button></td>
                  </tr>`;
                }).join('')}
              </tbody>
              <tfoot>
                <tr style="background:rgba(255,255,255,0.05);">
                  <td style="font-weight:800;">الإجمالي</td>
                  <td class="n" style="color:rgba(239, 68, 68, 0.7);">${fmt(summary.totalOutputBase)}</td>
                  <td class="n" style="color:rgba(239, 68, 68, 0.5);">${fmt(summary.totalOutputRefund)}</td>
                  <td class="n" style="color:#ef4444;font-weight:700">${fmt(summary.totalOutput)}</td>
                  <td class="n" style="color:rgba(16, 185, 129, 0.7);">${fmt(summary.totalInputBase)}</td>
                  <td class="n" style="color:rgba(16, 185, 129, 0.5);">${fmt(summary.totalInputRefund)}</td>
                  <td class="n" style="color:#10b981;font-weight:700">${fmt(summary.totalInput)}</td>
                  <td class="n" style="color:${netColor};font-weight:800;">${fmt(Math.abs(summary.totalNet))}</td>
                  <td style="color:${netColor};">${netLabel}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- Details Table Container -->
          <div id="custom-details-container" style="display:none;margin-top:20px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.1);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
              <h4 style="margin:0;color:#94a3b8;font-size:1rem;">القيود المضمنة (الفترة: <span id="custom-details-period-label" style="color:#fff;"></span>)</h4>
              <button id="custom-details-close" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:1.2rem;padding:0 8px;">X</button>
            </div>
            <div style="max-height:450px;overflow-y:auto;border-radius:8px;border:1px solid rgba(255,255,255,0.05);background:rgba(0,0,0,0.15);">
              <table class="bi-table" style="font-size:0.9rem;margin:0;">
                <thead style="position:sticky;top:0;background:#0f172a;z-index:10;">
                  <tr>
                    <th>التاريخ</th>
                    <th>الشركة</th>
                    <th>النوع</th>
                    <th>رقم القيد</th>
                    <th>البيان / الشريك</th>
                    <th class="n">المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  ${detailsRows}
                </tbody>
                <tbody id="custom-details-empty" style="display:none;">
                  <tr><td colspan="6" style="text-align:center;padding:24px;color:rgba(255,255,255,0.5);">لا توجد قيود مسجلة</td></tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      `;

      // Details logic
      elResults.querySelectorAll('.btn-show-details-custom').forEach(btn => {
        btn.addEventListener('click', () => {
          const p = btn.dataset.period;
          elResults.querySelector('#custom-details-period-label').innerText = periodLabel(p);
          elResults.querySelector('#custom-details-container').style.display = 'block';
          let hasRows = false;
          elResults.querySelectorAll('.vat-detail-row-custom').forEach(row => {
            if (row.dataset.period === p) { row.style.display = 'table-row'; hasRows = true; }
            else row.style.display = 'none';
          });
          elResults.querySelector('#custom-details-empty').style.display = hasRows ? 'none' : 'table-row-group';
        });
      });
      elResults.querySelector('#custom-details-close')?.addEventListener('click', () => {
        elResults.querySelector('#custom-details-container').style.display = 'none';
      });
    }

    // Handlers
    elCo.addEventListener('change', () => { selectedCo = elCo.value; loadConfiguration(); });
    elYr.addEventListener('change', () => { selectedYear = elYr.value; });
    elPe.addEventListener('change', () => { selectedPeriod = elPe.value; });
    document.getElementById('btn-load-config').addEventListener('click', loadConfiguration);

    // Initial load
    loadConfiguration();

  } catch (err) {
    console.error('Builder init error:', err);
    container.innerHTML = `<div class="bi-empty" style="color:#ef4444">خطأ في التهيئة: ${err.message}</div>`;
  }
}
