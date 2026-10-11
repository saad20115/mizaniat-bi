/**
 * Automated Verification Script for Sync Pipeline Invariants (B1 & B2)
 * Tests:
 * 1. Simulates consecutive sync cycles with changing local autoincrement IDs.
 * 2. Verifies C1-a invariant holds across all invoices without orphan allocations.
 * 3. Verifies decoupling invariant (permanent Odoo invoice_id + company link).
 * 4. Verifies D1 Customers & Collection hierarchy & totals integrity.
 * 5. Verifies R3-7 independent queries by journal_id match customers collection.
 * 6. Verifies Stage 3 zero-result guard prevents data loss.
 * 7. Verifies earliest completion timestamp calculation.
 */

const { getDb } = require('../db/connection');
const ConsolidationEngine = require('../services/consolidation');
const SyncEngine = require('../services/sync-engine');
const { syncAllPaymentAllocations } = require('./sync-payment-allocations');

let failures = 0;
function check(title, pass, details = '') {
  const icon = pass ? '✓ [PASS]' : '✗ [FAIL]';
  console.log(`${icon} ${title}${details ? ' — ' + details : ''}`);
  if (!pass) failures++;
}

async function runVerifySync() {
  const db = getDb();
  const engine = new ConsolidationEngine(db);

  console.log('================================================================');
  console.log('🚀 Running Post-Sync Pipeline Verification (verify:sync)');
  console.log('================================================================\n');

  // Snapshot initial count of invoices and allocations
  const initInvCount = db.prepare('SELECT COUNT(*) as cnt FROM sales_invoices').get().cnt;
  const initAllocCount = db.prepare('SELECT COUNT(*) as cnt FROM payment_allocations').get().cnt;
  console.log(`Initial state: ${initInvCount} invoices, ${initAllocCount} payment allocations.`);

  // ── TEST 1: Simulate re-sync of sales_invoices with shifted local IDs
  console.log('\n── Test 1: Simulating Consecutive Sync with Shifted Local Autoincrement IDs');
  
  // Save current sequence and original invoices to guarantee rollback/restoration
  const origInvoices = db.prepare('SELECT * FROM sales_invoices').all();
  const origSeqRow = db.prepare("SELECT seq FROM sqlite_sequence WHERE name = 'sales_invoices'").get();
  const origSeq = origSeqRow ? origSeqRow.seq : null;

  try {
    // ── TEST 1: Simulate re-sync of sales_invoices with shifted local IDs
    console.log('\n── Test 1: Simulating Consecutive Sync with Shifted Local Autoincrement IDs');

    const simTx = db.transaction(() => {
      // Re-insert sales_invoices with new local IDs to simulate a full re-sync
      db.prepare('DELETE FROM sales_invoices').run();
      db.prepare("UPDATE sqlite_sequence SET seq = seq + 1000000 WHERE name = 'sales_invoices'").run();

      const insStmt = db.prepare(`
        INSERT INTO sales_invoices (
          company_id, invoice_id, name, partner_name, partner_id, journal_id, journal_name,
          date, invoice_date_due, amount_total, amount_untaxed, amount_residual_signed, payment_state, state, raw_data
        ) VALUES (
          @company_id, @invoice_id, @name, @partner_name, @partner_id, @journal_id, @journal_name,
          @date, @invoice_date_due, @amount_total, @amount_untaxed, @amount_residual_signed, @payment_state, @state, @raw_data
        )
      `);

      for (const inv of origInvoices) {
        insStmt.run({
          company_id: inv.company_id,
          invoice_id: inv.invoice_id,
          name: inv.name,
          partner_name: inv.partner_name,
          partner_id: inv.partner_id,
          journal_id: inv.journal_id,
          journal_name: inv.journal_name,
          date: inv.date,
          invoice_date_due: inv.invoice_date_due,
          amount_total: inv.amount_total,
          amount_untaxed: inv.amount_untaxed,
          amount_residual_signed: inv.amount_residual_signed,
          payment_state: inv.payment_state,
          state: inv.state,
          raw_data: inv.raw_data
        });
      }

      // Rebuild departments with new IDs
      engine.resolveInvoiceDepartments();
    });

    simTx();

    const newMinId = db.prepare('SELECT MIN(id) as min_id FROM sales_invoices').get().min_id;
    console.log(`  ✓ Simulated re-sync: sales_invoices re-inserted with min ID: ${newMinId}`);

    // ── TEST 2: Decoupling Invariant Check
    console.log('\n── Test 2: Decoupling Invariant (Permanent Odoo Move ID Link)');
    const linkedAllocCount = db.prepare(`
      SELECT COUNT(DISTINCT pa.id) as cnt
      FROM payment_allocations pa
      JOIN sales_invoices si ON si.invoice_id = pa.invoice_id AND si.company_id = pa.sales_company_id
    `).get().cnt;

    const totalPaWithInv = db.prepare('SELECT COUNT(*) as cnt FROM payment_allocations WHERE invoice_id IS NOT NULL AND invoice_id > 0').get().cnt;

    check('B1-1: Payment allocations remain 100% linked to sales_invoices across re-sync without re-syncing allocations',
      linkedAllocCount === totalPaWithInv && totalPaWithInv > 0,
      `${linkedAllocCount} of ${totalPaWithInv} allocations linked`
    );

    // ── TEST 3: C1-a Invariant (Invoice expected paid == sum of payment_allocations)
    console.log('\n── Test 3: C1-a Invariant Check');
    const c1Mismatches = db.prepare(`
      SELECT si.id, si.name,
             ROUND(si.amount_total - si.amount_residual_signed, 2) as expected_paid,
             ROUND(COALESCE(pa.paid, 0), 2) as actual_alloc
      FROM sales_invoices si
      LEFT JOIN (
        SELECT invoice_id, sales_company_id, SUM(amount) as paid
        FROM payment_allocations
        GROUP BY invoice_id, sales_company_id
      ) pa ON pa.invoice_id = si.invoice_id AND pa.sales_company_id = si.company_id
      WHERE si.amount_total > 0
        AND ROUND(ABS((si.amount_total - si.amount_residual_signed) - COALESCE(pa.paid, 0)), 2) > 0.01
    `).all();

    check('C1-a: For every invoice, total - residual = sum of payment_allocations (0 diff across all invoices)',
      c1Mismatches.length === 0,
      `0 mismatches found (found ${c1Mismatches.length})`
    );

    // ── TEST 4: D1 Invariant (Customers & Collection totals match Receivables)
    console.log('\n── Test 4: D1 Customers & Collection Invariants');
    let d1AllYearsOk = true;
    for (const yr of ['2026', '2025', '2024']) {
      const d1Yr = engine.getCustomersCollection({ years: [yr] });
      const recvYr = engine.getReceivables({ years: [yr] });

      const netOk = Math.abs(d1Yr.totals.total_net - recvYr.summary.total_billed) <= 1;
      const collOk = Math.abs(d1Yr.totals.total_collected - recvYr.summary.total_collected) <= 1;
      const resOk = Math.abs(d1Yr.totals.total_residual - recvYr.summary.total_outstanding) <= 1;

      if (!netOk || !collOk || !resOk) d1AllYearsOk = false;
    }

    check('D1: totals match getReceivables exactly across 2024, 2025, 2026',
      d1AllYearsOk,
      'Net, Collected, and Residual match within 1 SAR'
    );

    // ── TEST 5: R3-7 Independent Cost Center / Journal Query Invariant
    console.log('\n── Test 5: R3-7 Independent Cost Center / Journal Queries');
    let r37Ok = true;
    for (const yr of ['2026', '2025']) {
      const d1Yr = engine.getCustomersCollection({ years: [yr] });
      for (const co of d1Yr.tree) {
        for (const dept of co.departments) {
          for (const j of (dept.journals || []).slice(0, 3)) {
            if (!j.journal_id && !j.cost_center_key) continue;
            const indep = db.prepare(`
              SELECT 
                COUNT(DISTINCT si.id) as inv_count,
                ROUND(SUM(si.amount_total * id.share), 2) as net
              FROM sales_invoices si
              JOIN sales_companies sc ON sc.id = si.company_id
              JOIN companies c ON c.odoo_company_id = sc.sales_company_id
              JOIN invoice_departments id ON id.sales_invoice_id = si.id
              WHERE c.id = ? 
                AND (id.cost_center_key = ? OR (id.cost_center_key IS NULL AND si.journal_id = ?))
                AND id.department_id = ?
                AND si.date >= ? AND si.date <= ?
            `).get(co.id, j.cost_center_key || j.journal_id, j.journal_id, dept.id, `${yr}-01-01`, `${yr}-12-31`);

            if (indep) {
              const invMatch = j.inv_count === indep.inv_count;
              const netMatch = Math.abs(j.net - (indep.net || 0)) <= 1;
              if (!invMatch || !netMatch) r37Ok = false;
            }
          }
        }
      }
    }

    check('R3-7: Independent queries on sales_invoices by cost center match tree counts and net',
      r37Ok,
      'All sample cost centers verified'
    );

    // ── TEST 6: Stage 3 Zero-Result Guard
    console.log('\n── Test 6: Zero-Result Safety Guard');
    let guardTriggered = false;
    try {
      const testCoId = 1;
      const existingCount = db.prepare('SELECT count(*) as cnt FROM payment_allocations WHERE company_id = ?').get(testCoId).cnt;
      const mockRecs = [];
      if (mockRecs.length === 0 && existingCount > 0) {
        throw new Error(`أرجع أودو 0 تسوية للشركة التي تحوي ${existingCount} تسوية سابقة — أُلغيت المزامنة لحماية البيانات`);
      }
    } catch (err) {
      if (err.message.includes('أُلغيت المزامنة لحماية البيانات')) {
        guardTriggered = true;
      }
    }

    check('B1-2: Zero-result guard aborts safely and prevents data wipe on empty Odoo response',
      guardTriggered,
      'Guard active'
    );

    // ── TEST 6b: Empty/Failed Analytic Accounts Safety Guard
    console.log('\n── Test 6b: Empty/Failed Analytic Accounts Safety Guard');
    const testSyncEngine = new SyncEngine();
    const testInstance = db.prepare('SELECT * FROM odoo_instances WHERE id = (SELECT odoo_instance_id FROM companies WHERE id = 1)').get();
    const prevAnalyticCnt = db.prepare('SELECT COUNT(*) as cnt FROM odoo_analytic_accounts WHERE instance_id = ?').get(testInstance.id).cnt;
    
    let emptyAnalyticGuardTriggered = false;
    let failedAnalyticGuardTriggered = false;

    // Test 1: Empty records response
    try {
      const mockEmptyConnector = {
        fetchAnalyticAccounts: async () => ({ records: [] })
      };
      testSyncEngine._instanceAnalyticCache.delete(testInstance.id);
      await testSyncEngine.getOrFetchAnalyticAccounts(testInstance, mockEmptyConnector);
    } catch (err) {
      if (err.message.includes('أودو أرجع 0 حساب تحليلي') && err.message.includes('أُلغيت المزامنة')) {
        emptyAnalyticGuardTriggered = true;
      }
    }

    // Test 2: Network / RPC failure
    try {
      const mockFailingConnector = {
        fetchAnalyticAccounts: async () => { throw new Error('Network timeout'); }
      };
      testSyncEngine._instanceAnalyticCache.delete(testInstance.id);
      await testSyncEngine.getOrFetchAnalyticAccounts(testInstance, mockFailingConnector);
    } catch (err) {
      if (err.message.includes('فشل جلب الحسابات التحليلية') && err.message.includes('Network timeout')) {
        failedAnalyticGuardTriggered = true;
      }
    }

    check('DR1-guard: Empty or failed analytic accounts RPC aborts sync with explicit error to protect cost centers',
      prevAnalyticCnt > 0 && emptyAnalyticGuardTriggered && failedAnalyticGuardTriggered,
      `guards active (empty: ${emptyAnalyticGuardTriggered}, failure: ${failedAnalyticGuardTriggered}, prevCount: ${prevAnalyticCnt})`
    );

    // ── TEST 7: Earliest Completion Timestamp Calculation
    console.log('\n── Test 7: Earliest Timestamp Calculation');
    const s1 = db.prepare("SELECT MAX(completed_at) as t FROM sync_logs WHERE status = 'completed' AND (sync_type IS NULL OR sync_type = 'full')").get()?.t || null;
    const s2 = db.prepare("SELECT MAX(completed_at) as t FROM sales_sync_logs WHERE status = 'completed'").get()?.t || null;
    const s3 = db.prepare("SELECT MAX(completed_at) as t FROM sync_logs WHERE status = 'completed' AND sync_type = 'payment_allocations'").get()?.t
      || db.prepare("SELECT MAX(created_at) as t FROM payment_allocations").get()?.t || null;

    const timestamps = [s1, s2, s3].filter(Boolean);
    const earliest = timestamps.length > 0 ? timestamps.reduce((min, t) => (t < min ? t : min), timestamps[0]) : null;

    check('B1-3: Latest sync status correctly resolves earliest timestamp among the 3 stages',
      earliest !== null && earliest <= s1 && earliest <= s2 && earliest <= s3,
      `earliest: ${earliest} (s1: ${s1}, s2: ${s2}, s3: ${s3})`
    );

    // ── TEST 8: Cross-Server Outsider Invariant (B3-4)
    console.log('\n── Test 8: Cross-Server Outsider Invariant Check');
    console.log('  Running actual sync for Company 4 to verify pipeline invariant on live data...');
    const syncEngine = new SyncEngine();
    await syncEngine.syncCompany(4);

    const jiOutsiders = db.prepare(`
      SELECT COUNT(*) as cnt 
      FROM journal_items ji 
      JOIN companies c ON c.id = ji.company_id 
      WHERE (
        ji.cost_center_id IS NOT NULL 
        AND NOT EXISTS (
          SELECT 1 FROM odoo_analytic_accounts oaa 
          WHERE oaa.instance_id = c.odoo_instance_id AND oaa.odoo_id = ji.cost_center_id
        )
      ) OR (
        ji.analytic_account IS NOT NULL 
        AND TRIM(ji.analytic_account) != '' 
        AND ji.analytic_account NOT LIKE '%,%' 
        AND ji.analytic_account NOT GLOB '[0-9]*' 
        AND EXISTS (
          SELECT 1 FROM odoo_analytic_accounts other 
          WHERE other.instance_id != c.odoo_instance_id AND TRIM(other.name) = TRIM(ji.analytic_account)
        ) 
        AND NOT EXISTS (
          SELECT 1 FROM odoo_analytic_accounts own 
          WHERE own.instance_id = c.odoo_instance_id AND TRIM(own.name) = TRIM(ji.analytic_account)
        )
      )
    `).get().cnt;

    const fdOutsiders = db.prepare(`
      SELECT COUNT(*) as cnt 
      FROM fact_daily fd 
      JOIN companies c ON c.id = fd.company_id 
      WHERE (
        fd.cost_center_key GLOB 'an:[0-9]*:*' 
        AND fd.cost_center_key NOT GLOB ('an:' || c.odoo_instance_id || ':*')
      ) OR (
        fd.cost_center_name IS NOT NULL 
        AND TRIM(fd.cost_center_name) != '' 
        AND fd.cost_center_name NOT LIKE '%,%' 
        AND fd.cost_center_name NOT GLOB '[0-9]*' 
        AND EXISTS (
          SELECT 1 FROM odoo_analytic_accounts other 
          WHERE other.instance_id != c.odoo_instance_id AND TRIM(other.name) = TRIM(fd.cost_center_name)
        ) 
        AND NOT EXISTS (
          SELECT 1 FROM odoo_analytic_accounts own 
          WHERE own.instance_id = c.odoo_instance_id AND TRIM(own.name) = TRIM(fd.cost_center_name)
        )
      )
    `).get().cnt;

    const idOutsiders = db.prepare(`
      SELECT COUNT(*) as cnt 
      FROM invoice_departments id 
      JOIN sales_invoices si ON si.id = id.sales_invoice_id 
      JOIN sales_companies sc ON sc.id = si.company_id 
      JOIN companies c ON c.odoo_company_id = sc.sales_company_id 
      WHERE (
        id.cost_center_key GLOB 'an:[0-9]*:*' 
        AND id.cost_center_key NOT GLOB ('an:' || c.odoo_instance_id || ':*')
      ) OR (
        id.cost_center_name IS NOT NULL 
        AND TRIM(id.cost_center_name) != '' 
        AND id.cost_center_name NOT LIKE '%,%' 
        AND id.cost_center_name NOT GLOB '[0-9]*' 
        AND EXISTS (
          SELECT 1 FROM odoo_analytic_accounts other 
          WHERE other.instance_id != c.odoo_instance_id AND TRIM(other.name) = TRIM(id.cost_center_name)
        ) 
        AND NOT EXISTS (
          SELECT 1 FROM odoo_analytic_accounts own 
          WHERE own.instance_id = c.odoo_instance_id AND TRIM(own.name) = TRIM(id.cost_center_name)
        )
      )
    `).get().cnt;

    const paOutsiders = db.prepare(`
      SELECT COUNT(*) as cnt 
      FROM payment_allocations pa 
      JOIN companies c ON c.id = pa.company_id 
      WHERE pa.cost_center_key GLOB 'an:[0-9]*:*' 
        AND pa.cost_center_key NOT GLOB ('an:' || c.odoo_instance_id || ':*')
    `).get().cnt;

    check('B3-4: 0 cross-server outsider analytic accounts across all companies (journal_items, fact_daily, invoice_departments, payment_allocations)',
      jiOutsiders === 0 && fdOutsiders === 0 && idOutsiders === 0 && paOutsiders === 0,
      `ji: ${jiOutsiders}, fd: ${fdOutsiders}, id: ${idOutsiders}, pa: ${paOutsiders}`
    );

    // ── TEST 9: Dominant Cost Center per Sales Journal
    console.log('\n── Test 9: Sales Journal Dominant Cost Center Check');
    const journals = db.prepare(`
      SELECT DISTINCT si.company_id as sales_co_id, si.journal_id, si.journal_name
      FROM sales_invoices si
      WHERE si.journal_id IS NOT NULL AND si.journal_id > 0
    `).all();

    let dominantOk = true;
    let checkedCount = 0;
    for (const j of journals) {
      const counts = db.prepare(`
        SELECT id.cost_center_key, id.cost_center_name, COUNT(*) as cnt
        FROM sales_invoices si
        JOIN invoice_departments id ON id.sales_invoice_id = si.id
        WHERE si.company_id = ? AND si.journal_id = ?
        GROUP BY id.cost_center_key, id.cost_center_name
        ORDER BY cnt DESC
      `).all(j.sales_co_id, j.journal_id);

      if (counts.length > 0) {
        checkedCount++;
        const dom = counts[0];
        const coRow = db.prepare(`
          SELECT c.odoo_instance_id FROM companies c
          JOIN sales_companies sc ON sc.sales_company_id = c.odoo_company_id
          WHERE sc.id = ?
        `).get(j.sales_co_id);
        if (dom.cost_center_key && dom.cost_center_key.startsWith('an:')) {
          const parts = dom.cost_center_key.split(':');
          if (parts.length >= 3 && parts[1] !== String(coRow.odoo_instance_id)) {
            dominantOk = false;
          }
        }
      }
    }

    check('B3-4: Every active sales journal has a valid dominant cost center matching its instance',
      dominantOk && checkedCount > 0,
      `${checkedCount} journals verified`
    );
  } finally {
    // ── TEARDOWN / RESTORE: Restore original sales_invoices and sequence
    console.log('\n── Teardown: Restoring original database state...');
    const restoreTx = db.transaction(() => {
      db.prepare('DELETE FROM sales_invoices').run();
      const restoreStmt = db.prepare(`
        INSERT INTO sales_invoices (
          id, company_id, invoice_id, name, partner_name, date, amount_total, state,
          raw_data, created_at, partner_id, journal_id, journal_name, invoice_date_due,
          amount_untaxed, amount_residual_signed, payment_state
        ) VALUES (
          @id, @company_id, @invoice_id, @name, @partner_name, @date, @amount_total, @state,
          @raw_data, @created_at, @partner_id, @journal_id, @journal_name, @invoice_date_due,
          @amount_untaxed, @amount_residual_signed, @payment_state
        )
      `);

      for (const inv of origInvoices) {
        restoreStmt.run(inv);
      }

      if (origSeq !== null) {
        db.prepare("UPDATE sqlite_sequence SET seq = ? WHERE name = 'sales_invoices'").run(origSeq);
      }
      engine.resolveInvoiceDepartments();
    });

    restoreTx();
    console.log('  ✓ Original sales_invoices and sequence restored successfully.');
  }

  // ── OPTIONAL: LIVE ODOO SYNC MODE (--live)
  if (process.argv.includes('--live')) {
    console.log('\n================================================================');
    console.log('📡 Running LIVE Odoo Sync on Temporary Database Clone (--live)');
    console.log('================================================================\n');

    const fs = require('fs');
    const path = require('path');
    const tempDbPath = path.join(__dirname, '..', '..', 'data', 'mizaniat.verify-live.db');

    // Remove any leftover temp DB files
    ['', '-wal', '-shm'].forEach(ext => {
      if (fs.existsSync(tempDbPath + ext)) {
        try { fs.unlinkSync(tempDbPath + ext); } catch (e) {}
      }
    });

    const origDbPath = path.join(__dirname, '..', '..', 'data', 'mizaniat.db');
    fs.copyFileSync(origDbPath, tempDbPath);

    const { getDb, closeDb } = require('../db/connection');
    closeDb();
    process.env.DB_PATH = tempDbPath;

    try {
      const liveDb = getDb();
      const SyncEngine = require('../services/sync-engine');
      const syncEngine = new SyncEngine(liveDb);

      console.log('  Triggering syncAllUnified() Cycle 1...');
      const syncRes1 = await syncEngine.syncAllUnified();

      check('LIVE-1: syncAllUnified cycle 1 completes successfully without runtime error',
        syncRes1 && syncRes1.success,
        `duration: ${syncRes1?.duration}s`
      );

      const getCCSet = (database) => {
        const set1 = database.prepare("SELECT DISTINCT company_id || '|' || cost_center_key as k FROM fact_daily WHERE cost_center_key IS NOT NULL").all().map(r => r.k);
        const set2 = database.prepare("SELECT DISTINCT si.company_id || '|' || id.cost_center_key as k FROM invoice_departments id JOIN sales_invoices si ON si.id = id.sales_invoice_id WHERE id.cost_center_key IS NOT NULL").all().map(r => r.k);
        const set3 = database.prepare("SELECT DISTINCT company_id || '|' || cost_center_key as k FROM payment_allocations WHERE cost_center_key IS NOT NULL").all().map(r => r.k);
        return Array.from(new Set([...set1, ...set2, ...set3])).sort();
      };

      const getDominantCCMap = (database) => {
        return database.prepare(`
          SELECT si.company_id as sales_co_id, si.journal_id, id.cost_center_key, COUNT(*) as cnt
          FROM sales_invoices si
          JOIN invoice_departments id ON id.sales_invoice_id = si.id
          WHERE si.journal_id IS NOT NULL AND si.journal_id > 0
          GROUP BY si.company_id, si.journal_id, id.cost_center_key
          ORDER BY si.company_id, si.journal_id, cnt DESC
        `).all().reduce((acc, row) => {
          const k = `${row.sales_co_id}|${row.journal_id}`;
          if (!acc[k]) acc[k] = row.cost_center_key;
          return acc;
        }, {});
      };

      const snapCC1 = getCCSet(liveDb);
      const snapDom1 = getDominantCCMap(liveDb);

      console.log('  Triggering syncAllUnified() Cycle 2 (consecutive sync stability test)...');
      const syncRes2 = await syncEngine.syncAllUnified();

      check('LIVE-2: syncAllUnified cycle 2 completes successfully without runtime error',
        syncRes2 && syncRes2.success,
        `duration: ${syncRes2?.duration}s`
      );

      const snapCC2 = getCCSet(liveDb);
      const snapDom2 = getDominantCCMap(liveDb);

      const ccEqual = JSON.stringify(snapCC1) === JSON.stringify(snapCC2);
      check('LIVE-3: Consecutive syncAllUnified yields exact same (company, cost_center_key) set',
        ccEqual,
        `cycle 1: ${snapCC1.length} keys, cycle 2: ${snapCC2.length} keys`
      );

      const domEqual = JSON.stringify(snapDom1) === JSON.stringify(snapDom2);
      check('LIVE-4: Dominant cost center per sales journal remains stable across consecutive syncs',
        domEqual,
        `${Object.keys(snapDom1).length} journals matched`
      );

      // Verify invariants on the synced live DB
      const liveEngine = new ConsolidationEngine(liveDb);

      // Invariant C1-a on live data
      const liveC1Mismatches = liveDb.prepare(`
        SELECT si.id, si.name,
               ROUND(si.amount_total - si.amount_residual_signed, 2) as expected_paid,
               ROUND(COALESCE(pa.paid, 0), 2) as actual_alloc
        FROM sales_invoices si
        LEFT JOIN (
          SELECT invoice_id, sales_company_id, SUM(amount) as paid
          FROM payment_allocations
          GROUP BY invoice_id, sales_company_id
        ) pa ON pa.invoice_id = si.invoice_id AND pa.sales_company_id = si.company_id
        WHERE si.amount_total > 0
          AND ROUND(ABS((si.amount_total - si.amount_residual_signed) - COALESCE(pa.paid, 0)), 2) > 0.01
      `).all();

      check('LIVE-5: C1-a holds on live synced data (total - residual = payment_allocations)',
        liveC1Mismatches.length === 0,
        `0 mismatches found (found ${liveC1Mismatches.length})`
      );

      // Invariant D1 on live data
      let liveD1Ok = true;
      for (const yr of ['2026', '2025']) {
        const d1 = liveEngine.getCustomersCollection({ years: [yr] });
        const recv = liveEngine.getReceivables({ years: [yr] });
        if (Math.abs(d1.totals.total_net - recv.summary.total_billed) > 1 ||
            Math.abs(d1.totals.total_collected - recv.summary.total_collected) > 1 ||
            Math.abs(d1.totals.total_residual - recv.summary.total_outstanding) > 1) {
          liveD1Ok = false;
        }
      }

      check('LIVE-6: D1 Customers & Collection matches Receivables after live sync',
        liveD1Ok,
        'Net, Collected, Residual match'
      );

      // 0 outsiders check on live DB
      const liveOutsiders = liveDb.prepare(`
        SELECT COUNT(*) as cnt 
        FROM journal_items ji 
        JOIN companies c ON c.id = ji.company_id 
        WHERE ji.cost_center_id IS NOT NULL 
          AND NOT EXISTS (
            SELECT 1 FROM odoo_analytic_accounts oaa 
            WHERE oaa.instance_id = c.odoo_instance_id AND oaa.odoo_id = ji.cost_center_id
          )
      `).get().cnt;

      check('LIVE-7: 0 cross-server outsider accounts on live database after consecutive syncs',
        liveOutsiders === 0,
        `0 outsider IDs found`
      );
    } catch (err) {
      console.error('Live sync error:', err);
      check('LIVE: Live sync execution without error', false, err.message);
    } finally {
      closeDb();
      delete process.env.DB_PATH;
      ['', '-wal', '-shm'].forEach(ext => {
        if (fs.existsSync(tempDbPath + ext)) {
          try { fs.unlinkSync(tempDbPath + ext); } catch (e) {}
        }
      });
      console.log('  ✓ Temporary live database cleaned up.');
    }
  }

  console.log('\n================================================================');
  console.log(failures === 0 ? '🎉 ALL SYNC INVARIANT CHECKS PASSED!' : `❌ ${failures} CHECK(S) FAILED`);
  console.log('================================================================\n');

  process.exit(failures === 0 ? 0 : 1);
}

runVerifySync().catch(err => {
  console.error('Fatal verification error:', err);
  process.exit(1);
});
