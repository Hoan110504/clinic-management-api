'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * Update existing Patient records with fullName = 'Bệnh nhân' to NULL
     * This cleans up the placeholder values that were auto-generated
     */
    await queryInterface.sequelize.query(`
      UPDATE Patients
      SET full_name = NULL
      WHERE full_name = 'Bệnh nhân'
    `);
  },

  async down(queryInterface, Sequelize) {
    /**
     * Cannot reliably revert this - skip down migration
     * These patients should fill in their actual names anyway
     */
  }
};
