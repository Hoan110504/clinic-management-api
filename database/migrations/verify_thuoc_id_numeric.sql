-- Verify script: check Thuoc.Id datatype and sequence behavior
SET NOCOUNT ON;

IF OBJECT_ID('dbo.Thuoc', 'U') IS NULL
BEGIN
    RAISERROR(N'dbo.Thuoc does not exist.', 16, 1);
    RETURN;
END

SELECT
    t.name AS TableName,
    c.name AS ColumnName,
    ty.name AS DataType,
    c.max_length AS MaxLength,
    c.is_identity AS IsIdentity,
    c.is_nullable AS IsNullable
FROM sys.columns c
JOIN sys.tables t ON t.object_id = c.object_id
JOIN sys.types ty ON ty.user_type_id = c.user_type_id
WHERE t.object_id = OBJECT_ID('dbo.Thuoc')
  AND c.name = 'Id';

SELECT TOP (20)
    Id,
    TenThuoc,
    NhomThuoc
FROM dbo.Thuoc
ORDER BY Id ASC;

-- Expectation:
-- 1) DataType = int
-- 2) IsIdentity = 1
-- 3) Rows sorted by Id are 1..N (or continuous from current seed state)
