import { api } from '../api.js';

const STORAGE_KEY = 'mizaniat_api_configs';

export async function renderApiManager(container) {
  const baseUrl = `${window.location.origin}/api/external`;

  container.innerHTML = `
    <style>
      .api-mgr { padding:32px;max-width:1200px;margin:0 auto; }
      .api-mgr h1 { color:var(--text-white);margin:0;font-size:1.6rem; }
      .api-card { background:var(--bg-card);border-radius:12px;padding:20px;margin-bottom:20px;border:1px solid rgba(139,92,246,0.15); }
      .api-input { width:100%;padding:10px;border-radius:8px;background:var(--bg-dark);color:var(--text-white);border:1px solid rgba(255,255,255,0.1);font-size:0.95rem;box-sizing:border-box; }
      .api-label { color:var(--text-muted);font-size:0.85rem;display:block;margin-bottom:4px; }
      .api-grid3 { display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px; }
      .ep-badge { background:rgba(16,185,129,0.15);color:#10b981;padding:3px 10px;border-radius:4px;font-size:0.78rem;font-weight:700;font-family:var(--font-en); }
      .ep-badge.post { background:rgba(245,158,11,0.15);color:#f59e0b; }
      .ep-path { color:#a78bfa;font-size:0.92rem;font-family:var(--font-en); }
      .multi-select { position:relative; }
      .ms-toggle { padding:8px 10px;border-radius:8px;background:var(--bg-dark);color:var(--text-white);border:1px solid rgba(255,255,255,0.1);cursor:pointer;font-size:0.92rem;min-height:40px;display:flex;align-items:center;flex-wrap:wrap;gap:4px; }
      .ms-tag { background:rgba(139,92,246,0.2);color:#a78bfa;padding:2px 8px;border-radius:4px;font-size:0.8rem;display:inline-flex;align-items:center;gap:4px;white-space:nowrap; }
      .ms-tag .ms-x { cursor:pointer;opacity:0.6;font-size:0.7rem; }
      .ms-tag .ms-x:hover { opacity:1; }
      .ms-placeholder { color:rgba(255,255,255,0.3);font-size:0.88rem; }
      .ms-dropdown { display:none;position:absolute;top:100%;left:0;right:0;z-index:100;background:var(--bg-card);border:1px solid rgba(139,92,246,0.3);border-radius:8px;max-height:220px;overflow-y:auto;margin-top:4px;box-shadow:0 8px 32px rgba(0,0,0,0.5); }
      .multi-select.open .ms-dropdown { display:block; }
      .ms-item { padding:8px 14px;cursor:pointer;font-size:0.88rem;color:var(--text-white);display:flex;align-items:center;gap:8px;transition:background 0.1s; }
      .ms-item:hover { background:rgba(139,92,246,0.1); }
      .ms-item.selected { background:rgba(16,185,129,0.08); }
      .ms-check { width:16px;height:16px;border:1px solid rgba(255,255,255,0.2);border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:0.7rem;color:#10b981; }
      .ms-item.selected .ms-check { background:rgba(16,185,129,0.2);border-color:#10b981; }
      .ms-search { padding:8px;border-bottom:1px solid rgba(255,255,255,0.06); }
      .ms-search input { width:100%;padding:6px 8px;border-radius:4px;background:rgba(0,0,0,0.3);color:var(--text-white);border:1px solid rgba(255,255,255,0.08);font-size:0.85rem;box-sizing:border-box; }
      .period-row { background:rgba(0,0,0,0.2);border-radius:8px;padding:14px;margin-bottom:10px;border:1px solid rgba(139,92,246,0.1);position:relative; }
      .period-row .period-num { position:absolute;top:8px;left:8px;background:rgba(139,92,246,0.2);color:#a78bfa;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;font-weight:700; }
      .period-row .period-del { position:absolute;top:8px;right:8px;background:rgba(239,68,68,0.15);color:#ef4444;border:none;width:26px;height:26px;border-radius:50%;cursor:pointer;font-size:0.85rem;display:flex;align-items:center;justify-content:center; }
      .period-row .period-del:hover { background:rgba(239,68,68,0.3); }
      .saved-chip { display:inline-flex;align-items:center;gap:6px;background:rgba(139,92,246,0.12);color:#a78bfa;padding:6px 14px;border-radius:20px;font-size:0.85rem;cursor:pointer;border:1px solid rgba(139,92,246,0.2);transition:all 0.15s; }
      .saved-chip:hover { background:rgba(139,92,246,0.25);border-color:rgba(139,92,246,0.4); }
      .saved-chip .chip-del { color:#ef4444;font-size:0.7rem;margin-right:-4px;opacity:0.6; }
      .saved-chip .chip-del:hover { opacity:1; }
    </style>

    <div class="api-mgr">
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:28px;">
        <span style="font-size:2.2rem;">🔌</span>
        <div>
          <h1>إدارة الـ APIs الخارجية</h1>
          <p style="color:var(--text-muted);margin:4px 0 0;font-size:0.95rem;">واجهة لربط بيانات المصروفات مع برنامج الموازنات التقديرية</p>
        </div>
      </div>

      <!-- Saved Configs -->
      <div class="api-card" id="saved-configs-card" style="display:none;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <span style="font-size:1.1rem;">💾</span>
          <span style="color:var(--text-white);font-weight:600;">إعدادات محفوظة</span>
        </div>
        <div id="saved-configs-list" style="display:flex;flex-wrap:wrap;gap:8px;"></div>
      </div>

      <!-- Tester -->
      <div class="api-card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
          <h2 style="color:var(--text-white);margin:0;font-size:1.25rem;">🧪 اختبار تفاعلي — فترات متعددة</h2>
          <div style="display:flex;gap:8px;">
            <button class="btn" id="btn-save-config" style="font-size:0.82rem;background:rgba(139,92,246,0.15);color:#a78bfa;border:1px solid rgba(139,92,246,0.3);padding:6px 14px;">💾 حفظ الإعدادات</button>
          </div>
        </div>

        <div class="api-grid3" style="margin-bottom:18px;">
          <div>
            <label class="api-label">الشركات *</label>
            <div class="multi-select" id="ms-companies">
              <div class="ms-toggle"><span class="ms-placeholder">اختر الشركات...</span></div>
              <div class="ms-dropdown"><div class="ms-search"><input placeholder="بحث..." /></div><div class="ms-list"></div></div>
            </div>
          </div>
          <div>
            <label class="api-label">تفصيل شهري</label>
            <label style="display:flex;align-items:center;gap:8px;color:var(--text-white);padding:10px 0;">
              <input id="test-monthly" type="checkbox" checked /> نعم — يشمل شهر وسنه لكل سطر
            </label>
          </div>
          <div style="display:flex;align-items:flex-end;">
            <button class="btn" id="btn-add-period" style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3);width:100%;">➕ إضافة فترة</button>
          </div>
        </div>

        <div id="periods-container"></div>

        <div style="display:flex;gap:10px;align-items:center;margin-top:16px;flex-wrap:wrap;">
          <button class="btn btn-primary" id="btn-test" style="font-size:0.95rem;padding:10px 24px;">🚀 إرسال</button>
          <button class="btn" id="btn-update-fetch" style="font-size:0.88rem;background:rgba(6,182,212,0.15);color:#06b6d4;border:1px solid rgba(6,182,212,0.3);">🔄 تحديث النهاية لليوم وجلب</button>
          <div id="test-status" style="color:var(--text-muted);font-size:0.88rem;margin-right:auto;"></div>
        </div>

        <!-- GET Link -->
        <div id="get-link-box" style="display:none;margin-top:16px;background:rgba(16,185,129,0.06);border:2px solid rgba(16,185,129,0.3);border-radius:12px;padding:16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <div style="color:#10b981;font-weight:700;font-size:1rem;">🔗 رابط GET جاهز</div>
            <button class="btn btn-primary" id="btn-copy-link" style="font-size:0.85rem;padding:6px 16px;">📋 نسخ الرابط</button>
          </div>
          <div style="background:rgba(0,0,0,0.3);border-radius:8px;padding:10px 14px;">
            <code id="get-link-url" style="color:#10b981;font-size:0.82rem;font-family:var(--font-en);word-break:break-all;direction:ltr;display:block;text-align:left;"></code>
          </div>
        </div>

        <!-- JSON Output (prominent) -->
        <div id="json-output-box" style="display:none;margin-top:16px;background:rgba(245,158,11,0.04);border:2px solid rgba(245,158,11,0.25);border-radius:12px;padding:16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <div style="color:#f59e0b;font-weight:700;font-size:1.05rem;">📦 بيانات JSON جاهزة للنسخ</div>
            <div style="display:flex;gap:8px;">
              <span id="json-rows-count" style="color:var(--text-muted);font-size:0.82rem;padding:4px 10px;background:rgba(0,0,0,0.2);border-radius:4px;"></span>
              <button class="btn" id="btn-copy-data-json" style="font-size:0.88rem;background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);padding:6px 18px;">📋 نسخ JSON</button>
            </div>
          </div>
          <pre id="data-json-output" style="background:rgba(0,0,0,0.4);color:#10b981;padding:16px;border-radius:8px;max-height:450px;overflow:auto;font-size:0.82rem;font-family:var(--font-en);direction:ltr;text-align:left;margin:0;"></pre>
        </div>

        <!-- Summary + Table -->
        <div id="test-result" style="display:none;margin-top:16px;">
          <div id="result-summary" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px;"></div>
          <details>
            <summary style="color:var(--text-muted);cursor:pointer;font-size:0.88rem;">📋 عرض الجدول</summary>
            <div style="max-height:400px;overflow:auto;border-radius:8px;border:1px solid rgba(255,255,255,0.08);margin-top:8px;">
              <table class="bi-table" id="result-table" style="font-size:0.88rem;"></table>
            </div>
          </details>
        </div>
      </div>
    </div>
  `;

  // ──── Multi-Select Component ────
  function initMultiSelect(id, items, valKey, labelKey) {
    const wrap = document.getElementById(id);
    if (!wrap) return { getValues: () => [], setValues: () => {}, clear: () => {} };
    const toggle = wrap.querySelector('.ms-toggle');
    const list = wrap.querySelector('.ms-list');
    const search = wrap.querySelector('.ms-search input');
    const selected = new Set();
    const ph = toggle.querySelector('.ms-placeholder')?.textContent || 'اختر...';

    function render(filter = '') {
      const f = filter.toLowerCase();
      list.innerHTML = items.filter(i => !f || String(i[labelKey]).toLowerCase().includes(f)).map(i => {
        const v = String(i[valKey]), sel = selected.has(v);
        return `<div class="ms-item ${sel?'selected':''}" data-val="${v}"><div class="ms-check">${sel?'✓':''}</div><span>${i[labelKey]}</span></div>`;
      }).join('');
      list.querySelectorAll('.ms-item').forEach(el => {
        el.onclick = (e) => { e.stopPropagation(); const v=el.dataset.val; selected.has(v)?selected.delete(v):selected.add(v); render(search.value); updateToggle(); };
      });
    }
    function updateToggle() {
      if (selected.size === 0) { toggle.innerHTML = `<span class="ms-placeholder">${ph}</span>`; return; }
      toggle.innerHTML = Array.from(selected).map(v => {
        const item = items.find(i => String(i[valKey]) === v);
        const label = item ? (item[labelKey].length > 20 ? item[labelKey].substring(0,20)+'…' : item[labelKey]) : v;
        return `<span class="ms-tag">${label} <span class="ms-x" data-val="${v}">✕</span></span>`;
      }).join('');
      toggle.querySelectorAll('.ms-x').forEach(x => {
        x.onclick = (e) => { e.stopPropagation(); selected.delete(x.dataset.val); render(search.value); updateToggle(); };
      });
    }
    toggle.onclick = (e) => { e.stopPropagation(); wrap.classList.toggle('open'); if(wrap.classList.contains('open')) search.focus(); };
    search.onclick = (e) => e.stopPropagation();
    search.oninput = () => render(search.value);
    document.addEventListener('click', () => wrap.classList.remove('open'));
    render(); updateToggle();
    return {
      getValues: () => Array.from(selected),
      setValues: (vals) => { selected.clear(); vals.forEach(v => selected.add(String(v))); render(); updateToggle(); },
      clear: () => { selected.clear(); render(); updateToggle(); }
    };
  }

  function createInlineMultiSelect(parentEl, items, valKey, labelKey, placeholder) {
    const id = 'ms-' + Math.random().toString(36).slice(2,8);
    parentEl.innerHTML = `<div class="multi-select" id="${id}"><div class="ms-toggle"><span class="ms-placeholder">${placeholder}</span></div><div class="ms-dropdown"><div class="ms-search"><input placeholder="بحث..." /></div><div class="ms-list"></div></div></div>`;
    return initMultiSelect(id, items, valKey, labelKey);
  }

  // ──── Load dropdown data ────
  let companiesData = [], groupsData = [], costCentersData = [];
  let msCompanies;
  try {
    const [cRes, gRes, ccRes] = await Promise.all([
      fetch('/api/external/companies').then(r => r.json()),
      fetch('/api/external/groups').then(r => r.json()),
      fetch('/api/external/cost-centers').then(r => r.json()),
    ]);
    companiesData = cRes.data || [];
    groupsData = gRes.data || [];
    const seen = new Set();
    costCentersData = (ccRes.data || []).filter(c => { if(seen.has(c.name)) return false; seen.add(c.name); return true; });
    msCompanies = initMultiSelect('ms-companies', companiesData, 'id', 'name');
  } catch (e) { console.error('Failed to load dropdown data:', e); }

  // ──── Dynamic Periods ────
  let periodCounter = 0;
  const periods = [];

  function addPeriod(config) {
    const idx = periodCounter++;
    const div = document.createElement('div');
    div.className = 'period-row';
    div.id = `period-${idx}`;
    div.innerHTML = `
      <span class="period-num">${periods.length + 1}</span>
      <button class="period-del" data-idx="${idx}">✕</button>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;padding-right:36px;">
        <div><label class="api-label">تاريخ البداية *</label><input type="date" class="api-input period-from" value="${config?.dateFrom||''}" /></div>
        <div><label class="api-label">تاريخ النهاية (تلقائي: اليوم)</label><input type="date" class="api-input period-to" value="${config?.dateTo||''}" /></div>
        <div><label class="api-label">المجموعات</label><div class="period-groups"></div></div>
      </div>
      <div style="padding-right:36px;margin-top:10px;"><label class="api-label">مراكز التكلفة</label><div class="period-cc"></div></div>
    `;
    document.getElementById('periods-container').appendChild(div);
    const msG = createInlineMultiSelect(div.querySelector('.period-groups'), groupsData, 'id', 'name', 'اختر المجموعات...');
    const msCC = createInlineMultiSelect(div.querySelector('.period-cc'), costCentersData, 'name', 'name', 'اختر مراكز التكلفة...');
    if (config?.groupIds) msG.setValues(config.groupIds.map(String));
    if (config?.costCenters) msCC.setValues(config.costCenters);
    const period = { idx, div, msG, msCC };
    periods.push(period);
    div.querySelector('.period-del').onclick = () => { div.remove(); const i = periods.findIndex(p => p.idx === idx); if (i >= 0) periods.splice(i, 1); renumberPeriods(); };
    return period;
  }

  function renumberPeriods() { periods.forEach((p, i) => { p.div.querySelector('.period-num').textContent = i + 1; }); }
  function clearPeriods() { periods.forEach(p => p.div.remove()); periods.length = 0; periodCounter = 0; }

  addPeriod();
  document.getElementById('btn-add-period').onclick = () => addPeriod();

  // ──── Build/Restore Config ────
  function buildBody() {
    const compIds = (msCompanies?.getValues() || []).map(Number);
    const monthly = document.getElementById('test-monthly').checked;
    const periodsArr = periods.map(p => {
      const obj = {};
      obj.dateFrom = p.div.querySelector('.period-from').value;
      const to = p.div.querySelector('.period-to').value;
      if (to) obj.dateTo = to;
      const gids = p.msG.getValues().map(Number);
      if (gids.length) obj.groupIds = gids;
      const ccs = p.msCC.getValues();
      if (ccs.length) obj.costCenters = ccs;
      return obj;
    }).filter(p => p.dateFrom);
    return { companyIds: compIds, monthly, periods: periodsArr };
  }

  function loadConfig(cfg) {
    clearPeriods();
    if (cfg.companyIds) msCompanies?.setValues(cfg.companyIds.map(String));
    document.getElementById('test-monthly').checked = cfg.monthly !== false;
    (cfg.periods || []).forEach(p => addPeriod(p));
    if (!cfg.periods?.length) addPeriod();
  }

  // ──── Saved Configs (localStorage) ────
  function getSavedConfigs() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } }
  function saveConfigs(list) { localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }

  function renderSavedConfigs() {
    const list = getSavedConfigs();
    const card = document.getElementById('saved-configs-card');
    const container = document.getElementById('saved-configs-list');
    if (list.length === 0) { card.style.display = 'none'; return; }
    card.style.display = '';
    container.innerHTML = list.map((c, i) => `
      <div class="saved-chip" data-idx="${i}">
        <span>📁 ${c.name}</span>
        <span class="chip-del" data-idx="${i}" title="حذف">✕</span>
      </div>
    `).join('');
    container.querySelectorAll('.saved-chip').forEach(el => {
      el.onclick = (e) => {
        if (e.target.classList.contains('chip-del')) {
          const idx = Number(e.target.dataset.idx);
          const l = getSavedConfigs(); l.splice(idx, 1); saveConfigs(l); renderSavedConfigs();
          return;
        }
        const idx = Number(el.dataset.idx);
        const cfg = getSavedConfigs()[idx];
        if (cfg) loadConfig(cfg.config);
      };
    });
  }

  document.getElementById('btn-save-config').onclick = () => {
    const name = prompt('اسم الإعدادات:');
    if (!name) return;
    const list = getSavedConfigs();
    list.push({ name, config: buildBody(), savedAt: new Date().toISOString() });
    saveConfigs(list);
    renderSavedConfigs();
  };

  renderSavedConfigs();

  // ──── Update dateTo to today & fetch ────
  document.getElementById('btn-update-fetch').onclick = () => {
    periods.forEach(p => { p.div.querySelector('.period-to').value = ''; }); // clear = defaults to today
    document.getElementById('btn-test').click();
  };

  // ──── Copy base URL ────
  document.getElementById('btn-copy-base')?.addEventListener('click', () => {
    navigator.clipboard.writeText(baseUrl);
  });

  // ──── Test (fetch) ────
  document.getElementById('btn-test').onclick = async () => {
    const statusEl = document.getElementById('test-status');
    const resultEl = document.getElementById('test-result');
    const jsonBox = document.getElementById('json-output-box');
    const linkBox = document.getElementById('get-link-box');
    statusEl.textContent = '⏳ جاري الجلب...';
    statusEl.style.color = '#f59e0b';
    resultEl.style.display = 'none';
    jsonBox.style.display = 'none';
    linkBox.style.display = 'none';

    const body = buildBody();
    if (!body.companyIds.length) { statusEl.textContent = '❌ اختر شركة واحدة على الأقل'; statusEl.style.color = '#ef4444'; return; }
    if (!body.periods.length) { statusEl.textContent = '❌ أضف فترة واحدة على الأقل مع تاريخ بداية'; statusEl.style.color = '#ef4444'; return; }

    try {
      const start = performance.now();
      const res = await fetch('/api/external/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const elapsed = Math.round(performance.now() - start);
      const data = await res.json();

      if (!res.ok) { statusEl.textContent = `❌ ${res.status}: ${data.error || 'Error'}`; statusEl.style.color = '#ef4444'; return; }

      statusEl.textContent = `✅ OK — ${elapsed}ms — ${data.summary?.totalRows || 0} سطر`;
      statusEl.style.color = '#10b981';

      // GET link
      const configB64 = btoa(unescape(encodeURIComponent(JSON.stringify(body))));
      const getLink = `${baseUrl}/expenses/query?config=${encodeURIComponent(configB64)}`;
      document.getElementById('get-link-url').textContent = getLink;
      linkBox.style.display = '';
      document.getElementById('btn-copy-link').onclick = () => {
        navigator.clipboard.writeText(getLink);
        const b = document.getElementById('btn-copy-link'); b.textContent='✅ تم!'; setTimeout(()=>b.textContent='📋 نسخ الرابط',2000);
      };

      // JSON output (prominent)
      const jsonStr = JSON.stringify(data.data, null, 2);
      document.getElementById('data-json-output').textContent = jsonStr;
      document.getElementById('json-rows-count').textContent = `${data.data?.length || 0} سطر — ${(jsonStr.length / 1024).toFixed(1)} KB`;
      jsonBox.style.display = '';
      document.getElementById('btn-copy-data-json').onclick = () => {
        navigator.clipboard.writeText(jsonStr);
        const b = document.getElementById('btn-copy-data-json'); b.textContent='✅ تم النسخ!'; setTimeout(()=>b.textContent='📋 نسخ JSON',2000);
      };

      // Summary
      const summaryEl = document.getElementById('result-summary');
      const sm = data.summary || {};
      summaryEl.innerHTML = Object.entries(sm).map(([k, v]) => `
        <div style="background:rgba(16,185,129,0.06);border-radius:8px;padding:12px 16px;text-align:center;">
          <div style="color:var(--text-muted);font-size:0.78rem;">${k}</div>
          <div style="color:#10b981;font-size:1.15rem;font-weight:700;font-family:var(--font-en);">${typeof v==='number'?v.toLocaleString('en'):v}</div>
        </div>
      `).join('');

      // Table
      const rows = data.data || [];
      const tbl = document.getElementById('result-table');
      if (rows.length > 0) {
        const cols = Object.keys(rows[0]);
        const hdr = cols.map(c => `<th style="white-space:nowrap;font-size:0.82rem;">${c}</th>`).join('');
        const tbody = rows.slice(0, 300).map(r => `<tr>${cols.map(c => {
          const v = r[c]; const isNum = typeof v === 'number';
          return `<td class="${isNum?'n':''}" style="font-size:0.85rem;${isNum?'font-family:var(--font-en);':''}">${isNum ? v.toLocaleString('en') : (v ?? '-')}</td>`;
        }).join('')}</tr>`).join('');
        tbl.innerHTML = `<thead><tr>${hdr}</tr></thead><tbody>${tbody}</tbody>`;
        if (rows.length > 300) tbl.innerHTML += `<tfoot><tr><td colspan="${cols.length}" style="text-align:center;color:var(--text-muted);">عرض أول 300 من ${rows.length}</td></tr></tfoot>`;
      } else { tbl.innerHTML = '<tr><td style="text-align:center;color:var(--text-muted);padding:20px;">لا توجد بيانات</td></tr>'; }
      resultEl.style.display = '';
    } catch (err) {
      statusEl.textContent = `❌ ${err.message}`;
      statusEl.style.color = '#ef4444';
    }
  };
}
