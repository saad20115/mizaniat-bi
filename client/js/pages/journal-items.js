import { api } from '../api.js';
import { store } from '../store.js';
import { formatNumber, formatDate } from '../utils/format.js';
import { showToast } from '../utils/ui.js';

let currentPage = 0;
const pageSize = 50;

export async function renderJournalItems(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">القيود المحاسبية</h1>
        <p class="page-subtitle">Journal Items - عرض تفصيلي لبنود القيود</p>
      </div>
    </div>
    
    <div class="filters-bar">
      <div class="filter-group">
        <span class="filter-label">الشركة</span>
        <select class="filter-select" id="ji-company">
          <option value="">الكل</option>
          ${store.get('companies').map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
        </select>
      </div>
      <div class="filter-group">
        <span class="filter-label">من تاريخ</span>
        <input type="date" class="filter-input" id="ji-date-from" />
      </div>
      <div class="filter-group">
        <span class="filter-label">إلى تاريخ</span>
        <input type="date" class="filter-input" id="ji-date-to" />
      </div>
      <div class="filter-group">
        <span class="filter-label">كود الحساب</span>
        <input type="text" class="filter-input" id="ji-account" placeholder="مثل: 4100" style="direction:ltr;" />
      </div>
      <div class="filter-group" style="align-self:flex-end;">
        <button class="btn btn-primary" id="btn-ji-search">بحث</button>
      </div>
    </div>
    
    <div id="ji-content"><div class="skeleton" style="height:400px;border-radius:var(--radius-lg);"></div></div>
    <div id="ji-pagination" style="display:flex;justify-content:center;gap:8px;margin-top:var(--space-lg);"></div>
  `;

  container.querySelector('#btn-ji-search').addEventListener('click', () => {
    currentPage = 0;
    loadJournalItems(container);
  });

  await loadJournalItems(container);
}

async function loadJournalItems(container) {
  try {
    const companyId = container.querySelector('#ji-company').value;
    const params = {
      limit: pageSize,
      offset: currentPage * pageSize,
      dateFrom: container.querySelector('#ji-date-from').value,
      dateTo: container.querySelector('#ji-date-to').value,
      accountCode: container.querySelector('#ji-account').value,
    };
    if (companyId) params.companyIds = [parseInt(companyId)];

    const result = await api.getJournalItems(params);
    renderTable(container, result);
  } catch (err) {
    showToast('خطأ في تحميل القيود', 'error');
  }
}

function renderTable(container, result) {
  const el = container.querySelector('#ji-content');
  const { items, total } = result;
  const totalPages = Math.ceil(total / pageSize);

  el.innerHTML = `
    <div style="margin-bottom:var(--space-md);font-size:0.8rem;color:var(--text-muted);">
      إجمالي النتائج: ${formatNumber(total)} | الصفحة ${currentPage + 1} من ${totalPages || 1}
    </div>
    <div class="data-table-wrapper fade-in">
      <table class="data-table">
        <thead>
          <tr>
            <th>التاريخ</th>
            <th>الشركة</th>
            <th>كود الحساب</th>
            <th>اسم الحساب</th>
            <th>البيان</th>
            <th>الشريك</th>
            <th class="number">مدين</th>
            <th class="number">دائن</th>
            <th class="number">الرصيد</th>
            <th>رقم القيد</th>
          </tr>
        </thead>
        <tbody>
          ${items.length === 0 ? `<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--text-muted);">لا توجد نتائج</td></tr>` : ''}
          ${items.map(item => `
            <tr>
              <td style="font-family:var(--font-en);font-size:0.8em;white-space:nowrap;">${item.date}</td>
              <td><span class="badge badge-info">${item.company_name || ''}</span></td>
              <td style="font-family:var(--font-en);">${item.account_code || ''}</td>
              <td>${item.account_name || ''}</td>
              <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;">${item.label || ''}</td>
              <td>${item.partner_name || ''}</td>
              <td class="number">${item.debit > 0 ? formatNumber(item.debit, 2) : ''}</td>
              <td class="number">${item.credit > 0 ? formatNumber(item.credit, 2) : ''}</td>
              <td class="number ${item.balance >= 0 ? '' : 'negative'}">${formatNumber(item.balance, 2)}</td>
              <td style="font-family:var(--font-en);font-size:0.75em;color:var(--text-muted);">${item.move_name || ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Pagination
  const pagEl = container.querySelector('#ji-pagination');
  if (totalPages > 1) {
    pagEl.innerHTML = `
      <button class="btn btn-sm btn-secondary" ${currentPage === 0 ? 'disabled' : ''} id="btn-prev">السابق</button>
      <span style="display:flex;align-items:center;font-size:0.85rem;color:var(--text-secondary);">
        ${currentPage + 1} / ${totalPages}
      </span>
      <button class="btn btn-sm btn-secondary" ${currentPage >= totalPages - 1 ? 'disabled' : ''} id="btn-next">التالي</button>
    `;
    pagEl.querySelector('#btn-prev')?.addEventListener('click', () => { currentPage--; loadJournalItems(container); });
    pagEl.querySelector('#btn-next')?.addEventListener('click', () => { currentPage++; loadJournalItems(container); });
  } else {
    pagEl.innerHTML = '';
  }
}
