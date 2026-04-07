// /**
//  * ChiTietYeuCauDichVu Model - Bảng Chi Tiết Yêu Cầu Dịch Vụ
//  * Chi tiết các dịch vụ trong yêu cầu
//  */
// module.exports = (sequelize, DataTypes) => {
//   const ChiTietYeuCauDichVu = sequelize.define('ChiTietYeuCauDichVu', {
//     Id: {
//       type: DataTypes.UUID,
//       defaultValue: DataTypes.UUIDV4,
//       primaryKey: true,
//       field: 'Id'
//     },
//     MaYeuCau: {
//       type: DataTypes.UUID,
//       allowNull: false,
//       field: 'MaYeuCau',
//       references: {
//         model: 'YeuCauDichVu',
//         key: 'Id'
//       }
//     },
//     MaDichVu: {
//       type: DataTypes.UUID,
//       allowNull: false,
//       field: 'MaDichVu',
//       references: {
//         model: 'DichVuCanLamSang',
//         key: 'Id'
//       }
//     },
//     DonGia: {
//       type: DataTypes.DECIMAL(18, 2),
//       field: 'DonGia'
//     },
//     SoLuong: {
//       type: DataTypes.INTEGER,
//       field: 'SoLuong'
//     }
//   }, {
//     tableName: 'ChiTietYeuCauDichVu',
//     timestamps: false,
//     indexes: [
//       { fields: ['MaYeuCau'] },
//       { fields: ['MaDichVu'] }
//     ]
//   });

//   ChiTietYeuCauDichVu.associate = (models) => {
//     // Chi tiết yêu cầu thuộc về yêu cầu dịch vụ
//     ChiTietYeuCauDichVu.belongsTo(models.YeuCauDichVu, {
//       foreignKey: 'MaYeuCau',
//       as: 'YeuCauDichVu',
//       onDelete: 'CASCADE'
//     });

//     // Chi tiết yêu cầu có dịch vụ
//     ChiTietYeuCauDichVu.belongsTo(models.DichVuCanLamSang, {
//       foreignKey: 'MaDichVu',
//       as: 'DichVuCanLamSang'
//     });
//   };

//   return ChiTietYeuCauDichVu;
// };
