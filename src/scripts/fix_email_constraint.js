/**
 * Script to fix email column constraint
 * 1. Drop UNIQUE constraint on email
 * 2. ALTER email column to allow NULL
 * 3. Add filtered UNIQUE index (only unique when NOT NULL)
 */
import { connectDatabase, sequelize } from '../models/database.js';
import logger from '../utils/logger.js';

async function run() {
  try {
    await connectDatabase();
    logger.info('Connected to database');

    // Get all UNIQUE constraints on email column
    const findConstraints = `
      SELECT 
        t.name AS TableName,
        i.name AS ConstraintName,
        c.name AS ColumnName
      FROM sys.indexes i
      INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      INNER JOIN sys.tables t ON i.object_id = t.object_id
      WHERE i.is_unique = 1 
        AND c.name IN ('email', 'Email')
        AND t.name IN ('users', 'NguoiDung', 'patients', 'BenhNhan')
    `;

    const [constraints] = await sequelize.query(findConstraints);
    
    logger.info(`Found ${constraints.length} UNIQUE constraints on email columns`);

    // Drop all UNIQUE constraints
    for (const constraint of constraints) {
      const dropQuery = `
        IF EXISTS (SELECT * FROM sys.indexes WHERE name = '${constraint.ConstraintName}' AND object_id = OBJECT_ID(N'[dbo].[${constraint.TableName}]'))
        BEGIN
          ALTER TABLE [dbo].[${constraint.TableName}] DROP CONSTRAINT [${constraint.ConstraintName}]
          PRINT 'Dropped constraint ${constraint.ConstraintName} from ${constraint.TableName}'
        END
      `;
      
      try {
        await sequelize.query(dropQuery);
        logger.info(`Dropped constraint: ${constraint.ConstraintName} from ${constraint.TableName}`);
      } catch (err) {
        logger.warn(`Failed to drop constraint ${constraint.ConstraintName}: ${err.message}`);
      }
    }

    // ALTER columns to allow NULL
    const alterQueries = [
      {
        table: 'users',
        column: 'email',
        query: "IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[users]') AND name = 'email') ALTER TABLE [dbo].[users] ALTER COLUMN [email] VARCHAR(100) NULL"
      },
      {
        table: 'NguoiDung',
        column: 'Email',
        query: "IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[NguoiDung]') AND name = 'Email') ALTER TABLE [dbo].[NguoiDung] ALTER COLUMN [Email] VARCHAR(100) NULL"
      },
      {
        table: 'patients',
        column: 'email',
        query: "IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[patients]') AND name = 'email') ALTER TABLE [dbo].[patients] ALTER COLUMN [email] VARCHAR(100) NULL"
      },
    ];

    for (const alter of alterQueries) {
      try {
        await sequelize.query(alter.query);
        logger.info(`Altered ${alter.table}.${alter.column} to allow NULL`);
      } catch (err) {
        if (!err.message.includes('Invalid object name')) {
          logger.warn(`Failed to alter ${alter.table}.${alter.column}: ${err.message}`);
        }
      }
    }

    // Create filtered UNIQUE indexes (only unique when NOT NULL)
    const createIndexQueries = [
      {
        table: 'users',
        column: 'email',
        query: `
          IF EXISTS (SELECT * FROM sys.tables WHERE name = 'users')
          AND NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_users_email_filtered' AND object_id = OBJECT_ID(N'[dbo].[users]'))
          BEGIN
            CREATE UNIQUE NONCLUSTERED INDEX UQ_users_email_filtered 
            ON [dbo].[users]([email]) 
            WHERE [email] IS NOT NULL
            PRINT 'Created filtered unique index on users.email'
          END
        `
      },
      {
        table: 'NguoiDung',
        column: 'Email',
        query: `
          IF EXISTS (SELECT * FROM sys.tables WHERE name = 'NguoiDung')
          AND NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_NguoiDung_Email_filtered' AND object_id = OBJECT_ID(N'[dbo].[NguoiDung]'))
          BEGIN
            CREATE UNIQUE NONCLUSTERED INDEX UQ_NguoiDung_Email_filtered 
            ON [dbo].[NguoiDung]([Email]) 
            WHERE [Email] IS NOT NULL
            PRINT 'Created filtered unique index on NguoiDung.Email'
          END
        `
      },
      {
        table: 'patients',
        column: 'email',
        query: `
          IF EXISTS (SELECT * FROM sys.tables WHERE name = 'patients')
          AND NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'UQ_patients_email_filtered' AND object_id = OBJECT_ID(N'[dbo].[patients]'))
          BEGIN
            CREATE UNIQUE NONCLUSTERED INDEX UQ_patients_email_filtered 
            ON [dbo].[patients]([email]) 
            WHERE [email] IS NOT NULL
            PRINT 'Created filtered unique index on patients.email'
          END
        `
      },
    ];

    for (const index of createIndexQueries) {
      try {
        await sequelize.query(index.query);
        logger.info(`Created filtered unique index on ${index.table}.${index.column}`);
      } catch (err) {
        if (!err.message.includes('Invalid object name')) {
          logger.warn(`Failed to create index on ${index.table}.${index.column}: ${err.message}`);
        }
      }
    }

    logger.info('✅ Migration completed successfully!');
    logger.info('Email columns now allow NULL and have filtered unique indexes.');
    logger.info('You can now add users without email without conflicts.');

    process.exit(0);
  } catch (err) {
    logger.error('❌ Migration failed:', err);
    process.exit(1);
  }
}

run();
