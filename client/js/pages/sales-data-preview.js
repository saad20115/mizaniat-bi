import { api } from '../api.js';
import { store } from '../store.js';
import { showToast } from '../utils/ui.js';
import { formatNumber } from '../utils/format.js';

let currentPage = 0;
const PAGE_SIZE = 50;
let currentFilters = {};
let currentItems = [];
let currentSortCol = 'date';
let currentSortDir = 'DESC';

const ALL_COLUMNS = [
  { key: 'company_name', label: 'الشركة', type: 'text', default: true },
  { key: 'date', label: 'التاريخ', type: 'date', default: true },
  { key: 'name', label: 'رقم الفاتورة', type: 'code', default: true },
  { key: 'partner_name', label: 'العميل', type: 'text', default: true },
  { key: 'state', label: 'الحالة', type: 'badge', default: true },
  { key: 'amount_total', label: 'المبلغ الإجمالي', type: 'money', default: true },
  
  { key: 'journal_name', label: 'اسم اليومية', type: 'text', default: false, isRaw: true },
  { key: 'payment_status', label: 'حالة الدفع', type: 'badge', default: false, isRaw: true },
  { key: 'move_type', label: 'نوع الحركة', type: 'text', default: false, isRaw: true },
  { key: 'amount_untaxed', label: 'المبلغ (قبل الضريبة)', type: 'money', default: false, isRaw: true },
  { key: 'amount_tax_signed', label: 'الضريبة', type: 'money', default: false, isRaw: true },
  { key: 'total_paid', label: 'إجمالي المدفوع', type: 'money', default: false, isRaw: true },
  { key: 'amount_residual', label: 'المبلغ المتبقي', type: 'residual', default: false },
  { key: 'reference', label: 'المرجع', type: 'text', default: false, isRaw: true },
  
  { key: 'created_at', label: 'تاريخ المزامنة', type: 'date', default: true },
  { key: 'raw_data', label: 'البيانات الخام', type: 'actions', default: true }
];

let savedColumns = [];
try {
  const stored = localStorage.getItem('sales_preview_cols');
  if (stored) savedColumns = JSON.parse(stored);
} catch(e) {}
if (!savedColumns || savedColumns.length === 0) {
  savedColumns = ALL_COLUMNS.filter(c => c.default).map(c => c.key);
}

export async function renderSalesDataPreview(container) {
  // Try to get cached companies, fallback to empty array
  let companies = store.get('sales_companies');
  if (!companies || companies.length === 0) {
    try {
      companies = await api.sales.getCompanies();
      store.set('sales_companies', companies);
    } catch(e) {
      companies = [];
    }
  }
  
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">🛍️ معاينة المبيعات</h1>
        <p class="page-subtitle">عرض تفصيلي لـ الفواتير المستوردة من أودو المبيعات</p>
      </div>
      <div id="total-badge" style="background:rgba(59,130,246,0.15);color:var(--accent-blue);padding:8px 16px;border-radius:8px;font-weight:600;font-size:0.9rem;display:none;"></div>
    </div>

    <!-- Summary Cards -->
    <div id="dp-summary-cards" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:var(--space-md);margin-bottom:var(--space-md);">
      <div style="text-align:center;padding:20px;color:var(--text-muted);">جاري تحميل ملخص البيانات...</div>
    </div>

    <!-- Filters -->
    <div class="card" style="margin-bottom:var(--space-lg);padding:var(--space-md);">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:var(--space-md);align-items:end;">
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="font-size:0.75rem;">🔍 بحث</label>
          <input type="text" class="form-input" id="dp-search" placeholder="رقم الفاتورة، اسم العميل..." style="font-size:0.82rem;" />
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="font-size:0.75rem;">🏢 الشركة</label>
          <select class="filter-select" id="dp-company" style="width:100%;">
            <option value="">— الكل —</option>
            ${companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="font-size:0.75rem;">📋 حالة الفاتورة</label>
          <select class="filter-select" id="dp-state" style="width:100%;">
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
        <div></div>
        <div></div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-primary btn-sm" id="dp-apply" style="flex:1;">تطبيق</button>
          <button class="btn btn-secondary btn-sm" id="dp-reset">مسح</button>
        </div>
      </div>
    </div>

    <!-- Column Chooser -->
    <div style="display:flex;justify-content:flex-end;margin-bottom:10px;padding:0 var(--space-sm);">
      <div style="position:relative;" id="col-chooser-container">
        <button class="btn btn-secondary btn-sm" id="btn-col-chooser" style="background:var(--surface-color);border:1px solid var(--border-color);">⚙️ الأعمدة</button>
        <div id="col-chooser-dropdown" style="display:none;position:absolute;top:100%;left:0;background:var(--surface-color);border:1px solid var(--border-color);border-radius:8px;padding:10px;z-index:100;box-shadow:0 4px 12px rgba(0,0,0,0.1);width:220px;max-height:300px;overflow-y:auto;text-align:right;">
           ${ALL_COLUMNS.map(c => `
             <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer;font-size:0.8rem;color:var(--text-primary);">
               <input type="checkbox" class="col-toggle" value="${c.key}" ${savedColumns.includes(c.key) ? 'checked' : ''}>
               ${c.label}
             </label>
           `).join('')}
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
    container.querySelector('#dp-state').value = '';
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

  // Column Chooser Events
  const btnColChooser = container.querySelector('#btn-col-chooser');
  const dropdownCols = container.querySelector('#col-chooser-dropdown');
  btnColChooser.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownCols.style.display = dropdownCols.style.display === 'none' ? 'block' : 'none';
  });
  document.addEventListener('click', (e) => {
    if (!container.querySelector('#col-chooser-container').contains(e.target)) {
      dropdownCols.style.display = 'none';
    }
  });
  
  const toggles = container.querySelectorAll('.col-toggle');
  toggles.forEach(t => {
    t.addEventListener('change', () => {
      savedColumns = Array.from(toggles).filter(chk => chk.checked).map(chk => chk.value);
      if (savedColumns.length === 0) {
        // Prevent hiding all columns
        savedColumns = ['name', 'company_name'];
        toggles.forEach(chk => { if (savedColumns.includes(chk.value)) chk.checked = true; });
      }
      localStorage.setItem('sales_preview_cols', JSON.stringify(savedColumns));
      renderTable(container.querySelector('#dp-table-wrapper'), currentItems);
    });
  });

  currentPage = 0;
  await loadData(container);
}

async function loadData(container) {
  const search = container.querySelector('#dp-search').value.trim();
  const companyId = container.querySelector('#dp-company').value;
  const state = container.querySelector('#dp-state').value;
  const dateFrom = container.querySelector('#dp-datefrom').value;
  const dateTo = container.querySelector('#dp-dateto').value;

  const params = {
    limit: PAGE_SIZE,
    offset: currentPage * PAGE_SIZE,
    orderBy: currentSortCol,
    orderDir: currentSortDir
  };
  if (search) params.search = search;
  if (companyId) params.companyIds = companyId;
  if (state) params.state = state;
  if (dateFrom) params.dateFrom = dateFrom;
  if (dateTo) params.dateTo = dateTo;

  try {
    const data = await api.sales.getInvoices(params);
    
    // Populate state filter once
    if (data.states && data.states.length > 0) {
      const sel = container.querySelector('#dp-state');
      const currentVal = sel.value;
      if (sel.options.length <= 1) {
        data.states.forEach(t => {
          const opt = document.createElement('option');
          opt.value = t;
          opt.textContent = t;
          sel.appendChild(opt);
        });
        if (currentVal) sel.value = currentVal;
      }
    }

    // Total badge
    // container.querySelector('#total-badge').textContent = `إجمالي: ${formatNumber(data.total)} فاتورة`;

    // Render Summary Cards
    const totals = data.totals || { amount_total: 0, amount_untaxed: 0, total_paid: 0 };
    const residual = totals.total_paid - totals.amount_total;
    
    container.querySelector('#dp-summary-cards').innerHTML = `
      <div class="card" style="padding:var(--space-md);display:flex;align-items:center;gap:16px;">
        <div style="background:rgba(59,130,246,0.1);color:var(--accent-blue);width:45px;height:45px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;">🧾</div>
        <div>
          <div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:4px;">إجمالي الفواتير</div>
          <div style="font-weight:700;font-size:1.25rem;font-family:var(--font-en);color:var(--text-primary);">${formatNumber(data.total)}</div>
        </div>
      </div>
      <div class="card" style="padding:var(--space-md);display:flex;align-items:center;gap:16px;">
        <div style="background:rgba(16,185,129,0.1);color:var(--accent-green);width:45px;height:45px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;">💰</div>
        <div>
          <div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:4px;">إجمالي المبالغ</div>
          <div style="font-weight:700;font-size:1.25rem;font-family:var(--font-en);color:var(--text-primary);">${formatNumber(totals.amount_total, 2)} ر.س</div>
        </div>
      </div>
      <div class="card" style="padding:var(--space-md);display:flex;align-items:center;gap:16px;">
        <div style="background:rgba(139,92,246,0.1);color:#8b5cf6;width:45px;height:45px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;">💸</div>
        <div>
          <div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:4px;">إجمالي المدفوع</div>
          <div style="font-weight:700;font-size:1.25rem;font-family:var(--font-en);color:var(--text-primary);">${formatNumber(totals.total_paid, 2)} ر.س</div>
        </div>
      </div>
      <div class="card" style="padding:var(--space-md);display:flex;align-items:center;gap:16px;">
        <div style="background:rgba(245,158,11,0.1);color:var(--accent-orange);width:45px;height:45px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;">⏳</div>
        <div>
          <div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:4px;">المتبقي</div>
          <div style="font-weight:700;font-size:1.25rem;font-family:var(--font-en);color:var(--text-primary);">${formatNumber(residual, 2)} ر.س</div>
        </div>
      </div>
    `;

    // Pagination
    const totalPages = Math.ceil(data.total / PAGE_SIZE);
    container.querySelector('#dp-prev').disabled = currentPage === 0;
    container.querySelector('#dp-next').disabled = (currentPage + 1) >= totalPages;
    container.querySelector('#dp-page-info').textContent = `صفحة ${currentPage + 1} من ${totalPages || 1}`;

    currentItems = data.items;
    renderTable(container.querySelector('#dp-table-wrapper'), currentItems);
  } catch (err) {
    container.querySelector('#dp-table-wrapper').innerHTML = `<div style="padding:20px;color:var(--accent-red);">خطأ: ${err.message}</div>`;
    container.querySelector('#dp-summary-cards').innerHTML = `<div style="text-align:center;padding:20px;color:var(--accent-red);">فشل تحميل ملخص البيانات</div>`;
  }
}

function renderTable(wrapper, items) {
  if (!items || items.length === 0) {
    wrapper.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-muted);">لا توجد بيانات</div>';
    return;
  }

  const columns = ALL_COLUMNS.filter(c => savedColumns.includes(c.key));

  wrapper.innerHTML = `
    <table class="data-table" style="font-size:0.78rem;width:100%;">
      <thead>
        <tr>
          <th style="position:sticky;top:0;z-index:2;font-size:0.7rem;white-space:nowrap;width:30px;">#</th>
          ${columns.map(c => {
             const isSortable = c.key !== 'actions' && c.key !== 'raw_data';
             let sortIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 15l5 5 5-5M7 9l5-5 5 5"/></svg>`; // default up/down arrows
             if (currentSortCol === c.key) {
               sortIcon = currentSortDir === 'ASC' 
                 ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 15l7-7 7 7"/></svg>`
                 : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 9l-7 7-7-7"/></svg>`;
             }
             return `
               <th style="position:sticky;top:0;z-index:2;font-size:0.75rem;white-space:nowrap;cursor:${isSortable?'pointer':'default'};background:var(--surface-color);"
                   ${isSortable ? `class="sort-header hover-bg" data-key="${c.key}"` : ''}>
                 <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 4px;">
                   <span>${c.label}</span>
                   ${isSortable ? `<span class="sort-icon" style="color:${currentSortCol === c.key ? 'var(--accent-blue)' : 'var(--text-muted)'}; opacity:${currentSortCol === c.key ? '1' : '0.4'}; display:flex; align-items:center;">${sortIcon}</span>` : ''}
                 </div>
               </th>
             `;
          }).join('')}
        </tr>
      </thead>
      <tbody>
        ${items.map((item, idx) => `
          <tr>
            <td style="font-family:var(--font-en);color:var(--text-muted);font-size:0.7rem;">${currentPage * PAGE_SIZE + idx + 1}</td>
            ${columns.map(c => renderCell(item, c, idx)).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;

  // Bind raw data view buttons
  const buttons = wrapper.querySelectorAll('.btn-view-raw');
  buttons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idx = e.currentTarget.getAttribute('data-idx');
      const item = items[idx];
      alert("البيانات الخام للفاتورة:\n\n" + (item.raw_data ? JSON.stringify(JSON.parse(item.raw_data), null, 2) : "لا توجد بيانات خام"));
    });
  });

  // Bind sort headers
  wrapper.querySelectorAll('.sort-header').forEach(th => {
    th.addEventListener('click', (e) => {
      const col = e.currentTarget.closest('.sort-header').getAttribute('data-key');
      if (currentSortCol === col) {
        currentSortDir = currentSortDir === 'ASC' ? 'DESC' : 'ASC';
      } else {
        currentSortCol = col;
        currentSortDir = 'DESC'; // default to DESC when changing column
      }
      currentPage = 0;
      // Find the container and call loadData
      const container = wrapper.parentElement.parentElement;
      if (container) loadData(container);
    });
  });
}

function renderCell(item, col, idx) {
  let val = item[col.key];
  if (col.isRaw) {
    try {
      const p = item.raw_data ? JSON.parse(item.raw_data) : {};
      val = p[col.key];
    } catch(e) { val = ''; }
  }
  
  switch (col.type) {
    case 'residual': {
      let paid = 0;
      try {
        const p = item.raw_data ? JSON.parse(item.raw_data) : {};
        paid = parseFloat(p.total_paid) || 0;
      } catch(e) {}
      const total = parseFloat(item.amount_total) || 0;
      const residualVal = paid - total;
      if (!residualVal || residualVal === 0) return '<td style="font-family:var(--font-en);color:var(--text-muted);">0</td>';
      const isNegRes = residualVal < 0;
      return `<td style="font-family:var(--font-en);font-weight:500;color:${isNegRes ? 'var(--accent-red)' : 'var(--text-primary)'};">${formatNumber(residualVal, 2)}</td>`;
    }

    case 'money':
      if (!val || val === 0) return '<td style="font-family:var(--font-en);color:var(--text-muted);">0</td>';
      const isNeg = val < 0;
      return `<td style="font-family:var(--font-en);font-weight:500;color:${isNeg ? 'var(--accent-red)' : 'var(--text-primary)'};">${formatNumber(val, 2)}</td>`;
    
    case 'date':
      return `<td style="font-family:var(--font-en);font-size:0.75rem;white-space:nowrap;">${val ? val.split(' ')[0] : ''}</td>`;
    
    case 'code':
      return `<td style="font-family:var(--font-en);font-size:0.75rem;color:var(--accent-blue);font-weight:600;">${val || ''}</td>`;
    
    case 'badge':
      if (!val) return '<td></td>';
      const isPosted = val === 'posted';
      const bg = isPosted ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)';
      const color = isPosted ? 'var(--accent-green)' : 'var(--accent-orange)';
      return `<td><span style="background:${bg};color:${color};padding:2px 6px;border-radius:4px;font-size:0.68rem;white-space:nowrap;">${val}</span></td>`;
    
    case 'actions':
      return `<td>
         <button class="btn btn-secondary btn-sm btn-view-raw" data-idx="${idx}" style="padding:4px 8px;font-size:0.7rem;">
           عرض JSON
         </button>
      </td>`;

    default:
      return `<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${(val || '').toString().replace(/"/g, '&quot;')}">${val || ''}</td>`;
  }
}
