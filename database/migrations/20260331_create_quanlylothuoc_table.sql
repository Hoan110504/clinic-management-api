USE ClinicManagement;
GO

-- Tạo bảng QuanLyLoThuoc nếu chưa tồn tại
IF OBJECT_ID('dbo.QuanLyLoThuoc', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.QuanLyLoThuoc (
        Id UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_QuanLyLoThuoc PRIMARY KEY DEFAULT NEWID(),
        MaThuoc INT NOT NULL,
        SoLo NVARCHAR(50) NOT NULL,
        HanSuDung DATE NULL,
        NgaySanXuat DATE NULL,
        SoLuongTon INT NOT NULL,
        GiaNhap DECIMAL(18,2) NULL,
        TrangThai TINYINT NULL DEFAULT(1)
    );

    -- Thêm FK tới Thuoc nếu bảng Thuoc tồn tại
    IF OBJECT_ID('dbo.Thuoc', 'U') IS NOT NULL
    BEGIN
        IF NOT EXISTS (
            SELECT 1 FROM sys.foreign_keys fk WHERE fk.parent_object_id = OBJECT_ID('dbo.QuanLyLoThuoc') AND fk.referenced_object_id = OBJECT_ID('dbo.Thuoc')
        )
        BEGIN
            ALTER TABLE dbo.QuanLyLoThuoc
            ADD CONSTRAINT FK_QuanLyLoThuoc_Thuoc FOREIGN KEY (MaThuoc) REFERENCES dbo.Thuoc(Id);
        END
    END

    -- Tạo index gợi ý
    CREATE INDEX IX_QuanLyLoThuoc_MaThuoc ON dbo.QuanLyLoThuoc(MaThuoc);
    CREATE INDEX IX_QuanLyLoThuoc_TrangThai ON dbo.QuanLyLoThuoc(TrangThai);

    PRINT 'Created table dbo.QuanLyLoThuoc';
END
ELSE
BEGIN
    PRINT 'Table dbo.QuanLyLoThuoc already exists, skipping';
END
GO
