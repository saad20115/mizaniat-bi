import { api, registerClientCacheInvalidator } from '../api.js';
import { store } from '../store.js';
import { formatNumber, formatCurrency, formatDate } from '../utils/format.js';
import { createTreeTable } from '../components/tree-table.js';

/**
 * Stage C1: Actual Collections Tab («التحصيل الفعلي»)
 * Answers the 6 management questions based on Odoo account.partial.reconcile:
 * 1. «كم حصّلنا؟» - Summary KPI Cards (Bank, Sister Co, Other Adjustments, Credit Notes, Unallocated)
 * 2. «متى تم التحصيل؟ (شهرياً / ربعياً / سنوياً)» - Periodic series & stacked visual chart
 * 3. «من أي سنوات فواتير؟ (عمر المديونية المحصلة)» - Cross-tab of collections by invoice year
 * 4. «أين تم التحصيل؟ (حسب الدفتر والعميل)» - 5-level Hierarchical Tree & Direct Clients View
 * 5. «هل يطابق التحصيل حركة حسابات العملاء؟ (المقارنة الرقابية)» - Accounts reconciliation with non-scope allocations & unallocated
 * 6. «ما هي السدادات خارج بنك الشركة؟ (رقابة المقبوضات)» - Audit / Oversight table of non-bank receipts
 */

let currentData = null;
let currentTreeTable = null;
const clientCache = new Map();

export function clearCollectionsClientCache() {
  clientCache.clear();
}
registerClientCacheInvalidator(clearCollectionsClientCache);

let currentTimeGrain = 'month'; // 'month' | 'quarter' | 'year'
let currentViewMode = 'tree';   // 'tree' | 'direct'
let activeDetailModal = null;
let clientSearchQuery = '';
let isSec5Open = false;

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const ICONS = {
  search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  excel: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  chevronDown: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
  chevronLeft: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>',
  check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>'
};

function fmtVal(num, showZeroDash = true) {
  if (num === null || num === undefined || isNaN(num)) return showZeroDash ? '—' : '0';
  const rounded = Math.round(Number(num));
  if (rounded === 0 && showZeroDash) return '—';
  if (rounded < 0) {
    return `<span class="exec-num-neg" style="color:var(--status-negative);direction:ltr;display:inline-block;">(${Math.abs(rounded).toLocaleString('en-US')})</span>`;
  }
  return `<span class="exec-num">${rounded.toLocaleString('en-US')}</span>`;
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

export async function renderActualCollectionsTab(body, container, timeFilter, selectedCos, globalFilters) {
  body.innerHTML = `
    <div style="direction:rtl;display:flex;flex-direction:column;gap:22px;padding:4px 0;width:100%;max-width:100%;min-width:0;box-sizing:border-box;">
      <!-- Loading Placeholder -->
      <div id="col-loading" style="text-align:center;padding:80px 20px;color:var(--exec-text-muted);font-size:1.1rem;">
        <span class="spin-icon" style="display:inline-block;animation:bi-spin 0.8s linear infinite;margin-left:8px;font-size:1.4rem;">⏳</span>
        جاري تحميل تقرير التحصيل الفعلي الموحّد...
      </div>
      <div id="col-main-content" style="display:none;flex-direction:column;gap:24px;width:100%;max-width:100%;min-width:0;box-sizing:border-box;"></div>
    </div>
  `;

  await loadCollectionsData(body, container, timeFilter, selectedCos, globalFilters);
}

async function loadCollectionsData(body, container, timeFilter, selectedCos, globalFilters) {
  const loading = body.querySelector('#col-loading');
  const mainContent = body.querySelector('#col-main-content');
  if (loading) loading.style.display = 'block';
  if (mainContent) mainContent.style.display = 'none';

  const periodParams = getPeriodParamsFromFilter(timeFilter);
  const companyIds = (selectedCos && selectedCos.length > 0) ? selectedCos.map(Number) : undefined;

  const queryParams = {
    companyIds: companyIds ? companyIds.join(',') : undefined,
    years: periodParams.years,
    dateFrom: periodParams.dateFrom,
    dateTo: periodParams.dateTo,
    timeGrain: currentTimeGrain
  };

  if (globalFilters?.journalIds && globalFilters.journalIds.length > 0) {
    queryParams.journalIds = globalFilters.journalIds.join(',');
  }
  if (globalFilters?.groupIds && globalFilters.groupIds.length > 0) {
    queryParams.groupIds = globalFilters.groupIds.join(',');
  }

  const cacheKey = JSON.stringify(queryParams);
  if (clientCache.has(cacheKey)) {
    const data = clientCache.get(cacheKey);
    currentData = data;
    renderCollectionsView(body, mainContent, data, periodParams, selectedCos, container, timeFilter, globalFilters);
    if (loading) loading.style.display = 'none';
    if (mainContent) mainContent.style.display = 'flex';
    return;
  }

  try {
    const data = await api.getActualCollections(queryParams);
    currentData = data;
    clientCache.set(cacheKey, data);
    renderCollectionsView(body, mainContent, data, periodParams, selectedCos, container, timeFilter, globalFilters);
    if (loading) loading.style.display = 'none';
    if (mainContent) mainContent.style.display = 'flex';
  } catch (err) {
    console.error('Error fetching actual collections:', err);
    if (loading) {
      loading.innerHTML = `
        <div style="color:var(--col-refund);padding:40px 20px;font-size:1rem;">
          ❌ حدث خطأ أثناء تحميل بيانات التحصيل الفعلي: ${escapeHtml(err.message)}
          <br><br>
          <button class="btn btn-primary" id="btn-retry-collections" style="margin-top:10px;">إعادة المحاولة</button>
        </div>
      `;
      loading.querySelector('#btn-retry-collections')?.addEventListener('click', () => {
        loadCollectionsData(body, container, timeFilter, selectedCos, globalFilters);
      });
    }
  }
}

function getAggregatedSeries(monthlySeries, grain) {
  if (!monthlySeries || monthlySeries.length === 0) return [];
  if (grain === 'month') return monthlySeries;
  const map = new Map();
  for (const s of monthlySeries) {
    let key;
    let label;
    if (grain === 'year') {
      const yr = s.period && s.period.length >= 4 ? s.period.slice(0, 4) : s.period;
      key = yr;
      label = `سنة ${yr}`;
    } else {
      // quarter
      const yr = s.period && s.period.length >= 4 ? s.period.slice(0, 4) : '';
      const mStr = s.period && s.period.length >= 7 ? s.period.slice(5, 7) : '01';
      const m = parseInt(mStr, 10);
      const q = Math.ceil(m / 3);
      key = `${yr}-Q${q}`;
      const qNames = { 1: 'الربع الأول', 2: 'الربع الثاني', 3: 'الربع الثالث', 4: 'الربع الرابع' };
      label = `${qNames[q] || 'الربع ' + q} ${yr}`;
    }
    if (!map.has(key)) {
      map.set(key, {
        period: key,
        label,
        bank: 0,
        sister_company: 0,
        other_adjustment: 0,
        total_collected: 0,
        credit_notes: 0,
        payments_count: 0
      });
    }
    const item = map.get(key);
    item.bank = Math.round((item.bank + (s.bank || 0)) * 100) / 100;
    item.sister_company = Math.round((item.sister_company + (s.sister_company || 0)) * 100) / 100;
    item.other_adjustment = Math.round((item.other_adjustment + (s.other_adjustment || 0)) * 100) / 100;
    item.total_collected = Math.round((item.total_collected + (s.total_collected || 0)) * 100) / 100;
    item.credit_notes = Math.round((item.credit_notes + (s.credit_notes || 0)) * 100) / 100;
    item.payments_count += (s.payments_count || 0);
  }
  return Array.from(map.values());
}

function renderPeriodicTableRows(seriesList, showOther = true) {
  const colSpan = showOther ? 7 : 6;
  if (!seriesList || seriesList.length === 0) {
    return `<tr><td colspan="${colSpan}" style="text-align:center;padding:24px;color:var(--text-muted);">لا توجد حركات تحصيل في الفترة المحددة</td></tr>`;
  }
  return seriesList.map(s => `
    <tr style="border-bottom:1px solid var(--border-default);">
      <td class="col-name" style="padding:10px 14px;font-weight:600;color:var(--text-primary);font-size:13px;">${escapeHtml(s.label || s.period)}</td>
      <td class="col-num" style="padding:10px 10px;text-align:left;font-family:var(--font-en);color:var(--text-primary);">${fmtVal(s.bank)}</td>
      <td class="col-num" style="padding:10px 10px;text-align:left;font-family:var(--font-en);color:var(--text-primary);">${fmtVal(s.sister_company)}</td>
      ${showOther ? `<td class="col-num" style="padding:10px 10px;text-align:left;font-family:var(--font-en);color:var(--text-primary);">${fmtVal(s.other_adjustment)}</td>` : ''}
      <td class="col-num" style="padding:10px 10px;text-align:left;font-family:var(--font-en);font-weight:700;color:var(--text-primary);">${fmtVal(s.total_collected)}</td>
      <td class="col-num" style="padding:10px 10px;text-align:left;font-family:var(--font-en);color:var(--text-secondary);">${fmtVal(s.credit_notes)}</td>
      <td class="col-num" style="padding:10px 10px;text-align:left;font-family:var(--font-en);color:var(--text-secondary);">${(s.payments_count || 0).toLocaleString('en-US')}</td>
    </tr>
  `).join('');
}

function renderCollectionsView(topBody, container, data, periodParams, selectedCos, topContainer, timeFilter, globalFilters) {
  const cards = data.cards || {};
  const series = data.periodic_series || [];
  const byInvYear = data.by_invoice_year || [];
  const tree = data.tree || [];
  const clientsDirect = data.clients_direct || [];
  const comparison = data.accounts_comparison || {};
  const auditList = data.audit_non_bank_payments || [];
  const auditSummary = data.audit_summary || {};
  const showOther = (cards.other_collected || 0) > 0;
  const periodLabel = periodParams.years || '2026';

  const bankCollected = cards.bank_collected || 0;
  const sisterCollected = cards.sister_collected || 0;
  const totalCollected = cards.total_collected || 0;
  const otherCollected = cards.other_collected || 0;
  const bankPct = totalCollected > 0 ? (bankCollected / totalCollected * 100) : 0;
  const sisterPct = totalCollected > 0 ? (sisterCollected / totalCollected * 100) : 0;
  const otherPct = totalCollected > 0 ? (otherCollected / totalCollected * 100) : 0;

  container.innerHTML = `
    <!-- Tab Header (04-collections-light.png) -->
    <div class="exec-header-row" style="display:flex;align-items:flex-start;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:20px;">
      <div class="exec-header" style="margin-bottom:0 !important;display:flex;flex-direction:column;gap:4px;">
        <h1 class="exec-title" style="margin:0;font-size:22px;line-height:32px;font-weight:700;color:var(--text-primary);">
          التحصيل النقدي — <span>${escapeHtml(periodLabel)}</span>
        </h1>
        <p class="exec-subtitle" style="margin:0;font-size:12px;line-height:18px;color:var(--text-muted);">
          ما دخل فعلاً خلال الفترة، أيّاً كان تاريخ الفاتورة
        </p>
      </div>
      <button id="btn-export-excel-collections" class="exec-btn-tool" title="تصدير التحصيل إلى Excel" style="background:var(--bg-surface);color:var(--text-primary);border:1px solid var(--border-default);padding:8px 16px;border-radius:10px;font-weight:600;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
        ${ICONS.excel}
        تصدير Excel
      </button>
    </div>

    <!-- Section 1: «كم حصّلنا؟» -->
    <div style="display:flex;flex-direction:column;gap:12px;width:100%;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px;">
        <h2 class="col-section-title" style="margin:0;font-size:17px;line-height:26px;font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
          <span class="section-num-badge">1</span> كم حصّلنا؟
        </h2>
      </div>

      <!-- KPI Summary Cards (4 or 5 Cards matching 04-collections-light.png) -->
      <div class="col-kpi-grid ${showOther ? 'has-other' : ''}">
        <!-- Card 1: HERO (Navy Brand) -->
        <div class="bi-kpi bi-kpi-card hero col-kpi-card" style="display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <span class="bi-kpi-label">إجمالي التحصيل من العملاء</span>
            <div class="bi-kpi-value">${fmtVal(cards.total_collected, false)}</div>
          </div>
          <div>
            <div class="col-hero-bar" style="display:flex;width:100%;height:4px;border-radius:2px;overflow:hidden;background:rgba(255,255,255,0.2);margin-bottom:6px;">
              <div style="width:${bankPct}%;background:#38BDF8;height:100%;"></div>
              <div style="width:${sisterPct}%;background:#C084FC;height:100%;"></div>
              ${showOther && otherPct > 0 ? `<div style="width:${otherPct}%;background:#FBBF24;height:100%;"></div>` : ''}
            </div>
            <span class="bi-kpi-sub">
              ${(cards.payments_count || 0).toLocaleString('en-US')} سداداً على ${(cards.invoices_count || 0).toLocaleString('en-US')} فاتورة • حسب تاريخ السداد
            </span>
          </div>
        </div>

        <!-- Card 2: Bank & Cash -->
        <div class="bi-kpi bi-kpi-card col-kpi-subcard" style="display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <span class="bi-kpi-label" style="display:flex;align-items:center;gap:6px;">
              <span style="width:8px;height:8px;border-radius:50%;background:#1D6AE5;display:inline-block;flex-shrink:0;"></span>
              بنك ونقد
            </span>
            <div class="bi-kpi-value">${fmtVal(cards.bank_collected, false)}</div>
          </div>
          <span class="bi-kpi-sub">${cards.total_collected > 0 ? ((cards.bank_collected / cards.total_collected) * 100).toFixed(1) + '%' : '0%'} من الإجمالي</span>
        </div>

        <!-- Card 3: Sister Company -->
        <div class="bi-kpi bi-kpi-card col-kpi-subcard" style="display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <span class="bi-kpi-label" style="display:flex;align-items:center;gap:6px;">
              <span style="width:8px;height:8px;border-radius:50%;background:#7A5AF0;display:inline-block;flex-shrink:0;"></span>
              عبر شركة شقيقة
            </span>
            <div class="bi-kpi-value">${fmtVal(cards.sister_collected, false)}</div>
          </div>
          <span class="bi-kpi-sub" style="line-height:1.4;">
            استلمها بنك شركة أخرى في المجموعة — ليست نقداً إضافياً
          </span>
        </div>

        ${showOther ? `
        <!-- Card 4: Other Adjustments (Shown when > 0 so parts sum to hero total) -->
        <div class="bi-kpi bi-kpi-card col-kpi-subcard" style="display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <span class="bi-kpi-label" style="display:flex;align-items:center;gap:6px;">
              <span style="width:8px;height:8px;border-radius:50%;background:#FBBF24;display:inline-block;flex-shrink:0;"></span>
              تسويات وقيود أخرى
            </span>
            <div class="bi-kpi-value">${fmtVal(cards.other_collected, false)}</div>
          </div>
          <span class="bi-kpi-sub">${cards.total_collected > 0 ? ((cards.other_collected / cards.total_collected) * 100).toFixed(1) + '%' : '0%'} من الإجمالي</span>
        </div>
        ` : ''}

        <!-- Card Outside Collection (Subtle Neutral Card) -->
        <div class="bi-kpi bi-kpi-card col-outside-card" style="background:var(--bg-subtle);display:flex;flex-direction:column;justify-content:space-between;">
          <div>
            <span class="bi-kpi-label" style="color:var(--text-secondary);font-weight:600;">خارج التحصيل (لم يُستلم نقداً)</span>
            <div style="display:flex;flex-direction:column;gap:8px;margin-top:10px;">
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                <span style="font-size:12px;color:var(--text-muted);white-space:nowrap;">إشعارات دائنة</span>
                <span class="tabular-nums" style="font-size:14px;font-weight:700;color:var(--text-primary);white-space:nowrap;overflow:visible;text-overflow:clip;">${fmtVal(cards.credit_notes, false)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                <span style="font-size:12px;color:var(--text-muted);white-space:nowrap;">خصومات ورسوم</span>
                <span class="tabular-nums" style="font-size:14px;font-weight:700;color:var(--text-primary);white-space:nowrap;overflow:visible;text-overflow:clip;">${fmtVal(cards.discount_fees, false)}</span>
              </div>
            </div>
          </div>
          <div style="display:none;">
            <span>${fmtVal(cards.unallocated_balance, false)}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Status Banner (04-collections-light.png) -->
    <div class="col-status-banner" style="display:flex;align-items:center;justify-content:space-between;padding:12px 18px;border-radius:12px;background:var(--status-positive-subtle);border:1px solid var(--status-positive);color:var(--status-positive);font-size:13px;font-weight:600;">
      <div style="display:flex;align-items:center;gap:8px;">
        ${ICONS.check}
        <span>كل دفعات العملاء مربوطة بفواتير${(cards.unallocated_lines_count || 0) > 0 ? `، عدا ${(cards.unallocated_lines_count || 0)} دفعات بقيمة ${fmtVal(cards.unallocated_balance, false)}` : ''}</span>
      </div>
      ${(cards.unallocated_lines_count || 0) > 0 ? `
        <button id="btn-col-toggle-unallocated" style="background:none;border:none;color:var(--brand-accent);font-size:13px;font-weight:600;cursor:pointer;padding:0;font-family:var(--font-ar);">
          عرض الدفعات (${cards.unallocated_lines_count || 0})
        </button>
      ` : ''}
    </div>

    <!-- Section 2: «متى حصّلنا؟» -->
    <div class="exec-table-card" style="background:var(--bg-surface);border:1px solid var(--border-default);border-radius:14px;padding:20px;display:flex;flex-direction:column;gap:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
        <div style="display:flex;flex-direction:column;gap:2px;">
          <h3 style="margin:0;font-size:17px;line-height:26px;font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
            <span class="section-num-badge">2</span> متى حصّلنا؟
          </h3>
          <span style="font-size:12px;line-height:18px;color:var(--text-muted);">
            بالمليون ريال • أكتوبر جارٍ وغير مكتمل
          </span>
        </div>

        <!-- Time grain toggle -->
        <div style="display:inline-flex;background:var(--bg-subtle);border:1px solid var(--border-default);border-radius:10px;padding:3px;">
          <button class="col-grain-btn ${currentTimeGrain==='month'?'active':''}" data-grain="month" style="padding:6px 14px;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;background:${currentTimeGrain==='month'?'var(--brand-primary)':'transparent'};color:${currentTimeGrain==='month'?'var(--text-on-brand)':'var(--text-secondary)'};">شهري</button>
          <button class="col-grain-btn ${currentTimeGrain==='quarter'?'active':''}" data-grain="quarter" style="padding:6px 14px;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;background:${currentTimeGrain==='quarter'?'var(--brand-primary)':'transparent'};color:${currentTimeGrain==='quarter'?'var(--text-on-brand)':'var(--text-secondary)'};">ربع سنوي</button>
          <button class="col-grain-btn ${currentTimeGrain==='year'?'active':''}" data-grain="year" style="padding:6px 14px;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;background:${currentTimeGrain==='year'?'var(--brand-primary)':'transparent'};color:${currentTimeGrain==='year'?'var(--text-on-brand)':'var(--text-secondary)'};">سنوي</button>
        </div>
      </div>

      <!-- Stacked Bar Chart -->
      <div id="col-chart-box" data-scroll-x="true" style="overflow-x:auto;">
        ${renderStackedBarChart(getAggregatedSeries(series, currentTimeGrain), showOther)}
      </div>

      <!-- Periodic Series Table -->
      <div data-scroll-x="true" style="width:100%;max-width:100%;overflow-x:auto;box-sizing:border-box;margin-top:10px;border-top:1px solid var(--border-default);padding-top:12px;">
        <table class="bi-table" style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:var(--bg-subtle);border-bottom:1px solid var(--border-default);">
              <th class="col-name" style="padding:10px 14px;text-align:right;color:var(--text-secondary);font-size:12px;font-weight:600;">الفترة</th>
              <th class="col-num" style="padding:10px 10px;text-align:left;color:var(--text-secondary);font-size:12px;font-weight:600;">بنك ونقد</th>
              <th class="col-num" style="padding:10px 10px;text-align:left;color:var(--text-secondary);font-size:12px;font-weight:600;">عبر شركة شقيقة</th>
              ${showOther ? `<th class="col-num" style="padding:10px 10px;text-align:left;color:var(--text-secondary);font-size:12px;font-weight:600;">تسويات أخرى</th>` : ''}
              <th class="col-num" style="padding:10px 10px;text-align:left;color:var(--text-secondary);font-size:12px;font-weight:600;">إجمالي التحصيل</th>
              <th class="col-num" style="padding:10px 10px;text-align:left;color:var(--text-secondary);font-size:12px;font-weight:600;">إشعارات دائنة</th>
              <th class="col-num" style="padding:10px 10px;text-align:left;color:var(--text-secondary);font-size:12px;font-weight:600;">عدد السدادات</th>
            </tr>
          </thead>
          <tbody id="col-series-tbody">
            ${renderPeriodicTableRows(getAggregatedSeries(series, currentTimeGrain), showOther)}
          </tbody>
          <tfoot>
            <tr style="background:var(--bg-subtle);font-weight:700;border-top:2px solid var(--border-default);">
              <td class="col-name" style="padding:12px 14px;color:var(--text-primary);">المجموع الإجمالي</td>
              <td class="col-num" style="padding:12px 10px;text-align:left;color:var(--text-primary);">${fmtVal(cards.bank_collected, false)}</td>
              <td class="col-num" style="padding:12px 10px;text-align:left;color:var(--text-primary);">${fmtVal(cards.sister_collected, false)}</td>
              ${showOther ? `<td class="col-num" style="padding:12px 10px;text-align:left;color:var(--text-primary);">${fmtVal(cards.other_collected, false)}</td>` : ''}
              <td class="col-num" style="padding:12px 10px;text-align:left;color:var(--text-primary);">${fmtVal(cards.total_collected, false)}</td>
              <td class="col-num" style="padding:12px 10px;text-align:left;color:var(--text-primary);">${fmtVal(cards.credit_notes, false)}</td>
              <td class="col-num" style="padding:12px 10px;text-align:left;color:var(--text-primary);">${(cards.payments_count || 0).toLocaleString('en-US')}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- Section 3: «من فواتير أي سنة؟» -->
    <div class="exec-table-card" style="background:var(--bg-surface);border:1px solid var(--border-default);border-radius:14px;padding:20px;display:flex;flex-direction:column;gap:16px;">
      <div style="display:flex;flex-direction:column;gap:2px;">
        <h3 style="margin:0;font-size:17px;line-height:26px;font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
          <span class="section-num-badge">3</span> من فواتير أي سنة؟ <span style="font-size:12px;color:var(--text-muted);font-weight:normal;">(سنوات فواتير العملاء)</span>
        </h3>
        <span style="font-size:12px;line-height:18px;color:var(--text-muted);">
          تحصيل الفترة موزّعاً على سنة إصدار الفاتورة — يُظهر تحصيل المتأخرات · كل رقم يفتح سداداته
        </span>
      </div>

      <div data-scroll-x="true" style="width:100%;max-width:100%;overflow-x:auto;box-sizing:border-box;">
        ${renderByInvoiceYearTable(byInvYear, cards, periodParams)}
      </div>
    </div>

    <!-- Section 4: «من أي مجموعة ومركز وعميل؟» -->
    <div class="exec-table-card">
      <div class="exec-table-toolbar">
        <div class="exec-table-titles">
          <h3 class="exec-table-title" style="display:flex;align-items:center;gap:8px;">
            <span class="section-num-badge">4</span> من أي مجموعة ومركز وعميل؟
          </h3>
          <span class="exec-table-breadcrumb">الشركة ← المجموعة ← مركز التكلفة ← العميل ← السداد</span>
        </div>

        <div class="exec-table-actions">
          <!-- Search box -->
          <div class="exec-search-wrap">
            <input type="text" id="col-client-search" class="exec-search-input" placeholder="بحث…" value="${escapeHtml(clientSearchQuery)}" />
            <button id="btn-col-clear-search" style="display:none;position:absolute;left:8px;background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:12px;padding:0;">✕</button>
            <span class="exec-search-icon">${ICONS.search}</span>
          </div>
          <span id="col-search-counter" style="display:none;font-size:12px;color:var(--text-muted);font-weight:600;"></span>

          <!-- View Mode Toggle -->
          <div style="display:inline-flex;background:var(--bg-subtle);border:1px solid var(--border-default);border-radius:10px;padding:3px;">
            <button class="col-view-btn ${currentViewMode==='tree'?'active':''}" data-mode="tree" style="padding:6px 12px;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;background:${currentViewMode==='tree'?'var(--brand-primary)':'transparent'};color:${currentViewMode==='tree'?'var(--text-on-brand)':'var(--text-secondary)'};">
              الهرمي
            </button>
            <button class="col-view-btn ${currentViewMode==='direct'?'active':''}" data-mode="direct" style="padding:6px 12px;border:none;border-radius:8px;font-size:12px;font-weight:600;cursor:pointer;background:${currentViewMode==='direct'?'var(--brand-primary)':'transparent'};color:${currentViewMode==='direct'?'var(--text-on-brand)':'var(--text-secondary)'};">
              العملاء مباشرة
            </button>
          </div>
        </div>
      </div>

      <!-- Container for TreeTable or Direct Table -->
      <div id="col-tree-container" class="tree-table-wrap" data-scroll-x="true" style="${currentViewMode==='tree'?'display:block;':'display:none;'}overflow-x:auto;width:100%;box-sizing:border-box;"></div>
      <div id="col-direct-container" class="tree-table-wrap" data-scroll-x="true" style="${currentViewMode==='direct'?'display:block;':'display:none;'}overflow-x:auto;width:100%;box-sizing:border-box;">
        ${renderDirectClientsTable(clientsDirect, clientSearchQuery, showOther)}
      </div>
    </div>

    <!-- Section 5: «هل توجد دفعات من العملاء لم تُربط بفواتير؟ (المقارنة الرقابية وإثبات المطابقة)» -->
    <div class="exec-table-card" style="background:var(--bg-surface);border:1px solid var(--border-default);border-radius:14px;padding:20px;display:flex;flex-direction:column;gap:16px;">
      <div id="col-sec5-header" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;cursor:pointer;user-select:none;">
        <div style="display:flex;flex-direction:column;gap:2px;">
          <h3 style="margin:0;font-size:17px;line-height:26px;font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
            <span class="section-num-badge">5</span> هل توجد دفعات من العملاء لم تُربط بفواتير؟ (المقارنة الرقابية وإثبات المطابقة)
          </h3>
          <span style="font-size:12px;line-height:18px;color:var(--text-muted);">
            يطابق هذا القسم إجمالي الحركات الدائنة على حسابات العملاء مع مجموع ما خُصص لفواتير هذا النطاق
          </span>
        </div>
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:12px;padding:4px 12px;border-radius:8px;background:${comparison.status === 'matched' ? 'var(--status-positive-subtle)' : 'var(--status-negative-subtle)'};color:${comparison.status === 'matched' ? 'var(--status-positive)' : 'var(--status-negative)'};font-weight:600;">
            ${comparison.status === 'matched' ? '✓ مطابق تماماً بالهللة' : `فارق: ${(comparison.diff || 0).toLocaleString('en-US')} ر.س`}
          </span>
          <span id="col-sec5-toggle-icon" style="color:var(--text-muted);font-size:12px;">${isSec5Open ? '▲' : '▼'}</span>
        </div>
      </div>

      <div id="col-sec5-body" style="display:${isSec5Open ? 'flex' : 'none'};flex-direction:column;gap:16px;border-top:1px solid var(--border-default);padding-top:16px;">
        <!-- Reconciliation Equation Bar (6 Balanced Cards) -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(170px, 1fr));gap:12px;width:100%;box-sizing:border-box;">
          <div style="padding:14px;background:var(--bg-subtle);border:1px solid var(--border-default);border-radius:10px;">
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">إجمالي دائن العملاء (الدفتر العام)</div>
            <div style="font-size:18px;font-weight:700;font-family:var(--font-en);color:var(--text-primary);">
              ${(comparison.total_credit_movements || 0).toLocaleString('en-US')}
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">كامل حركات دائن ذمم عملاء النطاق</div>
          </div>

          <div style="padding:14px;background:var(--bg-subtle);border:1px solid var(--border-default);border-radius:10px;">
            <div style="font-size:12px;color:var(--brand-accent);margin-bottom:4px;">= مخصّص لفواتير النطاق المختار</div>
            <div style="font-size:18px;font-weight:700;font-family:var(--font-en);color:var(--text-primary);">
              ${(comparison.allocated_in_scope || 0).toLocaleString('en-US')}
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">تحصيل فواتير هذا التقرير</div>
          </div>

          <div style="padding:14px;background:var(--bg-subtle);border:1px solid var(--border-default);border-radius:10px;">
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">+ خصومات ورسوم</div>
            <div style="font-size:18px;font-weight:700;font-family:var(--font-en);color:var(--text-primary);">
              ${(comparison.discount_fees || 0).toLocaleString('en-US')}
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">غرامات العقد ومنصة خبرة</div>
          </div>

          <div style="padding:14px;background:var(--bg-subtle);border:1px solid var(--border-default);border-radius:10px;">
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">+ مخصّص لدفاتر أخرى خارج النطاق</div>
            <div style="font-size:18px;font-weight:700;font-family:var(--font-en);color:var(--text-primary);">
              ${(comparison.allocated_other_journals || 0).toLocaleString('en-US')}
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">سدادات فواتير تابعة لدفاتر أخرى</div>
          </div>

          <div style="padding:14px;background:var(--bg-subtle);border:1px solid var(--border-default);border-radius:10px;">
            <div style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">+ دفعات غير مخصصة (معلّق)</div>
            <div style="font-size:18px;font-weight:700;font-family:var(--font-en);color:var(--text-primary);">
              ${(comparison.unallocated || 0).toLocaleString('en-US')}
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">دفعات لم تُربط بفواتير في أودو</div>
          </div>

          <div style="padding:14px;background:var(--bg-subtle);border:1px solid ${comparison.diff > 0.01 ? 'var(--status-negative)' : 'var(--status-positive)'};border-radius:10px;">
            <div style="font-size:12px;color:${comparison.diff > 0.01 ? 'var(--status-negative)' : 'var(--status-positive)'};margin-bottom:4px;">+ فروقات غير مفسرة</div>
            <div style="font-size:18px;font-weight:700;font-family:var(--font-en);color:${comparison.diff > 0.01 ? 'var(--status-negative)' : 'var(--status-positive)'};">
              ${comparison.diff > 0.01 ? (comparison.diff || 0).toLocaleString('en-US') : '0'}
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${comparison.diff > 0.01 ? 'فرق بحاجة لمعاينة القيود' : '✓ مطابقة تامة بالهللة'}</div>
          </div>
        </div>

        <!-- Explicit Accounting Equation Note -->
        <div style="padding:10px 14px;background:var(--bg-subtle);border:1px solid var(--border-default);border-radius:8px;font-size:12px;color:var(--text-secondary);line-height:1.5;">
          📐 <strong>إثبات المطابقة والمعادلة المحاسبية:</strong>
          <span style="font-family:var(--font-en);margin-right:6px;direction:ltr;display:inline-block;">
            ${escapeHtml(comparison.equation_note || 'إجمالي الدائن (حركات القيود باستثناء الإشعارات) = مخصص لفواتير النطاق + خصومات ورسوم + مخصص لدفاتر أخرى + دفعات غير مخصصة + فروقات غير مفسرة')}
          </span>
        </div>

        <!-- Unallocated Moves List if exists -->
        ${comparison.unallocated_moves && comparison.unallocated_moves.length > 0 ? `
          <div style="border-top:1px solid var(--border-default);padding-top:12px;">
            <div style="font-weight:600;font-size:13px;color:var(--text-primary);margin-bottom:8px;">
              تفصيل القيود والدفعات غير المخصصة (${comparison.unallocated_moves.length} حركة):
            </div>
            <div data-scroll-x="true" style="width:100%;max-width:100%;overflow-x:auto;max-height:280px;box-sizing:border-box;">
              <table class="bi-table" style="width:100%;border-collapse:collapse;font-size:12px;">
                <thead>
                  <tr style="background:var(--bg-subtle);border-bottom:1px solid var(--border-default);">
                    <th style="padding:8px 10px;text-align:right;">قيد السداد</th>
                    <th style="padding:8px 10px;text-align:right;">التاريخ</th>
                    <th style="padding:8px 10px;text-align:right;">الشركة</th>
                    <th style="padding:8px 10px;text-align:right;">اسم العميل</th>
                    <th style="padding:8px 10px;text-align:right;">نوع الحركة</th>
                    <th style="padding:8px 10px;text-align:left;">المبلغ غير المخصص</th>
                  </tr>
                </thead>
                <tbody>
                  ${comparison.unallocated_moves.slice(0, 50).map(m => `
                    <tr style="border-bottom:1px solid var(--border-default);">
                      <td style="padding:8px 10px;font-family:var(--font-en);font-weight:600;color:var(--text-primary);">${escapeHtml(m.move_name)}</td>
                      <td style="padding:8px 10px;font-family:var(--font-en);color:var(--text-secondary);">${escapeHtml(m.date)}</td>
                      <td style="padding:8px 10px;color:var(--text-secondary);">${escapeHtml(m.company_name)}</td>
                      <td style="padding:8px 10px;font-weight:500;color:var(--text-primary);">${escapeHtml(m.partner_name)}</td>
                      <td style="padding:8px 10px;color:var(--text-secondary);">${escapeHtml(m.type_label || (m.is_partial ? 'متبقي غير مخصص' : 'دفعة كاملة'))}</td>
                      <td style="padding:8px 10px;text-align:left;font-family:var(--font-en);font-weight:600;color:var(--text-primary);">${fmtVal(m.amount, false)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}
      </div>
    </div>

    <!-- Section 6: «ما الذي لم يدخل بنك الشركة؟» -->
    <div class="exec-table-card" style="background:var(--bg-surface);border:1px solid var(--border-default);border-radius:14px;padding:20px;display:flex;flex-direction:column;gap:16px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;flex-wrap:wrap;gap:10px;">
        <div style="display:flex;flex-direction:column;gap:2px;">
          <h3 style="margin:0;font-size:17px;line-height:26px;font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:8px;">
            <span class="section-num-badge">6</span> ما الذي لم يدخل بنك الشركة؟ <span style="font-size:12px;color:var(--text-muted);font-weight:normal;">(سدادات خارج بنك الشركة)</span>
          </h3>
          <span style="font-size:12px;line-height:18px;color:var(--text-muted);">
            مبالغ استلمها بنك شركة أخرى في المجموعة عن فواتير هذه الشركة — مع القيد البنكي المقابل
          </span>
        </div>
      </div>

      <div data-scroll-x="true" style="width:100%;max-width:100%;overflow-x:auto;max-height:450px;box-sizing:border-box;">
        ${renderAuditNonBankTable(auditList, auditSummary)}
      </div>
    </div>
  `;

  // Initialize TreeTable in Section 4
  initCollectionsTreeTable(container.querySelector('#col-tree-container'), tree, cards, periodParams);

  // Attach Event Handlers
  setupCollectionsEvents(topBody, container, data, periodParams, selectedCos, topContainer, timeFilter, globalFilters);
}

function renderStackedBarChart(series, showOther = true) {
  if (!series || series.length === 0) {
    return `<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:13px;">لا توجد حركات تحصيل للعرض البياني</div>`;
  }

  const ARABIC_MONTHS = {
    '01': 'يناير', '02': 'فبراير', '03': 'مارس', '04': 'أبريل',
    '05': 'مايو', '06': 'يونيو', '07': 'يوليو', '08': 'أغسطس',
    '09': 'سبتمبر', '10': 'أكتوبر (جارٍ)', '11': 'نوفمبر', '12': 'ديسمبر'
  };

  const maxVal = Math.max(...series.map(s => s.total_collected || 1), 1);

  return `
    <div style="display:flex;align-items:flex-end;gap:16px;height:160px;padding:24px 12px 6px;overflow-x:auto;">
      ${series.map(s => {
        const tot = s.total_collected || 0;
        const hPct = Math.max(4, Math.round((tot / maxVal) * 100));
        const bankPct = tot > 0 ? (s.bank / tot) * 100 : 0;
        const sisterPct = tot > 0 ? (s.sister_company / tot) * 100 : 0;
        const otherPct = (showOther && tot > 0) ? (s.other_adjustment / tot) * 100 : 0;

        let displayLabel = s.label;
        if (!displayLabel) {
          const mPart = s.period && s.period.length >= 7 ? s.period.slice(5, 7) : '';
          displayLabel = ARABIC_MONTHS[mPart] || s.period;
        }

        const millionsVal = tot > 0 ? (tot / 1000000).toFixed(1) : '0.0';

        return `
          <div style="flex:1;min-width:54px;display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end;" title="${escapeHtml(displayLabel)}: إجمالي ${tot.toLocaleString('en-US')} (بنك ونقد: ${s.bank.toLocaleString('en-US')}, شقيقة: ${s.sister_company.toLocaleString('en-US')}${showOther ? ', أخرى: ' + s.other_adjustment.toLocaleString('en-US') : ''})">
            <div style="font-size:12px;font-family:var(--font-en);font-weight:600;color:var(--text-secondary);margin-bottom:6px;direction:ltr;white-space:nowrap;">
              ${millionsVal}
            </div>
            <div style="width:100%;max-width:38px;height:${hPct}%;display:flex;flex-direction:column;border-radius:6px 6px 0 0;overflow:hidden;background:var(--border-default);">
              ${showOther && otherPct > 0 ? `<div style="height:${otherPct}%;background:#FBBF24;" title="تسويات أخرى"></div>` : ''}
              ${sisterPct > 0 ? `<div style="height:${sisterPct}%;background:#7A5AF0;" title="عبر شركة شقيقة"></div>` : ''}
              ${bankPct > 0 ? `<div style="height:${bankPct}%;background:#1D6AE5;" title="بنك ونقد"></div>` : ''}
            </div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:8px;white-space:nowrap;text-align:center;">
              ${escapeHtml(displayLabel)}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderByInvoiceYearTable(byInvYear, cards, periodParams = {}) {
  if (!byInvYear || byInvYear.length === 0) {
    return `<div style="text-align:center;padding:24px;color:var(--text-muted);font-size:13px;">لا توجد بيانات لسنة الفاتورة</div>`;
  }

  // Extract and sort years descending
  const years = Array.from(new Set(byInvYear.map(r => r.invoice_year).filter(Boolean))).sort().reverse();
  const isMultiYear = (periodParams.years && periodParams.years.includes(',')) || periodParams.years === 'ALL';
  const showPriorCol = !isMultiYear;
  const currentYear = (!isMultiYear && periodParams.years) ? periodParams.years : (years[0] || '2026');

  // Extract companies and their totals across years
  const companyMap = new Map();
  for (const r of byInvYear) {
    const yr = r.invoice_year;
    if (r.companies) {
      for (const [cName, val] of Object.entries(r.companies)) {
        if (!companyMap.has(cName)) {
          companyMap.set(cName, {
            name: cName,
            byYear: {},
            total: 0
          });
        }
        const cEntry = companyMap.get(cName);
        cEntry.byYear[yr] = (cEntry.byYear[yr] || 0) + (val || 0);
        cEntry.total += (val || 0);
      }
    }
  }

  const companiesList = Array.from(companyMap.values()).sort((a, b) => b.total - a.total);

  function getCoDotColor(name) {
    if (name.includes('سمير') && name.includes('مهنية')) return '#1D6AE5';
    if (name.includes('جمال') && name.includes('مهنية')) return '#12B76A';
    if (name.includes('سمير') || name.includes('مكتب')) return '#F79009';
    if (name.includes('جمال')) return '#7A5AF0';
    return 'var(--brand-accent)';
  }

  const yearSums = {};
  for (const yr of years) {
    yearSums[yr] = byInvYear.find(r => r.invoice_year === yr)?.total || 0;
  }
  const grandTotal = cards.total_collected || companiesList.reduce((acc, c) => acc + c.total, 0);
  const currentYearGrand = yearSums[currentYear] || 0;
  const priorYearsGrand = grandTotal - currentYearGrand;
  const grandPriorPct = grandTotal > 0 ? ((priorYearsGrand / grandTotal) * 100).toFixed(1) + '%' : '0.0%';

  return `
    <table class="bi-table" style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:var(--bg-subtle);border-bottom:1px solid var(--border-default);">
          <th class="col-name" style="padding:10px 14px;text-align:right;color:var(--text-secondary);font-size:12px;font-weight:600;min-width:240px;">الشركة</th>
          ${years.map(yr => `
            <th class="col-num" style="padding:10px 10px;text-align:left;color:var(--text-secondary);font-size:12px;font-weight:600;">فواتير ${escapeHtml(yr)}</th>
          `).join('')}
          <th class="col-num" style="padding:10px 10px;text-align:left;color:var(--text-secondary);font-size:12px;font-weight:600;">إجمالي التحصيل</th>
          ${showPriorCol ? `
            <th class="col-num" style="padding:10px 10px;text-align:left;color:var(--text-secondary);font-size:12px;font-weight:600;" title="نسبة التحصيل من فواتير تعود لسنوات سابقة لسنة ${escapeHtml(currentYear)} (السنة الحالية: ${escapeHtml(currentYear)})">
              من سنوات سابقة %
            </th>
          ` : ''}
        </tr>
      </thead>
      <tbody>
        ${companiesList.map(co => {
          const currentVal = co.byYear[currentYear] || 0;
          const priorVal = co.total - currentVal;
          const priorPct = co.total > 0 ? ((priorVal / co.total) * 100).toFixed(1) + '%' : '0.0%';
          const dotColor = getCoDotColor(co.name);

          return `
            <tr style="border-bottom:1px solid var(--border-default);height:44px;">
              <td class="col-name" style="padding:10px 14px;font-weight:600;color:var(--text-primary);">
                <div style="display:flex;align-items:center;gap:8px;">
                  <span style="width:8px;height:8px;border-radius:50%;background:${dotColor};display:inline-block;flex-shrink:0;"></span>
                  <span>${escapeHtml(co.name)}</span>
                </div>
              </td>
              ${years.map(yr => `
                <td class="col-num" style="padding:10px 10px;text-align:left;font-family:var(--font-en);color:var(--text-primary);">${fmtVal(co.byYear[yr] || 0)}</td>
              `).join('')}
              <td class="col-num" style="padding:10px 10px;text-align:left;font-family:var(--font-en);font-weight:700;color:var(--text-primary);">${fmtVal(co.total)}</td>
              ${showPriorCol ? `<td class="col-num" style="padding:10px 10px;text-align:left;font-family:var(--font-en);font-weight:600;color:var(--text-secondary);direction:ltr;">${priorPct}</td>` : ''}
            </tr>
          `;
        }).join('')}
      </tbody>
      <tfoot>
        <tr style="background:var(--bg-subtle);font-weight:700;border-top:2px solid var(--border-default);height:44px;">
          <td class="col-name" style="padding:12px 14px;color:var(--text-primary);">الإجمالي</td>
          ${years.map(yr => `
            <td class="col-num" style="padding:12px 10px;text-align:left;font-family:var(--font-en);color:var(--text-primary);">${fmtVal(yearSums[yr] || 0, false)}</td>
          `).join('')}
          <td class="col-num" style="padding:12px 10px;text-align:left;font-family:var(--font-en);color:var(--text-primary);">${fmtVal(grandTotal, false)}</td>
          ${showPriorCol ? `<td class="col-num" style="padding:12px 10px;text-align:left;font-family:var(--font-en);color:var(--text-primary);direction:ltr;">${grandPriorPct}</td>` : ''}
        </tr>
      </tfoot>
    </table>
  `;
}

function renderDirectClientsTable(clients, searchQuery, showOther = true) {
  let list = clients || [];
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(c => 
      (c.partner_name && c.partner_name.toLowerCase().includes(q)) ||
      (c.company_name && c.company_name.toLowerCase().includes(q)) ||
      (c.journal_name && c.journal_name.toLowerCase().includes(q)) ||
      (c.department_name && c.department_name.toLowerCase().includes(q))
    );
  }

  if (list.length === 0) {
    return `<div style="text-align:center;padding:32px;color:var(--text-muted);font-size:13px;">لا يوجد عملاء مطابقون للبحث</div>`;
  }

  return `
    <div style="width:100%;max-width:100%;overflow-x:auto;max-height:550px;box-sizing:border-box;" data-scroll-x="true">
      <table class="bi-table" style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead style="position:sticky;top:0;background:var(--bg-surface);z-index:10;">
          <tr style="background:var(--bg-subtle);border-bottom:1px solid var(--border-default);">
            <th class="col-center" style="padding:10px 8px;text-align:center;width:35px;color:var(--text-secondary);font-size:12px;font-weight:600;">#</th>
            <th class="col-name" style="padding:10px 14px;text-align:right;min-width:200px;color:var(--text-secondary);font-size:12px;font-weight:600;">اسم العميل</th>
            <th class="col-name" style="padding:10px 14px;text-align:right;color:var(--text-secondary);font-size:12px;font-weight:600;">الشركة</th>
            <th class="col-name" style="padding:10px 14px;text-align:right;color:var(--text-secondary);font-size:12px;font-weight:600;">المجموعة</th>
            <th class="col-name" style="padding:10px 14px;text-align:right;color:var(--text-secondary);font-size:12px;font-weight:600;">دفتر اليومية</th>
            <th class="col-num" style="padding:10px 10px;text-align:left;color:var(--text-secondary);font-size:12px;font-weight:600;">بنك ونقد</th>
            <th class="col-num" style="padding:10px 10px;text-align:left;color:var(--text-secondary);font-size:12px;font-weight:600;">عبر شركة شقيقة</th>
            ${showOther ? `<th class="col-num" style="padding:10px 10px;text-align:left;color:var(--text-secondary);font-size:12px;font-weight:600;">تسويات أخرى</th>` : ''}
            <th class="col-num" style="padding:10px 10px;text-align:left;color:var(--text-secondary);font-size:12px;font-weight:600;">إجمالي التحصيل</th>
            <th class="col-num" style="padding:10px 10px;text-align:left;color:var(--text-secondary);font-size:12px;font-weight:600;">إشعارات دائنة</th>
            <th class="col-center" style="padding:10px 8px;text-align:center;width:70px;color:var(--text-secondary);font-size:12px;font-weight:600;">التفاصيل</th>
          </tr>
        </thead>
        <tbody>
          ${list.map((c, idx) => `
            <tr style="border-bottom:1px solid var(--border-default);height:44px;">
              <td class="col-center" style="padding:10px 8px;text-align:center;color:var(--text-muted);font-family:var(--font-en);font-size:12px;">${idx + 1}</td>
              <td class="col-name" style="padding:10px 14px;font-weight:600;color:var(--text-primary);">${escapeHtml(c.partner_name)}</td>
              <td class="col-name" style="padding:10px 14px;color:var(--text-secondary);">${escapeHtml(c.company_name)}</td>
              <td class="col-name" style="padding:10px 14px;color:var(--text-secondary);">${escapeHtml(c.department_name)}</td>
              <td class="col-name" style="padding:10px 14px;color:var(--text-muted);">${escapeHtml(c.journal_name || '—')}</td>
              <td class="col-num" style="padding:10px 10px;text-align:left;font-family:var(--font-en);color:var(--text-primary);">${fmtVal(c.bank)}</td>
              <td class="col-num" style="padding:10px 10px;text-align:left;font-family:var(--font-en);color:var(--text-primary);">${fmtVal(c.sister_company)}</td>
              ${showOther ? `<td class="col-num" style="padding:10px 10px;text-align:left;font-family:var(--font-en);color:var(--text-primary);">${fmtVal(c.other_adjustment)}</td>` : ''}
              <td class="col-num" style="padding:10px 10px;text-align:left;font-family:var(--font-en);font-weight:700;color:var(--text-primary);">${fmtVal(c.total_collected)}</td>
              <td class="col-num" style="padding:10px 10px;text-align:left;font-family:var(--font-en);color:var(--text-secondary);">${fmtVal(c.credit_notes)}</td>
              <td class="col-center" style="padding:10px 8px;text-align:center;">
                <button class="btn-col-partner-detail" data-partner-id="${c.partner_id}" data-partner-name="${escapeHtml(c.partner_name)}" style="padding:4px 8px;font-size:11px;font-weight:600;background:var(--bg-subtle);color:var(--brand-accent);border:1px solid var(--border-default);border-radius:6px;cursor:pointer;">
                  عرض السطور
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function initCollectionsTreeTable(container, treeData, cards, periodParams) {
  if (!container) return;

  const showOther = (cards.other_collected || 0) > 0;

  const treeColumns = [
    { id: 'name', label: 'البيان', minWidth: '240px', align: 'right', priority: 1 },
    { id: 'bank', label: 'بنك ونقد', align: 'left', width: '120px', minWidth: '95px', priority: 2, format: (v) => fmtVal(v) },
    { id: 'sister_company', label: 'عبر شركة شقيقة', align: 'left', width: '120px', minWidth: '95px', priority: 2, format: (v) => fmtVal(v) },
    ...(showOther ? [{ id: 'other_adjustment', label: 'تسويات أخرى', align: 'left', width: '110px', minWidth: '90px', priority: 2, format: (v) => fmtVal(v) }] : []),
    { id: 'total_collected', label: 'إجمالي التحصيل', align: 'left', width: '125px', minWidth: '100px', priority: 1, format: (v) => fmtVal(v) },
    {
      id: 'contribution',
      label: 'المساهمة',
      align: 'center',
      width: '110px',
      minWidth: '90px',
      priority: 2,
      format: (v, node) => {
        const grandTotal = cards.total_collected || 1;
        const val = node.total_collected || 0;
        const pct = Math.max(0, Math.min(100, Math.round((val / grandTotal) * 1000) / 10));
        const pctStr = pct.toFixed(1) + '%';
        return `
          <div style="display:flex;align-items:center;gap:6px;justify-content:center;width:100%;">
            <div style="flex:1;max-width:44px;height:5px;background:var(--border-default);border-radius:3px;overflow:hidden;">
              <div style="width:${pct}%;height:100%;background:var(--brand-accent);border-radius:3px;"></div>
            </div>
            <span style="font-size:12px;font-family:var(--font-en);color:var(--text-secondary);min-width:36px;text-align:left;direction:ltr;">${pctStr}</span>
          </div>
        `;
      }
    },
    { id: 'credit_notes', label: 'خارج التحصيل', align: 'left', width: '115px', minWidth: '90px', priority: 2, format: (v) => fmtVal(v) },
    { id: 'payments_count', label: 'السدادات', align: 'left', width: '75px', minWidth: '60px', priority: 2, format: (v) => v ? Number(v).toLocaleString('en-US') : '—' }
  ];

  const totals = {
    bank: cards.bank_collected,
    sister_company: cards.sister_collected,
    ...(showOther ? { other_adjustment: cards.other_collected } : {}),
    total_collected: cards.total_collected,
    credit_notes: cards.credit_notes,
    payments_count: cards.payments_count
  };

  currentTreeTable = createTreeTable(container, {
    storageKey: 'mizaniat_collections_tree_expanded',
    columns: treeColumns,
    data: treeData,
    totals,
    indentWidth: 22,
    showZeroItems: store.get('showZeroItems') ?? false,
    getNodeKey: (node, parentPath, depth) => {
      if (node.id && String(node.id).includes(':')) {
        return String(node.id);
      }
      return parentPath ? `${parentPath}/pay:${node.id}` : `node:${node.id}`;
    },
    getChildren: (node) => {
      return node.departments || node.journals || node.partners || node.payments || node.children || [];
    },
    hasChildren: (node) => {
      if (node.departments && node.departments.length > 0) return true;
      if (node.journals && node.journals.length > 0) return true;
      if (node.partners && node.partners.length > 0) return true;
      if (node.type === 'partner') return true;
      return false;
    },
    loadChildren: async (node, pathKey) => {
      if (node.type === 'partner') {
        try {
          const res = await api.getActualCollectionPayments({
            companyId: node.company_id,
            partnerId: node.partner_id,
            journalId: node.journal_id,
            years: periodParams.years,
            dateFrom: periodParams.dateFrom,
            dateTo: periodParams.dateTo,
            limit: 250
          });
          const rawPayments = res.payments || [];
          return rawPayments.map(p => ({
            id: p.id,
            name: `${p.payment_date} · ${p.channel_label} (${p.payment_move_name}) ← ${p.invoice_name}`,
            type: 'payment',
            isLeaf: true,
            payment_date: p.payment_date,
            channel: p.channel,
            bank: p.channel === 'bank' ? p.amount : 0,
            sister_company: p.channel === 'sister_company' ? p.amount : 0,
            other_adjustment: p.channel === 'other_adjustment' ? p.amount : 0,
            total_collected: p.channel !== 'credit_note' ? p.amount : 0,
            credit_notes: p.channel === 'credit_note' ? p.amount : 0,
            payments_count: 1
          }));
        } catch (e) {
          console.error('Error lazy loading collection payments:', e);
          return [];
        }
      }
      return [];
    },
    renderRow: ({ node, pathKey, depth, isExpanded, hasKids, isLeaf }) => {
      const isCo = depth === 0 || node.type === 'company' || (node.id && String(node.id).startsWith('co:'));
      const isDept = depth === 1 || node.type === 'department';
      const isJournal = depth === 2 || node.type === 'journal';
      const isPartner = depth === 3 || node.type === 'partner';
      const isPayment = depth === 4 || node.type === 'payment' || isLeaf;

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
        companyDot = `<span class="company-dot" style="background:var(--company-${cid || 1});flex-shrink:0;margin:0 2px;"></span>`;
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

      const grandTotal = cards.total_collected || 1;
      const totVal = node.total_collected || 0;
      const contribPct = Math.max(0, Math.min(100, Math.round((totVal / grandTotal) * 1000) / 10));

      return `
        <tr data-tree-row="true" data-path-key="${escapeHtml(pathKey)}" style="${cursor} ${rowStyle} border-bottom:1px solid var(--border-default);height:44px;">
          <td data-col-id="name" data-priority="1" class="tree-col-name" style="padding:10px 14px;padding-right:${indent + 14}px;text-align:right;" title="${escapeHtml(node.name || '')}">
            <div class="tree-name-cell" style="display:inline-flex;align-items:center;gap:6px;max-width:100%;vertical-align:middle;">
              <span data-tree-toggle="true" style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;color:var(--text-muted);flex-shrink:0;">
                ${iconSvg}
              </span>
              ${companyDot}
              <span class="tree-node-name" data-tree-name="true" style="vertical-align:middle;white-space:normal;word-break:break-word;${nodeColor}">
                ${escapeHtml(node.name || '')}
              </span>
            </div>
          </td>
          <td data-col-id="bank" data-priority="2" class="tree-col-num tabular-nums" style="padding:10px 10px;text-align:left;font-family:var(--font-en);color:var(--text-primary);">${fmtVal(node.bank)}</td>
          <td data-col-id="sister_company" data-priority="2" class="tree-col-num tabular-nums" style="padding:10px 10px;text-align:left;font-family:var(--font-en);color:var(--text-primary);">${fmtVal(node.sister_company)}</td>
          ${showOther ? `<td data-col-id="other_adjustment" data-priority="2" class="tree-col-num tabular-nums" style="padding:10px 10px;text-align:left;font-family:var(--font-en);color:var(--text-primary);">${fmtVal(node.other_adjustment)}</td>` : ''}
          <td data-col-id="total_collected" data-priority="1" class="tree-col-num tabular-nums" style="padding:10px 10px;text-align:left;font-family:var(--font-en);font-weight:700;color:var(--text-primary);">${fmtVal(node.total_collected)}</td>
          <td data-col-id="contribution" data-priority="2" class="tree-col-visual" style="padding:10px 10px;text-align:center;">
            <div style="display:flex;align-items:center;gap:6px;justify-content:center;width:100%;">
              <div style="flex:1;max-width:44px;height:5px;background:var(--border-default);border-radius:3px;overflow:hidden;">
                <div style="width:${contribPct}%;height:100%;background:var(--brand-accent);border-radius:3px;"></div>
              </div>
              <span style="font-size:12px;font-family:var(--font-en);color:var(--text-secondary);min-width:36px;text-align:left;direction:ltr;">${contribPct.toFixed(1)}%</span>
            </div>
          </td>
          <td data-col-id="credit_notes" data-priority="2" class="tree-col-num tabular-nums" style="padding:10px 10px;text-align:left;font-family:var(--font-en);color:var(--text-secondary);">${fmtVal(node.credit_notes)}</td>
          <td data-col-id="payments_count" data-priority="2" class="tree-col-num tabular-nums" style="padding:10px 10px;text-align:left;font-family:var(--font-en);color:var(--text-secondary);">${node.payments_count ? Number(node.payments_count).toLocaleString('en-US') : '—'}</td>
        </tr>
      `;
    },
    renderTotals: (t, cols) => `
      <tr class="tree-table-totals" style="background:var(--bg-subtle);font-weight:700;border-top:2px solid var(--border-default);height:44px;">
        <td class="tree-col-name" style="padding:12px 14px;text-align:right;color:var(--text-primary);">الإجمالي</td>
        <td class="tree-col-num tabular-nums" style="padding:12px 10px;text-align:left;font-family:var(--font-en);color:var(--text-primary);">${fmtVal(t.bank, false)}</td>
        <td class="tree-col-num tabular-nums" style="padding:12px 10px;text-align:left;font-family:var(--font-en);color:var(--text-primary);">${fmtVal(t.sister_company, false)}</td>
        ${showOther ? `<td class="tree-col-num tabular-nums" style="padding:12px 10px;text-align:left;font-family:var(--font-en);color:var(--text-primary);">${fmtVal(t.other_adjustment, false)}</td>` : ''}
        <td class="tree-col-num tabular-nums" style="padding:12px 10px;text-align:left;font-family:var(--font-en);color:var(--text-primary);">${fmtVal(t.total_collected, false)}</td>
        <td class="tree-col-visual" style="padding:12px 10px;text-align:center;font-family:var(--font-en);color:var(--text-primary);direction:ltr;">100%</td>
        <td class="tree-col-num tabular-nums" style="padding:12px 10px;text-align:left;font-family:var(--font-en);color:var(--text-primary);">${fmtVal(t.credit_notes, false)}</td>
        <td class="tree-col-num tabular-nums" style="padding:12px 10px;text-align:left;font-family:var(--font-en);color:var(--text-primary);">${(t.payments_count || 0).toLocaleString('en-US')}</td>
      </tr>
    `
  });
}

function renderAuditNonBankTable(auditList, auditSummary) {
  if (!auditList || auditList.length === 0) {
    return `<div style="text-align:center;padding:32px;color:var(--text-muted);font-size:13px;">✓ لا توجد سدادات خارج بنك الشركة في هذا النطاق</div>`;
  }

  return `
    <table class="bi-table" style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="background:var(--bg-subtle);border-bottom:1px solid var(--border-default);">
          <th class="col-name" style="padding:10px 14px;text-align:right;color:var(--text-secondary);font-size:12px;font-weight:600;">قيد السداد</th>
          <th class="col-name" style="padding:10px 14px;text-align:right;color:var(--text-secondary);font-size:12px;font-weight:600;">التاريخ</th>
          <th class="col-name" style="padding:10px 14px;text-align:right;color:var(--text-secondary);font-size:12px;font-weight:600;">العميل</th>
          <th class="col-name" style="padding:10px 14px;text-align:right;color:var(--text-secondary);font-size:12px;font-weight:600;">استلمته</th>
          <th class="col-name" style="padding:10px 14px;text-align:right;color:var(--text-secondary);font-size:12px;font-weight:600;">القيد البنكي المقابل</th>
          <th class="col-num" style="padding:10px 10px;text-align:left;color:var(--text-secondary);font-size:12px;font-weight:600;">المبلغ</th>
        </tr>
      </thead>
      <tbody>
        ${auditList.map(item => `
          <tr style="border-bottom:1px solid var(--border-default);height:44px;">
            <td class="col-name" style="padding:10px 14px;text-align:right;font-family:var(--font-en);font-weight:600;color:var(--text-primary);">${escapeHtml(item.payment_move_name)}</td>
            <td class="col-name" style="padding:10px 14px;text-align:right;font-family:var(--font-en);color:var(--text-secondary);">${escapeHtml(item.payment_date)}</td>
            <td class="col-name" style="padding:10px 14px;text-align:right;font-weight:500;color:var(--text-primary);">${escapeHtml(item.partner_name)}</td>
            <td class="col-name" style="padding:10px 14px;text-align:right;color:var(--text-secondary);">${escapeHtml(item.sister_company_name || item.counterpart_partner_name || item.company_name)}</td>
            <td class="col-name" style="padding:10px 14px;text-align:right;font-family:var(--font-en);color:${item.counterpart_bank_move === 'لا مقابل' ? 'var(--status-negative)' : 'var(--text-secondary)'};">
              ${escapeHtml(item.counterpart_bank_move || '—')}
            </td>
            <td class="col-num" style="padding:10px 10px;text-align:left;font-family:var(--font-en);font-weight:600;color:var(--text-primary);">${fmtVal(item.amount, false)}</td>
          </tr>
        `).join('')}
      </tbody>
      <tfoot>
        <tr style="background:var(--bg-subtle);font-weight:700;border-top:2px solid var(--border-default);height:44px;">
          <td class="col-name" style="padding:12px 14px;color:var(--text-primary);">الإجمالي</td>
          <td colspan="4" class="col-name" style="padding:12px 14px;color:var(--text-secondary);">${auditSummary.transactions_count || auditList.length} سداداً</td>
          <td class="col-num" style="padding:12px 10px;text-align:left;font-family:var(--font-en);color:var(--text-primary);">${fmtVal(auditSummary.total_non_bank_amount, false)}</td>
        </tr>
      </tfoot>
    </table>
  `;
}

function setupCollectionsEvents(topBody, container, data, periodParams, selectedCos, topContainer, timeFilter, globalFilters) {
  const cards = data.cards || {};
  const showOther = (cards.other_collected || 0) > 0;

  // 1. Time Grain Buttons (month / quarter / year)
  const grainBtns = container.querySelectorAll('.col-grain-btn');
  grainBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      currentTimeGrain = btn.dataset.grain;
      grainBtns.forEach(b => {
        const isActive = b.dataset.grain === currentTimeGrain;
        b.classList.toggle('active', isActive);
        b.style.background = isActive ? 'var(--brand-primary)' : 'transparent';
        b.style.color = isActive ? 'var(--text-on-brand)' : 'var(--text-secondary)';
      });

      const series = data.periodic_series || [];
      const aggSeries = getAggregatedSeries(series, currentTimeGrain);

      const chartBox = container.querySelector('#col-chart-box');
      if (chartBox) chartBox.innerHTML = renderStackedBarChart(aggSeries, showOther);

      const tbody = container.querySelector('#col-series-tbody');
      if (tbody) tbody.innerHTML = renderPeriodicTableRows(aggSeries, showOther);
    });
  });

  // 2. View Mode Buttons (tree vs direct)
  const viewBtns = container.querySelectorAll('.col-view-btn');
  const treeBox = container.querySelector('#col-tree-container');
  const directBox = container.querySelector('#col-direct-container');

  viewBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      currentViewMode = btn.dataset.mode;
      viewBtns.forEach(b => {
        const isActive = b.dataset.mode === currentViewMode;
        b.classList.toggle('active', isActive);
        b.style.background = isActive ? 'var(--brand-primary)' : 'transparent';
        b.style.color = isActive ? 'var(--text-on-brand)' : 'var(--text-secondary)';
      });

      if (currentViewMode === 'tree') {
        if (treeBox) treeBox.style.display = 'block';
        if (directBox) directBox.style.display = 'none';
      } else {
        if (treeBox) treeBox.style.display = 'none';
        if (directBox) directBox.style.display = 'block';
      }
    });
  });

  // 3. Client Search Input
  const searchInput = container.querySelector('#col-client-search');
  const clearSearchBtn = container.querySelector('#btn-col-clear-search');
  const searchCounterEl = container.querySelector('#col-search-counter');

  if (currentTreeTable && searchInput) {
    currentTreeTable.bindSearchInput(searchInput, {
      clearBtnEl: clearSearchBtn,
      counterEl: searchCounterEl
    });
  }

  searchInput?.addEventListener('input', (e) => {
    clientSearchQuery = e.target.value.trim();
    if (directBox && currentViewMode === 'direct') {
      directBox.innerHTML = renderDirectClientsTable(data.clients_direct || [], clientSearchQuery, showOther);
      attachDirectRowEvents(directBox, periodParams, selectedCos);
    }
  });

  clearSearchBtn?.addEventListener('click', () => {
    clientSearchQuery = '';
    if (searchInput) searchInput.value = '';
    if (directBox && currentViewMode === 'direct') {
      directBox.innerHTML = renderDirectClientsTable(data.clients_direct || [], '', showOther);
      attachDirectRowEvents(directBox, periodParams, selectedCos);
    }
  });

  attachDirectRowEvents(container, periodParams, selectedCos);

  // 4. Section 5 collapsible toggle
  const sec5Header = container.querySelector('#col-sec5-header');
  const sec5Body = container.querySelector('#col-sec5-body');
  const sec5Icon = container.querySelector('#col-sec5-toggle-icon');
  sec5Header?.addEventListener('click', () => {
    isSec5Open = !isSec5Open;
    if (sec5Body) sec5Body.style.display = isSec5Open ? 'flex' : 'none';
    if (sec5Icon) sec5Icon.textContent = isSec5Open ? '▲' : '▼';
  });

  const toggleUnallocatedBtn = container.querySelector('#btn-col-toggle-unallocated');
  toggleUnallocatedBtn?.addEventListener('click', () => {
    isSec5Open = true;
    if (sec5Body) sec5Body.style.display = 'flex';
    if (sec5Icon) sec5Icon.textContent = '▲';
    sec5Body?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });

  // 5. Excel Export Button
  const btnExport = container.querySelector('#btn-export-excel-collections');
  btnExport?.addEventListener('click', async () => {
    try {
      btnExport.disabled = true;
      btnExport.innerHTML = `${ICONS.excel} جاري التصدير...`;
      await exportCollectionsToExcel(data, periodParams, selectedCos, globalFilters);
      btnExport.innerHTML = `${ICONS.check} تم التصدير بنجاح!`;
      setTimeout(() => {
        btnExport.disabled = false;
        btnExport.innerHTML = `${ICONS.excel} تصدير Excel`;
      }, 2500);
    } catch (err) {
      console.error('Excel Export error:', err);
      alert('حدث خطأ أثناء تصدير Excel: ' + err.message);
      btnExport.disabled = false;
      btnExport.innerHTML = `${ICONS.excel} تصدير Excel`;
    }
  });
}

function attachDirectRowEvents(container, periodParams, selectedCos) {
  const detailBtns = container.querySelectorAll('.btn-col-partner-detail');
  detailBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const pid = btn.dataset.partnerId;
      const pname = btn.dataset.partnerName;
      if (pid) {
        openPartnerPaymentsModal(pid, pname, periodParams, selectedCos);
      }
    });
  });
}

async function openPartnerPaymentsModal(partnerId, partnerName, periodParams, selectedCos) {
  let modal = document.getElementById('col-partner-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'col-partner-modal';
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;direction:rtl;';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div style="background:var(--bg-surface);border:1px solid var(--border-default);border-radius:18px;width:950px;max-width:92vw;max-height:85vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.4);">
      <div style="padding:16px 20px;border-bottom:1px solid var(--border-default);display:flex;justify-content:space-between;align-items:center;background:var(--bg-subtle);">
        <div>
          <h3 style="margin:0;font-size:16px;font-weight:700;color:var(--text-primary);">سجل سدادات العميل: ${escapeHtml(partnerName)}</h3>
          <span style="font-size:12px;color:var(--text-muted);">عرض تفصيلي لسطور التسوية والفواتير المسددة</span>
        </div>
        <button id="btn-close-col-modal" style="background:none;border:none;color:var(--text-muted);font-size:18px;cursor:pointer;padding:4px 8px;">✕</button>
      </div>
      <div id="col-modal-body" style="padding:20px 24px;overflow-y:auto;flex:1;">
        <div style="text-align:center;padding:40px;color:var(--text-muted);">جاري جلب سطور السداد...</div>
      </div>
    </div>
  `;
  modal.style.display = 'flex';

  modal.querySelector('#btn-close-col-modal').addEventListener('click', () => {
    modal.style.display = 'none';
  });

  try {
    const res = await api.getActualCollectionPayments({
      partnerId: Number(partnerId),
      companyIds: selectedCos ? selectedCos.join(',') : undefined,
      years: periodParams.years,
      dateFrom: periodParams.dateFrom,
      dateTo: periodParams.dateTo,
      limit: 500
    });
    const payments = res.payments || [];
    const modalBody = modal.querySelector('#col-modal-body');

    if (payments.length === 0) {
      modalBody.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted);">لا توجد سطور سداد مسجلة لهذا العميل في الفترة المحددة</div>`;
      return;
    }

    modalBody.innerHTML = `
      <div style="width:100%;max-width:100%;overflow-x:auto;box-sizing:border-box;" data-scroll-x="true">
        <table class="bi-table" style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:var(--bg-subtle);border-bottom:1px solid var(--border-default);">
              <th style="padding:8px 10px;text-align:right;color:var(--text-secondary);font-size:12px;font-weight:600;">القناة</th>
              <th style="padding:8px 10px;text-align:right;color:var(--text-secondary);font-size:12px;font-weight:600;">تاريخ السداد</th>
              <th style="padding:8px 10px;text-align:right;color:var(--text-secondary);font-size:12px;font-weight:600;">الشركة</th>
              <th style="padding:8px 10px;text-align:right;color:var(--text-secondary);font-size:12px;font-weight:600;">رقم الفاتورة</th>
              <th style="padding:8px 10px;text-align:right;color:var(--text-secondary);font-size:12px;font-weight:600;">تاريخ الفاتورة</th>
              <th style="padding:8px 10px;text-align:right;color:var(--text-secondary);font-size:12px;font-weight:600;">قيد السداد</th>
              <th style="padding:8px 10px;text-align:right;color:var(--text-secondary);font-size:12px;font-weight:600;">البيان</th>
              <th style="padding:8px 10px;text-align:right;color:var(--text-secondary);font-size:12px;font-weight:600;">الحساب المقابل</th>
              <th style="padding:8px 10px;text-align:left;color:var(--text-secondary);font-size:12px;font-weight:600;">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            ${payments.map(p => `
              <tr style="border-bottom:1px solid var(--border-default);height:40px;">
                <td style="padding:8px 10px;">
                  <span style="font-size:11px;padding:2px 8px;border-radius:6px;font-weight:600;background:${p.channel === 'bank' ? 'var(--status-positive-subtle)' : (p.channel === 'sister_company' ? 'var(--brand-accent-subtle, rgba(29,106,229,0.1))' : 'var(--bg-subtle)')};color:${p.channel === 'bank' ? 'var(--status-positive)' : (p.channel === 'sister_company' ? 'var(--brand-accent)' : 'var(--text-secondary)')};">
                    ${escapeHtml(p.channel_label)}
                  </span>
                </td>
                <td style="padding:8px 10px;font-family:var(--font-en);color:var(--text-primary);">${escapeHtml(p.payment_date)}</td>
                <td style="padding:8px 10px;color:var(--text-secondary);">${escapeHtml(p.company_name)}</td>
                <td style="padding:8px 10px;font-family:var(--font-en);color:var(--brand-accent);">${escapeHtml(p.invoice_name)}</td>
                <td style="padding:8px 10px;font-family:var(--font-en);color:var(--text-muted);">${escapeHtml(p.invoice_date)}</td>
                <td style="padding:8px 10px;font-family:var(--font-en);color:var(--text-primary);">${escapeHtml(p.payment_move_name)}</td>
                <td style="padding:8px 10px;font-size:12px;color:var(--text-muted);">${escapeHtml(p.payment_label || '—')}</td>
                <td style="padding:8px 10px;font-size:12px;color:var(--text-secondary);">${p.sister_company_name ? `<strong>${escapeHtml(p.sister_company_name)}</strong><br>` : ''}${escapeHtml(p.counterpart_account_name || '')}</td>
                <td style="padding:8px 10px;text-align:left;font-family:var(--font-en);font-weight:700;color:var(--text-primary);">${fmtVal(p.amount, false)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    modal.querySelector('#col-modal-body').innerHTML = `<div style="color:var(--status-negative);text-align:center;padding:30px;">خطأ أثناء جلب التفاصيل: ${escapeHtml(err.message)}</div>`;
  }
}

async function exportCollectionsToExcel(data, periodParams, selectedCos, globalFilters) {
  if (typeof XLSX === 'undefined') {
    throw new Error('مكتبة XLSX غير محملة');
  }

  const wb = XLSX.utils.book_new();

  // Sheet 1: ملخص التحصيل الهرمي
  const sheet1Rows = [
    ['الشركة', 'المجموعة', 'دفتر اليومية', 'العميل', 'بنك/نقد الشركة', 'عبر شركة شقيقة', 'تسويات أخرى', 'إجمالي التحصيل', 'إشعارات دائنة', 'عدد السدادات']
  ];

  for (const co of (data.tree || [])) {
    for (const d of (co.departments || [])) {
      for (const j of (d.journals || [])) {
        for (const p of (j.partners || [])) {
          sheet1Rows.push([
            co.name,
            d.name,
            j.name,
            p.name,
            p.bank || 0,
            p.sister_company || 0,
            p.other_adjustment || 0,
            p.total_collected || 0,
            p.credit_notes || 0,
            p.payments_count || 0
          ]);
        }
      }
    }
  }

  const ws1 = XLSX.utils.aoa_to_sheet(sheet1Rows);
  XLSX.utils.book_append_sheet(wb, ws1, 'ملخص التحصيل الهرمي');

  // Sheet 2: سجل السدادات التفصيلي
  const res = await api.getActualCollectionPayments({
    companyIds: selectedCos ? selectedCos.join(',') : undefined,
    journalIds: (globalFilters?.journalIds && globalFilters.journalIds.length > 0) ? globalFilters.journalIds.join(',') : undefined,
    groupIds: (globalFilters?.groupIds && globalFilters.groupIds.length > 0) ? globalFilters.groupIds.join(',') : undefined,
    years: periodParams.years,
    dateFrom: periodParams.dateFrom,
    dateTo: periodParams.dateTo,
    limit: 10000
  });

  const allPayments = res.payments || [];
  const sheet2Rows = [
    ['قناة الاستلام', 'تاريخ السداد', 'اسم العميل', 'الشركة', 'رقم الفاتورة', 'تاريخ الفاتورة', 'دفتر السداد', 'قيد السداد', 'البيان / الملاحظات', 'الحساب المقابل', 'الشركة الشقيقة', 'المبلغ المحصّل']
  ];

  for (const p of allPayments) {
    sheet2Rows.push([
      p.channel_label || p.channel,
      p.payment_date,
      p.partner_name,
      p.company_name,
      p.invoice_name,
      p.invoice_date,
      p.payment_journal_name,
      p.payment_move_name,
      p.payment_label || '',
      `${p.counterpart_account_code || ''} ${p.counterpart_account_name || ''}`.trim(),
      p.sister_company_name || '',
      p.amount || 0
    ]);
  }

  const ws2 = XLSX.utils.aoa_to_sheet(sheet2Rows);
  XLSX.utils.book_append_sheet(wb, ws2, 'سجل السدادات التفصيلي');

  const fileName = `التحصيل_الفعلي_${periodParams.years || 'فترة'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

