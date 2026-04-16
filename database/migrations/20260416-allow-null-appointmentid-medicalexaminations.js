/**
 * Sequelize migration: make MedicalExaminations.AppointmentID nullable
 * Run with: npx sequelize-cli db:migrate (ensure proper config)
 */

export async function up(queryInterface, Sequelize) {
  // Only attempt if column exists and is not nullable
  const table = 'MedicalExaminations';
  const column = 'AppointmentID';
  const [cols] = await queryInterface.sequelize.query(
    `SELECT is_nullable FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${table}' AND COLUMN_NAME = '${column}'`
  );
  if (cols && cols.length > 0 && cols[0].is_nullable === 'NO') {
    await queryInterface.changeColumn(table, column, { type: Sequelize.BIGINT, allowNull: true });
  }
}

export async function down(queryInterface, Sequelize) {
  // Revert to NOT NULL - be careful: will fail if NULLs exist
  const table = 'MedicalExaminations';
  const column = 'AppointmentID';
  await queryInterface.changeColumn(table, column, { type: Sequelize.BIGINT, allowNull: false });
}
