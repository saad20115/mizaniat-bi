import { api } from '../api.js';
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
    return `<span class="exec-num-neg" style="color:var(--exec-danger, #ef4444);direction:ltr;display:inline-block;">(${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })})</span>`;
  }
  return `<span class="exec-num">${formatted}</span>`;
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
      <div id="vat-loading" style="text-align:center;padding:80px 20px;color:rgba(255,255,255,0.5);font-size:1.1rem;">
        <span class="spin-icon" style="display:inline-block;animation:bi-spin 0.8s linear infinite;margin-left:8px;font-size:1.4rem;">⏳</span>
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
        <div style="color:var(--exec-danger, #ef4444);font-size:1.1rem;padding:30px;">
          ❌ حدث خطأ أثناء تحميل بيانات ضريبة القيمة المضافة: ${escapeHtml(err.message)}
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

  mainContent.innerHTML = `
    <!-- Top 4 KPI Cards -->
    <div class="vat-kpi-grid" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:16px;">
      <!-- Card 1: Output VAT -->
      <div class="exec-card" style="background:var(--exec-card-bg, #1a2234);border:1px solid var(--exec-border, rgba(255,255,255,0.08));border-radius:12px;padding:20px;display:flex;flex-direction:column;gap:8px;position:relative;overflow:hidden;min-width:0;">
        <div style="position:absolute;top:0;right:0;width:4px;height:100%;background:#3b82f6;"></div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:0.9rem;color:var(--exec-text-dim, #94a3b8);font-weight:600;">ضريبة المخرجات (المبيعات)</span>
          <span style="font-size:1.2rem;">📤</span>
        </div>
        <div style="font-size:clamp(1.15rem, 2.2vw, 1.75rem);font-weight:800;color:var(--exec-text, #ffffff);letter-spacing:-0.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${fmtVal(cards.output_tax, false)} <span style="font-size:0.95rem;font-weight:500;color:var(--exec-text-dim, #94a3b8);">ر.س</span>
        </div>
        <div style="font-size:0.8rem;color:var(--exec-text-dim, #94a3b8);display:flex;justify-content:space-between;">
          <span>المبيعات الخاضعة: ${fmtVal(cards.taxable_sales, false, 0)} ر.س</span>
        </div>
      </div>

      <!-- Card 2: Input VAT -->
      <div class="exec-card" style="background:var(--exec-card-bg, #1a2234);border:1px solid var(--exec-border, rgba(255,255,255,0.08));border-radius:12px;padding:20px;display:flex;flex-direction:column;gap:8px;position:relative;overflow:hidden;min-width:0;">
        <div style="position:absolute;top:0;right:0;width:4px;height:100%;background:#10b981;"></div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:0.9rem;color:var(--exec-text-dim, #94a3b8);font-weight:600;">ضريبة المدخلات (المشتريات)</span>
          <span style="font-size:1.2rem;">📥</span>
        </div>
        <div style="font-size:clamp(1.15rem, 2.2vw, 1.75rem);font-weight:800;color:var(--exec-text, #ffffff);letter-spacing:-0.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${fmtVal(cards.input_tax, false)} <span style="font-size:0.95rem;font-weight:500;color:var(--exec-text-dim, #94a3b8);">ر.س</span>
        </div>
        <div style="font-size:0.8rem;color:var(--exec-text-dim, #94a3b8);display:flex;justify-content:space-between;">
          <span>المشتريات الخاضعة: ${fmtVal(cards.taxable_purchases, false, 0)} ر.س</span>
        </div>
      </div>

      <!-- Card 3: Net Tax Due (Highlighted) -->
      <div class="exec-card" style="background:linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(30,41,59,0.7) 100%);border:1px solid rgba(59,130,246,0.35);border-radius:12px;padding:20px;display:flex;flex-direction:column;gap:8px;position:relative;overflow:hidden;min-width:0;">
        <div style="position:absolute;top:0;right:0;width:4px;height:100%;background:#60a5fa;"></div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:0.9rem;color:#93c5fd;font-weight:700;">صافي الضريبة المستحقة للفترة</span>
          <span style="font-size:1.2rem;">🧾</span>
        </div>
        <div style="font-size:clamp(1.2rem, 2.3vw, 1.85rem);font-weight:900;color:#ffffff;letter-spacing:-0.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${fmtVal(cards.net_tax_due, false)} <span style="font-size:0.95rem;font-weight:500;color:#93c5fd;">ر.س</span>
        </div>
        <div style="font-size:0.82rem;color:${cards.last_completed_period ? '#60a5fa' : 'var(--exec-text-dim, #94a3b8)'};font-weight:500;">
          ${cards.last_completed_period ? `آخر فترة إقرار مكتملة: ${escapeHtml(cards.last_completed_period)}` : 'المخرجات − المدخلات'}
        </div>
      </div>

      <!-- Card 4: Ledger Balance -->
      <div class="exec-card" style="background:var(--exec-card-bg, #1a2234);border:1px solid var(--exec-border, rgba(255,255,255,0.08));border-radius:12px;padding:20px;display:flex;flex-direction:column;gap:8px;position:relative;overflow:hidden;min-width:0;">
        <div style="position:absolute;top:0;right:0;width:4px;height:100%;background:#f59e0b;"></div>
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:0.9rem;color:var(--exec-text-dim, #94a3b8);font-weight:600;">رصيد حسابات الضريبة الدفتري</span>
          <span style="font-size:1.2rem;">🏦</span>
        </div>
        <div style="font-size:clamp(1.15rem, 2.2vw, 1.75rem);font-weight:800;color:var(--exec-text, #ffffff);letter-spacing:-0.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${fmtVal(cards.ledger_balance, false)} <span style="font-size:0.95rem;font-weight:500;color:var(--exec-text-dim, #94a3b8);">ر.س</span>
        </div>
        <div style="font-size:0.8rem;color:var(--exec-text-dim, #94a3b8);display:flex;justify-content:space-between;">
          <span>التسويات والسداد: ${fmtVal(cards.settlements, false, 0)} ر.س</span>
        </div>
      </div>
    </div>

    <!-- Toolbar: Grain toggle, search, controls, notice -->
    <div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px;background:var(--exec-card-bg, #1a2234);padding:14px 18px;border-radius:12px;border:1px solid var(--exec-border, rgba(255,255,255,0.08));">
      <div style="display:flex;flex-wrap:wrap;align-items:center;gap:12px;">
        <!-- Grain Toggle -->
        <span style="font-size:0.88rem;color:var(--exec-text-dim, #94a3b8);font-weight:600;">مفتاح العرض:</span>
        <div class="vat-grain-pills" style="display:inline-flex;background:rgba(255,255,255,0.05);padding:3px;border-radius:8px;gap:4px;">
          <button type="button" class="vat-grain-btn ${currentGrain === 'vat_period' ? 'active' : ''}" data-grain="vat_period"
            style="padding:5px 12px;border:none;border-radius:6px;cursor:pointer;font-size:0.82rem;font-weight:600;transition:all 0.15s;${currentGrain === 'vat_period' ? 'background:#3b82f6;color:#fff;' : 'background:transparent;color:var(--exec-text-dim, #94a3b8);'}">
            حسب دورية الإقرار
          </button>
          <button type="button" class="vat-grain-btn ${currentGrain === 'quarter' ? 'active' : ''}" data-grain="quarter"
            style="padding:5px 12px;border:none;border-radius:6px;cursor:pointer;font-size:0.82rem;font-weight:600;transition:all 0.15s;${currentGrain === 'quarter' ? 'background:#3b82f6;color:#fff;' : 'background:transparent;color:var(--exec-text-dim, #94a3b8);'}">
            ربعي
          </button>
          <button type="button" class="vat-grain-btn ${currentGrain === 'month' ? 'active' : ''}" data-grain="month"
            style="padding:5px 12px;border:none;border-radius:6px;cursor:pointer;font-size:0.82rem;font-weight:600;transition:all 0.15s;${currentGrain === 'month' ? 'background:#3b82f6;color:#fff;' : 'background:transparent;color:var(--exec-text-dim, #94a3b8);'}">
            شهري
          </button>
          <button type="button" class="vat-grain-btn ${currentGrain === 'year' ? 'active' : ''}" data-grain="year"
            style="padding:5px 12px;border:none;border-radius:6px;cursor:pointer;font-size:0.82rem;font-weight:600;transition:all 0.15s;${currentGrain === 'year' ? 'background:#3b82f6;color:#fff;' : 'background:transparent;color:var(--exec-text-dim, #94a3b8);'}">
            سنوي
          </button>
        </div>

        <!-- Expand / Collapse All -->
        <div style="display:inline-flex;gap:6px;margin-right:8px;">
          <button type="button" id="vat-expand-all-btn" class="exec-btn-secondary" style="padding:5px 11px;font-size:0.8rem;border-radius:6px;background:rgba(255,255,255,0.06);border:1px solid var(--exec-border, rgba(255,255,255,0.1));color:var(--exec-text, #fff);cursor:pointer;">
            + توسيع الكل
          </button>
          <button type="button" id="vat-collapse-all-btn" class="exec-btn-secondary" style="padding:5px 11px;font-size:0.8rem;border-radius:6px;background:rgba(255,255,255,0.06);border:1px solid var(--exec-border, rgba(255,255,255,0.1));color:var(--exec-text, #fff);cursor:pointer;">
            − طي الكل
          </button>
        </div>
      </div>

      <div style="display:flex;align-items:center;gap:12px;">
        <!-- Search filter input -->
        <div style="position:relative;">
          <input type="text" id="vat-search-input" value="${escapeHtml(currentSearchQuery)}" placeholder="تصفية بالبيان أو الفترة..."
            style="width:200px;padding:6px 12px 6px 30px;background:rgba(255,255,255,0.05);border:1px solid var(--exec-border, rgba(255,255,255,0.12));border-radius:6px;color:var(--exec-text, #fff);font-size:0.82rem;outline:none;" />
          <span style="position:absolute;left:8px;top:50%;transform:translateY(-50%);font-size:0.85rem;color:var(--exec-text-dim, #94a3b8);">🔍</span>
        </div>

        <!-- Export Buttons -->
        <button type="button" id="vat-export-excel" style="padding:6px 12px;background:rgba(16,185,129,0.15);border:1px solid rgba(16,185,129,0.3);color:#10b981;border-radius:6px;font-size:0.82rem;cursor:pointer;font-weight:600;">
          📥 Excel
        </button>
      </div>
    </div>

    <!-- Methodology Note -->
    <div style="display:flex;align-items:center;gap:8px;padding:8px 14px;background:rgba(59,130,246,0.08);border-right:3px solid #3b82f6;border-radius:6px;font-size:0.82rem;color:var(--exec-text-dim, #94a3b8);">
      <span style="color:#60a5fa;font-size:0.95rem;">ℹ️</span>
      <span>الفترات محسوبة طبقاً لتاريخ القيد المحاسبي، والقيود المرحّلة فقط. أسطر الضريبة مستخرجة مباشرة من ربط القيود بضرائب أودو.</span>
    </div>

    <!-- TreeTable Container -->
    <div id="vat-tree-container" class="vat-treetable-container tree-table-wrap" data-scroll-x="true" style="background:var(--exec-card-bg, #1a2234);border:1px solid var(--exec-border, rgba(255,255,255,0.08));border-radius:12px;overflow-x:auto;width:100%;max-width:100%;min-width:0;box-sizing:border-box;"></div>

    <!-- Slide-over Drawer for Details -->
    <div id="vat-drawer-backdrop" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9998;backdrop-filter:blur(2px);transition:opacity 0.2s;"></div>
    <div id="vat-drawer" style="position:fixed;top:0;left:0;bottom:0;width:min(720px, 92vw);background:var(--exec-card-bg, #1e293b);box-shadow:4px 0 24px rgba(0,0,0,0.5);z-index:9999;transform:translateX(-100%);transition:transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);display:flex;flex-direction:column;border-right:1px solid var(--exec-border, rgba(255,255,255,0.1));">
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
          b.style.background = isActive ? '#3b82f6' : 'transparent';
          b.style.color = isActive ? '#fff' : 'var(--exec-text-dim, #94a3b8)';
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

  // Search filter
  const searchInput = body.querySelector('#vat-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearchQuery = e.target.value.trim().toLowerCase();
      filterTreeTableBySearch();
    });
  }

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
      <div title="${escapeHtml(tip)}" style="display:flex;flex-direction:column;gap:3px;width:100%;min-width:120px;cursor:help;padding:2px 4px;">
        <div style="display:flex;width:100%;height:8px;background:rgba(255,255,255,0.08);border-radius:4px;overflow:hidden;">
          <div style="width:${pOut}%;background:#3b82f6;height:100%;"></div>
          <div style="width:${pIn}%;background:#10b981;height:100%;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--exec-text-dim, #94a3b8);padding:0 2px;">
          <span style="color:#60a5fa;">مخرجات ${pOut}%</span>
          <span style="color:#34d399;">مدخلات ${pIn}%</span>
        </div>
      </div>
    `;
  }

  const columns = [
    { id: 'name', key: 'name', label: 'البيان / الفترة', minWidth: '260px', priority: 1 },
    { id: 'taxable_sales', key: 'taxable_sales', label: 'المبيعات الخاضعة', width: '110px', minWidth: '100px', priority: 2 },
    { id: 'output_tax', key: 'output_tax', label: 'ضريبة المخرجات', width: '115px', minWidth: '100px', priority: 1 },
    { id: 'taxable_purchases', key: 'taxable_purchases', label: 'المشتريات الخاضعة', width: '110px', minWidth: '100px', priority: 2 },
    { id: 'input_tax', key: 'input_tax', label: 'ضريبة المدخلات', width: '115px', minWidth: '100px', priority: 1 },
    { id: 'net_tax_due', key: 'net_tax_due', label: 'صافي الضريبة', width: '120px', minWidth: '105px', priority: 1 },
    { id: 'settlements', key: 'settlements', label: 'التسويات والسداد', width: '110px', minWidth: '100px', priority: 2 },
    { id: 'vat_visual', key: 'vat_visual', label: 'المخرجات مقابل المدخلات', align: 'center', flex: true, minWidth: '160px', priority: 1 },
    { id: 'actions', key: 'actions', label: '', width: '44px', minWidth: '44px', maxWidth: '44px', priority: 1 }
  ];

  currentTreeTable = createTreeTable(container, {
    storageKey: 'mizaniat_vat_tree',
    columns,
    data: rawTree,
    totals,
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
      let icon = '';
      let badge = '';
      let nameStyle = 'font-weight:500;';

      if (node.type === 'company') {
        icon = '🏢';
        nameStyle = 'font-weight:700;color:var(--exec-text, #ffffff);font-size:0.92rem;';
        const isMonthly = node.vat_period === 'monthly';
        badge = `
          <span style="font-size:0.75rem;padding:2px 7px;border-radius:4px;font-weight:600;margin-right:6px;${isMonthly ? 'background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);' : 'background:rgba(59,130,246,0.15);color:#60a5fa;border:1px solid rgba(59,130,246,0.3);'}">
            ${isMonthly ? 'إقرار شهري' : 'إقرار ربعي'}
          </span>
        `;
      } else if (node.type === 'year') {
        icon = '📅';
        nameStyle = 'font-weight:600;color:var(--exec-text, #f1f5f9);';
      } else if (node.type === 'quarter') {
        icon = '📊';
        nameStyle = 'font-weight:600;color:#93c5fd;';
      } else if (node.type === 'month') {
        icon = '🗓️';
        nameStyle = 'color:var(--exec-text-dim, #cbd5e1);';
      }

      const netDueColor = node.net_tax_due > 0 ? 'var(--exec-text, #ffffff)' : (node.net_tax_due < 0 ? '#10b981' : 'var(--exec-text-dim, #94a3b8)');

      const actionBtn = (node.type === 'month' || node.type === 'quarter') ? `
        <button type="button" class="vat-detail-btn exec-btn-icon" data-cid="${node.company_id}" data-period="${escapeHtml(node.period_key || node.month || node.quarter)}" title="عرض تفاصيل الفترة"
          style="width:32px;height:28px;display:inline-flex;align-items:center;justify-content:center;border-radius:6px;background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.3);color:#60a5fa;cursor:pointer;font-size:0.9rem;padding:0;">
          📑
        </button>
      ` : '';

      const indent = depth * 20;
      const toggleIcon = hasKids ? (isExpanded ? '▼' : '▶') : '•';
      const cursor = hasKids ? 'cursor:pointer;' : '';
      const rowBg = node.type === 'company'
        ? 'background:rgba(59,130,246,0.06);font-weight:800;'
        : (node.type === 'year' ? 'background:rgba(255,255,255,0.03);font-weight:700;' : (node.type === 'quarter' ? 'background:rgba(255,255,255,0.015);' : ''));

      return `
        <tr data-tree-row="true" data-path-key="${escapeHtml(pathKey)}" style="${cursor} ${rowBg}">
          <td class="tree-col-name" data-col-id="name" data-priority="1" style="padding:10px 14px;padding-right:${indent + 14}px;white-space:nowrap;">
            <span data-tree-toggle="true" style="display:inline-block;width:18px;color:var(--exec-text-muted, rgba(255,255,255,0.4));font-size:0.85rem;">${toggleIcon}</span>
            <span style="margin-left:6px;">${icon}</span>
            <span style="${nameStyle}">${escapeHtml(node.name)}</span>
            ${badge}
          </td>
          <td class="tree-col-num" data-col-id="taxable_sales" data-priority="2" style="padding:10px 14px;text-align:right;">${fmtVal(node.taxable_sales)}</td>
          <td class="tree-col-num" data-col-id="output_tax" data-priority="1" style="padding:10px 14px;text-align:right;">${fmtVal(node.output_tax)}</td>
          <td class="tree-col-num" data-col-id="taxable_purchases" data-priority="2" style="padding:10px 14px;text-align:right;">${fmtVal(node.taxable_purchases)}</td>
          <td class="tree-col-num" data-col-id="input_tax" data-priority="1" style="padding:10px 14px;text-align:right;">${fmtVal(node.input_tax)}</td>
          <td class="tree-col-num" data-col-id="net_tax_due" data-priority="1" style="padding:10px 14px;text-align:right;font-weight:700;color:${netDueColor};">${fmtVal(node.net_tax_due)}</td>
          <td class="tree-col-num" data-col-id="settlements" data-priority="2" style="padding:10px 14px;text-align:right;">${fmtVal(node.settlements)}</td>
          <td class="tree-col-visual" data-col-id="vat_visual" data-priority="1" style="text-align:center;padding:8px 12px;">
            ${renderVatVisual(node)}
          </td>
          <td class="tree-col-action" data-col-id="actions" data-priority="1" style="text-align:center;width:44px;min-width:44px;max-width:44px;padding:4px 2px;">
            ${actionBtn}
          </td>
        </tr>
      `;
    },
    renderTotals: (tot) => {
      const netDue = (tot.output_tax || 0) - (tot.input_tax || 0);
      return `
        <tr class="exec-totals-row" style="background:rgba(255,255,255,0.06);font-weight:800;border-top:2px solid var(--exec-border, rgba(255,255,255,0.15));">
          <td class="tree-col-name" data-col-id="name" data-priority="1" style="padding:12px 14px;font-size:0.92rem;color:var(--exec-text, #ffffff);">
            المجموع الكلي العام
          </td>
          <td class="tree-col-num" data-col-id="taxable_sales" data-priority="2" style="padding:12px 14px;text-align:right;">${fmtVal(tot.taxable_sales, false)}</td>
          <td class="tree-col-num" data-col-id="output_tax" data-priority="1" style="padding:12px 14px;text-align:right;">${fmtVal(tot.output_tax, false)}</td>
          <td class="tree-col-num" data-col-id="taxable_purchases" data-priority="2" style="padding:12px 14px;text-align:right;">${fmtVal(tot.taxable_purchases, false)}</td>
          <td class="tree-col-num" data-col-id="input_tax" data-priority="1" style="padding:12px 14px;text-align:right;">${fmtVal(tot.input_tax, false)}</td>
          <td class="tree-col-num" data-col-id="net_tax_due" data-priority="1" style="padding:12px 14px;text-align:right;font-size:0.95rem;color:#60a5fa;">${fmtVal(netDue, false)}</td>
          <td class="tree-col-num" data-col-id="settlements" data-priority="2" style="padding:12px 14px;text-align:right;">${fmtVal(tot.settlements, false)}</td>
          <td class="tree-col-visual" data-col-id="vat_visual" data-priority="1" style="text-align:center;padding:12px 12px;">
            ${renderVatVisual(tot)}
          </td>
          <td class="tree-col-action" data-col-id="actions" data-priority="1" style="width:44px;min-width:44px;max-width:44px;padding:4px 2px;"></td>
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

function filterTreeTableBySearch() {
  if (!currentTreeTable) return;
  const table = currentTreeTable.container.querySelector('table');
  if (!table) return;

  const rows = table.querySelectorAll('tbody tr');
  rows.forEach(tr => {
    if (!currentSearchQuery) {
      tr.style.display = '';
      return;
    }
    const text = tr.innerText.toLowerCase();
    tr.style.display = text.includes(currentSearchQuery) ? '' : 'none';
  });
}

async function openVatDrawer(body, companyId, periodKey) {
  const backdrop = body.querySelector('#vat-drawer-backdrop');
  const drawer = body.querySelector('#vat-drawer');
  const drawerContent = body.querySelector('#vat-drawer-content');
  if (!drawer || !drawerContent) return;

  backdrop.style.display = 'block';
  drawer.style.transform = 'translateX(0)';

  drawerContent.innerHTML = `
    <div style="padding:24px 20px;border-bottom:1px solid var(--exec-border, rgba(255,255,255,0.1));display:flex;justify-content:space-between;align-items:center;">
      <div>
        <h3 style="margin:0;font-size:1.15rem;font-weight:700;color:var(--exec-text, #ffffff);">
          تفاصيل الإقرار الضريبي — ${escapeHtml(periodKey)}
        </h3>
        <span style="font-size:0.8rem;color:var(--exec-text-dim, #94a3b8);">جاري جلب تفاصيل العمليات والمستندات...</span>
      </div>
      <button type="button" id="vat-drawer-close-btn" style="background:transparent;border:none;color:var(--exec-text-dim, #94a3b8);font-size:1.4rem;cursor:pointer;padding:4px 8px;border-radius:6px;">✕</button>
    </div>
    <div style="text-align:center;padding:60px 20px;color:rgba(255,255,255,0.5);">
      <span class="spin-icon" style="display:inline-block;animation:bi-spin 0.8s linear infinite;font-size:1.5rem;">⏳</span>
      <div style="margin-top:10px;">جاري تحميل التفاصيل...</div>
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
      <div style="padding:24px 20px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--exec-border, rgba(255,255,255,0.1));">
        <h3 style="margin:0;color:var(--exec-danger, #ef4444);">خطأ في جلب التفاصيل</h3>
        <button type="button" id="vat-drawer-close-btn-err" style="background:transparent;border:none;color:#fff;font-size:1.4rem;cursor:pointer;">✕</button>
      </div>
      <div style="padding:30px;color:var(--exec-danger, #ef4444);font-size:0.95rem;">
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
    <div style="padding:18px 20px;border-bottom:1px solid var(--exec-border, rgba(255,255,255,0.1));display:flex;justify-content:space-between;align-items:center;background:rgba(255,255,255,0.02);">
      <div>
        <h3 style="margin:0;font-size:1.15rem;font-weight:800;color:var(--exec-text, #ffffff);">
          تفاصيل ضريبة القيمة المضافة — ${escapeHtml(periodKey)}
        </h3>
        <span style="font-size:0.8rem;color:var(--exec-text-dim, #94a3b8);">
          الفترة من ${escapeHtml(details.date_from)} إلى ${escapeHtml(details.date_to)}
        </span>
      </div>
      <button type="button" id="vat-drawer-close-btn" style="background:transparent;border:none;color:var(--exec-text-dim, #94a3b8);font-size:1.4rem;cursor:pointer;padding:4px 8px;border-radius:6px;">✕</button>
    </div>

    <!-- Drawer Tabs -->
    <div style="display:flex;gap:6px;padding:12px 20px;background:rgba(0,0,0,0.2);border-bottom:1px solid var(--exec-border, rgba(255,255,255,0.06));">
      <button type="button" class="drawer-tab-btn active" data-tab="summary" style="padding:6px 14px;border:none;border-radius:6px;background:#3b82f6;color:#fff;font-size:0.82rem;font-weight:600;cursor:pointer;">
        📊 ملخص الإقرار
      </button>
      <button type="button" class="drawer-tab-btn" data-tab="by_tax" style="padding:6px 14px;border:none;border-radius:6px;background:transparent;color:var(--exec-text-dim, #94a3b8);font-size:0.82rem;font-weight:600;cursor:pointer;">
        🏷️ حسب نوع الضريبة (${byTaxType.length})
      </button>
      <button type="button" class="drawer-tab-btn" data-tab="documents" style="padding:6px 14px;border:none;border-radius:6px;background:transparent;color:var(--exec-text-dim, #94a3b8);font-size:0.82rem;font-weight:600;cursor:pointer;">
        📑 المستندات (${documents.length})
      </button>
      <button type="button" class="drawer-tab-btn" data-tab="settlements" style="padding:6px 14px;border:none;border-radius:6px;background:transparent;color:var(--exec-text-dim, #94a3b8);font-size:0.82rem;font-weight:600;cursor:pointer;">
        💳 التسويات (${settlementMoves.length})
      </button>
    </div>

    <!-- Drawer Body -->
    <div style="flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:18px;">
      
      <!-- TAB 1: SUMMARY -->
      <div id="dtab-summary" class="drawer-pane" style="display:flex;flex-direction:column;gap:16px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <!-- Sales Box -->
          <div style="background:rgba(59,130,246,0.06);border:1px solid rgba(59,130,246,0.2);border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:8px;">
            <div style="font-weight:700;color:#60a5fa;font-size:0.95rem;display:flex;justify-content:space-between;">
              <span>المبيعات والمخرجات</span>
              <span>📤</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:0.85rem;color:var(--exec-text-dim, #94a3b8);">
              <span>فواتير المبيعات:</span>
              <span style="font-weight:600;color:var(--exec-text, #fff);">${fmtVal(summary.output_invoices)} ر.س</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:0.85rem;color:var(--exec-text-dim, #94a3b8);">
              <span>مرتجعات المبيعات:</span>
              <span style="font-weight:600;color:var(--exec-danger, #ef4444);">${fmtVal(summary.output_refunds)} ر.س</span>
            </div>
            <div style="height:1px;background:rgba(59,130,246,0.2);margin:4px 0;"></div>
            <div style="display:flex;justify-content:space-between;font-size:0.9rem;font-weight:700;color:#93c5fd;">
              <span>صافي ضريبة المخرجات:</span>
              <span>${fmtVal(summary.output_tax)} ر.س</span>
            </div>
            <div style="font-size:0.78rem;color:var(--exec-text-dim, #94a3b8);">
              أساس المبيعات الخاضعة: ${fmtVal(summary.taxable_sales, false, 0)} ر.س
            </div>
          </div>

          <!-- Purchases Box -->
          <div style="background:rgba(16,185,129,0.06);border:1px solid rgba(16,185,129,0.2);border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:8px;">
            <div style="font-weight:700;color:#34d399;font-size:0.95rem;display:flex;justify-content:space-between;">
              <span>المشتريات والمدخلات</span>
              <span>📥</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:0.85rem;color:var(--exec-text-dim, #94a3b8);">
              <span>فواتير الشراء:</span>
              <span style="font-weight:600;color:var(--exec-text, #fff);">${fmtVal(summary.input_bills)} ر.س</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:0.85rem;color:var(--exec-text-dim, #94a3b8);">
              <span>مرتجعات الشراء:</span>
              <span style="font-weight:600;color:var(--exec-danger, #ef4444);">${fmtVal(summary.input_refunds)} ر.س</span>
            </div>
            <div style="height:1px;background:rgba(16,185,129,0.2);margin:4px 0;"></div>
            <div style="display:flex;justify-content:space-between;font-size:0.9rem;font-weight:700;color:#6ee7b7;">
              <span>صافي ضريبة المدخلات:</span>
              <span>${fmtVal(summary.input_tax)} ر.س</span>
            </div>
            <div style="font-size:0.78rem;color:var(--exec-text-dim, #94a3b8);">
              أساس المشتريات الخاضعة: ${fmtVal(summary.taxable_purchases, false, 0)} ر.س
            </div>
          </div>
        </div>

        <!-- Net Box -->
        <div style="background:var(--exec-card-bg, #1a2234);border:1px solid var(--exec-border, rgba(255,255,255,0.1));border-radius:10px;padding:18px;display:flex;flex-direction:column;gap:12px;">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span style="font-weight:700;font-size:1.05rem;color:var(--exec-text, #fff);">صافي الضريبة المستحقة للإقرار:</span>
            <span style="font-size:1.35rem;font-weight:900;color:#60a5fa;">${fmtVal(summary.net_tax_due)} ر.س</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);font-size:0.88rem;color:var(--exec-text-dim, #94a3b8);">
            <span>التسويات وسداد الهيئة في الفترة:</span>
            <span style="font-weight:700;color:var(--exec-text, #fff);">${fmtVal(summary.settlements)} ر.س</span>
          </div>
        </div>
      </div>

      <!-- TAB 2: BY TAX TYPE -->
      <div id="dtab-by_tax" class="drawer-pane" style="display:none;flex-direction:column;gap:12px;">
        <table style="width:100%;border-collapse:collapse;font-size:0.82rem;text-align:right;">
          <thead>
            <tr style="border-bottom:1px solid var(--exec-border, rgba(255,255,255,0.1));color:var(--exec-text-dim, #94a3b8);">
              <th style="padding:8px 10px;">اسم الضريبة</th>
              <th style="padding:8px 10px;">النوع</th>
              <th style="padding:8px 10px;">النسبة</th>
              <th style="padding:8px 10px;text-align:right;">الأساس الخاضع</th>
              <th style="padding:8px 10px;text-align:right;">مبلغ الضريبة</th>
              <th style="padding:8px 10px;text-align:center;">السجلات</th>
            </tr>
          </thead>
          <tbody>
            ${byTaxType.length === 0 ? `
              <tr><td colspan="6" style="padding:30px;text-align:center;color:var(--exec-text-dim, #94a3b8);">لا توجد ضرائب مستخدمة في هذه الفترة</td></tr>
            ` : byTaxType.map(t => {
              const isSale = t.type_tax_use === 'sale';
              return `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                  <td style="padding:9px 10px;font-weight:600;color:var(--exec-text, #fff);">${escapeHtml(t.name || t.tax_name)}</td>
                  <td style="padding:9px 10px;">
                    <span style="padding:2px 6px;border-radius:4px;font-size:0.75rem;${isSale ? 'background:rgba(59,130,246,0.15);color:#60a5fa;' : 'background:rgba(16,185,129,0.15);color:#34d399;'}">
                      ${isSale ? 'مبيعات' : 'مشتريات'}
                    </span>
                  </td>
                  <td style="padding:9px 10px;">${t.rate}%</td>
                  <td style="padding:9px 10px;text-align:right;">${fmtVal(t.base_amount)}</td>
                  <td style="padding:9px 10px;text-align:right;font-weight:600;">${fmtVal(t.tax_amount)}</td>
                  <td style="padding:9px 10px;text-align:center;">${t.count}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- TAB 3: DOCUMENTS -->
      <div id="dtab-documents" class="drawer-pane" style="display:none;flex-direction:column;gap:12px;">
        <table style="width:100%;border-collapse:collapse;font-size:0.8rem;text-align:right;">
          <thead>
            <tr style="border-bottom:1px solid var(--exec-border, rgba(255,255,255,0.1));color:var(--exec-text-dim, #94a3b8);">
              <th style="padding:8px 8px;">الرقم</th>
              <th style="padding:8px 8px;">الطرف</th>
              <th style="padding:8px 8px;">التاريخ</th>
              <th style="padding:8px 8px;text-align:right;">الأساس</th>
              <th style="padding:8px 8px;text-align:right;">الضريبة</th>
              <th style="padding:8px 8px;">النوع</th>
            </tr>
          </thead>
          <tbody>
            ${documents.length === 0 ? `
              <tr><td colspan="6" style="padding:30px;text-align:center;color:var(--exec-text-dim, #94a3b8);">لا توجد مستندات مسجلة</td></tr>
            ` : documents.map(d => {
              const isSale = d.tax_role === 'vat_output';
              return `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                  <td style="padding:8px 8px;font-weight:600;color:var(--exec-text, #fff);">${escapeHtml(d.move_name)}</td>
                  <td style="padding:8px 8px;color:var(--exec-text-dim, #cbd5e1);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(d.partner_name)}">
                    ${escapeHtml(d.partner_name || '—')}
                  </td>
                  <td style="padding:8px 8px;color:var(--exec-text-dim, #94a3b8);">${escapeHtml(d.date)}</td>
                  <td style="padding:8px 8px;text-align:right;">${fmtVal(d.tax_base_amount)}</td>
                  <td style="padding:8px 8px;text-align:right;font-weight:600;">${fmtVal(d.tax_amount)}</td>
                  <td style="padding:8px 8px;">
                    <span style="padding:1px 5px;border-radius:4px;font-size:0.72rem;${d.is_refund ? 'background:rgba(239,68,68,0.15);color:#ef4444;' : (isSale ? 'background:rgba(59,130,246,0.15);color:#60a5fa;' : 'background:rgba(16,185,129,0.15);color:#34d399;')}">
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
        <table style="width:100%;border-collapse:collapse;font-size:0.8rem;text-align:right;">
          <thead>
            <tr style="border-bottom:1px solid var(--exec-border, rgba(255,255,255,0.1));color:var(--exec-text-dim, #94a3b8);">
              <th style="padding:8px 8px;">رقم القيد</th>
              <th style="padding:8px 8px;">التاريخ</th>
              <th style="padding:8px 8px;">البيان</th>
              <th style="padding:8px 8px;text-align:right;">مدين</th>
              <th style="padding:8px 8px;text-align:right;">دائن</th>
              <th style="padding:8px 8px;">الحساب</th>
            </tr>
          </thead>
          <tbody>
            ${settlementMoves.length === 0 ? `
              <tr><td colspan="6" style="padding:30px;text-align:center;color:var(--exec-text-dim, #94a3b8);">لا توجد قيود تسوية مسجلة لهذه الفترة</td></tr>
            ` : settlementMoves.map(s => `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                <td style="padding:8px 8px;font-weight:600;color:var(--exec-text, #fff);">${escapeHtml(s.move_name)}</td>
                <td style="padding:8px 8px;color:var(--exec-text-dim, #94a3b8);">${escapeHtml(s.date)}</td>
                <td style="padding:8px 8px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(s.label)}">
                  ${escapeHtml(s.label || '—')}
                </td>
                <td style="padding:8px 8px;text-align:right;">${fmtVal(s.debit)}</td>
                <td style="padding:8px 8px;text-align:right;">${fmtVal(s.credit)}</td>
                <td style="padding:8px 8px;font-size:0.75rem;color:var(--exec-text-dim, #94a3b8);">${escapeHtml(s.account_code)}</td>
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
        b.style.background = isActive ? '#3b82f6' : 'transparent';
        b.style.color = isActive ? '#fff' : 'var(--exec-text-dim, #94a3b8)';
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

  const rows = [];
  rows.push(['الشركة / الفترة', 'النوع', 'المبيعات الخاضعة', 'ضريبة المخرجات', 'المشتريات الخاضعة', 'ضريبة المدخلات', 'صافي الضريبة المستحقة', 'التسويات والسداد']);

  function traverse(nodes) {
    for (const node of nodes) {
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
