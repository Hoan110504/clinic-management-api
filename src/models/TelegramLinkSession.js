/**
 * Telegram Link Session model
 * Stores the one-time phone -> Telegram chat_id association used during registration.
 */
import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const TelegramLinkSession = sequelize.define(
    'TelegramLinkSession',
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
        field: 'Id',
      },
      phone: {
        type: DataTypes.STRING(15),
        allowNull: false,
        unique: true,
        field: 'Phone',
      },
      telegramChatId: {
        type: DataTypes.STRING(64),
        allowNull: false,
        field: 'TelegramChatId',
      },
      startParam: {
        type: DataTypes.STRING(120),
        allowNull: true,
        field: 'StartParam',
      },
      linkedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'LinkedAt',
      },
      consumedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'ConsumedAt',
      },
    },
    {
      tableName: 'TelegramLinkSessions',
      timestamps: true,
      paranoid: false,
      createdAt: 'CreatedAt',
      updatedAt: 'UpdatedAt',
      indexes: [
        { fields: ['Phone'] },
        { fields: ['TelegramChatId'] },
        { fields: ['ConsumedAt'] },
      ],
    }
  );

  return TelegramLinkSession;
};
