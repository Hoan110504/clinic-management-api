/**
 * QuanLyLoThuoc Model - Bảng Quản Lý Lô Thuốc
 * Quản lý các lô thuốc nhập kho
 */
module.exports = (sequelize, DataTypes) => {
  const QuanLyLoThuoc = sequelize.define('QuanLyLoThuoc', {
    Id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      field: 'Id'
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
    SoLo: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: 'SoLo'
    },
    HanSuDung: {
      type: DataTypes.DATEONLY,
      field: 'HanSuDung'
    },
    NgaySanXuat: {
      type: DataTypes.DATEONLY,
      field: 'NgaySanXuat'
    },
    SoLuongTon: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'SoLuongTon'
    },
    GiaNhap: {
      type: DataTypes.DECIMAL(18, 2),
      field: 'GiaNhap'
    },
    TrangThai: {
      type: DataTypes.TINYINT,
      defaultValue: 1,
      field: 'TrangThai'
    }
  }, {
    tableName: 'QuanLyLoThuoc',
    timestamps: false,
    indexes: [
      { fields: ['MaThuoc'] },
      { fields: ['HanSuDung'] },
      { fields: ['TrangThai'] }
    ]
  });

  // Enum cho TrangThai
  QuanLyLoThuoc.TRANG_THAI = {
    HET_HANG: 0,
    CON_HANG: 1,
    HET_HAN: 2
  };

  QuanLyLoThuoc.associate = (models) => {
    // Lô thuốc thuộc về thuốc
    QuanLyLoThuoc.belongsTo(models.Thuoc, {
      foreignKey: 'MaThuoc',
      as: 'Thuoc'
    });

    // Lô thuốc có nhiều giao dịch kho
    QuanLyLoThuoc.hasMany(models.GiaoDichKho, {
      foreignKey: 'MaLoThuoc',
      as: 'GiaoDichKho'
    });
  };

  return QuanLyLoThuoc;
};
