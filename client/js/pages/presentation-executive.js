import { api } from '../api.js';
import { formatNumber } from '../utils/format.js';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { createTreeTable, getInvoiceBucket } from '../components/tree-table.js';

// Page-level state
let currentExecutiveData = null;
let currentTimeFilter = null;
let currentSelectedCos = [];
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
    return `<span class="exec-num-neg" style="color:var(--exec-danger);direction:ltr;display:inline-block;">(${Math.abs(rounded).toLocaleString('en-US')})</span>`;
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
  if (rounded === 0) return '0%';
  if (rounded < 0) {
    return `<span class="exec-rate-neg" style="color:var(--exec-danger);direction:ltr;display:inline-block;font-family:var(--font-en);font-weight:700;">(${Math.abs(rounded)}%)</span>`;
  }
  return `<span class="exec-num">${rounded}%</span>`;
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
  try {
    // 1. Try server endpoint
    const res = await api.getPreferences('executive_view');
    if (res && res.found && res.data) {
      userPreferences = { ...defaultPreferences, ...res.data };
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
    }
  } catch (e) { console.warn(e); }
}

async function saveUserPreferences(prefs) {
  userPreferences = { ...userPreferences, ...prefs };
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
export async function renderExecutiveDashboardTab(body, container, timeFilter, selectedCos) {
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
  if (urlParams.has('theme')) {
    isLightMode = urlParams.get('theme') === 'light';
  } else if (userPreferences.theme) {
    isLightMode = userPreferences.theme === 'light';
  }

  // Synchronize whole page theme (P3)
  syncWholePageTheme(isLightMode);

  body.innerHTML = `
    <div id="exec-root" class="${isLightMode ? 'exec-light' : 'exec-dark'}" style="direction:rtl;display:flex;flex-direction:column;gap:20px;font-family:var(--font-ar);transition:background 0.2s,color 0.2s;">
      
      <!-- Top Control Bar -->
      <div class="exec-topbar" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;padding:14px 20px;border-radius:14px;border:1px solid var(--exec-border);background:var(--exec-bg-card);">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:0.95rem;font-weight:700;color:var(--exec-text-muted);">📅 الفترة الفعّالة:</span>
          <span id="exec-effective-badge" style="font-size:1.05rem;font-weight:800;color:var(--exec-accent);background:rgba(59,130,246,0.12);padding:5px 16px;border-radius:8px;border:1px solid rgba(59,130,246,0.25);">${timeFilter.periodLabel}</span>
        </div>

        <div style="display:flex;align-items:center;gap:12px;">
          <!-- Customization button (P4) -->
          <button id="exec-btn-customize" class="exec-btn" style="display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;font-size:0.88rem;font-weight:700;cursor:pointer;background:var(--exec-bg-btn);color:var(--exec-text);border:1px solid var(--exec-border);">
            ⚙ طريقة العرض
          </button>

          <!-- Theme toggle button (P3) -->
          <button id="exec-btn-theme" class="exec-btn" style="display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;font-size:0.88rem;font-weight:700;cursor:pointer;background:var(--exec-bg-btn);color:var(--exec-text);border:1px solid var(--exec-border);">
            ${isLightMode ? '🌙 وضع داكن' : '☀️ وضع فاتح'}
          </button>

          <!-- Export dropdown -->
          <div style="position:relative;display:inline-block;">
            <button id="exec-btn-export" class="exec-btn" style="display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;font-size:0.88rem;font-weight:700;cursor:pointer;background:#2563eb;color:#fff;border:none;box-shadow:0 2px 8px rgba(37,99,235,0.3);">
              📥 تصدير التقرير ▾
            </button>
            <div id="exec-export-menu" style="display:none;position:absolute;left:0;top:100%;margin-top:6px;min-width:160px;background:var(--exec-bg-card);border:1px solid var(--exec-border);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.3);z-index:99;overflow:hidden;">
              <button id="exec-exp-excel" style="width:100%;text-align:right;padding:10px 14px;background:none;border:none;color:var(--exec-text);cursor:pointer;font-size:0.88rem;font-weight:600;display:flex;align-items:center;gap:8px;">📊 تصدير Excel (CSV)</button>
              <button id="exec-exp-pdf" style="width:100%;text-align:right;padding:10px 14px;background:none;border:none;color:var(--exec-text);cursor:pointer;font-size:0.88rem;font-weight:600;display:flex;align-items:center;gap:8px;border-top:1px solid var(--exec-border);">📄 تصدير PDF أفقي</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Customization Popover Modal (P4) -->
      <div id="exec-customizer-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,0.5);backdrop-filter:blur(4px);z-index:9990;align-items:center;justify-content:center;">
        <div style="background:var(--exec-bg-card);border:1px solid var(--exec-border);border-radius:16px;width:580px;max-width:92vw;max-height:85vh;overflow-y:auto;padding:24px;box-shadow:0 16px 40px rgba(0,0,0,0.4);display:flex;flex-direction:column;gap:18px;">
          <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--exec-border);padding-bottom:12px;">
            <h3 style="margin:0;font-size:1.15rem;font-weight:800;color:var(--exec-text);">⚙ تخصيص طريقة العرض والتفضيلات</h3>
            <button id="exec-close-customizer" style="background:none;border:none;color:var(--exec-text-muted);font-size:1.4rem;cursor:pointer;padding:4px;">✕</button>
          </div>

          <!-- Columns Toggle -->
          <div>
            <span style="font-size:0.92rem;font-weight:700;color:var(--exec-text);display:block;margin-bottom:8px;">📊 الأعمدة الظاهرة:</span>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.85rem;color:var(--exec-text-2);">
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" class="col-pref" data-col="revenue"> الإيرادات</label>
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" class="col-pref" data-col="expenses"> المصروفات</label>
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" class="col-pref" data-col="net_profit"> صافي الربح</label>
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" class="col-pref" data-col="margin"> الهامش %</label>
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" class="col-pref" data-col="collected"> المحصّل</label>
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" class="col-pref" data-col="collection_rate"> تحصيل الإيراد (%)</label>
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" class="col-pref" data-col="residual"> المتبقي من فواتير الفترة</label>
            </div>
          </div>

          <!-- Sections Toggle -->
          <div style="border-top:1px solid var(--exec-border);padding-top:12px;">
            <span style="font-size:0.92rem;font-weight:700;color:var(--exec-text);display:block;margin-bottom:8px;">📑 الأقسام الظاهرة:</span>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.85rem;color:var(--exec-text-2);">
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" class="sec-pref" data-sec="cards"> بطاقات المؤشرات</label>
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" class="sec-pref" data-sec="chart"> حركة التدفق الشهري (الرسم)</label>
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" class="sec-pref" data-sec="tree"> جدول الأداء والتحصيل الهرمي</label>
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;"><input type="checkbox" class="sec-pref" data-sec="aging"> أعمار ذمم فواتير الفترة</label>
            </div>
          </div>

          <!-- Open Level & Sorting -->
          <div style="border-top:1px solid var(--exec-border);padding-top:12px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div>
              <span style="font-size:0.88rem;font-weight:700;color:var(--exec-text);display:block;margin-bottom:6px;">مستوى الفتح الافتراضي:</span>
              <select id="pref-open-level" style="width:100%;padding:8px 10px;border-radius:8px;background:var(--exec-bg-btn);border:1px solid var(--exec-border);color:var(--exec-text);font-family:var(--font-ar);">
                <option value="companies">شركات فقط (الهرم مطوي)</option>
                <option value="departments">شركات وأقسام (مفتوحة الأقسام)</option>
              </select>
            </div>
            <div>
              <span style="font-size:0.88rem;font-weight:700;color:var(--exec-text);display:block;margin-bottom:6px;">ترتيب الشركات:</span>
              <select id="pref-sort-by" style="width:100%;padding:8px 10px;border-radius:8px;background:var(--exec-bg-btn);border:1px solid var(--exec-border);color:var(--exec-text);font-family:var(--font-ar);">
                <option value="default">الافتراضي (حسب أودو)</option>
                <option value="revenue">الأعلى إيراداً</option>
                <option value="net_profit">الأعلى صافي ربح</option>
                <option value="residual">الأعلى متبقياً</option>
              </select>
            </div>
          </div>

          <!-- Action Buttons -->
          <div style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--exec-border);padding-top:16px;margin-top:4px;">
            <button id="pref-btn-reset" style="padding:8px 14px;border-radius:8px;background:none;border:1px solid var(--exec-border);color:var(--exec-text-muted);cursor:pointer;font-weight:700;">إعادة الضبط</button>
            <div style="display:flex;gap:10px;">
              <button id="pref-btn-apply" style="padding:8px 16px;border-radius:8px;background:var(--exec-bg-btn);border:1px solid var(--exec-border);color:var(--exec-text);cursor:pointer;font-weight:700;">تطبيق</button>
              <button id="pref-btn-save" style="padding:8px 18px;border-radius:8px;background:#2563eb;color:#fff;border:none;cursor:pointer;font-weight:800;box-shadow:0 2px 8px rgba(37,99,235,0.3);">💾 حفظ كافتراضي لي</button>
            </div>
          </div>
        </div>
      </div>

      <!-- Skeleton Loading Placeholder (P1) -->
      <div id="exec-content-loading" style="display:block;">
        ${renderSkeletonLoader()}
      </div>

      <!-- Main Content Container -->
      <div id="exec-content" style="display:none;flex-direction:column;gap:24px;"></div>

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
    root.querySelector('#exec-btn-theme').innerHTML = isLightMode ? '🌙 وضع داكن' : '☀️ وضع فاتح';
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
      <div style="padding:40px;text-align:center;background:var(--exec-bg-card);border:1px solid var(--exec-border);border-radius:14px;">
        <span style="color:var(--exec-danger);font-weight:700;font-size:1.1rem;display:block;margin-bottom:12px;">⚠️ حدث خطأ أثناء تحميل البيانات: ${escapeHtml(err.message)}</span>
        <button id="exec-btn-retry" style="padding:8px 20px;border-radius:8px;background:#2563eb;color:#fff;border:none;cursor:pointer;font-weight:700;">🔄 إعادة المحاولة</button>
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
      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(210px, 1fr));gap:16px;">
        
        <!-- 1. Revenue -->
        <div style="background:var(--exec-bg-card);border:1px solid var(--exec-border);border-radius:14px;padding:20px 22px;border-right:4px solid #3b82f6;display:flex;flex-direction:column;gap:8px;">
          <span style="font-size:0.92rem;font-weight:700;color:var(--exec-text-muted);">الإيرادات</span>
          <div style="font-size:1.85rem;font-weight:900;color:#3b82f6;" class="exec-num">${(cards.revenue || 0).toLocaleString('en-US')}</div>
          <span style="font-size:0.8rem;color:var(--exec-text-muted);">إيرادات النشاط من الأستاذ (بدون ضريبة)</span>
        </div>

        <!-- 2. Expenses -->
        <div style="background:var(--exec-bg-card);border:1px solid var(--exec-border);border-radius:14px;padding:20px 22px;border-right:4px solid #f59e0b;display:flex;flex-direction:column;gap:8px;">
          <span style="font-size:0.92rem;font-weight:700;color:var(--exec-text-muted);">المصروفات</span>
          <div style="font-size:1.85rem;font-weight:900;color:#f59e0b;" class="exec-num">${(cards.expenses || 0).toLocaleString('en-US')}</div>
          <span style="font-size:0.8rem;color:var(--exec-text-muted);">إجمالي المصروفات من الأستاذ</span>
        </div>

        <!-- 3. Net Profit -->
        <div style="background:var(--exec-bg-card);border:1px solid var(--exec-border);border-radius:14px;padding:20px 22px;border-right:4px solid #10b981;display:flex;flex-direction:column;gap:8px;">
          <span style="font-size:0.92rem;font-weight:700;color:var(--exec-text-muted);">صافي الربح</span>
          <div style="font-size:1.85rem;font-weight:900;color:#10b981;" class="exec-num">${(cards.net_profit || 0).toLocaleString('en-US')}</div>
          <span style="font-size:0.82rem;font-weight:700;color:var(--exec-text-muted);">الهامش: <span class="exec-num" style="color:#10b981;">${fmtRate(cards.profit_margin, true, cards.revenue)}</span></span>
        </div>

        <!-- 4. Collected Period Untaxed -->
        <div style="background:var(--exec-bg-card);border:1px solid var(--exec-border);border-radius:14px;padding:20px 22px;border-right:4px solid #06b6d4;display:flex;flex-direction:column;gap:8px;">
          <span style="font-size:0.92rem;font-weight:700;color:var(--exec-text-muted);">المحصّل من إيراد الفترة</span>
          <div style="font-size:1.85rem;font-weight:900;color:#06b6d4;" class="exec-num">${(cards.collected_period_untaxed || 0).toLocaleString('en-US')}</div>
          <span style="font-size:0.82rem;color:var(--exec-text-muted);"><strong class="exec-num" style="color:#06b6d4;">${cards.collection_rate_untaxed || 0}%</strong> من المفوتر (${(cards.billed_period_untaxed || 0).toLocaleString('en-US')} بدون ضريبة)</span>
          ${showCollectedNotice ? `
            <span style="font-size:0.75rem;color:var(--exec-text-muted);line-height:1.4;margin-top:2px;">* يشمل تحصيلات عن فواتير سنوات سابقة لا يقابلها إيراد في الأستاذ</span>
          ` : ''}
        </div>

        <!-- 5. Period Residual -->
        <div style="background:var(--exec-bg-card);border:1px solid var(--exec-border);border-radius:14px;padding:20px 22px;border-right:4px solid #ef4444;display:flex;flex-direction:column;gap:8px;">
          <span style="font-size:0.92rem;font-weight:700;color:var(--exec-text-muted);">المتبقي من فواتير الفترة</span>
          <div style="font-size:1.85rem;font-weight:900;color:var(--exec-danger);" class="exec-num">${(cards.residual_period || 0).toLocaleString('en-US')}</div>
          <span style="font-size:0.82rem;color:var(--exec-text-muted);">المتأخر +90 يوماً: <span class="exec-num" style="color:var(--exec-danger);font-weight:700;">${(cards.overdue_90 || 0).toLocaleString('en-US')}</span></span>
        </div>

      </div>
    ` : ''}

    <!-- (2) Monthly Trend Chart -->
    ${showChart ? `
      <div style="background:var(--exec-bg-card);border:1px solid var(--exec-border);border-radius:16px;padding:24px;display:flex;flex-direction:column;gap:18px;">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
          <h3 style="margin:0;font-size:1.15rem;font-weight:800;color:var(--exec-text);">
            📈 حركة الإيرادات والمصروفات والتحصيل النقدي الشهري — ${currentTimeFilter?.periodLabel || ''}
          </h3>
          
          <!-- Legend with AA contrast (P3, X5) -->
          <div style="display:flex;align-items:center;gap:18px;font-size:0.88rem;font-weight:700;color:var(--exec-text-2);">
            <div style="display:flex;align-items:center;gap:6px;"><span style="display:inline-block;width:14px;height:14px;background:#3b82f6;border-radius:3px;"></span> الإيرادات</div>
            <div style="display:flex;align-items:center;gap:6px;"><span style="display:inline-block;width:14px;height:14px;background:#f59e0b;border-radius:3px;"></span> المصروفات</div>
            <div style="display:flex;align-items:center;gap:6px;"><span style="display:inline-block;width:16px;height:3px;background:#10b981;border-radius:2px;"></span> التحصيل النقدي في الشهر (شامل الضريبة)</div>
          </div>
        </div>

        <!-- Chart Container -->
        <div id="exec-chart-container" style="position:relative;height:320px;width:100%;">
          ${renderExecutiveChart(monthly)}
        </div>
      </div>
    ` : ''}

    <!-- (3) Unified Hierarchical Table (X3: No inner height constraint) -->
    ${showTree ? `
      <div style="background:var(--exec-bg-card);border:1px solid var(--exec-border);border-radius:16px;padding:24px;display:flex;flex-direction:column;gap:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
          <div>
            <h3 style="margin:0;font-size:1.15rem;font-weight:800;color:var(--exec-text);">
              🏢 الأداء والتحصيل الهرمي — ${currentTimeFilter?.periodLabel || ''}
            </h3>
            <span style="font-size:0.85rem;color:var(--exec-text-muted);">الشركة ← القسم ← (العملاء لأعمدة التحصيل والمتبقي / الحسابات لأعمدة الإيراد والمصروف) | الإجمالي في الأسفل</span>
          </div>
          <div style="font-size:0.85rem;color:var(--exec-text-muted);">
            * النقر على أي عميل يفتح لوحة فواتيره التفصيلية
          </div>
        </div>

        <div id="exec-tree-table-container" style="overflow-x:auto;border:1px solid var(--exec-border);border-radius:12px;"></div>
      </div>
    ` : ''}

    <!-- (4) Folded Aging Section (P1 Lazy & Small Fix: Integer round) -->
    ${showAging ? `
      <div style="background:var(--exec-bg-card);border:1px solid var(--exec-border);border-radius:16px;padding:20px 24px;display:flex;flex-direction:column;gap:16px;">
        <div id="exec-aging-toggle" style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;user-select:none;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.15rem;font-weight:800;color:var(--exec-text);">⏳ أعمار ذمم فواتير الفترة (الشرائح السبع)</span>
            <span style="font-size:0.88rem;color:var(--exec-accent);background:rgba(59,130,246,0.12);padding:2px 10px;border-radius:6px;font-weight:700;">${isAgingOpen ? 'إخفاء ▲' : 'عرض التفاصيل ▾'}</span>
          </div>
          <span style="font-size:0.92rem;color:var(--exec-text-muted);font-weight:700;">
            إجمالي المتبقي: <strong class="exec-num" style="color:var(--exec-danger);">${Math.round(aging.totals?.total_residual || cards.residual_period || 0).toLocaleString('en-US')} ريال</strong>
          </span>
        </div>

        <div id="exec-aging-container" style="display:${isAgingOpen ? 'block' : 'none'};overflow-x:auto;border:1px solid var(--exec-border);border-radius:12px;margin-top:6px;"></div>
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

  bindExecutiveTableEvents(container);
}

/**
 * Render pure SVG interactive chart for monthly trend (RTL oriented, X5 & X6)
 */
function renderExecutiveChart(rawSeries) {
  if (!rawSeries || !rawSeries.length) {
    return `<div style="text-align:center;padding:80px;color:var(--exec-text-muted);">لا توجد حركات شهرية في هذه الفترة</div>`;
  }

  // Filter series according to X6 & YR1:
  // 1. In multi-year mode: omit empty years (where revenue, expenses, and collected are all 0)
  // 2. In single current year: omit future months (months after current month)
  const isMultiYear = currentTimeFilter?.selectedYear === 'ALL' || (currentTimeFilter?.selectedYears && currentTimeFilter.selectedYears.length > 1);
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  let series = rawSeries.filter(s => {
    if (isMultiYear) {
      return (s.revenue || 0) > 0 || (s.expenses || 0) > 0 || (s.collected_cash || 0) > 0;
    }
    // If current year, check if label represents future month
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

  const w = 1100;
  const h = 300;
  const padTop = 30;
  const padBottom = 40;
  const padRight = 115;
  const padLeft = 40;
  const chartW = w - padRight - padLeft;
  const chartH = h - padTop - padBottom;

  const maxVal = Math.max(
    ...series.map(s => Math.max(s.revenue || 0, s.expenses || 0, s.collected_cash || 0)),
    1000
  ) * 1.15;

  const count = series.length;
  const slotW = chartW / count;
  const barW = Math.min(32, Math.max(12, slotW * 0.28));

  // AA Contrast Colors for light/dark (X5)
  const textColor = isLightMode ? '#334155' : 'rgba(255, 255, 255, 0.85)';
  const gridStroke = isLightMode ? '#cbd5e1' : 'rgba(255, 255, 255, 0.1)';

  // Build grid lines (L2: explicitly ltr to prevent RTL text-anchor reverse overlap into January bar)
  const gridLines = [];
  for (let i = 0; i <= 4; i++) {
    const y = padTop + (chartH / 4) * i;
    const val = Math.round(maxVal - (maxVal / 4) * i);
    gridLines.push(`
      <line x1="${padLeft}" y1="${y}" x2="${w - padRight}" y2="${y}" stroke="${gridStroke}" stroke-dasharray="4" />
      <text x="${w - padRight + 12}" y="${y + 4}" fill="${textColor}" text-anchor="start" direction="ltr" style="direction:ltr;unicode-bidi:isolate;" font-size="11" font-weight="700" font-family="var(--font-en)">${(val).toLocaleString('en-US')}</text>
    `);
  }

  // Bars and points
  const bars = [];
  const linePoints = [];

  series.forEach((s, idx) => {
    // RTL layout: first month at right
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

    bars.push(`
      <g class="exec-chart-group" data-idx="${idx}" ${drillAttr}>
        <!-- Revenue Bar -->
        <rect x="${revX}" y="${revY}" width="${barW}" height="${revH}" fill="#3b82f6" rx="3" opacity="0.95">
          <title>${s.label}\nالإيرادات: ${(s.revenue || 0).toLocaleString('en-US')} ريال${drillHint}</title>
        </rect>
        
        <!-- Expenses Bar -->
        <rect x="${expX}" y="${expY}" width="${barW}" height="${expH}" fill="#f59e0b" rx="3" opacity="0.95">
          <title>${s.label}\nالمصروفات: ${(s.expenses || 0).toLocaleString('en-US')} ريال${drillHint}</title>
        </rect>

        <!-- X Label (X5: AA Contrast) -->
        <text x="${cx}" y="${h - 12}" fill="${textColor}" font-size="12" font-weight="700" text-anchor="middle">${escapeHtml(s.label)}</text>
      </g>
    `);
  });

  const pathD = linePoints.length ? `M ${linePoints.join(' L ')}` : '';

  return `
    <svg viewBox="0 0 ${w} ${h}" style="width:100%;height:100%;overflow:visible;">
      ${gridLines.join('')}
      ${bars.join('')}
      <path d="${pathD}" fill="none" stroke="#10b981" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
      ${linePoints.map((pt, i) => `
        <circle cx="${pt.split(',')[0]}" cy="${pt.split(',')[1]}" r="4.5" fill="#10b981" stroke="var(--exec-bg-card)" stroke-width="2">
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
  { id: 'name', label: 'البيان', minWidth: '260px', align: 'right' },
  { id: 'not_due', label: 'غير مستحق', align: 'left' },
  { id: 'b1_30', label: '1-30 يوم', align: 'left' },
  { id: 'b31_60', label: '31-60 يوم', align: 'left' },
  { id: 'b61_90', label: '61-90 يوم', align: 'left' },
  { id: 'b91_180', label: '91-180 يوم', align: 'left' },
  { id: 'b181_365', label: '181-365 يوم', align: 'left' },
  { id: 'over_365', label: '+365 يوم', align: 'left' },
  { id: 'total_residual', label: 'إجمالي المتبقي', align: 'left', color: 'var(--exec-danger)' }
];

function getMainTableColumns(prefs) {
  const cols = prefs.columns || defaultPreferences.columns;
  const list = [{ id: 'name', label: 'البيان', minWidth: '280px', align: 'right' }];
  if (cols.includes('revenue')) list.push({ id: 'revenue', label: 'الإيرادات', align: 'left' });
  if (cols.includes('expenses')) list.push({ id: 'expenses', label: 'المصروفات', align: 'left' });
  if (cols.includes('net_profit')) list.push({ id: 'net_profit', label: 'صافي الربح', align: 'left' });
  if (cols.includes('margin')) list.push({ id: 'margin', label: 'الهامش', align: 'center' });
  if (cols.includes('collected')) list.push({ id: 'collected', label: 'المحصّل', align: 'left' });
  if (cols.includes('collection_rate')) list.push({ id: 'collection_rate', label: 'تحصيل الإيراد (%)', align: 'center', minWidth: '140px' });
  if (cols.includes('residual')) list.push({ id: 'residual', label: 'المتبقي من فواتير الفترة', align: 'left' });
  return list;
}

function renderMainTableRow({ node, pathKey, depth, isExpanded, hasKids, isLeaf }) {
  const isDept = depth === 1;
  const isGroup = !!node.isGroup;
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
  const icon = node._loading ? '⏳' : hasKids ? (isExpanded ? '▼' : '▶') : '•';

  let namePrefix = '';
  if (depth === 0) namePrefix = '🏢 ';
  else if (isDept) namePrefix = '📁 ';
  else if (isGroup) namePrefix = node.name === 'العملاء' ? '👥 ' : '📑 ';
  else if (isClient) namePrefix = '👤 ';
  else if (isAccount) namePrefix = '🔹 ';

  const rowBg = depth === 0 
    ? 'background:rgba(59,130,246,0.06);font-weight:800;' 
    : (isDept ? 'background:var(--exec-bg-hover);font-weight:700;' : (isGroup ? 'color:var(--exec-text-muted);font-weight:700;' : ''));

  const cursor = hasKids ? 'cursor:pointer;' : (isClient ? 'cursor:pointer;' : '');

  return `
    <tr data-tree-row="true" data-path-key="${escapeHtml(pathKey)}" style="${cursor} ${rowBg}">
      <td style="padding-right:${indent + 14}px;">
        <span data-tree-toggle="true" style="display:inline-block;width:18px;color:var(--exec-text-muted);font-size:0.85rem;">${icon}</span>
        ${namePrefix}
        <span style="${isClient ? 'color:var(--exec-accent);text-decoration:underline;' : ''}">${escapeHtml(node.name || node.code || '')}</span>
        ${isClient && node.invoices ? `<span style="font-size:0.75rem;color:var(--exec-text-muted);margin-right:6px;">(${node.invoices.length} فواتير)</span>` : ''}
        ${node._loading ? `<span class="spin-icon" style="display:inline-block;animation:spin 0.8s linear infinite;margin-right:6px;">⏳</span>` : ''}
      </td>
      ${showRev ? `<td style="text-align:left;">${fmtVal(node.revenue)}</td>` : ''}
      ${showExp ? `<td style="text-align:left;">${fmtVal(node.expenses)}</td>` : ''}
      ${showNet ? `<td style="text-align:left;">${fmtVal(node.net_profit)}</td>` : ''}
      ${showMargin ? `<td style="text-align:center;">${fmtRate(node.margin, true, node.revenue)}</td>` : ''}
      ${showCol ? `<td style="text-align:left;">${fmtVal(node.collected)}</td>` : ''}
      ${showRate ? `
        <td style="text-align:center;">
          ${node.collection_rate !== null && node.collection_rate !== undefined ? `
            <div style="display:flex;align-items:center;justify-content:center;gap:6px;">
              <span class="exec-num" style="font-size:0.82rem;">${fmtRate(node.collection_rate)}</span>
              <div style="width:40px;height:5px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden;">
                <div style="width:${Math.min(100, node.collection_rate || 0)}%;height:100%;background:#06b6d4;"></div>
              </div>
            </div>
          ` : '—'}
        </td>
      ` : ''}
      ${showRes ? `<td style="text-align:left;color:${(node.residual || 0) > 0 ? 'var(--exec-danger)' : ''};">${fmtVal(node.residual)}</td>` : ''}
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

  return `
    <tr class="exec-sticky-footer">
      <td style="color:#3b82f6;font-size:1.05rem;">الإجمالي للمجموعة</td>
      ${showRev ? `<td style="text-align:left;color:#3b82f6;">${fmtVal(totals.revenue)}</td>` : ''}
      ${showExp ? `<td style="text-align:left;color:#f59e0b;">${fmtVal(totals.expenses)}</td>` : ''}
      ${showNet ? `<td style="text-align:left;color:#10b981;">${fmtVal(totals.net_profit)}</td>` : ''}
      ${showMargin ? `<td style="text-align:center;color:#10b981;">${fmtRate(totals.margin, true, totals.revenue)}</td>` : ''}
      ${showCol ? `<td style="text-align:left;color:#06b6d4;">${fmtVal(totals.collected)}</td>` : ''}
      ${showRate ? `
        <td style="text-align:center;">
          <div style="display:flex;align-items:center;justify-content:center;gap:6px;">
            <span class="exec-num" style="font-size:0.85rem;font-weight:700;">${fmtRate(totals.collection_rate)}</span>
            <div style="width:50px;height:6px;background:rgba(255,255,255,0.15);border-radius:3px;overflow:hidden;">
              <div style="width:${Math.min(100, totals.collection_rate || 0)}%;height:100%;background:#06b6d4;"></div>
            </div>
          </div>
        </td>
      ` : ''}
      ${showRes ? `<td style="text-align:left;color:var(--exec-danger);">${fmtVal(totals.residual)}</td>` : ''}
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
      if (node.type === 'client' || node.partner_id) return `${parentPath}/p:${node.partner_id || node.id}`;
      if (node.type === 'account' || node.code) return `${parentPath}/acc:${node.code || node.id}`;
      return `${parentPath}/n:${node.id || node.name}`;
    },
    getChildren: (node) => node.children,
    hasChildren: (node) => {
      if (node.isGroup) return !!(node.children && node.children.length > 0);
      if (node.type === 'client' || node.partner_id || node.type === 'account' || node.code) return false;
      if (node.children && node.children.length > 0) return true;
      if (node.has_children !== undefined) return !!node.has_children;
      if (node.department_id != null) return true;
      return false;
    },
    loadChildren: async (node, pathKey) => {
      const coMatch = pathKey.match(/co:(\d+)/);
      const deptMatch = pathKey.match(/dept:(\d+)/);
      const companyId = node.company_id != null ? Number(node.company_id) : (coMatch ? Number(coMatch[1]) : undefined);
      const deptId = node.department_id != null ? Number(node.department_id) : (deptMatch ? Number(deptMatch[1]) : (typeof node.id === 'number' ? node.id : Number(String(node.id).replace(/^dept_\d+_/, '').replace(/^dept_?/, ''))));

      const periodParams = getPeriodParamsFromFilter(currentTimeFilter);
      const childData = await api.getExecutiveChildren({
        companyId,
        departmentId: deptId,
        ...periodParams
      });

      const children = [];
      if (childData.clients && childData.clients.length > 0) {
        children.push({
          id: 'clients',
          name: 'العملاء',
          type: 'grp',
          isGroup: true,
          isClients: true,
          company_id: companyId,
          department_id: deptId,
          children: childData.clients.map(c => ({
            ...c,
            type: 'client',
            company_id: companyId,
            department_id: deptId
          }))
        });
      }
      if (childData.accounts && childData.accounts.length > 0) {
        children.push({
          id: 'accounts',
          name: 'الحسابات',
          type: 'grp',
          isGroup: true,
          isAccounts: true,
          company_id: companyId,
          department_id: deptId,
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
}

function renderAgingTableRow({ node, pathKey, depth, isExpanded, hasKids, isLeaf }) {
  const indent = depth * 20;
  const icon = node._loading ? '⏳' : hasKids ? (isExpanded ? '▼' : '▶') : '•';
  const cursor = hasKids ? 'cursor:pointer;' : '';
  const isInvoice = !!node.isInvoice;
  const bk = node.buckets || {};

  let rowBg = '';
  if (depth === 0) rowBg = 'background:rgba(59,130,246,0.06);font-weight:800;';
  else if (depth === 1) rowBg = 'background:var(--exec-bg-hover);font-weight:700;';
  else if (depth === 2) rowBg = 'font-weight:600;';
  else if (isInvoice) rowBg = 'font-size:0.88rem;background:rgba(0,0,0,0.02);';

  if (isInvoice) {
    const isOver90 = (node.age_days || 0) > 90;
    const bKey = node.bucket || getInvoiceBucket(node.age_days);

    return `
      <tr data-tree-row="true" data-path-key="${escapeHtml(pathKey)}" style="${cursor} ${rowBg}">
        <td style="padding-right:${indent + 14}px;">
          <div style="display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span style="color:var(--exec-text-muted);font-size:0.8rem;">•</span>
            <strong style="font-family:var(--font-en);font-size:0.88rem;color:var(--exec-text);">${escapeHtml(node.name || 'فاتورة')}</strong>
            <span style="font-size:0.72rem;padding:1px 6px;border-radius:4px;background:${isOver90 ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.12)'};color:${isOver90 ? 'var(--exec-danger)' : '#10b981'};font-weight:700;">
              ${isOver90 ? 'متأخرة (+90 يوم)' : 'سارية'}
            </span>
            <span style="font-size:0.75rem;color:var(--exec-text-muted);">
              تاريخ: <span class="exec-num">${node.invoice_date || '—'}</span> | استحقاق: <span class="exec-num">${node.due_date || '—'}</span> (${node.age_days || 0} يوم)
            </span>
          </div>
        </td>
        <td style="text-align:left;">${bKey === 'not_due' ? fmtVal(node.total_residual) : '—'}</td>
        <td style="text-align:left;">${bKey === 'b1_30' ? fmtVal(node.total_residual) : '—'}</td>
        <td style="text-align:left;">${bKey === 'b31_60' ? fmtVal(node.total_residual) : '—'}</td>
        <td style="text-align:left;">${bKey === 'b61_90' ? fmtVal(node.total_residual) : '—'}</td>
        <td style="text-align:left;color:${isOver90 ? 'var(--exec-danger)' : ''};">${bKey === 'b91_180' ? fmtVal(node.total_residual) : '—'}</td>
        <td style="text-align:left;color:${isOver90 ? 'var(--exec-danger)' : ''};">${bKey === 'b181_365' ? fmtVal(node.total_residual) : '—'}</td>
        <td style="text-align:left;color:${isOver90 ? 'var(--exec-danger)' : ''};">${bKey === 'over_365' ? fmtVal(node.total_residual) : '—'}</td>
        <td style="text-align:left;font-weight:800;color:var(--exec-danger);">${fmtVal(node.total_residual)}</td>
      </tr>
    `;
  }

  return `
    <tr data-tree-row="true" data-path-key="${escapeHtml(pathKey)}" style="${cursor} ${rowBg}">
      <td style="padding-right:${indent + 14}px;">
        <span data-tree-toggle="true" style="display:inline-block;width:18px;color:var(--exec-text-muted);">${icon}</span>
        ${escapeHtml(node.name || node.partner_name || node.company_name || '')}
        ${node._loading ? `<span class="spin-icon" style="display:inline-block;animation:spin 0.8s linear infinite;margin-right:6px;">⏳</span>` : ''}
      </td>
      <td style="text-align:left;">${fmtVal(bk.not_due)}</td>
      <td style="text-align:left;">${fmtVal(bk.b1_30)}</td>
      <td style="text-align:left;">${fmtVal(bk.b31_60)}</td>
      <td style="text-align:left;">${fmtVal(bk.b61_90)}</td>
      <td style="text-align:left;color:${bk.b91_180 > 0 ? 'var(--exec-danger)' : ''};">${fmtVal(bk.b91_180)}</td>
      <td style="text-align:left;color:${bk.b181_365 > 0 ? 'var(--exec-danger)' : ''};">${fmtVal(bk.b181_365)}</td>
      <td style="text-align:left;color:${bk.over_365 > 0 ? 'var(--exec-danger)' : ''};">${fmtVal(bk.over_365)}</td>
      <td style="text-align:left;font-weight:800;color:var(--exec-danger);">${fmtVal(node.total_residual)}</td>
    </tr>
  `;
}

function renderAgingTableTotals(totals) {
  const b = totals.buckets || {};
  return `
    <tr class="exec-sticky-footer">
      <td style="color:#3b82f6;font-weight:800;">الإجمالي للمجموعة</td>
      <td style="text-align:left;">${fmtVal(b.not_due)}</td>
      <td style="text-align:left;">${fmtVal(b.b1_30)}</td>
      <td style="text-align:left;">${fmtVal(b.b31_60)}</td>
      <td style="text-align:left;">${fmtVal(b.b61_90)}</td>
      <td style="text-align:left;color:var(--exec-danger);">${fmtVal(b.b91_180)}</td>
      <td style="text-align:left;color:var(--exec-danger);">${fmtVal(b.b181_365)}</td>
      <td style="text-align:left;color:var(--exec-danger);">${fmtVal(b.over_365)}</td>
      <td style="text-align:left;color:var(--exec-danger);font-weight:900;">${fmtVal(totals.total_residual)}</td>
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
    <div style="padding:40px;text-align:center;color:var(--exec-text-muted);">
      <span class="spin-icon" style="display:inline-block;animation:spin 0.8s linear infinite;font-size:1.4rem;">⏳</span><br>
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
    agBox.innerHTML = `<div style="padding:20px;text-align:center;color:var(--exec-danger);">حدث خطأ أثناء تحميل أعمار الذمم</div>`;
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
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;border-bottom:1px solid var(--exec-border);padding-bottom:14px;">
      <div>
        <h3 style="margin:0;font-size:1.2rem;font-weight:800;color:var(--exec-text);">${escapeHtml(client.name || 'العميل')}</h3>
        <span style="font-size:0.85rem;color:var(--exec-text-muted);">جاري جلب تفاصيل الفواتير...</span>
      </div>
      <button id="exec-drawer-close" style="background:none;border:none;color:var(--exec-text-muted);font-size:1.4rem;cursor:pointer;padding:4px;">✕</button>
    </div>
    <div style="padding:40px;text-align:center;color:var(--exec-text-muted);">
      <span class="spin-icon" style="display:inline-block;animation:spin 0.8s linear infinite;font-size:1.5rem;">⏳</span>
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
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;border-bottom:1px solid var(--exec-border);padding-bottom:14px;">
      <div>
        <h3 style="margin:0;font-size:1.2rem;font-weight:800;color:var(--exec-text);">${escapeHtml(client.name || 'العميل')}</h3>
        <span style="font-size:0.85rem;color:var(--exec-text-muted);">قائمة فواتير الفترة المحددة (${invs.length} فواتير)</span>
      </div>
      <button id="exec-drawer-close" style="background:none;border:none;color:var(--exec-text-muted);font-size:1.4rem;cursor:pointer;padding:4px;">✕</button>
    </div>

    <!-- Client Totals -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:20px;">
      <div style="background:var(--exec-bg-card);border:1px solid var(--exec-border);border-radius:10px;padding:12px;text-align:center;">
        <span style="font-size:0.75rem;color:var(--exec-text-muted);">المفوتر (بدون ضريبة)</span>
        <div class="exec-num" style="font-size:1.1rem;color:#3b82f6;font-weight:800;">${(client.billed || 0).toLocaleString('en-US')}</div>
      </div>
      <div style="background:var(--exec-bg-card);border:1px solid var(--exec-border);border-radius:10px;padding:12px;text-align:center;">
        <span style="font-size:0.75rem;color:var(--exec-text-muted);">المحصّل (بدون ضريبة)</span>
        <div class="exec-num" style="font-size:1.1rem;color:#10b981;font-weight:800;">${(client.collected || 0).toLocaleString('en-US')}</div>
      </div>
      <div style="background:var(--exec-bg-card);border:1px solid var(--exec-border);border-radius:10px;padding:12px;text-align:center;">
        <span style="font-size:0.75rem;color:var(--exec-text-muted);">المتبقي</span>
        <div class="exec-num" style="font-size:1.1rem;color:var(--exec-danger);font-weight:800;">${(client.residual || 0).toLocaleString('en-US')}</div>
      </div>
    </div>

    <!-- Invoices List -->
    <div style="display:flex;flex-direction:column;gap:12px;">
      ${invs.length === 0 ? `<div style="text-align:center;padding:40px;color:var(--exec-text-muted);">لا توجد فواتير مطابقة</div>` : ''}
      ${invs.map(inv => {
        const isOver90 = (inv.age_days || 0) > 90 && (inv.amount_residual || inv.amount_residual_signed || 0) > 0;
        const resVal = Math.round(inv.amount_residual !== undefined ? inv.amount_residual : (inv.amount_residual_signed || 0));
        return `
          <div style="background:var(--exec-bg-card);border:1px solid var(--exec-border);border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;justify-content:space-between;align-items:center;">
              <strong style="color:var(--exec-text);font-family:var(--font-en);font-size:0.95rem;">${escapeHtml(inv.invoice_name || inv.name || 'فاتورة')}</strong>
              <span style="font-size:0.78rem;padding:3px 8px;border-radius:6px;background:${isOver90 ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.12)'};color:${isOver90 ? 'var(--exec-danger)' : '#10b981'};font-weight:700;">
                ${isOver90 ? 'متأخرة (+90 يوم)' : 'سارية'}
              </span>
            </div>
            
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:0.85rem;color:var(--exec-text-muted);">
              <div>تاريخ الفاتورة: <strong class="exec-num" style="color:var(--exec-text);">${inv.invoice_date || inv.date || '—'}</strong></div>
              <div>الاستحقاق: <strong class="exec-num" style="color:var(--exec-text);">${inv.due_date || '—'}</strong></div>
              <div>العمر: <strong class="exec-num" style="color:${isOver90 ? 'var(--exec-danger)' : 'var(--exec-text)'};">${inv.age_days || 0} يوم</strong></div>
              <div>المفوتر (بدون ضريبة): <strong class="exec-num" style="color:var(--exec-text);">${Math.round(inv.amount_untaxed || 0).toLocaleString('en-US')}</strong></div>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--exec-border);padding-top:8px;margin-top:4px;font-size:0.88rem;">
              <span>المتبقي: <strong class="exec-num" style="color:var(--exec-danger);font-size:1rem;">${resVal.toLocaleString('en-US')} ريال</strong></span>
              <span style="font-size:0.8rem;color:var(--exec-text-muted);">الإجمالي: ${(Math.round(inv.amount_total || 0)).toLocaleString('en-US')}</span>
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
  const period = currentTimeFilter?.periodLabel || String(new Date().getFullYear());
  const csvRows = [];
  csvRows.push(['التقرير', 'لوحة الإدارة الموحدة - الأداء والتحصيل']);
  csvRows.push(['الفترة الفعالة', period]);
  csvRows.push([]);
  csvRows.push(['البيان', 'الإيرادات', 'المصروفات', 'صافي الربح', 'الهامش %', 'المحصّل', 'نسبة التحصيل %', 'المتبقي من فواتير الفترة']);

  function exportNode(node, prefix = '') {
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
