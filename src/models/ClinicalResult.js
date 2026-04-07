/**
 * ClinicalResult Model - Direct DB mapping (all English)
 */
import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const ClinicalResult = sequelize.define(
    'ClinicalResult',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      serviceRequestId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'ServiceRequestId', // was MaYeuCau
      },
      testName: {
        type: DataTypes.STRING(150),
        allowNull: false,
        field: 'TestName', // was TenXetNghiem
      },
      result: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'Result', // was KetQua
      },
      referenceValue: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'ReferenceValue', // was GiaTriThamChieu
      },
      images: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'Images', // was HinhAnh
        get() {
          const raw = this.getDataValue('images');
          if (!raw) return [];
          try {
            return JSON.parse(raw);
          } catch {
            return [raw];
          }
        },
        set(value) {
          this.setDataValue('images', value ? JSON.stringify(value) : null);
        },
      },
      status: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0, // 0 = pending, 1 = completed, 2 = confirmed
        field: 'Status', // was TrangThai
      },
      resultDate: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'ResultDate', // was NgayCoKetQua
      },
      confirmedById: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'ConfirmedById', // was NguoiXacNhanId
      },
      confirmedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'ConfirmedAt', // was NgayXacNhan
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'Notes', // was GhiChu
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'CreatedAt',
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'UpdatedAt',
      },
      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'DeletedAt',
      },
    },
    {
      tableName: 'ClinicalResult',
      timestamps: false,
      paranoid: false,
    }
  );

  return ClinicalResult;
};