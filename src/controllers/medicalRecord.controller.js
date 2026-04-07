/**
 * MedicalRecord controller - cung cấp hàng chờ khám hôm nay
 */
import { Op, QueryTypes } from 'sequelize';
import { Appointment, Patient, User, MedicalRecord } from '../models/index.js';
import models from '../models/index.js';
import { asyncHandler } from '../utils/helpers.js';
import { successResponse, createdResponse, paginatedResponse, errorResponse } from '../utils/response.js';
import { APPOINTMENT_STATUS, MEDICAL_RECORD_STATUS } from '../config/constants.js';
import { labelToCode, codeToLabel, normalizeStatus } from '../utils/statusHelpers.js';
import { parsePagination, parseSort, buildWhereClause } from '../utils/helpers.js';

const getTodayQueue = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // 1) Try to load medical records that indicate waiting/in-progress for today (if model available)
  let records = [];
  // prefer a dedicated MedicalExamination model if available in models
  const PreferredRecord = (models && models.MedicalExamination) || MedicalRecord;
  try {
    if (PreferredRecord && typeof PreferredRecord.findAll === 'function') {
      // Build where clause: always filter by createdAt (uses model's createdAt mapping)
      const whereClause = { createdAt: { [Op.gte]: today, [Op.lt]: tomorrow } };
      // Only add status filter when the model actually exposes a `status` attribute/column
      const hasStatusAttr = PreferredRecord.rawAttributes && Object.prototype.hasOwnProperty.call(PreferredRecord.rawAttributes, 'status');
      if (hasStatusAttr) {
        whereClause.status = { [Op.in]: [MEDICAL_RECORD_STATUS.WAITING, MEDICAL_RECORD_STATUS.IN_PROGRESS] };
      }

      // Use the exact Sequelize model instances from the PreferredRecord's sequelize
      const sequelizeModelsForPreferred = (PreferredRecord && PreferredRecord.sequelize && PreferredRecord.sequelize.models) ? PreferredRecord.sequelize.models : (models || {});
      const PatientModelForPreferred = sequelizeModelsForPreferred.Patient || sequelizeModelsForPreferred.BenhNhan || Patient;
      const UserModelForPreferred = sequelizeModelsForPreferred.User || sequelizeModelsForPreferred.NguoiDung || User;

      records = await PreferredRecord.findAll({
        where: whereClause,
        include: [
          { model: PatientModelForPreferred, as: 'patient', required: false },
          { model: UserModelForPreferred, as: 'doctor', required: false },
        ],
        order: [['createdAt', 'ASC']],
      });
      // normalize
      records = (records || []).map(r => (r && r.get ? r.get({ plain: true }) : r));
    }
  } catch (e) {
    console.warn('medicalRecord.controller.getTodayQueue: failed to query PreferredRecord, falling back to appointments only', e?.message || e);
    records = [];
  }

  // 2) Load today's appointments (scheduled/confirmed/waiting)
  const notInStatuses = [];
  const cancelledCode = labelToCode(APPOINTMENT_STATUS.CANCELLED);
  const completedCode = labelToCode(APPOINTMENT_STATUS.COMPLETED);
  if (cancelledCode != null) notInStatuses.push(cancelledCode);
  if (completedCode != null) notInStatuses.push(completedCode);

  const apptWhere = {
    appointmentDate: { [Op.gte]: today, [Op.lt]: tomorrow },
    status: { [Op.notIn]: notInStatuses.length ? notInStatuses : [APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.COMPLETED] },
  };
  // If doctor role, scope to that doctor
  if (req.user && req.user.role === 'doctor') {
    apptWhere.assignedDoctorId = req.user.id;
  }

  let appointments = [];
  try {
    const appts = await Appointment.findAll({
      where: apptWhere,
      include: [
        { model: Patient, as: 'patient', required: false },
        { model: User, as: 'assignedDoctor', required: false },
      ],
      order: [['timeSlot', 'ASC']],
    });
    appointments = (appts || []).map(a => (a && a.get ? a.get({ plain: true }) : a));
  } catch (e) {
    console.warn('medicalRecord.controller.getTodayQueue: failed to load Appointment rows', e?.message || e);
    appointments = [];
  }

  // 3) Merge results: prefer records when they reference an appointmentId, otherwise include appointments
  const merged = [];
  const seenApptIds = new Set();

  for (const rec of records) {
    if (rec && rec.appointmentId) seenApptIds.add(String(rec.appointmentId));
    merged.push({
      id: rec.id || rec.Id || `REC-${rec.id || ''}`,
      _source: 'record',
      appointmentRef: rec.appointmentId ? { id: rec.appointmentId } : null,
      patientId: rec.patientId || (rec.patient && rec.patient.id),
      patientName: rec.patientName || (rec.patient && (rec.patient.fullName || rec.patient.HoTen)) || null,
      purpose: rec.symptoms || rec.purpose || '',
      createdAt: rec.createdAt,
      status: rec.status,
      raw: rec,
    });
  }

  for (const a of appointments) {
    if (a && a.id && seenApptIds.has(String(a.id))) continue;
    merged.push({
      id: `APT-${a.id}`,
      _source: 'appointment',
      appointmentRef: a,
      patientId: a.patientId || (a.patient && a.patient.id) || null,
      patientName: a.patientName || (a.patient && (a.patient.fullName || a.patient.HoTen)) || null,
      purpose: a.symptoms || a.purpose || 'Khám theo lịch hẹn',
      timeSlot: a.timeSlot,
      createdAt: a.createdAt,
      status: a.status,
      raw: a,
    });
  }

  return successResponse(res, merged);
});

// Helper: generate human-friendly visit code (Mã phiếu khám)
function generateVisitCode() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  // Use higher-entropy suffix: last 8 digits of epoch ms + 3-digit random number
  // This ensures uniqueness even for records created within the same millisecond
  const msSuffix = now.getTime().toString().slice(-8);
  const rand = String(Math.floor(100 + Math.random() * 900));
  return `PK-${y}${m}${d}-${msSuffix}${rand}`;
}

// GET /api/medical-records
const getAllRecords = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { patientId, sort } = req.query;

  // If model missing, return empty paginated response
  const PreferredRecordForList = (models && models.MedicalExamination) || MedicalRecord;
  if (!PreferredRecordForList || typeof PreferredRecordForList.findAndCountAll !== 'function') {
    return paginatedResponse(res, { data: [], page, limit, total: 0 });
  }

  const where = {};
  if (patientId) where.patientId = patientId;

  const order = parseSort(sort, ['createdAt', 'id', 'completedAt']);

  // Ensure includes use the sequelize model instances from the preferred model
  const sequelizeModelsForList = (PreferredRecordForList && PreferredRecordForList.sequelize && PreferredRecordForList.sequelize.models) ? PreferredRecordForList.sequelize.models : (models || {});
  const PatientModelForList = sequelizeModelsForList.Patient || sequelizeModelsForList.BenhNhan || Patient;
  const UserModelForList = sequelizeModelsForList.User || sequelizeModelsForList.NguoiDung || User;

  let result;
  try {
    result = await PreferredRecordForList.findAndCountAll({
      where,
      include: [
        { model: PatientModelForList, as: 'patient', required: false },
        { model: UserModelForList, as: 'doctor', required: false },
      ],
      order: (function mapOrderForModel(o) {
        try {
          const usingMedModel = Boolean(models && models.MedicalExamination && PreferredRecordForList === models.MedicalExamination);
          if (!usingMedModel) return o;
          if (!Array.isArray(o)) return o;
          return o.map(([fld, dir]) => {
            const f = String(fld || '');
            if (f === 'id') return ['ExaminationID', dir];
            if (f === 'createdAt') return ['CreatedAt', dir];
            if (f === 'completedAt') return ['UpdatedAt', dir];
            // preserve other fields
            return [fld, dir];
          });
        } catch (e) {
          return o;
        }
      })(order),
      limit,
      offset,
    });
  } catch (dbErr) {
    console.error('getAllRecords: DB error during findAndCountAll', dbErr && dbErr.message);
    console.error('getAllRecords: DB error original:', dbErr && dbErr.original && dbErr.original.message);
    console.error('getAllRecords: DB error sql:', dbErr && dbErr.sql);
    // Return empty paginated result instead of throwing to keep frontend usable
    return paginatedResponse(res, { data: [], page, limit, total: 0 });
  }

  const rows = (result.rows || []).map(r => (r && r.get ? r.get({ plain: true }) : r));
  return paginatedResponse(res, { data: rows, page, limit, total: result.count || 0 });
});

// GET /api/medical-records/:id
const getRecordById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const idText = String(id || '').trim();
  const PreferredRecordForGet = (models && models.MedicalExamination) || MedicalRecord;
  if (!PreferredRecordForGet || typeof PreferredRecordForGet.findByPk !== 'function') {
    return successResponse(res, null);
  }

  // Build includes using the sequelize model instances from the preferred record to ensure associations match
  const sequelizeModelsForGet = (PreferredRecordForGet && PreferredRecordForGet.sequelize && PreferredRecordForGet.sequelize.models) ? PreferredRecordForGet.sequelize.models : (models || {});
  const PatientModelForGet = sequelizeModelsForGet.Patient || sequelizeModelsForGet.BenhNhan || Patient;
  const UserModelForGet = sequelizeModelsForGet.User || sequelizeModelsForGet.NguoiDung || User;
  const includes = [
    { model: PatientModelForGet, as: 'patient', required: false },
    { model: UserModelForGet, as: 'doctor', required: false },
  ];

  // If legacy models exist and the physical tables are present, include service requests and results
  const usingMedicalExaminationModel = Boolean(models && models.MedicalExamination && PreferredRecordForGet === models.MedicalExamination);
  if (!usingMedicalExaminationModel) {
    try {
      const sequelizeInstance = PreferredRecordForGet && PreferredRecordForGet.sequelize ? PreferredRecordForGet.sequelize : (MedicalRecord && MedicalRecord.sequelize);
      const rawTables = await (sequelizeInstance && sequelizeInstance.getQueryInterface && sequelizeInstance.getQueryInterface().showAllTables ? sequelizeInstance.getQueryInterface().showAllTables() : []);
      const tableNames = (rawTables || []).map(t => (t && (t.tableName || t.name)) || t).map(String).map(s => s.toLowerCase());
      const hasYeuCau = tableNames.includes('yeucaudichvu');
      const hasCanLamSang = tableNames.includes('canlamsang');
      const hasChiTietYeuCau = tableNames.includes('chitietyeucaudichvu');

      if (models && models.YeuCauDichVu && hasYeuCau) {
        const ycInclude = { model: models.YeuCauDichVu, as: 'YeuCauDichVu', required: false, include: [] };
        if (models && models.ChiTietYeuCauDichVu && hasChiTietYeuCau) {
          ycInclude.include.push({ model: models.ChiTietYeuCauDichVu, as: 'ChiTietYeuCau', required: false });
        }
        if (models && models.CanLamSang && hasCanLamSang) {
          ycInclude.include.push({ model: models.CanLamSang, as: 'KetQuaCanLamSang', required: false, include: [
            { model: models.NguoiDung, as: 'NguoiXacNhan', required: false }
          ] });
        }
        includes.push(ycInclude);
      }
    } catch (e) {
      console.warn('getRecordById: could not enumerate tables for legacy includes', e && e.message);
    }
  }

  const rawAttrs = PreferredRecordForGet.rawAttributes || {};
  const pkAttr = (PreferredRecordForGet.primaryKeyAttributes || [])[0];
  const pkTypeKey = pkAttr && rawAttrs[pkAttr] && rawAttrs[pkAttr].type && rawAttrs[pkAttr].type.key;
  const pkIsNumeric = ['INTEGER', 'BIGINT', 'DECIMAL', 'FLOAT', 'DOUBLE'].includes(String(pkTypeKey || '').toUpperCase());
  const canUsePkLookup = !pkIsNumeric || /^\d+$/.test(idText);

  const findByPkWithSafeInclude = async (lookupId) => {
    try {
      return await PreferredRecordForGet.findByPk(lookupId, { include: includes });
    } catch (e) {
      console.warn('getRecordById: findByPk with include failed, retrying without include -', e && e.message);
      return await PreferredRecordForGet.findByPk(lookupId);
    }
  };

  const findOneWithSafeInclude = async (whereClause, orderClause = null) => {
    const baseOptions = { where: whereClause };
    if (Array.isArray(orderClause) && orderClause.length > 0) baseOptions.order = orderClause;
    try {
      return await PreferredRecordForGet.findOne({ ...baseOptions, include: includes });
    } catch (e) {
      console.warn('getRecordById: findOne with include failed, retrying without include -', e && e.message);
      return await PreferredRecordForGet.findOne(baseOptions);
    }
  };

  let rec;
  if (canUsePkLookup) {
    try {
      rec = await findByPkWithSafeInclude(idText);
    } catch (e) {
      console.error('getRecordById: DB error during PK lookup - message:', e && e.message);
      console.error('getRecordById: DB error during PK lookup - name:', e && e.name);
      console.error('getRecordById: DB error during PK lookup - stack:', e && e.stack);
      // Continue to alternate key lookup below.
      rec = null;
    }
  }

  // If not found by PK, try common alternate keys (ExaminationCode / AppointmentID / PatientID)
  if (!rec) {
    try {
      const tmpMatch = /^TMP-([A-Za-z0-9_-]+)-\d+$/.exec(idText);
      const derivedAppointmentId = tmpMatch ? tmpMatch[1] : null;
      const altOr = [];
      const pushIfAttr = (attr, value) => {
        if (value && Object.prototype.hasOwnProperty.call(rawAttrs, attr)) {
          altOr.push({ [attr]: value });
        }
      };

      // MedicalExamination attributes
      pushIfAttr('AppointmentID', idText);
      pushIfAttr('PatientID', idText);
      if (derivedAppointmentId) pushIfAttr('AppointmentID', derivedAppointmentId);

      // Legacy MedicalRecord attributes (if present)
      pushIfAttr('recordCode', idText);
      pushIfAttr('appointmentId', idText);
      pushIfAttr('patientId', idText);
      if (derivedAppointmentId) pushIfAttr('appointmentId', derivedAppointmentId);

      if (altOr.length > 0) {
        const orderClause = [];
        if (Object.prototype.hasOwnProperty.call(rawAttrs, 'createdAt')) {
          orderClause.push(['createdAt', 'DESC']);
        } else if (Object.prototype.hasOwnProperty.call(rawAttrs, 'ExaminationID')) {
          orderClause.push(['ExaminationID', 'DESC']);
        } else if (Object.prototype.hasOwnProperty.call(rawAttrs, 'id')) {
          orderClause.push(['id', 'DESC']);
        }

        rec = await findOneWithSafeInclude(
          { [Op.or]: altOr },
          orderClause
        );
      }
    } catch (e) {
      console.error('getRecordById (alt lookup) DB error -', e && e.message);
      console.error('getRecordById (alt lookup) stack -', e && e.stack);
      // Be forgiving: return null so frontend can continue with draft-only "Tiếp tục khám" flows
      return successResponse(res, null);
    }
  }

  if (!rec) return successResponse(res, null);
  const plain = rec.get ? rec.get({ plain: true }) : rec;

  // Keep a stable response shape for frontend resume flow.
    if (usingMedicalExaminationModel) {
    const formatExaminationIDString = (seq, createdAt) => {
      if (!seq) return null;
      const d = createdAt ? new Date(createdAt) : new Date();
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `PK-${y}${m}${day}-${String(seq).padStart(6, '0')}`;
    };

    const computedCode = plain && (plain.ExaminationID || plain.id) ? formatExaminationIDString(plain.ExaminationID || plain.id, plain.CreatedAt || plain.ExaminationDate) : (plain && (plain.ExaminationCode || plain.examinationCode || plain.maPhieuKham)) || null;
    const normalized = {
      ...(rec.toJSON ? rec.toJSON() : {}),
      ...plain,
      id: plain.ExaminationID || plain.id,
      recordId: plain.ExaminationID || plain.id,
      examinationCode: computedCode,
      appointmentId: plain.AppointmentID || plain.appointmentId,
      patientId: plain.PatientID || plain.patientId,
      doctorId: plain.DoctorID || plain.doctorId,
      diagnosis: plain.Diagnosis || plain.diagnosis,
      treatment: plain.TreatmentAdvice || plain.treatment,
      notes: plain.Notes || plain.notes,
      maPhieuKham: computedCode,
    };
    return successResponse(res, normalized);
  }

  return successResponse(res, plain);
});


// Create medical record (supports DB if model exists, else returns synthetic object)
const createRecord = asyncHandler(async (req, res) => {
  const payload = req.body || {};
  // Ensure visit code exists (backend-generated if caller didn't provide)
  if (!payload.maPhieuKham && !payload.visitCode && !payload.recordCode) {
    payload.maPhieuKham = generateVisitCode();
  }
  
  // Debug: log which model is being used
  console.log('createRecord: models loaded:', Object.keys(models || {}));
  console.log('createRecord: models.MedicalExamination exists?', !!(models && models.MedicalExamination));
  
  // If model exists, create in DB (prefer MedicalExamination if available)
  const PreferredRecordForCreate = (models && models.MedicalExamination) || MedicalRecord;
  console.log('createRecord: using model:', PreferredRecordForCreate.name || 'unknown');
  
  if (PreferredRecordForCreate && typeof PreferredRecordForCreate.create === 'function') {
    // Normalize payload keys when persisting to MedicalExamination table
    let toCreate = payload;
    if (models && models.MedicalExamination && PreferredRecordForCreate === models.MedicalExamination) {
      toCreate = {};
      // Do not persist ExaminationCode column (may have been removed). We'll compute maPhieuKham from ExaminationID after create.
      toCreate.AppointmentID = payload.appointmentId || payload.appointmentRef?.id || payload.AppointmentID;
      toCreate.PatientID = payload.patientId || payload.patient?.id || payload.PatientID;
      toCreate.DoctorID = payload.doctorId || payload.doctorId || payload.DoctorID;
      toCreate.ExaminationDate = payload.examinationDate || payload.createdAt || payload.ExaminationDate;
      toCreate.Symptoms = payload.symptoms || payload.purpose || payload.Symptoms;
      // Map treatment/diagnosis/notes
      toCreate.Diagnosis = payload.diagnosis || payload.Diagnosis;
      toCreate.TreatmentAdvice = payload.treatment || payload.treatmentAdvice || payload.TreatmentAdvice;
      toCreate.Notes = payload.notes || payload.Notes;
      // Map vital signs if provided as object
      if (payload.vitalSigns && typeof payload.vitalSigns === 'object') {
        const vs = payload.vitalSigns;
        if (vs.bloodPressure) toCreate.BloodPressure = vs.bloodPressure;
        if (vs.pulse) toCreate.Pulse = vs.pulse;
        if (vs.temperature) toCreate.Temperature = vs.temperature;
        if (vs.spO2) toCreate.SpO2 = vs.spO2;
        if (vs.respirationRate) toCreate.RespirationRate = vs.respirationRate;
        if (vs.weight) toCreate.Weight = vs.weight;
        if (vs.height) toCreate.Height = vs.height;
        if (vs.bmi) toCreate.BMI = vs.bmi;
      }
    }
    // Validate required NOT NULL columns for MedicalExamination table
    if (models && models.MedicalExamination && PreferredRecordForCreate === models.MedicalExamination) {
      if (!toCreate.AppointmentID || !toCreate.PatientID) {
        console.warn('createRecord: validation failed - missing AppointmentID or PatientID');
        return errorResponse(res, 'Thiếu AppointmentID hoặc PatientID trong payload', 400, 'VALIDATION_ERROR');
      }
    }

    try {
      console.log('createRecord: attempting to create with toCreate=', JSON.stringify(toCreate, null, 2));

      const usingMedicalExaminationModel = Boolean(models && models.MedicalExamination && PreferredRecordForCreate === models.MedicalExamination);

      if (usingMedicalExaminationModel) {
        const sequelizeInstance = PreferredRecordForCreate.sequelize;
        const transaction = await sequelizeInstance.transaction();
        try {
          // Avoid MSSQL OUTPUT conflict on tables with triggers by using raw INSERT.
          const now = new Date();
          const createPayload = { ...toCreate };
          if (!Object.prototype.hasOwnProperty.call(createPayload, 'CreatedAt')) createPayload.CreatedAt = now;
          if (!Object.prototype.hasOwnProperty.call(createPayload, 'UpdatedAt')) createPayload.UpdatedAt = now;

          const cols = Object.keys(createPayload).filter(k => createPayload[k] !== undefined);
          const colList = cols.map(c => `[${c}]`).join(',');
          const paramList = cols.map(c => `:${c}`).join(',');

          const insertSql = `
            DECLARE @Inserted TABLE (ExaminationID BIGINT);
            INSERT INTO [MedicalExamination] (${colList})
            OUTPUT INSERTED.ExaminationID INTO @Inserted
            VALUES (${paramList});
            SELECT ExaminationID FROM @Inserted;
          `;

          const insertedRows = await sequelizeInstance.query(insertSql, {
            replacements: createPayload,
            transaction,
            type: QueryTypes.SELECT,
          });

          const seq = insertedRows && insertedRows[0] ? (insertedRows[0].ExaminationID || insertedRows[0].examinationid || insertedRows[0].ExaminationID) : null;
          if (!seq) throw new Error('Không lấy được ExaminationID sau khi tạo hồ sơ khám');

          // Compute a client-visible visit code derived from ExaminationID and created date
          const y = now.getFullYear();
          const m = String(now.getMonth() + 1).padStart(2, '0');
          const d = String(now.getDate()).padStart(2, '0');
          const finalCode = `PK-${y}${m}${d}-${String(seq).padStart(6, '0')}`;

          // Read authoritative row from DB (we won't write ExaminationCode as column no longer exists)
          const rows = await sequelizeInstance.query(
            'SELECT * FROM [MedicalExamination] WHERE [ExaminationID] = :id',
            { replacements: { id: seq }, transaction, type: QueryTypes.SELECT }
          );
          const plain = (rows && rows[0]) ? rows[0] : { ...createPayload, ExaminationID: seq };

          await transaction.commit();

          const normalized = { ...plain };
          if (!normalized.id) normalized.id = normalized.ExaminationID || normalized.Id || normalized.id;
          if (!normalized.recordId) normalized.recordId = normalized.id;
          // surface the computed visit code to the client
          normalized.maPhieuKham = finalCode;
          console.log('createRecord: successfully created (MedicalExamination raw), id=', normalized.id);
          return createdResponse(res, normalized, 'Đã tạo hồ sơ khám');
        } catch (eInner) {
          await transaction.rollback();
          throw eInner;
        }
      }

      // Fallback: legacy model create
      const created = await PreferredRecordForCreate.create(toCreate);
      const plain = created.get ? created.get({ plain: true }) : created;
      const normalized = { ...plain };
      if (!normalized.id) normalized.id = normalized.ExaminationID || normalized.Id || normalized.id;
      if (!normalized.recordId) normalized.recordId = normalized.id;
      if (!normalized.maPhieuKham) {
        if (normalized.ExaminationCode) normalized.maPhieuKham = normalized.ExaminationCode;
        else if (normalized.ExaminationID) {
          const d = normalized.CreatedAt ? new Date(normalized.CreatedAt) : new Date();
          const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, '0'); const day = String(d.getDate()).padStart(2, '0');
          normalized.maPhieuKham = `PK-${y}${m}${day}-${String(normalized.ExaminationID).padStart(6, '0')}`;
        }
      }
      console.log('createRecord: successfully created (legacy), id=', normalized.id);
      return createdResponse(res, normalized, 'Đã tạo hồ sơ khám');
    } catch (e) {
      console.error('createRecord: DB error - message:', e && e.message);
      console.error('createRecord: DB error - code:', e && e.code);
      console.error('createRecord: DB error - name:', e && e.name);
      console.error('createRecord: DB error - sql:', e && e.sql);
      console.error('createRecord: DB error - original:', e && e.original && e.original.message);
      console.error('createRecord: DB error - stack:', e && e.stack);
      console.error('createRecord: toCreate was:', JSON.stringify(toCreate, null, 2));
      return errorResponse(res, 'Lỗi cơ sở dữ liệu khi tạo hồ sơ khám', 500, 'DATABASE_ERROR');
    }
  }

  // Fallback: synthesize an id and return payload
  const syntheticId = `REC${Date.now()}`;
  // ensure fallback also includes a generated maPhieuKham for UI display
  const fallbackCode = payload.maPhieuKham || payload.visitCode || payload.recordCode || generateVisitCode();
  const created = { id: syntheticId, maPhieuKham: fallbackCode, ...payload, createdAt: new Date().toISOString() };
  return createdResponse(res, created, 'Đã tạo hồ sơ khám (tạm, không lưu DB)');
});

// Update medical record (DB if available, else echo back)
const updateRecord = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const payload = req.body || {};
  const PreferredRecordForUpdate = (models && models.MedicalExamination) || MedicalRecord;
  if (PreferredRecordForUpdate && typeof PreferredRecordForUpdate.findByPk === 'function') {
    let rec;
    try {
      rec = await PreferredRecordForUpdate.findByPk(id);
    } catch (e) {
      console.error('updateRecord: DB error', e && e.message);
      return errorResponse(res, 'Lỗi cơ sở dữ liệu khi đọc hồ sơ khám', 500, 'DATABASE_ERROR');
    }
    if (!rec) {
      return successResponse(res, null);
    }
    // Preserve visit code (maPhieuKham) if already exists and not in payload
    if (!payload.maPhieuKham && !payload.visitCode && !payload.recordCode) {
      const existing = rec.get ? rec.get({ plain: true }) : rec;
      if (existing?.maPhieuKham || existing?.visitCode || existing?.recordCode) {
        payload.maPhieuKham = existing.maPhieuKham || existing.visitCode || existing.recordCode;
      } else {
        // If still no code, generate one
        payload.maPhieuKham = generateVisitCode();
      }
    }
    // If updating MedicalExamination normalize update payload
    let toUpdate = payload;
    if (models && models.MedicalExamination && PreferredRecordForUpdate === models.MedicalExamination) {
      toUpdate = {};
      if (payload.diagnosis) toUpdate.Diagnosis = payload.diagnosis;
      if (payload.treatment) toUpdate.TreatmentAdvice = payload.treatment;
      if (payload.notes) toUpdate.Notes = payload.notes;
      if (payload.nextAppointment) toUpdate.ReExaminationDate = payload.nextAppointment;
      if (payload.vitalSigns && typeof payload.vitalSigns === 'object') {
        const vs = payload.vitalSigns;
        if (vs.bloodPressure) toUpdate.BloodPressure = vs.bloodPressure;
        if (vs.pulse) toUpdate.Pulse = vs.pulse;
        if (vs.temperature) toUpdate.Temperature = vs.temperature;
        if (vs.spO2) toUpdate.SpO2 = vs.spO2;
        if (vs.respirationRate) toUpdate.RespirationRate = vs.respirationRate;
        if (vs.weight) toUpdate.Weight = vs.weight;
        if (vs.height) toUpdate.Height = vs.height;
        if (vs.bmi) toUpdate.BMI = vs.bmi;
      }
    }
    try {
      await rec.update(toUpdate);
    } catch (e) {
      console.error('updateRecord: DB error on update', e && e.message);
      return errorResponse(res, 'Lỗi cơ sở dữ liệu khi cập nhật hồ sơ khám', 500, 'DATABASE_ERROR');
    }
    const plain = rec.get ? rec.get({ plain: true }) : rec;
    return successResponse(res, plain);
  }

  // Fallback: preserve visit code on update
  if (!payload.maPhieuKham && !payload.visitCode && !payload.recordCode) {
    payload.maPhieuKham = generateVisitCode();
  }
  const updated = { id, ...payload, updatedAt: new Date().toISOString() };
  return successResponse(res, updated);
});

// exports consolidated at end of file
// Start examination (mark in-progress)
const startExamination = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const actorId = req.user?.id || null;
  const PreferredRecordForStart = (models && models.MedicalExamination) || MedicalRecord;
  if (PreferredRecordForStart && typeof PreferredRecordForStart.findByPk === 'function') {
    let rec;
    try {
      rec = await PreferredRecordForStart.findByPk(id);
    } catch (e) {
      console.error('startExamination: DB error', e && e.message);
      return errorResponse(res, 'Lỗi cơ sở dữ liệu khi bắt đầu khám', 500, 'DATABASE_ERROR');
    }
    if (!rec) return successResponse(res, null);
    try {
      // For MedicalExamination table, map startedAt -> ExaminationDate and avoid status column
      if (models && models.MedicalExamination && PreferredRecordForStart === models.MedicalExamination) {
        await rec.update({ ExaminationDate: new Date(), DoctorID: actorId });
      } else {
        await rec.update({ status: MEDICAL_RECORD_STATUS.IN_PROGRESS, startedAt: new Date(), doctorId: actorId });
      }
    } catch (e) {
      console.error('startExamination: DB error on update', e && e.message);
      return errorResponse(res, 'Lỗi cơ sở dữ liệu khi cập nhật trạng thái khám', 500, 'DATABASE_ERROR');
    }
    const plain = rec.get ? rec.get({ plain: true }) : rec;
    return successResponse(res, plain);
  }
  // Fallback: echo object with status
  const out = { id, status: MEDICAL_RECORD_STATUS.IN_PROGRESS, startedAt: new Date().toISOString(), doctorId: actorId };
  return successResponse(res, out);
});

// Complete examination (mark completed and save provided fields)
const completeExamination = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const payload = req.body || {};
  const actorId = req.user?.id || null;

  const PreferredRecordForComplete = (models && models.MedicalExamination) || MedicalRecord;
  if (PreferredRecordForComplete && typeof PreferredRecordForComplete.findByPk === 'function') {
    let rec;
    try {
      rec = await PreferredRecordForComplete.findByPk(id);
    } catch (e) {
      console.error('completeExamination: DB error', e && e.message);
      return errorResponse(res, 'Lỗi cơ sở dữ liệu khi đọc hồ sơ khám', 500, 'DATABASE_ERROR');
    }
    if (!rec) return successResponse(res, null);
    // Normalize updates for MedicalExamination table
    let updates = {};
    if (models && models.MedicalExamination && PreferredRecordForComplete === models.MedicalExamination) {
      if (payload.diagnosis) updates.Diagnosis = payload.diagnosis;
      if (payload.treatment) updates.TreatmentAdvice = payload.treatment;
      if (payload.notes) updates.Notes = payload.notes;
      if (payload.nextAppointment) updates.ReExaminationDate = payload.nextAppointment;
      if (payload.vitalSigns && typeof payload.vitalSigns === 'object') {
        const vs = payload.vitalSigns;
        if (vs.bloodPressure) updates.BloodPressure = vs.bloodPressure;
        if (vs.pulse) updates.Pulse = vs.pulse;
        if (vs.temperature) updates.Temperature = vs.temperature;
        if (vs.spO2) updates.SpO2 = vs.spO2;
        if (vs.respirationRate) updates.RespirationRate = vs.respirationRate;
        if (vs.weight) updates.Weight = vs.weight;
        if (vs.height) updates.Height = vs.height;
        if (vs.bmi) updates.BMI = vs.bmi;
      }
    } else {
      updates = {
        diagnosis: payload.diagnosis || rec.diagnosis,
        treatment: payload.treatment || rec.treatment,
        notes: payload.notes || rec.notes,
        nextAppointment: payload.nextAppointment || rec.nextAppointment,
        vitalSigns: payload.vitalSigns || rec.vitalSigns,
        status: MEDICAL_RECORD_STATUS.COMPLETED,
        completedAt: new Date(),
        confirmedBy: actorId,
      };
    }
    try {
      await rec.update(updates);
    } catch (e) {
      console.error('completeExamination: DB error on update', e && e.message);
      return errorResponse(res, 'Lỗi cơ sở dữ liệu khi hoàn tất khám', 500, 'DATABASE_ERROR');
    }
    const plain = rec.get ? rec.get({ plain: true }) : rec;
    return successResponse(res, plain);
  }

  // Fallback: respond with synthesized completed object
  const out = {
    id,
    ...payload,
    status: MEDICAL_RECORD_STATUS.COMPLETED,
    completedAt: new Date().toISOString(),
    confirmedBy: actorId,
  };
  return successResponse(res, out);
});

export { getTodayQueue, getAllRecords, getRecordById, createRecord, updateRecord, startExamination, completeExamination };
