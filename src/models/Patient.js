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
        type: DataTypes.STRING(20),
        primaryKey: true,
        allowNull: false,
      },
      userId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'user_id',
        references: {
          model: 'users',
          key: 'id',
        },
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
        unique: true,
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
      indexes: [
        { fields: ['full_name'] },
        { fields: ['phone'] },
        { fields: ['id_number'] },
        { fields: ['user_id'] },
      ],
      hooks: {
        beforeValidate: async (patient) => {
          if (!patient.id) {
            const lastPatient = await Patient.findOne({
              order: [['createdAt', 'DESC']],
              paranoid: false,
            });

            let nextNum = 1;
            if (lastPatient && lastPatient.id) {
              const match = lastPatient.id.match(/BN(\d+)/);
              if (match) {
                nextNum = parseInt(match[1], 10) + 1;
              }
            }
            patient.id = `BN${String(nextNum).padStart(3, '0')}`;
          }
        },
      },
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
      Patient.hasMany(models.MedicalExamination, { foreignKey: 'PatientID', as: 'examinations' });
    }
  };

  return Patient;
};
