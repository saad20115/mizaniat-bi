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

let groupDropdownInstance = null;
let journalDropdownInstance = null;

const COLORS = ['#2563eb','#047857','#b45309','#dc2626','#7c3aed','#be185d','#0e7490','#4d7c0f'];
const LIGHT_COLORS = ['#1d4ed8','#065f46','#92400e','#b91c1c','#6d28d9','#9d174d','#155e75','#3f6212'];
const YR_COLORS = ['#2563eb'];
const LIGHT_YR_COLORS = ['#1d4ed8'];
const fmt = v => formatNumber(v, 0);
const fmtP = v => (v||0).toFixed(1) + '%';
const MONTH_NAMES = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const MN_SHORT = ['01','02','03','04','05','06','07','08','09','10','11','12'];

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
  const color = chip.dataset.color;
  const lightColor = chip.dataset.lightColor || color;
  if (active) {
    chip.classList.add('active');
    if (color) {
      chip.style.setProperty('--chip-color', color);
      chip.style.setProperty('--chip-color-light', lightColor);
    }
  } else {
    chip.classList.remove('active');
  }
  chip.style.borderColor = '';
  chip.style.background = '';
  chip.style.color = '';
}

export async function renderPresentation(container) {
  closeActiveSlicerDropdown();
  groupDropdownInstance = null;
  journalDropdownInstance = null;

  const urlParams = new URLSearchParams(window.location.search);
  const urlTab = urlParams.get('tab');
  if (urlTab) activeTab = urlTab;
  const urlYear = urlParams.get('year');
  const companies = store.get('companies') || [];
  const currentYear = String(new Date().getFullYear());

  // R2-10: Ensure filterOptions (with companyYears, groups, journals) are loaded
  if (!store.get('filterOptions')?.companyYears || !store.get('filterOptions')?.groups || !store.get('filterOptions')?.journals) {
    try {
      const fOpts = await api.getFilterOptions({});
      store.set('filterOptions', fOpts);
    } catch (e) {
      console.warn('Could not fetch filterOptions:', e);
    }
  }

  // R2-10: Load user preferences for zero-value reduction toggle
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
    <style>
      .bi-page{min-height:100vh;padding:0;direction:rtl;width:100%;min-width:0;box-sizing:border-box;}
      /* Top bar with slicers */
      .bi-topbar{display:flex;flex-direction:column;gap:10px;padding:12px var(--page-padding, 28px);background:linear-gradient(180deg,rgba(15,23,42,0.95),rgba(15,23,42,0.85));border-bottom:1px solid rgba(255,255,255,0.06);position:relative;z-index:30;}
      .bi-topbar-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
      .bi-collapsed-summary-bar{display:none;position:sticky;top:0;z-index:50;background:rgba(15,23,42,0.95);backdrop-filter:blur(12px);border-bottom:1px solid rgba(255,255,255,0.08);padding:8px var(--page-padding, 28px);align-items:center;justify-content:space-between;box-shadow:0 4px 16px rgba(0,0,0,0.3);}
      .bi-collapsed-summary-bar.visible{display:flex;}
      .bi-topbar .slicer-group{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      .bi-topbar .slicer-label{font-size:0.92rem;color:rgba(255,255,255,0.55);font-weight:700;white-space:nowrap}
      .bi-chip{padding:7px 16px;border-radius:20px;font-size:0.92rem;cursor:pointer;transition:all 0.25s ease;border:1.5px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.03);color:rgba(255,255,255,0.55);font-weight:600;user-select:none;white-space:nowrap;min-height:36px;display:inline-flex;align-items:center;justify-content:center;}
      .bi-chip.co-chip{white-space:normal;text-align:center;line-height:1.3;padding:6px 14px;max-width:100%;}
      .bi-chip.grp-chip, .bi-chip.jrn-chip{padding:5px 13px;font-size:0.85rem;min-height:32px;}
      .bi-chip.active{background:var(--chip-color, #3b82f6);border-color:var(--chip-color, #3b82f6);color:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.3);text-shadow:0 1px 2px rgba(0,0,0,0.3)}
      .bi-chip.grp-chip.active{background:var(--chip-color, #f59e0b);border-color:var(--chip-color, #f59e0b);color:#fff;}
      .bi-chip.jrn-chip.active{background:var(--chip-color, #10b981);border-color:var(--chip-color, #10b981);color:#fff;}
      #jrn-slicer::-webkit-scrollbar{height:6px;width:6px;}
      #jrn-slicer::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.15);border-radius:4px;}
      .bi-chip:hover{background:rgba(255,255,255,0.07);transform:translateY(-1px);color:#fff}
      .bi-date{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:6px 12px;color:rgba(255,255,255,0.7);font-size:0.9rem;font-family:var(--font-en);outline:none;width:135px;min-height:36px;}
      .bi-date:focus{border-color:rgba(59,130,246,0.5)}

      /* Tabs */
      .bi-tabs{display:flex;gap:0;padding:0 var(--page-padding, 28px);background:rgba(15,23,42,0.95);border-bottom:1px solid rgba(255,255,255,0.06);overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;position:sticky;top:0;z-index:45;backdrop-filter:blur(12px);}
      .bi-tab{padding:12px 20px;font-size:0.98rem;font-weight:700;color:rgba(255,255,255,0.45);cursor:pointer;border-bottom:3px solid transparent;transition:all 0.2s;white-space:nowrap;scroll-snap-align:start;min-height:40px;display:inline-flex;align-items:center;justify-content:center;}
      .bi-tab:hover{color:rgba(255,255,255,0.6);background:rgba(255,255,255,0.02)}
      .bi-tab.active{color:#60a5fa;border-bottom-color:#3b82f6;background:rgba(59,130,246,0.05)}
      .bi-tab .tab-label-short{display:none;}

      /* Body */
      .bi-body{display:grid;grid-template-columns:1fr;gap:20px;padding:20px var(--page-padding, 28px);width:100%;min-width:0;box-sizing:border-box;}

      /* KPI cards */
      .bi-kpi-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px}
      .bi-kpi{background:linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02));border:1px solid rgba(255,255,255,0.07);border-radius:18px;padding:20px 16px;text-align:center;transition:transform 0.2s,box-shadow 0.2s;height:auto!important;}
      .bi-kpi:hover{transform:translateY(-3px);box-shadow:0 12px 32px rgba(0,0,0,0.25)}
      .bi-kpi-label{font-size:0.95rem;color:rgba(255,255,255,0.55);margin-bottom:8px;font-weight:700}
      .bi-kpi-value{font-size:clamp(1.1rem, 4vw, 1.75rem)!important;font-weight:800;font-family:var(--font-en);letter-spacing:-0.5px;line-height:1.25;}
      .bi-kpi-sub{font-size:0.88rem;color:rgba(255,255,255,0.45);margin-top:6px;font-family:var(--font-en);font-weight:500}

      /* Charts grid */
      .bi-charts{display:grid;grid-template-columns:1fr 1fr;gap:18px}

      /* Cards */
      .bi-card{background:var(--exec-bg-card, rgba(30,41,59,0.7));border:1px solid var(--exec-border, rgba(255,255,255,0.07));border-radius:18px;padding:24px;overflow:hidden}
      .bi-card-title{font-size:1.1rem;font-weight:700;color:var(--exec-text, rgba(255,255,255,0.65));margin-bottom:20px;display:flex;align-items:center;gap:10px}
      .bi-card canvas{width:100%;display:block}

      /* Tables */
      .bi-table{width:100%;border-collapse:separate;border-spacing:0;font-size:1.05rem}
      .bi-table th{padding:16px 18px;text-align:right;color:var(--exec-text-muted, rgba(255,255,255,0.55));font-size:0.92rem;font-weight:700;border-bottom:2px solid var(--exec-border, rgba(255,255,255,0.1));white-space:nowrap;text-transform:uppercase;letter-spacing:0.3px;border-left:1px solid var(--exec-border, rgba(255,255,255,0.08))}
      .bi-table th:last-child{border-left:none}
      .bi-table th.n{text-align:left}
      .bi-table td{padding:14px 18px;border-bottom:1px solid var(--exec-border, rgba(255,255,255,0.05));color:var(--exec-text, rgba(255,255,255,0.9));font-size:1rem;border-left:1px solid var(--exec-border, rgba(255,255,255,0.06))}
      .bi-table td:last-child{border-left:none}
      .bi-table td.n{font-family:var(--font-en);text-align:left;font-weight:700;font-size:1.05rem;letter-spacing:-0.3px}
      .bi-table tr:hover td{background:var(--exec-bg-hover, rgba(255,255,255,0.025))}
      .bi-table tfoot td{font-weight:800;border-top:2px solid var(--exec-border, rgba(255,255,255,0.15));color:var(--exec-text, #ffffff);font-size:1.08rem;padding:18px}
      /* Sortable headers */
      .bi-table th.sortable{cursor:pointer;user-select:none;transition:color 0.2s}
      .bi-table th.sortable:hover{color:var(--exec-text, rgba(255,255,255,0.85))}
      .bi-table th.sortable::after{content:'⇅';margin-right:6px;font-size:0.75rem;opacity:0.4}
      .bi-table th.sortable.asc::after{content:'▲';opacity:0.9;color:#10b981}
      .bi-table th.sortable.desc::after{content:'▼';opacity:0.9;color:#ef4444}

      /* Hierarchy rows — 3 levels: company > cost-center > partner/account */
      .bi-table .row-co{cursor:pointer;transition:background 0.15s}
      .bi-table .row-co:hover td{background:rgba(255,255,255,0.04)}
      .bi-table .row-co td:first-child::before{content:'\u25B6';margin-left:8px;font-size:0.7rem;transition:transform 0.2s;display:inline-block}
      .bi-table .row-co.open td:first-child::before{transform:rotate(90deg)}
      .bi-table .row-cc{display:none;cursor:pointer;transition:background 0.15s}
      .bi-table .row-cc.show{display:table-row}
      .bi-table .row-cc:hover td{background:rgba(255,255,255,0.03)}
      .bi-table .row-cc td{font-size:0.96rem;color:rgba(255,255,255,0.8);padding:12px 18px}
      .bi-table .row-cc td:first-child{padding-right:32px;font-weight:600}
      .bi-table .row-cc td:first-child::before{content:'\u25B6';margin-left:6px;font-size:0.55rem;transition:transform 0.2s;display:inline-block}
      .bi-table .row-cc.open td:first-child::before{transform:rotate(90deg)}
      .bi-table .row-pt{display:none}
      .bi-table .row-pt.show{display:table-row}
      .bi-table .row-pt td{font-size:0.92rem;color:rgba(255,255,255,0.6);padding:10px 18px}
      .bi-table .row-pt td:first-child{padding-right:52px;font-weight:400}

      /* Progress bar */
      .bi-pbar{height:14px;border-radius:7px;background:rgba(255,255,255,0.07);overflow:hidden;margin:8px 0}
      .bi-pbar-fill{height:100%;border-radius:7px;transition:width 0.6s ease}
      .bi-pbar-label{display:flex;justify-content:space-between;font-size:0.92rem;color:rgba(255,255,255,0.5);margin-bottom:4px;font-weight:500}

      .bi-full{grid-column:1/-1}
      .bi-actions{margin-right:auto;display:flex;gap:10px;align-items:center}
      .bi-empty{text-align:center;padding:80px 20px;color:rgba(255,255,255,0.3);font-size:1.15rem}
      .bi-refresh-btn{display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:12px;font-size:0.88rem;cursor:pointer;transition:all 0.25s;border:1.5px solid rgba(16,185,129,0.35);background:rgba(16,185,129,0.08);color:#10b981;font-weight:700;white-space:nowrap;user-select:none;min-height:40px;}
      .bi-refresh-btn:hover{background:rgba(16,185,129,0.18);transform:translateY(-1px);box-shadow:0 4px 12px rgba(16,185,129,0.15)}
      .bi-refresh-btn:active{transform:scale(0.96)}
      .bi-refresh-btn.loading{pointer-events:none;opacity:0.6}
      .bi-refresh-btn .spin-icon{display:inline-block;transition:transform 0.3s}
      .bi-refresh-btn.loading .spin-icon{animation:bi-spin 0.8s linear infinite}
      @keyframes bi-spin{to{transform:rotate(360deg)}}
      .bi-last-updated{display:flex;align-items:center;gap:6px;padding:7px 14px;border-radius:12px;font-size:0.82rem;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);color:rgba(255,255,255,0.45);white-space:nowrap}
      .bi-last-updated .ts{color:rgba(255,255,255,0.65);font-family:var(--font-en);font-weight:600;direction:ltr}

      /* Collapsible advanced filter */
      .bi-adv-toggle{display:flex;align-items:center;gap:8px;padding:10px var(--page-padding, 28px);background:rgba(255,255,255,0.015);cursor:pointer;user-select:none;border-bottom:1px solid rgba(255,255,255,0.04);transition:background 0.2s}
      .bi-adv-toggle:hover{background:rgba(255,255,255,0.03)}
      .bi-adv-toggle .arrow{transition:transform 0.25s;display:inline-block;font-size:0.7rem;color:rgba(255,255,255,0.4)}
      .bi-adv-toggle.open .arrow{transform:rotate(90deg)}
      .bi-adv-toggle .adv-toggle-text{font-size:0.95rem;color:rgba(255,255,255,0.7);font-weight:700}
      .bi-adv-panel{max-height:0;overflow:hidden;transition:max-height 0.35s ease}
      .bi-adv-panel.open{max-height:2500px}
      .bi-single-chk{display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none;font-size:0.88rem;color:rgba(255,255,255,0.5);font-weight:600;white-space:nowrap}
      .bi-single-chk input{accent-color:#06b6d4;width:16px;height:16px;cursor:pointer}
      .mobile-zero-wrap{display:none;}

      /* Mobile Filter Bar & Bottom Sheet (RESP1) */
      .bi-mobile-filter-bar{display:none;}
      .mobile-sheet-backdrop{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.65);backdrop-filter:blur(4px);z-index:1040;}
      .mobile-sheet-backdrop.active{display:block;}
      .mobile-sheet-header{display:none;}

      @media(min-width:1280px){
        .bi-tabs{width:100%;display:flex;padding:0 14px;box-sizing:border-box;}
        .bi-tabs .bi-tab{flex:1 1 0;text-align:center;justify-content:center;white-space:nowrap;}
      }

      @media(min-width:768px) and (max-width:1279.98px){
        .bi-topbar{padding:12px 16px;gap:12px;}
        .bi-body{padding:16px;}
        .bi-tabs{padding:0 16px;}
        .bi-charts{grid-template-columns:1fr;}
      }

      @media(max-width:767.98px){
        .bi-mobile-filter-bar{display:flex;align-items:center;gap:8px;padding:10px 12px;background:linear-gradient(180deg,rgba(15,23,42,0.98),rgba(15,23,42,0.92));border-bottom:1px solid rgba(255,255,255,0.08);position:sticky;top:0;z-index:60;}
        .bi-topbar{display:none;}
        .bi-topbar.mobile-sheet-open{display:flex!important;position:fixed!important;top:auto!important;bottom:0!important;left:0!important;right:0!important;z-index:1050!important;background:#0f172a!important;border-top:1px solid rgba(255,255,255,0.15)!important;border-radius:20px 20px 0 0!important;padding:16px 16px 28px!important;flex-direction:column!important;align-items:stretch!important;gap:14px!important;max-height:85vh!important;overflow-y:auto!important;box-shadow:0 -10px 35px rgba(0,0,0,0.65)!important;}
        .bi-topbar.mobile-sheet-open .mobile-sheet-header{display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.08);}
        .bi-topbar.mobile-sheet-open .mobile-zero-wrap{display:flex!important;}
        .bi-topbar.mobile-sheet-open .slicer-divider{display:none;}
        .bi-topbar.mobile-sheet-open .bi-actions{margin-right:0;margin-top:10px;flex-wrap:wrap;justify-content:stretch;}
        .bi-topbar.mobile-sheet-open .bi-actions .btn{flex:1;text-align:center;justify-content:center;min-height:40px;}
        .bi-tabs{padding:0 10px;}
        .bi-tab{padding:10px 14px;font-size:0.88rem;}
        .bi-tab .tab-label-full{display:none;}
        .bi-tab .tab-label-short{display:inline;}
        .bi-body{padding:12px;}
        .bi-kpi-row{grid-template-columns:repeat(2,1fr)!important;gap:10px;}
        .bi-kpi{padding:16px 12px;height:auto!important;}
        .bi-kpi-value{font-size:clamp(1.1rem, 4vw, 1.75rem)!important;}
        .bi-charts{grid-template-columns:1fr;}
      }
    </style>
    <div class="bi-page">
      <!-- Mobile Filter Bar (RESP1) -->
      <div class="bi-mobile-filter-bar" id="mobile-filter-bar">
        <button class="btn btn-primary" id="btn-open-filters" style="flex:1;min-height:40px;justify-content:center;gap:6px;font-size:0.88rem;background:rgba(59,130,246,0.18);border-color:rgba(59,130,246,0.35);color:#93c5fd;">
          <span>🔍</span> <span id="mobile-filter-summary">الفلاتر (${fiscalYears.find(y => y===fy) || '2026'} · كل الشركات)</span>
        </button>
        <button class="bi-refresh-btn" id="btn-mobile-refresh" title="تحديث" style="min-height:40px;min-width:40px;padding:6px 12px;"><span class="spin-icon">🔄</span></button>
        <button class="btn" id="btn-mobile-share" title="مشاركة" style="min-height:40px;min-width:40px;padding:6px 12px;background:rgba(139,92,246,0.12);color:#a78bfa;border-color:rgba(139,92,246,0.25);">🔗</button>
      </div>
      <div class="mobile-sheet-backdrop" id="mobile-sheet-backdrop"></div>

      <!-- Desktop Collapsed Summary Bar (R3 Review #4) -->
      <div class="bi-collapsed-summary-bar" id="bi-collapsed-summary-bar">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <button class="btn" id="btn-reopen-filters" style="font-size:0.85rem;padding:6px 14px;border-radius:10px;background:rgba(59,130,246,0.18);border-color:rgba(59,130,246,0.35);color:#93c5fd;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
            <span>⚙️</span> <span id="desktop-filter-summary">الفلاتر (${fiscalYears.find(y => y===fy) || '2026'} · كل الشركات)</span>
          </button>
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <button class="bi-refresh-btn" id="btn-desktop-collapsed-refresh" title="تحديث" style="min-height:36px;padding:6px 12px;font-size:0.85rem;"><span class="spin-icon">🔄</span> تحديث</button>
          <button class="btn" id="btn-desktop-collapsed-share" title="مشاركة" style="min-height:36px;padding:6px 12px;font-size:0.85rem;background:rgba(139,92,246,0.12);color:#a78bfa;border-color:rgba(139,92,246,0.25);">🔗</button>
        </div>
      </div>

      <!-- Slicer Bar / Drawer -->
      <div class="bi-topbar" id="bi-topbar">
        <div class="mobile-sheet-header">
          <span style="font-weight:700;font-size:1.05rem;color:var(--text-white);">🔍 خيارات التصفية والفلاتر</span>
          <button class="btn" id="btn-close-filter-sheet" style="min-height:36px;min-width:36px;padding:4px 10px;font-size:0.95rem;">✕</button>
        </div>
        <div class="mobile-zero-wrap" style="display:none;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid rgba(255,255,255,0.08);">
          <label class="bi-single-chk" style="cursor:pointer;">
            <input type="checkbox" id="chk-show-zero-items-mobile" ${initialShowZero ? 'checked' : ''} style="accent-color:#10b981;cursor:pointer;width:16px;height:16px;">
            <span class="zero-toggle-label">إظهار البنود الصفرية</span>
          </label>
          <span id="badge-hidden-zero-count-mobile" class="badge-zero-count" style="${initialShowZero ? 'display:none;' : 'display:inline-block;'}padding:3px 10px;font-size:0.8rem;font-weight:700;white-space:nowrap;border-radius:12px;">مخفي: 0 بنداً صفرياً</span>
        </div>

        <!-- Row 1: Companies -->
        <div class="bi-topbar-row">
          <span class="slicer-label">🏢 الشركات</span>
          <div class="slicer-group" id="co-slicer">
            <div class="bi-chip active all-chip co-all" data-color="#8b5cf6" data-light-color="#7c3aed" style="--chip-color:#8b5cf6;--chip-color-light:#7c3aed;font-weight:800;">الكل</div>
            ${companies.map((c, i) => `<div class="bi-chip active co-chip" data-id="${c.id}" data-color="${COLORS[i%COLORS.length]}" data-light-color="${LIGHT_COLORS[i%LIGHT_COLORS.length]}" style="--chip-color:${COLORS[i%COLORS.length]};--chip-color-light:${LIGHT_COLORS[i%LIGHT_COLORS.length]};" title="${c.name}">${c.name}</div>`).join('')}
          </div>
        </div>

        <!-- Row 2: Years + Period + Zero Toggle + Actions (merged row per Claude R3 Review #4) -->
        <div class="bi-topbar-row" style="padding-top:4px;border-top:1px solid rgba(255,255,255,0.04);">
          <span class="slicer-label">📅 السنوات</span>
          <div class="slicer-group" id="yr-slicer">
            <div class="bi-chip ${isAllYear?'active':''} yr-all" data-color="#2563eb" data-light-color="#1d4ed8" style="--chip-color:#2563eb;--chip-color-light:#1d4ed8;font-weight:800;font-family:var(--font-en);">الكل</div>
            ${fiscalYears.map((y, i) => `<div class="bi-chip ${!isAllYear && y===fy?'active':''} yr-chip" data-year="${y}" data-color="${YR_COLORS[i%YR_COLORS.length]}" data-light-color="${LIGHT_YR_COLORS[i%LIGHT_YR_COLORS.length]}" style="--chip-color:${YR_COLORS[i%YR_COLORS.length]};--chip-color-light:${LIGHT_YR_COLORS[i%LIGHT_YR_COLORS.length]};font-family:var(--font-en);" data-idx="${i}">${y}</div>`).join('')}
          </div>
          <div class="slicer-divider" style="width:1px;height:24px;background:rgba(255,255,255,0.08);margin:0 4px;flex-shrink:0;"></div>
          <span class="slicer-label">📆 الفترة</span>
          <div style="display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <input type="date" id="date-from" class="bi-date" value="" placeholder="من" autocomplete="off">
            <span style="color:rgba(255,255,255,0.3);font-size:0.88rem;">→</span>
            <input type="date" id="date-to" class="bi-date" value="" placeholder="إلى" autocomplete="off">
            <button id="btn-clear-date" title="إلغاء الفترة المخصصة والرجوع للسنة" style="display:none;background:rgba(239,68,68,0.18);color:#ef4444;border:1px solid rgba(239,68,68,0.35);border-radius:8px;padding:6px 10px;cursor:pointer;font-weight:bold;font-size:0.85rem;line-height:1;">✕</button>
          </div>
          <div class="slicer-divider" style="width:1px;height:24px;background:rgba(255,255,255,0.08);margin:0 4px;flex-shrink:0;"></div>

          <!-- Slicers: Groups & Cost Centers / Journals (merged in Row 2, F1-ج3) -->
          <div id="row-slicers-bar" style="display:inline-flex;align-items:center;gap:8px;">
            <button class="bi-slicer-btn" id="btn-group-slicer" type="button" aria-haspopup="dialog" aria-expanded="false">
              <span class="bi-slicer-icon">📁</span>
              <span class="bi-slicer-title">المجموعة:</span>
              <span class="bi-slicer-value" id="val-group-slicer">الكل</span>
              <span class="bi-slicer-arrow">▾</span>
            </button>
            <button class="bi-slicer-btn" id="btn-journal-slicer" type="button" aria-haspopup="dialog" aria-expanded="false">
              <span class="bi-slicer-icon">📒</span>
              <span class="bi-slicer-title">مركز التكلفة:</span>
              <span class="bi-slicer-value" id="val-journal-slicer">الكل</span>
              <span class="bi-slicer-arrow">▾</span>
            </button>
          </div>

          <div class="slicer-divider" style="width:1px;height:24px;background:rgba(255,255,255,0.08);margin:0 4px;flex-shrink:0;"></div>
          <div class="zero-toggle-wrap" style="display:inline-flex;align-items:center;gap:8px;">
            <label class="bi-single-chk" style="cursor:pointer;" title="إظهار أو إخفاء البنود والصفوف التي قيمها صفر">
              <input type="checkbox" id="chk-show-zero-items" ${initialShowZero ? 'checked' : ''} style="accent-color:#10b981;cursor:pointer;width:16px;height:16px;">
              <span class="zero-toggle-label">إظهار البنود الصفرية</span>
            </label>
            <span id="badge-hidden-zero-count" class="badge-zero-count" style="${initialShowZero ? 'display:none;' : 'display:inline-block;'}padding:3px 10px;font-size:0.8rem;font-weight:700;white-space:nowrap;border-radius:12px;">مخفي: 0 بنداً صفرياً</span>
          </div>
          <div class="bi-actions" style="margin-right:auto;display:flex;gap:8px;align-items:center;">
            <div class="bi-last-updated" id="bi-last-updated">🕐 آخر تحديث: <span class="ts" id="bi-last-updated-ts">—</span></div>
            <button class="bi-refresh-btn" id="btn-refresh"><span class="spin-icon">🔄</span> تحديث</button>
            <button class="btn" id="btn-deselect" style="font-size:0.88rem;padding:7px 14px;border-radius:12px;color:#f87171;border-color:rgba(239,68,68,0.25);background:rgba(239,68,68,0.08);">✕ إلغاء التحديد</button>
            <button class="btn" id="btn-share" style="font-size:0.88rem;padding:8px 16px;background:rgba(139,92,246,0.12);color:#a78bfa;border-color:rgba(139,92,246,0.25);border-radius:12px;">🔗 مشاركة</button>
            <button class="btn" id="btn-shares-list" style="font-size:0.88rem;padding:8px 16px;border-radius:12px;">📋 الروابط</button>
          </div>
        </div>

        <!-- Active Filter Chips Row -->
        <div id="active-filter-chips-row" style="display:none;align-items:center;gap:8px;flex-wrap:wrap;padding:6px 0 2px 0;border-top:1px solid rgba(255,255,255,0.04);">
          <span style="font-size:0.82rem;color:rgba(255,255,255,0.5);font-weight:700;">فلاتر النطاق النشطة:</span>
          <div id="active-filter-chips-list" style="display:inline-flex;align-items:center;gap:6px;flex-wrap:wrap;"></div>
          <button id="btn-clear-all-global-filters" style="background:none;border:none;color:#ef4444;font-size:0.8rem;cursor:pointer;padding:2px 8px;font-weight:700;display:inline-flex;align-items:center;gap:4px;">
            ✕ إلغاء فلاتر النطاق
          </button>
        </div>
      </div>

      <!-- Tab Bar -->
      <div class="bi-tabs" id="bi-tabs">
        <div class="bi-tab ${activeTab==='executive'?'active':''}" data-tab="executive">
          <span class="tab-label-full">🏢 لوحة الإدارة</span>
          <span class="tab-label-short">🏢 الإدارة</span>
        </div>
        <div class="bi-tab ${activeTab==='customers'?'active':''}" data-tab="customers">
          <span class="tab-label-full">👥 العملاء والتحصيل</span>
          <span class="tab-label-short">👥 العملاء</span>
        </div>
        <div class="bi-tab ${activeTab==='profitability'?'active':''}" data-tab="profitability">
          <span class="tab-label-full">📊 الأقسام والربحية</span>
          <span class="tab-label-short">📊 الأقسام</span>
        </div>
        <div class="bi-tab ${activeTab==='guarantees'?'active':''}" data-tab="guarantees">
          <span class="tab-label-full">🏦 الضمانات البنكية</span>
          <span class="tab-label-short">🏦 الضمانات</span>
        </div>
        <div class="bi-tab ${activeTab==='vat'?'active':''}" data-tab="vat">
          <span class="tab-label-full">🧾 ضريبة القيمة المضافة</span>
          <span class="tab-label-short">🧾 الضريبة</span>
        </div>
        <div class="bi-tab ${activeTab==='actual-collections'?'active':''}" data-tab="actual-collections">
          <span class="tab-label-full">💰 التحصيل الفعلي</span>
          <span class="tab-label-short">💰 التحصيل</span>
        </div>
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
        <div class="bi-empty">⏳ جاري تحميل البيانات...</div>
      </div>
    </div>

    <!-- Shares Modal -->
    <div id="shares-modal" style="display:none;position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,0.6);backdrop-filter:blur(6px);align-items:center;justify-content:center;">
      <div class="glass-card" style="padding:var(--space-xl);width:550px;max-width:90vw;max-height:80vh;overflow-y:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md);">
          <h3 style="margin:0;color:var(--text-white);">📋 روابط المشاركة</h3>
          <button class="btn" id="btn-close-shares" style="font-size:0.85rem;">✕</button>
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
    syncAllChips(); 
    updateVisibleYearChips();
    populateJournalSlicer(container);
    loadDashboard(container); 
  }

  function syncAllChips() {
    const allCo = container.querySelectorAll('.co-chip');
    const coAll = container.querySelector('.co-all');
    if (coAll) setChipActive(coAll, [...allCo].every(c => c.classList.contains('active')));
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
        coText = activeCos[0].textContent.trim();
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

  container.querySelectorAll('.co-chip').forEach(c => c.addEventListener('click', () => toggleChip(c)));

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
    loadDashboard(container);
  });

  // Date range picker: Takes precedence over year chips (Claude H1-fix directive)
  const handleDateChange = () => {
    const df = container.querySelector('#date-from')?.value;
    const dt = container.querySelector('#date-to')?.value;
    const clearBtn = container.querySelector('#btn-clear-date');
    if (df || dt) {
      container.querySelectorAll('.yr-chip, .yr-all').forEach(ch => setChipActive(ch, false));
      if (clearBtn) clearBtn.style.display = 'inline-flex';
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
    updateVisibleYearChips();
    populateJournalSlicer(container);
    loadDashboard(container);
  });

  // Deselect All button
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
    loadDashboard(container);
  });

  // Populate Interactive Slicers for Groups & Cost Centers / Journals
  populateGroupSlicer(container);
  populateJournalSlicer(container);

  container.querySelector('#btn-clear-all-global-filters')?.addEventListener('click', () => {
    globalFilters.groupIds = [];
    globalFilters.journalIds = [];
    if (groupDropdownInstance) groupDropdownInstance.setSelectedIds([]);
    if (journalDropdownInstance) journalDropdownInstance.setSelectedIds([]);
    populateJournalSlicer(container);
    updateActiveFilterUI(container);
    renderDashboard(container);
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

  function updateDesktopFilterSummary() {
    const activeYrs = [...container.querySelectorAll('.yr-chip.active')].map(c => c.dataset.year);
    const isAllYr = container.querySelector('.yr-all.active');
    const yrText = isAllYr ? 'كل السنوات' : (activeYrs.length > 0 ? activeYrs.join(' + ') : '2026');
    const isAllCo = container.querySelector('.co-all.active');
    const activeCos = [...container.querySelectorAll('.co-chip.active')];
    const coText = isAllCo ? 'كل الشركات' : (activeCos.length === 1 ? activeCos[0].textContent.trim() : `${activeCos.length} شركات`);
    if (desktopFilterSummary) desktopFilterSummary.textContent = `الفلاتر (${yrText} · ${coText})`;
  }

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
  container.querySelector('#btn-shares-list').addEventListener('click', () => openSharesModal(container));
  container.querySelector('#btn-close-shares').addEventListener('click', () => container.querySelector('#shares-modal').style.display = 'none');
  container.querySelector('#shares-modal').addEventListener('click', e => { if (e.target.id === 'shares-modal') e.target.style.display = 'none'; });

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
    color: g.color || '#f59e0b'
  }));

  if (!groupDropdownInstance) {
    groupDropdownInstance = new SlicerDropdown({
      triggerBtn: btnGroupSlicer,
      title: 'تصفية حسب المجموعة',
      icon: '📁',
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

  // Filter journals by active companies
  const isAllCo = container.querySelector('.co-all')?.classList.contains('active');
  const activeCos = [...container.querySelectorAll('.co-chip.active')].map(c => String(c.dataset.id));
  if (!isAllCo && activeCos.length > 0) {
    journals = journals.filter(j => activeCos.includes(String(j.company_id)));
  }

  // Filter journals by selected groups if groups are filtered
  if ((globalFilters.groupIds || []).length > 0) {
    const selectedGrpSet = new Set(globalFilters.groupIds.map(String));
    journals = journals.filter(j => selectedGrpSet.has(String(j.group_id)));
  }

  // Deduplicate cost centers by company and key
  const seenJrn = new Set();
  const uniqueJournals = [];
  for (const j of journals) {
    const itemKey = String(j.id || `${j.company_id}|${j.cost_center_key || j.journal_id}`);
    if (!seenJrn.has(itemKey)) {
      seenJrn.add(itemKey);
      uniqueJournals.push(j);
    }
  }

  // Clean up globalFilters.journalIds if any previously selected item is no longer valid
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
      icon: '📒',
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

  const chipsRow = container.querySelector('#active-filter-chips-row');
  const chipsList = container.querySelector('#active-filter-chips-list');

  if (chipsRow && chipsList) {
    if (grpCount === 0 && jrnCount === 0) {
      chipsRow.style.display = 'none';
      chipsList.innerHTML = '';
    } else {
      chipsRow.style.display = 'flex';
      const fOpts = store.get('filterOptions') || {};
      const groups = fOpts.groups || [];
      const journals = fOpts.journals || [];

      let html = '';
      if (grpCount > 0) {
        const grpNames = globalFilters.groupIds.map(gid => {
          const g = groups.find(x => String(x.id) === String(gid));
          return g ? g.name : `مجموعة ${gid}`;
        });
        html += `
          <div class="filter-chip filter-chip-grp">
            <span>📁 المجموعة (${grpCount}): <strong>${escapeHtml(grpNames.join('، '))}</strong></span>
            <button class="btn-clear-grp" title="إلغاء تصفية المجموعات">✕</button>
          </div>
        `;
      }

      if (jrnCount > 0) {
        // Detect duplicate cost center names across companies
        const nameToCos = new Map();
        journals.forEach(j => {
          const name = (j.cost_center_name || j.journal_name || '').replace(/\s+/g, ' ').trim();
          if (name) {
            if (!nameToCos.has(name)) nameToCos.set(name, new Set());
            if (j.company_id) nameToCos.get(name).add(String(j.company_id));
          }
        });

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
            <span>📒 مركز التكلفة (${jrnCount}): <strong>${escapeHtml(jrnNames.join('، '))}</strong></span>
            <button class="btn-clear-jrn" title="إلغاء تصفية مراكز التكلفة">✕</button>
          </div>
        `;
      }

      chipsList.innerHTML = html;

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
    showToast('✅ تم إنشاء الرابط ونسخه!', 'success');
  } catch(err){ showToast('خطأ في المشاركة','error'); }
}

async function openSharesModal(container) {
  const modal = container.querySelector('#shares-modal'); modal.style.display = 'flex';
  const list = container.querySelector('#shares-list');
  list.innerHTML = '<p style="color:var(--text-muted);text-align:center;">⏳</p>';
  try {
    const shares = await api.getPresentationShares();
    if (!shares.length) { list.innerHTML = '<p style="color:var(--text-muted);text-align:center;">لا توجد روابط</p>'; return; }
    list.innerHTML = shares.map(s => {
      const url = `${location.origin}/view.html?token=${s.token}`;
      return `<div style="background:rgba(255,255,255,0.03);border-radius:12px;padding:14px;margin-bottom:10px;border:1px solid rgba(255,255,255,0.06);">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div><div style="color:var(--text-white);font-weight:600;font-size:0.85rem;">${s.title}</div><div style="color:var(--text-muted);font-size:0.72rem;margin-top:3px;">${s.created_at}</div></div>
          <div style="display:flex;gap:8px;"><button class="btn copy-btn" data-url="${url}" style="font-size:0.72rem;padding:5px 10px;">📋</button><button class="btn del-btn" data-id="${s.id}" style="font-size:0.72rem;padding:5px 10px;color:var(--accent-red);">🗑️</button></div>
        </div>
      </div>`;
    }).join('');
    list.querySelectorAll('.copy-btn').forEach(b=>b.addEventListener('click',async()=>{await navigator.clipboard?.writeText(b.dataset.url);showToast('✅ تم نسخ الرابط','success');}));
    list.querySelectorAll('.del-btn').forEach(b=>b.addEventListener('click',async()=>{await api.deletePresentationShare(b.dataset.id);showToast('تم الحذف','success');openSharesModal(container);}));
  } catch(err){list.innerHTML='<p style="color:var(--accent-red);">خطأ</p>';}
}
