import { api } from '../api.js';
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
  return `${Number(rate).toFixed(1)}%`;
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

export async function renderCustomersCollectionTab(body, container, timeFilter, selectedCos) {
  body.innerHTML = `
    <div style="direction:rtl;display:flex;flex-direction:column;gap:20px;padding:4px 0;">
      <!-- Loading Placeholder -->
      <div id="cust-loading" style="text-align:center;padding:80px 20px;color:rgba(255,255,255,0.5);font-size:1.1rem;">
        <span class="spin-icon" style="display:inline-block;animation:bi-spin 0.8s linear infinite;margin-left:8px;font-size:1.4rem;">⏳</span>
        جاري تحميل تقرير العملاء والتحصيل الموحّد...
      </div>
      <div id="cust-main-content" style="display:none;flex-direction:column;gap:22px;"></div>
    </div>
  `;

  const periodParams = getPeriodParamsFromFilter(timeFilter);
  const companyIdsParam = (selectedCos && selectedCos.length > 0) ? selectedCos.join(',') : undefined;

  try {
    const data = await api.getCustomersCollection({
      companyIds: companyIdsParam,
      years: periodParams.years,
      dateFrom: periodParams.dateFrom,
      dateTo: periodParams.dateTo
    });

    currentData = data;
    const loadingEl = body.querySelector('#cust-loading');
    const contentEl = body.querySelector('#cust-main-content');
    if (loadingEl) loadingEl.style.display = 'none';
    if (contentEl) {
      contentEl.style.display = 'flex';
      renderContent(contentEl, container, data, periodParams, selectedCos);
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

function renderContent(contentEl, container, data, periodParams, selectedCos) {
  const totals = data.totals || {};
  const meta = data.meta || {};
  const buckets = totals.buckets || {};
  const totalResidual = totals.total_residual || 0;

  contentEl.innerHTML = `
    <!-- Top KPI Cards -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:16px;">
      
      <!-- 1. Billed -->
      <div style="background:var(--exec-bg-card, rgba(255,255,255,0.03));border:1px solid var(--exec-border, rgba(255,255,255,0.08));border-radius:14px;padding:18px 20px;border-right:4px solid #3b82f6;display:flex;flex-direction:column;gap:6px;">
        <span style="font-size:0.9rem;font-weight:700;color:var(--exec-text-muted, rgba(255,255,255,0.55));">إجمالي المفوتر</span>
        <div style="font-size:1.75rem;font-weight:900;color:#3b82f6;" class="exec-num">${(totals.total_billed || 0).toLocaleString('en-US')}</div>
        <span style="font-size:0.78rem;color:var(--exec-text-muted, rgba(255,255,255,0.45));">الفواتير الصادرة شاملة الضريبة</span>
      </div>

      <!-- 2. Returns -->
      <div style="background:var(--exec-bg-card, rgba(255,255,255,0.03));border:1px solid var(--exec-border, rgba(255,255,255,0.08));border-radius:14px;padding:18px 20px;border-right:4px solid #f59e0b;display:flex;flex-direction:column;gap:6px;">
        <span style="font-size:0.9rem;font-weight:700;color:var(--exec-text-muted, rgba(255,255,255,0.55));">المرتجعات والإشعارات</span>
        <div style="font-size:1.75rem;font-weight:900;color:#f59e0b;" class="exec-num">${(totals.total_returns || 0).toLocaleString('en-US')}</div>
        <span style="font-size:0.78rem;color:var(--exec-text-muted, rgba(255,255,255,0.45));">${(data.returns_list || []).length} إشعار دائن ومرتجع</span>
      </div>

      <!-- 3. Net Billed -->
      <div style="background:var(--exec-bg-card, rgba(255,255,255,0.03));border:1px solid var(--exec-border, rgba(255,255,255,0.08));border-radius:14px;padding:18px 20px;border-right:4px solid #8b5cf6;display:flex;flex-direction:column;gap:6px;">
        <span style="font-size:0.9rem;font-weight:700;color:var(--exec-text-muted, rgba(255,255,255,0.55));">الصافي بعد المرتجعات</span>
        <div style="font-size:1.75rem;font-weight:900;color:#a78bfa;" class="exec-num">${(totals.total_net || 0).toLocaleString('en-US')}</div>
        <span style="font-size:0.78rem;color:var(--exec-text-muted, rgba(255,255,255,0.45));">المفوتر − المرتجعات</span>
      </div>

      <!-- 4. Collected -->
      <div style="background:var(--exec-bg-card, rgba(255,255,255,0.03));border:1px solid var(--exec-border, rgba(255,255,255,0.08));border-radius:14px;padding:18px 20px;border-right:4px solid #10b981;display:flex;flex-direction:column;gap:6px;">
        <span style="font-size:0.9rem;font-weight:700;color:var(--exec-text-muted, rgba(255,255,255,0.55));">المحصّل الفعلي</span>
        <div style="font-size:1.75rem;font-weight:900;color:#10b981;" class="exec-num">${(totals.total_collected || 0).toLocaleString('en-US')}</div>
        <span style="font-size:0.78rem;color:var(--exec-text-muted, rgba(255,255,255,0.45));">الصافي − المتبقي</span>
      </div>

      <!-- 5. Remaining / Residual -->
      <div style="background:var(--exec-bg-card, rgba(255,255,255,0.03));border:1px solid var(--exec-border, rgba(255,255,255,0.08));border-radius:14px;padding:18px 20px;border-right:4px solid #ef4444;display:flex;flex-direction:column;gap:6px;">
        <span style="font-size:0.9rem;font-weight:700;color:var(--exec-text-muted, rgba(255,255,255,0.55));">المتبقي للتحصيل</span>
        <div style="font-size:1.75rem;font-weight:900;color:#ef4444;" class="exec-num">${(totals.total_residual || 0).toLocaleString('en-US')}</div>
        <span style="font-size:0.78rem;color:var(--exec-text-muted, rgba(255,255,255,0.45));">أرصدة الذمم المتبقية</span>
      </div>

      <!-- 6. Collection Rate -->
      <div style="background:var(--exec-bg-card, rgba(255,255,255,0.03));border:1px solid var(--exec-border, rgba(255,255,255,0.08));border-radius:14px;padding:18px 20px;border-right:4px solid #06b6d4;display:flex;flex-direction:column;gap:6px;">
        <span style="font-size:0.9rem;font-weight:700;color:var(--exec-text-muted, rgba(255,255,255,0.55));">نسبة التحصيل</span>
        <div style="font-size:1.75rem;font-weight:900;color:#06b6d4;" class="exec-num">${totals.collection_rate || 0}%</div>
        <div style="width:100%;height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;margin-top:2px;">
          <div style="width:${Math.min(100, totals.collection_rate || 0)}%;height:100%;background:#06b6d4;"></div>
        </div>
      </div>

      <!-- 7. Overdue +90 Days -->
      <div style="background:var(--exec-bg-card, rgba(255,255,255,0.03));border:1px solid var(--exec-border, rgba(255,255,255,0.08));border-radius:14px;padding:18px 20px;border-right:4px solid #f43f5e;display:flex;flex-direction:column;gap:6px;">
        <span style="font-size:0.9rem;font-weight:700;color:var(--exec-text-muted, rgba(255,255,255,0.55));">متأخرات حرجة (+90 يوم)</span>
        <div style="font-size:1.75rem;font-weight:900;color:#f43f5e;" class="exec-num">${(totals.overdue_90 || 0).toLocaleString('en-US')}</div>
        <span style="font-size:0.78rem;color:var(--exec-text-muted, rgba(255,255,255,0.45));">
          ${totalResidual > 0 ? ((totals.overdue_90 / totalResidual) * 100).toFixed(1) : 0}% من المتبقي
        </span>
      </div>

    </div>

    <!-- Collapsible 1: Aging Buckets (مطوية) -->
    <div style="background:var(--exec-bg-card, rgba(255,255,255,0.03));border:1px solid var(--exec-border, rgba(255,255,255,0.08));border-radius:14px;padding:16px 20px;display:flex;flex-direction:column;gap:14px;">
      <div id="cust-aging-toggle" style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:1.05rem;font-weight:800;color:var(--exec-text, #fff);">⏳ توزيع أعمار الذمم (الشرائح السبع)</span>
          <span id="cust-aging-badge" style="font-size:0.82rem;color:#3b82f6;background:rgba(59,130,246,0.12);padding:2px 10px;border-radius:6px;font-weight:700;">
            ${isAgingOpen ? 'إخفاء ▲' : 'عرض الشرائح ▾'}
          </span>
        </div>
        <span style="font-size:0.88rem;color:var(--exec-text-muted, rgba(255,255,255,0.55));font-weight:700;">
          إجمالي المتبقي: <strong class="exec-num" style="color:#ef4444;">${Math.round(totalResidual).toLocaleString('en-US')} ريال</strong>
        </span>
      </div>

      <div id="cust-aging-body" style="display:${isAgingOpen ? 'grid' : 'none'};grid-template-columns:repeat(auto-fit, minmax(130px, 1fr));gap:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);">
        ${renderAgingBucketsGrid(buckets, totalResidual)}
      </div>
    </div>

    <!-- Collapsible 2: Returns List (مطوية) -->
    <div style="background:var(--exec-bg-card, rgba(255,255,255,0.03));border:1px solid var(--exec-border, rgba(255,255,255,0.08));border-radius:14px;padding:16px 20px;display:flex;flex-direction:column;gap:14px;">
      <div id="cust-returns-toggle" style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:1.05rem;font-weight:800;color:var(--exec-text, #fff);">↩️ قائمة المرتجعات والإشعارات الدائنة</span>
          <span id="cust-returns-badge" style="font-size:0.82rem;color:#f59e0b;background:rgba(245,158,11,0.12);padding:2px 10px;border-radius:6px;font-weight:700;">
            ${isReturnsOpen ? 'إخفاء ▲' : `عرض (${(data.returns_list || []).length}) ▾`}
          </span>
        </div>
        <span style="font-size:0.88rem;color:var(--exec-text-muted, rgba(255,255,255,0.55));font-weight:700;">
          إجمالي المرتجعات: <strong class="exec-num" style="color:#f59e0b;">${Math.round(totals.total_returns || 0).toLocaleString('en-US')} ريال</strong>
        </span>
      </div>

      <div id="cust-returns-body" style="display:${isReturnsOpen ? 'flex' : 'none'};flex-direction:column;gap:12px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.06);">
        <!-- Filter bar for returns -->
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <input type="text" id="cust-returns-search" placeholder="🔍 بحث في المرتجعات (رقم المستند، العميل، القسم...)" 
            value="${escapeHtml(returnsSearchQuery)}" 
            style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:6px 14px;color:#fff;font-size:0.88rem;width:340px;max-width:100%;">
          <span style="font-size:0.82rem;color:var(--exec-text-muted, rgba(255,255,255,0.5));">
            * المرتجعات تخصم مباشرة من المفوتر ولا تحتسب كتحصيل نقدي
          </span>
        </div>
        <div id="cust-returns-table-wrapper" style="overflow-x:auto;max-height:360px;">
          ${renderReturnsTable(data.returns_list || [], returnsSearchQuery)}
        </div>
      </div>
    </div>

    <!-- Main Section: 4-Level Hierarchical TreeTable -->
    <div style="background:var(--exec-bg-card, rgba(255,255,255,0.03));border:1px solid var(--exec-border, rgba(255,255,255,0.08));border-radius:16px;padding:22px;display:flex;flex-direction:column;gap:16px;">
      
      <!-- Table Header & Controls -->
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;">
        <div>
          <h3 style="margin:0;font-size:1.15rem;font-weight:800;color:var(--exec-text, #fff);">
            👥 سجل العملاء والتحصيل الهرمي — ${escapeHtml(meta.period_label || '')}
          </h3>
          <span style="font-size:0.85rem;color:var(--exec-text-muted, rgba(255,255,255,0.5));">
            الشركة ← القسم ← العميل ← الفاتورة | النقر على العميل أو زر كشف الحساب يفتح كشف الحساب المتسلسل
          </span>
        </div>

        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <input type="text" id="cust-tree-search" placeholder="🔍 تصفية بالعميل أو القسم..." 
            value="${escapeHtml(mainSearchQuery)}"
            style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:6px 14px;color:#fff;font-size:0.88rem;width:240px;">
          
          <button id="cust-btn-expand-all" style="background:rgba(59,130,246,0.1);color:#60a5fa;border:1px solid rgba(59,130,246,0.25);border-radius:8px;padding:6px 12px;font-size:0.82rem;font-weight:700;cursor:pointer;">
            📂 توسيع الكل
          </button>
          <button id="cust-btn-collapse-all" style="background:rgba(255,255,255,0.05);color:rgba(255,255,255,0.7);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:6px 12px;font-size:0.82rem;font-weight:700;cursor:pointer;">
            📁 طي الكل
          </button>
        </div>
      </div>

      <!-- TreeTable Mount Point -->
      <div id="cust-tree-container" style="overflow-x:auto;border:1px solid var(--exec-border, rgba(255,255,255,0.08));border-radius:12px;"></div>
    </div>

    <!-- Statement Slide-over / Modal Container -->
    <div id="cust-statement-modal" style="display:none;position:fixed;inset:0;z-index:2000;background:rgba(0,0,0,0.75);backdrop-filter:blur(8px);align-items:center;justify-content:center;padding:20px;">
      <div id="cust-statement-card" style="background:linear-gradient(180deg, #1e293b, #0f172a);border:1px solid rgba(255,255,255,0.15);border-radius:18px;width:1100px;max-width:96vw;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 25px 50px -12px rgba(0,0,0,0.5);overflow:hidden;">
        <!-- Header -->
        <div style="padding:18px 24px;border-bottom:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.02);">
          <div style="display:flex;align-items:center;gap:12px;">
            <span style="font-size:1.6rem;">📄</span>
            <div>
              <h3 id="stmt-partner-name" style="margin:0;font-size:1.2rem;font-weight:800;color:#fff;">كشف حساب عميل</h3>
              <span id="stmt-meta-info" style="font-size:0.84rem;color:rgba(255,255,255,0.55);">—</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            <button id="stmt-btn-pdf" style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.35);border-radius:8px;padding:7px 16px;font-size:0.85rem;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;">
              📥 تصدير PDF
            </button>
            <button id="stmt-btn-close" style="background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:7px 14px;font-size:0.85rem;font-weight:700;cursor:pointer;">
              ✕ إغلاق
            </button>
          </div>
        </div>

        <!-- Statement Body -->
        <div id="stmt-content-body" style="padding:22px 24px;overflow-y:auto;display:flex;flex-direction:column;gap:18px;">
          <!-- Injected dynamically -->
        </div>
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
  treeSearchInput?.addEventListener('input', (e) => {
    mainSearchQuery = e.target.value.trim().toLowerCase();
    filterTreeTable(mainSearchQuery);
  });

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
  { id: 'name', label: 'البيان / الهيكل', minWidth: 'min(46vw, 240px)', align: 'right', priority: 1 },
  { id: 'billed', label: 'المفوتر', align: 'left', minWidth: '115px', priority: 1 },
  { id: 'returns', label: 'المرتجعات', align: 'left', minWidth: '105px', priority: 2 },
  { id: 'net', label: 'الصافي', align: 'left', minWidth: '115px', priority: 1 },
  { id: 'collected', label: 'المحصّل', align: 'left', minWidth: '115px', priority: 1 },
  { id: 'residual', label: 'المتبقي', align: 'left', minWidth: '115px', color: '#ef4444', priority: 1 },
  { id: 'collection_rate', label: '% التحصيل', align: 'center', minWidth: '100px', priority: 2 },
  { id: 'avg_age', label: 'عمر الدين', align: 'center', minWidth: '85px', priority: 2 },
  { id: 'actions', label: 'إجراءات', align: 'center', minWidth: '95px', priority: 1 }
];

function initTreeTable(container, data, periodParams) {
  const treeData = data.tree || [];
  const totals = data.totals || {};

  currentTreeTable = createTreeTable(container, {
    storageKey: 'mizaniat_cust_tree_expanded',
    columns: mainColumns,
    data: treeData,
    totals,
    getNodeKey: (node, parentPath, depth) => {
      const type = node.type || (depth === 0 ? 'co' : depth === 1 ? 'dept' : depth === 2 ? 'partner' : 'inv');
      const id = node.id !== undefined ? String(node.id) : (node.name || 'item');
      return parentPath ? `${parentPath}/${type}:${id}` : `${type}:${id}`;
    },
    getChildren: (node) => {
      return node.departments || node.partners || node.invoices || node.children || [];
    },
    hasChildren: (node) => {
      if (node.departments && node.departments.length > 0) return true;
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
            return {
              id: inv.id,
              name: inv.invoice_name,
              invoice_name: inv.invoice_name,
              type: 'invoice',
              isLeaf: true,
              invoice_date: inv.invoice_date,
              due_date: inv.due_date,
              payment_state: inv.payment_state,
              billed: Math.round(billed),
              returns: Math.round(returns),
              net: Math.round(net),
              collected: Math.round(collected),
              residual: Math.round(residual),
              collection_rate: rate,
              avg_age: inv.age_days || 0,
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
      const isPartner = depth === 2 || node.type === 'partner';
      const isInvoice = depth === 3 || node.type === 'invoice';

      const indent = depth * 22;
      const icon = node._loading ? '⏳' : hasKids ? (isExpanded ? '▼' : '▶') : '•';

      let namePrefix = '';
      if (isCo) namePrefix = '🏢 ';
      else if (isDept) namePrefix = '📁 ';
      else if (isPartner) namePrefix = '👤 ';
      else if (isInvoice) namePrefix = node.isReturn ? '↩️ ' : '📄 ';

      const rowBg = isCo
        ? 'background:rgba(59,130,246,0.06);font-weight:800;'
        : (isDept ? 'background:rgba(255,255,255,0.02);font-weight:700;' : '');

      const cursor = hasKids ? 'cursor:pointer;' : (isPartner ? 'cursor:pointer;' : '');

      // Action button for customer
      let actionCell = '—';
      if (isPartner) {
        actionCell = `
          <button class="btn-stmt-trigger" data-co="${node.company_id}" data-pid="${node.id}" data-dept="${node.department_id || ''}" 
            style="background:rgba(59,130,246,0.12);color:#60a5fa;border:1px solid rgba(59,130,246,0.3);border-radius:6px;padding:3px 8px;font-size:0.75rem;font-weight:700;cursor:pointer;white-space:nowrap;">
            📄 كشف حساب
          </button>
        `;
      } else if (isInvoice) {
        actionCell = `
          <span style="font-size:0.72rem;padding:2px 6px;border-radius:4px;background:${node.payment_state === 'paid' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'};color:${node.payment_state === 'paid' ? '#10b981' : '#ef4444'};">
            ${node.payment_state === 'paid' ? 'مسدد' : 'متبقي'}
          </span>
        `;
      }

      return `
        <tr data-tree-row="true" data-path-key="${escapeHtml(pathKey)}" style="${cursor} ${rowBg}">
          <td class="tree-col-name" data-col-id="name" data-priority="1" style="padding-right:${indent + 14}px;">
            <span data-tree-toggle="true" style="display:inline-block;width:18px;color:var(--exec-text-muted, rgba(255,255,255,0.4));font-size:0.85rem;">${icon}</span>
            ${namePrefix}
            <span style="${isPartner ? 'color:#60a5fa;font-weight:700;' : ''}">${escapeHtml(node.name || '')}</span>
            ${isInvoice ? `<span style="font-size:0.75rem;color:rgba(255,255,255,0.4);margin-right:6px;">(${escapeHtml(node.invoice_date || '')})</span>` : ''}
            ${node._loading ? `<span class="spin-icon" style="display:inline-block;animation:bi-spin 0.8s linear infinite;margin-right:6px;">⏳</span>` : ''}
          </td>
          <td class="tree-col-num" data-col-id="billed" data-priority="1" style="text-align:left;">${fmtVal(node.billed)}</td>
          <td class="tree-col-num" data-col-id="returns" data-priority="2" style="text-align:left;color:#f59e0b;">${fmtVal(node.returns)}</td>
          <td class="tree-col-num" data-col-id="net" data-priority="1" style="text-align:left;font-weight:700;">${fmtVal(node.net)}</td>
          <td class="tree-col-num" data-col-id="collected" data-priority="1" style="text-align:left;color:#10b981;">${fmtVal(node.collected)}</td>
          <td class="tree-col-num" data-col-id="residual" data-priority="1" style="text-align:left;color:#ef4444;font-weight:700;">${fmtVal(node.residual)}</td>
          <td class="tree-col-num" data-col-id="collection_rate" data-priority="2" style="text-align:center;">
            ${node.collection_rate !== null && node.collection_rate !== undefined ? `
              <div style="display:flex;align-items:center;justify-content:center;gap:6px;">
                <span class="exec-num" style="font-size:0.82rem;font-weight:700;">${fmtRate(node.collection_rate)}</span>
                <div style="width:36px;height:4px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden;">
                  <div style="width:${Math.min(100, node.collection_rate || 0)}%;height:100%;background:#06b6d4;"></div>
                </div>
              </div>
            ` : '—'}
          </td>
          <td class="tree-col-num" data-col-id="avg_age" data-priority="2" style="text-align:center;">
            ${(node.avg_age || 0) > 0 ? `
              <span class="exec-num" style="font-size:0.8rem;padding:2px 6px;border-radius:4px;background:${node.avg_age > 90 ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)'};color:${node.avg_age > 90 ? '#ef4444' : 'inherit'};">
                ${node.avg_age} يوم
              </span>
            ` : '—'}
          </td>
          <td class="tree-col-num" data-col-id="actions" data-priority="1" style="text-align:center;">
            ${actionCell}
          </td>
        </tr>
      `;
    },
    renderTotals: (totals) => {
      return `
        <tr style="background:rgba(59,130,246,0.12);font-weight:900;border-top:2px solid rgba(59,130,246,0.3);font-size:0.98rem;">
          <td class="tree-col-name" data-col-id="name" data-priority="1" style="padding:14px 18px;">المجموع الكلي للمجموعة</td>
          <td class="tree-col-num" data-col-id="billed" data-priority="1" style="text-align:left;padding:14px 18px;">${fmtVal(totals.total_billed)}</td>
          <td class="tree-col-num" data-col-id="returns" data-priority="2" style="text-align:left;padding:14px 18px;color:#f59e0b;">${fmtVal(totals.total_returns)}</td>
          <td class="tree-col-num" data-col-id="net" data-priority="1" style="text-align:left;padding:14px 18px;">${fmtVal(totals.total_net)}</td>
          <td class="tree-col-num" data-col-id="collected" data-priority="1" style="text-align:left;padding:14px 18px;color:#10b981;">${fmtVal(totals.total_collected)}</td>
          <td class="tree-col-num" data-col-id="residual" data-priority="1" style="text-align:left;padding:14px 18px;color:#ef4444;">${fmtVal(totals.total_residual)}</td>
          <td class="tree-col-num" data-col-id="collection_rate" data-priority="2" style="text-align:center;padding:14px 18px;color:#06b6d4;">${totals.collection_rate || 0}%</td>
          <td class="tree-col-num" data-col-id="avg_age" data-priority="2" style="text-align:center;padding:14px 18px;">—</td>
          <td class="tree-col-num" data-col-id="actions" data-priority="1" style="text-align:center;padding:14px 18px;">—</td>
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

function filterTreeTable(query) {
  if (!currentTreeTable || !currentData) return;
  const rawTree = currentData.tree || [];
  if (!query) {
    currentTreeTable.setData(rawTree, currentData.totals);
    return;
  }

  // Filter tree keeping parent hierarchy if customer or dept matches
  const filteredTree = [];
  for (const co of rawTree) {
    const matchingDepts = [];
    for (const dept of (co.departments || [])) {
      const deptMatches = dept.name && dept.name.toLowerCase().includes(query);
      const matchingPartners = (dept.partners || []).filter(p => 
        deptMatches || (p.name && p.name.toLowerCase().includes(query))
      );
      if (deptMatches || matchingPartners.length > 0) {
        matchingDepts.push({
          ...dept,
          partners: matchingPartners
        });
      }
    }
    if (matchingDepts.length > 0 || (co.name && co.name.toLowerCase().includes(query))) {
      filteredTree.push({
        ...co,
        departments: matchingDepts
      });
    }
  }

  currentTreeTable.setData(filteredTree, currentData.totals);
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
    <div style="text-align:center;padding:60px 20px;color:rgba(255,255,255,0.5);">
      <span class="spin-icon" style="display:inline-block;animation:bi-spin 0.8s linear infinite;font-size:1.4rem;">⏳</span>
      جاري تجميع حركات العميل والرصيد التراكمي...
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
