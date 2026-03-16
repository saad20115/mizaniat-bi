import { api } from '../api.js';
import { store } from '../store.js';
import { formatNumber } from '../utils/format.js';
import { showToast } from '../utils/ui.js';

export async function renderClosingEntries(container) {
  const companies = store.get('companies') || [];

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">قيود الإقفال</h1>
        <p class="page-subtitle">Closing Entries Management</p>
      </div>
    </div>
    
    <div class="glass-card" style="padding:var(--space-lg);margin-bottom:var(--space-lg);">
      <div style="display:flex;flex-wrap:wrap;gap:var(--space-md);align-items:flex-end;">
        <div class="filter-group">
          <span class="filter-label">الشركة</span>
          <select class="filter-select" id="ce-company" style="min-width:220px;">
            <option value="">كل الشركات</option>
            ${companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="filter-group" style="align-self:flex-end;">
          <button class="btn btn-primary" id="btn-ce-load">عرض القيود</button>
        </div>
      </div>
    </div>

    <div id="ce-content">
      <div class="skeleton" style="height:200px;border-radius:var(--radius-lg);"></div>
    </div>
  `;

  container.querySelector('#btn-ce-load').addEventListener('click', () => loadClosingEntries(container));
  
  // Auto-load
  loadClosingEntries(container);
}

async function loadClosingEntries(container) {
  const el = container.querySelector('#ce-content');
  const companyId = container.querySelector('#ce-company').value;
  
  el.innerHTML = '<div class="skeleton" style="height:200px;border-radius:var(--radius-lg);"></div>';
  
  try {
    const data = await api.getClosingEntries({ companyId });
    renderEntries(container, data.entries || []);
  } catch (err) {
    console.error('Error loading closing entries:', err);
    el.innerHTML = '<p style="text-align:center;color:var(--accent-red);padding:var(--space-xl);">خطأ في تحميل القيود</p>';
  }
}

function renderEntries(container, entries) {
  const el = container.querySelector('#ce-content');
  
  if (entries.length === 0) {
    el.innerHTML = `
      <div class="glass-card" style="padding:var(--space-xl);text-align:center;">
        <div style="font-size:2rem;margin-bottom:var(--space-md);">📋</div>
        <div style="color:var(--text-muted);font-size:0.9rem;">لا توجد قيود إقفال حالياً</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:var(--space-sm);">
          يمكنك إنشاء قيود إقفال من صفحة <strong>ميزان المراجعة</strong>
        </div>
      </div>
    `;
    return;
  }

  el.innerHTML = entries.map(entry => {
    const lines = entry.lines || [];
    return `
    <div class="glass-card fade-in" style="padding:var(--space-lg);margin-bottom:var(--space-lg);border:1px solid rgba(245,158,11,0.15);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md);flex-wrap:wrap;gap:var(--space-sm);">
        <div style="display:flex;gap:var(--space-md);align-items:center;">
          <span style="font-size:1.2rem;">🔒</span>
          <div>
            <div style="font-weight:700;color:var(--text-primary);font-size:0.95rem;">
              قيد إقفال ${entry.fiscal_year}
            </div>
            <div style="font-size:0.75rem;color:var(--text-muted);">
              🏢 ${entry.company_name || 'شركة ' + entry.company_id} — 
              الفترة: ${entry.date_from} إلى ${entry.date_to} —
              حساب الإقفال: <strong>${entry.target_account} - ${entry.target_account_name}</strong>
            </div>
            <div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px;">
              📅 تاريخ الإنشاء: ${entry.created_at || '-'}
            </div>
          </div>
        </div>
        <div style="display:flex;gap:var(--space-sm);">
          <span style="font-size:0.75rem;padding:4px 10px;border-radius:var(--radius-sm);background:rgba(16,185,129,0.1);color:var(--accent-emerald);">
            ${lines.length} سطر
          </span>
          <button class="btn btn-delete-ce" 
            data-company="${entry.company_id}" data-year="${entry.fiscal_year}"
            style="font-size:0.75rem;padding:4px 12px;background:rgba(239,68,68,0.1);color:var(--accent-red);border:1px solid rgba(239,68,68,0.2);cursor:pointer;">
            🗑️ حذف
          </button>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:var(--space-md);margin-bottom:var(--space-md);">
        <div style="background:rgba(59,130,246,0.06);padding:var(--space-sm) var(--space-md);border-radius:var(--radius-sm);">
          <div style="font-size:0.7rem;color:var(--text-muted);">إجمالي المدين</div>
          <div style="font-weight:700;color:var(--text-primary);font-family:var(--font-en);">${formatNumber(entry.total_debit, 2)}</div>
        </div>
        <div style="background:rgba(59,130,246,0.06);padding:var(--space-sm) var(--space-md);border-radius:var(--radius-sm);">
          <div style="font-size:0.7rem;color:var(--text-muted);">إجمالي الدائن</div>
          <div style="font-weight:700;color:var(--text-primary);font-family:var(--font-en);">${formatNumber(entry.total_credit, 2)}</div>
        </div>
        <div style="background:${Math.abs(entry.total_debit - entry.total_credit) < 0.01 ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)'};padding:var(--space-sm) var(--space-md);border-radius:var(--radius-sm);">
          <div style="font-size:0.7rem;color:var(--text-muted);">الفرق</div>
          <div style="font-weight:700;color:${Math.abs(entry.total_debit - entry.total_credit) < 0.01 ? 'var(--accent-emerald)' : 'var(--accent-red)'};font-family:var(--font-en);">${formatNumber(Math.abs(entry.total_debit - entry.total_credit), 2)}</div>
        </div>
      </div>

      <details>
        <summary style="cursor:pointer;font-size:0.8rem;color:var(--accent-blue);padding:var(--space-sm) 0;">
          📄 عرض تفاصيل القيد (${lines.length} سطر)
        </summary>
        <div class="data-table-wrapper" style="margin-top:var(--space-sm);">
          <table class="data-table" style="font-size:0.75rem;">
            <thead>
              <tr>
                <th>الكود</th>
                <th>اسم الحساب</th>
                <th>نوع الحساب</th>
                <th class="number">مدين</th>
                <th class="number">دائن</th>
              </tr>
            </thead>
            <tbody>
              ${lines.map(l => `
                <tr${l.account_code === entry.target_account ? ' style="background:rgba(16,185,129,0.08);font-weight:600;"' : ''}>
                  <td style="font-family:var(--font-en);color:var(--accent-blue);">${l.account_code}</td>
                  <td>${l.account_name}</td>
                  <td style="font-size:0.7rem;color:var(--text-muted);">${l.account_type || '-'}</td>
                  <td class="number">${l.debit ? formatNumber(l.debit, 2) : '-'}</td>
                  <td class="number">${l.credit ? formatNumber(l.credit, 2) : '-'}</td>
                </tr>
              `).join('')}
              <tr class="total-row">
                <td colspan="3" style="font-weight:700;">الإجمالي</td>
                <td class="number" style="font-weight:700;">${formatNumber(lines.reduce((s, l) => s + (l.debit || 0), 0), 2)}</td>
                <td class="number" style="font-weight:700;">${formatNumber(lines.reduce((s, l) => s + (l.credit || 0), 0), 2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </div>
  `;
  }).join('');

  // Wire up delete buttons
  el.querySelectorAll('.btn-delete-ce').forEach(btn => {
    btn.addEventListener('click', async () => {
      const companyId = btn.dataset.company;
      const fiscalYear = btn.dataset.year;
      
      if (!confirm(`هل تريد حذف قيد إقفال ${fiscalYear}؟ سيتم إزالته من قاعدة البيانات.`)) return;
      
      try {
        const result = await api.deleteClosingEntry({ companyId, fiscalYear });
        showToast(`✅ تم حذف قيد الإقفال — ${fiscalYear}`, 'success');
        loadClosingEntries(container);
      } catch (err) {
        console.error('Delete error:', err);
        showToast('خطأ في حذف القيد', 'error');
      }
    });
  });
}
