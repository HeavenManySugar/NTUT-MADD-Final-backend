/**
 * Redis 快取工具
 * 提供對常見查詢結果的快取機制，減少重複查詢對數據庫的壓力
 */

const { promisify } = require('util');
const config = require('../config');
const redisPool = require('./redisPool');

// 此工具需要安裝 redis 客戶端
// npm install redis@3.1.2

// Redis 客戶端緩存，用於避免重複創建 promisify 函數
const clientFunctions = new Map();

// 快取的有效時間（秒）
const DEFAULT_EXPIRATION = 3600; // 1小時

/**
 * 從快取獲取數據
 * @param {string} key - 快取鍵名
 * @returns {Promise<Object|null>} - 快取中的值或 null
 */
const getCache = async (key) => {
  const client = await redisPool.connect();
  try {
    const getAsync = promisify(client.get).bind(client);
    const data = await getAsync(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Redis get error:', error);
    return null;
  } finally {
    redisPool.release(client);
  }
};

/**
 * 設置快取數據
 * @param {string} key - 快取鍵名
 * @param {Object} value - 要快取的值
 * @param {number} expiration - 過期時間（秒）
 * @returns {Promise<boolean>} - 是否成功設置
 */
const setCache = async (key, value, expiration = DEFAULT_EXPIRATION) => {
  const client = await redisPool.connect();
  try {
    const setAsync = promisify(client.set).bind(client);
    await setAsync(key, JSON.stringify(value), 'EX', expiration);
    return true;
  } catch (error) {
    console.error('Redis set error:', error);
    return false;
  } finally {
    redisPool.release(client);
  }
};

/**
 * 刪除快取
 * @param {string} key - 快取鍵名
 * @returns {Promise<boolean>} - 是否成功刪除
 */
const deleteCache = async (key) => {
  const client = await redisPool.connect();
  try {
    const delAsync = promisify(client.del).bind(client);
    await delAsync(key);
    return true;
  } catch (error) {
    console.error('Redis delete error:', error);
    return false;
  } finally {
    redisPool.release(client);
  }
};

/**
 * 清除與模式匹配的快取
 * @param {string} pattern - 快取鍵模式，例如：'user:*'
 * @returns {Promise<boolean>} - 是否成功清除
 */
const clearCachePattern = async (pattern) => {
  const client = await redisPool.connect();
  try {
    const scanAsync = promisify(client.scan).bind(client);
    const delAsync = promisify(client.del).bind(client);
    let cursor = '0';

    do {
      const [nextCursor, keys] = await scanAsync(cursor, 'MATCH', pattern);
      cursor = nextCursor;

      if (keys.length > 0) {
        await delAsync(keys);
      }
    } while (cursor !== '0');

    return true;
  } catch (error) {
    console.error('Redis clear pattern error:', error);
    return false;
  } finally {
    redisPool.release(client);
  }
};

/**
 * 使用快取包裝器函數
 * 如果快取中存在數據，直接返回
 * 否則執行回調函數並快取結果
 *
 * @param {string} key - 快取鍵名
 * @param {Function} callback - 獲取數據的函數
 * @param {number} expiration - 過期時間（秒）
 * @returns {Promise<any>} - 查詢結果
 */
const withCache = async (key, callback, expiration = DEFAULT_EXPIRATION) => {
  const client = await redisPool.connect();
  try {
    const getAsync = promisify(client.get).bind(client);
    const setAsync = promisify(client.set).bind(client);

    // 嘗試從快取獲取
    const cachedData = await getAsync(key);
    if (cachedData) {
      return JSON.parse(cachedData);
    }

    // 快取不存在，執行回調
    const result = await callback();

    // 快取結果
    if (result) {
      await setAsync(key, JSON.stringify(result), 'EX', expiration);
    }

    return result;
  } catch (error) {
    console.error('Cache wrapper error:', error);
    return callback();
  } finally {
    redisPool.release(client);
  }
};

module.exports = {
  getCache,
  setCache,
  deleteCache,
  clearCachePattern,
  withCache,

  // 添加特定模型的緩存管理函數
  clearModelCache: async (modelName) => {
    return await clearCachePattern(`${modelName}:*`);
  },

  // 清除特定實體的緩存
  clearEntityCache: async (modelName, entityId) => {
    return await clearCachePattern(`${modelName}:${entityId}:*`);
  },

  // 根據查詢條件生成緩存鍵
  generateCacheKey: (modelName, query = {}, options = {}) => {
    const queryStr = JSON.stringify(query);
    const optionsStr = JSON.stringify(options);
    return `${modelName}:query:${queryStr}:${optionsStr}`;
  },

  // 特定模型的緩存包裝器
  withModelCache: async (modelName, query, callback, expiration = DEFAULT_EXPIRATION) => {
    const cacheKey = `${modelName}:query:${JSON.stringify(query)}`;
    return await withCache(cacheKey, callback, expiration);
  },
};
