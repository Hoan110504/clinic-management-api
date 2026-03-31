USE ClinicManagement;
GO

-- Thêm cột MaThuoc vào GiaoDichKho nếu chưa tồn tại
IF COL_LENGTH('dbo.GiaoDichKho', 'MaThuoc') IS NULL
BEGIN
    ALTER TABLE dbo.GiaoDichKho
    ADD MaThuoc INT NULL;

    -- Populate MaThuoc từ QuanLyLoThuoc (dựa trên MaLoThuoc)
    UPDATE dbo.GiaoDichKho
    SET MaThuoc = (
        SELECT qlt.MaThuoc
        FROM dbo.QuanLyLoThuoc qlt
        WHERE qlt.Id = dbo.GiaoDichKho.MaLoThuoc
    )
    WHERE MaLoThuoc IS NOT NULL;

    -- Thêm FK tới Thuoc nếu bảng Thuoc tồn tại
    IF OBJECT_ID('dbo.Thuoc', 'U') IS NOT NULL
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
            WHERE TABLE_NAME = 'GiaoDichKho' AND COLUMN_NAME = 'MaThuoc' AND CONSTRAINT_NAME LIKE 'FK_%'
        )
        BEGIN
            ALTER TABLE dbo.GiaoDichKho
            ADD CONSTRAINT FK_GiaoDichKho_Thuoc FOREIGN KEY (MaThuoc) 
                REFERENCES dbo.Thuoc(Id);
        END
    END

    -- Tạo index cho MaThuoc
    IF NOT EXISTS (SELECT name FROM sys.indexes WHERE name = 'IX_GiaoDichKho_MaThuoc')
    BEGIN
        CREATE INDEX IX_GiaoDichKho_MaThuoc ON dbo.GiaoDichKho(MaThuoc);
    END

    PRINT 'Added MaThuoc column to dbo.GiaoDichKho';
END
ELSE
BEGIN
    PRINT 'MaThuoc column already exists in dbo.GiaoDichKho';
END
GO
