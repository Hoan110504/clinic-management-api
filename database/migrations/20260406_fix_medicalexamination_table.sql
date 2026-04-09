-- Migration: fix MedicalExaminations schema
-- Synchronized with actual DB schema (2026-04-09)

-- Drop legacy table shape that used old columns/types (ExaminationCode, PatientID, NVARCHAR AppointmentID)
IF OBJECT_ID('dbo.MedicalExaminations', 'U') IS NOT NULL
BEGIN
  IF COL_LENGTH('dbo.MedicalExaminations', 'ExaminationCode') IS NOT NULL
     OR COL_LENGTH('dbo.MedicalExaminations', 'PatientID') IS NOT NULL
  BEGIN
    PRINT 'Dropping legacy MedicalExaminations schema to recreate synchronized schema...';
    DROP TABLE dbo.MedicalExaminations;
  END
END

-- Create synchronized table if needed
IF OBJECT_ID('dbo.MedicalExaminations', 'U') IS NULL
BEGIN
  PRINT 'Creating synchronized MedicalExaminations table...';
  CREATE TABLE dbo.MedicalExaminations (
    ExaminationID BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    ExaminationDate DATETIME2 NULL,
    Symptoms NVARCHAR(MAX) NULL,
    BloodPressure NVARCHAR(20) NULL,
    Pulse INT NULL,
    Temperature DECIMAL(10,2) NULL,
    SpO2 INT NULL,
    RespirationRate INT NULL,
    Weight DECIMAL(10,2) NULL,
    Height DECIMAL(10,2) NULL,
    BMI DECIMAL(10,2) NULL,
    Diagnosis NVARCHAR(MAX) NULL,
    ICD10Code NVARCHAR(20) NULL,
    TreatmentAdvice NVARCHAR(MAX) NULL,
    Notes NVARCHAR(MAX) NULL,
    ReExaminationDate DATE NULL,
    PrescriptionStatus TINYINT NULL DEFAULT 0,
    CreatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    UpdatedAt DATETIMEOFFSET NOT NULL DEFAULT SYSDATETIMEOFFSET(),
    DoctorID BIGINT NULL,
    PatientId BIGINT NULL,
    AppointmentID BIGINT NOT NULL
  );

  CREATE INDEX IX_MedicalExaminations_AppointmentID ON dbo.MedicalExaminations(AppointmentID);
  CREATE INDEX IX_MedicalExaminations_PatientId ON dbo.MedicalExaminations(PatientId);
  CREATE INDEX IX_MedicalExaminations_DoctorID ON dbo.MedicalExaminations(DoctorID);
  CREATE INDEX IX_MedicalExaminations_CreatedAt ON dbo.MedicalExaminations(CreatedAt);

  PRINT 'MedicalExaminations table synchronized successfully.';
END
ELSE
BEGIN
  PRINT 'MedicalExaminations table already synchronized.';
END
