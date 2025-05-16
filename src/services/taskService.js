const Task = require('../models/Task');
const ErrorResponse = require('../utils/errorResponse');

/**
 * Get all tasks with filtering, sorting and pagination
 * @param {Object} queryParams - Query parameters for filtering, sorting,
 *     pagination
 * @param {Object} userId - User ID to filter tasks by
 * @returns {Promise<Object>} - Tasks and pagination data
 */
exports.getTasks = async (queryParams, userId) => {
  let query;

  // Copy req.query
  const reqQuery = {...queryParams};

  // Fields to exclude
  const removeFields = ['select', 'sort', 'page', 'limit'];

  // Loop over removeFields and delete them from reqQuery
  removeFields.forEach(param => delete reqQuery[param]);

  // Add userId filter if provided
  if (userId) {
    reqQuery.user = userId;
  }

  // Create query string
  let queryStr = JSON.stringify(reqQuery);

  // Create operators ($gt, $gte, etc)
  queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);

  // Finding resource
  query = Task.find(JSON.parse(queryStr)).populate('user', 'name email');

  // Select Fields
  if (queryParams.select) {
    const fields = queryParams.select.split(',').join(' ');
    query = query.select(fields);
  }

  // Sort
  if (queryParams.sort) {
    const sortBy = queryParams.sort.split(',').join(' ');
    query = query.sort(sortBy);
  } else {
    query = query.sort('-createdAt');
  }

  // Pagination
  const page = parseInt(queryParams.page, 10) || 1;
  const limit = parseInt(queryParams.limit, 10) || 25;
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const total = await Task.countDocuments(JSON.parse(queryStr));

  query = query.skip(startIndex).limit(limit);

  // Executing query
  const tasks = await query;

  // Pagination result
  const pagination = {};

  if (endIndex < total) {
    pagination.next = {page: page + 1, limit};
  }

  if (startIndex > 0) {
    pagination.prev = {page: page - 1, limit};
  }

  return {tasks, count: tasks.length, pagination, total};
};

/**
 * Get a specific task by ID
 * @param {string} id - Task ID
 * @param {string} userId - Optional user ID for authorization
 * @returns {Promise<Task>} - Task object
 */
exports.getTaskById = async (id, userId = null) => {
  const task = await Task.findById(id).populate('user', 'name email');

  if (!task) {
    throw new ErrorResponse(`Task not found with id of ${id}`, 404);
  }

  // Check if user is authorized to access this task
  if (userId && task.user.toString() !== userId) {
    throw new ErrorResponse('Not authorized to access this task', 401);
  }

  return task;
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

  const task = await Task.create(taskData);
  return task;
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
  let task = await Task.findById(id);

  if (!task) {
    throw new ErrorResponse(`Task not found with id of ${id}`, 404);
  }

  // Make sure user is task owner or admin
  if (task.user.toString() !== userId && role !== 'admin') {
    throw new ErrorResponse('Not authorized to update this task', 401);
  }

  task = await Task.findByIdAndUpdate(
      id, updateData, {new: true, runValidators: true});

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
  const task = await Task.findById(id);

  if (!task) {
    throw new ErrorResponse(`Task not found with id of ${id}`, 404);
  }

  // Make sure user is task owner or admin
  if (task.user.toString() !== userId && role !== 'admin') {
    throw new ErrorResponse('Not authorized to delete this task', 401);
  }

  await Task.deleteOne({_id: id});
  return true;
};
