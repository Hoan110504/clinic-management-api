'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Allow fullName to be nullable in Patients table
     * This allows patients to not have fullName initially and complete it later
     */
    await queryInterface.changeColumn('Patients', 'full_name', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    /**
     * Revert: Make fullName required again
     */
    await queryInterface.changeColumn('Patients', 'full_name', {
      type: Sequelize.STRING(100),
      allowNull: false,
    });
  }
};
