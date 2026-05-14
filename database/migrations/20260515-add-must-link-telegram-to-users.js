/**
 * Add must_link_telegram column to users table
 */

export async function up(queryInterface, Sequelize) {
  await queryInterface.addColumn('users', 'must_link_telegram', {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  });
}

export async function down(queryInterface) {
  await queryInterface.removeColumn('users', 'must_link_telegram');
}
