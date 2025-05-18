# 聊天功能說明

本專案已整合聊天室功能，提供以下特點：

## 功能特點

1. **私人訊息 (DM)**: 使用者可以與其他使用者建立一對一的私人對話。
2. **已讀回條**: 訊息發送後，系統會追蹤哪些使用者已讀取該訊息。
3. **即時通訊**: 使用 Socket.IO 提供即時通訊能力。
4. **輸入指示器**: 當使用者正在輸入訊息時，其他參與者會收到通知。
5. **在線狀態**: 顯示使用者是否在線上。

## API 端點

所有聊天相關 API 都在 `/api/chat` 路徑下：

- `GET /api/chat/conversations`: 取得當前用戶的所有對話
- `POST /api/chat/conversations`: 建立或獲取與特定用戶的對話
- `GET /api/chat/conversations/:id`: 取得特定對話的詳細資訊
- `GET /api/chat/conversations/:id/messages`: 取得對話中的所有訊息
- `POST /api/chat/conversations/:id/messages`: 在對話中發送新訊息
- `PUT /api/chat/conversations/:id/read`: 將對話中的所有訊息標記為已讀

## Socket.IO 事件

### 客戶端發送事件:

1. **連接**: 使用 JWT 驗證連接到 Socket.IO 伺服器

   ```javascript
   socket.connect({ auth: { token: 'JWT_TOKEN' } });
   ```

2. **發送訊息**:

   ```javascript
   socket.emit('message:send', { conversationId: 'ID', content: '訊息內容' });
   ```

3. **標記為已讀**:

   ```javascript
   socket.emit('message:read', { conversationId: 'ID' });
   ```

4. **輸入指示器**:
   ```javascript
   socket.emit('user:typing', { conversationId: 'ID', isTyping: true });
   ```

### 客戶端接收事件:

1. **新訊息**:

   ```javascript
   socket.on('message:new', (message) => {
     console.log('新訊息:', message);
   });
   ```

2. **訊息已讀**:

   ```javascript
   socket.on('message:read', (data) => {
     console.log('已讀訊息:', data);
   });
   ```

3. **使用者狀態更新**:

   ```javascript
   socket.on('user:status', (data) => {
     console.log('使用者狀態:', data);
   });
   ```

4. **輸入狀態**:

   ```javascript
   socket.on('user:typing', (data) => {
     console.log('使用者正在輸入:', data);
   });
   ```

5. **對話更新**:
   ```javascript
   socket.on('conversation:update', (conversation) => {
     console.log('對話更新:', conversation);
   });
   ```

## 前端集成步驟

1. 安裝 Socket.IO 客戶端:

   ```bash
   npm install socket.io-client
   ```

2. 連接到 Socket.IO 伺服器:

   ```javascript
   import { io } from 'socket.io-client';

   // 初始化連接
   const socket = io('http://localhost:5000', {
     auth: {
       token: 'JWT_TOKEN', // 使用者的 JWT
     },
   });

   // 監聽連接事件
   socket.on('connect', () => {
     console.log('已連接到聊天伺服器');
   });

   socket.on('error', (error) => {
     console.error('聊天連接錯誤:', error);
   });
   ```

3. 實現訊息收發、已讀回條和其他功能，可參考上述 Socket.IO 事件。
