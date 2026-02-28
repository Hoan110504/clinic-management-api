/**
 * Dashboard Controller
 * Handles dashboard statistics and overview data
 */
const { Op } = require('sequelize');
const {
  User,
  Patient,
  Appointment,
  MedicalRecord,
  Medicine,
  Payment,
  LabTest,
  Prescription,
} = require('../models');
const { asyncHandler } = require('../utils/helpers');
const { successResponse } = require('../utils/response');
const {
  APPOINTMENT_STATUS,
  MEDICAL_RECORD_STATUS,
  PAYMENT_STATUS,
  LAB_STATUS,
  ROLES,
} = require('../config/constants');

/**
 * Get admin dashboard statistics
 * GET /api/dashboard/admin
 */
const getAdminDashboard = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // User counts by role
  const userCounts = await User.findAll({
    attributes: [
      'role',
      [User.sequelize.fn('COUNT', User.sequelize.col('id')), 'count'],
    ],
    where: { isActive: true },
    group: ['role'],
  });

  // Total patients
  const totalPatients = await Patient.count();

  // Today's appointments
  const todayAppointments = await Appointment.count({
    where: {
      appointmentDate: {
        [Op.gte]: today,
        [Op.lt]: tomorrow,
      },
    },
  });

  // Today's revenue
  const todayRevenue = await Payment.sum('total', {
    where: {
      paidAt: {
        [Op.gte]: today,
        [Op.lt]: tomorrow,
      },
      status: PAYMENT_STATUS.PAID,
    },
  });

  // Pending payments
  const pendingPayments = await Payment.count({
    where: { status: PAYMENT_STATUS.UNPAID },
  });

  // Low stock medicines
  const { sequelize } = require('../models/database');
  const lowStockCount = await Medicine.count({
    where: {
      isActive: true,
      quantity: {
        [Op.lte]: sequelize.col('min_quantity'),
      },
    },
  });

  // Recent appointments
  const recentAppointments = await Appointment.findAll({
    where: {
      appointmentDate: {
        [Op.gte]: today,
      },
    },
    order: [['appointmentDate', 'ASC'], ['timeSlot', 'ASC']],
    limit: 10,
  });

  return successResponse(res, {
    userCounts,
    totalPatients,
    todayAppointments,
    todayRevenue: todayRevenue || 0,
    pendingPayments,
    lowStockCount,
    recentAppointments,
  });
});

/**
 * Get doctor dashboard
 * GET /api/dashboard/doctor
 */
const getDoctorDashboard = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const doctorId = req.user.id;

  // Today's appointments
  const todayAppointments = await Appointment.findAll({
    where: {
      assignedDoctorId: doctorId,
      appointmentDate: {
        [Op.gte]: today,
        [Op.lt]: tomorrow,
      },
      status: {
        [Op.notIn]: [APPOINTMENT_STATUS.CANCELLED],
      },
    },
    order: [['timeSlot', 'ASC']],
    include: [
      {
        model: Patient,
        as: 'patient',
        attributes: ['id', 'fullName', 'phone', 'dateOfBirth', 'gender', 'allergies'],
        required: false,
      },
    ],
  });

  // Waiting patients
  const waitingPatients = await MedicalRecord.count({
    where: {
      doctorId,
      status: MEDICAL_RECORD_STATUS.WAITING,
      createdAt: {
        [Op.gte]: today,
        [Op.lt]: tomorrow,
      },
    },
  });

  // In progress
  const inProgressCount = await MedicalRecord.count({
    where: {
      doctorId,
      status: MEDICAL_RECORD_STATUS.IN_PROGRESS,
      createdAt: {
        [Op.gte]: today,
        [Op.lt]: tomorrow,
      },
    },
  });

  // Completed today
  const completedToday = await MedicalRecord.count({
    where: {
      doctorId,
      status: MEDICAL_RECORD_STATUS.COMPLETED,
      completedAt: {
        [Op.gte]: today,
        [Op.lt]: tomorrow,
      },
    },
  });

  // Pending lab results
  const pendingLabResults = await LabTest.count({
    where: {
      orderedById: doctorId,
      status: {
        [Op.in]: [LAB_STATUS.PENDING, LAB_STATUS.IN_PROGRESS],
      },
    },
  });

  return successResponse(res, {
    todayAppointments,
    waitingPatients,
    inProgressCount,
    completedToday,
    pendingLabResults,
  });
});

/**
 * Get receptionist dashboard
 * GET /api/dashboard/receptionist
 */
const getReceptionistDashboard = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Today's appointments by status
  const appointmentsByStatus = await Appointment.findAll({
    attributes: [
      'status',
      [Appointment.sequelize.fn('COUNT', Appointment.sequelize.col('id')), 'count'],
    ],
    where: {
      appointmentDate: {
        [Op.gte]: today,
        [Op.lt]: tomorrow,
      },
    },
    group: ['status'],
  });

  // Upcoming appointments
  const upcomingAppointments = await Appointment.findAll({
    where: {
      appointmentDate: {
        [Op.gte]: today,
        [Op.lt]: tomorrow,
      },
      status: {
        [Op.in]: [APPOINTMENT_STATUS.SCHEDULED, APPOINTMENT_STATUS.CONFIRMED],
      },
    },
    order: [['timeSlot', 'ASC']],
    limit: 10,
  });

  // Unpaid payments
  const unpaidPayments = await Payment.findAll({
    where: { status: PAYMENT_STATUS.UNPAID },
    order: [['createdAt', 'ASC']],
    limit: 10,
    include: [
      {
        model: Patient,
        as: 'patient',
        attributes: ['id', 'fullName', 'phone'],
        required: false,
      },
    ],
  });

  // New patients today
  const newPatientsToday = await Patient.count({
    where: {
      createdAt: {
        [Op.gte]: today,
        [Op.lt]: tomorrow,
      },
    },
  });

  return successResponse(res, {
    appointmentsByStatus,
    upcomingAppointments,
    unpaidPayments,
    newPatientsToday,
  });
});

/**
 * Get pharmacist dashboard
 * GET /api/dashboard/pharmacist
 */
const getPharmacistDashboard = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Pending prescriptions
  const pendingPrescriptions = await Prescription.findAll({
    where: { isDispensed: false },
    order: [['prescriptionDate', 'ASC']],
    limit: 20,
    include: [
      {
        model: Patient,
        as: 'patient',
        attributes: ['id', 'fullName', 'phone'],
        required: false,
      },
      {
        model: User,
        as: 'doctor',
        attributes: ['id', 'fullName'],
        required: false,
      },
    ],
  });

  // Low stock medicines
  const { sequelize } = require('../models/database');
  const lowStockMedicines = await Medicine.findAll({
    where: {
      isActive: true,
      quantity: {
        [Op.lte]: sequelize.col('min_quantity'),
      },
    },
    order: [['quantity', 'ASC']],
    limit: 10,
  });

  // Expiring medicines (30 days)
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  const expiringMedicines = await Medicine.findAll({
    where: {
      isActive: true,
      expiryDate: {
        [Op.lte]: thirtyDaysFromNow,
        [Op.gte]: new Date(),
      },
    },
    order: [['expiryDate', 'ASC']],
    limit: 10,
  });

  // Dispensed today
  const dispensedToday = await Prescription.count({
    where: {
      isDispensed: true,
      dispensedAt: {
        [Op.gte]: today,
        [Op.lt]: tomorrow,
      },
    },
  });

  return successResponse(res, {
    pendingPrescriptions,
    lowStockMedicines,
    expiringMedicines,
    dispensedToday,
  });
});

/**
 * Get patient dashboard
 * GET /api/dashboard/patient
 */
const getPatientDashboard = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Get patient info
  const patient = await Patient.findOne({ where: { userId } });

  if (!patient) {
    return successResponse(res, {
      upcomingAppointments: [],
      recentRecords: [],
      pendingPayments: [],
      recentLabResults: [],
    });
  }

  const patientId = patient.id;

  // Upcoming appointments
  const upcomingAppointments = await Appointment.findAll({
    where: {
      patientId,
      appointmentDate: {
        [Op.gte]: new Date(),
      },
      status: {
        [Op.notIn]: [APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.COMPLETED],
      },
    },
    order: [['appointmentDate', 'ASC'], ['timeSlot', 'ASC']],
    limit: 5,
    include: [
      {
        model: User,
        as: 'assignedDoctor',
        attributes: ['id', 'fullName'],
        required: false,
      },
    ],
  });

  // Recent medical records
  const recentRecords = await MedicalRecord.findAll({
    where: { patientId },
    order: [['createdAt', 'DESC']],
    limit: 5,
    include: [
      {
        model: User,
        as: 'doctor',
        attributes: ['id', 'fullName'],
        required: false,
      },
    ],
  });

  // Pending payments
  const pendingPayments = await Payment.findAll({
    where: {
      patientId,
      status: PAYMENT_STATUS.UNPAID,
    },
    order: [['createdAt', 'DESC']],
    limit: 5,
  });

  // Recent lab results
  const recentLabResults = await LabTest.findAll({
    where: {
      patientId,
      status: LAB_STATUS.COMPLETED,
    },
    order: [['resultDate', 'DESC']],
    limit: 5,
  });

  return successResponse(res, {
    patient,
    upcomingAppointments,
    recentRecords,
    pendingPayments,
    recentLabResults,
  });
});

module.exports = {
  getAdminDashboard,
  getDoctorDashboard,
  getReceptionistDashboard,
  getPharmacistDashboard,
  getPatientDashboard,
};
