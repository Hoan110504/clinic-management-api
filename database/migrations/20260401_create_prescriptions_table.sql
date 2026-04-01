-- Create prescriptions table for modern prescription management
-- This table stores medication prescriptions from doctors

IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'prescriptions')
BEGIN
    CREATE TABLE [dbo].[prescriptions] (
        [id] VARCHAR(20) NOT NULL PRIMARY KEY,
        [medical_record_id] VARCHAR(20) NOT NULL,
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
        [deleted_at] DATETIME NULL,
        CONSTRAINT [FK_prescriptions_medical_records] 
            FOREIGN KEY ([medical_record_id]) REFERENCES [medical_records]([id]),
        CONSTRAINT [FK_prescriptions_patients] 
            FOREIGN KEY ([patient_id]) REFERENCES [patients]([id]),
        CONSTRAINT [FK_prescriptions_users_doctor] 
            FOREIGN KEY ([doctor_id]) REFERENCES [users]([id]),
        CONSTRAINT [FK_prescriptions_users_dispenser] 
            FOREIGN KEY ([dispensed_by_id]) REFERENCES [users]([id])
    );

    -- Create indexes for common queries
    CREATE INDEX [IDX_prescriptions_medical_record_id] ON [prescriptions]([medical_record_id]);
    CREATE INDEX [IDX_prescriptions_patient_id] ON [prescriptions]([patient_id]);
    CREATE INDEX [IDX_prescriptions_doctor_id] ON [prescriptions]([doctor_id]);
    CREATE INDEX [IDX_prescriptions_prescription_date] ON [prescriptions]([prescription_date]);
    CREATE INDEX [IDX_prescriptions_is_dispensed] ON [prescriptions]([is_dispensed]);

    PRINT 'Table [prescriptions] created successfully';
END
ELSE
BEGIN
    PRINT 'Table [prescriptions] already exists';
END
