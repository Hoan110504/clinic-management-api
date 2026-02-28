/**
 * Appointment Controller
 * Handles appointment management operations
 */
const { Op } = require('sequelize');
const { Appointment, Patient, User, MedicalRecord } = require('../models');
const { asyncHandler, parsePagination, parseSort } = require('../utils/helpers');
const {
  successResponse,
  createdResponse,
  paginatedResponse,
  noContentResponse,
} = require('../utils/response');
const { NotFoundError, BadRequestError, ConflictError } = require('../utils/errors');
const { APPOINTMENT_STATUS, ROLES } = require('../config/constants');

/**
 * Get all appointments (with pagination and filters)
 * GET /api/appointments
 */
const getAllAppointments = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { status, date, doctorId, patientId, source, search, fromDate, toDate, sort } = req.query;

  // Build where clause
  const where = {};

  if (status) {
    where.status = status;
  }

  if (date) {
    where.appointmentDate = date;
  }

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

  return paginatedResponse(res, {
    data: rows,
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
 * Create new appointment
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

  // Check for conflicting appointments
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

  // Get doctor info if not provided
  let doctorName = assignedDoctorName;
  if (assignedDoctorId && !doctorName) {
    const doctor = await User.findByPk(assignedDoctorId);
    if (doctor) {
      doctorName = doctor.fullName;
    }
  }

  const appointment = await Appointment.create({
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
    status: APPOINTMENT_STATUS.SCHEDULED,
  });

  return createdResponse(res, appointment, 'Tạo lịch hẹn thành công');
});

/**
 * Update appointment
 * PUT /api/appointments/:id
 */
const updateAppointment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const appointment = await Appointment.findByPk(id);
  if (!appointment) {
    throw new NotFoundError('Không tìm thấy lịch hẹn');
  }

  // Check if trying to update cancelled/completed appointment
  if ([APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.COMPLETED].includes(appointment.status)) {
    throw new BadRequestError('Không thể cập nhật lịch hẹn đã hủy hoặc hoàn thành');
  }

  // Check for conflicting appointments if changing date/time/doctor
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

  // Update doctor name if doctor ID changed
  if (updateData.assignedDoctorId && !updateData.assignedDoctorName) {
    const doctor = await User.findByPk(updateData.assignedDoctorId);
    if (doctor) {
      updateData.assignedDoctorName = doctor.fullName;
    }
  }

  await appointment.update(updateData);

  return successResponse(res, appointment, 'Cập nhật lịch hẹn thành công');
});

/**
 * Cancel appointment
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

  await appointment.update({
    status: APPOINTMENT_STATUS.CANCELLED,
    cancelledAt: new Date(),
    cancelReason: reason,
  });

  return successResponse(res, appointment, 'Hủy lịch hẹn thành công');
});

/**
 * Confirm appointment
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

  await appointment.update({
    status: APPOINTMENT_STATUS.CONFIRMED,
    confirmedAt: new Date(),
  });

  return successResponse(res, appointment, 'Xác nhận lịch hẹn thành công');
});

/**
 * Check-in appointment (set to waiting)
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

  await appointment.update({
    status: APPOINTMENT_STATUS.WAITING,
  });

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

  return successResponse(res, appointments);
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

  const { TIME_SLOTS } = require('../config/constants');

  // Get booked slots
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

module.exports = {
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
