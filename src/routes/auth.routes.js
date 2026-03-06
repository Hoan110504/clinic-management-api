/**
 * Authentication Routes
 */
import express from 'express';
import { authController } from '../controllers/index.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authValidator } from '../validators/index.js';
import { authLimiter, registerLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

/**
 * @route POST /api/auth/login
 * @desc Login user
 * @access Public
 */
router.post(
  '/login',
  authLimiter,
  validate(authValidator.login),
  authController.login
);

/**
 * @route POST /api/auth/register
 * @desc Register new patient
 * @access Public
 */
router.post(
  '/register',
  registerLimiter,
  validate(authValidator.register),
  authController.register
);

/**
 * @route POST /api/auth/refresh
 * @desc Refresh access token
 * @access Public
 */
router.post(
  '/refresh',
  validate(authValidator.refreshToken),
  authController.refreshAccessToken
);

/**
 * @route POST /api/auth/logout
 * @desc Logout user
 * @access Private
 */
router.post('/logout', authenticate, authController.logout);

/**
 * @route GET /api/auth/me
 * @desc Get current user
 * @access Private
 */
router.get('/me', authenticate, authController.getCurrentUser);

/**
 * @route PUT /api/auth/change-password
 * @desc Change password
 * @access Private
 */
router.put(
  '/change-password',
  authenticate,
  validate(authValidator.changePassword),
  authController.changePassword
);

/**
 * @route PUT /api/auth/profile
 * @desc Update profile
 * @access Private
 */
router.put('/profile', authenticate, authController.updateProfile);

/**
 * @route POST /api/auth/forgot-password
 * @desc Quên mật khẩu - tạo mã reset
 * @access Public
 */
router.post('/forgot-password', authLimiter, authController.forgotPassword);

/**
 * @route POST /api/auth/reset-password
 * @desc Đặt lại mật khẩu bằng mã reset
 * @access Public
 */
router.post('/reset-password', authLimiter, authController.resetPassword);

export default router;
