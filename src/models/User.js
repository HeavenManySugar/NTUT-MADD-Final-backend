const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - name
 *         - email
 *         - password
 *       properties:
 *         _id:
 *           type: string
 *           description: 用戶自動生成的ID
 *         name:
 *           type: string
 *           description: 用戶名稱
 *         email:
 *           type: string
 *           description: 用戶電子郵件
 *           format: email
 *         password:
 *           type: string
 *           description: 用戶密碼 (經過加密)
 *         role:
 *           type: string
 *           description: 用戶角色
 *           enum: [user, admin]
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 帳號創建時間
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: 帳號更新時間
 *       example:
 *         _id: 60d0fe4f5311236168a109ca
 *         name: 張三
 *         email: test@example.com
 *         role: user
 *         createdAt: 2023-01-01T00:00:00.000Z
 *         updatedAt: 2023-01-01T00:00:00.000Z
 */

const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a name'],
      trim: true,
      maxlength: [50, 'Name cannot be more than 50 characters'],
      index: true, // 添加索引以加快按名稱查詢
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please add a valid email'],
      index: true, // 添加索引以加快登入查詢
    },
    password: {
      type: String,
      required: [true, 'Please add a password'],
      minlength: 6,
      select: false, // Don't return password in queries
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
      index: true, // 添加索引以加快按角色篩選用戶
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Encrypt password using bcrypt
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  // 使用較低的 salt 輪數來提高性能
  // 在生產環境中，這個值應該根據安全需求進行平衡
  const saltRounds = process.env.NODE_ENV === 'production' ? 10 : 8;
  const salt = await bcrypt.genSalt(saltRounds);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Sign JWT and return
UserSchema.methods.getSignedJwtToken = function () {
  return jwt.sign({ id: this._id }, config.jwtSecret, {
    expiresIn: config.jwtExpire,
    algorithm: 'HS256', // 使用高性能演算法
  });
};

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function (enteredPassword) {
  try {
    // 使用非同步比較，避免阻塞，並添加錯誤處理
    return await bcrypt.compare(enteredPassword, this.password);
  } catch (error) {
    console.error('Password comparison error:', error);
    return false;
  }
};

// 添加複合索引以加快驗證過程
UserSchema.index({ email: 1, password: 1 });
// 添加名稱索引以加快搜尋
UserSchema.index({ name: 'text' });
// 添加复合索引以加快用戶角色篩選和查詢
UserSchema.index({ email: 1, role: 1 });

module.exports = mongoose.model('User', UserSchema);
