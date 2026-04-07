/**
 * ServiceRequestDetail Model - Details of requested clinical services
 */
import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const ServiceRequestDetail = sequelize.define(
    'ServiceRequestDetail',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        field: 'Id',
      },
      serviceRequestId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'ServiceRequestId', // was MaYeuCau
        references: {
          model: 'ServiceRequest', // was YeuCauDichVu
          key: 'Id',
        },
      },
      serviceId: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'ServiceId', // was MaDichVu
        references: {
          model: 'ClinicalService', // was DichVuCanLamSang
          key: 'Id',
        },
      },
      price: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: true,
        field: 'Price', // was DonGia
      },
      quantity: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'Quantity', // was SoLuong
      },
    },
    {
      tableName: 'ServiceRequestDetail',
      timestamps: false,
      indexes: [
        { fields: ['ServiceRequestId'] },
        { fields: ['ServiceId'] },
      ],
    }
  );

  // Associations if needed
  ServiceRequestDetail.associate = (models) => {
    if (models.ServiceRequest) {
      ServiceRequestDetail.belongsTo(models.ServiceRequest, {
        foreignKey: 'serviceRequestId',
        as: 'serviceRequest',
        onDelete: 'CASCADE',
      });
    }
    if (models.ClinicalService) {
      ServiceRequestDetail.belongsTo(models.ClinicalService, {
        foreignKey: 'serviceId',
        as: 'clinicalService',
      });
    }
  };

  return ServiceRequestDetail;
};