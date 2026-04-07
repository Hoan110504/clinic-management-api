/**
 * Invoice Model (maps to legacy `HoaDon` table)
 * Represents invoices for services, prescriptions, or payments
 */
module.exports = (sequelize, DataTypes) => {
  const Invoice = sequelize.define('Invoice', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      field: 'Id'
    },
    patientId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'MaBenhNhan',
      references: {
        model: 'BenhNhan',
        key: 'Id'
      }
    },
    medicalRecordId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'MaHoSoKham',
      references: {
        model: 'HoSoKham',
        key: 'Id'
      }
    },
    totalAmount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true,
      field: 'TongTien'
    },
    discount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true,
      field: 'GiamGia'
    },
    paidAmount: {
      type: DataTypes.DECIMAL(18, 2),
      allowNull: true,
      field: 'ThanhTien'
    },
    status: {
      type: DataTypes.TINYINT,
      allowNull: true,
      field: 'TrangThai'
    },
    issuedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'NgayTao'
    }
  }, {
    tableName: 'HoaDon',
    timestamps: false,
    indexes: [
      { fields: ['MaBenhNhan'] },
      { fields: ['MaHoSoKham'] },
      { fields: ['TrangThai'] }
    ]
  });

  // Enum for status
  Invoice.STATUS = {
    CHUA_THANH_TOAN: 0,
    DA_THANH_TOAN: 1,
    DA_HUY: 2
  };

  Invoice.associate = (models) => {
    if (models.Patient) {
      Invoice.belongsTo(models.Patient, { foreignKey: 'MaBenhNhan', as: 'patient' });
    }
    if (models.MedicalRecord || models.HoSoKham) {
      const MR = models.MedicalRecord || models.HoSoKham;
      Invoice.belongsTo(MR, { foreignKey: 'MaHoSoKham', as: 'medicalRecord' });
    }
  };

  return Invoice;
};