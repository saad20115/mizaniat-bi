// ===== TAB: REDISTRIBUTION =====
function renderRedistribution(body, d) {
  const gt = d.grandTotals;
  let redistCCCount = 0;
  for (const cid of Object.keys(redistByCompany)) redistCCCount += redistByCompany[cid].size;

  if (redistCCCount === 0) {
    body.innerHTML = '<div class="bi-empty">\u0644\u0627 \u062a\u0648\u062c\u062f \u0645\u0631\u0627\u0643\u0632 \u062a\u0643\u0644\u0641\u0629 \u0645\u062d\u062f\u062f\u0629 \u0644\u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u062a\u0648\u0632\u064a\u0639.<br><span style="font-size:0.9rem;color:rgba(255,255,255,0.3);">\u062d\u062f\u062f \u0627\u0644\u0645\u0631\u0627\u0643\u0632 \u0627\u0644\u0625\u062f\u0627\u0631\u064a\u0629 \u0645\u0646 \u0635\u0641\u062d\u0629 \u0627\u0644\u062d\u0633\u0627\u0628\u0627\u062a \u0627\u0644\u062a\u062d\u0644\u064a\u0644\u064a\u0629</span></div>';
    return;
  }

  body.innerHTML = `
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
    <div class="bi-kpi-row" style="grid-template-columns:repeat(4,1fr);">
      <div class="bi-kpi"><div class="bi-kpi-label">\u{1F4B0} \u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a</div><div class="bi-kpi-value" style="color:#10b981;">${fmt(gt.revenue)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">\u{1F4E4} \u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062a</div><div class="bi-kpi-value" style="color:#ef4444;">${fmt(gt.expenses)}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">\u{1F504} \u0645\u0631\u0627\u0643\u0632 \u0642\u0627\u0628\u0644\u0629 \u0644\u0644\u062a\u0648\u0632\u064a\u0639</div><div class="bi-kpi-value" style="color:#f59e0b;">${redistCCCount}</div></div>
      <div class="bi-kpi"><div class="bi-kpi-label">\u{1F4C8} \u0635\u0627\u0641\u064a \u0627\u0644\u0631\u0628\u062d</div><div class="bi-kpi-value" style="color:${gt.netIncome>=0?'#10b981':'#ef4444'};">${fmt(gt.netIncome)}</div><div class="bi-kpi-sub">\u0647\u0627\u0645\u0634 ${fmtP(gt.profitMargin)}</div></div>
    </div>
    <div class="bi-card bi-full">
      <div class="bi-card-title">\u{1F504} \u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u062a\u0648\u0632\u064a\u0639 \u062d\u0633\u0628 \u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a <span style="font-size:0.85rem;color:rgba(255,255,255,0.35);margin-right:8px;">\u0646\u0633\u0628\u0629 \u0648\u062a\u0646\u0627\u0633\u0628</span></div>
      <div style="overflow-x:auto;"><table class="bi-table" id="tbl-redist-rev" style="font-size:1rem;"></table></div>
    </div>
    <div class="bi-card bi-full">
      <div class="bi-card-title">\u{1F504} \u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u062a\u0648\u0632\u064a\u0639 \u062d\u0633\u0628 \u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062a <span style="font-size:0.85rem;color:rgba(255,255,255,0.35);margin-right:8px;">\u0646\u0633\u0628\u0629 \u0648\u062a\u0646\u0627\u0633\u0628</span></div>
      <div style="overflow-x:auto;"><table class="bi-table" id="tbl-redist-exp" style="font-size:1rem;"></table></div>
    </div>`;
  requestAnimationFrame(() => {
    fillRedistTable(document.getElementById('tbl-redist-rev'), d, 'revenue');
    fillRedistTable(document.getElementById('tbl-redist-exp'), d, 'expense');
  });
}

function bindRedistToggle(tbl) {
  tbl.querySelectorAll('.row-co').forEach(row => {
    row.addEventListener('click', () => {
      const gid = row.dataset.gid, open = row.classList.toggle('open');
      const ch = tbl.querySelectorAll(`.row-cc[data-pgid="${gid}"]`);
      ch.forEach(r => r.classList.toggle('show', open));
      if (!open) ch.forEach(cc => { cc.classList.remove('open'); tbl.querySelectorAll(`.row-sub[data-pgid="${cc.dataset.gid}"]`).forEach(s => { s.classList.remove('show','open'); tbl.querySelectorAll(`.row-acct[data-pgid="${s.dataset.gid}"]`).forEach(a => a.classList.remove('show')); }); tbl.querySelectorAll(`.row-pt[data-pgid="${cc.dataset.gid}"]`).forEach(p => p.classList.remove('show')); });
    });
  });
  tbl.querySelectorAll('.row-cc').forEach(row => {
    row.addEventListener('click', (e) => {
      e.stopPropagation(); const gid = row.dataset.gid, open = row.classList.toggle('open');
      tbl.querySelectorAll(`.row-sub[data-pgid="${gid}"]`).forEach(r => r.classList.toggle('show', open));
      tbl.querySelectorAll(`.row-pt[data-pgid="${gid}"]`).forEach(r => r.classList.toggle('show', open));
      if (!open) { tbl.querySelectorAll(`.row-sub[data-pgid="${gid}"]`).forEach(s => { s.classList.remove('open'); tbl.querySelectorAll(`.row-acct[data-pgid="${s.dataset.gid}"]`).forEach(a => a.classList.remove('show')); }); }
    });
  });
  tbl.querySelectorAll('.row-sub').forEach(row => {
    row.addEventListener('click', (e) => {
      e.stopPropagation(); const gid = row.dataset.gid, open = row.classList.toggle('open');
      tbl.querySelectorAll(`.row-acct[data-pgid="${gid}"]`).forEach(r => r.classList.toggle('show', open));
    });
  });
}

function fillRedistTable(tbl, d, method) {
  if (!tbl) return;
  const yrs = d.years, yd = d.yearlyData, multiYear = yrs.length > 1;

  function numCells(rev, origExp, alloc, totalExp, collected, net, margin, bold) {
    const w = bold ? 'font-weight:800;' : '';
    return `<td class="n" style="color:#10b981;${w}">${fmt(rev)}</td>`
      + `<td class="n" style="color:#ef4444;${w}">${fmt(origExp)}</td>`
      + `<td class="n" style="color:#f59e0b;${w}">${alloc > 0 ? fmt(alloc) : '<span style="color:rgba(255,255,255,0.15);">-</span>'}</td>`
      + `<td class="n" style="color:#ef4444;${w}">${fmt(totalExp)}</td>`
      + `<td class="n" style="color:#06b6d4;${w}">${fmt(collected)}</td>`
      + `<td class="n" style="color:${net>=0?'#10b981':'#ef4444'};${w}">${fmt(net)}</td>`
      + `<td class="n" style="color:${margin>=0?'#10b981':'#ef4444'};${w}">${fmtP(margin)}</td>`;
  }

  let bdy = '', gi = 0, gri = 0, ci = 0;
  let gRev=0, gOrig=0, gAlloc=0, gTotal=0, gColl=0, gNet=0, gAdmin=0;

  function processCoYear(co, redistSet) {
    let adminExp = 0; const adminCCs = [], targetCCs = [];
    (co.costCenters || []).forEach(cc => {
      if (redistSet.has(cc.name.trim())) { adminExp += cc.expenses || 0; adminCCs.push(cc); }
      else targetCCs.push(cc);
    });
    const accTree = {};
    (co.accountTree || []).forEach(at => { if (!redistSet.has(at.name.trim())) accTree[at.name] = at.accounts || []; });
    let totalBase = 0;
    if (method === 'revenue') targetCCs.forEach(cc => { totalBase += cc.revenue || 0; });
    else targetCCs.forEach(cc => { totalBase += cc.expenses || 0; });
    let allocSum = 0;
    const allocs = targetCCs.map(cc => {
      const base = method === 'revenue' ? (cc.revenue||0) : (cc.expenses||0);
      const ratio = totalBase > 0 ? base / totalBase : (targetCCs.length > 0 ? 1/targetCCs.length : 0);
      const a = adminExp > 0 ? Math.round(adminExp * ratio) : 0;
      allocSum += a; return { cc, a };
    });
    if (adminExp > 0 && allocs.length > 0) {
      const rem = adminExp - allocSum;
      if (rem !== 0) { let mi=0,mb=0; allocs.forEach((x,i) => { const b = method==='revenue'?(x.cc.revenue||0):(x.cc.expenses||0); if(b>mb){mb=b;mi=i;} }); allocs[mi].a += rem; }
    }
    let tR=0,tO=0,tA=0,tT=0,tC=0;
    allocs.forEach(({cc,a}) => { tR+=cc.revenue||0; tO+=cc.expenses||0; tA+=a; tT+=(cc.expenses||0)+a; tC+=cc.collected||0; });
    return { allocs, adminCCs, adminExp, accTree, totals: { rev:tR, orig:tO, alloc:tA, total:tT, coll:tC, net:tR-tT, margin:tR>0?((tR-tT)/tR*100):0 } };
  }

  function renderCCsUnder(parentGid, result, grpClass, ccClass, acctClass) {
    const { allocs, adminCCs, accTree } = result;
    let html = '';
    const grpMap = new Map(), ungrouped = [];
    allocs.forEach(item => {
      const gId = analyticGroupMappings[item.cc.name.trim()];
      const grp = gId ? analyticGroups.find(g => String(g.id)===String(gId)) : null;
      if (grp) { let e = grpMap.get(grp.id); if(!e){e={name:grp.name,color:grp.color||'#f59e0b',items:[]};grpMap.set(grp.id,e);} e.items.push(item); }
      else ungrouped.push(item);
    });
    grpMap.forEach(grp => {
      const gg = 'rgrp'+gri++;
      let gR=0,gO=0,gA=0,gT=0,gC2=0;
      grp.items.forEach(({cc,a})=>{gR+=cc.revenue||0;gO+=cc.expenses||0;gA+=a;gT+=(cc.expenses||0)+a;gC2+=cc.collected||0;});
      const gN=gR-gT, gM2=gR>0?(gN/gR*100):0;
      html+=`<tr class="${grpClass}" data-gid="${gg}" data-pgid="${parentGid}"><td style="font-weight:700;color:${grp.color};">${grp.name}</td>${numCells(gR,gO,gA,gT,gC2,gN,gM2,true)}</tr>`;
      grp.items.forEach(({cc,a}) => {
        const cg='rcc'+ci++, tE=(cc.expenses||0)+a, n=(cc.revenue||0)-tE, m=cc.revenue>0?(n/cc.revenue*100):0;
        html+=`<tr class="${ccClass}" data-gid="${cg}" data-pgid="${gg}"><td>${cc.name.length>28?cc.name.substring(0,28)+'\u2026':cc.name}</td>${numCells(cc.revenue||0,cc.expenses||0,a,tE,cc.collected||0,n,m)}</tr>`;
        (accTree[cc.name]||[]).forEach(ac => {
          const isI=ac.type==='income';
          html+=`<tr class="${acctClass}" data-pgid="${cg}"><td style="color:${isI?'#10b981':'#ef4444'};">${ac.code} ${ac.name.length>20?ac.name.substring(0,20)+'\u2026':ac.name}</td><td class="n" style="color:#10b981;">${isI?fmt(ac.amount):''}</td><td class="n" style="color:#ef4444;">${!isI?fmt(ac.amount):''}</td><td class="n" style="color:rgba(255,255,255,0.15);">-</td><td class="n" style="color:rgba(255,255,255,0.15);">-</td><td class="n" style="color:rgba(255,255,255,0.15);">-</td><td class="n" style="color:rgba(255,255,255,0.3);">${isI?'\u0625\u064a\u0631\u0627\u062f':'\u0645\u0635\u0631\u0648\u0641'}</td><td class="n">${fmt(Math.abs(ac.amount))}</td></tr>`;
        });
      });
    });
    ungrouped.forEach(({cc,a}) => {
      const cg='rcc'+ci++, tE=(cc.expenses||0)+a, n=(cc.revenue||0)-tE, m=cc.revenue>0?(n/cc.revenue*100):0;
      html+=`<tr class="${grpClass}" data-gid="${cg}" data-pgid="${parentGid}"><td style="font-weight:600;color:#8b5cf6;">${cc.name.length>28?cc.name.substring(0,28)+'\u2026':cc.name}</td>${numCells(cc.revenue||0,cc.expenses||0,a,tE,cc.collected||0,n,m)}</tr>`;
      (accTree[cc.name]||[]).forEach(ac => {
        const isI=ac.type==='income';
        html+=`<tr class="${acctClass}" data-pgid="${cg}"><td style="color:${isI?'#10b981':'#ef4444'};">${ac.code} ${ac.name.length>20?ac.name.substring(0,20)+'\u2026':ac.name}</td><td class="n" style="color:#10b981;">${isI?fmt(ac.amount):''}</td><td class="n" style="color:#ef4444;">${!isI?fmt(ac.amount):''}</td><td class="n" style="color:rgba(255,255,255,0.15);">-</td><td class="n" style="color:rgba(255,255,255,0.15);">-</td><td class="n" style="color:rgba(255,255,255,0.15);">-</td><td class="n" style="color:rgba(255,255,255,0.3);">${isI?'\u0625\u064a\u0631\u0627\u062f':'\u0645\u0635\u0631\u0648\u0641'}</td><td class="n">${fmt(Math.abs(ac.amount))}</td></tr>`;
      });
    });
    if (adminCCs.length > 0) {
      const names = adminCCs.map(c => c.name.length>12?c.name.substring(0,12)+'\u2026':c.name).join(' + ');
      const aExp = adminCCs.reduce((s,c) => s+(c.expenses||0), 0);
      html+=`<tr class="${grpClass}" data-pgid="${parentGid}" style="background:rgba(245,158,11,0.04);"><td style="color:#f59e0b;font-weight:700;">\u{1F504} \u0645\u0648\u0632\u0639: ${names}</td><td class="n" style="color:rgba(255,255,255,0.2);">-</td><td class="n" style="color:#f59e0b;font-weight:700;">${fmt(aExp)}</td><td class="n" style="color:#f59e0b;">\u2190 ${fmt(aExp)}</td>${'<td class="n" style="color:rgba(255,255,255,0.2);">-</td>'.repeat(4)}</tr>`;
    }
    return html;
  }

  if (!multiYear) {
    for (const yr of yrs) {
      for (const co of (yd[yr]?.companies || [])) {
        const cid = String(co.companyId), redistSet = redistByCompany[cid] || new Set();
        const coGid = 'rco' + gi++;
        const result = processCoYear(co, redistSet);
        const t = result.totals;
        gRev+=t.rev; gOrig+=t.orig; gAlloc+=t.alloc; gTotal+=t.total; gColl+=t.coll; gNet+=t.net; gAdmin+=result.adminExp;
        bdy += `<tr class="row-co" data-gid="${coGid}"><td style="color:${COLORS[gi%COLORS.length]};font-weight:800;">${co.companyName}</td>${numCells(t.rev,t.orig,t.alloc,t.total,t.coll,t.net,t.margin,true)}</tr>`;
        bdy += renderCCsUnder(coGid, result, 'row-cc', 'row-sub', 'row-acct');
      }
    }
  } else {
    const companyOrder = new Map();
    let colorIdx = 0;
    for (const yr of yrs) {
      for (const co of (yd[yr]?.companies || [])) {
        const cid = String(co.companyId), redistSet = redistByCompany[cid] || new Set();
        const result = processCoYear(co, redistSet);
        let entry = companyOrder.get(cid);
        if (!entry) { entry = { name: co.companyName, color: COLORS[colorIdx++ % COLORS.length], yearData: [] }; companyOrder.set(cid, entry); }
        entry.yearData.push({ yr, result });
      }
    }
    companyOrder.forEach((entry) => {
      const coGid = 'rco' + gi++;
      let cR=0,cO=0,cA=0,cT=0,cC=0;
      entry.yearData.forEach(({result}) => { const t=result.totals; cR+=t.rev; cO+=t.orig; cA+=t.alloc; cT+=t.total; cC+=t.coll; });
      const cN=cR-cT, cM=cR>0?(cN/cR*100):0;
      gRev+=cR; gOrig+=cO; gAlloc+=cA; gTotal+=cT; gColl+=cC; gNet+=cN;
      entry.yearData.forEach(({result}) => { gAdmin+=result.adminExp; });
      bdy += `<tr class="row-co" data-gid="${coGid}"><td style="color:${entry.color};font-weight:800;">${entry.name}</td>${numCells(cR,cO,cA,cT,cC,cN,cM,true)}</tr>`;
      entry.yearData.forEach(({yr, result}) => {
        const yrGid = 'ryr' + gi++;
        const t = result.totals;
        bdy += `<tr class="row-cc" data-gid="${yrGid}" data-pgid="${coGid}"><td style="font-family:var(--font-en);font-weight:700;color:rgba(255,255,255,0.7);">\u{1F4C5} ${yr}</td>${numCells(t.rev,t.orig,t.alloc,t.total,t.coll,t.net,t.margin,true)}</tr>`;
        bdy += renderCCsUnder(yrGid, result, 'row-sub', 'row-sub', 'row-acct');
      });
    });
  }

  const gM = gRev>0?(gNet/gRev*100):0;
  const ftr = `<td style="font-weight:800;">\u0627\u0644\u0645\u062c\u0645\u0648\u0639</td>${numCells(gRev,gOrig,gAlloc,gTotal,gColl,gNet,gM,true)}`;
  tbl.innerHTML = `<thead><tr><th>\u0627\u0644\u0634\u0631\u0643\u0629 / \u0627\u0644\u0645\u062c\u0645\u0648\u0639\u0629 / \u0627\u0644\u0645\u0631\u0643\u0632 / \u062d\u0633\u0627\u0628</th><th class="n sortable" data-col-idx="1">\u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a</th><th class="n sortable" data-col-idx="2">\u0645\u0635\u0631\u0648\u0641\u0627\u062a \u0623\u0635\u0644\u064a\u0629</th><th class="n sortable" data-col-idx="3" style="color:#f59e0b;">\u0627\u0644\u0645\u064f\u062d\u0645\u0651\u0644</th><th class="n sortable" data-col-idx="4" style="color:#ef4444;">\u0625\u062c\u0645\u0627\u0644\u064a \u0645\u0635\u0631\u0648\u0641\u0627\u062a</th><th class="n sortable" data-col-idx="5" style="color:#06b6d4;">\u0627\u0644\u0645\u062d\u0635\u0651\u0644</th><th class="n sortable" data-col-idx="6">\u0635\u0627\u0641\u064a \u0627\u0644\u0631\u0628\u062d</th><th class="n sortable" data-col-idx="7">% \u0631\u0628\u062d</th></tr></thead><tbody>${bdy}</tbody><tfoot><tr>${ftr}</tr></tfoot>`;
  bindRedistToggle(tbl);
  bindSortableHeaders(tbl);
}
