/**
 * InventoryTransaction Model
 * Manage medicine stock import/export transactions
 */

import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const InventoryTransaction = sequelize.define(
    'InventoryTransaction',
    {
      Id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
        field: 'Id',
      },

      MedicineBatchId: {
        type: DataTypes.BIGINT,
        allowNull: true,
        references: {
          model: 'MedicineBatches',
          key: 'Id',
        },
        field: 'MedicineBatchId',
      },

      MedicineId: {
        type: DataTypes.BIGINT,
        allowNull: true,
        references: {
          model: 'Medicines',
          key: 'Id',
        },
        field: 'MedicineId',
      },

      TransactionType: {
        type: DataTypes.TINYINT,
        allowNull: true,
        field: 'TransactionType',
      },

      Quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'Quantity',
      },

      QuantityBefore: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'QuantityBefore',
      },

      QuantityAfter: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'QuantityAfter',
      },

      Reason: {
        type: DataTypes.STRING(255),
        field: 'Reason',
      },

      ReferenceType: {
        type: DataTypes.TINYINT,
        allowNull: true,
        field: 'ReferenceType',
      },

      // Note: legacy schema does not include a separate ReferenceId column.
      // Reference information is captured via `ReferenceType` and `Note`.

      PerformedByUserId: {
        // legacy column stores GUIDs (char(36)) in some deployments; keep flexible
        type: DataTypes.CHAR(36),
        allowNull: true,
        field: 'PerformedByUserId',
      },

      CreatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'CreatedAt',
      },

      Note: {
        type: DataTypes.TEXT('long'),
        allowNull: true,
        field: 'Note',
      },
    },
    {
      tableName: 'InventoryTransactions',
      timestamps: false,
      indexes: [
        { fields: ['MedicineBatchId'] },
        { fields: ['TransactionType'] },
        { fields: ['CreatedAt'] },
      ],
    }
  );

  // ENUM Transaction Type
  InventoryTransaction.TRANSACTION_TYPE = {
    IMPORT: 1,     // nhập kho
    EXPORT: 2,     // xuất kho
    ADJUSTMENT: 3, // điều chỉnh
    RETURN: 4,     // trả lại
  };

  // ENUM Reference Type
  InventoryTransaction.REFERENCE_TYPE = {
    PRESCRIPTION: 1,
    IMPORT_RECEIPT: 2,
    ADJUSTMENT: 3,
  };

  InventoryTransaction.associate = (models) => {
    InventoryTransaction.belongsTo(models.MedicineBatch, {
      foreignKey: 'MedicineBatchId',
      as: 'batch',
    });

    InventoryTransaction.belongsTo(models.Medicine, {
      foreignKey: 'MedicineId',
      as: 'medicine',
    });

    InventoryTransaction.belongsTo(models.User, {
      foreignKey: 'PerformedByUserId',
      as: 'performedBy',
    });
  };

  return InventoryTransaction;
};