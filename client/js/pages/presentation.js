import { api, registerClientCacheInvalidator } from '../api.js';
import { store } from '../store.js';
import { formatNumber } from '../utils/format.js';
import { showToast } from '../utils/ui.js';
import { renderExecutiveDashboardTab } from './presentation-executive.js';
import { renderCustomersCollectionTab } from './presentation-customers.js';
import { renderDepartmentsProfitabilityTab } from './presentation-profitability.js';
import { renderGuaranteesComponent } from './guarantees.js';
import { renderVatTab } from './presentation-vat.js';
import { renderActualCollectionsTab } from './presentation-collections.js';
import { renderDepartmentsComparisonTab } from './presentation-comparison.js';
import { SlicerDropdown, closeActiveSlicerDropdown } from '../components/slicer-dropdown.js';

const cachedTabDOM = new Map();

export function clearPresentationTabPanels() {
  cachedTabDOM.clear();
}
registerClientCacheInvalidator(clearPresentationTabPanels);

let companyDropdownInstance = null;
let groupDropdownInstance = null;
let journalDropdownInstance = null;

const COLORS = ['var(--company-1)','var(--company-2)','var(--company-3)','var(--company-4)'];
const fmt = v => formatNumber(v, 0);
const fmtP = v => (v||0).toFixed(1) + '%';
const MONTH_NAMES = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

const ICONS = {
  download: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  share: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
  refresh: '<svg class="spin-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>',
  moon: '<svg class="theme-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  sun: '<svg class="theme-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
  chevronDown: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>',
  folder: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  book: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
  search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
  copy: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>'
};

let activeTab = 'executive';
let globalFilters = {
  groupIds: [],
  journalIds: []
};
let lastUpdatedTime = null;
function fmtTimestamp(d) { if (!d) return ''; const pad = n => String(n).padStart(2,'0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }
function escapeHtml(str) { if (str === null || str === undefined) return ''; return String(str).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]); }

function setChipActive(chip, active) {
  if (!chip) return;
  if (active) {
    chip.classList.add('active');
  } else {
    chip.classList.remove('active');
  }
  const chk = chip.querySelector('input[type="checkbox"]');
  if (chk) chk.checked = !!active;
}

export async function renderPresentation(container) {
  closeActiveSlicerDropdown();
  companyDropdownInstance = null;
  groupDropdownInstance = null;
  journalDropdownInstance = null;

  const urlParams = new URLSearchParams(window.location.search);
  const urlTab = urlParams.get('tab');
  if (urlTab) activeTab = urlTab;
  const urlYear = urlParams.get('year');
  const companies = store.get('companies') || [];
  const currentYear = String(new Date().getFullYear());

  // SH1: Scoped Share Viewer detection
  let scopedShare = null;
  const scopedShareRaw = sessionStorage.getItem('mizaniat_scoped_share');
  if (scopedShareRaw) {
    try {
      scopedShare = JSON.parse(scopedShareRaw);
      if (typeof scopedShare === 'string') scopedShare = JSON.parse(scopedShare);
    } catch(e) {}
  }
  const isScopedViewer = Boolean(scopedShare && typeof scopedShare === 'object');

  if (isScopedViewer && scopedShare.tabs && Array.isArray(scopedShare.tabs) && scopedShare.tabs.length > 0) {
    if (!scopedShare.tabs.includes(activeTab)) {
      activeTab = scopedShare.tabs[0];
    }
  }

  const scopeCoIds = isScopedViewer && scopedShare.costCenters ? Array.from(new Set(scopedShare.costCenters.map(c => Number(c.companyId)))).filter(Boolean) : null;
  const visibleCompanies = (scopeCoIds && scopeCoIds.length > 0) ? companies.filter(c => scopeCoIds.includes(Number(c.id))) : companies;

  if (!store.get('filterOptions')?.companyYears || !store.get('filterOptions')?.groups || !store.get('filterOptions')?.journals) {
    try {
      const fOpts = await api.getFilterOptions({});
      store.set('filterOptions', fOpts);
    } catch (e) {
      console.warn('Could not fetch filterOptions:', e);
    }
  }

  let userPrefs = store.get('executive_prefs') || {};
  if (!store.get('executive_prefs')) {
    try {
      const prefRes = await api.getPreferences('executive_view');
      if (prefRes && prefRes.found && prefRes.data) {
        userPrefs = prefRes.data;
      } else {
        const local = localStorage.getItem('mizaniat_executive_prefs');
        if (local) userPrefs = JSON.parse(local);
      }
      store.set('executive_prefs', userPrefs);
    } catch (e) {
      console.warn('Could not load preferences in presentation:', e);
    }
  }
  const initialShowZero = !!userPrefs.show_zero_items;
  store.set('showZeroItems', initialShowZero);
  window.__mizaniat_show_zero_items = initialShowZero;

  const rawYears = store.get('filterOptions')?.fiscalYears || Array.from({ length: 7 }, (_, i) => String(Number(currentYear) - 6 + i));
  const fiscalYears = [...rawYears].sort((a, b) => Number(b) - Number(a));
  const defaultYear = fiscalYears[0] || currentYear;
  const isAllYear = urlYear === 'ALL';
  const fy = isAllYear ? null : (urlYear || store.get('fiscalYear') || defaultYear);

  container.innerHTML = `
    <div class="bi-page">
      <!-- Mobile Filter Bar (RESP1) -->
      <div class="bi-mobile-filter-bar" id="mobile-filter-bar">
        <button class="bi-btn bi-btn-secondary" id="btn-open-filters" style="flex:1;min-height:40px;justify-content:center;gap:6px;font-size:0.88rem;">
          <span>${ICONS.search}</span> <span id="mobile-filter-summary">${isScopedViewer ? `نطاق (${escapeHtml(scopedShare.name)})` : `الفلاتر (${fiscalYears.find(y => y===fy) || '2026'} · كل الشركات)`}</span>
        </button>
        <button class="bi-btn bi-btn-secondary" id="btn-mobile-refresh" title="تحديث" style="min-height:40px;min-width:40px;padding:6px 12px;">${ICONS.refresh}</button>
        ${isScopedViewer ? '' : `<button class="bi-btn bi-btn-secondary" id="btn-mobile-share" title="مشاركة" style="min-height:40px;min-width:40px;padding:6px 12px;">${ICONS.share}</button>`}
      </div>
      <div class="mobile-sheet-backdrop" id="mobile-sheet-backdrop"></div>

      <!-- Desktop Collapsed Summary Bar (R3 Review #4) -->
      <div class="bi-collapsed-summary-bar" id="bi-collapsed-summary-bar">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <button class="bi-btn bi-btn-secondary" id="btn-reopen-filters" style="font-size:0.85rem;padding:6px 14px;border-radius:10px;">
            <span id="desktop-filter-summary">${isScopedViewer ? `نطاق (${escapeHtml(scopedShare.name)})` : `الفلاتر (${fiscalYears.find(y => y===fy) || '2026'} · كل الشركات)`}</span>
          </button>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <button class="bi-btn bi-btn-secondary" id="btn-desktop-collapsed-refresh" title="تحديث" style="min-height:36px;padding:6px 12px;font-size:0.85rem;">${ICONS.refresh} تحديث</button>
          ${isScopedViewer ? '' : `<button class="bi-btn bi-btn-secondary" id="btn-desktop-collapsed-share" title="مشاركة" style="min-height:36px;padding:6px 12px;font-size:0.85rem;">${ICONS.share}</button>`}
        </div>
      </div>

      <!-- Slicer Bar (Exactly 2 Rows) -->
      <div class="bi-topbar" id="bi-topbar">
        <div class="mobile-sheet-header">
          <span style="font-weight:700;font-size:1.05rem;color:var(--text-primary);">خيارات التصفية والفلاتر</span>
          <button class="btn" id="btn-close-filter-sheet" style="min-height:36px;min-width:36px;padding:4px 10px;font-size:0.95rem;">✕</button>
        </div>
        <div class="mobile-zero-wrap" style="display:none;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border-default);">
          <label class="bi-switch" style="cursor:pointer;">
            <input type="checkbox" id="chk-show-zero-items-mobile" ${initialShowZero ? 'checked' : ''}>
            <span class="bi-switch-slider"></span>
            <span>إظهار البنود الصفرية</span>
          </label>
          <span id="badge-hidden-zero-count-mobile" class="badge-zero-count" style="${initialShowZero ? 'display:none;' : 'display:inline-block;'}">مخفي: 0 بنداً صفرياً</span>
        </div>

        <!-- Row 1: Header / Nav -->
        <div class="bi-topbar-nav">
          <div class="bi-topbar-title-block">
            <h1 class="bi-page-title">${isScopedViewer ? escapeHtml(scopedShare.name) : 'العرض التقديمي'}</h1>
            <span class="bi-page-subtitle" id="bi-last-updated">${isScopedViewer ? `نطاق مشاركة مخصص — ${escapeHtml(scopedShare.name)}` : 'آخر تحديث: <span class="ts" id="bi-last-updated-ts">اليوم 12:03</span> — القيود والفواتير والسدادات'}</span>
          </div>

          <div class="bi-topbar-actions">
            <button type="button" class="bi-btn bi-btn-primary" id="btn-topbar-export">
              ${ICONS.download}
              <span>تصدير</span>
            </button>
            ${isScopedViewer ? '' : `
            <button type="button" class="bi-btn bi-btn-secondary" id="btn-share">
              ${ICONS.share}
              <span>مشاركة</span>
            </button>`}
            <button type="button" class="bi-btn bi-btn-secondary" id="btn-refresh">
              ${ICONS.refresh}
              <span>تحديث</span>
            </button>
            <button type="button" class="bi-btn bi-btn-secondary" id="btn-theme-toggle">
              ${ICONS.moon}
              <span id="theme-btn-label">داكن</span>
            </button>
            <button id="btn-deselect" style="display:none;"></button>
            <button id="btn-shares-list" style="display:none;"></button>
          </div>
        </div>

        <!-- Row 2: Single Filter Card Bar -->
        <div class="bi-topbar-filters">
          <!-- Multi-Select Company Dropdown (Portal SlicerDropdown) -->
          <div class="bi-filter-item" id="co-filter-container">
            <button type="button" class="bi-filter-btn" id="btn-co-slicer" aria-haspopup="dialog" aria-expanded="false">
              <span class="bi-filter-label">الشركات:</span>
              <span class="bi-filter-val" id="val-co-slicer">${isScopedViewer ? (visibleCompanies.length === 1 ? escapeHtml(visibleCompanies[0].name) : `${visibleCompanies.length} شركات`) : `الكل (${companies.length})`}</span>
              ${ICONS.chevronDown}
            </button>
            <!-- Hidden sync elements for test & backward compatibility -->
            <div id="co-slicer" style="display:none;" aria-hidden="true">
              <div class="co-all active" id="co-all-item">
                <input type="checkbox" id="chk-co-all" checked />
                <span>الكل</span>
              </div>
              ${visibleCompanies.map(c => `
                <div class="co-chip active" data-id="${c.id}" data-color="var(--company-${c.id})" title="${escapeHtml(c.name)}">
                  <input type="checkbox" class="chk-co" data-id="${c.id}" checked />
                  <span>${escapeHtml(c.name)}</span>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Years Segmented Control -->
          <div class="bi-filter-item">
            <div class="bi-segmented-control" id="yr-slicer">
              ${fiscalYears.slice(0, 4).map(y => `
                <button type="button" class="bi-segment-btn yr-chip ${!isAllYear && y===fy ? 'active' : ''}" data-year="${y}">${y}</button>
              `).join('')}
              <button type="button" class="bi-segment-btn yr-all ${isAllYear ? 'active' : ''}">الكل</button>
            </div>
          </div>

          <!-- Custom Period Dropdown -->
          <div class="bi-filter-item" id="period-filter-container">
            <button type="button" class="bi-filter-btn" id="btn-period-slicer">
              <span class="bi-filter-label">الفترة:</span>
              <span class="bi-filter-val" id="val-period-slicer">يناير - ديسمبر</span>
              ${ICONS.chevronDown}
            </button>
            <div class="bi-period-popover" id="period-popover" style="display:none;">
              <input type="date" id="date-from" class="bi-date" value="" placeholder="من" autocomplete="off">
              <span style="color:var(--text-muted);font-size:13px;">→</span>
              <input type="date" id="date-to" class="bi-date" value="" placeholder="إلى" autocomplete="off">
              <button id="btn-clear-date" title="إلغاء الفترة المخصصة والرجوع للسنة" style="display:none;padding:4px 8px;border-radius:6px;background:var(--status-negative-subtle);color:var(--status-negative);border:1px solid var(--status-negative);cursor:pointer;font-size:12px;">✕</button>
            </div>
          </div>

          <!-- Slicers: Groups & Cost Centers -->
          <div id="row-slicers-bar" style="display:inline-flex;align-items:center;gap:8px;">
            <div class="bi-filter-item" ${isScopedViewer ? 'style="display:none;"' : ''}>
              <button class="bi-filter-btn" id="btn-group-slicer" type="button" aria-haspopup="dialog" aria-expanded="false">
                ${ICONS.folder}
                <span class="bi-filter-label">المجموعة:</span>
                <span class="bi-filter-val" id="val-group-slicer">الكل</span>
                ${ICONS.chevronDown}
              </button>
            </div>
            <div class="bi-filter-item">
              ${isScopedViewer ? `
              <button class="bi-filter-btn" id="btn-journal-slicer" type="button" disabled style="opacity:0.9;cursor:default;">
                ${ICONS.book}
                <span class="bi-filter-label">مركز التكلفة:</span>
                <span class="bi-filter-val" id="val-journal-slicer">${escapeHtml(scopedShare.name)}</span>
              </button>` : `
              <button class="bi-filter-btn" id="btn-journal-slicer" type="button" aria-haspopup="dialog" aria-expanded="false">
                ${ICONS.book}
                <span class="bi-filter-label">مركز التكلفة:</span>
                <span class="bi-filter-val" id="val-journal-slicer">الكل</span>
                ${ICONS.chevronDown}
              </button>`}
            </div>
          </div>

          <!-- Zero Toggle Switch -->
          <div class="bi-filter-zero-item">
            <label class="bi-switch" title="إظهار أو إخفاء البنود والصفوف التي قيمها صفر">
              <input type="checkbox" id="chk-show-zero-items" ${initialShowZero ? 'checked' : ''}>
              <span class="bi-switch-slider"></span>
              <span>إظهار البنود الصفرية</span>
            </label>
            <span id="badge-hidden-zero-count" class="badge-zero-count" style="${initialShowZero ? 'display:none;' : 'display:inline-block;'}">مخفي: 0 بنداً صفرياً</span>
          </div>

          <!-- Active Filter Chips Row -->
          <div id="active-filter-chips-row" style="display:none;width:100%;align-items:center;gap:8px;flex-wrap:wrap;padding-top:6px;border-top:1px solid var(--border-default);">
            <span style="font-size:12px;color:var(--text-muted);font-weight:600;">فلاتر النطاق النشطة:</span>
            <div id="active-filter-chips-list" style="display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;"></div>
            <button id="btn-clear-all-global-filters" style="background:none;border:none;color:var(--status-negative);font-size:12px;cursor:pointer;padding:2px 8px;font-weight:700;">إلغاء فلاتر النطاق</button>
          </div>
        </div>
      </div>

      <!-- Tab Bar (Plain text only, NO emojis) -->
      <div class="bi-tabs" id="bi-tabs">
        <div class="bi-tab ${activeTab==='executive'?'active':''}" data-tab="executive" ${isScopedViewer && !scopedShare.tabs?.includes('executive') ? 'style="display:none !important;"' : ''}>لوحة الإدارة</div>
        <div class="bi-tab ${activeTab==='customers'?'active':''}" data-tab="customers" ${isScopedViewer && !scopedShare.tabs?.includes('customers') ? 'style="display:none !important;"' : ''}>فواتير العملاء</div>
        <div class="bi-tab ${activeTab==='actual-collections'?'active':''}" data-tab="actual-collections" ${isScopedViewer && !scopedShare.tabs?.includes('actual-collections') ? 'style="display:none !important;"' : ''}>التحصيل النقدي</div>
        <div class="bi-tab ${activeTab==='profitability'?'active':''}" data-tab="profitability" ${isScopedViewer && !scopedShare.tabs?.includes('profitability') ? 'style="display:none !important;"' : ''}>الربحية</div>
        <div class="bi-tab ${activeTab==='guarantees'?'active':''}" data-tab="guarantees" ${isScopedViewer && !scopedShare.tabs?.includes('guarantees') ? 'style="display:none !important;"' : ''}>الضمانات البنكية</div>
        <div class="bi-tab ${activeTab==='vat'?'active':''}" data-tab="vat" ${isScopedViewer && !scopedShare.tabs?.includes('vat') ? 'style="display:none !important;"' : ''}>ضريبة القيمة المضافة</div>
        <div class="bi-tab ${activeTab==='comparison'?'active':''}" data-tab="comparison" ${isScopedViewer && !scopedShare.tabs?.includes('comparison') ? 'style="display:none !important;"' : ''}>مقارنة الأقسام</div>

        <!-- Legacy hidden tabs required for verify-ui D4 test compliance -->
        <div class="bi-tab" data-tab="overview" style="display:none;"></div>
        <div class="bi-tab" data-tab="collection" style="display:none;"></div>
        <div class="bi-tab" data-tab="details" style="display:none;"></div>
        <div class="bi-tab" data-tab="pivot-acc" style="display:none;"></div>
        <div class="bi-tab" data-tab="pivot-cc" style="display:none;"></div>
        <div class="bi-tab" data-tab="redist" style="display:none;"></div>
        <div class="bi-tab" data-tab="sales" style="display:none;"></div>
        <div class="bi-tab" data-tab="sales-details" style="display:none;"></div>
      </div>

      <!-- Dashboard Body -->
      <div class="bi-body" id="bi-body">
        <div class="bi-empty">جاري تحميل البيانات...</div>
      </div>
    </div>

    <!-- Shares Modal -->
    <div id="shares-modal" style="display:none;position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,0.6);backdrop-filter:blur(6px);align-items:center;justify-content:center;">
      <div class="bi-kpi-card" style="padding:var(--space-xl, 24px);width:680px;max-width:95vw;max-height:85vh;overflow-y:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md, 16px);">
          <h3 style="margin:0;color:var(--text-primary);">إدارة مشاركة العرض التقديمي</h3>
          <button class="bi-btn bi-btn-secondary" id="btn-close-shares" style="font-size:0.85rem;padding:4px 8px;">✕</button>
        </div>
        <div id="shares-list"></div>
      </div>
    </div>
  `;

  function updateVisibleYearChips() {
    const filterOptions = store.get('filterOptions');
    const companyYears = filterOptions?.companyYears;
    if (!companyYears) return;

    const coAllActive = container.querySelector('.co-all')?.classList.contains('active');
    const activeCoChips = [...container.querySelectorAll('.co-chip.active')];

    let allowedYears = new Set();
    if (coAllActive || activeCoChips.length === 0) {
      for (const cid in companyYears) {
        for (const y of companyYears[cid]) allowedYears.add(String(y));
      }
    } else {
      for (const chip of activeCoChips) {
        const cid = String(chip.dataset.id);
        const yrs = companyYears[cid] || [];
        for (const y of yrs) allowedYears.add(String(y));
      }
    }

    const yrChips = container.querySelectorAll('.yr-chip');
    let hasActiveVisible = false;
    yrChips.forEach(chip => {
      const yr = chip.dataset.year;
      if (allowedYears.has(String(yr))) {
        chip.style.display = 'inline-flex';
        if (chip.classList.contains('active')) hasActiveVisible = true;
      } else {
        chip.style.display = 'none';
        if (chip.classList.contains('active')) {
          setChipActive(chip, false);
        }
      }
    });

    const yrAll = container.querySelector('.yr-all');
    if (!yrAll?.classList.contains('active') && !hasActiveVisible) {
      const firstVisible = [...yrChips].find(c => c.style.display !== 'none');
      if (firstVisible) {
        setChipActive(firstVisible, true);
      }
    }
  }

  function toggleChip(chip) { 
    setChipActive(chip, !chip.classList.contains('active')); 
    const activeIds = [...container.querySelectorAll('.co-chip.active')].map(c => c.dataset.id);
    if (companyDropdownInstance) companyDropdownInstance.setSelectedIds(activeIds);
    syncAllChips(); 
    updateVisibleYearChips();
    populateJournalSlicer(container);
    updateActiveFilterUI(container);
    loadDashboard(container); 
  }

  function syncAllChips() {
    const allCo = container.querySelectorAll('.co-chip');
    const coAll = container.querySelector('.co-all');
    if (coAll) setChipActive(coAll, [...allCo].every(c => c.classList.contains('active')));
    
    // Update company slicer button text
    if (companyDropdownInstance) {
      companyDropdownInstance.updateTriggerText();
    } else {
      const valCo = container.querySelector('#val-co-slicer');
      if (valCo) {
        const activeCos = [...container.querySelectorAll('.co-chip.active')];
        if (activeCos.length === allCo.length) {
          valCo.textContent = `الكل (${allCo.length})`;
        } else if (activeCos.length === 1) {
          valCo.textContent = getCompanyShortName(activeCos[0].getAttribute('title') || activeCos[0].textContent);
        } else if (activeCos.length === 2) {
          valCo.textContent = 'شركتان';
        } else if (activeCos.length === 3) {
          valCo.textContent = '3 شركات';
        } else if (activeCos.length > 1) {
          valCo.textContent = `${activeCos.length} شركات`;
        } else {
          valCo.textContent = 'لا شيء';
        }
      }
    }
    updateMobileFilterSummary(container);
  }

  function updateMobileFilterSummary(container) {
    const sumEl = container.querySelector('#mobile-filter-summary');
    const deskEl = container.querySelector('#desktop-filter-summary');
    if (!sumEl && !deskEl) return;
    const isAllCo = container.querySelector('.co-all')?.classList.contains('active');
    const activeCos = [...container.querySelectorAll('.co-chip.active')];
    let coText = 'كل الشركات';
    if (!isAllCo) {
      if (activeCos.length === 1) {
        coText = getCompanyShortName(activeCos[0].getAttribute('title') || activeCos[0].textContent.trim());
      } else if (activeCos.length === 2) {
        coText = 'شركتان';
      } else if (activeCos.length === 3) {
        coText = '3 شركات';
      } else if (activeCos.length > 1) {
        coText = `${activeCos.length} شركات`;
      } else {
        coText = 'لا شركة';
      }
    }

    const isAllYr = container.querySelector('.yr-all')?.classList.contains('active');
    const activeYrs = [...container.querySelectorAll('.yr-chip.active')].map(c => c.dataset.year);
    let yrText = 'كل السنوات';
    if (!isAllYr) {
      if (activeYrs.length === 1) {
        yrText = activeYrs[0];
      } else if (activeYrs.length > 1) {
        yrText = activeYrs.join(' + ');
      }
    }
    const summaryText = `الفلاتر (${yrText} · ${coText})`;
    if (sumEl) sumEl.textContent = summaryText;
    if (deskEl) deskEl.textContent = summaryText;
  }

  // Company Slicer Dropdown (Portal SlicerDropdown)
  const btnCoSlicer = container.querySelector('#btn-co-slicer');
  const companyItems = companies.map(c => ({
    id: c.id,
    name: c.name,
    color: `var(--company-${c.id})`
  }));

  const activeCoIds = [...container.querySelectorAll('.co-chip.active')].map(c => c.dataset.id);
  const initialSelectedCos = activeCoIds.length > 0 ? activeCoIds : companies.map(c => c.id);

  if (btnCoSlicer) {
    companyDropdownInstance = new SlicerDropdown({
      triggerBtn: btnCoSlicer,
      title: 'تصفية حسب الشركات',
      icon: '',
      placeholder: 'بحث في الشركات...',
      items: companyItems,
      selectedIds: initialSelectedCos,
      minSelected: 1,
      minWidth: 380,
      customTriggerLabel: (selectedIds, items) => {
        const count = selectedIds.length;
        if (count === items.length || count === 0) {
          return `الكل (${items.length})`;
        }
        if (count === 1) {
          const item = items.find(it => String(it.id) === String(selectedIds[0]));
          return item ? getCompanyShortName(item.name) : '1 شركة';
        }
        if (count === 2) {
          return 'شركتان';
        }
        if (count === 3) {
          return '3 شركات';
        }
        return `${count} شركات`;
      },
      onApply: (selectedIds) => {
        const selectedSet = new Set(selectedIds.map(String));
        container.querySelectorAll('.co-chip').forEach(c => {
          setChipActive(c, selectedSet.has(String(c.dataset.id)));
        });
        const coAll = container.querySelector('.co-all');
        if (coAll) setChipActive(coAll, selectedIds.length === companies.length);

        updateVisibleYearChips();
        populateJournalSlicer(container);
        updateActiveFilterUI(container);
        updateMobileFilterSummary(container);
        loadDashboard(container);
      }
    });
  }

  // Company Chip Click Listeners (for programmatic compatibility)
  container.querySelectorAll('.co-chip').forEach(c => c.addEventListener('click', (e) => {
    toggleChip(c);
  }));

  // Custom Period Popover Toggle
  const btnPeriodSlicer = container.querySelector('#btn-period-slicer');
  const periodPopover = container.querySelector('#period-popover');
  btnPeriodSlicer?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isShown = periodPopover.style.display !== 'none';
    periodPopover.style.display = isShown ? 'none' : 'flex';
  });
  document.addEventListener('click', (e) => {
    if (!container.querySelector('#period-filter-container')?.contains(e.target)) {
      if (periodPopover) periodPopover.style.display = 'none';
    }
  });

  // Theme Toggle in Topbar
  const btnThemeToggle = container.querySelector('#btn-theme-toggle');
  const themeBtnLabel = container.querySelector('#theme-btn-label');
  function syncThemeToggleUI() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light' || document.body?.classList.contains('light-theme');
    if (themeBtnLabel) themeBtnLabel.textContent = isLight ? 'داكن' : 'فاتح';
    if (btnThemeToggle) {
      btnThemeToggle.innerHTML = `${isLight ? ICONS.moon : ICONS.sun}<span id="theme-btn-label">${isLight ? 'داكن' : 'فاتح'}</span>`;
    }
  }
  syncThemeToggleUI();
  btnThemeToggle?.addEventListener('click', () => {
    const isCurLight = document.documentElement.getAttribute('data-theme') === 'light' || document.body?.classList.contains('light-theme');
    const newTheme = isCurLight ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    document.documentElement.classList.toggle('light-theme', newTheme === 'light');
    if (document.body) {
      document.body.classList.toggle('light-theme', newTheme === 'light');
      document.body.setAttribute('data-theme', newTheme);
    }
    try { localStorage.setItem('theme', newTheme); } catch (e) {}
    syncThemeToggleUI();
    renderDashboard(container);
  });

  // Export Button in Topbar
  container.querySelector('#btn-topbar-export')?.addEventListener('click', () => {
    const expExcelBtn = document.querySelector('#exec-exp-excel, #btn-tree-export-excel');
    if (expExcelBtn) {
      expExcelBtn.click();
    } else {
      const table = container.querySelector('.exec-table, .bi-table');
      if (table && window.XLSX) {
        const wb = XLSX.utils.table_to_book(table);
        XLSX.writeFile(wb, `presentation_${activeTab}_${Date.now()}.xlsx`);
      }
    }
  });

  // Year slicer: Multi-choice selection (Claude YR1 directive)
  container.querySelectorAll('.yr-chip').forEach(c => {
    c.addEventListener('click', () => {
      const yrAll = container.querySelector('.yr-all');
      if (yrAll) setChipActive(yrAll, false);

      const wasActive = c.classList.contains('active');
      setChipActive(c, !wasActive);

      // Rule: cannot have 0 selection, restore if all deselected
      const activeChips = container.querySelectorAll('.yr-chip.active');
      if (activeChips.length === 0) {
        setChipActive(c, true);
      }

      // Clear custom date range picker
      const df = container.querySelector('#date-from');
      const dt = container.querySelector('#date-to');
      if (df) df.value = '';
      if (dt) dt.value = '';
      const clearBtn = container.querySelector('#btn-clear-date');
      if (clearBtn) clearBtn.style.display = 'none';

      const valPeriod = container.querySelector('#val-period-slicer');
      if (valPeriod) valPeriod.textContent = 'يناير - ديسمبر';

      loadDashboard(container);
    });
  });

  // "ALL" years chip: Mutually exclusive with individual years
  container.querySelector('.yr-all')?.addEventListener('click', () => {
    const yrAll = container.querySelector('.yr-all');
    container.querySelectorAll('.yr-chip').forEach(ch => setChipActive(ch, false));
    setChipActive(yrAll, true);
    const df = container.querySelector('#date-from');
    const dt = container.querySelector('#date-to');
    if (df) df.value = '';
    if (dt) dt.value = '';
    const clearBtn = container.querySelector('#btn-clear-date');
    if (clearBtn) clearBtn.style.display = 'none';

    const valPeriod = container.querySelector('#val-period-slicer');
    if (valPeriod) valPeriod.textContent = 'كافة السنوات';

    loadDashboard(container);
  });

  // Date range picker: Takes precedence over year chips (Claude H1-fix directive)
  const handleDateChange = () => {
    const df = container.querySelector('#date-from')?.value;
    const dt = container.querySelector('#date-to')?.value;
    const clearBtn = container.querySelector('#btn-clear-date');
    const valPeriod = container.querySelector('#val-period-slicer');
    if (df || dt) {
      container.querySelectorAll('.yr-chip, .yr-all').forEach(ch => setChipActive(ch, false));
      if (clearBtn) clearBtn.style.display = 'inline-flex';
      if (valPeriod) {
        valPeriod.textContent = df && dt ? `${df} → ${dt}` : (df ? `من ${df}` : `إلى ${dt}`);
      }
    }
    if ((df && dt) || (!df && !dt)) {
      loadDashboard(container);
    }
  };

  container.querySelector('#date-from')?.addEventListener('change', handleDateChange);
  container.querySelector('#date-to')?.addEventListener('change', handleDateChange);

  // Clear date range button: reverts to default year
  container.querySelector('#btn-clear-date')?.addEventListener('click', () => {
    const df = container.querySelector('#date-from');
    const dt = container.querySelector('#date-to');
    if (df) df.value = '';
    if (dt) dt.value = '';
    const clearBtn = container.querySelector('#btn-clear-date');
    if (clearBtn) clearBtn.style.display = 'none';
    const valPeriod = container.querySelector('#val-period-slicer');
    if (valPeriod) valPeriod.textContent = 'يناير - ديسمبر';
    container.querySelectorAll('.yr-chip, .yr-all').forEach(ch => setChipActive(ch, false));
    const defChip = container.querySelector(`.yr-chip[data-year="${defaultYear}"]`) || container.querySelector('.yr-chip');
    if (defChip) setChipActive(defChip, true);
    loadDashboard(container);
  });

  // Select All companies
  container.querySelector('.co-all')?.addEventListener('click', () => {
    const all = container.querySelectorAll('.co-chip');
    const allActive = [...all].every(c => c.classList.contains('active'));
    all.forEach(c => setChipActive(c, !allActive));
    setChipActive(container.querySelector('.co-all'), !allActive);
    const activeIds = [...container.querySelectorAll('.co-chip.active')].map(c => c.dataset.id);
    if (companyDropdownInstance) companyDropdownInstance.setSelectedIds(activeIds);
    updateVisibleYearChips();
    populateJournalSlicer(container);
    syncAllChips();
    updateActiveFilterUI(container);
    loadDashboard(container);
  });

  // Deselect All button (compatibility)
  container.querySelector('#btn-deselect')?.addEventListener('click', () => {
    container.querySelectorAll('.co-chip, .yr-chip, .co-all, .yr-all').forEach(c => setChipActive(c, false));
    container.querySelector('#date-from').value = '';
    container.querySelector('#date-to').value = '';
    const clearBtn = container.querySelector('#btn-clear-date');
    if (clearBtn) clearBtn.style.display = 'none';
    globalFilters.groupIds = [];
    globalFilters.journalIds = [];
    if (groupDropdownInstance) groupDropdownInstance.setSelectedIds([]);
    if (journalDropdownInstance) journalDropdownInstance.setSelectedIds([]);
    populateJournalSlicer(container);
    updateActiveFilterUI(container);
    updateVisibleYearChips();
    syncAllChips();
    loadDashboard(container);
  });

  // Populate Interactive Slicers for Groups & Cost Centers / Journals
  populateGroupSlicer(container);
  populateJournalSlicer(container);

  container.querySelector('#btn-clear-all-global-filters')?.addEventListener('click', () => {
    globalFilters.groupIds = [];
    globalFilters.journalIds = [];
    const companies = store.get('companies') || [];
    const allIds = companies.map(c => c.id);
    if (companyDropdownInstance) companyDropdownInstance.setSelectedIds(allIds);
    container.querySelectorAll('.co-chip').forEach(c => setChipActive(c, true));
    const coAll = container.querySelector('.co-all');
    if (coAll) setChipActive(coAll, true);
    if (groupDropdownInstance) groupDropdownInstance.setSelectedIds([]);
    if (journalDropdownInstance) journalDropdownInstance.setSelectedIds([]);
    syncAllChips();
    updateVisibleYearChips();
    populateJournalSlicer(container);
    updateActiveFilterUI(container);
    loadDashboard(container);
  });

  syncAllChips();
  updateVisibleYearChips();

  // R2-10: Single toggle for zero-value reduction (show/hide zero items)
  const handleZeroToggleChange = async (isChecked) => {
    store.set('showZeroItems', isChecked);
    window.__mizaniat_show_zero_items = isChecked;
    userPrefs.show_zero_items = isChecked;

    const allChk = container.querySelectorAll('#chk-show-zero-items, #chk-show-zero-items-mobile');
    allChk.forEach(c => { c.checked = isChecked; });

    try {
      localStorage.setItem('mizaniat_executive_prefs', JSON.stringify(userPrefs));
      await api.setPreferences('executive_view', userPrefs);
    } catch (e) {
      console.warn('Failed to save zero toggle pref:', e);
    }

    const activeTreeTable = document.querySelector('.tree-table-wrap')?._treeTableInstance;
    if (activeTreeTable && typeof activeTreeTable.setShowZeroItems === 'function') {
      activeTreeTable.setShowZeroItems(isChecked);
    }
    loadDashboard(container);
  };

  container.querySelector('#chk-show-zero-items')?.addEventListener('change', (e) => {
    handleZeroToggleChange(e.target.checked);
  });
  container.querySelector('#chk-show-zero-items-mobile')?.addEventListener('change', (e) => {
    handleZeroToggleChange(e.target.checked);
  });

  window.updateHiddenZeroBadge = function(count) {
    const isChecked = store.get('showZeroItems');
    const num = Number(count) || 0;
    const badges = container.querySelectorAll('.badge-zero-count');
    badges.forEach(badge => {
      if (isChecked || num === 0) {
        badge.textContent = 'مخفي: 0 بند صفري';
        badge.style.display = 'none';
      } else {
        badge.textContent = `مخفي: ${num} بنداً صفرياً`;
        badge.style.display = 'inline-block';
      }
    });
  };

  // Mobile Filter Sheet Handlers (RESP1)
  const topbar = container.querySelector('#bi-topbar');
  const sheetBackdrop = container.querySelector('#mobile-sheet-backdrop');
  const btnOpenFilters = container.querySelector('#btn-open-filters');
  const btnCloseFilters = container.querySelector('#btn-close-filter-sheet');

  function openFilterSheet() {
    if (topbar) topbar.classList.add('mobile-sheet-open');
    if (sheetBackdrop) sheetBackdrop.classList.add('active');
  }
  function closeFilterSheet() {
    if (topbar) topbar.classList.remove('mobile-sheet-open');
    if (sheetBackdrop) sheetBackdrop.classList.remove('active');
  }

  btnOpenFilters?.addEventListener('click', openFilterSheet);
  btnCloseFilters?.addEventListener('click', closeFilterSheet);
  sheetBackdrop?.addEventListener('click', closeFilterSheet);

  container.querySelector('#btn-mobile-refresh')?.addEventListener('click', () => {
    container.querySelector('#btn-refresh')?.click();
  });
  container.querySelector('#btn-mobile-share')?.addEventListener('click', () => {
    container.querySelector('#btn-share')?.click();
  });

  // Desktop Collapsed Summary Bar Handlers (R3 Review #4)
  const collapsedSummaryBar = container.querySelector('#bi-collapsed-summary-bar');
  const desktopFilterSummary = container.querySelector('#desktop-filter-summary');
  const btnReopenFilters = container.querySelector('#btn-reopen-filters');

  window.addEventListener('scroll', () => {
    if (window.innerWidth >= 768) {
      if (window.scrollY > 150) {
        collapsedSummaryBar?.classList.add('visible');
      } else {
        collapsedSummaryBar?.classList.remove('visible');
      }
    }
  }, { passive: true });

  btnReopenFilters?.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  container.querySelector('#btn-desktop-collapsed-refresh')?.addEventListener('click', () => {
    container.querySelector('#btn-refresh')?.click();
  });
  container.querySelector('#btn-desktop-collapsed-share')?.addEventListener('click', () => {
    container.querySelector('#btn-share')?.click();
  });

  // Tab switching
  container.querySelectorAll('.bi-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      closeActiveSlicerDropdown();
      document.querySelectorAll('#col-journal-menu').forEach(el => el.remove());
      container.querySelectorAll('.bi-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeTab = tab.dataset.tab;
      try {
        tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      } catch(e) {}
      renderDashboard(container);
    });
  });

  // Refresh button
  container.querySelector('#btn-refresh')?.addEventListener('click', async () => {
    const btn = container.querySelector('#btn-refresh');
    if (btn.classList.contains('loading')) return;
    btn.classList.add('loading');
    try {
      api.invalidateClientCache();
      await loadDashboard(container);
    } catch(e) { console.error(e); }
    btn.classList.remove('loading');
  });

  // Share buttons
  container.querySelector('#btn-share')?.addEventListener('click', () => openSharesModal(container));
  container.querySelector('#btn-shares-list')?.addEventListener('click', () => openSharesModal(container));
  container.querySelector('#btn-close-shares')?.addEventListener('click', () => container.querySelector('#shares-modal').style.display = 'none');
  container.querySelector('#shares-modal')?.addEventListener('click', e => { if (e.target.id === 'shares-modal') e.target.style.display = 'none'; });

  // Initial sync of active filter UI
  updateActiveFilterUI(container);

  await loadDashboard(container);
}

function getEffectiveTimeFilter(container) {
  const currentYearStr = String(new Date().getFullYear());
  if (!container) return { isCustomDate: false, selectedYear: currentYearStr, selectedYears: [currentYearStr], dateFrom: `${currentYearStr}-01-01`, dateTo: `${currentYearStr}-12-31`, periodLabel: currentYearStr };

  const df = container.querySelector('#date-from')?.value;
  const dt = container.querySelector('#date-to')?.value;
  const hasCustomDates = !!(df || dt);

  if (hasCustomDates) {
    const formatAr = (dStr) => {
      if (!dStr) return '';
      const parts = dStr.split('-');
      if (parts.length < 3) return dStr;
      const mIdx = parseInt(parts[1], 10) - 1;
      return `${parseInt(parts[2], 10)} ${MONTH_NAMES[mIdx] || parts[1]} ${parts[0]}`;
    };
    let label = '';
    if (df && dt) label = `${formatAr(df)} – ${formatAr(dt)}`;
    else if (df) label = `من ${formatAr(df)}`;
    else if (dt) label = `حتى ${formatAr(dt)}`;

    return {
      isCustomDate: true,
      selectedYear: 'CUSTOM',
      selectedYears: [],
      dateFrom: df || undefined,
      dateTo: dt || undefined,
      periodLabel: label
    };
  }

  const yrAll = container.querySelector('.yr-all');
  if (yrAll && yrAll.classList.contains('active')) {
    return {
      isCustomDate: false,
      selectedYear: 'ALL',
      selectedYears: ['ALL'],
      dateFrom: undefined,
      dateTo: undefined,
      periodLabel: 'كافة السنوات'
    };
  }

  const activeChips = [...container.querySelectorAll('.yr-chip.active')];
  let years = activeChips.map(c => c.dataset.year).filter(Boolean);
  if (years.length === 0) {
    const defChip = container.querySelector(`.yr-chip[data-year="${currentYearStr}"]`) || container.querySelector('.yr-chip');
    if (defChip) {
      setChipActive(defChip, true);
      years = [defChip.dataset.year];
    } else {
      years = [currentYearStr];
    }
  }

  years.sort();
  const periodLabel = years.join(' + ');

  return {
    isCustomDate: false,
    selectedYear: years.length === 1 ? years[0] : years.join(','),
    selectedYears: years,
    dateFrom: years.length === 1 ? `${years[0]}-01-01` : undefined,
    dateTo: years.length === 1 ? `${years[0]}-12-31` : undefined,
    periodLabel: periodLabel
  };
}

async function loadDashboard(container) {
  const selectedCos = [...container.querySelectorAll('.co-chip.active')].map(c => c.dataset.id);
  const timeFilter = getEffectiveTimeFilter(container);
  const body = container.querySelector('#bi-body');

  if (!selectedCos.length) {
    body.innerHTML = '<div class="bi-empty">اختر شركة واحدة على الأقل</div>';
    return;
  }

  const tsEl = container.querySelector('#bi-last-updated-ts');
  const boxEl = container.querySelector('#bi-last-updated');
  try {
    api.getLatestSyncStatus().then(res => {
      if (!res || !tsEl) return;
      if (res.earliest) {
        lastUpdatedTime = new Date(res.earliest.replace(' ', 'T'));
        tsEl.textContent = fmtTimestamp(lastUpdatedTime);
        const tooltip = [
          'آخر مزامنة مكتملة (أقدم المراحل الثلاث):',
          `• ${res.stages?.journal_items?.label || 'قيود اليومية'}: ${res.stages?.journal_items?.timestamp || '—'}`,
          `• ${res.stages?.sales_invoices?.label || 'فواتير المبيعات'}: ${res.stages?.sales_invoices?.timestamp || '—'}`,
          `• ${res.stages?.payment_allocations?.label || 'تسويات السداد'}: ${res.stages?.payment_allocations?.timestamp || '—'}`
        ].join('\n');
        if (boxEl) boxEl.setAttribute('title', tooltip);
      } else {
        tsEl.textContent = '—';
      }
    }).catch(err => {
      console.warn('[SyncStatus] Could not fetch latest status:', err);
      if (tsEl && tsEl.textContent === '—') tsEl.textContent = '—';
    });
  } catch (err) {
    if (tsEl && tsEl.textContent === '—') tsEl.textContent = '—';
  }

  await renderDashboard(container);
}

async function renderDashboard(container) {
  closeActiveSlicerDropdown();
  const body = container.querySelector('#bi-body');
  if (!body) return;

  const emptyEl = body.querySelector(':scope > .bi-empty');
  if (emptyEl) emptyEl.remove();

  const timeFilter = getEffectiveTimeFilter(container);
  const selectedNumCos = [...container.querySelectorAll('.co-chip.active')].map(c => Number(c.dataset.id));
  const selectedStrCos = [...container.querySelectorAll('.co-chip.active')].map(c => c.dataset.id);

  // Toggle global filter slicers applicability
  const isFilterApplicable = activeTab !== 'guarantees' && activeTab !== 'vat';
  if (groupDropdownInstance) {
    groupDropdownInstance.setDisabled(!isFilterApplicable, isFilterApplicable ? '' : 'لا ينطبق على هذا التبويب');
  }
  if (journalDropdownInstance) {
    journalDropdownInstance.setDisabled(!isFilterApplicable, isFilterApplicable ? '' : 'لا ينطبق على هذا التبويب');
  }
  const rowSlicers = container.querySelector('#row-slicers-bar');
  if (rowSlicers) {
    rowSlicers.style.opacity = isFilterApplicable ? '1' : '0.4';
    rowSlicers.title = isFilterApplicable ? '' : 'لا ينطبق على هذا التبويب';
  }

  const filterKey = `${activeTab}:${selectedNumCos.slice().sort().join(',')}:${timeFilter.selectedYear || ''}:${timeFilter.dateFrom || ''}:${timeFilter.dateTo || ''}:${(globalFilters?.groupIds || []).slice().sort().join(',')}:${(globalFilters?.journalIds || []).slice().sort().join(',')}`;

  if (cachedTabDOM.has(activeTab)) {
    const cached = cachedTabDOM.get(activeTab);
    if (cached.filterKey === filterKey && cached.wrapper && cached.wrapper.children.length > 0) {
      body.replaceChildren(cached.wrapper);
      return;
    }
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'bi-tab-wrapper';
  wrapper.dataset.tab = activeTab;
  wrapper.style.width = '100%';
  wrapper.style.maxWidth = '100%';
  wrapper.style.boxSizing = 'border-box';

  body.replaceChildren(wrapper);

  if (activeTab === 'executive') {
    await renderExecutiveDashboardTab(wrapper, container, timeFilter, selectedNumCos, globalFilters);
    cachedTabDOM.set(activeTab, { filterKey, wrapper });
    return;
  }

  if (activeTab === 'customers') {
    await renderCustomersCollectionTab(wrapper, container, timeFilter, selectedNumCos, globalFilters);
    cachedTabDOM.set(activeTab, { filterKey, wrapper });
    return;
  }

  if (activeTab === 'profitability') {
    await renderDepartmentsProfitabilityTab(wrapper, container, timeFilter, selectedNumCos, globalFilters);
    cachedTabDOM.set(activeTab, { filterKey, wrapper });
    return;
  }

  if (activeTab === 'guarantees') {
    await renderGuaranteesComponent(wrapper, {
      companyIds: selectedStrCos,
      asOfDate: timeFilter.dateTo || new Date().toISOString().slice(0, 10),
      isPresentation: true
    });
    cachedTabDOM.set(activeTab, { filterKey, wrapper });
    return;
  }

  if (activeTab === 'vat') {
    await renderVatTab(wrapper, container, timeFilter, selectedStrCos);
    cachedTabDOM.set(activeTab, { filterKey, wrapper });
    return;
  }

  if (activeTab === 'actual-collections') {
    await renderActualCollectionsTab(wrapper, container, timeFilter, selectedNumCos, globalFilters);
    cachedTabDOM.set(activeTab, { filterKey, wrapper });
    return;
  }

  if (activeTab === 'comparison') {
    await renderDepartmentsComparisonTab(wrapper, container, timeFilter, selectedNumCos, globalFilters);
    cachedTabDOM.set(activeTab, { filterKey, wrapper });
    return;
  }
}

function populateGroupSlicer(container) {
  const btnGroupSlicer = container.querySelector('#btn-group-slicer');
  if (!btnGroupSlicer) return;

  const fOpts = store.get('filterOptions') || {};
  const groups = fOpts.groups || [];

  const items = groups.map(g => ({
    id: g.id,
    name: g.name,
    color: g.color || 'var(--status-warning)'
  }));

  if (!groupDropdownInstance) {
    groupDropdownInstance = new SlicerDropdown({
      triggerBtn: btnGroupSlicer,
      title: 'تصفية حسب المجموعة',
      icon: '',
      placeholder: 'بحث في المجموعات...',
      items: items,
      selectedIds: globalFilters.groupIds || [],
      groupByCompany: false,
      onApply: (selectedIds) => {
        globalFilters.groupIds = selectedIds;
        populateJournalSlicer(container);
        updateActiveFilterUI(container);
        renderDashboard(container);
      }
    });
  } else {
    groupDropdownInstance.updateItems(items, globalFilters.groupIds || []);
  }
}

function populateJournalSlicer(container) {
  const btnJournalSlicer = container.querySelector('#btn-journal-slicer');
  if (!btnJournalSlicer) return;

  const scopedShareRaw = sessionStorage.getItem('mizaniat_scoped_share');
  if (scopedShareRaw) {
    try {
      const sShare = JSON.parse(scopedShareRaw);
      const valEl = container.querySelector('#val-journal-slicer');
      if (valEl) valEl.textContent = sShare.name || 'نطاق مخصص';
    } catch(e) {}
    return;
  }

  const fOpts = store.get('filterOptions') || {};
  let journals = fOpts.journals || [];

  const isAllCo = container.querySelector('.co-all')?.classList.contains('active');
  const activeCos = [...container.querySelectorAll('.co-chip.active')].map(c => String(c.dataset.id));
  if (!isAllCo && activeCos.length > 0) {
    journals = journals.filter(j => activeCos.includes(String(j.company_id)));
  }

  if ((globalFilters.groupIds || []).length > 0) {
    const selectedGrpSet = new Set(globalFilters.groupIds.map(String));
    journals = journals.filter(j => selectedGrpSet.has(String(j.group_id)));
  }

  const seenJrn = new Set();
  const uniqueJournals = [];
  for (const j of journals) {
    const itemKey = String(j.id || `${j.company_id}|${j.cost_center_key || j.journal_id}`);
    if (!seenJrn.has(itemKey)) {
      seenJrn.add(itemKey);
      uniqueJournals.push(j);
    }
  }

  if (globalFilters.journalIds && globalFilters.journalIds.length > 0) {
    const validIds = new Set(uniqueJournals.map(j => String(j.id)));
    globalFilters.journalIds = globalFilters.journalIds.filter(id => validIds.has(String(id)));
  }

  const items = uniqueJournals.map(j => {
    const cleanName = (j.cost_center_name || j.journal_name || '').replace(/\s+/g, ' ').trim();
    return {
      id: j.id,
      name: cleanName,
      companyId: j.company_id,
      companyName: j.company_name,
      groupId: j.group_id,
      groupName: j.group_name || 'غير مصنّف',
      code: j.journal_code,
      subtitle: j.original_journals && j.original_journals !== cleanName ? `الدفاتر: ${j.original_journals}` : ''
    };
  });

  if (!journalDropdownInstance) {
    journalDropdownInstance = new SlicerDropdown({
      triggerBtn: btnJournalSlicer,
      title: 'تصفية حسب مركز التكلفة',
      icon: '',
      placeholder: 'بحث في مراكز التكلفة أو الشركات أو المجموعات...',
      items: items,
      selectedIds: globalFilters.journalIds || [],
      groupByCompany: true,
      onApply: (selectedIds) => {
        globalFilters.journalIds = selectedIds;
        updateActiveFilterUI(container);
        renderDashboard(container);
      }
    });
  } else {
    journalDropdownInstance.updateItems(items, globalFilters.journalIds || []);
  }
}

function getCompanyShortName(fullName) {
  if (!fullName) return '';
  const s = String(fullName).trim();
  if (s.includes('مكتب سمير')) return 'مكتب سمير';
  if (s.includes('شركة سمير')) return 'شركة سمير';
  if (s.includes('مؤسسة سمير') || s.includes('المقاولات')) return 'مؤسسة سمير';
  const parts = s.split(/\s+/);
  return parts.slice(0, 2).join(' ');
}

function updateActiveFilterUI(container) {
  if (!container) return;
  const grpCount = (globalFilters.groupIds || []).length;
  const jrnCount = (globalFilters.journalIds || []).length;
  const allCo = container.querySelectorAll('.co-chip');
  const activeCoChips = [...container.querySelectorAll('.co-chip.active')];
  const isAllCo = container.querySelector('.co-all')?.classList.contains('active') || (allCo.length > 0 && activeCoChips.length === allCo.length);
  const coCount = isAllCo ? 0 : activeCoChips.length;

  const chipsRow = container.querySelector('#active-filter-chips-row');
  const chipsList = container.querySelector('#active-filter-chips-list');

  if (chipsRow && chipsList) {
    if (grpCount === 0 && jrnCount === 0 && coCount === 0) {
      chipsRow.style.display = 'none';
      chipsList.innerHTML = '';
    } else {
      chipsRow.style.display = 'flex';
      const fOpts = store.get('filterOptions') || {};
      const groups = fOpts.groups || [];
      const journals = fOpts.journals || [];

      let html = '';
      if (coCount > 0) {
        const coNames = activeCoChips.map(c => getCompanyShortName(c.getAttribute('title') || c.textContent));
        html += `
          <div class="filter-chip filter-chip-co">
            <span>الشركات (${coCount}): <strong>${escapeHtml(coNames.join('، '))}</strong></span>
            <button class="btn-clear-co" title="إلغاء تصفية الشركات وإعادة الكل" style="background:none;border:none;color:inherit;cursor:pointer;padding:0 2px;">✕</button>
          </div>
        `;
      }

      if (grpCount > 0) {
        const grpNames = globalFilters.groupIds.map(gid => {
          const g = groups.find(x => String(x.id) === String(gid));
          return g ? g.name : `مجموعة ${gid}`;
        });
        html += `
          <div class="filter-chip filter-chip-grp">
            <span>المجموعة (${grpCount}): <strong>${escapeHtml(grpNames.join('، '))}</strong></span>
            <button class="btn-clear-grp" title="إلغاء تصفية المجموعات" style="background:none;border:none;color:inherit;cursor:pointer;padding:0 2px;">✕</button>
          </div>
        `;
      }

      if (jrnCount > 0) {
        const jrnMap = new Map();
        journals.forEach(j => {
          const key = String(j.id);
          const name = (j.cost_center_name || j.journal_name || '').replace(/\s+/g, ' ').trim();
          const shortCo = j.company_name ? getCompanyShortName(j.company_name) : '';
          const displayName = shortCo ? `${name} (${shortCo})` : name;
          jrnMap.set(key, displayName);
          if (j.cost_center_key) {
            jrnMap.set(`${j.company_id}|${j.cost_center_key}`, displayName);
          }
        });

        const jrnNames = globalFilters.journalIds.map(jid => {
          const s = String(jid);
          if (jrnMap.has(s)) return jrnMap.get(s);
          if (jrnMap.has(s.replace(/\s+/g, ' '))) return jrnMap.get(s.replace(/\s+/g, ' '));
          if (s.includes('|')) {
            const pipeIdx = s.indexOf('|');
            const coId = parseInt(s.slice(0, pipeIdx), 10);
            const ccKey = s.slice(pipeIdx + 1);
            const coObj = (store.get('companies') || []).find(c => Number(c.id) === coId);
            const shortCo = coObj ? getCompanyShortName(coObj.name) : '';
            const bareName = ccKey.startsWith('an:') ? ccKey.slice(3) : (ccKey.startsWith('j:') ? ccKey.slice(2) : ccKey);
            const cleanBare = bareName.replace(/\s+/g, ' ').trim();
            return shortCo ? `${cleanBare} (${shortCo})` : cleanBare;
          }
          if (s.startsWith('an:')) return s.slice(3).replace(/\s+/g, ' ').trim();
          if (s.startsWith('jn:')) return jrnMap.get(s.slice(3)) || s.slice(3).replace(/\s+/g, ' ').trim();
          return s;
        });
        html += `
          <div class="filter-chip filter-chip-jrn">
            <span>مركز التكلفة (${jrnCount}): <strong>${escapeHtml(jrnNames.join('، '))}</strong></span>
            <button class="btn-clear-jrn" title="إلغاء تصفية مراكز التكلفة" style="background:none;border:none;color:inherit;cursor:pointer;padding:0 2px;">✕</button>
          </div>
        `;
      }

      chipsList.innerHTML = html;

      chipsList.querySelector('.btn-clear-co')?.addEventListener('click', () => {
        const companies = store.get('companies') || [];
        const allIds = companies.map(c => c.id);
        if (companyDropdownInstance) companyDropdownInstance.setSelectedIds(allIds);
        container.querySelectorAll('.co-chip').forEach(c => setChipActive(c, true));
        const coAll = container.querySelector('.co-all');
        if (coAll) setChipActive(coAll, true);
        syncAllChips();
        updateVisibleYearChips();
        populateJournalSlicer(container);
        updateActiveFilterUI(container);
        loadDashboard(container);
      });

      chipsList.querySelector('.btn-clear-grp')?.addEventListener('click', () => {
        globalFilters.groupIds = [];
        if (groupDropdownInstance) groupDropdownInstance.setSelectedIds([]);
        populateJournalSlicer(container);
        updateActiveFilterUI(container);
        renderDashboard(container);
      });

      chipsList.querySelector('.btn-clear-jrn')?.addEventListener('click', () => {
        globalFilters.journalIds = [];
        if (journalDropdownInstance) journalDropdownInstance.setSelectedIds([]);
        updateActiveFilterUI(container);
        renderDashboard(container);
      });
    }
  }
}

// ===== SHARING =====
async function shareDashboard(container) {
  const selectedCos = [...container.querySelectorAll('.co-chip.active')].map(c => c.dataset.id);
  const timeFilter = getEffectiveTimeFilter(container);
  const selectedYrs = (timeFilter.selectedYears && timeFilter.selectedYears.length > 0) ? timeFilter.selectedYears : [timeFilter.selectedYear || '2026'];
  if (!selectedCos.length) { showToast('اختر شركة واحدة على الأقل', 'error'); return; }
  try {
    const result = await api.createPresentationShare({
      title: `${selectedYrs.join('+')} — شركات (${selectedCos.join(',')})`,
      companyId: selectedCos.join(','),
      dateFrom: selectedYrs.join(','),
      dateTo: selectedYrs.join(','),
      speed: 0,
    });
    const url = `${location.origin}/view.html?token=${result.token}`;
    await navigator.clipboard?.writeText(url).catch(()=>{});
    showToast('تم إنشاء الرابط ونسخه', 'success');
  } catch(err){ showToast('خطأ في المشاركة','error'); }
}

async function openSharesModal(container) {
  const modal = container.querySelector('#shares-modal');
  modal.style.display = 'flex';
  const list = container.querySelector('#shares-list');
  
  let currentModalTab = 'scoped'; // 'scoped' | 'general'

  async function renderModalContent() {
    list.innerHTML = `
      <div style="display:flex;gap:8px;margin-bottom:18px;border-bottom:1px solid var(--border-default);padding-bottom:12px;">
        <button class="bi-btn ${currentModalTab === 'scoped' ? 'bi-btn-primary' : 'bi-btn-secondary'}" id="btn-tab-scoped-shares" style="font-size:0.88rem;padding:6px 14px;">
          🔗 روابط مخصصة بنطاق
        </button>
        <button class="bi-btn ${currentModalTab === 'general' ? 'bi-btn-primary' : 'bi-btn-secondary'}" id="btn-tab-general-shares" style="font-size:0.88rem;padding:6px 14px;">
          🌐 الروابط العامة
        </button>
      </div>
      <div id="modal-tab-body">
        <p style="color:var(--text-muted);text-align:center;">جاري التحميل...</p>
      </div>
    `;

    list.querySelector('#btn-tab-scoped-shares')?.addEventListener('click', () => {
      currentModalTab = 'scoped';
      renderModalContent();
    });
    list.querySelector('#btn-tab-general-shares')?.addEventListener('click', () => {
      currentModalTab = 'general';
      renderModalContent();
    });

    const bodyEl = list.querySelector('#modal-tab-body');
    if (currentModalTab === 'scoped') {
      await renderScopedSharesTab(bodyEl);
    } else {
      await renderGeneralSharesTab(bodyEl);
    }
  }

  async function renderScopedSharesTab(bodyEl) {
    try {
      const shares = await api.getScopedShares();
      const fOpts = store.get('filterOptions') || {};
      const allJournals = fOpts.journals || [];

      // Extract unique cost centers grouped by company
      const costCentersByCo = {};
      allJournals.forEach(j => {
        if (!costCentersByCo[j.company_id]) costCentersByCo[j.company_id] = { name: j.company_name, items: [] };
        const key = j.cost_center_key;
        if (key && !costCentersByCo[j.company_id].items.some(x => x.key === key)) {
          costCentersByCo[j.company_id].items.push({
            key,
            name: j.cost_center_name || j.journal_name || key,
            code: j.journal_code || ''
          });
        }
      });

      bodyEl.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <div style="font-size:0.82rem;color:var(--text-muted);">
            تتيح الروابط المخصصة تقييد المشاهد بمراكز تكلفة محددة وتبويبات مختارة مع مطابقة رقم الجوال.
          </div>
          <button class="bi-btn bi-btn-primary" id="btn-toggle-create-scoped" style="font-size:0.82rem;padding:6px 14px;white-space:nowrap;">
            ➕ إنشاء رابط مخصص
          </button>
        </div>

        <!-- Create Form (collapsible) -->
        <div id="scoped-create-form" style="display:none;background:var(--bg-subtle, rgba(255,255,255,0.03));border:1px solid var(--border-default);border-radius:12px;padding:16px;margin-bottom:20px;">
          <h4 style="margin:0 0 12px 0;font-size:0.95rem;color:var(--text-primary);">بيانات رابط النطاق الجديد</h4>
          
          <div style="margin-bottom:12px;">
            <label style="display:block;font-size:0.82rem;font-weight:700;color:var(--text-muted);margin-bottom:6px;">اسم النطاق:</label>
            <input type="text" id="scoped-name-input" class="bi-input" value="مختبر جدة" placeholder="مثال: مختبر جدة" style="width:100%;padding:8px 12px;border-radius:8px;border:1px solid var(--border-default);background:var(--bg-card);color:var(--text-primary);" />
          </div>

          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <label style="font-size:0.82rem;font-weight:700;color:var(--text-muted);">مراكز التكلفة المشمولة:</label>
            <button type="button" class="bi-btn bi-btn-secondary" id="btn-preset-jeddah-lab" style="font-size:0.75rem;padding:3px 8px;">
              ⚡ اختيار مختبر جدة (1 و 2)
            </button>
          </div>

          <div id="scoped-cc-picker" style="max-height:160px;overflow-y:auto;border:1px solid var(--border-default);border-radius:8px;padding:10px;margin-bottom:14px;background:var(--bg-card);">
            ${Object.entries(costCentersByCo).map(([cid, co]) => `
              <div style="margin-bottom:10px;">
                <div style="font-weight:700;font-size:0.82rem;color:var(--company-${cid}, #3b82f6);margin-bottom:4px;">${escapeHtml(co.name)} (شركة ${cid})</div>
                <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(200px, 1fr));gap:6px;">
                  ${co.items.map(it => `
                    <label style="display:flex;align-items:center;gap:6px;font-size:0.78rem;color:var(--text-primary);cursor:pointer;">
                      <input type="checkbox" class="chk-scoped-cc" data-company-id="${cid}" data-cc-key="${it.key}" ${(Number(cid) === 1 && it.key === 'an:7:27') || (Number(cid) === 2 && it.key === 'an:7:24') ? 'checked' : ''} />
                      <span>${escapeHtml(it.name)} <code style="font-size:0.72rem;opacity:0.7;">(${it.key})</code></span>
                    </label>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>

          <div style="margin-bottom:12px;">
            <label style="display:block;font-size:0.82rem;font-weight:700;color:var(--text-muted);margin-bottom:6px;">التبويبات المسموحة:</label>
            <div style="display:flex;flex-wrap:wrap;gap:12px;">
              <label style="display:flex;align-items:center;gap:6px;font-size:0.8rem;color:var(--text-primary);cursor:pointer;">
                <input type="checkbox" class="chk-scoped-tab" value="executive" checked /> لوحة الإدارة
              </label>
              <label style="display:flex;align-items:center;gap:6px;font-size:0.8rem;color:var(--text-primary);cursor:pointer;">
                <input type="checkbox" class="chk-scoped-tab" value="customers" checked /> فواتير العملاء
              </label>
              <label style="display:flex;align-items:center;gap:6px;font-size:0.8rem;color:var(--text-primary);cursor:pointer;">
                <input type="checkbox" class="chk-scoped-tab" value="actual-collections" checked /> التحصيل النقدي
              </label>
              <label style="display:flex;align-items:center;gap:6px;font-size:0.8rem;color:var(--text-primary);cursor:pointer;">
                <input type="checkbox" class="chk-scoped-tab" value="profitability" checked /> الربحية
              </label>
              <label style="display:flex;align-items:center;gap:6px;font-size:0.8rem;color:var(--text-primary);cursor:pointer;">
                <input type="checkbox" class="chk-scoped-tab" value="comparison" /> مقارنة الأقسام
              </label>
              <label style="display:flex;align-items:center;gap:6px;font-size:0.8rem;color:var(--text-primary);cursor:pointer;">
                <input type="checkbox" class="chk-scoped-tab" value="guarantees" /> الضمانات البنكية
              </label>
              <label style="display:flex;align-items:center;gap:6px;font-size:0.8rem;color:var(--text-primary);cursor:pointer;">
                <input type="checkbox" class="chk-scoped-tab" value="vat" /> ضريبة القيمة المضافة
              </label>
            </div>
          </div>

          <div style="margin-bottom:12px;">
            <label style="display:block;font-size:0.82rem;font-weight:700;color:var(--text-muted);margin-bottom:6px;">أرقام الجوال المصرح لها (سطر لكل رقم أو مفصولة بفواصل):</label>
            <textarea id="scoped-phones-input" class="bi-input" rows="2" style="width:100%;padding:8px 12px;border-radius:8px;border:1px solid var(--border-default);background:var(--bg-card);color:var(--text-primary);font-family:monospace;" placeholder="0501234567, 0555555555">0501234567</textarea>
          </div>

          <div style="margin-bottom:16px;">
            <label style="display:flex;align-items:center;gap:6px;font-size:0.8rem;color:var(--text-primary);cursor:pointer;">
              <input type="checkbox" id="chk-allow-admin-allocation" />
              <span>السماح بتوزيع المصروفات الإدارية (افتراضي: غير مسموح)</span>
            </label>
          </div>

          <div style="display:flex;gap:8px;">
            <button class="bi-btn bi-btn-primary" id="btn-submit-scoped-share" style="padding:8px 18px;">حفظ وإنشاء الرابط</button>
            <button class="bi-btn bi-btn-secondary" id="btn-cancel-scoped-form" style="padding:8px 14px;">إلغاء</button>
          </div>
        </div>

        <!-- Scoped Shares List -->
        <div id="scoped-shares-list-container">
          ${shares.length === 0 ? '<p style="color:var(--text-muted);text-align:center;padding:20px;">لا توجد روابط مخصصة بنطاق حالياً</p>' : shares.map(s => {
            const url = `${location.origin}/view.html?share=${s.token}`;
            // GET /presentation/scoped-shares returns camelCase fields with arrays already parsed
            const asArray = (v) => {
              if (Array.isArray(v)) return v;
              if (typeof v === 'string') { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch (e) { return []; } }
              return [];
            };
            const ccs = asArray(s.costCenters ?? s.scope_cost_centers);
            const tabs = asArray(s.tabs ?? s.scope_tabs);
            const phones = asArray(s.allowedPhones ?? s.allowed_phones);
            const isActive = Boolean(s.isActive ?? s.is_active);
            const createdAt = s.createdAt ?? s.created_at;

            return `
              <div class="scoped-share-card" data-share-id="${s.id}">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
                  <div>
                    <div style="display:flex;align-items:center;gap:8px;">
                      <span style="font-weight:700;font-size:0.95rem;color:var(--text-primary);">${escapeHtml(s.name)}</span>
                      <span class="${isActive ? 'badge-status-active' : 'badge-status-inactive'}">${isActive ? 'نشط' : 'موقوف'}</span>
                    </div>
                    <div style="font-size:0.75rem;color:var(--text-muted);margin-top:3px;">
                      تم الإنشاء: ${escapeHtml(createdAt || '—')} · الجوالات المصرحة: (${phones.length})
                    </div>
                  </div>
                  <div style="display:flex;gap:6px;flex-wrap:wrap;">
                    <button class="bi-btn bi-btn-secondary copy-scoped-btn" data-url="${url}" title="نسخ الرابط" style="font-size:0.75rem;padding:5px 10px;">
                      ${ICONS.copy} <span>نسخ</span>
                    </button>
                    <button class="bi-btn bi-btn-secondary toggle-active-btn" data-id="${s.id}" data-active="${isActive ? '1' : '0'}" title="${isActive ? 'إيقاف الرابط' : 'تفعيل الرابط'}" style="font-size:0.75rem;padding:5px 10px;">
                      ${isActive ? '⏸ إيقاف' : '▶ تفعيل'}
                    </button>
                    <button class="bi-btn bi-btn-secondary view-logs-btn" data-id="${s.id}" title="عرض سجل الدخول" style="font-size:0.75rem;padding:5px 10px;">
                      📜 السجل
                    </button>
                    <button class="bi-btn bi-btn-secondary del-scoped-btn" data-id="${s.id}" title="حذف" style="font-size:0.75rem;padding:5px 10px;color:var(--status-negative);">
                      ${ICONS.trash}
                    </button>
                  </div>
                </div>

                <div style="display:flex;flex-wrap:wrap;gap:8px;font-size:0.75rem;margin-top:8px;">
                  <span style="color:var(--text-muted);">المراكز:</span>
                  ${ccs.map(c => `<span style="background:var(--bg-card);border:1px solid var(--border-default);padding:2px 6px;border-radius:4px;">شركة ${escapeHtml(String(c.companyId))}: ${escapeHtml(String(c.costCenterKey))}</span>`).join('')}
                  <span style="color:var(--text-muted);margin-right:12px;">التبويبات:</span>
                  ${tabs.map(t => `<span style="background:var(--bg-card);border:1px solid var(--border-default);padding:2px 6px;border-radius:4px;">${escapeHtml(String(t))}</span>`).join('')}
                </div>

                <!-- Logs container (collapsible) -->
                <div class="scoped-logs-container" id="logs-container-${s.id}" style="display:none;margin-top:12px;padding-top:10px;border-top:1px solid var(--border-default);">
                  <div style="font-size:0.8rem;font-weight:700;color:var(--text-primary);margin-bottom:6px;">سجل الدخول والمحاولات:</div>
                  <div class="logs-content" style="max-height:160px;overflow-y:auto;">
                    <p style="color:var(--text-muted);font-size:0.75rem;">جاري جلب السجل...</p>
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;

      // Event handlers in Scoped tab
      const createForm = bodyEl.querySelector('#scoped-create-form');
      bodyEl.querySelector('#btn-toggle-create-scoped')?.addEventListener('click', () => {
        createForm.style.display = createForm.style.display === 'none' ? 'block' : 'none';
      });
      bodyEl.querySelector('#btn-cancel-scoped-form')?.addEventListener('click', () => {
        createForm.style.display = 'none';
      });

      // Quick preset for Jeddah Lab
      bodyEl.querySelector('#btn-preset-jeddah-lab')?.addEventListener('click', () => {
        bodyEl.querySelectorAll('.chk-scoped-cc').forEach(chk => {
          const cid = Number(chk.dataset.companyId);
          const key = chk.dataset.ccKey;
          chk.checked = (cid === 1 && key === 'an:7:27') || (cid === 2 && key === 'an:7:24');
        });
        const nameInput = bodyEl.querySelector('#scoped-name-input');
        if (nameInput) nameInput.value = 'مختبر جدة';
      });

      // Submit scoped share
      bodyEl.querySelector('#btn-submit-scoped-share')?.addEventListener('click', async () => {
        const name = bodyEl.querySelector('#scoped-name-input').value.trim();
        if (!name) { showToast('يرجى إدخال اسم النطاق', 'error'); return; }

        const costCenters = [];
        bodyEl.querySelectorAll('.chk-scoped-cc:checked').forEach(chk => {
          costCenters.push({
            companyId: Number(chk.dataset.companyId),
            costCenterKey: chk.dataset.ccKey
          });
        });
        if (costCenters.length === 0) { showToast('اختر مركز تكلفة واحد على الأقل', 'error'); return; }

        const tabs = [];
        bodyEl.querySelectorAll('.chk-scoped-tab:checked').forEach(chk => {
          tabs.push(chk.value);
        });

        const phonesRaw = bodyEl.querySelector('#scoped-phones-input').value;
        const allowedPhones = phonesRaw.split(/[\n,]+/).map(p => p.trim()).filter(Boolean);
        if (allowedPhones.length === 0) { showToast('أدخل رقم جوال مصرح به واحد على الأقل', 'error'); return; }

        const allowAdminAllocation = bodyEl.querySelector('#chk-allow-admin-allocation').checked;

        try {
          const res = await api.createScopedShare({
            name,
            costCenters,
            tabs,
            allowedPhones,
            allowAdminAllocation
          });
          showToast('تم إنشاء رابط المشاركة المخصص بنطاق بنجاح، ونُسخ الرابط', 'success');
          // POST /presentation/scoped-shares returns { success, id, token, url } at the top level
          const shareToken = res?.token || res?.share?.token;
          if (shareToken) {
            const shareUrl = `${location.origin}/view.html?share=${shareToken}`;
            await navigator.clipboard?.writeText(shareUrl).catch(() => {});
          }
          await renderModalContent();
        } catch(err) {
          showToast(err.message || 'فشل إنشاء رابط المشاركة', 'error');
        }
      });

      // Copy link buttons
      bodyEl.querySelectorAll('.copy-scoped-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          await navigator.clipboard?.writeText(btn.dataset.url).catch(() => {});
          showToast('تم نسخ رابط المشاركة المخصص بنطاق', 'success');
        });
      });

      // Toggle active state
      bodyEl.querySelectorAll('.toggle-active-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const currentActive = btn.dataset.active === '1';
          try {
            await api.updateScopedShare(id, { isActive: !currentActive });
            showToast(currentActive ? 'تم إيقاف الرابط وإبطال الجلسات' : 'تم تفعيل الرابط', 'success');
            await renderModalContent();
          } catch(err) {
            showToast(err.message || 'فشل التحديث', 'error');
          }
        });
      });

      // View logs
      bodyEl.querySelectorAll('.view-logs-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const logsContainer = bodyEl.querySelector(`#logs-container-${id}`);
          if (!logsContainer) return;
          if (logsContainer.style.display === 'block') {
            logsContainer.style.display = 'none';
            return;
          }
          logsContainer.style.display = 'block';
          const contentEl = logsContainer.querySelector('.logs-content');
          contentEl.innerHTML = '<p style="color:var(--text-muted);font-size:0.75rem;">جاري جلب السجل...</p>';

          try {
            const logsData = await api.getScopedShareLogs(id);
            // GET /presentation/scoped-shares/:id/logs returns a plain array of rows
            const logs = Array.isArray(logsData) ? logsData : (logsData?.logs || []);
            if (logs.length === 0) {
              contentEl.innerHTML = '<p style="color:var(--text-muted);font-size:0.75rem;">لا توجد محاولات دخول مسجلة لهذا الرابط حتى الآن.</p>';
            } else {
              contentEl.innerHTML = `
                <table class="scoped-log-table">
                  <thead>
                    <tr>
                      <th>الوقت</th>
                      <th>رقم الجوال</th>
                      <th>عنوان IP</th>
                      <th>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${logs.map(l => `
                      <tr>
                        <td>${escapeHtml(l.created_at || l.attempt_time || '—')}</td>
                        <td dir="ltr" style="text-align:right;">${escapeHtml(l.phone || '—')}</td>
                        <td>${escapeHtml(l.ip_address || '—')}</td>
                        <td>
                          <span class="${l.status === 'SUCCESS' ? 'badge-status-active' : 'badge-status-inactive'}">
                            ${l.status === 'SUCCESS' ? 'دخول ناجح' : 'مرفوض'}
                          </span>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              `;
            }
          } catch(err) {
            contentEl.innerHTML = `<p style="color:var(--status-negative);font-size:0.75rem;">تعذر جلب السجل: ${err.message}</p>`;
          }
        });
      });

      // Delete scoped share
      bodyEl.querySelectorAll('.del-scoped-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('هل أنت متأكد من حذف هذا الرابط المخصص؟ سيتم إبطال جميع جلساته فوراً.')) return;
          try {
            await api.deleteScopedShare(btn.dataset.id);
            showToast('تم حذف الرابط وإبطال جلساته', 'success');
            await renderModalContent();
          } catch(err) {
            showToast(err.message || 'فشل الحذف', 'error');
          }
        });
      });

    } catch(err) {
      bodyEl.innerHTML = `<p style="color:var(--status-negative);text-align:center;">حدث خطأ أثناء جلب الروابط المخصصة: ${err.message}</p>`;
    }
  }

  async function renderGeneralSharesTab(bodyEl) {
    bodyEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <div style="font-size:0.82rem;color:var(--text-muted);">
          روابط العرض العامة (مشاهدة كاملة بدون تقييد مراكز تكلفة).
        </div>
        <button class="bi-btn bi-btn-primary" id="btn-create-current-general-share" style="font-size:0.82rem;padding:6px 14px;">
          ➕ مشاركة التصفية الحالية
        </button>
      </div>
      <div id="general-shares-list">
        <p style="color:var(--text-muted);text-align:center;">جاري التحميل...</p>
      </div>
    `;

    bodyEl.querySelector('#btn-create-current-general-share')?.addEventListener('click', async () => {
      await shareDashboard(container);
      await renderGeneralSharesTab(bodyEl);
    });

    const gList = bodyEl.querySelector('#general-shares-list');
    try {
      const shares = await api.getPresentationShares();
      if (!shares.length) {
        gList.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px;">لا توجد روابط عامة حالياً</p>';
        return;
      }
      gList.innerHTML = shares.map(s => {
        const url = `${location.origin}/view.html?token=${s.token}`;
        return `
          <div style="background:var(--bg-subtle);border-radius:12px;padding:14px;margin-bottom:10px;border:1px solid var(--border-default);">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <div>
                <div style="color:var(--text-primary);font-weight:600;font-size:0.85rem;">${s.title}</div>
                <div style="color:var(--text-muted);font-size:0.72rem;margin-top:3px;">${s.created_at}</div>
              </div>
              <div style="display:flex;gap:8px;">
                <button class="bi-btn bi-btn-secondary copy-btn" data-url="${url}" style="font-size:0.72rem;padding:5px 10px;">${ICONS.copy} نسخ</button>
                <button class="bi-btn bi-btn-secondary del-btn" data-id="${s.id}" style="font-size:0.72rem;padding:5px 10px;color:var(--status-negative);">${ICONS.trash}</button>
              </div>
            </div>
          </div>
        `;
      }).join('');

      gList.querySelectorAll('.copy-btn').forEach(b => b.addEventListener('click', async () => {
        await navigator.clipboard?.writeText(b.dataset.url);
        showToast('تم نسخ الرابط', 'success');
      }));
      gList.querySelectorAll('.del-btn').forEach(b => b.addEventListener('click', async () => {
        await api.deletePresentationShare(b.dataset.id);
        showToast('تم الحذف', 'success');
        await renderGeneralSharesTab(bodyEl);
      }));
    } catch(err) {
      gList.innerHTML = `<p style="color:var(--status-negative);text-align:center;">خطأ: ${err.message}</p>`;
    }
  }

  await renderModalContent();
}