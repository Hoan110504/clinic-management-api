-- Cleanup (run AFTER you've verified application + data)
-- WARNING: Keep backups. Only run when you're 100% sure.

SET NOCOUNT ON;

IF OBJECT_ID('dbo.Thuoc_old','U') IS NOT NULL
BEGIN
    DROP TABLE dbo.Thuoc_old;
    PRINT 'Dropped dbo.Thuoc_old';
END
ELSE
    PRINT 'dbo.Thuoc_old not found, skipping';

IF OBJECT_ID('dbo.Thuoc_Id_Map','U') IS NOT NULL
BEGIN
    DROP TABLE dbo.Thuoc_Id_Map;
    PRINT 'Dropped dbo.Thuoc_Id_Map';
END
ELSE
    PRINT 'dbo.Thuoc_Id_Map not found, skipping';

PRINT 'Cleanup complete.';
