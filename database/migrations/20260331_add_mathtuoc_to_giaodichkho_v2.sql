USE ClinicManagement;
GO

PRINT 'Starting migration: Add MaThuoc to GiaoDichKho...';

-- Step 1: Check if column exists
DECLARE @ColumnExists INT = 0;
SELECT @ColumnExists = COUNT(*) 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'GiaoDichKho' AND COLUMN_NAME = 'MaThuoc';

IF @ColumnExists = 0
BEGIN
    PRINT 'Step 1: Adding MaThuoc column...';
    
    -- Add the column
    ALTER TABLE dbo.GiaoDichKho
    ADD MaThuoc INT NULL;
    
    PRINT 'Step 2: MaThuoc column added successfully';
    
    -- Step 2: Populate MaThuoc from QuanLyLoThuoc
    PRINT 'Step 3: Populating MaThuoc from QuanLyLoThuoc...';
    
    UPDATE gdk
    SET gdk.MaThuoc = qlt.MaThuoc
    FROM dbo.GiaoDichKho gdk
    INNER JOIN dbo.QuanLyLoThuoc qlt ON gdk.MaLoThuoc = qlt.Id
    WHERE gdk.MaThuoc IS NULL AND gdk.MaLoThuoc IS NOT NULL;
    
    PRINT 'Step 4: Data populated';
    
    -- Step 3: Add FK constraint if Thuoc table exists
    IF OBJECT_ID('dbo.Thuoc', 'U') IS NOT NULL
    BEGIN
        PRINT 'Step 5: Adding FK constraint to Thuoc...';
        
        DECLARE @FKExists INT = 0;
        SELECT @FKExists = COUNT(*) 
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
        WHERE TABLE_NAME = 'GiaoDichKho' 
        AND COLUMN_NAME = 'MaThuoc' 
        AND CONSTRAINT_NAME LIKE 'FK_GiaoDichKho_Thuoc%';
        
        IF @FKExists = 0
        BEGIN
            ALTER TABLE dbo.GiaoDichKho
            ADD CONSTRAINT FK_GiaoDichKho_Thuoc FOREIGN KEY (MaThuoc) 
                REFERENCES dbo.Thuoc(Id);
            PRINT 'Step 5a: FK constraint added';
        END
        ELSE
        BEGIN
            PRINT 'Step 5b: FK constraint already exists';
        END
    END
    
    -- Step 4: Add index if not exists
    PRINT 'Step 6: Adding index...';
    
    IF NOT EXISTS (
        SELECT 1 FROM sys.indexes 
        WHERE name = 'IX_GiaoDichKho_MaThuoc' 
        AND object_id = OBJECT_ID('dbo.GiaoDichKho')
    )
    BEGIN
        CREATE INDEX IX_GiaoDichKho_MaThuoc ON dbo.GiaoDichKho(MaThuoc);
        PRINT 'Step 6a: Index created';
    END
    ELSE
    BEGIN
        PRINT 'Step 6b: Index already exists';
    END
    
    PRINT 'Migration completed successfully!';
END
ELSE
BEGIN
    PRINT 'MaThuoc column already exists in dbo.GiaoDichKho. Skipping migration.';
END

GO

PRINT 'Migration finished!';
GO
