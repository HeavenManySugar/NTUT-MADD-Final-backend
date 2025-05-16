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
        maxlength: [50, 'Name cannot be more than 50 characters']
      },
      email: {
        type: String,
        required: [true, 'Please add an email'],
        unique: true,
        match: [
          /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
          'Please add a valid email'
        ]
      },
      password: {
        type: String,
        required: [true, 'Please add a password'],
        minlength: 6,
        select: false  // Don't return password in queries
      },
      role: {type: String, enum: ['user', 'admin'], default: 'user'},
      resetPasswordToken: String,
      resetPasswordExpire: Date
    },
    {timestamps: true, toJSON: {virtuals: true}, toObject: {virtuals: true}});

// Encrypt password using bcrypt
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Sign JWT and return
UserSchema.methods.getSignedJwtToken = function() {
  return jwt.sign(
      {id: this._id}, config.jwtSecret, {expiresIn: config.jwtExpire});
};

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
