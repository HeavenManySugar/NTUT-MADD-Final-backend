/**
 * Enhanced MongoDB Query Monitor
 *
 * This utility monitors database queries and provides optimization suggestions
 * by analyzing query patterns and execution plans.
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const config = require('../config');

/**
 * Monitor slow queries and log them to a file
 */
const setupQueryMonitor = (slowQueryThreshold = 500) => {
  // Ensure log directory exists
  const logDir = path.join(process.cwd(), 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // Log file path
  const logFilePath = path.join(logDir, 'db-performance.log');

  // Function to log query information
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

    // Write to log file
    fs.appendFile(logFilePath, JSON.stringify(logEntry) + '\n', { flag: 'a' }, (err) => {
      if (err) console.error('Error writing to query log:', err);
    });

    // Output to console for slow queries
    if (time > slowQueryThreshold) {
      console.warn(
        `[SLOW ${type} #${id}] ${collection}.${method} (${time}ms)`,
        JSON.stringify(args)
      );
    }
  };

  // Monitor database queries
  mongoose.connection.on('connected', () => {
    mongoose.set('debug', (collectionName, methodName, ...methodArgs) => {
      const startTime = Date.now();
      const queryId = Math.floor(Math.random() * 10000);

      // When query completes
      mongoose.connection.once('query', () => {
        const endTime = Date.now();
        const queryTime = endTime - startTime;

        // Log query information
        logQuery('QUERY', queryId, collectionName, methodName, queryTime, methodArgs);
      });
    });
  });

  // Monitor MongoDB aggregate operations
  mongoose.connection.on('aggregate', (collectionName, pipeline, options) => {
    const startTime = Date.now();
    const queryId = Math.floor(Math.random() * 10000);

    // When aggregate completes
    mongoose.connection.once('aggregateResult', () => {
      const endTime = Date.now();
      const queryTime = endTime - startTime;

      // Log aggregate query information
      logQuery('AGGREGATE', queryId, collectionName, 'aggregate', queryTime, pipeline);
    });
  });

  // Monitor specific model operations
  const monitorModel = (model) => {
    ['find', 'findOne', 'findById', 'updateOne', 'updateMany', 'deleteOne', 'deleteMany'].forEach(
      (method) => {
        const original = model[method];

        model[method] = function (...args) {
          const startTime = Date.now();
          const queryId = Math.floor(Math.random() * 10000);
          const result = original.apply(this, args);

          // Extend exec method to monitor execution time
          const originalExec = result.exec;
          result.exec = function (...execArgs) {
            return originalExec.apply(this, execArgs).then((res) => {
              const endTime = Date.now();
              const queryTime = endTime - startTime;

              // Log query information
              logQuery('MODEL', queryId, model.modelName, method, queryTime, args);

              return res;
            });
          };

          return result;
        };
      }
    );
  };

  // Monitor all registered models
  Object.values(mongoose.models).forEach(monitorModel);
};

/**
 * Setup query execution plan analyzer to provide index optimization suggestions
 */
const setupExplainAnalyzer = () => {
  // Add index usage hints to mongoose queries
  const originalExec = mongoose.Query.prototype.exec;

  mongoose.Query.prototype.exec = function () {
    // Get query execution plan in development environment
    if (process.env.NODE_ENV === 'development') {
      const query = this;

      return originalExec.apply(this, arguments).then((result) => {
        // If it's a slow query, get execution plan
        setTimeout(() => {
          try {
            const collectionName = this.model.collection.name;
            const operation = this.op;
            const conditions = this._conditions;

            // Create execution plan query
            this.model.collection
              .find(conditions)
              .explain('executionStats')
              .then((explanation) => {
                try {
                  // Analyze execution plan for optimization suggestions
                  const executionStats = explanation.executionStats;
                  const executionTimeMS = executionStats.executionTimeMillis;
                  const totalDocsExamined = executionStats.totalDocsExamined;
                  const nReturned = executionStats.nReturned;

                  // Efficiency calculation: docs examined vs returned
                  const efficiency =
                    nReturned > 0 ? totalDocsExamined / nReturned : totalDocsExamined;

                  if (efficiency > 10) {
                    // If efficiency is below threshold, log index suggestions
                    const logDir = path.join(process.cwd(), 'logs');
                    const indexHintsPath = path.join(logDir, 'index-hints.log');

                    const indexHint = {
                      timestamp: new Date().toISOString(),
                      collection: collectionName,
                      operation,
                      conditions: JSON.stringify(conditions),
                      efficiency,
                      docsExamined: totalDocsExamined,
                      docsReturned: nReturned,
                      suggestion: `Consider creating an index for ${JSON.stringify(
                        Object.keys(conditions)
                      )}`,
                    };

                    fs.appendFile(
                      indexHintsPath,
                      JSON.stringify(indexHint) + '\n',
                      { flag: 'a' },
                      (err) => {
                        if (err) console.error('Error writing index hint:', err);
                      }
                    );

                    console.warn(
                      `[INDEX HINT] Collection: ${collectionName}, Efficiency: ${efficiency.toFixed(
                        2
                      )}, Suggestion: Create an index for ${JSON.stringify(
                        Object.keys(conditions)
                      )}`
                    );
                  }
                } catch (analysisErr) {
                  console.error('Error analyzing execution plan:', analysisErr);
                }
              })
              .catch((err) => {
                // Silently ignore explain errors
              });
          } catch (explainErr) {
            // Silently ignore errors in the background analyzer
          }
        }, 0);

        return result;
      });
    }

    return originalExec.apply(this, arguments);
  };
};

/**
 * Initialize query monitoring and setup index hints
 */
const initQueryMonitor = () => {
  // Set up slow query monitoring
  setupQueryMonitor(500);

  // Set up execution plan analyzer
  setupExplainAnalyzer();

  console.log('Enhanced query monitoring initialized');
};

module.exports = initQueryMonitor;
