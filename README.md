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

#### 用戶檔案 API

- `GET /api/profile/me` - 獲取當前用戶資料
- `PUT /api/profile/me` - 更新當前用戶資料
- `DELETE /api/profile/me` - 刪除用戶帳號

#### 檔案上傳 API

- `POST /api/upload` - 上傳檔案
- `GET /api/upload` - 獲取所有檔案
- `GET /api/upload/:id` - 獲取單個檔案
- `DELETE /api/upload/:id` - 刪除檔案

## 項目結構

```
.
├── index.js          # 應用入口
├── package.json      # 項目依賴
├── .env              # 環境變數
├── public/           # 靜態資源目錄
│   └── uploads/      # 上傳檔案儲存目錄
├── src/
│   ├── config/       # 配置文件
│   │   ├── index.js  # 主要配置
│   │   ├── db.js     # 數據庫配置
│   │   └── swagger.js # Swagger 文檔配置
│   ├── controllers/  # 路由控制器
│   ├── middlewares/  # 中間件
│   ├── models/       # 數據模型
│   ├── routes/       # 路由定義
│   ├── services/     # 業務邏輯
│   └── utils/        # 工具函數
└── README.md
```

## 許可證

MIT
