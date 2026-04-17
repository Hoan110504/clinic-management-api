/**
 * Prescription Controller
 * Uses canonical Prescriptions schema only. No legacy fallbacks.
 */
import { Op, QueryTypes } from 'sequelize';
import { Prescription, PrescriptionItem, User, Medicine, Patient } from '../models/index.js';
import { sequelize } from '../models/database.js';
import { asyncHandler, parsePagination, parseSort } from '../utils/helpers.js';
import { formatToVietnamISOString } from '../utils/timezone.js';
import { successResponse, createdResponse, paginatedResponse, noContentResponse } from '../utils/response.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { ROLES } from '../config/constants.js';

const mapPrescriptionRow = (r) => {
  if (!r || typeof r !== 'object') return r;
  return {
    id: r.PrescriptionID,
    examinationId: r.ExaminationID,
    doctorId: r.DoctorID,
    prescriptionDate: r.PrescriptionDate ? formatToVietnamISOString(r.PrescriptionDate) : null,
    note: r.Note || null,
    status: r.Status ?? 0,
    createdAt: r.CreatedAt ? formatToVietnamISOString(r.CreatedAt) : null,
    updatedAt: r.UpdatedAt ? formatToVietnamISOString(r.UpdatedAt) : null,
  };
};

const getAllPrescriptions = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { examinationId, doctorId, status, fromDate, toDate, sort } = req.query;

  const where = {};
  if (examinationId) where.ExaminationID = examinationId;
  if (doctorId) where.DoctorID = doctorId;
  if (status !== undefined) where.Status = Number(status);
  if (fromDate && toDate) where.PrescriptionDate = { [Op.between]: [new Date(fromDate), new Date(toDate)] };
  if (req.user && req.user.role === ROLES.DOCTOR) where.DoctorID = req.user.id;

  const order = parseSort(sort, ['PrescriptionDate', 'CreatedAt'], 'PrescriptionDate:desc');

  const { count, rows } = await Prescription.findAndCountAll({ where, order, limit, offset, include: [{ model: User, as: 'doctor', attributes: ['id', 'fullName'], required: false }] });
  const data = (rows || []).map(mapPrescriptionRow);
  return paginatedResponse(res, { data, page, limit, total: count });
});

const getPrescriptionById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const prescription = await Prescription.findOne({ where: { PrescriptionID: id }, include: [{ model: User, as: 'doctor', attributes: ['id', 'fullName'], required: false }, { model: PrescriptionItem, as: 'items', required: false }] });
  if (!prescription) throw new NotFoundError('Không tìm thấy đơn thuốc');
  return successResponse(res, mapPrescriptionRow(prescription));
});

const createPrescription = asyncHandler(async (req, res) => {
  const { examinationId, doctorId, items, note, status = 0 } = req.body;
  if (!examinationId || !doctorId) throw new BadRequestError('ExaminationID và DoctorID là bắt buộc');

  const numExaminationId = Number(examinationId);
  const numDoctorId = Number(doctorId);
  if (!Number.isFinite(numExaminationId) || !Number.isFinite(numDoctorId)) throw new BadRequestError('ExaminationID và DoctorID phải là số');

  const doctor = await User.findByPk(numDoctorId);
  if (!doctor) throw new NotFoundError('Không tìm thấy bác sĩ');

  const examRows = await sequelize.query(`SELECT TOP 1 ExaminationID FROM [dbo].[MedicalExaminations] WHERE ExaminationID = :id`, { replacements: { id: numExaminationId }, type: QueryTypes.SELECT });
  if (!Array.isArray(examRows) || examRows.length === 0) throw new NotFoundError('Không tìm thấy kỳ khám');

  const tx = await sequelize.transaction();
  try {
    const prescription = await Prescription.create({ ExaminationID: numExaminationId, DoctorID: numDoctorId, PrescriptionDate: new Date(), Note: note || null, Status: Number(status) || 0, CreatedAt: new Date(), UpdatedAt: new Date() }, { transaction: tx });

    if (Array.isArray(items) && items.length > 0) {
      for (const it of items) {
        const medicineId = Number(it.medicineId);
        if (!Number.isFinite(medicineId)) throw new BadRequestError('medicineId phải là số');
        const medicine = await Medicine.findByPk(medicineId, { transaction: tx });
        if (!medicine) throw new NotFoundError(`Không tìm thấy thuốc ID ${medicineId}`);
        await PrescriptionItem.create({ PrescriptionID: prescription.PrescriptionID, MedicineId: medicineId, Dosage: it.dosage || null, Frequency: it.frequency || null, Duration: it.duration || null, QuantityPrescribed: Number(it.quantityPrescribed) || 0, Instructions: it.instructions || null, Status: Number(it.status) || 0, CreatedAt: new Date() }, { transaction: tx });
      }
    }

    await tx.commit();
    return createdResponse(res, mapPrescriptionRow(prescription), 'Tạo đơn thuốc thành công');
  } catch (err) {
    try { await tx.rollback(); } catch (e) { /* ignore */ }
    throw err;
  }
});

const updatePrescription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { note, status } = req.body;
  const prescription = await Prescription.findOne({ where: { PrescriptionID: id } });
  if (!prescription) throw new NotFoundError('Không tìm thấy đơn thuốc');
  const updates = {};
  if (note !== undefined) updates.Note = note;
  if (status !== undefined) updates.Status = Number(status);
  updates.UpdatedAt = new Date();
  await prescription.update(updates);
  return successResponse(res, mapPrescriptionRow(prescription), 'Cập nhật đơn thuốc thành công');
});

const deletePrescription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const prescription = await Prescription.findOne({ where: { PrescriptionID: id } });
  if (!prescription) throw new NotFoundError('Không tìm thấy đơn thuốc');
  await PrescriptionItem.destroy({ where: { PrescriptionID: id } });
  await prescription.destroy();
  return noContentResponse(res);
});

const getPrescriptionItems = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const items = await PrescriptionItem.findAll({ where: { PrescriptionID: id }, include: [{ model: Medicine, as: 'medicine', attributes: ['id', 'name', 'unit', 'price'], required: false }] });
  return successResponse(res, items);
});

const createPrescriptionItem = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { medicineId, dosage, frequency, duration, quantityPrescribed, instructions, status = 0 } = req.body;
  const prescription = await Prescription.findOne({ where: { PrescriptionID: id } });
  if (!prescription) throw new NotFoundError('Không tìm thấy đơn thuốc');
  const medicine = await Medicine.findByPk(medicineId);
  if (!medicine) throw new NotFoundError('Không tìm thấy thuốc');
  const item = await PrescriptionItem.create({ PrescriptionID: id, MedicineId: medicineId, Dosage: dosage || null, Frequency: frequency || null, Duration: duration || null, QuantityPrescribed: Number(quantityPrescribed) || 0, Instructions: instructions || null, Status: Number(status) || 0, CreatedAt: new Date() });
  return createdResponse(res, item, 'Thêm thuốc vào đơn thành công');
});

const updatePrescriptionItem = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const { dosage, frequency, duration, quantityPrescribed, instructions, status } = req.body;
  const item = await PrescriptionItem.findByPk(itemId);
  if (!item) throw new NotFoundError('Không tìm thấy mục đơn thuốc');
  const updates = {};
  if (dosage !== undefined) updates.Dosage = dosage;
  if (frequency !== undefined) updates.Frequency = frequency;
  if (duration !== undefined) updates.Duration = duration;
  if (quantityPrescribed !== undefined) updates.QuantityPrescribed = Number(quantityPrescribed);
  if (instructions !== undefined) updates.Instructions = instructions;
  if (status !== undefined) updates.Status = Number(status);
  await item.update(updates);
  return successResponse(res, item, 'Cập nhật mục đơn thuốc thành công');
});

const deletePrescriptionItem = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const item = await PrescriptionItem.findByPk(itemId);
  if (!item) throw new NotFoundError('Không tìm thấy mục đơn thuốc');
  await item.destroy();
  return noContentResponse(res);
});

// --- Additional handlers expected by routes ---
const getPendingPrescriptions = asyncHandler(async (req, res) => {
  const includes = [];
  if (Patient) includes.push({ model: Patient, as: 'patient', attributes: ['id', 'fullName', 'phone'], required: false });
  if (User) includes.push({ model: User, as: 'doctor', attributes: ['id', 'fullName'], required: false });

  const prescriptions = await Prescription.findAll({ where: { Status: { [Op.in]: [0, 1] } }, order: [['PrescriptionDate', 'ASC']], include: includes });
  return successResponse(res, prescriptions);
});

const dispensePrescription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const prescription = await Prescription.findOne({ where: { PrescriptionID: id } });
  if (!prescription) throw new NotFoundError('Không tìm thấy đơn thuốc');
  const cur = Number(prescription.Status ?? 0);
  if (cur === 1) throw new BadRequestError('Đơn thuốc đã được phát');
  if (cur === 2) throw new BadRequestError('Đơn thuốc đã bị hủy');
  await prescription.update({ Status: 1, UpdatedAt: new Date() });
  return successResponse(res, prescription, 'Xác nhận phát thuốc thành công');
});

const confirmPrescription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const prescription = await Prescription.findOne({ where: { PrescriptionID: id } });
  if (!prescription) throw new NotFoundError('Không tìm thấy đơn thuốc');
  // Mark as confirmed (no separate field in canonical schema) — keep status unchanged but update timestamp
  await prescription.update({ UpdatedAt: new Date() });
  return successResponse(res, prescription, 'Xác nhận đơn thuốc thành công');
});

const completePrescription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const prescription = await Prescription.findOne({ where: { PrescriptionID: id } });
  if (!prescription) throw new NotFoundError('Không tìm thấy đơn thuốc');
  await prescription.update({ Status: 1, UpdatedAt: new Date() });
  return successResponse(res, prescription, 'Hoàn tất phát thuốc');
});

const cancelPrescription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const prescription = await Prescription.findOne({ where: { PrescriptionID: id } });
  if (!prescription) throw new NotFoundError('Không tìm thấy đơn thuốc');
  await prescription.update({ Status: 2, UpdatedAt: new Date() });
  return successResponse(res, prescription, 'Hủy đơn thuốc thành công');
});

export {
  getAllPrescriptions,
  getPrescriptionById,
  createPrescription,
  updatePrescription,
  deletePrescription,
  getPrescriptionItems,
  createPrescriptionItem,
  updatePrescriptionItem,
  deletePrescriptionItem,
  getPendingPrescriptions,
  dispensePrescription,
  confirmPrescription,
  completePrescription,
  cancelPrescription,
};
