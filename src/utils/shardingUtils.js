/**
 * Database Sharding Utility
 * Prepares the application for horizontal scaling with data sharding
 * This is a simulation/blueprint for actual sharding implementation
 */

const mongoose = require('mongoose');
const config = require('../config');

// Shard configuration
const SHARD_CONFIG = {
  enabled: false, // Default to disabled until explicitly configured
  shardBy: 'userId', // Default shard key
  shardCount: 0, // Number of shards (0 means no sharding)
  shardConnections: [], // Array of connection objects
  shardMap: new Map(), // Maps shard keys to connection instances
};

/**
 * Initialize sharding setup
 * @param {Object} options - Sharding options
 * @param {boolean} options.enabled - Whether sharding is enabled
 * @param {string} options.shardBy - The field to shard by
 * @param {number} options.shardCount - Number of shards
 * @param {Array} options.connectionStrings - Array of MongoDB connection strings
 */
const initSharding = async (options = {}) => {
  try {
    // Merge options with defaults
    Object.assign(SHARD_CONFIG, options);

    if (!SHARD_CONFIG.enabled || SHARD_CONFIG.shardCount === 0) {
      console.log('Database sharding is disabled');
      return;
    }

    console.log(`Initializing database sharding with ${SHARD_CONFIG.shardCount} shards`);

    // Validate connection strings
    if (!options.connectionStrings || options.connectionStrings.length < SHARD_CONFIG.shardCount) {
      throw new Error('Not enough connection strings provided for sharding');
    }

    // Create connections to each shard
    for (let i = 0; i < SHARD_CONFIG.shardCount; i++) {
      const connStr = options.connectionStrings[i];
      console.log(`Connecting to shard ${i + 1}`);

      const conn = await mongoose.createConnection(connStr, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        maxPoolSize: 10,
        minPoolSize: 2,
      });

      // Store connection
      SHARD_CONFIG.shardConnections[i] = conn;

      // Setup models on this connection
      // This is where you would replicate your schemas across shards
      // setupModelsOnShard(conn);
    }

    console.log('Database sharding initialized successfully');
  } catch (err) {
    console.error('Error initializing database sharding:', err);
    SHARD_CONFIG.enabled = false;
  }
};

/**
 * Get the appropriate shard for a given key
 * @param {string|number} keyValue - The value of the shard key
 * @returns {mongoose.Connection} - The mongoose connection for the appropriate shard
 */
const getShardForKey = (keyValue) => {
  if (!SHARD_CONFIG.enabled || SHARD_CONFIG.shardCount === 0) {
    return mongoose.connection; // Return default connection if sharding disabled
  }

  // Check if key has a pre-assigned shard
  if (SHARD_CONFIG.shardMap.has(keyValue)) {
    return SHARD_CONFIG.shardMap.get(keyValue);
  }

  // Compute shard based on key value
  // Simple hash function to distribute values
  const hash =
    typeof keyValue === 'string'
      ? keyValue.split('').reduce((a, b) => a + b.charCodeAt(0), 0)
      : Number(keyValue);

  const shardIndex = hash % SHARD_CONFIG.shardCount;
  const shardConn = SHARD_CONFIG.shardConnections[shardIndex];

  // Cache the mapping
  SHARD_CONFIG.shardMap.set(keyValue, shardConn);

  return shardConn;
};

/**
 * Example function to demonstrate how to get a model from the appropriate shard
 * @param {string} modelName - Name of the model
 * @param {string|number} shardKey - Value of the shard key
 * @returns {mongoose.Model} - The model from the appropriate shard
 */
const getShardedModel = (modelName, shardKey) => {
  const conn = getShardForKey(shardKey);
  return conn.model(modelName);
};

/**
 * Get shard status information
 * @returns {Object} - Shard status information
 */
const getShardStatus = () => {
  return {
    enabled: SHARD_CONFIG.enabled,
    shardCount: SHARD_CONFIG.shardCount,
    shardBy: SHARD_CONFIG.shardBy,
    connectionsAlive: SHARD_CONFIG.shardConnections.filter((conn) => conn.readyState === 1).length,
    shardMapSize: SHARD_CONFIG.shardMap.size,
  };
};

module.exports = {
  initSharding,
  getShardForKey,
  getShardedModel,
  getShardStatus,
};
