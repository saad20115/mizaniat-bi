/**
 * CC1: Cost-center and department attribution — one resolver for the ledger (fact_daily),
 * invoices (invoice_departments) and collections (payment_allocations).
 *
 * Binding rule: the code never resolves an ambiguity by itself. A department or a cost
 * center is assigned only when it follows from Odoo data (the line's analytic distribution)
 * or from an explicit setting:
 *   - analytic_group_mapping: analytic account -> department (per company)
 *   - journal_department_defaults: journal -> department and/or default cost center for the
 *     journal's lines that carry no analytic account
 * Anything else stays on its own row (j:<journal id>) with department 0, and is listed in
 * getAttributionConflicts() as «تعارضات تحتاج قرارًا».
 */

const UNTAGGED_SUFFIX = ' — بدون مركز تكلفة';
const SEED_MARKER = 'cc1_journal_defaults_seeded';

const norm = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

/**
 * Legacy journal links stored on analytic mapping rows (analytic_group_mapping.journal_id /
 * journal_name). They no longer drive attribution; they are read only to seed the explicit
 * journal defaults once and to list the candidates of an ambiguous journal.
 * Returns Map(journal_id -> { analytics: Set(name), groups: Set(group_id), names: Set(journal name) }).
 */
function legacyJournalLinks(db, companyId) {
  const rows = db.prepare(`
    SELECT journal_id, journal_name, analytic_account, group_id
    FROM analytic_group_mapping
    WHERE company_id = ?
      AND ((journal_id IS NOT NULL AND journal_id > 0) OR TRIM(COALESCE(journal_name, '')) != '')
  `).all(companyId);
  const byName = new Map();
  for (const j of db.prepare('SELECT odoo_journal_id, name FROM odoo_journals WHERE company_id = ?').all(companyId)) {
    const k = norm(j.name);
    if (!byName.has(k)) byName.set(k, new Set());
    byName.get(k).add(j.odoo_journal_id);
  }
  const out = new Map();
  for (const r of rows) {
    let jid = r.journal_id > 0 ? r.journal_id : null;
    if (!jid) {
      // name-only legacy link: usable only when the name designates exactly one journal
      const ids = byName.get(norm(r.journal_name));
      if (ids && ids.size === 1) jid = [...ids][0];
    }
    if (!jid) continue;
    if (!out.has(jid)) out.set(jid, { analytics: new Set(), groups: new Set(), names: new Set() });
    const e = out.get(jid);
    const a = norm(r.analytic_account);
    if (a) e.analytics.add(a);
    if (r.group_id) e.groups.add(r.group_id);
    if (norm(r.journal_name)) e.names.add(norm(r.journal_name));
  }
  return out;
}

/** Resolve an analytic account name to its Odoo id for a company, only when unambiguous. */
function resolveAnalyticIdByName(oaRows, odooCompanyId, name) {
  const n = norm(name);
  if (!n) return null;
  const matches = oaRows.filter(a => norm(a.name) === n);
  const own = matches.filter(a => a.company_id === odooCompanyId);
  if (own.length === 1) return own[0].odoo_id;
  if (own.length > 1) return null;
  const shared = matches.filter(a => !a.company_id);
  return shared.length === 1 ? shared[0].odoo_id : null;
}

/**
 * One-time, idempotent seed of journal_department_defaults from the legacy journal links,
 * restricted to links that are unambiguous so that numbers do not move where there is no
 * conflict: a single department -> seeded department; a single analytic account -> seeded
 * default cost center. Journals with several departments or several analytic accounts get no
 * seed for that part; they are listed as conflicts until the user decides.
 */
function seedJournalDefaults(db) {
  const done = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(SEED_MARKER);
  if (done) return 0;
  const ins = db.prepare(`
    INSERT OR IGNORE INTO journal_department_defaults
      (company_id, journal_id, group_id, analytic_id, analytic_account, decided_by_user, source)
    VALUES (?, ?, ?, ?, ?, 0, 'seed')
  `);
  let seeded = 0;
  db.transaction(() => {
    for (const co of db.prepare('SELECT id, odoo_instance_id, odoo_company_id FROM companies').all()) {
      const oaRows = db.prepare('SELECT odoo_id, name, company_id FROM odoo_analytic_accounts WHERE instance_id = ?').all(co.odoo_instance_id);
      for (const [jid, e] of legacyJournalLinks(db, co.id)) {
        const groupId = e.groups.size === 1 ? [...e.groups][0] : null;
        let analyticId = null;
        let analyticName = null;
        if (e.analytics.size === 1) {
          analyticName = [...e.analytics][0];
          analyticId = resolveAnalyticIdByName(oaRows, co.odoo_company_id, analyticName);
        }
        if (groupId === null && analyticId === null) continue;
        seeded += ins.run(co.id, jid, groupId, analyticId, analyticId ? analyticName : null).changes;
      }
    }
    db.prepare(`INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))`)
      .run(SEED_MARKER, String(seeded));
  })();
  return seeded;
}

class AttributionContext {
  constructor(db, ledgerCompanyId) {
    this.db = db;
    this.companyId = ledgerCompanyId;
    const co = db.prepare('SELECT id, odoo_instance_id, odoo_company_id FROM companies WHERE id = ?').get(ledgerCompanyId);
    this.instanceId = co ? co.odoo_instance_id : null;
    this.odooCompanyId = co ? co.odoo_company_id : null;

    this.oaRows = this.instanceId
      ? db.prepare('SELECT odoo_id, name, company_id FROM odoo_analytic_accounts WHERE instance_id = ?').all(this.instanceId)
      : [];
    this.oaById = new Map(this.oaRows.map(a => [a.odoo_id, a]));
    this._nameIdCache = new Map();

    // analytic account name -> set of departments (more than one = conflict)
    this.deptByName = new Map();
    for (const m of db.prepare(`
      SELECT analytic_account, group_id FROM analytic_group_mapping
      WHERE company_id = ? AND TRIM(COALESCE(analytic_account, '')) != '' AND group_id IS NOT NULL
    `).all(ledgerCompanyId)) {
      const k = norm(m.analytic_account);
      if (!this.deptByName.has(k)) this.deptByName.set(k, new Set());
      this.deptByName.get(k).add(m.group_id);
    }

    this.journalDefaults = new Map();
    for (const d of db.prepare('SELECT * FROM journal_department_defaults WHERE company_id = ?').all(ledgerCompanyId)) {
      this.journalDefaults.set(d.journal_id, d);
    }
    this.legacy = legacyJournalLinks(db, ledgerCompanyId);
  }

  analyticIdByName(name) {
    const k = norm(name);
    if (!this._nameIdCache.has(k)) this._nameIdCache.set(k, resolveAnalyticIdByName(this.oaRows, this.odooCompanyId, k));
    return this._nameIdCache.get(k);
  }

  /** Department of an analytic account: { state: 'ok'|'none'|'conflict', deptId, candidates } */
  analyticDepartment(names) {
    const groups = new Set();
    for (const n of names) {
      const s = this.deptByName.get(norm(n));
      if (s) for (const g of s) groups.add(g);
    }
    if (groups.size === 1) return { state: 'ok', deptId: [...groups][0], candidates: [...groups] };
    return { state: groups.size === 0 ? 'none' : 'conflict', deptId: 0, candidates: [...groups] };
  }

  /** A journal whose legacy links point to several analytics or departments (needs a decision). */
  isFlaggedJournal(journalId) {
    const e = this.legacy.get(journalId);
    return !!e && (e.analytics.size > 1 || e.groups.size > 1);
  }

  journalDefault(journalId) {
    return this.journalDefaults.get(journalId) || null;
  }

  _journalDept(journalId) {
    const d = this.journalDefault(journalId);
    return d && d.group_id ? d.group_id : 0;
  }

  /** Target for an analytic account known by its Odoo id (text is the name carried by the line). */
  analyticTargetById(analyticId, text, journalId, journalName) {
    const oa = this.oaById.get(analyticId);
    const name = oa ? oa.name : ((journalName || '').trim() || 'بدون دفتر');
    const dep = this.analyticDepartment([oa ? oa.name : '', text || '']);
    return {
      key: `an:${this.instanceId}:${analyticId}`,
      name,
      analytic: oa ? oa.name : norm(text),
      deptId: dep.state === 'ok' ? dep.deptId : (dep.state === 'none' ? this._journalDept(journalId) : 0)
    };
  }

  /** Target for an analytic account known only by its name (no Odoo id on the line). */
  analyticTargetByName(text, journalId) {
    const t = String(text || '').trim();
    const id = this.analyticIdByName(t);
    const oa = id ? this.oaById.get(id) : null;
    const dep = this.analyticDepartment([t, oa ? oa.name : '']);
    return {
      key: id ? `an:${this.instanceId}:${id}` : `an:${t}`,
      name: t,
      analytic: t,
      deptId: dep.state === 'ok' ? dep.deptId : (dep.state === 'none' ? this._journalDept(journalId) : 0)
    };
  }

  /** Target for amounts without an analytic account: the journal's explicit default, else its own row. */
  untaggedTarget(journalId, journalName) {
    const jId = journalId || 0;
    const d = this.journalDefault(jId);
    if (d && d.analytic_id && this.oaById.has(d.analytic_id)) {
      const oa = this.oaById.get(d.analytic_id);
      let deptId = d.group_id || 0;
      if (!deptId) {
        const dep = this.analyticDepartment([oa.name]);
        deptId = dep.state === 'ok' ? dep.deptId : 0;
      }
      return { key: `an:${this.instanceId}:${d.analytic_id}`, name: oa.name, analytic: '', deptId };
    }
    const base = (journalName || '').trim() || (jId ? `دفتر ${jId}` : 'بدون دفتر');
    return {
      key: 'j:' + jId,
      name: this.isFlaggedJournal(jId) ? base + UNTAGGED_SUFFIX : base,
      analytic: '',
      deptId: d && d.group_id ? d.group_id : 0
    };
  }

  /**
   * Split one journal line into attribution parts [{ key, name, analytic, deptId, frac }].
   * line: { analytic_account, cost_center_id, journal_id, journal_name }
   * dist: rows of journal_item_analytic_distribution for that line (only lines whose Odoo
   *       distribution is not a single account at 100%), or undefined.
   * journal: optional { journalId, journalName } overriding the line's journal context.
   */
  lineParts(line, dist, journal) {
    const jId = journal ? journal.journalId : line.journal_id;
    const jName = journal ? journal.journalName : line.journal_name;
    if (dist && dist.length > 0) {
      const total = dist.reduce((s, d) => s + (Number(d.pct) || 0), 0);
      const scale = total > 100 ? 100 / total : 1;
      const parts = [];
      let used = 0;
      for (const d of dist) {
        const frac = (Number(d.pct) || 0) / 100 * scale;
        if (!frac) continue;
        used += frac;
        let t;
        if (d.analytic_id) t = this.analyticTargetById(d.analytic_id, d.analytic_name, jId, jName);
        else if (d.is_combination) t = { ...this.untaggedTarget(jId, jName), ambiguousCombination: true };
        else t = this.analyticTargetByName(d.analytic_name, jId);
        parts.push({ ...t, frac });
      }
      const rest = 1 - used;
      if (rest > 1e-9) parts.push({ ...this.untaggedTarget(jId, jName), frac: rest });
      if (parts.length > 0) return parts;
    }
    if (line.cost_center_id && line.cost_center_id > 0) {
      return [{ ...this.analyticTargetById(line.cost_center_id, line.analytic_account, jId, jName), frac: 1 }];
    }
    if (String(line.analytic_account || '').trim()) {
      return [{ ...this.analyticTargetByName(line.analytic_account, jId), frac: 1 }];
    }
    return [{ ...this.untaggedTarget(jId, jName), frac: 1 }];
  }
}

/** Distribution rows of a company keyed by odoo_line_id. */
function loadDistribution(db, companyId) {
  const map = new Map();
  for (const r of db.prepare(`
    SELECT odoo_line_id, analytic_key, analytic_id, analytic_name, pct, is_combination
    FROM journal_item_analytic_distribution WHERE company_id = ? ORDER BY odoo_line_id, analytic_key
  `).all(companyId)) {
    if (!map.has(r.odoo_line_id)) map.set(r.odoo_line_id, []);
    map.get(r.odoo_line_id).push(r);
  }
  return map;
}

/**
 * Parse an Odoo analytic_distribution object into rows to persist. Only lines whose
 * distribution is not exactly one account at 100% are stored: those are the lines that
 * must be split; single-account lines are fully described by journal_items.cost_center_id.
 */
function distributionRows(distribution, analyticMap) {
  if (!distribution || typeof distribution !== 'object') return [];
  const entries = Object.entries(distribution);
  if (entries.length === 0) return [];
  const single = entries.length === 1 && !String(entries[0][0]).includes(',') && Math.abs(Number(entries[0][1]) - 100) < 1e-9;
  if (single) return [];
  return entries.map(([k, pct]) => {
    const ids = String(k).split(',').map(s => s.trim()).filter(Boolean);
    const isCombination = ids.length > 1 ? 1 : 0;
    const id = !isCombination && analyticMap && analyticMap[ids[0]] !== undefined ? (parseInt(ids[0], 10) || null) : null;
    const name = isCombination
      ? ids.map(i => (analyticMap && analyticMap[i]) || i).join(' + ')
      : String((analyticMap && analyticMap[ids[0]]) || ids[0] || '').trim();
    return { analytic_key: String(k), analytic_id: id, analytic_name: name, pct: Number(pct) || 0, is_combination: isCombination };
  });
}

/** Split an amount (2 decimals) by shares so that the parts add up exactly to the amount. */
function splitAmount(total, shares) {
  const cents = Math.round((Number(total) || 0) * 100);
  const sumShares = shares.reduce((s, x) => s + x, 0) || 1;
  const raw = shares.map(s => cents * s / sumShares);
  const out = raw.map(v => Math.trunc(v));
  let rest = cents - out.reduce((s, v) => s + v, 0);
  const order = raw.map((v, i) => ({ i, frac: Math.abs(v - Math.trunc(v)) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  const step = rest >= 0 ? 1 : -1;
  for (let k = 0; rest !== 0 && order.length > 0; k = (k + 1) % order.length) {
    out[order[k].i] += step;
    rest -= step;
  }
  return out.map(c => c / 100);
}

/**
 * Collections follow their invoice: re-derive payment_allocations department / cost center
 * from the invoice's current invoice_departments, keeping every (reconcile, counterpart)
 * amount identical (split with exact cents).
 */
function rederivePaymentAllocations(db, salesCompanyId) {
  const deptNames = new Map(db.prepare('SELECT id, name FROM analytic_groups').all().map(g => [g.id, g.name]));
  const shareRows = db.prepare(`
    SELECT si.invoice_id, si.name, idp.department_id, idp.share, idp.cost_center_key, idp.cost_center_name
    FROM invoice_departments idp
    JOIN sales_invoices si ON si.id = idp.sales_invoice_id
    WHERE si.company_id = ?
    ORDER BY si.id, idp.cost_center_key, idp.department_id
  `).all(salesCompanyId);
  const byOdooId = new Map();
  const byName = new Map();
  for (const r of shareRows) {
    if (r.invoice_id) {
      if (!byOdooId.has(r.invoice_id)) byOdooId.set(r.invoice_id, []);
      byOdooId.get(r.invoice_id).push(r);
    }
    if (r.name) {
      if (!byName.has(r.name)) byName.set(r.name, []);
      byName.get(r.name).push(r);
    }
  }

  const rows = db.prepare('SELECT * FROM payment_allocations WHERE sales_company_id = ? ORDER BY id').all(salesCompanyId);
  const groups = new Map();
  for (const r of rows) {
    const k = `${r.company_id}|${r.odoo_reconcile_id}|${r.counterpart_account_code || ''}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }

  const del = db.prepare('DELETE FROM payment_allocations WHERE id = ?');
  const cols = db.prepare('PRAGMA table_info(payment_allocations)').all().map(c => c.name).filter(c => c !== 'id' && c !== 'created_at');
  const ins = db.prepare(`INSERT INTO payment_allocations (${cols.join(', ')}) VALUES (${cols.map(c => '@' + c).join(', ')})`);

  const ctxByLedger = new Map();
  const ctxFor = (ledgerCid) => {
    if (!ctxByLedger.has(ledgerCid)) ctxByLedger.set(ledgerCid, new AttributionContext(db, ledgerCid));
    return ctxByLedger.get(ledgerCid);
  };

  let changedGroups = 0;
  db.transaction(() => {
    for (const grp of groups.values()) {
      const t = grp[0];
      let depts = (t.invoice_id && byOdooId.get(t.invoice_id)) || byName.get(t.invoice_name) || null;
      if (!depts || depts.length === 0) {
        // No attributed invoice: the invoice journal's explicit default, else its own row
        const u = ctxFor(t.company_id).untaggedTarget(t.invoice_journal_id || 0, t.invoice_journal_name || '');
        depts = [{ department_id: u.deptId || 0, share: 1, cost_center_key: u.key, cost_center_name: u.name }];
      }
      const total = Math.round(grp.reduce((s, r) => s + (r.amount || 0), 0) * 100) / 100;
      const amounts = splitAmount(total, depts.map(d => d.share));
      const target = depts.map((d, i) => `${d.department_id}|${d.cost_center_key}|${d.cost_center_name}|${amounts[i].toFixed(2)}`).sort().join('#');
      const current = grp.map(r => `${r.department_id}|${r.cost_center_key}|${r.cost_center_name}|${(r.amount || 0).toFixed(2)}`).sort().join('#');
      if (target === current) continue;
      changedGroups++;
      for (const r of grp) del.run(r.id);
      depts.forEach((d, i) => {
        const row = {};
        for (const c of cols) row[c] = t[c];
        row.amount = amounts[i];
        row.department_id = d.department_id || 0;
        row.department_name = deptNames.get(d.department_id) || 'غير مصنف';
        row.cost_center_key = d.cost_center_key;
        row.cost_center_name = d.cost_center_name;
        ins.run(row);
      });
    }
  })();
  return changedGroups;
}

/**
 * Ambiguities that need a user decision («تعارضات تحتاج قرارًا»).
 */
function getAttributionConflicts(db, { companyId } = {}) {
  const groupNames = new Map(db.prepare('SELECT id, name FROM analytic_groups').all().map(g => [g.id, g.name]));
  const companies = db.prepare(`
    SELECT c.id, c.name, c.short_name, c.odoo_instance_id, c.odoo_company_id, sc.id AS sales_cid
    FROM companies c
    LEFT JOIN sales_companies sc ON sc.sales_company_id = c.odoo_company_id
    WHERE c.is_active = 1 ${companyId ? 'AND c.id = ?' : ''}
    ORDER BY c.id
  `).all(...(companyId ? [companyId] : []));

  const journals = [];
  const analytics = [];
  const combinations = [];
  const unmappedAnalytics = [];
  const staleMappings = [];
  for (const co of companies) {
    const ctx = new AttributionContext(db, co.id);
    const jNames = new Map(db.prepare('SELECT odoo_journal_id, name FROM odoo_journals WHERE company_id = ?').all(co.id).map(j => [j.odoo_journal_id, j.name]));
    const untagged = db.prepare(`
      SELECT substr(fd.year, 1, 4) AS year, ROUND(SUM(fd.revenue), 2) AS revenue, ROUND(SUM(fd.expense), 2) AS expense
      FROM fact_daily fd WHERE fd.company_id = ? AND fd.cost_center_key = ? GROUP BY 1 ORDER BY 1
    `);
    const invStats = db.prepare(`
      SELECT COUNT(DISTINCT si.id) AS invoices,
             ROUND(SUM(si.amount_untaxed * idp.share), 2) AS untaxed,
             ROUND(SUM(si.amount_total * idp.share), 2) AS total
      FROM invoice_departments idp JOIN sales_invoices si ON si.id = idp.sales_invoice_id
      WHERE si.company_id = ? AND idp.cost_center_key = ?
    `);
    for (const [jid, e] of ctx.legacy) {
      const d = ctx.journalDefault(jid);
      const deptConflict = e.groups.size > 1;
      const ccConflict = e.analytics.size > 1;
      if (!deptConflict && !ccConflict) continue;
      if (d && d.decided_by_user) continue;
      const key = 'j:' + jid;
      const inv = co.sales_cid ? invStats.get(co.sales_cid, key) : { invoices: 0, untaxed: 0, total: 0 };
      const candidates = [...e.analytics].map(name => {
        const id = ctx.analyticIdByName(name);
        const dep = ctx.analyticDepartment([name]);
        return { name, analytic_id: id, cost_center_key: id ? `an:${ctx.instanceId}:${id}` : null, department_id: dep.deptId, department_name: groupNames.get(dep.deptId) || null };
      });
      journals.push({
        company_id: co.id,
        company_name: co.short_name || co.name,
        journal_id: jid,
        journal_name: jNames.get(jid) || [...e.names][0] || `دفتر ${jid}`,
        cost_center_key: key,
        kind: deptConflict ? 'department' : 'cost_center',
        candidate_departments: [...e.groups].map(g => ({ id: g, name: groupNames.get(g) || `#${g}` })),
        candidate_analytics: candidates,
        current_default: d ? { group_id: d.group_id, group_name: groupNames.get(d.group_id) || null, analytic_id: d.analytic_id, decided_by_user: d.decided_by_user, source: d.source } : null,
        invoices: inv ? inv.invoices || 0 : 0,
        invoices_untaxed: inv ? inv.untaxed || 0 : 0,
        invoices_total: inv ? inv.total || 0 : 0,
        ledger_by_year: untagged.all(co.id, key)
      });
    }
    for (const [name, set] of ctx.deptByName) {
      if (set.size > 1) {
        analytics.push({ company_id: co.id, company_name: co.short_name || co.name, analytic_account: name, departments: [...set].map(g => ({ id: g, name: groupNames.get(g) || `#${g}` })) });
      }
    }
    const comb = db.prepare(`
      SELECT COUNT(DISTINCT d.odoo_line_id) AS lines FROM journal_item_analytic_distribution d
      WHERE d.company_id = ? AND d.is_combination = 1
    `).get(co.id);
    if (comb && comb.lines > 0) combinations.push({ company_id: co.id, company_name: co.short_name || co.name, lines: comb.lines });

    // For information (not conflicts): analytic accounts with amounts but no department, and
    // mapping rows whose name matches no analytic account any more (e.g. renamed in Odoo).
    for (const r of db.prepare(`
      SELECT cost_center_key k, MAX(cost_center_name) n, ROUND(SUM(revenue), 2) revenue, ROUND(SUM(expense), 2) expense
      FROM fact_daily WHERE company_id = ? AND cost_center_key LIKE 'an:%' AND department_id = 0
      GROUP BY 1 HAVING ABS(SUM(revenue)) > 0.01 OR ABS(SUM(expense)) > 0.01 ORDER BY 1
    `).all(co.id)) {
      unmappedAnalytics.push({ company_id: co.id, company_name: co.short_name || co.name, cost_center_key: r.k, name: r.n, revenue: r.revenue, expense: r.expense });
    }
    const usedNames = new Set(db.prepare(`SELECT DISTINCT analytic_account a FROM journal_items WHERE company_id = ? AND TRIM(COALESCE(analytic_account, '')) != ''`).all(co.id).map(r => norm(r.a)));
    for (const a of ctx.oaRows) usedNames.add(norm(a.name));
    for (const name of ctx.deptByName.keys()) {
      if (!usedNames.has(name)) staleMappings.push({ company_id: co.id, company_name: co.short_name || co.name, analytic_account: name });
    }
  }
  return {
    totalConflicts: journals.length + analytics.length + combinations.length,
    journals,
    analytics,
    combinations,
    unmapped_analytics: unmappedAnalytics,
    stale_mappings: staleMappings
  };
}

/**
 * Rebuild every derived attribution table (fact_daily, invoice_departments, payment_allocations)
 * after a settings decision. ledgerCompanyId limits the rebuild to one company.
 */
function rebuildAttribution(db, ledgerCompanyId) {
  const SyncEngine = require('./sync-engine');
  const ConsolidationEngine = require('./consolidation');
  const started = Date.now();
  const sync = new SyncEngine();
  const engine = new ConsolidationEngine(db);
  let salesCid = null;
  if (ledgerCompanyId) {
    const r = db.prepare('SELECT sc.id FROM sales_companies sc JOIN companies c ON c.odoo_company_id = sc.sales_company_id WHERE c.id = ?').get(ledgerCompanyId);
    salesCid = r ? r.id : null;
  }
  db.transaction(() => {
    sync.rebuildFactDaily(ledgerCompanyId || undefined);
    if (!ledgerCompanyId || salesCid) engine.resolveInvoiceDepartments(salesCid || undefined);
  })();
  try { require('./cache').flush(); } catch (e) {}
  return { durationMs: Date.now() - started };
}

module.exports = {
  AttributionContext,
  UNTAGGED_SUFFIX,
  legacyJournalLinks,
  resolveAnalyticIdByName,
  seedJournalDefaults,
  loadDistribution,
  distributionRows,
  splitAmount,
  rederivePaymentAllocations,
  getAttributionConflicts,
  rebuildAttribution,
  norm
};
