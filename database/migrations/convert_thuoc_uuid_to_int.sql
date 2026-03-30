-- Migration: convert dbo.Thuoc.Id from UNIQUEIDENTIFIER -> INT IDENTITY(1,1)
-- Goal: Thuoc.Id is sequential STT (1,2,3,...) instead of UUID.
-- Safe usage: run on DEV/STAGING first, then PROD after backup.

SET NOCOUNT ON;
SET XACT_ABORT ON;

IF OBJECT_ID('dbo.Thuoc', 'U') IS NULL
BEGIN
    RAISERROR(N'Table dbo.Thuoc does not exist.', 16, 1);
    RETURN;
END

DECLARE @IdType NVARCHAR(128);
SELECT @IdType = TYPE_NAME(c.user_type_id)
FROM sys.columns c
WHERE c.object_id = OBJECT_ID('dbo.Thuoc')
  AND c.name = 'Id';

IF @IdType IS NULL
BEGIN
    RAISERROR(N'Column dbo.Thuoc.Id does not exist.', 16, 1);
    RETURN;
END

IF @IdType IN (N'int', N'bigint', N'smallint', N'tinyint')
BEGIN
    PRINT N'dbo.Thuoc.Id is already numeric. No migration needed.';
    RETURN;
END

BEGIN TRANSACTION;

BEGIN TRY
    -- Prevent overwrite from previous attempts
    IF OBJECT_ID('dbo.Thuoc_old', 'U') IS NOT NULL
    BEGIN
        RAISERROR(N'Backup table dbo.Thuoc_old already exists. Please archive/drop it before rerun.', 16, 1);
    END

    -- Preserve old table
    EXEC sp_rename 'dbo.Thuoc', 'Thuoc_old';

    -- Create new table with sequential Id
    CREATE TABLE dbo.Thuoc (
        Id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
        TenThuoc NVARCHAR(150) NOT NULL UNIQUE,
        DonVi NVARCHAR(50) NULL,
        NhomThuoc NVARCHAR(100) NULL,
        GiaBan DECIMAL(18,2) NULL,
        TrangThai BIT NOT NULL DEFAULT 1
    );

    -- Copy data in deterministic order so Id assignment is stable
    INSERT INTO dbo.Thuoc (TenThuoc, DonVi, NhomThuoc, GiaBan, TrangThai)
    SELECT TenThuoc, DonVi, NhomThuoc, GiaBan, TrangThai
    FROM dbo.Thuoc_old
    ORDER BY Id;

    -- Mapping table old UUID -> new INT
    IF OBJECT_ID('dbo.Thuoc_Id_Map', 'U') IS NOT NULL
        DROP TABLE dbo.Thuoc_Id_Map;

    CREATE TABLE dbo.Thuoc_Id_Map (
        OldId UNIQUEIDENTIFIER NOT NULL PRIMARY KEY,
        NewId INT NOT NULL
    );

    INSERT INTO dbo.Thuoc_Id_Map (OldId, NewId)
    SELECT o.Id, n.Id
    FROM dbo.Thuoc_old o
    JOIN dbo.Thuoc n ON n.TenThuoc = o.TenThuoc;

    -- =============================
    -- Migrate dbo.QuanLyLoThuoc.MaThuoc
    -- =============================
    IF OBJECT_ID('dbo.QuanLyLoThuoc', 'U') IS NOT NULL
    BEGIN
        IF COL_LENGTH('dbo.QuanLyLoThuoc', 'MaThuoc') IS NOT NULL
        BEGIN
            ALTER TABLE dbo.QuanLyLoThuoc ADD MaThuoc_New INT NULL;

            UPDATE q
            SET MaThuoc_New = m.NewId
            FROM dbo.QuanLyLoThuoc q
            JOIN dbo.Thuoc_Id_Map m ON TRY_CONVERT(UNIQUEIDENTIFIER, q.MaThuoc) = m.OldId;

            -- Drop FKs on MaThuoc dynamically
            DECLARE @sqlQltFk NVARCHAR(MAX) = N'';
            SELECT @sqlQltFk = @sqlQltFk + N'ALTER TABLE dbo.QuanLyLoThuoc DROP CONSTRAINT [' + fk.name + N'];'
            FROM sys.foreign_keys fk
            JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
            JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
            WHERE fkc.parent_object_id = OBJECT_ID('dbo.QuanLyLoThuoc')
              AND c.name = 'MaThuoc';
            IF LEN(@sqlQltFk) > 0 EXEC sp_executesql @sqlQltFk;

            -- Drop indexes on MaThuoc dynamically
            DECLARE @sqlQltIdx NVARCHAR(MAX) = N'';
            SELECT @sqlQltIdx = @sqlQltIdx + N'DROP INDEX [' + i.name + N'] ON dbo.QuanLyLoThuoc;'
            FROM sys.indexes i
            JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
            JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
            WHERE i.object_id = OBJECT_ID('dbo.QuanLyLoThuoc')
              AND i.is_primary_key = 0
              AND i.is_unique_constraint = 0
              AND c.name = 'MaThuoc';
            IF LEN(@sqlQltIdx) > 0 EXEC sp_executesql @sqlQltIdx;

            ALTER TABLE dbo.QuanLyLoThuoc DROP COLUMN MaThuoc;
            EXEC sp_rename 'dbo.QuanLyLoThuoc.MaThuoc_New', 'MaThuoc', 'COLUMN';
            ALTER TABLE dbo.QuanLyLoThuoc ALTER COLUMN MaThuoc INT NOT NULL;

            ALTER TABLE dbo.QuanLyLoThuoc
            ADD CONSTRAINT FK_QuanLyLoThuoc_Thuoc
            FOREIGN KEY (MaThuoc) REFERENCES dbo.Thuoc(Id);

            CREATE INDEX IX_QuanLyLoThuoc_MaThuoc ON dbo.QuanLyLoThuoc(MaThuoc);
        END
    END

    -- =============================
    -- Migrate dbo.ChiTietDonThuoc.MaThuoc
    -- =============================
    IF OBJECT_ID('dbo.ChiTietDonThuoc', 'U') IS NOT NULL
    BEGIN
        IF COL_LENGTH('dbo.ChiTietDonThuoc', 'MaThuoc') IS NOT NULL
        BEGIN
            ALTER TABLE dbo.ChiTietDonThuoc ADD MaThuoc_New INT NULL;

            UPDATE c
            SET MaThuoc_New = m.NewId
            FROM dbo.ChiTietDonThuoc c
            JOIN dbo.Thuoc_Id_Map m ON TRY_CONVERT(UNIQUEIDENTIFIER, c.MaThuoc) = m.OldId;

            -- Drop FKs on MaThuoc dynamically
            DECLARE @sqlCtFk NVARCHAR(MAX) = N'';
            SELECT @sqlCtFk = @sqlCtFk + N'ALTER TABLE dbo.ChiTietDonThuoc DROP CONSTRAINT [' + fk.name + N'];'
            FROM sys.foreign_keys fk
            JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
            JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
            WHERE fkc.parent_object_id = OBJECT_ID('dbo.ChiTietDonThuoc')
              AND c.name = 'MaThuoc';
            IF LEN(@sqlCtFk) > 0 EXEC sp_executesql @sqlCtFk;

            -- Drop indexes on MaThuoc dynamically
            DECLARE @sqlCtIdx NVARCHAR(MAX) = N'';
            SELECT @sqlCtIdx = @sqlCtIdx + N'DROP INDEX [' + i.name + N'] ON dbo.ChiTietDonThuoc;'
            FROM sys.indexes i
            JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
            JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
            WHERE i.object_id = OBJECT_ID('dbo.ChiTietDonThuoc')
              AND i.is_primary_key = 0
              AND i.is_unique_constraint = 0
              AND c.name = 'MaThuoc';
            IF LEN(@sqlCtIdx) > 0 EXEC sp_executesql @sqlCtIdx;

            ALTER TABLE dbo.ChiTietDonThuoc DROP COLUMN MaThuoc;
            EXEC sp_rename 'dbo.ChiTietDonThuoc.MaThuoc_New', 'MaThuoc', 'COLUMN';
            ALTER TABLE dbo.ChiTietDonThuoc ALTER COLUMN MaThuoc INT NOT NULL;

            ALTER TABLE dbo.ChiTietDonThuoc
            ADD CONSTRAINT FK_ChiTietDonThuoc_Thuoc
            FOREIGN KEY (MaThuoc) REFERENCES dbo.Thuoc(Id);

            CREATE INDEX IX_ChiTietDonThuoc_MaThuoc ON dbo.ChiTietDonThuoc(MaThuoc);
        END
    END

    COMMIT TRANSACTION;

    PRINT N'Migration completed successfully.';
    PRINT N'dbo.Thuoc.Id now uses sequential INT IDENTITY.';
    PRINT N'Keep dbo.Thuoc_old and dbo.Thuoc_Id_Map for verification/rollback.';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0
        ROLLBACK TRANSACTION;

    DECLARE @Err NVARCHAR(4000) = ERROR_MESSAGE();
    RAISERROR(N'Migration failed: %s', 16, 1, @Err);
END CATCH;
