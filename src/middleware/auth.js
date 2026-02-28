/**
 * Authentication Middleware
 * JWT verification and role-based access control
 */
const jwt = require('jsonwebtoken');
const config = require('../config');
const { User } = require('../models');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');
const { asyncHandler } = require('../utils/helpers');

/**
 * Verify JWT token and attach user to request
 */
const authenticate = asyncHandler(async (req, res, next) => {
  // Get token from header
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Token không được cung cấp', 'NO_TOKEN');
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify token
    const decoded = jwt.verify(token, config.jwt.secret);

    // Find user
    const user = await User.findByPk(decoded.id);

    if (!user) {
      throw new UnauthorizedError('Người dùng không tồn tại', 'USER_NOT_FOUND');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('Tài khoản đã bị vô hiệu hóa', 'ACCOUNT_DISABLED');
    }

    // Attach user to request
    req.user = user;
    req.userId = user.id;
    req.userRole = user.role;

    next();
  } catch (error) {
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
 * Optional authentication - doesn't fail if no token
 */
const optionalAuth = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret);
    const user = await User.findByPk(decoded.id);

    if (user && user.isActive) {
      req.user = user;
      req.userId = user.id;
      req.userRole = user.role;
    }
  } catch (error) {
    // Ignore errors for optional auth
  }

  next();
});

/**
 * Role-based access control
 * @param {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new UnauthorizedError('Yêu cầu đăng nhập', 'NOT_AUTHENTICATED');
    }

    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError(
        'Bạn không có quyền thực hiện hành động này',
        'INSUFFICIENT_PERMISSIONS'
      );
    }

    next();
  };
};

/**
 * Check if user owns the resource or is admin
 * @param {Function} getResourceUserId - Function to get resource owner ID
 */
const authorizeOwnerOrAdmin = (getResourceUserId) => {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      throw new UnauthorizedError('Yêu cầu đăng nhập', 'NOT_AUTHENTICATED');
    }

    // Admin can access any resource
    if (req.user.role === 'admin') {
      return next();
    }

    const resourceUserId = await getResourceUserId(req);
    
    if (req.user.id !== resourceUserId) {
      throw new ForbiddenError(
        'Bạn không có quyền truy cập tài nguyên này',
        'NOT_RESOURCE_OWNER'
      );
    }

    next();
  });
};

module.exports = {
  authenticate,
  optionalAuth,
  authorize,
  authorizeOwnerOrAdmin,
};
