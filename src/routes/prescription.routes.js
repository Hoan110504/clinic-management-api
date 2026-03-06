/**
 * Prescription Routes
 */
import express from 'express';
import { prescriptionController } from '../controllers/index.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { prescriptionValidator } from '../validators/index.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/prescriptions/pending
 * @desc Get pending prescriptions
 * @access Pharmacist
 */
router.get(
  '/pending',
  authorize(ROLES.ADMIN, ROLES.PHARMACIST),
  prescriptionController.getPendingPrescriptions
);

/**
 * @route GET /api/prescriptions
 * @desc Get all prescriptions with pagination
 * @access Admin, Doctor, Pharmacist
 */
router.get(
  '/',
  authorize(ROLES.ADMIN, ROLES.DOCTOR, ROLES.PHARMACIST, ROLES.PATIENT),
  validate(prescriptionValidator.getList),
  prescriptionController.getAllPrescriptions
);

/**
 * @route GET /api/prescriptions/:id
 * @desc Get prescription by ID
 * @access Admin, Doctor, Pharmacist
 */
router.get(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.DOCTOR, ROLES.PHARMACIST, ROLES.PATIENT),
  validate(prescriptionValidator.getById),
  prescriptionController.getPrescriptionById
);

/**
 * @route POST /api/prescriptions
 * @desc Create new prescription
 * @access Doctor only
 */
router.post(
  '/',
  authorize(ROLES.DOCTOR),
  validate(prescriptionValidator.create),
  prescriptionController.createPrescription
);

/**
 * @route PUT /api/prescriptions/:id
 * @desc Update prescription
 * @access Doctor only
 */
router.put(
  '/:id',
  authorize(ROLES.DOCTOR),
  validate(prescriptionValidator.update),
  prescriptionController.updatePrescription
);

/**
 * @route DELETE /api/prescriptions/:id
 * @desc Delete prescription
 * @access Admin, Doctor
 */
router.delete(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.DOCTOR),
  validate(prescriptionValidator.getById),
  prescriptionController.deletePrescription
);

/**
 * @route POST /api/prescriptions/:id/dispense
 * @desc Dispense prescription
 * @access Pharmacist
 */
router.post(
  '/:id/dispense',
  authorize(ROLES.PHARMACIST),
  validate(prescriptionValidator.dispense),
  prescriptionController.dispensePrescription
);

export default router;
