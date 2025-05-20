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
      index: 'text', // 添加文本索引以支持標題搜索
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
      index: true, // 添加索引以加快按狀態篩選
    },
    priority: {
      type: String,
      required: true,
      enum: ['low', 'medium', 'high'],
      default: 'medium',
      index: true, // 添加索引以加快按優先級篩選
    },
    dueDate: {
      type: Date,
      index: true, // 添加索引以加快按截止日期排序和篩選
    },
    user: {
      type: mongoose.Schema.ObjectId,
      ref: 'User',
      required: true,
      index: true, // 添加索引以加快按用戶查詢任務
    },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

// 添加複合索引以加快多條件查詢
TaskSchema.index({ user: 1, status: 1, priority: 1 });
TaskSchema.index({ user: 1, dueDate: 1 });

module.exports = mongoose.model('Task', TaskSchema);
