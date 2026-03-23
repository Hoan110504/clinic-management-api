/**
 * Lab Test Routes
 */
import express from 'express';
import { labTestController } from '../controllers/index.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { labTestValidator } from '../validators/index.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/lab-tests/pending
 * @desc Get pending lab tests
 * @access Admin, Doctor, Receptionist
 */
router.get(
  '/pending',
  authorize(ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST),
  labTestController.getPendingLabTests
);

/**
 * @route GET /api/lab-tests
 * @desc Get all lab tests with pagination
 * @access Admin, Doctor, Receptionist, Patient
 */
router.get(
  '/',
  authorize(ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST, ROLES.PATIENT),
  validate(labTestValidator.getList),
  labTestController.getAllLabTests
);

/**
 * @route GET /api/lab-tests/:id
 * @desc Get lab test by ID
 * @access Admin, Doctor, Receptionist, Patient
 */
router.get(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST, ROLES.PATIENT),
  validate(labTestValidator.getById),
  labTestController.getLabTestById
);

/**
 * @route POST /api/lab-tests
 * @desc Create new lab test
 * @access Admin, Doctor
 */
router.post(
  '/',
  authorize(ROLES.ADMIN, ROLES.DOCTOR),
  validate(labTestValidator.create),
  labTestController.createLabTest
);

/**
 * @route PUT /api/lab-tests/:id
 * @desc Update lab test
 * @access Admin, Doctor
 */
router.put(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.DOCTOR),
  validate(labTestValidator.update),
  labTestController.updateLabTest
);

/**
 * @route DELETE /api/lab-tests/:id
 * @desc Delete lab test
 * @access Admin or Doctor (controller enforces ownership)
 */
router.delete(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.DOCTOR),
  validate(labTestValidator.getById),
  labTestController.deleteLabTest
);

/**
 * @route POST /api/lab-tests/batch-delete
 * @desc Batch delete lab tests by ids
 * @access Admin, Doctor
 */
router.post(
  '/batch-delete',
  authorize(ROLES.ADMIN, ROLES.DOCTOR),
  labTestController.batchDeleteLabTests
);

/**
 * @route POST /api/lab-tests/:id/start
 * @desc Start lab test
 * @access Doctor
 */
router.post(
  '/:id/start',
  authorize(ROLES.DOCTOR),
  labTestController.startLabTest
);

/**
 * @route POST /api/lab-tests/:id/complete
 * @desc Complete lab test with results
 * @access Doctor
 */
router.post(
  '/:id/complete',
  authorize(ROLES.DOCTOR),
  labTestController.completeLabTest
);

/**
 * @route POST /api/lab-tests/:id/return
 * @desc Mark lab test as returned/delivered to patient (doctor action)
 */
router.post(
  '/:id/return',
  authorize(ROLES.DOCTOR),
  labTestController.returnLabTest
);

export default router;
