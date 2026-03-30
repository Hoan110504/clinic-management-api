/**
 * Inventory Transaction Model
 * Handles medicine inventory in/out transactions
 */
import { DataTypes } from 'sequelize';
import { INVENTORY_TRANSACTION_TYPES } from '../config/constants.js';

export default (sequelize) => {
  const InventoryTransaction = sequelize.define(
    'InventoryTransaction',
    {
      id: {
        type: DataTypes.STRING(20),
        primaryKey: true,
        allowNull: false,
      },
      medicineId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'medicine_id',
        references: {
          model: 'Thuoc',
          key: 'Id',
        },
      },
      medicineName: {
        type: DataTypes.STRING(200),
        allowNull: false,
        field: 'medicine_name',
      },
      type: {
        type: DataTypes.ENUM(...Object.values(INVENTORY_TRANSACTION_TYPES)),
        allowNull: false,
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      previousQuantity: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'previous_quantity',
      },
      newQuantity: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'new_quantity',
      },
      reason: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      referenceType: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'reference_type',
      },
      referenceId: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'reference_id',
      },
      performedById: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'performed_by_id',
        references: {
          model: 'users',
          key: 'id',
        },
      },
      performedBy: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'performed_by',
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
    },
    {
      tableName: 'inventory_transactions',
      timestamps: true,
      paranoid: false,
      indexes: [
        { fields: ['medicine_id'] },
        { fields: ['type'] },
        { fields: ['created_at'] },
        { fields: ['reference_type', 'reference_id'] },
      ],
      hooks: {
        beforeCreate: async (transaction) => {
          if (!transaction.id) {
            const InventoryTransaction = sequelize.models.InventoryTransaction;
            const lastTransaction = await InventoryTransaction.findOne({
              order: [['createdAt', 'DESC']],
            });
            let nextNum = 1;
            if (lastTransaction && lastTransaction.id) {
              const match = lastTransaction.id.match(/INV(\d+)/);
              if (match) {
                nextNum = parseInt(match[1], 10) + 1;
              }
            }
            transaction.id = `INV${String(nextNum).padStart(3, '0')}`;
          }
        },
      },
    }
  );

  return InventoryTransaction;
};
