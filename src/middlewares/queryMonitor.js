const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const config = require('../config');

/**
 * 監控 MongoDB 慢查詢並記錄到日誌
 * 此中間件可幫助識別需要優化的查詢
 */
const setupQueryMonitor = (slowQueryThreshold = 500) => {
  // 確保日誌目錄存在
  const logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // 日誌文件路徑
  const logFilePath = path.join(logDir, 'db-performance.log');

  // 記錄查詢日誌的函數
  const logQuery = (type, id, collection, method, time, args) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      type,
      id,
      collection,
      method,
      time_ms: time,
      args: JSON.stringify(args),
    };

    // 寫入到日誌文件
    fs.appendFile(logFilePath, JSON.stringify(logEntry) + '\n', { flag: 'a' }, (err) => {
      if (err) console.error('Error writing to query log:', err);
    });

    // 同時輸出到控制台
    if (time > slowQueryThreshold) {
      console.warn(
        `[SLOW ${type} #${id}] ${collection}.${method} (${time}ms)`,
        JSON.stringify(args)
      );
    }
  };
};

/**
 * 初始化查詢監控並設置索引提示
 */
const initQueryMonitor = () => {
  // 設置慢查詢監控（大於 500ms 的查詢視為慢查詢）
  setupQueryMonitor(500);

  // 添加索引使用提示到 mongoose 查詢
  const originalExec = mongoose.Query.prototype.exec;

  mongoose.Query.prototype.exec = function () {
    // 只在開發環境下檢查索引使用
    if (process.env.NODE_ENV === 'development') {
      // 獲取查詢的解釋計劃
      this.explain = true;
    }

    return originalExec.apply(this, arguments);
  };

  console.log('Query monitoring initialized');

  mongoose.connection.on('connected', () => {
    // 監控數據庫查詢
    mongoose.set('debug', (collectionName, methodName, ...methodArgs) => {
      const startTime = Date.now();
      const queryId = Math.floor(Math.random() * 10000);

      // 當查詢完成時
      mongoose.connection.once('query', () => {
        const endTime = Date.now();
        const queryTime = endTime - startTime;

        // 記錄查詢信息
        logQuery('QUERY', queryId, collectionName, methodName, queryTime, methodArgs);
      });
    });
  });

  // 監聽 MongoDB 聚合操作
  mongoose.connection.on('aggregate', (collectionName, pipeline, options) => {
    const startTime = Date.now();
    const queryId = Math.floor(Math.random() * 10000);

    // 當聚合完成時
    mongoose.connection.once('aggregateResult', () => {
      const endTime = Date.now();
      const queryTime = endTime - startTime;

      // 記錄聚合查詢信息
      logQuery('AGGREGATE', queryId, collectionName, 'aggregate', queryTime, pipeline);
    });
  });

  // 監控特定的模型操作
  const monitorModel = (model) => {
    ['find', 'findOne', 'findById', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany'].forEach(
      (method) => {
        const original = model[method];

        model[method] = function (...args) {
          const startTime = Date.now();
          const queryId = Math.floor(Math.random() * 10000);
          const result = original.apply(this, args);

          // 擴展 exec 方法以監控執行時間
          const originalExec = result.exec;
          result.exec = function (...execArgs) {
            return originalExec.apply(this, execArgs).then((res) => {
              const endTime = Date.now();
              const queryTime = endTime - startTime;

              // 記錄查詢信息
              logQuery('MODEL', queryId, model.modelName, method, queryTime, args);

              return res;
            });
          };

          return result;
        };
      }
    );
  };

  // 監控所有已註冊的模型
  Object.values(mongoose.models).forEach(monitorModel);
};

module.exports = initQueryMonitor;
