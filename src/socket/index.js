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
      
      // Convert userId to number for consistency
      const userIdNum = Number(userId);
      
      activeUsers.set(userIdNum, socket.id);
      socket.userId = userIdNum;
      socket.userRole = role;

      logger.info(`[Socket] User ${userIdNum} (role: ${role}) joined with socket ${socket.id}`);
      logger.info(`[Socket] activeUsers Map: ${JSON.stringify(Array.from(activeUsers.entries()))}`);

      // Join rooms based on role for targeted broadcasts
      if (Number(role) === ROLES.ADMIN) {
        socket.join('admins');
        logger.info(`[Socket] Admin ${userIdNum} joined 'admins' room`);
      } else if (Number(role) === ROLES.DOCTOR) {
        socket.join('doctors');
        // Also join user-specific room for targeted notifications
        socket.join(`doctor:${userIdNum}`);
        logger.info(`[Socket] Doctor ${userIdNum} joined 'doctors' room and 'doctor:${userIdNum}' room`);
      } else if (Number(role) === ROLES.RECEPTIONIST) {
        socket.join('receptionists');
        logger.info(`[Socket] Receptionist ${userIdNum} joined 'receptionists' room`);
      } else if (Number(role) === ROLES.PHARMACIST) {
        socket.join('pharmacists');
        logger.info(`[Socket] Pharmacist ${userIdNum} joined 'pharmacists' room`);
      } else if (Number(role) === ROLES.PATIENT) {
        socket.join(`patient:${userIdNum}`);
        logger.info(`[Socket] Patient ${userIdNum} joined patient-specific room`);
      }
    });

    // Disconnect handler
    socket.on('disconnect', () => {
      if (socket.userId) {
        activeUsers.delete(socket.userId);
        logger.info(`[Socket] User ${socket.userId} disconnected`);
        logger.info(`[Socket] activeUsers Map after disconnect: ${JSON.stringify(Array.from(activeUsers.entries()))}`);
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
      // Send to user-specific room (works for patients and specific doctors)
      const userSocketId = activeUsers.get(userId);
      if (userSocketId) {
        io.to(userSocketId).emit('notification:new', socketData);
        logger.info(`[Socket] Notification sent to user ${userId} via socket ${userSocketId}`);
      } else {
        // User not connected, but notification is saved in DB
        logger.info(`[Socket] User ${userId} not connected, notification saved to DB only`);
      }
    }

    // Final check to avoid broadcasting to everyone if no target was set
    if (targetRoles.length > 0) {
      emitter.emit('notification:new', socketData);
      logger.info(`[Socket] Notification emitted: ${type} to roles ${targetRoles.join(',')}`);
    }
    
  } catch (error) {
    logger.error('[Socket] createAndEmitNotification error:', error);
  }
}

/**
 * Requirement: Patient Book Appointment
 * Broadcast to: Receptionists, Admins, and Assigned Doctor (by UserID)
 * @param {Object} io - Socket.IO instance
 * @param {Object} appointment - Appointment object
 * @param {Number} creatorRole - Role of the user who created the appointment
 */
export async function emitAppointmentCreated(io, appointment, creatorRole = null) {
  try {
    const title = 'Lịch hẹn mới';
    const content = `Bệnh nhân ${appointment.patientName} vừa đặt một lịch hẹn mới.`;
    
    // Determine if toast should be shown based on source
    // Online (Patient) = show toast for everyone
    // Offline (Staff) = show toast only for Doctor, not for Receptionist/Admin
    const isOnline = appointment.source === 'Online';
    
    logger.info(`[Socket Emit] emitAppointmentCreated called for appointment ${appointment.id}`);
    logger.info(`[Socket Emit] source: ${appointment.source}, isOnline: ${isOnline}`);
    logger.info(`[Socket Emit] assignedDoctorId: ${appointment.assignedDoctorId}, preferredDoctorId: ${appointment.preferredDoctorId}`);
    
    // Notify receptionists and admins
    await createAndEmitNotification(io, {
      targetRoles: [ROLES.RECEPTIONIST, ROLES.ADMIN],
      title,
      content,
      type: 'APPOINTMENT_NEW',
      relatedId: appointment.id
    });

    // Notify the assigned doctor specifically by UserID
    const doctorIdRaw = appointment.assignedDoctorId || appointment.preferredDoctorId;
    const doctorId = doctorIdRaw ? Number(doctorIdRaw) : null;
    
    logger.info(`[Socket Emit] Resolved doctorId: ${doctorId} (type: ${typeof doctorId})`);
    
    if (doctorId) {
      logger.info(`[Socket Emit] Attempting to notify doctor ${doctorId}`);
      logger.info(`[Socket Emit] Active users Map: ${JSON.stringify(Array.from(activeUsers.entries()))}`);
      
      await createAndEmitNotification(io, {
        userId: doctorId,
        title,
        content: `Bạn có lịch hẹn mới với bệnh nhân ${appointment.patientName}.`,
        type: 'APPOINTMENT_NEW',
        relatedId: appointment.id
      });
      
      // Emit to specific doctor
      const doctorSocketId = activeUsers.get(doctorId);
      logger.info(`[Socket Emit] Doctor ${doctorId} socketId from Map: ${doctorSocketId}`);
      
      if (doctorSocketId) {
        const data = {
          appointmentId: appointment.id,
          appointmentCode: appointment.appointmentId || appointment.AppointmentID,
          patientName: appointment.patientName,
          message: content,
          appointment,
          timestamp: new Date().toISOString(),
          type: 'APPOINTMENT_NEW',
          showToastForDoctor: true, // Doctor always gets toast
          showToastForStaff: isOnline, // Staff only gets toast if patient created
          source: appointment.source,
        };
        io.to(doctorSocketId).emit('appointment:new', data);
        logger.info(`[Socket Emit] ✅ Appointment created notification sent to doctor ${doctorId} (showToast: true)`);
      } else {
        logger.warn(`[Socket Emit] ⚠️ Doctor ${doctorId} is not connected (no socket found in activeUsers Map)`);
        logger.warn(`[Socket Emit] ⚠️ Available keys in activeUsers: ${JSON.stringify(Array.from(activeUsers.keys()))}`);
      }
    } else {
      logger.warn(`[Socket Emit] ⚠️ No assigned doctor for appointment ${appointment.id}`);
    }

    // Emit to receptionists and admins
    const data = {
      appointmentId: appointment.id,
      appointmentCode: appointment.appointmentId || appointment.AppointmentID,
      patientName: appointment.patientName,
      message: content,
      appointment,
      timestamp: new Date().toISOString(),
      type: 'APPOINTMENT_NEW',
      showToastForDoctor: true, // Doctor always gets toast
      showToastForStaff: isOnline, // Staff only gets toast if patient created
      source: appointment.source,
    };
    io.to('receptionists').to('admins').emit('appointment:new', data);
    
    logger.info(`[Socket Emit] Appointment created: ${appointment.id} (source: ${appointment.source}, showToastForStaff: ${isOnline})`);
  } catch (error) {
    logger.error('[Socket Emit Error] emitAppointmentCreated:', error);
  }
}

/**
 * Requirement: Patient/Staff Cancel Appointment
 * Broadcast to: Receptionists, Admins, and Doctors
 * @param {Object} io - Socket.IO instance
 * @param {Object} appointment - Appointment object
 * @param {Number} cancelledByRole - Role of the user who cancelled the appointment
 */
export async function emitAppointmentCancelled(io, appointment, cancelledByRole = null) {
  try {
    const title = 'Lịch hẹn bị hủy';
    const content = `Lịch hẹn của bệnh nhân ${appointment.patientName} đã bị hủy.`;

    // Determine if toast should be shown based on who cancelled
    // Patient cancelled = show toast for everyone
    // Staff cancelled = show toast only for Doctor, not for Receptionist/Admin
    const cancelledByPatient = cancelledByRole === ROLES.PATIENT;
    
    logger.info(`[Socket Emit] emitAppointmentCancelled called for appointment ${appointment.id}`);
    logger.info(`[Socket Emit] cancelledByRole: ${cancelledByRole}, cancelledByPatient: ${cancelledByPatient}`);

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
      showToastForDoctor: true, // Doctor always gets toast
      showToastForStaff: cancelledByPatient, // Staff only gets toast if patient cancelled
      cancelledByRole,
    };
    io.to('receptionists').to('admins').to('doctors').emit('appointment:cancelled', data);
    logger.info(`[Socket Emit] Appointment cancelled: ${appointment.id} (cancelledByRole: ${cancelledByRole}, showToastForStaff: ${cancelledByPatient})`);
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
 * Broadcast to: Assigned Doctor (by UserID)
 */
export async function emitPatientArrived(io, appointment) {
  try {
    const title = 'Bệnh nhân đã tới';
    const content = `Bệnh nhân ${appointment.patientName} đã có mặt tại phòng khám.`;

    logger.info(`[Socket Emit] emitPatientArrived called for appointment ${appointment.id}`);
    logger.info(`[Socket Emit] assignedDoctorId: ${appointment.assignedDoctorId}, preferredDoctorId: ${appointment.preferredDoctorId}`);

    // Notify the assigned doctor specifically by UserID
    const doctorIdRaw = appointment.assignedDoctorId || appointment.preferredDoctorId;
    const doctorId = doctorIdRaw ? Number(doctorIdRaw) : null;
    
    logger.info(`[Socket Emit] Resolved doctorId: ${doctorId} (type: ${typeof doctorId})`);
    
    if (doctorId) {
      logger.info(`[Socket Emit] Attempting to notify doctor ${doctorId}`);
      logger.info(`[Socket Emit] Active users Map: ${JSON.stringify(Array.from(activeUsers.entries()))}`);
      
      await createAndEmitNotification(io, {
        userId: doctorId,
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
      
      // Emit to specific doctor's socket
      const doctorSocketId = activeUsers.get(doctorId);
      logger.info(`[Socket Emit] Doctor ${doctorId} socketId from Map: ${doctorSocketId}`);
      
      if (doctorSocketId) {
        io.to(doctorSocketId).emit('patient:arrived', data);
        logger.info(`[Socket Emit] ✅ Patient arrived notification sent to doctor ${doctorId} via socket ${doctorSocketId}`);
      } else {
        logger.warn(`[Socket Emit] ⚠️ Doctor ${doctorId} is not connected (no socket found in activeUsers Map)`);
        logger.warn(`[Socket Emit] ⚠️ Available keys in activeUsers: ${JSON.stringify(Array.from(activeUsers.keys()))}`);
      }
    } else {
      logger.warn(`[Socket Emit] ⚠️ No assigned doctor for appointment ${appointment.id}`);
    }
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

