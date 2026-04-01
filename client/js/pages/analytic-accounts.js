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
let companyJournals = [];

export async function renderAnalyticAccounts(container) {
  const companies = store.get('companies') || [];

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">الحسابات التحليلية</h1>
        <p class="page-subtitle">Analytic Accounts — تصنيف ومجموعات</p>
      </div>
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
        <div class="filter-group">
          <span class="filter-label">الشركة</span>
          <select class="filter-select" id="aa-company" style="min-width:250px;">
            ${companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>
        <button class="btn btn-primary" id="btn-load-accounts" style="font-size:0.8rem;">تحميل الحسابات</button>
        <button class="btn" id="btn-save-mappings" style="font-size:0.8rem;background:rgba(16,185,129,0.15);color:var(--accent-emerald);border-color:rgba(16,185,129,0.2);" disabled>
          💾 حفظ التصنيف
        </button>
      </div>
      <div id="accounts-content">
        <p style="text-align:center;color:var(--text-muted);padding:var(--space-lg);">اختر شركة واضغط "تحميل الحسابات" لعرض الحسابات التحليلية</p>
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

  // Load groups
  await loadGroups(container);
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
    const [accounts, existingMappings, journals] = await Promise.all([
      api.getAnalyticAccounts({ companyId }),
      api.getAnalyticGroupMappings({ companyId }),
      api.getCompanyJournalNames(companyId)
    ]);

    analyticAccounts = accounts;
    mappings = existingMappings;
    companyJournals = journals || [];
    
    renderAccountsTable(container);
    container.querySelector('#btn-save-mappings').disabled = false;
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
  const journalLookup = {};
  for (const m of mappings) {
    mappingLookup[m.analytic_account] = m.group_id;
    redistLookup[m.analytic_account] = m.redistributable ? 1 : 0;
    journalLookup[m.analytic_account] = m.journal_name || '';
  }

  // Group counts
  const groupCounts = {};
  for (const m of mappings) {
    groupCounts[m.group_id] = (groupCounts[m.group_id] || 0) + 1;
  }
  const unmappedCount = analyticAccounts.filter(a => !mappingLookup[a.analytic_account]).length;

  const groupOptions = groups.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
  const journalOptions = companyJournals.map(j => `<option value="${j}">${j}</option>`).join('');

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
    <div style="margin-bottom:var(--space-md);display:flex;gap:var(--space-sm);">
      <button class="btn btn-assign-all" data-group="" style="font-size:0.72rem;padding:4px 10px;">إلغاء الكل</button>
      ${groups.map(g => `
        <button class="btn btn-assign-all" data-group="${g.id}" style="font-size:0.72rem;padding:4px 10px;background:${g.color}15;color:${g.color};border-color:${g.color}33;">
          تعيين الكل → ${g.name}
        </button>
      `).join('')}
    </div>
    <div class="table-container">
      <table class="data-table" style="font-size:0.82rem;">
        <thead>
          <tr>
            <th style="width:40px;text-align:center;"><input type="checkbox" id="check-all-aa" style="cursor:pointer;" title="تحديد الكل" /></th>
            <th style="width:50px;">#</th>
            <th style="text-align:right;">الحساب التحليلي</th>
            <th style="width:100px;text-align:center;">عدد القيود</th>
            <th style="width:220px;text-align:center;">المجموعة</th>
            <th style="width:160px;text-align:center;">اسم اليومية</th>
            <th style="width:140px;text-align:center;">قابل لإعادة التوزيع</th>
          </tr>
        </thead>
        <tbody>
          ${analyticAccounts.map((a, i) => {
            const currentGroup = mappingLookup[a.analytic_account] || '';
            const currentRedist = redistLookup[a.analytic_account] || 0;
            const currentJournal = journalLookup[a.analytic_account] || '';
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
                  <select class="filter-select account-journal-select" data-account="${a.analytic_account}" style="font-size:0.78rem;padding:4px 8px;width:100%;">
                    <option value="">— غير محدد —</option>
                    ${journalOptions.replace(`value="${currentJournal}"`, `value="${currentJournal}" selected`)}
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
  const journalSelects = container.querySelectorAll('.account-journal-select');
  const newMappings = [];

  // Build redist & journal lookups
  const redistMap = {};
  const journalMap = {};
  redistSelects.forEach(sel => { redistMap[sel.dataset.account] = parseInt(sel.value) || 0; });
  journalSelects.forEach(sel => { journalMap[sel.dataset.account] = sel.value || null; });

  groupSelects.forEach(sel => {
    if (sel.value) {
      newMappings.push({
        analytic_account: sel.dataset.account,
        group_id: parseInt(sel.value),
        redistributable: redistMap[sel.dataset.account] || 0,
        journal_name: journalMap[sel.dataset.account] || null,
      });
    }
  });

  try {
    await api.saveAnalyticGroupMappings({ companyId, mappings: newMappings });
    showToast('✅ تم حفظ التصنيف بنجاح', 'success');
    // Reload to update counts
    await loadAccounts(container);
  } catch (err) {
    console.error('Save mappings error:', err);
    showToast('خطأ في حفظ التصنيف', 'error');
  }
}
