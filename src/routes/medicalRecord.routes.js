/**
 * Medical Record Routes
 */
const express = require('express');
const router = express.Router();
const { medicalRecordController } = require('../controllers');
const { authenticate, authorize } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { medicalRecordValidator } = require('../validators');
const { ROLES } = require('../config/constants');

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/medical-records/today-queue
 * @desc Get today's examination queue
 * @access Admin, Doctor, Receptionist
 */
router.get(
  '/today-queue',
  authorize(ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST),
  medicalRecordController.getTodayQueue
);

/**
 * @route GET /api/medical-records
 * @desc Get all medical records with pagination
 * @access Admin, Doctor, Receptionist
 */
router.get(
  '/',
  authorize(ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST, ROLES.PATIENT),
  validate(medicalRecordValidator.getList),
  medicalRecordController.getAllMedicalRecords
);

/**
 * @route GET /api/medical-records/:id
 * @desc Get medical record by ID
 * @access Admin, Doctor, Receptionist
 */
router.get(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST, ROLES.PATIENT),
  validate(medicalRecordValidator.getById),
  medicalRecordController.getMedicalRecordById
);

/**
 * @route POST /api/medical-records
 * @desc Create new medical record
 * @access Admin, Doctor, Receptionist
 */
router.post(
  '/',
  authorize(ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST),
  validate(medicalRecordValidator.create),
  medicalRecordController.createMedicalRecord
);

/**
 * @route PUT /api/medical-records/:id
 * @desc Update medical record
 * @access Admin, Doctor
 */
router.put(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.DOCTOR),
  validate(medicalRecordValidator.update),
  medicalRecordController.updateMedicalRecord
);

/**
 * @route DELETE /api/medical-records/:id
 * @desc Delete medical record
 * @access Admin only
 */
router.delete(
  '/:id',
  authorize(ROLES.ADMIN),
  validate(medicalRecordValidator.getById),
  medicalRecordController.deleteMedicalRecord
);

/**
 * @route POST /api/medical-records/:id/start
 * @desc Start examination
 * @access Doctor only
 */
router.post(
  '/:id/start',
  authorize(ROLES.DOCTOR),
  medicalRecordController.startExamination
);

/**
 * @route POST /api/medical-records/:id/complete
 * @desc Complete examination
 * @access Doctor only
 */
router.post(
  '/:id/complete',
  authorize(ROLES.DOCTOR),
  medicalRecordController.completeExamination
);

module.exports = router;
