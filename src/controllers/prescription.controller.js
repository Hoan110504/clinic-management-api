/**
 * Prescription Controller
 * Uses canonical Prescriptions schema only. No legacy fallbacks.
 */
import { Op, QueryTypes } from 'sequelize';
import { Prescription, PrescriptionItem, User, Medicine, MedicalExamination, Patient, InventoryTransaction, MedicineBatch } from '../models/index.js';
import { sequelize } from '../models/database.js';
import logger from '../utils/logger.js';
import { asyncHandler, parsePagination, parseSort } from '../utils/helpers.js';
import { formatToVietnamISOString } from '../utils/timezone.js';
import { successResponse, createdResponse, paginatedResponse, noContentResponse } from '../utils/response.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { ROLES } from '../config/constants.js';

const firstDefined = (...values) => values.find((v) => v !== undefined && v !== null);

const toIntOrNull = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const normalizeItemStatus = (value) => {
  const n = toIntOrNull(value);
  if (n === 1) return 1;
  if (n === 2) return 2;
  return 0;
};

const normalizePrescriptionStatus = (value) => {
  const n = toIntOrNull(value);
  if (n === 1) return 1;
  if (n === 2) return 2;
  return 0;
};

const getItemQuantity = (item) => {
  const qty = Number(firstDefined(item?.quantity, item?.quantityPrescribed, item?.QuantityPrescribed, 0));
  return Number.isFinite(qty) ? Math.max(0, Math.trunc(qty)) : 0;
};

const getBatchSelection = (batchSelections, medicineId) => {
  if (!batchSelections || typeof batchSelections !== 'object') return null;
  const key = String(medicineId);
  const value = batchSelections[key];
  if (!value) return null;
  const s = String(value).trim();
  return s || null;
};

const getBatchAllocations = (batchAllocations, medicineId) => {
  if (!batchAllocations || typeof batchAllocations !== 'object') return [];
  const rows = batchAllocations[String(medicineId)];
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => ({
      batchNumber: String(firstDefined(row?.batchNumber, row?.value) || '').trim(),
      quantity: Number(firstDefined(row?.quantity, row?.qty, 0)),
    }))
    .filter((row) => row.batchNumber && Number.isFinite(row.quantity) && row.quantity > 0)
    .map((row) => ({ ...row, quantity: Math.trunc(row.quantity) }));
};

const matchesBatchNumber = (source, target) => {
  const a = String(source || '').trim().toLowerCase();
  const b = String(target || '').trim().toLowerCase();
  return a && b && a === b;
};

const mapPrescriptionItemRow = (item) => {
  if (!item || typeof item !== 'object') return item;
  const plain = item?.get ? item.get({ plain: true }) : item;
  const med = plain.medicine || plain.Medicine || {};

  return {
    id: firstDefined(plain.id, plain.PrescriptionItemID),
    prescriptionId: firstDefined(plain.prescriptionId, plain.PrescriptionID),
    medicineId: firstDefined(plain.medicineId, plain.MedicineId),
    medicineName: firstDefined(plain.medicineName, med.name, med.Name) || null,
    unit: firstDefined(plain.unit, med.unit, med.Unit) || null,
    dosage: firstDefined(plain.dosage, plain.Dosage) || null,
    frequency: firstDefined(plain.frequency, plain.Frequency) || null,
    duration: firstDefined(plain.duration, plain.Duration) || null,
    quantity: firstDefined(plain.quantity, plain.quantityPrescribed, plain.QuantityPrescribed) || 0,
    quantityPrescribed: firstDefined(plain.quantityPrescribed, plain.QuantityPrescribed, plain.quantity) || 0,
    instructions: firstDefined(plain.instructions, plain.Instructions) || null,
    status: normalizeItemStatus(firstDefined(plain.status, plain.Status)),
    createdAt: firstDefined(plain.CreatedAt, plain.createdAt) ? formatToVietnamISOString(firstDefined(plain.CreatedAt, plain.createdAt)) : null,
    medicine: med && Object.keys(med).length > 0 ? {
      id: firstDefined(med.id, med.Id),
      name: firstDefined(med.name, med.Name) || null,
      unit: firstDefined(med.unit, med.Unit) || null,
    } : undefined,
  };
};

const buildPrescriptionIncludes = () => ([
  {
    model: User,
    as: 'doctor',
    attributes: ['id', 'fullName', 'phone'],
    required: false,
  },
  {
    model: MedicalExamination,
    as: 'examination',
    required: false,
    include: [{
      model: Patient,
      as: 'patient',
      attributes: ['id', 'fullName', 'phone', 'gender', 'dateOfBirth'],
      required: false,
    }],
  },
  {
    model: PrescriptionItem,
    as: 'prescriptionItems',
    required: false,
    include: [{
      model: Medicine,
      as: 'medicine',
      attributes: ['id', 'name', 'unit'],
      required: false,
    }],
  },
]);

const mapPrescriptionRow = (r) => {
  if (!r || typeof r !== 'object') return r;
  const plain = r?.get ? r.get({ plain: true }) : r;
  const examination = plain.examination || plain.MedicalExamination || {};
  const patient = examination.patient || examination.Patient || plain.patient || {};
  const doctor = plain.doctor || plain.User || {};
  const associationItems = Array.isArray(plain.prescriptionItems) ? plain.prescriptionItems : [];
  const itemsRaw = associationItems.length > 0
    ? associationItems
    : (Array.isArray(plain.items) ? plain.items : []);
  const mappedItems = itemsRaw.map(mapPrescriptionItemRow);

  const patientId = firstDefined(patient.id, patient.Id, patient.patientId, patient.PatientID, examination.patientId, examination.PatientId);
  const patientName = firstDefined(patient.fullName, patient.full_name, patient.name, plain.patientName, examination.patientName) || null;
  const patientPhone = firstDefined(patient.phone, plain.patientPhone, examination.patientPhone) || null;
  const patientGender = firstDefined(patient.gender, plain.patientGender, examination.patientGender) || null;
  const patientBirthDate = firstDefined(patient.dateOfBirth, plain.patientBirthDate, examination.patientBirthDate) || null;

  return {
    id: firstDefined(plain.prescriptionId, plain.PrescriptionID, plain.id, plain.Id),
    prescriptionId: firstDefined(plain.prescriptionId, plain.PrescriptionID, plain.id, plain.Id),
    examinationId: firstDefined(plain.examinationId, plain.ExaminationID),
    appointmentId: firstDefined(plain.appointmentId, plain.AppointmentID, examination.appointmentId, examination.AppointmentID),
    medicalRecordId: firstDefined(plain.medicalRecordId, plain.MedicalRecordId, plain.recordId, examination.id, examination.ExaminationID),
    patientId,
    patientName,
    patientPhone,
    patientGender,
    patientBirthDate,
    doctorId: firstDefined(plain.doctorId, plain.DoctorID, plain.DoctorId, doctor.id, doctor.Id),
    doctorName: firstDefined(plain.doctorName, plain.DoctorName, doctor.fullName, doctor.full_name, doctor.name) || null,
    prescriptionDate: firstDefined(plain.PrescriptionDate, plain.prescriptionDate) ? formatToVietnamISOString(firstDefined(plain.PrescriptionDate, plain.prescriptionDate)) : null,
    note: firstDefined(plain.Note, plain.note, plain.notes) || null,
    notes: firstDefined(plain.Note, plain.note, plain.notes) || null,
    diagnosis: firstDefined(plain.diagnosis, plain.Diagnosis, examination.diagnosis, examination.Diagnosis) || null,
    status: normalizePrescriptionStatus(firstDefined(plain.Status, plain.status)),
    createdAt: firstDefined(plain.CreatedAt, plain.createdAt) ? formatToVietnamISOString(firstDefined(plain.CreatedAt, plain.createdAt)) : null,
    updatedAt: firstDefined(plain.UpdatedAt, plain.updatedAt) ? formatToVietnamISOString(firstDefined(plain.UpdatedAt, plain.updatedAt)) : null,
    items: mappedItems,
    patient: patientId || patientName || patientPhone ? {
      id: patientId || null,
      fullName: patientName || null,
      phone: patientPhone || null,
      gender: patientGender || null,
      dateOfBirth: patientBirthDate || null,
    } : undefined,
    doctor: doctor && Object.keys(doctor).length > 0 ? {
      id: firstDefined(doctor.id, doctor.Id) || null,
      fullName: firstDefined(doctor.fullName, doctor.full_name, doctor.name) || null,
      phone: firstDefined(doctor.phone, doctor.Phone) || null,
    } : undefined,
  };
};

const getAllPrescriptions = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { examinationId, doctorId, status, fromDate, toDate, sort } = req.query;

  const where = {};
  if (examinationId) where.examinationId = examinationId;
  if (doctorId) where.doctorId = doctorId;
  if (status !== undefined) where.status = Number(status);
  if (fromDate && toDate) where.prescriptionDate = { [Op.between]: [new Date(fromDate), new Date(toDate)] };
  if (req.user && req.user.role === ROLES.DOCTOR) where.doctorId = req.user.id;

  const order = parseSort(sort, ['prescriptionDate', 'createdAt'], 'prescriptionDate:desc');

  const { count, rows } = await Prescription.findAndCountAll({
    where,
    order,
    limit,
    offset,
    distinct: true,
    include: buildPrescriptionIncludes(),
  });
  const data = (rows || []).map(mapPrescriptionRow);
  return paginatedResponse(res, { data, page, limit, total: count });
});

const getPrescriptionById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const prescription = await Prescription.findOne({ where: { prescriptionId: id }, include: buildPrescriptionIncludes() });
  if (!prescription) throw new NotFoundError('Không tìm thấy đơn thuốc');
  return successResponse(res, mapPrescriptionRow(prescription));
});

const createPrescription = asyncHandler(async (req, res) => {
  const { examinationId, medicalRecordId, doctorId, items, note, notes, status = 0 } = req.body;
  const numExaminationId = toIntOrNull(firstDefined(examinationId, medicalRecordId));
  if (!numExaminationId) throw new BadRequestError('ExaminationID là bắt buộc');

  const numDoctorId = toIntOrNull(doctorId) || toIntOrNull(req.user?.id);
  if (!numDoctorId) throw new BadRequestError('DoctorID là bắt buộc');

  const doctor = await User.findByPk(numDoctorId);
  if (!doctor) throw new NotFoundError('Không tìm thấy bác sĩ');

  const examRows = await sequelize.query(`SELECT TOP 1 ExaminationID FROM [dbo].[MedicalExaminations] WHERE ExaminationID = :id`, { replacements: { id: numExaminationId }, type: QueryTypes.SELECT });
  if (!Array.isArray(examRows) || examRows.length === 0) throw new NotFoundError('Không tìm thấy kỳ khám');

  let existing = null;
  if (!PrescriptionItem) {
    logger.error('PrescriptionItem model is not loaded (undefined) before running findOne for existing prescription');
  }
  try {
    existing = await Prescription.findOne({
      where: {
        examinationId: numExaminationId,
      },
      include: [{ model: PrescriptionItem, as: 'prescriptionItems', required: false }],
      order: [['CreatedAt', 'DESC']],
    });
  } catch (err) {
    logger.error('Prescription.findOne (checking existing) failed', { message: err?.message, original: err?.original, sql: err?.sql, stack: err?.stack });
    throw err;
  }
  if (existing && Number(existing.status ?? existing.Status ?? 0) !== 2) {
    return successResponse(res, mapPrescriptionRow(existing), 'Đơn thuốc đã tồn tại');
  }

  const tx = await sequelize.transaction();
  try {
    const prescription = await Prescription.create({
      examinationId: numExaminationId,
      doctorId: numDoctorId,
      prescriptionDate: new Date(),
      notes: firstDefined(note, notes) || null,
      status: normalizePrescriptionStatus(status),
      createdAt: new Date(),
      updatedAt: new Date(),
    }, { transaction: tx });

    if (Array.isArray(items) && items.length > 0) {
      for (const it of items) {
        const medicineId = toIntOrNull(it.medicineId);
        if (!Number.isFinite(medicineId)) throw new BadRequestError('medicineId phải là số');
        const medicine = await Medicine.findByPk(medicineId, { transaction: tx });
        if (!medicine) throw new NotFoundError(`Không tìm thấy thuốc ID ${medicineId}`);
        await PrescriptionItem.create({
          prescriptionId: firstDefined(prescription.prescriptionId, prescription.PrescriptionID, prescription.id, prescription.Id),
          medicineId: medicineId,
          dosage: firstDefined(it.dosage, it.Dosage) || null,
          frequency: firstDefined(it.frequency, it.Frequency) || null,
          duration: firstDefined(it.duration, it.Duration) || null,
          quantityPrescribed: toIntOrNull(firstDefined(it.quantityPrescribed, it.quantity, it.QuantityPrescribed)) || 0,
          instructions: firstDefined(it.instructions, it.Instructions) || null,
          status: normalizeItemStatus(it.status),
          createdAt: new Date(),
        }, { transaction: tx });
      }
    }

    const created = await Prescription.findOne({
      where: { prescriptionId: firstDefined(prescription.prescriptionId, prescription.PrescriptionID, prescription.id, prescription.Id) },
      include: buildPrescriptionIncludes(),
      transaction: tx,
    });

    await tx.commit();
    return createdResponse(res, mapPrescriptionRow(created || prescription), 'Tạo đơn thuốc thành công');
  } catch (err) {
    try { await tx.rollback(); } catch (e) { /* ignore */ }
    throw err;
  }
});

const updatePrescription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { note, notes, status, items } = req.body;
  const prescription = await Prescription.findOne({ where: { prescriptionId: id } });
  if (!prescription) throw new NotFoundError('Không tìm thấy đơn thuốc');

  const tx = await sequelize.transaction();
  try {
    const updates = {};
    if (note !== undefined || notes !== undefined) updates.notes = firstDefined(note, notes);
    if (status !== undefined) updates.status = normalizePrescriptionStatus(status);
    updates.updatedAt = new Date();
    await prescription.update(updates, { transaction: tx });

    if (Array.isArray(items)) {
      const prescriptionPk = firstDefined(prescription.prescriptionId, prescription.PrescriptionID, prescription.id, prescription.Id);
      for (const rawItem of items) {
        const medicineId = toIntOrNull(firstDefined(rawItem?.medicineId, rawItem?.MedicineId));
        if (!medicineId) continue;

        const incomingId = toIntOrNull(firstDefined(rawItem?.id, rawItem?.PrescriptionItemID));
        const quantity = toIntOrNull(firstDefined(rawItem?.quantityPrescribed, rawItem?.quantity, rawItem?.QuantityPrescribed)) || 0;
        const payload = {
          dosage: firstDefined(rawItem?.dosage, rawItem?.Dosage) || null,
          frequency: firstDefined(rawItem?.frequency, rawItem?.Frequency) || null,
          duration: firstDefined(rawItem?.duration, rawItem?.Duration) || null,
          quantityPrescribed: quantity,
          instructions: firstDefined(rawItem?.instructions, rawItem?.Instructions) || null,
          status: normalizeItemStatus(firstDefined(rawItem?.status, rawItem?.Status)),
        };

        let existingItem = null;
        if (incomingId) {
          existingItem = await PrescriptionItem.findOne({
            where: {
              [Op.and]: [
                { [Op.or]: [{ PrescriptionItemID: incomingId }, { id: incomingId }] },
                { prescriptionId: prescriptionPk },
              ],
            },
            transaction: tx,
          });
        }

        if (!existingItem) {
          existingItem = await PrescriptionItem.findOne({
            where: {
              prescriptionId: prescriptionPk,
              medicineId: medicineId,
            },
            order: [['CreatedAt', 'DESC']],
            transaction: tx,
          });
        }

        if (existingItem) {
          await existingItem.update(payload, { transaction: tx });
        } else {
          await PrescriptionItem.create({
            prescriptionId: prescriptionPk,
            medicineId: medicineId,
            ...payload,
            createdAt: new Date(),
          }, { transaction: tx });
        }
      }
    }

    const fresh = await Prescription.findOne({
      where: { prescriptionId: id },
      include: buildPrescriptionIncludes(),
      transaction: tx,
    });

    await tx.commit();
    return successResponse(res, mapPrescriptionRow(fresh || prescription), 'Cập nhật đơn thuốc thành công');
  } catch (err) {
    try { await tx.rollback(); } catch (_e) { /* ignore */ }
    throw err;
  }
});

const deletePrescription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const prescription = await Prescription.findOne({ where: { prescriptionId: id } });
  if (!prescription) throw new NotFoundError('Không tìm thấy đơn thuốc');
  await PrescriptionItem.destroy({ where: { prescriptionId: id } });
  await prescription.destroy();
  return noContentResponse(res);
});

const getPrescriptionItems = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const items = await PrescriptionItem.findAll({ where: { prescriptionId: id }, include: [{ model: Medicine, as: 'medicine', attributes: ['id', 'name', 'unit', 'price'], required: false }] });
  return successResponse(res, items);
});

const createPrescriptionItem = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { medicineId, dosage, frequency, duration, quantityPrescribed, instructions, status = 0 } = req.body;
  const prescription = await Prescription.findOne({ where: { prescriptionId: id } });
  if (!prescription) throw new NotFoundError('Không tìm thấy đơn thuốc');
  const medicine = await Medicine.findByPk(medicineId);
  if (!medicine) throw new NotFoundError('Không tìm thấy thuốc');
  const item = await PrescriptionItem.create({ prescriptionId: id, medicineId: medicineId, dosage: dosage || null, frequency: frequency || null, duration: duration || null, quantityPrescribed: Number(quantityPrescribed) || 0, instructions: instructions || null, status: Number(status) || 0, createdAt: new Date() });
  return createdResponse(res, item, 'Thêm thuốc vào đơn thành công');
});

const updatePrescriptionItem = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const { dosage, frequency, duration, quantityPrescribed, instructions, status } = req.body;
  const item = await PrescriptionItem.findByPk(itemId);
  if (!item) throw new NotFoundError('Không tìm thấy mục đơn thuốc');
  const updates = {};
  if (dosage !== undefined) updates.dosage = dosage;
  if (frequency !== undefined) updates.frequency = frequency;
  if (duration !== undefined) updates.duration = duration;
  if (quantityPrescribed !== undefined) updates.quantityPrescribed = Number(quantityPrescribed);
  if (instructions !== undefined) updates.instructions = instructions;
  if (status !== undefined) updates.status = Number(status);
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
  const prescriptions = await Prescription.findAll({
    where: { status: { [Op.in]: [0, 1] } },
    order: [['prescriptionDate', 'ASC']],
    include: buildPrescriptionIncludes(),
  });
  return successResponse(res, (prescriptions || []).map(mapPrescriptionRow));
});

const dispensePrescription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const prescription = await Prescription.findOne({
    where: { prescriptionId: id },
    include: [{ model: PrescriptionItem, as: 'prescriptionItems', required: false }],
  });
  if (!prescription) throw new NotFoundError('Không tìm thấy đơn thuốc');
  const cur = Number(prescription.status ?? 0);
  if (cur === 1) throw new BadRequestError('Đơn thuốc đã được phát');
  if (cur === 2) throw new BadRequestError('Đơn thuốc đã bị hủy');

  const tx = await sequelize.transaction();
  try {
    const prescriptionItems = Array.isArray(prescription.prescriptionItems) ? prescription.prescriptionItems : [];
    if (prescriptionItems.length === 0) {
      throw new BadRequestError('Đơn thuốc không có thuốc để phát');
    }

    const batchSelections = req.body?.batchSelections && typeof req.body.batchSelections === 'object'
      ? req.body.batchSelections
      : {};
    const batchAllocations = req.body?.batchAllocations && typeof req.body.batchAllocations === 'object'
      ? req.body.batchAllocations
      : {};
    const operatorId = toIntOrNull(req.user?.id);
    const noteText = firstDefined(req.body?.note, req.body?.notes);

    for (const item of prescriptionItems) {
      const medicineId = toIntOrNull(firstDefined(item.medicineId, item.MedicineId));
      const quantity = getItemQuantity(item);
      if (!medicineId || quantity <= 0) continue;

      const allocations = getBatchAllocations(batchAllocations, medicineId);
      if (allocations.length > 0) {
        const totalAllocated = allocations.reduce((sum, row) => sum + row.quantity, 0);
        if (totalAllocated !== quantity) {
          throw new BadRequestError(`Tổng số lượng lô của thuốc ID ${medicineId} không khớp số lượng kê đơn`);
        }

        const medicineBatches = await MedicineBatch.findAll({
          where: { medicineId },
          transaction: tx,
          lock: tx.LOCK.UPDATE,
        });

        for (const row of allocations) {
          const batch = medicineBatches.find((b) => matchesBatchNumber(firstDefined(b.batchNumber, b.BatchNumber), row.batchNumber));
          if (!batch) {
            throw new BadRequestError(`Không tìm thấy lô ${row.batchNumber} của thuốc ID ${medicineId}`);
          }

          const quantityBefore = Number(batch.quantityInStock || 0);
          if (quantityBefore < row.quantity) {
            throw new BadRequestError(`Lô ${row.batchNumber} của thuốc ID ${medicineId} không đủ tồn kho`);
          }

          const quantityAfter = quantityBefore - row.quantity;
          await batch.update(
            {
              quantityInStock: quantityAfter,
              status: quantityAfter > 0 ? 1 : 0,
            },
            { transaction: tx }
          );

          const transactionNote = {
            prescriptionId: String(id),
            prescriptionItemId: String(firstDefined(item.id, item.PrescriptionItemID) || ''),
            batchNumber: firstDefined(batch.batchNumber, batch.BatchNumber) || row.batchNumber,
            ...(noteText ? { note: String(noteText) } : {}),
          };

          await InventoryTransaction.create(
            {
              MedicineBatchId: firstDefined(batch.id, batch.Id),
              MedicineId: medicineId,
              TransactionType: InventoryTransaction?.TRANSACTION_TYPE?.EXPORT || 2,
              Quantity: row.quantity,
              QuantityBefore: quantityBefore,
              QuantityAfter: quantityAfter,
              Reason: 'Phát thuốc theo đơn',
              ReferenceType: InventoryTransaction?.REFERENCE_TYPE?.PRESCRIPTION || 1,
              PerformedByUserId: operatorId,
              CreatedAt: sequelize.literal('GETDATE()'),
              Note: JSON.stringify(transactionNote),
            },
            { transaction: tx }
          );
        }
        continue;
      }

      const selectedBatchNumber = getBatchSelection(batchSelections, medicineId);
      let batch = null;
      if (selectedBatchNumber) {
        const medicineBatches = await MedicineBatch.findAll({
          where: { medicineId },
          transaction: tx,
          lock: tx.LOCK.UPDATE,
        });
        batch = medicineBatches.find((b) => matchesBatchNumber(firstDefined(b.batchNumber, b.BatchNumber), selectedBatchNumber));
      } else {
        batch = await MedicineBatch.findOne({
          where: {
            medicineId,
            quantityInStock: { [Op.gte]: quantity },
          },
          order: [['expiryDate', 'ASC']],
          transaction: tx,
          lock: tx.LOCK.UPDATE,
        });
      }

      if (!batch) {
        throw new BadRequestError(
          selectedBatchNumber
            ? `Lô ${selectedBatchNumber} của thuốc ID ${medicineId} không đủ tồn kho`
            : `Không đủ tồn kho cho thuốc ID ${medicineId}`
        );
      }

      const quantityBefore = Number(batch.quantityInStock || 0);
      if (quantityBefore < quantity) {
        throw new BadRequestError(
          selectedBatchNumber
            ? `Lô ${selectedBatchNumber} của thuốc ID ${medicineId} không đủ tồn kho`
            : `Không đủ tồn kho cho thuốc ID ${medicineId}`
        );
      }

      const quantityAfter = quantityBefore - quantity;
      await batch.update(
        {
          quantityInStock: quantityAfter,
          status: quantityAfter > 0 ? 1 : 0,
        },
        { transaction: tx }
      );

      const transactionNote = {
        prescriptionId: String(id),
        prescriptionItemId: String(firstDefined(item.id, item.PrescriptionItemID) || ''),
        batchNumber: firstDefined(batch.batchNumber, batch.BatchNumber) || selectedBatchNumber || null,
        ...(noteText ? { note: String(noteText) } : {}),
      };

      await InventoryTransaction.create(
        {
          MedicineBatchId: firstDefined(batch.id, batch.Id),
          MedicineId: medicineId,
          TransactionType: InventoryTransaction?.TRANSACTION_TYPE?.EXPORT || 2,
          Quantity: quantity,
          QuantityBefore: quantityBefore,
          QuantityAfter: quantityAfter,
          Reason: 'Phát thuốc theo đơn',
          ReferenceType: InventoryTransaction?.REFERENCE_TYPE?.PRESCRIPTION || 1,
          PerformedByUserId: operatorId,
          CreatedAt: sequelize.literal('GETDATE()'),
          Note: JSON.stringify(transactionNote),
        },
        { transaction: tx }
      );
    }

    const prescriptionPk = firstDefined(prescription.prescriptionId, prescription.PrescriptionID, prescription.id, prescription.Id);
    await prescription.update({ status: 1, updatedAt: new Date() }, { transaction: tx });
    await PrescriptionItem.update({ status: 1 }, { where: { prescriptionId: prescriptionPk }, transaction: tx });

    const fresh = await Prescription.findOne({
      where: { prescriptionId: id },
      include: buildPrescriptionIncludes(),
      transaction: tx,
    });

    await tx.commit();
    return successResponse(res, mapPrescriptionRow(fresh || prescription), 'Xác nhận phát thuốc thành công');
  } catch (err) {
    try { await tx.rollback(); } catch (_e) { /* ignore */ }
    throw err;
  }
});

const confirmPrescription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const prescription = await Prescription.findOne({ where: { prescriptionId: id } });
  if (!prescription) throw new NotFoundError('Không tìm thấy đơn thuốc');
  // Mark as confirmed (no separate field in canonical schema) — keep status unchanged but update timestamp
  await prescription.update({ updatedAt: new Date() });
  return successResponse(res, prescription, 'Xác nhận đơn thuốc thành công');
});

const completePrescription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const prescription = await Prescription.findOne({ where: { prescriptionId: id } });
  if (!prescription) throw new NotFoundError('Không tìm thấy đơn thuốc');
  const tx = await sequelize.transaction();
  try {
    const prescriptionPk = firstDefined(prescription.prescriptionId, prescription.PrescriptionID, prescription.id, prescription.Id);
    await prescription.update({ status: 1, updatedAt: new Date() }, { transaction: tx });
    await PrescriptionItem.update({ status: 1 }, { where: { prescriptionId: prescriptionPk }, transaction: tx });

    const fresh = await Prescription.findOne({
      where: { prescriptionId: id },
      include: buildPrescriptionIncludes(),
      transaction: tx,
    });

    await tx.commit();
    return successResponse(res, mapPrescriptionRow(fresh || prescription), 'Hoàn tất phát thuốc');
  } catch (err) {
    try { await tx.rollback(); } catch (_e) { /* ignore */ }
    throw err;
  }
});

const cancelPrescription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const prescription = await Prescription.findOne({ where: { prescriptionId: id } });
  if (!prescription) throw new NotFoundError('Không tìm thấy đơn thuốc');

  const tx = await sequelize.transaction();
  try {
    const prescriptionPk = firstDefined(prescription.prescriptionId, prescription.PrescriptionID, prescription.id, prescription.Id);
    await prescription.update({ status: 2, updatedAt: new Date() }, { transaction: tx });
    await PrescriptionItem.update({ status: 2 }, { where: { prescriptionId: prescriptionPk }, transaction: tx });

    const fresh = await Prescription.findOne({
      where: { prescriptionId: id },
      include: buildPrescriptionIncludes(),
      transaction: tx,
    });

    await tx.commit();
    return successResponse(res, mapPrescriptionRow(fresh || prescription), 'Hủy đơn thuốc thành công');
  } catch (err) {
    try { await tx.rollback(); } catch (_e) { /* ignore */ }
    throw err;
  }
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
