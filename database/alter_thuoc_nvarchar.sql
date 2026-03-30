-- alter_thuoc_nvarchar.sql
-- Convert NhomThuoc (Danh mục) to NVARCHAR to support Vietnamese characters
SET NOCOUNT ON;

IF OBJECT_ID('dbo.Thuoc', 'U') IS NULL
BEGIN
    PRINT 'Table dbo.Thuoc does not exist. Aborting.';
    RETURN;
END

BEGIN TRANSACTION;
BEGIN TRY

    -- Backup: create a temporary copy of the column values (optional safety)
    IF OBJECT_ID('tempdb..#thuoc_backup') IS NOT NULL DROP TABLE #thuoc_backup;
    SELECT Id, NhomThuoc INTO #thuoc_backup FROM dbo.Thuoc;

    -- Alter column to NVARCHAR(255) NULL (adjust length if you prefer)
    ALTER TABLE dbo.Thuoc ALTER COLUMN NhomThuoc NVARCHAR(255) NULL;

    COMMIT TRANSACTION;
    PRINT 'Column NhomThuoc converted to NVARCHAR(255) successfully.';

END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION;
    PRINT 'Error when altering column NhomThuoc:';
    PRINT ERROR_MESSAGE();
END CATCH;
