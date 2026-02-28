/**
 * Authentication Routes
 */
const express = require('express');
const router = express.Router();
const { authController } = require('../controllers');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { authValidator } = require('../validators');
const { authLimiter } = require('../middleware/rateLimiter');

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
  authLimiter,
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

module.exports = router;
