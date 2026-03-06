import { connectDatabase, sequelize } from '../models/database.js';

async function run() {
  try {
    await connectDatabase();

    // Try altering both possible table names used in this project
    const queries = [
      "IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[users]') AND name = 'email') ALTER TABLE [dbo].[users] ALTER COLUMN [email] VARCHAR(100) NULL",
      "IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[NguoiDung]') AND name = 'Email') ALTER TABLE [dbo].[NguoiDung] ALTER COLUMN [Email] VARCHAR(100) NULL",
    ];

    for (const q of queries) {
      try {
        await sequelize.query(q);
        console.log('Executed:', q);
      } catch (err) {
        console.warn('Query failed (may be fine):', q, err.message);
      }
    }

    console.log('Done. Please restart the server and re-run tests.');
    process.exit(0);
  } catch (err) {
    console.error('Failed to alter column:', err);
    process.exit(1);
  }
}

run();
