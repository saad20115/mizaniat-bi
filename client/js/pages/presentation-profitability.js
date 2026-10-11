import { api } from '../api.js';
import { store } from '../store.js';
import { formatNumber, formatCurrency } from '../utils/format.js';
import { createTreeTable } from '../components/tree-table.js';

/**
 * Stage D2: Departments & Profitability (الأقسام والربحية)
 * 4-level TreeTable: Company -> Department -> Cost Center -> Account
 * Measures: net (default) | revenue | expense
 * Time Grains: quarter (default) | year | month
 * Toggle: Administrative Expense Redistribution (توزيع المصروفات الإدارية)
 */

let currentData = null;
let currentTreeTable = null;
let currentMeasure = 'net';
let currentTimeGrain = 'quarter';
let currentRedistribute = false;
let currentSearchQuery = '';
let currentTimeFilter = null;
let currentGlobalFilters = { groupIds: [], journalIds: [] };

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

function fmtMargin(margin) {
  if (margin === null || margin === undefined || isNaN(margin)) return '—';
  const m = Number(margin);
  if (m < 0) {
    return `
      <span class="exec-rate-neg" style="display:inline-block;padding:2px 8px;border-radius:6px;background:rgba(239,68,68,0.12);color:#ef4444;font-weight:700;font-size:0.82rem;direction:ltr;font-family:var(--font-en);">
        (${Math.abs(m).toFixed(1)}%)
      </span>
    `;
  }
  const color = m >= 20 ? '#10b981' : (m > 0 ? '#3b82f6' : 'var(--exec-text-muted, #94a3b8)');
  const bg = m >= 20 ? 'rgba(16,185,129,0.12)' : (m > 0 ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.05)');
  return `
    <span class="exec-num" style="display:inline-block;padding:2px 8px;border-radius:6px;background:${bg};color:${color};font-weight:700;font-size:0.82rem;font-family:var(--font-en);">
      ${m.toFixed(1)}%
    </span>
  `;
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

const ICONS = {
  expandAll: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg>',
  collapseAll: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/></svg>',
  excel: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  spinner: '<svg class="spin-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>'
};

export async function renderDepartmentsProfitabilityTab(body, container, timeFilter, selectedCos, globalFilters) {
  if (globalFilters) {
    currentGlobalFilters = globalFilters;
  }
  body.innerHTML = `
    <div style="direction:rtl;display:flex;flex-direction:column;gap:20px;padding:4px 0;width:100%;max-width:100%;min-width:0;box-sizing:border-box;">
      <!-- Loading Placeholder -->
      <div id="prof-loading" style="text-align:center;padding:80px 20px;color:var(--text-muted);font-size:1.05rem;">
        <span style="display:inline-block;vertical-align:middle;margin-left:8px;">${ICONS.spinner}</span>
        جاري تحميل تقرير الأقسام والربحية...
      </div>
      <div id="prof-main-content" style="display:none;flex-direction:column;gap:22px;width:100%;max-width:100%;min-width:0;box-sizing:border-box;"></div>
    </div>
  `;

  await loadAndRender(body, container, timeFilter, selectedCos);
}

async function loadAndRender(body, container, timeFilter, selectedCos) {
  const periodParams = getPeriodParamsFromFilter(timeFilter);
  const companyIdsParam = (selectedCos && selectedCos.length > 0) ? selectedCos.join(',') : undefined;

  const loadingEl = body.querySelector('#prof-loading');
  const contentEl = body.querySelector('#prof-main-content');
  if (loadingEl) loadingEl.style.display = 'block';
  if (contentEl) contentEl.style.display = 'none';

  try {
    const params = {
      companyIds: companyIdsParam,
      years: periodParams.years,
      dateFrom: periodParams.dateFrom,
      dateTo: periodParams.dateTo,
      measure: currentMeasure,
      timeGrain: currentTimeGrain,
      redistributeAdmin: currentRedistribute
    };
    if (currentGlobalFilters?.groupIds?.length) params.departmentIds = currentGlobalFilters.groupIds.join(',');
    if (currentGlobalFilters?.journalIds?.length) params.journalIds = currentGlobalFilters.journalIds.join(',');

    const data = await api.getDepartmentsProfitability(params);

    currentData = data;
    currentTimeFilter = timeFilter;
    if (loadingEl) loadingEl.style.display = 'none';
    if (contentEl) {
      contentEl.style.display = 'flex';
      renderContent(contentEl, body, container, timeFilter, selectedCos, data);
    }
  } catch (err) {
    console.error('[Profitability] Failed to load data:', err);
    if (loadingEl) {
      loadingEl.innerHTML = `
        <div style="color:var(--status-negative);font-size:1.05rem;">
          حدث خطأ أثناء تحميل بيانات الأقسام والربحية: ${escapeHtml(err.message || 'خطأ غير متوقع')}
        </div>
      `;
    }
  }
}

function renderContent(contentEl, body, container, timeFilter, selectedCos, data) {
  const s = data.summary || {};
  const periodParams = getPeriodParamsFromFilter(timeFilter);
  const periodLabel = timeFilter?.periodLabel || periodParams?.years || '2026';
  const measureLabels = {
    net: 'صافي الربح',
    revenue: 'الإيرادات',
    expense: 'المصروفات'
  };

  contentEl.innerHTML = `
    <!-- Tab Header -->
    <div class="exec-header" style="display:flex;flex-direction:column;gap:4px;margin-bottom:16px;">
      <h1 class="exec-title" style="margin:0;font-size:22px;line-height:32px;font-weight:700;color:var(--text-primary);">
        الربحية — <span>${escapeHtml(periodLabel)}</span>
      </h1>
      <p class="exec-subtitle" style="margin:0;font-size:12px;line-height:18px;color:var(--text-muted);">
        تحليل الإيرادات والمصروفات وصافي الربح حسب الشركات والمجموعات ومراكز التكلفة
      </p>
    </div>

    <!-- KPI Summary Cards (5 cards) -->
    <div class="prof-kpi-grid exec-kpi-grid" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:16px;">
      
      <!-- Card 1: Revenue -->
      <div class="bi-kpi bi-kpi-card exec-kpi-card">
        <span class="bi-kpi-label">إجمالي الإيرادات</span>
        <div class="bi-kpi-value">${(s.total_revenue || 0).toLocaleString('en-US')}</div>
        <span class="bi-kpi-sub">عن الفترة المحددة</span>
      </div>

      <!-- Card 2: Expenses -->
      <div class="bi-kpi bi-kpi-card exec-kpi-card">
        <span class="bi-kpi-label">إجمالي المصروفات</span>
        <div class="bi-kpi-value">${(s.total_expenses || 0).toLocaleString('en-US')}</div>
        <span class="bi-kpi-sub">${currentRedistribute ? 'تشمل المصروفات الإدارية الموزعة' : 'المصروفات الفعلية المباشرة'}</span>
      </div>

      <!-- Card 3: Net Profit (HERO Card) -->
      <div class="bi-kpi bi-kpi-card hero exec-kpi-card">
        <span class="bi-kpi-label">صافي الربح</span>
        <div class="bi-kpi-value">${(s.net_profit || 0) < 0 ? `(${Math.abs(s.net_profit).toLocaleString('en-US')})` : (s.net_profit || 0).toLocaleString('en-US')}</div>
        <span class="bi-kpi-sub">الإيرادات − المصروفات</span>
      </div>

      <!-- Card 4: Profit Margin -->
      <div class="bi-kpi bi-kpi-card exec-kpi-card">
        <span class="bi-kpi-label">هامش الربح</span>
        <div class="bi-kpi-value"><span dir="ltr" class="tabular-nums">${(s.profit_margin || 0).toFixed(1)}%</span></div>
        <span class="bi-kpi-sub">نسبة صافي الربح من الإيرادات</span>
      </div>

      <!-- Card 5: Admin Redistribution -->
      <div class="bi-kpi bi-kpi-card exec-kpi-card">
        <span class="bi-kpi-label">المصروفات الإدارية القابلة للتوزيع</span>
        <div class="bi-kpi-value">${(s.admin_expenses_redistributed || 0).toLocaleString('en-US')}</div>
        <span class="bi-kpi-sub">${currentRedistribute ? 'موزعة تناسبياً على الأقسام' : 'معروضة كمركز مستقل'}</span>
      </div>

    </div>

    <!-- TreeTable Section -->
    <div class="exec-table-card" style="background:var(--bg-surface);border:1px solid var(--border-default);border-radius:14px;display:flex;flex-direction:column;width:100%;box-sizing:border-box;">
      
      <!-- Table Header Bar with Titles and Toolbar -->
      <div class="exec-table-toolbar" style="padding:16px 20px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border-default);flex-wrap:wrap;gap:14px;">
        <div class="exec-table-titles" style="display:flex;flex-direction:column;gap:2px;">
          <h3 class="exec-table-title" style="margin:0;font-size:17px;line-height:26px;font-weight:700;color:var(--text-primary);">
            الربحية حسب الشركة والمجموعة — ${escapeHtml(periodLabel)}
          </h3>
          <span class="exec-table-breadcrumb" style="font-size:12px;line-height:18px;color:var(--text-muted);">
            الشركة ← المجموعة ← مركز التكلفة ← الحساب
          </span>
        </div>

        <!-- Controls Bar -->
        <div class="exec-table-actions" style="display:flex;align-items:center;flex-wrap:wrap;gap:10px;">
          <!-- Measure Selector -->
          <div style="display:inline-flex;align-items:center;gap:6px;">
            <span style="font-size:12px;color:var(--text-muted);font-weight:600;">المقياس:</span>
            <div class="bi-btn-group" style="display:inline-flex;background:var(--bg-subtle);padding:3px;border-radius:10px;border:1px solid var(--border-default);">
              <button type="button" class="prof-measure-btn bi-btn-item ${currentMeasure === 'net' ? 'active' : ''}" data-measure="net"
                style="border:none;border-radius:8px;padding:5px 12px;font-size:12px;line-height:18px;font-weight:${currentMeasure === 'net' ? '600' : '500'};cursor:pointer;transition:all 0.15s;${currentMeasure === 'net' ? 'background:var(--brand-primary);color:var(--text-on-brand);' : 'background:transparent;color:var(--text-secondary);'}">
                صافي الربح
              </button>
              <button type="button" class="prof-measure-btn bi-btn-item ${currentMeasure === 'revenue' ? 'active' : ''}" data-measure="revenue"
                style="border:none;border-radius:8px;padding:5px 12px;font-size:12px;line-height:18px;font-weight:${currentMeasure === 'revenue' ? '600' : '500'};cursor:pointer;transition:all 0.15s;${currentMeasure === 'revenue' ? 'background:var(--brand-primary);color:var(--text-on-brand);' : 'background:transparent;color:var(--text-secondary);'}">
                الإيرادات
              </button>
              <button type="button" class="prof-measure-btn bi-btn-item ${currentMeasure === 'expense' ? 'active' : ''}" data-measure="expense"
                style="border:none;border-radius:8px;padding:5px 12px;font-size:12px;line-height:18px;font-weight:${currentMeasure === 'expense' ? '600' : '500'};cursor:pointer;transition:all 0.15s;${currentMeasure === 'expense' ? 'background:var(--brand-primary);color:var(--text-on-brand);' : 'background:transparent;color:var(--text-secondary);'}">
                المصروفات
              </button>
            </div>
          </div>

          <!-- Grain Selector -->
          <div style="display:inline-flex;align-items:center;gap:6px;">
            <span style="font-size:12px;color:var(--text-muted);font-weight:600;">التدرج:</span>
            <div class="bi-btn-group" style="display:inline-flex;background:var(--bg-subtle);padding:3px;border-radius:10px;border:1px solid var(--border-default);">
              <button type="button" class="prof-grain-btn bi-btn-item ${currentTimeGrain === 'year' ? 'active' : ''}" data-grain="year"
                style="border:none;border-radius:8px;padding:5px 12px;font-size:12px;line-height:18px;font-weight:${currentTimeGrain === 'year' ? '600' : '500'};cursor:pointer;transition:all 0.15s;${currentTimeGrain === 'year' ? 'background:var(--brand-primary);color:var(--text-on-brand);' : 'background:transparent;color:var(--text-secondary);'}">
                سنوي
              </button>
              <button type="button" class="prof-grain-btn bi-btn-item ${currentTimeGrain === 'quarter' ? 'active' : ''}" data-grain="quarter"
                style="border:none;border-radius:8px;padding:5px 12px;font-size:12px;line-height:18px;font-weight:${currentTimeGrain === 'quarter' ? '600' : '500'};cursor:pointer;transition:all 0.15s;${currentTimeGrain === 'quarter' ? 'background:var(--brand-primary);color:var(--text-on-brand);' : 'background:transparent;color:var(--text-secondary);'}">
                ربع سنوي
              </button>
              <button type="button" class="prof-grain-btn bi-btn-item ${currentTimeGrain === 'month' ? 'active' : ''}" data-grain="month"
                style="border:none;border-radius:8px;padding:5px 12px;font-size:12px;line-height:18px;font-weight:${currentTimeGrain === 'month' ? '600' : '500'};cursor:pointer;transition:all 0.15s;${currentTimeGrain === 'month' ? 'background:var(--brand-primary);color:var(--text-on-brand);' : 'background:transparent;color:var(--text-secondary);'}">
                شهري
              </button>
            </div>
          </div>

          <!-- Administrative Expense Redistribution Switch -->
          <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;background:var(--bg-subtle);border:1px solid ${currentRedistribute ? 'var(--brand-accent)' : 'var(--border-default)'};padding:5px 12px;border-radius:10px;font-size:12px;font-weight:600;color:var(--text-secondary);user-select:none;" title="توزيع مصروفات المراكز الإدارية (مثل الإدارة العامة) تناسبياً على مراكز العمليات">
            <input type="checkbox" id="prof-redist-toggle" ${currentRedistribute ? 'checked' : ''} style="cursor:pointer;accent-color:var(--brand-primary);width:15px;height:15px;">
            <span>توزيع المصروفات الإدارية</span>
          </label>

          <!-- Search Bar -->
          <div class="exec-search-wrap" style="position:relative;display:inline-flex;align-items:center;min-width:180px;">
            <input type="text" id="prof-tree-search" class="exec-search-input" placeholder="بحث…" style="width:180px;padding:6px 12px 6px 30px;background:var(--bg-subtle);border:1px solid var(--border-default);border-radius:8px;color:var(--text-primary);font-size:12px;outline:none;" />
            <button id="btn-prof-clear-search" style="display:none;position:absolute;left:8px;background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:12px;padding:0;">✕</button>
            <span class="exec-search-icon" style="position:absolute;left:8px;pointer-events:none;color:var(--text-muted);display:inline-flex;align-items:center;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </span>
          </div>
          <span id="prof-search-counter" style="display:none;font-size:12px;color:var(--text-muted);font-weight:600;"></span>

          <!-- Expand / Collapse / Export -->
          <button id="prof-btn-expand-all" class="exec-btn-tool" title="توسيع الكل">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg>
            توسيع الكل
          </button>
          <button id="prof-btn-collapse-all" class="exec-btn-tool" title="طي الكل">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/></svg>
            طي الكل
          </button>
          <button id="prof-btn-export-excel" class="exec-btn-tool" title="تصدير Excel">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            تصدير Excel
          </button>
        </div>
      </div>

      <!-- TreeTable Container -->
      <div id="prof-tree-container" class="tree-table-wrap" data-scroll-x="true" style="overflow-x:auto;width:100%;max-width:100%;min-width:0;box-sizing:border-box;"></div>
    </div>
  `;

  // Attach Measure Buttons
  contentEl.querySelectorAll('.prof-measure-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const m = btn.dataset.measure;
      if (m && m !== currentMeasure) {
        currentMeasure = m;
        loadAndRender(body, container, timeFilter, selectedCos);
      }
    });
  });

  // Attach Grain Buttons
  contentEl.querySelectorAll('.prof-grain-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const g = btn.dataset.grain;
      if (g && g !== currentTimeGrain) {
        currentTimeGrain = g;
        loadAndRender(body, container, timeFilter, selectedCos);
      }
    });
  });

  // Attach Redistribution Switch
  const redistToggle = contentEl.querySelector('#prof-redist-toggle');
  redistToggle?.addEventListener('change', (e) => {
    currentRedistribute = e.target.checked;
    loadAndRender(body, container, timeFilter, selectedCos);
  });

  // Init TreeTable
  const treeContainer = contentEl.querySelector('#prof-tree-container');
  if (treeContainer) {
    initProfitabilityTreeTable(treeContainer, data, timeFilter);
  }

  // Search Input
  const searchInput = contentEl.querySelector('#prof-tree-search');
  const profClearBtn = contentEl.querySelector('#btn-prof-clear-search');
  const profCountEl = contentEl.querySelector('#prof-search-counter');
  if (searchInput && currentTreeTable && currentTreeTable.bindSearchInput) {
    currentTreeTable.bindSearchInput(searchInput, {
      clearButton: profClearBtn,
      countElement: profCountEl
    });
  }

  // Expand / Collapse Buttons
  contentEl.querySelector('#prof-btn-expand-all')?.addEventListener('click', () => {
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

  contentEl.querySelector('#prof-btn-collapse-all')?.addEventListener('click', () => {
    if (currentTreeTable) currentTreeTable.collapseAll();
  });

  // Export to Excel Button
  contentEl.querySelector('#prof-btn-export-excel')?.addEventListener('click', () => {
    exportProfitabilityToExcel(data);
  });
}


function annotateHierarchy(nodes, parentTotal, parentName) {
  for (const n of nodes) {
    n._parentTotal = parentTotal;
    n._parentName = parentName;
    const kids = n.departments || n.costCenters || n.accounts || n.children || [];
    if (kids.length > 0) {
      annotateHierarchy(kids, n.total, n.name);
    }
  }
}

function getFilteredPeriodColumns(rawPeriodCols, treeData, totals, isCustomDate) {
  const showZeros = store.get('showZeroItems') ?? false;
  const todayStr = new Date().toISOString().slice(0, 10);

  function isFuturePeriod(key) {
    if (!key) return false;
    const str = String(key);
    const qMatch = str.match(/^(\d{4})-Q([1-4])$/i);
    if (qMatch) {
      const yr = qMatch[1];
      const q = parseInt(qMatch[2], 10);
      const startMonth = String((q - 1) * 3 + 1).padStart(2, '0');
      return `${yr}-${startMonth}-01` > todayStr;
    }
    const mMatch = str.match(/^(\d{4})-(\d{2})$/);
    if (mMatch) {
      return `${str}-01` > todayStr;
    }
    const yMatch = str.match(/^(\d{4})$/);
    if (yMatch) {
      return `${str}-01-01` > todayStr;
    }
    return false;
  }

  const nonFutureCols = rawPeriodCols.filter(c => !isFuturePeriod(c.key));
  if (showZeros) {
    return nonFutureCols;
  }

  function isColAllZero(key) {
    const totVal = totals?.values?.[key] ?? totals?.[key];
    if (totVal !== undefined && Math.abs(Number(totVal) || 0) >= 0.005) {
      return false;
    }
    const checkNodes = (nodes) => {
      for (const n of nodes) {
        const v = n.values?.[key] ?? n.periods?.[key] ?? n[key];
        if (v !== undefined && Math.abs(Number(v) || 0) >= 0.005) {
          return false;
        }
        const kids = n.departments || n.costCenters || n.accounts || n.children;
        if (kids && !checkNodes(kids)) return false;
      }
      return true;
    };
    return checkNodes(treeData);
  }

  const colZeroStatus = nonFutureCols.map(c => isColAllZero(c.key));

  let firstNonZero = -1;
  let lastNonZero = -1;
  for (let i = 0; i < colZeroStatus.length; i++) {
    if (!colZeroStatus[i]) {
      if (firstNonZero === -1) firstNonZero = i;
      lastNonZero = i;
    }
  }

  if (firstNonZero === -1) {
    return nonFutureCols.slice(-1);
  }

  return nonFutureCols.filter((col, idx) => {
    const isZero = colZeroStatus[idx];
    if (!isZero) return true;
    if (isCustomDate && idx > firstNonZero && idx < lastNonZero) {
      return true;
    }
    return false;
  });
}

function initProfitabilityTreeTable(container, data, timeFilter) {
  const isCustom = !!timeFilter?.isCustomDate;
  const treeData = data.tree || [];
  const totals = data.totals || {};
  const periodCols = getFilteredPeriodColumns(data.columns || [], treeData, totals, isCustom);

  // Annotate hierarchy with parent totals for relative contribution scaling
  annotateHierarchy(treeData, totals.total || 0, 'المجموعة');

  const columns = [
    { id: 'name', label: 'البيان / الهيكل الهرمي', minWidth: '150px', align: 'right', priority: 1 },
    ...periodCols.map((col, idx) => ({
      id: col.key,
      label: col.label,
      align: 'left',
      width: '80px',
      minWidth: '70px',
      priority: (periodCols.length > 2 && idx < periodCols.length - 2) ? 2 : 1
    })),
    { id: 'total', label: 'الإجمالي', align: 'left', width: '90px', minWidth: '80px', priority: 1 }
  ];

  if (currentMeasure === 'net') {
    columns.push({ id: 'margin', label: 'هامش الربح', align: 'center', width: '70px', minWidth: '60px', priority: 2 });
  }

  // R2-9: Contribution (المساهمة)
  columns.push({
    id: 'contribution',
    label: 'المساهمة',
    title: 'حصة الصف من إجمالي مستواه (الشركات من الإجمالي، والأبناء من أبيهم المباشر)',
    align: 'center',
    flex: true,
    minWidth: '120px',
    priority: 1
  });

  currentTreeTable = createTreeTable(container, {
    storageKey: 'mizaniat_prof_tree_expanded',
    columns,
    data: treeData,
    totals,
    showZeroItems: store.get('showZeroItems') ?? false,
    getNodeKey: (node, parentPath, depth) => {
      const type = node.type || (depth === 0 ? 'co' : depth === 1 ? 'dept' : depth === 2 ? 'cc' : 'account');
      const id = node.id !== undefined ? String(node.id) : (node.code || node.name || 'item');
      return parentPath ? `${parentPath}/${type}:${id}` : `${type}:${id}`;
    },
    getChildren: (node) => {
      return node.departments || node.costCenters || node.accounts || node.children || [];
    },
    hasChildren: (node) => {
      if (node.departments && node.departments.length > 0) return true;
      if (node.costCenters && node.costCenters.length > 0) return true;
      if (node.accounts && node.accounts.length > 0) return true;
      return false;
    },
    renderRow: ({ node, pathKey, depth, isExpanded, hasKids, isLeaf }) => {
      const isCo = depth === 0 || node.type === 'co';
      const isDept = depth === 1 || node.type === 'dept';
      const isCC = depth === 2 || node.type === 'cc';
      const isAcc = depth === 3 || node.type === 'account';

      const indent = depth * 22;
      const chevronDown = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
      const chevronLeft = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>';
      const icon = hasKids ? (isExpanded ? chevronDown : chevronLeft) : '•';

      let companyDot = '';
      if (isCo) {
        const cid = node.company_id != null ? node.company_id : Number(String(node.id || '').replace(/^co_?/, ''));
        companyDot = `<span class="company-dot" style="background:var(--company-${cid || 1});flex-shrink:0;margin:0 2px;"></span>`;
      }

      const rowBg = isCo
        ? 'background:var(--bg-subtle);font-weight:700;'
        : (isDept ? 'background:transparent;font-weight:600;' : '');

      const cursor = hasKids ? 'cursor:pointer;' : '';

      // R2-9: 1. Contribution calculation (relative to direct parent)
      const parentTot = node._parentTotal !== undefined ? node._parentTotal : (totals.total || 0);
      const nodeTot = node.total !== undefined ? node.total : 0;
      let contribHtml = '<span style="color:var(--text-muted);">—</span>';
      if (parentTot > 0 && nodeTot !== undefined) {
        const pct = (nodeTot / parentTot) * 100;
        const isNeg = pct < 0;
        const absPct = Math.abs(pct);
        const barW = Math.min(100, Math.round(absPct));
        const pctStr = isNeg ? `-${absPct.toFixed(1)}%` : `${absPct.toFixed(1)}%`;
        const barColor = isNeg ? 'var(--status-negative)' : 'var(--status-positive)';
        const textColor = isNeg ? 'var(--status-negative)' : 'var(--status-positive)';
        const tip = `حصة من إجمالي ${escapeHtml(node._parentName || 'الأب')}: ${Math.round(nodeTot).toLocaleString('en-US')} من أصل ${Math.round(parentTot).toLocaleString('en-US')}`;
        contribHtml = `
          <div class="prof-contrib-cell" title="${escapeHtml(tip)}">
            <div class="prof-contrib-track">
              <div class="prof-contrib-bar" style="width:${barW}%;background:${barColor};"></div>
            </div>
            <span class="prof-contrib-pct" style="color:${textColor};">${pctStr}</span>
          </div>
        `;
      }

      return `
        <tr data-tree-row="true" data-path-key="${escapeHtml(pathKey)}" style="${cursor} ${rowBg}">
          <td class="tree-col-name" data-col-id="name" data-priority="1" style="padding-right:${indent + 14}px;">
            <div class="tree-name-cell" style="display:inline-flex;align-items:center;gap:6px;max-width:100%;vertical-align:middle;">
              <span data-tree-toggle="true" style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;color:var(--text-muted);flex-shrink:0;">${icon}</span>
              ${companyDot}
              <span class="tree-node-name" data-tree-name="true" title="${escapeHtml(node.name || '')}" style="vertical-align:middle;white-space:normal;word-break:break-word;">${escapeHtml(node.name || '')}</span>
              ${node.is_redistributable ? '<span style="font-size:11px;padding:2px 6px;border-radius:4px;background:var(--status-warning-subtle);color:var(--status-warning);margin-right:6px;">إداري</span>' : ''}
              ${isAcc && node.code ? `<span style="font-size:11px;color:var(--text-muted);margin-right:4px;">(${escapeHtml(node.code)})</span>` : ''}
            </div>
          </td>
          ${periodCols.map((col, idx) => {
            const val = node.values?.[col.key] || 0;
            const prio = (periodCols.length > 2 && idx < periodCols.length - 2) ? 2 : 1;
            return `<td class="tree-col-num" data-col-id="${col.key}" data-priority="${prio}" style="text-align:left;">${fmtVal(val)}</td>`;
          }).join('')}
          <td class="tree-col-num" data-col-id="total" data-priority="1" style="text-align:left;font-weight:700;">${fmtVal(node.total)}</td>
          ${currentMeasure === 'net' ? `
            <td class="tree-col-num" data-col-id="margin" data-priority="2" style="text-align:center;">
              ${node.margin !== undefined ? fmtMargin(node.margin) : '—'}
            </td>
          ` : ''}
          <td class="tree-col-num" data-col-id="contribution" data-priority="1" style="text-align:center;padding:6px 10px;">
            ${contribHtml}
          </td>
        </tr>
      `;
    },
    renderTotals: (totals) => {
      const vals = totals.values || {};
      const grandRev = totals.revenue || 0;
      const grandNet = totals.net || 0;
      const overallMargin = grandRev > 0 ? (grandNet / grandRev * 100) : 0;

      return `
        <tr style="background:rgba(59,130,246,0.12);font-weight:900;border-top:2px solid rgba(59,130,246,0.3);font-size:0.98rem;">
          <td class="tree-col-name" data-col-id="name" data-priority="1" style="padding:14px 18px;">المجموع الكلي للمجموعة</td>
          ${periodCols.map((col, idx) => {
            const v = vals[col.key] || 0;
            const prio = (periodCols.length > 2 && idx < periodCols.length - 2) ? 2 : 1;
            return `<td class="tree-col-num" data-col-id="${col.key}" data-priority="${prio}" style="text-align:left;padding:14px 18px;">${fmtVal(v)}</td>`;
          }).join('')}
          <td class="tree-col-num" data-col-id="total" data-priority="1" style="text-align:left;padding:14px 18px;">${fmtVal(totals.total)}</td>
          ${currentMeasure === 'net' ? `
            <td class="tree-col-num" data-col-id="margin" data-priority="2" style="text-align:center;padding:14px 18px;">
              ${fmtMargin(overallMargin)}
            </td>
          ` : ''}
          <td class="tree-col-num" data-col-id="contribution" data-priority="1" style="text-align:center;padding:14px 18px;font-weight:800;color:var(--exec-accent, #60a5fa);">
            100.0%
          </td>
        </tr>
      `;
    }
  });
}


function exportProfitabilityToExcel(data) {
  if (!data) return;
  const showZeros = store.get('showZeroItems') ?? false;
  const isCustom = !!currentTimeFilter?.isCustomDate;
  const cols = getFilteredPeriodColumns(data.columns || [], data.tree || [], data.totals || {}, isCustom);
  const headers = ['المستوى', 'الاسم', 'الكود', ...cols.map(c => c.label), 'الإجمالي'];
  if (currentMeasure === 'net') headers.push('هامش الربح %');
  headers.push('نسبة المساهمة %');

  function isSubtreeZero(node) {
    let selfZero = true;
    for (const c of cols) {
      const v = node.values?.[c.key] ?? node.periods?.[c.key] ?? node[c.key] ?? 0;
      if (Math.abs(Number(v) || 0) >= 0.01) {
        selfZero = false;
        break;
      }
    }
    if (Math.abs(Number(node.total) || 0) >= 0.01) selfZero = false;
    if (!selfZero) return false;
    const kids = node.departments || node.costCenters || node.accounts || [];
    if (kids.length > 0) {
      return kids.every(k => isSubtreeZero(k));
    }
    return true;
  }

  const rows = [];

  const traverse = (node, levelName, parentTotal) => {
    if (!showZeros && isSubtreeZero(node)) return;

    const parentTot = parentTotal !== undefined ? parentTotal : (data.totals?.total || 0);
    const contribPct = (parentTot > 0 && node.total !== undefined)
      ? `${((node.total / parentTot) * 100).toFixed(1)}%`
      : '—';

    const row = [
      levelName,
      `"${(node.name || '').replace(/"/g, '""')}"`,
      `"${node.code || ''}"`,
      ...cols.map(c => node.values?.[c.key] ?? node.periods?.[c.key] ?? node[c.key] ?? 0),
      node.total || 0
    ];
    if (currentMeasure === 'net') row.push(node.margin !== undefined ? `${node.margin}%` : '');
    row.push(`"${contribPct}"`);
    rows.push(row.join(','));

    const kids = node.departments || node.costCenters || node.accounts || [];
    const nextLevel = levelName === 'شركة' ? 'قسم' : (levelName === 'قسم' ? 'مركز تكلفة' : 'حساب');
    for (const k of kids) traverse(k, nextLevel, node.total);
  };

  for (const co of (data.tree || [])) traverse(co, 'شركة', data.totals?.total);

  // Totals row
  const totVals = data.totals?.values || {};

  const totRow = [
    'المجموع الكلي',
    'إجمالي المجموعة',
    '',
    ...cols.map(c => totVals[c.key] ?? data.totals?.[c.key] ?? 0),
    data.totals?.total || 0
  ];
  if (currentMeasure === 'net') {
    const rev = data.totals?.revenue || 0;
    const net = data.totals?.net || 0;
    totRow.push(rev > 0 ? `${(net / rev * 100).toFixed(1)}%` : '0%');
  }
  totRow.push('"100.0%"');
  rows.push(totRow.join(','));

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `ربحية_الأقسام_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

