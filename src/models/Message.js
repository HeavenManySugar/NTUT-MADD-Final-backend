const mongoose = require('mongoose');

/**
 * @swagger
 * components:
 *   schemas:
 *     Message:
 *       type: object
 *       required:
 *         - sender
 *         - content
 *         - conversation
 *       properties:
 *         _id:
 *           type: string
 *           description: 訊息自動生成的ID
 *         sender:
 *           type: string
 *           description: 發送者ID
 *         content:
 *           type: string
 *           description: 訊息內容
 *         conversation:
 *           type: string
 *           description: 對話ID
 *         readBy:
 *           type: array
 *           description: 已讀用戶列表
 *           items:
 *             type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 訊息創建時間
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: 訊息更新時間
 */

const MessageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Message', MessageSchema);
