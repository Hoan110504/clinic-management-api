import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const Medicine = sequelize.define(
    'Medicine',
    {
      Id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
        field: 'Id',
      },
      Name: {
        type: DataTypes.STRING(150),
        allowNull: false,
        field: 'Name',
      },
      Unit: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'Unit',
      },
      Category: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'Category',
      },
      Price: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: true,
        field: 'Price',
      },
      IsActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'IsActive',
      },
    },
    {
      tableName: 'Medicine',
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