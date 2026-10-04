import { api } from '../api.js';
import { MatrixTable } from '../components/matrix.js';

let currentMeasure = 'revenue';
let currentDims = ['company', 'department'];
let currentGrain = 'quarter';
let currentCompare = 'prev_year';
let matrixTableInstance = null;
let activePreset = 'revenue_quarters';

export async function renderMatrixTab(body, container) {
  // Extract active company filters & dates from parent container
  const selectedCos = [...container.querySelectorAll('.co-chip.active')].map(c => Number(c.dataset.id));
  const df = container.querySelector('#date-from')?.value || '';
  const dt = container.querySelector('#date-to')?.value || '';

  body.innerHTML = `
    <div style="direction:rtl;display:flex;flex-direction:column;gap:18px;">
      <!-- Presets Ribbon -->
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;background:rgba(255,255,255,0.02);padding:12px 18px;border-radius:14px;border:1px solid rgba(255,255,255,0.06);">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
          <span style="font-size:0.9rem;font-weight:700;color:rgba(255,255,255,0.6);">🎯 إعدادات جاهزة:</span>
          <button class="matrix-preset-btn ${activePreset === 'revenue_quarters' ? 'active' : ''}" data-preset="revenue_quarters" style="${presetBtnStyle(activePreset === 'revenue_quarters')}">
            💰 الإيرادات ربع السنوية
          </button>
          <button class="matrix-preset-btn ${activePreset === 'expense_depts' ? 'active' : ''}" data-preset="expense_depts" style="${presetBtnStyle(activePreset === 'expense_depts')}">
            📤 المصروفات حسب الأقسام
          </button>
          <button class="matrix-preset-btn ${activePreset === 'net_profit' ? 'active' : ''}" data-preset="net_profit" style="${presetBtnStyle(activePreset === 'net_profit')}">
            📈 صافي الربح
          </button>
          <button class="matrix-preset-btn ${activePreset === 'collection_co' ? 'active' : ''}" data-preset="collection_co" style="${presetBtnStyle(activePreset === 'collection_co')}">
            ✅ التحصيل حسب الشركات
          </button>
          <button class="matrix-preset-btn ${activePreset === 'billed_co' ? 'active' : ''}" data-preset="billed_co" style="${presetBtnStyle(activePreset === 'billed_co')}">
            🛒 المفوتر
          </button>
          <button class="matrix-preset-btn ${activePreset === 'accounts' ? 'active' : ''}" data-preset="accounts" style="${presetBtnStyle(activePreset === 'accounts')}">
            🏷️ كشف الحسابات
          </button>
        </div>

        <div id="matrix-benchmark" style="font-size:0.82rem;color:rgba(255,255,255,0.45);font-family:var(--font-en);">
          ⚡ زمن الاستجابة: —
        </div>
      </div>

      <!-- Matrix Controls Bar -->
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;background:rgba(255,255,255,0.03);padding:14px 18px;border-radius:14px;border:1px solid rgba(255,255,255,0.08);">
        <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
          <!-- Measure -->
          <div style="display:flex;align-items:center;gap:6px;">
            <label style="font-size:0.88rem;color:rgba(255,255,255,0.6);font-weight:700;">المقياس:</label>
            <select id="matrix-measure-sel" style="background:#0d1527;border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:6px 12px;color:#fff;font-size:0.88rem;outline:none;">
              <option value="revenue" ${currentMeasure==='revenue'?'selected':''}>💰 الإيرادات (Revenue)</option>
              <option value="expense" ${currentMeasure==='expense'?'selected':''}>📤 المصروفات (Expenses)</option>
              <option value="net" ${currentMeasure==='net'?'selected':''}>📈 صافي الربح (Net Profit)</option>
              <option value="billed" ${currentMeasure==='billed'?'selected':''}>🛒 المفوتر (Billed)</option>
              <option value="collected" ${currentMeasure==='collected'?'selected':''}>✅ المحصل (Collected)</option>
            </select>
          </div>

          <!-- Dimensions -->
          <div style="display:flex;align-items:center;gap:6px;">
            <label style="font-size:0.88rem;color:rgba(255,255,255,0.6);font-weight:700;">تدرج الأبعاد:</label>
            <select id="matrix-dims-sel" style="background:#0d1527;border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:6px 12px;color:#fff;font-size:0.88rem;outline:none;">
              <option value="company,department" ${currentDims.join(',')==='company,department'?'selected':''}>🏢 الشركة ← 📁 القسم</option>
              <option value="company,department,analytic" ${currentDims.join(',')==='company,department,analytic'?'selected':''}>🏢 الشركة ← 📁 القسم ← 🏗️ المركز</option>
              <option value="department" ${currentDims.join(',')==='department'?'selected':''}>📁 القسم فقط</option>
              <option value="account" ${currentDims.join(',')==='account'?'selected':''}>🏷️ الحساب العام فقط</option>
              <option value="company,account" ${currentDims.join(',')==='company,account'?'selected':''}>🏢 الشركة ← 🏷️ الحساب</option>
              <option value="company" ${currentDims.join(',')==='company'?'selected':''}>🏢 الشركة فقط</option>
            </select>
          </div>

          <!-- Time Grain -->
          <div style="display:flex;align-items:center;gap:6px;">
            <label style="font-size:0.88rem;color:rgba(255,255,255,0.6);font-weight:700;">الفترة:</label>
            <select id="matrix-grain-sel" style="background:#0d1527;border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:6px 12px;color:#fff;font-size:0.88rem;outline:none;">
              <option value="year" ${currentGrain==='year'?'selected':''}>📅 سنوي (Year)</option>
              <option value="quarter" ${currentGrain==='quarter'?'selected':''}>📆 ربع سنوي (Quarter)</option>
              <option value="month" ${currentGrain==='month'?'selected':''}>🗓️ شهري (Month)</option>
              <option value="week" ${currentGrain==='week'?'selected':''}>📊 أسبوعي (Week)</option>
              <option value="day" ${currentGrain==='day'?'selected':''}>⏱️ يومي (Day)</option>
            </select>
          </div>

          <!-- Compare Mode -->
          <div style="display:flex;align-items:center;gap:6px;">
            <label style="font-size:0.88rem;color:rgba(255,255,255,0.6);font-weight:700;">المقارنة:</label>
            <select id="matrix-compare-sel" style="background:#0d1527;border:1px solid rgba(255,255,255,0.15);border-radius:8px;padding:6px 12px;color:#fff;font-size:0.88rem;outline:none;">
              <option value="none" ${currentCompare==='none'?'selected':''}>بدون مقارنة</option>
              <option value="prev_year" ${currentCompare==='prev_year'?'selected':''}>نفس الفترة من العام الماضي</option>
              <option value="prev_period" ${currentCompare==='prev_period'?'selected':''}>الفترة السابقة المباشرة</option>
            </select>
          </div>
        </div>

        <button id="matrix-btn-apply" style="background:linear-gradient(135deg,#3b82f6,#2563eb);border:none;color:#fff;font-weight:700;padding:8px 18px;border-radius:8px;font-size:0.88rem;cursor:pointer;box-shadow:0 4px 12px rgba(59,130,246,0.3);">
          تطبيق العرض
        </button>
      </div>

      <!-- Matrix Table Container -->
      <div id="matrix-table-mount" style="min-height:480px;position:relative;">
        <div style="text-align:center;padding:60px 20px;color:rgba(255,255,255,0.4);font-size:1.1rem;">
          <span style="display:inline-block;animation:spin 1s linear infinite;">⏳</span> جاري معالجة مصفوفة البيانات الضخمة...
        </div>
      </div>
    </div>
  `;

  // Bind presets
  body.querySelectorAll('.matrix-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activePreset = btn.dataset.preset;
      applyPresetConfig(activePreset);
      renderMatrixTab(body, container);
    });
  });

  // Bind controls change
  body.querySelector('#matrix-measure-sel')?.addEventListener('change', e => { currentMeasure = e.target.value; activePreset = ''; });
  body.querySelector('#matrix-dims-sel')?.addEventListener('change', e => { currentDims = e.target.value.split(','); activePreset = ''; });
  body.querySelector('#matrix-grain-sel')?.addEventListener('change', e => { currentGrain = e.target.value; activePreset = ''; });
  body.querySelector('#matrix-compare-sel')?.addEventListener('change', e => { currentCompare = e.target.value; activePreset = ''; });
  body.querySelector('#matrix-btn-apply')?.addEventListener('click', () => {
    fetchAndRenderMatrix(body, container, selectedCos, df, dt);
  });

  // Fetch initial matrix data
  await fetchAndRenderMatrix(body, container, selectedCos, df, dt);
}

function presetBtnStyle(active) {
  if (active) {
    return 'background:rgba(139,92,246,0.22);border:1.5px solid #8b5cf6;color:#c4b5fd;border-radius:8px;padding:6px 12px;font-size:0.85rem;font-weight:700;cursor:pointer;';
  }
  return 'background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);color:rgba(255,255,255,0.6);border-radius:8px;padding:6px 12px;font-size:0.85rem;font-weight:600;cursor:pointer;';
}

function applyPresetConfig(preset) {
  if (preset === 'revenue_quarters') {
    currentMeasure = 'revenue';
    currentDims = ['company', 'department'];
    currentGrain = 'quarter';
    currentCompare = 'prev_year';
  } else if (preset === 'expense_depts') {
    currentMeasure = 'expense';
    currentDims = ['department', 'analytic'];
    currentGrain = 'month';
    currentCompare = 'none';
  } else if (preset === 'net_profit') {
    currentMeasure = 'net';
    currentDims = ['company', 'department'];
    currentGrain = 'quarter';
    currentCompare = 'prev_year';
  } else if (preset === 'collection_co') {
    currentMeasure = 'collected';
    currentDims = ['company'];
    currentGrain = 'quarter';
    currentCompare = 'prev_year';
  } else if (preset === 'billed_co') {
    currentMeasure = 'billed';
    currentDims = ['company'];
    currentGrain = 'quarter';
    currentCompare = 'none';
  } else if (preset === 'accounts') {
    currentMeasure = 'expense';
    currentDims = ['account'];
    currentGrain = 'year';
    currentCompare = 'prev_year';
  }
}

async function fetchAndRenderMatrix(body, container, companyIds, dateFrom, dateTo) {
  const mountEl = body.querySelector('#matrix-table-mount');
  const benchmarkEl = body.querySelector('#matrix-benchmark');
  if (!mountEl) return;

  mountEl.innerHTML = `
    <div style="text-align:center;padding:60px 20px;color:rgba(255,255,255,0.4);font-size:1.1rem;">
      <span style="display:inline-block;animation:spin 1s linear infinite;">⏳</span> جاري معالجة واستعلام المصفوفة...
    </div>
  `;

  const params = {
    measure: currentMeasure,
    rowDims: currentDims,
    timeGrain: currentGrain,
    compare: currentCompare
  };
  if (companyIds.length > 0) params.companyIds = companyIds;
  if (dateFrom) params.dateFrom = dateFrom;
  if (dateTo) params.dateTo = dateTo;

  const tStart = performance.now();
  try {
    const data = await api.getMatrix(params);
    const tDuration = Math.round(performance.now() - tStart);

    if (benchmarkEl) {
      benchmarkEl.textContent = `⚡ زمن الاستجابة: ${tDuration}ms (${data.rows?.length || 0} أصل، ${data.columns?.length || 0} عمود)`;
    }

    matrixTableInstance = new MatrixTable({
      container: mountEl,
      data,
      measure: currentMeasure,
      onDrillTime: (colKey, nextGrain) => {
        currentGrain = nextGrain;
        const grainSel = body.querySelector('#matrix-grain-sel');
        if (grainSel) grainSel.value = nextGrain;
        fetchAndRenderMatrix(body, container, companyIds, dateFrom, dateTo);
      },
      onBreadcrumb: (targetGrain) => {
        currentGrain = targetGrain;
        const grainSel = body.querySelector('#matrix-grain-sel');
        if (grainSel) grainSel.value = targetGrain;
        fetchAndRenderMatrix(body, container, companyIds, dateFrom, dateTo);
      }
    });

    matrixTableInstance.render();
  } catch (err) {
    console.error('Error fetching matrix data:', err);
    mountEl.innerHTML = `
      <div style="text-align:center;padding:60px;color:#ef4444;font-size:1.1rem;">
        ❌ حدث خطأ أثناء تشغيل محرك المصفوفة: ${err.message}
      </div>
    `;
  }
}
