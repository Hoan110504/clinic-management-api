/**
 * Controller Thanh Toán & Hóa Đơn
 * Quản lý tạo hóa đơn, xử lý thanh toán, thống kê doanh thu
 */
import { Op } from 'sequelize';
import { Payment, Patient, User, MedicalRecord, Prescription } from '../models/index.js';
import { asyncHandler, parsePagination, parseSort } from '../utils/helpers.js';
import {
  successResponse,
  createdResponse,
  paginatedResponse,
  noContentResponse,
} from '../utils/response.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { PAYMENT_STATUS, PAYMENT_TYPES } from '../config/constants.js';

/**
 * Lấy tất cả hóa đơn (có phân trang và lọc)
 * Hỗ trợ lọc: status, type, patientId, fromDate-toDate, search
 * GET /api/payments
 */
const getAllPayments = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { status, type, patientId, fromDate, toDate, search, sort } = req.query;

  // Build where clause
  const where = {};

  if (status) {
    where.status = status;
  }

  if (type) {
    where.type = type;
  }

  if (patientId) {
    where.patientId = patientId;
  }

  if (fromDate && toDate) {
    where.createdAt = {
      [Op.between]: [new Date(fromDate), new Date(toDate)],
    };
  }

  if (search) {
    where[Op.or] = [
      { patientName: { [Op.like]: `%${search}%` } },
      { patientPhone: { [Op.like]: `%${search}%` } },
      { id: { [Op.like]: `%${search}%` } },
    ];
  }

  // Parse sort
  const order = parseSort(sort, ['createdAt', 'total', 'status']);

  const { count, rows } = await Payment.findAndCountAll({
    where,
    order,
    limit,
    offset,
    include: [
      {
        model: Patient,
        as: 'patient',
        attributes: ['id', 'fullName', 'phone'],
        required: false,
      },
      {
        model: User,
        as: 'cashier',
        attributes: ['id', 'fullName'],
        required: false,
      },
    ],
  });

  return paginatedResponse(res, {
    data: rows,
    page,
    limit,
    total: count,
  });
});

/**
 * Get payment by ID
 * GET /api/payments/:id
 */
const getPaymentById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const payment = await Payment.findByPk(id, {
    include: [
      {
        model: Patient,
        as: 'patient',
        required: false,
      },
      {
        model: User,
        as: 'cashier',
        attributes: ['id', 'fullName', 'signature'],
        required: false,
      },
      {
        model: MedicalRecord,
        as: 'medicalRecord',
        required: false,
      },
      {
        model: Prescription,
        as: 'prescription',
        required: false,
      },
    ],
  });

  if (!payment) {
    throw new NotFoundError('Không tìm thấy hóa đơn');
  }

  return successResponse(res, payment);
});

/**
 * Tạo hóa đơn mới
 * Tính toán tự động: subtotal = khám + xét nghiệm + thuốc
 * Giảm giá: hỗ trợ theo % hoặc số tiền cố định
 * total = subtotal - discountAmount
 * POST /api/payments
 */
const createPayment = asyncHandler(async (req, res) => {
  const {
    type,
    patientId,
    patientName,
    patientPhone,
    patientBirthDate,
    patientGender,
    medicalRecordId,
    prescriptionId,
    services,
    medicines,
    consultationFee,
    labTestFee,
    medicineFee,
    discountType,
    discountValue,
    notes,
  } = req.body;

  // Tính tổng phí từ các hạng mục: khám + xét nghiệm + thuốc
  const subTotal =
    parseFloat(consultationFee || 0) +
    parseFloat(labTestFee || 0) +
    parseFloat(medicineFee || 0);

  // Tính giảm giá: 'percent' → % trên subtotal, 'amount' → số tiền cố định
  let discountAmount = 0;
  if (discountType === 'percent') {
    discountAmount = (subTotal * parseFloat(discountValue || 0)) / 100;
  } else if (discountType === 'amount') {
    discountAmount = parseFloat(discountValue || 0);
  }

  const total = subTotal - discountAmount;

  const payment = await Payment.create({
    type: type || PAYMENT_TYPES.MEDICAL_EXAM,
    patientId,
    patientName,
    patientPhone,
    patientBirthDate,
    patientGender,
    medicalRecordId,
    prescriptionId,
    services,
    medicines,
    consultationFee: consultationFee || 0,
    labTestFee: labTestFee || 0,
    medicineFee: medicineFee || 0,
    subtotal: subTotal,
    discountType,
    discountValue,
    discountAmount,
    total,
    amountPaid: 0,
    changeAmount: 0,
    status: PAYMENT_STATUS.UNPAID,
    notes,
  });

  return createdResponse(res, payment, 'Tạo hóa đơn thành công');
});

/**
 * Xử lý thanh toán hóa đơn
 * Kiểm tra: số tiền đưa ≥ tổng hóa đơn, tính tiền thừa trả lại
 * Gắn thông tin thu ngân (cashier) tù user đang đăng nhập
 * POST /api/payments/:id/process
 */
const processPayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { paymentMethod, amountPaid, patientSignature, notes } = req.body;

  const payment = await Payment.findByPk(id);
  if (!payment) {
    throw new NotFoundError('Không tìm thấy hóa đơn');
  }

  if (payment.status === PAYMENT_STATUS.PAID) {
    throw new BadRequestError('Hóa đơn đã được thanh toán');
  }

  // Kiểm tra số tiền đưa phải đủ thanh toán
  const paidAmount = parseFloat(amountPaid);
  if (paidAmount < payment.total) {
    throw new BadRequestError('Số tiền thanh toán không đủ');
  }

  // Tính tiền thừa trả lại bệnh nhân
  const changeAmount = paidAmount - parseFloat(payment.total);

  await payment.update({
    cashierId: req.user.id,
    cashierName: req.user.fullName,
    cashierSignature: req.user.signature,
    paymentMethod,
    amountPaid: paidAmount,
    changeAmount,
    patientSignature,
    status: PAYMENT_STATUS.PAID,
    paidAt: new Date(),
    notes: notes || payment.notes,
  });

  return successResponse(res, payment, 'Thanh toán thành công');
});

/**
 * Cập nhật hóa đơn (chỉ cho phép hóa đơn chưa thanh toán)
 * Tự động tính lại tổng nếu thay đổi các khoản phí hoặc giảm giá
 * PUT /api/payments/:id
 */
const updatePayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const payment = await Payment.findByPk(id);
  if (!payment) {
    throw new NotFoundError('Không tìm thấy hóa đơn');
  }

  if (payment.status === PAYMENT_STATUS.PAID) {
    throw new BadRequestError('Không thể cập nhật hóa đơn đã thanh toán');
  }

  // Tính lại tổng tiền nếu có thay đổi bất kỳ khoản phí nào
  // Dùng nullish coalescing (??) để giữ giá trị cũ nếu không gửi lên
  if (
    updateData.consultationFee !== undefined ||
    updateData.labTestFee !== undefined ||
    updateData.medicineFee !== undefined ||
    updateData.discountType !== undefined ||
    updateData.discountValue !== undefined
  ) {
    const consultationFee = parseFloat(
      updateData.consultationFee ?? payment.consultationFee
    );
    const labTestFee = parseFloat(updateData.labTestFee ?? payment.labTestFee);
    const medicineFee = parseFloat(updateData.medicineFee ?? payment.medicineFee);
    const discountType = updateData.discountType ?? payment.discountType;
    const discountValue = parseFloat(
      updateData.discountValue ?? payment.discountValue
    );

    const subTotal = consultationFee + labTestFee + medicineFee;
    let discountAmount = 0;

    if (discountType === 'percent') {
      discountAmount = (subTotal * discountValue) / 100;
    } else if (discountType === 'amount') {
      discountAmount = discountValue;
    }

    updateData.subtotal = subTotal;
    updateData.discountAmount = discountAmount;
    updateData.total = subTotal - discountAmount;
  }

  await payment.update(updateData);

  return successResponse(res, payment, 'Cập nhật hóa đơn thành công');
});

/**
 * Delete payment (soft delete)
 * DELETE /api/payments/:id
 */
const deletePayment = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const payment = await Payment.findByPk(id);
  if (!payment) {
    throw new NotFoundError('Không tìm thấy hóa đơn');
  }

  if (payment.status === PAYMENT_STATUS.PAID) {
    throw new BadRequestError('Không thể xóa hóa đơn đã thanh toán');
  }

  await payment.destroy();

  return noContentResponse(res);
});

/**
 * Lấy hóa đơn chưa thanh toán - sắp xếp theo thời gian tạo (cũ nhất trước)
 * GET /api/payments/unpaid
 */
const getUnpaidPayments = asyncHandler(async (req, res) => {
  const payments = await Payment.findAll({
    where: { status: PAYMENT_STATUS.UNPAID },
    order: [['createdAt', 'ASC']],
    include: [
      {
        model: Patient,
        as: 'patient',
        attributes: ['id', 'fullName', 'phone'],
        required: false,
      },
    ],
  });

  return successResponse(res, payments);
});

/**
 * Thống kê doanh thu
 * Mặc định: hôm nay. Tùy chỉnh qua query fromDate/toDate
 * Trả về: tổng doanh thu, doanh thu theo loại, số lượng đã thanh toán/chưa
 * GET /api/payments/statistics
 */
const getPaymentStatistics = asyncHandler(async (req, res) => {
  const { fromDate, toDate } = req.query;

  const dateFilter = {};
  if (fromDate && toDate) {
    dateFilter.paidAt = {
      [Op.between]: [new Date(fromDate), new Date(toDate)],
    };
  } else {
    // Default to today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    dateFilter.paidAt = {
      [Op.between]: [today, tomorrow],
    };
  }

  // Total revenue
  const totalRevenue = await Payment.sum('total', {
    where: {
      ...dateFilter,
      status: PAYMENT_STATUS.PAID,
    },
  });

  // Revenue by type
  const revenueByType = await Payment.findAll({
    where: {
      ...dateFilter,
      status: PAYMENT_STATUS.PAID,
    },
    attributes: [
      'type',
      [Payment.sequelize.fn('SUM', Payment.sequelize.col('total')), 'total'],
      [Payment.sequelize.fn('COUNT', Payment.sequelize.col('id')), 'count'],
    ],
    group: ['type'],
  });

  // Paid vs Unpaid count
  const paidCount = await Payment.count({
    where: { ...dateFilter, status: PAYMENT_STATUS.PAID },
  });

  const unpaidCount = await Payment.count({
    where: { status: PAYMENT_STATUS.UNPAID },
  });

  return successResponse(res, {
    totalRevenue: totalRevenue || 0,
    revenueByType,
    paidCount,
    unpaidCount,
  });
});

export {
  getAllPayments,
  getPaymentById,
  createPayment,
  processPayment,
  updatePayment,
  deletePayment,
  getUnpaidPayments,
  getPaymentStatistics,
};
