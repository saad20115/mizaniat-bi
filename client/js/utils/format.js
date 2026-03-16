/**
 * Number and date formatting utilities
 */
export function formatNumber(num, decimals = 0) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  return Number(num).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

export function formatCurrency(num, currency = 'SAR') {
  if (num === null || num === undefined || isNaN(num)) return '0 ' + currency;
  const formatted = formatNumber(Math.abs(num), 2);
  const sign = num < 0 ? '-' : '';
  return `${sign}${formatted} ${currency}`;
}

export function formatCompact(num) {
  if (num === null || num === undefined || isNaN(num)) return '0';
  const abs = Math.abs(num);
  const sign = num < 0 ? '-' : '';
  if (abs >= 1000000) return `${sign}${(abs / 1000000).toFixed(2)}M`;
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(2)}K`;
  return `${sign}${abs.toFixed(0)}`;
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function formatPeriod(period) {
  if (!period) return '';
  const months = {
    '01': 'يناير', '02': 'فبراير', '03': 'مارس', '04': 'أبريل',
    '05': 'مايو', '06': 'يونيو', '07': 'يوليو', '08': 'أغسطس',
    '09': 'سبتمبر', '10': 'أكتوبر', '11': 'نوفمبر', '12': 'ديسمبر'
  };
  const parts = period.split('-');
  if (parts.length === 2) return `${months[parts[1]] || parts[1]} ${parts[0]}`;
  return period;
}

export function getMonthName(month) {
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const idx = parseInt(month) - 1;
  return names[idx] || month;
}
