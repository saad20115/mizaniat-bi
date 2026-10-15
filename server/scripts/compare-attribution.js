/**
 * CC1 impact proof (read-only): before/after attribution on the SAME data.
 *
 *   node server/scripts/compare-attribution.js <beforeDb> <afterDb> [--years 2023,2024,2025,2026]
 *        [--api <beforeBaseUrl> <afterBaseUrl> --token <adminToken>] [--api-years 2025,2026]
 *
 * 1. Per company totals (must be identical) and per department / per cost center:
 *    revenue, expenses (ledger, fact_daily), billed (invoices incl. VAT by invoice date),
 *    collected (payment allocations of those invoices) and remaining (residual), by year.
 * 2. Optional: the presentation APIs (/executive, /customers-collection, /actual-collections,
 *    /departments-profitability, /departments-comparison) of two running servers — every
 *    numeric leaf that differs is listed with its path.
 */
const Database = require('better-sqlite3');

const args = process.argv.slice(2);
const [beforePath, afterPath] = args;
if (!beforePath || !afterPath) {
  console.error('usage: compare-attribution.js <beforeDb> <afterDb> [--years ...] [--api <before> <after> --token <t>]');
  process.exit(2);
}
const opt = (name, def) => { const i = args.indexOf(name); return i > -1 && args[i + 1] ? args[i + 1] : def; };
const YEARS = opt('--years', '2023,2024,2025,2026').split(',');
const yIn = YEARS.map(y => `'${y}'`).join(',');
const A = new Database(beforePath, { readonly: true });
const B = new Database(afterPath, { readonly: true });
const r2 = (n) => Math.round((n || 0) * 100) / 100;
const fmt = (n) => r2(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const groupName = new Map(B.prepare('SELECT id, name FROM analytic_groups').all().map(g => [g.id, g.name]));
const coName = new Map(B.prepare('SELECT id, COALESCE(short_name, name) n FROM companies').all().map(c => [c.id, c.n]));
const salesToLedger = new Map(B.prepare('SELECT sc.id s, c.id l FROM sales_companies sc JOIN companies c ON c.odoo_company_id = sc.sales_company_id').all().map(x => [x.s, x.l]));
const dept = (d) => d ? (groupName.get(d) || '#' + d) : 'بدون قسم';
const MEASURES = ['revenue', 'expenses', 'billed', 'collected', 'remaining'];

function measures(db, level) {
  // level: 'company' | 'department' | 'cost_center'
  const dim = (alias) => level === 'company' ? `''` : level === 'department' ? `${alias}.department_id` : `${alias}.cost_center_key || '#' || ${alias}.department_id`;
  const out = new Map();
  const add = (co, y, k, m, v, name) => {
    const key = `${co}|${y}|${k}`;
    if (!out.has(key)) out.set(key, { co, y, k, name: name || '', revenue: 0, expenses: 0, billed: 0, collected: 0, remaining: 0 });
    const e = out.get(key);
    e[m] += v || 0;
    if (name && !e.name) e.name = name;
  };
  for (const r of db.prepare(`
    SELECT fd.company_id co, fd.year y, ${dim('fd')} k, MAX(fd.cost_center_name) n, SUM(fd.revenue) rev, SUM(fd.expense) exp
    FROM fact_daily fd WHERE fd.year IN (${yIn}) GROUP BY 1, 2, 3
  `).all()) { add(r.co, r.y, r.k, 'revenue', r.rev, r.n); add(r.co, r.y, r.k, 'expenses', r.exp, r.n); }
  for (const r of db.prepare(`
    SELECT si.company_id s, substr(si.date, 1, 4) y, ${dim('idp')} k, MAX(idp.cost_center_name) n,
           SUM(si.amount_total * idp.share) billed, SUM(si.amount_residual_signed * idp.share) rem
    FROM invoice_departments idp JOIN sales_invoices si ON si.id = idp.sales_invoice_id
    WHERE substr(si.date, 1, 4) IN (${yIn}) GROUP BY 1, 2, 3
  `).all()) { const co = salesToLedger.get(r.s); add(co, r.y, r.k, 'billed', r.billed, r.n); add(co, r.y, r.k, 'remaining', r.rem, r.n); }
  for (const r of db.prepare(`
    SELECT pa.company_id co, pa.invoice_year y, ${dim('pa')} k, MAX(pa.cost_center_name) n, SUM(pa.amount) a
    FROM payment_allocations pa WHERE pa.invoice_year IN (${yIn}) GROUP BY 1, 2, 3
  `).all()) add(r.co, r.y, r.k, 'collected', r.a, r.n);
  return out;
}

function table(level) {
  const a = measures(A, level), b = measures(B, level);
  const rows = [];
  for (const key of new Set([...a.keys(), ...b.keys()])) {
    const x = a.get(key), y = b.get(key);
    const base = y || x;
    const d = MEASURES.map(m => (y ? y[m] : 0) - (x ? x[m] : 0));
    if (d.some(v => Math.abs(v) > 0.011)) rows.push({ base, x, y, d });
  }
  rows.sort((p, q) => p.base.co - q.base.co || String(p.base.y).localeCompare(String(q.base.y)) || Math.max(...q.d.map(Math.abs)) - Math.max(...p.d.map(Math.abs)));
  return rows;
}

const label = (level, e) => {
  if (level === 'company') return `${coName.get(e.co) || e.co}`;
  if (level === 'department') return `${coName.get(e.co) || e.co} · ${dept(Number(e.k))}`;
  const [key, d] = String(e.k).split('#');
  return `${coName.get(e.co) || e.co} · ${key} ${String(e.name || '').slice(0, 45)} [${dept(Number(d))}]`;
};

let companyChanged = 0;
for (const level of ['company', 'department', 'cost_center']) {
  const rows = table(level);
  if (level === 'company') companyChanged = rows.length;
  console.log(`\n=== ${level === 'company' ? 'Company totals (must not change)' : level === 'department' ? 'By department' : 'By cost center (key, department)'}: ${rows.length} changed rows (years ${YEARS.join(', ')})`);
  for (const r of rows) {
    const parts = MEASURES.map((m, i) => Math.abs(r.d[i]) > 0.011 ? `${m} ${fmt(r.x ? r.x[m] : 0)} → ${fmt(r.y ? r.y[m] : 0)} (Δ ${fmt(r.d[i])})` : null).filter(Boolean);
    console.log(`  ${r.base.y} | ${label(level, r.base)} | ${parts.join(' | ')}`);
  }
}
console.log(`\nCompany totals unchanged: ${companyChanged === 0 ? 'YES' : 'NO (' + companyChanged + ' rows)'}`);

// ---- presentation APIs ----------------------------------------------------------------------
async function apiDiff() {
  const ai = args.indexOf('--api');
  if (ai < 0) return 0;
  const [baseUrl, newUrl] = [args[ai + 1], args[ai + 2]];
  const token = opt('--token', '');
  const years = opt('--api-years', '2025,2026').split(',');
  const endpoints = (y) => [
    `/api/executive?years=${y}&fullTree=true&includeAging=true`,
    `/api/customers-collection?years=${y}`,
    `/api/actual-collections?years=${y}`,
    `/api/departments-profitability?years=${y}`,
    `/api/departments-comparison?years=${y}`
  ];
  const get = async (base, path) => {
    const res = await fetch(base + path, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`${base}${path} → HTTP ${res.status}`);
    return res.json();
  };
  const leaves = (obj, path = '', out = new Map(), ctx = '') => {
    if (Array.isArray(obj)) {
      obj.forEach((v, i) => {
        // identify array items by a stable id/name instead of their position
        const id = v && typeof v === 'object' ? (v.cost_center_key || v.ccKey || v.key || v.id || v.department_id || v.company_id || v.partner_id || v.name || v.label || i) : i;
        leaves(v, `${path}[${id}]`, out, v && typeof v === 'object' && v.name ? `${v.name}` : ctx);
      });
    } else if (obj && typeof obj === 'object') {
      for (const [k, v] of Object.entries(obj)) leaves(v, path ? `${path}.${k}` : k, out, ctx);
    } else if (typeof obj === 'number') {
      out.set(path, { v: obj, ctx });
    }
    return out;
  };
  let total = 0;
  const ignore = /(generated_at|generatedAt|duration|elapsed|_ms|timestamp|cachedAt|computedAt)/i;
  for (const y of years) {
    for (const ep of endpoints(y)) {
      const [x, z] = await Promise.all([get(baseUrl, ep), get(newUrl, ep)]);
      const lx = leaves(x), lz = leaves(z);
      const changed = [];
      let numbers = 0;
      for (const k of new Set([...lx.keys(), ...lz.keys()])) {
        if (ignore.test(k)) continue;
        numbers++;
        const p = lx.get(k), q = lz.get(k);
        const pv = p ? p.v : null, qv = q ? q.v : null;
        if (pv === null || qv === null || Math.abs(pv - qv) > 0.011) changed.push({ k, pv, qv, ctx: (q || p).ctx });
      }
      total += changed.length;
      console.log(`\n=== API ${ep}: ${numbers} numbers compared, ${changed.length} changed`);
      // Summarise by entity: the first two [..] segments of the path (company / department level);
      // values sitting directly on that entity are printed, deeper ones (cost centers, clients,
      // invoices that moved with it) are counted.
      const segs = (k) => (k.match(/\[[^\]]*\]/g) || []);
      const top = changed.filter(c => segs(c.k).length <= 1);
      for (const c of top) console.log(`  ${c.k} [${String(c.ctx).slice(0, 40)}]: ${c.pv === null ? '—' : fmt(c.pv)} → ${c.qv === null ? '—' : fmt(c.qv)}`);
      const byEntity = new Map();
      for (const c of changed.filter(c => segs(c.k).length > 1)) {
        const s = segs(c.k);
        const prefixEnd = c.k.indexOf(s[1]) + s[1].length;
        const ent = c.k.slice(0, prefixEnd);
        if (!byEntity.has(ent)) byEntity.set(ent, { direct: [], deeper: 0, ctx: c.ctx });
        const e = byEntity.get(ent);
        if (segs(c.k).length === 2) e.direct.push(c); else e.deeper++;
      }
      for (const [ent, e] of byEntity) {
        const name = e.direct.length ? e.direct[0].ctx : e.ctx;
        const direct = e.direct.filter(c => !/(_id|id)$/.test(c.k)).map(c => `${c.k.slice(c.k.lastIndexOf('.') + 1)} ${c.pv === null ? '—' : fmt(c.pv)} → ${c.qv === null ? '—' : fmt(c.qv)}`);
        console.log(`  ${ent} [${String(name).slice(0, 40)}]: ${direct.slice(0, 8).join(' | ')}${direct.length > 8 ? ` | … ${direct.length - 8} more` : ''}${e.deeper ? ` (+${e.deeper} nested numbers)` : ''}`);
      }
    }
  }
  return total;
}

apiDiff().then(n => { if (args.includes('--api')) console.log(`\nAPI numbers changed: ${n}`); })
  .catch(e => { console.error('API comparison failed:', e.message); process.exit(1); });
