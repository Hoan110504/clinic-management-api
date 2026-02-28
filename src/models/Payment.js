/**
 * Payment Model
 * Handles billing and payment records
 */
const { DataTypes } = require('sequelize');
const {
  PAYMENT_STATUS,
  PAYMENT_TYPES,
  PAYMENT_METHODS,
  GENDER,
} = require('../config/constants');

module.exports = (sequelize) => {
  const Payment = sequelize.define(
    'Payment',
    {
      id: {
        type: DataTypes.STRING(20),
        primaryKey: true,
        allowNull: false,
      },
      type: {
        type: DataTypes.ENUM(...Object.values(PAYMENT_TYPES)),
        allowNull: false,
        defaultValue: PAYMENT_TYPES.MEDICAL_EXAM,
      },
      // Cashier info
      cashierId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'cashier_id',
        references: {
          model: 'users',
          key: 'id',
        },
      },
      cashierName: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'cashier_name',
      },
      cashierSignature: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'cashier_signature',
      },
      // Patient info
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
      patientPhone: {
        type: DataTypes.STRING(15),
        allowNull: true,
        field: 'patient_phone',
      },
      patientBirthDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'patient_birth_date',
      },
      patientGender: {
        type: DataTypes.ENUM(...Object.values(GENDER)),
        allowNull: true,
        field: 'patient_gender',
      },
      // Related records
      medicalRecordId: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'medical_record_id',
        references: {
          model: 'medical_records',
          key: 'id',
        },
      },
      prescriptionId: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'prescription_id',
        references: {
          model: 'prescriptions',
          key: 'id',
        },
      },
      // Items - stored as JSON
      services: {
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
          const rawValue = this.getDataValue('services');
          return rawValue ? JSON.parse(rawValue) : [];
        },
        set(value) {
          this.setDataValue('services', value ? JSON.stringify(value) : '[]');
        },
      },
      medicines: {
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
          const rawValue = this.getDataValue('medicines');
          return rawValue ? JSON.parse(rawValue) : [];
        },
        set(value) {
          this.setDataValue('medicines', value ? JSON.stringify(value) : '[]');
        },
      },
      // Fee breakdown
      consultationFee: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'consultation_fee',
      },
      labTestFee: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'lab_test_fee',
      },
      medicineFee: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'medicine_fee',
      },
      subtotal: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
      },
      // Discount
      discountType: {
        type: DataTypes.ENUM('percent', 'amount'),
        allowNull: true,
        field: 'discount_type',
      },
      discountValue: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0,
        field: 'discount_value',
      },
      discountAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'discount_amount',
      },
      // Total
      total: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
      },
      amountPaid: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'amount_paid',
      },
      changeAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'change_amount',
      },
      // Payment details
      paymentMethod: {
        type: DataTypes.ENUM(...Object.values(PAYMENT_METHODS)),
        allowNull: true,
        field: 'payment_method',
      },
      patientSignature: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'patient_signature',
      },
      status: {
        type: DataTypes.ENUM(...Object.values(PAYMENT_STATUS)),
        allowNull: false,
        defaultValue: PAYMENT_STATUS.UNPAID,
      },
      paidAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'paid_at',
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: 'payments',
      timestamps: true,
      paranoid: true,
      indexes: [
        { fields: ['patient_id'] },
        { fields: ['medical_record_id'] },
        { fields: ['status'] },
        { fields: ['type'] },
        { fields: ['created_at'] },
      ],
      hooks: {
        beforeCreate: async (payment) => {
          if (!payment.id) {
            const Payment = sequelize.models.Payment;
            const lastPayment = await Payment.findOne({
              order: [['createdAt', 'DESC']],
              paranoid: false,
            });
            let nextNum = 1;
            if (lastPayment && lastPayment.id) {
              const match = lastPayment.id.match(/PT(\d+)/);
              if (match) {
                nextNum = parseInt(match[1], 10) + 1;
              }
            }
            payment.id = `PT${String(nextNum).padStart(3, '0')}`;
          }
        },
      },
    }
  );

  return Payment;
};
