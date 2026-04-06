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

  // Enum cho TrangThai - 4 statuses for prescription workflow
  DonThuoc.TRANG_THAI = {
    DANG_KE: 0,              // Đang kê - being prescribed by doctor (draft or saved)
    CHO_PHAT_THUOC: 1,       // Chờ phát thuốc - confirmed by doctor, waiting for pharmacist to dispense
    HOAN_THANH: 2,           // Hoàn thành - dispensed by pharmacist
    HUY: 3                    // Hủy - cancelled by doctor or pharmacist
  };

  DonThuoc.associate = (models) => {
    // Đơn thuốc thuộc về hồ sơ khám
    if (models && models.HoSoKham) {
      DonThuoc.belongsTo(models.HoSoKham, {
        foreignKey: 'MaHoSoKham',
        as: 'HoSoKham'
      });
    }

    // Đơn thuốc thuộc về bệnh nhân
    if (models && models.BenhNhan) {
      DonThuoc.belongsTo(models.BenhNhan, {
        foreignKey: 'MaBenhNhan',
        as: 'BenhNhan'
      });
    }

    // Đơn thuốc được kê bởi bác sĩ
    if (models && models.NguoiDung) {
      DonThuoc.belongsTo(models.NguoiDung, {
        foreignKey: 'MaBacSi',
        as: 'BacSi'
      });
    }

    // Đơn thuốc được phát bởi dược sĩ
    if (models && models.NguoiDung) {
      DonThuoc.belongsTo(models.NguoiDung, {
        foreignKey: 'NguoiPhatThuocId',
        as: 'NguoiPhatThuoc'
      });
    }

    // Đơn thuốc có nhiều chi tiết - ưu tiên model mới `PrescriptionItem`,
    // fallback về `ChiTietDonThuoc` để tương thích ngược.
    const DetailModel = (models && (models.PrescriptionItem || models.ChiTietDonThuoc));
    if (DetailModel) {
      DonThuoc.hasMany(DetailModel, {
        foreignKey: 'MaDonThuoc',
        as: 'ChiTietDonThuoc'
      });
    }
  };

  return DonThuoc;
};
