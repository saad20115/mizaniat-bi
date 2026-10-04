import { api } from '../api.js';
import { formatNumber, formatCurrency } from '../utils/format.js';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

let recvSubTab = 'aging'; // 'aging' | 'registry' | 'collection_matrix' | 'reconciliation' | 'conflicts'
let registryPage = 1;
let registryStatus = '';
let registrySearch = '';
let reconPage = 1;
let matrixGrain = 'quarter';
let matrixGroupBy = 'company';
let agingAsOf = '';

export async function renderReceivablesTab(body, container) {
  // Extract active company filters
  const selectedCos = [...container.querySelectorAll('.co-chip.active')].map(c => Number(c.dataset.id));
  const df = container.querySelector('#date-from')?.value || '';
  const dt = container.querySelector('#date-to')?.value || '';

  body.innerHTML = `
    <div style="direction:rtl;display:flex;flex-direction:column;gap:18px;">
      <!-- Disclaimer notice -->
      <div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.25);border-radius:12px;padding:12px 18px;display:flex;align-items:center;gap:10px;font-size:0.92rem;color:#93c5fd;">
        <span style="font-size:1.2rem;">ℹ️</span>
        <div>
          <strong>تنبيه تدقيقي لإدارة المجموعة:</strong> 
          المتبقي المعروض يمثل الرصيد الفعلي الحالي للذمة في أودو بعد كافة حركات السداد المعتمدة حتى اليوم. تحليل أعمار الذمم بتاريخ ماضٍ بدقة يتطلب تواريخ حركات السداد الجزئية (المقررة في مرحلة M2).
        </div>
      </div>

      <!-- Receivables Sub-Navigation Tabs -->
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;background:rgba(255,255,255,0.02);padding:10px 16px;border-radius:14px;border:1px solid rgba(255,255,255,0.06);">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <button class="recv-nav-btn ${recvSubTab === 'aging' ? 'active' : ''}" data-sub="aging" style="${btnStyle(recvSubTab === 'aging')}">
            ⏳ أعمار الذمم
          </button>
          <button class="recv-nav-btn ${recvSubTab === 'registry' ? 'active' : ''}" data-sub="registry" style="${btnStyle(recvSubTab === 'registry')}">
            📋 سجل الفواتير
          </button>
          <button class="recv-nav-btn ${recvSubTab === 'collection_matrix' ? 'active' : ''}" data-sub="collection_matrix" style="${btnStyle(recvSubTab === 'collection_matrix')}">
            🗓️ مصفوفة التحصيل
          </button>
          <button class="recv-nav-btn ${recvSubTab === 'reconciliation' ? 'active' : ''}" data-sub="reconciliation" style="${btnStyle(recvSubTab === 'reconciliation')}">
            ⚖️ مطابقة الأستاذ العام
          </button>
          <button class="recv-nav-btn ${recvSubTab === 'conflicts' ? 'active' : ''}" data-sub="conflicts" style="${btnStyle(recvSubTab === 'conflicts')}">
            🔍 تعارض الأقسام (52)
          </button>
        </div>

        <div id="recv-sub-controls" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <!-- Injected dynamic controls depending on subTab -->
        </div>
      </div>

      <!-- Main Subtab Content Area -->
      <div id="recv-content" style="min-height:400px;position:relative;">
        <div style="text-align:center;padding:60px 20px;color:rgba(255,255,255,0.4);font-size:1.1rem;">
          <span style="display:inline-block;animation:spin 1s linear infinite;">⏳</span> جاري تحميل تقارير التحصيل والذمم...
        </div>
      </div>
    </div>
  `;

  // Bind sub-navigation click events
  body.querySelectorAll('.recv-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      recvSubTab = btn.dataset.sub;
      renderReceivablesTab(body, container);
    });
  });

  const contentArea = body.querySelector('#recv-content');
  const controlsArea = body.querySelector('#recv-sub-controls');

  try {
    if (recvSubTab === 'aging') {
      await loadAgingView(contentArea, controlsArea, selectedCos, dt);
    } else if (recvSubTab === 'registry') {
      await loadRegistryView(contentArea, controlsArea, selectedCos, df, dt);
    } else if (recvSubTab === 'collection_matrix') {
      await loadCollectionMatrixView(contentArea, controlsArea, selectedCos, df, dt);
    } else if (recvSubTab === 'reconciliation') {
      await loadReconciliationView(contentArea, controlsArea, selectedCos);
    } else if (recvSubTab === 'conflicts') {
      await loadConflictsView(contentArea, controlsArea);
    }
  } catch (err) {
    console.error('Error loading receivables subtab:', err);
    contentArea.innerHTML = `
      <div style="text-align:center;padding:60px;color:#ef4444;font-size:1.1rem;">
        ❌ حدث خطأ أثناء تحميل البيانات: ${err.message}
      </div>
    `;
  }
}

function btnStyle(active) {
  if (active) {
    return 'background:rgba(59,130,246,0.2);border:1.5px solid #3b82f6;color:#60a5fa;border-radius:10px;padding:8px 16px;font-size:0.92rem;font-weight:700;cursor:pointer;transition:all 0.2s;';
  }
  return 'background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.6);border-radius:10px;padding:8px 16px;font-size:0.92rem;font-weight:600;cursor:pointer;transition:all 0.2s;';
}

// ==========================================
// 1. AGING VIEW (أعمار الذمم بالشرائح الـ 7)
// ==========================================
async function loadAgingView(contentArea, controlsArea, companyIds, asOfDate) {
  const params = { type: 'aging' };
  if (companyIds.length > 0) params.companyIds = companyIds;
  if (asOfDate) params.asOfDate = asOfDate;

  controlsArea.innerHTML = `
    <button class="matrix-btn btn-expand-aging" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:6px 12px;color:#fff;font-size:0.85rem;cursor:pointer;">
      ➕ توسيع الكل
    </button>
    <button class="matrix-btn btn-collapse-aging" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:6px 12px;color:#fff;font-size:0.85rem;cursor:pointer;">
      ➖ طي الكل
    </button>
    <button class="matrix-btn btn-export-aging" style="background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);border-radius:8px;padding:6px 12px;color:#10b981;font-size:0.85rem;cursor:pointer;font-weight:700;">
      📥 تصدير Excel
    </button>
    <button class="matrix-btn btn-pdf-aging" style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:6px 12px;color:#f87171;font-size:0.85rem;cursor:pointer;font-weight:700;">
      📄 تصدير PDF
    </button>
  `;

  const data = await api.getReceivables(params);
  const totals = data.totals || {};
  const tree = data.tree || [];

  const b = totals.buckets || {};
  const totRes = totals.total_residual || 0;
  const totBilled = totals.total_billed || 0;
  const totColl = totals.total_collected || 0;
  const collRate = totBilled > 0 ? (totColl / totBilled * 100).toFixed(1) : 0;

  contentArea.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:18px;">
      <!-- KPI Cards Row -->
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:14px;">
        <div class="bi-kpi"><div class="bi-kpi-label">💰 إجمالي المفوتر</div><div class="bi-kpi-value" style="color:#60a5fa;">${formatNumber(totBilled, 0)}</div><div class="bi-kpi-sub">شامل ضريبة القيمة المضافة</div></div>
        <div class="bi-kpi"><div class="bi-kpi-label">✅ إجمالي المحصّل</div><div class="bi-kpi-value" style="color:#10b981;">${formatNumber(totColl, 0)}</div><div class="bi-kpi-sub">نسبة التحصيل ${collRate}%</div></div>
        <div class="bi-kpi"><div class="bi-kpi-label">⏳ المتبقي المستحق</div><div class="bi-kpi-value" style="color:#f59e0b;">${formatNumber(totRes, 0)}</div><div class="bi-kpi-sub">ذمم مدينة قائمة</div></div>
        <div class="bi-kpi"><div class="bi-kpi-label">🚨 ديون متأخرة (>90 يوم)</div><div class="bi-kpi-value" style="color:#ef4444;">${formatNumber((b.b91_180 || 0) + (b.b181_365 || 0) + (b.over_365 || 0), 0)}</div><div class="bi-kpi-sub">${totRes > 0 ? (((b.b91_180 || 0) + (b.b181_365 || 0) + (b.over_365 || 0)) / totRes * 100).toFixed(1) : 0}% من المتبقي</div></div>
      </div>

      <!-- Aging Buckets Ribbon -->
      <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:16px 20px;">
        <div style="font-size:0.95rem;font-weight:700;color:rgba(255,255,255,0.7);margin-bottom:12px;">📊 توزيع شرائح الأعمار على مستوى المجموعة</div>
        <div style="display:grid;grid-template-columns:repeat(7, 1fr);gap:10px;">
          <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:0.8rem;color:rgba(255,255,255,0.6);">غير مستحق</div>
            <div style="font-size:1.15rem;font-weight:800;color:#10b981;font-family:var(--font-en);margin-top:4px;">${formatNumber(b.not_due || 0, 0)}</div>
            <div style="font-size:0.75rem;color:rgba(255,255,255,0.4);">${totRes > 0 ? ((b.not_due || 0) / totRes * 100).toFixed(1) : 0}%</div>
          </div>
          <div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.25);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:0.8rem;color:rgba(255,255,255,0.6);">1–30 يوم</div>
            <div style="font-size:1.15rem;font-weight:800;color:#60a5fa;font-family:var(--font-en);margin-top:4px;">${formatNumber(b.b1_30 || 0, 0)}</div>
            <div style="font-size:0.75rem;color:rgba(255,255,255,0.4);">${totRes > 0 ? ((b.b1_30 || 0) / totRes * 100).toFixed(1) : 0}%</div>
          </div>
          <div style="background:rgba(14,165,233,0.08);border:1px solid rgba(14,165,233,0.25);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:0.8rem;color:rgba(255,255,255,0.6);">31–60 يوم</div>
            <div style="font-size:1.15rem;font-weight:800;color:#38bdf8;font-family:var(--font-en);margin-top:4px;">${formatNumber(b.b31_60 || 0, 0)}</div>
            <div style="font-size:0.75rem;color:rgba(255,255,255,0.4);">${totRes > 0 ? ((b.b31_60 || 0) / totRes * 100).toFixed(1) : 0}%</div>
          </div>
          <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:0.8rem;color:rgba(255,255,255,0.6);">61–90 يوم</div>
            <div style="font-size:1.15rem;font-weight:800;color:#f59e0b;font-family:var(--font-en);margin-top:4px;">${formatNumber(b.b61_90 || 0, 0)}</div>
            <div style="font-size:0.75rem;color:rgba(255,255,255,0.4);">${totRes > 0 ? ((b.b61_90 || 0) / totRes * 100).toFixed(1) : 0}%</div>
          </div>
          <div style="background:rgba(249,115,22,0.08);border:1px solid rgba(249,115,22,0.25);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:0.8rem;color:rgba(255,255,255,0.6);">91–180 يوم</div>
            <div style="font-size:1.15rem;font-weight:800;color:#fb923c;font-family:var(--font-en);margin-top:4px;">${formatNumber(b.b91_180 || 0, 0)}</div>
            <div style="font-size:0.75rem;color:rgba(255,255,255,0.4);">${totRes > 0 ? ((b.b91_180 || 0) / totRes * 100).toFixed(1) : 0}%</div>
          </div>
          <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:0.8rem;color:rgba(255,255,255,0.6);">181–365 يوم</div>
            <div style="font-size:1.15rem;font-weight:800;color:#f87171;font-family:var(--font-en);margin-top:4px;">${formatNumber(b.b181_365 || 0, 0)}</div>
            <div style="font-size:0.75rem;color:rgba(255,255,255,0.4);">${totRes > 0 ? ((b.b181_365 || 0) / totRes * 100).toFixed(1) : 0}%</div>
          </div>
          <div style="background:rgba(220,38,38,0.12);border:1.5px solid rgba(220,38,38,0.4);border-radius:10px;padding:10px;text-align:center;">
            <div style="font-size:0.8rem;color:#fca5a5;font-weight:700;">أكثر من 365 يوم</div>
            <div style="font-size:1.15rem;font-weight:800;color:#ef4444;font-family:var(--font-en);margin-top:4px;">${formatNumber(b.over_365 || 0, 0)}</div>
            <div style="font-size:0.75rem;color:rgba(255,255,255,0.4);">${totRes > 0 ? ((b.over_365 || 0) / totRes * 100).toFixed(1) : 0}%</div>
          </div>
        </div>
      </div>

      <!-- Aging Hierarchical Table -->
      <div style="max-height:640px;overflow:auto;border-radius:14px;border:1px solid rgba(255,255,255,0.08);background:rgba(15,23,42,0.6);">
        <table class="bi-table" style="width:100%;border-collapse:separate;border-spacing:0;font-size:0.92rem;text-align:right;">
          <thead style="position:sticky;top:0;z-index:10;background:#0d1527;">
            <tr>
              <th style="padding:14px 18px;min-width:280px;position:sticky;right:0;background:#0d1527;z-index:15;">الشركة / القسم / العميل</th>
              <th style="text-align:left;color:#10b981;">غير مستحق</th>
              <th style="text-align:left;color:#60a5fa;">1–30 يوم</th>
              <th style="text-align:left;color:#38bdf8;">31–60 يوم</th>
              <th style="text-align:left;color:#f59e0b;">61–90 يوم</th>
              <th style="text-align:left;color:#fb923c;">91–180 يوم</th>
              <th style="text-align:left;color:#f87171;">181–365 يوم</th>
              <th style="text-align:left;color:#ef4444;">> 365 يوم</th>
              <th style="text-align:left;color:#60a5fa;font-weight:800;">إجمالي المتبقي</th>
            </tr>
          </thead>
          <tbody>
            ${renderAgingTreeRows(tree)}
          </tbody>
          <tfoot style="position:sticky;bottom:0;z-index:10;background:#0d1527;font-weight:800;">
            <tr style="border-top:2px solid rgba(255,255,255,0.2);">
              <td style="padding:16px 18px;position:sticky;right:0;background:#0d1527;z-index:15;font-size:1.05rem;">الإجمالي العام للذمم</td>
              <td style="text-align:left;font-family:var(--font-en);color:#10b981;">${formatNumber(b.not_due || 0, 0)}</td>
              <td style="text-align:left;font-family:var(--font-en);color:#60a5fa;">${formatNumber(b.b1_30 || 0, 0)}</td>
              <td style="text-align:left;font-family:var(--font-en);color:#38bdf8;">${formatNumber(b.b31_60 || 0, 0)}</td>
              <td style="text-align:left;font-family:var(--font-en);color:#f59e0b;">${formatNumber(b.b61_90 || 0, 0)}</td>
              <td style="text-align:left;font-family:var(--font-en);color:#fb923c;">${formatNumber(b.b91_180 || 0, 0)}</td>
              <td style="text-align:left;font-family:var(--font-en);color:#f87171;">${formatNumber(b.b181_365 || 0, 0)}</td>
              <td style="text-align:left;font-family:var(--font-en);color:#ef4444;">${formatNumber(b.over_365 || 0, 0)}</td>
              <td style="text-align:left;font-family:var(--font-en);color:#60a5fa;font-size:1.15rem;">${formatNumber(totRes, 0)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;

  // Bind tree row toggle clicks
  contentArea.querySelectorAll('.aging-node-row').forEach(row => {
    row.addEventListener('click', () => {
      const rowId = row.dataset.id;
      const isOpen = row.classList.contains('open');
      row.classList.toggle('open', !isOpen);
      row.querySelector('.tree-arrow')?.style.setProperty('transform', !isOpen ? 'rotate(90deg)' : 'rotate(0deg)');
      // Toggle children visibility
      contentArea.querySelectorAll(`.child-of-${rowId}`).forEach(ch => {
        ch.style.display = !isOpen ? 'table-row' : 'none';
        if (isOpen) {
          // Recursively collapse descendants
          ch.classList.remove('open');
          ch.querySelector('.tree-arrow')?.style.setProperty('transform', 'rotate(0deg)');
          const chId = ch.dataset.id;
          if (chId) {
            contentArea.querySelectorAll(`.child-of-${chId}`).forEach(desc => desc.style.display = 'none');
          }
        }
      });
    });
  });

  // Expand all
  controlsArea.querySelector('.btn-expand-aging')?.addEventListener('click', () => {
    contentArea.querySelectorAll('.aging-node-row').forEach(r => {
      r.classList.add('open');
      r.querySelector('.tree-arrow')?.style.setProperty('transform', 'rotate(90deg)');
    });
    contentArea.querySelectorAll('tr[class*="child-of-"]').forEach(r => r.style.display = 'table-row');
  });

  // Collapse all
  controlsArea.querySelector('.btn-collapse-aging')?.addEventListener('click', () => {
    contentArea.querySelectorAll('.aging-node-row').forEach(r => {
      r.classList.remove('open');
      r.querySelector('.tree-arrow')?.style.setProperty('transform', 'rotate(0deg)');
    });
    contentArea.querySelectorAll('tr[class*="child-of-"]').forEach(r => r.style.display = 'none');
  });

  // Export CSV
  controlsArea.querySelector('.btn-export-aging')?.addEventListener('click', () => {
    exportAgingCSV(tree, totals);
  });

  // Export PDF
  controlsArea.querySelector('.btn-pdf-aging')?.addEventListener('click', () => {
    exportAgingPDF(tree, totals, asOfDate);
  });
}

function renderAgingTreeRows(tree) {
  let html = '';
  for (const co of tree) {
    const coId = `co_${co.id || co.company_id}`;
    const coName = co.name || co.company_name || 'بدون اسم شركة';
    const cb = co.buckets || {};
    html += `
      <tr class="aging-node-row level-0 open" data-id="${coId}" style="background:rgba(255,255,255,0.04);cursor:pointer;font-weight:700;">
        <td style="padding:12px 16px;position:sticky;right:0;background:#111b2e;z-index:5;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="tree-arrow" style="display:inline-block;transition:transform 0.2s;transform:rotate(90deg);font-size:0.7rem;color:rgba(255,255,255,0.5);">▶</span>
            <span>🏢</span>
            <span>${coName}</span>
          </div>
        </td>
        <td style="text-align:left;font-family:var(--font-en);">${formatNumber(cb.not_due || 0, 0)}</td>
        <td style="text-align:left;font-family:var(--font-en);">${formatNumber(cb.b1_30 || 0, 0)}</td>
        <td style="text-align:left;font-family:var(--font-en);">${formatNumber(cb.b31_60 || 0, 0)}</td>
        <td style="text-align:left;font-family:var(--font-en);">${formatNumber(cb.b61_90 || 0, 0)}</td>
        <td style="text-align:left;font-family:var(--font-en);">${formatNumber(cb.b91_180 || 0, 0)}</td>
        <td style="text-align:left;font-family:var(--font-en);">${formatNumber(cb.b181_365 || 0, 0)}</td>
        <td style="text-align:left;font-family:var(--font-en);color:#ef4444;">${formatNumber(cb.over_365 || 0, 0)}</td>
        <td style="text-align:left;font-family:var(--font-en);font-weight:800;color:#60a5fa;">${formatNumber(co.total_residual || 0, 0)}</td>
      </tr>
    `;

    for (const dept of co.departments || []) {
      const deptId = `${coId}_dept_${dept.id || dept.department_id}`;
      const deptName = dept.name || dept.department_name || 'غير مصنّف';
      const db = dept.buckets || {};
      html += `
        <tr class="aging-node-row child-of-${coId} level-1" data-id="${deptId}" style="cursor:pointer;font-weight:600;background:rgba(255,255,255,0.015);">
          <td style="padding:10px 16px 10px 32px;position:sticky;right:0;background:#0e1726;z-index:5;">
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="tree-arrow" style="display:inline-block;transition:transform 0.2s;font-size:0.65rem;color:rgba(255,255,255,0.4);">▶</span>
              <span>📁</span>
              <span>${deptName}</span>
            </div>
          </td>
          <td style="text-align:left;font-family:var(--font-en);">${formatNumber(db.not_due || 0, 0)}</td>
          <td style="text-align:left;font-family:var(--font-en);">${formatNumber(db.b1_30 || 0, 0)}</td>
          <td style="text-align:left;font-family:var(--font-en);">${formatNumber(db.b31_60 || 0, 0)}</td>
          <td style="text-align:left;font-family:var(--font-en);">${formatNumber(db.b61_90 || 0, 0)}</td>
          <td style="text-align:left;font-family:var(--font-en);">${formatNumber(db.b91_180 || 0, 0)}</td>
          <td style="text-align:left;font-family:var(--font-en);">${formatNumber(db.b181_365 || 0, 0)}</td>
          <td style="text-align:left;font-family:var(--font-en);color:#ef4444;">${formatNumber(db.over_365 || 0, 0)}</td>
          <td style="text-align:left;font-family:var(--font-en);font-weight:700;color:#60a5fa;">${formatNumber(dept.total_residual || 0, 0)}</td>
        </tr>
      `;

      for (const partner of dept.partners || []) {
        const partnerId = `${deptId}_pt_${partner.id || partner.partner_id || 0}`;
        const partnerName = partner.name || partner.partner_name || 'بدون عميل';
        const pb = partner.buckets || {};
        html += `
          <tr class="aging-node-row child-of-${coId} child-of-${deptId} level-2" data-id="${partnerId}" style="display:none;cursor:pointer;font-size:0.88rem;color:rgba(255,255,255,0.85);">
            <td style="padding:8px 16px 8px 52px;position:sticky;right:0;background:#0d1527;z-index:5;">
              <div style="display:flex;align-items:center;gap:6px;">
                <span class="tree-arrow" style="display:inline-block;transition:transform 0.2s;font-size:0.6rem;color:rgba(255,255,255,0.3);">▶</span>
                <span>👤</span>
                <span title="${partnerName}">${partnerName}</span>
                <span style="font-size:0.75rem;color:rgba(255,255,255,0.4);">(${partner.invoices?.length || 0})</span>
              </div>
            </td>
            <td style="text-align:left;font-family:var(--font-en);">${formatNumber(pb.not_due || 0, 0)}</td>
            <td style="text-align:left;font-family:var(--font-en);">${formatNumber(pb.b1_30 || 0, 0)}</td>
            <td style="text-align:left;font-family:var(--font-en);">${formatNumber(pb.b31_60 || 0, 0)}</td>
            <td style="text-align:left;font-family:var(--font-en);">${formatNumber(pb.b61_90 || 0, 0)}</td>
            <td style="text-align:left;font-family:var(--font-en);">${formatNumber(pb.b91_180 || 0, 0)}</td>
            <td style="text-align:left;font-family:var(--font-en);">${formatNumber(pb.b181_365 || 0, 0)}</td>
            <td style="text-align:left;font-family:var(--font-en);color:#ef4444;">${formatNumber(pb.over_365 || 0, 0)}</td>
            <td style="text-align:left;font-family:var(--font-en);font-weight:600;color:#93c5fd;">${formatNumber(partner.total_residual || 0, 0)}</td>
          </tr>
        `;

        for (const inv of partner.invoices || []) {
          const invDays = inv.age_days || 0;
          html += `
            <tr class="child-of-${coId} child-of-${deptId} child-of-${partnerId} level-3" style="display:none;font-size:0.82rem;color:rgba(255,255,255,0.6);background:rgba(255,255,255,0.01);">
              <td style="padding:6px 16px 6px 72px;position:sticky;right:0;background:#0d1527;z-index:5;">
                <div style="display:flex;align-items:center;gap:6px;">
                  <span>🧾</span>
                  <span style="font-family:var(--font-en);color:#fff;">${inv.name}</span>
                  <span style="font-size:0.75rem;color:rgba(255,255,255,0.4);">(${inv.date})</span>
                  <span style="font-size:0.75rem;padding:1px 6px;border-radius:4px;background:rgba(255,255,255,0.06);">${invDays} يوم</span>
                </div>
              </td>
              <td style="text-align:left;font-family:var(--font-en);">${invDays <= 0 ? formatNumber(inv.residual, 0) : '—'}</td>
              <td style="text-align:left;font-family:var(--font-en);">${invDays > 0 && invDays <= 30 ? formatNumber(inv.residual, 0) : '—'}</td>
              <td style="text-align:left;font-family:var(--font-en);">${invDays > 30 && invDays <= 60 ? formatNumber(inv.residual, 0) : '—'}</td>
              <td style="text-align:left;font-family:var(--font-en);">${invDays > 60 && invDays <= 90 ? formatNumber(inv.residual, 0) : '—'}</td>
              <td style="text-align:left;font-family:var(--font-en);">${invDays > 90 && invDays <= 180 ? formatNumber(inv.residual, 0) : '—'}</td>
              <td style="text-align:left;font-family:var(--font-en);">${invDays > 180 && invDays <= 365 ? formatNumber(inv.residual, 0) : '—'}</td>
              <td style="text-align:left;font-family:var(--font-en);color:#ef4444;">${invDays > 365 ? formatNumber(inv.residual, 0) : '—'}</td>
              <td style="text-align:left;font-family:var(--font-en);color:#fff;">${formatNumber(inv.residual, 0)}</td>
            </tr>
          `;
        }
      }
    }
  }
  return html;
}

function exportAgingCSV(tree, totals) {
  const header = ['الشركة / القسم / العميل', 'المستوى', 'غير مستحق', '1-30 يوم', '31-60 يوم', '61-90 يوم', '91-180 يوم', '181-365 يوم', 'أكثر من 365 يوم', 'إجمالي المتبقي'];
  const rows = [header.join(',')];

  for (const co of tree) {
    const coName = co.name || co.company_name || 'بدون اسم';
    const cb = co.buckets || {};
    rows.push([`"${coName.replace(/"/g, '""')}"`, 'شركة', cb.not_due||0, cb.b1_30||0, cb.b31_60||0, cb.b61_90||0, cb.b91_180||0, cb.b181_365||0, cb.over_365||0, co.total_residual||0].join(','));
    for (const dept of co.departments || []) {
      const deptName = dept.name || dept.department_name || 'غير مصنّف';
      const db = dept.buckets || {};
      rows.push([`"  ${deptName.replace(/"/g, '""')}"`, 'قسم', db.not_due||0, db.b1_30||0, db.b31_60||0, db.b61_90||0, db.b91_180||0, db.b181_365||0, db.over_365||0, dept.total_residual||0].join(','));
      for (const pt of dept.partners || []) {
        const ptName = pt.name || pt.partner_name || 'بدون عميل';
        const pb = pt.buckets || {};
        rows.push([`"    ${ptName.replace(/"/g, '""')}"`, 'عميل', pb.not_due||0, pb.b1_30||0, pb.b31_60||0, pb.b61_90||0, pb.b91_180||0, pb.b181_365||0, pb.over_365||0, pt.total_residual||0].join(','));
      }
    }
  }

  const tb = totals.buckets || {};
  rows.push(['"الإجمالي العام"', 'إجمالي', tb.not_due||0, tb.b1_30||0, tb.b31_60||0, tb.b61_90||0, tb.b91_180||0, tb.b181_365||0, tb.over_365||0, totals.total_residual||0].join(','));

  const csvContent = '\uFEFF' + rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `receivables_aging_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function exportElementToLandscapePdf(element, filename) {
  document.body.appendChild(element);
  try {
    const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
    document.body.removeChild(element);
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
    const mt = 12, mb = 12, mx = 10, uw = pw - mx * 2, uh = ph - mt - mb;
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
    doc.save(filename);
  } catch (err) {
    if (element.parentNode) document.body.removeChild(element);
    console.error('PDF export error:', err);
    alert('حدث خطأ أثناء تصدير PDF: ' + err.message);
  }
}

async function exportAgingPDF(tree, totals, asOfDate) {
  const printTime = new Date().toLocaleString('ar-SA');
  const asOf = asOfDate || new Date().toISOString().slice(0, 10);
  const tb = totals.buckets || {};

  let rowsHtml = '';
  for (const co of tree) {
    const coName = co.name || co.company_name || 'بدون اسم';
    const cb = co.buckets || {};
    rowsHtml += `
      <tr style="background:#f1f5f9;font-weight:700;font-size:10px;border-bottom:1px solid #cbd5e1;">
        <td style="padding:6px 8px;border:1px solid #cbd5e1;text-align:right;">🏢 ${coName}</td>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;">${cb.not_due ? formatNumber(cb.not_due, 0) : '—'}</td>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;">${cb.b1_30 ? formatNumber(cb.b1_30, 0) : '—'}</td>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;">${cb.b31_60 ? formatNumber(cb.b31_60, 0) : '—'}</td>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;">${cb.b61_90 ? formatNumber(cb.b61_90, 0) : '—'}</td>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;">${cb.b91_180 ? formatNumber(cb.b91_180, 0) : '—'}</td>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;">${cb.b181_365 ? formatNumber(cb.b181_365, 0) : '—'}</td>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;color:#dc2626;">${cb.over_365 ? formatNumber(cb.over_365, 0) : '—'}</td>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;text-align:left;font-weight:800;font-family:sans-serif;color:#0284c7;">${formatNumber(co.total_residual || 0, 0)}</td>
      </tr>
    `;

    for (const dept of co.departments || []) {
      const deptName = dept.name || dept.department_name || 'غير مصنّف';
      const db = dept.buckets || {};
      rowsHtml += `
        <tr style="background:#f8fafc;font-weight:600;font-size:9.5px;border-bottom:1px solid #e2e8f0;">
          <td style="padding:5px 8px 5px 20px;border:1px solid #cbd5e1;text-align:right;">📁 ${deptName}</td>
          <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;">${db.not_due ? formatNumber(db.not_due, 0) : '—'}</td>
          <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;">${db.b1_30 ? formatNumber(db.b1_30, 0) : '—'}</td>
          <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;">${db.b31_60 ? formatNumber(db.b31_60, 0) : '—'}</td>
          <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;">${db.b61_90 ? formatNumber(db.b61_90, 0) : '—'}</td>
          <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;">${db.b91_180 ? formatNumber(db.b91_180, 0) : '—'}</td>
          <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;">${db.b181_365 ? formatNumber(db.b181_365, 0) : '—'}</td>
          <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;color:#dc2626;">${db.over_365 ? formatNumber(db.over_365, 0) : '—'}</td>
          <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:left;font-weight:700;font-family:sans-serif;">${formatNumber(dept.total_residual || 0, 0)}</td>
        </tr>
      `;

      for (const pt of dept.partners || []) {
        const ptName = pt.name || pt.partner_name || 'بدون عميل';
        const pb = pt.buckets || {};
        rowsHtml += `
          <tr style="background:#ffffff;font-size:9px;border-bottom:1px solid #e2e8f0;">
            <td style="padding:4px 8px 4px 34px;border:1px solid #cbd5e1;text-align:right;">👤 ${ptName} (${pt.invoices?.length || 0})</td>
            <td style="padding:4px 8px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;">${pb.not_due ? formatNumber(pb.not_due, 0) : '—'}</td>
            <td style="padding:4px 8px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;">${pb.b1_30 ? formatNumber(pb.b1_30, 0) : '—'}</td>
            <td style="padding:4px 8px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;">${pb.b31_60 ? formatNumber(pb.b31_60, 0) : '—'}</td>
            <td style="padding:4px 8px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;">${pb.b61_90 ? formatNumber(pb.b61_90, 0) : '—'}</td>
            <td style="padding:4px 8px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;">${pb.b91_180 ? formatNumber(pb.b91_180, 0) : '—'}</td>
            <td style="padding:4px 8px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;">${pb.b181_365 ? formatNumber(pb.b181_365, 0) : '—'}</td>
            <td style="padding:4px 8px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;color:#dc2626;">${pb.over_365 ? formatNumber(pb.over_365, 0) : '—'}</td>
            <td style="padding:4px 8px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;color:#0369a1;">${formatNumber(pt.total_residual || 0, 0)}</td>
          </tr>
        `;
      }
    }
  }

  const tempDiv = document.createElement('div');
  tempDiv.style.cssText = 'position:fixed;top:-9999px;left:0;width:1150px;background:#ffffff;color:#0f172a;padding:24px;font-family:system-ui,-apple-system,sans-serif;direction:rtl;';
  tempDiv.innerHTML = `
    <div style="border-bottom:2px solid #0284c7;padding-bottom:12px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-end;">
      <div>
        <h2 style="margin:0 0 4px 0;color:#0f172a;font-size:18px;font-weight:800;">تقرير أعمار الذمم المدينة للعملاء</h2>
        <div style="font-size:11px;color:#475569;">تاريخ الاستحقاق حتى: ${asOf}</div>
      </div>
      <div style="text-align:left;font-size:10px;color:#64748b;">
        <div style="font-weight:700;color:#0f172a;">مجموعة شركات المهندس جمال حريري</div>
        <div>تاريخ الطباعة: ${printTime}</div>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;border:1px solid #cbd5e1;text-align:right;">
      <thead>
        <tr style="background:#0f172a;color:#ffffff;font-size:10px;">
          <th style="padding:7px;border:1px solid #334155;text-align:right;min-width:260px;">الشركة / القسم / العميل</th>
          <th style="padding:7px;border:1px solid #334155;text-align:left;">غير مستحق</th>
          <th style="padding:7px;border:1px solid #334155;text-align:left;">1 - 30</th>
          <th style="padding:7px;border:1px solid #334155;text-align:left;">31 - 60</th>
          <th style="padding:7px;border:1px solid #334155;text-align:left;">61 - 90</th>
          <th style="padding:7px;border:1px solid #334155;text-align:left;">91 - 180</th>
          <th style="padding:7px;border:1px solid #334155;text-align:left;">181 - 365</th>
          <th style="padding:7px;border:1px solid #334155;text-align:left;color:#fca5a5;">+365</th>
          <th style="padding:7px;border:1px solid #334155;text-align:left;color:#38bdf8;">إجمالي المتبقي</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
      <tfoot>
        <tr style="background:#f1f5f9;font-weight:800;font-size:10.5px;border-top:2px solid #0f172a;">
          <td style="padding:8px;border:1px solid #cbd5e1;text-align:right;">الإجمالي العام للمجموعة</td>
          <td style="padding:8px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;">${formatNumber(tb.not_due || 0, 0)}</td>
          <td style="padding:8px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;">${formatNumber(tb.b1_30 || 0, 0)}</td>
          <td style="padding:8px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;">${formatNumber(tb.b31_60 || 0, 0)}</td>
          <td style="padding:8px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;">${formatNumber(tb.b61_90 || 0, 0)}</td>
          <td style="padding:8px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;">${formatNumber(tb.b91_180 || 0, 0)}</td>
          <td style="padding:8px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;">${formatNumber(tb.b181_365 || 0, 0)}</td>
          <td style="padding:8px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;color:#dc2626;">${formatNumber(tb.over_365 || 0, 0)}</td>
          <td style="padding:8px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;color:#0284c7;">${formatNumber(totals.total_residual || 0, 0)}</td>
        </tr>
      </tfoot>
    </table>
    <div style="text-align:center;margin-top:14px;font-size:10px;color:#64748b;">Mizaniat BI | تقرير أعمار الذمم المعتمد</div>
  `;

  await exportElementToLandscapePdf(tempDiv, `receivables_aging_${asOf}.pdf`);
}

// ==========================================
// 2. INVOICE REGISTRY (سجل الفواتير التفصيلي)
// ==========================================
async function loadRegistryView(contentArea, controlsArea, companyIds, dateFrom, dateTo) {
  controlsArea.innerHTML = `
    <select id="reg-status-filter" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:6px 12px;color:#fff;font-size:0.85rem;outline:none;">
      <option value="" ${registryStatus===''?'selected':''}>جميع الحالات</option>
      <option value="not_paid" ${registryStatus==='not_paid'?'selected':''}>غير مسددة</option>
      <option value="partial" ${registryStatus==='partial'?'selected':''}>مسددة جزئياً</option>
      <option value="paid" ${registryStatus==='paid'?'selected':''}>مسددة بالكامل</option>
      <option value="reversed" ${registryStatus==='reversed'?'selected':''}>ملغاة / معكوسة</option>
    </select>
    <input type="text" id="reg-search-input" placeholder="رقم الفاتورة أو العميل..." value="${registrySearch}" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:6px 12px;color:#fff;font-size:0.85rem;width:170px;outline:none;">
    <button class="matrix-btn btn-export-reg" style="background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);border-radius:8px;padding:6px 12px;color:#10b981;font-size:0.85rem;cursor:pointer;font-weight:700;">
      📥 تصدير Excel
    </button>
    <button class="matrix-btn btn-pdf-reg" style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:6px 12px;color:#f87171;font-size:0.85rem;cursor:pointer;font-weight:700;">
      📄 تصدير PDF
    </button>
  `;

  const params = {
    type: 'registry',
    page: registryPage,
    limit: 50
  };
  if (companyIds.length > 0) params.companyIds = companyIds;
  if (dateFrom) params.dateFrom = dateFrom;
  if (dateTo) params.dateTo = dateTo;
  if (registryStatus) params.paymentState = registryStatus;
  if (registrySearch) params.partnerName = registrySearch;

  const data = await api.getReceivables(params);
  const items = data.invoices || data.items || [];
  const pag = data.pagination || { page: 1, totalPages: 1, totalCount: 0 };
  const tot = data.summary || data.totals || {};
  const totalBilled = tot.total_billed !== undefined ? tot.total_billed : (tot.totalAmount || 0);
  const totalCollected = tot.total_collected !== undefined ? tot.total_collected : (tot.collectedAmount || 0);
  const totalResidual = tot.total_outstanding !== undefined ? tot.total_outstanding : (tot.residualAmount || 0);

  contentArea.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px;">
      <!-- Summary Bar -->
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:14px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:12px 18px;">
        <div style="display:flex;align-items:center;gap:18px;font-size:0.92rem;">
          <div>عدد الفواتير: <strong style="color:#60a5fa;font-family:var(--font-en);">${formatNumber(pag.totalCount, 0)}</strong></div>
          <div>إجمالي المبالغ: <strong style="color:#fff;font-family:var(--font-en);">${formatNumber(totalBilled, 0)}</strong></div>
          <div>المسدد: <strong style="color:#10b981;font-family:var(--font-en);">${formatNumber(totalCollected, 0)}</strong></div>
          <div>المتبقي: <strong style="color:#f59e0b;font-family:var(--font-en);">${formatNumber(totalResidual, 0)}</strong></div>
        </div>

        <!-- Pagination Controls -->
        <div style="display:flex;align-items:center;gap:8px;">
          <button class="matrix-btn btn-page-prev" ${pag.page <= 1 ? 'disabled style="opacity:0.4;cursor:default;"' : 'style="cursor:pointer;"'}>
            السابق
          </button>
          <span style="font-size:0.88rem;color:rgba(255,255,255,0.6);font-family:var(--font-en);">
            ${pag.page} / ${pag.totalPages || 1}
          </span>
          <button class="matrix-btn btn-page-next" ${pag.page >= pag.totalPages ? 'disabled style="opacity:0.4;cursor:default;"' : 'style="cursor:pointer;"'}>
            التالي
          </button>
        </div>
      </div>

      <!-- Invoices Registry Table -->
      <div style="max-height:600px;overflow:auto;border-radius:14px;border:1px solid rgba(255,255,255,0.08);background:rgba(15,23,42,0.6);">
        <table class="bi-table" style="width:100%;border-collapse:separate;border-spacing:0;font-size:0.9rem;text-align:right;">
          <thead style="position:sticky;top:0;z-index:10;background:#0d1527;">
            <tr>
              <th style="padding:12px 14px;">رقم الفاتورة</th>
              <th style="padding:12px 14px;">العميل</th>
              <th style="padding:12px 14px;">الشركة</th>
              <th style="padding:12px 14px;">القسم المعتمد</th>
              <th style="padding:12px 14px;">تاريخ الفاتورة</th>
              <th style="padding:12px 14px;">تاريخ الاستحقاق</th>
              <th style="text-align:left;">الإجمالي</th>
              <th style="text-align:left;color:#10b981;">المسدد</th>
              <th style="text-align:left;color:#f59e0b;">المتبقي</th>
              <th style="text-align:center;">الحالة</th>
              <th style="text-align:center;">عمر الدين</th>
            </tr>
          </thead>
          <tbody>
            ${items.length === 0 ? `
              <tr><td colspan="11" style="text-align:center;padding:40px;color:rgba(255,255,255,0.4);">لا توجد فواتير مطابقة</td></tr>
            ` : items.map(inv => {
              let stateBadge = '';
              if (inv.payment_state === 'paid') stateBadge = '<span style="background:rgba(16,185,129,0.15);color:#10b981;padding:2px 8px;border-radius:6px;font-size:0.75rem;font-weight:700;">مسددة</span>';
              else if (inv.payment_state === 'partial') stateBadge = '<span style="background:rgba(245,158,11,0.15);color:#f59e0b;padding:2px 8px;border-radius:6px;font-size:0.75rem;font-weight:700;">سداد جزئي</span>';
              else if (inv.payment_state === 'reversed') stateBadge = '<span style="background:rgba(139,92,246,0.15);color:#a78bfa;padding:2px 8px;border-radius:6px;font-size:0.75rem;font-weight:700;">معكوسة</span>';
              else stateBadge = '<span style="background:rgba(239,68,68,0.15);color:#ef4444;padding:2px 8px;border-radius:6px;font-size:0.75rem;font-weight:700;">غير مسددة</span>';

              const age = inv.age_days || 0;
              let ageColor = 'rgba(255,255,255,0.6)';
              if (age > 180) ageColor = '#ef4444';
              else if (age > 90) ageColor = '#f59e0b';
              else if (age > 30) ageColor = '#38bdf8';

              const collAmt = inv.collected !== undefined ? inv.collected : (inv.amount_collected || 0);

              return `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.03);">
                  <td style="padding:10px 14px;font-family:var(--font-en);font-weight:700;color:#fff;">${inv.name}</td>
                  <td style="padding:10px 14px;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${inv.partner_name}">${inv.partner_name}</td>
                  <td style="padding:10px 14px;font-size:0.82rem;color:rgba(255,255,255,0.7);">${inv.company_name}</td>
                  <td style="padding:10px 14px;font-size:0.85rem;color:#93c5fd;">${inv.department_name}</td>
                  <td style="padding:10px 14px;font-family:var(--font-en);color:rgba(255,255,255,0.6);">${inv.date}</td>
                  <td style="padding:10px 14px;font-family:var(--font-en);color:rgba(255,255,255,0.6);">${inv.invoice_date_due || '—'}</td>
                  <td style="text-align:left;font-family:var(--font-en);font-weight:700;">${formatNumber(inv.amount_total, 0)}</td>
                  <td style="text-align:left;font-family:var(--font-en);color:#10b981;">${formatNumber(collAmt, 0)}</td>
                  <td style="text-align:left;font-family:var(--font-en);font-weight:700;color:#f59e0b;">${formatNumber(inv.amount_residual_signed, 0)}</td>
                  <td style="text-align:center;">${stateBadge}</td>
                  <td style="text-align:center;font-family:var(--font-en);font-weight:700;color:${ageColor};">${age} يوم</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Bind controls
  controlsArea.querySelector('#reg-status-filter')?.addEventListener('change', (e) => {
    registryStatus = e.target.value;
    registryPage = 1;
    loadRegistryView(contentArea, controlsArea, companyIds, dateFrom, dateTo);
  });

  const searchInput = controlsArea.querySelector('#reg-search-input');
  if (searchInput) {
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        registrySearch = e.target.value.trim();
        registryPage = 1;
        loadRegistryView(contentArea, controlsArea, companyIds, dateFrom, dateTo);
      }
    });
  }

  contentArea.querySelector('.btn-page-prev')?.addEventListener('click', () => {
    if (registryPage > 1) {
      registryPage--;
      loadRegistryView(contentArea, controlsArea, companyIds, dateFrom, dateTo);
    }
  });

  contentArea.querySelector('.btn-page-next')?.addEventListener('click', () => {
    if (registryPage < pag.totalPages) {
      registryPage++;
      loadRegistryView(contentArea, controlsArea, companyIds, dateFrom, dateTo);
    }
  });

  controlsArea.querySelector('.btn-export-reg')?.addEventListener('click', async () => {
    // Export up to 2000 records
    const expParams = { ...params, limit: 2000, page: 1 };
    const expData = await api.getReceivables(expParams);
    const expItems = expData.items || [];
    const header = ['رقم الفاتورة', 'العميل', 'الشركة', 'القسم', 'التاريخ', 'الاستحقاق', 'المبلغ الإجمالي', 'المسدد', 'المتبقي', 'الحالة', 'عمر الدين'];
    const rows = [header.join(',')];
    for (const inv of expItems) {
      rows.push([
        `"${inv.name}"`,
        `"${(inv.partner_name || '').replace(/"/g, '""')}"`,
        `"${inv.company_name}"`,
        `"${inv.department_name}"`,
        inv.date,
        inv.invoice_date_due || '',
        inv.amount_total,
        inv.amount_collected,
        inv.amount_residual_signed,
        inv.payment_state,
        inv.age_days
      ].join(','));
    }
    const csvContent = '\uFEFF' + rows.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales_invoices_${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });

  controlsArea.querySelector('.btn-pdf-reg')?.addEventListener('click', async () => {
    exportRegistryPDF(params);
  });
}

async function exportRegistryPDF(params) {
  const expParams = { ...params, limit: 500, page: 1 };
  const expData = await api.getReceivables(expParams);
  const expItems = expData.invoices || expData.items || [];
  const printTime = new Date().toLocaleString('ar-SA');

  let trs = '';
  let sumTotal = 0, sumColl = 0, sumRes = 0;
  for (const inv of expItems) {
    const totAmt = inv.amount_total || 0;
    const collAmt = inv.amount_collected || 0;
    const resAmt = inv.amount_residual_signed || 0;
    sumTotal += totAmt;
    sumColl += collAmt;
    sumRes += resAmt;
    const stateLabel = inv.payment_state === 'paid' ? 'مسددة' :
                       inv.payment_state === 'partial' ? 'جزئي' :
                       inv.payment_state === 'reversed' ? 'ملغاة' : 'غير مسددة';
    trs += `
      <tr style="border-bottom:1px solid #e2e8f0;font-size:9px;">
        <td style="padding:4px 6px;border:1px solid #cbd5e1;font-weight:700;">${inv.name || ''}</td>
        <td style="padding:4px 6px;border:1px solid #cbd5e1;">${inv.partner_name || ''}</td>
        <td style="padding:4px 6px;border:1px solid #cbd5e1;">${inv.company_name || ''}</td>
        <td style="padding:4px 6px;border:1px solid #cbd5e1;">${inv.department_name || ''}</td>
        <td style="padding:4px 6px;border:1px solid #cbd5e1;font-family:sans-serif;">${inv.date || ''}</td>
        <td style="padding:4px 6px;border:1px solid #cbd5e1;font-family:sans-serif;">${inv.invoice_date_due || ''}</td>
        <td style="padding:4px 6px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;">${formatNumber(totAmt, 0)}</td>
        <td style="padding:4px 6px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;color:#15803d;">${formatNumber(collAmt, 0)}</td>
        <td style="padding:4px 6px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;color:#b45309;font-weight:700;">${formatNumber(resAmt, 0)}</td>
        <td style="padding:4px 6px;border:1px solid #cbd5e1;text-align:center;">${stateLabel}</td>
        <td style="padding:4px 6px;border:1px solid #cbd5e1;text-align:center;font-family:sans-serif;">${inv.age_days || 0}</td>
      </tr>
    `;
  }

  const tempDiv = document.createElement('div');
  tempDiv.style.cssText = 'position:fixed;top:-9999px;left:0;width:1150px;background:#ffffff;color:#0f172a;padding:24px;font-family:system-ui,-apple-system,sans-serif;direction:rtl;';
  tempDiv.innerHTML = `
    <div style="border-bottom:2px solid #0284c7;padding-bottom:12px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-end;">
      <div>
        <h2 style="margin:0 0 4px 0;color:#0f172a;font-size:18px;font-weight:800;">سجل فواتير المبيعات التفصيلي</h2>
        <div style="font-size:11px;color:#475569;">عدد الفواتير المعروضة: ${expItems.length}</div>
      </div>
      <div style="text-align:left;font-size:10px;color:#64748b;">
        <div style="font-weight:700;color:#0f172a;">مجموعة شركات المهندس جمال حريري</div>
        <div>تاريخ الطباعة: ${printTime}</div>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;border:1px solid #cbd5e1;text-align:right;">
      <thead>
        <tr style="background:#0f172a;color:#ffffff;font-size:9.5px;">
          <th style="padding:6px;border:1px solid #334155;">رقم الفاتورة</th>
          <th style="padding:6px;border:1px solid #334155;">العميل</th>
          <th style="padding:6px;border:1px solid #334155;">الشركة</th>
          <th style="padding:6px;border:1px solid #334155;">القسم</th>
          <th style="padding:6px;border:1px solid #334155;">التاريخ</th>
          <th style="padding:6px;border:1px solid #334155;">الاستحقاق</th>
          <th style="padding:6px;border:1px solid #334155;text-align:left;">الإجمالي</th>
          <th style="padding:6px;border:1px solid #334155;text-align:left;">المسدد</th>
          <th style="padding:6px;border:1px solid #334155;text-align:left;">المتبقي</th>
          <th style="padding:6px;border:1px solid #334155;text-align:center;">الحالة</th>
          <th style="padding:6px;border:1px solid #334155;text-align:center;">العمر</th>
        </tr>
      </thead>
      <tbody>
        ${trs}
      </tbody>
      <tfoot>
        <tr style="background:#f1f5f9;font-weight:800;font-size:10px;border-top:2px solid #0f172a;">
          <td colspan="6" style="padding:7px;border:1px solid #cbd5e1;text-align:right;">الإجمالي</td>
          <td style="padding:7px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;">${formatNumber(sumTotal, 0)}</td>
          <td style="padding:7px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;color:#15803d;">${formatNumber(sumColl, 0)}</td>
          <td style="padding:7px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;color:#b45309;">${formatNumber(sumRes, 0)}</td>
          <td colspan="2" style="padding:7px;border:1px solid #cbd5e1;"></td>
        </tr>
      </tfoot>
    </table>
    <div style="text-align:center;margin-top:14px;font-size:10px;color:#64748b;">Mizaniat BI | تقرير سجل فواتير المبيعات</div>
  `;

  await exportElementToLandscapePdf(tempDiv, `sales_invoices_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ==========================================
// 3. COLLECTION MATRIX (مصفوفة التحصيل الزمنية)
// ==========================================
async function loadCollectionMatrixView(contentArea, controlsArea, companyIds, dateFrom, dateTo) {
  controlsArea.innerHTML = `
    <select id="cm-grain-select" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:6px 12px;color:#fff;font-size:0.85rem;outline:none;">
      <option value="year" ${matrixGrain==='year'?'selected':''}>سنوي</option>
      <option value="quarter" ${matrixGrain==='quarter'?'selected':''}>ربع سنوي</option>
      <option value="month" ${matrixGrain==='month'?'selected':''}>شهري</option>
      <option value="week" ${matrixGrain==='week'?'selected':''}>أسبوعي</option>
      <option value="day" ${matrixGrain==='day'?'selected':''}>يومي</option>
    </select>
    <select id="cm-groupby-select" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:6px 12px;color:#fff;font-size:0.85rem;outline:none;">
      <option value="company" ${matrixGroupBy==='company'?'selected':''}>حسب الشركات</option>
      <option value="department" ${matrixGroupBy==='department'?'selected':''}>حسب الأقسام</option>
    </select>
    <button class="matrix-btn btn-export-cm-csv" style="background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);border-radius:8px;padding:6px 12px;color:#10b981;font-size:0.85rem;cursor:pointer;font-weight:700;">
      📥 تصدير Excel
    </button>
    <button class="matrix-btn btn-pdf-cm" style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);border-radius:8px;padding:6px 12px;color:#f87171;font-size:0.85rem;cursor:pointer;font-weight:700;">
      📄 تصدير PDF
    </button>
  `;

  const params = {
    type: 'collection_matrix',
    grain: matrixGrain,
    groupBy: matrixGroupBy
  };
  if (companyIds.length > 0) params.companyIds = companyIds;
  if (dateFrom) params.dateFrom = dateFrom;
  if (dateTo) params.dateTo = dateTo;

  const data = await api.getReceivables(params);
  const rawRows = data.rows || [];
  const periods = data.periods || [];

  // Group raw rows by company_name or department_name
  const grouped = {};
  for (const r of rawRows) {
    const grpKey = matrixGroupBy === 'company' ? r.company_name : r.department_name;
    if (!grouped[grpKey]) {
      grouped[grpKey] = { label: grpKey, periods: {}, totals: { billed: 0, collected: 0, residual: 0 } };
    }
    const g = grouped[grpKey];
    if (!g.periods[r.period]) g.periods[r.period] = { billed: 0, collected: 0, residual: 0 };
    g.periods[r.period].billed += (r.billed || 0);
    g.periods[r.period].collected += (r.collected || 0);
    g.periods[r.period].residual += (r.outstanding || 0);
    g.totals.billed += (r.billed || 0);
    g.totals.collected += (r.collected || 0);
    g.totals.residual += (r.outstanding || 0);
  }
  const matrix = Object.values(grouped);

  const totals = {
    periods: {},
    grandTotal: { billed: 0, collected: 0, residual: 0 }
  };
  for (const row of matrix) {
    totals.grandTotal.billed += row.totals.billed;
    totals.grandTotal.collected += row.totals.collected;
    totals.grandTotal.residual += row.totals.residual;
    for (const p of periods) {
      if (!totals.periods[p]) totals.periods[p] = { billed: 0, collected: 0, residual: 0 };
      totals.periods[p].billed += (row.periods[p]?.billed || 0);
      totals.periods[p].collected += (row.periods[p]?.collected || 0);
      totals.periods[p].residual += (row.periods[p]?.residual || 0);
    }
  }

  // Time drill-down configuration
  const grainOrder = [
    { key: 'year', label: 'سنوي' },
    { key: 'quarter', label: 'ربع سنوي' },
    { key: 'month', label: 'شهري' },
    { key: 'week', label: 'أسبوعي' },
    { key: 'day', label: 'يومي' }
  ];
  const currentIdx = grainOrder.findIndex(g => g.key === matrixGrain);
  const activeIdx = currentIdx >= 0 ? currentIdx : 0;
  const nextCMGrain = activeIdx < grainOrder.length - 1 ? grainOrder[activeIdx + 1].key : null;
  const canDrillCM = !!nextCMGrain;

  let cmBreadcrumbs = '';
  for (let i = 0; i <= activeIdx; i++) {
    const g = grainOrder[i];
    if (i === activeIdx) {
      cmBreadcrumbs += `<span style="color:#60a5fa;background:rgba(59,130,246,0.15);padding:3px 10px;border-radius:6px;border:1px solid rgba(59,130,246,0.3);font-weight:700;">${g.label}</span>`;
    } else {
      cmBreadcrumbs += `
        <button class="btn-cm-breadcrumb-step" data-grain="${g.key}" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);color:rgba(255,255,255,0.7);padding:3px 8px;border-radius:6px;cursor:pointer;font-size:0.85rem;">
          ${g.label}
        </button>
        <span style="color:rgba(255,255,255,0.3);font-size:0.8rem;">←</span>
      `;
    }
  }

  contentArea.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:16px;">
      <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:12px 18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;font-size:0.92rem;">
        <div style="color:rgba(255,255,255,0.7);">
          💡 <strong>سؤال الإدارة التنفيذية:</strong> من إيرادات ومبيعات كل فترة زمنية، كم حُصِّل فعلياً حتى الآن وكم بقي مستحقاً؟
        </div>
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="color:rgba(255,255,255,0.4);font-size:0.85rem;">التدرج الزمني:</span>
          ${cmBreadcrumbs}
          ${activeIdx > 0 ? `
            <button class="btn-cm-breadcrumb-reset" style="background:transparent;border:none;color:#a78bfa;cursor:pointer;font-size:0.85rem;text-decoration:underline;margin-right:6px;">
              (رجوع للسنوي)
            </button>
          ` : ''}
        </div>
      </div>

      <div style="max-height:640px;overflow:auto;border-radius:14px;border:1px solid rgba(255,255,255,0.08);background:rgba(15,23,42,0.6);">
        <table class="bi-table" style="width:100%;border-collapse:separate;border-spacing:0;font-size:0.92rem;text-align:right;">
          <thead style="position:sticky;top:0;z-index:10;background:#0d1527;">
            <tr>
              <th style="padding:14px 18px;min-width:240px;position:sticky;right:0;background:#0d1527;z-index:15;">
                ${matrixGroupBy === 'company' ? 'الشركة' : 'القسم'}
              </th>
              ${periods.map(p => `
                <th colspan="3" class="cm-th-col" data-period="${p}" style="text-align:center;border-left:2px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.02);cursor:${canDrillCM ? 'pointer' : 'default'};user-select:none;" title="${canDrillCM ? 'انقر للنزول الزمني إلى ' + (grainOrder[activeIdx+1]?.label || '') : ''}">
                  <div style="display:flex;align-items:center;justify-content:center;gap:6px;">
                    <span>${p}</span>
                    ${canDrillCM ? `<span style="font-size:0.75rem;color:#60a5fa;opacity:0.8;">🔍</span>` : ''}
                  </div>
                </th>
              `).join('')}
              <th colspan="3" style="text-align:center;border-left:2px solid rgba(59,130,246,0.3);color:#60a5fa;font-weight:800;">
                الإجمالي العام
              </th>
            </tr>
            <tr style="font-size:0.8rem;color:rgba(255,255,255,0.6);">
              <th style="padding:8px 18px;position:sticky;right:0;background:#0d1527;z-index:15;">التفصيل</th>
              ${periods.map(() => `
                <th style="text-align:left;padding:6px 10px;">المفوتر</th>
                <th style="text-align:left;padding:6px 10px;color:#10b981;">المحصل</th>
                <th style="text-align:left;padding:6px 10px;color:#f59e0b;border-left:1px solid rgba(255,255,255,0.08);">المتبقي (%)</th>
              `).join('')}
              <th style="text-align:left;padding:6px 10px;color:#60a5fa;">المفوتر</th>
              <th style="text-align:left;padding:6px 10px;color:#10b981;">المحصل</th>
              <th style="text-align:left;padding:6px 10px;color:#f59e0b;">المتبقي (%)</th>
            </tr>
          </thead>
          <tbody>
            ${matrix.map(row => {
              const rt = row.totals || {};
              const rRate = rt.billed > 0 ? (rt.collected / rt.billed * 100).toFixed(1) : 0;
              return `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                  <td style="padding:12px 18px;font-weight:700;position:sticky;right:0;background:#0e1726;z-index:5;">
                    ${row.label}
                  </td>
                  ${periods.map(p => {
                    const c = row.periods?.[p] || { billed: 0, collected: 0, residual: 0 };
                    const rate = c.billed > 0 ? (c.collected / c.billed * 100).toFixed(0) : 0;
                    return `
                      <td style="text-align:left;font-family:var(--font-en);">${c.billed !== 0 ? formatNumber(c.billed, 0) : '—'}</td>
                      <td style="text-align:left;font-family:var(--font-en);color:#10b981;">${c.collected !== 0 ? formatNumber(c.collected, 0) : '—'}</td>
                      <td style="text-align:left;font-family:var(--font-en);color:#f59e0b;border-left:1px solid rgba(255,255,255,0.08);">
                        ${c.residual !== 0 ? formatNumber(c.residual, 0) : '—'}
                        ${c.billed > 0 ? `<span style="font-size:0.75rem;color:rgba(255,255,255,0.4);"> (${rate}%)</span>` : ''}
                      </td>
                    `;
                  }).join('')}
                  <td style="text-align:left;font-family:var(--font-en);font-weight:700;color:#60a5fa;">${formatNumber(rt.billed || 0, 0)}</td>
                  <td style="text-align:left;font-family:var(--font-en);font-weight:700;color:#10b981;">${formatNumber(rt.collected || 0, 0)}</td>
                  <td style="text-align:left;font-family:var(--font-en);font-weight:700;color:#f59e0b;">
                    ${formatNumber(rt.residual || 0, 0)}
                    <span style="font-size:0.75rem;color:rgba(255,255,255,0.5);"> (${rRate}%)</span>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
          <tfoot style="position:sticky;bottom:0;z-index:10;background:#0d1527;font-weight:800;">
            <tr style="border-top:2px solid rgba(255,255,255,0.2);">
              <td style="padding:14px 18px;position:sticky;right:0;background:#0d1527;z-index:15;">الإجمالي</td>
              ${periods.map(p => {
                const pt = totals.periods?.[p] || { billed: 0, collected: 0, residual: 0 };
                const pr = pt.billed > 0 ? (pt.collected / pt.billed * 100).toFixed(0) : 0;
                return `
                  <td style="text-align:left;font-family:var(--font-en);">${formatNumber(pt.billed || 0, 0)}</td>
                  <td style="text-align:left;font-family:var(--font-en);color:#10b981;">${formatNumber(pt.collected || 0, 0)}</td>
                  <td style="text-align:left;font-family:var(--font-en);color:#f59e0b;border-left:1px solid rgba(255,255,255,0.08);">
                    ${formatNumber(pt.residual || 0, 0)}
                    <span style="font-size:0.75rem;color:rgba(255,255,255,0.4);"> (${pr}%)</span>
                  </td>
                `;
              }).join('')}
              <td style="text-align:left;font-family:var(--font-en);color:#60a5fa;">${formatNumber(totals.grandTotal?.billed || 0, 0)}</td>
              <td style="text-align:left;font-family:var(--font-en);color:#10b981;">${formatNumber(totals.grandTotal?.collected || 0, 0)}</td>
              <td style="text-align:left;font-family:var(--font-en);color:#f59e0b;">${formatNumber(totals.grandTotal?.residual || 0, 0)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `;

  // Controls change events
  controlsArea.querySelector('#cm-grain-select')?.addEventListener('change', (e) => {
    matrixGrain = e.target.value;
    loadCollectionMatrixView(contentArea, controlsArea, companyIds, dateFrom, dateTo);
  });
  controlsArea.querySelector('#cm-groupby-select')?.addEventListener('change', (e) => {
    matrixGroupBy = e.target.value;
    loadCollectionMatrixView(contentArea, controlsArea, companyIds, dateFrom, dateTo);
  });

  // Export events
  controlsArea.querySelector('.btn-export-cm-csv')?.addEventListener('click', () => {
    exportCollectionMatrixCSV(matrix, periods, totals, matrixGroupBy);
  });
  controlsArea.querySelector('.btn-pdf-cm')?.addEventListener('click', () => {
    exportCollectionMatrixPDF(matrix, periods, totals, matrixGrain, matrixGroupBy);
  });

  // Period header drill-down clicks
  if (canDrillCM) {
    contentArea.querySelectorAll('.cm-th-col').forEach(th => {
      th.addEventListener('click', () => {
        if (nextCMGrain) {
          matrixGrain = nextCMGrain;
          loadCollectionMatrixView(contentArea, controlsArea, companyIds, dateFrom, dateTo);
        }
      });
    });
  }

  // Breadcrumb step clicks
  contentArea.querySelectorAll('.btn-cm-breadcrumb-step').forEach(btn => {
    btn.addEventListener('click', () => {
      matrixGrain = btn.dataset.grain;
      loadCollectionMatrixView(contentArea, controlsArea, companyIds, dateFrom, dateTo);
    });
  });
  contentArea.querySelector('.btn-cm-breadcrumb-reset')?.addEventListener('click', () => {
    matrixGrain = 'year';
    loadCollectionMatrixView(contentArea, controlsArea, companyIds, dateFrom, dateTo);
  });
}

function exportCollectionMatrixCSV(matrix, periods, totals, groupBy) {
  const header = [groupBy === 'company' ? 'الشركة' : 'القسم'];
  for (const p of periods) {
    header.push(`"${p} - مفوتر"`, `"${p} - محصل"`, `"${p} - متبقي"`);
  }
  header.push('"إجمالي مفوتر"', '"إجمالي محصل"', '"إجمالي متبقي"');
  const rows = [header.join(',')];

  for (const row of matrix) {
    const r = [`"${row.label.replace(/"/g, '""')}"`];
    for (const p of periods) {
      const c = row.periods?.[p] || { billed: 0, collected: 0, residual: 0 };
      r.push(c.billed || 0, c.collected || 0, c.residual || 0);
    }
    const rt = row.totals || {};
    r.push(rt.billed || 0, rt.collected || 0, rt.residual || 0);
    rows.push(r.join(','));
  }

  const totRow = ['"الإجمالي"'];
  for (const p of periods) {
    const pt = totals.periods?.[p] || { billed: 0, collected: 0, residual: 0 };
    totRow.push(pt.billed || 0, pt.collected || 0, pt.residual || 0);
  }
  totRow.push(totals.grandTotal?.billed || 0, totals.grandTotal?.collected || 0, totals.grandTotal?.residual || 0);
  rows.push(totRow.join(','));

  const csvContent = '\uFEFF' + rows.join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `collection_matrix_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function exportCollectionMatrixPDF(matrix, periods, totals, grain, groupBy) {
  const printTime = new Date().toLocaleString('ar-SA');
  const grainLabels = { year: 'سنوي', quarter: 'ربع سنوي', month: 'شهري', week: 'أسبوعي', day: 'يومي' };
  const groupLabel = groupBy === 'company' ? 'حسب الشركات' : 'حسب الأقسام';

  let trs = '';
  for (const row of matrix) {
    const rt = row.totals || {};
    trs += `
      <tr style="border-bottom:1px solid #cbd5e1;font-size:9.5px;">
        <td style="padding:5px 8px;border:1px solid #cbd5e1;font-weight:700;">${row.label}</td>
        ${periods.map(p => {
          const c = row.periods?.[p] || { billed: 0, collected: 0, residual: 0 };
          return `
            <td style="padding:4px 6px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;">${c.billed ? formatNumber(c.billed, 0) : '—'}</td>
            <td style="padding:4px 6px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;color:#15803d;">${c.collected ? formatNumber(c.collected, 0) : '—'}</td>
            <td style="padding:4px 6px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;color:#b45309;">${c.residual ? formatNumber(c.residual, 0) : '—'}</td>
          `;
        }).join('')}
        <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:left;font-weight:700;font-family:sans-serif;">${formatNumber(rt.billed || 0, 0)}</td>
        <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:left;font-weight:700;font-family:sans-serif;color:#15803d;">${formatNumber(rt.collected || 0, 0)}</td>
        <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:left;font-weight:700;font-family:sans-serif;color:#b45309;">${formatNumber(rt.residual || 0, 0)}</td>
      </tr>
    `;
  }

  const tempDiv = document.createElement('div');
  tempDiv.style.cssText = 'position:fixed;top:-9999px;left:0;width:1150px;background:#ffffff;color:#0f172a;padding:24px;font-family:system-ui,-apple-system,sans-serif;direction:rtl;';
  tempDiv.innerHTML = `
    <div style="border-bottom:2px solid #0284c7;padding-bottom:12px;margin-bottom:16px;display:flex;justify-content:space-between;align-items:flex-end;">
      <div>
        <h2 style="margin:0 0 4px 0;color:#0f172a;font-size:18px;font-weight:800;">مصفوفة التحصيل والمتبقي حسب فترات الفواتير</h2>
        <div style="font-size:11px;color:#475569;">التصنيف: ${groupLabel} | التدرج الزمني: ${grainLabels[grain] || grain}</div>
      </div>
      <div style="text-align:left;font-size:10px;color:#64748b;">
        <div style="font-weight:700;color:#0f172a;">مجموعة شركات المهندس جمال حريري</div>
        <div>تاريخ الطباعة: ${printTime}</div>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;border:1px solid #cbd5e1;text-align:right;">
      <thead>
        <tr style="background:#0f172a;color:#ffffff;font-size:9.5px;">
          <th rowspan="2" style="padding:6px;border:1px solid #334155;">${groupBy === 'company' ? 'الشركة' : 'القسم'}</th>
          ${periods.map(p => `<th colspan="3" style="padding:6px;border:1px solid #334155;text-align:center;">${p}</th>`).join('')}
          <th colspan="3" style="padding:6px;border:1px solid #334155;text-align:center;color:#38bdf8;">الإجمالي العام</th>
        </tr>
        <tr style="background:#1e293b;color:#cbd5e1;font-size:8.5px;">
          ${periods.map(() => `
            <th style="padding:4px;border:1px solid #334155;text-align:left;">مفوتر</th>
            <th style="padding:4px;border:1px solid #334155;text-align:left;color:#86efac;">محصل</th>
            <th style="padding:4px;border:1px solid #334155;text-align:left;color:#fde047;">متبقي</th>
          `).join('')}
          <th style="padding:4px;border:1px solid #334155;text-align:left;color:#38bdf8;">مفوتر</th>
          <th style="padding:4px;border:1px solid #334155;text-align:left;color:#86efac;">محصل</th>
          <th style="padding:4px;border:1px solid #334155;text-align:left;color:#fde047;">متبقي</th>
        </tr>
      </thead>
      <tbody>
        ${trs}
      </tbody>
      <tfoot>
        <tr style="background:#f1f5f9;font-weight:800;font-size:10px;border-top:2px solid #0f172a;">
          <td style="padding:7px;border:1px solid #cbd5e1;text-align:right;">الإجمالي</td>
          ${periods.map(p => {
            const pt = totals.periods?.[p] || { billed: 0, collected: 0, residual: 0 };
            return `
              <td style="padding:6px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;">${formatNumber(pt.billed || 0, 0)}</td>
              <td style="padding:6px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;color:#15803d;">${formatNumber(pt.collected || 0, 0)}</td>
              <td style="padding:6px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;color:#b45309;">${formatNumber(pt.residual || 0, 0)}</td>
            `;
          }).join('')}
          <td style="padding:7px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;color:#0284c7;">${formatNumber(totals.grandTotal?.billed || 0, 0)}</td>
          <td style="padding:7px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;color:#15803d;">${formatNumber(totals.grandTotal?.collected || 0, 0)}</td>
          <td style="padding:7px;border:1px solid #cbd5e1;text-align:left;font-family:sans-serif;color:#b45309;">${formatNumber(totals.grandTotal?.residual || 0, 0)}</td>
        </tr>
      </tfoot>
    </table>
    <div style="text-align:center;margin-top:14px;font-size:10px;color:#64748b;">Mizaniat BI | مصفوفة التحصيل</div>
  `;

  await exportElementToLandscapePdf(tempDiv, `collection_matrix_${grain}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

// ==========================================
// 4. RECONCILIATION VIEW (مطابقة الأستاذ العام)
// ==========================================
async function loadReconciliationView(contentArea, controlsArea, companyIds) {
  controlsArea.innerHTML = '';
  const params = {
    type: 'reconciliation',
    page: reconPage,
    limit: 50
  };
  if (companyIds.length > 0) params.companyIds = companyIds;

  const data = await api.getReceivables(params);
  const comps = data.companies || [];

  contentArea.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:20px;">
      <!-- Explanation Note -->
      <div style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);border-radius:12px;padding:14px 18px;font-size:0.92rem;color:#a7f3d0;">
        <strong>✅ مبدأ المطابقة الثلاثية للمدير المالي (Check 16a):</strong>
        رصيد حسابات الذمم في الأستاذ العام = متبقي فواتير المبيعات (من sales_invoices) + متبقي القيود غير الفاتورية (دفعات غير مطابقة وأرصدة افتتاحية من journal_items). الفارق = صفر لكافة الشركات.
      </div>

      <!-- Reconciliation Table -->
      <div style="border-radius:14px;border:1px solid rgba(255,255,255,0.08);background:rgba(15,23,42,0.6);overflow:hidden;">
        <table class="bi-table" style="width:100%;border-collapse:separate;border-spacing:0;font-size:0.95rem;text-align:right;">
          <thead style="background:#0d1527;">
            <tr>
              <th style="padding:14px 18px;">الشركة</th>
              <th style="text-align:left;color:#60a5fa;">رصيد الذمم في الأستاذ</th>
              <th style="text-align:left;color:#f59e0b;">متبقي فواتير المبيعات</th>
              <th style="text-align:left;color:#a78bfa;">القيود غير الفاتورية (المتبقي)</th>
              <th style="text-align:left;color:#10b981;">الفارق المحاسبي</th>
              <th style="text-align:center;">حالة المطابقة</th>
            </tr>
          </thead>
          <tbody>
            ${comps.map(c => {
              const diff = Math.abs((c.invoicesResidual + c.unmatchedDifference) - c.ledgerReceivables);
              return `
                <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                  <td style="padding:14px 18px;font-weight:700;">🏢 ${c.companyName}</td>
                  <td style="text-align:left;font-family:var(--font-en);font-weight:700;color:#60a5fa;">${formatNumber(c.ledgerReceivables, 2)}</td>
                  <td style="text-align:left;font-family:var(--font-en);font-weight:700;color:#f59e0b;">${formatNumber(c.invoicesResidual, 2)}</td>
                  <td style="text-align:left;font-family:var(--font-en);font-weight:700;color:#a78bfa;">
                    ${formatNumber(c.unmatchedDifference, 2)}
                    <span style="font-size:0.75rem;color:rgba(255,255,255,0.5);">(${c.unmatchedEntriesCount} قيد)</span>
                  </td>
                  <td style="text-align:left;font-family:var(--font-en);font-weight:800;color:${diff < 0.01 ? '#10b981' : '#ef4444'};">
                    ${formatNumber(diff, 2)}
                  </td>
                  <td style="text-align:center;">
                    ${diff < 0.01 ? 
                      '<span style="background:rgba(16,185,129,0.15);color:#10b981;padding:3px 10px;border-radius:6px;font-size:0.8rem;font-weight:700;">✅ متطابق تماماً</span>' : 
                      '<span style="background:rgba(239,68,68,0.15);color:#ef4444;padding:3px 10px;border-radius:6px;font-size:0.8rem;font-weight:700;">❌ غير متطابق</span>'}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Unmatched Real Entries Detail -->
      <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:14px;padding:18px;">
        <h4 style="margin:0 0 12px 0;color:#fff;font-size:1rem;display:flex;align-items:center;gap:8px;">
          <span>📋</span> تفاصيل القيود غير الفاتورية غير المطابقة (الدفعات والأرصدة الافتتاحية)
        </h4>

        ${comps.map(c => {
          if (!c.entries || c.entries.length === 0) return '';
          return `
            <div style="margin-top:14px;border:1px solid rgba(255,255,255,0.06);border-radius:10px;overflow:hidden;">
              <div style="background:rgba(255,255,255,0.04);padding:10px 14px;font-size:0.9rem;font-weight:700;color:#93c5fd;">
                🏢 ${c.companyName} (${c.unmatchedEntriesCount} قيد — إجمالي: ${formatNumber(c.unmatchedDifference, 2)} ريال)
              </div>
              <div style="max-height:300px;overflow:auto;">
                <table class="bi-table" style="width:100%;font-size:0.85rem;text-align:right;">
                  <thead style="background:#0d1527;font-size:0.8rem;">
                    <tr>
                      <th>رقم القيد</th>
                      <th>اليومية</th>
                      <th>التاريخ</th>
                      <th>الطرف / العميل</th>
                      <th style="text-align:left;">المدين</th>
                      <th style="text-align:left;">الدائن</th>
                      <th style="text-align:left;">الصافي</th>
                      <th style="text-align:left;color:#f59e0b;">المتبقي غير المطابق</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${c.entries.map(e => `
                      <tr>
                        <td style="font-family:var(--font-en);color:#fff;">${e.move_name}</td>
                        <td style="color:rgba(255,255,255,0.7);">${e.journal_name || '—'}</td>
                        <td style="font-family:var(--font-en);color:rgba(255,255,255,0.6);">${e.date}</td>
                        <td>${e.partner_name || 'بدون عميل'}</td>
                        <td style="text-align:left;font-family:var(--font-en);">${formatNumber(e.debit, 2)}</td>
                        <td style="text-align:left;font-family:var(--font-en);">${formatNumber(e.credit, 2)}</td>
                        <td style="text-align:left;font-family:var(--font-en);">${formatNumber(e.net, 2)}</td>
                        <td style="text-align:left;font-family:var(--font-en);font-weight:700;color:#f59e0b;">${formatNumber(e.amount_residual, 2)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// ==========================================
// 5. DEPARTMENT CONFLICTS VIEW (حالات التعارض الـ 52)
// ==========================================
async function loadConflictsView(contentArea, controlsArea) {
  controlsArea.innerHTML = '';
  const res = await api.getDepartmentConflicts();
  const conflicts = res.conflicts || [];
  const totalUntaxed = res.totalUntaxedAmount !== undefined ? res.totalUntaxedAmount : (res.totalUntaxed || 0);

  contentArea.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:18px;">
      <!-- Audit Header -->
      <div style="background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:12px;padding:14px 18px;font-size:0.92rem;color:#fde68a;">
        <strong>🔍 تقرير جودة البيانات والتدقيق المحاسبي (R2 Resolution):</strong><br>
        تم حصر <strong>${conflicts.length} فاتورة</strong> بإجمالي <strong>${formatNumber(totalUntaxed, 2)} ريال (قبل الضريبة)</strong> / <strong>${formatNumber(conflicts.reduce((s, c) => s + (c.amountTotal || 0), 0), 2)} ريال (شامل الضريبة)</strong> 
        يختلف فيها تعيين اليومية عن الحساب التحليلي لأسطر الإيراد. 
        بموجب قرار الإدارة المعتمد (R2)، تم توحيد القاعدة في كافة شاشات ومحركات النظام: 
        <strong>«الأولوية للحساب التحليلي لأسطر الإيراد أولاً ثم اليومية»</strong>، مما يضمن اتساق ربحية الأقسام وتطابق الإيرادات والمصروفات مع الأستاذ العام.
      </div>

      <!-- Conflicts Table -->
      <div style="max-height:560px;overflow:auto;border-radius:14px;border:1px solid rgba(255,255,255,0.08);background:rgba(15,23,42,0.6);">
        <table class="bi-table" style="width:100%;border-collapse:separate;border-spacing:0;font-size:0.88rem;text-align:right;">
          <thead style="position:sticky;top:0;z-index:10;background:#0d1527;">
            <tr>
              <th style="padding:12px 14px;">رقم الفاتورة</th>
              <th>الشركة</th>
              <th>اليومية (Journal)</th>
              <th style="color:#f87171;">قسم اليومية (سابقاً)</th>
              <th>الحساب التحليلي للإيراد</th>
              <th style="color:#10b981;">القسم المعتمد نهائياً (R2)</th>
              <th style="text-align:left;">قبل الضريبة</th>
              <th style="text-align:left;">شامل الضريبة</th>
            </tr>
          </thead>
          <tbody>
            ${conflicts.map(c => `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                <td style="padding:10px 14px;font-family:var(--font-en);font-weight:700;color:#fff;">${c.invoiceName || c.invoice_name}</td>
                <td>🏢 ${c.companyName || c.company_name}</td>
                <td style="color:rgba(255,255,255,0.7);">${c.journalName || c.journal_name}</td>
                <td style="color:#f87171;">${c.journalDeptName || c.journal_group_name}</td>
                <td style="color:#93c5fd;font-family:var(--font-en);">${c.analyticAccounts || c.analytic_accounts}</td>
                <td style="color:#10b981;font-weight:700;">${c.resolvedDepartmentName || c.resolved_dept_name}</td>
                <td style="text-align:left;font-family:var(--font-en);font-weight:700;color:#60a5fa;">${formatNumber(c.amountUntaxed !== undefined ? c.amountUntaxed : c.amount_untaxed, 2)}</td>
                <td style="text-align:left;font-family:var(--font-en);font-weight:700;color:#10b981;">${formatNumber(c.amountTotal !== undefined ? c.amountTotal : c.amount_total, 2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}
