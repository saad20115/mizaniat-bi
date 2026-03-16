import { api } from '../api.js';
import { store } from '../store.js';
import { formatNumber } from '../utils/format.js';
import { showToast } from '../utils/ui.js';

const fmt = v => formatNumber(v, 2);

export async function renderAccountStatement(container) {
  const companies = store.get('companies') || [];
  const filterOptions = store.get('filterOptions') || {};
  const fiscalYears = filterOptions.fiscalYears || [];
  const lastYear = fiscalYears[fiscalYears.length - 1] || new Date().getFullYear().toString();

  container.innerHTML = `
    <style>
      .as-page{padding:20px 24px;max-width:1500px;margin:0 auto;direction:rtl}
      .as-header{display:flex;align-items:center;gap:14px;margin-bottom:18px}
      .as-header h1{font-size:1.5rem;font-weight:800;color:#e2e8f0;margin:0}
      .as-header .as-badge{font-size:0.78rem;color:#94a3b8;background:rgba(148,163,184,0.1);padding:4px 12px;border-radius:20px;border:1px solid rgba(148,163,184,0.15)}

      .as-filters{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;margin-bottom:18px;padding:16px 18px;background:linear-gradient(135deg,rgba(30,41,59,0.7),rgba(30,41,59,0.4));border:1px solid rgba(100,116,139,0.2);border-radius:14px;backdrop-filter:blur(8px)}
      .as-filter{display:flex;flex-direction:column;gap:4px;flex:0 0 auto}
      .as-filter label{font-size:0.78rem;color:#94a3b8;font-weight:600;letter-spacing:0.02em}
      .as-filter select,.as-filter input[type="date"],.as-filter input[type="text"]{background:rgba(15,23,42,0.6);border:1px solid rgba(100,116,139,0.25);color:#e2e8f0;padding:8px 12px;border-radius:8px;font-size:0.88rem;font-family:inherit;transition:border-color 0.2s}
      .as-filter select{min-width:170px}
      .as-filter select:focus,.as-filter input:focus{outline:none;border-color:#8b5cf6;box-shadow:0 0 0 2px rgba(139,92,246,0.15)}
      .as-filter select option{background:#1e293b;color:#e2e8f0}

      .as-actions{display:flex;gap:8px;align-items:flex-end;margin-right:auto}
      .as-btn{padding:8px 18px;border-radius:10px;border:none;cursor:pointer;font-size:0.85rem;font-weight:700;font-family:inherit;transition:all 0.2s;white-space:nowrap}
      .as-btn-primary{background:linear-gradient(135deg,#8b5cf6,#6d28d9);color:#fff;box-shadow:0 2px 8px rgba(139,92,246,0.25)}
      .as-btn-primary:hover{transform:translateY(-1px);box-shadow:0 4px 14px rgba(139,92,246,0.35)}
      .as-btn-print{background:rgba(16,185,129,0.1);color:#34d399;border:1px solid rgba(16,185,129,0.2)}
      .as-btn-print:hover{background:rgba(16,185,129,0.18)}
      .as-btn-excel{background:rgba(59,130,246,0.1);color:#60a5fa;border:1px solid rgba(59,130,246,0.2)}
      .as-btn-excel:hover{background:rgba(59,130,246,0.18)}

      .as-info{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;margin-bottom:16px}
      .as-info-card{background:linear-gradient(135deg,rgba(30,41,59,0.6),rgba(30,41,59,0.3));border:1px solid rgba(100,116,139,0.15);border-radius:10px;padding:12px 16px}
      .as-info-label{font-size:0.75rem;color:#64748b;margin-bottom:3px;font-weight:600}
      .as-info-value{font-size:1rem;font-weight:700;color:#e2e8f0;font-family:var(--font-en)}
      .as-info-value.ar{font-family:inherit}
      .as-info-value .nature{font-size:0.7rem;color:#94a3b8;margin-right:6px}

      .as-table-wrap{overflow-x:auto;border-radius:12px;border:1px solid rgba(100,116,139,0.15);background:rgba(15,23,42,0.3)}
      .as-table{width:100%;border-collapse:collapse;font-size:0.88rem}
      .as-table th{background:rgba(139,92,246,0.12);color:#c4b5fd;font-weight:700;padding:10px 12px;text-align:right;white-space:nowrap;border-bottom:2px solid rgba(139,92,246,0.2);font-size:0.82rem;letter-spacing:0.02em}
      .as-table td{padding:8px 12px;border-bottom:1px solid rgba(100,116,139,0.08);color:#cbd5e1;font-size:0.88rem}
      .as-table tbody tr:nth-child(even){background:rgba(255,255,255,0.015)}
      .as-table tbody tr:hover{background:rgba(139,92,246,0.04)}
      .as-table .num{text-align:left;font-family:var(--font-en);font-weight:600;direction:ltr;white-space:nowrap}
      .as-table .debit-val{color:#f87171}
      .as-table .credit-val{color:#34d399}
      .as-table .bal-pos{color:#34d399;font-weight:700}
      .as-table .bal-neg{color:#f87171;font-weight:700}
      .as-row-opening{background:rgba(59,130,246,0.08)!important}
      .as-row-opening td{color:#93c5fd;font-weight:700;font-size:0.9rem}
      .as-row-closing{background:rgba(139,92,246,0.1)!important}
      .as-row-closing td{color:#c4b5fd;font-weight:800;font-size:0.92rem}
      .as-row-totals{background:rgba(245,158,11,0.08)!important}
      .as-row-totals td{color:#fbbf24;font-weight:700}
      .as-empty{text-align:center;padding:50px 20px;color:#64748b;font-size:1.05rem}
      .as-count{font-size:0.75rem;color:#64748b;margin-top:8px;text-align:left;font-family:var(--font-en)}

      @media print{
        *{color:#000!important;background:#fff!important}
        body *{visibility:hidden}
        .as-print-area,.as-print-area *{visibility:visible}
        .as-print-area{position:absolute;left:0;top:0;width:100%;padding:15px;direction:rtl}
        .as-filters,.as-actions,.as-btn,.no-print,#sidebar,#sidebar-toggle{display:none!important}
        .as-table{border:1px solid #999}
        .as-table th{background:#eee!important;color:#333!important;border:1px solid #ccc;-webkit-print-color-adjust:exact;print-color-adjust:exact}
        .as-table td{border:1px solid #ddd;color:#111!important}
        .as-info-card{border:1px solid #ccc;padding:8px 12px}
        .as-info-label{color:#666!important}
        .as-info-value{color:#000!important}
        .as-row-opening td,.as-row-closing td,.as-row-totals td{color:#000!important}
        .as-table .debit-val,.as-table .credit-val,.as-table .bal-pos,.as-table .bal-neg{color:#000!important}
        .as-header h1{color:#000!important}
      }
    </style>
    <div class="as-page as-print-area">
      <div class="as-header">
        <h1>📄 كشف حساب</h1>
        <span class="as-badge">Account Statement</span>
      </div>

      <div class="as-filters no-print">
        <div class="as-filter">
          <label>🏢 الشركة</label>
          <select id="as-company">
            <option value="">اختر شركة</option>
            ${companies.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="as-filter">
          <label>📋 الحساب</label>
          <input type="text" id="as-account" list="as-account-list" placeholder="ابحث عن حساب..." autocomplete="off" style="min-width:280px">
          <datalist id="as-account-list"></datalist>
        </div>
        <div class="as-filter">
          <label>👤 الشريك / العميل</label>
          <select id="as-partner" style="min-width:200px">
            <option value="">الكل</option>
          </select>
        </div>
        <div class="as-filter">
          <label>📅 من</label>
          <input type="date" id="as-from" value="${lastYear}-01-01">
        </div>
        <div class="as-filter">
          <label>📅 إلى</label>
          <input type="date" id="as-to" value="${lastYear}-12-31">
        </div>
        <div class="as-actions">
          <button class="as-btn as-btn-primary" id="as-load">📊 عرض</button>
          <button class="as-btn as-btn-print" id="as-print" style="display:none">🖨️ طباعة</button>
          <button class="as-btn as-btn-excel" id="as-export" style="display:none">📥 Excel</button>
        </div>
      </div>

      <div id="as-result">
        <div class="as-empty">اختر شركة وحساب ثم اضغط "عرض"</div>
      </div>
    </div>
  `;

  const accountInput = container.querySelector('#as-account');
  const accountList = container.querySelector('#as-account-list');
  const partnerSelect = container.querySelector('#as-partner');
  let allAccounts = [];

  // Load accounts + partners when company changes
  container.querySelector('#as-company').addEventListener('change', async (e) => {
    const companyId = e.target.value;
    accountInput.value = '';
    accountList.innerHTML = '';
    partnerSelect.innerHTML = '<option value="">الكل</option>';
    if (!companyId) return;
    try {
      const [accs, partners] = await Promise.all([
        api.getAccountStatementAccounts({ companyId }),
        api.getAccountStatementPartners({ companyId })
      ]);
      allAccounts = accs;
      accountList.innerHTML = accs.map(a => `<option value="${a.account_code} — ${a.account_name}"></option>`).join('');
      partnerSelect.innerHTML = '<option value="">الكل (' + partners.length + ')</option>' +
        partners.map(p => `<option value="${p}">${p}</option>`).join('');
    } catch (err) {
      showToast('خطأ في تحميل البيانات', 'error');
    }
  });

  container.querySelector('#as-load').addEventListener('click', () => loadStatement(container));
  container.querySelector('#as-print').addEventListener('click', () => window.print());
  container.querySelector('#as-export').addEventListener('click', () => exportExcel(container));
}

let lastStatementData = null;
let lastFilteredItems = null;

async function loadStatement(container) {
  const companyId = container.querySelector('#as-company').value;
  const accountRaw = container.querySelector('#as-account').value;
  // Extract account code from "CODE — NAME" format
  const accountCode = accountRaw.split('—')[0].split(' — ')[0].trim();
  const dateFrom = container.querySelector('#as-from').value;
  const dateTo = container.querySelector('#as-to').value;
  const partnerFilter = container.querySelector('#as-partner').value;
  const result = container.querySelector('#as-result');

  if (!companyId || !accountCode) {
    showToast('اختر شركة وحساب', 'warning');
    return;
  }

  result.innerHTML = '<div class="as-empty">⏳ جاري تحميل الكشف...</div>';

  try {
    const data = await api.getAccountStatement({ companyId, accountCode, dateFrom, dateTo });
    lastStatementData = data;
    renderStatement(container, data, dateFrom, dateTo, partnerFilter);
    container.querySelector('#as-print').style.display = '';
    container.querySelector('#as-export').style.display = '';
  } catch (err) {
    result.innerHTML = `<div class="as-empty" style="color:#f87171">❌ ${err.message}</div>`;
  }
}

function renderStatement(container, data, dateFrom, dateTo, partnerFilter) {
  const result = container.querySelector('#as-result');
  const { company, account, openingBalance, items, closingBalance } = data;

  // Filter by partner if specified
  let filtered = items;
  if (partnerFilter) {
    filtered = items.filter(item => item.partner_name === partnerFilter);
  }
  // Recalculate running balance for filtered items
  let runBal = openingBalance;
  filtered = filtered.map(item => {
    runBal += (item.debit || 0) - (item.credit || 0);
    return { ...item, runningBalance: runBal };
  });
  const totalDebit = filtered.reduce((s, i) => s + (i.debit || 0), 0);
  const totalCredit = filtered.reduce((s, i) => s + (i.credit || 0), 0);
  const filteredClosing = openingBalance + totalDebit - totalCredit;
  lastFilteredItems = { filtered, totalDebit, totalCredit, closingBalance: filteredClosing };

  const balCls = v => v >= 0 ? 'bal-pos' : 'bal-neg';
  const balNat = v => v > 0 ? 'مدين' : (v < 0 ? 'دائن' : 'متزن');

  result.innerHTML = `
    <div class="as-info">
      <div class="as-info-card">
        <div class="as-info-label">الشركة</div>
        <div class="as-info-value ar">${company.name}</div>
      </div>
      <div class="as-info-card">
        <div class="as-info-label">الحساب</div>
        <div class="as-info-value ar" style="font-size:0.9rem">${account.account_code} — ${account.account_name}</div>
      </div>
      <div class="as-info-card">
        <div class="as-info-label">الفترة</div>
        <div class="as-info-value">${dateFrom || '—'} → ${dateTo || '—'}</div>
      </div>
      <div class="as-info-card">
        <div class="as-info-label">الحركات</div>
        <div class="as-info-value">${filtered.length}${partnerFilter ? ` <span class="nature">من ${items.length}</span>` : ''}</div>
      </div>
      <div class="as-info-card" style="border-color:rgba(139,92,246,0.3)">
        <div class="as-info-label">الرصيد النهائي</div>
        <div class="as-info-value ${balCls(filteredClosing)}" style="font-size:1.15rem">${fmt(Math.abs(filteredClosing))} <span class="nature">${balNat(filteredClosing)}</span></div>
      </div>
    </div>

    <div class="as-table-wrap">
      <table class="as-table" id="as-data-table">
        <thead>
          <tr>
            <th style="width:40px">#</th>
            <th>التاريخ</th>
            <th>رقم القيد</th>
            <th>البيان</th>
            <th>الطرف / الشريك</th>
            <th>مدين</th>
            <th>دائن</th>
            <th>الرصيد</th>
          </tr>
        </thead>
        <tbody>
          <tr class="as-row-opening">
            <td></td>
            <td colspan="4" style="text-align:center">📌 الرصيد الافتتاحي</td>
            <td class="num"></td>
            <td class="num"></td>
            <td class="num ${balCls(openingBalance)}">${fmt(Math.abs(openingBalance))} <small>${balNat(openingBalance)}</small></td>
          </tr>
          ${filtered.length === 0 ? '<tr><td colspan="8" class="as-empty" style="padding:30px">لا توجد حركات</td></tr>' : ''}
          ${filtered.map((item, i) => `
            <tr>
              <td style="color:#475569;font-size:0.78rem;text-align:center">${i + 1}</td>
              <td style="white-space:nowrap;font-family:var(--font-en);color:#94a3b8;font-size:0.85rem">${item.date}</td>
              <td style="font-family:var(--font-en);font-size:0.82rem;color:#818cf8">${item.move_name || ''}</td>
              <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis">${item.label || item.move_ref || '—'}</td>
              <td style="font-size:0.85rem;color:#94a3b8">${item.partner_name || ''}</td>
              <td class="num ${item.debit ? 'debit-val' : ''}">${item.debit ? fmt(item.debit) : ''}</td>
              <td class="num ${item.credit ? 'credit-val' : ''}">${item.credit ? fmt(item.credit) : ''}</td>
              <td class="num ${balCls(item.runningBalance)}">${fmt(Math.abs(item.runningBalance))}</td>
            </tr>
          `).join('')}
          <tr class="as-row-totals">
            <td></td>
            <td colspan="4" style="text-align:center">📊 إجمالي الحركات</td>
            <td class="num" style="font-size:0.95rem">${fmt(totalDebit)}</td>
            <td class="num" style="font-size:0.95rem">${fmt(totalCredit)}</td>
            <td class="num"></td>
          </tr>
          <tr class="as-row-closing">
            <td></td>
            <td colspan="4" style="text-align:center">📌 الرصيد الختامي</td>
            <td class="num"></td>
            <td class="num"></td>
            <td class="num ${balCls(filteredClosing)}" style="font-size:1.05rem">${fmt(Math.abs(filteredClosing))} <small>${balNat(filteredClosing)}</small></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="as-count">${filtered.length} rows · ${company.currency || 'SAR'}</div>
  `;
}

function exportExcel(container) {
  if (!lastStatementData || !lastFilteredItems) return;
  const { company, account, openingBalance } = lastStatementData;
  const { filtered, totalDebit, totalCredit, closingBalance } = lastFilteredItems;
  const dateFrom = container.querySelector('#as-from').value;
  const dateTo = container.querySelector('#as-to').value;

  let csv = '\uFEFF';
  csv += `كشف حساب — ${company.name}\n`;
  csv += `الحساب: ${account.account_code} — ${account.account_name}\n`;
  csv += `الفترة: ${dateFrom} إلى ${dateTo}\n\n`;
  csv += '#,التاريخ,رقم القيد,البيان,الطرف,مدين,دائن,الرصيد\n';
  csv += `,,,الرصيد الافتتاحي,,,,"${openingBalance}"\n`;

  filtered.forEach((item, i) => {
    const label = (item.label || item.move_ref || '').replace(/"/g, '""');
    const partner = (item.partner_name || '').replace(/"/g, '""');
    csv += `${i + 1},"${item.date}","${item.move_name || ''}","${label}","${partner}",${item.debit || 0},${item.credit || 0},${item.runningBalance}\n`;
  });

  csv += `,,,,إجمالي الحركات,${totalDebit},${totalCredit},\n`;
  csv += `,,,,الرصيد الختامي,,,"${closingBalance}"\n`;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `كشف_حساب_${account.account_code}_${dateFrom}_${dateTo}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('✅ تم تصدير الكشف', 'success');
}
