import { api } from '../api.js';
import { store } from '../store.js';
import { formatNumber, getMonthName } from '../utils/format.js';
import { renderFilters, loadFilterOptions } from '../components/filters.js';
import { showToast } from '../utils/ui.js';

export async function renderDashboard(container) {
  container.innerHTML = `
    <style>
      /* Dashboard-specific enhanced styles */
      .dash-donuts-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-lg);
        margin-bottom: var(--space-lg);
      }
      .dash-donut-card {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        padding: var(--space-xl) var(--space-lg);
        display: flex;
        flex-direction: column;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .dash-donut-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      }
      .dash-donut-title {
        font-size: 1rem;
        font-weight: 700;
        color: rgba(255,255,255,0.65);
        margin-bottom: var(--space-lg);
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .dash-donut-content {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 32px;
        flex: 1;
      }
      .dash-donut-ring {
        width: 200px;
        height: 200px;
        position: relative;
        flex-shrink: 0;
      }
      .dash-donut-center {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
      }
      .dash-donut-center-label {
        font-size: 0.8rem;
        color: rgba(255,255,255,0.4);
        font-weight: 600;
      }
      .dash-donut-center-value {
        font-size: 1.1rem;
        font-weight: 800;
        color: var(--text-white);
        font-family: var(--font-en);
        margin-top: 2px;
      }
      .dash-legend {
        display: flex;
        flex-direction: column;
        gap: 10px;
        flex: 1;
        min-width: 0;
      }
      .dash-legend-item {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 0.88rem;
        color: rgba(255,255,255,0.75);
        padding: 6px 0;
        border-bottom: 1px solid rgba(255,255,255,0.04);
      }
      .dash-legend-item:last-child { border-bottom: none; }
      .dash-legend-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .dash-legend-name {
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .dash-legend-val {
        font-family: var(--font-en);
        font-weight: 700;
        font-size: 0.9rem;
        white-space: nowrap;
        direction: ltr;
      }
      .dash-legend-pct {
        font-family: var(--font-en);
        font-size: 0.75rem;
        color: rgba(255,255,255,0.35);
        min-width: 36px;
        text-align: left;
      }

      /* Monthly bars section */
      .dash-monthly-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-lg);
        margin-bottom: var(--space-lg);
      }
      .dash-bar-card {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        padding: var(--space-lg);
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .dash-bar-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      }
      .dash-bar-title {
        font-size: 1rem;
        font-weight: 700;
        color: rgba(255,255,255,0.65);
        margin-bottom: var(--space-md);
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .dash-bar-total {
        margin-right: auto;
        font-family: var(--font-en);
        font-weight: 800;
        font-size: 0.95rem;
      }
      .dash-bars {
        display: flex;
        align-items: flex-end;
        gap: 6px;
        height: 260px;
        padding-top: 8px;
      }
      .dash-bar-item {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        height: 100%;
        justify-content: flex-end;
      }
      .dash-bar-val {
        font-size: 0.65rem;
        color: rgba(255,255,255,0.55);
        font-family: var(--font-en);
        font-weight: 600;
        white-space: nowrap;
        transform: rotate(-35deg);
        transform-origin: center bottom;
      }
      .dash-bar {
        width: 100%;
        max-width: 48px;
        border-radius: 5px 5px 0 0;
        transition: height 0.6s ease, opacity 0.2s;
        min-height: 3px;
        cursor: default;
      }
      .dash-bar:hover { opacity: 0.8; }
      .dash-bar-lbl {
        font-size: 0.7rem;
        color: rgba(255,255,255,0.4);
        text-align: center;
        font-weight: 600;
        margin-top: 2px;
      }

      @media(max-width:900px) {
        .dash-donuts-row, .dash-monthly-row { grid-template-columns: 1fr; }
      }
    </style>
    <div class="page-header">
      <div>
        <h1 class="page-title">لوحة التحكم</h1>
        <p class="page-subtitle">نظرة عامة على الأداء المالي المجمع</p>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-secondary" id="btn-sync">🔄 مزامنة البيانات</button>
      </div>
    </div>
    
    <div class="filters-bar" id="dashboard-filters"></div>
    
    <div class="kpi-grid" id="kpi-grid">
      ${Array(6).fill('<div class="kpi-card"><div class="skeleton" style="height:80px;"></div></div>').join('')}
    </div>
    
    <div id="dash-charts">
      <div class="dash-donuts-row">
        <div class="dash-donut-card"><div class="skeleton" style="height:240px;"></div></div>
        <div class="dash-donut-card"><div class="skeleton" style="height:240px;"></div></div>
      </div>
      <div class="dash-monthly-row">
        <div class="dash-bar-card"><div class="skeleton" style="height:280px;"></div></div>
        <div class="dash-bar-card"><div class="skeleton" style="height:280px;"></div></div>
      </div>
    </div>
  `;

  // Render filters
  const filtersContainer = container.querySelector('#dashboard-filters');
  renderFilters(filtersContainer, () => loadDashboardData(container));

  // Load data
  await loadDashboardData(container);

  // Sync button
  container.querySelector('#btn-sync').addEventListener('click', async () => {
    try {
      showToast('جاري مزامنة البيانات...', 'info');
      const result = await api.syncAll();
      showToast('تمت المزامنة بنجاح', 'success');
      await loadDashboardData(container);
    } catch (err) {
      showToast('فشلت المزامنة: ' + err.message, 'error');
    }
  });
}

async function loadDashboardData(container) {
  try {
    const params = store.getFilterParams();
    const data = await api.getDashboard(params);
    
    renderKPIs(container.querySelector('#kpi-grid'), data);
    renderCharts(container.querySelector('#dash-charts'), data);
  } catch (err) {
    console.error('Dashboard error:', err);
    showToast('خطأ في تحميل البيانات', 'error');
  }
}

function renderKPIs(grid, data) {
  const profitRate = data.totalRevenue > 0 ? ((data.netProfit / data.totalRevenue) * 100).toFixed(1) : '0.0';
  
  grid.innerHTML = `
    <div class="kpi-card blue fade-in">
      <div class="kpi-icon blue">📈</div>
      <div class="kpi-label">إجمالي الإيرادات</div>
      <div class="kpi-value" style="font-size:1.2rem;">${formatNumber(data.totalRevenue, 2)}</div>
      <div class="kpi-change positive">SAR</div>
    </div>
    
    <div class="kpi-card red fade-in" style="animation-delay:0.05s">
      <div class="kpi-icon red">📉</div>
      <div class="kpi-label">إجمالي المصروفات</div>
      <div class="kpi-value" style="font-size:1.2rem;">${formatNumber(data.totalExpenses, 2)}</div>
      <div class="kpi-change negative">SAR</div>
    </div>
    
    <div class="kpi-card emerald fade-in" style="animation-delay:0.1s">
      <div class="kpi-icon emerald">💵</div>
      <div class="kpi-label">صافي الربح</div>
      <div class="kpi-value" style="font-size:1.2rem;">${formatNumber(data.netProfit, 2)}</div>
      <div class="kpi-change ${data.netProfit >= 0 ? 'positive' : 'negative'}">
        ${data.netProfit >= 0 ? '↑' : '↓'} ${profitRate}%
      </div>
    </div>
    
    <div class="kpi-card purple fade-in" style="animation-delay:0.15s">
      <div class="kpi-icon purple">🏢</div>
      <div class="kpi-label">إجمالي الأصول</div>
      <div class="kpi-value" style="font-size:1.2rem;">${formatNumber(data.totalAssets, 2)}</div>
      <div class="kpi-change" style="color:var(--text-muted);">SAR</div>
    </div>
    
    <div class="kpi-card amber fade-in" style="animation-delay:0.2s">
      <div class="kpi-icon amber">📊</div>
      <div class="kpi-label">إجمالي الالتزامات</div>
      <div class="kpi-value" style="font-size:1.2rem;">${formatNumber(data.totalLiabilities, 2)}</div>
      <div class="kpi-change" style="color:var(--text-muted);">SAR</div>
    </div>
    
    <div class="kpi-card cyan fade-in" style="animation-delay:0.25s">
      <div class="kpi-icon cyan">🏦</div>
      <div class="kpi-label">الرصيد النقدي</div>
      <div class="kpi-value" style="font-size:1.2rem;">${formatNumber(data.cashPosition, 2)}</div>
      <div class="kpi-change" style="color:var(--text-muted);">SAR</div>
    </div>
  `;
}

function renderCharts(chartsEl, data) {
  const periods = data.revenueByPeriod || [];
  const expPeriods = data.expensesByPeriod || [];
  const companies = data.revenueByCompany || [];
  const expCompanies = data.expensesByCompany || [];
  
  // Filter to last fiscal year only for monthly charts
  const allPeriods = [...new Set([...periods.map(p => p.period), ...expPeriods.map(p => p.period)])].sort();
  const fySet = new Set(allPeriods.map(p => p ? p.split('-')[0] : ''));
  const lastFY = [...fySet].sort().pop() || '';
  
  const filteredRevPeriods = lastFY ? periods.filter(p => p.period && p.period.startsWith(lastFY)) : periods;
  const filteredExpPeriods = lastFY ? expPeriods.filter(p => p.period && p.period.startsWith(lastFY)) : expPeriods;
  
  const maxRevenue = Math.max(...filteredRevPeriods.map(p => p.total), 1);
  const maxExpense = Math.max(...filteredExpPeriods.map(p => p.total), 1);

  const REV_COLORS = ['#3b82f6', '#10b981', '#06b6d4', '#8b5cf6', '#ec4899', '#14b8a6'];
  const EXP_COLORS = ['#ef4444', '#f59e0b', '#ec4899', '#f97316', '#e11d48', '#dc2626'];
  
  const revTotal = companies.reduce((s, c) => s + c.total, 0);
  const expTotal = expCompanies.reduce((s, c) => s + c.total, 0);
  const revMonthlyTotal = filteredRevPeriods.reduce((s, p) => s + p.total, 0);
  const expMonthlyTotal = filteredExpPeriods.reduce((s, p) => s + p.total, 0);

  chartsEl.innerHTML = `
    <!-- Donut Charts Row -->
    <div class="dash-donuts-row">
      <!-- Expenses Donut -->
      <div class="dash-donut-card fade-in">
        <div class="dash-donut-title">🍩 المصروفات حسب الشركة</div>
        <div class="dash-donut-content">
          <div class="dash-donut-ring">
            <svg viewBox="0 0 200 200">${renderDonutSVG(expCompanies, EXP_COLORS, 200)}</svg>
            <div class="dash-donut-center">
              <div class="dash-donut-center-label">الإجمالي</div>
              <div class="dash-donut-center-value" style="color:#ef4444;">${formatCompact(expTotal)}</div>
            </div>
          </div>
          <div class="dash-legend">
            ${expCompanies.map((c, i) => {
              const pct = expTotal > 0 ? ((c.total / expTotal) * 100).toFixed(1) : '0.0';
              return `
              <div class="dash-legend-item">
                <span class="dash-legend-dot" style="background:${EXP_COLORS[i % EXP_COLORS.length]}"></span>
                <span class="dash-legend-name">${c.company_name}</span>
                <span class="dash-legend-pct">${pct}%</span>
                <span class="dash-legend-val" style="color:${EXP_COLORS[i % EXP_COLORS.length]}">${formatCompact(c.total)}</span>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- Revenue Donut -->
      <div class="dash-donut-card fade-in" style="animation-delay:0.08s">
        <div class="dash-donut-title">🍩 الإيرادات حسب الشركة</div>
        <div class="dash-donut-content">
          <div class="dash-donut-ring">
            <svg viewBox="0 0 200 200">${renderDonutSVG(companies, REV_COLORS, 200)}</svg>
            <div class="dash-donut-center">
              <div class="dash-donut-center-label">الإجمالي</div>
              <div class="dash-donut-center-value" style="color:#10b981;">${formatCompact(revTotal)}</div>
            </div>
          </div>
          <div class="dash-legend">
            ${companies.map((c, i) => {
              const pct = revTotal > 0 ? ((c.total / revTotal) * 100).toFixed(1) : '0.0';
              return `
              <div class="dash-legend-item">
                <span class="dash-legend-dot" style="background:${c.color || REV_COLORS[i % REV_COLORS.length]}"></span>
                <span class="dash-legend-name">${c.company_name}</span>
                <span class="dash-legend-pct">${pct}%</span>
                <span class="dash-legend-val" style="color:${c.color || REV_COLORS[i % REV_COLORS.length]}">${formatCompact(c.total)}</span>
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>
    </div>

    <!-- Monthly Bars Row -->
    <div class="dash-monthly-row">
      <!-- Monthly Revenue -->
      <div class="dash-bar-card fade-in" style="animation-delay:0.12s">
        <div class="dash-bar-title">
          📈 الإيرادات الشهرية
          ${lastFY ? `<span style="font-size:0.8rem;color:rgba(255,255,255,0.3);font-family:var(--font-en);">${lastFY}</span>` : ''}
          <span class="dash-bar-total" style="color:#10b981;">${formatCompact(revMonthlyTotal)}</span>
        </div>
        <div class="dash-bars">
          ${filteredRevPeriods.map(p => {
            const pct = (p.total / maxRevenue) * 100;
            const month = p.period ? p.period.split('-')[1] : '';
            return `
            <div class="dash-bar-item">
              <div class="dash-bar-val">${formatCompact(p.total)}</div>
              <div class="dash-bar" style="height:${Math.max(pct, 2)}%;background:linear-gradient(to top, #3b82f6, #60a5fa);" title="${formatNumber(p.total, 2)} SAR"></div>
              <div class="dash-bar-lbl">${getMonthName(month)}</div>
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- Monthly Expenses -->
      <div class="dash-bar-card fade-in" style="animation-delay:0.16s">
        <div class="dash-bar-title">
          📉 المصروفات الشهرية
          ${lastFY ? `<span style="font-size:0.8rem;color:rgba(255,255,255,0.3);font-family:var(--font-en);">${lastFY}</span>` : ''}
          <span class="dash-bar-total" style="color:#ef4444;">${formatCompact(expMonthlyTotal)}</span>
        </div>
        <div class="dash-bars">
          ${filteredExpPeriods.map(p => {
            const pct = (p.total / maxExpense) * 100;
            const month = p.period ? p.period.split('-')[1] : '';
            return `
            <div class="dash-bar-item">
              <div class="dash-bar-val">${formatCompact(p.total)}</div>
              <div class="dash-bar" style="height:${Math.max(pct, 2)}%;background:linear-gradient(to top, #ef4444, #f87171);" title="${formatNumber(p.total, 2)} SAR"></div>
              <div class="dash-bar-lbl">${getMonthName(month)}</div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderDonutSVG(companies, colors, size) {
  const total = companies.reduce((s, c) => s + Math.abs(c.total), 0);
  const cx = size / 2, cy = size / 2;
  const r = size * 0.35;
  const strokeW = size * 0.12;

  if (total === 0) {
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(99,130,255,0.08)" stroke-width="${strokeW}"/>`;
  }
  
  let cumulative = 0;
  const circumference = 2 * Math.PI * r;
  
  return companies.map((c, i) => {
    const pct = Math.abs(c.total) / total;
    const dashLen = pct * circumference;
    const gap = companies.length > 1 ? 2 : 0;
    const dashOffset = -cumulative * circumference;
    cumulative += pct;
    
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" 
      stroke="${colors[i % colors.length]}" 
      stroke-width="${strokeW}" 
      stroke-dasharray="${Math.max(dashLen - gap, 0)} ${circumference - Math.max(dashLen - gap, 0)}" 
      stroke-dashoffset="${dashOffset}"
      transform="rotate(-90 ${cx} ${cy})"
      stroke-linecap="round"
      style="transition: stroke-dasharray 0.6s ease;"/>`;
  }).join('');
}

function formatCompact(val) {
  const abs = Math.abs(val);
  if (abs >= 1e6) return (val / 1e6).toFixed(1) + 'M';
  if (abs >= 1e3) return (val / 1e3).toFixed(0) + 'K';
  return formatNumber(val, 0);
}
