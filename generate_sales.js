const fs = require('fs');
let content = fs.readFileSync('client/js/pages/settings.js', 'utf8');

// Replacements
content = content.replace(/export async function renderSettings/g, 'export async function renderSalesSettings');
content = content.replace(/store\.set\('companies'/g, "store.set('sales_companies'");
content = content.replace(/store\.get\('companies'\)/g, "store.get('sales_companies')");

content = content.replace(/⚙️ إعدادات النظام/g, '🛍️ إعدادات نظام المبيعات');
content = content.replace(/إدارة الاتصال بأودو/g, 'إدارة الاتصال بنظام المبيعات');
content = content.replace(/أودو/g, 'المبيعات');

// Replace API calls cautiously
content = content.replace(/api\.testConnectionDirect/g, 'api.sales.testConnectionDirect');
content = content.replace(/api\.createInstance/g, 'api.sales.createInstance');
content = content.replace(/api\.getInstances/g, 'api.sales.getInstances');
content = content.replace(/api\.deleteInstance/g, 'api.sales.deleteInstance');
content = content.replace(/api\.updateCompany/g, 'api.sales.updateCompany');
content = content.replace(/api\.createCompany/g, 'api.sales.createCompany');
content = content.replace(/api\.getCompanies/g, 'api.sales.getCompanies');
content = content.replace(/api\.syncCompany/g, 'api.sales.syncCompany');
content = content.replace(/api\.syncAll/g, 'api.sales.syncAll');
content = content.replace(/api\.getSyncProgress/g, 'api.sales.getSyncProgress');
content = content.replace(/api\.getEliminationRules/g, 'api.sales.getEliminationRules');
content = content.replace(/api\.createEliminationRule/g, 'api.sales.createEliminationRule');
content = content.replace(/api\.getSyncStatus/g, 'api.sales.getSyncStatus');
content = content.replace(/api\.getSchedule/g, 'api.sales.getSchedule');
content = content.replace(/api\.updateSchedule/g, 'api.sales.updateSchedule');
content = content.replace(/api\.getNotifications/g, 'api.sales.getNotifications');
content = content.replace(/api\.clearNotifications/g, 'api.sales.clearNotifications');

// In createCompany
content = content.replace(/odoo_company_id:/g, 'sales_company_id:');
content = content.replace(/odoo_instance_id:/g, 'sales_instance_id:');
// In renderCompanies
content = content.replace(/odoo_instance_id/g, 'sales_instance_id');
content = content.replace(/odoo_company_id/g, 'sales_company_id');

fs.writeFileSync('client/js/pages/sales-settings.js', content, 'utf8');
console.log('done');
