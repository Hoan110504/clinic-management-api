-- Add persistent staff code columns and backfill values for users and legacy NguoiDung
-- Run this script against the ClinicManagement database
SET NOCOUNT ON;

IF COL_LENGTH('dbo.users', 'staff_code') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD staff_code NVARCHAR(16) NULL;
    PRINT N'Added column users.staff_code';

    -- Use dynamic SQL for UPDATE / CREATE INDEX to avoid compile-time binding errors
    DECLARE @sql_users NVARCHAR(MAX) = N'
    ;WITH numbered AS (
        SELECT
            id,
            role,
            ROW_NUMBER() OVER (PARTITION BY role ORDER BY id) AS rn,
            CASE role
                WHEN ''admin'' THEN ''AD''
                WHEN ''doctor'' THEN ''BS''
                WHEN ''receptionist'' THEN ''LT''
                WHEN ''pharmacist'' THEN ''DS''
                WHEN ''patient'' THEN ''BN''
                ELSE ''UN''
            END AS prefix
        FROM dbo.users
        WHERE role IS NOT NULL
    )
    UPDATE u
    SET staff_code = t.prefix + RIGHT(''000'' + CAST(t.rn AS VARCHAR(3)), 3)
    FROM dbo.users u
    INNER JOIN numbered t ON t.id = u.id
    WHERE u.staff_code IS NULL;

    CREATE UNIQUE INDEX IX_users_staff_code ON dbo.users(staff_code) WHERE staff_code IS NOT NULL;
    ';
    EXEC sp_executesql @sql_users;
    PRINT N'Backfilled users.staff_code and created index';
END
ELSE
BEGIN
    PRINT N'users.staff_code already exists, skipping create/backfill';
END

-- Legacy table NguoiDung
IF COL_LENGTH('dbo.NguoiDung', 'MaNguoiDung') IS NULL
BEGIN
    ALTER TABLE dbo.NguoiDung ADD MaNguoiDung NVARCHAR(16) NULL;
    PRINT N'Added column NguoiDung.MaNguoiDung';

    -- Use dynamic SQL for UPDATE / CREATE INDEX on legacy table as well
    DECLARE @sql_nguoidung NVARCHAR(MAX) = N'
    ;WITH numbered AS (
        SELECT
            Id,
            VaiTro,
            ROW_NUMBER() OVER (PARTITION BY VaiTro ORDER BY Id) AS rn,
            CASE VaiTro
                WHEN 1 THEN ''AD''
                WHEN 2 THEN ''BS''
                WHEN 3 THEN ''LT''
                WHEN 4 THEN ''DS''
                WHEN 5 THEN ''BN''
                ELSE ''UN''
            END AS prefix
        FROM dbo.NguoiDung
        WHERE VaiTro IS NOT NULL
    )
    UPDATE nd
    SET MaNguoiDung = t.prefix + RIGHT(''000'' + CAST(t.rn AS VARCHAR(3)), 3)
    FROM dbo.NguoiDung nd
    INNER JOIN numbered t ON t.Id = nd.Id
    WHERE nd.MaNguoiDung IS NULL;

    CREATE UNIQUE INDEX IX_NguoiDung_MaNguoiDung ON dbo.NguoiDung(MaNguoiDung) WHERE MaNguoiDung IS NOT NULL;
    ';
    EXEC sp_executesql @sql_nguoidung;
    PRINT N'Backfilled NguoiDung.MaNguoiDung and created index';
END
ELSE
BEGIN
    PRINT N'NguoiDung.MaNguoiDung already exists, skipping create/backfill';
END

SET NOCOUNT OFF;
