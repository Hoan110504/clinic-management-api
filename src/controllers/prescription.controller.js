/**
 * Prescription Controller
 * Handles prescription operations
 */
import { Op } from 'sequelize';
import { Prescription, Patient, User, MedicalRecord, Medicine, InventoryTransaction, DonThuoc } from '../models/index.js';
import { sequelize } from '../models/database.js';
import { asyncHandler, parsePagination, parseSort } from '../utils/helpers.js';
import {
  successResponse,
  createdResponse,
  paginatedResponse,
  noContentResponse,
} from '../utils/response.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { INVENTORY_TRANSACTION_TYPES, ROLES } from '../config/constants.js';

/**
 * Get all prescriptions (with pagination and filters)
 * GET /api/prescriptions
 */
const getAllPrescriptions = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { patientId, doctorId, isDispensed, fromDate, toDate, search, sort } = req.query;

  // Build where clause
  const where = {};

  if (patientId) {
    where.patientId = patientId;
  }

  if (doctorId) {
    where.doctorId = doctorId;
  }

  if (isDispensed !== undefined) {
    where.isDispensed = isDispensed === 'true';
  }

  if (fromDate && toDate) {
    where.prescriptionDate = {
      [Op.between]: [new Date(fromDate), new Date(toDate)],
    };
  }

  if (search) {
    where[Op.or] = [
      { patientName: { [Op.like]: `%${search}%` } },
      { id: { [Op.like]: `%${search}%` } },
    ];
  }

  // Role-based filtering
  if (req.user.role === ROLES.DOCTOR) {
    where.doctorId = req.user.id;
  }

  // Parse sort
  const order = parseSort(sort, ['prescriptionDate', 'createdAt']);

  let count, rows;
  try {
    const result = await Prescription.findAndCountAll({
      where,
      order,
      limit,
      offset,
      include: [
        {
          model: Patient,
          as: 'patient',
          attributes: ['id', 'fullName', 'phone', 'dateOfBirth', 'gender'],
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
    ({ count, rows } = result);
  } catch (err) {
    // Fallback for legacy DB schema where prescriptions table may not exist (use DonThuoc)
    if (err.message && err.message.includes('Invalid object name')) {
      const legacyWhere = {};
      if (where.patientId) legacyWhere.MaBenhNhan = where.patientId;
      if (where.doctorId) legacyWhere.MaBacSi = where.doctorId;
      if (where.isDispensed !== undefined) {
        // map boolean to TrangThai enum where possible
        legacyWhere.TrangThai = where.isDispensed ? DonThuoc?.TRANG_THAI?.DA_CAP_PHAT : DonThuoc?.TRANG_THAI?.CHO_CAP_PHAT;
      }

      const legacyOrder = [['NgayKeDon', 'DESC']];
      const result = await DonThuoc.findAndCountAll({
        where: legacyWhere,
        order: legacyOrder,
        limit,
        offset,
      });
      ({ count, rows } = result);
    } else {
      throw err;
    }
  }

  // If legacy fallback returned an error (e.g., table doesn't exist), ensure we
  // return an empty result instead of propagating a DB error to the client.
  if (!rows) {
    try {
      // Attempt once more to read legacy model; if it fails, return empty set
      const legacyWhere = {};
      if (where.patientId) legacyWhere.MaBenhNhan = where.patientId;
      const result = await DonThuoc.findAndCountAll({ where: legacyWhere, limit, offset });
      ({ count, rows } = result);
    } catch (e) {
      count = 0;
      rows = [];
    }
  }

  return paginatedResponse(res, {
    data: rows,
    page,
    limit,
    total: count,
  });
});

/**
 * Get prescription by ID
 * GET /api/prescriptions/:id
 */
const getPrescriptionById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const prescription = await Prescription.findByPk(id, {
    include: [
      {
        model: Patient,
        as: 'patient',
        required: false,
      },
      {
        model: User,
        as: 'doctor',
        attributes: ['id', 'fullName', 'phone', 'email', 'signature'],
        required: false,
      },
      {
        model: MedicalRecord,
        as: 'medicalRecord',
        required: false,
      },
    ],
  });

  if (!prescription) {
    throw new NotFoundError('Không tìm thấy đơn thuốc');
  }

  return successResponse(res, prescription);
});

/**
 * Create new prescription
 * POST /api/prescriptions
 */
const createPrescription = asyncHandler(async (req, res) => {
  const {
    medicalRecordId,
    patientId,
    patientName,
    items,
    diagnosis,
    notes,
  } = req.body;

  // Get doctor info
  let doctorId = req.body.doctorId;
  let doctorName = req.body.doctorName;

  if (!doctorId && req.user.role === ROLES.DOCTOR) {
    doctorId = req.user.id;
    doctorName = req.user.fullName;
  }

  if (!doctorId) {
    throw new BadRequestError('ID bác sĩ không được để trống');
  }

  // Validate medicine availability
  for (const item of items) {
    const medicine = await Medicine.findByPk(item.medicineId);
    if (!medicine) {
      throw new NotFoundError(`Không tìm thấy thuốc: ${item.medicineName}`);
    }
    if (medicine.quantity < item.quantity) {
      throw new BadRequestError(
        `Thuốc ${medicine.name} không đủ số lượng (còn ${medicine.quantity})`
      );
    }
  }

  const prescription = await Prescription.create({
    medicalRecordId,
    patientId,
    patientName,
    doctorId,
    doctorName,
    prescriptionDate: new Date(),
    items,
    diagnosis,
    notes,
    isDispensed: false,
  });

  return createdResponse(res, prescription, 'Tạo đơn thuốc thành công');
});

/**
 * Update prescription
 * PUT /api/prescriptions/:id
 */
const updatePrescription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const prescription = await Prescription.findByPk(id);
  if (!prescription) {
    throw new NotFoundError('Không tìm thấy đơn thuốc');
  }

  if (prescription.isDispensed) {
    throw new BadRequestError('Không thể cập nhật đơn thuốc đã phát');
  }

  await prescription.update(updateData);

  return successResponse(res, prescription, 'Cập nhật đơn thuốc thành công');
});

/**
 * Dispense prescription (issue medicines)
 * POST /api/prescriptions/:id/dispense
 */
const dispensePrescription = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const prescription = await Prescription.findByPk(id);
  if (!prescription) {
    throw new NotFoundError('Không tìm thấy đơn thuốc');
  }

  if (prescription.isDispensed) {
    throw new BadRequestError('Đơn thuốc đã được phát');
  }

  const transaction = await sequelize.transaction();

  try {
    // Deduct medicine quantities and create inventory transactions
    for (const item of prescription.items) {
      const medicine = await Medicine.findByPk(item.medicineId, { transaction });
      
      if (!medicine) {
        throw new NotFoundError(`Không tìm thấy thuốc: ${item.medicineName}`);
      }

      if (medicine.quantity < item.quantity) {
        throw new BadRequestError(
          `Thuốc ${medicine.name} không đủ số lượng (còn ${medicine.quantity})`
        );
      }

      const previousQuantity = medicine.quantity;
      const newQuantity = previousQuantity - item.quantity;

      // Update medicine quantity
      medicine.quantity = newQuantity;
      await medicine.save({ transaction });

      // Create inventory transaction in legacy table (GiaoDichKho)
      const batch = await sequelize.models.QuanLyLoThuoc.findOne({ where: { MaThuoc: medicine.id }, transaction });
      const mapTypeToLoai = () => 2; // export

      await InventoryTransaction.create(
        {
          MaLoThuoc: batch ? batch.Id : null,
          MaThuoc: medicine.id,  // Add direct medicine ID for easier querying
          LoaiGiaoDich: mapTypeToLoai(),
          SoLuong: item.quantity,
          SoLuongTruoc: previousQuantity,
          SoLuongSau: newQuantity,
          LyDo: `Xuất theo đơn thuốc ${prescription.id}`,
          LoaiThamChieu: 1,
          // Only set MaThamChieu if prescription.id is a GUID; otherwise store in GhiChu
          MaThamChieu: typeof prescription.id === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(prescription.id) ? prescription.id : null,
          NguoiThucHienId: req.user.id,
          GhiChu: typeof prescription.id === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(prescription.id) ? null : `ref:${prescription.id}`,
          // Omit ThoiGianTao to use DB DEFAULT GETDATE() and avoid date conversion issues
        },
        { transaction }
      );
    }

    // Update prescription
    await prescription.update(
      {
        isDispensed: true,
        dispensedAt: new Date(),
        dispensedById: req.user.id,
        dispensedByName: req.user.fullName,
      },
      { transaction }
    );

    await transaction.commit();

    return successResponse(res, prescription, 'Phát thuốc thành công');
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
});

/**
 * Delete prescription (soft delete)
 * DELETE /api/prescriptions/:id
 */
const deletePrescription = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const prescription = await Prescription.findByPk(id);
  if (!prescription) {
    throw new NotFoundError('Không tìm thấy đơn thuốc');
  }

  if (prescription.isDispensed) {
    throw new BadRequestError('Không thể xóa đơn thuốc đã phát');
  }

  await prescription.destroy();

  return noContentResponse(res);
});

/**
 * Get pending prescriptions (not dispensed)
 * GET /api/prescriptions/pending
 */
const getPendingPrescriptions = asyncHandler(async (req, res) => {
  const prescriptions = await Prescription.findAll({
    where: { isDispensed: false },
    order: [['prescriptionDate', 'ASC']],
    include: [
      {
        model: Patient,
        as: 'patient',
        attributes: ['id', 'fullName', 'phone', 'dateOfBirth', 'gender'],
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

  return successResponse(res, prescriptions);
});

/**
 * Confirm prescription (Doctor confirms - status 0 -> 1)
 * POST /api/prescriptions/:id/confirm
 */
const confirmPrescription = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Try to find in Prescription model first, then fallback to DonThuoc
  let prescription = await Prescription.findByPk(id);
  let isDonThuoc = false;

  if (!prescription && DonThuoc) {
    prescription = await DonThuoc.findByPk(id);
    isDonThuoc = true;
  }

  if (!prescription) {
    throw new NotFoundError('Không tìm thấy đơn thuốc');
  }

  // Check current status
  const currentStatus = isDonThuoc ? prescription.TrangThai : prescription.status;
  if (isDonThuoc && currentStatus !== 0) {
    throw new BadRequestError('Chỉ có thể xác nhận đơn thuốc ở trạng thái "Đang kê"');
  }

  if (isDonThuoc) {
    // Update DonThuoc model
    await prescription.update({ TrangThai: 1 }); // CHO_PHAT_THUOC
  } else {
    // Update Prescription model (new one)
    await prescription.update({ status: 1 });
  }

  return successResponse(res, prescription, 'Xác nhận kê đơn thành công');
});

/**
 * Complete prescription (Pharmacist completes dispensing - status 1 -> 2)
 * POST /api/prescriptions/:id/complete
 */
const completePrescription = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Try to find in Prescription model first, then fallback to DonThuoc
  let prescription = await Prescription.findByPk(id);
  let isDonThuoc = false;

  if (!prescription && DonThuoc) {
    prescription = await DonThuoc.findByPk(id);
    isDonThuoc = true;
  }

  if (!prescription) {
    throw new NotFoundError('Không tìm thấy đơn thuốc');
  }

  // Check current status
  const currentStatus = isDonThuoc ? prescription.TrangThai : prescription.status;
  if (isDonThuoc && currentStatus !== 1) {
    throw new BadRequestError('Chỉ có thể hoàn thành đơn thuốc ở trạng thái "Chờ phát thuốc"');
  }

  const updateData = isDonThuoc 
    ? { TrangThai: 2, ThoiGianPhatThuoc: new Date(), NguoiPhatThuocId: req.user.id }
    : { status: 2, completedAt: new Date(), completedById: req.user.id };

  if (isDonThuoc) {
    await prescription.update(updateData);
  } else {
    await prescription.update(updateData);
  }

  return successResponse(res, prescription, 'Xác nhận phát thuốc thành công');
});

/**
 * Cancel prescription (Doctor or Pharmacist cancels - status any -> 3)
 * POST /api/prescriptions/:id/cancel
 */
const cancelPrescription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  // Try to find in Prescription model first, then fallback to DonThuoc
  let prescription = await Prescription.findByPk(id);
  let isDonThuoc = false;

  if (!prescription && DonThuoc) {
    prescription = await DonThuoc.findByPk(id);
    isDonThuoc = true;
  }

  if (!prescription) {
    throw new NotFoundError('Không tìm thấy đơn thuốc');
  }

  // Check current status - cannot cancel if already completed
  const currentStatus = isDonThuoc ? prescription.TrangThai : prescription.status;
  if (isDonThuoc && currentStatus === 2) {
    throw new BadRequestError('Không thể hủy đơn thuốc đã hoàn thành');
  }

  const updateData = isDonThuoc
    ? { TrangThai: 3, GhiChu: reason || '' }
    : { status: 3, cancelReason: reason || '', cancelledAt: new Date(), cancelledById: req.user.id };

  if (isDonThuoc) {
    await prescription.update(updateData);
  } else {
    await prescription.update(updateData);
  }

  return successResponse(res, prescription, 'Hủy đơn thuốc thành công');
});

export {
  getAllPrescriptions,
  getPrescriptionById,
  createPrescription,
  updatePrescription,
  dispensePrescription,
  deletePrescription,
  getPendingPrescriptions,
  confirmPrescription,
  completePrescription,
  cancelPrescription,
};
