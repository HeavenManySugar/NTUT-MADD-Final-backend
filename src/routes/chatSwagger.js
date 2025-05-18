/**
 * @swagger
 * tags:
 *   name: Chat
 *   description: 聊天功能 API
 */

/**
 * @swagger
 * /chat/conversations:
 *   get:
 *     summary: 取得所有對話
 *     description: 取得當前登入用戶的所有對話清單
 *     tags: [Chat]
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
 *                   type: number
 *                   example: 2
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Conversation'
 *       401:
 *         description: 未授權
 *       500:
 *         description: 伺服器錯誤
 *
 *   post:
 *     summary: 建立新對話
 *     description: 與另一位用戶建立新的對話
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: 對話另一方用戶的 ID
 *     responses:
 *       201:
 *         description: 成功建立對話
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Conversation'
 *       400:
 *         description: 無效的請求
 *       401:
 *         description: 未授權
 *       404:
 *         description: 用戶不存在
 *       500:
 *         description: 伺服器錯誤
 */

/**
 * @swagger
 * /chat/conversations/{id}:
 *   get:
 *     summary: 取得單一對話
 *     description: 根據 ID 取得對話資訊
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: 對話 ID
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
 *                   $ref: '#/components/schemas/Conversation'
 *       401:
 *         description: 未授權
 *       403:
 *         description: 禁止訪問
 *       404:
 *         description: 對話不存在
 *       500:
 *         description: 伺服器錯誤
 */

/**
 * @swagger
 * /chat/conversations/{id}/messages:
 *   get:
 *     summary: 取得對話中的訊息
 *     description: 取得特定對話中的所有訊息並標記為已讀
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: 對話 ID
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
 *                   type: number
 *                   example: 5
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Message'
 *       401:
 *         description: 未授權
 *       403:
 *         description: 禁止訪問
 *       404:
 *         description: 對話不存在
 *       500:
 *         description: 伺服器錯誤
 *
 *   post:
 *     summary: 發送訊息
 *     description: 在特定對話中發送新訊息
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: 對話 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: 訊息內容
 *     responses:
 *       201:
 *         description: 成功發送訊息
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Message'
 *       400:
 *         description: 無效的請求
 *       401:
 *         description: 未授權
 *       403:
 *         description: 禁止訪問
 *       404:
 *         description: 對話不存在
 *       500:
 *         description: 伺服器錯誤
 */

/**
 * @swagger
 * /chat/conversations/{id}/read:
 *   put:
 *     summary: 標記訊息為已讀
 *     description: 將對話中的所有訊息標記為已讀
 *     tags: [Chat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         schema:
 *           type: string
 *         required: true
 *         description: 對話 ID
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
 *                   type: number
 *                   example: 3
 *                 message:
 *                   type: string
 *                   example: '訊息已標記為已讀'
 *       401:
 *         description: 未授權
 *       403:
 *         description: 禁止訪問
 *       404:
 *         description: 對話不存在
 *       500:
 *         description: 伺服器錯誤
 */
