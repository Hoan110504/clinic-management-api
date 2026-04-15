/**
 * Prescription Controller
 * Handles prescription operations
 */
import { Op, QueryTypes } from 'sequelize';
import { Prescription, Patient, User, MedicalRecord, Medicine, InventoryTransaction, PrescriptionItem, MedicineBatch } from '../models/index.js';
import { sequelize } from '../models/database.js';
import { asyncHandler, parsePagination, parseSort } from '../utils/helpers.js';
import { formatToVietnamISOString } from '../utils/timezone.js';
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
    if (rawDate instanceof Date) prescriptionDate = formatToVietnamISOString(rawDate);
    else if (typeof rawDate === 'number' && !Number.isNaN(rawDate)) prescriptionDate = formatToVietnamISOString(new Date(rawDate));
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
    const listIncludes = [];
    if (Patient) listIncludes.push({ model: Patient, as: 'patient', attributes: ['id', 'fullName', 'phone', 'dateOfBirth', 'gender'], required: false });
    if (User) listIncludes.push({ model: User, as: 'doctor', attributes: ['id', 'fullName'], required: false });

    const result = await Prescription.findAndCountAll({ where, order, limit, offset, include: listIncludes });
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

  const includes = [];
  if (Patient) includes.push({ model: Patient, as: 'patient', required: false });
  if (User) includes.push({ model: User, as: 'doctor', attributes: ['id', 'fullName', 'phone', 'email', 'signature'], required: false });
  if (MedicalRecord) includes.push({ model: MedicalRecord, as: 'medicalRecord', required: false });

  let prescription = null;
  try {
    prescription = await Prescription.findByPk(id, { include: includes });
  } catch (dbErr) {
    console.error('getPrescriptionById: Prescription.findByPk failed', { id, message: dbErr?.message, original: dbErr?.original?.message || dbErr, sql: dbErr?.sql });
    // Try legacy/raw table fallbacks for deployments with different schemas
    const candidates = [
      `SELECT TOP 1 * FROM [dbo].[Prescriptions] WHERE [Id] = :id`,
      `SELECT TOP 1 * FROM [dbo].[Prescriptions] WHERE [PrescriptionID] = :id`,
      `SELECT TOP 1 * FROM [dbo].[prescriptions] WHERE [id] = :id`,
      `SELECT TOP 1 * FROM [dbo].[prescriptions] WHERE [prescriptionid] = :id`,
      `SELECT TOP 1 * FROM [DonThuoc] WHERE [Id] = :id`,
      `SELECT TOP 1 * FROM [DonThuoc] WHERE [PrescriptionID] = :id`,
    ];

    for (const sql of candidates) {
      try {
        const rows = await sequelize.query(sql, { replacements: { id }, type: QueryTypes.SELECT });
        if (Array.isArray(rows) && rows.length > 0) {
          const mapped = mapRawPrescriptionRow(rows[0]);
          // attach the raw row info to help clients debug if necessary
          return successResponse(res, mapped);
        }
      } catch (e) {
        console.warn('getPrescriptionById: fallback query failed', { sql, err: e?.message || e });
      }
    }
  }

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
  let examinationId = req.body.examinationId || medicalRecordId || null;

  // Resolve examinationId to a numeric ExaminationID (bigint) when possible.
  const parseNumeric = (v) => {
    if (v === undefined || v === null) return null;
    if (typeof v === 'number' && Number.isFinite(v)) return Number(v);
    const s = String(v).trim();
    if (/^\d+$/.test(s)) return Number(s);
    return null;
  };

  let resolvedExaminationId = parseNumeric(examinationId);
  // Try resolving via appointmentId if provided and numeric or as lookup
  if (!resolvedExaminationId && req.body.appointmentId) {
    const apptNum = parseNumeric(req.body.appointmentId);
    if (apptNum) {
      try {
        const rows = await sequelize.query(
          `SELECT TOP 1 ExaminationID FROM [dbo].[MedicalExaminations] WHERE [AppointmentID] = :apptId ORDER BY ExaminationID DESC`,
          { replacements: { apptId: apptNum }, type: QueryTypes.SELECT }
        );
        if (Array.isArray(rows) && rows.length > 0 && rows[0].ExaminationID) resolvedExaminationId = Number(rows[0].ExaminationID);
      } catch (e) { /* ignore lookup errors */ }
    }
  }

  // Try resolving by patientId to find most recent examination
  if (!resolvedExaminationId && req.body.patientId) {
    const pidNum = parseNumeric(req.body.patientId);
    if (pidNum) {
      try {
        const rows = await sequelize.query(
          `SELECT TOP 1 ExaminationID FROM [dbo].[MedicalExaminations] WHERE [PatientId] = :pid ORDER BY ExaminationDate DESC`,
          { replacements: { pid: pidNum }, type: QueryTypes.SELECT }
        );
        if (Array.isArray(rows) && rows.length > 0 && rows[0].ExaminationID) resolvedExaminationId = Number(rows[0].ExaminationID);
      } catch (e) { /* ignore */ }
    }
  }

  // Only accept numeric ExaminationID; if resolution failed, set to null
  examinationId = resolvedExaminationId || null;

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

  // Ensure doctorId is numeric when possible to avoid nvarchar->bigint conversion errors
  const parseNumericLocal = (v) => {
    if (v === undefined || v === null) return null;
    if (typeof v === 'number' && Number.isFinite(v)) return Number(v);
    const s = String(v).trim();
    if (/^\d+$/.test(s)) return Number(s);
    return null;
  };
  const resolvedDoctorId = parseNumericLocal(doctorId);
  // Only accept numeric doctorId; if not numeric, set to null (will be rejected)
  doctorId = resolvedDoctorId || null;

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
    instructions: String(item.instructions || ''),
    // PrescriptionItems.Status mapping: 0=Chờ phát, 1=Đã phát, 2=Đã hủy
    status: Number(item.status) === 1 ? 1 : (Number(item.status) === 2 ? 2 : 0),
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
        (key, value) => (value instanceof Date ? formatToVietnamISOString(value) : value),
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

    // Try multiple schema variations to insert prescription
    // Actual schema: dbo.Prescriptions (PrescriptionID, ExaminationID, DoctorID, PrescriptionDate, Note, Status, CreatedAt, UpdatedAt)
    let insertErr1, insertErr2, insertErr3;
    
    // Attempt 1: Insert to actual schema with minimal required columns
    try {
      const insertSql = `
        INSERT INTO [dbo].[Prescriptions]
          ([ExaminationID], [DoctorID], [Note], [Status], [PrescriptionDate], [CreatedAt], [UpdatedAt])
        OUTPUT INSERTED.PrescriptionID
        VALUES
          (:examinationId, :doctorId, :note, :status, GETUTCDATE(), GETUTCDATE(), GETUTCDATE())
      `;
      
      const result = await sequelize.query(insertSql, {
        replacements: {
          examinationId: payload.examinationId || null,
          doctorId: payload.doctorId || null,
          note: payload.notes ? `${payload.diagnosis ? 'Chẩn đoán: ' + payload.diagnosis + '\n' : ''}${payload.notes}` : (payload.diagnosis || ''),
          status: payload.status ?? 0,
        },
        type: QueryTypes.INSERT,
      });

      let prescriptionId = null;
      try {
        const rows = Array.isArray(result) ? result[0] : result;
        if (Array.isArray(rows) && rows.length > 0) {
          prescriptionId = rows[0].PrescriptionID || rows[0].prescriptionid;
        }
      } catch (e) {
        // fallback
      }

      if (!prescriptionId) {
        throw new Error('Failed to get inserted PrescriptionID');
      }

      console.log('prescription.create: Insert succeeded, PrescriptionID:', prescriptionId);

      // Fetch the created prescription
      const created = await sequelize.query(
        `SELECT TOP 1 * FROM [dbo].[Prescriptions] WHERE PrescriptionID = :id`,
        { replacements: { id: prescriptionId }, type: QueryTypes.SELECT }
      );

      // Insert prescription items into PrescriptionItems table (if supported)
      try {
        if (Array.isArray(sanitizedItems) && sanitizedItems.length > 0) {
          for (const it of sanitizedItems) {
            await sequelize.query(
              `INSERT INTO [dbo].[PrescriptionItems] (PrescriptionID, MedicineId, Dosage, Frequency, Duration, QuantityPrescribed, Instructions, Status, CreatedAt)
               VALUES (:prescId, :medicineId, :dosage, :frequency, :duration, :quantity, :instructions, :status, GETUTCDATE())`,
              {
                replacements: {
                  prescId: prescriptionId,
                  medicineId: it.medicineId,
                  dosage: it.dosage || null,
                  frequency: it.frequency || null,
                  duration: it.duration || null,
                  quantity: Number(it.quantity) || 0,
                  instructions: it.instructions || null,
                  status: Number(it.status) === 1 ? 1 : (Number(it.status) === 2 ? 2 : 0),
                },
                type: QueryTypes.INSERT,
              }
            );
          }
          console.log('prescription.create: PrescriptionItems inserted for PrescriptionID', prescriptionId);
        }
      } catch (itemsErr) {
        console.warn('prescription.create: failed to insert PrescriptionItems via raw query', itemsErr && (itemsErr.original?.message || itemsErr.message));
      }

      return createdResponse(res, created && created[0] ? created[0] : { PrescriptionID: prescriptionId }, 'Tạo đơn thuốc thành công');
    } catch (err1) {
      insertErr1 = err1;
      console.warn('prescription.create: direct insert failed', err1 && (err1.original?.message || err1.message));
    }

    // Attempt 2: Try via Sequelize model (in case field mappings differ)
    try {
      const created = await Prescription.create({
        examinationId: payload.examinationId || null,
        medicalRecordId: payload.medicalRecordId || null,
        patientId: payload.patientId || null,
        patientName: payload.patientName || null,
        doctorId: payload.doctorId || null,
        doctorName: payload.doctorName || null,
        items: payload.items || [],
        diagnosis: payload.diagnosis || null,
        notes: payload.notes || null,
        status: payload.status ?? 0,
      });

      console.log('prescription.create: Insert succeeded via Sequelize model, ID:', created.id);

      // Create PrescriptionItems if items exist (optional, may not be supported by schema)
      if (Array.isArray(sanitizedItems) && sanitizedItems.length > 0) {
        try {
          for (const it of sanitizedItems) {
            await PrescriptionItem.create({
              prescriptionId: created.id,
              medicineId: it.medicineId,
              dosage: it.dosage || null,
              frequency: it.frequency || null,
              duration: it.duration || null,
              quantityPrescribed: Number(it.quantity) || 0,
              instructions: it.instructions || null,
              price: Number(it.price) || 0,
              status: Number(it.status) === 1 ? 1 : (Number(it.status) === 2 ? 2 : 0),
            }).catch(() => null);
          }
        } catch (itemsErr) {
          console.warn('prescription.create: PrescriptionItems creation skipped', itemsErr && (itemsErr.original?.message || itemsErr.message));
        }
      }

      return createdResponse(res, created, 'Tạo đơn thuốc thành công');
    } catch (err2) {
      insertErr2 = err2;
      console.warn('prescription.create: Sequelize model create failed', err2 && (err2.original?.message || err2.message));
    }

    // Attempt 3: Insert with minimal payload to actual schema
    try {
      await sequelize.query(
        `
        INSERT INTO [dbo].[Prescriptions]
          ([ExaminationID], [DoctorID], [Status])
        VALUES
          (:examinationId, :doctorId, :status)
        `,
        {
          replacements: {
            examinationId: payload.examinationId || null,
            doctorId: payload.doctorId || null,
            status: payload.status ?? 0,
          },
          type: QueryTypes.INSERT,
        }
      );

      console.log('prescription.create: Minimal insert succeeded');

      // Find the created row
      const created = await sequelize.query(
        `SELECT TOP 1 * FROM [dbo].[Prescriptions] WHERE [ExaminationID] = :examId AND [DoctorID] = :doctorId ORDER BY PrescriptionID DESC`,
        { replacements: { examId: payload.examinationId, doctorId: payload.doctorId }, type: QueryTypes.SELECT }
      );

      // Insert prescription items into PrescriptionItems table (if supported)
      try {
        if (Array.isArray(sanitizedItems) && sanitizedItems.length > 0 && Array.isArray(created) && created.length > 0) {
          const createdRow = created[0];
          const newId = createdRow.PrescriptionID || createdRow.prescriptionid || createdRow.Id || createdRow.id;
          if (newId) {
            for (const it of sanitizedItems) {
              await sequelize.query(
                `INSERT INTO [dbo].[PrescriptionItems] (PrescriptionID, MedicineId, Dosage, Frequency, Duration, QuantityPrescribed, Instructions, Status, CreatedAt)
                   VALUES (:prescId, :medicineId, :dosage, :frequency, :duration, :quantity, :instructions, :status, GETUTCDATE())`,
                {
                  replacements: {
                    prescId: newId,
                    medicineId: it.medicineId,
                    dosage: it.dosage || null,
                    frequency: it.frequency || null,
                    duration: it.duration || null,
                    quantity: Number(it.quantity) || 0,
                    instructions: it.instructions || null,
                      status: Number(it.status) === 1 ? 1 : (Number(it.status) === 2 ? 2 : 0),
                  },
                  type: QueryTypes.INSERT,
                }
              );
            }
            console.log('prescription.create: PrescriptionItems inserted for minimal-insert PrescriptionID', newId);
          }
        }
      } catch (itemsErr) {
        console.warn('prescription.create: failed to insert PrescriptionItems for minimal-insert', itemsErr && (itemsErr.original?.message || itemsErr.message));
      }

      return createdResponse(res, created && created[0] ? created[0] : {}, 'Tạo đơn thuốc thành công');
    } catch (err3) {
      insertErr3 = err3;
      console.error('prescription.create: all insert attempts failed', {
        attempt1_direct: insertErr1 && (insertErr1.original?.message || insertErr1.message),
        attempt2_sequelize: insertErr2 && (insertErr2.original?.message || insertErr2.message),
        attempt3_minimal: insertErr3 && (insertErr3.original?.message || insertErr3.message),
      });
      const errMsg = insertErr1.original?.message || insertErr1.message || 'Unknown DB error';
      throw Object.assign(new Error(errMsg), { code: 'DATABASE_ERROR' });
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
  const updateData = { ...(req.body || {}) };

  const prescription = await Prescription.findByPk(id);
  if (!prescription) {
    throw new NotFoundError('Không tìm thấy đơn thuốc');
  }

  // Cannot update if status is 1 (dispensed) or 2 (cancelled)
  if (prescription.status === 1 || prescription.status === 2) {
    throw new BadRequestError('Không thể cập nhật đơn thuốc đã phát hoặc đã hủy');
  }

  if (Array.isArray(updateData.items)) {
    updateData.items = updateData.items.map((item) => ({
      medicineId: item?.medicineId,
      medicineName: item?.medicineName || '',
      unit: item?.unit || '',
      price: Number(item?.price) || 0,
      dosage: String(item?.dosage || ''),
      frequency: String(item?.frequency || ''),
      duration: Number(item?.duration) || 0,
      quantity: Number(item?.quantity) || 0,
      instructions: String(item?.instructions || ''),
      status: Number(item?.status) === 1 ? 1 : (Number(item?.status) === 2 ? 2 : 0),
    }));
  }

  await prescription.update(updateData);

  // Keep dbo.PrescriptionItems synchronized with updated item statuses/details.
  if (Array.isArray(updateData.items)) {
    try {
      const tx = await sequelize.transaction();
      try {
        await sequelize.query(
          `DELETE FROM [dbo].[PrescriptionItems] WHERE [PrescriptionID] = :prescId`,
          { replacements: { prescId: id }, type: QueryTypes.DELETE, transaction: tx }
        );

        for (const it of updateData.items) {
          await sequelize.query(
            `INSERT INTO [dbo].[PrescriptionItems] (PrescriptionID, MedicineId, Dosage, Frequency, Duration, QuantityPrescribed, Instructions, Status, CreatedAt)
             VALUES (:prescId, :medicineId, :dosage, :frequency, :duration, :quantity, :instructions, :status, GETUTCDATE())`,
            {
              replacements: {
                prescId: id,
                medicineId: it.medicineId,
                dosage: it.dosage || null,
                frequency: it.frequency || null,
                duration: it.duration || null,
                quantity: Number(it.quantity) || 0,
                instructions: it.instructions || null,
                status: Number(it.status) === 1 ? 1 : (Number(it.status) === 2 ? 2 : 0),
              },
              type: QueryTypes.INSERT,
              transaction: tx,
            }
          );
        }

        await tx.commit();
      } catch (syncErr) {
        try { await tx.rollback(); } catch (rbErr) { /* ignore */ }
        console.warn('updatePrescription: failed to sync PrescriptionItems, keeping Prescriptions.Items updated only', syncErr?.message || syncErr);
      }
    } catch (txErr) {
      console.warn('updatePrescription: transaction init failed for PrescriptionItems sync', txErr?.message || txErr);
    }
  }

  return successResponse(res, prescription, 'Cập nhật đơn thuốc thành công');
});

/**
 * Dispense prescription (issue medicines)
 * POST /api/prescriptions/:id/dispense
 */
const dispensePrescription = asyncHandler(async (req, res) => {
  const { id } = req.params;

  let prescription;
  try {
    prescription = await Prescription.findByPk(id);
  } catch (dbErr) {
    console.error('[dispensePrescription] Prescription.findByPk failed', { id, message: dbErr?.message, original: dbErr?.original?.message || dbErr });
    // Try legacy/raw table fallbacks (safe: read-only selects)
    const candidates = [
      { sql: `SELECT TOP 1 * FROM [dbo].[Prescriptions] WHERE [Id] = :id` },
      { sql: `SELECT TOP 1 * FROM [dbo].[Prescriptions] WHERE [PrescriptionID] = :id` },
      { sql: `SELECT TOP 1 * FROM [dbo].[prescriptions] WHERE [id] = :id` },
      { sql: `SELECT TOP 1 * FROM [dbo].[prescriptions] WHERE [prescriptionid] = :id` },
      { sql: `SELECT TOP 1 * FROM [DonThuoc] WHERE [Id] = :id` },
      { sql: `SELECT TOP 1 * FROM [DonThuoc] WHERE [PrescriptionID] = :id` },
    ];

    let found = null; let foundTable = null;
    for (const c of candidates) {
      try {
        const rows = await sequelize.query(c.sql, { replacements: { id }, type: QueryTypes.SELECT });
        if (Array.isArray(rows) && rows.length > 0) {
          found = rows[0];
          // extract table name from SQL for later updates
          const m = c.sql.match(/FROM\s+([^\s]+)/i);
          foundTable = m ? m[1] : null;
          break;
        }
      } catch (e) {
        // ignore individual fallback errors
        console.warn('[dispensePrescription] fallback query failed', { sql: c.sql, err: e?.message });
      }
    }

    if (!found) {
      throw new BadRequestError('Lỗi cơ sở dữ liệu khi truy vấn đơn thuốc. Vui lòng kiểm tra cấu trúc DB và chạy migrations.');
    }

    // Build a lightweight prescription-like object from raw row
    const mapped = mapRawPrescriptionRow(found);
    prescription = {
      isRaw: true,
      rawRow: found,
      rawTable: foundTable,
      id: mapped.id,
      status: mapped.status,
      // helper to update status later via raw SQL
    };
  }

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
    throw new BadRequestError('Không thể phát thuốc - trạng thái đơn thuốc không hợp lệ (cần status 0: Chờ phát thuốc)');
  }

  const transaction = await sequelize.transaction();

  try {
    console.log('[dispensePrescription] Starting dispense process for prescription id:', prescription.id);
    
    let prescriptionItems;
    try {
      console.log('[dispensePrescription] Loading PrescriptionItems from DB...');
      prescriptionItems = await PrescriptionItem.findAll({
        where: { prescriptionId: prescription.id },
        transaction,
      });
      console.log('[dispensePrescription] PrescriptionItems loaded:', prescriptionItems?.length || 0);
    } catch (e) {
      console.error('[dispensePrescription] PrescriptionItem.findAll failed:', e?.message);
      throw e;
    }

    if (!Array.isArray(prescriptionItems) || prescriptionItems.length === 0) {
      throw new BadRequestError('Đơn thuốc không có thuốc để phát');
    }

    const activePrescriptionItems = prescriptionItems.filter((item) => {
      const st = Number(item?.status ?? item?.Status ?? 0);
      // Dispense pending items only (0 = Chờ phát)
      return st === 0;
    });
    if (activePrescriptionItems.length === 0) {
      throw new BadRequestError('Đơn thuốc không có thuốc đang được chọn để phát');
    }

    const performedByUserId = req.user?.id ? String(req.user.id) : null;

    for (const item of activePrescriptionItems) {
      const medicineId = Number(item.medicineId);
      const quantityToDispense = Number(item.quantityPrescribed || 0);

      if (!Number.isFinite(medicineId) || medicineId <= 0) {
        throw new BadRequestError('Chi tiết đơn thuốc có MedicineId không hợp lệ');
      }
      if (!Number.isFinite(quantityToDispense) || quantityToDispense <= 0) {
        throw new BadRequestError(`Số lượng thuốc cần phát không hợp lệ (MedicineId=${medicineId})`);
      }

      console.log('[dispensePrescription] Looking up Medicine:', medicineId);
      let medicine;
      try {
        medicine = await Medicine.findByPk(medicineId, { transaction });
      } catch (e) {
        console.error('[dispensePrescription] Medicine.findByPk failed:', { medicineId, err: e?.message });
        throw e;
      }
      if (!medicine) {
        throw new NotFoundError(`Không tìm thấy thuốc: ID ${medicineId}`);
      }
      console.log('[dispensePrescription] Medicine found:', medicine.Name);

      console.log('[dispensePrescription] Loading MedicineBatch for medicine:', medicineId);
      let batchRows;
      try {
        batchRows = await MedicineBatch.findAll({
        where: {
          MedicineId: medicineId,
          QuantityInStock: { [Op.gt]: 0 },
        },
          transaction,
        });
      } catch (e) {
        console.error('[dispensePrescription] MedicineBatch.findAll failed:', { medicineId, err: e?.message });
        throw e;
      }
      console.log('[dispensePrescription] MedicineBatch rows found:', batchRows?.length || 0);


      const availableBatches = (batchRows || []).sort((a, b) => {
        const aExpiry = a.ExpiryDate ? new Date(a.ExpiryDate).getTime() : Number.MAX_SAFE_INTEGER;
        const bExpiry = b.ExpiryDate ? new Date(b.ExpiryDate).getTime() : Number.MAX_SAFE_INTEGER;
        if (aExpiry !== bExpiry) return aExpiry - bExpiry;
        return Number(a.Id || 0) - Number(b.Id || 0);
      });

      const totalStock = availableBatches.reduce((sum, batch) => sum + Number(batch.QuantityInStock || 0), 0);
      if (totalStock < quantityToDispense) {
        throw new BadRequestError(`Không đủ thuốc để phát: ${medicine.Name} (cần ${quantityToDispense}, tồn ${totalStock})`);
      }

      let remaining = quantityToDispense;
      for (const batch of availableBatches) {
        if (remaining <= 0) break;

        const quantityBefore = Number(batch.QuantityInStock || 0);
        if (quantityBefore <= 0) continue;

        const issuedQuantity = Math.min(quantityBefore, remaining);
        const quantityAfter = quantityBefore - issuedQuantity;

        await batch.update(
          {
            QuantityInStock: quantityAfter,
            Status: quantityAfter > 0 ? 1 : 0,
          },
          { transaction }
        );

        const inventoryTxPayload = {
          MedicineBatchId: batch.Id,
          MedicineId: medicine.Id,
          TransactionType: InventoryTransaction.TRANSACTION_TYPE?.EXPORT || 2,
          Quantity: issuedQuantity,
          QuantityBefore: quantityBefore,
          QuantityAfter: quantityAfter,
          Reason: `Xuất theo đơn thuốc ${prescription.id}`,
          ReferenceType: InventoryTransaction.REFERENCE_TYPE?.PRESCRIPTION || 1,
          PerformedByUserId: performedByUserId,
          Note: JSON.stringify({
            prescriptionId: prescription.id,
            prescriptionItemId: item.id,
            batchId: batch.Id,
            batchNumber: batch.BatchNumber,
            issuedQuantity,
          }),
        };

        // Log payload to help diagnose conversion issues (trim large fields)
        console.log('[dispensePrescription] creating InventoryTransaction payload', JSON.stringify({
          MedicineBatchId: inventoryTxPayload.MedicineBatchId,
          MedicineId: inventoryTxPayload.MedicineId,
          Quantity: inventoryTxPayload.Quantity,
          NoteLength: inventoryTxPayload.Note ? inventoryTxPayload.Note.length : 0,
        }));

        try {
          await InventoryTransaction.create(inventoryTxPayload, { transaction });
        } catch (createErr) {
          console.error('[dispensePrescription] InventoryTransaction.create failed', {
            message: createErr?.message,
            original: createErr?.original && (createErr.original.message || createErr.original),
            sql: createErr?.sql,
            payloadSample: inventoryTxPayload && {
              MedicineBatchId: inventoryTxPayload.MedicineBatchId,
              MedicineId: inventoryTxPayload.MedicineId,
              Quantity: inventoryTxPayload.Quantity,
            },
          });
          throw createErr;
        }

        remaining -= issuedQuantity;
      }

      if (remaining > 0) {
        throw new BadRequestError(`Không thể hoàn tất phát thuốc cho ${medicine.Name}`);
      }
    }

    // Update all PrescriptionItems Status to 1 (Đã phát thuốc)
    try {
      await PrescriptionItem.update(
        { status: 1 },
        { where: { prescriptionId: prescription.id }, transaction }
      );
    } catch (updateItemErr) {
      console.error('[dispensePrescription] Failed to update PrescriptionItems status:', updateItemErr?.message);
      throw updateItemErr;
    }

    if (prescription && prescription.isRaw) {
      // Update legacy/raw prescription table using detected columns
      const row = prescription.rawRow || {};
      const table = prescription.rawTable || '[dbo].[Prescriptions]';

      // detect id column
      const idCandidates = ['Id', 'PrescriptionID', 'PrescriptionId', 'prescriptionid', 'id'];
      let idCol = idCandidates.find((c) => Object.prototype.hasOwnProperty.call(row, c));
      if (!idCol) idCol = 'Id';

      // detect status column
      const statusCandidates = ['Status', 'TrangThai', 'is_dispensed', 'IsDispensed', 'status'];
      let statusCol = statusCandidates.find((c) => Object.prototype.hasOwnProperty.call(row, c));
      if (!statusCol) statusCol = 'Status';

      // detect updatedAt column
      const updatedAtCandidates = ['UpdatedAt', 'updated_at', 'Updated_at'];
      const updatedAtCol = updatedAtCandidates.find((c) => Object.prototype.hasOwnProperty.call(row, c));

      const replacements = { status: 1, id: prescription.id };
      let updateSql;
      if (updatedAtCol) {
        updateSql = `UPDATE ${table} SET [${statusCol}] = :status, [${updatedAtCol}] = GETUTCDATE() WHERE [${idCol}] = :id`;
      } else {
        updateSql = `UPDATE ${table} SET [${statusCol}] = :status WHERE [${idCol}] = :id`;
      }

      await sequelize.query(updateSql, { replacements, type: QueryTypes.UPDATE, transaction });
    } else {
      await prescription.update({ status: 1 }, { transaction });
    }

    await transaction.commit();

    return successResponse(res, prescription, 'Xác nhận phát thuốc thành công');
  } catch (error) {
    try {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
    } catch (rbErr) {
      console.warn('[dispensePrescription] rollback skipped or failed:', rbErr && rbErr.message);
    }
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
 * Get prescriptions for pharmacist waiting tab (status 0/1)
 * GET /api/prescriptions/pending
 */
const getPendingPrescriptions = asyncHandler(async (req, res) => {
  try {
    const pendingIncludes = [];
    if (Patient) pendingIncludes.push({ model: Patient, as: 'patient', attributes: ['id', 'fullName', 'phone', 'dateOfBirth', 'gender'], required: false });
    if (User) pendingIncludes.push({ model: User, as: 'doctor', attributes: ['id', 'fullName'], required: false });

    const prescriptions = await Prescription.findAll({
      where: { status: { [Op.in]: [0, 1] } },  // 0 = Chờ phát, 1 = Đã phát
      order: [['prescriptionDate', 'ASC']],
      include: pendingIncludes,
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
    // Check if Prescriptions table exists first
    let tableExists = false;
    try {
      await sequelize.query(
        `SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'Prescriptions' AND TABLE_SCHEMA = 'dbo'`,
        { type: QueryTypes.SELECT }
      );
      tableExists = true;
    } catch (tableCheckErr) {
      console.error('getPendingPrescriptions: failed to check if Prescriptions table exists', tableCheckErr?.message);
    }

    if (!tableExists) {
      console.error('getPendingPrescriptions: Prescriptions table does not exist. Run migrations: npm run migrate');
      const userErr = new Error('Bảng Prescriptions chưa được tạo. Vui lòng chạy migration: npm run migrate');
      userErr.code = 'TABLE_NOT_EXISTS';
      throw userErr;
    }
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
    
    // Simplified fallback: just get prescriptions without complex enrichment
    try {
      // Try PascalCase identity-style table (simple: no joins, enrichment via model)
      const rows1 = await sequelize.query(
        `SELECT TOP 200 * FROM [dbo].[Prescriptions] WHERE [Status] IN (0, 1) ORDER BY [PrescriptionDate] ASC`,
        { type: QueryTypes.SELECT }
      ).catch(err => {
        console.error('getPendingPrescriptions: Prescriptions query failed:', err?.message);
        throw err;
      });
      
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
        `SELECT TOP 200 * FROM [dbo].[prescriptions] WHERE [is_dispensed] IN (0, 1) ORDER BY [created_at] ASC`,
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
        `SELECT TOP 200 * FROM [DonThuoc] WHERE [TrangThai] IN (0, 1) ORDER BY [NgayKeDon] DESC`,
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
    } catch (e3) { 
      fallbackErrors.push({ step: 'donthuoc', message: e3 && (e3.original?.message || e3.message || String(e3)) }); 
      console.error('getPendingPrescriptions: DonThuoc fallback failed', e3 && (e3.original?.message || e3.message || e3)); 
    }

    // Log collected fallback errors for diagnostics
    try { 
      if (fallbackErrors.length > 0) {
        console.error('getPendingPrescriptions: fallback errors summary', JSON.stringify(fallbackErrors, null, 2));
      } 
    } catch (le) { /* ignore logging failure */ }

    // If no fallbacks worked, return empty array instead of error (graceful degradation)
    // This prevents API  from breaking if schema changes but doesn't have data yet
    console.warn('getPendingPrescriptions: All query attempts failed, returning empty array for graceful degradation');
    return successResponse(res, [], 'Không có đơn chờ phát (tất cả các source đều thất bại)');
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
    await PrescriptionItem.update({ status: 0 }, { where: { prescriptionId: prescription.id } });
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
    await sequelize.query(
      `UPDATE [dbo].[PrescriptionItems] SET [Status] = 0 WHERE [PrescriptionID] = :id`,
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

  await PrescriptionItem.update({ status: 1 }, { where: { prescriptionId: prescription.id } });
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
  await PrescriptionItem.update({ status: 2 }, { where: { prescriptionId: prescription.id } });
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
