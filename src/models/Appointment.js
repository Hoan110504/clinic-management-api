/**
 * Appointment Model
 * Handles patient appointments scheduling
 */
import { DataTypes } from 'sequelize';
import {
  APPOINTMENT_STATUS,
  APPOINTMENT_SOURCE,
  GENDER,
} from '../config/constants.js';

export default (sequelize) => {
  const Appointment = sequelize.define(
    'Appointment',
    {
      id: {
        type: DataTypes.STRING(20),
        primaryKey: true,
        allowNull: false,
      },
      source: {
        type: DataTypes.ENUM(...Object.values(APPOINTMENT_SOURCE)),
        allowNull: false,
        defaultValue: APPOINTMENT_SOURCE.OFFLINE,
      },
      // Patient info (can be existing or new patient)
      patientId: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'patient_id',
        references: {
          model: 'patients',
          key: 'id',
        },
      },
      patientName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'patient_name',
      },
      patientGender: {
        type: DataTypes.ENUM(...Object.values(GENDER)),
        allowNull: true,
        field: 'patient_gender',
      },
      patientBirthDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'patient_birth_date',
      },
      patientPhone: {
        type: DataTypes.STRING(15),
        allowNull: false,
        field: 'patient_phone',
      },
      patientEmail: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'patient_email',
      },
      // Appointment details
      appointmentDate: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        field: 'appointment_date',
      },
      timeSlot: {
        type: DataTypes.STRING(20),
        allowNull: false,
        field: 'time_slot',
      },
      estimatedDuration: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 30,
        field: 'estimated_duration',
      },
      examType: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'exam_type',
      },
      symptoms: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      // Doctor assignment
      preferredDoctorId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'preferred_doctor_id',
        references: {
          model: 'users',
          key: 'id',
        },
      },
      preferredDoctorName: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'preferred_doctor_name',
      },
      assignedDoctorId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'assigned_doctor_id',
        references: {
          model: 'users',
          key: 'id',
        },
      },
      assignedDoctorName: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'assigned_doctor_name',
      },
      // Status and notes
      status: {
        type: DataTypes.ENUM(...Object.values(APPOINTMENT_STATUS)),
        allowNull: false,
        defaultValue: APPOINTMENT_STATUS.SCHEDULED,
      },
      confirmedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'confirmed_at',
      },
      patientNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'patient_notes',
      },
      internalNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'internal_notes',
      },
      cancelledAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'cancelled_at',
      },
      cancelReason: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'cancel_reason',
      },
    },
    {
      tableName: 'appointments',
      timestamps: true,
      paranoid: true,
      indexes: [
        { fields: ['patient_id'] },
        { fields: ['appointment_date'] },
        { fields: ['assigned_doctor_id'] },
        { fields: ['status'] },
        { fields: ['appointment_date', 'time_slot'] },
      ],
      hooks: {
        beforeCreate: async (appointment) => {
          if (!appointment.id) {
            const Appointment = sequelize.models.Appointment;
            const lastAppointment = await Appointment.findOne({
              order: [['createdAt', 'DESC']],
              paranoid: false,
            });
            let nextNum = 1;
            if (lastAppointment && lastAppointment.id) {
              const match = lastAppointment.id.match(/APT(\d+)/);
              if (match) {
                nextNum = parseInt(match[1], 10) + 1;
              }
            }
            appointment.id = `APT${String(nextNum).padStart(3, '0')}`;
          }
        },
      },
    }
  );

  return Appointment;
};
