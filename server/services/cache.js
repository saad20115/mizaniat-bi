const NodeCache = require('node-cache');

// Bounded in-memory cache with safety TTL (12 hours) and key limit (500 entries)
// Per Claude R2-8 specifications
const cache = new NodeCache({
  stdTTL: 43200,      // 12 hours safety TTL
  checkperiod: 600,   // Check expired keys every 10 minutes
  maxKeys: 500        // Prevent unbounded memory growth
});

let dataVersion = 1;

function getRiyadhDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date());
}

let lastRiyadhDate = getRiyadhDate();

function checkDateRollover() {
  const today = getRiyadhDate();
  if (today !== lastRiyadhDate) {
    console.log(`[Cache] Day rolled over in Riyadh (${lastRiyadhDate} -> ${today}), flushing cache...`);
    lastRiyadhDate = today;
    CacheService.flush();
  }
}

const inFlightPromises = new Map();

function yieldToEventLoop() {
  return new Promise(resolve => setImmediate(resolve));
}

const CacheService = {
  _warmupDebounceTimer: null,

  getDataVersion() {
    return dataVersion;
  },

  getRiyadhToday() {
    return getRiyadhDate();
  },

  get(key) {
    checkDateRollover();
    return cache.get(key);
  },

  set(key, value, ttl = 0) {
    checkDateRollover();
    try {
      const keys = cache.keys();
      if (keys.length >= 480) {
        // Evict 30 oldest entries before set to prevent hitting 500 maxKeys
        cache.del(keys.slice(0, 30));
      }
      return cache.set(key, value, ttl);
    } catch (err) {
      console.warn('[Cache] Set error caught gracefully:', err.message);
      try {
        const keys = cache.keys();
        if (keys.length > 50) {
          cache.del(keys.slice(0, 50));
          return cache.set(key, value, ttl);
        }
      } catch (e2) {
        console.warn('[Cache] Retry set failed, continuing without caching:', e2.message);
      }
      return false;
    }
  },

  /**
   * Get cached value or compute it with in-flight request coalescing
   */
  async getOrSet(key, computeFn, ttl = 0) {
    checkDateRollover();
    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    if (inFlightPromises.has(key)) {
      return inFlightPromises.get(key);
    }
    const promise = (async () => {
      try {
        const value = await computeFn();
        try {
          this.set(key, value, ttl);
        } catch (e) {
          console.warn('[Cache] non-critical set error in getOrSet:', e.message);
        }
        return value;
      } finally {
        inFlightPromises.delete(key);
      }
    })();
    inFlightPromises.set(key, promise);
    return promise;
  },

  /**
   * Generate cache key from request params, bound to dataVersion
   */
  makeKey(prefix, params = {}) {
    checkDateRollover();
    const sortedParams = {};
    if (params && typeof params === 'object') {
      Object.keys(params).sort().forEach(k => {
        if (params[k] !== undefined && params[k] !== null && params[k] !== '') {
          sortedParams[k] = params[k];
        }
      });
    }
    return `v${dataVersion}:${prefix}:${JSON.stringify(sortedParams)}`;
  },

  /**
   * Invalidate all cache entries and trigger debounced phased warmup
   */
  flush() {
    dataVersion++;
    cache.flushAll();
    inFlightPromises.clear();
    console.log(`[Cache] Flushed all cached data (new version: v${dataVersion})`);
    
    // Debounce warmup (~2s) so batch settings updates don't repeatedly trigger heavy warmups
    if (this._warmupDebounceTimer) {
      clearTimeout(this._warmupDebounceTimer);
    }
    this._warmupDebounceTimer = setTimeout(() => {
      this._warmupDebounceTimer = null;
      this.warmupCache();
    }, 2000);
  },

  /**
   * Invalidate entries matching a pattern
   */
  invalidatePattern(pattern) {
    const keys = cache.keys();
    let count = 0;
    for (const key of keys) {
      if (key.includes(pattern)) {
        cache.del(key);
        count++;
      }
    }
    console.log(`[Cache] Invalidated ${count} entries matching pattern "${pattern}"`);
  },

  /**
   * Phased, non-blocking cache warmup for presentation tabs + side reports
   * Uses setImmediate between steps to allow incoming requests to pass without freezing the event loop
   */
  async warmupCache() {
    try {
      const startTime = Date.now();
      const ConsolidationEngine = require('./consolidation');
      const engine = new ConsolidationEngine();
      const today = getRiyadhDate();
      const currentYear = today.slice(0, 4);
      const dateFrom = `${currentYear}-01-01`;
      const dateTo = `${currentYear}-12-31`;

      const warmStep = async (keys, computeFn) => {
        const primaryKey = Array.isArray(keys) ? keys[0] : keys;
        const allKeys = Array.isArray(keys) ? keys : [keys];
        if (this.get(primaryKey) !== undefined) return;
        
        await this.getOrSet(primaryKey, async () => {
          const val = await computeFn();
          for (const k of allKeys) {
            if (k !== primaryKey) this.set(k, val);
          }
          return val;
        });
        await yieldToEventLoop();
      };

      // 1. Filters (default view)
      await warmStep(this.makeKey('filters', {}), () => engine.getFilterOptions({}));

      // 2. Executive Summary (exact UI params + fallback signature)
      const execKey1 = this.makeKey('executive', { years: [currentYear], dateFrom, dateTo, fullTree: false, includeAging: false });
      const execKey2 = this.makeKey('executive', { years: [currentYear], fullTree: false, includeAging: false });
      await warmStep([execKey1, execKey2], () => engine.getExecutiveSummary({ years: [currentYear], dateFrom, dateTo }));

      // 3. Customers Collection
      const custKey1 = this.makeKey('customers-collection', { years: [currentYear], dateFrom, dateTo, includeInvoices: false });
      const custKey2 = this.makeKey('customers-collection', { years: [currentYear], includeInvoices: false });
      const custKey3 = this.makeKey('customers-collection', { years: [currentYear] });
      await warmStep([custKey1, custKey2, custKey3], () => engine.getCustomersCollection({ years: [currentYear], dateFrom, dateTo }));

      // 4. Departments Profitability
      const profKey1 = this.makeKey('departments-profitability', { years: [currentYear], dateFrom, dateTo, measure: 'net', timeGrain: 'year', redistributeAdmin: false });
      const profKey2 = this.makeKey('departments-profitability', { years: [currentYear], measure: 'net', timeGrain: 'year', redistributeAdmin: false });
      await warmStep([profKey1, profKey2], () => engine.getDepartmentsProfitability({ years: [currentYear], dateFrom, dateTo, measure: 'net', timeGrain: 'year', redistributeAdmin: false }));

      // 5. Guarantees
      const guarKey1 = this.makeKey('guarantees', { asOfDate: dateTo });
      const guarKey2 = this.makeKey('guarantees', { asOfDate: today });
      const guarKey3 = this.makeKey('guarantees', {});
      await warmStep([guarKey1, guarKey2, guarKey3], () => engine.getActiveGuarantees({ asOfDate: dateTo }));

      // 6. VAT Report
      const vatKey1 = this.makeKey('vat', { years: [currentYear], dateFrom, dateTo, grain: 'vat_period' });
      const vatKey2 = this.makeKey('vat', { years: [currentYear], grain: 'vat_period' });
      await warmStep([vatKey1, vatKey2], () => engine.getVatReport({ years: [currentYear], dateFrom, dateTo, grain: 'vat_period' }));

      // 7. Dashboard KPIs (Claude R2-11)
      const dashKey1 = this.makeKey('dashboard', { dateFrom, dateTo });
      const dashKey2 = this.makeKey('dashboard', {});
      await warmStep(dashKey1, () => engine.getDashboardKPIs({ dateFrom, dateTo }));
      await warmStep(dashKey2, () => engine.getDashboardKPIs({}));

      // 8. Balance Sheet
      const balKey1 = this.makeKey('balance', { fiscalYear: currentYear });
      const balKey2 = this.makeKey('balance', { asOfDate: dateTo });
      const balKey3 = this.makeKey('balance', { fiscalYear: String(currentYear) });
      await warmStep([balKey1, balKey2, balKey3], () => engine.getBalanceSheet({ fiscalYear: currentYear, asOfDate: dateTo }));

      // 9. Income Statement (Claude R2-11)
      const incKey1 = this.makeKey('income', { dateFrom, dateTo });
      const incKey2 = this.makeKey('income', { years: String(currentYear) });
      const incKey3 = this.makeKey('income', { years: currentYear });
      await warmStep([incKey1, incKey2, incKey3], () => engine.getIncomeStatement({ dateFrom, dateTo }));

      // 10. Cash Flow (Claude R2-11)
      const cfKey1 = this.makeKey('cashflow', { dateFrom, dateTo });
      const cfKey2 = this.makeKey('cash-flow', { dateFrom, dateTo });
      const cfKey3 = this.makeKey('cashflow', {});
      const cfKey4 = this.makeKey('cash-flow', {});
      await warmStep([cfKey1, cfKey2, cfKey3, cfKey4], () => engine.getCashFlow({ dateFrom, dateTo }));

      // 11. Actual Collections (Stage C1-R4)
      const allCoIdsStr = '1,2,3,4';
      const colKey1 = this.makeKey('actual-collections', { companyIds: allCoIdsStr, years: [currentYear], dateFrom, dateTo, timeGrain: 'month' });
      const colKey2 = this.makeKey('actual-collections', { companyIds: allCoIdsStr, years: currentYear, dateFrom, dateTo, timeGrain: 'month' });
      const colKey3 = this.makeKey('actual-collections', { companyIds: allCoIdsStr, years: [currentYear], timeGrain: 'month' });
      const colKey4 = this.makeKey('actual-collections', { companyIds: allCoIdsStr, years: currentYear, timeGrain: 'month' });
      const colKey5 = this.makeKey('actual-collections', { years: [currentYear], dateFrom, dateTo, timeGrain: 'month' });
      const colKey6 = this.makeKey('actual-collections', { years: currentYear, dateFrom, dateTo, timeGrain: 'month' });
      const colKey7 = this.makeKey('actual-collections', { years: [currentYear], timeGrain: 'month' });
      const colKey8 = this.makeKey('actual-collections', { years: currentYear, timeGrain: 'month' });
      const colKey9 = this.makeKey('actual-collections', { timeGrain: 'month' });
      await warmStep([colKey1, colKey2, colKey3, colKey4, colKey5, colKey6, colKey7, colKey8, colKey9], () => engine.getCollections({ companyIds: [1, 2, 3, 4], years: [currentYear], dateFrom, dateTo, timeGrain: 'month' }));

      // 12. Non-default Selections (R2-11 Benchmarks)
      const inc2025Key = this.makeKey('income', { years: '2025' });
      const balCo1Key = this.makeKey('balance', { companyIds: '1', fiscalYear: '2025' });
      const execAllKey1 = this.makeKey('executive', { years: 'ALL', fullTree: false, includeAging: false });
      const execAllKey2 = this.makeKey('executive', { years: ['ALL'], fullTree: false, includeAging: false });
      await warmStep(inc2025Key, () => engine.getIncomeStatement({ years: '2025' }));
      await warmStep(balCo1Key, () => engine.getBalanceSheet({ companyIds: [1], fiscalYear: '2025', asOfDate: '2025-12-31' }));
      await warmStep([execAllKey1, execAllKey2], () => engine.getExecutiveSummary({ years: 'ALL', fullTree: false, includeAging: false }));

      console.log(`[Cache] Phased non-blocking warmup completed for default view in ${Date.now() - startTime}ms (v${dataVersion})`);
    } catch (err) {
      console.warn('[Cache] Warmup non-critical warning:', err.message);
    }
  },

  getStats() {
    return { ...cache.getStats(), dataVersion, riyadhDate: getRiyadhDate() };
  }
};

module.exports = CacheService;
