const invoices = [
  {
    raw_data: JSON.stringify({
      "company_name": "مكتب المهندس سمير صالح ابو غلية للاشتشارات الهندسية",
      "journal_name": "مختبر جدة",
      "amount_total_signed": 16184.85,
      "invoice_number": "INVJ/2025/00117",
      "payment_status": "Partially Paid"
    })
  },
  {
    raw_data: JSON.stringify({
      "id": 22937,
      "invoice_number": "RINVJ/2026/00001",
      "partner_name": "شركة الميال للمقاولات المحدوده",
      "invoice_date": "2026-01-12",
      "amount_total_signed": -124083.85,
      "amount_untaxed": -107899,
      "total_paid": 0,
      "status": "Posted",
      "move_type": "Customer Credit Note",
      "reference": "مرتجع لفاتورة INVJ/2025/00117",
      "payment_status": "not_paid"
    })
  }
];

const refToJournalMap = {};
invoices.forEach(inv => {
  try {
    const p = inv.raw_data ? JSON.parse(inv.raw_data) : {};
    const jn = (p.journal_name || '').trim();
    const num = (p.invoice_number || inv.invoice_number || inv.name || '').trim();
    if (jn && num) {
      refToJournalMap[num] = jn;
    }
  } catch(e) {}
});

console.log("Map:", refToJournalMap);

invoices.forEach(inv => {
  try {
    const p = inv.raw_data ? JSON.parse(inv.raw_data) : {};
    let journalName = (p.journal_name || '').trim();
    const ref = (p.reference || '').trim();
    if (!journalName && ref) {
      const match = Object.keys(refToJournalMap).find(k => ref.includes(k));
      if (match) journalName = refToJournalMap[match];
    }
    console.log(`Invoice: ${p.invoice_number}, DB Journal: ${p.journal_name}, Map fallback: ${journalName}`);
  } catch(e) {}
});
