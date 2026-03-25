/**
 * Middleware Giới Hạn Tần Suất (Rate Limiting)
 * Bảo vệ chống tấn công brute-force và DDoS
 * Sử dụng sliding window algorithm của express-rate-limit
 */
import rateLimit from 'express-rate-limit';
import config from '../config/index.js';

/**
 * Giới hạn API chung - áp dụng cho tất cả endpoint
 * Bỏ qua /health để hệ thống monitoring không bị chặn
 */
const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Quá nhiều yêu cầu, vui lòng thử lại sau',
      statusCode: 429,
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health check endpoint
    if (req.path === '/health') return true;

    // Allow patient creation from reception to bypass the global API limiter
    // (mounted under '/api', so req.path is '/patients')
    if (req.method === 'POST' && req.path === '/patients') return true;

    // Allow GET read access to patient endpoints (list/search/detail)
    // to avoid blocking frequent UI lookups (e.g., patient lookup by ID)
    if (req.method === 'GET' && req.path && req.path.startsWith('/patients')) return true;

    return false;
  },
});

/**
 * Giới hạn đăng nhập - chặt hơn để chống brute-force mật khẩu
 * 10 lần / 15 phút, chỉ đếm request thất bại (skipSuccessfulRequests)
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 attempts per 15 minutes
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_LOGIN_ATTEMPTS',
      message: 'Quá nhiều lần đăng nhập thất bại, vui lòng thử lại sau 15 phút',
      statusCode: 429,
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

/**
 * Giới hạn đăng ký - nhẹ hơn so với giới hạn login nhưng vẫn chống spam
 * 20 lần / 15 phút, đếm các request thất bại
 */
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per 15 minutes
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REGISTRATION_ATTEMPTS',
      message: 'Quá nhiều lần đăng ký, vui lòng thử lại sau 15 phút',
      statusCode: 429,
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

/**
 * Giới hạn quên mật khẩu - rất chặt để tránh spam email reset
 * 5 lần / giờ
 */
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 attempts per hour
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_RESET_ATTEMPTS',
      message: 'Quá nhiều yêu cầu đặt lại mật khẩu, vui lòng thử lại sau 1 giờ',
      statusCode: 429,
    },
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export {
  apiLimiter,
  authLimiter,
  registerLimiter,
  passwordResetLimiter,
};
