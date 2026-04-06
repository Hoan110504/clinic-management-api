-- Migration: Fix MedicalExamination table schema
-- Drops old incorrect schema and creates correct one matching Sequelize model
-- Run this to fix the DATABASE_ERROR when creating medical examination records

-- Step 1: Drop the old incorrectly-named table if it exists with wrong columns
IF OBJECT_ID('dbo.MedicalExamination', 'U') IS NOT NULL
BEGIN
  -- Check if table has the old (wrong) columns - if so, drop it
  IF COL_LENGTH('dbo.MedicalExamination', 'id') IS NOT NULL
     AND COL_LENGTH('dbo.MedicalExamination', 'ExaminationID') IS NULL
  BEGIN
    PRINT 'Dropping old MedicalExamination table with incorrect schema...';
    DROP TABLE dbo.MedicalExamination;
  END
END

-- Step 2: Create the correct table if it doesn't exist
IF OBJECT_ID('dbo.MedicalExamination', 'U') IS NULL
BEGIN
  PRINT 'Creating MedicalExamination table with correct schema...';
  CREATE TABLE dbo.MedicalExamination (
    -- Primary key and identifiers
    ExaminationID BIGINT PRIMARY KEY IDENTITY(1,1) NOT NULL,
    ExaminationCode NVARCHAR(50) NOT NULL,
    AppointmentID NVARCHAR(50) NOT NULL,
    PatientID NVARCHAR(50) NOT NULL,
    DoctorID CHAR(36) NULL,
    ExaminationDate DATETIME2 NULL,

    -- I. Symptoms
    Symptoms NVARCHAR(MAX) NULL,

    -- II. Vital Signs (Health Indicators)
    BloodPressure NVARCHAR(20) NULL,
    Pulse INT NULL,
    Temperature DECIMAL(4,1) NULL,
    SpO2 INT NULL,
    RespirationRate INT NULL,
    Weight DECIMAL(5,2) NULL,
    Height DECIMAL(5,2) NULL,
    BMI DECIMAL(5,2) NULL,

    -- III. Diagnosis and Treatment
    Diagnosis NVARCHAR(MAX) NULL,
    ICD10Code NVARCHAR(20) NULL,
    TreatmentAdvice NVARCHAR(MAX) NULL,
    Notes NVARCHAR(MAX) NULL,
    ReExaminationDate DATE NULL,

    -- IV. Lab/Imaging/ECG Orders and Results
    LabOrders NVARCHAR(MAX) NULL,
    ImagingOrders NVARCHAR(MAX) NULL,
    ECGOrders NVARCHAR(MAX) NULL,
    LabResults NVARCHAR(MAX) NULL,
    ImagingResults NVARCHAR(MAX) NULL,
    ECGResults NVARCHAR(MAX) NULL,

    -- V. Prescription
    PrescriptionID UNIQUEIDENTIFIER NULL,
    PrescriptionStatus TINYINT NULL DEFAULT 0,

    -- Timestamps
    CreatedAt DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET(),
    UpdatedAt DATETIMEOFFSET DEFAULT SYSDATETIMEOFFSET()
  );

  PRINT 'Creating indexes on MedicalExamination table...';
  CREATE INDEX IX_MedicalExamination_AppointmentId ON dbo.MedicalExamination(AppointmentID);
  CREATE INDEX IX_MedicalExamination_PatientId ON dbo.MedicalExamination(PatientID);
  CREATE INDEX IX_MedicalExamination_DoctorId ON dbo.MedicalExamination(DoctorID);
  CREATE INDEX IX_MedicalExamination_ExaminationCode ON dbo.MedicalExamination(ExaminationCode);
  CREATE INDEX IX_MedicalExamination_CreatedAt ON dbo.MedicalExamination(CreatedAt);

  PRINT 'MedicalExamination table created successfully!';
END
ELSE
BEGIN
  PRINT 'MedicalExamination table already exists with correct schema.';
END
