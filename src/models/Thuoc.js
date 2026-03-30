/**
 * Thuoc Model - Bảng Thuốc
 * Quản lý danh mục thuốc
 */
module.exports = (sequelize, DataTypes) => {
  const Thuoc = sequelize.define('Thuoc', {
    Id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
      field: 'Id'
    },
    TenThuoc: {
      type: DataTypes.STRING(150),
      allowNull: false,
      unique: true,
      field: 'TenThuoc'
    },
    DonVi: {
      type: DataTypes.STRING(50),
      field: 'DonVi'
    },
    NhomThuoc: {
      type: DataTypes.STRING(100),
      field: 'NhomThuoc'
    },
    TrangThai: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'TrangThai'
    }
  }, {
    tableName: 'Thuoc',
    timestamps: false,
    indexes: [
      { fields: ['NhomThuoc'] },
      { fields: ['TrangThai'] }
    ]
  });

  Thuoc.associate = (models) => {
    // Thuốc có nhiều lô thuốc
    Thuoc.hasMany(models.QuanLyLoThuoc, {
      foreignKey: 'MaThuoc',
      as: 'LoThuoc'
    });

    // Thuốc có nhiều chi tiết đơn thuốc
    Thuoc.hasMany(models.ChiTietDonThuoc, {
      foreignKey: 'MaThuoc',
      as: 'ChiTietDonThuoc'
    });
  };

  return Thuoc;
};
