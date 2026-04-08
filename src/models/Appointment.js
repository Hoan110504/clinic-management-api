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
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
        field: 'Id',
      },
      source: {
        type: DataTypes.STRING(255),
        allowNull: true,
        defaultValue: APPOINTMENT_SOURCE.OFFLINE,
        validate: {
          isIn: {
            args: [Object.values(APPOINTMENT_SOURCE)],
            msg: 'Nguồn lịch hẹn không hợp lệ'
          }
        }
      },
      // Patient info (can be existing or new patient)
      patientId: {
        type: DataTypes.BIGINT,
        allowNull: false,
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
        type: DataTypes.STRING(10),
        allowNull: true,
        field: 'patient_gender',
        validate: {
          isIn: {
            args: [Object.values(GENDER)],
            msg: 'Giới tính không hợp lệ'
          }
        }
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
        type: DataTypes.CHAR(36),
        allowNull: true,
        field: 'preferred_doctor_id',
      },
      preferredDoctorName: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'preferred_doctor_name',
      },
      assignedDoctorId: {
        type: DataTypes.CHAR(36),
        allowNull: true,
        field: 'assigned_doctor_id',
      },
      assignedDoctorName: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'assigned_doctor_name',
      },
      // Status and notes
      status: {
        // Persist numeric codes in DB: 1=Đã đặt lịch, 2=Chờ khám, 3=Hoàn thành, 4=Đã hủy
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        field: 'Status',
        validate: {
          isIn: {
            args: [[1, 2, 3, 4]],
            msg: 'Trạng thái lịch hẹn không hợp lệ'
          }
        }
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
      cancelledReason: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'cancelled_reason',
      },
      cancelledBy: {
        type: DataTypes.CHAR(36),
        allowNull: true,
        field: 'cancelled_by',
      },
      rescheduledFrom: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'rescheduled_from',
      },
      rescheduledAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'rescheduled_at',
      },
    },
    {
      tableName: 'Appointments',
      timestamps: true,
      paranoid: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
      indexes: [
        { fields: ['patient_id'] },
        { fields: ['appointment_date'] },
        { fields: ['assigned_doctor_id'] },
        { fields: ['Status'] },
        { fields: ['appointment_date', 'time_slot'] },
      ]
    }
  );
  // Associations
  Appointment.associate = (models) => {
    Appointment.belongsTo(models.Patient, { foreignKey: 'patientId', as: 'patient' });

    // Link doctors and user references so controllers can include User as 'doctor' etc.
    if (models && models.User) {
      Appointment.belongsTo(models.User, { foreignKey: 'assignedDoctorId', as: 'assignedDoctor' });
      Appointment.belongsTo(models.User, { foreignKey: 'preferredDoctorId', as: 'preferredDoctor' });
      Appointment.belongsTo(models.User, { foreignKey: 'cancelledBy', as: 'cancelledByUser' });
    }
  };

  return Appointment;
};
