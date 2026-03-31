USE ClinicManagement;
GO

-- Create view from legacy tables only if source table exists
IF OBJECT_ID('dbo.GiaoDichKho', 'U') IS NOT NULL
BEGIN
    -- Drop existing view if present
    IF OBJECT_ID('dbo.inventory_transactions', 'V') IS NOT NULL
    BEGIN
        EXEC('DROP VIEW dbo.inventory_transactions');
    END

    DECLARE @sql NVARCHAR(MAX) = N'
    CREATE VIEW dbo.inventory_transactions AS
    SELECT
      gdk.Id AS id,
      qlt.MaThuoc AS medicine_id,
      COALESCE(t.TenThuoc, '''') AS medicine_name,
      CASE gdk.LoaiGiaoDich
        WHEN 1 THEN N''''Nhập''''
        WHEN 2 THEN N''''Xuất''''
        WHEN 3 THEN N''''Điều chỉnh''''
        ELSE N''''Khác''''
      END AS type,
      gdk.SoLuong AS quantity,
      gdk.SoLuongTruoc AS previous_quantity,
      gdk.SoLuongSau AS new_quantity,
      gdk.LyDo AS reason,
      CASE gdk.LoaiThamChieu
        WHEN 1 THEN N''''DON_THUOC''''
        WHEN 2 THEN N''''NHAP_KHO''''
        WHEN 3 THEN N''''DIEU_CHINH''''
        ELSE NULL
      END AS reference_type,
      gdk.MaThamChieu AS reference_id,
      gdk.NguoiThucHienId AS performed_by_id,
      COALESCE(nd.HoTen, '''') AS performed_by,
      gdk.GhiChu AS notes,
      gdk.ThoiGianTao AS created_at,
      NULL AS updated_at
    FROM dbo.GiaoDichKho gdk
    LEFT JOIN dbo.QuanLyLoThuoc qlt ON qlt.Id = gdk.MaLoThuoc
    LEFT JOIN dbo.Thuoc t ON t.Id = qlt.MaThuoc
    LEFT JOIN dbo.NguoiDung nd ON nd.Id = gdk.NguoiThucHienId;';

    EXEC sp_executesql @sql;
END
ELSE
BEGIN
    PRINT 'Bảng dbo.GiaoDichKho không tồn tại trong database hiện tại. Bỏ qua tạo view inventory_transactions.';
END
GO
