# NTUT-MADD-Final-backend

Node.js 後端 API 服務器，為 NTUT-MADD 課程的期末專案提供服務。

## 功能特點

- RESTful API 設計
- JWT 身份驗證
- 基於角色的權限控制
- MongoDB 數據庫整合
- 完整的錯誤處理
- 安全性機制 (CORS, Helmet)
- 日誌記錄
- 即時聊天功能 (含私訊及已讀回條)
- Socket.IO 整合

## 安裝

```bash
# 克隆儲存庫
git clone https://github.com/HeavenManySugar/NTUT-MADD-Final-backend.git

# 進入專案目錄
cd NTUT-MADD-Final-backend

# 安裝依賴
npm install
```

## 環境變數

在根目錄創建 `.env` 文件並配置以下環境變數：

```
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/ntut_madd_db
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRE=30d
```

## 運行

```bash
# 開發環境
npm run dev

# 生產環境
npm start
```

## API 文檔

專案整合了 Swagger UI，提供互動式 API 文檔。

### 訪問 Swagger 文檔

啟動服務器後，訪問以下網址瀏覽 API 文檔：

```
http://localhost:3000/api-docs
```

在 Swagger UI 中，您可以：

- 瀏覽所有 API 端點及其詳細說明
- 測試 API 請求並查看響應
- 查看請求和響應模型結構

### 主要 API 端點

#### 認證 API

- `POST /api/auth/register` - 註冊用戶
- `POST /api/auth/login` - 用戶登入
- `GET /api/auth/me` - 獲取當前用戶信息
- `GET /api/auth/logout` - 用戶登出

#### 任務 API

- `GET /api/tasks` - 獲取所有任務
- `GET /api/tasks/:id` - 獲取單個任務
- `POST /api/tasks` - 創建新任務
- `PUT /api/tasks/:id` - 更新任務
- `DELETE /api/tasks/:id` - 刪除任務

#### 聊天 API

- `GET /api/chat/conversations` - 獲取所有對話
- `POST /api/chat/conversations` - 建立或獲取與特定用戶的對話
- `GET /api/chat/conversations/:id` - 獲取單個對話
- `GET /api/chat/conversations/:id/messages` - 獲取對話中的所有訊息
- `POST /api/chat/conversations/:id/messages` - 在對話中發送新訊息
- `PUT /api/chat/conversations/:id/read` - 將對話中的所有訊息標記為已讀
- `DELETE /api/tasks/:id` - 刪除任務

#### 用戶檔案 API

- `GET /api/profile/me` - 獲取當前用戶資料
- `PUT /api/profile/me` - 更新當前用戶資料
- `DELETE /api/profile/me` - 刪除用戶帳號

#### 檔案上傳 API

- `POST /api/upload` - 上傳檔案
- `GET /api/upload` - 獲取所有檔案
- `GET /api/upload/:id` - 獲取單個檔案
- `DELETE /api/upload/:id` - 刪除檔案

## 即時聊天功能

本專案整合了 Socket.IO 提供即時聊天功能，包含以下特點：

### 功能特點

- **私人訊息 (DM)**: 用戶可以與其他用戶建立一對一的私人對話
- **已讀回條**: 訊息發送後，系統會追蹤哪些用戶已讀取該訊息
- **即時通訊**: 使用 Socket.IO 提供即時通訊能力
- **輸入指示器**: 當用戶正在輸入訊息時，其他參與者會收到通知
- **在線狀態**: 顯示用戶是否在線上

### Socket.IO 事件

客戶端可以監聽和發送以下事件：

#### 客戶端發送事件:

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

#### 客戶端接收事件:

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

3. **用戶狀態更新**:

   ```javascript
   socket.on('user:status', (data) => {
     console.log('用戶狀態:', data);
   });
   ```

4. **輸入狀態**:

   ```javascript
   socket.on('user:typing', (data) => {
     console.log('用戶正在輸入:', data);
   });
   ```

5. **對話更新**:
   ```javascript
   socket.on('conversation:update', (conversation) => {
     console.log('對話更新:', conversation);
   });
   ```

### 測試聊天功能

專案提供了一個簡單的命令行工具用於測試聊天功能：

```bash
# 運行測試工具
node tools/chat-test.js
```

詳細的聊天功能說明可參考：[聊天功能說明文檔](/public/chat-readme.md)

## 項目結構

```
.
├── index.js          # 應用入口
├── package.json      # 項目依賴
├── .env              # 環境變數
├── public/           # 靜態資源目錄
│   ├── uploads/      # 上傳檔案儲存目錄
│   └── chat-readme.md # 聊天功能詳細說明
├── tools/            # 工具腳本
│   └── chat-test.js  # 聊天功能測試工具
├── src/
│   ├── config/       # 配置文件
│   │   ├── index.js  # 主要配置
│   │   ├── db.js     # 數據庫配置
│   │   └── swagger.js # Swagger 文檔配置
│   ├── controllers/  # 路由控制器
│   │   ├── auth.js   # 認證控制器
│   │   ├── chat.js   # 聊天控制器
│   │   ├── profile.js # 用戶檔案控制器
│   │   ├── tasks.js  # 任務控制器
│   │   └── upload.js # 檔案上傳控制器
│   ├── middlewares/  # 中間件
│   ├── models/       # 數據模型
│   │   ├── Conversation.js # 對話模型
│   │   ├── Message.js # 訊息模型
│   │   ├── User.js   # 用戶模型
│   │   ├── Task.js   # 任務模型
│   │   └── File.js   # 檔案模型
│   ├── routes/       # 路由定義
│   │   ├── chat.js   # 聊天路由
│   │   └── ...       # 其他路由
│   ├── services/     # 業務邏輯
│   │   ├── socketService.js # Socket.IO 服務
│   │   └── ...       # 其他服務
│   └── utils/        # 工具函數
│       ├── chatUtils.js # 聊天相關工具
│       └── ...       # 其他工具
└── README.md
```

## 許可證

MIT
