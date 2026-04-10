/**
 * LabOrderItem Model
 * Each clinical service inside a LabOrder
 */
import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const LabOrderItem = sequelize.define('LabOrderItem', {
    LabOrderItemID: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
      field: 'LabOrderItemID'
    },

    LabOrderID: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'LabOrderID',
      references: {
        model: 'LabOrders',
        key: 'LabOrderID'
      }
    },

    ServiceID: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'ServiceID',
      references: {
        model: 'LabServices',
        key: 'ServiceID'
      }
    },

    RoomID: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: 'RoomID',
      references: {
        model: 'Rooms',
        key: 'RoomID'
      }
    },

    Status: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 0,
      field: 'Status'
    },

    Priority: {
      type: DataTypes.TINYINT,
      allowNull: false,
      defaultValue: 0,
      field: 'Priority'
    },

    Note: {
      type: DataTypes.STRING(500),
      allowNull: true,
      field: 'Note'
    },

    CreatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'CreatedAt'
    }

  }, {
    tableName: 'LabOrderItems',
    schema: 'dbo',
    timestamps: false,
    indexes: [
      { fields: ['LabOrderID'] },
      { fields: ['ServiceID'] },
      { fields: ['RoomID'] },
      { fields: ['Status'] }
    ]
  });

  // Enum trạng thái thực hiện CLS
  LabOrderItem.STATUS = {
    ASSIGNED: 0,       // Đã chỉ định / Lưu tạm
    IN_PROGRESS: 1,    // Đang thực hiện
    COMPLETED: 2,      // Đã có kết quả / Đã hoàn thành
    CANCELLED: 3       // Đã hủy
  };

  LabOrderItem.PRIORITY = {
    NORMAL: 0,
    PRIORITY: 1,
    URGENT: 2
  };

  LabOrderItem.associate = (models) => {

    if (models.LabOrder) {
      LabOrderItem.belongsTo(models.LabOrder, {
        foreignKey: 'LabOrderID',
        as: 'LabOrder'
      });
    }

    if (models.LabService) {
      LabOrderItem.belongsTo(models.LabService, {
        foreignKey: 'ServiceID',
        as: 'Service'
      });
    }

    if (models.Room) {
      LabOrderItem.belongsTo(models.Room, {
        foreignKey: 'RoomID',
        as: 'Room'
      });
    }

    // LabResults table in current schema links by (ExaminationID, ServiceID),
    // not by LabOrderItemID, so we intentionally do not define hasOne here.
  };

  return LabOrderItem;
};