/**
 * Lab Test Routes
 */
const express = require('express');
const router = express.Router();
const { labTestController } = require('../controllers');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { labTestValidator } = require('../validators');
const { ROLES } = require('../config/constants');

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/lab-tests/pending
 * @desc Get pending lab tests
 * @access Admin, Doctor, Lab Tech
 */
router.get(
  '/pending',
  authorize(ROLES.ADMIN, ROLES.DOCTOR, ROLES.LAB_TECH),
  labTestController.getPendingLabTests
);

/**
 * @route GET /api/lab-tests
 * @desc Get all lab tests with pagination
 * @access Admin, Doctor, Lab Tech
 */
router.get(
  '/',
  authorize(ROLES.ADMIN, ROLES.DOCTOR, ROLES.LAB_TECH, ROLES.PATIENT),
  validate(labTestValidator.getList),
  labTestController.getAllLabTests
);

/**
 * @route GET /api/lab-tests/:id
 * @desc Get lab test by ID
 * @access Admin, Doctor, Lab Tech
 */
router.get(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.DOCTOR, ROLES.LAB_TECH, ROLES.PATIENT),
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
 * @access Admin, Doctor, Lab Tech
 */
router.put(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.DOCTOR, ROLES.LAB_TECH),
  validate(labTestValidator.update),
  labTestController.updateLabTest
);

/**
 * @route DELETE /api/lab-tests/:id
 * @desc Delete lab test
 * @access Admin only
 */
router.delete(
  '/:id',
  authorize(ROLES.ADMIN),
  validate(labTestValidator.getById),
  labTestController.deleteLabTest
);

/**
 * @route POST /api/lab-tests/:id/start
 * @desc Start lab test
 * @access Lab Tech
 */
router.post(
  '/:id/start',
  authorize(ROLES.LAB_TECH),
  labTestController.startLabTest
);

/**
 * @route POST /api/lab-tests/:id/complete
 * @desc Complete lab test with results
 * @access Lab Tech
 */
router.post(
  '/:id/complete',
  authorize(ROLES.LAB_TECH),
  labTestController.completeLabTest
);

module.exports = router;
