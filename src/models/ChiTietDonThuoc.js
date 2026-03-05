/**
 * ChiTietDonThuoc Model - Bảng Chi Tiết Đơn Thuốc
 * Chi tiết các thuốc trong đơn
 */
module.exports = (sequelize, DataTypes) => {
  const ChiTietDonThuoc = sequelize.define('ChiTietDonThuoc', {
    Id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      field: 'Id'
    },
    MaDonThuoc: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'MaDonThuoc',
      references: {
        model: 'DonThuoc',
        key: 'Id'
      }
    },
    MaThuoc: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'MaThuoc',
      references: {
        model: 'Thuoc',
        key: 'Id'
      }
    },
    SoLuong: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'SoLuong'
    },
    DonGia: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: false,
      field: 'DonGia'
    },
    LieuDung: {
      type: DataTypes.STRING(255),
      field: 'LieuDung'
    },
    CachDung: {
      type: DataTypes.STRING(255),
      field: 'CachDung'
    }
  }, {
    tableName: 'ChiTietDonThuoc',
    timestamps: false,
    indexes: [
      { fields: ['MaDonThuoc'] },
      { fields: ['MaThuoc'] }
    ]
  });

  ChiTietDonThuoc.associate = (models) => {
    // Chi tiết đơn thuốc thuộc về đơn thuốc
    ChiTietDonThuoc.belongsTo(models.DonThuoc, {
      foreignKey: 'MaDonThuoc',
      as: 'DonThuoc',
      onDelete: 'CASCADE'
    });

    // Chi tiết đơn thuốc có thuốc
    ChiTietDonThuoc.belongsTo(models.Thuoc, {
      foreignKey: 'MaThuoc',
      as: 'Thuoc'
    });
  };

  return ChiTietDonThuoc;
};
