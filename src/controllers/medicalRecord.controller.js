/**
 * Medical Record Controller
 * Handles medical record operations
 */
const { Op } = require('sequelize');
const {
  MedicalRecord,
  Patient,
  Appointment,
  User,
  ServiceOrder,
  LabTest,
  Prescription,
} = require('../models');
const { asyncHandler, parsePagination, parseSort } = require('../utils/helpers');
const {
  successResponse,
  createdResponse,
  paginatedResponse,
  noContentResponse,
} = require('../utils/response');
const { NotFoundError, BadRequestError } = require('../utils/errors');
const { MEDICAL_RECORD_STATUS, APPOINTMENT_STATUS, ROLES } = require('../config/constants');

/**
 * Get all medical records (with pagination and filters)
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
 * Create new medical record
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

  // Verify patient exists
  const patient = await Patient.findByPk(patientId);
  if (!patient) {
    throw new NotFoundError('Không tìm thấy bệnh nhân');
  }

  // Get doctor info
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

  const record = await MedicalRecord.create({
    patientId,
    appointmentId,
    patientName: patientName || patient.fullName,
    patientGender: patientGender || patient.gender,
    patientBirthDate: patientBirthDate || patient.dateOfBirth,
    patientPhone: patientPhone || patient.phone,
    patientAddress: patientAddress || patient.address,
    examType,
    purpose,
    receptionTime: new Date(),
    doctorId: docId,
    doctorName: docName,
    initialVitalSigns,
    status: MEDICAL_RECORD_STATUS.WAITING,
  });

  // Update appointment status if linked
  if (appointmentId) {
    await Appointment.update(
      { status: APPOINTMENT_STATUS.WAITING },
      { where: { id: appointmentId } }
    );
  }

  return createdResponse(res, record, 'Tạo phiếu khám thành công');
});

/**
 * Update medical record
 * PUT /api/medical-records/:id
 */
const updateMedicalRecord = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const record = await MedicalRecord.findByPk(id);
  if (!record) {
    throw new NotFoundError('Không tìm thấy phiếu khám');
  }

  // Update status timestamps
  if (updateData.status === MEDICAL_RECORD_STATUS.IN_PROGRESS && !record.startedAt) {
    updateData.startedAt = new Date();
  }
  if (updateData.status === MEDICAL_RECORD_STATUS.COMPLETED && !record.completedAt) {
    updateData.completedAt = new Date();
  }

  await record.update(updateData);

  // Update appointment status if linked
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
 * Start examination
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

  // Update appointment status if linked
  if (record.appointmentId) {
    await Appointment.update(
      { status: APPOINTMENT_STATUS.IN_PROGRESS },
      { where: { id: record.appointmentId } }
    );
  }

  return successResponse(res, record, 'Bắt đầu khám thành công');
});

/**
 * Complete examination
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

  // Update appointment status if linked
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

  const records = await MedicalRecord.findAll({
    where,
    order: [['receptionTime', 'ASC']],
    include: [
      {
        model: Patient,
        as: 'patient',
        attributes: ['id', 'fullName', 'phone', 'dateOfBirth', 'gender', 'allergies'],
        required: false,
      },
    ],
  });

  return successResponse(res, records);
});

module.exports = {
  getAllMedicalRecords,
  getMedicalRecordById,
  createMedicalRecord,
  updateMedicalRecord,
  startExamination,
  completeExamination,
  deleteMedicalRecord,
  getTodayQueue,
};
