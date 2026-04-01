import { api } from '../api.js';
import { store } from '../store.js';
import { showToast } from '../utils/ui.js';

let currentJournals = [];
let companyId = null;

export async function renderJournalMapping(container) {
  const companies = store.get('companies') || [];
  
  if (!companies.length) {
    container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:var(--space-2xl);">يرجى إضافة شركة أولاً.</p>';
    return;
  }

  // Auto-select first company
  companyId = companies[0].id;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">توحيد اليوميات</h1>
        <p class="page-subtitle">Journal Consolidation — دمج أسماء اليوميات المكررة</p>
      </div>
    </div>

    <div class="glass-card" style="padding:var(--space-lg);margin-bottom:var(--space-lg);">
      <div style="display:flex;align-items:flex-end;gap:var(--space-md);margin-bottom:var(--space-lg);">
        <div class="filter-group" style="flex:1;max-width:300px;">
          <span class="filter-label">الشركة</span>
          <select class="filter-select" id="jm-company">
            ${companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>
      </div>
      
      <div id="journal-content">
        <div class="skeleton" style="height:300px;border-radius:var(--radius-md);"></div>
      </div>
    </div>
  `;

  const companySelect = container.querySelector('#jm-company');
  companySelect.addEventListener('change', (e) => {
    companyId = parseInt(e.target.value);
    loadJournals(container);
  });

  await loadJournals(container);
}

async function loadJournals(container) {
  const contentEl = container.querySelector('#journal-content');
  contentEl.innerHTML = '<div class="skeleton" style="height:300px;border-radius:var(--radius-md);"></div>';

  try {
    const data = await api.getJournalMappings(companyId);
    currentJournals = data.journals || [];
    renderTable(container, contentEl);
  } catch (err) {
    console.error('Error loading journals:', err);
    contentEl.innerHTML = `<p style="text-align:center;color:var(--accent-red);">خطأ في تحميل أسماء اليوميات<br><small style="color:rgba(255,100,100,0.6);">${err.message}</small></p>`;
  }
}

function renderTable(container, contentEl) {
  if (!currentJournals.length) {
    contentEl.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:var(--space-xl);">لا توجد يوميات لهذه الشركة.</p>';
    return;
  }

  // Build the list of distinct names to populate datalist for target name
  const allNames = currentJournals.map(j => j.journal_name);
  const datalistOptions = allNames.map(n => `<option value="${n}">`).join('');

  contentEl.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md);padding-bottom:var(--space-sm);border-bottom:1px solid rgba(255,255,255,0.05);">
        <h4 style="margin:0;font-size:0.95rem;color:var(--text-white);">🎯 تحديد ودمج الأسماء</h4>
        <span style="font-size:0.8rem;color:var(--text-muted);">إجمالي اليوميات المختلفة: ${currentJournals.length}</span>
    </div>

    <!-- Merge controls -->
    <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);padding:var(--space-md);border-radius:var(--radius-md);margin-bottom:var(--space-lg);display:flex;flex-wrap:wrap;gap:var(--space-md);align-items:flex-end;">
      <div style="flex:1;">
        <label style="display:block;font-size:0.8rem;color:var(--text-secondary);margin-bottom:6px;">الاسم الموحد الجديد (Target Name)</label>
        <input type="text" id="target-journal-name" list="journal-list" class="filter-select" style="width:100%;" placeholder="اختر من القائمة أو اكتب اسماً جديداً...">
        <datalist id="journal-list">
          ${datalistOptions}
        </datalist>
      </div>
      <div>
        <button id="btn-merge" class="btn btn-primary" style="padding:8px 24px;" disabled>
          دمج المحدد (<span id="selected-count">0</span>)
        </button>
      </div>
    </div>

    <!-- Table -->
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:50px;text-align:center;">
              <input type="checkbox" id="check-all" style="cursor:pointer;" />
            </th>
            <th style="width:60px;">#</th>
            <th>اسم اليومية الحالي (Original Name)</th>
            <th style="width:150px;text-align:center;">عدد السجلات المرتبطة</th>
          </tr>
        </thead>
        <tbody>
          ${currentJournals.map((j, i) => `
            <tr>
              <td style="text-align:center;">
                <input type="checkbox" class="row-checkbox" value="${j.journal_name}" style="cursor:pointer;" />
              </td>
              <td style="color:var(--text-muted);font-size:0.8rem;">${i + 1}</td>
              <td style="font-weight:500;">
                <span style="cursor:pointer;" class="clickable-name" data-val="${j.journal_name}">${j.journal_name}</span>
              </td>
              <td style="text-align:center;color:var(--text-muted);">
                <span style="background:rgba(255,255,255,0.05);padding:2px 10px;border-radius:var(--radius-sm);font-size:0.8rem;">
                  ${j.count}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    
    <div style="margin-top:var(--space-md);font-size:0.8rem;color:var(--text-secondary);line-height:1.6;">
      <p>💡 <b>ملاحظة:</b> لتسهيل عملية الدمج، يمكنك الضغط على أي اسم يومية في الجدول لنسخه كاسم موحد في الحقل أعلاه.</p>
    </div>
  `;

  // Checkbox logic
  const checkAll = contentEl.querySelector('#check-all');
  const rowCheckboxes = contentEl.querySelectorAll('.row-checkbox');
  const selectedCountSpan = contentEl.querySelector('#selected-count');
  const btnMerge = contentEl.querySelector('#btn-merge');

  function updateSelection() {
    const selected = Array.from(rowCheckboxes).filter(chk => chk.checked).length;
    selectedCountSpan.textContent = selected;
    btnMerge.disabled = selected === 0;
    checkAll.checked = selected === rowCheckboxes.length && selected > 0;
  }

  checkAll.addEventListener('change', (e) => {
    rowCheckboxes.forEach(chk => { chk.checked = e.target.checked; });
    updateSelection();
  });

  rowCheckboxes.forEach(chk => {
    chk.addEventListener('change', updateSelection);
  });

  // Clicking on a name copies it to the target input
  const targetInput = contentEl.querySelector('#target-journal-name');
  contentEl.querySelectorAll('.clickable-name').forEach(span => {
    span.addEventListener('click', () => {
      targetInput.value = span.dataset.val;
    });
  });

  // Merge Action
  btnMerge.addEventListener('click', async () => {
    const sourceNames = Array.from(rowCheckboxes)
      .filter(chk => chk.checked)
      .map(chk => chk.value);
    
    const targetName = targetInput.value.trim();

    if (!targetName) {
      showToast('يرجى تحديد إسم موحد لدمج اليوميات المختارة', 'error');
      targetInput.focus();
      return;
    }

    if (sourceNames.length === 0) return;

    if (!confirm(`هل أنت متأكد من دمج ${sourceNames.length} يومية في اسم واحد: "${targetName}"؟\nسوف يتم تحديث جميع القيود المرتبطة فوراً.`)) {
      return;
    }

    const originalBtnText = btnMerge.innerHTML;
    btnMerge.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span> جاري الدمج...';
    btnMerge.disabled = true;

    try {
      await api.mergeJournals({
        companyId,
        sourceNames,
        targetName
      });
      showToast('✅ تم توحيد اليوميات بنجاح', 'success');
      await loadJournals(container); // reload
    } catch (err) {
      console.error(err);
      showToast(err.message || 'خطأ في عملية الدمج', 'error');
      btnMerge.innerHTML = originalBtnText;
      updateSelection();
    }
  });
}
