/**
 * Password Reset OTP model
 * Stores hashed OTP and short-lived reset session metadata.
 */
import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const PasswordResetOtp = sequelize.define(
    'PasswordResetOtp',
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
        field: 'Id',
      },
      userId: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'UserId',
      },
      identifier: {
        type: DataTypes.STRING(120),
        allowNull: false,
        field: 'Identifier',
      },
      channel: {
        type: DataTypes.STRING(20),
        allowNull: false,
        field: 'Channel',
      },
      destination: {
        type: DataTypes.STRING(120),
        allowNull: false,
        field: 'Destination',
      },
      otpHash: {
        type: DataTypes.STRING(128),
        allowNull: false,
        field: 'OtpHash',
      },
      resetTokenHash: {
        type: DataTypes.STRING(128),
        allowNull: true,
        field: 'ResetTokenHash',
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'ExpiresAt',
      },
      resetTokenExpiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'ResetTokenExpiresAt',
      },
      verifiedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'VerifiedAt',
      },
      consumedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'ConsumedAt',
      },
      attemptCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'AttemptCount',
      },
      sendCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        field: 'SendCount',
      },
      lastSentAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'LastSentAt',
      },
      ipAddress: {
        type: DataTypes.STRING(45),
        allowNull: true,
        field: 'IpAddress',
      },
      userAgent: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'UserAgent',
      },
    },
    {
      tableName: 'PasswordResetOtps',
      timestamps: true,
      paranoid: false,
      createdAt: 'CreatedAt',
      updatedAt: 'UpdatedAt',
      indexes: [
        { fields: ['UserId'] },
        { fields: ['Identifier'] },
        { fields: ['Channel'] },
        { fields: ['ExpiresAt'] },
        { fields: ['ConsumedAt'] },
      ],
    }
  );

  PasswordResetOtp.associate = (models) => {
    if (models && models.User) {
      PasswordResetOtp.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    }
  };

  return PasswordResetOtp;
};
