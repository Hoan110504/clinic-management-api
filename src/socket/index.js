/**
 * Socket.IO Event Handlers
 * Manages real-time communication for appointments and notifications
 */
import logger from '../utils/logger.js';

const activeUsers = new Map(); // Map of userId -> socketId
const receptionistNamespace = '/receptionist';

export function setupSocketIO(io) {
  // Main namespace for general events
  io.on('connection', (socket) => {
    logger.info(`[Socket] User connected: ${socket.id}`);

    // User joins - track their socket connection
    socket.on('user:join', (data) => {
      const { userId, role } = data;
      activeUsers.set(userId, socket.id);
      socket.userId = userId;
      socket.userRole = role;

      logger.info(`[Socket] User ${userId} (role: ${role}) joined with socket ${socket.id}`);

      // Join room based on role for targeted broadcasts
      if (role === 4) { // RECEPTIONIST
        socket.join('receptionists');
        logger.info(`[Socket] Receptionist ${userId} joined 'receptionists' room`);
      } else if (role === 5) { // PATIENT
        socket.join(`patient:${userId}`);
        logger.info(`[Socket] Patient ${userId} joined patient-specific room`);
      }
    });

    // When appointment is created, notify receptionists
    socket.on('appointment:created', (data) => {
      const { appointment, createdBy } = data;
      logger.info(`[Socket] New appointment created: ${appointment.id} by user ${createdBy}`);

      // Broadcast to all receptionists
      io.to('receptionists').emit('appointment:new', {
        appointment,
        message: `Có lịch hẹn mới: ${appointment.patientName || 'Bệnh nhân'} - ${appointment.appointmentDate} ${appointment.timeSlot}`,
        timestamp: new Date().toISOString(),
      });

      // Also notify the patient who created it
      if (createdBy) {
        io.to(`patient:${createdBy}`).emit('appointment:confirmed', {
          appointment,
          message: 'Đã đặt lịch khám thành công',
          timestamp: new Date().toISOString(),
        });
      }
    });

    // When appointment is cancelled
    socket.on('appointment:cancelled', (data) => {
      const { appointmentId, reason } = data;
      logger.info(`[Socket] Appointment cancelled: ${appointmentId}, reason: ${reason}`);

      // Broadcast to receptionists
      io.to('receptionists').emit('appointment:status-changed', {
        appointmentId,
        status: 'Đã hủy',
        message: `Lịch hẹn ${appointmentId} đã bị hủy. Lý do: ${reason}`,
        timestamp: new Date().toISOString(),
      });
    });

    // When appointment is confirmed
    socket.on('appointment:confirmed', (data) => {
      const { appointmentId } = data;
      logger.info(`[Socket] Appointment confirmed: ${appointmentId}`);

      io.to('receptionists').emit('appointment:status-changed', {
        appointmentId,
        status: 'Đã xác nhận',
        message: `Lịch hẹn ${appointmentId} đã được xác nhận`,
        timestamp: new Date().toISOString(),
      });
    });

    // When patient checks in
    socket.on('appointment:checked-in', (data) => {
      const { appointmentId, patientName } = data;
      logger.info(`[Socket] Patient checked in: ${appointmentId}`);

      io.to('receptionists').emit('appointment:checked-in', {
        appointmentId,
        patientName,
        message: `Bệnh nhân ${patientName} đã check-in`,
        timestamp: new Date().toISOString(),
      });
    });

    // Disconnect handler
    socket.on('disconnect', () => {
      if (socket.userId) {
        activeUsers.delete(socket.userId);
        logger.info(`[Socket] User ${socket.userId} disconnected`);
      }
      logger.info(`[Socket] Socket ${socket.id} disconnected`);
    });

    // Error handler
    socket.on('error', (error) => {
      logger.error(`[Socket] Socket error: ${error}`);
    });
  });

  // Special namespace for receptionist-only operations
  io.of(receptionistNamespace).on('connection', (socket) => {
    logger.info(`[Socket Receptionist] Connected: ${socket.id}`);

    socket.on('receptionist:join', (data) => {
      const { userId } = data;
      socket.userId = userId;
      socket.join('active-receptionists');
      logger.info(`[Socket Receptionist] User ${userId} joined active receptionists`);
    });

    socket.on('disconnect', () => {
      logger.info(`[Socket Receptionist] ${socket.id} disconnected`);
    });
  });
}

export function emitAppointmentCreated(io, appointment, createdByUserId) {
  try {
    logger.info(`[Socket Emit] Broadcasting new appointment: ${appointment.id}`);
    io.to('receptionists').emit('appointment:new', {
      appointment,
      message: `Có lịch hẹn mới: ${appointment.patientName || 'Bệnh nhân'} - ${appointment.appointmentDate} ${appointment.timeSlot}`,
      timestamp: new Date().toISOString(),
    });

    // Notify patient
    if (createdByUserId) {
      io.to(`patient:${createdByUserId}`).emit('appointment:confirmed', {
        appointment,
        message: 'Đã đặt lịch khám thành công',
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error('[Socket Emit Error]', error);
  }
}

export function emitAppointmentStatusChanged(io, appointmentId, status, message) {
  try {
    io.to('receptionists').emit('appointment:status-changed', {
      appointmentId,
      status,
      message: message || `Lịch hẹn cập nhật: ${status}`,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[Socket Emit Error]', error);
  }
}

export { activeUsers };
