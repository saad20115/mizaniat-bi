import { api } from '../api.js';
import { store } from '../store.js';
import { showToast, showModal, closeModal } from '../utils/ui.js';
import { formatNumber } from '../utils/format.js';

let progressTimers = {};

export async function renderSettings(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">⚙️ إعدادات النظام</h1>
        <p class="page-subtitle">إدارة الاتصال بأودو والشركات واستيراد البيانات</p>
      </div>
    </div>

    <!-- ===== Step 1: API Connection ===== -->
    <div class="settings-section card" style="border:1px solid rgba(59,130,246,0.3);">
      <h2 style="font-size:1.1rem;color:var(--accent-blue);margin-bottom:var(--space-lg);display:flex;align-items:center;gap:8px;">
        <span style="background:var(--accent-blue);color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.85rem;">1</span>
        الاتصال بخادم أودو
      </h2>
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);">
        <div class="form-group" style="grid-column:1/-1;">
          <label class="form-label">رابط الـ API</label>
          <input type="text" class="form-input" id="conn-url" placeholder="https://aboghaliaoffice.com" dir="ltr" style="font-family:var(--font-en);text-align:left;" />
          <small style="color:var(--text-muted);font-size:0.72rem;">الرابط الأساسي بدون /api/ — مثال: https://aboghaliaoffice.com</small>
        </div>
        <div class="form-group">
          <label class="form-label">اسم المستخدم (Username)</label>
          <input type="text" class="form-input" id="conn-user" placeholder="admin" dir="ltr" style="font-family:var(--font-en);text-align:left;" />
        </div>
        <div class="form-group">
          <label class="form-label">كلمة المرور / مفتاح API</label>
          <input type="password" class="form-input" id="conn-pass" placeholder="كلمة المرور أو API Key" dir="ltr" style="font-family:var(--font-en);text-align:left;" />
        </div>
      </div>
      
      <div style="display:flex;gap:var(--space-md);margin-top:var(--space-lg);">
        <button class="btn btn-primary" id="btn-test-conn">🔌 اختبار الاتصال</button>
        <button class="btn btn-success" id="btn-save-conn" disabled>💾 حفظ الاتصال</button>
      </div>
      <div id="conn-result" style="margin-top:var(--space-md);"></div>
    </div>

    <!-- ===== Step 2: Saved Connections ===== -->
    <div class="settings-section card" style="margin-top:var(--space-lg);border:1px solid rgba(139,92,246,0.3);">
      <h2 style="font-size:1.1rem;color:var(--accent-purple);margin-bottom:var(--space-md);display:flex;align-items:center;gap:8px;">
        <span style="background:var(--accent-purple);color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.85rem;">✓</span>
        الاتصالات المحفوظة
      </h2>
      <div id="instances-list"><div class="skeleton" style="height:60px;border-radius:var(--radius-md);"></div></div>
    </div>

    <!-- ===== Step 2: Companies ===== -->
    <div class="settings-section card" style="margin-top:var(--space-lg);border:1px solid rgba(16,185,129,0.3);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-lg);">
        <h2 style="font-size:1.1rem;color:var(--accent-emerald);display:flex;align-items:center;gap:8px;">
          <span style="background:var(--accent-emerald);color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.85rem;">2</span>
          الشركات
        </h2>
        <button class="btn btn-primary btn-sm" id="btn-add-company">+ إضافة شركة</button>
      </div>
      <div id="companies-list"><div class="skeleton" style="height:100px;border-radius:var(--radius-md);"></div></div>
    </div>

    <!-- ===== Step 3: Import Data ===== -->
    <div class="settings-section card" style="margin-top:var(--space-lg);border:1px solid rgba(245,158,11,0.3);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-lg);">
        <h2 style="font-size:1.1rem;color:var(--accent-amber);display:flex;align-items:center;gap:8px;">
          <span style="background:var(--accent-amber);color:#000;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.85rem;">3</span>
          استيراد البيانات من أودو
        </h2>
        <button class="btn btn-success btn-sm" id="btn-sync-all">🔄 مزامنة جميع الشركات</button>
      </div>
      <p style="color:var(--text-muted);font-size:0.8rem;margin-bottom:var(--space-lg);">
        يتم استيراد البيانات على مراحل (دفعات). كل دفعة = 500 سجل. يمكنك متابعة التقدم أثناء الاستيراد.
      </p>
      <div id="import-panel"></div>
    </div>

    <!-- ===== Step 4: Sync Schedule ===== -->
    <div class="settings-section card" style="margin-top:var(--space-lg);border:1px solid rgba(6,182,212,0.3);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-lg);">
        <h2 style="font-size:1.1rem;color:#06b6d4;display:flex;align-items:center;gap:8px;">
          <span style="background:#06b6d4;color:#000;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.85rem;">4</span>
          🔄 المزامنة التلقائية
        </h2>
        <div id="schedule-status" style="font-size:0.78rem;color:var(--text-muted);"></div>
      </div>

      <div style="display:grid;grid-template-columns:auto 1fr auto;gap:var(--space-md);align-items:center;">
        <!-- Toggle -->
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
          <div style="position:relative;width:44px;height:24px;">
            <input type="checkbox" id="sync-enabled" style="opacity:0;width:0;height:0;position:absolute;">
            <span id="sync-toggle-track" style="position:absolute;inset:0;background:rgba(255,255,255,0.1);border-radius:12px;transition:background 0.3s;cursor:pointer;"></span>
            <span id="sync-toggle-dot" style="position:absolute;top:2px;right:22px;width:20px;height:20px;background:#fff;border-radius:50%;transition:all 0.3s;cursor:pointer;"></span>
          </div>
          <span style="font-size:0.85rem;color:var(--text-secondary);">تفعيل المزامنة التلقائية</span>
        </label>

        <!-- Interval -->
        <div style="display:flex;align-items:center;gap:8px;">
          <label style="font-size:0.8rem;color:var(--text-muted);white-space:nowrap;">الفترة:</label>
          <select id="sync-interval" class="filter-select" style="font-size:0.82rem;padding:6px 12px;min-width:160px;">
            <option value="1">كل ساعة</option>
            <option value="2" selected>كل ساعتين</option>
            <option value="4">كل 4 ساعات</option>
            <option value="6">كل 6 ساعات</option>
            <option value="12">كل 12 ساعة</option>
            <option value="24">يومياً</option>
          </select>
        </div>

        <!-- Save -->
        <button class="btn btn-primary btn-sm" id="btn-save-schedule">💾 حفظ الإعدادات</button>
      </div>

      <!-- Notifications -->
      <div style="margin-top:var(--space-lg);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-sm);">
          <h3 style="font-size:0.9rem;color:var(--text-secondary);margin:0;">📬 إشعارات المزامنة</h3>
          <button class="btn btn-sm" id="btn-clear-notifs" style="font-size:0.72rem;padding:3px 10px;color:var(--text-muted);">🗑 مسح</button>
        </div>
        <div id="sync-notifications-list" style="max-height:200px;overflow-y:auto;"></div>
      </div>
    </div>

    <!-- ===== Step 5: Elimination Rules (was 4) ===== -->
    <div class="settings-section card" style="margin-top:var(--space-lg);border:1px solid rgba(139,92,246,0.3);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-lg);">
        <h2 style="font-size:1.1rem;color:var(--accent-purple);display:flex;align-items:center;gap:8px;">
          <span style="background:var(--accent-purple);color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.85rem;">5</span>
          قواعد استبعاد المعاملات المتبادلة
        </h2>
        <button class="btn btn-primary btn-sm" id="btn-add-rule">+ إضافة قاعدة</button>
      </div>
      <div id="rules-list"><div class="skeleton" style="height:80px;border-radius:var(--radius-md);"></div></div>
    </div>

    <!-- ===== Sync Log ===== -->
    <div class="settings-section card" style="margin-top:var(--space-lg);border:1px solid rgba(99,102,241,0.2);">
      <h2 style="font-size:1.1rem;color:var(--text-secondary);margin-bottom:var(--space-md);">📋 سجل المزامنة</h2>
      <div id="sync-log"><div class="skeleton" style="height:80px;border-radius:var(--radius-md);"></div></div>
    </div>
  `;

  // ----- Connection test -----
  const btnTest = container.querySelector('#btn-test-conn');
  const btnSave = container.querySelector('#btn-save-conn');
  
  btnTest.addEventListener('click', async () => {
    const url = container.querySelector('#conn-url').value.trim();
    const username = container.querySelector('#conn-user').value.trim();
    const password = container.querySelector('#conn-pass').value.trim();
    const resultEl = container.querySelector('#conn-result');
    
    if (!url || !username || !password) {
      resultEl.innerHTML = '<div style="padding:12px;border-radius:8px;background:rgba(239,68,68,0.15);color:var(--accent-red);font-size:0.85rem;">⚠️ يرجى تعبئة جميع الحقول</div>';
      return;
    }

    btnTest.disabled = true;
    btnTest.textContent = 'جاري الاختبار...';
    resultEl.innerHTML = '<div style="padding:12px;color:var(--text-muted);font-size:0.85rem;">⏳ جاري اختبار الاتصال...</div>';

    try {
      const result = await api.testConnectionDirect({ url, username, password, company_id: 1 });
      
      if (result.success) {
        resultEl.innerHTML = `
          <div style="padding:12px;border-radius:8px;background:rgba(16,185,129,0.15);color:var(--accent-emerald);font-size:0.85rem;">
            ✅ الاتصال ناجح! ${result.message || ''}
          </div>
        `;
        btnSave.disabled = false;
      } else {
        resultEl.innerHTML = `
          <div style="padding:12px;border-radius:8px;background:rgba(239,68,68,0.15);color:var(--accent-red);font-size:0.85rem;">
            ❌ فشل الاتصال: ${result.message}
          </div>
        `;
        btnSave.disabled = true;
      }
    } catch (err) {
      resultEl.innerHTML = `
        <div style="padding:12px;border-radius:8px;background:rgba(239,68,68,0.15);color:var(--accent-red);font-size:0.85rem;">
          ❌ خطأ: ${err.message}
        </div>
      `;
    }
    
    btnTest.disabled = false;
    btnTest.textContent = '🔌 اختبار الاتصال';
  });

  btnSave.addEventListener('click', async () => {
    const url = container.querySelector('#conn-url').value.trim();
    const username = container.querySelector('#conn-user').value.trim();
    const password = container.querySelector('#conn-pass').value.trim();
    
    btnSave.disabled = true;
    btnSave.textContent = 'جاري الحفظ...';
    
    try {
      let hostname = url;
      try { hostname = new URL(url).hostname; } catch(e) { hostname = url.replace(/https?:\/\//, '').split('/')[0]; }
      
      await api.createInstance({
        name: 'أودو - ' + hostname,
        url: url,
        username: username,
        api_key: password,
      });
      
      showToast('تم حفظ الاتصال بنجاح ✅ — اربط الشركات به من قسم الشركات', 'success');
      
      // Clear form
      container.querySelector('#conn-url').value = '';
      container.querySelector('#conn-user').value = '';
      container.querySelector('#conn-pass').value = '';
      container.querySelector('#conn-result').innerHTML = '';
      btnSave.disabled = true;
      
      await loadSettingsData(container);
    } catch (err) {
      showToast('خطأ في الحفظ: ' + err.message, 'error');
    }
    
    btnSave.disabled = false;
    btnSave.textContent = '💾 حفظ الاتصال';
  });

  // ----- Add company -----
  container.querySelector('#btn-add-company').addEventListener('click', () => showAddCompanyModal(container));

  // ----- Add rule -----
  container.querySelector('#btn-add-rule').addEventListener('click', () => showAddRuleModal(container));

  // ----- Sync all -----
  container.querySelector('#btn-sync-all').addEventListener('click', async () => {
    try {
      await api.syncAll();
      showToast('بدأت مزامنة جميع الشركات', 'info');
      startAllProgressPolling(container);
    } catch (err) {
      showToast('خطأ: ' + err.message, 'error');
    }
  });

  // ----- Sync Schedule -----
  const toggleCb = container.querySelector('#sync-enabled');
  const toggleTrack = container.querySelector('#sync-toggle-track');
  const toggleDot = container.querySelector('#sync-toggle-dot');

  function updateToggleVisual(checked) {
    if (checked) {
      toggleTrack.style.background = '#06b6d4';
      toggleDot.style.right = '2px';
    } else {
      toggleTrack.style.background = 'rgba(255,255,255,0.1)';
      toggleDot.style.right = '22px';
    }
  }

  toggleTrack.addEventListener('click', () => { toggleCb.checked = !toggleCb.checked; updateToggleVisual(toggleCb.checked); });
  toggleDot.addEventListener('click', () => { toggleCb.checked = !toggleCb.checked; updateToggleVisual(toggleCb.checked); });

  container.querySelector('#btn-save-schedule').addEventListener('click', async () => {
    const btn = container.querySelector('#btn-save-schedule');
    btn.disabled = true;
    btn.textContent = '⏳ جاري الحفظ...';
    try {
      const result = await api.updateSchedule({
        enabled: toggleCb.checked,
        intervalHours: parseInt(container.querySelector('#sync-interval').value)
      });
      showToast(result.running ? `تم تفعيل المزامنة التلقائية — ${result.schedule}` : 'تم إيقاف المزامنة التلقائية', 'success');
      updateScheduleStatus(container, result);
    } catch (err) {
      showToast('خطأ: ' + err.message, 'error');
    }
    btn.disabled = false;
    btn.textContent = '💾 حفظ الإعدادات';
  });

  container.querySelector('#btn-clear-notifs').addEventListener('click', async () => {
    try {
      await api.clearNotifications();
      container.querySelector('#sync-notifications-list').innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:12px;font-size:0.8rem;">لا توجد إشعارات</div>';
      showToast('تم مسح الإشعارات', 'info');
    } catch (err) {
      showToast('خطأ: ' + err.message, 'error');
    }
  });

  // Load saved connection
  await loadSettingsData(container);
}

function updateScheduleStatus(container, schedule) {
  const statusEl = container.querySelector('#schedule-status');
  if (!statusEl) return;
  if (schedule.running) {
    statusEl.innerHTML = `<span style="color:#10b981;">\u25CF \u0646\u0634\u0637\u0629</span> \u2014 <span style="font-family:var(--font-en);font-size:0.72rem;">${schedule.schedule}</span>`;
  } else {
    statusEl.innerHTML = `<span style="color:var(--text-muted);">\u25CB \u0645\u062a\u0648\u0642\u0641\u0629</span>`;
  }
}

function renderNotifications(el, notifications) {
  if (!el) return;
  if (!notifications || notifications.length === 0) {
    el.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:12px;font-size:0.8rem;">\u0644\u0627 \u062a\u0648\u062c\u062f \u0625\u0634\u0639\u0627\u0631\u0627\u062a</div>';
    return;
  }
  const typeStyle = { success: 'background:rgba(16,185,129,0.12);color:#10b981;border-color:rgba(16,185,129,0.2)', warning: 'background:rgba(245,158,11,0.12);color:#f59e0b;border-color:rgba(245,158,11,0.2)', error: 'background:rgba(239,68,68,0.12);color:#ef4444;border-color:rgba(239,68,68,0.2)' };
  const typeIcon = { success: '\u2705', warning: '\u26a0\ufe0f', error: '\u274c' };
  el.innerHTML = `<div style="display:grid;gap:6px;">
    ${notifications.map(n => {
      const style = typeStyle[n.type] || typeStyle.success;
      const icon = typeIcon[n.type] || '\u2705';
      const time = n.created_at ? new Date(n.created_at + 'Z').toLocaleString('ar-SA', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : '';
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-radius:8px;border:1px solid;${style};font-size:0.8rem;">
        <span>${icon} ${n.message}</span>
        <span style="font-family:var(--font-en);font-size:0.7rem;opacity:0.7;">${time}</span>
      </div>`;
    }).join('')}
  </div>`;
}

async function loadSettingsData(container) {
  try {
    const [instances, companies, rules, syncStatus, schedule, notifications] = await Promise.all([
      api.getInstances(),
      api.getCompanies(),
      api.getEliminationRules(),
      api.getSyncStatus(),
      api.getSchedule().catch(() => ({ enabled: false, intervalHours: 2, running: false })),
      api.getNotifications().catch(() => [])
    ]);

    renderInstances(container.querySelector('#instances-list'), instances, container);
    renderCompanies(container.querySelector('#companies-list'), companies, instances, container);
    renderImportPanel(container.querySelector('#import-panel'), companies);
    renderRules(container.querySelector('#rules-list'), rules);
    renderSyncLog(container.querySelector('#sync-log'), syncStatus);

    // Schedule UI
    const toggleCb = container.querySelector('#sync-enabled');
    if (toggleCb) {
      toggleCb.checked = schedule.enabled;
      const track = container.querySelector('#sync-toggle-track');
      const dot = container.querySelector('#sync-toggle-dot');
      if (schedule.enabled) { track.style.background = '#06b6d4'; dot.style.right = '2px'; }
      else { track.style.background = 'rgba(255,255,255,0.1)'; dot.style.right = '22px'; }
    }
    const intervalSel = container.querySelector('#sync-interval');
    if (intervalSel) intervalSel.value = String(schedule.intervalHours);
    updateScheduleStatus(container, schedule);
    renderNotifications(container.querySelector('#sync-notifications-list'), notifications);
  } catch (err) {
    showToast('خطأ في تحميل الإعدادات', 'error');
  }
}

function renderInstances(el, instances, mainContainer) {
  if (instances.length === 0) {
    el.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:15px;font-size:0.85rem;">لا توجد اتصالات محفوظة — أضف اتصال من الخطوة 1</div>';
    return;
  }
  el.innerHTML = `
    <div style="display:grid;gap:var(--space-sm);">
      ${instances.map(inst => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:rgba(139,92,246,0.06);border-radius:var(--radius-md);border:1px solid rgba(139,92,246,0.15);">
          <div>
            <strong style="font-size:0.85rem;">${inst.name}</strong>
            <span style="font-family:var(--font-en);font-size:0.75rem;color:var(--text-muted);margin-right:8px;">${inst.url}</span>
            <span style="font-size:0.72rem;color:var(--text-muted);">— ${inst.username}</span>
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            <span style="font-size:0.7rem;color:var(--text-muted);font-family:var(--font-en);">ID: ${inst.id}</span>
            <button class="btn btn-sm btn-delete-instance" data-id="${inst.id}" style="background:rgba(239,68,68,0.1);color:var(--accent-red);border:1px solid rgba(239,68,68,0.2);font-size:0.75rem;padding:3px 8px;">\u274c</button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  el.querySelectorAll('.btn-delete-instance').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (!confirm('هل تريد حذف هذا الاتصال؟')) return;
      try {
        await api.deleteInstance(id);
        showToast('تم حذف الاتصال', 'success');
        await loadSettingsData(mainContainer);
      } catch (err) {
        showToast('خطأ: ' + err.message, 'error');
      }
    });
  });
}

function renderCompanies(el, companies, instances, mainContainer) {
  if (companies.length === 0) {
    el.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:0.85rem;">لا توجد شركات — أضف شركة جديدة</div>';
    return;
  }
  const instMap = {};
  for (const i of instances) instMap[i.id] = i;

  el.innerHTML = `
    <div class="data-table-wrapper">
      <table class="data-table">
        <thead><tr><th>الشركة</th><th>الخادم المربوط</th><th>Odoo ID</th><th>عدد القيود</th><th>آخر قيد</th><th>الحالة</th></tr></thead>
        <tbody>
          ${companies.map(c => {
            const inst = instMap[c.odoo_instance_id];
            const instOptions = instances.map(i =>
              `<option value="${i.id}" ${i.id === c.odoo_instance_id ? 'selected' : ''}>${i.name}</option>`
            ).join('');
            return `
            <tr>
              <td>
                <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c.color || '#3b82f6'};margin-left:8px;"></span>
                ${c.name}
              </td>
              <td>
                <select class="filter-select company-instance-select" data-company-id="${c.id}" style="font-size:0.78rem;padding:4px 8px;min-width:180px;">
                  ${instOptions}
                </select>
                ${inst ? `<div style="font-family:var(--font-en);font-size:0.68rem;color:var(--text-muted);margin-top:2px;">${inst.url} — ${inst.username}</div>` : ''}
              </td>
              <td style="font-family:var(--font-en);">${c.odoo_company_id}</td>
              <td style="font-family:var(--font-en);font-weight:600;">${formatNumber(c.item_count || 0)}</td>
              <td style="font-family:var(--font-en);font-size:0.8em;">${c.last_entry_date || '--'}</td>
              <td><span class="badge ${c.is_active ? 'badge-success' : 'badge-danger'}">${c.is_active ? 'نشط' : 'معطل'}</span></td>
            </tr>
          `}).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Handle instance reassignment inline
  el.querySelectorAll('.company-instance-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      const companyId = sel.dataset.companyId;
      const newInstanceId = parseInt(sel.value);
      try {
        await api.updateCompany(companyId, { odoo_instance_id: newInstanceId });
        showToast('تم تحديث الخادم المربوط ✅', 'success');
        await loadSettingsData(mainContainer);
      } catch (err) {
        showToast('خطأ: ' + err.message, 'error');
      }
    });
  });
}

function renderImportPanel(el, companies) {
  if (companies.length === 0) {
    el.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:0.85rem;">أضف شركات أولاً ثم ابدأ الاستيراد</div>';
    return;
  }

  el.innerHTML = companies.map(c => `
    <div class="card" style="margin-bottom:var(--space-md);border:1px solid rgba(255,255,255,0.05);padding:var(--space-md);" id="import-card-${c.id}">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${c.color || '#3b82f6'};margin-left:8px;"></span>
          <strong>${c.name}</strong>
          <span style="font-family:var(--font-en);color:var(--text-muted);font-size:0.8em;margin-right:8px;">(Odoo Company ID: ${c.odoo_company_id})</span>
          <span style="font-family:var(--font-en);color:var(--text-muted);font-size:0.8em;">— ${formatNumber(c.item_count || 0)} سجل</span>
        </div>
        <button class="btn btn-primary btn-sm btn-import" data-company-id="${c.id}">📥 استيراد</button>
      </div>
      <div class="import-progress" id="progress-${c.id}" style="margin-top:var(--space-sm);display:none;">
        <div style="display:flex;justify-content:space-between;font-size:0.78rem;color:var(--text-secondary);margin-bottom:4px;">
          <span id="progress-text-${c.id}">جاري التحضير...</span>
          <span id="progress-pct-${c.id}">0%</span>
        </div>
        <div style="height:6px;background:rgba(10,15,40,0.5);border-radius:3px;overflow:hidden;">
          <div id="progress-bar-${c.id}" style="height:100%;width:0%;background:linear-gradient(90deg,var(--accent-blue),var(--accent-emerald));border-radius:3px;transition:width 0.5s ease;"></div>
        </div>
      </div>
    </div>
  `).join('');

  // Click handlers for import buttons
  el.querySelectorAll('.btn-import').forEach(btn => {
    btn.addEventListener('click', async () => {
      const companyId = parseInt(btn.dataset.companyId);
      btn.disabled = true;
      btn.textContent = '⏳ جاري...';

      try {
        await api.syncCompany(companyId);
        showToast('بدأت عملية الاستيراد', 'info');
        startProgressPolling(companyId);
      } catch (err) {
        showToast('خطأ: ' + err.message, 'error');
        btn.disabled = false;
        btn.textContent = '📥 استيراد';
      }
    });
  });
}

function startProgressPolling(companyId) {
  const progressEl = document.getElementById(`progress-${companyId}`);
  if (progressEl) progressEl.style.display = 'block';

  // Clear existing timer
  if (progressTimers[companyId]) clearInterval(progressTimers[companyId]);

  progressTimers[companyId] = setInterval(async () => {
    try {
      const progress = await api.getSyncProgress(companyId);
      updateProgressUI(companyId, progress);

      if (progress.status === 'completed' || progress.status === 'failed') {
        clearInterval(progressTimers[companyId]);
        delete progressTimers[companyId];
        
        const btn = document.querySelector(`[data-company-id="${companyId}"]`);
        if (btn) {
          btn.disabled = false;
          btn.textContent = progress.status === 'completed' ? '✅ تم' : '📥 إعادة الاستيراد';
        }

        if (progress.status === 'completed') {
          showToast(`تم استيراد ${formatNumber(progress.inserted)} سجل بنجاح ✅`, 'success');
          // Refresh companies list
          const companies = await api.getCompanies();
          store.set('companies', companies);
        } else {
          showToast(`فشل الاستيراد: ${progress.phase}`, 'error');
        }
      }
    } catch (err) {
      console.error('Progress poll error:', err);
    }
  }, 1500); // Poll every 1.5 seconds
}

function startAllProgressPolling(container) {
  const companies = store.get('companies');
  for (const c of companies) {
    startProgressPolling(c.id);
  }
}

function updateProgressUI(companyId, progress) {
  const textEl = document.getElementById(`progress-text-${companyId}`);
  const pctEl = document.getElementById(`progress-pct-${companyId}`);
  const barEl = document.getElementById(`progress-bar-${companyId}`);
  const progressEl = document.getElementById(`progress-${companyId}`);

  if (!textEl || !pctEl || !barEl) return;

  progressEl.style.display = 'block';
  textEl.textContent = progress.phase || '';

  if (progress.total > 0) {
    const pct = Math.round((progress.inserted / progress.total) * 100);
    pctEl.textContent = `${pct}%`;
    barEl.style.width = `${pct}%`;
  }

  if (progress.status === 'completed') {
    barEl.style.background = 'var(--accent-emerald)';
    barEl.style.width = '100%';
    pctEl.textContent = '100%';
  } else if (progress.status === 'failed') {
    barEl.style.background = 'var(--accent-red)';
  }
}

function renderRules(el, rules) {
  if (rules.length === 0) {
    el.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:15px;font-size:0.85rem;">لا توجد قواعد استبعاد</div>';
    return;
  }
  el.innerHTML = `
    <div class="data-table-wrapper">
      <table class="data-table">
        <thead><tr><th>القاعدة</th><th>الشركة المصدر</th><th>الشركة الهدف</th><th>حساب المصدر</th><th>حساب الهدف</th></tr></thead>
        <tbody>
          ${rules.map(r => `
            <tr>
              <td>${r.name}</td>
              <td>${r.source_company_name || '--'}</td>
              <td>${r.target_company_name || '--'}</td>
              <td style="font-family:var(--font-en);">${r.source_account_code || '--'}</td>
              <td style="font-family:var(--font-en);">${r.target_account_code || '--'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderSyncLog(el, logs) {
  if (logs.length === 0) {
    el.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:15px;font-size:0.85rem;">لا يوجد سجل مزامنة بعد</div>';
    return;
  }
  el.innerHTML = `
    <div class="data-table-wrapper">
      <table class="data-table">
        <thead><tr><th>الشركة</th><th>الحالة</th><th>السجلات</th><th>البداية</th><th>النهاية</th><th>الخطأ</th></tr></thead>
        <tbody>
          ${logs.slice(0, 20).map(l => `
            <tr>
              <td>${l.company_name || '--'}</td>
              <td>
                <span class="badge badge-${l.status === 'completed' ? 'success' : l.status === 'failed' ? 'danger' : 'warning'}">
                  ${l.status === 'completed' ? '✅ مكتمل' : l.status === 'failed' ? '❌ فشل' : '⏳ جاري'}
                </span>
              </td>
              <td style="font-family:var(--font-en);">${formatNumber(l.records_synced || 0)}</td>
              <td style="font-family:var(--font-en);font-size:0.72em;">${l.started_at || ''}</td>
              <td style="font-family:var(--font-en);font-size:0.72em;">${l.completed_at || ''}</td>
              <td style="font-size:0.72em;color:var(--accent-red);max-width:200px;overflow:hidden;text-overflow:ellipsis;">${l.error_message || ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function showAddCompanyModal(mainContainer) {
  showModal('إضافة شركة جديدة', `
    <div class="form-group">
      <label class="form-label">اسم الشركة</label>
      <input type="text" class="form-input" id="comp-name" dir="rtl" placeholder="مثال: شركة أبو غالية للتطوير العقاري" />
    </div>
    <div class="form-group">
      <label class="form-label">معرف الشركة في أودو (Company ID)</label>
      <input type="number" class="form-input" id="comp-odoo-id" placeholder="1" dir="ltr" style="font-family:var(--font-en);" />
      <small style="color:var(--text-muted);font-size:0.72rem;">هذا هو الرقم في ?company_id=X في رابط الـ API</small>
    </div>
    <div class="form-group">
      <label class="form-label">اتصال أودو</label>
      <select class="filter-select" id="comp-instance" style="width:100%;"></select>
    </div>
    <div class="form-group">
      <label class="form-label">العملة</label>
      <input type="text" class="form-input" id="comp-currency" value="SAR" dir="ltr" style="font-family:var(--font-en);" />
    </div>
    <div class="form-group">
      <label class="form-label">اللون</label>
      <input type="color" id="comp-color" value="#3b82f6" style="width:50px;height:36px;border:none;cursor:pointer;" />
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:var(--space-lg);">
      <button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.remove('active')">إلغاء</button>
      <button class="btn btn-primary" id="btn-save-company">حفظ</button>
    </div>
  `);

  api.getInstances().then(instances => {
    const sel = document.getElementById('comp-instance');
    if (instances.length === 0) {
      sel.innerHTML = '<option disabled>⚠️ أضف اتصال أودو أولاً</option>';
    } else {
      sel.innerHTML = instances.map(i => `<option value="${i.id}">${i.name} (${i.url})</option>`).join('');
    }
  });

  document.getElementById('btn-save-company').addEventListener('click', async () => {
    const name = document.getElementById('comp-name').value;
    const odooId = parseInt(document.getElementById('comp-odoo-id').value);
    const instId = parseInt(document.getElementById('comp-instance').value);
    
    if (!name || !odooId) {
      showToast('يرجى تعبئة الاسم ومعرف الشركة', 'warning');
      return;
    }

    try {
      await api.createCompany({
        name: name,
        odoo_company_id: odooId,
        odoo_instance_id: instId,
        currency: document.getElementById('comp-currency').value || 'SAR',
        color: document.getElementById('comp-color').value,
      });
      closeModal();
      showToast('تم إضافة الشركة بنجاح ✅', 'success');
      const companies = await api.getCompanies();
      store.set('companies', companies);
      await loadSettingsData(mainContainer);
    } catch (err) {
      showToast('خطأ: ' + err.message, 'error');
    }
  });
}

function showAddRuleModal(mainContainer) {
  const companies = store.get('companies');
  showModal('إضافة قاعدة استبعاد', `
    <div class="form-group">
      <label class="form-label">اسم القاعدة</label>
      <input type="text" class="form-input" id="rule-name" dir="rtl" placeholder="مثل: استبعاد إيرادات المقاولات بين الشركات" />
    </div>
    <div class="form-group">
      <label class="form-label">الشركة المصدر</label>
      <select class="filter-select" id="rule-source" style="width:100%;">
        ${companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">الشركة الهدف</label>
      <select class="filter-select" id="rule-target" style="width:100%;">
        ${companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">كود حساب المصدر</label>
      <input type="text" class="form-input" id="rule-src-acc" placeholder="مثل: 4100" dir="ltr" style="font-family:var(--font-en);" />
    </div>
    <div class="form-group">
      <label class="form-label">كود حساب الهدف</label>
      <input type="text" class="form-input" id="rule-tgt-acc" placeholder="مثل: 5100" dir="ltr" style="font-family:var(--font-en);" />
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:var(--space-lg);">
      <button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.remove('active')">إلغاء</button>
      <button class="btn btn-primary" id="btn-save-rule">حفظ</button>
    </div>
  `);

  document.getElementById('btn-save-rule').addEventListener('click', async () => {
    try {
      await api.createEliminationRule({
        name: document.getElementById('rule-name').value,
        source_company_id: parseInt(document.getElementById('rule-source').value),
        target_company_id: parseInt(document.getElementById('rule-target').value),
        source_account_code: document.getElementById('rule-src-acc').value,
        target_account_code: document.getElementById('rule-tgt-acc').value,
      });
      closeModal();
      showToast('تم إضافة القاعدة بنجاح ✅', 'success');
      await loadSettingsData(mainContainer);
    } catch (err) {
      showToast('خطأ: ' + err.message, 'error');
    }
  });
}
