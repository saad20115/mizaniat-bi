const { getDb } = require('../db/connection');
const OdooConnector = require('../services/odoo-connector');
const CacheService = require('../services/cache');

async function syncAllPaymentAllocations() {
  const db = getDb();
  console.log('🚀 Starting sync of payment_allocations from Odoo for all companies...');

  const companies = db.prepare(`
    SELECT c.id as ledger_cid, c.name as ledger_name, c.odoo_company_id,
           sc.id as sales_cid, sc.name as sales_name,
           oi.url, oi.username, oi.api_key, oi.db_name
    FROM companies c
    JOIN sales_companies sc ON sc.sales_company_id = c.odoo_company_id
    JOIN odoo_instances oi ON oi.id = c.odoo_instance_id
    WHERE c.is_active = 1
    ORDER BY c.id
  `).all();

  const insertStmt = db.prepare(`
    INSERT OR REPLACE INTO payment_allocations (
      company_id, sales_company_id, odoo_company_id, odoo_reconcile_id, amount, full_reconcile_id,
      invoice_id, invoice_name, invoice_date, invoice_year, invoice_journal_id, invoice_journal_name,
      cost_center_key, cost_center_name,
      partner_id, partner_name, department_id, department_name,
      payment_line_id, payment_move_name, payment_move_type, payment_date, payment_year, payment_quarter, payment_month,
      payment_journal_id, payment_journal_name, payment_journal_type, payment_label,
      counterpart_account_code, counterpart_account_name, counterpart_account_type,
      counterpart_partner_id, counterpart_partner_name, counterpart_share,
      channel, channel_label, sister_company_name
    )
    VALUES (
      @company_id, @sales_company_id, @odoo_company_id, @odoo_reconcile_id, @amount, @full_reconcile_id,
      @invoice_id, @invoice_name, @invoice_date, @invoice_year, @invoice_journal_id, @invoice_journal_name,
      @cost_center_key, @cost_center_name,
      @partner_id, @partner_name, @department_id, @department_name,
      @payment_line_id, @payment_move_name, @payment_move_type, @payment_date, @payment_year, @payment_quarter, @payment_month,
      @payment_journal_id, @payment_journal_name, @payment_journal_type, @payment_label,
      @counterpart_account_code, @counterpart_account_name, @counterpart_account_type,
      @counterpart_partner_id, @counterpart_partner_name, @counterpart_share,
      @channel, @channel_label, @sister_company_name
    )
  `);

  const sisterPartnerRows = db.prepare('SELECT company_id, partner_id, partner_name, sister_company_name FROM sister_company_partners').all();
  const sisterPartnerIdMap = new Map();
  const sisterPartnerNameMap = new Map();
  for (const sp of sisterPartnerRows) {
    if (sp.partner_id) {
      sisterPartnerIdMap.set(`${sp.company_id}_${sp.partner_id}`, sp.sister_company_name);
    }
    if (sp.partner_name && sp.partner_name.trim()) {
      sisterPartnerNameMap.set(`${sp.company_id}_${sp.partner_name.trim()}`, sp.sister_company_name);
    }
  }

  function resolveSisterCompany(companyId, partnerId, partnerName, accountName) {
    if (partnerId) {
      const skId = `${companyId}_${partnerId}`;
      if (sisterPartnerIdMap.has(skId)) return sisterPartnerIdMap.get(skId);
    }
    const cleanPartnerName = partnerName ? partnerName.trim() : '';
    const cleanAccountName = accountName ? accountName.trim() : '';
    for (const [key, sName] of sisterPartnerNameMap.entries()) {
      const [cId, registeredName] = key.split('_');
      if (String(companyId) === cId) {
        if (cleanPartnerName && cleanPartnerName === registeredName) return sName;
        if (cleanAccountName && cleanAccountName === registeredName) return sName;
      }
    }
    return null;
  }

  const odooJournals = db.prepare('SELECT odoo_journal_id, company_id, name, type FROM odoo_journals').all();
  if (odooJournals.length === 0) {
    throw new Error('جدول odoo_journals فارغ! لا يمكن تصنيف تسويات السداد بدون أنواع دفاتر اليومية.');
  }

  for (const co of companies) {
    const coJournals = db.prepare('SELECT COUNT(*) as cnt FROM odoo_journals WHERE company_id = ?').get(co.ledger_cid)?.cnt || 0;
    if (coJournals === 0) {
      throw new Error(`لا توجد دفاتر يومية مسجلة للشركة ${co.ledger_cid} (${co.ledger_name}) في odoo_journals! أُلغيت تسويات السداد منعاً للتصنيف الخاطئ.`);
    }
  }

  const odooJournalMap = new Map();
  for (const oj of odooJournals) {
    odooJournalMap.set(`${oj.company_id}_${oj.odoo_journal_id}`, oj.type);
    odooJournalMap.set(`${oj.company_id}_${oj.name.trim()}`, oj.type);
  }

  const deptNames = new Map();
  const agRows = db.prepare('SELECT id, name FROM analytic_groups').all();
  for (const ag of agRows) deptNames.set(ag.id, ag.name);

  let grandTotalAllocations = 0;

  for (const co of companies) {
    console.log(`\n── Syncing Company ${co.ledger_cid}: ${co.ledger_name}`);
    const connector = new OdooConnector(co.url, co.username, co.api_key, co.db_name);
    const domain = [
      ['debit_move_id.move_id.move_type', '=', 'out_invoice'],
      ['debit_move_id.parent_state', '=', 'posted'],
      ['company_id', '=', co.odoo_company_id]
    ];

    const PAGE_SIZE = 1000;
    let offset = 0;
    let allRecs = [];

    while (true) {
      const recs = await connector._rpcCall('account.partial.reconcile', 'search_read', [domain], {
        fields: ['id', 'amount', 'debit_move_id', 'credit_move_id', 'full_reconcile_id', 'max_date', 'company_id'],
        limit: PAGE_SIZE,
        offset: offset,
        order: 'id'
      });
      if (!recs || recs.length === 0) break;
      allRecs = allRecs.concat(recs);
      if (recs.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    console.log(`  Fetched ${allRecs.length} partial reconciliations from Odoo.`);

    const existingCount = db.prepare('SELECT count(*) as cnt FROM payment_allocations WHERE company_id = ?').get(co.ledger_cid).cnt;
    if (allRecs.length === 0 && existingCount > 0) {
      throw new Error(`أرجع أودو 0 تسوية للشركة ${co.ledger_name} التي تحوي ${existingCount} تسوية سابقة — أُلغيت المزامنة لحماية البيانات`);
    }

    // Pre-cache lookup statements
    const findDebitStmt = db.prepare(`
      SELECT ji.id, ji.move_name, ji.date,
             COALESCE(si.partner_id, ji.partner_id, 0) as partner_id,
             COALESCE(NULLIF(TRIM(si.partner_name), ''), NULLIF(TRIM(ji.partner_name), ''), 'عميل غير معروف') as partner_name,
             si.invoice_id as odoo_invoice_id, si.id as local_invoice_id,
             si.journal_id as invoice_journal_id, si.journal_name as invoice_journal_name
      FROM journal_items ji
      LEFT JOIN sales_invoices si ON si.company_id = ? AND si.name = ji.move_name
      WHERE ji.company_id = ? AND ji.odoo_line_id = ?
    `);

    const findDeptsStmt = db.prepare(`
      SELECT department_id, share, cost_center_key, cost_center_name FROM invoice_departments WHERE sales_invoice_id = ?
    `);
    const findDeptsByOdooStmt = db.prepare(`
      SELECT department_id, share, cost_center_key, cost_center_name FROM invoice_departments WHERE company_id = ? AND odoo_invoice_id = ?
    `);

    const findCreditStmt = db.prepare(`
      SELECT id, move_name, move_type, date, journal_id, journal_name, journal_type, label, account_code, account_type, partner_id, partner_name
      FROM journal_items
      WHERE company_id = ? AND odoo_line_id = ?
    `);

    const findCounterpartsStmt = db.prepare(`
      SELECT id, odoo_line_id, account_code, account_name, account_type, tax_id, partner_id, partner_name, debit, credit
      FROM journal_items
      WHERE company_id = ? AND move_name = ? AND odoo_line_id != ?
    `);

    let coInserted = 0;

    const syncTransaction = db.transaction(() => {
      db.prepare('DELETE FROM payment_allocations WHERE company_id = ?').run(co.ledger_cid);

      for (const r of allRecs) {
        const dItem = findDebitStmt.get(co.sales_cid, co.ledger_cid, r.debit_move_id[0]);
        const cItem = findCreditStmt.get(co.ledger_cid, r.credit_move_id[0]);
        if (!dItem || !cItem) continue;

        const invDate = dItem.date || '';
        const invYear = invDate.slice(0, 4);
        const payDate = cItem.date || r.max_date || '';
        const payYear = payDate.slice(0, 4);
        const payQuarter = payDate ? `Q${Math.ceil((parseInt(payDate.slice(5, 7), 10) || 1) / 3)}` : '';
        const payMonth = payDate.slice(0, 7);

        // Fetch invoice departments
        let depts = [];
        if (dItem.local_invoice_id) {
          depts = findDeptsStmt.all(dItem.local_invoice_id);
        }
        if ((!depts || depts.length === 0) && dItem.odoo_invoice_id) {
          depts = findDeptsByOdooStmt.all(co.sales_cid, dItem.odoo_invoice_id);
        }
        if (!depts || depts.length === 0) {
          depts = [{
            department_id: 0,
            share: 1.0,
            cost_center_key: 'j:' + (dItem.invoice_journal_id || 0),
            cost_center_name: dItem.invoice_journal_name || 'بدون دفتر'
          }];
        }

        // B1: Define jType in parent loop scope so it is always available
        const jType = (cItem.journal_id && odooJournalMap.get(`${co.ledger_cid}_${cItem.journal_id}`))
          || (cItem.journal_name && odooJournalMap.get(`${co.ledger_cid}_${cItem.journal_name.trim()}`))
          || cItem.journal_type
          || '';

        const isBankOrCashJournal = ['bank', 'cash'].includes(jType);

        // Determine channel
        const isCreditNote = (cItem.move_type === 'out_refund')
          || (cItem.journal_type === 'sale_refund')
          || (jType === 'sale_refund');

        let counterpartRows = [];

        if (isCreditNote) {
          counterpartRows = [{
            account_code: cItem.account_code || '',
            account_name: cItem.account_name || cItem.journal_name || 'إشعار دائن',
            account_type: 'credit_note',
            partner_id: cItem.partner_id || 0,
            partner_name: cItem.partner_name || '',
            channel: 'credit_note',
            channel_label: 'إشعار دائن (خارج التحصيل)',
            sister_company_name: null,
            share: 1.0
          }];
        } else {
          const rawCounterparts = findCounterpartsStmt.all(co.ledger_cid, cItem.move_name, cItem.odoo_line_id || r.credit_move_id[0]);
          const nonReceivableLines = rawCounterparts.filter(cp => cp.account_type !== 'asset_receivable');
          const effectiveCounterparts = nonReceivableLines.length > 0 ? nonReceivableLines : rawCounterparts;

          const groupedCpMap = new Map();
          for (const cp of effectiveCounterparts) {
            const code = cp.account_code || '';
            if (!groupedCpMap.has(code)) {
              groupedCpMap.set(code, {
                account_code: code,
                account_name: cp.account_name || '',
                account_type: cp.account_type || '',
                tax_id: cp.tax_id || null,
                partner_id: cp.partner_id || 0,
                partner_name: cp.partner_name || '',
                val: 0
              });
            }
            const g = groupedCpMap.get(code);
            g.val += (cp.debit || cp.credit || 0);
            if (!g.partner_id && cp.partner_id) {
              g.partner_id = cp.partner_id;
              g.partner_name = cp.partner_name;
            }
            if (!g.partner_name && cp.partner_name) {
              g.partner_name = cp.partner_name;
            }
            if (!g.tax_id && cp.tax_id) {
              g.tax_id = cp.tax_id;
            }
          }
          const groupedCounterparts = Array.from(groupedCpMap.values());

          const hasExpenseInMove = effectiveCounterparts.some(cp =>
            (cp.account_type && cp.account_type.startsWith('expense'))
          );

          const targetLines = groupedCounterparts.length > 0 ? groupedCounterparts : [{
            account_code: cItem.account_code || '',
            account_name: cItem.account_name || cItem.journal_name || '',
            account_type: cItem.account_type || '',
            partner_id: cItem.partner_id || 0,
            partner_name: cItem.partner_name || '',
            val: 1
          }];

          const totVal = targetLines.reduce((s, cp) => s + (cp.val || 1), 0) || 1;

          counterpartRows = targetLines.map(cp => {
            let cpChannel = 'other_adjustment';
            let cpChannelLabel = 'تسويات أخرى';
            let cpSisterCoName = resolveSisterCompany(co.ledger_cid, cp.partner_id, cp.partner_name, cp.account_name);

            if (cpSisterCoName && !isBankOrCashJournal) {
              cpChannel = 'sister_company';
              cpChannelLabel = 'عبر شركة شقيقة';
            } else {
              // Check expense / discount fee (خارج التحصيل)
              const isExpense = (cp.account_type && cp.account_type.startsWith('expense'))
                || (hasExpenseInMove && !isBankOrCashJournal && (
                  (cp.account_type && cp.account_type.includes('tax'))
                  || cp.tax_id != null
                ));

              if (isExpense) {
                cpChannel = 'discount_fee';
                cpChannelLabel = 'خصومات ورسوم (خارج التحصيل)';
              } else if (isBankOrCashJournal || cp.account_type === 'asset_cash') {
                cpChannel = 'bank';
                cpChannelLabel = 'بنك ونقد';
              } else {
                cpChannel = 'other_adjustment';
                cpChannelLabel = 'تسويات أخرى';
              }
            }

            return {
              account_code: cp.account_code || '',
              account_name: cp.account_name || '',
              account_type: cp.account_type || '',
              partner_id: cp.partner_id || 0,
              partner_name: cp.partner_name || '',
              channel: cpChannel,
              channel_label: cpChannelLabel,
              sister_company_name: cpSisterCoName,
              share: (cp.val || 1) / totVal
            };
          });
        }

        if (counterpartRows.length === 0) {
          counterpartRows = [{
            account_code: '',
            account_name: '',
            account_type: '',
            partner_id: 0,
            partner_name: '',
            share: 1.0
          }];
        }

        // Insert allocation row for each department and counterpart combination
        for (const dept of depts) {
          const deptShare = dept.share || 1.0;
          const deptName = deptNames.get(dept.department_id) || 'غير مصنف';

          for (const cp of counterpartRows) {
            const cpShare = cp.share || 1.0;
            const allocAmount = Math.round((r.amount || 0) * deptShare * cpShare * 100) / 100;

            insertStmt.run({
              company_id: co.ledger_cid,
              sales_company_id: co.sales_cid,
              odoo_company_id: co.odoo_company_id,
              odoo_reconcile_id: r.id,
              amount: allocAmount,
              full_reconcile_id: Array.isArray(r.full_reconcile_id) ? r.full_reconcile_id[0] : (r.full_reconcile_id || null),
              invoice_id: dItem.odoo_invoice_id || null,
              invoice_name: dItem.move_name || '',
              invoice_date: invDate,
              invoice_year: invYear,
              invoice_journal_id: dItem.invoice_journal_id || 0,
              invoice_journal_name: dItem.invoice_journal_name || '',
              cost_center_key: dept.cost_center_key || ('j:' + (dItem.invoice_journal_id || 0)),
              cost_center_name: dept.cost_center_name || dItem.invoice_journal_name || 'بدون دفتر',
              partner_id: dItem.partner_id || 0,
              partner_name: dItem.partner_name || '',
              department_id: dept.department_id || 0,
              department_name: deptName,
              payment_line_id: r.credit_move_id[0],
              payment_move_name: cItem.move_name || '',
              payment_move_type: cItem.move_type || 'entry',
              payment_date: payDate,
              payment_year: payYear,
              payment_quarter: payQuarter,
              payment_month: payMonth,
              payment_journal_id: cItem.journal_id || 0,
              payment_journal_name: cItem.journal_name || '',
              payment_journal_type: jType || cItem.journal_type || '',
              payment_label: cItem.label || '',
              counterpart_account_code: cp.account_code,
              counterpart_account_name: cp.account_name,
              counterpart_account_type: cp.account_type,
              counterpart_partner_id: cp.partner_id || 0,
              counterpart_partner_name: cp.partner_name || '',
              counterpart_share: cpShare,
              channel: cp.channel,
              channel_label: cp.channel_label,
              sister_company_name: cp.sister_company_name
            });
            coInserted++;
          }
        }
      }
    });

    try {
      syncTransaction();
      db.prepare(`
        INSERT INTO sync_logs (company_id, sync_type, status, records_synced, completed_at)
        VALUES (?, 'payment_allocations', 'completed', ?, datetime('now'))
      `).run(co.ledger_cid, coInserted);
      console.log(`  ✓ Successfully inserted ${coInserted} allocation records for Company ${co.ledger_cid}.`);
      grandTotalAllocations += coInserted;
    } catch (err) {
      try {
        db.prepare(`
          INSERT INTO sync_logs (company_id, sync_type, status, error_message, completed_at)
          VALUES (?, 'payment_allocations', 'failed', ?, datetime('now'))
        `).run(co.ledger_cid, err.message);
      } catch (_) {}
      console.error(`  ❌ Failed syncing allocations for Company ${co.ledger_cid}:`, err.message);
      throw err;
    }
  }

  CacheService.flush();
  console.log(`\n🎉 Completed sync! Total payment allocations inserted: ${grandTotalAllocations}`);
  return { success: true, totalAllocations: grandTotalAllocations };
}

if (require.main === module) {
  syncAllPaymentAllocations()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Fatal error during sync:', err);
      process.exit(1);
    });
}

module.exports = { syncAllPaymentAllocations };
