const url = 'https://aboghaliaoffice.com/api/customer_invoices?company_id=1';
let baseUrl = url.replace(/\/+$/, '');
if (baseUrl.includes('/api/customer_invoices')) {
  baseUrl = baseUrl.split('/api/customer_invoices')[0];
}
const fullUrl = baseUrl + '/api/customer_invoices?company_id=1';
console.log(fullUrl);
