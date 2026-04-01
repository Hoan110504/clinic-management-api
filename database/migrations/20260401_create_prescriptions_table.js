export const up = async (queryInterface, Sequelize) => {
  // Create prescriptions table if it doesn't exist
  try {
    await queryInterface.sequelize.query(`
      IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'prescriptions')
      BEGIN
          CREATE TABLE [prescriptions] (
              [id] VARCHAR(20) NOT NULL PRIMARY KEY,
              [medical_record_id] VARCHAR(20) NULL,
              [patient_id] VARCHAR(20) NOT NULL,
              [patient_name] VARCHAR(100) NOT NULL,
              [doctor_id] UNIQUEIDENTIFIER NOT NULL,
              [doctor_name] VARCHAR(100) NOT NULL,
              [prescription_date] DATETIME NOT NULL DEFAULT GETUTCDATE(),
              [items] TEXT NOT NULL DEFAULT '[]',
              [diagnosis] TEXT NULL,
              [notes] TEXT NULL,
              [is_dispensed] BIT NOT NULL DEFAULT 0,
              [dispensed_at] DATETIME NULL,
              [dispensed_by_id] UNIQUEIDENTIFIER NULL,
              [dispensed_by_name] VARCHAR(100) NULL,
              [created_at] DATETIME NOT NULL DEFAULT GETUTCDATE(),
              [updated_at] DATETIME NOT NULL DEFAULT GETUTCDATE(),
              [deleted_at] DATETIME NULL
          );

          CREATE INDEX [IDX_prescriptions_medical_record_id] ON [prescriptions]([medical_record_id]);
          CREATE INDEX [IDX_prescriptions_patient_id] ON [prescriptions]([patient_id]);
          CREATE INDEX [IDX_prescriptions_doctor_id] ON [prescriptions]([doctor_id]);
          CREATE INDEX [IDX_prescriptions_prescription_date] ON [prescriptions]([prescription_date]);
          CREATE INDEX [IDX_prescriptions_is_dispensed] ON [prescriptions]([is_dispensed]);
      END
    `);
    console.log('Prescriptions table created successfully');
  } catch (error) {
    console.error('Error creating prescriptions table:', error);
    throw error;
  }
};

export const down = async (queryInterface, Sequelize) => {
  // Drop table if it exists
  try {
    await queryInterface.sequelize.query(`
      IF EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'prescriptions')
      BEGIN
          DROP TABLE [dbo].[prescriptions];
      END
    `);
    console.log('Prescriptions table dropped successfully');
  } catch (error) {
    console.error('Error dropping prescriptions table:', error.message);
    throw error;
  }
};
