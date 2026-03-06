-- =============================================
-- HỆ THỐNG QUẢN LÝ PHÒNG KHÁM NỘI KHOA
-- Database Schema for SQL Server
-- =============================================

-- Tạo database
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'ClinicManagement')
BEGIN
    CREATE DATABASE ClinicManagement
    COLLATE Vietnamese_CI_AS;
END
GO

USE ClinicManagement;
GO

-- =============================================
-- I. BẢNG NGƯỜI DÙNG - NguoiDung
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[NguoiDung]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[NguoiDung] (
        [Id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [TenDangNhap] NVARCHAR(50) NOT NULL UNIQUE,
        [Email] VARCHAR(100) NULL UNIQUE,
        [MatKhau] VARCHAR(255) NOT NULL,
        [HoTen] NVARCHAR(100) NOT NULL,
        [VaiTro] TINYINT NOT NULL, -- 1:Admin, 2:Bác sĩ, 3:Lễ tân, 4:Dược sĩ, 5:Bệnh nhân
        [SoDienThoai] VARCHAR(15),
        [NgaySinh] DATE,
        [GioiTinh] TINYINT, -- 0:Khác, 1:Nam, 2:Nữ
        [DiaChi] NVARCHAR(255),
        [CCCD] VARCHAR(20) UNIQUE NULL,
        [TrangThaiHoatDong] BIT DEFAULT 1,
        [NgayTao] DATETIME DEFAULT GETDATE(),
        [NgayCapNhat] DATETIME NULL,
        [NgayXoa] DATETIME NULL,

        CONSTRAINT CHK_NguoiDung_VaiTro CHECK ([VaiTro] IN (1, 2, 3, 4, 5)),
        CONSTRAINT CHK_NguoiDung_GioiTinh CHECK ([GioiTinh] IS NULL OR [GioiTinh] IN (0, 1, 2))
    );
END
GO

-- Index cho NguoiDung
CREATE INDEX IX_NguoiDung_VaiTro ON [dbo].[NguoiDung]([VaiTro]);
CREATE INDEX IX_NguoiDung_TrangThaiHoatDong ON [dbo].[NguoiDung]([TrangThaiHoatDong]);
GO

-- =============================================
-- II. BẢNG BỆNH NHÂN - BenhNhan
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[BenhNhan]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[BenhNhan] (
        [Id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [MaNguoiDung] UNIQUEIDENTIFIER UNIQUE NOT NULL,
        [TienSuBenh] NVARCHAR(MAX),
        [DiUng] NVARCHAR(MAX),
        [NguoiLienHeKhanCap] NVARCHAR(100),
        [SDTNguoiLienHe] VARCHAR(15),
        [GhiChu] NVARCHAR(MAX),
        [NgayTao] DATETIME DEFAULT GETDATE(),
        [NgayCapNhat] DATETIME NULL,
        [NgayXoa] DATETIME NULL,

        CONSTRAINT FK_BenhNhan_NguoiDung FOREIGN KEY ([MaNguoiDung]) 
            REFERENCES [dbo].[NguoiDung]([Id]) ON DELETE CASCADE
    );
END
GO

-- =============================================
-- III. BẢNG LỊCH HẸN - LichHen
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[LichHen]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[LichHen] (
        [Id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [MaBenhNhan] UNIQUEIDENTIFIER NOT NULL,
        [NgayHen] DATETIME NOT NULL,
        [ThoiLuongDuKien] INT,
        [LoaiKham] NVARCHAR(100),
        [TrieuChung] NVARCHAR(MAX),
        [BacSiUuTienId] UNIQUEIDENTIFIER NULL,
        [BacSiDuocPhanId] UNIQUEIDENTIFIER NULL,
        [TrangThai] TINYINT DEFAULT 0, -- 0:Chờ xác nhận, 1:Đã xác nhận, 2:Đang khám, 3:Hoàn thành, 4:Đã hủy
        [ThoiGianXacNhan] DATETIME NULL,
        [ThoiGianHuy] DATETIME NULL,
        [LyDoHuy] NVARCHAR(255) NULL,
        [GhiChuBenhNhan] NVARCHAR(MAX),
        [GhiChuNoiBo] NVARCHAR(MAX),
        [NgayTao] DATETIME DEFAULT GETDATE(),

        CONSTRAINT FK_LichHen_BenhNhan FOREIGN KEY ([MaBenhNhan]) 
            REFERENCES [dbo].[BenhNhan]([Id]),
        CONSTRAINT FK_LichHen_BacSiUuTien FOREIGN KEY ([BacSiUuTienId]) 
            REFERENCES [dbo].[NguoiDung]([Id]),
        CONSTRAINT FK_LichHen_BacSiDuocPhan FOREIGN KEY ([BacSiDuocPhanId]) 
            REFERENCES [dbo].[NguoiDung]([Id]),
        -- Chống trùng lịch bác sĩ
        CONSTRAINT UQ_LichHen_BacSi_NgayHen UNIQUE ([BacSiDuocPhanId], [NgayHen])
    );
END
GO

-- Index cho LichHen
CREATE INDEX IX_LichHen_MaBenhNhan ON [dbo].[LichHen]([MaBenhNhan]);
CREATE INDEX IX_LichHen_NgayHen ON [dbo].[LichHen]([NgayHen]);
CREATE INDEX IX_LichHen_TrangThai ON [dbo].[LichHen]([TrangThai]);
GO

-- =============================================
-- IV. HỒ SƠ KHÁM - HoSoKham
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[HoSoKham]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[HoSoKham] (
        [Id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [MaBenhNhan] UNIQUEIDENTIFIER NOT NULL,
        [MaLichHen] UNIQUEIDENTIFIER UNIQUE,
        [MaBacSi] UNIQUEIDENTIFIER NOT NULL,
        [ThoiGianBatDau] DATETIME,
        [ThoiGianHoanThanh] DATETIME,
        [MucDichKham] NVARCHAR(255),
        [TrieuChung] NVARCHAR(MAX),
        [ChanDoan] NVARCHAR(MAX),
        [HuongDieuTri] NVARCHAR(MAX),
        [HenTaiKham] DATETIME,
        [TrangThai] TINYINT, -- 0:Chờ khám, 1:Đang khám, 2:Hoàn thành
        [NgayTao] DATETIME DEFAULT GETDATE(),

        CONSTRAINT FK_HoSoKham_BenhNhan FOREIGN KEY ([MaBenhNhan]) 
            REFERENCES [dbo].[BenhNhan]([Id]),
        CONSTRAINT FK_HoSoKham_LichHen FOREIGN KEY ([MaLichHen]) 
            REFERENCES [dbo].[LichHen]([Id]),
        CONSTRAINT FK_HoSoKham_BacSi FOREIGN KEY ([MaBacSi]) 
            REFERENCES [dbo].[NguoiDung]([Id])
    );
END
GO

-- Index cho HoSoKham
CREATE INDEX IX_HoSoKham_MaBenhNhan ON [dbo].[HoSoKham]([MaBenhNhan]);
CREATE INDEX IX_HoSoKham_MaBacSi ON [dbo].[HoSoKham]([MaBacSi]);
CREATE INDEX IX_HoSoKham_TrangThai ON [dbo].[HoSoKham]([TrangThai]);
GO

-- =============================================
-- V. CHỈ SỐ SINH TỒN - ChiSoSinhTon
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ChiSoSinhTon]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[ChiSoSinhTon] (
        [Id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [MaHoSoKham] UNIQUEIDENTIFIER NOT NULL,
        [HuyetAp] NVARCHAR(20),
        [NhipTim] INT,
        [NhietDo] DECIMAL(4,1),
        [CanNang] DECIMAL(5,2),
        [ChieuCao] DECIMAL(5,2),
        [SpO2] INT,
        [ThoiDiemDo] DATETIME DEFAULT GETDATE(),

        CONSTRAINT FK_ChiSoSinhTon_HoSoKham FOREIGN KEY ([MaHoSoKham]) 
            REFERENCES [dbo].[HoSoKham]([Id])
    );
END
GO

-- Index cho ChiSoSinhTon
CREATE INDEX IX_ChiSoSinhTon_MaHoSoKham ON [dbo].[ChiSoSinhTon]([MaHoSoKham]);
GO

-- =============================================
-- VI. THUỐC - Thuoc
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Thuoc]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Thuoc] (
        [Id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [TenThuoc] NVARCHAR(150) NOT NULL UNIQUE,
        [DonVi] NVARCHAR(50),
        [NhomThuoc] NVARCHAR(100),
        [TrangThai] BIT DEFAULT 1
    );
END
GO

-- Index cho Thuoc
CREATE INDEX IX_Thuoc_NhomThuoc ON [dbo].[Thuoc]([NhomThuoc]);
CREATE INDEX IX_Thuoc_TrangThai ON [dbo].[Thuoc]([TrangThai]);
GO

-- =============================================
-- VII. QUẢN LÝ LÔ THUỐC - QuanLyLoThuoc
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[QuanLyLoThuoc]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[QuanLyLoThuoc] (
        [Id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [MaThuoc] UNIQUEIDENTIFIER NOT NULL,
        [SoLo] VARCHAR(50) NOT NULL,
        [HanSuDung] DATE,
        [NgaySanXuat] DATE,
        [SoLuongTon] INT NOT NULL,
        [GiaNhap] DECIMAL(18,2),
        [TrangThai] TINYINT DEFAULT 1, -- 1:Còn hàng, 0:Hết hàng, 2:Hết hạn

        CONSTRAINT FK_QuanLyLoThuoc_Thuoc FOREIGN KEY ([MaThuoc]) 
            REFERENCES [dbo].[Thuoc]([Id])
    );
END
GO

-- Index cho QuanLyLoThuoc
CREATE INDEX IX_QuanLyLoThuoc_MaThuoc ON [dbo].[QuanLyLoThuoc]([MaThuoc]);
CREATE INDEX IX_QuanLyLoThuoc_HanSuDung ON [dbo].[QuanLyLoThuoc]([HanSuDung]);
CREATE INDEX IX_QuanLyLoThuoc_TrangThai ON [dbo].[QuanLyLoThuoc]([TrangThai]);
GO

-- =============================================
-- VIII. ĐƠN THUỐC - DonThuoc
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DonThuoc]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[DonThuoc] (
        [Id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [MaHoSoKham] UNIQUEIDENTIFIER UNIQUE NOT NULL,
        [MaBenhNhan] UNIQUEIDENTIFIER NOT NULL,
        [MaBacSi] UNIQUEIDENTIFIER NOT NULL,
        [NgayKeDon] DATETIME DEFAULT GETDATE(),
        [ChanDoan] NVARCHAR(MAX),
        [GhiChu] NVARCHAR(MAX),
        [TrangThai] TINYINT, -- 0:Chờ cấp phát, 1:Đã cấp phát, 2:Đã hủy
        [ThoiGianPhatThuoc] DATETIME NULL,
        [NguoiPhatThuocId] UNIQUEIDENTIFIER NULL,

        CONSTRAINT FK_DonThuoc_HoSoKham FOREIGN KEY ([MaHoSoKham]) 
            REFERENCES [dbo].[HoSoKham]([Id]),
        CONSTRAINT FK_DonThuoc_BenhNhan FOREIGN KEY ([MaBenhNhan]) 
            REFERENCES [dbo].[BenhNhan]([Id]),
        CONSTRAINT FK_DonThuoc_BacSi FOREIGN KEY ([MaBacSi]) 
            REFERENCES [dbo].[NguoiDung]([Id]),
        CONSTRAINT FK_DonThuoc_NguoiPhatThuoc FOREIGN KEY ([NguoiPhatThuocId]) 
            REFERENCES [dbo].[NguoiDung]([Id])
    );
END
GO

-- Index cho DonThuoc
CREATE INDEX IX_DonThuoc_MaBenhNhan ON [dbo].[DonThuoc]([MaBenhNhan]);
CREATE INDEX IX_DonThuoc_MaBacSi ON [dbo].[DonThuoc]([MaBacSi]);
CREATE INDEX IX_DonThuoc_TrangThai ON [dbo].[DonThuoc]([TrangThai]);
GO

-- =============================================
-- IX. CHI TIẾT ĐƠN THUỐC - ChiTietDonThuoc
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ChiTietDonThuoc]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[ChiTietDonThuoc] (
        [Id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [MaDonThuoc] UNIQUEIDENTIFIER NOT NULL,
        [MaThuoc] UNIQUEIDENTIFIER NOT NULL,
        [SoLuong] INT NOT NULL,
        [DonGia] DECIMAL(18,2) NOT NULL,
        [LieuDung] NVARCHAR(255),
        [CachDung] NVARCHAR(255),

        CONSTRAINT FK_ChiTietDonThuoc_DonThuoc FOREIGN KEY ([MaDonThuoc]) 
            REFERENCES [dbo].[DonThuoc]([Id]) ON DELETE CASCADE,
        CONSTRAINT FK_ChiTietDonThuoc_Thuoc FOREIGN KEY ([MaThuoc]) 
            REFERENCES [dbo].[Thuoc]([Id])
    );
END
GO

-- Index cho ChiTietDonThuoc
CREATE INDEX IX_ChiTietDonThuoc_MaDonThuoc ON [dbo].[ChiTietDonThuoc]([MaDonThuoc]);
CREATE INDEX IX_ChiTietDonThuoc_MaThuoc ON [dbo].[ChiTietDonThuoc]([MaThuoc]);
GO

-- =============================================
-- X. DỊCH VỤ CẬN LÂM SÀNG - DichVuCanLamSang
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[DichVuCanLamSang]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[DichVuCanLamSang] (
        [Id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [TenDichVu] NVARCHAR(150) NOT NULL,
        [MoTa] NVARCHAR(MAX),
        [DonGia] DECIMAL(18,2),
        [TrangThai] BIT DEFAULT 1
    );
END
GO

-- =============================================
-- XI. YÊU CẦU DỊCH VỤ - YeuCauDichVu
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[YeuCauDichVu]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[YeuCauDichVu] (
        [Id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [MaHoSoKham] UNIQUEIDENTIFIER NOT NULL,
        [MaBenhNhan] UNIQUEIDENTIFIER NOT NULL,
        [NguoiChiDinhId] UNIQUEIDENTIFIER NOT NULL,
        [TrangThai] TINYINT, -- 0:Chờ thực hiện, 1:Đang thực hiện, 2:Hoàn thành, 3:Đã hủy
        [NgayChiDinh] DATETIME DEFAULT GETDATE(),
        [GhiChuBacSi] NVARCHAR(MAX),

        CONSTRAINT FK_YeuCauDichVu_HoSoKham FOREIGN KEY ([MaHoSoKham]) 
            REFERENCES [dbo].[HoSoKham]([Id]),
        CONSTRAINT FK_YeuCauDichVu_BenhNhan FOREIGN KEY ([MaBenhNhan]) 
            REFERENCES [dbo].[BenhNhan]([Id]),
        CONSTRAINT FK_YeuCauDichVu_NguoiChiDinh FOREIGN KEY ([NguoiChiDinhId]) 
            REFERENCES [dbo].[NguoiDung]([Id])
    );
END
GO

-- Index cho YeuCauDichVu
CREATE INDEX IX_YeuCauDichVu_MaHoSoKham ON [dbo].[YeuCauDichVu]([MaHoSoKham]);
CREATE INDEX IX_YeuCauDichVu_MaBenhNhan ON [dbo].[YeuCauDichVu]([MaBenhNhan]);
CREATE INDEX IX_YeuCauDichVu_TrangThai ON [dbo].[YeuCauDichVu]([TrangThai]);
GO

-- =============================================
-- XII. CHI TIẾT YÊU CẦU DỊCH VỤ - ChiTietYeuCauDichVu
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ChiTietYeuCauDichVu]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[ChiTietYeuCauDichVu] (
        [Id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [MaYeuCau] UNIQUEIDENTIFIER NOT NULL,
        [MaDichVu] UNIQUEIDENTIFIER NOT NULL,
        [DonGia] DECIMAL(18,2),
        [SoLuong] INT,

        CONSTRAINT FK_ChiTietYeuCauDichVu_YeuCau FOREIGN KEY ([MaYeuCau]) 
            REFERENCES [dbo].[YeuCauDichVu]([Id]) ON DELETE CASCADE,
        CONSTRAINT FK_ChiTietYeuCauDichVu_DichVu FOREIGN KEY ([MaDichVu]) 
            REFERENCES [dbo].[DichVuCanLamSang]([Id])
    );
END
GO

-- Index cho ChiTietYeuCauDichVu
CREATE INDEX IX_ChiTietYeuCauDichVu_MaYeuCau ON [dbo].[ChiTietYeuCauDichVu]([MaYeuCau]);
CREATE INDEX IX_ChiTietYeuCauDichVu_MaDichVu ON [dbo].[ChiTietYeuCauDichVu]([MaDichVu]);
GO

-- =============================================
-- XIII. CẬN LÂM SÀNG - CanLamSang
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[CanLamSang]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[CanLamSang] (
        [Id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [MaYeuCau] UNIQUEIDENTIFIER NOT NULL,
        [TenXetNghiem] NVARCHAR(150),
        [KetQua] NVARCHAR(MAX),
        [GiaTriThamChieu] NVARCHAR(255),
        [TrangThai] TINYINT, -- 0:Chờ kết quả, 1:Có kết quả, 2:Đã xác nhận
        [NgayCoKetQua] DATETIME,
        [NguoiXacNhanId] UNIQUEIDENTIFIER,

        CONSTRAINT FK_CanLamSang_YeuCauDichVu FOREIGN KEY ([MaYeuCau]) 
            REFERENCES [dbo].[YeuCauDichVu]([Id]),
        CONSTRAINT FK_CanLamSang_NguoiXacNhan FOREIGN KEY ([NguoiXacNhanId]) 
            REFERENCES [dbo].[NguoiDung]([Id])
    );
END
GO

-- Index cho CanLamSang
CREATE INDEX IX_CanLamSang_MaYeuCau ON [dbo].[CanLamSang]([MaYeuCau]);
CREATE INDEX IX_CanLamSang_TrangThai ON [dbo].[CanLamSang]([TrangThai]);
GO

-- =============================================
-- XIV. HÓA ĐƠN - HoaDon
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[HoaDon]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[HoaDon] (
        [Id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [MaBenhNhan] UNIQUEIDENTIFIER NOT NULL,
        [MaHoSoKham] UNIQUEIDENTIFIER NOT NULL,
        [TongTien] DECIMAL(18,2),
        [GiamGia] DECIMAL(18,2),
        [ThanhTien] DECIMAL(18,2),
        [TrangThai] TINYINT, -- 0:Chưa thanh toán, 1:Đã thanh toán, 2:Đã hủy
        [NgayTao] DATETIME DEFAULT GETDATE(),

        CONSTRAINT FK_HoaDon_BenhNhan FOREIGN KEY ([MaBenhNhan]) 
            REFERENCES [dbo].[BenhNhan]([Id]),
        CONSTRAINT FK_HoaDon_HoSoKham FOREIGN KEY ([MaHoSoKham]) 
            REFERENCES [dbo].[HoSoKham]([Id])
    );
END
GO

-- Index cho HoaDon
CREATE INDEX IX_HoaDon_MaBenhNhan ON [dbo].[HoaDon]([MaBenhNhan]);
CREATE INDEX IX_HoaDon_MaHoSoKham ON [dbo].[HoaDon]([MaHoSoKham]);
CREATE INDEX IX_HoaDon_TrangThai ON [dbo].[HoaDon]([TrangThai]);
GO

-- =============================================
-- XV. CHI TIẾT HÓA ĐƠN - ChiTietHoaDon
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[ChiTietHoaDon]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[ChiTietHoaDon] (
        [Id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [MaHoaDon] UNIQUEIDENTIFIER NOT NULL,
        [Loai] TINYINT, -- 1:Thuốc, 2:Dịch vụ, 3:Phí khám
        [MaThamChieu] UNIQUEIDENTIFIER,
        [SoLuong] INT,
        [DonGia] DECIMAL(18,2),
        [SoTien] DECIMAL(18,2),

        CONSTRAINT FK_ChiTietHoaDon_HoaDon FOREIGN KEY ([MaHoaDon]) 
            REFERENCES [dbo].[HoaDon]([Id]) ON DELETE CASCADE
    );
END
GO

-- Index cho ChiTietHoaDon
CREATE INDEX IX_ChiTietHoaDon_MaHoaDon ON [dbo].[ChiTietHoaDon]([MaHoaDon]);
CREATE INDEX IX_ChiTietHoaDon_Loai ON [dbo].[ChiTietHoaDon]([Loai]);
GO

-- =============================================
-- XVI. GIAO DỊCH KHO - GiaoDichKho
-- =============================================
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[GiaoDichKho]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[GiaoDichKho] (
        [Id] UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
        [MaLoThuoc] UNIQUEIDENTIFIER NOT NULL,
        [LoaiGiaoDich] TINYINT, -- 1:Nhập kho, 2:Xuất kho, 3:Điều chỉnh, 4:Trả lại
        [SoLuong] INT NOT NULL,
        [SoLuongTruoc] INT,
        [SoLuongSau] INT,
        [LyDo] NVARCHAR(255),
        [LoaiThamChieu] TINYINT, -- 1:Đơn thuốc, 2:Nhập kho, 3:Điều chỉnh
        [MaThamChieu] UNIQUEIDENTIFIER,
        [NguoiThucHienId] UNIQUEIDENTIFIER,
        [ThoiGianTao] DATETIME DEFAULT GETDATE(),
        [GhiChu] NVARCHAR(MAX),

        CONSTRAINT FK_GiaoDichKho_LoThuoc FOREIGN KEY ([MaLoThuoc]) 
            REFERENCES [dbo].[QuanLyLoThuoc]([Id]),
        CONSTRAINT FK_GiaoDichKho_NguoiThucHien FOREIGN KEY ([NguoiThucHienId]) 
            REFERENCES [dbo].[NguoiDung]([Id])
    );
END
GO

-- Index cho GiaoDichKho
CREATE INDEX IX_GiaoDichKho_MaLoThuoc ON [dbo].[GiaoDichKho]([MaLoThuoc]);
CREATE INDEX IX_GiaoDichKho_LoaiGiaoDich ON [dbo].[GiaoDichKho]([LoaiGiaoDich]);
CREATE INDEX IX_GiaoDichKho_ThoiGianTao ON [dbo].[GiaoDichKho]([ThoiGianTao]);
GO

PRINT N'✅ Database schema created successfully!';
GO
