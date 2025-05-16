const mongoose = require('mongoose');

/**
 * @swagger
 * components:
 *   schemas:
 *     Task:
 *       type: object
 *       required:
 *         - title
 *         - description
 *         - user
 *       properties:
 *         _id:
 *           type: string
 *           description: 任務自動生成的ID
 *         title:
 *           type: string
 *           description: 任務標題
 *         description:
 *           type: string
 *           description: 任務詳細描述
 *         status:
 *           type: string
 *           description: 任務狀態
 *           enum: [pending, in-progress, completed]
 *           default: pending
 *         priority:
 *           type: string
 *           description: 任務優先級
 *           enum: [low, medium, high]
 *           default: medium
 *         dueDate:
 *           type: string
 *           format: date
 *           description: 任務截止日期
 *         user:
 *           type: string
 *           description: 負責此任務的用戶ID
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: 任務創建時間
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: 任務更新時間
 *       example:
 *         _id: 60d0fe4f5311236168a109cb
 *         title: 完成專案報告
 *         description: 撰寫期末專案報告，包括需求分析、系統設計和實現細節
 *         status: pending
 *         priority: high
 *         dueDate: 2023-05-20T00:00:00.000Z
 *         user: 60d0fe4f5311236168a109ca
 *         createdAt: 2023-01-01T00:00:00.000Z
 *         updatedAt: 2023-01-01T00:00:00.000Z
 */

const TaskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please add a title'],
      trim: true,
      maxlength: [100, 'Title cannot be more than 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Please add a description'],
      maxlength: [500, 'Description cannot be more than 500 characters'],
    },
    status: {
      type: String,
      required: true,
      enum: ['pending', 'in-progress', 'completed'],
      default: 'pending',
    },
    priority: {
      type: String,
      required: true,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
    },
    dueDate: { type: Date },
    user: { type: mongoose.Schema.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

module.exports = mongoose.model('Task', TaskSchema);
