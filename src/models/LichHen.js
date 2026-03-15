/**
 * LichHen Model - Bảng Lịch Hẹn
 * Quản lý lịch hẹn khám bệnh
 */
module.exports = (sequelize, DataTypes) => {
  const LichHen = sequelize.define('LichHen', {
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
    NgayHen: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'NgayHen'
    },
    ThoiLuongDuKien: {
      type: DataTypes.INTEGER,
      field: 'ThoiLuongDuKien'
    },
    LoaiKham: {
      type: DataTypes.STRING(100),
      field: 'LoaiKham'
    },
    TrieuChung: {
      type: DataTypes.TEXT,
      field: 'TrieuChung'
    },
    BacSiUuTienId: {
      type: DataTypes.UUID,
      field: 'BacSiUuTienId',
      references: {
        model: 'NguoiDung',
        key: 'Id'
      }
    },
    BacSiDuocPhanId: {
      type: DataTypes.UUID,
      field: 'BacSiDuocPhanId',
      references: {
        model: 'NguoiDung',
        key: 'Id'
      }
    },
    TrangThai: {
      type: DataTypes.TINYINT,
      defaultValue: 0,
      field: 'TrangThai'
    },
    ThoiGianXacNhan: {
      type: DataTypes.DATE,
      field: 'ThoiGianXacNhan'
    },
    ThoiGianHuy: {
      type: DataTypes.DATE,
      field: 'ThoiGianHuy'
    },
    LyDoHuy: {
      type: DataTypes.STRING(255),
      field: 'LyDoHuy'
    },
    GhiChuBenhNhan: {
      type: DataTypes.TEXT,
      field: 'GhiChuBenhNhan'
    },
    GhiChuNoiBo: {
      type: DataTypes.TEXT,
      field: 'GhiChuNoiBo'
    },
    NgayTao: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'NgayTao'
    }
  }, {
    tableName: 'LichHen',
    timestamps: false,
    indexes: [
      { fields: ['MaBenhNhan'] },
      { fields: ['NgayHen'] },
      { fields: ['TrangThai'] },
      { 
        unique: true,
        fields: ['BacSiDuocPhanId', 'NgayHen'],
        name: 'UQ_LichHen_BacSi_NgayHen'
      }
    ]
  });

  // Enum cho TrangThai
  LichHen.TRANG_THAI = {
    CHO_XAC_NHAN: 0,
    DA_XAC_NHAN: 1,
    DANG_KHAM: 2,
    HOAN_THANH: 3,
    DA_HUY: 4
  };

  LichHen.associate = (models) => {
    // Lịch hẹn thuộc về bệnh nhân
    if (models && models.BenhNhan) {
      LichHen.belongsTo(models.BenhNhan, {
        foreignKey: 'MaBenhNhan',
        as: 'BenhNhan'
      });
    }

    // Lịch hẹn có bác sĩ ưu tiên
    if (models && models.NguoiDung) {
      LichHen.belongsTo(models.NguoiDung, {
        foreignKey: 'BacSiUuTienId',
        as: 'BacSiUuTien'
      });
    }

    // Lịch hẹn có bác sĩ được phân công
    if (models && models.NguoiDung) {
      LichHen.belongsTo(models.NguoiDung, {
        foreignKey: 'BacSiDuocPhanId',
        as: 'BacSiDuocPhan'
      });
    }

    // Lịch hẹn có một hồ sơ khám
    if (models && models.HoSoKham) {
      LichHen.hasOne(models.HoSoKham, {
        foreignKey: 'MaLichHen',
        as: 'HoSoKham'
      });
    }
  };

  return LichHen;
};
