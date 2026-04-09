/**
 * Invoice Model
 * Represents invoices for services, prescriptions, or payments
 */
import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const Invoice = sequelize.define(
    'Invoice',
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
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
      invoiceDate: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'InvoiceDate',
      },
      totalAmount: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        field: 'TotalAmount',
      },
      status: {
        type: DataTypes.TINYINT,
        allowNull: false,
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
      tableName: 'Invoices',
      timestamps: false,
      indexes: [
        { fields: ['PatientId'] },
        { fields: ['InvoiceDate'] },
        { fields: ['Status'] },
      ],
    }
  );

  // Enum for status
  Invoice.STATUS = {
    CHUA_THANH_TOAN: 0,
    DA_THANH_TOAN: 1,
    DA_HUY: 2
  };

  Invoice.associate = (models) => {
    if (models.Patient) {
      Invoice.belongsTo(models.Patient, { foreignKey: 'patientId', as: 'patient' });
    }
  };

  return Invoice;
};