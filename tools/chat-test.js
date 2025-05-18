/**
 * 測試聊天功能的簡單命令行工具
 * 通過此工具，可以模擬聊天互動並測試 Socket.IO 連接
 */

const readline = require('readline');
const axios = require('axios');
const { io } = require('socket.io-client');
const jwt = require('jsonwebtoken');

// 配置
const API_URL = 'http://localhost:5000/api';
let accessToken = '';
let socket = null;
let currentUser = null;
let activeConversation = null;

// 創建命令行界面
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// 顯示幫助訊息
function showHelp() {
  console.log('\n---- 聊天測試工具命令列表 ----');
  console.log('login [email] [password] - 登錄用戶');
  console.log('list - 列出所有對話');
  console.log('start [userId] - 與用戶開始新對話');
  console.log('open [conversationId] - 打開指定對話');
  console.log('message [content] - 在當前對話中發送訊息');
  console.log('read - 標記當前對話中的所有訊息為已讀');
  console.log('typing [true/false] - 發送輸入狀態');
  console.log('online - 獲取在線用戶列表');
  console.log('exit - 退出當前對話');
  console.log('logout - 登出用戶');
  console.log('help - 顯示此幫助訊息');
  console.log('quit - 退出應用程序');
  console.log('------------------------------\n');
}

// 登錄用戶
async function login(email, password) {
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email,
      password,
    });

    accessToken = response.data.token;
    currentUser = response.data.data;

    console.log(`已登錄: ${currentUser.name}`);

    // 連接到 Socket.IO
    connectSocket();

    return true;
  } catch (error) {
    console.error('登錄失敗:', error.response?.data?.error || error.message);
    return false;
  }
}

// 連接到 Socket.IO
function connectSocket() {
  if (!accessToken) {
    console.error('未登入，無法連接到聊天服務');
    return;
  }

  socket = io(`http://localhost:5000`, {
    auth: {
      token: accessToken,
    },
  });

  socket.on('connect', () => {
    console.log('已連接到聊天服務器');
  });

  socket.on('disconnect', () => {
    console.log('與聊天服務器的連接已關閉');
  });

  socket.on('error', (error) => {
    console.error('聊天連接錯誤:', error);
  });
  // 監聽新訊息
  socket.on('message:new', (message) => {
    if (activeConversation && message.conversation === activeConversation._id) {
      const isMine = message.sender._id === currentUser._id;
      const senderInfo = isMine ? '我' : `${message.sender.name} (ID: ${message.sender._id})`;
      console.log(`${senderInfo}: ${message.content}`);

      // 如果訊息不是我發的，則標記為已讀
      if (!isMine) {
        socket.emit('message:read', { conversationId: activeConversation._id });
      }
    } else {
      console.log(
        `\n[新訊息] ${message.sender.name} (ID: ${message.sender._id}): ${message.content}\n`
      );
    }
  });

  // 監聽已讀狀態
  socket.on('message:read', (data) => {
    console.log(`\n[通知] 用戶 ${data.userId} 已讀取對話 ${data.conversationId} 中的訊息\n`);
  });

  // 監聽用戶狀態
  socket.on('user:status', (data) => {
    console.log(`\n[狀態] 用戶 ${data.userId} 現在狀態為 ${data.status}\n`);
  });

  // 監聽在線用戶列表
  socket.on('user:onlineList', (onlineUsers) => {
    console.log(`\n[在線用戶] 目前在線用戶數量: ${onlineUsers.length}`);
    console.log(`在線用戶列表: ${onlineUsers.join(', ')}\n`);
  });

  // 監聽輸入狀態
  socket.on('user:typing', (data) => {
    if (activeConversation && data.conversationId === activeConversation._id) {
      console.log(`\n[輸入] 用戶 ${data.userId} ${data.isTyping ? '正在輸入...' : '停止輸入'}\n`);
    }
  });

  // 監聽對話更新
  socket.on('conversation:update', (conversation) => {
    console.log(`\n[對話更新] 對話 ${conversation._id} 已更新\n`);
  });
}

// 列出所有對話
async function listConversations() {
  try {
    const response = await axios.get(`${API_URL}/chat/conversations`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const conversations = response.data.data;

    if (conversations.length === 0) {
      console.log('沒有對話記錄');
      return;
    }

    // 獲取在線用戶列表
    let onlineUsers = [];
    if (socket) {
      socket.emit('user:getOnline');
      // 等待在線用戶列表
      onlineUsers = await new Promise((resolve) => {
        const timeout = setTimeout(() => resolve([]), 1000); // 1秒超時
        socket.once('user:onlineList', (list) => {
          clearTimeout(timeout);
          resolve(list);
        });
      });
    }

    console.log('\n--- 對話列表 ---');
    conversations.forEach((conv, index) => {
      const otherUser = conv.otherUser || { name: '未知用戶', _id: '未知ID' };
      const isUserOnline = onlineUsers.includes(otherUser._id);
      const lastMessage = conv.lastMessage
        ? `最新訊息: ${conv.lastMessage.content.substring(0, 20)}${
            conv.lastMessage.content.length > 20 ? '...' : ''
          }`
        : '無訊息';

      console.log(
        `${index + 1}. ${otherUser.name} ${isUserOnline ? '(在線)' : '(離線)'} - ${lastMessage} ${
          conv.unreadCount > 0 ? `(${conv.unreadCount} 未讀)` : ''
        }`
      );
      console.log(`   ID: ${conv._id}, 對方用戶ID: ${otherUser._id}`);
    });
    console.log('----------------\n');
  } catch (error) {
    console.error('獲取對話列表失敗:', error.response?.data?.error || error.message);
  }
}

// 開始新對話
async function startConversation(userId) {
  try {
    const response = await axios.post(
      `${API_URL}/chat/conversations`,
      { userId },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    activeConversation = response.data.data;

    const otherUser = activeConversation.participants.find((p) => p._id !== currentUser._id);

    console.log(`\n已開始與 ${otherUser.name} 的對話 (ID: ${activeConversation._id})`);
    await getMessages(activeConversation._id);
  } catch (error) {
    console.error('開始對話失敗:', error.response?.data?.error || error.message);
  }
}

// 打開對話
async function openConversation(conversationId) {
  try {
    const response = await axios.get(`${API_URL}/chat/conversations/${conversationId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    activeConversation = response.data.data;

    const otherUser = activeConversation.participants.find((p) => p._id !== currentUser._id);

    console.log(`\n已打開與 ${otherUser.name} 的對話`);
    await getMessages(conversationId);
  } catch (error) {
    console.error('打開對話失敗:', error.response?.data?.error || error.message);
  }
}

// 獲取對話訊息
async function getMessages(conversationId) {
  try {
    const response = await axios.get(`${API_URL}/chat/conversations/${conversationId}/messages`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const messages = response.data.data;

    if (messages.length === 0) {
      console.log('這個對話還沒有訊息');
      return;
    }
    console.log('\n----- 訊息記錄 -----');
    messages.forEach((msg) => {
      const isMine = msg.isMine;
      const senderName = isMine ? '我' : msg.sender.name || '未知用戶';
      const senderId = msg.sender._id || '未知ID';
      const time = new Date(msg.createdAt).toLocaleTimeString();
      const date = new Date(msg.createdAt).toLocaleDateString();
      const readStatus = isMine && msg.isRead ? ' (已讀)' : '';

      console.log(`[${date} ${time}] ${senderName} (ID: ${senderId}): ${msg.content}${readStatus}`);
    });
    console.log('---------------------\n');
  } catch (error) {
    console.error('獲取訊息失敗:', error.response?.data?.error || error.message);
  }
}

// 發送訊息
async function sendMessage(content) {
  if (!activeConversation) {
    console.error('請先打開一個對話');
    return;
  }

  try {
    await axios.post(
      `${API_URL}/chat/conversations/${activeConversation._id}/messages`,
      { content },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    // 通過 Socket.IO 直接發送會更好，但這裡也可以通過 API 發送
    // socket.emit('message:send', {
    //   conversationId: activeConversation._id,
    //   content
    // });
  } catch (error) {
    console.error('發送訊息失敗:', error.response?.data?.error || error.message);
  }
}

// 標記已讀
async function markAsRead() {
  if (!activeConversation) {
    console.error('請先打開一個對話');
    return;
  }

  try {
    await axios.put(
      `${API_URL}/chat/conversations/${activeConversation._id}/read`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    console.log('已將所有訊息標記為已讀');
  } catch (error) {
    console.error('標記已讀失敗:', error.response?.data?.error || error.message);
  }
}

// 發送輸入狀態
function sendTypingStatus(isTyping) {
  if (!socket || !activeConversation) {
    console.error('請先連接到服務器並打開一個對話');
    return;
  }

  socket.emit('user:typing', {
    conversationId: activeConversation._id,
    isTyping: isTyping === 'true',
  });

  console.log(`已發送${isTyping === 'true' ? '正在輸入' : '停止輸入'}狀態`);
}

// 登出
function logout() {
  accessToken = '';
  currentUser = null;
  activeConversation = null;

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  console.log('已登出');
}

// 主程序邏輯
async function main() {
  showHelp();

  rl.setPrompt('> ');
  rl.prompt();

  rl.on('line', async (line) => {
    const args = line.trim().split(' ');
    const command = args[0].toLowerCase();

    switch (command) {
      case 'login':
        if (args.length < 3) {
          console.log('用法: login [email] [password]');
        } else {
          await login(args[1], args[2]);
        }
        break;

      case 'list':
        if (!accessToken) {
          console.log('請先登錄');
        } else {
          await listConversations();
        }
        break;

      case 'start':
        if (!accessToken) {
          console.log('請先登錄');
        } else if (args.length < 2) {
          console.log('用法: start [userId]');
        } else {
          await startConversation(args[1]);
        }
        break;

      case 'open':
        if (!accessToken) {
          console.log('請先登錄');
        } else if (args.length < 2) {
          console.log('用法: open [conversationId]');
        } else {
          await openConversation(args[1]);
        }
        break;

      case 'message':
        if (!accessToken) {
          console.log('請先登錄');
        } else if (!activeConversation) {
          console.log('請先打開一個對話');
        } else if (args.length < 2) {
          console.log('用法: message [content]');
        } else {
          const content = args.slice(1).join(' ');
          await sendMessage(content);
        }
        break;

      case 'read':
        if (!accessToken) {
          console.log('請先登錄');
        } else if (!activeConversation) {
          console.log('請先打開一個對話');
        } else {
          await markAsRead();
        }
        break;
      case 'typing':
        if (!accessToken) {
          console.log('請先登錄');
        } else if (!activeConversation) {
          console.log('請先打開一個對話');
        } else if (args.length < 2) {
          console.log('用法: typing [true/false]');
        } else {
          sendTypingStatus(args[1]);
        }
        break;

      case 'online':
        if (!accessToken) {
          console.log('請先登錄');
        } else if (!socket) {
          console.log('未連接到聊天服務器');
        } else {
          console.log('正在獲取在線用戶列表...');
          socket.emit('user:getOnline');
        }
        break;

      case 'exit':
        activeConversation = null;
        console.log('已退出當前對話');
        break;

      case 'logout':
        logout();
        break;

      case 'help':
        showHelp();
        break;

      case 'quit':
        console.log('再見！');
        rl.close();
        process.exit(0);
        break;

      default:
        console.log('未知命令。輸入 `help` 查看可用命令。');
    }

    rl.prompt();
  });
}

// 啟動程序
main().catch((error) => {
  console.error('程序錯誤:', error);
  process.exit(1);
});
