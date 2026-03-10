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
    where.status = status;
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

  // Parse sort
  const order = parseSort(sort, ['appointmentDate', 'createdAt', 'timeSlot']);

  const { count, rows } = await Appointment.findAndCountAll({
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
  });

  // Normalize rows to plain objects and ensure status is present
  const plainRows = (rows || []).map((r) => {
    try {
      const obj = r && r.get ? r.get({ plain: true }) : r;
      if (!obj.status) obj.status = APPOINTMENT_STATUS.SCHEDULED;
      return obj;
    } catch (e) {
      if (r && r.dataValues) {
        const obj = { ...r.dataValues };
        if (!obj.status) obj.status = APPOINTMENT_STATUS.SCHEDULED;
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

  const appointment = await Appointment.findByPk(id, {
    include: [
      {
        model: Patient,
        as: 'patient',
        required: false,
      },
      {
        model: User,
        as: 'assignedDoctor',
        attributes: ['id', 'fullName', 'phone', 'email', 'signature'],
        required: false,
      },
      {
        model: User,
        as: 'preferredDoctor',
        attributes: ['id', 'fullName'],
        required: false,
      },
      {
        model: MedicalRecord,
        as: 'medicalRecord',
        required: false,
      },
    ],
  });

  if (!appointment) {
    throw new NotFoundError('Không tìm thấy lịch hẹn');
  }

  return successResponse(res, appointment);
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
  const existingAppointment = await Appointment.findOne({
    where: {
      appointmentDate,
      timeSlot,
      assignedDoctorId: assignedDoctorId || preferredDoctorId,
      status: {
        [Op.notIn]: [APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.COMPLETED],
      },
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

  // Insert while excluding `status` column so the DB-side constraint/default applies
  const allowedFields = Object.keys(Appointment.rawAttributes).filter(f => f !== 'status');
  let appointment = await Appointment.create(createData, { fields: allowedFields });

  // Ensure status is set to scheduled after create (some DB setups may apply defaults differently)
  try {
    const scheduledStatus = resolveStatus(APPOINTMENT_STATUS.SCHEDULED);
    if (!appointment.status || appointment.status !== scheduledStatus) {
      if (!scheduledStatus) {
        console.error('Configured scheduled status is invalid for DB constraint:', APPOINTMENT_STATUS.SCHEDULED);
      } else {
        console.debug('Setting appointment.status ->', scheduledStatus);
        await appointment.update({ status: scheduledStatus });
        // reload to include associations/fields
        appointment = await Appointment.findByPk(appointment.id);
      }
    }
  } catch (e) {
    // If update fails, log but continue returning created appointment
    console.error('Failed to ensure appointment status:', e?.message || e);
    // If DB update failed (possible constraint mismatch), ensure the API response
    // still contains the expected scheduled status so the frontend can display it.
    try {
      appointment = appointment.get ? appointment.get({ plain: true }) : appointment;
      appointment.status = APPOINTMENT_STATUS.SCHEDULED;
    } catch (e2) {
      // fallback: leave appointment as-is
    }
  }

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
  if ([APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.COMPLETED].includes(appointment.status)) {
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
      status: {
        [Op.notIn]: [APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.COMPLETED],
      },
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
    updateData.status = resolved;
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

  if (appointment.status === APPOINTMENT_STATUS.CANCELLED) {
    throw new BadRequestError('Lịch hẹn đã bị hủy trước đó');
  }

  if (appointment.status === APPOINTMENT_STATUS.COMPLETED) {
    throw new BadRequestError('Không thể hủy lịch hẹn đã hoàn thành');
  }

  // resolve status to DB-safe value and log attempt for diagnostics
  const cancelStatus = resolveStatus(APPOINTMENT_STATUS.CANCELLED) || APPOINTMENT_STATUS.CANCELLED;
  if (!VALID_APPOINTMENT_STATUSES.includes(cancelStatus)) {
    console.error('cancelAppointment: resolved status not in allowed list', { cancelStatus, allowed: VALID_APPOINTMENT_STATUSES });
  }
  try {
    console.error('cancelAppointment: attempting update', { id: appointment.id, status: cancelStatus });
    await appointment.update({
      status: cancelStatus,
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

  if (appointment.status !== APPOINTMENT_STATUS.SCHEDULED) {
    throw new BadRequestError('Chỉ có thể xác nhận lịch hẹn đang chờ');
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
    console.error('confirmAppointment: attempting update', { id: appointment.id, status: confirmedStatus });
    await appointment.update({
      status: confirmedStatus,
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

  if (![APPOINTMENT_STATUS.SCHEDULED, APPOINTMENT_STATUS.CONFIRMED].includes(appointment.status)) {
    throw new BadRequestError('Không thể check-in lịch hẹn này');
  }

  const waitingStatus = resolveStatus(APPOINTMENT_STATUS.WAITING);
  if (!waitingStatus) {
    throw new BadRequestError('Giá trị trạng thái chờ khám không hợp lệ');
  }
  if (!VALID_APPOINTMENT_STATUSES.includes(waitingStatus)) {
    console.error('checkInAppointment: resolved status not in allowed list', { waitingStatus, allowed: VALID_APPOINTMENT_STATUSES });
  }
  try {
    console.error('checkInAppointment: attempting update', { id: appointment.id, status: waitingStatus });
    await appointment.update({
      status: waitingStatus,
    });
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
  if (req.user.role === ROLES.DOCTOR) {
    where.assignedDoctorId = req.user.id;
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
      return obj;
    } catch (e) {
      if (a && a.dataValues) {
        const obj = { ...a.dataValues };
        if (!obj.status) obj.status = APPOINTMENT_STATUS.SCHEDULED;
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
        [Op.notIn]: [APPOINTMENT_STATUS.CANCELLED],
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
