import { api, registerClientCacheInvalidator } from '../api.js';
import { store } from '../store.js';
import { formatNumber, formatCurrency, formatDate } from '../utils/format.js';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { createTreeTable } from '../components/tree-table.js';

/**
 * Customers & Collection Tab (D1 — «العملاء والتحصيل»)
 * Replaces التحصيل, المبيعات, and تفاصيل المبيعات.
 * Single unified source: sales_invoices + invoice_departments
 * 4-level TreeTable: Company -> Department -> Customer -> Invoice
 * Mathematical definitions:
 *   Collected = Net - Residual
 *   Collection Rate = Collected / Net
 *   Returns are deducted from Billed to get Net, and NEVER counted as collections (fixes B4)
 */

let currentData = null;
let currentTreeTable = null;
const clientCache = new Map();

export function clearCustomersClientCache() {
  clientCache.clear();
}
registerClientCacheInvalidator(clearCustomersClientCache);

if (typeof window !== 'undefined') {
  window.__getCustomersClientCacheSize = () => clientCache.size;
}

let isAgingOpen = false;
let isReturnsOpen = false;
let returnsSearchQuery = '';
let mainSearchQuery = '';
let activeStatementModal = null;

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fmtVal(num, showZeroDash = true) {
  if (num === null || num === undefined || isNaN(num)) return showZeroDash ? '—' : '0';
  const rounded = Math.round(Number(num));
  if (rounded === 0 && showZeroDash) return '—';
  if (rounded < 0) {
    return `<span class="exec-num-neg" style="color:var(--exec-danger, #ef4444);direction:ltr;display:inline-block;">(${Math.abs(rounded).toLocaleString('en-US')})</span>`;
  }
  return `<span class="exec-num">${rounded.toLocaleString('en-US')}</span>`;
}

function fmtRate(rate) {
  if (rate === null || rate === undefined || isNaN(rate)) return '—';
  return `<span dir="ltr" class="tabular-nums" style="display:inline-block;direction:ltr;">${Number(rate).toFixed(1)}%</span>`;
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

export async function renderCustomersCollectionTab(body, container, timeFilter, selectedCos, globalFilters) {
  body.innerHTML = `
    <div style="direction:rtl;display:flex;flex-direction:column;gap:20px;padding:4px 0;width:100%;max-width:100%;min-width:0;box-sizing:border-box;">
      <!-- Loading Placeholder -->
      <div id="cust-loading" style="text-align:center;padding:80px 20px;color:rgba(255,255,255,0.5);font-size:1.1rem;">
        <span class="spin-icon" style="display:inline-block;animation:bi-spin 0.8s linear infinite;margin-left:8px;font-size:1.4rem;">⏳</span>
        جاري تحميل تقرير العملاء والتحصيل الموحّد...
      </div>
      <div id="cust-main-content" style="display:none;flex-direction:column;gap:22px;width:100%;max-width:100%;min-width:0;box-sizing:border-box;"></div>
    </div>
  `;

  const periodParams = getPeriodParamsFromFilter(timeFilter);
  const companyIdsParam = (selectedCos && selectedCos.length > 0) ? selectedCos.join(',') : undefined;
  const grpIds = (globalFilters?.groupIds || []).join(',');
  const jrnIds = (globalFilters?.journalIds || []).join(',');
  const cacheKey = `${companyIdsParam || 'all'}:${periodParams.years || 'cur'}:${periodParams.dateFrom || ''}:${periodParams.dateTo || ''}:g${grpIds}:j${jrnIds}`;

  if (clientCache.has(cacheKey)) {
    const data = clientCache.get(cacheKey);
    currentData = data;
    const loadingEl = body.querySelector('#cust-loading');
    const contentEl = body.querySelector('#cust-main-content');
    if (loadingEl) loadingEl.style.display = 'none';
    if (contentEl) {
      contentEl.style.display = 'flex';
      renderContent(contentEl, container, data, periodParams, selectedCos, timeFilter);
    }
    return;
  }

  try {
    const params = {
      companyIds: companyIdsParam,
      years: periodParams.years,
      dateFrom: periodParams.dateFrom,
      dateTo: periodParams.dateTo
    };
    if (globalFilters?.groupIds?.length) params.groupIds = globalFilters.groupIds.join(',');
    if (globalFilters?.journalIds?.length) params.journalIds = globalFilters.journalIds.join(',');

    const data = await api.getCustomersCollection(params);

    currentData = data;
    clientCache.set(cacheKey, data);
    const loadingEl = body.querySelector('#cust-loading');
    const contentEl = body.querySelector('#cust-main-content');
    if (loadingEl) loadingEl.style.display = 'none';
    if (contentEl) {
      contentEl.style.display = 'flex';
      renderContent(contentEl, container, data, periodParams, selectedCos, timeFilter);
    }
  } catch (err) {
    console.error('[CustomersCollectionTab] Error:', err);
    body.innerHTML = `
      <div style="text-align:center;padding:60px 20px;color:#ef4444;font-size:1.1rem;">
        ❌ حدث خطأ أثناء تحميل بيانات العملاء والتحصيل: ${escapeHtml(err.message)}
        <div style="margin-top:16px;">
          <button id="btn-retry-cust" style="padding:8px 20px;background:#3b82f6;color:#fff;border:none;border-radius:10px;cursor:pointer;font-weight:700;">
            🔄 إعادة المحاولة
          </button>
        </div>
      </div>
    `;
    body.querySelector('#btn-retry-cust')?.addEventListener('click', () => {
      renderCustomersCollectionTab(body, container, timeFilter, selectedCos);
    });
  }
}

const ICONS = {
  search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  expandAll: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg>',
  collapseAll: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/></svg>',
  excel: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  chevronDown: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
  chevronLeft: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
  statement: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>'
};

function formatPresentationPeriodLabel(rawLabel, periodParams) {
  if (periodParams?.years && !periodParams.years.includes(',') && periodParams.years !== 'ALL') {
    return periodParams.years;
  }
  const str = String(rawLabel || '').trim();
  const m1 = str.match(/^(?:01-01-)?(\d{4})\s*إلى\s*31-12-\1$/);
  if (m1) return m1[1];
  const m2 = str.match(/^(\d{4})-01-01\s*إلى\s*\1-12-31$/);
  if (m2) return m2[1];
  const m3 = str.match(/^01\/01\/(\d{4})\s*إلى\s*31\/12\/\1$/);
  if (m3) return m3[1];
  return str || periodParams?.years || '2026';
}

function renderContent(contentEl, container, data, periodParams, selectedCos, timeFilter) {
  const totals = data.totals || {};
  const meta = data.meta || {};
  const buckets = totals.buckets || {};
  const totalResidual = totals.total_residual || 0;
  
  const rawPeriod = timeFilter?.periodLabel || meta.period_label || periodParams?.years || '2026';
  const periodLabel = formatPresentationPeriodLabel(rawPeriod, periodParams);

  // 5 Aging buckets calculations
  const notDue = Math.max(0, buckets.not_due || 0);
  const b1_30 = Math.max(0, buckets.b1_30 || 0);
  const b31_60 = Math.max(0, buckets.b31_60 || 0);
  const b61_90 = Math.max(0, buckets.b61_90 || 0);
  const over90 = Math.max(0, (buckets.b91_180 || 0) + (buckets.b181_365 || 0) + (buckets.over_365 || 0));

  const pNotDue = totalResidual > 0 ? (notDue / totalResidual * 100) : 0;
  const p1_30 = totalResidual > 0 ? (b1_30 / totalResidual * 100) : 0;
  const p31_60 = totalResidual > 0 ? (b31_60 / totalResidual * 100) : 0;
  const p61_90 = totalResidual > 0 ? (b61_90 / totalResidual * 100) : 0;
  const pOver90 = totalResidual > 0 ? (over90 / totalResidual * 100) : 0;

  contentEl.innerHTML = `
    <!-- Tab Header -->
    <div class="exec-header" style="display:flex;flex-direction:column;gap:4px;">
      <h1 class="exec-title" style="margin:0;font-size:22px;line-height:32px;font-weight:700;color:var(--text-primary);">
        فواتير العملاء — <span>${escapeHtml(periodLabel)}</span>
      </h1>
      <p class="exec-subtitle" style="margin:0;font-size:12px;line-height:18px;color:var(--text-muted);">
        ما فُوّتر خلال الفترة وما بقي منه دون تحصيل، حسب تاريخ الفاتورة
      </p>
    </div>

    <!-- Top KPI Cards (5 Cards matching 03-customers-light.png) -->
    <div class="cust-kpi-grid exec-kpi-grid">
      
      <!-- 1. Billed -->
      <div class="bi-kpi-card">
        <span class="bi-kpi-label">المفوتر</span>
        <div class="bi-kpi-value">${Math.round(totals.total_billed || 0).toLocaleString('en-US')}</div>
        <span class="bi-kpi-sub">شامل الضريبة • ${totals.inv_count ? totals.inv_count.toLocaleString('en-US') : (data.meta?.invoices_count ? data.meta.invoices_count.toLocaleString('en-US') : '—')} فاتورة</span>
      </div>

      <!-- 2. Returns / Credit Notes -->
      <div class="bi-kpi-card">
        <span class="bi-kpi-label">الإشعارات الدائنة</span>
        <div class="bi-kpi-value">${Math.round(totals.total_returns || 0).toLocaleString('en-US')}</div>
        <span class="bi-kpi-sub">${(data.returns_list || []).length > 0 ? `${(data.returns_list || []).length.toLocaleString('en-US')} إشعاراً` : '—'}</span>
      </div>

      <!-- 3. Net Billed (HERO Card) -->
      <div class="bi-kpi-card hero">
        <span class="bi-kpi-label">صافي الفواتير</span>
        <div class="bi-kpi-value">${Math.round(totals.total_net || 0).toLocaleString('en-US')}</div>
        <span class="bi-kpi-sub">المفوتر – الإشعارات</span>
      </div>

      <!-- 4. Collected -->
      <div class="bi-kpi-card">
        <span class="bi-kpi-label">المحصّل</span>
        <div class="bi-kpi-value">${Math.round(totals.total_collected || 0).toLocaleString('en-US')}</div>
        <div style="display:flex;flex-direction:column;gap:4px;">
          <div class="bi-progress-bar-wrap">
            <div class="bi-progress-bar-fill" style="width:${Math.min(100, Math.max(0, totals.collection_rate || 0))}%;"></div>
          </div>
          <span class="bi-kpi-sub">نسبة التحصيل <strong class="text-positive tabular-nums" dir="ltr" style="display:inline-block;direction:ltr;">${totals.collection_rate != null ? Number(totals.collection_rate).toFixed(1) : 0}%</strong></span>
        </div>
      </div>

      <!-- 5. Remaining / Residual -->
      <div class="bi-kpi-card">
        <span class="bi-kpi-label">المتبقي</span>
        <div class="bi-kpi-value">${Math.round(totals.total_residual || 0).toLocaleString('en-US')}</div>
        <span class="bi-kpi-sub">منه متأخر +90 يوماً <strong class="text-negative tabular-nums">${totals.overdue_90 != null ? Math.round(totals.overdue_90).toLocaleString('en-US') : '—'}</strong></span>
      </div>

    </div>

    <!-- Aging Card (03-customers-light.png) -->
    <div class="cust-aging-card">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
        <div style="display:flex;flex-direction:column;gap:2px;">
          <h2 style="margin:0;font-size:17px;line-height:26px;font-weight:600;color:var(--text-primary);">كم عمر المبالغ غير المحصّلة؟</h2>
          <span style="font-size:12px;line-height:18px;color:var(--text-muted);">
            حسب تاريخ استحقاق الفاتورة • الإجمالي <strong class="tabular-nums" style="color:var(--text-primary);">${Math.round(totalResidual).toLocaleString('en-US')}</strong>
          </span>
        </div>
        <button id="cust-aging-toggle" style="background:none;border:none;color:var(--brand-accent);font-size:13px;font-weight:600;cursor:pointer;padding:4px 0;text-decoration:none;font-family:var(--font-ar);">
          ${isAgingOpen ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
        </button>
      </div>

      <!-- Multi-segment Progress Bar -->
      <div class="cust-aging-bar">
        ${pNotDue > 0 ? `<div style="width:${pNotDue}%;background:#9AA8BC;"></div>` : ''}
        ${p1_30 > 0 ? `<div style="width:${p1_30}%;background:#1D6AE5;"></div>` : ''}
        ${p31_60 > 0 ? `<div style="width:${p31_60}%;background:#7A5AF0;"></div>` : ''}
        ${p61_90 > 0 ? `<div style="width:${p61_90}%;background:#A85A07;"></div>` : ''}
        ${pOver90 > 0 ? `<div style="width:${pOver90}%;background:#C2281B;"></div>` : ''}
      </div>

      <!-- 5-Bucket Legend -->
      <div class="cust-aging-legend">
        <!-- 1. Not Due -->
        <div style="display:flex;flex-direction:column;gap:4px;">
          <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-secondary);">
            <span style="width:8px;height:8px;border-radius:50%;background:#9AA8BC;flex-shrink:0;"></span>
            <span>لم يستحق بعد</span>
          </div>
          <div class="tabular-nums" style="font-size:14px;font-weight:600;color:var(--text-primary);">${Math.round(notDue).toLocaleString('en-US')}</div>
          <span style="font-size:11px;color:var(--text-muted);"><span dir="ltr" class="tabular-nums" style="display:inline-block;direction:ltr;">${pNotDue.toFixed(1)}%</span></span>
        </div>

        <!-- 2. 1-30 -->
        <div style="display:flex;flex-direction:column;gap:4px;">
          <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-secondary);">
            <span style="width:8px;height:8px;border-radius:50%;background:#1D6AE5;flex-shrink:0;"></span>
            <span>1–30 يوماً</span>
          </div>
          <div class="tabular-nums" style="font-size:14px;font-weight:600;color:var(--text-primary);">${Math.round(b1_30).toLocaleString('en-US')}</div>
          <span style="font-size:11px;color:var(--text-muted);"><span dir="ltr" class="tabular-nums" style="display:inline-block;direction:ltr;">${p1_30.toFixed(1)}%</span></span>
        </div>

        <!-- 3. 31-60 -->
        <div style="display:flex;flex-direction:column;gap:4px;">
          <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-secondary);">
            <span style="width:8px;height:8px;border-radius:50%;background:#7A5AF0;flex-shrink:0;"></span>
            <span>31–60 يوماً</span>
          </div>
          <div class="tabular-nums" style="font-size:14px;font-weight:600;color:var(--text-primary);">${Math.round(b31_60).toLocaleString('en-US')}</div>
          <span style="font-size:11px;color:var(--text-muted);"><span dir="ltr" class="tabular-nums" style="display:inline-block;direction:ltr;">${p31_60.toFixed(1)}%</span></span>
        </div>

        <!-- 4. 61-90 -->
        <div style="display:flex;flex-direction:column;gap:4px;">
          <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-secondary);">
            <span style="width:8px;height:8px;border-radius:50%;background:#A85A07;flex-shrink:0;"></span>
            <span>61–90 يوماً</span>
          </div>
          <div class="tabular-nums" style="font-size:14px;font-weight:600;color:var(--text-primary);">${Math.round(b61_90).toLocaleString('en-US')}</div>
          <span style="font-size:11px;color:var(--text-muted);"><span dir="ltr" class="tabular-nums" style="display:inline-block;direction:ltr;">${p61_90.toFixed(1)}%</span></span>
        </div>

        <!-- 5. Over 90 -->
        <div style="display:flex;flex-direction:column;gap:4px;">
          <div style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--status-negative);">
            <span style="width:8px;height:8px;border-radius:50%;background:#C2281B;flex-shrink:0;"></span>
            <span>أكثر من 90 يوماً</span>
          </div>
          <div class="tabular-nums text-negative" style="font-size:14px;font-weight:600;">${Math.round(over90).toLocaleString('en-US')}</div>
          <span style="font-size:11px;color:var(--text-muted);"><span dir="ltr" class="tabular-nums" style="display:inline-block;direction:ltr;">${pOver90.toFixed(1)}%</span></span>
        </div>
      </div>

      <!-- Collapsible Detailed 7 Buckets Container (supports interactive test assert) -->
      <div id="cust-aging-body" style="display:${isAgingOpen ? 'grid' : 'none'};grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:12px;padding-top:14px;border-top:1px solid var(--border-default);">
        ${renderAgingBucketsGrid(buckets, totalResidual)}
      </div>
    </div>

    <!-- Collapsible Returns Section -->
    <div style="background:var(--bg-surface);border:1px solid var(--border-default);border-radius:14px;padding:16px 20px;display:flex;flex-direction:column;gap:12px;width:100%;box-sizing:border-box;">
      <div id="cust-returns-toggle" style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:14px;font-weight:600;color:var(--text-primary);">قائمة المرتجعات والإشعارات الدائنة</span>
          <span id="cust-returns-badge" style="font-size:12px;color:var(--brand-accent);background:var(--brand-accent-subtle);padding:2px 8px;border-radius:999px;font-weight:600;">
            ${(data.returns_list || []).length} إشعاراً
          </span>
        </div>
        <span style="font-size:12px;color:var(--text-secondary);font-weight:600;">
          الإجمالي: <strong class="tabular-nums" style="color:var(--status-warning);">${Math.round(totals.total_returns || 0).toLocaleString('en-US')}</strong> ريال
        </span>
      </div>

      <div id="cust-returns-body" style="display:${isReturnsOpen ? 'flex' : 'none'};flex-direction:column;gap:12px;padding-top:10px;border-top:1px solid var(--border-default);">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <input type="text" id="cust-returns-search" placeholder="بحث في المرتجعات…" 
            value="${escapeHtml(returnsSearchQuery)}" 
            class="exec-search-input" style="width:280px;">
          <span style="font-size:12px;color:var(--text-muted);">
            * المرتجعات تُخصم من المفوتر ولا تحتسب كتحصيل نقدي
          </span>
        </div>
        <div id="cust-returns-table-wrapper" data-scroll-x="true" style="overflow-x:auto;max-height:360px;width:100%;box-sizing:border-box;">
          ${renderReturnsTable(data.returns_list || [], returnsSearchQuery)}
        </div>
      </div>
    </div>

    <!-- Main Section: 4-Level Hierarchical TreeTable Card -->
    <div class="exec-table-card">
      
      <!-- Table Header & Controls -->
      <div class="exec-table-toolbar">
        <div class="exec-table-titles">
          <h2 class="exec-table-title">الفواتير حسب الشركة والمجموعة والعميل — ${escapeHtml(periodLabel)}</h2>
          <span class="exec-table-breadcrumb">الشركة ← المجموعة ← مركز التكلفة ← العميل ← الفاتورة</span>
        </div>

        <div class="exec-table-actions">
          <div class="exec-search-wrap">
            <input type="text" id="cust-tree-search" class="exec-search-input" placeholder="بحث…" />
            <button id="btn-cust-clear-search" style="display:none;position:absolute;left:8px;background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:12px;padding:0;">✕</button>
            <span class="exec-search-icon">${ICONS.search}</span>
          </div>
          <span id="cust-search-counter" style="font-size:12px;color:var(--text-muted);font-weight:600;display:none;"></span>
          
          <button id="cust-btn-expand-all" class="exec-btn-tool" title="توسيع الكل">
            ${ICONS.expandAll}
            توسيع الكل
          </button>
          <button id="cust-btn-collapse-all" class="exec-btn-tool" title="طي الكل">
            ${ICONS.collapseAll}
            طي الكل
          </button>
          <button id="cust-btn-export-excel" class="exec-btn-tool" title="تصدير Excel">
            ${ICONS.excel}
            تصدير Excel
          </button>
        </div>
      </div>

      <!-- TreeTable Mount Point -->
      <div id="cust-tree-container" class="tree-table-wrap" data-scroll-x="true" style="overflow-x:auto;width:100%;box-sizing:border-box;"></div>
    </div>

    <!-- Statement Slide-over / Modal Container -->
    <div id="cust-statement-modal" style="display:none;position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);align-items:center;justify-content:center;padding:20px;">
      <div id="cust-statement-card" style="background:var(--bg-surface);border:1px solid var(--border-default);border-radius:18px;width:1100px;max-width:96vw;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 25px 50px rgba(0,0,0,0.4);overflow:hidden;">
        <!-- Header -->
        <div style="padding:16px 20px;border-bottom:1px solid var(--border-default);display:flex;align-items:center;justify-content:space-between;background:var(--bg-subtle);">
          <div style="display:flex;align-items:center;gap:12px;">
            <div>
              <h3 id="stmt-partner-name" style="margin:0;font-size:1.15rem;font-weight:700;color:var(--text-primary);">كشف حساب عميل</h3>
              <span id="stmt-meta-info" style="font-size:12px;color:var(--text-muted);">—</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <button id="stmt-btn-pdf" class="bi-btn bi-btn-primary" style="padding:6px 14px;font-size:12px;">
              تصدير PDF
            </button>
            <button id="stmt-btn-close" class="bi-btn bi-btn-secondary" style="padding:6px 12px;font-size:12px;">
              ✕ إغلاق
            </button>
          </div>
        </div>
        <!-- Body -->
        <div id="stmt-content-body" style="flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:16px;"></div>
      </div>
    </div>
  `;

  // Attach toggles
  const agingToggle = contentEl.querySelector('#cust-aging-toggle');
  const agingBody = contentEl.querySelector('#cust-aging-body');
  const agingBadge = contentEl.querySelector('#cust-aging-badge');
  agingToggle?.addEventListener('click', () => {
    isAgingOpen = !isAgingOpen;
    if (agingBody) agingBody.style.display = isAgingOpen ? 'grid' : 'none';
    if (agingBadge) agingBadge.textContent = isAgingOpen ? 'إخفاء ▲' : 'عرض الشرائح ▾';
  });

  const returnsToggle = contentEl.querySelector('#cust-returns-toggle');
  const returnsBody = contentEl.querySelector('#cust-returns-body');
  const returnsBadge = contentEl.querySelector('#cust-returns-badge');
  returnsToggle?.addEventListener('click', () => {
    isReturnsOpen = !isReturnsOpen;
    if (returnsBody) returnsBody.style.display = isReturnsOpen ? 'flex' : 'none';
    if (returnsBadge) returnsBadge.textContent = isReturnsOpen ? 'إخفاء ▲' : `عرض (${(data.returns_list || []).length}) ▾`;
  });

  const returnsSearchInput = contentEl.querySelector('#cust-returns-search');
  returnsSearchInput?.addEventListener('input', (e) => {
    returnsSearchQuery = e.target.value.trim().toLowerCase();
    const wrapper = contentEl.querySelector('#cust-returns-table-wrapper');
    if (wrapper) {
      wrapper.innerHTML = renderReturnsTable(data.returns_list || [], returnsSearchQuery);
    }
  });

  // Main TreeTable initialization
  const treeContainer = contentEl.querySelector('#cust-tree-container');
  if (treeContainer) {
    initTreeTable(treeContainer, data, periodParams);
  }

  // TreeTable search
  const treeSearchInput = contentEl.querySelector('#cust-tree-search');
  const treeClearBtn = contentEl.querySelector('#btn-cust-clear-search');
  const treeCountEl = contentEl.querySelector('#cust-search-counter');
  if (treeSearchInput && currentTreeTable && currentTreeTable.bindSearchInput) {
    currentTreeTable.bindSearchInput(treeSearchInput, {
      clearButton: treeClearBtn,
      countElement: treeCountEl
    });
  }

  contentEl.querySelector('#cust-btn-expand-all')?.addEventListener('click', () => {
    if (currentTreeTable) {
      const keys = [];
      const traverseKeys = (node, parentPath, depth) => {
        const key = currentTreeTable.getNodeKey(node, parentPath, depth);
        keys.push(key);
        const kids = currentTreeTable.getChildren(node) || [];
        for (const k of kids) traverseKeys(k, key, depth + 1);
      };
      for (const root of currentTreeTable.data) traverseKeys(root, '', 0);
      currentTreeTable.expandAll(keys);
    }
  });

  contentEl.querySelector('#cust-btn-collapse-all')?.addEventListener('click', () => {
    if (currentTreeTable) currentTreeTable.collapseAll();
  });

  contentEl.querySelector('#cust-btn-export-excel')?.addEventListener('click', () => {
    exportCustomersExcel();
  });

  // Modal close handlers
  const modalEl = contentEl.querySelector('#cust-statement-modal');
  contentEl.querySelector('#stmt-btn-close')?.addEventListener('click', () => {
    if (modalEl) modalEl.style.display = 'none';
  });
  modalEl?.addEventListener('click', (e) => {
    if (e.target === modalEl) modalEl.style.display = 'none';
  });
}

function renderAgingBucketsGrid(buckets, totalResidual) {
  const list = [
    { key: 'not_due', label: 'غير مستحق', color: '#10b981', desc: 'لم يحل أجلها' },
    { key: 'b1_30', label: '1 - 30 يوم', color: '#3b82f6', desc: 'تأخر حتى شهر' },
    { key: 'b31_60', label: '31 - 60 يوم', color: '#06b6d4', desc: 'تأخر شهر لشهرين' },
    { key: 'b61_90', label: '61 - 90 يوم', color: '#f59e0b', desc: 'تأخر 2 لـ 3 أشهر' },
    { key: 'b91_180', label: '91 - 180 يوم', color: '#f97316', desc: 'تأخر 3 لـ 6 أشهر' },
    { key: 'b181_365', label: '181 - 365 يوم', color: '#ef4444', desc: 'تأخر نصف سنة لسنة' },
    { key: 'over_365', label: 'أكثر من سنة', color: '#991b1b', desc: 'ديون متعثرة +1 سنة' }
  ];

  return list.map(b => {
    const val = buckets[b.key] || 0;
    const pct = totalResidual > 0 ? ((val / totalResidual) * 100).toFixed(1) : 0;
    return `
      <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:12px;border-top:3px solid ${b.color};display:flex;flex-direction:column;gap:4px;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:0.82rem;font-weight:700;color:var(--exec-text, #fff);">${b.label}</span>
          <span class="exec-num" style="font-size:0.75rem;color:${b.color};font-weight:700;">${pct}%</span>
        </div>
        <div class="exec-num" style="font-size:1.15rem;font-weight:800;color:${val > 0 ? b.color : 'var(--exec-text-muted, rgba(255,255,255,0.3))'};">
          ${Math.round(val).toLocaleString('en-US')}
        </div>
        <div style="width:100%;height:4px;background:rgba(255,255,255,0.08);border-radius:2px;overflow:hidden;margin-top:2px;">
          <div style="width:${Math.min(100, pct)}%;height:100%;background:${b.color};"></div>
        </div>
        <span style="font-size:0.7rem;color:var(--exec-text-muted, rgba(255,255,255,0.4));">${b.desc}</span>
      </div>
    `;
  }).join('');
}

function renderReturnsTable(returnsList, query) {
  let list = returnsList;
  if (query) {
    list = list.filter(r => 
      (r.invoice_name && r.invoice_name.toLowerCase().includes(query)) ||
      (r.partner_name && r.partner_name.toLowerCase().includes(query)) ||
      (r.department_name && r.department_name.toLowerCase().includes(query)) ||
      (r.company_name && r.company_name.toLowerCase().includes(query))
    );
  }

  if (list.length === 0) {
    return `<div style="text-align:center;padding:24px;color:rgba(255,255,255,0.4);font-size:0.9rem;">لا توجد مرتجعات مطابقة للبحث</div>`;
  }

  return `
    <table class="bi-table" style="width:100%;font-size:0.88rem;border-collapse:collapse;">
      <thead>
        <tr style="background:rgba(255,255,255,0.04);border-bottom:1px solid rgba(255,255,255,0.1);">
          <th style="padding:10px 14px;text-align:right;">رقم الإشعار / المرتجع</th>
          <th style="padding:10px 14px;text-align:right;">التاريخ</th>
          <th style="padding:10px 14px;text-align:right;">الشركة</th>
          <th style="padding:10px 14px;text-align:right;">القسم</th>
          <th style="padding:10px 14px;text-align:right;">العميل</th>
          <th style="padding:10px 14px;text-align:left;">المبلغ الإجمالي</th>
          <th style="padding:10px 14px;text-align:left;">المتبقي</th>
          <th style="padding:10px 14px;text-align:center;">الحالة</th>
        </tr>
      </thead>
      <tbody>
        ${list.map(r => `
          <tr style="border-bottom:1px solid rgba(255,255,255,0.03);">
            <td style="padding:9px 14px;font-family:var(--font-en);font-weight:700;color:#f59e0b;">${escapeHtml(r.invoice_name)}</td>
            <td style="padding:9px 14px;font-family:var(--font-en);color:rgba(255,255,255,0.7);">${escapeHtml(r.date)}</td>
            <td style="padding:9px 14px;color:rgba(255,255,255,0.8);">${escapeHtml(r.company_name)}</td>
            <td style="padding:9px 14px;color:rgba(255,255,255,0.7);">${escapeHtml(r.department_name)}</td>
            <td style="padding:9px 14px;color:rgba(255,255,255,0.9);font-weight:600;">${escapeHtml(r.partner_name)}</td>
            <td style="padding:9px 14px;text-align:left;font-family:var(--font-en);font-weight:700;color:#f59e0b;">${(r.amount_total || 0).toLocaleString('en-US')}</td>
            <td style="padding:9px 14px;text-align:left;font-family:var(--font-en);color:rgba(255,255,255,0.6);">${(r.residual || 0).toLocaleString('en-US')}</td>
            <td style="padding:9px 14px;text-align:center;">
              <span style="font-size:0.75rem;padding:2px 8px;border-radius:4px;background:${r.payment_state === 'paid' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'};color:${r.payment_state === 'paid' ? '#10b981' : '#ef4444'};">
                ${r.payment_state === 'paid' ? 'مسدد' : (r.payment_state === 'not_paid' ? 'غير مسدد' : escapeHtml(r.payment_state))}
              </span>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

const mainColumns = [
  { id: 'name', label: 'البيان', minWidth: '180px', align: 'right', priority: 1 },
  { id: 'inv_count', label: 'الفواتير', align: 'left', width: '55px', minWidth: '45px', priority: 2 },
  { id: 'billed', label: 'المفوتر', align: 'left', width: '85px', minWidth: '70px', priority: 1 },
  { id: 'returns', label: 'الإشعارات', align: 'left', width: '80px', minWidth: '65px', priority: 2 },
  { id: 'net', label: 'صافي الفواتير', align: 'left', width: '85px', minWidth: '70px', priority: 1 },
  { id: 'collected', label: 'المحصّل', align: 'left', width: '85px', minWidth: '70px', priority: 1 },
  { id: 'residual', label: 'المتبقي', align: 'left', width: '85px', minWidth: '70px', priority: 1 },
  { id: 'collection_rate', label: 'نسبة التحصيل', align: 'center', width: '100px', minWidth: '85px', priority: 2 },
  { id: 'overdue_90', label: 'متأخر +90', align: 'left', width: '85px', minWidth: '70px', priority: 2 }
];

function renderAgingVisual(node) {
  const res = (node.residual !== undefined ? node.residual : node.total_residual) || 0;
  if (res <= 0) {
    return `<div style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:0.75rem;background:rgba(16,185,129,0.12);color:#10b981;font-weight:600;">مسدد ✓</div>`;
  }
  let notDue = 0, b1_90 = 0, over90 = 0;
  if (node.buckets) {
    notDue = Math.max(0, node.buckets.not_due || 0);
    b1_90 = Math.max(0, (node.buckets.b1_30 || 0) + (node.buckets.b31_60 || 0) + (node.buckets.b61_90 || 0));
    over90 = Math.max(0, (node.buckets.b91_180 || 0) + (node.buckets.b181_365 || 0) + (node.buckets.over_365 || 0));
  } else if (node.type === 'invoice') {
    const age = node.avg_age || node.age_days || 0;
    if (age <= 0) notDue = res;
    else if (age <= 90) b1_90 = res;
    else over90 = res;
  }
  const sum = notDue + b1_90 + over90;
  if (sum <= 0) return '—';
  const pNotDue = (notDue / sum * 100).toFixed(1);
  const pB1_90 = (b1_90 / sum * 100).toFixed(1);
  const pOver90 = (over90 / sum * 100).toFixed(1);
  const tip = `غير مستحق: ${Math.round(notDue).toLocaleString('en-US')} (${pNotDue}%)\nمتأخر 1-90 يوم: ${Math.round(b1_90).toLocaleString('en-US')} (${pB1_90}%)\nمتأخر +90 يوم: ${Math.round(over90).toLocaleString('en-US')} (${pOver90}%)`;
  return `
    <div title="${escapeHtml(tip)}" style="display:flex;width:100%;height:10px;background:rgba(255,255,255,0.08);border-radius:5px;overflow:hidden;min-width:120px;cursor:help;">
      ${notDue > 0 ? `<div style="width:${pNotDue}%;background:#10b981;height:100%;"></div>` : ''}
      ${b1_90 > 0 ? `<div style="width:${pB1_90}%;background:#f59e0b;height:100%;"></div>` : ''}
      ${over90 > 0 ? `<div style="width:${pOver90}%;background:#ef4444;height:100%;"></div>` : ''}
    </div>
  `;
}

function initTreeTable(container, data, periodParams) {
  const treeData = data.tree || [];
  const totals = data.totals || {};

  currentTreeTable = createTreeTable(container, {
    storageKey: 'mizaniat_cust_tree_expanded',
    columns: mainColumns,
    data: treeData,
    totals,
    showZeroItems: store.get('showZeroItems') ?? false,
    getNodeKey: (node, parentPath, depth) => {
      let type = node.type;
      if (!type) {
        if (depth === 0) type = 'co';
        else if (depth === 1) type = 'dept';
        else if (depth === 2) type = 'journal';
        else if (depth === 3) type = 'partner';
        else type = 'inv';
      }
      const id = node.id !== undefined ? String(node.id) : (node.journal_id !== undefined ? String(node.journal_id) : (node.name || 'item'));
      return parentPath ? `${parentPath}/${type}:${id}` : `${type}:${id}`;
    },
    getChildren: (node) => {
      return node.departments || node.journals || node.partners || node.invoices || node.children || [];
    },
    hasChildren: (node) => {
      if (node.departments && node.departments.length > 0) return true;
      if (node.journals && node.journals.length > 0) return true;
      if (node.partners && node.partners.length > 0) return true;
      if (node.type === 'partner' && (node._canLoad || (node.invoices && node.invoices.length > 0))) return true;
      if (node.invoices && node.invoices.length > 0) return true;
      return false;
    },
    loadChildren: async (node, pathKey) => {
      // Lazy load invoices when customer node is clicked
      if (node.type === 'partner') {
        try {
          const res = await api.getCustomersCollectionInvoices({
            companyId: node.company_id,
            partnerId: node.id,
            departmentId: node.department_id,
            journalId: node.journal_id,
            years: periodParams.years,
            dateFrom: periodParams.dateFrom,
            dateTo: periodParams.dateTo
          });
          const rawInvoices = res.invoices || [];
          const invoices = rawInvoices.map(inv => {
            const isRet = (inv.amount_total || 0) < 0;
            const tot = Number(inv.amount_total) || 0;
            const resSigned = Number(inv.amount_residual_signed) || 0;
            const billed = isRet ? 0 : tot;
            const returns = isRet ? Math.abs(tot) : 0;
            const net = tot;
            const collected = isRet ? 0 : (tot - resSigned);
            const residual = resSigned;
            const rate = (net > 0 && collected > 0) ? Math.round((collected / net) * 100) : 0;
            const ageDays = inv.age_days || 0;
            const overdue90 = (ageDays > 90 && residual > 0) ? residual : 0;
            return {
              id: inv.id,
              name: inv.invoice_name,
              invoice_name: inv.invoice_name,
              type: 'invoice',
              isLeaf: true,
              invoice_date: inv.invoice_date,
              due_date: inv.due_date,
              payment_state: inv.payment_state,
              inv_count: 1,
              billed: Math.round(billed),
              returns: Math.round(returns),
              net: Math.round(net),
              collected: Math.round(collected),
              residual: Math.round(residual),
              overdue_90: Math.round(overdue90),
              collection_rate: rate,
              avg_age: ageDays,
              isReturn: isRet
            };
          });
          node.invoices = invoices;
          return invoices;
        } catch (err) {
          console.error('[TreeTable] Failed to load invoices for partner:', node.id, err);
          return [];
        }
      }
      return [];
    },
    renderRow: ({ node, pathKey, depth, isExpanded, hasKids, isLeaf }) => {
      const isCo = depth === 0 || node.type === 'co';
      const isDept = depth === 1 || node.type === 'dept';
      const isJournal = depth === 2 || node.type === 'journal' || !!node.isJournal;
      const isPartner = depth === 3 || node.type === 'partner';
      const isInvoice = depth === 4 || node.type === 'invoice';

      const indent = depth * 22;

      let iconSvg = '';
      if (node._loading) {
        iconSvg = `<svg class="spin-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;animation:spin 0.8s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;
      } else if (hasKids) {
        if (isExpanded) {
          iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><polyline points="6 9 12 15 18 9"/></svg>`;
        } else {
          iconSvg = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;"><polyline points="15 18 9 12 15 6"/></svg>`;
        }
      }

      let companyDot = '';
      if (isCo) {
        const cid = node.company_id != null ? node.company_id : Number(String(node.id).replace(/^co_?/, ''));
        companyDot = `<span class="company-dot" style="background:var(--company-${cid || 1});"></span>`;
      }

      const cursor = hasKids ? 'cursor:pointer;' : (isPartner ? 'cursor:pointer;' : '');
      const rowStyle = isCo
        ? 'font-weight:700;background:var(--bg-hover);color:var(--text-primary);'
        : (isDept
            ? 'font-weight:600;color:var(--text-secondary);'
            : 'color:var(--text-secondary);');

      const nodeColor = isPartner
        ? 'color:var(--text-primary);font-weight:600;'
        : (isJournal
            ? 'color:var(--text-secondary);font-weight:500;'
            : (depth > 0 ? 'color:var(--text-secondary);' : 'color:var(--text-primary);'));

      // Action button on partner row: subtle SVG statement trigger
      let stmtBtn = '';
      if (isPartner) {
        stmtBtn = `
          <button class="btn-stmt-trigger" data-co="${node.company_id}" data-pid="${node.id}" data-dept="${node.department_id || ''}" data-journal="${node.journal_id || ''}" title="كشف حساب العميل" style="background:var(--bg-subtle);color:var(--brand-accent);border:1px solid var(--border-default);border-radius:6px;width:24px;height:24px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;margin-right:6px;padding:0;vertical-align:middle;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
          </button>
        `;
      }

      const invCountDisplay = node.inv_count !== undefined
        ? Number(node.inv_count).toLocaleString('en-US')
        : (isInvoice ? '1' : '—');

      const overdueVal = (node.overdue_90 || 0) > 0
        ? `<span class="exec-num text-negative" style="color:var(--status-negative);font-weight:600;">${fmtVal(node.overdue_90)}</span>`
        : '—';

      // Collection Rate bar
      let rateCell = '—';
      if (node.collection_rate !== null && node.collection_rate !== undefined) {
        const rateNum = Number(node.collection_rate);
        const rateColor = rateNum >= 60 ? 'var(--status-positive)' : 'var(--status-warning)';
        rateCell = `
          <div style="display:flex;align-items:center;justify-content:center;gap:6px;">
            <div style="width:36px;height:4px;background:var(--bg-subtle);border-radius:2px;overflow:hidden;">
              <div style="width:${Math.min(100, Math.max(0, rateNum))}%;height:100%;background:${rateColor};"></div>
            </div>
            <span class="exec-num" style="font-size:12px;font-weight:600;"><span dir="ltr" class="tabular-nums" style="display:inline-block;direction:ltr;">${rateNum.toFixed(1)}%</span></span>
          </div>
        `;
      }

      return `
        <tr data-tree-row="true" data-path-key="${escapeHtml(pathKey)}" style="${cursor} ${rowStyle}">
          <td class="tree-col-name" data-col-id="name" data-priority="1" style="padding-top:12px !important;padding-bottom:12px !important;padding-left:14px !important;padding-right:${indent + 14}px !important;text-align:right;">
            <span data-tree-toggle="true" style="display:inline-block;width:18px;color:var(--text-muted);">${iconSvg}</span>
            ${companyDot}
            <span style="${nodeColor}">${escapeHtml(node.name || '')}</span>
            ${stmtBtn}
            ${isInvoice ? `<span style="font-size:11px;color:var(--text-muted);margin-right:6px;">(${escapeHtml(node.invoice_date || '')})</span>` : ''}
            ${isInvoice && node.journal_name ? `<span class="badge-journal" style="font-size:11px;background:var(--bg-subtle);color:var(--text-secondary);border:1px solid var(--border-default);padding:1px 6px;border-radius:4px;margin-right:6px;" title="الدفتر الأصلي: ${escapeHtml(node.journal_name)}">${escapeHtml(node.journal_name)}</span>` : ''}
          </td>
          <td class="tree-col-num tabular-nums" data-col-id="inv_count" data-priority="2" style="text-align:left;padding:8px 10px;">${invCountDisplay}</td>
          <td class="tree-col-num tabular-nums" data-col-id="billed" data-priority="1" style="text-align:left;padding:8px 10px;">${fmtVal(node.billed)}</td>
          <td class="tree-col-num tabular-nums" data-col-id="returns" data-priority="2" style="text-align:left;padding:8px 10px;">${fmtVal(node.returns)}</td>
          <td class="tree-col-num tabular-nums" data-col-id="net" data-priority="1" style="text-align:left;padding:8px 10px;font-weight:600;">${fmtVal(node.net)}</td>
          <td class="tree-col-num tabular-nums" data-col-id="collected" data-priority="1" style="text-align:left;padding:8px 10px;">${fmtVal(node.collected)}</td>
          <td class="tree-col-num tabular-nums" data-col-id="residual" data-priority="1" style="text-align:left;padding:8px 10px;font-weight:600;color:var(--text-primary);">${fmtVal(node.residual)}</td>
          <td class="tree-col-visual" data-col-id="collection_rate" data-priority="2" style="text-align:center;padding:8px 10px;">${rateCell}</td>
          <td class="tree-col-num tabular-nums" data-col-id="overdue_90" data-priority="2" style="text-align:left;padding:8px 10px;">${overdueVal}</td>
        </tr>
      `;
    },
    renderTotals: (totals) => {
      const totInv = totals.inv_count !== undefined ? Number(totals.inv_count).toLocaleString('en-US') : (totals.invoices_count ? Number(totals.invoices_count).toLocaleString('en-US') : '—');
      const totRate = totals.collection_rate != null ? Number(totals.collection_rate) : 0;
      const rateColor = totRate >= 60 ? 'var(--status-positive)' : 'var(--status-warning)';
      const overdueVal = (totals.overdue_90 || 0) > 0
        ? `<span class="exec-num text-negative" style="color:var(--status-negative);font-weight:700;">${fmtVal(totals.overdue_90)}</span>`
        : '—';

      return `
        <tr class="exec-sticky-footer" style="background:var(--bg-subtle);font-weight:700;border-top:2px solid var(--border-default);">
          <td class="tree-col-name" data-col-id="name" data-priority="1" style="padding:14px 14px;font-size:14px;color:var(--text-primary);">الإجمالي</td>
          <td class="tree-col-num tabular-nums" data-col-id="inv_count" data-priority="2" style="text-align:left;padding:14px 10px;">${totInv}</td>
          <td class="tree-col-num tabular-nums" data-col-id="billed" data-priority="1" style="text-align:left;padding:14px 10px;">${fmtVal(totals.total_billed)}</td>
          <td class="tree-col-num tabular-nums" data-col-id="returns" data-priority="2" style="text-align:left;padding:14px 10px;">${fmtVal(totals.total_returns)}</td>
          <td class="tree-col-num tabular-nums" data-col-id="net" data-priority="1" style="text-align:left;padding:14px 10px;">${fmtVal(totals.total_net)}</td>
          <td class="tree-col-num tabular-nums" data-col-id="collected" data-priority="1" style="text-align:left;padding:14px 10px;">${fmtVal(totals.total_collected)}</td>
          <td class="tree-col-num tabular-nums" data-col-id="residual" data-priority="1" style="text-align:left;padding:14px 10px;color:var(--text-primary);">${fmtVal(totals.total_residual)}</td>
          <td class="tree-col-visual" data-col-id="collection_rate" data-priority="2" style="text-align:center;padding:14px 10px;">
            <div style="display:flex;align-items:center;justify-content:center;gap:6px;">
              <div style="width:36px;height:4px;background:var(--bg-surface);border-radius:2px;overflow:hidden;">
                <div style="width:${Math.min(100, Math.max(0, totRate))}%;height:100%;background:${rateColor};"></div>
              </div>
              <span class="exec-num" style="font-size:12px;font-weight:700;"><span dir="ltr" class="tabular-nums" style="display:inline-block;direction:ltr;">${totRate.toFixed(1)}%</span></span>
            </div>
          </td>
          <td class="tree-col-num" data-col-id="overdue_90" data-priority="2" style="text-align:left;padding:14px 18px;">${overdueVal}</td>
        </tr>
      `;
    },
    onLeafClick: (node, pathKey, e) => {
      // If clicking on statement button or partner row, open statement
      if (node.type === 'partner') {
        openCustomerStatement(node.company_id, node.id, node.department_id, periodParams);
      }
    }
  });

  // Attach statement trigger button delegation
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-stmt-trigger');
    if (btn) {
      e.stopPropagation();
      const co = Number(btn.dataset.co);
      const pid = Number(btn.dataset.pid);
      const dept = btn.dataset.dept ? Number(btn.dataset.dept) : undefined;
      openCustomerStatement(co, pid, dept, periodParams);
    }
  });
}


function exportCustomersExcel() {
  if (!currentData || !window.XLSX) {
    alert('بيانات التقرير أو مكتبة Excel غير متوفرة');
    return;
  }
  const rows = [
    ['الشركة', 'المجموعة', 'دفتر اليومية / مركز التكلفة', 'العميل', 'عدد الفواتير', 'المفوتر', 'المرتجعات', 'الصافي', 'المحصّل', 'المتبقي', 'نسبة التحصيل %', 'متأخر +90', 'متوسط العمر (يوم)']
  ];

  for (const co of (currentData.tree || [])) {
    for (const dept of (co.departments || [])) {
      for (const j of (dept.journals || [])) {
        for (const p of (j.partners || [])) {
          rows.push([
            co.name || '',
            dept.name || '',
            j.name || '',
            p.name || '',
            p.inv_count || 0,
            p.billed || 0,
            p.returns || 0,
            p.net || 0,
            p.collected || 0,
            p.residual || 0,
            p.collection_rate || 0,
            p.overdue_90 || 0,
            p.avg_age || 0
          ]);
        }
      }
    }
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, 'سجل العملاء والتحصيل');
  const periodLabel = currentData.meta?.period_label ? `_${currentData.meta.period_label.replace(/[\s/\\:]+/g, '_')}` : '';
  XLSX.writeFile(wb, `customers_collection${periodLabel}.xlsx`);
}

/**
 * Customer Account Statement Modal (كشف حساب العميل)
 */
async function openCustomerStatement(companyId, partnerId, departmentId, periodParams) {
  const modalEl = document.querySelector('#cust-statement-modal');
  const titleEl = document.querySelector('#stmt-partner-name');
  const metaEl = document.querySelector('#stmt-meta-info');
  const bodyEl = document.querySelector('#stmt-content-body');
  const pdfBtn = document.querySelector('#stmt-btn-pdf');

  if (!modalEl || !bodyEl) return;

  modalEl.style.display = 'flex';
  if (titleEl) titleEl.textContent = 'جاري تحميل كشف الحساب...';
  if (metaEl) metaEl.textContent = 'يرجى الانتظار';
  bodyEl.innerHTML = `
    <div style="text-align:center;padding:60px 20px;color:var(--text-muted);">
      <svg class="spin-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;animation:spin 0.8s linear infinite;margin-bottom:8px;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
      <div>جاري تجميع حركات العميل والرصيد التراكمي...</div>
    </div>
  `;

  try {
    const stmt = await api.getCustomerStatement({
      companyId,
      partnerId,
      departmentId,
      years: periodParams.years,
      dateFrom: periodParams.dateFrom,
      dateTo: periodParams.dateTo
    });

    activeStatementModal = stmt;

    if (titleEl) titleEl.textContent = stmt.partner?.name || 'كشف حساب عميل';
    if (metaEl) {
      metaEl.textContent = `${stmt.company?.name || ''} | الفترة: ${stmt.period_label || 'الحالية'} | عدد الحركات: ${stmt.summary?.doc_count || 0}`;
    }

    renderStatementBody(bodyEl, stmt);

    if (pdfBtn) {
      pdfBtn.onclick = () => exportStatementToPdf(stmt);
    }
  } catch (err) {
    console.error('[CustomerStatement] Error:', err);
    bodyEl.innerHTML = `
      <div style="text-align:center;padding:40px;color:#ef4444;">
        ❌ تعذر تحميل كشف حساب العميل: ${escapeHtml(err.message)}
      </div>
    `;
  }
}

function renderStatementBody(container, stmt) {
  const sm = stmt.summary || {};
  const items = stmt.items || [];

  container.innerHTML = `
    <!-- Printable Statement Header (visible on screen and in PDF) -->
    <div id="stmt-print-area" style="display:flex;flex-direction:column;gap:18px;background:transparent;">
      
      <!-- Summary Cards -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:12px;">
        
        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:12px;border-top:3px solid #3b82f6;">
          <span style="font-size:0.78rem;color:rgba(255,255,255,0.55);">إجمالي المفوتر</span>
          <div class="exec-num" style="font-size:1.25rem;font-weight:800;color:#3b82f6;margin-top:4px;">${(sm.total_billed || 0).toLocaleString('en-US')}</div>
        </div>

        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:12px;border-top:3px solid #f59e0b;">
          <span style="font-size:0.78rem;color:rgba(255,255,255,0.55);">إجمالي المرتجعات</span>
          <div class="exec-num" style="font-size:1.25rem;font-weight:800;color:#f59e0b;margin-top:4px;">${(sm.total_returns || 0).toLocaleString('en-US')}</div>
        </div>

        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:12px;border-top:3px solid #8b5cf6;">
          <span style="font-size:0.78rem;color:rgba(255,255,255,0.55);">الصافي</span>
          <div class="exec-num" style="font-size:1.25rem;font-weight:800;color:#a78bfa;margin-top:4px;">${(sm.net_billed || 0).toLocaleString('en-US')}</div>
        </div>

        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:12px;border-top:3px solid #10b981;">
          <span style="font-size:0.78rem;color:rgba(255,255,255,0.55);">إجمالي المسدد</span>
          <div class="exec-num" style="font-size:1.25rem;font-weight:800;color:#10b981;margin-top:4px;">${(sm.total_paid || 0).toLocaleString('en-US')}</div>
        </div>

        <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:12px;border-top:3px solid #ef4444;">
          <span style="font-size:0.78rem;color:rgba(255,255,255,0.55);">الرصيد المتبقي</span>
          <div class="exec-num" style="font-size:1.25rem;font-weight:800;color:#ef4444;margin-top:4px;">${(sm.total_residual || 0).toLocaleString('en-US')}</div>
        </div>

      </div>

      <!-- Sequential Ledger Table -->
      <div style="overflow-x:auto;border:1px solid rgba(255,255,255,0.08);border-radius:12px;">
        <table class="bi-table" style="width:100%;font-size:0.86rem;border-collapse:collapse;">
          <thead>
            <tr style="background:rgba(255,255,255,0.05);border-bottom:2px solid rgba(255,255,255,0.12);">
              <th style="padding:10px 12px;text-align:right;">#</th>
              <th style="padding:10px 12px;text-align:right;">التاريخ</th>
              <th style="padding:10px 12px;text-align:right;">نوع الحركة</th>
              <th style="padding:10px 12px;text-align:right;">رقم المستند</th>
              <th style="padding:10px 12px;text-align:left;">مدين (فاتورة)</th>
              <th style="padding:10px 12px;text-align:left;">دائن (سداد/مرتجع)</th>
              <th style="padding:10px 12px;text-align:left;">المسدد</th>
              <th style="padding:10px 12px;text-align:left;">المتبقي</th>
              <th style="padding:10px 12px;text-align:left;color:#60a5fa;">الرصيد التراكمي</th>
              <th style="padding:10px 12px;text-align:center;">عمر الفاتورة</th>
            </tr>
          </thead>
          <tbody>
            ${items.length === 0 ? `
              <tr>
                <td colspan="10" style="text-align:center;padding:30px;color:rgba(255,255,255,0.4);">
                  لا توجد حركات مسجلة لهذا العميل في الفترة المحددة
                </td>
              </tr>
            ` : items.map((item, idx) => `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.03);background:${item.type === 'return' ? 'rgba(245,158,11,0.04)' : ''};">
                <td style="padding:8px 12px;color:rgba(255,255,255,0.4);font-family:var(--font-en);">${idx + 1}</td>
                <td style="padding:8px 12px;font-family:var(--font-en);color:rgba(255,255,255,0.8);">${escapeHtml(item.date)}</td>
                <td style="padding:8px 12px;">
                  <span style="font-size:0.75rem;padding:2px 8px;border-radius:4px;background:${item.type === 'return' ? 'rgba(245,158,11,0.15)' : 'rgba(59,130,246,0.15)'};color:${item.type === 'return' ? '#f59e0b' : '#60a5fa'};font-weight:700;">
                    ${item.type_label}
                  </span>
                </td>
                <td style="padding:8px 12px;font-family:var(--font-en);font-weight:700;">${escapeHtml(item.doc_number)}</td>
                <td style="padding:8px 12px;text-align:left;font-family:var(--font-en);">${item.debit > 0 ? item.debit.toLocaleString('en-US') : '—'}</td>
                <td style="padding:8px 12px;text-align:left;font-family:var(--font-en);color:#f59e0b;">${item.credit > 0 ? item.credit.toLocaleString('en-US') : '—'}</td>
                <td style="padding:8px 12px;text-align:left;font-family:var(--font-en);color:#10b981;">${item.paid > 0 ? item.paid.toLocaleString('en-US') : '—'}</td>
                <td style="padding:8px 12px;text-align:left;font-family:var(--font-en);color:#ef4444;">${item.residual > 0 ? item.residual.toLocaleString('en-US') : '0'}</td>
                <td style="padding:8px 12px;text-align:left;font-family:var(--font-en);font-weight:800;color:#60a5fa;">${item.running_balance.toLocaleString('en-US')}</td>
                <td style="padding:8px 12px;text-align:center;font-family:var(--font-en);color:rgba(255,255,255,0.6);">${item.age_days || 0} يوم</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr style="background:rgba(255,255,255,0.06);border-top:2px solid rgba(255,255,255,0.15);font-weight:800;">
              <td colspan="4" style="padding:10px 12px;">الإجمالي</td>
              <td style="padding:10px 12px;text-align:left;font-family:var(--font-en);">${(sm.total_billed || 0).toLocaleString('en-US')}</td>
              <td style="padding:10px 12px;text-align:left;font-family:var(--font-en);color:#f59e0b;">${(sm.total_returns || 0).toLocaleString('en-US')}</td>
              <td style="padding:10px 12px;text-align:left;font-family:var(--font-en);color:#10b981;">${(sm.total_paid || 0).toLocaleString('en-US')}</td>
              <td style="padding:10px 12px;text-align:left;font-family:var(--font-en);color:#ef4444;">${(sm.total_residual || 0).toLocaleString('en-US')}</td>
              <td style="padding:10px 12px;text-align:left;font-family:var(--font-en);color:#60a5fa;">${(sm.total_residual || 0).toLocaleString('en-US')}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

    </div>
  `;
}

/**
 * Export Customer Statement to Landscape PDF (A4 via html2canvas & jsPDF)
 */
async function exportStatementToPdf(stmt) {
  const sm = stmt.summary || {};
  const partnerName = stmt.partner?.name || 'Customer';
  const companyName = stmt.company?.name || 'Mizaniat BI';
  const periodLabel = stmt.period_label || 'Current Period';
  const dateStr = new Date().toISOString().slice(0, 10);

  // Build high-resolution print container with clean white background
  const printContainer = document.createElement('div');
  printContainer.style.position = 'fixed';
  printContainer.style.top = '-9999px';
  printContainer.style.left = '-9999px';
  printContainer.style.width = '1200px';
  printContainer.style.background = '#ffffff';
  printContainer.style.color = '#0f172a';
  printContainer.style.padding = '36px 40px';
  printContainer.style.direction = 'rtl';
  printContainer.style.fontFamily = 'Cairo, system-ui, -apple-system, sans-serif';

  printContainer.innerHTML = `
    <!-- Header -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #2563eb;padding-bottom:16px;margin-bottom:20px;">
      <div>
        <h1 style="margin:0 0 6px 0;font-size:22px;color:#1e3a8a;">كشف حساب عميل تفصيلي</h1>
        <div style="font-size:14px;color:#475569;">
          <strong>العميل:</strong> ${escapeHtml(partnerName)} (رقم: ${stmt.partner?.id || ''})
        </div>
        <div style="font-size:13px;color:#64748b;margin-top:2px;">
          <strong>الشركة:</strong> ${escapeHtml(companyName)} | <strong>الفترة:</strong> ${escapeHtml(periodLabel)}
        </div>
      </div>
      <div style="text-align:left;direction:ltr;">
        <div style="font-size:18px;font-weight:900;color:#2563eb;letter-spacing:1px;">MIZANIAT BI</div>
        <div style="font-size:12px;color:#64748b;margin-top:4px;">تاريخ الطباعة: ${dateStr}</div>
      </div>
    </div>

    <!-- Summary Box -->
    <div style="display:grid;grid-template-columns:repeat(5, 1fr);gap:12px;margin-bottom:22px;">
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;text-align:center;">
        <div style="font-size:11px;color:#64748b;">إجمالي المفوتر</div>
        <div style="font-size:16px;font-weight:800;color:#2563eb;margin-top:2px;">${(sm.total_billed || 0).toLocaleString('en-US')}</div>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;text-align:center;">
        <div style="font-size:11px;color:#64748b;">إجمالي المرتجعات</div>
        <div style="font-size:16px;font-weight:800;color:#d97706;margin-top:2px;">${(sm.total_returns || 0).toLocaleString('en-US')}</div>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;text-align:center;">
        <div style="font-size:11px;color:#64748b;">الصافي بعد المرتجع</div>
        <div style="font-size:16px;font-weight:800;color:#7c3aed;margin-top:2px;">${(sm.net_billed || 0).toLocaleString('en-US')}</div>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;text-align:center;">
        <div style="font-size:11px;color:#64748b;">إجمالي المسدد</div>
        <div style="font-size:16px;font-weight:800;color:#059669;margin-top:2px;">${(sm.total_paid || 0).toLocaleString('en-US')}</div>
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;text-align:center;">
        <div style="font-size:11px;color:#64748b;">الرصيد المتبقي المستحق</div>
        <div style="font-size:16px;font-weight:800;color:#dc2626;margin-top:2px;">${(sm.total_residual || 0).toLocaleString('en-US')}</div>
      </div>
    </div>

    <!-- Table -->
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <thead>
        <tr style="background:#f1f5f9;border-bottom:2px solid #cbd5e1;">
          <th style="padding:8px 10px;text-align:right;">#</th>
          <th style="padding:8px 10px;text-align:right;">التاريخ</th>
          <th style="padding:8px 10px;text-align:right;">نوع الحركة</th>
          <th style="padding:8px 10px;text-align:right;">رقم المستند</th>
          <th style="padding:8px 10px;text-align:left;">مدين (فاتورة)</th>
          <th style="padding:8px 10px;text-align:left;">دائن (سداد/مرتجع)</th>
          <th style="padding:8px 10px;text-align:left;">المسدد</th>
          <th style="padding:8px 10px;text-align:left;">المتبقي</th>
          <th style="padding:8px 10px;text-align:left;color:#2563eb;">الرصيد التراكمي</th>
          <th style="padding:8px 10px;text-align:center;">العمر</th>
        </tr>
      </thead>
      <tbody>
        ${(stmt.items || []).map((it, idx) => `
          <tr style="border-bottom:1px solid #e2e8f0;background:${idx % 2 === 1 ? '#f8fafc' : '#ffffff'};">
            <td style="padding:7px 10px;color:#64748b;">${idx + 1}</td>
            <td style="padding:7px 10px;direction:ltr;text-align:right;">${escapeHtml(it.date)}</td>
            <td style="padding:7px 10px;">${it.type_label}</td>
            <td style="padding:7px 10px;font-weight:700;">${escapeHtml(it.doc_number)}</td>
            <td style="padding:7px 10px;text-align:left;">${it.debit > 0 ? it.debit.toLocaleString('en-US') : '—'}</td>
            <td style="padding:7px 10px;text-align:left;color:#d97706;">${it.credit > 0 ? it.credit.toLocaleString('en-US') : '—'}</td>
            <td style="padding:7px 10px;text-align:left;color:#059669;">${it.paid > 0 ? it.paid.toLocaleString('en-US') : '—'}</td>
            <td style="padding:7px 10px;text-align:left;color:#dc2626;">${it.residual > 0 ? it.residual.toLocaleString('en-US') : '0'}</td>
            <td style="padding:7px 10px;text-align:left;font-weight:800;color:#2563eb;">${it.running_balance.toLocaleString('en-US')}</td>
            <td style="padding:7px 10px;text-align:center;">${it.age_days || 0} يوم</td>
          </tr>
        `).join('')}
      </tbody>
      <tfoot>
        <tr style="background:#e2e8f0;font-weight:800;border-top:2px solid #94a3b8;">
          <td colspan="4" style="padding:9px 10px;">الإجمالي النهائي</td>
          <td style="padding:9px 10px;text-align:left;">${(sm.total_billed || 0).toLocaleString('en-US')}</td>
          <td style="padding:9px 10px;text-align:left;color:#d97706;">${(sm.total_returns || 0).toLocaleString('en-US')}</td>
          <td style="padding:9px 10px;text-align:left;color:#059669;">${(sm.total_paid || 0).toLocaleString('en-US')}</td>
          <td style="padding:9px 10px;text-align:left;color:#dc2626;">${(sm.total_residual || 0).toLocaleString('en-US')}</td>
          <td style="padding:9px 10px;text-align:left;color:#2563eb;">${(sm.total_residual || 0).toLocaleString('en-US')}</td>
          <td></td>
        </tr>
      </tfoot>
    </table>
  `;

  document.body.appendChild(printContainer);

  try {
    const canvas = await html2canvas(printContainer, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    document.body.removeChild(printContainer);

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
    const mt = 10, mb = 10, mx = 10;
    const uw = pw - mx * 2, uh = ph - mt - mb;
    const iw = uw, ih = (canvas.height / canvas.width) * iw;
    const imgData = canvas.toDataURL('image/png');

    if (ih <= uh) {
      doc.addImage(imgData, 'PNG', mx, mt, iw, ih);
    } else {
      const pages = Math.ceil((ih + 5) / uh);
      for (let i = 0; i < pages; i++) {
        if (i > 0) doc.addPage();
        doc.addImage(imgData, 'PNG', mx, mt - (i * uh), iw, ih);
        doc.setFillColor(255, 255, 255);
        doc.rect(0, 0, pw, mt, 'F');
        const isLast = (i === pages - 1);
        if (!isLast) { doc.rect(0, ph - mb, pw, mb, 'F'); }
        else { doc.rect(0, ph - 5, pw, 5, 'F'); }
        doc.setFontSize(8); doc.setTextColor(150);
        doc.text(`${i + 1} / ${pages}`, pw / 2, ph - (isLast ? 1.5 : 4), { align: 'center' });
      }
    }
    const cleanFilename = `كشف_حساب_${partnerName.replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_')}_${dateStr}.pdf`;
    doc.save(cleanFilename);
  } catch (err) {
    if (printContainer.parentNode) document.body.removeChild(printContainer);
    console.error('Customer statement PDF export error:', err);
    alert('حدث خطأ أثناء تصدير كشف الحساب إلى PDF: ' + err.message);
  }
}
