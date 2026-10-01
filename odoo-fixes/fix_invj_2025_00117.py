# -*- coding: utf-8 -*-
"""
Restore the deleted revenue line of invoice INVJ/2025/00117 (company 1, DB second_odoo_17).

The line was removed on 2025-12-25, after the invoice had been submitted to ZATCA
(2025-10-26). Source of truth: the ZATCA XML attached to the invoice
(materials lab services 107,899.00 + VAT 16,184.85 = 124,083.85) and the full
credit note RINVJ/2026/00001, whose product line is a copy of the original.

The invoice stays posted; its ZATCA state, chain index and UUID must not change.
File is ASCII-only on purpose (Arabic text as \\u escapes) so it can be pasted safely.

Run (DRY_RUN first, then set DRY_RUN = False and run again):
    echo "exec(open('/tmp/fix_invj_2025_00117.py').read())" | \
        <odoo-bin> shell -c <odoo.conf> -d second_odoo_17 --no-http
"""
from odoo.tools import float_compare

DRY_RUN = True          # True = simulate and roll back. Set to False only after a clean dry run.

MOVE_ID = 19519
EXPECTED = {
    'name': 'INVJ/2025/00117',
    'company_id': 1,
    'debit': 124083.85,
    'credit': 16184.85,
    'residual': 118193.55,
}
NEW_LINE = {
    'display_type': 'product',
    'name': '\u062e\u062f\u0645\u0627\u062a \u0645\u062e\u062a\u0628\u0631 \u0645\u0648\u0627\u062f',
    'product_id': 113,              # [810] materials lab services
    'product_uom_id': 1,            # Units
    'quantity': 1.0,
    'price_unit': 107899.0,
    'discount': 0.0,
    'tax_ids': [(6, 0, [3])],       # 15% (price excluded)
    'account_id': 193,              # 510001 operating revenue
    'analytic_distribution': {'27': 100},   # Jeddah lab
    'partner_id': 199,              # the customer of the invoice
    'currency_id': 150,             # SAR
    'balance': -107899.0,
    'amount_currency': -107899.0,
    'sequence': 1,
}
NOTE = ('\u062a\u0645\u062a \u0625\u0639\u0627\u062f\u0629 \u0633\u0637\u0631 \u0627\u0644\u0625\u064a\u0631\u0627\u062f '
        '\u0627\u0644\u0645\u062d\u0630\u0648\u0641 (\u062e\u062f\u0645\u0627\u062a \u0645\u062e\u062a\u0628\u0631 '
        '\u0645\u0648\u0627\u062f - 107,899.00) \u0643\u0645\u0627 \u0647\u0648 \u0641\u064a \u0645\u0644\u0641 '
        '\u0632\u0627\u062a\u0643\u0627 \u0627\u0644\u0645\u0631\u0633\u0644 \u0628\u062a\u0627\u0631\u064a\u062e '
        '2025-10-26. \u0644\u0645 \u062a\u062a\u063a\u064a\u0631 \u062d\u0627\u0644\u0629 \u0627\u0644\u0641\u0627\u062a\u0648\u0631\u0629 '
        '\u0648\u0644\u0627 \u0628\u064a\u0627\u0646\u0627\u062a \u0632\u0627\u062a\u0643\u0627.')


def eq(a, b):
    return float_compare(a, b, precision_digits=2) == 0


def stop(msg):
    raise Exception('STOP - nothing was changed: ' + msg)


def main():
    move = env['account.move'].browse(MOVE_ID).exists()
    if not move:
        stop('move %s not found' % MOVE_ID)

    # --- 1. Guards: the invoice must still be in exactly the broken state we analysed
    if move.name != EXPECTED['name']:
        stop('unexpected name %r' % move.name)
    if move.company_id.id != EXPECTED['company_id']:
        stop('unexpected company %s' % move.company_id.id)
    if move.state != 'posted':
        stop('invoice is not posted (%s)' % move.state)
    if move.line_ids.filtered(lambda l: l.display_type == 'product'):
        stop('a product line already exists - the invoice may already be fixed')
    debit = sum(move.line_ids.mapped('debit'))
    credit = sum(move.line_ids.mapped('credit'))
    if not (eq(debit, EXPECTED['debit']) and eq(credit, EXPECTED['credit'])):
        stop('unexpected totals debit=%s credit=%s' % (debit, credit))
    tax_line = move.line_ids.filtered(lambda l: l.display_type == 'tax')
    if len(tax_line) != 1 or not eq(tax_line.tax_base_amount, 107899.0) or not eq(tax_line.credit, 16184.85):
        stop('tax line is not as expected')
    if not eq(move.amount_residual, EXPECTED['residual']):
        stop('unexpected residual %s' % move.amount_residual)

    zatca_before = (move.edi_state, move.l10n_sa_chain_index, move.l10n_sa_uuid)
    print('BEFORE: untaxed=%s tax=%s total=%s residual=%s zatca=%s' % (
        move.amount_untaxed, move.amount_tax, move.amount_total, move.amount_residual, zatca_before))

    # --- 2. Restore the line without re-synchronising tax / receivable lines
    ctx = dict(check_move_validity=False, skip_invoice_sync=True,
               skip_invoice_line_sync=True, skip_account_move_synchronization=True)
    line = env['account.move.line'].with_context(**ctx).create(dict(NEW_LINE, move_id=move.id))
    env.flush_all()
    move.invalidate_recordset()

    # --- 3. Verify the result
    debit = sum(move.line_ids.mapped('debit'))
    credit = sum(move.line_ids.mapped('credit'))
    zatca_after = (move.edi_state, move.l10n_sa_chain_index, move.l10n_sa_uuid)
    print('AFTER:  untaxed=%s tax=%s total=%s residual=%s zatca=%s' % (
        move.amount_untaxed, move.amount_tax, move.amount_total, move.amount_residual, zatca_after))
    print('        new line id=%s credit=%s subtotal=%s total=%s; entry debit=%s credit=%s' % (
        line.id, line.credit, line.price_subtotal, line.price_total, debit, credit))

    problems = []
    if not (eq(debit, 124083.85) and eq(credit, 124083.85)):
        problems.append('entry not balanced')
    if not (eq(move.amount_untaxed, 107899.0) and eq(move.amount_tax, 16184.85) and eq(move.amount_total, 124083.85)):
        problems.append('invoice totals wrong')
    if not eq(move.amount_residual, EXPECTED['residual']):
        problems.append('residual changed')
    if zatca_after != zatca_before:
        problems.append('ZATCA fields changed')
    if len(move.line_ids) != 3:
        problems.append('unexpected number of lines (%s)' % len(move.line_ids))

    if problems:
        env.cr.rollback()
        stop('verification failed: ' + ', '.join(problems) + ' (rolled back)')

    if DRY_RUN:
        env.cr.rollback()
        print('DRY RUN OK - all checks passed. Rolled back; nothing saved. Set DRY_RUN = False to apply.')
        return

    # Internal note only (mt_note): no email to the customer or followers
    move.message_post(subtype_xmlid='mail.mt_note', body=NOTE)
    env.cr.commit()
    print('APPLIED - changes committed.')


main()
