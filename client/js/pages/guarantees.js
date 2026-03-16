import { api } from '../api.js';
import { store } from '../store.js';
import { formatNumber } from '../utils/format.js';
import { showToast } from '../utils/ui.js';

const fmt = v => formatNumber(v, 2);

export async function renderGuaranteesPage(container) {
  container.innerHTML = `
    <style>
      .gr-page{padding:20px 24px;max-width:1500px;margin:0 auto;direction:rtl}
      .gr-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;flex-wrap:wrap;gap:12px}
      .gr-header h1{font-size:1.5rem;font-weight:800;color:#e2e8f0;margin:0}
      .gr-stats{display:flex;gap:10px}
      .gr-stat{background:linear-gradient(135deg,rgba(30,41,59,0.6),rgba(30,41,59,0.3));border:1px solid rgba(100,116,139,0.15);border-radius:10px;padding:10px 16px;text-align:center;min-width:120px}
      .gr-stat-label{font-size:0.72rem;color:#64748b;font-weight:600}
      .gr-stat-value{font-size:1.1rem;font-weight:700;color:#e2e8f0;font-family:var(--font-en)}
      .gr-legend{display:flex;gap:16px;margin-bottom:16px;font-size:0.82rem;color:#94a3b8}
      .gr-legend span{display:flex;align-items:center;gap:5px}
      .gr-dot{width:10px;height:10px;border-radius:50%;display:inline-block}
      .gr-company{margin-bottom:20px}
      .gr-company-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:linear-gradient(135deg,rgba(30,41,59,0.7),rgba(30,41,59,0.4));border:1px solid rgba(100,116,139,0.15);border-radius:12px 12px 0 0}
      .gr-company-name{font-size:1rem;font-weight:700;color:#e2e8f0}
      .gr-company-total{font-family:var(--font-en);font-weight:700;color:#06b6d4;font-size:1rem}
      .gr-table-wrap{border:1px solid rgba(100,116,139,0.12);border-top:none;border-radius:0 0 12px 12px;overflow-x:auto;background:rgba(15,23,42,0.3)}
      .gr-table{width:100%;border-collapse:collapse;font-size:0.85rem}
      .gr-table th{background:rgba(139,92,246,0.1);color:#c4b5fd;font-weight:700;padding:9px 10px;text-align:right;white-space:nowrap;font-size:0.8rem}
      .gr-table td{padding:8px 10px;border-bottom:1px solid rgba(100,116,139,0.06);color:#cbd5e1}
      .gr-table tbody tr:nth-child(even){background:rgba(255,255,255,0.012)}
      .gr-table tbody tr:hover{background:rgba(139,92,246,0.04)}
      .gr-table .num{text-align:left;font-family:var(--font-en);font-weight:600;direction:ltr;white-space:nowrap}
      .gr-released td{opacity:0.45;text-decoration:line-through}
      .gr-btn{padding:4px 10px;border-radius:6px;border:none;cursor:pointer;font-size:0.78rem;font-weight:700;font-family:inherit;transition:all 0.2s}
      .gr-btn-release{background:rgba(245,158,11,0.12);color:#fbbf24;border:1px solid rgba(245,158,11,0.2)}
      .gr-btn-unrelease{background:rgba(16,185,129,0.12);color:#34d399;border:1px solid rgba(16,185,129,0.2)}
      .gr-btn-break{background:rgba(139,92,246,0.12);color:#a78bfa;border:1px solid rgba(139,92,246,0.2)}
      .gr-btn-del{background:rgba(239,68,68,0.1);color:#f87171;border:1px solid rgba(239,68,68,0.2);font-size:0.72rem;padding:3px 8px}
      .gr-badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:0.72rem;font-weight:700}
      .gr-badge-pending{background:rgba(59,130,246,0.15);color:#60a5fa}
      .gr-badge-released{background:rgba(245,158,11,0.15);color:#fbbf24}
      .gr-empty{text-align:center;padding:50px;color:#64748b;font-size:1rem}
      .gr-sub-row td{background:rgba(139,92,246,0.03)!important;padding-right:40px!important}
      .gr-sub-row .sub-marker{color:#8b5cf6;margin-left:6px;font-size:0.72rem}
      .gr-add-form{display:flex;gap:8px;align-items:center;padding:8px 10px;background:rgba(139,92,246,0.04);border-bottom:1px solid rgba(100,116,139,0.06)}
      .gr-add-form input{background:rgba(15,23,42,0.6);border:1px solid rgba(100,116,139,0.2);color:#e2e8f0;padding:5px 10px;border-radius:6px;font-size:0.82rem;font-family:inherit}
      .gr-add-form input:focus{outline:none;border-color:#8b5cf6}
      .gr-btn-add{background:rgba(16,185,129,0.15);color:#34d399;border:1px solid rgba(16,185,129,0.2);padding:5px 12px}
    </style>
    <div class="gr-page">
      <div class="gr-header">
        <h1>🏦 إدارة الضمانات البنكية</h1>
        <div class="gr-stats" id="gr-stats"></div>
      </div>
      <div class="gr-legend">
        <span><span class="gr-dot" style="background:#60a5fa"></span> معلّقة</span>
        <span><span class="gr-dot" style="background:#fbbf24"></span> مفرج عنها</span>
        <span><span class="gr-dot" style="background:#a78bfa"></span> تفصيل يدوي</span>
      </div>
      <div id="gr-content">
        <div class="gr-empty">⏳ جاري تحميل الضمانات...</div>
      </div>
    </div>
  `;
  await loadGuarantees(container);
}

async function loadGuarantees(container) {
  const content = container.querySelector('#gr-content');
  const stats = container.querySelector('#gr-stats');
  try {
    const data = await api.getGuarantees({});
    if (!data || !data.length) {
      content.innerHTML = '<div class="gr-empty">لا توجد ضمانات بنكية</div>';
      stats.innerHTML = '';
      return;
    }

    // Load sub-items for all items
    for (const co of data) {
      for (const item of co.items) {
        try {
          item.subItems = await api.getGuaranteeSubItems({ companyId: co.companyId, accountCode: item.account_code, moveName: item.move_name });
        } catch { item.subItems = []; }
      }
    }

    let totalPending = 0, totalReleased = 0, pendingAmount = 0, releasedAmount = 0;
    data.forEach(co => co.items.forEach(item => {
      if (item.subItems && item.subItems.length > 0) {
        item.subItems.forEach(si => {
          if (si.is_released) { totalReleased++; releasedAmount += Math.abs(si.amount); }
          else { totalPending++; pendingAmount += Math.abs(si.amount); }
        });
      } else {
        if (item.is_released) { totalReleased++; releasedAmount += Math.abs(item.balance); }
        else { totalPending++; pendingAmount += Math.abs(item.balance); }
      }
    }));

    stats.innerHTML = `
      <div class="gr-stat"><div class="gr-stat-label">معلّقة</div><div class="gr-stat-value" style="color:#60a5fa">${totalPending}</div></div>
      <div class="gr-stat"><div class="gr-stat-label">مبلغ معلّق</div><div class="gr-stat-value" style="color:#60a5fa">${fmt(pendingAmount)}</div></div>
      <div class="gr-stat"><div class="gr-stat-label">مفرج عنها</div><div class="gr-stat-value" style="color:#fbbf24">${totalReleased}</div></div>
      <div class="gr-stat"><div class="gr-stat-label">مبلغ مفرج</div><div class="gr-stat-value" style="color:#fbbf24">${fmt(releasedAmount)}</div></div>
    `;

    let html = '';
    data.forEach(co => {
      const pendAmt = co.items.reduce((s, i) => {
        if (i.subItems && i.subItems.length > 0) return s + i.subItems.filter(si => !si.is_released).reduce((ss, si) => ss + Math.abs(si.amount), 0);
        return s + (i.is_released ? 0 : Math.abs(i.balance));
      }, 0);

      html += `
        <div class="gr-company">
          <div class="gr-company-header">
            <div class="gr-company-name">🏢 ${co.companyName}</div>
            <div class="gr-company-total">معلّق: ${fmt(pendAmt)}</div>
          </div>
          <div class="gr-table-wrap">
            <table class="gr-table">
              <thead><tr>
                <th>الحالة</th><th>التاريخ</th><th>رقم القيد</th><th>الحساب</th><th>البيان</th><th>الطرف</th><th>المبلغ</th><th>إجراء</th>
              </tr></thead>
              <tbody>
      `;

      co.items.forEach(item => {
        const hasSubs = item.subItems && item.subItems.length > 0;
        const key = `${co.companyId}|${item.account_code}|${item.move_name}`;

        // Parent row
        html += `<tr class="${!hasSubs && item.is_released ? 'gr-released' : ''}">
          <td>${hasSubs ? '<span class="gr-badge" style="background:rgba(139,92,246,0.15);color:#a78bfa">مفصّل (' + item.subItems.length + ')</span>'
            : (item.is_released ? '<span class="gr-badge gr-badge-released">مفرج</span>' : '<span class="gr-badge gr-badge-pending">معلّقة</span>')}</td>
          <td style="font-family:var(--font-en);color:#94a3b8;font-size:0.82rem;white-space:nowrap">${item.date}</td>
          <td style="font-family:var(--font-en);color:#818cf8;font-size:0.82rem">${item.move_name || ''}</td>
          <td style="font-size:0.82rem">${item.account_code}</td>
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">${item.label || item.account_name || ''}</td>
          <td style="font-size:0.82rem;color:#94a3b8">${item.partner_name || ''}</td>
          <td class="num" style="font-weight:700;color:${item.balance >= 0 ? '#34d399' : '#f87171'}">${fmt(Math.abs(item.balance))}</td>
          <td style="display:flex;gap:4px;flex-wrap:nowrap">
            ${!hasSubs ? (item.is_released
              ? `<button class="gr-btn gr-btn-unrelease" data-action="unrelease" data-cid="${co.companyId}" data-acc="${item.account_code}" data-move="${item.move_name}">↩️ إلغاء</button>`
              : `<button class="gr-btn gr-btn-release" data-action="release" data-cid="${co.companyId}" data-acc="${item.account_code}" data-move="${item.move_name}">✅ إفراج</button>`) : ''}
            <button class="gr-btn gr-btn-break" data-action="breakdown" data-key="${key}">📋 تفصيل</button>
          </td>
        </tr>`;

        // Sub-items rows
        if (hasSubs) {
          item.subItems.forEach(si => {
            html += `<tr class="gr-sub-row ${si.is_released ? 'gr-released' : ''}">
              <td>${si.is_released ? '<span class="gr-badge gr-badge-released">مفرج</span>' : '<span class="gr-badge gr-badge-pending">معلّقة</span>'}</td>
              <td colspan="2"><span class="sub-marker">↳</span> ${si.description}</td>
              <td colspan="2" style="font-size:0.78rem;color:#94a3b8">${si.notes || ''}</td>
              <td></td>
              <td class="num" style="color:#a78bfa">${fmt(si.amount)}</td>
              <td style="display:flex;gap:4px">
                <button class="gr-btn ${si.is_released ? 'gr-btn-unrelease' : 'gr-btn-release'}" data-action="toggle-sub" data-subid="${si.id}" data-released="${si.is_released ? 1 : 0}">${si.is_released ? '↩️' : '✅'}</button>
                <button class="gr-btn gr-btn-del" data-action="del-sub" data-subid="${si.id}">🗑️</button>
              </td>
            </tr>`;
          });
          // Add form row
          html += `<tr class="gr-add-form" data-parent="${key}">
            <td colspan="2"><input type="text" placeholder="وصف الضمان..." class="sub-desc" style="width:100%"></td>
            <td colspan="2"><input type="number" placeholder="المبلغ" class="sub-amt" style="width:100px"></td>
            <td colspan="2"><input type="text" placeholder="ملاحظات..." class="sub-notes" style="width:100%"></td>
            <td colspan="2"><button class="gr-btn gr-btn-add" data-action="add-sub" data-cid="${co.companyId}" data-acc="${item.account_code}" data-move="${item.move_name}">➕ إضافة</button></td>
          </tr>`;
        }
      });

      html += `</tbody></table></div></div>`;
    });

    content.innerHTML = html;
    bindActions(container, data);
  } catch (err) {
    content.innerHTML = `<div class="gr-empty" style="color:#f87171">❌ ${err.message}</div>`;
  }
}

function bindActions(container, data) {
  const content = container.querySelector('#gr-content');

  // Release / Unrelease
  content.querySelectorAll('[data-action="release"],[data-action="unrelease"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { cid, acc, move, action } = btn.dataset;
      btn.disabled = true; btn.textContent = '⏳';
      try {
        if (action === 'release') await api.releaseGuarantee({ companyId: parseInt(cid), accountCode: acc, moveName: move });
        else await api.unreleaseGuarantee({ companyId: cid, accountCode: acc, moveName: move });
        showToast(action === 'release' ? '✅ تم الإفراج' : '↩️ تم الإلغاء', 'success');
        await loadGuarantees(container);
      } catch (err) { showToast('❌ ' + err.message, 'error'); }
    });
  });

  // Breakdown toggle — shows add form for items that don't have sub-items yet
  content.querySelectorAll('[data-action="breakdown"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const key = btn.dataset.key;
      const [cid, acc, move] = key.split('|');
      // Check if sub-items already exist — if not, create the first form row inline
      const existingForm = content.querySelector(`tr.gr-add-form[data-parent="${key}"]`);
      if (existingForm) {
        existingForm.style.display = existingForm.style.display === 'none' ? '' : 'none';
        return;
      }
      // Create form row after the parent
      const parentRow = btn.closest('tr');
      const formRow = document.createElement('tr');
      formRow.className = 'gr-add-form';
      formRow.dataset.parent = key;
      formRow.innerHTML = `
        <td colspan="2"><input type="text" placeholder="وصف الضمان..." class="sub-desc" style="width:100%"></td>
        <td colspan="2"><input type="number" placeholder="المبلغ" class="sub-amt" style="width:100px"></td>
        <td colspan="2"><input type="text" placeholder="ملاحظات..." class="sub-notes" style="width:100%"></td>
        <td colspan="2"><button class="gr-btn gr-btn-add" data-action="add-sub" data-cid="${cid}" data-acc="${acc}" data-move="${move}">➕ إضافة</button></td>
      `;
      parentRow.after(formRow);
      bindAddSub(container, formRow);
    });
  });

  // Toggle sub-item release
  content.querySelectorAll('[data-action="toggle-sub"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { subid, released } = btn.dataset;
      btn.disabled = true; btn.textContent = '⏳';
      try {
        await api.toggleGuaranteeSubItem(subid, { isReleased: released === '0' });
        showToast(released === '0' ? '✅ تم الإفراج' : '↩️ تم الإلغاء', 'success');
        await loadGuarantees(container);
      } catch (err) { showToast('❌ ' + err.message, 'error'); }
    });
  });

  // Delete sub-item
  content.querySelectorAll('[data-action="del-sub"]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('هل تريد حذف هذا البند؟')) return;
      btn.disabled = true;
      try {
        await api.deleteGuaranteeSubItem(btn.dataset.subid);
        showToast('🗑️ تم الحذف', 'success');
        await loadGuarantees(container);
      } catch (err) { showToast('❌ ' + err.message, 'error'); }
    });
  });

  // Add sub-item forms
  content.querySelectorAll('.gr-add-form').forEach(form => bindAddSub(container, form));
}

function bindAddSub(container, form) {
  const addBtn = form.querySelector('[data-action="add-sub"]');
  if (!addBtn) return;
  addBtn.addEventListener('click', async () => {
    const desc = form.querySelector('.sub-desc').value.trim();
    const amt = parseFloat(form.querySelector('.sub-amt').value) || 0;
    const notes = form.querySelector('.sub-notes')?.value?.trim() || '';
    if (!desc || !amt) { showToast('أدخل الوصف والمبلغ', 'warning'); return; }
    addBtn.disabled = true; addBtn.textContent = '⏳';
    try {
      await api.addGuaranteeSubItem({
        parentCompanyId: parseInt(addBtn.dataset.cid),
        parentAccountCode: addBtn.dataset.acc,
        parentMoveName: addBtn.dataset.move,
        description: desc, amount: amt, notes
      });
      showToast('✅ تمت الإضافة', 'success');
      await loadGuarantees(container);
    } catch (err) { showToast('❌ ' + err.message, 'error'); addBtn.disabled = false; addBtn.textContent = '➕ إضافة'; }
  });
}
