const { getDb } = require('../db/connection');
const CacheService = require('../services/cache');

function reclassifyPaymentAllocations() {
  const db = getDb();
  console.log('🚀 Starting reclassification of payment_allocations in database...');

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

  const findCreditStmt = db.prepare(`
    SELECT id, move_name, move_type, date, journal_id, journal_name, journal_type, label, account_code, account_name, account_type, partner_id, partner_name
    FROM journal_items
    WHERE company_id = ? AND odoo_line_id = ?
  `);

  const findCounterpartsStmt = db.prepare(`
    SELECT id, odoo_line_id, account_code, account_name, account_type, tax_id, partner_id, partner_name, debit, credit
    FROM journal_items
    WHERE company_id = ? AND move_name = ? AND odoo_line_id != ?
  `);

  const odooJournals = db.prepare('SELECT odoo_journal_id, company_id, name, type FROM odoo_journals').all();
  if (odooJournals.length === 0) {
    throw new Error('جدول odoo_journals فارغ! لا يمكن إعادة تصنيف تسويات السداد بدون أنواع دفاتر اليومية.');
  }
  const odooJournalMap = new Map();
  for (const oj of odooJournals) {
    odooJournalMap.set(`${oj.company_id}_${oj.odoo_journal_id}`, oj.type);
    odooJournalMap.set(`${oj.company_id}_${oj.name.trim()}`, oj.type);
  }

  const updateStmt = db.prepare(`
    UPDATE payment_allocations
    SET channel = @channel,
        channel_label = @channel_label,
        sister_company_name = @sister_company_name,
        payment_journal_id = COALESCE(NULLIF(@payment_journal_id, 0), payment_journal_id),
        payment_journal_type = COALESCE(NULLIF(@payment_journal_type, ''), payment_journal_type),
        counterpart_account_code = @counterpart_account_code,
        counterpart_account_name = @counterpart_account_name,
        counterpart_account_type = @counterpart_account_type,
        counterpart_partner_id = @counterpart_partner_id,
        counterpart_partner_name = @counterpart_partner_name
    WHERE id = @id
  `);

  const rows = db.prepare('SELECT * FROM payment_allocations').all();
  console.log(`Processing ${rows.length} allocation rows...`);

  let updatedCount = 0;
  let sisterCount = 0;
  let bankCount = 0;
  let discountCount = 0;
  let otherCount = 0;

  const tx = db.transaction(() => {
    for (const pa of rows) {
      if (!db.prepare('SELECT id FROM payment_allocations WHERE id = ?').get(pa.id)) {
        continue;
      }

      if (pa.channel === 'credit_note') {
        continue;
      }

      const cItem = findCreditStmt.get(pa.company_id, pa.payment_line_id);
      const isCreditNote = (cItem && cItem.move_type === 'out_refund')
        || (pa.payment_journal_type === 'sale_refund')
        || (cItem && cItem.journal_type === 'sale_refund');

      if (isCreditNote) {
        continue;
      }

      const jType = (pa.payment_journal_id && odooJournalMap.get(`${pa.company_id}_${pa.payment_journal_id}`))
        || (cItem && cItem.journal_id && odooJournalMap.get(`${pa.company_id}_${cItem.journal_id}`))
        || (pa.payment_journal_name && odooJournalMap.get(`${pa.company_id}_${pa.payment_journal_name.trim()}`))
        || pa.payment_journal_type
        || (cItem && cItem.journal_type)
        || '';

      const isCashOrBankJournal = ['bank', 'cash'].includes(jType);

      let cpItems = [];
      if (cItem) {
        cpItems = findCounterpartsStmt.all(pa.company_id, pa.payment_move_name, pa.payment_line_id);
      }

      if (cpItems.length === 0) {
        cpItems = [{
          account_code: pa.counterpart_account_code || (cItem ? cItem.account_code : ''),
          account_name: pa.counterpart_account_name || (cItem ? cItem.account_name : ''),
          account_type: pa.counterpart_account_type || (cItem ? cItem.account_type : ''),
          partner_id: pa.counterpart_partner_id || (cItem ? cItem.partner_id : 0),
          partner_name: pa.counterpart_partner_name || (cItem ? cItem.partner_name : '')
        }];
      }

      let matchedCp = null;
      if (pa.counterpart_account_code) {
        matchedCp = cpItems.find(c => c.account_code === pa.counterpart_account_code);
      }
      if (!matchedCp && cpItems.length > 0) {
        matchedCp = cpItems[0];
      }

      let cp = matchedCp || cpItems[0];

      let newChannel = 'other_adjustment';
      let newLabel = 'تسويات أخرى';
      let newSisterName = resolveSisterCompany(pa.company_id, cp.partner_id, cp.partner_name, cp.account_name);

      if (newSisterName && !isCashOrBankJournal) {
        newChannel = 'sister_company';
        newLabel = 'عبر شركة شقيقة';
        sisterCount++;
      } else if (cp.account_type === 'asset_receivable') {
        // Counterpart is a receivable line in a manual entry: trace the rest of the move lines
        const expLine = cpItems.find(x => x.account_type && x.account_type.startsWith('expense'));
        if (expLine) {
          newChannel = 'discount_fee';
          newLabel = 'خصومات ورسوم (خارج التحصيل)';
          cp = expLine;
          discountCount++;
        } else {
          const cashLine = cpItems.find(x => x.account_type === 'asset_cash');
          if (cashLine) {
            newChannel = 'bank';
            newLabel = 'بنك ونقد';
            cp = cashLine;
            bankCount++;
          } else {
            const sisterLine = cpItems.find(x => resolveSisterCompany(pa.company_id, x.partner_id, x.partner_name, x.account_name));
            if (sisterLine) {
              newChannel = 'sister_company';
              newLabel = 'عبر شركة شقيقة';
              newSisterName = resolveSisterCompany(pa.company_id, sisterLine.partner_id, sisterLine.partner_name, sisterLine.account_name);
              cp = sisterLine;
              sisterCount++;
            } else {
              newChannel = 'other_adjustment';
              newLabel = 'تسويات أخرى';
              otherCount++;
            }
          }
        }
      } else {
        // Check expense / discount fee: expense account or tax line accompanying an expense move
        const hasExpenseInMove = cpItems.some(x => x.account_type && x.account_type.startsWith('expense'));
        const isExpense = (cp.account_type && cp.account_type.startsWith('expense'))
          || (hasExpenseInMove && !isCashOrBankJournal && ((cp.account_type && cp.account_type.includes('tax')) || cp.tax_id != null));

        if (isExpense) {
          newChannel = 'discount_fee';
          newLabel = 'خصومات ورسوم (خارج التحصيل)';
          discountCount++;
        } else if (isCashOrBankJournal || cp.account_type === 'asset_cash') {
          newChannel = 'bank';
          newLabel = 'بنك ونقد';
          bankCount++;
        } else {
          newChannel = 'other_adjustment';
          newLabel = 'تسويات أخرى';
          otherCount++;
        }
      }

      // Check if a row with the new counterpart_account_code already exists for this reconcile
      const targetCode = cp.account_code || pa.counterpart_account_code;
      const sibling = db.prepare(`
        SELECT id, amount FROM payment_allocations
        WHERE company_id = ? AND odoo_reconcile_id = ? AND counterpart_account_code = ? AND department_id = ? AND cost_center_key = ? AND id != ?
      `).get(pa.company_id, pa.odoo_reconcile_id, targetCode, pa.department_id, pa.cost_center_key, pa.id);

      if (sibling) {
        db.prepare(`UPDATE payment_allocations SET amount = ROUND(amount + ?, 2) WHERE id = ?`).run(pa.amount, sibling.id);
        db.prepare(`DELETE FROM payment_allocations WHERE id = ?`).run(pa.id);
      } else {
        updateStmt.run({
          id: pa.id,
          channel: newChannel,
          channel_label: newLabel,
          sister_company_name: newSisterName,
          payment_journal_id: (cItem && cItem.journal_id) || pa.payment_journal_id || 0,
          payment_journal_type: jType || pa.payment_journal_type || '',
          counterpart_account_code: cp.account_code || pa.counterpart_account_code,
          counterpart_account_name: cp.account_name || pa.counterpart_account_name,
          counterpart_account_type: cp.account_type || pa.counterpart_account_type,
          counterpart_partner_id: cp.partner_id || pa.counterpart_partner_id,
          counterpart_partner_name: cp.partner_name || pa.counterpart_partner_name
        });
      }
      updatedCount++;
    }
  });

  tx();
  console.log(`✓ Reclassified ${updatedCount} rows: Bank=${bankCount}, Sister=${sisterCount}, Discount=${discountCount}, Other=${otherCount}`);
  CacheService.flush();
}

if (require.main === module) {
  reclassifyPaymentAllocations();
}

module.exports = { reclassifyPaymentAllocations };
