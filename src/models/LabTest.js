/**
 * Lab Test Model
 * Handles laboratory test records
 */
import { DataTypes } from 'sequelize';
import { LAB_STATUS } from '../config/constants.js';

export default (sequelize) => {
  const LabTest = sequelize.define(
    'LabTest',
    {
      id: {
        type: DataTypes.STRING(20),
        primaryKey: true,
        allowNull: false,
      },
      serviceOrderId: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'service_order_id',
        references: {
          model: 'service_orders',
          key: 'id',
        },
      },
      medicalRecordId: {
        type: DataTypes.STRING(20),
        allowNull: true,
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
      patientName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'patient_name',
      },
      testType: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: 'test_type',
      },
      testName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'test_name',
      },
      orderedBy: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'ordered_by',
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
      orderedDate: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'ordered_date',
      },
      status: {
        type: DataTypes.ENUM(...Object.values(LAB_STATUS)),
        allowNull: false,
        defaultValue: LAB_STATUS.PENDING,
      },
      // Results
      results: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      normalRange: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'normal_range',
      },
      resultDate: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'result_date',
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      // Confirmation
      confirmedBy: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'confirmed_by',
      },
      confirmedById: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'confirmed_by_id',
        references: {
          model: 'users',
          key: 'id',
        },
      },
      confirmedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'confirmed_at',
      },
    },
    {
      tableName: 'lab_tests',
      timestamps: true,
      paranoid: true,
      indexes: [
        { fields: ['patient_id'] },
        { fields: ['medical_record_id'] },
        { fields: ['status'] },
        { fields: ['ordered_date'] },
      ],
      hooks: {
        beforeCreate: async (test) => {
          if (!test.id) {
            const LabTest = sequelize.models.LabTest;
            const lastTest = await LabTest.findOne({
              order: [['createdAt', 'DESC']],
              paranoid: false,
            });
            let nextNum = 1;
            if (lastTest && lastTest.id) {
              const match = lastTest.id.match(/XN(\d+)/);
              if (match) {
                nextNum = parseInt(match[1], 10) + 1;
              }
            }
            test.id = `XN${String(nextNum).padStart(3, '0')}`;
          }
        },
      },
    }
  );

  return LabTest;
};
