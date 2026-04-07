// /**
//  * ChiTietHoaDon Model - Bảng Chi Tiết Hóa Đơn
//  * Chi tiết các khoản trong hóa đơn
//  */
// module.exports = (sequelize, DataTypes) => {
//   const ChiTietHoaDon = sequelize.define('ChiTietHoaDon', {
//     Id: {
//       type: DataTypes.UUID,
//       defaultValue: DataTypes.UUIDV4,
//       primaryKey: true,
//       field: 'Id'
//     },
//     MaHoaDon: {
//       type: DataTypes.UUID,
//       allowNull: false,
//       field: 'MaHoaDon',
//       references: {
//         model: 'HoaDon',
//         key: 'Id'
//       }
//     },
//     Loai: {
//       type: DataTypes.TINYINT,
//       field: 'Loai'
//     },
//     MaThamChieu: {
//       type: DataTypes.UUID,
//       field: 'MaThamChieu'
//     },
//     SoLuong: {
//       type: DataTypes.INTEGER,
//       field: 'SoLuong'
//     },
//     DonGia: {
//       type: DataTypes.DECIMAL(18, 2),
//       field: 'DonGia'
//     },
//     SoTien: {
//       type: DataTypes.DECIMAL(18, 2),
//       field: 'SoTien'
//     }
//   }, {
//     tableName: 'ChiTietHoaDon',
//     timestamps: false,
//     indexes: [
//       { fields: ['MaHoaDon'] },
//       { fields: ['Loai'] }
//     ]
//   });

//   // Enum cho Loai
//   ChiTietHoaDon.LOAI = {
//     THUOC: 1,
//     DICH_VU: 2,
//     PHI_KHAM: 3
//   };

//   ChiTietHoaDon.associate = (models) => {
//     // Chi tiết hóa đơn thuộc về hóa đơn
//     ChiTietHoaDon.belongsTo(models.HoaDon, {
//       foreignKey: 'MaHoaDon',
//       as: 'HoaDon',
//       onDelete: 'CASCADE'
//     });
//   };

//   return ChiTietHoaDon;
// };
