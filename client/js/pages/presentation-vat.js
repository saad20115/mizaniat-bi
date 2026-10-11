import { api } from '../api.js';
import { store } from '../store.js';
import { formatNumber, formatCurrency } from '../utils/format.js';
import { createTreeTable } from '../components/tree-table.js';

/**
 * Stage D5: Value Added Tax (ضريبة القيمة المضافة)
 * 4-level TreeTable: Company -> Year -> Quarter -> Month
 * View grain: vat_period (default, per company filing schedule) | quarter | month | year
 * Slide-over detail drawer with tabs: Summary | Tax Breakdown | Documents | Settlements
 */

let currentData = null;
let currentTreeTable = null;
let currentGrain = 'vat_period';
let currentSearchQuery = '';
let activeDetailPeriod = null;

const ICONS = {
  expandAll: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg>',
  collapseAll: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/></svg>',
  excel: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  spinner: '<svg class="spin-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>',
  chevronDown: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
  chevronLeft: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
  fileText: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>'
};

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtVal(num, showZeroDash = true, decimals = 2) {
  if (num === null || num === undefined || isNaN(num)) return showZeroDash ? '—' : '0.00';
  const val = Number(num);
  if (Math.abs(val) < 0.005 && showZeroDash) return '—';
  const formatted = val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  if (val < 0) {
    return `<span class="exec-num-neg" style="color:var(--status-negative, #ef4444);direction:ltr;display:inline-block;">(${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })})</span>`;
  }
  return `<span class="exec-num">${formatted}</span>`;
}

function formatPresentationPeriodLabel(timeFilter, periodParams) {
  if (timeFilter?.periodLabel) {
    const raw = String(timeFilter.periodLabel).trim();
    const fullYearMatch1 = raw.match(/^(?:01-01-|01\/01\/)(\d{4})\s*(?:إلى|-|to)\s*(?:31-12-|31\/12\/)\1$/);
    if (fullYearMatch1) return fullYearMatch1[1];
    const fullYearMatch2 = raw.match(/^(\d{4})-01-01\s*(?:إلى|-|to)\s*\1-12-31$/);
    if (fullYearMatch2) return fullYearMatch2[1];
    return raw;
  }
  if (timeFilter?.isCustomDate && timeFilter.dateFrom && timeFilter.dateTo) {
    const from = String(timeFilter.dateFrom).trim();
    const to = String(timeFilter.dateTo).trim();
    const mFrom = from.match(/^(\d{4})-01-01$/);
    const mTo = to.match(/^(\d{4})-12-31$/);
    if (mFrom && mTo && mFrom[1] === mTo[1]) {
      return mFrom[1];
    }
    return `${from} إلى ${to}`;
  }
  return periodParams?.years || '2026';
}

function getPeriodParamsFromFilter(timeFilter) {
  const isCustom = timeFilter?.isCustomDate;
  const isAll = timeFilter?.selectedYear === 'ALL' || timeFilter?.selectedYears?.includes('ALL');
  let dateFrom = timeFilter?.dateFrom;
  let dateTo = timeFilter?.dateTo;
  let yearsParam = undefined;
  if (!isCustom) {
    if (isAll) {
      yearsParam = 'ALL';
    } else if (timeFilter?.selectedYears && timeFilter.selectedYears.length > 0) {
      yearsParam = timeFilter.selectedYears.join(',');
    } else if (timeFilter?.selectedYear) {
      yearsParam = timeFilter.selectedYear;
    }
  }
  return { years: yearsParam, dateFrom, dateTo };
}

export async function renderVatTab(body, container, timeFilter, selectedCos) {
  body.innerHTML = `
    <div style="direction:rtl;display:flex;flex-direction:column;gap:20px;padding:4px 0;width:100%;max-width:100%;min-width:0;box-sizing:border-box;">
      <!-- Loading Placeholder -->
      <div id="vat-loading" style="text-align:center;padding:80px 20px;color:var(--text-muted);font-size:1.05rem;">
        <span style="display:inline-block;vertical-align:middle;margin-left:8px;">${ICONS.spinner}</span>
        جاري تحميل تقرير ضريبة القيمة المضافة...
      </div>
      <div id="vat-main-content" style="display:none;flex-direction:column;gap:22px;width:100%;max-width:100%;min-width:0;box-sizing:border-box;"></div>
    </div>
  `;

  await loadVatData(body, container, timeFilter, selectedCos);
}

async function loadVatData(body, container, timeFilter, selectedCos) {
  const loadingEl = body.querySelector('#vat-loading');
  const mainContent = body.querySelector('#vat-main-content');
  if (loadingEl) loadingEl.style.display = 'block';
  if (mainContent) mainContent.style.display = 'none';

  try {
    const periodParams = getPeriodParamsFromFilter(timeFilter);
    const companyIdsParam = (selectedCos && selectedCos.length > 0) ? selectedCos.join(',') : undefined;

    const data = await api.getVatReport({
      companyIds: companyIdsParam,
      years: periodParams.years,
      dateFrom: periodParams.dateFrom,
      dateTo: periodParams.dateTo,
      grain: currentGrain
    });

    currentData = data;
    renderVatDashboard(body, container, data, timeFilter, selectedCos);
  } catch (err) {
    console.error('[VAT Page] Error loading VAT data:', err);
    if (loadingEl) {
      loadingEl.innerHTML = `
        <div style="color:var(--status-negative);font-size:1.05rem;padding:30px;">
          حدث خطأ أثناء تحميل بيانات ضريبة القيمة المضافة: ${escapeHtml(err.message)}
        </div>
      `;
    }
  }
}

function renderVatDashboard(body, container, data, timeFilter, selectedCos) {
  const loadingEl = body.querySelector('#vat-loading');
  const mainContent = body.querySelector('#vat-main-content');
  if (loadingEl) loadingEl.style.display = 'none';
  if (!mainContent) return;

  mainContent.style.display = 'flex';
  const cards = data.cards || {};
  const totals = data.totals || {};
  const periodParams = getPeriodParamsFromFilter(timeFilter);
  const periodLabel = formatPresentationPeriodLabel(timeFilter, periodParams);

  mainContent.innerHTML = `
    <!-- Tab Header -->
    <div class="exec-header" style="display:flex;flex-direction:column;gap:4px;margin-bottom:16px;">
      <h1 class="exec-title" style="margin:0;font-size:22px;line-height:32px;font-weight:700;color:var(--text-primary);">
        ضريبة القيمة المضافة — <span>${escapeHtml(periodLabel)}</span>
      </h1>
      <p class="exec-subtitle" style="margin:0;font-size:12px;line-height:18px;color:var(--text-muted);">
        ضريبة المخرجات وضريبة المدخلات وصافي المستحق للهيئة حسب فترات الإقرار
      </p>
    </div>

    <!-- Top 4 KPI Cards (Equal height, exactly 1 Hero Card) -->
    <div class="vat-kpi-grid exec-kpi-grid" style="display:grid;grid-template-columns:repeat(4, 1fr);gap:16px;">
      <!-- Card 1: Output VAT -->
      <div class="bi-kpi bi-kpi-card exec-kpi-card exec-card">
        <span class="bi-kpi-label">ضريبة المخرجات (المبيعات)</span>
        <div class="bi-kpi-value">${fmtVal(cards.output_tax, false)} <span style="font-size:12px;font-weight:500;color:var(--text-muted);">ر.س</span></div>
        <span class="bi-kpi-sub">المبيعات الخاضعة: ${fmtVal(cards.taxable_sales, false, 0)} ر.س</span>
      </div>

      <!-- Card 2: Input VAT -->
      <div class="bi-kpi bi-kpi-card exec-kpi-card exec-card">
        <span class="bi-kpi-label">ضريبة المدخلات (المشتريات)</span>
        <div class="bi-kpi-value">${fmtVal(cards.input_tax, false)} <span style="font-size:12px;font-weight:500;color:var(--text-muted);">ر.س</span></div>
        <span class="bi-kpi-sub">المشتريات الخاضعة: ${fmtVal(cards.taxable_purchases, false, 0)} ر.س</span>
      </div>

      <!-- Card 3: Net Tax Due (HERO Card) -->
      <div class="bi-kpi bi-kpi-card hero exec-kpi-card exec-card">
        <span class="bi-kpi-label">صافي الضريبة المستحقة للفترة</span>
        <div class="bi-kpi-value">${fmtVal(cards.net_tax_due, false)} <span style="font-size:12px;font-weight:500;opacity:0.85;">ر.س</span></div>
        <span class="bi-kpi-sub">${cards.last_completed_period ? `آخر فترة إقرار مكتملة: ${escapeHtml(cards.last_completed_period)}` : 'المخرجات − المدخلات'}</span>
      </div>

      <!-- Card 4: Ledger Balance -->
      <div class="bi-kpi bi-kpi-card exec-kpi-card exec-card">
        <span class="bi-kpi-label">رصيد حسابات الضريبة الدفتري</span>
        <div class="bi-kpi-value">${fmtVal(cards.ledger_balance, false)} <span style="font-size:12px;font-weight:500;color:var(--text-muted);">ر.س</span></div>
        <span class="bi-kpi-sub">التسويات والسداد: ${fmtVal(cards.settlements, false, 0)} ر.س</span>
      </div>
    </div>

    <!-- Methodology Note -->
    <div style="display:flex;align-items:center;gap:8px;padding:10px 16px;background:var(--bg-subtle);border-right:3px solid var(--brand-accent);border-radius:8px;font-size:12px;color:var(--text-secondary);">
      <span>الفترات محسوبة طبقاً لتاريخ القيد المحاسبي، والقيود المرحّلة فقط. أسطر الضريبة مستخرجة مباشرة من ربط القيود بضرائب أودو.</span>
    </div>

    <!-- TreeTable Card with Integrated Header -->
    <div class="exec-table-card" style="background:var(--bg-surface);border:1px solid var(--border-default);border-radius:14px;display:flex;flex-direction:column;width:100%;box-sizing:border-box;">
      <div class="exec-table-toolbar" style="padding:16px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border-default);flex-wrap:wrap;gap:14px;">
        <div class="exec-table-titles" style="display:flex;flex-direction:column;gap:2px;">
          <h3 class="exec-table-title" style="margin:0;font-size:17px;line-height:26px;font-weight:700;color:var(--text-primary);">
            ضريبة القيمة المضافة حسب الشركة والفترة — ${escapeHtml(periodLabel)}
          </h3>
          <span class="exec-table-breadcrumb" style="font-size:12px;line-height:18px;color:var(--text-muted);">
            الشركة ← السنة ← الربع ← الشهر
          </span>
        </div>

        <div class="exec-table-actions" style="display:flex;align-items:center;flex-wrap:wrap;gap:10px;">
          <!-- Grain Toggle -->
          <div style="display:inline-flex;align-items:center;gap:6px;">
            <span style="font-size:12px;color:var(--text-muted);font-weight:600;">مفتاح العرض:</span>
            <div class="bi-btn-group" style="display:inline-flex;background:var(--bg-subtle);padding:3px;border-radius:10px;border:1px solid var(--border-default);">
              <button type="button" class="vat-grain-btn bi-btn-item ${currentGrain === 'vat_period' ? 'active' : ''}" data-grain="vat_period"
                style="padding:5px 12px;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;transition:all 0.15s;${currentGrain === 'vat_period' ? 'background:var(--brand-primary);color:var(--text-on-brand);' : 'background:transparent;color:var(--text-secondary);'}">
                حسب دورية الإقرار
              </button>
              <button type="button" class="vat-grain-btn bi-btn-item ${currentGrain === 'quarter' ? 'active' : ''}" data-grain="quarter"
                style="padding:5px 12px;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;transition:all 0.15s;${currentGrain === 'quarter' ? 'background:var(--brand-primary);color:var(--text-on-brand);' : 'background:transparent;color:var(--text-secondary);'}">
                ربعي
              </button>
              <button type="button" class="vat-grain-btn bi-btn-item ${currentGrain === 'month' ? 'active' : ''}" data-grain="month"
                style="padding:5px 12px;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;transition:all 0.15s;${currentGrain === 'month' ? 'background:var(--brand-primary);color:var(--text-on-brand);' : 'background:transparent;color:var(--text-secondary);'}">
                شهري
              </button>
              <button type="button" class="vat-grain-btn bi-btn-item ${currentGrain === 'year' ? 'active' : ''}" data-grain="year"
                style="padding:5px 12px;border:none;border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;transition:all 0.15s;${currentGrain === 'year' ? 'background:var(--brand-primary);color:var(--text-on-brand);' : 'background:transparent;color:var(--text-secondary);'}">
                سنوي
              </button>
            </div>
          </div>

          <!-- Search filter input -->
          <div class="exec-search-wrap" style="position:relative;display:inline-flex;align-items:center;min-width:180px;">
            <input type="text" id="vat-search-input" class="exec-search-input" value="${escapeHtml(currentSearchQuery)}" placeholder="بحث…"
              style="width:180px;padding:6px 12px 6px 30px;background:var(--bg-subtle);border:1px solid var(--border-default);border-radius:8px;color:var(--text-primary);font-size:12px;outline:none;" />
            <button id="btn-vat-clear-search" type="button" style="display:none;position:absolute;left:8px;background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:12px;padding:0;">✕</button>
            <span class="exec-search-icon" style="position:absolute;left:8px;pointer-events:none;color:var(--text-muted);display:inline-flex;align-items:center;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </span>
          </div>
          <span id="vat-search-counter" style="display:none;font-size:12px;color:var(--text-muted);font-weight:600;"></span>

          <!-- Expand / Collapse / Export -->
          <button type="button" id="vat-expand-all-btn" class="exec-btn-tool" title="توسيع الكل">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg>
            <span>توسيع الكل</span>
          </button>
          <button type="button" id="vat-collapse-all-btn" class="exec-btn-tool" title="طي الكل">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/></svg>
            <span>طي الكل</span>
          </button>
          <button type="button" id="vat-export-excel" class="exec-btn-tool" title="تصدير Excel">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <span>تصدير Excel</span>
          </button>
        </div>
      </div>

      <!-- TreeTable Container -->
      <div id="vat-tree-container" class="vat-treetable-container tree-table-wrap" data-scroll-x="true" style="overflow-x:auto;width:100%;max-width:100%;min-width:0;box-sizing:border-box;"></div>
    </div>

    <!-- Slide-over Drawer for Details -->
    <div id="vat-drawer-backdrop" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9998;backdrop-filter:blur(2px);transition:opacity 0.2s;"></div>
    <div id="vat-drawer" style="position:fixed;top:0;left:0;bottom:0;width:min(720px, 92vw);background:var(--bg-surface);box-shadow:4px 0 24px rgba(0,0,0,0.5);z-index:9999;transform:translateX(-100%);transition:transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);display:flex;flex-direction:column;border-right:1px solid var(--border-default);">
      <div id="vat-drawer-content" style="display:flex;flex-direction:column;height:100%;"></div>
    </div>
  `;

  // Attach Toolbar Events
  attachToolbarEvents(body, container, timeFilter, selectedCos);

  // Render Hierarchical TreeTable
  renderVatTreeTable(body, data);
}

function attachToolbarEvents(body, container, timeFilter, selectedCos) {
  // Grain buttons
  body.querySelectorAll('.vat-grain-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const g = e.currentTarget.getAttribute('data-grain');
      if (g && g !== currentGrain) {
        currentGrain = g;
        applyGrainExpansion(g);
        body.querySelectorAll('.vat-grain-btn').forEach(b => {
          const isActive = b.getAttribute('data-grain') === currentGrain;
          b.classList.toggle('active', isActive);
          b.style.background = isActive ? 'var(--brand-primary)' : 'transparent';
          b.style.color = isActive ? 'var(--text-on-brand)' : 'var(--text-secondary)';
        });
      }
    });
  });

  // Expand / Collapse all
  body.querySelector('#vat-expand-all-btn')?.addEventListener('click', () => {
    if (currentTreeTable) currentTreeTable.expandAll();
  });
  body.querySelector('#vat-collapse-all-btn')?.addEventListener('click', () => {
    if (currentTreeTable) currentTreeTable.collapseAll();
  });

  // Export to Excel
  body.querySelector('#vat-export-excel')?.addEventListener('click', () => {
    exportVatToExcel();
  });

  // Drawer Backdrop click
  body.querySelector('#vat-drawer-backdrop')?.addEventListener('click', () => {
    closeVatDrawer(body);
  });
}

function renderVatTreeTable(body, data) {
  const container = body.querySelector('#vat-tree-container') || body.querySelector('#vat-treetable-container');
  if (!container) return;

  const rawTree = data.tree || [];
  const totals = data.totals || {};

  function renderVatVisual(node) {
    const outTax = Math.max(0, node.output_tax || 0);
    const inTax = Math.max(0, node.input_tax || 0);
    const total = outTax + inTax;
    if (total <= 0) return '—';
    const pOut = (outTax / total * 100).toFixed(1);
    const pIn = (inTax / total * 100).toFixed(1);
    const tip = `ضريبة المخرجات: ${Math.round(outTax).toLocaleString('en-US')} (${pOut}%)\nضريبة المدخلات: ${Math.round(inTax).toLocaleString('en-US')} (${pIn}%)`;
    return `
      <div title="${escapeHtml(tip)}" style="display:flex;flex-direction:column;gap:3px;width:100%;min-width:60px;max-width:110px;margin:0 auto;cursor:help;padding:2px 2px;">
        <div style="display:flex;width:100%;height:6px;background:var(--border-default);border-radius:999px;overflow:hidden;">
          <div style="width:${pOut}%;background:var(--brand-accent);height:100%;"></div>
          <div style="width:${pIn}%;background:var(--status-positive);height:100%;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);padding:0 1px;">
          <span style="color:var(--brand-accent);">مخرجات <span dir="ltr" class="tabular-nums">${pOut}%</span></span>
          <span style="color:var(--status-positive);">مدخلات <span dir="ltr" class="tabular-nums">${pIn}%</span></span>
        </div>
      </div>
    `;
  }

  const columns = [
    { id: 'name', key: 'name', label: 'البيان / الفترة', width: '24%', minWidth: '120px', priority: 1 },
    { id: 'taxable_sales', key: 'taxable_sales', label: 'المبيعات الخاضعة', width: '10%', minWidth: '60px', priority: 2 },
    { id: 'output_tax', key: 'output_tax', label: 'ضريبة المخرجات', width: '10%', minWidth: '60px', priority: 1 },
    { id: 'taxable_purchases', key: 'taxable_purchases', label: 'المشتريات الخاضعة', width: '10%', minWidth: '60px', priority: 2 },
    { id: 'input_tax', key: 'input_tax', label: 'ضريبة المدخلات', width: '10%', minWidth: '60px', priority: 1 },
    { id: 'net_tax_due', key: 'net_tax_due', label: 'صافي الضريبة', width: '10%', minWidth: '60px', priority: 1 },
    { id: 'settlements', key: 'settlements', label: 'التسويات والسداد', width: '9%', minWidth: '55px', priority: 2 },
    { id: 'vat_visual', key: 'vat_visual', label: 'المخرجات والمدخلات', width: '13%', minWidth: '65px', align: 'center', priority: 1 },
    { id: 'actions', key: 'actions', label: '', width: '4%', minWidth: '32px', maxWidth: '36px', priority: 1 }
  ];

  currentTreeTable = createTreeTable(container, {
    storageKey: 'mizaniat_vat_tree',
    tableLayout: 'fixed',
    columns,
    data: rawTree,
    totals,
    showZeroItems: store.get('showZeroItems') ?? false,
    getChildren: (node) => node.children || [],
    hasChildren: (node) => !!(node.children && node.children.length > 0),
    getNodeKey: (node, parentPath, depth) => {
      if (node.type === 'company' || depth === 0) {
        const cid = node.company_id || (node.id && String(node.id).replace('co_', '')) || node.id;
        return `co:${cid}`;
      }
      if (node.type === 'year') {
        const yVal = node.year || node.period_key || (node.id && String(node.id).split('_').pop());
        return `${parentPath}/year:${yVal}`;
      }
      if (node.type === 'quarter') {
        const qVal = node.period_key || node.quarter || (node.id && String(node.id).split('_').pop());
        return `${parentPath}/quarter:${qVal}`;
      }
      if (node.type === 'month') {
        const mVal = node.period_key || node.month || (node.id && String(node.id).split('_').pop());
        return `${parentPath}/month:${mVal}`;
      }
      return parentPath ? `${parentPath}/${node.type || 'node'}:${node.id}` : `${node.type || 'node'}:${node.id}`;
    },
    renderRow: ({ node, pathKey, depth, isExpanded, hasKids, isLeaf }) => {
      let badge = '';
      let nameStyle = 'font-weight:400;color:var(--text-secondary);font-size:13px;';

      if (node.type === 'company') {
        nameStyle = 'font-weight:700;color:var(--text-primary);font-size:14px;';
        const isMonthly = node.vat_period === 'monthly';
        badge = `
          <span style="font-size:11px;padding:2px 8px;border-radius:6px;font-weight:600;margin-right:6px;${isMonthly ? 'background:var(--status-warning-subtle, rgba(245,158,11,0.15));color:var(--status-warning, #f59e0b);border:1px solid var(--border-default);' : 'background:var(--brand-accent-subtle);color:var(--brand-accent);border:1px solid var(--border-default);'}">
            ${isMonthly ? 'إقرار شهري' : 'إقرار ربعي'}
          </span>
        `;
      } else if (node.type === 'year') {
        nameStyle = 'font-weight:600;color:var(--text-primary);font-size:13px;';
      } else if (node.type === 'quarter') {
        nameStyle = 'font-weight:500;color:var(--brand-accent);font-size:13px;';
      } else if (node.type === 'month') {
        nameStyle = 'color:var(--text-secondary);font-size:13px;';
      }

      const netDueColor = node.net_tax_due > 0 ? 'var(--text-primary)' : (node.net_tax_due < 0 ? 'var(--status-positive)' : 'var(--text-muted)');

      const actionBtn = (node.type === 'month' || node.type === 'quarter') ? `
        <button type="button" class="vat-detail-btn exec-btn-icon" data-cid="${node.company_id}" data-period="${escapeHtml(node.period_key || node.month || node.quarter)}" title="عرض تفاصيل الفترة"
          style="width:28px;height:26px;display:inline-flex;align-items:center;justify-content:center;border-radius:6px;background:var(--brand-accent-subtle);border:1px solid var(--border-default);color:var(--brand-accent);cursor:pointer;padding:0;">
          ${ICONS.fileText}
        </button>
      ` : '';

      const indent = depth * 22;
      const toggleChevron = hasKids ? (isExpanded ? ICONS.chevronDown : ICONS.chevronLeft) : '<span style="display:inline-block;width:14px;text-align:center;">•</span>';
      const cursor = hasKids ? 'cursor:pointer;' : '';
      const rowBg = node.type === 'company'
        ? 'font-weight:700;'
        : (node.type === 'year' ? 'font-weight:600;' : '');

      let nameContent = '';
      if (node.type === 'company') {
        const coId = node.company_id || (node.id && String(node.id).replace('co_', '')) || 1;
        nameContent = `
          <div class="tree-name-cell" style="display:inline-flex;align-items:center;gap:6px;flex-wrap:nowrap;max-width:100%;">
            <span data-tree-toggle="true" style="display:inline-flex;align-items:center;justify-content:center;width:16px;color:var(--text-muted);flex-shrink:0;">${toggleChevron}</span>
            <span class="company-dot" style="background:var(--company-${coId});width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0;"></span>
            <span data-tree-name="true" title="${escapeHtml(node.name)}" class="tree-node-name" style="${nameStyle}white-space:normal;word-break:break-word;">${escapeHtml(node.name)}</span>
            ${badge}
          </div>
        `;
      } else {
        nameContent = `
          <div class="tree-name-cell" style="display:inline-flex;align-items:center;gap:6px;flex-wrap:nowrap;max-width:100%;">
            <span data-tree-toggle="true" style="display:inline-flex;align-items:center;justify-content:center;width:16px;color:var(--text-muted);flex-shrink:0;">${toggleChevron}</span>
            <span data-tree-name="true" title="${escapeHtml(node.name)}" class="tree-node-name" style="${nameStyle}white-space:normal;word-break:break-word;">${escapeHtml(node.name)}</span>
          </div>
        `;
      }

      return `
        <tr data-tree-row="true" data-path-key="${escapeHtml(pathKey)}" style="${cursor} ${rowBg}">
          <td class="tree-col-name" data-col-id="name" data-priority="1" style="padding:10px 12px;padding-right:${indent + 12}px;">
            ${nameContent}
          </td>
          <td class="tree-col-num" data-col-id="taxable_sales" data-priority="2" style="padding:10px 12px;text-align:right;">${fmtVal(node.taxable_sales)}</td>
          <td class="tree-col-num" data-col-id="output_tax" data-priority="1" style="padding:10px 12px;text-align:right;">${fmtVal(node.output_tax)}</td>
          <td class="tree-col-num" data-col-id="taxable_purchases" data-priority="2" style="padding:10px 12px;text-align:right;">${fmtVal(node.taxable_purchases)}</td>
          <td class="tree-col-num" data-col-id="input_tax" data-priority="1" style="padding:10px 12px;text-align:right;">${fmtVal(node.input_tax)}</td>
          <td class="tree-col-num" data-col-id="net_tax_due" data-priority="1" style="padding:10px 12px;text-align:right;font-weight:700;color:${netDueColor};">${fmtVal(node.net_tax_due)}</td>
          <td class="tree-col-num" data-col-id="settlements" data-priority="2" style="padding:10px 12px;text-align:right;">${fmtVal(node.settlements)}</td>
          <td class="tree-col-visual" data-col-id="vat_visual" data-priority="1" style="text-align:center;padding:10px 12px;">
            ${renderVatVisual(node)}
          </td>
          <td class="tree-col-action" data-col-id="actions" data-priority="1" style="text-align:center;width:36px;min-width:32px;max-width:36px;padding:4px 2px;">
            ${actionBtn}
          </td>
        </tr>
      `;
    },
    renderTotals: (tot) => {
      const netDue = (tot.output_tax || 0) - (tot.input_tax || 0);
      return `
        <tr class="exec-totals-row" style="background:var(--bg-subtle);font-weight:700;border-top:1px solid var(--border-default);">
          <td class="tree-col-name" data-col-id="name" data-priority="1" style="padding:12px 14px;font-size:13px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            المجموع الكلي العام
          </td>
          <td class="tree-col-num" data-col-id="taxable_sales" data-priority="2" style="padding:12px 14px;text-align:right;">${fmtVal(tot.taxable_sales, false)}</td>
          <td class="tree-col-num" data-col-id="output_tax" data-priority="1" style="padding:12px 14px;text-align:right;">${fmtVal(tot.output_tax, false)}</td>
          <td class="tree-col-num" data-col-id="taxable_purchases" data-priority="2" style="padding:12px 14px;text-align:right;">${fmtVal(tot.taxable_purchases, false)}</td>
          <td class="tree-col-num" data-col-id="input_tax" data-priority="1" style="padding:12px 14px;text-align:right;">${fmtVal(tot.input_tax, false)}</td>
          <td class="tree-col-num" data-col-id="net_tax_due" data-priority="1" style="padding:12px 14px;text-align:right;font-size:13px;font-weight:700;color:var(--brand-accent);">${fmtVal(netDue, false)}</td>
          <td class="tree-col-num" data-col-id="settlements" data-priority="2" style="padding:12px 14px;text-align:right;">${fmtVal(tot.settlements, false)}</td>
          <td class="tree-col-visual" data-col-id="vat_visual" data-priority="1" style="text-align:center;padding:12px 14px;">
            ${renderVatVisual(tot)}
          </td>
          <td class="tree-col-action" data-col-id="actions" data-priority="1" style="width:36px;min-width:32px;max-width:36px;padding:4px 2px;"></td>
        </tr>
      `;
    }
  });

  // Attach click listener for detail buttons
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.vat-detail-btn');
    if (btn) {
      e.stopPropagation();
      const coId = parseInt(btn.getAttribute('data-cid'), 10);
      const periodKey = btn.getAttribute('data-period');
      openVatDrawer(body, coId, periodKey);
    }
  });

  // Wire TreeTable Search (F1-ج2)
  const searchInput = body.querySelector('#vat-search-input');
  const clearBtnEl = body.querySelector('#btn-vat-clear-search');
  const counterEl = body.querySelector('#vat-search-counter');
  if (searchInput && currentTreeTable && currentTreeTable.bindSearchInput) {
    currentTreeTable.bindSearchInput(searchInput, {
      clearBtnEl,
      counterEl
    });
  }
}

function applyGrainExpansion(grain) {
  if (!currentTreeTable || !currentData) return;

  if (grain === 'year') {
    // Expand only company level
    currentTreeTable.collapseAll();
    currentData.tree.forEach(co => {
      const cid = co.company_id || (co.id && String(co.id).replace('co_', '')) || co.id;
      currentTreeTable.expandPath(`co:${cid}`);
    });
  } else if (grain === 'quarter') {
    // Expand company and year levels
    currentTreeTable.collapseAll();
    currentData.tree.forEach(co => {
      const cid = co.company_id || (co.id && String(co.id).replace('co_', '')) || co.id;
      const coKey = `co:${cid}`;
      currentTreeTable.expandPath(coKey);
      (co.children || []).forEach(y => {
        const yVal = y.year || y.period_key || (y.id && String(y.id).split('_').pop());
        currentTreeTable.expandPath(`${coKey}/year:${yVal}`);
      });
    });
  } else if (grain === 'month') {
    // Expand all levels down to months
    currentTreeTable.expandAll();
  } else if (grain === 'vat_period') {
    // Expand based on company vat_period:
    // Company 2 (monthly) down to months, other companies down to quarters
    currentTreeTable.collapseAll();
    currentData.tree.forEach(co => {
      const cid = co.company_id || (co.id && String(co.id).replace('co_', '')) || co.id;
      const coKey = `co:${cid}`;
      currentTreeTable.expandPath(coKey);
      (co.children || []).forEach(y => {
        const yVal = y.year || y.period_key || (y.id && String(y.id).split('_').pop());
        const yKey = `${coKey}/year:${yVal}`;
        currentTreeTable.expandPath(yKey);
        if (co.vat_period === 'monthly') {
          (y.children || []).forEach(q => {
            const qVal = q.period_key || q.quarter || (q.id && String(q.id).split('_').pop());
            currentTreeTable.expandPath(`${yKey}/quarter:${qVal}`);
          });
        }
      });
    });
  }
}

async function openVatDrawer(body, companyId, periodKey) {
  const backdrop = body.querySelector('#vat-drawer-backdrop');
  const drawer = body.querySelector('#vat-drawer');
  const drawerContent = body.querySelector('#vat-drawer-content');
  if (!drawer || !drawerContent) return;

  backdrop.style.display = 'block';
  drawer.style.transform = 'translateX(0)';

  drawerContent.innerHTML = `
    <div style="padding:20px 24px;border-bottom:1px solid var(--border-default);display:flex;justify-content:space-between;align-items:center;background:var(--bg-surface);">
      <div>
        <h3 style="margin:0;font-size:16px;font-weight:700;color:var(--text-primary);">
          تفاصيل الإقرار الضريبي — ${escapeHtml(periodKey)}
        </h3>
        <span style="font-size:12px;color:var(--text-muted);">جاري جلب تفاصيل العمليات والمستندات...</span>
      </div>
      <button type="button" id="vat-drawer-close-btn" style="background:transparent;border:none;color:var(--text-muted);font-size:18px;cursor:pointer;padding:4px 8px;border-radius:6px;">✕</button>
    </div>
    <div style="text-align:center;padding:60px 20px;color:var(--text-muted);">
      <span style="display:inline-block;vertical-align:middle;margin-left:8px;">${ICONS.spinner}</span>
      <div style="margin-top:10px;font-size:13px;">جاري تحميل التفاصيل...</div>
    </div>
  `;

  drawerContent.querySelector('#vat-drawer-close-btn')?.addEventListener('click', () => {
    closeVatDrawer(body);
  });

  try {
    const details = await api.getVatDetails({ companyId, period: periodKey });
    renderDrawerDetails(body, drawerContent, details, periodKey);
  } catch (err) {
    console.error('[VAT Drawer] Error:', err);
    drawerContent.innerHTML = `
      <div style="padding:20px 24px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border-default);background:var(--bg-surface);">
        <h3 style="margin:0;color:var(--status-negative);font-size:15px;font-weight:700;">خطأ في جلب التفاصيل</h3>
        <button type="button" id="vat-drawer-close-btn-err" style="background:transparent;border:none;color:var(--text-primary);font-size:18px;cursor:pointer;">✕</button>
      </div>
      <div style="padding:30px;color:var(--status-negative);font-size:13px;">
        ${escapeHtml(err.message)}
      </div>
    `;
    drawerContent.querySelector('#vat-drawer-close-btn-err')?.addEventListener('click', () => {
      closeVatDrawer(body);
    });
  }
}

function closeVatDrawer(body) {
  const backdrop = body.querySelector('#vat-drawer-backdrop');
  const drawer = body.querySelector('#vat-drawer');
  if (backdrop) backdrop.style.display = 'none';
  if (drawer) drawer.style.transform = 'translateX(-100%)';
}

function renderDrawerDetails(body, drawerContent, details, periodKey) {
  const summary = details.summary || {};
  const byTaxType = details.by_tax_type || [];
  const documents = details.documents || [];
  const settlementMoves = details.settlement_moves || [];

  drawerContent.innerHTML = `
    <!-- Drawer Header -->
    <div style="padding:18px 24px;border-bottom:1px solid var(--border-default);display:flex;justify-content:space-between;align-items:center;background:var(--bg-surface);">
      <div>
        <h3 style="margin:0;font-size:16px;font-weight:700;color:var(--text-primary);">
          تفاصيل ضريبة القيمة المضافة — ${escapeHtml(periodKey)}
        </h3>
        <span style="font-size:12px;color:var(--text-muted);">
          الفترة من ${escapeHtml(details.date_from)} إلى ${escapeHtml(details.date_to)}
        </span>
      </div>
      <button type="button" id="vat-drawer-close-btn" style="background:transparent;border:none;color:var(--text-muted);font-size:18px;cursor:pointer;padding:4px 8px;border-radius:6px;">✕</button>
    </div>

    <!-- Drawer Tabs -->
    <div style="display:flex;gap:6px;padding:10px 24px;background:var(--bg-subtle);border-bottom:1px solid var(--border-default);">
      <button type="button" class="drawer-tab-btn active" data-tab="summary" style="padding:6px 14px;border:none;border-radius:8px;background:var(--brand-primary);color:var(--text-on-brand);font-size:12px;font-weight:600;cursor:pointer;">
        ملخص الإقرار
      </button>
      <button type="button" class="drawer-tab-btn" data-tab="by_tax" style="padding:6px 14px;border:none;border-radius:8px;background:transparent;color:var(--text-secondary);font-size:12px;font-weight:600;cursor:pointer;">
        حسب نوع الضريبة (${byTaxType.length})
      </button>
      <button type="button" class="drawer-tab-btn" data-tab="documents" style="padding:6px 14px;border:none;border-radius:8px;background:transparent;color:var(--text-secondary);font-size:12px;font-weight:600;cursor:pointer;">
        المستندات (${documents.length})
      </button>
      <button type="button" class="drawer-tab-btn" data-tab="settlements" style="padding:6px 14px;border:none;border-radius:8px;background:transparent;color:var(--text-secondary);font-size:12px;font-weight:600;cursor:pointer;">
        التسويات (${settlementMoves.length})
      </button>
    </div>

    <!-- Drawer Body -->
    <div style="flex:1;overflow-y:auto;padding:20px 24px;display:flex;flex-direction:column;gap:18px;">
      
      <!-- TAB 1: SUMMARY -->
      <div id="dtab-summary" class="drawer-pane" style="display:flex;flex-direction:column;gap:16px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
          <!-- Sales Box -->
          <div style="background:var(--bg-surface);border:1px solid var(--border-default);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:8px;">
            <div style="font-weight:700;color:var(--brand-accent);font-size:14px;display:flex;justify-content:space-between;">
              <span>المبيعات والمخرجات</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text-secondary);">
              <span>فواتير المبيعات:</span>
              <span style="font-weight:600;color:var(--text-primary);">${fmtVal(summary.output_invoices)} ر.س</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text-secondary);">
              <span>مرتجعات المبيعات:</span>
              <span style="font-weight:600;color:var(--status-negative);">${fmtVal(summary.output_refunds)} ر.س</span>
            </div>
            <div style="height:1px;background:var(--border-default);margin:4px 0;"></div>
            <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;color:var(--brand-accent);">
              <span>صافي ضريبة المخرجات:</span>
              <span>${fmtVal(summary.output_tax)} ر.س</span>
            </div>
            <div style="font-size:11px;color:var(--text-muted);">
              أساس المبيعات الخاضعة: ${fmtVal(summary.taxable_sales, false, 0)} ر.س
            </div>
          </div>

          <!-- Purchases Box -->
          <div style="background:var(--bg-surface);border:1px solid var(--border-default);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:8px;">
            <div style="font-weight:700;color:var(--status-positive);font-size:14px;display:flex;justify-content:space-between;">
              <span>المشتريات والمدخلات</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text-secondary);">
              <span>فواتير الشراء:</span>
              <span style="font-weight:600;color:var(--text-primary);">${fmtVal(summary.input_bills)} ر.س</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:13px;color:var(--text-secondary);">
              <span>مرتجعات الشراء:</span>
              <span style="font-weight:600;color:var(--status-negative);">${fmtVal(summary.input_refunds)} ر.س</span>
            </div>
            <div style="height:1px;background:var(--border-default);margin:4px 0;"></div>
            <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:700;color:var(--status-positive);">
              <span>صافي ضريبة المدخلات:</span>
              <span>${fmtVal(summary.input_tax)} ر.س</span>
            </div>
            <div style="font-size:11px;color:var(--text-muted);">
              أساس المشتريات الخاضعة: ${fmtVal(summary.taxable_purchases, false, 0)} ر.س
            </div>
          </div>
        </div>

        <!-- Net Box -->
        <div style="background:var(--bg-surface);border:1px solid var(--border-default);border-radius:12px;padding:18px;display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:700;font-size:14px;color:var(--text-primary);">صافي الضريبة المستحقة للإقرار:</span>
            <span style="font-size:18px;font-weight:800;color:var(--brand-accent);">${fmtVal(summary.net_tax_due)} ر.س</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding-top:10px;border-top:1px solid var(--border-default);font-size:13px;color:var(--text-secondary);">
            <span>التسويات وسداد الهيئة في الفترة:</span>
            <span style="font-weight:700;color:var(--text-primary);">${fmtVal(summary.settlements)} ر.س</span>
          </div>
        </div>
      </div>

      <!-- TAB 2: BY TAX TYPE -->
      <div id="dtab-by_tax" class="drawer-pane" style="display:none;flex-direction:column;gap:12px;">
        <table class="bi-table" style="width:100%;border-collapse:collapse;font-size:13px;text-align:right;">
          <thead>
            <tr style="border-bottom:1px solid var(--border-default);color:var(--text-muted);background:var(--bg-subtle);">
              <th style="padding:10px 12px;font-size:12px;font-weight:500;">اسم الضريبة</th>
              <th style="padding:10px 12px;font-size:12px;font-weight:500;">النوع</th>
              <th style="padding:10px 12px;font-size:12px;font-weight:500;">النسبة</th>
              <th style="padding:10px 12px;font-size:12px;font-weight:500;text-align:right;">الأساس الخاضع</th>
              <th style="padding:10px 12px;font-size:12px;font-weight:500;text-align:right;">مبلغ الضريبة</th>
              <th style="padding:10px 12px;font-size:12px;font-weight:500;text-align:center;">السجلات</th>
            </tr>
          </thead>
          <tbody>
            ${byTaxType.length === 0 ? `
              <tr><td colspan="6" style="padding:30px;text-align:center;color:var(--text-muted);">لا توجد ضرائب مستخدمة في هذه الفترة</td></tr>
            ` : byTaxType.map(t => {
              const isSale = t.type_tax_use === 'sale';
              return `
                <tr style="border-bottom:1px solid var(--border-default);">
                  <td style="padding:10px 12px;font-weight:600;color:var(--text-primary);">${escapeHtml(t.name || t.tax_name)}</td>
                  <td style="padding:10px 12px;">
                    <span style="padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;${isSale ? 'background:var(--brand-accent-subtle);color:var(--brand-accent);' : 'background:var(--status-positive-subtle);color:var(--status-positive);'}">
                      ${isSale ? 'مبيعات' : 'مشتريات'}
                    </span>
                  </td>
                  <td style="padding:10px 12px;font-family:var(--font-en);">${t.rate}%</td>
                  <td style="padding:10px 12px;text-align:right;">${fmtVal(t.base_amount)}</td>
                  <td style="padding:10px 12px;text-align:right;font-weight:600;">${fmtVal(t.tax_amount)}</td>
                  <td style="padding:10px 12px;text-align:center;font-family:var(--font-en);">${t.count}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- TAB 3: DOCUMENTS -->
      <div id="dtab-documents" class="drawer-pane" style="display:none;flex-direction:column;gap:12px;">
        <table class="bi-table" style="width:100%;border-collapse:collapse;font-size:13px;text-align:right;">
          <thead>
            <tr style="border-bottom:1px solid var(--border-default);color:var(--text-muted);background:var(--bg-subtle);">
              <th style="padding:10px 10px;font-size:12px;font-weight:500;">الرقم</th>
              <th style="padding:10px 10px;font-size:12px;font-weight:500;">الطرف</th>
              <th style="padding:10px 10px;font-size:12px;font-weight:500;">التاريخ</th>
              <th style="padding:10px 10px;font-size:12px;font-weight:500;text-align:right;">الأساس</th>
              <th style="padding:10px 10px;font-size:12px;font-weight:500;text-align:right;">الضريبة</th>
              <th style="padding:10px 10px;font-size:12px;font-weight:500;">النوع</th>
            </tr>
          </thead>
          <tbody>
            ${documents.length === 0 ? `
              <tr><td colspan="6" style="padding:30px;text-align:center;color:var(--text-muted);">لا توجد مستندات مسجلة</td></tr>
            ` : documents.map(d => {
              const isSale = d.tax_role === 'vat_output';
              return `
                <tr style="border-bottom:1px solid var(--border-default);">
                  <td style="padding:10px 10px;font-weight:600;color:var(--text-primary);font-family:var(--font-en);">${escapeHtml(d.move_name)}</td>
                  <td style="padding:10px 10px;color:var(--text-secondary);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(d.partner_name)}">
                    ${escapeHtml(d.partner_name || '—')}
                  </td>
                  <td style="padding:10px 10px;color:var(--text-muted);font-family:var(--font-en);">${escapeHtml(d.date)}</td>
                  <td style="padding:10px 10px;text-align:right;">${fmtVal(d.tax_base_amount)}</td>
                  <td style="padding:10px 10px;text-align:right;font-weight:600;">${fmtVal(d.tax_amount)}</td>
                  <td style="padding:10px 10px;">
                    <span style="padding:2px 8px;border-radius:6px;font-size:11px;font-weight:600;${d.is_refund ? 'background:var(--status-negative-subtle);color:var(--status-negative);' : (isSale ? 'background:var(--brand-accent-subtle);color:var(--brand-accent);' : 'background:var(--status-positive-subtle);color:var(--status-positive);')}">
                      ${d.is_refund ? 'مرتجع' : (isSale ? 'فاتورة' : 'شراء')}
                    </span>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- TAB 4: SETTLEMENTS -->
      <div id="dtab-settlements" class="drawer-pane" style="display:none;flex-direction:column;gap:12px;">
        <table class="bi-table" style="width:100%;border-collapse:collapse;font-size:13px;text-align:right;">
          <thead>
            <tr style="border-bottom:1px solid var(--border-default);color:var(--text-muted);background:var(--bg-subtle);">
              <th style="padding:10px 10px;font-size:12px;font-weight:500;">رقم القيد</th>
              <th style="padding:10px 10px;font-size:12px;font-weight:500;">التاريخ</th>
              <th style="padding:10px 10px;font-size:12px;font-weight:500;">البيان</th>
              <th style="padding:10px 10px;font-size:12px;font-weight:500;text-align:right;">مدين</th>
              <th style="padding:10px 10px;font-size:12px;font-weight:500;text-align:right;">دائن</th>
              <th style="padding:10px 10px;font-size:12px;font-weight:500;">الحساب</th>
            </tr>
          </thead>
          <tbody>
            ${settlementMoves.length === 0 ? `
              <tr><td colspan="6" style="padding:30px;text-align:center;color:var(--text-muted);">لا توجد قيود تسوية مسجلة لهذه الفترة</td></tr>
            ` : settlementMoves.map(s => `
              <tr style="border-bottom:1px solid var(--border-default);">
                <td style="padding:10px 10px;font-weight:600;color:var(--text-primary);font-family:var(--font-en);">${escapeHtml(s.move_name)}</td>
                <td style="padding:10px 10px;color:var(--text-muted);font-family:var(--font-en);">${escapeHtml(s.date)}</td>
                <td style="padding:10px 10px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-secondary);" title="${escapeHtml(s.label)}">
                  ${escapeHtml(s.label || '—')}
                </td>
                <td style="padding:10px 10px;text-align:right;">${fmtVal(s.debit)}</td>
                <td style="padding:10px 10px;text-align:right;">${fmtVal(s.credit)}</td>
                <td style="padding:10px 10px;font-size:12px;color:var(--text-muted);font-family:var(--font-en);">${escapeHtml(s.account_code)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

    </div>
  `;

  // Attach drawer tab switching
  drawerContent.querySelectorAll('.drawer-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetTab = e.currentTarget.getAttribute('data-tab');
      drawerContent.querySelectorAll('.drawer-tab-btn').forEach(b => {
        const isActive = b.getAttribute('data-tab') === targetTab;
        b.classList.toggle('active', isActive);
        b.style.background = isActive ? 'var(--brand-primary)' : 'transparent';
        b.style.color = isActive ? 'var(--text-on-brand)' : 'var(--text-secondary)';
      });
      drawerContent.querySelectorAll('.drawer-pane').forEach(p => {
        p.style.display = p.id === `dtab-${targetTab}` ? 'flex' : 'none';
      });
    });
  });

  drawerContent.querySelector('#vat-drawer-close-btn')?.addEventListener('click', () => {
    closeVatDrawer(body);
  });
}

function exportVatToExcel() {
  if (!currentData || !currentData.tree) return;
  const showZeros = store.get('showZeroItems') ?? false;

  const rows = [];
  rows.push(['الشركة / الفترة', 'النوع', 'المبيعات الخاضعة', 'ضريبة المخرجات', 'المشتريات الخاضعة', 'ضريبة المدخلات', 'صافي الضريبة المستحقة', 'التسويات والسداد']);

  function isSubtreeZero(node) {
    const isZero = (Math.abs(node.taxable_sales || 0) < 0.01) &&
                   (Math.abs(node.output_tax || 0) < 0.01) &&
                   (Math.abs(node.taxable_purchases || 0) < 0.01) &&
                   (Math.abs(node.input_tax || 0) < 0.01) &&
                   (Math.abs(node.net_tax_due || 0) < 0.01) &&
                   (Math.abs(node.settlements || 0) < 0.01);
    if (!isZero) return false;
    if (node.children && node.children.length > 0) {
      return node.children.every(ch => isSubtreeZero(ch));
    }
    return true;
  }

  function traverse(nodes) {
    for (const node of nodes) {
      if (!showZeros && isSubtreeZero(node)) continue;
      rows.push([
        node.name,
        node.type === 'company' ? 'شركة' : (node.type === 'year' ? 'سنة' : (node.type === 'quarter' ? 'ربع' : 'شهر')),
        node.taxable_sales || 0,
        node.output_tax || 0,
        node.taxable_purchases || 0,
        node.input_tax || 0,
        node.net_tax_due || 0,
        node.settlements || 0
      ]);
      if (node.children && node.children.length > 0) {
        traverse(node.children);
      }
    }
  }

  traverse(currentData.tree);

  // Grand totals
  const tot = currentData.totals || {};
  rows.push([
    'المجموع الكلي العام',
    'إجمالي',
    tot.taxable_sales || 0,
    tot.output_tax || 0,
    tot.taxable_purchases || 0,
    tot.input_tax || 0,
    tot.net_tax_due || 0,
    tot.settlements || 0
  ]);

  const csvContent = '\uFEFF' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vat-report-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
