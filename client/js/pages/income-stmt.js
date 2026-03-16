import { api } from '../api.js';
import { store } from '../store.js';
import { formatNumber } from '../utils/format.js';
import { renderFilters } from '../components/filters.js';
import { showToast } from '../utils/ui.js';

export async function renderIncomeStatement(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">قائمة الدخل المجمعة</h1>
        <p class="page-subtitle">Consolidated Income Statement</p>
      </div>
      <div style="display:flex;gap:8px;">
        <label style="display:flex;align-items:center;gap:6px;font-size:0.8rem;color:var(--text-secondary);">
          <input type="checkbox" id="chk-eliminations" /> استبعاد المعاملات المتبادلة
        </label>
      </div>
    </div>
    
    <div class="filters-bar" id="is-filters"></div>
    <div id="is-content"><div class="skeleton" style="height:400px;border-radius:var(--radius-lg);"></div></div>
  `;

  const filtersEl = container.querySelector('#is-filters');
  renderFilters(filtersEl, () => loadData(container));

  container.querySelector('#chk-eliminations').addEventListener('change', () => loadData(container));

  await loadData(container);
}

async function loadData(container) {
  try {
    const params = store.getFilterParams();
    params.useEliminations = container.querySelector('#chk-eliminations').checked;
    const data = await api.getIncomeStatement(params);
    renderStatement(container.querySelector('#is-content'), data);
  } catch (err) {
    showToast('خطأ في تحميل قائمة الدخل', 'error');
  }
}

function renderStatement(el, data) {
  const companies = store.get('companies');
  const selectedIds = store.get('selectedCompanyIds');
  const showCompanies = selectedIds.length > 0 
    ? companies.filter(c => selectedIds.includes(c.id))
    : companies;
  const showCompanyCols = showCompanies.length > 1;

  el.innerHTML = `
    <div class="data-table-wrapper fade-in">
      <table class="data-table">
        <thead>
          <tr>
            <th style="min-width:200px;">الحساب</th>
            <th>الكود</th>
            ${showCompanyCols ? showCompanies.map(c => `<th class="number">${c.name}</th>`).join('') : ''}
            <th class="number">المجمع</th>
          </tr>
        </thead>
        <tbody>
          <!-- Revenue Section -->
          <tr class="group-header"><td colspan="${showCompanyCols ? showCompanies.length + 3 : 3}">الإيرادات</td></tr>
          ${data.revenue.map(item => renderRow(item, showCompanies, showCompanyCols)).join('')}
          <tr class="total-row">
            <td>إجمالي الإيرادات</td>
            <td></td>
            ${showCompanyCols ? showCompanies.map(c => {
              const amt = data.revenue.reduce((s, i) => s + (i.companies[c.id]?.amount || 0), 0);
              return `<td class="number">${formatNumber(amt, 2)}</td>`;
            }).join('') : ''}
            <td class="number positive">${formatNumber(data.summary.totalRevenue, 2)}</td>
          </tr>
          
          <!-- Expenses Section -->
          <tr class="group-header"><td colspan="${showCompanyCols ? showCompanies.length + 3 : 3}">المصروفات</td></tr>
          ${data.expenses.map(item => renderRow(item, showCompanies, showCompanyCols, true)).join('')}
          <tr class="total-row">
            <td>إجمالي المصروفات</td>
            <td></td>
            ${showCompanyCols ? showCompanies.map(c => {
              const amt = data.expenses.reduce((s, i) => s + (i.companies[c.id]?.amount || 0), 0);
              return `<td class="number negative">(${formatNumber(amt, 2)})</td>`;
            }).join('') : ''}
            <td class="number negative">(${formatNumber(data.summary.totalExpenses, 2)})</td>
          </tr>

          ${data.eliminations && data.eliminations.length > 0 ? `
            <tr class="group-header"><td colspan="${showCompanyCols ? showCompanies.length + 3 : 3}">تعديلات الاستبعاد</td></tr>
            ${data.eliminations.map(e => `
              <tr>
                <td>${e.rule_name}</td>
                <td></td>
                ${showCompanyCols ? showCompanies.map(() => '<td></td>').join('') : ''}
                <td class="number negative">(${formatNumber(e.debit - e.credit, 2)})</td>
              </tr>
            `).join('')}
          ` : ''}
          
          <!-- Net Profit -->
          <tr class="total-row" style="font-size:1.1em;">
            <td>صافي الربح / (الخسارة)</td>
            <td></td>
            ${showCompanyCols ? showCompanies.map(() => '<td></td>').join('') : ''}
            <td class="number ${data.summary.netProfit >= 0 ? 'positive' : 'negative'}" style="font-size:1.1em;">
              ${data.summary.netProfit >= 0 ? '' : '('}${formatNumber(Math.abs(data.summary.netProfit), 2)}${data.summary.netProfit >= 0 ? '' : ')'}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderRow(item, showCompanies, showCompanyCols, isExpense = false) {
  return `
    <tr class="indent-1">
      <td>${item.account_name}</td>
      <td style="font-family:var(--font-en);color:var(--text-muted);font-size:0.8em;">${item.account_code}</td>
      ${showCompanyCols ? showCompanies.map(c => {
        const amt = item.companies[c.id]?.amount || 0;
        return `<td class="number">${isExpense && amt > 0 ? '(' : ''}${formatNumber(Math.abs(amt), 2)}${isExpense && amt > 0 ? ')' : ''}</td>`;
      }).join('') : ''}
      <td class="number ${isExpense ? 'negative' : 'positive'}">
        ${isExpense && item.total > 0 ? '(' : ''}${formatNumber(Math.abs(item.total), 2)}${isExpense && item.total > 0 ? ')' : ''}
      </td>
    </tr>
  `;
}
