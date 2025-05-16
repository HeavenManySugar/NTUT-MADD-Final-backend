const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../utils/asyncHandler');
const taskService = require('../services/taskService');

// @desc    Get all tasks
// @route   GET /api/tasks
// @access  Private
exports.getTasks = asyncHandler(async (req, res, next) => {
  // Use the service layer to get tasks
  const result = await taskService.getTasks(req.query, req.user.id);

  res.status(200).json({
    success: true,
    count: result.count,
    pagination: result.pagination,
    data: result.tasks
  });
});

// @desc    Get single task
// @route   GET /api/tasks/:id
// @access  Private
exports.getTask = asyncHandler(async (req, res, next) => {
  const task = await taskService.getTaskById(req.params.id, req.user.id);

  res.status(200).json({success: true, data: task});
});

// @desc    Create new task
// @route   POST /api/tasks
// @access  Private
exports.createTask = asyncHandler(async (req, res, next) => {
  const task = await taskService.createTask(req.body, req.user.id);

  res.status(201).json({success: true, data: task});
});

// @desc    Update task
// @route   PUT /api/tasks/:id
// @access  Private
exports.updateTask = asyncHandler(async (req, res, next) => {
  const task = await taskService.updateTask(
      req.params.id, req.body, req.user.id, req.user.role);

  res.status(200).json({success: true, data: task});
});

// @desc    Delete task
// @route   DELETE /api/tasks/:id
// @access  Private
exports.deleteTask = asyncHandler(async (req, res, next) => {
  await taskService.deleteTask(req.params.id, req.user.id, req.user.role);

  res.status(200).json({success: true, data: {}});
});
