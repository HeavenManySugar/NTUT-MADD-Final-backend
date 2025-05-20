/**
 * Database Query Optimizer
 * Analyzes and optimizes database queries for better performance
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const writeFileAsync = promisify(fs.writeFile);

// Constants
const EXPLAIN_COLLECTION_THRESHOLD = 1000; // Only analyze collections with more documents
const SLOW_QUERY_THRESHOLD = 100; // ms
const LOG_FILE_PATH = path.join(__dirname, '../../logs/query-optimization.log');
const INDEX_SUGGESTIONS_PATH = path.join(__dirname, '../../logs/index-suggestions.json');

// Track query statistics
const queryStats = {
  queries: [],
  slowQueries: [],
  indexSuggestions: new Map(),
};

/**
 * Initialize the query optimizer
 */
const initQueryOptimizer = () => {
  // Create the logs directory if it doesn't exist
  const logsDir = path.join(__dirname, '../../logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // Monitor database queries
  mongoose.set('debug', (collectionName, methodName, ...methodArgs) => {
    // Skip internal MongoDB operations
    if (collectionName.startsWith('system.') || methodName === 'createIndex') {
      return;
    }

    // Convert query arguments to string for analysis
    let queryStr = '';
    try {
      queryStr = JSON.stringify(methodArgs);
    } catch (err) {
      queryStr = String(methodArgs);
    }

    // Record the start time
    const startTime = Date.now();

    // Create a done function to measure query execution time
    const done = () => {
      const executionTime = Date.now() - startTime;

      // Record query information
      const queryInfo = {
        collection: collectionName,
        operation: methodName,
        arguments: queryStr.substring(0, 200), // Truncate to avoid huge logs
        executionTime,
        timestamp: new Date().toISOString(),
      };

      // Add to queries list
      queryStats.queries.push(queryInfo);

      // Check if it's a slow query
      if (executionTime > SLOW_QUERY_THRESHOLD) {
        queryStats.slowQueries.push(queryInfo);
        console.warn(`[SLOW QUERY] ${collectionName}.${methodName} took ${executionTime}ms`);

        // Analyze query for optimization opportunities if it's a find operation
        if (['find', 'findOne'].includes(methodName)) {
          analyzeQuery(collectionName, methodName, methodArgs[0], executionTime);
        }
      }

      // Keep query stats manageable
      if (queryStats.queries.length > 1000) {
        queryStats.queries = queryStats.queries.slice(-500);
      }

      if (queryStats.slowQueries.length > 100) {
        queryStats.slowQueries = queryStats.slowQueries.slice(-50);
      }
    };

    return done;
  });

  // Save suggestions periodically
  setInterval(saveIndexSuggestions, 60000); // Every minute
};

/**
 * Analyze a query and suggest indexes
 * @param {string} collectionName - Name of the collection
 * @param {string} methodName - Query method name
 * @param {Object} query - The query object
 * @param {number} executionTime - Query execution time in ms
 */
const analyzeQuery = async (collectionName, methodName, query, executionTime) => {
  try {
    // Get the model from the collection name
    const modelName = collectionName.charAt(0).toUpperCase() + collectionName.slice(1, -1);
    const Model = mongoose.models[modelName];

    if (!Model) {
      return;
    }

    // Check if this collection has enough documents to warrant index analysis
    const count = await Model.countDocuments({});
    if (count < EXPLAIN_COLLECTION_THRESHOLD) {
      return;
    }

    // Get query explanation
    const explanation = await Model.find(query).explain();
    const winningPlan = explanation.queryPlanner.winningPlan;

    // Check if the query uses an index
    const usesIndex = winningPlan.inputStage && winningPlan.inputStage.indexName;

    // If not using an index and has significant documents, suggest one
    if (!usesIndex && count >= EXPLAIN_COLLECTION_THRESHOLD) {
      suggestIndex(collectionName, query, executionTime);
    }
  } catch (err) {
    console.error(`Error analyzing query: ${err.message}`);
  }
};

/**
 * Suggest an index for a query
 * @param {string} collectionName - Name of the collection
 * @param {Object} query - The query object
 * @param {number} executionTime - Query execution time in ms
 */
const suggestIndex = (collectionName, query, executionTime) => {
  // Get fields from the query that could benefit from indexes
  const fields = Object.keys(query).filter((field) => {
    // Skip special MongoDB operators at the root level
    return !field.startsWith('$');
  });

  if (fields.length === 0) {
    return;
  }

  // Create index suggestion
  const indexKey = `${collectionName}:${fields.sort().join(',')}`;

  // Update existing suggestion or create a new one
  if (queryStats.indexSuggestions.has(indexKey)) {
    const suggestion = queryStats.indexSuggestions.get(indexKey);
    suggestion.count++;
    suggestion.avgExecutionTime =
      (suggestion.avgExecutionTime * (suggestion.count - 1) + executionTime) / suggestion.count;
    suggestion.lastSeen = new Date().toISOString();
  } else {
    queryStats.indexSuggestions.set(indexKey, {
      collection: collectionName,
      fields: fields,
      count: 1,
      avgExecutionTime: executionTime,
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
    });
  }
};

/**
 * Save index suggestions to a file
 */
const saveIndexSuggestions = async () => {
  try {
    if (queryStats.indexSuggestions.size > 0) {
      // Convert suggestions map to array
      const suggestionsArray = Array.from(queryStats.indexSuggestions.values())
        // Sort by count (frequency) descending
        .sort((a, b) => b.count - a.count);

      // Format suggestions with MongoDB create index commands
      const formattedSuggestions = suggestionsArray.map((suggestion) => {
        const indexDef = {};
        suggestion.fields.forEach((field) => {
          indexDef[field] = 1;
        });

        return {
          ...suggestion,
          createIndexCommand: `db.${suggestion.collection}.createIndex(${JSON.stringify(
            indexDef
          )}, { background: true })`,
        };
      });

      // Save to file
      await writeFileAsync(
        INDEX_SUGGESTIONS_PATH,
        JSON.stringify(
          {
            suggestions: formattedSuggestions,
            generatedAt: new Date().toISOString(),
            message:
              'These index suggestions are based on query analysis. Review before implementing.',
          },
          null,
          2
        )
      );
    }
  } catch (err) {
    console.error(`Error saving index suggestions: ${err.message}`);
  }
};

/**
 * Get query statistics
 * @returns {Object} Query statistics
 */
const getQueryStats = () => {
  return {
    totalQueries: queryStats.queries.length,
    slowQueries: queryStats.slowQueries.length,
    avgExecutionTime:
      queryStats.queries.length > 0
        ? queryStats.queries.reduce((sum, q) => sum + q.executionTime, 0) /
          queryStats.queries.length
        : 0,
    indexSuggestions: Array.from(queryStats.indexSuggestions.values()),
  };
};

module.exports = {
  initQueryOptimizer,
  getQueryStats,
};
