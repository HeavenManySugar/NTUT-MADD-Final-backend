const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const { withCache, deleteCache, clearCachePattern } = require('../utils/cacheUtils');

/**
 * Find user by ID
 * @param {string} id - User ID
 * @returns {Promise<User>} - User object
 */
exports.findUserById = async (id) => {
  // 使用 Redis 緩存用戶數據，設置 30 分鐘過期時間
  return withCache(
    `user:${id}:profile`,
    async () => {
      // 使用 lean() 提高查詢性能，並只選擇必要字段
      const user = await User.findById(id)
        .select('name email role createdAt updatedAt')
        .lean({ virtuals: true });

      if (!user) {
        throw new ErrorResponse(`User not found with id of ${id}`, 404);
      }
      return user;
    },
    1800
  ); // 30分鐘緩存
};

/**
 * Find user by email
 * @param {string} email - User email
 * @returns {Promise<User>} - User object
 */
exports.findUserByEmail = async (email) => {
  // 使用 lean() 提高查詢性能，並只選擇必要字段
  const user = await User.findOne({ email })
    .select('name email role createdAt updatedAt')
    .lean({ virtuals: true });

  return user;
};

/**
 * Update user profile
 * @param {string} id - User ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<User>} - Updated user object
 */
exports.updateUser = async (id, updateData) => {
  // Don't allow role to be updated through this method for security
  if (updateData.role) {
    delete updateData.role;
  }

  const user = await User.findByIdAndUpdate(id, updateData, {
    new: true,
    runValidators: true,
    lean: true, // 使用 lean 提高查詢性能
    // 只返回必要字段
    fields: 'name email role createdAt updatedAt',
  });

  if (!user) {
    throw new ErrorResponse(`User not found with id of ${id}`, 404);
  }

  // 更新用戶後，刪除相關緩存
  await deleteCache(`user:${id}:profile`);
  await deleteCache(`auth:token:${id}`);

  return user;
};

/**
 * Delete user account
 * @param {string} id - User ID
 * @returns {Promise<boolean>} - True if delete successful
 */
exports.deleteUser = async (id) => {
  // 直接使用 findByIdAndDelete 減少查詢次數
  const result = await User.findByIdAndDelete(id);

  if (!result) {
    throw new ErrorResponse(`User not found with id of ${id}`, 404);
  }

  // 刪除用戶相關的所有緩存
  await deleteCache(`user:${id}:profile`);
  await deleteCache(`auth:token:${id}`);
  // 刪除可能與此用戶相關的任務緩存
  await clearCachePattern('tasks:*');

  return true;
};
