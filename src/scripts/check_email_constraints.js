/**
 * Check all constraints on email columns
 */
import { connectDatabase, sequelize } from '../models/database.js';
import logger from '../utils/logger.js';

async function run() {
  try {
    await connectDatabase();
    logger.info('Checking all constraints on email columns...\n');

    // Check all constraints on email columns
    const checkQuery = `
      SELECT 
        t.name AS TableName,
        c.name AS ColumnName,
        c.is_nullable AS IsNullable,
        c.max_length AS MaxLength,
        dc.name AS DefaultConstraintName,
        dc.definition AS DefaultValue,
        ic.name AS IndexName,
        ic.is_unique AS IsUnique,
        ic.type_desc AS IndexType
      FROM sys.columns c
      INNER JOIN sys.tables t ON c.object_id = t.object_id
      LEFT JOIN sys.default_constraints dc ON c.default_object_id = dc.object_id
      LEFT JOIN sys.index_columns icc ON c.object_id = icc.object_id AND c.column_id = icc.column_id
      LEFT JOIN sys.indexes ic ON icc.object_id = ic.object_id AND icc.index_id = ic.index_id
      WHERE c.name IN ('email', 'Email')
        AND t.name IN ('users', 'NguoiDung', 'patients')
      ORDER BY t.name, c.name
    `;

    const [results] = await sequelize.query(checkQuery);
    
    if (results.length === 0) {
      logger.warn('No email columns found!');
      process.exit(0);
    }

    logger.info('Found constraints:');
    console.table(results);

    // Find default constraints
    const defaultConstraints = results.filter(r => r.DefaultConstraintName);
    
    if (defaultConstraints.length > 0) {
      logger.info('\n📌 Found DEFAULT constraints that need to be dropped:');
      for (const dc of defaultConstraints) {
        const dropQuery = `ALTER TABLE [dbo].[${dc.TableName}] DROP CONSTRAINT [${dc.DefaultConstraintName}]`;
        logger.info(`  ${dropQuery}`);
        
        try {
          await sequelize.query(dropQuery);
          logger.info(`  ✓ Dropped ${dc.DefaultConstraintName}`);
        } catch (err) {
          logger.error(`  ✗ Failed: ${err.message}`);
        }
      }
    }

    // Now try to ALTER
    logger.info('\n🔧 Attempting to ALTER columns...');
    const alterQueries = [
      { table: 'users', column: 'email', query: "ALTER TABLE [dbo].[users] ALTER COLUMN [email] VARCHAR(100) NULL" },
      { table: 'NguoiDung', column: 'Email', query: "ALTER TABLE [dbo].[NguoiDung] ALTER COLUMN [Email] VARCHAR(100) NULL" },
      { table: 'patients', column: 'email', query: "ALTER TABLE [dbo].[patients] ALTER COLUMN [email] VARCHAR(100) NULL" },
    ];

    for (const alter of alterQueries) {
      try {
        await sequelize.query(alter.query);
        logger.info(`✓ Successfully altered ${alter.table}.${alter.column} to allow NULL`);
      } catch (err) {
        logger.error(`✗ Failed to alter ${alter.table}.${alter.column}: ${err.message}`);
      }
    }

    logger.info('\n✅ Check and fix completed!');
    process.exit(0);
  } catch (err) {
    logger.error('❌ Script failed:', err);
    process.exit(1);
  }
}

run();
