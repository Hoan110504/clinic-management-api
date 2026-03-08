/**
 * Patient Controller
 * Handles patient management operations
 */
import { Op } from 'sequelize';
import { Patient, User, MedicalRecord, Appointment, LabTest, Payment } from '../models/index.js';
import { asyncHandler, parsePagination, parseSort } from '../utils/helpers.js';
import logger from '../utils/logger.js';
import { GENDER } from '../config/constants.js';
import {
  successResponse,
  createdResponse,
  paginatedResponse,
  noContentResponse,
} from '../utils/response.js';
import { NotFoundError, ConflictError, BadRequestError } from '../utils/errors.js';

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

  // Normalize email: convert empty string to null to avoid UNIQUE constraint violation
  const normalizedEmail = email && String(email).trim() !== '' ? String(email).trim() : null;

  // Normalize gender to match DB allowed values if possible.
  // Map common Vietnamese and English inputs to the enum values defined in the model.
  let genderToUse = null;
  try {
    const attr = Patient.rawAttributes && Patient.rawAttributes.gender;
    const allowedValues = attr && Array.isArray(attr.values) ? attr.values : null;
    if (!allowedValues) {
      genderToUse = gender || null;
    } else if (!gender) {
      genderToUse = null;
    } else {
      const raw = String(gender).trim();
      // Normalize unicode forms and prepare diacritic-stripped fallback
      const normalizedRaw = raw.normalize ? raw.normalize('NFC') : raw;
      // Direct match (case-sensitive)
      if (allowedValues.includes(raw)) {
        genderToUse = raw;
      } else {
        // Normalize to lowercase for mapping
        const low = normalizedRaw.toLowerCase();
        // Remove diacritics for a fallback match (e.g., 'nữ' -> 'nu')
        let lowNoDiacritics = low;
        try {
          lowNoDiacritics = low.normalize('NFD').replace(/\p{M}/gu, '');
        } catch (e) {
          // If Unicode property escapes not supported, keep original
        }
        const candidateMap = {};
        // Build reverse map for allowedValues (lowercase -> original)
        for (const v of allowedValues) {
          candidateMap[String(v).toLowerCase()] = v;
        }
        // Try direct lowercase match to allowed values
        if (candidateMap[low]) {
          genderToUse = candidateMap[low];
        } else {
          // Map common synonyms explicitly to canonical values from constants
          const synonymMap = {
            male: GENDER.MALE,
            nam: GENDER.MALE,
            m: GENDER.MALE,
            female: GENDER.FEMALE,
            nu: GENDER.FEMALE,
            'nữ': GENDER.FEMALE,
            f: GENDER.FEMALE,
            // add some numeric/code mappings just in case
            '1': GENDER.MALE,
            '2': GENDER.FEMALE,
          };

          if (synonymMap[low]) {
            genderToUse = synonymMap[low];
          } else if (synonymMap[lowNoDiacritics]) {
            genderToUse = synonymMap[lowNoDiacritics];
          } else {
            // fuzzy: try to match allowedValues containing parts of input
            const found = allowedValues.find(av => String(av).toLowerCase().includes(low) || low.includes(String(av).toLowerCase()));
            genderToUse = found || null;
          }
        }
      }
    }
  } catch (e) {
    genderToUse = null;
  }

  if (gender && genderToUse === null) {
    // Log for debugging mapping issues
    console.warn(`patient.controller:createPatient - incoming gender='${gender}' could not be mapped to allowed Patient.gender values`);
    // Return a clear validation error instead of letting the DB constraint fail
    throw new BadRequestError('Giới tính không hợp lệ');
  }

  // Check existing patient with same ID number
  // ID number is required for reception flows — validate presence and uniqueness
  if (!idNumber || String(idNumber).trim() === '') {
    throw new BadRequestError('Số CCCD/CMND là bắt buộc');
  }

  const existingPatient = await Patient.findOne({ where: { idNumber } });
  if (existingPatient) {
    throw new ConflictError('Số CCCD đã được đăng ký');
  }

  // Check phone uniqueness if provided
  if (phone && String(phone).trim() !== '') {
    const normalizedPhone = String(phone).trim();
    const existingPhone = await Patient.findOne({ where: { phone: normalizedPhone } });
    if (existingPhone) {
      throw new ConflictError('Số điện thoại đã được sử dụng');
    }
  }

  // Log resolved gender and allowed values to help diagnose DB CHECK mismatches
  try {
    const attr = Patient.rawAttributes && Patient.rawAttributes.gender;
    const allowedValues = attr && Array.isArray(attr.values) ? attr.values : null;
    logger.debug(`patient:createPatient - incoming gender='${gender}', resolved='${genderToUse}', allowed=${JSON.stringify(allowedValues)}`);
  } catch (e) {
    logger.debug(`patient:createPatient - incoming gender='${gender}', resolved='${genderToUse}'`);
  }

  // Check email chỉ khi người dùng cung cấp email (non-empty)
  if (normalizedEmail) {
    const existingEmail = await Patient.findOne({ where: { email: normalizedEmail } });
    if (existingEmail) {
      throw new ConflictError('Email đã được sử dụng');
    }
  }

  const patient = await Patient.create({
    fullName,
    dateOfBirth,
    gender: genderToUse,
    phone,
    email: normalizedEmail,
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

  // Normalize email if provided
  if ('email' in updateData) {
    updateData.email = updateData.email && String(updateData.email).trim() !== '' ? String(updateData.email).trim() : null;
  }

  // Check ID number uniqueness if changed
  if (updateData.idNumber && updateData.idNumber !== patient.idNumber) {
    const existingPatient = await Patient.findOne({ where: { idNumber: updateData.idNumber } });
    if (existingPatient) {
      throw new ConflictError('Số CCCD đã được đăng ký');
    }
  }

  // Check phone uniqueness if changed
  if (updateData.phone && updateData.phone !== patient.phone) {
    const existingPhone = await Patient.findOne({ where: { phone: updateData.phone } });
    if (existingPhone) {
      throw new ConflictError('Số điện thoại đã được sử dụng');
    }
  }

  // Check email uniqueness if changed and provided
  if (updateData.email && updateData.email !== patient.email) {
    const existingEmail = await Patient.findOne({ where: { email: updateData.email } });
    if (existingEmail) {
      throw new ConflictError('Email đã được sử dụng');
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

export {
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
