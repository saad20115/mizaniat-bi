const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["assets/special-expenses-CpRC9VGw.js","assets/presentation-8NobHFiB.js","assets/presentation-DNGxwLeA.css","assets/viewers-management-Bhvvjr8z.js"])))=>i.map(i=>d[i]);
import{s as _,a as b,b as h,f as v,g as Ue,c as ge,d as ye,h as at,E as st,_ as Xe,r as $t,e as wt}from"./presentation-8NobHFiB.js";import{renderFilters as be,loadFilterOptions as kt}from"./filters-0FGXvLbF.js";const Ge=[{id:"dashboard",icon:"📊",label:"لوحة التحكم",section:"رئيسي"},{id:"income-statement",icon:"📈",label:"قائمة الدخل",section:"التقارير المالية"},{id:"balance-sheet",icon:"⚖️",label:"الميزانية العمومية",section:"التقارير المالية"},{id:"cash-flow",icon:"💰",label:"التدفقات النقدية",section:"التقارير المالية"},{id:"special-expenses",icon:"💸",label:"مصروفات مخصصة",section:"التقارير المالية"},{id:"trial-balance",icon:"📝",label:"ميزان المراجعة",section:"التقارير المالية"},{id:"detailed-trial-balance",icon:"🔍",label:"ميزان تفصيلي",section:"التقارير المالية"},{id:"account-statement",icon:"📄",label:"كشف حساب",section:"التقارير المالية"},{id:"guarantees",icon:"🏦",label:"الضمانات البنكية",section:"التقارير المالية"},{id:"hajj-budget",icon:"🕋",label:"موازنات المشاريع",section:"التقارير المالية",url:"https://budget.jalbait.com"},{id:"pivot",icon:"🔄",label:"الجداول المحورية",section:"التحليل"},{id:"presentation",icon:"🎬",label:"عرض تقديمي",section:"التحليل"},{id:"tax-builder",icon:"🧾",label:"مصمم التقرير الضريبي",section:"التحليل"},{id:"journal-items",icon:"📋",label:"القيود المحاسبية",section:"التحليل"},{id:"data-preview",icon:"🗂️",label:"معاينة بيانات API",section:"التحليل"},{id:"sales-data-preview",icon:"🛒",label:"معاينة المبيعات API",section:"التحليل"},{id:"analytic-accounts",icon:"📂",label:"الحسابات التحليلية",section:"الإعدادات"},{id:"mapping",icon:"🔗",label:"توحيد الحسابات",section:"الإعدادات"},{id:"journal-mapping",icon:"🎯",label:"توحيد اليوميات",section:"الإعدادات"},{id:"viewers-management",icon:"👥",label:"إدارة المشاهدين",section:"الإعدادات"},{id:"settings",icon:"⚙️",label:"إعدادات النظام",section:"الإعدادات"},{id:"sales-settings",icon:"🛍️",label:"إعدادات نظام المبيعات",section:"الإعدادات"},{id:"api-manager",icon:"🔌",label:"إدارة الـ APIs",section:"الإعدادات"}];function ot(){const e=document.getElementById("sidebar-nav"),t=document.getElementById("sidebar"),a=document.getElementById("main-content"),s=document.getElementById("sidebar-toggle"),n=_.get("currentPage"),r=window.isViewerMode&&window.isViewerMode();_.get("sidebarCollapsed")?(t.classList.add("collapsed"),a.classList.add("sidebar-collapsed"),s&&(s.querySelector("span").textContent="►")):(t.classList.remove("collapsed"),a.classList.remove("sidebar-collapsed"),s&&(s.querySelector("span").textContent="◄"));const o=r?Ge.filter(f=>f.id==="presentation"||f.id==="hajj-budget"):Ge;let i="",d="";for(const f of o)f.section!==d&&(d=f.section,i+=`<div class="nav-section-title">${d}</div>`),i+=`
      <div class="nav-item ${n===f.id?"active":""}" data-page="${f.id}">
        <span class="nav-item-icon">${f.icon}</span>
        <span class="nav-item-label">${f.label}</span>
      </div>
    `;const l=JSON.parse(localStorage.getItem("mizaniat_admin_info")||"{}"),c=JSON.parse(localStorage.getItem("mizaniat_viewer_info")||"{}"),m=r?"👁️ "+(c.name||l.name||"مشاهد"):l.name||l.email||"مدير";i+=`
    <div style="border-top:1px solid rgba(255,255,255,0.08); margin-top:16px; padding-top:12px;">
      <div style="padding:8px 16px; font-size:0.8rem; color:rgba(255,255,255,0.4); display:flex; align-items:center; gap:8px;">
        <span>👤</span>
        <span>${m}</span>
      </div>
      <div class="nav-item" id="logout-btn" style="color:#ef4444;">
        <span class="nav-item-icon">🚪</span>
        <span class="nav-item-label">تسجيل الخروج</span>
      </div>
    </div>
  `,e.innerHTML=i,e.querySelectorAll(".nav-item[data-page]").forEach(f=>{f.addEventListener("click",()=>{const w=f.dataset.page,E=o.find(x=>x.id===w);E&&E.url?window.open(E.url,"_blank"):_.set("currentPage",w)})});const u=document.getElementById("logout-btn");u&&u.addEventListener("click",()=>{confirm("هل تريد تسجيل الخروج؟")&&window.mizaniatLogout()}),s&&(s.onclick=()=>{t.classList.toggle("collapsed"),a.classList.toggle("sidebar-collapsed"),_.set("sidebarCollapsed",t.classList.contains("collapsed")),s.querySelector("span").textContent=t.classList.contains("collapsed")?"►":"◄"});const y=document.getElementById("mobile-menu-btn"),g=document.getElementById("sidebar-backdrop");y&&(y.onclick=()=>{const f=t.classList.toggle("mobile-open");g&&g.classList.toggle("active",f)}),g&&(g.onclick=()=>{t.classList.remove("mobile-open"),g.classList.remove("active")}),e.querySelectorAll(".nav-item").forEach(f=>{f.addEventListener("click",()=>{t.classList.remove("mobile-open"),g&&g.classList.remove("active")})})}async function St(e){e.innerHTML=`
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
  `;const t=e.querySelector("#dashboard-filters");be(t,()=>qe(e)),await qe(e),e.querySelector("#btn-sync").addEventListener("click",async()=>{try{b("جاري مزامنة البيانات...","info");const a=await h.syncAll();b("تمت المزامنة بنجاح","success"),await qe(e)}catch(a){b("فشلت المزامنة: "+a.message,"error")}})}async function qe(e){try{const t=_.getFilterParams(),a=await h.getDashboard(t);_t(e.querySelector("#kpi-grid"),a),zt(e.querySelector("#dash-charts"),a)}catch(t){console.error("Dashboard error:",t),b("خطأ في تحميل البيانات","error")}}function _t(e,t){const a=t.totalRevenue>0?(t.netProfit/t.totalRevenue*100).toFixed(1):"0.0";e.innerHTML=`
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
  `}function zt(e,t){const a=t.revenueByPeriod||[],s=t.expensesByPeriod||[],n=t.revenueByCompany||[],r=t.expensesByCompany||[],o=[...new Set([...a.map(p=>p.period),...s.map(p=>p.period)])].sort(),d=[...new Set(o.map(p=>p?p.split("-")[0]:""))].sort().pop()||"",l=d?a.filter(p=>p.period&&p.period.startsWith(d)):a,c=d?s.filter(p=>p.period&&p.period.startsWith(d)):s,m=Math.max(...l.map(p=>p.total),1),u=Math.max(...c.map(p=>p.total),1),y=["#3b82f6","#10b981","#06b6d4","#8b5cf6","#ec4899","#14b8a6"],g=["#ef4444","#f59e0b","#ec4899","#f97316","#e11d48","#dc2626"],f=n.reduce((p,$)=>p+$.total,0),w=r.reduce((p,$)=>p+$.total,0),E=l.reduce((p,$)=>p+$.total,0),x=c.reduce((p,$)=>p+$.total,0);e.innerHTML=`
    <!-- Donut Charts Row -->
    <div class="dash-donuts-row">
      <!-- Expenses Donut -->
      <div class="dash-donut-card fade-in">
        <div class="dash-donut-title">🍩 المصروفات حسب الشركة</div>
        <div class="dash-donut-content">
          <div class="dash-donut-ring">
            <svg viewBox="0 0 200 200">${Ye(r,g,200)}</svg>
            <div class="dash-donut-center">
              <div class="dash-donut-center-label">الإجمالي</div>
              <div class="dash-donut-center-value" style="color:#ef4444;">${Y(w)}</div>
            </div>
          </div>
          <div class="dash-legend">
            ${r.map((p,$)=>{const S=w>0?(p.total/w*100).toFixed(1):"0.0";return`
              <div class="dash-legend-item">
                <span class="dash-legend-dot" style="background:${g[$%g.length]}"></span>
                <span class="dash-legend-name">${p.company_name}</span>
                <span class="dash-legend-pct">${S}%</span>
                <span class="dash-legend-val" style="color:${g[$%g.length]}">${Y(p.total)}</span>
              </div>`}).join("")}
          </div>
        </div>
      </div>

      <!-- Revenue Donut -->
      <div class="dash-donut-card fade-in" style="animation-delay:0.08s">
        <div class="dash-donut-title">🍩 الإيرادات حسب الشركة</div>
        <div class="dash-donut-content">
          <div class="dash-donut-ring">
            <svg viewBox="0 0 200 200">${Ye(n,y,200)}</svg>
            <div class="dash-donut-center">
              <div class="dash-donut-center-label">الإجمالي</div>
              <div class="dash-donut-center-value" style="color:#10b981;">${Y(f)}</div>
            </div>
          </div>
          <div class="dash-legend">
            ${n.map((p,$)=>{const S=f>0?(p.total/f*100).toFixed(1):"0.0";return`
              <div class="dash-legend-item">
                <span class="dash-legend-dot" style="background:${p.color||y[$%y.length]}"></span>
                <span class="dash-legend-name">${p.company_name}</span>
                <span class="dash-legend-pct">${S}%</span>
                <span class="dash-legend-val" style="color:${p.color||y[$%y.length]}">${Y(p.total)}</span>
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
          <span class="dash-bar-total" style="color:#10b981;">${Y(E)}</span>
        </div>
        <div class="dash-bars">
          ${l.map(p=>{const $=p.total/m*100,S=p.period?p.period.split("-")[1]:"";return`
            <div class="dash-bar-item">
              <div class="dash-bar-val">${Y(p.total)}</div>
              <div class="dash-bar" style="height:${Math.max($,2)}%;background:linear-gradient(to top, #3b82f6, #60a5fa);" title="${v(p.total,2)} SAR"></div>
              <div class="dash-bar-lbl">${Ue(S)}</div>
            </div>`}).join("")}
        </div>
      </div>

      <!-- Monthly Expenses -->
      <div class="dash-bar-card fade-in" style="animation-delay:0.16s">
        <div class="dash-bar-title">
          📉 المصروفات الشهرية
          ${d?`<span style="font-size:0.8rem;color:rgba(255,255,255,0.3);font-family:var(--font-en);">${d}</span>`:""}
          <span class="dash-bar-total" style="color:#ef4444;">${Y(x)}</span>
        </div>
        <div class="dash-bars">
          ${c.map(p=>{const $=p.total/u*100,S=p.period?p.period.split("-")[1]:"";return`
            <div class="dash-bar-item">
              <div class="dash-bar-val">${Y(p.total)}</div>
              <div class="dash-bar" style="height:${Math.max($,2)}%;background:linear-gradient(to top, #ef4444, #f87171);" title="${v(p.total,2)} SAR"></div>
              <div class="dash-bar-lbl">${Ue(S)}</div>
            </div>`}).join("")}
        </div>
      </div>
    </div>
  `}function Ye(e,t,a){const s=e.reduce((c,m)=>c+Math.abs(m.total),0),n=a/2,r=a/2,o=a*.35,i=a*.12;if(s===0)return`<circle cx="${n}" cy="${r}" r="${o}" fill="none" stroke="rgba(99,130,255,0.08)" stroke-width="${i}"/>`;let d=0;const l=2*Math.PI*o;return e.map((c,m)=>{const u=Math.abs(c.total)/s,y=u*l,g=e.length>1?2:0,f=-d*l;return d+=u,`<circle cx="${n}" cy="${r}" r="${o}" fill="none" 
      stroke="${t[m%t.length]}" 
      stroke-width="${i}" 
      stroke-dasharray="${Math.max(y-g,0)} ${l-Math.max(y-g,0)}" 
      stroke-dashoffset="${f}"
      transform="rotate(-90 ${n} ${r})"
      stroke-linecap="round"
      style="transition: stroke-dasharray 0.6s ease;"/>`}).join("")}function Y(e){const t=Math.abs(e);return t>=1e6?(e/1e6).toFixed(1)+"M":t>=1e3?(e/1e3).toFixed(0)+"K":v(e,0)}async function qt(e){e.innerHTML=`
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
  `;const t=e.querySelector("#is-filters");be(t,()=>Ee(e)),e.querySelector("#chk-eliminations").addEventListener("change",()=>Ee(e)),await Ee(e)}async function Ee(e){try{const t=_.getFilterParams();t.useEliminations=e.querySelector("#chk-eliminations").checked;const a=await h.getIncomeStatement(t);Et(e.querySelector("#is-content"),a)}catch{b("خطأ في تحميل قائمة الدخل","error")}}function Et(e,t){const a=_.get("companies"),s=_.get("selectedCompanyIds"),n=s.length>0?a.filter(o=>s.includes(o.id)):a,r=n.length>1;e.innerHTML=`
    <div class="data-table-wrapper fade-in">
      <table class="data-table">
        <thead>
          <tr>
            <th style="min-width:200px;">الحساب</th>
            <th>الكود</th>
            ${r?n.map(o=>`<th class="number">${o.name}</th>`).join(""):""}
            <th class="number">المجمع</th>
          </tr>
        </thead>
        <tbody>
          <!-- Revenue Section -->
          <tr class="group-header"><td colspan="${r?n.length+3:3}">الإيرادات</td></tr>
          ${t.revenue.map(o=>We(o,n,r)).join("")}
          <tr class="total-row">
            <td>إجمالي الإيرادات</td>
            <td></td>
            ${r?n.map(o=>{const i=t.revenue.reduce((d,l)=>{var c;return d+(((c=l.companies[o.id])==null?void 0:c.amount)||0)},0);return`<td class="number">${v(i,2)}</td>`}).join(""):""}
            <td class="number positive">${v(t.summary.totalRevenue,2)}</td>
          </tr>
          
          <!-- Expenses Section -->
          <tr class="group-header"><td colspan="${r?n.length+3:3}">المصروفات</td></tr>
          ${t.expenses.map(o=>We(o,n,r,!0)).join("")}
          <tr class="total-row">
            <td>إجمالي المصروفات</td>
            <td></td>
            ${r?n.map(o=>{const i=t.expenses.reduce((d,l)=>{var c;return d+(((c=l.companies[o.id])==null?void 0:c.amount)||0)},0);return`<td class="number negative">(${v(i,2)})</td>`}).join(""):""}
            <td class="number negative">(${v(t.summary.totalExpenses,2)})</td>
          </tr>

          ${t.eliminations&&t.eliminations.length>0?`
            <tr class="group-header"><td colspan="${r?n.length+3:3}">تعديلات الاستبعاد</td></tr>
            ${t.eliminations.map(o=>`
              <tr>
                <td>${o.rule_name}</td>
                <td></td>
                ${r?n.map(()=>"<td></td>").join(""):""}
                <td class="number negative">(${v(o.debit-o.credit,2)})</td>
              </tr>
            `).join("")}
          `:""}
          
          <!-- Net Profit -->
          <tr class="total-row" style="font-size:1.1em;">
            <td>صافي الربح / (الخسارة)</td>
            <td></td>
            ${r?n.map(()=>"<td></td>").join(""):""}
            <td class="number ${t.summary.netProfit>=0?"positive":"negative"}" style="font-size:1.1em;">
              ${t.summary.netProfit>=0?"":"("}${v(Math.abs(t.summary.netProfit),2)}${t.summary.netProfit>=0?"":")"}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `}function We(e,t,a,s=!1){return`
    <tr class="indent-1">
      <td>${e.account_name}</td>
      <td style="font-family:var(--font-en);color:var(--text-muted);font-size:0.8em;">${e.account_code}</td>
      ${a?t.map(n=>{var o;const r=((o=e.companies[n.id])==null?void 0:o.amount)||0;return`<td class="number">${s&&r>0?"(":""}${v(Math.abs(r),2)}${s&&r>0?")":""}</td>`}).join(""):""}
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
  `;const t=e.querySelector("#bs-filters");be(t,()=>Le(e)),e.querySelector("#chk-bs-eliminations").addEventListener("change",()=>Le(e)),await Le(e)}async function Le(e){try{const t=_.getFilterParams();t.asOfDate=t.dateTo||new Date().toISOString().split("T")[0],t.useEliminations=e.querySelector("#chk-bs-eliminations").checked;const a=await h.getBalanceSheet(t);It(e.querySelector("#bs-content"),a)}catch{b("خطأ في تحميل الميزانية العمومية","error")}}function It(e,t){const a=_.get("companies"),s=_.get("selectedCompanyIds"),n=s.length>0?a.filter(l=>s.includes(l.id)):a,r=n.length>1,o=r?n.length+3:3,i=t.assets.filter(l=>!l.is_guarantee),d=t.assets.filter(l=>l.is_guarantee);e.innerHTML=`
    <div class="data-table-wrapper fade-in">
      <table class="data-table">
        <thead>
          <tr>
            <th style="min-width:200px;">الحساب</th>
            <th>الكود</th>
            ${r?n.map(l=>`<th class="number">${l.name}</th>`).join(""):""}
            <th class="number">المجمع</th>
          </tr>
        </thead>
        <tbody>
          <!-- Assets -->
          <tr class="group-header"><td colspan="${o}">الأصول</td></tr>
          ${i.map(l=>ve(l,n,r)).join("")}
          ${d.length>0?`
            <tr class="group-header" style="background: rgba(6, 182, 212, 0.08); color: #0891b2; font-size: 0.92em; padding-right: 20px;">
              <td colspan="${o}">🏦 الضمانات البنكية (أصول محتجزة)</td>
            </tr>
            ${d.map(l=>ve(l,n,r)).join("")}
          `:""}
          <tr class="total-row">
            <td>إجمالي الأصول</td><td></td>
            ${r?n.map(l=>{const c=t.assets.reduce((m,u)=>{var y;return m+(((y=u.companies[l.id])==null?void 0:y.amount)||0)},0);return`<td class="number">${v(c,2)}</td>`}).join(""):""}
            <td class="number positive">${v(t.summary.totalAssets,2)}</td>
          </tr>
          
          <!-- Liabilities -->
          <tr class="group-header"><td colspan="${o}">الالتزامات</td></tr>
          ${t.liabilities.map(l=>ve(l,n,r)).join("")}
          <tr class="total-row">
            <td>إجمالي الالتزامات</td><td></td>
            ${r?n.map(l=>{const c=t.liabilities.reduce((m,u)=>{var y;return m+(((y=u.companies[l.id])==null?void 0:y.amount)||0)},0);return`<td class="number">${v(c,2)}</td>`}).join(""):""}
            <td class="number">${v(t.summary.totalLiabilities,2)}</td>
          </tr>
          
          <!-- Equity -->
          <tr class="group-header"><td colspan="${o}">حقوق الملكية</td></tr>
          ${t.equity.map(l=>ve(l,n,r)).join("")}
          <tr class="total-row">
            <td>إجمالي حقوق الملكية</td><td></td>
            ${r?n.map(l=>{const c=t.equity.reduce((m,u)=>{var y;return m+(((y=u.companies[l.id])==null?void 0:y.amount)||0)},0);return`<td class="number">${v(c,2)}</td>`}).join(""):""}
            <td class="number">${v(t.summary.totalEquity,2)}</td>
          </tr>

          <!-- Total L+E -->
          <tr class="total-row" style="font-size:1.1em;">
            <td>إجمالي الالتزامات + حقوق الملكية</td><td></td>
            ${r?n.map(()=>"<td></td>").join(""):""}
            <td class="number positive" style="font-size:1.1em;">
              ${v(t.summary.totalLiabilities+t.summary.totalEquity,2)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `}function ve(e,t,a){const s=e.account_code==="RE-CALC"||e.account_code==="CYE",n=!!e.is_guarantee,r=s?"font-style: italic; background: rgba(59, 130, 246, 0.05);":n?"background: rgba(6, 182, 212, 0.03);":"";let o="";return s?o=' <span style="font-size:0.75em; background:var(--primary-subtle, rgba(59,130,246,0.1)); color:var(--primary, #3b82f6); border:1px solid rgba(59,130,246,0.25); border-radius:4px; padding:1px 6px; font-style:normal; margin-right:4px;">محسوب</span>':n&&(o=' <span style="font-size:0.75em; background:rgba(6,182,212,0.1); color:#0891b2; border:1px solid rgba(6,182,212,0.25); border-radius:4px; padding:1px 6px; font-style:normal; margin-right:4px;">ضمان</span>'),`
    <tr class="indent-1" style="${r}">
      <td>${e.account_name}${o}</td>
      <td style="font-family:var(--font-en);color:var(--text-muted);font-size:0.8em;">${e.account_code}</td>
      ${a?t.map(i=>{var l;const d=((l=e.companies[i.id])==null?void 0:l.amount)||0;return`<td class="number">${v(d,2)}</td>`}).join(""):""}
      <td class="number">${v(e.total,2)}</td>
    </tr>
  `}async function jt(e){e.innerHTML=`
    <div class="page-header">
      <div>
        <h1 class="page-title">قائمة التدفقات النقدية المجمعة</h1>
        <p class="page-subtitle">Consolidated Cash Flow Statement</p>
      </div>
    </div>
    
    <div class="filters-bar" id="cf-filters"></div>
    <div id="cf-content"><div class="skeleton" style="height:400px;border-radius:var(--radius-lg);"></div></div>
  `,be(e.querySelector("#cf-filters"),()=>Ze(e)),await Ze(e)}async function Ze(e){try{const t=_.getFilterParams(),a=await h.getCashFlow(t);Tt(e.querySelector("#cf-content"),a)}catch{b("خطأ في تحميل التدفقات النقدية","error")}}const Ie={income:"إيرادات",income_other:"إيرادات أخرى",expense:"مصروفات تشغيلية",expense_direct_cost:"تكلفة مبيعات",expense_depreciation:"استهلاك",revenue:"إيرادات",cost_of_revenue:"تكلفة إيرادات",asset_receivable:"تغير في الذمم المدينة",liability_payable:"تغير في الذمم الدائنة",asset_current:"تغير في الأصول المتداولة",liability_current:"تغير في الالتزامات المتداولة",asset_non_current:"أصول غير متداولة",asset_fixed:"أصول ثابتة",equity:"حقوق ملكية",equity_unaffected:"أرباح مبقاة",liability_non_current:"التزامات طويلة الأجل",bank_guarantees:"ضمانات بنكية"};function Tt(e,t){const a=t.operating.reduce((o,i)=>o+i.amount,0),s=t.investing.reduce((o,i)=>o+i.amount,0),n=t.financing.reduce((o,i)=>o+i.amount,0),r=a+s+n;e.innerHTML=`
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
          ${t.operating.map(o=>`
            <tr class="indent-1">
              <td>${Ie[o.account_type]||o.account_type}</td>
              <td class="number ${o.amount>=0?"":"negative"}">
                ${o.amount<0?"(":""}${v(Math.abs(o.amount),2)}${o.amount<0?")":""}
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
          ${t.investing.map(o=>`
            <tr class="indent-1">
              <td>${Ie[o.account_type]||o.account_type}</td>
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
          ${t.financing.map(o=>`
            <tr class="indent-1">
              <td>${Ie[o.account_type]||o.account_type}</td>
              <td class="number ${o.amount>=0?"":"negative"}">
                ${o.amount<0?"(":""}${v(Math.abs(o.amount),2)}${o.amount<0?")":""}
              </td>
            </tr>
          `).join("")}
          <tr class="total-row">
            <td>صافي النقد من الأنشطة التمويلية</td>
            <td class="number ${n>=0?"positive":"negative"}">
              ${n<0?"(":""}${v(Math.abs(n),2)}${n<0?")":""}
            </td>
          </tr>

          <tr class="total-row" style="font-size:1.05em; border-top:2px solid var(--border-color);">
            <td>صافي التغير في النقد خلال الفترة</td>
            <td class="number ${r>=0?"positive":"negative"}" style="font-size:1.05em;">
              ${r<0?"(":""}${v(Math.abs(r),2)}${r<0?")":""}
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
  `}let U=["account"],X=["period"],Te="balance";async function Mt(e){e.innerHTML=`
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
  `,be(e.querySelector("#pivot-filters"),()=>me(e)),he(e),await me(e)}const Me=[{id:"account",label:"الحساب"},{id:"account_type",label:"نوع الحساب"},{id:"company",label:"الشركة"},{id:"period",label:"الفترة"},{id:"fiscal_year",label:"السنة المالية"},{id:"journal",label:"اليومية"},{id:"partner",label:"الشريك"},{id:"cost_center",label:"مركز التكلفة"}],Ct=[{id:"balance",label:"الرصيد"},{id:"debit",label:"المدين"},{id:"credit",label:"الدائن"},{id:"count",label:"العدد"}];function he(e){const t=e.querySelector("#pivot-rows"),a=e.querySelector("#pivot-cols"),s=e.querySelector("#pivot-measure");t.innerHTML=Me.map(n=>`
    <span class="pivot-chip ${U.includes(n.id)?"active":""}" data-dim="${n.id}">${n.label}</span>
  `).join(""),a.innerHTML=Me.map(n=>`
    <span class="pivot-chip ${X.includes(n.id)?"active":""}" data-dim="${n.id}">${n.label}</span>
  `).join(""),s.innerHTML=Ct.map(n=>`
    <span class="pivot-chip ${Te===n.id?"active":""}" data-measure="${n.id}">${n.label}</span>
  `).join(""),t.querySelectorAll(".pivot-chip").forEach(n=>{n.addEventListener("click",()=>{const r=n.dataset.dim;U.includes(r)?U=U.filter(o=>o!==r):U.push(r),U.length===0&&(U=["account"]),he(e),me(e)})}),a.querySelectorAll(".pivot-chip").forEach(n=>{n.addEventListener("click",()=>{const r=n.dataset.dim;X.includes(r)?X=X.filter(o=>o!==r):X.push(r),X.length===0&&(X=["period"]),he(e),me(e)})}),s.querySelectorAll(".pivot-chip").forEach(n=>{n.addEventListener("click",()=>{Te=n.dataset.measure,he(e),me(e)})})}async function me(e){try{const t={..._.getFilterParams(),rows:U.join(","),columns:X.join(","),measure:Te},a=await h.getPivotData(t);At(e.querySelector("#pivot-content"),a)}catch(t){b("خطأ في تحميل الجدول المحوري","error"),console.error(t)}}function At(e,t){var m;if(!t||t.length===0){e.innerHTML='<div class="card" style="text-align:center;padding:60px;color:var(--text-muted);">لا توجد بيانات للعرض</div>';return}const a={company:"c.name",account:"ji.account_code",account_name:"ji.account_name",account_type:"ji.account_type",period:"ji.period",fiscal_year:"ji.fiscal_year",journal:"ji.journal_name",partner:"ji.partner_name",cost_center:"ji.analytic_account"},s=X[0],n=a[s]||s,r=n.includes(".")?n.split(".")[1]:n,o=[...new Set(t.map(u=>u[r]||u[Object.keys(u).find(y=>y.includes(r.replace("ji.","").replace("c.","")))]||""))].filter(u=>u).sort(),i=U[0],d=a[i]||i,l=d.includes(".")?d.split(".")[1]:d,c={};for(const u of t){const y=u[l]||u[Object.keys(u).find(f=>f.includes(l.replace("ji.","").replace("c.","")))]||"غير محدد",g=u[r]||u[Object.keys(u).find(f=>f.includes(r.replace("ji.","").replace("c.","")))]||"";c[y]||(c[y]={}),c[y][g]=(c[y][g]||0)+(u.value||0)}e.innerHTML=`
    <div class="data-table-wrapper fade-in">
      <table class="data-table">
        <thead>
          <tr>
            <th>${((m=Me.find(u=>u.id===i))==null?void 0:m.label)||i}</th>
            ${o.map(u=>`<th class="number">${u}</th>`).join("")}
            <th class="number">المجموع</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(c).map(([u,y])=>{const g=Object.values(y).reduce((f,w)=>f+w,0);return`
              <tr>
                <td>${u}</td>
                ${o.map(f=>{const w=y[f]||0;return`<td class="number ${w<0?"negative":""}">${v(w,2)}</td>`}).join("")}
                <td class="number" style="font-weight:600;">${v(g,2)}</td>
              </tr>
            `}).join("")}
          <tr class="total-row">
            <td>المجموع</td>
            ${o.map(u=>{const y=Object.values(c).reduce((g,f)=>g+(f[u]||0),0);return`<td class="number">${v(y,2)}</td>`}).join("")}
            <td class="number">${v(Object.values(c).reduce((u,y)=>u+Object.values(y).reduce((g,f)=>g+f,0),0),2)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `}let Z=0;const Ce=50;async function Ht(e){e.innerHTML=`
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
          ${_.get("companies").map(t=>`<option value="${t.id}">${t.name}</option>`).join("")}
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
  `,e.querySelector("#btn-ji-search").addEventListener("click",()=>{Z=0,we(e)}),await we(e)}async function we(e){try{const t=e.querySelector("#ji-company").value,a={limit:Ce,offset:Z*Ce,dateFrom:e.querySelector("#ji-date-from").value,dateTo:e.querySelector("#ji-date-to").value,accountCode:e.querySelector("#ji-account").value};t&&(a.companyIds=[parseInt(t)]);const s=await h.getJournalItems(a);Bt(e,s)}catch{b("خطأ في تحميل القيود","error")}}function Bt(e,t){var i,d;const a=e.querySelector("#ji-content"),{items:s,total:n}=t,r=Math.ceil(n/Ce);a.innerHTML=`
    <div style="margin-bottom:var(--space-md);font-size:0.8rem;color:var(--text-muted);">
      إجمالي النتائج: ${v(n)} | الصفحة ${Z+1} من ${r||1}
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
          ${s.map(l=>`
            <tr>
              <td style="font-family:var(--font-en);font-size:0.8em;white-space:nowrap;">${l.date}</td>
              <td><span class="badge badge-info">${l.company_name||""}</span></td>
              <td style="font-family:var(--font-en);">${l.account_code||""}</td>
              <td>${l.account_name||""}</td>
              <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;">${l.label||""}</td>
              <td>${l.partner_name||""}</td>
              <td class="number">${l.debit>0?v(l.debit,2):""}</td>
              <td class="number">${l.credit>0?v(l.credit,2):""}</td>
              <td class="number ${l.balance>=0?"":"negative"}">${v(l.balance,2)}</td>
              <td style="font-family:var(--font-en);font-size:0.75em;color:var(--text-muted);">${l.move_name||""}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;const o=e.querySelector("#ji-pagination");r>1?(o.innerHTML=`
      <button class="btn btn-sm btn-secondary" ${Z===0?"disabled":""} id="btn-prev">السابق</button>
      <span style="display:flex;align-items:center;font-size:0.85rem;color:var(--text-secondary);">
        ${Z+1} / ${r}
      </span>
      <button class="btn btn-sm btn-secondary" ${Z>=r-1?"disabled":""} id="btn-next">التالي</button>
    `,(i=o.querySelector("#btn-prev"))==null||i.addEventListener("click",()=>{Z--,we(e)}),(d=o.querySelector("#btn-next"))==null||d.addEventListener("click",()=>{Z++,we(e)})):o.innerHTML=""}async function Pt(e){e.innerHTML=`
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
        ${_.get("companies").map(t=>`<option value="${t.id}">${t.name}</option>`).join("")}
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
  `,e.querySelector("#mapping-company").addEventListener("change",()=>Ke(e)),e.querySelector("#btn-add-unified").addEventListener("click",()=>Ot()),await Ke(e)}async function Ke(e){try{const t=e.querySelector("#mapping-company").value,[a,s]=await Promise.all([h.getCompanyAccounts(t),h.getUnifiedAccounts()]);Rt(e.querySelector("#company-accounts-list"),a,s,t),Dt(e.querySelector("#unified-accounts-list"),s),Ft(e.querySelector("#mapping-stats"),a)}catch{b("خطأ في تحميل بيانات التوحيد","error")}}function Rt(e,t,a,s){e.innerHTML=t.map(n=>`
    <div class="mapping-item ${n.is_mapped?"mapped":"unmapped"}">
      <div>
        <div style="font-family:var(--font-en);font-size:0.8em;color:var(--text-muted);">${n.code}</div>
        <div style="font-size:0.85rem;">${n.name}</div>
        ${n.unified_name?`<div style="font-size:0.72rem;color:var(--accent-emerald);">← ${n.unified_name}</div>`:""}
      </div>
      <div>
        <select class="filter-select" style="min-width:160px;font-size:0.78rem;" data-account-id="${n.id}" data-company-id="${s}">
          <option value="">-- غير معين --</option>
          ${a.map(r=>`
            <option value="${r.id}" ${n.unified_account_id===r.id?"selected":""}>
              ${r.code} - ${r.name_ar}
            </option>
          `).join("")}
        </select>
      </div>
    </div>
  `).join("")||'<div style="padding:20px;text-align:center;color:var(--text-muted);">لا توجد حسابات - قم بمزامنة البيانات أولاً</div>',e.querySelectorAll("select").forEach(n=>{n.addEventListener("change",async()=>{const r=parseInt(n.value),o=parseInt(n.dataset.accountId);if(r)try{await h.createMapping({company_account_id:o,unified_account_id:r}),b("تم ربط الحساب بنجاح","success");const i=n.dataset.companyId,d=e.closest("#main-content")||document.getElementById("main-content"),l=n.closest(".mapping-item");l.classList.remove("unmapped"),l.classList.add("mapped")}catch{b("خطأ في ربط الحساب","error")}})})}function Dt(e,t){e.innerHTML=t.map(a=>`
    <div class="mapping-item" style="border-right:3px solid var(--accent-blue);">
      <div>
        <div style="font-family:var(--font-en);font-size:0.8em;color:var(--text-muted);">${a.code}</div>
        <div style="font-size:0.85rem;">${a.name_ar}</div>
        <div style="font-size:0.72rem;color:var(--text-muted);">${a.name_en||""} | ${a.account_type}</div>
      </div>
      <span class="badge ${a.is_group?"badge-info":"badge-success"}">${a.is_group?"مجموعة":"حساب"}</span>
    </div>
  `).join("")||'<div style="padding:20px;text-align:center;color:var(--text-muted);">لا توجد حسابات موحدة</div>'}function Ft(e,t){const a=t.length,s=t.filter(r=>r.is_mapped).length,n=a>0?(s/a*100).toFixed(0):0;e.innerHTML=`
    <div style="display:flex;align-items:center;gap:var(--space-lg);">
      <div style="flex:1;">
        <div style="display:flex;justify-content:space-between;margin-bottom:var(--space-sm);">
          <span style="font-size:0.85rem;">التقدم</span>
          <span style="font-family:var(--font-en);font-weight:600;">${s}/${a} (${n}%)</span>
        </div>
        <div style="height:8px;background:rgba(10,15,40,0.5);border-radius:4px;overflow:hidden;">
          <div style="height:100%;width:${n}%;background:linear-gradient(90deg,var(--accent-blue),var(--accent-emerald));border-radius:4px;transition:width 0.5s ease;"></div>
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
  `}function Ot(){ge("إضافة حساب موحد جديد",`
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
  `),document.getElementById("btn-save-unified").addEventListener("click",async()=>{try{await h.createUnifiedAccount({code:document.getElementById("ua-code").value,name_ar:document.getElementById("ua-name-ar").value,name_en:document.getElementById("ua-name-en").value,account_type:document.getElementById("ua-type").value}),ye(),b("تم إضافة الحساب الموحد","success")}catch(e){b("خطأ: "+e.message,"error")}})}let de={};async function Nt(e){e.innerHTML=`
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
  `;const t=e.querySelector("#btn-test-conn"),a=e.querySelector("#btn-save-conn");t.addEventListener("click",async()=>{const i=e.querySelector("#conn-url").value.trim(),d=e.querySelector("#conn-user").value.trim(),l=e.querySelector("#conn-pass").value.trim(),c=e.querySelector("#conn-result");if(!i||!d||!l){c.innerHTML='<div style="padding:12px;border-radius:8px;background:rgba(239,68,68,0.15);color:var(--accent-red);font-size:0.85rem;">⚠️ يرجى تعبئة جميع الحقول</div>';return}t.disabled=!0,t.textContent="جاري الاختبار...",c.innerHTML='<div style="padding:12px;color:var(--text-muted);font-size:0.85rem;">⏳ جاري اختبار الاتصال...</div>';try{const m=await h.testConnectionDirect({url:i,username:d,password:l,db_name:e.querySelector("#conn-db").value.trim(),company_id:1});m.success?(c.innerHTML=`
          <div style="padding:12px;border-radius:8px;background:rgba(16,185,129,0.15);color:var(--accent-emerald);font-size:0.85rem;">
            ✅ الاتصال ناجح! ${m.message||""}
          </div>
        `,a.disabled=!1):(c.innerHTML=`
          <div style="padding:12px;border-radius:8px;background:rgba(239,68,68,0.15);color:var(--accent-red);font-size:0.85rem;">
            ❌ فشل الاتصال: ${m.message}
          </div>
        `,a.disabled=!0)}catch(m){c.innerHTML=`
        <div style="padding:12px;border-radius:8px;background:rgba(239,68,68,0.15);color:var(--accent-red);font-size:0.85rem;">
          ❌ خطأ: ${m.message}
        </div>
      `}t.disabled=!1,t.textContent="🔌 اختبار الاتصال"}),a.addEventListener("click",async()=>{const i=e.querySelector("#conn-url").value.trim(),d=e.querySelector("#conn-user").value.trim(),l=e.querySelector("#conn-pass").value.trim();a.disabled=!0,a.textContent="جاري الحفظ...";try{let c=i;try{c=new URL(i).hostname}catch{c=i.replace(/https?:\/\//,"").split("/")[0]}await h.createInstance({name:"أودو - "+c,url:i,username:d,api_key:l,db_name:e.querySelector("#conn-db").value.trim()}),b("تم حفظ الاتصال بنجاح ✅ — اربط الشركات به من قسم الشركات","success"),e.querySelector("#conn-url").value="",e.querySelector("#conn-user").value="",e.querySelector("#conn-pass").value="",e.querySelector("#conn-db").value="",e.querySelector("#conn-result").innerHTML="",a.disabled=!0,await ne(e)}catch(c){b("خطأ في الحفظ: "+c.message,"error")}a.disabled=!1,a.textContent="💾 حفظ الاتصال"}),e.querySelector("#btn-add-company").addEventListener("click",()=>Kt(e)),e.querySelector("#btn-add-rule").addEventListener("click",()=>Qt(e)),e.querySelector("#btn-sync-all").addEventListener("click",async()=>{try{await h.syncAll(),b("بدأت مزامنة جميع الشركات","info"),Gt(e)}catch(i){b("خطأ: "+i.message,"error")}});const s=e.querySelector("#sync-enabled"),n=e.querySelector("#sync-toggle-track"),r=e.querySelector("#sync-toggle-dot");function o(i){i?(n.style.background="#06b6d4",r.style.right="2px"):(n.style.background="rgba(255,255,255,0.1)",r.style.right="22px")}n.addEventListener("click",()=>{s.checked=!s.checked,o(s.checked)}),r.addEventListener("click",()=>{s.checked=!s.checked,o(s.checked)}),e.querySelector("#btn-save-schedule").addEventListener("click",async()=>{const i=e.querySelector("#btn-save-schedule");i.disabled=!0,i.textContent="⏳ جاري الحفظ...";try{const d=await h.updateSchedule({enabled:s.checked,intervalHours:parseInt(e.querySelector("#sync-interval").value)});b(d.running?`تم تفعيل المزامنة التلقائية — ${d.schedule}`:"تم إيقاف المزامنة التلقائية","success"),nt(e,d)}catch(d){b("خطأ: "+d.message,"error")}i.disabled=!1,i.textContent="💾 حفظ الإعدادات"}),e.querySelector("#btn-clear-notifs").addEventListener("click",async()=>{try{await h.clearNotifications(),e.querySelector("#sync-notifications-list").innerHTML='<div style="text-align:center;color:var(--text-muted);padding:12px;font-size:0.8rem;">لا توجد إشعارات</div>',b("تم مسح الإشعارات","info")}catch(i){b("خطأ: "+i.message,"error")}}),await ne(e)}function nt(e,t){const a=e.querySelector("#schedule-status");a&&(t.running?a.innerHTML=`<span style="color:#10b981;">● نشطة</span> — <span style="font-family:var(--font-en);font-size:0.72rem;">${t.schedule}</span>`:a.innerHTML='<span style="color:var(--text-muted);">○ متوقفة</span>')}function Vt(e,t){if(!e)return;if(!t||t.length===0){e.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:12px;font-size:0.8rem;">لا توجد إشعارات</div>';return}const a={success:"background:rgba(16,185,129,0.12);color:#10b981;border-color:rgba(16,185,129,0.2)",warning:"background:rgba(245,158,11,0.12);color:#f59e0b;border-color:rgba(245,158,11,0.2)",error:"background:rgba(239,68,68,0.12);color:#ef4444;border-color:rgba(239,68,68,0.2)"},s={success:"✅",warning:"⚠️",error:"❌"};e.innerHTML=`<div style="display:grid;gap:6px;">
    ${t.map(n=>{const r=a[n.type]||a.success,o=s[n.type]||"✅",i=n.created_at?new Date(n.created_at+"Z").toLocaleString("ar-SA",{hour:"2-digit",minute:"2-digit",day:"numeric",month:"short"}):"";return`<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-radius:8px;border:1px solid;${r};font-size:0.8rem;">
        <span>${o} ${n.message}</span>
        <span style="font-family:var(--font-en);font-size:0.7rem;opacity:0.7;">${i}</span>
      </div>`}).join("")}
  </div>`}async function ne(e){try{const[t,a,s,n,r,o]=await Promise.all([h.getInstances(),h.getCompanies(),h.getEliminationRules(),h.getSyncStatus(),h.getSchedule().catch(()=>({enabled:!1,intervalHours:2,running:!1})),h.getNotifications().catch(()=>[])]);Jt(e.querySelector("#instances-list"),t,e),Ut(e.querySelector("#companies-list"),a,t,e),Xt(e.querySelector("#import-panel"),a),Wt(e.querySelector("#rules-list"),s),Zt(e.querySelector("#sync-log"),n);const i=e.querySelector("#sync-enabled");if(i){i.checked=r.enabled;const l=e.querySelector("#sync-toggle-track"),c=e.querySelector("#sync-toggle-dot");r.enabled?(l.style.background="#06b6d4",c.style.right="2px"):(l.style.background="rgba(255,255,255,0.1)",c.style.right="22px")}const d=e.querySelector("#sync-interval");d&&(d.value=String(r.intervalHours)),nt(e,r),Vt(e.querySelector("#sync-notifications-list"),o)}catch{b("خطأ في تحميل الإعدادات","error")}}function Jt(e,t,a){if(t.length===0){e.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:15px;font-size:0.85rem;">لا توجد اتصالات محفوظة — أضف اتصال من الخطوة 1</div>';return}e.innerHTML=`
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
  `,e.querySelectorAll(".btn-delete-instance").forEach(s=>{s.addEventListener("click",async()=>{const n=s.dataset.id;if(confirm("هل تريد حذف هذا الاتصال؟"))try{await h.deleteInstance(n),b("تم حذف الاتصال","success"),await ne(a)}catch(r){b("خطأ: "+r.message,"error")}})})}function Ut(e,t,a,s){if(t.length===0){e.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:0.85rem;">لا توجد شركات — أضف شركة جديدة</div>';return}const n={};for(const r of a)n[r.id]=r;e.innerHTML=`
    <div class="data-table-wrapper">
      <table class="data-table">
        <thead><tr><th>الشركة</th><th>الخادم المربوط</th><th>Odoo ID</th><th>عدد القيود</th><th>آخر قيد</th><th>الحالة</th></tr></thead>
        <tbody>
          ${t.map(r=>{const o=n[r.odoo_instance_id],i=a.map(d=>`<option value="${d.id}" ${d.id===r.odoo_instance_id?"selected":""}>${d.name}</option>`).join("");return`
            <tr>
              <td>
                <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${r.color||"#3b82f6"};margin-left:8px;"></span>
                ${r.name}
              </td>
              <td>
                <select class="filter-select company-instance-select" data-company-id="${r.id}" style="font-size:0.78rem;padding:4px 8px;min-width:180px;">
                  ${i}
                </select>
                ${o?`<div style="font-family:var(--font-en);font-size:0.68rem;color:var(--text-muted);margin-top:2px;">${o.url} — ${o.username}</div>`:""}
              </td>
              <td style="font-family:var(--font-en);">${r.odoo_company_id}</td>
              <td style="font-family:var(--font-en);font-weight:600;">${v(r.item_count||0)}</td>
              <td style="font-family:var(--font-en);font-size:0.8em;">${r.last_entry_date||"--"}</td>
              <td><span class="badge ${r.is_active?"badge-success":"badge-danger"}">${r.is_active?"نشط":"معطل"}</span></td>
            </tr>
          `}).join("")}
        </tbody>
      </table>
    </div>
  `,e.querySelectorAll(".company-instance-select").forEach(r=>{r.addEventListener("change",async()=>{const o=r.dataset.companyId,i=parseInt(r.value);try{await h.updateCompany(o,{odoo_instance_id:i}),b("تم تحديث الخادم المربوط ✅","success"),await ne(s)}catch(d){b("خطأ: "+d.message,"error")}})})}function Xt(e,t){if(t.length===0){e.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:0.85rem;">أضف شركات أولاً ثم ابدأ الاستيراد</div>';return}e.innerHTML=t.map(a=>`
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
  `).join(""),e.querySelectorAll(".btn-import").forEach(a=>{a.addEventListener("click",async()=>{const s=parseInt(a.dataset.companyId);a.disabled=!0,a.textContent="⏳ جاري...";try{await h.syncCompany(s),b("بدأت عملية الاستيراد","info"),rt(s)}catch(n){b("خطأ: "+n.message,"error"),a.disabled=!1,a.textContent="📥 استيراد"}})})}function rt(e){const t=document.getElementById(`progress-${e}`);t&&(t.style.display="block"),de[e]&&clearInterval(de[e]),de[e]=setInterval(async()=>{try{const a=await h.getSyncProgress(e);if(Yt(e,a),a.status==="completed"||a.status==="failed"){clearInterval(de[e]),delete de[e];const s=document.querySelector(`[data-company-id="${e}"]`);if(s&&(s.disabled=!1,s.textContent=a.status==="completed"?"✅ تم":"📥 إعادة الاستيراد"),a.status==="completed"){b(`تم استيراد ${v(a.inserted)} سجل بنجاح ✅`,"success");const n=await h.getCompanies();_.set("companies",n)}else b(`فشل الاستيراد: ${a.phase}`,"error")}}catch(a){console.error("Progress poll error:",a)}},1500)}function Gt(e){const t=_.get("companies");for(const a of t)rt(a.id)}function Yt(e,t){const a=document.getElementById(`progress-text-${e}`),s=document.getElementById(`progress-pct-${e}`),n=document.getElementById(`progress-bar-${e}`),r=document.getElementById(`progress-${e}`);if(!(!a||!s||!n)){if(r.style.display="block",a.textContent=t.phase||"",t.total>0){const o=Math.round(t.inserted/t.total*100);s.textContent=`${o}%`,n.style.width=`${o}%`}t.status==="completed"?(n.style.background="var(--accent-emerald)",n.style.width="100%",s.textContent="100%"):t.status==="failed"&&(n.style.background="var(--accent-red)")}}function Wt(e,t){if(t.length===0){e.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:15px;font-size:0.85rem;">لا توجد قواعد استبعاد</div>';return}e.innerHTML=`
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
  `}function Zt(e,t){if(t.length===0){e.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:15px;font-size:0.85rem;">لا يوجد سجل مزامنة بعد</div>';return}e.innerHTML=`
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
  `}function Kt(e){ge("إضافة شركة جديدة",`
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
  `),h.getInstances().then(t=>{const a=document.getElementById("comp-instance");t.length===0?a.innerHTML="<option disabled>⚠️ أضف اتصال أودو أولاً</option>":a.innerHTML=t.map(s=>`<option value="${s.id}">${s.name} (${s.url})</option>`).join("")}),document.getElementById("btn-save-company").addEventListener("click",async()=>{const t=document.getElementById("comp-name").value,a=parseInt(document.getElementById("comp-odoo-id").value),s=parseInt(document.getElementById("comp-instance").value);if(!t||!a){b("يرجى تعبئة الاسم ومعرف الشركة","warning");return}try{await h.createCompany({name:t,odoo_company_id:a,odoo_instance_id:s,currency:document.getElementById("comp-currency").value||"SAR",color:document.getElementById("comp-color").value}),ye(),b("تم إضافة الشركة بنجاح ✅","success");const n=await h.getCompanies();_.set("companies",n),await ne(e)}catch(n){b("خطأ: "+n.message,"error")}})}function Qt(e){const t=_.get("companies");ge("إضافة قاعدة استبعاد",`
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
  `),document.getElementById("btn-save-rule").addEventListener("click",async()=>{try{await h.createEliminationRule({name:document.getElementById("rule-name").value,source_company_id:parseInt(document.getElementById("rule-source").value),target_company_id:parseInt(document.getElementById("rule-target").value),source_account_code:document.getElementById("rule-src-acc").value,target_account_code:document.getElementById("rule-tgt-acc").value}),ye(),b("تم إضافة القاعدة بنجاح ✅","success"),await ne(e)}catch(a){b("خطأ: "+a.message,"error")}})}let D=0;const xe=50;async function ea(e){const t=_.get("companies");e.innerHTML=`
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
  `,e.querySelector("#dp-apply").addEventListener("click",()=>{D=0,se(e)}),e.querySelector("#dp-reset").addEventListener("click",()=>{e.querySelector("#dp-search").value="",e.querySelector("#dp-company").value="",e.querySelector("#dp-acctype").value="",e.querySelector("#dp-analytic").value="",e.querySelector("#dp-datefrom").value="",e.querySelector("#dp-dateto").value="",D=0,se(e)}),e.querySelector("#dp-prev").addEventListener("click",()=>{D>0&&(D--,se(e))}),e.querySelector("#dp-next").addEventListener("click",()=>{D++,se(e)}),e.querySelector("#dp-search").addEventListener("keydown",a=>{a.key==="Enter"&&(D=0,se(e))}),D=0,await se(e)}async function se(e){const t=e.querySelector("#dp-search").value.trim(),a=e.querySelector("#dp-company").value,s=e.querySelector("#dp-acctype").value,n=e.querySelector("#dp-analytic").value,r=e.querySelector("#dp-datefrom").value,o=e.querySelector("#dp-dateto").value,i={limit:xe,offset:D*xe};t&&(i.search=t),a&&(i.companyIds=a),s&&(i.accountType=s),n&&(i.analyticAccount=n),r&&(i.dateFrom=r),o&&(i.dateTo=o);try{const d=await h.getJournalItems(i);if(d.accountTypes&&d.accountTypes.length>0){const c=e.querySelector("#dp-acctype"),m=c.value;c.options.length<=1&&(d.accountTypes.forEach(u=>{const y=document.createElement("option");y.value=u,y.textContent=u,c.appendChild(y)}),m&&(c.value=m))}if(d.analyticAccounts&&d.analyticAccounts.length>0){const c=e.querySelector("#dp-analytic"),m=c.value;c.options.length<=1&&(d.analyticAccounts.forEach(u=>{const y=document.createElement("option");y.value=u,y.textContent=u,c.appendChild(y)}),m&&(c.value=m))}e.querySelector("#total-badge").textContent=`إجمالي: ${v(d.total)} سجل`;const l=Math.ceil(d.total/xe);e.querySelector("#dp-prev").disabled=D===0,e.querySelector("#dp-next").disabled=D+1>=l,e.querySelector("#dp-page-info").textContent=`صفحة ${D+1} من ${l||1}`,ta(e.querySelector("#dp-table-wrapper"),d.items)}catch(d){e.querySelector("#dp-table-wrapper").innerHTML=`<div style="padding:20px;color:var(--accent-red);">خطأ: ${d.message}</div>`}}function ta(e,t){if(!t||t.length===0){e.innerHTML='<div style="text-align:center;padding:40px;color:var(--text-muted);">لا توجد بيانات</div>';return}const a=[{key:"company_name",label:"الشركة",type:"text"},{key:"date",label:"التاريخ",type:"date"},{key:"account_code",label:"كود الحساب",type:"code"},{key:"account_name",label:"اسم الحساب",type:"text"},{key:"account_type",label:"نوع الحساب",type:"badge"},{key:"debit",label:"مدين",type:"money"},{key:"credit",label:"دائن",type:"money"},{key:"balance",label:"الرصيد",type:"money"},{key:"partner_name",label:"الشريك",type:"text"},{key:"analytic_account",label:"حساب تحليلي",type:"text"},{key:"label",label:"البيان",type:"text"},{key:"journal_name",label:"اليومية",type:"text"},{key:"move_name",label:"رقم القيد",type:"code"},{key:"move_ref",label:"المرجع",type:"text"},{key:"currency",label:"العملة",type:"code"},{key:"fiscal_year",label:"السنة",type:"code"},{key:"period",label:"الفترة",type:"code"}];e.innerHTML=`
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
        ${t.map((s,n)=>`
          <tr>
            <td style="font-family:var(--font-en);color:var(--text-muted);font-size:0.7rem;">${D*xe+n+1}</td>
            ${a.map(r=>aa(s,r)).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `}function aa(e,t){const a=e[t.key];switch(t.type){case"money":return!a||a===0?'<td style="font-family:var(--font-en);color:var(--text-muted);">0</td>':`<td style="font-family:var(--font-en);font-weight:500;color:${a<0?"var(--accent-red)":"var(--text-primary)"};">${v(a,2)}</td>`;case"date":return`<td style="font-family:var(--font-en);font-size:0.75rem;white-space:nowrap;">${a||""}</td>`;case"code":return`<td style="font-family:var(--font-en);font-size:0.75rem;color:var(--accent-blue);">${a||""}</td>`;case"badge":return a?`<td><span style="background:rgba(99,102,241,0.15);color:var(--accent-indigo);padding:2px 6px;border-radius:4px;font-size:0.68rem;white-space:nowrap;">${a}</span></td>`:"<td></td>";default:return`<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${(a||"").toString().replace(/"/g,"&quot;")}">${a||""}</td>`}}async function sa(e){const t=_.get("companies")||[],a=_.get("fiscalYear")||"",s=_.get("dateFrom")||"",n=_.get("dateTo")||"",r=_.get("filterOptions")||{};e.innerHTML=`
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
            ${t.map(o=>`
              <option value="${o.id}">${o.name}</option>
            `).join("")}
          </select>
        </div>

        <div class="filter-group">
          <span class="filter-label">السنة المالية</span>
          <select class="filter-select" id="tb-fiscal-year">
            <option value="">-- اختر --</option>
            ${(r.fiscalYears||[]).map(o=>`
              <option value="${o}" ${a===o?"selected":""}>${o}</option>
            `).join("")}
          </select>
        </div>

        <div class="filter-group">
          <span class="filter-label">من تاريخ</span>
          <input type="date" class="filter-select" id="tb-date-from" value="${s}" />
        </div>
        
        <div class="filter-group">
          <span class="filter-label">إلى تاريخ</span>
          <input type="date" class="filter-select" id="tb-date-to" value="${n}" />
        </div>

        <div class="filter-group">
          <span class="filter-label">مركز التكلفة</span>
          <select class="filter-select" id="tb-cost-center">
            <option value="">الكل</option>
            ${(r.costCenters||[]).map(o=>`
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
  `,e.querySelector("#tb-fiscal-year").addEventListener("change",o=>{const i=o.target.value;i&&(e.querySelector("#tb-date-from").value=`${i}-01-01`,e.querySelector("#tb-date-to").value=`${i}-12-31`)}),e.querySelector("#btn-tb-load").addEventListener("click",()=>Qe(e)),e.querySelector("#chk-tb-zero").addEventListener("change",()=>{re&&it(e)}),e.querySelector("#btn-export-pdf").addEventListener("click",()=>na(e)),e.querySelector("#btn-export-excel").addEventListener("click",()=>oa(e)),e.querySelector("#btn-sync-data").addEventListener("click",async()=>{var l;const o=e.querySelector("#tb-company").value;if(!o){b("اختر شركة أولاً","error");return}const i=e.querySelector("#btn-sync-data"),d=e.querySelector("#sync-icon");i.disabled=!0,d.style.animation="spin 1s linear infinite",(l=i.querySelector("span:last-child"))==null||l.remove(),i.insertAdjacentHTML("beforeend","<span> جاري المزامنة...</span>");try{if((await(await fetch(`/api/sync/company/${o}`,{method:"POST"})).json()).started){let u=!1;for(;!u;){await new Promise(E=>setTimeout(E,3e3));const w=await(await fetch(`/api/sync/status/${o}`)).json();(w.status==="done"||w.status==="idle"||w.status==="error")&&(u=!0,w.status==="error"?b("خطأ في المزامنة","error"):b(`✅ تم تحديث البيانات — ${w.inserted||""} سجل`,"success"))}const y=e.querySelector("#tb-date-from").value,g=e.querySelector("#tb-date-to").value;y&&g&&Qe(e)}}catch{b("خطأ في الاتصال","error")}finally{i.disabled=!1,d.style.animation="";const c=i.querySelector("span:last-child");c&&(c.textContent=" تحديث البيانات")}}),a&&(e.querySelector("#tb-date-from").value=`${a}-01-01`,e.querySelector("#tb-date-to").value=`${a}-12-31`)}let re=null;async function Qe(e){const t=e.querySelector("#tb-company").value,a=e.querySelector("#tb-date-from").value,s=e.querySelector("#tb-date-to").value,n=e.querySelector("#tb-cost-center").value;if(!a||!s){b("يجب اختيار الفترة (من تاريخ - إلى تاريخ)","error");return}const r=e.querySelector("#tb-content");r.innerHTML='<div class="skeleton" style="height:400px;border-radius:var(--radius-lg);"></div>';try{re=await h.getTrialBalance({companyId:t,dateFrom:a,dateTo:s,costCenter:n}),it(e),e.querySelector("#btn-export-pdf").disabled=!1,e.querySelector("#btn-export-excel").disabled=!1}catch(o){console.error("Trial balance error:",o),b("خطأ في تحميل ميزان المراجعة","error"),r.innerHTML='<p style="text-align:center;color:var(--accent-red);padding:var(--space-xl);">خطأ في التحميل</p>'}}function it(e){var c,m;const t=e.querySelector("#tb-content");if(!re)return;const a=((c=e.querySelector("#chk-tb-zero"))==null?void 0:c.checked)||!1,s=e.querySelector("#tb-company"),n=((m=s.options[s.selectedIndex])==null?void 0:m.text)||"",r=e.querySelector("#tb-date-from").value,o=e.querySelector("#tb-date-to").value;let i=re.accounts||[];a&&(i=i.filter(u=>Math.abs(u.open_debit)>.001||Math.abs(u.open_credit)>.001||Math.abs(u.period_debit)>.001||Math.abs(u.period_credit)>.001||Math.abs(u.close_debit)>.001||Math.abs(u.close_credit)>.001));const d=i.reduce((u,y)=>({open_debit:u.open_debit+y.open_debit,open_credit:u.open_credit+y.open_credit,period_debit:u.period_debit+y.period_debit,period_credit:u.period_credit+y.period_credit,close_debit:u.close_debit+y.close_debit,close_credit:u.close_credit+y.close_credit}),{open_debit:0,open_credit:0,period_debit:0,period_credit:0,close_debit:0,close_credit:0});Math.abs(d.open_debit-d.open_credit);const l=Math.abs(d.close_debit-d.close_credit);t.innerHTML=`
    <div style="margin-bottom:var(--space-md);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--space-sm);">
      <div style="display:flex;gap:var(--space-md);align-items:center;">
        <span style="font-size:0.85rem;font-weight:600;color:var(--text-primary);">🏢 ${n}</span>
        <span style="font-size:0.75rem;color:var(--text-muted);">الفترة: ${r} إلى ${o}</span>
        <span style="font-size:0.75rem;color:var(--text-muted);">عدد الحسابات: ${i.length}</span>
      </div>
      <div style="display:flex;gap:var(--space-md);">
        <span style="font-size:0.75rem;color:${l<.01?"var(--accent-emerald)":"var(--accent-red)"};">
          ${l<.01?"✅ الميزان متوازن":`⚠️ فرق الإقفال: ${v(l,2)}`}
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
          ${i.map(u=>{const y=u.account_code==="RE-CALC",g=y?"font-style: italic; background: rgba(59, 130, 246, 0.05);":"",f=y?' <span style="font-size:0.75em; background:var(--primary-subtle, rgba(59,130,246,0.1)); color:var(--primary, #3b82f6); border:1px solid rgba(59,130,246,0.25); border-radius:4px; padding:1px 6px; font-style:normal; margin-right:4px;">محسوب</span>':"";return`
            <tr style="${g}">
              <td style="font-family:var(--font-en);font-size:0.75em;color:var(--accent-blue);">${u.account_code}</td>
              <td>${u.account_name}${f}</td>
              <td class="number">${u.open_debit?v(u.open_debit,2):"-"}</td>
              <td class="number">${u.open_credit?v(u.open_credit,2):"-"}</td>
              <td class="number">${u.period_debit?v(u.period_debit,2):"-"}</td>
              <td class="number">${u.period_credit?v(u.period_credit,2):"-"}</td>
              <td class="number" style="font-weight:600;">${u.close_debit?v(u.close_debit,2):"-"}</td>
              <td class="number" style="font-weight:600;">${u.close_credit?v(u.close_credit,2):"-"}</td>
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
  `}function lt(e){var i,d;if(!re)return null;const t=((i=e.querySelector("#chk-tb-zero"))==null?void 0:i.checked)||!1;let a=re.accounts||[];t&&(a=a.filter(l=>l.open_debit||l.open_credit||l.period_debit||l.period_credit||l.close_debit||l.close_credit));const s=e.querySelector("#tb-company"),n=((d=s.options[s.selectedIndex])==null?void 0:d.text)||"",r=e.querySelector("#tb-date-from").value,o=e.querySelector("#tb-date-to").value;return{items:a,companyName:n,dateFrom:r,dateTo:o}}function oa(e){const t=lt(e);if(!t){b("لا توجد بيانات للتصدير","error");return}try{const{items:a,companyName:s,dateFrom:n,dateTo:r}=t,o=[];o.push([`ميزان المراجعة — ${s}`]),o.push([`الفترة: ${n} → ${r}`]),o.push([]),o.push(["كود الحساب","اسم الحساب","نوع الحساب","رصيد افتتاحي - مدين","رصيد افتتاحي - دائن","حركة الفترة - مدين","حركة الفترة - دائن","رصيد ختامي - مدين","رصيد ختامي - دائن"]);const i={od:0,oc:0,pd:0,pc:0,cd:0,cc:0};for(const m of a)o.push([m.account_code,m.account_name,m.account_type||"",m.open_debit||0,m.open_credit||0,m.period_debit||0,m.period_credit||0,m.close_debit||0,m.close_credit||0]),i.od+=m.open_debit||0,i.oc+=m.open_credit||0,i.pd+=m.period_debit||0,i.pc+=m.period_credit||0,i.cd+=m.close_debit||0,i.cc+=m.close_credit||0;o.push(["","الإجمالي","",i.od,i.oc,i.pd,i.pc,i.cd,i.cc]);const d=XLSX.utils.book_new(),l=XLSX.utils.aoa_to_sheet(o);l["!cols"]=[{wch:14},{wch:40},{wch:20},{wch:18},{wch:18},{wch:18},{wch:18},{wch:18},{wch:18}],l["!merges"]=[{s:{r:0,c:0},e:{r:0,c:8}},{s:{r:1,c:0},e:{r:1,c:8}}];const c="#,##0.00";for(let m=4;m<o.length;m++)for(let u=3;u<=8;u++){const y=XLSX.utils.encode_cell({r:m,c:u});l[y]&&(l[y].t="n",l[y].z=c)}XLSX.utils.book_append_sheet(d,l,"ميزان المراجعة"),XLSX.writeFile(d,`trial_balance_${n}_${r}.xlsx`),b("✅ تم تصدير ملف Excel بنجاح","success")}catch(a){console.error("Excel export error:",a),b("خطأ في تصدير Excel","error")}}async function na(e){const t=lt(e);if(!t){b("لا توجد بيانات للتصدير","error");return}try{b("⏳ جاري إنشاء PDF...","info");const{items:a,companyName:s,dateFrom:n,dateTo:r}=t,o={od:0,oc:0,pd:0,pc:0,cd:0,cc:0};a.forEach($=>{o.od+=$.open_debit||0,o.oc+=$.open_credit||0,o.pd+=$.period_debit||0,o.pc+=$.period_credit||0,o.cd+=$.close_debit||0,o.cc+=$.close_credit||0});const i=document.createElement("div");i.style.cssText="position:fixed;top:-99999px;left:0;width:1400px;background:#fff;padding:30px;font-family:Arial,Tahoma,sans-serif;direction:rtl;color:#000;",i.innerHTML=`
      <div style="text-align:center;margin-bottom:20px;">
        <h2 style="margin:0 0 6px;font-size:22px;color:#000;font-weight:900;">ميزان المراجعة</h2>
        <h3 style="margin:0 0 6px;font-size:16px;color:#1e293b;font-weight:700;">${s}</h3>
        <p style="margin:0;font-size:13px;color:#334155;font-weight:600;">الفترة: ${n} → ${r}</p>
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
          ${a.map(($,S)=>`
            <tr style="background:${S%2===0?"#fff":"#f1f5f9"};">
              <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:right;color:#000;font-weight:500;">${$.account_name||""}</td>
              <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:center;color:#000;font-family:monospace;font-weight:600;">${$.account_code}</td>
              <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:left;color:#000;font-family:monospace;">${R($.open_debit)}</td>
              <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:left;color:#000;font-family:monospace;">${R($.open_credit)}</td>
              <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:left;color:#000;font-family:monospace;">${R($.period_debit)}</td>
              <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:left;color:#000;font-family:monospace;">${R($.period_credit)}</td>
              <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:left;color:#000;font-family:monospace;">${R($.close_debit)}</td>
              <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:left;color:#000;font-family:monospace;">${R($.close_credit)}</td>
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
    `,document.body.appendChild(i);const d=await at(i,{scale:3,useCORS:!0,backgroundColor:"#ffffff"});document.body.removeChild(i);const l=new st({orientation:"landscape",unit:"mm",format:"a4"}),c=l.internal.pageSize.getWidth(),m=l.internal.pageSize.getHeight(),u=15,y=12,g=10,f=c-g*2,w=m-u-y,E=f,x=d.height/d.width*E,p=d.toDataURL("image/png");if(x<=w)l.addImage(p,"PNG",g,u,E,x);else{const $=Math.ceil((x+5)/w);for(let S=0;S<$;S++){S>0&&l.addPage();const q=u-S*w;l.addImage(p,"PNG",g,q,E,x),l.setFillColor(255,255,255),l.rect(0,0,c,u,"F"),S===$-1?l.rect(0,m-5,c,5,"F"):l.rect(0,m-y,c,y,"F"),l.setFontSize(8),l.setTextColor(150),l.text(`${S+1} / ${$}`,c/2,m-1.5,{align:"center"})}}l.save(`trial_balance_${n}_${r}.pdf`),b("✅ تم تصدير ملف PDF بنجاح","success")}catch(a){console.error("PDF export error:",a),b("خطأ في تصدير PDF: "+a.message,"error")}}function R(e){return!e||e===0?"-":Number(e).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}let ie=null,ee={},K=[];async function ra(e){const t=_.get("companies")||[],a=_.get("fiscalYear")||"",s=_.get("dateFrom")||"",n=_.get("dateTo")||"",r=_.get("filterOptions")||{};e.innerHTML=`
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
            ${t.map(o=>`<option value="${o.id}">${o.name}</option>`).join("")}
          </select>
        </div>
        <div class="filter-group">
          <span class="filter-label">السنة المالية</span>
          <select class="filter-select" id="dtb-fiscal-year">
            <option value="">-- اختر --</option>
            ${(r.fiscalYears||[]).map(o=>`
              <option value="${o}" ${a===o?"selected":""}>${o}</option>
            `).join("")}
          </select>
        </div>
        <div class="filter-group">
          <span class="filter-label">من تاريخ</span>
          <input type="date" class="filter-select" id="dtb-date-from" value="${s}" />
        </div>
        <div class="filter-group">
          <span class="filter-label">إلى تاريخ</span>
          <input type="date" class="filter-select" id="dtb-date-to" value="${n}" />
        </div>
        <div class="filter-group">
          <span class="filter-label">مركز التكلفة</span>
          <select class="filter-select" id="dtb-cost-center">
            <option value="">الكل</option>
            ${(r.costCenters||[]).map(o=>`<option value="${o}">${o}</option>`).join("")}
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
  `,e.querySelector("#dtb-fiscal-year").addEventListener("change",o=>{const i=o.target.value;i&&(e.querySelector("#dtb-date-from").value=`${i}-01-01`,e.querySelector("#dtb-date-to").value=`${i}-12-31`)}),e.querySelector("#dtb-company").addEventListener("change",()=>Ae(e)),e.querySelector("#btn-dtb-load").addEventListener("click",()=>la(e)),e.querySelector("#chk-dtb-zero").addEventListener("change",()=>{ie&&dt(e)}),e.querySelector("#btn-dtb-pdf").addEventListener("click",()=>ca(e)),e.querySelector("#btn-dtb-excel").addEventListener("click",()=>da(e)),e.querySelector("#btn-dtb-config").addEventListener("click",()=>{const o=e.querySelector("#dtb-config-panel");o.style.display=o.style.display==="none"?"":"none",o.style.display!=="none"&&ia(e)}),e.querySelector("#btn-close-config").addEventListener("click",()=>{e.querySelector("#dtb-config-panel").style.display="none"}),a&&(e.querySelector("#dtb-date-from").value=`${a}-01-01`,e.querySelector("#dtb-date-to").value=`${a}-12-31`),await Ae(e)}async function Ae(e){const t=e.querySelector("#dtb-company").value;try{const a=await h.getPartnerAccountConfig({companyId:t});K=(a.configs||[]).map(n=>n.account_code);const s=e.querySelector("#dtb-account-badges");K.length>0?s.innerHTML=K.map(n=>{const r=a.configs.find(o=>o.account_code===n);return`<span style="font-size:0.7rem;background:rgba(59,130,246,0.15);color:var(--accent-blue);padding:2px 8px;border-radius:var(--radius-sm);">${n}${r!=null&&r.account_name?" — "+r.account_name:""}</span>`}).join(""):s.innerHTML='<span style="font-size:0.7rem;color:var(--accent-amber);">⚠️ لم يتم إعداد حسابات التفصيل — اضغط "إعداد الحسابات"</span>'}catch(a){console.error("Config load error:",a),K=[]}}async function ia(e){var s;const t=e.querySelector("#dtb-company").value,a=e.querySelector("#dtb-config-content");a.innerHTML='<div class="skeleton" style="height:200px;"></div>';try{const n=await h.getPartnerAccountConfig({companyId:t}),{configs:r,categories:o,labels:i,availableAccounts:d}=n,l={};for(const u of r)l[u.account_category]=u;const c=e.querySelector("#dtb-company"),m=((s=c.options[c.selectedIndex])==null?void 0:s.text)||"";a.innerHTML=`
      <h4 style="color:var(--text-white);margin:0 0 var(--space-md);font-size:0.85rem;">📌 ${m}</h4>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:var(--space-md);">
        ${o.map(u=>{const y=l[u];return`
            <div style="background:rgba(255,255,255,0.03);border-radius:var(--radius-md);padding:var(--space-md);border:1px solid rgba(255,255,255,0.06);">
              <label style="font-size:0.8rem;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:6px;">${i[u]}</label>
              <select class="filter-select config-select" data-category="${u}" style="width:100%;font-size:0.8rem;">
                <option value="">-- اختر الحساب --</option>
                ${d.map(g=>`
                  <option value="${g.account_code}" data-name="${g.account_name}" ${(y==null?void 0:y.account_code)===g.account_code?"selected":""}>${g.account_code} — ${g.account_name}</option>
                `).join("")}
              </select>
            </div>
          `}).join("")}
      </div>
      <div style="margin-top:var(--space-md);display:flex;gap:var(--space-sm);">
        <button class="btn btn-primary" id="btn-save-config" style="font-size:0.8rem;">💾 حفظ الإعدادات</button>
      </div>
    `,e.querySelector("#btn-save-config").addEventListener("click",async()=>{const u=e.querySelectorAll(".config-select"),y=[];u.forEach(g=>{var w;const f=g.options[g.selectedIndex];y.push({category:g.dataset.category,account_code:g.value,account_name:((w=f==null?void 0:f.dataset)==null?void 0:w.name)||""})});try{await h.savePartnerAccountConfig({companyId:t,mappings:y}),b("✅ تم حفظ إعدادات الحسابات","success"),await Ae(e)}catch{b("خطأ في الحفظ","error")}})}catch{a.innerHTML='<p style="color:var(--accent-red);">خطأ في تحميل الإعدادات</p>'}}async function la(e){const t=e.querySelector("#dtb-company").value,a=e.querySelector("#dtb-date-from").value,s=e.querySelector("#dtb-date-to").value,n=e.querySelector("#dtb-cost-center").value;if(!a||!s){b("يجب اختيار الفترة","error");return}const r=e.querySelector("#dtb-content");r.innerHTML='<div class="skeleton" style="height:400px;border-radius:var(--radius-lg);"></div>';try{const o=[h.getTrialBalance({companyId:t,dateFrom:a,dateTo:s,costCenter:n})];K.length>0&&o.push(h.getDetailedTrialBalance({companyId:t,dateFrom:a,dateTo:s,accountCodes:K.join(",")}));const[i,d]=await Promise.all(o);if(ie=i,ee={},d!=null&&d.accounts)for(const l of d.accounts)ee[l.account_code]||(ee[l.account_code]=[]),ee[l.account_code].push(l);dt(e),e.querySelector("#btn-dtb-pdf").disabled=!1,e.querySelector("#btn-dtb-excel").disabled=!1}catch(o){console.error("Load error:",o),b("خطأ في تحميل الميزان","error"),r.innerHTML='<p style="text-align:center;color:var(--accent-red);padding:var(--space-xl);">خطأ في التحميل</p>'}}function dt(e){var d,l;const t=e.querySelector("#dtb-content");if(!ie)return;const a=((d=e.querySelector("#chk-dtb-zero"))==null?void 0:d.checked)||!1,s=e.querySelector("#dtb-company"),n=((l=s.options[s.selectedIndex])==null?void 0:l.text)||"";let r=ie.accounts||[];a&&(r=r.filter(c=>c.open_debit||c.open_credit||c.period_debit||c.period_credit||c.close_debit||c.close_credit));const o={od:0,oc:0,pd:0,pc:0,cd:0,cc:0};let i="";for(let c=0;c<r.length;c++){const m=r[c];o.od+=m.open_debit||0,o.oc+=m.open_credit||0,o.pd+=m.period_debit||0,o.pc+=m.period_credit||0,o.cd+=m.close_debit||0,o.cc+=m.close_credit||0;const u=K.includes(m.account_code),y=ee[m.account_code]||[],g=u&&y.length>0;if(i+=`
      <tr class="${g?"expandable-row":""}" data-code="${m.account_code}"
          style="${g?"cursor:pointer;":""}${c%2===0?"":"background:rgba(255,255,255,0.015);"}">
        <td style="font-family:var(--font-en);font-weight:500;${g?"color:var(--accent-blue);":""}">${m.account_code}</td>
        <td style="${g?"color:var(--accent-blue);font-weight:600;":""}">
          ${g?'<span class="expand-icon" style="display:inline-block;transition:transform 0.2s;margin-left:4px;font-size:0.7rem;">▶</span>':""}
          ${m.account_name}
          ${g?`<span style="font-size:0.65rem;color:var(--text-muted);margin-right:6px;">(${y.length} شريك)</span>`:""}
        </td>
        <td class="number">${v(m.open_debit,2)}</td>
        <td class="number">${v(m.open_credit,2)}</td>
        <td class="number">${v(m.period_debit,2)}</td>
        <td class="number">${v(m.period_credit,2)}</td>
        <td class="number">${v(m.close_debit,2)}</td>
        <td class="number">${v(m.close_credit,2)}</td>
      </tr>
    `,g)for(const f of y){const w=(f.close_debit||0)-(f.close_credit||0);i+=`
          <tr class="partner-detail-row" data-parent="${m.account_code}" style="display:none;background:rgba(59,130,246,0.03);">
            <td style="color:var(--text-muted);font-size:0.75rem;"></td>
            <td style="padding-right:36px;color:var(--text-secondary);font-size:0.8rem;">↳ ${f.partner_name}</td>
            <td class="number" style="font-size:0.8rem;">${v(f.open_debit,2)}</td>
            <td class="number" style="font-size:0.8rem;">${v(f.open_credit,2)}</td>
            <td class="number" style="font-size:0.8rem;">${v(f.period_debit,2)}</td>
            <td class="number" style="font-size:0.8rem;">${v(f.period_credit,2)}</td>
            <td class="number" style="font-size:0.8rem;color:${w>=0?"var(--accent-emerald)":"var(--accent-red)"};">${v(f.close_debit,2)}</td>
            <td class="number" style="font-size:0.8rem;color:${w>=0?"var(--accent-emerald)":"var(--accent-red)"};">${v(f.close_credit,2)}</td>
          </tr>
        `}}t.innerHTML=`
    <div class="glass-card" style="padding:var(--space-md);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md);">
        <h3 style="color:var(--text-white);margin:0;font-size:0.95rem;">${n}</h3>
        <span style="color:var(--text-muted);font-size:0.75rem;">${r.length} حساب</span>
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
  `,t.querySelectorAll(".expandable-row").forEach(c=>{c.addEventListener("click",()=>{var f;const m=c.dataset.code,u=c.querySelector(".expand-icon"),y=t.querySelectorAll(`.partner-detail-row[data-parent="${m}"]`),g=((f=y[0])==null?void 0:f.style.display)!=="none";y.forEach(w=>w.style.display=g?"none":""),u&&(u.style.transform=g?"":"rotate(90deg)")})})}function ct(e){var r,o;if(!ie)return null;const t=((r=e.querySelector("#chk-dtb-zero"))==null?void 0:r.checked)||!1;let a=ie.accounts||[];t&&(a=a.filter(i=>i.open_debit||i.open_credit||i.period_debit||i.period_credit||i.close_debit||i.close_credit));const s=e.querySelector("#dtb-company"),n=((o=s.options[s.selectedIndex])==null?void 0:o.text)||"";return{items:a,companyName:n,dateFrom:e.querySelector("#dtb-date-from").value,dateTo:e.querySelector("#dtb-date-to").value}}function da(e){const t=ct(e);if(!t)return b("لا توجد بيانات","error");try{const{items:a,companyName:s,dateFrom:n,dateTo:r}=t,o=[];o.push([`ميزان المراجعة التفصيلي — ${s}`]),o.push([`الفترة: ${n} → ${r}`]),o.push([]),o.push(["كود","الحساب","الشريك","افتتاحي مدين","افتتاحي دائن","حركة مدين","حركة دائن","ختامي مدين","ختامي دائن"]);for(const m of a){o.push([m.account_code,m.account_name,"",m.open_debit||0,m.open_credit||0,m.period_debit||0,m.period_credit||0,m.close_debit||0,m.close_credit||0]);const u=ee[m.account_code];if(u)for(const y of u)o.push(["","",y.partner_name,y.open_debit||0,y.open_credit||0,y.period_debit||0,y.period_credit||0,y.close_debit||0,y.close_credit||0])}const i={od:0,oc:0,pd:0,pc:0,cd:0,cc:0};for(const m of a)i.od+=m.open_debit||0,i.oc+=m.open_credit||0,i.pd+=m.period_debit||0,i.pc+=m.period_credit||0,i.cd+=m.close_debit||0,i.cc+=m.close_credit||0;o.push(["","الإجمالي","",i.od,i.oc,i.pd,i.pc,i.cd,i.cc]);const d=XLSX.utils.book_new(),l=XLSX.utils.aoa_to_sheet(o);l["!cols"]=[{wch:12},{wch:35},{wch:35},{wch:16},{wch:16},{wch:16},{wch:16},{wch:16},{wch:16}],l["!merges"]=[{s:{r:0,c:0},e:{r:0,c:8}},{s:{r:1,c:0},e:{r:1,c:8}}];const c="#,##0.00";for(let m=4;m<o.length;m++)for(let u=3;u<=8;u++){const y=XLSX.utils.encode_cell({r:m,c:u});l[y]&&typeof l[y].v=="number"&&(l[y].t="n",l[y].z=c)}XLSX.utils.book_append_sheet(d,l,"ميزان تفصيلي"),XLSX.writeFile(d,`detailed_trial_balance_${n}_${r}.xlsx`),b("✅ تم تصدير Excel","success")}catch(a){console.error(a),b("خطأ في التصدير","error")}}async function ca(e){const t=ct(e);if(!t)return b("لا توجد بيانات","error");try{b("⏳ جاري إنشاء PDF...","info");const{items:a,companyName:s,dateFrom:n,dateTo:r}=t,o=k=>!k||k===0?"-":Number(k).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});let i="",d=0;for(const k of a){const L=K.includes(k.account_code),j=d%2===0?"#fff":"#f1f5f9";i+=`<tr style="background:${L?"#eef2ff":j};">
        <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:center;font-family:monospace;font-weight:${L?"700":"500"};color:${L?"#2563eb":"#000"};">${k.account_code}</td>
        <td style="padding:5px 8px;border:1px solid #cbd5e1;text-align:right;font-weight:${L?"700":"500"};color:${L?"#2563eb":"#000"};">${k.account_name}</td>
        <td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:left;font-family:monospace;color:#000;">${o(k.open_debit)}</td>
        <td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:left;font-family:monospace;color:#000;">${o(k.open_credit)}</td>
        <td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:left;font-family:monospace;color:#000;">${o(k.period_debit)}</td>
        <td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:left;font-family:monospace;color:#000;">${o(k.period_credit)}</td>
        <td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:left;font-family:monospace;color:#000;">${o(k.close_debit)}</td>
        <td style="padding:5px 6px;border:1px solid #cbd5e1;text-align:left;font-family:monospace;color:#000;">${o(k.close_credit)}</td>
      </tr>`,d++;const T=ee[k.account_code];if(T)for(const I of T)i+=`<tr style="background:#f8fafc;">
          <td style="padding:3px;border:1px solid #e2e8f0;"></td>
          <td style="padding:3px 8px;border:1px solid #e2e8f0;text-align:right;font-size:10px;color:#475569;padding-right:20px;">↳ ${I.partner_name}</td>
          <td style="padding:3px 6px;border:1px solid #e2e8f0;text-align:left;font-family:monospace;font-size:10px;color:#475569;">${o(I.open_debit)}</td>
          <td style="padding:3px 6px;border:1px solid #e2e8f0;text-align:left;font-family:monospace;font-size:10px;color:#475569;">${o(I.open_credit)}</td>
          <td style="padding:3px 6px;border:1px solid #e2e8f0;text-align:left;font-family:monospace;font-size:10px;color:#475569;">${o(I.period_debit)}</td>
          <td style="padding:3px 6px;border:1px solid #e2e8f0;text-align:left;font-family:monospace;font-size:10px;color:#475569;">${o(I.period_credit)}</td>
          <td style="padding:3px 6px;border:1px solid #e2e8f0;text-align:left;font-family:monospace;font-size:10px;color:#475569;">${o(I.close_debit)}</td>
          <td style="padding:3px 6px;border:1px solid #e2e8f0;text-align:left;font-family:monospace;font-size:10px;color:#475569;">${o(I.close_credit)}</td>
        </tr>`}let l={od:0,oc:0,pd:0,pc:0,cd:0,cc:0};for(const k of a)l.od+=k.open_debit||0,l.oc+=k.open_credit||0,l.pd+=k.period_debit||0,l.pc+=k.period_credit||0,l.cd+=k.close_debit||0,l.cc+=k.close_credit||0;i+=`<tr style="background:#1e293b;color:#fff;font-weight:700;">
      <td style="padding:6px 8px;border:1px solid #000;" colspan="2" align="right">الإجمالي</td>
      <td style="padding:6px;border:1px solid #000;text-align:left;font-family:monospace;">${o(l.od)}</td>
      <td style="padding:6px;border:1px solid #000;text-align:left;font-family:monospace;">${o(l.oc)}</td>
      <td style="padding:6px;border:1px solid #000;text-align:left;font-family:monospace;">${o(l.pd)}</td>
      <td style="padding:6px;border:1px solid #000;text-align:left;font-family:monospace;">${o(l.pc)}</td>
      <td style="padding:6px;border:1px solid #000;text-align:left;font-family:monospace;">${o(l.cd)}</td>
      <td style="padding:6px;border:1px solid #000;text-align:left;font-family:monospace;">${o(l.cc)}</td>
    </tr>`;const c=document.createElement("div");c.style.cssText="position:fixed;top:-99999px;left:0;width:1400px;background:#fff;padding:30px;font-family:Arial,Tahoma,sans-serif;direction:rtl;color:#000;",c.innerHTML=`
      <div style="text-align:center;margin-bottom:20px;">
        <h2 style="margin:0 0 6px;font-size:22px;color:#000;font-weight:900;">ميزان المراجعة التفصيلي</h2>
        <h3 style="margin:0 0 6px;font-size:16px;color:#1e293b;font-weight:700;">${s}</h3>
        <p style="margin:0;font-size:13px;color:#334155;font-weight:600;">الفترة: ${n} → ${r}</p>
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
    `,document.body.appendChild(c);const m=await at(c,{scale:3,useCORS:!0,backgroundColor:"#fff"});document.body.removeChild(c);const u=new st({orientation:"landscape",unit:"mm",format:"a4"}),y=u.internal.pageSize.getWidth(),g=u.internal.pageSize.getHeight(),f=15,w=12,E=10,x=y-E*2,p=g-f-w,$=x,S=m.height/m.width*$,q=m.toDataURL("image/png");if(S<=p)u.addImage(q,"PNG",E,f,$,S);else{const k=Math.ceil((S+5)/p);for(let L=0;L<k;L++){L>0&&u.addPage(),u.addImage(q,"PNG",E,f-L*p,$,S),u.setFillColor(255,255,255),u.rect(0,0,y,f,"F");const j=L===k-1;j?u.rect(0,g-5,y,5,"F"):u.rect(0,g-w,y,w,"F"),u.setFontSize(8),u.setTextColor(150),u.text(`${L+1} / ${k}`,y/2,g-(j?1.5:4),{align:"center"})}}u.save(`detailed_trial_balance_${n}_${r}.pdf`),b("✅ تم تصدير PDF","success")}catch(a){console.error(a),b("خطأ: "+a.message,"error")}}async function pa(e){const t=_.get("companies")||[];e.innerHTML=`
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
  `,e.querySelector("#btn-ce-load").addEventListener("click",()=>He(e)),He(e)}async function He(e){const t=e.querySelector("#ce-content"),a=e.querySelector("#ce-company").value;t.innerHTML='<div class="skeleton" style="height:200px;border-radius:var(--radius-lg);"></div>';try{const s=await h.getClosingEntries({companyId:a});ua(e,s.entries||[])}catch(s){console.error("Error loading closing entries:",s),t.innerHTML='<p style="text-align:center;color:var(--accent-red);padding:var(--space-xl);">خطأ في تحميل القيود</p>'}}function ua(e,t){const a=e.querySelector("#ce-content");if(t.length===0){a.innerHTML=`
      <div class="glass-card" style="padding:var(--space-xl);text-align:center;">
        <div style="font-size:2rem;margin-bottom:var(--space-md);">📋</div>
        <div style="color:var(--text-muted);font-size:0.9rem;">لا توجد قيود إقفال حالياً</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:var(--space-sm);">
          يمكنك إنشاء قيود إقفال من صفحة <strong>ميزان المراجعة</strong>
        </div>
      </div>
    `;return}a.innerHTML=t.map(s=>{const n=s.lines||[];return`
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
            ${n.length} سطر
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
          📄 عرض تفاصيل القيد (${n.length} سطر)
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
              ${n.map(r=>`
                <tr${r.account_code===s.target_account?' style="background:rgba(16,185,129,0.08);font-weight:600;"':""}>
                  <td style="font-family:var(--font-en);color:var(--accent-blue);">${r.account_code}</td>
                  <td>${r.account_name}</td>
                  <td style="font-size:0.7rem;color:var(--text-muted);">${r.account_type||"-"}</td>
                  <td class="number">${r.debit?v(r.debit,2):"-"}</td>
                  <td class="number">${r.credit?v(r.credit,2):"-"}</td>
                </tr>
              `).join("")}
              <tr class="total-row">
                <td colspan="3" style="font-weight:700;">الإجمالي</td>
                <td class="number" style="font-weight:700;">${v(n.reduce((r,o)=>r+(o.debit||0),0),2)}</td>
                <td class="number" style="font-weight:700;">${v(n.reduce((r,o)=>r+(o.credit||0),0),2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </details>
    </div>
  `}).join(""),a.querySelectorAll(".btn-delete-ce").forEach(s=>{s.addEventListener("click",async()=>{const n=s.dataset.company,r=s.dataset.year;if(confirm(`هل تريد حذف قيد إقفال ${r}؟ سيتم إزالته من قاعدة البيانات.`))try{const o=await h.deleteClosingEntry({companyId:n,fiscalYear:r});b(`✅ تم حذف قيد الإقفال — ${r}`,"success"),He(e)}catch(o){console.error("Delete error:",o),b("خطأ في حذف القيد","error")}})})}const pt=["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#06b6d4","#84cc16","#f97316","#6366f1"];let G=[],te=[],Be=[],ut=[];async function ma(e){const t=_.get("companies")||[];e.innerHTML=`
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
            ${pt.map((s,n)=>`
              <label style="cursor:pointer;">
                <input type="radio" name="group-color" value="${s}" style="display:none;" ${n===0?"checked":""} />
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
  `,e.querySelectorAll(".color-dot").forEach(s=>{s.addEventListener("click",()=>{e.querySelectorAll(".color-dot").forEach(n=>n.style.borderColor="transparent"),s.style.borderColor="#fff"})});const a=e.querySelector(".color-dot");a&&(a.style.borderColor="#fff"),e.querySelector("#btn-add-group").addEventListener("click",()=>mt(e)),e.querySelector("#btn-cancel-modal").addEventListener("click",()=>Pe(e)),e.querySelector("#btn-confirm-modal").addEventListener("click",()=>ya(e)),e.querySelector("#btn-load-accounts").addEventListener("click",()=>gt(e)),e.querySelector("#btn-save-mappings").addEventListener("click",()=>ba(e)),e.querySelector("#group-modal").addEventListener("click",s=>{s.target.id==="group-modal"&&Pe(e)}),await Ne(e)}async function Ne(e){try{G=await h.getAnalyticGroups(),ga(e)}catch(t){console.error("Load groups error:",t)}}function ga(e){const t=e.querySelector("#groups-list");if(!G.length){t.innerHTML='<p style="color:var(--text-muted);font-size:0.8rem;">لا توجد مجموعات — أنشئ مجموعة جديدة لبدء التصنيف</p>';return}t.innerHTML=G.map(a=>`
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
  `).join(""),t.querySelectorAll(".btn-edit-group").forEach(a=>{a.addEventListener("click",()=>{const s=G.find(n=>n.id==a.dataset.id);s&&mt(e,s)})}),t.querySelectorAll(".btn-delete-group").forEach(a=>{a.addEventListener("click",async()=>{if(confirm("هل تريد حذف هذه المجموعة؟ سيتم إلغاء ربط جميع الحسابات المرتبطة بها."))try{await h.deleteAnalyticGroup(a.dataset.id),b("تم حذف المجموعة","success"),await Ne(e),te.length&&Ve(e)}catch{b("خطأ في الحذف","error")}})})}function mt(e,t=null){const a=e.querySelector("#group-modal");a.style.display="flex",e.querySelector("#modal-title").textContent=t?"تعديل المجموعة":"مجموعة جديدة",e.querySelector("#group-name").value=t?t.name:"",e.querySelector("#edit-group-id").value=t?t.id:"";const s=t?t.color:pt[0];e.querySelectorAll(".color-dot").forEach(r=>{r.style.borderColor=r.dataset.color===s?"#fff":"transparent"});const n=e.querySelector(`input[name="group-color"][value="${s}"]`);n&&(n.checked=!0),e.querySelector("#group-name").focus()}function Pe(e){e.querySelector("#group-modal").style.display="none"}async function ya(e){var n;const t=e.querySelector("#group-name").value.trim(),a=((n=e.querySelector('input[name="group-color"]:checked'))==null?void 0:n.value)||"#3b82f6",s=e.querySelector("#edit-group-id").value;if(!t){b("أدخل اسم المجموعة","error");return}try{s?(await h.updateAnalyticGroup(s,{name:t,color:a}),b("✅ تم تعديل المجموعة","success")):(await h.createAnalyticGroup({name:t,color:a}),b("✅ تم إنشاء المجموعة","success")),Pe(e),await Ne(e),te.length&&Ve(e)}catch{b("خطأ في الحفظ","error")}}async function gt(e){const t=e.querySelector("#aa-company").value,a=e.querySelector("#accounts-content");a.innerHTML='<div class="skeleton" style="height:300px;"></div>';try{const[s,n,r]=await Promise.all([h.getAnalyticAccounts({companyId:t}),h.getAnalyticGroupMappings({companyId:t}),h.getCompanyJournalNames(t)]);te=s,Be=n,ut=r||[],Ve(e),e.querySelector("#btn-save-mappings").disabled=!1}catch(s){console.error("Load accounts error:",s),a.innerHTML='<p style="color:var(--accent-red);text-align:center;">خطأ في تحميل الحسابات</p>'}}function Ve(e){var y;const t=e.querySelector("#accounts-content"),a=e.querySelector("#aa-company"),s=((y=a.options[a.selectedIndex])==null?void 0:y.text)||"";if(!te.length){t.innerHTML='<p style="text-align:center;color:var(--text-muted);padding:var(--space-lg);">لا توجد حسابات تحليلية لهذه الشركة</p>';return}const n={},r={},o={};for(const g of Be)n[g.analytic_account]=g.group_id,r[g.analytic_account]=g.redistributable?1:0,o[g.analytic_account]=g.journal_name||"";const i={};for(const g of Be)i[g.group_id]=(i[g.group_id]||0)+1;const d=te.filter(g=>!n[g.analytic_account]).length,l=G.map(g=>`<option value="${g.id}">${g.name}</option>`).join(""),c=ut.map(g=>`<option value="${g}">${g}</option>`).join("");t.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md);">
      <h4 style="margin:0;color:var(--text-white);font-size:0.9rem;">📊 ${s} — ${te.length} حساب تحليلي</h4>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        ${G.map(g=>`
          <span style="font-size:0.7rem;padding:3px 10px;border-radius:var(--radius-sm);background:${g.color}22;color:${g.color};border:1px solid ${g.color}44;">
            ${g.name}: ${i[g.id]||0}
          </span>
        `).join("")}
        <span style="font-size:0.7rem;padding:3px 10px;border-radius:var(--radius-sm);background:rgba(255,255,255,0.05);color:var(--text-muted);border:1px solid rgba(255,255,255,0.1);">
          غير مصنف: ${d}
        </span>
      </div>
    </div>
    <div style="margin-bottom:var(--space-md);display:flex;flex-wrap:wrap;gap:var(--space-sm);">
      <button class="btn btn-assign-all" data-group="" style="font-size:0.72rem;padding:4px 10px;">إلغاء الكل</button>
      ${G.map(g=>`
        <button class="btn btn-assign-all" data-group="${g.id}" style="font-size:0.72rem;padding:4px 10px;background:${g.color}15;color:${g.color};border-color:${g.color}33;">
          تعيين الكل → ${g.name}
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
          ${te.map((g,f)=>{const w=n[g.analytic_account]||"",E=r[g.analytic_account]||0,x=o[g.analytic_account]||"",p=G.find($=>$.id==w);return`
              <tr style="${p?`border-right:3px solid ${p.color};`:""}">
                <td style="text-align:center;"><input type="checkbox" class="aa-row-check" value="${g.analytic_account}" style="cursor:pointer;" /></td>
                <td style="color:var(--text-muted);font-size:0.75rem;">${f+1}</td>
                <td style="font-weight:500;">${g.analytic_account}</td>
                <td style="text-align:center;color:var(--text-muted);">
                  <span style="background:rgba(255,255,255,0.05);padding:2px 10px;border-radius:var(--radius-sm);font-size:0.75rem;">
                    ${g.transaction_count}
                  </span>
                </td>
                <td style="text-align:center;">
                  <select class="filter-select account-group-select" data-account="${g.analytic_account}" style="font-size:0.78rem;padding:4px 8px;width:100%;">
                    <option value="">— غير مصنف —</option>
                    ${l.replace(`value="${w}"`,`value="${w}" selected`)}
                  </select>
                </td>
                <td style="text-align:center;">
                  <select class="filter-select account-journal-select" data-account="${g.analytic_account}" style="font-size:0.78rem;padding:4px 8px;width:100%;">
                    <option value="">— غير محدد —</option>
                    ${c.replace(`value="${x}"`,`value="${x}" selected`)}
                  </select>
                </td>
                <td style="text-align:center;">
                  <select class="filter-select account-redist-select" data-account="${g.analytic_account}" style="font-size:0.78rem;padding:4px 8px;width:100%;">
                    <option value="0"${E?"":" selected"}>لا</option>
                    <option value="1"${E?" selected":""}>نعم</option>
                  </select>
                </td>
              </tr>
            `}).join("")}
        </tbody>
      </table>
    </div>
  `;const m=t.querySelector("#check-all-aa"),u=t.querySelectorAll(".aa-row-check");m&&m.addEventListener("change",g=>{u.forEach(f=>{f.checked=g.target.checked})}),t.querySelectorAll(".btn-assign-all").forEach(g=>{g.addEventListener("click",()=>{const f=g.dataset.group;let w=Array.from(u).filter(E=>E.checked);if(w.length===0){if(!confirm("لم يتم تحديد أي حسابات. هل تريد تطبيق هذه المجموعة على جميع الحسابات في الجدول؟"))return;t.querySelectorAll(".account-group-select").forEach(E=>{E.value=f,E.dispatchEvent(new Event("change"))})}else{const E=w.map(x=>x.value);t.querySelectorAll(".account-group-select").forEach(x=>{E.includes(x.dataset.account)&&(x.value=f,x.dispatchEvent(new Event("change")))}),m&&(m.checked=!1),u.forEach(x=>x.checked=!1)}})}),t.querySelectorAll(".account-group-select").forEach(g=>{g.addEventListener("change",()=>{const f=G.find(E=>E.id==g.value),w=g.closest("tr");w.style.borderRight=f?`3px solid ${f.color}`:""})})}async function ba(e){const t=e.querySelector("#aa-company").value,a=e.querySelectorAll(".account-group-select"),s=e.querySelectorAll(".account-redist-select"),n=e.querySelectorAll(".account-journal-select"),r=[],o={},i={};s.forEach(d=>{o[d.dataset.account]=parseInt(d.value)||0}),n.forEach(d=>{i[d.dataset.account]=d.value||null}),a.forEach(d=>{d.value&&r.push({analytic_account:d.dataset.account,group_id:parseInt(d.value),redistributable:o[d.dataset.account]||0,journal_name:i[d.dataset.account]||null})});try{await h.saveAnalyticGroupMappings({companyId:t,mappings:r}),b("✅ تم حفظ التصنيف بنجاح","success"),await gt(e)}catch(d){console.error("Save mappings error:",d),b("خطأ في حفظ التصنيف","error")}}let pe=[],ke=null;async function va(e){const t=_.get("companies")||[];if(!t.length){e.innerHTML='<p style="text-align:center;color:var(--text-muted);padding:var(--space-2xl);">يرجى إضافة شركة أولاً.</p>';return}ke=t[0].id,e.innerHTML=`
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
  `,e.querySelector("#jm-company").addEventListener("change",s=>{ke=parseInt(s.target.value),Re(e)}),await Re(e)}async function Re(e){const t=e.querySelector("#journal-content");t.innerHTML='<div class="skeleton" style="height:300px;border-radius:var(--radius-md);"></div>';try{pe=(await h.getJournalMappings(ke)).journals||[],fa(e,t)}catch(a){console.error("Error loading journals:",a),t.innerHTML=`<p style="text-align:center;color:var(--accent-red);">خطأ في تحميل أسماء اليوميات<br><small style="color:rgba(255,100,100,0.6);">${a.message}</small></p>`}}function fa(e,t){if(!pe.length){t.innerHTML='<p style="text-align:center;color:var(--text-muted);padding:var(--space-xl);">لا توجد يوميات لهذه الشركة.</p>';return}const s=pe.map(c=>c.journal_name).map(c=>`<option value="${c}">`).join("");t.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md);padding-bottom:var(--space-sm);border-bottom:1px solid rgba(255,255,255,0.05);">
        <h4 style="margin:0;font-size:0.95rem;color:var(--text-white);">🎯 تحديد ودمج الأسماء</h4>
        <span style="font-size:0.8rem;color:var(--text-muted);">إجمالي اليوميات المختلفة: ${pe.length}</span>
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
          ${pe.map((c,m)=>`
            <tr>
              <td style="text-align:center;">
                <input type="checkbox" class="row-checkbox" value="${c.journal_name}" style="cursor:pointer;" />
              </td>
              <td style="color:var(--text-muted);font-size:0.8rem;">${m+1}</td>
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
  `;const n=t.querySelector("#check-all"),r=t.querySelectorAll(".row-checkbox"),o=t.querySelector("#selected-count"),i=t.querySelector("#btn-merge");function d(){const c=Array.from(r).filter(m=>m.checked).length;o.textContent=c,i.disabled=c===0,n.checked=c===r.length&&c>0}n.addEventListener("change",c=>{r.forEach(m=>{m.checked=c.target.checked}),d()}),r.forEach(c=>{c.addEventListener("change",d)});const l=t.querySelector("#target-journal-name");t.querySelectorAll(".clickable-name").forEach(c=>{c.addEventListener("click",()=>{l.value=c.dataset.val})}),i.addEventListener("click",async()=>{const c=Array.from(r).filter(y=>y.checked).map(y=>y.value),m=l.value.trim();if(!m){b("يرجى تحديد إسم موحد لدمج اليوميات المختارة","error"),l.focus();return}if(c.length===0||!confirm(`هل أنت متأكد من دمج ${c.length} يومية في اسم واحد: "${m}"؟
سوف يتم تحديث جميع القيود المرتبطة فوراً.`))return;const u=i.innerHTML;i.innerHTML='<span class="spinner" style="width:14px;height:14px;border-width:2px;"></span> جاري الدمج...',i.disabled=!0;try{await h.mergeJournals({companyId:ke,sourceNames:c,targetName:m}),b("✅ تم توحيد اليوميات بنجاح","success"),await Re(e)}catch(y){console.error(y),b(y.message||"خطأ في عملية الدمج","error"),i.innerHTML=u,d()}})}const W=e=>v(e,2);async function ha(e){const t=_.get("companies")||[],s=(_.get("filterOptions")||{}).fiscalYears||[],n=s[s.length-1]||new Date().getFullYear().toString();e.innerHTML=`
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
            ${t.map(l=>`<option value="${l.id}">${l.name}</option>`).join("")}
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
          <input type="date" id="as-from" value="${n}-01-01">
        </div>
        <div class="as-filter">
          <label>📅 إلى</label>
          <input type="date" id="as-to" value="${n}-12-31">
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
  `;const r=e.querySelector("#as-account"),o=e.querySelector("#as-account-list"),i=e.querySelector("#as-partner");let d=[];e.querySelector("#as-company").addEventListener("change",async l=>{const c=l.target.value;if(r.value="",o.innerHTML="",i.innerHTML='<option value="">الكل</option>',!!c)try{const[m,u]=await Promise.all([h.getAccountStatementAccounts({companyId:c}),h.getAccountStatementPartners({companyId:c})]);d=m,o.innerHTML=m.map(y=>`<option value="${y.account_code} — ${y.account_name}"></option>`).join(""),i.innerHTML='<option value="">الكل ('+u.length+")</option>"+u.map(y=>`<option value="${y}">${y}</option>`).join("")}catch{b("خطأ في تحميل البيانات","error")}}),e.querySelector("#as-load").addEventListener("click",()=>xa(e)),e.querySelector("#as-print").addEventListener("click",()=>window.print()),e.querySelector("#as-export").addEventListener("click",()=>wa(e))}let De=null,Fe=null;async function xa(e){const t=e.querySelector("#as-company").value,s=e.querySelector("#as-account").value.split("—")[0].split(" — ")[0].trim(),n=e.querySelector("#as-from").value,r=e.querySelector("#as-to").value,o=e.querySelector("#as-partner").value,i=e.querySelector("#as-result");if(!t||!s){b("اختر شركة وحساب","warning");return}i.innerHTML='<div class="as-empty">⏳ جاري تحميل الكشف...</div>';try{const d=await h.getAccountStatement({companyId:t,accountCode:s,dateFrom:n,dateTo:r});De=d,$a(e,d,n,r,o),e.querySelector("#as-print").style.display="",e.querySelector("#as-export").style.display=""}catch(d){i.innerHTML=`<div class="as-empty" style="color:#f87171">❌ ${d.message}</div>`}}function $a(e,t,a,s,n){const r=e.querySelector("#as-result"),{company:o,account:i,openingBalance:d,items:l,closingBalance:c}=t;let m=l;n&&(m=l.filter(x=>x.partner_name===n));let u=d;m=m.map(x=>(u+=(x.debit||0)-(x.credit||0),{...x,runningBalance:u}));const y=m.reduce((x,p)=>x+(p.debit||0),0),g=m.reduce((x,p)=>x+(p.credit||0),0),f=d+y-g;Fe={filtered:m,totalDebit:y,totalCredit:g,closingBalance:f};const w=x=>x>=0?"bal-pos":"bal-neg",E=x=>x>0?"مدين":x<0?"دائن":"متزن";r.innerHTML=`
    <div class="as-info">
      <div class="as-info-card">
        <div class="as-info-label">الشركة</div>
        <div class="as-info-value ar">${o.name}</div>
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
        <div class="as-info-value">${m.length}${n?` <span class="nature">من ${l.length}</span>`:""}</div>
      </div>
      <div class="as-info-card" style="border-color:rgba(139,92,246,0.3)">
        <div class="as-info-label">الرصيد النهائي</div>
        <div class="as-info-value ${w(f)}" style="font-size:1.15rem">${W(Math.abs(f))} <span class="nature">${E(f)}</span></div>
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
            <td class="num ${w(d)}">${W(Math.abs(d))} <small>${E(d)}</small></td>
          </tr>
          ${m.length===0?'<tr><td colspan="8" class="as-empty" style="padding:30px">لا توجد حركات</td></tr>':""}
          ${m.map((x,p)=>`
            <tr>
              <td style="color:#475569;font-size:0.78rem;text-align:center">${p+1}</td>
              <td style="white-space:nowrap;font-family:var(--font-en);color:#94a3b8;font-size:0.85rem">${x.date}</td>
              <td style="font-family:var(--font-en);font-size:0.82rem;color:#818cf8">${x.move_name||""}</td>
              <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis">${x.label||x.move_ref||"—"}</td>
              <td style="font-size:0.85rem;color:#94a3b8">${x.partner_name||""}</td>
              <td class="num ${x.debit?"debit-val":""}">${x.debit?W(x.debit):""}</td>
              <td class="num ${x.credit?"credit-val":""}">${x.credit?W(x.credit):""}</td>
              <td class="num ${w(x.runningBalance)}">${W(Math.abs(x.runningBalance))}</td>
            </tr>
          `).join("")}
          <tr class="as-row-totals">
            <td></td>
            <td colspan="4" style="text-align:center">📊 إجمالي الحركات</td>
            <td class="num" style="font-size:0.95rem">${W(y)}</td>
            <td class="num" style="font-size:0.95rem">${W(g)}</td>
            <td class="num"></td>
          </tr>
          <tr class="as-row-closing">
            <td></td>
            <td colspan="4" style="text-align:center">📌 الرصيد الختامي</td>
            <td class="num"></td>
            <td class="num"></td>
            <td class="num ${w(f)}" style="font-size:1.05rem">${W(Math.abs(f))} <small>${E(f)}</small></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="as-count">${m.length} rows · ${o.currency||"SAR"}</div>
  `}function wa(e){if(!De||!Fe)return;const{company:t,account:a,openingBalance:s}=De,{filtered:n,totalDebit:r,totalCredit:o,closingBalance:i}=Fe,d=e.querySelector("#as-from").value,l=e.querySelector("#as-to").value;let c="\uFEFF";c+=`كشف حساب — ${t.name}
`,c+=`الحساب: ${a.account_code} — ${a.account_name}
`,c+=`الفترة: ${d} إلى ${l}

`,c+=`#,التاريخ,رقم القيد,البيان,الطرف,مدين,دائن,الرصيد
`,c+=`,,,الرصيد الافتتاحي,,,,"${s}"
`,n.forEach((g,f)=>{const w=(g.label||g.move_ref||"").replace(/"/g,'""'),E=(g.partner_name||"").replace(/"/g,'""');c+=`${f+1},"${g.date}","${g.move_name||""}","${w}","${E}",${g.debit||0},${g.credit||0},${g.runningBalance}
`}),c+=`,,,,إجمالي الحركات,${r},${o},
`,c+=`,,,,الرصيد الختامي,,,"${i}"
`;const m=new Blob([c],{type:"text/csv;charset=utf-8;"}),u=URL.createObjectURL(m),y=document.createElement("a");y.href=u,y.download=`كشف_حساب_${a.account_code}_${d}_${l}.csv`,y.click(),URL.revokeObjectURL(u),b("✅ تم تصدير الكشف","success")}const et="mizaniat_api_configs";async function ka(e){var x;const t=`${window.location.origin}/api/external`;e.innerHTML=`
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
  `;function a(p,$,S,q){var F;const k=document.getElementById(p);if(!k)return{getValues:()=>[],setValues:()=>{},clear:()=>{}};const L=k.querySelector(".ms-toggle"),j=k.querySelector(".ms-list"),T=k.querySelector(".ms-search input"),I=new Set,z=((F=L.querySelector(".ms-placeholder"))==null?void 0:F.textContent)||"اختر...";function M(C=""){const H=C.toLowerCase();j.innerHTML=$.filter(V=>!H||String(V[q]).toLowerCase().includes(H)).map(V=>{const P=String(V[S]),J=I.has(P);return`<div class="ms-item ${J?"selected":""}" data-val="${P}"><div class="ms-check">${J?"✓":""}</div><span>${V[q]}</span></div>`}).join(""),j.querySelectorAll(".ms-item").forEach(V=>{V.onclick=P=>{P.stopPropagation();const J=V.dataset.val;I.has(J)?I.delete(J):I.add(J),M(T.value),A()}})}function A(){if(I.size===0){L.innerHTML=`<span class="ms-placeholder">${z}</span>`;return}L.innerHTML=Array.from(I).map(C=>{const H=$.find(P=>String(P[S])===C);return`<span class="ms-tag">${H?H[q].length>20?H[q].substring(0,20)+"…":H[q]:C} <span class="ms-x" data-val="${C}">✕</span></span>`}).join(""),L.querySelectorAll(".ms-x").forEach(C=>{C.onclick=H=>{H.stopPropagation(),I.delete(C.dataset.val),M(T.value),A()}})}return L.onclick=C=>{C.stopPropagation(),k.classList.toggle("open"),k.classList.contains("open")&&T.focus()},T.onclick=C=>C.stopPropagation(),T.oninput=()=>M(T.value),document.addEventListener("click",()=>k.classList.remove("open")),M(),A(),{getValues:()=>Array.from(I),setValues:C=>{I.clear(),C.forEach(H=>I.add(String(H))),M(),A()},clear:()=>{I.clear(),M(),A()}}}function s(p,$,S,q,k){const L="ms-"+Math.random().toString(36).slice(2,8);return p.innerHTML=`<div class="multi-select" id="${L}"><div class="ms-toggle"><span class="ms-placeholder">${k}</span></div><div class="ms-dropdown"><div class="ms-search"><input placeholder="بحث..." /></div><div class="ms-list"></div></div></div>`,a(L,$,S,q)}let n=[],r=[],o=[],i;try{const[p,$,S]=await Promise.all([fetch("/api/external/companies").then(k=>k.json()),fetch("/api/external/groups").then(k=>k.json()),fetch("/api/external/cost-centers").then(k=>k.json())]);n=p.data||[],r=$.data||[];const q=new Set;o=(S.data||[]).filter(k=>q.has(k.name)?!1:(q.add(k.name),!0)),i=a("ms-companies",n,"id","name")}catch(p){console.error("Failed to load dropdown data:",p)}let d=0;const l=[];function c(p){const $=d++,S=document.createElement("div");S.className="period-row",S.id=`period-${$}`,S.innerHTML=`
      <span class="period-num">${l.length+1}</span>
      <button class="period-del" data-idx="${$}">✕</button>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;padding-right:36px;">
        <div><label class="api-label">تاريخ البداية (تلقائي: كل الفترات)</label><input type="date" class="api-input period-from" value="${(p==null?void 0:p.dateFrom)||""}" /></div>
        <div><label class="api-label">تاريخ النهاية (تلقائي: اليوم)</label><input type="date" class="api-input period-to" value="${(p==null?void 0:p.dateTo)||""}" /></div>
        <div><label class="api-label">المجموعات</label><div class="period-groups"></div></div>
      </div>
      <div style="padding-right:36px;margin-top:10px;"><label class="api-label">مراكز التكلفة</label><div class="period-cc"></div></div>
    `,document.getElementById("periods-container").appendChild(S);const q=s(S.querySelector(".period-groups"),r,"id","name","اختر المجموعات..."),k=s(S.querySelector(".period-cc"),o,"name","name","اختر مراكز التكلفة...");p!=null&&p.groupIds&&q.setValues(p.groupIds.map(String)),p!=null&&p.costCenters&&k.setValues(p.costCenters);const L={idx:$,div:S,msG:q,msCC:k};return l.push(L),S.querySelector(".period-del").onclick=()=>{S.remove();const j=l.findIndex(T=>T.idx===$);j>=0&&l.splice(j,1),m()},L}function m(){l.forEach((p,$)=>{p.div.querySelector(".period-num").textContent=$+1})}function u(){l.forEach(p=>p.div.remove()),l.length=0,d=0}c(),document.getElementById("btn-add-period").onclick=()=>c();function y(){const p=((i==null?void 0:i.getValues())||[]).map(Number),$=document.getElementById("test-monthly").checked,S=l.map(q=>{const k={};k.dateFrom=q.div.querySelector(".period-from").value;const L=q.div.querySelector(".period-to").value;L&&(k.dateTo=L);const j=q.msG.getValues().map(Number);j.length&&(k.groupIds=j);const T=q.msCC.getValues();return T.length&&(k.costCenters=T),k}).filter(q=>q.dateFrom||q.dateTo||q.groupIds||q.costCenters||l.length===1);return{companyIds:p,monthly:$,periods:S}}function g(p){var $;u(),p.companyIds&&(i==null||i.setValues(p.companyIds.map(String))),document.getElementById("test-monthly").checked=p.monthly!==!1,(p.periods||[]).forEach(S=>c(S)),($=p.periods)!=null&&$.length||c()}function f(){try{return JSON.parse(localStorage.getItem(et)||"[]")}catch{return[]}}function w(p){localStorage.setItem(et,JSON.stringify(p))}function E(){const p=f(),$=document.getElementById("saved-configs-card"),S=document.getElementById("saved-configs-list");if(p.length===0){$.style.display="none";return}$.style.display="",S.innerHTML=p.map((q,k)=>`
      <div class="saved-chip" data-idx="${k}">
        <span>📁 ${q.name}</span>
        <span class="chip-del" data-idx="${k}" title="حذف">✕</span>
      </div>
    `).join(""),S.querySelectorAll(".saved-chip").forEach(q=>{q.onclick=k=>{if(k.target.classList.contains("chip-del")){const T=Number(k.target.dataset.idx),I=f();I.splice(T,1),w(I),E();return}const L=Number(q.dataset.idx),j=f()[L];j&&g(j.config)}})}document.getElementById("btn-save-config").onclick=()=>{const p=prompt("اسم الإعدادات:");if(!p)return;const $=f();$.push({name:p,config:y(),savedAt:new Date().toISOString()}),w($),E()},E(),document.getElementById("btn-update-fetch").onclick=()=>{l.forEach(p=>{p.div.querySelector(".period-to").value=""}),document.getElementById("btn-test").click()},(x=document.getElementById("btn-copy-base"))==null||x.addEventListener("click",()=>{navigator.clipboard.writeText(t)}),document.getElementById("btn-test").onclick=async()=>{var L,j;const p=document.getElementById("test-status"),$=document.getElementById("test-result"),S=document.getElementById("json-output-box"),q=document.getElementById("get-link-box");p.textContent="⏳ جاري الجلب...",p.style.color="#f59e0b",$.style.display="none",S.style.display="none",q.style.display="none";const k=y();if(!k.companyIds.length){p.textContent="❌ اختر شركة واحدة على الأقل",p.style.color="#ef4444";return}if(!k.periods.length){p.textContent="❌ أضف فترة واحدة على الأقل بالضغط على إضافة فترة",p.style.color="#ef4444";return}try{const T=performance.now(),I=await fetch("/api/external/expenses",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(k)}),z=Math.round(performance.now()-T),M=await I.json();if(!I.ok){p.textContent=`❌ ${I.status}: ${M.error||"Error"}`,p.style.color="#ef4444";return}p.textContent=`✅ OK — ${z}ms — ${((L=M.summary)==null?void 0:L.totalRows)||0} سطر`,p.style.color="#10b981";const A=btoa(unescape(encodeURIComponent(JSON.stringify(k)))),F=`${t}/expenses/query?config=${encodeURIComponent(A)}`;document.getElementById("get-link-url").textContent=F,q.style.display="",document.getElementById("btn-copy-link").onclick=()=>{navigator.clipboard.writeText(F);const O=document.getElementById("btn-copy-link");O.textContent="✅ تم!",setTimeout(()=>O.textContent="📋 نسخ الرابط",2e3)};const C=JSON.stringify(M.data,null,2);document.getElementById("data-json-output").textContent=C,document.getElementById("json-rows-count").textContent=`${((j=M.data)==null?void 0:j.length)||0} سطر — ${(C.length/1024).toFixed(1)} KB`,S.style.display="",document.getElementById("btn-copy-data-json").onclick=()=>{navigator.clipboard.writeText(C);const O=document.getElementById("btn-copy-data-json");O.textContent="✅ تم النسخ!",setTimeout(()=>O.textContent="📋 نسخ JSON",2e3)};const H=document.getElementById("result-summary"),V=M.summary||{};H.innerHTML=Object.entries(V).map(([O,le])=>`
        <div style="background:rgba(16,185,129,0.06);border-radius:8px;padding:12px 16px;text-align:center;">
          <div style="color:var(--text-muted);font-size:0.78rem;">${O}</div>
          <div style="color:#10b981;font-size:1.15rem;font-weight:700;font-family:var(--font-en);">${typeof le=="number"?le.toLocaleString("en"):le}</div>
        </div>
      `).join("");const P=M.data||[],J=document.getElementById("result-table");if(P.length>0){const O=Object.keys(P[0]),le=O.map(Se=>`<th style="white-space:nowrap;font-size:0.82rem;">${Se}</th>`).join(""),ht=P.slice(0,300).map(Se=>`<tr>${O.map(xt=>{const _e=Se[xt],ze=typeof _e=="number";return`<td class="${ze?"n":""}" style="font-size:0.85rem;${ze?"font-family:var(--font-en);":""}">${ze?_e.toLocaleString("en-US"):_e??"-"}</td>`}).join("")}</tr>`).join("");J.innerHTML=`<thead><tr>${le}</tr></thead><tbody>${ht}</tbody>`,P.length>300&&(J.innerHTML+=`<tfoot><tr><td colspan="${O.length}" style="text-align:center;color:var(--text-muted);">عرض أول 300 من ${P.length}</td></tr></tfoot>`)}else J.innerHTML='<tr><td style="text-align:center;color:var(--text-muted);padding:20px;">لا توجد بيانات</td></tr>';$.style.display=""}catch(T){p.textContent=`❌ ${T.message}`,p.style.color="#ef4444"}}}let ce={};async function Sa(e){e.innerHTML=`
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
  `;const t=e.querySelector("#btn-test-conn"),a=e.querySelector("#btn-save-conn");t.addEventListener("click",async()=>{let i=e.querySelector("#conn-url").value.trim();const d=e.querySelector("#conn-user").value.trim(),l=e.querySelector("#conn-pass").value.trim(),c=e.querySelector("#conn-result");if(!i||!d||!l){c.innerHTML='<div style="padding:12px;border-radius:8px;background:rgba(239,68,68,0.15);color:var(--accent-red);font-size:0.85rem;">⚠️ يرجى تعبئة جميع الحقول</div>';return}!i.startsWith("http://")&&!i.startsWith("https://")&&(i="https://"+i,e.querySelector("#conn-url").value=i),t.disabled=!0,t.textContent="جاري الاختبار...",c.innerHTML='<div style="padding:12px;color:var(--text-muted);font-size:0.85rem;">⏳ جاري اختبار الاتصال...</div>';try{const m=await h.sales.testConnectionDirect({url:i,username:d,password:l,company_id:1});m.success?(c.innerHTML=`
          <div style="padding:12px;border-radius:8px;background:rgba(16,185,129,0.15);color:var(--accent-emerald);font-size:0.85rem;">
            ✅ الاتصال ناجح! ${m.message||""}
          </div>
        `,a.disabled=!1):(c.innerHTML=`
          <div style="padding:12px;border-radius:8px;background:rgba(239,68,68,0.15);color:var(--accent-red);font-size:0.85rem;">
            ❌ فشل الاتصال: ${m.message}
          </div>
        `,a.disabled=!0)}catch(m){c.innerHTML=`
        <div style="padding:12px;border-radius:8px;background:rgba(239,68,68,0.15);color:var(--accent-red);font-size:0.85rem;">
          ❌ خطأ: ${m.message}
        </div>
      `}t.disabled=!1,t.textContent="🔌 اختبار الاتصال"}),a.addEventListener("click",async()=>{let i=e.querySelector("#conn-url").value.trim();i&&!i.startsWith("http://")&&!i.startsWith("https://")&&(i="https://"+i);const d=e.querySelector("#conn-user").value.trim(),l=e.querySelector("#conn-pass").value.trim();a.disabled=!0,a.textContent="جاري الحفظ...";try{let c=i;try{c=new URL(i).hostname}catch{c=i.replace(/https?:\/\//,"").split("/")[0]}await h.sales.createInstance({name:"المبيعات - "+c,url:i,username:d,api_key:l}),b("تم حفظ الاتصال بنجاح ✅ — اربط الشركات به من قسم الشركات","success"),e.querySelector("#conn-url").value="",e.querySelector("#conn-user").value="",e.querySelector("#conn-pass").value="",e.querySelector("#conn-result").innerHTML="",a.disabled=!0,await ae(e)}catch(c){b("خطأ في الحفظ: "+c.message,"error")}a.disabled=!1,a.textContent="💾 حفظ الاتصال"}),e.querySelector("#btn-add-company").addEventListener("click",()=>Ma(e)),e.querySelector("#btn-add-rule").addEventListener("click",()=>Ca(e)),e.querySelector("#btn-sync-all").addEventListener("click",async()=>{try{await h.sales.syncAll(),b("بدأت مزامنة جميع الشركات","info"),La(e)}catch(i){b("خطأ: "+i.message,"error")}});const s=e.querySelector("#sync-enabled"),n=e.querySelector("#sync-toggle-track"),r=e.querySelector("#sync-toggle-dot");function o(i){i?(n.style.background="#06b6d4",r.style.right="2px"):(n.style.background="rgba(255,255,255,0.1)",r.style.right="22px")}s.addEventListener("change",()=>{o(s.checked)}),e.querySelector("#btn-save-schedule").addEventListener("click",async()=>{const i=e.querySelector("#btn-save-schedule");i.disabled=!0,i.textContent="⏳ جاري الحفظ...";try{const d=await h.sales.updateSchedule({enabled:s.checked,intervalHours:parseInt(e.querySelector("#sync-interval").value)});b(d.running?`تم تفعيل المزامنة التلقائية — ${d.schedule}`:"تم إيقاف المزامنة التلقائية","success"),yt(e,d)}catch(d){b("خطأ: "+d.message,"error")}i.disabled=!1,i.textContent="💾 حفظ الإعدادات"}),e.querySelector("#btn-clear-notifs").addEventListener("click",async()=>{try{await h.sales.clearNotifications(),e.querySelector("#sync-notifications-list").innerHTML='<div style="text-align:center;color:var(--text-muted);padding:12px;font-size:0.8rem;">لا توجد إشعارات</div>',b("تم مسح الإشعارات","info")}catch(i){b("خطأ: "+i.message,"error")}}),await ae(e)}function yt(e,t){const a=e.querySelector("#schedule-status");a&&(t.running?a.innerHTML=`<span style="color:#10b981;">● نشطة</span> — <span style="font-family:var(--font-en);font-size:0.72rem;">${t.schedule}</span>`:a.innerHTML='<span style="color:var(--text-muted);">○ متوقفة</span>')}function _a(e,t){if(!e)return;if(!t||t.length===0){e.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:12px;font-size:0.8rem;">لا توجد إشعارات</div>';return}const a={success:"background:rgba(16,185,129,0.12);color:#10b981;border-color:rgba(16,185,129,0.2)",warning:"background:rgba(245,158,11,0.12);color:#f59e0b;border-color:rgba(245,158,11,0.2)",error:"background:rgba(239,68,68,0.12);color:#ef4444;border-color:rgba(239,68,68,0.2)"},s={success:"✅",warning:"⚠️",error:"❌"};e.innerHTML=`<div style="display:grid;gap:6px;">
    ${t.map(n=>{const r=a[n.type]||a.success,o=s[n.type]||"✅",i=n.created_at?new Date(n.created_at+"Z").toLocaleString("ar-SA",{hour:"2-digit",minute:"2-digit",day:"numeric",month:"short"}):"";return`<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-radius:8px;border:1px solid;${r};font-size:0.8rem;">
        <span>${o} ${n.message}</span>
        <span style="font-family:var(--font-en);font-size:0.7rem;opacity:0.7;">${i}</span>
      </div>`}).join("")}
  </div>`}async function ae(e){try{const[t,a,s,n,r,o]=await Promise.all([h.sales.getInstances().catch(()=>[]),h.sales.getCompanies().catch(()=>[]),h.sales.getEliminationRules().catch(()=>[]),h.sales.getSyncStatus().catch(()=>[]),h.sales.getSchedule().catch(()=>({enabled:!1,intervalHours:2,running:!1})),h.sales.getNotifications().catch(()=>[])]);_.set("sales_companies",a||[]),za(e.querySelector("#instances-list"),t,e),qa(e.querySelector("#companies-list"),a,t,e),Ea(e.querySelector("#import-panel"),a),ja(e.querySelector("#rules-list"),s),Ta(e.querySelector("#sync-log"),n);const i=e.querySelector("#sync-enabled");if(i){i.checked=r.enabled;const l=e.querySelector("#sync-toggle-track"),c=e.querySelector("#sync-toggle-dot");r.enabled?(l.style.background="#06b6d4",c.style.right="2px"):(l.style.background="rgba(255,255,255,0.1)",c.style.right="22px")}const d=e.querySelector("#sync-interval");d&&(d.value=String(r.intervalHours)),yt(e,r),_a(e.querySelector("#sync-notifications-list"),o)}catch{b("خطأ في تحميل الإعدادات","error")}}function za(e,t,a){if(t.length===0){e.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:15px;font-size:0.85rem;">لا توجد اتصالات محفوظة — أضف اتصال من الخطوة 1</div>';return}e.innerHTML=`
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
  `,e.querySelectorAll(".btn-delete-instance").forEach(s=>{s.addEventListener("click",async()=>{const n=s.dataset.id;if(confirm("هل تريد حذف هذا الاتصال؟"))try{await h.sales.deleteInstance(n),b("تم حذف الاتصال","success"),await ae(a)}catch(r){b("خطأ: "+r.message,"error")}})})}function qa(e,t,a,s){if(t.length===0){e.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:0.85rem;">لا توجد شركات — أضف شركة جديدة</div>';return}const n={};for(const r of a)n[r.id]=r;e.innerHTML=`
    <div class="data-table-wrapper">
      <table class="data-table">
        <thead><tr><th>اسم الشركة</th><th>الخادم المربوط</th><th>Sales ID</th><th>عدد الفواتير</th><th>آخر فاتورة</th><th>الحالة</th><th>إجراء</th></tr></thead>
        <tbody>
          ${t.map(r=>{const o=n[r.sales_instance_id],i=a.map(d=>`<option value="${d.id}" ${d.id===r.sales_instance_id?"selected":""}>${d.name}</option>`).join("");return`
            <tr>
              <td>
                <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${r.color||"#3b82f6"};margin-left:8px;"></span>
                ${r.name}
              </td>
              <td>
                <select class="filter-select company-instance-select" data-company-id="${r.id}" style="font-size:0.78rem;padding:4px 8px;min-width:180px;">
                  ${i}
                </select>
                ${o?`<div style="font-family:var(--font-en);font-size:0.68rem;color:var(--text-muted);margin-top:2px;">${o.url} — ${o.username}</div>`:""}
              </td>
              <td style="font-family:var(--font-en);">${r.sales_company_id}</td>
              <td style="font-family:var(--font-en);font-weight:600;">${v(r.item_count||0)}</td>
              <td style="font-family:var(--font-en);font-size:0.8em;">${r.last_entry_date||"--"}</td>
              <td><span class="badge ${r.is_active?"badge-success":"badge-danger"}">${r.is_active?"نشط":"معطل"}</span></td>
              <td>
                <button class="btn btn-sm btn-delete-company" data-id="${r.id}" style="background:rgba(239,68,68,0.1);color:var(--accent-red);border:1px solid rgba(239,68,68,0.2);font-size:0.75rem;padding:3px 8px;">🗑️</button>
              </td>
            </tr>
          `}).join("")}
        </tbody>
      </table>
    </div>
  `,e.querySelectorAll(".company-instance-select").forEach(r=>{r.addEventListener("change",async()=>{const o=r.dataset.companyId,i=parseInt(r.value);try{await h.sales.updateCompany(o,{sales_instance_id:i}),b("تم تحديث الخادم المربوط ✅","success"),await ae(s)}catch(d){b("خطأ: "+d.message,"error")}})}),e.querySelectorAll(".btn-delete-company").forEach(r=>{r.addEventListener("click",async()=>{const o=r.dataset.id;if(confirm("هل أنت متأكد من حذف هذه الشركة وحذف جميع بيانات الفواتير المرتبطة بها نهائياً؟"))try{await h.sales.deleteCompany(o),b("تم حذف الشركة بنجاح","success"),await ae(s)}catch(i){b("خطأ: "+i.message,"error")}})})}function Ea(e,t){if(t.length===0){e.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:0.85rem;">أضف شركات أولاً ثم ابدأ الاستيراد</div>';return}e.innerHTML=t.map(a=>`
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
  `).join(""),e.querySelectorAll(".btn-import").forEach(a=>{a.addEventListener("click",async()=>{const s=parseInt(a.dataset.companyId);a.disabled=!0,a.textContent="⏳ جاري...";try{await h.sales.syncCompany(s),b("بدأت عملية الاستيراد","info"),bt(s)}catch(n){b("خطأ: "+n.message,"error"),a.disabled=!1,a.textContent="📥 استيراد"}})})}function bt(e){const t=document.getElementById(`progress-${e}`);t&&(t.style.display="block"),ce[e]&&clearInterval(ce[e]),ce[e]=setInterval(async()=>{try{const a=await h.sales.getSyncProgress(e);if(Ia(e,a),a.status==="completed"||a.status==="failed"){clearInterval(ce[e]),delete ce[e];const s=document.querySelector(`[data-company-id="${e}"]`);if(s&&(s.disabled=!1,s.textContent=a.status==="completed"?"✅ تم":"📥 إعادة الاستيراد"),a.status==="completed"){b(`تم استيراد ${v(a.inserted)} فاتورة بنجاح ✅`,"success");const n=await h.sales.getCompanies();_.set("sales_companies",n)}else b(`فشل الاستيراد: ${a.phase}`,"error")}}catch(a){console.error("Progress poll error:",a)}},1500)}async function La(e){let t=_.get("sales_companies");(!t||!Array.isArray(t))&&(t=await h.sales.getCompanies(),_.set("sales_companies",t));for(const a of t||[])bt(a.id)}function Ia(e,t){const a=document.getElementById(`progress-text-${e}`),s=document.getElementById(`progress-pct-${e}`),n=document.getElementById(`progress-bar-${e}`),r=document.getElementById(`progress-${e}`);if(!(!a||!s||!n)){if(r.style.display="block",a.textContent=t.phase||"",t.total>0){const o=Math.round(t.inserted/t.total*100);s.textContent=`${o}%`,n.style.width=`${o}%`}t.status==="completed"?(n.style.background="var(--accent-emerald)",n.style.width="100%",s.textContent="100%"):t.status==="failed"&&(n.style.background="var(--accent-red)")}}function ja(e,t){if(t.length===0){e.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:15px;font-size:0.85rem;">لا توجد قواعد استبعاد</div>';return}e.innerHTML=`
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
  `}function Ta(e,t){if(t.length===0){e.innerHTML='<div style="text-align:center;color:var(--text-muted);padding:15px;font-size:0.85rem;">لا يوجد سجل مزامنة بعد</div>';return}e.innerHTML=`
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
  `}function Ma(e){ge("إضافة شركة جديدة",`
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
  `),h.sales.getInstances().then(t=>{const a=document.getElementById("comp-instance");t.length===0?a.innerHTML="<option disabled>⚠️ أضف اتصال المبيعات أولاً</option>":a.innerHTML=t.map(s=>`<option value="${s.id}">${s.name} (${s.url})</option>`).join("")}),document.getElementById("btn-save-company").addEventListener("click",async()=>{const t=document.getElementById("comp-name").value,a=parseInt(document.getElementById("comp-sales-id").value),s=parseInt(document.getElementById("comp-instance").value);if(!t||!a){b("يرجى تعبئة الاسم ومعرف الشركة","warning");return}try{await h.sales.createCompany({name:t,sales_company_id:a,sales_instance_id:s,currency:document.getElementById("comp-currency").value||"SAR",color:document.getElementById("comp-color").value}),ye(),b("تم إضافة الشركة بنجاح ✅","success");const n=await h.sales.getCompanies();_.set("sales_companies",n),await ae(e)}catch(n){b("خطأ: "+n.message,"error")}})}function Ca(e){const t=_.get("sales_companies");ge("إضافة قاعدة استبعاد",`
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
  `),document.getElementById("btn-save-rule").addEventListener("click",async()=>{try{await h.sales.createEliminationRule({name:document.getElementById("rule-name").value,source_company_id:parseInt(document.getElementById("rule-source").value),target_company_id:parseInt(document.getElementById("rule-target").value),source_account_code:document.getElementById("rule-src-acc").value,target_account_code:document.getElementById("rule-tgt-acc").value}),ye(),b("تم إضافة القاعدة بنجاح ✅","success"),await ae(e)}catch(a){b("خطأ: "+a.message,"error")}})}let B=0;const $e=50;let Oe=[],oe="date",ue="DESC";const Je=[{key:"company_name",label:"الشركة",type:"text",default:!0},{key:"date",label:"التاريخ",type:"date",default:!0},{key:"name",label:"رقم الفاتورة",type:"code",default:!0},{key:"partner_name",label:"العميل",type:"text",default:!0},{key:"state",label:"الحالة",type:"badge",default:!0},{key:"amount_total",label:"المبلغ الإجمالي",type:"money",default:!0},{key:"journal_name",label:"اسم اليومية",type:"text",default:!1,isRaw:!0},{key:"payment_status",label:"حالة الدفع",type:"badge",default:!1,isRaw:!0},{key:"move_type",label:"نوع الحركة",type:"text",default:!1,isRaw:!0},{key:"amount_untaxed",label:"المبلغ (قبل الضريبة)",type:"money",default:!1,isRaw:!0},{key:"amount_tax_signed",label:"الضريبة",type:"money",default:!1,isRaw:!0},{key:"total_paid",label:"إجمالي المدفوع",type:"money",default:!1,isRaw:!0},{key:"amount_residual",label:"المبلغ المتبقي",type:"residual",default:!1},{key:"reference",label:"المرجع",type:"text",default:!1,isRaw:!0},{key:"created_at",label:"تاريخ المزامنة",type:"date",default:!0},{key:"raw_data",label:"البيانات الخام",type:"actions",default:!0}];let N=[];try{const e=localStorage.getItem("sales_preview_cols");e&&(N=JSON.parse(e))}catch{}(!N||N.length===0)&&(N=Je.filter(e=>e.default).map(e=>e.key));async function Aa(e){let t=_.get("sales_companies");if(!t||t.length===0)try{t=await h.sales.getCompanies(),_.set("sales_companies",t)}catch{t=[]}e.innerHTML=`
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
            ${t.map(r=>`<option value="${r.id}">${r.name}</option>`).join("")}
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
           ${Je.map(r=>`
             <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer;font-size:0.8rem;color:var(--text-primary);">
               <input type="checkbox" class="col-toggle" value="${r.key}" ${N.includes(r.key)?"checked":""}>
               ${r.label}
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
  `,e.querySelector("#dp-apply").addEventListener("click",()=>{B=0,Q(e)}),e.querySelector("#dp-reset").addEventListener("click",()=>{e.querySelector("#dp-search").value="",e.querySelector("#dp-company").value="",e.querySelector("#dp-state").value="",e.querySelector("#dp-datefrom").value="",e.querySelector("#dp-dateto").value="",B=0,Q(e)}),e.querySelector("#dp-prev").addEventListener("click",()=>{B>0&&(B--,Q(e))}),e.querySelector("#dp-next").addEventListener("click",()=>{B++,Q(e)}),e.querySelector("#dp-search").addEventListener("keydown",r=>{r.key==="Enter"&&(B=0,Q(e))});const a=e.querySelector("#btn-col-chooser"),s=e.querySelector("#col-chooser-dropdown");a.addEventListener("click",r=>{r.stopPropagation(),s.style.display=s.style.display==="none"?"block":"none"}),document.addEventListener("click",r=>{e.querySelector("#col-chooser-container").contains(r.target)||(s.style.display="none")});const n=e.querySelectorAll(".col-toggle");n.forEach(r=>{r.addEventListener("change",()=>{N=Array.from(n).filter(o=>o.checked).map(o=>o.value),N.length===0&&(N=["name","company_name"],n.forEach(o=>{N.includes(o.value)&&(o.checked=!0)})),localStorage.setItem("sales_preview_cols",JSON.stringify(N)),vt(e.querySelector("#dp-table-wrapper"),Oe)})}),B=0,await Q(e)}async function Q(e){const t=e.querySelector("#dp-search").value.trim(),a=e.querySelector("#dp-company").value,s=e.querySelector("#dp-state").value,n=e.querySelector("#dp-datefrom").value,r=e.querySelector("#dp-dateto").value,o={limit:$e,offset:B*$e,orderBy:oe,orderDir:ue};t&&(o.search=t),a&&(o.companyIds=a),s&&(o.state=s),n&&(o.dateFrom=n),r&&(o.dateTo=r);try{const i=await h.sales.getInvoices(o);if(i.states&&i.states.length>0){const m=e.querySelector("#dp-state"),u=m.value;m.options.length<=1&&(i.states.forEach(y=>{const g=document.createElement("option");g.value=y,g.textContent=y,m.appendChild(g)}),u&&(m.value=u))}const d=i.totals||{amount_total:0,amount_untaxed:0,total_paid:0},l=d.total_paid-d.amount_total;e.querySelector("#dp-summary-cards").innerHTML=`
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
          <div style="font-weight:700;font-size:1.25rem;font-family:var(--font-en);color:var(--text-primary);">${v(l,2)} ر.س</div>
        </div>
      </div>
    `;const c=Math.ceil(i.total/$e);e.querySelector("#dp-prev").disabled=B===0,e.querySelector("#dp-next").disabled=B+1>=c,e.querySelector("#dp-page-info").textContent=`صفحة ${B+1} من ${c||1}`,Oe=i.items,vt(e.querySelector("#dp-table-wrapper"),Oe)}catch(i){e.querySelector("#dp-table-wrapper").innerHTML=`<div style="padding:20px;color:var(--accent-red);">خطأ: ${i.message}</div>`,e.querySelector("#dp-summary-cards").innerHTML='<div style="text-align:center;padding:20px;color:var(--accent-red);">فشل تحميل ملخص البيانات</div>'}}function vt(e,t){if(!t||t.length===0){e.innerHTML='<div style="text-align:center;padding:40px;color:var(--text-muted);">لا توجد بيانات</div>';return}const a=Je.filter(n=>N.includes(n.key));e.innerHTML=`
    <table class="data-table" style="font-size:0.78rem;width:100%;">
      <thead>
        <tr>
          <th style="position:sticky;top:0;z-index:2;font-size:0.7rem;white-space:nowrap;width:30px;">#</th>
          ${a.map(n=>{const r=n.key!=="actions"&&n.key!=="raw_data";let o='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 15l5 5 5-5M7 9l5-5 5 5"/></svg>';return oe===n.key&&(o=ue==="ASC"?'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 15l7-7 7 7"/></svg>':'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 9l-7 7-7-7"/></svg>'),`
               <th style="position:sticky;top:0;z-index:2;font-size:0.75rem;white-space:nowrap;cursor:${r?"pointer":"default"};background:var(--surface-color);"
                   ${r?`class="sort-header hover-bg" data-key="${n.key}"`:""}>
                 <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 4px;">
                   <span>${n.label}</span>
                   ${r?`<span class="sort-icon" style="color:${oe===n.key?"var(--accent-blue)":"var(--text-muted)"}; opacity:${oe===n.key?"1":"0.4"}; display:flex; align-items:center;">${o}</span>`:""}
                 </div>
               </th>
             `}).join("")}
        </tr>
      </thead>
      <tbody>
        ${t.map((n,r)=>`
          <tr>
            <td style="font-family:var(--font-en);color:var(--text-muted);font-size:0.7rem;">${B*$e+r+1}</td>
            ${a.map(o=>Ha(n,o,r)).join("")}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `,e.querySelectorAll(".btn-view-raw").forEach(n=>{n.addEventListener("click",r=>{const o=r.currentTarget.getAttribute("data-idx"),i=t[o];alert(`البيانات الخام للفاتورة:

`+(i.raw_data?JSON.stringify(JSON.parse(i.raw_data),null,2):"لا توجد بيانات خام"))})}),e.querySelectorAll(".sort-header").forEach(n=>{n.addEventListener("click",r=>{const o=r.currentTarget.closest(".sort-header").getAttribute("data-key");oe===o?ue=ue==="ASC"?"DESC":"ASC":(oe=o,ue="DESC"),B=0;const i=e.parentElement.parentElement;i&&Q(i)})})}function Ha(e,t,a){let s=e[t.key];if(t.isRaw)try{s=(e.raw_data?JSON.parse(e.raw_data):{})[t.key]}catch{s=""}switch(t.type){case"residual":{let d=0;try{const u=e.raw_data?JSON.parse(e.raw_data):{};d=parseFloat(u.total_paid)||0}catch{}const l=parseFloat(e.amount_total)||0,c=d-l;return!c||c===0?'<td style="font-family:var(--font-en);color:var(--text-muted);">0</td>':`<td style="font-family:var(--font-en);font-weight:500;color:${c<0?"var(--accent-red)":"var(--text-primary)"};">${v(c,2)}</td>`}case"money":return!s||s===0?'<td style="font-family:var(--font-en);color:var(--text-muted);">0</td>':`<td style="font-family:var(--font-en);font-weight:500;color:${s<0?"var(--accent-red)":"var(--text-primary)"};">${v(s,2)}</td>`;case"date":return`<td style="font-family:var(--font-en);font-size:0.75rem;white-space:nowrap;">${s?s.split(" ")[0]:""}</td>`;case"code":return`<td style="font-family:var(--font-en);font-size:0.75rem;color:var(--accent-blue);font-weight:600;">${s||""}</td>`;case"badge":if(!s)return"<td></td>";const r=s==="posted";return`<td><span style="background:${r?"rgba(16,185,129,0.15)":"rgba(245,158,11,0.15)"};color:${r?"var(--accent-green)":"var(--accent-orange)"};padding:2px 6px;border-radius:4px;font-size:0.68rem;white-space:nowrap;">${s}</span></td>`;case"actions":return`<td>
         <button class="btn btn-secondary btn-sm btn-view-raw" data-idx="${a}" style="padding:4px 8px;font-size:0.7rem;">
           عرض JSON
         </button>
      </td>`;default:return`<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${(s||"").toString().replace(/"/g,"&quot;")}">${s||""}</td>`}}async function Ba(e){e.innerHTML='<div class="bi-empty">جاري تحميل مصمم التقرير الضريبي...</div>';try{let g=function(x,p,$,S,q){x.innerHTML="",p.forEach(k=>{const L=$(k),j=document.createElement("option");j.value=L,j.innerText=S(k),q&&q.includes(L)&&(j.selected=!0),x.appendChild(j)})},f=function(x){return x?Array.from(x.selectedOptions||[]).map(p=>p.value):[]},E=function(x){var I;if(!x||!x.periods||x.periods.length===0){u.innerHTML='<div class="bi-empty">لا توجد حركات ضريبية مطابقة لهذه الإعدادات.</div>';return}const p=x.summary,$=p.totalNet>=0?"#ef4444":"#10b981",S=p.totalNet>=0?"مستحقة للهيئة":"مستردة",q=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"],k={Q1:"الربع الأول",Q2:"الربع الثاني",Q3:"الربع الثالث",Q4:"الربع الرابع"};function L(z){return z.includes("-Q")?k[z.split("-")[1]]||z:z.length===7&&q[parseInt(z.split("-")[1])-1]||z}const T=x.periods.flatMap(z=>(z.items||[]).map(M=>({...M,periodKey:z.period}))).map(z=>{const M=z.type==="input"?'<span style="color:#10b981;">مشتريات</span>':'<span style="color:#ef4444;">مبيعات</span>',F=z.refundAmount>0?'<span style="color:#f59e0b; font-size:0.75rem; background:rgba(245, 158, 11, 0.1); padding:2px 4px; border-radius:4px; margin-right:6px;">مرتجع</span>':"",C=z.type==="input"?"#10b981":"#ef4444";return`
          <tr class="vat-detail-row-custom" data-period="${z.periodKey}" style="display:none;background:rgba(255,255,255,0.02);">
            <td>${z.date}</td>
            <td style="font-size:0.9rem;">${z.company.length>25?z.company.substring(0,25)+"…":z.company}</td>
            <td>${M} ${F}</td>
            <td style="font-size:0.85rem;color:rgba(255,255,255,0.6);">${z.journalEntry}</td>
            <td style="font-size:0.85rem;">${z.label} ${z.partner?'<br><span style="color:#3b82f6;">'+z.partner+"</span>":""}</td>
            <td class="n" style="color:${C};font-weight:600;">${w(Math.abs(z.netAmount))}</td>
          </tr>
        `}).join("");u.innerHTML=`
        <!-- KPI Cards -->
        <div class="bi-kpi-row" style="margin-bottom:24px;">
          <div class="bi-kpi">
            <div class="bi-kpi-label">المبيعات الإجمالية</div>
            <div class="bi-kpi-value" style="color:#ef4444;">${w(p.totalOutputBase)}</div>
            <div class="bi-kpi-sub" style="color:#ef4444;">يخصم منها مرتجعات: ${w(p.totalOutputRefund)}</div>
          </div>
          <div class="bi-kpi">
            <div class="bi-kpi-label">المشتريات الإجمالية</div>
            <div class="bi-kpi-value" style="color:#10b981;">${w(p.totalInputBase)}</div>
            <div class="bi-kpi-sub" style="color:#10b981;">يخصم منها مرتجعات: ${w(p.totalInputRefund)}</div>
          </div>
          <div class="bi-kpi">
            <div class="bi-kpi-label">صافي الإقرار</div>
            <div class="bi-kpi-value" style="color:${$};">${w(Math.abs(p.totalNet))}</div>
            <div class="bi-kpi-sub" style="color:${$};">${S}</div>
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
                ${x.periods.map(z=>{const M=z.netVAT>=0?"#ef4444":"#10b981",A=z.netVAT>=0?"مستحقة":"مستردة";return`<tr>
                    <td style="font-weight:700;">${L(z.period)}</td>
                    <td class="n" style="color:rgba(239, 68, 68, 0.7);">${w(z.outputBase)}</td>
                    <td class="n" style="color:rgba(239, 68, 68, 0.5);">${w(z.outputRefund)}</td>
                    <td class="n" style="color:#ef4444;font-weight:700">${w(z.outputVAT)}</td>
                    <td class="n" style="color:rgba(16, 185, 129, 0.7);">${w(z.inputBase)}</td>
                    <td class="n" style="color:rgba(16, 185, 129, 0.5);">${w(z.inputRefund)}</td>
                    <td class="n" style="color:#10b981;font-weight:700">${w(z.inputVAT)}</td>
                    <td class="n" style="color:${M};font-weight:800;">${w(Math.abs(z.netVAT))} <span style="font-size:0.75rem;font-weight:normal;">(${A})</span></td>
                    <td><button class="btn btn-show-details-custom" data-period="${z.period}" style="font-size:0.8rem;padding:6px 12px;background:rgba(59,130,246,0.15);color:#60a5fa;border:1px solid rgba(59,130,246,0.3);border-radius:6px;cursor:pointer;">عرض القيود</button></td>
                  </tr>`}).join("")}
              </tbody>
              <tfoot>
                <tr style="background:rgba(255,255,255,0.05);">
                  <td style="font-weight:800;">الإجمالي</td>
                  <td class="n" style="color:rgba(239, 68, 68, 0.7);">${w(p.totalOutputBase)}</td>
                  <td class="n" style="color:rgba(239, 68, 68, 0.5);">${w(p.totalOutputRefund)}</td>
                  <td class="n" style="color:#ef4444;font-weight:700">${w(p.totalOutput)}</td>
                  <td class="n" style="color:rgba(16, 185, 129, 0.7);">${w(p.totalInputBase)}</td>
                  <td class="n" style="color:rgba(16, 185, 129, 0.5);">${w(p.totalInputRefund)}</td>
                  <td class="n" style="color:#10b981;font-weight:700">${w(p.totalInput)}</td>
                  <td class="n" style="color:${$};font-weight:800;">${w(Math.abs(p.totalNet))}</td>
                  <td style="color:${$};">${S}</td>
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
      `,u.querySelectorAll(".btn-show-details-custom").forEach(z=>{z.addEventListener("click",()=>{const M=z.dataset.period;u.querySelector("#custom-details-period-label").innerText=L(M),u.querySelector("#custom-details-container").style.display="block";let A=!1;u.querySelectorAll(".vat-detail-row-custom").forEach(F=>{F.dataset.period===M?(F.style.display="table-row",A=!0):F.style.display="none"}),u.querySelector("#custom-details-empty").style.display=A?"none":"table-row-group"})}),(I=u.querySelector("#custom-details-close"))==null||I.addEventListener("click",()=>{u.querySelector("#custom-details-container").style.display="none"})};const t=await h.getCompanies();if(!t||t.length===0){e.innerHTML='<div class="bi-empty">لم يتم العثور على شركات.</div>';return}let a=t[0].id,s=new Date().getFullYear().toString(),n="monthly",r={vatAccounts:[],journals:[],moveNames:[]},o={inputAccounts:[],outputAccounts:[],excludedJournals:[],excludedMoveNames:[]};e.innerHTML=`
      <div class="bi-header">
        <h1 class="bi-title">مصمم التقرير الضريبي</h1>
        <div class="bi-actions">
          <select id="builder-co-select" class="bi-input">
            ${t.map(x=>`<option value="${x.id}">${x.name}</option>`).join("")}
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
    `;const i=document.getElementById("builder-co-select"),d=document.getElementById("builder-year-select"),l=document.getElementById("builder-period-select"),c=document.getElementById("builder-input-accs"),m=document.getElementById("builder-output-accs"),u=document.getElementById("builder-results");async function y(){try{const x=await h.getTaxReportConfig(a);r=x.options,o=x.config,g(document.getElementById("builder-input-accs"),r.vatAccounts,p=>p.account_name,p=>`${p.account_code} - ${p.account_name}`,o.inputAccounts),g(document.getElementById("builder-output-accs"),r.vatAccounts,p=>p.account_name,p=>`${p.account_code} - ${p.account_name}`,o.outputAccounts)}catch(x){console.error(x),alert("خطأ في تحميل الإعدادات: "+x.message)}}document.getElementById("btn-save-config").addEventListener("click",async()=>{const x={companyId:a,inputAccounts:f(document.getElementById("builder-input-accs")),outputAccounts:f(document.getElementById("builder-output-accs"))};try{(await h.saveTaxReportConfig(x)).success&&alert("تم حفظ الإعدادات بنجاح!")}catch(p){alert("خطأ أثناء الحفظ: "+p.message)}}),document.getElementById("btn-run-report").addEventListener("click",async()=>{u.innerHTML='<div class="bi-empty">جاري بناء التقرير...</div>';const x={companyId:a,year:d.value,period:l.value,inputAccounts:f(document.getElementById("builder-input-accs")),outputAccounts:f(document.getElementById("builder-output-accs"))};try{const p=await h.generateCustomTaxReport(x);E(p)}catch(p){u.innerHTML=`<div class="bi-empty" style="color:#ef4444;">خطأ: ${p.message}</div>`}});const w=x=>new Intl.NumberFormat("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}).format(x||0);i.addEventListener("change",()=>{a=i.value,y()}),d.addEventListener("change",()=>{s=d.value}),l.addEventListener("change",()=>{n=l.value}),document.getElementById("btn-load-config").addEventListener("click",y),y()}catch(t){console.error("Builder init error:",t),e.innerHTML=`<div class="bi-empty" style="color:#ef4444">خطأ في التهيئة: ${t.message}</div>`}}const je={dashboard:St,"income-statement":qt,"balance-sheet":Lt,"cash-flow":jt,pivot:Mt,"journal-items":Ht,mapping:Pt,"journal-mapping":va,settings:Nt,"data-preview":ea,"trial-balance":sa,"detailed-trial-balance":ra,"closing-entries":pa,"analytic-accounts":ma,presentation:wt,"account-statement":ha,guarantees:$t,"api-manager":ka,"sales-settings":Sa,"sales-data-preview":Aa,"tax-builder":Ba};let fe=!1,ft=null;async function tt(e){const t=document.getElementById("main-content");if(window.isViewerMode()&&e!=="presentation"){console.warn(`[RouteGuard] Viewer is restricted to presentation. Blocked: ${e}`),e="presentation",_.set("currentPage","presentation");const n=new URL(window.location);n.searchParams.get("page")!=="presentation"&&(n.searchParams.set("page","presentation"),window.history.replaceState({},"",n))}if(fe)return;fe=!0,ft=e;let s=je[e];if(e==="special-expenses"&&!s){const n=await Xe(()=>import("./special-expenses-CpRC9VGw.js"),__vite__mapDeps([0,1,2]));je["special-expenses"]=n.renderSpecialExpenses,s=n.renderSpecialExpenses}if(e==="viewers-management"&&!s){const n=await Xe(()=>import("./viewers-management-Bhvvjr8z.js"),__vite__mapDeps([3,1,2]));je["viewers-management"]=n.renderViewersManagement,s=n.renderViewersManagement}if(s){t.innerHTML='<div style="display:flex;align-items:center;justify-content:center;min-height:60vh;"><div class="spinner"></div></div>';try{await s(t)}catch(n){console.error(`Error rendering ${e}:`,n),t.innerHTML=`
        <div style="text-align:center;padding:60px;">
          <div style="font-size:2rem;margin-bottom:16px;">⚠️</div>
          <h2 style="color:var(--text-white);margin-bottom:8px;">حدث خطأ</h2>
          <p style="color:var(--text-muted);">${n.message}</p>
          <button class="btn btn-primary" style="margin-top:16px;" onclick="location.reload()">إعادة المحاولة</button>
        </div>
      `}finally{fe=!1}}else fe=!1;ot()}window.mizaniatLogout=function(){localStorage.removeItem("mizaniat_admin_token"),localStorage.removeItem("mizaniat_admin_info"),localStorage.removeItem("mizaniat_viewer_mode"),localStorage.removeItem("mizaniat_viewer_token"),sessionStorage.removeItem("mizaniat_viewer_token"),localStorage.removeItem("mizaniat_viewer_info"),window.location.href="/login.html"};window.isViewerMode=()=>!localStorage.getItem("mizaniat_admin_token")&&localStorage.getItem("mizaniat_viewer_mode")==="true";async function Pa(){const e=window.isViewerMode();if(e){const t=localStorage.getItem("mizaniat_viewer_token")||sessionStorage.getItem("mizaniat_viewer_token");if(!t){window.location.href="/login.html";return}try{if(!(await fetch("/api/auth/viewer/verify",{headers:{"x-viewer-token":t}})).ok){window.mizaniatLogout();return}}catch{}}else{const t=localStorage.getItem("mizaniat_admin_token");if(!t){window.location.href="/login.html";return}try{if(!(await fetch("/api/auth/admin/me",{headers:{Authorization:`Bearer ${t}`}})).ok){window.mizaniatLogout();return}}catch{}}console.log(e?"👁️ Mizaniat BI Viewer mode":"🚀 Mizaniat BI initializing...");try{const t=await h.getCompanies();_.set("companies",t),await kt(),ot();let s=new URLSearchParams(window.location.search).get("page")||(e?"presentation":"dashboard");if(e&&s!=="presentation"){s="presentation";const n=new URL(window.location);n.searchParams.set("page","presentation"),window.history.replaceState({},"",n)}_.set("currentPage",s),_.subscribe(n=>{if(n==="currentPage"){const r=_.get("currentPage");r!==ft&&tt(r)}}),await tt(s),console.log("✅ Mizaniat BI ready")}catch(t){console.error("Init error:",t),document.getElementById("main-content").innerHTML=`
      <div style="text-align:center;padding:80px;">
        <div style="font-size:3rem;margin-bottom:24px;">📊</div>
        <h1 style="color:var(--text-white);margin-bottom:12px;">تقارير مالية</h1>
        <p style="color:var(--text-muted);margin-bottom:24px;">تعذر الاتصال بالخادم.</p>
        <button class="btn btn-primary" onclick="location.reload()">إعادة المحاولة</button>
      </div>
    `}}Pa();
