import { api } from '../api.js';
import { store } from '../store.js';
import { formatNumber } from '../utils/format.js';
import { renderFilters } from '../components/filters.js';
import { showToast } from '../utils/ui.js';

export async function renderBalanceSheet(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">الميزانية العمومية المجمعة</h1>
        <p class="page-subtitle">Consolidated Balance Sheet</p>
      </div>
      <div style="display:flex;gap:8px;">
        <label style="display:flex;align-items:center;gap:6px;font-size:0.8rem;color:var(--text-secondary);">
          <input type="checkbox" id="chk-bs-eliminations" /> استبعاد المعاملات المتبادلة
        </label>
      </div>
    </div>
    
    <div class="filters-bar" id="bs-filters"></div>
    <div id="bs-content"><div class="skeleton" style="height:400px;border-radius:var(--radius-lg);"></div></div>
  `;

  const filtersEl = container.querySelector('#bs-filters');
  renderFilters(filtersEl, () => loadData(container));
  
  container.querySelector('#chk-bs-eliminations').addEventListener('change', () => loadData(container));

  await loadData(container);
}

async function loadData(container) {
  try {
    const params = store.getFilterParams();
    params.asOfDate = params.dateTo || new Date().toISOString().split('T')[0];
    params.useEliminations = container.querySelector('#chk-bs-eliminations').checked;
    const data = await api.getBalanceSheet(params);
    renderSheet(container.querySelector('#bs-content'), data);
  } catch (err) {
    showToast('خطأ في تحميل الميزانية العمومية', 'error');
  }
}

function renderSheet(el, data) {
  const companies = store.get('companies');
  const selectedIds = store.get('selectedCompanyIds');
  const showCompanies = selectedIds.length > 0 
    ? companies.filter(c => selectedIds.includes(c.id))
    : companies;
  const showCols = showCompanies.length > 1;
  const colspan = showCols ? showCompanies.length + 3 : 3;

  el.innerHTML = `
    <div class="data-table-wrapper fade-in">
      <table class="data-table">
        <thead>
          <tr>
            <th style="min-width:200px;">الحساب</th>
            <th>الكود</th>
            ${showCols ? showCompanies.map(c => `<th class="number">${c.name}</th>`).join('') : ''}
            <th class="number">المجمع</th>
          </tr>
        </thead>
        <tbody>
          <!-- Assets -->
          <tr class="group-header"><td colspan="${colspan}">الأصول</td></tr>
          ${data.assets.map(item => renderRow(item, showCompanies, showCols)).join('')}
          <tr class="total-row">
            <td>إجمالي الأصول</td><td></td>
            ${showCols ? showCompanies.map(c => {
              const amt = data.assets.reduce((s,i) => s + (i.companies[c.id]?.amount || 0), 0);
              return `<td class="number">${formatNumber(amt, 2)}</td>`;
            }).join('') : ''}
            <td class="number positive">${formatNumber(data.summary.totalAssets, 2)}</td>
          </tr>
          
          <!-- Liabilities -->
          <tr class="group-header"><td colspan="${colspan}">الالتزامات</td></tr>
          ${data.liabilities.map(item => renderRow(item, showCompanies, showCols)).join('')}
          <tr class="total-row">
            <td>إجمالي الالتزامات</td><td></td>
            ${showCols ? showCompanies.map(c => {
              const amt = data.liabilities.reduce((s,i) => s + (i.companies[c.id]?.amount || 0), 0);
              return `<td class="number">${formatNumber(amt, 2)}</td>`;
            }).join('') : ''}
            <td class="number">${formatNumber(data.summary.totalLiabilities, 2)}</td>
          </tr>
          
          <!-- Equity -->
          <tr class="group-header"><td colspan="${colspan}">حقوق الملكية</td></tr>
          ${data.equity.map(item => renderRow(item, showCompanies, showCols)).join('')}
          <tr class="total-row">
            <td>إجمالي حقوق الملكية</td><td></td>
            ${showCols ? showCompanies.map(c => {
              const amt = data.equity.reduce((s,i) => s + (i.companies[c.id]?.amount || 0), 0);
              return `<td class="number">${formatNumber(amt, 2)}</td>`;
            }).join('') : ''}
            <td class="number">${formatNumber(data.summary.totalEquity, 2)}</td>
          </tr>

          <!-- Total L+E -->
          <tr class="total-row" style="font-size:1.1em;">
            <td>إجمالي الالتزامات + حقوق الملكية</td><td></td>
            ${showCols ? showCompanies.map(() => '<td></td>').join('') : ''}
            <td class="number positive" style="font-size:1.1em;">
              ${formatNumber(data.summary.totalLiabilities + data.summary.totalEquity, 2)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderRow(item, showCompanies, showCols) {
  return `
    <tr class="indent-1">
      <td>${item.account_name}</td>
      <td style="font-family:var(--font-en);color:var(--text-muted);font-size:0.8em;">${item.account_code}</td>
      ${showCols ? showCompanies.map(c => {
        const amt = item.companies[c.id]?.amount || 0;
        return `<td class="number">${formatNumber(amt, 2)}</td>`;
      }).join('') : ''}
      <td class="number">${formatNumber(item.total, 2)}</td>
    </tr>
  `;
}
