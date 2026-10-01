(function(){const s=document.createElement("link").relList;if(s&&s.supports&&s.supports("modulepreload"))return;for(const e of document.querySelectorAll('link[rel="modulepreload"]'))r(e);new MutationObserver(e=>{for(const a of e)if(a.type==="childList")for(const i of a.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&r(i)}).observe(document,{childList:!0,subtree:!0});function l(e){const a={};return e.integrity&&(a.integrity=e.integrity),e.referrerPolicy&&(a.referrerPolicy=e.referrerPolicy),e.crossOrigin==="use-credentials"?a.credentials="include":e.crossOrigin==="anonymous"?a.credentials="omit":a.credentials="same-origin",a}function r(e){if(e.ep)return;e.ep=!0;const a=l(e);fetch(e.href,a)}})();const Gt="modulepreload",Yt=function(t){return"/"+t},It={},we=function(s,l,r){let e=Promise.resolve();if(l&&l.length>0){document.getElementsByTagName("link");const i=document.querySelector("meta[property=csp-nonce]"),b=(i==null?void 0:i.nonce)||(i==null?void 0:i.getAttribute("nonce"));e=Promise.allSettled(l.map(d=>{if(d=Yt(d),d in It)return;It[d]=!0;const g=d.endsWith(".css"),p=g?'[rel="stylesheet"]':"";if(document.querySelector(`link[href="${d}"]${p}`))return;const k=document.createElement("link");if(k.rel=g?"stylesheet":Gt,g||(k.as="script"),k.crossOrigin="",k.href=d,b&&k.setAttribute("nonce",b),document.head.appendChild(k),g)return new Promise((T,u)=>{k.addEventListener("load",T),k.addEventListener("error",()=>u(new Error(`Unable to preload CSS for ${d}`)))})}))}function a(i){const b=new Event("vite:preloadError",{cancelable:!0});if(b.payload=i,window.dispatchEvent(b),!b.defaultPrevented)throw i}return e.then(i=>{for(const b of i||[])b.status==="rejected"&&a(b.reason);return s().catch(a)})};class Ut{constructor(){this.state={currentPage:"dashboard",companies:[],selectedCompanyIds:[],dateFrom:"",dateTo:"",costCenter:"",accountType:"",fiscalYear:"",filterOptions:{periods:[],fiscalYears:[],accountTypes:[],costCenters:[]},sidebarCollapsed:!1,loading:!1},this.listeners=[]}get(s){return this.state[s]}set(s,l){this.state[s]=l,this.notify(s)}update(s){Object.assign(this.state,s),Object.keys(s).forEach(l=>this.notify(l))}subscribe(s){return this.listeners.push(s),()=>{this.listeners=this.listeners.filter(l=>l!==s)}}notify(s){this.listeners.forEach(l=>l(s,this.state[s],this.state))}getFilterParams(){const s={};return this.state.selectedCompanyIds.length>0&&(s.companyIds=this.state.selectedCompanyIds),this.state.dateFrom&&(s.dateFrom=this.state.dateFrom),this.state.dateTo&&(s.dateTo=this.state.dateTo),this.state.costCenter&&(s.costCenter=this.state.costCenter),this.state.accountType&&(s.accountType=this.state.accountType),this.state.fiscalYear&&(s.fiscalYear=this.state.fiscalYear),s}}const Et=new Ut,Jt="/api";async function $(t,s={}){const l=`${Jt}${t}`,r={headers:{"Content-Type":"application/json"},...s},e=localStorage.getItem("mizaniat_admin_token");e&&(r.headers={...r.headers,Authorization:`Bearer ${e}`}),r.body&&typeof r.body=="object"&&(r.body=JSON.stringify(r.body));const a=await fetch(l,r);if(a.status===401)throw localStorage.removeItem("mizaniat_admin_token"),localStorage.removeItem("mizaniat_admin_info"),localStorage.removeItem("mizaniat_viewer_mode"),window.location.href="/login.html",new Error("جلسة غير صالحة");if(!a.ok){const i=await a.json().catch(()=>({error:a.statusText}));throw new Error(i.error||i.message||`HTTP ${a.status}`)}return a.json()}const it={getCompanies:()=>$("/companies"),createCompany:t=>$("/companies",{method:"POST",body:t}),updateCompany:(t,s)=>$(`/companies/${t}`,{method:"PUT",body:s}),getInstances:()=>$("/instances"),createInstance:t=>$("/instances",{method:"POST",body:t}),updateInstance:(t,s)=>$(`/instances/${t}`,{method:"PUT",body:s}),deleteInstance:t=>$(`/instances/${t}`,{method:"DELETE"}),testInstance:(t,s)=>$(`/instances/${t}/test`,{method:"POST",body:{company_id:s}}),getDashboard:t=>$(`/reports/dashboard?${U(t)}`),getIncomeStatement:t=>$(`/reports/income-statement?${U(t)}`),getBalanceSheet:t=>$(`/reports/balance-sheet?${U(t)}`),getCashFlow:t=>$(`/reports/cash-flow?${U(t)}`),getPivotData:t=>$(`/reports/pivot?${U(t)}`),getTrialBalance:t=>$(`/reports/trial-balance?${U(t)}`),getDetailedTrialBalance:t=>$(`/reports/detailed-trial-balance?${U(t)}`),getPartnerAccountConfig:t=>$(`/partner-account-config?${U(t)}`),savePartnerAccountConfig:t=>$("/partner-account-config",{method:"POST",body:t}),getSpecialExpenses:()=>$("/external/special-expenses"),getAnalyticGroups:()=>$("/analytic-groups"),createAnalyticGroup:t=>$("/analytic-groups",{method:"POST",body:t}),updateAnalyticGroup:(t,s)=>$(`/analytic-groups/${t}`,{method:"PUT",body:s}),deleteAnalyticGroup:t=>$(`/analytic-groups/${t}`,{method:"DELETE"}),getAnalyticAccounts:t=>$(`/analytic-accounts?${U(t)}`),getAnalyticGroupMappings:t=>$(`/analytic-group-mappings?${U(t)}`),saveAnalyticGroupMappings:t=>$("/analytic-group-mappings",{method:"POST",body:t}),getCompanyJournalNames:t=>$(`/company-journal-names?companyId=${t}`),getJournalMappings:t=>$(`/journal-mappings?companyId=${t}`),mergeJournals:t=>$("/journal-mappings/merge",{method:"POST",body:t}),getVATReport:t=>$(`/vat-report?${U(t)}`),getTaxReportConfig:t=>$(`/tax-report-config/${t}`),saveTaxReportConfig:t=>$("/tax-report-config",{method:"POST",body:t}),generateCustomTaxReport:t=>$("/tax-report-custom",{method:"POST",body:t}),getPresentationData:t=>$(`/presentation/data?${U(t)}`),getPresentationShares:()=>$("/presentation/shares"),createPresentationShare:t=>$("/presentation/share",{method:"POST",body:t}),getPresentationShareData:t=>$(`/presentation/share/${t}`),deletePresentationShare:t=>$(`/presentation/share/${t}`,{method:"DELETE"}),createClosingEntry:t=>$("/closing-entry",{method:"POST",body:t}),getClosingEntries:t=>$(`/closing-entries?${U(t)}`),deleteClosingEntry:t=>$(`/closing-entry?${U(t)}`,{method:"DELETE"}),getCompanyAccounts:t=>$(`/company-accounts?${U(t)}`),getFilterOptions:t=>$(`/filters?${U(t)}`),getCompanyAccounts:t=>$(`/accounts/company/${t}`),getUnifiedAccounts:()=>$("/accounts/unified"),createUnifiedAccount:t=>$("/accounts/unified",{method:"POST",body:t}),createMapping:t=>$("/accounts/mapping",{method:"POST",body:t}),getEliminationRules:()=>$("/eliminations"),createEliminationRule:t=>$("/eliminations",{method:"POST",body:t}),syncCompany:t=>$(`/sync/company/${t}`,{method:"POST"}),syncAll:()=>$("/sync/all",{method:"POST"}),getSyncStatus:()=>$("/sync/status"),getSyncProgress:t=>$(`/sync/progress/${t}`),getSchedule:()=>$("/sync/schedule"),updateSchedule:t=>$("/sync/schedule",{method:"PUT",body:t}),getNotifications:()=>$("/sync/notifications"),clearNotifications:()=>$("/sync/notifications",{method:"DELETE"}),testConnectionDirect:t=>$("/test-connection",{method:"POST",body:t}),getJournalItems:t=>$(`/journal-items?${U(t)}`),getAccountStatement:t=>$(`/account-statement?${U(t)}`),getAccountStatementAccounts:t=>$(`/account-statement/accounts?${U(t)}`),getAccountStatementPartners:t=>$(`/account-statement/partners?${U(t)}`),getGuaranteeDetails:t=>$(`/guarantee-details?${U(t)}`),getGuaranteePendingList:t=>$(`/guarantee-pending-list?${U(t)}`),getGuarantees:t=>$(`/guarantees?${U(t)}`),releaseGuarantee:t=>$("/guarantees/release",{method:"POST",body:t}),unreleaseGuarantee:t=>$(`/guarantees/release?${U(t)}`,{method:"DELETE"}),getGuaranteeSubItems:t=>$(`/guarantee-sub-items?${U(t)}`),addGuaranteeSubItem:t=>$("/guarantee-sub-items",{method:"POST",body:t}),deleteGuaranteeSubItem:t=>$(`/guarantee-sub-items/${t}`,{method:"DELETE"}),sales:{getCompanies:()=>$("/sales/companies"),createCompany:t=>$("/sales/companies",{method:"POST",body:t}),updateCompany:(t,s)=>$(`/sales/companies/${t}`,{method:"PUT",body:s}),deleteCompany:t=>$(`/sales/companies/${t}`,{method:"DELETE"}),getInstances:()=>$("/sales/instances"),createInstance:t=>$("/sales/instances",{method:"POST",body:t}),updateInstance:(t,s)=>$(`/sales/instances/${t}`,{method:"PUT",body:s}),deleteInstance:t=>$(`/sales/instances/${t}`,{method:"DELETE"}),testInstance:(t,s)=>$(`/sales/instances/${t}/test`,{method:"POST",body:{company_id:s}}),testConnectionDirect:t=>$("/sales/test-connection",{method:"POST",body:t}),getEliminationRules:()=>$("/sales/eliminations"),createEliminationRule:t=>$("/sales/eliminations",{method:"POST",body:t}),syncCompany:t=>$(`/sales/sync/company/${t}`,{method:"POST"}),syncAll:()=>$("/sales/sync/all",{method:"POST"}),getSyncStatus:()=>$("/sales/sync/status"),getSyncProgress:t=>$(`/sales/sync/progress/${t}`),getSchedule:()=>$("/sales/settings/schedule"),updateSchedule:t=>$("/sales/settings/schedule",{method:"POST",body:t}),getNotifications:()=>$("/sales/notifications"),clearNotifications:()=>$("/sales/notifications/clear",{method:"POST"}),getInvoices:t=>$("/sales/invoices?"+U(t)),getCustomerHierarchy:t=>$("/sales/customer-hierarchy?"+U(t))}};function U(t){if(!t)return"";const s=[];for(const[l,r]of Object.entries(t))r!=null&&r!==""&&(Array.isArray(r)?s.push(`${l}=${r.join(",")}`):s.push(`${l}=${encodeURIComponent(r)}`));return s.join("&")}function lt(t,s=0){return t==null||isNaN(t)?"0":Number(t).toLocaleString("en-US",{minimumFractionDigits:s,maximumFractionDigits:s})}function ke(t){const s=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"],l=parseInt(t)-1;return s[l]||t}function vt(t,s="info",l=4e3){const r=document.getElementById("toast-container"),e=document.createElement("div");e.className=`toast toast-${s}`;const a={success:"✓",error:"✕",info:"ℹ",warning:"⚠"};e.innerHTML=`<span>${a[s]||""}</span><span>${t}</span>`,r.appendChild(e),setTimeout(()=>{e.style.opacity="0",e.style.transform="translateX(-20px)",setTimeout(()=>e.remove(),300)},l)}function Ee(t,s){const l=document.getElementById("modal-overlay"),r=document.getElementById("modal-content");r.innerHTML=`
    <div class="modal-header">
      <h3 class="modal-title">${t}</h3>
      <button class="modal-close" onclick="document.getElementById('modal-overlay').classList.remove('active')">✕</button>
    </div>
    <div class="modal-body">${s}</div>
  `,l.classList.add("active"),l.onclick=e=>{e.target===l&&l.classList.remove("active")}}function Se(){document.getElementById("modal-overlay").classList.remove("active")}const Q=["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#ec4899","#06b6d4","#84cc16"],rt=["#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6"],o=t=>lt(t,0),D=t=>(t||0).toFixed(1)+"%",Tt=["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];let Z=null,Dt="overview",mt=[],yt={},pt={},zt=null;function Wt(t){if(!t)return"";const s=l=>String(l).padStart(2,"0");return`${t.getFullYear()}-${s(t.getMonth()+1)}-${s(t.getDate())} ${s(t.getHours())}:${s(t.getMinutes())}:${s(t.getSeconds())}`}async function Te(t){var b,d,g,p,k,T,u,h,v,m;const s=Et.get("companies")||[],l=((b=Et.get("filterOptions"))==null?void 0:b.fiscalYears)||[],r=Et.get("fiscalYear")||l[l.length-1]||"";t.innerHTML=`
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
          ${s.map((f,n)=>`<div class="bi-chip active co-chip" data-id="${f.id}" data-color="${Q[n%Q.length]}" style="border-color:${Q[n%Q.length]};background:${Q[n%Q.length]}20;color:${Q[n%Q.length]};">${f.name}</div>`).join("")}
        </div>
        <div style="width:1px;height:24px;background:rgba(255,255,255,0.08);margin:0 6px;flex-shrink:0;"></div>
        <span class="slicer-label">📅 السنوات</span>
        <div class="slicer-group" id="yr-slicer">
          <div class="bi-chip all-chip yr-all" data-color="#ec4899" style="border-color:rgba(255,255,255,0.12);background:rgba(255,255,255,0.03);color:rgba(255,255,255,0.4);font-weight:800;font-family:var(--font-en);">الكل</div>
          ${l.map((f,n)=>`<div class="bi-chip ${f===r?"active":""} yr-chip" data-year="${f}" data-color="${rt[n%rt.length]}" style="${f===r?`border-color:${rt[n%rt.length]};background:${rt[n%rt.length]}20;color:${rt[n%rt.length]};`:""}font-family:var(--font-en);" data-idx="${n}">${f}</div>`).join("")}
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
  `;function e(f,n){const c=f.dataset.color;n?(f.classList.add("active"),f.style.borderColor=c,f.style.background=c+"20",f.style.color=c):(f.classList.remove("active"),f.style.borderColor="rgba(255,255,255,0.12)",f.style.background="rgba(255,255,255,0.03)",f.style.color="rgba(255,255,255,0.4)")}function a(f){e(f,!f.classList.contains("active")),i(),ut(t)}function i(){const f=t.querySelectorAll(".co-chip"),n=t.querySelectorAll(".yr-chip"),c=t.querySelectorAll(".cc-chip"),y=t.querySelectorAll(".grp-chip"),w=t.querySelector(".co-all"),C=t.querySelector(".yr-all"),L=t.querySelector(".cc-all"),E=t.querySelector(".grp-all");w&&e(w,[...f].every(A=>A.classList.contains("active"))),C&&e(C,[...n].every(A=>A.classList.contains("active"))),L&&e(L,c.length===0||[...c].every(A=>A.classList.contains("active"))),E&&e(E,y.length===0||[...y].every(A=>A.classList.contains("active")))}t.querySelectorAll(".co-chip").forEach(f=>f.addEventListener("click",()=>a(f))),t.querySelectorAll(".yr-chip").forEach(f=>f.addEventListener("click",()=>a(f))),(d=t.querySelector(".co-all"))==null||d.addEventListener("click",()=>{const f=t.querySelectorAll(".co-chip"),n=[...f].every(c=>c.classList.contains("active"));f.forEach(c=>e(c,!n)),e(t.querySelector(".co-all"),!n),ut(t)}),(g=t.querySelector(".yr-all"))==null||g.addEventListener("click",()=>{const f=t.querySelectorAll(".yr-chip"),n=[...f].every(c=>c.classList.contains("active"));f.forEach(c=>e(c,!n)),e(t.querySelector(".yr-all"),!n),ut(t)}),(p=t.querySelector(".cc-all"))==null||p.addEventListener("click",()=>{const f=t.querySelectorAll(".cc-chip"),n=f.length===0||[...f].every(c=>c.classList.contains("active"));f.forEach(c=>e(c,!n)),e(t.querySelector(".cc-all"),!n),Z&&gt(t)}),(k=t.querySelector(".grp-all"))==null||k.addEventListener("click",()=>{const f=t.querySelectorAll(".grp-chip"),n=f.length===0||[...f].every(c=>c.classList.contains("active"));f.forEach(c=>e(c,!n)),e(t.querySelector(".grp-all"),!n),Z&&gt(t)}),(T=t.querySelector("#btn-deselect"))==null||T.addEventListener("click",()=>{t.querySelectorAll(".co-chip, .yr-chip, .co-all, .yr-all, .cc-chip, .cc-all, .grp-chip, .grp-all").forEach(f=>e(f,!1)),t.querySelector("#date-from").value="",t.querySelector("#date-to").value="",ut(t)}),(u=t.querySelector("#date-from"))==null||u.addEventListener("change",()=>ut(t)),(h=t.querySelector("#date-to"))==null||h.addEventListener("change",()=>ut(t)),(v=t.querySelector("#adv-toggle"))==null||v.addEventListener("click",()=>{const f=t.querySelector("#adv-toggle"),n=t.querySelector("#adv-panel");f.classList.toggle("open"),n.classList.toggle("open")}),i(),t.querySelectorAll(".bi-tab").forEach(f=>{f.addEventListener("click",()=>{t.querySelectorAll(".bi-tab").forEach(n=>n.classList.remove("active")),f.classList.add("active"),Dt=f.dataset.tab,Z&&gt(t)})}),(m=t.querySelector("#btn-refresh"))==null||m.addEventListener("click",async()=>{const f=t.querySelector("#btn-refresh");if(!f.classList.contains("loading")){f.classList.add("loading");try{await ut(t)}catch(n){console.error(n)}f.classList.remove("loading")}}),t.querySelector("#btn-share").addEventListener("click",()=>ge()),t.querySelector("#btn-shares-list").addEventListener("click",()=>Ft(t)),t.querySelector("#btn-close-shares").addEventListener("click",()=>t.querySelector("#shares-modal").style.display="none"),t.querySelector("#shares-modal").addEventListener("click",f=>{f.target.id==="shares-modal"&&(f.target.style.display="none")});try{const[f,n]=await Promise.all([it.getAnalyticGroups(),it.getAnalyticGroupMappings({})]);mt=f||[],window._rawGroupMappings=n||[],yt={};const c={};(n||[]).forEach(y=>{if(!y.group_id)return;const w=(y.analytic_account||"").trim();w&&(c[w]||(c[w]=new Set),c[w].add(String(y.group_id)))});for(const[y,w]of Object.entries(c))w.size===1?yt[y]=[...w][0]:console.warn(`[Mapping] CC "${y}" has conflicting groups:`,[...w],"— treating as ungrouped");Xt(t),pt={},(n||[]).forEach(y=>{if(y.redistributable&&y.analytic_account){const w=String(y.company_id);pt[w]||(pt[w]=new Set),pt[w].add(y.analytic_account.trim())}})}catch(f){console.warn("Could not load analytic groups:",f)}await ut(t)}const Pt=["#06b6d4","#14b8a6","#0ea5e9","#22d3ee","#2dd4bf","#0891b2","#0d9488","#0284c7"];function Kt(t,s){var i;const l=new Set;for(const b of s.years)for(const d of((i=s.yearlyData[b])==null?void 0:i.companies)||[])(d.pivotData||[]).forEach(g=>l.add(g.cc)),(d.costCenters||[]).forEach(g=>l.add(g.name));const r=[...l].sort(),e=t.querySelector("#cc-slicer");if(!e)return;const a=e.querySelector(".cc-all");e.innerHTML="",a&&e.appendChild(a),r.forEach((b,d)=>{const g=Pt[d%Pt.length],p=document.createElement("div");p.className="bi-chip active cc-chip",p.dataset.cc=b,p.dataset.color=g,p.style.cssText=`border-color:${g};background:${g}20;color:${g};`,p.textContent=b,p.addEventListener("click",()=>{var v;if((v=t.querySelector("#cc-single-mode"))==null?void 0:v.checked)t.querySelectorAll(".cc-chip").forEach(m=>{m.classList.remove("active"),m.style.borderColor="rgba(255,255,255,0.12)",m.style.background="rgba(255,255,255,0.03)",m.style.color="rgba(255,255,255,0.4)"}),p.classList.add("active"),p.style.borderColor=g,p.style.background=g+"20",p.style.color=g;else{const m=p.classList.contains("active");p.classList.toggle("active"),m?(p.style.borderColor="rgba(255,255,255,0.12)",p.style.background="rgba(255,255,255,0.03)",p.style.color="rgba(255,255,255,0.4)"):(p.style.borderColor=g,p.style.background=g+"20",p.style.color=g)}const T=t.querySelectorAll(".cc-chip"),u=t.querySelector(".cc-all"),h=[...T].every(m=>m.classList.contains("active"));u&&(u.classList.toggle("active",h),u.style.borderColor=h?"#06b6d4":"rgba(255,255,255,0.12)",u.style.background=h?"#06b6d420":"rgba(255,255,255,0.03)",u.style.color=h?"#06b6d4":"rgba(255,255,255,0.4)"),Z&&gt(t)}),e.appendChild(p)})}function Vt(t){const s=t.querySelectorAll(".cc-chip.active"),l=t.querySelectorAll(".cc-chip");return s.length===0||s.length===l.length?null:[...s].map(r=>r.dataset.cc)}function Xt(t){const s=t.querySelector("#grp-slicer");if(!s||!mt.length)return;const l=s.querySelector(".grp-all");s.innerHTML="",l&&s.appendChild(l),mt.forEach(r=>{const e=r.color||"#f59e0b",a=document.createElement("div");a.className="bi-chip active grp-chip",a.dataset.groupId=r.id,a.dataset.color=e,a.style.cssText=`border-color:${e};background:${e}20;color:${e};`,a.textContent=r.name,a.addEventListener("click",()=>{const i=a.classList.contains("active");a.classList.toggle("active"),i?(a.style.borderColor="rgba(255,255,255,0.12)",a.style.background="rgba(255,255,255,0.03)",a.style.color="rgba(255,255,255,0.4)"):(a.style.borderColor=e,a.style.background=e+"20",a.style.color=e);const b=t.querySelectorAll(".grp-chip"),d=t.querySelector(".grp-all"),g=[...b].every(p=>p.classList.contains("active"));d&&(d.classList.toggle("active",g),d.style.borderColor=g?"#f59e0b":"rgba(255,255,255,0.12)",d.style.background=g?"#f59e0b20":"rgba(255,255,255,0.03)",d.style.color=g?"#f59e0b":"rgba(255,255,255,0.4)"),Qt(t),Z&&gt(t)}),s.appendChild(a)})}function Qt(t){const s=t.querySelectorAll(".grp-chip");if(s.length===0||[...s].every(e=>e.classList.contains("active"))){t.querySelectorAll(".cc-chip").forEach(e=>{e.classList.add("active");const a=e.dataset.color;e.style.borderColor=a,e.style.background=a+"20",e.style.color=a});return}const r=new Set([...t.querySelectorAll(".grp-chip.active")].map(e=>e.dataset.groupId));t.querySelectorAll(".cc-chip").forEach(e=>{const a=e.dataset.cc,i=yt[a],b=i?r.has(String(i)):!1;e.classList.toggle("active",b);const d=e.dataset.color;b?(e.style.borderColor=d,e.style.background=d+"20",e.style.color=d):(e.style.borderColor="rgba(255,255,255,0.12)",e.style.background="rgba(255,255,255,0.03)",e.style.color="rgba(255,255,255,0.4)")})}async function ut(t){var b,d;const s=[...t.querySelectorAll(".co-chip.active")].map(g=>g.dataset.id);let l=[...t.querySelectorAll(".yr-chip.active")].map(g=>g.dataset.year).sort();const r=t.querySelector("#bi-body"),e=(b=t.querySelector("#date-from"))==null?void 0:b.value,a=(d=t.querySelector("#date-to"))==null?void 0:d.value;if(e&&a&&!l.length&&(l=[e.substring(0,4)]),!s.length||!l.length){r.innerHTML='<div class="bi-empty">اختر شركة وسنة مالية واحدة على الأقل</div>';return}r.innerHTML='<div class="bi-empty">⏳ جاري تحميل البيانات...</div>';try{const g={companyIds:s.join(","),years:l.join(",")};e&&(g.dateFrom=e),a&&(g.dateTo=a),console.log("[loadDashboard] params:",JSON.stringify(g)),Z=await it.getPresentationData(g),Z._selectedCos=s,Z._selectedYrs=l,zt=new Date;const p=t.querySelector("#bi-last-updated-ts");p&&(p.textContent=Wt(zt)),Kt(t,Z),gt(t)}catch(g){console.error(g),r.innerHTML='<div class="bi-empty" style="color:#ef4444;">❌ خطأ في تحميل البيانات</div>'}}function gt(t){var p;const s=t.querySelector("#bi-body"),l=Vt(t),r=l?Zt(Z,l):Z,e=r.years||[],a=r.yearlyData||{},i=r.grandTotals,b=((p=a[e[0]])==null?void 0:p.companies)||[],d=b.length>1,g=e.length>1;switch(Dt){case"overview":te(s,r,i,e,a,b,d,g);break;case"collection":ee(s,r,i,e,a,b,d,g);break;case"comparison":se(s,r,i,e,a,b,d,g);break;case"details":ie(s,r,i,e,a);break;case"pivot-acc":de(s,r);break;case"pivot-cc":pe(s,r);break;case"redist":ye(s,r);break;case"guarantees":ve(s,r);break;case"sales":me(s,r,e,l);break;case"sales-details":xe(s,r,e,l);break;case"vat":$e(s,r,e,l);break}}function Zt(t,s){const l=new Set(s),r={...t,yearlyData:{},years:t.years},e=[];for(const a of t.years){const i=t.yearlyData[a],b=((i==null?void 0:i.companies)||[]).map(p=>{const k=(p.costCenters||[]).filter(w=>l.has(w.name)),T=(p.accountTree||[]).filter(w=>l.has(w.name)),u=(p.pivotData||[]).filter(w=>l.has(w.cc));let h=0,v=0,m=0,f=0;k.forEach(w=>{h+=w.revenue||0,v+=w.expenses||0,m+=w.collected||0,f+=w.remaining||0});const n=h-v,c=p.kpis&&p.kpis.billed>0?p.kpis.billed:h*1.15,y={...p.kpis,revenue:h,expenses:v,collected:m,remaining:f,netIncome:n,profitMargin:h>0?n/h*100:0,expenseRatio:h>0?v/h*100:0,collectionRate:c>0?m/c*100:0,remainingRate:c>0?f/c*100:0};return e.push(y),{...p,costCenters:k,accountTree:T,pivotData:u,kpis:y}}),d=b.map(p=>p.kpis),g=qt(d);r.yearlyData[a]={...i,companies:b,totals:g}}return r.grandTotals=qt(e),r}function qt(t){const s={revenue:0,expenses:0,netIncome:0,assets:0,liabilities:0,equity:0,cash:0,guarantees:0,receivables:0,openingReceivables:0,billed:0,collected:0,remaining:0,payables:0};for(const r of t)for(const e of Object.keys(s))s[e]+=r[e]||0;s.profitMargin=s.revenue>0?s.netIncome/s.revenue*100:0,s.expenseRatio=s.revenue>0?s.expenses/s.revenue*100:0;const l=s.billed>0?s.billed:s.revenue*1.15;return s.collectionRate=l>0?s.collected/l*100:0,s.remainingRate=l>0?s.remaining/l*100:0,s}function te(t,s,l,r,e,a,i,b){const d=l.revenue,g=l.expenses,p=l.netIncome,k=l.collected,T=l.collectionRate,u=l.expenseRatio,h=l.profitMargin;l.remaining,l.remainingRate,t.innerHTML=`
    <div class="bi-kpi-row">
      <div class="bi-kpi"><div class="bi-kpi-label">💰 الإيرادات</div><div class="bi-kpi-value" style="color:#10b981;">${o(d)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📤 المصروفات</div><div class="bi-kpi-value" style="color:#ef4444;">${o(g)}</div><div class="bi-kpi-sub">${D(u)} من الإيرادات</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📈 صافي الربح</div><div class="bi-kpi-value" style="color:${p>=0?"#10b981":"#ef4444"};">${o(p)}</div><div class="bi-kpi-sub">هامش ${D(h)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">✅ المحصّل</div><div class="bi-kpi-value" style="color:#06b6d4;">${o(k)}</div><div class="bi-kpi-sub">${D(T)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">💵 النقدية</div><div class="bi-kpi-value" style="color:#06b6d4;">${o(l.cash)}</div><div class="bi-kpi-sub">رصيد النقدية المتاح في البنوك والخزينة</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">🏦 الضمانات البنكية</div><div class="bi-kpi-value" style="color:#8b5cf6;">${o(l.guarantees||0)}</div><div class="bi-kpi-sub">أصول محتجزة ككفالات وضمانات</div></div>
    </div>
    <div class="bi-card bi-full" style="padding:14px 20px;">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;">
        <div><div class="bi-pbar-label"><span>نسبة التحصيل</span><span style="color:#10b981;font-family:var(--font-en);font-weight:700;">${D(T)}</span></div><div class="bi-pbar"><div class="bi-pbar-fill" style="width:${Math.min(T,100)}%;background:linear-gradient(90deg,#10b981,#34d399);"></div></div></div>
        <div><div class="bi-pbar-label"><span>نسبة المصروفات</span><span style="color:#ef4444;font-family:var(--font-en);font-weight:700;">${D(u)}</span></div><div class="bi-pbar"><div class="bi-pbar-fill" style="width:${Math.min(u,100)}%;background:linear-gradient(90deg,#ef4444,#f87171);"></div></div></div>
        <div><div class="bi-pbar-label"><span>هامش الربح</span><span style="color:${h>=0?"#10b981":"#ef4444"};font-family:var(--font-en);font-weight:700;">${D(h)}</span></div><div class="bi-pbar"><div class="bi-pbar-fill" style="width:${Math.min(Math.abs(h),100)}%;background:linear-gradient(90deg,${h>=0?"#10b981,#34d399":"#ef4444,#f87171"});"></div></div></div>
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
  `,requestAnimationFrame(()=>{xt(document.getElementById("ch-overview-donut"),Ot(s)),xt(document.getElementById("ch-overview-donut-exp"),ae(s)),Mt(document.getElementById("ch-overview-bar"),_t(s));const v=r[r.length-1];if(v){const m=oe(s,v);St(document.getElementById("ch-monthly-rev"),m.revenue,"#10b981","#34d399"),St(document.getElementById("ch-monthly-exp"),m.expenses,"#ef4444","#f87171")}})}function ee(t,s,l,r,e,a,i,b){const d=l.revenue,g=l.expenses,p=l.collected,k=l.collectionRate,T=l.remaining,u=l.remainingRate;t.innerHTML=`
    <div class="bi-kpi-row" style="grid-template-columns:repeat(4,1fr);">
      <div class="bi-kpi"><div class="bi-kpi-label">💰 إجمالي الإيرادات</div><div class="bi-kpi-value" style="color:#10b981;">${o(d)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">✅ المحصّل</div><div class="bi-kpi-value" style="color:#06b6d4;">${o(p)}</div><div class="bi-kpi-sub">${D(k)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">⏳ المتبقي</div><div class="bi-kpi-value" style="color:#f59e0b;">${o(T)}</div><div class="bi-kpi-sub">${D(u)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📤 المصروفات</div><div class="bi-kpi-value" style="color:#ef4444;">${o(g)}</div></div>
    </div>
    <div class="bi-charts">
      <div class="bi-card"><div class="bi-card-title">📥 التحصيل ${i?"حسب الشركة":b?"حسب السنة":""}</div><canvas id="ch-coll-bars" height="340"></canvas></div>
      <div class="bi-card"><div class="bi-card-title">🍩 محصّل مقابل متبقي</div><canvas id="ch-coll-donut" height="340"></canvas></div>
    </div>
    <div class="bi-card bi-full">
      <div class="bi-card-title">📋 تفاصيل التحصيل</div>
      <div style="overflow-x:auto;"><table class="bi-table" id="tbl-collection"></table></div>
    </div>
  `,requestAnimationFrame(()=>{le(document.getElementById("ch-coll-bars"),s),xt(document.getElementById("ch-coll-donut"),{values:[p,T],colors:["#10b981","#f59e0b"],labels:["المحصّل","المتبقي"]}),re(document.getElementById("tbl-collection"),s)})}function se(t,s,l,r,e,a,i,b){t.innerHTML=`
    <div class="bi-card bi-full">
      <div class="bi-card-title">📋 مقارنة شاملة — الإيرادات والمصروفات والتحصيل</div>
      <div style="overflow-x:auto;"><table class="bi-table" id="tbl-comparison"></table></div>
    </div>
    ${b?'<div class="bi-card bi-full"><div class="bi-card-title">📅 مقارنة سنوية</div><div style="overflow-x:auto;"><table class="bi-table" id="tbl-yoy"></table></div></div>':""}
    <div class="bi-charts">
      <div class="bi-card"><div class="bi-card-title">📊 مقارنة الإيرادات والمصروفات</div><canvas id="ch-comp-bar"></canvas></div>
      <div class="bi-card"><div class="bi-card-title">🍩 توزيع الإيرادات</div><canvas id="ch-comp-donut" height="240"></canvas></div>
    </div>
  `,requestAnimationFrame(()=>{ne(document.getElementById("tbl-comparison"),s),b&&fe(document.getElementById("tbl-yoy"),s),Mt(document.getElementById("ch-comp-bar"),_t(s)),xt(document.getElementById("ch-comp-donut"),Ot(s))})}function Ct(t){var l;const s=new Map;for(const r of t.years)for(const e of((l=t.yearlyData[r])==null?void 0:l.companies)||[]){let a=s.get(e.companyId);a||(a={companyId:e.companyId,companyName:e.companyName,kpis:{}},s.set(e.companyId,a));for(const[i,b]of Object.entries(e.kpis))a.kpis[i]=(a.kpis[i]||0)+(typeof b=="number"?b:0)}for(const r of s.values()){const e=r.kpis;e.profitMargin=e.revenue>0?e.netIncome/e.revenue*100:0,e.expenseRatio=e.revenue>0?e.expenses/e.revenue*100:0,e.collectionRate=e.revenue>0?e.collected/e.revenue*100:0}return[...s.values()]}function _t(t,s){const l=t.years,r=t.yearlyData,e=Ct(t),a=e.length>1,i=l.length>1;{if(a)return{groups:e.map(d=>[d.kpis.revenue,d.kpis.expenses]),max:Math.max(...e.flatMap(d=>[d.kpis.revenue,d.kpis.expenses]),1),colors:["#10b981","#ef4444"],labels:e.map(d=>d.companyName)};if(i)return{groups:l.map(d=>[r[d].totals.revenue,r[d].totals.expenses]),max:Math.max(...l.flatMap(d=>[r[d].totals.revenue,r[d].totals.expenses]),1),colors:["#10b981","#ef4444"],labels:l};const b=t.grandTotals;return{groups:[[b.revenue,b.expenses,b.netIncome]],max:Math.max(b.revenue,b.expenses,1),colors:["#10b981","#ef4444","#3b82f6"],labels:[""]}}}function Ot(t){const s=t.years,l=t.yearlyData,r=Ct(t),e=r.length>1,a=s.length>1;if(e)return{values:r.map(b=>b.kpis.revenue),colors:Q,labels:r.map(b=>b.companyName)};if(a)return{values:s.map(b=>l[b].totals.revenue),colors:rt,labels:s};const i=t.grandTotals;return{values:[i.collected||0,i.remaining||0],colors:["#10b981","#f59e0b"],labels:["المحصّل","المتبقي"]}}const Rt=["#ef4444","#f59e0b","#ec4899","#f97316","#e11d48","#dc2626","#be123c","#ea580c"];function ae(t){const s=t.years,l=t.yearlyData,r=Ct(t),e=r.length>1,a=s.length>1;if(e)return{values:r.map(b=>b.kpis.expenses),colors:Rt,labels:r.map(b=>b.companyName)};if(a)return{values:s.map(b=>l[b].totals.expenses),colors:Rt,labels:s};const i=t.grandTotals;return{values:[i.expenses||0,Math.max(i.netIncome,0)],colors:["#ef4444","#10b981"],labels:["المصروفات","صافي الربح"]}}function oe(t,s){const l=t.yearlyData[s];if(!l)return{revenue:[],expenses:[]};const r=new Array(12).fill(0),e=new Array(12).fill(0);for(const a of l.companies||[])for(const i of a.pivotData||[]){const b=i.month;b>=1&&b<=12&&(r[b-1]+=i.revenue||0,e[b-1]+=i.expenses||0)}return{revenue:r,expenses:e}}function St(t,s,l,r){if(!t||!s||!s.length)return;const e=t.getContext("2d"),a=window.devicePixelRatio||1,i=t.clientWidth,b=t.clientHeight;t.width=i*a,t.height=b*a,e.scale(a,a),e.clearRect(0,0,i,b);const d=20,g=14,p=28,k=36,T=i-d-g,u=b-p-k,h=Math.max(...s,1),v=T/12,m=Math.min(v*.55,48);for(let n=0;n<=4;n++){const c=p+u/4*n;e.strokeStyle="rgba(255,255,255,0.05)",e.beginPath(),e.moveTo(d,c),e.lineTo(d+T,c),e.stroke()}e.beginPath(),e.strokeStyle=l+"50",e.lineWidth=2.5,s.forEach((n,c)=>{const y=d+c*v+v/2,w=Math.abs(n)/h*u,C=p+u-w;c===0?e.moveTo(y,C):e.lineTo(y,C)}),e.stroke(),s.forEach((n,c)=>{const y=d+c*v+(v-m)/2,w=Math.abs(n)/h*u,C=p+u-w,L=Math.min(5,m/2),E=e.createLinearGradient(y,C,y,p+u);if(E.addColorStop(0,l),E.addColorStop(1,r+"30"),e.fillStyle=E,e.beginPath(),e.moveTo(y,p+u),e.lineTo(y,C+L),e.arcTo(y,C,y+L,C,L),e.arcTo(y+m,C,y+m,C+L,L),e.lineTo(y+m,p+u),e.closePath(),e.fill(),n>0){e.save();const A=y+m/2,x=C-4;e.translate(A,x),e.rotate(-Math.PI/4),e.fillStyle="rgba(255,255,255,0.9)",e.font="bold 10px Inter",e.textAlign="left",e.fillText(new Intl.NumberFormat("en-US",{minimumFractionDigits:0,maximumFractionDigits:0}).format(n),0,0),e.restore()}e.fillStyle="rgba(255,255,255,0.6)",e.font='700 13px "Noto Sans Arabic"',e.textAlign="center",e.fillText(Tt[c].substring(0,5),d+c*v+v/2,b-8)});const f=s.reduce((n,c)=>n+c,0);e.fillStyle=l,e.font="bold 13px Inter",e.textAlign="right",e.fillText("الإجمالي: "+o(f),i-g,18)}function Mt(t,s){var _;if(!t||!s)return;const{groups:l,max:r,colors:e,labels:a}=s,i=((_=l[0])==null?void 0:_.length)||1,b=l.length,d=26,g=3,p=14,k=30,T=10+b*(i*(d+g)+p)+k;t.style.height=T+"px";const u=t.getContext("2d"),h=window.devicePixelRatio||1,v=t.clientWidth,m=T;t.width=v*h,t.height=m*h,u.scale(h,h),u.clearRect(0,0,v,m);const f=140,n=10,c=10,y=8,w=v-f-n-c-120,C=r||1;for(let B=0;B<=5;B++){const O=f+n+w/5*B;u.strokeStyle="rgba(255,255,255,0.05)",u.beginPath(),u.moveTo(O,y),u.lineTo(O,m-k),u.stroke()}let L=y;l.forEach((B,O)=>{const M=i*(d+g);u.fillStyle="rgba(255,255,255,0.85)",u.font='700 13px "Noto Sans Arabic"',u.textAlign="right";const I=(a[O]||"").length>20?a[O].substring(0,20)+"…":a[O];u.fillText(I,f-8,L+M/2+1),B.forEach((P,F)=>{const H=L+F*(d+g),q=Math.max(2,Math.abs(P)/C*w),R=Math.min(5,d/2),z=f+n,S=u.createLinearGradient(z,H,z+q,H);S.addColorStop(0,e[F%e.length]),S.addColorStop(1,e[F%e.length]+"90"),u.fillStyle=S,u.beginPath(),u.moveTo(z,H),u.lineTo(z+q-R,H),u.arcTo(z+q,H,z+q,H+R,R),u.arcTo(z+q,H+d,z+q-R,H+d,R),u.lineTo(z,H+d),u.closePath(),u.fill();const N=s.exactValues?new Intl.NumberFormat("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}).format(P):Math.abs(P)>=1e6?(P/1e6).toFixed(1)+"M":Math.abs(P)>=1e3?Math.round(P/1e3)+"K":lt(P,0);u.fillStyle="rgba(255,255,255,0.95)",u.font="bold 13px Inter",u.textAlign="left",u.fillText(N,z+q+8,H+d/2+5)}),L+=M+p});const E=m-6,A=i>=2?["إيرادات","مصروفات"]:["القيمة"];let x=f+n;A.forEach((B,O)=>{u.fillStyle=e[O%e.length],u.fillRect(x,E-12,12,12),u.fillStyle="rgba(255,255,255,0.6)",u.font='600 12px "Noto Sans Arabic"',u.textAlign="left",u.fillText(B,x+16,E-1),x+=90})}function xt(t,s){if(!t||!s)return;const{values:l,colors:r,labels:e}=s,a=t.getContext("2d"),i=window.devicePixelRatio||1,b=t.clientWidth,d=t.clientHeight;t.width=b*i,t.height=d*i,a.scale(i,i),a.clearRect(0,0,b,d);const g=b*.38,p=d/2,k=Math.min(g-20,p-20),T=k*.48,u=l.reduce((f,n)=>f+Math.abs(n),0)||1;let h=-Math.PI/2;l.forEach((f,n)=>{const c=Math.abs(f)/u*Math.PI*2;if(a.beginPath(),a.arc(g,p,k,h,h+c),a.arc(g,p,T,h+c,h,!0),a.closePath(),a.fillStyle=r[n%r.length],a.fill(),c>.15){const y=h+c/2;a.fillStyle="#fff",a.font="bold 14px Inter",a.textAlign="center",a.textBaseline="middle",a.fillText((Math.abs(f)/u*100).toFixed(0)+"%",g+Math.cos(y)*(k*.76),p+Math.sin(y)*(k*.76))}h+=c}),a.fillStyle="rgba(255,255,255,0.45)",a.font='700 13px "Noto Sans Arabic"',a.textAlign="center",a.textBaseline="middle",a.fillText("المجموع",g,p-12),a.fillStyle="#fff",a.font="bold 18px Inter",a.fillText(u>=1e6?(u/1e6).toFixed(1)+"M":o(u),g,p+12);const v=b*.68;let m=28;e.forEach((f,n)=>{a.fillStyle=r[n%r.length],a.beginPath(),a.arc(v,m+7,6,0,Math.PI*2),a.fill(),a.fillStyle="rgba(255,255,255,0.75)",a.font='700 13px "Noto Sans Arabic"',a.textAlign="right",a.textBaseline="middle",a.fillText(f.length>20?f.substring(0,20)+"…":f,v-14,m+7),a.fillStyle="rgba(255,255,255,0.5)",a.font="12px Inter",a.textAlign="left",a.fillText(o(l[n]),v+14,m+7),m+=30})}function le(t,s){var f;if(!t)return;const l=s.years,r=s.yearlyData,e=((f=r[l[0]])==null?void 0:f.companies)||[],a=e.length>1,i=l.length>1;let b;if(a)b=e.map(n=>({l:n.companyName,a:n.kpis.collected||0,b:n.kpis.remaining||0,t:n.kpis.revenue}));else if(i)b=l.map(n=>{const c=r[n].totals;return{l:n,a:c.collected||0,b:c.remaining||0,t:c.revenue}});else{const n=s.grandTotals;b=[{l:"التحصيل",a:n.collected||0,b:n.remaining||0,t:n.revenue}]}const d=t.getContext("2d"),g=window.devicePixelRatio||1,p=t.clientWidth,k=t.clientHeight;t.width=p*g,t.height=k*g,d.scale(g,g),d.clearRect(0,0,p,k);const T=130,u=70,h=p-T-u,v=Math.min(24,(k-10)/b.length-6),m=Math.max(...b.map(n=>n.t),1);b.forEach((n,c)=>{const y=5+c*((k-10)/b.length)+((k-10)/b.length-v)/2;d.fillStyle="rgba(255,255,255,0.55)",d.font='600 11px "Noto Sans Arabic"',d.textAlign="right",d.textBaseline="middle",d.fillText(n.l.length>14?n.l.substring(0,14)+"…":n.l,T-10,y+v/2);const w=Math.abs(n.a)/m*h,C=Math.abs(n.b)/m*h;d.fillStyle="#10b981",d.fillRect(T,y,w,v),d.fillStyle="#f59e0b",d.fillRect(T+w,y,C,v);const L=n.t>0?(n.a/n.t*100).toFixed(0)+"%":"0%";d.fillStyle="rgba(255,255,255,0.5)",d.font="600 10px Inter",d.textAlign="left",d.textBaseline="middle",d.fillText(`${o(n.t)}  (${L})`,T+w+C+8,y+v/2)})}function wt(t){t.querySelectorAll(".row-co").forEach(s=>{s.addEventListener("click",()=>{const l=s.dataset.gid,r=s.classList.toggle("open"),e=t.querySelectorAll(`.row-cc[data-pgid="${l}"]`);e.length>0?(e.forEach(a=>a.classList.toggle("show",r)),r||e.forEach(a=>{a.classList.remove("open"),t.querySelectorAll(`.row-pt[data-pgid="${a.dataset.gid}"]`).forEach(i=>i.classList.remove("show"))})):t.querySelectorAll(`.row-pt[data-pgid="${l}"]`).forEach(a=>a.classList.toggle("show",r))})}),t.querySelectorAll(".row-cc").forEach(s=>{s.addEventListener("click",l=>{l.stopPropagation();const r=s.dataset.gid,e=s.classList.toggle("open");t.querySelectorAll(`.row-pt[data-pgid="${r}"]`).forEach(a=>a.classList.toggle("show",e))})})}function bt(t){if(!t)return;const s=t.querySelectorAll("th.sortable");s.forEach(l=>{l.addEventListener("click",()=>{const r=l.classList.contains("desc")?"desc":l.classList.contains("asc")?"asc":"none";s.forEach(d=>{d.classList.remove("asc","desc")});let e;r==="none"?e="desc":r==="desc"?e="asc":e="none",e!=="none"&&l.classList.add(e);const a=parseInt(l.dataset.colIdx);if(isNaN(a))return;const i=t.querySelector("tbody");if(!i)return;if(i.querySelector(".row-co")!==null){const d=[];let g=null;i.querySelectorAll("tr").forEach(p=>{p.classList.contains("row-co")?(g={parent:p,children:[]},d.push(g)):g&&g.children.push(p)}),e!=="none"&&d.sort((p,k)=>{const T=p.parent.querySelectorAll("td")[a],u=k.parent.querySelectorAll("td")[a],h=$t(T==null?void 0:T.textContent),v=$t(u==null?void 0:u.textContent);return e==="desc"?v-h:h-v}),d.forEach(p=>{i.appendChild(p.parent),p.children.forEach(k=>i.appendChild(k))})}else{const d=[...i.querySelectorAll("tr")],g=d.filter(k=>!k.querySelector("td[colspan]")),p=d.filter(k=>k.querySelector("td[colspan]"));e!=="none"&&g.sort((k,T)=>{const u=k.querySelectorAll("td")[a],h=T.querySelectorAll("td")[a],v=$t(u==null?void 0:u.textContent),m=$t(h==null?void 0:h.textContent);return e==="desc"?m-v:v-m}),g.forEach(k=>i.appendChild(k)),p.forEach(k=>i.appendChild(k))}})})}function $t(t){if(!t)return 0;const s=t.replace(/[^\d.\-]/g,""),l=parseFloat(s);return isNaN(l)?0:l}function re(t,s){if(!t)return;const l=s.years,r=s.yearlyData;s.grandTotals;const e=l.length>1;let a="",i=0,b=0;l.forEach(m=>{var f;(((f=r[m])==null?void 0:f.companies)||[]).forEach((n,c)=>{const y=n.kpis,w="cg"+i++;a+=`<tr class="row-co" data-gid="${w}"><td style="color:${Q[c%Q.length]};font-weight:700;">${n.companyName}</td>${e?`<td style="font-family:var(--font-en);color:rgba(255,255,255,0.5);">${m}</td>`:""}<td class="n" style="color:#10b981;">${o(y.revenue)}</td><td class="n" style="color:#06b6d4;">${o(y.collected||0)}</td><td class="n" style="color:#f59e0b;">${o(y.remaining||0)}</td><td class="n" style="color:${(y.collectionRate||0)>=70?"#10b981":"#f59e0b"};">${D(y.collectionRate||0)}</td><td class="n" style="color:#ef4444;">${o(y.expenses)}</td><td class="n" style="color:${(y.profitMargin||0)>=0?"#10b981":"#ef4444"};">${D(y.profitMargin||0)}</td></tr>`,(n.costCenters||[]).forEach(C=>{const L="cc"+b++;a+=`<tr class="row-cc" data-gid="${L}" data-pgid="${w}"><td>${C.name.length>28?C.name.substring(0,28)+"…":C.name}</td>${e?"<td></td>":""}<td class="n">${o(C.revenue)}</td><td class="n">${o(C.collected||0)}</td><td class="n">${o(C.remaining||0)}</td><td class="n" style="color:${(C.collectionRate||0)>=70?"#10b981":"#f59e0b"};">${D(C.collectionRate||0)}</td><td class="n">${o(C.expenses)}</td><td class="n" style="color:${(C.profitMargin||0)>=0?"#10b981":"#ef4444"};">${D(C.profitMargin||0)}</td></tr>`,(C.partners||[]).forEach(E=>{a+=`<tr class="row-pt" data-pgid="${L}"><td>${E.name.length>26?E.name.substring(0,26)+"…":E.name}</td>${e?"<td></td>":""}<td class="n">${o(E.revenue)}</td><td class="n">${o(E.collected)}</td><td class="n">${o(E.remaining)}</td><td class="n" style="color:${(E.collectionRate||0)>=70?"#10b981":"#f59e0b"};">${D(E.collectionRate)}</td><td class="n">${o(E.expenses)}</td><td class="n" style="color:${E.netIncome>=0?"#10b981":"#ef4444"};">${D(E.profitMargin)}</td></tr>`})})})});let d=0,g=0,p=0,k=0;l.forEach(m=>{var f;(((f=r[m])==null?void 0:f.companies)||[]).forEach(n=>{(n.costCenters||[]).forEach(c=>{d+=c.revenue||0,g+=c.expenses||0,p+=c.collected||0,k+=c.remaining||0})})});const T=d>0?p/d*100:0,u=d-g,h=d>0?u/d*100:0,v=e?1:0;t.innerHTML=`<thead><tr><th>الشركة / مركز / شريك</th>${e?"<th>السنة</th>":""}<th class="n sortable" data-col-idx="${1+v}">الإيرادات</th><th class="n sortable" data-col-idx="${2+v}">المحصّل</th><th class="n sortable" data-col-idx="${3+v}">المتبقي</th><th class="n sortable" data-col-idx="${4+v}">% تحصيل</th><th class="n sortable" data-col-idx="${5+v}">المصروفات</th><th class="n sortable" data-col-idx="${6+v}">% ربح</th></tr></thead>
  <tbody>${a}</tbody>
  <tfoot><tr><td>المجموع</td>${e?"<td></td>":""}<td class="n" style="color:#10b981;">${o(d)}</td><td class="n" style="color:#06b6d4;">${o(p)}</td><td class="n" style="color:#f59e0b;">${o(k)}</td><td class="n" style="color:${T>=70?"#10b981":"#f59e0b"};">${D(T)}</td><td class="n" style="color:#ef4444;">${o(g)}</td><td class="n" style="color:${h>=0?"#10b981":"#ef4444"};">${D(h)}</td></tr></tfoot>`,wt(t),bt(t)}function ne(t,s){if(!t)return;const l=s.years,r=s.yearlyData;s.grandTotals;const e=l.length>1;let a="",i=0,b=0;l.forEach(f=>{var n;(((n=r[f])==null?void 0:n.companies)||[]).forEach((c,y)=>{const w=c.kpis,C="mg"+i++;a+=`<tr class="row-co" data-gid="${C}"><td style="color:${Q[y%Q.length]};font-weight:700;">${c.companyName}</td>${e?`<td style="font-family:var(--font-en);color:rgba(255,255,255,0.5);">${f}</td>`:""}<td class="n" style="color:#10b981;">${o(w.revenue)}</td><td class="n" style="color:#ef4444;">${o(w.expenses)}</td><td class="n" style="color:#ef4444;">${D(w.expenseRatio||0)}</td><td class="n" style="color:#06b6d4;">${o(w.collected||0)}</td><td class="n" style="color:#f59e0b;">${o(w.remaining||0)}</td><td class="n" style="color:${(w.collectionRate||0)>=70?"#10b981":"#f59e0b"};">${D(w.collectionRate||0)}</td><td class="n" style="color:${w.netIncome>=0?"#10b981":"#ef4444"};">${o(w.netIncome)}</td><td class="n" style="color:${w.profitMargin>=0?"#10b981":"#ef4444"};">${D(w.profitMargin)}</td></tr>`,(c.costCenters||[]).forEach(L=>{const E="mc"+b++,A=L.revenue>0?L.expenses/L.revenue*100:0;a+=`<tr class="row-cc" data-gid="${E}" data-pgid="${C}"><td>${L.name.length>26?L.name.substring(0,26)+"…":L.name}</td>${e?"<td></td>":""}<td class="n">${o(L.revenue)}</td><td class="n">${o(L.expenses)}</td><td class="n">${D(A)}</td><td class="n">${o(L.collected||0)}</td><td class="n">${o(L.remaining||0)}</td><td class="n" style="color:${(L.collectionRate||0)>=70?"#10b981":"#f59e0b"};">${D(L.collectionRate||0)}</td><td class="n" style="color:${L.netIncome>=0?"#10b981":"#ef4444"};">${o(L.netIncome)}</td><td class="n" style="color:${(L.profitMargin||0)>=0?"#10b981":"#ef4444"};">${D(L.profitMargin||0)}</td></tr>`,(L.partners||[]).forEach(x=>{const _=x.revenue>0?x.expenses/x.revenue*100:0;a+=`<tr class="row-pt" data-pgid="${E}"><td>${x.name.length>24?x.name.substring(0,24)+"…":x.name}</td>${e?"<td></td>":""}<td class="n">${o(x.revenue)}</td><td class="n">${o(x.expenses)}</td><td class="n">${D(_)}</td><td class="n">${o(x.collected)}</td><td class="n">${o(x.remaining)}</td><td class="n" style="color:${(x.collectionRate||0)>=70?"#10b981":"#f59e0b"};">${D(x.collectionRate)}</td><td class="n" style="color:${x.netIncome>=0?"#10b981":"#ef4444"};">${o(x.netIncome)}</td><td class="n" style="color:${x.profitMargin>=0?"#10b981":"#ef4444"};">${D(x.profitMargin)}</td></tr>`})})})});let d=0,g=0,p=0,k=0;l.forEach(f=>{var n;(((n=r[f])==null?void 0:n.companies)||[]).forEach(c=>{(c.costCenters||[]).forEach(y=>{d+=y.revenue||0,g+=y.expenses||0,p+=y.collected||0,k+=y.remaining||0})})});const T=d>0?p/d*100:0,u=d>0?g/d*100:0,h=d-g,v=d>0?h/d*100:0,m=e?1:0;t.innerHTML=`<thead><tr><th>الشركة / مركز / شريك</th>${e?"<th>السنة</th>":""}<th class="n sortable" data-col-idx="${1+m}">الإيرادات</th><th class="n sortable" data-col-idx="${2+m}">المصروفات</th><th class="n sortable" data-col-idx="${3+m}">% مصروفات</th><th class="n sortable" data-col-idx="${4+m}">المحصّل</th><th class="n sortable" data-col-idx="${5+m}">المتبقي</th><th class="n sortable" data-col-idx="${6+m}">% تحصيل</th><th class="n sortable" data-col-idx="${7+m}">صافي الربح</th><th class="n sortable" data-col-idx="${8+m}">% ربح</th></tr></thead>
  <tbody>${a}</tbody>
  <tfoot><tr><td>المجموع</td>${e?"<td></td>":""}<td class="n" style="color:#10b981;">${o(d)}</td><td class="n" style="color:#ef4444;">${o(g)}</td><td class="n" style="color:#ef4444;">${D(u)}</td><td class="n" style="color:#06b6d4;">${o(p)}</td><td class="n" style="color:#f59e0b;">${o(k)}</td><td class="n" style="color:${T>=70?"#10b981":"#f59e0b"};">${D(T)}</td><td class="n" style="color:${h>=0?"#10b981":"#ef4444"};">${o(h)}</td><td class="n" style="color:${v>=0?"#10b981":"#ef4444"};">${D(v)}</td></tr></tfoot>`,wt(t),bt(t)}function ie(t,s,l,r,e,a,i,b){var h;const d=l.revenue,g=l.expenses,p=l.netIncome,k=l.profitMargin,T=l.expenseRatio;let u=0;for(const v of r)for(const m of((h=e[v])==null?void 0:h.companies)||[])u+=(m.accountTree||[]).length;t.innerHTML=`
    <div class="bi-kpi-row" style="grid-template-columns:repeat(4,1fr);">
      <div class="bi-kpi"><div class="bi-kpi-label">💰 الإيرادات</div><div class="bi-kpi-value" style="color:#10b981;">${o(d)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📤 المصروفات</div><div class="bi-kpi-value" style="color:#ef4444;">${o(g)}</div><div class="bi-kpi-sub">${D(T)} من الإيرادات</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📈 صافي الربح</div><div class="bi-kpi-value" style="color:${p>=0?"#10b981":"#ef4444"};">${o(p)}</div><div class="bi-kpi-sub">هامش ${D(k)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📊 مراكز التكلفة</div><div class="bi-kpi-value" style="color:#8b5cf6;">${u}</div></div>
    </div>
    <div class="bi-card bi-full">
      <div class="bi-card-title">📑 تفاصيل الإيرادات والمصروفات حسب الحساب المالي</div>
      <div style="overflow-x:auto;"><table class="bi-table" id="tbl-details"></table></div>
    </div>
  `,requestAnimationFrame(()=>ce(document.getElementById("tbl-details"),s))}function ce(t,s){if(!t)return;const l=s.years,r=s.yearlyData,e=new Map;l.forEach(u=>{var h;(((h=r[u])==null?void 0:h.companies)||[]).forEach(v=>{let m=e.get(v.companyId);m||(m={name:v.companyName,id:v.companyId,ccMap:new Map},e.set(v.companyId,m)),(v.accountTree||[]).forEach(f=>{let n=m.ccMap.get(f.name);n||(n={name:f.name,revenue:0,expenses:0,netIncome:0,accMap:new Map},m.ccMap.set(f.name,n)),n.revenue+=f.revenue||0,n.expenses+=f.expenses||0,n.netIncome+=f.netIncome||0,(f.accounts||[]).forEach(c=>{const y=c.code+"|"+c.type;let w=n.accMap.get(y);w||(w={code:c.code,name:c.name,type:c.type,amount:0},n.accMap.set(y,w)),w.amount+=c.amount||0})})})}),e.forEach(u=>{let h=0,v=0;u.ccMap.forEach(m=>{h+=m.revenue,v+=m.expenses}),u.kpis={revenue:h,expenses:v,netIncome:h-v,profitMargin:h>0?(h-v)/h*100:0}});let a=0,i=0;e.forEach(u=>{a+=u.kpis.revenue,i+=u.kpis.expenses});const b=a-i,d=a>0?b/a*100:0;let g="",p=0,k=0,T=0;e.forEach(u=>{const h=u.kpis,v="dg"+p++;g+=`<tr class="row-co" data-gid="${v}"><td style="color:${Q[T%Q.length]};font-weight:700;">${u.name}</td><td class="n" style="color:#10b981;">${o(h.revenue)}</td><td class="n" style="color:#ef4444;">${o(h.expenses)}</td><td class="n" style="color:${h.netIncome>=0?"#10b981":"#ef4444"};">${o(h.netIncome)}</td><td class="n" style="color:${h.profitMargin>=0?"#10b981":"#ef4444"};">${D(h.profitMargin)}</td></tr>`,T++,u.ccMap.forEach(m=>{const f="dc"+k++,n=m.revenue>0?m.netIncome/m.revenue*100:0;g+=`<tr class="row-cc" data-gid="${f}" data-pgid="${v}"><td>${m.name.length>28?m.name.substring(0,28)+"…":m.name}</td><td class="n">${o(m.revenue)}</td><td class="n">${o(m.expenses)}</td><td class="n" style="color:${m.netIncome>=0?"#10b981":"#ef4444"};">${o(m.netIncome)}</td><td class="n" style="color:${n>=0?"#10b981":"#ef4444"};">${D(n)}</td></tr>`,m.accMap.forEach(c=>{const y=c.type==="income";g+=`<tr class="row-pt" data-pgid="${f}"><td>${c.code} - ${c.name.length>22?c.name.substring(0,22)+"…":c.name}</td><td class="n" style="color:${y?"#10b981":"transparent"};">${y?o(c.amount):""}</td><td class="n" style="color:${y?"transparent":"#ef4444"};">${y?"":o(c.amount)}</td><td class="n" style="color:rgba(255,255,255,0.3);">${y?"إيراد":"مصروف"}</td><td class="n">${o(Math.abs(c.amount))}</td></tr>`})})}),t.innerHTML=`<thead><tr><th>الشركة / مركز / حساب</th><th class="n sortable" data-col-idx="1">الإيرادات</th><th class="n sortable" data-col-idx="2">المصروفات</th><th class="n sortable" data-col-idx="3">صافي الربح</th><th class="n sortable" data-col-idx="4">% ربح</th></tr></thead>
  <tbody>${g}</tbody>
  <tfoot><tr><td>المجموع</td><td class="n" style="color:#10b981;">${o(a)}</td><td class="n" style="color:#ef4444;">${o(i)}</td><td class="n" style="color:${b>=0?"#10b981":"#ef4444"};">${o(b)}</td><td class="n" style="color:${d>=0?"#10b981":"#ef4444"};">${D(d)}</td></tr></tfoot>`,wt(t),bt(t)}function kt(t){const s=[],l=t.years,r=t.yearlyData;return l.forEach(e=>{var a;(((a=r[e])==null?void 0:a.companies)||[]).forEach(i=>{(i.pivotData||[]).forEach(b=>s.push(b))})}),s}function de(t,s){const l=s.grandTotals,r=kt(s),e=new Set(r.map(a=>a.account_code));t.innerHTML=`
    <div class="bi-kpi-row" style="grid-template-columns:repeat(4,1fr);">
      <div class="bi-kpi"><div class="bi-kpi-label">💰 إجمالي الإيرادات</div><div class="bi-kpi-value" style="color:#10b981;">${o(l.revenue)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📤 إجمالي المصروفات</div><div class="bi-kpi-value" style="color:#ef4444;">${o(l.expenses)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📈 صافي الربح</div><div class="bi-kpi-value" style="color:${l.netIncome>=0?"#10b981":"#ef4444"};">${o(l.netIncome)}</div><div class="bi-kpi-sub">هامش ${D(l.profitMargin)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📋 عدد الحسابات</div><div class="bi-kpi-value" style="color:#8b5cf6;">${e.size}</div></div>
    </div>
    <div class="bi-card bi-full">
      <div class="bi-card-title">📊 التقرير التقاطعي — حسب الحساب المالي</div>
      <div style="overflow-x:auto;"><table class="bi-table" id="tbl-pivot-acc" style="font-size:1rem;"></table></div>
    </div>`,requestAnimationFrame(()=>ue(document.getElementById("tbl-pivot-acc"),s))}function ue(t,s){if(!t)return;const l=kt(s),r=new Map;for(const u of l){let h=r.get(u.account_code);h||(h={code:u.account_code,name:u.account_name,type:u.account_type,m:{}},r.set(u.account_code,h)),h.m[u.month]||(h.m[u.month]={rev:0,exp:0}),h.m[u.month].rev+=u.revenue||0,h.m[u.month].exp+=u.expenses||0}const e=[1,2,3,4,5,6,7,8,9,10,11,12],a="border-right:2px solid rgba(139,92,246,0.3);";let i='<th style="position:sticky;right:0;z-index:2;background:var(--bg-dark);">الحساب</th>';i+=`<th colspan="3" class="n" style="color:#a78bfa;font-size:0.95rem;${a}">الإجمالي</th>`,e.forEach(u=>{i+=`<th colspan="3" class="n" style="font-size:0.88rem;color:rgba(255,255,255,0.55);">${Tt[u-1]}</th>`});let b="<th></th>";b+=`<th class="n sortable" data-col-idx="1" style="color:#10b981;font-size:0.85rem;">إيراد</th><th class="n sortable" data-col-idx="2" style="color:#ef4444;font-size:0.85rem;">مصروف</th><th class="n sortable" data-col-idx="3" style="color:#3b82f6;font-size:0.85rem;${a}">صافي</th>`,e.forEach((u,h)=>{const v=4+h*3;b+=`<th class="n sortable" data-col-idx="${v}" style="color:#10b981;font-size:0.82rem;">إيراد</th><th class="n sortable" data-col-idx="${v+1}" style="color:#ef4444;font-size:0.82rem;">مصروف</th><th class="n sortable" data-col-idx="${v+2}" style="color:#3b82f6;font-size:0.82rem;">صافي</th>`});let d="",g={};r.forEach(u=>{var n;const h=(n=u.type)==null?void 0:n.includes("income");let v=0,m=0;e.forEach(c=>{const y=u.m[c]||{rev:0,exp:0};v+=y.rev,m+=y.exp,g[c]||(g[c]={rev:0,exp:0}),g[c].rev+=y.rev,g[c].exp+=y.exp});let f=`<td style="position:sticky;right:0;background:var(--bg-card);white-space:nowrap;font-weight:600;color:${h?"#10b981":"#ef4444"};">${u.code} ${u.name.length>22?u.name.substring(0,22)+"…":u.name}</td>`;f+=`<td class="n" style="color:#10b981;font-weight:800;">${o(v)}</td><td class="n" style="color:#ef4444;font-weight:800;">${o(m)}</td><td class="n" style="color:${v-m>=0?"#3b82f6":"#f59e0b"};font-weight:800;${a}">${o(v-m)}</td>`,e.forEach(c=>{const y=u.m[c]||{rev:0,exp:0},w=y.rev-y.exp;f+=`<td class="n" style="color:#10b981;">${y.rev?o(y.rev):""}</td><td class="n" style="color:#ef4444;">${y.exp?o(y.exp):""}</td><td class="n" style="color:${w>=0?"#3b82f6":"#f59e0b"};">${y.rev||y.exp?o(w):""}</td>`}),d+=`<tr>${f}</tr>`});let p=0,k=0,T='<td style="font-weight:800;">المجموع</td>';e.forEach(u=>{const h=g[u]||{rev:0,exp:0};p+=h.rev,k+=h.exp}),T+=`<td class="n" style="color:#10b981;font-weight:800;">${o(p)}</td><td class="n" style="color:#ef4444;font-weight:800;">${o(k)}</td><td class="n" style="color:${p-k>=0?"#3b82f6":"#f59e0b"};font-weight:800;${a}">${o(p-k)}</td>`,e.forEach(u=>{const h=g[u]||{rev:0,exp:0},v=h.rev-h.exp;T+=`<td class="n" style="color:#10b981;font-weight:700;">${o(h.rev)}</td><td class="n" style="color:#ef4444;font-weight:700;">${o(h.exp)}</td><td class="n" style="color:${v>=0?"#3b82f6":"#f59e0b"};font-weight:700;">${o(v)}</td>`}),t.innerHTML=`<thead><tr>${i}</tr><tr>${b}</tr></thead><tbody>${d}</tbody><tfoot><tr>${T}</tr></tfoot>`,bt(t)}function pe(t,s){const l=s.grandTotals,r=kt(s),e=new Set(r.map(a=>a.cc));t.innerHTML=`
    <div class="bi-kpi-row" style="grid-template-columns:repeat(4,1fr);">
      <div class="bi-kpi"><div class="bi-kpi-label">💰 إجمالي الإيرادات</div><div class="bi-kpi-value" style="color:#10b981;">${o(l.revenue)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📤 إجمالي المصروفات</div><div class="bi-kpi-value" style="color:#ef4444;">${o(l.expenses)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📈 صافي الربح</div><div class="bi-kpi-value" style="color:${l.netIncome>=0?"#10b981":"#ef4444"};">${o(l.netIncome)}</div><div class="bi-kpi-sub">هامش ${D(l.profitMargin)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">🏢 عدد المراكز</div><div class="bi-kpi-value" style="color:#8b5cf6;">${e.size}</div></div>
    </div>
    <div class="bi-card bi-full">
      <div class="bi-card-title">📊 التقرير التقاطعي — حسب مركز التكلفة</div>
      <div style="overflow-x:auto;"><table class="bi-table" id="tbl-pivot-cc" style="font-size:1rem;"></table></div>
    </div>`,requestAnimationFrame(()=>be(document.getElementById("tbl-pivot-cc"),s))}function be(t,s){if(!t)return;const l=kt(s),r=new Map;for(const n of l){let c=r.get(n.cc);c||(c={name:n.cc,accMap:new Map,m:{}},r.set(n.cc,c));let y=c.accMap.get(n.account_code);y||(y={code:n.account_code,name:n.account_name,type:n.account_type,m:{}},c.accMap.set(n.account_code,y)),y.m[n.month]||(y.m[n.month]={rev:0,exp:0}),y.m[n.month].rev+=n.revenue||0,y.m[n.month].exp+=n.expenses||0,c.m[n.month]||(c.m[n.month]={rev:0,exp:0}),c.m[n.month].rev+=n.revenue||0,c.m[n.month].exp+=n.expenses||0}const e=[1,2,3,4,5,6,7,8,9,10,11,12],a="border-right:2px solid rgba(139,92,246,0.3);";let i='<th style="position:sticky;right:0;z-index:2;background:var(--bg-dark);">المجموعة / المركز / حساب</th>';i+=`<th colspan="3" class="n" style="color:#a78bfa;font-size:0.95rem;${a}">الإجمالي</th>`,e.forEach(n=>{i+=`<th colspan="3" class="n" style="font-size:0.88rem;color:rgba(255,255,255,0.55);">${Tt[n-1]}</th>`});let b="<th></th>";b+=`<th class="n sortable" data-col-idx="1" style="color:#10b981;font-size:0.85rem;">إيراد</th><th class="n sortable" data-col-idx="2" style="color:#ef4444;font-size:0.85rem;">مصروف</th><th class="n sortable" data-col-idx="3" style="color:#3b82f6;font-size:0.85rem;${a}">صافي</th>`,e.forEach((n,c)=>{const y=4+c*3;b+=`<th class="n sortable" data-col-idx="${y}" style="color:#10b981;font-size:0.82rem;">إيراد</th><th class="n sortable" data-col-idx="${y+1}" style="color:#ef4444;font-size:0.82rem;">مصروف</th><th class="n sortable" data-col-idx="${y+2}" style="color:#3b82f6;font-size:0.82rem;">صافي</th>`});const d=new Map,g=[];r.forEach((n,c)=>{const y=c.trim(),w=yt[y]||yt[c],C=w?mt.find(L=>String(L.id)===String(w)):null;if(C){let L=d.get(C.id);L||(L={name:C.name,color:C.color||"#f59e0b",ccs:[]},d.set(C.id,L)),L.ccs.push(c)}else g.push(c)});let p="",k=0,T=0,u={};function h(n){const c={};return n.forEach(y=>{const w=r.get(y);w&&e.forEach(C=>{const L=w.m[C]||{rev:0,exp:0};c[C]||(c[C]={rev:0,exp:0}),c[C].rev+=L.rev,c[C].exp+=L.exp})}),c}d.forEach((n,c)=>{const y="grpg"+k++,w=h(n.ccs);let C=0,L=0;e.forEach(A=>{const x=w[A]||{rev:0,exp:0};C+=x.rev,L+=x.exp}),e.forEach(A=>{const x=w[A]||{rev:0,exp:0};u[A]||(u[A]={rev:0,exp:0}),u[A].rev+=x.rev,u[A].exp+=x.exp});let E=`<td style="position:sticky;right:0;background:var(--bg-card);font-weight:800;color:${n.color};">${n.name}</td>`;E+=`<td class="n" style="color:#10b981;font-weight:800;">${o(C)}</td><td class="n" style="color:#ef4444;font-weight:800;">${o(L)}</td><td class="n" style="color:${C-L>=0?"#3b82f6":"#f59e0b"};font-weight:800;${a}">${o(C-L)}</td>`,e.forEach(A=>{const x=w[A]||{rev:0,exp:0},_=x.rev-x.exp;E+=`<td class="n" style="color:#10b981;">${x.rev?o(x.rev):""}</td><td class="n" style="color:#ef4444;">${x.exp?o(x.exp):""}</td><td class="n" style="color:${_>=0?"#3b82f6":"#f59e0b"};">${x.rev||x.exp?o(_):""}</td>`}),p+=`<tr class="row-co" data-gid="${y}">${E}</tr>`,n.ccs.forEach(A=>{const x=r.get(A);if(!x)return;const _="pcc"+T++;let B=0,O=0;e.forEach(I=>{const P=x.m[I]||{rev:0,exp:0};B+=P.rev,O+=P.exp});let M=`<td style="position:sticky;right:0;background:var(--bg-card);font-weight:700;color:#8b5cf6;">${x.name.length>28?x.name.substring(0,28)+"…":x.name}</td>`;M+=`<td class="n" style="color:#10b981;font-weight:700;">${o(B)}</td><td class="n" style="color:#ef4444;font-weight:700;">${o(O)}</td><td class="n" style="color:${B-O>=0?"#3b82f6":"#f59e0b"};font-weight:700;${a}">${o(B-O)}</td>`,e.forEach(I=>{const P=x.m[I]||{rev:0,exp:0},F=P.rev-P.exp;M+=`<td class="n" style="color:#10b981;">${P.rev?o(P.rev):""}</td><td class="n" style="color:#ef4444;">${P.exp?o(P.exp):""}</td><td class="n" style="color:${F>=0?"#3b82f6":"#f59e0b"};">${P.rev||P.exp?o(F):""}</td>`}),p+=`<tr class="row-cc" data-gid="${_}" data-pgid="${y}">${M}</tr>`,x.accMap.forEach(I=>{var R;const P=(R=I.type)==null?void 0:R.includes("income");let F=0,H=0;e.forEach(z=>{const S=I.m[z]||{rev:0,exp:0};F+=S.rev,H+=S.exp});let q=`<td style="position:sticky;right:0;background:var(--bg-card);padding-right:52px;color:${P?"#10b981":"#ef4444"};">${I.code} ${I.name.length>20?I.name.substring(0,20)+"…":I.name}</td>`;q+=`<td class="n" style="color:#10b981;">${o(F)}</td><td class="n" style="color:#ef4444;">${o(H)}</td><td class="n" style="color:${F-H>=0?"#3b82f6":"#f59e0b"};${a}">${o(F-H)}</td>`,e.forEach(z=>{const S=I.m[z]||{rev:0,exp:0},N=S.rev-S.exp;q+=`<td class="n" style="color:#10b981;">${S.rev?o(S.rev):""}</td><td class="n" style="color:#ef4444;">${S.exp?o(S.exp):""}</td><td class="n" style="color:${N>=0?"#3b82f6":"#f59e0b"};">${S.rev||S.exp?o(N):""}</td>`}),p+=`<tr class="row-pt" data-pgid="${_}">${q}</tr>`})})}),g.forEach(n=>{const c=r.get(n);if(!c)return;const y="pug"+k++;let w=0,C=0;e.forEach(E=>{const A=c.m[E]||{rev:0,exp:0};w+=A.rev,C+=A.exp,u[E]||(u[E]={rev:0,exp:0}),u[E].rev+=A.rev,u[E].exp+=A.exp});let L=`<td style="position:sticky;right:0;background:var(--bg-card);font-weight:700;color:#8b5cf6;">${c.name.length>28?c.name.substring(0,28)+"…":c.name}</td>`;L+=`<td class="n" style="color:#10b981;font-weight:800;">${o(w)}</td><td class="n" style="color:#ef4444;font-weight:800;">${o(C)}</td><td class="n" style="color:${w-C>=0?"#3b82f6":"#f59e0b"};font-weight:800;${a}">${o(w-C)}</td>`,e.forEach(E=>{const A=c.m[E]||{rev:0,exp:0},x=A.rev-A.exp;L+=`<td class="n" style="color:#10b981;">${A.rev?o(A.rev):""}</td><td class="n" style="color:#ef4444;">${A.exp?o(A.exp):""}</td><td class="n" style="color:${x>=0?"#3b82f6":"#f59e0b"};">${A.rev||A.exp?o(x):""}</td>`}),p+=`<tr class="row-co" data-gid="${y}">${L}</tr>`,c.accMap.forEach(E=>{var O;const A=(O=E.type)==null?void 0:O.includes("income");let x=0,_=0;e.forEach(M=>{const I=E.m[M]||{rev:0,exp:0};x+=I.rev,_+=I.exp});let B=`<td style="position:sticky;right:0;background:var(--bg-card);padding-right:30px;color:${A?"#10b981":"#ef4444"};">${E.code} ${E.name.length>20?E.name.substring(0,20)+"…":E.name}</td>`;B+=`<td class="n" style="color:#10b981;">${o(x)}</td><td class="n" style="color:#ef4444;">${o(_)}</td><td class="n" style="color:${x-_>=0?"#3b82f6":"#f59e0b"};${a}">${o(x-_)}</td>`,e.forEach(M=>{const I=E.m[M]||{rev:0,exp:0},P=I.rev-I.exp;B+=`<td class="n" style="color:#10b981;">${I.rev?o(I.rev):""}</td><td class="n" style="color:#ef4444;">${I.exp?o(I.exp):""}</td><td class="n" style="color:${P>=0?"#3b82f6":"#f59e0b"};">${I.rev||I.exp?o(P):""}</td>`}),p+=`<tr class="row-pt" data-pgid="${y}">${B}</tr>`})});let v=0,m=0,f='<td style="position:sticky;right:0;background:var(--bg-dark);font-weight:800;">المجموع</td>';e.forEach(n=>{const c=u[n]||{rev:0,exp:0};v+=c.rev,m+=c.exp}),f+=`<td class="n" style="color:#10b981;font-weight:800;">${o(v)}</td><td class="n" style="color:#ef4444;font-weight:800;">${o(m)}</td><td class="n" style="color:${v-m>=0?"#3b82f6":"#f59e0b"};font-weight:800;${a}">${o(v-m)}</td>`,e.forEach(n=>{const c=u[n]||{rev:0,exp:0},y=c.rev-c.exp;f+=`<td class="n" style="color:#10b981;font-weight:700;">${o(c.rev)}</td><td class="n" style="color:#ef4444;font-weight:700;">${o(c.exp)}</td><td class="n" style="color:${y>=0?"#3b82f6":"#f59e0b"};font-weight:700;">${o(y)}</td>`}),t.innerHTML=`<thead><tr>${i}</tr><tr>${b}</tr></thead><tbody>${p}</tbody><tfoot><tr>${f}</tr></tfoot>`,wt(t),bt(t)}function fe(t,s){if(!t)return;const l=s.years,r=s.yearlyData;t.innerHTML=`<thead><tr><th>السنة</th><th class="n sortable" data-col-idx="1">الإيرادات</th><th class="n sortable" data-col-idx="2">المصروفات</th><th class="n sortable" data-col-idx="3">صافي الربح</th><th class="n sortable" data-col-idx="4">% ربح</th><th class="n sortable" data-col-idx="5">المحصّل</th><th class="n sortable" data-col-idx="6">المتبقي</th><th class="n sortable" data-col-idx="7">% تحصيل</th><th class="n sortable" data-col-idx="8">الأصول</th><th class="n sortable" data-col-idx="9">الالتزامات</th></tr></thead>
  <tbody>${l.map((e,a)=>{const i=r[e].totals,b=i.collected||0,d=i.collectionRate||0;return`<tr>
  <td style="color:${rt[a%rt.length]};font-family:var(--font-en);font-weight:800;font-size:0.9rem;">${e}</td>
  <td class="n" style="color:#10b981;">${o(i.revenue)}</td><td class="n" style="color:#ef4444;">${o(i.expenses)}</td>
  <td class="n" style="color:${i.netIncome>=0?"#10b981":"#ef4444"};">${o(i.netIncome)}</td><td class="n" style="color:${i.profitMargin>=0?"#10b981":"#ef4444"};">${D(i.profitMargin)}</td>
  <td class="n" style="color:#06b6d4;">${o(b)}</td><td class="n" style="color:#f59e0b;">${o(i.remaining||0)}</td>
  <td class="n" style="color:${d>=70?"#10b981":"#f59e0b"};">${D(d)}</td>
  <td class="n" style="color:#3b82f6;">${o(i.assets)}</td><td class="n" style="color:#ef4444;">${o(i.liabilities)}</td></tr>`}).join("")}</tbody>`,bt(t)}async function ge(t){var s,l;if(!Z){vt("لا توجد بيانات","error");return}try{const r=await it.createPresentationShare({title:`${Z.years.join("+")} — ${(((s=Z.yearlyData[Z.years[0]])==null?void 0:s.companies)||[]).map(a=>a.companyName).join(" + ")}`,companyId:Z._selectedCos.join(","),dateFrom:Z.years.join(","),dateTo:Z._selectedYrs.join(","),speed:0}),e=`${location.origin}/viewer.html?token=${r.token}`;await((l=navigator.clipboard)==null?void 0:l.writeText(e).catch(()=>{})),vt("✅ تم إنشاء الرابط ونسخه!","success")}catch{vt("خطأ في المشاركة","error")}}async function Ft(t){const s=t.querySelector("#shares-modal");s.style.display="flex";const l=t.querySelector("#shares-list");l.innerHTML='<p style="color:var(--text-muted);text-align:center;">⏳</p>';try{const r=await it.getPresentationShares();if(!r.length){l.innerHTML='<p style="color:var(--text-muted);text-align:center;">لا توجد روابط</p>';return}l.innerHTML=r.map(e=>{const a=`${location.origin}/viewer.html?token=${e.token}`;return`<div style="background:rgba(255,255,255,0.03);border-radius:12px;padding:14px;margin-bottom:10px;border:1px solid rgba(255,255,255,0.06);">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div><div style="color:var(--text-white);font-weight:600;font-size:0.85rem;">${e.title}</div><div style="color:var(--text-muted);font-size:0.72rem;margin-top:3px;">${e.created_at}</div></div>
          <div style="display:flex;gap:8px;"><button class="btn copy-btn" data-url="${a}" style="font-size:0.72rem;padding:5px 10px;">📋</button><button class="btn del-btn" data-id="${e.id}" style="font-size:0.72rem;padding:5px 10px;color:var(--accent-red);">🗑️</button></div>
        </div>
      </div>`}).join(""),l.querySelectorAll(".copy-btn").forEach(e=>e.addEventListener("click",async()=>{var a;await((a=navigator.clipboard)==null?void 0:a.writeText(e.dataset.url)),vt("✅ تم نسخ الرابط","success")})),l.querySelectorAll(".del-btn").forEach(e=>e.addEventListener("click",async()=>{await it.deletePresentationShare(e.dataset.id),vt("تم الحذف","success"),Ft(t)}))}catch{l.innerHTML='<p style="color:var(--accent-red);">خطأ</p>'}}function ye(t,s){let l=0;for(const p of Object.keys(pt))l+=pt[p].size;s.years,s.yearlyData;const r=s.grandTotals.revenue,e=s.grandTotals.expenses,a=s.grandTotals.collected,i=r-e,b=r>0?i/r*100:0,d=r-a,g=r>0?a/r*100:0;if(l===0){t.innerHTML='<div class="bi-empty">لا توجد مراكز تكلفة محددة لإعادة التوزيع.<br><span style="font-size:0.9rem;color:rgba(255,255,255,0.3);">حدد المراكز الإدارية من صفحة الحسابات التحليلية</span></div>';return}t.innerHTML=`
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
      <div class="bi-kpi"><div class="bi-kpi-label">📋 المتبقي</div><div class="bi-kpi-value" style="color:#f59e0b;">${o(d)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📊 % تحصيل</div><div class="bi-kpi-value" style="color:${g>=70?"#10b981":"#f59e0b"};">${D(g)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">🔄 مراكز قابلة للتوزيع</div><div class="bi-kpi-value" style="color:#a78bfa;">${l}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">📈 صافي الربح</div><div class="bi-kpi-value" style="color:${i>=0?"#10b981":"#ef4444"};">${o(i)}</div><div class="bi-kpi-sub">هامش ${D(b)}</div></div>
    </div>
        <div class="bi-card bi-full">
      <div class="bi-card-title">🔄 إعادة التوزيع حسب الإيرادات <span style="font-size:0.85rem;color:rgba(255,255,255,0.35);margin-right:8px;">نسبة وتناسب</span></div>
      <div style="overflow-x:auto;"><table class="bi-table" id="tbl-redist-rev" style="font-size:1rem;"></table></div>
    </div>
    <div class="bi-card bi-full">
      <div class="bi-card-title">🔄 إعادة التوزيع حسب المصروفات <span style="font-size:0.85rem;color:rgba(255,255,255,0.35);margin-right:8px;">نسبة وتناسب</span></div>
      <div style="overflow-x:auto;"><table class="bi-table" id="tbl-redist-exp" style="font-size:1rem;"></table></div>
    </div>`,requestAnimationFrame(()=>{Bt(document.getElementById("tbl-redist-rev"),s,"revenue"),Bt(document.getElementById("tbl-redist-exp"),s,"expense")})}function he(t){t.querySelectorAll(".row-co").forEach(s=>{s.addEventListener("click",()=>{const l=s.dataset.gid,r=s.classList.toggle("open"),e=t.querySelectorAll(`.row-cc[data-pgid="${l}"]`);e.forEach(a=>a.classList.toggle("show",r)),r||e.forEach(a=>{a.classList.remove("open"),t.querySelectorAll(`.row-sub[data-pgid="${a.dataset.gid}"]`).forEach(i=>{i.classList.remove("show","open"),t.querySelectorAll(`.row-acct[data-pgid="${i.dataset.gid}"]`).forEach(b=>b.classList.remove("show"))}),t.querySelectorAll(`.row-pt[data-pgid="${a.dataset.gid}"]`).forEach(i=>i.classList.remove("show"))})})}),t.querySelectorAll(".row-cc").forEach(s=>{s.addEventListener("click",l=>{l.stopPropagation();const r=s.dataset.gid,e=s.classList.toggle("open");t.querySelectorAll(`.row-sub[data-pgid="${r}"]`).forEach(a=>a.classList.toggle("show",e)),t.querySelectorAll(`.row-pt[data-pgid="${r}"]`).forEach(a=>a.classList.toggle("show",e)),e||t.querySelectorAll(`.row-sub[data-pgid="${r}"]`).forEach(a=>{a.classList.remove("open"),t.querySelectorAll(`.row-acct[data-pgid="${a.dataset.gid}"]`).forEach(i=>i.classList.remove("show"))})})}),t.querySelectorAll(".row-sub").forEach(s=>{s.addEventListener("click",l=>{l.stopPropagation();const r=s.dataset.gid,e=s.classList.toggle("open");t.querySelectorAll(`.row-acct[data-pgid="${r}"]`).forEach(a=>a.classList.toggle("show",e))})})}function Bt(t,s,l){var C,L;if(!t)return;const r=s.years,e=s.yearlyData,a=r.length>1;function i(E,A,x,_,B,O,M,I){const P=I?"font-weight:800;":"";return`<td class="n" style="color:#10b981;${P}">${o(E)}</td><td class="n" style="color:#ef4444;${P}">${o(A)}</td><td class="n" style="color:#f59e0b;${P}">${x>0?o(x):'<span style="color:rgba(255,255,255,0.15);">-</span>'}</td><td class="n" style="color:#ef4444;${P}">${o(_)}</td><td class="n" style="color:#06b6d4;${P}">${o(B)}</td><td class="n" style="color:#f59e0b;${P}">${o(E-B)}</td><td class="n" style="color:${E>0?B/E*100>=70?"#10b981":"#f59e0b":"rgba(255,255,255,0.3)"};${P}">${E>0?D(B/E*100):"-"}</td><td class="n" style="color:${O>=0?"#10b981":"#ef4444"};${P}">${o(O)}</td><td class="n" style="color:${M>=0?"#10b981":"#ef4444"};${P}">${D(M)}</td>`}let b="",d=0,g=0,p=0,k=0,T=0,u=0,h=0,v=0,m=0,f=0;function n(E,A){let x=0;const _=[],B=[];(E.costCenters||[]).forEach(S=>{A.has(S.name.trim())?(x+=S.expenses||0,_.push(S)):B.push(S)});const O={};(E.accountTree||[]).forEach(S=>{A.has(S.name.trim())||(O[S.name]=S.accounts||[])});let M=0;l==="revenue"?B.forEach(S=>{M+=S.revenue||0}):B.forEach(S=>{M+=S.expenses||0});let I=0;const P=B.map(S=>{const N=l==="revenue"?S.revenue||0:S.expenses||0,tt=M>0?N/M:B.length>0?1/B.length:0,J=x>0?Math.round(x*tt):0;return I+=J,{cc:S,a:J}});if(x>0&&P.length>0){const S=x-I;if(S!==0){let N=0,tt=0;P.forEach((J,j)=>{const W=l==="revenue"?J.cc.revenue||0:J.cc.expenses||0;W>tt&&(tt=W,N=j)}),P[N].a+=S}}let F=0,H=0,q=0,R=0,z=0;return P.forEach(({cc:S,a:N})=>{F+=S.revenue||0,H+=S.expenses||0,q+=N,R+=(S.expenses||0)+N,z+=S.collected||0}),_.forEach(S=>{F+=S.revenue||0,z+=S.collected||0}),{allocs:P,adminCCs:_,adminExp:x,accTree:O,totals:{rev:F,orig:H,alloc:q,total:R,coll:z,net:F-R,margin:F>0?(F-R)/F*100:0}}}function c(E,A,x,_,B){const{allocs:O,adminCCs:M,accTree:I}=A;let P="";const F=new Map,H=[];if(O.forEach(q=>{const R=yt[q.cc.name.trim()],z=R?mt.find(S=>String(S.id)===String(R)):null;if(z){let S=F.get(z.id);S||(S={name:z.name,color:z.color||"#f59e0b",items:[]},F.set(z.id,S)),S.items.push(q)}else H.push(q)}),F.forEach(q=>{const R="rgrp"+g++;let z=0,S=0,N=0,tt=0,J=0;q.items.forEach(({cc:Y,a:X})=>{z+=Y.revenue||0,S+=Y.expenses||0,N+=X,tt+=(Y.expenses||0)+X,J+=Y.collected||0});const j=z-tt,W=z>0?j/z*100:0;P+=`<tr class="${x}" data-gid="${R}" data-pgid="${E}"><td style="font-weight:700;color:${q.color};">${q.name}</td>${i(z,S,N,tt,J,j,W,!0)}</tr>`,q.items.forEach(({cc:Y,a:X})=>{const et="rcc"+p++,at=(Y.expenses||0)+X,ot=(Y.revenue||0)-at,ct=Y.revenue>0?ot/Y.revenue*100:0;P+=`<tr class="${_}" data-gid="${et}" data-pgid="${R}"><td>${Y.name.length>28?Y.name.substring(0,28)+"…":Y.name}</td>${i(Y.revenue||0,Y.expenses||0,X,at,Y.collected||0,ot,ct)}</tr>`,(I[Y.name]||[]).forEach(st=>{const nt=st.type==="income";P+=`<tr class="${B}" data-pgid="${et}"><td style="color:${nt?"#10b981":"#ef4444"};">${st.code} ${st.name.length>20?st.name.substring(0,20)+"…":st.name}</td><td class="n" style="color:#10b981;">${nt?o(st.amount):""}</td><td class="n" style="color:#ef4444;">${nt?"":o(st.amount)}</td><td class="n" style="color:rgba(255,255,255,0.15);">-</td><td class="n" style="color:rgba(255,255,255,0.15);">-</td><td class="n" style="color:rgba(255,255,255,0.15);">-</td><td class="n" style="color:rgba(255,255,255,0.15);">-</td><td class="n" style="color:rgba(255,255,255,0.15);">-</td><td class="n" style="color:rgba(255,255,255,0.3);">${nt?"إيراد":"مصروف"}</td><td class="n">${o(Math.abs(st.amount))}</td></tr>`})})}),H.forEach(({cc:q,a:R})=>{const z="rcc"+p++,S=(q.expenses||0)+R,N=(q.revenue||0)-S,tt=q.revenue>0?N/q.revenue*100:0;P+=`<tr class="${x}" data-gid="${z}" data-pgid="${E}"><td style="font-weight:600;color:#8b5cf6;">${q.name.length>28?q.name.substring(0,28)+"…":q.name}</td>${i(q.revenue||0,q.expenses||0,R,S,q.collected||0,N,tt)}</tr>`,(I[q.name]||[]).forEach(J=>{const j=J.type==="income";P+=`<tr class="${B}" data-pgid="${z}"><td style="color:${j?"#10b981":"#ef4444"};">${J.code} ${J.name.length>20?J.name.substring(0,20)+"…":J.name}</td><td class="n" style="color:#10b981;">${j?o(J.amount):""}</td><td class="n" style="color:#ef4444;">${j?"":o(J.amount)}</td><td class="n" style="color:rgba(255,255,255,0.15);">-</td><td class="n" style="color:rgba(255,255,255,0.15);">-</td><td class="n" style="color:rgba(255,255,255,0.15);">-</td><td class="n" style="color:rgba(255,255,255,0.15);">-</td><td class="n" style="color:rgba(255,255,255,0.15);">-</td><td class="n" style="color:rgba(255,255,255,0.3);">${j?"إيراد":"مصروف"}</td><td class="n">${o(Math.abs(J.amount))}</td></tr>`})}),M.length>0){const q=M.map(z=>z.name.length>12?z.name.substring(0,12)+"…":z.name).join(" + "),R=M.reduce((z,S)=>z+(S.expenses||0),0);P+=`<tr class="${x}" data-pgid="${E}" style="background:rgba(245,158,11,0.04);"><td style="color:#f59e0b;font-weight:700;">🔄 موزع: ${q}</td><td class="n" style="color:rgba(255,255,255,0.2);">-</td><td class="n" style="color:#f59e0b;font-weight:700;">${o(R)}</td><td class="n" style="color:#f59e0b;">← ${o(R)}</td>${'<td class="n" style="color:rgba(255,255,255,0.2);">-</td>'.repeat(6)}</tr>`}return P}if(a){const E=new Map;let A=0;for(const x of r)for(const _ of((L=e[x])==null?void 0:L.companies)||[]){const B=String(_.companyId),O=pt[B]||new Set,M=n(_,O);let I=E.get(B);I||(I={name:_.companyName,color:Q[A++%Q.length],yearData:[]},E.set(B,I)),I.yearData.push({yr:x,result:M})}E.forEach(x=>{const _="rco"+d++;let B=0,O=0,M=0,I=0,P=0;x.yearData.forEach(({result:q})=>{const R=q.totals;B+=R.rev,O+=R.orig,M+=R.alloc,I+=R.total,P+=R.coll});const F=B-I,H=B>0?F/B*100:0;k+=B,T+=O,u+=M,h+=I,v+=P,m+=F,x.yearData.forEach(({result:q})=>{f+=q.adminExp}),b+=`<tr class="row-co" data-gid="${_}"><td style="color:${x.color};font-weight:800;">${x.name}</td>${i(B,O,M,I,P,F,H,!0)}</tr>`,x.yearData.forEach(({yr:q,result:R})=>{const z="ryr"+d++,S=R.totals;b+=`<tr class="row-cc" data-gid="${z}" data-pgid="${_}"><td style="font-family:var(--font-en);font-weight:700;color:rgba(255,255,255,0.7);">📅 ${q}</td>${i(S.rev,S.orig,S.alloc,S.total,S.coll,S.net,S.margin,!0)}</tr>`,b+=c(z,R,"row-sub","row-sub","row-acct")})})}else for(const E of r)for(const A of((C=e[E])==null?void 0:C.companies)||[]){const x=String(A.companyId),_=pt[x]||new Set,B="rco"+d++,O=n(A,_),M=O.totals;k+=M.rev,T+=M.orig,u+=M.alloc,h+=M.total,v+=M.coll,m+=M.net,f+=O.adminExp,b+=`<tr class="row-co" data-gid="${B}"><td style="color:${Q[d%Q.length]};font-weight:800;">${A.companyName}</td>${i(M.rev,M.orig,M.alloc,M.total,M.coll,M.net,M.margin,!0)}</tr>`,b+=c(B,O,"row-cc","row-sub","row-acct")}const y=k>0?m/k*100:0,w=`<td style="font-weight:800;">المجموع</td>${i(k,T,u,h,v,m,y,!0)}`;t.innerHTML=`<thead><tr><th>الشركة / المجموعة / المركز / حساب</th><th class="n sortable" data-col-idx="1">الإيرادات</th><th class="n sortable" data-col-idx="2">مصروفات أصلية</th><th class="n sortable" data-col-idx="3" style="color:#f59e0b;">المُحمّل</th><th class="n sortable" data-col-idx="4" style="color:#ef4444;">إجمالي مصروفات</th><th class="n sortable" data-col-idx="5" style="color:#06b6d4;">المحصّل</th><th class="n sortable" data-col-idx="6" style="color:#f59e0b;">المتبقي</th><th class="n sortable" data-col-idx="7" style="color:#a78bfa;">% تحصيل</th><th class="n sortable" data-col-idx="8">صافي الربح</th><th class="n sortable" data-col-idx="9">% ربح</th></tr></thead><tbody>${b}</tbody><tfoot><tr>${w}</tr></tfoot>`,he(t),bt(t)}async function ve(t,s,l,r){const e=new Date().toISOString().slice(0,10),a=s._selectedCos||[];t.innerHTML='<div class="bi-empty">⏳ جاري تحميل بيانات الضمانات...</div>';try{const i=await it.getGuaranteePendingList({companyIds:a.join(",")});if(!i||!i.length){t.innerHTML='<div class="bi-empty">لا توجد ضمانات بنكية معلّقة</div>';return}let b=0,d=0;i.forEach(p=>p.items.forEach(k=>{b+=k.amount,d++}));let g=`
      <div class="bi-kpi-row" style="margin-bottom:18px">
        <div class="bi-kpi"><div class="bi-kpi-label">🏦 إجمالي الضمانات المعلّقة</div><div class="bi-kpi-value" style="color:#06b6d4;">${o(b)}</div></div>
        <div class="bi-kpi"><div class="bi-kpi-label">📋 عدد الضمانات</div><div class="bi-kpi-value" style="color:#a78bfa;">${d}</div></div>
        <div class="bi-kpi"><div class="bi-kpi-label">📅 بتاريخ</div><div class="bi-kpi-value" style="color:#f59e0b;font-size:1.1rem;">${e}</div></div>
        <div class="bi-kpi"><div class="bi-kpi-label">🏢 الشركات</div><div class="bi-kpi-value" style="color:#10b981;">${i.length}</div></div>
      </div>
    `;i.forEach(p=>{const k=p.items.reduce((T,u)=>T+u.amount,0);g+=`
        <div class="bi-card bi-full" style="margin-bottom:16px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
            <div style="font-size:1.05rem;font-weight:700;color:var(--text-white);">🏢 ${p.companyName}</div>
            <div style="font-family:var(--font-en);font-weight:700;color:#06b6d4;font-size:1.05rem">${o(k)}</div>
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
              ${p.items.map((T,u)=>`
                <tr>
                  <td style="text-align:center;color:#475569;font-size:0.8rem">${u+1}</td>
                  <td style="color:var(--text-white)">${T.description}</td>
                  <td style="color:#94a3b8;font-size:0.85rem">${T.account}</td>
                  <td class="n" style="color:#06b6d4;font-weight:700">${o(T.amount)}</td>
                </tr>
              `).join("")}
              <tr style="background:rgba(139,92,246,0.06)">
                <td colspan="3" style="text-align:center;font-weight:700;color:#c4b5fd">الإجمالي</td>
                <td class="n" style="font-weight:800;color:#06b6d4;font-size:1rem">${o(k)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      `}),t.innerHTML=g,t.querySelectorAll("[data-guarantee-tbl]").forEach(p=>bt(p))}catch(i){console.error("Guarantees error:",i),t.innerHTML=`<div class="bi-empty" style="color:#ef4444">❌ خطأ: ${i.message}</div>`}}async function me(t,s,l,r){const e=s._selectedYrs||[],a=s._selectedCos||[];t.innerHTML=`
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;flex-wrap:wrap;">
      <h2 style="margin:0;color:rgba(255,255,255,0.85);font-size:1.3rem;">🛍️ لوحة التقرير العام للمبيعات — ${e.join(", ")||"الكل"}</h2>
    </div>
    <div id="sales-content"><div class="bi-empty">⏳ جاري تحميل بيانات المبيعات الموحدة...</div></div>
  `;try{const i=document.getElementById("date-from")?document.getElementById("date-from").value:"",b=document.getElementById("date-to")?document.getElementById("date-to").value:"";let d=i,g=b;!d&&!g&&e.length>0&&(d=`${Math.min(...e)}-01-01`,g=`${Math.max(...e)}-12-31`);const p={limit:5e4};d&&(p.dateFrom=d),g&&(p.dateTo=g),a.length>0&&(p.masterCompanyIds=a.join(",")),r&&r.length>0&&(p.costCenters=r.join(","));const k=await it.sales.getInvoices(p);let T=0,u=0,h=0,v=0,m=0,f=0,n=0;const c=[],y={},w=new Array(12).fill(0),C={};(k.items||[]).forEach(M=>{if(M.state==="draft")return;f++;const I=parseFloat(M.amount_total)||0;let P=0,F=0,H="";try{const z=M.raw_data?JSON.parse(M.raw_data):{};P=parseFloat(z.total_paid)||0,F=parseFloat(z.amount_untaxed)||0,H=z.move_type||""}catch{}if(H==="Customer Credit Note"||H==="out_refund"||I<0||(T+=I,u+=F,h+=I-F),v+=P,H==="Customer Credit Note"||H==="out_refund"){n+=Math.abs(I);let z="";try{M.raw_data&&(z=JSON.parse(M.raw_data).reference||"")}catch{}c.push({name:M.name||M.invoice_number||"بدون رقم",partner:M.partner_name||"غير معروف",date:M.date||"",amount:Math.abs(I),ref:z})}const q=M.company_name&&M.company_name.trim()!==""?M.company_name:"أخرى";if(y[q]||(y[q]=0),y[q]+=I,M.date){const z=M.date.split("-");if(z.length>=2){const S=parseInt(z[1],10);S>=1&&S<=12&&(w[S-1]+=I)}}const R=M.partner_name&&M.partner_name.trim()!==""?M.partner_name:"عميل غير معروف";C[R]||(C[R]={name:R,total:0,untaxed:0,tax:0,paid:0,rem:0,refunds:0}),H==="Customer Credit Note"||H==="out_refund"||I<0?C[R].refunds+=Math.abs(I):(C[R].total+=I,C[R].untaxed+=F,C[R].tax+=I-F),C[R].paid+=P,C[R].rem=C[R].total-C[R].refunds-C[R].paid}),m=T-n-v;const L=Object.values(C).sort((M,I)=>I.total-M.total),E=L.slice(0,10),A=v+n,x=T>0?A/T*100:0,_=T>0?m/T*100:0;let B=`
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
          <div class="skpi-val" style="color:#10b981;">${o(T)}</div>
        </div>
        <div class="skpi skpi-4 skpi-hero-refund">
          <div class="skpi-lbl">💸 إشعارات المرتجعات</div>
          <div class="skpi-val" style="color:#f43f5e;">${o(n)}</div>
        </div>
        <div class="skpi skpi-4 skpi-hero-net">
          <div class="skpi-lbl">📈 صافي المبيعات</div>
          <div class="skpi-val" style="color:#60a5fa;">${o(T-n)}</div>
        </div>

        <div class="skpi skpi-4">
          <div class="skpi-lbl">📝 قبل الضريبة</div>
          <div class="skpi-val" style="color:#8b5cf6;">${o(u)}</div>
        </div>
        <div class="skpi skpi-4">
          <div class="skpi-lbl">⚖️ قيمة الضريبة</div>
          <div class="skpi-val" style="color:#f43f5e;">${o(h)}</div>
        </div>
        <div class="skpi skpi-4">
          <div class="skpi-lbl">🧾 عدد الفواتير الإجمالي</div>
          <div class="skpi-val" style="color:#a78bfa;">${o(f)}</div>
        </div>

        <div class="skpi skpi-6 skpi-prog-paid">
          <div class="skpi-lbl">✅ إجمالي المحصّل (متضمناً المرتجعات)</div>
          <div class="skpi-val" style="color:#06b6d4;font-size:1.8rem;">${o(A)}</div>
          <div style="margin-top:16px;display:flex;align-items:center;gap:16px;">
            <div style="flex:1;height:8px;background:rgba(0,0,0,0.4);border-radius:4px;overflow:hidden;box-shadow:inset 0 1px 3px rgba(0,0,0,0.5);">
              <div style="width:${x}%;height:100%;background:linear-gradient(90deg, #0891b2, #22d3ee);border-radius:4px;box-shadow:0 0 12px #06b6d4;"></div>
            </div>
            <span style="color:#22d3ee;font-size:1.05rem;font-weight:700;"><span style="font-family:var(--font-en);">${D(x)}</span></span>
          </div>
        </div>
        <div class="skpi skpi-6 skpi-prog-rem">
          <div class="skpi-lbl">⏳ المتبقي للتحصيل</div>
          <div class="skpi-val" style="color:#f59e0b;font-size:1.8rem;">${o(Math.max(0,m))}</div>
          <div style="margin-top:16px;display:flex;align-items:center;gap:16px;">
            <div style="flex:1;height:8px;background:rgba(0,0,0,0.4);border-radius:4px;overflow:hidden;box-shadow:inset 0 1px 3px rgba(0,0,0,0.5);">
              <div style="width:${Math.max(0,_)}%;height:100%;background:linear-gradient(90deg, #d97706, #fbbf24);border-radius:4px;box-shadow:0 0 12px #f59e0b;"></div>
            </div>
            <span style="color:#fbbf24;font-size:1.05rem;font-weight:700;"><span style="font-family:var(--font-en);">${D(Math.max(0,_))}</span></span>
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
    `;const O=t.querySelector("#sales-content");O.innerHTML=B,requestAnimationFrame(()=>{St(document.getElementById("ch-sales-monthly"),w,"#10b981","#34d399");const M=Object.keys(y),I=Object.values(y);I.length>0&&xt(document.getElementById("ch-sales-companies"),{labels:M,values:I,colors:Q});const P=null;if(E.length>0){const j=E.map(X=>X.name.length>25?X.name.substring(0,25)+"..":X.name),W=E.map(X=>X.total),Y=Math.max(...W,1);Mt(document.getElementById("ch-sales-partners"),{groups:W.map(X=>[X]),max:Y,colors:["#3b82f6"],labels:j,exactValues:!0})}const F=document.getElementById("sales-partner-tbody"),H=document.getElementById("sales-partner-search");let q="total",R=-1,z="date",S=-1;const N=j=>new Intl.NumberFormat("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}).format(j);window.salesTableSort=j=>{var W;q===j?R*=-1:(q=j,R=-1),J(((W=document.getElementById("sales-partner-search"))==null?void 0:W.value)||"")},window.refundsTableSort=j=>{z===j?S*=-1:(z=j,S=-1),tt()};const tt=()=>{const j=document.getElementById("sales-refunds-tbody");if(!j)return;if(c.length===0){j.innerHTML='<tr><td colspan="6" style="text-align:center;padding:20px;color:rgba(255,255,255,0.3);">لا توجد إشعارات أو مرتجعات</td></tr>';return}let W=[...c];W.sort((et,at)=>{const ot=et[z]??0,ct=at[z]??0;return["name","date","partner"].includes(z)?S*String(ot).localeCompare(String(ct),"ar"):S*(Number(ot)-Number(ct))});const Y=W.reduce((et,at)=>et+at.amount,0),X='<tr style="border-top:2px solid rgba(239,68,68,0.3);background:rgba(239,68,68,0.06);font-weight:700;"><td style="color:rgba(255,255,255,0.4);">Σ</td><td style="color:#fca5a5;">المجموع ('+W.length+')</td><td></td><td></td><td></td><td class="n" style="color:#ef4444;font-weight:bold;">'+N(Y)+"</td></tr>";document.getElementById("sales-refunds-tfoot").innerHTML=X,j.innerHTML=W.map((et,at)=>'<tr style="border-bottom:1px solid rgba(255,255,255,0.05);"><td style="font-family:var(--font-en);color:rgba(252,165,165,0.7);">'+(at+1)+'</td><td style="font-family:var(--font-en);">'+et.name+'</td><td style="font-family:var(--font-en);">'+et.date+'</td><td style="font-weight:700;">'+et.partner+'</td><td style="font-family:var(--font-en);color:#93c5fd;">'+(et.ref||"—")+'</td><td class="n" style="color:#ef4444;font-weight:bold;">'+N(et.amount)+"</td></tr>").join("")},J=j=>{let W=[...L];W.sort((G,K)=>{const dt=q==="name"?G.name:q==="net"?(G.total||0)-(G.refunds||0):G[q]||0,ft=q==="name"?K.name:q==="net"?(K.total||0)-(K.refunds||0):K[q]||0;return q==="name"?R*String(dt).localeCompare(String(ft),"ar"):R*(Number(dt)-Number(ft))});let Y=j?W.filter(G=>G.name.toLowerCase().includes(j.toLowerCase())):W;if(Y.length===0){F.innerHTML='<tr><td colspan="9" style="text-align:center;padding:20px;color:rgba(255,255,255,0.4);">لا توجد نتائج مطابقة</td></tr>';return}const X=Y.reduce((G,K)=>G+K.untaxed,0),et=Y.reduce((G,K)=>G+K.tax,0),at=Y.reduce((G,K)=>G+K.total,0),ot=Y.reduce((G,K)=>G+K.refunds,0),ct=at-ot,st=Y.reduce((G,K)=>G+K.paid,0),nt=Y.reduce((G,K)=>G+Math.max(0,K.rem),0),ht='<tr style="border-top:2px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.04);font-weight:700;"><td style="color:rgba(255,255,255,0.4);text-align:center;">Σ</td><td style="color:#fff;">المجموع ('+Y.length+')</td><td class="n" style="color:#8b5cf6;">'+N(X)+'</td><td class="n" style="color:#f43f5e;">'+N(et)+'</td><td class="n" style="color:#10b981;">'+N(at)+'</td><td class="n" style="color:#ef4444;">'+(ot>0?N(ot):"—")+'</td><td class="n" style="color:#3b82f6;">'+N(ct)+'</td><td class="n" style="color:#06b6d4;">'+N(st)+'</td><td class="n" style="color:#f59e0b;">'+N(nt)+'</td><td class="n" style="color:rgba(255,255,255,0.5);">100%</td></tr>';document.getElementById("sales-partner-tfoot").innerHTML=ht,F.innerHTML=Y.map((G,K)=>{const dt=G.total-G.refunds;return'<tr style="border-bottom:1px solid rgba(255,255,255,0.05);"><td style="font-family:var(--font-en);color:rgba(255,255,255,0.4);">'+(K+1)+'</td><td style="font-weight:700;color:var(--text-white);">'+G.name+'</td><td class="n" style="color:#8b5cf6;">'+N(G.untaxed)+'</td><td class="n" style="color:#f43f5e;">'+N(G.tax)+'</td><td class="n" style="color:#10b981;font-weight:700;">'+N(G.total)+'</td><td class="n" style="color:#ef4444;font-weight:bold;">'+(G.refunds>0?N(G.refunds):"—")+'</td><td class="n" style="color:#3b82f6;font-weight:700;">'+N(dt)+'</td><td class="n" style="color:#06b6d4;">'+N(G.paid)+'</td><td class="n" style="color:#f59e0b;">'+N(Math.max(0,G.rem))+'</td><td class="n" style="color:rgba(255,255,255,0.5);">'+(T>0?D(G.total/T*100):"0%")+"</td></tr>"}).join("")};J(""),tt(),H&&H.addEventListener("input",j=>{J(j.target.value)})})}catch(i){console.error("Sales overview error:",i),t.querySelector("#sales-content").innerHTML=`<div class="bi-empty" style="color:#ef4444;">❌ خطأ في عرض بيانات المبيعات: ${i.message}</div>`}}async function xe(t,s,l,r){const e=s._selectedYrs||[],a=s._selectedCos||[];t.innerHTML=`
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;flex-wrap:wrap;">
      <h2 style="margin:0;color:rgba(255,255,255,0.85);font-size:1.3rem;">🛒 تفاصيل جميع العملاء والمبيعات (هرمي)</h2>
    </div>
    <div id="sales-hier-content"><div class="bi-empty">⏳ جاري تحميل تفاصيل العملاء...</div></div>
  `;try{const i=document.getElementById("date-from")?document.getElementById("date-from").value:"",b=document.getElementById("date-to")?document.getElementById("date-to").value:"";let d=i,g=b;!d&&!g&&e.length>0&&(d=`${Math.min(...e)}-01-01`,g=`${Math.max(...e)}-12-31`);const p={};d&&(p.dateFrom=d),g&&(p.dateTo=g),a.length>0&&(p.masterCompanyIds=a.join(",")),r&&r.length>0&&(p.costCenters=r.join(","));const k=await it.sales.getCustomerHierarchy(p);if(!k||!k.hierarchy)throw new Error("فشل جلب أرقام الهيكل");const T=k.hierarchy;let u=0,h=0,v=0,m=0,f=0,n=0,c=0;const y=Object.keys(T);let w="";y.forEach((L,E)=>{const A=T[L];let x=0,_=0,B=0,O=0,M=0,I=0,P=0,F="";Object.keys(A).forEach((q,R)=>{const z=A[q];let S=0,N=0,tt=0,J=0,j=0,W=0,Y=0,X="";Object.keys(z).forEach((at,ot)=>{const ct=z[at];let st=0,nt=0,ht=0,G=0,K=0,dt=0,ft=0,Lt="";Object.keys(ct).forEach(At=>{const V=ct[At];st+=V.total,nt+=V.untaxed,ht+=V.tax,G+=V.refunds,dt+=V.paid,ft+=V.rem,V.net=V.total-V.refunds;const Ht=V.net,jt=V.net>0?V.paid/V.net*100:V.total>0?V.paid/V.total*100:0;Lt+=`
              <tr class="row-pt sales-row-pt-${E} sales-row-pt-${E}-${R} sales-row-pt-${E}-${R}-${ot}" style="display:none; transition: all 0.2s ease;">
                <td style="padding-right:70px; font-weight:400; font-size:0.95rem;">👤 ${At}</td>
                <td class="n">${o(V.untaxed)}</td>
                <td class="n">${o(V.tax)}</td>
                <td class="n" style="color:#ef4444">${o(V.refunds)}</td>
                <td class="n" style="font-weight:700">${o(V.total)}</td>
                <td class="n" style="color:#3b82f6;font-weight:700">${o(Ht)}</td>
                <td class="n" style="color:#10b981">${o(V.paid)}</td>
                <td class="n" style="color:#f59e0b">${o(V.rem)}</td>
                <td class="n">${D(jt)}</td>
              </tr>
            `}),K=st-G,S+=st,N+=nt,tt+=ht,J+=G,j+=K,W+=dt,Y+=ft;const Nt=K>0?dt/K*100:0;X+=`
            <tr class="row-cc sales-row-cc-${E} sales-row-cc-${E}-${R}" style="display:none;" onclick="
              this.classList.toggle('open'); 
              document.querySelectorAll('.sales-row-pt-${E}-${R}-${ot}').forEach(e => {
                e.style.display = e.style.display === 'none' ? 'table-row' : 'none';
              });
            ">
              <td style="padding-right:50px;font-weight:600;color:#67e8f9;">🏗️ ${at}</td>
              <td class="n">${o(nt)}</td>
              <td class="n">${o(ht)}</td>
              <td class="n" style="color:#ef4444">${o(G)}</td>
              <td class="n" style="font-weight:700">${o(st)}</td>
              <td class="n" style="color:#3b82f6">${o(K)}</td>
              <td class="n" style="color:#10b981">${o(dt)}</td>
              <td class="n" style="color:#f59e0b">${o(ft)}</td>
              <td class="n">${D(Nt)}</td>
            </tr>
          `,X+=Lt}),j=S-J,x+=S,_+=N,B+=tt,O+=J,M+=j,I+=W,P+=Y;const et=j>0?W/j*100:0;F+=`
          <tr class="row-cc sales-row-grp-${E}" style="display:none;" onclick="
            this.classList.toggle('open'); 
            document.querySelectorAll('.sales-row-cc-${E}-${R}').forEach(e => {
              e.style.display = e.style.display === 'none' ? 'table-row' : 'none';
              if(e.style.display === 'none') {
                e.classList.remove('open');
                const rowPts = document.querySelectorAll('.sales-row-pt-${E}-${R}');
                rowPts.forEach(p => p.style.display = 'none');
              }
            });
          ">
            <td style="padding-right:30px;font-weight:700;color:#fcd34d;">📂 ${q} (المجموعة)</td>
            <td class="n">${o(N)}</td>
            <td class="n">${o(tt)}</td>
            <td class="n" style="color:#ef4444">${o(J)}</td>
            <td class="n" style="font-weight:700">${o(S)}</td>
            <td class="n" style="color:#3b82f6">${o(j)}</td>
            <td class="n" style="color:#10b981">${o(W)}</td>
            <td class="n" style="color:#f59e0b">${o(Y)}</td>
            <td class="n">${D(et)}</td>
          </tr>
        `,F+=X}),M=x-O,u+=x,h+=_,v+=B,m+=O,f+=M,n+=I,c+=P;const H=M>0?I/M*100:0;w+=`
        <tr class="row-co" onclick="
          this.classList.toggle('open'); 
          document.querySelectorAll('.sales-row-grp-${E}').forEach(e => {
            e.style.display = e.style.display === 'none' ? 'table-row' : 'none';
            if(e.style.display === 'none') {
              e.classList.remove('open');
              document.querySelectorAll('.sales-row-cc-${E}').forEach(c => {
                c.style.display = 'none';
                c.classList.remove('open');
              });
              document.querySelectorAll('.sales-row-pt-${E}').forEach(p => p.style.display = 'none');
            }
          });
        ">
          <td style="font-weight:800;color:#c084fc;">🏢 ${L}</td>
          <td class="n" style="color:#c084fc">${o(_)}</td>
          <td class="n" style="color:#c084fc">${o(B)}</td>
          <td class="n" style="color:#ef4444">${o(O)}</td>
          <td class="n" style="font-weight:800;color:#c084fc">${o(x)}</td>
          <td class="n" style="color:#3b82f6;font-weight:800">${o(M)}</td>
          <td class="n" style="color:#10b981;font-weight:800">${o(I)}</td>
          <td class="n" style="color:#f59e0b;font-weight:800">${o(P)}</td>
          <td class="n" style="color:#c084fc">${D(H)}</td>
        </tr>
      `,w+=F});const C=f>0?n/f*100:0;document.getElementById("sales-hier-content").innerHTML=`
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
            ${o(f)} <span style="font-size: 1rem; color: #64748b; font-weight: 600; text-shadow: none;">ر.س</span>
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
            ${o(c)} <span style="font-size: 1rem; color: #64748b; font-weight: 600; text-shadow: none;">ر.س</span>
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
              <span style="font-family: var(--font-en); font-size: 1.1rem; background: rgba(6,182,212,0.15); padding: 4px 10px; border-radius: 8px; border: 1px solid rgba(6,182,212,0.3);">${D(C)}</span>
            </div>
            <div style="height: 8px; background: rgba(0,0,0,0.4); border-radius: 6px; overflow: hidden; box-shadow: inset 0 2px 4px rgba(0,0,0,0.2);">
              <div style="height: 100%; width: ${Math.min(C,100)}%; background: linear-gradient(90deg, #0284c7, #22d3ee, #67e8f9); border-radius: 6px; transition: width 1s ease-out; box-shadow: 0 0 10px rgba(34,211,238,0.5);"></div>
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
            <tbody>${w}</tbody>
            <tfoot style="background:rgba(15,23,42,0.95);position:sticky;bottom:-1px;z-index:20;box-shadow:0 -4px 10px rgba(0,0,0,0.3);">
              <tr>
                <td style="color:#e2e8f0;font-size:1.15rem;">📊 إجمالي محفظة المبيعات</td>
                <td class="n" style="color:#e2e8f0">${o(h)}</td>
                <td class="n" style="color:#e2e8f0">${o(v)}</td>
                <td class="n" style="color:#ef4444">${o(m)}</td>
                <td class="n" style="color:#c4b5fd">${o(u)}</td>
                <td class="n" style="color:#3b82f6">${o(f)}</td>
                <td class="n" style="color:#10b981">${o(n)}</td>
                <td class="n" style="color:#f59e0b">${o(c)}</td>
                <td class="n" style="color:#e2e8f0">${D(C)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    `}catch(i){console.error("Hier error:",i),document.getElementById("sales-hier-content").innerHTML=`<div class="bi-empty" style="color:#ef4444">❌ خطأ: ${i.message}</div>`}}async function $e(t,s,l,r){var e,a;t.innerHTML='<div class="bi-empty">⏳ جاري حساب الضريبة...</div>';try{const i=s._selectedCos||[],b={limit:5e4};i.length>0&&(b.masterCompanyIds=i.join(","));const d=(e=document.querySelector("#date-from"))==null?void 0:e.value,g=(a=document.querySelector("#date-to"))==null?void 0:a.value;d&&(b.dateFrom=d),g&&(b.dateTo=g),r&&r.length>0&&(b.costCenters=r.join(","));const p=await it.sales.getInvoices(b);if(!p||!p.items){t.innerHTML='<div class="bi-empty">لا توجد سيولة بيانات مبيعات لعرض الضريبة</div>';return}let k=0,T=0,u=0,h=0;const v={};p.items.forEach(n=>{if(n.state==="draft")return;const c=parseFloat(n.amount_total)||0;let y=0,w="";try{const _=n.raw_data?JSON.parse(n.raw_data):{};y=parseFloat(_.amount_untaxed)||0,w=_.move_type||""}catch{}const C=w==="Customer Credit Note"||w==="out_refund"||c<0,L=Math.abs(c),E=Math.abs(y),A=L-E,x=n.company_name&&n.company_name.trim()!==""?n.company_name:"أخرى";v[x]||(v[x]={salesGross:0,salesTax:0,refundGross:0,refundTax:0}),C?(u+=L,h+=A,v[x].refundGross+=L,v[x].refundTax+=A):(k+=L,T+=A,v[x].salesGross+=L,v[x].salesTax+=A)});const m=T-h;let f=`
      <style>
        .vat-grid { display: grid; grid-template-columns: repeat(10, 1fr); gap: 16px; margin-bottom: 24px; }
        .vat-card { background: rgba(255,255,255,0.02); border-radius: 16px; padding: 20px; display: flex; flex-direction: column; justify-content: center; border: 1px solid rgba(255,255,255,0.05); }
        .vat-lbl { font-size: 0.95rem; color: rgba(255,255,255,0.6); margin-bottom: 8px; font-weight: 600; }
        .vat-val { font-size: 1.6rem; font-weight: 800; font-family: var(--font-en); }
        .vc-2 { grid-column: span 2; }
      </style>
      
      <div class="page-title" style="margin-bottom:var(--space-xl);font-size:1.4rem;">🧾 تحليل ضريبة القيمة المضافة (المخرجات)</div>
      
      <div class="vat-grid">
        <div class="vat-card vc-2" style="border-right: 4px solid var(--accent-blue);">
          <div class="vat-lbl">إجمالي المبيعات (شامل الضريبة)</div>
          <div class="vat-val" style="color:var(--accent-blue);">${lt(k)}</div>
        </div>
        <div class="vat-card vc-2" style="border-right: 4px solid var(--accent-purple);">
          <div class="vat-lbl">ضريبة المبيعات</div>
          <div class="vat-val" style="color:var(--accent-purple);">${lt(T)}</div>
        </div>
        <div class="vat-card vc-2" style="border-right: 4px solid var(--accent-amber);">
          <div class="vat-lbl">إجمالي المرتجعات</div>
          <div class="vat-val" style="color:var(--accent-amber);">${lt(u)}</div>
        </div>
        <div class="vat-card vc-2" style="border-right: 4px solid #f87171;">
          <div class="vat-lbl">ضريبة المرتجعات</div>
          <div class="vat-val" style="color:#f87171;">${lt(h)}</div>
        </div>
        <div class="vat-card vc-2" style="border-right: 4px solid var(--accent-emerald); background:rgba(16,185,129,0.05);">
          <div class="vat-lbl">صافي الضريبة المحصلة (المستحقة)</div>
          <div class="vat-val" style="color:var(--accent-emerald);">${lt(m)}</div>
        </div>
      </div>
      
      <div class="card" style="margin-top:var(--space-xl);">
        <h3 style="margin-bottom:var(--space-md);color:var(--text-white);">📊 توزيع الضريبة حسب الشركات</h3>
        <div class="data-table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>الشركة</th>
                <th style="text-align:left;">إجمالي المبيعات</th>
                <th style="text-align:left;color:var(--accent-purple);">ضريبة المبيعات</th>
                <th style="text-align:left;">المرتجعات</th>
                <th style="text-align:left;color:#f87171;">ضريبة المرتجعات</th>
                <th style="text-align:left;color:var(--accent-emerald);">صافي الضريبة المستحقة</th>
              </tr>
            </thead>
            <tbody>
              ${Object.keys(v).sort((n,c)=>v[c].salesTax-v[c].refundTax-(v[n].salesTax-v[n].refundTax)).map(n=>{const c=v[n],y=c.salesTax-c.refundTax;return`
                  <tr>
                    <td><strong>${n}</strong></td>
                    <td style="text-align:left;font-family:var(--font-en);">${lt(c.salesGross)}</td>
                    <td style="text-align:left;font-family:var(--font-en);color:var(--accent-purple);font-weight:bold;">${lt(c.salesTax)}</td>
                    <td style="text-align:left;font-family:var(--font-en);">${lt(c.refundGross)}</td>
                    <td style="text-align:left;font-family:var(--font-en);color:#f87171;">${lt(c.refundTax)}</td>
                    <td style="text-align:left;font-family:var(--font-en);color:var(--accent-emerald);font-weight:bold;font-size:1.1em;">${lt(y)}</td>
                  </tr>
                `}).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `;t.innerHTML=f}catch(i){console.error("Error in renderVAT:",i),t.innerHTML='<div class="bi-empty" style="color:red;">❌ حدث خطأ أثناء حساب الضريبة</div>'}}export{we as _,vt as a,it as b,Ee as c,Se as d,lt as f,ke as g,Te as r,Et as s};
