-- Script để xóa các yêu cầu reset password cũ (dùng cho testing)
-- Chạy script này trong SQL Server Management Studio hoặc Azure Data Studio

USE ClinicManagement;
GO

-- Xem các request hiện tại
SELECT * FROM PasswordResetOtps ORDER BY CreatedAt DESC;
GO

-- Xóa tất cả các request (CHỈ DÙNG CHO TESTING)
DELETE FROM PasswordResetOtps;
GO

-- Hoặc xóa chỉ các request của một user cụ thể (thay USER_ID)
-- DELETE FROM PasswordResetOtps WHERE UserId = <USER_ID>;
-- GO

SELECT 'Đã xóa các yêu cầu reset password' AS Result;
GO
