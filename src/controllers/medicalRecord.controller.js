/**
 * Controller Phiếu Khám Bệnh
 * Quản lý quy trình khám: tiếp nhận → đã đặt lịch → đang khám → hoàn thành
 */
import { Op } from 'sequelize';
import {
  MedicalRecord,
  Patient,
  Appointment,
  User,
  ServiceOrder,
  LabTest,
  Prescription,
} from '../models/index.js';
import models from '../models/index.js';
const { LichHen } = models;

// Helper: detect legacy model
const isLegacyHoSoKham = MedicalRecord && (MedicalRecord.name === 'HoSoKham' || MedicalRecord.tableName === 'HoSoKham');

// Map legacy numeric status -> string constant used by frontend
const legacyStatusToString = (val) => {
  if (!MedicalRecord || !MedicalRecord.TRANG_THAI) return null;
  const mapping = MedicalRecord.TRANG_THAI; // { CHO_KHAM:0, DANG_KHAM:1, HOAN_THANH:2 }
  const entries = Object.entries(mapping);
  const found = entries.find(([, v]) => v === val);
  return found ? (found[0] === 'CHO_KHAM' ? MEDICAL_RECORD_STATUS.WAITING : found[0] === 'DANG_KHAM' ? MEDICAL_RECORD_STATUS.IN_PROGRESS : MEDICAL_RECORD_STATUS.COMPLETED) : null;
};

// Normalize a legacy HoSoKham instance into the modern MedicalRecord JSON shape
const normalizeLegacyRecord = (instance) => {
  if (!instance) return null;
  const r = instance.toJSON ? instance.toJSON() : instance;
  
  // Extract associated data
  const patient = r.BenhNhan || null;
  const doctor = r.BacSi || null;
  const appointment = r.LichHen || null;
  const donThuoc = r.DonThuoc || null;
  const yeuCauDichVu = r.YeuCauDichVu || [];
  const chiSoSinhTon = r.ChiSoSinhTon || [];
  
  // Build vitalSigns from ChiSoSinhTon if available
  let vitalSigns = null;
  if (chiSoSinhTon.length > 0) {
    const latestVital = chiSoSinhTon[0];
    vitalSigns = {
      bloodPressure: `${latestVital.HuyetApTam || ''}/${latestVital.HuyetApTruong || ''}`,
      heartRate: latestVital.NhipTim || '',
      temperature: latestVital.NhietDo || '',
      weight: latestVital.CanNang || '',
      height: latestVital.ChieuCao || '',
    };
  }
  
  // Build prescriptions from DonThuoc
  let prescriptions = [];
  if (donThuoc && donThuoc.ChiTietDonThuoc) {
    prescriptions = donThuoc.ChiTietDonThuoc.map(ct => ({
      id: ct.Id,
      medicineId: ct.MaThuoc,
      medicineName: ct.TenThuoc || '',
      quantity: ct.SoLuong || 0,
      dosage: ct.LieuDung || '',
      instructions: ct.HuongDan || '',
    }));
  }
  
  // Build lab tests from YeuCauDichVu (service orders)
  let labTests = yeuCauDichVu.map(yc => ({
    id: yc.Id,
    testName: yc.TenDichVu || '',
    testType: yc.LoaiDichVu || '',
    status: yc.TrangThai || 'pending',
  }));
  
  return {
    id: r.Id,
    patientId: r.MaBenhNhan || null,
    appointmentId: r.MaLichHen || null,
    patientName: patient ? patient.HoTen : null,
    examType: r.MucDichKham || null,
    symptoms: r.TrieuChung || null,
    symptomDuration: r.ThoiGianTrieuChung || null,
    symptomSeverity: r.MucDoTrieuChung || null,
    diagnosis: r.ChanDoan || null,
    treatment: r.HuongDieuTri || null,
    notes: null, // HoSoKham doesn't have notes field
    vitalSigns,
    initialVitalSigns: vitalSigns, // Same as current
    nextAppointment: r.HenTaiKham || null,
    receptionTime: r.ThoiGianBatDau || null,
    startedAt: r.ThoiGianBatDau || null,
    completedAt: r.ThoiGianHoanThanh || null,
    doctorId: r.MaBacSi || null,
    doctorName: doctor ? doctor.HoTen : null,
    status: legacyStatusToString(r.TrangThai),
    createdAt: r.NgayTao || null,
    updatedAt: r.NgayTao || null,
    // Include related data
    patient,
    doctor,
    appointment,
    prescriptions,
    labTests,
  };
};
import { asyncHandler, parsePagination, parseSort } from '../utils/helpers.js';
import {
  successResponse,
  createdResponse,
  paginatedResponse,
  noContentResponse,
} from '../utils/response.js';
import { NotFoundError, BadRequestError, ValidationError } from '../utils/errors.js';
import { MEDICAL_RECORD_STATUS, APPOINTMENT_STATUS, ROLES } from '../config/constants.js';

// (removed duplicate isLegacy declaration)

/**
 * Lấy tất cả phiếu khám (có phân trang và lọc)
 * Bác sĩ chỉ thấy phiếu của mình (tự động filter theo doctorId)
 * GET /api/medical-records
 */
const getAllMedicalRecords = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { status, patientId, doctorId, date, search, sort } = req.query;

  // Build where clause (support legacy HoSoKham schema)
  if (isLegacyHoSoKham) {
    const whereLegacy = {};
    if (status) {
      if (status === MEDICAL_RECORD_STATUS.WAITING) whereLegacy.TrangThai = MedicalRecord.TRANG_THAI.CHO_KHAM;
      if (status === MEDICAL_RECORD_STATUS.IN_PROGRESS) whereLegacy.TrangThai = MedicalRecord.TRANG_THAI.DANG_KHAM;
      if (status === MEDICAL_RECORD_STATUS.COMPLETED) whereLegacy.TrangThai = MedicalRecord.TRANG_THAI.HOAN_THANH;
    }
    if (patientId) whereLegacy.MaBenhNhan = patientId;
    if (doctorId) whereLegacy.MaBacSi = doctorId;
    if (date) {
      whereLegacy.NgayTao = {
        [Op.gte]: new Date(date),
        [Op.lt]: new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000),
      };
    }
    if (search) {
      whereLegacy[Op.or] = [
        { TrieuChung: { [Op.like]: `%${search}%` } },
        { Id: { [Op.like]: `%${search}%` } },
        { ChanDoan: { [Op.like]: `%${search}%` } },
      ];
    }
    if (req.user.role === ROLES.DOCTOR) whereLegacy.MaBacSi = req.user.id;

    const order = parseSort(sort, ['NgayTao', 'TrangThai']);

    const { count, rows } = await MedicalRecord.findAndCountAll({
      where: whereLegacy,
      order,
      limit,
      offset,
    });

    const data = rows.map((r) => normalizeLegacyRecord(r));
    return paginatedResponse(res, { data, page, limit, total: count });
  }

  // Non-legacy (modern) behavior
  const where = {};
  if (status) where.status = status;
  if (patientId) where.patientId = patientId;
  if (doctorId) where.doctorId = doctorId;
  if (date) {
    where.createdAt = {
      [Op.gte]: new Date(date),
      [Op.lt]: new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000),
    };
  }
  if (search) {
    where[Op.or] = [
      { patientName: { [Op.like]: `%${search}%` } },
      { id: { [Op.like]: `%${search}%` } },
      { diagnosis: { [Op.like]: `%${search}%` } },
    ];
  }
  if (req.user.role === ROLES.DOCTOR) where.doctorId = req.user.id;
  const order = parseSort(sort, ['createdAt', 'status']);

  const { count, rows } = await MedicalRecord.findAndCountAll({
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
 * Get medical record by ID
 * GET /api/medical-records/:id
 */
const getMedicalRecordById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Use appropriate aliases based on model type
  const includes = isLegacyHoSoKham ? [
    {
      model: models.BenhNhan,
      as: 'BenhNhan',
      required: false,
    },
    {
      model: models.NguoiDung,
      as: 'BacSi',
      attributes: ['Id', 'HoTen', 'SoDienThoai', 'Email'],
      required: false,
    },
    {
      model: models.LichHen || Appointment,
      as: 'LichHen',
      required: false,
    },
    {
      model: models.ChiSoSinhTon,
      as: 'ChiSoSinhTon',
      required: false,
    },
    {
      model: models.YeuCauDichVu,
      as: 'YeuCauDichVu',
      required: false,
    },
    {
      model: models.DonThuoc,
      as: 'DonThuoc',
      required: false,
      include: [{
        model: models.ChiTietDonThuoc,
        as: 'ChiTietDonThuoc',
        required: false,
      }],
    },
  ] : [
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
      model: Appointment,
      as: 'appointment',
      required: false,
    },
    {
      model: ServiceOrder,
      as: 'serviceOrders',
      required: false,
    },
    {
      model: LabTest,
      as: 'labTests',
      required: false,
    },
    {
      model: Prescription,
      as: 'prescriptions',
      required: false,
    },
  ];

  let record;
  try {
    record = await MedicalRecord.findByPk(id, { include: includes });
  } catch (dbErr) {
    console.warn('getMedicalRecordById: include query failed, retrying without includes', { id, message: dbErr.message });
    // Retry without includes in case legacy related tables are missing in this DB
    record = await MedicalRecord.findByPk(id);
  }

  if (!record) {
    throw new NotFoundError('Không tìm thấy phiếu khám');
  }

  if (isLegacyHoSoKham) {
    return successResponse(res, normalizeLegacyRecord(record));
  }

  return successResponse(res, record);
});

/**
 * Tạo phiếu khám mới
 * Fallback thông tin: ưu tiên dữ liệu gửi lên, sau đó lấy từ bệnh nhân/user
 * Tự động đồng bộ trạng thái lịch hẹn nếu có liên kết
 * POST /api/medical-records
 */
const createMedicalRecord = asyncHandler(async (req, res) => {
  const {
    patientId,
    appointmentId,
    patientName,
    patientGender,
    patientBirthDate,
    patientPhone,
    patientAddress,
    examType,
    purpose,
    doctorId,
    doctorName,
    initialVitalSigns,
  } = req.body;

  console.log('createMedicalRecord: received payload', {
    patientId,
    appointmentId,
    patientName,
    examType,
    doctorId,
    userId: req.user?.id,
    userRole: req.user?.role
  });

  // Resolve or create patient
  let resolvedPatientId = patientId;
  let patient = null;
  if (resolvedPatientId) {
    patient = await Patient.findByPk(resolvedPatientId);
    if (!patient) {
      // If frontend provided a patientId that doesn't exist in DB (legacy code like BNxxx),
      // attempt to create a Patient fallback when patientName is provided instead of failing.
      console.warn('createMedicalRecord: provided patientId not found, will attempt to create new Patient if name available', { providedId: resolvedPatientId, patientName });
      // Clear resolvedPatientId so creation logic below will run
      resolvedPatientId = null;
      patient = null;
    }
  }

  if (!resolvedPatientId) {
    // If no patientId provided (e.g., appointment for walk-in), create a patient record
    if (!patientName) {
      throw new ValidationError('Dữ liệu không hợp lệ', [
        { field: 'patientName', message: 'Tên bệnh nhân không được để trống khi không có ID bệnh nhân' },
      ]);
    }

    const newPatient = await Patient.create({
      fullName: patientName,
      phone: patientPhone || null,
      dateOfBirth: patientBirthDate || null,
      gender: patientGender || null,
      address: patientAddress || null,
      email: null,
    });
    resolvedPatientId = newPatient.id;
    patient = newPatient;
  }

  // Xác định bác sĩ: ưu tiên doctorId gửi lên, fallback lấy từ user đang đăng nhập
  let docName = doctorName;
  let docId = doctorId;

  if (!docId && req.user.role === ROLES.DOCTOR) {
    docId = req.user.id;
    docName = req.user.fullName;
  } else if (docId && !docName) {
    const doctor = await User.findByPk(docId);
    if (doctor) {
      docName = doctor.fullName;
    }
  }

  // Fallback thông tin BN: lấy từ request, nếu không có thì lấy từ bảng Patient
  console.log('createMedicalRecord: creating record with data', {
    patientId: resolvedPatientId,
    appointmentId,
    patientName: patientName || patient.fullName,
    examType,
    doctorId: docId,
    doctorName: docName,
    status: MEDICAL_RECORD_STATUS.WAITING,
  });

  // If an appointmentId is provided, ensure we don't create duplicate HoSoKham
  if (appointmentId) {
    if (isLegacyHoSoKham) {
      const existing = await MedicalRecord.findOne({ where: { MaLichHen: appointmentId } });
      if (existing) {
        console.warn('createMedicalRecord: record already exists for appointment (legacy)', { appointmentId });
        return successResponse(res, normalizeLegacyRecord(existing), 'Phiếu khám đã tồn tại');
      }
    } else {
      const existing = await MedicalRecord.findOne({ where: { appointmentId } });
      if (existing) {
        console.warn('createMedicalRecord: record already exists for appointment', { appointmentId });
        return successResponse(res, existing, 'Phiếu khám đã tồn tại');
      }
    }
  }

  try {
    // Ensure date fields are properly formatted or null
    let formattedBirthDate = null;
    if (patientBirthDate) {
      try {
        formattedBirthDate = new Date(patientBirthDate).toISOString().split('T')[0];
      } catch (e) {
        console.warn('Invalid patientBirthDate format, setting to null', patientBirthDate);
      }
    }

    let record;
    if (isLegacyHoSoKham) {
      // Create using legacy Vietnamese column names (HoSoKham table)
      // Only set foreign keys when they look like legacy UUIDs to avoid FK errors
      const isUuid = (v) => typeof v === 'string' && /^[0-9a-fA-F-]{36}$/.test(v);
      const legacyMaBenhNhan = isUuid(resolvedPatientId) ? resolvedPatientId : null;
      const legacyMaLichHen = isUuid(appointmentId) ? appointmentId : null;
      const legacyMaBacSi = isUuid(docId) ? docId : null;

      record = await MedicalRecord.create({
        MaBenhNhan: legacyMaBenhNhan,
        MaLichHen: legacyMaLichHen,
        MaBacSi: legacyMaBacSi,
        ThoiGianBatDau: new Date(),
        ThoiGianHoanThanh: null,
        MucDichKham: examType || purpose || null,
        TrieuChung: purpose || null,
        ThoiGianTrieuChung: req.body?.symptomDuration || null,
        MucDoTrieuChung: req.body?.symptomSeverity || null,
        ChanDoan: null,
        HuongDieuTri: null,
        HenTaiKham: null,
        TrangThai: MedicalRecord.TRANG_THAI ? MedicalRecord.TRANG_THAI.CHO_KHAM : 0,
        NgayTao: new Date(),
      });
    } else {
      record = await MedicalRecord.create({
        patientId: resolvedPatientId,
        appointmentId: appointmentId || null,
        patientName: patientName || patient.fullName,
        patientGender: patientGender || patient.gender || null,
        patientBirthDate: formattedBirthDate || (patient.dateOfBirth ? new Date(patient.dateOfBirth).toISOString().split('T')[0] : null),
        patientPhone: patientPhone || patient.phone || null,
        patientAddress: patientAddress || patient.address || null,
        examType: examType || null,
        purpose: purpose || null,
        receptionTime: new Date(),
        doctorId: docId || null,
        doctorName: docName || null,
        initialVitalSigns: initialVitalSigns || null,
        status: MEDICAL_RECORD_STATUS.WAITING,
      });
    }

    console.log('createMedicalRecord: record created successfully', { id: record.id || record.Id });

    // Prepare response object: normalize legacy and merge patient snapshot when available
    let responsePayload;
    if (isLegacyHoSoKham) {
      responsePayload = normalizeLegacyRecord(record);
      // Merge patient snapshot into response so frontend sees patient details even if DB schema is legacy
      if (patient) {
        responsePayload.patientId = resolvedPatientId || responsePayload.patientId;
        responsePayload.patientName = patient.fullName || responsePayload.patientName;
        responsePayload.patientPhone = patient.phone || responsePayload.patientPhone;
        responsePayload.patientGender = patient.gender || responsePayload.patientGender;
        responsePayload.patientBirthDate = patient.dateOfBirth || responsePayload.patientBirthDate;
        responsePayload.patientAddress = patient.address || responsePayload.patientAddress;
        responsePayload.medicalHistory = patient.medicalHistory || responsePayload.medicalHistory;
        responsePayload.allergies = patient.allergies || responsePayload.allergies;
      }
    } else {
      responsePayload = record;
    }

    // Đồng bộ trạng thái lịch hẹn → "Đã đặt lịch" (nếu có liên kết)
    if (appointmentId) {
      await Appointment.update(
        { status: APPOINTMENT_STATUS.SCHEDULED },
        { where: { id: appointmentId } }
      );
    }

    return createdResponse(res, responsePayload, 'Tạo phiếu khám thành công');
    } catch (error) {
      console.error('createMedicalRecord: error creating record', {
        error: error.message,
        name: error.name,
        errors: error.errors,
        parent: error.parent,
        original: error.original,
        sql: error.sql,
        stack: error.stack,
      });

      // If unique constraint (duplicate) error, try to find and return the existing record
        if (error.name === 'SequelizeUniqueConstraintError') {
          try {
            console.warn('🔍 createMedicalRecord: UNIQUE CONSTRAINT detected', {
              constraintName: error.parent?.constraint || error.original?.constraint,
              errorFields: error.fields,
              providedAppointmentId: appointmentId,
              providedPatientId: resolvedPatientId,
              isLegacy: isLegacyHoSoKham,
            });

            // Strategy 1: Search by appointmentId/MaLichHen (most common unique key)
            if (appointmentId) {
              const searchKey = isLegacyHoSoKham ? 'MaLichHen' : 'appointmentId';
              console.log(`   → Searching by ${searchKey}:`, appointmentId);
              const existing = await MedicalRecord.findOne({ where: { [searchKey]: appointmentId } });
              if (existing) {
                console.log('   ✅ Found existing record by appointment:', existing.Id || existing.id);
                return successResponse(res, isLegacyHoSoKham ? normalizeLegacyRecord(existing) : existing, 'Phiếu khám đã tồn tại');
              }
              console.log('   ❌ Not found by appointmentId');
            }

            // Strategy 2: Search by error.fields if available
            if (error.fields && Object.keys(error.fields).length > 0) {
              console.log('   → Trying error.fields:', error.fields);
              for (const [fieldName, fieldValue] of Object.entries(error.fields)) {
                if (fieldValue) {
                  const existing = await MedicalRecord.findOne({ where: { [fieldName]: fieldValue } });
                  if (existing) {
                    console.log(`   ✅ Found existing by field ${fieldName}`);
                    return successResponse(res, isLegacyHoSoKham ? normalizeLegacyRecord(existing) : existing, 'Phiếu khám đã tồn tại');
                  }
                }
              }
            }

            // Strategy 3: Find most recent record for this patient (aggressive fallback)
            if (resolvedPatientId) {
              console.log('   → Searching most recent by patient:', resolvedPatientId);
              const searchKey = isLegacyHoSoKham ? 'MaBenhNhan' : 'patientId';
              const orderKey = isLegacyHoSoKham ? 'NgayTao' : 'createdAt';
              const recent = await MedicalRecord.findOne({
                where: { [searchKey]: resolvedPatientId },
                order: [[orderKey, 'DESC']],
              });
              if (recent) {
                console.log('   ✅ Returning most recent record for patient:', recent.Id || recent.id);
                return successResponse(res, isLegacyHoSoKham ? normalizeLegacyRecord(recent) : recent, 'Phiếu khám đã tồn tại (gần nhất)');
              }
            }

            // Strategy 4: Try to find an existing HoSoKham that has MaLichHen IS NULL
            // In this DB the UNIQUE index treats NULL as a value, so inserting another NULL will fail.
            if (isLegacyHoSoKham) {
              console.log('   → Searching for existing HoSoKham with MaLichHen IS NULL...');
              const queryConditions = { MaLichHen: null };
              if (resolvedPatientId) queryConditions.MaBenhNhan = resolvedPatientId;
              if (docId) queryConditions.MaBacSi = docId;

              const existingNull = await MedicalRecord.findOne({ where: queryConditions });
              if (existingNull) {
                console.log('   ✅ Found existing HoSoKham with MaLichHen NULL:', existingNull.Id);
                return successResponse(res, normalizeLegacyRecord(existingNull), 'Phiếu khám đã tồn tại (MaLichHen NULL)');
              }

              // Broader search: any record with MaLichHen NULL for this patient
              if (resolvedPatientId) {
                const broader = await MedicalRecord.findOne({ where: { MaLichHen: null, MaBenhNhan: resolvedPatientId }, order: [['NgayTao', 'DESC']] });
                if (broader) return successResponse(res, normalizeLegacyRecord(broader), 'Phiếu khám đã tồn tại (MaLichHen NULL, gần nhất)');
              }

              // If still not found, cannot safely create another NULL due to unique index.
              console.warn('   ⚠️ Cannot create fallback HoSoKham because MaLichHen NULL already exists in unique index and no matching record found to return.');
              throw new ValidationError('Dữ liệu trùng lặp không thể xử lý tự động; vui lòng kiểm tra hệ thống hoặc liên hệ quản trị viên', [
                { field: 'MaLichHen', message: 'Ràng buộc UNIQUE trên MaLichHen cấm thêm bản ghi với giá trị NULL' },
              ]);
            }
          } catch (uniqueResolveErr) {
            console.error('   ❌ Error during unique resolution:', uniqueResolveErr.message, uniqueResolveErr.stack);
          }
        }

      // If foreign key constraint error, attempt a safe retry with FK fields nulled
        if (error.name === 'SequelizeForeignKeyConstraintError' || error.code === 'ER_NO_REFERENCED_ROW_2') {
        try {
          console.warn('createMedicalRecord: detected FK constraint error, retrying with FK fields cleared');
          if (isLegacyHoSoKham) {
            const safePayload = {
              MaBenhNhan: null,
              MaLichHen: null,
              MaBacSi: null,
              ThoiGianBatDau: new Date(),
              ThoiGianHoanThanh: null,
              MucDichKham: examType || purpose || null,
              TrieuChung: purpose || null,
              ChanDoan: null,
              HuongDieuTri: null,
              HenTaiKham: null,
              TrangThai: MedicalRecord.TRANG_THAI ? MedicalRecord.TRANG_THAI.CHO_KHAM : 0,
              NgayTao: new Date(),
            };
            const recordRetry = await MedicalRecord.create(safePayload);
            console.info('createMedicalRecord: retry succeeded with safe payload', { id: recordRetry.Id || recordRetry.id });
            // normalize and return
            return createdResponse(res, isLegacyHoSoKham ? normalizeLegacyRecord(recordRetry) : recordRetry, 'Tạo phiếu khám thành công');
          }

          // Modern model fallback: clear doctorId (most likely FK) and retry
          const retryPayload = {
            patientId: resolvedPatientId,
            appointmentId: appointmentId || null,
            patientName: patientName || patient.fullName,
            patientGender: patientGender || patient.gender || null,
            patientBirthDate: formattedBirthDate || (patient.dateOfBirth ? new Date(patient.dateOfBirth).toISOString().split('T')[0] : null),
            patientPhone: patientPhone || patient.phone || null,
            patientAddress: patientAddress || patient.address || null,
            examType: examType || null,
            purpose: purpose || null,
            receptionTime: new Date(),
            doctorId: null,
            doctorName: docName || null,
            initialVitalSigns: initialVitalSigns || null,
            status: MEDICAL_RECORD_STATUS.WAITING,
          };

          const recordRetry = await MedicalRecord.create(retryPayload);
          console.info('createMedicalRecord: retry succeeded for modern model', { id: recordRetry.id });
          if (appointmentId) {
            await Appointment.update(
              { status: APPOINTMENT_STATUS.SCHEDULED },
              { where: { id: appointmentId } }
            );
          }
          return createdResponse(res, recordRetry, 'Tạo phiếu khám thành công (fallback)');
        } catch (retryErr) {
          console.error('createMedicalRecord: retry failed', { error: retryErr.message, name: retryErr.name, stack: retryErr.stack });
          throw error; // throw original to keep semantics
        }
      }

      throw error;
    }
});

/**
 * Cập nhật phiếu khám
 * Tự động gắn startedAt/completedAt khi chuyển trạng thái
 * Đồng bộ trạng thái lịch hẹn liên kết theo phiếu khám
 * PUT /api/medical-records/:id
 */
const updateMedicalRecord = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const record = await MedicalRecord.findByPk(id);
  if (!record) {
    throw new NotFoundError('Không tìm thấy phiếu khám');
  }

  // Tự động gắn mốc thời gian khi chuyển trạng thái (chỉ gắn lần đầu)
  if (updateData.status === MEDICAL_RECORD_STATUS.IN_PROGRESS && !record.startedAt) {
    updateData.startedAt = new Date();
  }
  if (updateData.status === MEDICAL_RECORD_STATUS.COMPLETED && !record.completedAt) {
    updateData.completedAt = new Date();
  }

  // If legacy HoSoKham model is used, map modern fields to legacy column names
  if (isLegacyHoSoKham) {
    const legacyUpdate = {};
    if (updateData.symptoms !== undefined) legacyUpdate.TrieuChung = updateData.symptoms;
    if (updateData.symptomDuration !== undefined) legacyUpdate.ThoiGianTrieuChung = updateData.symptomDuration;
    if (updateData.symptomSeverity !== undefined) legacyUpdate.MucDoTrieuChung = updateData.symptomSeverity;
    if (updateData.diagnosis !== undefined) legacyUpdate.ChanDoan = updateData.diagnosis;
    if (updateData.treatment !== undefined) legacyUpdate.HuongDieuTri = updateData.treatment;
    if (updateData.nextAppointment !== undefined) legacyUpdate.HenTaiKham = updateData.nextAppointment || null;
    // Do not overwrite TrangThai here unless status mapping needed externally

    // Apply legacy updates if any
    if (Object.keys(legacyUpdate).length > 0) {
      await record.update(legacyUpdate);
    }

    // If vitalSigns provided, create a ChiSoSinhTon entry linked to this HoSoKham
    if (updateData.vitalSigns) {
      try {
        const vs = updateData.vitalSigns;
        const chiSo = {
          MaHoSoKham: record.Id || record.id,
          HuyetAp: vs.bloodPressure || null,
          NhipTim: vs.pulse || null,
          NhietDo: vs.temperature || null,
          CanNang: vs.weight || null,
          ChieuCao: vs.height || null,
          SpO2: vs.spO2 || null,
        };
        // Use models namespace to create legacy ChiSoSinhTon
        if (models && models.ChiSoSinhTon) {
          await models.ChiSoSinhTon.create(chiSo);
        } else {
          console.warn('updateMedicalRecord: ChiSoSinhTon model not available to create vital signs');
        }
      } catch (chiErr) {
        console.error('updateMedicalRecord: failed to create ChiSoSinhTon', chiErr);
      }
    }
  } else {
    await record.update(updateData);
  }

  // Đồng bộ trạng thái lịch hẹn: phiếu khám → lịch hẹn (mapping IN_PROGRESS/COMPLETED)
  if (record.appointmentId) {
    let appointmentStatus;
    switch (updateData.status) {
      case MEDICAL_RECORD_STATUS.IN_PROGRESS:
        appointmentStatus = APPOINTMENT_STATUS.IN_PROGRESS;
        break;
      case MEDICAL_RECORD_STATUS.COMPLETED:
        appointmentStatus = APPOINTMENT_STATUS.COMPLETED;
        break;
    }
    if (appointmentStatus) {
      await Appointment.update(
        { status: appointmentStatus },
        { where: { id: record.appointmentId } }
      );
    }
  }

  return successResponse(res, record, 'Cập nhật phiếu khám thành công');
});

/**
 * Bắt đầu khám (waiting → in_progress)
 * Gắn bác sĩ nếu chưa có- đồng bộ lịch hẹn
 * POST /api/medical-records/:id/start
 */
const startExamination = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const record = await MedicalRecord.findByPk(id);
  if (!record) {
    throw new NotFoundError('Không tìm thấy phiếu khám');
  }

  if (isLegacyHoSoKham) {
    // Legacy numeric status enum
    const waiting = MedicalRecord.TRANG_THAI ? MedicalRecord.TRANG_THAI.CHO_KHAM : 0;
    if (record.TrangThai !== waiting) {
      throw new BadRequestError('Chỉ có thể bắt đầu khám với phiếu đang chờ');
    }

    await record.update({
      TrangThai: MedicalRecord.TRANG_THAI ? MedicalRecord.TRANG_THAI.DANG_KHAM : 1,
      ThoiGianBatDau: record.ThoiGianBatDau || new Date(),
      MaBacSi: record.MaBacSi || req.user.id,
    });
  } else {
    if (record.status !== MEDICAL_RECORD_STATUS.WAITING) {
      throw new BadRequestError('Chỉ có thể bắt đầu khám với phiếu đang chờ');
    }

    await record.update({
      status: MEDICAL_RECORD_STATUS.IN_PROGRESS,
      startedAt: new Date(),
      doctorId: record.doctorId || req.user.id,
      doctorName: record.doctorName || req.user.fullName,
    });
  }

  // Đồng bộ lịch hẹn → "đang khám"
  // Appointment foreign key may be stored under different attribute names
  if (isLegacyHoSoKham) {
    const lichHenId = record.MaLichHen;
    if (lichHenId) {
      // Update legacy LichHen.TrangThai (numeric enum)
      const inProgress = LichHen && LichHen.TRANG_THAI ? LichHen.TRANG_THAI.DANG_KHAM : 2;
      await LichHen.update({ TrangThai: inProgress }, { where: { Id: lichHenId } });
    }
  } else {
    const appointmentFk = record.appointmentId;
    if (appointmentFk) {
      await Appointment.update(
        { status: APPOINTMENT_STATUS.IN_PROGRESS },
        { where: { id: appointmentFk } }
      );
    }
  }

  return successResponse(res, record, 'Bắt đầu khám thành công');
});

/**
 * Hoàn thành khám - lưu chẩn đoán, phương pháp điều trị
 * Không cho hoàn thành phiếu đã hoàn thành trước đó
 * POST /api/medical-records/:id/complete
 */
const completeExamination = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { diagnosis, treatment, notes, nextAppointment, vitalSigns } = req.body;

  const record = await MedicalRecord.findByPk(id);
  if (!record) {
    throw new NotFoundError('Không tìm thấy phiếu khám');
  }

  if (record.status === MEDICAL_RECORD_STATUS.COMPLETED) {
    throw new BadRequestError('Phiếu khám đã hoàn thành');
  }

  await record.update({
    status: MEDICAL_RECORD_STATUS.COMPLETED,
    completedAt: new Date(),
    diagnosis,
    treatment,
    notes,
    nextAppointment,
    vitalSigns: vitalSigns || record.vitalSigns,
  });

  // Đồng bộ lịch hẹn → "hoàn thành"
  if (record.appointmentId) {
    await Appointment.update(
      { status: APPOINTMENT_STATUS.COMPLETED },
      { where: { id: record.appointmentId } }
    );
  }

  return successResponse(res, record, 'Hoàn thành khám thành công');
});

/**
 * Delete medical record (soft delete)
 * DELETE /api/medical-records/:id
 */
const deleteMedicalRecord = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const record = await MedicalRecord.findByPk(id);
  if (!record) {
    throw new NotFoundError('Không tìm thấy phiếu khám');
  }

  await record.destroy();

  return noContentResponse(res);
});

/**
 * Get today's examination queue
 * GET /api/medical-records/today-queue
 */
const getTodayQueue = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const { doctorId, status } = req.query;

  const where = {
    createdAt: {
      [Op.gte]: today,
      [Op.lt]: tomorrow,
    },
  };

  if (status) {
    where.status = status;
  }

  if (doctorId) {
    where.doctorId = doctorId;
  }

  // Role-based filtering
  if (req.user.role === ROLES.DOCTOR) {
    where.doctorId = req.user.id;
  }

  try {
    const records = await MedicalRecord.findAll({
      where,
      order: [['receptionTime', 'ASC']],
      // Do not include Patient join here to avoid cross-schema table name mismatches;
      // MedicalRecord stores patient snapshot fields (patientName, patientPhone, ...)
    });

    return successResponse(res, records);
  } catch (err) {
    // Log detailed DB error for diagnosis
    console.error('getTodayQueue DB error:', {
      message: err.message,
      original: err.original && err.original.message,
      parent: err.parent && err.parent.message,
      stack: err.stack,
    });
    // Return empty list to avoid propagating DB errors to the doctor UI
    return successResponse(res, []);
  }
});

export {
  getAllMedicalRecords,
  getMedicalRecordById,
  createMedicalRecord,
  updateMedicalRecord,
  startExamination,
  completeExamination,
  deleteMedicalRecord,
  getTodayQueue,
};
