/**
 * Enhanced Load Testing Script
 * Performs comprehensive load testing on the backend
 * Usage: node tools/enhanced-load-test.js --endpoint=auth/login --users=50 --duration=30
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { EventEmitter } = require('events');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

// Increase max listeners
EventEmitter.defaultMaxListeners = 30;

// Parse command line arguments
const args = {};
process.argv.slice(2).forEach((arg) => {
  const [key, value] = arg.replace(/^--/, '').split('=');
  args[key] = value;
});

// Configuration
const API_BASE_URL = process.env.API_URL || args.url || 'http://localhost:3000/api';
const TEST_ENDPOINT = args.endpoint || 'auth/login';
const CONCURRENT_USERS = parseInt(args.users || process.env.CONCURRENT_USERS || '50');
const TEST_DURATION = parseInt(args.duration || process.env.TEST_DURATION || '30'); // seconds
const WORKER_COUNT = parseInt(args.workers || Math.max(1, os.cpus().length - 1));
const LOG_FILE = path.join(__dirname, '../logs/enhanced-load-test.log');
const DETAILED_RESULTS_FILE = path.join(__dirname, '../logs/detailed-load-test-results.json');

// Test data
const TEST_ENDPOINTS = {
  'auth/login': {
    method: 'post',
    path: '/auth/login',
    payload: { email: 'test@example.com', password: 'password123' },
    authRequired: false,
  },
  'auth/me': {
    method: 'get',
    path: '/auth/me',
    authRequired: true,
  },
  tasks: {
    method: 'get',
    path: '/tasks',
    authRequired: true,
  },
  'tasks/create': {
    method: 'post',
    path: '/tasks',
    payload: {
      title: 'Load Test Task',
      description: 'Created during load testing',
      dueDate: new Date(Date.now() + 86400000).toISOString(),
    },
    authRequired: true,
  },
};

// If running in main thread, start worker threads
if (isMainThread) {
  console.log('= Enhanced Load Testing Tool =');
  console.log(`Testing endpoint: ${TEST_ENDPOINT}`);
  console.log(`Concurrent users: ${CONCURRENT_USERS}`);
  console.log(`Test duration: ${TEST_DURATION} seconds`);
  console.log(`Using ${WORKER_COUNT} workers`);
  console.log('-'.repeat(40));

  // Create logs directory if it doesn't exist
  const logsDir = path.join(__dirname, '../logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }

  // Login to get a token first if testing an authenticated endpoint
  const endpoint = TEST_ENDPOINTS[TEST_ENDPOINT];
  if (!endpoint) {
    console.error(
      `Unknown endpoint: ${TEST_ENDPOINT}. Available endpoints: ${Object.keys(TEST_ENDPOINTS).join(
        ', '
      )}`
    );
    process.exit(1);
  }

  if (endpoint.authRequired) {
    console.log('Acquiring authentication token...');
    getAuthToken()
      .then((token) => {
        console.log('Token acquired. Starting load test...');
        startWorkers(token);
      })
      .catch((err) => {
        console.error('Failed to get auth token:', err.message);
        process.exit(1);
      });
  } else {
    console.log('No authentication required. Starting load test...');
    startWorkers();
  }
} else {
  // Worker thread code
  runWorker(workerData);
}

/**
 * Start worker threads
 * @param {string} token - Authentication token if needed
 */
function startWorkers(token = null) {
  // Calculate users per worker
  const usersPerWorker = Math.ceil(CONCURRENT_USERS / WORKER_COUNT);
  let remaining = CONCURRENT_USERS;

  // Store combined results
  const combinedResults = {
    startTime: Date.now(),
    endTime: 0,
    totalRequests: 0,
    successRequests: 0,
    failedRequests: 0,
    responseTimesSum: 0,
    minResponseTime: Number.MAX_SAFE_INTEGER,
    maxResponseTime: 0,
    responseTimes: [],
    statusCodes: {},
    errors: [],
    rps: 0,
  };

  // Count completed workers
  let completedWorkers = 0;

  // Start workers
  for (let i = 0; i < WORKER_COUNT; i++) {
    const workerUsers = Math.min(usersPerWorker, remaining);
    remaining -= workerUsers;

    if (workerUsers <= 0) continue;

    const worker = new Worker(__filename, {
      workerData: {
        workerId: i + 1,
        users: workerUsers,
        duration: TEST_DURATION,
        endpoint: TEST_ENDPOINT,
        baseUrl: API_BASE_URL,
        token: token,
      },
    });

    worker.on('message', (result) => {
      // Combine results
      combinedResults.totalRequests += result.totalRequests;
      combinedResults.successRequests += result.successRequests;
      combinedResults.failedRequests += result.failedRequests;
      combinedResults.responseTimesSum += result.responseTimesSum;
      combinedResults.minResponseTime = Math.min(
        combinedResults.minResponseTime,
        result.minResponseTime
      );
      combinedResults.maxResponseTime = Math.max(
        combinedResults.maxResponseTime,
        result.maxResponseTime
      );
      combinedResults.responseTimes.push(...result.responseTimes);

      // Combine status codes
      Object.entries(result.statusCodes).forEach(([code, count]) => {
        combinedResults.statusCodes[code] = (combinedResults.statusCodes[code] || 0) + count;
      });

      // Add errors
      combinedResults.errors.push(...result.errors);

      // Log progress
      console.log(
        `Worker ${result.workerId} completed: ${result.successRequests} successful requests, ${result.failedRequests} failed`
      );
    });

    worker.on('error', (error) => {
      console.error(`Worker ${i + 1} error:`, error);
    });

    worker.on('exit', (code) => {
      completedWorkers++;
      if (completedWorkers === WORKER_COUNT) {
        // All workers finished, calculate final results
        combinedResults.endTime = Date.now();
        const durationSecs = (combinedResults.endTime - combinedResults.startTime) / 1000;
        combinedResults.rps = combinedResults.totalRequests / durationSecs;

        // Calculate percentiles
        combinedResults.responseTimes.sort((a, b) => a - b);
        const p50Index = Math.floor(combinedResults.responseTimes.length * 0.5);
        const p90Index = Math.floor(combinedResults.responseTimes.length * 0.9);
        const p95Index = Math.floor(combinedResults.responseTimes.length * 0.95);
        const p99Index = Math.floor(combinedResults.responseTimes.length * 0.99);

        const avgResponseTime = combinedResults.responseTimesSum / combinedResults.totalRequests;

        // Print results
        console.log('\n== Load Test Results ==');
        console.log(`Duration: ${durationSecs.toFixed(2)} seconds`);
        console.log(`Total Requests: ${combinedResults.totalRequests}`);
        console.log(
          `Successful Requests: ${combinedResults.successRequests} (${(
            (combinedResults.successRequests / combinedResults.totalRequests) *
            100
          ).toFixed(2)}%)`
        );
        console.log(
          `Failed Requests: ${combinedResults.failedRequests} (${(
            (combinedResults.failedRequests / combinedResults.totalRequests) *
            100
          ).toFixed(2)}%)`
        );
        console.log(`Requests Per Second: ${combinedResults.rps.toFixed(2)}`);
        console.log(`Average Response Time: ${avgResponseTime.toFixed(2)} ms`);
        console.log(`Min Response Time: ${combinedResults.minResponseTime} ms`);
        console.log(`Max Response Time: ${combinedResults.maxResponseTime} ms`);
        console.log(`Median Response Time (P50): ${combinedResults.responseTimes[p50Index]} ms`);
        console.log(`90th Percentile (P90): ${combinedResults.responseTimes[p90Index]} ms`);
        console.log(`95th Percentile (P95): ${combinedResults.responseTimes[p95Index]} ms`);
        console.log(`99th Percentile (P99): ${combinedResults.responseTimes[p99Index]} ms`);

        console.log('\nStatus Codes:');
        Object.entries(combinedResults.statusCodes).forEach(([code, count]) => {
          console.log(
            `  ${code}: ${count} (${((count / combinedResults.totalRequests) * 100).toFixed(2)}%)`
          );
        });

        if (combinedResults.errors.length > 0) {
          console.log('\nTop Errors:');
          const errorCounts = {};
          combinedResults.errors.forEach((error) => {
            errorCounts[error] = (errorCounts[error] || 0) + 1;
          });

          Object.entries(errorCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .forEach(([error, count]) => {
              console.log(`  ${error}: ${count} times`);
            });
        }

        // Store detailed results
        const detailedResults = {
          ...combinedResults,
          testEndpoint: TEST_ENDPOINT,
          concurrentUsers: CONCURRENT_USERS,
          testDuration: TEST_DURATION,
          testTime: new Date().toISOString(),
          system: {
            platform: os.platform(),
            cpus: os.cpus().length,
            memory: {
              total: os.totalmem(),
              free: os.freemem(),
            },
          },
        };

        // Log summary to file
        const summary = `
========== LOAD TEST SUMMARY ==========
Endpoint: ${TEST_ENDPOINT}
Time: ${new Date().toISOString()}
Duration: ${durationSecs.toFixed(2)} seconds
Concurrent Users: ${CONCURRENT_USERS}
Total Requests: ${combinedResults.totalRequests}
Success Rate: ${((combinedResults.successRequests / combinedResults.totalRequests) * 100).toFixed(
          2
        )}%
Requests/Second: ${combinedResults.rps.toFixed(2)}
Avg Response Time: ${avgResponseTime.toFixed(2)} ms
P95 Response Time: ${combinedResults.responseTimes[p95Index]} ms
=======================================
`;

        fs.appendFileSync(LOG_FILE, summary);

        // Write detailed results to JSON file
        fs.writeFileSync(DETAILED_RESULTS_FILE, JSON.stringify(detailedResults, null, 2));

        console.log(`\nDetailed results saved to ${DETAILED_RESULTS_FILE}`);
        console.log(`Summary logged to ${LOG_FILE}`);
      }
    });
  }
}

/**
 * Worker function to run the load test
 * @param {Object} data - Worker data
 */
async function runWorker(data) {
  const { workerId, users, duration, endpoint, baseUrl, token } = data;

  // Use the endpoint configuration
  const endpointConfig = TEST_ENDPOINTS[endpoint];

  // Create axios instance
  const api = axios.create({
    baseURL: baseUrl,
    timeout: 10000,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  // Results object
  const results = {
    workerId,
    totalRequests: 0,
    successRequests: 0,
    failedRequests: 0,
    responseTimesSum: 0,
    minResponseTime: Number.MAX_SAFE_INTEGER,
    maxResponseTime: 0,
    responseTimes: [],
    statusCodes: {},
    errors: [],
  };

  // Create user simulations
  const userSimulations = [];
  for (let i = 0; i < users; i++) {
    userSimulations.push(simulateUser(i, api, endpointConfig, results));
  }

  // End time
  const endTime = Date.now() + duration * 1000;

  // Run user simulations
  await Promise.all(userSimulations.map((fn) => fn(endTime)));

  // Send results back to main thread
  parentPort.postMessage(results);
}

/**
 * Simulate a user making API requests
 * @param {number} userId - User ID
 * @param {axios} api - Axios instance
 * @param {Object} endpointConfig - Endpoint configuration
 * @param {Object} results - Results object to update
 * @returns {Function} - User simulation function
 */
function simulateUser(userId, api, endpointConfig, results) {
  return async function (endTime) {
    while (Date.now() < endTime) {
      try {
        const startTime = Date.now();

        // Make the request
        const response = await api({
          method: endpointConfig.method,
          url: endpointConfig.path,
          data: endpointConfig.payload,
        });

        // Calculate response time
        const responseTime = Date.now() - startTime;

        // Update results
        results.totalRequests++;
        results.successRequests++;
        results.responseTimesSum += responseTime;
        results.minResponseTime = Math.min(results.minResponseTime, responseTime);
        results.maxResponseTime = Math.max(results.maxResponseTime, responseTime);
        results.responseTimes.push(responseTime);

        // Count status code
        const statusCode = response.status;
        results.statusCodes[statusCode] = (results.statusCodes[statusCode] || 0) + 1;

        // Random delay between requests (50-200ms) to simulate real user behavior
        await delay(50 + Math.random() * 150);
      } catch (error) {
        results.totalRequests++;
        results.failedRequests++;

        // Record error
        const errorMessage = error.response
          ? `Status ${error.response.status}: ${error.response.statusText}`
          : error.message;

        results.errors.push(errorMessage);

        // If there's a status code, count it
        if (error.response && error.response.status) {
          const statusCode = error.response.status;
          results.statusCodes[statusCode] = (results.statusCodes[statusCode] || 0) + 1;
        }

        // Longer delay after error
        await delay(500 + Math.random() * 500);
      }
    }
  };
}

/**
 * Get authentication token
 * @returns {Promise<string>} - Auth token
 */
async function getAuthToken() {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'test@example.com',
      password: 'password123',
    });

    return response.data.token;
  } catch (error) {
    console.error('Authentication error:', error.message);
    throw error;
  }
}

/**
 * Delay promise
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>} - Promise that resolves after delay
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// If main thread, export functions
if (isMainThread) {
  module.exports = {
    startLoadTest: startWorkers,
    getAuthToken,
  };
}
