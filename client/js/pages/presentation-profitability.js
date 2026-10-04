import { api } from '../api.js';
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
  const color = m >= 20 ? '#10b981' : (m > 0 ? '#3b82f6' : '#ef4444');
  const bg = m >= 20 ? 'rgba(16,185,129,0.12)' : (m > 0 ? 'rgba(59,130,246,0.12)' : 'rgba(239,68,68,0.12)');
  return `
    <span class="exec-num" style="display:inline-block;padding:2px 8px;border-radius:6px;background:${bg};color:${color};font-weight:700;font-size:0.82rem;">
      ${m > 0 ? '+' : ''}${m.toFixed(1)}%
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

export async function renderDepartmentsProfitabilityTab(body, container, timeFilter, selectedCos) {
  body.innerHTML = `
    <div style="direction:rtl;display:flex;flex-direction:column;gap:20px;padding:4px 0;">
      <!-- Loading Placeholder -->
      <div id="prof-loading" style="text-align:center;padding:80px 20px;color:rgba(255,255,255,0.5);font-size:1.1rem;">
        <span class="spin-icon" style="display:inline-block;animation:bi-spin 0.8s linear infinite;margin-left:8px;font-size:1.4rem;">⏳</span>
        جاري تحميل تقرير الأقسام والربحية...
      </div>
      <div id="prof-main-content" style="display:none;flex-direction:column;gap:22px;"></div>
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
    const data = await api.getDepartmentsProfitability({
      companyIds: companyIdsParam,
      years: periodParams.years,
      dateFrom: periodParams.dateFrom,
      dateTo: periodParams.dateTo,
      measure: currentMeasure,
      timeGrain: currentTimeGrain,
      redistributeAdmin: currentRedistribute
    });

    currentData = data;
    if (loadingEl) loadingEl.style.display = 'none';
    if (contentEl) {
      contentEl.style.display = 'flex';
      renderContent(contentEl, body, container, timeFilter, selectedCos, data);
    }
  } catch (err) {
    console.error('[Profitability] Failed to load data:', err);
    if (loadingEl) {
      loadingEl.innerHTML = `
        <div style="color:#ef4444;font-size:1.05rem;">
          ❌ حدث خطأ أثناء تحميل بيانات الأقسام والربحية: ${escapeHtml(err.message || 'خطأ غير متوقع')}
        </div>
      `;
    }
  }
}

function renderContent(contentEl, body, container, timeFilter, selectedCos, data) {
  const s = data.summary || {};
  const measureLabels = {
    net: 'صافي الربح',
    revenue: 'الإيرادات',
    expense: 'المصروفات'
  };

  contentEl.innerHTML = `
    <!-- Top Toolbar: Controls & Filters -->
    <div style="background:var(--exec-card-bg, rgba(255,255,255,0.03));border:1px solid var(--exec-border, rgba(255,255,255,0.08));border-radius:14px;padding:16px 20px;display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:14px;">
      
      <!-- Measure & Grain Selectors -->
      <div style="display:flex;align-items:center;flex-wrap:wrap;gap:12px;">
        
        <!-- Measure Selector -->
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:0.85rem;color:rgba(255,255,255,0.6);font-weight:600;">المقياس:</span>
          <div class="bi-btn-group" style="display:inline-flex;background:rgba(255,255,255,0.05);padding:3px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);">
            <button class="prof-measure-btn ${currentMeasure === 'net' ? 'active' : ''}" data-measure="net"
              style="border:none;border-radius:6px;padding:5px 12px;font-size:0.82rem;font-weight:700;cursor:pointer;background:${currentMeasure === 'net' ? 'var(--exec-accent, #3b82f6)' : 'transparent'};color:${currentMeasure === 'net' ? '#fff' : 'rgba(255,255,255,0.7)'};">
              📈 صافي الربح
            </button>
            <button class="prof-measure-btn ${currentMeasure === 'revenue' ? 'active' : ''}" data-measure="revenue"
              style="border:none;border-radius:6px;padding:5px 12px;font-size:0.82rem;font-weight:700;cursor:pointer;background:${currentMeasure === 'revenue' ? 'var(--exec-accent, #3b82f6)' : 'transparent'};color:${currentMeasure === 'revenue' ? '#fff' : 'rgba(255,255,255,0.7)'};">
              💰 الإيرادات
            </button>
            <button class="prof-measure-btn ${currentMeasure === 'expense' ? 'active' : ''}" data-measure="expense"
              style="border:none;border-radius:6px;padding:5px 12px;font-size:0.82rem;font-weight:700;cursor:pointer;background:${currentMeasure === 'expense' ? 'var(--exec-accent, #3b82f6)' : 'transparent'};color:${currentMeasure === 'expense' ? '#fff' : 'rgba(255,255,255,0.7)'};">
              📉 المصروفات
            </button>
          </div>
        </div>

        <!-- Grain Selector -->
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:0.85rem;color:rgba(255,255,255,0.6);font-weight:600;">التدرج:</span>
          <div class="bi-btn-group" style="display:inline-flex;background:rgba(255,255,255,0.05);padding:3px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);">
            <button class="prof-grain-btn ${currentTimeGrain === 'year' ? 'active' : ''}" data-grain="year"
              style="border:none;border-radius:6px;padding:5px 10px;font-size:0.82rem;font-weight:700;cursor:pointer;background:${currentTimeGrain === 'year' ? 'rgba(59,130,246,0.25)' : 'transparent'};color:${currentTimeGrain === 'year' ? '#60a5fa' : 'rgba(255,255,255,0.7)'};">
              سنوي
            </button>
            <button class="prof-grain-btn ${currentTimeGrain === 'quarter' ? 'active' : ''}" data-grain="quarter"
              style="border:none;border-radius:6px;padding:5px 10px;font-size:0.82rem;font-weight:700;cursor:pointer;background:${currentTimeGrain === 'quarter' ? 'rgba(59,130,246,0.25)' : 'transparent'};color:${currentTimeGrain === 'quarter' ? '#60a5fa' : 'rgba(255,255,255,0.7)'};">
              ربع سنوي
            </button>
            <button class="prof-grain-btn ${currentTimeGrain === 'month' ? 'active' : ''}" data-grain="month"
              style="border:none;border-radius:6px;padding:5px 10px;font-size:0.82rem;font-weight:700;cursor:pointer;background:${currentTimeGrain === 'month' ? 'rgba(59,130,246,0.25)' : 'transparent'};color:${currentTimeGrain === 'month' ? '#60a5fa' : 'rgba(255,255,255,0.7)'};">
              شهري
            </button>
          </div>
        </div>

        <!-- Administrative Expense Redistribution Switch -->
        <label style="display:inline-flex;align-items:center;gap:8px;cursor:pointer;background:rgba(255,255,255,0.04);border:1px solid ${currentRedistribute ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.1)'};padding:5px 12px;border-radius:8px;transition:all 0.2s;" title="توزيع مصروفات المراكز الإدارية (مثل الإدارة العامة) تناسبياً على مراكز العمليات">
          <input type="checkbox" id="prof-redist-toggle" ${currentRedistribute ? 'checked' : ''} style="cursor:pointer;accent-color:#f59e0b;width:15px;height:15px;">
          <span style="font-size:0.84rem;font-weight:700;color:${currentRedistribute ? '#f59e0b' : 'rgba(255,255,255,0.8)'};">
            🔄 توزيع المصروفات الإدارية
          </span>
        </label>
      </div>

      <!-- Action Buttons -->
      <div style="display:flex;align-items:center;gap:10px;">
        <button id="prof-btn-expand-all" style="background:rgba(59,130,246,0.1);color:#60a5fa;border:1px solid rgba(59,130,246,0.25);border-radius:8px;padding:6px 12px;font-size:0.82rem;font-weight:700;cursor:pointer;">
          📂 توسيع الكل
        </button>
        <button id="prof-btn-collapse-all" style="background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.7);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:6px 12px;font-size:0.82rem;font-weight:700;cursor:pointer;">
          📁 طي الكل
        </button>
        <button id="prof-btn-export-excel" style="background:rgba(16,185,129,0.12);color:#10b981;border:1px solid rgba(16,185,129,0.25);border-radius:8px;padding:6px 12px;font-size:0.82rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;">
          📥 تصدير Excel
        </button>
      </div>
    </div>

    <!-- KPI Summary Cards (5 cards) -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:14px;">
      
      <!-- Card 1: Revenue -->
      <div class="exec-kpi-card" style="background:linear-gradient(135deg, rgba(59,130,246,0.12), rgba(59,130,246,0.02));border:1px solid rgba(59,130,246,0.25);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:6px;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:0.85rem;color:rgba(255,255,255,0.65);font-weight:600;">إجمالي الإيرادات</span>
          <span style="font-size:1.15rem;">💰</span>
        </div>
        <div class="exec-num" style="font-size:1.45rem;font-weight:800;color:#60a5fa;">
          ${(s.total_revenue || 0).toLocaleString('en-US')}
        </div>
        <span style="font-size:0.75rem;color:rgba(255,255,255,0.45);">عن الفترة المحددة</span>
      </div>

      <!-- Card 2: Expenses -->
      <div class="exec-kpi-card" style="background:linear-gradient(135deg, rgba(239,68,68,0.12), rgba(239,68,68,0.02));border:1px solid rgba(239,68,68,0.25);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:6px;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:0.85rem;color:rgba(255,255,255,0.65);font-weight:600;">إجمالي المصروفات</span>
          <span style="font-size:1.15rem;">📉</span>
        </div>
        <div class="exec-num" style="font-size:1.45rem;font-weight:800;color:#f87171;">
          ${(s.total_expenses || 0).toLocaleString('en-US')}
        </div>
        <span style="font-size:0.75rem;color:rgba(255,255,255,0.45);">
          ${currentRedistribute ? 'تشمل المصروفات الإدارية الموزعة' : 'المصروفات الفعلية المباشرة'}
        </span>
      </div>

      <!-- Card 3: Net Profit -->
      <div class="exec-kpi-card" style="background:linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.02));border:1px solid rgba(16,185,129,0.25);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:6px;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:0.85rem;color:rgba(255,255,255,0.65);font-weight:600;">صافي الربح</span>
          <span style="font-size:1.15rem;">💎</span>
        </div>
        <div class="exec-num" style="font-size:1.45rem;font-weight:800;color:${(s.net_profit || 0) >= 0 ? '#10b981' : '#ef4444'};">
          ${(s.net_profit || 0) < 0 ? `(${Math.abs(s.net_profit).toLocaleString('en-US')})` : (s.net_profit || 0).toLocaleString('en-US')}
        </div>
        <span style="font-size:0.75rem;color:rgba(255,255,255,0.45);">الإيرادات − المصروفات</span>
      </div>

      <!-- Card 4: Profit Margin -->
      <div class="exec-kpi-card" style="background:linear-gradient(135deg, rgba(6,182,212,0.12), rgba(6,182,212,0.02));border:1px solid rgba(6,182,212,0.25);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:6px;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:0.85rem;color:rgba(255,255,255,0.65);font-weight:600;">هامش الربح</span>
          <span style="font-size:1.15rem;">📊</span>
        </div>
        <div class="exec-num" style="font-size:1.45rem;font-weight:800;color:${(s.profit_margin || 0) >= 0 ? '#06b6d4' : '#ef4444'};">
          ${(s.profit_margin || 0).toFixed(1)}%
        </div>
        <span style="font-size:0.75rem;color:rgba(255,255,255,0.45);">نسبة صافي الربح من الإيرادات</span>
      </div>

      <!-- Card 5: Admin Redistribution -->
      <div class="exec-kpi-card" style="background:linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.02));border:1px solid rgba(245,158,11,0.25);border-radius:14px;padding:16px;display:flex;flex-direction:column;gap:6px;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:0.85rem;color:rgba(255,255,255,0.65);font-weight:600;">المصروفات الإدارية القابلة للتوزيع</span>
          <span style="font-size:1.15rem;">🔄</span>
        </div>
        <div class="exec-num" style="font-size:1.45rem;font-weight:800;color:#f59e0b;">
          ${(s.admin_expenses_redistributed || 0).toLocaleString('en-US')}
        </div>
        <span style="font-size:0.75rem;color:${currentRedistribute ? '#10b981' : 'rgba(255,255,255,0.45)'};">
          ${currentRedistribute ? '✓ موزعة تناسبياً على الأقسام' : 'معروضة كمركز مستقل'}
        </span>
      </div>

    </div>

    <!-- TreeTable Section -->
    <div style="background:var(--exec-card-bg, rgba(255,255,255,0.02));border:1px solid var(--exec-border, rgba(255,255,255,0.08));border-radius:14px;padding:18px;display:flex;flex-direction:column;gap:14px;">
      
      <!-- Table Header Bar with Search -->
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <h3 style="margin:0;font-size:1.05rem;font-weight:800;color:var(--exec-text, #fff);">
            جدول الربحية الهرمي (${measureLabels[currentMeasure]})
          </h3>
          <span style="font-size:0.8rem;background:rgba(255,255,255,0.08);padding:2px 8px;border-radius:10px;color:rgba(255,255,255,0.6);">
            4 مستويات: الشركة ← القسم ← مركز التكلفة ← الحساب
          </span>
        </div>

        <!-- Search Bar -->
        <div style="position:relative;min-width:240px;">
          <input type="text" id="prof-tree-search" placeholder="بحث بالاسم أو المركز أو الحساب..." value="${escapeHtml(currentSearchQuery)}"
            style="width:100%;padding:6px 12px 6px 30px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:8px;color:#fff;font-size:0.84rem;outline:none;">
          <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:rgba(255,255,255,0.4);font-size:0.85rem;">🔍</span>
        </div>
      </div>

      <!-- TreeTable Container -->
      <div id="prof-tree-container" style="overflow-x:auto;border:1px solid var(--exec-border, rgba(255,255,255,0.08));border-radius:12px;"></div>
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
    initProfitabilityTreeTable(treeContainer, data);
  }

  // Search Input
  const searchInput = contentEl.querySelector('#prof-tree-search');
  searchInput?.addEventListener('input', (e) => {
    currentSearchQuery = e.target.value.trim().toLowerCase();
    filterProfitabilityTree(currentSearchQuery);
  });

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

function initProfitabilityTreeTable(container, data) {
  const periodCols = data.columns || [];
  const treeData = data.tree || [];
  const totals = data.totals || {};

  const columns = [
    { id: 'name', label: 'البيان / الهيكل الهرمي', minWidth: 'min(46vw, 240px)', align: 'right', priority: 1 },
    ...periodCols.map((col, idx) => ({
      id: col.key,
      label: col.label,
      align: 'left',
      minWidth: '115px',
      priority: (periodCols.length > 2 && idx < periodCols.length - 2) ? 2 : 1
    })),
    { id: 'total', label: 'الإجمالي', align: 'left', minWidth: '120px', priority: 1 }
  ];

  if (currentMeasure === 'net') {
    columns.push({ id: 'margin', label: 'هامش الربح', align: 'center', minWidth: '95px', priority: 2 });
  }

  currentTreeTable = createTreeTable(container, {
    storageKey: 'mizaniat_prof_tree_expanded',
    columns,
    data: treeData,
    totals,
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
      const icon = hasKids ? (isExpanded ? '▼' : '▶') : '•';

      let namePrefix = '';
      if (isCo) namePrefix = '🏢 ';
      else if (isDept) namePrefix = '📁 ';
      else if (isCC) namePrefix = '🏷️ ';
      else if (isAcc) namePrefix = '📄 ';

      const rowBg = isCo
        ? 'background:rgba(59,130,246,0.06);font-weight:800;'
        : (isDept ? 'background:rgba(255,255,255,0.02);font-weight:700;' : '');

      const cursor = hasKids ? 'cursor:pointer;' : '';

      return `
        <tr data-tree-row="true" data-path-key="${escapeHtml(pathKey)}" style="${cursor} ${rowBg}">
          <td class="tree-col-name" data-col-id="name" data-priority="1" style="padding-right:${indent + 14}px;">
            <span data-tree-toggle="true" style="display:inline-block;width:18px;color:var(--exec-text-muted, rgba(255,255,255,0.4));font-size:0.85rem;">${icon}</span>
            ${namePrefix}
            <span style="${isCC ? 'color:#60a5fa;' : ''}">${escapeHtml(node.name || '')}</span>
            ${node.is_redistributable ? '<span style="font-size:0.72rem;padding:2px 6px;border-radius:4px;background:rgba(245,158,11,0.15);color:#f59e0b;margin-right:6px;">إداري 🔄</span>' : ''}
            ${isAcc && node.code ? `<span style="font-size:0.75rem;color:rgba(255,255,255,0.4);margin-right:6px;">(${escapeHtml(node.code)})</span>` : ''}
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
        </tr>
      `;
    }
  });
}

function filterProfitabilityTree(query) {
  if (!currentTreeTable || !currentData) return;
  if (!query) {
    currentTreeTable.setData(currentData.tree, currentData.totals);
    return;
  }

  const matches = (str) => str && String(str).toLowerCase().includes(query);

  const filterNode = (node) => {
    let nodeMatches = matches(node.name) || matches(node.code);

    let filteredKids = null;
    if (node.departments) {
      filteredKids = node.departments.map(filterNode).filter(Boolean);
      if (filteredKids.length > 0) nodeMatches = true;
      if (nodeMatches) return { ...node, departments: filteredKids };
    } else if (node.costCenters) {
      filteredKids = node.costCenters.map(filterNode).filter(Boolean);
      if (filteredKids.length > 0) nodeMatches = true;
      if (nodeMatches) return { ...node, costCenters: filteredKids };
    } else if (node.accounts) {
      filteredKids = node.accounts.map(filterNode).filter(Boolean);
      if (filteredKids.length > 0) nodeMatches = true;
      if (nodeMatches) return { ...node, accounts: filteredKids };
    }

    return nodeMatches ? node : null;
  };

  const filteredTree = (currentData.tree || []).map(filterNode).filter(Boolean);
  currentTreeTable.setData(filteredTree, currentData.totals);

  // Auto-expand all matching nodes
  const expandKeys = [];
  const collectKeys = (node, parentPath, depth) => {
    const k = currentTreeTable.getNodeKey(node, parentPath, depth);
    expandKeys.push(k);
    const kids = currentTreeTable.getChildren(node) || [];
    for (const kid of kids) collectKeys(kid, k, depth + 1);
  };
  for (const root of filteredTree) collectKeys(root, '', 0);
  currentTreeTable.expandAll(expandKeys);
}

function exportProfitabilityToExcel(data) {
  if (!data) return;
  const cols = data.columns || [];
  const headers = ['المستوى', 'الاسم', 'الكود', ...cols.map(c => c.label), 'الإجمالي'];
  if (currentMeasure === 'net') headers.push('هامش الربح %');

  const rows = [];

  const traverse = (node, levelName) => {
    const row = [
      levelName,
      `"${(node.name || '').replace(/"/g, '""')}"`,
      `"${node.code || ''}"`,
      ...cols.map(c => node.values?.[c.key] || 0),
      node.total || 0
    ];
    if (currentMeasure === 'net') row.push(node.margin !== undefined ? `${node.margin}%` : '');
    rows.push(row.join(','));

    const kids = node.departments || node.costCenters || node.accounts || [];
    const nextLevel = levelName === 'شركة' ? 'قسم' : (levelName === 'قسم' ? 'مركز تكلفة' : 'حساب');
    for (const k of kids) traverse(k, nextLevel);
  };

  for (const co of (data.tree || [])) traverse(co, 'شركة');

  // Totals row
  const totVals = data.totals?.values || {};
  const totRow = [
    'المجموع الكلي',
    'إجمالي المجموعة',
    '',
    ...cols.map(c => totVals[c.key] || 0),
    data.totals?.total || 0
  ];
  if (currentMeasure === 'net') {
    const rev = data.totals?.revenue || 0;
    const net = data.totals?.net || 0;
    totRow.push(rev > 0 ? `${(net / rev * 100).toFixed(1)}%` : '0%');
  }
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
