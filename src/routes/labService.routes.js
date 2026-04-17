/**
 * Lab Service Routes
 */
import express from 'express';
import { labTestController } from '../controllers/index.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/lab-services
 * @desc Get all lab services
 * @access Admin, Doctor, Receptionist
 */
router.get(
  '/',
  authorize(ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST),
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
 * @route GET /api/lab-services/:id
 * @desc Get lab service by ID
 * @access Admin, Doctor, Receptionist
 */
router.get(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST),
  labTestController.getLabServiceById
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

/**
 * @route DELETE /api/lab-services/:id
 * @desc Delete lab service
 * @access Admin only
 */
router.delete(
  '/:id',
  authorize(ROLES.ADMIN),
  labTestController.deleteLabService
);

export default router;
