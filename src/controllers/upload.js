const path = require('path');
const fs = require('fs');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../utils/asyncHandler');
const File = require('../models/File');

// @desc    Upload a file
// @route   POST /api/upload
// @access  Private
exports.uploadFile = asyncHandler(async (req, res, next) => {
  if (!req.file) {
    return next(new ErrorResponse('請選擇要上傳的檔案', 400));
  }

  // Create file in database
  const file = await File.create({
    name: req.body.name || req.file.originalname,
    originalName: req.file.originalname,
    fileType: req.file.mimetype,
    fileSize: req.file.size,
    filePath: req.file.path,
    user: req.user.id,
    isPublic: req.body.isPublic === 'true'
  });

  res.status(201).json({success: true, data: file});
});

// @desc    Get all files for a user
// @route   GET /api/upload
// @access  Private
exports.getAllFiles = asyncHandler(async (req, res, next) => {
  const files = await File.find({user: req.user.id});

  res.status(200).json({success: true, count: files.length, data: files});
});

// @desc    Get a single file
// @route   GET /api/upload/:id
// @access  Private
exports.getFile = asyncHandler(async (req, res, next) => {
  const file = await File.findById(req.params.id);

  if (!file) {
    return next(new ErrorResponse(`找不到ID為 ${req.params.id} 的檔案`, 404));
  }

  // Make sure user owns file or file is public
  if (file.user.toString() !== req.user.id && !file.isPublic) {
    return next(new ErrorResponse('無權訪問此檔案', 401));
  }

  const filePath = path.join(__dirname, '..', '..', file.filePath);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return next(new ErrorResponse('找不到檔案', 404));
  }

  res.sendFile(filePath);
});

// @desc    Delete a file
// @route   DELETE /api/upload/:id
// @access  Private
exports.deleteFile = asyncHandler(async (req, res, next) => {
  const file = await File.findById(req.params.id);

  if (!file) {
    return next(new ErrorResponse(`找不到ID為 ${req.params.id} 的檔案`, 404));
  }

  // Make sure user owns file
  if (file.user.toString() !== req.user.id && req.user.role !== 'admin') {
    return next(new ErrorResponse('無權刪除此檔案', 401));
  }

  const filePath = path.join(__dirname, '..', '..', file.filePath);

  // Delete file from database
  await File.deleteOne({_id: req.params.id});

  // Delete file from filesystem
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error('刪除實體檔案失敗:', err);
    // Continue with response even if physical file deletion fails
  }

  res.status(200).json({success: true, data: {}});
});
