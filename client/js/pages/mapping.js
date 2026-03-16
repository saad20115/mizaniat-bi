import { api } from '../api.js';
import { store } from '../store.js';
import { showToast, showModal, closeModal } from '../utils/ui.js';

export async function renderMapping(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">توحيد شجرة الحسابات</h1>
        <p class="page-subtitle">Chart of Accounts Mapping - ربط حسابات الشركات بالحسابات الموحدة</p>
      </div>
      <button class="btn btn-primary" id="btn-add-unified">+ إضافة حساب موحد</button>
    </div>
    
    <div class="filter-group" style="margin-bottom:var(--space-lg);max-width:300px;">
      <span class="filter-label">اختر الشركة</span>
      <select class="filter-select" id="mapping-company">
        ${store.get('companies').map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
      </select>
    </div>
    
    <div class="mapping-grid" id="mapping-grid">
      <div>
        <h3 style="margin-bottom:var(--space-md);color:var(--text-secondary);font-size:0.9rem;">حسابات الشركة</h3>
        <div class="card mapping-list" id="company-accounts-list">
          <div class="skeleton" style="height:300px;"></div>
        </div>
      </div>
      <div class="mapping-arrow">→</div>
      <div>
        <h3 style="margin-bottom:var(--space-md);color:var(--text-secondary);font-size:0.9rem;">الحسابات الموحدة</h3>
        <div class="card mapping-list" id="unified-accounts-list">
          <div class="skeleton" style="height:300px;"></div>
        </div>
      </div>
    </div>

    <div style="margin-top:var(--space-xl);">
      <h3 style="margin-bottom:var(--space-md);color:var(--text-secondary);font-size:0.9rem;">حالة التوحيد</h3>
      <div id="mapping-stats" class="card"></div>
    </div>
  `;

  container.querySelector('#mapping-company').addEventListener('change', () => loadMappingData(container));
  container.querySelector('#btn-add-unified').addEventListener('click', () => showAddUnifiedModal());

  await loadMappingData(container);
}

async function loadMappingData(container) {
  try {
    const companyId = container.querySelector('#mapping-company').value;
    const [companyAccounts, unifiedAccounts] = await Promise.all([
      api.getCompanyAccounts(companyId),
      api.getUnifiedAccounts()
    ]);

    renderCompanyAccounts(container.querySelector('#company-accounts-list'), companyAccounts, unifiedAccounts, companyId);
    renderUnifiedAccounts(container.querySelector('#unified-accounts-list'), unifiedAccounts);
    renderMappingStats(container.querySelector('#mapping-stats'), companyAccounts);
  } catch (err) {
    showToast('خطأ في تحميل بيانات التوحيد', 'error');
  }
}

function renderCompanyAccounts(el, accounts, unifiedAccounts, companyId) {
  el.innerHTML = accounts.map(acc => `
    <div class="mapping-item ${acc.is_mapped ? 'mapped' : 'unmapped'}">
      <div>
        <div style="font-family:var(--font-en);font-size:0.8em;color:var(--text-muted);">${acc.code}</div>
        <div style="font-size:0.85rem;">${acc.name}</div>
        ${acc.unified_name ? `<div style="font-size:0.72rem;color:var(--accent-emerald);">← ${acc.unified_name}</div>` : ''}
      </div>
      <div>
        <select class="filter-select" style="min-width:160px;font-size:0.78rem;" data-account-id="${acc.id}" data-company-id="${companyId}">
          <option value="">-- غير معين --</option>
          ${unifiedAccounts.map(ua => `
            <option value="${ua.id}" ${acc.unified_account_id === ua.id ? 'selected' : ''}>
              ${ua.code} - ${ua.name_ar}
            </option>
          `).join('')}
        </select>
      </div>
    </div>
  `).join('') || '<div style="padding:20px;text-align:center;color:var(--text-muted);">لا توجد حسابات - قم بمزامنة البيانات أولاً</div>';

  // Change handlers
  el.querySelectorAll('select').forEach(sel => {
    sel.addEventListener('change', async () => {
      const unifiedId = parseInt(sel.value);
      const accountId = parseInt(sel.dataset.accountId);
      if (!unifiedId) return;

      try {
        await api.createMapping({ company_account_id: accountId, unified_account_id: unifiedId });
        showToast('تم ربط الحساب بنجاح', 'success');
        const companyId = sel.dataset.companyId;
        const mainContainer = el.closest('#main-content') || document.getElementById('main-content');
        // Refresh the mapping item
        const item = sel.closest('.mapping-item');
        item.classList.remove('unmapped');
        item.classList.add('mapped');
      } catch (err) {
        showToast('خطأ في ربط الحساب', 'error');
      }
    });
  });
}

function renderUnifiedAccounts(el, accounts) {
  el.innerHTML = accounts.map(acc => `
    <div class="mapping-item" style="border-right:3px solid var(--accent-blue);">
      <div>
        <div style="font-family:var(--font-en);font-size:0.8em;color:var(--text-muted);">${acc.code}</div>
        <div style="font-size:0.85rem;">${acc.name_ar}</div>
        <div style="font-size:0.72rem;color:var(--text-muted);">${acc.name_en || ''} | ${acc.account_type}</div>
      </div>
      <span class="badge ${acc.is_group ? 'badge-info' : 'badge-success'}">${acc.is_group ? 'مجموعة' : 'حساب'}</span>
    </div>
  `).join('') || '<div style="padding:20px;text-align:center;color:var(--text-muted);">لا توجد حسابات موحدة</div>';
}

function renderMappingStats(el, accounts) {
  const total = accounts.length;
  const mapped = accounts.filter(a => a.is_mapped).length;
  const pct = total > 0 ? ((mapped / total) * 100).toFixed(0) : 0;

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:var(--space-lg);">
      <div style="flex:1;">
        <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-sm);">
          <span style="font-size:0.85rem;">التقدم</span>
          <span style="font-family:var(--font-en);font-weight:600;">${mapped}/${total} (${pct}%)</span>
        </div>
        <div style="height:8px;background:rgba(10,15,40,0.5);border-radius:4px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--accent-blue),var(--accent-emerald));border-radius:4px;transition:width 0.5s ease;"></div>
        </div>
      </div>
      <div style="display:flex;gap:var(--space-md);">
        <div style="text-align:center;">
          <div style="font-size:1.3rem;font-weight:700;color:var(--accent-emerald);">${mapped}</div>
          <div style="font-size:0.72rem;color:var(--text-muted);">مربوط</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:1.3rem;font-weight:700;color:var(--accent-amber);">${total - mapped}</div>
          <div style="font-size:0.72rem;color:var(--text-muted);">غير مربوط</div>
        </div>
      </div>
    </div>
  `;
}

function showAddUnifiedModal() {
  showModal('إضافة حساب موحد جديد', `
    <div class="form-group">
      <label class="form-label">كود الحساب</label>
      <input type="text" class="form-input" id="ua-code" placeholder="مثل: 1110" />
    </div>
    <div class="form-group">
      <label class="form-label">الاسم بالعربي</label>
      <input type="text" class="form-input" id="ua-name-ar" dir="rtl" placeholder="مثل: الصندوق" />
    </div>
    <div class="form-group">
      <label class="form-label">الاسم بالإنجليزي</label>
      <input type="text" class="form-input" id="ua-name-en" placeholder="e.g. Cash" />
    </div>
    <div class="form-group">
      <label class="form-label">نوع الحساب</label>
      <select class="filter-select" id="ua-type" style="width:100%;">
        <option value="asset_cash">نقد</option>
        <option value="asset_receivable">ذمم مدينة</option>
        <option value="asset_current">أصول متداولة</option>
        <option value="asset_fixed">أصول ثابتة</option>
        <option value="liability_payable">ذمم دائنة</option>
        <option value="liability_current">التزامات متداولة</option>
        <option value="liability_non_current">التزامات طويلة</option>
        <option value="equity">حقوق ملكية</option>
        <option value="income">إيرادات</option>
        <option value="income_other">إيرادات أخرى</option>
        <option value="expense">مصروفات</option>
        <option value="expense_direct_cost">تكلفة مبيعات</option>
        <option value="expense_depreciation">استهلاك</option>
      </select>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:var(--space-lg);">
      <button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.remove('active')">إلغاء</button>
      <button class="btn btn-primary" id="btn-save-unified">حفظ</button>
    </div>
  `);

  document.getElementById('btn-save-unified').addEventListener('click', async () => {
    try {
      await api.createUnifiedAccount({
        code: document.getElementById('ua-code').value,
        name_ar: document.getElementById('ua-name-ar').value,
        name_en: document.getElementById('ua-name-en').value,
        account_type: document.getElementById('ua-type').value,
      });
      closeModal();
      showToast('تم إضافة الحساب الموحد', 'success');
    } catch (err) {
      showToast('خطأ: ' + err.message, 'error');
    }
  });
}
