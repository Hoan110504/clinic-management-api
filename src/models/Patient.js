/**
 * Patient Model
 * Extended patient information separate from user
 */
import { DataTypes } from 'sequelize';
import { GENDER } from '../config/constants.js';

export default (sequelize) => {
  const Patient = sequelize.define(
    'Patient',
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
        field: 'id',
      },
      userId: {
        type: DataTypes.CHAR(36),
        allowNull: true,
        field: 'user_id',
      },
      fullName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'full_name',
      },
      dateOfBirth: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'date_of_birth',
      },
      gender: {
        type: DataTypes.STRING(10),
        allowNull: true,
        validate: {
          isIn: {
            args: [Object.values(GENDER)],
            msg: 'Giới tính không hợp lệ',
          },
        },
      },
      phone: {
        type: DataTypes.STRING(15),
        allowNull: true,
      },
      email: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      address: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      idNumber: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'id_number',
      },
      medicalHistory: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'medical_history',
      },
      allergies: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      emergencyContact: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'emergency_contact',
      },
      emergencyPhone: {
        type: DataTypes.STRING(15),
        allowNull: true,
        field: 'emergency_phone',
      },
      insuranceNumber: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'insurance_number',
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: 'patients',
      timestamps: true,
      paranoid: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
      indexes: [
        { fields: ['full_name'] },
        { fields: ['phone'] },
        { fields: ['id_number'] },
        { fields: ['user_id'] },
      ],
      // Model fields map directly to existing DB columns (SSMS schema).
    }
  );

  // Associations
  Patient.associate = (models) => {
    if (models && models.Appointment) {
      Patient.hasMany(models.Appointment, { foreignKey: 'patientId', as: 'appointments' });
    }

    if (models && models.User) {
      Patient.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    }

    if (models && models.MedicalRecord) {
      Patient.hasMany(models.MedicalRecord, { foreignKey: 'patientId', as: 'medicalRecords' });
    }
    // Link to MedicalExamination when present
    if (models && models.MedicalExamination) {
      Patient.hasMany(models.MedicalExamination, { foreignKey: 'PatientId', as: 'examinations' });
    }
  };

  return Patient;
};
