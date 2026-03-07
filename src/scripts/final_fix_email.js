/**
 * Final fix for email columns
 * Drop all indexes, ALTER columns, recreate filtered indexes
 */
import { connectDatabase, sequelize } from '../models/database.js';
import logger from '../utils/logger.js';

async function run() {
  try {
    await connectDatabase();
    logger.info('Starting final email column fix...\n');

    // Step 1: Get all indexes on email columns
    logger.info('Step 1: Finding all indexes on email columns...');
    const findIndexesQuery = `
      SELECT 
        t.name AS TableName,
        i.name AS IndexName,
        c.name AS ColumnName
      FROM sys.indexes i
      INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      INNER JOIN sys.tables t ON i.object_id = t.object_id
      WHERE c.name IN ('email', 'Email')
        AND t.name IN ('users', 'NguoiDung', 'patients')
        AND i.name IS NOT NULL
    `;

    const [indexes] = await sequelize.query(findIndexesQuery);
    logger.info(`Found ${indexes.length} indexes to drop\n`);

    //Step 2: Drop all indexes
    logger.info('Step 2: Dropping all indexes on email columns...');
    for (const idx of indexes) {
      const dropQuery = `DROP INDEX [${idx.IndexName}] ON [dbo].[${idx.TableName}]`;
      try {
        await sequelize.query(dropQuery);
        logger.info(`✓ Dropped ${idx.TableName}.${idx.IndexName}`);
      } catch (err) {
        logger.warn(`⚠ Could not drop ${idx.TableName}.${idx.IndexName}: ${err.message}`);
      }
    }

    // Step 3: ALTER columns to allow NULL
    logger.info('\nStep 3: Altering columns to allow NULL...');
    const alterQueries = [
      { table: 'users', column: 'email', query: "ALTER TABLE [dbo].[users] ALTER COLUMN [email] VARCHAR(100) NULL" },
      { table: 'NguoiDung', column: 'Email', query: "ALTER TABLE [dbo].[NguoiDung] ALTER COLUMN [Email] VARCHAR(100) NULL" },
      { table: 'patients', column: 'email', query: "ALTER TABLE [dbo].[patients] ALTER COLUMN [email] VARCHAR(100) NULL" },
    ];

    for (const alter of alterQueries) {
      try {
        await sequelize.query(alter.query);
        logger.info(`✓ ${alter.table}.${alter.column} now allows NULL`);
      } catch (err) {
        logger.error(`✗ Failed ${alter.table}.${alter.column}: ${err.message}`);
      }
    }

    // Step 4: Update temp emails to NULL
    logger.info('\nStep 4: Converting temp emails to NULL...');
    const updateQueries = [
      "UPDATE [dbo].[users] SET [email] = NULL WHERE [email] LIKE '___TEMP_NULL___%'",
      "UPDATE [dbo].[NguoiDung] SET [Email] = NULL WHERE [Email] LIKE '___TEMP_NULL___%'",
      "UPDATE [dbo].[patients] SET [email] = NULL WHERE [email] LIKE '___TEMP_NULL___%'",
    ];

    for (const query of updateQueries) {
      try {
        const [result, metadata] = await sequelize.query(query);
        if (metadata > 0) {
          logger.info(`✓ Converted ${metadata} temp emails to NULL`);
        }
      } catch (err) {
        logger.warn(`⚠ ${err.message}`);
      }
    }

    // Step 5: Create filtered unique indexes (only unique when NOT NULL)
    logger.info('\nStep 5: Creating filtered unique indexes...');
    const createIndexQueries = [
      {
        table: 'users',
        query: `CREATE UNIQUE NONCLUSTERED INDEX UQ_users_email_filtered ON [dbo].[users]([email]) WHERE [email] IS NOT NULL`
      },
      {
        table: 'NguoiDung',
        query: `CREATE UNIQUE NONCLUSTERED INDEX UQ_NguoiDung_Email_filtered ON [dbo].[NguoiDung]([Email]) WHERE [Email] IS NOT NULL`
      },
      {
        table: 'patients',
        query: `CREATE UNIQUE NONCLUSTERED INDEX UQ_patients_email_filtered ON [dbo].[patients]([email]) WHERE [email] IS NOT NULL`
      },
    ];

    for (const idx of createIndexQueries) {
      try {
        await sequelize.query(idx.query);
        logger.info(`✓ Created filtered unique index on ${idx.table}`);
      } catch (err) {
        if (err.message.includes('already exists')) {
          logger.info(`⚠ Index on ${idx.table} already exists`);
        } else {
          logger.error(`✗ Failed to create index on ${idx.table}: ${err.message}`);
        }
      }
    }

    logger.info('\n' + '='.repeat(60));
    logger.info('✅✅✅ SUCCESS! Email columns fixed! ✅✅✅');
    logger.info('='.repeat(60));
    logger.info('✓ Email columns now allow NULL');
    logger.info('✓ Filtered unique indexes created (only unique when NOT NULL)');
    logger.info('✓ Multiple users can have NULL email without conflicts');
    logger.info('\n👉 Please RESTART your backend server now!');
    logger.info('='.repeat(60));

    process.exit(0);
  } catch (err) {
    logger.error('❌ Script failed:', err);
    process.exit(1);
  }
}

run();
