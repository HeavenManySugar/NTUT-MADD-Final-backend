/**
 * 數據庫性能監控工具
 *
 * 此腳本實時監控數據庫查詢性能並提供統計信息
 * 運行方式: node tools/db-performance-monitor.js
 *
 * 監控數據將顯示在控制台，並記錄到日誌文件
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const config = require('../src/config');
const connectDB = require('../src/config/db');
const redis = require('redis');
const { promisify } = require('util');
const os = require('os');

// 監控配置
const MONITOR_INTERVAL_MS = 10000; // 每10秒收集一次數據
const LOG_FILE = path.join(__dirname, '../logs/db-performance.log');
const SLOW_QUERY_THRESHOLD_MS = 300; // 300ms以上的查詢視為慢查詢
const PERFORMANCE_HISTORY_SIZE = 60; // 保留60個時間點的性能歷史記錄

// 創建日誌目錄（如果不存在）
if (!fs.existsSync(path.join(__dirname, '../logs'))) {
  fs.mkdirSync(path.join(__dirname, '../logs'), { recursive: true });
}

// Redis 客戶端初始化
let redisClient;
let redisInfoAsync;
let redisSlowlogAsync;

// 初始化 Redis 監控
function initRedisMonitoring() {
  if (!config.redisURL) {
    console.log('Redis URL not configured, skipping Redis monitoring');
    return null;
  }

  try {
    redisClient = redis.createClient(config.redisURL);
    redisInfoAsync = promisify(redisClient.info).bind(redisClient);
    redisSlowlogAsync = promisify(redisClient.slowlog).bind(redisClient);

    redisClient.on('error', (err) => {
      console.error('Redis monitoring error:', err);
    });

    console.log('Redis monitoring initialized');
    return redisClient;
  } catch (err) {
    console.error('Failed to initialize Redis monitoring:', err);
    return null;
  }
}

// 性能數據存儲
const performanceData = {
  timestamp: [],
  totalQueries: 0,
  slowQueries: 0,
  queryTimes: [],
  operationTypes: {},
  collectionStats: {},
  slowQueriesList: [],
  history: [],
  systemStats: {
    cpu: [],
    memory: [],
    uptime: 0,
  },
  redisStats: {
    connected: false,
    keyspace: {},
    memory: {},
    clients: 0,
    slowlogs: [],
  },
};

// 格式化日期時間
function formatDateTime() {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(0, 19);
}

// 記錄到日誌文件
function logToFile(message) {
  const timestamp = formatDateTime();
  fs.appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
}

// 監控 Mongoose 查詢
function monitorQueries() {
  // 監控所有數據庫操作
  mongoose.set('debug', (collectionName, methodName, ...methodArgs) => {
    const startTime = Date.now();
    const queryId = Math.floor(Math.random() * 1000000);

    // 處理查詢結果
    mongoose.connection.once('query', () => {
      const endTime = Date.now();
      const duration = endTime - startTime;

      // 更新性能數據
      performanceData.totalQueries++;
      performanceData.queryTimes.push(duration);

      // 記錄操作類型
      if (!performanceData.operationTypes[methodName]) {
        performanceData.operationTypes[methodName] = 0;
      }
      performanceData.operationTypes[methodName]++;

      // 記錄集合統計
      if (!performanceData.collectionStats[collectionName]) {
        performanceData.collectionStats[collectionName] = {
          queries: 0,
          totalTime: 0,
          slowQueries: 0,
        };
      }
      performanceData.collectionStats[collectionName].queries++;
      performanceData.collectionStats[collectionName].totalTime += duration;

      // 檢查是否為慢查詢
      if (duration > SLOW_QUERY_THRESHOLD_MS) {
        performanceData.slowQueries++;
        performanceData.collectionStats[collectionName].slowQueries++;

        // 存儲慢查詢詳情（最多保存最近100個）
        const queryInfo = {
          id: queryId,
          collection: collectionName,
          operation: methodName,
          args: JSON.stringify(methodArgs).substring(0, 200), // 限制長度
          duration: duration,
          timestamp: new Date(),
        };

        performanceData.slowQueriesList.push(queryInfo);
        if (performanceData.slowQueriesList.length > 100) {
          performanceData.slowQueriesList.shift(); // 移除最舊的
        }

        // 記錄慢查詢到日誌
        logToFile(
          `SLOW QUERY #${queryId}: ${collectionName}.${methodName} took ${duration}ms - args: ${queryInfo.args}`
        );
      }
    });
  });
}

// 收集系統資源使用統計
async function collectSystemStats() {
  try {
    // CPU 使用率
    const cpus = os.cpus();
    const cpuCount = cpus.length;

    // 平均負載
    const loadAvg = os.loadavg();

    // 記憶體使用
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsagePercent = (usedMem / totalMem) * 100;

    // 運行時間
    const uptime = os.uptime();

    // 更新統計資料
    performanceData.systemStats = {
      cpu: {
        count: cpuCount,
        loadAvg,
        model: cpus[0].model,
      },
      memory: {
        total: totalMem,
        free: freeMem,
        used: usedMem,
        usagePercent: memUsagePercent.toFixed(2),
      },
      uptime,
      platform: os.platform(),
      arch: os.arch(),
    };

    return performanceData.systemStats;
  } catch (err) {
    console.error('Error collecting system stats:', err);
    return null;
  }
}

// 收集 Redis 統計信息
async function collectRedisStats() {
  if (!redisClient || !redisInfoAsync || !redisSlowlogAsync) {
    performanceData.redisStats.connected = false;
    return null;
  }

  try {
    // 獲取 Redis 信息
    const info = await redisInfoAsync();
    const infoLines = info.split('\r\n');
    const infoData = {};

    // 解析 Redis INFO 命令輸出
    infoLines.forEach((line) => {
      if (line && !line.startsWith('#') && line.includes(':')) {
        const [key, value] = line.split(':');
        infoData[key] = value;
      }
    });

    // 獲取慢日誌
    const slowlogs = await redisSlowlogAsync('get', 10);

    // 更新 Redis 統計
    performanceData.redisStats = {
      connected: true,
      version: infoData.redis_version,
      uptime: infoData.uptime_in_seconds,
      clients: infoData.connected_clients,
      memory: {
        used: infoData.used_memory_human,
        peak: infoData.used_memory_peak_human,
        fragmentation: infoData.mem_fragmentation_ratio,
      },
      keyspace: infoData.db0 ? parseKeyspace(infoData.db0) : {},
      ops: {
        commands: infoData.total_commands_processed,
        connections: infoData.total_connections_received,
      },
      slowlogs: slowlogs.map((log) => ({
        id: log[0],
        timestamp: log[1],
        duration: log[2], // 微秒
        command: log[3].join(' '),
      })),
    };

    return performanceData.redisStats;
  } catch (err) {
    console.error('Error collecting Redis stats:', err);
    performanceData.redisStats.connected = false;
    performanceData.redisStats.error = err.message;
    return null;
  }
}

// 解析 Redis keyspace 統計
function parseKeyspace(keyspaceString) {
  const result = {};
  const parts = keyspaceString.split(',');

  parts.forEach((part) => {
    const [key, value] = part.split('=');
    result[key] = value;
  });

  return result;
}

// 計算並輸出性能統計
function reportPerformanceStats() {
  console.clear();
  const timestamp = formatDateTime();

  console.log('======================================================================');
  console.log(`📊 數據庫性能監控報告 | ${timestamp}`);
  console.log('======================================================================');

  // 基本統計數據
  console.log(`\n📈 總查詢數: ${performanceData.totalQueries}`);
  console.log(`⚠️ 慢查詢數: ${performanceData.slowQueries} (>${SLOW_QUERY_THRESHOLD_MS}ms)`);

  // 計算平均查詢時間
  if (performanceData.queryTimes.length > 0) {
    const avgTime =
      performanceData.queryTimes.reduce((a, b) => a + b, 0) / performanceData.queryTimes.length;
    console.log(`⏱️ 平均查詢耗時: ${avgTime.toFixed(2)}ms`);
  }

  // 操作類型分佈
  console.log('\n🔍 操作類型分佈:');
  Object.keys(performanceData.operationTypes).forEach((op) => {
    const percent = (
      (performanceData.operationTypes[op] / performanceData.totalQueries) *
      100
    ).toFixed(1);
    console.log(`  - ${op}: ${performanceData.operationTypes[op]} (${percent}%)`);
  });

  // 集合性能統計
  console.log('\n📚 集合性能統計:');
  Object.keys(performanceData.collectionStats).forEach((collection) => {
    const stats = performanceData.collectionStats[collection];
    const avgTime = stats.queries > 0 ? (stats.totalTime / stats.queries).toFixed(2) : 0;
    console.log(`  - ${collection}:`);
    console.log(`      查詢數: ${stats.queries}`);
    console.log(`      平均耗時: ${avgTime}ms`);
    console.log(`      慢查詢數: ${stats.slowQueries}`);
  });

  // 最近慢查詢
  if (performanceData.slowQueriesList.length > 0) {
    console.log('\n🐢 最近5個慢查詢:');
    performanceData.slowQueriesList.slice(-5).forEach((query) => {
      console.log(
        `  - #${query.id} | ${query.collection}.${query.operation} (${query.duration}ms)`
      );
      console.log(`    ${query.args.substring(0, 80)}${query.args.length > 80 ? '...' : ''}`);
    });
  }

  // Redis 監控統計
  if (performanceData.redisStats.connected) {
    console.log('\n🔗 Redis 監控統計:');
    console.log(`  - 連接狀態: 已連接`);
    console.log(`  - 使用的記憶體: ${performanceData.redisStats.memory.used_memory_human}`);
    console.log(`  - 鍵值對數: ${performanceData.redisStats.keyspace.db0.keys}`);
    console.log(`  - 客戶端連接數: ${performanceData.redisStats.clients}`);
  } else {
    console.log('\n🔗 Redis 監控統計: 未連接');
  }

  console.log('\n======================================================================');
  console.log(`日誌文件路徑: ${LOG_FILE}`);
  console.log('======================================================================');

  // 記錄摘要到日誌
  logToFile(
    `STATS: 總查詢數=${performanceData.totalQueries}, 慢查詢數=${
      performanceData.slowQueries
    }, 平均耗時=${
      performanceData.queryTimes.length > 0
        ? (
            performanceData.queryTimes.reduce((a, b) => a + b, 0) /
            performanceData.queryTimes.length
          ).toFixed(2)
        : 0
    }ms`
  );
}

// 主函數
async function main() {
  try {
    console.log('🔍 啟動數據庫性能監控...');
    // 連接數據庫
    await connectDB();

    // 設置監控
    monitorQueries();

    // 初始化 Redis 監控
    initRedisMonitoring();

    // 初始日誌
    logToFile('===== 開始數據庫性能監控 =====');

    // 定期報告統計數據
    setInterval(reportPerformanceStats, MONITOR_INTERVAL_MS);

    // 自動清理舊的查詢時間數據（避免記憶體泄漏）
    setInterval(() => {
      if (performanceData.queryTimes.length > 10000) {
        performanceData.queryTimes = performanceData.queryTimes.slice(-5000);
      }
    }, 60000);

    console.log(`監控已啟動，每 ${MONITOR_INTERVAL_MS / 1000} 秒報告一次統計數據。`);
    console.log(`慢查詢閾值: ${SLOW_QUERY_THRESHOLD_MS}ms`);
    console.log(`日誌文件: ${LOG_FILE}`);
    console.log('\n等待數據收集中...');
  } catch (error) {
    console.error('監控啟動失敗:', error);
    process.exit(1);
  }
}

// 當停止監控時清理並保存日誌
process.on('SIGINT', () => {
  logToFile('===== 停止數據庫性能監控 =====');
  console.log('\n🛑 停止監控。日誌已保存。');
  process.exit(0);
});

// 啟動監控
main();
