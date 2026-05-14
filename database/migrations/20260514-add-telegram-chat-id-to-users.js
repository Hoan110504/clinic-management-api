/**
 * Add telegram chat id to users
 */

export async function up(queryInterface, Sequelize) {
  await queryInterface.addColumn('users', 'telegram_chat_id', {
    type: Sequelize.STRING(64),
    allowNull: true,
  });
}

export async function down(queryInterface) {
  await queryInterface.removeColumn('users', 'telegram_chat_id');
}