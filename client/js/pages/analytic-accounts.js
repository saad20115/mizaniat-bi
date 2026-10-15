import { api } from '../api.js';
import { store } from '../store.js';
import { showToast } from '../utils/ui.js';

const GROUP_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

let groups = [];
let analyticAccounts = [];
let mappings = [];
let journalDefaults = { journals: [], analytics: [] };

const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const fmt = (n) => Math.round(Number(n) || 0).toLocaleString('en-US');

export async function renderAnalyticAccounts(container) {
  const companies = store.get('companies') || [];

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">الحسابات التحليلية</h1>
        <p class="page-subtitle">Analytic Accounts — تصنيف ومجموعات</p>
      </div>
    </div>

    <!-- CC1: ambiguities that need a user decision -->
    <div class="glass-card" id="cc-conflicts-card" style="padding:var(--space-lg);margin-bottom:var(--space-lg);border:1px solid rgba(245,158,11,0.35);">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:var(--space-md);flex-wrap:wrap;margin-bottom:var(--space-sm);">
        <h3 style="margin:0;color:var(--accent-amber);font-size:0.95rem;">⚠️ تعارضات تحتاج قرارًا</h3>
        <div style="display:flex;align-items:center;gap:var(--space-sm);">
          <span id="cc-conflicts-count" style="font-size:0.75rem;color:var(--text-muted);"></span>
          <button class="btn" id="btn-cc-rebuild" style="font-size:0.72rem;padding:4px 10px;" title="إعادة حساب الأقسام ومراكز التكلفة للقيود والفواتير والتحصيل من الإعدادات الحالية">🔄 إعادة بناء الإسناد</button>
        </div>
      </div>
      <p style="margin:0 0 var(--space-md);font-size:0.78rem;color:var(--text-secondary);line-height:1.7;">
        لا يختار النظام قسمًا أو مركز تكلفة بنفسه عند الغموض. السطور والفواتير غير الموسومة بحساب تحليلي في دفتر غير محسوم تبقى في صفّ الدفتر المستقل «… — بدون مركز تكلفة» بلا قسم حتى تعتمد قرارك هنا، ثم يُعاد بناء الأرقام فورًا.
      </p>
      <div id="cc-conflicts-content"><div class="skeleton" style="height:80px;"></div></div>
    </div>

    <!-- Groups management section -->
    <div class="glass-card" style="padding:var(--space-lg);margin-bottom:var(--space-lg);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md);">
        <h3 style="margin:0;color:var(--text-white);font-size:0.95rem;">📁 المجموعات</h3>
        <button class="btn btn-primary" id="btn-add-group" style="font-size:0.8rem;">+ مجموعة جديدة</button>
      </div>
      <div id="groups-list" style="display:flex;flex-wrap:wrap;gap:var(--space-sm);"></div>
    </div>

    <!-- Company + accounts section -->
    <div class="glass-card" style="padding:var(--space-lg);margin-bottom:var(--space-lg);">
      <div style="display:flex;flex-wrap:wrap;gap:var(--space-md);align-items:flex-end;margin-bottom:var(--space-md);">
        <div class="filter-group" style="flex: 1; min-width: 200px; max-width: 100%;">
          <span class="filter-label">الشركة</span>
          <select class="filter-select" id="aa-company" style="width: 100%;">
            ${companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>
        <button class="btn btn-primary" id="btn-load-accounts" style="font-size:0.8rem; white-space: nowrap;">تحميل الحسابات</button>
        <button class="btn" id="btn-save-mappings" style="font-size:0.8rem;background:rgba(16,185,129,0.15);color:var(--accent-emerald);border-color:rgba(16,185,129,0.2);" disabled>
          💾 حفظ التصنيف
        </button>
      </div>
      <div id="accounts-content">
        <p style="text-align:center;color:var(--text-muted);padding:var(--space-lg);">اختر شركة واضغط "تحميل الحسابات" لعرض الحسابات التحليلية</p>
      </div>
    </div>

    <!-- CC1: explicit journal defaults of the selected company -->
    <div class="glass-card" id="journal-defaults-card" style="padding:var(--space-lg);margin-bottom:var(--space-lg);">
      <h3 style="margin:0 0 var(--space-sm);color:var(--text-white);font-size:0.95rem;">📒 القسم ومركز التكلفة الافتراضي للدفاتر</h3>
      <p style="margin:0 0 var(--space-md);font-size:0.78rem;color:var(--text-secondary);line-height:1.7;">
        مركز التكلفة الافتراضي يُطبَّق فقط على سطور الدفتر وفواتيره التي لا تحمل حسابًا تحليليًا في أودو؛ والقسم يُطبَّق عليها وعلى سطور الدفتر التي تحمل حسابًا تحليليًا غير مصنف في قسم. الصفوف «مُرحّلة» نُقلت مرة واحدة من الإعدادات السابقة لأنها لا تحتمل إلا قيمة واحدة؛ يمكنك تعديلها أو اعتمادها.
      </p>
      <div id="journal-defaults-content">
        <p style="text-align:center;color:var(--text-muted);padding:var(--space-md);">اختر شركة واضغط "تحميل الحسابات"</p>
      </div>
    </div>

    <!-- Add group modal -->
    <div id="group-modal" style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;z-index:1000;background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);display:none;align-items:center;justify-content:center;">
      <div class="glass-card" style="padding:var(--space-xl);width:400px;max-width:90vw;">
        <h3 style="margin:0 0 var(--space-md);color:var(--text-white);" id="modal-title">مجموعة جديدة</h3>
        <div style="margin-bottom:var(--space-md);">
          <label style="font-size:0.8rem;color:var(--text-secondary);display:block;margin-bottom:4px;">اسم المجموعة</label>
          <input type="text" id="group-name" class="filter-select" style="width:100%;" placeholder="مثال: المشاريع الحكومية" />
        </div>
        <div style="margin-bottom:var(--space-lg);">
          <label style="font-size:0.8rem;color:var(--text-secondary);display:block;margin-bottom:6px;">اللون</label>
          <div id="color-picker" style="display:flex;flex-wrap:wrap;gap:6px;">
            ${GROUP_COLORS.map((c, i) => `
              <label style="cursor:pointer;">
                <input type="radio" name="group-color" value="${c}" style="display:none;" ${i === 0 ? 'checked' : ''} />
                <span style="display:block;width:28px;height:28px;border-radius:50%;background:${c};border:3px solid transparent;transition:border-color 0.2s;" class="color-dot" data-color="${c}"></span>
              </label>
            `).join('')}
          </div>
        </div>
        <div style="display:flex;gap:var(--space-sm);justify-content:flex-end;">
          <button class="btn" id="btn-cancel-modal" style="font-size:0.8rem;">إلغاء</button>
          <button class="btn btn-primary" id="btn-confirm-modal" style="font-size:0.8rem;">حفظ</button>
        </div>
        <input type="hidden" id="edit-group-id" value="" />
      </div>
    </div>
  `;

  // Color dot selection UI
  container.querySelectorAll('.color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      container.querySelectorAll('.color-dot').forEach(d => d.style.borderColor = 'transparent');
      dot.style.borderColor = '#fff';
    });
  });
  // Init first color selected
  const firstDot = container.querySelector('.color-dot');
  if (firstDot) firstDot.style.borderColor = '#fff';

  // Events
  container.querySelector('#btn-add-group').addEventListener('click', () => openGroupModal(container));
  container.querySelector('#btn-cancel-modal').addEventListener('click', () => closeModal(container));
  container.querySelector('#btn-confirm-modal').addEventListener('click', () => saveGroup(container));
  container.querySelector('#btn-load-accounts').addEventListener('click', () => loadAccounts(container));
  container.querySelector('#btn-save-mappings').addEventListener('click', () => saveMappings(container));

  // Close modal on backdrop click
  container.querySelector('#group-modal').addEventListener('click', (e) => {
    if (e.target.id === 'group-modal') closeModal(container);
  });

  container.querySelector('#btn-cc-rebuild').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      await api.rebuildAttribution();
      showToast('✅ أُعيد بناء الإسناد من الإعدادات الحالية', 'success');
      await loadConflicts(container);
    } catch (err) {
      showToast('خطأ في إعادة البناء: ' + (err.message || ''), 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // Load groups, then the conflicts that need a decision
  await loadGroups(container);
  await loadConflicts(container);
}

// ===== CC1: CONFLICTS & JOURNAL DEFAULTS =====

function groupSelectHtml(cls, selectedId, extra = '') {
  return `
    <select class="filter-select ${cls}" ${extra} style="font-size:0.78rem;padding:4px 8px;width:100%;max-width:100%;box-sizing:border-box;">
      <option value="">— بدون قسم (يبقى في صفّه) —</option>
      ${groups.map(g => `<option value="${g.id}"${String(g.id) === String(selectedId) ? ' selected' : ''}>${esc(g.name)}</option>`).join('')}
    </select>`;
}

async function loadConflicts(container) {
  const el = container.querySelector('#cc-conflicts-content');
  const countEl = container.querySelector('#cc-conflicts-count');
  if (!el) return;
  try {
    const res = await api.getAttributionConflicts();
    const journals = res.journals || [];
    const analyticsC = res.analytics || [];
    const combos = res.combinations || [];
    const unmapped = res.unmapped_analytics || [];
    const stale = res.stale_mappings || [];
    countEl.textContent = `${journals.length + analyticsC.length + combos.length} بندًا`;
    const infoHtml = `
      ${unmapped.length ? `
      <details style="margin-top:var(--space-md);font-size:0.8rem;">
        <summary>للعلم: ${unmapped.length} مركز تكلفة له مبالغ دون قسم (يظهر باسمه حتى يُصنَّف في الجدول أدناه)</summary>
        <ul style="margin:6px 0 0;padding-right:18px;">
          ${unmapped.map(u => `<li>${esc(u.company_name)} — ${esc(u.name)} <span style="color:var(--text-muted);">(${esc(u.cost_center_key)} · إيراد ${fmt(u.revenue)} · مصروف ${fmt(u.expense)})</span></li>`).join('')}
        </ul>
      </details>` : ''}
      ${stale.length ? `
      <details style="margin-top:var(--space-sm);font-size:0.8rem;">
        <summary>للعلم: ${stale.length} تصنيف محفوظ لا يطابق أي حساب تحليلي حالي (ربما تغيّر اسمه في أودو)</summary>
        <ul style="margin:6px 0 0;padding-right:18px;">
          ${stale.map(s => `<li>${esc(s.company_name)} — ${esc(s.analytic_account)}</li>`).join('')}
        </ul>
      </details>` : ''}`;
    if (journals.length + analyticsC.length + combos.length === 0) {
      el.innerHTML = `<p style="margin:0;color:var(--accent-emerald);font-size:0.82rem;">✓ لا توجد تعارضات بانتظار قرار.</p>${infoHtml}`;
      return;
    }
    el.innerHTML = `
      ${journals.length ? `
      <div class="data-table-wrapper" id="cc-conflicts-wrap">
        <!-- Three fixed columns (journal · candidates and amounts · decision) so the table never
             needs a horizontal scroll; the two selects and the button are stacked in the last one. -->
        <table class="data-table" id="cc-conflicts-journals" style="font-size:0.8rem;table-layout:fixed;width:100%;">
          <colgroup>
            <col style="width:28%;">
            <col style="width:40%;">
            <col style="width:32%;">
          </colgroup>
          <thead>
            <tr>
              <th style="text-align:right;">الدفتر والتعارض</th>
              <th style="text-align:right;">المرشحون والمبالغ</th>
              <th style="text-align:right;">القرار</th>
            </tr>
          </thead>
          <tbody>
            ${journals.map((j, i) => {
              const ledger = (j.ledger_by_year || []).reduce((s, y) => ({ rev: s.rev + (y.revenue || 0), exp: s.exp + (y.expense || 0) }), { rev: 0, exp: 0 });
              const curGroup = j.current_default ? j.current_default.group_id : '';
              const curAnalytic = j.current_default ? j.current_default.analytic_id : '';
              const cell = 'vertical-align:top;white-space:normal;overflow-wrap:anywhere;';
              const muted = 'font-size:0.72rem;color:var(--text-muted);';
              return `
              <tr data-idx="${i}">
                <td style="${cell}">
                  <strong>${esc(j.journal_name)}</strong>
                  <div class="cc-key" style="${muted}">${esc(j.cost_center_key)}</div>
                  <div style="${muted}">${esc(j.company_name)}</div>
                  <div style="margin-top:4px;color:var(--accent-amber);font-size:0.75rem;">${j.kind === 'department' ? 'مرتبط بأكثر من قسم' : 'مرتبط بأكثر من مركز تكلفة'}</div>
                  ${j.current_default && j.current_default.group_id ? `<div style="${muted}">القسم المرحّل: ${esc(j.current_default.group_name || '')}</div>` : ''}
                </td>
                <td style="${cell}font-size:0.76rem;">
                  <div><span style="color:var(--text-muted);">الأقسام:</span> ${j.candidate_departments.map(d => esc(d.name)).join(' / ') || '—'}</div>
                  <details style="margin-top:4px;"><summary style="cursor:pointer;">${j.candidate_analytics.length} مركز تكلفة مرشح</summary>
                    <ul style="margin:4px 0 0;padding-right:16px;max-height:180px;overflow-y:auto;">
                      ${j.candidate_analytics.map(a => `<li>${esc(a.name)}${a.department_name ? ` <span style="color:var(--text-muted);">(${esc(a.department_name)})</span>` : ''}</li>`).join('')}
                    </ul>
                  </details>
                  <div style="margin-top:6px;"><span style="color:var(--text-muted);">فواتير على صفّ الدفتر:</span> ${j.invoices} <span style="${muted}">(${fmt(j.invoices_untaxed)} قبل الضريبة)</span></div>
                  <div><span style="color:var(--text-muted);">إيراد / مصروف غير موسوم:</span> ${fmt(ledger.rev)} / ${fmt(ledger.exp)}</div>
                </td>
                <td style="${cell}">
                  <label style="display:block;${muted}margin-bottom:2px;">القسم</label>
                  ${groupSelectHtml('cc-group-select', curGroup)}
                  <label style="display:block;${muted}margin:6px 0 2px;">مركز التكلفة للسطور غير الموسومة</label>
                  <select class="filter-select cc-analytic-select" style="font-size:0.78rem;padding:4px 8px;width:100%;max-width:100%;box-sizing:border-box;">
                    <option value="">— بدون (صفّ الدفتر المستقل) —</option>
                    ${j.candidate_analytics.filter(a => a.analytic_id).map(a => `<option value="${a.analytic_id}"${String(a.analytic_id) === String(curAnalytic) ? ' selected' : ''}>${esc(a.name)}</option>`).join('')}
                  </select>
                  <button class="btn btn-primary cc-decide" style="margin-top:8px;font-size:0.75rem;padding:5px 12px;">اعتماد القرار</button>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>` : ''}
      ${analyticsC.length ? `
      <div style="margin-top:var(--space-md);font-size:0.8rem;">
        <strong>حسابات تحليلية مصنفة في أكثر من قسم</strong> (تُعامل بلا قسم حتى يُصحَّح تصنيفها في الجدول أدناه):
        <ul style="margin:6px 0 0;padding-right:18px;">
          ${analyticsC.map(a => `<li>${esc(a.company_name)} — ${esc(a.analytic_account)}: ${a.departments.map(d => esc(d.name)).join(' / ')}</li>`).join('')}
        </ul>
      </div>` : ''}
      ${combos.length ? `
      <div style="margin-top:var(--space-md);font-size:0.8rem;">
        <strong>سطور بتوزيع تحليلي يجمع أكثر من خطة في مفتاح واحد</strong> (تبقى في صفّ الدفتر):
        ${combos.map(c => `${esc(c.company_name)}: ${c.lines} سطر`).join(' · ')}
      </div>` : ''}
      ${infoHtml}
    `;
    el.querySelectorAll('#cc-conflicts-journals tbody tr').forEach(tr => {
      const j = journals[Number(tr.dataset.idx)];
      tr.querySelector('.cc-decide').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        try {
          await api.saveJournalDefault({
            companyId: j.company_id,
            journalId: j.journal_id,
            groupId: tr.querySelector('.cc-group-select').value || null,
            analyticId: tr.querySelector('.cc-analytic-select').value || null
          });
          showToast('✅ تم اعتماد القرار وإعادة بناء الأرقام', 'success');
          await loadConflicts(container);
          const companyId = container.querySelector('#aa-company')?.value;
          if (companyId && String(companyId) === String(j.company_id) && analyticAccounts.length) await loadJournalDefaults(container, companyId);
        } catch (err) {
          showToast('خطأ في حفظ القرار: ' + (err.message || ''), 'error');
          btn.disabled = false;
        }
      });
    });
  } catch (err) {
    console.error('Load conflicts error:', err);
    el.innerHTML = '<p style="color:var(--accent-red);margin:0;">خطأ في تحميل التعارضات</p>';
  }
}

async function loadJournalDefaults(container, companyId) {
  const el = container.querySelector('#journal-defaults-content');
  if (!el) return;
  el.innerHTML = '<div class="skeleton" style="height:120px;"></div>';
  try {
    journalDefaults = await api.getJournalDefaults(companyId);
    const rows = journalDefaults.journals || [];
    if (!rows.length) {
      el.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:var(--space-md);">لا توجد دفاتر مبيعات أو إعدادات دفاتر لهذه الشركة</p>';
      return;
    }
    const analyticOptions = (selected) => (journalDefaults.analytics || [])
      .map(a => `<option value="${a.id}"${String(a.id) === String(selected) ? ' selected' : ''}>${esc(a.name)}</option>`).join('');
    el.innerHTML = `
      <div class="data-table-wrapper">
        <table class="data-table" id="journal-defaults-table" style="font-size:0.8rem;table-layout:fixed;width:100%;">
          <colgroup>
            <col style="width:24%;"><col style="width:8%;"><col style="width:11%;">
            <col style="width:22%;"><col style="width:23%;"><col style="width:12%;">
          </colgroup>
          <thead>
            <tr>
              <th style="text-align:right;">الدفتر</th>
              <th style="text-align:center;">الفواتير</th>
              <th style="text-align:center;">الحالة</th>
              <th style="text-align:center;">القسم</th>
              <th style="text-align:center;white-space:normal;">مركز التكلفة للسطور غير الموسومة</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((j, i) => {
              const status = j.decided_by_user
                ? '<span style="color:var(--accent-emerald);">قرار المستخدم</span>'
                : (j.source === 'seed' ? '<span style="color:var(--accent-blue);">مُرحّلة</span>' : (j.flagged ? '<span style="color:var(--accent-amber);">تحتاج قرارًا</span>' : '<span style="color:var(--text-muted);">بلا إعداد</span>'));
              return `
              <tr data-idx="${i}">
                <td style="white-space:normal;overflow-wrap:anywhere;"><strong>${esc(j.journal_name)}</strong><div style="font-size:0.7rem;color:var(--text-muted);">j:${j.journal_id}</div></td>
                <td style="text-align:center;">${j.invoices}</td>
                <td style="text-align:center;white-space:normal;">${status}</td>
                <td>${groupSelectHtml('jd-group-select', j.group_id || '')}</td>
                <td>
                  <select class="filter-select jd-analytic-select" style="font-size:0.78rem;padding:4px 8px;width:100%;max-width:100%;box-sizing:border-box;">
                    <option value="">— بدون (صفّ الدفتر المستقل) —</option>
                    ${analyticOptions(j.analytic_id || '')}
                  </select>
                </td>
                <td style="white-space:normal;">
                  <button class="btn btn-primary jd-save" style="font-size:0.72rem;padding:4px 8px;margin:2px;">حفظ</button>
                  ${j.group_id || j.analytic_id || j.decided_by_user ? '<button class="btn jd-clear" style="font-size:0.72rem;padding:4px 8px;margin:2px;">إلغاء</button>' : ''}
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
    el.querySelectorAll('#journal-defaults-table tbody tr').forEach(tr => {
      const j = rows[Number(tr.dataset.idx)];
      const after = async (msg) => {
        showToast(msg, 'success');
        await loadJournalDefaults(container, companyId);
        await loadConflicts(container);
      };
      tr.querySelector('.jd-save').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        btn.disabled = true;
        try {
          await api.saveJournalDefault({
            companyId,
            journalId: j.journal_id,
            groupId: tr.querySelector('.jd-group-select').value || null,
            analyticId: tr.querySelector('.jd-analytic-select').value || null
          });
          await after('✅ تم حفظ إعداد الدفتر وإعادة بناء الأرقام');
        } catch (err) { showToast('خطأ في الحفظ: ' + (err.message || ''), 'error'); btn.disabled = false; }
      });
      const clearBtn = tr.querySelector('.jd-clear');
      if (clearBtn) clearBtn.addEventListener('click', async () => {
        if (!confirm('سيعود الدفتر بلا قسم ولا مركز تكلفة افتراضي (صفّه المستقل). متابعة؟')) return;
        try {
          await api.deleteJournalDefault(companyId, j.journal_id);
          await after('تم إلغاء إعداد الدفتر');
        } catch (err) { showToast('خطأ: ' + (err.message || ''), 'error'); }
      });
    });
  } catch (err) {
    console.error('Load journal defaults error:', err);
    el.innerHTML = '<p style="color:var(--accent-red);text-align:center;">خطأ في تحميل إعدادات الدفاتر</p>';
  }
}

// ===== GROUPS =====

async function loadGroups(container) {
  try {
    groups = await api.getAnalyticGroups();
    renderGroups(container);
  } catch (err) {
    console.error('Load groups error:', err);
  }
}

function renderGroups(container) {
  const el = container.querySelector('#groups-list');
  if (!groups.length) {
    el.innerHTML = '<p style="color:var(--text-muted);font-size:0.8rem;">لا توجد مجموعات — أنشئ مجموعة جديدة لبدء التصنيف</p>';
    return;
  }

  el.innerHTML = groups.map(g => `
    <div class="group-chip" data-id="${g.id}" style="
      display:flex;align-items:center;gap:8px;padding:8px 14px;
      background:rgba(255,255,255,0.04);border-radius:var(--radius-md);
      border:1px solid ${g.color}33;cursor:default;
    ">
      <span style="width:12px;height:12px;border-radius:50%;background:${g.color};flex-shrink:0;"></span>
      <span style="color:var(--text-white);font-size:0.85rem;font-weight:500;">${g.name}</span>
      <button class="btn-edit-group" data-id="${g.id}" style="
        background:none;border:none;color:var(--text-muted);cursor:pointer;
        font-size:0.7rem;padding:2px 4px;margin-right:4px;
      ">✏️</button>
      <button class="btn-delete-group" data-id="${g.id}" style="
        background:none;border:none;color:var(--accent-red);cursor:pointer;
        font-size:0.7rem;padding:2px 4px;opacity:0.6;
      ">✕</button>
    </div>
  `).join('');

  el.querySelectorAll('.btn-edit-group').forEach(btn => {
    btn.addEventListener('click', () => {
      const g = groups.find(g => g.id == btn.dataset.id);
      if (g) openGroupModal(container, g);
    });
  });

  el.querySelectorAll('.btn-delete-group').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('هل تريد حذف هذه المجموعة؟ سيتم إلغاء ربط جميع الحسابات المرتبطة بها.')) return;
      try {
        await api.deleteAnalyticGroup(btn.dataset.id);
        showToast('تم حذف المجموعة', 'success');
        await loadGroups(container);
        // Re-render accounts if loaded
        if (analyticAccounts.length) renderAccountsTable(container);
      } catch (err) { showToast('خطأ في الحذف', 'error'); }
    });
  });
}

function openGroupModal(container, editGroup = null) {
  const modal = container.querySelector('#group-modal');
  modal.style.display = 'flex';
  container.querySelector('#modal-title').textContent = editGroup ? 'تعديل المجموعة' : 'مجموعة جديدة';
  container.querySelector('#group-name').value = editGroup ? editGroup.name : '';
  container.querySelector('#edit-group-id').value = editGroup ? editGroup.id : '';

  // Set color
  const targetColor = editGroup ? editGroup.color : GROUP_COLORS[0];
  container.querySelectorAll('.color-dot').forEach(d => {
    d.style.borderColor = d.dataset.color === targetColor ? '#fff' : 'transparent';
  });
  const radio = container.querySelector(`input[name="group-color"][value="${targetColor}"]`);
  if (radio) radio.checked = true;

  container.querySelector('#group-name').focus();
}

function closeModal(container) {
  container.querySelector('#group-modal').style.display = 'none';
}

async function saveGroup(container) {
  const name = container.querySelector('#group-name').value.trim();
  const color = container.querySelector('input[name="group-color"]:checked')?.value || '#3b82f6';
  const editId = container.querySelector('#edit-group-id').value;

  if (!name) { showToast('أدخل اسم المجموعة', 'error'); return; }

  try {
    if (editId) {
      await api.updateAnalyticGroup(editId, { name, color });
      showToast('✅ تم تعديل المجموعة', 'success');
    } else {
      await api.createAnalyticGroup({ name, color });
      showToast('✅ تم إنشاء المجموعة', 'success');
    }
    closeModal(container);
    await loadGroups(container);
    if (analyticAccounts.length) renderAccountsTable(container);
  } catch (err) {
    showToast('خطأ في الحفظ', 'error');
  }
}

// ===== ACCOUNTS =====

async function loadAccounts(container) {
  const companyId = container.querySelector('#aa-company').value;
  const el = container.querySelector('#accounts-content');
  el.innerHTML = '<div class="skeleton" style="height:300px;"></div>';

  try {
    const [accounts, existingMappings] = await Promise.all([
      api.getAnalyticAccounts({ companyId }),
      api.getAnalyticGroupMappings({ companyId })
    ]);

    analyticAccounts = accounts;
    mappings = existingMappings;

    renderAccountsTable(container);
    container.querySelector('#btn-save-mappings').disabled = false;
    await loadJournalDefaults(container, companyId);
  } catch (err) {
    console.error('Load accounts error:', err);
    el.innerHTML = '<p style="color:var(--accent-red);text-align:center;">خطأ في تحميل الحسابات</p>';
  }
}

function renderAccountsTable(container) {
  const el = container.querySelector('#accounts-content');
  const companySelect = container.querySelector('#aa-company');
  const companyName = companySelect.options[companySelect.selectedIndex]?.text || '';

  if (!analyticAccounts.length) {
    el.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:var(--space-lg);">لا توجد حسابات تحليلية لهذه الشركة</p>';
    return;
  }

  // Build mapping lookup
  const mappingLookup = {};
  const redistLookup = {};
  for (const m of mappings) {
    mappingLookup[m.analytic_account] = m.group_id;
    redistLookup[m.analytic_account] = m.redistributable ? 1 : 0;
  }

  // Group counts
  const groupCounts = {};
  for (const m of mappings) {
    groupCounts[m.group_id] = (groupCounts[m.group_id] || 0) + 1;
  }
  const unmappedCount = analyticAccounts.filter(a => !mappingLookup[a.analytic_account]).length;

  const groupOptions = groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');

  el.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md);">
      <h4 style="margin:0;color:var(--text-white);font-size:0.9rem;">📊 ${companyName} — ${analyticAccounts.length} حساب تحليلي</h4>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${groups.map(g => `
          <span style="font-size:0.7rem;padding:3px 10px;border-radius:var(--radius-sm);background:${g.color}22;color:${g.color};border:1px solid ${g.color}44;">
            ${g.name}: ${groupCounts[g.id] || 0}
          </span>
        `).join('')}
        <span style="font-size:0.7rem;padding:3px 10px;border-radius:var(--radius-sm);background:rgba(255,255,255,0.05);color:var(--text-muted);border:1px solid rgba(255,255,255,0.1);">
          غير مصنف: ${unmappedCount}
        </span>
      </div>
    </div>
    <div style="margin-bottom:var(--space-md);display:flex;flex-wrap:wrap;gap:var(--space-sm);">
      <button class="btn btn-assign-all" data-group="" style="font-size:0.72rem;padding:4px 10px;">إلغاء الكل</button>
      ${groups.map(g => `
        <button class="btn btn-assign-all" data-group="${g.id}" style="font-size:0.72rem;padding:4px 10px;background:${g.color}15;color:${g.color};border-color:${g.color}33;">
          تعيين الكل → ${g.name}
        </button>
      `).join('')}
    </div>
    <div class="data-table-wrapper">
      <table class="data-table" style="font-size:0.82rem;">
        <thead>
          <tr>
            <th style="width:40px;text-align:center;"><input type="checkbox" id="check-all-aa" style="cursor:pointer;" title="تحديد الكل" /></th>
            <th style="width:50px;">#</th>
            <th style="text-align:right;">الحساب التحليلي</th>
            <th style="width:100px;text-align:center;">عدد القيود</th>
            <th style="width:220px;text-align:center;">المجموعة</th>
            <th style="width:140px;text-align:center;">قابل لإعادة التوزيع</th>
          </tr>
        </thead>
        <tbody>
          ${analyticAccounts.map((a, i) => {
            const currentGroup = mappingLookup[a.analytic_account] || '';
            const currentRedist = redistLookup[a.analytic_account] || 0;
            const group = groups.find(g => g.id == currentGroup);
            return `
              <tr style="${group ? `border-right:3px solid ${group.color};` : ''}">
                <td style="text-align:center;"><input type="checkbox" class="aa-row-check" value="${a.analytic_account}" style="cursor:pointer;" /></td>
                <td style="color:var(--text-muted);font-size:0.75rem;">${i + 1}</td>
                <td style="font-weight:500;">${a.analytic_account}</td>
                <td style="text-align:center;color:var(--text-muted);">
                  <span style="background:rgba(255,255,255,0.05);padding:2px 10px;border-radius:var(--radius-sm);font-size:0.75rem;">
                    ${a.transaction_count}
                  </span>
                </td>
                <td style="text-align:center;">
                  <select class="filter-select account-group-select" data-account="${a.analytic_account}" style="font-size:0.78rem;padding:4px 8px;width:100%;">
                    <option value="">— غير مصنف —</option>
                    ${groupOptions.replace(`value="${currentGroup}"`, `value="${currentGroup}" selected`)}
                  </select>
                </td>
                <td style="text-align:center;">
                  <select class="filter-select account-redist-select" data-account="${a.analytic_account}" style="font-size:0.78rem;padding:4px 8px;width:100%;">
                    <option value="0"${currentRedist ? '' : ' selected'}>لا</option>
                    <option value="1"${currentRedist ? ' selected' : ''}>نعم</option>
                  </select>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;

  // Check All handler
  const checkAll = el.querySelector('#check-all-aa');
  const rowChecks = el.querySelectorAll('.aa-row-check');
  if (checkAll) {
    checkAll.addEventListener('change', (e) => {
      rowChecks.forEach(chk => { chk.checked = e.target.checked; });
    });
  }

  // Bulk assign buttons
  el.querySelectorAll('.btn-assign-all').forEach(btn => {
    btn.addEventListener('click', () => {
      const groupId = btn.dataset.group;
      let targetRows = Array.from(rowChecks).filter(chk => chk.checked);
      
      // If none selected, apply to all
      if (targetRows.length === 0) {
        if (!confirm('لم يتم تحديد أي حسابات. هل تريد تطبيق هذه المجموعة على جميع الحسابات في الجدول؟')) {
          return;
        }
        el.querySelectorAll('.account-group-select').forEach(sel => {
          sel.value = groupId;
          sel.dispatchEvent(new Event('change'));
        });
      } else {
        const selectedAccounts = targetRows.map(chk => chk.value);
        el.querySelectorAll('.account-group-select').forEach(sel => {
          if (selectedAccounts.includes(sel.dataset.account)) {
            sel.value = groupId;
            sel.dispatchEvent(new Event('change'));
          }
        });
        // Uncheck all after bulk apply
        if (checkAll) checkAll.checked = false;
        rowChecks.forEach(chk => chk.checked = false);
      }
    });
  });

  // Highlight row on change
  el.querySelectorAll('.account-group-select').forEach(sel => {
    sel.addEventListener('change', () => {
      const group = groups.find(g => g.id == sel.value);
      const row = sel.closest('tr');
      row.style.borderRight = group ? `3px solid ${group.color}` : '';
    });
  });
}

async function saveMappings(container) {
  const companyId = container.querySelector('#aa-company').value;
  const groupSelects = container.querySelectorAll('.account-group-select');
  const redistSelects = container.querySelectorAll('.account-redist-select');
  const newMappings = [];
  const shownAccounts = [];

  // Build redist lookup
  const redistMap = {};
  redistSelects.forEach(sel => { redistMap[sel.dataset.account] = parseInt(sel.value) || 0; });

  groupSelects.forEach(sel => {
    shownAccounts.push(sel.dataset.account);
    if (sel.value) {
      newMappings.push({
        analytic_account: sel.dataset.account,
        group_id: parseInt(sel.value),
        redistributable: redistMap[sel.dataset.account] || 0,
      });
    }
  });

  try {
    // Only the accounts shown here are replaced; journal defaults are a separate setting
    await api.saveAnalyticGroupMappings({ companyId, mappings: newMappings, accounts: shownAccounts });
    showToast('✅ تم حفظ التصنيف وإعادة بناء الأرقام', 'success');
    // Reload to update counts
    await loadAccounts(container);
    await loadConflicts(container);
  } catch (err) {
    console.error('Save mappings error:', err);
    showToast('خطأ في حفظ التصنيف', 'error');
  }
}
