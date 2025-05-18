const express = require('express');
const { register, login, getMe, logout, searchUserByEmail } = require('../controllers/auth');

const router = express.Router();

// Import middleware
const { protect } = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: 認證
 *   description: 用戶認證與授權 API
 */

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: 註冊新用戶
 *     tags: [認證]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *             properties:
 *               name:
 *                 type: string
 *                 description: 用戶名稱
 *               email:
 *                 type: string
 *                 format: email
 *                 description: 用戶電子郵件
 *               password:
 *                 type: string
 *                 format: password
 *                 description: 用戶密碼
 *               role:
 *                 type: string
 *                 description: 用戶角色 (可選)
 *                 default: user
 *                 enum: [user, admin]
 *     responses:
 *       201:
 *         description: 註冊成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       400:
 *         description: 無效的請求數據
 *       409:
 *         description: 用戶已存在
 */
router.post('/register', register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: 用戶登入
 *     tags: [認證]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: 用戶電子郵件
 *               password:
 *                 type: string
 *                 format: password
 *                 description: 用戶密碼
 *     responses:
 *       200:
 *         description: 登入成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 token:
 *                   type: string
 *                   example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       401:
 *         description: 無效的認證資訊
 */
router.post('/login', login);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: 獲取當前登入用戶資訊
 *     tags: [認證]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: 未授權
 */
router.get('/me', protect, getMe);

/**
 * @swagger
 * /auth/search:
 *   get:
 *     summary: 通過電子郵件搜索用戶
 *     tags: [認證]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: email
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *         description: 要搜索的用戶電子郵件
 *     responses:
 *       200:
 *         description: 成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       404:
 *         description: 找不到用戶
 *       401:
 *         description: 未授權
 */
router.get('/search', protect, searchUserByEmail);

module.exports = router;
