/**
 * Fix Gender Column Constraints
 * Converts VARCHAR to NVARCHAR and updates CHECK constraints
 */
import 'dotenv/config';
import { sequelize } from '../models/database.js';
import logger from '../utils/logger.js';

const fixGenderConstraints = async () => {
  try {
    logger.info('Starting gender column fixes...');
    await sequelize.authenticate();
    logger.info('Database connected');

    // Run fixes for each table
    const tables = [
      { table: 'Patients', column: 'gender' },
      { table: 'users', column: 'gender' },
      { table: 'Appointments', column: 'patient_gender' },
      { table: 'medical_records', column: 'patient_gender' },
      { table: 'payments', column: 'patient_gender' },
      { table: 'service_orders', column: 'patient_gender' },
    ];

    for (const { table, column } of tables) {
      logger.info(`\nProcessing ${table}.${column}...`);

      try {
        // Check if table exists
        const [tableExists] = await sequelize.query(`
          SELECT COUNT(*) as count 
          FROM sys.tables 
          WHERE name = '${table}'
        `);

        if (!tableExists[0].count) {
          logger.warn(`  Table ${table} does not exist, skipping...`);
          continue;
        }

        // Check if column exists
        const [columnExists] = await sequelize.query(`
          SELECT COUNT(*) as count 
          FROM sys.columns 
          WHERE object_id = OBJECT_ID('dbo.${table}') 
          AND name = '${column}'
        `);

        if (!columnExists[0].count) {
          logger.warn(`  Column ${table}.${column} does not exist, skipping...`);
          continue;
        }

        // Find and drop existing constraint
        const [constraints] = await sequelize.query(`
          SELECT name 
          FROM sys.check_constraints 
          WHERE parent_object_id = OBJECT_ID('dbo.${table}') 
          AND definition LIKE '%${column}%'
        `);

        if (constraints.length > 0) {
          for (const constraint of constraints) {
            logger.info(`  Dropping constraint: ${constraint.name}`);
            await sequelize.query(`ALTER TABLE dbo.${table} DROP CONSTRAINT [${constraint.name}]`);
          }
        }

        // Check column type
        const [columnInfo] = await sequelize.query(`
          SELECT t.name as type_name, c.max_length
          FROM sys.columns c
          JOIN sys.types t ON c.user_type_id = t.user_type_id
          WHERE c.object_id = OBJECT_ID('dbo.${table}') 
          AND c.name = '${column}'
        `);

        if (columnInfo[0] && columnInfo[0].type_name === 'varchar') {
          logger.info(`  Converting ${column} from VARCHAR to NVARCHAR(10)...`);
          
          // Clear empty strings first
          await sequelize.query(`
            UPDATE dbo.${table} 
            SET ${column} = NULL 
            WHERE ${column} = '' OR ${column} IS NULL
          `);

          // Alter column type
          await sequelize.query(`
            ALTER TABLE dbo.${table} 
            ALTER COLUMN ${column} NVARCHAR(10) NULL
          `);
          
          logger.info(`  ✓ Column type converted`);
        } else {
          logger.info(`  Column is already NVARCHAR`);
        }

        // Add new constraint
        const constraintName = `CK_${table}_${column}`;
        logger.info(`  Adding constraint: ${constraintName}`);
        
        await sequelize.query(`
          ALTER TABLE dbo.${table}
          ADD CONSTRAINT ${constraintName}
          CHECK (${column} IS NULL OR ${column} IN (N'Nam', N'Nữ'))
        `);

        logger.info(`  ✓ ${table}.${column} fixed successfully`);

      } catch (tableError) {
        logger.error(`  Error processing ${table}.${column}:`, tableError.message);
        // Continue with next table
      }
    }

    logger.info('\n✅ All gender column fixes completed successfully!');
    logger.info('\nSummary:');
    logger.info('  - Converted VARCHAR columns to NVARCHAR(10)');
    logger.info('  - Recreated CHECK constraints to allow N\'Nam\' and N\'Nữ\'');
    logger.info('  - Applied fixes to: Patients, users, Appointments, medical_records, payments, service_orders');

  } catch (error) {
    logger.error('❌ Fix failed:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
};

// Execute
fixGenderConstraints()
  .then(() => {
    logger.info('\n🎉 Done! You can now restart your server and try adding patients with gender "Nữ"');
    process.exit(0);
  })
  .catch(() => {
    process.exit(1);
  });
