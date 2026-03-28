/**
 * Migration: add_hinhanh_column_to_canlamsang.js
 * Adds [HinhAnh] NVARCHAR(MAX) to legacy [CanLamSang] table if missing.
 */
import { sequelize } from '../models/index.js';

async function run() {
  try {
    console.log('Checking [CanLamSang].[HinhAnh] column...');

    await sequelize.query(`
      IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'CanLamSang')
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_NAME = 'CanLamSang' AND COLUMN_NAME = 'HinhAnh'
        )
        BEGIN
          ALTER TABLE [dbo].[CanLamSang] ADD [HinhAnh] NVARCHAR(MAX) NULL;
          PRINT N'Added column [CanLamSang].[HinhAnh]';
        END
        ELSE
        BEGIN
          PRINT N'Column [CanLamSang].[HinhAnh] already exists';
        END
      END
      ELSE
      BEGIN
        PRINT N'Table [CanLamSang] does not exist - skipped';
      END
    `);

    console.log('Done.');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err?.message || err);
    process.exit(1);
  }
}

run();
