/**
 * LabService Model (CLS services catalog)
 * Maps to dbo.LabServices
 */
import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const LabService = sequelize.define(
    'LabService',
    {
      serviceId: {
        type: DataTypes.BIGINT,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
        field: 'ServiceID',
      },

      serviceName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'ServiceName',
      },

      roomId: {
        type: DataTypes.BIGINT,
        allowNull: true,
        field: 'RoomID',
      },

      price: {
        type: DataTypes.DECIMAL(18, 2),
        allowNull: false,
        field: 'Price',
      },

      serviceType: {
        type: DataTypes.TINYINT,
        allowNull: false,
        field: 'ServiceType',
        comment: '1=Ultrasound, 2=ECG, 3=Lab Test',
      },

      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'IsActive',
      },

      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'CreatedAt',
      },
    },
    {
      tableName: 'LabServices',
      schema: 'dbo',
      timestamps: false,
      indexes: [
        { fields: ['ServiceType'] },
        { fields: ['RoomID'] },
      ],
    }
  );

  LabService.associate = (models) => {
    if (models && models.LabOrderItem) {
      LabService.hasMany(models.LabOrderItem, {
        foreignKey: 'ServiceID',
        as: 'labOrderItems',
      });
    }

    if (models && models.LabResult) {
      LabService.hasMany(models.LabResult, {
        foreignKey: 'ServiceID',
        as: 'labResults',
      });
    }
  };

  return LabService;
};