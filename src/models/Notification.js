import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const Notification = sequelize.define('Notification', {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
      field: 'NotificationID'
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: 'UserID'
    },
    role: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'TargetRole'
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'Title'
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'Content'
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'Type' // e.g., 'APPOINTMENT_NEW', 'PRESCRIPTION_NEW', etc.
    },
    relatedId: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: 'RelatedID'
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'IsRead'
    },
    createdAt: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      field: 'CreatedAt'
    }
  }, {
    tableName: 'Notifications',
    timestamps: false
  });

  return Notification;
};
