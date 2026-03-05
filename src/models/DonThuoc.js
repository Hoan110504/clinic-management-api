/**
 * DonThuoc Model - Bảng Đơn Thuốc
 * Quản lý đơn thuốc được kê
 */
module.exports = (sequelize, DataTypes) => {
  const DonThuoc = sequelize.define('DonThuoc', {
    Id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      field: 'Id'
    },
    MaHoSoKham: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      field: 'MaHoSoKham',
      references: {
        model: 'HoSoKham',
        key: 'Id'
      }
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
    MaBacSi: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'MaBacSi',
      references: {
        model: 'NguoiDung',
        key: 'Id'
      }
    },
    NgayKeDon: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'NgayKeDon'
    },
    ChanDoan: {
      type: DataTypes.TEXT,
      field: 'ChanDoan'
    },
    GhiChu: {
      type: DataTypes.TEXT,
      field: 'GhiChu'
    },
    TrangThai: {
      type: DataTypes.TINYINT,
      field: 'TrangThai'
    },
    ThoiGianPhatThuoc: {
      type: DataTypes.DATE,
      field: 'ThoiGianPhatThuoc'
    },
    NguoiPhatThuocId: {
      type: DataTypes.UUID,
      field: 'NguoiPhatThuocId',
      references: {
        model: 'NguoiDung',
        key: 'Id'
      }
    }
  }, {
    tableName: 'DonThuoc',
    timestamps: false,
    indexes: [
      { fields: ['MaBenhNhan'] },
      { fields: ['MaBacSi'] },
      { fields: ['TrangThai'] }
    ]
  });

  // Enum cho TrangThai
  DonThuoc.TRANG_THAI = {
    CHO_CAP_PHAT: 0,
    DA_CAP_PHAT: 1,
    DA_HUY: 2
  };

  DonThuoc.associate = (models) => {
    // Đơn thuốc thuộc về hồ sơ khám
    DonThuoc.belongsTo(models.HoSoKham, {
      foreignKey: 'MaHoSoKham',
      as: 'HoSoKham'
    });

    // Đơn thuốc thuộc về bệnh nhân
    DonThuoc.belongsTo(models.BenhNhan, {
      foreignKey: 'MaBenhNhan',
      as: 'BenhNhan'
    });

    // Đơn thuốc được kê bởi bác sĩ
    DonThuoc.belongsTo(models.NguoiDung, {
      foreignKey: 'MaBacSi',
      as: 'BacSi'
    });

    // Đơn thuốc được phát bởi dược sĩ
    DonThuoc.belongsTo(models.NguoiDung, {
      foreignKey: 'NguoiPhatThuocId',
      as: 'NguoiPhatThuoc'
    });

    // Đơn thuốc có nhiều chi tiết
    DonThuoc.hasMany(models.ChiTietDonThuoc, {
      foreignKey: 'MaDonThuoc',
      as: 'ChiTietDonThuoc'
    });
  };

  return DonThuoc;
};
