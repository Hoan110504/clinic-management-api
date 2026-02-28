/**
 * Patient Controller
 * Handles patient management operations
 */
const { Op } = require('sequelize');
const { Patient, User, MedicalRecord, Appointment, LabTest, Payment } = require('../models');
const { asyncHandler, parsePagination, parseSort } = require('../utils/helpers');
const {
  successResponse,
  createdResponse,
  paginatedResponse,
  noContentResponse,
} = require('../utils/response');
const { NotFoundError, ConflictError } = require('../utils/errors');

/**
 * Get all patients (with pagination and filters)
 * GET /api/patients
 */
const getAllPatients = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { search, gender, sort } = req.query;

  // Build where clause
  const where = {};

  if (gender) {
    where.gender = gender;
  }

  if (search) {
    where[Op.or] = [
      { fullName: { [Op.like]: `%${search}%` } },
      { phone: { [Op.like]: `%${search}%` } },
      { email: { [Op.like]: `%${search}%` } },
      { id: { [Op.like]: `%${search}%` } },
      { idNumber: { [Op.like]: `%${search}%` } },
    ];
  }

  // Parse sort
  const order = parseSort(sort, ['createdAt', 'fullName', 'dateOfBirth']);

  const { count, rows } = await Patient.findAndCountAll({
    where,
    order,
    limit,
    offset,
  });

  return paginatedResponse(res, {
    data: rows,
    page,
    limit,
    total: count,
  });
});

/**
 * Get patient by ID
 * GET /api/patients/:id
 */
const getPatientById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const patient = await Patient.findByPk(id, {
    include: [
      {
        model: User,
        as: 'user',
        attributes: ['id', 'username', 'email', 'lastLoginAt'],
        required: false,
      },
    ],
  });

  if (!patient) {
    throw new NotFoundError('Không tìm thấy bệnh nhân');
  }

  return successResponse(res, patient);
});

/**
 * Create new patient
 * POST /api/patients
 */
const createPatient = asyncHandler(async (req, res) => {
  const {
    fullName,
    dateOfBirth,
    gender,
    phone,
    email,
    address,
    idNumber,
    medicalHistory,
    allergies,
    emergencyContact,
    emergencyPhone,
    insuranceNumber,
    notes,
  } = req.body;

  // Check existing patient with same ID number
  if (idNumber) {
    const existingPatient = await Patient.findOne({ where: { idNumber } });
    if (existingPatient) {
      throw new ConflictError('Số CCCD đã được đăng ký');
    }
  }

  const patient = await Patient.create({
    fullName,
    dateOfBirth,
    gender,
    phone,
    email,
    address,
    idNumber,
    medicalHistory,
    allergies,
    emergencyContact,
    emergencyPhone,
    insuranceNumber,
    notes,
  });

  return createdResponse(res, patient, 'Tạo bệnh nhân thành công');
});

/**
 * Update patient
 * PUT /api/patients/:id
 */
const updatePatient = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const patient = await Patient.findByPk(id);
  if (!patient) {
    throw new NotFoundError('Không tìm thấy bệnh nhân');
  }

  // Check ID number uniqueness if changed
  if (updateData.idNumber && updateData.idNumber !== patient.idNumber) {
    const existingPatient = await Patient.findOne({ where: { idNumber: updateData.idNumber } });
    if (existingPatient) {
      throw new ConflictError('Số CCCD đã được đăng ký');
    }
  }

  await patient.update(updateData);

  // Update linked user if exists
  if (patient.userId) {
    const { fullName, phone, email, address, dateOfBirth, gender } = updateData;
    await User.update(
      { fullName, phone, email, address, dateOfBirth, gender },
      { where: { id: patient.userId } }
    );
  }

  return successResponse(res, patient, 'Cập nhật bệnh nhân thành công');
});

/**
 * Delete patient (soft delete)
 * DELETE /api/patients/:id
 */
const deletePatient = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const patient = await Patient.findByPk(id);
  if (!patient) {
    throw new NotFoundError('Không tìm thấy bệnh nhân');
  }

  await patient.destroy();

  return noContentResponse(res);
});

/**
 * Get patient medical history
 * GET /api/patients/:id/medical-records
 */
const getPatientMedicalRecords = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page, limit, offset } = parsePagination(req.query);

  const patient = await Patient.findByPk(id);
  if (!patient) {
    throw new NotFoundError('Không tìm thấy bệnh nhân');
  }

  const { count, rows } = await MedicalRecord.findAndCountAll({
    where: { patientId: id },
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });

  return paginatedResponse(res, {
    data: rows,
    page,
    limit,
    total: count,
  });
});

/**
 * Get patient appointments
 * GET /api/patients/:id/appointments
 */
const getPatientAppointments = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page, limit, offset } = parsePagination(req.query);
  const { status } = req.query;

  const patient = await Patient.findByPk(id);
  if (!patient) {
    throw new NotFoundError('Không tìm thấy bệnh nhân');
  }

  const where = { patientId: id };
  if (status) {
    where.status = status;
  }

  const { count, rows } = await Appointment.findAndCountAll({
    where,
    order: [['appointmentDate', 'DESC'], ['timeSlot', 'ASC']],
    limit,
    offset,
  });

  return paginatedResponse(res, {
    data: rows,
    page,
    limit,
    total: count,
  });
});

/**
 * Get patient lab tests
 * GET /api/patients/:id/lab-tests
 */
const getPatientLabTests = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page, limit, offset } = parsePagination(req.query);

  const { count, rows } = await LabTest.findAndCountAll({
    where: { patientId: id },
    order: [['orderedDate', 'DESC']],
    limit,
    offset,
  });

  return paginatedResponse(res, {
    data: rows,
    page,
    limit,
    total: count,
  });
});

/**
 * Get patient payments
 * GET /api/patients/:id/payments
 */
const getPatientPayments = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page, limit, offset } = parsePagination(req.query);

  const { count, rows } = await Payment.findAndCountAll({
    where: { patientId: id },
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });

  return paginatedResponse(res, {
    data: rows,
    page,
    limit,
    total: count,
  });
});

/**
 * Search patients (quick search)
 * GET /api/patients/search
 */
const searchPatients = asyncHandler(async (req, res) => {
  const { q, limit = 10 } = req.query;

  if (!q || q.length < 2) {
    return successResponse(res, []);
  }

  const patients = await Patient.findAll({
    where: {
      [Op.or]: [
        { fullName: { [Op.like]: `%${q}%` } },
        { phone: { [Op.like]: `%${q}%` } },
        { id: { [Op.like]: `%${q}%` } },
      ],
    },
    attributes: ['id', 'fullName', 'phone', 'dateOfBirth', 'gender'],
    limit: parseInt(limit, 10),
    order: [['fullName', 'ASC']],
  });

  return successResponse(res, patients);
});

module.exports = {
  getAllPatients,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
  getPatientMedicalRecords,
  getPatientAppointments,
  getPatientLabTests,
  getPatientPayments,
  searchPatients,
};
