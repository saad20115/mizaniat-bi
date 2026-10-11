import { api } from '../api.js';
import { store } from '../store.js';
import { formatNumber } from '../utils/format.js';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { createTreeTable, getInvoiceBucket } from '../components/tree-table.js';

// Page-level state
let currentExecutiveData = null;
let currentTimeFilter = null;
let currentSelectedCos = [];
let currentGlobalFilters = { groupIds: [], journalIds: [] };
let isLightMode = false;
let isAgingOpen = false;
let selectedDrawerClient = null;
let isCustomizerOpen = false;

// Default preferences
const defaultPreferences = {
  theme: 'dark',
  columns: ['revenue', 'expenses', 'net_profit', 'margin', 'collected', 'collection_rate', 'residual'],
  sections: ['cards', 'chart', 'tree', 'aging'],
  default_open_level: 'companies', // 'companies' (folded) | 'departments' (expand depts)
  sort_by: 'default' // 'default' | 'revenue' | 'net_profit' | 'residual'
};

let userPreferences = { ...defaultPreferences };
let currentSummaryRequestId = 0;
let currentAgingRequestId = 0;

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

/**
 * Format numbers with thousand separators.
 * Negative numbers wrapped in parentheses in red.
 */
function fmtVal(num, showZeroDash = true) {
  if (num === null || num === undefined || isNaN(num)) return showZeroDash ? '—' : '0';
  const rounded = Math.round(Number(num));
  if (rounded === 0 && showZeroDash) return '—';
  if (rounded < 0) {
    return `<span class="exec-num-neg" style="color:var(--status-negative);direction:ltr;display:inline-block;">(${Math.abs(rounded).toLocaleString('en-US')})</span>`;
  }
  return `<span class="exec-num">${rounded.toLocaleString('en-US')}</span>`;
}

/**
 * Format percentages (X4).
 * If negative: (21.6%) in red with direction:ltr.
 * If |margin| > 999% or revenue == 0, show '—'.
 */
function fmtRate(num, isMargin = false, rev = null) {
  if (num === null || num === undefined || isNaN(num)) return '—';
  if (isMargin) {
    if (rev === 0 || rev === null || Math.abs(num) > 999) return '—';
  }
  const rounded = Math.round(num * 10) / 10;
  if (rounded === 0) return '<span class="exec-num" dir="ltr" style="display:inline-block;">0%</span>';
  if (rounded < 0) {
    return `<span class="exec-rate-neg" dir="ltr" style="color:var(--status-negative);direction:ltr;display:inline-block;font-family:var(--font-en);font-weight:700;">(${Math.abs(rounded)}%)</span>`;
  }
  return `<span class="exec-num" dir="ltr" style="display:inline-block;">${rounded}%</span>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}

/**
 * User Preferences Persistence (P4)
 */
async function loadUserPreferences() {
  const cached = store.get('executive_prefs');
  if (cached && Object.keys(cached).length > 0) {
    userPreferences = { ...defaultPreferences, ...cached };
    return;
  }

  try {
    // 1. Try server endpoint
    const res = await api.getPreferences('executive_view');
    if (res && res.found && res.data) {
      userPreferences = { ...defaultPreferences, ...res.data };
      store.set('executive_prefs', res.data);
      return;
    }
  } catch (e) {
    console.warn('Could not fetch server preferences:', e);
  }

  // 2. Fallback to localStorage
  try {
    const local = localStorage.getItem('mizaniat_executive_prefs');
    if (local) {
      userPreferences = { ...defaultPreferences, ...JSON.parse(local) };
      store.set('executive_prefs', userPreferences);
    }
  } catch (e) { console.warn(e); }
}

async function saveUserPreferences(prefs) {
  userPreferences = { ...userPreferences, ...prefs };
  store.set('executive_prefs', userPreferences);
  try {
    localStorage.setItem('mizaniat_executive_prefs', JSON.stringify(userPreferences));
  } catch (e) {}

  try {
    await api.setPreferences('executive_view', userPreferences);
  } catch (e) {
    console.warn('Could not save preferences to server:', e);
  }
}

/**
 * Main entry point for Executive Dashboard Tab
 */
export async function renderExecutiveDashboardTab(body, container, timeFilter, selectedCos, globalFilters) {
  if (globalFilters) {
    currentGlobalFilters = globalFilters;
  }
  if (!selectedCos || !selectedCos.length) {
    selectedCos = [...container.querySelectorAll('.co-chip.active')].map(c => Number(c.dataset.id));
  }

  if (!timeFilter) {
    const yrChip = container.querySelector('.yr-chip.active');
    const yr = yrChip ? yrChip.dataset.year : String(new Date().getFullYear());
    timeFilter = {
      isCustomDate: false,
      selectedYear: yr,
      dateFrom: `${yr}-01-01`,
      dateTo: `${yr}-12-31`,
      periodLabel: yr
    };
  }

  currentTimeFilter = timeFilter;
  currentSelectedCos = selectedCos;

  // Load preferences
  await loadUserPreferences();

  // Determine theme: preference or URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const currentAttrTheme = document.documentElement.getAttribute('data-theme');
  if (currentAttrTheme) {
    isLightMode = currentAttrTheme === 'light';
  } else if (urlParams.has('theme')) {
    isLightMode = urlParams.get('theme') === 'light';
  } else if (userPreferences.theme) {
    isLightMode = userPreferences.theme === 'light';
  }

  // Synchronize whole page theme (P3)
  syncWholePageTheme(isLightMode);

  body.innerHTML = `
    <div id="exec-root" class="${isLightMode ? 'exec-light' : 'exec-dark'}" style="direction:rtl;display:flex;flex-direction:column;gap:20px;font-family:var(--font-ar);transition:background 0.2s,color 0.2s;min-width:0;max-width:100%;width:100%;box-sizing:border-box;">
      
      <!-- Tab Header -->
      <div class="exec-header" style="display:flex;flex-direction:column;gap:4px;">
        <h1 class="exec-title" style="margin:0;font-size:22px;line-height:32px;font-weight:700;color:var(--text-primary);">
          لوحة الإدارة — <span id="exec-effective-badge">${timeFilter.periodLabel}</span>
        </h1>
        <p class="exec-subtitle" style="margin:0;font-size:12px;line-height:18px;color:var(--text-muted);">
          الإيراد والمصروف والربح، مقارنةً بما حُصّل فعلاً من العملاء
        </p>
      </div>

      <!-- Hidden compatibility controls for tests/shortcuts -->
      <div style="display:none;">
        <button id="exec-btn-customize">طريقة العرض</button>
        <button id="exec-btn-theme">${isLightMode ? 'وضع داكن' : 'وضع فاتح'}</button>
        <button id="exec-btn-export">تصدير</button>
        <div id="exec-export-menu" style="display:none;">
          <button id="exec-exp-excel">تصدير Excel</button>
          <button id="exec-exp-pdf">تصدير PDF</button>
        </div>
      </div>

      <!-- Customization Popover Modal (P4) -->
      <div id="exec-customizer-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);z-index:9990;align-items:center;justify-content:center;">
        <div style="background:var(--bg-surface);border:1px solid var(--border-default);border-radius:16px;width:580px;max-width:92vw;max-height:85vh;overflow-y:auto;padding:24px;box-shadow:0 16px 40px rgba(0,0,0,0.4);display:flex;flex-direction:column;gap:18px;">
          <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border-default);padding-bottom:12px;">
            <h3 style="margin:0;font-size:1.15rem;font-weight:800;color:var(--text-primary);">تخصيص طريقة العرض والتفضيلات</h3>
            <button id="exec-close-customizer" style="background:none;border:none;color:var(--text-muted);font-size:1.4rem;cursor:pointer;padding:4px;">✕</button>
          </div>

          <!-- Columns Toggle -->
          <div>
            <span style="font-size:0.92rem;font-weight:700;color:var(--text-primary);display:block;margin-bottom:8px;">الأعمدة الظاهرة:</span>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.85rem;color:var(--text-secondary);">
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" class="col-pref" data-col="revenue"> الإيرادات</label>
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" class="col-pref" data-col="expenses"> المصروفات</label>
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" class="col-pref" data-col="net_profit"> صافي الربح</label>
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" class="col-pref" data-col="margin"> هامش الربح</label>
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" class="col-pref" data-col="collected"> المحصّل</label>
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" class="col-pref" data-col="collection_rate"> نسبة التحصيل</label>
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" class="col-pref" data-col="residual"> المتبقي من فواتير الفترة</label>
            </div>
          </div>

          <!-- Sections Toggle -->
          <div style="border-top:1px solid var(--border-default);padding-top:12px;">
            <span style="font-size:0.92rem;font-weight:700;color:var(--text-primary);display:block;margin-bottom:8px;">الأقسام الظاهرة:</span>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.85rem;color:var(--text-secondary);">
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" class="sec-pref" data-sec="cards"> بطاقات المؤشرات</label>
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" class="sec-pref" data-sec="chart"> حركة التدفق الشهري (الرسم)</label>
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" class="sec-pref" data-sec="tree"> جدول الأداء والتحصيل الهرمي</label>
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" class="sec-pref" data-sec="aging"> أعمار ذمم فواتير الفترة</label>
            </div>
          </div>

          <!-- Open Level & Sorting -->
          <div style="border-top:1px solid var(--border-default);padding-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <span style="font-size:0.88rem;font-weight:700;color:var(--text-primary);display:block;margin-bottom:6px;">مستوى الفتح الافتراضي:</span>
              <select id="pref-open-level" style="width:100%;padding:8px 10px;border-radius:8px;background:var(--bg-subtle);border:1px solid var(--border-default);color:var(--text-primary);font-family:var(--font-ar);">
                <option value="companies">شركات فقط (الهرم مطوي)</option>
                <option value="departments">شركات وأقسام (مفتوحة الأقسام)</option>
              </select>
            </div>
            <div>
              <span style="font-size:0.88rem;font-weight:700;color:var(--text-primary);display:block;margin-bottom:6px;">ترتيب الشركات:</span>
              <select id="pref-sort-by" style="width:100%;padding:8px 10px;border-radius:8px;background:var(--bg-subtle);border:1px solid var(--border-default);color:var(--text-primary);font-family:var(--font-ar);">
                <option value="default">الافتراضي (حسب أودو)</option>
                <option value="revenue">الأعلى إيراداً</option>
                <option value="net_profit">الأعلى صافي ربح</option>
                <option value="residual">الأعلى متبقياً</option>
              </select>
            </div>
          </div>

          <!-- Action Buttons -->
          <div style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--border-default);padding-top:16px;margin-top:4px;">
            <button id="pref-btn-reset" style="padding:8px 14px;border-radius:8px;background:none;border:1px solid var(--border-default);color:var(--text-muted);cursor:pointer;font-weight:700;">إعادة الضبط</button>
            <div style="display:flex;gap:10px;">
              <button id="pref-btn-apply" style="padding:8px 16px;border-radius:8px;background:var(--bg-subtle);border:1px solid var(--border-default);color:var(--text-primary);cursor:pointer;font-weight:700;">تطبيق</button>
              <button id="pref-btn-save" style="padding:8px 18px;border-radius:8px;background:var(--brand-primary);color:var(--text-on-brand);border:none;cursor:pointer;font-weight:700;">حفظ كافتراضي لي</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Skeleton Loading Placeholder (P1) -->
      <div id="exec-content-loading" style="display:block;">
        ${renderSkeletonLoader()}
      </div>

      <!-- Main Content Container -->
      <div id="exec-content" style="display:none;flex-direction:column;gap:24px;min-width:0;max-width:100%;width:100%;box-sizing:border-box;"></div>

      <!-- Side Drawer for Customer Invoices (P1 Lazy) -->
      <div id="exec-drawer-backdrop" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);z-index:9998;transition:opacity 0.25s;"></div>
      <div id="exec-drawer" style="position:fixed;top:0;left:0;bottom:0;width:560px;max-width:94vw;background:var(--exec-bg-drawer);border-right:1px solid var(--exec-border);box-shadow:8px 0 32px rgba(0,0,0,0.5);z-index:9999;transform:translateX(-100%);transition:transform 0.3s cubic-bezier(0.16,1,0.3,1);display:flex;flex-direction:column;direction:rtl;">
        <div id="exec-drawer-content" style="flex:1;overflow-y:auto;padding:24px;"></div>
      </div>

      <!-- Styles -->
      <style>
        .exec-num { font-family: var(--font-en, 'Inter', sans-serif); font-weight: 700; }
        .exec-num-neg { font-family: var(--font-en, 'Inter', sans-serif); font-weight: 700; }
        .exec-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .exec-table th { padding: 12px 14px; text-align: right; font-weight: 700; border-bottom: 2px solid var(--exec-border); white-space: nowrap; color: var(--exec-text-muted); }
        .exec-table td { padding: 10px 14px; border-bottom: 1px solid var(--exec-border); color: var(--exec-text); white-space: nowrap; }
        .exec-table tr:hover td { background: var(--exec-bg-hover); }
        .exec-sticky-footer td { position: sticky; bottom: 0; background: var(--exec-sticky-bg); font-weight: 900; border-top: 2px solid var(--exec-border); z-index: 15; box-shadow: 0 -4px 14px rgba(0,0,0,0.18); }
        
        /* Shimmer Animation for Skeleton */
        @keyframes exec-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .exec-shimmer {
          background: linear-gradient(90deg, var(--exec-bg-btn) 25%, var(--exec-bg-hover) 50%, var(--exec-bg-btn) 75%);
          background-size: 200% 100%;
          animation: exec-shimmer 1.5s infinite;
          border-radius: 8px;
        }
      </style>
    </div>
  `;

  // Bind topbar events
  bindTopbarEvents(body, container, timeFilter, selectedCos);

  // Load executive data
  await loadExecutiveData(body, timeFilter, selectedCos);

  const root = body.querySelector('#exec-root');
  if (urlParams.has('customizer') && root) {
    openCustomizer(root);
  }
}

/**
 * Synchronize whole-page theme classes (P3)
 */
function syncWholePageTheme(light) {
  if (light) {
    document.body.classList.add('light-theme');
    document.documentElement.setAttribute('data-theme', 'light');
  } else {
    document.body.classList.remove('light-theme');
    document.documentElement.setAttribute('data-theme', 'dark');
  }
}

/**
 * Skeleton Loader rendering (P1)
 */
function renderSkeletonLoader() {
  return `
    <div style="display:flex;flex-direction:column;gap:20px;">
      <!-- Cards Skeleton -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(210px, 1fr));gap:16px;">
        ${[1, 2, 3, 4, 5].map(() => `
          <div style="background:var(--exec-bg-card);border:1px solid var(--exec-border);border-radius:14px;padding:20px;height:120px;display:flex;flex-direction:column;gap:12px;">
            <div class="exec-shimmer" style="height:16px;width:40%;"></div>
            <div class="exec-shimmer" style="height:32px;width:70%;"></div>
            <div class="exec-shimmer" style="height:14px;width:85%;"></div>
          </div>
        `).join('')}
      </div>

      <!-- Chart Skeleton -->
      <div style="background:var(--exec-bg-card);border:1px solid var(--exec-border);border-radius:16px;padding:24px;height:340px;display:flex;flex-direction:column;gap:18px;">
        <div class="exec-shimmer" style="height:22px;width:35%;"></div>
        <div class="exec-shimmer" style="flex:1;"></div>
      </div>

      <!-- Table Skeleton -->
      <div style="background:var(--exec-bg-card);border:1px solid var(--exec-border);border-radius:16px;padding:24px;display:flex;flex-direction:column;gap:16px;">
        <div class="exec-shimmer" style="height:24px;width:30%;"></div>
        <div style="display:flex;flex-direction:column;gap:10px;margin-top:10px;">
          ${[1, 2, 3, 4, 5].map(() => `
            <div class="exec-shimmer" style="height:38px;width:100%;"></div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

/**
 * Bind Topbar events (theme, customizer, export)
 */
function bindTopbarEvents(body, container, timeFilter, selectedCos) {
  const root = body.querySelector('#exec-root');

  // Theme toggle
  root.querySelector('#exec-btn-theme').addEventListener('click', async () => {
    isLightMode = !isLightMode;
    root.className = isLightMode ? 'exec-light' : 'exec-dark';
    root.querySelector('#exec-btn-theme').innerHTML = isLightMode ? 'وضع داكن' : 'وضع فاتح';
    syncWholePageTheme(isLightMode);
    userPreferences.theme = isLightMode ? 'light' : 'dark';
    await saveUserPreferences({ theme: userPreferences.theme });
    // Re-render chart to update colors for light mode (X5)
    if (currentExecutiveData?.monthly_series) {
      const chartBox = root.querySelector('#exec-chart-container');
      if (chartBox) chartBox.innerHTML = renderExecutiveChart(currentExecutiveData.monthly_series);
    }
  });

  // Customizer modal
  const custModal = root.querySelector('#exec-customizer-modal');
  root.querySelector('#exec-btn-customize').addEventListener('click', () => {
    openCustomizer(root);
  });
  root.querySelector('#exec-close-customizer')?.addEventListener('click', () => {
    custModal.style.display = 'none';
  });
  custModal?.addEventListener('click', (e) => {
    if (e.target === custModal) custModal.style.display = 'none';
  });

  // Export dropdown
  const expBtn = root.querySelector('#exec-btn-export');
  const expMenu = root.querySelector('#exec-export-menu');
  expBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    expMenu.style.display = expMenu.style.display === 'none' ? 'block' : 'none';
  });
  document.addEventListener('click', () => { if (expMenu) expMenu.style.display = 'none'; });

  root.querySelector('#exec-exp-excel').addEventListener('click', () => exportExecutiveExcel());
  root.querySelector('#exec-exp-pdf').addEventListener('click', () => exportExecutivePDF());

  const drawerBackdrop = root.querySelector('#exec-drawer-backdrop');
  drawerBackdrop.addEventListener('click', closeExecutiveDrawer);
}

/**
 * Open Customization Modal (P4)
 */
function openCustomizer(root) {
  const custModal = root.querySelector('#exec-customizer-modal');
  if (!custModal) return;

  // Set checkbox values from userPreferences
  custModal.querySelectorAll('.col-pref').forEach(cb => {
    cb.checked = userPreferences.columns.includes(cb.dataset.col);
  });

  custModal.querySelectorAll('.sec-pref').forEach(cb => {
    cb.checked = userPreferences.sections.includes(cb.dataset.sec);
  });

  const levelSelect = custModal.querySelector('#pref-open-level');
  if (levelSelect) levelSelect.value = userPreferences.default_open_level || 'companies';

  const sortSelect = custModal.querySelector('#pref-sort-by');
  if (sortSelect) sortSelect.value = userPreferences.sort_by || 'default';

  // Apply button
  custModal.querySelector('#pref-btn-apply').onclick = () => {
    readCustomizerForm(custModal);
    custModal.style.display = 'none';
    const content = root.querySelector('#exec-content');
    if (content && currentExecutiveData) renderExecutiveContent(content, currentExecutiveData);
  };

  // Save button
  custModal.querySelector('#pref-btn-save').onclick = async () => {
    readCustomizerForm(custModal);
    await saveUserPreferences(userPreferences);
    custModal.style.display = 'none';
    const content = root.querySelector('#exec-content');
    if (content && currentExecutiveData) renderExecutiveContent(content, currentExecutiveData);
    alert('تم حفظ التفضيلات بنجاح كتفضيل افتراضي لحسابك');
  };

  // Reset button
  custModal.querySelector('#pref-btn-reset').onclick = async () => {
    userPreferences = { ...defaultPreferences, theme: isLightMode ? 'light' : 'dark' };
    await saveUserPreferences(userPreferences);
    openCustomizer(root);
  };

  custModal.style.display = 'flex';
}

function readCustomizerForm(modal) {
  const cols = [];
  modal.querySelectorAll('.col-pref:checked').forEach(cb => cols.push(cb.dataset.col));
  const secs = [];
  modal.querySelectorAll('.sec-pref:checked').forEach(cb => secs.push(cb.dataset.sec));
  userPreferences.columns = cols.length ? cols : defaultPreferences.columns;
  userPreferences.sections = secs.length ? secs : defaultPreferences.sections;
  userPreferences.default_open_level = modal.querySelector('#pref-open-level')?.value || 'companies';
  userPreferences.sort_by = modal.querySelector('#pref-sort-by')?.value || 'default';
}

/**
 * Fetch executive summary from server (P1: Shallow Tree)
 */
async function loadExecutiveData(body, timeFilter, selectedCos) {
  const loading = body.querySelector('#exec-content-loading');
  const content = body.querySelector('#exec-content');
  if (!loading || !content) return;

  const reqId = ++currentSummaryRequestId;

  loading.style.display = 'block';
  content.style.display = 'none';

  try {
    const periodParams = getPeriodParamsFromFilter(timeFilter);
    const params = {
      companyIds: selectedCos && selectedCos.length ? selectedCos.join(',') : undefined,
      ...periodParams
    };
    if (currentGlobalFilters?.groupIds?.length) params.groupIds = currentGlobalFilters.groupIds.join(',');
    if (currentGlobalFilters?.journalIds?.length) params.journalIds = currentGlobalFilters.journalIds.join(',');

    const res = await api.getExecutiveSummary(params);
    if (reqId !== currentSummaryRequestId) return;

    currentExecutiveData = res;

    renderExecutiveContent(content, res);
    loading.style.display = 'none';
    content.style.display = 'flex';

    if (new URLSearchParams(window.location.search).has('drawer')) {
      setTimeout(() => {
        openExecutiveDrawer({
          id: 'client_2_15_163',
          name: 'الشركة العربية الموحدة للتوزيع (قسم 15)',
          company_id: 2,
          department_id: 15,
          partner_id: 163,
          billed: 128916,
          collected: 115734,
          residual: 3460
        });
      }, 300);
    }
  } catch (err) {
    if (reqId !== currentSummaryRequestId) return;
    console.error('Error loading executive data:', err);
    loading.innerHTML = `
      <div style="padding:40px;text-align:center;background:var(--bg-surface);border:1px solid var(--border-default);border-radius:14px;">
        <span style="color:var(--status-negative);font-weight:700;font-size:1.1rem;display:block;margin-bottom:12px;">حدث خطأ أثناء تحميل البيانات: ${escapeHtml(err.message)}</span>
        <button id="exec-btn-retry" class="bi-btn bi-btn-primary" style="padding:8px 20px;">إعادة المحاولة</button>
      </div>
    `;
    loading.querySelector('#exec-btn-retry')?.addEventListener('click', () => loadExecutiveData(body, timeFilter, selectedCos));
  }
}

/**
 * Render all visible sections based on userPreferences (P4)
 */
function renderExecutiveContent(container, data) {
  const cards = data.cards || {};
  const monthly = data.monthly_series || [];
  const tree = data.tree || { rows: [], totals: {} };
  const aging = data.aging || { tree: [], totals: {} };

  // Sort tree rows if sorting preference is set
  let rows = [...(tree.rows || [])];
  if (userPreferences.sort_by === 'revenue') {
    rows.sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
  } else if (userPreferences.sort_by === 'net_profit') {
    rows.sort((a, b) => (b.net_profit || 0) - (a.net_profit || 0));
  } else if (userPreferences.sort_by === 'residual') {
    rows.sort((a, b) => (b.residual || 0) - (a.residual || 0));
  }
  const displayTree = { ...tree, rows };

  const showCards = userPreferences.sections.includes('cards');
  const showChart = userPreferences.sections.includes('chart');
  const showTree = userPreferences.sections.includes('tree');
  const showAging = userPreferences.sections.includes('aging');

  const isAllYear = currentTimeFilter?.selectedYear === 'ALL';
  const showCollectedNotice = isAllYear && (cards.collected_period_untaxed || 0) > (cards.revenue || 0);

  container.innerHTML = `
    <!-- (1) 5 KPI Summary Cards (Arabic only) -->
    ${showCards ? `
      <div class="exec-kpi-grid">
        
        <!-- 1. Revenue -->
        <div class="bi-kpi-card">
          <span class="bi-kpi-label">الإيرادات</span>
          <div class="bi-kpi-value">${Math.round(cards.revenue || 0).toLocaleString('en-US')}</div>
          <span class="bi-kpi-sub">بدون ضريبة • ${currentSelectedCos?.length || 4} شركات</span>
        </div>

        <!-- 2. Expenses -->
        <div class="bi-kpi-card">
          <span class="bi-kpi-label">المصروفات</span>
          <div class="bi-kpi-value">${Math.round(cards.expenses || 0).toLocaleString('en-US')}</div>
          <span class="bi-kpi-sub">من الإيرادات <span dir="ltr" class="tabular-nums" style="display:inline-block;direction:ltr;">${cards.revenue > 0 ? (Math.round((cards.expenses / cards.revenue) * 1000) / 10) : 0}%</span></span>
        </div>

        <!-- 3. Net Profit (Hero Card) -->
        <div class="bi-kpi-card hero">
          <span class="bi-kpi-label">صافي الربح</span>
          <div class="bi-kpi-value">${Math.round(cards.net_profit || 0).toLocaleString('en-US')}</div>
          <span class="bi-kpi-sub">هامش الربح ${fmtRate(cards.profit_margin, true, cards.revenue)}</span>
        </div>

        <!-- 4. Collected Period Untaxed -->
        <div class="bi-kpi-card">
          <span class="bi-kpi-label">المحصّل من فواتير الفترة</span>
          <div class="bi-kpi-value">${Math.round(cards.collected_period_untaxed || 0).toLocaleString('en-US')}</div>
          <div style="display:flex;flex-direction:column;gap:4px;">
            <div class="bi-progress-bar-wrap">
              <div class="bi-progress-bar-fill" style="width:${Math.min(100, Math.max(0, cards.collection_rate_untaxed || 0))}%;"></div>
            </div>
            <span class="bi-kpi-sub">نسبة التحصيل <strong class="text-positive tabular-nums" dir="ltr" style="display:inline-block;direction:ltr;">${cards.collection_rate_untaxed || 0}%</strong></span>
          </div>
          ${showCollectedNotice ? `
            <span class="bi-kpi-sub" style="font-size:11px;line-height:1.3;margin-top:2px;">* يشمل تحصيلات عن فواتير سنوات سابقة لا يقابلها إيراد في الأستاذ</span>
          ` : ''}
        </div>

        <!-- 5. Period Residual -->
        <div class="bi-kpi-card">
          <span class="bi-kpi-label">المتبقي</span>
          <div class="bi-kpi-value">${Math.round(cards.residual_period || 0).toLocaleString('en-US')}</div>
          <span class="bi-kpi-sub">منه متأخر +90 يوماً <strong class="text-negative tabular-nums">${Math.round(cards.overdue_90 || 0).toLocaleString('en-US')}</strong></span>
        </div>

      </div>
    ` : ''}

    <!-- (2) Monthly Trend Chart -->
    ${showChart ? `
      <div class="exec-chart-card">
        <div class="exec-chart-header">
          <div class="exec-chart-titles">
            <h2 class="exec-chart-title">الإيرادات والمصروفات والتحصيل شهرياً</h2>
            <span class="exec-chart-subtitle">بالمليون ريال • الشهر الجاري غير مكتمل</span>
          </div>
          
          <div class="exec-chart-legend">
            <div class="legend-item"><span class="legend-dot" style="background:var(--chart-revenue);"></span> الإيرادات</div>
            <div class="legend-item"><span class="legend-dot" style="background:var(--chart-expense);"></span> المصروفات</div>
            <div class="legend-item"><span class="legend-line" style="background:var(--chart-collection);"></span> التحصيل النقدي</div>
          </div>
        </div>

        <div id="exec-chart-container" style="position:relative;width:100%;min-width:0;max-width:100%;min-height:200px;box-sizing:border-box;">
          ${renderExecutiveChart(monthly)}
        </div>
      </div>
    ` : ''}

    <!-- (3) Unified Hierarchical Table -->
    ${showTree ? `
      <div class="exec-table-card">
        <div class="exec-table-toolbar">
          <div class="exec-table-titles">
            <h2 class="exec-table-title">الأداء حسب الشركة والمجموعة — ${currentTimeFilter?.periodLabel || ''}</h2>
            <span class="exec-table-breadcrumb">الشركة ← المجموعة ← مركز التكلفة ← العميل</span>
          </div>
          <div class="exec-table-actions">
            <div class="exec-search-wrap">
              <input type="text" id="exec-tree-search" class="exec-search-input" placeholder="بحث…" />
              <button id="btn-exec-clear-search" style="display:none;position:absolute;left:8px;background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:12px;padding:0;">✕</button>
              <span class="exec-search-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
              </span>
            </div>
            <span id="exec-search-counter" style="font-size:12px;color:var(--text-muted);font-weight:600;display:none;"></span>
            <button id="exec-btn-expand-all" class="exec-btn-tool" title="توسيع الكل">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 13 12 18 17 13"/><polyline points="7 6 12 11 17 6"/></svg>
              توسيع الكل
            </button>
            <button id="exec-btn-collapse-all" class="exec-btn-tool" title="طي الكل">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 11 12 6 7 11"/><polyline points="17 18 12 13 7 18"/></svg>
              طي الكل
            </button>
            <button id="exec-exp-excel" class="exec-btn-tool" title="تصدير Excel">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              تصدير Excel
            </button>
          </div>
        </div>

        <div id="exec-tree-table-container" data-scroll-x="true" style="overflow-x:auto;width:100%;box-sizing:border-box;"></div>
      </div>
    ` : ''}

    <!-- (4) Folded Aging Section -->
    ${showAging ? `
      <div style="background:var(--bg-surface);border:1px solid var(--border-default);border-radius:14px;padding:20px;display:flex;flex-direction:column;gap:16px;min-width:0;max-width:100%;width:100%;box-sizing:border-box;">
        <div id="exec-aging-toggle" style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:16px;font-weight:700;color:var(--text-primary);">أعمار ذمم فواتير الفترة (الشرائح السبع)</span>
            <span style="font-size:12px;color:var(--brand-accent);background:var(--brand-accent-subtle);padding:3px 10px;border-radius:6px;font-weight:600;">${isAgingOpen ? 'إخفاء ▲' : 'عرض التفاصيل ▾'}</span>
          </div>
          <span style="font-size:13px;color:var(--text-muted);font-weight:600;">
            إجمالي المتبقي: <strong class="exec-num text-negative">${Math.round(aging.totals?.total_residual || cards.residual_period || 0).toLocaleString('en-US')} ريال</strong>
          </span>
        </div>

        <div id="exec-aging-container" data-scroll-x="true" style="display:${isAgingOpen ? 'block' : 'none'};overflow-x:auto;border:1px solid var(--border-default);border-radius:12px;margin-top:6px;min-width:0;max-width:100%;width:100%;box-sizing:border-box;"></div>
      </div>
    ` : ''}
  `;

  if (showTree) {
    const treeContainer = container.querySelector('#exec-tree-table-container');
    if (treeContainer) {
      initMainTreeTable(treeContainer, displayTree);
    }
  }

  if (showAging) {
    const agBox = container.querySelector('#exec-aging-container');
    if (agBox && isAgingOpen) {
      loadAging(container, true);
    }
  }

  // Responsive Chart ResizeObserver (RESP1)
  const chartBox = container.querySelector('#exec-chart-container');
  if (chartBox && typeof ResizeObserver !== 'undefined') {
    let lastW = chartBox.clientWidth;
    const getTargetH = () => {
      const winW = typeof window !== 'undefined' ? window.innerWidth : 1280;
      return winW < 768 ? 200 : (winW < 1280 ? 240 : 300);
    };
    let lastH = getTargetH();
    const updateChart = (w) => {
      const curW = w || chartBox.clientWidth;
      const curH = getTargetH();
      if (curW > 0 && (Math.abs(curW - lastW) > 8 || curH !== lastH)) {
        lastW = curW;
        lastH = curH;
        if (currentExecutiveData?.monthly_series) {
          chartBox.innerHTML = renderExecutiveChart(currentExecutiveData.monthly_series, curW);
        }
      }
    };
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const curW = Math.round(entry.contentRect.width);
        updateChart(curW);
      }
    });
    ro.observe(chartBox);
    window.addEventListener('resize', () => updateChart());
  }

  bindExecutiveTableEvents(container);
}

/**
 * Render pure SVG interactive chart for monthly trend (RTL oriented, X5 & X6)
 */
function renderExecutiveChart(rawSeries, explicitWidth) {
  if (!rawSeries || !rawSeries.length) {
    return `<div style="text-align:center;padding:80px;color:var(--exec-text-muted);">لا توجد حركات شهرية في هذه الفترة</div>`;
  }

  // Filter series according to X6 & YR1:
  const isMultiYear = currentTimeFilter?.selectedYear === 'ALL' || (currentTimeFilter?.selectedYears && currentTimeFilter.selectedYears.length > 1);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  let series = rawSeries.filter(s => {
    if (isMultiYear) {
      return (s.revenue || 0) > 0 || (s.expenses || 0) > 0 || (s.collected_cash || 0) > 0;
    }
    if (currentTimeFilter?.selectedYear === String(currentYear)) {
      const match = s.label && s.label.match(/(\d+)/);
      if (match) {
        const m = parseInt(match[1]);
        if (m > currentMonth) return false;
      }
    }
    return true;
  });

  if (!series.length) series = rawSeries;

  // Responsive dimensions (RESP1)
  const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const isMobile = windowWidth < 768;
  const isTablet = windowWidth >= 768 && windowWidth < 1280;

  let w = explicitWidth || 1100;
  if (!explicitWidth && typeof document !== 'undefined') {
    const box = document.querySelector('#exec-chart-container');
    if (box && box.clientWidth > 100) {
      w = box.clientWidth;
    } else {
      w = isMobile ? Math.max(300, windowWidth - 24) : (isTablet ? Math.max(700, windowWidth - 100) : 1100);
    }
  }

  // Height: 300 desktop, 240 tablet, 200 mobile (RESP1 spec)
  const h = isMobile ? 200 : (isTablet ? 240 : 300);

  const padTop = isMobile ? 18 : 26;
  const padBottom = isMobile ? 28 : 36;
  const padRight = isMobile ? 65 : (isTablet ? 90 : 110);
  const padLeft = isMobile ? 16 : 30;
  const chartW = Math.max(100, w - padRight - padLeft);
  const chartH = Math.max(80, h - padTop - padBottom);

  const maxVal = Math.max(
    ...series.map(s => Math.max(s.revenue || 0, s.expenses || 0, s.collected_cash || 0)),
    1000
  ) * 1.15;

  const count = series.length;
  const slotW = chartW / count;
  const barW = Math.min(isMobile ? 16 : 32, Math.max(6, slotW * 0.28));

  // AA Contrast Colors for light/dark (X5)
  const textColor = 'var(--text-secondary)';
  const gridStroke = 'var(--border-default)';

  // Short month names mapping
  const SHORT_MONTHS = {
    'يناير': 'ينا', 'فبراير': 'فبر', 'مارس': 'مار', 'أبريل': 'أبر',
    'مايو': 'ماي', 'يونيو': 'يون', 'يوليو': 'يول', 'أغسطس': 'أغس',
    'سبتمبر': 'سبت', 'أكتوبر': 'أكت', 'نوفمبر': 'نوف', 'ديسمبر': 'ديس'
  };

  function formatAxisNum(val) {
    if (!isMobile) return val.toLocaleString('en-US');
    if (val >= 1000000) return (val / 1000000).toFixed(1).replace('.0', '') + 'م';
    if (val >= 1000) return (val / 1000).toFixed(0) + 'ك';
    return String(val);
  }

  function formatMonthLabel(lbl) {
    if (!isMobile) return lbl;
    for (const [full, sh] of Object.entries(SHORT_MONTHS)) {
      if (lbl.includes(full)) return lbl.replace(full, sh);
    }
    return lbl;
  }

  // Grid lines: 3 lines on mobile, 4 on tablet/desktop
  const gridCount = isMobile ? 3 : 4;
  const gridLines = [];
  for (let i = 0; i <= gridCount; i++) {
    const y = padTop + (chartH / gridCount) * i;
    const val = Math.round(maxVal - (maxVal / gridCount) * i);
    gridLines.push(`
      <line x1="${padLeft}" y1="${y}" x2="${w - padRight}" y2="${y}" stroke="${gridStroke}" stroke-dasharray="4" />
      <text x="${w - padRight + (isMobile ? 6 : 10)}" y="${y + 4}" fill="${textColor}" text-anchor="start" direction="ltr" style="direction:ltr;unicode-bidi:isolate;" font-size="${isMobile ? 10 : 11}" font-weight="600" font-family="var(--font-en)">${formatAxisNum(val)}</text>
    `);
  }

  // Bars and points
  const bars = [];
  const linePoints = [];

  series.forEach((s, idx) => {
    const cx = w - padRight - (idx + 0.5) * slotW;

    const revH = Math.max(0, ((s.revenue || 0) / maxVal) * chartH);
    const expH = Math.max(0, ((s.expenses || 0) / maxVal) * chartH);
    const colY = padTop + chartH - ((s.collected_cash || 0) / maxVal) * chartH;

    const revX = cx + barW * 0.1;
    const expX = cx - barW * 1.1;
    const revY = padTop + chartH - revH;
    const expY = padTop + chartH - expH;

    linePoints.push(`${cx},${colY}`);

    const isDrillable = isMultiYear && ((s.grain_key && /^\d{4}$/.test(s.grain_key)) || /^\d{4}$/.test(s.label));
    const drillYear = (s.grain_key && /^\d{4}$/.test(s.grain_key)) ? s.grain_key : s.label;
    const drillAttr = isDrillable ? `data-drill-year="${drillYear}" style="cursor:pointer;"` : '';
    const drillHint = isDrillable ? `\n(انقر للتفصيل الشهري لعام ${drillYear})` : '';

    const isCurrentYear = currentTimeFilter?.selectedYear === String(currentYear);
    const isCurrentMonth = isCurrentYear && (idx === series.length - 1 || s.label?.includes('أكتوبر') || s.month_num === currentMonth);
    const monthOpacity = isCurrentMonth ? '0.45' : '0.95';
    const monthSuffix = isCurrentMonth ? ' (جارٍ)' : '';
    const displayLabel = formatMonthLabel(s.label || '') + monthSuffix;

    bars.push(`
      <g class="exec-chart-group" data-idx="${idx}" ${drillAttr}>
        <rect class="chart-bar-rev" x="${revX}" y="${revY}" width="${barW}" height="${revH}" fill="var(--chart-revenue)" rx="2" opacity="${monthOpacity}">
          <title>${s.label}\nالإيرادات: ${(s.revenue || 0).toLocaleString('en-US')} ريال${drillHint}</title>
        </rect>
        <rect class="chart-bar-exp" x="${expX}" y="${expY}" width="${barW}" height="${expH}" fill="var(--chart-expense)" rx="2" opacity="${monthOpacity}">
          <title>${s.label}\nالمصروفات: ${(s.expenses || 0).toLocaleString('en-US')} ريال${drillHint}</title>
        </rect>
        <text x="${cx}" y="${h - 8}" fill="${textColor}" font-size="${isMobile ? 10 : 11}" font-weight="600" text-anchor="middle">${escapeHtml(displayLabel)}</text>
      </g>
    `);
  });

  const pathD = linePoints.length ? `M ${linePoints.join(' L ')}` : '';

  return `
    <svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" style="width:100%;height:${h}px;display:block;overflow:visible;">
      ${gridLines.join('')}
      ${bars.join('')}
      <path d="${pathD}" fill="none" stroke="var(--chart-collection)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      ${linePoints.map((pt, i) => `
        <circle cx="${pt.split(',')[0]}" cy="${pt.split(',')[1]}" r="${isMobile ? 3.5 : 4.5}" fill="var(--chart-collection)" stroke="var(--bg-surface)" stroke-width="2">
          <title>${series[i]?.label}\nالتحصيل النقدي: ${(series[i]?.collected_cash || 0).toLocaleString('en-US')} ريال</title>
        </circle>
      `).join('')}
    </svg>
  `;
}

/**
 * Render Hierarchical Performance & Collection Table (P4: Custom columns)
 */
// Aging table column definitions
const agingColumns = [
  { id: 'name', label: 'البيان', minWidth: '140px', align: 'right', priority: 1 },
  { id: 'not_due', label: 'غير مستحق', align: 'left', minWidth: '65px', maxWidth: '90px', priority: 1 },
  { id: 'b1_30', label: '1-30 يوم', align: 'left', minWidth: '65px', maxWidth: '90px', priority: 1 },
  { id: 'b31_60', label: '31-60 يوم', align: 'left', minWidth: '65px', maxWidth: '90px', priority: 1 },
  { id: 'b61_90', label: '61-90 يوم', align: 'left', minWidth: '65px', maxWidth: '90px', priority: 1 },
  { id: 'b91_180', label: '91-180 يوم', align: 'left', minWidth: '65px', maxWidth: '90px', priority: 2 },
  { id: 'b181_365', label: '181-365 يوم', align: 'left', minWidth: '65px', maxWidth: '90px', priority: 2 },
  { id: 'over_365', label: '+365 يوم', align: 'left', minWidth: '65px', maxWidth: '90px', priority: 1 },
  { id: 'total_residual', label: 'إجمالي المتبقي', align: 'left', minWidth: '75px', maxWidth: '100px', color: 'var(--exec-danger)', priority: 1 }
];

function getMainTableColumns(prefs) {
  const cols = prefs.columns || defaultPreferences.columns;
  const list = [{ id: 'name', label: 'البيان', minWidth: '180px', align: 'right', priority: 1 }];
  if (cols.includes('revenue')) list.push({ id: 'revenue', label: 'الإيرادات', align: 'left', width: '90px', minWidth: '75px', priority: 1 });
  if (cols.includes('expenses')) list.push({ id: 'expenses', label: 'المصروفات', align: 'left', width: '90px', minWidth: '75px', priority: 1 });
  if (cols.includes('net_profit')) list.push({ id: 'net_profit', label: 'صافي الربح', align: 'left', width: '90px', minWidth: '75px', priority: 1 });
  if (cols.includes('margin')) list.push({ id: 'margin', label: 'هامش الربح', align: 'center', width: '80px', minWidth: '65px', priority: 2 });
  if (cols.includes('collected')) list.push({ id: 'collected', label: 'المحصّل', align: 'left', width: '90px', minWidth: '75px', priority: 1 });
  if (cols.includes('collection_rate')) list.push({ id: 'collection_rate', label: 'نسبة التحصيل', align: 'center', flex: true, minWidth: '120px', priority: 2 });
  if (cols.includes('residual')) list.push({ id: 'residual', label: 'المتبقي', align: 'left', width: '90px', minWidth: '75px', priority: 1 });
  return list;
}

function renderMainTableRow({ node, pathKey, depth, isExpanded, hasKids, isLeaf }) {
  const isDept = depth === 1;
  const isGroup = !!node.isGroup;
  const isJournal = node.type === 'journal' || !!node.isJournal;
  const isClient = node.type === 'client' || !!node.partner_id;
  const isAccount = node.type === 'account' || !!node.code;

  const cols = userPreferences.columns || defaultPreferences.columns;
  const showRev = cols.includes('revenue');
  const showExp = cols.includes('expenses');
  const showNet = cols.includes('net_profit');
  const showMargin = cols.includes('margin');
  const showCol = cols.includes('collected');
  const showRate = cols.includes('collection_rate');
  const showRes = cols.includes('residual');

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

  const nodeName = node.name || node.code || '';

  let companyDot = '';
  if (depth === 0) {
    const cid = node.company_id != null ? node.company_id : Number(String(node.id).replace(/^co_?/, ''));
    companyDot = `<span class="company-dot" style="background:var(--company-${cid || 1});"></span>`;
  }

  const cursor = hasKids ? 'cursor:pointer;' : (isClient ? 'cursor:pointer;' : '');
  const rowStyle = depth === 0 
    ? 'font-weight:700;background:var(--bg-hover);color:var(--text-primary);' 
    : (isDept 
        ? 'font-weight:600;color:var(--text-secondary);' 
        : 'color:var(--text-secondary);');

  const nodeColor = isClient 
    ? 'color:var(--brand-accent);text-decoration:underline;' 
    : (isJournal 
        ? 'color:var(--status-warning);font-weight:600;' 
        : (depth > 0 ? 'color:var(--text-secondary);' : 'color:var(--text-primary);'));

  // R3-8: Applicable vs non-applicable columns
  const isFinanceRow = depth === 0 || isDept || isAccount || node.isAccounts || node.name === 'الحسابات';
  const isSalesRow = depth === 0 || isDept || isClient || isJournal || node.isClients || node.name === 'العملاء';

  const revVal = isFinanceRow ? fmtVal(node.revenue) : '';
  const expVal = isFinanceRow ? fmtVal(node.expenses) : '';
  const netVal = isFinanceRow ? fmtVal(node.net_profit) : '';
  const marginVal = isFinanceRow ? fmtRate(node.margin, true, node.revenue) : '';

  const colVal = isSalesRow ? fmtVal(node.collected) : '';
  const resVal = isSalesRow ? fmtVal(node.residual) : '';
  let rateVal = '';
  if (isSalesRow) {
    if (node.collection_rate !== null && node.collection_rate !== undefined) {
      const rateNum = Number(node.collection_rate);
      const rateColor = rateNum >= 60 ? 'var(--status-positive)' : 'var(--status-warning)';
      rateVal = `
        <div style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-width:110px;">
          <div style="flex:1;height:6px;background:var(--bg-subtle);border-radius:3px;overflow:hidden;">
            <div style="width:${Math.min(100, Math.max(0, rateNum))}%;height:100%;background:${rateColor};border-radius:3px;"></div>
          </div>
          <span class="exec-num" style="font-size:12px;font-weight:600;min-width:40px;text-align:left;">${fmtRate(rateNum)}</span>
        </div>
      `;
    } else {
      rateVal = '—';
    }
  }

  return `
    <tr data-tree-row="true" data-path-key="${escapeHtml(pathKey)}" style="${cursor} ${rowStyle}">
      <td data-col-id="name" data-priority="1" class="tree-col-name" style="padding-top:12px !important;padding-bottom:12px !important;padding-left:14px !important;padding-right:${indent + 14}px !important;text-align:right;">
        <span data-tree-toggle="true" style="display:inline-block;width:18px;color:var(--text-muted);">${iconSvg}</span>
        ${companyDot}
        <span data-tree-name="true" class="tree-node-name" title="${escapeHtml(nodeName)}" style="vertical-align:middle;${nodeColor}">${escapeHtml(nodeName)}</span>
        ${isClient && node.invoices ? `<span style="font-size:11px;color:var(--text-muted);margin-right:6px;">(${node.invoices.length} فواتير)</span>` : ''}
      </td>
      ${showRev ? `<td data-col-id="revenue" data-priority="1" class="tree-col-num" style="text-align:left;">${revVal}</td>` : ''}
      ${showExp ? `<td data-col-id="expenses" data-priority="1" class="tree-col-num" style="text-align:left;">${expVal}</td>` : ''}
      ${showNet ? `<td data-col-id="net_profit" data-priority="1" class="tree-col-num" style="text-align:left;">${netVal}</td>` : ''}
      ${showMargin ? `<td data-col-id="margin" data-priority="2" class="tree-col-num" style="text-align:center;">${marginVal}</td>` : ''}
      ${showCol ? `<td data-col-id="collected" data-priority="1" class="tree-col-num" style="text-align:left;">${colVal}</td>` : ''}
      ${showRate ? `<td data-col-id="collection_rate" data-priority="2" class="tree-col-visual" style="text-align:center;padding:8px 12px;">${rateVal}</td>` : ''}
      ${showRes ? `<td data-col-id="residual" data-priority="1" class="tree-col-num" style="text-align:left;">${resVal}</td>` : ''}
    </tr>
  `;
}

function renderMainTableTotals(totals) {
  const cols = userPreferences.columns || defaultPreferences.columns;
  const showRev = cols.includes('revenue');
  const showExp = cols.includes('expenses');
  const showNet = cols.includes('net_profit');
  const showMargin = cols.includes('margin');
  const showCol = cols.includes('collected');
  const showRate = cols.includes('collection_rate');
  const showRes = cols.includes('residual');

  const totRate = totals.collection_rate != null ? Number(totals.collection_rate) : 0;
  const rateColor = totRate >= 60 ? 'var(--status-positive)' : 'var(--status-warning)';

  return `
    <tr class="exec-sticky-footer">
      <td data-col-id="name" data-priority="1" class="tree-col-name" style="font-weight:700;font-size:14px;color:var(--text-primary);">الإجمالي</td>
      ${showRev ? `<td data-col-id="revenue" data-priority="1" class="tree-col-num" style="text-align:left;">${fmtVal(totals.revenue)}</td>` : ''}
      ${showExp ? `<td data-col-id="expenses" data-priority="1" class="tree-col-num" style="text-align:left;">${fmtVal(totals.expenses)}</td>` : ''}
      ${showNet ? `<td data-col-id="net_profit" data-priority="1" class="tree-col-num" style="text-align:left;">${fmtVal(totals.net_profit)}</td>` : ''}
      ${showMargin ? `<td data-col-id="margin" data-priority="2" class="tree-col-num" style="text-align:center;">${fmtRate(totals.margin, true, totals.revenue)}</td>` : ''}
      ${showCol ? `<td data-col-id="collected" data-priority="1" class="tree-col-num" style="text-align:left;">${fmtVal(totals.collected)}</td>` : ''}
      ${showRate ? `
        <td data-col-id="collection_rate" data-priority="2" class="tree-col-visual" style="text-align:center;padding:10px 14px;">
          <div style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-width:110px;">
            <div style="flex:1;height:6px;background:var(--bg-surface);border-radius:3px;overflow:hidden;">
              <div style="width:${Math.min(100, totRate)}%;height:100%;background:${rateColor};border-radius:3px;"></div>
            </div>
            <span class="exec-num" style="font-size:12px;font-weight:700;min-width:40px;text-align:left;">${fmtRate(totRate)}</span>
          </div>
        </td>
      ` : ''}
      ${showRes ? `<td data-col-id="residual" data-priority="1" class="tree-col-num" style="text-align:left;">${fmtVal(totals.residual)}</td>` : ''}
    </tr>
  `;
}

function initMainTreeTable(treeContainer, displayTree) {
  if (!treeContainer) return;
  const columns = getMainTableColumns(userPreferences);
  const rows = displayTree.rows || [];

  for (const co of rows) {
    const cid = co.company_id != null ? co.company_id : Number(String(co.id).replace(/^co_?/, ''));
    co.company_id = cid;
    for (const dept of (co.children || [])) {
      dept.company_id = cid;
      if (dept.department_id == null && dept.id) {
        dept.department_id = Number(String(dept.id).replace(/^dept_\d+_/, '').replace(/^dept_?/, ''));
      }
    }
  }

  const inst = createTreeTable(treeContainer, {
    storageKey: 'mizaniat_exec_main_expanded',
    columns,
    data: rows,
    totals: displayTree.totals || {},
    showZeroItems: store.get('showZeroItems') ?? false,
    getNodeKey: (node, parentPath, depth) => {
      if (depth === 0) {
        const cid = node.company_id != null ? node.company_id : String(node.id).replace(/^co_?/, '');
        return `co:${cid}`;
      }
      if (depth === 1) {
        const did = node.department_id != null ? node.department_id : String(node.id).replace(/^dept_\d+_/, '').replace(/^dept_?/, '');
        return `${parentPath}/dept:${did}`;
      }
      if (node.isGroup) return `${parentPath}/grp:${node.isClients ? 'clients' : 'accounts'}`;
      if (node.isJournal || node.type === 'journal') return `${parentPath}/j:${node.journal_id !== undefined ? node.journal_id : node.id}`;
      if (node.type === 'client' || node.partner_id) return `${parentPath}/p:${node.partner_id || node.id}`;
      if (node.type === 'account' || node.code) return `${parentPath}/acc:${node.code || node.id}`;
      return `${parentPath}/n:${node.id || node.name}`;
    },
    getChildren: (node) => node.children,
    hasChildren: (node) => {
      if (node.isGroup || node.isJournal || node.type === 'journal') return !!(node.children && node.children.length > 0);
      if (node.type === 'client' || node.partner_id || node.type === 'account' || node.code) return false;
      if (node.children && node.children.length > 0) return true;
      if (node.has_children !== undefined) return !!node.has_children;
      if (node.department_id != null && Number(node.department_id) > 0) return true;
      return false;
    },
    loadChildren: async (node, pathKey) => {
      const coMatch = pathKey.match(/co:(\d+)/);
      const deptMatch = pathKey.match(/dept:(\d+)/);
      const companyId = node.company_id != null ? Number(node.company_id) : (coMatch ? Number(coMatch[1]) : undefined);
      let deptId = node.department_id != null ? Number(node.department_id) : (deptMatch ? Number(deptMatch[1]) : null);
      if (deptId == null && typeof node.id === 'string' && node.id.startsWith('dept_')) {
        const parsed = Number(node.id.replace(/^dept_\d+_/, '').replace(/^dept_?/, ''));
        if (!isNaN(parsed)) deptId = parsed;
      }
      if (deptId == null || isNaN(deptId) || deptId <= 0) {
        return node.children || [];
      }

      const periodParams = getPeriodParamsFromFilter(currentTimeFilter);
      const childData = await api.getExecutiveChildren({
        companyId,
        departmentId: deptId,
        ...periodParams
      });

      const children = [];
      const hasClients = (childData.journals && childData.journals.length > 0) || (childData.clients && childData.clients.length > 0);
      if (hasClients) {
        const sum = childData.clientsSummary || {};
        let journalsList = childData.journals || [];
        if (journalsList.length === 0 && childData.clients) {
          journalsList = [{
            id: `journal_${companyId}_${deptId}_0`,
            name: 'بدون دفتر',
            journal_id: 0,
            billed: sum.billed,
            collected: sum.collected,
            residual: sum.residual,
            collection_rate: sum.collection_rate,
            clients: childData.clients
          }];
        }
        const targetBilled = node.billed != null ? node.billed : sum.billed;
        const targetCollected = node.collected != null ? node.collected : sum.collected;
        const targetResidual = node.residual != null ? node.residual : sum.residual;
        const targetRate = targetBilled > 0 ? Math.round((targetCollected / targetBilled) * 1000) / 10 : (node.collection_rate != null ? node.collection_rate : sum.collection_rate);

        // Adjust journalsList rounding to match exact target values
        if (journalsList.length > 0) {
          const jTotColl = journalsList.reduce((s, j) => s + (j.collected || 0), 0);
          const cDiff = targetCollected - jTotColl;
          if (cDiff !== 0 && Math.abs(cDiff) <= 2) {
            let maxJ = 0;
            for (let i = 1; i < journalsList.length; i++) {
              if ((journalsList[i].collected || 0) > (journalsList[maxJ].collected || 0)) maxJ = i;
            }
            journalsList[maxJ].collected += cDiff;
            if (journalsList[maxJ].billed > 0) {
              journalsList[maxJ].collection_rate = Math.round((journalsList[maxJ].collected / journalsList[maxJ].billed) * 1000) / 10;
            }
          }
        }

        children.push({
          id: `sub_clients_${companyId}_${deptId}`,
          name: 'العملاء',
          type: 'grp',
          isGroup: true,
          isClients: true,
          company_id: companyId,
          department_id: deptId,
          billed: targetBilled,
          collected: targetCollected,
          residual: targetResidual,
          collection_rate: targetRate,
          revenue: null,
          expenses: null,
          net_profit: null,
          margin: null,
          children: journalsList.map(j => ({
            id: `journal_${companyId}_${deptId}_${j.journal_id !== undefined ? j.journal_id : j.id}`,
            name: j.name,
            type: 'journal',
            isJournal: true,
            company_id: companyId,
            department_id: deptId,
            journal_id: j.journal_id,
            billed: j.billed,
            collected: j.collected,
            residual: j.residual,
            collection_rate: j.collection_rate,
            revenue: null,
            expenses: null,
            net_profit: null,
            margin: null,
            children: (j.clients || []).map(c => ({
              ...c,
              type: 'client',
              company_id: companyId,
              department_id: deptId,
              journal_id: j.journal_id
            }))
          }))
        });
      }
      if (childData.accounts && childData.accounts.length > 0) {
        const sum = childData.accountsSummary || {};
        const targetRev = node.revenue != null ? node.revenue : sum.revenue;
        const targetExp = node.expenses != null ? node.expenses : sum.expenses;
        const targetNet = node.net_profit != null ? node.net_profit : sum.net_profit;
        const targetMargin = node.margin != null ? node.margin : sum.margin;

        children.push({
          id: `sub_accounts_${companyId}_${deptId}`,
          name: 'الحسابات',
          type: 'grp',
          isGroup: true,
          isAccounts: true,
          company_id: companyId,
          department_id: deptId,
          revenue: targetRev,
          expenses: targetExp,
          net_profit: targetNet,
          margin: targetMargin,
          billed: null,
          collected: null,
          residual: null,
          collection_rate: null,
          children: childData.accounts.map(a => ({
            ...a,
            type: 'account',
            company_id: companyId,
            department_id: deptId
          }))
        });
      }
      node.children = children;
      return children;
    },
    renderRow: renderMainTableRow,
    renderTotals: renderMainTableTotals,
    onLeafClick: (node) => {
      if (node.type === 'client' || node.partner_id) {
        openExecutiveDrawer(node);
      }
    }
  });

  const urlParams = new URLSearchParams(window.location.search);
  const saved = sessionStorage.getItem('mizaniat_exec_main_expanded');
  if (!saved || saved === '[]') {
    if (urlParams.has('expandCo') && rows.length > 0) {
      const cid = rows[0].company_id != null ? rows[0].company_id : String(rows[0].id).replace(/^co_?/, '');
      inst.expandAll([`co:${cid}`]);
    } else if (userPreferences.default_open_level === 'departments' && rows.length > 0) {
      inst.expandAll(rows.map(co => {
        const cid = co.company_id != null ? co.company_id : String(co.id).replace(/^co_?/, '');
        return `co:${cid}`;
      }));
    }
  }

  // Wire F1-ب Search Input & Toolbar Buttons
  const cardParent = treeContainer.closest('.exec-table-card') || treeContainer.parentElement;
  const searchInput = cardParent?.querySelector('#exec-tree-search') || document.querySelector('#exec-tree-search');
  const clearBtn = cardParent?.querySelector('#btn-exec-clear-search') || document.querySelector('#btn-exec-clear-search');
  const countEl = cardParent?.querySelector('#exec-search-counter') || document.querySelector('#exec-search-counter');
  const btnExpand = cardParent?.querySelector('#exec-btn-expand-all') || document.querySelector('#exec-btn-expand-all');
  const btnCollapse = cardParent?.querySelector('#exec-btn-collapse-all') || document.querySelector('#exec-btn-collapse-all');
  const btnExcel = cardParent?.querySelector('#exec-exp-excel') || document.querySelector('#exec-exp-excel');

  if (btnExpand) btnExpand.onclick = () => inst.expandAll();
  if (btnCollapse) btnCollapse.onclick = () => inst.collapseAll();
  if (btnExcel) btnExcel.onclick = () => exportExecutiveExcel();

  if (searchInput && inst && inst.bindSearchInput) {
    const periodParams = getPeriodParamsFromFilter(currentTimeFilter);
    const searchContext = {
      companyIds: currentSelectedCos && currentSelectedCos.length ? currentSelectedCos.join(',') : undefined,
      ...periodParams
    };
    inst.bindSearchInput(searchInput, {
      clearButton: clearBtn,
      countElement: countEl,
      searchContext
    });
  }
}

function renderAgingTableRow({ node, pathKey, depth, isExpanded, hasKids, isLeaf }) {
  const indent = depth * 16;
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
  const cursor = hasKids ? 'cursor:pointer;' : '';
  const isInvoice = !!node.isInvoice;
  const bk = node.buckets || {};

  let rowBg = '';
  if (depth === 0) rowBg = 'background:var(--bg-hover);font-weight:700;';
  else if (depth === 1) rowBg = 'font-weight:600;';
  else if (depth === 2) rowBg = 'font-weight:500;';
  else if (isInvoice) rowBg = 'font-size:12px;background:var(--bg-subtle);';

  if (isInvoice) {
    const isOver90 = (node.age_days || 0) > 90;
    const bKey = node.bucket || getInvoiceBucket(node.age_days);

    return `
      <tr data-tree-row="true" data-path-key="${escapeHtml(pathKey)}" style="${cursor} ${rowBg}">
        <td style="padding-right:${indent + 14}px;">
          <div style="display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span style="color:var(--text-muted);font-size:12px;">•</span>
            <strong style="font-family:var(--font-en);font-size:13px;color:var(--text-primary);">${escapeHtml(node.name || 'فاتورة')}</strong>
            <span style="font-size:11px;padding:2px 6px;border-radius:4px;background:${isOver90 ? 'var(--status-negative-subtle)' : 'var(--status-positive-subtle)'};color:${isOver90 ? 'var(--status-negative)' : 'var(--status-positive)'};font-weight:600;">
              ${isOver90 ? 'متأخرة (+90 يوم)' : 'سارية'}
            </span>
            <span style="font-size:12px;color:var(--text-muted);">
              تاريخ: <span class="exec-num">${node.invoice_date || '—'}</span> | استحقاق: <span class="exec-num">${node.due_date || '—'}</span> (${node.age_days || 0} يوم)
            </span>
          </div>
        </td>
        <td style="text-align:left;">${bKey === 'not_due' ? fmtVal(node.total_residual) : '—'}</td>
        <td style="text-align:left;">${bKey === 'b1_30' ? fmtVal(node.total_residual) : '—'}</td>
        <td style="text-align:left;">${bKey === 'b31_60' ? fmtVal(node.total_residual) : '—'}</td>
        <td style="text-align:left;">${bKey === 'b61_90' ? fmtVal(node.total_residual) : '—'}</td>
        <td style="text-align:left;color:${isOver90 ? 'var(--status-negative)' : ''};">${bKey === 'b91_180' ? fmtVal(node.total_residual) : '—'}</td>
        <td style="text-align:left;color:${isOver90 ? 'var(--status-negative)' : ''};">${bKey === 'b181_365' ? fmtVal(node.total_residual) : '—'}</td>
        <td style="text-align:left;color:${isOver90 ? 'var(--status-negative)' : ''};">${bKey === 'over_365' ? fmtVal(node.total_residual) : '—'}</td>
        <td style="text-align:left;font-weight:700;color:var(--status-negative);">${fmtVal(node.total_residual)}</td>
      </tr>
    `;
  }

  return `
    <tr data-tree-row="true" data-path-key="${escapeHtml(pathKey)}" style="${cursor} ${rowBg}">
      <td style="padding-right:${indent + 14}px;">
        <span data-tree-toggle="true" style="display:inline-block;width:18px;color:var(--text-muted);">${iconSvg}</span>
        ${escapeHtml(node.name || node.partner_name || node.company_name || '')}
      </td>
      <td style="text-align:left;">${fmtVal(bk.not_due)}</td>
      <td style="text-align:left;">${fmtVal(bk.b1_30)}</td>
      <td style="text-align:left;">${fmtVal(bk.b31_60)}</td>
      <td style="text-align:left;">${fmtVal(bk.b61_90)}</td>
      <td style="text-align:left;color:${bk.b91_180 > 0 ? 'var(--status-negative)' : ''};">${fmtVal(bk.b91_180)}</td>
      <td style="text-align:left;color:${bk.b181_365 > 0 ? 'var(--status-negative)' : ''};">${fmtVal(bk.b181_365)}</td>
      <td style="text-align:left;color:${bk.over_365 > 0 ? 'var(--status-negative)' : ''};">${fmtVal(bk.over_365)}</td>
      <td style="text-align:left;font-weight:700;color:var(--status-negative);">${fmtVal(node.total_residual)}</td>
    </tr>
  `;
}

function renderAgingTableTotals(totals) {
  const b = totals.buckets || {};
  return `
    <tr class="exec-sticky-footer">
      <td style="color:var(--text-primary);font-weight:700;">الإجمالي</td>
      <td style="text-align:left;">${fmtVal(b.not_due)}</td>
      <td style="text-align:left;">${fmtVal(b.b1_30)}</td>
      <td style="text-align:left;">${fmtVal(b.b31_60)}</td>
      <td style="text-align:left;">${fmtVal(b.b61_90)}</td>
      <td style="text-align:left;color:var(--status-negative);">${fmtVal(b.b91_180)}</td>
      <td style="text-align:left;color:var(--status-negative);">${fmtVal(b.b181_365)}</td>
      <td style="text-align:left;color:var(--status-negative);">${fmtVal(b.over_365)}</td>
      <td style="text-align:left;color:var(--status-negative);font-weight:700;">${fmtVal(totals.total_residual)}</td>
    </tr>
  `;
}

function initAgingTreeTable(agContainer, aging) {
  if (!agContainer) return;
  const tree = aging.tree || [];
  const totals = aging.totals || {};

  for (const co of tree) {
    for (const dept of (co.departments || [])) {
      dept.company_id = co.id;
      for (const p of (dept.partners || [])) {
        p.company_id = co.id;
        p.department_id = dept.id;
      }
    }
  }

  createTreeTable(agContainer, {
    storageKey: 'mizaniat_exec_aging_expanded',
    columns: agingColumns,
    data: tree,
    totals: totals,
    showZeroItems: store.get('showZeroItems') ?? false,
    getNodeKey: (node, parentPath, depth) => {
      if (depth === 0) return `co:${node.id}`;
      if (depth === 1) return `${parentPath}/dept:${node.id}`;
      if (depth === 2) return `${parentPath}/p:${node.id}`;
      if (depth === 3) return `${parentPath}/inv:${node.id || node.name}`;
      return `${parentPath}/n:${node.id || node.name}`;
    },
    getChildren: (node) => {
      if (node.departments) return node.departments;
      if (node.partners) return node.partners;
      if (node.invoices) return node.invoices;
      return null;
    },
    hasChildren: (node) => {
      if (node.isInvoice) return false;
      if (node.departments && node.departments.length > 0) return true;
      if (node.partners && node.partners.length > 0) return true;
      if (node.invoices && node.invoices.length > 0) return true;
      if (node.partner_name || (node.id && !node.departments && !node.partners && !node.isInvoice)) return true;
      return false;
    },
    loadChildren: async (node, pathKey) => {
      if (!node.departments && !node.partners) {
        if (node.invoices && node.invoices.length > 0) return node.invoices;
        const coMatch = pathKey.match(/co:(\d+)/);
        const deptMatch = pathKey.match(/dept:(\d+)/);
        const companyId = node.company_id || (coMatch ? Number(coMatch[1]) : undefined);
        const departmentId = node.department_id || (deptMatch ? Number(deptMatch[1]) : undefined);
        const partnerId = node.id;

        const periodParams = getPeriodParamsFromFilter(currentTimeFilter);
        const res = await api.getExecutiveInvoices({
          companyId,
          departmentId,
          partnerId,
          ...periodParams
        });

        const invs = res.invoices || [];
        const invoiceNodes = invs.map(inv => {
          const ageDays = inv.age_days || 0;
          const bKey = getInvoiceBucket(ageDays);
          const resVal = Math.round(inv.amount_residual_signed !== undefined ? inv.amount_residual_signed : (inv.amount_residual || 0));
          const bk = { not_due: 0, b1_30: 0, b31_60: 0, b61_90: 0, b91_180: 0, b181_365: 0, over_365: 0 };
          bk[bKey] = resVal;
          return {
            id: inv.id,
            name: inv.invoice_name || inv.name,
            type: 'inv',
            isInvoice: true,
            invoice_date: inv.invoice_date,
            due_date: inv.due_date,
            age_days: ageDays,
            payment_state: inv.payment_state,
            total_residual: resVal,
            bucket: bKey,
            buckets: bk
          };
        });
        node.invoices = invoiceNodes;
        return invoiceNodes;
      }
      return [];
    },
    renderRow: renderAgingTableRow,
    renderTotals: renderAgingTableTotals
  });
}

/**
 * Standalone loadAging to fetch aging on toggle OR on period refresh (AG2)
 */
async function loadAging(container, force = false) {
  const agBox = container.querySelector('#exec-aging-container');
  if (!agBox) return;

  if (!force && currentExecutiveData?.aging && currentExecutiveData.aging.tree?.length > 0) {
    initAgingTreeTable(agBox, currentExecutiveData.aging);
    return;
  }

  const reqId = ++currentAgingRequestId;
  agBox.innerHTML = `
    <div style="padding:40px;text-align:center;color:var(--text-muted);">
      <svg class="spin-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;animation:spin 0.8s linear infinite;"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg><br>
      جاري تحميل أعمار الذمم...
    </div>
  `;

  try {
    const periodParams = getPeriodParamsFromFilter(currentTimeFilter);
    const agRes = await api.getExecutiveAging({
      companyIds: currentSelectedCos && currentSelectedCos.length ? currentSelectedCos.join(',') : undefined,
      ...periodParams
    });

    if (reqId !== currentAgingRequestId) return;

    if (currentExecutiveData) {
      currentExecutiveData.aging = agRes;
    }
    const toggleStrong = container.querySelector('#exec-aging-toggle strong.exec-num');
    if (toggleStrong && agRes.totals?.total_residual !== undefined) {
      toggleStrong.textContent = `${Math.round(agRes.totals.total_residual).toLocaleString('en-US')} ريال`;
    }
    initAgingTreeTable(agBox, agRes);
  } catch (err) {
    if (reqId !== currentAgingRequestId) return;
    console.error('Error fetching aging:', err);
    agBox.innerHTML = `<div style="padding:20px;text-align:center;color:var(--status-negative);">حدث خطأ أثناء تحميل أعمار الذمم</div>`;
  }
}

function bindExecutiveTableEvents(container) {
  const toggleBtn = container.querySelector('#exec-aging-toggle');
  if (toggleBtn && !toggleBtn._agingToggleBound) {
    toggleBtn._agingToggleBound = true;
    toggleBtn.addEventListener('click', async () => {
      isAgingOpen = !isAgingOpen;
      const agBox = container.querySelector('#exec-aging-container');
      const badge = container.querySelector('#exec-aging-toggle span:nth-child(2)');
      if (agBox) agBox.style.display = isAgingOpen ? 'block' : 'none';
      if (badge) badge.textContent = isAgingOpen ? 'إخفاء ▲' : 'عرض التفاصيل ▾';

      if (isAgingOpen) {
        loadAging(container, false);
      }
    });
  }

  // Multi-year Chart Drilldown (YR1)
  const chartBox = container.querySelector('#exec-chart-container');
  if (chartBox && !chartBox._chartDrillBound) {
    chartBox._chartDrillBound = true;
    chartBox.addEventListener('click', (e) => {
      const grp = e.target.closest('.exec-chart-group[data-drill-year]');
      if (!grp) return;
      const drillYear = grp.dataset.drillYear;
      if (!drillYear) return;

      const pageContainer = container.closest('.presentation-container') || document;
      const targetChip = pageContainer.querySelector(`.yr-chip[data-year="${drillYear}"]`);
      if (targetChip) {
        pageContainer.querySelectorAll('.yr-chip, .yr-all').forEach(c => c.classList.remove('active'));
        targetChip.classList.add('active');
        const df = pageContainer.querySelector('#date-from');
        const dt = pageContainer.querySelector('#date-to');
        if (df) df.value = '';
        if (dt) dt.value = '';
        const clearBtn = pageContainer.querySelector('#btn-clear-date');
        if (clearBtn) clearBtn.style.display = 'none';

        targetChip.click();
      }
    });
  }
}

/**
 * Slide-over drawer with customer invoices (P1: Lazy loaded)
 */
async function openExecutiveDrawer(client) {
  selectedDrawerClient = client;
  const backdrop = document.querySelector('#exec-drawer-backdrop');
  const drawer = document.querySelector('#exec-drawer');
  const content = document.querySelector('#exec-drawer-content');
  if (!drawer || !content || !backdrop) return;

  backdrop.style.display = 'block';
  setTimeout(() => { drawer.style.transform = 'translateX(0)'; }, 10);

  // Show loading skeleton inside drawer
  content.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;border-bottom:1px solid var(--border-subtle);padding-bottom:14px;">
      <div>
        <h3 style="margin:0;font-size:1.2rem;font-weight:800;color:var(--text-primary);">${escapeHtml(client.name || 'العميل')}</h3>
        <span style="font-size:0.85rem;color:var(--text-secondary);">جاري جلب تفاصيل الفواتير...</span>
      </div>
      <button id="exec-drawer-close" style="background:none;border:none;color:var(--text-secondary);font-size:1.4rem;cursor:pointer;padding:4px;">✕</button>
    </div>
    <div style="padding:40px;text-align:center;color:var(--text-secondary);">
      <svg style="width:24px;height:24px;animation:spin 0.8s linear infinite;color:var(--brand-accent);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
    </div>
  `;
  content.querySelector('#exec-drawer-close')?.addEventListener('click', closeExecutiveDrawer);

  let invs = client.invoices;
  if (!invs && (client.partner_id || client.id)) {
    try {
      const pid = client.partner_id || (client.id ? client.id.split('_').pop() : undefined);
      const deptId = client.department_id != null ? Number(client.department_id) : (client.id && client.id.startsWith('client_') ? Number(client.id.split('_')[2]) : undefined);
      const periodParams = getPeriodParamsFromFilter(currentTimeFilter);
      const res = await api.getExecutiveInvoices({
        companyId: client.company_id,
        partnerId: pid,
        departmentId: deptId,
        journalId: client.journal_id,
        ...periodParams
      });
      invs = res.invoices || [];
      client.invoices = invs;
    } catch (e) {
      console.error('Error fetching client invoices:', e);
      invs = [];
    }
  }

  invs = invs || [];

  content.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;border-bottom:1px solid var(--border-subtle);padding-bottom:14px;">
      <div>
        <h3 style="margin:0;font-size:1.2rem;font-weight:800;color:var(--text-primary);">${escapeHtml(client.name || 'العميل')}</h3>
        <span style="font-size:0.85rem;color:var(--text-secondary);">قائمة فواتير الفترة المحددة (${invs.length} فواتير)</span>
      </div>
      <button id="exec-drawer-close" style="background:none;border:none;color:var(--text-secondary);font-size:1.4rem;cursor:pointer;padding:4px;">✕</button>
    </div>

    <!-- Client Totals -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:20px;">
      <div style="background:var(--bg-surface);border:1px solid var(--border-default);border-radius:var(--radius-md);padding:12px;text-align:center;">
        <span style="font-size:0.75rem;color:var(--text-secondary);">المفوتر (بدون ضريبة)</span>
        <div class="exec-num" style="font-size:1.1rem;color:var(--chart-revenue);font-weight:800;">${(client.billed || 0).toLocaleString('en-US')}</div>
      </div>
      <div style="background:var(--bg-surface);border:1px solid var(--border-default);border-radius:var(--radius-md);padding:12px;text-align:center;">
        <span style="font-size:0.75rem;color:var(--text-secondary);">المحصّل (بدون ضريبة)</span>
        <div class="exec-num" style="font-size:1.1rem;color:var(--chart-collection);font-weight:800;">${(client.collected || 0).toLocaleString('en-US')}</div>
      </div>
      <div style="background:var(--bg-surface);border:1px solid var(--border-default);border-radius:var(--radius-md);padding:12px;text-align:center;">
        <span style="font-size:0.75rem;color:var(--text-secondary);">المتبقي</span>
        <div class="exec-num" style="font-size:1.1rem;color:var(--status-negative);font-weight:800;">${(client.residual || 0).toLocaleString('en-US')}</div>
      </div>
    </div>

    <!-- Invoices List -->
    <div style="display:flex;flex-direction:column;gap:12px;">
      ${invs.length === 0 ? `<div style="text-align:center;padding:40px;color:var(--text-secondary);">لا توجد فواتير مطابقة</div>` : ''}
      ${invs.map(inv => {
        const isOver90 = (inv.age_days || 0) > 90 && (inv.amount_residual || inv.amount_residual_signed || 0) > 0;
        const resVal = Math.round(inv.amount_residual !== undefined ? inv.amount_residual : (inv.amount_residual_signed || 0));
        return `
          <div style="background:var(--bg-surface);border:1px solid var(--border-default);border-radius:var(--radius-md);padding:14px;display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong style="color:var(--text-primary);font-family:var(--font-num);font-size:0.95rem;">${escapeHtml(inv.invoice_name || inv.name || 'فاتورة')}</strong>
              <span style="font-size:0.78rem;padding:3px 8px;border-radius:6px;background:${isOver90 ? 'var(--status-negative-subtle)' : 'var(--status-positive-subtle)'};color:${isOver90 ? 'var(--status-negative)' : 'var(--status-positive)'};font-weight:700;">
                ${isOver90 ? 'متأخرة (+90 يوم)' : 'سارية'}
              </span>
            </div>
            
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:0.85rem;color:var(--text-secondary);">
              <div>تاريخ الفاتورة: <strong class="exec-num" style="color:var(--text-primary);">${inv.invoice_date || inv.date || '—'}</strong></div>
              <div>الاستحقاق: <strong class="exec-num" style="color:var(--text-primary);">${inv.due_date || '—'}</strong></div>
              <div>العمر: <strong class="exec-num" style="color:${isOver90 ? 'var(--status-negative)' : 'var(--text-primary)'};">${inv.age_days || 0} يوم</strong></div>
              <div>المفوتر (بدون ضريبة): <strong class="exec-num" style="color:var(--text-primary);">${Math.round(inv.amount_untaxed || 0).toLocaleString('en-US')}</strong></div>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--border-subtle);padding-top:8px;margin-top:4px;font-size:0.88rem;">
              <span>المتبقي: <strong class="exec-num" style="color:var(--status-negative);font-size:1rem;">${resVal.toLocaleString('en-US')} ريال</strong></span>
              <span style="font-size:0.8rem;color:var(--text-secondary);">الإجمالي: ${(Math.round(inv.amount_total || 0)).toLocaleString('en-US')}</span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  content.querySelector('#exec-drawer-close')?.addEventListener('click', closeExecutiveDrawer);
}

function closeExecutiveDrawer() {
  const backdrop = document.querySelector('#exec-drawer-backdrop');
  const drawer = document.querySelector('#exec-drawer');
  if (drawer) drawer.style.transform = 'translateX(-100%)';
  if (backdrop) {
    setTimeout(() => { backdrop.style.display = 'none'; }, 250);
  }
}

window.openExecutiveDrawer = openExecutiveDrawer;

/**
 * Export: Excel (CSV)
 */
function exportExecutiveExcel() {
  if (!currentExecutiveData?.tree?.rows) return;
  const showZeros = store.get('showZeroItems') ?? false;
  const period = currentTimeFilter?.periodLabel || String(new Date().getFullYear());
  const csvRows = [];
  csvRows.push(['التقرير', 'لوحة الإدارة الموحدة - الأداء والتحصيل']);
  csvRows.push(['الفترة الفعالة', period]);
  csvRows.push([]);
  csvRows.push(['البيان', 'الإيرادات', 'المصروفات', 'صافي الربح', 'الهامش %', 'المحصّل', 'نسبة التحصيل %', 'المتبقي من فواتير الفترة']);

  function isSubtreeZero(node) {
    const isZero = (Math.abs(node.revenue || 0) < 0.01) &&
                   (Math.abs(node.expenses || 0) < 0.01) &&
                   (Math.abs(node.net_profit || 0) < 0.01) &&
                   (Math.abs(node.collected || 0) < 0.01) &&
                   (Math.abs(node.residual || 0) < 0.01);
    if (!isZero) return false;
    if (node.children && node.children.length > 0) {
      return node.children.every(ch => isSubtreeZero(ch));
    }
    return true;
  }

  function exportNode(node, prefix = '') {
    if (!showZeros && isSubtreeZero(node)) return;
    csvRows.push([
      `"${prefix}${node.name || node.code || ''}"`,
      node.revenue || 0,
      node.expenses || 0,
      node.net_profit || 0,
      node.margin || 0,
      node.collected || 0,
      node.collection_rate || 0,
      node.residual || 0
    ]);
    if (node.children) {
      for (const ch of node.children) exportNode(ch, prefix + '  ');
    }
  }

  for (const co of currentExecutiveData.tree.rows) {
    exportNode(co);
  }

  const totals = currentExecutiveData.tree.totals || {};
  csvRows.push([]);
  csvRows.push(['الإجمالي للمجموعة', totals.revenue, totals.expenses, totals.net_profit, totals.margin, totals.collected, totals.collection_rate, totals.residual]);

  const csvContent = '\uFEFF' + csvRows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `لوحة_الإدارة_${period.replace(/\s+/g, '_')}.csv`;
  a.click();
}

/**
 * Export: PDF (Landscape A4)
 */
async function exportExecutivePDF() {
  const content = document.querySelector('#exec-content');
  if (!content) return;
  try {
    const canvas = await html2canvas(content, {
      scale: 1.5,
      useCORS: true,
      backgroundColor: isLightMode ? '#ffffff' : '#0f172a'
    });
    const pdf = new jsPDF('landscape', 'mm', 'a4');
    const imgData = canvas.toDataURL('image/png');
    const imgWidth = 297;
    const pageHeight = 210;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`لوحة_الإدارة_${(currentTimeFilter?.periodLabel || String(new Date().getFullYear())).replace(/\s+/g, '_')}.pdf`);
  } catch (err) {
    console.error('PDF Export Error:', err);
    alert('حدث خطأ أثناء تصدير PDF');
  }
}
