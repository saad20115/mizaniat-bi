/**
 * Simple reactive store for global app state
 */
class Store {
  constructor() {
    this.state = {
      currentPage: 'dashboard',
      companies: [],
      selectedCompanyIds: [],
      dateFrom: '',
      dateTo: '',
      costCenter: '',
      accountType: '',
      fiscalYear: '',
      filterOptions: { periods: [], fiscalYears: [], accountTypes: [], costCenters: [] },
      sidebarCollapsed: false,
      loading: false,
    };
    this.listeners = [];
  }

  get(key) {
    return this.state[key];
  }

  set(key, value) {
    this.state[key] = value;
    this.notify(key);
  }

  update(partial) {
    Object.assign(this.state, partial);
    Object.keys(partial).forEach(key => this.notify(key));
  }

  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  notify(key) {
    this.listeners.forEach(fn => fn(key, this.state[key], this.state));
  }

  getFilterParams() {
    const params = {};
    if (this.state.selectedCompanyIds.length > 0) {
      params.companyIds = this.state.selectedCompanyIds;
    }
    if (this.state.dateFrom) params.dateFrom = this.state.dateFrom;
    if (this.state.dateTo) params.dateTo = this.state.dateTo;
    if (this.state.costCenter) params.costCenter = this.state.costCenter;
    if (this.state.accountType) params.accountType = this.state.accountType;
    if (this.state.fiscalYear) params.fiscalYear = this.state.fiscalYear;
    return params;
  }
}

export const store = new Store();
