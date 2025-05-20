const dotenv = require('dotenv');

// Load env vars
dotenv.config();

module.exports = {
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'development',
  mongoURI: process.env.MONGODB_URI,
  redisURL: process.env.REDIS_URL, // Redis 連接 URL
  jwtSecret: process.env.JWT_SECRET,
  jwtExpire: process.env.JWT_EXPIRE || '30d',
  logLevel: process.env.LOG_LEVEL || 'debug',
};
