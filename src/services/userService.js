const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');

/**
 * Find user by ID
 * @param {string} id - User ID
 * @returns {Promise<User>} - User object
 */
exports.findUserById = async (id) => {
  const user = await User.findById(id);
  if (!user) {
    throw new ErrorResponse(`User not found with id of ${id}`, 404);
  }
  return user;
};

/**
 * Find user by email
 * @param {string} email - User email
 * @returns {Promise<User>} - User object
 */
exports.findUserByEmail = async (email) => {
  const user = await User.findOne({email});
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

  const user = await User.findByIdAndUpdate(
      id, updateData, {new: true, runValidators: true});

  if (!user) {
    throw new ErrorResponse(`User not found with id of ${id}`, 404);
  }

  return user;
};

/**
 * Delete user account
 * @param {string} id - User ID
 * @returns {Promise<boolean>} - True if delete successful
 */
exports.deleteUser = async (id) => {
  const user = await User.findById(id);

  if (!user) {
    throw new ErrorResponse(`User not found with id of ${id}`, 404);
  }

  await User.deleteOne({_id: id});

  return true;
};
