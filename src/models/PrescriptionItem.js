/**
 * PrescriptionItem Model
 * Details of medicines in a prescription
 */
import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const PrescriptionItem = sequelize.define('PrescriptionItem', {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
      field: 'PrescriptionItemID'
    },

    prescriptionId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'PrescriptionID',
      references: {
        model: 'Prescriptions',
        key: 'PrescriptionID'
      }
    },

    medicineId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'MedicineId',
      references: {
        model: 'Medicines',
        key: 'Id'
      }
    },

    dosage: {
      type: DataTypes.STRING(510),
      allowNull: true,
      field: 'Dosage'
    },

    frequency: {
      type: DataTypes.STRING(510),
      allowNull: true,
      field: 'Frequency'
    },

    duration: {
      type: DataTypes.STRING(510),
      allowNull: true,
      field: 'Duration'
    },

    quantityPrescribed: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'QuantityPrescribed'
    },

    instructions: {
      type: DataTypes.STRING(1000),
      allowNull: true,
      field: 'Instructions'
    },

    status: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 0,
      field: 'Status'
    }
  }, {
    tableName: 'PrescriptionItems',
    timestamps: true,
    createdAt: 'CreatedAt',
    updatedAt: false,
    underscored: false,
    indexes: [
      { fields: ['PrescriptionID'] },
      { fields: ['MedicineId'] }
    ]
  });

  PrescriptionItem.associate = (models) => {
    // Belongs to Prescription
    if (models && models.Prescription) {
      PrescriptionItem.belongsTo(models.Prescription, {
        foreignKey: 'prescriptionId',
        as: 'prescription',
        onDelete: 'CASCADE'
      });
    }

    // Belongs to Medicine
    if (models && models.Medicine) {
      PrescriptionItem.belongsTo(models.Medicine, {
        foreignKey: 'medicineId',
        as: 'medicine'
      });
    }
  };

  return PrescriptionItem;
};