/**
 * Medicine Model
 * Handles medicine/drug inventory
 */
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Medicine = sequelize.define(
    'Medicine',
    {
      id: {
        type: DataTypes.STRING(20),
        primaryKey: true,
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      genericName: {
        type: DataTypes.STRING(200),
        allowNull: true,
        field: 'generic_name',
      },
      unit: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      price: {
        type: DataTypes.DECIMAL(15, 2),
        allowNull: false,
        defaultValue: 0,
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      minQuantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'min_quantity',
      },
      category: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      supplier: {
        type: DataTypes.STRING(200),
        allowNull: true,
      },
      manufacturer: {
        type: DataTypes.STRING(200),
        allowNull: true,
      },
      batchNumber: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'batch_number',
      },
      expiryDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'expiry_date',
      },
      manufacturingDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'manufacturing_date',
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      dosageInstructions: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'dosage_instructions',
      },
      sideEffects: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'side_effects',
      },
      contraindications: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      storageConditions: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'storage_conditions',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'is_active',
      },
    },
    {
      tableName: 'medicines',
      timestamps: true,
      paranoid: true,
      indexes: [
        { fields: ['name'] },
        { fields: ['category'] },
        { fields: ['expiry_date'] },
        { fields: ['is_active'] },
      ],
      hooks: {
        beforeCreate: async (medicine) => {
          if (!medicine.id) {
            const Medicine = sequelize.models.Medicine;
            const lastMedicine = await Medicine.findOne({
              order: [['createdAt', 'DESC']],
              paranoid: false,
            });
            let nextNum = 1;
            if (lastMedicine && lastMedicine.id) {
              const match = lastMedicine.id.match(/MED(\d+)/);
              if (match) {
                nextNum = parseInt(match[1], 10) + 1;
              }
            }
            medicine.id = `MED${String(nextNum).padStart(3, '0')}`;
          }
        },
      },
    }
  );

  // Instance method to check low stock
  Medicine.prototype.isLowStock = function () {
    return this.quantity <= this.minQuantity;
  };

  // Instance method to check if expired
  Medicine.prototype.isExpired = function () {
    if (!this.expiryDate) return false;
    return new Date(this.expiryDate) < new Date();
  };

  return Medicine;
};
