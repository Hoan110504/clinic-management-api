/**
 * Controller Lịch Hẹn
 * Quản lý đặt lịch, xác nhận, check-in, hủy hẹn
 */
import { Op } from 'sequelize';
import { Appointment, Patient, User, MedicalRecord } from '../models/index.js';
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
      return obj;
    } catch (e) {
      if (r && r.dataValues) {
        const obj = { ...r.dataValues };
        if (!obj.status) obj.status = APPOINTMENT_STATUS.SCHEDULED;
        const norm = normalizeStatus(obj.status);
        obj.statusCode = norm.code;
        obj.statusLabel = norm.label;
        return obj;
      }
      return r;
    }
  });

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
  // normalize status fields for response
  const plain = appointment.get ? appointment.get({ plain: true }) : appointment;
  const norm = normalizeStatus(plain.status);
  plain.statusCode = norm.code;
  plain.statusLabel = norm.label;

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

  // Reload to include associations/fields
  appointment = await Appointment.findByPk(appointment.id);

  return createdResponse(res, appointment, 'Tạo lịch hẹn thành công');
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

  const appointment = await Appointment.findByPk(id);
  if (!appointment) {
    throw new NotFoundError('Không tìm thấy lịch hẹn');
  }

  const apptNorm3 = normalizeStatus(appointment.status);
  const schedCode = labelToCode(APPOINTMENT_STATUS.SCHEDULED);
  const confCode = labelToCode(APPOINTMENT_STATUS.CONFIRMED);
  // Allow check-in only from SCHEDULED or CONFIRMED.
  // If already WAITING or IN_PROGRESS, treat as idempotent success.
  const waitingCodeExisting = labelToCode(APPOINTMENT_STATUS.WAITING);
  const inProgressCode = labelToCode(APPOINTMENT_STATUS.IN_PROGRESS);

  if (apptNorm3.code === waitingCodeExisting || apptNorm3.code === inProgressCode) {
    return successResponse(res, appointment, 'Bệnh nhân đã được check-in');
  }

  if (![schedCode, confCode].includes(apptNorm3.code)) {
    throw new BadRequestError('Không thể check-in lịch hẹn này');
  }

  const waitingStatus = resolveStatus(APPOINTMENT_STATUS.WAITING);
  console.error('[checkInAppointment] APPOINTMENT_STATUS.WAITING value:', APPOINTMENT_STATUS.WAITING);
  console.error('[checkInAppointment] resolved waitingStatus:', waitingStatus);
  if (!waitingStatus) {
    throw new BadRequestError('Giá trị trạng thái không hợp lệ');
  }
  if (!VALID_APPOINTMENT_STATUSES.includes(waitingStatus)) {
    console.error('checkInAppointment: resolved status not in allowed list', { waitingStatus, allowed: VALID_APPOINTMENT_STATUSES });
  }
  try {
    // Convert label to numeric code for DB storage
    const waitingStatusCode = labelToCode(waitingStatus) || labelToCode(APPOINTMENT_STATUS.WAITING) || 2;
    console.error('checkInAppointment: before update - appointment (plain):', appointment && appointment.get ? appointment.get({ plain: true }) : appointment);
    console.error('checkInAppointment: attempting update', { id: appointment.id, status: waitingStatusCode });

    const updated = await appointment.update({ status: waitingStatusCode }, { returning: true });
    console.error('checkInAppointment: update returned (updated instance):', updated && updated.get ? updated.get({ plain: true }) : updated);

    // Fetch fresh row directly from DB to confirm persisted value (raw query to avoid include issues)
    try {
      const [rows] = await sequelize.query("SELECT * FROM appointments WHERE id = :id", { replacements: { id }, type: sequelize.QueryTypes.SELECT });
      console.error('checkInAppointment: fresh from DB (raw query):', rows);
    } catch (qerr) {
      console.error('checkInAppointment: failed to fetch raw row from DB:', qerr?.message || qerr);
    }

    // Reload the original instance and log final state
    await appointment.reload();
    console.error('checkInAppointment: after reload appointment.status:', appointment.status);
  } catch (e) {
    console.error('checkInAppointment: DB update failed. attempted status=', waitingStatus, e?.message || e);
    throw e;
  }

  return successResponse(res, appointment, 'Check-in thành công');
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
  const today = new Date().toISOString().split('T')[0];
  const { doctorId, status } = req.query;

  const where = { appointmentDate: today };

  if (doctorId) {
    where.assignedDoctorId = doctorId;
  }

  if (status) {
    where.status = status;
  }

  // Role-based filtering
  // Doctors should see:
  // 1. Appointments assigned to them
  // 2. All waiting (status=2) appointments (receptionist check-ins), even if not assigned
  if (req.user.role === ROLES.DOCTOR) {
    const waitingCode = labelToCode(APPOINTMENT_STATUS.WAITING) || 2;
    where[Op.or] = [
      { assignedDoctorId: req.user.id },
      { status: waitingCode }
    ];
  }

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
  const safeAppointments = appointments.map(a => {
    try {
      const obj = a && a.get ? a.get({ plain: true }) : a;
      if (!obj.status) obj.status = APPOINTMENT_STATUS.SCHEDULED;
      const norm = normalizeStatus(obj.status);
      obj.statusCode = norm.code;
      obj.statusLabel = norm.label;
      return obj;
    } catch (e) {
      if (a && a.dataValues) {
        const obj = { ...a.dataValues };
        if (!obj.status) obj.status = APPOINTMENT_STATUS.SCHEDULED;
        const norm = normalizeStatus(obj.status);
        obj.statusCode = norm.code;
        obj.statusLabel = norm.label;
        return obj;
      }
      return a;
    }
  });

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
  const bookedAppointments = await Appointment.findAll({
    where: {
      appointmentDate: date,
      ...(doctorId && { assignedDoctorId: doctorId }),
      status: {
        [Op.notIn]: [labelToCode(APPOINTMENT_STATUS.CANCELLED) || APPOINTMENT_STATUS.CANCELLED],
      },
    },
    attributes: ['timeSlot', 'assignedDoctorId'],
  });

  const bookedSlots = bookedAppointments.map((a) => a.timeSlot);
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
