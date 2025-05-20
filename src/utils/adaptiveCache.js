/**
 * Adaptive Cache Strategy
 * Dynamically adjusts cache TTL based on usage patterns and system load
 */

const os = require('os');
const { getCache, setCache } = require('./cacheUtils');

// Cache configuration
const STATS_KEY = 'system:cache:stats';
const STATS_UPDATE_INTERVAL = 60000; // 1 minute
const CACHE_CONFIG_KEY = 'system:cache:config';

// Default cache TTLs in seconds
const DEFAULT_CACHE_SETTINGS = {
  // Authentication cache TTLs
  authTokenTTL: 24 * 60 * 60, // 24 hours
  loginResultTTL: 600, // 10 minutes
  userProfileTTL: 1800, // 30 minutes

  // Database query cache TTLs
  queryResultTTL: 300, // 5 minutes
  countQueryTTL: 600, // 10 minutes
  aggregationTTL: 900, // 15 minutes

  // UI data cache TTLs
  staticDataTTL: 3600, // 1 hour
  dynamicDataTTL: 120, // 2 minutes

  // System parameters
  cacheHitMultiplier: 1.05, // Increase TTL by 5% on cache hit
  cacheMissMultiplier: 0.95, // Decrease TTL by 5% on cache miss
  maxTTLMultiplier: 3, // Maximum 3x the default TTL
  minTTLMultiplier: 0.5, // Minimum 0.5x the default TTL
  systemLoadFactor: 0.8, // Reduce TTL when system load is high
};

// Cache stats
const cacheStats = {
  hits: 0,
  misses: 0,
  hitRate: 0,
  sets: 0,
  gets: 0,
  keys: {},
  lastUpdated: Date.now(),
};

/**
 * Initialize the adaptive cache system
 */
const initAdaptiveCache = async () => {
  try {
    // Load existing config if available
    const existingConfig = await getCache(CACHE_CONFIG_KEY);
    if (existingConfig) {
      Object.assign(DEFAULT_CACHE_SETTINGS, existingConfig);
    }

    // Schedule regular updates of cache statistics
    setInterval(updateCacheStats, STATS_UPDATE_INTERVAL);

    // Load existing stats if available
    const existingStats = await getCache(STATS_KEY);
    if (existingStats) {
      Object.assign(cacheStats, existingStats);
    }
  } catch (err) {
    console.error('Error initializing adaptive cache:', err);
  }
};

/**
 * Update cache statistics
 */
const updateCacheStats = async () => {
  try {
    // Calculate hit rate
    const totalAccesses = cacheStats.hits + cacheStats.misses;
    if (totalAccesses > 0) {
      cacheStats.hitRate = cacheStats.hits / totalAccesses;
    }

    // Update timestamp
    cacheStats.lastUpdated = Date.now();

    // Store stats in cache
    await setCache(STATS_KEY, cacheStats, 24 * 60 * 60); // Keep stats for 24 hours

    // Adjust cache settings based on system load and cache hit rate
    adjustCacheSettings();
  } catch (err) {
    console.error('Error updating cache stats:', err);
  }
};

/**
 * Adjust cache settings based on usage patterns and system load
 */
const adjustCacheSettings = async () => {
  try {
    // Get current CPU load
    const loadAvg = os.loadavg()[0];
    const cpuCount = os.cpus().length;
    const systemLoad = loadAvg / cpuCount; // Normalized load per CPU

    // Determine load factor (0.5 to 1.0)
    const loadFactor =
      systemLoad > 0.8
        ? 0.5 // High load - reduce TTLs
        : systemLoad > 0.5
        ? 0.75 // Medium load
        : 1.0; // Low load - keep TTLs

    // Adjust TTLs based on hit rate and system load
    const hitRateFactor =
      cacheStats.hitRate > 0.8
        ? 1.1 // High hit rate - increase TTLs
        : cacheStats.hitRate > 0.5
        ? 1.0 // Medium hit rate - maintain TTLs
        : 0.9; // Low hit rate - decrease TTLs

    // Apply adjustments to cache settings
    const newConfig = { ...DEFAULT_CACHE_SETTINGS };

    // TTL adjustments
    Object.keys(newConfig).forEach((key) => {
      if (key.toLowerCase().includes('ttl')) {
        const currentValue = newConfig[key];
        // Apply adjustments with bounds
        const adjustedValue = currentValue * loadFactor * hitRateFactor;
        const maxValue = currentValue * DEFAULT_CACHE_SETTINGS.maxTTLMultiplier;
        const minValue = currentValue * DEFAULT_CACHE_SETTINGS.minTTLMultiplier;

        // Keep within bounds
        newConfig[key] = Math.min(Math.max(adjustedValue, minValue), maxValue);
      }
    });

    // Store the updated config
    await setCache(CACHE_CONFIG_KEY, newConfig, 24 * 60 * 60); // Keep config for 24 hours
  } catch (err) {
    console.error('Error adjusting cache settings:', err);
  }
};

/**
 * Record a cache hit
 * @param {string} key - Cache key that was hit
 */
const recordCacheHit = (key) => {
  cacheStats.hits++;
  cacheStats.gets++;

  // Track hit rate per key
  if (!cacheStats.keys[key]) {
    cacheStats.keys[key] = { hits: 1, misses: 0, sets: 0 };
  } else {
    cacheStats.keys[key].hits++;
  }
};

/**
 * Record a cache miss
 * @param {string} key - Cache key that was missed
 */
const recordCacheMiss = (key) => {
  cacheStats.misses++;
  cacheStats.gets++;

  // Track miss rate per key
  if (!cacheStats.keys[key]) {
    cacheStats.keys[key] = { hits: 0, misses: 1, sets: 0 };
  } else {
    cacheStats.keys[key].misses++;
  }
};

/**
 * Record a cache set
 * @param {string} key - Cache key that was set
 */
const recordCacheSet = (key) => {
  cacheStats.sets++;

  // Track sets per key
  if (!cacheStats.keys[key]) {
    cacheStats.keys[key] = { hits: 0, misses: 0, sets: 1 };
  } else {
    cacheStats.keys[key].sets++;
  }
};

/**
 * Get the optimal TTL for a cache key
 * @param {string} type - Type of cache (auth, query, etc.)
 * @param {string} key - The cache key
 * @returns {number} The optimal TTL in seconds
 */
const getOptimalTTL = async (type, key) => {
  try {
    // Get current cache config
    const config = (await getCache(CACHE_CONFIG_KEY)) || DEFAULT_CACHE_SETTINGS;

    // Determine the base TTL based on cache type
    let baseTTL;

    switch (type) {
      case 'auth:token':
        baseTTL = config.authTokenTTL;
        break;
      case 'auth:login':
        baseTTL = config.loginResultTTL;
        break;
      case 'user:profile':
        baseTTL = config.userProfileTTL;
        break;
      case 'query:result':
        baseTTL = config.queryResultTTL;
        break;
      case 'query:count':
        baseTTL = config.countQueryTTL;
        break;
      case 'query:aggregation':
        baseTTL = config.aggregationTTL;
        break;
      case 'data:static':
        baseTTL = config.staticDataTTL;
        break;
      case 'data:dynamic':
        baseTTL = config.dynamicDataTTL;
        break;
      default:
        baseTTL = 300; // Default 5 minutes
    }

    // Adjust based on key-specific stats if available
    if (cacheStats.keys[key]) {
      const keyStats = cacheStats.keys[key];
      const totalAccesses = keyStats.hits + keyStats.misses;

      if (totalAccesses > 0) {
        const keyHitRate = keyStats.hits / totalAccesses;

        // Adjust TTL based on hit rate for this specific key
        if (keyHitRate > 0.8) {
          // High hit rate - increase TTL
          baseTTL *= config.cacheHitMultiplier;
        } else if (keyHitRate < 0.3) {
          // Low hit rate - decrease TTL
          baseTTL *= config.cacheMissMultiplier;
        }
      }
    }

    return Math.round(baseTTL);
  } catch (err) {
    console.error('Error calculating optimal TTL:', err);
    return 300; // Default 5 minutes as fallback
  }
};

/**
 * Get cache statistics
 * @returns {Object} Cache statistics
 */
const getCacheStats = () => {
  return {
    ...cacheStats,
    keyCount: Object.keys(cacheStats.keys).length,
  };
};

module.exports = {
  initAdaptiveCache,
  recordCacheHit,
  recordCacheMiss,
  recordCacheSet,
  getOptimalTTL,
  getCacheStats,
};
