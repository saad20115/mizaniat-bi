import{s as t,b as v}from"./presentation-Dc4PgcXr.js";function y(s,a){const p=t.get("companies"),r=t.get("selectedCompanyIds"),d=t.get("dateFrom"),f=t.get("dateTo"),o=t.get("filterOptions");s.innerHTML=`
    <div class="filter-group" style="min-width:100%;">
      <span class="filter-label">الشركات</span>
      <div class="company-chips">
        <div class="company-chip ${r.length===0?"active":""}" data-company="all">
          <span class="chip-dot" style="background: var(--accent-purple)"></span>
          الكل
        </div>
        ${p.map(e=>`
          <div class="company-chip ${r.includes(e.id)?"active":""}" data-company="${e.id}">
            <span class="chip-dot" style="background: ${e.color||"#3b82f6"}"></span>
            ${e.name}
          </div>
        `).join("")}
      </div>
    </div>
    
    <div class="filter-group">
      <span class="filter-label">من تاريخ</span>
      <input type="date" class="filter-input" id="filter-date-from" value="${d}" />
    </div>
    
    <div class="filter-group">
      <span class="filter-label">إلى تاريخ</span>
      <input type="date" class="filter-input" id="filter-date-to" value="${f}" />
    </div>
    
    <div class="filter-group">
      <span class="filter-label">السنة المالية</span>
      <select class="filter-select" id="filter-fiscal-year">
        <option value="">الكل</option>
        ${(o.fiscalYears||[]).map(e=>`
          <option value="${e}" ${t.get("fiscalYear")===e?"selected":""}>${e}</option>
        `).join("")}
      </select>
    </div>

    <div class="filter-group">
      <span class="filter-label">مركز التكلفة</span>
      <select class="filter-select" id="filter-cost-center">
        <option value="">الكل</option>
        ${(o.costCenters||[]).map(e=>`
          <option value="${e}" ${t.get("costCenter")===e?"selected":""}>${e}</option>
        `).join("")}
      </select>
    </div>

    <div class="filter-group">
      <span class="filter-label">نوع الحساب</span>
      <select class="filter-select" id="filter-account-type">
        <option value="">الكل</option>
        ${(o.accountTypes||[]).map(e=>`
          <option value="${e}" ${t.get("accountType")===e?"selected":""}>${e}</option>
        `).join("")}
      </select>
    </div>

    <div class="filter-group" style="align-self:flex-end;">
      <button class="btn btn-primary" id="btn-apply-filters">تطبيق الفلاتر</button>
    </div>
  `,s.querySelectorAll(".company-chip").forEach(e=>{e.addEventListener("click",()=>{const l=e.dataset.company;let i;if(l==="all")i=[];else{const c=parseInt(l),n=[...r];n.includes(c)?i=n.filter(u=>u!==c):i=[...n,c]}t.set("selectedCompanyIds",i),y(s,a),a&&a()})}),s.querySelector("#filter-date-from").addEventListener("change",e=>{t.set("dateFrom",e.target.value)}),s.querySelector("#filter-date-to").addEventListener("change",e=>{t.set("dateTo",e.target.value)}),s.querySelector("#filter-cost-center").addEventListener("change",e=>{t.set("costCenter",e.target.value)}),s.querySelector("#filter-account-type").addEventListener("change",e=>{t.set("accountType",e.target.value)}),s.querySelector("#filter-fiscal-year").addEventListener("change",e=>{const l=e.target.value;t.set("fiscalYear",l),l&&(t.set("dateFrom",`${l}-01-01`),t.set("dateTo",`${l}-12-31`),s.querySelector("#filter-date-from").value=`${l}-01-01`,s.querySelector("#filter-date-to").value=`${l}-12-31`)}),s.querySelector("#btn-apply-filters").addEventListener("click",()=>{a&&a()})}async function g(){try{const s=t.getFilterParams(),a=await v.getFilterOptions(s);t.set("filterOptions",a)}catch(s){console.error("Failed to load filter options:",s)}}export{g as loadFilterOptions,y as renderFilters};
