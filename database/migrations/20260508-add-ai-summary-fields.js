/**
 * Sequelize migration: add AI summary fields to MedicalExaminations
 * Adds AiSummary and AiSummaryGeneratedAt fields for storing AI-generated medical record summaries
 * Run with: npm run db:migrate
 */

export async function up(queryInterface, Sequelize) {
  const table = 'MedicalExaminations';
  
  // Check if AiSummary column already exists
  const [aiSummaryCols] = await queryInterface.sequelize.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${table}' AND COLUMN_NAME = 'AiSummary'`
  );
  
  // Add AiSummary field if it doesn't exist
  if (!aiSummaryCols || aiSummaryCols.length === 0) {
    await queryInterface.addColumn(table, 'AiSummary', {
      type: Sequelize.TEXT,
      allowNull: true,
    });
  }
  
  // Check if AiSummaryGeneratedAt column already exists
  const [aiSummaryDateCols] = await queryInterface.sequelize.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${table}' AND COLUMN_NAME = 'AiSummaryGeneratedAt'`
  );
  
  // Add AiSummaryGeneratedAt field if it doesn't exist
  if (!aiSummaryDateCols || aiSummaryDateCols.length === 0) {
    await queryInterface.addColumn(table, 'AiSummaryGeneratedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  }
}

export async function down(queryInterface, Sequelize) {
  const table = 'MedicalExaminations';
  
  // Remove AiSummaryGeneratedAt field
  const [aiSummaryDateCols] = await queryInterface.sequelize.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${table}' AND COLUMN_NAME = 'AiSummaryGeneratedAt'`
  );
  
  if (aiSummaryDateCols && aiSummaryDateCols.length > 0) {
    await queryInterface.removeColumn(table, 'AiSummaryGeneratedAt');
  }
  
  // Remove AiSummary field
  const [aiSummaryCols] = await queryInterface.sequelize.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${table}' AND COLUMN_NAME = 'AiSummary'`
  );
  
  if (aiSummaryCols && aiSummaryCols.length > 0) {
    await queryInterface.removeColumn(table, 'AiSummary');
  }
}
