(function(){const s=document.createElement("link").relList;if(s&&s.supports&&s.supports("modulepreload"))return;for(const e of document.querySelectorAll('link[rel="modulepreload"]'))r(e);new MutationObserver(e=>{for(const a of e)if(a.type==="childList")for(const i of a.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&r(i)}).observe(document,{childList:!0,subtree:!0});function l(e){const a={};return e.integrity&&(a.integrity=e.integrity),e.referrerPolicy&&(a.referrerPolicy=e.referrerPolicy),e.crossOrigin==="use-credentials"?a.credentials="include":e.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function r(e){if(e.ep)return;e.ep=!0;const a=l(e);fetch(e.href,a)}})();const Gt="modulepreload",Yt=function(t){return"/"+t},At={},$e=function(s,l,r){let e=Promise.resolve();if(l&&l.length>0){document.getElementsByTagName("link");const i=document.querySelector("meta[property=csp-nonce]"),b=(i==null?void 0:i.nonce)||(i==null?void 0:i.getAttribute("nonce"));e=Promise.allSettled(l.map(c=>{if(c=Yt(c),c in At)return;At[c]=!0;const h=c.endsWith(".css"),f=h?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${c}"]${f}`))return;const w=document.createElement("link");if(w.rel=h?"stylesheet":Gt,h||(w.as="script"),w.crossOrigin="",w.href=c,b&&w.setAttribute("nonce",b),document.head.appendChild(w),h)return new Promise((S,d)=>{w.addEventListener("load",S),w.addEventListener("error",()=>d(new Error(`Unable to preload CSS for ${c}`)))})}))}function a(i){const b=new Event("vite:preloadError",{cancelable:!0});if(b.payload=i,window.dispatchEvent(b),!b.defaultPrevented)throw i}return e.then(i=>{for(const b of i||[])b.status==="rejected"&&a(b.reason);return s().catch(a)})};class Ut{constructor(){this.state={currentPage:"dashboard",companies:[],selectedCompanyIds:[],dateFrom:"",dateTo:"",costCenter:"",accountType:"",fiscalYear:"",filterOptions:{periods:[],fiscalYears:[],accountTypes:[],costCenters:[]},sidebarCollapsed:!1,loading:!1},this.listeners=[]}get(s){return this.state[s]}set(s,l){this.state[s]=l,this.notify(s)}update(s){Object.assign(this.state,s),Object.keys(s).forEach(l=>this.notify(l))}subscribe(s){return this.listeners.push(s),()=>{this.listeners=this.listeners.filter(l=>l!==s)}}notify(s){this.listeners.forEach(l=>l(s,this.state[s],this.state))}getFilterParams(){const s={};return this.state.selectedCompanyIds.length>0&&(s.companyIds=this.state.selectedCompanyIds),this.state.dateFrom&&(s.dateFrom=this.state.dateFrom),this.state.dateTo&&(s.dateTo=this.state.dateTo),this.state.costCenter&&(s.costCenter=this.state.costCenter),this.state.accountType&&(s.accountType=this.state.accountType),this.state.fiscalYear&&(s.fiscalYear=this.state.fiscalYear),s}}const kt=new Ut,Jt="/api";async function x(t,s={}){const l=`${Jt}${t}`,r={headers:{"Content-Type":"application/json"},...s},e=localStorage.getItem("mizaniat_admin_token");e&&(r.headers={...r.headers,Authorization:`Bearer ${e}`}),r.body&&typeof r.body=="object"&&(r.body=JSON.stringify(r.body));const a=await fetch(l,r);if(a.status===401)throw localStorage.removeItem("mizaniat_admin_token"),localStorage.removeItem("mizaniat_admin_info"),localStorage.removeItem("mizaniat_viewer_mode"),window.location.href="/login.html",new Error("جلسة غير صالحة");if(!a.ok){const i=await a.json().catch(()=>({error:a.statusText}));throw new Error(i.error||i.message||`HTTP ${a.status}`)}return a.json()}const ct={getCompanies:()=>x("/companies"),createCompany:t=>x("/companies",{method:"POST",body:t}),updateCompany:(t,s)=>x(`/companies/${t}`,{method:"PUT",body:s}),getInstances:()=>x("/instances"),createInstance:t=>x("/instances",{method:"POST",body:t}),updateInstance:(t,s)=>x(`/instances/${t}`,{method:"PUT",body:s}),deleteInstance:t=>x(`/instances/${t}`,{method:"DELETE"}),testInstance:(t,s)=>x(`/instances/${t}/test`,{method:"POST",body:{company_id:s}}),getDashboard:t=>x(`/reports/dashboard?${U(t)}`),getIncomeStatement:t=>x(`/reports/income-statement?${U(t)}`),getBalanceSheet:t=>x(`/reports/balance-sheet?${U(t)}`),getCashFlow:t=>x(`/reports/cash-flow?${U(t)}`),getPivotData:t=>x(`/reports/pivot?${U(t)}`),getTrialBalance:t=>x(`/reports/trial-balance?${U(t)}`),getDetailedTrialBalance:t=>x(`/reports/detailed-trial-balance?${U(t)}`),getPartnerAccountConfig:t=>x(`/partner-account-config?${U(t)}`),savePartnerAccountConfig:t=>x("/partner-account-config",{method:"POST",body:t}),getAnalyticGroups:()=>x("/analytic-groups"),createAnalyticGroup:t=>x("/analytic-groups",{method:"POST",body:t}),updateAnalyticGroup:(t,s)=>x(`/analytic-groups/${t}`,{method:"PUT",body:s}),deleteAnalyticGroup:t=>x(`/analytic-groups/${t}`,{method:"DELETE"}),getAnalyticAccounts:t=>x(`/analytic-accounts?${U(t)}`),getAnalyticGroupMappings:t=>x(`/analytic-group-mappings?${U(t)}`),saveAnalyticGroupMappings:t=>x("/analytic-group-mappings",{method:"POST",body:t}),getCompanyJournalNames:t=>x(`/company-journal-names?companyId=${t}`),getJournalMappings:t=>x(`/journal-mappings?companyId=${t}`),mergeJournals:t=>x("/journal-mappings/merge",{method:"POST",body:t}),getVATReport:t=>x(`/vat-report?${U(t)}`),getTaxReportConfig:t=>x(`/tax-report-config/${t}`),saveTaxReportConfig:t=>x("/tax-report-config",{method:"POST",body:t}),generateCustomTaxReport:t=>x("/tax-report-custom",{method:"POST",body:t}),getPresentationData:t=>x(`/presentation/data?${U(t)}`),getPresentationShares:()=>x("/presentation/shares"),createPresentationShare:t=>x("/presentation/share",{method:"POST",body:t}),getPresentationShareData:t=>x(`/presentation/share/${t}`),deletePresentationShare:t=>x(`/presentation/share/${t}`,{method:"DELETE"}),createClosingEntry:t=>x("/closing-entry",{method:"POST",body:t}),getClosingEntries:t=>x(`/closing-entries?${U(t)}`),deleteClosingEntry:t=>x(`/closing-entry?${U(t)}`,{method:"DELETE"}),getCompanyAccounts:t=>x(`/company-accounts?${U(t)}`),getFilterOptions:t=>x(`/filters?${U(t)}`),getCompanyAccounts:t=>x(`/accounts/company/${t}`),getUnifiedAccounts:()=>x("/accounts/unified"),createUnifiedAccount:t=>x("/accounts/unified",{method:"POST",body:t}),createMapping:t=>x("/accounts/mapping",{method:"POST",body:t}),getEliminationRules:()=>x("/eliminations"),createEliminationRule:t=>x("/eliminations",{method:"POST",body:t}),syncCompany:t=>x(`/sync/company/${t}`,{method:"POST"}),syncAll:()=>x("/sync/all",{method:"POST"}),getSyncStatus:()=>x("/sync/status"),getSyncProgress:t=>x(`/sync/progress/${t}`),getSchedule:()=>x("/sync/schedule"),updateSchedule:t=>x("/sync/schedule",{method:"PUT",body:t}),getNotifications:()=>x("/sync/notifications"),clearNotifications:()=>x("/sync/notifications",{method:"DELETE"}),testConnectionDirect:t=>x("/test-connection",{method:"POST",body:t}),getJournalItems:t=>x(`/journal-items?${U(t)}`),getAccountStatement:t=>x(`/account-statement?${U(t)}`),getAccountStatementAccounts:t=>x(`/account-statement/accounts?${U(t)}`),getAccountStatementPartners:t=>x(`/account-statement/partners?${U(t)}`),getGuaranteeDetails:t=>x(`/guarantee-details?${U(t)}`),getGuaranteePendingList:t=>x(`/guarantee-pending-list?${U(t)}`),getGuarantees:t=>x(`/guarantees?${U(t)}`),releaseGuarantee:t=>x("/guarantees/release",{method:"POST",body:t}),unreleaseGuarantee:t=>x(`/guarantees/release?${U(t)}`,{method:"DELETE"}),getGuaranteeSubItems:t=>x(`/guarantee-sub-items?${U(t)}`),addGuaranteeSubItem:t=>x("/guarantee-sub-items",{method:"POST",body:t}),deleteGuaranteeSubItem:t=>x(`/guarantee-sub-items/${t}`,{method:"DELETE"}),sales:{getCompanies:()=>x("/sales/companies"),createCompany:t=>x("/sales/companies",{method:"POST",body:t}),updateCompany:(t,s)=>x(`/sales/companies/${t}`,{method:"PUT",body:s}),deleteCompany:t=>x(`/sales/companies/${t}`,{method:"DELETE"}),getInstances:()=>x("/sales/instances"),createInstance:t=>x("/sales/instances",{method:"POST",body:t}),updateInstance:(t,s)=>x(`/sales/instances/${t}`,{method:"PUT",body:s}),deleteInstance:t=>x(`/sales/instances/${t}`,{method:"DELETE"}),testInstance:(t,s)=>x(`/sales/instances/${t}/test`,{method:"POST",body:{company_id:s}}),testConnectionDirect:t=>x("/sales/test-connection",{method:"POST",body:t}),getEliminationRules:()=>x("/sales/eliminations"),createEliminationRule:t=>x("/sales/eliminations",{method:"POST",body:t}),syncCompany:t=>x(`/sales/sync/company/${t}`,{method:"POST"}),syncAll:()=>x("/sales/sync/all",{method:"POST"}),getSyncStatus:()=>x("/sales/sync/status"),getSyncProgress:t=>x(`/sales/sync/progress/${t}`),getSchedule:()=>x("/sales/settings/schedule"),updateSchedule:t=>x("/sales/settings/schedule",{method:"POST",body:t}),getNotifications:()=>x("/sales/notifications"),clearNotifications:()=>x("/sales/notifications/clear",{method:"POST"}),getInvoices:t=>x("/sales/invoices?"+U(t)),getCustomerHierarchy:t=>x("/sales/customer-hierarchy?"+U(t))}};function U(t){if(!t)return"";const s=[];for(const[l,r]of Object.entries(t))r!=null&&r!==""&&(Array.isArray(r)?s.push(`${l}=${r.join(",")}`):s.push(`${l}=${encodeURIComponent(r)}`));return s.join("&")}function Dt(t,s=0){return t==null||isNaN(t)?"0":Number(t).toLocaleString("en-US",{minimumFractionDigits:s,maximumFractionDigits:s})}function we(t){const s=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],l=parseInt(t)-1;return s[l]||t}function yt(t,s="info",l=4e3){const r=document.getElementById("toast-container"),e=document.createElement("div");e.className=`toast toast-${s}`;const a={success:"✓",error:"✕",info:"ℹ",warning:"⚠"};e.innerHTML=`<span>${a[s]||""}</span><span>${t}</span>`,r.appendChild(e),setTimeout(()=>{e.style.opacity="0",e.style.transform="translateX(-20px)",setTimeout(()=>e.remove(),300)},l)}function ke(t,s){const l=document.getElementById("modal-overlay"),r=document.getElementById("modal-content");r.innerHTML=`
    <div class="modal-header">
      <h3 class="modal-title">${t}</h3>
      <button class="modal-close" onclick="document.getElementById('modal-overlay').classList.remove('active')">✕</button>
    </div>
    <div class="modal-body">${s}</div>
  `,l.classList.add("active"),l.onclick=e=>{e.target===l&&l.classList.remove("active")}}function Ee(){document.getElementById("modal-overlay").classList.remove("active")}const Q=["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#06b6d4","#84cc16"],lt=["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6"],o=t=>Dt(t,0),B=t=>(t||0).toFixed(1)+"%",St=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];let Z=null,Bt="overview",vt=[],gt={},ut={},It=null;function Wt(t){if(!t)return"";const s=l=>String(l).padStart(2,"0");return`${t.getFullYear()}-${s(t.getMonth()+1)}-${s(t.getDate())} ${s(t.getHours())}:${s(t.getMinutes())}:${s(t.getSeconds())}`}async function Se(t){var b,c,h,f,w,S,d,y,m,v;const s=kt.get("companies")||[],l=((b=kt.get("filterOptions"))==null?void 0:b.fiscalYears)||[],r=kt.get("fiscalYear")||l[l.length-1]||"";t.innerHTML=`
    <style>
      .bi-page{min-height:100vh;padding:0;direction:rtl}
      /* Top bar with slicers */
      .bi-topbar{display:flex;align-items:center;gap:16px;padding:16px 28px;background:linear-gradient(180deg,rgba(15,23,42,0.95),rgba(15,23,42,0.85));border-bottom:1px solid rgba(255,255,255,0.06);flex-wrap:wrap;position:sticky;top:0;z-index:50;backdrop-filter:blur(12px)}
      .bi-topbar .slicer-group{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
      .bi-topbar .slicer-label{font-size:0.95rem;color:rgba(255,255,255,0.55);font-weight:700;white-space:nowrap}
      .bi-chip{padding:9px 20px;border-radius:22px;font-size:0.95rem;cursor:pointer;transition:all 0.25s ease;border:1.5px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.03);color:rgba(255,255,255,0.45);font-weight:600;user-select:none;white-space:nowrap}
      .bi-chip.active{color:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.3)}
      .bi-chip:hover{background:rgba(255,255,255,0.07);transform:translateY(-1px)}
      .bi-date{background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:8px 14px;color:rgba(255,255,255,0.7);font-size:0.92rem;font-family:var(--font-en);outline:none;width:140px}
      .bi-date:focus{border-color:rgba(59,130,246,0.5)}

      /* Tabs */
      .bi-tabs{display:flex;gap:0;padding:0 28px;background:rgba(255,255,255,0.015);border-bottom:1px solid rgba(255,255,255,0.06);overflow-x:auto}
      .bi-tab{padding:16px 26px;font-size:1.02rem;font-weight:700;color:rgba(255,255,255,0.35);cursor:pointer;border-bottom:3px solid transparent;transition:all 0.2s;white-space:nowrap}
      .bi-tab:hover{color:rgba(255,255,255,0.6);background:rgba(255,255,255,0.02)}
      .bi-tab.active{color:#60a5fa;border-bottom-color:#3b82f6;background:rgba(59,130,246,0.05)}

      /* Body */
      .bi-body{display:grid;grid-template-columns:1fr;gap:20px;padding:24px 28px}

      /* KPI cards */
      .bi-kpi-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:18px}
      .bi-kpi{background:linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02));border:1px solid rgba(255,255,255,0.07);border-radius:18px;padding:26px 20px;text-align:center;transition:transform 0.2s,box-shadow 0.2s}
      .bi-kpi:hover{transform:translateY(-3px);box-shadow:0 12px 32px rgba(0,0,0,0.25)}
      .bi-kpi-label{font-size:1rem;color:rgba(255,255,255,0.55);margin-bottom:12px;font-weight:700}
      .bi-kpi-value{font-size:2.2rem;font-weight:800;font-family:var(--font-en);letter-spacing:-0.5px}
      .bi-kpi-sub{font-size:0.92rem;color:rgba(255,255,255,0.45);margin-top:6px;font-family:var(--font-en);font-weight:500}

      /* Charts grid */
      .bi-charts{display:grid;grid-template-columns:1fr 1fr;gap:18px}

      /* Cards */
      .bi-card{background:linear-gradient(135deg,rgba(255,255,255,0.035),rgba(255,255,255,0.012));border:1px solid rgba(255,255,255,0.07);border-radius:18px;padding:24px;overflow:hidden}
      .bi-card-title{font-size:1.1rem;font-weight:700;color:rgba(255,255,255,0.65);margin-bottom:20px;display:flex;align-items:center;gap:10px}
      .bi-card canvas{width:100%;display:block}

      /* Tables */
      .bi-table{width:100%;border-collapse:separate;border-spacing:0;font-size:1.05rem}
      .bi-table th{padding:16px 18px;text-align:right;color:rgba(255,255,255,0.55);font-size:0.92rem;font-weight:700;border-bottom:2px solid rgba(255,255,255,0.1);white-space:nowrap;text-transform:uppercase;letter-spacing:0.3px;border-left:1px solid rgba(255,255,255,0.08)}
      .bi-table th:last-child{border-left:none}
      .bi-table th.n{text-align:left}
      .bi-table td{padding:14px 18px;border-bottom:1px solid rgba(255,255,255,0.05);color:rgba(255,255,255,0.9);font-size:1rem;border-left:1px solid rgba(255,255,255,0.06)}
      .bi-table td:last-child{border-left:none}
      .bi-table td.n{font-family:var(--font-en);text-align:left;font-weight:700;font-size:1.05rem;letter-spacing:-0.3px}
      .bi-table tr:hover td{background:rgba(255,255,255,0.025)}
      .bi-table tfoot td{font-weight:800;border-top:2px solid rgba(255,255,255,0.15);font-size:1.08rem;padding:18px}
      /* Sortable headers */
      .bi-table th.sortable{cursor:pointer;user-select:none;transition:color 0.2s}
      .bi-table th.sortable:hover{color:rgba(255,255,255,0.85)}
      .bi-table th.sortable::after{content:'⇅';margin-right:6px;font-size:0.75rem;opacity:0.4}
      .bi-table th.sortable.asc::after{content:'▲';opacity:0.9;color:#10b981}
      .bi-table th.sortable.desc::after{content:'▼';opacity:0.9;color:#ef4444}

      /* Hierarchy rows — 3 levels: company > cost-center > partner/account */
      .bi-table .row-co{cursor:pointer;transition:background 0.15s}
      .bi-table .row-co:hover td{background:rgba(255,255,255,0.04)}
      .bi-table .row-co td:first-child::before{content:'▶';margin-left:8px;font-size:0.7rem;transition:transform 0.2s;display:inline-block}
      .bi-table .row-co.open td:first-child::before{transform:rotate(90deg)}
      .bi-table .row-cc{display:none;cursor:pointer;transition:background 0.15s}
      .bi-table .row-cc.show{display:table-row}
      .bi-table .row-cc:hover td{background:rgba(255,255,255,0.03)}
      .bi-table .row-cc td{font-size:0.96rem;color:rgba(255,255,255,0.8);padding:12px 18px}
      .bi-table .row-cc td:first-child{padding-right:32px;font-weight:600}
      .bi-table .row-cc td:first-child::before{content:'▶';margin-left:6px;font-size:0.55rem;transition:transform 0.2s;display:inline-block}
      .bi-table .row-cc.open td:first-child::before{transform:rotate(90deg)}
      .bi-table .row-pt{display:none}
      .bi-table .row-pt.show{display:table-row}
      .bi-table .row-pt td{font-size:0.92rem;color:rgba(255,255,255,0.6);padding:10px 18px}
      .bi-table .row-pt td:first-child{padding-right:52px;font-weight:400}

      /* Progress bar */
      .bi-pbar{height:14px;border-radius:7px;background:rgba(255,255,255,0.07);overflow:hidden;margin:8px 0}
      .bi-pbar-fill{height:100%;border-radius:7px;transition:width 0.6s ease}
      .bi-pbar-label{display:flex;justify-content:space-between;font-size:0.92rem;color:rgba(255,255,255,0.5);margin-bottom:4px;font-weight:500}

      .bi-full{grid-column:1/-1}
      .bi-actions{margin-right:auto;display:flex;gap:10px;align-items:center}
      .bi-empty{text-align:center;padding:80px 20px;color:rgba(255,255,255,0.3);font-size:1.15rem}
      .bi-refresh-btn{display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:12px;font-size:0.88rem;cursor:pointer;transition:all 0.25s;border:1.5px solid rgba(16,185,129,0.35);background:rgba(16,185,129,0.08);color:#10b981;font-weight:700;white-space:nowrap;user-select:none}
      .bi-refresh-btn:hover{background:rgba(16,185,129,0.18);transform:translateY(-1px);box-shadow:0 4px 12px rgba(16,185,129,0.15)}
      .bi-refresh-btn:active{transform:scale(0.96)}
      .bi-refresh-btn.loading{pointer-events:none;opacity:0.6}
      .bi-refresh-btn .spin-icon{display:inline-block;transition:transform 0.3s}
      .bi-refresh-btn.loading .spin-icon{animation:bi-spin 0.8s linear infinite}
      @keyframes bi-spin{to{transform:rotate(360deg)}}
      .bi-last-updated{display:flex;align-items:center;gap:6px;padding:7px 14px;border-radius:12px;font-size:0.82rem;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);color:rgba(255,255,255,0.45);white-space:nowrap}
      .bi-last-updated .ts{color:rgba(255,255,255,0.65);font-family:var(--font-en);font-weight:600;direction:ltr}

      /* Collapsible advanced filter */
      .bi-adv-toggle{display:flex;align-items:center;gap:8px;padding:10px 28px;background:rgba(255,255,255,0.015);cursor:pointer;user-select:none;border-bottom:1px solid rgba(255,255,255,0.04);transition:background 0.2s}
      .bi-adv-toggle:hover{background:rgba(255,255,255,0.03)}
      .bi-adv-toggle .arrow{transition:transform 0.25s;display:inline-block;font-size:0.7rem;color:rgba(255,255,255,0.4)}
      .bi-adv-toggle.open .arrow{transform:rotate(90deg)}
      .bi-adv-panel{max-height:0;overflow:hidden;transition:max-height 0.35s ease}
      .bi-adv-panel.open{max-height:2500px}
      .bi-single-chk{display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none;font-size:0.88rem;color:rgba(255,255,255,0.5);font-weight:600;white-space:nowrap}
      .bi-single-chk input{accent-color:#06b6d4;width:16px;height:16px;cursor:pointer}

      @media(max-width:900px){.bi-charts{grid-template-columns:1fr}.bi-kpi-row{grid-template-columns:repeat(3,1fr)}}
      @media(max-width:600px){.bi-kpi-row{grid-template-columns:repeat(2,1fr)}}
    </style>
    <div class="bi-page">
      <!-- Slicer Bar -->
      <div class="bi-topbar">
        <span class="slicer-label">🏢 الشركات</span>
        <div class="slicer-group" id="co-slicer">
          <div class="bi-chip active all-chip co-all" data-color="#8b5cf6" style="border-color:#8b5cf6;background:#8b5cf620;color:#8b5cf6;font-weight:800;">الكل</div>
          ${s.map((p,n)=>`<div class="bi-chip active co-chip" data-id="${p.id}" data-color="${Q[n%Q.length]}" style="border-color:${Q[n%Q.length]};background:${Q[n%Q.length]}20;color:${Q[n%Q.length]};">${p.name}</div>`).join("")}
        </div>
        <div style="width:1px;height:24px;background:rgba(255,255,255,0.08);margin:0 6px;flex-shrink:0;"></div>
        <span class="slicer-label">📅 السنوات</span>
        <div class="slicer-group" id="yr-slicer">
          <div class="bi-chip all-chip yr-all" data-color="#ec4899" style="border-color:rgba(255,255,255,0.12);background:rgba(255,255,255,0.03);color:rgba(255,255,255,0.4);font-weight:800;font-family:var(--font-en);">الكل</div>
          ${l.map((p,n)=>`<div class="bi-chip ${p===r?"active":""} yr-chip" data-year="${p}" data-color="${lt[n%lt.length]}" style="${p===r?`border-color:${lt[n%lt.length]};background:${lt[n%lt.length]}20;color:${lt[n%lt.length]};`:""}font-family:var(--font-en);" data-idx="${n}">${p}</div>`).join("")}
        </div>
        <div style="width:1px;height:24px;background:rgba(255,255,255,0.08);margin:0 6px;flex-shrink:0;"></div>
        <span class="slicer-label">📆 الفترة</span>
        <input type="date" id="date-from" class="bi-date" value="" placeholder="من">
        <span style="color:rgba(255,255,255,0.3);font-size:0.88rem;">→</span>
        <input type="date" id="date-to" class="bi-date" value="" placeholder="إلى">
        <div class="bi-actions">
          <div class="bi-last-updated" id="bi-last-updated">🕐 آخر تحديث: <span class="ts" id="bi-last-updated-ts">—</span></div>
          <button class="bi-refresh-btn" id="btn-refresh"><span class="spin-icon">🔄</span> تحديث</button>
          <button class="btn" id="btn-deselect" style="font-size:0.88rem;padding:7px 14px;border-radius:12px;color:#f87171;border-color:rgba(239,68,68,0.25);background:rgba(239,68,68,0.08);">✕ إلغاء التحديد</button>
          <button class="btn" id="btn-share" style="font-size:0.88rem;padding:8px 16px;background:rgba(139,92,246,0.12);color:#a78bfa;border-color:rgba(139,92,246,0.25);border-radius:12px;">🔗 مشاركة</button>
          <button class="btn" id="btn-shares-list" style="font-size:0.88rem;padding:8px 16px;border-radius:12px;">📋 الروابط</button>
        </div>
      </div>
      <!-- CC & Group Toggle -->
      <div class="bi-adv-toggle" id="adv-toggle">
        <span class="arrow">▶</span>
        <span style="font-size:0.95rem;color:rgba(255,255,255,0.55);font-weight:700;">🔍 فلترة متقدمة — مراكز التكلفة والمجموعات</span>
      </div>
      <div class="bi-adv-panel" id="adv-panel">
        <div class="bi-topbar" style="padding:10px 28px;gap:12px;border-top:none;">
          <span class="slicer-label">🏗️ مركز التكلفة</span>
          <div class="slicer-group" id="cc-slicer">
            <div class="bi-chip active all-chip cc-all" data-color="#06b6d4" style="border-color:#06b6d4;background:#06b6d420;color:#06b6d4;font-weight:800;">الكل</div>
          </div>
          <label class="bi-single-chk"><input type="checkbox" id="cc-single-mode"> اختيار فردي</label>
        </div>
        <div class="bi-topbar" style="padding:10px 28px;gap:12px;border-top:none;">
          <span class="slicer-label">📂 المجموعة</span>
          <div class="slicer-group" id="grp-slicer">
            <div class="bi-chip active all-chip grp-all" data-color="#f59e0b" style="border-color:#f59e0b;background:#f59e0b20;color:#f59e0b;font-weight:800;">الكل</div>
          </div>
        </div>
      </div>

      <!-- Tab Bar -->
      <div class="bi-tabs" id="bi-tabs">
        <div class="bi-tab active" data-tab="overview">📊 نظرة عامة</div>
        <div class="bi-tab" data-tab="collection">📥 التحصيل</div>
        <div class="bi-tab" data-tab="comparison">📋 المقارنة</div>
        <div class="bi-tab" data-tab="details">📖 التفاصيل</div>
        <div class="bi-tab" data-tab="pivot-acc">📊 تقاطعي - حسابات</div>
        <div class="bi-tab" data-tab="pivot-cc">📊 تقاطعي - مراكز</div>
        <div class="bi-tab" data-tab="redist">🔄 إعادة التوزيع</div>
        <div class="bi-tab" data-tab="guarantees">🏦 الضمانات البنكية</div>
        <div class="bi-tab" data-tab="sales">🛍️ المبيعات</div>
        <div class="bi-tab" data-tab="sales-details">🛒 تفاصيل المبيعات</div>
      </div>

      <!-- Dashboard Body -->
      <div class="bi-body" id="bi-body">
        <div class="bi-empty">⏳ جاري تحميل البيانات...</div>
      </div>
    </div>

    <!-- Shares Modal -->
    <div id="shares-modal" style="display:none;position:fixed;inset:0;z-index:1000;background:rgba(0,0,0,0.6);backdrop-filter:blur(6px);align-items:center;justify-content:center;">
      <div class="glass-card" style="padding:var(--space-xl);width:550px;max-width:90vw;max-height:80vh;overflow-y:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:var(--space-md);">
          <h3 style="margin:0;color:var(--text-white);">📋 روابط المشاركة</h3>
          <button class="btn" id="btn-close-shares" style="font-size:0.85rem;">✕</button>
        </div>
        <div id="shares-list"></div>
      </div>
    </div>
  `;function e(p,n){const u=p.dataset.color;n?(p.classList.add("active"),p.style.borderColor=u,p.style.background=u+"20",p.style.color=u):(p.classList.remove("active"),p.style.borderColor="rgba(255,255,255,0.12)",p.style.background="rgba(255,255,255,0.03)",p.style.color="rgba(255,255,255,0.4)")}function a(p){e(p,!p.classList.contains("active")),i(),dt(t)}function i(){const p=t.querySelectorAll(".co-chip"),n=t.querySelectorAll(".yr-chip"),u=t.querySelectorAll(".cc-chip"),g=t.querySelectorAll(".grp-chip"),C=t.querySelector(".co-all"),T=t.querySelector(".yr-all"),A=t.querySelector(".cc-all"),k=t.querySelector(".grp-all");C&&e(C,[...p].every(z=>z.classList.contains("active"))),T&&e(T,[...n].every(z=>z.classList.contains("active"))),A&&e(A,u.length===0||[...u].every(z=>z.classList.contains("active"))),k&&e(k,g.length===0||[...g].every(z=>z.classList.contains("active")))}t.querySelectorAll(".co-chip").forEach(p=>p.addEventListener("click",()=>a(p))),t.querySelectorAll(".yr-chip").forEach(p=>p.addEventListener("click",()=>a(p))),(c=t.querySelector(".co-all"))==null||c.addEventListener("click",()=>{const p=t.querySelectorAll(".co-chip"),n=[...p].every(u=>u.classList.contains("active"));p.forEach(u=>e(u,!n)),e(t.querySelector(".co-all"),!n),dt(t)}),(h=t.querySelector(".yr-all"))==null||h.addEventListener("click",()=>{const p=t.querySelectorAll(".yr-chip"),n=[...p].every(u=>u.classList.contains("active"));p.forEach(u=>e(u,!n)),e(t.querySelector(".yr-all"),!n),dt(t)}),(f=t.querySelector(".cc-all"))==null||f.addEventListener("click",()=>{const p=t.querySelectorAll(".cc-chip"),n=p.length===0||[...p].every(u=>u.classList.contains("active"));p.forEach(u=>e(u,!n)),e(t.querySelector(".cc-all"),!n),Z&&ft(t)}),(w=t.querySelector(".grp-all"))==null||w.addEventListener("click",()=>{const p=t.querySelectorAll(".grp-chip"),n=p.length===0||[...p].every(u=>u.classList.contains("active"));p.forEach(u=>e(u,!n)),e(t.querySelector(".grp-all"),!n),Z&&ft(t)}),(S=t.querySelector("#btn-deselect"))==null||S.addEventListener("click",()=>{t.querySelectorAll(".co-chip, .yr-chip, .co-all, .yr-all, .cc-chip, .cc-all, .grp-chip, .grp-all").forEach(p=>e(p,!1)),t.querySelector("#date-from").value="",t.querySelector("#date-to").value="",dt(t)}),(d=t.querySelector("#date-from"))==null||d.addEventListener("change",()=>dt(t)),(y=t.querySelector("#date-to"))==null||y.addEventListener("change",()=>dt(t)),(m=t.querySelector("#adv-toggle"))==null||m.addEventListener("click",()=>{const p=t.querySelector("#adv-toggle"),n=t.querySelector("#adv-panel");p.classList.toggle("open"),n.classList.toggle("open")}),i(),t.querySelectorAll(".bi-tab").forEach(p=>{p.addEventListener("click",()=>{t.querySelectorAll(".bi-tab").forEach(n=>n.classList.remove("active")),p.classList.add("active"),Bt=p.dataset.tab,Z&&ft(t)})}),(v=t.querySelector("#btn-refresh"))==null||v.addEventListener("click",async()=>{const p=t.querySelector("#btn-refresh");if(!p.classList.contains("loading")){p.classList.add("loading");try{await dt(t)}catch(n){console.error(n)}p.classList.remove("loading")}}),t.querySelector("#btn-share").addEventListener("click",()=>ge()),t.querySelector("#btn-shares-list").addEventListener("click",()=>Ft(t)),t.querySelector("#btn-close-shares").addEventListener("click",()=>t.querySelector("#shares-modal").style.display="none"),t.querySelector("#shares-modal").addEventListener("click",p=>{p.target.id==="shares-modal"&&(p.target.style.display="none")});try{const[p,n]=await Promise.all([ct.getAnalyticGroups(),ct.getAnalyticGroupMappings({})]);vt=p||[],window._rawGroupMappings=n||[],gt={};const u={};(n||[]).forEach(g=>{if(!g.group_id)return;const C=(g.analytic_account||"").trim();C&&(u[C]||(u[C]=new Set),u[C].add(String(g.group_id)))});for(const[g,C]of Object.entries(u))C.size===1?gt[g]=[...C][0]:console.warn(`[Mapping] CC "${g}" has conflicting groups:`,[...C],"— treating as ungrouped");Xt(t),ut={},(n||[]).forEach(g=>{if(g.redistributable&&g.analytic_account){const C=String(g.company_id);ut[C]||(ut[C]=new Set),ut[C].add(g.analytic_account.trim())}})}catch(p){console.warn("Could not load analytic groups:",p)}await dt(t)}const Pt=["#06b6d4","#14b8a6","#0ea5e9","#22d3ee","#2dd4bf","#0891b2","#0d9488","#0284c7"];function Kt(t,s){var i;const l=new Set;for(const b of s.years)for(const c of((i=s.yearlyData[b])==null?void 0:i.companies)||[])(c.pivotData||[]).forEach(h=>l.add(h.cc)),(c.costCenters||[]).forEach(h=>l.add(h.name));const r=[...l].sort(),e=t.querySelector("#cc-slicer");if(!e)return;const a=e.querySelector(".cc-all");e.innerHTML="",a&&e.appendChild(a),r.forEach((b,c)=>{const h=Pt[c%Pt.length],f=document.createElement("div");f.className="bi-chip active cc-chip",f.dataset.cc=b,f.dataset.color=h,f.style.cssText=`border-color:${h};background:${h}20;color:${h};`,f.textContent=b,f.addEventListener("click",()=>{var m;if((m=t.querySelector("#cc-single-mode"))==null?void 0:m.checked)t.querySelectorAll(".cc-chip").forEach(v=>{v.classList.remove("active"),v.style.borderColor="rgba(255,255,255,0.12)",v.style.background="rgba(255,255,255,0.03)",v.style.color="rgba(255,255,255,0.4)"}),f.classList.add("active"),f.style.borderColor=h,f.style.background=h+"20",f.style.color=h;else{const v=f.classList.contains("active");f.classList.toggle("active"),v?(f.style.borderColor="rgba(255,255,255,0.12)",f.style.background="rgba(255,255,255,0.03)",f.style.color="rgba(255,255,255,0.4)"):(f.style.borderColor=h,f.style.background=h+"20",f.style.color=h)}const S=t.querySelectorAll(".cc-chip"),d=t.querySelector(".cc-all"),y=[...S].every(v=>v.classList.contains("active"));d&&(d.classList.toggle("active",y),d.style.borderColor=y?"#06b6d4":"rgba(255,255,255,0.12)",d.style.background=y?"#06b6d420":"rgba(255,255,255,0.03)",d.style.color=y?"#06b6d4":"rgba(255,255,255,0.4)"),Z&&ft(t)}),e.appendChild(f)})}function Vt(t){const s=t.querySelectorAll(".cc-chip.active"),l=t.querySelectorAll(".cc-chip");return s.length===0||s.length===l.length?null:[...s].map(r=>r.dataset.cc)}function Xt(t){const s=t.querySelector("#grp-slicer");if(!s||!vt.length)return;const l=s.querySelector(".grp-all");s.innerHTML="",l&&s.appendChild(l),vt.forEach(r=>{const e=r.color||"#f59e0b",a=document.createElement("div");a.className="bi-chip active grp-chip",a.dataset.groupId=r.id,a.dataset.color=e,a.style.cssText=`border-color:${e};background:${e}20;color:${e};`,a.textContent=r.name,a.addEventListener("click",()=>{const i=a.classList.contains("active");a.classList.toggle("active"),i?(a.style.borderColor="rgba(255,255,255,0.12)",a.style.background="rgba(255,255,255,0.03)",a.style.color="rgba(255,255,255,0.4)"):(a.style.borderColor=e,a.style.background=e+"20",a.style.color=e);const b=t.querySelectorAll(".grp-chip"),c=t.querySelector(".grp-all"),h=[...b].every(f=>f.classList.contains("active"));c&&(c.classList.toggle("active",h),c.style.borderColor=h?"#f59e0b":"rgba(255,255,255,0.12)",c.style.background=h?"#f59e0b20":"rgba(255,255,255,0.03)",c.style.color=h?"#f59e0b":"rgba(255,255,255,0.4)"),Qt(t),Z&&ft(t)}),s.appendChild(a)})}function Qt(t){const s=t.querySelectorAll(".grp-chip");if(s.length===0||[...s].every(e=>e.classList.contains("active"))){t.querySelectorAll(".cc-chip").forEach(e=>{e.classList.add("active");const a=e.dataset.color;e.style.borderColor=a,e.style.background=a+"20",e.style.color=a});return}const r=new Set([...t.querySelectorAll(".grp-chip.active")].map(e=>e.dataset.groupId));t.querySelectorAll(".cc-chip").forEach(e=>{const a=e.dataset.cc,i=gt[a],b=i?r.has(String(i)):!1;e.classList.toggle("active",b);const c=e.dataset.color;b?(e.style.borderColor=c,e.style.background=c+"20",e.style.color=c):(e.style.borderColor="rgba(255,255,255,0.12)",e.style.background="rgba(255,255,255,0.03)",e.style.color="rgba(255,255,255,0.4)")})}async function dt(t){var b,c;const s=[...t.querySelectorAll(".co-chip.active")].map(h=>h.dataset.id);let l=[...t.querySelectorAll(".yr-chip.active")].map(h=>h.dataset.year).sort();const r=t.querySelector("#bi-body"),e=(b=t.querySelector("#date-from"))==null?void 0:b.value,a=(c=t.querySelector("#date-to"))==null?void 0:c.value;if(e&&a&&!l.length&&(l=[e.substring(0,4)]),!s.length||!l.length){r.innerHTML='<div class="bi-empty">اختر شركة وسنة مالية واحدة على الأقل</div>';return}r.innerHTML='<div class="bi-empty">⏳ جاري تحميل البيانات...</div>';try{const h={companyIds:s.join(","),years:l.join(",")};e&&(h.dateFrom=e),a&&(h.dateTo=a),console.log("[loadDashboard] params:",JSON.stringify(h)),Z=await ct.getPresentationData(h),Z._selectedCos=s,Z._selectedYrs=l,It=new Date;const f=t.querySelector("#bi-last-updated-ts");f&&(f.textContent=Wt(It)),Kt(t,Z),ft(t)}catch(h){console.error(h),r.innerHTML='<div class="bi-empty" style="color:#ef4444;">❌ خطأ في تحميل البيانات</div>'}}function ft(t){var f;const s=t.querySelector("#bi-body"),l=Vt(t),r=l?Zt(Z,l):Z,e=r.years||[],a=r.yearlyData||{},i=r.grandTotals,b=((f=a[e[0]])==null?void 0:f.companies)||[],c=b.length>1,h=e.length>1;switch(Bt){case"overview":te(s,r,i,e,a,b,c,h);break;case"collection":ee(s,r,i,e,a,b,c,h);break;case"comparison":se(s,r,i,e,a,b,c,h);break;case"details":ie(s,r,i,e,a);break;case"pivot-acc":de(s,r);break;case"pivot-cc":pe(s,r);break;case"redist":he(s,r);break;case"guarantees":ve(s,r);break;case"sales":me(s,r,e,l);break;case"sales-details":xe(s,r,e,l);break}}function Zt(t,s){const l=new Set(s),r={...t,yearlyData:{},years:t.years},e=[];for(const a of t.years){const i=t.yearlyData[a],b=((i==null?void 0:i.companies)||[]).map(f=>{const w=(f.costCenters||[]).filter(g=>l.has(g.name)),S=(f.accountTree||[]).filter(g=>l.has(g.name)),d=(f.pivotData||[]).filter(g=>l.has(g.cc));let y=0,m=0,v=0,p=0;w.forEach(g=>{y+=g.revenue||0,m+=g.expenses||0,v+=g.collected||0,p+=g.remaining||0});const n=y-m,u={...f.kpis,revenue:y,expenses:m,collected:v,remaining:p,netIncome:n,profitMargin:y>0?n/y*100:0,expenseRatio:y>0?m/y*100:0,collectionRate:y>0?v/y*100:0,remainingRate:y>0?p/y*100:0};return e.push(u),{...f,costCenters:w,accountTree:S,pivotData:d,kpis:u}}),c=b.map(f=>f.kpis),h=zt(c);r.yearlyData[a]={...i,companies:b,totals:h}}return r.grandTotals=zt(e),r}function zt(t){const s={revenue:0,expenses:0,netIncome:0,assets:0,liabilities:0,equity:0,cash:0,receivables:0,openingReceivables:0,collected:0,remaining:0,payables:0};for(const l of t)for(const r of Object.keys(s))s[r]+=l[r]||0;return s.profitMargin=s.revenue>0?s.netIncome/s.revenue*100:0,s.expenseRatio=s.revenue>0?s.expenses/s.revenue*100:0,s.collectionRate=s.revenue>0?s.collected/s.revenue*100:0,s.remainingRate=s.revenue>0?s.remaining/s.revenue*100:0,s}function te(t,s,l,r,e,a,i,b){const c=l.revenue,h=l.expenses,f=l.netIncome,w=l.collected,S=l.collectionRate,d=l.expenseRatio,y=l.profitMargin,m=l.remaining,v=l.remainingRate;t.innerHTML=`
    <div class="bi-kpi-row">
      <div class="bi-kpi"><div class="bi-kpi-label">💰 الإيرادات</div><div class="bi-kpi-value" style="color:#10b981;">${o(c)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📤 المصروفات</div><div class="bi-kpi-value" style="color:#ef4444;">${o(h)}</div><div class="bi-kpi-sub">${B(d)} من الإيرادات</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📈 صافي الربح</div><div class="bi-kpi-value" style="color:${f>=0?"#10b981":"#ef4444"};">${o(f)}</div><div class="bi-kpi-sub">هامش ${B(y)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">✅ المحصّل</div><div class="bi-kpi-value" style="color:#06b6d4;">${o(w)}</div><div class="bi-kpi-sub">${B(S)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">⏳ المتبقي</div><div class="bi-kpi-value" style="color:#f59e0b;">${o(m)}</div><div class="bi-kpi-sub">${B(v)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">🏦 الضمانات البنكية</div><div class="bi-kpi-value" style="color:#06b6d4;">${o(l.cash)}</div><div class="bi-kpi-sub">بتاريخ ${new Date().toISOString().slice(0,10)}</div></div>
    </div>
    <div class="bi-card bi-full" style="padding:14px 20px;">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;">
        <div><div class="bi-pbar-label"><span>نسبة التحصيل</span><span style="color:#10b981;font-family:var(--font-en);font-weight:700;">${B(S)}</span></div><div class="bi-pbar"><div class="bi-pbar-fill" style="width:${Math.min(S,100)}%;background:linear-gradient(90deg,#10b981,#34d399);"></div></div></div>
        <div><div class="bi-pbar-label"><span>نسبة المصروفات</span><span style="color:#ef4444;font-family:var(--font-en);font-weight:700;">${B(d)}</span></div><div class="bi-pbar"><div class="bi-pbar-fill" style="width:${Math.min(d,100)}%;background:linear-gradient(90deg,#ef4444,#f87171);"></div></div></div>
        <div><div class="bi-pbar-label"><span>هامش الربح</span><span style="color:${y>=0?"#10b981":"#ef4444"};font-family:var(--font-en);font-weight:700;">${B(y)}</span></div><div class="bi-pbar"><div class="bi-pbar-fill" style="width:${Math.min(Math.abs(y),100)}%;background:linear-gradient(90deg,${y>=0?"#10b981,#34d399":"#ef4444,#f87171"});"></div></div></div>
      </div>
    </div>
    <div class="bi-charts">
      <div class="bi-card"><div class="bi-card-title">🍩 ${i?"توزيع الإيرادات بين الشركات":b?"توزيع الإيرادات بين السنوات":"تحليل التحصيل"}</div><canvas id="ch-overview-donut" height="280"></canvas></div>
      <div class="bi-card"><div class="bi-card-title">🍩 ${i?"توزيع المصروفات بين الشركات":b?"توزيع المصروفات بين السنوات":"تحليل المصروفات"}</div><canvas id="ch-overview-donut-exp" height="280"></canvas></div>
    </div>
    <div class="bi-card bi-full"><div class="bi-card-title">📊 ${i?"الإيرادات والمصروفات حسب الشركة":b?"الإيرادات والمصروفات حسب السنة":"الإيرادات مقابل المصروفات"}</div><canvas id="ch-overview-bar"></canvas></div>
    <div class="bi-charts">
      <div class="bi-card"><div class="bi-card-title">📈 الإيرادات الشهرية <span style="font-size:0.85rem;color:rgba(255,255,255,0.35);margin-right:8px;font-family:var(--font-en);">${r[r.length-1]||""}</span></div><canvas id="ch-monthly-rev" height="280"></canvas></div>
      <div class="bi-card"><div class="bi-card-title">📉 المصروفات الشهرية <span style="font-size:0.85rem;color:rgba(255,255,255,0.35);margin-right:8px;font-family:var(--font-en);">${r[r.length-1]||""}</span></div><canvas id="ch-monthly-exp" height="280"></canvas></div>
    </div>
  `,requestAnimationFrame(()=>{mt(document.getElementById("ch-overview-donut"),Nt(s)),mt(document.getElementById("ch-overview-donut-exp"),ae(s)),Ct(document.getElementById("ch-overview-bar"),Ot(s));const p=r[r.length-1];if(p){const n=oe(s,p);Et(document.getElementById("ch-monthly-rev"),n.revenue,"#10b981","#34d399"),Et(document.getElementById("ch-monthly-exp"),n.expenses,"#ef4444","#f87171")}})}function ee(t,s,l,r,e,a,i,b){const c=l.revenue,h=l.expenses,f=l.collected,w=l.collectionRate,S=l.remaining,d=l.remainingRate;t.innerHTML=`
    <div class="bi-kpi-row" style="grid-template-columns:repeat(4,1fr);">
      <div class="bi-kpi"><div class="bi-kpi-label">💰 إجمالي الإيرادات</div><div class="bi-kpi-value" style="color:#10b981;">${o(c)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">✅ المحصّل</div><div class="bi-kpi-value" style="color:#06b6d4;">${o(f)}</div><div class="bi-kpi-sub">${B(w)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">⏳ المتبقي</div><div class="bi-kpi-value" style="color:#f59e0b;">${o(S)}</div><div class="bi-kpi-sub">${B(d)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📤 المصروفات</div><div class="bi-kpi-value" style="color:#ef4444;">${o(h)}</div></div>
    </div>
    <div class="bi-charts">
      <div class="bi-card"><div class="bi-card-title">📥 التحصيل ${i?"حسب الشركة":b?"حسب السنة":""}</div><canvas id="ch-coll-bars" height="340"></canvas></div>
      <div class="bi-card"><div class="bi-card-title">🍩 محصّل مقابل متبقي</div><canvas id="ch-coll-donut" height="340"></canvas></div>
    </div>
    <div class="bi-card bi-full">
      <div class="bi-card-title">📋 تفاصيل التحصيل</div>
      <div style="overflow-x:auto;"><table class="bi-table" id="tbl-collection"></table></div>
    </div>
  `,requestAnimationFrame(()=>{le(document.getElementById("ch-coll-bars"),s),mt(document.getElementById("ch-coll-donut"),{values:[f,S],colors:["#10b981","#f59e0b"],labels:["المحصّل","المتبقي"]}),re(document.getElementById("tbl-collection"),s)})}function se(t,s,l,r,e,a,i,b){t.innerHTML=`
    <div class="bi-card bi-full">
      <div class="bi-card-title">📋 مقارنة شاملة — الإيرادات والمصروفات والتحصيل</div>
      <div style="overflow-x:auto;"><table class="bi-table" id="tbl-comparison"></table></div>
    </div>
    ${b?'<div class="bi-card bi-full"><div class="bi-card-title">📅 مقارنة سنوية</div><div style="overflow-x:auto;"><table class="bi-table" id="tbl-yoy"></table></div></div>':""}
    <div class="bi-charts">
      <div class="bi-card"><div class="bi-card-title">📊 مقارنة الإيرادات والمصروفات</div><canvas id="ch-comp-bar"></canvas></div>
      <div class="bi-card"><div class="bi-card-title">🍩 توزيع الإيرادات</div><canvas id="ch-comp-donut" height="240"></canvas></div>
    </div>
  `,requestAnimationFrame(()=>{ne(document.getElementById("tbl-comparison"),s),b&&fe(document.getElementById("tbl-yoy"),s),Ct(document.getElementById("ch-comp-bar"),Ot(s)),mt(document.getElementById("ch-comp-donut"),Nt(s))})}function Tt(t){var l;const s=new Map;for(const r of t.years)for(const e of((l=t.yearlyData[r])==null?void 0:l.companies)||[]){let a=s.get(e.companyId);a||(a={companyId:e.companyId,companyName:e.companyName,kpis:{}},s.set(e.companyId,a));for(const[i,b]of Object.entries(e.kpis))a.kpis[i]=(a.kpis[i]||0)+(typeof b=="number"?b:0)}for(const r of s.values()){const e=r.kpis;e.profitMargin=e.revenue>0?e.netIncome/e.revenue*100:0,e.expenseRatio=e.revenue>0?e.expenses/e.revenue*100:0,e.collectionRate=e.revenue>0?e.collected/e.revenue*100:0}return[...s.values()]}function Ot(t,s){const l=t.years,r=t.yearlyData,e=Tt(t),a=e.length>1,i=l.length>1;{if(a)return{groups:e.map(c=>[c.kpis.revenue,c.kpis.expenses]),max:Math.max(...e.flatMap(c=>[c.kpis.revenue,c.kpis.expenses]),1),colors:["#10b981","#ef4444"],labels:e.map(c=>c.companyName)};if(i)return{groups:l.map(c=>[r[c].totals.revenue,r[c].totals.expenses]),max:Math.max(...l.flatMap(c=>[r[c].totals.revenue,r[c].totals.expenses]),1),colors:["#10b981","#ef4444"],labels:l};const b=t.grandTotals;return{groups:[[b.revenue,b.expenses,b.netIncome]],max:Math.max(b.revenue,b.expenses,1),colors:["#10b981","#ef4444","#3b82f6"],labels:[""]}}}function Nt(t){const s=t.years,l=t.yearlyData,r=Tt(t),e=r.length>1,a=s.length>1;if(e)return{values:r.map(b=>b.kpis.revenue),colors:Q,labels:r.map(b=>b.companyName)};if(a)return{values:s.map(b=>l[b].totals.revenue),colors:lt,labels:s};const i=t.grandTotals;return{values:[i.collected||0,i.remaining||0],colors:["#10b981","#f59e0b"],labels:["المحصّل","المتبقي"]}}const Rt=["#ef4444","#f59e0b","#ec4899","#f97316","#e11d48","#dc2626","#be123c","#ea580c"];function ae(t){const s=t.years,l=t.yearlyData,r=Tt(t),e=r.length>1,a=s.length>1;if(e)return{values:r.map(b=>b.kpis.expenses),colors:Rt,labels:r.map(b=>b.companyName)};if(a)return{values:s.map(b=>l[b].totals.expenses),colors:Rt,labels:s};const i=t.grandTotals;return{values:[i.expenses||0,Math.max(i.netIncome,0)],colors:["#ef4444","#10b981"],labels:["المصروفات","صافي الربح"]}}function oe(t,s){const l=t.yearlyData[s];if(!l)return{revenue:[],expenses:[]};const r=new Array(12).fill(0),e=new Array(12).fill(0);for(const a of l.companies||[])for(const i of a.pivotData||[]){const b=i.month;b>=1&&b<=12&&(r[b-1]+=i.revenue||0,e[b-1]+=i.expenses||0)}return{revenue:r,expenses:e}}function Et(t,s,l,r){if(!t||!s||!s.length)return;const e=t.getContext("2d"),a=window.devicePixelRatio||1,i=t.clientWidth,b=t.clientHeight;t.width=i*a,t.height=b*a,e.scale(a,a),e.clearRect(0,0,i,b);const c=20,h=14,f=28,w=36,S=i-c-h,d=b-f-w,y=Math.max(...s,1),m=S/12,v=Math.min(m*.55,48);for(let n=0;n<=4;n++){const u=f+d/4*n;e.strokeStyle="rgba(255,255,255,0.05)",e.beginPath(),e.moveTo(c,u),e.lineTo(c+S,u),e.stroke()}e.beginPath(),e.strokeStyle=l+"50",e.lineWidth=2.5,s.forEach((n,u)=>{const g=c+u*m+m/2,C=Math.abs(n)/y*d,T=f+d-C;u===0?e.moveTo(g,T):e.lineTo(g,T)}),e.stroke(),s.forEach((n,u)=>{const g=c+u*m+(m-v)/2,C=Math.abs(n)/y*d,T=f+d-C,A=Math.min(5,v/2),k=e.createLinearGradient(g,T,g,f+d);if(k.addColorStop(0,l),k.addColorStop(1,r+"30"),e.fillStyle=k,e.beginPath(),e.moveTo(g,f+d),e.lineTo(g,T+A),e.arcTo(g,T,g+A,T,A),e.arcTo(g+v,T,g+v,T+A,A),e.lineTo(g+v,f+d),e.closePath(),e.fill(),n>0){e.save();const z=g+v/2,$=T-4;e.translate(z,$),e.rotate(-Math.PI/4),e.fillStyle="rgba(255,255,255,0.9)",e.font="bold 10px Inter",e.textAlign="left",e.fillText(new Intl.NumberFormat("en-US",{minimumFractionDigits:0,maximumFractionDigits:0}).format(n),0,0),e.restore()}e.fillStyle="rgba(255,255,255,0.6)",e.font='700 13px "Noto Sans Arabic"',e.textAlign="center",e.fillText(St[u].substring(0,5),c+u*m+m/2,b-8)});const p=s.reduce((n,u)=>n+u,0);e.fillStyle=l,e.font="bold 13px Inter",e.textAlign="right",e.fillText("الإجمالي: "+o(p),i-h,18)}function Ct(t,s){var F;if(!t||!s)return;const{groups:l,max:r,colors:e,labels:a}=s,i=((F=l[0])==null?void 0:F.length)||1,b=l.length,c=26,h=3,f=14,w=30,S=10+b*(i*(c+h)+f)+w;t.style.height=S+"px";const d=t.getContext("2d"),y=window.devicePixelRatio||1,m=t.clientWidth,v=S;t.width=m*y,t.height=v*y,d.scale(y,y),d.clearRect(0,0,m,v);const p=140,n=10,u=10,g=8,C=m-p-n-u-120,T=r||1;for(let D=0;D<=5;D++){const O=p+n+C/5*D;d.strokeStyle="rgba(255,255,255,0.05)",d.beginPath(),d.moveTo(O,g),d.lineTo(O,v-w),d.stroke()}let A=g;l.forEach((D,O)=>{const M=i*(c+h);d.fillStyle="rgba(255,255,255,0.85)",d.font='700 13px "Noto Sans Arabic"',d.textAlign="right";const L=(a[O]||"").length>20?a[O].substring(0,20)+"…":a[O];d.fillText(L,p-8,A+M/2+1),D.forEach((P,N)=>{const H=A+N*(c+h),R=Math.max(2,Math.abs(P)/T*C),q=Math.min(5,c/2),I=p+n,E=d.createLinearGradient(I,H,I+R,H);E.addColorStop(0,e[N%e.length]),E.addColorStop(1,e[N%e.length]+"90"),d.fillStyle=E,d.beginPath(),d.moveTo(I,H),d.lineTo(I+R-q,H),d.arcTo(I+R,H,I+R,H+q,q),d.arcTo(I+R,H+c,I+R-q,H+c,q),d.lineTo(I,H+c),d.closePath(),d.fill();const _=s.exactValues?new Intl.NumberFormat("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}).format(P):Math.abs(P)>=1e6?(P/1e6).toFixed(1)+"M":Math.abs(P)>=1e3?Math.round(P/1e3)+"K":Dt(P,0);d.fillStyle="rgba(255,255,255,0.95)",d.font="bold 13px Inter",d.textAlign="left",d.fillText(_,I+R+8,H+c/2+5)}),A+=M+f});const k=v-6,z=i>=2?["إيرادات","مصروفات"]:["القيمة"];let $=p+n;z.forEach((D,O)=>{d.fillStyle=e[O%e.length],d.fillRect($,k-12,12,12),d.fillStyle="rgba(255,255,255,0.6)",d.font='600 12px "Noto Sans Arabic"',d.textAlign="left",d.fillText(D,$+16,k-1),$+=90})}function mt(t,s){if(!t||!s)return;const{values:l,colors:r,labels:e}=s,a=t.getContext("2d"),i=window.devicePixelRatio||1,b=t.clientWidth,c=t.clientHeight;t.width=b*i,t.height=c*i,a.scale(i,i),a.clearRect(0,0,b,c);const h=b*.38,f=c/2,w=Math.min(h-20,f-20),S=w*.48,d=l.reduce((p,n)=>p+Math.abs(n),0)||1;let y=-Math.PI/2;l.forEach((p,n)=>{const u=Math.abs(p)/d*Math.PI*2;if(a.beginPath(),a.arc(h,f,w,y,y+u),a.arc(h,f,S,y+u,y,!0),a.closePath(),a.fillStyle=r[n%r.length],a.fill(),u>.15){const g=y+u/2;a.fillStyle="#fff",a.font="bold 14px Inter",a.textAlign="center",a.textBaseline="middle",a.fillText((Math.abs(p)/d*100).toFixed(0)+"%",h+Math.cos(g)*(w*.76),f+Math.sin(g)*(w*.76))}y+=u}),a.fillStyle="rgba(255,255,255,0.45)",a.font='700 13px "Noto Sans Arabic"',a.textAlign="center",a.textBaseline="middle",a.fillText("المجموع",h,f-12),a.fillStyle="#fff",a.font="bold 18px Inter",a.fillText(d>=1e6?(d/1e6).toFixed(1)+"M":o(d),h,f+12);const m=b*.68;let v=28;e.forEach((p,n)=>{a.fillStyle=r[n%r.length],a.beginPath(),a.arc(m,v+7,6,0,Math.PI*2),a.fill(),a.fillStyle="rgba(255,255,255,0.75)",a.font='700 13px "Noto Sans Arabic"',a.textAlign="right",a.textBaseline="middle",a.fillText(p.length>20?p.substring(0,20)+"…":p,m-14,v+7),a.fillStyle="rgba(255,255,255,0.5)",a.font="12px Inter",a.textAlign="left",a.fillText(o(l[n]),m+14,v+7),v+=30})}function le(t,s){var p;if(!t)return;const l=s.years,r=s.yearlyData,e=((p=r[l[0]])==null?void 0:p.companies)||[],a=e.length>1,i=l.length>1;let b;if(a)b=e.map(n=>({l:n.companyName,a:n.kpis.collected||0,b:n.kpis.remaining||0,t:n.kpis.revenue}));else if(i)b=l.map(n=>{const u=r[n].totals;return{l:n,a:u.collected||0,b:u.remaining||0,t:u.revenue}});else{const n=s.grandTotals;b=[{l:"التحصيل",a:n.collected||0,b:n.remaining||0,t:n.revenue}]}const c=t.getContext("2d"),h=window.devicePixelRatio||1,f=t.clientWidth,w=t.clientHeight;t.width=f*h,t.height=w*h,c.scale(h,h),c.clearRect(0,0,f,w);const S=130,d=70,y=f-S-d,m=Math.min(24,(w-10)/b.length-6),v=Math.max(...b.map(n=>n.t),1);b.forEach((n,u)=>{const g=5+u*((w-10)/b.length)+((w-10)/b.length-m)/2;c.fillStyle="rgba(255,255,255,0.55)",c.font='600 11px "Noto Sans Arabic"',c.textAlign="right",c.textBaseline="middle",c.fillText(n.l.length>14?n.l.substring(0,14)+"…":n.l,S-10,g+m/2);const C=Math.abs(n.a)/v*y,T=Math.abs(n.b)/v*y;c.fillStyle="#10b981",c.fillRect(S,g,C,m),c.fillStyle="#f59e0b",c.fillRect(S+C,g,T,m);const A=n.t>0?(n.a/n.t*100).toFixed(0)+"%":"0%";c.fillStyle="rgba(255,255,255,0.5)",c.font="600 10px Inter",c.textAlign="left",c.textBaseline="middle",c.fillText(`${o(n.t)}  (${A})`,S+C+T+8,g+m/2)})}function $t(t){t.querySelectorAll(".row-co").forEach(s=>{s.addEventListener("click",()=>{const l=s.dataset.gid,r=s.classList.toggle("open"),e=t.querySelectorAll(`.row-cc[data-pgid="${l}"]`);e.length>0?(e.forEach(a=>a.classList.toggle("show",r)),r||e.forEach(a=>{a.classList.remove("open"),t.querySelectorAll(`.row-pt[data-pgid="${a.dataset.gid}"]`).forEach(i=>i.classList.remove("show"))})):t.querySelectorAll(`.row-pt[data-pgid="${l}"]`).forEach(a=>a.classList.toggle("show",r))})}),t.querySelectorAll(".row-cc").forEach(s=>{s.addEventListener("click",l=>{l.stopPropagation();const r=s.dataset.gid,e=s.classList.toggle("open");t.querySelectorAll(`.row-pt[data-pgid="${r}"]`).forEach(a=>a.classList.toggle("show",e))})})}function pt(t){if(!t)return;const s=t.querySelectorAll("th.sortable");s.forEach(l=>{l.addEventListener("click",()=>{const r=l.classList.contains("desc")?"desc":l.classList.contains("asc")?"asc":"none";s.forEach(c=>{c.classList.remove("asc","desc")});let e;r==="none"?e="desc":r==="desc"?e="asc":e="none",e!=="none"&&l.classList.add(e);const a=parseInt(l.dataset.colIdx);if(isNaN(a))return;const i=t.querySelector("tbody");if(!i)return;if(i.querySelector(".row-co")!==null){const c=[];let h=null;i.querySelectorAll("tr").forEach(f=>{f.classList.contains("row-co")?(h={parent:f,children:[]},c.push(h)):h&&h.children.push(f)}),e!=="none"&&c.sort((f,w)=>{const S=f.parent.querySelectorAll("td")[a],d=w.parent.querySelectorAll("td")[a],y=xt(S==null?void 0:S.textContent),m=xt(d==null?void 0:d.textContent);return e==="desc"?m-y:y-m}),c.forEach(f=>{i.appendChild(f.parent),f.children.forEach(w=>i.appendChild(w))})}else{const c=[...i.querySelectorAll("tr")],h=c.filter(w=>!w.querySelector("td[colspan]")),f=c.filter(w=>w.querySelector("td[colspan]"));e!=="none"&&h.sort((w,S)=>{const d=w.querySelectorAll("td")[a],y=S.querySelectorAll("td")[a],m=xt(d==null?void 0:d.textContent),v=xt(y==null?void 0:y.textContent);return e==="desc"?v-m:m-v}),h.forEach(w=>i.appendChild(w)),f.forEach(w=>i.appendChild(w))}})})}function xt(t){if(!t)return 0;const s=t.replace(/[^\d.\-]/g,""),l=parseFloat(s);return isNaN(l)?0:l}function re(t,s){if(!t)return;const l=s.years,r=s.yearlyData;s.grandTotals;const e=l.length>1;let a="",i=0,b=0;l.forEach(v=>{var p;(((p=r[v])==null?void 0:p.companies)||[]).forEach((n,u)=>{const g=n.kpis,C="cg"+i++;a+=`<tr class="row-co" data-gid="${C}"><td style="color:${Q[u%Q.length]};font-weight:700;">${n.companyName}</td>${e?`<td style="font-family:var(--font-en);color:rgba(255,255,255,0.5);">${v}</td>`:""}<td class="n" style="color:#10b981;">${o(g.revenue)}</td><td class="n" style="color:#06b6d4;">${o(g.collected||0)}</td><td class="n" style="color:#f59e0b;">${o(g.remaining||0)}</td><td class="n" style="color:${(g.collectionRate||0)>=70?"#10b981":"#f59e0b"};">${B(g.collectionRate||0)}</td><td class="n" style="color:#ef4444;">${o(g.expenses)}</td><td class="n" style="color:${(g.profitMargin||0)>=0?"#10b981":"#ef4444"};">${B(g.profitMargin||0)}</td></tr>`,(n.costCenters||[]).forEach(T=>{const A="cc"+b++;a+=`<tr class="row-cc" data-gid="${A}" data-pgid="${C}"><td>${T.name.length>28?T.name.substring(0,28)+"…":T.name}</td>${e?"<td></td>":""}<td class="n">${o(T.revenue)}</td><td class="n">${o(T.collected||0)}</td><td class="n">${o(T.remaining||0)}</td><td class="n" style="color:${(T.collectionRate||0)>=70?"#10b981":"#f59e0b"};">${B(T.collectionRate||0)}</td><td class="n">${o(T.expenses)}</td><td class="n" style="color:${(T.profitMargin||0)>=0?"#10b981":"#ef4444"};">${B(T.profitMargin||0)}</td></tr>`,(T.partners||[]).forEach(k=>{a+=`<tr class="row-pt" data-pgid="${A}"><td>${k.name.length>26?k.name.substring(0,26)+"…":k.name}</td>${e?"<td></td>":""}<td class="n">${o(k.revenue)}</td><td class="n">${o(k.collected)}</td><td class="n">${o(k.remaining)}</td><td class="n" style="color:${(k.collectionRate||0)>=70?"#10b981":"#f59e0b"};">${B(k.collectionRate)}</td><td class="n">${o(k.expenses)}</td><td class="n" style="color:${k.netIncome>=0?"#10b981":"#ef4444"};">${B(k.profitMargin)}</td></tr>`})})})});let c=0,h=0,f=0,w=0;l.forEach(v=>{var p;(((p=r[v])==null?void 0:p.companies)||[]).forEach(n=>{(n.costCenters||[]).forEach(u=>{c+=u.revenue||0,h+=u.expenses||0,f+=u.collected||0,w+=u.remaining||0})})});const S=c>0?f/c*100:0,d=c-h,y=c>0?d/c*100:0,m=e?1:0;t.innerHTML=`<thead><tr><th>الشركة / مركز / شريك</th>${e?"<th>السنة</th>":""}<th class="n sortable" data-col-idx="${1+m}">الإيرادات</th><th class="n sortable" data-col-idx="${2+m}">المحصّل</th><th class="n sortable" data-col-idx="${3+m}">المتبقي</th><th class="n sortable" data-col-idx="${4+m}">% تحصيل</th><th class="n sortable" data-col-idx="${5+m}">المصروفات</th><th class="n sortable" data-col-idx="${6+m}">% ربح</th></tr></thead>
  <tbody>${a}</tbody>
  <tfoot><tr><td>المجموع</td>${e?"<td></td>":""}<td class="n" style="color:#10b981;">${o(c)}</td><td class="n" style="color:#06b6d4;">${o(f)}</td><td class="n" style="color:#f59e0b;">${o(w)}</td><td class="n" style="color:${S>=70?"#10b981":"#f59e0b"};">${B(S)}</td><td class="n" style="color:#ef4444;">${o(h)}</td><td class="n" style="color:${y>=0?"#10b981":"#ef4444"};">${B(y)}</td></tr></tfoot>`,$t(t),pt(t)}function ne(t,s){if(!t)return;const l=s.years,r=s.yearlyData;s.grandTotals;const e=l.length>1;let a="",i=0,b=0;l.forEach(p=>{var n;(((n=r[p])==null?void 0:n.companies)||[]).forEach((u,g)=>{const C=u.kpis,T="mg"+i++;a+=`<tr class="row-co" data-gid="${T}"><td style="color:${Q[g%Q.length]};font-weight:700;">${u.companyName}</td>${e?`<td style="font-family:var(--font-en);color:rgba(255,255,255,0.5);">${p}</td>`:""}<td class="n" style="color:#10b981;">${o(C.revenue)}</td><td class="n" style="color:#ef4444;">${o(C.expenses)}</td><td class="n" style="color:#ef4444;">${B(C.expenseRatio||0)}</td><td class="n" style="color:#06b6d4;">${o(C.collected||0)}</td><td class="n" style="color:#f59e0b;">${o(C.remaining||0)}</td><td class="n" style="color:${(C.collectionRate||0)>=70?"#10b981":"#f59e0b"};">${B(C.collectionRate||0)}</td><td class="n" style="color:${C.netIncome>=0?"#10b981":"#ef4444"};">${o(C.netIncome)}</td><td class="n" style="color:${C.profitMargin>=0?"#10b981":"#ef4444"};">${B(C.profitMargin)}</td></tr>`,(u.costCenters||[]).forEach(A=>{const k="mc"+b++,z=A.revenue>0?A.expenses/A.revenue*100:0;a+=`<tr class="row-cc" data-gid="${k}" data-pgid="${T}"><td>${A.name.length>26?A.name.substring(0,26)+"…":A.name}</td>${e?"<td></td>":""}<td class="n">${o(A.revenue)}</td><td class="n">${o(A.expenses)}</td><td class="n">${B(z)}</td><td class="n">${o(A.collected||0)}</td><td class="n">${o(A.remaining||0)}</td><td class="n" style="color:${(A.collectionRate||0)>=70?"#10b981":"#f59e0b"};">${B(A.collectionRate||0)}</td><td class="n" style="color:${A.netIncome>=0?"#10b981":"#ef4444"};">${o(A.netIncome)}</td><td class="n" style="color:${(A.profitMargin||0)>=0?"#10b981":"#ef4444"};">${B(A.profitMargin||0)}</td></tr>`,(A.partners||[]).forEach($=>{const F=$.revenue>0?$.expenses/$.revenue*100:0;a+=`<tr class="row-pt" data-pgid="${k}"><td>${$.name.length>24?$.name.substring(0,24)+"…":$.name}</td>${e?"<td></td>":""}<td class="n">${o($.revenue)}</td><td class="n">${o($.expenses)}</td><td class="n">${B(F)}</td><td class="n">${o($.collected)}</td><td class="n">${o($.remaining)}</td><td class="n" style="color:${($.collectionRate||0)>=70?"#10b981":"#f59e0b"};">${B($.collectionRate)}</td><td class="n" style="color:${$.netIncome>=0?"#10b981":"#ef4444"};">${o($.netIncome)}</td><td class="n" style="color:${$.profitMargin>=0?"#10b981":"#ef4444"};">${B($.profitMargin)}</td></tr>`})})})});let c=0,h=0,f=0,w=0;l.forEach(p=>{var n;(((n=r[p])==null?void 0:n.companies)||[]).forEach(u=>{(u.costCenters||[]).forEach(g=>{c+=g.revenue||0,h+=g.expenses||0,f+=g.collected||0,w+=g.remaining||0})})});const S=c>0?f/c*100:0,d=c>0?h/c*100:0,y=c-h,m=c>0?y/c*100:0,v=e?1:0;t.innerHTML=`<thead><tr><th>الشركة / مركز / شريك</th>${e?"<th>السنة</th>":""}<th class="n sortable" data-col-idx="${1+v}">الإيرادات</th><th class="n sortable" data-col-idx="${2+v}">المصروفات</th><th class="n sortable" data-col-idx="${3+v}">% مصروفات</th><th class="n sortable" data-col-idx="${4+v}">المحصّل</th><th class="n sortable" data-col-idx="${5+v}">المتبقي</th><th class="n sortable" data-col-idx="${6+v}">% تحصيل</th><th class="n sortable" data-col-idx="${7+v}">صافي الربح</th><th class="n sortable" data-col-idx="${8+v}">% ربح</th></tr></thead>
  <tbody>${a}</tbody>
  <tfoot><tr><td>المجموع</td>${e?"<td></td>":""}<td class="n" style="color:#10b981;">${o(c)}</td><td class="n" style="color:#ef4444;">${o(h)}</td><td class="n" style="color:#ef4444;">${B(d)}</td><td class="n" style="color:#06b6d4;">${o(f)}</td><td class="n" style="color:#f59e0b;">${o(w)}</td><td class="n" style="color:${S>=70?"#10b981":"#f59e0b"};">${B(S)}</td><td class="n" style="color:${y>=0?"#10b981":"#ef4444"};">${o(y)}</td><td class="n" style="color:${m>=0?"#10b981":"#ef4444"};">${B(m)}</td></tr></tfoot>`,$t(t),pt(t)}function ie(t,s,l,r,e,a,i,b){var y;const c=l.revenue,h=l.expenses,f=l.netIncome,w=l.profitMargin,S=l.expenseRatio;let d=0;for(const m of r)for(const v of((y=e[m])==null?void 0:y.companies)||[])d+=(v.accountTree||[]).length;t.innerHTML=`
    <div class="bi-kpi-row" style="grid-template-columns:repeat(4,1fr);">
      <div class="bi-kpi"><div class="bi-kpi-label">💰 الإيرادات</div><div class="bi-kpi-value" style="color:#10b981;">${o(c)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📤 المصروفات</div><div class="bi-kpi-value" style="color:#ef4444;">${o(h)}</div><div class="bi-kpi-sub">${B(S)} من الإيرادات</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📈 صافي الربح</div><div class="bi-kpi-value" style="color:${f>=0?"#10b981":"#ef4444"};">${o(f)}</div><div class="bi-kpi-sub">هامش ${B(w)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📊 مراكز التكلفة</div><div class="bi-kpi-value" style="color:#8b5cf6;">${d}</div></div>
    </div>
    <div class="bi-card bi-full">
      <div class="bi-card-title">📑 تفاصيل الإيرادات والمصروفات حسب الحساب المالي</div>
      <div style="overflow-x:auto;"><table class="bi-table" id="tbl-details"></table></div>
    </div>
  `,requestAnimationFrame(()=>ce(document.getElementById("tbl-details"),s))}function ce(t,s){if(!t)return;const l=s.years,r=s.yearlyData,e=new Map;l.forEach(d=>{var y;(((y=r[d])==null?void 0:y.companies)||[]).forEach(m=>{let v=e.get(m.companyId);v||(v={name:m.companyName,id:m.companyId,ccMap:new Map},e.set(m.companyId,v)),(m.accountTree||[]).forEach(p=>{let n=v.ccMap.get(p.name);n||(n={name:p.name,revenue:0,expenses:0,netIncome:0,accMap:new Map},v.ccMap.set(p.name,n)),n.revenue+=p.revenue||0,n.expenses+=p.expenses||0,n.netIncome+=p.netIncome||0,(p.accounts||[]).forEach(u=>{const g=u.code+"|"+u.type;let C=n.accMap.get(g);C||(C={code:u.code,name:u.name,type:u.type,amount:0},n.accMap.set(g,C)),C.amount+=u.amount||0})})})}),e.forEach(d=>{let y=0,m=0;d.ccMap.forEach(v=>{y+=v.revenue,m+=v.expenses}),d.kpis={revenue:y,expenses:m,netIncome:y-m,profitMargin:y>0?(y-m)/y*100:0}});let a=0,i=0;e.forEach(d=>{a+=d.kpis.revenue,i+=d.kpis.expenses});const b=a-i,c=a>0?b/a*100:0;let h="",f=0,w=0,S=0;e.forEach(d=>{const y=d.kpis,m="dg"+f++;h+=`<tr class="row-co" data-gid="${m}"><td style="color:${Q[S%Q.length]};font-weight:700;">${d.name}</td><td class="n" style="color:#10b981;">${o(y.revenue)}</td><td class="n" style="color:#ef4444;">${o(y.expenses)}</td><td class="n" style="color:${y.netIncome>=0?"#10b981":"#ef4444"};">${o(y.netIncome)}</td><td class="n" style="color:${y.profitMargin>=0?"#10b981":"#ef4444"};">${B(y.profitMargin)}</td></tr>`,S++,d.ccMap.forEach(v=>{const p="dc"+w++,n=v.revenue>0?v.netIncome/v.revenue*100:0;h+=`<tr class="row-cc" data-gid="${p}" data-pgid="${m}"><td>${v.name.length>28?v.name.substring(0,28)+"…":v.name}</td><td class="n">${o(v.revenue)}</td><td class="n">${o(v.expenses)}</td><td class="n" style="color:${v.netIncome>=0?"#10b981":"#ef4444"};">${o(v.netIncome)}</td><td class="n" style="color:${n>=0?"#10b981":"#ef4444"};">${B(n)}</td></tr>`,v.accMap.forEach(u=>{const g=u.type==="income";h+=`<tr class="row-pt" data-pgid="${p}"><td>${u.code} - ${u.name.length>22?u.name.substring(0,22)+"…":u.name}</td><td class="n" style="color:${g?"#10b981":"transparent"};">${g?o(u.amount):""}</td><td class="n" style="color:${g?"transparent":"#ef4444"};">${g?"":o(u.amount)}</td><td class="n" style="color:rgba(255,255,255,0.3);">${g?"إيراد":"مصروف"}</td><td class="n">${o(Math.abs(u.amount))}</td></tr>`})})}),t.innerHTML=`<thead><tr><th>الشركة / مركز / حساب</th><th class="n sortable" data-col-idx="1">الإيرادات</th><th class="n sortable" data-col-idx="2">المصروفات</th><th class="n sortable" data-col-idx="3">صافي الربح</th><th class="n sortable" data-col-idx="4">% ربح</th></tr></thead>
  <tbody>${h}</tbody>
  <tfoot><tr><td>المجموع</td><td class="n" style="color:#10b981;">${o(a)}</td><td class="n" style="color:#ef4444;">${o(i)}</td><td class="n" style="color:${b>=0?"#10b981":"#ef4444"};">${o(b)}</td><td class="n" style="color:${c>=0?"#10b981":"#ef4444"};">${B(c)}</td></tr></tfoot>`,$t(t),pt(t)}function wt(t){const s=[],l=t.years,r=t.yearlyData;return l.forEach(e=>{var a;(((a=r[e])==null?void 0:a.companies)||[]).forEach(i=>{(i.pivotData||[]).forEach(b=>s.push(b))})}),s}function de(t,s){const l=s.grandTotals,r=wt(s),e=new Set(r.map(a=>a.account_code));t.innerHTML=`
    <div class="bi-kpi-row" style="grid-template-columns:repeat(4,1fr);">
      <div class="bi-kpi"><div class="bi-kpi-label">💰 إجمالي الإيرادات</div><div class="bi-kpi-value" style="color:#10b981;">${o(l.revenue)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📤 إجمالي المصروفات</div><div class="bi-kpi-value" style="color:#ef4444;">${o(l.expenses)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📈 صافي الربح</div><div class="bi-kpi-value" style="color:${l.netIncome>=0?"#10b981":"#ef4444"};">${o(l.netIncome)}</div><div class="bi-kpi-sub">هامش ${B(l.profitMargin)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📋 عدد الحسابات</div><div class="bi-kpi-value" style="color:#8b5cf6;">${e.size}</div></div>
    </div>
    <div class="bi-card bi-full">
      <div class="bi-card-title">📊 التقرير التقاطعي — حسب الحساب المالي</div>
      <div style="overflow-x:auto;"><table class="bi-table" id="tbl-pivot-acc" style="font-size:1rem;"></table></div>
    </div>`,requestAnimationFrame(()=>ue(document.getElementById("tbl-pivot-acc"),s))}function ue(t,s){if(!t)return;const l=wt(s),r=new Map;for(const d of l){let y=r.get(d.account_code);y||(y={code:d.account_code,name:d.account_name,type:d.account_type,m:{}},r.set(d.account_code,y)),y.m[d.month]||(y.m[d.month]={rev:0,exp:0}),y.m[d.month].rev+=d.revenue||0,y.m[d.month].exp+=d.expenses||0}const e=[1,2,3,4,5,6,7,8,9,10,11,12],a="border-right:2px solid rgba(139,92,246,0.3);";let i='<th style="position:sticky;right:0;z-index:2;background:var(--bg-dark);">الحساب</th>';i+=`<th colspan="3" class="n" style="color:#a78bfa;font-size:0.95rem;${a}">الإجمالي</th>`,e.forEach(d=>{i+=`<th colspan="3" class="n" style="font-size:0.88rem;color:rgba(255,255,255,0.55);">${St[d-1]}</th>`});let b="<th></th>";b+=`<th class="n sortable" data-col-idx="1" style="color:#10b981;font-size:0.85rem;">إيراد</th><th class="n sortable" data-col-idx="2" style="color:#ef4444;font-size:0.85rem;">مصروف</th><th class="n sortable" data-col-idx="3" style="color:#3b82f6;font-size:0.85rem;${a}">صافي</th>`,e.forEach((d,y)=>{const m=4+y*3;b+=`<th class="n sortable" data-col-idx="${m}" style="color:#10b981;font-size:0.82rem;">إيراد</th><th class="n sortable" data-col-idx="${m+1}" style="color:#ef4444;font-size:0.82rem;">مصروف</th><th class="n sortable" data-col-idx="${m+2}" style="color:#3b82f6;font-size:0.82rem;">صافي</th>`});let c="",h={};r.forEach(d=>{var n;const y=(n=d.type)==null?void 0:n.includes("income");let m=0,v=0;e.forEach(u=>{const g=d.m[u]||{rev:0,exp:0};m+=g.rev,v+=g.exp,h[u]||(h[u]={rev:0,exp:0}),h[u].rev+=g.rev,h[u].exp+=g.exp});let p=`<td style="position:sticky;right:0;background:var(--bg-card);white-space:nowrap;font-weight:600;color:${y?"#10b981":"#ef4444"};">${d.code} ${d.name.length>22?d.name.substring(0,22)+"…":d.name}</td>`;p+=`<td class="n" style="color:#10b981;font-weight:800;">${o(m)}</td><td class="n" style="color:#ef4444;font-weight:800;">${o(v)}</td><td class="n" style="color:${m-v>=0?"#3b82f6":"#f59e0b"};font-weight:800;${a}">${o(m-v)}</td>`,e.forEach(u=>{const g=d.m[u]||{rev:0,exp:0},C=g.rev-g.exp;p+=`<td class="n" style="color:#10b981;">${g.rev?o(g.rev):""}</td><td class="n" style="color:#ef4444;">${g.exp?o(g.exp):""}</td><td class="n" style="color:${C>=0?"#3b82f6":"#f59e0b"};">${g.rev||g.exp?o(C):""}</td>`}),c+=`<tr>${p}</tr>`});let f=0,w=0,S='<td style="font-weight:800;">المجموع</td>';e.forEach(d=>{const y=h[d]||{rev:0,exp:0};f+=y.rev,w+=y.exp}),S+=`<td class="n" style="color:#10b981;font-weight:800;">${o(f)}</td><td class="n" style="color:#ef4444;font-weight:800;">${o(w)}</td><td class="n" style="color:${f-w>=0?"#3b82f6":"#f59e0b"};font-weight:800;${a}">${o(f-w)}</td>`,e.forEach(d=>{const y=h[d]||{rev:0,exp:0},m=y.rev-y.exp;S+=`<td class="n" style="color:#10b981;font-weight:700;">${o(y.rev)}</td><td class="n" style="color:#ef4444;font-weight:700;">${o(y.exp)}</td><td class="n" style="color:${m>=0?"#3b82f6":"#f59e0b"};font-weight:700;">${o(m)}</td>`}),t.innerHTML=`<thead><tr>${i}</tr><tr>${b}</tr></thead><tbody>${c}</tbody><tfoot><tr>${S}</tr></tfoot>`,pt(t)}function pe(t,s){const l=s.grandTotals,r=wt(s),e=new Set(r.map(a=>a.cc));t.innerHTML=`
    <div class="bi-kpi-row" style="grid-template-columns:repeat(4,1fr);">
      <div class="bi-kpi"><div class="bi-kpi-label">💰 إجمالي الإيرادات</div><div class="bi-kpi-value" style="color:#10b981;">${o(l.revenue)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📤 إجمالي المصروفات</div><div class="bi-kpi-value" style="color:#ef4444;">${o(l.expenses)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📈 صافي الربح</div><div class="bi-kpi-value" style="color:${l.netIncome>=0?"#10b981":"#ef4444"};">${o(l.netIncome)}</div><div class="bi-kpi-sub">هامش ${B(l.profitMargin)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">🏢 عدد المراكز</div><div class="bi-kpi-value" style="color:#8b5cf6;">${e.size}</div></div>
    </div>
    <div class="bi-card bi-full">
      <div class="bi-card-title">📊 التقرير التقاطعي — حسب مركز التكلفة</div>
      <div style="overflow-x:auto;"><table class="bi-table" id="tbl-pivot-cc" style="font-size:1rem;"></table></div>
    </div>`,requestAnimationFrame(()=>be(document.getElementById("tbl-pivot-cc"),s))}function be(t,s){if(!t)return;const l=wt(s),r=new Map;for(const n of l){let u=r.get(n.cc);u||(u={name:n.cc,accMap:new Map,m:{}},r.set(n.cc,u));let g=u.accMap.get(n.account_code);g||(g={code:n.account_code,name:n.account_name,type:n.account_type,m:{}},u.accMap.set(n.account_code,g)),g.m[n.month]||(g.m[n.month]={rev:0,exp:0}),g.m[n.month].rev+=n.revenue||0,g.m[n.month].exp+=n.expenses||0,u.m[n.month]||(u.m[n.month]={rev:0,exp:0}),u.m[n.month].rev+=n.revenue||0,u.m[n.month].exp+=n.expenses||0}const e=[1,2,3,4,5,6,7,8,9,10,11,12],a="border-right:2px solid rgba(139,92,246,0.3);";let i='<th style="position:sticky;right:0;z-index:2;background:var(--bg-dark);">المجموعة / المركز / حساب</th>';i+=`<th colspan="3" class="n" style="color:#a78bfa;font-size:0.95rem;${a}">الإجمالي</th>`,e.forEach(n=>{i+=`<th colspan="3" class="n" style="font-size:0.88rem;color:rgba(255,255,255,0.55);">${St[n-1]}</th>`});let b="<th></th>";b+=`<th class="n sortable" data-col-idx="1" style="color:#10b981;font-size:0.85rem;">إيراد</th><th class="n sortable" data-col-idx="2" style="color:#ef4444;font-size:0.85rem;">مصروف</th><th class="n sortable" data-col-idx="3" style="color:#3b82f6;font-size:0.85rem;${a}">صافي</th>`,e.forEach((n,u)=>{const g=4+u*3;b+=`<th class="n sortable" data-col-idx="${g}" style="color:#10b981;font-size:0.82rem;">إيراد</th><th class="n sortable" data-col-idx="${g+1}" style="color:#ef4444;font-size:0.82rem;">مصروف</th><th class="n sortable" data-col-idx="${g+2}" style="color:#3b82f6;font-size:0.82rem;">صافي</th>`});const c=new Map,h=[];r.forEach((n,u)=>{const g=u.trim(),C=gt[g]||gt[u],T=C?vt.find(A=>String(A.id)===String(C)):null;if(T){let A=c.get(T.id);A||(A={name:T.name,color:T.color||"#f59e0b",ccs:[]},c.set(T.id,A)),A.ccs.push(u)}else h.push(u)});let f="",w=0,S=0,d={};function y(n){const u={};return n.forEach(g=>{const C=r.get(g);C&&e.forEach(T=>{const A=C.m[T]||{rev:0,exp:0};u[T]||(u[T]={rev:0,exp:0}),u[T].rev+=A.rev,u[T].exp+=A.exp})}),u}c.forEach((n,u)=>{const g="grpg"+w++,C=y(n.ccs);let T=0,A=0;e.forEach(z=>{const $=C[z]||{rev:0,exp:0};T+=$.rev,A+=$.exp}),e.forEach(z=>{const $=C[z]||{rev:0,exp:0};d[z]||(d[z]={rev:0,exp:0}),d[z].rev+=$.rev,d[z].exp+=$.exp});let k=`<td style="position:sticky;right:0;background:var(--bg-card);font-weight:800;color:${n.color};">${n.name}</td>`;k+=`<td class="n" style="color:#10b981;font-weight:800;">${o(T)}</td><td class="n" style="color:#ef4444;font-weight:800;">${o(A)}</td><td class="n" style="color:${T-A>=0?"#3b82f6":"#f59e0b"};font-weight:800;${a}">${o(T-A)}</td>`,e.forEach(z=>{const $=C[z]||{rev:0,exp:0},F=$.rev-$.exp;k+=`<td class="n" style="color:#10b981;">${$.rev?o($.rev):""}</td><td class="n" style="color:#ef4444;">${$.exp?o($.exp):""}</td><td class="n" style="color:${F>=0?"#3b82f6":"#f59e0b"};">${$.rev||$.exp?o(F):""}</td>`}),f+=`<tr class="row-co" data-gid="${g}">${k}</tr>`,n.ccs.forEach(z=>{const $=r.get(z);if(!$)return;const F="pcc"+S++;let D=0,O=0;e.forEach(L=>{const P=$.m[L]||{rev:0,exp:0};D+=P.rev,O+=P.exp});let M=`<td style="position:sticky;right:0;background:var(--bg-card);font-weight:700;color:#8b5cf6;">${$.name.length>28?$.name.substring(0,28)+"…":$.name}</td>`;M+=`<td class="n" style="color:#10b981;font-weight:700;">${o(D)}</td><td class="n" style="color:#ef4444;font-weight:700;">${o(O)}</td><td class="n" style="color:${D-O>=0?"#3b82f6":"#f59e0b"};font-weight:700;${a}">${o(D-O)}</td>`,e.forEach(L=>{const P=$.m[L]||{rev:0,exp:0},N=P.rev-P.exp;M+=`<td class="n" style="color:#10b981;">${P.rev?o(P.rev):""}</td><td class="n" style="color:#ef4444;">${P.exp?o(P.exp):""}</td><td class="n" style="color:${N>=0?"#3b82f6":"#f59e0b"};">${P.rev||P.exp?o(N):""}</td>`}),f+=`<tr class="row-cc" data-gid="${F}" data-pgid="${g}">${M}</tr>`,$.accMap.forEach(L=>{var q;const P=(q=L.type)==null?void 0:q.includes("income");let N=0,H=0;e.forEach(I=>{const E=L.m[I]||{rev:0,exp:0};N+=E.rev,H+=E.exp});let R=`<td style="position:sticky;right:0;background:var(--bg-card);padding-right:52px;color:${P?"#10b981":"#ef4444"};">${L.code} ${L.name.length>20?L.name.substring(0,20)+"…":L.name}</td>`;R+=`<td class="n" style="color:#10b981;">${o(N)}</td><td class="n" style="color:#ef4444;">${o(H)}</td><td class="n" style="color:${N-H>=0?"#3b82f6":"#f59e0b"};${a}">${o(N-H)}</td>`,e.forEach(I=>{const E=L.m[I]||{rev:0,exp:0},_=E.rev-E.exp;R+=`<td class="n" style="color:#10b981;">${E.rev?o(E.rev):""}</td><td class="n" style="color:#ef4444;">${E.exp?o(E.exp):""}</td><td class="n" style="color:${_>=0?"#3b82f6":"#f59e0b"};">${E.rev||E.exp?o(_):""}</td>`}),f+=`<tr class="row-pt" data-pgid="${F}">${R}</tr>`})})}),h.forEach(n=>{const u=r.get(n);if(!u)return;const g="pug"+w++;let C=0,T=0;e.forEach(k=>{const z=u.m[k]||{rev:0,exp:0};C+=z.rev,T+=z.exp,d[k]||(d[k]={rev:0,exp:0}),d[k].rev+=z.rev,d[k].exp+=z.exp});let A=`<td style="position:sticky;right:0;background:var(--bg-card);font-weight:700;color:#8b5cf6;">${u.name.length>28?u.name.substring(0,28)+"…":u.name}</td>`;A+=`<td class="n" style="color:#10b981;font-weight:800;">${o(C)}</td><td class="n" style="color:#ef4444;font-weight:800;">${o(T)}</td><td class="n" style="color:${C-T>=0?"#3b82f6":"#f59e0b"};font-weight:800;${a}">${o(C-T)}</td>`,e.forEach(k=>{const z=u.m[k]||{rev:0,exp:0},$=z.rev-z.exp;A+=`<td class="n" style="color:#10b981;">${z.rev?o(z.rev):""}</td><td class="n" style="color:#ef4444;">${z.exp?o(z.exp):""}</td><td class="n" style="color:${$>=0?"#3b82f6":"#f59e0b"};">${z.rev||z.exp?o($):""}</td>`}),f+=`<tr class="row-co" data-gid="${g}">${A}</tr>`,u.accMap.forEach(k=>{var O;const z=(O=k.type)==null?void 0:O.includes("income");let $=0,F=0;e.forEach(M=>{const L=k.m[M]||{rev:0,exp:0};$+=L.rev,F+=L.exp});let D=`<td style="position:sticky;right:0;background:var(--bg-card);padding-right:30px;color:${z?"#10b981":"#ef4444"};">${k.code} ${k.name.length>20?k.name.substring(0,20)+"…":k.name}</td>`;D+=`<td class="n" style="color:#10b981;">${o($)}</td><td class="n" style="color:#ef4444;">${o(F)}</td><td class="n" style="color:${$-F>=0?"#3b82f6":"#f59e0b"};${a}">${o($-F)}</td>`,e.forEach(M=>{const L=k.m[M]||{rev:0,exp:0},P=L.rev-L.exp;D+=`<td class="n" style="color:#10b981;">${L.rev?o(L.rev):""}</td><td class="n" style="color:#ef4444;">${L.exp?o(L.exp):""}</td><td class="n" style="color:${P>=0?"#3b82f6":"#f59e0b"};">${L.rev||L.exp?o(P):""}</td>`}),f+=`<tr class="row-pt" data-pgid="${g}">${D}</tr>`})});let m=0,v=0,p='<td style="position:sticky;right:0;background:var(--bg-dark);font-weight:800;">المجموع</td>';e.forEach(n=>{const u=d[n]||{rev:0,exp:0};m+=u.rev,v+=u.exp}),p+=`<td class="n" style="color:#10b981;font-weight:800;">${o(m)}</td><td class="n" style="color:#ef4444;font-weight:800;">${o(v)}</td><td class="n" style="color:${m-v>=0?"#3b82f6":"#f59e0b"};font-weight:800;${a}">${o(m-v)}</td>`,e.forEach(n=>{const u=d[n]||{rev:0,exp:0},g=u.rev-u.exp;p+=`<td class="n" style="color:#10b981;font-weight:700;">${o(u.rev)}</td><td class="n" style="color:#ef4444;font-weight:700;">${o(u.exp)}</td><td class="n" style="color:${g>=0?"#3b82f6":"#f59e0b"};font-weight:700;">${o(g)}</td>`}),t.innerHTML=`<thead><tr>${i}</tr><tr>${b}</tr></thead><tbody>${f}</tbody><tfoot><tr>${p}</tr></tfoot>`,$t(t),pt(t)}function fe(t,s){if(!t)return;const l=s.years,r=s.yearlyData;t.innerHTML=`<thead><tr><th>السنة</th><th class="n sortable" data-col-idx="1">الإيرادات</th><th class="n sortable" data-col-idx="2">المصروفات</th><th class="n sortable" data-col-idx="3">صافي الربح</th><th class="n sortable" data-col-idx="4">% ربح</th><th class="n sortable" data-col-idx="5">المحصّل</th><th class="n sortable" data-col-idx="6">المتبقي</th><th class="n sortable" data-col-idx="7">% تحصيل</th><th class="n sortable" data-col-idx="8">الأصول</th><th class="n sortable" data-col-idx="9">الالتزامات</th></tr></thead>
  <tbody>${l.map((e,a)=>{const i=r[e].totals,b=i.collected||0,c=i.collectionRate||0;return`<tr>
  <td style="color:${lt[a%lt.length]};font-family:var(--font-en);font-weight:800;font-size:0.9rem;">${e}</td>
  <td class="n" style="color:#10b981;">${o(i.revenue)}</td><td class="n" style="color:#ef4444;">${o(i.expenses)}</td>
  <td class="n" style="color:${i.netIncome>=0?"#10b981":"#ef4444"};">${o(i.netIncome)}</td><td class="n" style="color:${i.profitMargin>=0?"#10b981":"#ef4444"};">${B(i.profitMargin)}</td>
  <td class="n" style="color:#06b6d4;">${o(b)}</td><td class="n" style="color:#f59e0b;">${o(i.remaining||0)}</td>
  <td class="n" style="color:${c>=70?"#10b981":"#f59e0b"};">${B(c)}</td>
  <td class="n" style="color:#3b82f6;">${o(i.assets)}</td><td class="n" style="color:#ef4444;">${o(i.liabilities)}</td></tr>`}).join("")}</tbody>`,pt(t)}async function ge(t){var s,l;if(!Z){yt("لا توجد بيانات","error");return}try{const r=await ct.createPresentationShare({title:`${Z.years.join("+")} — ${(((s=Z.yearlyData[Z.years[0]])==null?void 0:s.companies)||[]).map(a=>a.companyName).join(" + ")}`,companyId:Z._selectedCos.join(","),dateFrom:Z.years.join(","),dateTo:Z._selectedYrs.join(","),speed:0}),e=`${location.origin}/viewer.html?token=${r.token}`;await((l=navigator.clipboard)==null?void 0:l.writeText(e).catch(()=>{})),yt("✅ تم إنشاء الرابط ونسخه!","success")}catch{yt("خطأ في المشاركة","error")}}async function Ft(t){const s=t.querySelector("#shares-modal");s.style.display="flex";const l=t.querySelector("#shares-list");l.innerHTML='<p style="color:var(--text-muted);text-align:center;">⏳</p>';try{const r=await ct.getPresentationShares();if(!r.length){l.innerHTML='<p style="color:var(--text-muted);text-align:center;">لا توجد روابط</p>';return}l.innerHTML=r.map(e=>{const a=`${location.origin}/viewer.html?token=${e.token}`;return`<div style="background:rgba(255,255,255,0.03);border-radius:12px;padding:14px;margin-bottom:10px;border:1px solid rgba(255,255,255,0.06);">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div><div style="color:var(--text-white);font-weight:600;font-size:0.85rem;">${e.title}</div><div style="color:var(--text-muted);font-size:0.72rem;margin-top:3px;">${e.created_at}</div></div>
          <div style="display:flex;gap:8px;"><button class="btn copy-btn" data-url="${a}" style="font-size:0.72rem;padding:5px 10px;">📋</button><button class="btn del-btn" data-id="${e.id}" style="font-size:0.72rem;padding:5px 10px;color:var(--accent-red);">🗑️</button></div>
        </div>
      </div>`}).join(""),l.querySelectorAll(".copy-btn").forEach(e=>e.addEventListener("click",async()=>{var a;await((a=navigator.clipboard)==null?void 0:a.writeText(e.dataset.url)),yt("✅ تم نسخ الرابط","success")})),l.querySelectorAll(".del-btn").forEach(e=>e.addEventListener("click",async()=>{await ct.deletePresentationShare(e.dataset.id),yt("تم الحذف","success"),Ft(t)}))}catch{l.innerHTML='<p style="color:var(--accent-red);">خطأ</p>'}}function he(t,s){let l=0;for(const f of Object.keys(ut))l+=ut[f].size;s.years,s.yearlyData;const r=s.grandTotals.revenue,e=s.grandTotals.expenses,a=s.grandTotals.collected,i=r-e,b=r>0?i/r*100:0,c=r-a,h=r>0?a/r*100:0;if(l===0){t.innerHTML='<div class="bi-empty">لا توجد مراكز تكلفة محددة لإعادة التوزيع.<br><span style="font-size:0.9rem;color:rgba(255,255,255,0.3);">حدد المراكز الإدارية من صفحة الحسابات التحليلية</span></div>';return}t.innerHTML=`
    <style>
      .bi-table .row-sub{display:none;cursor:pointer;transition:background 0.15s}
      .bi-table .row-sub.show{display:table-row}
      .bi-table .row-sub:hover td{background:rgba(255,255,255,0.025)}
      .bi-table .row-sub td{font-size:0.93rem;color:rgba(255,255,255,0.75);padding:11px 18px}
      .bi-table .row-sub td:first-child{padding-right:44px;font-weight:600}
      .bi-table .row-sub td:first-child::before{content:'\\25B6';margin-left:6px;font-size:0.5rem;transition:transform 0.2s;display:inline-block}
      .bi-table .row-sub.open td:first-child::before{transform:rotate(90deg)}
      .bi-table .row-acct{display:none}
      .bi-table .row-acct.show{display:table-row}
      .bi-table .row-acct td{font-size:0.88rem;color:rgba(255,255,255,0.5);padding:8px 18px}
      .bi-table .row-acct td:first-child{padding-right:64px;font-weight:400}
    </style>
    <div class="bi-kpi-row" style="grid-template-columns:repeat(7,1fr);">
      <div class="bi-kpi"><div class="bi-kpi-label">💰 إجمالي الإيرادات</div><div class="bi-kpi-value" style="color:#10b981;">${o(r)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📤 إجمالي المصروفات</div><div class="bi-kpi-value" style="color:#ef4444;">${o(e)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">💵 المحصّل</div><div class="bi-kpi-value" style="color:#06b6d4;">${o(a)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📋 المتبقي</div><div class="bi-kpi-value" style="color:#f59e0b;">${o(c)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📊 % تحصيل</div><div class="bi-kpi-value" style="color:${h>=70?"#10b981":"#f59e0b"};">${B(h)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">🔄 مراكز قابلة للتوزيع</div><div class="bi-kpi-value" style="color:#a78bfa;">${l}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📈 صافي الربح</div><div class="bi-kpi-value" style="color:${i>=0?"#10b981":"#ef4444"};">${o(i)}</div><div class="bi-kpi-sub">هامش ${B(b)}</div></div>
    </div>
        <div class="bi-card bi-full">
      <div class="bi-card-title">🔄 إعادة التوزيع حسب الإيرادات <span style="font-size:0.85rem;color:rgba(255,255,255,0.35);margin-right:8px;">نسبة وتناسب</span></div>
      <div style="overflow-x:auto;"><table class="bi-table" id="tbl-redist-rev" style="font-size:1rem;"></table></div>
    </div>
    <div class="bi-card bi-full">
      <div class="bi-card-title">🔄 إعادة التوزيع حسب المصروفات <span style="font-size:0.85rem;color:rgba(255,255,255,0.35);margin-right:8px;">نسبة وتناسب</span></div>
      <div style="overflow-x:auto;"><table class="bi-table" id="tbl-redist-exp" style="font-size:1rem;"></table></div>
    </div>`,requestAnimationFrame(()=>{qt(document.getElementById("tbl-redist-rev"),s,"revenue"),qt(document.getElementById("tbl-redist-exp"),s,"expense")})}function ye(t){t.querySelectorAll(".row-co").forEach(s=>{s.addEventListener("click",()=>{const l=s.dataset.gid,r=s.classList.toggle("open"),e=t.querySelectorAll(`.row-cc[data-pgid="${l}"]`);e.forEach(a=>a.classList.toggle("show",r)),r||e.forEach(a=>{a.classList.remove("open"),t.querySelectorAll(`.row-sub[data-pgid="${a.dataset.gid}"]`).forEach(i=>{i.classList.remove("show","open"),t.querySelectorAll(`.row-acct[data-pgid="${i.dataset.gid}"]`).forEach(b=>b.classList.remove("show"))}),t.querySelectorAll(`.row-pt[data-pgid="${a.dataset.gid}"]`).forEach(i=>i.classList.remove("show"))})})}),t.querySelectorAll(".row-cc").forEach(s=>{s.addEventListener("click",l=>{l.stopPropagation();const r=s.dataset.gid,e=s.classList.toggle("open");t.querySelectorAll(`.row-sub[data-pgid="${r}"]`).forEach(a=>a.classList.toggle("show",e)),t.querySelectorAll(`.row-pt[data-pgid="${r}"]`).forEach(a=>a.classList.toggle("show",e)),e||t.querySelectorAll(`.row-sub[data-pgid="${r}"]`).forEach(a=>{a.classList.remove("open"),t.querySelectorAll(`.row-acct[data-pgid="${a.dataset.gid}"]`).forEach(i=>i.classList.remove("show"))})})}),t.querySelectorAll(".row-sub").forEach(s=>{s.addEventListener("click",l=>{l.stopPropagation();const r=s.dataset.gid,e=s.classList.toggle("open");t.querySelectorAll(`.row-acct[data-pgid="${r}"]`).forEach(a=>a.classList.toggle("show",e))})})}function qt(t,s,l){var T,A;if(!t)return;const r=s.years,e=s.yearlyData,a=r.length>1;function i(k,z,$,F,D,O,M,L){const P=L?"font-weight:800;":"";return`<td class="n" style="color:#10b981;${P}">${o(k)}</td><td class="n" style="color:#ef4444;${P}">${o(z)}</td><td class="n" style="color:#f59e0b;${P}">${$>0?o($):'<span style="color:rgba(255,255,255,0.15);">-</span>'}</td><td class="n" style="color:#ef4444;${P}">${o(F)}</td><td class="n" style="color:#06b6d4;${P}">${o(D)}</td><td class="n" style="color:#f59e0b;${P}">${o(k-D)}</td><td class="n" style="color:${k>0?D/k*100>=70?"#10b981":"#f59e0b":"rgba(255,255,255,0.3)"};${P}">${k>0?B(D/k*100):"-"}</td><td class="n" style="color:${O>=0?"#10b981":"#ef4444"};${P}">${o(O)}</td><td class="n" style="color:${M>=0?"#10b981":"#ef4444"};${P}">${B(M)}</td>`}let b="",c=0,h=0,f=0,w=0,S=0,d=0,y=0,m=0,v=0,p=0;function n(k,z){let $=0;const F=[],D=[];(k.costCenters||[]).forEach(E=>{z.has(E.name.trim())?($+=E.expenses||0,F.push(E)):D.push(E)});const O={};(k.accountTree||[]).forEach(E=>{z.has(E.name.trim())||(O[E.name]=E.accounts||[])});let M=0;l==="revenue"?D.forEach(E=>{M+=E.revenue||0}):D.forEach(E=>{M+=E.expenses||0});let L=0;const P=D.map(E=>{const _=l==="revenue"?E.revenue||0:E.expenses||0,tt=M>0?_/M:D.length>0?1/D.length:0,J=$>0?Math.round($*tt):0;return L+=J,{cc:E,a:J}});if($>0&&P.length>0){const E=$-L;if(E!==0){let _=0,tt=0;P.forEach((J,j)=>{const W=l==="revenue"?J.cc.revenue||0:J.cc.expenses||0;W>tt&&(tt=W,_=j)}),P[_].a+=E}}let N=0,H=0,R=0,q=0,I=0;return P.forEach(({cc:E,a:_})=>{N+=E.revenue||0,H+=E.expenses||0,R+=_,q+=(E.expenses||0)+_,I+=E.collected||0}),F.forEach(E=>{N+=E.revenue||0,I+=E.collected||0}),{allocs:P,adminCCs:F,adminExp:$,accTree:O,totals:{rev:N,orig:H,alloc:R,total:q,coll:I,net:N-q,margin:N>0?(N-q)/N*100:0}}}function u(k,z,$,F,D){const{allocs:O,adminCCs:M,accTree:L}=z;let P="";const N=new Map,H=[];if(O.forEach(R=>{const q=gt[R.cc.name.trim()],I=q?vt.find(E=>String(E.id)===String(q)):null;if(I){let E=N.get(I.id);E||(E={name:I.name,color:I.color||"#f59e0b",items:[]},N.set(I.id,E)),E.items.push(R)}else H.push(R)}),N.forEach(R=>{const q="rgrp"+h++;let I=0,E=0,_=0,tt=0,J=0;R.items.forEach(({cc:Y,a:X})=>{I+=Y.revenue||0,E+=Y.expenses||0,_+=X,tt+=(Y.expenses||0)+X,J+=Y.collected||0});const j=I-tt,W=I>0?j/I*100:0;P+=`<tr class="${$}" data-gid="${q}" data-pgid="${k}"><td style="font-weight:700;color:${R.color};">${R.name}</td>${i(I,E,_,tt,J,j,W,!0)}</tr>`,R.items.forEach(({cc:Y,a:X})=>{const et="rcc"+f++,at=(Y.expenses||0)+X,ot=(Y.revenue||0)-at,nt=Y.revenue>0?ot/Y.revenue*100:0;P+=`<tr class="${F}" data-gid="${et}" data-pgid="${q}"><td>${Y.name.length>28?Y.name.substring(0,28)+"…":Y.name}</td>${i(Y.revenue||0,Y.expenses||0,X,at,Y.collected||0,ot,nt)}</tr>`,(L[Y.name]||[]).forEach(st=>{const rt=st.type==="income";P+=`<tr class="${D}" data-pgid="${et}"><td style="color:${rt?"#10b981":"#ef4444"};">${st.code} ${st.name.length>20?st.name.substring(0,20)+"…":st.name}</td><td class="n" style="color:#10b981;">${rt?o(st.amount):""}</td><td class="n" style="color:#ef4444;">${rt?"":o(st.amount)}</td><td class="n" style="color:rgba(255,255,255,0.15);">-</td><td class="n" style="color:rgba(255,255,255,0.15);">-</td><td class="n" style="color:rgba(255,255,255,0.15);">-</td><td class="n" style="color:rgba(255,255,255,0.15);">-</td><td class="n" style="color:rgba(255,255,255,0.15);">-</td><td class="n" style="color:rgba(255,255,255,0.3);">${rt?"إيراد":"مصروف"}</td><td class="n">${o(Math.abs(st.amount))}</td></tr>`})})}),H.forEach(({cc:R,a:q})=>{const I="rcc"+f++,E=(R.expenses||0)+q,_=(R.revenue||0)-E,tt=R.revenue>0?_/R.revenue*100:0;P+=`<tr class="${$}" data-gid="${I}" data-pgid="${k}"><td style="font-weight:600;color:#8b5cf6;">${R.name.length>28?R.name.substring(0,28)+"…":R.name}</td>${i(R.revenue||0,R.expenses||0,q,E,R.collected||0,_,tt)}</tr>`,(L[R.name]||[]).forEach(J=>{const j=J.type==="income";P+=`<tr class="${D}" data-pgid="${I}"><td style="color:${j?"#10b981":"#ef4444"};">${J.code} ${J.name.length>20?J.name.substring(0,20)+"…":J.name}</td><td class="n" style="color:#10b981;">${j?o(J.amount):""}</td><td class="n" style="color:#ef4444;">${j?"":o(J.amount)}</td><td class="n" style="color:rgba(255,255,255,0.15);">-</td><td class="n" style="color:rgba(255,255,255,0.15);">-</td><td class="n" style="color:rgba(255,255,255,0.15);">-</td><td class="n" style="color:rgba(255,255,255,0.15);">-</td><td class="n" style="color:rgba(255,255,255,0.15);">-</td><td class="n" style="color:rgba(255,255,255,0.3);">${j?"إيراد":"مصروف"}</td><td class="n">${o(Math.abs(J.amount))}</td></tr>`})}),M.length>0){const R=M.map(I=>I.name.length>12?I.name.substring(0,12)+"…":I.name).join(" + "),q=M.reduce((I,E)=>I+(E.expenses||0),0);P+=`<tr class="${$}" data-pgid="${k}" style="background:rgba(245,158,11,0.04);"><td style="color:#f59e0b;font-weight:700;">🔄 موزع: ${R}</td><td class="n" style="color:rgba(255,255,255,0.2);">-</td><td class="n" style="color:#f59e0b;font-weight:700;">${o(q)}</td><td class="n" style="color:#f59e0b;">← ${o(q)}</td>${'<td class="n" style="color:rgba(255,255,255,0.2);">-</td>'.repeat(6)}</tr>`}return P}if(a){const k=new Map;let z=0;for(const $ of r)for(const F of((A=e[$])==null?void 0:A.companies)||[]){const D=String(F.companyId),O=ut[D]||new Set,M=n(F,O);let L=k.get(D);L||(L={name:F.companyName,color:Q[z++%Q.length],yearData:[]},k.set(D,L)),L.yearData.push({yr:$,result:M})}k.forEach($=>{const F="rco"+c++;let D=0,O=0,M=0,L=0,P=0;$.yearData.forEach(({result:R})=>{const q=R.totals;D+=q.rev,O+=q.orig,M+=q.alloc,L+=q.total,P+=q.coll});const N=D-L,H=D>0?N/D*100:0;w+=D,S+=O,d+=M,y+=L,m+=P,v+=N,$.yearData.forEach(({result:R})=>{p+=R.adminExp}),b+=`<tr class="row-co" data-gid="${F}"><td style="color:${$.color};font-weight:800;">${$.name}</td>${i(D,O,M,L,P,N,H,!0)}</tr>`,$.yearData.forEach(({yr:R,result:q})=>{const I="ryr"+c++,E=q.totals;b+=`<tr class="row-cc" data-gid="${I}" data-pgid="${F}"><td style="font-family:var(--font-en);font-weight:700;color:rgba(255,255,255,0.7);">📅 ${R}</td>${i(E.rev,E.orig,E.alloc,E.total,E.coll,E.net,E.margin,!0)}</tr>`,b+=u(I,q,"row-sub","row-sub","row-acct")})})}else for(const k of r)for(const z of((T=e[k])==null?void 0:T.companies)||[]){const $=String(z.companyId),F=ut[$]||new Set,D="rco"+c++,O=n(z,F),M=O.totals;w+=M.rev,S+=M.orig,d+=M.alloc,y+=M.total,m+=M.coll,v+=M.net,p+=O.adminExp,b+=`<tr class="row-co" data-gid="${D}"><td style="color:${Q[c%Q.length]};font-weight:800;">${z.companyName}</td>${i(M.rev,M.orig,M.alloc,M.total,M.coll,M.net,M.margin,!0)}</tr>`,b+=u(D,O,"row-cc","row-sub","row-acct")}const g=w>0?v/w*100:0,C=`<td style="font-weight:800;">المجموع</td>${i(w,S,d,y,m,v,g,!0)}`;t.innerHTML=`<thead><tr><th>الشركة / المجموعة / المركز / حساب</th><th class="n sortable" data-col-idx="1">الإيرادات</th><th class="n sortable" data-col-idx="2">مصروفات أصلية</th><th class="n sortable" data-col-idx="3" style="color:#f59e0b;">المُحمّل</th><th class="n sortable" data-col-idx="4" style="color:#ef4444;">إجمالي مصروفات</th><th class="n sortable" data-col-idx="5" style="color:#06b6d4;">المحصّل</th><th class="n sortable" data-col-idx="6" style="color:#f59e0b;">المتبقي</th><th class="n sortable" data-col-idx="7" style="color:#a78bfa;">% تحصيل</th><th class="n sortable" data-col-idx="8">صافي الربح</th><th class="n sortable" data-col-idx="9">% ربح</th></tr></thead><tbody>${b}</tbody><tfoot><tr>${C}</tr></tfoot>`,ye(t),pt(t)}async function ve(t,s,l,r){const e=new Date().toISOString().slice(0,10),a=s._selectedCos||[];t.innerHTML='<div class="bi-empty">⏳ جاري تحميل بيانات الضمانات...</div>';try{const i=await ct.getGuaranteePendingList({companyIds:a.join(",")});if(!i||!i.length){t.innerHTML='<div class="bi-empty">لا توجد ضمانات بنكية معلّقة</div>';return}let b=0,c=0;i.forEach(f=>f.items.forEach(w=>{b+=w.amount,c++}));let h=`
      <div class="bi-kpi-row" style="margin-bottom:18px">
        <div class="bi-kpi"><div class="bi-kpi-label">🏦 إجمالي الضمانات المعلّقة</div><div class="bi-kpi-value" style="color:#06b6d4;">${o(b)}</div></div>
        <div class="bi-kpi"><div class="bi-kpi-label">📋 عدد الضمانات</div><div class="bi-kpi-value" style="color:#a78bfa;">${c}</div></div>
        <div class="bi-kpi"><div class="bi-kpi-label">📅 بتاريخ</div><div class="bi-kpi-value" style="color:#f59e0b;font-size:1.1rem;">${e}</div></div>
        <div class="bi-kpi"><div class="bi-kpi-label">🏢 الشركات</div><div class="bi-kpi-value" style="color:#10b981;">${i.length}</div></div>
      </div>
    `;i.forEach(f=>{const w=f.items.reduce((S,d)=>S+d.amount,0);h+=`
        <div class="bi-card bi-full" style="margin-bottom:16px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <div style="font-size:1.05rem;font-weight:700;color:var(--text-white);">🏢 ${f.companyName}</div>
            <div style="font-family:var(--font-en);font-weight:700;color:#06b6d4;font-size:1.05rem">${o(w)}</div>
          </div>
          <table class="bi-table" style="font-size:0.9rem" data-guarantee-tbl>
            <thead>
              <tr>
                <th style="width:40px;text-align:center">#</th>
                <th style="text-align:right">البيان</th>
                <th style="text-align:right">الحساب</th>
                <th class="sortable" data-col-idx="3" style="text-align:left">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              ${f.items.map((S,d)=>`
                <tr>
                  <td style="text-align:center;color:#475569;font-size:0.8rem">${d+1}</td>
                  <td style="color:var(--text-white)">${S.description}</td>
                  <td style="color:#94a3b8;font-size:0.85rem">${S.account}</td>
                  <td class="n" style="color:#06b6d4;font-weight:700">${o(S.amount)}</td>
                </tr>
              `).join("")}
              <tr style="background:rgba(139,92,246,0.06)">
                <td colspan="3" style="text-align:center;font-weight:700;color:#c4b5fd">الإجمالي</td>
                <td class="n" style="font-weight:800;color:#06b6d4;font-size:1rem">${o(w)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `}),t.innerHTML=h,t.querySelectorAll("[data-guarantee-tbl]").forEach(f=>pt(f))}catch(i){console.error("Guarantees error:",i),t.innerHTML=`<div class="bi-empty" style="color:#ef4444">❌ خطأ: ${i.message}</div>`}}async function me(t,s,l,r){const e=s._selectedYrs||[],a=s._selectedCos||[];t.innerHTML=`
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;flex-wrap:wrap;">
      <h2 style="margin:0;color:rgba(255,255,255,0.85);font-size:1.3rem;">🛍️ لوحة التقرير العام للمبيعات — ${e.join(", ")||"الكل"}</h2>
    </div>
    <div id="sales-content"><div class="bi-empty">⏳ جاري تحميل بيانات المبيعات الموحدة...</div></div>
  `;try{const i=document.getElementById("date-from")?document.getElementById("date-from").value:"",b=document.getElementById("date-to")?document.getElementById("date-to").value:"";let c=i,h=b;!c&&!h&&e.length>0&&(c=`${Math.min(...e)}-01-01`,h=`${Math.max(...e)}-12-31`);const f={limit:5e4};c&&(f.dateFrom=c),h&&(f.dateTo=h),a.length>0&&(f.masterCompanyIds=a.join(",")),r&&r.length>0&&(f.costCenters=r.join(","));const w=await ct.sales.getInvoices(f);let S=0,d=0,y=0,m=0,v=0,p=0,n=0;const u=[],g={},C=new Array(12).fill(0),T={};(w.items||[]).forEach(M=>{if(M.state==="draft")return;p++;const L=parseFloat(M.amount_total)||0;let P=0,N=0,H="";try{const I=M.raw_data?JSON.parse(M.raw_data):{};P=parseFloat(I.total_paid)||0,N=parseFloat(I.amount_untaxed)||0,H=I.move_type||""}catch{}if(H==="Customer Credit Note"||H==="out_refund"||L<0||(S+=L,d+=N,y+=L-N),m+=P,H==="Customer Credit Note"||H==="out_refund"){n+=Math.abs(L);let I="";try{M.raw_data&&(I=JSON.parse(M.raw_data).reference||"")}catch{}u.push({name:M.name||M.invoice_number||"بدون رقم",partner:M.partner_name||"غير معروف",date:M.date||"",amount:Math.abs(L),ref:I})}const R=M.company_name&&M.company_name.trim()!==""?M.company_name:"أخرى";if(g[R]||(g[R]=0),g[R]+=L,M.date){const I=M.date.split("-");if(I.length>=2){const E=parseInt(I[1],10);E>=1&&E<=12&&(C[E-1]+=L)}}const q=M.partner_name&&M.partner_name.trim()!==""?M.partner_name:"عميل غير معروف";T[q]||(T[q]={name:q,total:0,untaxed:0,tax:0,paid:0,rem:0,refunds:0}),H==="Customer Credit Note"||H==="out_refund"||L<0?T[q].refunds+=Math.abs(L):(T[q].total+=L,T[q].untaxed+=N,T[q].tax+=L-N),T[q].paid+=P,T[q].rem=T[q].total-T[q].refunds-T[q].paid}),v=S-n-m;const A=Object.values(T).sort((M,L)=>L.total-M.total),k=A.slice(0,10),z=m+n,$=S>0?z/S*100:0,F=S>0?v/S*100:0;let D=`
      <style>
        .skpi-grid { display: grid; grid-template-columns: repeat(12, 1fr); gap: 16px; margin-bottom: 24px; }
        .skpi { background: rgba(255,255,255,0.02); border-radius: 16px; padding: 20px; display: flex; flex-direction: column; justify-content: center; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); border: 1px solid rgba(255,255,255,0.05); }
        .skpi:hover { transform: translateY(-4px); box-shadow: 0 12px 24px -8px rgba(0,0,0,0.5); border-color: rgba(255,255,255,0.1); }
        .skpi-lbl { font-size: 0.95rem; color: rgba(255,255,255,0.6); margin-bottom: 8px; font-weight: 600; display:flex; align-items:center; gap:8px; }
        .skpi-val { font-size: 1.6rem; font-weight: 800; font-family: var(--font-en); }
        .skpi-4 { grid-column: span 4; }
        .skpi-6 { grid-column: span 6; }
        @media (max-width: 1200px) { .skpi-4 { grid-column: span 6; } }
        @media (max-width: 768px) { .skpi-4, .skpi-6 { grid-column: span 12; } }
        
        .skpi-hero-gross { border-right: 4px solid #10b981; background: linear-gradient(135deg, rgba(16,185,129,0.08) 0%, transparent 100%); }
        .skpi-hero-refund { border-right: 4px solid #f43f5e; background: linear-gradient(135deg, rgba(244,63,94,0.08) 0%, transparent 100%); }
        .skpi-hero-net { border-right: 4px solid #3b82f6; background: linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(15,23,42,0.8) 100%); box-shadow: inset 0 0 20px rgba(59,130,246,0.05); }
        .skpi-hero-net .skpi-val { font-size: 2.2rem; text-shadow: 0 0 20px rgba(59,130,246,0.4); }
        .skpi-hero-net .skpi-lbl { color: #93c5fd; font-size: 1.1rem; }
        
        .skpi-prog-paid { border-top: 3px solid #06b6d4; background: linear-gradient(180deg, rgba(6,182,212,0.05) 0%, transparent 100%); }
        .skpi-prog-rem { border-top: 3px solid #f59e0b; background: linear-gradient(180deg, rgba(245,158,11,0.05) 0%, transparent 100%); }
      </style>
      <div class="skpi-grid">
        <div class="skpi skpi-4 skpi-hero-gross">
          <div class="skpi-lbl">🛍️ إجمالي المبيعات المفوترة</div>
          <div class="skpi-val" style="color:#10b981;">${o(S)}</div>
        </div>
        <div class="skpi skpi-4 skpi-hero-refund">
          <div class="skpi-lbl">💸 إشعارات المرتجعات</div>
          <div class="skpi-val" style="color:#f43f5e;">${o(n)}</div>
        </div>
        <div class="skpi skpi-4 skpi-hero-net">
          <div class="skpi-lbl">📈 صافي المبيعات</div>
          <div class="skpi-val" style="color:#60a5fa;">${o(S-n)}</div>
        </div>

        <div class="skpi skpi-4">
          <div class="skpi-lbl">📝 قبل الضريبة</div>
          <div class="skpi-val" style="color:#8b5cf6;">${o(d)}</div>
        </div>
        <div class="skpi skpi-4">
          <div class="skpi-lbl">⚖️ قيمة الضريبة</div>
          <div class="skpi-val" style="color:#f43f5e;">${o(y)}</div>
        </div>
        <div class="skpi skpi-4">
          <div class="skpi-lbl">🧾 عدد الفواتير الإجمالي</div>
          <div class="skpi-val" style="color:#a78bfa;">${o(p)}</div>
        </div>

        <div class="skpi skpi-6 skpi-prog-paid">
          <div class="skpi-lbl">✅ إجمالي المحصّل (متضمناً المرتجعات)</div>
          <div class="skpi-val" style="color:#06b6d4;font-size:1.8rem;">${o(z)}</div>
          <div style="margin-top:16px;display:flex;align-items:center;gap:16px;">
            <div style="flex:1;height:8px;background:rgba(0,0,0,0.4);border-radius:4px;overflow:hidden;box-shadow:inset 0 1px 3px rgba(0,0,0,0.5);">
              <div style="width:${$}%;height:100%;background:linear-gradient(90deg, #0891b2, #22d3ee);border-radius:4px;box-shadow:0 0 12px #06b6d4;"></div>
            </div>
            <span style="color:#22d3ee;font-size:1.05rem;font-weight:700;"><span style="font-family:var(--font-en);">${B($)}</span></span>
          </div>
        </div>
        <div class="skpi skpi-6 skpi-prog-rem">
          <div class="skpi-lbl">⏳ المتبقي للتحصيل</div>
          <div class="skpi-val" style="color:#f59e0b;font-size:1.8rem;">${o(Math.max(0,v))}</div>
          <div style="margin-top:16px;display:flex;align-items:center;gap:16px;">
            <div style="flex:1;height:8px;background:rgba(0,0,0,0.4);border-radius:4px;overflow:hidden;box-shadow:inset 0 1px 3px rgba(0,0,0,0.5);">
              <div style="width:${Math.max(0,F)}%;height:100%;background:linear-gradient(90deg, #d97706, #fbbf24);border-radius:4px;box-shadow:0 0 12px #f59e0b;"></div>
            </div>
            <span style="color:#fbbf24;font-size:1.05rem;font-weight:700;"><span style="font-family:var(--font-en);">${B(Math.max(0,F))}</span></span>
          </div>
        </div>
      </div>
      
      <div class="bi-charts">
        <div class="bi-card">
          <div class="bi-card-title">📈 حجم المبيعات الشهرية</div>
          <canvas id="ch-sales-monthly" height="260"></canvas>
        </div>
        <div class="bi-card">
          <div class="bi-card-title">🏢 مساهمة الشركات في المبيعات</div>
          <canvas id="ch-sales-companies" height="260"></canvas>
        </div>
      </div>
      
      <div class="bi-card bi-full" style="margin-top:20px;">
        <div class="bi-card-title">📊 أهم 10 عملاء (حجم المبيعات)</div>
        <canvas id="ch-sales-partners" height="120"></canvas>
      </div>
      
      <div class="bi-card bi-full" style="margin-top:20px;">
        <div class="bi-card-title" style="display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-items:center;">
          <div style="margin:0;">🏆 تفاصيل جميع العملاء</div>
          <input type="text" id="sales-partner-search" placeholder="🔍 ابحث عن عميل..." style="padding:8px 16px;border-radius:8px;border:1px solid rgba(255,255,255,0.1);background:rgba(0,0,0,0.2);color:#fff;width:300px;font-family:var(--font-ar);outline:none;">
        </div>
        <div style="overflow-x:auto;max-height:500px;">
          <table class="bi-table">
            <thead style="position:sticky;top:0;background:#0c122f;z-index:10;box-shadow:0 4px 6px -1px rgba(0,0,0,0.2);">
              <tr>
                <th style="width:40px;">#</th>
                <th style="text-align:right;cursor:pointer;user-select:none;" onclick="salesTableSort('name')">اسم العميل ⇅</th>
                <th class="n" style="cursor:pointer;user-select:none;" onclick="salesTableSort('untaxed')">قبل الضريبة ⇅</th>
                <th class="n" style="cursor:pointer;user-select:none;" onclick="salesTableSort('tax')">الضريبة ⇅</th>
                <th class="n" style="cursor:pointer;user-select:none;" onclick="salesTableSort('total')">الإجمالي ⇅</th>
                <th class="n" style="color:#ef4444;cursor:pointer;user-select:none;" onclick="salesTableSort('refunds')">المرتجعات ⇅</th>
                <th class="n" style="color:#3b82f6;cursor:pointer;user-select:none;" onclick="salesTableSort('net')">صافي المبيعات ⇅</th>
                <th class="n" style="cursor:pointer;user-select:none;" onclick="salesTableSort('paid')">المحصّل ⇅</th>
                <th class="n" style="cursor:pointer;user-select:none;" onclick="salesTableSort('rem')">المتبقي ⇅</th>
                <th class="n" style="cursor:pointer;user-select:none;" onclick="salesTableSort('share')">نسبة الشراء ⇅</th>
              </tr>
            </thead>
            <tbody id="sales-partner-tbody">
              <!-- Rendered via JS -->
            </tbody>
            <tfoot id="sales-partner-tfoot" style="position:sticky;bottom:-1px;background:#0c122f;z-index:10;box-shadow:0 -4px 6px -1px rgba(0,0,0,0.4);">
            </tfoot>
          </table>
        </div>
      </div>
      
      <div class="bi-card bi-full" style="margin-top:20px; border:1px solid rgba(239, 68, 68, 0.2);">
        <div class="bi-card-title" style="color:#ef4444;">💸 تفاصيل الإشعارات المرتجعة المخصومة</div>
        <div style="overflow-x:auto;max-height:400px;">
          <table class="bi-table">
            <thead style="position:sticky;top:0;background:#1e1424;z-index:10;box-shadow:0 4px 6px -1px rgba(0,0,0,0.2);">
              <tr>
                <th style="width:40px;color:#fca5a5;">#</th>
                <th style="text-align:right;color:#fca5a5;">الإشعار</th>
                <th style="text-align:right;color:#fca5a5;">التاريخ</th>
                <th style="text-align:right;color:#fca5a5;">العميل</th>
                <th style="text-align:right;color:#fca5a5;">الفاتورة المرتبطة</th>
                <th class="n" style="color:#fca5a5;">المبلغ</th>
              </tr>
            </thead>
            <tbody id="sales-refunds-tbody">
              <!-- Rendered via JS -->
            </tbody>
            <tfoot id="sales-refunds-tfoot" style="position:sticky;bottom:-1px;background:#1e1424;z-index:10;box-shadow:0 -4px 6px -1px rgba(0,0,0,0.4);">
            </tfoot>
          </table>
        </div>
      </div>
    `;const O=t.querySelector("#sales-content");O.innerHTML=D,requestAnimationFrame(()=>{Et(document.getElementById("ch-sales-monthly"),C,"#10b981","#34d399");const M=Object.keys(g),L=Object.values(g);L.length>0&&mt(document.getElementById("ch-sales-companies"),{labels:M,values:L,colors:Q});const P=null;if(k.length>0){const j=k.map(X=>X.name.length>25?X.name.substring(0,25)+"..":X.name),W=k.map(X=>X.total),Y=Math.max(...W,1);Ct(document.getElementById("ch-sales-partners"),{groups:W.map(X=>[X]),max:Y,colors:["#3b82f6"],labels:j,exactValues:!0})}const N=document.getElementById("sales-partner-tbody"),H=document.getElementById("sales-partner-search");let R="total",q=-1,I="date",E=-1;const _=j=>new Intl.NumberFormat("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}).format(j);window.salesTableSort=j=>{var W;R===j?q*=-1:(R=j,q=-1),J(((W=document.getElementById("sales-partner-search"))==null?void 0:W.value)||"")},window.refundsTableSort=j=>{I===j?E*=-1:(I=j,E=-1),tt()};const tt=()=>{const j=document.getElementById("sales-refunds-tbody");if(!j)return;if(u.length===0){j.innerHTML='<tr><td colspan="6" style="text-align:center;padding:20px;color:rgba(255,255,255,0.3);">لا توجد إشعارات أو مرتجعات</td></tr>';return}let W=[...u];W.sort((et,at)=>{const ot=et[I]??0,nt=at[I]??0;return["name","date","partner"].includes(I)?E*String(ot).localeCompare(String(nt),"ar"):E*(Number(ot)-Number(nt))});const Y=W.reduce((et,at)=>et+at.amount,0),X='<tr style="border-top:2px solid rgba(239,68,68,0.3);background:rgba(239,68,68,0.06);font-weight:700;"><td style="color:rgba(255,255,255,0.4);">Σ</td><td style="color:#fca5a5;">المجموع ('+W.length+')</td><td></td><td></td><td></td><td class="n" style="color:#ef4444;font-weight:bold;">'+_(Y)+"</td></tr>";document.getElementById("sales-refunds-tfoot").innerHTML=X,j.innerHTML=W.map((et,at)=>'<tr style="border-bottom:1px solid rgba(255,255,255,0.05);"><td style="font-family:var(--font-en);color:rgba(252,165,165,0.7);">'+(at+1)+'</td><td style="font-family:var(--font-en);">'+et.name+'</td><td style="font-family:var(--font-en);">'+et.date+'</td><td style="font-weight:700;">'+et.partner+'</td><td style="font-family:var(--font-en);color:#93c5fd;">'+(et.ref||"—")+'</td><td class="n" style="color:#ef4444;font-weight:bold;">'+_(et.amount)+"</td></tr>").join("")},J=j=>{let W=[...A];W.sort((G,K)=>{const it=R==="name"?G.name:R==="net"?(G.total||0)-(G.refunds||0):G[R]||0,bt=R==="name"?K.name:R==="net"?(K.total||0)-(K.refunds||0):K[R]||0;return R==="name"?q*String(it).localeCompare(String(bt),"ar"):q*(Number(it)-Number(bt))});let Y=j?W.filter(G=>G.name.toLowerCase().includes(j.toLowerCase())):W;if(Y.length===0){N.innerHTML='<tr><td colspan="9" style="text-align:center;padding:20px;color:rgba(255,255,255,0.4);">لا توجد نتائج مطابقة</td></tr>';return}const X=Y.reduce((G,K)=>G+K.untaxed,0),et=Y.reduce((G,K)=>G+K.tax,0),at=Y.reduce((G,K)=>G+K.total,0),ot=Y.reduce((G,K)=>G+K.refunds,0),nt=at-ot,st=Y.reduce((G,K)=>G+K.paid,0),rt=Y.reduce((G,K)=>G+Math.max(0,K.rem),0),ht='<tr style="border-top:2px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.04);font-weight:700;"><td style="color:rgba(255,255,255,0.4);text-align:center;">Σ</td><td style="color:#fff;">المجموع ('+Y.length+')</td><td class="n" style="color:#8b5cf6;">'+_(X)+'</td><td class="n" style="color:#f43f5e;">'+_(et)+'</td><td class="n" style="color:#10b981;">'+_(at)+'</td><td class="n" style="color:#ef4444;">'+(ot>0?_(ot):"—")+'</td><td class="n" style="color:#3b82f6;">'+_(nt)+'</td><td class="n" style="color:#06b6d4;">'+_(st)+'</td><td class="n" style="color:#f59e0b;">'+_(rt)+'</td><td class="n" style="color:rgba(255,255,255,0.5);">100%</td></tr>';document.getElementById("sales-partner-tfoot").innerHTML=ht,N.innerHTML=Y.map((G,K)=>{const it=G.total-G.refunds;return'<tr style="border-bottom:1px solid rgba(255,255,255,0.05);"><td style="font-family:var(--font-en);color:rgba(255,255,255,0.4);">'+(K+1)+'</td><td style="font-weight:700;color:var(--text-white);">'+G.name+'</td><td class="n" style="color:#8b5cf6;">'+_(G.untaxed)+'</td><td class="n" style="color:#f43f5e;">'+_(G.tax)+'</td><td class="n" style="color:#10b981;font-weight:700;">'+_(G.total)+'</td><td class="n" style="color:#ef4444;font-weight:bold;">'+(G.refunds>0?_(G.refunds):"—")+'</td><td class="n" style="color:#3b82f6;font-weight:700;">'+_(it)+'</td><td class="n" style="color:#06b6d4;">'+_(G.paid)+'</td><td class="n" style="color:#f59e0b;">'+_(Math.max(0,G.rem))+'</td><td class="n" style="color:rgba(255,255,255,0.5);">'+(S>0?B(G.total/S*100):"0%")+"</td></tr>"}).join("")};J(""),tt(),H&&H.addEventListener("input",j=>{J(j.target.value)})})}catch(i){console.error("Sales overview error:",i),t.querySelector("#sales-content").innerHTML=`<div class="bi-empty" style="color:#ef4444;">❌ خطأ في عرض بيانات المبيعات: ${i.message}</div>`}}async function xe(t,s,l,r){const e=s._selectedYrs||[],a=s._selectedCos||[];t.innerHTML=`
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;flex-wrap:wrap;">
      <h2 style="margin:0;color:rgba(255,255,255,0.85);font-size:1.3rem;">🛒 تفاصيل جميع العملاء والمبيعات (هرمي)</h2>
    </div>
    <div id="sales-hier-content"><div class="bi-empty">⏳ جاري تحميل تفاصيل العملاء...</div></div>
  `;try{const i=document.getElementById("date-from")?document.getElementById("date-from").value:"",b=document.getElementById("date-to")?document.getElementById("date-to").value:"";let c=i,h=b;!c&&!h&&e.length>0&&(c=`${Math.min(...e)}-01-01`,h=`${Math.max(...e)}-12-31`);const f={};c&&(f.dateFrom=c),h&&(f.dateTo=h),a.length>0&&(f.masterCompanyIds=a.join(",")),r&&r.length>0&&(f.costCenters=r.join(","));const w=await ct.sales.getCustomerHierarchy(f);if(!w||!w.hierarchy)throw new Error("فشل جلب أرقام الهيكل");const S=w.hierarchy;let d=0,y=0,m=0,v=0,p=0,n=0,u=0;const g=Object.keys(S);let C="";g.forEach((A,k)=>{const z=S[A];let $=0,F=0,D=0,O=0,M=0,L=0,P=0,N="";Object.keys(z).forEach((R,q)=>{const I=z[R];let E=0,_=0,tt=0,J=0,j=0,W=0,Y=0,X="";Object.keys(I).forEach((at,ot)=>{const nt=I[at];let st=0,rt=0,ht=0,G=0,K=0,it=0,bt=0,Mt="";Object.keys(nt).forEach(Lt=>{const V=nt[Lt];st+=V.total,rt+=V.untaxed,ht+=V.tax,G+=V.refunds,it+=V.paid,bt+=V.rem,V.net=V.total-V.refunds;const Ht=V.net,jt=V.net>0?V.paid/V.net*100:V.total>0?V.paid/V.total*100:0;Mt+=`
              <tr class="row-pt sales-row-pt-${k} sales-row-pt-${k}-${q} sales-row-pt-${k}-${q}-${ot}" style="display:none; transition: all 0.2s ease;">
                <td style="padding-right:70px; font-weight:400; font-size:0.95rem;">👤 ${Lt}</td>
                <td class="n">${o(V.untaxed)}</td>
                <td class="n">${o(V.tax)}</td>
                <td class="n" style="color:#ef4444">${o(V.refunds)}</td>
                <td class="n" style="font-weight:700">${o(V.total)}</td>
                <td class="n" style="color:#3b82f6;font-weight:700">${o(Ht)}</td>
                <td class="n" style="color:#10b981">${o(V.paid)}</td>
                <td class="n" style="color:#f59e0b">${o(V.rem)}</td>
                <td class="n">${B(jt)}</td>
              </tr>
            `}),K=st-G,E+=st,_+=rt,tt+=ht,J+=G,j+=K,W+=it,Y+=bt;const _t=K>0?it/K*100:0;X+=`
            <tr class="row-cc sales-row-cc-${k} sales-row-cc-${k}-${q}" style="display:none;" onclick="
              this.classList.toggle('open'); 
              document.querySelectorAll('.sales-row-pt-${k}-${q}-${ot}').forEach(e => {
                e.style.display = e.style.display === 'none' ? 'table-row' : 'none';
              });
            ">
              <td style="padding-right:50px;font-weight:600;color:#67e8f9;">🏗️ ${at}</td>
              <td class="n">${o(rt)}</td>
              <td class="n">${o(ht)}</td>
              <td class="n" style="color:#ef4444">${o(G)}</td>
              <td class="n" style="font-weight:700">${o(st)}</td>
              <td class="n" style="color:#3b82f6">${o(K)}</td>
              <td class="n" style="color:#10b981">${o(it)}</td>
              <td class="n" style="color:#f59e0b">${o(bt)}</td>
              <td class="n">${B(_t)}</td>
            </tr>
          `,X+=Mt}),j=E-J,$+=E,F+=_,D+=tt,O+=J,M+=j,L+=W,P+=Y;const et=j>0?W/j*100:0;N+=`
          <tr class="row-cc sales-row-grp-${k}" style="display:none;" onclick="
            this.classList.toggle('open'); 
            document.querySelectorAll('.sales-row-cc-${k}-${q}').forEach(e => {
              e.style.display = e.style.display === 'none' ? 'table-row' : 'none';
              if(e.style.display === 'none') {
                e.classList.remove('open');
                const rowPts = document.querySelectorAll('.sales-row-pt-${k}-${q}');
                rowPts.forEach(p => p.style.display = 'none');
              }
            });
          ">
            <td style="padding-right:30px;font-weight:700;color:#fcd34d;">📂 ${R} (المجموعة)</td>
            <td class="n">${o(_)}</td>
            <td class="n">${o(tt)}</td>
            <td class="n" style="color:#ef4444">${o(J)}</td>
            <td class="n" style="font-weight:700">${o(E)}</td>
            <td class="n" style="color:#3b82f6">${o(j)}</td>
            <td class="n" style="color:#10b981">${o(W)}</td>
            <td class="n" style="color:#f59e0b">${o(Y)}</td>
            <td class="n">${B(et)}</td>
          </tr>
        `,N+=X}),M=$-O,d+=$,y+=F,m+=D,v+=O,p+=M,n+=L,u+=P;const H=M>0?L/M*100:0;C+=`
        <tr class="row-co" onclick="
          this.classList.toggle('open'); 
          document.querySelectorAll('.sales-row-grp-${k}').forEach(e => {
            e.style.display = e.style.display === 'none' ? 'table-row' : 'none';
            if(e.style.display === 'none') {
              e.classList.remove('open');
              document.querySelectorAll('.sales-row-cc-${k}').forEach(c => {
                c.style.display = 'none';
                c.classList.remove('open');
              });
              document.querySelectorAll('.sales-row-pt-${k}').forEach(p => p.style.display = 'none');
            }
          });
        ">
          <td style="font-weight:800;color:#c084fc;">🏢 ${A}</td>
          <td class="n" style="color:#c084fc">${o(F)}</td>
          <td class="n" style="color:#c084fc">${o(D)}</td>
          <td class="n" style="color:#ef4444">${o(O)}</td>
          <td class="n" style="font-weight:800;color:#c084fc">${o($)}</td>
          <td class="n" style="color:#3b82f6;font-weight:800">${o(M)}</td>
          <td class="n" style="color:#10b981;font-weight:800">${o(L)}</td>
          <td class="n" style="color:#f59e0b;font-weight:800">${o(P)}</td>
          <td class="n" style="color:#c084fc">${B(H)}</td>
        </tr>
      `,C+=N});const T=p>0?n/p*100:0;document.getElementById("sales-hier-content").innerHTML=`
      <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px; padding: 0 8px;">
        <div style="width: 6px; height: 28px; background: linear-gradient(180deg, #3b82f6, #06b6d4); border-radius: 6px;"></div>
        <h2 style="margin: 0; font-size: 1.5rem; color: #f8fafc; font-weight: 800; letter-spacing: -0.5px;">🛒 تفاصيل جميع العملاء والمبيعات <span style="font-size: 1.1rem; color: #94a3b8; font-weight: 600; margin-right: 6px;">(هرمي)</span></h2>
      </div>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; margin-bottom: 32px;">
        <!-- Net Sales Card -->
        <div style="position: relative; overflow: hidden; border-radius: 24px; padding: 28px; background: linear-gradient(145deg, rgba(16,185,129,0.08) 0%, rgba(15,23,42,0.8) 100%); border: 1px solid rgba(16,185,129,0.15); box-shadow: 0 12px 40px rgba(0,0,0,0.25); backdrop-filter: blur(12px); display: flex; flex-direction: column; justify-content: center; transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); cursor: default;" onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='translateY(0)'">
          <div style="position: absolute; top: -30px; right: -30px; width: 140px; height: 140px; background: rgba(16,185,129,0.15); filter: blur(45px); border-radius: 50%; pointer-events: none;"></div>
          <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 20px;">
            <div style="width: 54px; height: 54px; border-radius: 16px; background: rgba(16,185,129,0.12); display: flex; align-items: center; justify-content: center; font-size: 1.6rem; border: 1px solid rgba(16,185,129,0.25); box-shadow: 0 4px 12px rgba(16,185,129,0.1);">📈</div>
            <div style="font-size: 1.15rem; color: #94a3b8; font-weight: 700;">صافي المبيعات الكلي</div>
          </div>
          <div style="font-size: 2.6rem; font-weight: 800; color: #34d399; font-family: var(--font-en); letter-spacing: -1px; display: flex; align-items: baseline; gap: 8px; text-shadow: 0 2px 10px rgba(52,211,153,0.2);">
            ${o(p)} <span style="font-size: 1rem; color: #64748b; font-weight: 600; text-shadow: none;">ر.س</span>
          </div>
        </div>

        <!-- Remaining Balance Card -->
        <div style="position: relative; overflow: hidden; border-radius: 24px; padding: 28px; background: linear-gradient(145deg, rgba(245,158,11,0.08) 0%, rgba(15,23,42,0.8) 100%); border: 1px solid rgba(245,158,11,0.15); box-shadow: 0 12px 40px rgba(0,0,0,0.25); backdrop-filter: blur(12px); display: flex; flex-direction: column; justify-content: center; transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); cursor: default;" onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='translateY(0)'">
          <div style="position: absolute; top: -30px; right: -30px; width: 140px; height: 140px; background: rgba(245,158,11,0.15); filter: blur(45px); border-radius: 50%; pointer-events: none;"></div>
          <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 20px;">
            <div style="width: 54px; height: 54px; border-radius: 16px; background: rgba(245,158,11,0.12); display: flex; align-items: center; justify-content: center; font-size: 1.6rem; border: 1px solid rgba(245,158,11,0.25); box-shadow: 0 4px 12px rgba(245,158,11,0.1);">⏳</div>
            <div style="font-size: 1.15rem; color: #94a3b8; font-weight: 700;">الرصيد المتبقي</div>
          </div>
          <div style="font-size: 2.6rem; font-weight: 800; color: #fbbf24; font-family: var(--font-en); letter-spacing: -1px; display: flex; align-items: baseline; gap: 8px; text-shadow: 0 2px 10px rgba(251,191,36,0.2);">
            ${o(u)} <span style="font-size: 1rem; color: #64748b; font-weight: 600; text-shadow: none;">ر.س</span>
          </div>
        </div>

        <!-- Collection Card -->
        <div style="position: relative; overflow: hidden; border-radius: 24px; padding: 28px; background: linear-gradient(145deg, rgba(6,182,212,0.08) 0%, rgba(15,23,42,0.8) 100%); border: 1px solid rgba(6,182,212,0.15); box-shadow: 0 12px 40px rgba(0,0,0,0.25); backdrop-filter: blur(12px); display: flex; flex-direction: column; justify-content: space-between; transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); cursor: default;" onmouseover="this.style.transform='translateY(-4px)'" onmouseout="this.style.transform='translateY(0)'">
          <div style="position: absolute; top: -30px; right: -30px; width: 140px; height: 140px; background: rgba(6,182,212,0.15); filter: blur(45px); border-radius: 50%; pointer-events: none;"></div>
          <div>
            <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 16px;">
              <div style="width: 54px; height: 54px; border-radius: 16px; background: rgba(6,182,212,0.12); display: flex; align-items: center; justify-content: center; font-size: 1.6rem; border: 1px solid rgba(6,182,212,0.25); box-shadow: 0 4px 12px rgba(6,182,212,0.1);">✅</div>
              <div style="font-size: 1.15rem; color: #94a3b8; font-weight: 700;">إجمالي المحصّل الفعلي</div>
            </div>
            <div style="font-size: 2.6rem; font-weight: 800; color: #22d3ee; font-family: var(--font-en); letter-spacing: -1px; margin-bottom: 24px; display: flex; align-items: baseline; gap: 8px; text-shadow: 0 2px 10px rgba(34,211,238,0.2);">
              ${o(n)} <span style="font-size: 1rem; color: #64748b; font-weight: 600; text-shadow: none;">ر.س</span>
            </div>
          </div>
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; justify-content: space-between; font-size: 0.95rem; color: #67e8f9; font-weight: 700; align-items: center;">
              <span>نسبة التحصيل من الصافي</span>
              <span style="font-family: var(--font-en); font-size: 1.1rem; background: rgba(6,182,212,0.15); padding: 4px 10px; border-radius: 8px; border: 1px solid rgba(6,182,212,0.3);">${B(T)}</span>
            </div>
            <div style="height: 8px; background: rgba(0,0,0,0.4); border-radius: 6px; overflow: hidden; box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);">
              <div style="height: 100%; width: ${Math.min(T,100)}%; background: linear-gradient(90deg, #0284c7, #22d3ee, #67e8f9); border-radius: 6px; transition: width 1s ease-out; box-shadow: 0 0 10px rgba(34,211,238,0.5);"></div>
            </div>
          </div>
        </div>
      </div>
      <div class="bi-card bi-full" style="padding:0;">
        <div style="overflow-x:auto;">
          <table class="bi-table">
            <thead style="background:rgba(15,23,42,0.95);position:sticky;top:0;z-index:20;">
              <tr>
                <th style="min-width:350px;">وصف الشجرة المعتمدة (الشركة > المجموعة > المركز > العميل)</th>
                <th class="n">قبل الضريبة</th>
                <th class="n">الضريبة</th>
                <th class="n" style="color:#fca5a5;">مرتجعات / خصم</th>
                <th class="n" style="color:#d8b4fe;">المبيعات الإجمالية</th>
                <th class="n" style="color:#93c5fd;">صافي المبيعات</th>
                <th class="n" style="color:#6ee7b7;">التحصيل</th>
                <th class="n" style="color:#fca5a5;">الرصيد المتبقي</th>
                <th class="n">% التحصيل (من الصافي)</th>
              </tr>
            </thead>
            <tbody>${C}</tbody>
            <tfoot style="background:rgba(15,23,42,0.95);position:sticky;bottom:-1px;z-index:20;box-shadow:0 -4px 10px rgba(0,0,0,0.3);">
              <tr>
                <td style="color:#e2e8f0;font-size:1.15rem;">📊 إجمالي محفظة المبيعات</td>
                <td class="n" style="color:#e2e8f0">${o(y)}</td>
                <td class="n" style="color:#e2e8f0">${o(m)}</td>
                <td class="n" style="color:#ef4444">${o(v)}</td>
                <td class="n" style="color:#c4b5fd">${o(d)}</td>
                <td class="n" style="color:#3b82f6">${o(p)}</td>
                <td class="n" style="color:#10b981">${o(n)}</td>
                <td class="n" style="color:#f59e0b">${o(u)}</td>
                <td class="n" style="color:#e2e8f0">${B(T)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `}catch(i){console.error("Hier error:",i),document.getElementById("sales-hier-content").innerHTML=`<div class="bi-empty" style="color:#ef4444">❌ خطأ: ${i.message}</div>`}}export{$e as _,yt as a,ct as b,ke as c,Ee as d,Dt as f,we as g,Se as r,kt as s};
