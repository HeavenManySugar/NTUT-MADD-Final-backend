const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../utils/asyncHandler');
const userService = require('../services/userService');

// @desc    Get user profile
// @route   GET /api/profile/me
// @access  Private
exports.getProfile = asyncHandler(async (req, res, next) => {
  const user = await userService.findUserById(req.user.id);

  res.status(200).json({ success: true, data: user });
});

// @desc    Update user profile
// @route   PUT /api/profile/me
// @access  Private
exports.updateProfile = asyncHandler(async (req, res, next) => {
  // Prevent password update through this route
  if (req.body.password) {
    return next(
      new ErrorResponse(
        'This route is not for password updates. Please use /api/auth/updatepassword.',
        400
      )
    );
  }

  const user = await userService.updateUser(req.user.id, req.body);

  res.status(200).json({ success: true, data: user });
});

// @desc    Delete user account
// @route   DELETE /api/profile/me
// @access  Private
exports.deleteAccount = asyncHandler(async (req, res, next) => {
  await userService.deleteUser(req.user.id);

  res.status(200).json({ success: true, data: {} });
});
