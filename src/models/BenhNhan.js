// /**
//  * BenhNhan Model - Bảng Bệnh Nhân
//  * Thông tin chi tiết của bệnh nhân
//  */
// module.exports = (sequelize, DataTypes) => {
//   const BenhNhan = sequelize.define('BenhNhan', {
//     Id: {
//       type: DataTypes.UUID,
//       defaultValue: DataTypes.UUIDV4,
//       primaryKey: true,
//       field: 'Id'
//     },
//     MaNguoiDung: {
//       type: DataTypes.UUID,
//       allowNull: false,
//       unique: true,
//       field: 'MaNguoiDung',
//       references: {
//         model: 'NguoiDung',
//         key: 'Id'
//       }
//     },
//     TienSuBenh: {
//       type: DataTypes.TEXT,
//       field: 'TienSuBenh'
//     },
//     DiUng: {
//       type: DataTypes.TEXT,
//       field: 'DiUng'
//     },
//     NguoiLienHeKhanCap: {
//       type: DataTypes.STRING(100),
//       field: 'NguoiLienHeKhanCap'
//     },
//     SDTNguoiLienHe: {
//       type: DataTypes.STRING(15),
//       field: 'SDTNguoiLienHe'
//     },
//     GhiChu: {
//       type: DataTypes.TEXT,
//       field: 'GhiChu'
//     },
//     NgayTao: {
//       type: DataTypes.DATE,
//       defaultValue: DataTypes.NOW,
//       field: 'NgayTao'
//     },
//     NgayCapNhat: {
//       type: DataTypes.DATE,
//       field: 'NgayCapNhat'
//     },
//     NgayXoa: {
//       type: DataTypes.DATE,
//       field: 'NgayXoa'
//     }
//   }, {
//     tableName: 'BenhNhan',
//     timestamps: false
//   });

//   BenhNhan.associate = (models) => {
//     // Bệnh nhân thuộc về một người dùng
//     if (models && models.NguoiDung) {
//       BenhNhan.belongsTo(models.NguoiDung, {
//         foreignKey: 'MaNguoiDung',
//         as: 'NguoiDung',
//         onDelete: 'CASCADE'
//       });
//     }

//     // Bệnh nhân có nhiều lịch hẹn
//     if (models && models.LichHen) {
//       BenhNhan.hasMany(models.LichHen, {
//         foreignKey: 'MaBenhNhan',
//         as: 'LichHen'
//       });
//     }

//     // Bệnh nhân có nhiều hồ sơ khám
//     if (models && models.HoSoKham) {
//       BenhNhan.hasMany(models.HoSoKham, {
//         foreignKey: 'MaBenhNhan',
//         as: 'HoSoKham'
//       });
//     }

//     // Bệnh nhân có nhiều đơn thuốc
//     if (models && models.DonThuoc) {
//       BenhNhan.hasMany(models.DonThuoc, {
//         foreignKey: 'MaBenhNhan',
//         as: 'DonThuoc'
//       });
//     }

//     // Bệnh nhân có nhiều yêu cầu dịch vụ
//     if (models && models.YeuCauDichVu) {
//       BenhNhan.hasMany(models.YeuCauDichVu, {
//         foreignKey: 'MaBenhNhan',
//         as: 'YeuCauDichVu'
//       });
//     }

//     // Bệnh nhân có nhiều hóa đơn
//     if (models && models.HoaDon) {
//       BenhNhan.hasMany(models.HoaDon, {
//         foreignKey: 'MaBenhNhan',
//         as: 'HoaDon'
//       });
//     }
//   };

//   return BenhNhan;
// };
