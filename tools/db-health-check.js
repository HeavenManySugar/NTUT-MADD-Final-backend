/**
 * Database Health Check Utility
 * Regularly checks database health and performance metrics
 */
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { promisify } = require('util');
const writeFileAsync = promisify(fs.writeFile);
const { getCache, setCache } = require('../src/utils/cacheUtils');
const { getQueryStats } = require('../src/utils/queryOptimizer');
const { getCacheStats } = require('../src/utils/adaptiveCache');

// Configuration
const LOG_DIRECTORY = path.join(__dirname, '../logs');
const HEALTH_CHECK_INTERVAL = 15 * 60 * 1000; // 15 minutes
const RESULTS_FILE = path.join(LOG_DIRECTORY, 'db-health.json');
const HEALTH_HISTORY_LENGTH = 48; // Keep last 48 checks (12 hours with 15-min interval)

// Performance thresholds
const THRESHOLDS = {
  avgQueryTime: 100, // ms
  freeMemoryPercent: 20, // Percent
  connectionPoolUsage: 80, // Percent
  diskSpacePercent: 85, // Percent
  cacheHitRate: 50, // Percent
};

// Health history storage
let healthHistory = [];

/**
 * Start the database health check service
 */
const startHealthCheck = () => {
  console.log('Starting database health check service');

  // Create logs directory if it doesn't exist
  if (!fs.existsSync(LOG_DIRECTORY)) {
    fs.mkdirSync(LOG_DIRECTORY, { recursive: true });
  }

  // Load existing health history if available
  try {
    if (fs.existsSync(RESULTS_FILE)) {
      const existing = JSON.parse(fs.readFileSync(RESULTS_FILE, 'utf8'));
      if (existing.history && Array.isArray(existing.history)) {
        healthHistory = existing.history;
      }
    }
  } catch (err) {
    console.error('Error loading health history:', err);
  }

  // Run first health check
  runHealthCheck();

  // Schedule regular health checks
  setInterval(runHealthCheck, HEALTH_CHECK_INTERVAL);
};

/**
 * Run a database health check
 */
const runHealthCheck = async () => {
  try {
    console.log('Running database health check...');

    const healthData = {
      timestamp: new Date().toISOString(),
      mongoStatus: await checkMongoDBStatus(),
      redisStatus: await checkRedisStatus(),
      systemStatus: checkSystemStatus(),
      cacheStatus: await checkCacheStatus(),
      queryStatus: getQueryStats(),
      healthScore: 0, // Will be calculated
      issues: [],
    };

    // Calculate overall health score (0-100)
    calculateHealthScore(healthData);

    // Add to history
    healthHistory.push(healthData);

    // Keep history at desired length
    if (healthHistory.length > HEALTH_HISTORY_LENGTH) {
      healthHistory = healthHistory.slice(-HEALTH_HISTORY_LENGTH);
    }

    // Save results
    const results = {
      latestCheck: healthData,
      history: healthHistory,
      lastUpdated: new Date().toISOString(),
    };

    await writeFileAsync(RESULTS_FILE, JSON.stringify(results, null, 2));
    console.log(`Database health check completed. Health score: ${healthData.healthScore}/100`);

    // Log any issues found
    if (healthData.issues.length > 0) {
      console.warn('Issues found during health check:');
      healthData.issues.forEach((issue) => console.warn(`- ${issue}`));
    }
  } catch (err) {
    console.error('Error running health check:', err);
  }
};

/**
 * Check MongoDB status
 * @returns {Promise<Object>} - MongoDB status information
 */
const checkMongoDBStatus = async () => {
  try {
    // Get MongoDB server status
    const adminDb = mongoose.connection.db.admin();
    const serverStatus = await adminDb.serverStatus();

    // Get connection pool stats
    const connPoolStats = {
      active: mongoose.connection.client.topology.s.pool.totalConnectionCount,
      available: mongoose.connection.client.topology.s.pool.availableConnectionCount,
      maxSize: mongoose.connection.client.topology.s.pool.options.maxPoolSize || 100,
      minSize: mongoose.connection.client.topology.s.pool.options.minPoolSize || 0,
      waitQueueSize: mongoose.connection.client.topology.s.pool.waitQueueSize,
    };

    // Get database stats
    const dbStats = await mongoose.connection.db.stats();

    return {
      version: serverStatus.version,
      uptime: serverStatus.uptime,
      connections: serverStatus.connections,
      connectionPool: connPoolStats,
      dbStats: {
        collections: dbStats.collections,
        views: dbStats.views,
        objects: dbStats.objects,
        dataSize: dbStats.dataSize,
        storageSize: dbStats.storageSize,
        indexes: dbStats.indexes,
        indexSize: dbStats.indexSize,
      },
      operations: {
        insert: serverStatus.opcounters.insert,
        query: serverStatus.opcounters.query,
        update: serverStatus.opcounters.update,
        delete: serverStatus.opcounters.delete,
        getmore: serverStatus.opcounters.getmore,
        command: serverStatus.opcounters.command,
      },
      networkStats: {
        bytesIn: serverStatus.network.bytesIn,
        bytesOut: serverStatus.network.bytesOut,
        numRequests: serverStatus.network.numRequests,
      },
    };
  } catch (err) {
    console.error('Error checking MongoDB status:', err);
    return {
      error: err.message,
      connected: mongoose.connection.readyState === 1,
    };
  }
};

/**
 * Check Redis status
 * @returns {Promise<Object>} - Redis status information
 */
const checkRedisStatus = async () => {
  try {
    // Use Redis caching utilities to check status
    const pingResult = await setCache('health:ping', 'pong', 10);
    const pongResult = await getCache('health:ping');

    // Get Redis cache stats
    const cacheStats = await getCacheStats();

    return {
      connected: pingResult && pongResult === 'pong',
      stats: cacheStats,
    };
  } catch (err) {
    console.error('Error checking Redis status:', err);
    return {
      error: err.message,
      connected: false,
    };
  }
};

/**
 * Check system status
 * @returns {Object} - System status information
 */
const checkSystemStatus = () => {
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    return {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      loadAvg: os.loadavg(),
      memory: {
        total: totalMem,
        free: freeMem,
        used: usedMem,
        percentUsed: (usedMem / totalMem) * 100,
      },
      uptime: os.uptime(),
    };
  } catch (err) {
    console.error('Error checking system status:', err);
    return {
      error: err.message,
    };
  }
};

/**
 * Check cache status
 * @returns {Promise<Object>} - Cache status information
 */
const checkCacheStatus = async () => {
  try {
    const cacheStats = await getCacheStats();
    return cacheStats;
  } catch (err) {
    console.error('Error checking cache status:', err);
    return {
      error: err.message,
    };
  }
};

/**
 * Calculate health score and identify issues
 * @param {Object} healthData - Health data object
 */
const calculateHealthScore = (healthData) => {
  let score = 100;
  const issues = [];

  // Check MongoDB connection
  if (healthData.mongoStatus.error) {
    score -= 50;
    issues.push(`MongoDB connection error: ${healthData.mongoStatus.error}`);
  } else {
    // Check connection pool usage
    const pool = healthData.mongoStatus.connectionPool;
    const poolUsagePercent = (pool.active / pool.maxSize) * 100;

    if (poolUsagePercent > THRESHOLDS.connectionPoolUsage) {
      score -= 10;
      issues.push(`High connection pool usage: ${poolUsagePercent.toFixed(2)}%`);
    }

    // Check database size
    const dbStats = healthData.mongoStatus.dbStats;
    if (dbStats.storageSize > 1000000000) {
      // 1GB
      score -= 5;
      issues.push(
        `Large database size: ${(dbStats.storageSize / 1024 / 1024 / 1024).toFixed(2)} GB`
      );
    }
  }

  // Check Redis connection
  if (!healthData.redisStatus.connected) {
    score -= 20;
    issues.push('Redis connection error');
  }

  // Check system memory
  const memoryData = healthData.systemStatus.memory;
  const freeMemoryPercent = (memoryData.free / memoryData.total) * 100;

  if (freeMemoryPercent < THRESHOLDS.freeMemoryPercent) {
    score -= 15;
    issues.push(`Low system memory: ${freeMemoryPercent.toFixed(2)}% free`);
  }

  // Check CPU load
  const loadAvg = healthData.systemStatus.loadAvg[0];
  const cpuCount = healthData.systemStatus.cpus;
  const loadPerCpu = loadAvg / cpuCount;

  if (loadPerCpu > 0.8) {
    score -= 15;
    issues.push(`High CPU load: ${loadPerCpu.toFixed(2)} per core`);
  }

  // Check cache hit rate
  if (healthData.cacheStatus.hits + healthData.cacheStatus.misses > 0) {
    const hitRate =
      (healthData.cacheStatus.hits /
        (healthData.cacheStatus.hits + healthData.cacheStatus.misses)) *
      100;

    if (hitRate < THRESHOLDS.cacheHitRate) {
      score -= 10;
      issues.push(`Low cache hit rate: ${hitRate.toFixed(2)}%`);
    }
  }

  // Check query performance
  if (healthData.queryStatus.avgExecutionTime > THRESHOLDS.avgQueryTime) {
    score -= 15;
    issues.push(
      `Slow query performance: ${healthData.queryStatus.avgExecutionTime.toFixed(2)} ms average`
    );
  }

  // Ensure score is within 0-100 range
  healthData.healthScore = Math.max(0, Math.min(100, score));
  healthData.issues = issues;
};

/**
 * Get the latest health check results
 * @returns {Promise<Object>} - Health check results
 */
const getHealthCheckResults = async () => {
  try {
    if (fs.existsSync(RESULTS_FILE)) {
      const data = await fs.promises.readFile(RESULTS_FILE, 'utf8');
      return JSON.parse(data);
    }
    return { error: 'No health check data available' };
  } catch (err) {
    console.error('Error reading health check results:', err);
    return { error: err.message };
  }
};

module.exports = {
  startHealthCheck,
  runHealthCheck,
  getHealthCheckResults,
};

// Run as standalone script
if (require.main === module) {
  // Connect to MongoDB first
  require('../src/config/db')()
    .then(() => {
      // Initialize required utilities
      require('../src/utils/cacheUtils').initRedis();
      require('../src/utils/queryOptimizer').initQueryOptimizer();
      require('../src/utils/adaptiveCache').initAdaptiveCache();

      // Start health check service
      startHealthCheck();
    })
    .catch((err) => {
      console.error('Failed to start health check service:', err);
      process.exit(1);
    });
}
