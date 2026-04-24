/**
 * Controller Dashboard
 * Tổng hợp dữ liệu thống kê cho từng vai trò: Admin, Bác sĩ, Tiếp nhận, Dược sĩ, Bệnh nhân
 */
import { Op } from 'sequelize';
import { sequelize } from '../models/database.js';
import {
  User,
  Patient,
  Appointment,
  MedicalRecord,
  Medicine,
  Payment,
  HoaDon,
  LabTest,
  Prescription,
} from '../models/index.js';
import { asyncHandler } from '../utils/helpers.js';
import { successResponse } from '../utils/response.js';
import {
  APPOINTMENT_STATUS,
  MEDICAL_RECORD_STATUS,
  LAB_STATUS,
  ROLES,
} from '../config/constants.js';
import { labelToCode } from '../utils/statusHelpers.js';

const PAYMENT_STATUS_CODE = {
  UNPAID: 0,
  PAID: 1,
};

/**
 * Dashboard Admin - tổng quan toàn hệ thống
 * Thống kê: nhân sự theo role, tổng BN, lịch hẹn hôm nay,
 * doanh thu hôm nay, hóa đơn chờ, thuốc sắp hết, lịch hẹn gần nhất
 * GET /api/dashboard/admin
 */
const getAdminDashboard = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Đếm nhân sự theo vai trò (GROUP BY role)
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

  // Today's revenue and pending payments
  let todayRevenue = 0;
  let pendingPayments = 0;
  // Prefer using the `payments` table only if it exists in the database to avoid
  // MSSQL "Invalid object name 'payments'" errors when the DB uses Vietnamese
  // schema (`HoaDon`) instead.
  try {
    const tables = await sequelize.getQueryInterface().showAllTables();
    const lowerTables = (Array.isArray(tables) ? tables : []).map(t => String(t).toLowerCase());

    if (lowerTables.includes('payments')) {
      // Use English Payment model
      todayRevenue = await Payment.sum('totalAmount', {
        where: {
          invoiceDate: {
            [Op.gte]: today,
            [Op.lt]: tomorrow,
          },
          status: PAYMENT_STATUS_CODE.PAID,
        },
      }) || 0;

      pendingPayments = await Payment.count({ where: { status: PAYMENT_STATUS_CODE.UNPAID } }) || 0;
    } else if (typeof HoaDon !== 'undefined' && HoaDon) {
      // Fallback to Vietnamese HoaDon model
      const paidFlag = HoaDon.TRANG_THAI ? HoaDon.TRANG_THAI.DA_THANH_TOAN : 1;
      const unpaidFlag = HoaDon.TRANG_THAI ? HoaDon.TRANG_THAI.CHUA_THANH_TOAN : 0;

      const sumResult = await HoaDon.sum('ThanhTien', {
        where: {
          NgayTao: {
            [Op.gte]: today,
            [Op.lt]: tomorrow,
          },
          TrangThai: paidFlag,
        },
      });
      todayRevenue = sumResult || 0;

      pendingPayments = await HoaDon.count({ where: { TrangThai: unpaidFlag } }) || 0;
    } else {
      // Neither table/model appears available — leave zeros and log a warning
      console.warn('No payments or HoaDon table/model available for dashboard revenue calculation');
      todayRevenue = 0;
      pendingPayments = 0;
    }
  } catch (err) {
    // If anything unexpected happens while checking tables or querying, log and rethrow
    console.error('Error while calculating todayRevenue/pendingPayments:', err);
    throw err;
  }

  // Thuốc sắp hết: số lượng hiện tại ≤ số lượng tối thiểu (min_quantity)
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
 * Dashboard Bác sĩ - thông tin khám bệnh hôm nay
 * Thống kê: lịch hẹn, BN đã đặt lịch, đang khám, đã xong, XN chờ kết quả
 * Lọc theo doctorId = user đang đăng nhập
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
        [Op.notIn]: [labelToCode(APPOINTMENT_STATUS.CANCELLED) || APPOINTMENT_STATUS.CANCELLED],
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

  // Waiting / in-progress / completed counts (guard in case model isn't loaded)
  let waitingPatients = 0;
  let inProgressCount = 0;
  let completedToday = 0;
  if (typeof MedicalRecord !== 'undefined' && MedicalRecord) {
    waitingPatients = await MedicalRecord.count({
      where: {
        doctorId,
        status: MEDICAL_RECORD_STATUS.WAITING,
        createdAt: {
          [Op.gte]: today,
          [Op.lt]: tomorrow,
        },
      },
    });

    inProgressCount = await MedicalRecord.count({
      where: {
        doctorId,
        status: MEDICAL_RECORD_STATUS.IN_PROGRESS,
        createdAt: {
          [Op.gte]: today,
          [Op.lt]: tomorrow,
        },
      },
    });

    completedToday = await MedicalRecord.count({
      where: {
        doctorId,
        status: MEDICAL_RECORD_STATUS.COMPLETED,
        completedAt: {
          [Op.gte]: today,
          [Op.lt]: tomorrow,
        },
      },
    });
  } else {
    console.warn('MedicalRecord model is not available; doctor dashboard counts set to 0');
  }

  // Pending lab results (guard in case model isn't loaded)
  let pendingLabResults = 0;
  if (typeof LabTest !== 'undefined' && LabTest) {
    pendingLabResults = await LabTest.count({
      where: {
        orderedById: doctorId,
        status: {
          [Op.in]: [LAB_STATUS.PENDING, LAB_STATUS.IN_PROGRESS],
        },
      },
    });
  } else {
    console.warn('LabTest model is not available; pendingLabResults set to 0');
  }

  return successResponse(res, {
    todayAppointments,
    waitingPatients,
    inProgressCount,
    completedToday,
    pendingLabResults,
  });
});

/**
 * Dashboard Tiếp nhận - quản lý lịch hẹn và BN
 * Thống kê: lịch hẹn theo trạng thái, lịch sắp tới, hóa đơn chưa thanh toán, BN mới
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
        [Op.in]: [
          labelToCode(APPOINTMENT_STATUS.SCHEDULED) || APPOINTMENT_STATUS.SCHEDULED,
          labelToCode(APPOINTMENT_STATUS.CONFIRMED) || APPOINTMENT_STATUS.CONFIRMED,
        ],
      },
    },
    order: [['timeSlot', 'ASC']],
    limit: 10,
  });

  // Unpaid payments
  const unpaidPayments = await Payment.findAll({
    where: { status: PAYMENT_STATUS_CODE.UNPAID },
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
 * Dashboard Dược sĩ - quản lý thuốc và đơn
 * Thống kê: đơn chờ phát, thuốc sắp hết, thuốc sắp hết hạn, số đơn phát hôm nay
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
 * Dashboard Bệnh nhân - thông tin cá nhân
 * Trả về: lịch hẹn sắp tới, phiếu khám gần đây, hóa đơn chưa thanh toán, kết quả XN
 * Tìm patient theo userId của user đang đăng nhập
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
        [Op.notIn]: [
          labelToCode(APPOINTMENT_STATUS.CANCELLED) || APPOINTMENT_STATUS.CANCELLED,
          labelToCode(APPOINTMENT_STATUS.COMPLETED) || APPOINTMENT_STATUS.COMPLETED,
        ],
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
      status: PAYMENT_STATUS_CODE.UNPAID,
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

export {
  getAdminDashboard,
  getDoctorDashboard,
  getReceptionistDashboard,
  getPharmacistDashboard,
  getPatientDashboard,
};
