/**
 * Rate Limiter Middleware
 * Provides protection against brute force attacks and limits excessive requests
 */

const rateLimit = require('express-rate-limit');
const { getCache, setCache } = require('../utils/cacheUtils');
const config = require('../config');

// Basic rate limiter configuration
const createLimiter = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100, // Limit each IP to 100 requests per windowMs
    message = 'Too many requests from this IP, please try again later',
    keyGenerator = (req) => req.ip, // Default key is IP
    skip = () => false, // Don't skip by default
    statusCode = 429, // Too Many Requests
    standardHeaders = true, // Send standard headers
    legacyHeaders = false, // Don't send legacy headers
  } = options;

  return rateLimit({
    windowMs,
    max,
    message,
    keyGenerator,
    skip,
    standardHeaders,
    legacyHeaders,
    statusCode,
  });
};

// Auth endpoints limiter - more strict
const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit to 30 auth requests per 15 minutes
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later',
  },
});

// Login endpoint limiter - most strict
const loginLimiter = createLimiter({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 10, // Limit to 10 login attempts per 5 minutes
  message: {
    success: false,
    error: 'Too many login attempts, please try again after 5 minutes',
  },
});

// API limiter - general rate limiting for all API requests
const apiLimiter = createLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 1000, // 1000 requests per hour
  message: {
    success: false,
    error: 'Request limit exceeded, please try again later',
  },
});

// Advanced limiter with Redis store for distributed setups
const createRedisLimiter = async (options = {}) => {
  if (!config.redisURL) {
    // Fall back to memory store if Redis is not available
    return createLimiter(options);
  }

  // Use Redis if available - not implementing fully here as it requires additional setup
  return createLimiter(options);
};

module.exports = {
  authLimiter,
  loginLimiter,
  apiLimiter,
  createLimiter,
  createRedisLimiter,
};
