/**
 * Service Order Model
 * Handles lab test and service orders
 */
import { DataTypes } from 'sequelize';
import { GENDER } from '../config/constants.js';

export default (sequelize) => {
  const ServiceOrder = sequelize.define(
    'ServiceOrder',
    {
      id: {
        type: DataTypes.STRING(20),
        primaryKey: true,
        allowNull: false,
      },
      medicalRecordId: {
        type: DataTypes.STRING(20),
        allowNull: false,
        field: 'medical_record_id',
        references: {
          model: 'medical_records',
          key: 'id',
        },
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
      patientAddress: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'patient_address',
      },
      diagnosis: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      // Services - stored as JSON array
      services: {
        type: DataTypes.TEXT,
        allowNull: false,
        get() {
          const rawValue = this.getDataValue('services');
          return rawValue ? JSON.parse(rawValue) : [];
        },
        set(value) {
          this.setDataValue('services', value ? JSON.stringify(value) : '[]');
        },
      },
      totalAmount: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
        field: 'total_amount',
      },
      doctorNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'doctor_notes',
      },
      nextAppointment: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'next_appointment',
      },
      orderedById: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'ordered_by_id',
        references: {
          model: 'users',
          key: 'id',
        },
      },
      orderedByName: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'ordered_by_name',
      },
    },
    {
      tableName: 'service_orders',
      timestamps: true,
      paranoid: true,
      indexes: [
        { fields: ['medical_record_id'] },
        { fields: ['patient_id'] },
        { fields: ['created_at'] },
      ],
      hooks: {
        beforeCreate: async (order) => {
          if (!order.id) {
            const ServiceOrder = sequelize.models.ServiceOrder;
            const lastOrder = await ServiceOrder.findOne({
              order: [['createdAt', 'DESC']],
              paranoid: false,
            });
            let nextNum = 1;
            if (lastOrder && lastOrder.id) {
              const match = lastOrder.id.match(/SO(\d+)/);
              if (match) {
                nextNum = parseInt(match[1], 10) + 1;
              }
            }
            order.id = `SO${String(nextNum).padStart(3, '0')}`;
          }
        },
      },
    }
  );

  return ServiceOrder;
};
