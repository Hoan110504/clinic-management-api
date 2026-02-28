/**
 * Lab Service Routes
 */
const express = require('express');
const router = express.Router();
const { labTestController } = require('../controllers');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/lab-services
 * @desc Get all lab services
 * @access Admin, Doctor, Lab Tech, Receptionist
 */
router.get(
  '/',
  authorize(ROLES.ADMIN, ROLES.DOCTOR, ROLES.LAB_TECH, ROLES.RECEPTIONIST),
  labTestController.getLabServices
);

/**
 * @route POST /api/lab-services
 * @desc Create new lab service
 * @access Admin only
 */
router.post(
  '/',
  authorize(ROLES.ADMIN),
  labTestController.createLabService
);

/**
 * @route PUT /api/lab-services/:id
 * @desc Update lab service
 * @access Admin only
 */
router.put(
  '/:id',
  authorize(ROLES.ADMIN),
  labTestController.updateLabService
);

module.exports = router;
