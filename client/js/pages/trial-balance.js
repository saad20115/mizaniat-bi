import { api } from '../api.js';
import { store } from '../store.js';
import { formatNumber } from '../utils/format.js';
import { showToast } from '../utils/ui.js';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export async function renderTrialBalance(container) {
  const companies = store.get('companies') || [];
  const fiscalYear = store.get('fiscalYear') || '';
  const dateFrom = store.get('dateFrom') || '';
  const dateTo = store.get('dateTo') || '';
  const filterOptions = store.get('filterOptions') || {};

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">ميزان المراجعة</h1>
        <p class="page-subtitle">Trial Balance</p>
      </div>
      <div style="display:flex;gap:var(--space-sm);">
        <button class="btn" id="btn-export-pdf" style="display:flex;align-items:center;gap:6px;font-size:0.8rem;background:rgba(239,68,68,0.1);color:var(--accent-red);border-color:rgba(239,68,68,0.2);" disabled>
          📄 تصدير PDF
        </button>
        <button class="btn" id="btn-export-excel" style="display:flex;align-items:center;gap:6px;font-size:0.8rem;background:rgba(16,185,129,0.1);color:var(--accent-emerald);border-color:rgba(16,185,129,0.2);" disabled>
          📊 تصدير Excel
        </button>
        <button class="btn" id="btn-sync-data" style="display:flex;align-items:center;gap:6px;font-size:0.8rem;">
          <span id="sync-icon">🔄</span> تحديث البيانات
        </button>
      </div>
    </div>
    
    <div class="glass-card" style="padding:var(--space-lg);margin-bottom:var(--space-lg);">
      <div style="display:flex;flex-wrap:wrap;gap:var(--space-md);align-items:flex-end;">
        
        <div class="filter-group">
          <span class="filter-label">الشركة</span>
          <select class="filter-select" id="tb-company" style="min-width:220px;">
            ${companies.map(c => `
              <option value="${c.id}">${c.name}</option>
            `).join('')}
          </select>
        </div>

        <div class="filter-group">
          <span class="filter-label">السنة المالية</span>
          <select class="filter-select" id="tb-fiscal-year">
            <option value="">-- اختر --</option>
            ${(filterOptions.fiscalYears || []).map(fy => `
              <option value="${fy}" ${fiscalYear === fy ? 'selected' : ''}>${fy}</option>
            `).join('')}
          </select>
        </div>

        <div class="filter-group">
          <span class="filter-label">من تاريخ</span>
          <input type="date" class="filter-select" id="tb-date-from" value="${dateFrom}" />
        </div>
        
        <div class="filter-group">
          <span class="filter-label">إلى تاريخ</span>
          <input type="date" class="filter-select" id="tb-date-to" value="${dateTo}" />
        </div>

        <div class="filter-group">
          <span class="filter-label">مركز التكلفة</span>
          <select class="filter-select" id="tb-cost-center">
            <option value="">الكل</option>
            ${(filterOptions.costCenters || []).map(cc => `
              <option value="${cc}">${cc}</option>
            `).join('')}
          </select>
        </div>

        <div class="filter-group" style="align-self:flex-end;">
          <button class="btn btn-primary" id="btn-tb-load">عرض الميزان</button>
        </div>
      </div>
      
      <div style="display:flex;flex-wrap:wrap;gap:var(--space-md);align-items:center;margin-top:var(--space-md);padding-top:var(--space-md);border-top:1px solid rgba(255,255,255,0.06);">
        <label style="display:flex;align-items:center;gap:6px;font-size:0.8rem;color:var(--text-secondary);">
          <input type="checkbox" id="chk-tb-zero" /> إخفاء الأرصدة الصفرية
        </label>
      </div>
    </div>

    <div id="tb-content"><p style="text-align:center;color:var(--text-muted);padding:var(--space-xl);">اختر الشركة والفترة ثم اضغط "عرض الميزان"</p></div>
  `;

  // Fiscal year auto-fill dates
  container.querySelector('#tb-fiscal-year').addEventListener('change', (e) => {
    const fy = e.target.value;
    if (fy) {
      container.querySelector('#tb-date-from').value = `${fy}-01-01`;
      container.querySelector('#tb-date-to').value = `${fy}-12-31`;
    }
  });

  container.querySelector('#btn-tb-load').addEventListener('click', () => loadData(container));
  container.querySelector('#chk-tb-zero').addEventListener('change', () => {
    if (trialBalanceData) renderTable(container);
  });
  container.querySelector('#btn-export-pdf').addEventListener('click', () => exportPDF(container));
  container.querySelector('#btn-export-excel').addEventListener('click', () => exportExcel(container));

  // Sync button
  container.querySelector('#btn-sync-data').addEventListener('click', async () => {
    const companyId = container.querySelector('#tb-company').value;
    if (!companyId) { showToast('اختر شركة أولاً', 'error'); return; }
    const btn = container.querySelector('#btn-sync-data');
    const icon = container.querySelector('#sync-icon');
    btn.disabled = true;
    icon.style.animation = 'spin 1s linear infinite';
    btn.querySelector('span:last-child')?.remove();
    btn.insertAdjacentHTML('beforeend', '<span> جاري المزامنة...</span>');
    try {
      const resp = await fetch(`/api/sync/company/${companyId}`, { method: 'POST' });
      const data = await resp.json();
      if (data.started) {
        // Poll progress
        let done = false;
        while (!done) {
          await new Promise(r => setTimeout(r, 3000));
          const pResp = await fetch(`/api/sync/status/${companyId}`);
          const pData = await pResp.json();
          if (pData.status === 'done' || pData.status === 'idle' || pData.status === 'error') {
            done = true;
            if (pData.status === 'error') showToast('خطأ في المزامنة', 'error');
            else showToast(`✅ تم تحديث البيانات — ${pData.inserted || ''} سجل`, 'success');
          }
        }
        // Reload data if we have a period selected
        const dateFrom = container.querySelector('#tb-date-from').value;
        const dateTo = container.querySelector('#tb-date-to').value;
        if (dateFrom && dateTo) loadData(container);
      }
    } catch (err) {
      showToast('خطأ في الاتصال', 'error');
    } finally {
      btn.disabled = false;
      icon.style.animation = '';
      const span = btn.querySelector('span:last-child');
      if (span) span.textContent = ' تحديث البيانات';
    }
  });

  // Auto-load if fiscal year is set
  if (fiscalYear) {
    container.querySelector('#tb-date-from').value = `${fiscalYear}-01-01`;
    container.querySelector('#tb-date-to').value = `${fiscalYear}-12-31`;
  }
}

let trialBalanceData = null;

async function loadData(container) {
  const companyId = container.querySelector('#tb-company').value;
  const dateFrom = container.querySelector('#tb-date-from').value;
  const dateTo = container.querySelector('#tb-date-to').value;
  const costCenter = container.querySelector('#tb-cost-center').value;

  if (!dateFrom || !dateTo) {
    showToast('يجب اختيار الفترة (من تاريخ - إلى تاريخ)', 'error');
    return;
  }

  const el = container.querySelector('#tb-content');
  el.innerHTML = '<div class="skeleton" style="height:400px;border-radius:var(--radius-lg);"></div>';

  try {
    const data = await api.getTrialBalance({ companyId, dateFrom, dateTo, costCenter });
    trialBalanceData = data;
    renderTable(container);
    // Enable export buttons
    container.querySelector('#btn-export-pdf').disabled = false;
    container.querySelector('#btn-export-excel').disabled = false;
  } catch (err) {
    console.error('Trial balance error:', err);
    showToast('خطأ في تحميل ميزان المراجعة', 'error');
    el.innerHTML = '<p style="text-align:center;color:var(--accent-red);padding:var(--space-xl);">خطأ في التحميل</p>';
  }
}

function renderTable(container) {
  const el = container.querySelector('#tb-content');
  if (!trialBalanceData) return;

  const hideZero = container.querySelector('#chk-tb-zero')?.checked || false;
  const companySelect = container.querySelector('#tb-company');
  const companyName = companySelect.options[companySelect.selectedIndex]?.text || '';
  const dateFrom = container.querySelector('#tb-date-from').value;
  const dateTo = container.querySelector('#tb-date-to').value;

  let items = trialBalanceData.accounts || [];
  if (hideZero) {
    items = items.filter(a => 
      Math.abs(a.open_debit) > 0.001 || Math.abs(a.open_credit) > 0.001 ||
      Math.abs(a.period_debit) > 0.001 || Math.abs(a.period_credit) > 0.001 ||
      Math.abs(a.close_debit) > 0.001 || Math.abs(a.close_credit) > 0.001
    );
  }

  // Calculate totals
  const totals = items.reduce((t, a) => ({
    open_debit: t.open_debit + a.open_debit,
    open_credit: t.open_credit + a.open_credit,
    period_debit: t.period_debit + a.period_debit,
    period_credit: t.period_credit + a.period_credit,
    close_debit: t.close_debit + a.close_debit,
    close_credit: t.close_credit + a.close_credit,
  }), { open_debit: 0, open_credit: 0, period_debit: 0, period_credit: 0, close_debit: 0, close_credit: 0 });

  const openDiff = Math.abs(totals.open_debit - totals.open_credit);
  const closeDiff = Math.abs(totals.close_debit - totals.close_credit);

  el.innerHTML = `
    <div style="margin-bottom:var(--space-md);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-sm);">
      <div style="display:flex;gap:var(--space-md);align-items:center;">
        <span style="font-size:0.85rem;font-weight:600;color:var(--text-primary);">🏢 ${companyName}</span>
        <span style="font-size:0.75rem;color:var(--text-muted);">الفترة: ${dateFrom} إلى ${dateTo}</span>
        <span style="font-size:0.75rem;color:var(--text-muted);">عدد الحسابات: ${items.length}</span>
      </div>
      <div style="display:flex;gap:var(--space-md);">
        <span style="font-size:0.75rem;color:${closeDiff < 0.01 ? 'var(--accent-emerald)' : 'var(--accent-red)'};">
          ${closeDiff < 0.01 ? '✅ الميزان متوازن' : `⚠️ فرق الإقفال: ${formatNumber(closeDiff, 2)}`}
        </span>
      </div>
    </div>

    <div class="data-table-wrapper fade-in">
      <table class="data-table" style="font-size:0.78rem;">
        <thead>
          <tr>
            <th rowspan="2" style="min-width:70px;vertical-align:middle;">الكود</th>
            <th rowspan="2" style="min-width:180px;vertical-align:middle;">اسم الحساب</th>
            <th colspan="2" style="text-align:center;border-bottom:2px solid var(--accent-amber);background:rgba(245,158,11,0.08);">الأرصدة الافتتاحية</th>
            <th colspan="2" style="text-align:center;border-bottom:2px solid var(--accent-blue);background:rgba(59,130,246,0.08);">حركة الفترة</th>
            <th colspan="2" style="text-align:center;border-bottom:2px solid var(--accent-emerald);background:rgba(16,185,129,0.08);">رصيد نهاية الفترة</th>
          </tr>
          <tr>
            <th class="number" style="background:rgba(245,158,11,0.04);font-size:0.7rem;">مدين</th>
            <th class="number" style="background:rgba(245,158,11,0.04);font-size:0.7rem;">دائن</th>
            <th class="number" style="background:rgba(59,130,246,0.04);font-size:0.7rem;">مدين</th>
            <th class="number" style="background:rgba(59,130,246,0.04);font-size:0.7rem;">دائن</th>
            <th class="number" style="background:rgba(16,185,129,0.04);font-size:0.7rem;">مدين</th>
            <th class="number" style="background:rgba(16,185,129,0.04);font-size:0.7rem;">دائن</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(a => `
            <tr>
              <td style="font-family:var(--font-en);font-size:0.75em;color:var(--accent-blue);">${a.account_code}</td>
              <td>${a.account_name}</td>
              <td class="number">${a.open_debit ? formatNumber(a.open_debit, 2) : '-'}</td>
              <td class="number">${a.open_credit ? formatNumber(a.open_credit, 2) : '-'}</td>
              <td class="number">${a.period_debit ? formatNumber(a.period_debit, 2) : '-'}</td>
              <td class="number">${a.period_credit ? formatNumber(a.period_credit, 2) : '-'}</td>
              <td class="number" style="font-weight:600;">${a.close_debit ? formatNumber(a.close_debit, 2) : '-'}</td>
              <td class="number" style="font-weight:600;">${a.close_credit ? formatNumber(a.close_credit, 2) : '-'}</td>
            </tr>
          `).join('')}
          <tr class="total-row" style="font-size:0.95em;">
            <td colspan="2" style="font-weight:700;">الإجمالي</td>
            <td class="number" style="font-weight:700;">${formatNumber(totals.open_debit, 2)}</td>
            <td class="number" style="font-weight:700;">${formatNumber(totals.open_credit, 2)}</td>
            <td class="number" style="font-weight:700;">${formatNumber(totals.period_debit, 2)}</td>
            <td class="number" style="font-weight:700;">${formatNumber(totals.period_credit, 2)}</td>
            <td class="number" style="font-weight:700;color:var(--accent-emerald);">${formatNumber(totals.close_debit, 2)}</td>
            <td class="number" style="font-weight:700;color:var(--accent-emerald);">${formatNumber(totals.close_credit, 2)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    ${renderClosingSection(items)}
  `;

  // Attach closing entry button handler
  const closingBtn = el.querySelector('#btn-closing-entry');
  if (closingBtn) {
    closingBtn.addEventListener('click', () => generateClosingEntry(container));
  }
}

function renderClosingSection(items) {
  // Identify income and expense accounts (accounts to be closed)
  const closableTypes = ['income', 'income_other', 'expense', 'expense_depreciation', 'expense_direct_cost'];
  const closableAccounts = items.filter(a => closableTypes.includes(a.account_type));
  
  if (closableAccounts.length === 0) {
    return '';
  }

  const totalIncome = closableAccounts
    .filter(a => a.account_type?.startsWith('income'))
    .reduce((s, a) => s + (a.open_credit - a.open_debit), 0);
  
  const totalExpense = closableAccounts
    .filter(a => a.account_type?.startsWith('expense'))
    .reduce((s, a) => s + (a.open_debit - a.open_credit), 0);

  const netResult = totalIncome - totalExpense;

  // Show ALL non-income/expense accounts in the dropdown
  // This ensures accounts like retained earnings (201033) always appear
  const closableSet = new Set(closableTypes);
  const dropdownAccounts = items.filter(a => !closableSet.has(a.account_type));

  return `
    <div class="glass-card fade-in" style="padding:var(--space-lg);margin-top:var(--space-lg);border:1px solid rgba(245,158,11,0.2);">
      <h3 style="margin:0 0 var(--space-md);color:var(--accent-amber);font-size:1rem;">
        🔄 إقفال الأرصدة الافتتاحية — ترحيل أرصدة الإيرادات والمصروفات
      </h3>
      
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:var(--space-md);margin-bottom:var(--space-md);">
        <div style="background:rgba(16,185,129,0.08);padding:var(--space-md);border-radius:var(--radius-md);border:1px solid rgba(16,185,129,0.15);">
          <div style="font-size:0.75rem;color:var(--text-muted);">إيرادات افتتاحية</div>
          <div style="font-size:1.1rem;font-weight:700;color:var(--accent-emerald);font-family:var(--font-en);">${formatNumber(totalIncome, 2)}</div>
        </div>
        <div style="background:rgba(239,68,68,0.08);padding:var(--space-md);border-radius:var(--radius-md);border:1px solid rgba(239,68,68,0.15);">
          <div style="font-size:0.75rem;color:var(--text-muted);">مصروفات افتتاحية</div>
          <div style="font-size:1.1rem;font-weight:700;color:var(--accent-red);font-family:var(--font-en);">${formatNumber(totalExpense, 2)}</div>
        </div>
        <div style="background:rgba(59,130,246,0.08);padding:var(--space-md);border-radius:var(--radius-md);border:1px solid rgba(59,130,246,0.15);">
          <div style="font-size:0.75rem;color:var(--text-muted);">${netResult >= 0 ? 'صافي الربح' : 'صافي الخسارة'}</div>
          <div style="font-size:1.1rem;font-weight:700;color:${netResult >= 0 ? 'var(--accent-emerald)' : 'var(--accent-red)'};font-family:var(--font-en);">${formatNumber(Math.abs(netResult), 2)}</div>
        </div>
      </div>

      <div style="display:flex;flex-wrap:wrap;gap:var(--space-md);align-items:flex-end;margin-bottom:var(--space-md);">
        <div class="filter-group" style="flex:1;min-width:250px;">
          <span class="filter-label">حساب الإقفال (أرباح / خسائر مُحتجزة)</span>
          <select class="filter-select" id="closing-target-account" style="width:100%;">
            <option value="">-- اختر من القائمة أو أدخل يدوياً --</option>
            ${dropdownAccounts
              .map(a => `<option value="${a.account_code}" data-name="${a.account_name}" data-type="${a.account_type}">${a.account_code} - ${a.account_name}</option>`)
              .join('')}
          </select>
          <div style="display:flex;gap:var(--space-sm);margin-top:var(--space-sm);">
            <input type="text" id="closing-manual-code" class="filter-select" 
              placeholder="كود الحساب (مثلاً 201033)" 
              style="flex:1;min-width:120px;font-family:var(--font-en);font-size:0.8rem;">
            <input type="text" id="closing-manual-name" class="filter-select" 
              placeholder="اسم الحساب" 
              style="flex:2;min-width:150px;font-size:0.8rem;">
          </div>
          <div style="font-size:0.65rem;color:var(--text-muted);margin-top:2px;">
            💡 إذا لم يكن الحساب في القائمة، أدخل الكود والاسم يدوياً في الحقول أعلاه
          </div>
        </div>
        <div class="filter-group" style="align-self:flex-end;">
          <button class="btn btn-primary" id="btn-closing-entry" style="background:var(--accent-amber);border-color:var(--accent-amber);">
            📋 إنشاء قيد الإقفال
          </button>
        </div>
      </div>

      <div style="font-size:0.72rem;color:var(--text-muted);line-height:1.6;">
        💡 سيتم إنشاء قيد إقفال يُصفّر <strong>الأرصدة الافتتاحية</strong> لـ <strong>${closableAccounts.length}</strong> حساب (إيرادات ومصروفات) 
        ويرحّل صافي الفرق إلى الحساب المختار. القيد يُسجل بتاريخ اليوم الأخير من الفترة السابقة.
      </div>
    </div>
  `;
}

async function generateClosingEntry(container) {
  const targetSelect = container.querySelector('#closing-target-account');
  const manualCode = container.querySelector('#closing-manual-code')?.value?.trim();
  const manualName = container.querySelector('#closing-manual-name')?.value?.trim();
  
  // Priority: dropdown selection first, manual input as fallback
  let targetCode, targetName, targetType;
  if (targetSelect?.value) {
    targetCode = targetSelect.value;
    targetName = targetSelect.options[targetSelect.selectedIndex]?.dataset?.name || '';
    targetType = targetSelect.options[targetSelect.selectedIndex]?.dataset?.type || 'equity';
  } else if (manualCode) {
    targetCode = manualCode;
    targetName = manualName || manualCode;
    targetType = 'equity';
  }

  if (!targetCode) {
    showToast('يجب اختيار حساب الإقفال من القائمة أو إدخال الكود يدوياً', 'error');
    return;
  }

  const companyId = container.querySelector('#tb-company').value;
  const dateFrom = container.querySelector('#tb-date-from').value;
  const dateTo = container.querySelector('#tb-date-to').value;

  const closableTypes = ['income', 'income_other', 'expense', 'expense_depreciation', 'expense_direct_cost'];
  const items = trialBalanceData.accounts.filter(a => closableTypes.includes(a.account_type));

  // Build closing entry lines — close OPENING balances only
  const lines = [];
  for (const acc of items) {
    const openNet = acc.open_debit - acc.open_credit;
    if (Math.abs(openNet) < 0.01) continue;
    
    // Reverse the opening balance: if account has debit opening, credit it; vice versa
    lines.push({
      account_code: acc.account_code,
      account_name: acc.account_name,
      account_type: acc.account_type,
      debit: openNet < 0 ? Math.abs(openNet) : 0,
      credit: openNet > 0 ? openNet : 0,
    });
  }

  // Add the target (retained earnings) line
  const totalDebit = lines.reduce((s, l) => s + l.debit, 0);
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0);
  const diff = totalDebit - totalCredit;

  lines.push({
    account_code: targetCode,
    account_name: targetName,
    account_type: targetType,
    debit: diff < 0 ? Math.abs(diff) : 0,
    credit: diff > 0 ? diff : 0,
  });

  try {
    const result = await api.createClosingEntry({
      companyId,
      dateFrom,
      dateTo,
      targetAccount: targetCode,
      targetAccountName: targetName,
      lines,
    });
    
    showToast(`✅ تم إنشاء قيد الإقفال بنجاح — ${result.linesInserted || lines.length} سطر تم إدراجه في قاعدة البيانات`, 'success');
    
    // Reload the trial balance to reflect the closing entry
    await loadData(container);

  } catch (err) {
    console.error('Closing entry error:', err);
    showToast('خطأ في إنشاء قيد الإقفال', 'error');
  }
}

// ========== EXPORT FUNCTIONS ==========

function getExportData(container) {
  if (!trialBalanceData) return null;
  
  const hideZero = container.querySelector('#chk-tb-zero')?.checked || false;
  let items = trialBalanceData.accounts || [];
  if (hideZero) {
    items = items.filter(a => 
      a.open_debit || a.open_credit || a.period_debit || a.period_credit || a.close_debit || a.close_credit
    );
  }
  
  const companySelect = container.querySelector('#tb-company');
  const companyName = companySelect.options[companySelect.selectedIndex]?.text || '';
  const dateFrom = container.querySelector('#tb-date-from').value;
  const dateTo = container.querySelector('#tb-date-to').value;
  
  return { items, companyName, dateFrom, dateTo };
}

function exportExcel(container) {
  const data = getExportData(container);
  if (!data) { showToast('لا توجد بيانات للتصدير', 'error'); return; }
  
  try {
    const { items, companyName, dateFrom, dateTo } = data;
    
    // Build worksheet data
    const wsData = [];
    
    // Title rows
    wsData.push([`ميزان المراجعة — ${companyName}`]);
    wsData.push([`الفترة: ${dateFrom} → ${dateTo}`]);
    wsData.push([]);
    
    // Headers
    wsData.push([
      'كود الحساب',
      'اسم الحساب',
      'نوع الحساب',
      'رصيد افتتاحي - مدين',
      'رصيد افتتاحي - دائن',
      'حركة الفترة - مدين',
      'حركة الفترة - دائن',
      'رصيد ختامي - مدين',
      'رصيد ختامي - دائن',
    ]);
    
    // Data rows
    const totals = { od: 0, oc: 0, pd: 0, pc: 0, cd: 0, cc: 0 };
    for (const a of items) {
      wsData.push([
        a.account_code,
        a.account_name,
        a.account_type || '',
        a.open_debit || 0,
        a.open_credit || 0,
        a.period_debit || 0,
        a.period_credit || 0,
        a.close_debit || 0,
        a.close_credit || 0,
      ]);
      totals.od += a.open_debit || 0;
      totals.oc += a.open_credit || 0;
      totals.pd += a.period_debit || 0;
      totals.pc += a.period_credit || 0;
      totals.cd += a.close_debit || 0;
      totals.cc += a.close_credit || 0;
    }
    
    // Totals row
    wsData.push([
      '', 'الإجمالي', '',
      totals.od, totals.oc, totals.pd, totals.pc, totals.cd, totals.cc,
    ]);
    
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Column widths
    ws['!cols'] = [
      { wch: 14 }, // code
      { wch: 40 }, // name
      { wch: 20 }, // type
      { wch: 18 }, // open_debit
      { wch: 18 }, // open_credit
      { wch: 18 }, // period_debit
      { wch: 18 }, // period_credit
      { wch: 18 }, // close_debit
      { wch: 18 }, // close_credit
    ];
    
    // Merge title cells
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
    ];
    
    // Format number cells 
    const fmtNum = '#,##0.00';
    for (let r = 4; r < wsData.length; r++) {
      for (let c = 3; c <= 8; c++) {
        const cellRef = XLSX.utils.encode_cell({ r, c });
        if (ws[cellRef]) {
          ws[cellRef].t = 'n';
          ws[cellRef].z = fmtNum;
        }
      }
    }
    
    XLSX.utils.book_append_sheet(wb, ws, 'ميزان المراجعة');
    XLSX.writeFile(wb, `trial_balance_${dateFrom}_${dateTo}.xlsx`);
    
    showToast('✅ تم تصدير ملف Excel بنجاح', 'success');
  } catch (err) {
    console.error('Excel export error:', err);
    showToast('خطأ في تصدير Excel', 'error');
  }
}

async function exportPDF(container) {
  const data = getExportData(container);
  if (!data) { showToast('لا توجد بيانات للتصدير', 'error'); return; }
  
  try {
    showToast('⏳ جاري إنشاء PDF...', 'info');
    const { items, companyName, dateFrom, dateTo } = data;
    
    // Build a temporary table element for rendering
    const totals = { od: 0, oc: 0, pd: 0, pc: 0, cd: 0, cc: 0 };
    items.forEach(a => {
      totals.od += a.open_debit || 0;
      totals.oc += a.open_credit || 0;
      totals.pd += a.period_debit || 0;
      totals.pc += a.period_credit || 0;
      totals.cd += a.close_debit || 0;
      totals.cc += a.close_credit || 0;
    });

    const tempDiv = document.createElement('div');
    tempDiv.style.cssText = 'position:fixed;top:-99999px;left:0;width:1400px;background:#fff;padding:30px;font-family:Arial,Tahoma,sans-serif;direction:rtl;color:#000;';
    tempDiv.innerHTML = `
      <div style="text-align:center;margin-bottom:20px;">
        <h2 style="margin:0 0 6px;font-size:22px;color:#000;font-weight:900;">ميزان المراجعة</h2>
        <h3 style="margin:0 0 6px;font-size:16px;color:#1e293b;font-weight:700;">${companyName}</h3>
        <p style="margin:0;font-size:13px;color:#334155;font-weight:600;">الفترة: ${dateFrom} → ${dateTo}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;direction:rtl;">
        <thead>
          <tr style="background:#1e293b;color:#fff;">
            <th style="padding:8px 6px;border:1px solid #000;text-align:right;font-size:12px;font-weight:700;">اسم الحساب</th>
            <th style="padding:8px 6px;border:1px solid #000;text-align:center;font-size:12px;font-weight:700;">كود الحساب</th>
            <th style="padding:8px 6px;border:1px solid #000;text-align:center;font-size:12px;font-weight:700;" colspan="2">الرصيد الافتتاحي</th>
            <th style="padding:8px 6px;border:1px solid #000;text-align:center;font-size:12px;font-weight:700;" colspan="2">حركة الفترة</th>
            <th style="padding:8px 6px;border:1px solid #000;text-align:center;font-size:12px;font-weight:700;" colspan="2">الرصيد الختامي</th>
          </tr>
          <tr style="background:#334155;color:#fff;font-size:11px;">
            <th style="padding:5px;border:1px solid #000;"></th>
            <th style="padding:5px;border:1px solid #000;"></th>
            <th style="padding:5px;border:1px solid #000;font-weight:700;">مدين</th>
            <th style="padding:5px;border:1px solid #000;font-weight:700;">دائن</th>
            <th style="padding:5px;border:1px solid #000;font-weight:700;">مدين</th>
            <th style="padding:5px;border:1px solid #000;font-weight:700;">دائن</th>
            <th style="padding:5px;border:1px solid #000;font-weight:700;">مدين</th>
            <th style="padding:5px;border:1px solid #000;font-weight:700;">دائن</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((a, i) => `
            <tr style="background:${i % 2 === 0 ? '#fff' : '#f1f5f9'};">
              <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:right;color:#000;font-weight:500;">${a.account_name || ''}</td>
              <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:center;color:#000;font-family:monospace;font-weight:600;">${a.account_code}</td>
              <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:left;color:#000;font-family:monospace;">${fmtPdf(a.open_debit)}</td>
              <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:left;color:#000;font-family:monospace;">${fmtPdf(a.open_credit)}</td>
              <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:left;color:#000;font-family:monospace;">${fmtPdf(a.period_debit)}</td>
              <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:left;color:#000;font-family:monospace;">${fmtPdf(a.period_credit)}</td>
              <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:left;color:#000;font-family:monospace;">${fmtPdf(a.close_debit)}</td>
              <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:left;color:#000;font-family:monospace;">${fmtPdf(a.close_credit)}</td>
            </tr>
          `).join('')}
          <tr style="background:#1e293b;color:#fff;font-weight:700;">
            <td style="padding:6px 8px;border:1px solid #000;text-align:right;font-size:13px;" colspan="2">الإجمالي</td>
            <td style="padding:6px 8px;border:1px solid #000;text-align:left;font-family:monospace;">${fmtPdf(totals.od)}</td>
            <td style="padding:6px 8px;border:1px solid #000;text-align:left;font-family:monospace;">${fmtPdf(totals.oc)}</td>
            <td style="padding:6px 8px;border:1px solid #000;text-align:left;font-family:monospace;">${fmtPdf(totals.pd)}</td>
            <td style="padding:6px 8px;border:1px solid #000;text-align:left;font-family:monospace;">${fmtPdf(totals.pc)}</td>
            <td style="padding:6px 8px;border:1px solid #000;text-align:left;font-family:monospace;">${fmtPdf(totals.cd)}</td>
            <td style="padding:6px 8px;border:1px solid #000;text-align:left;font-family:monospace;">${fmtPdf(totals.cc)}</td>
          </tr>
        </tbody>
      </table>
      <div style="text-align:center;margin-top:14px;font-size:10px;color:#64748b;font-weight:600;">
        Mizaniat BI | تم الإنشاء: ${new Date().toLocaleString('ar-SA')}
      </div>
    `;
    
    document.body.appendChild(tempDiv);
    
    // Capture as canvas with high resolution
    const canvas = await html2canvas(tempDiv, {
      scale: 3,
      useCORS: true,
      backgroundColor: '#ffffff',
    });
    
    document.body.removeChild(tempDiv);
    
    // Create PDF from canvas
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginTop = 15;
    const marginBottom = 12;
    const marginX = 10;
    const usableWidth = pageWidth - marginX * 2;
    const usableHeight = pageHeight - marginTop - marginBottom;
    
    const imgWidth = usableWidth;
    const imgHeight = (canvas.height / canvas.width) * imgWidth;
    
    const imgData = canvas.toDataURL('image/png');
    
    if (imgHeight <= usableHeight) {
      // Fits on one page
      doc.addImage(imgData, 'PNG', marginX, marginTop, imgWidth, imgHeight);
    } else {
      // Multiple pages — draw full image with Y offset on each page
      // Add small buffer to ensure last rows are not cut
      const totalPages = Math.ceil((imgHeight + 5) / usableHeight);
      
      for (let i = 0; i < totalPages; i++) {
        if (i > 0) doc.addPage();
        
        // Draw full image with Y offset
        const yOffset = marginTop - (i * usableHeight);
        doc.addImage(imgData, 'PNG', marginX, yOffset, imgWidth, imgHeight);
        
        // Mask top area (safe header zone) with white rectangle
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, pageWidth, marginTop, 'F');
        
        // Mask bottom area — smaller on last page to avoid hiding totals
        const isLastPage = (i === totalPages - 1);
        if (!isLastPage) {
          doc.rect(0, pageHeight - marginBottom, pageWidth, marginBottom, 'F');
        } else {
          // Only small mask on last page (just for page number)
          doc.rect(0, pageHeight - 5, pageWidth, 5, 'F');
        }
        
        // Page number in footer
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(
          `${i + 1} / ${totalPages}`,
          pageWidth / 2, pageHeight - 1.5,
          { align: 'center' }
        );
      }
    }
    
    doc.save(`trial_balance_${dateFrom}_${dateTo}.pdf`);
    showToast('✅ تم تصدير ملف PDF بنجاح', 'success');
  } catch (err) {
    console.error('PDF export error:', err);
    showToast('خطأ في تصدير PDF: ' + err.message, 'error');
  }
}

function fmtPdf(val) {
  if (!val || val === 0) return '-';
  return Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

