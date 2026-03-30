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
      patientName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'patient_name',
      },
      doctorId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'doctor_id',
        references: {
          model: 'users',
          key: 'id',
        },
      },
      doctorName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'doctor_name',
      },
      prescriptionDate: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'prescription_date',
      },
      // Items - stored as JSON array
      items: {
        type: DataTypes.TEXT,
        allowNull: false,
        get() {
          const rawValue = this.getDataValue('items');
          return rawValue ? JSON.parse(rawValue) : [];
        },
        set(value) {
          this.setDataValue('items', value ? JSON.stringify(value) : '[]');
        },
      },
      diagnosis: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      // Dispensing status
      isDispensed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'is_dispensed',
      },
      dispensedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'dispensed_at',
      },
      dispensedById: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'dispensed_by_id',
        references: {
          model: 'users',
          key: 'id',
        },
      },
      dispensedByName: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'dispensed_by_name',
      },
    },
    {
      tableName: 'prescriptions',
      timestamps: true,
      paranoid: true,
      indexes: [
        { fields: ['medical_record_id'] },
        { fields: ['patient_id'] },
        { fields: ['doctor_id'] },
        { fields: ['prescription_date'] },
        { fields: ['is_dispensed'] },
      ],
      hooks: {
        beforeCreate: async (prescription) => {
          if (!prescription.id) {
            const PrescriptionModel = sequelize.models.Prescription;
            const lastPrescription = await PrescriptionModel.findOne({
              order: [['createdAt', 'DESC']],
              paranoid: false,
            });

            let nextNum = 1;
            if (lastPrescription && lastPrescription.id) {
              const match = lastPrescription.id.match(/DT(\d+)/);
              if (match) {
                nextNum = parseInt(match[1], 10) + 1;
              }
            }

            prescription.id = `DT${String(nextNum).padStart(3, '0')}`;
          }
        },
      },
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

    if (models && models.MedicalRecord) {
      Prescription.belongsTo(models.MedicalRecord, {
        foreignKey: 'medicalRecordId',
        as: 'medicalRecord',
      });
    }
  };

  return Prescription;
};
