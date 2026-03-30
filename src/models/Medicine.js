/**
 * Medicine Model
 * Handles medicine/drug inventory
 */
import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const Medicine = sequelize.define(
    'Medicine',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
        field: 'Id',
      },
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
        field: 'TenThuoc',
      },
      unit: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'DonVi',
      },
      category: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'NhomThuoc',
      },
      price: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: true,
        field: 'GiaBan',
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'TrangThai',
      },
    },
    {
      tableName: 'Thuoc',
      timestamps: false,
      paranoid: false,
      indexes: [
        { fields: ['TenThuoc'] },
        { fields: ['NhomThuoc'] },
        { fields: ['TrangThai'] },
      ],
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
