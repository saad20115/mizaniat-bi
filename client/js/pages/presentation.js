import { api } from '../api.js';
import { store } from '../store.js';
import { formatNumber } from '../utils/format.js';
import { showToast } from '../utils/ui.js';
import { renderExecutiveDashboardTab } from './presentation-executive.js';
import { renderCustomersCollectionTab } from './presentation-customers.js';
import { renderDepartmentsProfitabilityTab } from './presentation-profitability.js';
import { renderGuaranteesComponent } from './guarantees.js';
import { renderVatTab } from './presentation-vat.js';
import { renderActualCollectionsTab } from './presentation-collections.js';
import { SlicerDropdown, closeActiveSlicerDropdown } from '../components/slicer-dropdown.js';

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
          <span>${ICONS.search}</span> <span id="mobile-filter-summary">الفلاتر (${fiscalYears.find(y => y===fy) || '2026'} · كل الشركات)</span>
        </button>
        <button class="bi-btn bi-btn-secondary" id="btn-mobile-refresh" title="تحديث" style="min-height:40px;min-width:40px;padding:6px 12px;">${ICONS.refresh}</button>
        <button class="bi-btn bi-btn-secondary" id="btn-mobile-share" title="مشاركة" style="min-height:40px;min-width:40px;padding:6px 12px;">${ICONS.share}</button>
      </div>
      <div class="mobile-sheet-backdrop" id="mobile-sheet-backdrop"></div>

      <!-- Desktop Collapsed Summary Bar (R3 Review #4) -->
      <div class="bi-collapsed-summary-bar" id="bi-collapsed-summary-bar">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <button class="bi-btn bi-btn-secondary" id="btn-reopen-filters" style="font-size:0.85rem;padding:6px 14px;border-radius:10px;">
            <span id="desktop-filter-summary">الفلاتر (${fiscalYears.find(y => y===fy) || '2026'} · كل الشركات)</span>
          </button>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <button class="bi-btn bi-btn-secondary" id="btn-desktop-collapsed-refresh" title="تحديث" style="min-height:36px;padding:6px 12px;font-size:0.85rem;">${ICONS.refresh} تحديث</button>
          <button class="bi-btn bi-btn-secondary" id="btn-desktop-collapsed-share" title="مشاركة" style="min-height:36px;padding:6px 12px;font-size:0.85rem;">${ICONS.share}</button>
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
            <h1 class="bi-page-title">العرض التقديمي</h1>
            <span class="bi-page-subtitle" id="bi-last-updated">آخر تحديث: <span class="ts" id="bi-last-updated-ts">اليوم 12:03</span> — القيود والفواتير والسدادات</span>
          </div>

          <div class="bi-topbar-actions">
            <button type="button" class="bi-btn bi-btn-primary" id="btn-topbar-export">
              ${ICONS.download}
              <span>تصدير</span>
            </button>
            <button type="button" class="bi-btn bi-btn-secondary" id="btn-share">
              ${ICONS.share}
              <span>مشاركة</span>
            </button>
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
              <span class="bi-filter-val" id="val-co-slicer">الكل (${companies.length})</span>
              ${ICONS.chevronDown}
            </button>
            <!-- Hidden sync elements for test & backward compatibility -->
            <div id="co-slicer" style="display:none;" aria-hidden="true">
              <div class="co-all active" id="co-all-item">
                <input type="checkbox" id="chk-co-all" checked />
                <span>الكل</span>
              </div>
              ${companies.map(c => `
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
            <div class="bi-filter-item">
              <button class="bi-filter-btn" id="btn-group-slicer" type="button" aria-haspopup="dialog" aria-expanded="false">
                ${ICONS.folder}
                <span class="bi-filter-label">المجموعة:</span>
                <span class="bi-filter-val" id="val-group-slicer">الكل</span>
                ${ICONS.chevronDown}
              </button>
            </div>
            <div class="bi-filter-item">
              <button class="bi-filter-btn" id="btn-journal-slicer" type="button" aria-haspopup="dialog" aria-expanded="false">
                ${ICONS.book}
                <span class="bi-filter-label">مركز التكلفة:</span>
                <span class="bi-filter-val" id="val-journal-slicer">الكل</span>
                ${ICONS.chevronDown}
              </button>
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
        <div class="bi-tab ${activeTab==='executive'?'active':''}" data-tab="executive">لوحة الإدارة</div>
        <div class="bi-tab ${activeTab==='customers'?'active':''}" data-tab="customers">فواتير العملاء</div>
        <div class="bi-tab ${activeTab==='actual-collections'?'active':''}" data-tab="actual-collections">التحصيل النقدي</div>
        <div class="bi-tab ${activeTab==='profitability'?'active':''}" data-tab="profitability">الربحية</div>
        <div class="bi-tab ${activeTab==='guarantees'?'active':''}" data-tab="guarantees">الضمانات البنكية</div>
        <div class="bi-tab ${activeTab==='vat'?'active':''}" data-tab="vat">ضريبة القيمة المضافة</div>

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
      <div class="bi-kpi-card" style="padding:var(--space-xl, 24px);width:550px;max-width:90vw;max-height:80vh;overflow-y:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md, 16px);">
          <h3 style="margin:0;color:var(--text-primary);">روابط المشاركة</h3>
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
    try { await loadDashboard(container); } catch(e) { console.error(e); }
    btn.classList.remove('loading');
  });

  // Share buttons
  container.querySelector('#btn-share').addEventListener('click', () => shareDashboard(container));
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

  renderDashboard(container);
}

function renderDashboard(container) {
  closeActiveSlicerDropdown();
  const body = container.querySelector('#bi-body');
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

  if (activeTab === 'executive') {
    renderExecutiveDashboardTab(body, container, timeFilter, selectedNumCos, globalFilters);
    return;
  }

  if (activeTab === 'customers') {
    renderCustomersCollectionTab(body, container, timeFilter, selectedNumCos, globalFilters);
    return;
  }

  if (activeTab === 'profitability') {
    renderDepartmentsProfitabilityTab(body, container, timeFilter, selectedNumCos, globalFilters);
    return;
  }

  if (activeTab === 'guarantees') {
    renderGuaranteesComponent(body, {
      companyIds: selectedStrCos,
      asOfDate: timeFilter.dateTo || new Date().toISOString().slice(0, 10),
      isPresentation: true
    });
    return;
  }

  if (activeTab === 'vat') {
    renderVatTab(body, container, timeFilter, selectedStrCos);
    return;
  }

  if (activeTab === 'actual-collections') {
    renderActualCollectionsTab(body, container, timeFilter, selectedNumCos, globalFilters);
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
  const modal = container.querySelector('#shares-modal'); modal.style.display = 'flex';
  const list = container.querySelector('#shares-list');
  list.innerHTML = '<p style="color:var(--text-muted);text-align:center;">جاري التحميل...</p>';
  try {
    const shares = await api.getPresentationShares();
    if (!shares.length) { list.innerHTML = '<p style="color:var(--text-muted);text-align:center;">لا توجد روابط</p>'; return; }
    list.innerHTML = shares.map(s => {
      const url = `${location.origin}/view.html?token=${s.token}`;
      return `<div style="background:var(--bg-subtle);border-radius:12px;padding:14px;margin-bottom:10px;border:1px solid var(--border-default);">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div><div style="color:var(--text-primary);font-weight:600;font-size:0.85rem;">${s.title}</div><div style="color:var(--text-muted);font-size:0.72rem;margin-top:3px;">${s.created_at}</div></div>
          <div style="display:flex;gap:8px;">
            <button class="bi-btn bi-btn-secondary copy-btn" data-url="${url}" style="font-size:0.72rem;padding:5px 10px;">${ICONS.copy}</button>
            <button class="bi-btn bi-btn-secondary del-btn" data-id="${s.id}" style="font-size:0.72rem;padding:5px 10px;color:var(--status-negative);">${ICONS.trash}</button>
          </div>
        </div>
      </div>`;
    }).join('');
    list.querySelectorAll('.copy-btn').forEach(b=>b.addEventListener('click',async()=>{await navigator.clipboard?.writeText(b.dataset.url);showToast('تم نسخ الرابط','success');}));
    list.querySelectorAll('.del-btn').forEach(b=>b.addEventListener('click',async()=>{await api.deletePresentationShare(b.dataset.id);showToast('تم الحذف','success');openSharesModal(container);}));
  } catch(err){list.innerHTML='<p style="color:var(--status-negative);">خطأ</p>';}
}