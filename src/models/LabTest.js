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
        type: DataTypes.STRING(50),
        primaryKey: true,
        allowNull: false,
      },
      serviceOrderId: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'service_order_id',
        references: {
          model: 'service_orders',
          key: 'id',
        },
      },
      medicalRecordId: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'medical_record_id',
        references: {
          model: 'HoSoKham',
          key: 'id',
        },
      },
      patientId: {
        type: DataTypes.STRING(50),
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
      images: {
        type: DataTypes.TEXT,
        allowNull: true,
        get() {
          const raw = this.getDataValue('images');
          if (!raw) return [];
          if (Array.isArray(raw)) return raw;
          if (typeof raw === 'string') {
            try {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) return parsed;
              return parsed ? [parsed] : [];
            } catch (_e) {
              return [raw];
            }
          }
          return [];
        },
        set(value) {
          if (value === null || value === undefined) {
            this.setDataValue('images', null);
            return;
          }

          const normalized = Array.isArray(value) ? value.filter(Boolean) : [value];
          this.setDataValue('images', JSON.stringify(normalized));
        },
      },
      conclusion: {
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
          beforeValidate: async (test) => {
            if (!test.id) {
              try {
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
              } catch (e) {
                // If the lookup fails (missing table or permission), fall back to a safe generated id
                console.warn('LabTest.beforeValidate: could not query lastTest, falling back to timestamp id', e && e.message);
                test.id = `XN${Date.now().toString().slice(-10)}`;
              }
            }
          },
      },
    }
  );

    // Associations (defined after model creation)
    LabTest.associate = (models) => {
      if (models.Patient) {
        LabTest.belongsTo(models.Patient, { foreignKey: 'patientId', as: 'patient' });
      }

      if (models.MedicalRecord || models.HoSoKham) {
        const MR = models.MedicalRecord || models.HoSoKham;
        LabTest.belongsTo(MR, { foreignKey: 'medicalRecordId', as: 'medicalRecord' });
      }

      if (models.ServiceOrder) {
        LabTest.belongsTo(models.ServiceOrder, { foreignKey: 'serviceOrderId', as: 'serviceOrder' });
      }

      if (models.User) {
        LabTest.belongsTo(models.User, { foreignKey: 'orderedById', as: 'orderedByUser' });
        LabTest.belongsTo(models.User, { foreignKey: 'confirmedById', as: 'confirmedByUser' });
      }
    };

    return LabTest;
  };
