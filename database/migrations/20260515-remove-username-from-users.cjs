'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableInfo = await queryInterface.describeTable('users');
    
    // Only drop username column if it exists
    if (tableInfo.username) {
      await queryInterface.removeColumn('users', 'username');
      console.log('✓ Removed username column from users table');
    } else {
      console.log('✓ Username column already removed from users table');
    }
  },

  async down(queryInterface, Sequelize) {
    // Rollback: add username column back (optional, as we're moving away from it)
    await queryInterface.addColumn('users', 'username', {
      type: Sequelize.STRING(50),
      allowNull: true,
      unique: false,
    });
    console.log('✓ Added username column back to users table');
  }
};
