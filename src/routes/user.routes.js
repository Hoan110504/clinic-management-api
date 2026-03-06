/**
 * User Routes
 */
import express from 'express';
import { userController } from '../controllers/index.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { userValidator } from '../validators/index.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/users
 * @desc Get all users with pagination
 * @access Admin only
 */
router.get(
  '/',
  authorize(ROLES.ADMIN),
  validate(userValidator.getList),
  userController.getAllUsers
);

/**
 * @route GET /api/users/role/:role
 * @desc Get users by role
 * @access Admin, Receptionist
 */
router.get(
  '/role/:role',
  authorize(ROLES.ADMIN, ROLES.RECEPTIONIST),
  userController.getUsersByRole
);

/**
 * @route GET /api/users/:id
 * @desc Get user by ID
 * @access Admin only
 */
router.get(
  '/:id',
  authorize(ROLES.ADMIN),
  validate(userValidator.getById),
  userController.getUserById
);

/**
 * @route POST /api/users
 * @desc Create new user
 * @access Admin only
 */
router.post(
  '/',
  authorize(ROLES.ADMIN),
  validate(userValidator.create),
  userController.createUser
);

/**
 * @route PUT /api/users/:id
 * @desc Update user
 * @access Admin only
 */
router.put(
  '/:id',
  authorize(ROLES.ADMIN),
  validate(userValidator.update),
  userController.updateUser
);

/**
 * @route DELETE /api/users/:id
 * @desc Delete user
 * @access Admin only
 */
router.delete(
  '/:id',
  authorize(ROLES.ADMIN),
  validate(userValidator.getById),
  userController.deleteUser
);

/**
 * @route PATCH /api/users/:id/toggle-active
 * @desc Toggle user active status
 * @access Admin only
 */
router.patch(
  '/:id/toggle-active',
  authorize(ROLES.ADMIN),
  userController.toggleUserActive
);

/**
 * @route POST /api/users/:id/reset-password
 * @desc Reset user password
 * @access Admin only
 */
router.post(
  '/:id/reset-password',
  authorize(ROLES.ADMIN),
  userController.resetUserPassword
);

export default router;
