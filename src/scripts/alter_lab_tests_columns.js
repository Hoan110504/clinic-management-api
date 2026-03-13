/**
 * Migration: alter_lab_tests_columns.js
 * Updates column sizes for lab_tests to NVARCHAR(50) to accept UUIDs
 * Run: node src/scripts/alter_lab_tests_columns.js
 */
import { sequelize } from '../models/database.js';

const alter = async () => {
  try {
    console.log('Altering lab_tests columns to NVARCHAR(50) if necessary...');

    await sequelize.query(`
      IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'lab_tests' AND COLUMN_NAME = 'id')
      BEGIN
        ALTER TABLE [dbo].[lab_tests] ALTER COLUMN [id] NVARCHAR(50) NOT NULL;
      END
    `);

    await sequelize.query(`
      IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'lab_tests' AND COLUMN_NAME = 'service_order_id')
      BEGIN
        ALTER TABLE [dbo].[lab_tests] ALTER COLUMN [service_order_id] NVARCHAR(50) NULL;
      END
    `);

    await sequelize.query(`
      IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'lab_tests' AND COLUMN_NAME = 'medical_record_id')
      BEGIN
        ALTER TABLE [dbo].[lab_tests] ALTER COLUMN [medical_record_id] NVARCHAR(50) NULL;
      END
    `);

    await sequelize.query(`
      IF EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'lab_tests' AND COLUMN_NAME = 'patient_id')
      BEGIN
        ALTER TABLE [dbo].[lab_tests] ALTER COLUMN [patient_id] NVARCHAR(50) NOT NULL;
      END
    `);

    console.log('✅ lab_tests columns altered successfully (if they existed)');
  } catch (err) {
    console.error('Error altering lab_tests columns:', err);
    throw err;
  } finally {
    await sequelize.close();
  }
};

alter().then(() => process.exit(0)).catch(() => process.exit(1));
