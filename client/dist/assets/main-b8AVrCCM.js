const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/special-expenses-iWwZHXEx.js","assets/presentation-CT6XNb48.js","assets/presentation-CaWSzoDD.css","assets/viewers-management-BW9dk85x.js"])))=>i.map(i=>d[i]);
import{s as S,a as y,b as f,f as v,g as Ue,c as ye,d as ve,h as rt,E as ot,_ as Xe,r as wt}from"./presentation-CT6XNb48.js";import{renderFilters as fe,loadFilterOptions as kt}from"./filters-C4Z6nVT4.js";const Ye=[{id:"dashboard",icon:"📊",label:"لوحة التحكم",section:"رئيسي"},{id:"income-statement",icon:"📈",label:"قائمة الدخل",section:"التقارير المالية"},{id:"balance-sheet",icon:"⚖️",label:"الميزانية العمومية",section:"التقارير المالية"},{id:"cash-flow",icon:"💰",label:"التدفقات النقدية",section:"التقارير المالية"},{id:"special-expenses",icon:"💸",label:"مصروفات مخصصة",section:"التقارير المالية"},{id:"trial-balance",icon:"📝",label:"ميزان المراجعة",section:"التقارير المالية"},{id:"detailed-trial-balance",icon:"🔍",label:"ميزان تفصيلي",section:"التقارير المالية"},{id:"account-statement",icon:"📄",label:"كشف حساب",section:"التقارير المالية"},{id:"guarantees",icon:"🏦",label:"الضمانات البنكية",section:"التقارير المالية"},{id:"hajj-budget",icon:"🕋",label:"موازنات المشاريع",section:"التقارير المالية",url:"https://budget.jalbait.com"},{id:"pivot",icon:"🔄",label:"الجداول المحورية",section:"التحليل"},{id:"presentation",icon:"🎬",label:"عرض تقديمي",section:"التحليل"},{id:"tax-builder",icon:"🧾",label:"مصمم التقرير الضريبي",section:"التحليل"},{id:"journal-items",icon:"📋",label:"القيود المحاسبية",section:"التحليل"},{id:"data-preview",icon:"🗂️",label:"معاينة بيانات API",section:"التحليل"},{id:"sales-data-preview",icon:"🛒",label:"معاينة المبيعات API",section:"التحليل"},{id:"analytic-accounts",icon:"📂",label:"الحسابات التحليلية",section:"الإعدادات"},{id:"mapping",icon:"🔗",label:"توحيد الحسابات",section:"الإعدادات"},{id:"journal-mapping",icon:"🎯",label:"توحيد اليوميات",section:"الإعدادات"},{id:"viewers-management",icon:"👥",label:"إدارة المشاهدين",section:"الإعدادات"},{id:"settings",icon:"⚙️",label:"إعدادات النظام",section:"الإعدادات"},{id:"sales-settings",icon:"🛍️",label:"إعدادات نظام المبيعات",section:"الإعدادات"},{id:"api-manager",icon:"🔌",label:"إدارة الـ APIs",section:"الإعدادات"}];function nt(){const e=document.getElementById("sidebar-nav"),a=document.getElementById("sidebar"),t=document.getElementById("main-content"),s=document.getElementById("sidebar-toggle"),r=S.get("currentPage"),n=window.isViewerMode&&window.isViewerMode();S.get("sidebarCollapsed")?(a.classList.add("collapsed"),t.classList.add("sidebar-collapsed"),s&&(s.querySelector("span").textContent="►")):(a.classList.remove("collapsed"),t.classList.remove("sidebar-collapsed"),s&&(s.querySelector("span").textContent="◄"));const o=n?Ye.filter(p=>p.id==="presentation"||p.id==="hajj-budget"):Ye;let l="",d="";for(const p of o)p.section!==d&&(d=p.section,l+=`<div class="nav-section-title">${d}</div>`),l+=`
      <div class="nav-item ${r===p.id?"active":""}" data-page="${p.id}">
        <span class="nav-item-icon">${p.icon}</span>
        <span class="nav-item-label">${p.label}</span>
      </div>
    `;const i=JSON.parse(localStorage.getItem("mizaniat_admin_info")||"{}"),c=JSON.parse(localStorage.getItem("mizaniat_viewer_info")||"{}"),u=n?"👁️ "+(c.name||i.name||"مشاهد"):i.name||i.email||"مدير";l+=`
    <div style="border-top:1px solid rgba(255,255,255,0.08); margin-top:16px; padding-top:12px;">
      <div style="padding:8px 16px; font-size:0.8rem; color:rgba(255,255,255,0.4); display:flex; align-items:center; gap:8px;">
        <span>👤</span>
        <span>${u}</span>
      </div>
      <div class="nav-item" id="logout-btn" style="color:#ef4444;">
        <span class="nav-item-icon">🚪</span>
        <span class="nav-item-label">تسجيل الخروج</span>
      </div>
    </div>
  `,e.innerHTML=l,e.querySelectorAll(".nav-item[data-page]").forEach(p=>{p.addEventListener("click",()=>{const b=p.dataset.page,h=o.find(x=>x.id===b);h&&h.url?window.open(h.url,"_blank"):S.set("currentPage",b)})});const m=document.getElementById("logout-btn");m&&m.addEventListener("click",()=>{confirm("هل تريد تسجيل الخروج؟")&&window.mizaniatLogout()}),s&&(s.onclick=()=>{a.classList.toggle("collapsed"),t.classList.toggle("sidebar-collapsed"),S.set("sidebarCollapsed",a.classList.contains("collapsed")),s.querySelector("span").textContent=a.classList.contains("collapsed")?"►":"◄"})}async function _t(e){e.innerHTML=`
    <style>
      /* Dashboard-specific enhanced styles */
      .dash-donuts-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-lg);
        margin-bottom: var(--space-lg);
      }
      .dash-donut-card {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        padding: var(--space-xl) var(--space-lg);
        display: flex;
        flex-direction: column;
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .dash-donut-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      }
      .dash-donut-title {
        font-size: 1rem;
        font-weight: 700;
        color: rgba(255,255,255,0.65);
        margin-bottom: var(--space-lg);
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .dash-donut-content {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 32px;
        flex: 1;
      }
      .dash-donut-ring {
        width: 200px;
        height: 200px;
        position: relative;
        flex-shrink: 0;
      }
      .dash-donut-center {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
      }
      .dash-donut-center-label {
        font-size: 0.8rem;
        color: rgba(255,255,255,0.4);
        font-weight: 600;
      }
      .dash-donut-center-value {
        font-size: 1.1rem;
        font-weight: 800;
        color: var(--text-white);
        font-family: var(--font-en);
        margin-top: 2px;
      }
      .dash-legend {
        display: flex;
        flex-direction: column;
        gap: 10px;
        flex: 1;
        min-width: 0;
      }
      .dash-legend-item {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 0.88rem;
        color: rgba(255,255,255,0.75);
        padding: 6px 0;
        border-bottom: 1px solid rgba(255,255,255,0.04);
      }
      .dash-legend-item:last-child { border-bottom: none; }
      .dash-legend-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        flex-shrink: 0;
      }
      .dash-legend-name {
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .dash-legend-val {
        font-family: var(--font-en);
        font-weight: 700;
        font-size: 0.9rem;
        white-space: nowrap;
        direction: ltr;
      }
      .dash-legend-pct {
        font-family: var(--font-en);
        font-size: 0.75rem;
        color: rgba(255,255,255,0.35);
        min-width: 36px;
        text-align: left;
      }

      /* Monthly bars section */
      .dash-monthly-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: var(--space-lg);
        margin-bottom: var(--space-lg);
      }
      .dash-bar-card {
        background: var(--bg-card);
        border: 1px solid var(--border-color);
        border-radius: var(--radius-lg);
        padding: var(--space-lg);
        transition: transform 0.2s, box-shadow 0.2s;
      }
      .dash-bar-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
      }
      .dash-bar-title {
        font-size: 1rem;
        font-weight: 700;
        color: rgba(255,255,255,0.65);
        margin-bottom: var(--space-md);
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .dash-bar-total {
        margin-right: auto;
        font-family: var(--font-en);
        font-weight: 800;
        font-size: 0.95rem;
      }
      .dash-bars {
        display: flex;
        align-items: flex-end;
        gap: 6px;
        height: 260px;
        padding-top: 8px;
      }
      .dash-bar-item {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        height: 100%;
        justify-content: flex-end;
      }
      .dash-bar-val {
        font-size: 0.65rem;
        color: rgba(255,255,255,0.55);
        font-family: var(--font-en);
        font-weight: 600;
        white-space: nowrap;
        transform: rotate(-35deg);
        transform-origin: center bottom;
      }
      .dash-bar {
        width: 100%;
        max-width: 48px;
        border-radius: 5px 5px 0 0;
        transition: height 0.6s ease, opacity 0.2s;
        min-height: 3px;
        cursor: default;
      }
      .dash-bar:hover { opacity: 0.8; }
      .dash-bar-lbl {
        font-size: 0.7rem;
        color: rgba(255,255,255,0.4);
        text-align: center;
        font-weight: 600;
        margin-top: 2px;
      }

      @media(max-width:900px) {
        .dash-donuts-row, .dash-monthly-row { grid-template-columns: 1fr; }
      }
    </style>
    <div class="page-header">
      <div>
        <h1 class="page-title">لوحة التحكم</h1>
        <p class="page-subtitle">نظرة عامة على الأداء المالي المجمع</p>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-secondary" id="btn-sync">🔄 مزامنة البيانات</button>
      </div>
    </div>
    
    <div class="filters-bar" id="dashboard-filters"></div>
    
    <div class="kpi-grid" id="kpi-grid">
      ${Array(7).fill('<div class="kpi-card"><div class="skeleton" style="height:80px;"></div></div>').join("")}
    </div>
    
    <div id="dash-charts">
      <div class="dash-donuts-row">
        <div class="dash-donut-card"><div class="skeleton" style="height:240px;"></div></div>
        <div class="dash-donut-card"><div class="skeleton" style="height:240px;"></div></div>
      </div>
      <div class="dash-monthly-row">
        <div class="dash-bar-card"><div class="skeleton" style="height:280px;"></div></div>
        <div class="dash-bar-card"><div class="skeleton" style="height:280px;"></div></div>
      </div>
    </div>
  `;const a=e.querySelector("#dashboard-filters");fe(a,()=>qe(e)),await qe(e),e.querySelector("#btn-sync").addEventListener("click",async()=>{try{y("جاري مزامنة البيانات...","info");const t=await f.syncAll();y("تمت المزامنة بنجاح","success"),await qe(e)}catch(t){y("فشلت المزامنة: "+t.message,"error")}})}async function qe(e){try{const a=S.getFilterParams(),t=await f.getDashboard(a);St(e.querySelector("#kpi-grid"),t),zt(e.querySelector("#dash-charts"),t)}catch(a){console.error("Dashboard error:",a),y("خطأ في تحميل البيانات","error")}}function St(e,a){const t=a.totalRevenue>0?(a.netProfit/a.totalRevenue*100).toFixed(1):"0.0";e.innerHTML=`
    <div class="kpi-card blue fade-in">
      <div class="kpi-icon blue">📈</div>
      <div class="kpi-label">إجمالي الإيرادات</div>
      <div class="kpi-value" style="font-size:1.2rem;">${v(a.totalRevenue,2)}</div>
      <div class="kpi-change positive">SAR</div>
    </div>
    
    <div class="kpi-card red fade-in" style="animation-delay:0.05s">
      <div class="kpi-icon red">📉</div>
      <div class="kpi-label">إجمالي المصروفات</div>
      <div class="kpi-value" style="font-size:1.2rem;">${v(a.totalExpenses,2)}</div>
      <div class="kpi-change negative">SAR</div>
    </div>
    
    <div class="kpi-card emerald fade-in" style="animation-delay:0.1s">
      <div class="kpi-icon emerald">💵</div>
      <div class="kpi-label">صافي الربح</div>
      <div class="kpi-value" style="font-size:1.2rem;">${v(a.netProfit,2)}</div>
      <div class="kpi-change ${a.netProfit>=0?"positive":"negative"}">
        ${a.netProfit>=0?"↑":"↓"} ${t}%
      </div>
    </div>
    
    <div class="kpi-card purple fade-in" style="animation-delay:0.15s">
      <div class="kpi-icon purple">🏢</div>
      <div class="kpi-label">إجمالي الأصول</div>
      <div class="kpi-value" style="font-size:1.2rem;">${v(a.totalAssets,2)}</div>
      <div class="kpi-change" style="color:var(--text-muted);">SAR</div>
    </div>
    
    <div class="kpi-card amber fade-in" style="animation-delay:0.2s">
      <div class="kpi-icon amber">📊</div>
      <div class="kpi-label">إجمالي الالتزامات</div>
      <div class="kpi-value" style="font-size:1.2rem;">${v(a.totalLiabilities,2)}</div>
      <div class="kpi-change" style="color:var(--text-muted);">SAR</div>
    </div>
    
    <div class="kpi-card cyan fade-in" style="animation-delay:0.25s">
      <div class="kpi-icon cyan">💵</div>
      <div class="kpi-label">النقدية المتاحة</div>
      <div class="kpi-value" style="font-size:1.2rem;">${v(a.cashPosition,2)}</div>
      <div class="kpi-change" style="color:var(--text-muted);">SAR</div>
    </div>
    
    <div class="kpi-card teal fade-in" style="animation-delay:0.3s">
      <div class="kpi-icon teal">🏦</div>
      <div class="kpi-label">الضمانات البنكية</div>
      <div class="kpi-value" style="font-size:1.2rem;">${v(a.guarantees||0,2)}</div>
      <div class="kpi-change" style="color:var(--text-muted);">أصول محتجزة</div>
    </div>
  `}function zt(e,a){const t=a.revenueByPeriod||[],s=a.expensesByPeriod||[],r=a.revenueByCompany||[],n=a.expensesByCompany||[],o=[...new Set([...t.map(g=>g.period),...s.map(g=>g.period)])].sort(),d=[...new Set(o.map(g=>g?g.split("-")[0]:""))].sort().pop()||"",i=d?t.filter(g=>g.period&&g.period.startsWith(d)):t,c=d?s.filter(g=>g.period&&g.period.startsWith(d)):s,u=Math.max(...i.map(g=>g.total),1),m=Math.max(...c.map(g=>g.total),1),p=["#3b82f6","#10b981","#06b6d4","#8b5cf6","#ec4899","#14b8a6"],b=["#ef4444","#f59e0b","#ec4899","#f97316","#e11d48","#dc2626"],h=r.reduce((g,w)=>g+w.total,0),x=n.reduce((g,w)=>g+w.total,0),z=i.reduce((g,w)=>g+w.total,0),$=c.reduce((g,w)=>g+w.total,0);e.innerHTML=`
    <!-- Donut Charts Row -->
    <div class="dash-donuts-row">
      <!-- Expenses Donut -->
      <div class="dash-donut-card fade-in">
        <div class="dash-donut-title">🍩 المصروفات حسب الشركة</div>
        <div class="dash-donut-content">
          <div class="dash-donut-ring">
            <svg viewBox="0 0 200 200">${We(n,b,200)}</svg>
            <div class="dash-donut-center">
              <div class="dash-donut-center-label">الإجمالي</div>
              <div class="dash-donut-center-value" style="color:#ef4444;">${Y(x)}</div>
            </div>
          </div>
          <div class="dash-legend">
            ${n.map((g,w)=>{const _=x>0?(g.total/x*100).toFixed(1):"0.0";return`
              <div class="dash-legend-item">
                <span class="dash-legend-dot" style="background:${b[w%b.length]}"></span>
                <span class="dash-legend-name">${g.company_name}</span>
                <span class="dash-legend-pct">${_}%</span>
                <span class="dash-legend-val" style="color:${b[w%b.length]}">${Y(g.total)}</span>
              </div>`}).join("")}
          </div>
        </div>
      </div>

      <!-- Revenue Donut -->
      <div class="dash-donut-card fade-in" style="animation-delay:0.08s">
        <div class="dash-donut-title">🍩 الإيرادات حسب الشركة</div>
        <div class="dash-donut-content">
          <div class="dash-donut-ring">
            <svg viewBox="0 0 200 200">${We(r,p,200)}</svg>
            <div class="dash-donut-center">
              <div class="dash-donut-center-label">الإجمالي</div>
              <div class="dash-donut-center-value" style="color:#10b981;">${Y(h)}</div>
            </div>
          </div>
          <div class="dash-legend">
            ${r.map((g,w)=>{const _=h>0?(g.total/h*100).toFixed(1):"0.0";return`
              <div class="dash-legend-item">
                <span class="dash-legend-dot" style="background:${g.color||p[w%p.length]}"></span>
                <span class="dash-legend-name">${g.company_name}</span>
                <span class="dash-legend-pct">${_}%</span>
                <span class="dash-legend-val" style="color:${g.color||p[w%p.length]}">${Y(g.total)}</span>
              </div>`}).join("")}
          </div>
        </div>
      </div>
    </div>

    <!-- Monthly Bars Row -->
    <div class="dash-monthly-row">
      <!-- Monthly Revenue -->
      <div class="dash-bar-card fade-in" style="animation-delay:0.12s">
        <div class="dash-bar-title">
          📈 الإيرادات الشهرية
          ${d?`<span style="font-size:0.8rem;color:rgba(255,255,255,0.3);font-family:var(--font-en);">${d}</span>`:""}
          <span class="dash-bar-total" style="color:#10b981;">${Y(z)}</span>
        </div>
        <div class="dash-bars">
          ${i.map(g=>{const w=g.total/u*100,_=g.period?g.period.split("-")[1]:"";return`
            <div class="dash-bar-item">
              <div class="dash-bar-val">${Y(g.total)}</div>
              <div class="dash-bar" style="height:${Math.max(w,2)}%;background:linear-gradient(to top, #3b82f6, #60a5fa);" title="${v(g.total,2)} SAR"></div>
              <div class="dash-bar-lbl">${Ue(_)}</div>
            </div>`}).join("")}
        </div>
      </div>

      <!-- Monthly Expenses -->
      <div class="dash-bar-card fade-in" style="animation-delay:0.16s">
        <div class="dash-bar-title">
          📉 المصروفات الشهرية
          ${d?`<span style="font-size:0.8rem;color:rgba(255,255,255,0.3);font-family:var(--font-en);">${d}</span>`:""}
          <span class="dash-bar-total" style="color:#ef4444;">${Y($)}</span>
        </div>
        <div class="dash-bars">
          ${c.map(g=>{const w=g.total/m*100,_=g.period?g.period.split("-")[1]:"";return`
            <div class="dash-bar-item">
              <div class="dash-bar-val">${Y(g.total)}</div>
              <div class="dash-bar" style="height:${Math.max(w,2)}%;background:linear-gradient(to top, #ef4444, #f87171);" title="${v(g.total,2)} SAR"></div>
              <div class="dash-bar-lbl">${Ue(_)}</div>
            </div>`}).join("")}
        </div>
      </div>
    </div>
  `}function We(e,a,t){const s=e.reduce((c,u)=>c+Math.abs(u.total),0),r=t/2,n=t/2,o=t*.35,l=t*.12;if(s===0)return`<circle cx="${r}" cy="${n}" r="${o}" fill="none" stroke="rgba(99,130,255,0.08)" stroke-width="${l}"/>`;let d=0;const i=2*Math.PI*o;return e.map((c,u)=>{const m=Math.abs(c.total)/s,p=m*i,b=e.length>1?2:0,h=-d*i;return d+=m,`<circle cx="${r}" cy="${n}" r="${o}" fill="none" 
      stroke="${a[u%a.length]}" 
      stroke-width="${l}" 
      stroke-dasharray="${Math.max(p-b,0)} ${i-Math.max(p-b,0)}" 
      stroke-dashoffset="${h}"
      transform="rotate(-90 ${r} ${n})"
      stroke-linecap="round"
      style="transition: stroke-dasharray 0.6s ease;"/>`}).join("")}function Y(e){const a=Math.abs(e);return a>=1e6?(e/1e6).toFixed(1)+"M":a>=1e3?(e/1e3).toFixed(0)+"K":v(e,0)}async function Et(e){e.innerHTML=`
    <div class="page-header">
      <div>
        <h1 class="page-title">قائمة الدخل المجمعة</h1>
        <p class="page-subtitle">Consolidated Income Statement</p>
      </div>
      <div style="display:flex;gap:8px;">
        <label style="display:flex;align-items:center;gap:6px;font-size:0.8rem;color:var(--text-secondary);">
          <input type="checkbox" id="chk-eliminations" /> استبعاد المعاملات المتبادلة
        </label>
      </div>
    </div>
    
    <div class="filters-bar" id="is-filters"></div>
    <div id="is-content"><div class="skeleton" style="height:400px;border-radius:var(--radius-lg);"></div></div>
  `;const a=e.querySelector("#is-filters");fe(a,()=>Le(e)),e.querySelector("#chk-eliminations").addEventListener("change",()=>Le(e)),await Le(e)}async function Le(e){try{const a=S.getFilterParams();a.useEliminations=e.querySelector("#chk-eliminations").checked;const t=await f.getIncomeStatement(a);qt(e.querySelector("#is-content"),t)}catch{y("خطأ في تحميل قائمة الدخل","error")}}function qt(e,a){const t=S.get("companies"),s=S.get("selectedCompanyIds"),r=s.length>0?t.filter(o=>s.includes(o.id)):t,n=r.length>1;e.innerHTML=`
    <div class="data-table-wrapper fade-in">
      <table class="data-table">
        <thead>
          <tr>
            <th style="min-width:200px;">الحساب</th>
            <th>الكود</th>
            ${n?r.map(o=>`<th class="number">${o.name}</th>`).join(""):""}
            <th class="number">المجمع</th>
          </tr>
        </thead>
        <tbody>
          <!-- Revenue Section -->
          <tr class="group-header"><td colspan="${n?r.length+3:3}">الإيرادات</td></tr>
          ${a.revenue.map(o=>Ze(o,r,n)).join("")}
          <tr class="total-row">
            <td>إجمالي الإيرادات</td>
            <td></td>
            ${n?r.map(o=>{const l=a.revenue.reduce((d,i)=>{var c;return d+(((c=i.companies[o.id])==null?void 0:c.amount)||0)},0);return`<td class="number">${v(l,2)}</td>`}).join(""):""}
            <td class="number positive">${v(a.summary.totalRevenue,2)}</td>
          </tr>
          
          <!-- Expenses Section -->
          <tr class="group-header"><td colspan="${n?r.length+3:3}">المصروفات</td></tr>
          ${a.expenses.map(o=>Ze(o,r,n,!0)).join("")}
          <tr class="total-row">
            <td>إجمالي المصروفات</td>
            <td></td>
            ${n?r.map(o=>{const l=a.expenses.reduce((d,i)=>{var c;return d+(((c=i.companies[o.id])==null?void 0:c.amount)||0)},0);return`<td class="number negative">(${v(l,2)})</td>`}).join(""):""}
            <td class="number negative">(${v(a.summary.totalExpenses,2)})</td>
          </tr>

          ${a.eliminations&&a.eliminations.length>0?`
            <tr class="group-header"><td colspan="${n?r.length+3:3}">تعديلات الاستبعاد</td></tr>
            ${a.eliminations.map(o=>`
              <tr>
                <td>${o.rule_name}</td>
                <td></td>
                ${n?r.map(()=>"<td></td>").join(""):""}
                <td class="number negative">(${v(o.debit-o.credit,2)})</td>
              </tr>
            `).join("")}
          `:""}
          
          <!-- Net Profit -->
          <tr class="total-row" style="font-size:1.1em;">
            <td>صافي الربح / (الخسارة)</td>
            <td></td>
            ${n?r.map(()=>"<td></td>").join(""):""}
            <td class="number ${a.summary.netProfit>=0?"positive":"negative"}" style="font-size:1.1em;">
              ${a.summary.netProfit>=0?"":"("}${v(Math.abs(a.summary.netProfit),2)}${a.summary.netProfit>=0?"":")"}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `}function Ze(e,a,t,s=!1){return`
    <tr class="indent-1">
      <td>${e.account_name}</td>
      <td style="font-family:var(--font-en);color:var(--text-muted);font-size:0.8em;">${e.account_code}</td>
      ${t?a.map(r=>{var o;const n=((o=e.companies[r.id])==null?void 0:o.amount)||0;return`<td class="number">${s&&n>0?"(":""}${v(Math.abs(n),2)}${s&&n>0?")":""}</td>`}).join(""):""}
      <td class="number ${s?"negative":"positive"}">
        ${s&&e.total>0?"(":""}${v(Math.abs(e.total),2)}${s&&e.total>0?")":""}
      </td>
    </tr>
  `}async function Lt(e){e.innerHTML=`
    <div class="page-header">
      <div>
        <h1 class="page-title">الميزانية العمومية المجمعة</h1>
        <p class="page-subtitle">Consolidated Balance Sheet</p>
      </div>
      <div style="display:flex;gap:8px;">
        <label style="display:flex;align-items:center;gap:6px;font-size:0.8rem;color:var(--text-secondary);">
          <input type="checkbox" id="chk-bs-eliminations" /> استبعاد المعاملات المتبادلة
        </label>
      </div>
    </div>
    
    <div class="filters-bar" id="bs-filters"></div>
    <div id="bs-content"><div class="skeleton" style="height:400px;border-radius:var(--radius-lg);"></div></div>
  `;const a=e.querySelector("#bs-filters");fe(a,()=>Ie(e)),e.querySelector("#chk-bs-eliminations").addEventListener("change",()=>Ie(e)),await Ie(e)}async function Ie(e){try{const a=S.getFilterParams();a.asOfDate=a.dateTo||new Date().toISOString().split("T")[0],a.useEliminations=e.querySelector("#chk-bs-eliminations").checked;const t=await f.getBalanceSheet(a);It(e.querySelector("#bs-content"),t)}catch{y("خطأ في تحميل الميزانية العمومية","error")}}function It(e,a){const t=S.get("companies"),s=S.get("selectedCompanyIds"),r=s.length>0?t.filter(i=>s.includes(i.id)):t,n=r.length>1,o=n?r.length+3:3,l=a.assets.filter(i=>!i.is_guarantee),d=a.assets.filter(i=>i.is_guarantee);e.innerHTML=`
    <div class="data-table-wrapper fade-in">
      <table class="data-table">
        <thead>
          <tr>
            <th style="min-width:200px;">الحساب</th>
            <th>الكود</th>
            ${n?r.map(i=>`<th class="number">${i.name}</th>`).join(""):""}
            <th class="number">المجمع</th>
          </tr>
        </thead>
        <tbody>
          <!-- Assets -->
          <tr class="group-header"><td colspan="${o}">الأصول</td></tr>
          ${l.map(i=>he(i,r,n)).join("")}
          ${d.length>0?`
            <tr class="group-header" style="background: rgba(6, 182, 212, 0.08); color: #0891b2; font-size: 0.92em; padding-right: 20px;">
              <td colspan="${o}">🏦 الضمانات البنكية (أصول محتجزة)</td>
            </tr>
            ${d.map(i=>he(i,r,n)).join("")}
          `:""}
          <tr class="total-row">
            <td>إجمالي الأصول</td><td></td>
            ${n?r.map(i=>{const c=a.assets.reduce((u,m)=>{var p;return u+(((p=m.companies[i.id])==null?void 0:p.amount)||0)},0);return`<td class="number">${v(c,2)}</td>`}).join(""):""}
            <td class="number positive">${v(a.summary.totalAssets,2)}</td>
          </tr>
          
          <!-- Liabilities -->
          <tr class="group-header"><td colspan="${o}">الالتزامات</td></tr>
          ${a.liabilities.map(i=>he(i,r,n)).join("")}
          <tr class="total-row">
            <td>إجمالي الالتزامات</td><td></td>
            ${n?r.map(i=>{const c=a.liabilities.reduce((u,m)=>{var p;return u+(((p=m.companies[i.id])==null?void 0:p.amount)||0)},0);return`<td class="number">${v(c,2)}</td>`}).join(""):""}
            <td class="number">${v(a.summary.totalLiabilities,2)}</td>
          </tr>
          
          <!-- Equity -->
          <tr class="group-header"><td colspan="${o}">حقوق الملكية</td></tr>
          ${a.equity.map(i=>he(i,r,n)).join("")}
          <tr class="total-row">
            <td>إجمالي حقوق الملكية</td><td></td>
            ${n?r.map(i=>{const c=a.equity.reduce((u,m)=>{var p;return u+(((p=m.companies[i.id])==null?void 0:p.amount)||0)},0);return`<td class="number">${v(c,2)}</td>`}).join(""):""}
            <td class="number">${v(a.summary.totalEquity,2)}</td>
          </tr>

          <!-- Total L+E -->
          <tr class="total-row" style="font-size:1.1em;">
            <td>إجمالي الالتزامات + حقوق الملكية</td><td></td>
            ${n?r.map(()=>"<td></td>").join(""):""}
            <td class="number positive" style="font-size:1.1em;">
              ${v(a.summary.totalLiabilities+a.summary.totalEquity,2)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `}function he(e,a,t){const s=e.account_code==="RE-CALC"||e.account_code==="CYE",r=!!e.is_guarantee,n=s?"font-style: italic; background: rgba(59, 130, 246, 0.05);":r?"background: rgba(6, 182, 212, 0.03);":"";let o="";return s?o=' <span style="font-size:0.75em; background:var(--primary-subtle, rgba(59,130,246,0.1)); color:var(--primary, #3b82f6); border:1px solid rgba(59,130,246,0.25); border-radius:4px; padding:1px 6px; font-style:normal; margin-right:4px;">محسوب</span>':r&&(o=' <span style="font-size:0.75em; background:rgba(6,182,212,0.1); color:#0891b2; border:1px solid rgba(6,182,212,0.25); border-radius:4px; padding:1px 6px; font-style:normal; margin-right:4px;">ضمان</span>'),`
    <tr class="indent-1" style="${n}">
      <td>${e.account_name}${o}</td>
      <td style="font-family:var(--font-en);color:var(--text-muted);font-size:0.8em;">${e.account_code}</td>
      ${t?a.map(l=>{var i;const d=((i=e.companies[l.id])==null?void 0:i.amount)||0;return`<td class="number">${v(d,2)}</td>`}).join(""):""}
      <td class="number">${v(e.total,2)}</td>
    </tr>
  `}async function Mt(e){e.innerHTML=`
    <div class="page-header">
      <div>
        <h1 class="page-title">قائمة التدفقات النقدية المجمعة</h1>
        <p class="page-subtitle">Consolidated Cash Flow Statement</p>
      </div>
    </div>
    
    <div class="filters-bar" id="cf-filters"></div>
    <div id="cf-content"><div class="skeleton" style="height:400px;border-radius:var(--radius-lg);"></div></div>
  `,fe(e.querySelector("#cf-filters"),()=>Ke(e)),await Ke(e)}async function Ke(e){try{const a=S.getFilterParams(),t=await f.getCashFlow(a);jt(e.querySelector("#cf-content"),t)}catch{y("خطأ في تحميل التدفقات النقدية","error")}}const Me={income:"إيرادات",income_other:"إيرادات أخرى",expense:"مصروفات تشغيلية",expense_direct_cost:"تكلفة مبيعات",expense_depreciation:"استهلاك",revenue:"إيرادات",cost_of_revenue:"تكلفة إيرادات",asset_receivable:"تغير في الذمم المدينة",liability_payable:"تغير في الذمم الدائنة",asset_current:"تغير في الأصول المتداولة",liability_current:"تغير في الالتزامات المتداولة",asset_non_current:"أصول غير متداولة",asset_fixed:"أصول ثابتة",equity:"حقوق ملكية",equity_unaffected:"أرباح مبقاة",liability_non_current:"التزامات طويلة الأجل",bank_guarantees:"ضمانات بنكية"};function jt(e,a){const t=a.operating.reduce((o,l)=>o+l.amount,0),s=a.investing.reduce((o,l)=>o+l.amount,0),r=a.financing.reduce((o,l)=>o+l.amount,0),n=t+s+r;e.innerHTML=`
    <div class="data-table-wrapper fade-in">
      <table class="data-table">
        <thead>
          <tr>
            <th style="min-width:300px;">الوصف</th>
            <th class="number">المبلغ (SAR)</th>
          </tr>
        </thead>
        <tbody>
          <tr class="group-header"><td colspan="2">الأنشطة التشغيلية</td></tr>
          ${a.operating.map(o=>`
            <tr class="indent-1">
              <td>${Me[o.account_type]||o.account_type}</td>
              <td class="number ${o.amount>=0?"":"negative"}">
                ${o.amount<0?"(":""}${v(Math.abs(o.amount),2)}${o.amount<0?")":""}
              </td>
            </tr>
          `).join("")}
          <tr class="total-row">
            <td>صافي النقد من الأنشطة التشغيلية</td>
            <td class="number ${t>=0?"positive":"negative"}">
              ${t<0?"(":""}${v(Math.abs(t),2)}${t<0?")":""}
            </td>
          </tr>

          <tr class="group-header"><td colspan="2">الأنشطة الاستثمارية</td></tr>
          ${a.investing.map(o=>`
            <tr class="indent-1">
              <td>${Me[o.account_type]||o.account_type}</td>
              <td class="number ${o.amount>=0?"":"negative"}">
                ${o.amount<0?"(":""}${v(Math.abs(o.amount),2)}${o.amount<0?")":""}
              </td>
            </tr>
          `).join("")}
          <tr class="total-row">
            <td>صافي النقد من الأنشطة الاستثمارية</td>
            <td class="number ${s>=0?"positive":"negative"}">
              ${s<0?"(":""}${v(Math.abs(s),2)}${s<0?")":""}
            </td>
          </tr>

          <tr class="group-header"><td colspan="2">الأنشطة التمويلية</td></tr>
          ${a.financing.map(o=>`
            <tr class="indent-1">
              <td>${Me[o.account_type]||o.account_type}</td>
              <td class="number ${o.amount>=0?"":"negative"}">
                ${o.amount<0?"(":""}${v(Math.abs(o.amount),2)}${o.amount<0?")":""}
              </td>
            </tr>
          `).join("")}
          <tr class="total-row">
            <td>صافي النقد من الأنشطة التمويلية</td>
            <td class="number ${r>=0?"positive":"negative"}">
              ${r<0?"(":""}${v(Math.abs(r),2)}${r<0?")":""}
            </td>
          </tr>

          <tr class="total-row" style="font-size:1.05em; border-top:2px solid var(--border-color);">
            <td>صافي التغير في النقد خلال الفترة</td>
            <td class="number ${n>=0?"positive":"negative"}" style="font-size:1.05em;">
              ${n<0?"(":""}${v(Math.abs(n),2)}${n<0?")":""}
            </td>
          </tr>
          ${a.summary?`
          <tr class="total-row">
            <td>رصيد النقد في بداية الفترة</td>
            <td class="number">${v(a.summary.openingCash||0,2)}</td>
          </tr>
          <tr class="total-row" style="font-size:1.15em; border-top:2px solid var(--border-color);">
            <td>رصيد النقد في نهاية الفترة</td>
            <td class="number positive" style="font-size:1.15em;">
              ${v(a.summary.closingCash||0,2)}
            </td>
          </tr>
          `:""}
        </tbody>
      </table>
    </div>
  `}let G=["account"],U=["period"],Te="balance";async function Tt(e){e.innerHTML=`
    <div class="page-header">
      <div>
        <h1 class="page-title">الجداول المحورية</h1>
        <p class="page-subtitle">Pivot Tables - تحليل البيانات بحرية</p>
      </div>
    </div>
    
    <div class="filters-bar" id="pivot-filters"></div>
    
    <div class="card" style="margin-bottom:var(--space-lg);">
      <div class="pivot-controls">
        <div class="pivot-dimension">
          <div class="pivot-dimension-header">الصفوف (Rows)</div>
          <div class="pivot-chips" id="pivot-rows"></div>
        </div>
        <div class="pivot-dimension">
          <div class="pivot-dimension-header">الأعمدة (Columns)</div>
          <div class="pivot-chips" id="pivot-cols"></div>
        </div>
        <div class="pivot-dimension">
          <div class="pivot-dimension-header">القياس (Measure)</div>
          <div class="pivot-chips" id="pivot-measure"></div>
        </div>
      </div>
    </div>
    
    <div id="pivot-content"><div class="skeleton" style="height:400px;border-radius:var(--radius-lg);"></div></div>
  `,fe(e.querySelector("#pivot-filters"),()=>ge(e)),xe(e),await ge(e)}const Ce=[{id:"account",label:"الحساب"},{id:"account_type",label:"نوع الحساب"},{id:"company",label:"الشركة"},{id:"period",label:"الفترة"},{id:"fiscal_year",label:"السنة المالية"},{id:"journal",label:"اليومية"},{id:"partner",label:"الشريك"},{id:"cost_center",label:"مركز التكلفة"}],Ct=[{id:"balance",label:"الرصيد"},{id:"debit",label:"المدين"},{id:"credit",label:"الدائن"},{id:"count",label:"العدد"}];function xe(e){const a=e.querySelector("#pivot-rows"),t=e.querySelector("#pivot-cols"),s=e.querySelector("#pivot-measure");a.innerHTML=Ce.map(r=>`
    <span class="pivot-chip ${G.includes(r.id)?"active":""}" data-dim="${r.id}">${r.label}</span>
  `).join(""),t.innerHTML=Ce.map(r=>`
    <span class="pivot-chip ${U.includes(r.id)?"active":""}" data-dim="${r.id}">${r.label}</span>
  `).join(""),s.innerHTML=Ct.map(r=>`
    <span class="pivot-chip ${Te===r.id?"active":""}" data-measure="${r.id}">${r.label}</span>
  `).join(""),a.querySelectorAll(".pivot-chip").forEach(r=>{r.addEventListener("click",()=>{const n=r.dataset.dim;G.includes(n)?G=G.filter(o=>o!==n):G.push(n),G.length===0&&(G=["account"]),xe(e),ge(e)})}),t.querySelectorAll(".pivot-chip").forEach(r=>{r.addEventListener("click",()=>{const n=r.dataset.dim;U.includes(n)?U=U.filter(o=>o!==n):U.push(n),U.length===0&&(U=["period"]),xe(e),ge(e)})}),s.querySelectorAll(".pivot-chip").forEach(r=>{r.addEventListener("click",()=>{Te=r.dataset.measure,xe(e),ge(e)})})}async function ge(e){try{const a={...S.getFilterParams(),rows:G.join(","),columns:U.join(","),measure:Te},t=await f.getPivotData(a);At(e.querySelector("#pivot-content"),t)}catch(a){y("خطأ في تحميل الجدول المحوري","error"),console.error(a)}}function At(e,a){var u;if(!a||a.length===0){e.innerHTML='<div class="card" style="text-align:center;padding:60px;color:var(--text-muted);">لا توجد بيانات للعرض</div>';return}const t={company:"c.name",account:"ji.account_code",account_name:"ji.account_name",account_type:"ji.account_type",period:"ji.period",fiscal_year:"ji.fiscal_year",journal:"ji.journal_name",partner:"ji.partner_name",cost_center:"ji.analytic_account"},s=U[0],r=t[s]||s,n=r.includes(".")?r.split(".")[1]:r,o=[...new Set(a.map(m=>m[n]||m[Object.keys(m).find(p=>p.includes(n.replace("ji.","").replace("c.","")))]||""))].filter(m=>m).sort(),l=G[0],d=t[l]||l,i=d.includes(".")?d.split(".")[1]:d,c={};for(const m of a){const p=m[i]||m[Object.keys(m).find(h=>h.includes(i.replace("ji.","").replace("c.","")))]||"غير محدد",b=m[n]||m[Object.keys(m).find(h=>h.includes(n.replace("ji.","").replace("c.","")))]||"";c[p]||(c[p]={}),c[p][b]=(c[p][b]||0)+(m.value||0)}e.innerHTML=`
    <div class="data-table-wrapper fade-in">
      <table class="data-table">
        <thead>
          <tr>
            <th>${((u=Ce.find(m=>m.id===l))==null?void 0:u.label)||l}</th>
            ${o.map(m=>`<th class="number">${m}</th>`).join("")}
            <th class="number">المجموع</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(c).map(([m,p])=>{const b=Object.values(p).reduce((h,x)=>h+x,0);return`
              <tr>
                <td>${m}</td>
                ${o.map(h=>{const x=p[h]||0;return`<td class="number ${x<0?"negative":""}">${v(x,2)}</td>`}).join("")}
                <td class="number" style="font-weight:600;">${v(b,2)}</td>
              </tr>
            `}).join("")}
          <tr class="total-row">
            <td>المجموع</td>
            ${o.map(m=>{const p=Object.values(c).reduce((b,h)=>b+(h[m]||0),0);return`<td class="number">${v(p,2)}</td>`}).join("")}
            <td class="number">${v(Object.values(c).reduce((m,p)=>m+Object.values(p).reduce((b,h)=>b+h,0),0),2)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `}let Z=0;const Ae=50;async function Ht(e){e.innerHTML=`
    <div class="page-header">
      <div>
        <h1 class="page-title">القيود المحاسبية</h1>
        <p class="page-subtitle">Journal Items - عرض تفصيلي لبنود القيود</p>
      </div>
    </div>
    
    <div class="filters-bar">
      <div class="filter-group">
        <span class="filter-label">الشركة</span>
        <select class="filter-select" id="ji-company">
          <option value="">الكل</option>
          ${S.get("companies").map(a=>`<option value="${a.id}">${a.name}</option>`).join("")}
        </select>
      </div>
      <div class="filter-group">
        <span class="filter-label">من تاريخ</span>
        <input type="date" class="filter-input" id="ji-date-from" />
      </div>
      <div class="filter-group">
        <span class="filter-label">إلى تاريخ</span>
        <input type="date" class="filter-input" id="ji-date-to" />
      </div>
      <div class="filter-group">
        <span class="filter-label">كود الحساب</span>
        <input type="text" class="filter-input" id="ji-account" placeholder="مثل: 4100" style="direction:ltr;" />
      </div>
      <div class="filter-group" style="align-self:flex-end;">
        <button class="btn btn-primary" id="btn-ji-search">بحث</button>
      </div>
    </div>
    
    <div id="ji-content"><div class="skeleton" style="height:400px;border-radius:var(--radius-lg);"></div></div>
    <div id="ji-pagination" style="display:flex;justify-content:center;gap:8px;margin-top:var(--space-lg);"></div>
  `,e.querySelector("#btn-ji-search").addEventListener("click",()=>{Z=0,ke(e)}),await ke(e)}async function ke(e){try{const a=e.querySelector("#ji-company").value,t={limit:Ae,offset:Z*Ae,dateFrom:e.querySelector("#ji-date-from").value,dateTo:e.querySelector("#ji-date-to").value,accountCode:e.querySelector("#ji-account").value};a&&(t.companyIds=[parseInt(a)]);const s=await f.getJournalItems(t);Bt(e,s)}catch{y("خطأ في تحميل القيود","error")}}function Bt(e,a){var l,d;const t=e.querySelector("#ji-content"),{items:s,total:r}=a,n=Math.ceil(r/Ae);t.innerHTML=`
    <div style="margin-bottom:var(--space-md);font-size:0.8rem;color:var(--text-muted);">
      إجمالي النتائج: ${v(r)} | الصفحة ${Z+1} من ${n||1}
    </div>
    <div class="data-table-wrapper fade-in">
      <table class="data-table">
        <thead>
          <tr>
            <th>التاريخ</th>
            <th>الشركة</th>
            <th>كود الحساب</th>
            <th>اسم الحساب</th>
            <th>البيان</th>
            <th>الشريك</th>
            <th class="number">مدين</th>
            <th class="number">دائن</th>
            <th class="number">الرصيد</th>
            <th>رقم القيد</th>
          </tr>
        </thead>
        <tbody>
          ${s.length===0?'<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--text-muted);">لا توجد نتائج</td></tr>':""}
          ${s.map(i=>`
            <tr>
              <td style="font-family:var(--font-en);font-size:0.8em;white-space:nowrap;">${i.date}</td>
              <td><span class="badge badge-info">${i.company_name||""}</span></td>
              <td style="font-family:var(--font-en);">${i.account_code||""}</td>
              <td>${i.account_name||""}</td>
              <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;">${i.label||""}</td>
              <td>${i.partner_name||""}</td>
              <td class="number">${i.debit>0?v(i.debit,2):""}</td>
              <td class="number">${i.credit>0?v(i.credit,2):""}</td>
              <td class="number ${i.balance>=0?"":"negative"}">${v(i.balance,2)}</td>
              <td style="font-family:var(--font-en);font-size:0.75em;color:var(--text-muted);">${i.move_name||""}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;const o=e.querySelector("#ji-pagination");n>1?(o.innerHTML=`
      <button class="btn btn-sm btn-secondary" ${Z===0?"disabled":""} id="btn-prev">السابق</button>
      <span style="display:flex;align-items:center;font-size:0.85rem;color:var(--text-secondary);">
        ${Z+1} / ${n}
      </span>
      <button class="btn btn-sm btn-secondary" ${Z>=n-1?"disabled":""} id="btn-next">التالي</button>
    `,(l=o.querySelector("#btn-prev"))==null||l.addEventListener("click",()=>{Z--,ke(e)}),(d=o.querySelector("#btn-next"))==null||d.addEventListener("click",()=>{Z++,ke(e)})):o.innerHTML=""}async function Pt(e){e.innerHTML=`
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
        ${S.get("companies").map(a=>`<option value="${a.id}">${a.name}</option>`).join("")}
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
  `,e.querySelector("#mapping-company").addEventListener("change",()=>Qe(e)),e.querySelector("#btn-add-unified").addEventListener("click",()=>Ot()),await Qe(e)}async function Qe(e){try{const a=e.querySelector("#mapping-company").value,[t,s]=await Promise.all([f.getCompanyAccounts(a),f.getUnifiedAccounts()]);Rt(e.querySelector("#company-accounts-list"),t,s,a),Dt(e.querySelector("#unified-accounts-list"),s),Ft(e.querySelector("#mapping-stats"),t)}catch{y("خطأ في تحميل بيانات التوحيد","error")}}function Rt(e,a,t,s){e.innerHTML=a.map(r=>`
    <div class="mapping-item ${r.is_mapped?"mapped":"unmapped"}">
      <div>
        <div style="font-family:var(--font-en);font-size:0.8em;color:var(--text-muted);">${r.code}</div>
        <div style="font-size:0.85rem;">${r.name}</div>
        ${r.unified_name?`<div style="font-size:0.72rem;color:var(--accent-emerald);">← ${r.unified_name}</div>`:""}
      </div>
      <div>
        <select class="filter-select" style="min-width:160px;font-size:0.78rem;" data-account-id="${r.id}" data-company-id="${s}">
          <option value="">-- غير معين --</option>
          ${t.map(n=>`
            <option value="${n.id}" ${r.unified_account_id===n.id?"selected":""}>
              ${n.code} - ${n.name_ar}
            </option>
          `).join("")}
        </select>
      </div>
    </div>
  `).join("")||'<div style="padding:20px;text-align:center;color:var(--text-muted);">لا توجد حسابات - قم بمزامنة البيانات أولاً</div>',e.querySelectorAll("select").forEach(r=>{r.addEventListener("change",async()=>{const n=parseInt(r.value),o=parseInt(r.dataset.accountId);if(n)try{await f.createMapping({company_account_id:o,unified_account_id:n}),y("تم ربط الحساب بنجاح","success");const l=r.dataset.companyId,d=e.closest("#main-content")||document.getElementById("main-content"),i=r.closest(".mapping-item");i.classList.remove("unmapped"),i.classList.add("mapped")}catch{y("خطأ في ربط الحساب","error")}})})}function Dt(e,a){e.innerHTML=a.map(t=>`
    <div class="mapping-item" style="border-right:3px solid var(--accent-blue);">
      <div>
        <div style="font-family:var(--font-en);font-size:0.8em;color:var(--text-muted);">${t.code}</div>
        <div style="font-size:0.85rem;">${t.name_ar}</div>
        <div style="font-size:0.72rem;color:var(--text-muted);">${t.name_en||""} | ${t.account_type}</div>
      </div>
      <span class="badge ${t.is_group?"badge-info":"badge-success"}">${t.is_group?"مجموعة":"حساب"}</span>
    </div>
  `).join("")||'<div style="padding:20px;text-align:center;color:var(--text-muted);">لا توجد حسابات موحدة</div>'}function Ft(e,a){const t=a.length,s=a.filter(n=>n.is_mapped).length,r=t>0?(s/t*100).toFixed(0):0;e.innerHTML=`
    <div style="display:flex;align-items:center;gap:var(--space-lg);">
      <div style="flex:1;">
        <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-sm);">
          <span style="font-size:0.85rem;">التقدم</span>
          <span style="font-family:var(--font-en);font-weight:600;">${s}/${t} (${r}%)</span>
        </div>
        <div style="height:8px;background:rgba(10,15,40,0.5);border-radius:4px;overflow:hidden;">
          <div style="height:100%;width:${r}%;background:linear-gradient(90deg,var(--accent-blue),var(--accent-emerald));border-radius:4px;transition:width 0.5s ease;"></div>
        </div>
      </div>
      <div style="display:flex;gap:var(--space-md);">
        <div style="text-align:center;">
          <div style="font-size:1.3rem;font-weight:700;color:var(--accent-emerald);">${s}</div>
          <div style="font-size:0.72rem;color:var(--text-muted);">مربوط</div>
        </div>
        <div style="text-align:center;">
          <div style="font-size:1.3rem;font-weight:700;color:var(--accent-amber);">${t-s}</div>
          <div style="font-size:0.72rem;color:var(--text-muted);">غير مربوط</div>
        </div>
      </div>
    </div>
  `}function Ot(){ye("إضافة حساب موحد جديد",`
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
  `),document.getElementById("btn-save-unified").addEventListener("click",async()=>{try{await f.createUnifiedAccount({code:document.getElementById("ua-code").value,name_ar:document.getElementById("ua-name-ar").value,name_en:document.getElementById("ua-name-en").value,account_type:document.getElementById("ua-type").value}),ve(),y("تم إضافة الحساب الموحد","success")}catch(e){y("خطأ: "+e.message,"error")}})}let ce={};async function Nt(e){e.innerHTML=`
    <div class="page-header">
      <div>
        <h1 class="page-title">⚙️ إعدادات النظام</h1>
        <p class="page-subtitle">إدارة الاتصال بأودو والشركات واستيراد البيانات</p>
      </div>
    </div>

    <!-- ===== Step 1: API Connection ===== -->
    <div class="settings-section card" style="border:1px solid rgba(59,130,246,0.3);">
      <h2 style="font-size:1.1rem;color:var(--accent-blue);margin-bottom:var(--space-lg);display:flex;align-items:center;gap:8px;">
        <span style="background:var(--accent-blue);color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.85rem;">1</span>
        الاتصال بخادم أودو
      </h2>
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);">
        <div class="form-group" style="grid-column:1/-1;">
          <label class="form-label">رابط الـ API</label>
          <input type="text" class="form-input" id="conn-url" placeholder="https://aboghaliaoffice.com" dir="ltr" style="font-family:var(--font-en);text-align:left;" />
          <small style="color:var(--text-muted);font-size:0.72rem;">الرابط الأساسي بدون /api/ — مثال: https://aboghaliaoffice.com</small>
        </div>
        <div class="form-group">
          <label class="form-label">اسم المستخدم (Username)</label>
          <input type="text" class="form-input" id="conn-user" placeholder="admin" dir="ltr" style="font-family:var(--font-en);text-align:left;" />
        </div>
        <div class="form-group">
          <label class="form-label">كلمة المرور / مفتاح API</label>
          <input type="password" class="form-input" id="conn-pass" placeholder="كلمة المرور أو API Key" dir="ltr" style="font-family:var(--font-en);text-align:left;" />
        </div>
        <div class="form-group" style="grid-column:1/-1;">
          <label class="form-label">اسم قاعدة البيانات (Database)</label>
          <input type="text" class="form-input" id="conn-db" placeholder="يُكتشف تلقائياً إن أمكن" dir="ltr" style="font-family:var(--font-en);text-align:left;" />
          <small style="color:var(--text-muted);font-size:0.72rem;">مطلوب إذا كان الخادم يخفي قائمة قواعد البيانات — يظهر في أودو من الإعدادات بعد تفعيل وضع المطوّر</small>
        </div>
      </div>
      
      <div style="display:flex;gap:var(--space-md);margin-top:var(--space-lg);">
        <button class="btn btn-primary" id="btn-test-conn">🔌 اختبار الاتصال</button>
        <button class="btn btn-success" id="btn-save-conn" disabled>💾 حفظ الاتصال</button>
      </div>
      <div id="conn-result" style="margin-top:var(--space-md);"></div>
    </div>

    <!-- ===== Step 2: Saved Connections ===== -->
    <div class="settings-section card" style="margin-top:var(--space-lg);border:1px solid rgba(139,92,246,0.3);">
      <h2 style="font-size:1.1rem;color:var(--accent-purple);margin-bottom:var(--space-md);display:flex;align-items:center;gap:8px;">
        <span style="background:var(--accent-purple);color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.85rem;">✓</span>
        الاتصالات المحفوظة
      </h2>
      <div id="instances-list"><div class="skeleton" style="height:60px;border-radius:var(--radius-md);"></div></div>
    </div>

    <!-- ===== Step 2: Companies ===== -->
    <div class="settings-section card" style="margin-top:var(--space-lg);border:1px solid rgba(16,185,129,0.3);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-lg);">
        <h2 style="font-size:1.1rem;color:var(--accent-emerald);display:flex;align-items:center;gap:8px;">
          <span style="background:var(--accent-emerald);color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.85rem;">2</span>
          الشركات
        </h2>
        <button class="btn btn-primary btn-sm" id="btn-add-company">+ إضافة شركة</button>
      </div>
      <div id="companies-list"><div class="skeleton" style="height:100px;border-radius:var(--radius-md);"></div></div>
    </div>

    <!-- ===== Step 3: Import Data ===== -->
    <div class="settings-section card" style="margin-top:var(--space-lg);border:1px solid rgba(245,158,11,0.3);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-lg);">
        <h2 style="font-size:1.1rem;color:var(--accent-amber);display:flex;align-items:center;gap:8px;">
          <span style="background:var(--accent-amber);color:#000;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.85rem;">3</span>
          استيراد البيانات من أودو
        </h2>
        <button class="btn btn-success btn-sm" id="btn-sync-all">🔄 مزامنة جميع الشركات</button>
      </div>
      <p style="color:var(--text-muted);font-size:0.8rem;margin-bottom:var(--space-lg);">
        يتم استيراد البيانات على مراحل (دفعات). كل دفعة = 500 سجل. يمكنك متابعة التقدم أثناء الاستيراد.
      </p>
      <div id="import-panel"></div>
    </div>

    <!-- ===== Step 4: Sync Schedule ===== -->
    <div class="settings-section card" style="margin-top:var(--space-lg);border:1px solid rgba(6,182,212,0.3);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-lg);">
        <h2 style="font-size:1.1rem;color:#06b6d4;display:flex;align-items:center;gap:8px;">
          <span style="background:#06b6d4;color:#000;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.85rem;">4</span>
          🔄 المزامنة التلقائية
        </h2>
        <div id="schedule-status" style="font-size:0.78rem;color:var(--text-muted);"></div>
      </div>

      <div style="display:grid;grid-template-columns:auto 1fr auto;gap:var(--space-md);align-items:center;">
        <!-- Toggle -->
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
          <div style="position:relative;width:44px;height:24px;">
            <input type="checkbox" id="sync-enabled" style="opacity:0;width:0;height:0;position:absolute;">
            <span id="sync-toggle-track" style="position:absolute;inset:0;background:rgba(255,255,255,0.1);border-radius:12px;transition:background 0.3s;cursor:pointer;"></span>
            <span id="sync-toggle-dot" style="position:absolute;top:2px;right:22px;width:20px;height:20px;background:#fff;border-radius:50%;transition:all 0.3s;cursor:pointer;"></span>
          </div>
          <span style="font-size:0.85rem;color:var(--text-secondary);">تفعيل المزامنة التلقائية</span>
        </label>

        <!-- Interval -->
        <div style="display:flex;align-items:center;gap:8px;">
          <label style="font-size:0.8rem;color:var(--text-muted);white-space:nowrap;">الفترة:</label>
          <select id="sync-interval" class="filter-select" style="font-size:0.82rem;padding:6px 12px;min-width:160px;">
            <option value="1">كل ساعة</option>
            <option value="2" selected>كل ساعتين</option>
            <option value="4">كل 4 ساعات</option>
            <option value="6">كل 6 ساعات</option>
            <option value="12">كل 12 ساعة</option>
            <option value="24">يومياً</option>
          </select>
        </div>

        <!-- Save -->
        <button class="btn btn-primary btn-sm" id="btn-save-schedule">💾 حفظ الإعدادات</button>
      </div>

      <!-- Notifications -->
      <div style="margin-top:var(--space-lg);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-sm);">
          <h3 style="font-size:0.9rem;color:var(--text-secondary);margin:0;">📬 إشعارات المزامنة</h3>
          <button class="btn btn-sm" id="btn-clear-notifs" style="font-size:0.72rem;padding:3px 10px;color:var(--text-muted);">🗑 مسح</button>
        </div>
        <div id="sync-notifications-list" style="max-height:200px;overflow-y:auto;"></div>
      </div>
    </div>

    <!-- ===== Step 5: Elimination Rules (was 4) ===== -->
    <div class="settings-section card" style="margin-top:var(--space-lg);border:1px solid rgba(139,92,246,0.3);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-lg);">
        <h2 style="font-size:1.1rem;color:var(--accent-purple);display:flex;align-items:center;gap:8px;">
          <span style="background:var(--accent-purple);color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.85rem;">5</span>
          قواعد استبعاد المعاملات المتبادلة
        </h2>
        <button class="btn btn-primary btn-sm" id="btn-add-rule">+ إضافة قاعدة</button>
      </div>
      <div id="rules-list"><div class="skeleton" style="height:80px;border-radius:var(--radius-md);"></div></div>
    </div>

    <!-- ===== Sync Log ===== -->
    <div class="settings-section card" style="margin-top:var(--space-lg);border:1px solid rgba(99,102,241,0.2);">
      <h2 style="font-size:1.1rem;color:var(--text-secondary);margin-bottom:var(--space-md);">📋 سجل المزامنة</h2>
      <div id="sync-log"><div class="skeleton" style="height:80px;border-radius:var(--radius-md);"></div></div>
    </div>
  `;const a=e.querySelector("#btn-test-conn"),t=e.querySelector("#btn-save-conn");a.addEventListener("click",async()=>{const l=e.querySelector("#conn-url").value.trim(),d=e.querySelector("#conn-user").value.trim(),i=e.querySelector("#conn-pass").value.trim(),c=e.querySelector("#conn-result");if(!l||!d||!i){c.innerHTML='<div style="padding:12px;border-radius:8px;background:rgba(239,68,68,0.15);color:var(--accent-red);font-size:0.85rem;">⚠️ يرجى تعبئة جميع الحقول</div>';return}a.disabled=!0,a.textContent="جاري الاختبار...",c.innerHTML='<div style="padding:12px;color:var(--text-muted);font-size:0.85rem;">⏳ جاري اختبار الاتصال...</div>';try{const u=await f.testConnectionDirect({url:l,username:d,password:i,db_name:e.querySelector("#conn-db").value.trim(),company_id:1});u.success?(c.innerHTML=`
          <div style="padding:12px;border-radius:8px;background:rgba(16,185,129,0.15);color:var(--accent-emerald);font-size:0.85rem;">
            ✅ الاتصال ناجح! ${u.message||""}
          </div>
        `,t.disabled=!1):(c.innerHTML=`
          <div style="padding:12px;border-radius:8px;background:rgba(239,68,68,0.15);color:var(--accent-red);font-size:0.85rem;">
            ❌ فشل الاتصال: ${u.message}
          </div>
        `,t.disabled=!0)}catch(u){c.innerHTML=`
        <div style="padding:12px;border-radius:8px;background:rgba(239,68,68,0.15);color:var(--accent-red);font-size:0.85rem;">
          ❌ خطأ: ${u.message}
        </div>
      `}a.disabled=!1,a.textContent="🔌 اختبار الاتصال"}),t.addEventListener("click",async()=>{const l=e.querySelector("#conn-url").value.trim(),d=e.querySelector("#conn-user").value.trim(),i=e.querySelector("#conn-pass").value.trim();t.disabled=!0,t.textContent="جاري الحفظ...";try{let c=l;try{c=new URL(l).hostname}catch{c=l.replace(/https?:\/\//,"").split("/")[0]}await f.createInstance({name:"أودو - "+c,url:l,username:d,api_key:i,db_name:e.querySelector("#conn-db").value.trim()}),y("تم حفظ الاتصال بنجاح ✅ — اربط الشركات به من قسم الشركات","success"),e.querySelector("#conn-url").value="",e.querySelector("#conn-user").value="",e.querySelector("#conn-pass").value="",e.querySelector("#conn-db").value="",e.querySelector("#conn-result").innerHTML="",t.disabled=!0,await ne(e)}catch(c){y("خطأ في الحفظ: "+c.message,"error")}t.disabled=!1,t.textContent="💾 حفظ الاتصال"}),e.querySelector("#btn-add-company").addEventListener("click",()=>Kt(e)),e.querySelector("#btn-add-rule").addEventListener("click",()=>Qt(e)),e.querySelector("#btn-sync-all").addEventListener("click",async()=>{try{await f.syncAll(),y("بدأت مزامنة جميع الشركات","info"),Xt(e)}catch(l){y("خطأ: "+l.message,"error")}});const s=e.querySelector("#sync-enabled"),r=e.querySelector("#sync-toggle-track"),n=e.querySelector("#sync-toggle-dot");function o(l){l?(r.style.background="#06b6d4",n.style.right="2px"):(r.style.background="rgba(255,255,255,0.1)",n.style.right="22px")}r.addEventListener("click",()=>{s.checked=!s.checked,o(s.checked)}),n.addEventListener("click",()=>{s.checked=!s.checked,o(s.checked)}),e.querySelector("#btn-save-schedule").addEventListener("click",async()=>{const l=e.querySelector("#btn-save-schedule");l.disabled=!0,l.textContent="⏳ جاري الحفظ...";try{const d=await f.updateSchedule({enabled:s.checked,intervalHours:parseInt(e.querySelector("#sync-interval").value)});y(d.running?`تم تفعيل المزامنة التلقائية — ${d.schedule}`:"تم إيقاف المزامنة التلقائية","success"),lt(e,d)}catch(d){y("خطأ: "+d.message,"error")}l.disabled=!1,l.textContent="💾 حفظ الإعدادات"}),e.querySelector("#btn-clear-notifs").addEventListener("click",async()=>{try{await f.clearNotifications(),e.querySelector("#sync-notifications-list").innerHTML='<div style="text-align:center;color:var(--text-muted);padding:12px;font-size:0.8rem;">لا توجد إشعارات</div>',y("تم مسح الإشعارات","info")}catch(l){y("خطأ: "+l.message,"error")}}),await ne(e)}function lt(e,a){const t=e.querySelector("#schedule-status");t&&(a.running?t.innerHTML=`<span style="color:#10b981;">● نشطة</span> — <span style="font-family:var(--font-en);font-size:0.72rem;">${a.schedule}</span>`:t.innerHTML='<span style="color:var(--text-muted);">○ متوقفة</span>')}function Vt(e,a){if(!e)return;if(!a||a.length===0){e.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:12px;font-size:0.8rem;">لا توجد إشعارات</div>';return}const t={success:"background:rgba(16,185,129,0.12);color:#10b981;border-color:rgba(16,185,129,0.2)",warning:"background:rgba(245,158,11,0.12);color:#f59e0b;border-color:rgba(245,158,11,0.2)",error:"background:rgba(239,68,68,0.12);color:#ef4444;border-color:rgba(239,68,68,0.2)"},s={success:"✅",warning:"⚠️",error:"❌"};e.innerHTML=`<div style="display:grid;gap:6px;">
    ${a.map(r=>{const n=t[r.type]||t.success,o=s[r.type]||"✅",l=r.created_at?new Date(r.created_at+"Z").toLocaleString("ar-SA",{hour:"2-digit",minute:"2-digit",day:"numeric",month:"short"}):"";return`<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-radius:8px;border:1px solid;${n};font-size:0.8rem;">
        <span>${o} ${r.message}</span>
        <span style="font-family:var(--font-en);font-size:0.7rem;opacity:0.7;">${l}</span>
      </div>`}).join("")}
  </div>`}async function ne(e){try{const[a,t,s,r,n,o]=await Promise.all([f.getInstances(),f.getCompanies(),f.getEliminationRules(),f.getSyncStatus(),f.getSchedule().catch(()=>({enabled:!1,intervalHours:2,running:!1})),f.getNotifications().catch(()=>[])]);Jt(e.querySelector("#instances-list"),a,e),Gt(e.querySelector("#companies-list"),t,a,e),Ut(e.querySelector("#import-panel"),t),Wt(e.querySelector("#rules-list"),s),Zt(e.querySelector("#sync-log"),r);const l=e.querySelector("#sync-enabled");if(l){l.checked=n.enabled;const i=e.querySelector("#sync-toggle-track"),c=e.querySelector("#sync-toggle-dot");n.enabled?(i.style.background="#06b6d4",c.style.right="2px"):(i.style.background="rgba(255,255,255,0.1)",c.style.right="22px")}const d=e.querySelector("#sync-interval");d&&(d.value=String(n.intervalHours)),lt(e,n),Vt(e.querySelector("#sync-notifications-list"),o)}catch{y("خطأ في تحميل الإعدادات","error")}}function Jt(e,a,t){if(a.length===0){e.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:15px;font-size:0.85rem;">لا توجد اتصالات محفوظة — أضف اتصال من الخطوة 1</div>';return}e.innerHTML=`
    <div style="display:grid;gap:var(--space-sm);">
      ${a.map(s=>`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:rgba(139,92,246,0.06);border-radius:var(--radius-md);border:1px solid rgba(139,92,246,0.15);">
          <div>
            <strong style="font-size:0.85rem;">${s.name}</strong>
            <span style="font-family:var(--font-en);font-size:0.75rem;color:var(--text-muted);margin-right:8px;">${s.url}</span>
            <span style="font-size:0.72rem;color:var(--text-muted);">— ${s.username}</span>
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            <span style="font-size:0.7rem;color:var(--text-muted);font-family:var(--font-en);">ID: ${s.id}</span>
            <button class="btn btn-sm btn-delete-instance" data-id="${s.id}" style="background:rgba(239,68,68,0.1);color:var(--accent-red);border:1px solid rgba(239,68,68,0.2);font-size:0.75rem;padding:3px 8px;">❌</button>
          </div>
        </div>
      `).join("")}
    </div>
  `,e.querySelectorAll(".btn-delete-instance").forEach(s=>{s.addEventListener("click",async()=>{const r=s.dataset.id;if(confirm("هل تريد حذف هذا الاتصال؟"))try{await f.deleteInstance(r),y("تم حذف الاتصال","success"),await ne(t)}catch(n){y("خطأ: "+n.message,"error")}})})}function Gt(e,a,t,s){if(a.length===0){e.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:0.85rem;">لا توجد شركات — أضف شركة جديدة</div>';return}const r={};for(const n of t)r[n.id]=n;e.innerHTML=`
    <div class="data-table-wrapper">
      <table class="data-table">
        <thead><tr><th>الشركة</th><th>الخادم المربوط</th><th>Odoo ID</th><th>عدد القيود</th><th>آخر قيد</th><th>الحالة</th></tr></thead>
        <tbody>
          ${a.map(n=>{const o=r[n.odoo_instance_id],l=t.map(d=>`<option value="${d.id}" ${d.id===n.odoo_instance_id?"selected":""}>${d.name}</option>`).join("");return`
            <tr>
              <td>
                <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${n.color||"#3b82f6"};margin-left:8px;"></span>
                ${n.name}
              </td>
              <td>
                <select class="filter-select company-instance-select" data-company-id="${n.id}" style="font-size:0.78rem;padding:4px 8px;min-width:180px;">
                  ${l}
                </select>
                ${o?`<div style="font-family:var(--font-en);font-size:0.68rem;color:var(--text-muted);margin-top:2px;">${o.url} — ${o.username}</div>`:""}
              </td>
              <td style="font-family:var(--font-en);">${n.odoo_company_id}</td>
              <td style="font-family:var(--font-en);font-weight:600;">${v(n.item_count||0)}</td>
              <td style="font-family:var(--font-en);font-size:0.8em;">${n.last_entry_date||"--"}</td>
              <td><span class="badge ${n.is_active?"badge-success":"badge-danger"}">${n.is_active?"نشط":"معطل"}</span></td>
            </tr>
          `}).join("")}
        </tbody>
      </table>
    </div>
  `,e.querySelectorAll(".company-instance-select").forEach(n=>{n.addEventListener("change",async()=>{const o=n.dataset.companyId,l=parseInt(n.value);try{await f.updateCompany(o,{odoo_instance_id:l}),y("تم تحديث الخادم المربوط ✅","success"),await ne(s)}catch(d){y("خطأ: "+d.message,"error")}})})}function Ut(e,a){if(a.length===0){e.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:0.85rem;">أضف شركات أولاً ثم ابدأ الاستيراد</div>';return}e.innerHTML=a.map(t=>`
    <div class="card" style="margin-bottom:var(--space-md);border:1px solid rgba(255,255,255,0.05);padding:var(--space-md);" id="import-card-${t.id}">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${t.color||"#3b82f6"};margin-left:8px;"></span>
          <strong>${t.name}</strong>
          <span style="font-family:var(--font-en);color:var(--text-muted);font-size:0.8em;margin-right:8px;">(Odoo Company ID: ${t.odoo_company_id})</span>
          <span style="font-family:var(--font-en);color:var(--text-muted);font-size:0.8em;">— ${v(t.item_count||0)} سجل</span>
        </div>
        <button class="btn btn-primary btn-sm btn-import" data-company-id="${t.id}">📥 استيراد</button>
      </div>
      <div class="import-progress" id="progress-${t.id}" style="margin-top:var(--space-sm);display:none;">
        <div style="display:flex;justify-content:space-between;font-size:0.78rem;color:var(--text-secondary);margin-bottom:4px;">
          <span id="progress-text-${t.id}">جاري التحضير...</span>
          <span id="progress-pct-${t.id}">0%</span>
        </div>
        <div style="height:6px;background:rgba(10,15,40,0.5);border-radius:3px;overflow:hidden;">
          <div id="progress-bar-${t.id}" style="height:100%;width:0%;background:linear-gradient(90deg,var(--accent-blue),var(--accent-emerald));border-radius:3px;transition:width 0.5s ease;"></div>
        </div>
      </div>
    </div>
  `).join(""),e.querySelectorAll(".btn-import").forEach(t=>{t.addEventListener("click",async()=>{const s=parseInt(t.dataset.companyId);t.disabled=!0,t.textContent="⏳ جاري...";try{await f.syncCompany(s),y("بدأت عملية الاستيراد","info"),it(s)}catch(r){y("خطأ: "+r.message,"error"),t.disabled=!1,t.textContent="📥 استيراد"}})})}function it(e){const a=document.getElementById(`progress-${e}`);a&&(a.style.display="block"),ce[e]&&clearInterval(ce[e]),ce[e]=setInterval(async()=>{try{const t=await f.getSyncProgress(e);if(Yt(e,t),t.status==="completed"||t.status==="failed"){clearInterval(ce[e]),delete ce[e];const s=document.querySelector(`[data-company-id="${e}"]`);if(s&&(s.disabled=!1,s.textContent=t.status==="completed"?"✅ تم":"📥 إعادة الاستيراد"),t.status==="completed"){y(`تم استيراد ${v(t.inserted)} سجل بنجاح ✅`,"success");const r=await f.getCompanies();S.set("companies",r)}else y(`فشل الاستيراد: ${t.phase}`,"error")}}catch(t){console.error("Progress poll error:",t)}},1500)}function Xt(e){const a=S.get("companies");for(const t of a)it(t.id)}function Yt(e,a){const t=document.getElementById(`progress-text-${e}`),s=document.getElementById(`progress-pct-${e}`),r=document.getElementById(`progress-bar-${e}`),n=document.getElementById(`progress-${e}`);if(!(!t||!s||!r)){if(n.style.display="block",t.textContent=a.phase||"",a.total>0){const o=Math.round(a.inserted/a.total*100);s.textContent=`${o}%`,r.style.width=`${o}%`}a.status==="completed"?(r.style.background="var(--accent-emerald)",r.style.width="100%",s.textContent="100%"):a.status==="failed"&&(r.style.background="var(--accent-red)")}}function Wt(e,a){if(a.length===0){e.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:15px;font-size:0.85rem;">لا توجد قواعد استبعاد</div>';return}e.innerHTML=`
    <div class="data-table-wrapper">
      <table class="data-table">
        <thead><tr><th>القاعدة</th><th>الشركة المصدر</th><th>الشركة الهدف</th><th>حساب المصدر</th><th>حساب الهدف</th></tr></thead>
        <tbody>
          ${a.map(t=>`
            <tr>
              <td>${t.name}</td>
              <td>${t.source_company_name||"--"}</td>
              <td>${t.target_company_name||"--"}</td>
              <td style="font-family:var(--font-en);">${t.source_account_code||"--"}</td>
              <td style="font-family:var(--font-en);">${t.target_account_code||"--"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `}function Zt(e,a){if(a.length===0){e.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:15px;font-size:0.85rem;">لا يوجد سجل مزامنة بعد</div>';return}e.innerHTML=`
    <div class="data-table-wrapper">
      <table class="data-table">
        <thead><tr><th>الشركة</th><th>الحالة</th><th>السجلات</th><th>البداية</th><th>النهاية</th><th>الخطأ</th></tr></thead>
        <tbody>
          ${a.slice(0,20).map(t=>`
            <tr>
              <td>${t.company_name||"--"}</td>
              <td>
                <span class="badge badge-${t.status==="completed"?"success":t.status==="failed"?"danger":"warning"}">
                  ${t.status==="completed"?"✅ مكتمل":t.status==="failed"?"❌ فشل":"⏳ جاري"}
                </span>
              </td>
              <td style="font-family:var(--font-en);">${v(t.records_synced||0)}</td>
              <td style="font-family:var(--font-en);font-size:0.72em;">${t.started_at||""}</td>
              <td style="font-family:var(--font-en);font-size:0.72em;">${t.completed_at||""}</td>
              <td style="font-size:0.72em;color:var(--accent-red);max-width:200px;overflow:hidden;text-overflow:ellipsis;">${t.error_message||""}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `}function Kt(e){ye("إضافة شركة جديدة",`
    <div class="form-group">
      <label class="form-label">اسم الشركة</label>
      <input type="text" class="form-input" id="comp-name" dir="rtl" placeholder="مثال: شركة أبو غالية للتطوير العقاري" />
    </div>
    <div class="form-group">
      <label class="form-label">معرف الشركة في أودو (Company ID)</label>
      <input type="number" class="form-input" id="comp-odoo-id" placeholder="1" dir="ltr" style="font-family:var(--font-en);" />
      <small style="color:var(--text-muted);font-size:0.72rem;">هذا هو الرقم في ?company_id=X في رابط الـ API</small>
    </div>
    <div class="form-group">
      <label class="form-label">اتصال أودو</label>
      <select class="filter-select" id="comp-instance" style="width:100%;"></select>
    </div>
    <div class="form-group">
      <label class="form-label">العملة</label>
      <input type="text" class="form-input" id="comp-currency" value="SAR" dir="ltr" style="font-family:var(--font-en);" />
    </div>
    <div class="form-group">
      <label class="form-label">اللون</label>
      <input type="color" id="comp-color" value="#3b82f6" style="width:50px;height:36px;border:none;cursor:pointer;" />
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:var(--space-lg);">
      <button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.remove('active')">إلغاء</button>
      <button class="btn btn-primary" id="btn-save-company">حفظ</button>
    </div>
  `),f.getInstances().then(a=>{const t=document.getElementById("comp-instance");a.length===0?t.innerHTML="<option disabled>⚠️ أضف اتصال أودو أولاً</option>":t.innerHTML=a.map(s=>`<option value="${s.id}">${s.name} (${s.url})</option>`).join("")}),document.getElementById("btn-save-company").addEventListener("click",async()=>{const a=document.getElementById("comp-name").value,t=parseInt(document.getElementById("comp-odoo-id").value),s=parseInt(document.getElementById("comp-instance").value);if(!a||!t){y("يرجى تعبئة الاسم ومعرف الشركة","warning");return}try{await f.createCompany({name:a,odoo_company_id:t,odoo_instance_id:s,currency:document.getElementById("comp-currency").value||"SAR",color:document.getElementById("comp-color").value}),ve(),y("تم إضافة الشركة بنجاح ✅","success");const r=await f.getCompanies();S.set("companies",r),await ne(e)}catch(r){y("خطأ: "+r.message,"error")}})}function Qt(e){const a=S.get("companies");ye("إضافة قاعدة استبعاد",`
    <div class="form-group">
      <label class="form-label">اسم القاعدة</label>
      <input type="text" class="form-input" id="rule-name" dir="rtl" placeholder="مثل: استبعاد إيرادات المقاولات بين الشركات" />
    </div>
    <div class="form-group">
      <label class="form-label">الشركة المصدر</label>
      <select class="filter-select" id="rule-source" style="width:100%;">
        ${a.map(t=>`<option value="${t.id}">${t.name}</option>`).join("")}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">الشركة الهدف</label>
      <select class="filter-select" id="rule-target" style="width:100%;">
        ${a.map(t=>`<option value="${t.id}">${t.name}</option>`).join("")}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">كود حساب المصدر</label>
      <input type="text" class="form-input" id="rule-src-acc" placeholder="مثل: 4100" dir="ltr" style="font-family:var(--font-en);" />
    </div>
    <div class="form-group">
      <label class="form-label">كود حساب الهدف</label>
      <input type="text" class="form-input" id="rule-tgt-acc" placeholder="مثل: 5100" dir="ltr" style="font-family:var(--font-en);" />
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:var(--space-lg);">
      <button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.remove('active')">إلغاء</button>
      <button class="btn btn-primary" id="btn-save-rule">حفظ</button>
    </div>
  `),document.getElementById("btn-save-rule").addEventListener("click",async()=>{try{await f.createEliminationRule({name:document.getElementById("rule-name").value,source_company_id:parseInt(document.getElementById("rule-source").value),target_company_id:parseInt(document.getElementById("rule-target").value),source_account_code:document.getElementById("rule-src-acc").value,target_account_code:document.getElementById("rule-tgt-acc").value}),ve(),y("تم إضافة القاعدة بنجاح ✅","success"),await ne(e)}catch(t){y("خطأ: "+t.message,"error")}})}let D=0;const $e=50;async function ea(e){const a=S.get("companies");e.innerHTML=`
    <div class="page-header">
      <div>
        <h1 class="page-title">📋 معاينة بيانات الـ API</h1>
        <p class="page-subtitle">عرض البيانات المستوردة من أودو — جميع الأعمدة كما هي من المصدر</p>
      </div>
      <div id="total-badge" style="background:rgba(59,130,246,0.15);color:var(--accent-blue);padding:8px 16px;border-radius:8px;font-weight:600;font-size:0.9rem;"></div>
    </div>

    <!-- Filters -->
    <div class="card" style="margin-bottom:var(--space-lg);padding:var(--space-md);">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:var(--space-md);align-items:end;">
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="font-size:0.75rem;">🔍 بحث</label>
          <input type="text" class="form-input" id="dp-search" placeholder="اسم حساب، كود، شريك..." style="font-size:0.82rem;" />
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="font-size:0.75rem;">🏢 الشركة</label>
          <select class="filter-select" id="dp-company" style="width:100%;">
            <option value="">— الكل —</option>
            ${a.map(t=>`<option value="${t.id}">${t.name}</option>`).join("")}
          </select>
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="font-size:0.75rem;">📂 نوع الحساب</label>
          <select class="filter-select" id="dp-acctype" style="width:100%;">
            <option value="">— الكل —</option>
          </select>
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="font-size:0.75rem;">📅 التاريخ من</label>
          <input type="date" class="form-input" id="dp-datefrom" dir="ltr" style="font-family:var(--font-en);font-size:0.82rem;" />
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:var(--space-md);margin-top:var(--space-md);align-items:end;">
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="font-size:0.75rem;">📅 التاريخ إلى</label>
          <input type="date" class="form-input" id="dp-dateto" dir="ltr" style="font-family:var(--font-en);font-size:0.82rem;" />
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="font-size:0.75rem;">📊 حساب تحليلي</label>
          <select class="filter-select" id="dp-analytic" style="width:100%;">
            <option value="">— الكل —</option>
          </select>
        </div>
        <div></div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-primary btn-sm" id="dp-apply" style="flex:1;">تطبيق</button>
          <button class="btn btn-secondary btn-sm" id="dp-reset">مسح</button>
        </div>
      </div>
    </div>

    <!-- Data Table -->
    <div class="card" style="padding:0;overflow:hidden;">
      <div id="dp-table-wrapper" style="overflow-x:auto;max-height:65vh;overflow-y:auto;">
        <div style="text-align:center;padding:40px;color:var(--text-muted);">جاري التحميل...</div>
      </div>
    </div>

    <!-- Pagination -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:var(--space-md);padding:0 var(--space-sm);">
      <div style="display:flex;gap:8px;">
        <button class="btn btn-secondary btn-sm" id="dp-prev" disabled>→ السابق</button>
        <button class="btn btn-secondary btn-sm" id="dp-next">التالي ←</button>
      </div>
      <div id="dp-page-info" style="color:var(--text-muted);font-size:0.8rem;font-family:var(--font-en);"></div>
    </div>
  `,e.querySelector("#dp-apply").addEventListener("click",()=>{D=0,re(e)}),e.querySelector("#dp-reset").addEventListener("click",()=>{e.querySelector("#dp-search").value="",e.querySelector("#dp-company").value="",e.querySelector("#dp-acctype").value="",e.querySelector("#dp-analytic").value="",e.querySelector("#dp-datefrom").value="",e.querySelector("#dp-dateto").value="",D=0,re(e)}),e.querySelector("#dp-prev").addEventListener("click",()=>{D>0&&(D--,re(e))}),e.querySelector("#dp-next").addEventListener("click",()=>{D++,re(e)}),e.querySelector("#dp-search").addEventListener("keydown",t=>{t.key==="Enter"&&(D=0,re(e))}),D=0,await re(e)}async function re(e){const a=e.querySelector("#dp-search").value.trim(),t=e.querySelector("#dp-company").value,s=e.querySelector("#dp-acctype").value,r=e.querySelector("#dp-analytic").value,n=e.querySelector("#dp-datefrom").value,o=e.querySelector("#dp-dateto").value,l={limit:$e,offset:D*$e};a&&(l.search=a),t&&(l.companyIds=t),s&&(l.accountType=s),r&&(l.analyticAccount=r),n&&(l.dateFrom=n),o&&(l.dateTo=o);try{const d=await f.getJournalItems(l);if(d.accountTypes&&d.accountTypes.length>0){const c=e.querySelector("#dp-acctype"),u=c.value;c.options.length<=1&&(d.accountTypes.forEach(m=>{const p=document.createElement("option");p.value=m,p.textContent=m,c.appendChild(p)}),u&&(c.value=u))}if(d.analyticAccounts&&d.analyticAccounts.length>0){const c=e.querySelector("#dp-analytic"),u=c.value;c.options.length<=1&&(d.analyticAccounts.forEach(m=>{const p=document.createElement("option");p.value=m,p.textContent=m,c.appendChild(p)}),u&&(c.value=u))}e.querySelector("#total-badge").textContent=`إجمالي: ${v(d.total)} سجل`;const i=Math.ceil(d.total/$e);e.querySelector("#dp-prev").disabled=D===0,e.querySelector("#dp-next").disabled=D+1>=i,e.querySelector("#dp-page-info").textContent=`صفحة ${D+1} من ${i||1}`,ta(e.querySelector("#dp-table-wrapper"),d.items)}catch(d){e.querySelector("#dp-table-wrapper").innerHTML=`<div style="padding:20px;color:var(--accent-red);">خطأ: ${d.message}</div>`}}function ta(e,a){if(!a||a.length===0){e.innerHTML='<div style="text-align:center;padding:40px;color:var(--text-muted);">لا توجد بيانات</div>';return}const t=[{key:"company_name",label:"الشركة",type:"text"},{key:"date",label:"التاريخ",type:"date"},{key:"account_code",label:"كود الحساب",type:"code"},{key:"account_name",label:"اسم الحساب",type:"text"},{key:"account_type",label:"نوع الحساب",type:"badge"},{key:"debit",label:"مدين",type:"money"},{key:"credit",label:"دائن",type:"money"},{key:"balance",label:"الرصيد",type:"money"},{key:"partner_name",label:"الشريك",type:"text"},{key:"analytic_account",label:"حساب تحليلي",type:"text"},{key:"label",label:"البيان",type:"text"},{key:"journal_name",label:"اليومية",type:"text"},{key:"move_name",label:"رقم القيد",type:"code"},{key:"move_ref",label:"المرجع",type:"text"},{key:"currency",label:"العملة",type:"code"},{key:"fiscal_year",label:"السنة",type:"code"},{key:"period",label:"الفترة",type:"code"}];e.innerHTML=`
    <table class="data-table" style="font-size:0.78rem;min-width:1800px;">
      <thead>
        <tr>
          <th style="position:sticky;top:0;z-index:2;font-size:0.7rem;white-space:nowrap;">#</th>
          ${t.map(s=>`
            <th style="position:sticky;top:0;z-index:2;font-size:0.7rem;white-space:nowrap;">${s.label}</th>
          `).join("")}
        </tr>
      </thead>
      <tbody>
        ${a.map((s,r)=>`
          <tr>
            <td style="font-family:var(--font-en);color:var(--text-muted);font-size:0.7rem;">${D*$e+r+1}</td>
            ${t.map(n=>aa(s,n)).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `}function aa(e,a){const t=e[a.key];switch(a.type){case"money":return!t||t===0?'<td style="font-family:var(--font-en);color:var(--text-muted);">0</td>':`<td style="font-family:var(--font-en);font-weight:500;color:${t<0?"var(--accent-red)":"var(--text-primary)"};">${v(t,2)}</td>`;case"date":return`<td style="font-family:var(--font-en);font-size:0.75rem;white-space:nowrap;">${t||""}</td>`;case"code":return`<td style="font-family:var(--font-en);font-size:0.75rem;color:var(--accent-blue);">${t||""}</td>`;case"badge":return t?`<td><span style="background:rgba(99,102,241,0.15);color:var(--accent-indigo);padding:2px 6px;border-radius:4px;font-size:0.68rem;white-space:nowrap;">${t}</span></td>`:"<td></td>";default:return`<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${(t||"").toString().replace(/"/g,"&quot;")}">${t||""}</td>`}}async function sa(e){const a=S.get("companies")||[],t=S.get("fiscalYear")||"",s=S.get("dateFrom")||"",r=S.get("dateTo")||"",n=S.get("filterOptions")||{};e.innerHTML=`
    <div class="page-header">
      <div>
        <h1 class="page-title">ميزان المراجعة</h1>
        <p class="page-subtitle">Trial Balance</p>
      </div>
      <div style="display:flex;gap:var(--space-sm);">
        <button class="btn" id="btn-export-pdf" style="display:flex;align-items:center;gap:6px;font-size:0.8rem;background:rgba(239,68,68,0.1);color:var(--accent-red);border-color:rgba(239,68,68,0.2);" disabled>
          📄 تصدير PDF
        </button>
        <button class="btn" id="btn-export-excel" style="display:flex;align-items:center;gap:6px;font-size:0.8rem;background:rgba(16,185,129,0.1);color:var(--accent-emerald);border-color:rgba(16,185,129,0.2);" disabled>
          📊 تصدير Excel
        </button>
        <button class="btn" id="btn-sync-data" style="display:flex;align-items:center;gap:6px;font-size:0.8rem;">
          <span id="sync-icon">🔄</span> تحديث البيانات
        </button>
      </div>
    </div>
    
    <div class="glass-card" style="padding:var(--space-lg);margin-bottom:var(--space-lg);">
      <div style="display:flex;flex-wrap:wrap;gap:var(--space-md);align-items:flex-end;">
        
        <div class="filter-group">
          <span class="filter-label">الشركة</span>
          <select class="filter-select" id="tb-company" style="min-width:220px;">
            ${a.map(o=>`
              <option value="${o.id}">${o.name}</option>
            `).join("")}
          </select>
        </div>

        <div class="filter-group">
          <span class="filter-label">السنة المالية</span>
          <select class="filter-select" id="tb-fiscal-year">
            <option value="">-- اختر --</option>
            ${(n.fiscalYears||[]).map(o=>`
              <option value="${o}" ${t===o?"selected":""}>${o}</option>
            `).join("")}
          </select>
        </div>

        <div class="filter-group">
          <span class="filter-label">من تاريخ</span>
          <input type="date" class="filter-select" id="tb-date-from" value="${s}" />
        </div>
        
        <div class="filter-group">
          <span class="filter-label">إلى تاريخ</span>
          <input type="date" class="filter-select" id="tb-date-to" value="${r}" />
        </div>

        <div class="filter-group">
          <span class="filter-label">مركز التكلفة</span>
          <select class="filter-select" id="tb-cost-center">
            <option value="">الكل</option>
            ${(n.costCenters||[]).map(o=>`
              <option value="${o}">${o}</option>
            `).join("")}
          </select>
        </div>

        <div class="filter-group" style="align-self:flex-end;">
          <button class="btn btn-primary" id="btn-tb-load">عرض الميزان</button>
        </div>
      </div>
      
      <div style="display:flex;flex-wrap:wrap;gap:var(--space-md);align-items:center;margin-top:var(--space-md);padding-top:var(--space-md);border-top:1px solid rgba(255,255,255,0.06);">
        <label style="display:flex;align-items:center;gap:6px;font-size:0.8rem;color:var(--text-secondary);">
          <input type="checkbox" id="chk-tb-zero" /> إخفاء الأرصدة الصفرية
        </label>
      </div>
    </div>

    <div id="tb-content"><p style="text-align:center;color:var(--text-muted);padding:var(--space-xl);">اختر الشركة والفترة ثم اضغط "عرض الميزان"</p></div>
  `,e.querySelector("#tb-fiscal-year").addEventListener("change",o=>{const l=o.target.value;l&&(e.querySelector("#tb-date-from").value=`${l}-01-01`,e.querySelector("#tb-date-to").value=`${l}-12-31`)}),e.querySelector("#btn-tb-load").addEventListener("click",()=>et(e)),e.querySelector("#chk-tb-zero").addEventListener("change",()=>{le&&dt(e)}),e.querySelector("#btn-export-pdf").addEventListener("click",()=>oa(e)),e.querySelector("#btn-export-excel").addEventListener("click",()=>ra(e)),e.querySelector("#btn-sync-data").addEventListener("click",async()=>{var i;const o=e.querySelector("#tb-company").value;if(!o){y("اختر شركة أولاً","error");return}const l=e.querySelector("#btn-sync-data"),d=e.querySelector("#sync-icon");l.disabled=!0,d.style.animation="spin 1s linear infinite",(i=l.querySelector("span:last-child"))==null||i.remove(),l.insertAdjacentHTML("beforeend","<span> جاري المزامنة...</span>");try{if((await(await fetch(`/api/sync/company/${o}`,{method:"POST"})).json()).started){let m=!1;for(;!m;){await new Promise(z=>setTimeout(z,3e3));const x=await(await fetch(`/api/sync/status/${o}`)).json();(x.status==="done"||x.status==="idle"||x.status==="error")&&(m=!0,x.status==="error"?y("خطأ في المزامنة","error"):y(`✅ تم تحديث البيانات — ${x.inserted||""} سجل`,"success"))}const p=e.querySelector("#tb-date-from").value,b=e.querySelector("#tb-date-to").value;p&&b&&et(e)}}catch{y("خطأ في الاتصال","error")}finally{l.disabled=!1,d.style.animation="";const c=l.querySelector("span:last-child");c&&(c.textContent=" تحديث البيانات")}}),t&&(e.querySelector("#tb-date-from").value=`${t}-01-01`,e.querySelector("#tb-date-to").value=`${t}-12-31`)}let le=null;async function et(e){const a=e.querySelector("#tb-company").value,t=e.querySelector("#tb-date-from").value,s=e.querySelector("#tb-date-to").value,r=e.querySelector("#tb-cost-center").value;if(!t||!s){y("يجب اختيار الفترة (من تاريخ - إلى تاريخ)","error");return}const n=e.querySelector("#tb-content");n.innerHTML='<div class="skeleton" style="height:400px;border-radius:var(--radius-lg);"></div>';try{le=await f.getTrialBalance({companyId:a,dateFrom:t,dateTo:s,costCenter:r}),dt(e),e.querySelector("#btn-export-pdf").disabled=!1,e.querySelector("#btn-export-excel").disabled=!1}catch(o){console.error("Trial balance error:",o),y("خطأ في تحميل ميزان المراجعة","error"),n.innerHTML='<p style="text-align:center;color:var(--accent-red);padding:var(--space-xl);">خطأ في التحميل</p>'}}function dt(e){var c,u;const a=e.querySelector("#tb-content");if(!le)return;const t=((c=e.querySelector("#chk-tb-zero"))==null?void 0:c.checked)||!1,s=e.querySelector("#tb-company"),r=((u=s.options[s.selectedIndex])==null?void 0:u.text)||"",n=e.querySelector("#tb-date-from").value,o=e.querySelector("#tb-date-to").value;let l=le.accounts||[];t&&(l=l.filter(m=>Math.abs(m.open_debit)>.001||Math.abs(m.open_credit)>.001||Math.abs(m.period_debit)>.001||Math.abs(m.period_credit)>.001||Math.abs(m.close_debit)>.001||Math.abs(m.close_credit)>.001));const d=l.reduce((m,p)=>({open_debit:m.open_debit+p.open_debit,open_credit:m.open_credit+p.open_credit,period_debit:m.period_debit+p.period_debit,period_credit:m.period_credit+p.period_credit,close_debit:m.close_debit+p.close_debit,close_credit:m.close_credit+p.close_credit}),{open_debit:0,open_credit:0,period_debit:0,period_credit:0,close_debit:0,close_credit:0});Math.abs(d.open_debit-d.open_credit);const i=Math.abs(d.close_debit-d.close_credit);a.innerHTML=`
    <div style="margin-bottom:var(--space-md);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-sm);">
      <div style="display:flex;gap:var(--space-md);align-items:center;">
        <span style="font-size:0.85rem;font-weight:600;color:var(--text-primary);">🏢 ${r}</span>
        <span style="font-size:0.75rem;color:var(--text-muted);">الفترة: ${n} إلى ${o}</span>
        <span style="font-size:0.75rem;color:var(--text-muted);">عدد الحسابات: ${l.length}</span>
      </div>
      <div style="display:flex;gap:var(--space-md);">
        <span style="font-size:0.75rem;color:${i<.01?"var(--accent-emerald)":"var(--accent-red)"};">
          ${i<.01?"✅ الميزان متوازن":`⚠️ فرق الإقفال: ${v(i,2)}`}
        </span>
      </div>
    </div>

    <div class="data-table-wrapper fade-in">
      <table class="data-table" style="font-size:0.78rem;">
        <thead>
          <tr>
            <th rowspan="2" style="min-width:70px;vertical-align:middle;">الكود</th>
            <th rowspan="2" style="min-width:180px;vertical-align:middle;">اسم الحساب</th>
            <th colspan="2" style="text-align:center;border-bottom:2px solid var(--accent-amber);background:rgba(245,158,11,0.08);">الأرصدة الافتتاحية</th>
            <th colspan="2" style="text-align:center;border-bottom:2px solid var(--accent-blue);background:rgba(59,130,246,0.08);">حركة الفترة</th>
            <th colspan="2" style="text-align:center;border-bottom:2px solid var(--accent-emerald);background:rgba(16,185,129,0.08);">رصيد نهاية الفترة</th>
          </tr>
          <tr>
            <th class="number" style="background:rgba(245,158,11,0.04);font-size:0.7rem;">مدين</th>
            <th class="number" style="background:rgba(245,158,11,0.04);font-size:0.7rem;">دائن</th>
            <th class="number" style="background:rgba(59,130,246,0.04);font-size:0.7rem;">مدين</th>
            <th class="number" style="background:rgba(59,130,246,0.04);font-size:0.7rem;">دائن</th>
            <th class="number" style="background:rgba(16,185,129,0.04);font-size:0.7rem;">مدين</th>
            <th class="number" style="background:rgba(16,185,129,0.04);font-size:0.7rem;">دائن</th>
          </tr>
        </thead>
        <tbody>
          ${l.map(m=>{const p=m.account_code==="RE-CALC",b=p?"font-style: italic; background: rgba(59, 130, 246, 0.05);":"",h=p?' <span style="font-size:0.75em; background:var(--primary-subtle, rgba(59,130,246,0.1)); color:var(--primary, #3b82f6); border:1px solid rgba(59,130,246,0.25); border-radius:4px; padding:1px 6px; font-style:normal; margin-right:4px;">محسوب</span>':"";return`
            <tr style="${b}">
              <td style="font-family:var(--font-en);font-size:0.75em;color:var(--accent-blue);">${m.account_code}</td>
              <td>${m.account_name}${h}</td>
              <td class="number">${m.open_debit?v(m.open_debit,2):"-"}</td>
              <td class="number">${m.open_credit?v(m.open_credit,2):"-"}</td>
              <td class="number">${m.period_debit?v(m.period_debit,2):"-"}</td>
              <td class="number">${m.period_credit?v(m.period_credit,2):"-"}</td>
              <td class="number" style="font-weight:600;">${m.close_debit?v(m.close_debit,2):"-"}</td>
              <td class="number" style="font-weight:600;">${m.close_credit?v(m.close_credit,2):"-"}</td>
            </tr>
          `}).join("")}
          <tr class="total-row" style="font-size:0.95em;">
            <td colspan="2" style="font-weight:700;">الإجمالي</td>
            <td class="number" style="font-weight:700;">${v(d.open_debit,2)}</td>
            <td class="number" style="font-weight:700;">${v(d.open_credit,2)}</td>
            <td class="number" style="font-weight:700;">${v(d.period_debit,2)}</td>
            <td class="number" style="font-weight:700;">${v(d.period_credit,2)}</td>
            <td class="number" style="font-weight:700;color:var(--accent-emerald);">${v(d.close_debit,2)}</td>
            <td class="number" style="font-weight:700;color:var(--accent-emerald);">${v(d.close_credit,2)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `}function ct(e){var l,d;if(!le)return null;const a=((l=e.querySelector("#chk-tb-zero"))==null?void 0:l.checked)||!1;let t=le.accounts||[];a&&(t=t.filter(i=>i.open_debit||i.open_credit||i.period_debit||i.period_credit||i.close_debit||i.close_credit));const s=e.querySelector("#tb-company"),r=((d=s.options[s.selectedIndex])==null?void 0:d.text)||"",n=e.querySelector("#tb-date-from").value,o=e.querySelector("#tb-date-to").value;return{items:t,companyName:r,dateFrom:n,dateTo:o}}function ra(e){const a=ct(e);if(!a){y("لا توجد بيانات للتصدير","error");return}try{const{items:t,companyName:s,dateFrom:r,dateTo:n}=a,o=[];o.push([`ميزان المراجعة — ${s}`]),o.push([`الفترة: ${r} → ${n}`]),o.push([]),o.push(["كود الحساب","اسم الحساب","نوع الحساب","رصيد افتتاحي - مدين","رصيد افتتاحي - دائن","حركة الفترة - مدين","حركة الفترة - دائن","رصيد ختامي - مدين","رصيد ختامي - دائن"]);const l={od:0,oc:0,pd:0,pc:0,cd:0,cc:0};for(const u of t)o.push([u.account_code,u.account_name,u.account_type||"",u.open_debit||0,u.open_credit||0,u.period_debit||0,u.period_credit||0,u.close_debit||0,u.close_credit||0]),l.od+=u.open_debit||0,l.oc+=u.open_credit||0,l.pd+=u.period_debit||0,l.pc+=u.period_credit||0,l.cd+=u.close_debit||0,l.cc+=u.close_credit||0;o.push(["","الإجمالي","",l.od,l.oc,l.pd,l.pc,l.cd,l.cc]);const d=XLSX.utils.book_new(),i=XLSX.utils.aoa_to_sheet(o);i["!cols"]=[{wch:14},{wch:40},{wch:20},{wch:18},{wch:18},{wch:18},{wch:18},{wch:18},{wch:18}],i["!merges"]=[{s:{r:0,c:0},e:{r:0,c:8}},{s:{r:1,c:0},e:{r:1,c:8}}];const c="#,##0.00";for(let u=4;u<o.length;u++)for(let m=3;m<=8;m++){const p=XLSX.utils.encode_cell({r:u,c:m});i[p]&&(i[p].t="n",i[p].z=c)}XLSX.utils.book_append_sheet(d,i,"ميزان المراجعة"),XLSX.writeFile(d,`trial_balance_${r}_${n}.xlsx`),y("✅ تم تصدير ملف Excel بنجاح","success")}catch(t){console.error("Excel export error:",t),y("خطأ في تصدير Excel","error")}}async function oa(e){const a=ct(e);if(!a){y("لا توجد بيانات للتصدير","error");return}try{y("⏳ جاري إنشاء PDF...","info");const{items:t,companyName:s,dateFrom:r,dateTo:n}=a,o={od:0,oc:0,pd:0,pc:0,cd:0,cc:0};t.forEach(w=>{o.od+=w.open_debit||0,o.oc+=w.open_credit||0,o.pd+=w.period_debit||0,o.pc+=w.period_credit||0,o.cd+=w.close_debit||0,o.cc+=w.close_credit||0});const l=document.createElement("div");l.style.cssText="position:fixed;top:-99999px;left:0;width:1400px;background:#fff;padding:30px;font-family:Arial,Tahoma,sans-serif;direction:rtl;color:#000;",l.innerHTML=`
      <div style="text-align:center;margin-bottom:20px;">
        <h2 style="margin:0 0 6px;font-size:22px;color:#000;font-weight:900;">ميزان المراجعة</h2>
        <h3 style="margin:0 0 6px;font-size:16px;color:#1e293b;font-weight:700;">${s}</h3>
        <p style="margin:0;font-size:13px;color:#334155;font-weight:600;">الفترة: ${r} → ${n}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;direction:rtl;">
        <thead>
          <tr style="background:#1e293b;color:#fff;">
            <th style="padding:8px 6px;border:1px solid #000;text-align:right;font-size:12px;font-weight:700;">اسم الحساب</th>
            <th style="padding:8px 6px;border:1px solid #000;text-align:center;font-size:12px;font-weight:700;">كود الحساب</th>
            <th style="padding:8px 6px;border:1px solid #000;text-align:center;font-size:12px;font-weight:700;" colspan="2">الرصيد الافتتاحي</th>
            <th style="padding:8px 6px;border:1px solid #000;text-align:center;font-size:12px;font-weight:700;" colspan="2">حركة الفترة</th>
            <th style="padding:8px 6px;border:1px solid #000;text-align:center;font-size:12px;font-weight:700;" colspan="2">الرصيد الختامي</th>
          </tr>
          <tr style="background:#334155;color:#fff;font-size:11px;">
            <th style="padding:5px;border:1px solid #000;"></th>
            <th style="padding:5px;border:1px solid #000;"></th>
            <th style="padding:5px;border:1px solid #000;font-weight:700;">مدين</th>
            <th style="padding:5px;border:1px solid #000;font-weight:700;">دائن</th>
            <th style="padding:5px;border:1px solid #000;font-weight:700;">مدين</th>
            <th style="padding:5px;border:1px solid #000;font-weight:700;">دائن</th>
            <th style="padding:5px;border:1px solid #000;font-weight:700;">مدين</th>
            <th style="padding:5px;border:1px solid #000;font-weight:700;">دائن</th>
          </tr>
        </thead>
        <tbody>
          ${t.map((w,_)=>`
            <tr style="background:${_%2===0?"#fff":"#f1f5f9"};">
              <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:right;color:#000;font-weight:500;">${w.account_name||""}</td>
              <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:center;color:#000;font-family:monospace;font-weight:600;">${w.account_code}</td>
              <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:left;color:#000;font-family:monospace;">${R(w.open_debit)}</td>
              <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:left;color:#000;font-family:monospace;">${R(w.open_credit)}</td>
              <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:left;color:#000;font-family:monospace;">${R(w.period_debit)}</td>
              <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:left;color:#000;font-family:monospace;">${R(w.period_credit)}</td>
              <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:left;color:#000;font-family:monospace;">${R(w.close_debit)}</td>
              <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:left;color:#000;font-family:monospace;">${R(w.close_credit)}</td>
            </tr>
          `).join("")}
          <tr style="background:#1e293b;color:#fff;font-weight:700;">
            <td style="padding:6px 8px;border:1px solid #000;text-align:right;font-size:13px;" colspan="2">الإجمالي</td>
            <td style="padding:6px 8px;border:1px solid #000;text-align:left;font-family:monospace;">${R(o.od)}</td>
            <td style="padding:6px 8px;border:1px solid #000;text-align:left;font-family:monospace;">${R(o.oc)}</td>
            <td style="padding:6px 8px;border:1px solid #000;text-align:left;font-family:monospace;">${R(o.pd)}</td>
            <td style="padding:6px 8px;border:1px solid #000;text-align:left;font-family:monospace;">${R(o.pc)}</td>
            <td style="padding:6px 8px;border:1px solid #000;text-align:left;font-family:monospace;">${R(o.cd)}</td>
            <td style="padding:6px 8px;border:1px solid #000;text-align:left;font-family:monospace;">${R(o.cc)}</td>
          </tr>
        </tbody>
      </table>
      <div style="text-align:center;margin-top:14px;font-size:10px;color:#64748b;font-weight:600;">
        Mizaniat BI | تم الإنشاء: ${new Date().toLocaleString("ar-SA")}
      </div>
    `,document.body.appendChild(l);const d=await rt(l,{scale:3,useCORS:!0,backgroundColor:"#ffffff"});document.body.removeChild(l);const i=new ot({orientation:"landscape",unit:"mm",format:"a4"}),c=i.internal.pageSize.getWidth(),u=i.internal.pageSize.getHeight(),m=15,p=12,b=10,h=c-b*2,x=u-m-p,z=h,$=d.height/d.width*z,g=d.toDataURL("image/png");if($<=x)i.addImage(g,"PNG",b,m,z,$);else{const w=Math.ceil(($+5)/x);for(let _=0;_<w;_++){_>0&&i.addPage();const q=m-_*x;i.addImage(g,"PNG",b,q,z,$),i.setFillColor(255,255,255),i.rect(0,0,c,m,"F"),_===w-1?i.rect(0,u-5,c,5,"F"):i.rect(0,u-p,c,p,"F"),i.setFontSize(8),i.setTextColor(150),i.text(`${_+1} / ${w}`,c/2,u-1.5,{align:"center"})}}i.save(`trial_balance_${r}_${n}.pdf`),y("✅ تم تصدير ملف PDF بنجاح","success")}catch(t){console.error("PDF export error:",t),y("خطأ في تصدير PDF: "+t.message,"error")}}function R(e){return!e||e===0?"-":Number(e).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}let ie=null,te={},K=[];async function na(e){const a=S.get("companies")||[],t=S.get("fiscalYear")||"",s=S.get("dateFrom")||"",r=S.get("dateTo")||"",n=S.get("filterOptions")||{};e.innerHTML=`
    <div class="page-header">
      <div>
        <h1 class="page-title">ميزان المراجعة التفصيلي</h1>
        <p class="page-subtitle">Trial Balance — مع تفصيل الشركاء</p>
      </div>
      <div style="display:flex;gap:var(--space-sm);">
        <button class="btn" id="btn-dtb-config" style="display:flex;align-items:center;gap:6px;font-size:0.8rem;">
          ⚙️ إعداد الحسابات
        </button>
        <button class="btn" id="btn-dtb-pdf" style="display:flex;align-items:center;gap:6px;font-size:0.8rem;background:rgba(239,68,68,0.1);color:var(--accent-red);border-color:rgba(239,68,68,0.2);" disabled>
          📄 PDF
        </button>
        <button class="btn" id="btn-dtb-excel" style="display:flex;align-items:center;gap:6px;font-size:0.8rem;background:rgba(16,185,129,0.1);color:var(--accent-emerald);border-color:rgba(16,185,129,0.2);" disabled>
          📊 Excel
        </button>
      </div>
    </div>
    
    <!-- Config panel (hidden by default) -->
    <div id="dtb-config-panel" class="glass-card" style="padding:var(--space-lg);margin-bottom:var(--space-lg);display:none;border:1px solid rgba(245,158,11,0.2);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md);">
        <h3 style="margin:0;color:var(--accent-amber);font-size:0.95rem;">⚙️ إعداد حسابات التفصيل لكل شركة</h3>
        <button class="btn" id="btn-close-config" style="font-size:0.75rem;">✕ إغلاق</button>
      </div>
      <p style="color:var(--text-muted);font-size:0.8rem;margin-bottom:var(--space-md);">حدد الحسابات الأربعة (ذمم مدينة، ذمم دائنة، عهد موظفين، سلف موظفين) لكل شركة. هذه الحسابات ستظهر بتفصيل الشركاء عند عرض الميزان.</p>
      <div id="dtb-config-content"><p style="color:var(--text-muted);text-align:center;">اختر شركة أولاً</p></div>
    </div>

    <div class="glass-card" style="padding:var(--space-lg);margin-bottom:var(--space-lg);">
      <div style="display:flex;flex-wrap:wrap;gap:var(--space-md);align-items:flex-end;">
        <div class="filter-group">
          <span class="filter-label">الشركة</span>
          <select class="filter-select" id="dtb-company" style="min-width:220px;">
            ${a.map(o=>`<option value="${o.id}">${o.name}</option>`).join("")}
          </select>
        </div>
        <div class="filter-group">
          <span class="filter-label">السنة المالية</span>
          <select class="filter-select" id="dtb-fiscal-year">
            <option value="">-- اختر --</option>
            ${(n.fiscalYears||[]).map(o=>`
              <option value="${o}" ${t===o?"selected":""}>${o}</option>
            `).join("")}
          </select>
        </div>
        <div class="filter-group">
          <span class="filter-label">من تاريخ</span>
          <input type="date" class="filter-select" id="dtb-date-from" value="${s}" />
        </div>
        <div class="filter-group">
          <span class="filter-label">إلى تاريخ</span>
          <input type="date" class="filter-select" id="dtb-date-to" value="${r}" />
        </div>
        <div class="filter-group">
          <span class="filter-label">مركز التكلفة</span>
          <select class="filter-select" id="dtb-cost-center">
            <option value="">الكل</option>
            ${(n.costCenters||[]).map(o=>`<option value="${o}">${o}</option>`).join("")}
          </select>
        </div>
        <div class="filter-group" style="align-self:flex-end;">
          <button class="btn btn-primary" id="btn-dtb-load">عرض الميزان</button>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:var(--space-md);align-items:center;margin-top:var(--space-md);padding-top:var(--space-md);border-top:1px solid rgba(255,255,255,0.06);">
        <label style="display:flex;align-items:center;gap:6px;font-size:0.8rem;color:var(--text-secondary);">
          <input type="checkbox" id="chk-dtb-zero" /> إخفاء الأرصدة الصفرية
        </label>
        <span id="dtb-account-badges" style="display:flex;gap:4px;flex-wrap:wrap;"></span>
        <span style="color:var(--text-muted);font-size:0.7rem;margin-right:auto;">💡 اضغط على الحسابات المُلونة لعرض تفاصيل الشركاء</span>
      </div>
    </div>

    <div id="dtb-content"><p style="text-align:center;color:var(--text-muted);padding:var(--space-xl);">اختر الشركة والفترة ثم اضغط "عرض الميزان"</p></div>
  `,e.querySelector("#dtb-fiscal-year").addEventListener("change",o=>{const l=o.target.value;l&&(e.querySelector("#dtb-date-from").value=`${l}-01-01`,e.querySelector("#dtb-date-to").value=`${l}-12-31`)}),e.querySelector("#dtb-company").addEventListener("change",()=>He(e)),e.querySelector("#btn-dtb-load").addEventListener("click",()=>ia(e)),e.querySelector("#chk-dtb-zero").addEventListener("change",()=>{ie&&pt(e)}),e.querySelector("#btn-dtb-pdf").addEventListener("click",()=>ca(e)),e.querySelector("#btn-dtb-excel").addEventListener("click",()=>da(e)),e.querySelector("#btn-dtb-config").addEventListener("click",()=>{const o=e.querySelector("#dtb-config-panel");o.style.display=o.style.display==="none"?"":"none",o.style.display!=="none"&&la(e)}),e.querySelector("#btn-close-config").addEventListener("click",()=>{e.querySelector("#dtb-config-panel").style.display="none"}),t&&(e.querySelector("#dtb-date-from").value=`${t}-01-01`,e.querySelector("#dtb-date-to").value=`${t}-12-31`),await He(e)}async function He(e){const a=e.querySelector("#dtb-company").value;try{const t=await f.getPartnerAccountConfig({companyId:a});K=(t.configs||[]).map(r=>r.account_code);const s=e.querySelector("#dtb-account-badges");K.length>0?s.innerHTML=K.map(r=>{const n=t.configs.find(o=>o.account_code===r);return`<span style="font-size:0.7rem;background:rgba(59,130,246,0.15);color:var(--accent-blue);padding:2px 8px;border-radius:var(--radius-sm);">${r}${n!=null&&n.account_name?" — "+n.account_name:""}</span>`}).join(""):s.innerHTML='<span style="font-size:0.7rem;color:var(--accent-amber);">⚠️ لم يتم إعداد حسابات التفصيل — اضغط "إعداد الحسابات"</span>'}catch(t){console.error("Config load error:",t),K=[]}}async function la(e){var s;const a=e.querySelector("#dtb-company").value,t=e.querySelector("#dtb-config-content");t.innerHTML='<div class="skeleton" style="height:200px;"></div>';try{const r=await f.getPartnerAccountConfig({companyId:a}),{configs:n,categories:o,labels:l,availableAccounts:d}=r,i={};for(const m of n)i[m.account_category]=m;const c=e.querySelector("#dtb-company"),u=((s=c.options[c.selectedIndex])==null?void 0:s.text)||"";t.innerHTML=`
      <h4 style="color:var(--text-white);margin:0 0 var(--space-md);font-size:0.85rem;">📌 ${u}</h4>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:var(--space-md);">
        ${o.map(m=>{const p=i[m];return`
            <div style="background:rgba(255,255,255,0.03);border-radius:var(--radius-md);padding:var(--space-md);border:1px solid rgba(255,255,255,0.06);">
              <label style="font-size:0.8rem;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:6px;">${l[m]}</label>
              <select class="filter-select config-select" data-category="${m}" style="width:100%;font-size:0.8rem;">
                <option value="">-- اختر الحساب --</option>
                ${d.map(b=>`
                  <option value="${b.account_code}" data-name="${b.account_name}" ${(p==null?void 0:p.account_code)===b.account_code?"selected":""}>${b.account_code} — ${b.account_name}</option>
                `).join("")}
              </select>
            </div>
          `}).join("")}
      </div>
      <div style="margin-top:var(--space-md);display:flex;gap:var(--space-sm);">
        <button class="btn btn-primary" id="btn-save-config" style="font-size:0.8rem;">💾 حفظ الإعدادات</button>
      </div>
    `,e.querySelector("#btn-save-config").addEventListener("click",async()=>{const m=e.querySelectorAll(".config-select"),p=[];m.forEach(b=>{var x;const h=b.options[b.selectedIndex];p.push({category:b.dataset.category,account_code:b.value,account_name:((x=h==null?void 0:h.dataset)==null?void 0:x.name)||""})});try{await f.savePartnerAccountConfig({companyId:a,mappings:p}),y("✅ تم حفظ إعدادات الحسابات","success"),await He(e)}catch{y("خطأ في الحفظ","error")}})}catch{t.innerHTML='<p style="color:var(--accent-red);">خطأ في تحميل الإعدادات</p>'}}async function ia(e){const a=e.querySelector("#dtb-company").value,t=e.querySelector("#dtb-date-from").value,s=e.querySelector("#dtb-date-to").value,r=e.querySelector("#dtb-cost-center").value;if(!t||!s){y("يجب اختيار الفترة","error");return}const n=e.querySelector("#dtb-content");n.innerHTML='<div class="skeleton" style="height:400px;border-radius:var(--radius-lg);"></div>';try{const o=[f.getTrialBalance({companyId:a,dateFrom:t,dateTo:s,costCenter:r})];K.length>0&&o.push(f.getDetailedTrialBalance({companyId:a,dateFrom:t,dateTo:s,accountCodes:K.join(",")}));const[l,d]=await Promise.all(o);if(ie=l,te={},d!=null&&d.accounts)for(const i of d.accounts)te[i.account_code]||(te[i.account_code]=[]),te[i.account_code].push(i);pt(e),e.querySelector("#btn-dtb-pdf").disabled=!1,e.querySelector("#btn-dtb-excel").disabled=!1}catch(o){console.error("Load error:",o),y("خطأ في تحميل الميزان","error"),n.innerHTML='<p style="text-align:center;color:var(--accent-red);padding:var(--space-xl);">خطأ في التحميل</p>'}}function pt(e){var d,i;const a=e.querySelector("#dtb-content");if(!ie)return;const t=((d=e.querySelector("#chk-dtb-zero"))==null?void 0:d.checked)||!1,s=e.querySelector("#dtb-company"),r=((i=s.options[s.selectedIndex])==null?void 0:i.text)||"";let n=ie.accounts||[];t&&(n=n.filter(c=>c.open_debit||c.open_credit||c.period_debit||c.period_credit||c.close_debit||c.close_credit));const o={od:0,oc:0,pd:0,pc:0,cd:0,cc:0};let l="";for(let c=0;c<n.length;c++){const u=n[c];o.od+=u.open_debit||0,o.oc+=u.open_credit||0,o.pd+=u.period_debit||0,o.pc+=u.period_credit||0,o.cd+=u.close_debit||0,o.cc+=u.close_credit||0;const m=K.includes(u.account_code),p=te[u.account_code]||[],b=m&&p.length>0;if(l+=`
      <tr class="${b?"expandable-row":""}" data-code="${u.account_code}"
          style="${b?"cursor:pointer;":""}${c%2===0?"":"background:rgba(255,255,255,0.015);"}">
        <td style="font-family:var(--font-en);font-weight:500;${b?"color:var(--accent-blue);":""}">${u.account_code}</td>
        <td style="${b?"color:var(--accent-blue);font-weight:600;":""}">
          ${b?'<span class="expand-icon" style="display:inline-block;transition:transform 0.2s;margin-left:4px;font-size:0.7rem;">▶</span>':""}
          ${u.account_name}
          ${b?`<span style="font-size:0.65rem;color:var(--text-muted);margin-right:6px;">(${p.length} شريك)</span>`:""}
        </td>
        <td class="number">${v(u.open_debit,2)}</td>
        <td class="number">${v(u.open_credit,2)}</td>
        <td class="number">${v(u.period_debit,2)}</td>
        <td class="number">${v(u.period_credit,2)}</td>
        <td class="number">${v(u.close_debit,2)}</td>
        <td class="number">${v(u.close_credit,2)}</td>
      </tr>
    `,b)for(const h of p){const x=(h.close_debit||0)-(h.close_credit||0);l+=`
          <tr class="partner-detail-row" data-parent="${u.account_code}" style="display:none;background:rgba(59,130,246,0.03);">
            <td style="color:var(--text-muted);font-size:0.75rem;"></td>
            <td style="padding-right:36px;color:var(--text-secondary);font-size:0.8rem;">↳ ${h.partner_name}</td>
            <td class="number" style="font-size:0.8rem;">${v(h.open_debit,2)}</td>
            <td class="number" style="font-size:0.8rem;">${v(h.open_credit,2)}</td>
            <td class="number" style="font-size:0.8rem;">${v(h.period_debit,2)}</td>
            <td class="number" style="font-size:0.8rem;">${v(h.period_credit,2)}</td>
            <td class="number" style="font-size:0.8rem;color:${x>=0?"var(--accent-emerald)":"var(--accent-red)"};">${v(h.close_debit,2)}</td>
            <td class="number" style="font-size:0.8rem;color:${x>=0?"var(--accent-emerald)":"var(--accent-red)"};">${v(h.close_credit,2)}</td>
          </tr>
        `}}a.innerHTML=`
    <div class="glass-card" style="padding:var(--space-md);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md);">
        <h3 style="color:var(--text-white);margin:0;font-size:0.95rem;">${r}</h3>
        <span style="color:var(--text-muted);font-size:0.75rem;">${n.length} حساب</span>
      </div>
      <div class="table-container">
        <table class="data-table" style="font-size:0.82rem;">
          <thead>
            <tr>
              <th style="min-width:80px;">كود</th>
              <th style="text-align:right;min-width:200px;">اسم الحساب</th>
              <th class="number" colspan="2" style="text-align:center;background:rgba(59,130,246,0.06);">الرصيد الافتتاحي</th>
              <th class="number" colspan="2" style="text-align:center;background:rgba(245,158,11,0.06);">حركة الفترة</th>
              <th class="number" colspan="2" style="text-align:center;background:rgba(16,185,129,0.06);">الرصيد الختامي</th>
            </tr>
            <tr style="font-size:0.75rem;color:var(--text-muted);">
              <th></th><th></th>
              <th class="number">مدين</th><th class="number">دائن</th>
              <th class="number">مدين</th><th class="number">دائن</th>
              <th class="number">مدين</th><th class="number">دائن</th>
            </tr>
          </thead>
          <tbody>${l}</tbody>
          <tfoot>
            <tr style="font-weight:700;background:rgba(255,255,255,0.04);">
              <td colspan="2" style="text-align:right;">الإجمالي</td>
              <td class="number">${v(o.od,2)}</td>
              <td class="number">${v(o.oc,2)}</td>
              <td class="number">${v(o.pd,2)}</td>
              <td class="number">${v(o.pc,2)}</td>
              <td class="number">${v(o.cd,2)}</td>
              <td class="number">${v(o.cc,2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `,a.querySelectorAll(".expandable-row").forEach(c=>{c.addEventListener("click",()=>{var h;const u=c.dataset.code,m=c.querySelector(".expand-icon"),p=a.querySelectorAll(`.partner-detail-row[data-parent="${u}"]`),b=((h=p[0])==null?void 0:h.style.display)!=="none";p.forEach(x=>x.style.display=b?"none":""),m&&(m.style.transform=b?"":"rotate(90deg)")})})}function ut(e){var n,o;if(!ie)return null;const a=((n=e.querySelector("#chk-dtb-zero"))==null?void 0:n.checked)||!1;let t=ie.accounts||[];a&&(t=t.filter(l=>l.open_debit||l.open_credit||l.period_debit||l.period_credit||l.close_debit||l.close_credit));const s=e.querySelector("#dtb-company"),r=((o=s.options[s.selectedIndex])==null?void 0:o.text)||"";return{items:t,companyName:r,dateFrom:e.querySelector("#dtb-date-from").value,dateTo:e.querySelector("#dtb-date-to").value}}function da(e){const a=ut(e);if(!a)return y("لا توجد بيانات","error");try{const{items:t,companyName:s,dateFrom:r,dateTo:n}=a,o=[];o.push([`ميزان المراجعة التفصيلي — ${s}`]),o.push([`الفترة: ${r} → ${n}`]),o.push([]),o.push(["كود","الحساب","الشريك","افتتاحي مدين","افتتاحي دائن","حركة مدين","حركة دائن","ختامي مدين","ختامي دائن"]);for(const u of t){o.push([u.account_code,u.account_name,"",u.open_debit||0,u.open_credit||0,u.period_debit||0,u.period_credit||0,u.close_debit||0,u.close_credit||0]);const m=te[u.account_code];if(m)for(const p of m)o.push(["","",p.partner_name,p.open_debit||0,p.open_credit||0,p.period_debit||0,p.period_credit||0,p.close_debit||0,p.close_credit||0])}const l={od:0,oc:0,pd:0,pc:0,cd:0,cc:0};for(const u of t)l.od+=u.open_debit||0,l.oc+=u.open_credit||0,l.pd+=u.period_debit||0,l.pc+=u.period_credit||0,l.cd+=u.close_debit||0,l.cc+=u.close_credit||0;o.push(["","الإجمالي","",l.od,l.oc,l.pd,l.pc,l.cd,l.cc]);const d=XLSX.utils.book_new(),i=XLSX.utils.aoa_to_sheet(o);i["!cols"]=[{wch:12},{wch:35},{wch:35},{wch:16},{wch:16},{wch:16},{wch:16},{wch:16},{wch:16}],i["!merges"]=[{s:{r:0,c:0},e:{r:0,c:8}},{s:{r:1,c:0},e:{r:1,c:8}}];const c="#,##0.00";for(let u=4;u<o.length;u++)for(let m=3;m<=8;m++){const p=XLSX.utils.encode_cell({r:u,c:m});i[p]&&typeof i[p].v=="number"&&(i[p].t="n",i[p].z=c)}XLSX.utils.book_append_sheet(d,i,"ميزان تفصيلي"),XLSX.writeFile(d,`detailed_trial_balance_${r}_${n}.xlsx`),y("✅ تم تصدير Excel","success")}catch(t){console.error(t),y("خطأ في التصدير","error")}}async function ca(e){const a=ut(e);if(!a)return y("لا توجد بيانات","error");try{y("⏳ جاري إنشاء PDF...","info");const{items:t,companyName:s,dateFrom:r,dateTo:n}=a,o=k=>!k||k===0?"-":Number(k).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});let l="",d=0;for(const k of t){const L=K.includes(k.account_code),M=d%2===0?"#fff":"#f1f5f9";l+=`<tr style="background:${L?"#eef2ff":M};">
        <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:center;font-family:monospace;font-weight:${L?"700":"500"};color:${L?"#2563eb":"#000"};">${k.account_code}</td>
        <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:right;font-weight:${L?"700":"500"};color:${L?"#2563eb":"#000"};">${k.account_name}</td>
        <td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:left;font-family:monospace;color:#000;">${o(k.open_debit)}</td>
        <td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:left;font-family:monospace;color:#000;">${o(k.open_credit)}</td>
        <td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:left;font-family:monospace;color:#000;">${o(k.period_debit)}</td>
        <td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:left;font-family:monospace;color:#000;">${o(k.period_credit)}</td>
        <td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:left;font-family:monospace;color:#000;">${o(k.close_debit)}</td>
        <td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:left;font-family:monospace;color:#000;">${o(k.close_credit)}</td>
      </tr>`,d++;const j=te[k.account_code];if(j)for(const I of j)l+=`<tr style="background:#f8fafc;">
          <td style="padding:3px;border:1px solid #e2e8f0;"></td>
          <td style="padding:3px 8px;border:1px solid #e2e8f0;text-align:right;font-size:10px;color:#475569;padding-right:20px;">↳ ${I.partner_name}</td>
          <td style="padding:3px 6px;border:1px solid #e2e8f0;text-align:left;font-family:monospace;font-size:10px;color:#475569;">${o(I.open_debit)}</td>
          <td style="padding:3px 6px;border:1px solid #e2e8f0;text-align:left;font-family:monospace;font-size:10px;color:#475569;">${o(I.open_credit)}</td>
          <td style="padding:3px 6px;border:1px solid #e2e8f0;text-align:left;font-family:monospace;font-size:10px;color:#475569;">${o(I.period_debit)}</td>
          <td style="padding:3px 6px;border:1px solid #e2e8f0;text-align:left;font-family:monospace;font-size:10px;color:#475569;">${o(I.period_credit)}</td>
          <td style="padding:3px 6px;border:1px solid #e2e8f0;text-align:left;font-family:monospace;font-size:10px;color:#475569;">${o(I.close_debit)}</td>
          <td style="padding:3px 6px;border:1px solid #e2e8f0;text-align:left;font-family:monospace;font-size:10px;color:#475569;">${o(I.close_credit)}</td>
        </tr>`}let i={od:0,oc:0,pd:0,pc:0,cd:0,cc:0};for(const k of t)i.od+=k.open_debit||0,i.oc+=k.open_credit||0,i.pd+=k.period_debit||0,i.pc+=k.period_credit||0,i.cd+=k.close_debit||0,i.cc+=k.close_credit||0;l+=`<tr style="background:#1e293b;color:#fff;font-weight:700;">
      <td style="padding:6px 8px;border:1px solid #000;" colspan="2" align="right">الإجمالي</td>
      <td style="padding:6px;border:1px solid #000;text-align:left;font-family:monospace;">${o(i.od)}</td>
      <td style="padding:6px;border:1px solid #000;text-align:left;font-family:monospace;">${o(i.oc)}</td>
      <td style="padding:6px;border:1px solid #000;text-align:left;font-family:monospace;">${o(i.pd)}</td>
      <td style="padding:6px;border:1px solid #000;text-align:left;font-family:monospace;">${o(i.pc)}</td>
      <td style="padding:6px;border:1px solid #000;text-align:left;font-family:monospace;">${o(i.cd)}</td>
      <td style="padding:6px;border:1px solid #000;text-align:left;font-family:monospace;">${o(i.cc)}</td>
    </tr>`;const c=document.createElement("div");c.style.cssText="position:fixed;top:-99999px;left:0;width:1400px;background:#fff;padding:30px;font-family:Arial,Tahoma,sans-serif;direction:rtl;color:#000;",c.innerHTML=`
      <div style="text-align:center;margin-bottom:20px;">
        <h2 style="margin:0 0 6px;font-size:22px;color:#000;font-weight:900;">ميزان المراجعة التفصيلي</h2>
        <h3 style="margin:0 0 6px;font-size:16px;color:#1e293b;font-weight:700;">${s}</h3>
        <p style="margin:0;font-size:13px;color:#334155;font-weight:600;">الفترة: ${r} → ${n}</p>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:11px;direction:rtl;">
        <thead>
          <tr style="background:#1e293b;color:#fff;">
            <th style="padding:7px;border:1px solid #000;">كود</th>
            <th style="padding:7px;border:1px solid #000;text-align:right;">الحساب</th>
            <th style="padding:7px;border:1px solid #000;" colspan="2">الرصيد الافتتاحي</th>
            <th style="padding:7px;border:1px solid #000;" colspan="2">حركة الفترة</th>
            <th style="padding:7px;border:1px solid #000;" colspan="2">الرصيد الختامي</th>
          </tr>
          <tr style="background:#334155;color:#fff;font-size:10px;">
            <th style="padding:4px;border:1px solid #000;"></th><th style="padding:4px;border:1px solid #000;"></th>
            <th style="padding:4px;border:1px solid #000;">مدين</th><th style="padding:4px;border:1px solid #000;">دائن</th>
            <th style="padding:4px;border:1px solid #000;">مدين</th><th style="padding:4px;border:1px solid #000;">دائن</th>
            <th style="padding:4px;border:1px solid #000;">مدين</th><th style="padding:4px;border:1px solid #000;">دائن</th>
          </tr>
        </thead>
        <tbody>${l}</tbody>
      </table>
      <div style="text-align:center;margin-top:14px;font-size:10px;color:#64748b;">Mizaniat BI | ${new Date().toLocaleString("ar-SA")}</div>
    `,document.body.appendChild(c);const u=await rt(c,{scale:3,useCORS:!0,backgroundColor:"#fff"});document.body.removeChild(c);const m=new ot({orientation:"landscape",unit:"mm",format:"a4"}),p=m.internal.pageSize.getWidth(),b=m.internal.pageSize.getHeight(),h=15,x=12,z=10,$=p-z*2,g=b-h-x,w=$,_=u.height/u.width*w,q=u.toDataURL("image/png");if(_<=g)m.addImage(q,"PNG",z,h,w,_);else{const k=Math.ceil((_+5)/g);for(let L=0;L<k;L++){L>0&&m.addPage(),m.addImage(q,"PNG",z,h-L*g,w,_),m.setFillColor(255,255,255),m.rect(0,0,p,h,"F");const M=L===k-1;M?m.rect(0,b-5,p,5,"F"):m.rect(0,b-x,p,x,"F"),m.setFontSize(8),m.setTextColor(150),m.text(`${L+1} / ${k}`,p/2,b-(M?1.5:4),{align:"center"})}}m.save(`detailed_trial_balance_${r}_${n}.pdf`),y("✅ تم تصدير PDF","success")}catch(t){console.error(t),y("خطأ: "+t.message,"error")}}async function pa(e){const a=S.get("companies")||[];e.innerHTML=`
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
            ${a.map(t=>`<option value="${t.id}">${t.name}</option>`).join("")}
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
  `,e.querySelector("#btn-ce-load").addEventListener("click",()=>Be(e)),Be(e)}async function Be(e){const a=e.querySelector("#ce-content"),t=e.querySelector("#ce-company").value;a.innerHTML='<div class="skeleton" style="height:200px;border-radius:var(--radius-lg);"></div>';try{const s=await f.getClosingEntries({companyId:t});ua(e,s.entries||[])}catch(s){console.error("Error loading closing entries:",s),a.innerHTML='<p style="text-align:center;color:var(--accent-red);padding:var(--space-xl);">خطأ في تحميل القيود</p>'}}function ua(e,a){const t=e.querySelector("#ce-content");if(a.length===0){t.innerHTML=`
      <div class="glass-card" style="padding:var(--space-xl);text-align:center;">
        <div style="font-size:2rem;margin-bottom:var(--space-md);">📋</div>
        <div style="color:var(--text-muted);font-size:0.9rem;">لا توجد قيود إقفال حالياً</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:var(--space-sm);">
          يمكنك إنشاء قيود إقفال من صفحة <strong>ميزان المراجعة</strong>
        </div>
      </div>
    `;return}t.innerHTML=a.map(s=>{const r=s.lines||[];return`
    <div class="glass-card fade-in" style="padding:var(--space-lg);margin-bottom:var(--space-lg);border:1px solid rgba(245,158,11,0.15);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md);flex-wrap:wrap;gap:var(--space-sm);">
        <div style="display:flex;gap:var(--space-md);align-items:center;">
          <span style="font-size:1.2rem;">🔒</span>
          <div>
            <div style="font-weight:700;color:var(--text-primary);font-size:0.95rem;">
              قيد إقفال ${s.fiscal_year}
            </div>
            <div style="font-size:0.75rem;color:var(--text-muted);">
              🏢 ${s.company_name||"شركة "+s.company_id} — 
              الفترة: ${s.date_from} إلى ${s.date_to} —
              حساب الإقفال: <strong>${s.target_account} - ${s.target_account_name}</strong>
            </div>
            <div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px;">
              📅 تاريخ الإنشاء: ${s.created_at||"-"}
            </div>
          </div>
        </div>
        <div style="display:flex;gap:var(--space-sm);">
          <span style="font-size:0.75rem;padding:4px 10px;border-radius:var(--radius-sm);background:rgba(16,185,129,0.1);color:var(--accent-emerald);">
            ${r.length} سطر
          </span>
          <button class="btn btn-delete-ce" 
            data-company="${s.company_id}" data-year="${s.fiscal_year}"
            style="font-size:0.75rem;padding:4px 12px;background:rgba(239,68,68,0.1);color:var(--accent-red);border:1px solid rgba(239,68,68,0.2);cursor:pointer;">
            🗑️ حذف
          </button>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:var(--space-md);margin-bottom:var(--space-md);">
        <div style="background:rgba(59,130,246,0.06);padding:var(--space-sm) var(--space-md);border-radius:var(--radius-sm);">
          <div style="font-size:0.7rem;color:var(--text-muted);">إجمالي المدين</div>
          <div style="font-weight:700;color:var(--text-primary);font-family:var(--font-en);">${v(s.total_debit,2)}</div>
        </div>
        <div style="background:rgba(59,130,246,0.06);padding:var(--space-sm) var(--space-md);border-radius:var(--radius-sm);">
          <div style="font-size:0.7rem;color:var(--text-muted);">إجمالي الدائن</div>
          <div style="font-weight:700;color:var(--text-primary);font-family:var(--font-en);">${v(s.total_credit,2)}</div>
        </div>
        <div style="background:${Math.abs(s.total_debit-s.total_credit)<.01?"rgba(16,185,129,0.06)":"rgba(239,68,68,0.06)"};padding:var(--space-sm) var(--space-md);border-radius:var(--radius-sm);">
          <div style="font-size:0.7rem;color:var(--text-muted);">الفرق</div>
          <div style="font-weight:700;color:${Math.abs(s.total_debit-s.total_credit)<.01?"var(--accent-emerald)":"var(--accent-red)"};font-family:var(--font-en);">${v(Math.abs(s.total_debit-s.total_credit),2)}</div>
        </div>
      </div>

      <details>
        <summary style="cursor:pointer;font-size:0.8rem;color:var(--accent-blue);padding:var(--space-sm) 0;">
          📄 عرض تفاصيل القيد (${r.length} سطر)
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
              ${r.map(n=>`
                <tr${n.account_code===s.target_account?' style="background:rgba(16,185,129,0.08);font-weight:600;"':""}>
                  <td style="font-family:var(--font-en);color:var(--accent-blue);">${n.account_code}</td>
                  <td>${n.account_name}</td>
                  <td style="font-size:0.7rem;color:var(--text-muted);">${n.account_type||"-"}</td>
                  <td class="number">${n.debit?v(n.debit,2):"-"}</td>
                  <td class="number">${n.credit?v(n.credit,2):"-"}</td>
                </tr>
              `).join("")}
              <tr class="total-row">
                <td colspan="3" style="font-weight:700;">الإجمالي</td>
                <td class="number" style="font-weight:700;">${v(r.reduce((n,o)=>n+(o.debit||0),0),2)}</td>
                <td class="number" style="font-weight:700;">${v(r.reduce((n,o)=>n+(o.credit||0),0),2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </div>
  `}).join(""),t.querySelectorAll(".btn-delete-ce").forEach(s=>{s.addEventListener("click",async()=>{const r=s.dataset.company,n=s.dataset.year;if(confirm(`هل تريد حذف قيد إقفال ${n}؟ سيتم إزالته من قاعدة البيانات.`))try{const o=await f.deleteClosingEntry({companyId:r,fiscalYear:n});y(`✅ تم حذف قيد الإقفال — ${n}`,"success"),Be(e)}catch(o){console.error("Delete error:",o),y("خطأ في حذف القيد","error")}})})}const mt=["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#06b6d4","#84cc16","#f97316","#6366f1"];let X=[],ae=[],Pe=[],gt=[];async function ma(e){const a=S.get("companies")||[];e.innerHTML=`
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
        <div class="filter-group" style="flex: 1; min-width: 200px; max-width: 100%;">
          <span class="filter-label">الشركة</span>
          <select class="filter-select" id="aa-company" style="width: 100%;">
            ${a.map(s=>`<option value="${s.id}">${s.name}</option>`).join("")}
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
            ${mt.map((s,r)=>`
              <label style="cursor:pointer;">
                <input type="radio" name="group-color" value="${s}" style="display:none;" ${r===0?"checked":""} />
                <span style="display:block;width:28px;height:28px;border-radius:50%;background:${s};border:3px solid transparent;transition:border-color 0.2s;" class="color-dot" data-color="${s}"></span>
              </label>
            `).join("")}
          </div>
        </div>
        <div style="display:flex;gap:var(--space-sm);justify-content:flex-end;">
          <button class="btn" id="btn-cancel-modal" style="font-size:0.8rem;">إلغاء</button>
          <button class="btn btn-primary" id="btn-confirm-modal" style="font-size:0.8rem;">حفظ</button>
        </div>
        <input type="hidden" id="edit-group-id" value="" />
      </div>
    </div>
  `,e.querySelectorAll(".color-dot").forEach(s=>{s.addEventListener("click",()=>{e.querySelectorAll(".color-dot").forEach(r=>r.style.borderColor="transparent"),s.style.borderColor="#fff"})});const t=e.querySelector(".color-dot");t&&(t.style.borderColor="#fff"),e.querySelector("#btn-add-group").addEventListener("click",()=>bt(e)),e.querySelector("#btn-cancel-modal").addEventListener("click",()=>Re(e)),e.querySelector("#btn-confirm-modal").addEventListener("click",()=>ba(e)),e.querySelector("#btn-load-accounts").addEventListener("click",()=>yt(e)),e.querySelector("#btn-save-mappings").addEventListener("click",()=>ya(e)),e.querySelector("#group-modal").addEventListener("click",s=>{s.target.id==="group-modal"&&Re(e)}),await Ve(e)}async function Ve(e){try{X=await f.getAnalyticGroups(),ga(e)}catch(a){console.error("Load groups error:",a)}}function ga(e){const a=e.querySelector("#groups-list");if(!X.length){a.innerHTML='<p style="color:var(--text-muted);font-size:0.8rem;">لا توجد مجموعات — أنشئ مجموعة جديدة لبدء التصنيف</p>';return}a.innerHTML=X.map(t=>`
    <div class="group-chip" data-id="${t.id}" style="
      display:flex;align-items:center;gap:8px;padding:8px 14px;
      background:rgba(255,255,255,0.04);border-radius:var(--radius-md);
      border:1px solid ${t.color}33;cursor:default;
    ">
      <span style="width:12px;height:12px;border-radius:50%;background:${t.color};flex-shrink:0;"></span>
      <span style="color:var(--text-white);font-size:0.85rem;font-weight:500;">${t.name}</span>
      <button class="btn-edit-group" data-id="${t.id}" style="
        background:none;border:none;color:var(--text-muted);cursor:pointer;
        font-size:0.7rem;padding:2px 4px;margin-right:4px;
      ">✏️</button>
      <button class="btn-delete-group" data-id="${t.id}" style="
        background:none;border:none;color:var(--accent-red);cursor:pointer;
        font-size:0.7rem;padding:2px 4px;opacity:0.6;
      ">✕</button>
    </div>
  `).join(""),a.querySelectorAll(".btn-edit-group").forEach(t=>{t.addEventListener("click",()=>{const s=X.find(r=>r.id==t.dataset.id);s&&bt(e,s)})}),a.querySelectorAll(".btn-delete-group").forEach(t=>{t.addEventListener("click",async()=>{if(confirm("هل تريد حذف هذه المجموعة؟ سيتم إلغاء ربط جميع الحسابات المرتبطة بها."))try{await f.deleteAnalyticGroup(t.dataset.id),y("تم حذف المجموعة","success"),await Ve(e),ae.length&&Je(e)}catch{y("خطأ في الحذف","error")}})})}function bt(e,a=null){const t=e.querySelector("#group-modal");t.style.display="flex",e.querySelector("#modal-title").textContent=a?"تعديل المجموعة":"مجموعة جديدة",e.querySelector("#group-name").value=a?a.name:"",e.querySelector("#edit-group-id").value=a?a.id:"";const s=a?a.color:mt[0];e.querySelectorAll(".color-dot").forEach(n=>{n.style.borderColor=n.dataset.color===s?"#fff":"transparent"});const r=e.querySelector(`input[name="group-color"][value="${s}"]`);r&&(r.checked=!0),e.querySelector("#group-name").focus()}function Re(e){e.querySelector("#group-modal").style.display="none"}async function ba(e){var r;const a=e.querySelector("#group-name").value.trim(),t=((r=e.querySelector('input[name="group-color"]:checked'))==null?void 0:r.value)||"#3b82f6",s=e.querySelector("#edit-group-id").value;if(!a){y("أدخل اسم المجموعة","error");return}try{s?(await f.updateAnalyticGroup(s,{name:a,color:t}),y("✅ تم تعديل المجموعة","success")):(await f.createAnalyticGroup({name:a,color:t}),y("✅ تم إنشاء المجموعة","success")),Re(e),await Ve(e),ae.length&&Je(e)}catch{y("خطأ في الحفظ","error")}}async function yt(e){const a=e.querySelector("#aa-company").value,t=e.querySelector("#accounts-content");t.innerHTML='<div class="skeleton" style="height:300px;"></div>';try{const[s,r,n]=await Promise.all([f.getAnalyticAccounts({companyId:a}),f.getAnalyticGroupMappings({companyId:a}),f.getCompanyJournalNames(a)]);ae=s,Pe=r,gt=n||[],Je(e),e.querySelector("#btn-save-mappings").disabled=!1}catch(s){console.error("Load accounts error:",s),t.innerHTML='<p style="color:var(--accent-red);text-align:center;">خطأ في تحميل الحسابات</p>'}}function Je(e){var p;const a=e.querySelector("#accounts-content"),t=e.querySelector("#aa-company"),s=((p=t.options[t.selectedIndex])==null?void 0:p.text)||"";if(!ae.length){a.innerHTML='<p style="text-align:center;color:var(--text-muted);padding:var(--space-lg);">لا توجد حسابات تحليلية لهذه الشركة</p>';return}const r={},n={},o={};for(const b of Pe)r[b.analytic_account]=b.group_id,n[b.analytic_account]=b.redistributable?1:0,o[b.analytic_account]=b.journal_name||"";const l={};for(const b of Pe)l[b.group_id]=(l[b.group_id]||0)+1;const d=ae.filter(b=>!r[b.analytic_account]).length,i=X.map(b=>`<option value="${b.id}">${b.name}</option>`).join(""),c=gt.map(b=>`<option value="${b}">${b}</option>`).join("");a.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md);">
      <h4 style="margin:0;color:var(--text-white);font-size:0.9rem;">📊 ${s} — ${ae.length} حساب تحليلي</h4>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${X.map(b=>`
          <span style="font-size:0.7rem;padding:3px 10px;border-radius:var(--radius-sm);background:${b.color}22;color:${b.color};border:1px solid ${b.color}44;">
            ${b.name}: ${l[b.id]||0}
          </span>
        `).join("")}
        <span style="font-size:0.7rem;padding:3px 10px;border-radius:var(--radius-sm);background:rgba(255,255,255,0.05);color:var(--text-muted);border:1px solid rgba(255,255,255,0.1);">
          غير مصنف: ${d}
        </span>
      </div>
    </div>
    <div style="margin-bottom:var(--space-md);display:flex;flex-wrap:wrap;gap:var(--space-sm);">
      <button class="btn btn-assign-all" data-group="" style="font-size:0.72rem;padding:4px 10px;">إلغاء الكل</button>
      ${X.map(b=>`
        <button class="btn btn-assign-all" data-group="${b.id}" style="font-size:0.72rem;padding:4px 10px;background:${b.color}15;color:${b.color};border-color:${b.color}33;">
          تعيين الكل → ${b.name}
        </button>
      `).join("")}
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
            <th style="width:160px;text-align:center;">اسم اليومية</th>
            <th style="width:140px;text-align:center;">قابل لإعادة التوزيع</th>
          </tr>
        </thead>
        <tbody>
          ${ae.map((b,h)=>{const x=r[b.analytic_account]||"",z=n[b.analytic_account]||0,$=o[b.analytic_account]||"",g=X.find(w=>w.id==x);return`
              <tr style="${g?`border-right:3px solid ${g.color};`:""}">
                <td style="text-align:center;"><input type="checkbox" class="aa-row-check" value="${b.analytic_account}" style="cursor:pointer;" /></td>
                <td style="color:var(--text-muted);font-size:0.75rem;">${h+1}</td>
                <td style="font-weight:500;">${b.analytic_account}</td>
                <td style="text-align:center;color:var(--text-muted);">
                  <span style="background:rgba(255,255,255,0.05);padding:2px 10px;border-radius:var(--radius-sm);font-size:0.75rem;">
                    ${b.transaction_count}
                  </span>
                </td>
                <td style="text-align:center;">
                  <select class="filter-select account-group-select" data-account="${b.analytic_account}" style="font-size:0.78rem;padding:4px 8px;width:100%;">
                    <option value="">— غير مصنف —</option>
                    ${i.replace(`value="${x}"`,`value="${x}" selected`)}
                  </select>
                </td>
                <td style="text-align:center;">
                  <select class="filter-select account-journal-select" data-account="${b.analytic_account}" style="font-size:0.78rem;padding:4px 8px;width:100%;">
                    <option value="">— غير محدد —</option>
                    ${c.replace(`value="${$}"`,`value="${$}" selected`)}
                  </select>
                </td>
                <td style="text-align:center;">
                  <select class="filter-select account-redist-select" data-account="${b.analytic_account}" style="font-size:0.78rem;padding:4px 8px;width:100%;">
                    <option value="0"${z?"":" selected"}>لا</option>
                    <option value="1"${z?" selected":""}>نعم</option>
                  </select>
                </td>
              </tr>
            `}).join("")}
        </tbody>
      </table>
    </div>
  `;const u=a.querySelector("#check-all-aa"),m=a.querySelectorAll(".aa-row-check");u&&u.addEventListener("change",b=>{m.forEach(h=>{h.checked=b.target.checked})}),a.querySelectorAll(".btn-assign-all").forEach(b=>{b.addEventListener("click",()=>{const h=b.dataset.group;let x=Array.from(m).filter(z=>z.checked);if(x.length===0){if(!confirm("لم يتم تحديد أي حسابات. هل تريد تطبيق هذه المجموعة على جميع الحسابات في الجدول؟"))return;a.querySelectorAll(".account-group-select").forEach(z=>{z.value=h,z.dispatchEvent(new Event("change"))})}else{const z=x.map($=>$.value);a.querySelectorAll(".account-group-select").forEach($=>{z.includes($.dataset.account)&&($.value=h,$.dispatchEvent(new Event("change")))}),u&&(u.checked=!1),m.forEach($=>$.checked=!1)}})}),a.querySelectorAll(".account-group-select").forEach(b=>{b.addEventListener("change",()=>{const h=X.find(z=>z.id==b.value),x=b.closest("tr");x.style.borderRight=h?`3px solid ${h.color}`:""})})}async function ya(e){const a=e.querySelector("#aa-company").value,t=e.querySelectorAll(".account-group-select"),s=e.querySelectorAll(".account-redist-select"),r=e.querySelectorAll(".account-journal-select"),n=[],o={},l={};s.forEach(d=>{o[d.dataset.account]=parseInt(d.value)||0}),r.forEach(d=>{l[d.dataset.account]=d.value||null}),t.forEach(d=>{d.value&&n.push({analytic_account:d.dataset.account,group_id:parseInt(d.value),redistributable:o[d.dataset.account]||0,journal_name:l[d.dataset.account]||null})});try{await f.saveAnalyticGroupMappings({companyId:a,mappings:n}),y("✅ تم حفظ التصنيف بنجاح","success"),await yt(e)}catch(d){console.error("Save mappings error:",d),y("خطأ في حفظ التصنيف","error")}}let ue=[],_e=null;async function va(e){const a=S.get("companies")||[];if(!a.length){e.innerHTML='<p style="text-align:center;color:var(--text-muted);padding:var(--space-2xl);">يرجى إضافة شركة أولاً.</p>';return}_e=a[0].id,e.innerHTML=`
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
            ${a.map(s=>`<option value="${s.id}">${s.name}</option>`).join("")}
          </select>
        </div>
      </div>
      
      <div id="journal-content">
        <div class="skeleton" style="height:300px;border-radius:var(--radius-md);"></div>
      </div>
    </div>
  `,e.querySelector("#jm-company").addEventListener("change",s=>{_e=parseInt(s.target.value),De(e)}),await De(e)}async function De(e){const a=e.querySelector("#journal-content");a.innerHTML='<div class="skeleton" style="height:300px;border-radius:var(--radius-md);"></div>';try{ue=(await f.getJournalMappings(_e)).journals||[],fa(e,a)}catch(t){console.error("Error loading journals:",t),a.innerHTML=`<p style="text-align:center;color:var(--accent-red);">خطأ في تحميل أسماء اليوميات<br><small style="color:rgba(255,100,100,0.6);">${t.message}</small></p>`}}function fa(e,a){if(!ue.length){a.innerHTML='<p style="text-align:center;color:var(--text-muted);padding:var(--space-xl);">لا توجد يوميات لهذه الشركة.</p>';return}const s=ue.map(c=>c.journal_name).map(c=>`<option value="${c}">`).join("");a.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md);padding-bottom:var(--space-sm);border-bottom:1px solid rgba(255,255,255,0.05);">
        <h4 style="margin:0;font-size:0.95rem;color:var(--text-white);">🎯 تحديد ودمج الأسماء</h4>
        <span style="font-size:0.8rem;color:var(--text-muted);">إجمالي اليوميات المختلفة: ${ue.length}</span>
    </div>

    <!-- Merge controls -->
    <div style="background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.05);padding:var(--space-md);border-radius:var(--radius-md);margin-bottom:var(--space-lg);display:flex;flex-wrap:wrap;gap:var(--space-md);align-items:flex-end;">
      <div style="flex:1;">
        <label style="display:block;font-size:0.8rem;color:var(--text-secondary);margin-bottom:6px;">الاسم الموحد الجديد (Target Name)</label>
        <input type="text" id="target-journal-name" list="journal-list" class="filter-select" style="width:100%;" placeholder="اختر من القائمة أو اكتب اسماً جديداً...">
        <datalist id="journal-list">
          ${s}
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
          ${ue.map((c,u)=>`
            <tr>
              <td style="text-align:center;">
                <input type="checkbox" class="row-checkbox" value="${c.journal_name}" style="cursor:pointer;" />
              </td>
              <td style="color:var(--text-muted);font-size:0.8rem;">${u+1}</td>
              <td style="font-weight:500;">
                <span style="cursor:pointer;" class="clickable-name" data-val="${c.journal_name}">${c.journal_name}</span>
              </td>
              <td style="text-align:center;color:var(--text-muted);">
                <span style="background:rgba(255,255,255,0.05);padding:2px 10px;border-radius:var(--radius-sm);font-size:0.8rem;">
                  ${c.count}
                </span>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
    
    <div style="margin-top:var(--space-md);font-size:0.8rem;color:var(--text-secondary);line-height:1.6;">
      <p>💡 <b>ملاحظة:</b> لتسهيل عملية الدمج، يمكنك الضغط على أي اسم يومية في الجدول لنسخه كاسم موحد في الحقل أعلاه.</p>
    </div>
  `;const r=a.querySelector("#check-all"),n=a.querySelectorAll(".row-checkbox"),o=a.querySelector("#selected-count"),l=a.querySelector("#btn-merge");function d(){const c=Array.from(n).filter(u=>u.checked).length;o.textContent=c,l.disabled=c===0,r.checked=c===n.length&&c>0}r.addEventListener("change",c=>{n.forEach(u=>{u.checked=c.target.checked}),d()}),n.forEach(c=>{c.addEventListener("change",d)});const i=a.querySelector("#target-journal-name");a.querySelectorAll(".clickable-name").forEach(c=>{c.addEventListener("click",()=>{i.value=c.dataset.val})}),l.addEventListener("click",async()=>{const c=Array.from(n).filter(p=>p.checked).map(p=>p.value),u=i.value.trim();if(!u){y("يرجى تحديد إسم موحد لدمج اليوميات المختارة","error"),i.focus();return}if(c.length===0||!confirm(`هل أنت متأكد من دمج ${c.length} يومية في اسم واحد: "${u}"؟
سوف يتم تحديث جميع القيود المرتبطة فوراً.`))return;const m=l.innerHTML;l.innerHTML='<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span> جاري الدمج...',l.disabled=!0;try{await f.mergeJournals({companyId:_e,sourceNames:c,targetName:u}),y("✅ تم توحيد اليوميات بنجاح","success"),await De(e)}catch(p){console.error(p),y(p.message||"خطأ في عملية الدمج","error"),l.innerHTML=m,d()}})}const W=e=>v(e,2);async function ha(e){const a=S.get("companies")||[],s=(S.get("filterOptions")||{}).fiscalYears||[],r=s[s.length-1]||new Date().getFullYear().toString();e.innerHTML=`
    <style>
      .as-page{padding:20px 24px;max-width:1500px;margin:0 auto;direction:rtl}
      .as-header{display:flex;align-items:center;gap:14px;margin-bottom:18px}
      .as-header h1{font-size:1.5rem;font-weight:800;color:#e2e8f0;margin:0}
      .as-header .as-badge{font-size:0.78rem;color:#94a3b8;background:rgba(148,163,184,0.1);padding:4px 12px;border-radius:20px;border:1px solid rgba(148,163,184,0.15)}

      .as-filters{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;margin-bottom:18px;padding:16px 18px;background:linear-gradient(135deg,rgba(30,41,59,0.7),rgba(30,41,59,0.4));border:1px solid rgba(100,116,139,0.2);border-radius:14px;backdrop-filter:blur(8px)}
      .as-filter{display:flex;flex-direction:column;gap:4px;flex:0 0 auto}
      .as-filter label{font-size:0.78rem;color:#94a3b8;font-weight:600;letter-spacing:0.02em}
      .as-filter select,.as-filter input[type="date"],.as-filter input[type="text"]{background:rgba(15,23,42,0.6);border:1px solid rgba(100,116,139,0.25);color:#e2e8f0;padding:8px 12px;border-radius:8px;font-size:0.88rem;font-family:inherit;transition:border-color 0.2s}
      .as-filter select{min-width:170px}
      .as-filter select:focus,.as-filter input:focus{outline:none;border-color:#8b5cf6;box-shadow:0 0 0 2px rgba(139,92,246,0.15)}
      .as-filter select option{background:#1e293b;color:#e2e8f0}

      .as-actions{display:flex;gap:8px;align-items:flex-end;margin-right:auto}
      .as-btn{padding:8px 18px;border-radius:10px;border:none;cursor:pointer;font-size:0.85rem;font-weight:700;font-family:inherit;transition:all 0.2s;white-space:nowrap}
      .as-btn-primary{background:linear-gradient(135deg,#8b5cf6,#6d28d9);color:#fff;box-shadow:0 2px 8px rgba(139,92,246,0.25)}
      .as-btn-primary:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(139,92,246,0.35)}
      .as-btn-print{background:rgba(16,185,129,0.1);color:#34d399;border:1px solid rgba(16,185,129,0.2)}
      .as-btn-print:hover{background:rgba(16,185,129,0.18)}
      .as-btn-excel{background:rgba(59,130,246,0.1);color:#60a5fa;border:1px solid rgba(59,130,246,0.2)}
      .as-btn-excel:hover{background:rgba(59,130,246,0.18)}

      .as-info{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px}
      .as-info-card{background:linear-gradient(135deg,rgba(30,41,59,0.6),rgba(30,41,59,0.3));border:1px solid rgba(100,116,139,0.15);border-radius:10px;padding:12px 16px}
      .as-info-label{font-size:0.75rem;color:#64748b;margin-bottom:3px;font-weight:600}
      .as-info-value{font-size:1rem;font-weight:700;color:#e2e8f0;font-family:var(--font-en)}
      .as-info-value.ar{font-family:inherit}
      .as-info-value .nature{font-size:0.7rem;color:#94a3b8;margin-right:6px}

      .as-table-wrap{overflow-x:auto;border-radius:12px;border:1px solid rgba(100,116,139,0.15);background:rgba(15,23,42,0.3)}
      .as-table{width:100%;border-collapse:collapse;font-size:0.88rem}
      .as-table th{background:rgba(139,92,246,0.12);color:#c4b5fd;font-weight:700;padding:10px 12px;text-align:right;white-space:nowrap;border-bottom:2px solid rgba(139,92,246,0.2);font-size:0.82rem;letter-spacing:0.02em}
      .as-table td{padding:8px 12px;border-bottom:1px solid rgba(100,116,139,0.08);color:#cbd5e1;font-size:0.88rem}
      .as-table tbody tr:nth-child(even){background:rgba(255,255,255,0.015)}
      .as-table tbody tr:hover{background:rgba(139,92,246,0.04)}
      .as-table .num{text-align:left;font-family:var(--font-en);font-weight:600;direction:ltr;white-space:nowrap}
      .as-table .debit-val{color:#f87171}
      .as-table .credit-val{color:#34d399}
      .as-table .bal-pos{color:#34d399;font-weight:700}
      .as-table .bal-neg{color:#f87171;font-weight:700}
      .as-row-opening{background:rgba(59,130,246,0.08)!important}
      .as-row-opening td{color:#93c5fd;font-weight:700;font-size:0.9rem}
      .as-row-closing{background:rgba(139,92,246,0.1)!important}
      .as-row-closing td{color:#c4b5fd;font-weight:800;font-size:0.92rem}
      .as-row-totals{background:rgba(245,158,11,0.08)!important}
      .as-row-totals td{color:#fbbf24;font-weight:700}
      .as-empty{text-align:center;padding:50px 20px;color:#64748b;font-size:1.05rem}
      .as-count{font-size:0.75rem;color:#64748b;margin-top:8px;text-align:left;font-family:var(--font-en)}

      @media print{
        *{color:#000!important;background:#fff!important}
        body *{visibility:hidden}
        .as-print-area,.as-print-area *{visibility:visible}
        .as-print-area{position:absolute;left:0;top:0;width:100%;padding:15px;direction:rtl}
        .as-filters,.as-actions,.as-btn,.no-print,#sidebar,#sidebar-toggle{display:none!important}
        .as-table{border:1px solid #999}
        .as-table th{background:#eee!important;color:#333!important;border:1px solid #ccc;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        .as-table td{border:1px solid #ddd;color:#111!important}
        .as-info-card{border:1px solid #ccc;padding:8px 12px}
        .as-info-label{color:#666!important}
        .as-info-value{color:#000!important}
        .as-row-opening td,.as-row-closing td,.as-row-totals td{color:#000!important}
        .as-table .debit-val,.as-table .credit-val,.as-table .bal-pos,.as-table .bal-neg{color:#000!important}
        .as-header h1{color:#000!important}
      }
    </style>
    <div class="as-page as-print-area">
      <div class="as-header">
        <h1>📄 كشف حساب</h1>
        <span class="as-badge">Account Statement</span>
      </div>

      <div class="as-filters no-print">
        <div class="as-filter">
          <label>🏢 الشركة</label>
          <select id="as-company">
            <option value="">اختر شركة</option>
            ${a.map(i=>`<option value="${i.id}">${i.name}</option>`).join("")}
          </select>
        </div>
        <div class="as-filter">
          <label>📋 الحساب</label>
          <input type="text" id="as-account" list="as-account-list" placeholder="ابحث عن حساب..." autocomplete="off" style="min-width:280px">
          <datalist id="as-account-list"></datalist>
        </div>
        <div class="as-filter">
          <label>👤 الشريك / العميل</label>
          <select id="as-partner" style="min-width:200px">
            <option value="">الكل</option>
          </select>
        </div>
        <div class="as-filter">
          <label>📅 من</label>
          <input type="date" id="as-from" value="${r}-01-01">
        </div>
        <div class="as-filter">
          <label>📅 إلى</label>
          <input type="date" id="as-to" value="${r}-12-31">
        </div>
        <div class="as-actions">
          <button class="as-btn as-btn-primary" id="as-load">📊 عرض</button>
          <button class="as-btn as-btn-print" id="as-print" style="display:none">🖨️ طباعة</button>
          <button class="as-btn as-btn-excel" id="as-export" style="display:none">📥 Excel</button>
        </div>
      </div>

      <div id="as-result">
        <div class="as-empty">اختر شركة وحساب ثم اضغط "عرض"</div>
      </div>
    </div>
  `;const n=e.querySelector("#as-account"),o=e.querySelector("#as-account-list"),l=e.querySelector("#as-partner");let d=[];e.querySelector("#as-company").addEventListener("change",async i=>{const c=i.target.value;if(n.value="",o.innerHTML="",l.innerHTML='<option value="">الكل</option>',!!c)try{const[u,m]=await Promise.all([f.getAccountStatementAccounts({companyId:c}),f.getAccountStatementPartners({companyId:c})]);d=u,o.innerHTML=u.map(p=>`<option value="${p.account_code} — ${p.account_name}"></option>`).join(""),l.innerHTML='<option value="">الكل ('+m.length+")</option>"+m.map(p=>`<option value="${p}">${p}</option>`).join("")}catch{y("خطأ في تحميل البيانات","error")}}),e.querySelector("#as-load").addEventListener("click",()=>xa(e)),e.querySelector("#as-print").addEventListener("click",()=>window.print()),e.querySelector("#as-export").addEventListener("click",()=>wa(e))}let Fe=null,Oe=null;async function xa(e){const a=e.querySelector("#as-company").value,s=e.querySelector("#as-account").value.split("—")[0].split(" — ")[0].trim(),r=e.querySelector("#as-from").value,n=e.querySelector("#as-to").value,o=e.querySelector("#as-partner").value,l=e.querySelector("#as-result");if(!a||!s){y("اختر شركة وحساب","warning");return}l.innerHTML='<div class="as-empty">⏳ جاري تحميل الكشف...</div>';try{const d=await f.getAccountStatement({companyId:a,accountCode:s,dateFrom:r,dateTo:n});Fe=d,$a(e,d,r,n,o),e.querySelector("#as-print").style.display="",e.querySelector("#as-export").style.display=""}catch(d){l.innerHTML=`<div class="as-empty" style="color:#f87171">❌ ${d.message}</div>`}}function $a(e,a,t,s,r){const n=e.querySelector("#as-result"),{company:o,account:l,openingBalance:d,items:i,closingBalance:c}=a;let u=i;r&&(u=i.filter($=>$.partner_name===r));let m=d;u=u.map($=>(m+=($.debit||0)-($.credit||0),{...$,runningBalance:m}));const p=u.reduce(($,g)=>$+(g.debit||0),0),b=u.reduce(($,g)=>$+(g.credit||0),0),h=d+p-b;Oe={filtered:u,totalDebit:p,totalCredit:b,closingBalance:h};const x=$=>$>=0?"bal-pos":"bal-neg",z=$=>$>0?"مدين":$<0?"دائن":"متزن";n.innerHTML=`
    <div class="as-info">
      <div class="as-info-card">
        <div class="as-info-label">الشركة</div>
        <div class="as-info-value ar">${o.name}</div>
      </div>
      <div class="as-info-card">
        <div class="as-info-label">الحساب</div>
        <div class="as-info-value ar" style="font-size:0.9rem">${l.account_code} — ${l.account_name}</div>
      </div>
      <div class="as-info-card">
        <div class="as-info-label">الفترة</div>
        <div class="as-info-value">${t||"—"} → ${s||"—"}</div>
      </div>
      <div class="as-info-card">
        <div class="as-info-label">الحركات</div>
        <div class="as-info-value">${u.length}${r?` <span class="nature">من ${i.length}</span>`:""}</div>
      </div>
      <div class="as-info-card" style="border-color:rgba(139,92,246,0.3)">
        <div class="as-info-label">الرصيد النهائي</div>
        <div class="as-info-value ${x(h)}" style="font-size:1.15rem">${W(Math.abs(h))} <span class="nature">${z(h)}</span></div>
      </div>
    </div>

    <div class="as-table-wrap">
      <table class="as-table" id="as-data-table">
        <thead>
          <tr>
            <th style="width:40px">#</th>
            <th>التاريخ</th>
            <th>رقم القيد</th>
            <th>البيان</th>
            <th>الطرف / الشريك</th>
            <th>مدين</th>
            <th>دائن</th>
            <th>الرصيد</th>
          </tr>
        </thead>
        <tbody>
          <tr class="as-row-opening">
            <td></td>
            <td colspan="4" style="text-align:center">📌 الرصيد الافتتاحي</td>
            <td class="num"></td>
            <td class="num"></td>
            <td class="num ${x(d)}">${W(Math.abs(d))} <small>${z(d)}</small></td>
          </tr>
          ${u.length===0?'<tr><td colspan="8" class="as-empty" style="padding:30px">لا توجد حركات</td></tr>':""}
          ${u.map(($,g)=>`
            <tr>
              <td style="color:#475569;font-size:0.78rem;text-align:center">${g+1}</td>
              <td style="white-space:nowrap;font-family:var(--font-en);color:#94a3b8;font-size:0.85rem">${$.date}</td>
              <td style="font-family:var(--font-en);font-size:0.82rem;color:#818cf8">${$.move_name||""}</td>
              <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis">${$.label||$.move_ref||"—"}</td>
              <td style="font-size:0.85rem;color:#94a3b8">${$.partner_name||""}</td>
              <td class="num ${$.debit?"debit-val":""}">${$.debit?W($.debit):""}</td>
              <td class="num ${$.credit?"credit-val":""}">${$.credit?W($.credit):""}</td>
              <td class="num ${x($.runningBalance)}">${W(Math.abs($.runningBalance))}</td>
            </tr>
          `).join("")}
          <tr class="as-row-totals">
            <td></td>
            <td colspan="4" style="text-align:center">📊 إجمالي الحركات</td>
            <td class="num" style="font-size:0.95rem">${W(p)}</td>
            <td class="num" style="font-size:0.95rem">${W(b)}</td>
            <td class="num"></td>
          </tr>
          <tr class="as-row-closing">
            <td></td>
            <td colspan="4" style="text-align:center">📌 الرصيد الختامي</td>
            <td class="num"></td>
            <td class="num"></td>
            <td class="num ${x(h)}" style="font-size:1.05rem">${W(Math.abs(h))} <small>${z(h)}</small></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="as-count">${u.length} rows · ${o.currency||"SAR"}</div>
  `}function wa(e){if(!Fe||!Oe)return;const{company:a,account:t,openingBalance:s}=Fe,{filtered:r,totalDebit:n,totalCredit:o,closingBalance:l}=Oe,d=e.querySelector("#as-from").value,i=e.querySelector("#as-to").value;let c="\uFEFF";c+=`كشف حساب — ${a.name}
`,c+=`الحساب: ${t.account_code} — ${t.account_name}
`,c+=`الفترة: ${d} إلى ${i}

`,c+=`#,التاريخ,رقم القيد,البيان,الطرف,مدين,دائن,الرصيد
`,c+=`,,,الرصيد الافتتاحي,,,,"${s}"
`,r.forEach((b,h)=>{const x=(b.label||b.move_ref||"").replace(/"/g,'""'),z=(b.partner_name||"").replace(/"/g,'""');c+=`${h+1},"${b.date}","${b.move_name||""}","${x}","${z}",${b.debit||0},${b.credit||0},${b.runningBalance}
`}),c+=`,,,,إجمالي الحركات,${n},${o},
`,c+=`,,,,الرصيد الختامي,,,"${l}"
`;const u=new Blob([c],{type:"text/csv;charset=utf-8;"}),m=URL.createObjectURL(u),p=document.createElement("a");p.href=m,p.download=`كشف_حساب_${t.account_code}_${d}_${i}.csv`,p.click(),URL.revokeObjectURL(m),y("✅ تم تصدير الكشف","success")}const Q=e=>v(e,2);async function ka(e){e.innerHTML=`
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
        <span><span class="gr-dot" style="background:#fbbf24"></span> مفرج تلقائياً (قيد مطابق)</span>
        <span><span class="gr-dot" style="background:#facc15"></span> استثناء / تعليم يدوي</span>
        <span><span class="gr-dot" style="background:#a78bfa"></span> تفصيل يدوي</span>
      </div>
      <div id="gr-content">
        <div class="gr-empty">⏳ جاري تحميل الضمانات...</div>
      </div>
    </div>
  `,await be(e)}async function be(e){const a=e.querySelector("#gr-content"),t=e.querySelector("#gr-stats");try{const s=await f.getGuarantees({});if(!s||!s.length){a.innerHTML='<div class="gr-empty">لا توجد ضمانات بنكية</div>',t.innerHTML="";return}for(const i of s)for(const c of i.items)try{c.subItems=await f.getGuaranteeSubItems({companyId:i.companyId,accountCode:c.account_code,moveName:c.move_name})}catch{c.subItems=[]}let r=0,n=0,o=0,l=0;s.forEach(i=>i.items.forEach(c=>{c.subItems&&c.subItems.length>0?c.subItems.forEach(u=>{u.is_released?(n++,l+=Math.abs(u.amount)):(r++,o+=Math.abs(u.amount))}):c.is_released?(n++,l+=Math.abs(c.balance)):(r++,o+=Math.abs(c.balance))})),t.innerHTML=`
      <div class="gr-stat"><div class="gr-stat-label">معلّقة</div><div class="gr-stat-value" style="color:#60a5fa">${r}</div></div>
      <div class="gr-stat"><div class="gr-stat-label">مبلغ معلّق</div><div class="gr-stat-value" style="color:#60a5fa">${Q(o)}</div></div>
      <div class="gr-stat"><div class="gr-stat-label">مفرج عنها</div><div class="gr-stat-value" style="color:#fbbf24">${n}</div></div>
      <div class="gr-stat"><div class="gr-stat-label">مبلغ مفرج</div><div class="gr-stat-value" style="color:#fbbf24">${Q(l)}</div></div>
    `;let d="";s.forEach(i=>{const c=i.items.reduce((p,b)=>b.subItems&&b.subItems.length>0?p+b.subItems.filter(h=>!h.is_released).reduce((h,x)=>h+Math.abs(x.amount),0):p+(b.is_released?0:Math.abs(b.balance)),0),u=Math.round((c-(i.ledgerBalance||0))*100)/100,m=Math.abs(u)<=.05;d+=`
        <div class="gr-company">
          <div class="gr-company-header">
            <div class="gr-company-name">🏢 ${i.companyName}</div>
            <div style="display:flex;gap:18px;align-items:center;flex-wrap:wrap;">
              <div style="font-size:0.85rem;color:#94a3b8">رصيد الأستاذ: <b style="color:#e2e8f0;font-family:var(--font-en)">${Q(i.ledgerBalance||0)}</b></div>
              <div class="gr-company-total">معلّق: ${Q(c)}</div>
              ${m?'<span style="color:#34d399;font-size:0.82rem;font-weight:700">✓ مطابقة تامة</span>':`<span style="color:#f87171;font-size:0.82rem;font-weight:700">⚠️ فرق: ${Q(u)}</span>`}
            </div>
          </div>
          <div class="gr-table-wrap">
            <table class="gr-table">
              <thead><tr>
                <th>الحالة</th><th>التاريخ</th><th>رقم القيد</th><th>الحساب</th><th>البيان والملاحظات</th><th>الطرف</th><th>المبلغ</th><th>إجراء</th>
              </tr></thead>
              <tbody>
      `,i.items.forEach(p=>{const b=p.subItems&&p.subItems.length>0,h=`${i.companyId}|${p.account_code}|${p.move_name}`;let x='<span class="gr-badge gr-badge-pending">معلّقة</span>';b?x=`<span class="gr-badge" style="background:rgba(139,92,246,0.15);color:#a78bfa">مفصّل (${p.subItems.length})</span>`:p.match_type==="manual"?x=`<span class="gr-badge" style="background:rgba(234,179,8,0.15);color:#facc15" title="${p.release_notes||""}">استثناء يدوي</span>`:p.match_type==="auto"?x=`<span class="gr-badge gr-badge-released" title="${p.release_notes||""}">مفرج تلقائياً</span>`:p.is_released&&(x='<span class="gr-badge gr-badge-released">مفرج</span>'),d+=`<tr class="${!b&&p.is_released?"gr-released":""}">
          <td>${x}</td>
          <td style="font-family:var(--font-en);color:#94a3b8;font-size:0.82rem;white-space:nowrap">${p.date}</td>
          <td style="font-family:var(--font-en);color:#818cf8;font-size:0.82rem">${p.move_name||""}</td>
          <td style="font-size:0.82rem">${p.account_code}</td>
          <td style="max-width:280px;">
            <div>${p.label||p.account_name||""}</div>
            ${p.release_notes?`
              <div style="font-size:0.75rem;color:#facc15;margin-top:3px;background:rgba(234,179,8,0.08);padding:3px 6px;border-radius:4px;border:1px dashed rgba(234,179,8,0.25);line-height:1.3;">
                📌 ${p.release_notes}
              </div>
            `:""}
          </td>
          <td style="font-size:0.82rem;color:#94a3b8">${p.partner_name||""}</td>
          <td class="num" style="font-weight:700;color:${p.balance>=0?"#34d399":"#f87171"}">${Q(Math.abs(p.balance))}</td>
          <td style="display:flex;gap:4px;flex-wrap:nowrap">
            ${b?"":p.match_type==="manual"?`<button class="gr-btn gr-btn-unrelease" data-action="unrelease" data-cid="${i.companyId}" data-acc="${p.account_code}" data-move="${p.move_name}">↩️ إلغاء الاستثناء</button>`:p.match_type==="auto"?'<span style="font-size:0.75rem;color:#94a3b8;padding:4px 6px">مطابق بالأستاذ</span>':`<button class="gr-btn gr-btn-release" data-action="release" data-cid="${i.companyId}" data-acc="${p.account_code}" data-move="${p.move_name}">✅ إفراج / استثناء</button>`}
            <button class="gr-btn gr-btn-break" data-action="breakdown" data-key="${h}">📋 تفصيل</button>
          </td>
        </tr>`,b&&(p.subItems.forEach(z=>{d+=`<tr class="gr-sub-row ${z.is_released?"gr-released":""}">
              <td>${z.is_released?'<span class="gr-badge gr-badge-released">مفرج</span>':'<span class="gr-badge gr-badge-pending">معلّقة</span>'}</td>
              <td colspan="2"><span class="sub-marker">↳</span> ${z.description}</td>
              <td colspan="2" style="font-size:0.78rem;color:#94a3b8">${z.notes||""}</td>
              <td></td>
              <td class="num" style="color:#a78bfa">${Q(z.amount)}</td>
              <td style="display:flex;gap:4px">
                <button class="gr-btn ${z.is_released?"gr-btn-unrelease":"gr-btn-release"}" data-action="toggle-sub" data-subid="${z.id}" data-released="${z.is_released?1:0}">${z.is_released?"↩️":"✅"}</button>
                <button class="gr-btn gr-btn-del" data-action="del-sub" data-subid="${z.id}">🗑️</button>
              </td>
            </tr>`}),d+=`<tr class="gr-add-form" data-parent="${h}">
            <td colspan="2"><input type="text" placeholder="وصف الضمان..." class="sub-desc" style="width:100%"></td>
            <td colspan="2"><input type="number" placeholder="المبلغ" class="sub-amt" style="width:100px"></td>
            <td colspan="2"><input type="text" placeholder="ملاحظات..." class="sub-notes" style="width:100%"></td>
            <td colspan="2"><button class="gr-btn gr-btn-add" data-action="add-sub" data-cid="${i.companyId}" data-acc="${p.account_code}" data-move="${p.move_name}">➕ إضافة</button></td>
          </tr>`)}),d+="</tbody></table></div></div>"}),a.innerHTML=d,_a(e,s)}catch(s){a.innerHTML=`<div class="gr-empty" style="color:#f87171">❌ ${s.message}</div>`}}function _a(e,a){const t=e.querySelector("#gr-content");t.querySelectorAll('[data-action="release"],[data-action="unrelease"]').forEach(s=>{s.addEventListener("click",async()=>{const{cid:r,acc:n,move:o,action:l}=s.dataset;s.disabled=!0,s.textContent="⏳";try{l==="release"?await f.releaseGuarantee({companyId:parseInt(r),accountCode:n,moveName:o}):await f.unreleaseGuarantee({companyId:r,accountCode:n,moveName:o}),y(l==="release"?"✅ تم الإفراج":"↩️ تم الإلغاء","success"),await be(e)}catch(d){y("❌ "+d.message,"error")}})}),t.querySelectorAll('[data-action="breakdown"]').forEach(s=>{s.addEventListener("click",async()=>{const r=s.dataset.key,[n,o,l]=r.split("|"),d=t.querySelector(`tr.gr-add-form[data-parent="${r}"]`);if(d){d.style.display=d.style.display==="none"?"":"none";return}const i=s.closest("tr"),c=document.createElement("tr");c.className="gr-add-form",c.dataset.parent=r,c.innerHTML=`
        <td colspan="2"><input type="text" placeholder="وصف الضمان..." class="sub-desc" style="width:100%"></td>
        <td colspan="2"><input type="number" placeholder="المبلغ" class="sub-amt" style="width:100px"></td>
        <td colspan="2"><input type="text" placeholder="ملاحظات..." class="sub-notes" style="width:100%"></td>
        <td colspan="2"><button class="gr-btn gr-btn-add" data-action="add-sub" data-cid="${n}" data-acc="${o}" data-move="${l}">➕ إضافة</button></td>
      `,i.after(c),tt(e,c)})}),t.querySelectorAll('[data-action="toggle-sub"]').forEach(s=>{s.addEventListener("click",async()=>{const{subid:r,released:n}=s.dataset;s.disabled=!0,s.textContent="⏳";try{await f.toggleGuaranteeSubItem(r,{isReleased:n==="0"}),y(n==="0"?"✅ تم الإفراج":"↩️ تم الإلغاء","success"),await be(e)}catch(o){y("❌ "+o.message,"error")}})}),t.querySelectorAll('[data-action="del-sub"]').forEach(s=>{s.addEventListener("click",async()=>{if(confirm("هل تريد حذف هذا البند؟")){s.disabled=!0;try{await f.deleteGuaranteeSubItem(s.dataset.subid),y("🗑️ تم الحذف","success"),await be(e)}catch(r){y("❌ "+r.message,"error")}}})}),t.querySelectorAll(".gr-add-form").forEach(s=>tt(e,s))}function tt(e,a){const t=a.querySelector('[data-action="add-sub"]');t&&t.addEventListener("click",async()=>{var o,l;const s=a.querySelector(".sub-desc").value.trim(),r=parseFloat(a.querySelector(".sub-amt").value)||0,n=((l=(o=a.querySelector(".sub-notes"))==null?void 0:o.value)==null?void 0:l.trim())||"";if(!s||!r){y("أدخل الوصف والمبلغ","warning");return}t.disabled=!0,t.textContent="⏳";try{await f.addGuaranteeSubItem({parentCompanyId:parseInt(t.dataset.cid),parentAccountCode:t.dataset.acc,parentMoveName:t.dataset.move,description:s,amount:r,notes:n}),y("✅ تمت الإضافة","success"),await be(e)}catch(d){y("❌ "+d.message,"error"),t.disabled=!1,t.textContent="➕ إضافة"}})}const at="mizaniat_api_configs";async function Sa(e){var $;const a=`${window.location.origin}/api/external`;e.innerHTML=`
    <style>
      .api-mgr { padding:32px;max-width:1200px;margin:0 auto; }
      .api-mgr h1 { color:var(--text-white);margin:0;font-size:1.6rem; }
      .api-card { background:var(--bg-card);border-radius:12px;padding:20px;margin-bottom:20px;border:1px solid rgba(139,92,246,0.15); }
      .api-input { width:100%;padding:10px;border-radius:8px;background:var(--bg-dark);color:var(--text-white);border:1px solid rgba(255,255,255,0.1);font-size:0.95rem;box-sizing:border-box; }
      .api-label { color:var(--text-muted);font-size:0.85rem;display:block;margin-bottom:4px; }
      .api-grid3 { display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-bottom:14px; }
      .ep-badge { background:rgba(16,185,129,0.15);color:#10b981;padding:3px 10px;border-radius:4px;font-size:0.78rem;font-weight:700;font-family:var(--font-en); }
      .ep-badge.post { background:rgba(245,158,11,0.15);color:#f59e0b; }
      .ep-path { color:#a78bfa;font-size:0.92rem;font-family:var(--font-en); }
      .multi-select { position:relative; }
      .ms-toggle { padding:8px 10px;border-radius:8px;background:var(--bg-dark);color:var(--text-white);border:1px solid rgba(255,255,255,0.1);cursor:pointer;font-size:0.92rem;min-height:40px;display:flex;align-items:center;flex-wrap:wrap;gap:4px; }
      .ms-tag { background:rgba(139,92,246,0.2);color:#a78bfa;padding:2px 8px;border-radius:4px;font-size:0.8rem;display:inline-flex;align-items:center;gap:4px;white-space:nowrap; }
      .ms-tag .ms-x { cursor:pointer;opacity:0.6;font-size:0.7rem; }
      .ms-tag .ms-x:hover { opacity:1; }
      .ms-placeholder { color:rgba(255,255,255,0.3);font-size:0.88rem; }
      .ms-dropdown { display:none;position:absolute;top:100%;left:0;right:0;z-index:100;background:var(--bg-card);border:1px solid rgba(139,92,246,0.3);border-radius:8px;max-height:220px;overflow-y:auto;margin-top:4px;box-shadow:0 8px 32px rgba(0,0,0,0.5); }
      .multi-select.open .ms-dropdown { display:block; }
      .ms-item { padding:8px 14px;cursor:pointer;font-size:0.88rem;color:var(--text-white);display:flex;align-items:center;gap:8px;transition:background 0.1s; }
      .ms-item:hover { background:rgba(139,92,246,0.1); }
      .ms-item.selected { background:rgba(16,185,129,0.08); }
      .ms-check { width:16px;height:16px;border:1px solid rgba(255,255,255,0.2);border-radius:3px;display:flex;align-items:center;justify-content:center;font-size:0.7rem;color:#10b981; }
      .ms-item.selected .ms-check { background:rgba(16,185,129,0.2);border-color:#10b981; }
      .ms-search { padding:8px;border-bottom:1px solid rgba(255,255,255,0.06); }
      .ms-search input { width:100%;padding:6px 8px;border-radius:4px;background:rgba(0,0,0,0.3);color:var(--text-white);border:1px solid rgba(255,255,255,0.08);font-size:0.85rem;box-sizing:border-box; }
      .period-row { background:rgba(0,0,0,0.2);border-radius:8px;padding:14px;margin-bottom:10px;border:1px solid rgba(139,92,246,0.1);position:relative; }
      .period-row .period-num { position:absolute;top:8px;left:8px;background:rgba(139,92,246,0.2);color:#a78bfa;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.78rem;font-weight:700; }
      .period-row .period-del { position:absolute;top:8px;right:8px;background:rgba(239,68,68,0.15);color:#ef4444;border:none;width:26px;height:26px;border-radius:50%;cursor:pointer;font-size:0.85rem;display:flex;align-items:center;justify-content:center; }
      .period-row .period-del:hover { background:rgba(239,68,68,0.3); }
      .saved-chip { display:inline-flex;align-items:center;gap:6px;background:rgba(139,92,246,0.12);color:#a78bfa;padding:6px 14px;border-radius:20px;font-size:0.85rem;cursor:pointer;border:1px solid rgba(139,92,246,0.2);transition:all 0.15s; }
      .saved-chip:hover { background:rgba(139,92,246,0.25);border-color:rgba(139,92,246,0.4); }
      .saved-chip .chip-del { color:#ef4444;font-size:0.7rem;margin-right:-4px;opacity:0.6; }
      .saved-chip .chip-del:hover { opacity:1; }
    </style>

    <div class="api-mgr">
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:28px;">
        <span style="font-size:2.2rem;">🔌</span>
        <div>
          <h1>إدارة الـ APIs الخارجية</h1>
          <p style="color:var(--text-muted);margin:4px 0 0;font-size:0.95rem;">واجهة لربط بيانات المصروفات مع برنامج الموازنات التقديرية</p>
        </div>
      </div>

      <!-- Saved Configs -->
      <div class="api-card" id="saved-configs-card" style="display:none;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
          <span style="font-size:1.1rem;">💾</span>
          <span style="color:var(--text-white);font-weight:600;">إعدادات محفوظة</span>
        </div>
        <div id="saved-configs-list" style="display:flex;flex-wrap:wrap;gap:8px;"></div>
      </div>

      <!-- Tester -->
      <div class="api-card">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
          <h2 style="color:var(--text-white);margin:0;font-size:1.25rem;">🧪 اختبار تفاعلي — فترات متعددة</h2>
          <div style="display:flex;gap:8px;">
            <button class="btn" id="btn-save-config" style="font-size:0.82rem;background:rgba(139,92,246,0.15);color:#a78bfa;border:1px solid rgba(139,92,246,0.3);padding:6px 14px;">💾 حفظ الإعدادات</button>
          </div>
        </div>

        <div class="api-grid3" style="margin-bottom:18px;">
          <div>
            <label class="api-label">الشركات *</label>
            <div class="multi-select" id="ms-companies">
              <div class="ms-toggle"><span class="ms-placeholder">اختر الشركات...</span></div>
              <div class="ms-dropdown"><div class="ms-search"><input placeholder="بحث..." /></div><div class="ms-list"></div></div>
            </div>
          </div>
          <div>
            <label class="api-label">تفصيل شهري</label>
            <label style="display:flex;align-items:center;gap:8px;color:var(--text-white);padding:10px 0;">
              <input id="test-monthly" type="checkbox" checked /> نعم — يشمل شهر وسنه لكل سطر
            </label>
          </div>
          <div style="display:flex;align-items:flex-end;">
            <button class="btn" id="btn-add-period" style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3);width:100%;">➕ إضافة فترة</button>
          </div>
        </div>

        <div id="periods-container"></div>

        <div style="display:flex;gap:10px;align-items:center;margin-top:16px;flex-wrap:wrap;">
          <button class="btn btn-primary" id="btn-test" style="font-size:0.95rem;padding:10px 24px;">🚀 إرسال</button>
          <button class="btn" id="btn-update-fetch" style="font-size:0.88rem;background:rgba(6,182,212,0.15);color:#06b6d4;border:1px solid rgba(6,182,212,0.3);">🔄 تحديث النهاية لليوم وجلب</button>
          <div id="test-status" style="color:var(--text-muted);font-size:0.88rem;margin-right:auto;"></div>
        </div>

        <!-- GET Link -->
        <div id="get-link-box" style="display:none;margin-top:16px;background:rgba(16,185,129,0.06);border:2px solid rgba(16,185,129,0.3);border-radius:12px;padding:16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <div style="color:#10b981;font-weight:700;font-size:1rem;">🔗 رابط GET جاهز</div>
            <button class="btn btn-primary" id="btn-copy-link" style="font-size:0.85rem;padding:6px 16px;">📋 نسخ الرابط</button>
          </div>
          <div style="background:rgba(0,0,0,0.3);border-radius:8px;padding:10px 14px;">
            <code id="get-link-url" style="color:#10b981;font-size:0.82rem;font-family:var(--font-en);word-break:break-all;direction:ltr;display:block;text-align:left;"></code>
          </div>
        </div>

        <!-- JSON Output (prominent) -->
        <div id="json-output-box" style="display:none;margin-top:16px;background:rgba(245,158,11,0.04);border:2px solid rgba(245,158,11,0.25);border-radius:12px;padding:16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
            <div style="color:#f59e0b;font-weight:700;font-size:1.05rem;">📦 بيانات JSON جاهزة للنسخ</div>
            <div style="display:flex;gap:8px;">
              <span id="json-rows-count" style="color:var(--text-muted);font-size:0.82rem;padding:4px 10px;background:rgba(0,0,0,0.2);border-radius:4px;"></span>
              <button class="btn" id="btn-copy-data-json" style="font-size:0.88rem;background:rgba(245,158,11,0.15);color:#f59e0b;border:1px solid rgba(245,158,11,0.3);padding:6px 18px;">📋 نسخ JSON</button>
            </div>
          </div>
          <pre id="data-json-output" style="background:rgba(0,0,0,0.4);color:#10b981;padding:16px;border-radius:8px;max-height:450px;overflow:auto;font-size:0.82rem;font-family:var(--font-en);direction:ltr;text-align:left;margin:0;"></pre>
        </div>

        <!-- Summary + Table -->
        <div id="test-result" style="display:none;margin-top:16px;">
          <div id="result-summary" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px;"></div>
          <details>
            <summary style="color:var(--text-muted);cursor:pointer;font-size:0.88rem;">📋 عرض الجدول</summary>
            <div style="max-height:400px;overflow:auto;border-radius:8px;border:1px solid rgba(255,255,255,0.08);margin-top:8px;">
              <table class="bi-table" id="result-table" style="font-size:0.88rem;"></table>
            </div>
          </details>
        </div>
      </div>
    </div>
  `;function t(g,w,_,q){var F;const k=document.getElementById(g);if(!k)return{getValues:()=>[],setValues:()=>{},clear:()=>{}};const L=k.querySelector(".ms-toggle"),M=k.querySelector(".ms-list"),j=k.querySelector(".ms-search input"),I=new Set,E=((F=L.querySelector(".ms-placeholder"))==null?void 0:F.textContent)||"اختر...";function T(C=""){const H=C.toLowerCase();M.innerHTML=w.filter(V=>!H||String(V[q]).toLowerCase().includes(H)).map(V=>{const P=String(V[_]),J=I.has(P);return`<div class="ms-item ${J?"selected":""}" data-val="${P}"><div class="ms-check">${J?"✓":""}</div><span>${V[q]}</span></div>`}).join(""),M.querySelectorAll(".ms-item").forEach(V=>{V.onclick=P=>{P.stopPropagation();const J=V.dataset.val;I.has(J)?I.delete(J):I.add(J),T(j.value),A()}})}function A(){if(I.size===0){L.innerHTML=`<span class="ms-placeholder">${E}</span>`;return}L.innerHTML=Array.from(I).map(C=>{const H=w.find(P=>String(P[_])===C);return`<span class="ms-tag">${H?H[q].length>20?H[q].substring(0,20)+"…":H[q]:C} <span class="ms-x" data-val="${C}">✕</span></span>`}).join(""),L.querySelectorAll(".ms-x").forEach(C=>{C.onclick=H=>{H.stopPropagation(),I.delete(C.dataset.val),T(j.value),A()}})}return L.onclick=C=>{C.stopPropagation(),k.classList.toggle("open"),k.classList.contains("open")&&j.focus()},j.onclick=C=>C.stopPropagation(),j.oninput=()=>T(j.value),document.addEventListener("click",()=>k.classList.remove("open")),T(),A(),{getValues:()=>Array.from(I),setValues:C=>{I.clear(),C.forEach(H=>I.add(String(H))),T(),A()},clear:()=>{I.clear(),T(),A()}}}function s(g,w,_,q,k){const L="ms-"+Math.random().toString(36).slice(2,8);return g.innerHTML=`<div class="multi-select" id="${L}"><div class="ms-toggle"><span class="ms-placeholder">${k}</span></div><div class="ms-dropdown"><div class="ms-search"><input placeholder="بحث..." /></div><div class="ms-list"></div></div></div>`,t(L,w,_,q)}let r=[],n=[],o=[],l;try{const[g,w,_]=await Promise.all([fetch("/api/external/companies").then(k=>k.json()),fetch("/api/external/groups").then(k=>k.json()),fetch("/api/external/cost-centers").then(k=>k.json())]);r=g.data||[],n=w.data||[];const q=new Set;o=(_.data||[]).filter(k=>q.has(k.name)?!1:(q.add(k.name),!0)),l=t("ms-companies",r,"id","name")}catch(g){console.error("Failed to load dropdown data:",g)}let d=0;const i=[];function c(g){const w=d++,_=document.createElement("div");_.className="period-row",_.id=`period-${w}`,_.innerHTML=`
      <span class="period-num">${i.length+1}</span>
      <button class="period-del" data-idx="${w}">✕</button>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;padding-right:36px;">
        <div><label class="api-label">تاريخ البداية (تلقائي: كل الفترات)</label><input type="date" class="api-input period-from" value="${(g==null?void 0:g.dateFrom)||""}" /></div>
        <div><label class="api-label">تاريخ النهاية (تلقائي: اليوم)</label><input type="date" class="api-input period-to" value="${(g==null?void 0:g.dateTo)||""}" /></div>
        <div><label class="api-label">المجموعات</label><div class="period-groups"></div></div>
      </div>
      <div style="padding-right:36px;margin-top:10px;"><label class="api-label">مراكز التكلفة</label><div class="period-cc"></div></div>
    `,document.getElementById("periods-container").appendChild(_);const q=s(_.querySelector(".period-groups"),n,"id","name","اختر المجموعات..."),k=s(_.querySelector(".period-cc"),o,"name","name","اختر مراكز التكلفة...");g!=null&&g.groupIds&&q.setValues(g.groupIds.map(String)),g!=null&&g.costCenters&&k.setValues(g.costCenters);const L={idx:w,div:_,msG:q,msCC:k};return i.push(L),_.querySelector(".period-del").onclick=()=>{_.remove();const M=i.findIndex(j=>j.idx===w);M>=0&&i.splice(M,1),u()},L}function u(){i.forEach((g,w)=>{g.div.querySelector(".period-num").textContent=w+1})}function m(){i.forEach(g=>g.div.remove()),i.length=0,d=0}c(),document.getElementById("btn-add-period").onclick=()=>c();function p(){const g=((l==null?void 0:l.getValues())||[]).map(Number),w=document.getElementById("test-monthly").checked,_=i.map(q=>{const k={};k.dateFrom=q.div.querySelector(".period-from").value;const L=q.div.querySelector(".period-to").value;L&&(k.dateTo=L);const M=q.msG.getValues().map(Number);M.length&&(k.groupIds=M);const j=q.msCC.getValues();return j.length&&(k.costCenters=j),k}).filter(q=>q.dateFrom||q.dateTo||q.groupIds||q.costCenters||i.length===1);return{companyIds:g,monthly:w,periods:_}}function b(g){var w;m(),g.companyIds&&(l==null||l.setValues(g.companyIds.map(String))),document.getElementById("test-monthly").checked=g.monthly!==!1,(g.periods||[]).forEach(_=>c(_)),(w=g.periods)!=null&&w.length||c()}function h(){try{return JSON.parse(localStorage.getItem(at)||"[]")}catch{return[]}}function x(g){localStorage.setItem(at,JSON.stringify(g))}function z(){const g=h(),w=document.getElementById("saved-configs-card"),_=document.getElementById("saved-configs-list");if(g.length===0){w.style.display="none";return}w.style.display="",_.innerHTML=g.map((q,k)=>`
      <div class="saved-chip" data-idx="${k}">
        <span>📁 ${q.name}</span>
        <span class="chip-del" data-idx="${k}" title="حذف">✕</span>
      </div>
    `).join(""),_.querySelectorAll(".saved-chip").forEach(q=>{q.onclick=k=>{if(k.target.classList.contains("chip-del")){const j=Number(k.target.dataset.idx),I=h();I.splice(j,1),x(I),z();return}const L=Number(q.dataset.idx),M=h()[L];M&&b(M.config)}})}document.getElementById("btn-save-config").onclick=()=>{const g=prompt("اسم الإعدادات:");if(!g)return;const w=h();w.push({name:g,config:p(),savedAt:new Date().toISOString()}),x(w),z()},z(),document.getElementById("btn-update-fetch").onclick=()=>{i.forEach(g=>{g.div.querySelector(".period-to").value=""}),document.getElementById("btn-test").click()},($=document.getElementById("btn-copy-base"))==null||$.addEventListener("click",()=>{navigator.clipboard.writeText(a)}),document.getElementById("btn-test").onclick=async()=>{var L,M;const g=document.getElementById("test-status"),w=document.getElementById("test-result"),_=document.getElementById("json-output-box"),q=document.getElementById("get-link-box");g.textContent="⏳ جاري الجلب...",g.style.color="#f59e0b",w.style.display="none",_.style.display="none",q.style.display="none";const k=p();if(!k.companyIds.length){g.textContent="❌ اختر شركة واحدة على الأقل",g.style.color="#ef4444";return}if(!k.periods.length){g.textContent="❌ أضف فترة واحدة على الأقل بالضغط على إضافة فترة",g.style.color="#ef4444";return}try{const j=performance.now(),I=await fetch("/api/external/expenses",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(k)}),E=Math.round(performance.now()-j),T=await I.json();if(!I.ok){g.textContent=`❌ ${I.status}: ${T.error||"Error"}`,g.style.color="#ef4444";return}g.textContent=`✅ OK — ${E}ms — ${((L=T.summary)==null?void 0:L.totalRows)||0} سطر`,g.style.color="#10b981";const A=btoa(unescape(encodeURIComponent(JSON.stringify(k)))),F=`${a}/expenses/query?config=${encodeURIComponent(A)}`;document.getElementById("get-link-url").textContent=F,q.style.display="",document.getElementById("btn-copy-link").onclick=()=>{navigator.clipboard.writeText(F);const O=document.getElementById("btn-copy-link");O.textContent="✅ تم!",setTimeout(()=>O.textContent="📋 نسخ الرابط",2e3)};const C=JSON.stringify(T.data,null,2);document.getElementById("data-json-output").textContent=C,document.getElementById("json-rows-count").textContent=`${((M=T.data)==null?void 0:M.length)||0} سطر — ${(C.length/1024).toFixed(1)} KB`,_.style.display="",document.getElementById("btn-copy-data-json").onclick=()=>{navigator.clipboard.writeText(C);const O=document.getElementById("btn-copy-data-json");O.textContent="✅ تم النسخ!",setTimeout(()=>O.textContent="📋 نسخ JSON",2e3)};const H=document.getElementById("result-summary"),V=T.summary||{};H.innerHTML=Object.entries(V).map(([O,de])=>`
        <div style="background:rgba(16,185,129,0.06);border-radius:8px;padding:12px 16px;text-align:center;">
          <div style="color:var(--text-muted);font-size:0.78rem;">${O}</div>
          <div style="color:#10b981;font-size:1.15rem;font-weight:700;font-family:var(--font-en);">${typeof de=="number"?de.toLocaleString("en"):de}</div>
        </div>
      `).join("");const P=T.data||[],J=document.getElementById("result-table");if(P.length>0){const O=Object.keys(P[0]),de=O.map(Se=>`<th style="white-space:nowrap;font-size:0.82rem;">${Se}</th>`).join(""),xt=P.slice(0,300).map(Se=>`<tr>${O.map($t=>{const ze=Se[$t],Ee=typeof ze=="number";return`<td class="${Ee?"n":""}" style="font-size:0.85rem;${Ee?"font-family:var(--font-en);":""}">${Ee?ze.toLocaleString("en-US"):ze??"-"}</td>`}).join("")}</tr>`).join("");J.innerHTML=`<thead><tr>${de}</tr></thead><tbody>${xt}</tbody>`,P.length>300&&(J.innerHTML+=`<tfoot><tr><td colspan="${O.length}" style="text-align:center;color:var(--text-muted);">عرض أول 300 من ${P.length}</td></tr></tfoot>`)}else J.innerHTML='<tr><td style="text-align:center;color:var(--text-muted);padding:20px;">لا توجد بيانات</td></tr>';w.style.display=""}catch(j){g.textContent=`❌ ${j.message}`,g.style.color="#ef4444"}}}let pe={};async function za(e){e.innerHTML=`
    <div class="page-header">
      <div>
        <h1 class="page-title">🛍️ إعدادات نظام المبيعات</h1>
        <p class="page-subtitle">إدارة الاتصال بنظام المبيعات والشركات واستيراد البيانات</p>
      </div>
    </div>

    <!-- ===== Step 1: API Connection ===== -->
    <div class="settings-section card" style="border:1px solid rgba(59,130,246,0.3);">
      <h2 style="font-size:1.1rem;color:var(--accent-blue);margin-bottom:var(--space-lg);display:flex;align-items:center;gap:8px;">
        <span style="background:var(--accent-blue);color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.85rem;">1</span>
        الاتصال بخادم المبيعات
      </h2>
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-md);">
        <div class="form-group" style="grid-column:1/-1;">
          <label class="form-label">رابط الـ API</label>
          <input type="text" class="form-input" id="conn-url" placeholder="https://aboghaliaoffice.com" dir="ltr" style="font-family:var(--font-en);text-align:left;" />
          <small style="color:var(--text-muted);font-size:0.72rem;">الرابط الأساسي بدون /api/ — مثال: https://aboghaliaoffice.com</small>
        </div>
        <div class="form-group">
          <label class="form-label">اسم المستخدم (Username)</label>
          <input type="text" class="form-input" id="conn-user" placeholder="admin" dir="ltr" style="font-family:var(--font-en);text-align:left;" />
        </div>
        <div class="form-group">
          <label class="form-label">كلمة المرور / مفتاح API</label>
          <input type="password" class="form-input" id="conn-pass" placeholder="كلمة المرور أو API Key" dir="ltr" style="font-family:var(--font-en);text-align:left;" />
        </div>
      </div>
      
      <div style="display:flex;gap:var(--space-md);margin-top:var(--space-lg);">
        <button class="btn btn-primary" id="btn-test-conn">🔌 اختبار الاتصال</button>
        <button class="btn btn-success" id="btn-save-conn" disabled>💾 حفظ الاتصال</button>
      </div>
      <div id="conn-result" style="margin-top:var(--space-md);"></div>
    </div>

    <!-- ===== Step 2: Saved Connections ===== -->
    <div class="settings-section card" style="margin-top:var(--space-lg);border:1px solid rgba(139,92,246,0.3);">
      <h2 style="font-size:1.1rem;color:var(--accent-purple);margin-bottom:var(--space-md);display:flex;align-items:center;gap:8px;">
        <span style="background:var(--accent-purple);color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.85rem;">✓</span>
        الاتصالات المحفوظة
      </h2>
      <div id="instances-list"><div class="skeleton" style="height:60px;border-radius:var(--radius-md);"></div></div>
    </div>

    <!-- ===== Step 2: Companies ===== -->
    <div class="settings-section card" style="margin-top:var(--space-lg);border:1px solid rgba(16,185,129,0.3);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-lg);">
        <h2 style="font-size:1.1rem;color:var(--accent-emerald);display:flex;align-items:center;gap:8px;">
          <span style="background:var(--accent-emerald);color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.85rem;">2</span>
          الشركات
        </h2>
        <button class="btn btn-primary btn-sm" id="btn-add-company">+ إضافة شركة</button>
      </div>
      <div id="companies-list"><div class="skeleton" style="height:100px;border-radius:var(--radius-md);"></div></div>
    </div>

    <!-- ===== Step 3: Import Data ===== -->
    <div class="settings-section card" style="margin-top:var(--space-lg);border:1px solid rgba(245,158,11,0.3);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-lg);">
        <h2 style="font-size:1.1rem;color:var(--accent-amber);display:flex;align-items:center;gap:8px;">
          <span style="background:var(--accent-amber);color:#000;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.85rem;">3</span>
          استيراد البيانات من المبيعات
        </h2>
        <button class="btn btn-success btn-sm" id="btn-sync-all">🔄 مزامنة جميع الشركات</button>
      </div>
      <p style="color:var(--text-muted);font-size:0.8rem;margin-bottom:var(--space-lg);">
        يتم استيراد الفواتير على مراحل (دفعات). كل دفعة = 500 فاتورة. يمكنك متابعة التقدم أثناء الاستيراد.
      </p>
      <div id="import-panel"></div>
    </div>

    <!-- ===== Step 4: Sync Schedule ===== -->
    <div class="settings-section card" style="margin-top:var(--space-lg);border:1px solid rgba(6,182,212,0.3);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-lg);">
        <h2 style="font-size:1.1rem;color:#06b6d4;display:flex;align-items:center;gap:8px;">
          <span style="background:#06b6d4;color:#000;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.85rem;">4</span>
          🔄 المزامنة التلقائية
        </h2>
        <div id="schedule-status" style="font-size:0.78rem;color:var(--text-muted);"></div>
      </div>

      <div style="display:grid;grid-template-columns:auto 1fr auto;gap:var(--space-md);align-items:center;">
        <!-- Toggle -->
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;">
          <div style="position:relative;width:44px;height:24px;">
            <input type="checkbox" id="sync-enabled" style="opacity:0;width:0;height:0;position:absolute;">
            <span id="sync-toggle-track" style="position:absolute;inset:0;background:rgba(255,255,255,0.1);border-radius:12px;transition:background 0.3s;cursor:pointer;"></span>
            <span id="sync-toggle-dot" style="position:absolute;top:2px;right:22px;width:20px;height:20px;background:#fff;border-radius:50%;transition:all 0.3s;cursor:pointer;"></span>
          </div>
          <span style="font-size:0.85rem;color:var(--text-secondary);">تفعيل المزامنة التلقائية</span>
        </label>

        <!-- Interval -->
        <div style="display:flex;align-items:center;gap:8px;">
          <label style="font-size:0.8rem;color:var(--text-muted);white-space:nowrap;">الفترة:</label>
          <select id="sync-interval" class="filter-select" style="font-size:0.82rem;padding:6px 12px;min-width:160px;">
            <option value="1">كل ساعة</option>
            <option value="2" selected>كل ساعتين</option>
            <option value="4">كل 4 ساعات</option>
            <option value="6">كل 6 ساعات</option>
            <option value="12">كل 12 ساعة</option>
            <option value="24">يومياً</option>
          </select>
        </div>

        <!-- Save -->
        <button class="btn btn-primary btn-sm" id="btn-save-schedule">💾 حفظ الإعدادات</button>
      </div>

      <!-- Notifications -->
      <div style="margin-top:var(--space-lg);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-sm);">
          <h3 style="font-size:0.9rem;color:var(--text-secondary);margin:0;">📬 إشعارات المزامنة</h3>
          <button class="btn btn-sm" id="btn-clear-notifs" style="font-size:0.72rem;padding:3px 10px;color:var(--text-muted);">🗑 مسح</button>
        </div>
        <div id="sync-notifications-list" style="max-height:200px;overflow-y:auto;"></div>
      </div>
    </div>

    <!-- ===== Step 5: Elimination Rules (was 4) ===== -->
    <div class="settings-section card" style="margin-top:var(--space-lg);border:1px solid rgba(139,92,246,0.3);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-lg);">
        <h2 style="font-size:1.1rem;color:var(--accent-purple);display:flex;align-items:center;gap:8px;">
          <span style="background:var(--accent-purple);color:white;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:0.85rem;">5</span>
          قواعد استبعاد المعاملات المتبادلة
        </h2>
        <button class="btn btn-primary btn-sm" id="btn-add-rule">+ إضافة قاعدة</button>
      </div>
      <div id="rules-list"><div class="skeleton" style="height:80px;border-radius:var(--radius-md);"></div></div>
    </div>

    <!-- ===== Sync Log ===== -->
    <div class="settings-section card" style="margin-top:var(--space-lg);border:1px solid rgba(99,102,241,0.2);">
      <h2 style="font-size:1.1rem;color:var(--text-secondary);margin-bottom:var(--space-md);">📋 سجل المزامنة</h2>
      <div id="sync-log"><div class="skeleton" style="height:80px;border-radius:var(--radius-md);"></div></div>
    </div>
  `;const a=e.querySelector("#btn-test-conn"),t=e.querySelector("#btn-save-conn");a.addEventListener("click",async()=>{let l=e.querySelector("#conn-url").value.trim();const d=e.querySelector("#conn-user").value.trim(),i=e.querySelector("#conn-pass").value.trim(),c=e.querySelector("#conn-result");if(!l||!d||!i){c.innerHTML='<div style="padding:12px;border-radius:8px;background:rgba(239,68,68,0.15);color:var(--accent-red);font-size:0.85rem;">⚠️ يرجى تعبئة جميع الحقول</div>';return}!l.startsWith("http://")&&!l.startsWith("https://")&&(l="https://"+l,e.querySelector("#conn-url").value=l),a.disabled=!0,a.textContent="جاري الاختبار...",c.innerHTML='<div style="padding:12px;color:var(--text-muted);font-size:0.85rem;">⏳ جاري اختبار الاتصال...</div>';try{const u=await f.sales.testConnectionDirect({url:l,username:d,password:i,company_id:1});u.success?(c.innerHTML=`
          <div style="padding:12px;border-radius:8px;background:rgba(16,185,129,0.15);color:var(--accent-emerald);font-size:0.85rem;">
            ✅ الاتصال ناجح! ${u.message||""}
          </div>
        `,t.disabled=!1):(c.innerHTML=`
          <div style="padding:12px;border-radius:8px;background:rgba(239,68,68,0.15);color:var(--accent-red);font-size:0.85rem;">
            ❌ فشل الاتصال: ${u.message}
          </div>
        `,t.disabled=!0)}catch(u){c.innerHTML=`
        <div style="padding:12px;border-radius:8px;background:rgba(239,68,68,0.15);color:var(--accent-red);font-size:0.85rem;">
          ❌ خطأ: ${u.message}
        </div>
      `}a.disabled=!1,a.textContent="🔌 اختبار الاتصال"}),t.addEventListener("click",async()=>{let l=e.querySelector("#conn-url").value.trim();l&&!l.startsWith("http://")&&!l.startsWith("https://")&&(l="https://"+l);const d=e.querySelector("#conn-user").value.trim(),i=e.querySelector("#conn-pass").value.trim();t.disabled=!0,t.textContent="جاري الحفظ...";try{let c=l;try{c=new URL(l).hostname}catch{c=l.replace(/https?:\/\//,"").split("/")[0]}await f.sales.createInstance({name:"المبيعات - "+c,url:l,username:d,api_key:i}),y("تم حفظ الاتصال بنجاح ✅ — اربط الشركات به من قسم الشركات","success"),e.querySelector("#conn-url").value="",e.querySelector("#conn-user").value="",e.querySelector("#conn-pass").value="",e.querySelector("#conn-result").innerHTML="",t.disabled=!0,await se(e)}catch(c){y("خطأ في الحفظ: "+c.message,"error")}t.disabled=!1,t.textContent="💾 حفظ الاتصال"}),e.querySelector("#btn-add-company").addEventListener("click",()=>Aa(e)),e.querySelector("#btn-add-rule").addEventListener("click",()=>Ha(e)),e.querySelector("#btn-sync-all").addEventListener("click",async()=>{try{await f.sales.syncAll(),y("بدأت مزامنة جميع الشركات","info"),Ma(e)}catch(l){y("خطأ: "+l.message,"error")}});const s=e.querySelector("#sync-enabled"),r=e.querySelector("#sync-toggle-track"),n=e.querySelector("#sync-toggle-dot");function o(l){l?(r.style.background="#06b6d4",n.style.right="2px"):(r.style.background="rgba(255,255,255,0.1)",n.style.right="22px")}s.addEventListener("change",()=>{o(s.checked)}),e.querySelector("#btn-save-schedule").addEventListener("click",async()=>{const l=e.querySelector("#btn-save-schedule");l.disabled=!0,l.textContent="⏳ جاري الحفظ...";try{const d=await f.sales.updateSchedule({enabled:s.checked,intervalHours:parseInt(e.querySelector("#sync-interval").value)});y(d.running?`تم تفعيل المزامنة التلقائية — ${d.schedule}`:"تم إيقاف المزامنة التلقائية","success"),vt(e,d)}catch(d){y("خطأ: "+d.message,"error")}l.disabled=!1,l.textContent="💾 حفظ الإعدادات"}),e.querySelector("#btn-clear-notifs").addEventListener("click",async()=>{try{await f.sales.clearNotifications(),e.querySelector("#sync-notifications-list").innerHTML='<div style="text-align:center;color:var(--text-muted);padding:12px;font-size:0.8rem;">لا توجد إشعارات</div>',y("تم مسح الإشعارات","info")}catch(l){y("خطأ: "+l.message,"error")}}),await se(e)}function vt(e,a){const t=e.querySelector("#schedule-status");t&&(a.running?t.innerHTML=`<span style="color:#10b981;">● نشطة</span> — <span style="font-family:var(--font-en);font-size:0.72rem;">${a.schedule}</span>`:t.innerHTML='<span style="color:var(--text-muted);">○ متوقفة</span>')}function Ea(e,a){if(!e)return;if(!a||a.length===0){e.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:12px;font-size:0.8rem;">لا توجد إشعارات</div>';return}const t={success:"background:rgba(16,185,129,0.12);color:#10b981;border-color:rgba(16,185,129,0.2)",warning:"background:rgba(245,158,11,0.12);color:#f59e0b;border-color:rgba(245,158,11,0.2)",error:"background:rgba(239,68,68,0.12);color:#ef4444;border-color:rgba(239,68,68,0.2)"},s={success:"✅",warning:"⚠️",error:"❌"};e.innerHTML=`<div style="display:grid;gap:6px;">
    ${a.map(r=>{const n=t[r.type]||t.success,o=s[r.type]||"✅",l=r.created_at?new Date(r.created_at+"Z").toLocaleString("ar-SA",{hour:"2-digit",minute:"2-digit",day:"numeric",month:"short"}):"";return`<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-radius:8px;border:1px solid;${n};font-size:0.8rem;">
        <span>${o} ${r.message}</span>
        <span style="font-family:var(--font-en);font-size:0.7rem;opacity:0.7;">${l}</span>
      </div>`}).join("")}
  </div>`}async function se(e){try{const[a,t,s,r,n,o]=await Promise.all([f.sales.getInstances().catch(()=>[]),f.sales.getCompanies().catch(()=>[]),f.sales.getEliminationRules().catch(()=>[]),f.sales.getSyncStatus().catch(()=>[]),f.sales.getSchedule().catch(()=>({enabled:!1,intervalHours:2,running:!1})),f.sales.getNotifications().catch(()=>[])]);S.set("sales_companies",t||[]),qa(e.querySelector("#instances-list"),a,e),La(e.querySelector("#companies-list"),t,a,e),Ia(e.querySelector("#import-panel"),t),Ta(e.querySelector("#rules-list"),s),Ca(e.querySelector("#sync-log"),r);const l=e.querySelector("#sync-enabled");if(l){l.checked=n.enabled;const i=e.querySelector("#sync-toggle-track"),c=e.querySelector("#sync-toggle-dot");n.enabled?(i.style.background="#06b6d4",c.style.right="2px"):(i.style.background="rgba(255,255,255,0.1)",c.style.right="22px")}const d=e.querySelector("#sync-interval");d&&(d.value=String(n.intervalHours)),vt(e,n),Ea(e.querySelector("#sync-notifications-list"),o)}catch{y("خطأ في تحميل الإعدادات","error")}}function qa(e,a,t){if(a.length===0){e.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:15px;font-size:0.85rem;">لا توجد اتصالات محفوظة — أضف اتصال من الخطوة 1</div>';return}e.innerHTML=`
    <div style="display:grid;gap:var(--space-sm);">
      ${a.map(s=>`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:rgba(139,92,246,0.06);border-radius:var(--radius-md);border:1px solid rgba(139,92,246,0.15);">
          <div>
            <strong style="font-size:0.85rem;">${s.name}</strong>
            <span style="font-family:var(--font-en);font-size:0.75rem;color:var(--text-muted);margin-right:8px;">${s.url}</span>
            <span style="font-size:0.72rem;color:var(--text-muted);">— ${s.username}</span>
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            <span style="font-size:0.7rem;color:var(--text-muted);font-family:var(--font-en);">ID: ${s.id}</span>
            <button class="btn btn-sm btn-delete-instance" data-id="${s.id}" style="background:rgba(239,68,68,0.1);color:var(--accent-red);border:1px solid rgba(239,68,68,0.2);font-size:0.75rem;padding:3px 8px;">❌</button>
          </div>
        </div>
      `).join("")}
    </div>
  `,e.querySelectorAll(".btn-delete-instance").forEach(s=>{s.addEventListener("click",async()=>{const r=s.dataset.id;if(confirm("هل تريد حذف هذا الاتصال؟"))try{await f.sales.deleteInstance(r),y("تم حذف الاتصال","success"),await se(t)}catch(n){y("خطأ: "+n.message,"error")}})})}function La(e,a,t,s){if(a.length===0){e.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:0.85rem;">لا توجد شركات — أضف شركة جديدة</div>';return}const r={};for(const n of t)r[n.id]=n;e.innerHTML=`
    <div class="data-table-wrapper">
      <table class="data-table">
        <thead><tr><th>اسم الشركة</th><th>الخادم المربوط</th><th>Sales ID</th><th>عدد الفواتير</th><th>آخر فاتورة</th><th>الحالة</th><th>إجراء</th></tr></thead>
        <tbody>
          ${a.map(n=>{const o=r[n.sales_instance_id],l=t.map(d=>`<option value="${d.id}" ${d.id===n.sales_instance_id?"selected":""}>${d.name}</option>`).join("");return`
            <tr>
              <td>
                <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${n.color||"#3b82f6"};margin-left:8px;"></span>
                ${n.name}
              </td>
              <td>
                <select class="filter-select company-instance-select" data-company-id="${n.id}" style="font-size:0.78rem;padding:4px 8px;min-width:180px;">
                  ${l}
                </select>
                ${o?`<div style="font-family:var(--font-en);font-size:0.68rem;color:var(--text-muted);margin-top:2px;">${o.url} — ${o.username}</div>`:""}
              </td>
              <td style="font-family:var(--font-en);">${n.sales_company_id}</td>
              <td style="font-family:var(--font-en);font-weight:600;">${v(n.item_count||0)}</td>
              <td style="font-family:var(--font-en);font-size:0.8em;">${n.last_entry_date||"--"}</td>
              <td><span class="badge ${n.is_active?"badge-success":"badge-danger"}">${n.is_active?"نشط":"معطل"}</span></td>
              <td>
                <button class="btn btn-sm btn-delete-company" data-id="${n.id}" style="background:rgba(239,68,68,0.1);color:var(--accent-red);border:1px solid rgba(239,68,68,0.2);font-size:0.75rem;padding:3px 8px;">🗑️</button>
              </td>
            </tr>
          `}).join("")}
        </tbody>
      </table>
    </div>
  `,e.querySelectorAll(".company-instance-select").forEach(n=>{n.addEventListener("change",async()=>{const o=n.dataset.companyId,l=parseInt(n.value);try{await f.sales.updateCompany(o,{sales_instance_id:l}),y("تم تحديث الخادم المربوط ✅","success"),await se(s)}catch(d){y("خطأ: "+d.message,"error")}})}),e.querySelectorAll(".btn-delete-company").forEach(n=>{n.addEventListener("click",async()=>{const o=n.dataset.id;if(confirm("هل أنت متأكد من حذف هذه الشركة وحذف جميع بيانات الفواتير المرتبطة بها نهائياً؟"))try{await f.sales.deleteCompany(o),y("تم حذف الشركة بنجاح","success"),await se(s)}catch(l){y("خطأ: "+l.message,"error")}})})}function Ia(e,a){if(a.length===0){e.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:0.85rem;">أضف شركات أولاً ثم ابدأ الاستيراد</div>';return}e.innerHTML=a.map(t=>`
    <div class="card" style="margin-bottom:var(--space-md);border:1px solid rgba(255,255,255,0.05);padding:var(--space-md);" id="import-card-${t.id}">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${t.color||"#3b82f6"};margin-left:8px;"></span>
          <strong>${t.name}</strong>
          <span style="font-family:var(--font-en);color:var(--text-muted);font-size:0.8em;margin-right:8px;">(Company ID: ${t.sales_company_id})</span>
          <span style="font-family:var(--font-en);color:var(--text-muted);font-size:0.8em;">— ${v(t.item_count||0)} فاتورة</span>
        </div>
        <button class="btn btn-primary btn-sm btn-import" data-company-id="${t.id}">📥 استيراد</button>
      </div>
      <div class="import-progress" id="progress-${t.id}" style="margin-top:var(--space-sm);display:none;">
        <div style="display:flex;justify-content:space-between;font-size:0.78rem;color:var(--text-secondary);margin-bottom:4px;">
          <span id="progress-text-${t.id}">جاري التحضير...</span>
          <span id="progress-pct-${t.id}">0%</span>
        </div>
        <div style="height:6px;background:rgba(10,15,40,0.5);border-radius:3px;overflow:hidden;">
          <div id="progress-bar-${t.id}" style="height:100%;width:0%;background:linear-gradient(90deg,var(--accent-blue),var(--accent-emerald));border-radius:3px;transition:width 0.5s ease;"></div>
        </div>
      </div>
    </div>
  `).join(""),e.querySelectorAll(".btn-import").forEach(t=>{t.addEventListener("click",async()=>{const s=parseInt(t.dataset.companyId);t.disabled=!0,t.textContent="⏳ جاري...";try{await f.sales.syncCompany(s),y("بدأت عملية الاستيراد","info"),ft(s)}catch(r){y("خطأ: "+r.message,"error"),t.disabled=!1,t.textContent="📥 استيراد"}})})}function ft(e){const a=document.getElementById(`progress-${e}`);a&&(a.style.display="block"),pe[e]&&clearInterval(pe[e]),pe[e]=setInterval(async()=>{try{const t=await f.sales.getSyncProgress(e);if(ja(e,t),t.status==="completed"||t.status==="failed"){clearInterval(pe[e]),delete pe[e];const s=document.querySelector(`[data-company-id="${e}"]`);if(s&&(s.disabled=!1,s.textContent=t.status==="completed"?"✅ تم":"📥 إعادة الاستيراد"),t.status==="completed"){y(`تم استيراد ${v(t.inserted)} فاتورة بنجاح ✅`,"success");const r=await f.sales.getCompanies();S.set("sales_companies",r)}else y(`فشل الاستيراد: ${t.phase}`,"error")}}catch(t){console.error("Progress poll error:",t)}},1500)}async function Ma(e){let a=S.get("sales_companies");(!a||!Array.isArray(a))&&(a=await f.sales.getCompanies(),S.set("sales_companies",a));for(const t of a||[])ft(t.id)}function ja(e,a){const t=document.getElementById(`progress-text-${e}`),s=document.getElementById(`progress-pct-${e}`),r=document.getElementById(`progress-bar-${e}`),n=document.getElementById(`progress-${e}`);if(!(!t||!s||!r)){if(n.style.display="block",t.textContent=a.phase||"",a.total>0){const o=Math.round(a.inserted/a.total*100);s.textContent=`${o}%`,r.style.width=`${o}%`}a.status==="completed"?(r.style.background="var(--accent-emerald)",r.style.width="100%",s.textContent="100%"):a.status==="failed"&&(r.style.background="var(--accent-red)")}}function Ta(e,a){if(a.length===0){e.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:15px;font-size:0.85rem;">لا توجد قواعد استبعاد</div>';return}e.innerHTML=`
    <div class="data-table-wrapper">
      <table class="data-table">
        <thead><tr><th>القاعدة</th><th>الشركة المصدر</th><th>الشركة الهدف</th><th>حساب المصدر</th><th>حساب الهدف</th></tr></thead>
        <tbody>
          ${a.map(t=>`
            <tr>
              <td>${t.name}</td>
              <td>${t.source_company_name||"--"}</td>
              <td>${t.target_company_name||"--"}</td>
              <td style="font-family:var(--font-en);">${t.source_account_code||"--"}</td>
              <td style="font-family:var(--font-en);">${t.target_account_code||"--"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `}function Ca(e,a){if(a.length===0){e.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:15px;font-size:0.85rem;">لا يوجد سجل مزامنة بعد</div>';return}e.innerHTML=`
    <div class="data-table-wrapper">
      <table class="data-table">
        <thead><tr><th>الشركة</th><th>الحالة</th><th>الفواتير المستوردة</th><th>البداية</th><th>النهاية</th><th>الخطأ</th></tr></thead>
        <tbody>
          ${a.slice(0,20).map(t=>`
            <tr>
              <td>${t.company_name||"--"}</td>
              <td>
                <span class="badge badge-${t.status==="completed"?"success":t.status==="failed"?"danger":"warning"}">
                  ${t.status==="completed"?"✅ مكتمل":t.status==="failed"?"❌ فشل":"⏳ جاري"}
                </span>
              </td>
              <td style="font-family:var(--font-en);">${v(t.records_synced||0)}</td>
              <td style="font-family:var(--font-en);font-size:0.72em;">${t.started_at||""}</td>
              <td style="font-family:var(--font-en);font-size:0.72em;">${t.completed_at||""}</td>
              <td style="font-size:0.72em;color:var(--accent-red);max-width:200px;overflow:hidden;text-overflow:ellipsis;">${t.error_message||""}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `}function Aa(e){ye("إضافة شركة جديدة",`
    <div class="form-group">
      <label class="form-label">اسم الشركة</label>
      <input type="text" class="form-input" id="comp-name" dir="rtl" placeholder="مثال: شركة أبو غالية للتطوير العقاري" />
    </div>
    <div class="form-group">
      <label class="form-label">معرف الشركة في المبيعات (Company ID)</label>
      <input type="number" class="form-input" id="comp-sales-id" placeholder="1" dir="ltr" style="font-family:var(--font-en);" />
      <small style="color:var(--text-muted);font-size:0.72rem;">هذا هو الرقم في ?company_id=X في رابط الـ API</small>
    </div>
    <div class="form-group">
      <label class="form-label">اتصال المبيعات</label>
      <select class="filter-select" id="comp-instance" style="width:100%;"></select>
    </div>
    <div class="form-group">
      <label class="form-label">العملة</label>
      <input type="text" class="form-input" id="comp-currency" value="SAR" dir="ltr" style="font-family:var(--font-en);" />
    </div>
    <div class="form-group">
      <label class="form-label">اللون</label>
      <input type="color" id="comp-color" value="#3b82f6" style="width:50px;height:36px;border:none;cursor:pointer;" />
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:var(--space-lg);">
      <button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.remove('active')">إلغاء</button>
      <button class="btn btn-primary" id="btn-save-company">حفظ</button>
    </div>
  `),f.sales.getInstances().then(a=>{const t=document.getElementById("comp-instance");a.length===0?t.innerHTML="<option disabled>⚠️ أضف اتصال المبيعات أولاً</option>":t.innerHTML=a.map(s=>`<option value="${s.id}">${s.name} (${s.url})</option>`).join("")}),document.getElementById("btn-save-company").addEventListener("click",async()=>{const a=document.getElementById("comp-name").value,t=parseInt(document.getElementById("comp-sales-id").value),s=parseInt(document.getElementById("comp-instance").value);if(!a||!t){y("يرجى تعبئة الاسم ومعرف الشركة","warning");return}try{await f.sales.createCompany({name:a,sales_company_id:t,sales_instance_id:s,currency:document.getElementById("comp-currency").value||"SAR",color:document.getElementById("comp-color").value}),ve(),y("تم إضافة الشركة بنجاح ✅","success");const r=await f.sales.getCompanies();S.set("sales_companies",r),await se(e)}catch(r){y("خطأ: "+r.message,"error")}})}function Ha(e){const a=S.get("sales_companies");ye("إضافة قاعدة استبعاد",`
    <div class="form-group">
      <label class="form-label">اسم القاعدة</label>
      <input type="text" class="form-input" id="rule-name" dir="rtl" placeholder="مثل: استبعاد إيرادات المقاولات بين الشركات" />
    </div>
    <div class="form-group">
      <label class="form-label">الشركة المصدر</label>
      <select class="filter-select" id="rule-source" style="width:100%;">
        ${a.map(t=>`<option value="${t.id}">${t.name}</option>`).join("")}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">الشركة الهدف</label>
      <select class="filter-select" id="rule-target" style="width:100%;">
        ${a.map(t=>`<option value="${t.id}">${t.name}</option>`).join("")}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">كود حساب المصدر</label>
      <input type="text" class="form-input" id="rule-src-acc" placeholder="مثل: 4100" dir="ltr" style="font-family:var(--font-en);" />
    </div>
    <div class="form-group">
      <label class="form-label">كود حساب الهدف</label>
      <input type="text" class="form-input" id="rule-tgt-acc" placeholder="مثل: 5100" dir="ltr" style="font-family:var(--font-en);" />
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:var(--space-lg);">
      <button class="btn btn-secondary" onclick="document.getElementById('modal-overlay').classList.remove('active')">إلغاء</button>
      <button class="btn btn-primary" id="btn-save-rule">حفظ</button>
    </div>
  `),document.getElementById("btn-save-rule").addEventListener("click",async()=>{try{await f.sales.createEliminationRule({name:document.getElementById("rule-name").value,source_company_id:parseInt(document.getElementById("rule-source").value),target_company_id:parseInt(document.getElementById("rule-target").value),source_account_code:document.getElementById("rule-src-acc").value,target_account_code:document.getElementById("rule-tgt-acc").value}),ve(),y("تم إضافة القاعدة بنجاح ✅","success"),await se(e)}catch(t){y("خطأ: "+t.message,"error")}})}let B=0;const we=50;let Ne=[],oe="date",me="DESC";const Ge=[{key:"company_name",label:"الشركة",type:"text",default:!0},{key:"date",label:"التاريخ",type:"date",default:!0},{key:"name",label:"رقم الفاتورة",type:"code",default:!0},{key:"partner_name",label:"العميل",type:"text",default:!0},{key:"state",label:"الحالة",type:"badge",default:!0},{key:"amount_total",label:"المبلغ الإجمالي",type:"money",default:!0},{key:"journal_name",label:"اسم اليومية",type:"text",default:!1,isRaw:!0},{key:"payment_status",label:"حالة الدفع",type:"badge",default:!1,isRaw:!0},{key:"move_type",label:"نوع الحركة",type:"text",default:!1,isRaw:!0},{key:"amount_untaxed",label:"المبلغ (قبل الضريبة)",type:"money",default:!1,isRaw:!0},{key:"amount_tax_signed",label:"الضريبة",type:"money",default:!1,isRaw:!0},{key:"total_paid",label:"إجمالي المدفوع",type:"money",default:!1,isRaw:!0},{key:"amount_residual",label:"المبلغ المتبقي",type:"residual",default:!1},{key:"reference",label:"المرجع",type:"text",default:!1,isRaw:!0},{key:"created_at",label:"تاريخ المزامنة",type:"date",default:!0},{key:"raw_data",label:"البيانات الخام",type:"actions",default:!0}];let N=[];try{const e=localStorage.getItem("sales_preview_cols");e&&(N=JSON.parse(e))}catch{}(!N||N.length===0)&&(N=Ge.filter(e=>e.default).map(e=>e.key));async function Ba(e){let a=S.get("sales_companies");if(!a||a.length===0)try{a=await f.sales.getCompanies(),S.set("sales_companies",a)}catch{a=[]}e.innerHTML=`
    <div class="page-header">
      <div>
        <h1 class="page-title">🛍️ معاينة المبيعات</h1>
        <p class="page-subtitle">عرض تفصيلي لـ الفواتير المستوردة من أودو المبيعات</p>
      </div>
      <div id="total-badge" style="background:rgba(59,130,246,0.15);color:var(--accent-blue);padding:8px 16px;border-radius:8px;font-weight:600;font-size:0.9rem;display:none;"></div>
    </div>

    <!-- Summary Cards -->
    <div id="dp-summary-cards" style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:var(--space-md);margin-bottom:var(--space-md);">
      <div style="text-align:center;padding:20px;color:var(--text-muted);">جاري تحميل ملخص البيانات...</div>
    </div>

    <!-- Filters -->
    <div class="card" style="margin-bottom:var(--space-lg);padding:var(--space-md);">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:var(--space-md);align-items:end;">
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="font-size:0.75rem;">🔍 بحث</label>
          <input type="text" class="form-input" id="dp-search" placeholder="رقم الفاتورة، اسم العميل..." style="font-size:0.82rem;" />
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="font-size:0.75rem;">🏢 الشركة</label>
          <select class="filter-select" id="dp-company" style="width:100%;">
            <option value="">— الكل —</option>
            ${a.map(n=>`<option value="${n.id}">${n.name}</option>`).join("")}
          </select>
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="font-size:0.75rem;">📋 حالة الفاتورة</label>
          <select class="filter-select" id="dp-state" style="width:100%;">
            <option value="">— الكل —</option>
          </select>
        </div>
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="font-size:0.75rem;">📅 التاريخ من</label>
          <input type="date" class="form-input" id="dp-datefrom" dir="ltr" style="font-family:var(--font-en);font-size:0.82rem;" />
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:var(--space-md);margin-top:var(--space-md);align-items:end;">
        <div class="form-group" style="margin:0;">
          <label class="form-label" style="font-size:0.75rem;">📅 التاريخ إلى</label>
          <input type="date" class="form-input" id="dp-dateto" dir="ltr" style="font-family:var(--font-en);font-size:0.82rem;" />
        </div>
        <div></div>
        <div></div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-primary btn-sm" id="dp-apply" style="flex:1;">تطبيق</button>
          <button class="btn btn-secondary btn-sm" id="dp-reset">مسح</button>
        </div>
      </div>
    </div>

    <!-- Column Chooser -->
    <div style="display:flex;justify-content:flex-end;margin-bottom:10px;padding:0 var(--space-sm);">
      <div style="position:relative;" id="col-chooser-container">
        <button class="btn btn-secondary btn-sm" id="btn-col-chooser" style="background:var(--surface-color);border:1px solid var(--border-color);">⚙️ الأعمدة</button>
        <div id="col-chooser-dropdown" style="display:none;position:absolute;top:100%;left:0;background:var(--surface-color);border:1px solid var(--border-color);border-radius:8px;padding:10px;z-index:100;box-shadow:0 4px 12px rgba(0,0,0,0.1);width:220px;max-height:300px;overflow-y:auto;text-align:right;">
           ${Ge.map(n=>`
             <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer;font-size:0.8rem;color:var(--text-primary);">
               <input type="checkbox" class="col-toggle" value="${n.key}" ${N.includes(n.key)?"checked":""}>
               ${n.label}
             </label>
           `).join("")}
        </div>
      </div>
    </div>

    <!-- Data Table -->
    <div class="card" style="padding:0;overflow:hidden;">
      <div id="dp-table-wrapper" style="overflow-x:auto;max-height:65vh;overflow-y:auto;">
        <div style="text-align:center;padding:40px;color:var(--text-muted);">جاري التحميل...</div>
      </div>
    </div>

    <!-- Pagination -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:var(--space-md);padding:0 var(--space-sm);">
      <div style="display:flex;gap:8px;">
        <button class="btn btn-secondary btn-sm" id="dp-prev" disabled>→ السابق</button>
        <button class="btn btn-secondary btn-sm" id="dp-next">التالي ←</button>
      </div>
      <div id="dp-page-info" style="color:var(--text-muted);font-size:0.8rem;font-family:var(--font-en);"></div>
    </div>
  `,e.querySelector("#dp-apply").addEventListener("click",()=>{B=0,ee(e)}),e.querySelector("#dp-reset").addEventListener("click",()=>{e.querySelector("#dp-search").value="",e.querySelector("#dp-company").value="",e.querySelector("#dp-state").value="",e.querySelector("#dp-datefrom").value="",e.querySelector("#dp-dateto").value="",B=0,ee(e)}),e.querySelector("#dp-prev").addEventListener("click",()=>{B>0&&(B--,ee(e))}),e.querySelector("#dp-next").addEventListener("click",()=>{B++,ee(e)}),e.querySelector("#dp-search").addEventListener("keydown",n=>{n.key==="Enter"&&(B=0,ee(e))});const t=e.querySelector("#btn-col-chooser"),s=e.querySelector("#col-chooser-dropdown");t.addEventListener("click",n=>{n.stopPropagation(),s.style.display=s.style.display==="none"?"block":"none"}),document.addEventListener("click",n=>{e.querySelector("#col-chooser-container").contains(n.target)||(s.style.display="none")});const r=e.querySelectorAll(".col-toggle");r.forEach(n=>{n.addEventListener("change",()=>{N=Array.from(r).filter(o=>o.checked).map(o=>o.value),N.length===0&&(N=["name","company_name"],r.forEach(o=>{N.includes(o.value)&&(o.checked=!0)})),localStorage.setItem("sales_preview_cols",JSON.stringify(N)),ht(e.querySelector("#dp-table-wrapper"),Ne)})}),B=0,await ee(e)}async function ee(e){const a=e.querySelector("#dp-search").value.trim(),t=e.querySelector("#dp-company").value,s=e.querySelector("#dp-state").value,r=e.querySelector("#dp-datefrom").value,n=e.querySelector("#dp-dateto").value,o={limit:we,offset:B*we,orderBy:oe,orderDir:me};a&&(o.search=a),t&&(o.companyIds=t),s&&(o.state=s),r&&(o.dateFrom=r),n&&(o.dateTo=n);try{const l=await f.sales.getInvoices(o);if(l.states&&l.states.length>0){const u=e.querySelector("#dp-state"),m=u.value;u.options.length<=1&&(l.states.forEach(p=>{const b=document.createElement("option");b.value=p,b.textContent=p,u.appendChild(b)}),m&&(u.value=m))}const d=l.totals||{amount_total:0,amount_untaxed:0,total_paid:0},i=d.total_paid-d.amount_total;e.querySelector("#dp-summary-cards").innerHTML=`
      <div class="card" style="padding:var(--space-md);display:flex;align-items:center;gap:16px;">
        <div style="background:rgba(59,130,246,0.1);color:var(--accent-blue);width:45px;height:45px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;">🧾</div>
        <div>
          <div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:4px;">إجمالي الفواتير</div>
          <div style="font-weight:700;font-size:1.25rem;font-family:var(--font-en);color:var(--text-primary);">${v(l.total)}</div>
        </div>
      </div>
      <div class="card" style="padding:var(--space-md);display:flex;align-items:center;gap:16px;">
        <div style="background:rgba(16,185,129,0.1);color:var(--accent-green);width:45px;height:45px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;">💰</div>
        <div>
          <div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:4px;">إجمالي المبالغ</div>
          <div style="font-weight:700;font-size:1.25rem;font-family:var(--font-en);color:var(--text-primary);">${v(d.amount_total,2)} ر.س</div>
        </div>
      </div>
      <div class="card" style="padding:var(--space-md);display:flex;align-items:center;gap:16px;">
        <div style="background:rgba(139,92,246,0.1);color:#8b5cf6;width:45px;height:45px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;">💸</div>
        <div>
          <div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:4px;">إجمالي المدفوع</div>
          <div style="font-weight:700;font-size:1.25rem;font-family:var(--font-en);color:var(--text-primary);">${v(d.total_paid,2)} ر.س</div>
        </div>
      </div>
      <div class="card" style="padding:var(--space-md);display:flex;align-items:center;gap:16px;">
        <div style="background:rgba(245,158,11,0.1);color:var(--accent-orange);width:45px;height:45px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;">⏳</div>
        <div>
          <div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:4px;">المتبقي</div>
          <div style="font-weight:700;font-size:1.25rem;font-family:var(--font-en);color:var(--text-primary);">${v(i,2)} ر.س</div>
        </div>
      </div>
    `;const c=Math.ceil(l.total/we);e.querySelector("#dp-prev").disabled=B===0,e.querySelector("#dp-next").disabled=B+1>=c,e.querySelector("#dp-page-info").textContent=`صفحة ${B+1} من ${c||1}`,Ne=l.items,ht(e.querySelector("#dp-table-wrapper"),Ne)}catch(l){e.querySelector("#dp-table-wrapper").innerHTML=`<div style="padding:20px;color:var(--accent-red);">خطأ: ${l.message}</div>`,e.querySelector("#dp-summary-cards").innerHTML='<div style="text-align:center;padding:20px;color:var(--accent-red);">فشل تحميل ملخص البيانات</div>'}}function ht(e,a){if(!a||a.length===0){e.innerHTML='<div style="text-align:center;padding:40px;color:var(--text-muted);">لا توجد بيانات</div>';return}const t=Ge.filter(r=>N.includes(r.key));e.innerHTML=`
    <table class="data-table" style="font-size:0.78rem;width:100%;">
      <thead>
        <tr>
          <th style="position:sticky;top:0;z-index:2;font-size:0.7rem;white-space:nowrap;width:30px;">#</th>
          ${t.map(r=>{const n=r.key!=="actions"&&r.key!=="raw_data";let o='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 15l5 5 5-5M7 9l5-5 5 5"/></svg>';return oe===r.key&&(o=me==="ASC"?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 15l7-7 7 7"/></svg>':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 9l-7 7-7-7"/></svg>'),`
               <th style="position:sticky;top:0;z-index:2;font-size:0.75rem;white-space:nowrap;cursor:${n?"pointer":"default"};background:var(--surface-color);"
                   ${n?`class="sort-header hover-bg" data-key="${r.key}"`:""}>
                 <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 4px;">
                   <span>${r.label}</span>
                   ${n?`<span class="sort-icon" style="color:${oe===r.key?"var(--accent-blue)":"var(--text-muted)"}; opacity:${oe===r.key?"1":"0.4"}; display:flex; align-items:center;">${o}</span>`:""}
                 </div>
               </th>
             `}).join("")}
        </tr>
      </thead>
      <tbody>
        ${a.map((r,n)=>`
          <tr>
            <td style="font-family:var(--font-en);color:var(--text-muted);font-size:0.7rem;">${B*we+n+1}</td>
            ${t.map(o=>Pa(r,o,n)).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `,e.querySelectorAll(".btn-view-raw").forEach(r=>{r.addEventListener("click",n=>{const o=n.currentTarget.getAttribute("data-idx"),l=a[o];alert(`البيانات الخام للفاتورة:

`+(l.raw_data?JSON.stringify(JSON.parse(l.raw_data),null,2):"لا توجد بيانات خام"))})}),e.querySelectorAll(".sort-header").forEach(r=>{r.addEventListener("click",n=>{const o=n.currentTarget.closest(".sort-header").getAttribute("data-key");oe===o?me=me==="ASC"?"DESC":"ASC":(oe=o,me="DESC"),B=0;const l=e.parentElement.parentElement;l&&ee(l)})})}function Pa(e,a,t){let s=e[a.key];if(a.isRaw)try{s=(e.raw_data?JSON.parse(e.raw_data):{})[a.key]}catch{s=""}switch(a.type){case"residual":{let d=0;try{const m=e.raw_data?JSON.parse(e.raw_data):{};d=parseFloat(m.total_paid)||0}catch{}const i=parseFloat(e.amount_total)||0,c=d-i;return!c||c===0?'<td style="font-family:var(--font-en);color:var(--text-muted);">0</td>':`<td style="font-family:var(--font-en);font-weight:500;color:${c<0?"var(--accent-red)":"var(--text-primary)"};">${v(c,2)}</td>`}case"money":return!s||s===0?'<td style="font-family:var(--font-en);color:var(--text-muted);">0</td>':`<td style="font-family:var(--font-en);font-weight:500;color:${s<0?"var(--accent-red)":"var(--text-primary)"};">${v(s,2)}</td>`;case"date":return`<td style="font-family:var(--font-en);font-size:0.75rem;white-space:nowrap;">${s?s.split(" ")[0]:""}</td>`;case"code":return`<td style="font-family:var(--font-en);font-size:0.75rem;color:var(--accent-blue);font-weight:600;">${s||""}</td>`;case"badge":if(!s)return"<td></td>";const n=s==="posted";return`<td><span style="background:${n?"rgba(16,185,129,0.15)":"rgba(245,158,11,0.15)"};color:${n?"var(--accent-green)":"var(--accent-orange)"};padding:2px 6px;border-radius:4px;font-size:0.68rem;white-space:nowrap;">${s}</span></td>`;case"actions":return`<td>
         <button class="btn btn-secondary btn-sm btn-view-raw" data-idx="${t}" style="padding:4px 8px;font-size:0.7rem;">
           عرض JSON
         </button>
      </td>`;default:return`<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${(s||"").toString().replace(/"/g,"&quot;")}">${s||""}</td>`}}async function Ra(e){e.innerHTML='<div class="bi-empty">جاري تحميل مصمم التقرير الضريبي...</div>';try{let b=function($,g,w,_,q){$.innerHTML="",g.forEach(k=>{const L=w(k),M=document.createElement("option");M.value=L,M.innerText=_(k),q&&q.includes(L)&&(M.selected=!0),$.appendChild(M)})},h=function($){return $?Array.from($.selectedOptions||[]).map(g=>g.value):[]},z=function($){var I;if(!$||!$.periods||$.periods.length===0){m.innerHTML='<div class="bi-empty">لا توجد حركات ضريبية مطابقة لهذه الإعدادات.</div>';return}const g=$.summary,w=g.totalNet>=0?"#ef4444":"#10b981",_=g.totalNet>=0?"مستحقة للهيئة":"مستردة",q=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"],k={Q1:"الربع الأول",Q2:"الربع الثاني",Q3:"الربع الثالث",Q4:"الربع الرابع"};function L(E){return E.includes("-Q")?k[E.split("-")[1]]||E:E.length===7&&q[parseInt(E.split("-")[1])-1]||E}const j=$.periods.flatMap(E=>(E.items||[]).map(T=>({...T,periodKey:E.period}))).map(E=>{const T=E.type==="input"?'<span style="color:#10b981;">مشتريات</span>':'<span style="color:#ef4444;">مبيعات</span>',F=E.refundAmount>0?'<span style="color:#f59e0b; font-size:0.75rem; background:rgba(245, 158, 11, 0.1); padding:2px 4px; border-radius:4px; margin-right:6px;">مرتجع</span>':"",C=E.type==="input"?"#10b981":"#ef4444";return`
          <tr class="vat-detail-row-custom" data-period="${E.periodKey}" style="display:none;background:rgba(255,255,255,0.02);">
            <td>${E.date}</td>
            <td style="font-size:0.9rem;">${E.company.length>25?E.company.substring(0,25)+"…":E.company}</td>
            <td>${T} ${F}</td>
            <td style="font-size:0.85rem;color:rgba(255,255,255,0.6);">${E.journalEntry}</td>
            <td style="font-size:0.85rem;">${E.label} ${E.partner?'<br><span style="color:#3b82f6;">'+E.partner+"</span>":""}</td>
            <td class="n" style="color:${C};font-weight:600;">${x(Math.abs(E.netAmount))}</td>
          </tr>
        `}).join("");m.innerHTML=`
        <!-- KPI Cards -->
        <div class="bi-kpi-row" style="margin-bottom:24px;">
          <div class="bi-kpi">
            <div class="bi-kpi-label">المبيعات الإجمالية</div>
            <div class="bi-kpi-value" style="color:#ef4444;">${x(g.totalOutputBase)}</div>
            <div class="bi-kpi-sub" style="color:#ef4444;">يخصم منها مرتجعات: ${x(g.totalOutputRefund)}</div>
          </div>
          <div class="bi-kpi">
            <div class="bi-kpi-label">المشتريات الإجمالية</div>
            <div class="bi-kpi-value" style="color:#10b981;">${x(g.totalInputBase)}</div>
            <div class="bi-kpi-sub" style="color:#10b981;">يخصم منها مرتجعات: ${x(g.totalInputRefund)}</div>
          </div>
          <div class="bi-kpi">
            <div class="bi-kpi-label">صافي الإقرار</div>
            <div class="bi-kpi-value" style="color:${w};">${x(Math.abs(g.totalNet))}</div>
            <div class="bi-kpi-sub" style="color:${w};">${_}</div>
          </div>
        </div>

        <div class="bi-card">
          <div class="bi-card-title">التقرير النهائي المبني وفق الإعدادات</div>
          <div style="overflow-x:auto;">
            <table class="bi-table">
              <thead>
                <tr>
                  <th>الفترة</th>
                  <th class="n">المبيعات</th>
                  <th class="n">مرتجعات המبيعات</th>
                  <th class="n">صافي المخرجات</th>
                  <th class="n">المشتريات</th>
                  <th class="n">مرتجعات المشتريات</th>
                  <th class="n">صافي المدخلات</th>
                  <th class="n">الضريبة المستحقة</th>
                  <th>التفاصيل</th>
                </tr>
              </thead>
              <tbody>
                ${$.periods.map(E=>{const T=E.netVAT>=0?"#ef4444":"#10b981",A=E.netVAT>=0?"مستحقة":"مستردة";return`<tr>
                    <td style="font-weight:700;">${L(E.period)}</td>
                    <td class="n" style="color:rgba(239, 68, 68, 0.7);">${x(E.outputBase)}</td>
                    <td class="n" style="color:rgba(239, 68, 68, 0.5);">${x(E.outputRefund)}</td>
                    <td class="n" style="color:#ef4444;font-weight:700">${x(E.outputVAT)}</td>
                    <td class="n" style="color:rgba(16, 185, 129, 0.7);">${x(E.inputBase)}</td>
                    <td class="n" style="color:rgba(16, 185, 129, 0.5);">${x(E.inputRefund)}</td>
                    <td class="n" style="color:#10b981;font-weight:700">${x(E.inputVAT)}</td>
                    <td class="n" style="color:${T};font-weight:800;">${x(Math.abs(E.netVAT))} <span style="font-size:0.75rem;font-weight:normal;">(${A})</span></td>
                    <td><button class="btn btn-show-details-custom" data-period="${E.period}" style="font-size:0.8rem;padding:6px 12px;background:rgba(59,130,246,0.15);color:#60a5fa;border:1px solid rgba(59,130,246,0.3);border-radius:6px;cursor:pointer;">عرض القيود</button></td>
                  </tr>`}).join("")}
              </tbody>
              <tfoot>
                <tr style="background:rgba(255,255,255,0.05);">
                  <td style="font-weight:800;">الإجمالي</td>
                  <td class="n" style="color:rgba(239, 68, 68, 0.7);">${x(g.totalOutputBase)}</td>
                  <td class="n" style="color:rgba(239, 68, 68, 0.5);">${x(g.totalOutputRefund)}</td>
                  <td class="n" style="color:#ef4444;font-weight:700">${x(g.totalOutput)}</td>
                  <td class="n" style="color:rgba(16, 185, 129, 0.7);">${x(g.totalInputBase)}</td>
                  <td class="n" style="color:rgba(16, 185, 129, 0.5);">${x(g.totalInputRefund)}</td>
                  <td class="n" style="color:#10b981;font-weight:700">${x(g.totalInput)}</td>
                  <td class="n" style="color:${w};font-weight:800;">${x(Math.abs(g.totalNet))}</td>
                  <td style="color:${w};">${_}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- Details Table Container -->
          <div id="custom-details-container" style="display:none;margin-top:20px;padding-top:20px;border-top:1px solid rgba(255,255,255,0.1);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
              <h4 style="margin:0;color:#94a3b8;font-size:1rem;">القيود المضمنة (الفترة: <span id="custom-details-period-label" style="color:#fff;"></span>)</h4>
              <button id="custom-details-close" style="background:none;border:none;color:#ef4444;cursor:pointer;font-size:1.2rem;padding:0 8px;">X</button>
            </div>
            <div style="max-height:450px;overflow-y:auto;border-radius:8px;border:1px solid rgba(255,255,255,0.05);background:rgba(0,0,0,0.15);">
              <table class="bi-table" style="font-size:0.9rem;margin:0;">
                <thead style="position:sticky;top:0;background:#0f172a;z-index:10;">
                  <tr>
                    <th>التاريخ</th>
                    <th>الشركة</th>
                    <th>النوع</th>
                    <th>رقم القيد</th>
                    <th>البيان / الشريك</th>
                    <th class="n">المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  ${j}
                </tbody>
                <tbody id="custom-details-empty" style="display:none;">
                  <tr><td colspan="6" style="text-align:center;padding:24px;color:rgba(255,255,255,0.5);">لا توجد قيود مسجلة</td></tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      `,m.querySelectorAll(".btn-show-details-custom").forEach(E=>{E.addEventListener("click",()=>{const T=E.dataset.period;m.querySelector("#custom-details-period-label").innerText=L(T),m.querySelector("#custom-details-container").style.display="block";let A=!1;m.querySelectorAll(".vat-detail-row-custom").forEach(F=>{F.dataset.period===T?(F.style.display="table-row",A=!0):F.style.display="none"}),m.querySelector("#custom-details-empty").style.display=A?"none":"table-row-group"})}),(I=m.querySelector("#custom-details-close"))==null||I.addEventListener("click",()=>{m.querySelector("#custom-details-container").style.display="none"})};const a=await f.getCompanies();if(!a||a.length===0){e.innerHTML='<div class="bi-empty">لم يتم العثور على شركات.</div>';return}let t=a[0].id,s=new Date().getFullYear().toString(),r="monthly",n={vatAccounts:[],journals:[],moveNames:[]},o={inputAccounts:[],outputAccounts:[],excludedJournals:[],excludedMoveNames:[]};e.innerHTML=`
      <div class="bi-header">
        <h1 class="bi-title">مصمم التقرير الضريبي</h1>
        <div class="bi-actions">
          <select id="builder-co-select" class="bi-input">
            ${a.map($=>`<option value="${$.id}">${$.name}</option>`).join("")}
          </select>
          <select id="builder-year-select" class="bi-input">
            <option value="2023">2023</option>
            <option value="2024" selected>2024</option>
            <option value="2025">2025</option>
            <option value="2026">2026</option>
          </select>
          <select id="builder-period-select" class="bi-input">
            <option value="monthly" selected>شهري</option>
            <option value="quarterly">ربع سنوي</option>
            <option value="annual">سنوي</option>
          </select>
          <button id="btn-load-config" class="btn btn-primary">تحديث الإعدادات</button>
        </div>
      </div>
      
      <div class="bi-grid" style="grid-template-columns: 1fr; gap: 20px; align-items: start;">
        
        <div class="bi-card" style="max-width: 800px; margin: 0 auto;">
          <div class="bi-card-title">تخصيص الحسابات المستهدفة (اختياري)</div>
          <p style="color:#64748b; font-size:0.85rem; margin-bottom:16px;">
            تعتمد المنظومة ذكاءً آلياً لحساب ضرائب المبيعات والمشتريات تلقائياً من دفاترها، وتتجاهل قيود السداد. 
            إذا تُركت هذه الخيارات فارغة، سيتم تجميع أي حساب يحتوي على كلمة "ضريب".
          </p>
          
          <div style="margin-bottom: 16px;">
            <label style="display:block; margin-bottom: 8px; color: #94a3b8; font-size: 0.9rem;">حسابات مدخلات الضريبة (Input VAT)</label>
            <select id="builder-input-accs" multiple class="bi-input" style="height: 100px; width: 100%;">
              <option disabled>جاري التحميل...</option>
            </select>
          </div>

          <div style="margin-bottom: 16px;">
            <label style="display:block; margin-bottom: 8px; color: #94a3b8; font-size: 0.9rem;">حسابات مخرجات الضريبة (Output VAT)</label>
            <select id="builder-output-accs" multiple class="bi-input" style="height: 100px; width: 100%;">
              <option disabled>جاري التحميل...</option>
            </select>
          </div>
        </div>

      </div>

      <div style="display: flex; gap: 12px; margin-top: 20px;">
        <button id="btn-save-config" class="btn" style="background: #10b981; color: white; padding: 10px 24px;">حفظ الإعدادات</button>
        <button id="btn-run-report" class="btn btn-primary" style="padding: 10px 24px;">توليد التقرير بناءً على الإعدادات</button>
      </div>

      <div id="builder-results" style="margin-top: 30px;">
        <!-- Results will appear here -->
      </div>
    `;const l=document.getElementById("builder-co-select"),d=document.getElementById("builder-year-select"),i=document.getElementById("builder-period-select"),c=document.getElementById("builder-input-accs"),u=document.getElementById("builder-output-accs"),m=document.getElementById("builder-results");async function p(){try{const $=await f.getTaxReportConfig(t);n=$.options,o=$.config,b(document.getElementById("builder-input-accs"),n.vatAccounts,g=>g.account_name,g=>`${g.account_code} - ${g.account_name}`,o.inputAccounts),b(document.getElementById("builder-output-accs"),n.vatAccounts,g=>g.account_name,g=>`${g.account_code} - ${g.account_name}`,o.outputAccounts)}catch($){console.error($),alert("خطأ في تحميل الإعدادات: "+$.message)}}document.getElementById("btn-save-config").addEventListener("click",async()=>{const $={companyId:t,inputAccounts:h(document.getElementById("builder-input-accs")),outputAccounts:h(document.getElementById("builder-output-accs"))};try{(await f.saveTaxReportConfig($)).success&&alert("تم حفظ الإعدادات بنجاح!")}catch(g){alert("خطأ أثناء الحفظ: "+g.message)}}),document.getElementById("btn-run-report").addEventListener("click",async()=>{m.innerHTML='<div class="bi-empty">جاري بناء التقرير...</div>';const $={companyId:t,year:d.value,period:i.value,inputAccounts:h(document.getElementById("builder-input-accs")),outputAccounts:h(document.getElementById("builder-output-accs"))};try{const g=await f.generateCustomTaxReport($);z(g)}catch(g){m.innerHTML=`<div class="bi-empty" style="color:#ef4444;">خطأ: ${g.message}</div>`}});const x=$=>new Intl.NumberFormat("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}).format($||0);l.addEventListener("change",()=>{t=l.value,p()}),d.addEventListener("change",()=>{s=d.value}),i.addEventListener("change",()=>{r=i.value}),document.getElementById("btn-load-config").addEventListener("click",p),p()}catch(a){console.error("Builder init error:",a),e.innerHTML=`<div class="bi-empty" style="color:#ef4444">خطأ في التهيئة: ${a.message}</div>`}}const je={dashboard:_t,"income-statement":Et,"balance-sheet":Lt,"cash-flow":Mt,pivot:Tt,"journal-items":Ht,mapping:Pt,"journal-mapping":va,settings:Nt,"data-preview":ea,"trial-balance":sa,"detailed-trial-balance":na,"closing-entries":pa,"analytic-accounts":ma,presentation:wt,"account-statement":ha,guarantees:ka,"api-manager":Sa,"sales-settings":za,"sales-data-preview":Ba,"tax-builder":Ra};async function st(e){const a=document.getElementById("main-content");if(window.isViewerMode()&&e!=="presentation"){console.warn(`[RouteGuard] Viewer is restricted to presentation. Blocked: ${e}`),e="presentation",S.set("currentPage","presentation");const r=new URL(window.location);r.searchParams.get("page")!=="presentation"&&(r.searchParams.set("page","presentation"),window.history.replaceState({},"",r))}let s=je[e];if(e==="special-expenses"&&!s){const r=await Xe(()=>import("./special-expenses-iWwZHXEx.js"),__vite__mapDeps([0,1,2]));je["special-expenses"]=r.renderSpecialExpenses,s=r.renderSpecialExpenses}if(e==="viewers-management"&&!s){const r=await Xe(()=>import("./viewers-management-BW9dk85x.js"),__vite__mapDeps([3,1,2]));je["viewers-management"]=r.renderViewersManagement,s=r.renderViewersManagement}if(s){a.innerHTML='<div style="display:flex;align-items:center;justify-content:center;min-height:60vh;"><div class="spinner"></div></div>';try{await s(a)}catch(r){console.error(`Error rendering ${e}:`,r),a.innerHTML=`
        <div style="text-align:center;padding:60px;">
          <div style="font-size:2rem;margin-bottom:16px;">⚠️</div>
          <h2 style="color:var(--text-white);margin-bottom:8px;">حدث خطأ</h2>
          <p style="color:var(--text-muted);">${r.message}</p>
          <button class="btn btn-primary" style="margin-top:16px;" onclick="location.reload()">إعادة المحاولة</button>
        </div>
      `}}nt()}window.mizaniatLogout=function(){localStorage.removeItem("mizaniat_admin_token"),localStorage.removeItem("mizaniat_admin_info"),localStorage.removeItem("mizaniat_viewer_mode"),localStorage.removeItem("mizaniat_viewer_token"),sessionStorage.removeItem("mizaniat_viewer_token"),localStorage.removeItem("mizaniat_viewer_info"),window.location.href="/login.html"};window.isViewerMode=()=>localStorage.getItem("mizaniat_viewer_mode")==="true";async function Da(){const e=window.isViewerMode();if(e){const a=localStorage.getItem("mizaniat_viewer_token")||sessionStorage.getItem("mizaniat_viewer_token");if(!a){window.location.href="/login.html";return}try{if(!(await fetch("/api/auth/viewer/verify",{headers:{"x-viewer-token":a}})).ok){window.mizaniatLogout();return}}catch{}}else{const a=localStorage.getItem("mizaniat_admin_token");if(!a){window.location.href="/login.html";return}try{if(!(await fetch("/api/auth/admin/me",{headers:{Authorization:`Bearer ${a}`}})).ok){window.mizaniatLogout();return}}catch{}}console.log(e?"👁️ Mizaniat BI Viewer mode":"🚀 Mizaniat BI initializing...");try{const a=await f.getCompanies();S.set("companies",a),await kt(),nt(),S.subscribe(r=>{r==="currentPage"&&st(S.get("currentPage"))});let s=new URLSearchParams(window.location.search).get("page")||(e?"presentation":"dashboard");if(e&&s!=="presentation"){s="presentation";const r=new URL(window.location);r.searchParams.set("page","presentation"),window.history.replaceState({},"",r)}S.set("currentPage",s),await st(s),console.log("✅ Mizaniat BI ready")}catch(a){console.error("Init error:",a),document.getElementById("main-content").innerHTML=`
      <div style="text-align:center;padding:80px;">
        <div style="font-size:3rem;margin-bottom:24px;">📊</div>
        <h1 style="color:var(--text-white);margin-bottom:12px;">تقارير مالية</h1>
        <p style="color:var(--text-muted);margin-bottom:24px;">تعذر الاتصال بالخادم.</p>
        <button class="btn btn-primary" onclick="location.reload()">إعادة المحاولة</button>
      </div>
    `}}Da();
