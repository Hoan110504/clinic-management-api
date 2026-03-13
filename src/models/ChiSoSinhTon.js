/**
 * ChiSoSinhTon Model - Bảng Chỉ Số Sinh Tồn
 * Theo dõi các chỉ số sinh tồn của bệnh nhân
 */
module.exports = (sequelize, DataTypes) => {
  const ChiSoSinhTon = sequelize.define('ChiSoSinhTon', {
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
    HuyetAp: {
      type: DataTypes.STRING(20),
      field: 'HuyetAp'
    },
    NhipTim: {
      type: DataTypes.INTEGER,
      field: 'NhipTim'
    },
    NhietDo: {
      type: DataTypes.DECIMAL(4, 1),
      field: 'NhietDo'
    },
    CanNang: {
      type: DataTypes.DECIMAL(5, 2),
      field: 'CanNang'
    },
    ChieuCao: {
      type: DataTypes.DECIMAL(5, 2),
      field: 'ChieuCao'
    },
    SpO2: {
      type: DataTypes.INTEGER,
      field: 'SpO2'
    },
    ThoiDiemDo: {
      type: DataTypes.DATE,
      field: 'ThoiDiemDo'
    }
  }, {
    tableName: 'ChiSoSinhTon',
    timestamps: false,
    indexes: [
      { fields: ['MaHoSoKham'] }
    ]
  });

  ChiSoSinhTon.associate = (models) => {
    // Chỉ số sinh tồn thuộc về hồ sơ khám
    ChiSoSinhTon.belongsTo(models.HoSoKham, {
      foreignKey: 'MaHoSoKham',
      as: 'HoSoKham'
    });
  };

  return ChiSoSinhTon;
};
