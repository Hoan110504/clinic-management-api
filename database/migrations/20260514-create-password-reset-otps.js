/**
 * Create password reset OTP table
 */

export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('password_reset_otps', {
    id: {
      type: Sequelize.BIGINT,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    user_id: {
      type: Sequelize.BIGINT,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    },
    identifier: {
      type: Sequelize.STRING(120),
      allowNull: false,
    },
    channel: {
      type: Sequelize.STRING(20),
      allowNull: false,
    },
    destination: {
      type: Sequelize.STRING(120),
      allowNull: false,
    },
    otp_hash: {
      type: Sequelize.STRING(128),
      allowNull: false,
    },
    reset_token_hash: {
      type: Sequelize.STRING(128),
      allowNull: true,
    },
    expires_at: {
      type: Sequelize.DATE,
      allowNull: false,
    },
    reset_token_expires_at: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    verified_at: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    consumed_at: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    attempt_count: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    send_count: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    last_sent_at: {
      type: Sequelize.DATE,
      allowNull: false,
    },
    ip_address: {
      type: Sequelize.STRING(45),
      allowNull: true,
    },
    user_agent: {
      type: Sequelize.STRING(255),
      allowNull: true,
    },
    created_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('GETDATE()'),
    },
    updated_at: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('GETDATE()'),
    },
  });

  await queryInterface.addIndex('password_reset_otps', ['user_id']);
  await queryInterface.addIndex('password_reset_otps', ['identifier']);
  await queryInterface.addIndex('password_reset_otps', ['channel']);
  await queryInterface.addIndex('password_reset_otps', ['expires_at']);
  await queryInterface.addIndex('password_reset_otps', ['consumed_at']);
}

export async function down(queryInterface) {
  await queryInterface.dropTable('password_reset_otps');
}
