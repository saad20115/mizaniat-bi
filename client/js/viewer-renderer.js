/**
 * Viewer Renderer — exact copy of presentation.js rendering functions
 * This module provides all the rendering logic for the shared viewer,
 * matching the main presentation page pixel-for-pixel.
 */

// ===== CONSTANTS =====
const COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#06b6d4','#84cc16'];
const YR_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6'];
const EXP_COLORS = ['#ef4444','#f59e0b','#ec4899','#f97316','#e11d48','#dc2626','#be123c','#ea580c'];
const MONTH_NAMES = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];

// ===== FORMATTING =====
const fmt = v => (!v && v !== 0) ? '0' : Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 });
const fmtP = v => (v || 0).toFixed(1) + '%';
function formatNumber(num, decimals = 0) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return Number(num).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ===== STATE =====
let allData = null, allYears = [], activeTab = 'overview', lastUpdated = null, shareData = null;
const token = new URLSearchParams(location.search).get('token');
let viewerToken = sessionStorage.getItem('mizaniat_viewer_token') || '';

// ===== INIT =====
if (!token) showErr('لم يتم تحديد رمز العرض'); else checkViewerAuth();

async function checkViewerAuth() {
  // If we have a stored viewer token, verify it
  if (viewerToken) {
    try {
      const vr = await fetch('/api/auth/viewer/verify?token=' + viewerToken);
      if (vr.ok) {
        hideLoginOverlay();
        init();
        return;
      }
    } catch (e) {}
    sessionStorage.removeItem('mizaniat_viewer_token');
    viewerToken = '';
  }
  // Show phone login and hide loading
  document.getElementById('loading').style.display = 'none';
  document.getElementById('phone-login-overlay').style.display = 'flex';
  const phoneInput = document.getElementById('phone-input');
  phoneInput.addEventListener('keydown', e => { if (e.key === 'Enter') doViewerLogin(); });
  phoneInput.focus();
  document.getElementById('phone-login-btn').addEventListener('click', doViewerLogin);
}

async function doViewerLogin() {
  const phone = document.getElementById('phone-input').value.trim();
  const errEl = document.getElementById('phone-error');
  errEl.style.display = 'none';
  if (!phone) { errEl.textContent = 'يرجى إدخال رقم الجوال'; errEl.style.display = 'block'; return; }

  const btn = document.getElementById('phone-login-btn');
  btn.disabled = true; btn.textContent = 'جاري التحقق...';

  try {
    const r = await fetch('/api/auth/viewer/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    const data = await r.json();
    if (!r.ok) {
      errEl.textContent = data.error || 'رقم غير مسجل';
      errEl.style.display = 'block';
      return;
    }

    viewerToken = data.token;
    sessionStorage.setItem('mizaniat_viewer_token', viewerToken);
    hideLoginOverlay();
    document.getElementById('loading').style.display = 'block';
    init();
  } catch (e) {
    errEl.textContent = 'تعذر الاتصال بالخادم';
    errEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'دخول';
  }
}

function hideLoginOverlay() {
  const overlay = document.getElementById('phone-login-overlay');
  if (overlay) overlay.style.display = 'none';
}

function viewerHeaders() {
  return viewerToken ? { 'x-viewer-token': viewerToken } : {};
}

async function init() {
  try {
    const r = await fetch(`/api/presentation/share/${token}`, { headers: viewerHeaders() });
    if (!r.ok) {
      const errData = await r.json().catch(() => ({}));
      // If auth expired, re-show login
      if (r.status === 401) {
        sessionStorage.removeItem('mizaniat_viewer_token');
        viewerToken = '';
        document.getElementById('loading').style.display = 'none';
        document.getElementById('phone-login-overlay').style.display = 'flex';
        const phoneInput = document.getElementById('phone-input');
        if (phoneInput) phoneInput.focus();
        return;
      }
      throw new Error(errData.error || 'الرابط غير صالح');
    }
    shareData = await r.json();
    document.title = shareData.title + ' — Mizaniat BI';
    allYears = (shareData.dateTo || shareData.dateFrom).split(',').sort();
    await load(shareData.companyId.split(','), allYears);
    document.getElementById('loading').style.display = 'none';
    document.getElementById('dashboard').style.display = '';
  } catch (e) { showErr(e.message); }
}

async function load(cids, yrs) {
  const r = await fetch(`/api/presentation/data?companyIds=${cids.join(',')}&years=${yrs.join(',')}`, { headers: viewerHeaders() });
  if (!r.ok) {
    if (r.status === 401) {
      sessionStorage.removeItem('mizaniat_viewer_token');
      viewerToken = '';
      document.getElementById('loading').style.display = 'none';
      document.getElementById('dashboard').style.display = 'none';
      document.getElementById('phone-login-overlay').style.display = 'flex';
      return;
    }
    throw new Error('خطأ في تحميل البيانات');
  }
  allData = await r.json();
  lastUpdated = new Date();
  render(cids, yrs);
}

function fmtTime(d) {
  if (!d) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

window.manualRefresh = async function() {
  const btn = document.getElementById('refresh-btn');
  if (!btn || btn.classList.contains('loading')) return;
  btn.classList.add('loading');
  try {
    const c2 = [...document.querySelectorAll('.co-chip.active')].map(x => x.dataset.id);
    const y2 = [...document.querySelectorAll('.yr-chip.active')].map(x => x.dataset.year).sort();
    if (c2.length && y2.length) await load(c2, y2);
    else { const cids = shareData.companyId.split(','); await load(cids, allYears); }
  } catch (e) { console.error(e); }
  btn.classList.remove('loading');
};

function showErr(m) {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('error').style.display = 'block';
  document.getElementById('err-txt').textContent = m;
}

// ===== RENDER SHELL =====
function render(aCids, aYrs) {
  const d = allData, yrs = d.years || [], yd = d.yearlyData || {}, gt = d.grandTotals;
  const fc = yd[yrs[0]]?.companies || [], mC = fc.length > 1, mY = yrs.length > 1;
  const dash = document.getElementById('dashboard');
  dash.innerHTML = `
    <div class="bi-topbar">
      <span class="sl">🏢</span>
      ${fc.map((c,i) => `<div class="bi-chip active co-chip" data-id="${c.companyId}" data-color="${COLORS[i%COLORS.length]}" style="border-color:${COLORS[i%COLORS.length]};background:${COLORS[i%COLORS.length]}20;color:${COLORS[i%COLORS.length]};">${c.companyName}</div>`).join('')}
      <div style="width:1px;height:20px;background:rgba(255,255,255,0.08);margin:0 4px;"></div>
      <span class="sl">📅</span>
      ${allYears.map((y,i) => `<div class="bi-chip ${aYrs.includes(y)?'active':''} yr-chip" data-year="${y}" data-color="${YR_COLORS[i%YR_COLORS.length]}" style="${aYrs.includes(y)?`border-color:${YR_COLORS[i%YR_COLORS.length]};background:${YR_COLORS[i%YR_COLORS.length]}20;color:${YR_COLORS[i%YR_COLORS.length]};`:''}font-family:var(--font-en);">${y}</div>`).join('')}
      <div style="margin-right:auto;display:flex;align-items:center;gap:8px;">
        <div class="bi-last-updated" id="last-updated">🕐 آخر تحديث: <span class="ts">${fmtTime(lastUpdated)}</span></div>
        <div class="bi-refresh-btn" id="refresh-btn" onclick="manualRefresh()"><span class="spin-icon">🔄</span> تحديث</div>
      </div>
    </div>
    <div class="bi-tabs" id="tabs">
      <div class="bi-tab ${activeTab==='overview'?'active':''}" data-tab="overview">📊 نظرة عامة</div>
      <div class="bi-tab ${activeTab==='collection'?'active':''}" data-tab="collection">📥 التحصيل</div>
      <div class="bi-tab ${activeTab==='comparison'?'active':''}" data-tab="comparison">📋 المقارنة</div>
      <div class="bi-tab ${activeTab==='details'?'active':''}" data-tab="details">📖 التفاصيل</div>
      <div class="bi-tab ${activeTab==='pivot-acc'?'active':''}" data-tab="pivot-acc">📊 تقاطعي - حسابات</div>
      <div class="bi-tab ${activeTab==='pivot-cc'?'active':''}" data-tab="pivot-cc">📊 تقاطعي - مراكز</div>
      <div class="bi-tab ${activeTab==='balance'?'active':''}" data-tab="balance">⚖️ المركز المالي</div>
      <div class="bi-tab ${activeTab==='guarantees'?'active':''}" data-tab="guarantees">🏦 الضمانات البنكية</div>
    </div>
    <div class="bi-body" id="bi-body"></div>
  `;

  // Chip events
  dash.querySelectorAll('.co-chip,.yr-chip').forEach(ch => {
    ch.addEventListener('click', () => {
      ch.classList.toggle('active');
      const c = ch.dataset.color;
      ch.style.borderColor = ch.classList.contains('active') ? c : 'rgba(255,255,255,0.12)';
      ch.style.background = ch.classList.contains('active') ? c + '20' : 'rgba(255,255,255,0.03)';
      ch.style.color = ch.classList.contains('active') ? c : 'rgba(255,255,255,0.4)';
      refilt();
    });
  });
  // Tab events
  dash.querySelectorAll('.bi-tab').forEach(t => {
    t.addEventListener('click', () => {
      dash.querySelectorAll('.bi-tab').forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      activeTab = t.dataset.tab;
      renderTab();
    });
  });

  async function refilt() {
    const c2 = [...dash.querySelectorAll('.co-chip.active')].map(x => x.dataset.id);
    const y2 = [...dash.querySelectorAll('.yr-chip.active')].map(x => x.dataset.year).sort();
    if (!c2.length || !y2.length) {
      document.getElementById('bi-body').innerHTML = '<div style="text-align:center;padding:60px;color:rgba(255,255,255,0.3);font-size:0.85rem;">اختر شركة وسنة</div>';
      return;
    }
    await load(c2, y2);
  }

  renderTab();
}

// ===== TAB SWITCHER =====
function renderTab() {
  const body = document.getElementById('bi-body');
  const d = allData, yrs = d.years || [], yd = d.yearlyData || {}, gt = d.grandTotals;
  const fc = yd[yrs[0]]?.companies || [], mC = fc.length > 1, mY = yrs.length > 1;

  switch (activeTab) {
    case 'overview': renderOverview(body, d, gt, yrs, yd, fc, mC, mY); break;
    case 'collection': renderCollection(body, d, gt, yrs, yd, fc, mC, mY); break;
    case 'comparison': renderComparison(body, d, gt, yrs, yd, fc, mC, mY); break;
    case 'details': renderDetails(body, d, gt, yrs, yd, fc, mC, mY); break;
    case 'pivot-acc': renderPivotAcc(body, d); break;
    case 'pivot-cc': renderPivotCC(body, d); break;
    case 'balance': renderBalance(body, d, gt, yrs, yd, fc, mC, mY); break;
    case 'guarantees': renderGuarantees(body, d, yrs, yd); break;
  }
}

// ===== DATA BUILDERS (exact copy from presentation.js) =====
function aggregateCompanyKpis(d) {
  const map = new Map();
  for (const yr of d.years) {
    for (const c of (d.yearlyData[yr]?.companies || [])) {
      let agg = map.get(c.companyId);
      if (!agg) { agg = { companyId: c.companyId, companyName: c.companyName, kpis: {} }; map.set(c.companyId, agg); }
      for (const [k, v] of Object.entries(c.kpis)) { agg.kpis[k] = (agg.kpis[k] || 0) + (typeof v === 'number' ? v : 0); }
    }
  }
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

function buildExpDonutData(d) {
  const yrs = d.years, yd = d.yearlyData;
  const allComps = aggregateCompanyKpis(d);
  const mC = allComps.length > 1, mY = yrs.length > 1;
  if (mC) return { values: allComps.map(c => c.kpis.expenses), colors: EXP_COLORS, labels: allComps.map(c => c.companyName) };
  if (mY) return { values: yrs.map(y => yd[y].totals.expenses), colors: EXP_COLORS, labels: yrs };
  const t = d.grandTotals; return { values: [t.expenses||0, Math.max(t.netIncome,0)], colors: ['#ef4444','#10b981'], labels: ['المصروفات','صافي الربح'] };
}

function buildMonthlyBarData(d, year) {
  const yd = d.yearlyData[year];
  if (!yd) return { revenue: [], expenses: [] };
  const rev = new Array(12).fill(0), exp = new Array(12).fill(0);
  for (const co of (yd.companies || [])) {
    for (const r of (co.pivotData || [])) {
      const m = r.month;
      if (m >= 1 && m <= 12) { rev[m-1] += r.revenue || 0; exp[m-1] += r.expenses || 0; }
    }
  }
  return { revenue: rev, expenses: exp };
}

function aggregatePivotData(d) {
  const allRows = [];
  const yrs = d.years, yd = d.yearlyData;
  yrs.forEach(yr => { (yd[yr]?.companies || []).forEach(c => { (c.pivotData || []).forEach(r => allRows.push(r)); }); });
  return allRows;
}

// ===== TAB: OVERVIEW (exact copy from presentation.js) =====
function renderOverview(body, d, gt, yrs, yd, comps, multiCo, multiYear) {
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
    const lastYr = yrs[yrs.length - 1];
    if (lastYr) {
      const monthlyData = buildMonthlyBarData(d, lastYr);
      drawMonthlyBars(document.getElementById('ch-monthly-rev'), monthlyData.revenue, '#10b981', '#34d399');
      drawMonthlyBars(document.getElementById('ch-monthly-exp'), monthlyData.expenses, '#ef4444', '#f87171');
    }
  });
}

// ===== TAB: COLLECTION (exact copy) =====
function renderCollection(body, d, gt, yrs, yd, comps, multiCo, multiYear) {
  const clRev = gt.revenue, clExp = gt.expenses;
  const collected = gt.collected, collPct = gt.collectionRate;
  const clRem = gt.remaining, remPct = gt.remainingRate;
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
    <div class="bi-card bi-full"><div class="bi-card-title">📋 تفاصيل التحصيل</div><div style="overflow-x:auto;"><table class="bi-table" id="tbl-collection"></table></div></div>
  `;
  requestAnimationFrame(() => {
    drawCollectionBars(document.getElementById('ch-coll-bars'), d);
    drawDonut(document.getElementById('ch-coll-donut'), { values: [collected, clRem], colors: ['#10b981','#f59e0b'], labels: ['المحصّل','المتبقي'] });
    fillCollectionTable(document.getElementById('tbl-collection'), d);
  });
}

// ===== TAB: COMPARISON (exact copy) =====
function renderComparison(body, d, gt, yrs, yd, comps, multiCo, multiYear) {
  body.innerHTML = `
    <div class="bi-card bi-full"><div class="bi-card-title">📋 مقارنة شاملة — الإيرادات والمصروفات والتحصيل</div><div style="overflow-x:auto;"><table class="bi-table" id="tbl-comparison"></table></div></div>
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

// ===== TAB: BALANCE (exact copy) =====
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
    <div class="bi-card bi-full"><div class="bi-card-title">📋 تفاصيل المركز المالي</div><div style="overflow-x:auto;"><table class="bi-table" id="tbl-balance"></table></div></div>
  `;
  requestAnimationFrame(() => {
    drawBarGroup(document.getElementById('ch-bal-bar'), buildBarData(d, 'balance'));
    drawDonut(document.getElementById('ch-bal-donut'), { values: [gt.assets, gt.liabilities, gt.equity], colors: ['#3b82f6','#ef4444','#10b981'], labels: ['الأصول','الالتزامات','حقوق الملكية'] });
    fillBalanceTable(document.getElementById('tbl-balance'), d);
  });
}

// ===== TAB: DETAILS (exact copy) =====
function renderDetails(body, d, gt, yrs, yd, comps, multiCo, multiYear) {
  const dtRev = gt.revenue, dtExp = gt.expenses, dtNet = gt.netIncome, dtMargin = gt.profitMargin, dtExpRatio = gt.expenseRatio;
  let dtCcCount = 0;
  for (const yr of yrs) { for (const co of (yd[yr]?.companies||[])) { dtCcCount += (co.accountTree || []).length; }}
  body.innerHTML = `
    <div class="bi-kpi-row" style="grid-template-columns:repeat(4,1fr);">
      <div class="bi-kpi"><div class="bi-kpi-label">💰 الإيرادات</div><div class="bi-kpi-value" style="color:#10b981;">${fmt(dtRev)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📤 المصروفات</div><div class="bi-kpi-value" style="color:#ef4444;">${fmt(dtExp)}</div><div class="bi-kpi-sub">${fmtP(dtExpRatio)} من الإيرادات</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📈 صافي الربح</div><div class="bi-kpi-value" style="color:${dtNet>=0?'#10b981':'#ef4444'};">${fmt(dtNet)}</div><div class="bi-kpi-sub">هامش ${fmtP(dtMargin)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📊 مراكز التكلفة</div><div class="bi-kpi-value" style="color:#8b5cf6;">${dtCcCount}</div></div>
    </div>
    <div class="bi-card bi-full"><div class="bi-card-title">📑 تفاصيل الإيرادات والمصروفات حسب الحساب المالي</div><div style="overflow-x:auto;"><table class="bi-table" id="tbl-details"></table></div></div>
  `;
  requestAnimationFrame(() => fillAccountTable(document.getElementById('tbl-details'), d));
}

// ===== TAB: PIVOT-ACC (exact copy) =====
function renderPivotAcc(body, d) {
  const gt = d.grandTotals;
  const raw = aggregatePivotData(d);
  const uniqAcc = new Set(raw.map(r => r.account_code));
  body.innerHTML = `
    <div class="bi-kpi-row" style="grid-template-columns:repeat(4,1fr);">
      <div class="bi-kpi"><div class="bi-kpi-label">💰 إجمالي الإيرادات</div><div class="bi-kpi-value" style="color:#10b981;">${fmt(gt.revenue)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📤 إجمالي المصروفات</div><div class="bi-kpi-value" style="color:#ef4444;">${fmt(gt.expenses)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📈 صافي الربح</div><div class="bi-kpi-value" style="color:${gt.netIncome>=0?'#10b981':'#ef4444'};">${fmt(gt.netIncome)}</div><div class="bi-kpi-sub">هامش ${fmtP(gt.profitMargin)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📋 عدد الحسابات</div><div class="bi-kpi-value" style="color:#8b5cf6;">${uniqAcc.size}</div></div>
    </div>
    <div class="bi-card bi-full"><div class="bi-card-title">📊 التقرير التقاطعي — حسب الحساب المالي</div><div style="overflow-x:auto;"><table class="bi-table" id="tbl-pivot-acc" style="font-size:1rem;"></table></div></div>`;
  requestAnimationFrame(() => fillPivotAccTable(document.getElementById('tbl-pivot-acc'), d));
}

// ===== TAB: PIVOT-CC (exact copy) =====
function renderPivotCC(body, d) {
  const gt = d.grandTotals;
  const raw = aggregatePivotData(d);
  const uniqCC = new Set(raw.map(r => r.cc));
  body.innerHTML = `
    <div class="bi-kpi-row" style="grid-template-columns:repeat(4,1fr);">
      <div class="bi-kpi"><div class="bi-kpi-label">💰 إجمالي الإيرادات</div><div class="bi-kpi-value" style="color:#10b981;">${fmt(gt.revenue)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📤 إجمالي المصروفات</div><div class="bi-kpi-value" style="color:#ef4444;">${fmt(gt.expenses)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📈 صافي الربح</div><div class="bi-kpi-value" style="color:${gt.netIncome>=0?'#10b981':'#ef4444'};">${fmt(gt.netIncome)}</div><div class="bi-kpi-sub">هامش ${fmtP(gt.profitMargin)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">🏢 عدد المراكز</div><div class="bi-kpi-value" style="color:#8b5cf6;">${uniqCC.size}</div></div>
    </div>
    <div class="bi-card bi-full"><div class="bi-card-title">📊 التقرير التقاطعي — حسب مركز التكلفة</div><div style="overflow-x:auto;"><table class="bi-table" id="tbl-pivot-cc" style="font-size:1rem;"></table></div></div>`;
  requestAnimationFrame(() => fillPivotCCTable(document.getElementById('tbl-pivot-cc'), d));
}

// ===== TAB: GUARANTEES =====
function renderGuarantees(body, d, yrs, yd) {
  const gt = d.grandTotals;
  body.innerHTML = `
    <div class="bi-kpi-row" style="grid-template-columns:repeat(2,1fr);">
      <div class="bi-kpi"><div class="bi-kpi-label">🏦 إجمالي الضمانات البنكية</div><div class="bi-kpi-value" style="color:#06b6d4;">${fmt(gt.cash)}</div><div class="bi-kpi-sub">بتاريخ ${new Date().toISOString().slice(0,10)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📊 عدد الشركات</div><div class="bi-kpi-value" style="color:#8b5cf6;">${(yd[yrs[0]]?.companies||[]).length}</div></div>
    </div>
    <div class="bi-card bi-full"><div class="bi-card-title">🏦 تفاصيل الضمانات حسب الشركة</div><div style="overflow-x:auto;"><table class="bi-table" id="tbl-guar"></table></div></div>`;
  requestAnimationFrame(() => {
    const tbl = document.getElementById('tbl-guar');
    if (!tbl) return;
    let rows = '';
    for (const yr of yrs) {
      for (const co of (yd[yr]?.companies || [])) {
        rows += `<tr><td style="font-weight:700;color:#60a5fa;">${co.companyName}</td><td class="n" style="font-family:var(--font-en);color:rgba(255,255,255,0.5);">${yr}</td><td class="n" style="color:#06b6d4;font-weight:700;">${fmt(co.kpis.cash||0)}</td></tr>`;
      }
    }
    tbl.innerHTML = `<thead><tr><th>الشركة</th><th class="n">السنة</th><th class="n">الضمانات</th></tr></thead><tbody>${rows}</tbody>
      <tfoot><tr><td>المجموع</td><td></td><td class="n" style="color:#06b6d4;font-weight:800;">${fmt(gt.cash)}</td></tr></tfoot>`;
  });
}
