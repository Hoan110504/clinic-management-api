/**
 * MedicineBatch Model
 * Manage medicine batches in inventory
 */

import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const MedicineBatch = sequelize.define(
    'MedicineBatch',
    {
      Id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        field: 'Id',
      },

      MedicineId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'Medicine',
          key: 'Id',
        },
        field: 'MedicineId',
      },

      BatchNumber: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: 'BatchNumber',
      },

      ExpiryDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'ExpiryDate',
      },

      ManufactureDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'ManufactureDate',
      },

      QuantityInStock: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'QuantityInStock',
      },

      ImportPrice: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: true,
        field: 'ImportPrice',
      },

      Status: {
        type: DataTypes.TINYINT,
        defaultValue: 1,
        field: 'Status',
      },
    },
    {
      tableName: 'MedicineBatch',
      timestamps: false,
      indexes: [
        { fields: ['MedicineId'] },
        { fields: ['ExpiryDate'] },
        { fields: ['Status'] },
      ],
    }
  );

  // Enum trạng thái lô thuốc
  MedicineBatch.STATUS = {
    OUT_OF_STOCK: 0,
    IN_STOCK: 1,
    EXPIRED: 2,
  };

  MedicineBatch.associate = (models) => {
    // Batch thuộc về Medicine
    MedicineBatch.belongsTo(models.Medicine, {
      foreignKey: 'MedicineId',
      as: 'medicine',
    });

    // 1 batch có nhiều giao dịch kho (sau này sẽ tạo bảng InventoryTransaction)
    MedicineBatch.hasMany(models.InventoryTransaction, {
      foreignKey: 'MedicineBatchId',
      as: 'inventoryTransactions',
    });
  };

  return MedicineBatch;
};