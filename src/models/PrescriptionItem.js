/**
 * PrescriptionItem Model
 * Details of medicines in a prescription
 */

module.exports = (sequelize, DataTypes) => {
  const PrescriptionItem = sequelize.define('PrescriptionItem', {
    Id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      field: 'Id'
    },

    PrescriptionId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'PrescriptionId',
      references: {
        model: 'Prescription',
        key: 'Id'
      }
    },

    MedicineId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'MedicineId',
      references: {
        model: 'Medicine',
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
      field: 'Dosage'
    },

    UsageInstructions: {
      type: DataTypes.STRING(510),
      field: 'UsageInstructions'
    }

  }, {
    tableName: 'PrescriptionItem',
    timestamps: false,
    indexes: [
      { fields: ['PrescriptionId'] },
      { fields: ['MedicineId'] }
    ]
  });

  PrescriptionItem.associate = (models) => {

    // Belongs to Prescription
    PrescriptionItem.belongsTo(models.Prescription, {
      foreignKey: 'PrescriptionId',
      as: 'Prescription',
      onDelete: 'CASCADE'
    });

    // Belongs to Medicine
    PrescriptionItem.belongsTo(models.Medicine, {
      foreignKey: 'MedicineId',
      as: 'Medicine'
    });

  };

  return PrescriptionItem;
};