/**
 * MedicineBatch Model
 * Manage medicine batches in inventory
 */

import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const MedicineBatch = sequelize.define(
    'MedicineBatch',
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
        field: 'Id',
      },

      medicineId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        references: {
          model: 'Medicines',
          key: 'Id',
        },
        field: 'MedicineId',
      },

      batchNumber: {
        type: DataTypes.STRING(50),
        allowNull: false,
        field: 'BatchNumber',
      },

      expiryDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'ExpiryDate',
      },

      manufactureDate: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        field: 'ManufactureDate',
      },

      quantityInStock: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'QuantityInStock',
      },

      importPrice: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: true,
        field: 'ImportPrice',
      },

      status: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
        field: 'Status',
      },
    },
    {
      tableName: 'MedicineBatches',
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