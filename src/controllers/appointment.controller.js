/**
 * Controller Lịch Hẹn
 * Quản lý đặt lịch, xác nhận, check-in, hủy hẹn
 */
import { Op } from 'sequelize';
import { Appointment, Patient, User, MedicalRecord, MedicalExamination } from '../models/index.js';
import { asyncHandler, parsePagination, parseSort } from '../utils/helpers.js';
import {
  successResponse,
  createdResponse,
  paginatedResponse,
  noContentResponse,
} from '../utils/response.js';
import { normalizeStatus, labelToCode, codeToLabel } from '../utils/statusHelpers.js';
import { sequelize } from '../models/database.js';
import { NotFoundError, BadRequestError, ConflictError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { APPOINTMENT_STATUS, ROLES, TIME_SLOTS } from '../config/constants.js';

// Precompute valid status values and a small mapping for common code keys
const VALID_APPOINTMENT_STATUSES = Object.values(APPOINTMENT_STATUS || {});
const STATUS_KEY_MAP = {
  CANCELLED: APPOINTMENT_STATUS.CANCELLED,
  SCHEDULED: APPOINTMENT_STATUS.SCHEDULED,
  CONFIRMED: APPOINTMENT_STATUS.CONFIRMED,
  WAITING: APPOINTMENT_STATUS.WAITING,
  IN_PROGRESS: APPOINTMENT_STATUS.IN_PROGRESS,
  COMPLETED: APPOINTMENT_STATUS.COMPLETED,
};

function resolveStatus(input) {
  if (input == null) return input;
  // already a valid localized status
  if (VALID_APPOINTMENT_STATUSES.includes(input)) return input;
  // try mapping common english/enum keys
  try {
    const key = String(input).toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if (STATUS_KEY_MAP[key]) return STATUS_KEY_MAP[key];
  } catch (e) {
    // ignore
  }
  return null;
}

const appendExaminationRef = (appointmentLike, examinationLike) => {
  if (!appointmentLike) return appointmentLike;
  const examinationId = examinationLike
    ? Number(examinationLike.ExaminationID || examinationLike.examinationId || examinationLike.id || 0)
    : 0;
  if (!Number.isFinite(examinationId) || examinationId <= 0) return appointmentLike;

  appointmentLike.ExaminationID = examinationId;
  appointmentLike.examinationId = examinationId;
  appointmentLike.medicalRecordId = examinationId;
  appointmentLike.recordId = examinationId;
  return appointmentLike;
};

const attachLatestExaminationRefs = async (appointmentRows) => {
  if (!Array.isArray(appointmentRows) || appointmentRows.length === 0) return appointmentRows;

  const appointmentIds = Array.from(
    new Set(
      appointmentRows
        .map((row) => Number(row && (row.id || row.Id)))
        .filter((id) => Number.isFinite(id) && id > 0)
    )
  );

  if (appointmentIds.length === 0) return appointmentRows;

  const examinationRows = await MedicalExamination.findAll({
    where: {
      AppointmentID: { [Op.in]: appointmentIds },
      Status: { [Op.ne]: 2 },
    },
    attributes: ['ExaminationID', 'AppointmentID', 'UpdatedAt'],
    order: [['AppointmentID', 'ASC'], ['UpdatedAt', 'DESC'], ['ExaminationID', 'DESC']],
  });

  const latestByAppointmentId = new Map();
  for (const row of examinationRows) {
    const plain = row && row.get ? row.get({ plain: true }) : row;
    const appointmentId = Number(plain && plain.AppointmentID);
    if (!Number.isFinite(appointmentId) || appointmentId <= 0) continue;
    if (!latestByAppointmentId.has(appointmentId)) latestByAppointmentId.set(appointmentId, plain);
  }

  return appointmentRows.map((row) => {
    const appointmentId = Number(row && (row.id || row.Id));
    const examination = latestByAppointmentId.get(appointmentId);
    return appendExaminationRef(row, examination);
  });
};

const ensureMedicalExaminationForAppointment = async (appointment, { transaction } = {}) => {
  const appointmentId = Number(appointment && appointment.id);
  if (!Number.isFinite(appointmentId) || appointmentId <= 0) return null;

  const existing = await MedicalExamination.findOne({
    where: {
      AppointmentID: appointmentId,
      Status: { [Op.ne]: 2 },
    },
    order: [['UpdatedAt', 'DESC'], ['ExaminationID', 'DESC']],
    transaction,
  });
  if (existing) return existing;

  return MedicalExamination.create(
    {
      AppointmentID: appointmentId,
      PatientId: appointment.patientId ? Number(appointment.patientId) : null,
      DoctorID: appointment.assignedDoctorId
        ? Number(appointment.assignedDoctorId)
        : (appointment.preferredDoctorId ? Number(appointment.preferredDoctorId) : null),
      ExaminationDate: new Date(),
      Symptoms: appointment.symptoms || '',
      Status: 0,
      CreatedAt: new Date(),
      UpdatedAt: new Date(),
    },
    { transaction }
  );
};

/**
 * Lấy tất cả lịch hẹn (có phân trang và lọc)
 * Hỗ trợ lọc theo: status, date, doctorId, patientId, source, search, fromDate-toDate
 * Bác sĩ chỉ thấy lịch hẹn của mình (tự động filter theo assignedDoctorId)
 * GET /api/appointments
 */
const getAllAppointments = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { status, date, doctorId, patientId, source, search, fromDate, toDate, sort } = req.query;

  // Xây dựng điều kiện lọc động (dynamic WHERE clause)
  const where = {};

  // If the requester is a PATIENT, restrict results to their own appointments only.
  if (req.user && req.user.role === ROLES.PATIENT) {
    try {
      // Try to find the Patient record linked to this user
      let patientRecord = await Patient.findOne({ where: { userId: req.user.id } });

      // If not linked, try to auto-link by idNumber or email
      if (!patientRecord) {
        const candidateWhere = {};
        const userIdNumber = req.user.id_number || req.user.idNumber || null;
        const userEmail = (req.user.email || '').toLowerCase() || null;
        if (userIdNumber) candidateWhere.idNumber = userIdNumber;
        if (!userIdNumber && userEmail) candidateWhere.email = userEmail;
        if (Object.keys(candidateWhere).length > 0) {
          const existing = await Patient.findOne({ where: candidateWhere });
          if (existing) {
            if (!existing.userId) {
              existing.userId = req.user.id;
              await existing.save();
            }
            patientRecord = existing;
          }
        }
      }

      // If still not found, attempt a best-effort creation so patient has canonical record
      if (!patientRecord) {
        try {
          patientRecord = await Patient.create({
            userId: req.user.id,
            fullName: req.user.full_name || req.user.fullName || req.user.username || 'Bệnh nhân',
            phone: req.user.phone || null,
            email: req.user.email || null,
            idNumber: req.user.id_number || req.user.idNumber || null,
          });
        } catch (e) {
          // ignore creation errors (unique constraints) and fall back to filtering by user id
          patientRecord = null;
        }
      }

      if (patientRecord && patientRecord.id) {
        where.patientId = patientRecord.id;
      } else {
        // fallback: some installations may store patientId as the user id for legacy reasons
        where.patientId = req.user.id;
      }
    } catch (e) {
      // On any failure, restrict to nothing rather than leaking others' data
      // (return empty set) — set impossible id filter
      where.patientId = -1;
    }
  }

  if (status) {
    // Convert status label to numeric code if needed (DB stores INTEGER)
    const statusCode = labelToCode(status) || (Number.isNaN(Number(status)) ? null : Number(status));
    if (statusCode != null) {
      where.status = statusCode;
    }
  }

  if (date) {
    where.appointmentDate = date;
  }

  // Lọc theo khoảng ngày (hỗ trợ 3 kiểu: cả 2, chỉ fromDate, chỉ toDate)
  if (fromDate && toDate) {
    where.appointmentDate = {
      [Op.between]: [fromDate, toDate],
    };
  } else if (fromDate) {
    where.appointmentDate = { [Op.gte]: fromDate };
  } else if (toDate) {
    where.appointmentDate = { [Op.lte]: toDate };
  }

  if (doctorId) {
    where.assignedDoctorId = doctorId;
  }

  if (patientId) {
    where.patientId = patientId;
  }

  if (source) {
    where.source = source;
  }

  // Tìm kiếm theo tên, sđt, hoặc mã lịch hẹn (LIKE pattern)
  if (search) {
    where[Op.or] = [
      { patientName: { [Op.like]: `%${search}%` } },
      { patientPhone: { [Op.like]: `%${search}%` } },
      { id: { [Op.like]: `%${search}%` } },
    ];
  }

  // Role-based filtering
  if (req.user.role === ROLES.DOCTOR) {
    where.assignedDoctorId = req.user.id;
  }

  // Parse sort (use DB timestamp column names)
  const order = parseSort(sort, ['appointment_date', 'created_at', 'time_slot'], 'created_at:desc');

  let count, rows;
  try {
    ({ count, rows } = await Appointment.findAndCountAll({
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
          as: 'assignedDoctor',
          attributes: ['id', 'fullName'],
          required: false,
        },
      ],
    }));
  } catch (e) {
    // If DB schema mismatch causes conversion errors when joining (e.g. varchar vs bigint),
    // retry without includes so appointments listing remains available.
    const msg = String(e && (e.message || e.original && e.original.message || ''));
    console.warn('Appointment.findAndCountAll with includes failed, retrying without joins:', msg);
    if (msg.toLowerCase().includes('converting data type') || msg.toLowerCase().includes('invalid column') || msg.toLowerCase().includes('cannot convert')) {
      ({ count, rows } = await Appointment.findAndCountAll({ where, order, limit, offset }));
    } else {
      throw e;
    }
  }

  // Normalize rows to plain objects and ensure status is present
  const plainRows = (rows || []).map((r) => {
    try {
      const obj = r && r.get ? r.get({ plain: true }) : r;
      if (!obj.status) obj.status = APPOINTMENT_STATUS.SCHEDULED;
      // attach normalized status code/label
      const norm = normalizeStatus(obj.status);
      obj.statusCode = norm.code;
      obj.statusLabel = norm.label;
      // Ensure assignedDoctorName is available on top-level for clients
      try {
        if (!obj.assignedDoctorName) {
          const fromInclude = obj.assignedDoctor && (obj.assignedDoctor.fullName || obj.assignedDoctor.full_name || obj.assignedDoctor.name);
          obj.assignedDoctorName = fromInclude || obj.preferredDoctorName || obj.assignedDoctorName || null;
        }
        if (obj.assignedDoctorName && !obj.assigned_doctor_name) obj.assigned_doctor_name = obj.assignedDoctorName;
      } catch (e) {
        // ignore mapping errors
      }
      return obj;
    } catch (e) {
      if (r && r.dataValues) {
        const obj = { ...r.dataValues };
        if (!obj.status) obj.status = APPOINTMENT_STATUS.SCHEDULED;
        const norm = normalizeStatus(obj.status);
        obj.statusCode = norm.code;
        obj.statusLabel = norm.label;
        try {
          if (!obj.assignedDoctorName) {
            const fromInclude = obj.assignedDoctor && (obj.assignedDoctor.fullName || obj.assignedDoctor.full_name || obj.assignedDoctor.name);
            obj.assignedDoctorName = fromInclude || obj.preferredDoctorName || obj.assignedDoctorName || null;
          }
          if (obj.assignedDoctorName && !obj.assigned_doctor_name) obj.assigned_doctor_name = obj.assignedDoctorName;
        } catch (e2) {
          // ignore mapping errors
        }
        return obj;
      }
      return r;
    }
  });

  await attachLatestExaminationRefs(plainRows);

  return paginatedResponse(res, {
    data: plainRows,
    page,
    limit,
    total: count,
  });
});


/**
 * Get appointment by ID
 * GET /api/appointments/:id
 */
const getAppointmentById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Build includes defensively in case some models are not present in this deployment
  const includes = [];
  if (typeof Patient !== 'undefined' && Patient) includes.push({ model: Patient, as: 'patient', required: false });
  if (typeof User !== 'undefined' && User) {
    includes.push({ model: User, as: 'assignedDoctor', attributes: ['id', 'fullName', 'phone', 'email', 'signature'], required: false });
    includes.push({ model: User, as: 'preferredDoctor', attributes: ['id', 'fullName'], required: false });
  }
  if (typeof MedicalRecord !== 'undefined' && MedicalRecord) includes.push({ model: MedicalRecord, as: 'medicalRecord', required: false });

  const appointment = await Appointment.findByPk(id, { include: includes });

  if (!appointment) {
    throw new NotFoundError('Không tìm thấy lịch hẹn');
  }

  // If requester is a PATIENT, ensure they own this appointment
  if (req.user && req.user.role === ROLES.PATIENT) {
    try {
      const patientRecord = await Patient.findOne({ where: { userId: req.user.id } });
      const patientIdForUser = patientRecord && patientRecord.id ? patientRecord.id : null;
      // Appointment.patientId may be null in some legacy rows; deny access unless it matches
      if (!patientIdForUser || String(appointment.patientId) !== String(patientIdForUser)) {
        throw new ForbiddenError('Bạn không có quyền xem lịch hẹn của bệnh nhân khác', 'INSUFFICIENT_PERMISSIONS');
      }
    } catch (e) {
      if (e instanceof ForbiddenError) throw e;
      // any lookup error -> deny access
      throw new ForbiddenError('Bạn không có quyền xem lịch hẹn của bệnh nhân khác', 'INSUFFICIENT_PERMISSIONS');
    }
  }
  // normalize status fields for response
  const plain = appointment.get ? appointment.get({ plain: true }) : appointment;
  const norm = normalizeStatus(plain.status);
  plain.statusCode = norm.code;
  plain.statusLabel = norm.label;

  // Ensure assignedDoctorName is present for client display
  try {
    if (!plain.assignedDoctorName) {
      const fromInclude = plain.assignedDoctor && (plain.assignedDoctor.fullName || plain.assignedDoctor.full_name || plain.assignedDoctor.name);
      plain.assignedDoctorName = fromInclude || plain.preferredDoctorName || plain.assignedDoctorName || null;
    }
    if (plain.assignedDoctorName && !plain.assigned_doctor_name) plain.assigned_doctor_name = plain.assignedDoctorName;
  } catch (e) {
    // ignore
  }

  const linkedExamination = await MedicalExamination.findOne({
    where: {
      AppointmentID: Number(id),
      Status: { [Op.ne]: 2 },
    },
    order: [['UpdatedAt', 'DESC'], ['ExaminationID', 'DESC']],
  });
  appendExaminationRef(
    plain,
    linkedExamination && linkedExamination.get ? linkedExamination.get({ plain: true }) : linkedExamination
  );

  return successResponse(res, plain);
});

/**
 * Tạo lịch hẹn mới
 * Kiểm tra trùng khung giờ: cùng doctor + cùng ngày + cùng slot + chưa hủy/xong
 * POST /api/appointments
 */
const createAppointment = asyncHandler(async (req, res) => {
  const {
    patientId,
    patientName,
    patientGender,
    patientBirthDate,
    patientPhone,
    patientEmail,
    appointmentDate,
    timeSlot,
    estimatedDuration,
    examType,
    symptoms,
    preferredDoctorId,
    preferredDoctorName,
    assignedDoctorId,
    assignedDoctorName,
    source,
    patientNotes,
    internalNotes,
  } = req.body;

  // Kiểm tra trùng lịch: cùng bác sĩ, cùng ngày, cùng khung giờ
  // Chỉ đếm các lịch hẹn chưa hủy và chưa hoàn thành
  const cancelledCode = labelToCode(APPOINTMENT_STATUS.CANCELLED);
  const completedCode = labelToCode(APPOINTMENT_STATUS.COMPLETED);
  const notInStatusCodes = [];
  if (cancelledCode != null) notInStatusCodes.push(cancelledCode);
  if (completedCode != null) notInStatusCodes.push(completedCode);

  const existingAppointment = await Appointment.findOne({
    where: {
      appointmentDate,
      timeSlot,
      assignedDoctorId: assignedDoctorId || preferredDoctorId,
      status: { [Op.notIn]: notInStatusCodes.length ? notInStatusCodes : [APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.COMPLETED] },
    },
  });

  if (existingAppointment) {
    throw new ConflictError('Khung giờ này đã có lịch hẹn khác');
  }

  // Lấy tên bác sĩ từ DB nếu chỉ có ID
  let doctorName = assignedDoctorName;
  if (assignedDoctorId && !doctorName) {
    const doctor = await User.findByPk(assignedDoctorId);
    if (doctor) {
      doctorName = doctor.fullName;
    }
  }

  // Build create data (omit status so DB default/check is applied)
  const createData = {
    patientId,
    patientName,
    patientGender,
    patientBirthDate,
    patientPhone,
    patientEmail,
    appointmentDate,
    timeSlot,
    estimatedDuration: estimatedDuration || 30,
    examType,
    symptoms,
    preferredDoctorId,
    preferredDoctorName,
    assignedDoctorId,
    assignedDoctorName: doctorName,
    source: source || 'Offline',
    patientNotes,
    internalNotes,
  };

  // If the requester is a PATIENT, ensure the appointment is linked to their canonical Patient record
  if (req.user && req.user.role === ROLES.PATIENT) {
    try {
      let patientRecord = await Patient.findOne({ where: { userId: req.user.id } });

      // Try auto-link heuristics if not linked
      if (!patientRecord) {
        const candidateWhere = {};
        const userIdNumber = req.user.id_number || req.user.idNumber || null;
        const userEmail = (req.user.email || '').toLowerCase() || null;
        if (userIdNumber) candidateWhere.idNumber = userIdNumber;
        if (!userIdNumber && userEmail) candidateWhere.email = userEmail;
        if (Object.keys(candidateWhere).length > 0) {
          const existing = await Patient.findOne({ where: candidateWhere });
          if (existing) {
            if (!existing.userId) {
              existing.userId = req.user.id;
              await existing.save();
            }
            patientRecord = existing;
          }
        }
      }

      // If still not found, attempt to create a minimal Patient record
      if (!patientRecord) {
        try {
          patientRecord = await Patient.create({
            userId: req.user.id,
            fullName: req.user.full_name || req.user.fullName || req.user.username || 'Bệnh nhân',
            phone: req.user.phone || null,
            email: req.user.email || null,
            idNumber: req.user.id_number || req.user.idNumber || null,
          });
        } catch (e) {
          // ignore creation error and fall back
          patientRecord = null;
        }
      }

      if (patientRecord && patientRecord.id) {
        createData.patientId = patientRecord.id;
        createData.patientName = createData.patientName || patientRecord.fullName || (req.user.full_name || req.user.fullName || req.user.username || '');
        createData.patientPhone = createData.patientPhone || patientRecord.phone || req.user.phone || '';
        createData.patientEmail = createData.patientEmail || patientRecord.email || req.user.email || '';
        createData.source = createData.source || 'Online';
      } else {
        // Fallback: use user-level id (legacy)
        createData.patientId = req.user.id;
        createData.source = createData.source || 'Online';
      }
    } catch (e) {
      // on error, ensure we still set source so receptionist receives online flag
      createData.source = createData.source || 'Online';
    }
  }
  // Determine status code: prefer explicit `status` from request if valid, otherwise default to SCHEDULED
  let statusCode = null;
  if (req.body.status != null) {
    // labelToCode handles numeric strings and known labels
    const providedCode = labelToCode(req.body.status);
    if (providedCode != null) statusCode = providedCode;
  }
  if (statusCode == null) {
    const scheduledResolved = resolveStatus(APPOINTMENT_STATUS.SCHEDULED) || APPOINTMENT_STATUS.SCHEDULED;
    statusCode = labelToCode(scheduledResolved) || labelToCode(APPOINTMENT_STATUS.SCHEDULED) || 1;
  }
  createData.status = statusCode;

  // Generate human-friendly appointment code (stored in Appointment.AppointmentID)
  try {
  const last = await Appointment.findOne({ order: [['created_at', 'DESC']], paranoid: false });
    let nextNum = 1;
    if (last && last.appointmentId) {
      const m = String(last.appointmentId).match(/APT(\d+)/);
      if (m) nextNum = parseInt(m[1], 10) + 1;
    }
    createData.appointmentId = `APT${String(nextNum).padStart(3, '0')}`;
  } catch (e) {
    createData.appointmentId = `APT001`;
  }

  // Create appointment (DB will assign numeric identity PK)
  let appointment = await Appointment.create(createData);

  // Reload to include associations/fields so we can populate friendly names
  appointment = await Appointment.findByPk(appointment.id, {
    include: [
      { model: Patient, as: 'patient', required: false },
      { model: User, as: 'assignedDoctor', attributes: ['id', 'fullName'], required: false },
      { model: User, as: 'preferredDoctor', attributes: ['id', 'fullName'], required: false },
    ],
  });

  // Ensure top-level assignedDoctorName is present for clients
  try {
    const apPlain = appointment.get ? appointment.get({ plain: true }) : appointment;
    if (!apPlain.assignedDoctorName) {
      const fromInclude = apPlain.assignedDoctor && (apPlain.assignedDoctor.fullName || apPlain.assignedDoctor.full_name || apPlain.assignedDoctor.name);
      apPlain.assignedDoctorName = fromInclude || apPlain.preferredDoctorName || apPlain.assignedDoctorName || null;
    }
    if (apPlain.assignedDoctorName && !apPlain.assigned_doctor_name) apPlain.assigned_doctor_name = apPlain.assignedDoctorName;
    // copy normalized values back into appointment instance where possible
    try {
      if (appointment && appointment.set) appointment.set('assignedDoctorName', apPlain.assignedDoctorName);
    } catch (x) {
      // ignore
    }
  } catch (e) {
    // ignore
  }

  // Emit real-time notification via Socket.IO to receptionists
  try {
    const io = req.app?.get?.('io');
    if (io) {
      const appointmentPlain = appointment.get ? appointment.get({ plain: true }) : appointment;
      io.to('receptionists').emit('appointment:new', {
        appointment: appointmentPlain,
        message: `Có lịch hẹn mới: ${appointmentPlain.patientName || 'Bệnh nhân'} - ${appointmentPlain.appointmentDate} ${appointmentPlain.timeSlot}`,
        timestamp: new Date().toISOString(),
      });

      // Notify the patient who created the appointment
      if (req.user?.id) {
        io.to(`patient:${req.user.id}`).emit('appointment:confirmed', {
          appointment: appointmentPlain,
          message: 'Đã đặt lịch khám thành công',
          timestamp: new Date().toISOString(),
        });
      }
      logger.info(`[Appointment] New appointment created and broadcasted: ${appointment.id}`);
    }
  } catch (error) {
    logger.warn('[Appointment] Socket.IO broadcast failed:', error.message);
    // Don't throw - appointment creation should succeed even if socket fails
  }

  const responsePayload = appointment.get ? appointment.get({ plain: true }) : appointment;

  // Ensure the response contains friendly status label/code for clients
  try {
    const statusSource = responsePayload.status ;
    const norm = normalizeStatus(statusSource);
    if (norm && norm.label) responsePayload.statusLabel = norm.label;
    if (norm && norm.code != null) responsePayload.statusCode = norm.code;
    if (responsePayload.status == null && norm && norm.code != null) responsePayload.status = norm.code;
  } catch (e) {
    // noop - don't fail creation due to UI-friendly formatting
  }

  return createdResponse(res, responsePayload, 'Tạo lịch hẹn thành công');
});

/**
 * Cập nhật lịch hẹn
 * Không cho cập nhật lịch đã hủy/hoàn thành
 * Kiểm tra trùng lịch nếu thay đổi ngày/giờ/bác sĩ
 * PUT /api/appointments/:id
 */
const updateAppointment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const appointment = await Appointment.findByPk(id);
  if (!appointment) {
    throw new NotFoundError('Không tìm thấy lịch hẹn');
  }

  // If requester is a PATIENT, ensure they own this appointment before allowing cancel
  if (req.user && req.user.role === ROLES.PATIENT) {
    try {
      const patientRecord = await Patient.findOne({ where: { userId: req.user.id } });
      const patientIdForUser = patientRecord && patientRecord.id ? patientRecord.id : null;
      if (!patientIdForUser || String(appointment.patientId) !== String(patientIdForUser)) {
        throw new ForbiddenError('Bạn không có quyền hủy lịch hẹn của bệnh nhân khác', 'INSUFFICIENT_PERMISSIONS');
      }
    } catch (e) {
      if (e instanceof ForbiddenError) throw e;
      throw new ForbiddenError('Bạn không có quyền hủy lịch hẹn của bệnh nhân khác', 'INSUFFICIENT_PERMISSIONS');
    }
  }

  // Kiểm tra không cho sửa lịch đã hủy hoặc hoàn thành
  const currentNorm = normalizeStatus(appointment.status);
  if ([labelToCode(APPOINTMENT_STATUS.CANCELLED), labelToCode(APPOINTMENT_STATUS.COMPLETED)].includes(currentNorm.code)) {
    throw new BadRequestError('Không thể cập nhật lịch hẹn đã hủy hoặc hoàn thành');
  }

  // Kiểm tra trùng lịch nếu thay đổi ngày/giờ/bác sĩ
  // Dùng giá trị mới nếu có, không thì lấy giá trị cũ (fallback)
  if (
    updateData.appointmentDate ||
    updateData.timeSlot ||
    updateData.assignedDoctorId
  ) {
    // Prepare list of status codes to exclude from conflict checks (cancelled/completed)
    const cancelledCode = labelToCode(APPOINTMENT_STATUS.CANCELLED);
    const completedCode = labelToCode(APPOINTMENT_STATUS.COMPLETED);
    const notInStatusCodes = [];
    if (cancelledCode != null) notInStatusCodes.push(cancelledCode);
    if (completedCode != null) notInStatusCodes.push(completedCode);
    const conflictWhere = {
      id: { [Op.ne]: id },
      appointmentDate: updateData.appointmentDate || appointment.appointmentDate,
      timeSlot: updateData.timeSlot || appointment.timeSlot,
      assignedDoctorId: updateData.assignedDoctorId || appointment.assignedDoctorId,
      status: { [Op.notIn]: notInStatusCodes.length ? notInStatusCodes : [APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.COMPLETED] },
    };

    const existingAppointment = await Appointment.findOne({ where: conflictWhere });
    if (existingAppointment) {
      throw new ConflictError('Khung giờ này đã có lịch hẹn khác');
    }
  }

  // Tự động cập nhật tên bác sĩ khi đổi bác sĩ
  if (updateData.assignedDoctorId && !updateData.assignedDoctorName) {
    const doctor = await User.findByPk(updateData.assignedDoctorId);
    if (doctor) {
      updateData.assignedDoctorName = doctor.fullName;
    }
  }

  // Resolve and validate status if provided in update payload
  if (Object.prototype.hasOwnProperty.call(updateData, 'status')) {
    const resolved = resolveStatus(updateData.status);
    if (!resolved) {
      throw new BadRequestError(`Giá trị trạng thái không hợp lệ: ${updateData.status}`);
    }
    // If DB stores numeric codes for status, convert known labels to codes
    // Convert label to numeric code for DB storage
    updateData.status = labelToCode(resolved) || labelToCode(APPOINTMENT_STATUS.SCHEDULED) || 1;
    console.debug('updateAppointment: resolved status ->', updateData.status);
  }

  await appointment.update(updateData);

  return successResponse(res, appointment, 'Cập nhật lịch hẹn thành công');
});

/**
 * Hủy lịch hẹn - cập nhật trạng thái + lý do hủy
 * POST /api/appointments/:id/cancel
 */
const cancelAppointment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  const appointment = await Appointment.findByPk(id);
  if (!appointment) {
    throw new NotFoundError('Không tìm thấy lịch hẹn');
  }

  const apptNorm = normalizeStatus(appointment.status);
  if (apptNorm.code === labelToCode(APPOINTMENT_STATUS.CANCELLED)) {
    throw new BadRequestError('Lịch hẹn đã bị hủy trước đó');
  }

  if (apptNorm.code === labelToCode(APPOINTMENT_STATUS.COMPLETED)) {
    throw new BadRequestError('Không thể hủy lịch hẹn đã hoàn thành');
  }

  // resolve status to DB-safe value and log attempt for diagnostics
  const cancelStatus = resolveStatus(APPOINTMENT_STATUS.CANCELLED) || APPOINTMENT_STATUS.CANCELLED;
  if (!VALID_APPOINTMENT_STATUSES.includes(cancelStatus)) {
    console.error('cancelAppointment: resolved status not in allowed list', { cancelStatus, allowed: VALID_APPOINTMENT_STATUSES });
  }
  try {
    // Convert label to numeric code for DB storage
    const cancelStatusCode = labelToCode(cancelStatus) || labelToCode(APPOINTMENT_STATUS.CANCELLED) || 4;
    console.error('cancelAppointment: attempting update', { id: appointment.id, status: cancelStatusCode });
    await appointment.update({
      status: cancelStatusCode,
      cancelledAt: new Date(),
      cancelReason: reason,
    });
  } catch (e) {
    console.error('cancelAppointment: DB update failed. attempted status=', cancelStatus, e?.message || e);
    throw e;
  }

  return successResponse(res, appointment, 'Hủy lịch hẹn thành công');
});

/**
 * Xác nhận lịch hẹn (scheduled → confirmed)
 * POST /api/appointments/:id/confirm
 */
const confirmAppointment = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const appointment = await Appointment.findByPk(id);
  if (!appointment) {
    throw new NotFoundError('Không tìm thấy lịch hẹn');
  }

  const apptNorm2 = normalizeStatus(appointment.status);
  if (apptNorm2.code !== labelToCode(APPOINTMENT_STATUS.SCHEDULED)) {
    throw new BadRequestError('Chỉ có thể xác nhận lịch hẹn đang ở trạng thái đã đặt');
  }

  // ensure DB-friendly status
  const confirmedStatus = resolveStatus(APPOINTMENT_STATUS.CONFIRMED);
  if (!confirmedStatus) {
    throw new BadRequestError('Giá trị trạng thái xác nhận không hợp lệ');
  }
  try {
    if (!VALID_APPOINTMENT_STATUSES.includes(confirmedStatus)) {
      console.error('confirmAppointment: resolved status not in allowed list', { confirmedStatus, allowed: VALID_APPOINTMENT_STATUSES });
    }
    // Convert label to numeric code for DB storage
    const confirmedStatusCode = labelToCode(confirmedStatus) || labelToCode(APPOINTMENT_STATUS.CONFIRMED) || 1;
    console.error('confirmAppointment: attempting update', { id: appointment.id, status: confirmedStatusCode });
    await appointment.update({
      status: confirmedStatusCode,
      confirmedAt: new Date(),
    });
  } catch (e) {
    console.error('confirmAppointment: DB update failed. attempted status=', confirmedStatus, e?.message || e);
    throw e;
  }

  return successResponse(res, appointment, 'Xác nhận lịch hẹn thành công');
});

/**
 * Check-in bệnh nhân đến khám (scheduled/confirmed → waiting)
 * Là bước cuối của quy trình tiếp nhận trước khi vào phòng khám
 * POST /api/appointments/:id/check-in
 */
const checkInAppointment = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const tx = await sequelize.transaction();
  try {
    const appointment = await Appointment.findByPk(id, { transaction: tx, lock: tx.LOCK.UPDATE });
    if (!appointment) {
      throw new NotFoundError('Không tìm thấy lịch hẹn');
    }

    const apptNorm3 = normalizeStatus(appointment.status);
    const schedCode = labelToCode(APPOINTMENT_STATUS.SCHEDULED);
    const confCode = labelToCode(APPOINTMENT_STATUS.CONFIRMED);
    const waitingCodeExisting = labelToCode(APPOINTMENT_STATUS.WAITING);
    const inProgressCode = labelToCode(APPOINTMENT_STATUS.IN_PROGRESS);

    if (![schedCode, confCode, waitingCodeExisting, inProgressCode].includes(apptNorm3.code)) {
      throw new BadRequestError('Không thể check-in lịch hẹn này');
    }

    if (![waitingCodeExisting, inProgressCode].includes(apptNorm3.code)) {
      const waitingStatus = resolveStatus(APPOINTMENT_STATUS.WAITING);
      if (!waitingStatus) {
        throw new BadRequestError('Giá trị trạng thái không hợp lệ');
      }
      const waitingStatusCode = labelToCode(waitingStatus) || labelToCode(APPOINTMENT_STATUS.WAITING) || 2;
      await appointment.update({ status: waitingStatusCode }, { transaction: tx });
      await appointment.reload({ transaction: tx });
    }

    const linkedExamination = await ensureMedicalExaminationForAppointment(appointment, { transaction: tx });
    const plain = appointment.get ? appointment.get({ plain: true }) : appointment;
    appendExaminationRef(
      plain,
      linkedExamination && linkedExamination.get ? linkedExamination.get({ plain: true }) : linkedExamination
    );

    await tx.commit();
    return successResponse(res, plain, 'Check-in thành công');
  } catch (e) {
    await tx.rollback();
    throw e;
  }
});

/**
 * Delete appointment (soft delete)
 * DELETE /api/appointments/:id
 */
const deleteAppointment = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const appointment = await Appointment.findByPk(id);
  if (!appointment) {
    throw new NotFoundError('Không tìm thấy lịch hẹn');
  }

  await appointment.destroy();

  return noContentResponse(res);
});

/**
 * Get today's appointments
 * GET /api/appointments/today
 */
const getTodayAppointments = asyncHandler(async (req, res) => {
  // Compute today's date in Vietnam timezone (YYYY-MM-DD)
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  const { doctorId, status } = req.query;

  const where = { appointmentDate: today };

  if (doctorId) {
    where.assignedDoctorId = doctorId;
  }

  if (status) {
    // allow numeric or string status; leave normalization to caller
    where.status = status;
  }

  // Role-based filtering
  if (req.user && req.user.role === ROLES.DOCTOR) {
    const waitingCode = labelToCode(APPOINTMENT_STATUS.WAITING) || 2;
    // doctor sees their appointments or any waiting appointment
    where[Op.or] = [
      { assignedDoctorId: req.user.id },
      { status: waitingCode },
    ];
  }

  // Return model instances and convert to plain objects (camelCase keys)
  const appointments = await Appointment.findAll({
    where,
    order: [['timeSlot', 'ASC']],
    include: [
      {
        model: Patient,
        as: 'patient',
        attributes: ['id', 'fullName', 'phone', 'dateOfBirth', 'gender'],
        required: false,
      },
    ],
  });

  // Normalize appointments to plain objects and ensure status is present
  const safeAppointments = (appointments || []).map((a) => {
    const obj = a && a.get ? a.get({ plain: true }) : (a || {});
    if (!obj.status) obj.status = APPOINTMENT_STATUS.SCHEDULED;
    const norm = normalizeStatus(obj.status);
    obj.statusCode = norm.code;
    obj.statusLabel = norm.label;
    try {
      if (!obj.assignedDoctorName) {
        const fromInclude = obj.assignedDoctor && (obj.assignedDoctor.fullName || obj.assignedDoctor.full_name || obj.assignedDoctor.name);
        obj.assignedDoctorName = fromInclude || obj.preferredDoctorName || obj.assignedDoctorName || null;
      }
      if (obj.assignedDoctorName && !obj.assigned_doctor_name) obj.assigned_doctor_name = obj.assignedDoctorName;
    } catch (e) {
      // ignore
    }
    return obj;
  });

  await attachLatestExaminationRefs(safeAppointments);

  return successResponse(res, safeAppointments);
});

/**
 * Get available time slots for a date
 * GET /api/appointments/available-slots
 */
const getAvailableSlots = asyncHandler(async (req, res) => {
  const { date, doctorId } = req.query;

  if (!date) {
    throw new BadRequestError('Ngày không được để trống');
  }

    // Get booked slots (TIME_SLOTS imported at top)
    // Consider appointments where the doctor is either assigned or preferred
    const bookedWhere = {
      appointment_date: date, // snake_case in DB
      status: {
        [Op.notIn]: [
          labelToCode(APPOINTMENT_STATUS.CANCELLED) || APPOINTMENT_STATUS.CANCELLED,
        ],
      },
    };

    if (doctorId) {
      bookedWhere[Op.or] = [
        { assigned_doctor_id: doctorId },
        { preferred_doctor_id: doctorId },
      ];
    }

    const bookedAppointments = await Appointment.findAll({
      where: bookedWhere,
      attributes: ['time_slot', 'assigned_doctor_id', 'preferred_doctor_id'],
      raw: true,
      mapToModel: false,
    });

    const bookedSlots = bookedAppointments.map((a) => a.time_slot);
    const availableSlots = TIME_SLOTS.filter((slot) => !bookedSlots.includes(slot));

  return successResponse(res, {
    date,
    availableSlots,
    bookedSlots,
  });
});

export {
  getAllAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  cancelAppointment,
  confirmAppointment,
  checkInAppointment,
  deleteAppointment,
  getTodayAppointments,
  getAvailableSlots,
};
