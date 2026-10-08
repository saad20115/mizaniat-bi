import { api } from '../api.js';
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
let currentTimeGrain = 'month'; // 'month' | 'quarter' | 'year'
let currentViewMode = 'tree';   // 'tree' | 'direct'
let activeDetailModal = null;
let clientSearchQuery = '';

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
    return `<span class="exec-num-neg" style="color:var(--col-refund);direction:ltr;display:inline-block;">(${Math.abs(rounded).toLocaleString('en-US')})</span>`;
  }
  return `<span class="exec-num" style="color:var(--exec-text);">${rounded.toLocaleString('en-US')}</span>`;
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
    return `<tr><td colspan="${colSpan}" style="text-align:center;padding:24px;color:var(--exec-text-muted);">لا توجد حركات تحصيل في الفترة المحددة</td></tr>`;
  }
  return seriesList.map(s => `
    <tr style="border-bottom:1px solid var(--exec-border);">
      <td style="padding:11px 14px;font-weight:700;color:var(--exec-text);font-family:var(--font-ar);font-size:0.95rem;">${escapeHtml(s.label || s.period)}</td>
      <td style="padding:11px 14px;text-align:left;font-family:var(--font-en);font-weight:600;color:var(--col-bank);">${fmtVal(s.bank)}</td>
      <td style="padding:11px 14px;text-align:left;font-family:var(--font-en);font-weight:600;color:var(--col-sister);">${fmtVal(s.sister_company)}</td>
      ${showOther ? `<td style="padding:11px 14px;text-align:left;font-family:var(--font-en);font-weight:600;color:var(--col-other);">${fmtVal(s.other_adjustment)}</td>` : ''}
      <td style="padding:11px 14px;text-align:left;font-family:var(--font-en);font-weight:800;color:var(--col-total);">${fmtVal(s.total_collected)}</td>
      <td style="padding:11px 14px;text-align:left;font-family:var(--font-en);font-weight:600;color:var(--col-refund);">${fmtVal(s.credit_notes)}</td>
      <td style="padding:11px 14px;text-align:center;font-family:var(--font-en);color:var(--exec-text);">${(s.payments_count || 0).toLocaleString('en-US')}</td>
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

  container.innerHTML = `
    <!-- Top Action & Info Bar -->
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;padding:4px 0;margin-bottom:4px;">
      <div style="font-size:0.92rem;color:var(--exec-text-muted);font-weight:600;">
        ما دخل فعلاً خلال الفترة المحددة عبر قنوات التحصيل وفق قيود تسويات السداد المعتمدة
      </div>
      <button id="btn-export-excel-collections" class="btn" style="padding:8px 16px;background:var(--col-total-bg);color:var(--col-total);border:1px solid var(--col-total);border-radius:8px;font-weight:700;font-size:0.9rem;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
        <span>📥</span> تصدير التحصيل إلى Excel (ورقتان)
      </button>
    </div>

    <!-- Section 1: «كم حصّلنا؟» -->
    <div style="display:flex;flex-direction:column;gap:10px;width:100%;box-sizing:border-box;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px;">
        <h2 style="margin:0;font-size:1.35rem;font-weight:800;color:var(--exec-text);display:flex;align-items:center;gap:8px;">
          <span>💰</span> 1. كم حصّلنا؟
        </h2>
        <span style="font-size:0.88rem;color:var(--exec-text-muted);font-weight:600;">
          ℹ️ المبالغ حسب <strong style="color:var(--col-bank);">تاريخ السداد</strong> بغض النظر عن تاريخ الفاتورة
        </span>
      </div>

      <!-- KPI Summary Cards -->
      <div class="bi-kpi-row col-kpi-grid">
        <!-- Card 1: Total Collected -->
        <div class="bi-kpi" style="border-top:3px solid var(--col-total);background:var(--exec-bg-card);border:1px solid var(--exec-border);border-top:3px solid var(--col-total);border-radius:12px;padding:16px;">
          <div class="bi-kpi-label" style="color:var(--exec-text-muted);font-weight:700;font-size:0.9rem;">💵 إجمالي التحصيل الفعلي</div>
          <div class="bi-kpi-value" style="color:var(--col-total);font-size:1.5rem;font-weight:800;font-family:var(--font-en);margin:6px 0;">${fmtVal(cards.total_collected, false)}</div>
          <div class="bi-kpi-sub" style="color:var(--exec-text-muted);font-size:0.82rem;">${(cards.payments_count || 0).toLocaleString('en-US')} سداداً · ${(cards.invoices_count || 0).toLocaleString('en-US')} فاتورة</div>
        </div>

        <!-- Card 2: Bank & Cash -->
        <div class="bi-kpi" style="border-top:3px solid var(--col-bank);background:var(--exec-bg-card);border:1px solid var(--exec-border);border-top:3px solid var(--col-bank);border-radius:12px;padding:16px;">
          <div class="bi-kpi-label" style="color:var(--exec-text-muted);font-weight:700;font-size:0.9rem;">🏦 بنك ونقد</div>
          <div class="bi-kpi-value" style="color:var(--col-bank);font-size:1.5rem;font-weight:800;font-family:var(--font-en);margin:6px 0;">${fmtVal(cards.bank_collected, false)}</div>
          <div class="bi-kpi-sub" style="color:var(--exec-text-muted);font-size:0.82rem;">
            ${cards.total_collected > 0 ? ((cards.bank_collected / cards.total_collected) * 100).toFixed(1) + '%' : '0%'} من الإجمالي
          </div>
        </div>

        <!-- Card 3: Sister Company -->
        <div class="bi-kpi" style="border-top:3px solid var(--col-sister);background:var(--exec-bg-card);border:1px solid var(--exec-border);border-top:3px solid var(--col-sister);border-radius:12px;padding:16px;">
          <div class="bi-kpi-label" style="color:var(--exec-text-muted);font-weight:700;font-size:0.9rem;">🏢 عبر شركة شقيقة</div>
          <div class="bi-kpi-value" style="color:var(--col-sister);font-size:1.5rem;font-weight:800;font-family:var(--font-en);margin:6px 0;">${fmtVal(cards.sister_collected, false)}</div>
          <div class="bi-kpi-sub" style="color:var(--exec-text-muted);font-size:0.8rem;line-height:1.4;">
            مبالغ استلمها بنك الشركة الأخرى في المجموعة عن فواتير هذه الشركة — ليست نقدًا إضافيًا
            <br>
            <span style="font-weight:600;">${cards.total_collected > 0 ? ((cards.sister_collected / cards.total_collected) * 100).toFixed(1) + '%' : '0%'} من الإجمالي</span>
          </div>
        </div>

        ${showOther ? `
        <!-- Card 4: Other Adjustments (shown only when > 0) -->
        <div class="bi-kpi" style="border-top:3px solid var(--col-other);background:var(--exec-bg-card);border:1px solid var(--exec-border);border-top:3px solid var(--col-other);border-radius:12px;padding:16px;">
          <div class="bi-kpi-label" style="color:var(--exec-text-muted);font-weight:700;font-size:0.9rem;">🔄 تسويات وقيود أخرى</div>
          <div class="bi-kpi-value" style="color:var(--col-other);font-size:1.5rem;font-weight:800;font-family:var(--font-en);margin:6px 0;">${fmtVal(cards.other_collected, false)}</div>
          <div class="bi-kpi-sub" style="color:var(--exec-text-muted);font-size:0.82rem;">
            ${cards.total_collected > 0 ? ((cards.other_collected / cards.total_collected) * 100).toFixed(1) + '%' : '0%'} من الإجمالي
          </div>
        </div>
        ` : ''}

        <!-- Card: Discounts & Fees (outside collection) -->
        <div class="bi-kpi" style="border-top:3px solid var(--col-discount);background:var(--exec-bg-card);border:1px solid var(--exec-border);border-top:3px solid var(--col-discount);border-radius:12px;padding:16px;">
          <div class="bi-kpi-label" style="color:var(--exec-text-muted);font-weight:700;font-size:0.9rem;">💸 خصومات ورسوم (خارج التحصيل)</div>
          <div class="bi-kpi-value" style="color:var(--col-discount);font-size:1.5rem;font-weight:800;font-family:var(--font-en);margin:6px 0;">${fmtVal(cards.discount_fees, false)}</div>
          <div class="bi-kpi-sub" style="color:var(--exec-text-muted);font-size:0.82rem;">غرامات العقد الموحد وعمولة منصة خبرة</div>
        </div>

        <!-- Card 5: Credit Notes (outside collection) -->
        <div class="bi-kpi" style="border-top:3px solid var(--col-refund);background:var(--exec-bg-card);border:1px solid var(--exec-border);border-top:3px solid var(--col-refund);border-radius:12px;padding:16px;">
          <div class="bi-kpi-label" style="color:var(--exec-text-muted);font-weight:700;font-size:0.9rem;">🧾 إشعارات دائنة (خارج التحصيل)</div>
          <div class="bi-kpi-value" style="color:var(--col-refund);font-size:1.5rem;font-weight:800;font-family:var(--font-en);margin:6px 0;">${fmtVal(cards.credit_notes, false)}</div>
          <div class="bi-kpi-sub" style="color:var(--exec-text-muted);font-size:0.82rem;">تسويات تسقيط مرتجعات</div>
        </div>

        <!-- Card 6: Unallocated Payments Balance (Scoped) -->
        <div class="bi-kpi" style="border-top:3px solid var(--col-unalloc);background:var(--exec-bg-card);border:1px solid var(--exec-border);border-top:3px solid var(--col-unalloc);border-radius:12px;padding:16px;">
          <div class="bi-kpi-label" style="color:var(--exec-text-muted);font-weight:700;font-size:0.9rem;">⏳ دفعات غير مخصصة لفواتير (عملاء النطاق)</div>
          <div class="bi-kpi-value" style="color:var(--col-unalloc);font-size:1.5rem;font-weight:800;font-family:var(--font-en);margin:6px 0;">${fmtVal(cards.unallocated_balance, false)}</div>
          <div class="bi-kpi-sub" style="color:var(--exec-text-muted);font-size:0.82rem;">${(cards.unallocated_lines_count || 0).toLocaleString('en-US')} حركة معلقة (لعملاء النطاق)</div>
        </div>
      </div>
    </div>

    <!-- Section 2: «متى تم التحصيل؟ (شهرياً / ربعياً / سنوياً)» -->
    <div class="bi-card" style="padding:22px;background:var(--exec-bg-card);border:1px solid var(--exec-border);border-radius:18px;width:100%;box-sizing:border-box;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:12px;">
        <h3 style="margin:0;font-size:1.18rem;font-weight:800;color:var(--exec-text);display:flex;align-items:center;gap:8px;">
          <span>📅</span> 2. متى تم التحصيل؟ (التوزيع الزمني: شهرياً / ربعياً / سنوياً)
        </h3>
        <!-- Time grain toggle -->
        <div style="display:inline-flex;background:var(--exec-bg-card);border:1px solid var(--exec-border);border-radius:10px;padding:3px;">
          <button class="col-grain-btn ${currentTimeGrain==='month'?'active':''}" data-grain="month" style="padding:6px 14px;border:none;border-radius:8px;font-size:0.85rem;font-weight:700;cursor:pointer;background:${currentTimeGrain==='month'?'var(--col-bank)':'transparent'};color:${currentTimeGrain==='month'?'#ffffff':'var(--exec-text-muted)'};">شهرياً</button>
          <button class="col-grain-btn ${currentTimeGrain==='quarter'?'active':''}" data-grain="quarter" style="padding:6px 14px;border:none;border-radius:8px;font-size:0.85rem;font-weight:700;cursor:pointer;background:${currentTimeGrain==='quarter'?'var(--col-bank)':'transparent'};color:${currentTimeGrain==='quarter'?'#ffffff':'var(--exec-text-muted)'};">ربع سنوي</button>
          <button class="col-grain-btn ${currentTimeGrain==='year'?'active':''}" data-grain="year" style="padding:6px 14px;border:none;border-radius:8px;font-size:0.85rem;font-weight:700;cursor:pointer;background:${currentTimeGrain==='year'?'var(--col-bank)':'transparent'};color:${currentTimeGrain==='year'?'#ffffff':'var(--exec-text-muted)'};">سنوياً</button>
        </div>
      </div>

      <!-- Visual Stacked Bar Chart -->
      <div style="margin-bottom:20px;padding:16px;background:var(--exec-bg-card);border-radius:12px;border:1px solid var(--exec-border);width:100%;box-sizing:border-box;">
        <div style="display:flex;align-items:center;justify-content:flex-end;gap:18px;margin-bottom:12px;font-size:0.82rem;font-weight:600;color:var(--exec-text);">
          <span style="display:flex;align-items:center;gap:6px;"><span style="width:12px;height:12px;background:var(--col-bank);border-radius:3px;display:inline-block;"></span> بنك ونقد</span>
          <span style="display:flex;align-items:center;gap:6px;"><span style="width:12px;height:12px;background:var(--col-sister);border-radius:3px;display:inline-block;"></span> عبر شركة شقيقة</span>
          ${showOther ? `<span style="display:flex;align-items:center;gap:6px;"><span style="width:12px;height:12px;background:var(--col-other);border-radius:3px;display:inline-block;"></span> تسويات أخرى</span>` : ''}
        </div>
        <div id="col-chart-box" data-scroll-x="true" style="overflow-x:auto;">
          ${renderStackedBarChart(getAggregatedSeries(series, currentTimeGrain), showOther)}
        </div>
      </div>

      <!-- Periodic Series Table -->
      <div data-scroll-x="true" style="width:100%;max-width:100%;overflow-x:auto;box-sizing:border-box;">
        <table class="bi-table" style="width:100%;border-collapse:collapse;font-size:0.95rem;">
          <thead>
            <tr style="background:var(--exec-bg-card);border-bottom:2px solid var(--exec-border);">
              <th style="padding:12px 14px;text-align:right;color:var(--exec-text);">الفترة</th>
              <th style="padding:12px 14px;text-align:left;color:var(--col-bank);">🏦 بنك ونقد</th>
              <th style="padding:12px 14px;text-align:left;color:var(--col-sister);">🏢 عبر شركة شقيقة</th>
              ${showOther ? `<th style="padding:12px 14px;text-align:left;color:var(--col-other);">🔄 تسويات أخرى</th>` : ''}
              <th style="padding:12px 14px;text-align:left;color:var(--col-total);font-weight:800;">💵 إجمالي التحصيل</th>
              <th style="padding:12px 14px;text-align:left;color:var(--col-refund);">🧾 إشعارات دائنة</th>
              <th style="padding:12px 14px;text-align:center;color:var(--exec-text);">عدد السدادات</th>
            </tr>
          </thead>
          <tbody id="col-series-tbody">
            ${renderPeriodicTableRows(getAggregatedSeries(series, currentTimeGrain), showOther)}
          </tbody>
          <tfoot>
            <tr style="background:var(--exec-bg-card);font-weight:800;border-top:2px solid var(--exec-border);">
              <td style="padding:14px;color:var(--exec-text);">المجموع الإجمالي</td>
              <td style="padding:14px;text-align:left;font-family:var(--font-en);color:var(--col-bank);">${fmtVal(cards.bank_collected, false)}</td>
              <td style="padding:14px;text-align:left;font-family:var(--font-en);color:var(--col-sister);">${fmtVal(cards.sister_collected, false)}</td>
              ${showOther ? `<td style="padding:14px;text-align:left;font-family:var(--font-en);color:var(--col-other);">${fmtVal(cards.other_collected, false)}</td>` : ''}
              <td style="padding:14px;text-align:left;font-family:var(--font-en);color:var(--col-total);">${fmtVal(cards.total_collected, false)}</td>
              <td style="padding:14px;text-align:left;font-family:var(--font-en);color:var(--col-refund);">${fmtVal(cards.credit_notes, false)}</td>
              <td style="padding:14px;text-align:center;font-family:var(--font-en);color:var(--exec-text);">${(cards.payments_count || 0).toLocaleString('en-US')}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- Section 3: «من أي سنوات فواتير؟ (عمر المديونية المحصلة)» -->
    <div class="bi-card" style="padding:22px;background:var(--exec-bg-card);border:1px solid var(--exec-border);border-radius:18px;width:100%;box-sizing:border-box;">
      <div style="margin-bottom:16px;">
        <h3 style="margin:0 0 6px 0;font-size:1.18rem;font-weight:800;color:var(--exec-text);display:flex;align-items:center;gap:8px;">
          <span>🗓️</span> 3. من أي سنوات فواتير؟ (عمر المديونية المحصلة)
        </h3>
        <span style="font-size:0.86rem;color:var(--exec-text-muted);">
          يوضّح هذا الجدول كم من أموال الفترة حُصّلت لسداد فواتير سنوات سابقة مقابل فواتير السنة الحالية
        </span>
      </div>

      <div data-scroll-x="true" style="width:100%;max-width:100%;overflow-x:auto;box-sizing:border-box;">
        <table class="bi-table" style="width:100%;border-collapse:collapse;font-size:0.95rem;">
          <thead>
            <tr style="background:var(--exec-bg-card);border-bottom:2px solid var(--exec-border);">
              <th style="padding:12px 14px;text-align:right;color:var(--exec-text);">سنة الفاتورة</th>
              ${extractCompanyHeaders(byInvYear).map(h => `<th style="padding:12px 14px;text-align:left;color:var(--exec-text);">${escapeHtml(h)}</th>`).join('')}
              <th style="padding:12px 14px;text-align:left;color:var(--col-total);font-weight:800;">إجمالي التحصيل في الفترة</th>
              <th style="padding:12px 14px;text-align:center;color:var(--exec-text);">النسبة</th>
              <th style="padding:12px 14px;text-align:left;color:var(--col-refund);">إشعارات دائنة</th>
            </tr>
          </thead>
          <tbody>
            ${byInvYear.length === 0 ? `
              <tr><td colspan="6" style="text-align:center;padding:24px;color:var(--exec-text-muted);">لا توجد بيانات لسنة الفاتورة</td></tr>
            ` : byInvYear.map(row => {
              const coHeaders = extractCompanyHeaders(byInvYear);
              return `
                <tr style="border-bottom:1px solid var(--exec-border);">
                  <td style="padding:11px 14px;font-family:var(--font-en);font-weight:700;color:var(--col-bank);">${escapeHtml(row.invoice_year || 'غير محدد')}</td>
                  ${coHeaders.map(ch => `
                    <td style="padding:11px 14px;text-align:left;font-family:var(--font-en);color:var(--exec-text);">
                      ${fmtVal(row.companies[ch] || 0)}
                    </td>
                  `).join('')}
                  <td style="padding:11px 14px;text-align:left;font-family:var(--font-en);font-weight:800;color:var(--col-total);">${fmtVal(row.total)}</td>
                  <td style="padding:11px 14px;text-align:center;font-family:var(--font-en);font-weight:700;color:var(--exec-text);">${row.pct_of_total}%</td>
                  <td style="padding:11px 14px;text-align:left;font-family:var(--font-en);font-weight:600;color:var(--col-refund);">${fmtVal(row.credit_notes)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
          <tfoot>
            <tr style="background:var(--exec-bg-card);font-weight:800;border-top:2px solid var(--exec-border);">
              <td style="padding:14px;color:var(--exec-text);">المجموع</td>
              ${extractCompanyHeaders(byInvYear).map(ch => {
                const sumCo = byInvYear.reduce((acc, r) => acc + (r.companies[ch] || 0), 0);
                return `<td style="padding:14px;text-align:left;font-family:var(--font-en);color:var(--exec-text);">${fmtVal(sumCo, false)}</td>`;
              }).join('')}
              <td style="padding:14px;text-align:left;font-family:var(--font-en);color:var(--col-total);">${fmtVal(cards.total_collected, false)}</td>
              <td style="padding:14px;text-align:center;font-family:var(--font-en);color:var(--exec-text);">100%</td>
              <td style="padding:14px;text-align:left;font-family:var(--font-en);color:var(--col-refund);">${fmtVal(cards.credit_notes, false)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- Section 4: «أين تم التحصيل؟ (حسب الدفتر والعميل)» -->
    <div class="bi-card" style="padding:22px;background:var(--exec-bg-card);border:1px solid var(--exec-border);border-radius:18px;width:100%;box-sizing:border-box;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;flex-wrap:wrap;gap:12px;">
        <h3 style="margin:0;font-size:1.18rem;font-weight:800;color:var(--exec-text);display:flex;align-items:center;gap:8px;">
          <span>🌳</span> 4. أين تم التحصيل؟ (حسب الدفتر والعميل)
        </h3>
        
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <!-- Search box -->
          <div style="position:relative;display:inline-flex;align-items:center;">
            <input type="text" id="col-client-search" placeholder="بحث…" value="${escapeHtml(clientSearchQuery)}" style="background:var(--exec-bg-card);color:var(--exec-text);border:1px solid var(--exec-border);padding:7px 28px 7px 12px;border-radius:8px;font-size:0.88rem;outline:none;width:190px;">
            <button id="btn-col-clear-search" style="position:absolute;left:8px;top:50%;transform:translateY(-50%);background:none;border:none;color:var(--exec-text-muted);cursor:pointer;display:none;font-size:0.85rem;">✕</button>
            <span id="col-search-counter" style="display:none;font-size:0.75rem;padding:2px 8px;border-radius:10px;margin-right:6px;font-weight:700;"></span>
          </div>

          <!-- View Mode Toggle -->
          <div style="display:inline-flex;background:var(--exec-bg-card);border:1px solid var(--exec-border);border-radius:10px;padding:3px;">
            <button class="col-view-btn ${currentViewMode==='tree'?'active':''}" data-mode="tree" style="padding:6px 14px;border:none;border-radius:8px;font-size:0.85rem;font-weight:700;cursor:pointer;background:${currentViewMode==='tree'?'var(--col-bank)':'transparent'};color:${currentViewMode==='tree'?'#ffffff':'var(--exec-text-muted)'};">
              الهرمي (الشركة ← المجموعة ← الدفتر ← العميل)
            </button>
            <button class="col-view-btn ${currentViewMode==='direct'?'active':''}" data-mode="direct" style="padding:6px 14px;border:none;border-radius:8px;font-size:0.85rem;font-weight:700;cursor:pointer;background:${currentViewMode==='direct'?'var(--col-bank)':'transparent'};color:${currentViewMode==='direct'?'#ffffff':'var(--exec-text-muted)'};">
              العملاء مباشرة (مرتّب تنازلياً)
            </button>
          </div>
        </div>
      </div>

      <!-- Container for TreeTable or Direct Table -->
      <div id="col-tree-container" data-scroll-x="true" style="${currentViewMode==='tree'?'display:block;':'display:none;'}width:100%;max-width:100%;overflow-x:auto;box-sizing:border-box;"></div>
      <div id="col-direct-container" data-scroll-x="true" style="${currentViewMode==='direct'?'display:block;':'display:none;'}width:100%;max-width:100%;overflow-x:auto;box-sizing:border-box;">
        ${renderDirectClientsTable(clientsDirect, clientSearchQuery, showOther)}
      </div>
    </div>

    <!-- Section 5: «هل توجد دفعات من العملاء لم تُربط بفواتير؟ (المقارنة الرقابية وإثبات المطابقة)» -->
    <div class="bi-card" style="padding:22px;background:var(--exec-bg-card);border:1px solid var(--exec-border);border-radius:18px;width:100%;box-sizing:border-box;">
      <div style="margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
          <h3 style="margin:0;font-size:1.18rem;font-weight:800;color:var(--exec-text);display:flex;align-items:center;gap:8px;">
            <span>⚖️</span> 5. هل توجد دفعات من العملاء لم تُربط بفواتير؟ (المقارنة الرقابية وإثبات المطابقة)
          </h3>
          <span style="font-size:0.85rem;padding:4px 12px;border-radius:8px;background:${comparison.status === 'matched' ? 'var(--col-matched-bg)' : 'var(--col-diff-bg)'};color:${comparison.status === 'matched' ? 'var(--col-matched)' : 'var(--col-diff)'};font-weight:700;">
            ${comparison.status === 'matched' ? '✓ مطابق تماماً بالهللة' : `فارق: ${(comparison.diff || 0).toLocaleString('en-US')} ر.س`}
          </span>
        </div>
        <p style="margin:8px 0 0 0;font-size:0.86rem;color:var(--exec-text-muted);line-height:1.5;">
          يطابق هذا القسم إجمالي الحركات الدائنة على حسابات العملاء في دفتر اليومية العام (باستثناء سطور الإشعارات الدائنة) مع مجموع ما خُصص لفواتير هذا النطاق، ومخصص الدفاتر الأخرى، والدفعات غير المخصصة.
        </p>
      </div>

      <!-- Reconciliation Equation Bar (6 Balanced Cards) -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(170px, 1fr));gap:14px;margin-bottom:14px;width:100%;box-sizing:border-box;">
        <div style="padding:16px;background:var(--exec-bg-card);border:1px solid var(--exec-border);border-radius:12px;">
          <div style="font-size:0.85rem;color:var(--exec-text-muted);margin-bottom:6px;">إجمالي دائن العملاء (الدفتر العام)</div>
          <div style="font-size:1.35rem;font-weight:800;font-family:var(--font-en);color:var(--col-bank);">
            ${(comparison.total_credit_movements || 0).toLocaleString('en-US')}
          </div>
          <div style="font-size:0.75rem;color:var(--exec-text-muted);margin-top:4px;">كامل حركات دائن ذمم عملاء النطاق</div>
        </div>

        <div style="padding:16px;background:var(--exec-bg-card);border:1px solid var(--col-total);border-radius:12px;">
          <div style="font-size:0.85rem;color:var(--col-total);margin-bottom:6px;">= مخصّص لفواتير النطاق المختار</div>
          <div style="font-size:1.35rem;font-weight:800;font-family:var(--font-en);color:var(--col-total);">
            ${(comparison.allocated_in_scope || 0).toLocaleString('en-US')}
          </div>
          <div style="font-size:0.75rem;color:var(--exec-text-muted);margin-top:4px;">تحصيل فواتير هذا التقرير</div>
        </div>

        <div style="padding:16px;background:var(--exec-bg-card);border:1px solid var(--col-discount);border-radius:12px;">
          <div style="font-size:0.85rem;color:var(--col-discount);margin-bottom:6px;">+ خصومات ورسوم</div>
          <div style="font-size:1.35rem;font-weight:800;font-family:var(--font-en);color:var(--col-discount);">
            ${(comparison.discount_fees || 0).toLocaleString('en-US')}
          </div>
          <div style="font-size:0.75rem;color:var(--exec-text-muted);margin-top:4px;">غرامات العقد ومنصة خبرة</div>
        </div>

        <div style="padding:16px;background:var(--exec-bg-card);border:1px solid var(--col-sister);border-radius:12px;">
          <div style="font-size:0.85rem;color:var(--col-sister);margin-bottom:6px;">+ مخصّص لدفاتر أخرى خارج النطاق</div>
          <div style="font-size:1.35rem;font-weight:800;font-family:var(--font-en);color:var(--col-sister);">
            ${(comparison.allocated_other_journals || 0).toLocaleString('en-US')}
          </div>
          <div style="font-size:0.75rem;color:var(--exec-text-muted);margin-top:4px;">سدادات فواتير تابعة لدفاتر أخرى</div>
        </div>

        <div style="padding:16px;background:var(--exec-bg-card);border:1px solid var(--col-unalloc);border-radius:12px;">
          <div style="font-size:0.85rem;color:var(--col-unalloc);margin-bottom:6px;">+ دفعات غير مخصصة (معلّق)</div>
          <div style="font-size:1.35rem;font-weight:800;font-family:var(--font-en);color:var(--col-unalloc);">
            ${(comparison.unallocated || 0).toLocaleString('en-US')}
          </div>
          <div style="font-size:0.75rem;color:var(--exec-text-muted);margin-top:4px;">دفعات لم تُربط بفواتير في أودو</div>
        </div>

        <div style="padding:16px;background:var(--exec-bg-card);border:1px solid ${comparison.diff > 0.01 ? 'var(--col-diff)' : 'var(--col-matched)'};border-radius:12px;">
          <div style="font-size:0.85rem;color:${comparison.diff > 0.01 ? 'var(--col-diff)' : 'var(--col-matched)'};margin-bottom:6px;">+ فروقات غير مفسرة</div>
          <div style="font-size:1.35rem;font-weight:800;font-family:var(--font-en);color:${comparison.diff > 0.01 ? 'var(--col-diff)' : 'var(--col-matched)'};">
            ${comparison.diff > 0.01 ? (comparison.diff || 0).toLocaleString('en-US') : '0'}
          </div>
          <div style="font-size:0.75rem;color:var(--exec-text-muted);margin-top:4px;">${comparison.diff > 0.01 ? 'فرق بحاجة لمعاينة القيود' : '✓ مطابقة تامة بالهللة'}</div>
        </div>
      </div>

      <!-- Explicit Accounting Equation Note -->
      <div style="margin-bottom:16px;padding:12px 16px;background:var(--col-bank-bg);border:1px solid var(--col-bank);border-radius:10px;font-size:0.88rem;color:var(--exec-text);line-height:1.6;">
        📐 <strong>إثبات المطابقة والمعادلة المحاسبية:</strong>
        <span style="font-family:var(--font-en);font-weight:600;margin-right:6px;direction:ltr;display:inline-block;">
          ${escapeHtml(comparison.equation_note || 'إجمالي الدائن (حركات القيود باستثناء الإشعارات) = مخصص لفواتير النطاق + خصومات ورسوم + مخصص لدفاتر أخرى + دفعات غير مخصصة + فروقات غير مفسرة')}
        </span>
      </div>

      <!-- Unallocated Moves List if exists -->
      ${comparison.unallocated_moves && comparison.unallocated_moves.length > 0 ? `
        <div style="margin-top:16px;border-top:1px solid var(--exec-border);padding-top:14px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <div style="font-weight:700;font-size:0.92rem;color:var(--exec-text);">
              ⏳ تفصيل القيود والدفعات غير المخصصة (${comparison.unallocated_moves.length} حركة):
            </div>
            <span style="font-size:0.8rem;color:var(--exec-text-muted);">قيود سداد مسجلة بحساب العميل ولم تُربط بفواتير</span>
          </div>
          <div data-scroll-x="true" style="width:100%;max-width:100%;overflow-x:auto;max-height:280px;box-sizing:border-box;">
            <table class="bi-table" style="width:100%;border-collapse:collapse;font-size:0.86rem;">
              <thead style="position:sticky;top:0;background:var(--exec-bg-card);z-index:5;">
                <tr style="background:var(--exec-bg-card);border-bottom:2px solid var(--exec-border);">
                  <th style="padding:8px 10px;text-align:right;color:var(--exec-text);">قيد السداد</th>
                  <th style="padding:8px 10px;text-align:right;color:var(--exec-text);">التاريخ</th>
                  <th style="padding:8px 10px;text-align:right;color:var(--exec-text);">الشركة</th>
                  <th style="padding:8px 10px;text-align:right;color:var(--exec-text);">اسم العميل</th>
                  <th style="padding:8px 10px;text-align:right;color:var(--exec-text);">نوع الحركة</th>
                  <th style="padding:8px 10px;text-align:left;color:var(--exec-text);">المبلغ غير المخصص</th>
                </tr>
              </thead>
              <tbody>
                ${comparison.unallocated_moves.slice(0, 50).map(m => `
                  <tr style="border-bottom:1px solid var(--exec-border);">
                    <td style="padding:8px 10px;font-family:var(--font-en);font-weight:700;color:var(--col-bank);">${escapeHtml(m.move_name)}</td>
                    <td style="padding:8px 10px;font-family:var(--font-en);color:var(--exec-text-muted);">${escapeHtml(m.date)}</td>
                    <td style="padding:8px 10px;color:var(--exec-text-muted);">${escapeHtml(m.company_name)}</td>
                    <td style="padding:8px 10px;font-weight:600;color:var(--exec-text);">${escapeHtml(m.partner_name)}</td>
                    <td style="padding:8px 10px;font-size:0.8rem;color:var(--exec-text-muted);">${escapeHtml(m.type_label || (m.is_partial ? 'متبقي غير مخصص' : 'دفعة كاملة'))}</td>
                    <td style="padding:8px 10px;text-align:left;font-family:var(--font-en);font-weight:700;color:var(--col-other);">${fmtVal(m.amount, false)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      <!-- Other Journals Breakdown Table if exists -->
      ${comparison.other_journals_breakdown && comparison.other_journals_breakdown.length > 0 ? `
        <div style="margin-top:16px;border-top:1px solid var(--exec-border);padding-top:14px;">
          <div style="font-weight:700;font-size:0.92rem;color:var(--exec-text);margin-bottom:8px;">
            📑 تفصيل المبالغ المسددة لدفاتر أخرى خارج هذا النطاق (${comparison.other_journals_breakdown.length} دفتر):
          </div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;">
            ${comparison.other_journals_breakdown.map(j => `
              <div style="padding:6px 12px;background:var(--exec-bg-card);border:1px solid var(--exec-border);border-radius:8px;font-size:0.85rem;">
                <span style="color:var(--exec-text);">${escapeHtml(j.journal_name)}:</span>
                <strong style="color:var(--col-sister);font-family:var(--font-en);margin-right:6px;">${fmtVal(j.amount, false)}</strong>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Subtle Explanatory Note -->
      <div style="font-size:0.8rem;color:var(--exec-text-muted);margin-top:14px;padding-top:10px;border-top:1px dashed var(--exec-border);display:flex;align-items:center;gap:6px;">
        <span>ℹ️</span> <span>استُبعدت حركات أطراف ليسوا عملاء (شركات شقيقة وموظفون)</span>
      </div>
    </div>

    <!-- Section 6: «ما هي السدادات خارج بنك الشركة؟ (رقابة المقبوضات)» -->
    <div class="bi-card" style="padding:22px;background:var(--exec-bg-card);border:1px solid var(--exec-border);border-radius:18px;width:100%;box-sizing:border-box;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;">
        <div>
          <h3 style="margin:0 0 4px 0;font-size:1.18rem;font-weight:800;color:var(--exec-text);display:flex;align-items:center;gap:8px;">
            <span>🛡️</span> 6. ما هي السدادات خارج بنك الشركة؟ (رقابة المقبوضات)
          </h3>
          <span style="font-size:0.86rem;color:var(--exec-text-muted);">
            قائمة رقابية تفصيلية بكافة المقبوضات التي دخلت عبر شركات شقيقة أو قيود تسوية دون المرور بحساب بنك الشركة
          </span>
        </div>
        <div style="text-align:left;">
          <span style="font-size:0.85rem;color:var(--exec-text-muted);">الإجمالي: </span>
          <strong style="font-size:1.15rem;color:var(--col-other);font-family:var(--font-en);">${fmtVal(auditSummary.total_non_bank_amount, false)} ر.س</strong>
          <span style="font-size:0.8rem;color:var(--exec-text-muted);margin-right:8px;">(${auditSummary.transactions_count || 0} عملية)</span>
        </div>
      </div>

      <div data-scroll-x="true" style="width:100%;max-width:100%;overflow-x:auto;max-height:450px;box-sizing:border-box;">
        <table class="bi-table" style="width:100%;border-collapse:collapse;font-size:0.88rem;">
          <thead style="position:sticky;top:0;background:var(--exec-bg-card);z-index:10;">
            <tr style="background:var(--exec-bg-card);border-bottom:2px solid var(--exec-border);">
              <th style="padding:10px 12px;text-align:right;color:var(--exec-text);">قيد السداد</th>
              <th style="padding:10px 12px;text-align:right;color:var(--exec-text);">التاريخ</th>
              <th style="padding:10px 12px;text-align:right;color:var(--exec-text);">العميل</th>
              <th style="padding:10px 12px;text-align:right;color:var(--exec-text);">الشركة</th>
              <th style="padding:10px 12px;text-align:right;color:var(--exec-text);">البيان / الملاحظات</th>
              <th style="padding:10px 12px;text-align:right;color:var(--exec-text);">دفتر القيد</th>
              <th style="padding:10px 12px;text-align:right;color:var(--exec-text);">القناة</th>
              <th style="padding:10px 12px;text-align:right;color:var(--exec-text);">الحساب المقابل / الشريك</th>
              <th style="padding:10px 12px;text-align:right;color:var(--exec-text);">القيد البنكي المقابل</th>
              <th style="padding:10px 12px;text-align:right;color:var(--exec-text);">الفاتورة المسددة</th>
              <th style="padding:10px 12px;text-align:left;color:var(--exec-text);">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            ${auditList.length === 0 ? `
              <tr><td colspan="11" style="text-align:center;padding:24px;color:var(--exec-text-muted);">✓ لا توجد سدادات خارج بنك الشركة في هذا النطاق</td></tr>
            ` : auditList.map(item => `
              <tr style="border-bottom:1px solid var(--exec-border);">
                <td style="padding:9px 12px;font-family:var(--font-en);font-weight:700;color:var(--col-bank);">${escapeHtml(item.payment_move_name)}</td>
                <td style="padding:9px 12px;font-family:var(--font-en);color:var(--exec-text-muted);">${escapeHtml(item.payment_date)}</td>
                <td style="padding:9px 12px;font-weight:600;color:var(--exec-text);">${escapeHtml(item.partner_name)}</td>
                <td style="padding:9px 12px;color:var(--exec-text-muted);">${escapeHtml(item.company_name)}</td>
                <td style="padding:9px 12px;color:var(--exec-text-muted);font-size:0.84rem;">${escapeHtml(item.payment_label || '—')}</td>
                <td style="padding:9px 12px;color:var(--exec-text-muted);">${escapeHtml(item.payment_journal_name)}</td>
                <td style="padding:9px 12px;">
                  <span style="padding:2px 8px;border-radius:4px;font-size:0.75rem;background:${item.channel === 'sister_company' ? 'var(--col-sister-bg)' : 'var(--col-other-bg)'};color:${item.channel === 'sister_company' ? 'var(--col-sister)' : 'var(--col-other)'};">
                    ${escapeHtml(item.channel_label)}
                  </span>
                </td>
                <td style="padding:9px 12px;color:var(--exec-text);font-size:0.84rem;">
                  ${item.sister_company_name ? `🏢 <strong style="color:var(--col-sister);">${escapeHtml(item.sister_company_name)}</strong><br>` : ''}
                  <span style="font-family:var(--font-en);color:var(--exec-text-muted);">${escapeHtml(item.counterpart_account_code)}</span> ${escapeHtml(item.counterpart_account_name || '')}
                  ${item.counterpart_partner_name && item.counterpart_partner_name !== item.sister_company_name ? `<br><small style="color:var(--exec-text-muted);">${escapeHtml(item.counterpart_partner_name)}</small>` : ''}
                </td>
                <td style="padding:9px 12px;font-family:var(--font-en);font-weight:600;color:${item.counterpart_bank_move === 'لا مقابل' ? 'var(--col-refund)' : 'var(--col-bank)'};">
                  ${escapeHtml(item.counterpart_bank_move || '—')}
                </td>
                <td style="padding:9px 12px;font-family:var(--font-en);color:var(--col-bank);">${escapeHtml(item.invoice_name)}</td>
                <td style="padding:9px 12px;text-align:left;font-family:var(--font-en);font-weight:700;color:var(--col-other);">${fmtVal(item.amount, false)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Initialize TreeTable in Section 4
  initCollectionsTreeTable(container.querySelector('#col-tree-container'), tree, cards, periodParams);

  // Attach Event Handlers
  setupCollectionsEvents(topBody, container, data, periodParams, selectedCos, topContainer, timeFilter, globalFilters);
}

function extractCompanyHeaders(byInvYear) {
  const cos = new Set();
  for (const r of byInvYear) {
    if (r.companies) {
      for (const k of Object.keys(r.companies)) cos.add(k);
    }
  }
  return Array.from(cos);
}

function renderStackedBarChart(series, showOther = true) {
  if (!series || series.length === 0) {
    return `<div style="text-align:center;padding:20px;color:var(--exec-text-muted);">لا توجد حركات تحصيل للعرض البياني</div>`;
  }

  const maxVal = Math.max(...series.map(s => s.total_collected || 1), 1);

  return `
    <div style="display:flex;align-items:flex-end;gap:12px;height:140px;padding-top:20px;overflow-x:auto;">
      ${series.map(s => {
        const tot = s.total_collected || 0;
        const hPct = Math.max(4, Math.round((tot / maxVal) * 100));
        const bankPct = tot > 0 ? (s.bank / tot) * 100 : 0;
        const sisterPct = tot > 0 ? (s.sister_company / tot) * 100 : 0;
        const otherPct = (showOther && tot > 0) ? (s.other_adjustment / tot) * 100 : 0;

        return `
          <div style="flex:1;min-width:48px;display:flex;flex-direction:column;align-items:center;height:100%;justify-content:flex-end;" title="${escapeHtml(s.label || s.period)}: إجمالي ${tot.toLocaleString('en-US')} (بنك ونقد: ${s.bank.toLocaleString('en-US')}, شقيقة: ${s.sister_company.toLocaleString('en-US')}${showOther ? ', أخرى: ' + s.other_adjustment.toLocaleString('en-US') : ''})">
            <div style="font-size:0.72rem;font-family:var(--font-en);color:var(--exec-text-muted);margin-bottom:4px;white-space:nowrap;">
              ${tot > 0 ? Math.round(tot / 1000) + 'k' : '—'}
            </div>
            <div style="width:100%;max-width:36px;height:${hPct}%;display:flex;flex-direction:column;border-radius:4px 4px 0 0;overflow:hidden;background:var(--exec-border);">
              ${showOther ? `<div style="height:${otherPct}%;background:var(--col-other);" title="تسويات أخرى"></div>` : ''}
              <div style="height:${sisterPct}%;background:var(--col-sister);" title="عبر شركة شقيقة"></div>
              <div style="height:${bankPct}%;background:var(--col-bank);" title="بنك ونقد"></div>
            </div>
            <div style="font-size:0.75rem;color:var(--exec-text-muted);margin-top:6px;white-space:nowrap;font-family:var(--font-en);text-align:center;">
              ${escapeHtml(s.period && s.period.length > 7 ? s.period.slice(5) : s.period)}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderDirectClientsTable(clients, searchQuery, showOther = true) {
  let list = clients;
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(c => 
      (c.partner_name && c.partner_name.toLowerCase().includes(q)) ||
      (c.company_name && c.company_name.toLowerCase().includes(q)) ||
      (c.journal_name && c.journal_name.toLowerCase().includes(q))
    );
  }

  if (list.length === 0) {
    return `<div style="text-align:center;padding:32px;color:var(--exec-text-muted);">لا يوجد عملاء مطابقون للبحث</div>`;
  }

  return `
    <div style="width:100%;max-width:100%;overflow-x:auto;max-height:550px;box-sizing:border-box;" data-scroll-x="true">
      <table class="bi-table" style="width:100%;border-collapse:collapse;font-size:0.92rem;">
        <thead style="position:sticky;top:0;background:var(--exec-bg-card);z-index:10;">
          <tr style="background:var(--exec-bg-card);border-bottom:2px solid var(--exec-border);">
            <th style="padding:10px 14px;text-align:right;width:35px;color:var(--exec-text);">#</th>
            <th style="padding:10px 14px;text-align:right;min-width:200px;color:var(--exec-text);">اسم العميل</th>
            <th style="padding:10px 14px;text-align:right;color:var(--exec-text);">الشركة</th>
            <th style="padding:10px 14px;text-align:right;color:var(--exec-text);">القسم</th>
            <th style="padding:10px 14px;text-align:right;color:var(--exec-text);">دفتر اليومية</th>
            <th style="padding:10px 14px;text-align:left;color:var(--col-bank);">🏦 بنك ونقد</th>
            <th style="padding:10px 14px;text-align:left;color:var(--col-sister);">🏢 عبر شركة شقيقة</th>
            ${showOther ? `<th style="padding:10px 14px;text-align:left;color:var(--col-other);">🔄 تسويات أخرى</th>` : ''}
            <th style="padding:10px 14px;text-align:left;color:var(--col-total);font-weight:800;">💵 إجمالي التحصيل</th>
            <th style="padding:10px 14px;text-align:left;color:var(--col-refund);">🧾 إشعارات</th>
            <th style="padding:10px 14px;text-align:center;width:70px;color:var(--exec-text);">التفاصيل</th>
          </tr>
        </thead>
        <tbody>
          ${list.map((c, idx) => `
            <tr style="border-bottom:1px solid var(--exec-border);">
              <td style="padding:9px 14px;color:var(--exec-text-muted);font-family:var(--font-en);">${idx + 1}</td>
              <td style="padding:9px 14px;font-weight:700;color:var(--exec-text);">${escapeHtml(c.partner_name)}</td>
              <td style="padding:9px 14px;color:var(--exec-text-muted);">${escapeHtml(c.company_name)}</td>
              <td style="padding:9px 14px;color:var(--exec-text-muted);">${escapeHtml(c.department_name)}</td>
              <td style="padding:9px 14px;color:var(--exec-text-muted);">${escapeHtml(c.journal_name || '—')}</td>
              <td style="padding:9px 14px;text-align:left;font-family:var(--font-en);color:var(--col-bank);">${fmtVal(c.bank)}</td>
              <td style="padding:9px 14px;text-align:left;font-family:var(--font-en);color:var(--col-sister);">${fmtVal(c.sister_company)}</td>
              ${showOther ? `<td style="padding:9px 14px;text-align:left;font-family:var(--font-en);color:var(--col-other);">${fmtVal(c.other_adjustment)}</td>` : ''}
              <td style="padding:9px 14px;text-align:left;font-family:var(--font-en);font-weight:800;color:var(--col-total);">${fmtVal(c.total_collected)}</td>
              <td style="padding:9px 14px;text-align:left;font-family:var(--font-en);color:var(--col-refund);">${fmtVal(c.credit_notes)}</td>
              <td style="padding:9px 14px;text-align:center;">
                <button class="btn btn-col-partner-detail" data-partner-id="${c.partner_id}" data-partner-name="${escapeHtml(c.partner_name)}" style="padding:3px 8px;font-size:0.75rem;background:var(--col-bank-bg);color:var(--col-bank);border:1px solid var(--col-bank);border-radius:6px;cursor:pointer;">
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
    { id: 'name', label: 'البيان / الهيكل (الشركة > المجموعة > الدفتر > العميل)', minWidth: '220px', align: 'right', priority: 1 },
    { id: 'bank', label: '🏦 بنك ونقد', align: 'left', width: '115px', minWidth: '95px', priority: 2, format: (v) => fmtVal(v) },
    { id: 'sister_company', label: '🏢 عبر شركة شقيقة', align: 'left', width: '115px', minWidth: '95px', priority: 2, format: (v) => fmtVal(v) },
    ...(showOther ? [{ id: 'other_adjustment', label: '🔄 تسويات أخرى', align: 'left', width: '110px', minWidth: '90px', priority: 2, format: (v) => fmtVal(v) }] : []),
    { id: 'total_collected', label: '💵 إجمالي التحصيل', align: 'left', width: '125px', minWidth: '100px', priority: 1, format: (v) => fmtVal(v) },
    { id: 'credit_notes', label: '🧾 إشعارات دائنة', align: 'left', width: '115px', minWidth: '90px', priority: 2, format: (v) => fmtVal(v) },
    { id: 'payments_count', label: 'السدادات', align: 'center', width: '75px', minWidth: '60px', priority: 2, format: (v) => v ? Number(v).toLocaleString('en-US') : '—' }
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
      if (node.type === 'partner') return true; // Level 5 lazy load
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
    renderTotals: (t, cols) => `
      <tr class="tree-table-totals" style="background:var(--exec-bg-card);font-weight:800;border-top:2px solid var(--exec-border);">
        <td style="padding:10px 14px;text-align:right;color:var(--exec-text);">المجموع الإجمالي</td>
        <td style="padding:10px 14px;text-align:left;font-family:var(--font-en);color:var(--col-bank);">${fmtVal(t.bank, false)}</td>
        <td style="padding:10px 14px;text-align:left;font-family:var(--font-en);color:var(--col-sister);">${fmtVal(t.sister_company, false)}</td>
        ${showOther ? `<td style="padding:10px 14px;text-align:left;font-family:var(--font-en);color:var(--col-other);">${fmtVal(t.other_adjustment, false)}</td>` : ''}
        <td style="padding:10px 14px;text-align:left;font-family:var(--font-en);color:var(--col-total);">${fmtVal(t.total_collected, false)}</td>
        <td style="padding:10px 14px;text-align:left;font-family:var(--font-en);color:var(--col-refund);">${fmtVal(t.credit_notes, false)}</td>
        <td style="padding:10px 14px;text-align:center;font-family:var(--font-en);color:var(--exec-text);">${(t.payments_count || 0).toLocaleString('en-US')}</td>
      </tr>
    `
  });
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
        b.style.background = isActive ? 'var(--exec-accent, #2563eb)' : 'transparent';
        b.style.color = isActive ? '#ffffff' : 'var(--exec-text-muted)';
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
        b.style.background = isActive ? 'var(--exec-accent, #2563eb)' : 'transparent';
        b.style.color = isActive ? '#ffffff' : 'var(--exec-text-muted)';
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

  // 4. Excel Export Button
  const btnExport = container.querySelector('#btn-export-excel-collections');
  btnExport?.addEventListener('click', async () => {
    try {
      btnExport.disabled = true;
      btnExport.innerHTML = '<span>⏳</span> جاري التصدير...';
      await exportCollectionsToExcel(data, periodParams, selectedCos, globalFilters);
      btnExport.innerHTML = '<span>✓</span> تم التصدير بنجاح!';
      setTimeout(() => {
        btnExport.disabled = false;
        btnExport.innerHTML = '<span>📥</span> تصدير التحصيل إلى Excel (ورقتان)';
      }, 2500);
    } catch (err) {
      console.error('Excel Export error:', err);
      alert('حدث خطأ أثناء تصدير Excel: ' + err.message);
      btnExport.disabled = false;
      btnExport.innerHTML = '<span>📥</span> تصدير التحصيل إلى Excel (ورقتان)';
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
    modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;direction:rtl;';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div style="background:var(--exec-bg-card);border:1px solid var(--exec-border);border-radius:18px;width:950px;max-width:92vw;max-height:85vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.5);">
      <div style="padding:18px 24px;border-bottom:1px solid var(--exec-border);display:flex;justify-content:space-between;align-items:center;">
        <div>
          <h3 style="margin:0;font-size:1.15rem;color:var(--exec-text);">سجل سدادات العميل: ${escapeHtml(partnerName)}</h3>
          <span style="font-size:0.8rem;color:var(--exec-text-muted);">عرض تفصيلي لسطور التسوية والفواتير المسددة</span>
        </div>
        <button id="btn-close-col-modal" style="background:none;border:none;color:var(--exec-text-muted);font-size:1.3rem;cursor:pointer;">✕</button>
      </div>
      <div id="col-modal-body" style="padding:20px 24px;overflow-y:auto;flex:1;">
        <div style="text-align:center;padding:40px;color:var(--exec-text-muted);">⏳ جاري جلب سطور السداد...</div>
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
      modalBody.innerHTML = `<div style="text-align:center;padding:40px;color:var(--exec-text-muted);">لا توجد سطور سداد مسجلة لهذا العميل في الفترة المحددة</div>`;
      return;
    }

    modalBody.innerHTML = `
      <div style="width:100%;max-width:100%;overflow-x:auto;box-sizing:border-box;" data-scroll-x="true">
        <table class="bi-table" style="width:100%;border-collapse:collapse;font-size:0.86rem;">
          <thead>
            <tr style="background:var(--exec-bg-card);border-bottom:2px solid var(--exec-border);">
              <th style="padding:8px 10px;text-align:right;color:var(--exec-text);">القناة</th>
              <th style="padding:8px 10px;text-align:right;color:var(--exec-text);">تاريخ السداد</th>
              <th style="padding:8px 10px;text-align:right;color:var(--exec-text);">الشركة</th>
              <th style="padding:8px 10px;text-align:right;color:var(--exec-text);">رقم الفاتورة</th>
              <th style="padding:8px 10px;text-align:right;color:var(--exec-text);">تاريخ الفاتورة</th>
              <th style="padding:8px 10px;text-align:right;color:var(--exec-text);">قيد السداد</th>
              <th style="padding:8px 10px;text-align:right;color:var(--exec-text);">البيان</th>
              <th style="padding:8px 10px;text-align:right;color:var(--exec-text);">الحساب المقابل</th>
              <th style="padding:8px 10px;text-align:left;color:var(--exec-text);">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            ${payments.map(p => `
              <tr style="border-bottom:1px solid var(--exec-border);">
                <td style="padding:8px 10px;">
                  <span style="font-size:0.75rem;padding:2px 6px;border-radius:4px;background:${p.channel === 'bank' ? 'var(--col-bank-bg)' : (p.channel === 'sister_company' ? 'var(--col-sister-bg)' : 'var(--col-other-bg)')};color:${p.channel === 'bank' ? 'var(--col-bank)' : (p.channel === 'sister_company' ? 'var(--col-sister)' : 'var(--col-other)')};">
                    ${escapeHtml(p.channel_label)}
                  </span>
                </td>
                <td style="padding:8px 10px;font-family:var(--font-en);color:var(--exec-text);">${escapeHtml(p.payment_date)}</td>
                <td style="padding:8px 10px;color:var(--exec-text-muted);">${escapeHtml(p.company_name)}</td>
                <td style="padding:8px 10px;font-family:var(--font-en);color:var(--col-bank);">${escapeHtml(p.invoice_name)}</td>
                <td style="padding:8px 10px;font-family:var(--font-en);color:var(--exec-text-muted);">${escapeHtml(p.invoice_date)}</td>
                <td style="padding:8px 10px;font-family:var(--font-en);color:var(--exec-text);">${escapeHtml(p.payment_move_name)}</td>
                <td style="padding:8px 10px;font-size:0.8rem;color:var(--exec-text-muted);">${escapeHtml(p.payment_label || '—')}</td>
                <td style="padding:8px 10px;font-size:0.8rem;color:var(--exec-text);">${p.sister_company_name ? `🏢 ${escapeHtml(p.sister_company_name)}<br>` : ''}${escapeHtml(p.counterpart_account_name || '')}</td>
                <td style="padding:8px 10px;text-align:left;font-family:var(--font-en);font-weight:700;color:var(--col-total);">${fmtVal(p.amount, false)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    modal.querySelector('#col-modal-body').innerHTML = `<div style="color:var(--col-refund);text-align:center;padding:30px;">خطأ أثناء جلب التفاصيل: ${escapeHtml(err.message)}</div>`;
  }
}

async function exportCollectionsToExcel(data, periodParams, selectedCos, globalFilters) {
  if (typeof XLSX === 'undefined') {
    throw new Error('مكتبة XLSX غير محملة');
  }

  const wb = XLSX.utils.book_new();

  // ── Sheet 1: ملخص التحصيل الهرمي
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

  // ── Sheet 2: سجل السدادات التفصيلي
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
