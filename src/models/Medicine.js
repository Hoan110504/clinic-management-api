import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const Medicine = sequelize.define(
    'Medicine',
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
        field: 'Id',
      },
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
        field: 'Name',
      },
      unit: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'Unit',
      },
      category: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'Category',
      },
      price: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: true,
        field: 'Price',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'IsActive',
      },
    },
    {
      tableName: 'Medicines',
      timestamps: false,
    }
  );
  // Define associations when models are loaded
  Medicine.associate = (models) => {
    if (models.InventoryTransaction) {
      Medicine.hasMany(models.InventoryTransaction, {
        foreignKey: 'MedicineId',
        as: 'transactions',
      });
    }

    if (models.MedicineBatch) {
      Medicine.hasMany(models.MedicineBatch, {
        foreignKey: 'MedicineId',
        as: 'batches',
      });
    }
  };

  return Medicine;
};