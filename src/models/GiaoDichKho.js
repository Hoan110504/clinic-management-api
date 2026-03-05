/**
 * GiaoDichKho Model - Bảng Giao Dịch Kho
 * Quản lý giao dịch nhập/xuất kho thuốc
 */
module.exports = (sequelize, DataTypes) => {
  const GiaoDichKho = sequelize.define('GiaoDichKho', {
    Id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      field: 'Id'
    },
    MaLoThuoc: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'MaLoThuoc',
      references: {
        model: 'QuanLyLoThuoc',
        key: 'Id'
      }
    },
    LoaiGiaoDich: {
      type: DataTypes.TINYINT,
      field: 'LoaiGiaoDich'
    },
    SoLuong: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'SoLuong'
    },
    SoLuongTruoc: {
      type: DataTypes.INTEGER,
      field: 'SoLuongTruoc'
    },
    SoLuongSau: {
      type: DataTypes.INTEGER,
      field: 'SoLuongSau'
    },
    LyDo: {
      type: DataTypes.STRING(255),
      field: 'LyDo'
    },
    LoaiThamChieu: {
      type: DataTypes.TINYINT,
      field: 'LoaiThamChieu'
    },
    MaThamChieu: {
      type: DataTypes.UUID,
      field: 'MaThamChieu'
    },
    NguoiThucHienId: {
      type: DataTypes.UUID,
      field: 'NguoiThucHienId',
      references: {
        model: 'NguoiDung',
        key: 'Id'
      }
    },
    ThoiGianTao: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'ThoiGianTao'
    },
    GhiChu: {
      type: DataTypes.TEXT,
      field: 'GhiChu'
    }
  }, {
    tableName: 'GiaoDichKho',
    timestamps: false,
    indexes: [
      { fields: ['MaLoThuoc'] },
      { fields: ['LoaiGiaoDich'] },
      { fields: ['ThoiGianTao'] }
    ]
  });

  // Enum cho LoaiGiaoDich
  GiaoDichKho.LOAI_GIAO_DICH = {
    NHAP_KHO: 1,
    XUAT_KHO: 2,
    DIEU_CHINH: 3,
    TRA_LAI: 4
  };

  // Enum cho LoaiThamChieu
  GiaoDichKho.LOAI_THAM_CHIEU = {
    DON_THUOC: 1,
    NHAP_KHO: 2,
    DIEU_CHINH: 3
  };

  GiaoDichKho.associate = (models) => {
    // Giao dịch kho thuộc về lô thuốc
    GiaoDichKho.belongsTo(models.QuanLyLoThuoc, {
      foreignKey: 'MaLoThuoc',
      as: 'LoThuoc'
    });

    // Giao dịch được thực hiện bởi người dùng
    GiaoDichKho.belongsTo(models.NguoiDung, {
      foreignKey: 'NguoiThucHienId',
      as: 'NguoiThucHien'
    });
  };

  return GiaoDichKho;
};
