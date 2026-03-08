-- =============================================
-- DIAGNOSTIC: Gender Column Issues
-- Run this first to see what needs fixing
-- =============================================

USE ClinicManagement;
GO

PRINT N'=== GENDER COLUMN DIAGNOSTIC ===';
PRINT N'';

-- Check patients table
PRINT N'--- PATIENTS TABLE ---';
SELECT 
    'patients' AS TableName,
    c.name AS ColumnName,
    t.name AS DataType,
    c.max_length AS MaxLength,
    c.is_nullable AS IsNullable,
    OBJECT_NAME(cc.parent_object_id) AS ConstraintTable,
    cc.name AS ConstraintName,
    cc.definition AS ConstraintDefinition
FROM sys.columns c
JOIN sys.types t ON c.user_type_id = t.user_type_id
LEFT JOIN sys.check_constraints cc ON cc.parent_object_id = c.object_id AND cc.definition LIKE '%' + c.name + '%'
WHERE c.object_id = OBJECT_ID('dbo.patients') 
AND c.name = 'gender';
GO

-- Check users table
PRINT N'--- USERS TABLE ---';
SELECT 
    'users' AS TableName,
    c.name AS ColumnName,
    t.name AS DataType,
    c.max_length AS MaxLength,
    c.is_nullable AS IsNullable,
    OBJECT_NAME(cc.parent_object_id) AS ConstraintTable,
    cc.name AS ConstraintName,
    cc.definition AS ConstraintDefinition
FROM sys.columns c
JOIN sys.types t ON c.user_type_id = t.user_type_id
LEFT JOIN sys.check_constraints cc ON cc.parent_object_id = c.object_id AND cc.definition LIKE '%' + c.name + '%'
WHERE c.object_id = OBJECT_ID('dbo.users') 
AND c.name = 'gender';
GO

-- Check appointments table
PRINT N'--- APPOINTMENTS TABLE ---';
SELECT 
    'appointments' AS TableName,
    c.name AS ColumnName,
    t.name AS DataType,
    c.max_length AS MaxLength,
    c.is_nullable AS IsNullable,
    OBJECT_NAME(cc.parent_object_id) AS ConstraintTable,
    cc.name AS ConstraintName,
    cc.definition AS ConstraintDefinition
FROM sys.columns c
JOIN sys.types t ON c.user_type_id = t.user_type_id
LEFT JOIN sys.check_constraints cc ON cc.parent_object_id = c.object_id AND cc.definition LIKE '%gender%'
WHERE c.object_id = OBJECT_ID('dbo.appointments') 
AND c.name = 'patient_gender';
GO

-- Check medical_records table
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'medical_records')
BEGIN
    PRINT N'--- MEDICAL_RECORDS TABLE ---';
    SELECT 
        'medical_records' AS TableName,
        c.name AS ColumnName,
        t.name AS DataType,
        c.max_length AS MaxLength,
        c.is_nullable AS IsNullable
    FROM sys.columns c
    JOIN sys.types t ON c.user_type_id = t.user_type_id
    WHERE c.object_id = OBJECT_ID('dbo.medical_records') 
    AND c.name = 'patient_gender';
END
GO

-- Check all CHECK constraints related to gender
PRINT N'';
PRINT N'=== ALL GENDER-RELATED CHECK CONSTRAINTS ===';
SELECT 
    OBJECT_NAME(parent_object_id) AS TableName,
    name AS ConstraintName,
    definition AS ConstraintDefinition,
    is_disabled AS IsDisabled
FROM sys.check_constraints
WHERE definition LIKE '%gender%'
ORDER BY OBJECT_NAME(parent_object_id);
GO

-- Sample existing gender values
PRINT N'';
PRINT N'=== SAMPLE GENDER VALUES IN PATIENTS ===';
IF EXISTS (SELECT * FROM sys.tables WHERE name = 'patients')
BEGIN
    SELECT TOP 10
        id,
        full_name,
        gender,
        LEN(gender) AS GenderLength,
        UNICODE(SUBSTRING(gender, 1, 1)) AS FirstCharUnicode,
        CONVERT(VARBINARY(20), gender) AS GenderBinary
    FROM dbo.patients
    WHERE gender IS NOT NULL;
END
GO

PRINT N'';
PRINT N'=== DIAGNOSTIC COMPLETE ===';
PRINT N'';
PRINT N'Next steps:';
PRINT N'1. Check if DataType is ''varchar'' (should be ''nvarchar'')';
PRINT N'2. Check if ConstraintDefinition uses N prefix: N''Nam'', N''Nữ''';
PRINT N'3. If issues found, run: fix_gender_constraints.sql';
GO
