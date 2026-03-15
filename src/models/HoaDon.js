/**
 * HoaDon Model - Bảng Hóa Đơn
 * Quản lý hóa đơn thanh toán
 */
module.exports = (sequelize, DataTypes) => {
  const HoaDon = sequelize.define('HoaDon', {
    Id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      field: 'Id'
    },
    MaBenhNhan: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'MaBenhNhan',
      references: {
        model: 'BenhNhan',
        key: 'Id'
      }
    },
    MaHoSoKham: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'MaHoSoKham',
      references: {
        model: 'HoSoKham',
        key: 'Id'
      }
    },
    TongTien: {
      type: DataTypes.DECIMAL(18, 2),
      field: 'TongTien'
    },
    GiamGia: {
      type: DataTypes.DECIMAL(18, 2),
      field: 'GiamGia'
    },
    ThanhTien: {
      type: DataTypes.DECIMAL(18, 2),
      field: 'ThanhTien'
    },
    TrangThai: {
      type: DataTypes.TINYINT,
      field: 'TrangThai'
    },
    NgayTao: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'NgayTao'
    }
  }, {
    tableName: 'HoaDon',
    timestamps: false,
    indexes: [
      { fields: ['MaBenhNhan'] },
      { fields: ['MaHoSoKham'] },
      { fields: ['TrangThai'] }
    ]
  });

  // Enum cho TrangThai
  HoaDon.TRANG_THAI = {
    CHUA_THANH_TOAN: 0,
    DA_THANH_TOAN: 1,
    DA_HUY: 2
  };

  HoaDon.associate = (models) => {
    // Hóa đơn thuộc về bệnh nhân
    if (models && models.BenhNhan) {
      HoaDon.belongsTo(models.BenhNhan, {
        foreignKey: 'MaBenhNhan',
        as: 'BenhNhan'
      });
    }

    // Hóa đơn thuộc về hồ sơ khám
    if (models && models.HoSoKham) {
      HoaDon.belongsTo(models.HoSoKham, {
        foreignKey: 'MaHoSoKham',
        as: 'HoSoKham'
      });
    }

    // Hóa đơn có nhiều chi tiết
    if (models && models.ChiTietHoaDon) {
      HoaDon.hasMany(models.ChiTietHoaDon, {
        foreignKey: 'MaHoaDon',
        as: 'ChiTietHoaDon'
      });
    }
  };

  return HoaDon;
};
