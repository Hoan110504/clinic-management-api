/**
 * Prescription Controller
 * Handles prescription operations
 */
import { Op, QueryTypes } from 'sequelize';
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
    prescriptionCode,
  } = req.body;

  // Extract doctor info - ignore status and patientPhone as they're not in model
  let doctorId = req.body.doctorId;
  let doctorName = req.body.doctorName;

  if (!doctorId && req.user && req.user.role === ROLES.DOCTOR) {
    doctorId = req.user.id;
    doctorName = req.user.fullName;
  }

  if (!doctorId) {
    throw new BadRequestError('ID bác sĩ không được để trống');
  }

  // Validate items array exists and not empty
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new BadRequestError('Đơn thuốc phải có ít nhất 1 loại thuốc');
  }

  const sanitizedItems = items.map(item => ({
    medicineId: item.medicineId,
    medicineName: item.medicineName || '',
    unit: item.unit || '',
    price: Number(item.price) || 0,
    dosage: String(item.dosage || ''),
    frequency: String(item.frequency || ''),
    duration: Number(item.duration) || 0,
    quantity: Number(item.quantity) || 0,
    instructions: String(item.instructions || '')
  }));

  // Generate prescription ID from code or create new one
  const prescriptionId = prescriptionCode || `RX-${Date.now()}`;

  // Validate required fields
  if (!medicalRecordId || !patientId || !patientName) {
    throw new BadRequestError('Thiếu thông tin bệnh nhân (medicalRecordId, patientId, patientName)');
  }

  // Validate medicine exists (inventory availability will be checked at dispensing time)
  for (const item of sanitizedItems) {
    const medicine = await Medicine.findByPk(item.medicineId);
    if (!medicine) {
      throw new NotFoundError(`Không tìm thấy thuốc: ${item.medicineName}`);
    }
  }

  try {
    // Ensure prescriptionDate is a valid Date object
    const prescriptionDate = new Date();
    if (isNaN(prescriptionDate.getTime())) {
      throw new BadRequestError('Ngày kê đơn không hợp lệ');
    }

    const payload = {
      id: prescriptionId,
      medicalRecordId: String(medicalRecordId),
      patientId: String(patientId),
      patientName: String(patientName),
      doctorId: String(doctorId),
      doctorName: String(doctorName),
      // omit explicit prescriptionDate so model/DB default (NOW / GETDATE()) is used
      items: sanitizedItems, // Will be JSON.stringify by model setter
      diagnosis: diagnosis ? String(diagnosis) : null,
      notes: notes ? String(notes) : null,
      isDispensed: false,
    };

    // Verbose payload logging to help debug MSSQL date conversion errors
    try {
      const safePayloadString = JSON.stringify(
        payload,
        (key, value) => (value instanceof Date ? value.toISOString() : value),
        2
      );
      console.log('Creating prescription - full payload:', safePayloadString);
      console.log('Sanitized items:', JSON.stringify(sanitizedItems, null, 2));
    } catch (logErr) {
      console.warn('Failed to stringify prescription payload for logging', logErr);
      console.log('Partial payload:', {
        id: payload.id,
        medicalRecordId: payload.medicalRecordId,
        doctorId: payload.doctorId,
        itemsCount: sanitizedItems.length,
      });
    }

    // Use raw INSERT with GETUTCDATE() to avoid MSSQL date-string conversion issues
    await sequelize.query(
      `
      INSERT INTO [dbo].[prescriptions]
        ([id], [medical_record_id], [patient_id], [patient_name], [doctor_id], [doctor_name], [items], [diagnosis], [notes], [is_dispensed], [created_at], [updated_at])
      VALUES
        (:id, :medicalRecordId, :patientId, :patientName, :doctorId, :doctorName, :items, :diagnosis, :notes, :isDispensed, GETUTCDATE(), GETUTCDATE())
      `,
      {
        replacements: {
          id: payload.id,
          medicalRecordId: payload.medicalRecordId,
          patientId: payload.patientId,
          patientName: payload.patientName,
          doctorId: payload.doctorId,
          doctorName: payload.doctorName,
          items: JSON.stringify(payload.items || []),
          diagnosis: payload.diagnosis,
          notes: payload.notes,
          isDispensed: payload.isDispensed ? 1 : 0,
        },
        type: QueryTypes.INSERT,
      }
    );

    const prescription = await Prescription.findByPk(payload.id);

    return createdResponse(res, prescription, 'Tạo đơn thuốc thành công');
  } catch (dbErr) {
    console.error('Database error creating prescription:', {
      error: dbErr.message,
      code: dbErr.code,
      sql: dbErr.sql,
      sequelizeErr: dbErr.original?.message,
      prescriptionId,
      medicalRecordId,
      patientId,
      doctorId
    });
    throw dbErr;
  }
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
    // Merge pharmacist-provided dispense fields with doctor's prescription items.
    // Doctor's `medicineName` and default `quantity` come from the prescription; pharmacist
    // may provide additional fields like `batchId`, `price`, or override `quantity`.
    const dispenseItems = Array.isArray(req.body.dispenseItems) ? req.body.dispenseItems : [];

    const mergedItems = prescription.items.map(pItem => {
      const provided = dispenseItems.find(di => String(di.medicineId) === String(pItem.medicineId)) || {};
      return {
        medicineId: pItem.medicineId,
        // Always prefer doctor's medicineName as source-of-truth for name
        medicineName: pItem.medicineName || provided.medicineName || '',
        // Quantity: pharmacist can override, otherwise use doctor's prescribed quantity
        quantity: Number(provided.quantity ?? pItem.quantity) || 0,
        batchId: provided.batchId || null,
        price: Number(provided.price ?? pItem.price ?? 0) || 0,
        // Any other pharmacist-supplied fields can be added here
      };
    });

    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    const mapTypeToLoai = () => 2; // export

    for (const item of mergedItems) {
      const medicine = await Medicine.findByPk(item.medicineId, { transaction });

      if (!medicine) {
        throw new NotFoundError(`Không tìm thấy thuốc: ${item.medicineName}`);
      }

      const latestTx = await InventoryTransaction.findOne({
        where: { MedicineId: medicine.Id },
        order: [['CreatedAt', 'DESC']],
        transaction,
      });

      const previousQuantity = Number.isFinite(Number(latestTx?.QuantityAfter))
        ? Number(latestTx.QuantityAfter)
        : 0;

      if (previousQuantity < item.quantity) {
        throw new BadRequestError(`Thuốc ${medicine.Name || item.medicineName} không đủ số lượng (còn ${previousQuantity})`);
      }

      const newQuantity = previousQuantity - item.quantity;

      // Create inventory transaction using new schema
      const batch = await sequelize.models.MedicineBatch.findOne({ where: { MedicineId: medicine.Id }, transaction });

      await InventoryTransaction.create(
        {
          MedicineBatchId: item.batchId || (batch ? batch.Id : null),
          MedicineId: medicine.Id,
          TransactionType: mapTypeToLoai(),
          Quantity: item.quantity,
          QuantityBefore: previousQuantity,
          QuantityAfter: newQuantity,
          Reason: `Xuất theo đơn thuốc ${prescription.id}`,
          ReferenceType: 1,
          ReferenceId: typeof prescription.id === 'string' && uuidRegex.test(prescription.id) ? prescription.id : null,
          PerformedByUserId: req.user.id,
          Note: typeof prescription.id === 'string' && uuidRegex.test(prescription.id) ? null : `ref:${prescription.id}`,
          // Omit CreatedAt to use DB DEFAULT GETDATE()
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
