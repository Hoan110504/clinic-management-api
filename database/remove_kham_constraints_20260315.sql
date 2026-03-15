-- File: remove_kham_constraints_20260315.sql
-- Mục đích: tạo bản sao lưu rồi xóa các ràng buộc / bảng liên quan đến "Khám và tư vấn"
-- LƯU Ý: Kiểm tra kỹ output trước khi bỏ comment các dòng EXEC để thực thi

SET NOCOUNT ON;
GO

DECLARE @d VARCHAR(8) = CONVERT(VARCHAR(8), GETDATE(), 112);
DECLARE @sql NVARCHAR(MAX);

-- 1) Backup dữ liệu sang bảng Backup_<Tên>_YYYYMMDD
IF OBJECT_ID('dbo.HoSoKham') IS NOT NULL
BEGIN
  SET @sql = N'SELECT * INTO dbo.Backup_HoSoKham_' + @d + ' FROM dbo.HoSoKham;';
  PRINT @sql;
  -- EXEC sp_executesql @sql;
END

IF OBJECT_ID('dbo.ChiSoSinhTon') IS NOT NULL
BEGIN
  SET @sql = N'SELECT * INTO dbo.Backup_ChiSoSinhTon_' + @d + ' FROM dbo.ChiSoSinhTon;';
  PRINT @sql;
  -- EXEC sp_executesql @sql;
END

IF OBJECT_ID('dbo.MedicalRecord') IS NOT NULL
BEGIN
  SET @sql = N'SELECT * INTO dbo.Backup_MedicalRecord_' + @d + ' FROM dbo.MedicalRecord;';
  PRINT @sql;
  -- EXEC sp_executesql @sql;
END

PRINT '--- Backup statements prepared. Uncomment EXEC lines to run backups.';

-- 2) Drop foreign key constraints nếu có (theo tên khai báo)
-- Danh sách constraints bạn cung cấp:
-- FK__HoSoKham__MaBacS__2057CCD0
-- FK__HoSoKham__MaBenh__1E6F845E
-- FK__HoSoKham__MaLich__1F63A897

DECLARE @fkName SYSNAME;

SET @fkName = N'FK__HoSoKham__MaBacS__2057CCD0';
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = @fkName)
BEGIN
  SELECT @sql = N'ALTER TABLE [' + SCHEMA_NAME(t.schema_id) + '].[' + t.name + '] DROP CONSTRAINT [' + fk.name + '];'
  FROM sys.foreign_keys fk
  JOIN sys.tables t ON fk.parent_object_id = t.object_id
  WHERE fk.name = @fkName;
  PRINT @sql;
  -- EXEC sp_executesql @sql;
END

SET @fkName = N'FK__HoSoKham__MaBenh__1E6F845E';
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = @fkName)
BEGIN
  SELECT @sql = N'ALTER TABLE [' + SCHEMA_NAME(t.schema_id) + '].[' + t.name + '] DROP CONSTRAINT [' + fk.name + '];'
  FROM sys.foreign_keys fk
  JOIN sys.tables t ON fk.parent_object_id = t.object_id
  WHERE fk.name = @fkName;
  PRINT @sql;
  -- EXEC sp_executesql @sql;
END

SET @fkName = N'FK__HoSoKham__MaLich__1F63A897';
IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = @fkName)
BEGIN
  SELECT @sql = N'ALTER TABLE [' + SCHEMA_NAME(t.schema_id) + '].[' + t.name + '] DROP CONSTRAINT [' + fk.name + '];'
  FROM sys.foreign_keys fk
  JOIN sys.tables t ON fk.parent_object_id = t.object_id
  WHERE fk.name = @fkName;
  PRINT @sql;
  -- EXEC sp_executesql @sql;
END

PRINT '--- FK drop statements prepared. Uncomment EXEC lines to run.';

-- 3) Drop default constraints nếu có (theo tên)
-- DF__ChiSoSinhTon__Id__36470DEF
-- DF_ChiSoSinhTon_ThoiDiemDo

DECLARE @dcName SYSNAME;
SET @dcName = N'DF__ChiSoSinhTon__Id__36470DEF';
IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = @dcName)
BEGIN
  SELECT @sql = N'ALTER TABLE [' + SCHEMA_NAME(t.schema_id) + '].[' + t.name + '] DROP CONSTRAINT [' + dc.name + '];'
  FROM sys.default_constraints dc
  JOIN sys.tables t ON dc.parent_object_id = t.object_id
  WHERE dc.name = @dcName;
  PRINT @sql;
  -- EXEC sp_executesql @sql;
END

SET @dcName = N'DF_ChiSoSinhTon_ThoiDiemDo';
IF EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = @dcName)
BEGIN
  SELECT @sql = N'ALTER TABLE [' + SCHEMA_NAME(t.schema_id) + '].[' + t.name + '] DROP CONSTRAINT [' + dc.name + '];'
  FROM sys.default_constraints dc
  JOIN sys.tables t ON dc.parent_object_id = t.object_id
  WHERE dc.name = @dcName;
  PRINT @sql;
  -- EXEC sp_executesql @sql;
END

PRINT '--- Default constraint drop statements prepared. Uncomment EXEC lines to run.';

-- 4) Drop primary key constraints (nếu bạn muốn xóa PK trước khi drop table)
-- PK__HoSoKham__3214EC07AF05AABD
-- PK_ChiSoSinhTon

DECLARE @pkName SYSNAME;
SET @pkName = N'PK__HoSoKham__3214EC07AF05AABD';
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = @pkName)
BEGIN
  SELECT @sql = N'ALTER TABLE [' + SCHEMA_NAME(t.schema_id) + '].[' + t.name + '] DROP CONSTRAINT [' + kc.name + '];'
  FROM sys.key_constraints kc
  JOIN sys.tables t ON kc.parent_object_id = t.object_id
  WHERE kc.name = @pkName;
  PRINT @sql;
  -- EXEC sp_executesql @sql;
END

SET @pkName = N'PK_ChiSoSinhTon';
IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = @pkName)
BEGIN
  SELECT @sql = N'ALTER TABLE [' + SCHEMA_NAME(t.schema_id) + '].[' + t.name + '] DROP CONSTRAINT [' + kc.name + '];'
  FROM sys.key_constraints kc
  JOIN sys.tables t ON kc.parent_object_id = t.object_id
  WHERE kc.name = @pkName;
  PRINT @sql;
  -- EXEC sp_executesql @sql;
END

PRINT '--- PK drop statements prepared. Uncomment EXEC lines to run.';

-- 5) Cuối cùng: xóa bảng nếu đã backup và đã xóa các ràng buộc tham chiếu
PRINT '--- Các lệnh DROP TABLE (chỉ chạy khi bạn đã chắc chắn)';
IF OBJECT_ID('dbo.HoSoKham') IS NOT NULL
  PRINT 'DROP TABLE dbo.HoSoKham;';
IF OBJECT_ID('dbo.ChiSoSinhTon') IS NOT NULL
  PRINT 'DROP TABLE dbo.ChiSoSinhTon;';
IF OBJECT_ID('dbo.MedicalRecord') IS NOT NULL
  PRINT 'DROP TABLE dbo.MedicalRecord;';

PRINT '--- Kiểm tra kỹ các lệnh in ra ở trên. Khi xác nhận, thay đổi PRINT -> EXEC hoặc bỏ comment các EXEC sp_executesql.';
GO
