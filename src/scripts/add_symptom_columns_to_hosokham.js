/**
 * Script: add_symptom_columns_to_hosokham.js
 * Adds ThoiGianTrieuChung and MucDoTrieuChung columns to HoSoKham table if missing.
 * Run: node src/scripts/add_symptom_columns_to_hosokham.js
 */
import { sequelize } from '../models/database.js';

const addColumns = async () => {
  try {
    console.log('Checking HoSoKham columns...');
    // Add ThoiGianTrieuChung
    await sequelize.query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'HoSoKham' AND COLUMN_NAME = 'ThoiGianTrieuChung')
      BEGIN
        ALTER TABLE [dbo].[HoSoKham] ADD [ThoiGianTrieuChung] NVARCHAR(100) NULL;
        PRINT 'Added column ThoiGianTrieuChung';
      END
    `);

    // Add MucDoTrieuChung
    await sequelize.query(`
      IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'HoSoKham' AND COLUMN_NAME = 'MucDoTrieuChung')
      BEGIN
        ALTER TABLE [dbo].[HoSoKham] ADD [MucDoTrieuChung] NVARCHAR(50) NULL;
        PRINT 'Added column MucDoTrieuChung';
      END
    `);

    console.log('✅ Columns ensured on HoSoKham');
  } catch (err) {
    console.error('Error adding columns to HoSoKham:', err);
    throw err;
  } finally {
    await sequelize.close();
  }
};

addColumns().then(() => process.exit(0)).catch(() => process.exit(1));
