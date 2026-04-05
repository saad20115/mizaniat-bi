const API_BASE = '/api';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options
  };

  // Attach JWT token if available
  const token = localStorage.getItem('mizaniat_admin_token');
  if (token) {
    config.headers = { ...config.headers, 'Authorization': `Bearer ${token}` };
  }
  
  if (config.body && typeof config.body === 'object') {
    config.body = JSON.stringify(config.body);
  }

  const res = await fetch(url, config);

  // Handle 401 — redirect to login
  if (res.status === 401) {
    localStorage.removeItem('mizaniat_admin_token');
    localStorage.removeItem('mizaniat_admin_info');
    localStorage.removeItem('mizaniat_viewer_mode');
    window.location.href = '/login.html';
    throw new Error('جلسة غير صالحة');
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  // Companies
  getCompanies: () => request('/companies'),
  createCompany: (data) => request('/companies', { method: 'POST', body: data }),
  updateCompany: (id, data) => request(`/companies/${id}`, { method: 'PUT', body: data }),

  // Instances
  getInstances: () => request('/instances'),
  createInstance: (data) => request('/instances', { method: 'POST', body: data }),
  updateInstance: (id, data) => request(`/instances/${id}`, { method: 'PUT', body: data }),
  deleteInstance: (id) => request(`/instances/${id}`, { method: 'DELETE' }),
  testInstance: (id, companyId) => request(`/instances/${id}/test`, { method: 'POST', body: { company_id: companyId } }),

  // Reports
  getDashboard: (params) => request(`/reports/dashboard?${buildQuery(params)}`),
  getIncomeStatement: (params) => request(`/reports/income-statement?${buildQuery(params)}`),
  getBalanceSheet: (params) => request(`/reports/balance-sheet?${buildQuery(params)}`),
  getCashFlow: (params) => request(`/reports/cash-flow?${buildQuery(params)}`),
  getPivotData: (params) => request(`/reports/pivot?${buildQuery(params)}`),
  getTrialBalance: (params) => request(`/reports/trial-balance?${buildQuery(params)}`),
  getDetailedTrialBalance: (params) => request(`/reports/detailed-trial-balance?${buildQuery(params)}`),
  getPartnerAccountConfig: (params) => request(`/partner-account-config?${buildQuery(params)}`),
  savePartnerAccountConfig: (data) => request('/partner-account-config', { method: 'POST', body: data }),

  // Analytic groups
  getAnalyticGroups: () => request('/analytic-groups'),
  createAnalyticGroup: (data) => request('/analytic-groups', { method: 'POST', body: data }),
  updateAnalyticGroup: (id, data) => request(`/analytic-groups/${id}`, { method: 'PUT', body: data }),
  deleteAnalyticGroup: (id) => request(`/analytic-groups/${id}`, { method: 'DELETE' }),
  getAnalyticAccounts: (params) => request(`/analytic-accounts?${buildQuery(params)}`),
  getAnalyticGroupMappings: (params) => request(`/analytic-group-mappings?${buildQuery(params)}`),
  saveAnalyticGroupMappings: (data) => request('/analytic-group-mappings', { method: 'POST', body: data }),
  getCompanyJournalNames: (companyId) => request(`/company-journal-names?companyId=${companyId}`),
  getJournalMappings: (companyId) => request(`/journal-mappings?companyId=${companyId}`),
  mergeJournals: (data) => request('/journal-mappings/merge', { method: 'POST', body: data }),

  // VAT Report
  getVATReport: (params) => request(`/vat-report?${buildQuery(params)}`),
  getTaxReportConfig: (companyId) => request(`/tax-report-config/${companyId}`),
  saveTaxReportConfig: (data) => request('/tax-report-config', { method: 'POST', body: data }),
  generateCustomTaxReport: (data) => request('/tax-report-custom', { method: 'POST', body: data }),

  // Presentation
  getPresentationData: (params) => request(`/presentation/data?${buildQuery(params)}`),
  getPresentationShares: () => request('/presentation/shares'),
  createPresentationShare: (data) => request('/presentation/share', { method: 'POST', body: data }),
  getPresentationShareData: (token) => request(`/presentation/share/${token}`),
  deletePresentationShare: (id) => request(`/presentation/share/${id}`, { method: 'DELETE' }),
  createClosingEntry: (data) => request('/closing-entry', { method: 'POST', body: data }),
  getClosingEntries: (params) => request(`/closing-entries?${buildQuery(params)}`),
  deleteClosingEntry: (params) => request(`/closing-entry?${buildQuery(params)}`, { method: 'DELETE' }),
  getCompanyAccounts: (params) => request(`/company-accounts?${buildQuery(params)}`),

  // Filters
  getFilterOptions: (params) => request(`/filters?${buildQuery(params)}`),

  // Accounts
  getCompanyAccounts: (companyId) => request(`/accounts/company/${companyId}`),
  getUnifiedAccounts: () => request('/accounts/unified'),
  createUnifiedAccount: (data) => request('/accounts/unified', { method: 'POST', body: data }),
  createMapping: (data) => request('/accounts/mapping', { method: 'POST', body: data }),

  // Eliminations
  getEliminationRules: () => request('/eliminations'),
  createEliminationRule: (data) => request('/eliminations', { method: 'POST', body: data }),

  // Sync
  syncCompany: (id) => request(`/sync/company/${id}`, { method: 'POST' }),
  syncAll: () => request('/sync/all', { method: 'POST' }),
  getSyncStatus: () => request('/sync/status'),
  getSyncProgress: (companyId) => request(`/sync/progress/${companyId}`),

  // Sync Schedule
  getSchedule: () => request('/sync/schedule'),
  updateSchedule: (data) => request('/sync/schedule', { method: 'PUT', body: data }),
  getNotifications: () => request('/sync/notifications'),
  clearNotifications: () => request('/sync/notifications', { method: 'DELETE' }),

  // Direct test (no save needed)
  testConnectionDirect: (data) => request('/test-connection', { method: 'POST', body: data }),

  // Journal Items
  getJournalItems: (params) => request(`/journal-items?${buildQuery(params)}`),

  // Account Statement
  getAccountStatement: (params) => request(`/account-statement?${buildQuery(params)}`),
  getAccountStatementAccounts: (params) => request(`/account-statement/accounts?${buildQuery(params)}`),
  getAccountStatementPartners: (params) => request(`/account-statement/partners?${buildQuery(params)}`),
  getGuaranteeDetails: (params) => request(`/guarantee-details?${buildQuery(params)}`),
  getGuaranteePendingList: (params) => request(`/guarantee-pending-list?${buildQuery(params)}`),
  getGuarantees: (params) => request(`/guarantees?${buildQuery(params)}`),
  releaseGuarantee: (data) => request('/guarantees/release', { method: 'POST', body: data }),
  unreleaseGuarantee: (params) => request(`/guarantees/release?${buildQuery(params)}`, { method: 'DELETE' }),
  getGuaranteeSubItems: (params) => request(`/guarantee-sub-items?${buildQuery(params)}`),
  addGuaranteeSubItem: (data) => request('/guarantee-sub-items', { method: 'POST', body: data }),
  deleteGuaranteeSubItem: (id) => request(`/guarantee-sub-items/${id}`, { method: 'DELETE' }),

  // Sales System API
  sales: {
    getCompanies: () => request('/sales/companies'),
    createCompany: (data) => request('/sales/companies', { method: 'POST', body: data }),
    updateCompany: (id, data) => request(`/sales/companies/${id}`, { method: 'PUT', body: data }),
    deleteCompany: (id) => request(`/sales/companies/${id}`, { method: 'DELETE' }),
    
    getInstances: () => request('/sales/instances'),
    createInstance: (data) => request('/sales/instances', { method: 'POST', body: data }),
    updateInstance: (id, data) => request(`/sales/instances/${id}`, { method: 'PUT', body: data }),
    deleteInstance: (id) => request(`/sales/instances/${id}`, { method: 'DELETE' }),
    testInstance: (id, companyId) => request(`/sales/instances/${id}/test`, { method: 'POST', body: { company_id: companyId } }),
    testConnectionDirect: (data) => request('/sales/test-connection', { method: 'POST', body: data }),

    getEliminationRules: () => request('/sales/eliminations'),
    createEliminationRule: (data) => request('/sales/eliminations', { method: 'POST', body: data }),

    syncCompany: (id) => request(`/sales/sync/company/${id}`, { method: 'POST' }),
    syncAll: () => request('/sales/sync/all', { method: 'POST' }),
    getSyncStatus: () => request('/sales/sync/status'),
    getSyncProgress: (companyId) => request(`/sales/sync/progress/${companyId}`),
    
    // Sync schedule and notifications for sales system
    getSchedule: () => request('/sales/settings/schedule'),
    updateSchedule: (data) => request('/sales/settings/schedule', { method: 'POST', body: data }),
    getNotifications: () => request('/sales/notifications'),
    clearNotifications: () => request('/sales/notifications/clear', { method: 'POST' }),

    // Invoices preview
    getInvoices: (params) => request('/sales/invoices?' + buildQuery(params)),
    getCustomerHierarchy: (params) => request('/sales/customer-hierarchy?' + buildQuery(params)),
  }
};

function buildQuery(params) {
  if (!params) return '';
  const parts = [];
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== '') {
      if (Array.isArray(val)) {
        parts.push(`${key}=${val.join(',')}`);
      } else {
        parts.push(`${key}=${encodeURIComponent(val)}`);
      }
    }
  }
  return parts.join('&');
}
