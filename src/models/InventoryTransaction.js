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
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
        field: 'Id',
      },

      MedicineBatchId: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'MedicineBatch',
          key: 'Id',
        },
        field: 'MedicineBatchId',
      },

      MedicineId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
          model: 'Medicine',
          key: 'Id',
        },
        field: 'MedicineId',
      },

      TransactionType: {
        type: DataTypes.TINYINT,
        field: 'TransactionType',
      },

      Quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'Quantity',
      },

      QuantityBefore: {
        type: DataTypes.INTEGER,
        field: 'QuantityBefore',
      },

      QuantityAfter: {
        type: DataTypes.INTEGER,
        field: 'QuantityAfter',
      },

      Reason: {
        type: DataTypes.STRING(255),
        field: 'Reason',
      },

      ReferenceType: {
        type: DataTypes.TINYINT,
        field: 'ReferenceType',
      },

      ReferenceId: {
        // ReferenceId may be either a UUID (legacy) or a simple string/number id
        // keep flexible by using STRING so it can hold both GUIDs and numeric refs
        type: DataTypes.STRING(100),
        field: 'ReferenceId',
      },

      PerformedByUserId: {
        type: DataTypes.CHAR(36), // vì bảng users.id của bạn là char(36)
        references: {
          model: 'users',
          key: 'id',
        },
        field: 'PerformedByUserId',
      },

      CreatedAt: {
        type: DataTypes.DATE,
        defaultValue: sequelize.literal('GETDATE()'),
        field: 'CreatedAt',
      },

      Note: {
        type: DataTypes.TEXT,
        field: 'Note',
      },
    },
    {
      tableName: 'InventoryTransaction',
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