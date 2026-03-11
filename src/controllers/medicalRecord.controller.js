/**
 * Controller Phiếu Khám Bệnh
 * Quản lý quy trình khám: tiếp nhận → chờ khám → đang khám → hoàn thành
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
import { asyncHandler, parsePagination, parseSort } from '../utils/helpers.js';
import {
  successResponse,
  createdResponse,
  paginatedResponse,
  noContentResponse,
} from '../utils/response.js';
import { NotFoundError, BadRequestError, ValidationError } from '../utils/errors.js';
import { MEDICAL_RECORD_STATUS, APPOINTMENT_STATUS, ROLES } from '../config/constants.js';

/**
 * Lấy tất cả phiếu khám (có phân trang và lọc)
 * Bác sĩ chỉ thấy phiếu của mình (tự động filter theo doctorId)
 * GET /api/medical-records
 */
const getAllMedicalRecords = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { status, patientId, doctorId, date, search, sort } = req.query;

  // Build where clause
  const where = {};

  if (status) {
    where.status = status;
  }

  if (patientId) {
    where.patientId = patientId;
  }

  if (doctorId) {
    where.doctorId = doctorId;
  }

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

  // Role-based filtering
  if (req.user.role === ROLES.DOCTOR) {
    where.doctorId = req.user.id;
  }

  // Parse sort
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

  const record = await MedicalRecord.findByPk(id, {
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
    ],
  });

  if (!record) {
    throw new NotFoundError('Không tìm thấy phiếu khám');
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
      throw new NotFoundError('Không tìm thấy bệnh nhân');
    }
  } else {
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

    const record = await MedicalRecord.create({
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

    console.log('createMedicalRecord: record created successfully', { id: record.id });

    // Đồng bộ trạng thái lịch hẹn → "chờ khám" (nếu có liên kết)
    if (appointmentId) {
      await Appointment.update(
        { status: APPOINTMENT_STATUS.WAITING },
        { where: { id: appointmentId } }
      );
    }

    return createdResponse(res, record, 'Tạo phiếu khám thành công');
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

  await record.update(updateData);

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

  if (record.status !== MEDICAL_RECORD_STATUS.WAITING) {
    throw new BadRequestError('Chỉ có thể bắt đầu khám với phiếu đang chờ');
  }

  await record.update({
    status: MEDICAL_RECORD_STATUS.IN_PROGRESS,
    startedAt: new Date(),
    doctorId: record.doctorId || req.user.id,
    doctorName: record.doctorName || req.user.fullName,
  });

  // Đồng bộ lịch hẹn → "đang khám"
  if (record.appointmentId) {
    await Appointment.update(
      { status: APPOINTMENT_STATUS.IN_PROGRESS },
      { where: { id: record.appointmentId } }
    );
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
