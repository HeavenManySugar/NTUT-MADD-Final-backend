/**
 * 負載測試腳本
 * 測試 /api/auth/login 和其他端點的性能
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// 配置
const API_BASE_URL = process.env.API_URL || 'http://localhost:3000/api';
const TEST_DURATION = process.env.TEST_DURATION || 60; // 秒
const CONCURRENT_USERS = process.env.CONCURRENT_USERS || 20;
const REQUEST_INTERVAL = process.env.REQUEST_INTERVAL || 100; // 毫秒
const LOG_FILE = path.join(__dirname, '../logs/load-test.log');

// 測試端點
const ENDPOINTS = [
  {
    name: 'Login',
    method: 'post',
    path: '/auth/login',
    payload: { email: 'test@example.com', password: 'password123' },
    weight: 5, // 權重較高，測試更頻繁
  },
  {
    name: 'Get Tasks',
    method: 'get',
    path: '/tasks',
    auth: true,
    weight: 3,
  },
  {
    name: 'Get Profile',
    method: 'get',
    path: '/auth/me',
    auth: true,
    weight: 2,
  },
];

// 測試結果
const results = {
  totalRequests: 0,
  successRequests: 0,
  failedRequests: 0,
  startTime: 0,
  endTime: 0,
  endpoints: {},
};

// 用戶會話
const sessions = [];

// 初始化結果
ENDPOINTS.forEach((endpoint) => {
  results.endpoints[endpoint.name] = {
    requests: 0,
    success: 0,
    failed: 0,
    totalResponseTime: 0,
    avgResponseTime: 0,
    minResponseTime: Number.MAX_SAFE_INTEGER,
    maxResponseTime: 0,
    responses: [],
  };
});

// 確保日誌目錄存在
if (!fs.existsSync(path.join(__dirname, '../logs'))) {
  fs.mkdirSync(path.join(__dirname, '../logs'), { recursive: true });
}

// 清空日誌文件
fs.writeFileSync(LOG_FILE, '');

// 記錄到日誌文件
function logToFile(message) {
  const timestamp = new Date().toISOString();
  fs.appendFileSync(LOG_FILE, `[${timestamp}] ${message}\n`);
}

// 模擬用戶登錄
async function userLogin() {
  const loginEndpoint = ENDPOINTS.find((e) => e.name === 'Login');
  try {
    const response = await axios.post(
      `${API_BASE_URL}${loginEndpoint.path}`,
      loginEndpoint.payload
    );
    return response.data.token;
  } catch (error) {
    console.error('Login failed:', error.message);
    return null;
  }
}

// 創建虛擬用戶會話
async function createSessions() {
  console.log(`創建 ${CONCURRENT_USERS} 個用戶會話...`);
  for (let i = 0; i < CONCURRENT_USERS; i++) {
    const token = await userLogin();
    if (token) {
      sessions.push({ id: i, token, lastRequest: 0 });
    }
  }
  console.log(`創建了 ${sessions.length} 個活躍會話`);
}

// 選擇端點進行測試
function selectEndpoint() {
  // 基於權重選擇端點
  const totalWeight = ENDPOINTS.reduce((sum, endpoint) => sum + endpoint.weight, 0);
  let random = Math.random() * totalWeight;

  for (const endpoint of ENDPOINTS) {
    random -= endpoint.weight;
    if (random <= 0) {
      return endpoint;
    }
  }

  return ENDPOINTS[0];
}

// 發送單個請求
async function sendRequest(session) {
  const endpoint = selectEndpoint();

  if (endpoint.auth && !session.token) {
    return;
  }

  const config = {
    headers: {},
  };

  if (endpoint.auth) {
    config.headers.Authorization = `Bearer ${session.token}`;
  }

  const startTime = Date.now();

  try {
    let response;

    if (endpoint.method.toLowerCase() === 'get') {
      response = await axios.get(`${API_BASE_URL}${endpoint.path}`, config);
    } else if (endpoint.method.toLowerCase() === 'post') {
      response = await axios.post(`${API_BASE_URL}${endpoint.path}`, endpoint.payload, config);
    }

    const responseTime = Date.now() - startTime;

    results.totalRequests++;
    results.successRequests++;
    results.endpoints[endpoint.name].requests++;
    results.endpoints[endpoint.name].success++;
    results.endpoints[endpoint.name].totalResponseTime += responseTime;
    results.endpoints[endpoint.name].minResponseTime = Math.min(
      results.endpoints[endpoint.name].minResponseTime,
      responseTime
    );
    results.endpoints[endpoint.name].maxResponseTime = Math.max(
      results.endpoints[endpoint.name].maxResponseTime,
      responseTime
    );

    // 記錄響應時間（最多保留最近100條）
    results.endpoints[endpoint.name].responses.push(responseTime);
    if (results.endpoints[endpoint.name].responses.length > 100) {
      results.endpoints[endpoint.name].responses.shift();
    }

    if (responseTime > 1000) {
      logToFile(`慢請求: ${endpoint.name}, ${responseTime}ms`);
    }

    return true;
  } catch (error) {
    const responseTime = Date.now() - startTime;

    results.totalRequests++;
    results.failedRequests++;
    results.endpoints[endpoint.name].requests++;
    results.endpoints[endpoint.name].failed++;

    logToFile(`請求錯誤 ${endpoint.name}: ${error.message}`);

    if (error.response) {
      logToFile(`狀態: ${error.response.status}, 數據: ${JSON.stringify(error.response.data)}`);
    }

    return false;
  }
}

// 運行負載測試
async function runLoadTest() {
  console.log('開始負載測試...');
  logToFile(`開始負載測試，持續 ${TEST_DURATION} 秒，${CONCURRENT_USERS} 個並發用戶`);

  // 創建用戶會話
  await createSessions();

  if (sessions.length === 0) {
    console.error('無法創建用戶會話，測試中止');
    return;
  }

  // 記錄開始時間
  results.startTime = Date.now();

  // 設置測試結束時間
  const endTime = results.startTime + TEST_DURATION * 1000;

  // 測試循環
  while (Date.now() < endTime) {
    const promises = [];

    for (const session of sessions) {
      // 檢查是否需要發送新請求
      if (Date.now() - session.lastRequest >= REQUEST_INTERVAL) {
        session.lastRequest = Date.now();
        promises.push(sendRequest(session));
      }
    }

    if (promises.length > 0) {
      await Promise.all(promises);
    }

    // 簡單的進度顯示
    const elapsedSec = Math.floor((Date.now() - results.startTime) / 1000);
    const remainingSec = TEST_DURATION - elapsedSec;
    process.stdout.write(
      `\r進行中: ${elapsedSec}秒 / ${TEST_DURATION}秒, 剩餘 ${remainingSec}秒, 已發送 ${results.totalRequests} 請求`
    );

    // 短暫暫停以防止 CPU 過載
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  // 記錄結束時間
  results.endTime = Date.now();

  // 計算平均響應時間
  for (const name in results.endpoints) {
    const endpoint = results.endpoints[name];
    if (endpoint.success > 0) {
      endpoint.avgResponseTime = endpoint.totalResponseTime / endpoint.success;
    }
  }

  // 輸出結果
  console.log('\n\n測試完成!');
  console.log('==============');
  console.log(`總請求數: ${results.totalRequests}`);
  console.log(`成功請求數: ${results.successRequests}`);
  console.log(`失敗請求數: ${results.failedRequests}`);
  console.log(`總持續時間: ${(results.endTime - results.startTime) / 1000} 秒`);

  const totalRPS = results.totalRequests / ((results.endTime - results.startTime) / 1000);
  console.log(`平均請求率: ${totalRPS.toFixed(2)} 請求/秒`);

  console.log('\n端點詳情:');
  for (const name in results.endpoints) {
    const endpoint = results.endpoints[name];
    if (endpoint.requests > 0) {
      console.log(`\n${name}:`);
      console.log(`  請求數: ${endpoint.requests}`);
      console.log(`  成功數: ${endpoint.success}`);
      console.log(`  失敗數: ${endpoint.failed}`);
      console.log(`  成功率: ${((endpoint.success / endpoint.requests) * 100).toFixed(2)}%`);
      console.log(`  平均響應時間: ${endpoint.avgResponseTime.toFixed(2)} ms`);
      console.log(`  最小響應時間: ${endpoint.minResponseTime} ms`);
      console.log(`  最大響應時間: ${endpoint.maxResponseTime} ms`);

      // 計算 P95 和 P99 響應時間
      if (endpoint.responses.length > 0) {
        const sortedResponses = [...endpoint.responses].sort((a, b) => a - b);
        const p95Index = Math.floor(sortedResponses.length * 0.95);
        const p99Index = Math.floor(sortedResponses.length * 0.99);

        console.log(`  P95 響應時間: ${sortedResponses[p95Index]} ms`);
        console.log(`  P99 響應時間: ${sortedResponses[p99Index]} ms`);
      }
    }
  }

  // 將結果存入文件
  const resultFile = path.join(__dirname, '../logs/load-test-results.json');
  fs.writeFileSync(resultFile, JSON.stringify(results, null, 2));
  console.log(`\n詳細結果已保存至 ${resultFile}`);

  logToFile('測試完成');
}

// 運行測試
runLoadTest().catch((error) => {
  console.error('測試時發生錯誤:', error);
  process.exit(1);
});
