const express = require('express');
const {getTasks, getTask, createTask, updateTask, deleteTask} =
    require('../controllers/tasks');

const router = express.Router();

// Import middleware
const {protect} = require('../middlewares/auth');

/**
 * @swagger
 * tags:
 *   name: 任務
 *   description: 任務管理 API
 */

// Apply protect middleware to all routes
router.use(protect);

// Routes

/**
 * @swagger
 * /tasks:
 *   get:
 *     summary: 獲取所有任務
 *     tags: [任務]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, in-progress, completed]
 *         description: 按狀態篩選任務
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high]
 *         description: 按優先級篩選任務
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *         description: 排序字段，例如：createdAt,-priority (負號表示降序)
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: 頁碼
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 25
 *         description: 每頁顯示數量
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
 *                   example: 10
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     next:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                     prev:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Task'
 *   post:
 *     summary: 創建新任務
 *     tags: [任務]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - description
 *             properties:
 *               title:
 *                 type: string
 *                 description: 任務標題
 *               description:
 *                 type: string
 *                 description: 任務詳細描述
 *               status:
 *                 type: string
 *                 enum: [pending, in-progress, completed]
 *                 default: pending
 *                 description: 任務狀態
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 default: medium
 *                 description: 任務優先級
 *               dueDate:
 *                 type: string
 *                 format: date
 *                 description: 任務截止日期
 *     responses:
 *       201:
 *         description: 任務創建成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Task'
 */
router.route('/').get(getTasks).post(createTask);

/**
 * @swagger
 * /tasks/{id}:
 *   get:
 *     summary: 獲取單個任務
 *     tags: [任務]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 任務 ID
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
 *                   $ref: '#/components/schemas/Task'
 *       404:
 *         description: 任務未找到
 *   put:
 *     summary: 更新任務
 *     tags: [任務]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 任務 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 description: 任務標題
 *               description:
 *                 type: string
 *                 description: 任務詳細描述
 *               status:
 *                 type: string
 *                 enum: [pending, in-progress, completed]
 *                 description: 任務狀態
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *                 description: 任務優先級
 *               dueDate:
 *                 type: string
 *                 format: date
 *                 description: 任務截止日期
 *     responses:
 *       200:
 *         description: 任務更新成功
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Task'
 *       404:
 *         description: 任務未找到
 *       401:
 *         description: 未授權
 *   delete:
 *     summary: 刪除任務
 *     tags: [任務]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 任務 ID
 *     responses:
 *       200:
 *         description: 任務刪除成功
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
 *         description: 任務未找到
 *       401:
 *         description: 未授權
 */
router.route('/:id').get(getTask).put(updateTask).delete(deleteTask);

module.exports = router;
