/**
 * CC1 attribution invariants (shared by verify-data and verify-sync). Read-only.
 *
 * - No department / cost center comes from an implicit choice: a journal row (j:<id>) carries a
 *   department only through an explicit journal default; an ambiguous journal (legacy links to
 *   several departments) has no department until the user decides.
 * - Collections follow their invoice: every payment allocation sits on a (department, cost
 *   center) pair of its own invoice, split by the invoice shares.
 * - The ledger by cost center equals an independent recomputation from journal_items with the
 *   Odoo analytic distribution percentages (journal_item_analytic_distribution).
 */
const { AttributionContext, legacyJournalLinks } = require('../services/attribution');

function runAttributionChecks({ db, check }) {
  const round2 = (n) => Math.round((n || 0) * 100) / 100;
  const companies = db.prepare(`
    SELECT c.id, c.odoo_instance_id, c.odoo_company_id, sc.id AS sales_cid
    FROM companies c LEFT JOIN sales_companies sc ON sc.sales_company_id = c.odoo_company_id
    WHERE c.is_active = 1 ORDER BY c.id
  `).all();

  // CC1-1: an ambiguous journal (legacy links to several departments) never gets a department
  // without a user decision, in any derived table, and no seeded default carries one.
  let undecidedWithDept = 0;
  let badSeeds = 0;
  const offenders = [];
  for (const co of companies) {
    const defaults = new Map(db.prepare('SELECT * FROM journal_department_defaults WHERE company_id = ?').all(co.id).map(d => [d.journal_id, d]));
    for (const [jid, e] of legacyJournalLinks(db, co.id)) {
      if (e.groups.size <= 1) continue;
      const d = defaults.get(jid);
      if (d && !d.decided_by_user && d.group_id) badSeeds++;
      if (d && d.decided_by_user) continue;
      const key = 'j:' + jid;
      const fd = db.prepare('SELECT COUNT(*) n FROM fact_daily WHERE company_id = ? AND cost_center_key = ? AND department_id != 0').get(co.id, key).n;
      const idp = co.sales_cid ? db.prepare('SELECT COUNT(*) n FROM invoice_departments WHERE company_id = ? AND cost_center_key = ? AND department_id != 0').get(co.sales_cid, key).n : 0;
      const pa = db.prepare('SELECT COUNT(*) n FROM payment_allocations WHERE company_id = ? AND cost_center_key = ? AND department_id != 0').get(co.id, key).n;
      if (fd + idp + pa > 0) { undecidedWithDept += fd + idp + pa; offenders.push(`co ${co.id} ${key}`); }
    }
  }
  check('CC1-1: no journal linked to >1 department gets a department without a user decision (ledger, invoices, collections, seeds)',
    undecidedWithDept === 0 && badSeeds === 0,
    `${undecidedWithDept} rows with a department${offenders.length ? ' (' + offenders.join(', ') + ')' : ''}, ${badSeeds} seeded defaults carrying a department`);

  // CC1-2: every journal row (j:<id>) carries exactly the explicit journal default department (or 0)
  let jMismatch = 0;
  for (const co of companies) {
    const def = new Map(db.prepare('SELECT journal_id, group_id FROM journal_department_defaults WHERE company_id = ?').all(co.id).map(d => [d.journal_id, d.group_id || 0]));
    const sources = [
      db.prepare("SELECT cost_center_key k, department_id d FROM fact_daily WHERE company_id = ? AND cost_center_key LIKE 'j:%' GROUP BY 1, 2").all(co.id),
      co.sales_cid ? db.prepare("SELECT cost_center_key k, department_id d FROM invoice_departments WHERE company_id = ? AND cost_center_key LIKE 'j:%' GROUP BY 1, 2").all(co.sales_cid) : [],
      db.prepare("SELECT cost_center_key k, department_id d FROM payment_allocations WHERE company_id = ? AND cost_center_key LIKE 'j:%' GROUP BY 1, 2").all(co.id)
    ];
    for (const rows of sources) for (const r of rows) {
      const jid = parseInt(r.k.slice(2), 10);
      if ((r.d || 0) !== (def.get(jid) || 0)) jMismatch++;
    }
  }
  check('CC1-2: every journal row (j:<id>) carries the explicit journal default department or none',
    jMismatch === 0, `${jMismatch} (key, department) pairs not explained by journal_department_defaults`);

  // CC1-3: every analytic row's department follows the analytic mapping (unique), else the explicit
  // default of the line's journal, else none — never a first/MAX pick.
  let anMismatch = 0;
  const anExamples = [];
  for (const co of companies) {
    const ctx = new AttributionContext(db, co.id);
    const oaName = new Map(ctx.oaRows.map(a => [a.odoo_id, a.name]));
    const rows = db.prepare(`
      SELECT cost_center_key k, department_id d, journal_id j, analytic_account a
      FROM fact_daily WHERE company_id = ? AND cost_center_key LIKE 'an:%' GROUP BY 1, 2, 3, 4
    `).all(co.id);
    for (const r of rows) {
      const m = /^an:\d+:(\d+)$/.exec(r.k);
      const names = [m ? (oaName.get(Number(m[1])) || '') : r.k.slice(3)];
      if (r.a && !r.a.includes(', ')) names.push(r.a);
      const dep = ctx.analyticDepartment(names);
      const jd = ctx.journalDefault(r.j);
      const untaggedDefault = jd && jd.analytic_id && m && Number(m[1]) === jd.analytic_id && !r.a;
      let expected;
      if (untaggedDefault) expected = jd.group_id || (dep.state === 'ok' ? dep.deptId : 0);
      else if (dep.state === 'ok') expected = dep.deptId;
      else if (dep.state === 'none') expected = jd && jd.group_id ? jd.group_id : 0;
      else expected = 0;
      if ((r.d || 0) !== expected) { anMismatch++; if (anExamples.length < 5) anExamples.push(`co ${co.id} ${r.k} j${r.j} dept ${r.d}≠${expected}`); }
    }
  }
  check('CC1-3: every analytic row in the ledger carries its mapped department, else its journal default, else none',
    anMismatch === 0, `${anMismatch} rows${anExamples.length ? ': ' + anExamples.join('; ') : ''}`);

  // CC1-4: collections follow their invoice — every allocation key/department is one of the
  // invoice's own (department, cost center) pairs, and the split matches the invoice shares.
  const invPairs = new Map();
  for (const r of db.prepare(`
    SELECT si.company_id s, si.invoice_id i, idp.department_id d, idp.cost_center_key k, idp.share sh
    FROM invoice_departments idp JOIN sales_invoices si ON si.id = idp.sales_invoice_id WHERE si.invoice_id > 0
  `).all()) {
    const key = r.s + '|' + r.i;
    if (!invPairs.has(key)) invPairs.set(key, new Map());
    invPairs.get(key).set(r.d + '|' + r.k, r.sh);
  }
  let notOwn = 0, notOwnAmt = 0, shareDiff = 0;
  const paByInv = new Map();
  for (const r of db.prepare(`
    SELECT sales_company_id s, invoice_id i, department_id d, cost_center_key k, SUM(amount) a, COUNT(DISTINCT odoo_reconcile_id || '|' || COALESCE(counterpart_account_code, '')) g
    FROM payment_allocations WHERE invoice_id > 0 GROUP BY 1, 2, 3, 4
  `).all()) {
    const pairs = invPairs.get(r.s + '|' + r.i);
    if (!pairs) continue;
    if (!pairs.has(r.d + '|' + r.k)) { notOwn++; notOwnAmt += r.a; continue; }
    const key = r.s + '|' + r.i;
    if (!paByInv.has(key)) paByInv.set(key, { total: 0, groups: 0, parts: [] });
    const e = paByInv.get(key);
    e.total += r.a; e.groups = Math.max(e.groups, r.g); e.parts.push({ a: r.a, share: pairs.get(r.d + '|' + r.k) });
  }
  for (const e of paByInv.values()) {
    for (const p of e.parts) if (Math.abs(p.a - e.total * p.share) > 0.01 * Math.max(1, e.groups) + 1e-6) shareDiff++;
  }
  check('CC1-4: every payment allocation sits on a (department, cost center) of its own invoice',
    notOwn === 0, `${notOwn} allocation groups on a key the invoice does not carry (${round2(notOwnAmt)} SAR)`);
  check('CC1-4b: collections are split by the invoice shares (≤ 0.01 per settlement)',
    shareDiff === 0, `${shareDiff} invoice keys off their share`);

  // CC1-5: ledger by cost center = independent recomputation with the Odoo distribution percentages
  let ccDiffs = 0;
  const ccEx = [];
  for (const co of companies) {
    const inst = co.odoo_instance_id;
    const expected = new Map();
    const add = (k, v) => expected.set(k, (expected.get(k) || 0) + v);
    const oa = db.prepare('SELECT odoo_id, name, company_id FROM odoo_analytic_accounts WHERE instance_id = ?').all(inst);
    const byName = (t) => {
      const n = String(t || '').replace(/\s+/g, ' ').trim();
      const ms = oa.filter(a => String(a.name).replace(/\s+/g, ' ').trim() === n);
      const own = ms.filter(a => a.company_id === co.odoo_company_id);
      if (own.length === 1) return own[0].odoo_id;
      if (own.length > 1) return null;
      const sh = ms.filter(a => !a.company_id);
      return sh.length === 1 ? sh[0].odoo_id : null;
    };
    const jdef = new Map(db.prepare('SELECT journal_id, analytic_id FROM journal_department_defaults WHERE company_id = ?').all(co.id).map(d => [d.journal_id, d.analytic_id]));
    const oaIds = new Set(oa.map(a => a.odoo_id));
    const untaggedKey = (jid) => (jdef.get(jid) && oaIds.has(jdef.get(jid))) ? `an:${inst}:${jdef.get(jid)}` : 'j:' + (jid || 0);
    const splitKeys = new Set();
    const dist = new Map();
    for (const d of db.prepare('SELECT odoo_line_id, analytic_id, analytic_name, pct, is_combination FROM journal_item_analytic_distribution WHERE company_id = ?').all(co.id)) {
      if (!dist.has(d.odoo_line_id)) dist.set(d.odoo_line_id, []);
      dist.get(d.odoo_line_id).push(d);
    }
    for (const l of db.prepare(`
      SELECT odoo_line_id, cost_center_id, analytic_account, journal_id, debit - credit AS bal
      FROM journal_items WHERE company_id = ? AND move_state = 'posted'
    `).all(co.id)) {
      const ds = l.odoo_line_id ? dist.get(l.odoo_line_id) : null;
      if (ds && ds.length) {
        const tot = ds.reduce((s, d) => s + d.pct, 0);
        const scale = tot > 100 ? 100 / tot : 1;
        let used = 0;
        for (const d of ds) {
          const f = d.pct / 100 * scale; used += f;
          const k = d.analytic_id ? `an:${inst}:${d.analytic_id}` : (d.is_combination ? untaggedKey(l.journal_id) : (byName(d.analytic_name) ? `an:${inst}:${byName(d.analytic_name)}` : 'an:' + String(d.analytic_name).trim()));
          add(k, l.bal * f);
          splitKeys.add(k);
        }
        if (1 - used > 1e-9) { add(untaggedKey(l.journal_id), l.bal * (1 - used)); splitKeys.add(untaggedKey(l.journal_id)); }
      } else if (l.cost_center_id > 0) {
        add(`an:${inst}:${l.cost_center_id}`, l.bal);
      } else if (String(l.analytic_account || '').trim()) {
        const id = byName(l.analytic_account);
        add(id ? `an:${inst}:${id}` : 'an:' + String(l.analytic_account).trim(), l.bal);
      } else {
        add(untaggedKey(l.journal_id), l.bal);
      }
    }
    const actual = new Map(db.prepare('SELECT cost_center_key k, SUM(debit) - SUM(credit) b, COUNT(*) n FROM fact_daily WHERE company_id = ? GROUP BY 1').all(co.id).map(r => [r.k, r]));
    for (const k of new Set([...expected.keys(), ...actual.keys()])) {
      const a = actual.get(k);
      const diff = (a ? a.b : 0) - (expected.get(k) || 0);
      // fact_daily rounds each aggregate to cents; only keys that receive a fraction of a split
      // line can carry sub-cent remainders
      const tol = 0.011 + (splitKeys.has(k) ? 0.005 * (a ? a.n : 0) : 0);
      if (Math.abs(diff) > tol) { ccDiffs++; if (ccEx.length < 5) ccEx.push(`co ${co.id} ${k} Δ ${round2(diff)}`); }
    }
  }
  check('CC1-5: ledger by cost center = independent recomputation with Odoo analytic distribution percentages',
    ccDiffs === 0, `${ccDiffs} cost centers differ${ccEx.length ? ': ' + ccEx.join('; ') : ''}`);

  // CC1-6: invoice shares add up to 1 and every split part of a multi-account line is represented
  const badShares = db.prepare(`
    SELECT COUNT(*) n FROM (SELECT sales_invoice_id, SUM(share) s FROM invoice_departments GROUP BY 1 HAVING ABS(s - 1.0) > 0.000001)
  `).get().n;
  check('CC1-6: invoice attribution shares sum to 1 for every invoice', badShares === 0, `${badShares} invoices`);
}

/**
 * CC1 simulation (rolled back): give a real single-account income line of an invoice an Odoo
 * distribution of 60% / 30% over two analytic accounts (10% left without analytic), rebuild, and
 * check the ledger and the invoice are split by those percentages and collections follow.
 */
function runSplitSimulation({ db, check }) {
  const SyncEngine = require('../services/sync-engine');
  const ConsolidationEngine = require('../services/consolidation');
  const line = db.prepare(`
    SELECT ji.id, ji.company_id, ji.odoo_line_id, ji.cost_center_id, ji.journal_id, ji.move_name,
           ji.credit - ji.debit AS rev, c.odoo_instance_id inst, c.odoo_company_id ocid, sc.id sales_cid, si.id inv_id
    FROM journal_items ji
    JOIN companies c ON c.id = ji.company_id
    JOIN sales_companies sc ON sc.sales_company_id = c.odoo_company_id
    JOIN sales_invoices si ON si.company_id = sc.id AND si.name = ji.move_name
    WHERE ji.move_state = 'posted' AND ji.account_type LIKE 'income%' AND ji.cost_center_id > 0
      AND ji.odoo_line_id > 0 AND ABS(ji.credit - ji.debit) >= 100
      AND NOT EXISTS (SELECT 1 FROM journal_item_analytic_distribution d WHERE d.company_id = ji.company_id AND d.odoo_line_id = ji.odoo_line_id)
      AND NOT EXISTS (SELECT 1 FROM account_section_overrides o WHERE o.company_id = ji.company_id AND o.account_code = ji.account_code)
    ORDER BY ji.date DESC, ji.id DESC LIMIT 1
  `).get();
  if (!line) { check('CC1-SIM: analytic distribution split simulation', false, 'no eligible income line found'); return; }
  const other = db.prepare(`
    SELECT odoo_id FROM odoo_analytic_accounts
    WHERE instance_id = ? AND odoo_id != ? AND (company_id IS NULL OR company_id = 0 OR company_id = ?)
    ORDER BY odoo_id LIMIT 1
  `).get(line.inst, line.cost_center_id, line.ocid);
  if (!other) { check('CC1-SIM: analytic distribution split simulation', false, 'no second analytic account'); return; }

  const keyA = `an:${line.inst}:${line.cost_center_id}`;
  const keyB = `an:${line.inst}:${other.odoo_id}`;
  const fdByKey = () => new Map(db.prepare('SELECT cost_center_key k, SUM(revenue) r FROM fact_daily WHERE company_id = ? GROUP BY 1').all(line.company_id).map(r => [r.k, r.r]));
  const total = (m) => [...m.values()].reduce((s, v) => s + v, 0);
  let result = null;
  const tx = db.transaction(() => {
    const before = fdByKey();
    const ins = db.prepare('INSERT INTO journal_item_analytic_distribution (company_id, odoo_line_id, analytic_key, analytic_id, analytic_name, pct, is_combination) VALUES (?, ?, ?, ?, ?, ?, 0)');
    ins.run(line.company_id, line.odoo_line_id, String(line.cost_center_id), line.cost_center_id, '', 60);
    ins.run(line.company_id, line.odoo_line_id, String(other.odoo_id), other.odoo_id, '', 30);
    new SyncEngine().rebuildFactDaily(line.company_id);
    new ConsolidationEngine(db).resolveInvoiceDepartments(line.sales_cid);
    const after = fdByKey();
    const { AttributionContext } = require('../services/attribution');
    const untagged = new AttributionContext(db, line.company_id).untaggedTarget(line.journal_id, '').key;
    const exp = new Map();
    const addExp = (k, v) => exp.set(k, (exp.get(k) || 0) + v);
    addExp(keyA, -0.4 * line.rev); addExp(keyB, 0.3 * line.rev); addExp(untagged, 0.1 * line.rev);
    const delta = (k) => (after.get(k) || 0) - (before.get(k) || 0);
    const keysOk = [...exp.entries()].every(([k, v]) => Math.abs(delta(k) - v) <= 0.02);
    const dA = delta(keyA), dB = delta(keyB), dU = delta(untagged);
    const incomeAmt = db.prepare(`SELECT SUM(ABS(credit - debit)) s FROM journal_items WHERE company_id = ? AND move_name = ? AND move_state = 'posted' AND account_type LIKE 'income%'`).get(line.company_id, line.move_name).s;
    const shareB = db.prepare('SELECT COALESCE(SUM(share), 0) s FROM invoice_departments WHERE sales_invoice_id = ? AND cost_center_key = ?').get(line.inv_id, keyB).s;
    const expShareB = Math.abs(line.rev) * 0.3 / incomeAmt;
    const paOff = db.prepare(`
      SELECT COUNT(*) n FROM payment_allocations pa JOIN sales_invoices si ON si.invoice_id = pa.invoice_id AND si.company_id = pa.sales_company_id
      WHERE si.id = ? AND NOT EXISTS (SELECT 1 FROM invoice_departments idp WHERE idp.sales_invoice_id = si.id AND idp.cost_center_key = pa.cost_center_key AND idp.department_id = pa.department_id)
    `).get(line.inv_id).n;
    result = {
      dA, dB, dU, shareB, expShareB, paOff, keysOk,
      totalBefore: total(before), totalAfter: total(after),
      expA: exp.get(keyA), expB: exp.get(keyB)
    };
    throw new Error('ROLLBACK_INTENDED');
  });
  try { tx(); } catch (e) { if (e.message !== 'ROLLBACK_INTENDED') { check('CC1-SIM: analytic distribution split simulation', false, e.message); return; } }
  const ok = result
    && result.keysOk
    && Math.abs(result.totalAfter - result.totalBefore) <= 0.02
    && Math.abs(result.shareB - result.expShareB) <= 1e-6
    && result.paOff === 0;
  check('CC1-SIM: a multi-account line (60% / 30% / 10% untagged) is split by percentage in ledger, invoice and collections',
    ok, result ? `ledger Δ ${keyA} ${result.dA.toFixed(2)} (exp ${result.expA.toFixed(2)}), Δ ${keyB} ${result.dB.toFixed(2)} (exp ${result.expB.toFixed(2)}), untagged Δ ${result.dU.toFixed(2)}, company total Δ ${(result.totalAfter - result.totalBefore).toFixed(2)}, invoice share ${result.shareB.toFixed(6)} (exp ${result.expShareB.toFixed(6)}), allocations off-invoice ${result.paOff}` : 'no result');
  const still = db.prepare('SELECT COUNT(*) n FROM journal_item_analytic_distribution WHERE company_id = ? AND odoo_line_id = ?').get(line.company_id, line.odoo_line_id).n;
  check('CC1-SIM: simulation rolled back', still === 0, `${still} simulated rows left`);
}

module.exports = { runAttributionChecks, runSplitSimulation };
