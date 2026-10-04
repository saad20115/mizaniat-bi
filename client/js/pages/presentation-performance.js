import { api } from '../api.js';
import { formatNumber } from '../utils/format.js';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// Page-level persistent state
let currentTimeFilter = null;
let currentSelectedCos = [];
let selectedYear = String(new Date().getFullYear());
let perfMeasure = 'net'; // 'net' | 'revenue' | 'expense'
let isAgingOpen = false;
let isLightMode = false;
let selectedDrawerInvoice = null;

// Track expanded row IDs for each table (Set of string IDs)
const perfExpandedRows = new Set(['group_perf']);
const revColExpandedRows = new Set(['group_rev']);
const agingExpandedRows = new Set(['group_aging']);

// Track in-place expanded column keys for Financial Performance
// e.g. '2026-Q1', '2026-01', '2026-W01', etc.
const perfExpandedCols = new Set();

// Cache for granular time data
let matrixDataCache = {};
let revColData = null;
let agingData = null;
let summaryData = null;

const ARABIC_MONTHS = {
  '01': 'يناير', '02': 'فبراير', '03': 'مارس', '04': 'أبريل',
  '05': 'مايو', '06': 'يونيو', '07': 'يوليو', '08': 'أغسطس',
  '09': 'سبتمبر', '10': 'أكتوبر', '11': 'نوفمبر', '12': 'ديسمبر'
};

const QUARTER_NAMES = {
  'Q1': 'الربع 1', 'Q2': 'الربع 2', 'Q3': 'الربع 3', 'Q4': 'الربع 4'
};

/**
 * Format integer numbers with thousand separators.
 * Negative numbers wrapped in parentheses (1,234) and styled red.
 */
function fmtVal(num, showZeroDash = true) {
  if (num === null || num === undefined || isNaN(num)) return showZeroDash ? '—' : '0';
  const rounded = Math.round(Number(num));
  if (rounded === 0 && showZeroDash) return '—';
  if (rounded < 0) {
    return `<span class="perf-num-neg">(${Math.abs(rounded).toLocaleString('en-US')})</span>`;
  }
  return `<span class="perf-num">${rounded.toLocaleString('en-US')}</span>`;
}

function fmtRate(num) {
  if (num === null || num === undefined || isNaN(num) || num === 0) return '0%';
  const rounded = Math.round(num);
  return `${rounded}%`;
}

/**
 * Main export function called by presentation.js
 */
export async function renderPerformanceReceivablesTab(body, container, timeFilter, selectedCos) {
  // Extract active companies from topbar if not provided
  if (!selectedCos || !selectedCos.length) {
    selectedCos = [...container.querySelectorAll('.co-chip.active')].map(c => Number(c.dataset.id));
  }
  
  if (!timeFilter) {
    const yrChip = container.querySelector('.yr-chip.active');
    const yr = yrChip ? yrChip.dataset.year : '2026';
    timeFilter = {
      isCustomDate: false,
      selectedYear: yr,
      dateFrom: `${yr}-01-01`,
      dateTo: `${yr}-12-31`,
      periodLabel: yr
    };
  }

  currentTimeFilter = timeFilter;
  selectedYear = timeFilter?.selectedYear || '2026';
  currentSelectedCos = selectedCos;

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('theme')) isLightMode = urlParams.get('theme') === 'light';
  if (urlParams.has('expandCol')) perfExpandedCols.add(urlParams.get('expandCol'));

  body.innerHTML = `
    <div id="perf-root" class="${isLightMode ? 'perf-light' : 'perf-dark'}" style="direction:rtl;display:flex;flex-direction:column;gap:20px;font-family:var(--font-ar);transition:background 0.2s,color 0.2s;">
      
      <!-- Top Controls Bar: Effective Period Badge + Theme Toggle & Single Export Button -->
      <div class="perf-topbar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;padding:12px 18px;border-radius:14px;border:1px solid var(--perf-border);background:var(--perf-bg-card);">
        
        <!-- Effective Period Indicator -->
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:0.92rem;font-weight:700;color:var(--perf-text-muted);">📅 الفترة الفعّالة:</span>
          <span style="font-size:1.02rem;font-weight:800;color:#3b82f6;background:rgba(59,130,246,0.12);padding:4px 14px;border-radius:8px;border:1px solid rgba(59,130,246,0.25);">${timeFilter.periodLabel}</span>
        </div>

        <!-- Controls: Theme Toggle & Single Export Button -->
        <div style="display:flex;align-items:center;gap:10px;">
          <!-- Theme Toggle -->
          <button id="perf-btn-theme" class="perf-ctrl-btn" title="تبديل الوضع الفاتح والداكن">
            ${isLightMode ? '🌙 وضع داكن' : '☀️ وضع فاتح'}
          </button>

          <!-- Single Export Button with Dropdown -->
          <div style="position:relative;display:inline-block;" id="perf-export-dropdown-container">
            <button id="perf-btn-export" class="perf-ctrl-btn perf-btn-export">
              📥 تصدير ▾
            </button>
            <div id="perf-export-menu" style="display:none;position:absolute;left:0;top:100%;margin-top:6px;min-width:180px;background:var(--perf-bg-card);border:1px solid var(--perf-border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.35);z-index:100;overflow:hidden;">
              <button class="perf-export-opt" data-type="excel" style="width:100%;padding:10px 16px;text-align:right;background:none;border:none;color:var(--perf-text);font-size:0.9rem;cursor:pointer;display:flex;align-items:center;gap:8px;">
                📊 تصدير Excel (CSV)
              </button>
              <button class="perf-export-opt" data-type="pdf" style="width:100%;padding:10px 16px;text-align:right;background:none;border:none;color:var(--perf-text);font-size:0.9rem;cursor:pointer;display:flex;align-items:center;gap:8px;border-top:1px solid var(--perf-border);">
                📄 تصدير تقرير PDF (أفقي)
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Content Container -->
      <div id="perf-content" style="min-height:500px;display:flex;flex-direction:column;gap:24px;">
        <div style="text-align:center;padding:80px;color:var(--perf-text-muted);font-size:1.15rem;">
          <span style="display:inline-block;animation:spin 1s linear infinite;">⏳</span> جاري تحميل تقرير الأداء والتحصيل...
        </div>
      </div>

      <!-- Side Drawer for Invoice Details -->
      <div id="perf-drawer-backdrop" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);z-index:9998;transition:opacity 0.25s;"></div>
      <div id="perf-drawer" style="position:fixed;top:0;left:0;bottom:0;width:440px;max-width:92vw;background:var(--perf-bg-drawer);border-right:1px solid var(--perf-border);box-shadow:8px 0 32px rgba(0,0,0,0.5);z-index:9999;transform:translateX(-100%);transition:transform 0.3s cubic-bezier(0.16,1,0.3,1);display:flex;flex-direction:column;direction:rtl;">
        <div id="perf-drawer-content" style="flex:1;overflow-y:auto;padding:24px;"></div>
      </div>

    </div>

    <!-- Styles for Performance & Collections Screen -->
    <style>
      .perf-dark {
        --perf-bg: #070b19;
        --perf-bg-card: #0d152c;
        --perf-bg-table: #0b1226;
        --perf-bg-drawer: #0d152c;
        --perf-border: rgba(255,255,255,0.08);
        --perf-border-subtle: rgba(255,255,255,0.04);
        --perf-text: #e2e8f0;
        --perf-text-muted: rgba(255,255,255,0.5);
        --perf-row-lvl0: #131c3b;
        --perf-row-lvl1: #0e1630;
        --perf-row-lvl2: #0b1226;
        --perf-row-lvl3: #080d1d;
        --perf-row-hover: rgba(255,255,255,0.04);
        --perf-header-bg: #111a38;
      }
      .perf-light {
        --perf-bg: #f8fafc;
        --perf-bg-card: #ffffff;
        --perf-bg-table: #ffffff;
        --perf-bg-drawer: #ffffff;
        --perf-border: #e2e8f0;
        --perf-border-subtle: #f1f5f9;
        --perf-text: #0f172a;
        --perf-text-muted: #64748b;
        --perf-row-lvl0: #f1f5f9;
        --perf-row-lvl1: #f8fafc;
        --perf-row-lvl2: #ffffff;
        --perf-row-lvl3: #ffffff;
        --perf-row-hover: #f1f5f9;
        --perf-header-bg: #e2e8f0;
      }

      .perf-yr-tab {
        padding: 6px 14px;
        border-radius: 8px;
        border: 1px solid var(--perf-border);
        background: transparent;
        color: var(--perf-text-muted);
        font-size: 0.9rem;
        font-weight: 700;
        font-family: var(--font-en);
        cursor: pointer;
        transition: all 0.2s;
      }
      .perf-yr-tab:hover {
        background: rgba(59,130,246,0.1);
        color: #3b82f6;
      }
      .perf-yr-tab.active {
        background: #3b82f6;
        color: #ffffff;
        border-color: #3b82f6;
        box-shadow: 0 2px 8px rgba(59,130,246,0.3);
      }

      .perf-ctrl-btn {
        padding: 7px 14px;
        border-radius: 8px;
        border: 1px solid var(--perf-border);
        background: transparent;
        color: var(--perf-text);
        font-size: 0.88rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
      }
      .perf-ctrl-btn:hover {
        background: rgba(255,255,255,0.06);
        border-color: rgba(255,255,255,0.2);
      }
      .perf-btn-export {
        background: rgba(16,185,129,0.12);
        color: #10b981;
        border-color: rgba(16,185,129,0.3);
      }
      .perf-btn-export:hover {
        background: rgba(16,185,129,0.22);
      }
      .perf-export-opt:hover {
        background: rgba(59,130,246,0.15) !important;
        color: #60a5fa !important;
      }

      /* Pill measure selectors */
      .perf-pill {
        padding: 5px 12px;
        border-radius: 6px;
        border: 1px solid var(--perf-border);
        background: transparent;
        color: var(--perf-text-muted);
        font-size: 0.84rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.15s;
      }
      .perf-pill:hover {
        color: var(--perf-text);
        background: rgba(255,255,255,0.05);
      }
      .perf-pill.active {
        background: #3b82f6;
        color: #ffffff;
        border-color: #3b82f6;
      }

      /* Numbers styling */
      .perf-num {
        font-family: var(--font-en);
        font-variant-numeric: tabular-nums;
        font-weight: 600;
      }
      .perf-num-neg {
        font-family: var(--font-en);
        font-variant-numeric: tabular-nums;
        font-weight: 700;
        color: #ef4444;
      }

      /* Table structure */
      .perf-table-wrap {
        overflow-x: auto;
        border-radius: 12px;
        border: 1px solid var(--perf-border);
        background: var(--perf-bg-table);
      }
      .perf-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        font-size: 0.92rem;
      }
      .perf-table th {
        background: var(--perf-header-bg);
        color: var(--perf-text);
        padding: 10px 14px;
        text-align: right;
        font-weight: 700;
        border-bottom: 2px solid var(--perf-border);
        border-left: 1px solid var(--perf-border);
        white-space: nowrap;
        position: sticky;
        top: 0;
        z-index: 10;
      }
      .perf-table th:last-child {
        border-left: none;
      }
      .perf-table th.num-col {
        text-align: left;
      }
      .perf-table td {
        padding: 9px 14px;
        border-bottom: 1px solid var(--perf-border-subtle);
        border-left: 1px solid var(--perf-border-subtle);
        color: var(--perf-text);
        white-space: nowrap;
      }
      .perf-table td:last-child {
        border-left: none;
      }
      .perf-table td.num-cell {
        text-align: left;
      }

      /* Row Hierarchy Styles */
      .perf-row-0 td { background: var(--perf-row-lvl0); font-weight: 800; font-size: 0.98rem; }
      .perf-row-1 td { background: var(--perf-row-lvl1); font-weight: 700; font-size: 0.94rem; }
      .perf-row-2 td { background: var(--perf-row-lvl2); font-weight: 600; font-size: 0.90rem; }
      .perf-row-3 td { background: var(--perf-row-lvl3); font-weight: 400; font-size: 0.88rem; color: var(--perf-text-muted); }
      .perf-row-4 td { background: var(--perf-row-lvl3); font-weight: 400; font-size: 0.85rem; color: var(--perf-text-muted); }

      .perf-row-clickable {
        cursor: pointer;
        user-select: none;
        transition: background 0.12s;
      }
      .perf-row-clickable:hover td {
        filter: brightness(1.08);
      }

      /* Expand indicator arrow */
      .perf-arrow {
        display: inline-block;
        width: 14px;
        font-size: 0.72rem;
        transition: transform 0.2s;
        margin-left: 6px;
        color: var(--perf-text-muted);
      }
      .perf-arrow.open {
        transform: rotate(-90deg);
      }

      /* Column expand button */
      .perf-col-toggle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        border-radius: 4px;
        background: rgba(59,130,246,0.15);
        color: #3b82f6;
        border: 1px solid rgba(59,130,246,0.3);
        font-size: 0.75rem;
        cursor: pointer;
        margin-left: 6px;
        vertical-align: middle;
        font-family: monospace;
      }
      .perf-col-toggle:hover {
        background: #3b82f6;
        color: #fff;
      }

      /* KPI Cards */
      .perf-kpi-card {
        background: var(--perf-bg-card);
        border: 1px solid var(--perf-border);
        border-radius: 14px;
        padding: 18px 20px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      }
      .perf-kpi-title {
        font-size: 0.88rem;
        font-weight: 700;
        color: var(--perf-text-muted);
      }
      .perf-kpi-val {
        font-size: 1.85rem;
        font-weight: 800;
        font-family: var(--font-en);
        font-variant-numeric: tabular-nums;
        letter-spacing: -0.5px;
      }
      .perf-kpi-sub {
        font-size: 0.78rem;
        color: var(--perf-text-muted);
      }
    </style>
  `;

  // Bind topbar events
  const root = body.querySelector('#perf-root');

  // Theme toggle
  body.querySelector('#perf-btn-theme')?.addEventListener('click', () => {
    isLightMode = !isLightMode;
    root.className = isLightMode ? 'perf-light' : 'perf-dark';
    body.querySelector('#perf-btn-theme').innerHTML = isLightMode ? '🌙 وضع داكن' : '☀️ وضع فاتح';
  });

  // Export menu toggle
  const exportBtn = body.querySelector('#perf-btn-export');
  const exportMenu = body.querySelector('#perf-export-menu');
  exportBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    exportMenu.style.display = exportMenu.style.display === 'block' ? 'none' : 'block';
  });
  document.addEventListener('click', () => {
    if (exportMenu) exportMenu.style.display = 'none';
  });

  // Export options click
  body.querySelectorAll('.perf-export-opt').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      exportMenu.style.display = 'none';
      const type = btn.dataset.type;
      if (type === 'excel') exportCurrentViewExcel();
      else if (type === 'pdf') exportCurrentViewPDF();
    });
  });

  // Drawer backdrop click
  const drawerBackdrop = body.querySelector('#perf-drawer-backdrop');
  drawerBackdrop?.addEventListener('click', closeInvoiceDrawer);

  // Load and render report data
  await loadAndRenderAll(body, selectedCos, timeFilter);
}

/**
 * Loads all data concurrently and renders the 4 sections
 */
async function loadAndRenderAll(body, selectedCos, timeFilter) {
  const content = body.querySelector('#perf-content');
  if (!content) return;

  try {
    const isAll = timeFilter.selectedYear === 'ALL';
    const isCustom = timeFilter.isCustomDate;
    let dateFrom = timeFilter.dateFrom;
    let dateTo = timeFilter.dateTo;
    if (!isAll && !isCustom && !dateFrom && !dateTo) {
      dateFrom = `${timeFilter.selectedYear}-01-01`;
      dateTo = `${timeFilter.selectedYear}-12-31`;
    }

    // 0. Fetch Performance Summary (KPIs matching Income Statement & Receivables)
    const summaryParams = {
      companyIds: selectedCos && selectedCos.length > 0 ? selectedCos.join(',') : undefined,
      year: isCustom ? undefined : timeFilter.selectedYear,
      dateFrom,
      dateTo
    };

    // 1. Fetch Financial Performance data
    const baseGrain = isAll ? 'year' : (isCustom ? 'month' : 'quarter');
    const matrixParams = {
      measure: perfMeasure,
      rowDims: ['company', 'department', 'account'],
      timeGrain: baseGrain,
      companyIds: selectedCos && selectedCos.length > 0 ? selectedCos.join(',') : undefined,
      dateFrom,
      dateTo
    };

    // 2. Fetch Revenue & Collection Tree (Includes all invoices for the year)
    const revColParams = {
      type: 'revenue_collection',
      includePaid: 'true',
      companyIds: selectedCos && selectedCos.length > 0 ? selectedCos.join(',') : undefined,
      dateFrom,
      dateTo
    };

    // 3. Fetch Aging Tree (Unpaid invoices with aging buckets)
    const agingParams = {
      type: 'aging',
      companyIds: selectedCos && selectedCos.length > 0 ? selectedCos.join(',') : undefined,
      asOfDate: new Date().toISOString().slice(0, 10)
    };

    // Concurrent fetching
    const [summaryRes, matrixRes, revRes, agRes] = await Promise.all([
      api.getPerformanceSummary(summaryParams),
      api.getMatrix(matrixParams),
      api.getReceivables(revColParams),
      api.getReceivables(agingParams)
    ]);

    summaryData = summaryRes;
    matrixDataCache[baseGrain] = matrixRes;
    revColData = revRes;
    agingData = agRes;

    // Auto expand company and department down to client level if requested
    if (new URLSearchParams(window.location.search).get('expandCo') === 'true') {
      if (revRes.tree && revRes.tree[0]) {
        revColExpandedRows.add(revRes.tree[0].id);
        if (revRes.tree[0].departments && revRes.tree[0].departments[0]) {
          revColExpandedRows.add(revRes.tree[0].departments[0].id);
        }
      }
    }

    // Render the 4 sections
    renderSections(content, summaryRes, matrixRes, revRes, agRes, timeFilter);

  } catch (err) {
    console.error('Error loading performance data:', err);
    content.innerHTML = `
      <div style="text-align:center;padding:60px;color:#ef4444;font-size:1.1rem;">
        ❌ حدث خطأ أثناء تحميل البيانات: ${err.message}
      </div>
    `;
  }
}

/**
 * Main renderer for the 4 sections
 */
function renderSections(content, summaryRes, matrixRes, revRes, agRes, timeFilter) {
  content.innerHTML = `
    <!-- (أ) شريط الملخص: 4 أرقام فقط (Claude H1-fix directive) -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px;">
      
      <div class="perf-kpi-card" style="border-right:4px solid #3b82f6;">
        <span class="perf-kpi-title">💰 الإيرادات</span>
        <span class="perf-kpi-val" style="color:#3b82f6;">${Math.round(summaryRes.revenue || 0).toLocaleString('en-US')}</span>
        <span class="perf-kpi-sub">إيرادات النشاط (بدون ضريبة)</span>
      </div>

      <div class="perf-kpi-card" style="border-right:4px solid #f59e0b;">
        <span class="perf-kpi-title">📤 المصروفات</span>
        <span class="perf-kpi-val" style="color:#f59e0b;">${Math.round(summaryRes.expenses || 0).toLocaleString('en-US')}</span>
        <span class="perf-kpi-sub">إجمالي المصروفات</span>
      </div>

      <div class="perf-kpi-card" style="border-right:4px solid #10b981;">
        <span class="perf-kpi-title">📈 صافي الربح</span>
        <span class="perf-kpi-val" style="color:${(summaryRes.netProfit || 0) >= 0 ? '#10b981' : '#ef4444'};">
          ${(summaryRes.netProfit || 0) < 0 ? `(${Math.abs(Math.round(summaryRes.netProfit)).toLocaleString('en-US')})` : Math.round(summaryRes.netProfit || 0).toLocaleString('en-US')}
        </span>
        <span class="perf-kpi-sub">الفارق بين الإيرادات والمصروفات</span>
      </div>

      <div class="perf-kpi-card" style="border-right:4px solid #ef4444;">
        <span class="perf-kpi-title">⏳ المتبقي على العملاء</span>
        <span class="perf-kpi-val" style="color:#ef4444;">${Math.round(summaryRes.outstanding || 0).toLocaleString('en-US')}</span>
        <span class="perf-kpi-sub" style="color:var(--perf-text);font-weight:600;">حُصّل ${Math.round(summaryRes.collected || 0).toLocaleString('en-US')} من ${Math.round(summaryRes.billed || 0).toLocaleString('en-US')} مفوتراً</span>
        <span style="font-size:0.75rem;color:var(--perf-text-muted);margin-top:2px;">المتبقي كما هو اليوم</span>
      </div>

    </div>

    <!-- (ب) جدول «الأداء المالي» الهرمي -->
    <div class="perf-section-card" style="display:flex;flex-direction:column;gap:14px;background:var(--perf-bg-card);border:1px solid var(--perf-border);border-radius:14px;padding:20px;">
      
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <h3 style="margin:0;font-size:1.15rem;font-weight:800;color:var(--perf-text);">📊 الأداء المالي — ${timeFilter.periodLabel}</h3>
          <span style="font-size:0.82rem;color:var(--perf-text-muted);">(المجموعة ← الشركة ← القسم ← الحساب)</span>
        </div>

        <!-- Measure Selector (Small pill buttons) -->
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:0.85rem;color:var(--perf-text-muted);font-weight:700;">المقياس:</span>
          <button class="perf-pill ${perfMeasure === 'net' ? 'active' : ''}" data-measure="net">📈 صافي الربح</button>
          <button class="perf-pill ${perfMeasure === 'revenue' ? 'active' : ''}" data-measure="revenue">💰 الإيرادات</button>
          <button class="perf-pill ${perfMeasure === 'expense' ? 'active' : ''}" data-measure="expense">📤 المصروفات</button>
        </div>
      </div>

      <!-- Financial Performance Hierarchy Table -->
      <div id="perf-matrix-table-container"></div>
    </div>

    <!-- (ج) جدول «الإيرادات والتحصيل» الهرمي -->
    <div class="perf-section-card" style="display:flex;flex-direction:column;gap:14px;background:var(--perf-bg-card);border:1px solid var(--perf-border);border-radius:14px;padding:20px;">
      
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <h3 style="margin:0;font-size:1.15rem;font-weight:800;color:var(--perf-text);">💼 الإيرادات والتحصيل — ${timeFilter.periodLabel}</h3>
          <span style="font-size:0.82rem;color:var(--perf-text-muted);">(المجموعة ← الشركة ← القسم ← العميل ← الفاتورة)</span>
        </div>
        <div style="font-size:0.85rem;color:var(--perf-text-muted);background:rgba(59,130,246,0.08);padding:4px 10px;border-radius:6px;border:1px solid rgba(59,130,246,0.2);">
          ℹ️ المتبقي كما هو اليوم
        </div>
      </div>

      <!-- Revenue & Collection Hierarchy Table -->
      <div id="perf-revcol-table-container"></div>
    </div>

    <!-- (د) جدول «أعمار الذمم» الهرمي (مطوي افتراضياً) -->
    <div class="perf-section-card" style="background:var(--perf-bg-card);border:1px solid var(--perf-border);border-radius:14px;overflow:hidden;">
      
      <div id="perf-aging-header" style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px;cursor:pointer;user-select:none;background:rgba(255,255,255,0.02);transition:background 0.2s;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:1.1rem;">⏳</span>
          <h3 style="margin:0;font-size:1.05rem;font-weight:800;color:var(--perf-text);">أعمار الذمم المدينة — حتى تاريخ اليوم</h3>
          <span style="font-size:0.82rem;color:var(--perf-text-muted);">(الشرائح السبع لكافة الشركات والذمم غير المسددة)</span>
        </div>

        <button class="perf-ctrl-btn" style="font-size:0.82rem;padding:4px 12px;">
          ${isAgingOpen ? 'إخفاء أعمار الذمم ▴' : 'عرض أعمار الذمم ▾'}
        </button>
      </div>

      <!-- Collapsible Body -->
      <div id="perf-aging-body" style="display:${isAgingOpen ? 'block' : 'none'};padding:20px;border-top:1px solid var(--perf-border);">
        <div id="perf-aging-table-container"></div>
      </div>

    </div>
  `;

  // Bind Measure Switcher
  content.querySelectorAll('.perf-pill').forEach(btn => {
    btn.addEventListener('click', async () => {
      perfMeasure = btn.dataset.measure;
      content.querySelectorAll('.perf-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      // Reload financial performance table
      const matrixTableContainer = content.querySelector('#perf-matrix-table-container');
      if (matrixTableContainer) {
        matrixTableContainer.innerHTML = '<div style="text-align:center;padding:30px;color:var(--perf-text-muted);">⏳ جاري التحديث...</div>';
      }
      const isAll = currentTimeFilter?.selectedYear === 'ALL';
      const isCustom = currentTimeFilter?.isCustomDate;
      let dateFrom = currentTimeFilter?.dateFrom;
      let dateTo = currentTimeFilter?.dateTo;
      if (!isAll && !isCustom && !dateFrom && !dateTo) {
        dateFrom = `${currentTimeFilter?.selectedYear || '2026'}-01-01`;
        dateTo = `${currentTimeFilter?.selectedYear || '2026'}-12-31`;
      }
      const baseGrain = isAll ? 'year' : (isCustom ? 'month' : 'quarter');
      const matrixResNew = await api.getMatrix({
        measure: perfMeasure,
        rowDims: ['company', 'department', 'account'],
        timeGrain: baseGrain,
        companyIds: currentSelectedCos && currentSelectedCos.length > 0 ? currentSelectedCos.join(',') : undefined,
        dateFrom,
        dateTo
      });
      matrixDataCache[baseGrain] = matrixResNew;
      renderFinancialPerformanceTable(content.querySelector('#perf-matrix-table-container'), matrixResNew);
    });
  });

  // Bind Aging Collapsible Toggle
  const agingHeader = content.querySelector('#perf-aging-header');
  const agingBody = content.querySelector('#perf-aging-body');
  agingHeader?.addEventListener('click', () => {
    isAgingOpen = !isAgingOpen;
    agingBody.style.display = isAgingOpen ? 'block' : 'none';
    agingHeader.querySelector('button').textContent = isAgingOpen ? 'إخفاء أعمار الذمم ▴' : 'عرض أعمار الذمم ▾';
    if (isAgingOpen) {
      renderAgingTable(content.querySelector('#perf-aging-table-container'), agRes);
    }
  });

  // Render the 3 tables
  renderFinancialPerformanceTable(content.querySelector('#perf-matrix-table-container'), matrixRes);
  renderRevenueCollectionTable(content.querySelector('#perf-revcol-table-container'), revRes);
  if (isAgingOpen) {
    renderAgingTable(content.querySelector('#perf-aging-table-container'), agRes);
  }
}

/**
 * =========================================================================
 * (ب) جدول «الأداء المالي» الهرمي مع التوسع الزمني في المكان (In-Place Time Expansion)
 * =========================================================================
 */
function renderFinancialPerformanceTable(container, matrixRes) {
  if (!container || !matrixRes || !matrixRes.rows) return;

  const isAll = (currentTimeFilter?.selectedYear || selectedYear) === 'ALL';
  const columns = matrixRes.columns || [];

  // Wrap companies inside a root "المجموعة" node
  const groupNode = {
    id: 'group_perf',
    name: 'المجموعة (كافة الشركات)',
    label: 'المجموعة (كافة الشركات)',
    level: 0,
    total: matrixRes.totals ? matrixRes.totals.grandTotal : 0,
    values: matrixRes.totals ? matrixRes.totals.columns : {},
    children: matrixRes.rows.map(co => ({
      ...co,
      level: 1,
      children: (co.children || []).map(dept => ({
        ...dept,
        level: 2,
        children: (dept.children || []).map(acc => ({
          ...acc,
          level: 3,
          children: []
        }))
      }))
    }))
  };

  // Build visible flat list of rows based on perfExpandedRows
  const visibleRows = [];
  function traverse(node) {
    visibleRows.push(node);
    if (perfExpandedRows.has(node.id) && node.children && node.children.length > 0) {
      // Sort children descending by total
      const sorted = [...node.children].sort((a, b) => (b.total || 0) - (a.total || 0));
      sorted.forEach(traverse);
    }
  }
  traverse(groupNode);

  // Build Table HTML
  container.innerHTML = `
    <div class="perf-table-wrap" data-scroll-x="true">
      <table class="perf-table" id="table-financial-perf">
        <thead>
          <tr>
            <th style="min-width:240px;position:sticky;right:0;z-index:20;background:var(--perf-header-bg);">البيان</th>
            ${columns.map(col => {
              const label = formatColumnHeaderLabel(col.key);
              const isExpanded = perfExpandedCols.has(col.key);
              return `
                <th class="num-col" style="min-width:110px;">
                  <div style="display:flex;align-items:center;justify-content:space-between;gap:4px;">
                    <span>${label}</span>
                    <button class="perf-col-toggle" data-col="${col.key}" title="${isExpanded ? 'طي' : 'توسيع'}">
                      ${isExpanded ? '−' : '+'}
                    </button>
                  </div>
                </th>
              `;
            }).join('')}
            <th class="num-col" style="min-width:120px;font-weight:800;background:var(--perf-header-bg);border-right:2px solid var(--perf-border);">
              ${isAll ? 'الإجمالي العام' : 'إجمالي السنة'}
            </th>
          </tr>
        </thead>
        <tbody>
          ${visibleRows.map(row => {
            const hasChildren = row.children && row.children.length > 0;
            const isOpen = perfExpandedRows.has(row.id);
            const indent = (row.level || 0) * 18 + 12;

            return `
              <tr class="perf-row-${row.level || 0} ${hasChildren ? 'perf-row-clickable' : ''}" data-rowid="${row.id}">
                <td style="padding-right:${indent}px;position:sticky;right:0;z-index:15;background:inherit;">
                  ${hasChildren ? `
                    <span class="perf-arrow ${isOpen ? 'open' : ''}">◂</span>
                  ` : '<span style="display:inline-block;width:14px;margin-left:6px;"></span>'}
                  <span>${escapeHtml(row.label || row.name || 'بدون اسم')}</span>
                </td>

                ${columns.map(col => {
                  const val = row.values ? row.values[col.key] : 0;
                  return `<td class="num-cell">${fmtVal(val)}</td>`;
                }).join('')}

                <td class="num-cell" style="font-weight:800;border-right:2px solid var(--perf-border);">
                  ${fmtVal(row.total)}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Bind row expand/collapse click
  container.querySelectorAll('.perf-row-clickable').forEach(tr => {
    tr.addEventListener('click', () => {
      const rowId = tr.dataset.rowid;
      if (perfExpandedRows.has(rowId)) {
        perfExpandedRows.delete(rowId);
      } else {
        perfExpandedRows.add(rowId);
      }
      renderFinancialPerformanceTable(container, matrixRes);
    });
  });

  // Bind column in-place expansion click
  container.querySelectorAll('.perf-col-toggle').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const colKey = btn.dataset.col;
      await toggleColumnExpansion(container, colKey);
    });
  });
}

function formatColumnHeaderLabel(key) {
  if (!key) return '';
  // Quarter format: 2026-Q1
  if (key.includes('-Q')) {
    const [yr, q] = key.split('-');
    return `${QUARTER_NAMES[q] || q} ${yr}`;
  }
  // Month format: 2026-03
  if (/^\d{4}-\d{2}$/.test(key)) {
    const [yr, mo] = key.split('-');
    return `${ARABIC_MONTHS[mo] || mo} ${yr}`;
  }
  // Week format
  if (key.startsWith('W') || key.length === 10) {
    return key;
  }
  return key;
}

/**
 * In-place column expansion logic
 */
async function toggleColumnExpansion(container, colKey) {
  if (perfExpandedCols.has(colKey)) {
    perfExpandedCols.delete(colKey);
  } else {
    perfExpandedCols.add(colKey);
  }
  
  // If expanding a quarter, fetch month data for that quarter if not cached
  if (colKey.includes('-Q') && !matrixDataCache['month']) {
    const isAll = currentTimeFilter?.selectedYear === 'ALL';
    const isCustom = currentTimeFilter?.isCustomDate;
    let dateFrom = currentTimeFilter?.dateFrom;
    let dateTo = currentTimeFilter?.dateTo;
    if (!isAll && !isCustom && !dateFrom && !dateTo) {
      dateFrom = `${currentTimeFilter?.selectedYear || '2026'}-01-01`;
      dateTo = `${currentTimeFilter?.selectedYear || '2026'}-12-31`;
    }
    const monthRes = await api.getMatrix({
      measure: perfMeasure,
      rowDims: ['company', 'department', 'account'],
      timeGrain: 'month',
      companyIds: currentSelectedCos && currentSelectedCos.length > 0 ? currentSelectedCos.join(',') : undefined,
      dateFrom,
      dateTo
    });
    matrixDataCache['month'] = monthRes;
  }

  // Re-build columns dynamically inserting expanded sub-columns
  const baseGrain = currentTimeFilter?.selectedYear === 'ALL' ? 'year' : (currentTimeFilter?.isCustomDate ? 'month' : 'quarter');
  const baseRes = matrixDataCache[baseGrain];
  if (!baseRes) return;

  const dynamicColumns = [];
  for (const col of baseRes.columns) {
    dynamicColumns.push(col);
    if (perfExpandedCols.has(col.key) && col.key.includes('-Q') && matrixDataCache['month']) {
      // Find months belonging to this quarter
      const [yr, q] = col.key.split('-Q');
      const qNum = parseInt(q);
      const startMo = (qNum - 1) * 3 + 1;
      const endMo = qNum * 3;
      for (let m = startMo; m <= endMo; m++) {
        const mKey = `${yr}-${String(m).padStart(2, '0')}`;
        dynamicColumns.push({ key: mKey, label: mKey, isSubCol: true });
      }
    }
  }

  // Create combined matrix view
  const combinedMatrix = {
    ...baseRes,
    columns: dynamicColumns,
    rows: mergeSubColumnsIntoRows(baseRes.rows, dynamicColumns, matrixDataCache['month'])
  };

  renderFinancialPerformanceTable(container, combinedMatrix);
}

function mergeSubColumnsIntoRows(rows, columns, subData) {
  if (!subData) return rows;
  const subRowMap = new Map();
  function indexSubRows(node) {
    subRowMap.set(node.id, node);
    if (node.children) node.children.forEach(indexSubRows);
  }
  subData.rows.forEach(indexSubRows);

  function enrich(node) {
    const subNode = subRowMap.get(node.id);
    const values = { ...(node.values || {}) };
    if (subNode && subNode.values) {
      Object.assign(values, subNode.values);
    }
    return {
      ...node,
      values,
      children: (node.children || []).map(enrich)
    };
  }
  return rows.map(enrich);
}

/**
 * =========================================================================
 * (ج) جدول «الإيرادات والتحصيل» الهرمي (Revenue & Collections)
 * =========================================================================
 */
function renderRevenueCollectionTable(container, revRes) {
  if (!container || !revRes || !revRes.tree) return;

  // Wrap companies inside a root "المجموعة" node
  const groupNode = {
    id: 'group_rev',
    name: 'المجموعة (كافة الشركات)',
    level: 0,
    total_billed: revRes.totals?.total_billed || 0,
    total_collected: revRes.totals?.total_collected || 0,
    total_residual: revRes.totals?.total_residual || 0,
    collection_rate: revRes.totals?.collection_rate || 0,
    over_90: revRes.totals?.over_90 || 0,
    children: (revRes.tree || []).map(co => ({
      ...co,
      level: 1,
      children: (co.departments || []).map(dept => ({
        ...dept,
        level: 2,
        children: (dept.partners || []).map(p => ({
          ...p,
          level: 3,
          children: (p.invoices || []).map(inv => ({
            ...inv,
            level: 4,
            isInvoice: true,
            total_billed: inv.total,
            total_collected: inv.collected,
            total_residual: inv.residual,
            children: []
          }))
        }))
      }))
    }))
  };

  // Build visible flat list of rows based on revColExpandedRows
  const visibleRows = [];
  function traverse(node) {
    visibleRows.push(node);
    if (revColExpandedRows.has(node.id) && node.children && node.children.length > 0) {
      const sorted = [...node.children].sort((a, b) => (b.total_billed || 0) - (a.total_billed || 0));
      sorted.forEach(traverse);
    }
  }
  traverse(groupNode);

  container.innerHTML = `
    <div class="perf-table-wrap" data-scroll-x="true">
      <table class="perf-table" id="table-revenue-collection">
        <thead>
          <tr>
            <th style="min-width:260px;position:sticky;right:0;z-index:20;background:var(--perf-header-bg);">البيان</th>
            <th class="num-col" style="min-width:120px;">المفوتر</th>
            <th class="num-col" style="min-width:120px;">المحصّل</th>
            <th class="num-col" style="min-width:120px;">المتبقي</th>
            <th class="num-col" style="min-width:95px;">نسبة التحصيل</th>
            <th class="num-col" style="min-width:120px;color:#ef4444;">متأخر +90 يوماً</th>
          </tr>
        </thead>
        <tbody>
          ${visibleRows.map(row => {
            const hasChildren = row.children && row.children.length > 0;
            const isOpen = revColExpandedRows.has(row.id);
            const indent = (row.level || 0) * 18 + 12;
            const isInv = row.isInvoice;

            return `
              <tr class="perf-row-${row.level || 0} ${hasChildren || isInv ? 'perf-row-clickable' : ''}" 
                  data-rowid="${row.id}" 
                  data-isinv="${isInv ? 'true' : 'false'}"
                  ${isInv ? `data-invjson='${escapeAttr(JSON.stringify(row))}'` : ''}>
                <td style="padding-right:${indent}px;position:sticky;right:0;z-index:15;background:inherit;">
                  ${hasChildren ? `
                    <span class="perf-arrow ${isOpen ? 'open' : ''}">◂</span>
                  ` : isInv ? '<span style="display:inline-block;margin-left:6px;font-size:0.75rem;">🧾</span>' : '<span style="display:inline-block;width:14px;margin-left:6px;"></span>'}
                  <span style="${isInv ? 'color:#60a5fa;text-decoration:underline;' : ''}">
                    ${escapeHtml(row.name || 'بدون اسم')}
                  </span>
                  ${isInv && row.date ? `<span style="font-size:0.75rem;color:var(--perf-text-muted);margin-right:6px;">(${row.date})</span>` : ''}
                </td>

                <td class="num-cell">${fmtVal(row.total_billed)}</td>
                <td class="num-cell" style="color:#10b981;">${fmtVal(row.total_collected)}</td>
                <td class="num-cell" style="color:#ef4444;">${fmtVal(row.total_residual)}</td>
                <td class="num-cell" style="font-weight:700;">${fmtRate(row.collection_rate)}</td>
                <td class="num-cell">
                  ${row.over_90 > 0 ? `<span class="perf-num-neg">${Math.round(row.over_90).toLocaleString('en-US')}</span>` : '—'}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Bind click events: expand rows or open invoice drawer
  container.querySelectorAll('.perf-row-clickable').forEach(tr => {
    tr.addEventListener('click', () => {
      const isInv = tr.dataset.isinv === 'true';
      if (isInv) {
        const invData = JSON.parse(tr.dataset.invjson);
        openInvoiceDrawer(invData);
      } else {
        const rowId = tr.dataset.rowid;
        if (revColExpandedRows.has(rowId)) {
          revColExpandedRows.delete(rowId);
        } else {
          revColExpandedRows.add(rowId);
        }
        renderRevenueCollectionTable(container, revRes);
      }
    });
  });
}

/**
 * =========================================================================
 * (د) جدول «أعمار الذمم» الهرمي (Aging Table - Collapsed by default)
 * =========================================================================
 */
function renderAgingTable(container, agRes) {
  if (!container || !agRes || !agRes.tree) return;

  const buckets = agRes.buckets || [];

  // Wrap companies inside a root "المجموعة" node
  const groupNode = {
    id: 'group_aging',
    name: 'المجموعة (كافة الشركات)',
    level: 0,
    total_residual: agRes.totals?.total_residual || 0,
    buckets: agRes.totals?.buckets || {},
    children: (agRes.tree || []).map(co => ({
      ...co,
      level: 1,
      children: (co.departments || []).map(dept => ({
        ...dept,
        level: 2,
        children: (dept.partners || []).map(p => ({
          ...p,
          level: 3,
          children: (p.invoices || []).map(inv => ({
            ...inv,
            level: 4,
            isInvoice: true,
            total_residual: inv.residual,
            buckets: { [inv.bucket]: inv.residual },
            children: []
          }))
        }))
      }))
    }))
  };

  // Build visible flat list based on agingExpandedRows
  const visibleRows = [];
  function traverse(node) {
    visibleRows.push(node);
    if (agingExpandedRows.has(node.id) && node.children && node.children.length > 0) {
      const sorted = [...node.children].sort((a, b) => (b.total_residual || 0) - (a.total_residual || 0));
      sorted.forEach(traverse);
    }
  }
  traverse(groupNode);

  container.innerHTML = `
    <div class="perf-table-wrap" data-scroll-x="true">
      <table class="perf-table" id="table-aging-perf">
        <thead>
          <tr>
            <th style="min-width:240px;position:sticky;right:0;z-index:20;background:var(--perf-header-bg);">البيان</th>
            ${buckets.map(b => `<th class="num-col" style="min-width:105px;">${b.label}</th>`).join('')}
            <th class="num-col" style="min-width:120px;font-weight:800;border-right:2px solid var(--perf-border);">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${visibleRows.map(row => {
            const hasChildren = row.children && row.children.length > 0;
            const isOpen = agingExpandedRows.has(row.id);
            const indent = (row.level || 0) * 18 + 12;
            const isInv = row.isInvoice;

            return `
              <tr class="perf-row-${row.level || 0} ${hasChildren || isInv ? 'perf-row-clickable' : ''}" 
                  data-rowid="${row.id}"
                  data-isinv="${isInv ? 'true' : 'false'}"
                  ${isInv ? `data-invjson='${escapeAttr(JSON.stringify(row))}'` : ''}>
                <td style="padding-right:${indent}px;position:sticky;right:0;z-index:15;background:inherit;">
                  ${hasChildren ? `
                    <span class="perf-arrow ${isOpen ? 'open' : ''}">◂</span>
                  ` : isInv ? '<span style="display:inline-block;margin-left:6px;font-size:0.75rem;">🧾</span>' : '<span style="display:inline-block;width:14px;margin-left:6px;"></span>'}
                  <span style="${isInv ? 'color:#60a5fa;text-decoration:underline;' : ''}">
                    ${escapeHtml(row.name || 'بدون اسم')}
                  </span>
                </td>

                ${buckets.map(b => {
                  const val = row.buckets ? row.buckets[b.key] : 0;
                  return `<td class="num-cell">${fmtVal(val)}</td>`;
                }).join('')}

                <td class="num-cell" style="font-weight:800;border-right:2px solid var(--perf-border);color:#ef4444;">
                  ${fmtVal(row.total_residual)}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Bind click events: expand rows or open invoice drawer
  container.querySelectorAll('.perf-row-clickable').forEach(tr => {
    tr.addEventListener('click', () => {
      const isInv = tr.dataset.isinv === 'true';
      if (isInv) {
        const invData = JSON.parse(tr.dataset.invjson);
        openInvoiceDrawer(invData);
      } else {
        const rowId = tr.dataset.rowid;
        if (agingExpandedRows.has(rowId)) {
          agingExpandedRows.delete(rowId);
        } else {
          agingExpandedRows.add(rowId);
        }
        renderAgingTable(container, agRes);
      }
    });
  });
}

/**
 * =========================================================================
 * Side Drawer for Invoice Details
 * =========================================================================
 */
function openInvoiceDrawer(inv) {
  selectedDrawerInvoice = inv;
  const backdrop = document.querySelector('#perf-drawer-backdrop');
  const drawer = document.querySelector('#perf-drawer');
  const content = document.querySelector('#perf-drawer-content');
  if (!drawer || !content || !backdrop) return;

  const pStateBadge = {
    paid: '<span style="background:rgba(16,185,129,0.15);color:#10b981;padding:4px 10px;border-radius:6px;font-weight:700;">مسددة بالكامل</span>',
    not_paid: '<span style="background:rgba(239,68,68,0.15);color:#ef4444;padding:4px 10px;border-radius:6px;font-weight:700;">غير مسددة</span>',
    partial: '<span style="background:rgba(245,158,11,0.15);color:#f59e0b;padding:4px 10px;border-radius:6px;font-weight:700;">سداد جزئي</span>',
    reversed: '<span style="background:rgba(100,116,139,0.15);color:#94a3b8;padding:4px 10px;border-radius:6px;font-weight:700;">معكوسة</span>'
  }[inv.payment_state] || '<span style="color:var(--perf-text-muted);">—</span>';

  content.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;border-bottom:1px solid var(--perf-border);padding-bottom:14px;">
      <div>
        <h3 style="margin:0;font-size:1.15rem;font-weight:800;color:var(--perf-text);">${escapeHtml(inv.name || 'فاتورة')}</h3>
        <span style="font-size:0.85rem;color:var(--perf-text-muted);">${escapeHtml(inv.company_name || '')}</span>
      </div>
      <button id="perf-drawer-close" style="background:none;border:none;color:var(--perf-text-muted);font-size:1.4rem;cursor:pointer;padding:4px;">✕</button>
    </div>

    <div style="display:flex;flex-direction:column;gap:14px;font-size:0.92rem;">
      
      <div style="display:flex;justify-content:space-between;padding:10px 12px;background:rgba(255,255,255,0.03);border-radius:8px;">
        <span style="color:var(--perf-text-muted);">العميل:</span>
        <strong style="color:var(--perf-text);">${escapeHtml(inv.partner_name || 'بدون عميل')}</strong>
      </div>

      <div style="display:flex;justify-content:space-between;padding:10px 12px;background:rgba(255,255,255,0.03);border-radius:8px;">
        <span style="color:var(--perf-text-muted);">القسم:</span>
        <strong style="color:var(--perf-text);">${escapeHtml(inv.department_name || 'غير مصنّف')}</strong>
      </div>

      <div style="display:flex;justify-content:space-between;padding:10px 12px;background:rgba(255,255,255,0.03);border-radius:8px;">
        <span style="color:var(--perf-text-muted);">حالة السداد:</span>
        <div>${pStateBadge}</div>
      </div>

      <div style="display:flex;justify-content:space-between;padding:10px 12px;background:rgba(255,255,255,0.03);border-radius:8px;">
        <span style="color:var(--perf-text-muted);">تاريخ الفاتورة:</span>
        <strong style="font-family:var(--font-en);color:var(--perf-text);">${inv.date || '—'}</strong>
      </div>

      <div style="display:flex;justify-content:space-between;padding:10px 12px;background:rgba(255,255,255,0.03);border-radius:8px;">
        <span style="color:var(--perf-text-muted);">تاريخ الاستحقاق:</span>
        <strong style="font-family:var(--font-en);color:var(--perf-text);">${inv.due_date || '—'}</strong>
      </div>

      <div style="display:flex;justify-content:space-between;padding:10px 12px;background:rgba(255,255,255,0.03);border-radius:8px;">
        <span style="color:var(--perf-text-muted);">عمر الدين:</span>
        <strong style="font-family:var(--font-en);color:${inv.age_days > 90 ? '#ef4444' : 'var(--perf-text)'};">${inv.age_days || 0} يوم</strong>
      </div>

      <div style="margin-top:10px;border-top:1px solid var(--perf-border);padding-top:14px;display:flex;flex-direction:column;gap:10px;">
        
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="color:var(--perf-text-muted);font-weight:700;">المبلغ الإجمالي (شامل الضريبة):</span>
          <span class="perf-num" style="font-size:1.1rem;color:#3b82f6;">${Math.round(inv.total || inv.total_billed || 0).toLocaleString('en-US')} ريال</span>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="color:var(--perf-text-muted);font-weight:700;">المبلغ المسدد (المحصّل):</span>
          <span class="perf-num" style="font-size:1.1rem;color:#10b981;">${Math.round(inv.collected || inv.total_collected || 0).toLocaleString('en-US')} ريال</span>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="color:var(--perf-text-muted);font-weight:700;">المتبقي غير المسدد:</span>
          <span class="perf-num" style="font-size:1.15rem;color:#ef4444;font-weight:800;">${Math.round(inv.residual || inv.total_residual || 0).toLocaleString('en-US')} ريال</span>
        </div>

      </div>

    </div>
  `;

  content.querySelector('#perf-drawer-close')?.addEventListener('click', closeInvoiceDrawer);

  backdrop.style.display = 'block';
  setTimeout(() => {
    drawer.style.transform = 'translateX(0)';
  }, 10);
}

function closeInvoiceDrawer() {
  const backdrop = document.querySelector('#perf-drawer-backdrop');
  const drawer = document.querySelector('#perf-drawer');
  if (drawer) drawer.style.transform = 'translateX(-100%)';
  if (backdrop) {
    setTimeout(() => { backdrop.style.display = 'none'; }, 250);
  }
}

/**
 * =========================================================================
 * Export to Excel (CSV with UTF-8 BOM)
 * =========================================================================
 */
function exportCurrentViewExcel() {
  const table = document.querySelector('#table-revenue-collection') || document.querySelector('#table-financial-perf');
  if (!table) return;

  const rows = [];
  table.querySelectorAll('tr').forEach(tr => {
    const cells = [];
    tr.querySelectorAll('th, td').forEach(td => {
      let text = td.innerText.replace(/\s+/g, ' ').trim();
      text = text.replace(/^[◂▼−+🧾]\s*/, '');
      cells.push(text);
    });
    if (cells.length > 0) rows.push(cells);
  });

  const csvContent = '\uFEFF' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const periodName = (currentTimeFilter?.periodLabel || '2026').replace(/[\s\/\\]+/g, '-');
  a.download = `تقرير-الأداء-والتحصيل-${periodName}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * =========================================================================
 * Export to PDF (A4 Landscape using html2canvas & jsPDF)
 * =========================================================================
 */
async function exportCurrentViewPDF() {
  const content = document.querySelector('#perf-content');
  if (!content) return;

  try {
    const canvas = await html2canvas(content, {
      scale: 1.5,
      useCORS: true,
      backgroundColor: '#ffffff'
    });

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const usableWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height / canvas.width) * usableWidth;

    const imgData = canvas.toDataURL('image/png');
    doc.addImage(imgData, 'PNG', margin, margin, usableWidth, Math.min(imgHeight, pageHeight - margin * 2));
    const periodName = (currentTimeFilter?.periodLabel || '2026').replace(/[\s\/\\]+/g, '-');
    doc.save(`تقرير-الأداء-والتحصيل-${periodName}.pdf`);
  } catch (err) {
    console.error('PDF export error:', err);
    alert('حدث خطأ أثناء تصدير ملف PDF: ' + err.message);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
}
