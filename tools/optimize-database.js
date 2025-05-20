/**
 * 數據庫優化腳本
 * 運行此腳本可以分析和優化數據庫索引、查詢性能
 */

const mongoose = require('mongoose');
const config = require('../src/config');
const connectDB = require('../src/config/db');
const fs = require('fs');
const path = require('path');

// 需要分析的集合清單
const collections = ['users', 'tasks', 'messages', 'conversations', 'files'];

// 優化報告輸出路徑
const SUMMARY_FILE = path.join(__dirname, '../logs/optimization-summary.json');
const LOG_FILE = path.join(__dirname, '../logs/index-optimization.log');

// 優化結果摘要
const optimizationSummary = {
  collections: {},
  recommendations: [],
  unusedIndexes: [],
  potentialImprovements: 0,
  timestamp: new Date().toISOString(),
};

// 分析集合的使用模式並提供優化建議
async function analyzeCollection(collection) {
  try {
    console.log(`\n🔍 分析集合: ${collection}`);

    // 獲取集合索引信息
    const indexes = await mongoose.connection.db.collection(collection).indexes();
    console.log(`\n現有索引 (${indexes.length}):`);
    indexes.forEach((index, i) => {
      console.log(`${i + 1}. ${JSON.stringify(index.key)} - ${index.name}`);
    });

    // 初始化集合摘要
    optimizationSummary.collections[collection] = {
      documentCount: 0,
      sizeInMB: 0,
      indexes: indexes.length,
      unusedIndexes: [],
      recommendations: [],
    };

    // 獲取集合數據量
    const count = await mongoose.connection.db.collection(collection).estimatedDocumentCount();
    console.log(`\n集合數據量: ${count} 文檔`);
    optimizationSummary.collections[collection].documentCount = count;

    // 分析集合數據大小
    try {
      // 使用 command 代替直接呼叫 stats()
      const stats = await mongoose.connection.db.command({ collStats: collection });
      const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
      console.log(`集合大小: ${sizeInMB} MB`);
      optimizationSummary.collections[collection].sizeInMB = parseFloat(sizeInMB);
      optimizationSummary.collections[collection].avgDocSize = stats.size / (count || 1);
    } catch (error) {
      console.log(`無法獲取集合大小統計: ${error.message}`);
    }

    // 檢查是否有未使用的索引
    if (count > 1000) {
      try {
        console.log('\n執行索引使用情況分析...');
        const indexUsage = await mongoose.connection.db.command({
          aggregate: collection,
          pipeline: [{ $indexStats: {} }],
          cursor: {},
        });

        if (indexUsage.cursor && indexUsage.cursor.firstBatch) {
          const unusedIndexes = indexUsage.cursor.firstBatch.filter(
            (stat) => stat.accesses.ops === 0
          );

          if (unusedIndexes.length > 0) {
            console.log(`\n⚠️ 發現 ${unusedIndexes.length} 個未使用的索引:`);
            unusedIndexes.forEach((index) => {
              console.log(`- ${index.name} (建議考慮移除)`);

              // 添加到未使用索引列表
              optimizationSummary.collections[collection].unusedIndexes.push({
                name: index.name,
                key: index.key,
                suggestion: `db.${collection}.dropIndex("${index.name}")`,
              });

              optimizationSummary.unusedIndexes.push({
                collection,
                name: index.name,
                suggestion: `db.${collection}.dropIndex("${index.name}")`,
              });
            });
          } else {
            console.log('\n✅ 未發現未使用的索引');
          }
        }
      } catch (error) {
        console.log(`索引使用分析失敗: ${error.message}`);
      }
    }

    // 生成索引建議
    await generateIndexRecommendations(collection);

    // 檢查集合的常見訪問模式和潛在優化
    console.log('\n常見查詢模式分析 (示例):');
    if (collection === 'users') {
      console.log('👉 用戶通常按電子郵件查詢 - 確保 email 字段已索引');
      console.log('👉 用戶驗證會頻繁使用 - 確保 email + password 有複合索引');
    } else if (collection === 'tasks') {
      console.log('👉 任務通常按用戶ID和狀態查詢 - 確保 user + status 有複合索引');
      console.log('👉 分頁查詢常用 - 確保依賴分頁的字段 (如 createdAt) 已索引');
    } else if (collection === 'messages') {
      console.log('👉 消息通常按對話ID查詢 - 確保 conversation 字段已索引');
      console.log('👉 消息按時間順序檢索 - 確保 conversation + createdAt 有複合索引');
    } else if (collection === 'conversations') {
      console.log('👉 對話通常按參與者查詢 - 確保 participants 字段已索引');
    }
  } catch (error) {
    console.error(`分析 ${collection} 時出錯:`, error);
  }
}

/**
 * 生成索引優化建議
 * @param {string} collection - 集合名稱
 * @param {Array} queryData - 查詢數據
 */
async function generateIndexRecommendations(collection, queryData) {
  try {
    console.log(`\n📊 為 ${collection} 生成索引建議...`);

    // 從日誌文件中分析查詢模式
    const queryLog = path.join(__dirname, '../logs/db-performance.log');
    if (!fs.existsSync(queryLog)) {
      console.log('未找到查詢日誌文件，請先運行應用程序以收集查詢性能數據');
      return;
    }

    // 讀取查詢日誌
    const logContent = fs.readFileSync(queryLog, 'utf8');
    const logLines = logContent.split('\n').filter((line) => line && line.includes(collection));

    // 分析查詢模式
    const queryPatterns = {};
    const slowQueries = [];

    for (const line of logLines) {
      try {
        const logEntry = JSON.parse(line);
        if (logEntry.collection === collection && logEntry.time_ms > 100) {
          // 記錄慢查詢
          if (logEntry.args && typeof logEntry.args === 'string') {
            const args = JSON.parse(logEntry.args);
            if (args && args.length > 0 && typeof args[0] === 'object') {
              const queryCondition = JSON.stringify(args[0]);

              if (!queryPatterns[queryCondition]) {
                queryPatterns[queryCondition] = {
                  count: 0,
                  totalTime: 0,
                  fields: Object.keys(args[0]),
                };
              }

              queryPatterns[queryCondition].count++;
              queryPatterns[queryCondition].totalTime += logEntry.time_ms;

              // 添加到慢查詢列表
              slowQueries.push({
                condition: args[0],
                time: logEntry.time_ms,
                method: logEntry.method,
              });
            }
          }
        }
      } catch (e) {
        // 忽略解析錯誤
      }
    }

    // 獲取現有索引
    const indexes = await mongoose.connection.db.collection(collection).indexes();
    const existingIndexFields = indexes.map((index) => Object.keys(index.key));

    // 生成建議
    const recommendations = [];

    for (const queryCondition in queryPatterns) {
      if (queryPatterns[queryCondition].count >= 3) {
        // 至少出現3次的查詢
        const fields = queryPatterns[queryCondition].fields;

        // 檢查是否已有覆蓋此查詢的索引
        const hasMatchingIndex = existingIndexFields.some((indexFields) =>
          fields.every((field) => indexFields.includes(field) || field === '_id')
        );

        if (!hasMatchingIndex && fields.length > 0 && fields.some((f) => f !== '_id')) {
          // 建議建立索引
          const suggestion = {
            collection,
            fields,
            queryCount: queryPatterns[queryCondition].count,
            avgTime: queryPatterns[queryCondition].totalTime / queryPatterns[queryCondition].count,
            command: `db.${collection}.createIndex(${JSON.stringify(
              fields.reduce((obj, field) => {
                obj[field] = 1;
                return obj;
              }, {})
            )}, { background: true })`,
          };

          recommendations.push(suggestion);
        }
      }
    }

    // 排序建議，優先推薦高頻慢查詢的索引
    recommendations.sort((a, b) => b.queryCount * b.avgTime - a.queryCount * a.avgTime);

    // 更新優化摘要
    optimizationSummary.collections[collection] = {
      slowQueries: slowQueries.slice(0, 5),
      recommendations: recommendations.slice(0, 3),
    };

    optimizationSummary.recommendations = [
      ...optimizationSummary.recommendations,
      ...recommendations.slice(0, 3),
    ];

    // 輸出建議
    if (recommendations.length > 0) {
      console.log(`\n發現 ${recommendations.length} 個潛在索引優化建議:`);
      recommendations.slice(0, 3).forEach((rec, i) => {
        console.log(
          `\n${i + 1}. 為 ${rec.queryCount} 次查詢優化 (平均時間 ${rec.avgTime.toFixed(2)}ms):`
        );
        console.log(`   欄位: ${rec.fields.join(', ')}`);
        console.log(`   命令: ${rec.command}`);
      });
    } else {
      console.log('\n未發現需要優化的索引建議');
    }

    optimizationSummary.potentialImprovements += recommendations.length;
  } catch (err) {
    console.error(`生成索引建議時出錯: ${err.message}`);
  }
}

// 檢查整體數據庫配置和性能
async function checkDatabaseConfig() {
  console.log('\n🔍 檢查數據庫配置和全局設置');

  try {
    // 檢查數據庫狀態
    const serverStatus = await mongoose.connection.db.command({ serverStatus: 1 });

    // 連接池狀態
    console.log('\n連接池狀態:');
    console.log(`- 當前連接數: ${serverStatus.connections.current}`);
    console.log(`- 可用連接數: ${serverStatus.connections.available}`);
    console.log(`- 總連接數: ${serverStatus.connections.totalCreated}`);

    // 檢查較長的操作
    console.log('\n檢查較長時間運行的操作:');
    const currentOp = await mongoose.connection.db.command({
      currentOp: 1,
      secs_running: { $gt: 5 },
    });

    if (currentOp.inprog && currentOp.inprog.length > 0) {
      console.log(`⚠️ 發現 ${currentOp.inprog.length} 個運行超過 5 秒的操作`);
      currentOp.inprog.forEach((op, idx) => {
        console.log(`${idx + 1}. 運行時間: ${op.secs_running}s, 操作: ${op.op}, 集合: ${op.ns}`);
      });
    } else {
      console.log('✅ 未發現長時間運行的操作');
    }

    // 檢查 WiredTiger 存儲引擎設置
    if (serverStatus.wiredTiger) {
      console.log('\nWiredTiger 存儲引擎狀態:');
      const cache = serverStatus.wiredTiger.cache;
      const memory = parseInt(cache['maximum bytes configured']) / (1024 * 1024 * 1024);
      const used = parseInt(cache['bytes currently in the cache']) / (1024 * 1024 * 1024);
      const utilization = (used / memory) * 100;

      console.log(`- 最大緩存大小: ${memory.toFixed(2)} GB`);
      console.log(`- 當前使用: ${used.toFixed(2)} GB (${utilization.toFixed(2)}%)`);

      if (utilization > 80) {
        console.log('⚠️ 緩存使用率高，考慮增加 wiredTigerCacheSizeGB 參數');
        optimizationSummary.recommendations.push({
          type: 'config',
          description: '緩存使用率高，建議增加 wiredTigerCacheSizeGB 參數',
          details: `當前使用率 ${utilization.toFixed(2)}%, 最大緩存 ${memory.toFixed(2)} GB`,
        });
      }
    }

    // 添加到優化摘要
    optimizationSummary.databaseConfig = {
      connections: serverStatus.connections,
      version: serverStatus.version,
      uptime: serverStatus.uptime,
    };
  } catch (err) {
    console.error('檢查數據庫配置時出錯:', err);
  }
}

// 主函數
async function main() {
  try {
    console.log('🚀 開始數據庫優化分析...');
    // 連接數據庫
    await connectDB();

    // 檢查數據庫配置
    await checkDatabaseConfig();

    // 分析所有集合
    for (const collection of collections) {
      await analyzeCollection(collection);
      await generateIndexRecommendations(collection);
    }

    // 提供總體優化建議
    console.log('\n\n📊 總體數據庫優化建議:');
    console.log('--------------------------------------------------------');
    console.log('1. 確保所有頻繁查詢的字段都有適當的索引');
    console.log('2. 定期檢查並移除未使用的索引以提高寫入性能');
    console.log('3. 對於大型集合，考慮實施數據分片或存檔策略');
    console.log('4. 使用投影 (.select()) 只返回需要的字段以減少數據傳輸');
    console.log('5. 盡可能使用 .lean() 查詢以減少記憶體使用並提高速度');
    console.log('6. 對於頻繁讀取但很少更新的數據使用 Redis 緩存');
    console.log('--------------------------------------------------------');

    // 存儲優化摘要
    fs.writeFileSync(SUMMARY_FILE, JSON.stringify(optimizationSummary, null, 2), 'utf8');

    console.log(`\n✅ 優化分析完成，共 ${optimizationSummary.potentialImprovements} 項優化建議`);
    console.log(`詳細分析報告已保存至 ${SUMMARY_FILE}`);

    // 關閉數據庫連接
    await mongoose.connection.close();
    console.log('數據庫連接已關閉');
  } catch (error) {
    console.error('優化分析失敗:', error);
  } finally {
    process.exit(0);
  }
}

// 執行分析
main();
