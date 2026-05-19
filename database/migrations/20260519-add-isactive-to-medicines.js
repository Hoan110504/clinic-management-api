/**
 * Sequelize migration: add IsActive field to Medicines table
 * Adds IsActive boolean field to support medicine lock/unlock feature
 * Run with: npm run db:migrate
 */

export async function up(queryInterface, Sequelize) {
  try {
    const table = 'Medicines';
    
    // Check if IsActive column already exists
    const [isActiveCols] = await queryInterface.sequelize.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${table}' AND COLUMN_NAME = 'IsActive'`
    );
    
    // Add IsActive field if it doesn't exist
    if (!isActiveCols || isActiveCols.length === 0) {
      console.log('Adding IsActive column to Medicines table...');
      await queryInterface.addColumn(table, 'IsActive', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
      console.log('IsActive column added successfully');
    } else {
      console.log('IsActive column already exists, skipping...');
    }
  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  }
}

export async function down(queryInterface) {
  try {
    const table = 'Medicines';
    
    // Check if IsActive column exists
    const [isActiveCols] = await queryInterface.sequelize.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = '${table}' AND COLUMN_NAME = 'IsActive'`
    );
    
    if (isActiveCols && isActiveCols.length > 0) {
      await queryInterface.removeColumn(table, 'IsActive');
      console.log('IsActive column removed');
    }
  } catch (error) {
    console.error('Migration rollback error:', error);
    throw error;
  }
}
