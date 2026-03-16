/**
 * Viewers Management Page
 * Admin can add, edit, delete allowed phone numbers for presentation viewers
 */
import { api } from '../api.js';
import { showToast } from '../utils/ui.js';

const API_BASE = '/api';

async function authRequest(endpoint, options = {}) {
  const token = localStorage.getItem('mizaniat_admin_token');
  const config = {
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    ...options
  };
  if (config.body && typeof config.body === 'object') config.body = JSON.stringify(config.body);
  const res = await fetch(`${API_BASE}${endpoint}`, config);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function renderViewersManagement(container) {
  container.innerHTML = `
    <div class="page-header">
      <h1>👥 إدارة المشاهدين</h1>
      <p class="page-subtitle">إدارة أرقام الجوالات المسموح لها بمشاهدة العرض التقديمي</p>
    </div>

    <div class="card" style="margin-bottom:24px;">
      <div class="card-header" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
        <h3>📱 أرقام الجوالات المسموحة</h3>
        <button class="btn btn-primary" id="add-viewer-btn">➕ إضافة رقم جديد</button>
      </div>
      <div id="viewers-content">
        <div style="text-align:center; padding:40px; color:var(--text-muted);">
          <div class="spinner"></div>
        </div>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <div id="viewer-modal" style="display:none; position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.6); z-index:1000; display:none; align-items:center; justify-content:center; backdrop-filter:blur(4px);">
      <div style="background:var(--bg-card, #0f172a); border:1px solid rgba(255,255,255,0.1); border-radius:20px; padding:32px; width:400px; max-width:90vw; box-shadow:0 20px 60px rgba(0,0,0,0.5);">
        <h3 style="margin-bottom:20px; font-size:1.1rem;" id="modal-title">إضافة مشاهد جديد</h3>
        <div style="margin-bottom:16px;">
          <label style="display:block; font-size:0.85rem; color:rgba(255,255,255,0.6); margin-bottom:6px; font-weight:600;">رقم الجوال *</label>
          <input type="text" id="viewer-phone" placeholder="05xxxxxxxx" dir="ltr"
            style="width:100%; padding:12px 14px; background:rgba(255,255,255,0.05); border:1.5px solid rgba(255,255,255,0.1); border-radius:12px; color:#fff; font-size:1rem; outline:none; font-family:'Inter',sans-serif; text-align:left;">
        </div>
        <div style="margin-bottom:24px;">
          <label style="display:block; font-size:0.85rem; color:rgba(255,255,255,0.6); margin-bottom:6px; font-weight:600;">الاسم (اختياري)</label>
          <input type="text" id="viewer-name" placeholder="اسم المشاهد"
            style="width:100%; padding:12px 14px; background:rgba(255,255,255,0.05); border:1.5px solid rgba(255,255,255,0.1); border-radius:12px; color:#fff; font-size:1rem; outline:none;">
        </div>
        <div style="display:flex; gap:12px; justify-content:flex-start;">
          <button class="btn btn-primary" id="save-viewer-btn">💾 حفظ</button>
          <button class="btn" id="cancel-viewer-btn" style="background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1);">إلغاء</button>
        </div>
      </div>
    </div>
  `;

  let editingId = null;

  // Load viewers
  async function loadViewers() {
    const content = document.getElementById('viewers-content');
    try {
      const viewers = await authRequest('/auth/viewers');

      if (!viewers.length) {
        content.innerHTML = `
          <div style="text-align:center; padding:40px; color:var(--text-muted);">
            <div style="font-size:2.5rem; margin-bottom:12px;">📱</div>
            <p style="font-size:0.95rem;">لا توجد أرقام مسجلة بعد</p>
            <p style="font-size:0.85rem; margin-top:8px;">اضغط "إضافة رقم جديد" لتسجيل أول مشاهد</p>
          </div>
        `;
        return;
      }

      content.innerHTML = `
        <div style="overflow-x:auto;">
          <table class="data-table" style="width:100%;">
            <thead>
              <tr>
                <th style="width:50px;">#</th>
                <th>رقم الجوال</th>
                <th>الاسم</th>
                <th>الحالة</th>
                <th>تاريخ الإضافة</th>
                <th style="width:140px;">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              ${viewers.map((v, i) => `
                <tr>
                  <td style="color:rgba(255,255,255,0.4);">${i + 1}</td>
                  <td style="font-family:'Inter',sans-serif; font-weight:700; direction:ltr; text-align:left;">${v.phone}</td>
                  <td>${v.name || '<span style="color:rgba(255,255,255,0.3);">—</span>'}</td>
                  <td>
                    <span style="padding:4px 12px; border-radius:20px; font-size:0.8rem; font-weight:700;
                      background:${v.is_active ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'};
                      color:${v.is_active ? '#10b981' : '#ef4444'};
                      border:1px solid ${v.is_active ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'};">
                      ${v.is_active ? '✅ نشط' : '❌ معطل'}
                    </span>
                  </td>
                  <td style="font-size:0.85rem; color:rgba(255,255,255,0.5); font-family:'Inter',sans-serif;">
                    ${v.created_at ? new Date(v.created_at).toLocaleDateString('ar-SA') : '—'}
                  </td>
                  <td>
                    <div style="display:flex; gap:6px;">
                      <button class="btn btn-sm edit-btn" data-id="${v.id}" data-phone="${v.phone}" data-name="${v.name || ''}"
                        style="padding:6px 12px; font-size:0.8rem; background:rgba(59,130,246,0.15); border:1px solid rgba(59,130,246,0.3); color:#60a5fa; border-radius:8px; cursor:pointer;">
                        ✏️ تعديل
                      </button>
                      <button class="btn btn-sm toggle-btn" data-id="${v.id}" data-active="${v.is_active}"
                        style="padding:6px 12px; font-size:0.8rem; background:${v.is_active ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)'}; border:1px solid ${v.is_active ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}; color:${v.is_active ? '#ef4444' : '#10b981'}; border-radius:8px; cursor:pointer;">
                        ${v.is_active ? '🚫' : '✅'}
                      </button>
                      <button class="btn btn-sm delete-btn" data-id="${v.id}"
                        style="padding:6px 12px; font-size:0.8rem; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); color:#ef4444; border-radius:8px; cursor:pointer;">
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      // Edit handlers
      content.querySelectorAll('.edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          editingId = parseInt(btn.dataset.id);
          document.getElementById('viewer-phone').value = btn.dataset.phone;
          document.getElementById('viewer-name').value = btn.dataset.name;
          document.getElementById('modal-title').textContent = 'تعديل بيانات المشاهد';
          showModal();
        });
      });

      // Toggle active handlers
      content.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.id;
          const isActive = btn.dataset.active === '1';
          try {
            await authRequest(`/auth/viewers/${id}`, {
              method: 'PUT',
              body: { is_active: isActive ? 0 : 1 }
            });
            showToast(isActive ? 'تم تعطيل المشاهد' : 'تم تفعيل المشاهد', 'success');
            loadViewers();
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      });

      // Delete handlers
      content.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm('هل تريد حذف هذا المشاهد نهائياً؟')) return;
          try {
            await authRequest(`/auth/viewers/${btn.dataset.id}`, { method: 'DELETE' });
            showToast('تم حذف المشاهد', 'success');
            loadViewers();
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      });

    } catch (err) {
      content.innerHTML = `<div style="text-align:center; padding:40px; color:#ef4444;">❌ ${err.message}</div>`;
    }
  }

  function showModal() {
    const modal = document.getElementById('viewer-modal');
    modal.style.display = 'flex';
  }

  function hideModal() {
    const modal = document.getElementById('viewer-modal');
    modal.style.display = 'none';
    editingId = null;
    document.getElementById('viewer-phone').value = '';
    document.getElementById('viewer-name').value = '';
    document.getElementById('modal-title').textContent = 'إضافة مشاهد جديد';
  }

  // Add button
  document.getElementById('add-viewer-btn').addEventListener('click', () => {
    editingId = null;
    document.getElementById('modal-title').textContent = 'إضافة مشاهد جديد';
    showModal();
  });

  // Cancel button
  document.getElementById('cancel-viewer-btn').addEventListener('click', hideModal);

  // Save button
  document.getElementById('save-viewer-btn').addEventListener('click', async () => {
    const phone = document.getElementById('viewer-phone').value.trim();
    const name = document.getElementById('viewer-name').value.trim();

    if (!phone) {
      showToast('رقم الجوال مطلوب', 'error');
      return;
    }

    try {
      if (editingId) {
        await authRequest(`/auth/viewers/${editingId}`, {
          method: 'PUT',
          body: { phone, name }
        });
        showToast('تم تحديث بيانات المشاهد', 'success');
      } else {
        await authRequest('/auth/viewers', {
          method: 'POST',
          body: { phone, name }
        });
        showToast('تم إضافة المشاهد بنجاح', 'success');
      }
      hideModal();
      loadViewers();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Close modal on backdrop click
  document.getElementById('viewer-modal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) hideModal();
  });

  // Load
  await loadViewers();
}
