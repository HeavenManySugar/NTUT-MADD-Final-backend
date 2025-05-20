const jwt = require('jsonwebtoken');
const ErrorResponse = require('../utils/errorResponse');
const User = require('../models/User');
const config = require('../config');
const { getCache, setCache } = require('../utils/cacheUtils');
const { verifyTokenWithCache, isTokenBlacklisted } = require('../utils/jwtUtils');
const { getOptimalTTL, recordCacheHit, recordCacheMiss } = require('../utils/adaptiveCache');

// Protect routes
exports.protect = async (req, res, next) => {
  let token;

  try {
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      // Set token from Bearer token in header
      token = req.headers.authorization.split(' ')[1];
    }
    // else if (req.cookies.token) {
    //   token = req.cookies.token;
    // }

    // Make sure token exists
    if (!token) {
      return next(new ErrorResponse('Not authorized to access this route', 401));
    }

    // Check if token is blacklisted
    if (await isTokenBlacklisted(token)) {
      return next(new ErrorResponse('Invalid or expired token', 401));
    }

    // Use optimized token verification with caching
    const decoded = await verifyTokenWithCache(token);

    if (!decoded) {
      return next(new ErrorResponse('Invalid or expired token', 401));
    }

    // 使用單一的用戶緩存鍵來獲取用戶資料
    const userCacheKey = `user:${decoded.id}:profile`;

    // Get optimal TTL for user profile
    const cacheTTL = await getOptimalTTL('user:profile', userCacheKey);

    // Try to get user from cache
    let user = await getCache(userCacheKey);

    if (user) {
      // Record cache hit for analytics
      recordCacheHit(userCacheKey);
    } else {
      // Record cache miss
      recordCacheMiss(userCacheKey);

      // 如果緩存中沒有用戶資料，從數據庫高效獲取
      user = await User.findById(decoded.id).select('_id name email role').lean();

      if (user) {
        // Store in cache with adaptive TTL
        await setCache(userCacheKey, user, cacheTTL);
      }
    }

    if (!user) {
      return next(new ErrorResponse('User not found', 401));
    }

    // 將用戶數據附加到請求對象
    req.user = user;
    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return next(new ErrorResponse('Authentication failed', 401));
  }
};

// Optional authentication - won't block if no token, but will set user if token
// exists
exports.optionalAuth = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    // Set token from Bearer token in header
    token = req.headers.authorization.split(' ')[1];
  }

  // If no token, just continue without setting user
  if (!token) {
    return next();
  }

  try {
    // Check if token is blacklisted
    if (await isTokenBlacklisted(token)) {
      return next();
    }

    // Use optimized token verification
    const decoded = await verifyTokenWithCache(token);

    if (!decoded) {
      return next();
    }

    // Get user from cache with adaptive TTL
    const userCacheKey = `user:${decoded.id}:profile`;
    const cacheTTL = await getOptimalTTL('user:profile', userCacheKey);

    let user = await getCache(userCacheKey);

    if (user) {
      recordCacheHit(userCacheKey);
    } else {
      recordCacheMiss(userCacheKey);

      // Get from database if not in cache
      user = await User.findById(decoded.id).select('_id name email role').lean();

      if (user) {
        await setCache(userCacheKey, user, cacheTTL);
      }
    }

    if (user) {
      req.user = user;
    }

    next();
  } catch (err) {
    // Don't return an error, just continue without setting user
    next();
  }
};

// Grant access to specific roles
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ErrorResponse('Not authorized to access this route', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new ErrorResponse(`User role ${req.user.role} is not authorized to access this route`, 403)
      );
    }
    next();
  };
};
