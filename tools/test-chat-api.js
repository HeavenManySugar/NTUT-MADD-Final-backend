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
 * 測試在線狀態功能
 */
async function testOnlineStatus() {
  console.log('開始測試: 在線狀態功能');

  if (testData.users.length < 2 || testData.tokens.length < 2) {
    console.error('❌ 沒有足夠的用戶進行測試');
    return;
  }

  try {
    // 創建 Socket.IO 客戶端，用於測試在線狀態功能
    const io = require('socket.io-client');

    console.log('嘗試連接 Socket.IO 並測試在線用戶功能...');

    // 為第一個用戶創建 socket 連接
    const socket1 = io('http://localhost:5000', {
      auth: {
        token: testData.tokens[0],
      },
    });

    socket1.on('connect', () => {
      console.log(`✅ 第一個用戶成功連接到 Socket.IO`);
    });

    socket1.on('connect_error', (error) => {
      console.error(`❌ 第一個用戶連接錯誤:`, error.message);
    });

    // 等待連接建立
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 測試獲取在線用戶列表
    socket1.emit('user:getOnline');

    socket1.once('user:onlineList', (onlineUsers) => {
      console.log(`✅ 收到在線用戶列表:`, onlineUsers);
      console.log(`在線用戶數量: ${onlineUsers.length}`);

      // 檢查當前用戶是否在在線列表中
      const userInList = onlineUsers.includes(testData.users[0]._id);
      console.log(`當前用戶在列表中: ${userInList ? '是' : '否'}`);
    });

    // 測試用戶狀態更新
    socket1.on('user:status', (data) => {
      console.log(`收到用戶狀態更新: 用戶 ${data.userId} 的狀態為 ${data.status}`);
    });

    // 等待事件處理
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 連接第二個用戶，測試狀態變化通知
    console.log('嘗試連接第二個用戶...');
    const socket2 = io('http://localhost:5000', {
      auth: {
        token: testData.tokens[1],
      },
    });

    socket2.on('connect', () => {
      console.log(`✅ 第二個用戶成功連接到 Socket.IO`);
    });

    // 等待連接和事件處理
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // 斷開第二個用戶的連接，測試離線狀態
    socket2.disconnect();
    console.log('第二個用戶已斷開連接');

    // 等待離線狀態事件
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // 最後，斷開第一個用戶連接
    socket1.disconnect();
    console.log('第一個用戶已斷開連接');
  } catch (error) {
    console.error('❌ 測試在線狀態功能錯誤:', error.message);
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
          const senderId = safeGet(message, 'sender._id', '未知ID');
          const content = safeGet(message, 'content', '(無內容)');
          const isMine = safeGet(message, 'isMine', false);
          const isRead = safeGet(message, 'isRead', false);
          const createdAt = new Date(safeGet(message, 'createdAt', Date.now())).toLocaleString();

          console.log(`${index + 1}. ${senderName} (ID: ${senderId}): ${content}`);
          console.log(
            `   ${isMine ? '我的訊息' : '對方訊息'} - ${
              isRead ? '已讀' : '未讀'
            } - 發送時間: ${createdAt}`
          );
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
 * 測試訊息發送者資訊
 */
async function testMessageSenderInfo() {
  console.log('開始測試: 訊息發送者資訊');

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

      if (messages.length > 0) {
        console.log(`✅ 獲取對話訊息成功，檢查發送者資訊`);

        let allValid = true;
        const validationResults = [];

        // 檢查每條訊息的發送者資訊
        messages.forEach((message, index) => {
          const hasSenderId = !!safeGet(message, 'sender._id', false);
          const hasSenderName = !!safeGet(message, 'sender.name', false);
          const hasIsMineFlag = safeGet(message, 'isMine', null) !== null;

          const isValid = hasSenderId && hasSenderName && hasIsMineFlag;
          allValid = allValid && isValid;

          validationResults.push({
            messageId: message._id,
            hasSenderId,
            hasSenderName,
            hasIsMineFlag,
            isValid,
          });
        });

        // 顯示驗證結果
        console.log(`\n發送者資訊驗證結果:`);
        validationResults.forEach((result, index) => {
          console.log(`訊息 ${index + 1} (ID: ${result.messageId}):`);
          console.log(`  發送者ID: ${result.hasSenderId ? '✅ 正確' : '❌ 缺失'}`);
          console.log(`  發送者名稱: ${result.hasSenderName ? '✅ 正確' : '❌ 缺失'}`);
          console.log(`  isMine標記: ${result.hasIsMineFlag ? '✅ 正確' : '❌ 缺失'}`);
          console.log(`  結果: ${result.isValid ? '✅ 有效' : '❌ 無效'}`);
        });

        // 總結果
        if (allValid) {
          console.log(`\n✅ 所有訊息都包含完整的發送者資訊`);
        } else {
          console.error(`\n❌ 部分訊息缺少發送者資訊，請檢查詳細結果`);
        }
      } else {
        console.log('沒有訊息可供測試');
      }
    } else {
      console.error('❌ 獲取訊息失敗:', response.data);
    }
  } catch (error) {
    console.error('❌ 測試訊息發送者資訊錯誤:', safeGet(error, 'response.data', error.message));
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
    await testOnlineStatus();
    await testMessageSenderInfo();

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
