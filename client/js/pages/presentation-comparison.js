import { api } from '../api.js';
import { store } from '../store.js';
import { createTreeTable } from '../components/tree-table.js';
import '../../css/presentation-comparison.css';

/**
 * DC1: Departments comparison (مقارنة الأقسام)
 * Six totals cards, four highlight cards, then a 3-level TreeTable:
 * Department (across companies) -> Cost Center -> Company.
 * Every main figure is tax-exclusive; VAT-inclusive figures appear only as secondary lines.
 */

let currentData = null;
let currentTreeTable = null;
let currentGlobalFilters = { groupIds: [], journalIds: [] };
let showUnlinkedList = false;
let showExceptionsList = false;
// Table sort: clicking a column header toggles largest-first / smallest-first
let sortState = { col: 'revenue', dir: 'desc' };

const BASIS = 'بدون ضريبة';
const GROSS_LABEL = '<span class="dc-lbl-long">شامل الضريبة</span><span class="dc-lbl-short">بالضريبة</span>';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function num(n) {
  return Math.round(Number(n)).toLocaleString('en-US');
}

function num2(n) {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function plainMoney(n) {
  const v = Math.round(Number(n));
  return v < 0 ? `(${Math.abs(v).toLocaleString('en-US')})` : v.toLocaleString('en-US');
}

function pctText(p) {
  const v = Number(p);
  return v < 0 ? `(${Math.abs(v).toFixed(1)}%)` : `${v.toFixed(1)}%`;
}

function fmtMoney(n) {
  const v = Math.round(Number(n));
  if (v === 0) return '<span class="dc-muted">—</span>';
  if (v < 0) return `<span class="dc-neg">(${Math.abs(v).toLocaleString('en-US')})</span>`;
  return v.toLocaleString('en-US');
}

function deptCountText(n) {
  if (n === 1) return 'قسم واحد';
  if (n === 2) return 'قسمان';
  return n >= 3 && n <= 10 ? `${n} أقسام` : `${n} قسمًا`;
}

function getPeriodParamsFromFilter(timeFilter) {
  const isCustom = timeFilter?.isCustomDate;
  const isAll = timeFilter?.selectedYear === 'ALL' || timeFilter?.selectedYears?.includes('ALL');
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
  return { years: yearsParam, dateFrom: timeFilter?.dateFrom, dateTo: timeFilter?.dateTo };
}

const ICONS = {
  spinner: '<svg class="spin-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>',
  expandAll: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg>',
  collapseAll: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/></svg>',
  excel: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  chevronDown: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
  sortDesc: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
  sortAsc: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 15 12 9 18 15"/></svg>',
  sortNone: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="8 9 12 5 16 9"/><polyline points="8 15 12 19 16 15"/></svg>',
  chevronLeft: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>'
};

// Seven numeric columns; each header states its basis, each cell may carry one secondary line
const COLUMNS = [
  { id: 'name', label: 'القسم' },
  { id: 'revenue', label: 'الإيرادات', title: 'إيرادات الفترة من حسابات الدخل فقط، بدون ضريبة القيمة المضافة' },
  { id: 'expenses', label: 'المصروفات', title: 'مصروفات الفترة من حسابات المصروف فقط، بدون ضريبة القيمة المضافة' },
  {
    id: 'net_profit', label: 'صافي الربح', title: 'الإيرادات − المصروفات',
    sub: (n) => (n.margin === null || n.margin === undefined) ? '' : `هامش <span class="dc-sub-num" dir="ltr">${pctText(n.margin)}</span>`
  },
  {
    id: 'cash_collected', label: 'النقد المحصَّل في الفترة',
    title: 'ما دخل فعلًا خلال الفترة بتاريخ السداد أيًّا كان تاريخ الفاتورة، بعد استبعاد حصة الضريبة لكل فاتورة',
    sub: (n) => (n.cash_collected === 0 && n.cash_collected_gross === 0) ? '' : `${GROSS_LABEL} <span class="dc-sub-num">${plainMoney(n.cash_collected_gross)}</span>`
  },
  {
    id: 'collected_invoices', label: 'المحصَّل من فواتير الفترة',
    title: 'ما سُدِّد حتى اليوم من الفواتير الصادرة في الفترة نفسها، بدون ضريبة (كما في لوحة الإدارة)',
    sub: (n) => (n.collection_rate === null || n.collection_rate === undefined) ? '' : `<span class="dc-lbl-long">نسبة التحصيل</span><span class="dc-lbl-short">تحصيل</span> <span class="dc-sub-num" dir="ltr">${pctText(n.collection_rate)}</span>`
  },
  {
    id: 'remaining', label: 'المتبقي من فواتير الفترة',
    title: 'المفوتر في الفترة − المحصَّل من فواتير الفترة، بدون ضريبة',
    sub: (n) => (n.remaining === 0 && n.residual_gross === 0) ? '' : `${GROSS_LABEL} <span class="dc-sub-num">${plainMoney(n.residual_gross)}</span>`
  },
  {
    id: 'open_total', label: 'إجمالي المتبقي',
    title: 'كل ما لم يُسدَّد حتى اليوم على القسم من فواتير أي سنة حتى نهاية الفترة المختارة، بدون ضريبة',
    sub: (n) => (n.open_total === 0 && n.open_total_gross === 0) ? '' : `${GROSS_LABEL} <span class="dc-sub-num">${plainMoney(n.open_total_gross)}</span>`
  }
];

export async function renderDepartmentsComparisonTab(body, container, timeFilter, selectedCos, globalFilters) {
  if (globalFilters) currentGlobalFilters = globalFilters;

  body.innerHTML = `
    <div style="direction:rtl;display:flex;flex-direction:column;gap:16px;padding:4px 0;width:100%;max-width:100%;min-width:0;box-sizing:border-box;">
      <div id="dc-loading" style="text-align:center;padding:80px 20px;color:var(--text-muted);font-size:1.05rem;">
        <span style="display:inline-block;vertical-align:middle;margin-left:8px;">${ICONS.spinner}</span>
        جاري تحميل مقارنة الأقسام...
      </div>
      <div id="dc-main-content" style="display:none;flex-direction:column;gap:16px;width:100%;max-width:100%;min-width:0;box-sizing:border-box;"></div>
    </div>
  `;

  const periodParams = getPeriodParamsFromFilter(timeFilter);
  const loadingEl = body.querySelector('#dc-loading');
  const contentEl = body.querySelector('#dc-main-content');

  try {
    const params = {
      companyIds: (selectedCos && selectedCos.length > 0) ? selectedCos.join(',') : undefined,
      years: periodParams.years,
      dateFrom: periodParams.dateFrom,
      dateTo: periodParams.dateTo
    };
    if (currentGlobalFilters?.groupIds?.length) params.departmentIds = currentGlobalFilters.groupIds.join(',');
    if (currentGlobalFilters?.journalIds?.length) params.journalIds = currentGlobalFilters.journalIds.join(',');

    const data = await api.getDepartmentsComparison(params);
    // A newer render replaced this body while the request was in flight
    if (!loadingEl.isConnected) return;

    currentData = data;
    loadingEl.style.display = 'none';
    contentEl.style.display = 'flex';
    renderContent(contentEl, timeFilter, data);
  } catch (err) {
    console.error('[DepartmentsComparison] Failed to load data:', err);
    if (loadingEl) {
      loadingEl.innerHTML = `
        <div style="color:var(--status-negative);font-size:1.05rem;">
          حدث خطأ أثناء تحميل مقارنة الأقسام: ${escapeHtml(err.message || 'خطأ غير متوقع')}
        </div>
      `;
    }
  }
}

function renderHighlights(h) {
  const cards = [];
  if (h.top_profit) {
    cards.push(`
      <div class="dc-highlight" data-dc-highlight="top_profit" data-dept-id="${escapeHtml(h.top_profit.department_id)}">
        <span class="dc-highlight-title"><span class="dc-dot dc-dot-positive"></span>الأعلى ربحًا</span>
        <span class="dc-highlight-name" title="${escapeHtml(h.top_profit.name)}">${escapeHtml(h.top_profit.name)}</span>
        <span class="dc-highlight-value">${plainMoney(h.top_profit.net_profit)}</span>
        <span class="dc-highlight-sub">${h.top_profit.margin === null ? '' : `هامش <span class="dc-kpi-sub-num" dir="ltr">${pctText(h.top_profit.margin)}</span>`}</span>
      </div>
    `);
  }
  if (h.largest_open) {
    cards.push(`
      <div class="dc-highlight" data-dc-highlight="largest_open" data-dept-id="${escapeHtml(h.largest_open.department_id)}">
        <span class="dc-highlight-title"><span class="dc-dot dc-dot-warning"></span>أكبر إجمالي متبقٍّ</span>
        <span class="dc-highlight-name" title="${escapeHtml(h.largest_open.name)}">${escapeHtml(h.largest_open.name)}</span>
        <span class="dc-highlight-value">${plainMoney(h.largest_open.open_total)}</span>
        <span class="dc-highlight-sub">${h.largest_open.share_of_total === null ? '' : `<span class="dc-kpi-sub-num" dir="ltr">${pctText(h.largest_open.share_of_total)}</span> من الإجمالي · `}شامل الضريبة <span class="dc-kpi-sub-num">${plainMoney(h.largest_open.open_total_gross)}</span></span>
      </div>
    `);
  }
  if (h.weakest_collection) {
    cards.push(`
      <div class="dc-highlight" data-dc-highlight="weakest_collection" data-dept-id="${escapeHtml(h.weakest_collection.department_id)}">
        <span class="dc-highlight-title"><span class="dc-dot dc-dot-warning"></span>الأضعف تحصيلًا من فواتير الفترة</span>
        <span class="dc-highlight-name" title="${escapeHtml(h.weakest_collection.name)}">${escapeHtml(h.weakest_collection.name)}</span>
        <span class="dc-highlight-value" dir="ltr" style="text-align:right;">${pctText(h.weakest_collection.collection_rate)}</span>
        <span class="dc-highlight-sub">متبقٍّ <span class="dc-kpi-sub-num">${plainMoney(h.weakest_collection.remaining)}</span> من فواتير الفترة</span>
      </div>
    `);
  }
  if (h.loss_departments) {
    const l = h.loss_departments;
    cards.push(`
      <div class="dc-highlight" data-dc-highlight="loss_departments" data-dept-id="${escapeHtml(l.largest.department_id)}">
        <span class="dc-highlight-title"><span class="dc-dot dc-dot-negative"></span>أقسام مصروفاتها أعلى من إيراداتها</span>
        <span class="dc-highlight-name"><span class="dc-kpi-sub-num">${num(l.count)}</span> من <span class="dc-kpi-sub-num">${num(l.total_departments)}</span> قسمًا</span>
        <span class="dc-highlight-value dc-value-negative">${plainMoney(l.total_shortfall)}</span>
        <span class="dc-highlight-sub">مجموع العجز · أكبرها ${escapeHtml(l.largest.name)} <span class="dc-kpi-sub-num">${plainMoney(l.largest.shortfall)}</span></span>
      </div>
    `);
  }
  if (cards.length === 0) return '';
  return `<div class="dc-highlight-grid" id="dc-highlight-grid" data-count="${cards.length}">${cards.join('')}</div>`;
}

function renderContent(contentEl, timeFilter, data) {
  const c = data.cards;
  const periodLabel = timeFilter?.periodLabel || data.meta?.period_label || '';
  const unlinked = data.unlinked_payments;
  const exceptions = data.exceptions;
  const deptCount = data.meta.department_count;

  contentEl.innerHTML = `
    <div class="exec-header" style="display:flex;flex-direction:column;gap:4px;">
      <h1 class="exec-title" id="dc-title" style="margin:0;font-size:22px;line-height:32px;font-weight:700;color:var(--text-primary);">
        مقارنة الأقسام — <span>${escapeHtml(periodLabel)}</span>
      </h1>
      <p class="exec-subtitle" style="margin:0;font-size:12px;line-height:18px;color:var(--text-muted);">
        الإيراد والمصروف والتحصيل لكل قسم على أساس واحد: ${BASIS}
      </p>
    </div>

    <!-- Row 1: totals (one hero: net profit) -->
    <div class="dc-kpi-grid" id="dc-kpi-grid">
      <div class="bi-kpi bi-kpi-card exec-kpi-card" data-dc-card="revenue">
        <span class="bi-kpi-label">الإيرادات</span>
        <div class="bi-kpi-value">${plainMoney(c.revenue)}</div>
        <span class="bi-kpi-sub">${BASIS} · ${deptCountText(deptCount)}</span>
      </div>

      <div class="bi-kpi bi-kpi-card exec-kpi-card" data-dc-card="expenses">
        <span class="bi-kpi-label">المصروفات</span>
        <div class="bi-kpi-value">${plainMoney(c.expenses)}</div>
        <span class="bi-kpi-sub">${c.revenue > 0 ? `<span class="dc-kpi-sub-num" dir="ltr">${pctText((c.expenses / c.revenue) * 100)}</span> من الإيرادات` : BASIS}</span>
      </div>

      <div class="bi-kpi bi-kpi-card hero exec-kpi-card" data-dc-card="net_profit">
        <span class="bi-kpi-label">صافي الربح</span>
        <div class="bi-kpi-value">${plainMoney(c.net_profit)}</div>
        <span class="bi-kpi-sub">${c.profit_margin === null ? BASIS : `هامش الربح <span class="dc-kpi-sub-num" dir="ltr">${pctText(c.profit_margin)}</span>`}</span>
      </div>

      <div class="bi-kpi bi-kpi-card exec-kpi-card" data-dc-card="cash_collected">
        <span class="bi-kpi-label">النقد المحصَّل في الفترة</span>
        <div class="bi-kpi-value">${plainMoney(c.cash_collected)}</div>
        <span class="bi-kpi-sub">${GROSS_LABEL} <span class="dc-kpi-sub-num" id="dc-cash-gross">${plainMoney(c.cash_collected_gross)}</span></span>
      </div>

      <div class="bi-kpi bi-kpi-card exec-kpi-card" data-dc-card="open_total">
        <span class="bi-kpi-label">إجمالي المتبقي</span>
        <div class="bi-kpi-value">${plainMoney(c.open_total)}</div>
        <span class="bi-kpi-sub">${GROSS_LABEL} <span class="dc-kpi-sub-num" id="dc-open-gross">${plainMoney(c.open_total_gross)}</span></span>
      </div>

      <div class="bi-kpi bi-kpi-card exec-kpi-card" data-dc-card="unlinked" id="dc-unlinked-card" style="background:var(--bg-subtle);">
        <span class="bi-kpi-label">دفعات غير مربوطة بفواتير</span>
        <div class="bi-kpi-value" style="display:flex;align-items:baseline;justify-content:space-between;gap:6px;">
          <span id="dc-unlinked-amount">${plainMoney(unlinked.amount)}</span>
          ${unlinked.count > 0 ? `<button type="button" class="dc-link-btn" id="dc-btn-toggle-unlinked">${showUnlinkedList ? 'إخفاء' : 'عرض'}</button>` : ''}
        </div>
        <span class="bi-kpi-sub">العدد <span class="dc-kpi-sub-num" id="dc-unlinked-count">${num(unlinked.count)}</span> · خارج المقارنة</span>
      </div>
    </div>

    <!-- Row 2: highlights computed by the server from the same filtered rows -->
    ${renderHighlights(data.highlights)}

    <div class="dc-list-wrap" id="dc-unlinked-list" style="display:${showUnlinkedList && unlinked.count > 0 ? 'block' : 'none'};">
      ${renderUnlinkedList(unlinked)}
    </div>

    ${exceptions.count > 0 ? `
      <div class="dc-warning-card" id="dc-exceptions-card">
        <span>
          <strong>تسويات مستثناة من «النقد المحصَّل»:</strong>
          العدد <span class="dc-kpi-sub-num" id="dc-exceptions-count">${num(exceptions.count)}</span> ·
          المبلغ <span class="dc-kpi-sub-num">${num2(exceptions.amount)}</span> ·
          فاتورتها غير موجودة أو إجماليها صفر، فلا تُحسب لها حصة ضريبة
        </span>
        <button type="button" class="dc-link-btn" id="dc-btn-toggle-exceptions">${showExceptionsList ? 'إخفاء القائمة' : 'عرض القائمة'}</button>
      </div>
      <div class="dc-list-wrap" id="dc-exceptions-list" style="display:${showExceptionsList ? 'block' : 'none'};">
        ${renderExceptionsList(exceptions)}
      </div>
    ` : ''}

    <!-- Grouped bars per department: fixed height, grows sideways only -->
    <div class="dc-chart-card" id="dc-chart-card">
      <div class="dc-chart-header">
        <div style="display:flex;flex-direction:column;gap:2px;">
          <h2 class="dc-chart-title">الإيرادات والمصروفات والنقد المحصَّل لكل قسم</h2>
          <span class="dc-chart-subtitle">بالمليون ريال · ${BASIS} · مرتبة تنازليًا بالإيرادات</span>
        </div>
        <div class="dc-chart-legend">
          <span class="dc-legend-item"><span class="dc-legend-dot" style="background:var(--chart-revenue);"></span>الإيرادات</span>
          <span class="dc-legend-item"><span class="dc-legend-dot" style="background:var(--chart-expense);"></span>المصروفات</span>
          <span class="dc-legend-item"><span class="dc-legend-dot" style="background:var(--chart-collection);"></span>النقد المحصَّل في الفترة</span>
        </div>
      </div>
      <div class="dc-chart-scroll" id="dc-chart-container">${renderChart(data.tree)}</div>
    </div>

    <!-- Explainer: two sentences -->
    <div class="dc-note" id="dc-explainer">
      كل الأرقام ${BASIS}: «النقد المحصَّل في الفترة» هو ما دخل فعلًا خلال الفترة أيًّا كان تاريخ الفاتورة، و«المحصَّل من فواتير الفترة» هو ما سُدِّد من فواتير الفترة نفسها.
      الدفعات غير المربوطة بفواتير (تحت الحساب) خارج المقارنة، و«إجمالي المتبقي» هو كل ما لم يُسدَّد حتى اليوم على القسم من فواتير أي سنة حتى نهاية الفترة.
    </div>

    <!-- TreeTable -->
    <div class="exec-table-card" style="background:var(--bg-surface);border:1px solid var(--border-default);border-radius:14px;display:flex;flex-direction:column;width:100%;box-sizing:border-box;">
      <div class="exec-table-toolbar">
        <div class="exec-table-titles">
          <h3 class="exec-table-title">المقارنة حسب القسم — ${escapeHtml(periodLabel)}</h3>
          <span class="exec-table-breadcrumb">القسم ← مركز التكلفة ← الشركة · ${deptCountText(deptCount)}</span>
        </div>
        <div class="exec-table-actions">
          <div class="exec-search-wrap">
            <input type="text" id="dc-tree-search" class="exec-search-input" placeholder="بحث عن قسم أو مركز تكلفة أو شركة…" style="width:240px;" />
            <button id="dc-btn-clear-search" type="button" style="display:none;position:absolute;left:8px;background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:12px;padding:0;">✕</button>
            <span class="exec-search-icon" id="dc-search-icon">${ICONS.search}</span>
          </div>
          <span id="dc-search-counter" style="display:none;font-size:12px;font-weight:600;padding:2px 8px;border-radius:6px;"></span>
          <button id="dc-btn-expand-all" type="button" class="exec-btn-tool" title="توسيع الكل">${ICONS.expandAll} توسيع الكل</button>
          <button id="dc-btn-collapse-all" type="button" class="exec-btn-tool" title="طي الكل">${ICONS.collapseAll} طي الكل</button>
          <button id="btn-tree-export-excel" type="button" class="exec-btn-tool" title="تصدير Excel">${ICONS.excel} تصدير Excel</button>
        </div>
      </div>
      <div id="dc-tree-container" class="tree-table-wrap" data-scroll-x="true"></div>
    </div>
  `;

  contentEl.querySelector('#dc-btn-toggle-unlinked')?.addEventListener('click', (e) => {
    showUnlinkedList = !showUnlinkedList;
    contentEl.querySelector('#dc-unlinked-list').style.display = showUnlinkedList ? 'block' : 'none';
    e.currentTarget.textContent = showUnlinkedList ? 'إخفاء' : 'عرض';
  });
  contentEl.querySelector('#dc-btn-toggle-exceptions')?.addEventListener('click', (e) => {
    showExceptionsList = !showExceptionsList;
    contentEl.querySelector('#dc-exceptions-list').style.display = showExceptionsList ? 'block' : 'none';
    e.currentTarget.textContent = showExceptionsList ? 'إخفاء القائمة' : 'عرض القائمة';
  });

  initTreeTable(contentEl.querySelector('#dc-tree-container'), data);

  const searchInput = contentEl.querySelector('#dc-tree-search');
  const clearBtn = contentEl.querySelector('#dc-btn-clear-search');
  const searchIcon = contentEl.querySelector('#dc-search-icon');
  if (searchInput && currentTreeTable) {
    bindLocalSearch(searchInput, clearBtn, contentEl.querySelector('#dc-search-counter'), searchIcon);
  }

  contentEl.querySelector('#dc-btn-expand-all')?.addEventListener('click', () => {
    if (currentTreeTable) currentTreeTable.expandAll();
  });
  contentEl.querySelector('#dc-btn-collapse-all')?.addEventListener('click', () => {
    if (currentTreeTable) currentTreeTable.collapseAll();
  });
  contentEl.querySelector('#btn-tree-export-excel')?.addEventListener('click', () => {
    exportToExcel(currentData, periodLabel);
  });
}

/**
 * Search over the three levels already loaded in this table (department / cost center / company).
 * It only filters the displayed rows; totals, cards and highlights do not change.
 */
function bindLocalSearch(inputEl, clearBtn, counterEl, iconEl) {
  const table = currentTreeTable;
  let timer = null;
  let savedExpanded = null;

  const apply = (raw) => {
    const q = (raw || '').trim();
    if (q && !table.searchQuery) savedExpanded = new Set(table.expandedKeys);
    table.searchQuery = q;
    table.normalizedQuery = q ? normalizeQuery(q) : '';
    if (!q && savedExpanded) {
      table.expandedKeys = savedExpanded;
      savedExpanded = null;
      table.saveExpandedKeys();
    }
    table.render();
    if (clearBtn) clearBtn.style.display = q ? 'inline-flex' : 'none';
    if (iconEl) iconEl.style.display = q ? 'none' : 'inline-flex';
    if (counterEl) {
      if (!q) {
        counterEl.style.display = 'none';
        counterEl.textContent = '';
      } else {
        const found = table.matchedCount > 0;
        counterEl.style.display = 'inline-block';
        counterEl.textContent = found ? `${table.matchedCount} نتيجة` : 'لا توجد نتائج';
        counterEl.style.background = found ? 'var(--status-positive-subtle)' : 'var(--status-negative-subtle)';
        counterEl.style.color = found ? 'var(--status-positive)' : 'var(--status-negative)';
      }
    }
  };

  inputEl.addEventListener('input', (e) => {
    if (timer) clearTimeout(timer);
    const value = e.target.value;
    timer = setTimeout(() => apply(value), 200);
  });
  clearBtn?.addEventListener('click', () => {
    if (timer) clearTimeout(timer);
    inputEl.value = '';
    apply('');
    inputEl.focus();
  });
}

// Same normalization the shared TreeTable applies to node names
function normalizeQuery(text) {
  return String(text)
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/ـ/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[ىي]/g, 'ي')
    .replace(/[٠-٩]/g, d => '0123456789'['٠١٢٣٤٥٦٧٨٩'.indexOf(d)])
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function renderUnlinkedList(unlinked) {
  if (!unlinked.moves || unlinked.moves.length === 0) return '';
  return `
    <table class="bi-table">
      <thead>
        <tr>
          <th>الشركة</th><th>القيد</th><th>التاريخ</th><th>العميل</th><th>النوع</th><th>المبلغ غير المربوط (كما سُجّل)</th>
        </tr>
      </thead>
      <tbody>
        ${unlinked.moves.map(m => `
          <tr>
            <td>${escapeHtml(m.company_name)}</td>
            <td class="dc-list-num">${escapeHtml(m.move_name)}</td>
            <td class="dc-list-num">${escapeHtml(m.date)}</td>
            <td>${escapeHtml(m.partner_name)}</td>
            <td>${escapeHtml(m.type_label)}</td>
            <td class="dc-list-num">${num2(m.amount)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

const EXCEPTION_REASONS = {
  no_invoice: 'تسوية بلا فاتورة',
  invoice_not_found: 'الفاتورة غير موجودة في بيانات الفواتير',
  invoice_ambiguous: 'أكثر من فاتورة بالرقم نفسه',
  invoice_total_zero: 'إجمالي الفاتورة صفر'
};

function renderExceptionsList(exceptions) {
  return `
    <table class="bi-table">
      <thead>
        <tr><th>الفاتورة</th><th>العميل</th><th>قيد السداد</th><th>التاريخ</th><th>السبب</th><th>المبلغ</th></tr>
      </thead>
      <tbody>
        ${exceptions.items.map(e => `
          <tr>
            <td class="dc-list-num">${escapeHtml(e.invoice_name)}</td>
            <td>${escapeHtml(e.partner_name)}</td>
            <td class="dc-list-num">${escapeHtml(e.payment_move_name)}</td>
            <td class="dc-list-num">${escapeHtml(e.payment_date)}</td>
            <td>${escapeHtml(EXCEPTION_REASONS[e.reason] || e.reason)}</td>
            <td class="dc-list-num">${num2(e.amount)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

/**
 * Grouped bars per department: revenue / expenses / cash collected (net of VAT).
 * Always ordered by revenue (largest first), independent of the table's sort.
 * Each label is confined to its own slot, so labels cannot overlap; many departments scroll sideways.
 */
function renderChart(tree) {
  const depts = (tree || [])
    .filter(d => d.revenue !== 0 || d.expenses !== 0 || d.cash_collected !== 0)
    .slice()
    .sort((a, b) => (b.revenue - a.revenue) || (b.expenses - a.expenses) || (b.cash_collected - a.cash_collected) || String(a.id).localeCompare(String(b.id)));
  if (depts.length === 0) {
    return `<div style="text-align:center;padding:40px 20px;color:var(--text-muted);">لا توجد أرقام للأقسام في هذه الفترة</div>`;
  }

  const maxVal = Math.max(...depts.map(d => Math.max(d.revenue, d.expenses, d.cash_collected)), 0);
  // Round the axis top up to a clean step so gridline labels are exact
  const rawStep = maxVal / 4;
  const pow = rawStep > 0 ? Math.pow(10, Math.floor(Math.log10(rawStep))) : 1;
  const step = rawStep > 0 ? [1, 2, 2.5, 5, 10].map(m => m * pow).find(s => s >= rawStep) : 1;
  const axisMax = step * 4;

  const axisLabel = (v) => {
    if (v === 0) return '0';
    const m = v / 1000000;
    return (Number.isInteger(m) ? String(m) : String(Number(m.toFixed(2)))) + 'م';
  };
  const pct = (v) => (v > 0 ? Math.min(100, (v / axisMax) * 100) : 0);
  const ticks = [0, 1, 2, 3, 4].map(i => ({ value: step * i, bottom: (i / 4) * 100 }));

  return `
    <div class="dc-chart" style="min-width:${48 + 8 + depts.length * 58}px;">
      <div class="dc-chart-axis">
        ${ticks.map(t => `<span style="bottom:${t.bottom}%;">${axisLabel(t.value)}</span>`).join('')}
      </div>
      <div class="dc-chart-plot">
        ${ticks.map(t => `<div class="dc-chart-gridline ${t.value === 0 ? 'dc-base' : ''}" style="bottom:${t.bottom}%;"></div>`).join('')}
        ${depts.map(d => `
          <div class="dc-chart-group" data-dept-id="${escapeHtml(d.department_id)}">
            <div class="dc-chart-bar dc-bar-revenue" style="height:${pct(d.revenue)}%;" title="${escapeHtml(d.name)}&#10;الإيرادات: ${plainMoney(d.revenue)}"></div>
            <div class="dc-chart-bar dc-bar-expense" style="height:${pct(d.expenses)}%;" title="${escapeHtml(d.name)}&#10;المصروفات: ${plainMoney(d.expenses)}"></div>
            <div class="dc-chart-bar dc-bar-cash" style="height:${pct(d.cash_collected)}%;" title="${escapeHtml(d.name)}&#10;النقد المحصَّل في الفترة (${BASIS}): ${plainMoney(d.cash_collected)}"></div>
          </div>
        `).join('')}
      </div>
      <div></div>
      <div class="dc-chart-labels">
        ${depts.map(d => `<div class="dc-chart-label" title="${escapeHtml(d.name)}">${escapeHtml(d.name)}</div>`).join('')}
      </div>
    </div>
  `;
}

// Sorted copy of the tree for the table: departments and the rows under each one follow the same column
function sortedTree(tree) {
  const { col, dir } = sortState;
  const sign = dir === 'asc' ? 1 : -1;
  const cmp = (a, b) => {
    const base = col === 'name'
      ? String(a.name).localeCompare(String(b.name), 'ar')
      : (a[col] - b[col]);
    return (base * sign) || String(a.id).localeCompare(String(b.id));
  };
  const walk = (nodes) => nodes.slice().sort(cmp).map(n => (n.children ? { ...n, children: walk(n.children) } : n));
  return walk(tree);
}

// The shared TreeTable prints plain labels; add the basis line and the sort control to each header after every render
function decorateHeaders(container) {
  for (const col of COLUMNS) {
    const th = container.querySelector(`thead th[data-col-id="${col.id}"]`);
    if (!th || th.querySelector('.dc-th-label')) continue;
    const active = sortState.col === col.id;
    const icon = active ? (sortState.dir === 'desc' ? ICONS.sortDesc : ICONS.sortAsc) : ICONS.sortNone;
    th.classList.add('dc-th-sortable');
    th.setAttribute('data-sort-dir', active ? sortState.dir : 'none');
    th.setAttribute('aria-sort', active ? (sortState.dir === 'desc' ? 'descending' : 'ascending') : 'none');
    th.innerHTML = `<span class="dc-th-label">${escapeHtml(col.label)}<span class="dc-th-sort ${active ? 'dc-th-sort-active' : ''}">${icon}</span></span>${col.id === 'name' ? '' : `<span class="dc-th-basis">${BASIS}</span>`}`;
  }
}

function initTreeTable(container, data) {
  const columns = COLUMNS.map(col => col.id === 'name'
    ? { id: 'name', label: col.label, align: 'right', minWidth: '140px', priority: 1 }
    : { id: col.id, label: col.label, title: col.title, align: 'right', width: '12.1%', minWidth: '116px', priority: 1 });

  const cell = (col, node) => {
    const sub = col.sub ? col.sub(node) : '';
    return `<td class="tree-col-num" data-col-id="${col.id}" data-priority="1"><span class="dc-cell-main">${fmtMoney(node[col.id])}</span>${sub ? `<span class="dc-cell-sub">${sub}</span>` : ''}</td>`;
  };

  currentTreeTable = createTreeTable(container, {
    storageKey: 'mizaniat_dc_tree_expanded',
    columns,
    data: sortedTree(data.tree),
    totals: data.totals,
    tableLayout: 'fixed',
    forceNew: true,
    showZeroItems: store.get('showZeroItems') ?? false,
    getNodeKey: (node, parentPath) => parentPath ? `${parentPath}/${node.id}` : String(node.id),
    getChildren: (node) => node.children || [],
    hasChildren: (node) => !!(node.children && node.children.length > 0),
    renderRow: ({ node, pathKey, depth, isExpanded, hasKids }) => {
      const indent = depth * 20;
      const icon = hasKids ? (isExpanded ? ICONS.chevronDown : ICONS.chevronLeft) : '•';
      const rowClass = node.type === 'dept' ? 'dc-row-dept' : (node.type === 'company' ? 'dc-row-company' : 'dc-row-cc');
      const dot = node.type === 'company' ? `<span class="company-dot" style="background:var(--company-${Number(node.company_id)});flex-shrink:0;"></span>` : '';
      const tag = (node.type === 'dept' && node.is_unmapped_cost_center) ? '<span class="dc-tag" title="مركز تكلفة غير مربوط بمجموعة، يظهر باسمه">مركز تكلفة</span>' : '';
      return `
        <tr data-tree-row="true" data-path-key="${escapeHtml(pathKey)}" data-node-type="${node.type}" class="${rowClass}" style="${hasKids ? 'cursor:pointer;' : ''}">
          <td class="tree-col-name" data-col-id="name" data-priority="1" style="padding-right:${indent + 12}px;">
            <div class="tree-name-cell">
              <span data-tree-toggle="true" style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;color:var(--text-muted);flex-shrink:0;">${icon}</span>
              ${dot}
              <span class="tree-node-name" data-tree-name="true" title="${escapeHtml(node.name)}">${escapeHtml(node.name)}</span>
              ${tag}
            </div>
          </td>
          ${COLUMNS.slice(1).map(col => cell(col, node)).join('')}
        </tr>
      `;
    },
    renderTotals: (totals) => `
      <tr class="exec-totals-row" id="dc-totals-row">
        <td class="tree-col-name" data-col-id="name" data-priority="1">الإجمالي</td>
        ${COLUMNS.slice(1).map(col => cell(col, totals)).join('')}
      </tr>
    `
  });

  const baseRender = currentTreeTable.render.bind(currentTreeTable);
  currentTreeTable.render = () => {
    baseRender();
    decorateHeaders(container);
  };
  decorateHeaders(container);

  // Header click: first click on a column sorts largest-first, the next one flips it
  container.addEventListener('click', (e) => {
    const th = e.target.closest('thead th[data-col-id]');
    if (!th || !container.contains(th)) return;
    const colId = th.getAttribute('data-col-id');
    if (sortState.col === colId) {
      sortState = { col: colId, dir: sortState.dir === 'desc' ? 'asc' : 'desc' };
    } else {
      sortState = { col: colId, dir: colId === 'name' ? 'asc' : 'desc' };
    }
    currentTreeTable.data = sortedTree(data.tree);
    currentTreeTable.render();
  });
}

function exportToExcel(data, periodLabel) {
  if (!data) return;
  const showZeros = store.get('showZeroItems') ?? false;
  const MONEY_KEYS = ['revenue', 'expenses', 'cash_collected', 'cash_collected_gross', 'collected_invoices', 'billed', 'residual_gross', 'open_total', 'open_total_gross'];
  const isZero = (n) => MONEY_KEYS.every(k => !n[k]);
  const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const pctCell = (p) => (p === null || p === undefined) ? '' : p;

  const headers = [
    'المستوى', 'القسم', 'مركز التكلفة', 'الشركة',
    `الإيرادات (${BASIS})`, `المصروفات (${BASIS})`, `صافي الربح (${BASIS})`, 'هامش الربح %',
    `النقد المحصَّل في الفترة (${BASIS})`, 'النقد المحصَّل في الفترة (شامل الضريبة)',
    `المحصَّل من فواتير الفترة (${BASIS})`, 'نسبة التحصيل %',
    `المتبقي من فواتير الفترة (${BASIS})`, 'المتبقي من فواتير الفترة (شامل الضريبة)',
    `إجمالي المتبقي (${BASIS})`, 'إجمالي المتبقي (شامل الضريبة)'
  ];
  const line = (level, dept, cc, co, n) => [
    q(level), q(dept), q(cc), q(co),
    n.revenue, n.expenses, n.net_profit, pctCell(n.margin),
    n.cash_collected, n.cash_collected_gross,
    n.collected_invoices, pctCell(n.collection_rate),
    n.remaining, n.residual_gross,
    n.open_total, n.open_total_gross
  ].join(',');

  const rows = [];
  for (const d of sortedTree(data.tree)) {
    if (!showZeros && isZero(d)) continue;
    rows.push(line('قسم', d.name, '', '', d));
    for (const cc of d.children) {
      if (!showZeros && isZero(cc)) continue;
      rows.push(line('مركز تكلفة', d.name, cc.name, '', cc));
      for (const co of cc.children) {
        if (!showZeros && isZero(co)) continue;
        rows.push(line('شركة', d.name, cc.name, co.name, co));
      }
    }
  }
  rows.push(line('الإجمالي', 'الإجمالي', '', '', data.totals));

  const title = q(`مقارنة الأقسام — ${periodLabel}`);
  const note = q(`دفعات غير مربوطة بفواتير (خارج المقارنة): العدد ${data.unlinked_payments.count} · المبلغ ${num2(data.unlinked_payments.amount)}`);
  const csv = '﻿' + [title, note, headers.map(q).join(','), ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `مقارنة_الأقسام_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
