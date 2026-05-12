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
  PARTIAL: 1,
  PAID: 2,
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
  try {
    // Try using Payment model first - sum paidAmount for PAID payments
    todayRevenue = await Payment.sum('paidAmount', {
      where: {
        invoiceDate: {
          [Op.gte]: today,
          [Op.lt]: tomorrow,
        },
        status: PAYMENT_STATUS_CODE.PAID,
      },
    }) || 0;

    pendingPayments = await Payment.count({ where: { status: PAYMENT_STATUS_CODE.UNPAID } }) || 0;
  } catch (err) {
    console.warn('Could not fetch revenue from Payment model:', err.message);
    // Fallback: set to 0
    todayRevenue = 0;
    pendingPayments = 0;
  }

  // Thuốc sắp hết: số lượng hiện tại ≤ số lượng tối thiểu (min_quantity)
  let lowStockCount = 0;
  try {
    const allMedicines = await Medicine.findAll({
      where: { isActive: true },
      attributes: ['id', 'quantity', 'min_quantity'],
      raw: true,
    });
    // Count in memory: quantity <= min_quantity
    lowStockCount = allMedicines.filter(
      m => m.quantity <= (m.min_quantity || 10)
    ).length;
  } catch (err) {
    console.warn('Could not count low stock medicines:', err.message);
    lowStockCount = 0;
  }

  // Recent appointments: from today to end of current month (exclude past), include patient details, map status
  const monthEnd = new Date();
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  monthEnd.setDate(0);
  monthEnd.setHours(23, 59, 59, 999);

  let recentAppointments = await Appointment.findAll({
    where: {
      appointmentDate: {
        [Op.gte]: today,
        [Op.lte]: monthEnd,
      },
    },
    order: [['appointmentDate', 'ASC'], ['timeSlot', 'ASC']],
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

  // Map status numbers to Vietnamese labels for display
  const statusLabelMap = {
    1: 'Đã đặt lịch',
    2: 'Chờ khám',
    3: 'Đã hoàn thành',
    4: 'Đã hủy',
  };

  recentAppointments = recentAppointments.map((apt) => ({
    ...apt.toJSON(),
    status: statusLabelMap[apt.status] || apt.status,
  }));

  // Chart 1: Lịch hẹn theo tháng (Line Chart)
  let appointmentsByMonth = [];
  try {
    const allAppointments = await Appointment.findAll({
      attributes: ['appointmentDate'],
      raw: true,
    });
    
    const monthMap = {};
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Initialize all months with 0
    months.forEach((month, idx) => {
      monthMap[idx + 1] = { month, count: 0 };
    });
    
    // Count appointments by month
    allAppointments.forEach(a => {
      if (a.appointmentDate) {
        const date = new Date(a.appointmentDate);
        const month = date.getMonth() + 1;
        if (monthMap[month]) {
          monthMap[month].count += 1;
        }
      }
    });
    
    appointmentsByMonth = Object.values(monthMap);
  } catch (err) {
    console.warn('Could not fetch appointments by month:', err.message);
    appointmentsByMonth = [];
  }

  // Chart 2: Doanh thu theo tháng (Bar Chart) - matching Reports page logic
  let revenueByMonth = [];
  try {
    const allPayments = await Payment.findAll({
      attributes: ['invoiceDate', 'paidAmount'],
      where: {
        status: PAYMENT_STATUS_CODE.PAID,
      },
      raw: true,
    });
    
    const monthMap = {};
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Initialize all months with 0
    months.forEach((month, idx) => {
      monthMap[idx + 1] = { month, revenue: 0 };
    });
    
    // Sum revenue by month from paidAmount for paid payments only
    allPayments.forEach(p => {
      if (p.invoiceDate) {
        const date = new Date(p.invoiceDate);
        const month = date.getMonth() + 1;
        if (monthMap[month]) {
          monthMap[month].revenue += Number(p.paidAmount || 0);
        }
      }
    });
    
    revenueByMonth = Object.values(monthMap);
  } catch (err) {
    console.warn('Could not fetch revenue by month:', err.message);
    revenueByMonth = [];
  }

  // Chart 3: Trạng thái lịch hẹn (Doughnut Chart)
  let appointmentStatusDistribution = [];
  try {
    const allAppointments = await Appointment.findAll({
      attributes: ['status'],
      raw: true,
    });
    
    const statusMap = {
      1: { label: 'Đã đặt', count: 0 },
      2: { label: 'Chờ khám', count: 0 },
      3: { label: 'Hoàn thành', count: 0 },
      4: { label: 'Đã hủy', count: 0 },
    };
    
    allAppointments.forEach(a => {
      if (statusMap[a.status] !== undefined) {
        statusMap[a.status].count += 1;
      }
    });
    
    appointmentStatusDistribution = Object.values(statusMap).filter(s => s.count > 0);
  } catch (err) {
    console.warn('Could not fetch appointment status distribution:', err.message);
    appointmentStatusDistribution = [];
  }

  // Chart 4: Trạng thái thanh toán (Doughnut Chart)
  let paymentStatusDistribution = [];
  try {
    const allPayments = await Payment.findAll({
      attributes: ['status'],
      raw: true,
    });
    
    const statusMap = {
      0: { label: 'Chưa thanh toán', count: 0 },
      1: { label: 'Còn nợ', count: 0 },
      2: { label: 'Đã thanh toán', count: 0 },
    };
    
    allPayments.forEach(p => {
      if (statusMap[p.status] !== undefined) {
        statusMap[p.status].count += 1;
      }
    });
    
    paymentStatusDistribution = Object.values(statusMap).filter(s => s.count > 0);
  } catch (err) {
    console.warn('Could not fetch payment status distribution:', err.message);
    paymentStatusDistribution = [];
  }

  return successResponse(res, {
    userCounts,
    totalPatients,
    todayAppointments,
    todayRevenue: todayRevenue || 0,
    pendingPayments,
    lowStockCount,
    recentAppointments,
    appointmentsByMonth,
    revenueByMonth,
    appointmentStatusDistribution,
    paymentStatusDistribution,
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

  // Medical examination statuses for today filtered by doctor
  let waitingPatients = 0;
  let inProgressCount = 0;
  let completedToday = 0;

  try {
    // Get MedicalExamination records for today
    const medicalExams = await sequelize.query(`
      SELECT Status, COUNT(*) as count 
      FROM [dbo].[MedicalExaminations]
      WHERE DoctorID = ? 
        AND CAST([CreatedAt] AS DATE) = CAST(GETDATE() AS DATE)
      GROUP BY Status
    `, {
      replacements: [doctorId],
      type: sequelize.QueryTypes.SELECT,
    });

    // Map status codes to counts
    medicalExams.forEach(exam => {
      if (exam.Status === 0 || exam.Status === '0') {
        waitingPatients = parseInt(exam.count) || 0;
      } else if (exam.Status === 1 || exam.Status === '1') {
        inProgressCount = parseInt(exam.count) || 0;
      } else if (exam.Status === 2 || exam.Status === '2') {
        completedToday = parseInt(exam.count) || 0;
      }
    });
  } catch (err) {
    console.warn('Could not fetch medical examination statuses:', err.message);
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

  // Pending lab order items (LabOrderItems with Status = 0, created today, for this doctor)
  let pendingLabOrderItems = 0;
  try {
    const labOrderItemsCount = await sequelize.query(`
      SELECT COUNT(*) as count
      FROM [dbo].[LabOrderItems] loi
      INNER JOIN [dbo].[LabOrders] lo ON loi.LabOrderID = lo.LabOrderID
      WHERE loi.Status = 0
        AND CAST(loi.[CreatedAt] AS DATE) = CAST(GETDATE() AS DATE)
        AND lo.DoctorID = ?
    `, {
      replacements: [doctorId],
      type: sequelize.QueryTypes.SELECT,
    });
    pendingLabOrderItems = (labOrderItemsCount && labOrderItemsCount[0]) ? parseInt(labOrderItemsCount[0].count) || 0 : 0;
  } catch (err) {
    console.warn('Could not fetch pending lab order items:', err.message);
  }

  return successResponse(res, {
    todayAppointments,
    waitingPatients,
    inProgressCount,
    completedToday,
    pendingLabResults,
    pendingLabOrderItems,
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

  // Upcoming appointments: from today to end of current month (exclude past)
  const monthEnd = new Date();
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  monthEnd.setDate(0);
  monthEnd.setHours(23, 59, 59, 999);

  const upcomingAppointments = await Appointment.findAll({
    where:{
      appointmentDate: {
        [Op.gte]: today,
        [Op.lte]: monthEnd,
      },
      status: {
        [Op.in]: [
          labelToCode(APPOINTMENT_STATUS.SCHEDULED) || APPOINTMENT_STATUS.SCHEDULED,
          labelToCode(APPOINTMENT_STATUS.CONFIRMED) || APPOINTMENT_STATUS.CONFIRMED,
        ],
      },
    },
    order: [['appointmentDate', 'ASC'], ['timeSlot', 'ASC']],
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

  // New patients today - simplified to avoid timestamp issues
  // TODO: Add created_at column to Patients table if needed
  const newPatientsToday = 0;

  // Chart 1: Số lịch hẹn theo tháng (Line Chart)
  let appointmentsByMonth = [];
  try {
    const allAppointments = await Appointment.findAll({
      attributes: ['appointmentDate'],
      raw: true,
    });
    
    const monthMap = {};
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Initialize all months with 0
    months.forEach((month, idx) => {
      monthMap[idx + 1] = { month, count: 0 };
    });
    
    // Count appointments by month
    allAppointments.forEach(a => {
      if (a.appointmentDate) {
        const date = new Date(a.appointmentDate);
        const month = date.getMonth() + 1;
        if (monthMap[month]) {
          monthMap[month].count += 1;
        }
      }
    });
    
    appointmentsByMonth = Object.values(monthMap);
  } catch (err) {
    console.warn('Could not fetch appointments by month:', err.message);
    appointmentsByMonth = [];
  }

  // Chart 2: Trạng thái thanh toán (Doughnut Chart)
  let paymentStatusDistribution = [];
  try {
    // Limit to current month for receptionist overview
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const nextMonth = new Date(monthStart);
    nextMonth.setMonth(monthStart.getMonth() + 1);

    const allPayments = await Payment.findAll({
      attributes: ['status', 'invoiceDate'],
      where: {
        invoiceDate: {
          [Op.gte]: monthStart,
          [Op.lt]: nextMonth,
        },
      },
      raw: true,
    });

    const statusMap = {
      0: { label: 'Chưa thanh toán', count: 0 },
      1: { label: 'Đã thanh toán', count: 0 },
    };

    allPayments.forEach(p => {
      if (statusMap[p.status] !== undefined) {
        statusMap[p.status].count += 1;
      }
    });

    paymentStatusDistribution = Object.values(statusMap).filter(s => s.count > 0);
  } catch (err) {
    console.warn('Could not fetch payment status distribution:', err.message);
    paymentStatusDistribution = [];
  }

  // Chart 3: Trạng thái lịch hẹn (Doughnut Chart) - with corrected status mapping
  let appointmentStatusDistribution = [];
  try {
    // Limit to current month for receptionist overview
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const nextMonth = new Date(monthStart);
    nextMonth.setMonth(monthStart.getMonth() + 1);

    const allAppointments = await Appointment.findAll({
      attributes: ['status', 'appointmentDate'],
      where: {
        appointmentDate: {
          [Op.gte]: monthStart,
          [Op.lt]: nextMonth,
        },
      },
      raw: true,
    });

    const statusMap = {
      1: { label: 'Đã đặt', count: 0 },
      2: { label: 'Chờ khám', count: 0 },
      3: { label: 'Hoàn thành', count: 0 },
      4: { label: 'Đã hủy', count: 0 },
    };

    allAppointments.forEach(a => {
      if (statusMap[a.status] !== undefined) {
        statusMap[a.status].count += 1;
      }
    });

    appointmentStatusDistribution = Object.values(statusMap).filter(s => s.count > 0);
  } catch (err) {
    console.warn('Could not fetch appointment status distribution:', err.message);
    appointmentStatusDistribution = [];
  }

  return successResponse(res, {
    appointmentsByStatus,
    upcomingAppointments,
    unpaidPayments,
    newPatientsToday,
    appointmentsByMonth,
    paymentStatusDistribution,
    appointmentStatusDistribution,
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

  // Pending prescriptions with patient via examination relationship
  const pendingPrescriptions = await Prescription.findAll({
    where: { status: 0 }, // 0 = waiting for dispensing
    order: [['prescriptionDate', 'ASC']],
    limit: 20,
    include: [
      {
        model: User,
        as: 'doctor',
        attributes: ['id', 'fullName'],
        required: false,
      },
      {
        model: sequelize.models.MedicalExamination,
        as: 'examination',
        required: false,
        attributes: ['ExaminationID', 'PatientId'],
        include: [
          {
            model: Patient,
            as: 'patient',
            attributes: ['id', 'fullName', 'phone'],
            required: false,
          },
        ],
      },
    ],
  });

  // Low stock medicines - simplified without column comparison
  let lowStockMedicines = [];
  try {
    lowStockMedicines = await Medicine.findAll({
      where: {
        isActive: true,
      },
      order: [['quantity', 'ASC']],
      limit: 10,
      raw: true,
    });
    // Filter in memory: quantity <= min_quantity
    lowStockMedicines = lowStockMedicines.filter(
      m => m.quantity <= (m.min_quantity || 10)
    );
  } catch (err) {
    console.warn('Could not fetch low stock medicines:', err.message);
    lowStockMedicines = [];
  }

  // Expiring medicines (30 days) - simplified with error handling
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  let expiringMedicines = [];
  try {
    expiringMedicines = await Medicine.findAll({
      where: {
        isActive: true,
      },
      order: [['expiryDate', 'ASC']],
      limit: 10,
      raw: true,
    });
    // Filter in memory: expiryDate between now and 30 days from now
    const now = new Date();
    expiringMedicines = expiringMedicines.filter(
      m => m.expiryDate && new Date(m.expiryDate) <= thirtyDaysFromNow && new Date(m.expiryDate) >= now
    );
  } catch (err) {
    console.warn('Could not fetch expiring medicines:', err.message);
    expiringMedicines = [];
  }

  // Dispensed today - simplified to avoid timestamp issues
  let dispensedToday = 0;
  try {
    dispensedToday = await Prescription.count({
      where: {
        status: 1, // 1 = dispensed
      },
    });
  } catch (err) {
    console.warn('Could not count dispensed prescriptions:', err.message);
    dispensedToday = 0;
  }

  // Chart 1: Số đơn thuốc theo tháng (Bar Chart)
  let prescriptionsByMonth = [];
  try {
    const allPrescriptions = await Prescription.findAll({
      attributes: ['prescriptionDate'],
      where: { status: 1 },
      raw: true,
    });
    
    // Group by month
    const monthMap = {};
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Initialize all months with 0
    months.forEach((month, idx) => {
      monthMap[idx + 1] = { month, count: 0 };
    });
    
    allPrescriptions.forEach(p => {
      if (p.prescriptionDate) {
        const date = new Date(p.prescriptionDate);
        const month = date.getMonth() + 1;
        if (monthMap[month]) {
          monthMap[month].count += 1;
        }
      }
    });
    
    prescriptionsByMonth = Object.values(monthMap);
  } catch (err) {
    console.warn('Could not fetch prescriptions by month:', err.message);
    prescriptionsByMonth = [];
  }

  // Chart 2: Tình trạng tồn kho thuốc theo lô (Doughnut Chart)
  let medicineInventoryStatus = [];
  try {
    const allBatches = await sequelize.models.MedicineBatch.findAll({
      attributes: ['id', 'quantityInStock'],
      raw: true,
    });

    let outOfStock = 0;
    let lowStock = 0;
    let inStock = 0;

    allBatches.forEach((batch) => {
      const stock = Number(batch.quantityInStock ?? 0);
      if (stock === 0) {
        outOfStock += 1;
      } else if (stock > 0 && stock < 20) {
        lowStock += 1;
      } else if (stock >= 20) {
        inStock += 1;
      }
    });
    
    medicineInventoryStatus = [
      { label: 'Hết hàng', value: outOfStock },
      { label: 'Sắp hết hàng', value: lowStock },
      { label: 'Còn hàng', value: inStock },
    ];
  } catch (err) {
    console.warn('Could not fetch medicine inventory status:', err.message);
    medicineInventoryStatus = [];
  }

  // Chart 3: Top 5 thuốc được cấp nhiều nhất (Bar Chart ngang)
  let topMedicinesDispensed = [];
  try {
    const allPrescriptions = await Prescription.findAll({
      attributes: ['prescriptionId'],
      where: { status: 1 },
      include: [
        {
          model: sequelize.models.PrescriptionItem,
          as: 'prescriptionItems',
          required: true,
          where: { status: 1 },
          attributes: ['medicineId', 'quantityPrescribed', 'status'],
          include: [
            {
              model: Medicine,
              as: 'medicine',
              attributes: ['id', 'name'],
              required: false,
            },
          ],
        },
      ],
    });

    const medicineMap = new Map();

    allPrescriptions.forEach((prescription) => {
      const items = Array.isArray(prescription.prescriptionItems) ? prescription.prescriptionItems : [];
      items.forEach((item) => {
        const medicineId = item.medicineId ?? item.MedicineId;
        if (!medicineId) return;

        const quantity = Number(item.quantityPrescribed ?? item.QuantityPrescribed ?? 0);
        const medicineName = item.medicine?.name || item.medicine?.medicineName || item.medicineName || `Thuốc #${medicineId}`;
        const current = medicineMap.get(String(medicineId)) || { label: medicineName, value: 0 };

        current.label = medicineName || current.label;
        current.value += Number.isFinite(quantity) ? quantity : 0;
        medicineMap.set(String(medicineId), current);
      });
    });

    topMedicinesDispensed = Array.from(medicineMap.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  } catch (err) {
    console.warn('Could not fetch top medicines dispensed:', err.message);
    topMedicinesDispensed = [];
  }

  // Chart 4: Trạng thái đơn thuốc (Pie Chart)
  let prescriptionStatusDistribution = [];
  try {
    const allPrescriptions = await Prescription.findAll({
      attributes: ['status'],
      raw: true,
    });
    
    const statusMap = {
      0: { label: 'Chờ phát', count: 0 },
      1: { label: 'Đã phát', count: 0 },
    };
    
    allPrescriptions.forEach(p => {
      if (statusMap[p.status] !== undefined) {
        statusMap[p.status].count += 1;
      }
    });
    
    prescriptionStatusDistribution = Object.values(statusMap).filter(s => s.count > 0);
  } catch (err) {
    console.warn('Could not fetch prescription status distribution:', err.message);
    prescriptionStatusDistribution = [];
  }

  return successResponse(res, {
    pendingPrescriptions,
    lowStockMedicines,
    expiringMedicines,
    dispensedToday,
    prescriptionsByMonth,
    medicineInventoryStatus,
    topMedicinesDispensed,
    prescriptionStatusDistribution,
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

  // Recent medical records - simplified
  let recentRecords = [];
  // MedicalRecord model may not exist in this schema
  if (typeof MedicalRecord !== 'undefined' && MedicalRecord) {
    try {
      recentRecords = await MedicalRecord.findAll({
        where: { patientId },
        limit: 5,
      });
    } catch (err) {
      console.warn('Could not fetch medical records:', err.message);
      recentRecords = [];
    }
  }

  // Pending payments
  const pendingPayments = await Payment.findAll({
    where: {
      patientId,
      status: PAYMENT_STATUS_CODE.UNPAID,
    },
    order: [['createdAt', 'DESC']],
    limit: 5,
  });

  // Recent lab results - simplified
  let recentLabResults = [];
  if (typeof LabTest !== 'undefined' && LabTest) {
    try {
      recentLabResults = await LabTest.findAll({
        where: {
          patientId,
          status: LAB_STATUS.COMPLETED,
        },
        limit: 5,
      });
    } catch (err) {
      console.warn('Could not fetch lab results:', err.message);
      recentLabResults = [];
    }
  }

  // Chart 1: Lịch hẹn theo tháng (Line Chart)
  let appointmentsByMonth = [];
  try {
    const allAppointments = await Appointment.findAll({
      where: { patientId },
      attributes: ['appointmentDate'],
      raw: true,
    });
    
    const monthMap = {};
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    // Initialize all months with 0
    months.forEach((month, idx) => {
      monthMap[idx + 1] = { month, count: 0 };
    });
    
    // Count appointments by month
    allAppointments.forEach(a => {
      if (a.appointmentDate) {
        const date = new Date(a.appointmentDate);
        const month = date.getMonth() + 1;
        if (monthMap[month]) {
          monthMap[month].count += 1;
        }
      }
    });
    
    appointmentsByMonth = Object.values(monthMap);
  } catch (err) {
    console.warn('Could not fetch appointments by month:', err.message);
    appointmentsByMonth = [];
  }

  // Chart 2: Trạng thái lịch hẹn (Doughnut Chart)
  let appointmentStatusDistribution = [];
  try {
    const allAppointments = await Appointment.findAll({
      where: { patientId },
      attributes: ['status'],
      raw: true,
    });
    
    const statusMap = {
      1: { label: 'Đã đặt', count: 0 },
      2: { label: 'Chờ khám', count: 0 },
      3: { label: 'Hoàn thành', count: 0 },
      4: { label: 'Đã hủy', count: 0 },
    };
    
    allAppointments.forEach(a => {
      if (statusMap[a.status] !== undefined) {
        statusMap[a.status].count += 1;
      }
    });
    
    appointmentStatusDistribution = Object.values(statusMap).filter(s => s.count > 0);
  } catch (err) {
    console.warn('Could not fetch appointment status distribution:', err.message);
    appointmentStatusDistribution = [];
  }

  return successResponse(res, {
    patient,
    upcomingAppointments,
    recentRecords,
    pendingPayments,
    recentLabResults,
    appointmentsByMonth,
    appointmentStatusDistribution,
  });
});

export {
  getAdminDashboard,
  getDoctorDashboard,
  getReceptionistDashboard,
  getPharmacistDashboard,
  getPatientDashboard,
};
