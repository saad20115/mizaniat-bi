import{b as p,f as o}from"./presentation-p9mWjcX8.js";async function y(s){s.innerHTML=`
    <div class="page-header">
      <div>
        <h1 class="page-title">💸 تقرير المصروفات المخصصة</h1>
        <p class="page-subtitle">نظرة عامة على مصروفات المجلس التنسيقي ومشاريع الحج</p>
      </div>
      <div style="display: flex; gap: var(--space-md);">
        <button class="btn btn-secondary" onclick="window.open('/api/external/special-expenses', '_blank')">🔗 عرض كـ JSON (API)</button>
        <button class="btn btn-primary" id="btn-refresh">🔄 تحديث البيانات</button>
      </div>
    </div>
    
    <div id="sp-loading" style="padding: 60px; text-align: center;">
      <div class="spinner"></div>
      <p style="margin-top:20px;color:var(--text-muted);">جاري استدعاء البيانات...</p>
    </div>

    <div id="sp-content" style="display:none; animation: fadeIn 0.4s ease-out;">
      <div class="kpi-grid" style="grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); margin-bottom: var(--space-xl);">
        
        <div class="kpi-card" style="border-top: 3px solid var(--accent-purple);">
          <div class="kpi-title" style="color:var(--accent-purple); font-size:1.1rem; font-weight:bold;">المجلس التنسيقي</div>
          <div class="kpi-value" id="val-council">0</div>
          <div class="kpi-subtitle" style="font-size:0.8rem;">ابتداءً من 2025-08-01</div>
        </div>

        <div class="kpi-card" style="border-top: 3px solid var(--accent-blue);">
          <div class="kpi-title" style="color:var(--accent-blue); font-size:1.1rem; font-weight:bold;">مشاريع الحج</div>
          <div class="kpi-value" id="val-hajj">0</div>
          <div class="kpi-subtitle" style="font-size:0.8rem;">ابتداءً من 2025-10-01</div>
        </div>

        <div class="kpi-card" style="border-top: 3px solid var(--accent-emerald);">
          <div class="kpi-title" style="color:var(--accent-emerald); font-size:1.1rem; font-weight:bold;">إجمالي المصروفات للمشروعين</div>
          <div class="kpi-value" id="val-total">0</div>
          <div class="kpi-subtitle" id="val-rows" style="font-size:0.8rem;">إجمالي 0 قيد مالي</div>
        </div>

      </div>

      <div class="card" style="padding:0; overflow:hidden;">
        <div style="padding: var(--space-md) var(--space-xl); border-bottom:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center;">
          <h2 style="font-size:1.1rem; color:var(--text-white);">تفاصيل القيود المحاسبية</h2>
          
          <div class="filter-group" style="display:flex; gap:8px;">
            <select id="sp-filter-category" class="form-input" style="width:200px;">
              <option value="all">الكل</option>
              <option value="المجلس التنسيقي">المجلس التنسيقي فقط</option>
              <option value="مشاريع الحج">مشاريع الحج فقط</option>
            </select>
          </div>
        </div>
        
        <div style="overflow-x:auto; max-height: 500px;">
          <table class="data-table" style="width:100%;">
            <thead style="position: sticky; top: 0; background: var(--bg-surface); box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
              <tr>
                <th style="text-align:right;">التاريخ</th>
                <th style="text-align:right;">الشركة</th>
                <th style="text-align:right;">الفئة</th>
                <th style="text-align:right;">مركز التكلفة</th>
                <th style="text-align:right;">الحساب</th>
                <th style="text-align:left;">المبلغ</th>
              </tr>
            </thead>
            <tbody id="sp-table-body">
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;let e=null;async function n(){const l=document.getElementById("sp-loading"),i=document.getElementById("sp-content");l.style.display="block",i.style.display="none";try{e=await p.getSpecialExpenses(),document.getElementById("val-council").textContent=o(e.summary.totalCouncil),document.getElementById("val-hajj").textContent=o(e.summary.totalHajj),document.getElementById("val-total").textContent=o(e.summary.totalExpenses),document.getElementById("val-rows").textContent=`إجمالي ${e.summary.totalRows} قيد مالي`,d(),i.style.display="block"}catch(a){s.innerHTML=`<div class="card" style="color:var(--accent-red); padding:30px; text-align:center;">
        <h3>⚠️ حدث خطأ أثناء الاتصال بالـ API</h3>
        <p>${a.message}</p>
        <button class="btn btn-secondary" onclick="location.reload()" style="margin-top:15px;">إعادة المحاولة</button>
      </div>`}finally{l.style.display="none"}}function d(){const l=document.getElementById("sp-table-body"),i=document.getElementById("sp-filter-category").value;let a=e.data;if(i!=="all"&&(a=a.filter(t=>t.projectCategory===i)),a.length===0){l.innerHTML='<tr><td colspan="6" style="text-align:center; padding:30px; color:var(--text-muted);">لا توجد حركات مطابقة</td></tr>';return}l.innerHTML=a.map(t=>{const r=t.projectCategory==="المجلس التنسيقي"?"var(--accent-purple)":"var(--accent-blue)",c=t.projectCategory==="المجلس التنسيقي"?"rgba(139,92,246,0.15)":"rgba(59,130,246,0.15)";return`
      <tr>
        <td>${t.date||"-"}</td>
        <td style="color:var(--text-gray);">${t.companyName||"-"}</td>
        <td>
          <span style="background:${c}; color:${r}; padding:2px 8px; border-radius:4px; font-size:0.85rem;">
            ${t.projectCategory}
          </span>
        </td>
        <td>${t.costCenter}</td>
        <td><div style="max-width:200px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${t.accountName}">${t.accountCode} - ${t.accountName}</div></td>
        <td style="text-align:left; font-weight:w600; color:${t.expenses<0?"var(--accent-red)":"var(--accent-emerald)"}; font-family:var(--font-mono);">
          ${o(t.expenses)}
        </td>
      </tr>
    `}).join("")}s.querySelector("#btn-refresh").addEventListener("click",n),s.querySelector("#sp-filter-category").addEventListener("change",d),n()}export{y as renderSpecialExpenses};
