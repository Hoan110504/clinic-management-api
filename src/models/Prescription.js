/**
 * Prescription Model
 * Handles medication prescriptions
 */
import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const Prescription = sequelize.define(
    'Prescription',
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
        field: 'Id',
      },
      examinationId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'ExaminationID',
        references: {
          model: 'MedicalExaminations',
          key: 'ExaminationID',
        },
      },
      medicalRecordId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'MedicalRecordId',
        references: {
          model: 'MedicalExaminations',
          key: 'ExaminationID',
        },
      },
      patientId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'PatientId',
        references: {
          model: 'Patients',
          key: 'id',
        },
      },
      patientName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'PatientName',
      },
      doctorId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'DoctorId',
        references: {
          model: 'users',
          key: 'id',
        },
      },
      doctorName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'DoctorName',
      },
      prescriptionDate: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'PrescriptionDate',
      },
      // Items - stored as JSON array
      items: {
        type: DataTypes.TEXT('long'),
        allowNull: false,
        field: 'Items',
        get() {
          const rawValue = this.getDataValue('items');
          return rawValue ? JSON.parse(rawValue) : [];
        },
        set(value) {
          this.setDataValue('items', value ? JSON.stringify(value) : '[]');
        },
      },
      diagnosis: {
        type: DataTypes.TEXT('long'),
        allowNull: true,
        field: 'Diagnosis',
      },
      notes: {
        type: DataTypes.TEXT('long'),
        allowNull: true,
        field: 'Note',
      },
      // Status: 0 = Chờ phát thuốc (Waiting for dispensing)
      //         1 = Đã phát thuốc (Dispensed)
      //         2 = Đã hủy (Cancelled)
      status: {
        type: DataTypes.TINYINT,
        defaultValue: 0,
        field: 'Status',
        allowNull: false,
      },
    },
    {
      tableName: 'Prescriptions',
      timestamps: true,
      createdAt: 'CreatedAt',
      updatedAt: 'UpdatedAt',
      paranoid: true,
      deletedAt: 'DeletedAt',
      indexes: [
        { fields: ['ExaminationID'] },
        { fields: ['MedicalRecordId'] },
        { fields: ['DoctorId'] },
        { fields: ['PrescriptionDate'] },
        { fields: ['Status'] },
      ],
    }
  );

  // Associations
  Prescription.associate = (models) => {
    if (models && models.Patient) {
      Prescription.belongsTo(models.Patient, {
        foreignKey: 'patientId',
        as: 'patient',
      });
    }

    if (models && models.User) {
      Prescription.belongsTo(models.User, {
        foreignKey: 'doctorId',
        as: 'doctor',
      });
    }

    if (models && models.MedicalExamination) {
      Prescription.belongsTo(models.MedicalExamination, {
        foreignKey: 'medicalRecordId',
        as: 'medicalRecord',
      });
    }
  };

  return Prescription;
};
