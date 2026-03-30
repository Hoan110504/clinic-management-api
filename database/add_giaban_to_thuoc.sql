-- Add selling price column for medicines if missing
IF COL_LENGTH('dbo.Thuoc', 'GiaBan') IS NULL
BEGIN
    ALTER TABLE [dbo].[Thuoc]
    ADD [GiaBan] DECIMAL(18,2) NULL;
END
GO
