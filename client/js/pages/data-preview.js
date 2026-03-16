import { api } from '../api.js';
import { store } from '../store.js';
import { showToast } from '../utils/ui.js';
import { formatNumber, formatCurrency } from '../utils/format.js';

let currentPage = 0;
const PAGE_SIZE = 50;
let currentFilters = {};

export async function renderDataPreview(container) {
  const companies = store.get('companies');
  
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">📋 معاينة بيانات الـ API</h1>
        <p class="page-subtitle">عرض البيانات المستوردة من أودو — جميع الأعمدة كما هي من المصدر</p>
      </div>
      <div id="total-badge" style="background:rgba(59,130,246,0.15);color:var(--accent-blue);padding:8px 16px;border-radius:8px;font-weight:600;font-size:0.9rem;"></div>
    </div>

    <!-- Filters -->
    <div class="card" style="margin-bottom:var(--space-lg);padding:var(--space-md);">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:var(--space-md);align-items:end;">
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="font-size:0.75rem;">🔍 بحث</label>
          <input type="text" class="form-input" id="dp-search" placeholder="اسم حساب، كود، شريك..." style="font-size:0.82rem;" />
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="font-size:0.75rem;">🏢 الشركة</label>
          <select class="filter-select" id="dp-company" style="width:100%;">
            <option value="">— الكل —</option>
            ${companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="font-size:0.75rem;">📂 نوع الحساب</label>
          <select class="filter-select" id="dp-acctype" style="width:100%;">
            <option value="">— الكل —</option>
          </select>
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="font-size:0.75rem;">📅 التاريخ من</label>
          <input type="date" class="form-input" id="dp-datefrom" dir="ltr" style="font-family:var(--font-en);font-size:0.82rem;" />
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:var(--space-md);margin-top:var(--space-md);align-items:end;">
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="font-size:0.75rem;">📅 التاريخ إلى</label>
          <input type="date" class="form-input" id="dp-dateto" dir="ltr" style="font-family:var(--font-en);font-size:0.82rem;" />
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="font-size:0.75rem;">📊 حساب تحليلي</label>
          <select class="filter-select" id="dp-analytic" style="width:100%;">
            <option value="">— الكل —</option>
          </select>
        </div>
        <div></div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-primary btn-sm" id="dp-apply" style="flex:1;">تطبيق</button>
          <button class="btn btn-secondary btn-sm" id="dp-reset">مسح</button>
        </div>
      </div>
    </div>

    <!-- Data Table -->
    <div class="card" style="padding:0;overflow:hidden;">
      <div id="dp-table-wrapper" style="overflow-x:auto;max-height:65vh;overflow-y:auto;">
        <div style="text-align:center;padding:40px;color:var(--text-muted);">جاري التحميل...</div>
      </div>
    </div>

    <!-- Pagination -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:var(--space-md);padding:0 var(--space-sm);">
      <div style="display:flex;gap:8px;">
        <button class="btn btn-secondary btn-sm" id="dp-prev" disabled>→ السابق</button>
        <button class="btn btn-secondary btn-sm" id="dp-next">التالي ←</button>
      </div>
      <div id="dp-page-info" style="color:var(--text-muted);font-size:0.8rem;font-family:var(--font-en);"></div>
    </div>
  `;

  // Event handlers
  container.querySelector('#dp-apply').addEventListener('click', () => { currentPage = 0; loadData(container); });
  container.querySelector('#dp-reset').addEventListener('click', () => {
    container.querySelector('#dp-search').value = '';
    container.querySelector('#dp-company').value = '';
    container.querySelector('#dp-acctype').value = '';
    container.querySelector('#dp-analytic').value = '';
    container.querySelector('#dp-datefrom').value = '';
    container.querySelector('#dp-dateto').value = '';
    currentPage = 0;
    currentFilters = {};
    loadData(container);
  });
  container.querySelector('#dp-prev').addEventListener('click', () => { if (currentPage > 0) { currentPage--; loadData(container); } });
  container.querySelector('#dp-next').addEventListener('click', () => { currentPage++; loadData(container); });
  
  // Enter key on search
  container.querySelector('#dp-search').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { currentPage = 0; loadData(container); }
  });

  currentPage = 0;
  await loadData(container);
}

async function loadData(container) {
  const search = container.querySelector('#dp-search').value.trim();
  const companyId = container.querySelector('#dp-company').value;
  const accountType = container.querySelector('#dp-acctype').value;
  const analyticAccount = container.querySelector('#dp-analytic').value;
  const dateFrom = container.querySelector('#dp-datefrom').value;
  const dateTo = container.querySelector('#dp-dateto').value;

  const params = {
    limit: PAGE_SIZE,
    offset: currentPage * PAGE_SIZE,
  };
  if (search) params.search = search;
  if (companyId) params.companyIds = companyId;
  if (accountType) params.accountType = accountType;
  if (analyticAccount) params.analyticAccount = analyticAccount;
  if (dateFrom) params.dateFrom = dateFrom;
  if (dateTo) params.dateTo = dateTo;

  try {
    const data = await api.getJournalItems(params);
    
    // Populate account type filter once
    if (data.accountTypes && data.accountTypes.length > 0) {
      const sel = container.querySelector('#dp-acctype');
      const currentVal = sel.value;
      if (sel.options.length <= 1) {
        data.accountTypes.forEach(t => {
          const opt = document.createElement('option');
          opt.value = t;
          opt.textContent = t;
          sel.appendChild(opt);
        });
        if (currentVal) sel.value = currentVal;
      }
    }

    // Populate analytic account filter once
    if (data.analyticAccounts && data.analyticAccounts.length > 0) {
      const sel = container.querySelector('#dp-analytic');
      const currentVal = sel.value;
      if (sel.options.length <= 1) {
        data.analyticAccounts.forEach(a => {
          const opt = document.createElement('option');
          opt.value = a;
          opt.textContent = a;
          sel.appendChild(opt);
        });
        if (currentVal) sel.value = currentVal;
      }
    }

    // Total badge
    container.querySelector('#total-badge').textContent = `إجمالي: ${formatNumber(data.total)} سجل`;

    // Pagination
    const totalPages = Math.ceil(data.total / PAGE_SIZE);
    container.querySelector('#dp-prev').disabled = currentPage === 0;
    container.querySelector('#dp-next').disabled = (currentPage + 1) >= totalPages;
    container.querySelector('#dp-page-info').textContent = `صفحة ${currentPage + 1} من ${totalPages || 1}`;

    renderTable(container.querySelector('#dp-table-wrapper'), data.items);
  } catch (err) {
    container.querySelector('#dp-table-wrapper').innerHTML = `<div style="padding:20px;color:var(--accent-red);">خطأ: ${err.message}</div>`;
  }
}

function renderTable(wrapper, items) {
  if (!items || items.length === 0) {
    wrapper.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">لا توجد بيانات</div>';
    return;
  }

  // Define columns with Arabic labels
  const columns = [
    { key: 'company_name', label: 'الشركة', type: 'text' },
    { key: 'date', label: 'التاريخ', type: 'date' },
    { key: 'account_code', label: 'كود الحساب', type: 'code' },
    { key: 'account_name', label: 'اسم الحساب', type: 'text' },
    { key: 'account_type', label: 'نوع الحساب', type: 'badge' },
    { key: 'debit', label: 'مدين', type: 'money' },
    { key: 'credit', label: 'دائن', type: 'money' },
    { key: 'balance', label: 'الرصيد', type: 'money' },
    { key: 'partner_name', label: 'الشريك', type: 'text' },
    { key: 'analytic_account', label: 'حساب تحليلي', type: 'text' },
    { key: 'label', label: 'البيان', type: 'text' },
    { key: 'journal_name', label: 'اليومية', type: 'text' },
    { key: 'move_name', label: 'رقم القيد', type: 'code' },
    { key: 'move_ref', label: 'المرجع', type: 'text' },
    { key: 'currency', label: 'العملة', type: 'code' },
    { key: 'fiscal_year', label: 'السنة', type: 'code' },
    { key: 'period', label: 'الفترة', type: 'code' },
  ];

  wrapper.innerHTML = `
    <table class="data-table" style="font-size:0.78rem;min-width:1800px;">
      <thead>
        <tr>
          <th style="position:sticky;top:0;z-index:2;font-size:0.7rem;white-space:nowrap;">#</th>
          ${columns.map(c => `
            <th style="position:sticky;top:0;z-index:2;font-size:0.7rem;white-space:nowrap;">${c.label}</th>
          `).join('')}
        </tr>
      </thead>
      <tbody>
        ${items.map((item, idx) => `
          <tr>
            <td style="font-family:var(--font-en);color:var(--text-muted);font-size:0.7rem;">${currentPage * PAGE_SIZE + idx + 1}</td>
            ${columns.map(c => renderCell(item, c)).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function renderCell(item, col) {
  const val = item[col.key];
  
  switch (col.type) {
    case 'money':
      if (!val || val === 0) return '<td style="font-family:var(--font-en);color:var(--text-muted);">0</td>';
      const isNeg = val < 0;
      return `<td style="font-family:var(--font-en);font-weight:500;color:${isNeg ? 'var(--accent-red)' : 'var(--text-primary)'};">${formatNumber(val, 2)}</td>`;
    
    case 'date':
      return `<td style="font-family:var(--font-en);font-size:0.75rem;white-space:nowrap;">${val || ''}</td>`;
    
    case 'code':
      return `<td style="font-family:var(--font-en);font-size:0.75rem;color:var(--accent-blue);">${val || ''}</td>`;
    
    case 'badge':
      if (!val) return '<td></td>';
      return `<td><span style="background:rgba(99,102,241,0.15);color:var(--accent-indigo);padding:2px 6px;border-radius:4px;font-size:0.68rem;white-space:nowrap;">${val}</span></td>`;
    
    default:
      return `<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${(val || '').toString().replace(/"/g, '&quot;')}">${val || ''}</td>`;
  }
}
