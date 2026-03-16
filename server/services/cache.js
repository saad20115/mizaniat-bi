const NodeCache = require('node-cache');

// Cache with 5-minute TTL
const cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });

const CacheService = {
  get(key) {
    return cache.get(key);
  },

  set(key, value, ttl) {
    return cache.set(key, value, ttl);
  },

  /**
   * Get cached value or compute it
   */
  async getOrSet(key, computeFn, ttl = 300) {
    const cached = cache.get(key);
    if (cached !== undefined) {
      return cached;
    }
    const value = await computeFn();
    cache.set(key, value, ttl);
    return value;
  },

  /**
   * Generate cache key from request params
   */
  makeKey(prefix, params) {
    return `${prefix}:${JSON.stringify(params)}`;
  },

  /**
   * Invalidate all cache entries (after sync)
   */
  flush() {
    cache.flushAll();
    console.log('[Cache] Flushed all cached data');
  },

  /**
   * Invalidate entries matching a pattern
   */
  invalidatePattern(pattern) {
    const keys = cache.keys();
    let count = 0;
    for (const key of keys) {
      if (key.startsWith(pattern)) {
        cache.del(key);
        count++;
      }
    }
    console.log(`[Cache] Invalidated ${count} entries matching ${pattern}`);
  },

  getStats() {
    return cache.getStats();
  }
};

module.exports = CacheService;
