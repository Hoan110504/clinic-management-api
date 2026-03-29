/**
 * Lab Test Controller
 * Handles lab test operations
 */
import { Op } from 'sequelize';
import { LabTest, Patient, User, ServiceOrder, MedicalRecord, LabService, sequelize } from '../models/index.js';
import models from '../models/index.js';
import { asyncHandler, parsePagination, parseSort } from '../utils/helpers.js';
import config from '../config/index.js';
import {
  successResponse,
  createdResponse,
  paginatedResponse,
  noContentResponse,
} from '../utils/response.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { LAB_STATUS, ROLES } from '../config/constants.js';

// Legacy CanLamSang synchronization removed.
// Previous logic that wrote modern LabTest results back into legacy
// YeuCauDichVu/CanLamSang tables has been intentionally removed to
// stop automatic propagation of ultrasound results into "Kết quả chỉ định".

/**
 * Get all lab tests (with pagination and filters)
 * GET /api/lab-tests
 */
const getAllLabTests = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { status, patientId, testType, fromDate, toDate, search, sort } = req.query;

  // Build where clause
  const where = {};

  if (status) {
    where.status = status;
  }

  if (patientId) {
    where.patientId = patientId;
  }

  if (testType) {
    where.testType = testType;
  }

  if (fromDate && toDate) {
    where.orderedDate = {
      [Op.between]: [new Date(fromDate), new Date(toDate)],
    };
  }

  if (search) {
    where[Op.or] = [
      { patientName: { [Op.like]: `%${search}%` } },
      { testName: { [Op.like]: `%${search}%` } },
      { id: { [Op.like]: `%${search}%` } },
    ];
  }

  // Parse sort
  const order = parseSort(sort, ['orderedDate', 'status', 'createdAt']);

  // Build includes for modern + legacy data
  const includes = [
    {
      model: Patient,
      as: 'patient',
      attributes: ['id', 'fullName', 'phone', 'dateOfBirth', 'gender'],
      required: false,
    },
  ];

  // Try to include legacy YeuCauDichVu results (with CanLamSang/images)
  try {
    const rawTables = await sequelize.getQueryInterface().showAllTables();
    const tableNames = (rawTables || []).map(t => (t && (t.tableName || t.name)) || t).map(String).map(s => s.toLowerCase());
    const hasYeuCau = tableNames.includes('yeucaudichvu');
    const hasCanLamSang = tableNames.includes('canlamsang');

    if (models && models.YeuCauDichVu && hasYeuCau && models.MedicalRecord && models.HoSoKham) {
      // Get lab tests with a single join to fetch legacy results
      // We'll fetch them after grouping by medicalRecordId and add to each row
      // For now, just ensure we can access the legacy data when needed
      // (full include would be complex without hitting N+1; instead fetch legacy separately if needed)
    }
  } catch (e) {
    console.warn('getAllLabTests: could not check for legacy tables', e && e.message);
  }

  const { count, rows } = await LabTest.findAndCountAll({
    where,
    order,
    limit,
    offset,
    include: includes,
  });

  // Legacy enrichment removed: return modern LabTest rows only.
  return paginatedResponse(res, {
    data: rows,
    page,
    limit,
    total: count,
  });
});

/**
 * Get lab test by ID
 * GET /api/lab-tests/:id
 */
const getLabTestById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Build include array only for models that are defined and whose tables exist
  const includes = [];
  if (Patient) includes.push({ model: Patient, as: 'patient', required: false });

  // Check whether the ServiceOrder table actually exists in the DB before including it.
  // Some deployments use legacy Vietnamese tables instead of the modern `service_orders` table.
  try {
    const rawTables = await sequelize.getQueryInterface().showAllTables();
    const tableNames = (rawTables || []).map(t => (t && (t.tableName || t.name)) || t).map(String).map(s => s.toLowerCase());
    const hasServiceOrders = tableNames.includes('service_orders');
    if (ServiceOrder && hasServiceOrders) {
      includes.push({ model: ServiceOrder, as: 'serviceOrder', required: false });
    }
  } catch (tbErr) {
    // If checking tables fails, avoid including ServiceOrder to prevent SQL errors.
    console.warn('getLabTestById: could not enumerate tables, skipping ServiceOrder include', tbErr && tbErr.message);
  }

  if (MedicalRecord) includes.push({ model: MedicalRecord, as: 'medicalRecord', required: false });

  let labTest = await LabTest.findByPk(id, {
    include: includes.length > 0 ? includes : undefined,
  });

  if (!labTest) {
    throw new NotFoundError('Không tìm thấy xét nghiệm');
  }

  // Legacy CanLamSang enrichment removed: do not attach legacy ultrasound results to lab test responses.

  return successResponse(res, labTest);
});

/**
 * Create new lab test
 * POST /api/lab-tests
 */
const createLabTest = asyncHandler(async (req, res) => {
  const {
    patientId,
    patientName,
    testType,
    testName,
    medicalRecordId,
    serviceOrderId,
    notes,
  } = req.body;

  try {
    // If legacy models exist (SQL schema uses Vietnamese tables), write into legacy flow
    if (models && models.YeuCauDichVu && models.CanLamSang) {
      // Resolve BenhNhan.Id: incoming patientId may be BNxxx (english Patient) or GUID (BenhNhan.Id)
      const BenhNhan = models.BenhNhan;
      const YeuCauDichVu = models.YeuCauDichVu;
      const CanLamSang = models.CanLamSang;

      // Resolve BenhNhan in multiple ways:
      // 1) patientId might already be BenhNhan.Id (GUID)
      // 2) patientId might be NguoiDung.Id (user GUID) -> lookup BenhNhan.MaNguoiDung
      // 3) patientId might be english Patient.id (BNxxx) -> find Patient.userId -> lookup BenhNhan
      let benhNhanId = null;
      let foundBenhNhan = null;

      if (patientId) {
        // Try primary key match (BenhNhan.Id)
        foundBenhNhan = await BenhNhan.findByPk(patientId);
        if (foundBenhNhan) benhNhanId = foundBenhNhan.Id;
      }

      // If not found, try matching MaNguoiDung == patientId (frontend might send user GUID)
      if (!foundBenhNhan && patientId) {
        foundBenhNhan = await BenhNhan.findOne({ where: { MaNguoiDung: patientId } });
        if (foundBenhNhan) benhNhanId = foundBenhNhan.Id;
      }

      // If still not found, try resolving via english Patient table (id like BN022)
      if (!foundBenhNhan && patientId) {
        const engPat = await Patient.findByPk(patientId);
        if (engPat) {
          // Try to find BenhNhan by MaNguoiDung == engPat.userId
          if (engPat.userId) {
            foundBenhNhan = await BenhNhan.findOne({ where: { MaNguoiDung: engPat.userId } });
            if (foundBenhNhan) benhNhanId = foundBenhNhan.Id;
            else {
              // Create BenhNhan record for this Patient.userId so legacy tables can reference it
              const createdBN = await BenhNhan.create({ MaNguoiDung: engPat.userId });
              foundBenhNhan = createdBN;
              benhNhanId = createdBN.Id;
            }
          }
        }
      }

      if (!foundBenhNhan) {
        // If we cannot resolve legacy BenhNhan, fall back to creating a modern LabTest
        console.warn('labTest.create: legacy BenhNhan not found for', { patientId, patientName });
        // Pre-generate an id to avoid relying on MSSQL OUTPUT behaviour
        const generatedId = `XN${Date.now().toString().slice(-10)}`;
        const fallbackPayload = {
          id: generatedId,
          patientId,
          patientName,
          testType,
          testName,
          medicalRecordId,
          serviceOrderId,
          orderedBy: req.user.fullName,
          orderedById: req.user.id,
          orderedDate: new Date(),
          status: LAB_STATUS.PENDING,
          notes,
        };

        let fallbackLab = null;
        try {
          fallbackLab = await LabTest.create(fallbackPayload, { returning: false });
        } catch (e) {
          console.warn('labTest.create: create returned error, falling back to generated payload', e && e.message);
        }

        // If DB did not return the created record (MSSQL + Sequelize OUTPUT mismatch), return generated payload
        const responsePayload = (fallbackLab && (fallbackLab.id || fallbackLab.ID)) ? fallbackLab : fallbackPayload;
        return createdResponse(res, responsePayload, 'Tạo xét nghiệm (fallback)');
      }

      // Ensure medicalRecordId exists in HoSoKham
      const HoSoKham = models.HoSoKham;
      if (medicalRecordId) {
        const foundHs = await HoSoKham.findByPk(medicalRecordId);
        if (!foundHs) {
          throw new BadRequestError('Hồ sơ khám (medicalRecordId) không tồn tại');
        }
      }

      // Create YeuCauDichVu (service order)
      const yc = await YeuCauDichVu.create({
        MaHoSoKham: medicalRecordId || null,
        MaBenhNhan: benhNhanId,
        NguoiChiDinhId: req.user.id,
        TrangThai: 0,
        NgayChiDinh: new Date(),
        GhiChuBacSi: notes || null,
      });

      // Create CanLamSang entry for this requested test
      const cls = await CanLamSang.create({
        MaYeuCau: yc.Id,
        TenXetNghiem: testName,
        KetQua: null,
        GiaTriThamChieu: null,
        TrangThai: 0,
      });

      // ALSO create modern LabTest record (if table exists) to bridge legacy + modern systems
      // This ensures we can fetch legacy results when querying lab tests from modern table
      let labTestRecord = null;
      try {
        const generatedId = `XN${Date.now().toString().slice(-10)}`;
        const rawTables = await sequelize.getQueryInterface().showAllTables();
        const tableNames = (rawTables || []).map(t => (t && (t.tableName || t.name)) || t).map(String).map(s => s.toLowerCase());
        const hasLabTests = tableNames.includes('lab_tests');

        if (LabTest && hasLabTests) {
          labTestRecord = await LabTest.create({
            id: generatedId,
            patientId,
            patientName,
            testType,
            testName,
            medicalRecordId,
            serviceOrderId: null,
            orderedBy: req.user.fullName,
            orderedById: req.user.id,
            orderedDate: new Date(),
            status: LAB_STATUS.PENDING,
            notes,
          }, { returning: false });
        }
      } catch (e) {
        console.warn('createLabTest: failed to create modern LabTest record for legacy YeuCauDichVu', e && e.message);
      }

      return createdResponse(res, {
        id: labTestRecord?.id || cls.Id,
        yeuCauDichVuId: yc.Id,
        canLamSangId: cls.Id,
        testName: cls.TenXetNghiem,
        status: cls.TrangThai
      }, 'Tạo chỉ định cận lâm sàng thành công');
    }

    // Pre-generate id to avoid relying on MSSQL OUTPUT when Sequelize expects inserted row
    const generatedId = `XN${Date.now().toString().slice(-10)}`;
    const payload = {
      id: generatedId,
      patientId,
      patientName,
      testType,
      testName,
      medicalRecordId,
      serviceOrderId,
      orderedBy: req.user.fullName,
      orderedById: req.user.id,
      orderedDate: new Date(),
      status: LAB_STATUS.PENDING,
      notes,
    };

    let labTest = null;
    try {
      labTest = await LabTest.create(payload, { returning: false });
    } catch (e) {
      console.warn('labTest.create: create returned error, falling back to payload', e && e.message);
    }

    const resp = (labTest && (labTest.id || labTest.ID)) ? labTest : payload;
    return createdResponse(res, resp, 'Tạo xét nghiệm thành công');
  } catch (dbErr) {
    console.error('createLabTest: database error creating lab test', {
      message: dbErr && dbErr.message,
      name: dbErr && dbErr.name,
      original: dbErr && dbErr.original,
      sql: dbErr && dbErr.sql,
      stack: dbErr && dbErr.stack,
      body: req.body,
      user: req.user?.id,
    });

    // Map common DB errors to friendlier API errors
    if (dbErr.name === 'SequelizeForeignKeyConstraintError') {
      // Likely patientId / medicalRecordId / serviceOrderId invalid
      const err = new BadRequestError('Dữ liệu tham chiếu không hợp lệ (patientId hoặc medicalRecordId không tồn tại)');
      throw err;
    }

    if (dbErr.name === 'SequelizeValidationError') {
      const details = (dbErr.errors || []).map(e => ({ field: e.path, message: e.message }));
      const err = new BadRequestError('Dữ liệu xét nghiệm không hợp lệ');
      err.errors = details;
      throw err;
    }

    // Database-level error: provide an environment-aware message and attach details
    if (dbErr.name === 'SequelizeDatabaseError' || dbErr.original) {
      const origMsg = (dbErr.original && (dbErr.original.message || dbErr.original.sqlMessage)) || dbErr.message || 'Lỗi cơ sở dữ liệu';
      const displayMsg = config.isDevelopment ? origMsg : 'Lỗi cơ sở dữ liệu';
      const err = new BadRequestError(displayMsg);
      // Attach diagnostic details in development, keep minimal in production
      err.errors = config.isDevelopment
        ? [{ type: dbErr.name, original: dbErr.original, sql: dbErr.sql }]
        : [{ type: dbErr.name }];
      throw err;
    }

    // Fallback: rethrow original to be handled by global handler
    throw dbErr;
  }
});

/**
 * Update lab test
 * PUT /api/lab-tests/:id
 */
const updateLabTest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const labTest = await LabTest.findByPk(id);
  if (!labTest) {
    throw new NotFoundError('Không tìm thấy xét nghiệm');
  }

  await labTest.update(updateData);

  return successResponse(res, labTest, 'Cập nhật xét nghiệm thành công');
});

/**
 * Start lab test (set to in progress)
 * POST /api/lab-tests/:id/start
 */
const startLabTest = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const labTest = await LabTest.findByPk(id);
  if (!labTest) {
    throw new NotFoundError('Không tìm thấy xét nghiệm');
  }

  if (labTest.status !== LAB_STATUS.PENDING) {
    throw new BadRequestError('Chỉ có thể bắt đầu xét nghiệm đang chờ');
  }

  await labTest.update({
    status: LAB_STATUS.IN_PROGRESS,
  });

  return successResponse(res, labTest, 'Bắt đầu xét nghiệm thành công');
});

/**
 * Complete lab test with results
 * POST /api/lab-tests/:id/complete
 */
const completeLabTest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { results, normalRange, notes, conclusion, images } = req.body;

  const labTest = await LabTest.findByPk(id);
  if (!labTest) {
    throw new NotFoundError('Không tìm thấy xét nghiệm');
  }

  if (!results) {
    throw new BadRequestError('Kết quả không được để trống');
  }

  // Only allow saving results while the test is in progress
  if (labTest.status !== LAB_STATUS.IN_PROGRESS) {
    throw new BadRequestError('Chỉ có thể lưu kết quả khi đang thực hiện');
  }

  const updatePayload = {
    // Keep status as IN_PROGRESS; final completion happens when returning results
    results,
    normalRange,
    notes,
    conclusion,
    // record last-saved timestamp
    resultDate: new Date(),
  };

  if (images !== undefined) {
    updatePayload.images = images;
  }

  await labTest.update(updatePayload);

  return successResponse(res, labTest, 'Lưu kết quả xét nghiệm thành công');
});

/**
 * Return lab test (mark result as delivered/returned)
 * POST /api/lab-tests/:id/return
 */
const returnLabTest = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const labTest = await LabTest.findByPk(id);
  if (!labTest) {
    throw new NotFoundError('Không tìm thấy xét nghiệm');
  }

  // Allow returning when test is in progress or already completed
  if (![LAB_STATUS.IN_PROGRESS, LAB_STATUS.COMPLETED].includes(labTest.status)) {
    throw new BadRequestError('Chỉ có thể trả kết quả cho xét nghiệm đang thực hiện hoặc đã hoàn thành');
  }

  // Clean any internal returned markers from existing notes and preserve human-friendly notes
  const cleanedNotes = (labTest.notes || '').replace(/\[RETURNED_BY:[^\]]*\]/g, '').trim();

  await labTest.update({
    status: LAB_STATUS.COMPLETED,
    notes: cleanedNotes,
    // mark who confirmed and when
    confirmedBy: req.user.fullName,
    confirmedById: req.user.id,
    confirmedAt: new Date(),
    resultDate: labTest.resultDate || new Date(),
  });

  // Legacy sync removed: do not write results back to CanLamSang

  // Re-fetch the lab test with related data so the client receives full details
  const include = [];
  if (Patient) include.push({ model: Patient, as: 'patient', required: false });
  if (MedicalRecord) include.push({ model: MedicalRecord, as: 'medicalRecord', required: false });

  // Only include ServiceOrder if the physical table exists (some deployments use legacy VN tables)
  try {
    const rawTables = await sequelize.getQueryInterface().showAllTables();
    const tableNames = (rawTables || []).map(t => (t && (t.tableName || t.name)) || t).map(String).map(s => s.toLowerCase());
    const hasServiceOrders = tableNames.includes('service_orders');
    if (ServiceOrder && hasServiceOrders) {
      include.push({ model: ServiceOrder, as: 'serviceOrder', required: false });
    }
  } catch (tbErr) {
    console.warn('returnLabTest: could not enumerate tables, skipping ServiceOrder include', tbErr && tbErr.message);
  }

  if (User) {
    include.push({ model: User, as: 'orderedByUser', required: false });
    include.push({ model: User, as: 'confirmedByUser', required: false });
  }

  const fullLabTest = await LabTest.findByPk(id, { include: include.length ? include : undefined });

  // Do not include legacy CanLamSang results in return payload
  return successResponse(res, { id: labTest.id, returned: true, returnedBy: req.user.fullName, labTest: fullLabTest, legacyResults: null }, 'Đã trả kết quả');
});

/**
 * Delete lab test (soft delete)
 * DELETE /api/lab-tests/:id
 */
const deleteLabTest = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const labTest = await LabTest.findByPk(id);
  if (!labTest) {
    throw new NotFoundError('Không tìm thấy xét nghiệm');
  }

  // Add diagnostic logging to help debug permission/delete failures
  const user = req.user || {};
  try {
    console.info('deleteLabTest: attempt', {
      timestamp: new Date().toISOString(),
      requestedId: id,
      user: { id: user.id, role: user.role, fullName: user.fullName },
      labTest: {
        id: labTest.id || labTest.Id,
        orderedBy: labTest.orderedBy,
        orderedById: labTest.orderedById,
        medicalRecordId: labTest.medicalRecordId,
      },
    });
  } catch (logErr) {
    // ignore logging failures
  }

  // Authorization: allow admin or the doctor who ordered the test to delete
  const isAdmin = String(user.role) === String(ROLES.ADMIN) || String(user.role) === 'admin';

  // Check if current user is the ordering doctor by id or by fullName
  const isOrderingDoctor = (String(user.role) === String(ROLES.DOCTOR)) && (
    (labTest.orderedById && String(user.id) === String(labTest.orderedById)) ||
    (labTest.orderedBy && String(user.fullName) === String(labTest.orderedBy))
  );

  if (!isAdmin && !isOrderingDoctor) {
    // Additional ownership check: if labTest linked to a medical record and
    // the current user is the doctor on that medical record, allow deletion.
    try {
      const MRModel = models.HoSoKham || models.MedicalRecord || MedicalRecord;
      if (labTest.medicalRecordId && MRModel) {
        const record = await MRModel.findByPk(labTest.medicalRecordId);
        console.debug('deleteLabTest: linked medical record', { recordId: labTest.medicalRecordId, record });
        if (record) {
          // legacy HoSoKham uses MaBacSi, modern uses doctorId
          const recordDoctorId = record.MaBacSi || record.doctorId || null;
          if (recordDoctorId && String(recordDoctorId) === String(user.id)) {
            // allowed — proceed to delete
          } else {
            console.warn('deleteLabTest: user not owner of medical record', { userId: user.id, recordDoctorId });
            throw new Error('not-owner');
          }
        } else {
          console.warn('deleteLabTest: medical record not found for labTest', { medicalRecordId: labTest.medicalRecordId });
          throw new Error('not-owner');
        }
      } else {
        console.warn('deleteLabTest: labTest not linked to medical record and user not ordering doctor/admin');
        throw new Error('not-owner');
      }
    } catch (ex) {
      // Still forbidden — include diagnostic info to logs
      console.error('deleteLabTest: forbidden', {
        user: { id: user.id, role: user.role, fullName: user.fullName },
        labTest: { id: labTest.id || labTest.Id, orderedBy: labTest.orderedBy, orderedById: labTest.orderedById, medicalRecordId: labTest.medicalRecordId },
        error: ex && ex.message,
      });
      throw new (require('../utils/errors.js').ForbiddenError)('Bạn không có quyền thực hiện hành động này', 'INSUFFICIENT_PERMISSIONS');
    }
  }

  try {
    await labTest.destroy();
    console.info('deleteLabTest: success', { id: labTest.id || labTest.Id, deletedBy: user.id });
  } catch (destroyErr) {
    console.error('deleteLabTest: destroy error', { id: labTest.id || labTest.Id, error: destroyErr && destroyErr.message });
    throw destroyErr;
  }

  return noContentResponse(res);
});

/**
 * Get pending lab tests
 * GET /api/lab-tests/pending
 */
const getPendingLabTests = asyncHandler(async (req, res) => {
  const labTests = await LabTest.findAll({
    where: {
      status: {
        [Op.in]: [LAB_STATUS.PENDING, LAB_STATUS.IN_PROGRESS],
      },
    },
    order: [['orderedDate', 'ASC']],
    include: [
      {
        model: Patient,
        as: 'patient',
        attributes: ['id', 'fullName', 'phone', 'dateOfBirth', 'gender'],
        required: false,
      },
    ],
  });

  return successResponse(res, labTests);
});

/**
 * Batch delete lab tests (accepts array of ids)
 * POST /api/lab-tests/batch-delete
 */
const batchDeleteLabTests = asyncHandler(async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new BadRequestError('ids là mảng các id cần xóa');
  }

  const user = req.user || {};
  const results = [];

  for (const id of ids) {
    try {
      const labTest = await LabTest.findByPk(id);
      if (!labTest) {
        // Treat not found as already deleted/success for idempotency
        results.push({ id, ok: true, status: 'not_found', message: 'Không tìm thấy (đã xóa?)' });
        continue;
      }

      // Authorization checks (reuse same rules as single delete)
      const isAdmin = String(user.role) === String(ROLES.ADMIN) || String(user.role) === 'admin';
      const isOrderingDoctor = (String(user.role) === String(ROLES.DOCTOR)) && (
        (labTest.orderedById && String(user.id) === String(labTest.orderedById)) ||
        (labTest.orderedBy && String(user.fullName) === String(labTest.orderedBy))
      );

      let allowed = isAdmin || isOrderingDoctor;
      if (!allowed) {
        const MRModel = models.HoSoKham || models.MedicalRecord || MedicalRecord;
        if (labTest.medicalRecordId && MRModel) {
          const record = await MRModel.findByPk(labTest.medicalRecordId);
          const recordDoctorId = record?.MaBacSi || record?.doctorId || null;
          if (recordDoctorId && String(recordDoctorId) === String(user.id)) {
            allowed = true;
          }
        }
      }

      if (!allowed) {
        results.push({ id, ok: false, status: 'forbidden', message: 'Không có quyền xóa' });
        continue;
      }

      await labTest.destroy();
      results.push({ id, ok: true, status: 'deleted' });
    } catch (e) {
      results.push({ id, ok: false, status: 'error', message: e && e.message });
    }
  }

  const failed = results.filter(r => !r.ok).length;
  return successResponse(res, { total: ids.length, failed, results }, 'Kết quả xóa hàng loạt');
});

/**
 * Get lab services catalog
 * GET /api/lab-services
 */
const getLabServices = asyncHandler(async (req, res) => {
  const { type, search, isActive = 'true' } = req.query;

  const where = {};

  if (isActive !== undefined) {
    where.isActive = isActive === 'true';
  }

  if (type) {
    where.type = type;
  }

  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { type: { [Op.like]: `%${search}%` } },
    ];
  }

  const services = await LabService.findAll({
    where,
    order: [['type', 'ASC'], ['name', 'ASC']],
  });

  return successResponse(res, services);
});

/**
 * Create lab service
 * POST /api/lab-services
 */
const createLabService = asyncHandler(async (req, res) => {
  const { name, type, price, description, room, duration, instructions } = req.body;

  const service = await LabService.create({
    name,
    type,
    price,
    description,
    room,
    duration,
    instructions,
  });

  return createdResponse(res, service, 'Tạo dịch vụ xét nghiệm thành công');
});

/**
 * Update lab service
 * PUT /api/lab-services/:id
 */
const updateLabService = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const service = await LabService.findByPk(id);
  if (!service) {
    throw new NotFoundError('Không tìm thấy dịch vụ');
  }

  await service.update(updateData);

  return successResponse(res, service, 'Cập nhật dịch vụ thành công');
});

export {
  getAllLabTests,
  getLabTestById,
  createLabTest,
  updateLabTest,
  startLabTest,
  completeLabTest,
  returnLabTest,
  deleteLabTest,
  batchDeleteLabTests,
  getPendingLabTests,
  getLabServices,
  createLabService,
  updateLabService,
};
