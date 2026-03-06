/**
 * Appointment Routes
 */
import express from 'express';
import { appointmentController } from '../controllers/index.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { appointmentValidator } from '../validators/index.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/appointments/today
 * @desc Get today's appointments
 * @access Admin, Doctor, Receptionist
 */
router.get(
  '/today',
  authorize(ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST),
  appointmentController.getTodayAppointments
);

/**
 * @route GET /api/appointments/available-slots
 * @desc Get available time slots
 * @access All authenticated
 */
router.get('/available-slots', appointmentController.getAvailableSlots);

/**
 * @route GET /api/appointments
 * @desc Get all appointments with pagination
 * @access Admin, Doctor, Receptionist
 */
router.get(
  '/',
  authorize(ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST, ROLES.PATIENT),
  validate(appointmentValidator.getList),
  appointmentController.getAllAppointments
);

/**
 * @route GET /api/appointments/:id
 * @desc Get appointment by ID
 * @access Admin, Doctor, Receptionist
 */
router.get(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.DOCTOR, ROLES.RECEPTIONIST, ROLES.PATIENT),
  validate(appointmentValidator.getById),
  appointmentController.getAppointmentById
);

/**
 * @route POST /api/appointments
 * @desc Create new appointment
 * @access Admin, Receptionist, Patient
 */
router.post(
  '/',
  authorize(ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.PATIENT),
  validate(appointmentValidator.create),
  appointmentController.createAppointment
);

/**
 * @route PUT /api/appointments/:id
 * @desc Update appointment
 * @access Admin, Receptionist
 */
router.put(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.RECEPTIONIST),
  validate(appointmentValidator.update),
  appointmentController.updateAppointment
);

/**
 * @route DELETE /api/appointments/:id
 * @desc Delete appointment
 * @access Admin only
 */
router.delete(
  '/:id',
  authorize(ROLES.ADMIN),
  validate(appointmentValidator.getById),
  appointmentController.deleteAppointment
);

/**
 * @route POST /api/appointments/:id/cancel
 * @desc Cancel appointment
 * @access Admin, Receptionist, Patient
 */
router.post(
  '/:id/cancel',
  authorize(ROLES.ADMIN, ROLES.RECEPTIONIST, ROLES.PATIENT),
  validate(appointmentValidator.cancel),
  appointmentController.cancelAppointment
);

/**
 * @route POST /api/appointments/:id/confirm
 * @desc Confirm appointment
 * @access Admin, Receptionist
 */
router.post(
  '/:id/confirm',
  authorize(ROLES.ADMIN, ROLES.RECEPTIONIST),
  appointmentController.confirmAppointment
);

/**
 * @route POST /api/appointments/:id/check-in
 * @desc Check-in appointment
 * @access Admin, Receptionist
 */
router.post(
  '/:id/check-in',
  authorize(ROLES.ADMIN, ROLES.RECEPTIONIST),
  appointmentController.checkInAppointment
);

export default router;
