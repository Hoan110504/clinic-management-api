/**
 * PrescriptionItem Model
 * Details of medicines in a prescription
 */
import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const PrescriptionItem = sequelize.define('PrescriptionItem', {
    Id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
      field: 'Id'
    },

    PrescriptionId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'PrescriptionId',
      references: {
        model: 'Prescriptions',
        key: 'Id'
      }
    },

    MedicineId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'MedicineId',
      references: {
        model: 'Medicines',
        key: 'Id'
      }
    },

    Quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'Quantity'
    },

    UnitPrice: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      field: 'UnitPrice'
    },

    Dosage: {
      type: DataTypes.STRING(510),
      allowNull: true,
      field: 'Dosage'
    },

    UsageInstructions: {
      type: DataTypes.STRING(510),
      allowNull: true,
      field: 'UsageInstructions'
    }
  }, {
    tableName: 'PrescriptionItems',
    timestamps: false,
    indexes: [
      { fields: ['PrescriptionId'] },
      { fields: ['MedicineId'] }
    ]
  });

  PrescriptionItem.associate = (models) => {
    // Belongs to Prescription (singular model name)
    if (models && models.Prescription) {
      PrescriptionItem.belongsTo(models.Prescription, {
        foreignKey: 'PrescriptionId',
        as: 'Prescription',
        onDelete: 'CASCADE'
      });
    }

    // Belongs to Medicine
    if (models && models.Medicine) {
      PrescriptionItem.belongsTo(models.Medicine, {
        foreignKey: 'MedicineId',
        as: 'Medicine'
      });
    }
  };

  return PrescriptionItem;
};