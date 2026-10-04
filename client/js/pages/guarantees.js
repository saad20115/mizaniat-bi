import { api } from '../api.js';
import { store } from '../store.js';
import { formatNumber } from '../utils/format.js';
import { showToast } from '../utils/ui.js';

const fmt = v => formatNumber(v, 2);

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

let showReleasedState = false;

/**
 * Standalone page entry point
 */
export async function renderGuaranteesPage(container) {
  await renderGuaranteesComponent(container, {
    isPresentation: false
  });
}

/**
 * Unified Guarantees Component
 * Used both in presentation tab and standalone page.
 * Powered strictly by ConsolidationEngine.getActiveGuarantees via GET /api/guarantees.
 */
export async function renderGuaranteesComponent(container, options = {}) {
  const isPresentation = !!options.isPresentation;
  const hasAdminToken = Boolean(localStorage.getItem('mizaniat_admin_token'));
  const isViewer = !hasAdminToken && ((typeof window.isViewerMode === 'function' && window.isViewerMode()) ||
    localStorage.getItem('mizaniat_viewer_mode') === 'true');

  container.innerHTML = `
    <style>
      .gr-wrap { direction: rtl; font-family: inherit; color: var(--text-primary, #f8fafc); width: 100%; max-width: 100%; min-width: 0; box-sizing: border-box; }
      .gr-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; gap: 14px; }
      .gr-title-group h1 { font-size: 1.45rem; font-weight: 800; margin: 0 0 4px 0; color: var(--text-primary, #f8fafc); display: flex; align-items: center; gap: 10px; }
      .gr-title-group p { font-size: 0.85rem; color: var(--text-muted, #94a3b8); margin: 0; }
      
      .gr-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; margin-bottom: 22px; }
      .gr-kpi-card { background: var(--bg-card, #1e293b); border: 1px solid var(--border-subtle, rgba(255,255,255,0.08)); border-radius: 14px; padding: 14px 18px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
      .gr-kpi-label { font-size: 0.8rem; font-weight: 600; color: var(--text-muted, #94a3b8); margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
      .gr-kpi-val { font-size: 1.3rem; font-weight: 800; font-family: var(--font-en, 'Inter', sans-serif); direction: ltr; text-align: right; }
      .gr-kpi-sub { font-size: 0.75rem; color: var(--text-muted, #64748b); margin-top: 4px; }

      .gr-toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 18px; padding: 10px 14px; background: rgba(30, 41, 59, 0.4); border: 1px solid var(--border-subtle, rgba(255,255,255,0.06)); border-radius: 10px; }
      .gr-legend { display: flex; gap: 14px; font-size: 0.8rem; color: var(--text-muted, #94a3b8); flex-wrap: wrap; align-items: center; }
      .gr-legend-item { display: flex; align-items: center; gap: 5px; }
      .gr-dot { width: 9px; height: 9px; border-radius: 50%; display: inline-block; }

      .gr-company { margin-bottom: 24px; border: 1px solid var(--border-subtle, rgba(255,255,255,0.08)); border-radius: 14px; overflow: hidden; background: var(--bg-card, #1e293b); width: 100%; max-width: 100%; min-width: 0; box-sizing: border-box; }
      .gr-company-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; background: rgba(30, 41, 59, 0.7); border-bottom: 1px solid var(--border-subtle, rgba(255,255,255,0.08)); flex-wrap: wrap; gap: 12px; }
      .gr-company-name { font-size: 1.05rem; font-weight: 750; color: var(--text-primary, #f8fafc); display: flex; align-items: center; gap: 8px; }
      .gr-company-stats { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; font-size: 0.85rem; }

      .gr-table-wrap { overflow-x: auto; max-width: 100%; width: 100%; min-width: 0; box-sizing: border-box; }
      .gr-table { width: 100%; border-collapse: collapse; font-size: 0.84rem; text-align: right; }
      .gr-table th { background: rgba(15, 23, 42, 0.6); color: var(--text-muted, #cbd5e1); font-weight: 700; padding: 10px 12px; border-bottom: 1px solid var(--border-subtle, rgba(255,255,255,0.08)); white-space: nowrap; }
      .gr-table td { padding: 9px 12px; border-bottom: 1px solid var(--border-subtle, rgba(255,255,255,0.04)); vertical-align: middle; }
      .gr-table tbody tr:hover { background: rgba(99, 102, 241, 0.04); }
      .gr-table .num { text-align: left; font-family: var(--font-en, 'Inter', sans-serif); direction: ltr; font-weight: 700; white-space: nowrap; }

      .gr-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 9999px; font-size: 0.72rem; font-weight: 700; white-space: nowrap; }
      .gr-badge-pending { background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); }
      .gr-badge-sub { background: rgba(139, 92, 246, 0.15); color: #c084fc; border: 1px solid rgba(139, 92, 246, 0.3); }
      .gr-badge-auto { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
      .gr-badge-manual { background: rgba(234, 179, 8, 0.15); color: #facc15; border: 1px solid rgba(234, 179, 8, 0.3); }
      .gr-badge-released { background: rgba(148, 163, 184, 0.12); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.25); text-decoration: line-through; }
      .gr-badge-success { background: rgba(16, 185, 129, 0.12); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.25); font-weight: 700; padding: 3px 10px; border-radius: 8px; }
      .gr-badge-danger { background: rgba(239, 68, 68, 0.12); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.25); font-weight: 700; padding: 3px 10px; border-radius: 8px; }

      .gr-btn { padding: 4px 10px; border-radius: 6px; border: none; cursor: pointer; font-size: 0.76rem; font-weight: 600; font-family: inherit; transition: all 0.15s; display: inline-flex; align-items: center; gap: 4px; }
      .gr-btn:hover { opacity: 0.85; transform: translateY(-1px); }
      .gr-btn-release { background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); }
      .gr-btn-unrelease { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
      .gr-btn-break { background: rgba(139, 92, 246, 0.15); color: #a78bfa; border: 1px solid rgba(139, 92, 246, 0.3); }
      .gr-btn-del { background: rgba(239, 68, 68, 0.12); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.25); font-size: 0.72rem; padding: 3px 7px; }
      .gr-btn-add { background: #10b981; color: #fff; border: none; padding: 5px 12px; }

      .gr-sub-row td { background: rgba(139, 92, 246, 0.03) !important; padding-right: 32px !important; }
      .gr-sub-marker { color: #a78bfa; font-size: 0.8rem; margin-left: 6px; }

      .gr-add-form { background: rgba(139, 92, 246, 0.05); border-bottom: 1px solid rgba(139, 92, 246, 0.15); }
      .gr-add-form td { padding: 10px 14px; }
      .gr-add-form-inner { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
      .gr-input { background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(100, 116, 139, 0.25); color: var(--text-primary, #f8fafc); padding: 5px 10px; border-radius: 6px; font-size: 0.82rem; font-family: inherit; }
      .gr-input:focus { outline: none; border-color: #8b5cf6; }

      .gr-unmatched-box { margin: 12px 16px; padding: 10px 14px; background: rgba(239, 68, 68, 0.06); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; font-size: 0.8rem; color: #fca5a5; }
      .gr-empty { text-align: center; padding: 48px 16px; color: var(--text-muted, #94a3b8); font-size: 0.95rem; }
      
      .gr-row-released td { opacity: 0.55; }
      .gr-row-released .num { text-decoration: line-through; }
    </style>

    <div class="gr-wrap">
      ${!isPresentation ? `
        <div class="gr-header">
          <div class="gr-title-group">
            <h1>🏦 إدارة الضمانات البنكية</h1>
            <p>متابعة الكفالات والضمانات البنكية النشطة ومطابقتها التامة مع أرصدة الأستاذ العام</p>
          </div>
          <div style="display:flex;gap:10px;align-items:center;">
            <button class="btn btn-secondary" id="gr-btn-refresh" style="font-size:0.85rem">🔄 تحديث</button>
          </div>
        </div>
      ` : ''}

      <div class="gr-kpis" id="gr-kpis">
        <div class="gr-kpi-card">
          <div class="gr-kpi-label">🏦 إجمالي الضمانات المعلّقة</div>
          <div class="gr-kpi-val" id="gr-kpi-pending-amt" style="color:#06b6d4;">—</div>
          <div class="gr-kpi-sub">المجموع الفعلي للضمانات النشطة</div>
        </div>
        <div class="gr-kpi-card">
          <div class="gr-kpi-label">📋 عدد الضمانات المعلّقة</div>
          <div class="gr-kpi-val" id="gr-kpi-count" style="color:#a78bfa;">—</div>
          <div class="gr-kpi-sub">عدد البنود غير المفرجة</div>
        </div>
        <div class="gr-kpi-card">
          <div class="gr-kpi-label">⚖️ رصيد الأستاذ العام</div>
          <div class="gr-kpi-val" id="gr-kpi-ledger-amt" style="color:#3b82f6;">—</div>
          <div class="gr-kpi-sub">رصيد حسابات الضمانات بالأستاذ</div>
        </div>
        <div class="gr-kpi-card">
          <div class="gr-kpi-label">🎯 حالة المطابقة مع الأستاذ</div>
          <div class="gr-kpi-val" id="gr-kpi-match-status" style="font-size:1.15rem;">—</div>
          <div class="gr-kpi-sub" id="gr-kpi-match-sub">الفرق الإجمالي بين القائمة والأستاذ</div>
        </div>
      </div>

      <div class="gr-toolbar">
        <div class="gr-legend">
          <div class="gr-legend-item"><span class="gr-dot" style="background:#60a5fa"></span> معلّقة</div>
          <div class="gr-legend-item"><span class="gr-dot" style="background:#c084fc"></span> بند فرعي</div>
          <div class="gr-legend-item"><span class="gr-dot" style="background:#fbbf24"></span> مفرج تلقائياً (مطابق)</div>
          <div class="gr-legend-item"><span class="gr-dot" style="background:#facc15"></span> استثناء يدوي</div>
        </div>
        ${!isViewer ? `
          <div style="display:flex;align-items:center;gap:6px;">
            <input type="checkbox" id="gr-toggle-released" ${showReleasedState ? 'checked' : ''} style="cursor:pointer;accent-color:#6366f1;">
            <label for="gr-toggle-released" style="cursor:pointer;font-size:0.82rem;user-select:none;color:var(--text-muted, #cbd5e1);">عرض الضمانات المفرجة</label>
          </div>
        ` : ''}
      </div>

      <div id="gr-content">
        <div class="gr-empty">⏳ جاري تحميل الضمانات البنكية...</div>
      </div>
    </div>
  `;

  await loadGuaranteesData(container, options);

  // Bind refresh if present
  const refreshBtn = container.querySelector('#gr-btn-refresh');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => loadGuaranteesData(container, options));
  }

  // Bind released toggle if present
  const toggleRel = container.querySelector('#gr-toggle-released');
  if (toggleRel) {
    toggleRel.addEventListener('change', (e) => {
      showReleasedState = e.target.checked;
      loadGuaranteesData(container, options);
    });
  }
}

async function loadGuaranteesData(container, options = {}) {
  const content = container.querySelector('#gr-content');
  const hasAdminToken = Boolean(localStorage.getItem('mizaniat_admin_token'));
  const isViewer = !hasAdminToken && ((typeof window.isViewerMode === 'function' && window.isViewerMode()) ||
    localStorage.getItem('mizaniat_viewer_mode') === 'true');

  let companyIds = options.companyIds;
  if (!companyIds || !companyIds.length) {
    const filterCos = store.get('selectedCompanyIds');
    if (filterCos && filterCos.length) companyIds = filterCos;
  }
  const asOfDate = options.asOfDate || store.get('dateTo') || new Date().toISOString().slice(0, 10);

  try {
    const params = { asOfDate };
    if (companyIds && companyIds.length) params.companyIds = companyIds.join(',');
    const data = await api.getGuarantees(params);

    if (!data || !data.length) {
      content.innerHTML = '<div class="gr-empty">لا توجد حسابات أو حركات ضمانات بنكية للشركات المختارة</div>';
      updateKpis(container, 0, 0, 0, 0);
      return;
    }

    let grandPending = 0;
    let grandCount = 0;
    let grandLedger = 0;
    let grandDiff = 0;

    data.forEach(co => {
      grandPending += (co.totalAmount || 0);
      grandCount += (co.items ? co.items.length : 0);
      grandLedger += (co.ledgerBalance || 0);
      grandDiff += (co.diff || 0);
    });

    updateKpis(container, grandPending, grandCount, grandLedger, grandDiff);

    let html = '';
    data.forEach(co => {
      const coPending = co.totalAmount || 0;
      const coLedger = co.ledgerBalance || 0;
      const coDiff = Math.round((co.diff || (coPending - coLedger)) * 100) / 100;
      const isMatched = Math.abs(coDiff) <= 0.05;

      const activeItems = co.items || [];
      const releasedItems = showReleasedState ? (co.releasedItems || []) : [];
      const totalDisplayCount = activeItems.length + releasedItems.length;

      html += `
        <div class="gr-company">
          <div class="gr-company-header">
            <div class="gr-company-name">🏢 ${escapeHtml(co.companyName)}</div>
            <div class="gr-company-stats">
              <div>رصيد الأستاذ: <b style="color:var(--text-primary, #e2e8f0);font-family:var(--font-en, 'Inter')">${fmt(coLedger)}</b></div>
              <div>معلّق: <b style="color:#06b6d4;font-family:var(--font-en, 'Inter')">${fmt(coPending)}</b></div>
              ${isMatched
                ? '<span class="gr-badge-success">✓ مطابقة تامة مع الأستاذ</span>'
                : (co.isPendingOdoo
                  ? `<span class="gr-badge-pending" style="background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);padding:4px 10px;border-radius:6px;font-size:0.85rem;font-weight:700;" title="${(co.pendingReleases || []).map(r => `${r.moveName}: ${r.releaseNotes || 'إفراج يدوي'}`).join(' | ')}">⏳ بانتظار تسجيل قيد الإفراج في أودو: ${fmt(co.pendingAmount || Math.abs(coDiff))}</span>`
                  : `<span class="gr-badge-danger">⚠️ فرق: ${fmt(coDiff)}</span>`)}
            </div>
          </div>

          ${!isMatched && !co.isPendingOdoo && co.unmatchedCredits && co.unmatchedCredits.length ? `
            <div class="gr-unmatched-box">
              <b>⚠️ إفراجات بالأستاذ لم تُطابَق مع إصدار ولا بند فرعي:</b>
              <ul style="margin:6px 0 0 16px;padding:0;line-height:1.6">
                ${co.unmatchedCredits.map(c => `
                  <li>التاريخ: <b>${c.date}</b> | القيد: <b>${escapeHtml(c.moveName)}</b> | المبلغ: <b>${fmt(c.amount)}</b> | البيان: ${escapeHtml(c.label || '')}</li>
                `).join('')}
              </ul>
            </div>
          ` : ''}

          <div class="gr-table-wrap tree-table-wrap" data-scroll-x="true" style="overflow-x:auto;width:100%;max-width:100%;min-width:0;box-sizing:border-box;">
            <table class="gr-table" style="width:100% !important;min-width:100%;">
              <thead>
                <tr>
                  <th style="width:40px;text-align:center">#</th>
                  <th style="width:110px">الحالة</th>
                  <th style="width:95px">التاريخ</th>
                  <th style="width:140px">رقم القيد</th>
                  <th style="width:140px">الحساب</th>
                  <th style="width:auto;min-width:200px">البيان والملاحظات</th>
                  <th style="width:140px">الطرف</th>
                  <th style="width:115px;text-align:left">المبلغ</th>
                  ${!isViewer ? '<th style="width:75px;text-align:center">الإجراءات</th>' : ''}
                </tr>
              </thead>
              <tbody>
      `;

      if (totalDisplayCount === 0) {
        html += `
          <tr>
            <td colspan="${!isViewer ? 9 : 8}" style="text-align:center;padding:26px;color:var(--text-muted,#94a3b8)">
              لا توجد ضمانات نشطة لهذه الشركة
            </td>
          </tr>
        `;
      } else {
        let idx = 1;

        // Render Active Items
        activeItems.forEach(item => {
          const isSub = item.type === 'sub';
          const badgeClass = isSub ? 'gr-badge-sub' : 'gr-badge-pending';
          const badgeLabel = isSub ? 'بند فرعي' : 'معلّقة';
          const key = `${co.companyId}|${item.accountCode}|${item.moveName}`;

          html += `
            <tr class="${isSub ? 'gr-sub-row' : ''}">
              <td style="text-align:center;color:var(--text-muted,#64748b);font-size:0.78rem">${idx++}</td>
              <td><span class="gr-badge ${badgeClass}">${badgeLabel}</span></td>
              <td style="font-family:var(--font-en,'Inter');color:var(--text-muted,#94a3b8);white-space:nowrap">${item.date || ''}</td>
              <td style="font-family:var(--font-en,'Inter');color:#818cf8;white-space:nowrap">${escapeHtml(item.moveName || '')}</td>
              <td style="font-size:0.8rem;color:var(--text-muted,#cbd5e1);white-space:nowrap" title="${escapeHtml(item.accountName || '')}">${escapeHtml(item.accountCode || '')}</td>
              <td style="width:auto;min-width:200px;">
                <div>${isSub ? '<span class="gr-sub-marker">↳</span> ' : ''}${escapeHtml(item.description || item.accountName || '')}</div>
                ${item.releaseNotes ? `
                  <div style="font-size:0.73rem;color:#facc15;margin-top:2px;background:rgba(234,179,8,0.08);padding:2px 6px;border-radius:4px;display:inline-block">
                    📌 ${escapeHtml(item.releaseNotes)}
                  </div>
                ` : ''}
              </td>
              <td style="font-size:0.8rem;color:var(--text-muted,#94a3b8)">${escapeHtml(item.partner || '')}</td>
              <td class="num" style="color:${isSub ? '#c084fc' : '#34d399'}">${fmt(item.amount)}</td>
              ${!isViewer ? `
                <td style="text-align:center;white-space:nowrap">
                  <div style="display:inline-flex;gap:4px;align-items:center;">
                    ${isSub ? `
                      <button class="gr-btn gr-btn-release" data-action="toggle-sub" data-subid="${item.subItemId}" data-released="0" title="إفراج عن البند الفرعي">✅ إفراج</button>
                      <button class="gr-btn gr-btn-del" data-action="del-sub" data-subid="${item.subItemId}" title="حذف البند الفرعي">🗑️</button>
                    ` : `
                      <button class="gr-btn gr-btn-release" data-action="release" data-cid="${co.companyId}" data-acc="${item.accountCode}" data-move="${item.moveName}" title="إفراج يدوي أو استثناء">✅ إفراج</button>
                      <button class="gr-btn gr-btn-break" data-action="breakdown" data-key="${key}" title="تقسيم الضمان إلى بنود فرعية">📋 تفصيل</button>
                    `}
                  </div>
                </td>
              ` : ''}
            </tr>
          `;
        });

        // Render Released Items (if toggled)
        if (showReleasedState && releasedItems.length) {
          releasedItems.forEach(item => {
            const isSub = item.type === 'sub';
            let badgeClass = 'gr-badge-released';
            let badgeLabel = 'مفرج';
            if (item.matchType === 'auto') {
              badgeClass = 'gr-badge-auto';
              badgeLabel = 'مفرج تلقائياً';
            } else if (item.matchType === 'manual') {
              badgeClass = 'gr-badge-manual';
              badgeLabel = 'استثناء يدوي';
            }

            html += `
              <tr class="gr-row-released ${isSub ? 'gr-sub-row' : ''}">
                <td style="text-align:center;color:var(--text-muted,#64748b);font-size:0.78rem">${idx++}</td>
                <td><span class="gr-badge ${badgeClass}">${badgeLabel}</span></td>
                <td style="font-family:var(--font-en,'Inter');color:var(--text-muted,#94a3b8);white-space:nowrap">${item.date || ''}</td>
                <td style="font-family:var(--font-en,'Inter');color:#818cf8;white-space:nowrap">${escapeHtml(item.moveName || '')}</td>
                <td style="font-size:0.8rem;color:var(--text-muted,#cbd5e1);white-space:nowrap">${escapeHtml(item.accountCode || '')}</td>
                <td style="width:auto;min-width:200px;">
                  <div>${isSub ? '<span class="gr-sub-marker">↳</span> ' : ''}${escapeHtml(item.description || item.accountName || '')}</div>
                  ${item.releaseNotes ? `
                    <div style="font-size:0.73rem;color:#facc15;margin-top:2px;background:rgba(234,179,8,0.08);padding:2px 6px;border-radius:4px;display:inline-block">
                      📌 ${escapeHtml(item.releaseNotes)}
                    </div>
                  ` : ''}
                </td>
                <td style="font-size:0.8rem;color:var(--text-muted,#94a3b8)">${escapeHtml(item.partner || '')}</td>
                <td class="num" style="color:var(--text-muted,#94a3b8)">${fmt(item.amount)}</td>
                ${!isViewer ? `
                  <td style="text-align:center;white-space:nowrap">
                    <div style="display:inline-flex;gap:4px;align-items:center;">
                      ${isSub ? `
                        <button class="gr-btn gr-btn-unrelease" data-action="toggle-sub" data-subid="${item.subItemId}" data-released="1" title="إلغاء إفراج البند الفرعي">↩️ إلغاء</button>
                      ` : (item.matchType === 'manual' ? `
                        <button class="gr-btn gr-btn-unrelease" data-action="unrelease" data-cid="${co.companyId}" data-acc="${item.accountCode}" data-move="${item.moveName}" title="إلغاء الاستثناء اليدوي">↩️ إلغاء الاستثناء</button>
                      ` : `<span style="font-size:0.75rem;color:var(--text-muted,#64748b)">مطابق بالأستاذ</span>`)}
                    </div>
                  </td>
                ` : ''}
              </tr>
            `;
          });
        }
      }

      html += `
              </tbody>
              <tfoot>
                <tr style="background:rgba(15,23,42,0.4);font-weight:700">
                  <td colspan="7" style="text-align:left;padding:10px 14px;color:var(--text-muted,#cbd5e1)">إجمالي المعلّق للشركة:</td>
                  <td class="num" style="color:#06b6d4;font-size:0.95rem;font-weight:800">${fmt(coPending)}</td>
                  ${!isViewer ? '<td></td>' : ''}
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      `;
    });

    content.innerHTML = html;

    if (!isViewer) {
      bindAdminActions(container, options);
    }
  } catch (err) {
    console.error('Guarantees loading error:', err);
    content.innerHTML = `<div class="gr-empty" style="color:#ef4444">❌ خطأ في تحميل الضمانات: ${escapeHtml(err.message)}</div>`;
  }
}

function updateKpis(container, pending, count, ledger, diff) {
  const pEl = container.querySelector('#gr-kpi-pending-amt');
  const cEl = container.querySelector('#gr-kpi-count');
  const lEl = container.querySelector('#gr-kpi-ledger-amt');
  const mEl = container.querySelector('#gr-kpi-match-status');
  const sEl = container.querySelector('#gr-kpi-match-sub');

  if (pEl) pEl.textContent = fmt(pending);
  if (cEl) cEl.textContent = count;
  if (lEl) lEl.textContent = fmt(ledger);

  if (mEl) {
    const isMatched = Math.abs(diff) <= 0.05;
    if (isMatched) {
      mEl.innerHTML = '<span style="color:#10b981;font-weight:800">✓ مطابقة تامة</span>';
      if (sEl) sEl.textContent = 'الأستاذ مطابق 100% مع القائمة النشطة';
    } else {
      mEl.innerHTML = `<span style="color:#ef4444;font-weight:800">⚠️ فرق: ${fmt(diff)}</span>`;
      if (sEl) sEl.textContent = 'يوجد فرق بين القائمة ورصيد الأستاذ';
    }
  }
}

function bindAdminActions(container, options) {
  const content = container.querySelector('#gr-content');

  // Manual release
  content.querySelectorAll('[data-action="release"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { cid, acc, move } = btn.dataset;
      const notes = prompt('ملاحظات الإفراج أو الاستثناء (اختياري):', '');
      if (notes === null) return; // user cancelled prompt
      btn.disabled = true;
      btn.textContent = '⏳';
      try {
        await api.releaseGuarantee({
          companyId: parseInt(cid),
          accountCode: acc,
          moveName: move,
          notes: notes.trim()
        });
        showToast('✅ تم إفراج / استثناء الضمان بنجاح', 'success');
        await loadGuaranteesData(container, options);
      } catch (err) {
        showToast('❌ ' + err.message, 'error');
        btn.disabled = false;
        btn.textContent = '✅ إفراج';
      }
    });
  });

  // Manual unrelease
  content.querySelectorAll('[data-action="unrelease"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { cid, acc, move } = btn.dataset;
      if (!confirm('هل تريد إلغاء الاستثناء وإعادة الضمان إلى القائمة المعلّقة؟')) return;
      btn.disabled = true;
      btn.textContent = '⏳';
      try {
        await api.unreleaseGuarantee({ companyId: cid, accountCode: acc, moveName: move });
        showToast('↩️ تم إلغاء الاستثناء بنجاح', 'success');
        await loadGuaranteesData(container, options);
      } catch (err) {
        showToast('❌ ' + err.message, 'error');
        btn.disabled = false;
        btn.textContent = '↩️ إلغاء الاستثناء';
      }
    });
  });

  // Toggle sub-item release
  content.querySelectorAll('[data-action="toggle-sub"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { subid, released } = btn.dataset;
      const willRelease = released === '0';
      btn.disabled = true;
      btn.textContent = '⏳';
      try {
        await api.toggleGuaranteeSubItem(subid, { isReleased: willRelease });
        showToast(willRelease ? '✅ تم إفراج البند الفرعي' : '↩️ تم إلغاء إفراج البند الفرعي', 'success');
        await loadGuaranteesData(container, options);
      } catch (err) {
        showToast('❌ ' + err.message, 'error');
        btn.disabled = false;
        btn.textContent = willRelease ? '✅ إفراج' : '↩️ إلغاء';
      }
    });
  });

  // Delete sub-item
  content.querySelectorAll('[data-action="del-sub"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('هل أنت متأكد من حذف هذا البند الفرعي؟')) return;
      btn.disabled = true;
      try {
        await api.deleteGuaranteeSubItem(btn.dataset.subid);
        showToast('🗑️ تم حذف البند الفرعي', 'success');
        await loadGuaranteesData(container, options);
      } catch (err) {
        showToast('❌ ' + err.message, 'error');
        btn.disabled = false;
      }
    });
  });

  // Breakdown toggle
  content.querySelectorAll('[data-action="breakdown"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.key;
      const [cid, acc, move] = key.split('|');

      const existingForm = content.querySelector(`tr.gr-add-form[data-parent="${key}"]`);
      if (existingForm) {
        existingForm.remove();
        return;
      }

      const parentRow = btn.closest('tr');
      const formRow = document.createElement('tr');
      formRow.className = 'gr-add-form';
      formRow.dataset.parent = key;
      formRow.innerHTML = `
        <td colspan="9">
          <div class="gr-add-form-inner">
            <span style="font-weight:700;color:#c084fc;font-size:0.82rem">➕ إضافة بند فرعي:</span>
            <input type="text" placeholder="وصف البند / المشروع..." class="gr-input sub-desc" style="flex:2;min-width:180px">
            <input type="number" placeholder="المبلغ (ريال)" class="gr-input sub-amt" style="width:130px">
            <input type="text" placeholder="ملاحظات..." class="gr-input sub-notes" style="flex:1;min-width:140px">
            <button class="gr-btn gr-btn-add" data-action="submit-sub" data-cid="${cid}" data-acc="${acc}" data-move="${move}">💾 حفظ البند</button>
            <button class="gr-btn" data-action="cancel-sub" style="background:rgba(255,255,255,0.06);color:#cbd5e1">إلغاء</button>
          </div>
        </td>
      `;
      parentRow.after(formRow);

      const cancelBtn = formRow.querySelector('[data-action="cancel-sub"]');
      cancelBtn.addEventListener('click', () => formRow.remove());

      const submitBtn = formRow.querySelector('[data-action="submit-sub"]');
      submitBtn.addEventListener('click', async () => {
        const desc = formRow.querySelector('.sub-desc').value.trim();
        const amt = parseFloat(formRow.querySelector('.sub-amt').value) || 0;
        const notes = formRow.querySelector('.sub-notes').value.trim();

        if (!desc || !amt || amt <= 0) {
          showToast('يرجى إدخال وصف ومبلغ صالح للبند الفرعي', 'warning');
          return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = '⏳';
        try {
          await api.addGuaranteeSubItem({
            parentCompanyId: parseInt(cid),
            parentAccountCode: acc,
            parentMoveName: move,
            description: desc,
            amount: amt,
            notes
          });
          showToast('✅ تمت إضافة البند الفرعي بنجاح', 'success');
          await loadGuaranteesData(container, options);
        } catch (err) {
          showToast('❌ ' + err.message, 'error');
          submitBtn.disabled = false;
          submitBtn.textContent = '💾 حفظ البند';
        }
      });
    });
  });
}
