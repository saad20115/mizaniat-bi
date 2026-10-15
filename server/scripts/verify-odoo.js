/**
 * CC1: permanent READ-ONLY check of the app's attribution against Odoo  (npm run verify:odoo)
 *
 * For every active company, using only `search_read` on Odoo with the credentials stored in
 * odoo_instances (never printed):
 *   1. Revenue and expense per cost center and year (2023–2026) = Odoo account.move.line with the
 *      analytic_distribution percentages (account_section_overrides respected). Amounts without an
 *      analytic account in Odoo belong to the journal's explicit default (journal_department_defaults)
 *      or to the journal's own row j:<journal id> — the same user setting the app applies.
 *   2. Each invoice's attribution (invoice_departments) = the distribution of its income lines in Odoo.
 *   3. Every payment allocation sits on a (department, cost center) of its own invoice.
 *   4. Ambiguous journals without a user decision are printed (they are not hidden).
 * Tolerance: 0.01 SAR (rounding). Odoo records written after the start of the company's last
 * sync (write_date) are excluded on both sides and counted.
 *
 * usage: npm run verify:odoo [-- --years 2023,2024,2025,2026]
 */
const { getDb } = require('../db/connection');
const OdooConnector = require('../services/odoo-connector');
const { AttributionContext, loadDistribution, getAttributionConflicts, norm } = require('../services/attribution');

const yArg = process.argv.indexOf('--years');
const YEARS = (yArg > -1 && process.argv[yArg + 1] ? process.argv[yArg + 1] : '2023,2024,2025,2026').split(',').map(s => s.trim()).filter(Boolean);
const TOL = 0.011;
const round2 = (n) => Math.round((n || 0) * 100) / 100;
const fmt = (n) => round2(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures++;
  console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${detail ? ' — ' + detail : ''}`);
}

const realLog = console.log;
async function quiet(fn) {
  console.log = () => {};
  try { return await fn(); } finally { console.log = realLog; }
}

async function readAll(conn, model, domain, fields, ctx) {
  const out = [];
  for (let offset = 0; ; offset += 5000) {
    const batch = await conn._rpcCall(model, 'search_read', [domain], { fields, limit: 5000, offset, order: 'id', ...ctx });
    out.push(...batch);
    if (batch.length < 5000) break;
  }
  return out;
}

function accountCode(accountField) {
  const raw = Array.isArray(accountField) ? String(accountField[1] || '') : String(accountField || '');
  const m = raw.match(/^(\d+)\s+(.+)$/);
  return m ? m[1] : '';
}

function sectionOf(overrides, companyId, code, accountType) {
  const o = overrides.get(`${companyId}|${code}`);
  if (o) return o;
  const t = String(accountType || '');
  if (t.startsWith('asset')) return 'asset';
  if (t.startsWith('liability')) return 'liability';
  if (t.startsWith('equity')) return 'equity';
  if (t.startsWith('income')) return 'income';
  if (t.startsWith('expense')) return 'expense';
  return 'other';
}

/** Odoo truth parts of one line: [{ key, frac }] (same keys as the app, settings applied). */
function odooParts(ctx, instanceId, oaIds, line, stats) {
  const jId = Array.isArray(line.journal_id) ? line.journal_id[0] : line.journal_id;
  const untagged = () => ctx.untaggedTarget(jId, '').key;
  const dist = line.analytic_distribution && typeof line.analytic_distribution === 'object' ? Object.entries(line.analytic_distribution) : [];
  if (!dist.length) return [{ key: untagged(), frac: 1 }];
  const total = dist.reduce((s, [, p]) => s + (Number(p) || 0), 0);
  const scale = total > 100 ? 100 / total : 1;
  const parts = [];
  let used = 0;
  for (const [k, pct] of dist) {
    const frac = (Number(pct) || 0) / 100 * scale;
    if (!frac) continue;
    used += frac;
    const ids = String(k).split(',').map(s => s.trim()).filter(Boolean);
    if (ids.length > 1) { stats.combinations++; parts.push({ key: untagged(), frac }); continue; }
    const id = parseInt(ids[0], 10);
    parts.push({ key: oaIds.has(id) ? `an:${instanceId}:${id}` : `an:${ids[0]}`, frac });
  }
  if (1 - used > 1e-9) parts.push({ key: untagged(), frac: 1 - used });
  return parts;
}

async function run() {
  const db = getDb();
  console.log('================================================================');
  console.log(`🔎 verify:odoo — app attribution vs Odoo (read-only), years ${YEARS.join(', ')}`);
  console.log('================================================================');

  const overrides = new Map(db.prepare('SELECT company_id, account_code, section FROM account_section_overrides').all().map(o => [`${o.company_id}|${o.account_code}`, o.section]));
  const overrideCodes = new Map();
  for (const [k, s] of overrides) {
    if (s !== 'income' && s !== 'expense') continue;
    const [cid, code] = k.split('|');
    if (!overrideCodes.has(cid)) overrideCodes.set(cid, []);
    overrideCodes.get(cid).push(code);
  }
  const from = `${YEARS[0]}-01-01`;
  const to = `${YEARS[YEARS.length - 1]}-12-31`;

  for (const inst of db.prepare('SELECT * FROM odoo_instances WHERE is_active = 1 ORDER BY id').all()) {
    const conn = await quiet(async () => new OdooConnector(inst.url, inst.username, inst.api_key, inst.db_name));
    const oaIds = new Set(db.prepare('SELECT odoo_id FROM odoo_analytic_accounts WHERE instance_id = ?').all(inst.id).map(a => a.odoo_id));
    const companies = db.prepare(`
      SELECT c.id, c.name, c.short_name, c.odoo_company_id, sc.id AS sales_cid
      FROM companies c LEFT JOIN sales_companies sc ON sc.sales_company_id = c.odoo_company_id
      WHERE c.odoo_instance_id = ? AND c.is_active = 1 ORDER BY c.id
    `).all(inst.id);

    for (const co of companies) {
      const label = `co ${co.id} ${(co.short_name || co.name).slice(0, 40)}`;
      const lastSync = db.prepare(`SELECT MAX(started_at) t FROM sync_logs WHERE company_id = ? AND sync_type = 'full' AND status = 'completed'`).get(co.id).t;
      const lastSales = co.sales_cid ? (db.prepare(`SELECT MAX(started_at) t FROM sales_sync_logs WHERE company_id = ? AND status = 'completed'`).get(co.sales_cid) || {}).t : null;
      if (!lastSync) { check(`${label}: has a completed journal sync`, false, 'no completed sync'); continue; }
      const invCutoff = lastSales && lastSales < lastSync ? lastSales : lastSync;
      const ctxOdoo = { context: { allowed_company_ids: [co.odoo_company_id] } };
      const ctx = new AttributionContext(db, co.id);
      const stats = { combinations: 0 };

      // ---- 1. revenue / expense per cost center and year -------------------------------------
      const domain = [
        ['company_id', '=', co.odoo_company_id], ['parent_state', '=', 'posted'],
        ['date', '>=', from], ['date', '<=', to],
        ['display_type', 'not in', ['line_section', 'line_note']]
      ];
      const codes = overrideCodes.get(String(co.id)) || [];
      const typeDomain = ['|', ['account_id.account_type', '=like', 'income%'], ['account_id.account_type', '=like', 'expense%']];
      const fullDomain = codes.length
        ? [...domain, '|', '|', ['account_id.code', 'in', codes], ...typeDomain.slice(1)]
        : [...domain, ...typeDomain];
      const lines = await quiet(() => readAll(conn, 'account.move.line', fullDomain,
        ['balance', 'analytic_distribution', 'account_id', 'account_type', 'journal_id', 'move_name', 'move_id', 'date', 'write_date'], ctxOdoo));

      const odoo = new Map();
      const add = (m, k, field, v) => { if (!m.has(k)) m.set(k, { revenue: 0, expense: 0 }); m.get(k)[field] += v; };
      const odooIds = new Set();
      const staleIds = new Set();
      let staleCount = 0;
      const incomeByMove = new Map();
      for (const l of lines) {
        odooIds.add(l.id);
        const sec = sectionOf(overrides, co.id, accountCode(l.account_id), l.account_type);
        if (sec === 'income') {
          const mv = l.move_name;
          if (!incomeByMove.has(mv)) incomeByMove.set(mv, []);
          incomeByMove.get(mv).push(l);
        }
        if (sec !== 'income' && sec !== 'expense') continue;
        if (l.write_date && l.write_date > lastSync) { staleIds.add(l.id); staleCount++; continue; }
        const year = String(l.date).slice(0, 4);
        const amount = sec === 'income' ? -l.balance : l.balance;
        for (const p of odooParts(ctx, inst.id, oaIds, l, stats)) add(odoo, `${year}|${p.key}`, sec === 'income' ? 'revenue' : 'expense', amount * p.frac);
      }

      // app side: fact_daily minus the app's version of lines changed in Odoo after the sync
      const app = new Map();
      for (const r of db.prepare(`
        SELECT year, cost_center_key k, SUM(revenue) revenue, SUM(expense) expense
        FROM fact_daily WHERE company_id = ? AND date >= ? AND date <= ? GROUP BY 1, 2
      `).all(co.id, from, to)) app.set(`${r.year}|${r.k}`, { revenue: r.revenue, expense: r.expense });
      const dist = loadDistribution(db, co.id);
      let appChanged = 0;
      for (const l of db.prepare(`
        SELECT ji.odoo_line_id, ji.date, ji.analytic_account, ji.cost_center_id, ji.journal_id, ji.journal_name,
               ji.debit, ji.credit, ji.account_code, ji.account_type, o.section
        FROM journal_items ji
        LEFT JOIN account_section_overrides o ON o.company_id = ji.company_id AND o.account_code = ji.account_code
        WHERE ji.company_id = ? AND ji.move_state = 'posted' AND ji.date >= ? AND ji.date <= ?
      `).all(co.id, from, to)) {
        const sec = l.section || sectionOf(new Map(), co.id, '', l.account_type);
        if (sec !== 'income' && sec !== 'expense') continue;
        if (l.odoo_line_id && odooIds.has(l.odoo_line_id) && !staleIds.has(l.odoo_line_id)) continue;
        // not posted in Odoo any more, or written after the sync: remove the app's version
        appChanged++;
        const amount = sec === 'income' ? l.credit - l.debit : l.debit - l.credit;
        for (const p of ctx.lineParts(l, l.odoo_line_id ? dist.get(l.odoo_line_id) : undefined)) {
          add(app, `${String(l.date).slice(0, 4)}|${p.key}`, sec === 'income' ? 'revenue' : 'expense', -amount * p.frac);
        }
      }

      const diffs = [];
      const tot = { o: { revenue: 0, expense: 0 }, a: { revenue: 0, expense: 0 } };
      for (const k of new Set([...odoo.keys(), ...app.keys()])) {
        const o = odoo.get(k) || { revenue: 0, expense: 0 };
        const a = app.get(k) || { revenue: 0, expense: 0 };
        tot.o.revenue += o.revenue; tot.o.expense += o.expense; tot.a.revenue += a.revenue; tot.a.expense += a.expense;
        const dr = a.revenue - o.revenue, de = a.expense - o.expense;
        if (Math.abs(dr) > TOL || Math.abs(de) > TOL) diffs.push({ k, o, a, dr, de });
      }
      console.log(`\n── ${label} (last sync started ${lastSync} UTC)`);
      console.log(`   Odoo revenue ${fmt(tot.o.revenue)} expense ${fmt(tot.o.expense)} | app revenue ${fmt(tot.a.revenue)} expense ${fmt(tot.a.expense)} | excluded: ${staleCount} Odoo lines written after the sync, ${appChanged} app lines no longer posted/changed in Odoo${stats.combinations ? ` | ${stats.combinations} multi-plan distribution keys kept on the journal row` : ''}`);
      diffs.sort((x, y) => Math.abs(y.dr) + Math.abs(y.de) - Math.abs(x.dr) - Math.abs(x.de));
      for (const d of diffs.slice(0, 15)) {
        console.log(`     ${d.k}: revenue app ${fmt(d.a.revenue)} vs Odoo ${fmt(d.o.revenue)} (Δ ${fmt(d.dr)}) | expense app ${fmt(d.a.expense)} vs Odoo ${fmt(d.o.expense)} (Δ ${fmt(d.de)})`);
      }
      check(`${label}: revenue and expense per cost center × year = Odoo (distribution percentages)`, diffs.length === 0,
        `${diffs.length} (year, cost center) cells differ by more than 0.01`);

      // ---- 2. invoice attribution vs Odoo income-line distribution ----------------------------
      if (co.sales_cid) {
        const moves = await quiet(() => readAll(conn, 'account.move', [
          ['company_id', '=', co.odoo_company_id], ['state', '=', 'posted'],
          ['move_type', 'in', ['out_invoice', 'out_refund']], ['date', '>=', from], ['date', '<=', to]
        ], ['id', 'name', 'amount_untaxed_signed', 'journal_id', 'write_date'], ctxOdoo));
        const appShares = new Map();
        for (const s of db.prepare(`
          SELECT si.name, si.date, idp.cost_center_key k, idp.share FROM sales_invoices si
          JOIN invoice_departments idp ON idp.sales_invoice_id = si.id
          WHERE si.company_id = ? AND si.date >= ? AND si.date <= ?
        `).all(co.sales_cid, from, to)) {
          if (!appShares.has(s.name)) appShares.set(s.name, new Map());
          const m = appShares.get(s.name);
          m.set(s.k, (m.get(s.k) || 0) + s.share);
        }
        let compared = 0, excluded = 0, missing = 0;
        const bad = [];
        for (const mv of moves) {
          const incLines = incomeByMove.get(mv.name) || [];
          const changed = (mv.write_date && mv.write_date > invCutoff) || incLines.some(l => l.write_date && l.write_date > invCutoff);
          if (changed) { excluded++; continue; }
          const sh = appShares.get(mv.name);
          if (!sh) { missing++; continue; }
          compared++;
          const truth = new Map();
          let total = 0;
          for (const l of incLines) {
            const amt = Math.abs(l.balance);
            for (const p of odooParts(ctx, inst.id, oaIds, l, stats)) { truth.set(p.key, (truth.get(p.key) || 0) + amt * p.frac); total += amt * p.frac; }
          }
          const jId = Array.isArray(mv.journal_id) ? mv.journal_id[0] : mv.journal_id;
          let truthShares;
          if (total > 0) truthShares = new Map([...truth].map(([k, v]) => [k, v / total]));
          else if (truth.size > 0) truthShares = new Map([...truth.keys()].map(k => [k, 1 / truth.size]));
          else truthShares = new Map([[ctx.untaggedTarget(jId, '').key, 1]]);
          const amount = Math.abs(mv.amount_untaxed_signed || 0);
          let worst = 0;
          for (const k of new Set([...truthShares.keys(), ...sh.keys()])) {
            worst = Math.max(worst, Math.abs((sh.get(k) || 0) - (truthShares.get(k) || 0)) * amount);
          }
          if (worst > TOL) bad.push({ name: mv.name, worst, truthShares, sh });
        }
        bad.sort((x, y) => y.worst - x.worst);
        for (const b of bad.slice(0, 8)) {
          const show = (m) => [...m].map(([k, v]) => `${k} ${(v * 100).toFixed(2)}%`).join(', ');
          console.log(`     ${b.name}: Odoo ${show(b.truthShares)} | app ${show(b.sh)} (max Δ ${fmt(b.worst)} SAR)`);
        }
        check(`${label}: invoice attribution = Odoo income-line distribution`, bad.length === 0,
          `${compared} invoices compared, ${bad.length} differ; excluded ${excluded} changed after the sync, ${missing} not yet in the app`);
      }
    }
  }

  // ---- 3. collections follow their invoice --------------------------------------------------
  const notOwn = db.prepare(`
    SELECT COUNT(*) n, COALESCE(SUM(a), 0) amt FROM (
      SELECT pa.sales_company_id s, pa.invoice_id i, pa.department_id d, pa.cost_center_key k, SUM(pa.amount) a
      FROM payment_allocations pa
      WHERE pa.invoice_id > 0
        AND EXISTS (SELECT 1 FROM sales_invoices si JOIN invoice_departments x ON x.sales_invoice_id = si.id
                    WHERE si.company_id = pa.sales_company_id AND si.invoice_id = pa.invoice_id)
        AND NOT EXISTS (SELECT 1 FROM sales_invoices si JOIN invoice_departments x ON x.sales_invoice_id = si.id
                    WHERE si.company_id = pa.sales_company_id AND si.invoice_id = pa.invoice_id
                      AND x.cost_center_key = pa.cost_center_key AND x.department_id = pa.department_id)
      GROUP BY 1, 2, 3, 4)
  `).get();
  console.log('');
  check('every payment allocation key ∈ its invoice\'s (department, cost center) keys', notOwn.n === 0,
    `${notOwn.n} allocation groups (${fmt(notOwn.amt)} SAR) on a key their invoice does not carry`);

  // ---- 4. decisions still pending (printed, never hidden) ------------------------------------
  const pending = getAttributionConflicts(db);
  console.log(`\n── Ambiguities waiting for a user decision: ${pending.journals.length} journals, ${pending.analytics.length} analytic accounts in >1 department, ${pending.combinations.length} companies with multi-plan keys`);
  for (const j of pending.journals) {
    const ledger = (j.ledger_by_year || []).filter(y => Math.abs(y.revenue) > TOL || Math.abs(y.expense) > TOL)
      .map(y => `${y.year}: rev ${fmt(y.revenue)} exp ${fmt(y.expense)}`).join('; ');
    console.log(`   co ${j.company_id} ${j.journal_name} (${j.cost_center_key}) — ${j.kind === 'department' ? '>1 department' : '>1 cost center'}: departments [${j.candidate_departments.map(d => d.name).join(' / ')}], ${j.candidate_analytics.length} candidate cost centers, default now: ${j.current_default && j.current_default.group_name ? j.current_default.group_name + ' (seeded)' : 'none'} | invoices on the journal row: ${j.invoices} (${fmt(j.invoices_untaxed)} untaxed)${ledger ? ' | untagged ledger ' + ledger : ''}`);
  }
  for (const a of pending.analytics) console.log(`   co ${a.company_id} analytic «${a.analytic_account}» → ${a.departments.map(d => d.name).join(' / ')}`);

  console.log('\n================================================================');
  console.log(failures === 0 ? '✅ verify:odoo — ALL CHECKS PASSED' : `❌ verify:odoo — ${failures} CHECK(S) FAILED`);
  console.log('================================================================');
  process.exit(failures === 0 ? 0 : 1);
}

run().catch(err => {
  console.log = realLog;
  console.error('verify:odoo fatal error:', err.message);
  process.exit(1);
});
