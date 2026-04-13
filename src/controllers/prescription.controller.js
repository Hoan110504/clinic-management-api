/**
 * Prescription Controller
 * Handles prescription operations
 */
import { Op, QueryTypes } from 'sequelize';
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

// Map raw DB rows from various schemas (PascalCase, snake_case, legacy Vietnamese) to
// a consistent API shape expected by the frontend.
const mapRawPrescriptionRow = (r) => {
  if (!r || typeof r !== 'object') return r;
  const safe = (keys) => {
    for (const k of keys) if (r[k] !== undefined) return r[k];
    return undefined;
  };

  const parseItems = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch { return []; }
    }
    return [];
  };

  const statusVal = safe(['Status', 'TrangThai', 'is_dispensed', 'status', 'IsDispensed']);

  const rawDate = safe(['PrescriptionDate', 'prescription_date', 'NgayKeDon', 'CreatedAt', 'created_at']);
  let prescriptionDate = null;
  try {
    if (rawDate instanceof Date) prescriptionDate = rawDate.toISOString();
    else if (typeof rawDate === 'number' && !Number.isNaN(rawDate)) prescriptionDate = new Date(rawDate).toISOString();
    else if (typeof rawDate === 'string' && rawDate.trim()) prescriptionDate = rawDate;
  } catch (e) { prescriptionDate = null; }

  return {
    id: safe(['PrescriptionID', 'PrescriptionId', 'Id', 'id', 'prescriptionid']) || String(safe(['PrescriptionID', 'Id', 'id']) || ''),
    examinationId: safe(['ExaminationID', 'ExaminationId', 'examinationId', 'examination_id']) || null,
    medicalRecordId: safe(['MedicalRecordId', 'medical_record_id', 'MedicalRecordID']) || null,
    patientId: safe(['PatientId', 'PatientID', 'patient_id', 'MaBenhNhan', 'MaBenhNhanID', 'BenhNhanId']) || null,
    patientName: safe(['PatientName', 'patient_name', 'HoTen', 'TenBenhNhan', 'FullName', 'full_name', 'TenBN', 'HoVaTen']) || null,
    doctorId: safe(['DoctorID', 'DoctorId', 'doctor_id', 'MaBacSi', 'BacSiId']) || null,
    doctorName: safe(['DoctorName', 'doctor_name', 'TenBacSi', 'TenBacSiFull']) || null,
    items: parseItems(safe(['Items', 'items', 'ITEMS', 'GhiChi', 'ChiTiet'])),
    prescriptionDate,
    notes: safe(['Note', 'notes', 'GhiChu']) || null,
    diagnosis: safe(['Diagnosis', 'diagnosis', 'ChuanDoan']) || null,
    status: (statusVal === undefined || statusVal === null) ? 0 : Number(statusVal),
    // Preserve original raw row for debugging if needed
    _raw: r,
  };
};

/**
 * Get all prescriptions (with pagination and filters)
 * GET /api/prescriptions
 */
const getAllPrescriptions = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { patientId, doctorId, isDispensed, fromDate, toDate, search, sort } = req.query;

  // Build where clause
  const where = {};

  if (patientId) where.patientId = patientId;
  if (doctorId) where.doctorId = doctorId;
  if (isDispensed !== undefined) where.status = isDispensed === 'true' ? 1 : 0;
  if (fromDate && toDate) where.prescriptionDate = { [Op.between]: [new Date(fromDate), new Date(toDate)] };
  if (search) where[Op.or] = [{ patientName: { [Op.like]: `%${search}%` } }, { id: { [Op.like]: `%${search}%` } }];
  if (req.user.role === ROLES.DOCTOR) where.doctorId = req.user.id;

  const order = parseSort(sort, ['prescriptionDate', 'createdAt']);

  let count = 0; let rows = [];

  try {
    const result = await Prescription.findAndCountAll({ where, order, limit, offset, include: [
      { model: Patient, as: 'patient', attributes: ['id', 'fullName', 'phone', 'dateOfBirth', 'gender'], required: false },
      { model: User, as: 'doctor', attributes: ['id', 'fullName'], required: false },
    ] });
    ({ count, rows } = result);
  } catch (err) {
    // Log for diagnosis
    try { console.error('getAllPrescriptions: findAndCountAll failed', err && (err.original?.message || err.message)); } catch (e) { /* ignore */ }

    // Fallback 1: identity-style Prescriptions table
    try {
      const clauses = []; const replacements = {};
      if (doctorId) { clauses.push('[DoctorID] = :doctorId'); replacements.doctorId = doctorId; }
      if (isDispensed !== undefined) { clauses.push('[Status] = :status'); replacements.status = isDispensed === 'true' ? 1 : 0; }
      if (patientId) { clauses.push('[PatientId] = :patientId'); replacements.patientId = patientId; }
      const whereSql = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const countSql = `SELECT COUNT(*) AS cnt FROM [dbo].[Prescriptions] ${whereSql}`;
      const countRows = await sequelize.query(countSql, { replacements, type: QueryTypes.SELECT });
      count = Number((countRows && countRows[0] && (countRows[0].cnt || countRows[0].CNT)) || 0);
      const rowsSql = `SELECT * FROM [dbo].[Prescriptions] ${whereSql} ORDER BY [PrescriptionDate] DESC OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;
      const rowsRes = await sequelize.query(rowsSql, { replacements: { ...replacements, offset: Number(offset) || 0, limit: Number(limit) || 100 }, type: QueryTypes.SELECT });
      rows = rowsRes || [];
    } catch (e1) {
      // Fallback 2: snake_case legacy
      try {
        const clauses2 = []; const rep2 = {};
        if (doctorId) { clauses2.push('doctor_id = :doctorId'); rep2.doctorId = doctorId; }
        if (isDispensed !== undefined) { clauses2.push('is_dispensed = :isDispensed'); rep2.isDispensed = isDispensed === 'true' ? 1 : 0; }
        if (patientId) { clauses2.push('patient_id = :patientId'); rep2.patientId = patientId; }
        const whereSql2 = clauses2.length ? `WHERE ${clauses2.join(' AND ')}` : '';
        const countSql2 = `SELECT COUNT(*) AS cnt FROM [dbo].[prescriptions] ${whereSql2}`;
        const countRows2 = await sequelize.query(countSql2, { replacements: rep2, type: QueryTypes.SELECT });
        count = Number((countRows2 && countRows2[0] && (countRows2[0].cnt || countRows2[0].CNT)) || 0);
        const rowsSql2 = `SELECT * FROM [dbo].[prescriptions] ${whereSql2} ORDER BY created_at DESC OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;
        const rowsRes2 = await sequelize.query(rowsSql2, { replacements: { ...rep2, offset: Number(offset) || 0, limit: Number(limit) || 100 }, type: QueryTypes.SELECT });
        rows = rowsRes2 || [];
      } catch (e2) {
        // Fallback 3: legacy DonThuoc
        try {
          const legacyTable = '[DonThuoc]'; const clauses3 = []; const replacements3 = {};
          if (patientId) { clauses3.push('MaBenhNhan = :patientId'); replacements3.patientId = patientId; }
          if (doctorId) { clauses3.push('MaBacSi = :doctorId'); replacements3.doctorId = doctorId; }
          if (isDispensed !== undefined) { const trangThai = isDispensed === 'true' ? 1 : 0; clauses3.push('TrangThai = :trangThai'); replacements3.trangThai = trangThai; }
          const whereSql3 = clauses3.length ? `WHERE ${clauses3.join(' AND ')}` : '';
          const orderSql = 'ORDER BY NgayKeDon DESC';
          const countSql3 = `SELECT COUNT(*) AS cnt FROM ${legacyTable} ${whereSql3}`;
          const countRows3 = await sequelize.query(countSql3, { replacements: replacements3, type: QueryTypes.SELECT });
          count = Number((countRows3 && countRows3[0] && (countRows3[0].cnt || countRows3[0].CNT)) || 0);
          const rowsSql3 = `SELECT * FROM ${legacyTable} ${whereSql3} ${orderSql} OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;
          const rowsRes3 = await sequelize.query(rowsSql3, { replacements: { ...replacements3, offset: Number(offset) || 0, limit: Number(limit) || 100 }, type: QueryTypes.SELECT });
          rows = rowsRes3 || [];
        } catch (e3) {
          console.warn('prescription.controller: all fallback attempts failed', { e1: e1 && e1.message, e2: e2 && e2.message, e3: e3 && e3.message });
          throw err;
        }
      }
    }
  }

  // If legacy fallback returned an error (e.g., table doesn't exist), ensure we
  // return an empty result instead of propagating a DB error to the client.
  if (!rows) {
    try {
      // Attempt once more to read legacy table directly; if it fails, return empty set
      const legacyTable = '[DonThuoc]';
      const legacyWhere = where.patientId ? `WHERE MaBenhNhan = :patientId` : '';
      const countSql = `SELECT COUNT(*) AS cnt FROM ${legacyTable} ${legacyWhere}`;
      const countRows = await sequelize.query(countSql, { replacements: { patientId: where.patientId }, type: QueryTypes.SELECT });
      count = (countRows && countRows[0] && (countRows[0].cnt || countRows[0].CNT)) ? Number(countRows[0].cnt || countRows[0].CNT) : 0;
      const rowsSql = `SELECT * FROM ${legacyTable} ${legacyWhere} ORDER BY NgayKeDon DESC OFFSET :offset ROWS FETCH NEXT :limit ROWS ONLY`;
      const rowsRes = await sequelize.query(rowsSql, { replacements: { patientId: where.patientId, offset: Number(offset) || 0, limit: Number(limit) || 100 }, type: QueryTypes.SELECT });
      rows = rowsRes || [];
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

  // ExaminationID may be required by this deployment's Prescriptions schema.
  // Prefer explicit `examinationId` from request body, fallback to medicalRecordId when appropriate.
  const examinationId = req.body.examinationId || medicalRecordId || null;

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

    // Require examinationId for DBs where ExaminationID is NOT NULL
    if (!examinationId) {
      throw new BadRequestError('ExaminationID is required');
    }

    const payload = {
        id: prescriptionId,
        examinationId: String(examinationId),
        medicalRecordId: String(medicalRecordId),
        patientId: String(patientId),
        patientName: String(patientName),
        doctorId: String(doctorId),
        doctorName: String(doctorName),
        // omit explicit prescriptionDate so model/DB default (NOW / GETUTCDATE()) is used
        items: sanitizedItems, // Will be JSON.stringify by model setter
        diagnosis: diagnosis ? String(diagnosis) : null,
        notes: notes ? String(notes) : null,
        status: 0,
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

    // Prefer identity-style Prescriptions table (PrescriptionID auto-increment) first
    try {
      const tx = await sequelize.transaction();
      try {
        const insertSql = `
          INSERT INTO [dbo].[Prescriptions]
            ([ExaminationID], [DoctorID], [PrescriptionDate], [Note], [Status], [CreatedAt], [UpdatedAt])
          OUTPUT INSERTED.PrescriptionID AS InsertedId
          VALUES
            (:examinationId, :doctorId, GETUTCDATE(), :note, :status, GETUTCDATE(), GETUTCDATE())
        `;
        const insertResult = await sequelize.query(insertSql, {
          replacements: {
            examinationId: payload.examinationId || null,
            doctorId: payload.doctorId || null,
            note: payload.notes || null,
            status: payload.status ?? 0,
          },
          type: QueryTypes.INSERT,
          transaction: tx,
        });

        // parse returned inserted id
        let newId = null;
        try {
          const rows = Array.isArray(insertResult) ? insertResult[0] : insertResult;
          if (Array.isArray(rows) && rows.length > 0) {
            newId = rows[0].InsertedId || rows[0].PrescriptionID || rows[0].PrescriptionId || rows[0].insertedid || null;
          }
        } catch (eParse) {
          // ignore
        }

        if (!newId) {
          throw new Error('Failed to obtain inserted PrescriptionID');
        }

        // Insert prescription items into PrescriptionItems table
        for (const it of sanitizedItems) {
          await sequelize.query(
            `INSERT INTO [dbo].[PrescriptionItems] (PrescriptionID, MedicineId, Dosage, Frequency, Duration, QuantityPrescribed, Instructions, CreatedAt)
             VALUES (:prescId, :medicineId, :dosage, :frequency, :duration, :quantity, :instructions, GETUTCDATE())`,
            {
              replacements: {
                prescId: newId,
                medicineId: it.medicineId,
                dosage: it.dosage || null,
                frequency: it.frequency || null,
                duration: it.duration || null,
                quantity: Number(it.quantity) || 0,
                instructions: it.instructions || null,
              },
              type: QueryTypes.INSERT,
              transaction: tx,
            }
          );
        }

        await tx.commit();

        const rows = await sequelize.query(`SELECT TOP 1 * FROM [dbo].[Prescriptions] WHERE PrescriptionID = :id`, {
          replacements: { id: newId },
          type: QueryTypes.SELECT,
        });

        return createdResponse(res, rows && rows[0] ? rows[0] : { PrescriptionID: newId }, 'Tạo đơn thuốc thành công');
      } catch (eIdentity) {
        if (tx && typeof tx.rollback === 'function') {
          try { await tx.rollback(); } catch (rbErr) { console.warn('rollback failed', rbErr && rbErr.message); }
        }
        throw eIdentity;
      }
    } catch (firstErr) {
      // If identity-table insert fails, fallback to PascalCase Id table then legacy snake_case
      console.warn('prescription.create: identity insert failed, falling back', firstErr && (firstErr.original?.message || firstErr.message || firstErr));
      try {
        await sequelize.query(
          `
          INSERT INTO [dbo].[Prescriptions]
            ([Id], [ExaminationID], [MedicalRecordId], [PatientId], [PatientName], [DoctorId], [DoctorName], [Items], [Diagnosis], [Note], [Status], [CreatedAt], [UpdatedAt])
          VALUES
            (:id, :examinationId, :medicalRecordId, :patientId, :patientName, :doctorId, :doctorName, :items, :diagnosis, :note, :status, GETUTCDATE(), GETUTCDATE())
          `,
          {
            replacements: {
              id: payload.id,
              examinationId: payload.examinationId || null,
              medicalRecordId: payload.medicalRecordId,
              patientId: payload.patientId,
              patientName: payload.patientName,
              doctorId: payload.doctorId,
              doctorName: payload.doctorName,
              items: JSON.stringify(payload.items || []),
              diagnosis: payload.diagnosis,
              note: payload.notes,
              status: payload.status ?? 0,
            },
            type: QueryTypes.INSERT,
          }
        );
      } catch (secondErr) {
        console.error('prescription.create: PascalCase insert failed, trying legacy snake_case', secondErr && (secondErr.original?.message || secondErr.message || secondErr));
        try {
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
                isDispensed: 0,
              },
              type: QueryTypes.INSERT,
            }
          );
        } catch (thirdErr) {
          console.error('prescription.create: all insert attempts failed', {
            first: firstErr && (firstErr.original?.message || firstErr.message),
            second: secondErr && (secondErr.original?.message || secondErr.message),
            third: thirdErr && (thirdErr.original?.message || thirdErr.message),
          });
          const errMsg = thirdErr.original?.message || thirdErr.message || 'Unknown DB error';
          throw Object.assign(new Error(errMsg), { code: 'DATABASE_ERROR' });
        }
      }
    }

    // Load created prescription using model if possible
    let prescription = null;
    try {
      prescription = await Prescription.findOne({ where: { id: payload.id } });
    } catch (eFind) {
      // ignore
    }

    return createdResponse(res, prescription || { id: payload.id }, 'Tạo đơn thuốc thành công');
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

  // Cannot update if status is 1 (dispensed) or 2 (cancelled)
  if (prescription.status === 1 || prescription.status === 2) {
    throw new BadRequestError('Không thể cập nhật đơn thuốc đã phát hoặc đã hủy');
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

  const currentStatus = Number(prescription.status);
  if (currentStatus === 1) {
    throw new BadRequestError('Không thể phát thuốc - đơn thuốc đã được phát');
  }
  if (currentStatus === 2) {
    throw new BadRequestError('Không thể phát thuốc - đơn thuốc đã bị hủy');
  }
  if (currentStatus !== 0) {
    throw new BadRequestError('Không thể phát thuốc - trạng thái đơn thuốc không hợp lệ');
  }

  const transaction = await sequelize.transaction();

  try {
    // Dispense items from prescription
    const dispenseItems = Array.isArray(req.body.dispenseItems) ? req.body.dispenseItems : [];

    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    const mapTypeToLoai = () => 2; // export

    // Get prescription items with details (if storing separately in PrescriptionItem table)
    let itemsToProcess = [];
    try {
      const prescriptionItems = await sequelize.models.PrescriptionItem?.findAll({
        where: { prescriptionId: id },
        transaction
      });
      itemsToProcess = prescriptionItems && prescriptionItems.length > 0 
        ? prescriptionItems.map(pi => ({
            medicineId: pi.medicineId,
            quantityPrescribed: pi.quantityPrescribed,
          }))
        : dispenseItems;
    } catch (e) {
      // Fallback if PrescriptionItem table doesn't exist
      itemsToProcess = dispenseItems;
    }

    for (const item of itemsToProcess) {
      const medicine = await Medicine.findByPk(item.medicineId, { transaction });

      if (!medicine) {
        throw new NotFoundError(`Không tìm thấy thuốc: ID ${item.medicineId}`);
      }

      const latestTx = await InventoryTransaction.findOne({
        where: { MedicineId: medicine.Id },
        order: [['CreatedAt', 'DESC']],
        transaction,
      });

      const previousQuantity = Number.isFinite(Number(latestTx?.QuantityAfter))
        ? Number(latestTx.QuantityAfter)
        : 0;

      const quantity = Number(item.quantityPrescribed || item.quantity || 0);
      if (previousQuantity < quantity) {
        throw new BadRequestError(`Thuốc ${medicine.Name} không đủ số lượng (còn ${previousQuantity})`);
      }

      const newQuantity = previousQuantity - quantity;

      // Create inventory transaction
      const batch = await sequelize.models.MedicineBatch?.findOne({ where: { MedicineId: medicine.Id }, transaction });

      await InventoryTransaction.create(
        {
          MedicineBatchId: batch ? batch.Id : null,
          MedicineId: medicine.Id,
          TransactionType: mapTypeToLoai(),
          Quantity: quantity,
          QuantityBefore: previousQuantity,
          QuantityAfter: newQuantity,
          Reason: `Xuất theo đơn thuốc ${prescription.id}`,
          ReferenceType: 1,
          ReferenceId: typeof prescription.id === 'string' && uuidRegex.test(prescription.id) ? prescription.id : null,
          PerformedByUserId: req.user.id,
          Note: typeof prescription.id === 'string' && uuidRegex.test(prescription.id) ? null : `ref:${prescription.id}`,
        },
        { transaction }
      );
    }

    // Update prescription status to 1 (dispensed)
    await prescription.update(
      { status: 1 },
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
 * Get pending prescriptions (status 0 = waiting for dispensing)
 * GET /api/prescriptions/pending
 */
const getPendingPrescriptions = asyncHandler(async (req, res) => {
  try {
    const prescriptions = await Prescription.findAll({
      where: { status: 0 },  // Status 0 = Chờ phát thuốc (Waiting for dispensing)
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

    try {
      // Log a small sample to help diagnose missing patient fields
      if (Array.isArray(prescriptions) && prescriptions.length > 0) {
        const sample = prescriptions[0];
        console.debug('getPendingPrescriptions: model result sample', JSON.stringify({ id: sample.id, patient: sample.patient ? { id: sample.patient.id, fullName: sample.patient.fullName, phone: sample.patient.phone } : null, prescriptionDate: sample.prescriptionDate }, null, 2));
      } else {
        console.debug('getPendingPrescriptions: model result empty');
      }
    } catch (logSampleErr) { /* ignore logging errors */ }

    return successResponse(res, prescriptions);
  } catch (err) {
    // Add structured logging to help diagnose DB/schema issues
    try {
      console.error('getPendingPrescriptions: database error', {
        message: err?.message,
        original: err?.original?.message,
        code: err?.code,
        sql: err?.sql,
      });
    } catch (logErr) {
      console.error('getPendingPrescriptions: failed to log original error', logErr && logErr.message);
    }
    // Try legacy fallbacks for deployments with different schemas
    const fallbackErrors = [];
    try {
      // Try PascalCase identity-style table (simple: no joins, enrichment via model)
      const rows1 = await sequelize.query(
        `SELECT TOP 200 * FROM [dbo].[Prescriptions] WHERE [Status] = 0 ORDER BY [PrescriptionDate] ASC`,
        { type: QueryTypes.SELECT }
      );
      if (Array.isArray(rows1) && rows1.length > 0) {
        const enriched = await Promise.all(rows1.map(async (r) => {
          const mapped = mapRawPrescriptionRow(r);
          try {
            // Enrich with patient data by looking up via model
            if (mapped.examinationId) {
              try {
                const me = await sequelize.query(
                  `SELECT TOP 1 PatientID, ExaminationID FROM [dbo].[MedicalExaminations] WHERE ExaminationID = :examId`,
                  { replacements: { examId: mapped.examinationId }, type: QueryTypes.SELECT }
                );
                if (me && me.length > 0 && me[0].PatientID) {
                  const p = await Patient.findOne({ where: { id: me[0].PatientID } }).catch(() => null);
                  if (p) {
                    mapped.patient = { id: p.id, fullName: p.fullName, phone: p.phone, dateOfBirth: p.dateOfBirth, gender: p.gender };
                    mapped.patientId = mapped.patientId || p.id;
                    mapped.patientName = mapped.patientName || p.fullName;
                  }
                }
              } catch (examErr) { /* ignore exam lookup */ }
            }
            if (!mapped.patient && (mapped.patientId || mapped.patientName)) {
              let p = null;
              try {
                if (mapped.patientId) p = await Patient.findOne({ where: { id: mapped.patientId } }).catch(() => null);
                if (!p && mapped.patientId && String(mapped.patientId).match(/^\d+$/)) p = await Patient.findOne({ where: { id: Number(mapped.patientId) } }).catch(() => null);
                if (!p && mapped.patientName) p = await Patient.findOne({ where: { fullName: mapped.patientName } }).catch(() => null);
              } catch (pe) { p = null; }
              if (p) {
                mapped.patient = { id: p.id, fullName: p.fullName, phone: p.phone, dateOfBirth: p.dateOfBirth, gender: p.gender };
                mapped.patientId = mapped.patientId || p.id;
                mapped.patientName = mapped.patientName || p.fullName;
              }
            }
            if (mapped.doctorId || mapped.doctorName) {
              let d = null;
              try {
                if (mapped.doctorId) d = await User.findOne({ where: { id: mapped.doctorId } }).catch(() => null);
                if (!d && mapped.doctorName) d = await User.findOne({ where: { fullName: mapped.doctorName } }).catch(() => null);
              } catch (de) { d = null; }
              if (d) {
                mapped.doctor = { id: d.id, fullName: d.fullName };
                // Ensure doctorName string is set for frontend
                mapped.doctorName = mapped.doctorName || d.fullName;
              }
            }

            // If items are empty, try to load from PrescriptionItems table (common schema)
            if ((!mapped.items || mapped.items.length === 0) && mapped.id) {
              try {
                const itemsRows = await sequelize.query(
                  `SELECT * FROM [dbo].[PrescriptionItems] WHERE [PrescriptionID] = :id`,
                  { replacements: { id: mapped.id }, type: QueryTypes.SELECT }
                );
                if (Array.isArray(itemsRows) && itemsRows.length > 0) {
                  mapped.items = itemsRows.map(ir => ({
                    medicineId: ir.MedicineId || ir.MedicineID || ir.medicine_id || ir.Medicine || null,
                    medicineName: ir.MedicineName || ir.medicine_name || null,
                    dosage: ir.Dosage || ir.dosage || null,
                    frequency: ir.Frequency || ir.frequency || null,
                    duration: ir.Duration || ir.duration || null,
                    quantity: Number(ir.QuantityPrescribed || ir.Quantity || ir.quantityPrescribed || ir.quantity || 0),
                    instructions: ir.Instructions || ir.instructions || null,
                    price: Number(ir.Price || 0),
                  }));
                }
              } catch (ie) { /* ignore item-loading errors */ }
            }
            // Ensure items is always an array
            if (!Array.isArray(mapped.items)) mapped.items = [];
          } catch (e) { /* ignore enrichment errors */ }
          return mapped;
        }));
        try { console.debug('getPendingPrescriptions: returning fallback PascalCase sample', JSON.stringify(enriched[0] ? { id: enriched[0].id, patient: enriched[0].patient, patientName: enriched[0].patientName, prescriptionDate: enriched[0].prescriptionDate } : {}, null, 2)); } catch (e) {}
        return successResponse(res, enriched);
      }
    } catch (e1) { fallbackErrors.push({ step: 'pascalCase', message: e1 && (e1.original?.message || e1.message || String(e1)) }); console.error('getPendingPrescriptions: PascalCase fallback failed', e1 && (e1.original?.message || e1.message || e1)); }

    try {
      // Try snake_case legacy table with is_dispensed column (simple: no joins)
      const rows2 = await sequelize.query(
        `SELECT TOP 200 * FROM [dbo].[prescriptions] WHERE [is_dispensed] = 0 ORDER BY [created_at] ASC`,
        { type: QueryTypes.SELECT }
      );
      if (Array.isArray(rows2) && rows2.length > 0) {
        const enriched2 = await Promise.all(rows2.map(async (r) => {
          const mapped = mapRawPrescriptionRow(r);
          try {
            // Enrich with patient data by looking up via model
            if (mapped.examinationId) {
              try {
                const me = await sequelize.query(
                  `SELECT TOP 1 patient_id, examination_id FROM [dbo].[medical_examinations] WHERE examination_id = :examId`,
                  { replacements: { examId: mapped.examinationId }, type: QueryTypes.SELECT }
                ).catch(() => null);
                if (me && me.length > 0 && me[0].patient_id) {
                  const p = await Patient.findOne({ where: { id: me[0].patient_id } }).catch(() => null);
                  if (p) {
                    mapped.patient = { id: p.id, fullName: p.fullName, phone: p.phone, dateOfBirth: p.dateOfBirth, gender: p.gender };
                    mapped.patientId = mapped.patientId || p.id;
                    mapped.patientName = mapped.patientName || p.fullName;
                  }
                }
              } catch (examErr) { /* ignore exam lookup */ }
            }
            if (!mapped.patient && (mapped.patientId || mapped.patientName)) {
              let p = null;
              try {
                if (mapped.patientId) p = await Patient.findOne({ where: { id: mapped.patientId } }).catch(() => null);
                if (!p && mapped.patientId && String(mapped.patientId).match(/^\d+$/)) p = await Patient.findOne({ where: { id: Number(mapped.patientId) } }).catch(() => null);
                if (!p && mapped.patientName) p = await Patient.findOne({ where: { fullName: mapped.patientName } }).catch(() => null);
              } catch (pe) { p = null; }
              if (p) {
                mapped.patient = { id: p.id, fullName: p.fullName, phone: p.phone, dateOfBirth: p.dateOfBirth, gender: p.gender };
                mapped.patientId = mapped.patientId || p.id;
                mapped.patientName = mapped.patientName || p.fullName;
              }
            }

            if (mapped.doctorId || mapped.doctorName) {
              let d = null;
              try {
                if (mapped.doctorId) d = await User.findOne({ where: { id: mapped.doctorId } }).catch(() => null);
                if (!d && mapped.doctorName) d = await User.findOne({ where: { fullName: mapped.doctorName } }).catch(() => null);
              } catch (de) { d = null; }
              if (d) {
                mapped.doctor = { id: d.id, fullName: d.fullName };
                mapped.doctorName = mapped.doctorName || d.fullName;
              }
            }

            if ((!mapped.items || mapped.items.length === 0) && mapped.id) {
              try {
                const itemsRows = await sequelize.query(`SELECT * FROM [dbo].[PrescriptionItems] WHERE [PrescriptionID] = :id`, { replacements: { id: mapped.id }, type: QueryTypes.SELECT });
                if (Array.isArray(itemsRows) && itemsRows.length > 0) {
                  mapped.items = itemsRows.map(ir => ({
                    medicineId: ir.MedicineId || ir.MedicineID || ir.medicine_id || ir.Medicine || null,
                    medicineName: ir.MedicineName || ir.medicine_name || null,
                    dosage: ir.Dosage || ir.dosage || null,
                    frequency: ir.Frequency || ir.frequency || null,
                    duration: ir.Duration || ir.duration || null,
                    quantity: Number(ir.QuantityPrescribed || ir.Quantity || ir.quantityPrescribed || ir.quantity || 0),
                    instructions: ir.Instructions || ir.instructions || null,
                    price: Number(ir.Price || 0),
                  }));
                }
              } catch (ie) { /* ignore */ }
            }
            if (!Array.isArray(mapped.items)) mapped.items = [];
          } catch (e) { /* ignore */ }
          return mapped;
        }));
        try { console.debug('getPendingPrescriptions: returning fallback snake_case sample', JSON.stringify(enriched2[0] ? { id: enriched2[0].id, patient: enriched2[0].patient, patientName: enriched2[0].patientName, prescriptionDate: enriched2[0].prescriptionDate } : {}, null, 2)); } catch (e) {}
        return successResponse(res, enriched2);
      }
    } catch (e2) { fallbackErrors.push({ step: 'snake_case', message: e2 && (e2.original?.message || e2.message || String(e2)) }); console.error('getPendingPrescriptions: snake_case fallback failed', e2 && (e2.original?.message || e2.message || e2)); }

    try {
      // Try legacy Vietnamese DonThuoc table (simple: no joins)
      const rows3 = await sequelize.query(
        `SELECT TOP 200 * FROM [DonThuoc] WHERE [TrangThai] = 0 ORDER BY [NgayKeDon] DESC`,
        { type: QueryTypes.SELECT }
      );
      if (Array.isArray(rows3) && rows3.length > 0) {
        const enriched3 = await Promise.all(rows3.map(async (r) => {
          const mapped = mapRawPrescriptionRow(r);
          try {
            // Enrich with patient data by looking up via model
            if (mapped.examinationId) {
              try {
                const me = await sequelize.query(
                  `SELECT TOP 1 PatientID, ExaminationID FROM [dbo].[MedicalExaminations] WHERE ExaminationID = :examId`,
                  { replacements: { examId: mapped.examinationId }, type: QueryTypes.SELECT }
                ).catch(() => null);
                if (me && me.length > 0 && me[0].PatientID) {
                  const p = await Patient.findOne({ where: { id: me[0].PatientID } }).catch(() => null);
                  if (p) {
                    mapped.patient = { id: p.id, fullName: p.fullName, phone: p.phone, dateOfBirth: p.dateOfBirth, gender: p.gender };
                    mapped.patientId = mapped.patientId || p.id;
                    mapped.patientName = mapped.patientName || p.fullName;
                  }
                }
              } catch (examErr) { /* ignore exam lookup */ }
            }
            if (!mapped.patient && (mapped.patientId || mapped.patientName)) {
              let p = null;
              try {
                if (mapped.patientId) p = await Patient.findOne({ where: { id: mapped.patientId } }).catch(() => null);
                if (!p && mapped.patientId && String(mapped.patientId).match(/^\d+$/)) p = await Patient.findOne({ where: { id: Number(mapped.patientId) } }).catch(() => null);
                if (!p && mapped.patientName) p = await Patient.findOne({ where: { fullName: mapped.patientName } }).catch(() => null);
              } catch (pe) { p = null; }
              if (p) {
                mapped.patient = { id: p.id, fullName: p.fullName, phone: p.phone, dateOfBirth: p.dateOfBirth, gender: p.gender };
                mapped.patientId = mapped.patientId || p.id;
                mapped.patientName = mapped.patientName || p.fullName;
              }
            }

            if (mapped.doctorId || mapped.doctorName) {
              let d = null;
              try {
                if (mapped.doctorId) d = await User.findOne({ where: { id: mapped.doctorId } }).catch(() => null);
                if (!d && mapped.doctorName) d = await User.findOne({ where: { fullName: mapped.doctorName } }).catch(() => null);
              } catch (de) { d = null; }
              if (d) {
                mapped.doctor = { id: d.id, fullName: d.fullName };
                mapped.doctorName = mapped.doctorName || d.fullName;
              }
            }

            if ((!mapped.items || mapped.items.length === 0) && mapped.id) {
              try {
                const itemsRows = await sequelize.query(`SELECT * FROM [dbo].[PrescriptionItems] WHERE [PrescriptionID] = :id`, { replacements: { id: mapped.id }, type: QueryTypes.SELECT });
                if (Array.isArray(itemsRows) && itemsRows.length > 0) {
                  mapped.items = itemsRows.map(ir => ({
                    medicineId: ir.MedicineId || ir.MedicineID || ir.medicine_id || ir.Medicine || null,
                    medicineName: ir.MedicineName || ir.medicine_name || null,
                    dosage: ir.Dosage || ir.dosage || null,
                    frequency: ir.Frequency || ir.frequency || null,
                    duration: ir.Duration || ir.duration || null,
                    quantity: Number(ir.QuantityPrescribed || ir.Quantity || ir.quantityPrescribed || ir.quantity || 0),
                    instructions: ir.Instructions || ir.instructions || null,
                    price: Number(ir.Price || 0),
                  }));
                }
              } catch (ie) { /* ignore */ }
            }
            if (!Array.isArray(mapped.items)) mapped.items = [];
          } catch (e) { /* ignore */ }
          return mapped;
        }));
        try { console.debug('getPendingPrescriptions: returning fallback DonThuoc sample', JSON.stringify(enriched3[0] ? { id: enriched3[0].id, patient: enriched3[0].patient, patientName: enriched3[0].patientName, prescriptionDate: enriched3[0].prescriptionDate } : {}, null, 2)); } catch (e) {}
        return successResponse(res, enriched3);
      }
    } catch (e3) { fallbackErrors.push({ step: 'donthuoc', message: e3 && (e3.original?.message || e3.message || String(e3)) }); console.error('getPendingPrescriptions: DonThuoc fallback failed', e3 && (e3.original?.message || e3.message || e3)); }

    // Re-throw a clearer error that the global error handler will surface
    // Log collected fallback errors for diagnostics
    try { if (fallbackErrors.length > 0) console.error('getPendingPrescriptions: fallback errors summary', JSON.stringify(fallbackErrors, null, 2)); } catch (le) { /* ignore logging failure */ }

    const userErr = new Error('Lỗi cơ sở dữ liệu khi tải đơn chờ phát (xem server logs)');
    userErr.code = 'DATABASE_ERROR';
    throw userErr;
  }
});

/**
 * Confirm prescription (Doctor confirms - set/keep status 0: waiting for dispensing)
 * POST /api/prescriptions/:id/confirm
 */
const confirmPrescription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  // Try to update via model first
  let prescription = await Prescription.findByPk(id).catch(() => null);
  if (prescription) {
    const currentStatus = Number(prescription.status);
    if (currentStatus === 1) {
      throw new BadRequestError('Không thể xác nhận đơn thuốc đã phát');
    }
    if (currentStatus === 2) {
      throw new BadRequestError('Không thể xác nhận đơn thuốc đã hủy');
    }
    await prescription.update({ status: 0, updatedAt: new Date() });
    return successResponse(res, prescription, 'Xác nhận kê đơn thành công');
  }

  // If model lookup failed, try raw update for identity-schema table (PrescriptionID)
  try {
    const rows = await sequelize.query(
      `SELECT TOP 1 * FROM [dbo].[Prescriptions] WHERE [PrescriptionID] = :id`,
      { replacements: { id }, type: QueryTypes.SELECT }
    );
    if (!rows || rows.length === 0) {
      throw new NotFoundError('Không tìm thấy đơn thuốc');
    }

    const currentStatus = Number(rows[0].Status);
    if (currentStatus === 1) {
      throw new BadRequestError('Không thể xác nhận đơn thuốc đã phát');
    }
    if (currentStatus === 2) {
      throw new BadRequestError('Không thể xác nhận đơn thuốc đã hủy');
    }

    await sequelize.query(
      `UPDATE [dbo].[Prescriptions] SET [Status] = 0, [UpdatedAt] = GETUTCDATE() WHERE [PrescriptionID] = :id`,
      { replacements: { id }, type: QueryTypes.UPDATE }
    );

    const updatedRows = await sequelize.query(
      `SELECT TOP 1 * FROM [dbo].[Prescriptions] WHERE [PrescriptionID] = :id`,
      { replacements: { id }, type: QueryTypes.SELECT }
    );

    return successResponse(res, updatedRows[0], 'Xác nhận kê đơn thành công');
  } catch (e) {
    if (e.name === 'NotFoundError' || e.name === 'BadRequestError') throw e;
    console.error('confirmPrescription: raw update failed', e && (e.original?.message || e.message || e));
    throw new NotFoundError('Không tìm thấy đơn thuốc');
  }
});

/**
 * Complete prescription (Pharmacist confirms dispensing - status 0 -> 1)
 * POST /api/prescriptions/:id/complete
 */
const completePrescription = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const prescription = await Prescription.findByPk(id);
  if (!prescription) {
    throw new NotFoundError('Không tìm thấy đơn thuốc');
  }

  const currentStatus = Number(prescription.status);
  if (currentStatus === 1) {
    throw new BadRequestError('Đơn thuốc đã được phát');
  }
  if (currentStatus === 2) {
    throw new BadRequestError('Không thể hoàn thành đơn thuốc đã hủy');
  }
  if (currentStatus !== 0) {
    throw new BadRequestError('Trạng thái đơn thuốc không hợp lệ');
  }

  await prescription.update({ status: 1, updatedAt: new Date() });

  return successResponse(res, prescription, 'Xác nhận phát thuốc thành công');
});

/**
 * Cancel prescription (Doctor or Pharmacist cancels - waiting -> 2)
 * POST /api/prescriptions/:id/cancel
 */
const cancelPrescription = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const prescription = await Prescription.findByPk(id);
  if (!prescription) {
    throw new NotFoundError('Không tìm thấy đơn thuốc');
  }

  // Cannot cancel if already dispensed (status 1)
  if (Number(prescription.status) === 1) {
    throw new BadRequestError('Không thể hủy đơn thuốc đã phát');
  }

  // Update status to 2 (cancelled)
  await prescription.update({ 
    status: 2,
    notes: (prescription.notes ? prescription.notes + '\n' : '') + `Hủy: ${reason || 'No reason provided'}`
  });

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
