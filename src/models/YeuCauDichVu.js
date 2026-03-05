/**
 * YeuCauDichVu Model - Bảng Yêu Cầu Dịch Vụ
 * Quản lý yêu cầu dịch vụ cận lâm sàng
 */
module.exports = (sequelize, DataTypes) => {
  const YeuCauDichVu = sequelize.define('YeuCauDichVu', {
    Id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      field: 'Id'
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
    MaBenhNhan: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'MaBenhNhan',
      references: {
        model: 'BenhNhan',
        key: 'Id'
      }
    },
    NguoiChiDinhId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'NguoiChiDinhId',
      references: {
        model: 'NguoiDung',
        key: 'Id'
      }
    },
    TrangThai: {
      type: DataTypes.TINYINT,
      field: 'TrangThai'
    },
    NgayChiDinh: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'NgayChiDinh'
    },
    GhiChuBacSi: {
      type: DataTypes.TEXT,
      field: 'GhiChuBacSi'
    }
  }, {
    tableName: 'YeuCauDichVu',
    timestamps: false,
    indexes: [
      { fields: ['MaHoSoKham'] },
      { fields: ['MaBenhNhan'] },
      { fields: ['TrangThai'] }
    ]
  });

  // Enum cho TrangThai
  YeuCauDichVu.TRANG_THAI = {
    CHO_THUC_HIEN: 0,
    DANG_THUC_HIEN: 1,
    HOAN_THANH: 2,
    DA_HUY: 3
  };

  YeuCauDichVu.associate = (models) => {
    // Yêu cầu thuộc về hồ sơ khám
    YeuCauDichVu.belongsTo(models.HoSoKham, {
      foreignKey: 'MaHoSoKham',
      as: 'HoSoKham'
    });

    // Yêu cầu thuộc về bệnh nhân
    YeuCauDichVu.belongsTo(models.BenhNhan, {
      foreignKey: 'MaBenhNhan',
      as: 'BenhNhan'
    });

    // Yêu cầu được chỉ định bởi người dùng
    YeuCauDichVu.belongsTo(models.NguoiDung, {
      foreignKey: 'NguoiChiDinhId',
      as: 'NguoiChiDinh'
    });

    // Yêu cầu có nhiều chi tiết dịch vụ
    YeuCauDichVu.hasMany(models.ChiTietYeuCauDichVu, {
      foreignKey: 'MaYeuCau',
      as: 'ChiTietYeuCau'
    });

    // Yêu cầu có nhiều kết quả cận lâm sàng
    YeuCauDichVu.hasMany(models.CanLamSang, {
      foreignKey: 'MaYeuCau',
      as: 'KetQuaCanLamSang'
    });
  };

  return YeuCauDichVu;
};
