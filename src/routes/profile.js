const express = require('express');
const {getProfile, updateProfile, deleteAccount} =
    require('../controllers/profile');

const router = express.Router();

// Import middleware
const {protect} = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: 用戶檔案
 *   description: 用戶個人資料管理 API
 */

// Apply protect middleware to all routes
router.use(protect);

// Routes
/**
 * @swagger
 * /profile/me:
 *   get:
 *     summary: 獲取當前用戶個人資料
 *     tags: [用戶檔案]
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
router.get('/me', getProfile);

/**
 * @swagger
 * /profile/me:
 *   put:
 *     summary: 更新當前用戶個人資料
 *     tags: [用戶檔案]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: 用戶名稱
 *               email:
 *                 type: string
 *                 format: email
 *                 description: 用戶電子郵件
 *     responses:
 *       200:
 *         description: 個人資料更新成功
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
 *       400:
 *         description: 無效的請求數據
 *       401:
 *         description: 未授權
 */
router.put('/me', updateProfile);

/**
 * @swagger
 * /profile/me:
 *   delete:
 *     summary: 刪除當前用戶帳戶
 *     tags: [用戶檔案]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 帳戶刪除成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   example: {}
 *       401:
 *         description: 未授權
 */
router.delete('/me', deleteAccount);

module.exports = router;
