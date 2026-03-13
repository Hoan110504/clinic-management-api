/**
 * Fix lab_tests timestamp column names to snake_case (created_at, updated_at, deleted_at)
 * Safe, idempotent: will only rename if camelCase columns exist and snake_case do not.
 * Run: node src/scripts/fix_lab_tests_timestamps.js
 */
import { sequelize } from '../models/database.js';

const fix = async () => {
  try {
    console.log('🔧 Fixing lab_tests timestamp column names if necessary...');

    // Rename createdAt -> created_at if necessary
    await sequelize.query(`
      IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'lab_tests' AND COLUMN_NAME = 'createdAt')
      AND NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'lab_tests' AND COLUMN_NAME = 'created_at')
      BEGIN
        EXEC sp_rename '[dbo].[lab_tests].[createdAt]', 'created_at', 'COLUMN';
      END
    `);

    // Rename updatedAt -> updated_at if necessary
    await sequelize.query(`
      IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'lab_tests' AND COLUMN_NAME = 'updatedAt')
      AND NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'lab_tests' AND COLUMN_NAME = 'updated_at')
      BEGIN
        EXEC sp_rename '[dbo].[lab_tests].[updatedAt]', 'updated_at', 'COLUMN';
      END
    `);

    // Rename deletedAt -> deleted_at if necessary
    await sequelize.query(`
      IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'lab_tests' AND COLUMN_NAME = 'deletedAt')
      AND NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'lab_tests' AND COLUMN_NAME = 'deleted_at')
      BEGIN
        EXEC sp_rename '[dbo].[lab_tests].[deletedAt]', 'deleted_at', 'COLUMN';
      END
    `);

    console.log('✅ lab_tests timestamp columns checked/renamed (if needed)');
  } catch (err) {
    console.error('❌ Error fixing lab_tests timestamp columns:', err);
    throw err;
  } finally {
    await sequelize.close();
  }
};

fix().then(() => process.exit(0)).catch(() => process.exit(1));
