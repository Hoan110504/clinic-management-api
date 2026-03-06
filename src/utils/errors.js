/**
 * Custom Error Classes
 * Standardized error handling with HTTP status codes
 */

class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
        timestamp: this.timestamp,
      },
    };
  }
}

class BadRequestError extends AppError {
  constructor(message = 'Yêu cầu không hợp lệ', code = 'BAD_REQUEST') {
    super(message, 400, code);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Không có quyền truy cập', code = 'UNAUTHORIZED') {
    super(message, 401, code);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Không được phép thực hiện hành động này', code = 'FORBIDDEN') {
    super(message, 403, code);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Không tìm thấy tài nguyên', code = 'NOT_FOUND') {
    super(message, 404, code);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Xung đột dữ liệu', code = 'CONFLICT') {
    super(message, 409, code);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Dữ liệu không hợp lệ', errors = [], code = 'VALIDATION_ERROR') {
    super(message, 422, code);
    this.errors = errors;
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        statusCode: this.statusCode,
        timestamp: this.timestamp,
        details: this.errors,
      },
    };
  }
}

class TooManyRequestsError extends AppError {
  constructor(message = 'Quá nhiều yêu cầu, vui lòng thử lại sau', code = 'TOO_MANY_REQUESTS') {
    super(message, 429, code);
  }
}

class InternalServerError extends AppError {
  constructor(message = 'Lỗi hệ thống', code = 'INTERNAL_ERROR') {
    super(message, 500, code);
  }
}

class ServiceUnavailableError extends AppError {
  constructor(message = 'Dịch vụ tạm thời không khả dụng', code = 'SERVICE_UNAVAILABLE') {
    super(message, 503, code);
  }
}

export {
  AppError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  TooManyRequestsError,
  InternalServerError,
  ServiceUnavailableError,
};
