/**
 * CanLamSang Model - Bảng Cận Lâm Sàng
 * Kết quả xét nghiệm, chẩn đoán hình ảnh
 */
module.exports = (sequelize, DataTypes) => {
  const CanLamSang = sequelize.define('CanLamSang', {
    Id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      field: 'Id'
    },
    MaYeuCau: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'MaYeuCau',
      references: {
        model: 'YeuCauDichVu',
        key: 'Id'
      }
    },
    TenXetNghiem: {
      type: DataTypes.STRING(150),
      field: 'TenXetNghiem'
    },
    KetQua: {
      type: DataTypes.TEXT,
      field: 'KetQua'
    },
    GiaTriThamChieu: {
      type: DataTypes.STRING(255),
      field: 'GiaTriThamChieu'
    },
    TrangThai: {
      type: DataTypes.TINYINT,
      field: 'TrangThai'
    },
    NgayCoKetQua: {
      type: DataTypes.DATE,
      field: 'NgayCoKetQua'
    },
    NguoiXacNhanId: {
      type: DataTypes.UUID,
      field: 'NguoiXacNhanId',
      references: {
        model: 'NguoiDung',
        key: 'Id'
      }
    }
  }, {
    tableName: 'CanLamSang',
    timestamps: false,
    indexes: [
      { fields: ['MaYeuCau'] },
      { fields: ['TrangThai'] }
    ]
  });

  // Enum cho TrangThai
  CanLamSang.TRANG_THAI = {
    CHO_KET_QUA: 0,
    CO_KET_QUA: 1,
    DA_XAC_NHAN: 2
  };

  CanLamSang.associate = (models) => {
    // Cận lâm sàng thuộc về yêu cầu dịch vụ
    CanLamSang.belongsTo(models.YeuCauDichVu, {
      foreignKey: 'MaYeuCau',
      as: 'YeuCauDichVu'
    });

    // Cận lâm sàng được xác nhận bởi người dùng
    CanLamSang.belongsTo(models.NguoiDung, {
      foreignKey: 'NguoiXacNhanId',
      as: 'NguoiXacNhan'
    });
  };

  return CanLamSang;
};
