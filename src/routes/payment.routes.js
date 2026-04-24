/**
 * Payment Routes
 */
import express from 'express';
import { paymentController } from '../controllers/index.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { paymentValidator } from '../validators/index.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/payments/unpaid
 * @desc Get unpaid payments
 * @access Admin, Receptionist
 */
router.get(
  '/unpaid',
  authorize(ROLES.ADMIN, ROLES.RECEPTIONIST),
  paymentController.getUnpaidPayments
);

/**
 * @route GET /api/payments/statistics
 * @desc Get payment statistics
 * @access Admin only
 */
router.get(
  '/statistics',
  authorize(ROLES.ADMIN),
  paymentController.getPaymentStatistics
);

/**
 * @route GET /api/payments/preview/:examinationId
 * @desc Preview payment invoice without creating database record
 * @access Admin, Receptionist
 */
router.get(
  '/preview/:examinationId',
  authorize(ROLES.ADMIN, ROLES.RECEPTIONIST),
  paymentController.getPaymentPreview
);

/**
 * @route GET /api/payments
 * @desc Get all payments with pagination
 * @access Admin, Receptionist
 */
router.get(
  '/',
  authorize(ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.PATIENT),
  validate(paymentValidator.getList),
  paymentController.getAllPayments
);

/**
 * @route GET /api/payments/:id
 * @desc Get payment by ID
 * @access Admin, Receptionist
 */
router.get(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.PATIENT),
  validate(paymentValidator.getById),
  paymentController.getPaymentById
);

/**
 * @route POST /api/payments
 * @desc Create new payment
 * @access Admin, Receptionist
 */
router.post(
  '/',
  authorize(ROLES.ADMIN, ROLES.RECEPTIONIST),
  validate(paymentValidator.create),
  paymentController.createPayment
);

/**
 * @route PUT /api/payments/:id
 * @desc Update payment
 * @access Admin, Receptionist
 */
router.put(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.RECEPTIONIST),
  paymentController.updatePayment
);

/**
 * @route DELETE /api/payments/:id
 * @desc Delete payment
 * @access Admin only
 */
router.delete(
  '/:id',
  authorize(ROLES.ADMIN),
  validate(paymentValidator.getById),
  paymentController.deletePayment
);

/**
 * @route POST /api/payments/:id/process
 * @desc Process payment
 * @access Receptionist
 */
router.post(
  '/:id/process',
  authorize(ROLES.ADMIN, ROLES.RECEPTIONIST),
  validate(paymentValidator.process),
  paymentController.processPayment
);

export default router;
