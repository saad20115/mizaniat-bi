import { api } from '../api.js';
import { store } from '../store.js';
import { formatNumber } from '../utils/format.js';
import { showToast } from '../utils/ui.js';

const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16'];
const YR_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6'];
const fmt = v => formatNumber(v, 0);
const fmtP = v => (v||0).toFixed(1) + '%';
const MONTH_NAMES = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
const MN_SHORT = ['01','02','03','04','05','06','07','08','09','10','11','12'];

let dashData = null;
let activeTab = 'overview';
let analyticGroups = [];
let analyticGroupMappings = {}; // { analytic_account: group_id }
let redistByCompany = {}; // { companyId: Set of redistributable CC names }
let lastUpdatedTime = null;
function fmtTimestamp(d) { if (!d) return ''; const pad = n => String(n).padStart(2,'0'); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }

export async function renderPresentation(container) {
  const companies = store.get('companies') || [];
  const fiscalYears = store.get('filterOptions')?.fiscalYears || [];
  const fy = store.get('fiscalYear') || fiscalYears[fiscalYears.length - 1] || '';

  container.innerHTML = `
    <style>
      .bi-page{min-height:100vh;padding:0;direction:rtl}
      /* Top bar with slicers */
      .bi-topbar{display:flex;align-items:center;gap:16px;padding:16px 28px;background:linear-gradient(180deg,rgba(15,23,42,0.95),rgba(15,23,42,0.85));border-bottom:1px solid rgba(255,255,255,0.06);flex-wrap:wrap;position:sticky;top:0;z-index:50;backdrop-filter:blur(12px)}
      .bi-topbar .slicer-group{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
      .bi-topbar .slicer-label{font-size:0.95rem;color:rgba(255,255,255,0.55);font-weight:700;white-space:nowrap}
      .bi-chip{padding:9px 20px;border-radius:22px;font-size:0.95rem;cursor:pointer;transition:all 0.25s ease;border:1.5px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.03);color:rgba(255,255,255,0.45);font-weight:600;user-select:none;white-space:nowrap}
      .bi-chip.active{color:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.3)}
      .bi-chip:hover{background:rgba(255,255,255,0.07);transform:translateY(-1px)}
      .bi-date{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:8px 14px;color:rgba(255,255,255,0.7);font-size:0.92rem;font-family:var(--font-en);outline:none;width:140px}
      .bi-date:focus{border-color:rgba(59,130,246,0.5)}

      /* Tabs */
      .bi-tabs{display:flex;gap:0;padding:0 28px;background:rgba(255,255,255,0.015);border-bottom:1px solid rgba(255,255,255,0.06);overflow-x:auto}
      .bi-tab{padding:16px 26px;font-size:1.02rem;font-weight:700;color:rgba(255,255,255,0.35);cursor:pointer;border-bottom:3px solid transparent;transition:all 0.2s;white-space:nowrap}
      .bi-tab:hover{color:rgba(255,255,255,0.6);background:rgba(255,255,255,0.02)}
      .bi-tab.active{color:#60a5fa;border-bottom-color:#3b82f6;background:rgba(59,130,246,0.05)}

      /* Body */
      .bi-body{display:grid;grid-template-columns:1fr;gap:20px;padding:24px 28px}

      /* KPI cards */
      .bi-kpi-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:18px}
      .bi-kpi{background:linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02));border:1px solid rgba(255,255,255,0.07);border-radius:18px;padding:26px 20px;text-align:center;transition:transform 0.2s,box-shadow 0.2s}
      .bi-kpi:hover{transform:translateY(-3px);box-shadow:0 12px 32px rgba(0,0,0,0.25)}
      .bi-kpi-label{font-size:1rem;color:rgba(255,255,255,0.55);margin-bottom:12px;font-weight:700}
      .bi-kpi-value{font-size:2.2rem;font-weight:800;font-family:var(--font-en);letter-spacing:-0.5px}
      .bi-kpi-sub{font-size:0.92rem;color:rgba(255,255,255,0.45);margin-top:6px;font-family:var(--font-en);font-weight:500}

      /* Charts grid */
      .bi-charts{display:grid;grid-template-columns:1fr 1fr;gap:18px}

      /* Cards */
      .bi-card{background:linear-gradient(135deg,rgba(255,255,255,0.035),rgba(255,255,255,0.012));border:1px solid rgba(255,255,255,0.07);border-radius:18px;padding:24px;overflow:hidden}
      .bi-card-title{font-size:1.1rem;font-weight:700;color:rgba(255,255,255,0.65);margin-bottom:20px;display:flex;align-items:center;gap:10px}
      .bi-card canvas{width:100%;display:block}

      /* Tables */
      .bi-table{width:100%;border-collapse:separate;border-spacing:0;font-size:1.05rem}
      .bi-table th{padding:16px 18px;text-align:right;color:rgba(255,255,255,0.55);font-size:0.92rem;font-weight:700;border-bottom:2px solid rgba(255,255,255,0.1);white-space:nowrap;text-transform:uppercase;letter-spacing:0.3px;border-left:1px solid rgba(255,255,255,0.08)}
      .bi-table th:last-child{border-left:none}
      .bi-table th.n{text-align:left}
      .bi-table td{padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.05);color:rgba(255,255,255,0.9);font-size:1rem;border-left:1px solid rgba(255,255,255,0.06)}
      .bi-table td:last-child{border-left:none}
      .bi-table td.n{font-family:var(--font-en);text-align:left;font-weight:700;font-size:1.05rem;letter-spacing:-0.3px}
      .bi-table tr:hover td{background:rgba(255,255,255,0.025)}
      .bi-table tfoot td{font-weight:800;border-top:2px solid rgba(255,255,255,0.15);font-size:1.08rem;padding:18px}
      /* Sortable headers */
      .bi-table th.sortable{cursor:pointer;user-select:none;transition:color 0.2s}
      .bi-table th.sortable:hover{color:rgba(255,255,255,0.85)}
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
      .bi-refresh-btn{display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:12px;font-size:0.88rem;cursor:pointer;transition:all 0.25s;border:1.5px solid rgba(16,185,129,0.35);background:rgba(16,185,129,0.08);color:#10b981;font-weight:700;white-space:nowrap;user-select:none}
      .bi-refresh-btn:hover{background:rgba(16,185,129,0.18);transform:translateY(-1px);box-shadow:0 4px 12px rgba(16,185,129,0.15)}
      .bi-refresh-btn:active{transform:scale(0.96)}
      .bi-refresh-btn.loading{pointer-events:none;opacity:0.6}
      .bi-refresh-btn .spin-icon{display:inline-block;transition:transform 0.3s}
      .bi-refresh-btn.loading .spin-icon{animation:bi-spin 0.8s linear infinite}
      @keyframes bi-spin{to{transform:rotate(360deg)}}
      .bi-last-updated{display:flex;align-items:center;gap:6px;padding:7px 14px;border-radius:12px;font-size:0.82rem;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);color:rgba(255,255,255,0.45);white-space:nowrap}
      .bi-last-updated .ts{color:rgba(255,255,255,0.65);font-family:var(--font-en);font-weight:600;direction:ltr}

      /* Collapsible advanced filter */
      .bi-adv-toggle{display:flex;align-items:center;gap:8px;padding:10px 28px;background:rgba(255,255,255,0.015);cursor:pointer;user-select:none;border-bottom:1px solid rgba(255,255,255,0.04);transition:background 0.2s}
      .bi-adv-toggle:hover{background:rgba(255,255,255,0.03)}
      .bi-adv-toggle .arrow{transition:transform 0.25s;display:inline-block;font-size:0.7rem;color:rgba(255,255,255,0.4)}
      .bi-adv-toggle.open .arrow{transform:rotate(90deg)}
      .bi-adv-panel{max-height:0;overflow:hidden;transition:max-height 0.35s ease}
      .bi-adv-panel.open{max-height:500px}
      .bi-single-chk{display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none;font-size:0.88rem;color:rgba(255,255,255,0.5);font-weight:600;white-space:nowrap}
      .bi-single-chk input{accent-color:#06b6d4;width:16px;height:16px;cursor:pointer}

      @media(max-width:900px){.bi-charts{grid-template-columns:1fr}.bi-kpi-row{grid-template-columns:repeat(3,1fr)}}
      @media(max-width:600px){.bi-kpi-row{grid-template-columns:repeat(2,1fr)}}
    </style>
    <div class="bi-page">
      <!-- Slicer Bar -->
      <div class="bi-topbar">
        <span class="slicer-label">🏢 الشركات</span>
        <div class="slicer-group" id="co-slicer">
          <div class="bi-chip active all-chip co-all" data-color="#8b5cf6" style="border-color:#8b5cf6;background:#8b5cf620;color:#8b5cf6;font-weight:800;">الكل</div>
          ${companies.map((c, i) => `<div class="bi-chip active co-chip" data-id="${c.id}" data-color="${COLORS[i%COLORS.length]}" style="border-color:${COLORS[i%COLORS.length]};background:${COLORS[i%COLORS.length]}20;color:${COLORS[i%COLORS.length]};">${c.name}</div>`).join('')}
        </div>
        <div style="width:1px;height:24px;background:rgba(255,255,255,0.08);margin:0 6px;flex-shrink:0;"></div>
        <span class="slicer-label">📅 السنوات</span>
        <div class="slicer-group" id="yr-slicer">
          <div class="bi-chip all-chip yr-all" data-color="#ec4899" style="border-color:rgba(255,255,255,0.12);background:rgba(255,255,255,0.03);color:rgba(255,255,255,0.4);font-weight:800;font-family:var(--font-en);">الكل</div>
          ${fiscalYears.map((y, i) => `<div class="bi-chip ${y===fy?'active':''} yr-chip" data-year="${y}" data-color="${YR_COLORS[i%YR_COLORS.length]}" style="${y===fy?`border-color:${YR_COLORS[i%YR_COLORS.length]};background:${YR_COLORS[i%YR_COLORS.length]}20;color:${YR_COLORS[i%YR_COLORS.length]};`:''}font-family:var(--font-en);" data-idx="${i}">${y}</div>`).join('')}
        </div>
        <div style="width:1px;height:24px;background:rgba(255,255,255,0.08);margin:0 6px;flex-shrink:0;"></div>
        <span class="slicer-label">📆 الفترة</span>
        <input type="date" id="date-from" class="bi-date" value="" placeholder="من">
        <span style="color:rgba(255,255,255,0.3);font-size:0.88rem;">→</span>
        <input type="date" id="date-to" class="bi-date" value="" placeholder="إلى">
        <div class="bi-actions">
          <div class="bi-last-updated" id="bi-last-updated">🕐 آخر تحديث: <span class="ts" id="bi-last-updated-ts">—</span></div>
          <button class="bi-refresh-btn" id="btn-refresh"><span class="spin-icon">🔄</span> تحديث</button>
          <button class="btn" id="btn-deselect" style="font-size:0.88rem;padding:7px 14px;border-radius:12px;color:#f87171;border-color:rgba(239,68,68,0.25);background:rgba(239,68,68,0.08);">✕ إلغاء التحديد</button>
          <button class="btn" id="btn-share" style="font-size:0.88rem;padding:8px 16px;background:rgba(139,92,246,0.12);color:#a78bfa;border-color:rgba(139,92,246,0.25);border-radius:12px;">🔗 مشاركة</button>
          <button class="btn" id="btn-shares-list" style="font-size:0.88rem;padding:8px 16px;border-radius:12px;">📋 الروابط</button>
        </div>
      </div>
      <!-- CC & Group Toggle -->
      <div class="bi-adv-toggle" id="adv-toggle">
        <span class="arrow">▶</span>
        <span style="font-size:0.95rem;color:rgba(255,255,255,0.55);font-weight:700;">🔍 فلترة متقدمة — مراكز التكلفة والمجموعات</span>
      </div>
      <div class="bi-adv-panel" id="adv-panel">
        <div class="bi-topbar" style="padding:10px 28px;gap:12px;border-top:none;">
          <span class="slicer-label">🏗️ مركز التكلفة</span>
          <div class="slicer-group" id="cc-slicer">
            <div class="bi-chip active all-chip cc-all" data-color="#06b6d4" style="border-color:#06b6d4;background:#06b6d420;color:#06b6d4;font-weight:800;">الكل</div>
          </div>
          <label class="bi-single-chk"><input type="checkbox" id="cc-single-mode"> اختيار فردي</label>
        </div>
        <div class="bi-topbar" style="padding:10px 28px;gap:12px;border-top:none;">
          <span class="slicer-label">📂 المجموعة</span>
          <div class="slicer-group" id="grp-slicer">
            <div class="bi-chip active all-chip grp-all" data-color="#f59e0b" style="border-color:#f59e0b;background:#f59e0b20;color:#f59e0b;font-weight:800;">الكل</div>
          </div>
        </div>
      </div>

      <!-- Tab Bar -->
      <div class="bi-tabs" id="bi-tabs">
        <div class="bi-tab active" data-tab="overview">📊 نظرة عامة</div>
        <div class="bi-tab" data-tab="collection">📥 التحصيل</div>
        <div class="bi-tab" data-tab="comparison">📋 المقارنة</div>
        <div class="bi-tab" data-tab="details">📖 التفاصيل</div>
        <div class="bi-tab" data-tab="pivot-acc">📊 تقاطعي - حسابات</div>
        <div class="bi-tab" data-tab="pivot-cc">📊 تقاطعي - مراكز</div>
        <div class="bi-tab" data-tab="redist">🔄 إعادة التوزيع</div>
        <div class="bi-tab" data-tab="guarantees">🏦 الضمانات البنكية</div>
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

  // Chip toggle
  function setChipActive(chip, active) {
    const color = chip.dataset.color;
    if (active) {
      chip.classList.add('active'); chip.style.borderColor = color; chip.style.background = color + '20'; chip.style.color = color;
    } else {
      chip.classList.remove('active'); chip.style.borderColor = 'rgba(255,255,255,0.12)'; chip.style.background = 'rgba(255,255,255,0.03)'; chip.style.color = 'rgba(255,255,255,0.4)';
    }
  }
  function toggleChip(chip) { setChipActive(chip, !chip.classList.contains('active')); syncAllChips(); loadDashboard(container); }

  function syncAllChips() {
    const allCo = container.querySelectorAll('.co-chip');
    const allYr = container.querySelectorAll('.yr-chip');
    const allCc = container.querySelectorAll('.cc-chip');
    const allGrp = container.querySelectorAll('.grp-chip');
    const coAll = container.querySelector('.co-all');
    const yrAll = container.querySelector('.yr-all');
    const ccAll = container.querySelector('.cc-all');
    const grpAll = container.querySelector('.grp-all');
    if (coAll) setChipActive(coAll, [...allCo].every(c => c.classList.contains('active')));
    if (yrAll) setChipActive(yrAll, [...allYr].every(c => c.classList.contains('active')));
    if (ccAll) setChipActive(ccAll, allCc.length === 0 || [...allCc].every(c => c.classList.contains('active')));
    if (grpAll) setChipActive(grpAll, allGrp.length === 0 || [...allGrp].every(c => c.classList.contains('active')));
  }

  container.querySelectorAll('.co-chip').forEach(c => c.addEventListener('click', () => toggleChip(c)));
  container.querySelectorAll('.yr-chip').forEach(c => c.addEventListener('click', () => toggleChip(c)));

  // Select All chips
  container.querySelector('.co-all')?.addEventListener('click', () => {
    const all = container.querySelectorAll('.co-chip');
    const allActive = [...all].every(c => c.classList.contains('active'));
    all.forEach(c => setChipActive(c, !allActive));
    setChipActive(container.querySelector('.co-all'), !allActive);
    loadDashboard(container);
  });
  container.querySelector('.yr-all')?.addEventListener('click', () => {
    const all = container.querySelectorAll('.yr-chip');
    const allActive = [...all].every(c => c.classList.contains('active'));
    all.forEach(c => setChipActive(c, !allActive));
    setChipActive(container.querySelector('.yr-all'), !allActive);
    loadDashboard(container);
  });

  // CC slicer "All" toggle
  container.querySelector('.cc-all')?.addEventListener('click', () => {
    const all = container.querySelectorAll('.cc-chip');
    const allActive = all.length === 0 || [...all].every(c => c.classList.contains('active'));
    all.forEach(c => setChipActive(c, !allActive));
    setChipActive(container.querySelector('.cc-all'), !allActive);
    if (dashData) renderDashboard(container);
  });
  // Group slicer "All" toggle
  container.querySelector('.grp-all')?.addEventListener('click', () => {
    const all = container.querySelectorAll('.grp-chip');
    const allActive = all.length === 0 || [...all].every(c => c.classList.contains('active'));
    all.forEach(c => setChipActive(c, !allActive));
    setChipActive(container.querySelector('.grp-all'), !allActive);
    if (dashData) renderDashboard(container);
  });

  // Deselect All button
  container.querySelector('#btn-deselect')?.addEventListener('click', () => {
    container.querySelectorAll('.co-chip, .yr-chip, .co-all, .yr-all, .cc-chip, .cc-all, .grp-chip, .grp-all').forEach(c => setChipActive(c, false));
    container.querySelector('#date-from').value = '';
    container.querySelector('#date-to').value = '';
    loadDashboard(container);
  });

  // Date filter
  container.querySelector('#date-from')?.addEventListener('change', () => loadDashboard(container));
  container.querySelector('#date-to')?.addEventListener('change', () => loadDashboard(container));

  // Advanced filter toggle
  container.querySelector('#adv-toggle')?.addEventListener('click', () => {
    const toggle = container.querySelector('#adv-toggle');
    const panel = container.querySelector('#adv-panel');
    toggle.classList.toggle('open');
    panel.classList.toggle('open');
  });

  syncAllChips();

  // Tab switching
  container.querySelectorAll('.bi-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.bi-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      activeTab = tab.dataset.tab;
      if (dashData) renderDashboard(container);
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

  // Load analytic groups and mappings for group slicer
  try {
    const [grps, mappings] = await Promise.all([
      api.getAnalyticGroups(),
      api.getAnalyticGroupMappings({})
    ]);
    analyticGroups = grps || [];
    // Store raw mappings for per-company filtering
    window._rawGroupMappings = mappings || [];
    // Build mapping: if same CC in multiple companies has different groups, skip it
    analyticGroupMappings = {};
    const ccGroupSets = {}; // ccName -> Set of groupIds
    (mappings || []).forEach(m => {
      if (!m.group_id) return;
      const cc = (m.analytic_account || '').trim();
      if (!cc) return;
      if (!ccGroupSets[cc]) ccGroupSets[cc] = new Set();
      ccGroupSets[cc].add(String(m.group_id));
    });
    // Only assign group if ALL mappings for that CC agree on the same group
    for (const [cc, groups] of Object.entries(ccGroupSets)) {
      if (groups.size === 1) {
        analyticGroupMappings[cc] = [...groups][0];
      } else {
        console.warn(`[Mapping] CC "${cc}" has conflicting groups:`, [...groups], '— treating as ungrouped');
      }
    }
    populateGroupSlicer(container);
    // Build redistByCompany: { companyId: Set(ccName) } for redistributable CCs
    redistByCompany = {};
    (mappings || []).forEach(m => {
      if (m.redistributable && m.analytic_account) {
        const cid = String(m.company_id);
        if (!redistByCompany[cid]) redistByCompany[cid] = new Set();
        redistByCompany[cid].add(m.analytic_account.trim());
      }
    });
  } catch (e) { console.warn('Could not load analytic groups:', e); }

  await loadDashboard(container);
}

const CC_COLORS = ['#06b6d4','#14b8a6','#0ea5e9','#22d3ee','#2dd4bf','#0891b2','#0d9488','#0284c7'];

function populateCCSlider(container, d) {
  const ccSet = new Set();
  for (const yr of d.years) {
    for (const co of (d.yearlyData[yr]?.companies || [])) {
      (co.pivotData || []).forEach(r => ccSet.add(r.cc));
      (co.costCenters || []).forEach(cc => ccSet.add(cc.name));
    }
  }
  const ccNames = [...ccSet].sort();
  const slicer = container.querySelector('#cc-slicer');
  if (!slicer) return;
  // Keep "All" chip, clear old chips
  const allChip = slicer.querySelector('.cc-all');
  slicer.innerHTML = '';
  if (allChip) slicer.appendChild(allChip);
  ccNames.forEach((cc, i) => {
    const color = CC_COLORS[i % CC_COLORS.length];
    const chip = document.createElement('div');
    chip.className = 'bi-chip active cc-chip';
    chip.dataset.cc = cc;
    chip.dataset.color = color;
    chip.style.cssText = `border-color:${color};background:${color}20;color:${color};`;
    chip.textContent = cc.length > 18 ? cc.substring(0, 18) + '…' : cc;
    chip.addEventListener('click', () => {
      const singleMode = container.querySelector('#cc-single-mode')?.checked;
      if (singleMode) {
        // Deactivate all CC chips, then activate only this one
        container.querySelectorAll('.cc-chip').forEach(c => {
          c.classList.remove('active');
          c.style.borderColor = 'rgba(255,255,255,0.12)'; c.style.background = 'rgba(255,255,255,0.03)'; c.style.color = 'rgba(255,255,255,0.4)';
        });
        chip.classList.add('active');
        chip.style.borderColor = color; chip.style.background = color + '20'; chip.style.color = color;
      } else {
        const isActive = chip.classList.contains('active');
        chip.classList.toggle('active');
        if (isActive) { chip.style.borderColor = 'rgba(255,255,255,0.12)'; chip.style.background = 'rgba(255,255,255,0.03)'; chip.style.color = 'rgba(255,255,255,0.4)'; }
        else { chip.style.borderColor = color; chip.style.background = color + '20'; chip.style.color = color; }
      }
      // Sync "All" chip
      const allCc = container.querySelectorAll('.cc-chip');
      const ccAll = container.querySelector('.cc-all');
      const allActive = [...allCc].every(c => c.classList.contains('active'));
      if (ccAll) { ccAll.classList.toggle('active', allActive); ccAll.style.borderColor = allActive ? '#06b6d4' : 'rgba(255,255,255,0.12)'; ccAll.style.background = allActive ? '#06b6d420' : 'rgba(255,255,255,0.03)'; ccAll.style.color = allActive ? '#06b6d4' : 'rgba(255,255,255,0.4)'; }
      if (dashData) renderDashboard(container);
    });
    slicer.appendChild(chip);
  });
}

function getSelectedCCs(container) {
  const chips = container.querySelectorAll('.cc-chip.active');
  const all = container.querySelectorAll('.cc-chip');
  if (chips.length === 0 || chips.length === all.length) return null; // null = all selected
  return [...chips].map(c => c.dataset.cc);
}

function populateGroupSlicer(container) {
  const slicer = container.querySelector('#grp-slicer');
  if (!slicer || !analyticGroups.length) return;
  const allChip = slicer.querySelector('.grp-all');
  slicer.innerHTML = '';
  if (allChip) slicer.appendChild(allChip);
  analyticGroups.forEach(g => {
    const color = g.color || '#f59e0b';
    const chip = document.createElement('div');
    chip.className = 'bi-chip active grp-chip';
    chip.dataset.groupId = g.id;
    chip.dataset.color = color;
    chip.style.cssText = `border-color:${color};background:${color}20;color:${color};`;
    chip.textContent = g.name;
    chip.addEventListener('click', () => {
      const isActive = chip.classList.contains('active');
      chip.classList.toggle('active');
      if (isActive) { chip.style.borderColor = 'rgba(255,255,255,0.12)'; chip.style.background = 'rgba(255,255,255,0.03)'; chip.style.color = 'rgba(255,255,255,0.4)'; }
      else { chip.style.borderColor = color; chip.style.background = color + '20'; chip.style.color = color; }
      // Sync "All" chip
      const allGrp = container.querySelectorAll('.grp-chip');
      const grpAll = container.querySelector('.grp-all');
      const allActive = [...allGrp].every(c => c.classList.contains('active'));
      if (grpAll) { grpAll.classList.toggle('active', allActive); grpAll.style.borderColor = allActive ? '#f59e0b' : 'rgba(255,255,255,0.12)'; grpAll.style.background = allActive ? '#f59e0b20' : 'rgba(255,255,255,0.03)'; grpAll.style.color = allActive ? '#f59e0b' : 'rgba(255,255,255,0.4)'; }
      // When groups change, auto-filter CC chips
      syncCCFromGroups(container);
      if (dashData) renderDashboard(container);
    });
    slicer.appendChild(chip);
  });
}

function syncCCFromGroups(container) {
  const grpChips = container.querySelectorAll('.grp-chip');
  const allGrpActive = grpChips.length === 0 || [...grpChips].every(c => c.classList.contains('active'));
  if (allGrpActive) {
    // All groups selected — activate all CC chips
    container.querySelectorAll('.cc-chip').forEach(c => {
      c.classList.add('active');
      const col = c.dataset.color;
      c.style.borderColor = col; c.style.background = col + '20'; c.style.color = col;
    });
    return;
  }
  // Get selected group IDs
  const selGroupIds = new Set([...container.querySelectorAll('.grp-chip.active')].map(c => c.dataset.groupId));
  // For each CC chip, check if it belongs to a selected group
  container.querySelectorAll('.cc-chip').forEach(c => {
    const ccName = c.dataset.cc;
    const groupId = analyticGroupMappings[ccName];
    const shouldBeActive = groupId ? selGroupIds.has(String(groupId)) : false;
    c.classList.toggle('active', shouldBeActive);
    const col = c.dataset.color;
    if (shouldBeActive) { c.style.borderColor = col; c.style.background = col + '20'; c.style.color = col; }
    else { c.style.borderColor = 'rgba(255,255,255,0.12)'; c.style.background = 'rgba(255,255,255,0.03)'; c.style.color = 'rgba(255,255,255,0.4)'; }
  });
}

async function loadDashboard(container) {
  const selectedCos = [...container.querySelectorAll('.co-chip.active')].map(c => c.dataset.id);
  let selectedYrs = [...container.querySelectorAll('.yr-chip.active')].map(c => c.dataset.year).sort();
  const body = container.querySelector('#bi-body');

  const df = container.querySelector('#date-from')?.value;
  const dt = container.querySelector('#date-to')?.value;
  const hasCustomDates = df && dt;

  // When custom dates are set, derive year from dateFrom if no years selected
  if (hasCustomDates && !selectedYrs.length) {
    selectedYrs = [df.substring(0, 4)];
  }

  if (!selectedCos.length || !selectedYrs.length) {
    body.innerHTML = '<div class="bi-empty">اختر شركة وسنة مالية واحدة على الأقل</div>';
    return;
  }

  body.innerHTML = '<div class="bi-empty">⏳ جاري تحميل البيانات...</div>';

  try {
    const params = { companyIds: selectedCos.join(','), years: selectedYrs.join(',') };
    if (df) params.dateFrom = df;
    if (dt) params.dateTo = dt;
    console.log('[loadDashboard] params:', JSON.stringify(params));
    dashData = await api.getPresentationData(params);
    dashData._selectedCos = selectedCos;
    dashData._selectedYrs = selectedYrs;
    // Update last-updated timestamp
    lastUpdatedTime = new Date();
    const tsEl = container.querySelector('#bi-last-updated-ts');
    if (tsEl) tsEl.textContent = fmtTimestamp(lastUpdatedTime);
    // Populate CC slicer from loaded data
    populateCCSlider(container, dashData);
    renderDashboard(container);
  } catch (err) {
    console.error(err);
    body.innerHTML = '<div class="bi-empty" style="color:#ef4444;">❌ خطأ في تحميل البيانات</div>';
  }
}

function renderDashboard(container) {
  const body = container.querySelector('#bi-body');
  const selectedCCs = getSelectedCCs(container);
  // Create filtered copy of dashData if CCs are selected
  const d = selectedCCs ? filterDataByCCs(dashData, selectedCCs) : dashData;
  const yrs = d.years || [];
  const yd = d.yearlyData || {};
  const gt = d.grandTotals;
  const firstComps = yd[yrs[0]]?.companies || [];
  const multiCo = firstComps.length > 1;
  const multiYear = yrs.length > 1;

  switch (activeTab) {
    case 'overview': renderOverview(body, d, gt, yrs, yd, firstComps, multiCo, multiYear); break;
    case 'collection': renderCollection(body, d, gt, yrs, yd, firstComps, multiCo, multiYear); break;
    case 'comparison': renderComparison(body, d, gt, yrs, yd, firstComps, multiCo, multiYear); break;
    case 'details': renderDetails(body, d, gt, yrs, yd, firstComps, multiCo, multiYear); break;
    case 'pivot-acc': renderPivotAcc(body, d); break;
    case 'pivot-cc': renderPivotCC(body, d); break;
    case 'redist': renderRedistribution(body, d); break;
    case 'guarantees': renderGuarantees(body, d, yrs, yd); break;
  }
}

function filterDataByCCs(orig, selectedCCs) {
  const ccSet = new Set(selectedCCs);
  const filtered = { ...orig, yearlyData: {}, years: orig.years };
  const allKpis = [];
  for (const yr of orig.years) {
    const origYr = orig.yearlyData[yr];
    const companies = (origYr?.companies || []).map(co => {
      // Filter costCenters
      const costCenters = (co.costCenters || []).filter(cc => ccSet.has(cc.name));
      // Filter accountTree
      const accountTree = (co.accountTree || []).filter(at => ccSet.has(at.name));
      // Filter pivotData
      const pivotData = (co.pivotData || []).filter(r => ccSet.has(r.cc));
      // Recompute KPIs from filtered costCenters
      let revenue = 0, expenses = 0, collected = 0, remaining = 0;
      costCenters.forEach(cc => { revenue += cc.revenue || 0; expenses += cc.expenses || 0; collected += cc.collected || 0; remaining += cc.remaining || 0; });
      const netIncome = revenue - expenses;
      const kpis = { ...co.kpis, revenue, expenses, collected, remaining, netIncome,
        profitMargin: revenue > 0 ? (netIncome / revenue * 100) : 0,
        expenseRatio: revenue > 0 ? (expenses / revenue * 100) : 0,
        collectionRate: revenue > 0 ? (collected / revenue * 100) : 0,
        remainingRate: revenue > 0 ? (remaining / revenue * 100) : 0
      };
      allKpis.push(kpis);
      return { ...co, costCenters, accountTree, pivotData, kpis };
    });
    // Recompute year totals
    const totKpis = companies.map(c => c.kpis);
    const totals = sumKpisClient(totKpis);
    filtered.yearlyData[yr] = { ...origYr, companies, totals };
  }
  filtered.grandTotals = sumKpisClient(allKpis);
  return filtered;
}

function sumKpisClient(arr) {
  const t = { revenue:0,expenses:0,netIncome:0,assets:0,liabilities:0,equity:0,cash:0,receivables:0,openingReceivables:0,collected:0,remaining:0,payables:0 };
  for (const k of arr) for (const key of Object.keys(t)) t[key] += k[key] || 0;
  t.profitMargin = t.revenue > 0 ? (t.netIncome / t.revenue * 100) : 0;
  t.expenseRatio = t.revenue > 0 ? (t.expenses / t.revenue * 100) : 0;
  t.collectionRate = t.revenue > 0 ? (t.collected / t.revenue * 100) : 0;
  t.remainingRate = t.revenue > 0 ? (t.remaining / t.revenue * 100) : 0;
  return t;
}

// ===== TAB: OVERVIEW =====
function renderOverview(body, d, gt, yrs, yd, comps, multiCo, multiYear) {
  // Use gt (grandTotals) — already unified from accountTree on server
  const ovRev = gt.revenue, ovExp = gt.expenses;
  const ovNet = gt.netIncome;
  const collected = gt.collected;
  const collPct = gt.collectionRate;
  const expPct = gt.expenseRatio;
  const ovPM = gt.profitMargin;
  const ovRem = gt.remaining;
  const ovRemRate = gt.remainingRate;
  body.innerHTML = `
    <div class="bi-kpi-row">
      <div class="bi-kpi"><div class="bi-kpi-label">💰 الإيرادات</div><div class="bi-kpi-value" style="color:#10b981;">${fmt(ovRev)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📤 المصروفات</div><div class="bi-kpi-value" style="color:#ef4444;">${fmt(ovExp)}</div><div class="bi-kpi-sub">${fmtP(expPct)} من الإيرادات</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📈 صافي الربح</div><div class="bi-kpi-value" style="color:${ovNet>=0?'#10b981':'#ef4444'};">${fmt(ovNet)}</div><div class="bi-kpi-sub">هامش ${fmtP(ovPM)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">✅ المحصّل</div><div class="bi-kpi-value" style="color:#06b6d4;">${fmt(collected)}</div><div class="bi-kpi-sub">${fmtP(collPct)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">⏳ المتبقي</div><div class="bi-kpi-value" style="color:#f59e0b;">${fmt(ovRem)}</div><div class="bi-kpi-sub">${fmtP(ovRemRate)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">🏦 الضمانات البنكية</div><div class="bi-kpi-value" style="color:#06b6d4;">${fmt(gt.cash)}</div><div class="bi-kpi-sub">بتاريخ ${new Date().toISOString().slice(0,10)}</div></div>
    </div>
    <div class="bi-card bi-full" style="padding:14px 20px;">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;">
        <div><div class="bi-pbar-label"><span>نسبة التحصيل</span><span style="color:#10b981;font-family:var(--font-en);font-weight:700;">${fmtP(collPct)}</span></div><div class="bi-pbar"><div class="bi-pbar-fill" style="width:${Math.min(collPct,100)}%;background:linear-gradient(90deg,#10b981,#34d399);"></div></div></div>
        <div><div class="bi-pbar-label"><span>نسبة المصروفات</span><span style="color:#ef4444;font-family:var(--font-en);font-weight:700;">${fmtP(expPct)}</span></div><div class="bi-pbar"><div class="bi-pbar-fill" style="width:${Math.min(expPct,100)}%;background:linear-gradient(90deg,#ef4444,#f87171);"></div></div></div>
        <div><div class="bi-pbar-label"><span>هامش الربح</span><span style="color:${ovPM>=0?'#10b981':'#ef4444'};font-family:var(--font-en);font-weight:700;">${fmtP(ovPM)}</span></div><div class="bi-pbar"><div class="bi-pbar-fill" style="width:${Math.min(Math.abs(ovPM),100)}%;background:linear-gradient(90deg,${ovPM>=0?'#10b981,#34d399':'#ef4444,#f87171'});"></div></div></div>
      </div>
    </div>
    <div class="bi-charts">
      <div class="bi-card"><div class="bi-card-title">🍩 ${multiCo?'توزيع الإيرادات بين الشركات':(multiYear?'توزيع الإيرادات بين السنوات':'تحليل التحصيل')}</div><canvas id="ch-overview-donut" height="280"></canvas></div>
      <div class="bi-card"><div class="bi-card-title">🍩 ${multiCo?'توزيع المصروفات بين الشركات':(multiYear?'توزيع المصروفات بين السنوات':'تحليل المصروفات')}</div><canvas id="ch-overview-donut-exp" height="280"></canvas></div>
    </div>
    <div class="bi-card bi-full"><div class="bi-card-title">📊 ${multiCo?'الإيرادات والمصروفات حسب الشركة':(multiYear?'الإيرادات والمصروفات حسب السنة':'الإيرادات مقابل المصروفات')}</div><canvas id="ch-overview-bar"></canvas></div>
    <div class="bi-charts">
      <div class="bi-card"><div class="bi-card-title">📈 الإيرادات الشهرية <span style="font-size:0.85rem;color:rgba(255,255,255,0.35);margin-right:8px;font-family:var(--font-en);">${yrs[yrs.length-1]||''}</span></div><canvas id="ch-monthly-rev" height="280"></canvas></div>
      <div class="bi-card"><div class="bi-card-title">📉 المصروفات الشهرية <span style="font-size:0.85rem;color:rgba(255,255,255,0.35);margin-right:8px;font-family:var(--font-en);">${yrs[yrs.length-1]||''}</span></div><canvas id="ch-monthly-exp" height="280"></canvas></div>
    </div>
  `;
  requestAnimationFrame(() => {
    drawDonut(document.getElementById('ch-overview-donut'), buildDonutData(d));
    drawDonut(document.getElementById('ch-overview-donut-exp'), buildExpDonutData(d));
    drawBarGroup(document.getElementById('ch-overview-bar'), buildBarData(d, 'revexp'));
    // Monthly charts — last fiscal year only
    const lastYr = yrs[yrs.length - 1];
    if (lastYr) {
      const monthlyData = buildMonthlyBarData(d, lastYr);
      drawMonthlyBars(document.getElementById('ch-monthly-rev'), monthlyData.revenue, '#10b981', '#34d399');
      drawMonthlyBars(document.getElementById('ch-monthly-exp'), monthlyData.expenses, '#ef4444', '#f87171');
    }
  });
}

// ===== TAB: COLLECTION =====
function renderCollection(body, d, gt, yrs, yd, comps, multiCo, multiYear) {
  // Use gt (grandTotals) — already unified from accountTree on server
  const clRev = gt.revenue, clExp = gt.expenses;
  const collected = gt.collected;
  const collPct = gt.collectionRate;
  const clRem = gt.remaining;
  const remPct = gt.remainingRate;
  body.innerHTML = `
    <div class="bi-kpi-row" style="grid-template-columns:repeat(4,1fr);">
      <div class="bi-kpi"><div class="bi-kpi-label">💰 إجمالي الإيرادات</div><div class="bi-kpi-value" style="color:#10b981;">${fmt(clRev)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">✅ المحصّل</div><div class="bi-kpi-value" style="color:#06b6d4;">${fmt(collected)}</div><div class="bi-kpi-sub">${fmtP(collPct)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">⏳ المتبقي</div><div class="bi-kpi-value" style="color:#f59e0b;">${fmt(clRem)}</div><div class="bi-kpi-sub">${fmtP(remPct)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📤 المصروفات</div><div class="bi-kpi-value" style="color:#ef4444;">${fmt(clExp)}</div></div>
    </div>
    <div class="bi-charts">
      <div class="bi-card"><div class="bi-card-title">📥 التحصيل ${multiCo?'حسب الشركة':(multiYear?'حسب السنة':'')}</div><canvas id="ch-coll-bars" height="340"></canvas></div>
      <div class="bi-card"><div class="bi-card-title">🍩 محصّل مقابل متبقي</div><canvas id="ch-coll-donut" height="340"></canvas></div>
    </div>
    <div class="bi-card bi-full">
      <div class="bi-card-title">📋 تفاصيل التحصيل</div>
      <div style="overflow-x:auto;"><table class="bi-table" id="tbl-collection"></table></div>
    </div>
  `;
  requestAnimationFrame(() => {
    drawCollectionBars(document.getElementById('ch-coll-bars'), d);
    drawDonut(document.getElementById('ch-coll-donut'), { values: [collected, clRem], colors: ['#10b981','#f59e0b'], labels: ['المحصّل','المتبقي'] });
    fillCollectionTable(document.getElementById('tbl-collection'), d);
  });
}

// ===== TAB: COMPARISON =====
function renderComparison(body, d, gt, yrs, yd, comps, multiCo, multiYear) {
  body.innerHTML = `
    <div class="bi-card bi-full">
      <div class="bi-card-title">📋 مقارنة شاملة — الإيرادات والمصروفات والتحصيل</div>
      <div style="overflow-x:auto;"><table class="bi-table" id="tbl-comparison"></table></div>
    </div>
    ${multiYear ? `<div class="bi-card bi-full"><div class="bi-card-title">📅 مقارنة سنوية</div><div style="overflow-x:auto;"><table class="bi-table" id="tbl-yoy"></table></div></div>` : ''}
    <div class="bi-charts">
      <div class="bi-card"><div class="bi-card-title">📊 مقارنة الإيرادات والمصروفات</div><canvas id="ch-comp-bar"></canvas></div>
      <div class="bi-card"><div class="bi-card-title">🍩 توزيع الإيرادات</div><canvas id="ch-comp-donut" height="240"></canvas></div>
    </div>
  `;
  requestAnimationFrame(() => {
    fillComparisonTable(document.getElementById('tbl-comparison'), d);
    if (multiYear) fillYoYTable(document.getElementById('tbl-yoy'), d);
    drawBarGroup(document.getElementById('ch-comp-bar'), buildBarData(d, 'revexp'));
    drawDonut(document.getElementById('ch-comp-donut'), buildDonutData(d));
  });
}

// ===== TAB: BALANCE =====
function renderBalance(body, d, gt, yrs, yd, comps, multiCo, multiYear) {
  body.innerHTML = `
    <div class="bi-kpi-row" style="grid-template-columns:repeat(4,1fr);">
      <div class="bi-kpi"><div class="bi-kpi-label">📦 الأصول</div><div class="bi-kpi-value" style="color:#3b82f6;">${fmt(gt.assets)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">⚠️ الالتزامات</div><div class="bi-kpi-value" style="color:#ef4444;">${fmt(gt.liabilities)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">🏛️ حقوق الملكية</div><div class="bi-kpi-value" style="color:#10b981;">${fmt(gt.equity)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">💵 النقدية</div><div class="bi-kpi-value" style="color:#06b6d4;">${fmt(gt.cash)}</div></div>
    </div>
    <div class="bi-charts">
      <div class="bi-card"><div class="bi-card-title">⚖️ المركز المالي ${multiCo?'حسب الشركة':(multiYear?'حسب السنة':'')}</div><canvas id="ch-bal-bar" height="340"></canvas></div>
      <div class="bi-card"><div class="bi-card-title">🍩 هيكل الأصول</div><canvas id="ch-bal-donut" height="340"></canvas></div>
    </div>
    <div class="bi-card bi-full">
      <div class="bi-card-title">📋 تفاصيل المركز المالي</div>
      <div style="overflow-x:auto;"><table class="bi-table" id="tbl-balance"></table></div>
    </div>
  `;
  requestAnimationFrame(() => {
    drawBarGroup(document.getElementById('ch-bal-bar'), buildBarData(d, 'balance'));
    drawDonut(document.getElementById('ch-bal-donut'), { values: [gt.assets, gt.liabilities, gt.equity], colors: ['#3b82f6','#ef4444','#10b981'], labels: ['الأصول','الالتزامات','حقوق الملكية'] });
    fillBalanceTable(document.getElementById('tbl-balance'), d);
  });
}

// ===== CHART DATA BUILDERS =====
function aggregateCompanyKpis(d) {
  // Aggregate each company's kpis across ALL selected years
  const map = new Map();
  for (const yr of d.years) {
    for (const c of (d.yearlyData[yr]?.companies || [])) {
      let agg = map.get(c.companyId);
      if (!agg) { agg = { companyId: c.companyId, companyName: c.companyName, kpis: {} }; map.set(c.companyId, agg); }
      for (const [k, v] of Object.entries(c.kpis)) { agg.kpis[k] = (agg.kpis[k] || 0) + (typeof v === 'number' ? v : 0); }
    }
  }
  // Recompute derived ratios
  for (const a of map.values()) {
    const k = a.kpis;
    k.profitMargin = k.revenue > 0 ? (k.netIncome / k.revenue * 100) : 0;
    k.expenseRatio = k.revenue > 0 ? (k.expenses / k.revenue * 100) : 0;
    k.collectionRate = k.revenue > 0 ? (k.collected / k.revenue * 100) : 0;
  }
  return [...map.values()];
}

function buildBarData(d, type) {
  const yrs = d.years, yd = d.yearlyData;
  const allComps = aggregateCompanyKpis(d);
  const mC = allComps.length > 1, mY = yrs.length > 1;

  if (type === 'revexp') {
    if (mC) return { groups: allComps.map(c => [c.kpis.revenue, c.kpis.expenses]), max: Math.max(...allComps.flatMap(c => [c.kpis.revenue, c.kpis.expenses]), 1), colors: ['#10b981','#ef4444'], labels: allComps.map(c => c.companyName) };
    if (mY) return { groups: yrs.map(y => [yd[y].totals.revenue, yd[y].totals.expenses]), max: Math.max(...yrs.flatMap(y => [yd[y].totals.revenue, yd[y].totals.expenses]), 1), colors: ['#10b981','#ef4444'], labels: yrs };
    const t = d.grandTotals; return { groups: [[t.revenue, t.expenses, t.netIncome]], max: Math.max(t.revenue, t.expenses, 1), colors: ['#10b981','#ef4444','#3b82f6'], labels: [''] };
  }
  if (type === 'balance') {
    if (mC) return { groups: allComps.map(c => [c.kpis.assets, c.kpis.liabilities, c.kpis.equity]), max: Math.max(...allComps.flatMap(c => [c.kpis.assets, c.kpis.liabilities, c.kpis.equity]), 1), colors: ['#3b82f6','#ef4444','#10b981'], labels: allComps.map(c => c.companyName) };
    if (mY) return { groups: yrs.map(y => [yd[y].totals.assets, yd[y].totals.liabilities, yd[y].totals.equity]), max: Math.max(...yrs.flatMap(y => [yd[y].totals.assets, yd[y].totals.liabilities, yd[y].totals.equity]), 1), colors: ['#3b82f6','#ef4444','#10b981'], labels: yrs };
    const t = d.grandTotals; return { groups: [[t.assets, t.liabilities, t.equity]], max: Math.max(t.assets, t.liabilities, 1), colors: ['#3b82f6','#ef4444','#10b981'], labels: [''] };
  }
}

function buildDonutData(d) {
  const yrs = d.years, yd = d.yearlyData;
  const allComps = aggregateCompanyKpis(d);
  const mC = allComps.length > 1, mY = yrs.length > 1;
  if (mC) return { values: allComps.map(c => c.kpis.revenue), colors: COLORS, labels: allComps.map(c => c.companyName) };
  if (mY) return { values: yrs.map(y => yd[y].totals.revenue), colors: YR_COLORS, labels: yrs };
  const t = d.grandTotals; return { values: [t.collected||0, t.remaining||0], colors: ['#10b981','#f59e0b'], labels: ['المحصّل','المتبقي'] };
}

const EXP_COLORS = ['#ef4444','#f59e0b','#ec4899','#f97316','#e11d48','#dc2626','#be123c','#ea580c'];
function buildExpDonutData(d) {
  const yrs = d.years, yd = d.yearlyData;
  const allComps = aggregateCompanyKpis(d);
  const mC = allComps.length > 1, mY = yrs.length > 1;
  if (mC) return { values: allComps.map(c => c.kpis.expenses), colors: EXP_COLORS, labels: allComps.map(c => c.companyName) };
  if (mY) return { values: yrs.map(y => yd[y].totals.expenses), colors: EXP_COLORS, labels: yrs };
  const t = d.grandTotals; return { values: [t.expenses||0, Math.max(t.netIncome,0)], colors: ['#ef4444','#10b981'], labels: ['المصروفات','صافي الربح'] };
}

// ===== MONTHLY BAR DATA (from pivotData, last FY) =====
function buildMonthlyBarData(d, year) {
  const yd = d.yearlyData[year];
  if (!yd) return { revenue: [], expenses: [] };
  const rev = new Array(12).fill(0);
  const exp = new Array(12).fill(0);
  for (const co of (yd.companies || [])) {
    for (const r of (co.pivotData || [])) {
      const m = r.month; // 1-12
      if (m >= 1 && m <= 12) {
        rev[m - 1] += r.revenue || 0;
        exp[m - 1] += r.expenses || 0;
      }
    }
  }
  return { revenue: rev, expenses: exp };
}

// ===== CANVAS: MONTHLY BARS =====
function drawMonthlyBars(canvas, data, color1, color2) {
  if (!canvas || !data || !data.length) return;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  ctx.scale(dpr, dpr); ctx.clearRect(0, 0, w, h);

  const pL = 20, pR = 14, pT = 28, pB = 36;
  const cW = w - pL - pR, cH = h - pT - pB;
  const mx = Math.max(...data, 1);
  const gW = cW / 12;
  const bW = Math.min(gW * 0.55, 48);

  // Grid lines with scale labels
  for (let i = 0; i <= 4; i++) {
    const y = pT + (cH / 4) * i;
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath(); ctx.moveTo(pL, y); ctx.lineTo(pL + cW, y); ctx.stroke();
  }

  // Draw trend line connecting tops
  ctx.beginPath();
  ctx.strokeStyle = color1 + '50';
  ctx.lineWidth = 2.5;
  data.forEach((val, i) => {
    const x = pL + i * gW + gW / 2;
    const bh = (Math.abs(val) / mx) * cH;
    const y = pT + cH - bh;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Draw bars
  data.forEach((val, i) => {
    const x = pL + i * gW + (gW - bW) / 2;
    const bh = (Math.abs(val) / mx) * cH;
    const y = pT + cH - bh;
    const r = Math.min(5, bW / 2);

    // Gradient bar
    const grad = ctx.createLinearGradient(x, y, x, pT + cH);
    grad.addColorStop(0, color1);
    grad.addColorStop(1, color2 + '30');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(x, pT + cH); ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r); ctx.arcTo(x + bW, y, x + bW, y + r, r);
    ctx.lineTo(x + bW, pT + cH); ctx.closePath(); ctx.fill();

    // Value label — rotated to avoid overlap
    if (val > 0) {
      ctx.save();
      const lx = x + bW / 2;
      const ly = y - 4;
      ctx.translate(lx, ly);
      ctx.rotate(-Math.PI / 4);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.font = 'bold 10px Inter';
      ctx.textAlign = 'left';
      ctx.fillText(fmt(val), 0, 0);
      ctx.restore();
    }

    // Month label — bigger
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '700 13px "Noto Sans Arabic"';
    ctx.textAlign = 'center';
    ctx.fillText(MONTH_NAMES[i].substring(0, 5), pL + i * gW + gW / 2, h - 8);
  });

  // Total label — top right to avoid overlap
  const total = data.reduce((a, b) => a + b, 0);
  ctx.fillStyle = color1;
  ctx.font = 'bold 13px Inter';
  ctx.textAlign = 'right';
  ctx.fillText('\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a: ' + fmt(total), w - pR, 18);
}

// ===== CANVAS: HORIZONTAL BAR GROUP =====
function drawBarGroup(canvas, data) {
  if (!canvas || !data) return;
  const { groups, max, colors, labels } = data;
  const bPG = groups[0]?.length || 1;
  const gC = groups.length;
  const barH = 26;
  const barGap = 3;
  const groupGap = 14;
  const legendH = 30;
  // Calculate exact needed height
  const neededH = 10 + gC * (bPG * (barH + barGap) + groupGap) + legendH;
  canvas.style.height = neededH + 'px';

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = neededH;
  canvas.width = w * dpr; canvas.height = h * dpr;
  ctx.scale(dpr, dpr); ctx.clearRect(0, 0, w, h);

  const labelW = 140;
  const pL = 10, pR = 10, pT = 8;
  const chartW = w - labelW - pL - pR - 120; // reserve space for value labels
  const mx = max || 1;

  // Vertical grid lines
  for (let i = 0; i <= 5; i++) {
    const x = labelW + pL + (chartW / 5) * i;
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.beginPath(); ctx.moveTo(x, pT); ctx.lineTo(x, h - legendH); ctx.stroke();
  }

  let curY = pT;
  groups.forEach((bars, gi) => {
    const groupH = bPG * (barH + barGap);
    // Group label on the right
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '700 13px "Noto Sans Arabic"';
    ctx.textAlign = 'right';
    const short = (labels[gi] || '').length > 20 ? labels[gi].substring(0, 20) + '\u2026' : labels[gi];
    ctx.fillText(short, labelW - 8, curY + groupH / 2 + 1);

    bars.forEach((val, bi) => {
      const y = curY + bi * (barH + barGap);
      const bw = Math.max(2, (Math.abs(val) / mx) * chartW);
      const r = Math.min(5, barH / 2);
      const x = labelW + pL;

      // Horizontal bar with gradient
      const grad = ctx.createLinearGradient(x, y, x + bw, y);
      grad.addColorStop(0, colors[bi % colors.length]);
      grad.addColorStop(1, colors[bi % colors.length] + '90');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x + bw - r, y);
      ctx.arcTo(x + bw, y, x + bw, y + r, r);
      ctx.arcTo(x + bw, y + barH, x + bw - r, y + barH, r);
      ctx.lineTo(x, y + barH); ctx.closePath(); ctx.fill();

      // Value at end of bar
      const label = Math.abs(val) >= 1e6 ? (val / 1e6).toFixed(1) + 'M' : Math.abs(val) >= 1e3 ? Math.round(val / 1e3) + 'K' : formatNumber(val, 0);
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.font = 'bold 13px Inter';
      ctx.textAlign = 'left';
      ctx.fillText(label, x + bw + 8, y + barH / 2 + 5);
    });

    curY += groupH + groupGap;
  });

  // Legend at bottom
  const legendY = h - 6;
  const legendLabels = bPG >= 2 ? ['إيرادات', 'مصروفات'] : ['القيمة'];
  let lx = labelW + pL;
  legendLabels.forEach((lbl, i) => {
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(lx, legendY - 12, 12, 12);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '600 12px "Noto Sans Arabic"';
    ctx.textAlign = 'left';
    ctx.fillText(lbl, lx + 16, legendY - 1);
    lx += 90;
  });
}

// ===== CANVAS: DONUT =====
function drawDonut(canvas, data) {
  if (!canvas || !data) return;
  const { values, colors, labels } = data;
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  ctx.scale(dpr, dpr); ctx.clearRect(0, 0, w, h);

  const cx = w * 0.38, cy = h / 2;
  const r = Math.min(cx - 20, cy - 20);
  const inner = r * 0.48;
  const total = values.reduce((a, b) => a + Math.abs(b), 0) || 1;
  let angle = -Math.PI / 2;

  values.forEach((v, i) => {
    const sweep = (Math.abs(v) / total) * Math.PI * 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, angle, angle + sweep); ctx.arc(cx, cy, inner, angle + sweep, angle, true); ctx.closePath();
    ctx.fillStyle = colors[i % colors.length]; ctx.fill();
    if (sweep > 0.15) {
      const mid = angle + sweep / 2;
      ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(((Math.abs(v) / total) * 100).toFixed(0) + '%', cx + Math.cos(mid) * (r * 0.76), cy + Math.sin(mid) * (r * 0.76));
    }
    angle += sweep;
  });

  // Center
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = '700 13px "Noto Sans Arabic"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('المجموع', cx, cy - 12);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 18px Inter';
  ctx.fillText(total >= 1e6 ? (total / 1e6).toFixed(1) + 'M' : fmt(total), cx, cy + 12);

  // Legend
  const legX = w * 0.68; let legY = 28;
  labels.forEach((lb, i) => {
    ctx.fillStyle = colors[i % colors.length]; ctx.beginPath(); ctx.arc(legX, legY + 7, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '700 13px "Noto Sans Arabic"'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(lb.length > 20 ? lb.substring(0, 20) + '…' : lb, legX - 14, legY + 7);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '12px Inter'; ctx.textAlign = 'left';
    ctx.fillText(fmt(values[i]), legX + 14, legY + 7);
    legY += 30;
  });
}

// ===== CANVAS: COLLECTION STACKED =====
function drawCollectionBars(canvas, d) {
  if (!canvas) return;
  const yrs = d.years, yd = d.yearlyData, fc = yd[yrs[0]]?.companies || [];
  const mC = fc.length > 1, mY = yrs.length > 1;
  let items;
  if (mC) items = fc.map(c => ({ l: c.companyName, a: c.kpis.collected||0, b: c.kpis.remaining||0, t: c.kpis.revenue }));
  else if (mY) items = yrs.map(y => { const t = yd[y].totals; return { l: y, a: t.collected||0, b: t.remaining||0, t: t.revenue }; });
  else { const t = d.grandTotals; items = [{ l: 'التحصيل', a: t.collected||0, b: t.remaining||0, t: t.revenue }]; }

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  ctx.scale(dpr, dpr); ctx.clearRect(0, 0, w, h);

  const pL = 130, pR = 70, cW = w - pL - pR;
  const bH = Math.min(24, (h - 10) / items.length - 6);
  const mx = Math.max(...items.map(i => i.t), 1);

  items.forEach((it, i) => {
    const y = 5 + i * ((h - 10) / items.length) + ((h - 10) / items.length - bH) / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '600 11px "Noto Sans Arabic"'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(it.l.length > 14 ? it.l.substring(0, 14) + '…' : it.l, pL - 10, y + bH / 2);

    const w1 = (Math.abs(it.a) / mx) * cW;
    const w2 = (Math.abs(it.b) / mx) * cW;
    ctx.fillStyle = '#10b981'; ctx.fillRect(pL, y, w1, bH);
    ctx.fillStyle = '#f59e0b'; ctx.fillRect(pL + w1, y, w2, bH);

    const pct = it.t > 0 ? ((it.a / it.t) * 100).toFixed(0) + '%' : '0%';
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '600 10px Inter'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`${fmt(it.t)}  (${pct})`, pL + w1 + w2 + 8, y + bH / 2);
  });
}

// ===== TABLE HELPERS =====
function bindToggle(tbl) {
  // Company/Group ↔ Cost Center toggle
  tbl.querySelectorAll('.row-co').forEach(row => {
    row.addEventListener('click', () => {
      const gid = row.dataset.gid;
      const open = row.classList.toggle('open');
      const ccChildren = tbl.querySelectorAll(`.row-cc[data-pgid="${gid}"]`);
      if (ccChildren.length > 0) {
        // Has row-cc children
        ccChildren.forEach(r => r.classList.toggle('show', open));
        if (!open) {
          ccChildren.forEach(cc => {
            cc.classList.remove('open');
            tbl.querySelectorAll(`.row-pt[data-pgid="${cc.dataset.gid}"]`).forEach(r => r.classList.remove('show'));
          });
        }
      } else {
        // Direct row-pt children (no row-cc intermediary)
        tbl.querySelectorAll(`.row-pt[data-pgid="${gid}"]`).forEach(r => r.classList.toggle('show', open));
      }
    });
  });
  // Cost Center ↔ Partner/Account toggle
  tbl.querySelectorAll('.row-cc').forEach(row => {
    row.addEventListener('click', (e) => {
      e.stopPropagation();
      const gid = row.dataset.gid;
      const open = row.classList.toggle('open');
      tbl.querySelectorAll(`.row-pt[data-pgid="${gid}"]`).forEach(r => r.classList.toggle('show', open));
    });
  });
}

// ===== SORTABLE HEADERS =====
function bindSortableHeaders(tbl) {
  if (!tbl) return;
  const ths = tbl.querySelectorAll('th.sortable');
  ths.forEach(th => {
    th.addEventListener('click', () => {
      // Cycle: none -> desc -> asc -> none
      const curr = th.classList.contains('desc') ? 'desc' : th.classList.contains('asc') ? 'asc' : 'none';
      // Reset all sortable headers in this table
      ths.forEach(h => { h.classList.remove('asc', 'desc'); });
      let dir;
      if (curr === 'none') dir = 'desc';
      else if (curr === 'desc') dir = 'asc';
      else dir = 'none';
      if (dir !== 'none') th.classList.add(dir);

      const colIdx = parseInt(th.dataset.colIdx);
      if (isNaN(colIdx)) return;
      const tbody = tbl.querySelector('tbody');
      if (!tbody) return;

      // Check if table has hierarchical rows
      const hasHierarchy = tbody.querySelector('.row-co') !== null;

      if (hasHierarchy) {
        // Group rows: parent row-co + its children (row-cc, row-pt)
        const groups = [];
        let currentGroup = null;
        tbody.querySelectorAll('tr').forEach(tr => {
          if (tr.classList.contains('row-co')) {
            currentGroup = { parent: tr, children: [] };
            groups.push(currentGroup);
          } else if (currentGroup) {
            currentGroup.children.push(tr);
          }
        });

        if (dir !== 'none') {
          groups.sort((a, b) => {
            const cellA = a.parent.querySelectorAll('td')[colIdx];
            const cellB = b.parent.querySelectorAll('td')[colIdx];
            const vA = parseArabicNum(cellA?.textContent);
            const vB = parseArabicNum(cellB?.textContent);
            return dir === 'desc' ? vB - vA : vA - vB;
          });
        }

        // Re-append in order
        groups.forEach(g => {
          tbody.appendChild(g.parent);
          g.children.forEach(c => tbody.appendChild(c));
        });
      } else {
        // Flat table (YoY, Balance, Guarantees)
        const rows = [...tbody.querySelectorAll('tr')];
        // Separate total/summary rows (last row often)
        const dataRows = rows.filter(r => !r.querySelector('td[colspan]'));
        const otherRows = rows.filter(r => r.querySelector('td[colspan]'));

        if (dir !== 'none') {
          dataRows.sort((a, b) => {
            const cellA = a.querySelectorAll('td')[colIdx];
            const cellB = b.querySelectorAll('td')[colIdx];
            const vA = parseArabicNum(cellA?.textContent);
            const vB = parseArabicNum(cellB?.textContent);
            return dir === 'desc' ? vB - vA : vA - vB;
          });
        }

        dataRows.forEach(r => tbody.appendChild(r));
        otherRows.forEach(r => tbody.appendChild(r));
      }
    });
  });
}

function parseArabicNum(str) {
  if (!str) return 0;
  // Remove everything except digits, minus, dot, and percent
  const cleaned = str.replace(/[^\d.\-]/g, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

function fillCollectionTable(tbl, d) {
  if (!tbl) return;
  const yrs = d.years, yd = d.yearlyData, gt = d.grandTotals, mY = yrs.length > 1;
  let rows = '', cIdx = 0, ccIdx = 0;
  yrs.forEach(yr => { (yd[yr]?.companies || []).forEach((c, i) => { const k = c.kpis;
    const coGid = 'cg' + cIdx++;
    rows += `<tr class="row-co" data-gid="${coGid}"><td style="color:${COLORS[i % COLORS.length]};font-weight:700;">${c.companyName}</td>${mY?`<td style="font-family:var(--font-en);color:rgba(255,255,255,0.5);">${yr}</td>`:''}<td class="n" style="color:#10b981;">${fmt(k.revenue)}</td><td class="n" style="color:#06b6d4;">${fmt(k.collected||0)}</td><td class="n" style="color:#f59e0b;">${fmt(k.remaining||0)}</td><td class="n" style="color:${(k.collectionRate||0)>=70?'#10b981':'#f59e0b'};">${fmtP(k.collectionRate||0)}</td><td class="n" style="color:#ef4444;">${fmt(k.expenses)}</td><td class="n" style="color:${(k.profitMargin||0)>=0?'#10b981':'#ef4444'};">${fmtP(k.profitMargin||0)}</td></tr>`;
    (c.costCenters || []).forEach(cc => {
      const ccGid = 'cc' + ccIdx++;
      rows += `<tr class="row-cc" data-gid="${ccGid}" data-pgid="${coGid}"><td>${cc.name.length>28?cc.name.substring(0,28)+'\u2026':cc.name}</td>${mY?'<td></td>':''}<td class="n">${fmt(cc.revenue)}</td><td class="n">${fmt(cc.collected||0)}</td><td class="n">${fmt(cc.remaining||0)}</td><td class="n" style="color:${(cc.collectionRate||0)>=70?'#10b981':'#f59e0b'};">${fmtP(cc.collectionRate||0)}</td><td class="n">${fmt(cc.expenses)}</td><td class="n" style="color:${(cc.profitMargin||0)>=0?'#10b981':'#ef4444'};">${fmtP(cc.profitMargin||0)}</td></tr>`;
      (cc.partners || []).forEach(p => {
        rows += `<tr class="row-pt" data-pgid="${ccGid}"><td>${p.name.length>26?p.name.substring(0,26)+'\u2026':p.name}</td>${mY?'<td></td>':''}<td class="n">${fmt(p.revenue)}</td><td class="n">${fmt(p.collected)}</td><td class="n">${fmt(p.remaining)}</td><td class="n" style="color:${(p.collectionRate||0)>=70?'#10b981':'#f59e0b'};">${fmtP(p.collectionRate)}</td><td class="n">${fmt(p.expenses)}</td><td class="n" style="color:${p.netIncome>=0?'#10b981':'#ef4444'};">${fmtP(p.profitMargin)}</td></tr>`;
      });
    });
  }); });
  // Compute footer totals from costCenters data to match table body rows
  let tRev=0, tExp=0, tColl=0, tRem=0;
  yrs.forEach(yr => { (yd[yr]?.companies || []).forEach(c => {
    (c.costCenters || []).forEach(cc => { tRev += cc.revenue||0; tExp += cc.expenses||0; tColl += cc.collected||0; tRem += cc.remaining||0; });
  }); });
  const tCollRate = tRev > 0 ? (tColl/tRev*100) : 0;
  const tNet = tRev - tExp;
  const tPM = tRev > 0 ? (tNet/tRev*100) : 0;
  const colOff = mY ? 1 : 0;
  tbl.innerHTML = `<thead><tr><th>الشركة / مركز / شريك</th>${mY?'<th>السنة</th>':''}<th class="n sortable" data-col-idx="${1+colOff}">الإيرادات</th><th class="n sortable" data-col-idx="${2+colOff}">المحصّل</th><th class="n sortable" data-col-idx="${3+colOff}">المتبقي</th><th class="n sortable" data-col-idx="${4+colOff}">% تحصيل</th><th class="n sortable" data-col-idx="${5+colOff}">المصروفات</th><th class="n sortable" data-col-idx="${6+colOff}">% ربح</th></tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr><td>المجموع</td>${mY?'<td></td>':''}<td class="n" style="color:#10b981;">${fmt(tRev)}</td><td class="n" style="color:#06b6d4;">${fmt(tColl)}</td><td class="n" style="color:#f59e0b;">${fmt(tRem)}</td><td class="n" style="color:${tCollRate>=70?'#10b981':'#f59e0b'};">${fmtP(tCollRate)}</td><td class="n" style="color:#ef4444;">${fmt(tExp)}</td><td class="n" style="color:${tPM>=0?'#10b981':'#ef4444'};">${fmtP(tPM)}</td></tr></tfoot>`;
  bindToggle(tbl);
  bindSortableHeaders(tbl);
}

function fillComparisonTable(tbl, d) {
  if (!tbl) return;
  const yrs = d.years, yd = d.yearlyData, gt = d.grandTotals, mY = yrs.length > 1;
  let rows = '', cIdx = 0, ccIdx = 0;
  yrs.forEach(yr => { (yd[yr]?.companies || []).forEach((c, i) => { const k = c.kpis;
    const coGid = 'mg' + cIdx++;
    rows += `<tr class="row-co" data-gid="${coGid}"><td style="color:${COLORS[i % COLORS.length]};font-weight:700;">${c.companyName}</td>${mY?`<td style="font-family:var(--font-en);color:rgba(255,255,255,0.5);">${yr}</td>`:''}<td class="n" style="color:#10b981;">${fmt(k.revenue)}</td><td class="n" style="color:#ef4444;">${fmt(k.expenses)}</td><td class="n" style="color:#ef4444;">${fmtP(k.expenseRatio||0)}</td><td class="n" style="color:#06b6d4;">${fmt(k.collected||0)}</td><td class="n" style="color:#f59e0b;">${fmt(k.remaining||0)}</td><td class="n" style="color:${(k.collectionRate||0)>=70?'#10b981':'#f59e0b'};">${fmtP(k.collectionRate||0)}</td><td class="n" style="color:${k.netIncome>=0?'#10b981':'#ef4444'};">${fmt(k.netIncome)}</td><td class="n" style="color:${k.profitMargin>=0?'#10b981':'#ef4444'};">${fmtP(k.profitMargin)}</td></tr>`;
    (c.costCenters || []).forEach(cc => {
      const ccGid = 'mc' + ccIdx++;
      const ep = cc.revenue > 0 ? (cc.expenses/cc.revenue*100) : 0;
      rows += `<tr class="row-cc" data-gid="${ccGid}" data-pgid="${coGid}"><td>${cc.name.length>26?cc.name.substring(0,26)+'\u2026':cc.name}</td>${mY?'<td></td>':''}<td class="n">${fmt(cc.revenue)}</td><td class="n">${fmt(cc.expenses)}</td><td class="n">${fmtP(ep)}</td><td class="n">${fmt(cc.collected||0)}</td><td class="n">${fmt(cc.remaining||0)}</td><td class="n" style="color:${(cc.collectionRate||0)>=70?'#10b981':'#f59e0b'};">${fmtP(cc.collectionRate||0)}</td><td class="n" style="color:${cc.netIncome>=0?'#10b981':'#ef4444'};">${fmt(cc.netIncome)}</td><td class="n" style="color:${(cc.profitMargin||0)>=0?'#10b981':'#ef4444'};">${fmtP(cc.profitMargin||0)}</td></tr>`;
      (cc.partners || []).forEach(p => {
        const pep = p.revenue > 0 ? (p.expenses/p.revenue*100) : 0;
        rows += `<tr class="row-pt" data-pgid="${ccGid}"><td>${p.name.length>24?p.name.substring(0,24)+'\u2026':p.name}</td>${mY?'<td></td>':''}<td class="n">${fmt(p.revenue)}</td><td class="n">${fmt(p.expenses)}</td><td class="n">${fmtP(pep)}</td><td class="n">${fmt(p.collected)}</td><td class="n">${fmt(p.remaining)}</td><td class="n" style="color:${(p.collectionRate||0)>=70?'#10b981':'#f59e0b'};">${fmtP(p.collectionRate)}</td><td class="n" style="color:${p.netIncome>=0?'#10b981':'#ef4444'};">${fmt(p.netIncome)}</td><td class="n" style="color:${p.profitMargin>=0?'#10b981':'#ef4444'};">${fmtP(p.profitMargin)}</td></tr>`;
      });
    });
  }); });
  // Compute footer totals from costCenters data to match table body rows
  let tRev=0, tExp=0, tColl=0, tRem=0;
  yrs.forEach(yr => { (yd[yr]?.companies || []).forEach(c => {
    (c.costCenters || []).forEach(cc => { tRev += cc.revenue||0; tExp += cc.expenses||0; tColl += cc.collected||0; tRem += cc.remaining||0; });
  }); });
  const tCollRate = tRev > 0 ? (tColl/tRev*100) : 0;
  const tExpRate = tRev > 0 ? (tExp/tRev*100) : 0;
  const tNet = tRev - tExp;
  const tPM = tRev > 0 ? (tNet/tRev*100) : 0;
  const cmpOff = mY ? 1 : 0;
  tbl.innerHTML = `<thead><tr><th>الشركة / مركز / شريك</th>${mY?'<th>السنة</th>':''}<th class="n sortable" data-col-idx="${1+cmpOff}">الإيرادات</th><th class="n sortable" data-col-idx="${2+cmpOff}">المصروفات</th><th class="n sortable" data-col-idx="${3+cmpOff}">% مصروفات</th><th class="n sortable" data-col-idx="${4+cmpOff}">المحصّل</th><th class="n sortable" data-col-idx="${5+cmpOff}">المتبقي</th><th class="n sortable" data-col-idx="${6+cmpOff}">% تحصيل</th><th class="n sortable" data-col-idx="${7+cmpOff}">صافي الربح</th><th class="n sortable" data-col-idx="${8+cmpOff}">% ربح</th></tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr><td>المجموع</td>${mY?'<td></td>':''}<td class="n" style="color:#10b981;">${fmt(tRev)}</td><td class="n" style="color:#ef4444;">${fmt(tExp)}</td><td class="n" style="color:#ef4444;">${fmtP(tExpRate)}</td><td class="n" style="color:#06b6d4;">${fmt(tColl)}</td><td class="n" style="color:#f59e0b;">${fmt(tRem)}</td><td class="n" style="color:${tCollRate>=70?'#10b981':'#f59e0b'};">${fmtP(tCollRate)}</td><td class="n" style="color:${tNet>=0?'#10b981':'#ef4444'};">${fmt(tNet)}</td><td class="n" style="color:${tPM>=0?'#10b981':'#ef4444'};">${fmtP(tPM)}</td></tr></tfoot>`;
  bindToggle(tbl);
  bindSortableHeaders(tbl);
}

// ===== TAB: DETAILS =====
function renderDetails(body, d, gt, yrs, yd, comps, multiCo, multiYear) {
  // Use grandTotals (now unified from accountTree on server)
  const dtRev = gt.revenue, dtExp = gt.expenses;
  const dtNet = gt.netIncome;
  const dtMargin = gt.profitMargin;
  const dtExpRatio = gt.expenseRatio;
  let dtCcCount = 0;
  for (const yr of yrs) { for (const co of (yd[yr]?.companies||[])) { dtCcCount += (co.accountTree || []).length; }}
  body.innerHTML = `
    <div class="bi-kpi-row" style="grid-template-columns:repeat(4,1fr);">
      <div class="bi-kpi"><div class="bi-kpi-label">\u{1F4B0} \u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a</div><div class="bi-kpi-value" style="color:#10b981;">${fmt(dtRev)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">\u{1F4E4} \u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062a</div><div class="bi-kpi-value" style="color:#ef4444;">${fmt(dtExp)}</div><div class="bi-kpi-sub">${fmtP(dtExpRatio)} \u0645\u0646 \u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">\u{1F4C8} \u0635\u0627\u0641\u064a \u0627\u0644\u0631\u0628\u062d</div><div class="bi-kpi-value" style="color:${dtNet>=0?'#10b981':'#ef4444'};">${fmt(dtNet)}</div><div class="bi-kpi-sub">\u0647\u0627\u0645\u0634 ${fmtP(dtMargin)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">\u{1F4CA} \u0645\u0631\u0627\u0643\u0632 \u0627\u0644\u062a\u0643\u0644\u0641\u0629</div><div class="bi-kpi-value" style="color:#8b5cf6;">${dtCcCount}</div></div>
    </div>
    <div class="bi-card bi-full">
      <div class="bi-card-title">\u{1F4D1} \u062a\u0641\u0627\u0635\u064a\u0644 \u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a \u0648\u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062a \u062d\u0633\u0628 \u0627\u0644\u062d\u0633\u0627\u0628 \u0627\u0644\u0645\u0627\u0644\u064a</div>
      <div style="overflow-x:auto;"><table class="bi-table" id="tbl-details"></table></div>
    </div>
  `;
  requestAnimationFrame(() => fillAccountTable(document.getElementById('tbl-details'), d));
}

function fillAccountTable(tbl, d) {
  if (!tbl) return;
  const yrs = d.years, yd = d.yearlyData;

  // Aggregate accountTree across all selected years per company
  const companyMap = new Map(); // companyId -> { name, ccMap }
  yrs.forEach(yr => {
    (yd[yr]?.companies || []).forEach(c => {
      let entry = companyMap.get(c.companyId);
      if (!entry) {
        entry = { name: c.companyName, id: c.companyId, ccMap: new Map() };
        companyMap.set(c.companyId, entry);
      }

      (c.accountTree || []).forEach(cc => {
        let ccEntry = entry.ccMap.get(cc.name);
        if (!ccEntry) {
          ccEntry = { name: cc.name, revenue:0, expenses:0, netIncome:0, accMap: new Map() };
          entry.ccMap.set(cc.name, ccEntry);
        }
        ccEntry.revenue += cc.revenue || 0;
        ccEntry.expenses += cc.expenses || 0;
        ccEntry.netIncome += cc.netIncome || 0;

        (cc.accounts || []).forEach(a => {
          const key = a.code + '|' + a.type;
          let aEntry = ccEntry.accMap.get(key);
          if (!aEntry) {
            aEntry = { code: a.code, name: a.name, type: a.type, amount: 0 };
            ccEntry.accMap.set(key, aEntry);
          }
          aEntry.amount += a.amount || 0;
        });
      });
    });
  });

  // Compute company kpis from accountTree data for perfect consistency
  companyMap.forEach(e => {
    let rev = 0, exp = 0;
    e.ccMap.forEach(cc => { rev += cc.revenue; exp += cc.expenses; });
    e.kpis = { revenue: rev, expenses: exp, netIncome: rev - exp, profitMargin: rev > 0 ? ((rev - exp) / rev * 100) : 0 };
  });

  // Use accountTree grand totals (already unified on server)
  let totalRev = 0, totalExp = 0;
  companyMap.forEach(e => { totalRev += e.kpis.revenue; totalExp += e.kpis.expenses; });
  const totalNet = totalRev - totalExp;
  const totalMargin = totalRev > 0 ? (totalNet / totalRev * 100) : 0;

  let rows = '', cIdx = 0, ccIdx = 0;
  let coI = 0;
  companyMap.forEach(co => {
    const k = co.kpis;
    const coGid = 'dg' + cIdx++;
    rows += `<tr class="row-co" data-gid="${coGid}"><td style="color:${COLORS[coI % COLORS.length]};font-weight:700;">${co.name}</td><td class="n" style="color:#10b981;">${fmt(k.revenue)}</td><td class="n" style="color:#ef4444;">${fmt(k.expenses)}</td><td class="n" style="color:${k.netIncome>=0?'#10b981':'#ef4444'};">${fmt(k.netIncome)}</td><td class="n" style="color:${k.profitMargin>=0?'#10b981':'#ef4444'};">${fmtP(k.profitMargin)}</td></tr>`;
    coI++;
    co.ccMap.forEach(cc => {
      const ccGid = 'dc' + ccIdx++;
      const ccMargin = cc.revenue > 0 ? (cc.netIncome / cc.revenue * 100) : 0;
      rows += `<tr class="row-cc" data-gid="${ccGid}" data-pgid="${coGid}"><td>${cc.name.length>28?cc.name.substring(0,28)+'\u2026':cc.name}</td><td class="n">${fmt(cc.revenue)}</td><td class="n">${fmt(cc.expenses)}</td><td class="n" style="color:${cc.netIncome>=0?'#10b981':'#ef4444'};">${fmt(cc.netIncome)}</td><td class="n" style="color:${ccMargin>=0?'#10b981':'#ef4444'};">${fmtP(ccMargin)}</td></tr>`;
      cc.accMap.forEach(a => {
        const isInc = a.type === 'income';
        rows += `<tr class="row-pt" data-pgid="${ccGid}"><td>${a.code} - ${a.name.length>22?a.name.substring(0,22)+'\u2026':a.name}</td><td class="n" style="color:${isInc?'#10b981':'transparent'};">${isInc?fmt(a.amount):''}</td><td class="n" style="color:${!isInc?'#ef4444':'transparent'};">${!isInc?fmt(a.amount):''}</td><td class="n" style="color:rgba(255,255,255,0.3);">${isInc?'\u0625\u064a\u0631\u0627\u062f':'\u0645\u0635\u0631\u0648\u0641'}</td><td class="n">${fmt(Math.abs(a.amount))}</td></tr>`;
      });
    });
  });

  tbl.innerHTML = `<thead><tr><th>\u0627\u0644\u0634\u0631\u0643\u0629 / \u0645\u0631\u0643\u0632 / \u062d\u0633\u0627\u0628</th><th class="n sortable" data-col-idx="1">\u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a</th><th class="n sortable" data-col-idx="2">\u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062a</th><th class="n sortable" data-col-idx="3">\u0635\u0627\u0641\u064a \u0627\u0644\u0631\u0628\u062d</th><th class="n sortable" data-col-idx="4">% \u0631\u0628\u062d</th></tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr><td>\u0627\u0644\u0645\u062c\u0645\u0648\u0639</td><td class="n" style="color:#10b981;">${fmt(totalRev)}</td><td class="n" style="color:#ef4444;">${fmt(totalExp)}</td><td class="n" style="color:${totalNet>=0?'#10b981':'#ef4444'};">${fmt(totalNet)}</td><td class="n" style="color:${totalMargin>=0?'#10b981':'#ef4444'};">${fmtP(totalMargin)}</td></tr></tfoot>`;
  bindToggle(tbl);
  bindSortableHeaders(tbl);
}

// ===== PIVOT HELPERS =====

function aggregatePivotData(d) {
  const allRows = [];
  const yrs = d.years, yd = d.yearlyData;
  yrs.forEach(yr => { (yd[yr]?.companies || []).forEach(c => { (c.pivotData || []).forEach(r => allRows.push(r)); }); });
  return allRows;
}

// ===== TAB: PIVOT - ACCOUNTS =====
function renderPivotAcc(body, d) {
  const gt = d.grandTotals;
  const raw = aggregatePivotData(d);
  // Count unique accounts
  const uniqAcc = new Set(raw.map(r => r.account_code));
  body.innerHTML = `
    <div class="bi-kpi-row" style="grid-template-columns:repeat(4,1fr);">
      <div class="bi-kpi"><div class="bi-kpi-label">\u{1F4B0} \u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a</div><div class="bi-kpi-value" style="color:#10b981;">${fmt(gt.revenue)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">\u{1F4E4} \u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062a</div><div class="bi-kpi-value" style="color:#ef4444;">${fmt(gt.expenses)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">\u{1F4C8} \u0635\u0627\u0641\u064a \u0627\u0644\u0631\u0628\u062d</div><div class="bi-kpi-value" style="color:${gt.netIncome>=0?'#10b981':'#ef4444'};">${fmt(gt.netIncome)}</div><div class="bi-kpi-sub">\u0647\u0627\u0645\u0634 ${fmtP(gt.profitMargin)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">\u{1F4CB} \u0639\u062f\u062f \u0627\u0644\u062d\u0633\u0627\u0628\u0627\u062a</div><div class="bi-kpi-value" style="color:#8b5cf6;">${uniqAcc.size}</div></div>
    </div>
    <div class="bi-card bi-full">
      <div class="bi-card-title">\u{1F4CA} \u0627\u0644\u062a\u0642\u0631\u064a\u0631 \u0627\u0644\u062a\u0642\u0627\u0637\u0639\u064a \u2014 \u062d\u0633\u0628 \u0627\u0644\u062d\u0633\u0627\u0628 \u0627\u0644\u0645\u0627\u0644\u064a</div>
      <div style="overflow-x:auto;"><table class="bi-table" id="tbl-pivot-acc" style="font-size:1rem;"></table></div>
    </div>`;
  requestAnimationFrame(() => fillPivotAccTable(document.getElementById('tbl-pivot-acc'), d));
}

function fillPivotAccTable(tbl, d) {
  if (!tbl) return;
  const rows = aggregatePivotData(d);
  const accMap = new Map();
  for (const r of rows) {
    let e = accMap.get(r.account_code);
    if (!e) { e = { code: r.account_code, name: r.account_name, type: r.account_type, m: {} }; accMap.set(r.account_code, e); }
    if (!e.m[r.month]) e.m[r.month] = { rev: 0, exp: 0 };
    e.m[r.month].rev += r.revenue || 0;
    e.m[r.month].exp += r.expenses || 0;
  }
  const mths = [1,2,3,4,5,6,7,8,9,10,11,12];
  const sepBdr = 'border-right:2px solid rgba(139,92,246,0.3);';
  // Headers: Account | TOTALS (3 cols) | separator | months...
  let hdr = '<th style="position:sticky;right:0;z-index:2;background:var(--bg-dark);">\u0627\u0644\u062d\u0633\u0627\u0628</th>';
  hdr += `<th colspan="3" class="n" style="color:#a78bfa;font-size:0.95rem;${sepBdr}">\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a</th>`;
  mths.forEach(m => { hdr += `<th colspan="3" class="n" style="font-size:0.88rem;color:rgba(255,255,255,0.55);">${MONTH_NAMES[m-1]}</th>`; });
  let subH = '<th></th>';
  subH += `<th class="n sortable" data-col-idx="1" style="color:#10b981;font-size:0.85rem;">\u0625\u064a\u0631\u0627\u062f</th><th class="n sortable" data-col-idx="2" style="color:#ef4444;font-size:0.85rem;">\u0645\u0635\u0631\u0648\u0641</th><th class="n sortable" data-col-idx="3" style="color:#3b82f6;font-size:0.85rem;${sepBdr}">\u0635\u0627\u0641\u064a</th>`;
  mths.forEach((m, mi) => { const base = 4 + mi * 3; subH += `<th class="n sortable" data-col-idx="${base}" style="color:#10b981;font-size:0.82rem;">\u0625\u064a\u0631\u0627\u062f</th><th class="n sortable" data-col-idx="${base+1}" style="color:#ef4444;font-size:0.82rem;">\u0645\u0635\u0631\u0648\u0641</th><th class="n sortable" data-col-idx="${base+2}" style="color:#3b82f6;font-size:0.82rem;">\u0635\u0627\u0641\u064a</th>`; });

  let bdy = '', totM = {};
  accMap.forEach(a => {
    const isInc = a.type?.includes('income');
    let tRev = 0, tExp = 0;
    // Compute totals first
    mths.forEach(m => { const v = a.m[m] || { rev:0, exp:0 }; tRev += v.rev; tExp += v.exp; if(!totM[m]) totM[m]={rev:0,exp:0}; totM[m].rev+=v.rev; totM[m].exp+=v.exp; });
    let r = `<td style="position:sticky;right:0;background:var(--bg-card);white-space:nowrap;font-weight:600;color:${isInc?'#10b981':'#ef4444'};">${a.code} ${a.name.length>22?a.name.substring(0,22)+'\u2026':a.name}</td>`;
    r += `<td class="n" style="color:#10b981;font-weight:800;">${fmt(tRev)}</td><td class="n" style="color:#ef4444;font-weight:800;">${fmt(tExp)}</td><td class="n" style="color:${tRev-tExp>=0?'#3b82f6':'#f59e0b'};font-weight:800;${sepBdr}">${fmt(tRev-tExp)}</td>`;
    mths.forEach(m => {
      const v = a.m[m] || { rev:0, exp:0 }; const net = v.rev - v.exp;
      r += `<td class="n" style="color:#10b981;">${v.rev?fmt(v.rev):''}</td><td class="n" style="color:#ef4444;">${v.exp?fmt(v.exp):''}</td><td class="n" style="color:${net>=0?'#3b82f6':'#f59e0b'};">${(v.rev||v.exp)?fmt(net):''}</td>`;
    });
    bdy += `<tr>${r}</tr>`;
  });
  // Totals row
  let gRev = 0, gExp = 0;
  let tRow = '<td style="font-weight:800;">\u0627\u0644\u0645\u062c\u0645\u0648\u0639</td>';
  mths.forEach(m => { const v = totM[m]||{rev:0,exp:0}; gRev+=v.rev; gExp+=v.exp; });
  tRow += `<td class="n" style="color:#10b981;font-weight:800;">${fmt(gRev)}</td><td class="n" style="color:#ef4444;font-weight:800;">${fmt(gExp)}</td><td class="n" style="color:${gRev-gExp>=0?'#3b82f6':'#f59e0b'};font-weight:800;${sepBdr}">${fmt(gRev-gExp)}</td>`;
  mths.forEach(m => {
    const v = totM[m]||{rev:0,exp:0}; const net = v.rev-v.exp;
    tRow += `<td class="n" style="color:#10b981;font-weight:700;">${fmt(v.rev)}</td><td class="n" style="color:#ef4444;font-weight:700;">${fmt(v.exp)}</td><td class="n" style="color:${net>=0?'#3b82f6':'#f59e0b'};font-weight:700;">${fmt(net)}</td>`;
  });
  tbl.innerHTML = `<thead><tr>${hdr}</tr><tr>${subH}</tr></thead><tbody>${bdy}</tbody><tfoot><tr>${tRow}</tr></tfoot>`;
  bindSortableHeaders(tbl);
}

// ===== TAB: PIVOT - COST CENTERS =====
function renderPivotCC(body, d) {
  const gt = d.grandTotals;
  const raw = aggregatePivotData(d);
  const uniqCC = new Set(raw.map(r => r.cc));
  body.innerHTML = `
    <div class="bi-kpi-row" style="grid-template-columns:repeat(4,1fr);">
      <div class="bi-kpi"><div class="bi-kpi-label">\u{1F4B0} \u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a</div><div class="bi-kpi-value" style="color:#10b981;">${fmt(gt.revenue)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">\u{1F4E4} \u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062a</div><div class="bi-kpi-value" style="color:#ef4444;">${fmt(gt.expenses)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">\u{1F4C8} \u0635\u0627\u0641\u064a \u0627\u0644\u0631\u0628\u062d</div><div class="bi-kpi-value" style="color:${gt.netIncome>=0?'#10b981':'#ef4444'};">${fmt(gt.netIncome)}</div><div class="bi-kpi-sub">\u0647\u0627\u0645\u0634 ${fmtP(gt.profitMargin)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">\u{1F3E2} \u0639\u062f\u062f \u0627\u0644\u0645\u0631\u0627\u0643\u0632</div><div class="bi-kpi-value" style="color:#8b5cf6;">${uniqCC.size}</div></div>
    </div>
    <div class="bi-card bi-full">
      <div class="bi-card-title">\u{1F4CA} \u0627\u0644\u062a\u0642\u0631\u064a\u0631 \u0627\u0644\u062a\u0642\u0627\u0637\u0639\u064a \u2014 \u062d\u0633\u0628 \u0645\u0631\u0643\u0632 \u0627\u0644\u062a\u0643\u0644\u0641\u0629</div>
      <div style="overflow-x:auto;"><table class="bi-table" id="tbl-pivot-cc" style="font-size:1rem;"></table></div>
    </div>`;
  requestAnimationFrame(() => fillPivotCCTable(document.getElementById('tbl-pivot-cc'), d));
}

function fillPivotCCTable(tbl, d) {
  if (!tbl) return;
  const rawRows = aggregatePivotData(d);
  const ccMap = new Map();
  for (const r of rawRows) {
    let cc = ccMap.get(r.cc);
    if (!cc) { cc = { name: r.cc, accMap: new Map(), m: {} }; ccMap.set(r.cc, cc); }
    let acc = cc.accMap.get(r.account_code);
    if (!acc) { acc = { code: r.account_code, name: r.account_name, type: r.account_type, m: {} }; cc.accMap.set(r.account_code, acc); }
    if (!acc.m[r.month]) acc.m[r.month] = { rev: 0, exp: 0 };
    acc.m[r.month].rev += r.revenue || 0;
    acc.m[r.month].exp += r.expenses || 0;
    if (!cc.m[r.month]) cc.m[r.month] = { rev: 0, exp: 0 };
    cc.m[r.month].rev += r.revenue || 0;
    cc.m[r.month].exp += r.expenses || 0;
  }
  const mths = [1,2,3,4,5,6,7,8,9,10,11,12];
  const sepBdr = 'border-right:2px solid rgba(139,92,246,0.3);';
  // Headers: Name | TOTALS | months
  let hdr = '<th style="position:sticky;right:0;z-index:2;background:var(--bg-dark);">\u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629 / \u0627\u0644\u0645\u0631\u0643\u0632 / \u062d\u0633\u0627\u0628</th>';
  hdr += `<th colspan="3" class="n" style="color:#a78bfa;font-size:0.95rem;${sepBdr}">\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a</th>`;
  mths.forEach(m => { hdr += `<th colspan="3" class="n" style="font-size:0.88rem;color:rgba(255,255,255,0.55);">${MONTH_NAMES[m-1]}</th>`; });
  let subH = '<th></th>';
  subH += `<th class="n sortable" data-col-idx="1" style="color:#10b981;font-size:0.85rem;">\u0625\u064a\u0631\u0627\u062f</th><th class="n sortable" data-col-idx="2" style="color:#ef4444;font-size:0.85rem;">\u0645\u0635\u0631\u0648\u0641</th><th class="n sortable" data-col-idx="3" style="color:#3b82f6;font-size:0.85rem;${sepBdr}">\u0635\u0627\u0641\u064a</th>`;
  mths.forEach((m, mi) => { const base = 4 + mi * 3; subH += `<th class="n sortable" data-col-idx="${base}" style="color:#10b981;font-size:0.82rem;">\u0625\u064a\u0631\u0627\u062f</th><th class="n sortable" data-col-idx="${base+1}" style="color:#ef4444;font-size:0.82rem;">\u0645\u0635\u0631\u0648\u0641</th><th class="n sortable" data-col-idx="${base+2}" style="color:#3b82f6;font-size:0.82rem;">\u0635\u0627\u0641\u064a</th>`; });

  // Group cost centers by analytic group
  const groupMap = new Map(); // groupId -> { name, color, ccs: [ccName, ...] }
  const ungrouped = []; // cc names without a group
  ccMap.forEach((cc, ccName) => {
    const trimmedName = ccName.trim();
    const groupId = analyticGroupMappings[trimmedName] || analyticGroupMappings[ccName];
    const group = groupId ? analyticGroups.find(g => String(g.id) === String(groupId)) : null;
    if (group) {
      let grp = groupMap.get(group.id);
      if (!grp) { grp = { name: group.name, color: group.color || '#f59e0b', ccs: [] }; groupMap.set(group.id, grp); }
      grp.ccs.push(ccName);
    } else {
      ungrouped.push(ccName);
    }
  });

  let bdy = '', gIdx = 0, ccIdx = 0, totM = {};

  // Helper to build month cells
  function buildMonthCells(mData) {
    let cells = '';
    let tRev = 0, tExp = 0;
    mths.forEach(m => { const v = mData[m] || {rev:0,exp:0}; tRev += v.rev; tExp += v.exp; if(!totM[m]) totM[m]={rev:0,exp:0}; });
    cells += `<td class="n" style="color:#10b981;font-weight:800;">${fmt(tRev)}</td><td class="n" style="color:#ef4444;font-weight:800;">${fmt(tExp)}</td><td class="n" style="color:${tRev-tExp>=0?'#3b82f6':'#f59e0b'};font-weight:800;${sepBdr}">${fmt(tRev-tExp)}</td>`;
    mths.forEach(m => {
      const v = mData[m] || {rev:0,exp:0}; const net = v.rev - v.exp;
      cells += `<td class="n" style="color:#10b981;">${v.rev?fmt(v.rev):''}</td><td class="n" style="color:#ef4444;">${v.exp?fmt(v.exp):''}</td><td class="n" style="color:${net>=0?'#3b82f6':'#f59e0b'};">${(v.rev||v.exp)?fmt(net):''}</td>`;
    });
    return cells;
  }

  // Helper to aggregate month data from multiple cost centers
  function aggregateMonths(ccNames) {
    const agg = {};
    ccNames.forEach(cn => {
      const cc = ccMap.get(cn);
      if (!cc) return;
      mths.forEach(m => {
        const v = cc.m[m] || {rev:0,exp:0};
        if (!agg[m]) agg[m] = {rev:0,exp:0};
        agg[m].rev += v.rev;
        agg[m].exp += v.exp;
      });
    });
    return agg;
  }

  // Render grouped cost centers
  groupMap.forEach((grp, groupId) => {
    const grpGid = 'grpg' + gIdx++;
    const grpMonths = aggregateMonths(grp.ccs);
    let grpRev = 0, grpExp = 0;
    mths.forEach(m => { const v = grpMonths[m]||{rev:0,exp:0}; grpRev+=v.rev; grpExp+=v.exp; });
    // Accumulate into grand totals
    mths.forEach(m => { const v = grpMonths[m]||{rev:0,exp:0}; if(!totM[m]) totM[m]={rev:0,exp:0}; totM[m].rev+=v.rev; totM[m].exp+=v.exp; });

    // Group row (row-co)
    let gr = `<td style="position:sticky;right:0;background:var(--bg-card);font-weight:800;color:${grp.color};">${grp.name}</td>`;
    gr += `<td class="n" style="color:#10b981;font-weight:800;">${fmt(grpRev)}</td><td class="n" style="color:#ef4444;font-weight:800;">${fmt(grpExp)}</td><td class="n" style="color:${grpRev-grpExp>=0?'#3b82f6':'#f59e0b'};font-weight:800;${sepBdr}">${fmt(grpRev-grpExp)}</td>`;
    mths.forEach(m => {
      const v = grpMonths[m]||{rev:0,exp:0}; const net = v.rev-v.exp;
      gr += `<td class="n" style="color:#10b981;">${v.rev?fmt(v.rev):''}</td><td class="n" style="color:#ef4444;">${v.exp?fmt(v.exp):''}</td><td class="n" style="color:${net>=0?'#3b82f6':'#f59e0b'};">${(v.rev||v.exp)?fmt(net):''}</td>`;
    });
    bdy += `<tr class="row-co" data-gid="${grpGid}">${gr}</tr>`;

    // Cost center rows (row-cc) under this group
    grp.ccs.forEach(ccName => {
      const cc = ccMap.get(ccName);
      if (!cc) return;
      const ccGid = 'pcc' + ccIdx++;
      let ccRev = 0, ccExp = 0;
      mths.forEach(m => { const v = cc.m[m]||{rev:0,exp:0}; ccRev+=v.rev; ccExp+=v.exp; });
      let cr = `<td style="position:sticky;right:0;background:var(--bg-card);font-weight:700;color:#8b5cf6;">${cc.name.length>28?cc.name.substring(0,28)+'\u2026':cc.name}</td>`;
      cr += `<td class="n" style="color:#10b981;font-weight:700;">${fmt(ccRev)}</td><td class="n" style="color:#ef4444;font-weight:700;">${fmt(ccExp)}</td><td class="n" style="color:${ccRev-ccExp>=0?'#3b82f6':'#f59e0b'};font-weight:700;${sepBdr}">${fmt(ccRev-ccExp)}</td>`;
      mths.forEach(m => {
        const v = cc.m[m]||{rev:0,exp:0}; const net = v.rev-v.exp;
        cr += `<td class="n" style="color:#10b981;">${v.rev?fmt(v.rev):''}</td><td class="n" style="color:#ef4444;">${v.exp?fmt(v.exp):''}</td><td class="n" style="color:${net>=0?'#3b82f6':'#f59e0b'};">${(v.rev||v.exp)?fmt(net):''}</td>`;
      });
      bdy += `<tr class="row-cc" data-gid="${ccGid}" data-pgid="${grpGid}">${cr}</tr>`;

      // Account rows (row-pt)
      cc.accMap.forEach(a => {
        const isInc = a.type?.includes('income');
        let aRev = 0, aExp = 0;
        mths.forEach(m => { const v = a.m[m]||{rev:0,exp:0}; aRev+=v.rev; aExp+=v.exp; });
        let ar = `<td style="position:sticky;right:0;background:var(--bg-card);padding-right:52px;color:${isInc?'#10b981':'#ef4444'};">${a.code} ${a.name.length>20?a.name.substring(0,20)+'\u2026':a.name}</td>`;
        ar += `<td class="n" style="color:#10b981;">${fmt(aRev)}</td><td class="n" style="color:#ef4444;">${fmt(aExp)}</td><td class="n" style="color:${aRev-aExp>=0?'#3b82f6':'#f59e0b'};${sepBdr}">${fmt(aRev-aExp)}</td>`;
        mths.forEach(m => {
          const v = a.m[m]||{rev:0,exp:0}; const net = v.rev-v.exp;
          ar += `<td class="n" style="color:#10b981;">${v.rev?fmt(v.rev):''}</td><td class="n" style="color:#ef4444;">${v.exp?fmt(v.exp):''}</td><td class="n" style="color:${net>=0?'#3b82f6':'#f59e0b'};">${(v.rev||v.exp)?fmt(net):''}</td>`;
        });
        bdy += `<tr class="row-pt" data-pgid="${ccGid}">${ar}</tr>`;
      });
    });
  });

  // Render ungrouped cost centers (no group) — each as row-co with row-pt children
  ungrouped.forEach(ccName => {
    const cc = ccMap.get(ccName);
    if (!cc) return;
    const ccGid = 'pug' + gIdx++;
    let ccRev = 0, ccExp = 0;
    mths.forEach(m => { const v = cc.m[m]||{rev:0,exp:0}; ccRev+=v.rev; ccExp+=v.exp; if(!totM[m]) totM[m]={rev:0,exp:0}; totM[m].rev+=v.rev; totM[m].exp+=v.exp; });
    let r = `<td style="position:sticky;right:0;background:var(--bg-card);font-weight:700;color:#8b5cf6;">${cc.name.length>28?cc.name.substring(0,28)+'\u2026':cc.name}</td>`;
    r += `<td class="n" style="color:#10b981;font-weight:800;">${fmt(ccRev)}</td><td class="n" style="color:#ef4444;font-weight:800;">${fmt(ccExp)}</td><td class="n" style="color:${ccRev-ccExp>=0?'#3b82f6':'#f59e0b'};font-weight:800;${sepBdr}">${fmt(ccRev-ccExp)}</td>`;
    mths.forEach(m => {
      const v = cc.m[m]||{rev:0,exp:0}; const net = v.rev-v.exp;
      r += `<td class="n" style="color:#10b981;">${v.rev?fmt(v.rev):''}</td><td class="n" style="color:#ef4444;">${v.exp?fmt(v.exp):''}</td><td class="n" style="color:${net>=0?'#3b82f6':'#f59e0b'};">${(v.rev||v.exp)?fmt(net):''}</td>`;
    });
    bdy += `<tr class="row-co" data-gid="${ccGid}">${r}</tr>`;
    // Account child rows
    cc.accMap.forEach(a => {
      const isInc = a.type?.includes('income');
      let aRev = 0, aExp = 0;
      mths.forEach(m => { const v = a.m[m]||{rev:0,exp:0}; aRev+=v.rev; aExp+=v.exp; });
      let ar = `<td style="position:sticky;right:0;background:var(--bg-card);padding-right:30px;color:${isInc?'#10b981':'#ef4444'};">${a.code} ${a.name.length>20?a.name.substring(0,20)+'\u2026':a.name}</td>`;
      ar += `<td class="n" style="color:#10b981;">${fmt(aRev)}</td><td class="n" style="color:#ef4444;">${fmt(aExp)}</td><td class="n" style="color:${aRev-aExp>=0?'#3b82f6':'#f59e0b'};${sepBdr}">${fmt(aRev-aExp)}</td>`;
      mths.forEach(m => {
        const v = a.m[m]||{rev:0,exp:0}; const net = v.rev-v.exp;
        ar += `<td class="n" style="color:#10b981;">${v.rev?fmt(v.rev):''}</td><td class="n" style="color:#ef4444;">${v.exp?fmt(v.exp):''}</td><td class="n" style="color:${net>=0?'#3b82f6':'#f59e0b'};">${(v.rev||v.exp)?fmt(net):''}</td>`;
      });
      bdy += `<tr class="row-pt" data-pgid="${ccGid}">${ar}</tr>`;
    });
  });

  // Totals
  let gRev = 0, gExp = 0;
  let tRow = '<td style="position:sticky;right:0;background:var(--bg-dark);font-weight:800;">\u0627\u0644\u0645\u062c\u0645\u0648\u0639</td>';
  mths.forEach(m => { const v = totM[m]||{rev:0,exp:0}; gRev+=v.rev; gExp+=v.exp; });
  tRow += `<td class="n" style="color:#10b981;font-weight:800;">${fmt(gRev)}</td><td class="n" style="color:#ef4444;font-weight:800;">${fmt(gExp)}</td><td class="n" style="color:${gRev-gExp>=0?'#3b82f6':'#f59e0b'};font-weight:800;${sepBdr}">${fmt(gRev-gExp)}</td>`;
  mths.forEach(m => {
    const v = totM[m]||{rev:0,exp:0}; const net = v.rev-v.exp;
    tRow += `<td class="n" style="color:#10b981;font-weight:700;">${fmt(v.rev)}</td><td class="n" style="color:#ef4444;font-weight:700;">${fmt(v.exp)}</td><td class="n" style="color:${net>=0?'#3b82f6':'#f59e0b'};font-weight:700;">${fmt(net)}</td>`;
  });
  tbl.innerHTML = `<thead><tr>${hdr}</tr><tr>${subH}</tr></thead><tbody>${bdy}</tbody><tfoot><tr>${tRow}</tr></tfoot>`;
  bindToggle(tbl);
  bindSortableHeaders(tbl);
}

function fillYoYTable(tbl, d) {
  if (!tbl) return;
  const yrs = d.years, yd = d.yearlyData;
  tbl.innerHTML = `<thead><tr><th>السنة</th><th class="n sortable" data-col-idx="1">الإيرادات</th><th class="n sortable" data-col-idx="2">المصروفات</th><th class="n sortable" data-col-idx="3">صافي الربح</th><th class="n sortable" data-col-idx="4">% ربح</th><th class="n sortable" data-col-idx="5">المحصّل</th><th class="n sortable" data-col-idx="6">المتبقي</th><th class="n sortable" data-col-idx="7">% تحصيل</th><th class="n sortable" data-col-idx="8">الأصول</th><th class="n sortable" data-col-idx="9">الالتزامات</th></tr></thead>
  <tbody>${yrs.map((yr,i) => { const t = yd[yr].totals; const co = t.collected||0; const cp = t.collectionRate||0; return `<tr>
  <td style="color:${YR_COLORS[i%YR_COLORS.length]};font-family:var(--font-en);font-weight:800;font-size:0.9rem;">${yr}</td>
  <td class="n" style="color:#10b981;">${fmt(t.revenue)}</td><td class="n" style="color:#ef4444;">${fmt(t.expenses)}</td>
  <td class="n" style="color:${t.netIncome>=0?'#10b981':'#ef4444'};">${fmt(t.netIncome)}</td><td class="n" style="color:${t.profitMargin>=0?'#10b981':'#ef4444'};">${fmtP(t.profitMargin)}</td>
  <td class="n" style="color:#06b6d4;">${fmt(co)}</td><td class="n" style="color:#f59e0b;">${fmt(t.remaining||0)}</td>
  <td class="n" style="color:${cp>=70?'#10b981':'#f59e0b'};">${fmtP(cp)}</td>
  <td class="n" style="color:#3b82f6;">${fmt(t.assets)}</td><td class="n" style="color:#ef4444;">${fmt(t.liabilities)}</td></tr>`; }).join('')}</tbody>`;
  bindSortableHeaders(tbl);
}

function fillBalanceTable(tbl, d) {
  if (!tbl) return;
  const yrs = d.years, yd = d.yearlyData, gt = d.grandTotals, mY = yrs.length > 1;
  const rows = [];
  yrs.forEach(yr => { (yd[yr]?.companies || []).forEach((c, i) => { const k = c.kpis;
    rows.push({ l: c.companyName, yr, col: COLORS[i % COLORS.length], assets: k.assets, liabilities: k.liabilities, equity: k.equity, cash: k.cash, recv: k.receivables, pay: k.payables }); }); });
  const balOff = mY ? 1 : 0;
  tbl.innerHTML = `<thead><tr><th>الشركة</th>${mY?'<th>السنة</th>':''}<th class="n sortable" data-col-idx="${1+balOff}">الأصول</th><th class="n sortable" data-col-idx="${2+balOff}">الالتزامات</th><th class="n sortable" data-col-idx="${3+balOff}">حقوق الملكية</th><th class="n sortable" data-col-idx="${4+balOff}">النقدية</th><th class="n sortable" data-col-idx="${5+balOff}">ذمم مدينة</th><th class="n sortable" data-col-idx="${6+balOff}">ذمم دائنة</th></tr></thead>
  <tbody>${rows.map(r=>`<tr><td style="color:${r.col};font-weight:700;">${r.l}</td>${mY?`<td style="font-family:var(--font-en);color:rgba(255,255,255,0.5);">${r.yr}</td>`:''}<td class="n" style="color:#3b82f6;">${fmt(r.assets)}</td><td class="n" style="color:#ef4444;">${fmt(r.liabilities)}</td><td class="n" style="color:#10b981;">${fmt(r.equity)}</td><td class="n" style="color:#06b6d4;">${fmt(r.cash)}</td><td class="n" style="color:#f59e0b;">${fmt(r.recv)}</td><td class="n" style="color:#8b5cf6;">${fmt(r.pay)}</td></tr>`).join('')}</tbody>
  <tfoot><tr><td>المجموع</td>${mY?'<td></td>':''}<td class="n" style="color:#3b82f6;">${fmt(gt.assets)}</td><td class="n" style="color:#ef4444;">${fmt(gt.liabilities)}</td><td class="n" style="color:#10b981;">${fmt(gt.equity)}</td><td class="n" style="color:#06b6d4;">${fmt(gt.cash)}</td><td class="n" style="color:#f59e0b;">${fmt(gt.receivables)}</td><td class="n" style="color:#8b5cf6;">${fmt(gt.payables)}</td></tr></tfoot>`;
}

// ===== SHARING =====
async function shareDashboard(container) {
  if (!dashData) { showToast('لا توجد بيانات', 'error'); return; }
  try {
    const result = await api.createPresentationShare({
      title: `${dashData.years.join('+')} — ${(dashData.yearlyData[dashData.years[0]]?.companies||[]).map(c=>c.companyName).join(' + ')}`,
      companyId: dashData._selectedCos.join(','),
      dateFrom: dashData.years.join(','),
      dateTo: dashData._selectedYrs.join(','),
      speed: 0,
    });
    const url = `${location.origin}/viewer.html?token=${result.token}`;
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
      const url = `${location.origin}/viewer.html?token=${s.token}`;
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

// ===== TAB: REDISTRIBUTION =====
function renderRedistribution(body, d) {
  let redistCCCount = 0;
  for (const cid of Object.keys(redistByCompany)) redistCCCount += redistByCompany[cid].size;

  // Use grandTotals for all KPIs — redistribution only affects expense allocation, not totals
  const yrs = d.years, yd = d.yearlyData;
  const rdRev = d.grandTotals.revenue;
  const rdExp = d.grandTotals.expenses;
  const rdColl = d.grandTotals.collected;
  const rdNet = rdRev - rdExp;
  const rdMargin = rdRev > 0 ? (rdNet / rdRev * 100) : 0;
  const rdRemaining = rdRev - rdColl;
  const rdCollRate = rdRev > 0 ? (rdColl / rdRev * 100) : 0;

  if (redistCCCount === 0) {
    body.innerHTML = '<div class="bi-empty">\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0631\u0627\u0643\u0632 \u062a\u0643\u0644\u0641\u0629 \u0645\u062d\u062f\u062f\u0629 \u0644\u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u062a\u0648\u0632\u064a\u0639.<br><span style="font-size:0.9rem;color:rgba(255,255,255,0.3);">\u062d\u062f\u062f \u0627\u0644\u0645\u0631\u0627\u0643\u0632 \u0627\u0644\u0625\u062f\u0627\u0631\u064a\u0629 \u0645\u0646 \u0635\u0641\u062d\u0629 \u0627\u0644\u062d\u0633\u0627\u0628\u0627\u062a \u0627\u0644\u062a\u062d\u0644\u064a\u0644\u064a\u0629</span></div>';
    return;
  }

  body.innerHTML = `
    <style>
      .bi-table .row-sub{display:none;cursor:pointer;transition:background 0.15s}
      .bi-table .row-sub.show{display:table-row}
      .bi-table .row-sub:hover td{background:rgba(255,255,255,0.025)}
      .bi-table .row-sub td{font-size:0.93rem;color:rgba(255,255,255,0.75);padding:11px 18px}
      .bi-table .row-sub td:first-child{padding-right:44px;font-weight:600}
      .bi-table .row-sub td:first-child::before{content:'\\25B6';margin-left:6px;font-size:0.5rem;transition:transform 0.2s;display:inline-block}
      .bi-table .row-sub.open td:first-child::before{transform:rotate(90deg)}
      .bi-table .row-acct{display:none}
      .bi-table .row-acct.show{display:table-row}
      .bi-table .row-acct td{font-size:0.88rem;color:rgba(255,255,255,0.5);padding:8px 18px}
      .bi-table .row-acct td:first-child{padding-right:64px;font-weight:400}
    </style>
    <div class="bi-kpi-row" style="grid-template-columns:repeat(7,1fr);">
      <div class="bi-kpi"><div class="bi-kpi-label">\u{1F4B0} \u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a</div><div class="bi-kpi-value" style="color:#10b981;">${fmt(rdRev)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">\u{1F4E4} \u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062a</div><div class="bi-kpi-value" style="color:#ef4444;">${fmt(rdExp)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">\u{1F4B5} \u0627\u0644\u0645\u062d\u0635\u0651\u0644</div><div class="bi-kpi-value" style="color:#06b6d4;">${fmt(rdColl)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">\u{1F4CB} \u0627\u0644\u0645\u062a\u0628\u0642\u064a</div><div class="bi-kpi-value" style="color:#f59e0b;">${fmt(rdRemaining)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">\u{1F4CA} % \u062a\u062d\u0635\u064a\u0644</div><div class="bi-kpi-value" style="color:${rdCollRate>=70?'#10b981':'#f59e0b'};">${fmtP(rdCollRate)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">\u{1F504} \u0645\u0631\u0627\u0643\u0632 \u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u062a\u0648\u0632\u064a\u0639</div><div class="bi-kpi-value" style="color:#a78bfa;">${redistCCCount}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">\u{1F4C8} \u0635\u0627\u0641\u064a \u0627\u0644\u0631\u0628\u062d</div><div class="bi-kpi-value" style="color:${rdNet>=0?'#10b981':'#ef4444'};">${fmt(rdNet)}</div><div class="bi-kpi-sub">\u0647\u0627\u0645\u0634 ${fmtP(rdMargin)}</div></div>
    </div>
        <div class="bi-card bi-full">
      <div class="bi-card-title">\u{1F504} \u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u062a\u0648\u0632\u064a\u0639 \u062d\u0633\u0628 \u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a <span style="font-size:0.85rem;color:rgba(255,255,255,0.35);margin-right:8px;">\u0646\u0633\u0628\u0629 \u0648\u062a\u0646\u0627\u0633\u0628</span></div>
      <div style="overflow-x:auto;"><table class="bi-table" id="tbl-redist-rev" style="font-size:1rem;"></table></div>
    </div>
    <div class="bi-card bi-full">
      <div class="bi-card-title">\u{1F504} \u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u062a\u0648\u0632\u064a\u0639 \u062d\u0633\u0628 \u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062a <span style="font-size:0.85rem;color:rgba(255,255,255,0.35);margin-right:8px;">\u0646\u0633\u0628\u0629 \u0648\u062a\u0646\u0627\u0633\u0628</span></div>
      <div style="overflow-x:auto;"><table class="bi-table" id="tbl-redist-exp" style="font-size:1rem;"></table></div>
    </div>`;
  requestAnimationFrame(() => {
    fillRedistTable(document.getElementById('tbl-redist-rev'), d, 'revenue');
    fillRedistTable(document.getElementById('tbl-redist-exp'), d, 'expense');
  });
}

function bindRedistToggle(tbl) {
  tbl.querySelectorAll('.row-co').forEach(row => {
    row.addEventListener('click', () => {
      const gid = row.dataset.gid, open = row.classList.toggle('open');
      const ch = tbl.querySelectorAll(`.row-cc[data-pgid="${gid}"]`);
      ch.forEach(r => r.classList.toggle('show', open));
      if (!open) ch.forEach(cc => { cc.classList.remove('open'); tbl.querySelectorAll(`.row-sub[data-pgid="${cc.dataset.gid}"]`).forEach(s => { s.classList.remove('show','open'); tbl.querySelectorAll(`.row-acct[data-pgid="${s.dataset.gid}"]`).forEach(a => a.classList.remove('show')); }); tbl.querySelectorAll(`.row-pt[data-pgid="${cc.dataset.gid}"]`).forEach(p => p.classList.remove('show')); });
    });
  });
  tbl.querySelectorAll('.row-cc').forEach(row => {
    row.addEventListener('click', (e) => {
      e.stopPropagation(); const gid = row.dataset.gid, open = row.classList.toggle('open');
      tbl.querySelectorAll(`.row-sub[data-pgid="${gid}"]`).forEach(r => r.classList.toggle('show', open));
      tbl.querySelectorAll(`.row-pt[data-pgid="${gid}"]`).forEach(r => r.classList.toggle('show', open));
      if (!open) { tbl.querySelectorAll(`.row-sub[data-pgid="${gid}"]`).forEach(s => { s.classList.remove('open'); tbl.querySelectorAll(`.row-acct[data-pgid="${s.dataset.gid}"]`).forEach(a => a.classList.remove('show')); }); }
    });
  });
  tbl.querySelectorAll('.row-sub').forEach(row => {
    row.addEventListener('click', (e) => {
      e.stopPropagation(); const gid = row.dataset.gid, open = row.classList.toggle('open');
      tbl.querySelectorAll(`.row-acct[data-pgid="${gid}"]`).forEach(r => r.classList.toggle('show', open));
    });
  });
}

function fillRedistTable(tbl, d, method) {
  if (!tbl) return;
  const yrs = d.years, yd = d.yearlyData, multiYear = yrs.length > 1;

  function numCells(rev, origExp, alloc, totalExp, collected, net, margin, bold) {
    const w = bold ? 'font-weight:800;' : '';
    return `<td class="n" style="color:#10b981;${w}">${fmt(rev)}</td>`
      + `<td class="n" style="color:#ef4444;${w}">${fmt(origExp)}</td>`
      + `<td class="n" style="color:#f59e0b;${w}">${alloc > 0 ? fmt(alloc) : '<span style="color:rgba(255,255,255,0.15);">-</span>'}</td>`
      + `<td class="n" style="color:#ef4444;${w}">${fmt(totalExp)}</td>`
      + `<td class="n" style="color:#06b6d4;${w}">${fmt(collected)}</td>`
      + `<td class="n" style="color:#f59e0b;${w}">${fmt(rev - collected)}</td>`
      + `<td class="n" style="color:${rev > 0 ? (collected/rev*100 >= 70 ? '#10b981' : '#f59e0b') : 'rgba(255,255,255,0.3)'};${w}">${rev > 0 ? fmtP(collected/rev*100) : '-'}</td>`
      + `<td class="n" style="color:${net>=0?'#10b981':'#ef4444'};${w}">${fmt(net)}</td>`
      + `<td class="n" style="color:${margin>=0?'#10b981':'#ef4444'};${w}">${fmtP(margin)}</td>`;
  }

  let bdy = '', gi = 0, gri = 0, ci = 0;
  let gRev=0, gOrig=0, gAlloc=0, gTotal=0, gColl=0, gNet=0, gAdmin=0;

  function processCoYear(co, redistSet) {
    let adminExp = 0; const adminCCs = [], targetCCs = [];
    (co.costCenters || []).forEach(cc => {
      if (redistSet.has(cc.name.trim())) { adminExp += cc.expenses || 0; adminCCs.push(cc); }
      else targetCCs.push(cc);
    });
    const accTree = {};
    (co.accountTree || []).forEach(at => { if (!redistSet.has(at.name.trim())) accTree[at.name] = at.accounts || []; });
    let totalBase = 0;
    if (method === 'revenue') targetCCs.forEach(cc => { totalBase += cc.revenue || 0; });
    else targetCCs.forEach(cc => { totalBase += cc.expenses || 0; });
    let allocSum = 0;
    const allocs = targetCCs.map(cc => {
      const base = method === 'revenue' ? (cc.revenue||0) : (cc.expenses||0);
      const ratio = totalBase > 0 ? base / totalBase : (targetCCs.length > 0 ? 1/targetCCs.length : 0);
      const a = adminExp > 0 ? Math.round(adminExp * ratio) : 0;
      allocSum += a; return { cc, a };
    });
    if (adminExp > 0 && allocs.length > 0) {
      const rem = adminExp - allocSum;
      if (rem !== 0) { let mi=0,mb=0; allocs.forEach((x,i) => { const b = method==='revenue'?(x.cc.revenue||0):(x.cc.expenses||0); if(b>mb){mb=b;mi=i;} }); allocs[mi].a += rem; }
    }
    let tR=0,tO=0,tA=0,tT=0,tC=0;
    allocs.forEach(({cc,a}) => { tR+=cc.revenue||0; tO+=cc.expenses||0; tA+=a; tT+=(cc.expenses||0)+a; tC+=cc.collected||0; });
    // Include admin CC revenue in totals (redistribution only affects expenses)
    adminCCs.forEach(cc => { tR += cc.revenue || 0; tC += cc.collected || 0; });
    return { allocs, adminCCs, adminExp, accTree, totals: { rev:tR, orig:tO, alloc:tA, total:tT, coll:tC, net:tR-tT, margin:tR>0?((tR-tT)/tR*100):0 } };
  }

  function renderCCsUnder(parentGid, result, grpClass, ccClass, acctClass) {
    const { allocs, adminCCs, accTree } = result;
    let html = '';
    const grpMap = new Map(), ungrouped = [];
    allocs.forEach(item => {
      const gId = analyticGroupMappings[item.cc.name.trim()];
      const grp = gId ? analyticGroups.find(g => String(g.id)===String(gId)) : null;
      if (grp) { let e = grpMap.get(grp.id); if(!e){e={name:grp.name,color:grp.color||'#f59e0b',items:[]};grpMap.set(grp.id,e);} e.items.push(item); }
      else ungrouped.push(item);
    });
    grpMap.forEach(grp => {
      const gg = 'rgrp'+gri++;
      let gR=0,gO=0,gA=0,gT=0,gC2=0;
      grp.items.forEach(({cc,a})=>{gR+=cc.revenue||0;gO+=cc.expenses||0;gA+=a;gT+=(cc.expenses||0)+a;gC2+=cc.collected||0;});
      const gN=gR-gT, gM2=gR>0?(gN/gR*100):0;
      html+=`<tr class="${grpClass}" data-gid="${gg}" data-pgid="${parentGid}"><td style="font-weight:700;color:${grp.color};">${grp.name}</td>${numCells(gR,gO,gA,gT,gC2,gN,gM2,true)}</tr>`;
      grp.items.forEach(({cc,a}) => {
        const cg='rcc'+ci++, tE=(cc.expenses||0)+a, n=(cc.revenue||0)-tE, m=cc.revenue>0?(n/cc.revenue*100):0;
        html+=`<tr class="${ccClass}" data-gid="${cg}" data-pgid="${gg}"><td>${cc.name.length>28?cc.name.substring(0,28)+'\u2026':cc.name}</td>${numCells(cc.revenue||0,cc.expenses||0,a,tE,cc.collected||0,n,m)}</tr>`;
        (accTree[cc.name]||[]).forEach(ac => {
          const isI=ac.type==='income';
          html+=`<tr class="${acctClass}" data-pgid="${cg}"><td style="color:${isI?'#10b981':'#ef4444'};">${ac.code} ${ac.name.length>20?ac.name.substring(0,20)+'\u2026':ac.name}</td><td class="n" style="color:#10b981;">${isI?fmt(ac.amount):''}</td><td class="n" style="color:#ef4444;">${!isI?fmt(ac.amount):''}</td><td class="n" style="color:rgba(255,255,255,0.15);">-</td><td class="n" style="color:rgba(255,255,255,0.15);">-</td><td class="n" style="color:rgba(255,255,255,0.15);">-</td><td class="n" style="color:rgba(255,255,255,0.15);">-</td><td class="n" style="color:rgba(255,255,255,0.15);">-</td><td class="n" style="color:rgba(255,255,255,0.3);">${isI?'\u0625\u064a\u0631\u0627\u062f':'\u0645\u0635\u0631\u0648\u0641'}</td><td class="n">${fmt(Math.abs(ac.amount))}</td></tr>`;
        });
      });
    });
    ungrouped.forEach(({cc,a}) => {
      const cg='rcc'+ci++, tE=(cc.expenses||0)+a, n=(cc.revenue||0)-tE, m=cc.revenue>0?(n/cc.revenue*100):0;
      html+=`<tr class="${grpClass}" data-gid="${cg}" data-pgid="${parentGid}"><td style="font-weight:600;color:#8b5cf6;">${cc.name.length>28?cc.name.substring(0,28)+'\u2026':cc.name}</td>${numCells(cc.revenue||0,cc.expenses||0,a,tE,cc.collected||0,n,m)}</tr>`;
      (accTree[cc.name]||[]).forEach(ac => {
        const isI=ac.type==='income';
        html+=`<tr class="${acctClass}" data-pgid="${cg}"><td style="color:${isI?'#10b981':'#ef4444'};">${ac.code} ${ac.name.length>20?ac.name.substring(0,20)+'\u2026':ac.name}</td><td class="n" style="color:#10b981;">${isI?fmt(ac.amount):''}</td><td class="n" style="color:#ef4444;">${!isI?fmt(ac.amount):''}</td><td class="n" style="color:rgba(255,255,255,0.15);">-</td><td class="n" style="color:rgba(255,255,255,0.15);">-</td><td class="n" style="color:rgba(255,255,255,0.15);">-</td><td class="n" style="color:rgba(255,255,255,0.15);">-</td><td class="n" style="color:rgba(255,255,255,0.15);">-</td><td class="n" style="color:rgba(255,255,255,0.3);">${isI?'\u0625\u064a\u0631\u0627\u062f':'\u0645\u0635\u0631\u0648\u0641'}</td><td class="n">${fmt(Math.abs(ac.amount))}</td></tr>`;
      });
    });
    if (adminCCs.length > 0) {
      const names = adminCCs.map(c => c.name.length>12?c.name.substring(0,12)+'\u2026':c.name).join(' + ');
      const aExp = adminCCs.reduce((s,c) => s+(c.expenses||0), 0);
      html+=`<tr class="${grpClass}" data-pgid="${parentGid}" style="background:rgba(245,158,11,0.04);"><td style="color:#f59e0b;font-weight:700;">\u{1F504} \u0645\u0648\u0632\u0639: ${names}</td><td class="n" style="color:rgba(255,255,255,0.2);">-</td><td class="n" style="color:#f59e0b;font-weight:700;">${fmt(aExp)}</td><td class="n" style="color:#f59e0b;">\u2190 ${fmt(aExp)}</td>${'<td class="n" style="color:rgba(255,255,255,0.2);">-</td>'.repeat(6)}</tr>`;
    }
    return html;
  }

  if (!multiYear) {
    for (const yr of yrs) {
      for (const co of (yd[yr]?.companies || [])) {
        const cid = String(co.companyId), redistSet = redistByCompany[cid] || new Set();
        const coGid = 'rco' + gi++;
        const result = processCoYear(co, redistSet);
        const t = result.totals;
        gRev+=t.rev; gOrig+=t.orig; gAlloc+=t.alloc; gTotal+=t.total; gColl+=t.coll; gNet+=t.net; gAdmin+=result.adminExp;
        bdy += `<tr class="row-co" data-gid="${coGid}"><td style="color:${COLORS[gi%COLORS.length]};font-weight:800;">${co.companyName}</td>${numCells(t.rev,t.orig,t.alloc,t.total,t.coll,t.net,t.margin,true)}</tr>`;
        bdy += renderCCsUnder(coGid, result, 'row-cc', 'row-sub', 'row-acct');
      }
    }
  } else {
    const companyOrder = new Map();
    let colorIdx = 0;
    for (const yr of yrs) {
      for (const co of (yd[yr]?.companies || [])) {
        const cid = String(co.companyId), redistSet = redistByCompany[cid] || new Set();
        const result = processCoYear(co, redistSet);
        let entry = companyOrder.get(cid);
        if (!entry) { entry = { name: co.companyName, color: COLORS[colorIdx++ % COLORS.length], yearData: [] }; companyOrder.set(cid, entry); }
        entry.yearData.push({ yr, result });
      }
    }
    companyOrder.forEach((entry) => {
      const coGid = 'rco' + gi++;
      let cR=0,cO=0,cA=0,cT=0,cC=0;
      entry.yearData.forEach(({result}) => { const t=result.totals; cR+=t.rev; cO+=t.orig; cA+=t.alloc; cT+=t.total; cC+=t.coll; });
      const cN=cR-cT, cM=cR>0?(cN/cR*100):0;
      gRev+=cR; gOrig+=cO; gAlloc+=cA; gTotal+=cT; gColl+=cC; gNet+=cN;
      entry.yearData.forEach(({result}) => { gAdmin+=result.adminExp; });
      bdy += `<tr class="row-co" data-gid="${coGid}"><td style="color:${entry.color};font-weight:800;">${entry.name}</td>${numCells(cR,cO,cA,cT,cC,cN,cM,true)}</tr>`;
      entry.yearData.forEach(({yr, result}) => {
        const yrGid = 'ryr' + gi++;
        const t = result.totals;
        bdy += `<tr class="row-cc" data-gid="${yrGid}" data-pgid="${coGid}"><td style="font-family:var(--font-en);font-weight:700;color:rgba(255,255,255,0.7);">\u{1F4C5} ${yr}</td>${numCells(t.rev,t.orig,t.alloc,t.total,t.coll,t.net,t.margin,true)}</tr>`;
        bdy += renderCCsUnder(yrGid, result, 'row-sub', 'row-sub', 'row-acct');
      });
    });
  }

  const gM = gRev>0?(gNet/gRev*100):0;
  const ftr = `<td style="font-weight:800;">\u0627\u0644\u0645\u062c\u0645\u0648\u0639</td>${numCells(gRev,gOrig,gAlloc,gTotal,gColl,gNet,gM,true)}`;
  tbl.innerHTML = `<thead><tr><th>\u0627\u0644\u0634\u0631\u0643\u0629 / \u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629 / \u0627\u0644\u0645\u0631\u0643\u0632 / \u062d\u0633\u0627\u0628</th><th class="n sortable" data-col-idx="1">\u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a</th><th class="n sortable" data-col-idx="2">\u0645\u0635\u0631\u0648\u0641\u0627\u062a \u0623\u0635\u0644\u064a\u0629</th><th class="n sortable" data-col-idx="3" style="color:#f59e0b;">\u0627\u0644\u0645\u064f\u062d\u0645\u0651\u0644</th><th class="n sortable" data-col-idx="4" style="color:#ef4444;">\u0625\u062c\u0645\u0627\u0644\u064a \u0645\u0635\u0631\u0648\u0641\u0627\u062a</th><th class="n sortable" data-col-idx="5" style="color:#06b6d4;">\u0627\u0644\u0645\u062d\u0635\u0651\u0644</th><th class="n sortable" data-col-idx="6" style="color:#f59e0b;">\u0627\u0644\u0645\u062a\u0628\u0642\u064a</th><th class="n sortable" data-col-idx="7" style="color:#a78bfa;">% \u062a\u062d\u0635\u064a\u0644</th><th class="n sortable" data-col-idx="8">\u0635\u0627\u0641\u064a \u0627\u0644\u0631\u0628\u062d</th><th class="n sortable" data-col-idx="9">% \u0631\u0628\u062d</th></tr></thead><tbody>${bdy}</tbody><tfoot><tr>${ftr}</tr></tfoot>`;
  bindRedistToggle(tbl);
  bindSortableHeaders(tbl);
}


// ===== TAB: GUARANTEES =====
async function renderGuarantees(body, d, yrs, yd) {
  const today = new Date().toISOString().slice(0, 10);
  const selectedCos = d._selectedCos || [];
  body.innerHTML = '<div class="bi-empty">⏳ جاري تحميل بيانات الضمانات...</div>';

  try {
    const data = await api.getGuaranteePendingList({ companyIds: selectedCos.join(',') });

    if (!data || !data.length) {
      body.innerHTML = '<div class="bi-empty">لا توجد ضمانات بنكية معلّقة</div>';
      return;
    }

    let grandTotal = 0, totalItems = 0;
    data.forEach(co => co.items.forEach(item => { grandTotal += item.amount; totalItems++; }));

    let html = `
      <div class="bi-kpi-row" style="margin-bottom:18px">
        <div class="bi-kpi"><div class="bi-kpi-label">🏦 إجمالي الضمانات المعلّقة</div><div class="bi-kpi-value" style="color:#06b6d4;">${fmt(grandTotal)}</div></div>
        <div class="bi-kpi"><div class="bi-kpi-label">📋 عدد الضمانات</div><div class="bi-kpi-value" style="color:#a78bfa;">${totalItems}</div></div>
        <div class="bi-kpi"><div class="bi-kpi-label">📅 بتاريخ</div><div class="bi-kpi-value" style="color:#f59e0b;font-size:1.1rem;">${today}</div></div>
        <div class="bi-kpi"><div class="bi-kpi-label">🏢 الشركات</div><div class="bi-kpi-value" style="color:#10b981;">${data.length}</div></div>
      </div>
    `;

    data.forEach(co => {
      const coTotal = co.items.reduce((s, i) => s + i.amount, 0);
      html += `
        <div class="bi-card bi-full" style="margin-bottom:16px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <div style="font-size:1.05rem;font-weight:700;color:var(--text-white);">🏢 ${co.companyName}</div>
            <div style="font-family:var(--font-en);font-weight:700;color:#06b6d4;font-size:1.05rem">${fmt(coTotal)}</div>
          </div>
          <table class="bi-table" style="font-size:0.9rem" data-guarantee-tbl>
            <thead>
              <tr>
                <th style="width:40px;text-align:center">#</th>
                <th style="text-align:right">البيان</th>
                <th style="text-align:right">الحساب</th>
                <th class="sortable" data-col-idx="3" style="text-align:left">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              ${co.items.map((item, i) => `
                <tr>
                  <td style="text-align:center;color:#475569;font-size:0.8rem">${i + 1}</td>
                  <td style="color:var(--text-white)">${item.description}</td>
                  <td style="color:#94a3b8;font-size:0.85rem">${item.account}</td>
                  <td class="n" style="color:#06b6d4;font-weight:700">${fmt(item.amount)}</td>
                </tr>
              `).join('')}
              <tr style="background:rgba(139,92,246,0.06)">
                <td colspan="3" style="text-align:center;font-weight:700;color:#c4b5fd">الإجمالي</td>
                <td class="n" style="font-weight:800;color:#06b6d4;font-size:1rem">${fmt(coTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    });

    body.innerHTML = html;
    body.querySelectorAll('[data-guarantee-tbl]').forEach(t => bindSortableHeaders(t));
  } catch (err) {
    console.error('Guarantees error:', err);
    body.innerHTML = `<div class="bi-empty" style="color:#ef4444">❌ خطأ: ${err.message}</div>`;
  }
}
