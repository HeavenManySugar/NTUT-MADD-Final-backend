const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../utils/asyncHandler');
const User = require('../models/User');

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = asyncHandler(async (req, res, next) => {
  const { name, email, password, role } = req.body;

  // Create user
  const user = await User.create({ name, email, password, role });

  sendTokenResponse(user, 201, res);
});

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res, next) => {
  const { email, password } = req.body;

  // Validate email and password
  if (!email || !password) {
    return next(new ErrorResponse('Please provide an email and password', 400));
  }

  // Check for user
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  // Check if password matches
  const isMatch = await user.matchPassword(password);

  if (!isMatch) {
    return next(new ErrorResponse('Invalid credentials', 401));
  }

  sendTokenResponse(user, 200, res);
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  res.status(200).json({ success: true, data: user });
});

// @desc    搜索用戶通過電子郵件
// @route   GET /api/auth/search
// @access  Private
exports.searchUserByEmail = asyncHandler(async (req, res, next) => {
  const { email } = req.query;

  if (!email) {
    return next(new ErrorResponse('請提供電子郵件進行搜索', 400));
  }

  // 查找用戶但不返回密碼
  const user = await User.findOne({ email }).select('-password');

  if (!user) {
    return next(new ErrorResponse('找不到用戶', 404));
  }

  res.status(200).json({ success: true, data: user });
});

// Get token from model, create and send response
const sendTokenResponse = (user, statusCode, res) => {
  // Create token
  const token = user.getSignedJwtToken();

  // Create a user object without the password
  const userData = {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };

  res.status(statusCode).json({
    success: true,
    token,
    data: userData,
  });
};
