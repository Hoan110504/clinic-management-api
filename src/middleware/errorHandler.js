/**
 * Error Handler Middleware
 * Global error handling and formatting
 */
const config = require('../config');
const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

/**
 * Handle 404 Not Found
 */
const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Không tìm thấy endpoint: ${req.method} ${req.originalUrl}`,
      statusCode: 404,
      timestamp: new Date().toISOString(),
    },
  });
};

/**
 * Global error handler
 */
const errorHandler = (err, req, res, next) => {
  // Default error values
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Đã có lỗi xảy ra';
  let code = err.code || 'INTERNAL_ERROR';
  let details = err.errors || null;

  // Log error
  logger.error('Error occurred:', {
    error: err.message,
    code,
    statusCode,
    stack: err.stack,
    path: req.path,
    method: req.method,
    body: config.isDevelopment ? req.body : undefined,
    user: req.user?.id,
  });

  // Handle Sequelize errors
  if (err.name === 'SequelizeValidationError') {
    statusCode = 422;
    code = 'VALIDATION_ERROR';
    message = 'Dữ liệu không hợp lệ';
    details = err.errors.map((e) => ({
      field: e.path,
      message: e.message,
    }));
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 409;
    code = 'DUPLICATE_ENTRY';
    message = 'Dữ liệu đã tồn tại';
    details = err.errors.map((e) => ({
      field: e.path,
      message: `${e.path} đã tồn tại`,
    }));
  }

  if (err.name === 'SequelizeForeignKeyConstraintError') {
    statusCode = 400;
    code = 'FOREIGN_KEY_ERROR';
    message = 'Không thể thực hiện do ràng buộc dữ liệu';
  }

  if (err.name === 'SequelizeDatabaseError') {
    statusCode = 500;
    code = 'DATABASE_ERROR';
    message = config.isDevelopment ? err.message : 'Lỗi cơ sở dữ liệu';
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Token không hợp lệ';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Token đã hết hạn';
  }

  // Handle validation errors from express-validator
  if (err.array && typeof err.array === 'function') {
    statusCode = 422;
    code = 'VALIDATION_ERROR';
    message = 'Dữ liệu không hợp lệ';
    details = err.array();
  }

  // Build response
  const response = {
    success: false,
    error: {
      code,
      message,
      statusCode,
      timestamp: new Date().toISOString(),
    },
  };

  // Add details if available
  if (details) {
    response.error.details = details;
  }

  // Add stack trace in development
  if (config.isDevelopment && !(err instanceof AppError)) {
    response.error.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

/**
 * Handle async errors wrapper
 */
const asyncErrorHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  notFoundHandler,
  errorHandler,
  asyncErrorHandler,
};
