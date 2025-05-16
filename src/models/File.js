const mongoose = require('mongoose');

/**
 * @swagger
 * components:
 *   schemas:
 *     File:
 *       type: object
 *       required:
 *         - name
 *         - originalName
 *         - fileType
 *         - fileSize
 *         - filePath
 *         - user
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
 *           default: false
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

const FileSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide file name'],
      trim: true,
    },
    originalName: { type: String, required: true },
    fileType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    filePath: { type: String, required: true },
    user: { type: mongoose.Schema.ObjectId, ref: 'User', required: true },
    isPublic: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model('File', FileSchema);
