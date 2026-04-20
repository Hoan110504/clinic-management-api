/**
 * Middleware Xác Thực
 * Xác minh JWT token và kiểm soát truy cập theo vai trò (RBAC)
 */
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { User, Patient } from '../models/index.js';
import { UnauthorizedError, ForbiddenError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { ROLES } from '../config/constants.js';
import { asyncHandler } from '../utils/helpers.js';

/**
 * Xác thực bắt buộc - Giải mã JWT và gắn user vào request
 * Luồng: Lấy token từ header → Giải mã → Tìm user → Kiểm tra trạng thái → Gắn vào req
 */
const authenticate = asyncHandler(async (req, res, next) => {
  // Lấy token từ header Authorization (định dạng: "Bearer <token>")
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Token không được cung cấp', 'NO_TOKEN');
  }

  // Tách lấy phần token (bỏ prefix "Bearer ")
  const token = authHeader.split(' ')[1];

  try {
    // Giải mã token bằng secret key, tự động kiểm tra hết hạn
    const decoded = jwt.verify(token, config.jwt.secret);

    // Tìm user trong DB theo ID từ token payload
    const user = await User.findByPk(decoded.id);

    if (!user) {
      throw new UnauthorizedError('Người dùng không tồn tại', 'USER_NOT_FOUND');
    }

    // Kiểm tra tài khoản có bị admin vô hiệu hóa không
    if (!user.isActive) {
      throw new UnauthorizedError('Tài khoản đã bị vô hiệu hóa', 'ACCOUNT_DISABLED');
    }

    // RBAC roleId-only: chỉ chấp nhận role số hợp lệ 1-5
    let roleId = Number(user.role);
    
    // Auto-correct: if role is NULL or NaN, default to PATIENT (5) and save
    if (!Number.isInteger(roleId) || !Object.values(ROLES).includes(roleId)) {
      try {
        logger.warn('authenticate - invalid role detected, auto-correcting to PATIENT', {
          userId: user.id,
          username: user.username,
          dbRoleRaw: user.role,
          parsedRoleId: roleId,
          correctedTo: ROLES.PATIENT,
        });
        
        // Update user's role to PATIENT if it's invalid
        user.role = ROLES.PATIENT;
        await user.save();
        roleId = ROLES.PATIENT;
      } catch (e) {
        try {
          logger.error('authenticate - failed to auto-correct role', {
            userId: user.id,
            error: e.message,
          });
        } catch (logE) {
          // ignore logging errors
        }
        throw new UnauthorizedError('Vai trò tài khoản không hợp lệ', 'INVALID_ROLE');
      }
    }
    
    try {
      logger.debug('authenticate - role verified', {
        userId: user.id,
        username: user.username,
        role: roleId,
      });
    } catch (e) {
      // ignore logging errors
    }

    req.user = user;
    req.user.role = roleId;
    req.userId = user.id;
    req.userRole = roleId;

    next();
  } catch (error) {
    // Phân loại lỗi JWT để trả mã lỗi cụ thể cho frontend xử lý
    if (error.name === 'JsonWebTokenError') {
      throw new UnauthorizedError('Token không hợp lệ', 'INVALID_TOKEN');
    }
    if (error.name === 'TokenExpiredError') {
      throw new UnauthorizedError('Token đã hết hạn', 'TOKEN_EXPIRED');
    }
    throw error;
  }
});

/**
 * Xác thực tùy chọn - Không lỗi nếu không có token
 * Dùng cho các endpoint công khai nhưng muốn biết user nếu đã đăng nhập
 * (VD: hiển thị tên user, cá nhân hóa nội dung)
 */
const optionalAuth = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  // Không có token → bỏ qua, tiếp tục xử lý request bình thường
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret);
    const user = await User.findByPk(decoded.id);

    // Chỉ gắn user nếu tài khoản còn hoạt động
    if (user && user.isActive) {
      const roleId = Number(user.role);
      if (!Number.isInteger(roleId) || !Object.values(ROLES).includes(roleId)) {
        return next();
      }
      req.user = user;
      req.user.role = roleId;
      req.userId = user.id;
      req.userRole = roleId;
    }
  } catch (error) {
    // Nuốt lỗi - token sai/hết hạn không ảnh hưởng request
  }

  next();
});

/**
 * Phân quyền theo vai trò (RBAC)
 * Sử dụng closure pattern: authorize(ROLES.ADMIN, ROLES.DOCTOR) trả về middleware
 * Phải đặt SAU authenticate trong chuỗi middleware
 * @param {...number} roles - Danh sách roleId được phép (1-5)
 */
const authorize = (...roles) => {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      throw new UnauthorizedError('Yêu cầu đăng nhập', 'NOT_AUTHENTICATED');
    }

    let effectiveRole = req.user.role;

    // Fallback for legacy data: if route accepts PATIENT and user has a linked
    // patient profile, treat this request as PATIENT role.
    if (!roles.includes(effectiveRole) && roles.includes(ROLES.PATIENT)) {
      const patientProfile = await Patient.findOne({
        where: { userId: req.user.id },
        attributes: ['id'],
        raw: true,
      });

      if (patientProfile && patientProfile.id) {
        effectiveRole = ROLES.PATIENT;
      }
    }

    if (!roles.includes(effectiveRole)) {
      try {
        logger.warn('authorize - insufficient permissions', {
          userId: req.user && req.user.id,
          userRole: req.user && req.user.role,
          effectiveRole,
          requiredRoles: roles,
          method: req.method,
          path: req.originalUrl || req.url,
        });
      } catch (e) {
        // ignore logging failures
      }

      throw new ForbiddenError('Bạn không có quyền thực hiện hành động này', 'INSUFFICIENT_PERMISSIONS');
    }

    // Expose effective role for downstream controllers that branch by req.user.role.
    req.user.role = effectiveRole;
    req.userRole = effectiveRole;

    next();
  });
};

/**
 * Kiểm tra quyền sở hữu tài nguyên hoặc admin
 * Dùng cho các endpoint mà user chỉ được thao tác trên dữ liệu của chính mình
 * Admin được bỏ qua kiểm tra (bypass) → truy cập mọi tài nguyên
 * @param {Function} getResourceUserId - Hàm async lấy userId chủ sở hữu tài nguyên từ request
 */
const authorizeOwnerOrAdmin = (getResourceUserId) => {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      throw new UnauthorizedError('Yêu cầu đăng nhập', 'NOT_AUTHENTICATED');
    }

    // Admin được phép truy cập mọi tài nguyên → bỏ qua kiểm tra
    if (req.user.role === ROLES.ADMIN) {
      return next();
    }

    // Lấy userId của chủ tài nguyên (VD: từ DB record)
    const resourceUserId = await getResourceUserId(req);
    
    // So sánh: user hiện tại phải là chủ sở hữu
    if (req.user.id !== resourceUserId) {
      throw new ForbiddenError(
        'Bạn không có quyền truy cập tài nguyên này',
        'NOT_RESOURCE_OWNER'
      );
    }

    next();
  });
};

export {
  authenticate,
  optionalAuth,
  authorize,
  authorizeOwnerOrAdmin,
};
