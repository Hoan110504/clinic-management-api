/**
 * Script to fix empty email strings in database
 * Converts empty strings ('') to NULL to avoid UNIQUE constraint violations
 */
import { connectDatabase, sequelize } from '../models/database.js';
import logger from '../utils/logger.js';

async function run() {
  try {
    await connectDatabase();
    logger.info('Connected to database');

    // Update users table - convert empty emails to NULL
    const queries = [
      // For 'users' table (Sequelize default)
      "UPDATE [dbo].[users] SET [email] = NULL WHERE [email] = '' OR [email] IS NOT NULL AND LEN(LTRIM(RTRIM([email]))) = 0",
      // For 'NguoiDung' table (Vietnamese schema)
      "UPDATE [dbo].[NguoiDung] SET [Email] = NULL WHERE [Email] = '' OR [Email] IS NOT NULL AND LEN(LTRIM(RTRIM([Email]))) = 0",
      // For 'patients' table
      "UPDATE [dbo].[patients] SET [email] = NULL WHERE [email] = '' OR [email] IS NOT NULL AND LEN(LTRIM(RTRIM([email]))) = 0",
      // For 'BenhNhan' table (if exists - though this table doesn't have email field in current schema)
    ];

    let updatedCount = 0;

    for (const query of queries) {
      try {
        const [results, metadata] = await sequelize.query(query);
        const rowsAffected = metadata || 0;
        if (rowsAffected > 0) {
          logger.info(`Updated ${rowsAffected} rows: ${query.substring(0, 50)}...`);
          updatedCount += rowsAffected;
        }
      } catch (err) {
        // Table might not exist, which is fine
        if (!err.message.includes('Invalid object name')) {
          logger.warn(`Query warning: ${err.message}`);
        }
      }
    }

    logger.info(`Migration completed! Total rows updated: ${updatedCount}`);
    logger.info('Empty email strings have been converted to NULL.');
    logger.info('You can now add users without email without conflicts.');

    process.exit(0);
  } catch (err) {
    logger.error('Migration failed:', err);
    process.exit(1);
  }
}

run();
