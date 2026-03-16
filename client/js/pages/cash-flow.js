import { api } from '../api.js';
import { store } from '../store.js';
import { formatNumber } from '../utils/format.js';
import { renderFilters } from '../components/filters.js';
import { showToast } from '../utils/ui.js';

export async function renderCashFlow(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">قائمة التدفقات النقدية المجمعة</h1>
        <p class="page-subtitle">Consolidated Cash Flow Statement</p>
      </div>
    </div>
    
    <div class="filters-bar" id="cf-filters"></div>
    <div id="cf-content"><div class="skeleton" style="height:400px;border-radius:var(--radius-lg);"></div></div>
  `;

  renderFilters(container.querySelector('#cf-filters'), () => loadData(container));
  await loadData(container);
}

async function loadData(container) {
  try {
    const params = store.getFilterParams();
    const data = await api.getCashFlow(params);
    renderCashFlowStatement(container.querySelector('#cf-content'), data);
  } catch (err) {
    showToast('خطأ في تحميل التدفقات النقدية', 'error');
  }
}

const typeLabels = {
  'income': 'إيرادات',
  'income_other': 'إيرادات أخرى',
  'expense': 'مصروفات تشغيلية',
  'expense_direct_cost': 'تكلفة مبيعات',
  'expense_depreciation': 'استهلاك',
  'revenue': 'إيرادات',
  'cost_of_revenue': 'تكلفة إيرادات',
  'asset_receivable': 'تغير في الذمم المدينة',
  'liability_payable': 'تغير في الذمم الدائنة',
  'asset_current': 'تغير في الأصول المتداولة',
  'liability_current': 'تغير في الالتزامات المتداولة',
  'asset_non_current': 'أصول غير متداولة',
  'asset_fixed': 'أصول ثابتة',
  'equity': 'حقوق ملكية',
  'equity_unaffected': 'أرباح مبقاة',
  'liability_non_current': 'التزامات طويلة الأجل',
};

function renderCashFlowStatement(el, data) {
  const operatingTotal = data.operating.reduce((s, i) => s + i.amount, 0);
  const investingTotal = data.investing.reduce((s, i) => s + i.amount, 0);
  const financingTotal = data.financing.reduce((s, i) => s + i.amount, 0);
  const netCash = operatingTotal + investingTotal + financingTotal;

  el.innerHTML = `
    <div class="data-table-wrapper fade-in">
      <table class="data-table">
        <thead>
          <tr>
            <th style="min-width:300px;">الوصف</th>
            <th class="number">المبلغ (SAR)</th>
          </tr>
        </thead>
        <tbody>
          <tr class="group-header"><td colspan="2">الأنشطة التشغيلية</td></tr>
          ${data.operating.map(item => `
            <tr class="indent-1">
              <td>${typeLabels[item.account_type] || item.account_type}</td>
              <td class="number ${item.amount >= 0 ? '' : 'negative'}">
                ${item.amount < 0 ? '(' : ''}${formatNumber(Math.abs(item.amount), 2)}${item.amount < 0 ? ')' : ''}
              </td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td>صافي النقد من الأنشطة التشغيلية</td>
            <td class="number ${operatingTotal >= 0 ? 'positive' : 'negative'}">
              ${operatingTotal < 0 ? '(' : ''}${formatNumber(Math.abs(operatingTotal), 2)}${operatingTotal < 0 ? ')' : ''}
            </td>
          </tr>

          <tr class="group-header"><td colspan="2">الأنشطة الاستثمارية</td></tr>
          ${data.investing.map(item => `
            <tr class="indent-1">
              <td>${typeLabels[item.account_type] || item.account_type}</td>
              <td class="number ${item.amount <= 0 ? '' : 'negative'}">
                ${item.amount > 0 ? '(' : ''}${formatNumber(Math.abs(item.amount), 2)}${item.amount > 0 ? ')' : ''}
              </td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td>صافي النقد من الأنشطة الاستثمارية</td>
            <td class="number ${investingTotal <= 0 ? 'positive' : 'negative'}">
              ${investingTotal > 0 ? '(' : ''}${formatNumber(Math.abs(investingTotal), 2)}${investingTotal > 0 ? ')' : ''}
            </td>
          </tr>

          <tr class="group-header"><td colspan="2">الأنشطة التمويلية</td></tr>
          ${data.financing.map(item => `
            <tr class="indent-1">
              <td>${typeLabels[item.account_type] || item.account_type}</td>
              <td class="number">${formatNumber(item.amount, 2)}</td>
            </tr>
          `).join('')}
          <tr class="total-row">
            <td>صافي النقد من الأنشطة التمويلية</td>
            <td class="number ${financingTotal >= 0 ? 'positive' : 'negative'}">${formatNumber(financingTotal, 2)}</td>
          </tr>

          <tr class="total-row" style="font-size:1.1em;">
            <td>صافي التغير في النقد</td>
            <td class="number ${netCash >= 0 ? 'positive' : 'negative'}" style="font-size:1.1em;">
              ${formatNumber(netCash, 2)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}
