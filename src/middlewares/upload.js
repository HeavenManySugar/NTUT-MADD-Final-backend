const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ErrorResponse = require('../utils/errorResponse');

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Set storage engine
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

// Check file type
const fileFilter = (req, file, cb) => {
  // Allowed extensions
  const filetypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|zip|rar|txt|csv/;
  // Check extension
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  // Check mime
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('只允許上傳圖片、PDF、Office文件、壓縮檔和文本檔案格式'));
  }
};

// Initialize upload
const upload = multer({
  storage: storage,
  limits: { fileSize: 10000000 }, // 10MB
  fileFilter: fileFilter,
});

// Single file upload handler
exports.uploadSingle = (fieldName) => {
  return (req, res, next) => {
    const uploadSingle = upload.single(fieldName);

    uploadSingle(req, res, function (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new ErrorResponse('檔案太大，超過10MB的限制', 400));
        }
        return next(new ErrorResponse(`檔案上傳錯誤: ${err.message}`, 400));
      } else if (err) {
        return next(new ErrorResponse(err.message, 400));
      }

      next();
    });
  };
};

// Multiple files upload handler
exports.uploadMultiple = (fieldName, maxCount) => {
  return (req, res, next) => {
    const uploadMultiple = upload.array(fieldName, maxCount);

    uploadMultiple(req, res, function (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return next(new ErrorResponse('檔案太大，超過10MB的限制', 400));
        } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
          return next(new ErrorResponse(`超過最大允許檔案數量: ${maxCount}`, 400));
        }
        return next(new ErrorResponse(`檔案上傳錯誤: ${err.message}`, 400));
      } else if (err) {
        return next(new ErrorResponse(err.message, 400));
      }

      next();
    });
  };
};
