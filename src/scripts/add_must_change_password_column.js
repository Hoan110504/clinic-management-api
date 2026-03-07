#!/usr/bin/env node
/**
 * Script: add_must_change_password_column.js
 * Usage: node src/scripts/add_must_change_password_column.js
 * Adds a BIT NOT NULL DEFAULT 0 column `must_change_password` to common user tables
 * (safe-checks with COL_LENGTH so it won't error if column already exists).
 */
import { sequelize } from '../models/index.js';

async function run() {
  try {
    const tables = ['users', 'NguoiDung'];
    for (const table of tables) {
      console.log(`Checking table: ${table}`);
      // SQL Server safe check
      const sql = `
IF COL_LENGTH('${table}', 'must_change_password') IS NULL
BEGIN
  ALTER TABLE ${table} ADD must_change_password BIT NOT NULL CONSTRAINT DF_${table}_must_change_password DEFAULT 0;
END
`;
      try {
        await sequelize.query(sql);
        console.log(`Ensured column on ${table}`);
      } catch (err) {
        console.warn(`Could not alter table ${table}:`, err.message || err);
      }
    }

    console.log('Done.');
    process.exit(0);
  } catch (err) {
    console.error('Error while adding must_change_password column:', err);
    process.exit(1);
  }
}

run();
