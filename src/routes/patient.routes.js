/**
 * Patient Routes
 */
import express from 'express';
import { patientController } from '../controllers/index.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { patientValidator } from '../validators/index.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/patients/search
 * @desc Quick search patients
 * @access Admin, Doctor, Receptionist
 */
router.get(
  '/search',
  authorize(ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST),
  patientController.searchPatients
);

/**
 * @route GET /api/patients
 * @desc Get all patients with pagination
 * @access Admin, Doctor, Receptionist
 */
router.get(
  '/',
  authorize(ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST),
  validate(patientValidator.getList),
  patientController.getAllPatients
);

/**
 * @route GET /api/patients/:id
 * @desc Get patient by ID
 * @access Admin, Doctor, Receptionist
 */
router.get(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST),
  validate(patientValidator.getById),
  patientController.getPatientById
);

/**
 * @route POST /api/patients
 * @desc Create new patient
 * @access Admin, Receptionist
 */
router.post(
  '/',
  authorize(ROLES.ADMIN, ROLES.RECEPTIONIST),
  validate(patientValidator.create),
  patientController.createPatient
);

/**
 * @route PUT /api/patients/:id
 * @desc Update patient
 * @access Admin, Receptionist
 */
router.put(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.RECEPTIONIST),
  validate(patientValidator.update),
  patientController.updatePatient
);

/**
 * @route DELETE /api/patients/:id
 * @desc Delete patient
 * @access Admin only
 */
router.delete(
  '/:id',
  authorize(ROLES.ADMIN),
  validate(patientValidator.getById),
  patientController.deletePatient
);

/**
 * @route GET /api/patients/:id/medical-records
 * @desc Get patient medical records
 * @access Admin, Doctor, Receptionist
 */
router.get(
  '/:id/medical-records',
  authorize(ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST),
  patientController.getPatientMedicalRecords
);

/**
 * @route GET /api/patients/:id/appointments
 * @desc Get patient appointments
 * @access Admin, Doctor, Receptionist
 */
router.get(
  '/:id/appointments',
  authorize(ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST),
  patientController.getPatientAppointments
);

/**
 * @route GET /api/patients/:id/lab-tests
 * @desc Get patient lab tests
 * @access Admin, Doctor, Receptionist
 */
router.get(
  '/:id/lab-tests',
  authorize(ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST),
  patientController.getPatientLabTests
);

/**
 * @route GET /api/patients/:id/payments
 * @desc Get patient payments
 * @access Admin, Receptionist
 */
router.get(
  '/:id/payments',
  authorize(ROLES.ADMIN, ROLES.RECEPTIONIST),
  patientController.getPatientPayments
);

export default router;
