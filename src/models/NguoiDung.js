/**
 * NguoiDung Model - Bảng Người Dùng
 * Quản lý tất cả người dùng trong hệ thống
 */
module.exports = (sequelize, DataTypes) => {
  const NguoiDung = sequelize.define('NguoiDung', {
    Id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      field: 'Id'
    },
    TenDangNhap: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
      field: 'TenDangNhap'
    },
    Email: {
      type: DataTypes.STRING(100),
      allowNull: true,
      // removed unique constraint to allow NULL emails
      validate: {
        isEmail: {
          args: true,
          msg: 'Email không hợp lệ'
        }
      },
      field: 'Email'
    },
    MatKhau: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'MatKhau'
    },
    HoTen: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'HoTen'
    },
    VaiTro: {
      type: DataTypes.TINYINT,
      allowNull: false,
      validate: {
        isIn: [[1, 2, 3, 4, 5]] // 1:Admin, 2:Bác sĩ, 3:Lễ tân, 4:Dược sĩ, 5:Bệnh nhân
      },
      field: 'VaiTro'
    },
    SoDienThoai: {
      type: DataTypes.STRING(15),
      field: 'SoDienThoai'
    },
    NgaySinh: {
      type: DataTypes.DATEONLY,
      field: 'NgaySinh'
    },
    GioiTinh: {
      type: DataTypes.TINYINT,
      validate: {
        isIn: [[0, 1, 2]] // 0:Khác, 1:Nam, 2:Nữ
      },
      field: 'GioiTinh'
    },
    DiaChi: {
      type: DataTypes.STRING(255),
      field: 'DiaChi'
    },
    CCCD: {
      type: DataTypes.STRING(20),
      unique: true,
      field: 'CCCD'
    },
    TrangThaiHoatDong: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: 'TrangThaiHoatDong'
    },
    NgayTao: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'NgayTao'
    },
    NgayCapNhat: {
      type: DataTypes.DATE,
      field: 'NgayCapNhat'
    },
    NgayXoa: {
      type: DataTypes.DATE,
      field: 'NgayXoa'
    }
  }, {
    tableName: 'NguoiDung',
    timestamps: false,
    indexes: [
      { fields: ['VaiTro'] },
      { fields: ['TrangThaiHoatDong'] },
      { fields: ['Email'] }
    ]
  });

  // Enum cho VaiTro
  NguoiDung.VAI_TRO = {
    ADMIN: 1,
    BAC_SI: 2,
    LE_TAN: 3,
    DUOC_SI: 4,
    BENH_NHAN: 5
  };

  // Enum cho GioiTinh
  NguoiDung.GIOI_TINH = {
    KHAC: 0,
    NAM: 1,
    NU: 2
  };

  NguoiDung.associate = (models) => {
    // Một người dùng có thể là một bệnh nhân
    NguoiDung.hasOne(models.BenhNhan, {
      foreignKey: 'MaNguoiDung',
      as: 'BenhNhan'
    });

    // Bác sĩ có nhiều lịch hẹn được ưu tiên
    NguoiDung.hasMany(models.LichHen, {
      foreignKey: 'BacSiUuTienId',
      as: 'LichHenUuTien'
    });

    // Bác sĩ có nhiều lịch hẹn được phân công
    NguoiDung.hasMany(models.LichHen, {
      foreignKey: 'BacSiDuocPhanId',
      as: 'LichHenDuocPhan'
    });

    // Bác sĩ có nhiều hồ sơ khám
    NguoiDung.hasMany(models.HoSoKham, {
      foreignKey: 'MaBacSi',
      as: 'HoSoKhamBacSi'
    });

    // Bác sĩ kê đơn thuốc
    NguoiDung.hasMany(models.DonThuoc, {
      foreignKey: 'MaBacSi',
      as: 'DonThuocKe'
    });

    // Dược sĩ phát thuốc
    NguoiDung.hasMany(models.DonThuoc, {
      foreignKey: 'NguoiPhatThuocId',
      as: 'DonThuocPhat'
    });

    // Người dùng chỉ định dịch vụ
    NguoiDung.hasMany(models.YeuCauDichVu, {
      foreignKey: 'NguoiChiDinhId',
      as: 'YeuCauDichVuChiDinh'
    });

    // Người xác nhận cận lâm sàng
    NguoiDung.hasMany(models.CanLamSang, {
      foreignKey: 'NguoiXacNhanId',
      as: 'CanLamSangXacNhan'
    });

    // Người thực hiện giao dịch kho
    NguoiDung.hasMany(models.GiaoDichKho, {
      foreignKey: 'NguoiThucHienId',
      as: 'GiaoDichKho'
    });
  };

  return NguoiDung;
};
