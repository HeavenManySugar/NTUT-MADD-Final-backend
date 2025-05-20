const mongoose = require('mongoose');

/**
 * @swagger
 * components:
 *   schemas:
 *     Conversation:
 *       type: object
 *       required:
 *         - participants
 *       properties:
 *         _id:
 *           type: string
 *           description: 對話自動生成的ID
 *         participants:
 *           type: array
 *           description: 參與對話的用戶ID列表
 *           items:
 *             type: string
 *         lastMessage:
 *           type: string
 *           description: 最後一條訊息的ID
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 對話創建時間
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: 對話更新時間
 */

const ConversationSchema = new mongoose.Schema(
  {
    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
      },
    ],
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      index: true, // 添加索引以加快最新消息查詢
    },
  },
  {
    timestamps: true,
    // 添加未讀消息計數器作為虛擬字段
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Create a unique compound index on participants to prevent duplicate conversations
ConversationSchema.index({ participants: 1 }, { unique: true });

// 添加按更新時間排序的索引，以便快速獲取最近的對話
ConversationSchema.index({ updatedAt: -1 });

module.exports = mongoose.model('Conversation', ConversationSchema);
