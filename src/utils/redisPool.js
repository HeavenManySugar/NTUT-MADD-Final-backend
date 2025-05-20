/**
 * Redis Connection Pool Manager
 * Provides an optimized connection pool for Redis to improve performance
 * under high load conditions.
 */

const redis = require('redis');
const { EventEmitter } = require('events');
const config = require('../config');

// Increase max listeners to avoid warnings
EventEmitter.defaultMaxListeners = 30;

class RedisPoolManager {
  constructor() {
    this.pool = [];
    this.maxPoolSize = 20; // Maximum connections in the pool
    this.minPoolSize = 5; // Minimum connections to maintain
    this.idleTimeout = 60000; // 60 seconds idle timeout
    this.acquireTimeout = 10000; // 10 seconds acquire timeout
    this.connectionOptions = {
      url: config.redisURL,
      retry_strategy: this._retryStrategy.bind(this),
      enable_offline_queue: true,
      connect_timeout: 5000, // Connection timeout 5 seconds
      socket_keepalive: true, // Keep connections alive
      disable_resubscribing: false,
    };

    // Initialize minimum pool size
    this._initializePool();
  }

  /**
   * Initialize the connection pool with minimum size
   */
  _initializePool() {
    if (!config.redisURL) {
      console.log('Redis URL not found, cache disabled');
      return;
    }

    for (let i = 0; i < this.minPoolSize; i++) {
      this._createClient();
    }

    // Setup pool maintenance interval
    setInterval(() => this._maintainPool(), 30000);
  }

  /**
   * Create a new Redis client and add to the pool
   * @returns {Object} The created Redis client
   */
  _createClient() {
    try {
      const client = redis.createClient(this.connectionOptions);

      client.on('error', (error) => {
        console.error('Redis client error:', error);
        // Remove bad clients from the pool
        this.pool = this.pool.filter((item) => item.client !== client);
      });

      client.on('end', () => {
        // Remove disconnected clients from the pool
        this.pool = this.pool.filter((item) => item.client !== client);
      });

      // Add to pool when ready
      client.on('ready', () => {
        if (!this.pool.some((item) => item.client === client)) {
          this.pool.push({
            client,
            lastUsed: Date.now(),
            inUse: false,
          });
        }
      });

      return client;
    } catch (err) {
      console.error('Failed to create Redis client:', err);
      return null;
    }
  }

  /**
   * Retry strategy for Redis connections
   */
  _retryStrategy(options) {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      console.error('Redis server refused connection');
      return new Error('The server refused the connection');
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      return new Error('Retry time exhausted');
    }
    if (options.attempt > 10) {
      return undefined;
    }
    // Exponential backoff strategy
    return Math.min(options.attempt * 100, 3000);
  }

  /**
   * Maintain the pool - clear idle connections and ensure minimum pool size
   */
  _maintainPool() {
    const now = Date.now();

    // Remove idle connections beyond min pool size
    if (this.pool.length > this.minPoolSize) {
      const idleClients = this.pool.filter(
        (item) => !item.inUse && now - item.lastUsed > this.idleTimeout
      );

      // Keep the pool size above minimum
      const excessCount = Math.max(0, this.pool.length - this.minPoolSize);
      const removeCount = Math.min(idleClients.length, excessCount);

      if (removeCount > 0) {
        const clientsToRemove = idleClients.slice(0, removeCount);

        // Remove and quit these clients
        clientsToRemove.forEach((item) => {
          try {
            item.client.quit();
          } catch (err) {
            console.error('Error closing Redis client:', err);
          }
        });

        // Update the pool
        this.pool = this.pool.filter((item) => !clientsToRemove.includes(item));
      }
    }

    // Add new connections if below minimum
    if (this.pool.length < this.minPoolSize) {
      const addCount = this.minPoolSize - this.pool.length;
      for (let i = 0; i < addCount; i++) {
        this._createClient();
      }
    }
  }

  /**
   * Get a client from the pool
   * @returns {Promise<Object>} A Redis client
   */
  async getClient() {
    return new Promise((resolve, reject) => {
      // Find available client
      let poolItem = this.pool.find((item) => !item.inUse);

      // If no available client and below max pool size, create new one
      if (!poolItem && this.pool.length < this.maxPoolSize) {
        const client = this._createClient();
        if (client) {
          poolItem = {
            client,
            lastUsed: Date.now(),
            inUse: true,
          };
          this.pool.push(poolItem);
          return resolve(poolItem);
        }
      }

      // If still no available client, wait or timeout
      if (!poolItem) {
        const timeout = setTimeout(() => {
          reject(new Error('Timed out getting Redis connection'));
        }, this.acquireTimeout);

        const checkInterval = setInterval(() => {
          const availableItem = this.pool.find((item) => !item.inUse);
          if (availableItem) {
            clearTimeout(timeout);
            clearInterval(checkInterval);

            availableItem.inUse = true;
            availableItem.lastUsed = Date.now();
            resolve(availableItem);
          }
        }, 100);

        return;
      }

      // Mark as in use and update timestamp
      poolItem.inUse = true;
      poolItem.lastUsed = Date.now();
      resolve(poolItem);
    });
  }

  /**
   * Release a client back to the pool
   * @param {Object} client - The Redis client to release
   */
  releaseClient(client) {
    const poolItem = this.pool.find((item) => item.client === client);
    if (poolItem) {
      poolItem.inUse = false;
      poolItem.lastUsed = Date.now();
    }
  }

  /**
   * Connect method - gets a client from the pool
   * To maintain compatibility with existing code structure
   */
  async connect() {
    const poolItem = await this.getClient();
    return poolItem.client;
  }

  /**
   * Release method - returns a client to the pool
   * To maintain compatibility with existing code structure
   */
  release(client) {
    this.releaseClient(client);
  }
}

// Create a singleton instance
const redisPool = new RedisPoolManager();

module.exports = redisPool;
