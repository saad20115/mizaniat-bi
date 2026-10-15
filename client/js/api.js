const API_BASE = '/api';

// In-flight request deduplication map for GET requests
const inflightRequests = new Map();
let currentClientDataVersion = null;

async function request(endpoint, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const isViewer = localStorage.getItem('mizaniat_viewer_mode') === 'true';
  const viewerToken = localStorage.getItem('mizaniat_viewer_token') || sessionStorage.getItem('mizaniat_viewer_token');
  const adminToken = localStorage.getItem('mizaniat_admin_token');
  const token = isViewer ? viewerToken : adminToken;

  // Deduplicate concurrent identical GET requests
  const isGet = method === 'GET' && !options.body;
  const reqKey = isGet ? `${token || 'anon'}:${endpoint}` : null;

  if (isGet && inflightRequests.has(reqKey)) {
    return inflightRequests.get(reqKey);
  }

  const reqPromise = (async () => {
    try {
      const url = `${API_BASE}${endpoint}`;
      const config = {
        headers: { 'Content-Type': 'application/json' },
        ...options
      };

      if (isViewer && viewerToken) {
        config.headers = { ...config.headers, 'x-viewer-token': viewerToken };
      } else if (adminToken) {
        config.headers = { ...config.headers, 'Authorization': `Bearer ${adminToken}` };
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
        localStorage.removeItem('mizaniat_viewer_token');
        sessionStorage.removeItem('mizaniat_viewer_token');
        localStorage.removeItem('mizaniat_viewer_info');
        window.location.href = '/login.html';
        throw new Error('جلسة غير صالحة');
      }

      // Check server data version and invalidate local client caches if changed
      const serverVersion = res.headers ? res.headers.get('x-data-version') : null;
      if (serverVersion) {
        if (currentClientDataVersion !== null && currentClientDataVersion !== serverVersion) {
          console.log(`[API] Server dataVersion changed (${currentClientDataVersion} -> ${serverVersion}), invalidating client caches`);
          invalidateClientCache();
        }
        currentClientDataVersion = serverVersion;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || err.message || `HTTP ${res.status}`);
      }
      return await res.json();
    } finally {
      if (reqKey) {
        inflightRequests.delete(reqKey);
      }
    }
  })();

  if (isGet) {
    inflightRequests.set(reqKey, reqPromise);
  }

  return reqPromise;
}

// Session-level cache for static or low-churn metadata (companies, filters)
const sessionCache = new Map();
const clientCacheInvalidators = new Set();

export function registerClientCacheInvalidator(fn) {
  if (typeof fn === 'function') {
    clientCacheInvalidators.add(fn);
  }
}

export function invalidateClientCache() {
  sessionCache.clear();
  for (const fn of clientCacheInvalidators) {
    try {
      fn();
    } catch (e) {
      console.error('[API] Cache invalidator error:', e);
    }
  }
}

if (typeof window !== 'undefined') {
  window.__invalidateClientCache = invalidateClientCache;
}

export const api = {
  clearCache: invalidateClientCache,
  invalidateClientCache,
  registerClientCacheInvalidator,

  // Companies
  getCompanies: async (options = {}) => {
    const cacheKey = 'companies';
    if (!options.fresh && sessionCache.has(cacheKey)) {
      return sessionCache.get(cacheKey);
    }
    const data = await request('/companies');
    sessionCache.set(cacheKey, data);
    return data;
  },
  createCompany: async (data) => {
    const res = await request('/companies', { method: 'POST', body: data });
    invalidateClientCache();
    return res;
  },
  updateCompany: async (id, data) => {
    const res = await request(`/companies/${id}`, { method: 'PUT', body: data });
    invalidateClientCache();
    return res;
  },

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
  getSpecialExpenses: () => request('/external/special-expenses'),

  // Analytic groups
  getAnalyticGroups: () => request('/analytic-groups'),
  createAnalyticGroup: (data) => request('/analytic-groups', { method: 'POST', body: data }),
  updateAnalyticGroup: (id, data) => request(`/analytic-groups/${id}`, { method: 'PUT', body: data }),
  deleteAnalyticGroup: (id) => request(`/analytic-groups/${id}`, { method: 'DELETE' }),
  getAnalyticAccounts: (params) => request(`/analytic-accounts?${buildQuery(params)}`),
  getAnalyticGroupMappings: (params) => request(`/analytic-group-mappings?${buildQuery(params)}`),
  saveAnalyticGroupMappings: (data) => request('/analytic-group-mappings', { method: 'POST', body: data }),
  getAttributionConflicts: (params = {}) => request(`/attribution/conflicts?${buildQuery(params)}`),
  getJournalDefaults: (companyId) => request(`/journal-defaults?companyId=${companyId}`),
  saveJournalDefault: (data) => request('/journal-defaults', { method: 'PUT', body: data }),
  deleteJournalDefault: (companyId, journalId) => request(`/journal-defaults?companyId=${companyId}&journalId=${journalId}`, { method: 'DELETE' }),
  rebuildAttribution: () => request('/attribution/rebuild', { method: 'POST', body: {} }),
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
  getScopedShares: () => request('/presentation/scoped-shares'),
  createScopedShare: (data) => request('/presentation/scoped-shares', { method: 'POST', body: data }),
  updateScopedShare: (id, data) => request(`/presentation/scoped-shares/${id}`, { method: 'PUT', body: data }),
  deleteScopedShare: (id) => request(`/presentation/scoped-shares/${id}`, { method: 'DELETE' }),
  getScopedShareLogs: (id) => request(`/presentation/scoped-shares/${id}/logs`),
  createClosingEntry: (data) => request('/closing-entry', { method: 'POST', body: data }),
  getClosingEntries: (params) => request(`/closing-entries?${buildQuery(params)}`),
  deleteClosingEntry: (params) => request(`/closing-entry?${buildQuery(params)}`, { method: 'DELETE' }),
  getCompanyAccounts: (params) => request(`/company-accounts?${buildQuery(params)}`),

  // Actual Collections (C1)
  getActualCollections: (params) => request(`/actual-collections?${buildQuery(params)}`),
  getActualCollectionPayments: (params) => request(`/actual-collections/payments?${buildQuery(params)}`),

  // Matrix Engine & Receivables (M1)
  getMatrix: (params) => request(`/matrix?${buildQuery(params)}`),
  getReceivables: (params) => request(`/receivables?${buildQuery(params)}`),
  getPerformanceSummary: (params) => request(`/performance-summary?${buildQuery(params)}`),
  getExecutiveSummary: (params) => request(`/executive?${buildQuery(params)}`),
  getExecutiveChildren: (params) => request(`/executive/children?${buildQuery(params)}`),
  getExecutiveInvoices: (params) => request(`/executive/invoices?${buildQuery(params)}`),
  getExecutiveAging: (params) => request(`/executive/aging?${buildQuery(params)}`),
  getCustomersCollection: (params) => request(`/customers-collection?${buildQuery(params)}`),
  getCustomerStatement: (params) => request(`/customers-collection/statement?${buildQuery(params)}`),
  getCustomersCollectionInvoices: (params) => request(`/customers-collection/invoices?${buildQuery(params)}`),
  getDepartmentsProfitability: (params) => request(`/departments-profitability?${buildQuery(params)}`),
  getDepartmentsComparison: (params) => request(`/departments-comparison?${buildQuery(params)}`),
  getVatReport: (params) => request(`/vat?${buildQuery(params)}`),
  getVatDetails: (params) => request(`/vat-details?${buildQuery(params)}`),
  updateCompanyVatPeriod: (id, vat_period) => request(`/companies/${id}/vat-period`, { method: 'PUT', body: { vat_period } }),
  getPreferences: (key) => request(`/preferences/${encodeURIComponent(key)}`),
  setPreferences: (key, data) => request(`/preferences/${encodeURIComponent(key)}`, { method: 'PUT', body: data }),
  getDepartmentConflicts: () => request('/data-quality/department-conflicts'),

  // Filters
  getFilterOptions: async (params, options = {}) => {
    const cacheKey = `filters:${buildQuery(params)}`;
    if (!options.fresh && sessionCache.has(cacheKey)) {
      return sessionCache.get(cacheKey);
    }
    const data = await request(`/filters?${buildQuery(params)}`);
    sessionCache.set(cacheKey, data);
    return data;
  },
  searchTree: (params) => request(`/search/tree?${buildQuery(params)}`),

  // Accounts
  getCompanyAccounts: (companyId) => request(`/accounts/company/${companyId}`),
  getUnifiedAccounts: () => request('/accounts/unified'),
  createUnifiedAccount: (data) => request('/accounts/unified', { method: 'POST', body: data }),
  createMapping: (data) => request('/accounts/mapping', { method: 'POST', body: data }),

  // Eliminations
  getEliminationRules: () => request('/eliminations'),
  createEliminationRule: (data) => request('/eliminations', { method: 'POST', body: data }),

  // Sync
  syncCompany: async (id) => {
    const res = await request(`/sync/company/${id}`, { method: 'POST' });
    invalidateClientCache();
    return res;
  },
  syncAll: async () => {
    const res = await request('/sync/all', { method: 'POST' });
    invalidateClientCache();
    return res;
  },
  getSyncStatus: () => request('/sync/status'),
  getLatestSyncStatus: () => request('/sync/latest-status'),
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
  toggleGuaranteeSubItem: (id, data) => request(`/guarantee-sub-items/${id}`, { method: 'PUT', body: data }),
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
