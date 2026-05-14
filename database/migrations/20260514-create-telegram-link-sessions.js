/**
 * Create telegram link sessions table
 */

export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable('TelegramLinkSessions', {
    Id: {
      type: Sequelize.BIGINT,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
    },
    Phone: {
      type: Sequelize.STRING(15),
      allowNull: false,
      unique: true,
    },
    TelegramChatId: {
      type: Sequelize.STRING(64),
      allowNull: false,
    },
    StartParam: {
      type: Sequelize.STRING(120),
      allowNull: true,
    },
    LinkedAt: {
      type: Sequelize.DATE,
      allowNull: false,
    },
    ConsumedAt: {
      type: Sequelize.DATE,
      allowNull: true,
    },
    CreatedAt: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('GETDATE()'),
    },
    UpdatedAt: {
      type: Sequelize.DATE,
      allowNull: false,
      defaultValue: Sequelize.literal('GETDATE()'),
    },
  });

  await queryInterface.addIndex('TelegramLinkSessions', ['Phone']);
  await queryInterface.addIndex('TelegramLinkSessions', ['TelegramChatId']);
  await queryInterface.addIndex('TelegramLinkSessions', ['ConsumedAt']);
}

export async function down(queryInterface) {
  await queryInterface.dropTable('TelegramLinkSessions');
}
