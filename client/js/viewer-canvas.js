// Canvas drawing + table filling functions for viewer (exact copies from presentation.js)

function drawBarGroup(canvas, data) {
  if (!canvas || !data) return;
  const { groups, max, colors, labels } = data;
  const bPG = groups[0]?.length || 1, gC = groups.length, barH = 26, barGap = 3, groupGap = 14, legendH = 30;
  const neededH = 10 + gC * (bPG * (barH + barGap) + groupGap) + legendH;
  canvas.style.height = neededH + 'px';
  const ctx = canvas.getContext('2d'), dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = neededH;
  canvas.width = w * dpr; canvas.height = h * dpr;
  ctx.scale(dpr, dpr); ctx.clearRect(0, 0, w, h);
  const labelW = 140, pL = 10, pR = 10, pT = 8;
  const chartW = w - labelW - pL - pR - 120, mx = max || 1;
  for (let i = 0; i <= 5; i++) { const x = labelW + pL + (chartW / 5) * i; ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.beginPath(); ctx.moveTo(x, pT); ctx.lineTo(x, h - legendH); ctx.stroke(); }
  let curY = pT;
  groups.forEach((bars, gi) => {
    const groupH = bPG * (barH + barGap);
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = '700 13px "Noto Sans Arabic"'; ctx.textAlign = 'right';
    const short = (labels[gi] || '').length > 20 ? labels[gi].substring(0, 20) + '\u2026' : labels[gi];
    ctx.fillText(short, labelW - 8, curY + groupH / 2 + 1);
    bars.forEach((val, bi) => {
      const y = curY + bi * (barH + barGap), bw = Math.max(2, (Math.abs(val) / mx) * chartW);
      const r = Math.min(5, barH / 2), x = labelW + pL;
      const grad = ctx.createLinearGradient(x, y, x + bw, y);
      grad.addColorStop(0, colors[bi % colors.length]); grad.addColorStop(1, colors[bi % colors.length] + '90');
      ctx.fillStyle = grad; ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x + bw - r, y); ctx.arcTo(x + bw, y, x + bw, y + r, r);
      ctx.arcTo(x + bw, y + barH, x + bw - r, y + barH, r); ctx.lineTo(x, y + barH); ctx.closePath(); ctx.fill();
      const label = Math.abs(val) >= 1e6 ? (val / 1e6).toFixed(1) + 'M' : Math.abs(val) >= 1e3 ? Math.round(val / 1e3) + 'K' : formatNumber(val, 0);
      ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.font = 'bold 13px Inter'; ctx.textAlign = 'left';
      ctx.fillText(label, x + bw + 8, y + barH / 2 + 5);
    });
    curY += groupH + groupGap;
  });
  const legendY = h - 6, legendLabels = bPG >= 2 ? ['إيرادات', 'مصروفات'] : ['القيمة'];
  let lx = labelW + pL;
  legendLabels.forEach((lbl, i) => { ctx.fillStyle = colors[i % colors.length]; ctx.fillRect(lx, legendY - 12, 12, 12); ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '600 12px "Noto Sans Arabic"'; ctx.textAlign = 'left'; ctx.fillText(lbl, lx + 16, legendY - 1); lx += 90; });
}

function drawDonut(canvas, data) {
  if (!canvas || !data) return;
  const { values, colors, labels } = data;
  const ctx = canvas.getContext('2d'), dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  ctx.scale(dpr, dpr); ctx.clearRect(0, 0, w, h);
  const cx = w * 0.38, cy = h / 2, r = Math.min(cx - 20, cy - 20), inner = r * 0.48;
  const total = values.reduce((a, b) => a + Math.abs(b), 0) || 1;
  let angle = -Math.PI / 2;
  values.forEach((v, i) => {
    const sweep = (Math.abs(v) / total) * Math.PI * 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, angle, angle + sweep); ctx.arc(cx, cy, inner, angle + sweep, angle, true); ctx.closePath();
    ctx.fillStyle = colors[i % colors.length]; ctx.fill();
    if (sweep > 0.15) { const mid = angle + sweep / 2; ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Inter'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(((Math.abs(v) / total) * 100).toFixed(0) + '%', cx + Math.cos(mid) * (r * 0.76), cy + Math.sin(mid) * (r * 0.76)); }
    angle += sweep;
  });
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = '700 13px "Noto Sans Arabic"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('المجموع', cx, cy - 12);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 18px Inter';
  ctx.fillText(total >= 1e6 ? (total / 1e6).toFixed(1) + 'M' : fmt(total), cx, cy + 12);
  const legX = w * 0.68; let legY = 28;
  labels.forEach((lb, i) => {
    ctx.fillStyle = colors[i % colors.length]; ctx.beginPath(); ctx.arc(legX, legY + 7, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.font = '700 13px "Noto Sans Arabic"'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(lb.length > 20 ? lb.substring(0, 20) + '\u2026' : lb, legX - 14, legY + 7);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '12px Inter'; ctx.textAlign = 'left';
    ctx.fillText(fmt(values[i]), legX + 14, legY + 7); legY += 30;
  });
}

function drawCollectionBars(canvas, d) {
  if (!canvas) return;
  const yrs = d.years, yd = d.yearlyData, fc = yd[yrs[0]]?.companies || [];
  const mC = fc.length > 1, mY = yrs.length > 1;
  let items;
  if (mC) items = fc.map(c => ({ l: c.companyName, a: c.kpis.collected||0, b: c.kpis.remaining||0, t: c.kpis.revenue }));
  else if (mY) items = yrs.map(y => { const t = yd[y].totals; return { l: y, a: t.collected||0, b: t.remaining||0, t: t.revenue }; });
  else { const t = d.grandTotals; items = [{ l: 'التحصيل', a: t.collected||0, b: t.remaining||0, t: t.revenue }]; }
  const ctx = canvas.getContext('2d'), dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  ctx.scale(dpr, dpr); ctx.clearRect(0, 0, w, h);
  const pL = 130, pR = 70, cW = w - pL - pR, bH = Math.min(24, (h - 10) / items.length - 6), mx = Math.max(...items.map(i => i.t), 1);
  items.forEach((it, i) => {
    const y = 5 + i * ((h - 10) / items.length) + ((h - 10) / items.length - bH) / 2;
    ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.font = '600 11px "Noto Sans Arabic"'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(it.l.length > 14 ? it.l.substring(0, 14) + '\u2026' : it.l, pL - 10, y + bH / 2);
    const w1 = (Math.abs(it.a) / mx) * cW, w2 = (Math.abs(it.b) / mx) * cW;
    ctx.fillStyle = '#10b981'; ctx.fillRect(pL, y, w1, bH);
    ctx.fillStyle = '#f59e0b'; ctx.fillRect(pL + w1, y, w2, bH);
    const pct = it.t > 0 ? ((it.a / it.t) * 100).toFixed(0) + '%' : '0%';
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '600 10px Inter'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(`${fmt(it.t)}  (${pct})`, pL + w1 + w2 + 8, y + bH / 2);
  });
}

function drawMonthlyBars(canvas, data, color1, color2) {
  if (!canvas || !data || !data.length) return;
  const ctx = canvas.getContext('2d'), dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  canvas.width = w * dpr; canvas.height = h * dpr;
  ctx.scale(dpr, dpr); ctx.clearRect(0, 0, w, h);
  const pL = 20, pR = 14, pT = 28, pB = 36, cW = w - pL - pR, cH = h - pT - pB;
  const mx = Math.max(...data, 1), gW = cW / 12, bW = Math.min(gW * 0.55, 48);
  for (let i = 0; i <= 4; i++) { const y = pT + (cH / 4) * i; ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.beginPath(); ctx.moveTo(pL, y); ctx.lineTo(pL + cW, y); ctx.stroke(); }
  ctx.beginPath(); ctx.strokeStyle = color1 + '50'; ctx.lineWidth = 2.5;
  data.forEach((val, i) => { const x = pL + i * gW + gW / 2, bh = (Math.abs(val) / mx) * cH, y = pT + cH - bh; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
  ctx.stroke();
  data.forEach((val, i) => {
    const x = pL + i * gW + (gW - bW) / 2, bh = (Math.abs(val) / mx) * cH, y = pT + cH - bh, r = Math.min(5, bW / 2);
    const grad = ctx.createLinearGradient(x, y, x, pT + cH); grad.addColorStop(0, color1); grad.addColorStop(1, color2 + '30');
    ctx.fillStyle = grad; ctx.beginPath();
    ctx.moveTo(x, pT + cH); ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.arcTo(x + bW, y, x + bW, y + r, r);
    ctx.lineTo(x + bW, pT + cH); ctx.closePath(); ctx.fill();
    if (val > 0) { ctx.save(); ctx.translate(x + bW / 2, y - 4); ctx.rotate(-Math.PI / 4); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.font = 'bold 10px Inter'; ctx.textAlign = 'left'; ctx.fillText(fmt(val), 0, 0); ctx.restore(); }
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '700 13px "Noto Sans Arabic"'; ctx.textAlign = 'center';
    ctx.fillText(MONTH_NAMES[i].substring(0, 5), pL + i * gW + gW / 2, h - 8);
  });
  const total = data.reduce((a, b) => a + b, 0);
  ctx.fillStyle = color1; ctx.font = 'bold 13px Inter'; ctx.textAlign = 'right';
  ctx.fillText('\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a: ' + fmt(total), w - pR, 18);
}

// ===== TABLE HELPERS =====
function bindToggle(tbl) {
  tbl.querySelectorAll('.row-co').forEach(row => {
    row.addEventListener('click', () => {
      const gid = row.dataset.gid, open = row.classList.toggle('open');
      const ccChildren = tbl.querySelectorAll(`.row-cc[data-pgid="${gid}"]`);
      if (ccChildren.length > 0) {
        ccChildren.forEach(r => r.classList.toggle('show', open));
        if (!open) { ccChildren.forEach(cc => { cc.classList.remove('open'); tbl.querySelectorAll(`.row-pt[data-pgid="${cc.dataset.gid}"]`).forEach(r => r.classList.remove('show')); }); }
      } else { tbl.querySelectorAll(`.row-pt[data-pgid="${gid}"]`).forEach(r => r.classList.toggle('show', open)); }
    });
  });
  tbl.querySelectorAll('.row-cc').forEach(row => {
    row.addEventListener('click', (e) => { e.stopPropagation(); const gid = row.dataset.gid, open = row.classList.toggle('open'); tbl.querySelectorAll(`.row-pt[data-pgid="${gid}"]`).forEach(r => r.classList.toggle('show', open)); });
  });
}

function parseArabicNum(str) { if (!str) return 0; const cleaned = str.replace(/[^\d.\-]/g, ''); const val = parseFloat(cleaned); return isNaN(val) ? 0 : val; }

function bindSortableHeaders(tbl) {
  if (!tbl) return;
  const ths = tbl.querySelectorAll('th.sortable');
  ths.forEach(th => {
    th.addEventListener('click', () => {
      const curr = th.classList.contains('desc') ? 'desc' : th.classList.contains('asc') ? 'asc' : 'none';
      ths.forEach(h => { h.classList.remove('asc', 'desc'); });
      let dir; if (curr === 'none') dir = 'desc'; else if (curr === 'desc') dir = 'asc'; else dir = 'none';
      if (dir !== 'none') th.classList.add(dir);
      const colIdx = parseInt(th.dataset.colIdx); if (isNaN(colIdx)) return;
      const tbody = tbl.querySelector('tbody'); if (!tbody) return;
      const hasHierarchy = tbody.querySelector('.row-co') !== null;
      if (hasHierarchy) {
        const groups = []; let currentGroup = null;
        tbody.querySelectorAll('tr').forEach(tr => { if (tr.classList.contains('row-co')) { currentGroup = { parent: tr, children: [] }; groups.push(currentGroup); } else if (currentGroup) { currentGroup.children.push(tr); } });
        if (dir !== 'none') { groups.sort((a, b) => { const vA = parseArabicNum(a.parent.querySelectorAll('td')[colIdx]?.textContent); const vB = parseArabicNum(b.parent.querySelectorAll('td')[colIdx]?.textContent); return dir === 'desc' ? vB - vA : vA - vB; }); }
        groups.forEach(g => { tbody.appendChild(g.parent); g.children.forEach(c => tbody.appendChild(c)); });
      } else {
        const rows = [...tbody.querySelectorAll('tr')]; const dataRows = rows.filter(r => !r.querySelector('td[colspan]')); const otherRows = rows.filter(r => r.querySelector('td[colspan]'));
        if (dir !== 'none') { dataRows.sort((a, b) => { const vA = parseArabicNum(a.querySelectorAll('td')[colIdx]?.textContent); const vB = parseArabicNum(b.querySelectorAll('td')[colIdx]?.textContent); return dir === 'desc' ? vB - vA : vA - vB; }); }
        dataRows.forEach(r => tbody.appendChild(r)); otherRows.forEach(r => tbody.appendChild(r));
      }
    });
  });
}
