const express = require('express');
const router = express.Router();

// Import controller methods
const {uploadFile, getFile, getAllFiles, deleteFile} =
    require('../controllers/upload');

const {protect, optionalAuth} = require('../middlewares/auth');
const {uploadSingle} = require('../middlewares/upload');

/**
 * @swagger
 * tags:
 *   name: 檔案上傳
 *   description: 檔案上傳與管理 API
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     File:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: 檔案自動生成的ID
 *         name:
 *           type: string
 *           description: 檔案名稱
 *         originalName:
 *           type: string
 *           description: 檔案原始名稱
 *         fileType:
 *           type: string
 *           description: 檔案MIME類型
 *         fileSize:
 *           type: number
 *           description: 檔案大小 (位元組)
 *         filePath:
 *           type: string
 *           description: 檔案存儲路徑
 *         user:
 *           type: string
 *           description: 上傳檔案的用戶ID
 *         isPublic:
 *           type: boolean
 *           description: 檔案是否公開
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 上傳日期
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: 更新日期
 *       example:
 *         _id: 60d0fe4f5311236168a109cd
 *         name: 專案報告.pdf
 *         originalName: project-report.pdf
 *         fileType: application/pdf
 *         fileSize: 1048576
 *         filePath: public/uploads/1623456789-project-report.pdf
 *         user: 60d0fe4f5311236168a109ca
 *         isPublic: false
 *         createdAt: 2023-01-01T00:00:00.000Z
 *         updatedAt: 2023-01-01T00:00:00.000Z
 */

// No longer protecting all routes by default

// Upload routes
/**
 * @swagger
 * /upload:
 *   post:
 *     summary: 上傳檔案
 *     tags: [檔案上傳]
 *     security:
 *       - bearerAuth: []
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: 要上傳的檔案
 *               name:
 *                 type: string
 *                 description: 檔案顯示名稱 (可選)
 *               isPublic:
 *                 type: string
 *                 enum: ['true', 'false']
 *                 default: 'false'
 *                 description: 檔案是否公開
 *     responses:
 *       201:
 *         description: 檔案上傳成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/File'
 *       400:
 *         description: 檔案上傳失敗
 *       401:
 *         description: 未授權
 */
router.post('/', protect, uploadSingle('file'), uploadFile);

/**
 * @swagger
 * /upload:
 *   get:
 *     summary: 獲取當前用戶的所有檔案
 *     tags: [檔案上傳]
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
 *                 count:
 *                   type: integer
 *                   example: 5
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/File'
 *       401:
 *         description: 未授權
 */
router.get('/', protect, getAllFiles);

/**
 * @swagger
 * /upload/{id}:
 *   get:
 *     summary: 獲取單個檔案
 *     description:
 * 公開檔案無需登入即可訪問，私有檔案需要登入並且只有檔案擁有者可以訪問 tags:
 * [檔案上傳] security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 檔案 ID
 *     responses:
 *       200:
 *         description: 檔案內容 (由內容類型決定)
 *       404:
 *         description: 檔案未找到
 *       401:
 *         description: 未授權或私有檔案需要身份驗證
 */
router.get('/:id', optionalAuth, getFile);

/**
 * @swagger
 * /upload/{id}:
 *   delete:
 *     summary: 刪除檔案
 *     tags: [檔案上傳]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 檔案 ID
 *     responses:
 *       200:
 *         description: 檔案刪除成功
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
 *       404:
 *         description: 檔案未找到
 *       401:
 *         description: 未授權
 */
router.delete('/:id', protect, deleteFile);

module.exports = router;
