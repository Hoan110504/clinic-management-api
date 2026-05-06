/**
 * AiChatLog Model
 * Audit trail for AI Medical Chatbot interactions
 */
import { DataTypes } from 'sequelize';

export default (sequelize) => {
  const AiChatLog = sequelize.define(
    'AiChatLog',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        field: 'user_id',
      },
      user_role: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'user_role',
        comment: 'User role: 1=admin, 2=doctor, 3=receptionist, 4=pharmacist, 5=patient, 6=labtech',
      },
      user_message: {
        type: DataTypes.STRING(500),
        allowNull: false,
        field: 'user_message',
        comment: 'User input message to AI chatbot',
      },
      ai_response: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: 'ai_response',
        comment: 'AI generated response',
      },
      selected_query_ids: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'selected_query_ids',
        comment: 'JSON array of query IDs selected by AI in Pass 1',
        get() {
          const raw = this.getDataValue('selected_query_ids');
          return raw ? JSON.parse(raw) : [];
        },
        set(value) {
          this.setDataValue('selected_query_ids', JSON.stringify(value));
        },
      },
      timestamp: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'timestamp',
        comment: 'Timestamp of interaction',
      },
      ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true,
        field: 'ip_address',
        comment: 'Client IP address (supports IPv4 and IPv6)',
      },
      session_id: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'session_id',
        comment: 'User session identifier',
      },
      response_time_ms: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'response_time_ms',
        comment: 'AI response time in milliseconds',
      },
      error_message: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'error_message',
        comment: 'Error message if request failed',
      },
      is_blocked: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_blocked',
        comment: 'Flag for blocked requests (e.g., prompt injection detected)',
      },
      is_rate_limited: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_rate_limited',
        comment: 'Flag for rate-limited requests',
      },
    },
    {
      tableName: 'AiChatLog',
      timestamps: false, // Using custom timestamp field
      indexes: [
        { fields: ['user_id'], name: 'idx_aichatlog_user' },
        { fields: ['timestamp'], name: 'idx_aichatlog_timestamp' },
      ],
    }
  );

  // Associations
  AiChatLog.associate = (models) => {
    if (models && models.User) {
      AiChatLog.belongsTo(models.User, {
        foreignKey: 'user_id',
        as: 'user',
      });
    }
  };

  return AiChatLog;
};
