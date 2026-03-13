/**
 * Migration script to create lab_tests table
 * Run: node src/scripts/create_lab_tests_table.js
 */
import { sequelize } from '../models/database.js';

const createLabTestsTable = async () => {
  try {
    console.log('🔄 Creating lab_tests table...');

    await sequelize.query(`
      IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[lab_tests]') AND type in (N'U'))
      BEGIN
        CREATE TABLE [dbo].[lab_tests] (
          [id] NVARCHAR(50) PRIMARY KEY NOT NULL,
          [service_order_id] NVARCHAR(50) NULL,
          [medical_record_id] NVARCHAR(50) NULL,
          [patient_id] NVARCHAR(50) NOT NULL,
          [patient_name] NVARCHAR(100) NOT NULL,
          [test_type] NVARCHAR(50) NOT NULL,
          [test_name] NVARCHAR(100) NOT NULL,
          [ordered_by] NVARCHAR(100) NULL,
          [ordered_by_id] UNIQUEIDENTIFIER NULL,
          [ordered_date] DATETIME2 NOT NULL DEFAULT GETDATE(),
          [status] NVARCHAR(50) NOT NULL DEFAULT 'pending',
          [results] NVARCHAR(MAX) NULL,
          [normal_range] NVARCHAR(MAX) NULL,
          [result_date] DATETIME2 NULL,
          [notes] NVARCHAR(MAX) NULL,
          [confirmed_by] NVARCHAR(100) NULL,
          [confirmed_by_id] UNIQUEIDENTIFIER NULL,
          [confirmed_at] DATETIME2 NULL,
          [created_at] DATETIME2 NOT NULL DEFAULT GETDATE(),
          [updated_at] DATETIME2 NOT NULL DEFAULT GETDATE(),
          [deleted_at] DATETIME2 NULL
        );

        -- Create indexes
        CREATE INDEX [idx_lab_tests_patient_id] ON [dbo].[lab_tests] ([patient_id]);
        CREATE INDEX [idx_lab_tests_medical_record_id] ON [dbo].[lab_tests] ([medical_record_id]);
        CREATE INDEX [idx_lab_tests_status] ON [dbo].[lab_tests] ([status]);
        CREATE INDEX [idx_lab_tests_ordered_date] ON [dbo].[lab_tests] ([ordered_date]);
        
        PRINT 'lab_tests table created successfully';
      END
      ELSE
      BEGIN
        PRINT 'lab_tests table already exists';
      END
    `);

    console.log('✅ lab_tests table created successfully!');
    
    // Verify table exists
    const [results] = await sequelize.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_NAME = 'lab_tests'
    `);
    
    if (results.length > 0) {
      console.log('✅ Verified: lab_tests table exists in database');
    } else {
      console.log('❌ Warning: lab_tests table was not found after creation');
    }

  } catch (error) {
    console.error('❌ Error creating lab_tests table:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
};

// Run migration
createLabTestsTable()
  .then(() => {
    console.log('✅ Migration completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });
