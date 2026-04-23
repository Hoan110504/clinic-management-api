/**
 * Prescription Model
 * Handles medication prescriptions
 */
import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const Prescription = sequelize.define(
    'Prescription',
    {
      prescriptionId: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
        field: 'PrescriptionID',
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
      doctorId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'DoctorID',
        references: {
          model: 'users',
          key: 'id',
        },
      },
      prescriptionDate: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'PrescriptionDate',
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
      indexes: [
        { fields: ['ExaminationID'] },
        { fields: ['DoctorID'] },
        { fields: ['PrescriptionDate'] },
        { fields: ['Status'] },
      ],
    }
  );

  // Associations
  Prescription.associate = (models) => {
    if (models && models.User) {
      Prescription.belongsTo(models.User, {
        foreignKey: 'doctorId',
        as: 'doctor',
      });
    }

    if (models && models.MedicalExamination) {
      Prescription.belongsTo(models.MedicalExamination, {
        foreignKey: 'examinationId',
        as: 'examination',
      });
    }

    if (models && models.PrescriptionItem) {
      Prescription.hasMany(models.PrescriptionItem, {
        foreignKey: 'prescriptionId',
        as: 'prescriptionItems',
      });
    }
  };

  return Prescription;
};
