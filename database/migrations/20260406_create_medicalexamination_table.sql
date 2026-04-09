-- Migration: create MedicalExaminations table for MSSQL
-- Synchronized with actual DB schema (2026-04-09)
IF OBJECT_ID('dbo.MedicalExaminations', 'U') IS NULL
BEGIN
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
END
