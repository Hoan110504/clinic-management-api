/**
 * ClinicalService Model - Laboratory and Imaging Services
 * Catalog of lab tests and imaging services
 */
import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const ClinicalService = sequelize.define(
    'ClinicalService',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        field: 'Id',
      },
      serviceName: {
        type: DataTypes.STRING(150),
        allowNull: false,
        field: 'ServiceName', // was TenDichVu
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'Description', // was MoTa
      },
      price: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: true,
        field: 'Price', // was DonGia
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'IsActive', // was TrangThai
      },
    },
    {
      tableName: 'ClinicalService',
      timestamps: false,
    }
  );

  ClinicalService.associate = (models) => {
    // One service can have many service request details
    if (models && models.ServiceRequestDetail) {
      ClinicalService.hasMany(models.ServiceRequestDetail, {
        foreignKey: 'serviceId', // was MaDichVu
        as: 'serviceRequestDetails',
      });
    }
  };

  return ClinicalService;
};