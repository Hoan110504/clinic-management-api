-- =============================================
-- FIX GENDER COLUMN CONSTRAINTS
-- Converts VARCHAR to NVARCHAR and updates CHECK constraints
-- =============================================

USE ClinicManagement;
GO

PRINT N'Starting gender column fixes...';
GO

-- =============================================
-- FIX: patients table
-- =============================================
PRINT N'Fixing patients.gender...';

-- Drop existing constraint
IF EXISTS (SELECT * FROM sys.check_constraints WHERE name LIKE '%patients%gender%')
BEGIN
    DECLARE @constraint_name_patients NVARCHAR(200);
    SELECT TOP 1 @constraint_name_patients = name 
    FROM sys.check_constraints 
    WHERE parent_object_id = OBJECT_ID('dbo.patients') 
    AND definition LIKE '%gender%';
    
    IF @constraint_name_patients IS NOT NULL
    BEGIN
        EXEC('ALTER TABLE dbo.patients DROP CONSTRAINT [' + @constraint_name_patients + ']');
        PRINT N'  Dropped old constraint: ' + @constraint_name_patients;
    END
END

-- Alter column to NVARCHAR if needed
IF EXISTS (SELECT * FROM sys.columns 
           WHERE object_id = OBJECT_ID('dbo.patients') 
           AND name = 'gender' 
           AND system_type_id = TYPE_ID('varchar'))
BEGIN
    -- First, update any NULL or empty values
    UPDATE dbo.patients SET gender = NULL WHERE gender = '' OR gender IS NULL;
    
    -- Convert column type
    ALTER TABLE dbo.patients 
    ALTER COLUMN gender NVARCHAR(10) NULL;
    PRINT N'  Converted gender column to NVARCHAR(10)';
END

-- Add new constraint
ALTER TABLE dbo.patients
ADD CONSTRAINT CK_patients_gender 
CHECK (gender IS NULL OR gender IN (N'Nam', N'Nữ'));
PRINT N'  Added new constraint CK_patients_gender';
GO

-- =============================================
-- FIX: users table
-- =============================================
PRINT N'Fixing users.gender...';

-- Drop existing constraint
IF EXISTS (SELECT * FROM sys.check_constraints WHERE name LIKE '%users%gender%')
BEGIN
    DECLARE @constraint_name_users NVARCHAR(200);
    SELECT TOP 1 @constraint_name_users = name 
    FROM sys.check_constraints 
    WHERE parent_object_id = OBJECT_ID('dbo.users') 
    AND definition LIKE '%gender%';
    
    IF @constraint_name_users IS NOT NULL
    BEGIN
        EXEC('ALTER TABLE dbo.users DROP CONSTRAINT [' + @constraint_name_users + ']');
        PRINT N'  Dropped old constraint: ' + @constraint_name_users;
    END
END

-- Alter column to NVARCHAR if needed
IF EXISTS (SELECT * FROM sys.columns 
           WHERE object_id = OBJECT_ID('dbo.users') 
           AND name = 'gender' 
           AND system_type_id = TYPE_ID('varchar'))
BEGIN
    UPDATE dbo.users SET gender = NULL WHERE gender = '' OR gender IS NULL;
    
    ALTER TABLE dbo.users 
    ALTER COLUMN gender NVARCHAR(10) NULL;
    PRINT N'  Converted gender column to NVARCHAR(10)';
END

-- Add new constraint
ALTER TABLE dbo.users
ADD CONSTRAINT CK_users_gender 
CHECK (gender IS NULL OR gender IN (N'Nam', N'Nữ'));
PRINT N'  Added new constraint CK_users_gender';
GO

-- =============================================
-- FIX: appointments table
-- =============================================
PRINT N'Fixing appointments.patient_gender...';

-- Drop existing constraint
IF EXISTS (SELECT * FROM sys.check_constraints WHERE name LIKE '%appointment%gender%')
BEGIN
    DECLARE @constraint_name_appointments NVARCHAR(200);
    SELECT TOP 1 @constraint_name_appointments = name 
    FROM sys.check_constraints 
    WHERE parent_object_id = OBJECT_ID('dbo.appointments') 
    AND definition LIKE '%gender%';
    
    IF @constraint_name_appointments IS NOT NULL
    BEGIN
        EXEC('ALTER TABLE dbo.appointments DROP CONSTRAINT [' + @constraint_name_appointments + ']');
        PRINT N'  Dropped old constraint: ' + @constraint_name_appointments;
    END
END

-- Alter column to NVARCHAR if needed
IF EXISTS (SELECT * FROM sys.columns 
           WHERE object_id = OBJECT_ID('dbo.appointments') 
           AND name = 'patient_gender' 
           AND system_type_id = TYPE_ID('varchar'))
BEGIN
    UPDATE dbo.appointments SET patient_gender = NULL WHERE patient_gender = '' OR patient_gender IS NULL;
    
    ALTER TABLE dbo.appointments 
    ALTER COLUMN patient_gender NVARCHAR(10) NULL;
    PRINT N'  Converted patient_gender column to NVARCHAR(10)';
END

-- Add new constraint
ALTER TABLE dbo.appointments
ADD CONSTRAINT CK_appointments_patient_gender 
CHECK (patient_gender IS NULL OR patient_gender IN (N'Nam', N'Nữ'));
PRINT N'  Added new constraint CK_appointments_patient_gender';
GO

-- =============================================
-- FIX: medical_records table (if exists)
-- =============================================
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'medical_records')
BEGIN
    PRINT N'Fixing medical_records.patient_gender...';
    
    -- Drop existing constraint
    IF EXISTS (SELECT * FROM sys.check_constraints WHERE name LIKE '%medical%gender%')
    BEGIN
        DECLARE @constraint_name_medrecords NVARCHAR(200);
        SELECT TOP 1 @constraint_name_medrecords = name 
        FROM sys.check_constraints 
        WHERE parent_object_id = OBJECT_ID('dbo.medical_records') 
        AND definition LIKE '%gender%';
        
        IF @constraint_name_medrecords IS NOT NULL
        BEGIN
            EXEC('ALTER TABLE dbo.medical_records DROP CONSTRAINT [' + @constraint_name_medrecords + ']');
            PRINT N'  Dropped old constraint: ' + @constraint_name_medrecords;
        END
    END
    
    -- Alter column to NVARCHAR if needed
    IF EXISTS (SELECT * FROM sys.columns 
               WHERE object_id = OBJECT_ID('dbo.medical_records') 
               AND name = 'patient_gender' 
               AND system_type_id = TYPE_ID('varchar'))
    BEGIN
        UPDATE dbo.medical_records SET patient_gender = NULL WHERE patient_gender = '' OR patient_gender IS NULL;
        
        ALTER TABLE dbo.medical_records 
        ALTER COLUMN patient_gender NVARCHAR(10) NULL;
        PRINT N'  Converted patient_gender column to NVARCHAR(10)';
    END
    
    -- Add new constraint
    ALTER TABLE dbo.medical_records
    ADD CONSTRAINT CK_medical_records_patient_gender 
    CHECK (patient_gender IS NULL OR patient_gender IN (N'Nam', N'Nữ'));
    PRINT N'  Added new constraint CK_medical_records_patient_gender';
END
GO

-- =============================================
-- FIX: payments table (if exists)
-- =============================================
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'payments')
BEGIN
    PRINT N'Fixing payments.patient_gender...';
    
    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.payments') AND name = 'patient_gender')
    BEGIN
        -- Drop existing constraint
        IF EXISTS (SELECT * FROM sys.check_constraints WHERE name LIKE '%payment%gender%')
        BEGIN
            DECLARE @constraint_name_payments NVARCHAR(200);
            SELECT TOP 1 @constraint_name_payments = name 
            FROM sys.check_constraints 
            WHERE parent_object_id = OBJECT_ID('dbo.payments') 
            AND definition LIKE '%gender%';
            
            IF @constraint_name_payments IS NOT NULL
            BEGIN
                EXEC('ALTER TABLE dbo.payments DROP CONSTRAINT [' + @constraint_name_payments + ']');
                PRINT N'  Dropped old constraint: ' + @constraint_name_payments;
            END
        END
        
        -- Alter column to NVARCHAR if needed
        IF EXISTS (SELECT * FROM sys.columns 
                   WHERE object_id = OBJECT_ID('dbo.payments') 
                   AND name = 'patient_gender' 
                   AND system_type_id = TYPE_ID('varchar'))
        BEGIN
            UPDATE dbo.payments SET patient_gender = NULL WHERE patient_gender = '' OR patient_gender IS NULL;
            
            ALTER TABLE dbo.payments 
            ALTER COLUMN patient_gender NVARCHAR(10) NULL;
            PRINT N'  Converted patient_gender column to NVARCHAR(10)';
        END
        
        -- Add new constraint
        ALTER TABLE dbo.payments
        ADD CONSTRAINT CK_payments_patient_gender 
        CHECK (patient_gender IS NULL OR patient_gender IN (N'Nam', N'Nữ'));
        PRINT N'  Added new constraint CK_payments_patient_gender';
    END
END
GO

-- =============================================
-- FIX: service_orders table (if exists)
-- =============================================
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'service_orders')
BEGIN
    PRINT N'Fixing service_orders.patient_gender...';
    
    IF EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID('dbo.service_orders') AND name = 'patient_gender')
    BEGIN
        -- Drop existing constraint
        IF EXISTS (SELECT * FROM sys.check_constraints WHERE name LIKE '%service%gender%')
        BEGIN
            DECLARE @constraint_name_services NVARCHAR(200);
            SELECT TOP 1 @constraint_name_services = name 
            FROM sys.check_constraints 
            WHERE parent_object_id = OBJECT_ID('dbo.service_orders') 
            AND definition LIKE '%gender%';
            
            IF @constraint_name_services IS NOT NULL
            BEGIN
                EXEC('ALTER TABLE dbo.service_orders DROP CONSTRAINT [' + @constraint_name_services + ']');
                PRINT N'  Dropped old constraint: ' + @constraint_name_services;
            END
        END
        
        -- Alter column to NVARCHAR if needed
        IF EXISTS (SELECT * FROM sys.columns 
                   WHERE object_id = OBJECT_ID('dbo.service_orders') 
                   AND name = 'patient_gender' 
                   AND system_type_id = TYPE_ID('varchar'))
        BEGIN
            UPDATE dbo.service_orders SET patient_gender = NULL WHERE patient_gender = '' OR patient_gender IS NULL;
            
            ALTER TABLE dbo.service_orders 
            ALTER COLUMN patient_gender NVARCHAR(10) NULL;
            PRINT N'  Converted patient_gender column to NVARCHAR(10)';
        END
        
        -- Add new constraint
        ALTER TABLE dbo.service_orders
        ADD CONSTRAINT CK_service_orders_patient_gender 
        CHECK (patient_gender IS NULL OR patient_gender IN (N'Nam', N'Nữ'));
        PRINT N'  Added new constraint CK_service_orders_patient_gender';
    END
END
GO

PRINT N'';
PRINT N'✅ All gender column fixes completed successfully!';
PRINT N'';
PRINT N'Summary:';
PRINT N'  - Converted VARCHAR columns to NVARCHAR(10)';
PRINT N'  - Recreated CHECK constraints to allow N''Nam'' and N''Nữ''';
PRINT N'  - Applied fixes to: patients, users, appointments, medical_records, payments, service_orders';
GO
