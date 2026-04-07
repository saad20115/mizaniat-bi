import { api } from '../api.js';
import { formatNumber } from '../utils/format.js';

export async function renderSpecialExpenses(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">💸 تقرير المصروفات المخصصة</h1>
        <p class="page-subtitle">نظرة عامة على مصروفات المجلس التنسيقي ومشاريع الحج</p>
      </div>
      <div style="display: flex; gap: var(--space-md);">
        <button class="btn btn-secondary" onclick="window.open('/api/external/special-expenses', '_blank')">🔗 عرض كـ JSON (API)</button>
        <button class="btn btn-primary" id="btn-refresh">🔄 تحديث البيانات</button>
      </div>
    </div>
    
    <div id="sp-loading" style="padding: 60px; text-align: center;">
      <div class="spinner"></div>
      <p style="margin-top:20px;color:var(--text-muted);">جاري استدعاء البيانات...</p>
    </div>

    <div id="sp-content" style="display:none; animation: fadeIn 0.4s ease-out;">
      <div class="kpi-grid" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); margin-bottom: var(--space-xl);">
        
        <div class="kpi-card" style="border-top: 3px solid var(--accent-purple);">
          <div class="kpi-title" style="color:var(--accent-purple); font-size:1.1rem; font-weight:bold;">المجلس التنسيقي</div>
          <div class="kpi-value" id="val-council">0</div>
          <div class="kpi-subtitle" style="font-size:0.8rem;">ابتداءً من 2025-08-01</div>
        </div>

        <div class="kpi-card" style="border-top: 3px solid var(--accent-blue);">
          <div class="kpi-title" style="color:var(--accent-blue); font-size:1.1rem; font-weight:bold;">مشاريع الحج</div>
          <div class="kpi-value" id="val-hajj">0</div>
          <div class="kpi-subtitle" style="font-size:0.8rem;">ابتداءً من 2025-10-01</div>
        </div>

        <div class="kpi-card" style="border-top: 3px solid var(--accent-emerald);">
          <div class="kpi-title" style="color:var(--accent-emerald); font-size:1.1rem; font-weight:bold;">إجمالي المصروفات للمشروعين</div>
          <div class="kpi-value" id="val-total">0</div>
          <div class="kpi-subtitle" id="val-rows" style="font-size:0.8rem;">إجمالي 0 قيد مالي</div>
        </div>

      </div>

      <div class="card" style="padding:0; overflow:hidden;">
        <div style="padding: var(--space-md) var(--space-xl); border-bottom:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center;">
          <h2 style="font-size:1.1rem; color:var(--text-white);">تفاصيل القيود المحاسبية</h2>
          
          <div class="filter-group" style="display:flex; gap:8px;">
            <select id="sp-filter-category" class="form-input" style="width:200px;">
              <option value="all">الكل</option>
              <option value="المجلس التنسيقي">المجلس التنسيقي فقط</option>
              <option value="مشاريع الحج">مشاريع الحج فقط</option>
            </select>
          </div>
        </div>
        
        <div style="overflow-x:auto; max-height: 500px;">
          <table class="data-table" style="width:100%;">
            <thead style="position: sticky; top: 0; background: var(--bg-surface); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
              <tr>
                <th style="text-align:right;">التاريخ</th>
                <th style="text-align:right;">الشركة</th>
                <th style="text-align:right;">الفئة</th>
                <th style="text-align:right;">مركز التكلفة</th>
                <th style="text-align:right;">الحساب</th>
                <th style="text-align:left;">المبلغ</th>
              </tr>
            </thead>
            <tbody id="sp-table-body">
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  let pageData = null;

  async function loadData() {
    const loading = document.getElementById('sp-loading');
    const content = document.getElementById('sp-content');
    loading.style.display = 'block';
    content.style.display = 'none';

    try {
      pageData = await api.getSpecialExpenses();
      
      document.getElementById('val-council').textContent = formatNumber(pageData.summary.totalCouncil);
      document.getElementById('val-hajj').textContent = formatNumber(pageData.summary.totalHajj);
      document.getElementById('val-total').textContent = formatNumber(pageData.summary.totalExpenses);
      document.getElementById('val-rows').textContent = \`إجمالي \${pageData.summary.totalRows} قيد مالي\`;
      
      renderTable();
      content.style.display = 'block';

    } catch (e) {
      container.innerHTML = \`<div class="card" style="color:var(--accent-red); padding:30px; text-align:center;">
        <h3>⚠️ حدث خطأ أثناء الاتصال بالـ API</h3>
        <p>\${e.message}</p>
        <button class="btn btn-secondary" onclick="location.reload()" style="margin-top:15px;">إعادة المحاولة</button>
      </div>\`;
    } finally {
      loading.style.display = 'none';
    }
  }

  function renderTable() {
    const tbody = document.getElementById('sp-table-body');
    const filterCat = document.getElementById('sp-filter-category').value;
    
    let rows = pageData.data;
    if (filterCat !== 'all') {
      rows = rows.filter(r => r.projectCategory === filterCat);
    }
    
    if (rows.length === 0) {
      tbody.innerHTML = \`<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text-muted);">لا توجد حركات مطابقة</td></tr>\`;
      return;
    }

    tbody.innerHTML = rows.map(r => {
      const color = r.projectCategory === 'المجلس التنسيقي' ? 'var(--accent-purple)' : 'var(--accent-blue)';
      const bg = r.projectCategory === 'المجلس التنسيقي' ? 'rgba(139,92,246,0.15)' : 'rgba(59,130,246,0.15)';
      
      return \`
      <tr>
        <td>\${r.date || '-'}</td>
        <td style="color:var(--text-gray);">\${r.companyName || '-'}</td>
        <td>
          <span style="background:\${bg}; color:\${color}; padding:2px 8px; border-radius:4px; font-size:0.85rem;">
            \${r.projectCategory}
          </span>
        </td>
        <td>\${r.costCenter}</td>
        <td><div style="max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="\${r.accountName}">\${r.accountCode} - \${r.accountName}</div></td>
        <td style="text-align:left; font-weight:w600; color:\${r.expenses < 0 ? 'var(--accent-red)' : 'var(--accent-emerald)'}; font-family:var(--font-mono);">
          \${formatNumber(r.expenses)}
        </td>
      </tr>
    \`}).join('');
  }

  container.querySelector('#btn-refresh').addEventListener('click', loadData);
  container.querySelector('#sp-filter-category').addEventListener('change', renderTable);

  loadData();
}
