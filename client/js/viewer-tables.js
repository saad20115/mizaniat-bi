// Table filling functions for viewer (exact copies from presentation.js)

function fillCollectionTable(tbl, d) {
  if (!tbl) return;
  const yrs = d.years, yd = d.yearlyData, gt = d.grandTotals, mY = yrs.length > 1;
  let rows = '', cIdx = 0, ccIdx = 0;
  yrs.forEach(yr => { (yd[yr]?.companies || []).forEach((c, i) => { const k = c.kpis;
    const coGid = 'cg' + cIdx++;
    rows += `<tr class="row-co" data-gid="${coGid}"><td style="color:${COLORS[i % COLORS.length]};font-weight:700;">${c.companyName}</td>${mY?`<td style="font-family:var(--font-en);color:rgba(255,255,255,0.5);">${yr}</td>`:''}<td class="n" style="color:#10b981;">${fmt(k.revenue)}</td><td class="n" style="color:#06b6d4;">${fmt(k.collected||0)}</td><td class="n" style="color:#f59e0b;">${fmt(k.remaining||0)}</td><td class="n" style="color:${(k.collectionRate||0)>=70?'#10b981':'#f59e0b'};">${fmtP(k.collectionRate||0)}</td><td class="n" style="color:#ef4444;">${fmt(k.expenses)}</td><td class="n" style="color:${(k.profitMargin||0)>=0?'#10b981':'#ef4444'};">${fmtP(k.profitMargin||0)}</td></tr>`;
    (c.costCenters || []).forEach(cc => {
      const ccGid = 'cc' + ccIdx++;
      rows += `<tr class="row-cc" data-gid="${ccGid}" data-pgid="${coGid}"><td>${cc.name.length>28?cc.name.substring(0,28)+'\u2026':cc.name}</td>${mY?'<td></td>':''}<td class="n">${fmt(cc.revenue)}</td><td class="n">${fmt(cc.collected||0)}</td><td class="n">${fmt(cc.remaining||0)}</td><td class="n" style="color:${(cc.collectionRate||0)>=70?'#10b981':'#f59e0b'};">${fmtP(cc.collectionRate||0)}</td><td class="n">${fmt(cc.expenses)}</td><td class="n" style="color:${(cc.profitMargin||0)>=0?'#10b981':'#ef4444'};">${fmtP(cc.profitMargin||0)}</td></tr>`;
      (cc.partners || []).forEach(p => {
        rows += `<tr class="row-pt" data-pgid="${ccGid}"><td>${p.name.length>26?p.name.substring(0,26)+'\u2026':p.name}</td>${mY?'<td></td>':''}<td class="n">${fmt(p.revenue)}</td><td class="n">${fmt(p.collected)}</td><td class="n">${fmt(p.remaining)}</td><td class="n" style="color:${(p.collectionRate||0)>=70?'#10b981':'#f59e0b'};">${fmtP(p.collectionRate)}</td><td class="n">${fmt(p.expenses)}</td><td class="n" style="color:${p.netIncome>=0?'#10b981':'#ef4444'};">${fmtP(p.profitMargin)}</td></tr>`;
      });
    });
  }); });
  let tRev=0, tExp=0, tColl=0, tRem=0;
  yrs.forEach(yr => { (yd[yr]?.companies || []).forEach(c => { (c.costCenters || []).forEach(cc => { tRev += cc.revenue||0; tExp += cc.expenses||0; tColl += cc.collected||0; tRem += cc.remaining||0; }); }); });
  const tCollRate = tRev > 0 ? (tColl/tRev*100) : 0, tNet = tRev - tExp, tPM = tRev > 0 ? (tNet/tRev*100) : 0;
  const colOff = mY ? 1 : 0;
  tbl.innerHTML = `<thead><tr><th>الشركة / مركز / شريك</th>${mY?'<th>السنة</th>':''}<th class="n sortable" data-col-idx="${1+colOff}">الإيرادات</th><th class="n sortable" data-col-idx="${2+colOff}">المحصّل</th><th class="n sortable" data-col-idx="${3+colOff}">المتبقي</th><th class="n sortable" data-col-idx="${4+colOff}">% تحصيل</th><th class="n sortable" data-col-idx="${5+colOff}">المصروفات</th><th class="n sortable" data-col-idx="${6+colOff}">% ربح</th></tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr><td>المجموع</td>${mY?'<td></td>':''}<td class="n" style="color:#10b981;">${fmt(tRev)}</td><td class="n" style="color:#06b6d4;">${fmt(tColl)}</td><td class="n" style="color:#f59e0b;">${fmt(tRem)}</td><td class="n" style="color:${tCollRate>=70?'#10b981':'#f59e0b'};">${fmtP(tCollRate)}</td><td class="n" style="color:#ef4444;">${fmt(tExp)}</td><td class="n" style="color:${tPM>=0?'#10b981':'#ef4444'};">${fmtP(tPM)}</td></tr></tfoot>`;
  bindToggle(tbl); bindSortableHeaders(tbl);
}

function fillComparisonTable(tbl, d) {
  if (!tbl) return;
  const yrs = d.years, yd = d.yearlyData, mY = yrs.length > 1;
  let rows = '', cIdx = 0, ccIdx = 0;
  yrs.forEach(yr => { (yd[yr]?.companies || []).forEach((c, i) => { const k = c.kpis;
    const coGid = 'mg' + cIdx++;
    rows += `<tr class="row-co" data-gid="${coGid}"><td style="color:${COLORS[i % COLORS.length]};font-weight:700;">${c.companyName}</td>${mY?`<td style="font-family:var(--font-en);color:rgba(255,255,255,0.5);">${yr}</td>`:''}<td class="n" style="color:#10b981;">${fmt(k.revenue)}</td><td class="n" style="color:#ef4444;">${fmt(k.expenses)}</td><td class="n" style="color:#ef4444;">${fmtP(k.expenseRatio||0)}</td><td class="n" style="color:#06b6d4;">${fmt(k.collected||0)}</td><td class="n" style="color:#f59e0b;">${fmt(k.remaining||0)}</td><td class="n" style="color:${(k.collectionRate||0)>=70?'#10b981':'#f59e0b'};">${fmtP(k.collectionRate||0)}</td><td class="n" style="color:${k.netIncome>=0?'#10b981':'#ef4444'};">${fmt(k.netIncome)}</td><td class="n" style="color:${k.profitMargin>=0?'#10b981':'#ef4444'};">${fmtP(k.profitMargin)}</td></tr>`;
    (c.costCenters || []).forEach(cc => {
      const ccGid = 'mc' + ccIdx++; const ep = cc.revenue > 0 ? (cc.expenses/cc.revenue*100) : 0;
      rows += `<tr class="row-cc" data-gid="${ccGid}" data-pgid="${coGid}"><td>${cc.name.length>26?cc.name.substring(0,26)+'\u2026':cc.name}</td>${mY?'<td></td>':''}<td class="n">${fmt(cc.revenue)}</td><td class="n">${fmt(cc.expenses)}</td><td class="n">${fmtP(ep)}</td><td class="n">${fmt(cc.collected||0)}</td><td class="n">${fmt(cc.remaining||0)}</td><td class="n" style="color:${(cc.collectionRate||0)>=70?'#10b981':'#f59e0b'};">${fmtP(cc.collectionRate||0)}</td><td class="n" style="color:${cc.netIncome>=0?'#10b981':'#ef4444'};">${fmt(cc.netIncome)}</td><td class="n" style="color:${(cc.profitMargin||0)>=0?'#10b981':'#ef4444'};">${fmtP(cc.profitMargin||0)}</td></tr>`;
      (cc.partners || []).forEach(p => {
        const pep = p.revenue > 0 ? (p.expenses/p.revenue*100) : 0;
        rows += `<tr class="row-pt" data-pgid="${ccGid}"><td>${p.name.length>24?p.name.substring(0,24)+'\u2026':p.name}</td>${mY?'<td></td>':''}<td class="n">${fmt(p.revenue)}</td><td class="n">${fmt(p.expenses)}</td><td class="n">${fmtP(pep)}</td><td class="n">${fmt(p.collected)}</td><td class="n">${fmt(p.remaining)}</td><td class="n" style="color:${(p.collectionRate||0)>=70?'#10b981':'#f59e0b'};">${fmtP(p.collectionRate)}</td><td class="n" style="color:${p.netIncome>=0?'#10b981':'#ef4444'};">${fmt(p.netIncome)}</td><td class="n" style="color:${p.profitMargin>=0?'#10b981':'#ef4444'};">${fmtP(p.profitMargin)}</td></tr>`;
      });
    });
  }); });
  let tRev=0, tExp=0, tColl=0, tRem=0;
  yrs.forEach(yr => { (yd[yr]?.companies || []).forEach(c => { (c.costCenters || []).forEach(cc => { tRev += cc.revenue||0; tExp += cc.expenses||0; tColl += cc.collected||0; tRem += cc.remaining||0; }); }); });
  const tCollRate = tRev > 0 ? (tColl/tRev*100) : 0, tExpRate = tRev > 0 ? (tExp/tRev*100) : 0, tNet = tRev - tExp, tPM = tRev > 0 ? (tNet/tRev*100) : 0;
  const cmpOff = mY ? 1 : 0;
  tbl.innerHTML = `<thead><tr><th>الشركة / مركز / شريك</th>${mY?'<th>السنة</th>':''}<th class="n sortable" data-col-idx="${1+cmpOff}">الإيرادات</th><th class="n sortable" data-col-idx="${2+cmpOff}">المصروفات</th><th class="n sortable" data-col-idx="${3+cmpOff}">% مصروفات</th><th class="n sortable" data-col-idx="${4+cmpOff}">المحصّل</th><th class="n sortable" data-col-idx="${5+cmpOff}">المتبقي</th><th class="n sortable" data-col-idx="${6+cmpOff}">% تحصيل</th><th class="n sortable" data-col-idx="${7+cmpOff}">صافي الربح</th><th class="n sortable" data-col-idx="${8+cmpOff}">% ربح</th></tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr><td>المجموع</td>${mY?'<td></td>':''}<td class="n" style="color:#10b981;">${fmt(tRev)}</td><td class="n" style="color:#ef4444;">${fmt(tExp)}</td><td class="n" style="color:#ef4444;">${fmtP(tExpRate)}</td><td class="n" style="color:#06b6d4;">${fmt(tColl)}</td><td class="n" style="color:#f59e0b;">${fmt(tRem)}</td><td class="n" style="color:${tCollRate>=70?'#10b981':'#f59e0b'};">${fmtP(tCollRate)}</td><td class="n" style="color:${tNet>=0?'#10b981':'#ef4444'};">${fmt(tNet)}</td><td class="n" style="color:${tPM>=0?'#10b981':'#ef4444'};">${fmtP(tPM)}</td></tr></tfoot>`;
  bindToggle(tbl); bindSortableHeaders(tbl);
}

function fillYoYTable(tbl, d) {
  if (!tbl) return;
  const yrs = d.years, yd = d.yearlyData;
  tbl.innerHTML = `<thead><tr><th>السنة</th><th class="n sortable" data-col-idx="1">الإيرادات</th><th class="n sortable" data-col-idx="2">المصروفات</th><th class="n sortable" data-col-idx="3">صافي الربح</th><th class="n sortable" data-col-idx="4">% ربح</th><th class="n sortable" data-col-idx="5">المحصّل</th><th class="n sortable" data-col-idx="6">المتبقي</th><th class="n sortable" data-col-idx="7">% تحصيل</th><th class="n sortable" data-col-idx="8">الأصول</th><th class="n sortable" data-col-idx="9">الالتزامات</th></tr></thead>
  <tbody>${yrs.map((yr,i) => { const t = yd[yr].totals; const co = t.collected||0; const cp = t.collectionRate||0; return `<tr>
  <td style="color:${YR_COLORS[i%YR_COLORS.length]};font-family:var(--font-en);font-weight:800;font-size:0.9rem;">${yr}</td>
  <td class="n" style="color:#10b981;">${fmt(t.revenue)}</td><td class="n" style="color:#ef4444;">${fmt(t.expenses)}</td>
  <td class="n" style="color:${t.netIncome>=0?'#10b981':'#ef4444'};">${fmt(t.netIncome)}</td><td class="n" style="color:${t.profitMargin>=0?'#10b981':'#ef4444'};">${fmtP(t.profitMargin)}</td>
  <td class="n" style="color:#06b6d4;">${fmt(co)}</td><td class="n" style="color:#f59e0b;">${fmt(t.remaining||0)}</td>
  <td class="n" style="color:${cp>=70?'#10b981':'#f59e0b'};">${fmtP(cp)}</td>
  <td class="n" style="color:#3b82f6;">${fmt(t.assets)}</td><td class="n" style="color:#ef4444;">${fmt(t.liabilities)}</td></tr>`; }).join('')}</tbody>`;
  bindSortableHeaders(tbl);
}

function fillBalanceTable(tbl, d) {
  if (!tbl) return;
  const yrs = d.years, yd = d.yearlyData, gt = d.grandTotals, mY = yrs.length > 1;
  const rows = [];
  yrs.forEach(yr => { (yd[yr]?.companies || []).forEach((c, i) => { const k = c.kpis;
    rows.push({ l: c.companyName, yr, col: COLORS[i % COLORS.length], assets: k.assets, liabilities: k.liabilities, equity: k.equity, cash: k.cash, recv: k.receivables, pay: k.payables }); }); });
  const balOff = mY ? 1 : 0;
  tbl.innerHTML = `<thead><tr><th>الشركة</th>${mY?'<th>السنة</th>':''}<th class="n sortable" data-col-idx="${1+balOff}">الأصول</th><th class="n sortable" data-col-idx="${2+balOff}">الالتزامات</th><th class="n sortable" data-col-idx="${3+balOff}">حقوق الملكية</th><th class="n sortable" data-col-idx="${4+balOff}">النقدية</th><th class="n sortable" data-col-idx="${5+balOff}">ذمم مدينة</th><th class="n sortable" data-col-idx="${6+balOff}">ذمم دائنة</th></tr></thead>
  <tbody>${rows.map(r=>`<tr><td style="color:${r.col};font-weight:700;">${r.l}</td>${mY?`<td style="font-family:var(--font-en);color:rgba(255,255,255,0.5);">${r.yr}</td>`:''}<td class="n" style="color:#3b82f6;">${fmt(r.assets)}</td><td class="n" style="color:#ef4444;">${fmt(r.liabilities)}</td><td class="n" style="color:#10b981;">${fmt(r.equity)}</td><td class="n" style="color:#06b6d4;">${fmt(r.cash)}</td><td class="n" style="color:#f59e0b;">${fmt(r.recv)}</td><td class="n" style="color:#8b5cf6;">${fmt(r.pay)}</td></tr>`).join('')}</tbody>
  <tfoot><tr><td>المجموع</td>${mY?'<td></td>':''}<td class="n" style="color:#3b82f6;">${fmt(gt.assets)}</td><td class="n" style="color:#ef4444;">${fmt(gt.liabilities)}</td><td class="n" style="color:#10b981;">${fmt(gt.equity)}</td><td class="n" style="color:#06b6d4;">${fmt(gt.cash)}</td><td class="n" style="color:#f59e0b;">${fmt(gt.receivables)}</td><td class="n" style="color:#8b5cf6;">${fmt(gt.payables)}</td></tr></tfoot>`;
  bindSortableHeaders(tbl);
}

function fillAccountTable(tbl, d) {
  if (!tbl) return;
  const yrs = d.years, yd = d.yearlyData;
  const companyMap = new Map();
  yrs.forEach(yr => { (yd[yr]?.companies || []).forEach(c => {
    let entry = companyMap.get(c.companyId);
    if (!entry) { entry = { name: c.companyName, id: c.companyId, ccMap: new Map() }; companyMap.set(c.companyId, entry); }
    (c.accountTree || []).forEach(cc => {
      let ccEntry = entry.ccMap.get(cc.name);
      if (!ccEntry) { ccEntry = { name: cc.name, revenue:0, expenses:0, netIncome:0, accMap: new Map() }; entry.ccMap.set(cc.name, ccEntry); }
      ccEntry.revenue += cc.revenue || 0; ccEntry.expenses += cc.expenses || 0; ccEntry.netIncome += cc.netIncome || 0;
      (cc.accounts || []).forEach(a => {
        const key = a.code + '|' + a.type; let aEntry = ccEntry.accMap.get(key);
        if (!aEntry) { aEntry = { code: a.code, name: a.name, type: a.type, amount: 0 }; ccEntry.accMap.set(key, aEntry); }
        aEntry.amount += a.amount || 0;
      });
    });
  }); });
  companyMap.forEach(e => { let rev = 0, exp = 0; e.ccMap.forEach(cc => { rev += cc.revenue; exp += cc.expenses; }); e.kpis = { revenue: rev, expenses: exp, netIncome: rev - exp, profitMargin: rev > 0 ? ((rev - exp) / rev * 100) : 0 }; });
  let totalRev = 0, totalExp = 0;
  companyMap.forEach(e => { totalRev += e.kpis.revenue; totalExp += e.kpis.expenses; });
  const totalNet = totalRev - totalExp, totalMargin = totalRev > 0 ? (totalNet / totalRev * 100) : 0;
  let rows = '', cIdx = 0, ccIdx = 0, coI = 0;
  companyMap.forEach(co => {
    const k = co.kpis, coGid = 'dg' + cIdx++;
    rows += `<tr class="row-co" data-gid="${coGid}"><td style="color:${COLORS[coI % COLORS.length]};font-weight:700;">${co.name}</td><td class="n" style="color:#10b981;">${fmt(k.revenue)}</td><td class="n" style="color:#ef4444;">${fmt(k.expenses)}</td><td class="n" style="color:${k.netIncome>=0?'#10b981':'#ef4444'};">${fmt(k.netIncome)}</td><td class="n" style="color:${k.profitMargin>=0?'#10b981':'#ef4444'};">${fmtP(k.profitMargin)}</td></tr>`;
    coI++;
    co.ccMap.forEach(cc => {
      const ccGid = 'dc' + ccIdx++, ccMargin = cc.revenue > 0 ? (cc.netIncome / cc.revenue * 100) : 0;
      rows += `<tr class="row-cc" data-gid="${ccGid}" data-pgid="${coGid}"><td>${cc.name.length>28?cc.name.substring(0,28)+'\u2026':cc.name}</td><td class="n">${fmt(cc.revenue)}</td><td class="n">${fmt(cc.expenses)}</td><td class="n" style="color:${cc.netIncome>=0?'#10b981':'#ef4444'};">${fmt(cc.netIncome)}</td><td class="n" style="color:${ccMargin>=0?'#10b981':'#ef4444'};">${fmtP(ccMargin)}</td></tr>`;
      cc.accMap.forEach(a => {
        const isInc = a.type === 'income';
        rows += `<tr class="row-pt" data-pgid="${ccGid}"><td>${a.code} - ${a.name.length>22?a.name.substring(0,22)+'\u2026':a.name}</td><td class="n" style="color:${isInc?'#10b981':'transparent'};">${isInc?fmt(a.amount):''}</td><td class="n" style="color:${!isInc?'#ef4444':'transparent'};">${!isInc?fmt(a.amount):''}</td><td class="n" style="color:rgba(255,255,255,0.3);">${isInc?'\u0625\u064a\u0631\u0627\u062f':'\u0645\u0635\u0631\u0648\u0641'}</td><td class="n">${fmt(Math.abs(a.amount))}</td></tr>`;
      });
    });
  });
  tbl.innerHTML = `<thead><tr><th>\u0627\u0644\u0634\u0631\u0643\u0629 / \u0645\u0631\u0643\u0632 / \u062d\u0633\u0627\u0628</th><th class="n sortable" data-col-idx="1">\u0627\u0644\u0625\u064a\u0631\u0627\u062f\u0627\u062a</th><th class="n sortable" data-col-idx="2">\u0627\u0644\u0645\u0635\u0631\u0648\u0641\u0627\u062a</th><th class="n sortable" data-col-idx="3">\u0635\u0627\u0641\u064a \u0627\u0644\u0631\u0628\u062d</th><th class="n sortable" data-col-idx="4">% \u0631\u0628\u062d</th></tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr><td>\u0627\u0644\u0645\u062c\u0645\u0648\u0639</td><td class="n" style="color:#10b981;">${fmt(totalRev)}</td><td class="n" style="color:#ef4444;">${fmt(totalExp)}</td><td class="n" style="color:${totalNet>=0?'#10b981':'#ef4444'};">${fmt(totalNet)}</td><td class="n" style="color:${totalMargin>=0?'#10b981':'#ef4444'};">${fmtP(totalMargin)}</td></tr></tfoot>`;
  bindToggle(tbl); bindSortableHeaders(tbl);
}

function fillPivotAccTable(tbl, d) {
  if (!tbl) return;
  const rows = aggregatePivotData(d), accMap = new Map(), mths = [1,2,3,4,5,6,7,8,9,10,11,12];
  const sepBdr = 'border-right:2px solid rgba(139,92,246,0.3);';
  for (const r of rows) {
    let e = accMap.get(r.account_code);
    if (!e) { e = { code: r.account_code, name: r.account_name, type: r.account_type, m: {} }; accMap.set(r.account_code, e); }
    if (!e.m[r.month]) e.m[r.month] = { rev: 0, exp: 0 };
    e.m[r.month].rev += r.revenue || 0; e.m[r.month].exp += r.expenses || 0;
  }
  let hdr = '<th style="position:sticky;right:0;z-index:2;background:var(--bg-dark);">\u0627\u0644\u062d\u0633\u0627\u0628</th>';
  hdr += `<th colspan="3" class="n" style="color:#a78bfa;font-size:0.95rem;${sepBdr}">\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a</th>`;
  mths.forEach(m => { hdr += `<th colspan="3" class="n" style="font-size:0.88rem;color:rgba(255,255,255,0.55);">${MONTH_NAMES[m-1]}</th>`; });
  let subH = '<th></th>';
  subH += `<th class="n sortable" data-col-idx="1" style="color:#10b981;font-size:0.85rem;">\u0625\u064a\u0631\u0627\u062f</th><th class="n sortable" data-col-idx="2" style="color:#ef4444;font-size:0.85rem;">\u0645\u0635\u0631\u0648\u0641</th><th class="n sortable" data-col-idx="3" style="color:#3b82f6;font-size:0.85rem;${sepBdr}">\u0635\u0627\u0641\u064a</th>`;
  mths.forEach((m, mi) => { const base = 4 + mi * 3; subH += `<th class="n sortable" data-col-idx="${base}" style="color:#10b981;font-size:0.82rem;">\u0625\u064a\u0631\u0627\u062f</th><th class="n sortable" data-col-idx="${base+1}" style="color:#ef4444;font-size:0.82rem;">\u0645\u0635\u0631\u0648\u0641</th><th class="n sortable" data-col-idx="${base+2}" style="color:#3b82f6;font-size:0.82rem;">\u0635\u0627\u0641\u064a</th>`; });
  let bdy = '', totM = {};
  accMap.forEach(a => {
    const isInc = a.type?.includes('income'); let tRev = 0, tExp = 0;
    mths.forEach(m => { const v = a.m[m] || { rev:0, exp:0 }; tRev += v.rev; tExp += v.exp; if(!totM[m]) totM[m]={rev:0,exp:0}; totM[m].rev+=v.rev; totM[m].exp+=v.exp; });
    let r = `<td style="position:sticky;right:0;background:var(--bg-card);white-space:nowrap;font-weight:600;color:${isInc?'#10b981':'#ef4444'};">${a.code} ${a.name.length>22?a.name.substring(0,22)+'\u2026':a.name}</td>`;
    r += `<td class="n" style="color:#10b981;font-weight:800;">${fmt(tRev)}</td><td class="n" style="color:#ef4444;font-weight:800;">${fmt(tExp)}</td><td class="n" style="color:${tRev-tExp>=0?'#3b82f6':'#f59e0b'};font-weight:800;${sepBdr}">${fmt(tRev-tExp)}</td>`;
    mths.forEach(m => { const v = a.m[m] || { rev:0, exp:0 }; const net = v.rev - v.exp; r += `<td class="n" style="color:#10b981;">${v.rev?fmt(v.rev):''}</td><td class="n" style="color:#ef4444;">${v.exp?fmt(v.exp):''}</td><td class="n" style="color:${net>=0?'#3b82f6':'#f59e0b'};">${(v.rev||v.exp)?fmt(net):''}</td>`; });
    bdy += `<tr>${r}</tr>`;
  });
  let gRev = 0, gExp = 0;
  let tRow = '<td style="font-weight:800;">\u0627\u0644\u0645\u062c\u0645\u0648\u0639</td>';
  mths.forEach(m => { const v = totM[m]||{rev:0,exp:0}; gRev+=v.rev; gExp+=v.exp; });
  tRow += `<td class="n" style="color:#10b981;font-weight:800;">${fmt(gRev)}</td><td class="n" style="color:#ef4444;font-weight:800;">${fmt(gExp)}</td><td class="n" style="color:${gRev-gExp>=0?'#3b82f6':'#f59e0b'};font-weight:800;${sepBdr}">${fmt(gRev-gExp)}</td>`;
  mths.forEach(m => { const v = totM[m]||{rev:0,exp:0}; const net = v.rev-v.exp; tRow += `<td class="n" style="color:#10b981;font-weight:700;">${fmt(v.rev)}</td><td class="n" style="color:#ef4444;font-weight:700;">${fmt(v.exp)}</td><td class="n" style="color:${net>=0?'#3b82f6':'#f59e0b'};font-weight:700;">${fmt(net)}</td>`; });
  tbl.innerHTML = `<thead><tr>${hdr}</tr><tr>${subH}</tr></thead><tbody>${bdy}</tbody><tfoot><tr>${tRow}</tr></tfoot>`;
  bindSortableHeaders(tbl);
}

function fillPivotCCTable(tbl, d) {
  if (!tbl) return;
  const rawRows = aggregatePivotData(d), ccMap = new Map(), mths = [1,2,3,4,5,6,7,8,9,10,11,12];
  const sepBdr = 'border-right:2px solid rgba(139,92,246,0.3);';
  for (const r of rawRows) {
    let cc = ccMap.get(r.cc);
    if (!cc) { cc = { name: r.cc, m: {} }; ccMap.set(r.cc, cc); }
    if (!cc.m[r.month]) cc.m[r.month] = { rev: 0, exp: 0 };
    cc.m[r.month].rev += r.revenue || 0; cc.m[r.month].exp += r.expenses || 0;
  }
  let hdr = '<th style="position:sticky;right:0;z-index:2;background:var(--bg-dark);">\u0645\u0631\u0643\u0632 \u0627\u0644\u062a\u0643\u0644\u0641\u0629</th>';
  hdr += `<th colspan="3" class="n" style="color:#a78bfa;font-size:0.95rem;${sepBdr}">\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a</th>`;
  mths.forEach(m => { hdr += `<th colspan="3" class="n" style="font-size:0.88rem;color:rgba(255,255,255,0.55);">${MONTH_NAMES[m-1]}</th>`; });
  let subH = '<th></th>';
  subH += `<th class="n sortable" data-col-idx="1" style="color:#10b981;font-size:0.85rem;">\u0625\u064a\u0631\u0627\u062f</th><th class="n sortable" data-col-idx="2" style="color:#ef4444;font-size:0.85rem;">\u0645\u0635\u0631\u0648\u0641</th><th class="n sortable" data-col-idx="3" style="color:#3b82f6;font-size:0.85rem;${sepBdr}">\u0635\u0627\u0641\u064a</th>`;
  mths.forEach((m, mi) => { const base = 4 + mi * 3; subH += `<th class="n sortable" data-col-idx="${base}" style="color:#10b981;font-size:0.82rem;">\u0625\u064a\u0631\u0627\u062f</th><th class="n sortable" data-col-idx="${base+1}" style="color:#ef4444;font-size:0.82rem;">\u0645\u0635\u0631\u0648\u0641</th><th class="n sortable" data-col-idx="${base+2}" style="color:#3b82f6;font-size:0.82rem;">\u0635\u0627\u0641\u064a</th>`; });
  let bdy = '', totM = {};
  ccMap.forEach(cc => {
    let ccRev = 0, ccExp = 0;
    mths.forEach(m => { const v = cc.m[m]||{rev:0,exp:0}; ccRev+=v.rev; ccExp+=v.exp; if(!totM[m]) totM[m]={rev:0,exp:0}; totM[m].rev+=v.rev; totM[m].exp+=v.exp; });
    let r = `<td style="position:sticky;right:0;background:var(--bg-card);font-weight:700;color:#8b5cf6;">${cc.name.length>28?cc.name.substring(0,28)+'\u2026':cc.name}</td>`;
    r += `<td class="n" style="color:#10b981;font-weight:800;">${fmt(ccRev)}</td><td class="n" style="color:#ef4444;font-weight:800;">${fmt(ccExp)}</td><td class="n" style="color:${ccRev-ccExp>=0?'#3b82f6':'#f59e0b'};font-weight:800;${sepBdr}">${fmt(ccRev-ccExp)}</td>`;
    mths.forEach(m => { const v = cc.m[m]||{rev:0,exp:0}; const net = v.rev-v.exp; r += `<td class="n" style="color:#10b981;">${v.rev?fmt(v.rev):''}</td><td class="n" style="color:#ef4444;">${v.exp?fmt(v.exp):''}</td><td class="n" style="color:${net>=0?'#3b82f6':'#f59e0b'};">${(v.rev||v.exp)?fmt(net):''}</td>`; });
    bdy += `<tr>${r}</tr>`;
  });
  let gRev = 0, gExp = 0;
  let tRow = '<td style="position:sticky;right:0;background:var(--bg-dark);font-weight:800;">\u0627\u0644\u0645\u062c\u0645\u0648\u0639</td>';
  mths.forEach(m => { const v = totM[m]||{rev:0,exp:0}; gRev+=v.rev; gExp+=v.exp; });
  tRow += `<td class="n" style="color:#10b981;font-weight:800;">${fmt(gRev)}</td><td class="n" style="color:#ef4444;font-weight:800;">${fmt(gExp)}</td><td class="n" style="color:${gRev-gExp>=0?'#3b82f6':'#f59e0b'};font-weight:800;${sepBdr}">${fmt(gRev-gExp)}</td>`;
  mths.forEach(m => { const v = totM[m]||{rev:0,exp:0}; const net = v.rev-v.exp; tRow += `<td class="n" style="color:#10b981;font-weight:700;">${fmt(v.rev)}</td><td class="n" style="color:#ef4444;font-weight:700;">${fmt(v.exp)}</td><td class="n" style="color:${net>=0?'#3b82f6':'#f59e0b'};font-weight:700;">${fmt(net)}</td>`; });
  tbl.innerHTML = `<thead><tr>${hdr}</tr><tr>${subH}</tr></thead><tbody>${bdy}</tbody><tfoot><tr>${tRow}</tr></tfoot>`;
  bindSortableHeaders(tbl);
}
