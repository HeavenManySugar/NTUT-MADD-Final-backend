const Task = require('../models/Task');
const ErrorResponse = require('../utils/errorResponse');
const { withCache, deleteCache, clearCachePattern } = require('../utils/cacheUtils');
const { findOne, find, paginate, update, remove } = require('../utils/dbUtils');

/**
 * Get all tasks with filtering, sorting and pagination
 * @param {Object} queryParams - Query parameters for filtering, sorting,
 *     pagination
 * @param {Object} userId - User ID to filter tasks by
 * @returns {Promise<Object>} - Tasks and pagination data
 */
exports.getTasks = async (queryParams, userId) => {
  // 為了緩存，創建一個能標識查詢獨特性的鍵
  const cacheKey = `tasks:${userId || 'all'}:${JSON.stringify(queryParams)}`;

  // 使用緩存包裝器，過期時間設為 5 分鐘
  return withCache(
    cacheKey,
    async () => {
      // 準備查詢條件
      const conditions = {};

      // 添加用戶篩選
      if (userId) {
        conditions.user = userId;
      }

      // 處理高級篩選條件 ($gt, $gte 等)
      Object.keys(queryParams).forEach((key) => {
        // 跳過分頁、排序和選擇參數
        if (['select', 'sort', 'page', 'limit'].includes(key)) return;

        // 處理比較運算符
        if (typeof queryParams[key] === 'string') {
          const match = queryParams[key].match(/\b(gt|gte|lt|lte|in)\b:(.*)/);
          if (match) {
            const operator = `$${match[1]}`;
            const value = match[2];
            conditions[key] = { [operator]: value };
          } else {
            conditions[key] = queryParams[key];
          }
        } else {
          conditions[key] = queryParams[key];
        }
      });

      // 準備選項
      const options = {
        page: parseInt(queryParams.page, 10) || 1,
        limit: parseInt(queryParams.limit, 10) || 25,
        select: queryParams.select || 'title status priority dueDate createdAt updatedAt user',
        populate: {
          path: 'user',
          select: 'name email',
        },
        lean: true,
      };

      // 處理排序
      if (queryParams.sort) {
        options.sort = {};
        const sortFields = queryParams.sort.split(',');

        sortFields.forEach((field) => {
          if (field.startsWith('-')) {
            options.sort[field.substring(1)] = -1;
          } else {
            options.sort[field] = 1;
          }
        });
      } else {
        options.sort = { createdAt: -1 };
      }

      // 使用 dbUtils 的 paginate 函數進行優化查詢
      const result = await paginate(Task, conditions, options);

      return {
        tasks: result.data,
        count: result.data.length,
        pagination: result.pagination,
        total: result.pagination.total,
      };
    },
    300
  ); // 5分鐘緩存
};

/**
 * Get a specific task by ID
 * @param {string} id - Task ID
 * @param {string} userId - Optional user ID for authorization
 * @returns {Promise<Task>} - Task object
 */
exports.getTaskById = async (id, userId = null) => {
  // 使用 Redis 緩存單個任務查詢，設置 10 分鐘過期時間
  return withCache(
    `task:${id}`,
    async () => {
      // 使用 dbUtils 的 findOne 函數代替直接 Mongoose 查詢
      const task = await findOne(Task, id, {
        populate: 'user',
        select: 'title description status priority dueDate user createdAt updatedAt',
        lean: true,
      });

      if (!task) {
        throw new ErrorResponse(`Task not found with id of ${id}`, 404);
      }

      // Check if user is authorized to access this task
      if (userId && task.user._id.toString() !== userId) {
        throw new ErrorResponse('Not authorized to access this task', 401);
      }

      return task;
    },
    600
  ); // 10分鐘緩存
};

/**
 * Create a new task
 * @param {Object} taskData - Task data
 * @param {string} userId - User ID
 * @returns {Promise<Task>} - Created task object
 */
exports.createTask = async (taskData, userId) => {
  // Add user to taskData
  taskData.user = userId;

  // 使用 dbUtils.create 優化創建操作
  // create 函數會自動處理緩存清除
  const newTask = await Task.create(taskData);

  // 返回新建任務
  return findOne(Task, newTask._id, { lean: true });
};

/**
 * Update a task
 * @param {string} id - Task ID
 * @param {Object} updateData - Data to update
 * @param {string} userId - User ID for authorization
 * @param {string} role - User role for authorization
 * @returns {Promise<Task>} - Updated task object
 */
exports.updateTask = async (id, updateData, userId, role) => {
  // 首先檢查任務是否存在，只獲取必要字段以提高性能
  let task = await findOne(Task, id, { select: 'user', lean: true });

  if (!task) {
    throw new ErrorResponse(`Task not found with id of ${id}`, 404);
  }

  // Make sure user is task owner or admin
  if (task.user.toString() !== userId && role !== 'admin') {
    throw new ErrorResponse('Not authorized to update this task', 401);
  }

  // 使用 dbUtils 的 update 函數代替直接 Mongoose 查詢
  task = await update(Task, id, updateData);

  // 更新任務後，刪除相關緩存已由 dbUtils 處理
  // dbUtils.update 已經會自動清除實體和列表緩存

  return task;
};

/**
 * Delete a task
 * @param {string} id - Task ID
 * @param {string} userId - User ID for authorization
 * @param {string} role - User role for authorization
 * @returns {Promise<boolean>} - True if delete successful
 */
exports.deleteTask = async (id, userId, role) => {
  // 只獲取用戶ID以驗證權限，提高查詢性能
  const task = await findOne(Task, id, { select: 'user', lean: true });

  if (!task) {
    throw new ErrorResponse(`Task not found with id of ${id}`, 404);
  }

  // Make sure user is task owner or admin
  if (task.user.toString() !== userId && role !== 'admin') {
    throw new ErrorResponse('Not authorized to delete this task', 401);
  }

  // 使用 dbUtils 的 remove 函數
  await remove(Task, id);

  // 刪除相關緩存已由 dbUtils 處理
  // dbUtils.remove 已經會自動清除實體和列表緩存

  return true;
};
