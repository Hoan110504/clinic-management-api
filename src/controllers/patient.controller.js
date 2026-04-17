/**
 * Patient Controller
 * Handles patient management operations
 */
import { Op } from 'sequelize';
import { Patient, User, MedicalRecord, Appointment, LabTest, Payment } from '../models/index.js';
import { asyncHandler, parsePagination, parseSort } from '../utils/helpers.js';
import logger from '../utils/logger.js';
import { GENDER, ROLES } from '../config/constants.js';
import {
  successResponse,
  createdResponse,
  paginatedResponse,
  noContentResponse,
} from '../utils/response.js';
import { NotFoundError, ConflictError, BadRequestError, ForbiddenError } from '../utils/errors.js';

/**
 * Get all patients (with pagination and filters)
 * GET /api/patients
 */
const getAllPatients = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { search, gender, sort, onlyTodayAppointment, appointmentDate } = req.query;

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
  const order = parseSort(sort, ['created_at', 'fullName', 'dateOfBirth'], 'created_at:desc');

  const include = [];

  // Optional filter: only patients who have an appointment on a target date.
  // - onlyTodayAppointment=true => use today (local server date)
  // - appointmentDate=YYYY-MM-DD => use explicit date
  const truthy = new Set(['1', 'true', 'yes', 'on']);
  const onlyToday = truthy.has(String(onlyTodayAppointment || '').toLowerCase());
  const targetDate = onlyToday
    ? (() => {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      })()
    : (appointmentDate || null);

  if (targetDate) {
    include.push({
      model: Appointment,
      as: 'appointments',
      attributes: [],
      required: true,
      where: {
        appointmentDate: targetDate,
      },
    });
  }

  const { count, rows } = await Patient.findAndCountAll({
    where,
    include,
    order,
    limit,
    offset,
    distinct: true,
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

  // If the requester is a patient, ensure they can only access their own record
  if (req.userRole === ROLES.PATIENT) {
    // Compare as strings to avoid type mismatches. Allow access when either:
    // - patient.userId matches the logged-in user id, OR
    // - patient.id matches the logged-in user id (some patients are stored without userId)
    const isOwner = (patient.userId && String(patient.userId) === String(req.userId)) || String(patient.id) === String(req.userId);
    if (!isOwner) {
      logger.warn('getPatientById - patient access denied', {
        routePatientId: id,
        patient_userId: patient.userId,
        patient_id: patient.id,
        requesterId: req.userId,
        requesterRole: req.userRole,
      });
      throw new ForbiddenError('Bạn không có quyền xem hồ sơ bệnh nhân khác', 'INSUFFICIENT_PERMISSIONS');
    }
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

  // Check existing patient with same ID number only when provided.
  // Make `idNumber` optional for patient creation flows.
  if (idNumber && String(idNumber).trim() !== '') {
    const existingPatient = await Patient.findOne({ where: { idNumber } });
    if (existingPatient) {
      throw new ConflictError('Số CCCD đã được đăng ký');
    }
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
  const currentUser = req.user;
  const userRole = req.userRole;

  const patient = await Patient.findByPk(id);
  if (!patient) {
    throw new NotFoundError('Không tìm thấy bệnh nhân');
  }

  // PATIENT role can only edit their own profile with specific fields
  if (userRole === ROLES.PATIENT) {
    // Check if patient is editing their own record
    // Compare as strings to avoid type-mismatch. Allow edit when either:
    // - patient.userId matches the logged-in user id, OR
    // - patient.id matches the logged-in user id (legacy records)
    const isOwner = (patient.userId && String(patient.userId) === String(currentUser.id)) || String(patient.id) === String(currentUser.id);
    if (!isOwner) {
      // Log detailed info to help debug false 403s (ownership/ID mismatch)
      try {
        logger.warn('patient.update - ownership check failed', {
          routePatientId: id,
          patient_userId: patient.userId,
          patient_id: patient.id,
          currentUser_id: currentUser.id,
          currentUser_role: userRole,
        });
      } catch (e) {
        // swallow logging errors
      }

      throw new ForbiddenError('Bạn không có quyền chỉnh sửa hồ sơ của bệnh nhân khác', 'INSUFFICIENT_PERMISSIONS');
    }

    // Allowed fields for patients to edit:
    // - Contact info: phone, email, address
    // - Medical info: medicalHistory, allergies
    // - Other info: emergencyContact, emergencyPhone, notes
    const allowedFields = [
      'phone',
      'email',
      'address',
      'medicalHistory',
      'allergies',
      'emergencyContact',
      'emergencyPhone',
      'notes',
    ];

    // Filter out disallowed fields
      // Keep only allowed fields, and remove any restricted fields if present.
      // Accept both camelCase and snake_case variants from clients.
      const restrictedFieldVariants = new Set([
        'idNumber', 'id_number',
        'fullName', 'full_name',
        'dateOfBirth', 'date_of_birth',
        'gender',
        'insuranceNumber', 'insurance_number',
      ]);

      const attemptedRestricted = Object.keys(updateData).filter((k) => restrictedFieldVariants.has(k));
      if (attemptedRestricted.length > 0) {
        try {
          logger.warn('patient.update - patient attempted to change restricted fields, ignoring', {
            patientId: id,
            attemptedRestricted,
            userId: currentUser.id,
          });
        } catch (e) {}
        // Remove restricted keys from payload so request can continue
        attemptedRestricted.forEach((k) => delete updateData[k]);
      }

      // Remove any other keys not in allowedFields
      Object.keys(updateData).forEach(key => {
        if (!allowedFields.includes(key)) {
          delete updateData[key];
        }
      });
  }

  // Normalize email if provided
  if ('email' in updateData) {
    updateData.email = updateData.email && String(updateData.email).trim() !== '' ? String(updateData.email).trim() : null;
  }

  // Map common snake_case keys from frontend/backward clients to camelCase model attributes
  if ('emergency_contact' in updateData && !('emergencyContact' in updateData)) {
    updateData.emergencyContact = updateData.emergency_contact;
  }
  if ('emergency_phone' in updateData && !('emergencyPhone' in updateData)) {
    updateData.emergencyPhone = updateData.emergency_phone;
  }
  if ('insurance_number' in updateData && !('insuranceNumber' in updateData)) {
    updateData.insuranceNumber = updateData.insurance_number;
  }
  if ('medical_history' in updateData && !('medicalHistory' in updateData)) {
    updateData.medicalHistory = updateData.medical_history;
  }

  // Check ID number uniqueness if changed
  if (updateData.idNumber && updateData.idNumber !== patient.idNumber) {
    const existingPatient = await Patient.findOne({ where: { idNumber: updateData.idNumber } });
    if (existingPatient) {
      throw new ConflictError('Số CCCD đã được đăng ký');
    }
  }

  // Debug: log incoming updateData keys to help track missing fields (emergencyContact/emergencyPhone)
  try {
    logger.debug('updatePatient - incoming updateData', { id, updateData });
  } catch (e) {}

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

  try {
    logger.debug('updatePatient - updated patient', { id: patient.id, patient: patient.toJSON ? patient.toJSON() : patient });
  } catch (e) {}

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
    order: [['created_at', 'DESC']],
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
    order: [['created_at', 'DESC']],
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
