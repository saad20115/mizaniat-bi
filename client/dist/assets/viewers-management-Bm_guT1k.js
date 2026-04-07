import{a as r}from"./presentation-BF0VFtRu.js";const m="/api";async function l(c,i={}){const n={headers:{"Content-Type":"application/json",Authorization:`Bearer ${localStorage.getItem("mizaniat_admin_token")}`},...i};n.body&&typeof n.body=="object"&&(n.body=JSON.stringify(n.body));const a=await fetch(`${m}${c}`,n);if(!a.ok){const t=await a.json().catch(()=>({error:a.statusText}));throw new Error(t.error||`HTTP ${a.status}`)}return a.json()}async function u(c){c.innerHTML=`
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
  `;let i=null;async function o(){const t=document.getElementById("viewers-content");try{const d=await l("/auth/viewers");if(!d.length){t.innerHTML=`
          <div style="text-align:center; padding:40px; color:var(--text-muted);">
            <div style="font-size:2.5rem; margin-bottom:12px;">📱</div>
            <p style="font-size:0.95rem;">لا توجد أرقام مسجلة بعد</p>
            <p style="font-size:0.85rem; margin-top:8px;">اضغط "إضافة رقم جديد" لتسجيل أول مشاهد</p>
          </div>
        `;return}t.innerHTML=`
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
              ${d.map((e,s)=>`
                <tr>
                  <td style="color:rgba(255,255,255,0.4);">${s+1}</td>
                  <td style="font-family:'Inter',sans-serif; font-weight:700; direction:ltr; text-align:left;">${e.phone}</td>
                  <td>${e.name||'<span style="color:rgba(255,255,255,0.3);">—</span>'}</td>
                  <td>
                    <span style="padding:4px 12px; border-radius:20px; font-size:0.8rem; font-weight:700;
                      background:${e.is_active?"rgba(16,185,129,0.15)":"rgba(239,68,68,0.15)"};
                      color:${e.is_active?"#10b981":"#ef4444"};
                      border:1px solid ${e.is_active?"rgba(16,185,129,0.3)":"rgba(239,68,68,0.3)"};">
                      ${e.is_active?"✅ نشط":"❌ معطل"}
                    </span>
                  </td>
                  <td style="font-size:0.85rem; color:rgba(255,255,255,0.5); font-family:'Inter',sans-serif;">
                    ${e.created_at?new Date(e.created_at).toLocaleDateString("ar-SA"):"—"}
                  </td>
                  <td>
                    <div style="display:flex; gap:6px;">
                      <button class="btn btn-sm edit-btn" data-id="${e.id}" data-phone="${e.phone}" data-name="${e.name||""}"
                        style="padding:6px 12px; font-size:0.8rem; background:rgba(59,130,246,0.15); border:1px solid rgba(59,130,246,0.3); color:#60a5fa; border-radius:8px; cursor:pointer;">
                        ✏️ تعديل
                      </button>
                      <button class="btn btn-sm toggle-btn" data-id="${e.id}" data-active="${e.is_active}"
                        style="padding:6px 12px; font-size:0.8rem; background:${e.is_active?"rgba(239,68,68,0.1)":"rgba(16,185,129,0.1)"}; border:1px solid ${e.is_active?"rgba(239,68,68,0.3)":"rgba(16,185,129,0.3)"}; color:${e.is_active?"#ef4444":"#10b981"}; border-radius:8px; cursor:pointer;">
                        ${e.is_active?"🚫":"✅"}
                      </button>
                      <button class="btn btn-sm delete-btn" data-id="${e.id}"
                        style="padding:6px 12px; font-size:0.8rem; background:rgba(239,68,68,0.1); border:1px solid rgba(239,68,68,0.3); color:#ef4444; border-radius:8px; cursor:pointer;">
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `,t.querySelectorAll(".edit-btn").forEach(e=>{e.addEventListener("click",()=>{i=parseInt(e.dataset.id),document.getElementById("viewer-phone").value=e.dataset.phone,document.getElementById("viewer-name").value=e.dataset.name,document.getElementById("modal-title").textContent="تعديل بيانات المشاهد",n()})}),t.querySelectorAll(".toggle-btn").forEach(e=>{e.addEventListener("click",async()=>{const s=e.dataset.id,p=e.dataset.active==="1";try{await l(`/auth/viewers/${s}`,{method:"PUT",body:{is_active:p?0:1}}),r(p?"تم تعطيل المشاهد":"تم تفعيل المشاهد","success"),o()}catch(b){r(b.message,"error")}})}),t.querySelectorAll(".delete-btn").forEach(e=>{e.addEventListener("click",async()=>{if(confirm("هل تريد حذف هذا المشاهد نهائياً؟"))try{await l(`/auth/viewers/${e.dataset.id}`,{method:"DELETE"}),r("تم حذف المشاهد","success"),o()}catch(s){r(s.message,"error")}})})}catch(d){t.innerHTML=`<div style="text-align:center; padding:40px; color:#ef4444;">❌ ${d.message}</div>`}}function n(){const t=document.getElementById("viewer-modal");t.style.display="flex"}function a(){const t=document.getElementById("viewer-modal");t.style.display="none",i=null,document.getElementById("viewer-phone").value="",document.getElementById("viewer-name").value="",document.getElementById("modal-title").textContent="إضافة مشاهد جديد"}document.getElementById("add-viewer-btn").addEventListener("click",()=>{i=null,document.getElementById("modal-title").textContent="إضافة مشاهد جديد",n()}),document.getElementById("cancel-viewer-btn").addEventListener("click",a),document.getElementById("save-viewer-btn").addEventListener("click",async()=>{const t=document.getElementById("viewer-phone").value.trim(),d=document.getElementById("viewer-name").value.trim();if(!t){r("رقم الجوال مطلوب","error");return}try{i?(await l(`/auth/viewers/${i}`,{method:"PUT",body:{phone:t,name:d}}),r("تم تحديث بيانات المشاهد","success")):(await l("/auth/viewers",{method:"POST",body:{phone:t,name:d}}),r("تم إضافة المشاهد بنجاح","success")),a(),o()}catch(e){r(e.message,"error")}}),document.getElementById("viewer-modal").addEventListener("click",t=>{t.target===t.currentTarget&&a()}),await o()}export{u as renderViewersManagement};
