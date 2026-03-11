/**
 * Fix Legacy Vietnamese NOT NULL Columns
 * 
 * The HoSoKham table may have both Vietnamese columns (MaBenhNhan, MaBacSi)
 * and English columns (patient_id, doctor_id) created by different model files.
 * This script makes the legacy Vietnamese columns nullable so they don't block
 * inserts made through the English MedicalRecord model.
 * 
 * Safe to run multiple times.
 * 
 * Usage: node src/scripts/fix_legacy_columns.js
 */
import 'dotenv/config';
import { sequelize } from '../models/database.js';

async function fixLegacyColumns() {
  try {
    await sequelize.authenticate();
    console.log('Connected to database');

    const qi = sequelize.getQueryInterface();

    // List of legacy columns that may exist with NOT NULL but are no longer populated
    const columnsToFix = [
      { table: 'HoSoKham', column: 'MaBenhNhan' },
      { table: 'HoSoKham', column: 'MaBacSi' },
      { table: 'HoSoKham', column: 'MaLichHen' },
      { table: 'Thuoc', column: 'MaThuoc' },
    ];

    for (const { table, column } of columnsToFix) {
      try {
        // Check if column exists first
        const tableDesc = await qi.describeTable(table);
        if (!tableDesc[column]) {
          console.log(`  [skip] ${table}.${column} does not exist`);
          continue;
        }

        if (tableDesc[column].allowNull) {
          console.log(`  [ok]   ${table}.${column} already nullable`);
          continue;
        }

        // Make it nullable via raw SQL (MSSQL syntax)
        const colType = tableDesc[column].type;
        // Drop any CHECK/FK constraints on this column first
        await sequelize.query(`
          DECLARE @sql NVARCHAR(MAX) = '';
          SELECT @sql = @sql + 'ALTER TABLE [${table}] DROP CONSTRAINT [' + dc.name + ']; '
          FROM sys.default_constraints dc
          JOIN sys.columns c ON dc.parent_object_id = c.object_id AND dc.parent_column_id = c.column_id
          WHERE dc.parent_object_id = OBJECT_ID('${table}') AND c.name = '${column}';
          EXEC sp_executesql @sql;
        `);

        await sequelize.query(`
          ALTER TABLE [${table}] ALTER COLUMN [${column}] ${colType} NULL;
        `);
        console.log(`  [fixed] ${table}.${column} → nullable`);
      } catch (err) {
        console.warn(`  [warn] ${table}.${column}: ${err.message}`);
      }
    }

    console.log('Done');
    process.exit(0);
  } catch (err) {
    console.error('Failed:', err.message);
    process.exit(1);
  }
}

fixLegacyColumns();
