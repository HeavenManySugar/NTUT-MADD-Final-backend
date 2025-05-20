const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { withCache, deleteCache, setCache, getCache } = require('../utils/cacheUtils');
const { findOne } = require('../utils/dbUtils');
const { applyNoStore } = require('../middlewares/cacheHeaders');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = asyncHandler(async (req, res, next) => {
  const { name, email, password, role } = req.body;

  // Create user
  const user = await User.create({ name, email, password, role });

  sendTokenResponse(user, 201, res);
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // Validate email and password
  if (!email || !password) {
    return next(new ErrorResponse('Please provide an email and password', 400));
  }

  // 快取鍵使用郵箱和密碼的哈希組合，避免直接使用明文密碼
  const passwordHash = require('crypto')
    .createHash('sha256')
    .update(password)
    .digest('hex')
    .substring(0, 10);
  const loginCacheKey = `auth:login:${email}:${passwordHash}`;

  try {
    // Import JWT utilities
    const { generateOptimizedToken } = require('../utils/jwtUtils');
    const {
      getOptimalTTL,
      recordCacheHit,
      recordCacheMiss,
      recordCacheSet,
    } = require('../utils/adaptiveCache');

    // 首先檢查登入快取
    const cachedLoginResult = await getCache(loginCacheKey);

    if (cachedLoginResult) {
      // Record cache hit for analytics
      recordCacheHit(loginCacheKey);

      // 命中快取，直接返回快取結果，不需要查詢數據庫
      // Set cache headers for sensitive data
      applyNoStore(req, res);
      return res.status(200).json(cachedLoginResult);
    }

    // Record cache miss
    recordCacheMiss(loginCacheKey);

    // 使用 index 加速查詢，只獲取必要字段
    // 使用 dbUtils 中的 findOne 函數代替 Mongoose 直接查詢
    const user = await findOne(
      User,
      { email },
      {
        select: '+password name email role createdAt updatedAt',
        lean: true,
      }
    );

    if (!user) {
      return next(new ErrorResponse('Invalid credentials', 401));
    }

    // 使用非同步的 bcrypt 比較，避免阻塞主線程
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return next(new ErrorResponse('Invalid credentials', 401));
    }

    // 使用優化的 JWT token 生成函數
    const token = generateOptimizedToken({ id: user._id }, config.jwtSecret);

    // 創建不包含密碼的用戶數據
    const userData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    // 構建完整的響應對象
    const responseData = {
      success: true,
      token,
      data: userData,
    };

    // 獲取自適應的緩存過期時間
    const loginTTL = await getOptimalTTL('auth:login', loginCacheKey);
    const userTTL = await getOptimalTTL('user:profile', `user:${user._id}:profile`);
    const tokenTTL = await getOptimalTTL('auth:token', `auth:verify:${token}`);

    // 使用 Promise.all 並行設置多個緩存，提高性能
    await Promise.all([
      // 1. 用戶資料 - 使用自適應 TTL
      setCache(`user:${user._id}:profile`, userData, userTTL),

      // 2. 登入結果 - 使用自適應 TTL
      setCache(loginCacheKey, responseData, loginTTL),

      // 3. Token 驗證快取 - 使用自適應 TTL
      setCache(`auth:verify:${token}`, { id: user._id }, tokenTTL),
    ]);

    // Record cache sets
    recordCacheSet(loginCacheKey);
    recordCacheSet(`user:${user._id}:profile`);
    recordCacheSet(`auth:verify:${token}`);

    // 直接返回響應
    // Set cache headers for sensitive data
    applyNoStore(req, res);
    return res.status(200).json(responseData);
  } catch (err) {
    console.error('Login error:', err);
    return next(new ErrorResponse('Login failed', 500));
  }
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res, next) => {
  // Import adaptive cache utilities
  const { getOptimalTTL, recordCacheHit, recordCacheMiss } = require('../utils/adaptiveCache');

  // 使用 Redis 緩存用戶數據
  const cacheKey = `user:${req.user.id}:profile`;

  // Get optimal TTL for user profile cache
  const cacheTTL = await getOptimalTTL('user:profile', cacheKey);

  const userData = await withCache(
    cacheKey,
    async () => {
      // Record cache miss
      recordCacheMiss(cacheKey);

      // 使用 lean() 提高查詢性能，並只投影必要字段
      return await User.findById(req.user.id, 'name email role createdAt updatedAt').lean();
    },
    cacheTTL // 使用自適應緩存時間
  );

  // Record cache hit if we didn't just miss
  if (userData) {
    recordCacheHit(cacheKey);
  }

  // Add no-cache headers for authenticated data
  applyNoStore(req, res);
  res.status(200).json({ success: true, data: userData });
});

// @desc    搜索用戶通過電子郵件
// @route   GET /api/auth/search
// @access  Private
exports.searchUserByEmail = asyncHandler(async (req, res, next) => {
  const { email } = req.query;

  if (!email) {
    return next(new ErrorResponse('請提供電子郵件進行搜索', 400));
  }

  // 查找用戶但不返回密碼，使用正則表達式使搜索更有彈性
  // 使用 lean() 提高查詢性能，並只投影必要字段
  const user = await User.findOne(
    { email: new RegExp(email, 'i') },
    'name email role createdAt'
  ).lean();

  if (!user) {
    return next(new ErrorResponse('找不到用戶', 404));
  }

  res.status(200).json({ success: true, data: user });
});

// Get token from model, create and send response
const sendTokenResponse = (user, statusCode, res) => {
  // 直接生成 JWT Token，避免調用 mongoose 方法以提高性能
  const token = jwt.sign({ id: user._id }, config.jwtSecret, {
    expiresIn: config.jwtExpire,
  });

  // 將 token 存入 Redis 緩存以加快後續驗證
  const tokenCacheKey = `auth:token:${user._id}`;
  setCache(tokenCacheKey, { token, userId: user._id }, parseInt(config.jwtExpire) || 24 * 60 * 60); // 預設 24 小時

  // Create a user object without the password
  const userData = {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  // 同時緩存用戶基本信息，避免後續重複查詢
  const userCacheKey = `user:${user._id}:profile`;
  setCache(userCacheKey, userData, 1800); // 30分鐘緩存

  res.status(statusCode).json({
    success: true,
    token,
    data: userData,
  });
};
