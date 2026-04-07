// /**
//  * DichVuCanLamSang Model - Bảng Dịch Vụ Cận Lâm Sàng
//  * Danh mục các dịch vụ xét nghiệm, chẩn đoán hình ảnh
//  */
// module.exports = (sequelize, DataTypes) => {
//   const DichVuCanLamSang = sequelize.define('DichVuCanLamSang', {
//     Id: {
//       type: DataTypes.UUID,
//       defaultValue: DataTypes.UUIDV4,
//       primaryKey: true,
//       field: 'Id'
//     },
//     TenDichVu: {
//       type: DataTypes.STRING(150),
//       allowNull: false,
//       field: 'TenDichVu'
//     },
//     MoTa: {
//       type: DataTypes.TEXT,
//       field: 'MoTa'
//     },
//     DonGia: {
//       type: DataTypes.DECIMAL(18, 2),
//       field: 'DonGia'
//     },
//     TrangThai: {
//       type: DataTypes.BOOLEAN,
//       defaultValue: true,
//       field: 'TrangThai'
//     }
//   }, {
//     tableName: 'DichVuCanLamSang',
//     timestamps: false
//   });

//   DichVuCanLamSang.associate = (models) => {
//     // Dịch vụ có nhiều chi tiết yêu cầu
//     DichVuCanLamSang.hasMany(models.ChiTietYeuCauDichVu, {
//       foreignKey: 'MaDichVu',
//       as: 'ChiTietYeuCau'
//     });
//   };

//   return DichVuCanLamSang;
// };
