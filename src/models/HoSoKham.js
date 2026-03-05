/**
 * HoSoKham Model - Bảng Hồ Sơ Khám
 * Quản lý hồ sơ khám bệnh
 */
module.exports = (sequelize, DataTypes) => {
  const HoSoKham = sequelize.define('HoSoKham', {
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
    MaLichHen: {
      type: DataTypes.UUID,
      unique: true,
      field: 'MaLichHen',
      references: {
        model: 'LichHen',
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
    ThoiGianBatDau: {
      type: DataTypes.DATE,
      field: 'ThoiGianBatDau'
    },
    ThoiGianHoanThanh: {
      type: DataTypes.DATE,
      field: 'ThoiGianHoanThanh'
    },
    MucDichKham: {
      type: DataTypes.STRING(255),
      field: 'MucDichKham'
    },
    TrieuChung: {
      type: DataTypes.TEXT,
      field: 'TrieuChung'
    },
    ChanDoan: {
      type: DataTypes.TEXT,
      field: 'ChanDoan'
    },
    HuongDieuTri: {
      type: DataTypes.TEXT,
      field: 'HuongDieuTri'
    },
    HenTaiKham: {
      type: DataTypes.DATE,
      field: 'HenTaiKham'
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
    tableName: 'HoSoKham',
    timestamps: false,
    indexes: [
      { fields: ['MaBenhNhan'] },
      { fields: ['MaBacSi'] },
      { fields: ['TrangThai'] }
    ]
  });

  // Enum cho TrangThai
  HoSoKham.TRANG_THAI = {
    CHO_KHAM: 0,
    DANG_KHAM: 1,
    HOAN_THANH: 2
  };

  HoSoKham.associate = (models) => {
    // Hồ sơ khám thuộc về bệnh nhân
    HoSoKham.belongsTo(models.BenhNhan, {
      foreignKey: 'MaBenhNhan',
      as: 'BenhNhan'
    });

    // Hồ sơ khám thuộc về lịch hẹn
    HoSoKham.belongsTo(models.LichHen, {
      foreignKey: 'MaLichHen',
      as: 'LichHen'
    });

    // Hồ sơ khám có bác sĩ khám
    HoSoKham.belongsTo(models.NguoiDung, {
      foreignKey: 'MaBacSi',
      as: 'BacSi'
    });

    // Hồ sơ khám có nhiều chỉ số sinh tồn
    HoSoKham.hasMany(models.ChiSoSinhTon, {
      foreignKey: 'MaHoSoKham',
      as: 'ChiSoSinhTon'
    });

    // Hồ sơ khám có một đơn thuốc
    HoSoKham.hasOne(models.DonThuoc, {
      foreignKey: 'MaHoSoKham',
      as: 'DonThuoc'
    });

    // Hồ sơ khám có nhiều yêu cầu dịch vụ
    HoSoKham.hasMany(models.YeuCauDichVu, {
      foreignKey: 'MaHoSoKham',
      as: 'YeuCauDichVu'
    });

    // Hồ sơ khám có một hóa đơn
    HoSoKham.hasOne(models.HoaDon, {
      foreignKey: 'MaHoSoKham',
      as: 'HoaDon'
    });
  };

  return HoSoKham;
};
