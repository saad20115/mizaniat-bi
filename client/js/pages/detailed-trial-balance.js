import { api } from '../api.js';
import { store } from '../store.js';
import { formatNumber } from '../utils/format.js';
import { showToast } from '../utils/ui.js';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

const CATEGORY_LABELS = {
  receivable: 'الذمم المدينة',
  payable: 'الذمم الدائنة',
  employee_custody: 'عهد الموظفين',
  employee_advance: 'سلف الموظفين',
};

let trialBalanceData = null;
let partnerDetailsCache = {};
let partnerAccountCodes = []; // dynamic per company

export async function renderDetailedTrialBalance(container) {
  const companies = store.get('companies') || [];
  const fiscalYear = store.get('fiscalYear') || '';
  const dateFrom = store.get('dateFrom') || '';
  const dateTo = store.get('dateTo') || '';
  const filterOptions = store.get('filterOptions') || {};

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">ميزان المراجعة التفصيلي</h1>
        <p class="page-subtitle">Trial Balance — مع تفصيل الشركاء</p>
      </div>
      <div style="display:flex;gap:var(--space-sm);">
        <button class="btn" id="btn-dtb-config" style="display:flex;align-items:center;gap:6px;font-size:0.8rem;">
          ⚙️ إعداد الحسابات
        </button>
        <button class="btn" id="btn-dtb-pdf" style="display:flex;align-items:center;gap:6px;font-size:0.8rem;background:rgba(239,68,68,0.1);color:var(--accent-red);border-color:rgba(239,68,68,0.2);" disabled>
          📄 PDF
        </button>
        <button class="btn" id="btn-dtb-excel" style="display:flex;align-items:center;gap:6px;font-size:0.8rem;background:rgba(16,185,129,0.1);color:var(--accent-emerald);border-color:rgba(16,185,129,0.2);" disabled>
          📊 Excel
        </button>
      </div>
    </div>
    
    <!-- Config panel (hidden by default) -->
    <div id="dtb-config-panel" class="glass-card" style="padding:var(--space-lg);margin-bottom:var(--space-lg);display:none;border:1px solid rgba(245,158,11,0.2);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md);">
        <h3 style="margin:0;color:var(--accent-amber);font-size:0.95rem;">⚙️ إعداد حسابات التفصيل لكل شركة</h3>
        <button class="btn" id="btn-close-config" style="font-size:0.75rem;">✕ إغلاق</button>
      </div>
      <p style="color:var(--text-muted);font-size:0.8rem;margin-bottom:var(--space-md);">حدد الحسابات الأربعة (ذمم مدينة، ذمم دائنة، عهد موظفين، سلف موظفين) لكل شركة. هذه الحسابات ستظهر بتفصيل الشركاء عند عرض الميزان.</p>
      <div id="dtb-config-content"><p style="color:var(--text-muted);text-align:center;">اختر شركة أولاً</p></div>
    </div>

    <div class="glass-card" style="padding:var(--space-lg);margin-bottom:var(--space-lg);">
      <div style="display:flex;flex-wrap:wrap;gap:var(--space-md);align-items:flex-end;">
        <div class="filter-group">
          <span class="filter-label">الشركة</span>
          <select class="filter-select" id="dtb-company" style="min-width:220px;">
            ${companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="filter-group">
          <span class="filter-label">السنة المالية</span>
          <select class="filter-select" id="dtb-fiscal-year">
            <option value="">-- اختر --</option>
            ${(filterOptions.fiscalYears || []).map(fy => `
              <option value="${fy}" ${fiscalYear === fy ? 'selected' : ''}>${fy}</option>
            `).join('')}
          </select>
        </div>
        <div class="filter-group">
          <span class="filter-label">من تاريخ</span>
          <input type="date" class="filter-select" id="dtb-date-from" value="${dateFrom}" />
        </div>
        <div class="filter-group">
          <span class="filter-label">إلى تاريخ</span>
          <input type="date" class="filter-select" id="dtb-date-to" value="${dateTo}" />
        </div>
        <div class="filter-group">
          <span class="filter-label">مركز التكلفة</span>
          <select class="filter-select" id="dtb-cost-center">
            <option value="">الكل</option>
            ${(filterOptions.costCenters || []).map(cc => `<option value="${cc}">${cc}</option>`).join('')}
          </select>
        </div>
        <div class="filter-group" style="align-self:flex-end;">
          <button class="btn btn-primary" id="btn-dtb-load">عرض الميزان</button>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:var(--space-md);align-items:center;margin-top:var(--space-md);padding-top:var(--space-md);border-top:1px solid rgba(255,255,255,0.06);">
        <label style="display:flex;align-items:center;gap:6px;font-size:0.8rem;color:var(--text-secondary);">
          <input type="checkbox" id="chk-dtb-zero" /> إخفاء الأرصدة الصفرية
        </label>
        <span id="dtb-account-badges" style="display:flex;gap:4px;flex-wrap:wrap;"></span>
        <span style="color:var(--text-muted);font-size:0.7rem;margin-right:auto;">💡 اضغط على الحسابات المُلونة لعرض تفاصيل الشركاء</span>
      </div>
    </div>

    <div id="dtb-content"><p style="text-align:center;color:var(--text-muted);padding:var(--space-xl);">اختر الشركة والفترة ثم اضغط "عرض الميزان"</p></div>
  `;

  // Events
  container.querySelector('#dtb-fiscal-year').addEventListener('change', (e) => {
    const fy = e.target.value;
    if (fy) {
      container.querySelector('#dtb-date-from').value = `${fy}-01-01`;
      container.querySelector('#dtb-date-to').value = `${fy}-12-31`;
    }
  });

  container.querySelector('#dtb-company').addEventListener('change', () => loadCompanyConfig(container));
  container.querySelector('#btn-dtb-load').addEventListener('click', () => loadData(container));
  container.querySelector('#chk-dtb-zero').addEventListener('change', () => {
    if (trialBalanceData) renderTable(container);
  });
  container.querySelector('#btn-dtb-pdf').addEventListener('click', () => exportPDF(container));
  container.querySelector('#btn-dtb-excel').addEventListener('click', () => exportExcel(container));
  
  // Config panel toggle
  container.querySelector('#btn-dtb-config').addEventListener('click', () => {
    const panel = container.querySelector('#dtb-config-panel');
    panel.style.display = panel.style.display === 'none' ? '' : 'none';
    if (panel.style.display !== 'none') loadConfigPanel(container);
  });
  container.querySelector('#btn-close-config').addEventListener('click', () => {
    container.querySelector('#dtb-config-panel').style.display = 'none';
  });

  if (fiscalYear) {
    container.querySelector('#dtb-date-from').value = `${fiscalYear}-01-01`;
    container.querySelector('#dtb-date-to').value = `${fiscalYear}-12-31`;
  }

  // Load config for initial company
  await loadCompanyConfig(container);
}

// ===== CONFIG =====

async function loadCompanyConfig(container) {
  const companyId = container.querySelector('#dtb-company').value;
  try {
    const result = await api.getPartnerAccountConfig({ companyId });
    partnerAccountCodes = (result.configs || []).map(c => c.account_code);
    
    // Show badges
    const badges = container.querySelector('#dtb-account-badges');
    if (partnerAccountCodes.length > 0) {
      badges.innerHTML = partnerAccountCodes.map(code => {
        const cfg = result.configs.find(c => c.account_code === code);
        return `<span style="font-size:0.7rem;background:rgba(59,130,246,0.15);color:var(--accent-blue);padding:2px 8px;border-radius:var(--radius-sm);">${code}${cfg?.account_name ? ' — ' + cfg.account_name : ''}</span>`;
      }).join('');
    } else {
      badges.innerHTML = '<span style="font-size:0.7rem;color:var(--accent-amber);">⚠️ لم يتم إعداد حسابات التفصيل — اضغط "إعداد الحسابات"</span>';
    }
  } catch (err) {
    console.error('Config load error:', err);
    partnerAccountCodes = [];
  }
}

async function loadConfigPanel(container) {
  const companyId = container.querySelector('#dtb-company').value;
  const configContent = container.querySelector('#dtb-config-content');
  configContent.innerHTML = '<div class="skeleton" style="height:200px;"></div>';

  try {
    const result = await api.getPartnerAccountConfig({ companyId });
    const { configs, categories, labels, availableAccounts } = result;
    
    // Build config map
    const configMap = {};
    for (const c of configs) configMap[c.account_category] = c;
    
    const companySelect = container.querySelector('#dtb-company');
    const companyName = companySelect.options[companySelect.selectedIndex]?.text || '';

    configContent.innerHTML = `
      <h4 style="color:var(--text-white);margin:0 0 var(--space-md);font-size:0.85rem;">📌 ${companyName}</h4>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:var(--space-md);">
        ${categories.map(cat => {
          const saved = configMap[cat];
          return `
            <div style="background:rgba(255,255,255,0.03);border-radius:var(--radius-md);padding:var(--space-md);border:1px solid rgba(255,255,255,0.06);">
              <label style="font-size:0.8rem;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:6px;">${labels[cat]}</label>
              <select class="filter-select config-select" data-category="${cat}" style="width:100%;font-size:0.8rem;">
                <option value="">-- اختر الحساب --</option>
                ${availableAccounts.map(a => `
                  <option value="${a.account_code}" data-name="${a.account_name}" ${saved?.account_code === a.account_code ? 'selected' : ''}>${a.account_code} — ${a.account_name}</option>
                `).join('')}
              </select>
            </div>
          `;
        }).join('')}
      </div>
      <div style="margin-top:var(--space-md);display:flex;gap:var(--space-sm);">
        <button class="btn btn-primary" id="btn-save-config" style="font-size:0.8rem;">💾 حفظ الإعدادات</button>
      </div>
    `;

    container.querySelector('#btn-save-config').addEventListener('click', async () => {
      const selects = container.querySelectorAll('.config-select');
      const mappings = [];
      selects.forEach(sel => {
        const opt = sel.options[sel.selectedIndex];
        mappings.push({
          category: sel.dataset.category,
          account_code: sel.value,
          account_name: opt?.dataset?.name || '',
        });
      });
      
      try {
        await api.savePartnerAccountConfig({ companyId, mappings });
        showToast('✅ تم حفظ إعدادات الحسابات', 'success');
        await loadCompanyConfig(container);
      } catch (err) {
        showToast('خطأ في الحفظ', 'error');
      }
    });
  } catch (err) {
    configContent.innerHTML = '<p style="color:var(--accent-red);">خطأ في تحميل الإعدادات</p>';
  }
}

// ===== DATA =====

async function loadData(container) {
  const companyId = container.querySelector('#dtb-company').value;
  const dateFrom = container.querySelector('#dtb-date-from').value;
  const dateTo = container.querySelector('#dtb-date-to').value;
  const costCenter = container.querySelector('#dtb-cost-center').value;

  if (!dateFrom || !dateTo) { showToast('يجب اختيار الفترة', 'error'); return; }

  const el = container.querySelector('#dtb-content');
  el.innerHTML = '<div class="skeleton" style="height:400px;border-radius:var(--radius-lg);"></div>';

  try {
    const requests = [api.getTrialBalance({ companyId, dateFrom, dateTo, costCenter })];
    
    // Only fetch partner details if accounts are configured
    if (partnerAccountCodes.length > 0) {
      requests.push(api.getDetailedTrialBalance({ companyId, dateFrom, dateTo, accountCodes: partnerAccountCodes.join(',') }));
    }
    
    const [tbData, detailData] = await Promise.all(requests);
    trialBalanceData = tbData;
    
    partnerDetailsCache = {};
    if (detailData?.accounts) {
      for (const item of detailData.accounts) {
        if (!partnerDetailsCache[item.account_code]) partnerDetailsCache[item.account_code] = [];
        partnerDetailsCache[item.account_code].push(item);
      }
    }
    
    renderTable(container);
    container.querySelector('#btn-dtb-pdf').disabled = false;
    container.querySelector('#btn-dtb-excel').disabled = false;
  } catch (err) {
    console.error('Load error:', err);
    showToast('خطأ في تحميل الميزان', 'error');
    el.innerHTML = '<p style="text-align:center;color:var(--accent-red);padding:var(--space-xl);">خطأ في التحميل</p>';
  }
}

function renderTable(container) {
  const el = container.querySelector('#dtb-content');
  if (!trialBalanceData) return;

  const hideZero = container.querySelector('#chk-dtb-zero')?.checked || false;
  const companySelect = container.querySelector('#dtb-company');
  const companyName = companySelect.options[companySelect.selectedIndex]?.text || '';

  let items = trialBalanceData.accounts || [];
  if (hideZero) {
    items = items.filter(a => a.open_debit || a.open_credit || a.period_debit || a.period_credit || a.close_debit || a.close_credit);
  }

  const totals = { od: 0, oc: 0, pd: 0, pc: 0, cd: 0, cc: 0 };
  let rowsHtml = '';

  for (let i = 0; i < items.length; i++) {
    const a = items[i];
    totals.od += a.open_debit || 0; totals.oc += a.open_credit || 0;
    totals.pd += a.period_debit || 0; totals.pc += a.period_credit || 0;
    totals.cd += a.close_debit || 0; totals.cc += a.close_credit || 0;
    
    const isExpandable = partnerAccountCodes.includes(a.account_code);
    const partners = partnerDetailsCache[a.account_code] || [];
    const hasPartners = isExpandable && partners.length > 0;
    
    rowsHtml += `
      <tr class="${hasPartners ? 'expandable-row' : ''}" data-code="${a.account_code}"
          style="${hasPartners ? 'cursor:pointer;' : ''}${i % 2 === 0 ? '' : 'background:rgba(255,255,255,0.015);'}">
        <td style="font-family:var(--font-en);font-weight:500;${hasPartners ? 'color:var(--accent-blue);' : ''}">${a.account_code}</td>
        <td style="${hasPartners ? 'color:var(--accent-blue);font-weight:600;' : ''}">
          ${hasPartners ? '<span class="expand-icon" style="display:inline-block;transition:transform 0.2s;margin-left:4px;font-size:0.7rem;">▶</span>' : ''}
          ${a.account_name}
          ${hasPartners ? `<span style="font-size:0.65rem;color:var(--text-muted);margin-right:6px;">(${partners.length} شريك)</span>` : ''}
        </td>
        <td class="number">${formatNumber(a.open_debit, 2)}</td>
        <td class="number">${formatNumber(a.open_credit, 2)}</td>
        <td class="number">${formatNumber(a.period_debit, 2)}</td>
        <td class="number">${formatNumber(a.period_credit, 2)}</td>
        <td class="number">${formatNumber(a.close_debit, 2)}</td>
        <td class="number">${formatNumber(a.close_credit, 2)}</td>
      </tr>
    `;
    
    if (hasPartners) {
      for (const p of partners) {
        const net = (p.close_debit || 0) - (p.close_credit || 0);
        rowsHtml += `
          <tr class="partner-detail-row" data-parent="${a.account_code}" style="display:none;background:rgba(59,130,246,0.03);">
            <td style="color:var(--text-muted);font-size:0.75rem;"></td>
            <td style="padding-right:36px;color:var(--text-secondary);font-size:0.8rem;">↳ ${p.partner_name}</td>
            <td class="number" style="font-size:0.8rem;">${formatNumber(p.open_debit, 2)}</td>
            <td class="number" style="font-size:0.8rem;">${formatNumber(p.open_credit, 2)}</td>
            <td class="number" style="font-size:0.8rem;">${formatNumber(p.period_debit, 2)}</td>
            <td class="number" style="font-size:0.8rem;">${formatNumber(p.period_credit, 2)}</td>
            <td class="number" style="font-size:0.8rem;color:${net >= 0 ? 'var(--accent-emerald)' : 'var(--accent-red)'};">${formatNumber(p.close_debit, 2)}</td>
            <td class="number" style="font-size:0.8rem;color:${net >= 0 ? 'var(--accent-emerald)' : 'var(--accent-red)'};">${formatNumber(p.close_credit, 2)}</td>
          </tr>
        `;
      }
    }
  }

  el.innerHTML = `
    <div class="glass-card" style="padding:var(--space-md);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md);">
        <h3 style="color:var(--text-white);margin:0;font-size:0.95rem;">${companyName}</h3>
        <span style="color:var(--text-muted);font-size:0.75rem;">${items.length} حساب</span>
      </div>
      <div class="table-container">
        <table class="data-table" style="font-size:0.82rem;">
          <thead>
            <tr>
              <th style="min-width:80px;">كود</th>
              <th style="text-align:right;min-width:200px;">اسم الحساب</th>
              <th class="number" colspan="2" style="text-align:center;background:rgba(59,130,246,0.06);">الرصيد الافتتاحي</th>
              <th class="number" colspan="2" style="text-align:center;background:rgba(245,158,11,0.06);">حركة الفترة</th>
              <th class="number" colspan="2" style="text-align:center;background:rgba(16,185,129,0.06);">الرصيد الختامي</th>
            </tr>
            <tr style="font-size:0.75rem;color:var(--text-muted);">
              <th></th><th></th>
              <th class="number">مدين</th><th class="number">دائن</th>
              <th class="number">مدين</th><th class="number">دائن</th>
              <th class="number">مدين</th><th class="number">دائن</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot>
            <tr style="font-weight:700;background:rgba(255,255,255,0.04);">
              <td colspan="2" style="text-align:right;">الإجمالي</td>
              <td class="number">${formatNumber(totals.od, 2)}</td>
              <td class="number">${formatNumber(totals.oc, 2)}</td>
              <td class="number">${formatNumber(totals.pd, 2)}</td>
              <td class="number">${formatNumber(totals.pc, 2)}</td>
              <td class="number">${formatNumber(totals.cd, 2)}</td>
              <td class="number">${formatNumber(totals.cc, 2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;

  el.querySelectorAll('.expandable-row').forEach(row => {
    row.addEventListener('click', () => {
      const code = row.dataset.code;
      const icon = row.querySelector('.expand-icon');
      const detailRows = el.querySelectorAll(`.partner-detail-row[data-parent="${code}"]`);
      const isExpanded = detailRows[0]?.style.display !== 'none';
      detailRows.forEach(r => r.style.display = isExpanded ? 'none' : '');
      if (icon) icon.style.transform = isExpanded ? '' : 'rotate(90deg)';
    });
  });
}

// ========== EXPORTS ==========

function getExportData(container) {
  if (!trialBalanceData) return null;
  const hideZero = container.querySelector('#chk-dtb-zero')?.checked || false;
  let items = trialBalanceData.accounts || [];
  if (hideZero) items = items.filter(a => a.open_debit || a.open_credit || a.period_debit || a.period_credit || a.close_debit || a.close_credit);
  const cs = container.querySelector('#dtb-company');
  const companyName = cs.options[cs.selectedIndex]?.text || '';
  return { items, companyName, dateFrom: container.querySelector('#dtb-date-from').value, dateTo: container.querySelector('#dtb-date-to').value };
}

function exportExcel(container) {
  const data = getExportData(container);
  if (!data) return showToast('لا توجد بيانات', 'error');
  try {
    const { items, companyName, dateFrom, dateTo } = data;
    const ws = [];
    ws.push([`ميزان المراجعة التفصيلي — ${companyName}`]);
    ws.push([`الفترة: ${dateFrom} → ${dateTo}`]);
    ws.push([]);
    ws.push(['كود', 'الحساب', 'الشريك', 'افتتاحي مدين', 'افتتاحي دائن', 'حركة مدين', 'حركة دائن', 'ختامي مدين', 'ختامي دائن']);
    for (const a of items) {
      ws.push([a.account_code, a.account_name, '', a.open_debit||0, a.open_credit||0, a.period_debit||0, a.period_credit||0, a.close_debit||0, a.close_credit||0]);
      const partners = partnerDetailsCache[a.account_code];
      if (partners) for (const p of partners) {
        ws.push(['', '', p.partner_name, p.open_debit||0, p.open_credit||0, p.period_debit||0, p.period_credit||0, p.close_debit||0, p.close_credit||0]);
      }
    }
    // Totals row
    const t = { od:0, oc:0, pd:0, pc:0, cd:0, cc:0 };
    for (const a of items) {
      t.od += a.open_debit||0; t.oc += a.open_credit||0;
      t.pd += a.period_debit||0; t.pc += a.period_credit||0;
      t.cd += a.close_debit||0; t.cc += a.close_credit||0;
    }
    ws.push(['', 'الإجمالي', '', t.od, t.oc, t.pd, t.pc, t.cd, t.cc]);
    const wb = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet(ws);
    sheet['!cols'] = [{wch:12},{wch:35},{wch:35},{wch:16},{wch:16},{wch:16},{wch:16},{wch:16},{wch:16}];
    sheet['!merges'] = [{s:{r:0,c:0},e:{r:0,c:8}},{s:{r:1,c:0},e:{r:1,c:8}}];
    const fmt = '#,##0.00';
    for (let r = 4; r < ws.length; r++) for (let c = 3; c <= 8; c++) {
      const ref = XLSX.utils.encode_cell({r,c});
      if (sheet[ref] && typeof sheet[ref].v === 'number') { sheet[ref].t = 'n'; sheet[ref].z = fmt; }
    }
    XLSX.utils.book_append_sheet(wb, sheet, 'ميزان تفصيلي');
    XLSX.writeFile(wb, `detailed_trial_balance_${dateFrom}_${dateTo}.xlsx`);
    showToast('✅ تم تصدير Excel', 'success');
  } catch (err) { console.error(err); showToast('خطأ في التصدير', 'error'); }
}

async function exportPDF(container) {
  const data = getExportData(container);
  if (!data) return showToast('لا توجد بيانات', 'error');
  try {
    showToast('⏳ جاري إنشاء PDF...', 'info');
    const { items, companyName, dateFrom, dateTo } = data;
    const fv = v => !v || v === 0 ? '-' : Number(v).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
    let rows = '';
    let idx = 0;
    for (const a of items) {
      const isExp = partnerAccountCodes.includes(a.account_code);
      const bg = idx % 2 === 0 ? '#fff' : '#f1f5f9';
      rows += `<tr style="background:${isExp ? '#eef2ff' : bg};">
        <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:center;font-family:monospace;font-weight:${isExp?'700':'500'};color:${isExp?'#2563eb':'#000'};">${a.account_code}</td>
        <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:right;font-weight:${isExp?'700':'500'};color:${isExp?'#2563eb':'#000'};">${a.account_name}</td>
        <td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:left;font-family:monospace;color:#000;">${fv(a.open_debit)}</td>
        <td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:left;font-family:monospace;color:#000;">${fv(a.open_credit)}</td>
        <td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:left;font-family:monospace;color:#000;">${fv(a.period_debit)}</td>
        <td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:left;font-family:monospace;color:#000;">${fv(a.period_credit)}</td>
        <td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:left;font-family:monospace;color:#000;">${fv(a.close_debit)}</td>
        <td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:left;font-family:monospace;color:#000;">${fv(a.close_credit)}</td>
      </tr>`;
      idx++;
      const partners = partnerDetailsCache[a.account_code];
      if (partners) for (const p of partners) {
        rows += `<tr style="background:#f8fafc;">
          <td style="padding:3px;border:1px solid #e2e8f0;"></td>
          <td style="padding:3px 8px;border:1px solid #e2e8f0;text-align:right;font-size:10px;color:#475569;padding-right:20px;">↳ ${p.partner_name}</td>
          <td style="padding:3px 6px;border:1px solid #e2e8f0;text-align:left;font-family:monospace;font-size:10px;color:#475569;">${fv(p.open_debit)}</td>
          <td style="padding:3px 6px;border:1px solid #e2e8f0;text-align:left;font-family:monospace;font-size:10px;color:#475569;">${fv(p.open_credit)}</td>
          <td style="padding:3px 6px;border:1px solid #e2e8f0;text-align:left;font-family:monospace;font-size:10px;color:#475569;">${fv(p.period_debit)}</td>
          <td style="padding:3px 6px;border:1px solid #e2e8f0;text-align:left;font-family:monospace;font-size:10px;color:#475569;">${fv(p.period_credit)}</td>
          <td style="padding:3px 6px;border:1px solid #e2e8f0;text-align:left;font-family:monospace;font-size:10px;color:#475569;">${fv(p.close_debit)}</td>
          <td style="padding:3px 6px;border:1px solid #e2e8f0;text-align:left;font-family:monospace;font-size:10px;color:#475569;">${fv(p.close_credit)}</td>
        </tr>`;
      }
    }
    let totalsPdf = { od:0,oc:0,pd:0,pc:0,cd:0,cc:0 };
    for (const a of items) {
      totalsPdf.od += a.open_debit||0; totalsPdf.oc += a.open_credit||0;
      totalsPdf.pd += a.period_debit||0; totalsPdf.pc += a.period_credit||0;
      totalsPdf.cd += a.close_debit||0; totalsPdf.cc += a.close_credit||0;
    }
    
    // Add totals row to PDF rows
    rows += `<tr style="background:#1e293b;color:#fff;font-weight:700;">
      <td style="padding:6px 8px;border:1px solid #000;" colspan="2" align="right">الإجمالي</td>
      <td style="padding:6px;border:1px solid #000;text-align:left;font-family:monospace;">${fv(totalsPdf.od)}</td>
      <td style="padding:6px;border:1px solid #000;text-align:left;font-family:monospace;">${fv(totalsPdf.oc)}</td>
      <td style="padding:6px;border:1px solid #000;text-align:left;font-family:monospace;">${fv(totalsPdf.pd)}</td>
      <td style="padding:6px;border:1px solid #000;text-align:left;font-family:monospace;">${fv(totalsPdf.pc)}</td>
      <td style="padding:6px;border:1px solid #000;text-align:left;font-family:monospace;">${fv(totalsPdf.cd)}</td>
      <td style="padding:6px;border:1px solid #000;text-align:left;font-family:monospace;">${fv(totalsPdf.cc)}</td>
    </tr>`;

    const tempDiv = document.createElement('div');
    tempDiv.style.cssText = 'position:fixed;top:-99999px;left:0;width:1400px;background:#fff;padding:30px;font-family:Arial,Tahoma,sans-serif;direction:rtl;color:#000;';
    tempDiv.innerHTML = `
      <div style="text-align:center;margin-bottom:20px;">
        <h2 style="margin:0 0 6px;font-size:22px;color:#000;font-weight:900;">ميزان المراجعة التفصيلي</h2>
        <h3 style="margin:0 0 6px;font-size:16px;color:#1e293b;font-weight:700;">${companyName}</h3>
        <p style="margin:0;font-size:13px;color:#334155;font-weight:600;">الفترة: ${dateFrom} → ${dateTo}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:11px;direction:rtl;">
        <thead>
          <tr style="background:#1e293b;color:#fff;">
            <th style="padding:7px;border:1px solid #000;">كود</th>
            <th style="padding:7px;border:1px solid #000;text-align:right;">الحساب</th>
            <th style="padding:7px;border:1px solid #000;" colspan="2">الرصيد الافتتاحي</th>
            <th style="padding:7px;border:1px solid #000;" colspan="2">حركة الفترة</th>
            <th style="padding:7px;border:1px solid #000;" colspan="2">الرصيد الختامي</th>
          </tr>
          <tr style="background:#334155;color:#fff;font-size:10px;">
            <th style="padding:4px;border:1px solid #000;"></th><th style="padding:4px;border:1px solid #000;"></th>
            <th style="padding:4px;border:1px solid #000;">مدين</th><th style="padding:4px;border:1px solid #000;">دائن</th>
            <th style="padding:4px;border:1px solid #000;">مدين</th><th style="padding:4px;border:1px solid #000;">دائن</th>
            <th style="padding:4px;border:1px solid #000;">مدين</th><th style="padding:4px;border:1px solid #000;">دائن</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="text-align:center;margin-top:14px;font-size:10px;color:#64748b;">Mizaniat BI | ${new Date().toLocaleString('ar-SA')}</div>
    `;
    document.body.appendChild(tempDiv);
    const canvas = await html2canvas(tempDiv, { scale: 3, useCORS: true, backgroundColor: '#fff' });
    document.body.removeChild(tempDiv);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
    const mt = 15, mb = 12, mx = 10, uw = pw - mx*2, uh = ph - mt - mb;
    const iw = uw, ih = (canvas.height / canvas.width) * iw;
    const imgData = canvas.toDataURL('image/png');
    if (ih <= uh) { doc.addImage(imgData, 'PNG', mx, mt, iw, ih); }
    else {
      const pages = Math.ceil((ih + 5) / uh);
      for (let i = 0; i < pages; i++) {
        if (i > 0) doc.addPage();
        doc.addImage(imgData, 'PNG', mx, mt - (i * uh), iw, ih);
        doc.setFillColor(255,255,255);
        doc.rect(0, 0, pw, mt, 'F');
        const isLast = (i === pages - 1);
        if (!isLast) { doc.rect(0, ph - mb, pw, mb, 'F'); }
        else { doc.rect(0, ph - 5, pw, 5, 'F'); }
        doc.setFontSize(8); doc.setTextColor(150);
        doc.text(`${i+1} / ${pages}`, pw/2, ph - (isLast ? 1.5 : 4), {align:'center'});
      }
    }
    doc.save(`detailed_trial_balance_${dateFrom}_${dateTo}.pdf`);
    showToast('✅ تم تصدير PDF', 'success');
  } catch (err) { console.error(err); showToast('خطأ: ' + err.message, 'error'); }
}
