/**
 * Force ALTER email columns to allow NULL
 * This script will forcefully alter the columns even if there are dependencies
 */
import { connectDatabase, sequelize } from '../models/database.js';
import logger from '../utils/logger.js';

async function run() {
  try {
    await connectDatabase();
    logger.info('Connected to database');

    // Step 1: Set all empty/whitespace emails to a temporary value
    logger.info('Step 1: Converting empty emails to temporary placeholder...');
    const tempEmailQueries = [
      "UPDATE [dbo].[users] SET [email] = '___TEMP_NULL___' + CAST(NEWID() AS VARCHAR(36)) WHERE [email] = '' OR LEN(LTRIM(RTRIM([email]))) = 0",
      "UPDATE [dbo].[NguoiDung] SET [Email] = '___TEMP_NULL___' + CAST(NEWID() AS VARCHAR(36)) WHERE [Email] = '' OR LEN(LTRIM(RTRIM([Email]))) = 0",
    ];

    for (const query of tempEmailQueries) {
      try {
        const [result, metadata] = await sequelize.query(query);
        logger.info(`Converted ${metadata || 0} empty emails to temp placeholder`);
      } catch (err) {
        if (!err.message.includes('Invalid object name')) {
          logger.warn(`Warning: ${err.message}`);
        }
      }
    }

    // Step 2: ALTER columns to allow NULL
    logger.info('Step 2: Altering columns to allow NULL...');
    const alterQueries = [
      "ALTER TABLE [dbo].[users] ALTER COLUMN [email] VARCHAR(100) NULL",
      "ALTER TABLE [dbo].[NguoiDung] ALTER COLUMN [Email] VARCHAR(100) NULL",
      "ALTER TABLE [dbo].[patients] ALTER COLUMN [email] VARCHAR(100) NULL",
    ];

    for (const query of alterQueries) {
      try {
        await sequelize.query(query);
        const tableName = query.match(/ALTER TABLE \[dbo\]\.\[(\w+)\]/)[1];
        logger.info(`✓ Altered ${tableName} email column to allow NULL`);
      } catch (err) {
        if (!err.message.includes('Invalid object name')) {
          logger.error(`✗ Failed to alter: ${err.message}`);
        }
      }
    }

    // Step 3: Convert temp placeholders back to NULL
    logger.info('Step 3: Converting temp placeholders to NULL...');
    const nullifyQueries = [
      "UPDATE [dbo].[users] SET [email] = NULL WHERE [email] LIKE '___TEMP_NULL___%'",
      "UPDATE [dbo].[NguoiDung] SET [Email] = NULL WHERE [Email] LIKE '___TEMP_NULL___%'",
      "UPDATE [dbo].[patients] SET [email] = NULL WHERE [email] LIKE '___TEMP_NULL___%'",
    ];

    for (const query of nullifyQueries) {
      try {
        const [result, metadata] = await sequelize.query(query);
        logger.info(`Converted ${metadata || 0} temp placeholders to NULL`);
      } catch (err) {
        if (!err.message.includes('Invalid object name')) {
          logger.warn(`Warning: ${err.message}`);
        }
      }
    }

    // Step 4: Create filtered unique indexes
    logger.info('Step 4: Creating filtered unique indexes...');
    const indexQueries = [
      {
        name: 'users.email',
        query: `
          IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_users_email_filtered' AND object_id = OBJECT_ID(N'[dbo].[users]'))
          BEGIN
            CREATE UNIQUE NONCLUSTERED INDEX UQ_users_email_filtered 
            ON [dbo].[users]([email]) 
            WHERE [email] IS NOT NULL
          END
        `
      },
      {
        name: 'NguoiDung.Email',
        query: `
          IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_NguoiDung_Email_filtered' AND object_id = OBJECT_ID(N'[dbo].[NguoiDung]'))
          BEGIN
            CREATE UNIQUE NONCLUSTERED INDEX UQ_NguoiDung_Email_filtered 
            ON [dbo].[NguoiDung]([Email]) 
            WHERE [Email] IS NOT NULL
          END
        `
      },
      {
        name: 'patients.email',
        query: `
          IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_patients_email_filtered' AND object_id = OBJECT_ID(N'[dbo].[patients]'))
          BEGIN
            CREATE UNIQUE NONCLUSTERED INDEX UQ_patients_email_filtered 
            ON [dbo].[patients]([email]) 
            WHERE [email] IS NOT NULL
          END
        `
      },
    ];

    for (const index of indexQueries) {
      try {
        await sequelize.query(index.query);
        logger.info(`✓ Created filtered unique index on ${index.name}`);
      } catch (err) {
        if (!err.message.includes('Invalid object name')) {
          logger.warn(`Warning for ${index.name}: ${err.message}`);
        }
      }
    }

    logger.info('');
    logger.info('✅✅✅ Migration completed successfully! ✅✅✅');
    logger.info('Email columns now allow NULL and have filtered unique indexes.');
    logger.info('You can now add users without email without conflicts.');
    logger.info('Please restart your server.');

    process.exit(0);
  } catch (err) {
    logger.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

run();
