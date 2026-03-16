import { api } from '../api.js';
import { store } from '../store.js';
import { formatNumber } from '../utils/format.js';
import { renderFilters } from '../components/filters.js';
import { showToast } from '../utils/ui.js';

let currentRows = ['account'];
let currentCols = ['period'];
let currentMeasure = 'balance';

export async function renderPivotTable(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">الجداول المحورية</h1>
        <p class="page-subtitle">Pivot Tables - تحليل البيانات بحرية</p>
      </div>
    </div>
    
    <div class="filters-bar" id="pivot-filters"></div>
    
    <div class="card" style="margin-bottom:var(--space-lg);">
      <div class="pivot-controls">
        <div class="pivot-dimension">
          <div class="pivot-dimension-header">الصفوف (Rows)</div>
          <div class="pivot-chips" id="pivot-rows"></div>
        </div>
        <div class="pivot-dimension">
          <div class="pivot-dimension-header">الأعمدة (Columns)</div>
          <div class="pivot-chips" id="pivot-cols"></div>
        </div>
        <div class="pivot-dimension">
          <div class="pivot-dimension-header">القياس (Measure)</div>
          <div class="pivot-chips" id="pivot-measure"></div>
        </div>
      </div>
    </div>
    
    <div id="pivot-content"><div class="skeleton" style="height:400px;border-radius:var(--radius-lg);"></div></div>
  `;

  renderFilters(container.querySelector('#pivot-filters'), () => loadPivot(container));
  renderDimensionControls(container);
  await loadPivot(container);
}

const dimensions = [
  { id: 'account', label: 'الحساب' },
  { id: 'account_type', label: 'نوع الحساب' },
  { id: 'company', label: 'الشركة' },
  { id: 'period', label: 'الفترة' },
  { id: 'fiscal_year', label: 'السنة المالية' },
  { id: 'journal', label: 'اليومية' },
  { id: 'partner', label: 'الشريك' },
  { id: 'cost_center', label: 'مركز التكلفة' },
];

const measures = [
  { id: 'balance', label: 'الرصيد' },
  { id: 'debit', label: 'المدين' },
  { id: 'credit', label: 'الدائن' },
  { id: 'count', label: 'العدد' },
];

function renderDimensionControls(container) {
  const rowsEl = container.querySelector('#pivot-rows');
  const colsEl = container.querySelector('#pivot-cols');
  const measureEl = container.querySelector('#pivot-measure');

  rowsEl.innerHTML = dimensions.map(d => `
    <span class="pivot-chip ${currentRows.includes(d.id) ? 'active' : ''}" data-dim="${d.id}">${d.label}</span>
  `).join('');

  colsEl.innerHTML = dimensions.map(d => `
    <span class="pivot-chip ${currentCols.includes(d.id) ? 'active' : ''}" data-dim="${d.id}">${d.label}</span>
  `).join('');

  measureEl.innerHTML = measures.map(m => `
    <span class="pivot-chip ${currentMeasure === m.id ? 'active' : ''}" data-measure="${m.id}">${m.label}</span>
  `).join('');

  rowsEl.querySelectorAll('.pivot-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const dim = chip.dataset.dim;
      if (currentRows.includes(dim)) {
        currentRows = currentRows.filter(r => r !== dim);
      } else {
        currentRows.push(dim);
      }
      if (currentRows.length === 0) currentRows = ['account'];
      renderDimensionControls(container);
      loadPivot(container);
    });
  });

  colsEl.querySelectorAll('.pivot-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const dim = chip.dataset.dim;
      if (currentCols.includes(dim)) {
        currentCols = currentCols.filter(c => c !== dim);
      } else {
        currentCols.push(dim);
      }
      if (currentCols.length === 0) currentCols = ['period'];
      renderDimensionControls(container);
      loadPivot(container);
    });
  });

  measureEl.querySelectorAll('.pivot-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      currentMeasure = chip.dataset.measure;
      renderDimensionControls(container);
      loadPivot(container);
    });
  });
}

async function loadPivot(container) {
  try {
    const params = {
      ...store.getFilterParams(),
      rows: currentRows.join(','),
      columns: currentCols.join(','),
      measure: currentMeasure
    };
    const data = await api.getPivotData(params);
    renderPivotData(container.querySelector('#pivot-content'), data);
  } catch (err) {
    showToast('خطأ في تحميل الجدول المحوري', 'error');
    console.error(err);
  }
}

function renderPivotData(el, data) {
  if (!data || data.length === 0) {
    el.innerHTML = '<div class="card" style="text-align:center;padding:60px;color:var(--text-muted);">لا توجد بيانات للعرض</div>';
    return;
  }

  // Build pivot structure
  const fieldMap = {
    'company': 'c.name',
    'account': 'ji.account_code',
    'account_name': 'ji.account_name',
    'account_type': 'ji.account_type',
    'period': 'ji.period',
    'fiscal_year': 'ji.fiscal_year',
    'journal': 'ji.journal_name',
    'partner': 'ji.partner_name',
    'cost_center': 'ji.analytic_account'
  };

  // Get column values
  const colKey = currentCols[0];
  const sqlColField = fieldMap[colKey] || colKey;
  const colField = sqlColField.includes('.') ? sqlColField.split('.')[1] : sqlColField;
  
  const colValues = [...new Set(data.map(d => {
    return d[colField] || d[Object.keys(d).find(k => k.includes(colField.replace('ji.','').replace('c.','')))] || '';
  }))].filter(v => v).sort();

  // Get row key field
  const rowKey = currentRows[0];
  const sqlRowField = fieldMap[rowKey] || rowKey;
  const rowField = sqlRowField.includes('.') ? sqlRowField.split('.')[1] : sqlRowField;

  // Group by row
  const rows = {};
  for (const item of data) {
    const rowVal = item[rowField] || item[Object.keys(item).find(k => k.includes(rowField.replace('ji.','').replace('c.','')))] || 'غير محدد';
    const colVal = item[colField] || item[Object.keys(item).find(k => k.includes(colField.replace('ji.','').replace('c.','')))] || '';
    
    if (!rows[rowVal]) rows[rowVal] = {};
    rows[rowVal][colVal] = (rows[rowVal][colVal] || 0) + (item.value || 0);
  }

  el.innerHTML = `
    <div class="data-table-wrapper fade-in">
      <table class="data-table">
        <thead>
          <tr>
            <th>${dimensions.find(d => d.id === rowKey)?.label || rowKey}</th>
            ${colValues.map(v => `<th class="number">${v}</th>`).join('')}
            <th class="number">المجموع</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(rows).map(([rowVal, cols]) => {
            const total = Object.values(cols).reduce((s, v) => s + v, 0);
            return `
              <tr>
                <td>${rowVal}</td>
                ${colValues.map(v => {
                  const val = cols[v] || 0;
                  return `<td class="number ${val < 0 ? 'negative' : ''}">${formatNumber(val, 2)}</td>`;
                }).join('')}
                <td class="number" style="font-weight:600;">${formatNumber(total, 2)}</td>
              </tr>
            `;
          }).join('')}
          <tr class="total-row">
            <td>المجموع</td>
            ${colValues.map(v => {
              const total = Object.values(rows).reduce((s, cols) => s + (cols[v] || 0), 0);
              return `<td class="number">${formatNumber(total, 2)}</td>`;
            }).join('')}
            <td class="number">${formatNumber(
              Object.values(rows).reduce((s, cols) => s + Object.values(cols).reduce((ss, v) => ss + v, 0), 0)
            , 2)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}
