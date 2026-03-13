/**
 * Medical Record Model
 * Handles patient examination records
 */
import { DataTypes } from 'sequelize';
import { MEDICAL_RECORD_STATUS, GENDER } from '../config/constants.js';

export default (sequelize) => {
  const MedicalRecord = sequelize.define(
    'MedicalRecord',
    {
      id: {
        type: DataTypes.STRING(20),
        primaryKey: true,
        allowNull: false,
      },
      patientId: {
        type: DataTypes.STRING(20),
        allowNull: false,
        field: 'patient_id',
        references: {
          model: 'patients',
          key: 'id',
        },
      },
      appointmentId: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'appointment_id',
        references: {
          model: 'appointments',
          key: 'id',
        },
      },
      // Patient info snapshot
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
        allowNull: true,
        field: 'patient_phone',
      },
      patientAddress: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'patient_address',
      },
      // Examination details
      examType: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'exam_type',
      },
      receptionTime: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'reception_time',
      },
      purpose: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      // Doctor assignment
      doctorId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'doctor_id',
        references: {
          model: 'users',
          key: 'id',
        },
      },
      doctorName: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'doctor_name',
      },
      // Vital signs - stored as JSON
      initialVitalSigns: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'initial_vital_signs',
        get() {
          const rawValue = this.getDataValue('initialVitalSigns');
          return rawValue ? JSON.parse(rawValue) : null;
        },
        set(value) {
          this.setDataValue('initialVitalSigns', value ? JSON.stringify(value) : null);
        },
      },
      vitalSigns: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'vital_signs',
        get() {
          const rawValue = this.getDataValue('vitalSigns');
          return rawValue ? JSON.parse(rawValue) : null;
        },
        set(value) {
          this.setDataValue('vitalSigns', value ? JSON.stringify(value) : null);
        },
      },
      // Medical details
      symptoms: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      symptomDuration: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'symptom_duration',
      },
      symptomSeverity: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'symptom_severity',
        defaultValue: 'medium',
      },
      diagnosis: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      treatment: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      // Follow-up
      nextAppointment: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'next_appointment',
      },
      // Status
      status: {
        type: DataTypes.ENUM(...Object.values(MEDICAL_RECORD_STATUS)),
        allowNull: false,
        defaultValue: MEDICAL_RECORD_STATUS.WAITING,
      },
      startedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'started_at',
      },
      completedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'completed_at',
      },
    },
    {
      tableName: 'HoSoKham',
      timestamps: true,
      paranoid: true,
      indexes: [
        { fields: ['patient_id'] },
        { fields: ['doctor_id'] },
        { fields: ['status'] },
        { fields: ['created_at'] },
      ],
      hooks: {
        beforeValidate: async (record) => {
          if (!record.id) {
            try {
              // Use timestamp-based ID to avoid querying database in hook
              // Format: PK + timestamp (last 9 digits) for uniqueness
              const timestamp = Date.now().toString();
              const unique = timestamp.slice(-9);
              record.id = `PK${unique}`;
              console.log('MedicalRecord beforeValidate: generated id', record.id);
            } catch (err) {
              console.error('MedicalRecord beforeValidate: error generating id', {
                error: err.message,
                name: err.name,
                stack: err.stack,
              });
              // Final fallback
              record.id = `PK${Math.random().toString(36).substring(2, 11)}`;
              console.log('MedicalRecord beforeValidate: using fallback id', record.id);
            }
          }
        },
      },
    }
  );

  // Associations
  MedicalRecord.associate = (models) => {
    MedicalRecord.belongsTo(models.Patient, { foreignKey: 'patientId', as: 'patient' });
    MedicalRecord.belongsTo(models.User, { foreignKey: 'doctorId', as: 'doctor' });
    // Legacy association: HoSoKham -> ChiSoSinhTon (vital signs history)
    if (models.ChiSoSinhTon) {
      MedicalRecord.hasMany(models.ChiSoSinhTon, { foreignKey: 'MaHoSoKham', as: 'ChiSoSinhTon' });
    }
    MedicalRecord.hasMany(models.LabTest, { foreignKey: 'medicalRecordId', as: 'labTests' });
    MedicalRecord.hasMany(models.Prescription, { foreignKey: 'medicalRecordId', as: 'prescriptions' });
    MedicalRecord.hasMany(models.ServiceOrder, { foreignKey: 'medicalRecordId', as: 'serviceOrders' });
  };

  return MedicalRecord;
};
