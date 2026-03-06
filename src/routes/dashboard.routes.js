/**
 * Dashboard Routes
 */
import express from 'express';
import { dashboardController } from '../controllers/index.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/dashboard/admin
 * @desc Get admin dashboard statistics
 * @access Admin only
 */
router.get(
  '/admin',
  authorize(ROLES.ADMIN),
  dashboardController.getAdminDashboard
);

/**
 * @route GET /api/dashboard/doctor
 * @desc Get doctor dashboard
 * @access Doctor only
 */
router.get(
  '/doctor',
  authorize(ROLES.DOCTOR),
  dashboardController.getDoctorDashboard
);

/**
 * @route GET /api/dashboard/receptionist
 * @desc Get receptionist dashboard
 * @access Receptionist only
 */
router.get(
  '/receptionist',
  authorize(ROLES.RECEPTIONIST),
  dashboardController.getReceptionistDashboard
);

/**
 * @route GET /api/dashboard/pharmacist
 * @desc Get pharmacist dashboard
 * @access Pharmacist only
 */
router.get(
  '/pharmacist',
  authorize(ROLES.PHARMACIST),
  dashboardController.getPharmacistDashboard
);

/**
 * @route GET /api/dashboard/patient
 * @desc Get patient dashboard
 * @access Patient only
 */
router.get(
  '/patient',
  authorize(ROLES.PATIENT),
  dashboardController.getPatientDashboard
);

export default router;
