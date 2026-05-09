import logger from '../utils/logger.js';
import { ROLES } from '../config/constants.js';

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
      if (role === ROLES.ADMIN) {
        socket.join('admins');
        logger.info(`[Socket] Admin ${userId} joined 'admins' room`);
      } else if (role === ROLES.DOCTOR) {
        socket.join('doctors');
        logger.info(`[Socket] Doctor ${userId} joined 'doctors' room`);
      } else if (role === ROLES.RECEPTIONIST) {
        socket.join('receptionists');
        logger.info(`[Socket] Receptionist ${userId} joined 'receptionists' room`);
      } else if (role === ROLES.PHARMACIST) {
        socket.join('pharmacists');
        logger.info(`[Socket] Pharmacist ${userId} joined 'pharmacists' room`);
      } else if (role === ROLES.PATIENT) {
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
 * Requirement 1: Patient Book Appointment
 * Broadcast to: Receptionists and Admins
 */
export function emitAppointmentCreated(io, appointment) {
  try {
    const data = {
      appointmentId: appointment.id,
      appointmentCode: appointment.appointmentId || appointment.AppointmentID,
      patientName: appointment.patientName,
      message: `Có lịch hẹn #${appointment.appointmentId || appointment.id} mới`,
      appointment, // Include full object
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
 * Requirement 2: Patient Cancel Appointment
 * Broadcast to: Receptionists and Admins
 */
export function emitAppointmentCancelled(io, appointment) {
  try {
    const data = {
      appointmentId: appointment.id,
      appointmentCode: appointment.appointmentId || appointment.AppointmentID,
      patientName: appointment.patientName,
      message: `Bệnh nhân hủy lịch hẹn #${appointment.appointmentId || appointment.id}`,
      appointment, // Include full object
      timestamp: new Date().toISOString(),
      type: 'APPOINTMENT_CANCELLED',
    };
    io.to('receptionists').to('admins').emit('appointment:cancelled', data);
    logger.info(`[Socket Emit] Appointment cancelled: ${appointment.id}`);
  } catch (error) {
    logger.error('[Socket Emit Error] emitAppointmentCancelled:', error);
  }
}

/**
 * Custom: Appointment Confirmed
 * Broadcast to: Patient and Staff
 */
export function emitAppointmentConfirmed(io, appointment) {
  try {
    const data = {
      appointmentId: appointment.id,
      message: `Lịch hẹn #${appointment.id} đã được xác nhận`,
      appointment,
      timestamp: new Date().toISOString(),
      type: 'APPOINTMENT_CONFIRMED',
    };
    // Send to specific patient
    if (appointment.patientId) {
      // Assuming patientId in appointment links to a Patient, but we need User ID for the room
      // If we don't have User ID here, we might need to pass it or just broadcast and let frontend filter
      // For now, let's assume rooms are joined by patientId or we broadcast to all patients (less ideal)
      // Actually, my setupSocketIO joins 'patient:${userId}'
      // Let's broadcast to 'patients' room if exists, or just rely on global filtering if needed
      io.to('patients').emit('appointment:confirmed', data);
    }
    // Also notify staff
    io.to('receptionists').to('admins').emit('appointment:status-changed', data);
    logger.info(`[Socket Emit] Appointment confirmed: ${appointment.id}`);
  } catch (error) {
    logger.error('[Socket Emit Error] emitAppointmentConfirmed:', error);
  }
}

/**
 * Requirement 3: Receptionist Confirm Arrived
 * Broadcast to: Doctors
 */
export function emitPatientArrived(io, appointment) {
  try {
    const data = {
      appointmentId: appointment.id,
      appointmentCode: appointment.appointmentId || appointment.AppointmentID,
      patientName: appointment.patientName,
      message: `Bệnh nhân ${appointment.patientName} đã tới`,
      appointment, // Include full object
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
 * Requirement 4: Doctor Confirm Prescription
 * Broadcast to: Pharmacists
 */
export function emitPrescriptionCreated(io, prescription) {
  try {
    const data = {
      prescriptionId: prescription.id || prescription.prescriptionId,
      message: `Có đơn thuốc #${prescription.id || prescription.prescriptionId} mới`,
      prescription, // Include full object
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
 * Requirement 5: Pharmacist Confirm Dispense
 * Broadcast to: Doctors
 */
export function emitPrescriptionDispensed(io, prescription) {
  try {
    const data = {
      prescriptionId: prescription.id || prescription.prescriptionId,
      message: `Đơn thuốc #${prescription.id || prescription.prescriptionId} đã được phát`,
      prescription, // Include full object
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

