/**
 * JWT Optimization Utilities
 * Provides optimized JWT token generation and verification
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../config');
const { getCache, setCache } = require('./cacheUtils');

// Token signature options
const JWT_ALGORITHM = 'HS256'; // Fastest algorithm for JWT
const JWT_AUDIENCE = 'ntut-madd-api-users';
const JWT_ISSUER = 'ntut-madd-api';

// Cache settings
const JWT_VERIFICATION_CACHE_TTL = 1800; // 30 minutes

/**
 * Generate a high-performance JWT token
 * @param {Object} payload - Token payload
 * @param {string} secret - Secret key for signing
 * @param {Object} options - JWT options
 * @returns {string} - JWT token
 */
const generateOptimizedToken = (payload, secret = config.jwtSecret, options = {}) => {
  // Create a token ID for revocation capability
  const jti = crypto.randomBytes(12).toString('hex');

  // Use meaningful default options for better security
  const tokenOptions = {
    expiresIn: options.expiresIn || config.jwtExpire,
    algorithm: JWT_ALGORITHM,
    jwtid: jti,
    audience: JWT_AUDIENCE,
    issuer: JWT_ISSUER,
    ...options,
  };

  // Generate token
  return jwt.sign(payload, secret, tokenOptions);
};

/**
 * Verify JWT token with caching for improved performance
 * @param {string} token - JWT token to verify
 * @param {string} secret - Secret key for verification
 * @returns {Promise<Object|null>} - Decoded token or null if invalid
 */
const verifyTokenWithCache = async (token, secret = config.jwtSecret) => {
  try {
    // Check if token has been verified before
    const cacheKey = `auth:verify:${token}`;
    const cachedResult = await getCache(cacheKey);

    if (cachedResult) {
      return cachedResult;
    }

    // Perform verification
    const decoded = jwt.verify(token, secret, {
      algorithms: [JWT_ALGORITHM],
      audience: JWT_AUDIENCE,
      issuer: JWT_ISSUER,
    });

    // Cache the result
    await setCache(cacheKey, decoded, JWT_VERIFICATION_CACHE_TTL);

    return decoded;
  } catch (error) {
    console.error('Token verification error:', error.message);
    return null;
  }
};

/**
 * Check if a token is blacklisted
 * @param {string} token - JWT token to check
 * @returns {Promise<boolean>} - True if blacklisted
 */
const isTokenBlacklisted = async (token) => {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.jti) return false;

    const blacklistKey = `auth:blacklist:${decoded.jti}`;
    const isBlacklisted = await getCache(blacklistKey);

    return !!isBlacklisted;
  } catch (error) {
    console.error('Token blacklist check error:', error);
    return false;
  }
};

/**
 * Blacklist a token
 * @param {string} token - JWT token to blacklist
 * @returns {Promise<boolean>} - Success indicator
 */
const blacklistToken = async (token) => {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.jti) return false;

    // Calculate remaining TTL
    const now = Math.floor(Date.now() / 1000);
    const exp = decoded.exp || now + 24 * 60 * 60; // Default 24h
    const ttl = Math.max(0, exp - now);

    // Add to blacklist
    const blacklistKey = `auth:blacklist:${decoded.jti}`;
    await setCache(blacklistKey, true, ttl);

    // Also invalidate verification cache
    const cacheKey = `auth:verify:${token}`;
    await getCache(cacheKey);

    return true;
  } catch (error) {
    console.error('Token blacklist error:', error);
    return false;
  }
};

module.exports = {
  generateOptimizedToken,
  verifyTokenWithCache,
  isTokenBlacklisted,
  blacklistToken,
};
