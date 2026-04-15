/**
 * Middleware Xử Lý Lỗi Toàn Cục
 * Bắt và chuẩn hóa tất cả lỗi thành response có cấu trúc thống nhất
 */
import config from '../config/index.js';
import logger from '../utils/logger.js';
import { AppError } from '../utils/errors.js';
import { formatToVietnamISOString } from '../utils/timezone.js';

/**
 * Xử lý 404 - Không tìm thấy endpoint
 * Đặt CUỐI cùng trong chuỗi middleware, sau tất cả routes
 */
const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Không tìm thấy endpoint: ${req.method} ${req.originalUrl}`,
      statusCode: 404,
      timestamp: formatToVietnamISOString(),
    },
  });
};

/**
 * Middleware xử lý lỗi toàn cục (4 tham số → Express nhận diện là error handler)
 * Phân loại lỗi từ các nguồn: Sequelize, JWT, express-validator, lỗi tùy chỉnh
 * Chuẩn hóa thành { success: false, error: { code, message, statusCode } }
 */
const errorHandler = (err, req, res, next) => {
  // Giá trị mặc định - sẽ bị ghi đè nếu nhận dạng được loại lỗi cụ thể
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Đã có lỗi xảy ra';
  let code = err.code || 'INTERNAL_ERROR';
  let details = err.errors || null;

  // Ghi log lỗi (bao gồm stack trace và context request)
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

  // === PHÂN LOẠI LỖI SEQUELIZE (ORM) ===
  // Validation: dữ liệu không đúng ràng buộc model (VD: email sai format)
  if (err.name === 'SequelizeValidationError') {
    statusCode = 422;
    code = 'VALIDATION_ERROR';
    message = 'Dữ liệu không hợp lệ';
    details = err.errors.map((e) => ({
      field: e.path,
      message: e.message,
    }));
  }

  // Unique constraint: trùng dữ liệu duy nhất (VD: username/email đã tồn tại)
  if (err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 409;
    code = 'DUPLICATE_ENTRY';
    message = 'Dữ liệu đã tồn tại';
    // Sequelize may provide a `fields` object mapping column names -> value
    // Use that when available (reliable across dialects). Otherwise fall back
    // to the items in `err.errors`. Some dialects (e.g., MSSQL) return
    // constraint/index names in `e.path` (like UQ__users__...) so we try to
    // derive a friendly field name from available data.
    if (err.fields && Object.keys(err.fields).length > 0) {
      details = Object.keys(err.fields).map((f) => ({
        field: f,
        message: `${f} đã tồn tại`,
      }));
    } else if (Array.isArray(err.errors) && err.errors.length > 0) {
      details = err.errors.map((e) => {
        let field = e.path;

        // If path looks like DB index name (starts with UQ__), try to derive
        if (!field || /^UQ__/.test(String(field))) {
          // 1) Try to match the duplicated value against request body to find the field
          try {
            if (req && req.body && typeof req.body === 'object') {
              const bodyKeys = Object.keys(req.body);
              const matchKey = bodyKeys.find((k) => String(req.body[k]) === String(e.value));
              if (matchKey) {
                field = matchKey;
              }
            }
          } catch (innerErr) {
            // ignore
          }

          // 2) Try to infer from error message content (common column names)
          if (!field || /^UQ__/.test(String(field))) {
            const msgLower = String(e.message || '').toLowerCase();
            const known = ['username', 'email', 'id_number', 'idnumber', 'phone', 'full_name', 'fullname'];
            const found = known.find((k) => msgLower.includes(k));
            if (found) field = found;
          }

          // 3) Final fallback to something readable
          if (!field || /^UQ__/.test(String(field))) {
            field = e?.path || e?.message || 'unique_field';
          }
        }

        return {
          field,
          message: `${field} đã tồn tại`,
        };
      });
    } else {
      details = null;
    }
  }

  // Foreign key: tham chiếu đến bản ghi không tồn tại hoặc bị ràng buộc
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    statusCode = 400;
    code = 'FOREIGN_KEY_ERROR';
    message = 'Không thể thực hiện do ràng buộc dữ liệu';
  }

  // Lỗi DB chung (cú pháp SQL, kết nối,...) - ẩn chi tiết trong production
  if (err.name === 'SequelizeDatabaseError') {
    statusCode = 500;
    code = 'DATABASE_ERROR';
    message = config.isDevelopment ? err.message : 'Lỗi cơ sở dữ liệu';
  }

  // === LỖI JWT (xác thực token) ===
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

  // === LỖI VALIDATION (express-validator) ===
  // Nhận diện qua phương thức .array() đặc trưng của express-validator
  if (err.array && typeof err.array === 'function') {
    statusCode = 422;
    code = 'VALIDATION_ERROR';
    message = 'Dữ liệu không hợp lệ';
    details = err.array();
  }

  // Tạo response lỗi chuẩn hóa cho client
  const response = {
    success: false,
    error: {
      code,
      message,
      statusCode,
      timestamp: formatToVietnamISOString(),
    },
  };

  // Thêm chi tiết lỗi (VD: danh sách field không hợp lệ)
  if (details) {
    response.error.details = details;
  }

  // Chỉ thêm stack trace trong môi trường dev (không lộ trong production)
  // Bỏ qua với AppError vì đó là lỗi tùy chỉnh của ứng dụng
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

export {
  notFoundHandler,
  errorHandler,
  asyncErrorHandler,
};
