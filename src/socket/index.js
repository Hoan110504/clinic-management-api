import logger from '../utils/logger.js';
import { ROLES } from '../config/constants.js';
import { Notification } from '../models/index.js';

const activeUsers = new Map(); // Map of userId -> socketId

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

      // Join rooms based on role for targeted broadcasts
      if (Number(role) === ROLES.ADMIN) {
        socket.join('admins');
        logger.info(`[Socket] Admin ${userId} joined 'admins' room`);
      } else if (Number(role) === ROLES.DOCTOR) {
        socket.join('doctors');
        logger.info(`[Socket] Doctor ${userId} joined 'doctors' room`);
      } else if (Number(role) === ROLES.RECEPTIONIST) {
        socket.join('receptionists');
        logger.info(`[Socket] Receptionist ${userId} joined 'receptionists' room`);
      } else if (Number(role) === ROLES.PHARMACIST) {
        socket.join('pharmacists');
        logger.info(`[Socket] Pharmacist ${userId} joined 'pharmacists' room`);
      } else if (Number(role) === ROLES.PATIENT) {
        socket.join(`patient:${userId}`);
        logger.info(`[Socket] Patient ${userId} joined patient-specific room`);
      }
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
}

/**
 * Helper to save and emit notification
 */
async function createAndEmitNotification(io, { targetRoles = [], userId = null, title, content, type, relatedId }) {
  try {
    let savedNotification = null;

    // Save to database for each target role or specific user
    if (targetRoles.length > 0) {
      for (const roleId of targetRoles) {
        savedNotification = await Notification.create({
          role: String(roleId),
          title,
          content,
          type,
          relatedId: String(relatedId),
          isRead: false
        });
      }
    } else if (userId) {
      savedNotification = await Notification.create({
        userId,
        title,
        content,
        type,
        relatedId: String(relatedId),
        isRead: false
      });
    }

    if (!savedNotification) return;

    // Use the saved object for socket data (ensures id and createdAt are present)
    const socketData = savedNotification.get ? savedNotification.get({ plain: true }) : savedNotification;

    // Emit to rooms
    let emitter = io;
    if (targetRoles.includes(ROLES.ADMIN)) emitter = emitter.to('admins');
    if (targetRoles.includes(ROLES.RECEPTIONIST)) emitter = emitter.to('receptionists');
    if (targetRoles.includes(ROLES.DOCTOR)) emitter = emitter.to('doctors');
    if (targetRoles.includes(ROLES.PHARMACIST)) emitter = emitter.to('pharmacists');
    
    if (userId) {
      emitter = emitter.to(`patient:${userId}`);
    }

    // Final check to avoid broadcasting to everyone if no target was set
    if (targetRoles.length > 0 || userId) {
      emitter.emit('notification:new', socketData);
      logger.info(`[Socket] Notification emitted: ${type} to ${targetRoles.length > 0 ? 'roles ' + targetRoles.join(',') : 'user ' + userId}`);
    }
    
  } catch (error) {
    logger.error('[Socket] createAndEmitNotification error:', error);
  }
}

/**
 * Requirement: Patient Book Appointment
 * Broadcast to: Receptionists and Admins
 */
export async function emitAppointmentCreated(io, appointment) {
  try {
    const title = 'Lịch hẹn mới';
    const content = `Bệnh nhân ${appointment.patientName} vừa đặt một lịch hẹn mới.`;
    
    await createAndEmitNotification(io, {
      targetRoles: [ROLES.RECEPTIONIST, ROLES.ADMIN],
      title,
      content,
      type: 'APPOINTMENT_NEW',
      relatedId: appointment.id
    });

    // Still emit specific event for legacy/other listeners
    const data = {
      appointmentId: appointment.id,
      appointmentCode: appointment.appointmentId || appointment.AppointmentID,
      patientName: appointment.patientName,
      message: content,
      appointment,
      timestamp: new Date().toISOString(),
      type: 'APPOINTMENT_NEW',
    };
    io.to('receptionists').to('admins').emit('appointment:new', data);
    logger.info(`[Socket Emit] Appointment created: ${appointment.id}`);
  } catch (error) {
    logger.error('[Socket Emit Error] emitAppointmentCreated:', error);
  }
}

/**
 * Requirement: Patient/Staff Cancel Appointment
 * Broadcast to: Receptionists, Admins, and Doctors
 */
export async function emitAppointmentCancelled(io, appointment) {
  try {
    const title = 'Lịch hẹn bị hủy';
    const content = `Lịch hẹn của bệnh nhân ${appointment.patientName} đã bị hủy.`;

    await createAndEmitNotification(io, {
      targetRoles: [ROLES.RECEPTIONIST, ROLES.ADMIN, ROLES.DOCTOR],
      title,
      content,
      type: 'APPOINTMENT_CANCELLED',
      relatedId: appointment.id
    });

    const data = {
      appointmentId: appointment.id,
      appointmentCode: appointment.appointmentId || appointment.AppointmentID,
      patientName: appointment.patientName,
      message: content,
      appointment,
      timestamp: new Date().toISOString(),
      type: 'APPOINTMENT_CANCELLED',
    };
    io.to('receptionists').to('admins').to('doctors').emit('appointment:cancelled', data);
    logger.info(`[Socket Emit] Appointment cancelled: ${appointment.id}`);
  } catch (error) {
    logger.error('[Socket Emit Error] emitAppointmentCancelled:', error);
  }
}

/**
 * Custom: Appointment Confirmed
 * Broadcast to: Patient and Staff
 */
export async function emitAppointmentConfirmed(io, appointment) {
  try {
    const title = 'Lịch hẹn đã xác nhận';
    const content = `Lịch hẹn ngày ${appointment.appointmentDate} đã được xác nhận.`;

    // Notify Patient (if userId is available)
    // We might need to look up the userId for this patientId
    // For now, if appointment has userId (some schemas do)
    if (appointment.userId) {
       await createAndEmitNotification(io, {
        userId: appointment.userId,
        title,
        content,
        type: 'APPOINTMENT_CONFIRMED',
        relatedId: appointment.id
      });
    }

    const data = {
      appointmentId: appointment.id,
      message: content,
      appointment,
      timestamp: new Date().toISOString(),
      type: 'APPOINTMENT_CONFIRMED',
    };
    
    io.to('receptionists').to('admins').emit('appointment:status-changed', data);
    logger.info(`[Socket Emit] Appointment confirmed: ${appointment.id}`);
  } catch (error) {
    logger.error('[Socket Emit Error] emitAppointmentConfirmed:', error);
  }
}

/**
 * Requirement: Receptionist Confirm Arrived
 * Broadcast to: Doctors
 */
export async function emitPatientArrived(io, appointment) {
  try {
    const title = 'Bệnh nhân đã tới';
    const content = `Bệnh nhân ${appointment.patientName} đã có mặt tại phòng khám.`;

    await createAndEmitNotification(io, {
      targetRoles: [ROLES.DOCTOR],
      title,
      content,
      type: 'PATIENT_ARRIVED',
      relatedId: appointment.id
    });

    const data = {
      appointmentId: appointment.id,
      appointmentCode: appointment.appointmentId || appointment.AppointmentID,
      patientName: appointment.patientName,
      message: content,
      appointment,
      timestamp: new Date().toISOString(),
      type: 'PATIENT_ARRIVED',
    };
    io.to('doctors').emit('patient:arrived', data);
    logger.info(`[Socket Emit] Patient arrived: ${appointment.id}`);
  } catch (error) {
    logger.error('[Socket Emit Error] emitPatientArrived:', error);
  }
}

/**
 * Requirement: Doctor Confirm Prescription
 * Broadcast to: Pharmacists
 */
export async function emitPrescriptionCreated(io, prescription) {
  try {
    const title = 'Có đơn thuốc mới';
    const content = `Đơn thuốc mới cho bệnh nhân ${prescription.patientName || 'n/a'}.`;

    await createAndEmitNotification(io, {
      targetRoles: [ROLES.PHARMACIST],
      title,
      content,
      type: 'PRESCRIPTION_NEW',
      relatedId: prescription.id || prescription.prescriptionId
    });

    const data = {
      prescriptionId: prescription.id || prescription.prescriptionId,
      message: content,
      prescription,
      timestamp: new Date().toISOString(),
      type: 'PRESCRIPTION_NEW',
    };
    io.to('pharmacists').emit('prescription:new', data);
    logger.info(`[Socket Emit] Prescription created: ${data.prescriptionId}`);
  } catch (error) {
    logger.error('[Socket Emit Error] emitPrescriptionCreated:', error);
  }
}

/**
 * Requirement: Pharmacist Confirm Dispense
 * Broadcast to: Doctors
 */
export async function emitPrescriptionDispensed(io, prescription) {
  try {
    const title = 'Đơn thuốc đã phát';
    const content = `Đơn thuốc #${prescription.id || prescription.prescriptionId} đã được phát cho bệnh nhân.`;

    await createAndEmitNotification(io, {
      targetRoles: [ROLES.DOCTOR],
      title,
      content,
      type: 'PRESCRIPTION_DISPENSED',
      relatedId: prescription.id || prescription.prescriptionId
    });

    const data = {
      prescriptionId: prescription.id || prescription.prescriptionId,
      message: content,
      prescription,
      timestamp: new Date().toISOString(),
      type: 'PRESCRIPTION_DISPENSED',
    };
    io.to('doctors').emit('prescription:dispensed', data);
    logger.info(`[Socket Emit] Prescription dispensed: ${data.prescriptionId}`);
  } catch (error) {
    logger.error('[Socket Emit Error] emitPrescriptionDispensed:', error);
  }
}

export { activeUsers };

