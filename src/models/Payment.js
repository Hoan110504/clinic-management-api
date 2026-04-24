/**
 * Payment Model
 * Canonical mapping for dbo.Payments
 */
import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const Payment = sequelize.define(
    'Payment',
    {
      id: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
        field: 'Id',
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
      examinationId: {
        type: DataTypes.BIGINT,
        allowNull: true,
        field: 'ExaminationID',
        references: {
          model: 'MedicalExaminations',
          key: 'ExaminationID',
        },
      },
      prescriptionId: {
        type: DataTypes.BIGINT,
        allowNull: true,
        field: 'PrescriptionID',
        references: {
          model: 'Prescriptions',
          key: 'PrescriptionID',
        },
      },
      labOrderId: {
        type: DataTypes.BIGINT,
        allowNull: true,
        field: 'LabOrderID',
        references: {
          model: 'LabOrders',
          key: 'LabOrderID',
        },
      },
      invoiceDate: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'InvoiceDate',
      },
      totalAmount: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'TotalAmount',
      },
      paidAmount: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'PaidAmount',
      },
      debtAmount: {
        type: DataTypes.VIRTUAL,
      },
      paymentMethod: {
        type: DataTypes.TINYINT,
        allowNull: true,
        field: 'PaymentMethod',
      },
      status: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0,
        field: 'Status',
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'CreatedAt',
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'UpdatedAt',
      },
    },
    {
      tableName: 'Payments',
      timestamps: true,
      paranoid: false,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      indexes: [
        { fields: ['PatientId'] },
        { fields: ['ExaminationID'] },
        { fields: ['PrescriptionID'] },
        { fields: ['LabOrderID'] },
        { fields: ['Status'] },
        { fields: ['InvoiceDate'] },
      ],
    }
  );

  Payment.associate = (models) => {
    if (models?.Patient) {
      Payment.belongsTo(models.Patient, { foreignKey: 'patientId', as: 'patient' });
    }
    if (models?.MedicalExamination) {
      Payment.belongsTo(models.MedicalExamination, { foreignKey: 'examinationId', as: 'examination' });
    }
    if (models?.Prescription) {
      Payment.belongsTo(models.Prescription, { foreignKey: 'prescriptionId', as: 'prescription' });
    }
    if (models?.LabOrder) {
      Payment.belongsTo(models.LabOrder, { foreignKey: 'labOrderId', as: 'labOrder' });
    }
  };

  return Payment;
};
