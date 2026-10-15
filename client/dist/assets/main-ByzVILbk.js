const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/special-expenses-P9N5less.js","assets/presentation-CwYm_Zwm.js","assets/presentation-DNGxwLeA.css","assets/viewers-management-DpahoSB4.js"])))=>i.map(i=>d[i]);
import{s as S,a as y,b as h,f as v,g as Ze,c as ve,d as fe,h as it,E as lt,_ as Ke,r as zt,e as qt}from"./presentation-CwYm_Zwm.js";import{renderFilters as he,loadFilterOptions as Lt}from"./filters-B2gUj9PT.js";const Qe=[{id:"dashboard",icon:"📊",label:"لوحة التحكم",section:"رئيسي"},{id:"income-statement",icon:"📈",label:"قائمة الدخل",section:"التقارير المالية"},{id:"balance-sheet",icon:"⚖️",label:"الميزانية العمومية",section:"التقارير المالية"},{id:"cash-flow",icon:"💰",label:"التدفقات النقدية",section:"التقارير المالية"},{id:"special-expenses",icon:"💸",label:"مصروفات مخصصة",section:"التقارير المالية"},{id:"trial-balance",icon:"📝",label:"ميزان المراجعة",section:"التقارير المالية"},{id:"detailed-trial-balance",icon:"🔍",label:"ميزان تفصيلي",section:"التقارير المالية"},{id:"account-statement",icon:"📄",label:"كشف حساب",section:"التقارير المالية"},{id:"guarantees",icon:"🏦",label:"الضمانات البنكية",section:"التقارير المالية"},{id:"hajj-budget",icon:"🕋",label:"موازنات المشاريع",section:"التقارير المالية",url:"https://budget.jalbait.com"},{id:"pivot",icon:"🔄",label:"الجداول المحورية",section:"التحليل"},{id:"presentation",icon:"🎬",label:"عرض تقديمي",section:"التحليل"},{id:"tax-builder",icon:"🧾",label:"مصمم التقرير الضريبي",section:"التحليل"},{id:"journal-items",icon:"📋",label:"القيود المحاسبية",section:"التحليل"},{id:"data-preview",icon:"🗂️",label:"معاينة بيانات API",section:"التحليل"},{id:"sales-data-preview",icon:"🛒",label:"معاينة المبيعات API",section:"التحليل"},{id:"analytic-accounts",icon:"📂",label:"الحسابات التحليلية",section:"الإعدادات"},{id:"mapping",icon:"🔗",label:"توحيد الحسابات",section:"الإعدادات"},{id:"journal-mapping",icon:"🎯",label:"توحيد اليوميات",section:"الإعدادات"},{id:"viewers-management",icon:"👥",label:"إدارة المشاهدين",section:"الإعدادات"},{id:"settings",icon:"⚙️",label:"إعدادات النظام",section:"الإعدادات"},{id:"sales-settings",icon:"🛍️",label:"إعدادات نظام المبيعات",section:"الإعدادات"},{id:"api-manager",icon:"🔌",label:"إدارة الـ APIs",section:"الإعدادات"}];function dt(){const e=document.getElementById("sidebar-nav"),t=document.getElementById("sidebar"),a=document.getElementById("main-content"),s=document.getElementById("sidebar-toggle"),r=S.get("currentPage"),o=window.isViewerMode&&window.isViewerMode();S.get("sidebarCollapsed")?(t.classList.add("collapsed"),a.classList.add("sidebar-collapsed"),s&&(s.querySelector("span").textContent="►")):(t.classList.remove("collapsed"),a.classList.remove("sidebar-collapsed"),s&&(s.querySelector("span").textContent="◄"));const n=o?Qe.filter(b=>b.id==="presentation"||b.id==="hajj-budget"):Qe;let i="",p="";for(const b of n)b.section!==p&&(p=b.section,i+=`<div class="nav-section-title">${p}</div>`),i+=`
      <div class="nav-item ${r===b.id?"active":""}" data-page="${b.id}">
        <span class="nav-item-icon">${b.icon}</span>
        <span class="nav-item-label">${b.label}</span>
      </div>
    `;const c=JSON.parse(localStorage.getItem("mizaniat_admin_info")||"{}"),l=JSON.parse(localStorage.getItem("mizaniat_viewer_info")||"{}"),u=o?"👁️ "+(l.name||c.name||"مشاهد"):c.name||c.email||"مدير";i+=`
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
  `,e.innerHTML=i,e.querySelectorAll(".nav-item[data-page]").forEach(b=>{b.addEventListener("click",()=>{const x=b.dataset.page,z=n.find(w=>w.id===x);z&&z.url?window.open(z.url,"_blank"):S.set("currentPage",x)})});const d=document.getElementById("logout-btn");d&&d.addEventListener("click",()=>{confirm("هل تريد تسجيل الخروج؟")&&window.mizaniatLogout()}),s&&(s.onclick=()=>{t.classList.toggle("collapsed"),a.classList.toggle("sidebar-collapsed"),S.set("sidebarCollapsed",t.classList.contains("collapsed")),s.querySelector("span").textContent=t.classList.contains("collapsed")?"►":"◄"});const g=document.getElementById("mobile-menu-btn"),f=document.getElementById("sidebar-backdrop");g&&(g.onclick=()=>{const b=t.classList.toggle("mobile-open");f&&f.classList.toggle("active",b)}),f&&(f.onclick=()=>{t.classList.remove("mobile-open"),f.classList.remove("active")}),e.querySelectorAll(".nav-item").forEach(b=>{b.addEventListener("click",()=>{t.classList.remove("mobile-open"),f&&f.classList.remove("active")})})}async function Et(e){e.innerHTML=`
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
    <div class="dashboard-page" style="width: 100%; min-width: 0; box-sizing: border-box;">
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
    </div>
  `;const t=e.querySelector("#dashboard-filters");he(t,()=>Ie(e)),await Ie(e),e.querySelector("#btn-sync").addEventListener("click",async()=>{try{y("جاري مزامنة البيانات...","info");const a=await h.syncAll();y("تمت المزامنة بنجاح","success"),await Ie(e)}catch(a){y("فشلت المزامنة: "+a.message,"error")}})}async function Ie(e){try{const t=S.getFilterParams(),a=await h.getDashboard(t);It(e.querySelector("#kpi-grid"),a),jt(e.querySelector("#dash-charts"),a)}catch(t){console.error("Dashboard error:",t),y("خطأ في تحميل البيانات","error")}}function It(e,t){const a=t.totalRevenue>0?(t.netProfit/t.totalRevenue*100).toFixed(1):"0.0";e.innerHTML=`
    <div class="kpi-card blue fade-in">
      <div class="kpi-icon blue">📈</div>
      <div class="kpi-label">إجمالي الإيرادات</div>
      <div class="kpi-value" style="font-size:clamp(1rem, 2vw, 1.4rem); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${v(t.totalRevenue,0)}</div>
      <div class="kpi-change positive">SAR</div>
    </div>
    
    <div class="kpi-card red fade-in" style="animation-delay:0.05s">
      <div class="kpi-icon red">📉</div>
      <div class="kpi-label">إجمالي المصروفات</div>
      <div class="kpi-value" style="font-size:clamp(1rem, 2vw, 1.4rem); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${v(t.totalExpenses,0)}</div>
      <div class="kpi-change negative">SAR</div>
    </div>
    
    <div class="kpi-card emerald fade-in" style="animation-delay:0.1s">
      <div class="kpi-icon emerald">💵</div>
      <div class="kpi-label">صافي الربح</div>
      <div class="kpi-value" style="font-size:clamp(1rem, 2vw, 1.4rem); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${v(t.netProfit,0)}</div>
      <div class="kpi-change ${t.netProfit>=0?"positive":"negative"}">
        ${t.netProfit>=0?"↑":"↓"} ${a}%
      </div>
    </div>
    
    <div class="kpi-card purple fade-in" style="animation-delay:0.15s">
      <div class="kpi-icon purple">🏢</div>
      <div class="kpi-label">إجمالي الأصول</div>
      <div class="kpi-value" style="font-size:clamp(1rem, 2vw, 1.4rem); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${v(t.totalAssets,0)}</div>
      <div class="kpi-change" style="color:var(--text-muted);">SAR</div>
    </div>
    
    <div class="kpi-card amber fade-in" style="animation-delay:0.2s">
      <div class="kpi-icon amber">📊</div>
      <div class="kpi-label">إجمالي الالتزامات</div>
      <div class="kpi-value" style="font-size:clamp(1rem, 2vw, 1.4rem); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${v(t.totalLiabilities,0)}</div>
      <div class="kpi-change" style="color:var(--text-muted);">SAR</div>
    </div>
    
    <div class="kpi-card cyan fade-in" style="animation-delay:0.25s">
      <div class="kpi-icon cyan">💵</div>
      <div class="kpi-label">النقدية المتاحة</div>
      <div class="kpi-value" style="font-size:clamp(1rem, 2vw, 1.4rem); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${v(t.cashPosition,0)}</div>
      <div class="kpi-change" style="color:var(--text-muted);">SAR</div>
    </div>
    
    <div class="kpi-card teal fade-in" style="animation-delay:0.3s">
      <div class="kpi-icon teal">🏦</div>
      <div class="kpi-label">الضمانات البنكية</div>
      <div class="kpi-value" style="font-size:clamp(1rem, 2vw, 1.4rem); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${v(t.guarantees||0,0)}</div>
      <div class="kpi-change" style="color:var(--text-muted);">أصول محتجزة</div>
    </div>
  `}function jt(e,t){const a=t.revenueByPeriod||[],s=t.expensesByPeriod||[],r=t.revenueByCompany||[],o=t.expensesByCompany||[],n=[...new Set([...a.map(m=>m.period),...s.map(m=>m.period)])].sort(),p=[...new Set(n.map(m=>m?m.split("-")[0]:""))].sort().pop()||"",c=p?a.filter(m=>m.period&&m.period.startsWith(p)):a,l=p?s.filter(m=>m.period&&m.period.startsWith(p)):s,u=Math.max(...c.map(m=>m.total),1),d=Math.max(...l.map(m=>m.total),1),g=["#3b82f6","#10b981","#06b6d4","#8b5cf6","#ec4899","#14b8a6"],f=["#ef4444","#f59e0b","#ec4899","#f97316","#e11d48","#dc2626"],b=r.reduce((m,$)=>m+$.total,0),x=o.reduce((m,$)=>m+$.total,0),z=c.reduce((m,$)=>m+$.total,0),w=l.reduce((m,$)=>m+$.total,0);e.innerHTML=`
    <!-- Donut Charts Row -->
    <div class="dash-donuts-row">
      <!-- Expenses Donut -->
      <div class="dash-donut-card fade-in">
        <div class="dash-donut-title">🍩 المصروفات حسب الشركة</div>
        <div class="dash-donut-content">
          <div class="dash-donut-ring">
            <svg viewBox="0 0 200 200">${et(o,f,200)}</svg>
            <div class="dash-donut-center">
              <div class="dash-donut-center-label">الإجمالي</div>
              <div class="dash-donut-center-value" style="color:#ef4444;">${W(x)}</div>
            </div>
          </div>
          <div class="dash-legend">
            ${o.map((m,$)=>{const _=x>0?(m.total/x*100).toFixed(1):"0.0";return`
              <div class="dash-legend-item">
                <span class="dash-legend-dot" style="background:${f[$%f.length]}"></span>
                <span class="dash-legend-name">${m.company_name}</span>
                <span class="dash-legend-pct">${_}%</span>
                <span class="dash-legend-val" style="color:${f[$%f.length]}">${W(m.total)}</span>
              </div>`}).join("")}
          </div>
        </div>
      </div>

      <!-- Revenue Donut -->
      <div class="dash-donut-card fade-in" style="animation-delay:0.08s">
        <div class="dash-donut-title">🍩 الإيرادات حسب الشركة</div>
        <div class="dash-donut-content">
          <div class="dash-donut-ring">
            <svg viewBox="0 0 200 200">${et(r,g,200)}</svg>
            <div class="dash-donut-center">
              <div class="dash-donut-center-label">الإجمالي</div>
              <div class="dash-donut-center-value" style="color:#10b981;">${W(b)}</div>
            </div>
          </div>
          <div class="dash-legend">
            ${r.map((m,$)=>{const _=b>0?(m.total/b*100).toFixed(1):"0.0";return`
              <div class="dash-legend-item">
                <span class="dash-legend-dot" style="background:${m.color||g[$%g.length]}"></span>
                <span class="dash-legend-name">${m.company_name}</span>
                <span class="dash-legend-pct">${_}%</span>
                <span class="dash-legend-val" style="color:${m.color||g[$%g.length]}">${W(m.total)}</span>
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
          ${p?`<span style="font-size:0.8rem;color:rgba(255,255,255,0.3);font-family:var(--font-en);">${p}</span>`:""}
          <span class="dash-bar-total" style="color:#10b981;">${W(z)}</span>
        </div>
        <div class="dash-bars">
          ${c.map(m=>{const $=m.total/u*100,_=m.period?m.period.split("-")[1]:"";return`
            <div class="dash-bar-item">
              <div class="dash-bar-val">${W(m.total)}</div>
              <div class="dash-bar" style="height:${Math.max($,2)}%;background:linear-gradient(to top, #3b82f6, #60a5fa);" title="${v(m.total,2)} SAR"></div>
              <div class="dash-bar-lbl">${Ze(_)}</div>
            </div>`}).join("")}
        </div>
      </div>

      <!-- Monthly Expenses -->
      <div class="dash-bar-card fade-in" style="animation-delay:0.16s">
        <div class="dash-bar-title">
          📉 المصروفات الشهرية
          ${p?`<span style="font-size:0.8rem;color:rgba(255,255,255,0.3);font-family:var(--font-en);">${p}</span>`:""}
          <span class="dash-bar-total" style="color:#ef4444;">${W(w)}</span>
        </div>
        <div class="dash-bars">
          ${l.map(m=>{const $=m.total/d*100,_=m.period?m.period.split("-")[1]:"";return`
            <div class="dash-bar-item">
              <div class="dash-bar-val">${W(m.total)}</div>
              <div class="dash-bar" style="height:${Math.max($,2)}%;background:linear-gradient(to top, #ef4444, #f87171);" title="${v(m.total,2)} SAR"></div>
              <div class="dash-bar-lbl">${Ze(_)}</div>
            </div>`}).join("")}
        </div>
      </div>
    </div>
  `}function et(e,t,a){const s=e.reduce((l,u)=>l+Math.abs(u.total),0),r=a/2,o=a/2,n=a*.35,i=a*.12;if(s===0)return`<circle cx="${r}" cy="${o}" r="${n}" fill="none" stroke="rgba(99,130,255,0.08)" stroke-width="${i}"/>`;let p=0;const c=2*Math.PI*n;return e.map((l,u)=>{const d=Math.abs(l.total)/s,g=d*c,f=e.length>1?2:0,b=-p*c;return p+=d,`<circle cx="${r}" cy="${o}" r="${n}" fill="none" 
      stroke="${t[u%t.length]}" 
      stroke-width="${i}" 
      stroke-dasharray="${Math.max(g-f,0)} ${c-Math.max(g-f,0)}" 
      stroke-dashoffset="${b}"
      transform="rotate(-90 ${r} ${o})"
      stroke-linecap="round"
      style="transition: stroke-dasharray 0.6s ease;"/>`}).join("")}function W(e){const t=Math.abs(e);return t>=1e6?(e/1e6).toFixed(1)+"M":t>=1e3?(e/1e3).toFixed(0)+"K":v(e,0)}async function Tt(e){e.innerHTML=`
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
  `;const t=e.querySelector("#is-filters");he(t,()=>je(e)),e.querySelector("#chk-eliminations").addEventListener("change",()=>je(e)),await je(e)}async function je(e){try{const t=S.getFilterParams();t.useEliminations=e.querySelector("#chk-eliminations").checked;const a=await h.getIncomeStatement(t);Mt(e.querySelector("#is-content"),a)}catch{y("خطأ في تحميل قائمة الدخل","error")}}function Mt(e,t){const a=S.get("companies"),s=S.get("selectedCompanyIds"),r=s.length>0?a.filter(n=>s.includes(n.id)):a,o=r.length>1;e.innerHTML=`
    <div class="data-table-wrapper fade-in">
      <table class="data-table">
        <thead>
          <tr>
            <th style="min-width:200px;">الحساب</th>
            <th>الكود</th>
            ${o?r.map(n=>`<th class="number">${n.name}</th>`).join(""):""}
            <th class="number">المجمع</th>
          </tr>
        </thead>
        <tbody>
          <!-- Revenue Section -->
          <tr class="group-header"><td colspan="${o?r.length+3:3}">الإيرادات</td></tr>
          ${t.revenue.map(n=>tt(n,r,o)).join("")}
          <tr class="total-row">
            <td>إجمالي الإيرادات</td>
            <td></td>
            ${o?r.map(n=>{const i=t.revenue.reduce((p,c)=>{var l;return p+(((l=c.companies[n.id])==null?void 0:l.amount)||0)},0);return`<td class="number">${v(i,2)}</td>`}).join(""):""}
            <td class="number positive">${v(t.summary.totalRevenue,2)}</td>
          </tr>
          
          <!-- Expenses Section -->
          <tr class="group-header"><td colspan="${o?r.length+3:3}">المصروفات</td></tr>
          ${t.expenses.map(n=>tt(n,r,o,!0)).join("")}
          <tr class="total-row">
            <td>إجمالي المصروفات</td>
            <td></td>
            ${o?r.map(n=>{const i=t.expenses.reduce((p,c)=>{var l;return p+(((l=c.companies[n.id])==null?void 0:l.amount)||0)},0);return`<td class="number negative">(${v(i,2)})</td>`}).join(""):""}
            <td class="number negative">(${v(t.summary.totalExpenses,2)})</td>
          </tr>

          ${t.eliminations&&t.eliminations.length>0?`
            <tr class="group-header"><td colspan="${o?r.length+3:3}">تعديلات الاستبعاد</td></tr>
            ${t.eliminations.map(n=>`
              <tr>
                <td>${n.rule_name}</td>
                <td></td>
                ${o?r.map(()=>"<td></td>").join(""):""}
                <td class="number negative">(${v(n.debit-n.credit,2)})</td>
              </tr>
            `).join("")}
          `:""}
          
          <!-- Net Profit -->
          <tr class="total-row" style="font-size:1.1em;">
            <td>صافي الربح / (الخسارة)</td>
            <td></td>
            ${o?r.map(()=>"<td></td>").join(""):""}
            <td class="number ${t.summary.netProfit>=0?"positive":"negative"}" style="font-size:1.1em;">
              ${t.summary.netProfit>=0?"":"("}${v(Math.abs(t.summary.netProfit),2)}${t.summary.netProfit>=0?"":")"}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `}function tt(e,t,a,s=!1){return`
    <tr class="indent-1">
      <td>${e.account_name}</td>
      <td style="font-family:var(--font-en);color:var(--text-muted);font-size:0.8em;">${e.account_code}</td>
      ${a?t.map(r=>{var n;const o=((n=e.companies[r.id])==null?void 0:n.amount)||0;return`<td class="number">${s&&o>0?"(":""}${v(Math.abs(o),2)}${s&&o>0?")":""}</td>`}).join(""):""}
      <td class="number ${s?"negative":"positive"}">
        ${s&&e.total>0?"(":""}${v(Math.abs(e.total),2)}${s&&e.total>0?")":""}
      </td>
    </tr>
  `}async function Ct(e){e.innerHTML=`
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
  `;const t=e.querySelector("#bs-filters");he(t,()=>Te(e)),e.querySelector("#chk-bs-eliminations").addEventListener("change",()=>Te(e)),await Te(e)}async function Te(e){try{const t=S.getFilterParams();t.asOfDate=t.dateTo||new Date().toISOString().split("T")[0],t.useEliminations=e.querySelector("#chk-bs-eliminations").checked;const a=await h.getBalanceSheet(t);At(e.querySelector("#bs-content"),a)}catch{y("خطأ في تحميل الميزانية العمومية","error")}}function At(e,t){const a=S.get("companies"),s=S.get("selectedCompanyIds"),r=s.length>0?a.filter(c=>s.includes(c.id)):a,o=r.length>1,n=o?r.length+3:3,i=t.assets.filter(c=>!c.is_guarantee),p=t.assets.filter(c=>c.is_guarantee);e.innerHTML=`
    <div class="data-table-wrapper fade-in">
      <table class="data-table">
        <thead>
          <tr>
            <th style="min-width:200px;">الحساب</th>
            <th>الكود</th>
            ${o?r.map(c=>`<th class="number">${c.name}</th>`).join(""):""}
            <th class="number">المجمع</th>
          </tr>
        </thead>
        <tbody>
          <!-- Assets -->
          <tr class="group-header"><td colspan="${n}">الأصول</td></tr>
          ${i.map(c=>xe(c,r,o)).join("")}
          ${p.length>0?`
            <tr class="group-header" style="background: rgba(6, 182, 212, 0.08); color: #0891b2; font-size: 0.92em; padding-right: 20px;">
              <td colspan="${n}">🏦 الضمانات البنكية (أصول محتجزة)</td>
            </tr>
            ${p.map(c=>xe(c,r,o)).join("")}
          `:""}
          <tr class="total-row">
            <td>إجمالي الأصول</td><td></td>
            ${o?r.map(c=>{const l=t.assets.reduce((u,d)=>{var g;return u+(((g=d.companies[c.id])==null?void 0:g.amount)||0)},0);return`<td class="number">${v(l,2)}</td>`}).join(""):""}
            <td class="number positive">${v(t.summary.totalAssets,2)}</td>
          </tr>
          
          <!-- Liabilities -->
          <tr class="group-header"><td colspan="${n}">الالتزامات</td></tr>
          ${t.liabilities.map(c=>xe(c,r,o)).join("")}
          <tr class="total-row">
            <td>إجمالي الالتزامات</td><td></td>
            ${o?r.map(c=>{const l=t.liabilities.reduce((u,d)=>{var g;return u+(((g=d.companies[c.id])==null?void 0:g.amount)||0)},0);return`<td class="number">${v(l,2)}</td>`}).join(""):""}
            <td class="number">${v(t.summary.totalLiabilities,2)}</td>
          </tr>
          
          <!-- Equity -->
          <tr class="group-header"><td colspan="${n}">حقوق الملكية</td></tr>
          ${t.equity.map(c=>xe(c,r,o)).join("")}
          <tr class="total-row">
            <td>إجمالي حقوق الملكية</td><td></td>
            ${o?r.map(c=>{const l=t.equity.reduce((u,d)=>{var g;return u+(((g=d.companies[c.id])==null?void 0:g.amount)||0)},0);return`<td class="number">${v(l,2)}</td>`}).join(""):""}
            <td class="number">${v(t.summary.totalEquity,2)}</td>
          </tr>

          <!-- Total L+E -->
          <tr class="total-row" style="font-size:1.1em;">
            <td>إجمالي الالتزامات + حقوق الملكية</td><td></td>
            ${o?r.map(()=>"<td></td>").join(""):""}
            <td class="number positive" style="font-size:1.1em;">
              ${v(t.summary.totalLiabilities+t.summary.totalEquity,2)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `}function xe(e,t,a){const s=e.account_code==="RE-CALC"||e.account_code==="CYE",r=!!e.is_guarantee,o=s?"font-style: italic; background: rgba(59, 130, 246, 0.05);":r?"background: rgba(6, 182, 212, 0.03);":"";let n="";return s?n=' <span style="font-size:0.75em; background:var(--primary-subtle, rgba(59,130,246,0.1)); color:var(--primary, #3b82f6); border:1px solid rgba(59,130,246,0.25); border-radius:4px; padding:1px 6px; font-style:normal; margin-right:4px;">محسوب</span>':r&&(n=' <span style="font-size:0.75em; background:rgba(6,182,212,0.1); color:#0891b2; border:1px solid rgba(6,182,212,0.25); border-radius:4px; padding:1px 6px; font-style:normal; margin-right:4px;">ضمان</span>'),`
    <tr class="indent-1" style="${o}">
      <td>${e.account_name}${n}</td>
      <td style="font-family:var(--font-en);color:var(--text-muted);font-size:0.8em;">${e.account_code}</td>
      ${a?t.map(i=>{var c;const p=((c=e.companies[i.id])==null?void 0:c.amount)||0;return`<td class="number">${v(p,2)}</td>`}).join(""):""}
      <td class="number">${v(e.total,2)}</td>
    </tr>
  `}async function Ht(e){e.innerHTML=`
    <div class="page-header">
      <div>
        <h1 class="page-title">قائمة التدفقات النقدية المجمعة</h1>
        <p class="page-subtitle">Consolidated Cash Flow Statement</p>
      </div>
    </div>
    
    <div class="filters-bar" id="cf-filters"></div>
    <div id="cf-content"><div class="skeleton" style="height:400px;border-radius:var(--radius-lg);"></div></div>
  `,he(e.querySelector("#cf-filters"),()=>at(e)),await at(e)}async function at(e){try{const t=S.getFilterParams(),a=await h.getCashFlow(t);Bt(e.querySelector("#cf-content"),a)}catch{y("خطأ في تحميل التدفقات النقدية","error")}}const Me={income:"إيرادات",income_other:"إيرادات أخرى",expense:"مصروفات تشغيلية",expense_direct_cost:"تكلفة مبيعات",expense_depreciation:"استهلاك",revenue:"إيرادات",cost_of_revenue:"تكلفة إيرادات",asset_receivable:"تغير في الذمم المدينة",liability_payable:"تغير في الذمم الدائنة",asset_current:"تغير في الأصول المتداولة",liability_current:"تغير في الالتزامات المتداولة",asset_non_current:"أصول غير متداولة",asset_fixed:"أصول ثابتة",equity:"حقوق ملكية",equity_unaffected:"أرباح مبقاة",liability_non_current:"التزامات طويلة الأجل",bank_guarantees:"ضمانات بنكية"};function Bt(e,t){const a=t.operating.reduce((n,i)=>n+i.amount,0),s=t.investing.reduce((n,i)=>n+i.amount,0),r=t.financing.reduce((n,i)=>n+i.amount,0),o=a+s+r;e.innerHTML=`
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
          ${t.operating.map(n=>`
            <tr class="indent-1">
              <td>${Me[n.account_type]||n.account_type}</td>
              <td class="number ${n.amount>=0?"":"negative"}">
                ${n.amount<0?"(":""}${v(Math.abs(n.amount),2)}${n.amount<0?")":""}
              </td>
            </tr>
          `).join("")}
          <tr class="total-row">
            <td>صافي النقد من الأنشطة التشغيلية</td>
            <td class="number ${a>=0?"positive":"negative"}">
              ${a<0?"(":""}${v(Math.abs(a),2)}${a<0?")":""}
            </td>
          </tr>

          <tr class="group-header"><td colspan="2">الأنشطة الاستثمارية</td></tr>
          ${t.investing.map(n=>`
            <tr class="indent-1">
              <td>${Me[n.account_type]||n.account_type}</td>
              <td class="number ${n.amount>=0?"":"negative"}">
                ${n.amount<0?"(":""}${v(Math.abs(n.amount),2)}${n.amount<0?")":""}
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
          ${t.financing.map(n=>`
            <tr class="indent-1">
              <td>${Me[n.account_type]||n.account_type}</td>
              <td class="number ${n.amount>=0?"":"negative"}">
                ${n.amount<0?"(":""}${v(Math.abs(n.amount),2)}${n.amount<0?")":""}
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
            <td class="number ${o>=0?"positive":"negative"}" style="font-size:1.05em;">
              ${o<0?"(":""}${v(Math.abs(o),2)}${o<0?")":""}
            </td>
          </tr>
          ${t.summary?`
          <tr class="total-row">
            <td>رصيد النقد في بداية الفترة</td>
            <td class="number">${v(t.summary.openingCash||0,2)}</td>
          </tr>
          <tr class="total-row" style="font-size:1.15em; border-top:2px solid var(--border-color);">
            <td>رصيد النقد في نهاية الفترة</td>
            <td class="number positive" style="font-size:1.15em;">
              ${v(t.summary.closingCash||0,2)}
            </td>
          </tr>
          `:""}
        </tbody>
      </table>
    </div>
  `}let G=["account"],Y=["period"],He="balance";async function Pt(e){e.innerHTML=`
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
  `,he(e.querySelector("#pivot-filters"),()=>ye(e)),we(e),await ye(e)}const Be=[{id:"account",label:"الحساب"},{id:"account_type",label:"نوع الحساب"},{id:"company",label:"الشركة"},{id:"period",label:"الفترة"},{id:"fiscal_year",label:"السنة المالية"},{id:"journal",label:"اليومية"},{id:"partner",label:"الشريك"},{id:"cost_center",label:"مركز التكلفة"}],Rt=[{id:"balance",label:"الرصيد"},{id:"debit",label:"المدين"},{id:"credit",label:"الدائن"},{id:"count",label:"العدد"}];function we(e){const t=e.querySelector("#pivot-rows"),a=e.querySelector("#pivot-cols"),s=e.querySelector("#pivot-measure");t.innerHTML=Be.map(r=>`
    <span class="pivot-chip ${G.includes(r.id)?"active":""}" data-dim="${r.id}">${r.label}</span>
  `).join(""),a.innerHTML=Be.map(r=>`
    <span class="pivot-chip ${Y.includes(r.id)?"active":""}" data-dim="${r.id}">${r.label}</span>
  `).join(""),s.innerHTML=Rt.map(r=>`
    <span class="pivot-chip ${He===r.id?"active":""}" data-measure="${r.id}">${r.label}</span>
  `).join(""),t.querySelectorAll(".pivot-chip").forEach(r=>{r.addEventListener("click",()=>{const o=r.dataset.dim;G.includes(o)?G=G.filter(n=>n!==o):G.push(o),G.length===0&&(G=["account"]),we(e),ye(e)})}),a.querySelectorAll(".pivot-chip").forEach(r=>{r.addEventListener("click",()=>{const o=r.dataset.dim;Y.includes(o)?Y=Y.filter(n=>n!==o):Y.push(o),Y.length===0&&(Y=["period"]),we(e),ye(e)})}),s.querySelectorAll(".pivot-chip").forEach(r=>{r.addEventListener("click",()=>{He=r.dataset.measure,we(e),ye(e)})})}async function ye(e){try{const t={...S.getFilterParams(),rows:G.join(","),columns:Y.join(","),measure:He},a=await h.getPivotData(t);Dt(e.querySelector("#pivot-content"),a)}catch(t){y("خطأ في تحميل الجدول المحوري","error"),console.error(t)}}function Dt(e,t){var u;if(!t||t.length===0){e.innerHTML='<div class="card" style="text-align:center;padding:60px;color:var(--text-muted);">لا توجد بيانات للعرض</div>';return}const a={company:"c.name",account:"ji.account_code",account_name:"ji.account_name",account_type:"ji.account_type",period:"ji.period",fiscal_year:"ji.fiscal_year",journal:"ji.journal_name",partner:"ji.partner_name",cost_center:"ji.analytic_account"},s=Y[0],r=a[s]||s,o=r.includes(".")?r.split(".")[1]:r,n=[...new Set(t.map(d=>d[o]||d[Object.keys(d).find(g=>g.includes(o.replace("ji.","").replace("c.","")))]||""))].filter(d=>d).sort(),i=G[0],p=a[i]||i,c=p.includes(".")?p.split(".")[1]:p,l={};for(const d of t){const g=d[c]||d[Object.keys(d).find(b=>b.includes(c.replace("ji.","").replace("c.","")))]||"غير محدد",f=d[o]||d[Object.keys(d).find(b=>b.includes(o.replace("ji.","").replace("c.","")))]||"";l[g]||(l[g]={}),l[g][f]=(l[g][f]||0)+(d.value||0)}e.innerHTML=`
    <div class="data-table-wrapper fade-in">
      <table class="data-table">
        <thead>
          <tr>
            <th>${((u=Be.find(d=>d.id===i))==null?void 0:u.label)||i}</th>
            ${n.map(d=>`<th class="number">${d}</th>`).join("")}
            <th class="number">المجموع</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(l).map(([d,g])=>{const f=Object.values(g).reduce((b,x)=>b+x,0);return`
              <tr>
                <td>${d}</td>
                ${n.map(b=>{const x=g[b]||0;return`<td class="number ${x<0?"negative":""}">${v(x,2)}</td>`}).join("")}
                <td class="number" style="font-weight:600;">${v(f,2)}</td>
              </tr>
            `}).join("")}
          <tr class="total-row">
            <td>المجموع</td>
            ${n.map(d=>{const g=Object.values(l).reduce((f,b)=>f+(b[d]||0),0);return`<td class="number">${v(g,2)}</td>`}).join("")}
            <td class="number">${v(Object.values(l).reduce((d,g)=>d+Object.values(g).reduce((f,b)=>f+b,0),0),2)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `}let K=0;const Pe=50;async function Ft(e){e.innerHTML=`
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
          ${S.get("companies").map(t=>`<option value="${t.id}">${t.name}</option>`).join("")}
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
  `,e.querySelector("#btn-ji-search").addEventListener("click",()=>{K=0,Se(e)}),await Se(e)}async function Se(e){try{const t=e.querySelector("#ji-company").value,a={limit:Pe,offset:K*Pe,dateFrom:e.querySelector("#ji-date-from").value,dateTo:e.querySelector("#ji-date-to").value,accountCode:e.querySelector("#ji-account").value};t&&(a.companyIds=[parseInt(t)]);const s=await h.getJournalItems(a);Ot(e,s)}catch{y("خطأ في تحميل القيود","error")}}function Ot(e,t){var i,p;const a=e.querySelector("#ji-content"),{items:s,total:r}=t,o=Math.ceil(r/Pe);a.innerHTML=`
    <div style="margin-bottom:var(--space-md);font-size:0.8rem;color:var(--text-muted);">
      إجمالي النتائج: ${v(r)} | الصفحة ${K+1} من ${o||1}
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
          ${s.map(c=>`
            <tr>
              <td style="font-family:var(--font-en);font-size:0.8em;white-space:nowrap;">${c.date}</td>
              <td><span class="badge badge-info">${c.company_name||""}</span></td>
              <td style="font-family:var(--font-en);">${c.account_code||""}</td>
              <td>${c.account_name||""}</td>
              <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;">${c.label||""}</td>
              <td>${c.partner_name||""}</td>
              <td class="number">${c.debit>0?v(c.debit,2):""}</td>
              <td class="number">${c.credit>0?v(c.credit,2):""}</td>
              <td class="number ${c.balance>=0?"":"negative"}">${v(c.balance,2)}</td>
              <td style="font-family:var(--font-en);font-size:0.75em;color:var(--text-muted);">${c.move_name||""}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;const n=e.querySelector("#ji-pagination");o>1?(n.innerHTML=`
      <button class="btn btn-sm btn-secondary" ${K===0?"disabled":""} id="btn-prev">السابق</button>
      <span style="display:flex;align-items:center;font-size:0.85rem;color:var(--text-secondary);">
        ${K+1} / ${o}
      </span>
      <button class="btn btn-sm btn-secondary" ${K>=o-1?"disabled":""} id="btn-next">التالي</button>
    `,(i=n.querySelector("#btn-prev"))==null||i.addEventListener("click",()=>{K--,Se(e)}),(p=n.querySelector("#btn-next"))==null||p.addEventListener("click",()=>{K++,Se(e)})):n.innerHTML=""}async function Nt(e){e.innerHTML=`
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
        ${S.get("companies").map(t=>`<option value="${t.id}">${t.name}</option>`).join("")}
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
  `,e.querySelector("#mapping-company").addEventListener("change",()=>st(e)),e.querySelector("#btn-add-unified").addEventListener("click",()=>Xt()),await st(e)}async function st(e){try{const t=e.querySelector("#mapping-company").value,[a,s]=await Promise.all([h.getCompanyAccounts(t),h.getUnifiedAccounts()]);Vt(e.querySelector("#company-accounts-list"),a,s,t),Jt(e.querySelector("#unified-accounts-list"),s),Ut(e.querySelector("#mapping-stats"),a)}catch{y("خطأ في تحميل بيانات التوحيد","error")}}function Vt(e,t,a,s){e.innerHTML=t.map(r=>`
    <div class="mapping-item ${r.is_mapped?"mapped":"unmapped"}">
      <div>
        <div style="font-family:var(--font-en);font-size:0.8em;color:var(--text-muted);">${r.code}</div>
        <div style="font-size:0.85rem;">${r.name}</div>
        ${r.unified_name?`<div style="font-size:0.72rem;color:var(--accent-emerald);">← ${r.unified_name}</div>`:""}
      </div>
      <div>
        <select class="filter-select" style="min-width:160px;font-size:0.78rem;" data-account-id="${r.id}" data-company-id="${s}">
          <option value="">-- غير معين --</option>
          ${a.map(o=>`
            <option value="${o.id}" ${r.unified_account_id===o.id?"selected":""}>
              ${o.code} - ${o.name_ar}
            </option>
          `).join("")}
        </select>
      </div>
    </div>
  `).join("")||'<div style="padding:20px;text-align:center;color:var(--text-muted);">لا توجد حسابات - قم بمزامنة البيانات أولاً</div>',e.querySelectorAll("select").forEach(r=>{r.addEventListener("change",async()=>{const o=parseInt(r.value),n=parseInt(r.dataset.accountId);if(o)try{await h.createMapping({company_account_id:n,unified_account_id:o}),y("تم ربط الحساب بنجاح","success");const i=r.dataset.companyId,p=e.closest("#main-content")||document.getElementById("main-content"),c=r.closest(".mapping-item");c.classList.remove("unmapped"),c.classList.add("mapped")}catch{y("خطأ في ربط الحساب","error")}})})}function Jt(e,t){e.innerHTML=t.map(a=>`
    <div class="mapping-item" style="border-right:3px solid var(--accent-blue);">
      <div>
        <div style="font-family:var(--font-en);font-size:0.8em;color:var(--text-muted);">${a.code}</div>
        <div style="font-size:0.85rem;">${a.name_ar}</div>
        <div style="font-size:0.72rem;color:var(--text-muted);">${a.name_en||""} | ${a.account_type}</div>
      </div>
      <span class="badge ${a.is_group?"badge-info":"badge-success"}">${a.is_group?"مجموعة":"حساب"}</span>
    </div>
  `).join("")||'<div style="padding:20px;text-align:center;color:var(--text-muted);">لا توجد حسابات موحدة</div>'}function Ut(e,t){const a=t.length,s=t.filter(o=>o.is_mapped).length,r=a>0?(s/a*100).toFixed(0):0;e.innerHTML=`
    <div style="display:flex;align-items:center;gap:var(--space-lg);">
      <div style="flex:1;">
        <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-sm);">
          <span style="font-size:0.85rem;">التقدم</span>
          <span style="font-family:var(--font-en);font-weight:600;">${s}/${a} (${r}%)</span>
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
          <div style="font-size:1.3rem;font-weight:700;color:var(--accent-amber);">${a-s}</div>
          <div style="font-size:0.72rem;color:var(--text-muted);">غير مربوط</div>
        </div>
      </div>
    </div>
  `}function Xt(){ve("إضافة حساب موحد جديد",`
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
  `),document.getElementById("btn-save-unified").addEventListener("click",async()=>{try{await h.createUnifiedAccount({code:document.getElementById("ua-code").value,name_ar:document.getElementById("ua-name-ar").value,name_en:document.getElementById("ua-name-en").value,account_type:document.getElementById("ua-type").value}),fe(),y("تم إضافة الحساب الموحد","success")}catch(e){y("خطأ: "+e.message,"error")}})}let ce={};async function Gt(e){e.innerHTML=`
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
  `;const t=e.querySelector("#btn-test-conn"),a=e.querySelector("#btn-save-conn");t.addEventListener("click",async()=>{const i=e.querySelector("#conn-url").value.trim(),p=e.querySelector("#conn-user").value.trim(),c=e.querySelector("#conn-pass").value.trim(),l=e.querySelector("#conn-result");if(!i||!p||!c){l.innerHTML='<div style="padding:12px;border-radius:8px;background:rgba(239,68,68,0.15);color:var(--accent-red);font-size:0.85rem;">⚠️ يرجى تعبئة جميع الحقول</div>';return}t.disabled=!0,t.textContent="جاري الاختبار...",l.innerHTML='<div style="padding:12px;color:var(--text-muted);font-size:0.85rem;">⏳ جاري اختبار الاتصال...</div>';try{const u=await h.testConnectionDirect({url:i,username:p,password:c,db_name:e.querySelector("#conn-db").value.trim(),company_id:1});u.success?(l.innerHTML=`
          <div style="padding:12px;border-radius:8px;background:rgba(16,185,129,0.15);color:var(--accent-emerald);font-size:0.85rem;">
            ✅ الاتصال ناجح! ${u.message||""}
          </div>
        `,a.disabled=!1):(l.innerHTML=`
          <div style="padding:12px;border-radius:8px;background:rgba(239,68,68,0.15);color:var(--accent-red);font-size:0.85rem;">
            ❌ فشل الاتصال: ${u.message}
          </div>
        `,a.disabled=!0)}catch(u){l.innerHTML=`
        <div style="padding:12px;border-radius:8px;background:rgba(239,68,68,0.15);color:var(--accent-red);font-size:0.85rem;">
          ❌ خطأ: ${u.message}
        </div>
      `}t.disabled=!1,t.textContent="🔌 اختبار الاتصال"}),a.addEventListener("click",async()=>{const i=e.querySelector("#conn-url").value.trim(),p=e.querySelector("#conn-user").value.trim(),c=e.querySelector("#conn-pass").value.trim();a.disabled=!0,a.textContent="جاري الحفظ...";try{let l=i;try{l=new URL(i).hostname}catch{l=i.replace(/https?:\/\//,"").split("/")[0]}await h.createInstance({name:"أودو - "+l,url:i,username:p,api_key:c,db_name:e.querySelector("#conn-db").value.trim()}),y("تم حفظ الاتصال بنجاح ✅ — اربط الشركات به من قسم الشركات","success"),e.querySelector("#conn-url").value="",e.querySelector("#conn-user").value="",e.querySelector("#conn-pass").value="",e.querySelector("#conn-db").value="",e.querySelector("#conn-result").innerHTML="",a.disabled=!0,await re(e)}catch(l){y("خطأ في الحفظ: "+l.message,"error")}a.disabled=!1,a.textContent="💾 حفظ الاتصال"}),e.querySelector("#btn-add-company").addEventListener("click",()=>sa(e)),e.querySelector("#btn-add-rule").addEventListener("click",()=>oa(e)),e.querySelector("#btn-sync-all").addEventListener("click",async()=>{try{await h.syncAll(),y("بدأت مزامنة جميع الشركات","info"),Qt(e)}catch(i){y("خطأ: "+i.message,"error")}});const s=e.querySelector("#sync-enabled"),r=e.querySelector("#sync-toggle-track"),o=e.querySelector("#sync-toggle-dot");function n(i){i?(r.style.background="#06b6d4",o.style.right="2px"):(r.style.background="rgba(255,255,255,0.1)",o.style.right="22px")}r.addEventListener("click",()=>{s.checked=!s.checked,n(s.checked)}),o.addEventListener("click",()=>{s.checked=!s.checked,n(s.checked)}),e.querySelector("#btn-save-schedule").addEventListener("click",async()=>{const i=e.querySelector("#btn-save-schedule");i.disabled=!0,i.textContent="⏳ جاري الحفظ...";try{const p=await h.updateSchedule({enabled:s.checked,intervalHours:parseInt(e.querySelector("#sync-interval").value)});y(p.running?`تم تفعيل المزامنة التلقائية — ${p.schedule}`:"تم إيقاف المزامنة التلقائية","success"),ct(e,p)}catch(p){y("خطأ: "+p.message,"error")}i.disabled=!1,i.textContent="💾 حفظ الإعدادات"}),e.querySelector("#btn-clear-notifs").addEventListener("click",async()=>{try{await h.clearNotifications(),e.querySelector("#sync-notifications-list").innerHTML='<div style="text-align:center;color:var(--text-muted);padding:12px;font-size:0.8rem;">لا توجد إشعارات</div>',y("تم مسح الإشعارات","info")}catch(i){y("خطأ: "+i.message,"error")}}),await re(e)}function ct(e,t){const a=e.querySelector("#schedule-status");a&&(t.running?a.innerHTML=`<span style="color:#10b981;">● نشطة</span> — <span style="font-family:var(--font-en);font-size:0.72rem;">${t.schedule}</span>`:a.innerHTML='<span style="color:var(--text-muted);">○ متوقفة</span>')}function Yt(e,t){if(!e)return;if(!t||t.length===0){e.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:12px;font-size:0.8rem;">لا توجد إشعارات</div>';return}const a={success:"background:rgba(16,185,129,0.12);color:#10b981;border-color:rgba(16,185,129,0.2)",warning:"background:rgba(245,158,11,0.12);color:#f59e0b;border-color:rgba(245,158,11,0.2)",error:"background:rgba(239,68,68,0.12);color:#ef4444;border-color:rgba(239,68,68,0.2)"},s={success:"✅",warning:"⚠️",error:"❌"};e.innerHTML=`<div style="display:grid;gap:6px;">
    ${t.map(r=>{const o=a[r.type]||a.success,n=s[r.type]||"✅",i=r.created_at?new Date(r.created_at+"Z").toLocaleString("ar-SA",{hour:"2-digit",minute:"2-digit",day:"numeric",month:"short"}):"";return`<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-radius:8px;border:1px solid;${o};font-size:0.8rem;">
        <span>${n} ${r.message}</span>
        <span style="font-family:var(--font-en);font-size:0.7rem;opacity:0.7;">${i}</span>
      </div>`}).join("")}
  </div>`}async function re(e){try{const[t,a,s,r,o,n]=await Promise.all([h.getInstances(),h.getCompanies(),h.getEliminationRules(),h.getSyncStatus(),h.getSchedule().catch(()=>({enabled:!1,intervalHours:2,running:!1})),h.getNotifications().catch(()=>[])]);Wt(e.querySelector("#instances-list"),t,e),Zt(e.querySelector("#companies-list"),a,t,e),Kt(e.querySelector("#import-panel"),a),ta(e.querySelector("#rules-list"),s),aa(e.querySelector("#sync-log"),r);const i=e.querySelector("#sync-enabled");if(i){i.checked=o.enabled;const c=e.querySelector("#sync-toggle-track"),l=e.querySelector("#sync-toggle-dot");o.enabled?(c.style.background="#06b6d4",l.style.right="2px"):(c.style.background="rgba(255,255,255,0.1)",l.style.right="22px")}const p=e.querySelector("#sync-interval");p&&(p.value=String(o.intervalHours)),ct(e,o),Yt(e.querySelector("#sync-notifications-list"),n)}catch{y("خطأ في تحميل الإعدادات","error")}}function Wt(e,t,a){if(t.length===0){e.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:15px;font-size:0.85rem;">لا توجد اتصالات محفوظة — أضف اتصال من الخطوة 1</div>';return}e.innerHTML=`
    <div style="display:grid;gap:var(--space-sm);">
      ${t.map(s=>`
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
  `,e.querySelectorAll(".btn-delete-instance").forEach(s=>{s.addEventListener("click",async()=>{const r=s.dataset.id;if(confirm("هل تريد حذف هذا الاتصال؟"))try{await h.deleteInstance(r),y("تم حذف الاتصال","success"),await re(a)}catch(o){y("خطأ: "+o.message,"error")}})})}function Zt(e,t,a,s){if(t.length===0){e.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:0.85rem;">لا توجد شركات — أضف شركة جديدة</div>';return}const r={};for(const o of a)r[o.id]=o;e.innerHTML=`
    <div class="data-table-wrapper">
      <table class="data-table">
        <thead><tr><th>الشركة</th><th>الخادم المربوط</th><th>Odoo ID</th><th>عدد القيود</th><th>آخر قيد</th><th>الحالة</th></tr></thead>
        <tbody>
          ${t.map(o=>{const n=r[o.odoo_instance_id],i=a.map(p=>`<option value="${p.id}" ${p.id===o.odoo_instance_id?"selected":""}>${p.name}</option>`).join("");return`
            <tr>
              <td>
                <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${o.color||"#3b82f6"};margin-left:8px;"></span>
                ${o.name}
              </td>
              <td>
                <select class="filter-select company-instance-select" data-company-id="${o.id}" style="font-size:0.78rem;padding:4px 8px;min-width:180px;">
                  ${i}
                </select>
                ${n?`<div style="font-family:var(--font-en);font-size:0.68rem;color:var(--text-muted);margin-top:2px;">${n.url} — ${n.username}</div>`:""}
              </td>
              <td style="font-family:var(--font-en);">${o.odoo_company_id}</td>
              <td style="font-family:var(--font-en);font-weight:600;">${v(o.item_count||0)}</td>
              <td style="font-family:var(--font-en);font-size:0.8em;">${o.last_entry_date||"--"}</td>
              <td><span class="badge ${o.is_active?"badge-success":"badge-danger"}">${o.is_active?"نشط":"معطل"}</span></td>
            </tr>
          `}).join("")}
        </tbody>
      </table>
    </div>
  `,e.querySelectorAll(".company-instance-select").forEach(o=>{o.addEventListener("change",async()=>{const n=o.dataset.companyId,i=parseInt(o.value);try{await h.updateCompany(n,{odoo_instance_id:i}),y("تم تحديث الخادم المربوط ✅","success"),await re(s)}catch(p){y("خطأ: "+p.message,"error")}})})}function Kt(e,t){if(t.length===0){e.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:0.85rem;">أضف شركات أولاً ثم ابدأ الاستيراد</div>';return}e.innerHTML=t.map(a=>`
    <div class="card" style="margin-bottom:var(--space-md);border:1px solid rgba(255,255,255,0.05);padding:var(--space-md);" id="import-card-${a.id}">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${a.color||"#3b82f6"};margin-left:8px;"></span>
          <strong>${a.name}</strong>
          <span style="font-family:var(--font-en);color:var(--text-muted);font-size:0.8em;margin-right:8px;">(Odoo Company ID: ${a.odoo_company_id})</span>
          <span style="font-family:var(--font-en);color:var(--text-muted);font-size:0.8em;">— ${v(a.item_count||0)} سجل</span>
        </div>
        <button class="btn btn-primary btn-sm btn-import" data-company-id="${a.id}">📥 استيراد</button>
      </div>
      <div class="import-progress" id="progress-${a.id}" style="margin-top:var(--space-sm);display:none;">
        <div style="display:flex;justify-content:space-between;font-size:0.78rem;color:var(--text-secondary);margin-bottom:4px;">
          <span id="progress-text-${a.id}">جاري التحضير...</span>
          <span id="progress-pct-${a.id}">0%</span>
        </div>
        <div style="height:6px;background:rgba(10,15,40,0.5);border-radius:3px;overflow:hidden;">
          <div id="progress-bar-${a.id}" style="height:100%;width:0%;background:linear-gradient(90deg,var(--accent-blue),var(--accent-emerald));border-radius:3px;transition:width 0.5s ease;"></div>
        </div>
      </div>
    </div>
  `).join(""),e.querySelectorAll(".btn-import").forEach(a=>{a.addEventListener("click",async()=>{const s=parseInt(a.dataset.companyId);a.disabled=!0,a.textContent="⏳ جاري...";try{await h.syncCompany(s),y("بدأت عملية الاستيراد","info"),pt(s)}catch(r){y("خطأ: "+r.message,"error"),a.disabled=!1,a.textContent="📥 استيراد"}})})}function pt(e){const t=document.getElementById(`progress-${e}`);t&&(t.style.display="block"),ce[e]&&clearInterval(ce[e]),ce[e]=setInterval(async()=>{try{const a=await h.getSyncProgress(e);if(ea(e,a),a.status==="completed"||a.status==="failed"){clearInterval(ce[e]),delete ce[e];const s=document.querySelector(`[data-company-id="${e}"]`);if(s&&(s.disabled=!1,s.textContent=a.status==="completed"?"✅ تم":"📥 إعادة الاستيراد"),a.status==="completed"){y(`تم استيراد ${v(a.inserted)} سجل بنجاح ✅`,"success");const r=await h.getCompanies();S.set("companies",r)}else y(`فشل الاستيراد: ${a.phase}`,"error")}}catch(a){console.error("Progress poll error:",a)}},1500)}function Qt(e){const t=S.get("companies");for(const a of t)pt(a.id)}function ea(e,t){const a=document.getElementById(`progress-text-${e}`),s=document.getElementById(`progress-pct-${e}`),r=document.getElementById(`progress-bar-${e}`),o=document.getElementById(`progress-${e}`);if(!(!a||!s||!r)){if(o.style.display="block",a.textContent=t.phase||"",t.total>0){const n=Math.round(t.inserted/t.total*100);s.textContent=`${n}%`,r.style.width=`${n}%`}t.status==="completed"?(r.style.background="var(--accent-emerald)",r.style.width="100%",s.textContent="100%"):t.status==="failed"&&(r.style.background="var(--accent-red)")}}function ta(e,t){if(t.length===0){e.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:15px;font-size:0.85rem;">لا توجد قواعد استبعاد</div>';return}e.innerHTML=`
    <div class="data-table-wrapper">
      <table class="data-table">
        <thead><tr><th>القاعدة</th><th>الشركة المصدر</th><th>الشركة الهدف</th><th>حساب المصدر</th><th>حساب الهدف</th></tr></thead>
        <tbody>
          ${t.map(a=>`
            <tr>
              <td>${a.name}</td>
              <td>${a.source_company_name||"--"}</td>
              <td>${a.target_company_name||"--"}</td>
              <td style="font-family:var(--font-en);">${a.source_account_code||"--"}</td>
              <td style="font-family:var(--font-en);">${a.target_account_code||"--"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `}function aa(e,t){if(t.length===0){e.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:15px;font-size:0.85rem;">لا يوجد سجل مزامنة بعد</div>';return}e.innerHTML=`
    <div class="data-table-wrapper">
      <table class="data-table">
        <thead><tr><th>الشركة</th><th>الحالة</th><th>السجلات</th><th>البداية</th><th>النهاية</th><th>الخطأ</th></tr></thead>
        <tbody>
          ${t.slice(0,20).map(a=>`
            <tr>
              <td>${a.company_name||"--"}</td>
              <td>
                <span class="badge badge-${a.status==="completed"?"success":a.status==="failed"?"danger":"warning"}">
                  ${a.status==="completed"?"✅ مكتمل":a.status==="failed"?"❌ فشل":"⏳ جاري"}
                </span>
              </td>
              <td style="font-family:var(--font-en);">${v(a.records_synced||0)}</td>
              <td style="font-family:var(--font-en);font-size:0.72em;">${a.started_at||""}</td>
              <td style="font-family:var(--font-en);font-size:0.72em;">${a.completed_at||""}</td>
              <td style="font-size:0.72em;color:var(--accent-red);max-width:200px;overflow:hidden;text-overflow:ellipsis;">${a.error_message||""}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `}function sa(e){ve("إضافة شركة جديدة",`
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
  `),h.getInstances().then(t=>{const a=document.getElementById("comp-instance");t.length===0?a.innerHTML="<option disabled>⚠️ أضف اتصال أودو أولاً</option>":a.innerHTML=t.map(s=>`<option value="${s.id}">${s.name} (${s.url})</option>`).join("")}),document.getElementById("btn-save-company").addEventListener("click",async()=>{const t=document.getElementById("comp-name").value,a=parseInt(document.getElementById("comp-odoo-id").value),s=parseInt(document.getElementById("comp-instance").value);if(!t||!a){y("يرجى تعبئة الاسم ومعرف الشركة","warning");return}try{await h.createCompany({name:t,odoo_company_id:a,odoo_instance_id:s,currency:document.getElementById("comp-currency").value||"SAR",color:document.getElementById("comp-color").value}),fe(),y("تم إضافة الشركة بنجاح ✅","success");const r=await h.getCompanies();S.set("companies",r),await re(e)}catch(r){y("خطأ: "+r.message,"error")}})}function oa(e){const t=S.get("companies");ve("إضافة قاعدة استبعاد",`
    <div class="form-group">
      <label class="form-label">اسم القاعدة</label>
      <input type="text" class="form-input" id="rule-name" dir="rtl" placeholder="مثل: استبعاد إيرادات المقاولات بين الشركات" />
    </div>
    <div class="form-group">
      <label class="form-label">الشركة المصدر</label>
      <select class="filter-select" id="rule-source" style="width:100%;">
        ${t.map(a=>`<option value="${a.id}">${a.name}</option>`).join("")}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">الشركة الهدف</label>
      <select class="filter-select" id="rule-target" style="width:100%;">
        ${t.map(a=>`<option value="${a.id}">${a.name}</option>`).join("")}
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
  `),document.getElementById("btn-save-rule").addEventListener("click",async()=>{try{await h.createEliminationRule({name:document.getElementById("rule-name").value,source_company_id:parseInt(document.getElementById("rule-source").value),target_company_id:parseInt(document.getElementById("rule-target").value),source_account_code:document.getElementById("rule-src-acc").value,target_account_code:document.getElementById("rule-tgt-acc").value}),fe(),y("تم إضافة القاعدة بنجاح ✅","success"),await re(e)}catch(a){y("خطأ: "+a.message,"error")}})}let F=0;const ke=50;async function na(e){const t=S.get("companies");e.innerHTML=`
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
            ${t.map(a=>`<option value="${a.id}">${a.name}</option>`).join("")}
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
  `,e.querySelector("#dp-apply").addEventListener("click",()=>{F=0,oe(e)}),e.querySelector("#dp-reset").addEventListener("click",()=>{e.querySelector("#dp-search").value="",e.querySelector("#dp-company").value="",e.querySelector("#dp-acctype").value="",e.querySelector("#dp-analytic").value="",e.querySelector("#dp-datefrom").value="",e.querySelector("#dp-dateto").value="",F=0,oe(e)}),e.querySelector("#dp-prev").addEventListener("click",()=>{F>0&&(F--,oe(e))}),e.querySelector("#dp-next").addEventListener("click",()=>{F++,oe(e)}),e.querySelector("#dp-search").addEventListener("keydown",a=>{a.key==="Enter"&&(F=0,oe(e))}),F=0,await oe(e)}async function oe(e){const t=e.querySelector("#dp-search").value.trim(),a=e.querySelector("#dp-company").value,s=e.querySelector("#dp-acctype").value,r=e.querySelector("#dp-analytic").value,o=e.querySelector("#dp-datefrom").value,n=e.querySelector("#dp-dateto").value,i={limit:ke,offset:F*ke};t&&(i.search=t),a&&(i.companyIds=a),s&&(i.accountType=s),r&&(i.analyticAccount=r),o&&(i.dateFrom=o),n&&(i.dateTo=n);try{const p=await h.getJournalItems(i);if(p.accountTypes&&p.accountTypes.length>0){const l=e.querySelector("#dp-acctype"),u=l.value;l.options.length<=1&&(p.accountTypes.forEach(d=>{const g=document.createElement("option");g.value=d,g.textContent=d,l.appendChild(g)}),u&&(l.value=u))}if(p.analyticAccounts&&p.analyticAccounts.length>0){const l=e.querySelector("#dp-analytic"),u=l.value;l.options.length<=1&&(p.analyticAccounts.forEach(d=>{const g=document.createElement("option");g.value=d,g.textContent=d,l.appendChild(g)}),u&&(l.value=u))}e.querySelector("#total-badge").textContent=`إجمالي: ${v(p.total)} سجل`;const c=Math.ceil(p.total/ke);e.querySelector("#dp-prev").disabled=F===0,e.querySelector("#dp-next").disabled=F+1>=c,e.querySelector("#dp-page-info").textContent=`صفحة ${F+1} من ${c||1}`,ra(e.querySelector("#dp-table-wrapper"),p.items)}catch(p){e.querySelector("#dp-table-wrapper").innerHTML=`<div style="padding:20px;color:var(--accent-red);">خطأ: ${p.message}</div>`}}function ra(e,t){if(!t||t.length===0){e.innerHTML='<div style="text-align:center;padding:40px;color:var(--text-muted);">لا توجد بيانات</div>';return}const a=[{key:"company_name",label:"الشركة",type:"text"},{key:"date",label:"التاريخ",type:"date"},{key:"account_code",label:"كود الحساب",type:"code"},{key:"account_name",label:"اسم الحساب",type:"text"},{key:"account_type",label:"نوع الحساب",type:"badge"},{key:"debit",label:"مدين",type:"money"},{key:"credit",label:"دائن",type:"money"},{key:"balance",label:"الرصيد",type:"money"},{key:"partner_name",label:"الشريك",type:"text"},{key:"analytic_account",label:"حساب تحليلي",type:"text"},{key:"label",label:"البيان",type:"text"},{key:"journal_name",label:"اليومية",type:"text"},{key:"move_name",label:"رقم القيد",type:"code"},{key:"move_ref",label:"المرجع",type:"text"},{key:"currency",label:"العملة",type:"code"},{key:"fiscal_year",label:"السنة",type:"code"},{key:"period",label:"الفترة",type:"code"}];e.innerHTML=`
    <table class="data-table" style="font-size:0.78rem;min-width:1800px;">
      <thead>
        <tr>
          <th style="position:sticky;top:0;z-index:2;font-size:0.7rem;white-space:nowrap;">#</th>
          ${a.map(s=>`
            <th style="position:sticky;top:0;z-index:2;font-size:0.7rem;white-space:nowrap;">${s.label}</th>
          `).join("")}
        </tr>
      </thead>
      <tbody>
        ${t.map((s,r)=>`
          <tr>
            <td style="font-family:var(--font-en);color:var(--text-muted);font-size:0.7rem;">${F*ke+r+1}</td>
            ${a.map(o=>ia(s,o)).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `}function ia(e,t){const a=e[t.key];switch(t.type){case"money":return!a||a===0?'<td style="font-family:var(--font-en);color:var(--text-muted);">0</td>':`<td style="font-family:var(--font-en);font-weight:500;color:${a<0?"var(--accent-red)":"var(--text-primary)"};">${v(a,2)}</td>`;case"date":return`<td style="font-family:var(--font-en);font-size:0.75rem;white-space:nowrap;">${a||""}</td>`;case"code":return`<td style="font-family:var(--font-en);font-size:0.75rem;color:var(--accent-blue);">${a||""}</td>`;case"badge":return a?`<td><span style="background:rgba(99,102,241,0.15);color:var(--accent-indigo);padding:2px 6px;border-radius:4px;font-size:0.68rem;white-space:nowrap;">${a}</span></td>`:"<td></td>";default:return`<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${(a||"").toString().replace(/"/g,"&quot;")}">${a||""}</td>`}}async function la(e){const t=S.get("companies")||[],a=S.get("fiscalYear")||"",s=S.get("dateFrom")||"",r=S.get("dateTo")||"",o=S.get("filterOptions")||{};e.innerHTML=`
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
            ${t.map(n=>`
              <option value="${n.id}">${n.name}</option>
            `).join("")}
          </select>
        </div>

        <div class="filter-group">
          <span class="filter-label">السنة المالية</span>
          <select class="filter-select" id="tb-fiscal-year">
            <option value="">-- اختر --</option>
            ${(o.fiscalYears||[]).map(n=>`
              <option value="${n}" ${a===n?"selected":""}>${n}</option>
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
            ${(o.costCenters||[]).map(n=>`
              <option value="${n}">${n}</option>
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
  `,e.querySelector("#tb-fiscal-year").addEventListener("change",n=>{const i=n.target.value;i&&(e.querySelector("#tb-date-from").value=`${i}-01-01`,e.querySelector("#tb-date-to").value=`${i}-12-31`)}),e.querySelector("#btn-tb-load").addEventListener("click",()=>ot(e)),e.querySelector("#chk-tb-zero").addEventListener("change",()=>{ie&&ut(e)}),e.querySelector("#btn-export-pdf").addEventListener("click",()=>ca(e)),e.querySelector("#btn-export-excel").addEventListener("click",()=>da(e)),e.querySelector("#btn-sync-data").addEventListener("click",async()=>{var c;const n=e.querySelector("#tb-company").value;if(!n){y("اختر شركة أولاً","error");return}const i=e.querySelector("#btn-sync-data"),p=e.querySelector("#sync-icon");i.disabled=!0,p.style.animation="spin 1s linear infinite",(c=i.querySelector("span:last-child"))==null||c.remove(),i.insertAdjacentHTML("beforeend","<span> جاري المزامنة...</span>");try{if((await(await fetch(`/api/sync/company/${n}`,{method:"POST"})).json()).started){let d=!1;for(;!d;){await new Promise(z=>setTimeout(z,3e3));const x=await(await fetch(`/api/sync/status/${n}`)).json();(x.status==="done"||x.status==="idle"||x.status==="error")&&(d=!0,x.status==="error"?y("خطأ في المزامنة","error"):y(`✅ تم تحديث البيانات — ${x.inserted||""} سجل`,"success"))}const g=e.querySelector("#tb-date-from").value,f=e.querySelector("#tb-date-to").value;g&&f&&ot(e)}}catch{y("خطأ في الاتصال","error")}finally{i.disabled=!1,p.style.animation="";const l=i.querySelector("span:last-child");l&&(l.textContent=" تحديث البيانات")}}),a&&(e.querySelector("#tb-date-from").value=`${a}-01-01`,e.querySelector("#tb-date-to").value=`${a}-12-31`)}let ie=null;async function ot(e){const t=e.querySelector("#tb-company").value,a=e.querySelector("#tb-date-from").value,s=e.querySelector("#tb-date-to").value,r=e.querySelector("#tb-cost-center").value;if(!a||!s){y("يجب اختيار الفترة (من تاريخ - إلى تاريخ)","error");return}const o=e.querySelector("#tb-content");o.innerHTML='<div class="skeleton" style="height:400px;border-radius:var(--radius-lg);"></div>';try{ie=await h.getTrialBalance({companyId:t,dateFrom:a,dateTo:s,costCenter:r}),ut(e),e.querySelector("#btn-export-pdf").disabled=!1,e.querySelector("#btn-export-excel").disabled=!1}catch(n){console.error("Trial balance error:",n),y("خطأ في تحميل ميزان المراجعة","error"),o.innerHTML='<p style="text-align:center;color:var(--accent-red);padding:var(--space-xl);">خطأ في التحميل</p>'}}function ut(e){var l,u;const t=e.querySelector("#tb-content");if(!ie)return;const a=((l=e.querySelector("#chk-tb-zero"))==null?void 0:l.checked)||!1,s=e.querySelector("#tb-company"),r=((u=s.options[s.selectedIndex])==null?void 0:u.text)||"",o=e.querySelector("#tb-date-from").value,n=e.querySelector("#tb-date-to").value;let i=ie.accounts||[];a&&(i=i.filter(d=>Math.abs(d.open_debit)>.001||Math.abs(d.open_credit)>.001||Math.abs(d.period_debit)>.001||Math.abs(d.period_credit)>.001||Math.abs(d.close_debit)>.001||Math.abs(d.close_credit)>.001));const p=i.reduce((d,g)=>({open_debit:d.open_debit+g.open_debit,open_credit:d.open_credit+g.open_credit,period_debit:d.period_debit+g.period_debit,period_credit:d.period_credit+g.period_credit,close_debit:d.close_debit+g.close_debit,close_credit:d.close_credit+g.close_credit}),{open_debit:0,open_credit:0,period_debit:0,period_credit:0,close_debit:0,close_credit:0});Math.abs(p.open_debit-p.open_credit);const c=Math.abs(p.close_debit-p.close_credit);t.innerHTML=`
    <div style="margin-bottom:var(--space-md);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-sm);">
      <div style="display:flex;gap:var(--space-md);align-items:center;">
        <span style="font-size:0.85rem;font-weight:600;color:var(--text-primary);">🏢 ${r}</span>
        <span style="font-size:0.75rem;color:var(--text-muted);">الفترة: ${o} إلى ${n}</span>
        <span style="font-size:0.75rem;color:var(--text-muted);">عدد الحسابات: ${i.length}</span>
      </div>
      <div style="display:flex;gap:var(--space-md);">
        <span style="font-size:0.75rem;color:${c<.01?"var(--accent-emerald)":"var(--accent-red)"};">
          ${c<.01?"✅ الميزان متوازن":`⚠️ فرق الإقفال: ${v(c,2)}`}
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
          ${i.map(d=>{const g=d.account_code==="RE-CALC",f=g?"font-style: italic; background: rgba(59, 130, 246, 0.05);":"",b=g?' <span style="font-size:0.75em; background:var(--primary-subtle, rgba(59,130,246,0.1)); color:var(--primary, #3b82f6); border:1px solid rgba(59,130,246,0.25); border-radius:4px; padding:1px 6px; font-style:normal; margin-right:4px;">محسوب</span>':"";return`
            <tr style="${f}">
              <td style="font-family:var(--font-en);font-size:0.75em;color:var(--accent-blue);">${d.account_code}</td>
              <td>${d.account_name}${b}</td>
              <td class="number">${d.open_debit?v(d.open_debit,2):"-"}</td>
              <td class="number">${d.open_credit?v(d.open_credit,2):"-"}</td>
              <td class="number">${d.period_debit?v(d.period_debit,2):"-"}</td>
              <td class="number">${d.period_credit?v(d.period_credit,2):"-"}</td>
              <td class="number" style="font-weight:600;">${d.close_debit?v(d.close_debit,2):"-"}</td>
              <td class="number" style="font-weight:600;">${d.close_credit?v(d.close_credit,2):"-"}</td>
            </tr>
          `}).join("")}
          <tr class="total-row" style="font-size:0.95em;">
            <td colspan="2" style="font-weight:700;">الإجمالي</td>
            <td class="number" style="font-weight:700;">${v(p.open_debit,2)}</td>
            <td class="number" style="font-weight:700;">${v(p.open_credit,2)}</td>
            <td class="number" style="font-weight:700;">${v(p.period_debit,2)}</td>
            <td class="number" style="font-weight:700;">${v(p.period_credit,2)}</td>
            <td class="number" style="font-weight:700;color:var(--accent-emerald);">${v(p.close_debit,2)}</td>
            <td class="number" style="font-weight:700;color:var(--accent-emerald);">${v(p.close_credit,2)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `}function mt(e){var i,p;if(!ie)return null;const t=((i=e.querySelector("#chk-tb-zero"))==null?void 0:i.checked)||!1;let a=ie.accounts||[];t&&(a=a.filter(c=>c.open_debit||c.open_credit||c.period_debit||c.period_credit||c.close_debit||c.close_credit));const s=e.querySelector("#tb-company"),r=((p=s.options[s.selectedIndex])==null?void 0:p.text)||"",o=e.querySelector("#tb-date-from").value,n=e.querySelector("#tb-date-to").value;return{items:a,companyName:r,dateFrom:o,dateTo:n}}function da(e){const t=mt(e);if(!t){y("لا توجد بيانات للتصدير","error");return}try{const{items:a,companyName:s,dateFrom:r,dateTo:o}=t,n=[];n.push([`ميزان المراجعة — ${s}`]),n.push([`الفترة: ${r} → ${o}`]),n.push([]),n.push(["كود الحساب","اسم الحساب","نوع الحساب","رصيد افتتاحي - مدين","رصيد افتتاحي - دائن","حركة الفترة - مدين","حركة الفترة - دائن","رصيد ختامي - مدين","رصيد ختامي - دائن"]);const i={od:0,oc:0,pd:0,pc:0,cd:0,cc:0};for(const u of a)n.push([u.account_code,u.account_name,u.account_type||"",u.open_debit||0,u.open_credit||0,u.period_debit||0,u.period_credit||0,u.close_debit||0,u.close_credit||0]),i.od+=u.open_debit||0,i.oc+=u.open_credit||0,i.pd+=u.period_debit||0,i.pc+=u.period_credit||0,i.cd+=u.close_debit||0,i.cc+=u.close_credit||0;n.push(["","الإجمالي","",i.od,i.oc,i.pd,i.pc,i.cd,i.cc]);const p=XLSX.utils.book_new(),c=XLSX.utils.aoa_to_sheet(n);c["!cols"]=[{wch:14},{wch:40},{wch:20},{wch:18},{wch:18},{wch:18},{wch:18},{wch:18},{wch:18}],c["!merges"]=[{s:{r:0,c:0},e:{r:0,c:8}},{s:{r:1,c:0},e:{r:1,c:8}}];const l="#,##0.00";for(let u=4;u<n.length;u++)for(let d=3;d<=8;d++){const g=XLSX.utils.encode_cell({r:u,c:d});c[g]&&(c[g].t="n",c[g].z=l)}XLSX.utils.book_append_sheet(p,c,"ميزان المراجعة"),XLSX.writeFile(p,`trial_balance_${r}_${o}.xlsx`),y("✅ تم تصدير ملف Excel بنجاح","success")}catch(a){console.error("Excel export error:",a),y("خطأ في تصدير Excel","error")}}async function ca(e){const t=mt(e);if(!t){y("لا توجد بيانات للتصدير","error");return}try{y("⏳ جاري إنشاء PDF...","info");const{items:a,companyName:s,dateFrom:r,dateTo:o}=t,n={od:0,oc:0,pd:0,pc:0,cd:0,cc:0};a.forEach($=>{n.od+=$.open_debit||0,n.oc+=$.open_credit||0,n.pd+=$.period_debit||0,n.pc+=$.period_credit||0,n.cd+=$.close_debit||0,n.cc+=$.close_credit||0});const i=document.createElement("div");i.style.cssText="position:fixed;top:-99999px;left:0;width:1400px;background:#fff;padding:30px;font-family:Arial,Tahoma,sans-serif;direction:rtl;color:#000;",i.innerHTML=`
      <div style="text-align:center;margin-bottom:20px;">
        <h2 style="margin:0 0 6px;font-size:22px;color:#000;font-weight:900;">ميزان المراجعة</h2>
        <h3 style="margin:0 0 6px;font-size:16px;color:#1e293b;font-weight:700;">${s}</h3>
        <p style="margin:0;font-size:13px;color:#334155;font-weight:600;">الفترة: ${r} → ${o}</p>
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
          ${a.map(($,_)=>`
            <tr style="background:${_%2===0?"#fff":"#f1f5f9"};">
              <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:right;color:#000;font-weight:500;">${$.account_name||""}</td>
              <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:center;color:#000;font-family:monospace;font-weight:600;">${$.account_code}</td>
              <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:left;color:#000;font-family:monospace;">${D($.open_debit)}</td>
              <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:left;color:#000;font-family:monospace;">${D($.open_credit)}</td>
              <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:left;color:#000;font-family:monospace;">${D($.period_debit)}</td>
              <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:left;color:#000;font-family:monospace;">${D($.period_credit)}</td>
              <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:left;color:#000;font-family:monospace;">${D($.close_debit)}</td>
              <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:left;color:#000;font-family:monospace;">${D($.close_credit)}</td>
            </tr>
          `).join("")}
          <tr style="background:#1e293b;color:#fff;font-weight:700;">
            <td style="padding:6px 8px;border:1px solid #000;text-align:right;font-size:13px;" colspan="2">الإجمالي</td>
            <td style="padding:6px 8px;border:1px solid #000;text-align:left;font-family:monospace;">${D(n.od)}</td>
            <td style="padding:6px 8px;border:1px solid #000;text-align:left;font-family:monospace;">${D(n.oc)}</td>
            <td style="padding:6px 8px;border:1px solid #000;text-align:left;font-family:monospace;">${D(n.pd)}</td>
            <td style="padding:6px 8px;border:1px solid #000;text-align:left;font-family:monospace;">${D(n.pc)}</td>
            <td style="padding:6px 8px;border:1px solid #000;text-align:left;font-family:monospace;">${D(n.cd)}</td>
            <td style="padding:6px 8px;border:1px solid #000;text-align:left;font-family:monospace;">${D(n.cc)}</td>
          </tr>
        </tbody>
      </table>
      <div style="text-align:center;margin-top:14px;font-size:10px;color:#64748b;font-weight:600;">
        Mizaniat BI | تم الإنشاء: ${new Date().toLocaleString("ar-SA")}
      </div>
    `,document.body.appendChild(i);const p=await it(i,{scale:3,useCORS:!0,backgroundColor:"#ffffff"});document.body.removeChild(i);const c=new lt({orientation:"landscape",unit:"mm",format:"a4"}),l=c.internal.pageSize.getWidth(),u=c.internal.pageSize.getHeight(),d=15,g=12,f=10,b=l-f*2,x=u-d-g,z=b,w=p.height/p.width*z,m=p.toDataURL("image/png");if(w<=x)c.addImage(m,"PNG",f,d,z,w);else{const $=Math.ceil((w+5)/x);for(let _=0;_<$;_++){_>0&&c.addPage();const L=d-_*x;c.addImage(m,"PNG",f,L,z,w),c.setFillColor(255,255,255),c.rect(0,0,l,d,"F"),_===$-1?c.rect(0,u-5,l,5,"F"):c.rect(0,u-g,l,g,"F"),c.setFontSize(8),c.setTextColor(150),c.text(`${_+1} / ${$}`,l/2,u-1.5,{align:"center"})}}c.save(`trial_balance_${r}_${o}.pdf`),y("✅ تم تصدير ملف PDF بنجاح","success")}catch(a){console.error("PDF export error:",a),y("خطأ في تصدير PDF: "+a.message,"error")}}function D(e){return!e||e===0?"-":Number(e).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}let le=null,ae={},Q=[];async function pa(e){const t=S.get("companies")||[],a=S.get("fiscalYear")||"",s=S.get("dateFrom")||"",r=S.get("dateTo")||"",o=S.get("filterOptions")||{};e.innerHTML=`
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
            ${t.map(n=>`<option value="${n.id}">${n.name}</option>`).join("")}
          </select>
        </div>
        <div class="filter-group">
          <span class="filter-label">السنة المالية</span>
          <select class="filter-select" id="dtb-fiscal-year">
            <option value="">-- اختر --</option>
            ${(o.fiscalYears||[]).map(n=>`
              <option value="${n}" ${a===n?"selected":""}>${n}</option>
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
            ${(o.costCenters||[]).map(n=>`<option value="${n}">${n}</option>`).join("")}
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
  `,e.querySelector("#dtb-fiscal-year").addEventListener("change",n=>{const i=n.target.value;i&&(e.querySelector("#dtb-date-from").value=`${i}-01-01`,e.querySelector("#dtb-date-to").value=`${i}-12-31`)}),e.querySelector("#dtb-company").addEventListener("change",()=>Re(e)),e.querySelector("#btn-dtb-load").addEventListener("click",()=>ma(e)),e.querySelector("#chk-dtb-zero").addEventListener("change",()=>{le&&gt(e)}),e.querySelector("#btn-dtb-pdf").addEventListener("click",()=>ya(e)),e.querySelector("#btn-dtb-excel").addEventListener("click",()=>ga(e)),e.querySelector("#btn-dtb-config").addEventListener("click",()=>{const n=e.querySelector("#dtb-config-panel");n.style.display=n.style.display==="none"?"":"none",n.style.display!=="none"&&ua(e)}),e.querySelector("#btn-close-config").addEventListener("click",()=>{e.querySelector("#dtb-config-panel").style.display="none"}),a&&(e.querySelector("#dtb-date-from").value=`${a}-01-01`,e.querySelector("#dtb-date-to").value=`${a}-12-31`),await Re(e)}async function Re(e){const t=e.querySelector("#dtb-company").value;try{const a=await h.getPartnerAccountConfig({companyId:t});Q=(a.configs||[]).map(r=>r.account_code);const s=e.querySelector("#dtb-account-badges");Q.length>0?s.innerHTML=Q.map(r=>{const o=a.configs.find(n=>n.account_code===r);return`<span style="font-size:0.7rem;background:rgba(59,130,246,0.15);color:var(--accent-blue);padding:2px 8px;border-radius:var(--radius-sm);">${r}${o!=null&&o.account_name?" — "+o.account_name:""}</span>`}).join(""):s.innerHTML='<span style="font-size:0.7rem;color:var(--accent-amber);">⚠️ لم يتم إعداد حسابات التفصيل — اضغط "إعداد الحسابات"</span>'}catch(a){console.error("Config load error:",a),Q=[]}}async function ua(e){var s;const t=e.querySelector("#dtb-company").value,a=e.querySelector("#dtb-config-content");a.innerHTML='<div class="skeleton" style="height:200px;"></div>';try{const r=await h.getPartnerAccountConfig({companyId:t}),{configs:o,categories:n,labels:i,availableAccounts:p}=r,c={};for(const d of o)c[d.account_category]=d;const l=e.querySelector("#dtb-company"),u=((s=l.options[l.selectedIndex])==null?void 0:s.text)||"";a.innerHTML=`
      <h4 style="color:var(--text-white);margin:0 0 var(--space-md);font-size:0.85rem;">📌 ${u}</h4>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:var(--space-md);">
        ${n.map(d=>{const g=c[d];return`
            <div style="background:rgba(255,255,255,0.03);border-radius:var(--radius-md);padding:var(--space-md);border:1px solid rgba(255,255,255,0.06);">
              <label style="font-size:0.8rem;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:6px;">${i[d]}</label>
              <select class="filter-select config-select" data-category="${d}" style="width:100%;font-size:0.8rem;">
                <option value="">-- اختر الحساب --</option>
                ${p.map(f=>`
                  <option value="${f.account_code}" data-name="${f.account_name}" ${(g==null?void 0:g.account_code)===f.account_code?"selected":""}>${f.account_code} — ${f.account_name}</option>
                `).join("")}
              </select>
            </div>
          `}).join("")}
      </div>
      <div style="margin-top:var(--space-md);display:flex;gap:var(--space-sm);">
        <button class="btn btn-primary" id="btn-save-config" style="font-size:0.8rem;">💾 حفظ الإعدادات</button>
      </div>
    `,e.querySelector("#btn-save-config").addEventListener("click",async()=>{const d=e.querySelectorAll(".config-select"),g=[];d.forEach(f=>{var x;const b=f.options[f.selectedIndex];g.push({category:f.dataset.category,account_code:f.value,account_name:((x=b==null?void 0:b.dataset)==null?void 0:x.name)||""})});try{await h.savePartnerAccountConfig({companyId:t,mappings:g}),y("✅ تم حفظ إعدادات الحسابات","success"),await Re(e)}catch{y("خطأ في الحفظ","error")}})}catch{a.innerHTML='<p style="color:var(--accent-red);">خطأ في تحميل الإعدادات</p>'}}async function ma(e){const t=e.querySelector("#dtb-company").value,a=e.querySelector("#dtb-date-from").value,s=e.querySelector("#dtb-date-to").value,r=e.querySelector("#dtb-cost-center").value;if(!a||!s){y("يجب اختيار الفترة","error");return}const o=e.querySelector("#dtb-content");o.innerHTML='<div class="skeleton" style="height:400px;border-radius:var(--radius-lg);"></div>';try{const n=[h.getTrialBalance({companyId:t,dateFrom:a,dateTo:s,costCenter:r})];Q.length>0&&n.push(h.getDetailedTrialBalance({companyId:t,dateFrom:a,dateTo:s,accountCodes:Q.join(",")}));const[i,p]=await Promise.all(n);if(le=i,ae={},p!=null&&p.accounts)for(const c of p.accounts)ae[c.account_code]||(ae[c.account_code]=[]),ae[c.account_code].push(c);gt(e),e.querySelector("#btn-dtb-pdf").disabled=!1,e.querySelector("#btn-dtb-excel").disabled=!1}catch(n){console.error("Load error:",n),y("خطأ في تحميل الميزان","error"),o.innerHTML='<p style="text-align:center;color:var(--accent-red);padding:var(--space-xl);">خطأ في التحميل</p>'}}function gt(e){var p,c;const t=e.querySelector("#dtb-content");if(!le)return;const a=((p=e.querySelector("#chk-dtb-zero"))==null?void 0:p.checked)||!1,s=e.querySelector("#dtb-company"),r=((c=s.options[s.selectedIndex])==null?void 0:c.text)||"";let o=le.accounts||[];a&&(o=o.filter(l=>l.open_debit||l.open_credit||l.period_debit||l.period_credit||l.close_debit||l.close_credit));const n={od:0,oc:0,pd:0,pc:0,cd:0,cc:0};let i="";for(let l=0;l<o.length;l++){const u=o[l];n.od+=u.open_debit||0,n.oc+=u.open_credit||0,n.pd+=u.period_debit||0,n.pc+=u.period_credit||0,n.cd+=u.close_debit||0,n.cc+=u.close_credit||0;const d=Q.includes(u.account_code),g=ae[u.account_code]||[],f=d&&g.length>0;if(i+=`
      <tr class="${f?"expandable-row":""}" data-code="${u.account_code}"
          style="${f?"cursor:pointer;":""}${l%2===0?"":"background:rgba(255,255,255,0.015);"}">
        <td style="font-family:var(--font-en);font-weight:500;${f?"color:var(--accent-blue);":""}">${u.account_code}</td>
        <td style="${f?"color:var(--accent-blue);font-weight:600;":""}">
          ${f?'<span class="expand-icon" style="display:inline-block;transition:transform 0.2s;margin-left:4px;font-size:0.7rem;">▶</span>':""}
          ${u.account_name}
          ${f?`<span style="font-size:0.65rem;color:var(--text-muted);margin-right:6px;">(${g.length} شريك)</span>`:""}
        </td>
        <td class="number">${v(u.open_debit,2)}</td>
        <td class="number">${v(u.open_credit,2)}</td>
        <td class="number">${v(u.period_debit,2)}</td>
        <td class="number">${v(u.period_credit,2)}</td>
        <td class="number">${v(u.close_debit,2)}</td>
        <td class="number">${v(u.close_credit,2)}</td>
      </tr>
    `,f)for(const b of g){const x=(b.close_debit||0)-(b.close_credit||0);i+=`
          <tr class="partner-detail-row" data-parent="${u.account_code}" style="display:none;background:rgba(59,130,246,0.03);">
            <td style="color:var(--text-muted);font-size:0.75rem;"></td>
            <td style="padding-right:36px;color:var(--text-secondary);font-size:0.8rem;">↳ ${b.partner_name}</td>
            <td class="number" style="font-size:0.8rem;">${v(b.open_debit,2)}</td>
            <td class="number" style="font-size:0.8rem;">${v(b.open_credit,2)}</td>
            <td class="number" style="font-size:0.8rem;">${v(b.period_debit,2)}</td>
            <td class="number" style="font-size:0.8rem;">${v(b.period_credit,2)}</td>
            <td class="number" style="font-size:0.8rem;color:${x>=0?"var(--accent-emerald)":"var(--accent-red)"};">${v(b.close_debit,2)}</td>
            <td class="number" style="font-size:0.8rem;color:${x>=0?"var(--accent-emerald)":"var(--accent-red)"};">${v(b.close_credit,2)}</td>
          </tr>
        `}}t.innerHTML=`
    <div class="glass-card" style="padding:var(--space-md);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md);">
        <h3 style="color:var(--text-white);margin:0;font-size:0.95rem;">${r}</h3>
        <span style="color:var(--text-muted);font-size:0.75rem;">${o.length} حساب</span>
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
          <tbody>${i}</tbody>
          <tfoot>
            <tr style="font-weight:700;background:rgba(255,255,255,0.04);">
              <td colspan="2" style="text-align:right;">الإجمالي</td>
              <td class="number">${v(n.od,2)}</td>
              <td class="number">${v(n.oc,2)}</td>
              <td class="number">${v(n.pd,2)}</td>
              <td class="number">${v(n.pc,2)}</td>
              <td class="number">${v(n.cd,2)}</td>
              <td class="number">${v(n.cc,2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  `,t.querySelectorAll(".expandable-row").forEach(l=>{l.addEventListener("click",()=>{var b;const u=l.dataset.code,d=l.querySelector(".expand-icon"),g=t.querySelectorAll(`.partner-detail-row[data-parent="${u}"]`),f=((b=g[0])==null?void 0:b.style.display)!=="none";g.forEach(x=>x.style.display=f?"none":""),d&&(d.style.transform=f?"":"rotate(90deg)")})})}function yt(e){var o,n;if(!le)return null;const t=((o=e.querySelector("#chk-dtb-zero"))==null?void 0:o.checked)||!1;let a=le.accounts||[];t&&(a=a.filter(i=>i.open_debit||i.open_credit||i.period_debit||i.period_credit||i.close_debit||i.close_credit));const s=e.querySelector("#dtb-company"),r=((n=s.options[s.selectedIndex])==null?void 0:n.text)||"";return{items:a,companyName:r,dateFrom:e.querySelector("#dtb-date-from").value,dateTo:e.querySelector("#dtb-date-to").value}}function ga(e){const t=yt(e);if(!t)return y("لا توجد بيانات","error");try{const{items:a,companyName:s,dateFrom:r,dateTo:o}=t,n=[];n.push([`ميزان المراجعة التفصيلي — ${s}`]),n.push([`الفترة: ${r} → ${o}`]),n.push([]),n.push(["كود","الحساب","الشريك","افتتاحي مدين","افتتاحي دائن","حركة مدين","حركة دائن","ختامي مدين","ختامي دائن"]);for(const u of a){n.push([u.account_code,u.account_name,"",u.open_debit||0,u.open_credit||0,u.period_debit||0,u.period_credit||0,u.close_debit||0,u.close_credit||0]);const d=ae[u.account_code];if(d)for(const g of d)n.push(["","",g.partner_name,g.open_debit||0,g.open_credit||0,g.period_debit||0,g.period_credit||0,g.close_debit||0,g.close_credit||0])}const i={od:0,oc:0,pd:0,pc:0,cd:0,cc:0};for(const u of a)i.od+=u.open_debit||0,i.oc+=u.open_credit||0,i.pd+=u.period_debit||0,i.pc+=u.period_credit||0,i.cd+=u.close_debit||0,i.cc+=u.close_credit||0;n.push(["","الإجمالي","",i.od,i.oc,i.pd,i.pc,i.cd,i.cc]);const p=XLSX.utils.book_new(),c=XLSX.utils.aoa_to_sheet(n);c["!cols"]=[{wch:12},{wch:35},{wch:35},{wch:16},{wch:16},{wch:16},{wch:16},{wch:16},{wch:16}],c["!merges"]=[{s:{r:0,c:0},e:{r:0,c:8}},{s:{r:1,c:0},e:{r:1,c:8}}];const l="#,##0.00";for(let u=4;u<n.length;u++)for(let d=3;d<=8;d++){const g=XLSX.utils.encode_cell({r:u,c:d});c[g]&&typeof c[g].v=="number"&&(c[g].t="n",c[g].z=l)}XLSX.utils.book_append_sheet(p,c,"ميزان تفصيلي"),XLSX.writeFile(p,`detailed_trial_balance_${r}_${o}.xlsx`),y("✅ تم تصدير Excel","success")}catch(a){console.error(a),y("خطأ في التصدير","error")}}async function ya(e){const t=yt(e);if(!t)return y("لا توجد بيانات","error");try{y("⏳ جاري إنشاء PDF...","info");const{items:a,companyName:s,dateFrom:r,dateTo:o}=t,n=k=>!k||k===0?"-":Number(k).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});let i="",p=0;for(const k of a){const E=Q.includes(k.account_code),j=p%2===0?"#fff":"#f1f5f9";i+=`<tr style="background:${E?"#eef2ff":j};">
        <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:center;font-family:monospace;font-weight:${E?"700":"500"};color:${E?"#2563eb":"#000"};">${k.account_code}</td>
        <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:right;font-weight:${E?"700":"500"};color:${E?"#2563eb":"#000"};">${k.account_name}</td>
        <td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:left;font-family:monospace;color:#000;">${n(k.open_debit)}</td>
        <td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:left;font-family:monospace;color:#000;">${n(k.open_credit)}</td>
        <td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:left;font-family:monospace;color:#000;">${n(k.period_debit)}</td>
        <td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:left;font-family:monospace;color:#000;">${n(k.period_credit)}</td>
        <td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:left;font-family:monospace;color:#000;">${n(k.close_debit)}</td>
        <td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:left;font-family:monospace;color:#000;">${n(k.close_credit)}</td>
      </tr>`,p++;const T=ae[k.account_code];if(T)for(const I of T)i+=`<tr style="background:#f8fafc;">
          <td style="padding:3px;border:1px solid #e2e8f0;"></td>
          <td style="padding:3px 8px;border:1px solid #e2e8f0;text-align:right;font-size:10px;color:#475569;padding-right:20px;">↳ ${I.partner_name}</td>
          <td style="padding:3px 6px;border:1px solid #e2e8f0;text-align:left;font-family:monospace;font-size:10px;color:#475569;">${n(I.open_debit)}</td>
          <td style="padding:3px 6px;border:1px solid #e2e8f0;text-align:left;font-family:monospace;font-size:10px;color:#475569;">${n(I.open_credit)}</td>
          <td style="padding:3px 6px;border:1px solid #e2e8f0;text-align:left;font-family:monospace;font-size:10px;color:#475569;">${n(I.period_debit)}</td>
          <td style="padding:3px 6px;border:1px solid #e2e8f0;text-align:left;font-family:monospace;font-size:10px;color:#475569;">${n(I.period_credit)}</td>
          <td style="padding:3px 6px;border:1px solid #e2e8f0;text-align:left;font-family:monospace;font-size:10px;color:#475569;">${n(I.close_debit)}</td>
          <td style="padding:3px 6px;border:1px solid #e2e8f0;text-align:left;font-family:monospace;font-size:10px;color:#475569;">${n(I.close_credit)}</td>
        </tr>`}let c={od:0,oc:0,pd:0,pc:0,cd:0,cc:0};for(const k of a)c.od+=k.open_debit||0,c.oc+=k.open_credit||0,c.pd+=k.period_debit||0,c.pc+=k.period_credit||0,c.cd+=k.close_debit||0,c.cc+=k.close_credit||0;i+=`<tr style="background:#1e293b;color:#fff;font-weight:700;">
      <td style="padding:6px 8px;border:1px solid #000;" colspan="2" align="right">الإجمالي</td>
      <td style="padding:6px;border:1px solid #000;text-align:left;font-family:monospace;">${n(c.od)}</td>
      <td style="padding:6px;border:1px solid #000;text-align:left;font-family:monospace;">${n(c.oc)}</td>
      <td style="padding:6px;border:1px solid #000;text-align:left;font-family:monospace;">${n(c.pd)}</td>
      <td style="padding:6px;border:1px solid #000;text-align:left;font-family:monospace;">${n(c.pc)}</td>
      <td style="padding:6px;border:1px solid #000;text-align:left;font-family:monospace;">${n(c.cd)}</td>
      <td style="padding:6px;border:1px solid #000;text-align:left;font-family:monospace;">${n(c.cc)}</td>
    </tr>`;const l=document.createElement("div");l.style.cssText="position:fixed;top:-99999px;left:0;width:1400px;background:#fff;padding:30px;font-family:Arial,Tahoma,sans-serif;direction:rtl;color:#000;",l.innerHTML=`
      <div style="text-align:center;margin-bottom:20px;">
        <h2 style="margin:0 0 6px;font-size:22px;color:#000;font-weight:900;">ميزان المراجعة التفصيلي</h2>
        <h3 style="margin:0 0 6px;font-size:16px;color:#1e293b;font-weight:700;">${s}</h3>
        <p style="margin:0;font-size:13px;color:#334155;font-weight:600;">الفترة: ${r} → ${o}</p>
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
        <tbody>${i}</tbody>
      </table>
      <div style="text-align:center;margin-top:14px;font-size:10px;color:#64748b;">Mizaniat BI | ${new Date().toLocaleString("ar-SA")}</div>
    `,document.body.appendChild(l);const u=await it(l,{scale:3,useCORS:!0,backgroundColor:"#fff"});document.body.removeChild(l);const d=new lt({orientation:"landscape",unit:"mm",format:"a4"}),g=d.internal.pageSize.getWidth(),f=d.internal.pageSize.getHeight(),b=15,x=12,z=10,w=g-z*2,m=f-b-x,$=w,_=u.height/u.width*$,L=u.toDataURL("image/png");if(_<=m)d.addImage(L,"PNG",z,b,$,_);else{const k=Math.ceil((_+5)/m);for(let E=0;E<k;E++){E>0&&d.addPage(),d.addImage(L,"PNG",z,b-E*m,$,_),d.setFillColor(255,255,255),d.rect(0,0,g,b,"F");const j=E===k-1;j?d.rect(0,f-5,g,5,"F"):d.rect(0,f-x,g,x,"F"),d.setFontSize(8),d.setTextColor(150),d.text(`${E+1} / ${k}`,g/2,f-(j?1.5:4),{align:"center"})}}d.save(`detailed_trial_balance_${r}_${o}.pdf`),y("✅ تم تصدير PDF","success")}catch(a){console.error(a),y("خطأ: "+a.message,"error")}}async function ba(e){const t=S.get("companies")||[];e.innerHTML=`
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
            ${t.map(a=>`<option value="${a.id}">${a.name}</option>`).join("")}
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
  `,e.querySelector("#btn-ce-load").addEventListener("click",()=>De(e)),De(e)}async function De(e){const t=e.querySelector("#ce-content"),a=e.querySelector("#ce-company").value;t.innerHTML='<div class="skeleton" style="height:200px;border-radius:var(--radius-lg);"></div>';try{const s=await h.getClosingEntries({companyId:a});va(e,s.entries||[])}catch(s){console.error("Error loading closing entries:",s),t.innerHTML='<p style="text-align:center;color:var(--accent-red);padding:var(--space-xl);">خطأ في تحميل القيود</p>'}}function va(e,t){const a=e.querySelector("#ce-content");if(t.length===0){a.innerHTML=`
      <div class="glass-card" style="padding:var(--space-xl);text-align:center;">
        <div style="font-size:2rem;margin-bottom:var(--space-md);">📋</div>
        <div style="color:var(--text-muted);font-size:0.9rem;">لا توجد قيود إقفال حالياً</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:var(--space-sm);">
          يمكنك إنشاء قيود إقفال من صفحة <strong>ميزان المراجعة</strong>
        </div>
      </div>
    `;return}a.innerHTML=t.map(s=>{const r=s.lines||[];return`
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
              ${r.map(o=>`
                <tr${o.account_code===s.target_account?' style="background:rgba(16,185,129,0.08);font-weight:600;"':""}>
                  <td style="font-family:var(--font-en);color:var(--accent-blue);">${o.account_code}</td>
                  <td>${o.account_name}</td>
                  <td style="font-size:0.7rem;color:var(--text-muted);">${o.account_type||"-"}</td>
                  <td class="number">${o.debit?v(o.debit,2):"-"}</td>
                  <td class="number">${o.credit?v(o.credit,2):"-"}</td>
                </tr>
              `).join("")}
              <tr class="total-row">
                <td colspan="3" style="font-weight:700;">الإجمالي</td>
                <td class="number" style="font-weight:700;">${v(r.reduce((o,n)=>o+(n.debit||0),0),2)}</td>
                <td class="number" style="font-weight:700;">${v(r.reduce((o,n)=>o+(n.credit||0),0),2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </div>
  `}).join(""),a.querySelectorAll(".btn-delete-ce").forEach(s=>{s.addEventListener("click",async()=>{const r=s.dataset.company,o=s.dataset.year;if(confirm(`هل تريد حذف قيد إقفال ${o}؟ سيتم إزالته من قاعدة البيانات.`))try{const n=await h.deleteClosingEntry({companyId:r,fiscalYear:o});y(`✅ تم حذف قيد الإقفال — ${o}`,"success"),De(e)}catch(n){console.error("Delete error:",n),y("خطأ في حذف القيد","error")}})})}const bt=["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#06b6d4","#84cc16","#f97316","#6366f1"];let X=[],ee=[],Fe=[],Ce={journals:[],analytics:[]};const A=e=>String(e??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"),pe=e=>Math.round(Number(e)||0).toLocaleString("en-US");async function fa(e){const t=S.get("companies")||[];e.innerHTML=`
    <div class="page-header">
      <div>
        <h1 class="page-title">الحسابات التحليلية</h1>
        <p class="page-subtitle">Analytic Accounts — تصنيف ومجموعات</p>
      </div>
    </div>

    <!-- CC1: ambiguities that need a user decision -->
    <div class="glass-card" id="cc-conflicts-card" style="padding:var(--space-lg);margin-bottom:var(--space-lg);border:1px solid rgba(245,158,11,0.35);">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:var(--space-md);flex-wrap:wrap;margin-bottom:var(--space-sm);">
        <h3 style="margin:0;color:var(--accent-amber);font-size:0.95rem;">⚠️ تعارضات تحتاج قرارًا</h3>
        <div style="display:flex;align-items:center;gap:var(--space-sm);">
          <span id="cc-conflicts-count" style="font-size:0.75rem;color:var(--text-muted);"></span>
          <button class="btn" id="btn-cc-rebuild" style="font-size:0.72rem;padding:4px 10px;" title="إعادة حساب الأقسام ومراكز التكلفة للقيود والفواتير والتحصيل من الإعدادات الحالية">🔄 إعادة بناء الإسناد</button>
        </div>
      </div>
      <p style="margin:0 0 var(--space-md);font-size:0.78rem;color:var(--text-secondary);line-height:1.7;">
        لا يختار النظام قسمًا أو مركز تكلفة بنفسه عند الغموض. السطور والفواتير غير الموسومة بحساب تحليلي في دفتر غير محسوم تبقى في صفّ الدفتر المستقل «… — بدون مركز تكلفة» بلا قسم حتى تعتمد قرارك هنا، ثم يُعاد بناء الأرقام فورًا.
      </p>
      <div id="cc-conflicts-content"><div class="skeleton" style="height:80px;"></div></div>
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
            ${t.map(s=>`<option value="${s.id}">${s.name}</option>`).join("")}
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

    <!-- CC1: explicit journal defaults of the selected company -->
    <div class="glass-card" id="journal-defaults-card" style="padding:var(--space-lg);margin-bottom:var(--space-lg);">
      <h3 style="margin:0 0 var(--space-sm);color:var(--text-white);font-size:0.95rem;">📒 القسم ومركز التكلفة الافتراضي للدفاتر</h3>
      <p style="margin:0 0 var(--space-md);font-size:0.78rem;color:var(--text-secondary);line-height:1.7;">
        مركز التكلفة الافتراضي يُطبَّق فقط على سطور الدفتر وفواتيره التي لا تحمل حسابًا تحليليًا في أودو؛ والقسم يُطبَّق عليها وعلى سطور الدفتر التي تحمل حسابًا تحليليًا غير مصنف في قسم. الصفوف «مُرحّلة» نُقلت مرة واحدة من الإعدادات السابقة لأنها لا تحتمل إلا قيمة واحدة؛ يمكنك تعديلها أو اعتمادها.
      </p>
      <div id="journal-defaults-content">
        <p style="text-align:center;color:var(--text-muted);padding:var(--space-md);">اختر شركة واضغط "تحميل الحسابات"</p>
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
            ${bt.map((s,r)=>`
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
  `,e.querySelectorAll(".color-dot").forEach(s=>{s.addEventListener("click",()=>{e.querySelectorAll(".color-dot").forEach(r=>r.style.borderColor="transparent"),s.style.borderColor="#fff"})});const a=e.querySelector(".color-dot");a&&(a.style.borderColor="#fff"),e.querySelector("#btn-add-group").addEventListener("click",()=>ft(e)),e.querySelector("#btn-cancel-modal").addEventListener("click",()=>Oe(e)),e.querySelector("#btn-confirm-modal").addEventListener("click",()=>xa(e)),e.querySelector("#btn-load-accounts").addEventListener("click",()=>ht(e)),e.querySelector("#btn-save-mappings").addEventListener("click",()=>$a(e)),e.querySelector("#group-modal").addEventListener("click",s=>{s.target.id==="group-modal"&&Oe(e)}),e.querySelector("#btn-cc-rebuild").addEventListener("click",async s=>{const r=s.currentTarget;r.disabled=!0;try{await h.rebuildAttribution(),y("✅ أُعيد بناء الإسناد من الإعدادات الحالية","success"),await be(e)}catch(o){y("خطأ في إعادة البناء: "+(o.message||""),"error")}finally{r.disabled=!1}}),await Ge(e),await be(e)}function vt(e,t,a=""){return`
    <select class="filter-select ${e}" ${a} style="font-size:0.78rem;padding:4px 8px;width:100%;max-width:100%;box-sizing:border-box;">
      <option value="">— بدون قسم (يبقى في صفّه) —</option>
      ${X.map(s=>`<option value="${s.id}"${String(s.id)===String(t)?" selected":""}>${A(s.name)}</option>`).join("")}
    </select>`}async function be(e){const t=e.querySelector("#cc-conflicts-content"),a=e.querySelector("#cc-conflicts-count");if(t)try{const s=await h.getAttributionConflicts(),r=s.journals||[],o=s.analytics||[],n=s.combinations||[],i=s.unmapped_analytics||[],p=s.stale_mappings||[];a.textContent=`${r.length+o.length+n.length} بندًا`;const c=`
      ${i.length?`
      <details style="margin-top:var(--space-md);font-size:0.8rem;">
        <summary>للعلم: ${i.length} مركز تكلفة له مبالغ دون قسم (يظهر باسمه حتى يُصنَّف في الجدول أدناه)</summary>
        <ul style="margin:6px 0 0;padding-right:18px;">
          ${i.map(l=>`<li>${A(l.company_name)} — ${A(l.name)} <span style="color:var(--text-muted);">(${A(l.cost_center_key)} · إيراد ${pe(l.revenue)} · مصروف ${pe(l.expense)})</span></li>`).join("")}
        </ul>
      </details>`:""}
      ${p.length?`
      <details style="margin-top:var(--space-sm);font-size:0.8rem;">
        <summary>للعلم: ${p.length} تصنيف محفوظ لا يطابق أي حساب تحليلي حالي (ربما تغيّر اسمه في أودو)</summary>
        <ul style="margin:6px 0 0;padding-right:18px;">
          ${p.map(l=>`<li>${A(l.company_name)} — ${A(l.analytic_account)}</li>`).join("")}
        </ul>
      </details>`:""}`;if(r.length+o.length+n.length===0){t.innerHTML=`<p style="margin:0;color:var(--accent-emerald);font-size:0.82rem;">✓ لا توجد تعارضات بانتظار قرار.</p>${c}`;return}t.innerHTML=`
      ${r.length?`
      <div class="data-table-wrapper" id="cc-conflicts-wrap">
        <!-- Three fixed columns (journal · candidates and amounts · decision) so the table never
             needs a horizontal scroll; the two selects and the button are stacked in the last one. -->
        <table class="data-table" id="cc-conflicts-journals" style="font-size:0.8rem;table-layout:fixed;width:100%;">
          <colgroup>
            <col style="width:28%;">
            <col style="width:40%;">
            <col style="width:32%;">
          </colgroup>
          <thead>
            <tr>
              <th style="text-align:right;">الدفتر والتعارض</th>
              <th style="text-align:right;">المرشحون والمبالغ</th>
              <th style="text-align:right;">القرار</th>
            </tr>
          </thead>
          <tbody>
            ${r.map((l,u)=>{const d=(l.ledger_by_year||[]).reduce((z,w)=>({rev:z.rev+(w.revenue||0),exp:z.exp+(w.expense||0)}),{rev:0,exp:0}),g=l.current_default?l.current_default.group_id:"",f=l.current_default?l.current_default.analytic_id:"",b="vertical-align:top;white-space:normal;overflow-wrap:anywhere;",x="font-size:0.72rem;color:var(--text-muted);";return`
              <tr data-idx="${u}">
                <td style="${b}">
                  <strong>${A(l.journal_name)}</strong>
                  <div class="cc-key" style="${x}">${A(l.cost_center_key)}</div>
                  <div style="${x}">${A(l.company_name)}</div>
                  <div style="margin-top:4px;color:var(--accent-amber);font-size:0.75rem;">${l.kind==="department"?"مرتبط بأكثر من قسم":"مرتبط بأكثر من مركز تكلفة"}</div>
                  ${l.current_default&&l.current_default.group_id?`<div style="${x}">القسم المرحّل: ${A(l.current_default.group_name||"")}</div>`:""}
                </td>
                <td style="${b}font-size:0.76rem;">
                  <div><span style="color:var(--text-muted);">الأقسام:</span> ${l.candidate_departments.map(z=>A(z.name)).join(" / ")||"—"}</div>
                  <details style="margin-top:4px;"><summary style="cursor:pointer;">${l.candidate_analytics.length} مركز تكلفة مرشح</summary>
                    <ul style="margin:4px 0 0;padding-right:16px;max-height:180px;overflow-y:auto;">
                      ${l.candidate_analytics.map(z=>`<li>${A(z.name)}${z.department_name?` <span style="color:var(--text-muted);">(${A(z.department_name)})</span>`:""}</li>`).join("")}
                    </ul>
                  </details>
                  <div style="margin-top:6px;"><span style="color:var(--text-muted);">فواتير على صفّ الدفتر:</span> ${l.invoices} <span style="${x}">(${pe(l.invoices_untaxed)} قبل الضريبة)</span></div>
                  <div><span style="color:var(--text-muted);">إيراد / مصروف غير موسوم:</span> ${pe(d.rev)} / ${pe(d.exp)}</div>
                </td>
                <td style="${b}">
                  <label style="display:block;${x}margin-bottom:2px;">القسم</label>
                  ${vt("cc-group-select",g)}
                  <label style="display:block;${x}margin:6px 0 2px;">مركز التكلفة للسطور غير الموسومة</label>
                  <select class="filter-select cc-analytic-select" style="font-size:0.78rem;padding:4px 8px;width:100%;max-width:100%;box-sizing:border-box;">
                    <option value="">— بدون (صفّ الدفتر المستقل) —</option>
                    ${l.candidate_analytics.filter(z=>z.analytic_id).map(z=>`<option value="${z.analytic_id}"${String(z.analytic_id)===String(f)?" selected":""}>${A(z.name)}</option>`).join("")}
                  </select>
                  <button class="btn btn-primary cc-decide" style="margin-top:8px;font-size:0.75rem;padding:5px 12px;">اعتماد القرار</button>
                </td>
              </tr>`}).join("")}
          </tbody>
        </table>
      </div>`:""}
      ${o.length?`
      <div style="margin-top:var(--space-md);font-size:0.8rem;">
        <strong>حسابات تحليلية مصنفة في أكثر من قسم</strong> (تُعامل بلا قسم حتى يُصحَّح تصنيفها في الجدول أدناه):
        <ul style="margin:6px 0 0;padding-right:18px;">
          ${o.map(l=>`<li>${A(l.company_name)} — ${A(l.analytic_account)}: ${l.departments.map(u=>A(u.name)).join(" / ")}</li>`).join("")}
        </ul>
      </div>`:""}
      ${n.length?`
      <div style="margin-top:var(--space-md);font-size:0.8rem;">
        <strong>سطور بتوزيع تحليلي يجمع أكثر من خطة في مفتاح واحد</strong> (تبقى في صفّ الدفتر):
        ${n.map(l=>`${A(l.company_name)}: ${l.lines} سطر`).join(" · ")}
      </div>`:""}
      ${c}
    `,t.querySelectorAll("#cc-conflicts-journals tbody tr").forEach(l=>{const u=r[Number(l.dataset.idx)];l.querySelector(".cc-decide").addEventListener("click",async d=>{var f;const g=d.currentTarget;g.disabled=!0;try{await h.saveJournalDefault({companyId:u.company_id,journalId:u.journal_id,groupId:l.querySelector(".cc-group-select").value||null,analyticId:l.querySelector(".cc-analytic-select").value||null}),y("✅ تم اعتماد القرار وإعادة بناء الأرقام","success"),await be(e);const b=(f=e.querySelector("#aa-company"))==null?void 0:f.value;b&&String(b)===String(u.company_id)&&ee.length&&await Xe(e,b)}catch(b){y("خطأ في حفظ القرار: "+(b.message||""),"error"),g.disabled=!1}})})}catch(s){console.error("Load conflicts error:",s),t.innerHTML='<p style="color:var(--accent-red);margin:0;">خطأ في تحميل التعارضات</p>'}}async function Xe(e,t){const a=e.querySelector("#journal-defaults-content");if(a){a.innerHTML='<div class="skeleton" style="height:120px;"></div>';try{Ce=await h.getJournalDefaults(t);const s=Ce.journals||[];if(!s.length){a.innerHTML='<p style="text-align:center;color:var(--text-muted);padding:var(--space-md);">لا توجد دفاتر مبيعات أو إعدادات دفاتر لهذه الشركة</p>';return}const r=o=>(Ce.analytics||[]).map(n=>`<option value="${n.id}"${String(n.id)===String(o)?" selected":""}>${A(n.name)}</option>`).join("");a.innerHTML=`
      <div class="data-table-wrapper">
        <table class="data-table" id="journal-defaults-table" style="font-size:0.8rem;table-layout:fixed;width:100%;">
          <colgroup>
            <col style="width:24%;"><col style="width:8%;"><col style="width:11%;">
            <col style="width:22%;"><col style="width:23%;"><col style="width:12%;">
          </colgroup>
          <thead>
            <tr>
              <th style="text-align:right;">الدفتر</th>
              <th style="text-align:center;">الفواتير</th>
              <th style="text-align:center;">الحالة</th>
              <th style="text-align:center;">القسم</th>
              <th style="text-align:center;white-space:normal;">مركز التكلفة للسطور غير الموسومة</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${s.map((o,n)=>{const i=o.decided_by_user?'<span style="color:var(--accent-emerald);">قرار المستخدم</span>':o.source==="seed"?'<span style="color:var(--accent-blue);">مُرحّلة</span>':o.flagged?'<span style="color:var(--accent-amber);">تحتاج قرارًا</span>':'<span style="color:var(--text-muted);">بلا إعداد</span>';return`
              <tr data-idx="${n}">
                <td style="white-space:normal;overflow-wrap:anywhere;"><strong>${A(o.journal_name)}</strong><div style="font-size:0.7rem;color:var(--text-muted);">j:${o.journal_id}</div></td>
                <td style="text-align:center;">${o.invoices}</td>
                <td style="text-align:center;white-space:normal;">${i}</td>
                <td>${vt("jd-group-select",o.group_id||"")}</td>
                <td>
                  <select class="filter-select jd-analytic-select" style="font-size:0.78rem;padding:4px 8px;width:100%;max-width:100%;box-sizing:border-box;">
                    <option value="">— بدون (صفّ الدفتر المستقل) —</option>
                    ${r(o.analytic_id||"")}
                  </select>
                </td>
                <td style="white-space:normal;">
                  <button class="btn btn-primary jd-save" style="font-size:0.72rem;padding:4px 8px;margin:2px;">حفظ</button>
                  ${o.group_id||o.analytic_id||o.decided_by_user?'<button class="btn jd-clear" style="font-size:0.72rem;padding:4px 8px;margin:2px;">إلغاء</button>':""}
                </td>
              </tr>`}).join("")}
          </tbody>
        </table>
      </div>
    `,a.querySelectorAll("#journal-defaults-table tbody tr").forEach(o=>{const n=s[Number(o.dataset.idx)],i=async c=>{y(c,"success"),await Xe(e,t),await be(e)};o.querySelector(".jd-save").addEventListener("click",async c=>{const l=c.currentTarget;l.disabled=!0;try{await h.saveJournalDefault({companyId:t,journalId:n.journal_id,groupId:o.querySelector(".jd-group-select").value||null,analyticId:o.querySelector(".jd-analytic-select").value||null}),await i("✅ تم حفظ إعداد الدفتر وإعادة بناء الأرقام")}catch(u){y("خطأ في الحفظ: "+(u.message||""),"error"),l.disabled=!1}});const p=o.querySelector(".jd-clear");p&&p.addEventListener("click",async()=>{if(confirm("سيعود الدفتر بلا قسم ولا مركز تكلفة افتراضي (صفّه المستقل). متابعة؟"))try{await h.deleteJournalDefault(t,n.journal_id),await i("تم إلغاء إعداد الدفتر")}catch(c){y("خطأ: "+(c.message||""),"error")}})})}catch(s){console.error("Load journal defaults error:",s),a.innerHTML='<p style="color:var(--accent-red);text-align:center;">خطأ في تحميل إعدادات الدفاتر</p>'}}}async function Ge(e){try{X=await h.getAnalyticGroups(),ha(e)}catch(t){console.error("Load groups error:",t)}}function ha(e){const t=e.querySelector("#groups-list");if(!X.length){t.innerHTML='<p style="color:var(--text-muted);font-size:0.8rem;">لا توجد مجموعات — أنشئ مجموعة جديدة لبدء التصنيف</p>';return}t.innerHTML=X.map(a=>`
    <div class="group-chip" data-id="${a.id}" style="
      display:flex;align-items:center;gap:8px;padding:8px 14px;
      background:rgba(255,255,255,0.04);border-radius:var(--radius-md);
      border:1px solid ${a.color}33;cursor:default;
    ">
      <span style="width:12px;height:12px;border-radius:50%;background:${a.color};flex-shrink:0;"></span>
      <span style="color:var(--text-white);font-size:0.85rem;font-weight:500;">${a.name}</span>
      <button class="btn-edit-group" data-id="${a.id}" style="
        background:none;border:none;color:var(--text-muted);cursor:pointer;
        font-size:0.7rem;padding:2px 4px;margin-right:4px;
      ">✏️</button>
      <button class="btn-delete-group" data-id="${a.id}" style="
        background:none;border:none;color:var(--accent-red);cursor:pointer;
        font-size:0.7rem;padding:2px 4px;opacity:0.6;
      ">✕</button>
    </div>
  `).join(""),t.querySelectorAll(".btn-edit-group").forEach(a=>{a.addEventListener("click",()=>{const s=X.find(r=>r.id==a.dataset.id);s&&ft(e,s)})}),t.querySelectorAll(".btn-delete-group").forEach(a=>{a.addEventListener("click",async()=>{if(confirm("هل تريد حذف هذه المجموعة؟ سيتم إلغاء ربط جميع الحسابات المرتبطة بها."))try{await h.deleteAnalyticGroup(a.dataset.id),y("تم حذف المجموعة","success"),await Ge(e),ee.length&&Ye(e)}catch{y("خطأ في الحذف","error")}})})}function ft(e,t=null){const a=e.querySelector("#group-modal");a.style.display="flex",e.querySelector("#modal-title").textContent=t?"تعديل المجموعة":"مجموعة جديدة",e.querySelector("#group-name").value=t?t.name:"",e.querySelector("#edit-group-id").value=t?t.id:"";const s=t?t.color:bt[0];e.querySelectorAll(".color-dot").forEach(o=>{o.style.borderColor=o.dataset.color===s?"#fff":"transparent"});const r=e.querySelector(`input[name="group-color"][value="${s}"]`);r&&(r.checked=!0),e.querySelector("#group-name").focus()}function Oe(e){e.querySelector("#group-modal").style.display="none"}async function xa(e){var r;const t=e.querySelector("#group-name").value.trim(),a=((r=e.querySelector('input[name="group-color"]:checked'))==null?void 0:r.value)||"#3b82f6",s=e.querySelector("#edit-group-id").value;if(!t){y("أدخل اسم المجموعة","error");return}try{s?(await h.updateAnalyticGroup(s,{name:t,color:a}),y("✅ تم تعديل المجموعة","success")):(await h.createAnalyticGroup({name:t,color:a}),y("✅ تم إنشاء المجموعة","success")),Oe(e),await Ge(e),ee.length&&Ye(e)}catch{y("خطأ في الحفظ","error")}}async function ht(e){const t=e.querySelector("#aa-company").value,a=e.querySelector("#accounts-content");a.innerHTML='<div class="skeleton" style="height:300px;"></div>';try{const[s,r]=await Promise.all([h.getAnalyticAccounts({companyId:t}),h.getAnalyticGroupMappings({companyId:t})]);ee=s,Fe=r,Ye(e),e.querySelector("#btn-save-mappings").disabled=!1,await Xe(e,t)}catch(s){console.error("Load accounts error:",s),a.innerHTML='<p style="color:var(--accent-red);text-align:center;">خطأ في تحميل الحسابات</p>'}}function Ye(e){var u;const t=e.querySelector("#accounts-content"),a=e.querySelector("#aa-company"),s=((u=a.options[a.selectedIndex])==null?void 0:u.text)||"";if(!ee.length){t.innerHTML='<p style="text-align:center;color:var(--text-muted);padding:var(--space-lg);">لا توجد حسابات تحليلية لهذه الشركة</p>';return}const r={},o={};for(const d of Fe)r[d.analytic_account]=d.group_id,o[d.analytic_account]=d.redistributable?1:0;const n={};for(const d of Fe)n[d.group_id]=(n[d.group_id]||0)+1;const i=ee.filter(d=>!r[d.analytic_account]).length,p=X.map(d=>`<option value="${d.id}">${d.name}</option>`).join("");t.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md);">
      <h4 style="margin:0;color:var(--text-white);font-size:0.9rem;">📊 ${s} — ${ee.length} حساب تحليلي</h4>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${X.map(d=>`
          <span style="font-size:0.7rem;padding:3px 10px;border-radius:var(--radius-sm);background:${d.color}22;color:${d.color};border:1px solid ${d.color}44;">
            ${d.name}: ${n[d.id]||0}
          </span>
        `).join("")}
        <span style="font-size:0.7rem;padding:3px 10px;border-radius:var(--radius-sm);background:rgba(255,255,255,0.05);color:var(--text-muted);border:1px solid rgba(255,255,255,0.1);">
          غير مصنف: ${i}
        </span>
      </div>
    </div>
    <div style="margin-bottom:var(--space-md);display:flex;flex-wrap:wrap;gap:var(--space-sm);">
      <button class="btn btn-assign-all" data-group="" style="font-size:0.72rem;padding:4px 10px;">إلغاء الكل</button>
      ${X.map(d=>`
        <button class="btn btn-assign-all" data-group="${d.id}" style="font-size:0.72rem;padding:4px 10px;background:${d.color}15;color:${d.color};border-color:${d.color}33;">
          تعيين الكل → ${d.name}
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
            <th style="width:140px;text-align:center;">قابل لإعادة التوزيع</th>
          </tr>
        </thead>
        <tbody>
          ${ee.map((d,g)=>{const f=r[d.analytic_account]||"",b=o[d.analytic_account]||0,x=X.find(z=>z.id==f);return`
              <tr style="${x?`border-right:3px solid ${x.color};`:""}">
                <td style="text-align:center;"><input type="checkbox" class="aa-row-check" value="${d.analytic_account}" style="cursor:pointer;" /></td>
                <td style="color:var(--text-muted);font-size:0.75rem;">${g+1}</td>
                <td style="font-weight:500;">${d.analytic_account}</td>
                <td style="text-align:center;color:var(--text-muted);">
                  <span style="background:rgba(255,255,255,0.05);padding:2px 10px;border-radius:var(--radius-sm);font-size:0.75rem;">
                    ${d.transaction_count}
                  </span>
                </td>
                <td style="text-align:center;">
                  <select class="filter-select account-group-select" data-account="${d.analytic_account}" style="font-size:0.78rem;padding:4px 8px;width:100%;">
                    <option value="">— غير مصنف —</option>
                    ${p.replace(`value="${f}"`,`value="${f}" selected`)}
                  </select>
                </td>
                <td style="text-align:center;">
                  <select class="filter-select account-redist-select" data-account="${d.analytic_account}" style="font-size:0.78rem;padding:4px 8px;width:100%;">
                    <option value="0"${b?"":" selected"}>لا</option>
                    <option value="1"${b?" selected":""}>نعم</option>
                  </select>
                </td>
              </tr>
            `}).join("")}
        </tbody>
      </table>
    </div>
  `;const c=t.querySelector("#check-all-aa"),l=t.querySelectorAll(".aa-row-check");c&&c.addEventListener("change",d=>{l.forEach(g=>{g.checked=d.target.checked})}),t.querySelectorAll(".btn-assign-all").forEach(d=>{d.addEventListener("click",()=>{const g=d.dataset.group;let f=Array.from(l).filter(b=>b.checked);if(f.length===0){if(!confirm("لم يتم تحديد أي حسابات. هل تريد تطبيق هذه المجموعة على جميع الحسابات في الجدول؟"))return;t.querySelectorAll(".account-group-select").forEach(b=>{b.value=g,b.dispatchEvent(new Event("change"))})}else{const b=f.map(x=>x.value);t.querySelectorAll(".account-group-select").forEach(x=>{b.includes(x.dataset.account)&&(x.value=g,x.dispatchEvent(new Event("change")))}),c&&(c.checked=!1),l.forEach(x=>x.checked=!1)}})}),t.querySelectorAll(".account-group-select").forEach(d=>{d.addEventListener("change",()=>{const g=X.find(b=>b.id==d.value),f=d.closest("tr");f.style.borderRight=g?`3px solid ${g.color}`:""})})}async function $a(e){const t=e.querySelector("#aa-company").value,a=e.querySelectorAll(".account-group-select"),s=e.querySelectorAll(".account-redist-select"),r=[],o=[],n={};s.forEach(i=>{n[i.dataset.account]=parseInt(i.value)||0}),a.forEach(i=>{o.push(i.dataset.account),i.value&&r.push({analytic_account:i.dataset.account,group_id:parseInt(i.value),redistributable:n[i.dataset.account]||0})});try{await h.saveAnalyticGroupMappings({companyId:t,mappings:r,accounts:o}),y("✅ تم حفظ التصنيف وإعادة بناء الأرقام","success"),await ht(e),await be(e)}catch(i){console.error("Save mappings error:",i),y("خطأ في حفظ التصنيف","error")}}let me=[],ze=null;async function wa(e){const t=S.get("companies")||[];if(!t.length){e.innerHTML='<p style="text-align:center;color:var(--text-muted);padding:var(--space-2xl);">يرجى إضافة شركة أولاً.</p>';return}ze=t[0].id,e.innerHTML=`
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
            ${t.map(s=>`<option value="${s.id}">${s.name}</option>`).join("")}
          </select>
        </div>
      </div>
      
      <div id="journal-content">
        <div class="skeleton" style="height:300px;border-radius:var(--radius-md);"></div>
      </div>
    </div>
  `,e.querySelector("#jm-company").addEventListener("change",s=>{ze=parseInt(s.target.value),Ne(e)}),await Ne(e)}async function Ne(e){const t=e.querySelector("#journal-content");t.innerHTML='<div class="skeleton" style="height:300px;border-radius:var(--radius-md);"></div>';try{me=(await h.getJournalMappings(ze)).journals||[],ka(e,t)}catch(a){console.error("Error loading journals:",a),t.innerHTML=`<p style="text-align:center;color:var(--accent-red);">خطأ في تحميل أسماء اليوميات<br><small style="color:rgba(255,100,100,0.6);">${a.message}</small></p>`}}function ka(e,t){if(!me.length){t.innerHTML='<p style="text-align:center;color:var(--text-muted);padding:var(--space-xl);">لا توجد يوميات لهذه الشركة.</p>';return}const s=me.map(l=>l.journal_name).map(l=>`<option value="${l}">`).join("");t.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md);padding-bottom:var(--space-sm);border-bottom:1px solid rgba(255,255,255,0.05);">
        <h4 style="margin:0;font-size:0.95rem;color:var(--text-white);">🎯 تحديد ودمج الأسماء</h4>
        <span style="font-size:0.8rem;color:var(--text-muted);">إجمالي اليوميات المختلفة: ${me.length}</span>
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
          ${me.map((l,u)=>`
            <tr>
              <td style="text-align:center;">
                <input type="checkbox" class="row-checkbox" value="${l.journal_name}" style="cursor:pointer;" />
              </td>
              <td style="color:var(--text-muted);font-size:0.8rem;">${u+1}</td>
              <td style="font-weight:500;">
                <span style="cursor:pointer;" class="clickable-name" data-val="${l.journal_name}">${l.journal_name}</span>
              </td>
              <td style="text-align:center;color:var(--text-muted);">
                <span style="background:rgba(255,255,255,0.05);padding:2px 10px;border-radius:var(--radius-sm);font-size:0.8rem;">
                  ${l.count}
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
  `;const r=t.querySelector("#check-all"),o=t.querySelectorAll(".row-checkbox"),n=t.querySelector("#selected-count"),i=t.querySelector("#btn-merge");function p(){const l=Array.from(o).filter(u=>u.checked).length;n.textContent=l,i.disabled=l===0,r.checked=l===o.length&&l>0}r.addEventListener("change",l=>{o.forEach(u=>{u.checked=l.target.checked}),p()}),o.forEach(l=>{l.addEventListener("change",p)});const c=t.querySelector("#target-journal-name");t.querySelectorAll(".clickable-name").forEach(l=>{l.addEventListener("click",()=>{c.value=l.dataset.val})}),i.addEventListener("click",async()=>{const l=Array.from(o).filter(g=>g.checked).map(g=>g.value),u=c.value.trim();if(!u){y("يرجى تحديد إسم موحد لدمج اليوميات المختارة","error"),c.focus();return}if(l.length===0||!confirm(`هل أنت متأكد من دمج ${l.length} يومية في اسم واحد: "${u}"؟
سوف يتم تحديث جميع القيود المرتبطة فوراً.`))return;const d=i.innerHTML;i.innerHTML='<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span> جاري الدمج...',i.disabled=!0;try{await h.mergeJournals({companyId:ze,sourceNames:l,targetName:u}),y("✅ تم توحيد اليوميات بنجاح","success"),await Ne(e)}catch(g){console.error(g),y(g.message||"خطأ في عملية الدمج","error"),i.innerHTML=d,p()}})}const Z=e=>v(e,2);async function _a(e){const t=S.get("companies")||[],s=(S.get("filterOptions")||{}).fiscalYears||[],r=s[s.length-1]||new Date().getFullYear().toString();e.innerHTML=`
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
            ${t.map(c=>`<option value="${c.id}">${c.name}</option>`).join("")}
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
  `;const o=e.querySelector("#as-account"),n=e.querySelector("#as-account-list"),i=e.querySelector("#as-partner");let p=[];e.querySelector("#as-company").addEventListener("change",async c=>{const l=c.target.value;if(o.value="",n.innerHTML="",i.innerHTML='<option value="">الكل</option>',!!l)try{const[u,d]=await Promise.all([h.getAccountStatementAccounts({companyId:l}),h.getAccountStatementPartners({companyId:l})]);p=u,n.innerHTML=u.map(g=>`<option value="${g.account_code} — ${g.account_name}"></option>`).join(""),i.innerHTML='<option value="">الكل ('+d.length+")</option>"+d.map(g=>`<option value="${g}">${g}</option>`).join("")}catch{y("خطأ في تحميل البيانات","error")}}),e.querySelector("#as-load").addEventListener("click",()=>Sa(e)),e.querySelector("#as-print").addEventListener("click",()=>window.print()),e.querySelector("#as-export").addEventListener("click",()=>qa(e))}let Ve=null,Je=null;async function Sa(e){const t=e.querySelector("#as-company").value,s=e.querySelector("#as-account").value.split("—")[0].split(" — ")[0].trim(),r=e.querySelector("#as-from").value,o=e.querySelector("#as-to").value,n=e.querySelector("#as-partner").value,i=e.querySelector("#as-result");if(!t||!s){y("اختر شركة وحساب","warning");return}i.innerHTML='<div class="as-empty">⏳ جاري تحميل الكشف...</div>';try{const p=await h.getAccountStatement({companyId:t,accountCode:s,dateFrom:r,dateTo:o});Ve=p,za(e,p,r,o,n),e.querySelector("#as-print").style.display="",e.querySelector("#as-export").style.display=""}catch(p){i.innerHTML=`<div class="as-empty" style="color:#f87171">❌ ${p.message}</div>`}}function za(e,t,a,s,r){const o=e.querySelector("#as-result"),{company:n,account:i,openingBalance:p,items:c,closingBalance:l}=t;let u=c;r&&(u=c.filter(w=>w.partner_name===r));let d=p;u=u.map(w=>(d+=(w.debit||0)-(w.credit||0),{...w,runningBalance:d}));const g=u.reduce((w,m)=>w+(m.debit||0),0),f=u.reduce((w,m)=>w+(m.credit||0),0),b=p+g-f;Je={filtered:u,totalDebit:g,totalCredit:f,closingBalance:b};const x=w=>w>=0?"bal-pos":"bal-neg",z=w=>w>0?"مدين":w<0?"دائن":"متزن";o.innerHTML=`
    <div class="as-info">
      <div class="as-info-card">
        <div class="as-info-label">الشركة</div>
        <div class="as-info-value ar">${n.name}</div>
      </div>
      <div class="as-info-card">
        <div class="as-info-label">الحساب</div>
        <div class="as-info-value ar" style="font-size:0.9rem">${i.account_code} — ${i.account_name}</div>
      </div>
      <div class="as-info-card">
        <div class="as-info-label">الفترة</div>
        <div class="as-info-value">${a||"—"} → ${s||"—"}</div>
      </div>
      <div class="as-info-card">
        <div class="as-info-label">الحركات</div>
        <div class="as-info-value">${u.length}${r?` <span class="nature">من ${c.length}</span>`:""}</div>
      </div>
      <div class="as-info-card" style="border-color:rgba(139,92,246,0.3)">
        <div class="as-info-label">الرصيد النهائي</div>
        <div class="as-info-value ${x(b)}" style="font-size:1.15rem">${Z(Math.abs(b))} <span class="nature">${z(b)}</span></div>
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
            <td class="num ${x(p)}">${Z(Math.abs(p))} <small>${z(p)}</small></td>
          </tr>
          ${u.length===0?'<tr><td colspan="8" class="as-empty" style="padding:30px">لا توجد حركات</td></tr>':""}
          ${u.map((w,m)=>`
            <tr>
              <td style="color:#475569;font-size:0.78rem;text-align:center">${m+1}</td>
              <td style="white-space:nowrap;font-family:var(--font-en);color:#94a3b8;font-size:0.85rem">${w.date}</td>
              <td style="font-family:var(--font-en);font-size:0.82rem;color:#818cf8">${w.move_name||""}</td>
              <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis">${w.label||w.move_ref||"—"}</td>
              <td style="font-size:0.85rem;color:#94a3b8">${w.partner_name||""}</td>
              <td class="num ${w.debit?"debit-val":""}">${w.debit?Z(w.debit):""}</td>
              <td class="num ${w.credit?"credit-val":""}">${w.credit?Z(w.credit):""}</td>
              <td class="num ${x(w.runningBalance)}">${Z(Math.abs(w.runningBalance))}</td>
            </tr>
          `).join("")}
          <tr class="as-row-totals">
            <td></td>
            <td colspan="4" style="text-align:center">📊 إجمالي الحركات</td>
            <td class="num" style="font-size:0.95rem">${Z(g)}</td>
            <td class="num" style="font-size:0.95rem">${Z(f)}</td>
            <td class="num"></td>
          </tr>
          <tr class="as-row-closing">
            <td></td>
            <td colspan="4" style="text-align:center">📌 الرصيد الختامي</td>
            <td class="num"></td>
            <td class="num"></td>
            <td class="num ${x(b)}" style="font-size:1.05rem">${Z(Math.abs(b))} <small>${z(b)}</small></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="as-count">${u.length} rows · ${n.currency||"SAR"}</div>
  `}function qa(e){if(!Ve||!Je)return;const{company:t,account:a,openingBalance:s}=Ve,{filtered:r,totalDebit:o,totalCredit:n,closingBalance:i}=Je,p=e.querySelector("#as-from").value,c=e.querySelector("#as-to").value;let l="\uFEFF";l+=`كشف حساب — ${t.name}
`,l+=`الحساب: ${a.account_code} — ${a.account_name}
`,l+=`الفترة: ${p} إلى ${c}

`,l+=`#,التاريخ,رقم القيد,البيان,الطرف,مدين,دائن,الرصيد
`,l+=`,,,الرصيد الافتتاحي,,,,"${s}"
`,r.forEach((f,b)=>{const x=(f.label||f.move_ref||"").replace(/"/g,'""'),z=(f.partner_name||"").replace(/"/g,'""');l+=`${b+1},"${f.date}","${f.move_name||""}","${x}","${z}",${f.debit||0},${f.credit||0},${f.runningBalance}
`}),l+=`,,,,إجمالي الحركات,${o},${n},
`,l+=`,,,,الرصيد الختامي,,,"${i}"
`;const u=new Blob([l],{type:"text/csv;charset=utf-8;"}),d=URL.createObjectURL(u),g=document.createElement("a");g.href=d,g.download=`كشف_حساب_${a.account_code}_${p}_${c}.csv`,g.click(),URL.revokeObjectURL(d),y("✅ تم تصدير الكشف","success")}const nt="mizaniat_api_configs";async function La(e){var w;const t=`${window.location.origin}/api/external`;e.innerHTML=`
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
  `;function a(m,$,_,L){var O;const k=document.getElementById(m);if(!k)return{getValues:()=>[],setValues:()=>{},clear:()=>{}};const E=k.querySelector(".ms-toggle"),j=k.querySelector(".ms-list"),T=k.querySelector(".ms-search input"),I=new Set,q=((O=E.querySelector(".ms-placeholder"))==null?void 0:O.textContent)||"اختر...";function M(C=""){const B=C.toLowerCase();j.innerHTML=$.filter(J=>!B||String(J[L]).toLowerCase().includes(B)).map(J=>{const R=String(J[_]),U=I.has(R);return`<div class="ms-item ${U?"selected":""}" data-val="${R}"><div class="ms-check">${U?"✓":""}</div><span>${J[L]}</span></div>`}).join(""),j.querySelectorAll(".ms-item").forEach(J=>{J.onclick=R=>{R.stopPropagation();const U=J.dataset.val;I.has(U)?I.delete(U):I.add(U),M(T.value),H()}})}function H(){if(I.size===0){E.innerHTML=`<span class="ms-placeholder">${q}</span>`;return}E.innerHTML=Array.from(I).map(C=>{const B=$.find(R=>String(R[_])===C);return`<span class="ms-tag">${B?B[L].length>20?B[L].substring(0,20)+"…":B[L]:C} <span class="ms-x" data-val="${C}">✕</span></span>`}).join(""),E.querySelectorAll(".ms-x").forEach(C=>{C.onclick=B=>{B.stopPropagation(),I.delete(C.dataset.val),M(T.value),H()}})}return E.onclick=C=>{C.stopPropagation(),k.classList.toggle("open"),k.classList.contains("open")&&T.focus()},T.onclick=C=>C.stopPropagation(),T.oninput=()=>M(T.value),document.addEventListener("click",()=>k.classList.remove("open")),M(),H(),{getValues:()=>Array.from(I),setValues:C=>{I.clear(),C.forEach(B=>I.add(String(B))),M(),H()},clear:()=>{I.clear(),M(),H()}}}function s(m,$,_,L,k){const E="ms-"+Math.random().toString(36).slice(2,8);return m.innerHTML=`<div class="multi-select" id="${E}"><div class="ms-toggle"><span class="ms-placeholder">${k}</span></div><div class="ms-dropdown"><div class="ms-search"><input placeholder="بحث..." /></div><div class="ms-list"></div></div></div>`,a(E,$,_,L)}let r=[],o=[],n=[],i;try{const[m,$,_]=await Promise.all([fetch("/api/external/companies").then(k=>k.json()),fetch("/api/external/groups").then(k=>k.json()),fetch("/api/external/cost-centers").then(k=>k.json())]);r=m.data||[],o=$.data||[];const L=new Set;n=(_.data||[]).filter(k=>L.has(k.name)?!1:(L.add(k.name),!0)),i=a("ms-companies",r,"id","name")}catch(m){console.error("Failed to load dropdown data:",m)}let p=0;const c=[];function l(m){const $=p++,_=document.createElement("div");_.className="period-row",_.id=`period-${$}`,_.innerHTML=`
      <span class="period-num">${c.length+1}</span>
      <button class="period-del" data-idx="${$}">✕</button>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;padding-right:36px;">
        <div><label class="api-label">تاريخ البداية (تلقائي: كل الفترات)</label><input type="date" class="api-input period-from" value="${(m==null?void 0:m.dateFrom)||""}" /></div>
        <div><label class="api-label">تاريخ النهاية (تلقائي: اليوم)</label><input type="date" class="api-input period-to" value="${(m==null?void 0:m.dateTo)||""}" /></div>
        <div><label class="api-label">المجموعات</label><div class="period-groups"></div></div>
      </div>
      <div style="padding-right:36px;margin-top:10px;"><label class="api-label">مراكز التكلفة</label><div class="period-cc"></div></div>
    `,document.getElementById("periods-container").appendChild(_);const L=s(_.querySelector(".period-groups"),o,"id","name","اختر المجموعات..."),k=s(_.querySelector(".period-cc"),n,"name","name","اختر مراكز التكلفة...");m!=null&&m.groupIds&&L.setValues(m.groupIds.map(String)),m!=null&&m.costCenters&&k.setValues(m.costCenters);const E={idx:$,div:_,msG:L,msCC:k};return c.push(E),_.querySelector(".period-del").onclick=()=>{_.remove();const j=c.findIndex(T=>T.idx===$);j>=0&&c.splice(j,1),u()},E}function u(){c.forEach((m,$)=>{m.div.querySelector(".period-num").textContent=$+1})}function d(){c.forEach(m=>m.div.remove()),c.length=0,p=0}l(),document.getElementById("btn-add-period").onclick=()=>l();function g(){const m=((i==null?void 0:i.getValues())||[]).map(Number),$=document.getElementById("test-monthly").checked,_=c.map(L=>{const k={};k.dateFrom=L.div.querySelector(".period-from").value;const E=L.div.querySelector(".period-to").value;E&&(k.dateTo=E);const j=L.msG.getValues().map(Number);j.length&&(k.groupIds=j);const T=L.msCC.getValues();return T.length&&(k.costCenters=T),k}).filter(L=>L.dateFrom||L.dateTo||L.groupIds||L.costCenters||c.length===1);return{companyIds:m,monthly:$,periods:_}}function f(m){var $;d(),m.companyIds&&(i==null||i.setValues(m.companyIds.map(String))),document.getElementById("test-monthly").checked=m.monthly!==!1,(m.periods||[]).forEach(_=>l(_)),($=m.periods)!=null&&$.length||l()}function b(){try{return JSON.parse(localStorage.getItem(nt)||"[]")}catch{return[]}}function x(m){localStorage.setItem(nt,JSON.stringify(m))}function z(){const m=b(),$=document.getElementById("saved-configs-card"),_=document.getElementById("saved-configs-list");if(m.length===0){$.style.display="none";return}$.style.display="",_.innerHTML=m.map((L,k)=>`
      <div class="saved-chip" data-idx="${k}">
        <span>📁 ${L.name}</span>
        <span class="chip-del" data-idx="${k}" title="حذف">✕</span>
      </div>
    `).join(""),_.querySelectorAll(".saved-chip").forEach(L=>{L.onclick=k=>{if(k.target.classList.contains("chip-del")){const T=Number(k.target.dataset.idx),I=b();I.splice(T,1),x(I),z();return}const E=Number(L.dataset.idx),j=b()[E];j&&f(j.config)}})}document.getElementById("btn-save-config").onclick=()=>{const m=prompt("اسم الإعدادات:");if(!m)return;const $=b();$.push({name:m,config:g(),savedAt:new Date().toISOString()}),x($),z()},z(),document.getElementById("btn-update-fetch").onclick=()=>{c.forEach(m=>{m.div.querySelector(".period-to").value=""}),document.getElementById("btn-test").click()},(w=document.getElementById("btn-copy-base"))==null||w.addEventListener("click",()=>{navigator.clipboard.writeText(t)}),document.getElementById("btn-test").onclick=async()=>{var E,j;const m=document.getElementById("test-status"),$=document.getElementById("test-result"),_=document.getElementById("json-output-box"),L=document.getElementById("get-link-box");m.textContent="⏳ جاري الجلب...",m.style.color="#f59e0b",$.style.display="none",_.style.display="none",L.style.display="none";const k=g();if(!k.companyIds.length){m.textContent="❌ اختر شركة واحدة على الأقل",m.style.color="#ef4444";return}if(!k.periods.length){m.textContent="❌ أضف فترة واحدة على الأقل بالضغط على إضافة فترة",m.style.color="#ef4444";return}try{const T=performance.now(),I=await fetch("/api/external/expenses",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(k)}),q=Math.round(performance.now()-T),M=await I.json();if(!I.ok){m.textContent=`❌ ${I.status}: ${M.error||"Error"}`,m.style.color="#ef4444";return}m.textContent=`✅ OK — ${q}ms — ${((E=M.summary)==null?void 0:E.totalRows)||0} سطر`,m.style.color="#10b981";const H=btoa(unescape(encodeURIComponent(JSON.stringify(k)))),O=`${t}/expenses/query?config=${encodeURIComponent(H)}`;document.getElementById("get-link-url").textContent=O,L.style.display="",document.getElementById("btn-copy-link").onclick=()=>{navigator.clipboard.writeText(O);const N=document.getElementById("btn-copy-link");N.textContent="✅ تم!",setTimeout(()=>N.textContent="📋 نسخ الرابط",2e3)};const C=JSON.stringify(M.data,null,2);document.getElementById("data-json-output").textContent=C,document.getElementById("json-rows-count").textContent=`${((j=M.data)==null?void 0:j.length)||0} سطر — ${(C.length/1024).toFixed(1)} KB`,_.style.display="",document.getElementById("btn-copy-data-json").onclick=()=>{navigator.clipboard.writeText(C);const N=document.getElementById("btn-copy-data-json");N.textContent="✅ تم النسخ!",setTimeout(()=>N.textContent="📋 نسخ JSON",2e3)};const B=document.getElementById("result-summary"),J=M.summary||{};B.innerHTML=Object.entries(J).map(([N,de])=>`
        <div style="background:rgba(16,185,129,0.06);border-radius:8px;padding:12px 16px;text-align:center;">
          <div style="color:var(--text-muted);font-size:0.78rem;">${N}</div>
          <div style="color:#10b981;font-size:1.15rem;font-weight:700;font-family:var(--font-en);">${typeof de=="number"?de.toLocaleString("en"):de}</div>
        </div>
      `).join("");const R=M.data||[],U=document.getElementById("result-table");if(R.length>0){const N=Object.keys(R[0]),de=N.map(qe=>`<th style="white-space:nowrap;font-size:0.82rem;">${qe}</th>`).join(""),_t=R.slice(0,300).map(qe=>`<tr>${N.map(St=>{const Le=qe[St],Ee=typeof Le=="number";return`<td class="${Ee?"n":""}" style="font-size:0.85rem;${Ee?"font-family:var(--font-en);":""}">${Ee?Le.toLocaleString("en-US"):Le??"-"}</td>`}).join("")}</tr>`).join("");U.innerHTML=`<thead><tr>${de}</tr></thead><tbody>${_t}</tbody>`,R.length>300&&(U.innerHTML+=`<tfoot><tr><td colspan="${N.length}" style="text-align:center;color:var(--text-muted);">عرض أول 300 من ${R.length}</td></tr></tfoot>`)}else U.innerHTML='<tr><td style="text-align:center;color:var(--text-muted);padding:20px;">لا توجد بيانات</td></tr>';$.style.display=""}catch(T){m.textContent=`❌ ${T.message}`,m.style.color="#ef4444"}}}let ue={};async function Ea(e){e.innerHTML=`
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
  `;const t=e.querySelector("#btn-test-conn"),a=e.querySelector("#btn-save-conn");t.addEventListener("click",async()=>{let i=e.querySelector("#conn-url").value.trim();const p=e.querySelector("#conn-user").value.trim(),c=e.querySelector("#conn-pass").value.trim(),l=e.querySelector("#conn-result");if(!i||!p||!c){l.innerHTML='<div style="padding:12px;border-radius:8px;background:rgba(239,68,68,0.15);color:var(--accent-red);font-size:0.85rem;">⚠️ يرجى تعبئة جميع الحقول</div>';return}!i.startsWith("http://")&&!i.startsWith("https://")&&(i="https://"+i,e.querySelector("#conn-url").value=i),t.disabled=!0,t.textContent="جاري الاختبار...",l.innerHTML='<div style="padding:12px;color:var(--text-muted);font-size:0.85rem;">⏳ جاري اختبار الاتصال...</div>';try{const u=await h.sales.testConnectionDirect({url:i,username:p,password:c,company_id:1});u.success?(l.innerHTML=`
          <div style="padding:12px;border-radius:8px;background:rgba(16,185,129,0.15);color:var(--accent-emerald);font-size:0.85rem;">
            ✅ الاتصال ناجح! ${u.message||""}
          </div>
        `,a.disabled=!1):(l.innerHTML=`
          <div style="padding:12px;border-radius:8px;background:rgba(239,68,68,0.15);color:var(--accent-red);font-size:0.85rem;">
            ❌ فشل الاتصال: ${u.message}
          </div>
        `,a.disabled=!0)}catch(u){l.innerHTML=`
        <div style="padding:12px;border-radius:8px;background:rgba(239,68,68,0.15);color:var(--accent-red);font-size:0.85rem;">
          ❌ خطأ: ${u.message}
        </div>
      `}t.disabled=!1,t.textContent="🔌 اختبار الاتصال"}),a.addEventListener("click",async()=>{let i=e.querySelector("#conn-url").value.trim();i&&!i.startsWith("http://")&&!i.startsWith("https://")&&(i="https://"+i);const p=e.querySelector("#conn-user").value.trim(),c=e.querySelector("#conn-pass").value.trim();a.disabled=!0,a.textContent="جاري الحفظ...";try{let l=i;try{l=new URL(i).hostname}catch{l=i.replace(/https?:\/\//,"").split("/")[0]}await h.sales.createInstance({name:"المبيعات - "+l,url:i,username:p,api_key:c}),y("تم حفظ الاتصال بنجاح ✅ — اربط الشركات به من قسم الشركات","success"),e.querySelector("#conn-url").value="",e.querySelector("#conn-user").value="",e.querySelector("#conn-pass").value="",e.querySelector("#conn-result").innerHTML="",a.disabled=!0,await se(e)}catch(l){y("خطأ في الحفظ: "+l.message,"error")}a.disabled=!1,a.textContent="💾 حفظ الاتصال"}),e.querySelector("#btn-add-company").addEventListener("click",()=>Pa(e)),e.querySelector("#btn-add-rule").addEventListener("click",()=>Ra(e)),e.querySelector("#btn-sync-all").addEventListener("click",async()=>{try{await h.sales.syncAll(),y("بدأت مزامنة جميع الشركات","info"),Ca(e)}catch(i){y("خطأ: "+i.message,"error")}});const s=e.querySelector("#sync-enabled"),r=e.querySelector("#sync-toggle-track"),o=e.querySelector("#sync-toggle-dot");function n(i){i?(r.style.background="#06b6d4",o.style.right="2px"):(r.style.background="rgba(255,255,255,0.1)",o.style.right="22px")}s.addEventListener("change",()=>{n(s.checked)}),e.querySelector("#btn-save-schedule").addEventListener("click",async()=>{const i=e.querySelector("#btn-save-schedule");i.disabled=!0,i.textContent="⏳ جاري الحفظ...";try{const p=await h.sales.updateSchedule({enabled:s.checked,intervalHours:parseInt(e.querySelector("#sync-interval").value)});y(p.running?`تم تفعيل المزامنة التلقائية — ${p.schedule}`:"تم إيقاف المزامنة التلقائية","success"),xt(e,p)}catch(p){y("خطأ: "+p.message,"error")}i.disabled=!1,i.textContent="💾 حفظ الإعدادات"}),e.querySelector("#btn-clear-notifs").addEventListener("click",async()=>{try{await h.sales.clearNotifications(),e.querySelector("#sync-notifications-list").innerHTML='<div style="text-align:center;color:var(--text-muted);padding:12px;font-size:0.8rem;">لا توجد إشعارات</div>',y("تم مسح الإشعارات","info")}catch(i){y("خطأ: "+i.message,"error")}}),await se(e)}function xt(e,t){const a=e.querySelector("#schedule-status");a&&(t.running?a.innerHTML=`<span style="color:#10b981;">● نشطة</span> — <span style="font-family:var(--font-en);font-size:0.72rem;">${t.schedule}</span>`:a.innerHTML='<span style="color:var(--text-muted);">○ متوقفة</span>')}function Ia(e,t){if(!e)return;if(!t||t.length===0){e.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:12px;font-size:0.8rem;">لا توجد إشعارات</div>';return}const a={success:"background:rgba(16,185,129,0.12);color:#10b981;border-color:rgba(16,185,129,0.2)",warning:"background:rgba(245,158,11,0.12);color:#f59e0b;border-color:rgba(245,158,11,0.2)",error:"background:rgba(239,68,68,0.12);color:#ef4444;border-color:rgba(239,68,68,0.2)"},s={success:"✅",warning:"⚠️",error:"❌"};e.innerHTML=`<div style="display:grid;gap:6px;">
    ${t.map(r=>{const o=a[r.type]||a.success,n=s[r.type]||"✅",i=r.created_at?new Date(r.created_at+"Z").toLocaleString("ar-SA",{hour:"2-digit",minute:"2-digit",day:"numeric",month:"short"}):"";return`<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-radius:8px;border:1px solid;${o};font-size:0.8rem;">
        <span>${n} ${r.message}</span>
        <span style="font-family:var(--font-en);font-size:0.7rem;opacity:0.7;">${i}</span>
      </div>`}).join("")}
  </div>`}async function se(e){try{const[t,a,s,r,o,n]=await Promise.all([h.sales.getInstances().catch(()=>[]),h.sales.getCompanies().catch(()=>[]),h.sales.getEliminationRules().catch(()=>[]),h.sales.getSyncStatus().catch(()=>[]),h.sales.getSchedule().catch(()=>({enabled:!1,intervalHours:2,running:!1})),h.sales.getNotifications().catch(()=>[])]);S.set("sales_companies",a||[]),ja(e.querySelector("#instances-list"),t,e),Ta(e.querySelector("#companies-list"),a,t,e),Ma(e.querySelector("#import-panel"),a),Ha(e.querySelector("#rules-list"),s),Ba(e.querySelector("#sync-log"),r);const i=e.querySelector("#sync-enabled");if(i){i.checked=o.enabled;const c=e.querySelector("#sync-toggle-track"),l=e.querySelector("#sync-toggle-dot");o.enabled?(c.style.background="#06b6d4",l.style.right="2px"):(c.style.background="rgba(255,255,255,0.1)",l.style.right="22px")}const p=e.querySelector("#sync-interval");p&&(p.value=String(o.intervalHours)),xt(e,o),Ia(e.querySelector("#sync-notifications-list"),n)}catch{y("خطأ في تحميل الإعدادات","error")}}function ja(e,t,a){if(t.length===0){e.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:15px;font-size:0.85rem;">لا توجد اتصالات محفوظة — أضف اتصال من الخطوة 1</div>';return}e.innerHTML=`
    <div style="display:grid;gap:var(--space-sm);">
      ${t.map(s=>`
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
  `,e.querySelectorAll(".btn-delete-instance").forEach(s=>{s.addEventListener("click",async()=>{const r=s.dataset.id;if(confirm("هل تريد حذف هذا الاتصال؟"))try{await h.sales.deleteInstance(r),y("تم حذف الاتصال","success"),await se(a)}catch(o){y("خطأ: "+o.message,"error")}})})}function Ta(e,t,a,s){if(t.length===0){e.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:0.85rem;">لا توجد شركات — أضف شركة جديدة</div>';return}const r={};for(const o of a)r[o.id]=o;e.innerHTML=`
    <div class="data-table-wrapper">
      <table class="data-table">
        <thead><tr><th>اسم الشركة</th><th>الخادم المربوط</th><th>Sales ID</th><th>عدد الفواتير</th><th>آخر فاتورة</th><th>الحالة</th><th>إجراء</th></tr></thead>
        <tbody>
          ${t.map(o=>{const n=r[o.sales_instance_id],i=a.map(p=>`<option value="${p.id}" ${p.id===o.sales_instance_id?"selected":""}>${p.name}</option>`).join("");return`
            <tr>
              <td>
                <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${o.color||"#3b82f6"};margin-left:8px;"></span>
                ${o.name}
              </td>
              <td>
                <select class="filter-select company-instance-select" data-company-id="${o.id}" style="font-size:0.78rem;padding:4px 8px;min-width:180px;">
                  ${i}
                </select>
                ${n?`<div style="font-family:var(--font-en);font-size:0.68rem;color:var(--text-muted);margin-top:2px;">${n.url} — ${n.username}</div>`:""}
              </td>
              <td style="font-family:var(--font-en);">${o.sales_company_id}</td>
              <td style="font-family:var(--font-en);font-weight:600;">${v(o.item_count||0)}</td>
              <td style="font-family:var(--font-en);font-size:0.8em;">${o.last_entry_date||"--"}</td>
              <td><span class="badge ${o.is_active?"badge-success":"badge-danger"}">${o.is_active?"نشط":"معطل"}</span></td>
              <td>
                <button class="btn btn-sm btn-delete-company" data-id="${o.id}" style="background:rgba(239,68,68,0.1);color:var(--accent-red);border:1px solid rgba(239,68,68,0.2);font-size:0.75rem;padding:3px 8px;">🗑️</button>
              </td>
            </tr>
          `}).join("")}
        </tbody>
      </table>
    </div>
  `,e.querySelectorAll(".company-instance-select").forEach(o=>{o.addEventListener("change",async()=>{const n=o.dataset.companyId,i=parseInt(o.value);try{await h.sales.updateCompany(n,{sales_instance_id:i}),y("تم تحديث الخادم المربوط ✅","success"),await se(s)}catch(p){y("خطأ: "+p.message,"error")}})}),e.querySelectorAll(".btn-delete-company").forEach(o=>{o.addEventListener("click",async()=>{const n=o.dataset.id;if(confirm("هل أنت متأكد من حذف هذه الشركة وحذف جميع بيانات الفواتير المرتبطة بها نهائياً؟"))try{await h.sales.deleteCompany(n),y("تم حذف الشركة بنجاح","success"),await se(s)}catch(i){y("خطأ: "+i.message,"error")}})})}function Ma(e,t){if(t.length===0){e.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:0.85rem;">أضف شركات أولاً ثم ابدأ الاستيراد</div>';return}e.innerHTML=t.map(a=>`
    <div class="card" style="margin-bottom:var(--space-md);border:1px solid rgba(255,255,255,0.05);padding:var(--space-md);" id="import-card-${a.id}">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${a.color||"#3b82f6"};margin-left:8px;"></span>
          <strong>${a.name}</strong>
          <span style="font-family:var(--font-en);color:var(--text-muted);font-size:0.8em;margin-right:8px;">(Company ID: ${a.sales_company_id})</span>
          <span style="font-family:var(--font-en);color:var(--text-muted);font-size:0.8em;">— ${v(a.item_count||0)} فاتورة</span>
        </div>
        <button class="btn btn-primary btn-sm btn-import" data-company-id="${a.id}">📥 استيراد</button>
      </div>
      <div class="import-progress" id="progress-${a.id}" style="margin-top:var(--space-sm);display:none;">
        <div style="display:flex;justify-content:space-between;font-size:0.78rem;color:var(--text-secondary);margin-bottom:4px;">
          <span id="progress-text-${a.id}">جاري التحضير...</span>
          <span id="progress-pct-${a.id}">0%</span>
        </div>
        <div style="height:6px;background:rgba(10,15,40,0.5);border-radius:3px;overflow:hidden;">
          <div id="progress-bar-${a.id}" style="height:100%;width:0%;background:linear-gradient(90deg,var(--accent-blue),var(--accent-emerald));border-radius:3px;transition:width 0.5s ease;"></div>
        </div>
      </div>
    </div>
  `).join(""),e.querySelectorAll(".btn-import").forEach(a=>{a.addEventListener("click",async()=>{const s=parseInt(a.dataset.companyId);a.disabled=!0,a.textContent="⏳ جاري...";try{await h.sales.syncCompany(s),y("بدأت عملية الاستيراد","info"),$t(s)}catch(r){y("خطأ: "+r.message,"error"),a.disabled=!1,a.textContent="📥 استيراد"}})})}function $t(e){const t=document.getElementById(`progress-${e}`);t&&(t.style.display="block"),ue[e]&&clearInterval(ue[e]),ue[e]=setInterval(async()=>{try{const a=await h.sales.getSyncProgress(e);if(Aa(e,a),a.status==="completed"||a.status==="failed"){clearInterval(ue[e]),delete ue[e];const s=document.querySelector(`[data-company-id="${e}"]`);if(s&&(s.disabled=!1,s.textContent=a.status==="completed"?"✅ تم":"📥 إعادة الاستيراد"),a.status==="completed"){y(`تم استيراد ${v(a.inserted)} فاتورة بنجاح ✅`,"success");const r=await h.sales.getCompanies();S.set("sales_companies",r)}else y(`فشل الاستيراد: ${a.phase}`,"error")}}catch(a){console.error("Progress poll error:",a)}},1500)}async function Ca(e){let t=S.get("sales_companies");(!t||!Array.isArray(t))&&(t=await h.sales.getCompanies(),S.set("sales_companies",t));for(const a of t||[])$t(a.id)}function Aa(e,t){const a=document.getElementById(`progress-text-${e}`),s=document.getElementById(`progress-pct-${e}`),r=document.getElementById(`progress-bar-${e}`),o=document.getElementById(`progress-${e}`);if(!(!a||!s||!r)){if(o.style.display="block",a.textContent=t.phase||"",t.total>0){const n=Math.round(t.inserted/t.total*100);s.textContent=`${n}%`,r.style.width=`${n}%`}t.status==="completed"?(r.style.background="var(--accent-emerald)",r.style.width="100%",s.textContent="100%"):t.status==="failed"&&(r.style.background="var(--accent-red)")}}function Ha(e,t){if(t.length===0){e.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:15px;font-size:0.85rem;">لا توجد قواعد استبعاد</div>';return}e.innerHTML=`
    <div class="data-table-wrapper">
      <table class="data-table">
        <thead><tr><th>القاعدة</th><th>الشركة المصدر</th><th>الشركة الهدف</th><th>حساب المصدر</th><th>حساب الهدف</th></tr></thead>
        <tbody>
          ${t.map(a=>`
            <tr>
              <td>${a.name}</td>
              <td>${a.source_company_name||"--"}</td>
              <td>${a.target_company_name||"--"}</td>
              <td style="font-family:var(--font-en);">${a.source_account_code||"--"}</td>
              <td style="font-family:var(--font-en);">${a.target_account_code||"--"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `}function Ba(e,t){if(t.length===0){e.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:15px;font-size:0.85rem;">لا يوجد سجل مزامنة بعد</div>';return}e.innerHTML=`
    <div class="data-table-wrapper">
      <table class="data-table">
        <thead><tr><th>الشركة</th><th>الحالة</th><th>الفواتير المستوردة</th><th>البداية</th><th>النهاية</th><th>الخطأ</th></tr></thead>
        <tbody>
          ${t.slice(0,20).map(a=>`
            <tr>
              <td>${a.company_name||"--"}</td>
              <td>
                <span class="badge badge-${a.status==="completed"?"success":a.status==="failed"?"danger":"warning"}">
                  ${a.status==="completed"?"✅ مكتمل":a.status==="failed"?"❌ فشل":"⏳ جاري"}
                </span>
              </td>
              <td style="font-family:var(--font-en);">${v(a.records_synced||0)}</td>
              <td style="font-family:var(--font-en);font-size:0.72em;">${a.started_at||""}</td>
              <td style="font-family:var(--font-en);font-size:0.72em;">${a.completed_at||""}</td>
              <td style="font-size:0.72em;color:var(--accent-red);max-width:200px;overflow:hidden;text-overflow:ellipsis;">${a.error_message||""}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `}function Pa(e){ve("إضافة شركة جديدة",`
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
  `),h.sales.getInstances().then(t=>{const a=document.getElementById("comp-instance");t.length===0?a.innerHTML="<option disabled>⚠️ أضف اتصال المبيعات أولاً</option>":a.innerHTML=t.map(s=>`<option value="${s.id}">${s.name} (${s.url})</option>`).join("")}),document.getElementById("btn-save-company").addEventListener("click",async()=>{const t=document.getElementById("comp-name").value,a=parseInt(document.getElementById("comp-sales-id").value),s=parseInt(document.getElementById("comp-instance").value);if(!t||!a){y("يرجى تعبئة الاسم ومعرف الشركة","warning");return}try{await h.sales.createCompany({name:t,sales_company_id:a,sales_instance_id:s,currency:document.getElementById("comp-currency").value||"SAR",color:document.getElementById("comp-color").value}),fe(),y("تم إضافة الشركة بنجاح ✅","success");const r=await h.sales.getCompanies();S.set("sales_companies",r),await se(e)}catch(r){y("خطأ: "+r.message,"error")}})}function Ra(e){const t=S.get("sales_companies");ve("إضافة قاعدة استبعاد",`
    <div class="form-group">
      <label class="form-label">اسم القاعدة</label>
      <input type="text" class="form-input" id="rule-name" dir="rtl" placeholder="مثل: استبعاد إيرادات المقاولات بين الشركات" />
    </div>
    <div class="form-group">
      <label class="form-label">الشركة المصدر</label>
      <select class="filter-select" id="rule-source" style="width:100%;">
        ${t.map(a=>`<option value="${a.id}">${a.name}</option>`).join("")}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">الشركة الهدف</label>
      <select class="filter-select" id="rule-target" style="width:100%;">
        ${t.map(a=>`<option value="${a.id}">${a.name}</option>`).join("")}
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
  `),document.getElementById("btn-save-rule").addEventListener("click",async()=>{try{await h.sales.createEliminationRule({name:document.getElementById("rule-name").value,source_company_id:parseInt(document.getElementById("rule-source").value),target_company_id:parseInt(document.getElementById("rule-target").value),source_account_code:document.getElementById("rule-src-acc").value,target_account_code:document.getElementById("rule-tgt-acc").value}),fe(),y("تم إضافة القاعدة بنجاح ✅","success"),await se(e)}catch(a){y("خطأ: "+a.message,"error")}})}let P=0;const _e=50;let Ue=[],ne="date",ge="DESC";const We=[{key:"company_name",label:"الشركة",type:"text",default:!0},{key:"date",label:"التاريخ",type:"date",default:!0},{key:"name",label:"رقم الفاتورة",type:"code",default:!0},{key:"partner_name",label:"العميل",type:"text",default:!0},{key:"state",label:"الحالة",type:"badge",default:!0},{key:"amount_total",label:"المبلغ الإجمالي",type:"money",default:!0},{key:"journal_name",label:"اسم اليومية",type:"text",default:!1,isRaw:!0},{key:"payment_status",label:"حالة الدفع",type:"badge",default:!1,isRaw:!0},{key:"move_type",label:"نوع الحركة",type:"text",default:!1,isRaw:!0},{key:"amount_untaxed",label:"المبلغ (قبل الضريبة)",type:"money",default:!1,isRaw:!0},{key:"amount_tax_signed",label:"الضريبة",type:"money",default:!1,isRaw:!0},{key:"total_paid",label:"إجمالي المدفوع",type:"money",default:!1,isRaw:!0},{key:"amount_residual",label:"المبلغ المتبقي",type:"residual",default:!1},{key:"reference",label:"المرجع",type:"text",default:!1,isRaw:!0},{key:"created_at",label:"تاريخ المزامنة",type:"date",default:!0},{key:"raw_data",label:"البيانات الخام",type:"actions",default:!0}];let V=[];try{const e=localStorage.getItem("sales_preview_cols");e&&(V=JSON.parse(e))}catch{}(!V||V.length===0)&&(V=We.filter(e=>e.default).map(e=>e.key));async function Da(e){let t=S.get("sales_companies");if(!t||t.length===0)try{t=await h.sales.getCompanies(),S.set("sales_companies",t)}catch{t=[]}e.innerHTML=`
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
            ${t.map(o=>`<option value="${o.id}">${o.name}</option>`).join("")}
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
           ${We.map(o=>`
             <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer;font-size:0.8rem;color:var(--text-primary);">
               <input type="checkbox" class="col-toggle" value="${o.key}" ${V.includes(o.key)?"checked":""}>
               ${o.label}
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
  `,e.querySelector("#dp-apply").addEventListener("click",()=>{P=0,te(e)}),e.querySelector("#dp-reset").addEventListener("click",()=>{e.querySelector("#dp-search").value="",e.querySelector("#dp-company").value="",e.querySelector("#dp-state").value="",e.querySelector("#dp-datefrom").value="",e.querySelector("#dp-dateto").value="",P=0,te(e)}),e.querySelector("#dp-prev").addEventListener("click",()=>{P>0&&(P--,te(e))}),e.querySelector("#dp-next").addEventListener("click",()=>{P++,te(e)}),e.querySelector("#dp-search").addEventListener("keydown",o=>{o.key==="Enter"&&(P=0,te(e))});const a=e.querySelector("#btn-col-chooser"),s=e.querySelector("#col-chooser-dropdown");a.addEventListener("click",o=>{o.stopPropagation(),s.style.display=s.style.display==="none"?"block":"none"}),document.addEventListener("click",o=>{e.querySelector("#col-chooser-container").contains(o.target)||(s.style.display="none")});const r=e.querySelectorAll(".col-toggle");r.forEach(o=>{o.addEventListener("change",()=>{V=Array.from(r).filter(n=>n.checked).map(n=>n.value),V.length===0&&(V=["name","company_name"],r.forEach(n=>{V.includes(n.value)&&(n.checked=!0)})),localStorage.setItem("sales_preview_cols",JSON.stringify(V)),wt(e.querySelector("#dp-table-wrapper"),Ue)})}),P=0,await te(e)}async function te(e){const t=e.querySelector("#dp-search").value.trim(),a=e.querySelector("#dp-company").value,s=e.querySelector("#dp-state").value,r=e.querySelector("#dp-datefrom").value,o=e.querySelector("#dp-dateto").value,n={limit:_e,offset:P*_e,orderBy:ne,orderDir:ge};t&&(n.search=t),a&&(n.companyIds=a),s&&(n.state=s),r&&(n.dateFrom=r),o&&(n.dateTo=o);try{const i=await h.sales.getInvoices(n);if(i.states&&i.states.length>0){const u=e.querySelector("#dp-state"),d=u.value;u.options.length<=1&&(i.states.forEach(g=>{const f=document.createElement("option");f.value=g,f.textContent=g,u.appendChild(f)}),d&&(u.value=d))}const p=i.totals||{amount_total:0,amount_untaxed:0,total_paid:0},c=p.total_paid-p.amount_total;e.querySelector("#dp-summary-cards").innerHTML=`
      <div class="card" style="padding:var(--space-md);display:flex;align-items:center;gap:16px;">
        <div style="background:rgba(59,130,246,0.1);color:var(--accent-blue);width:45px;height:45px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;">🧾</div>
        <div>
          <div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:4px;">إجمالي الفواتير</div>
          <div style="font-weight:700;font-size:1.25rem;font-family:var(--font-en);color:var(--text-primary);">${v(i.total)}</div>
        </div>
      </div>
      <div class="card" style="padding:var(--space-md);display:flex;align-items:center;gap:16px;">
        <div style="background:rgba(16,185,129,0.1);color:var(--accent-green);width:45px;height:45px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;">💰</div>
        <div>
          <div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:4px;">إجمالي المبالغ</div>
          <div style="font-weight:700;font-size:1.25rem;font-family:var(--font-en);color:var(--text-primary);">${v(p.amount_total,2)} ر.س</div>
        </div>
      </div>
      <div class="card" style="padding:var(--space-md);display:flex;align-items:center;gap:16px;">
        <div style="background:rgba(139,92,246,0.1);color:#8b5cf6;width:45px;height:45px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;">💸</div>
        <div>
          <div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:4px;">إجمالي المدفوع</div>
          <div style="font-weight:700;font-size:1.25rem;font-family:var(--font-en);color:var(--text-primary);">${v(p.total_paid,2)} ر.س</div>
        </div>
      </div>
      <div class="card" style="padding:var(--space-md);display:flex;align-items:center;gap:16px;">
        <div style="background:rgba(245,158,11,0.1);color:var(--accent-orange);width:45px;height:45px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.4rem;">⏳</div>
        <div>
          <div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:4px;">المتبقي</div>
          <div style="font-weight:700;font-size:1.25rem;font-family:var(--font-en);color:var(--text-primary);">${v(c,2)} ر.س</div>
        </div>
      </div>
    `;const l=Math.ceil(i.total/_e);e.querySelector("#dp-prev").disabled=P===0,e.querySelector("#dp-next").disabled=P+1>=l,e.querySelector("#dp-page-info").textContent=`صفحة ${P+1} من ${l||1}`,Ue=i.items,wt(e.querySelector("#dp-table-wrapper"),Ue)}catch(i){e.querySelector("#dp-table-wrapper").innerHTML=`<div style="padding:20px;color:var(--accent-red);">خطأ: ${i.message}</div>`,e.querySelector("#dp-summary-cards").innerHTML='<div style="text-align:center;padding:20px;color:var(--accent-red);">فشل تحميل ملخص البيانات</div>'}}function wt(e,t){if(!t||t.length===0){e.innerHTML='<div style="text-align:center;padding:40px;color:var(--text-muted);">لا توجد بيانات</div>';return}const a=We.filter(r=>V.includes(r.key));e.innerHTML=`
    <table class="data-table" style="font-size:0.78rem;width:100%;">
      <thead>
        <tr>
          <th style="position:sticky;top:0;z-index:2;font-size:0.7rem;white-space:nowrap;width:30px;">#</th>
          ${a.map(r=>{const o=r.key!=="actions"&&r.key!=="raw_data";let n='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 15l5 5 5-5M7 9l5-5 5 5"/></svg>';return ne===r.key&&(n=ge==="ASC"?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 15l7-7 7 7"/></svg>':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 9l-7 7-7-7"/></svg>'),`
               <th style="position:sticky;top:0;z-index:2;font-size:0.75rem;white-space:nowrap;cursor:${o?"pointer":"default"};background:var(--surface-color);"
                   ${o?`class="sort-header hover-bg" data-key="${r.key}"`:""}>
                 <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 4px;">
                   <span>${r.label}</span>
                   ${o?`<span class="sort-icon" style="color:${ne===r.key?"var(--accent-blue)":"var(--text-muted)"}; opacity:${ne===r.key?"1":"0.4"}; display:flex; align-items:center;">${n}</span>`:""}
                 </div>
               </th>
             `}).join("")}
        </tr>
      </thead>
      <tbody>
        ${t.map((r,o)=>`
          <tr>
            <td style="font-family:var(--font-en);color:var(--text-muted);font-size:0.7rem;">${P*_e+o+1}</td>
            ${a.map(n=>Fa(r,n,o)).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `,e.querySelectorAll(".btn-view-raw").forEach(r=>{r.addEventListener("click",o=>{const n=o.currentTarget.getAttribute("data-idx"),i=t[n];alert(`البيانات الخام للفاتورة:

`+(i.raw_data?JSON.stringify(JSON.parse(i.raw_data),null,2):"لا توجد بيانات خام"))})}),e.querySelectorAll(".sort-header").forEach(r=>{r.addEventListener("click",o=>{const n=o.currentTarget.closest(".sort-header").getAttribute("data-key");ne===n?ge=ge==="ASC"?"DESC":"ASC":(ne=n,ge="DESC"),P=0;const i=e.parentElement.parentElement;i&&te(i)})})}function Fa(e,t,a){let s=e[t.key];if(t.isRaw)try{s=(e.raw_data?JSON.parse(e.raw_data):{})[t.key]}catch{s=""}switch(t.type){case"residual":{let p=0;try{const d=e.raw_data?JSON.parse(e.raw_data):{};p=parseFloat(d.total_paid)||0}catch{}const c=parseFloat(e.amount_total)||0,l=p-c;return!l||l===0?'<td style="font-family:var(--font-en);color:var(--text-muted);">0</td>':`<td style="font-family:var(--font-en);font-weight:500;color:${l<0?"var(--accent-red)":"var(--text-primary)"};">${v(l,2)}</td>`}case"money":return!s||s===0?'<td style="font-family:var(--font-en);color:var(--text-muted);">0</td>':`<td style="font-family:var(--font-en);font-weight:500;color:${s<0?"var(--accent-red)":"var(--text-primary)"};">${v(s,2)}</td>`;case"date":return`<td style="font-family:var(--font-en);font-size:0.75rem;white-space:nowrap;">${s?s.split(" ")[0]:""}</td>`;case"code":return`<td style="font-family:var(--font-en);font-size:0.75rem;color:var(--accent-blue);font-weight:600;">${s||""}</td>`;case"badge":if(!s)return"<td></td>";const o=s==="posted";return`<td><span style="background:${o?"rgba(16,185,129,0.15)":"rgba(245,158,11,0.15)"};color:${o?"var(--accent-green)":"var(--accent-orange)"};padding:2px 6px;border-radius:4px;font-size:0.68rem;white-space:nowrap;">${s}</span></td>`;case"actions":return`<td>
         <button class="btn btn-secondary btn-sm btn-view-raw" data-idx="${a}" style="padding:4px 8px;font-size:0.7rem;">
           عرض JSON
         </button>
      </td>`;default:return`<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${(s||"").toString().replace(/"/g,"&quot;")}">${s||""}</td>`}}async function Oa(e){e.innerHTML='<div class="bi-empty">جاري تحميل مصمم التقرير الضريبي...</div>';try{let f=function(w,m,$,_,L){w.innerHTML="",m.forEach(k=>{const E=$(k),j=document.createElement("option");j.value=E,j.innerText=_(k),L&&L.includes(E)&&(j.selected=!0),w.appendChild(j)})},b=function(w){return w?Array.from(w.selectedOptions||[]).map(m=>m.value):[]},z=function(w){var I;if(!w||!w.periods||w.periods.length===0){d.innerHTML='<div class="bi-empty">لا توجد حركات ضريبية مطابقة لهذه الإعدادات.</div>';return}const m=w.summary,$=m.totalNet>=0?"#ef4444":"#10b981",_=m.totalNet>=0?"مستحقة للهيئة":"مستردة",L=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"],k={Q1:"الربع الأول",Q2:"الربع الثاني",Q3:"الربع الثالث",Q4:"الربع الرابع"};function E(q){return q.includes("-Q")?k[q.split("-")[1]]||q:q.length===7&&L[parseInt(q.split("-")[1])-1]||q}const T=w.periods.flatMap(q=>(q.items||[]).map(M=>({...M,periodKey:q.period}))).map(q=>{const M=q.type==="input"?'<span style="color:#10b981;">مشتريات</span>':'<span style="color:#ef4444;">مبيعات</span>',O=q.refundAmount>0?'<span style="color:#f59e0b; font-size:0.75rem; background:rgba(245, 158, 11, 0.1); padding:2px 4px; border-radius:4px; margin-right:6px;">مرتجع</span>':"",C=q.type==="input"?"#10b981":"#ef4444";return`
          <tr class="vat-detail-row-custom" data-period="${q.periodKey}" style="display:none;background:rgba(255,255,255,0.02);">
            <td>${q.date}</td>
            <td style="font-size:0.9rem;">${q.company.length>25?q.company.substring(0,25)+"…":q.company}</td>
            <td>${M} ${O}</td>
            <td style="font-size:0.85rem;color:rgba(255,255,255,0.6);">${q.journalEntry}</td>
            <td style="font-size:0.85rem;">${q.label} ${q.partner?'<br><span style="color:#3b82f6;">'+q.partner+"</span>":""}</td>
            <td class="n" style="color:${C};font-weight:600;">${x(Math.abs(q.netAmount))}</td>
          </tr>
        `}).join("");d.innerHTML=`
        <!-- KPI Cards -->
        <div class="bi-kpi-row" style="margin-bottom:24px;">
          <div class="bi-kpi">
            <div class="bi-kpi-label">المبيعات الإجمالية</div>
            <div class="bi-kpi-value" style="color:#ef4444;">${x(m.totalOutputBase)}</div>
            <div class="bi-kpi-sub" style="color:#ef4444;">يخصم منها مرتجعات: ${x(m.totalOutputRefund)}</div>
          </div>
          <div class="bi-kpi">
            <div class="bi-kpi-label">المشتريات الإجمالية</div>
            <div class="bi-kpi-value" style="color:#10b981;">${x(m.totalInputBase)}</div>
            <div class="bi-kpi-sub" style="color:#10b981;">يخصم منها مرتجعات: ${x(m.totalInputRefund)}</div>
          </div>
          <div class="bi-kpi">
            <div class="bi-kpi-label">صافي الإقرار</div>
            <div class="bi-kpi-value" style="color:${$};">${x(Math.abs(m.totalNet))}</div>
            <div class="bi-kpi-sub" style="color:${$};">${_}</div>
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
                ${w.periods.map(q=>{const M=q.netVAT>=0?"#ef4444":"#10b981",H=q.netVAT>=0?"مستحقة":"مستردة";return`<tr>
                    <td style="font-weight:700;">${E(q.period)}</td>
                    <td class="n" style="color:rgba(239, 68, 68, 0.7);">${x(q.outputBase)}</td>
                    <td class="n" style="color:rgba(239, 68, 68, 0.5);">${x(q.outputRefund)}</td>
                    <td class="n" style="color:#ef4444;font-weight:700">${x(q.outputVAT)}</td>
                    <td class="n" style="color:rgba(16, 185, 129, 0.7);">${x(q.inputBase)}</td>
                    <td class="n" style="color:rgba(16, 185, 129, 0.5);">${x(q.inputRefund)}</td>
                    <td class="n" style="color:#10b981;font-weight:700">${x(q.inputVAT)}</td>
                    <td class="n" style="color:${M};font-weight:800;">${x(Math.abs(q.netVAT))} <span style="font-size:0.75rem;font-weight:normal;">(${H})</span></td>
                    <td><button class="btn btn-show-details-custom" data-period="${q.period}" style="font-size:0.8rem;padding:6px 12px;background:rgba(59,130,246,0.15);color:#60a5fa;border:1px solid rgba(59,130,246,0.3);border-radius:6px;cursor:pointer;">عرض القيود</button></td>
                  </tr>`}).join("")}
              </tbody>
              <tfoot>
                <tr style="background:rgba(255,255,255,0.05);">
                  <td style="font-weight:800;">الإجمالي</td>
                  <td class="n" style="color:rgba(239, 68, 68, 0.7);">${x(m.totalOutputBase)}</td>
                  <td class="n" style="color:rgba(239, 68, 68, 0.5);">${x(m.totalOutputRefund)}</td>
                  <td class="n" style="color:#ef4444;font-weight:700">${x(m.totalOutput)}</td>
                  <td class="n" style="color:rgba(16, 185, 129, 0.7);">${x(m.totalInputBase)}</td>
                  <td class="n" style="color:rgba(16, 185, 129, 0.5);">${x(m.totalInputRefund)}</td>
                  <td class="n" style="color:#10b981;font-weight:700">${x(m.totalInput)}</td>
                  <td class="n" style="color:${$};font-weight:800;">${x(Math.abs(m.totalNet))}</td>
                  <td style="color:${$};">${_}</td>
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
                  ${T}
                </tbody>
                <tbody id="custom-details-empty" style="display:none;">
                  <tr><td colspan="6" style="text-align:center;padding:24px;color:rgba(255,255,255,0.5);">لا توجد قيود مسجلة</td></tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      `,d.querySelectorAll(".btn-show-details-custom").forEach(q=>{q.addEventListener("click",()=>{const M=q.dataset.period;d.querySelector("#custom-details-period-label").innerText=E(M),d.querySelector("#custom-details-container").style.display="block";let H=!1;d.querySelectorAll(".vat-detail-row-custom").forEach(O=>{O.dataset.period===M?(O.style.display="table-row",H=!0):O.style.display="none"}),d.querySelector("#custom-details-empty").style.display=H?"none":"table-row-group"})}),(I=d.querySelector("#custom-details-close"))==null||I.addEventListener("click",()=>{d.querySelector("#custom-details-container").style.display="none"})};const t=await h.getCompanies();if(!t||t.length===0){e.innerHTML='<div class="bi-empty">لم يتم العثور على شركات.</div>';return}let a=t[0].id,s=new Date().getFullYear().toString(),r="monthly",o={vatAccounts:[],journals:[],moveNames:[]},n={inputAccounts:[],outputAccounts:[],excludedJournals:[],excludedMoveNames:[]};e.innerHTML=`
      <div class="bi-header">
        <h1 class="bi-title">مصمم التقرير الضريبي</h1>
        <div class="bi-actions">
          <select id="builder-co-select" class="bi-input">
            ${t.map(w=>`<option value="${w.id}">${w.name}</option>`).join("")}
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
    `;const i=document.getElementById("builder-co-select"),p=document.getElementById("builder-year-select"),c=document.getElementById("builder-period-select"),l=document.getElementById("builder-input-accs"),u=document.getElementById("builder-output-accs"),d=document.getElementById("builder-results");async function g(){try{const w=await h.getTaxReportConfig(a);o=w.options,n=w.config,f(document.getElementById("builder-input-accs"),o.vatAccounts,m=>m.account_name,m=>`${m.account_code} - ${m.account_name}`,n.inputAccounts),f(document.getElementById("builder-output-accs"),o.vatAccounts,m=>m.account_name,m=>`${m.account_code} - ${m.account_name}`,n.outputAccounts)}catch(w){console.error(w),alert("خطأ في تحميل الإعدادات: "+w.message)}}document.getElementById("btn-save-config").addEventListener("click",async()=>{const w={companyId:a,inputAccounts:b(document.getElementById("builder-input-accs")),outputAccounts:b(document.getElementById("builder-output-accs"))};try{(await h.saveTaxReportConfig(w)).success&&alert("تم حفظ الإعدادات بنجاح!")}catch(m){alert("خطأ أثناء الحفظ: "+m.message)}}),document.getElementById("btn-run-report").addEventListener("click",async()=>{d.innerHTML='<div class="bi-empty">جاري بناء التقرير...</div>';const w={companyId:a,year:p.value,period:c.value,inputAccounts:b(document.getElementById("builder-input-accs")),outputAccounts:b(document.getElementById("builder-output-accs"))};try{const m=await h.generateCustomTaxReport(w);z(m)}catch(m){d.innerHTML=`<div class="bi-empty" style="color:#ef4444;">خطأ: ${m.message}</div>`}});const x=w=>new Intl.NumberFormat("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}).format(w||0);i.addEventListener("change",()=>{a=i.value,g()}),p.addEventListener("change",()=>{s=p.value}),c.addEventListener("change",()=>{r=c.value}),document.getElementById("btn-load-config").addEventListener("click",g),g()}catch(t){console.error("Builder init error:",t),e.innerHTML=`<div class="bi-empty" style="color:#ef4444">خطأ في التهيئة: ${t.message}</div>`}}const Ae={dashboard:Et,"income-statement":Tt,"balance-sheet":Ct,"cash-flow":Ht,pivot:Pt,"journal-items":Ft,mapping:Nt,"journal-mapping":wa,settings:Gt,"data-preview":na,"trial-balance":la,"detailed-trial-balance":pa,"closing-entries":ba,"analytic-accounts":fa,presentation:qt,"account-statement":_a,guarantees:zt,"api-manager":La,"sales-settings":Ea,"sales-data-preview":Da,"tax-builder":Oa};let $e=!1,kt=null;async function rt(e){const t=document.getElementById("main-content");if(window.isViewerMode()&&e!=="presentation"){console.warn(`[RouteGuard] Viewer is restricted to presentation. Blocked: ${e}`),e="presentation",S.set("currentPage","presentation");const r=new URL(window.location);r.searchParams.get("page")!=="presentation"&&(r.searchParams.set("page","presentation"),window.history.replaceState({},"",r))}if($e)return;$e=!0,kt=e;let s=Ae[e];if(e==="special-expenses"&&!s){const r=await Ke(()=>import("./special-expenses-P9N5less.js"),__vite__mapDeps([0,1,2]));Ae["special-expenses"]=r.renderSpecialExpenses,s=r.renderSpecialExpenses}if(e==="viewers-management"&&!s){const r=await Ke(()=>import("./viewers-management-DpahoSB4.js"),__vite__mapDeps([3,1,2]));Ae["viewers-management"]=r.renderViewersManagement,s=r.renderViewersManagement}if(s){t.innerHTML='<div style="display:flex;align-items:center;justify-content:center;min-height:60vh;"><div class="spinner"></div></div>';try{await s(t)}catch(r){console.error(`Error rendering ${e}:`,r),t.innerHTML=`
        <div style="text-align:center;padding:60px;">
          <div style="font-size:2rem;margin-bottom:16px;">⚠️</div>
          <h2 style="color:var(--text-white);margin-bottom:8px;">حدث خطأ</h2>
          <p style="color:var(--text-muted);">${r.message}</p>
          <button class="btn btn-primary" style="margin-top:16px;" onclick="location.reload()">إعادة المحاولة</button>
        </div>
      `}finally{$e=!1}}else $e=!1;dt()}window.mizaniatLogout=function(){localStorage.removeItem("mizaniat_admin_token"),localStorage.removeItem("mizaniat_admin_info"),localStorage.removeItem("mizaniat_viewer_mode"),localStorage.removeItem("mizaniat_viewer_token"),sessionStorage.removeItem("mizaniat_viewer_token"),localStorage.removeItem("mizaniat_viewer_info"),window.location.href="/login.html"};window.isViewerMode=()=>!localStorage.getItem("mizaniat_admin_token")&&localStorage.getItem("mizaniat_viewer_mode")==="true";async function Na(){const e=window.isViewerMode();if(e){const t=localStorage.getItem("mizaniat_viewer_token")||sessionStorage.getItem("mizaniat_viewer_token");if(!t){window.location.href="/login.html";return}try{if(!(await fetch("/api/auth/viewer/verify",{headers:{"x-viewer-token":t}})).ok){window.mizaniatLogout();return}}catch{}}else{const t=localStorage.getItem("mizaniat_admin_token");if(!t){window.location.href="/login.html";return}try{if(!(await fetch("/api/auth/admin/me",{headers:{Authorization:`Bearer ${t}`}})).ok){window.mizaniatLogout();return}}catch{}}console.log(e?"👁️ Mizaniat BI Viewer mode":"🚀 Mizaniat BI initializing...");try{const t=await h.getCompanies();S.set("companies",t),await Lt(),dt();let s=new URLSearchParams(window.location.search).get("page")||(e?"presentation":"dashboard");if(e&&s!=="presentation"){s="presentation";const r=new URL(window.location);r.searchParams.set("page","presentation"),window.history.replaceState({},"",r)}S.set("currentPage",s),S.subscribe(r=>{if(r==="currentPage"){const o=S.get("currentPage");o!==kt&&rt(o)}}),await rt(s),console.log("✅ Mizaniat BI ready")}catch(t){console.error("Init error:",t),document.getElementById("main-content").innerHTML=`
      <div style="text-align:center;padding:80px;">
        <div style="font-size:3rem;margin-bottom:24px;">📊</div>
        <h1 style="color:var(--text-white);margin-bottom:12px;">تقارير مالية</h1>
        <p style="color:var(--text-muted);margin-bottom:24px;">تعذر الاتصال بالخادم.</p>
        <button class="btn btn-primary" onclick="location.reload()">إعادة المحاولة</button>
      </div>
    `}}Na();
