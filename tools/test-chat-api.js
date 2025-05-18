/**
 * 完全改良版聊天系統功能測試腳本
 */

const axios = require('axios');
const API_URL = 'http://localhost:5000/api';

// 測試用戶數據
const testUsers = [
  {
    email: 'test1@example.com',
    password: 'password123',
    name: '測試用戶1',
  },
  {
    email: 'test2@example.com',
    password: 'password123',
    name: '測試用戶2',
  },
];

// 用於儲存測試過程中的數據
const testData = {
  users: [],
  tokens: [],
  conversation: null,
  messages: [],
};

/**
 * 安全地訪問對象屬性，避免 undefined 錯誤
 */
function safeGet(obj, path, defaultValue = undefined) {
  if (!obj) return defaultValue;

  const keys = path.split('.');
  let result = obj;

  for (const key of keys) {
    if (result === null || result === undefined || typeof result !== 'object') {
      return defaultValue;
    }
    result = result[key];
    if (result === undefined) {
      return defaultValue;
    }
  }

  return result !== undefined ? result : defaultValue;
}

/**
 * 測試用戶登入
 */
async function testUserLogin() {
  console.log('開始測試: 用戶登入');

  for (let i = 0; i < testUsers.length; i++) {
    const user = testUsers[i];
    try {
      console.log(`嘗試登入用戶 ${user.name}...`);
      const response = await axios.post(`${API_URL}/auth/login`, {
        email: user.email,
        password: user.password,
      });

      if (response.data && response.data.success) {
        console.log(`✅ 用戶 ${user.name} 登入成功`);

        // 獲取用戶數據
        const userData = response.data.data || {};
        console.log('用戶數據:', userData);

        testData.users.push(userData);
        testData.tokens.push(response.data.token);
      } else {
        console.error(`❌ 用戶 ${user.name} 登入失敗:`, response.data);
      }
    } catch (error) {
      console.error(
        `❌ 用戶 ${user.name} 登入錯誤:`,
        safeGet(error, 'response.data', error.message)
      );
    }
  }

  console.log('-----------------------');
}

/**
 * 測試建立對話
 */
async function testCreateConversation() {
  console.log('開始測試: 建立對話');

  if (testData.users.length < 2 || testData.tokens.length < 2) {
    console.error('❌ 沒有足夠的用戶進行測試');
    return;
  }

  // 顯示用戶資料進行確認
  console.log('用戶資料:');
  testData.users.forEach((user, index) => {
    console.log(`用戶 ${index + 1}: ID=${user._id}, 名稱=${user.name}`);
  });

  try {
    const userId = testData.users[1]._id;

    console.log(`嘗試創建與用戶 ID=${userId} 的對話`);

    const response = await axios.post(
      `${API_URL}/chat/conversations`,
      { userId },
      {
        headers: {
          Authorization: `Bearer ${testData.tokens[0]}`,
        },
      }
    );

    if (response.data && response.data.success) {
      console.log(`✅ 對話建立成功`);
      console.log('對話數據:', response.data.data);
      testData.conversation = response.data.data;
    } else {
      console.error('❌ 對話建立失敗:', response.data);
    }
  } catch (error) {
    console.error('❌ 對話建立錯誤:');

    if (error.response) {
      console.error('狀態碼:', error.response.status);
      console.error('錯誤數據:', error.response.data);
    } else {
      console.error('錯誤信息:', error.message);
    }

    // 嘗試檢查現有對話
    try {
      console.log('嘗試獲取現有對話...');

      const response = await axios.get(`${API_URL}/chat/conversations`, {
        headers: {
          Authorization: `Bearer ${testData.tokens[0]}`,
        },
      });

      if (response.data && response.data.success) {
        const conversations = response.data.data || [];

        if (conversations.length > 0) {
          console.log(`找到 ${conversations.length} 個現有對話`);

          // 使用第一個對話進行測試
          testData.conversation = conversations[0];
          console.log('使用現有對話:', testData.conversation);
        } else {
          console.log('沒有找到現有對話');
        }
      }
    } catch (err) {
      console.error('獲取現有對話錯誤:', err.message);
    }
  }

  console.log('-----------------------');
}

/**
 * 測試發送訊息
 */
async function testSendMessages() {
  console.log('開始測試: 發送訊息');

  if (!testData.conversation || !testData.conversation._id) {
    console.error('❌ 沒有對話進行測試');
    return;
  }

  const testMessages = [
    {
      sender: 0,
      content: `嗨，這是一條測試訊息！${Date.now()}`,
    },
    {
      sender: 1,
      content: `你好！我已收到你的訊息。${Date.now()}`,
    },
    {
      sender: 0,
      content: `太好了，聊天系統正常運作！${Date.now()}`,
    },
  ];

  for (const message of testMessages) {
    try {
      const response = await axios.post(
        `${API_URL}/chat/conversations/${testData.conversation._id}/messages`,
        { content: message.content },
        {
          headers: {
            Authorization: `Bearer ${testData.tokens[message.sender]}`,
          },
        }
      );

      if (response.data && response.data.success) {
        const senderName = safeGet(
          testData.users[message.sender],
          'name',
          `用戶 ${message.sender}`
        );
        console.log(`✅ 用戶 ${senderName} 發送訊息成功`);
        testData.messages.push(response.data.data);
      } else {
        console.error(`❌ 發送訊息失敗:`, response.data);
      }
    } catch (error) {
      console.error(`❌ 發送訊息錯誤:`, safeGet(error, 'response.data', error.message));
    }
  }

  console.log('-----------------------');
}

/**
 * 測試獲取對話訊息
 */
async function testGetMessages() {
  console.log('開始測試: 獲取對話訊息');

  if (!testData.conversation || !testData.conversation._id) {
    console.error('❌ 沒有對話進行測試');
    return;
  }

  try {
    const response = await axios.get(
      `${API_URL}/chat/conversations/${testData.conversation._id}/messages`,
      {
        headers: {
          Authorization: `Bearer ${testData.tokens[0]}`,
        },
      }
    );

    if (response.data && response.data.success) {
      const messages = response.data.data || [];
      console.log(`✅ 獲取訊息成功，共 ${messages.length} 條訊息`);

      if (messages.length > 0) {
        console.log('\n訊息列表:');
        messages.forEach((message, index) => {
          const senderName = safeGet(message, 'sender.name', '未知用戶');
          const content = safeGet(message, 'content', '(無內容)');
          const isMine = safeGet(message, 'isMine', false);
          const isRead = safeGet(message, 'isRead', false);

          console.log(`${index + 1}. ${senderName}: ${content}`);
          console.log(`   ${isMine ? '我的訊息' : '對方訊息'} - ${isRead ? '已讀' : '未讀'}`);
        });
      }
    } else {
      console.error('❌ 獲取訊息失敗:', response.data);
    }
  } catch (error) {
    console.error('❌ 獲取訊息錯誤:', safeGet(error, 'response.data', error.message));
  }

  console.log('-----------------------');
}

/**
 * 測試標記訊息為已讀
 */
async function testMarkAsRead() {
  console.log('開始測試: 標記訊息為已讀');

  if (!testData.conversation || !testData.conversation._id) {
    console.error('❌ 沒有對話進行測試');
    return;
  }

  try {
    const response = await axios.put(
      `${API_URL}/chat/conversations/${testData.conversation._id}/read`,
      {},
      {
        headers: {
          Authorization: `Bearer ${testData.tokens[1]}`,
        },
      }
    );

    if (response.data && response.data.success) {
      console.log(`✅ 標記訊息為已讀成功，更新了 ${safeGet(response.data, 'count', 0)} 條訊息`);
    } else {
      console.error('❌ 標記已讀失敗:', response.data);
    }
  } catch (error) {
    console.error('❌ 標記已讀錯誤:', safeGet(error, 'response.data', error.message));
  }

  console.log('-----------------------');
}

/**
 * 測試獲取所有對話
 */
async function testGetConversations() {
  console.log('開始測試: 獲取所有對話');

  for (let i = 0; i < testData.tokens.length; i++) {
    try {
      const response = await axios.get(`${API_URL}/chat/conversations`, {
        headers: {
          Authorization: `Bearer ${testData.tokens[i]}`,
        },
      });

      if (response.data && response.data.success) {
        const userName = safeGet(testData.users[i], 'name', `用戶 ${i}`);
        const conversations = response.data.data || [];

        console.log(`✅ 用戶 ${userName} 獲取對話列表成功，共 ${conversations.length} 個對話`);

        if (conversations.length > 0) {
          console.log(`\n${userName} 的對話列表:`);
          conversations.forEach((conv, index) => {
            const otherUserName = safeGet(conv, 'otherUser.name', '未知用戶');
            const lastMessage = safeGet(conv, 'lastMessage.content', '(無訊息)');
            const unreadCount = safeGet(conv, 'unreadCount', 0);

            console.log(`${index + 1}. 與 ${otherUserName} 的對話`);
            console.log(`   最後訊息: ${lastMessage}`);
            console.log(`   未讀訊息: ${unreadCount} 條`);
          });
        }
      } else {
        console.error(`❌ 獲取對話列表失敗:`, response.data);
      }
    } catch (error) {
      console.error('❌ 獲取對話列表錯誤:', safeGet(error, 'response.data', error.message));
    }
  }

  console.log('-----------------------');
}

/**
 * 運行所有測試
 */
async function runTests() {
  console.log('=========================================');
  console.log('開始聊天功能測試...');
  console.log('=========================================\n');

  try {
    await testUserLogin();
    await testCreateConversation();
    await testSendMessages();
    await testGetMessages();
    await testMarkAsRead();
    await testGetConversations();

    console.log('\n=========================================');
    console.log('✅ 所有測試完成');
    console.log('=========================================');
  } catch (error) {
    console.error('\n=========================================');
    console.error('❌ 測試過程中發生錯誤:', error);
    console.error('=========================================');
  }
}

// 執行測試
runTests();
