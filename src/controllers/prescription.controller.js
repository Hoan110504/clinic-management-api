/**
 * Prescription Controller
 * Handles prescription operations
 */
import { Op } from 'sequelize';
import { Prescription, Patient, User, MedicalRecord, Medicine, InventoryTransaction } from '../models/index.js';
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

  const { count, rows } = await Prescription.findAndCountAll({
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

      // Create inventory transaction
      await InventoryTransaction.create(
        {
          medicineId: medicine.id,
          medicineName: medicine.name,
          type: INVENTORY_TRANSACTION_TYPES.EXPORT,
          quantity: item.quantity,
          previousQuantity,
          newQuantity,
          reason: `Xuất theo đơn thuốc ${prescription.id}`,
          referenceType: 'Prescription',
          referenceId: prescription.id,
          performedById: req.user.id,
          performedBy: req.user.fullName,
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

export {
  getAllPrescriptions,
  getPrescriptionById,
  createPrescription,
  updatePrescription,
  dispensePrescription,
  deletePrescription,
  getPendingPrescriptions,
};
