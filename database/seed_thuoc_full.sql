-- seed_thuoc_full.sql
-- Clears existing rows in dbo.Thuoc and inserts a curated medicine list
SET NOCOUNT ON;

IF OBJECT_ID('dbo.Thuoc', 'U') IS NULL
BEGIN
    PRINT N'Table dbo.Thuoc does not exist. Create the table first or run the schema script.';
    RETURN;
END

BEGIN TRANSACTION;

DELETE FROM dbo.Thuoc;
-- 1️⃣ Giảm đau, hạ sốt, kháng viêm
INSERT INTO dbo.Thuoc (TenThuoc, DonVi, NhomThuoc, GiaBan, TrangThai) VALUES
(N'Paracetamol 500mg', N'Viên', N'Giảm đau, hạ sốt, kháng viêm', 1000, 1),
(N'Ibuprofen 400mg', N'Viên', N'Giảm đau, hạ sốt, kháng viêm', 1500, 1),
(N'Diclofenac 50mg', N'Viên', N'Giảm đau, hạ sốt, kháng viêm', 1500, 1),
(N'Meloxicam 7.5mg', N'Viên', N'Giảm đau, hạ sốt, kháng viêm', 2500, 1),
(N'Celecoxib 200mg', N'Viên', N'Giảm đau, hạ sốt, kháng viêm', 4000, 1);

-- 2️⃣ Kháng sinh
INSERT INTO dbo.Thuoc (TenThuoc, DonVi, NhomThuoc, GiaBan, TrangThai) VALUES
(N'Amoxicillin 500mg', N'Viên', N'Kháng sinh', 2500, 1),
(N'Cefixime 200mg', N'Viên', N'Kháng sinh', 6000, 1),
(N'Cefpodoxime 200mg', N'Viên', N'Kháng sinh', 7000, 1),
(N'Azithromycin 500mg', N'Viên', N'Kháng sinh', 10000, 1),
(N'Clarithromycin 500mg', N'Viên', N'Kháng sinh', 12000, 1),
(N'Levofloxacin 500mg', N'Viên', N'Kháng sinh', 10000, 1),
(N'Ciprofloxacin 500mg', N'Viên', N'Kháng sinh', 4000, 1);

-- 3️⃣ Hô hấp, ho, hen, viêm mũi xoang
INSERT INTO dbo.Thuoc (TenThuoc, DonVi, NhomThuoc, GiaBan, TrangThai) VALUES
(N'Acetylcysteine 200mg', N'Gói', N'Hô hấp, ho, hen, viêm mũi xoang', 3000, 1),
(N'Bromhexine 8mg', N'Viên', N'Hô hấp, ho, hen, viêm mũi xoang', 1200, 1),
(N'Ambroxol 30mg', N'Viên', N'Hô hấp, ho, hen, viêm mũi xoang', 1500, 1),
(N'Dextromethorphan 15mg', N'Viên', N'Hô hấp, ho, hen, viêm mũi xoang', 1500, 1),
(N'Salbutamol xịt', N'Bình', N'Hô hấp, ho, hen, viêm mũi xoang', 75000, 1),
(N'Montelukast 10mg', N'Viên', N'Hô hấp, ho, hen, viêm mũi xoang', 7000, 1),
(N'Loratadine 10mg', N'Viên', N'Hô hấp, ho, hen, viêm mũi xoang', 2000, 1),
(N'Cetirizine 10mg', N'Viên', N'Hô hấp, ho, hen, viêm mũi xoang', 2000, 1),
(N'Fexofenadine 180mg', N'Viên', N'Hô hấp, ho, hen, viêm mũi xoang', 6000, 1);

-- 4️⃣ Tim mạch
INSERT INTO dbo.Thuoc (TenThuoc, DonVi, NhomThuoc, GiaBan, TrangThai) VALUES
(N'Amlodipine 5mg', N'Viên', N'Tim mạch', 1500, 1),
(N'Nifedipine LA 30mg', N'Viên', N'Tim mạch', 3000, 1),
(N'Perindopril 5mg', N'Viên', N'Tim mạch', 4000, 1),
(N'Enalapril 5mg', N'Viên', N'Tim mạch', 1500, 1),
(N'Losartan 50mg', N'Viên', N'Tim mạch', 2500, 1),
(N'Valsartan 80mg', N'Viên', N'Tim mạch', 5000, 1),
(N'Furosemide 40mg', N'Viên', N'Tim mạch', 1000, 1),
(N'Spironolactone 25mg', N'Viên', N'Tim mạch', 1500, 1),
(N'Aspirin 81mg', N'Viên', N'Tim mạch', 800, 1),
(N'Clopidogrel 75mg', N'Viên', N'Tim mạch', 4000, 1),
(N'Atorvastatin 20mg', N'Viên', N'Tim mạch', 3500, 1),
(N'Rosuvastatin 10mg', N'Viên', N'Tim mạch', 4000, 1);

-- 5️⃣ Tiêu hoá
INSERT INTO dbo.Thuoc (TenThuoc, DonVi, NhomThuoc, GiaBan, TrangThai) VALUES
(N'Omeprazole 20mg', N'Viên', N'Thuốc tiêu hoá', 1500, 1),
(N'Esomeprazole 20mg', N'Viên', N'Thuốc tiêu hoá', 4000, 1),
(N'Pantoprazole 40mg', N'Viên', N'Thuốc tiêu hoá', 3500, 1),
(N'Sucralfate', N'Gói', N'Thuốc tiêu hoá', 3000, 1),
(N'Gaviscon', N'Gói', N'Thuốc tiêu hoá', 5000, 1),
(N'Smecta', N'Gói', N'Thuốc tiêu hoá', 3500, 1),
(N'Loperamide 2mg', N'Viên', N'Thuốc tiêu hoá', 1500, 1),
(N'Racecadotril', N'Viên', N'Thuốc tiêu hoá', 3000, 1),
(N'Men vi sinh', N'Gói', N'Thuốc tiêu hoá', 3000, 1),
(N'Ursodeoxycholic acid', N'Viên', N'Thuốc tiêu hoá', 5000, 1),
(N'Sylimarin', N'Viên', N'Thuốc tiêu hoá', 2500, 1);

-- 6️⃣ Nội tiết, đái tháo đường
INSERT INTO dbo.Thuoc (TenThuoc, DonVi, NhomThuoc, GiaBan, TrangThai) VALUES
(N'Metformin 500mg', N'Viên', N'Nội tiết, đái tháo đường', 1200, 1),
(N'Gliclazide MR 30mg', N'Viên', N'Nội tiết, đái tháo đường', 2500, 1),
(N'Glimepiride 2mg', N'Viên', N'Nội tiết, đái tháo đường', 2000, 1),
(N'Sitagliptin 100mg', N'Viên', N'Nội tiết, đái tháo đường', 18000, 1),
(N'Empagliflozin 25mg', N'Viên', N'Nội tiết, đái tháo đường', 20000, 1);

-- 7️⃣ Tiết niệu, sinh dục
INSERT INTO dbo.Thuoc (TenThuoc, DonVi, NhomThuoc, GiaBan, TrangThai) VALUES
(N'Alphachymotrypsin', N'Viên', N'Tiết niệu, sinh dục', 2500, 1),
(N'Tamsulosin 0.4mg', N'Viên', N'Tiết niệu, sinh dục', 6000, 1),
(N'Nitrofurantoin 100mg', N'Viên', N'Tiết niệu, sinh dục', 4000, 1),
(N'Cranberry', N'Viên', N'Tiết niệu, sinh dục', 4000, 1);

-- 8️⃣ Vitamin, khoáng chất
INSERT INTO dbo.Thuoc (TenThuoc, DonVi, NhomThuoc, GiaBan, TrangThai) VALUES
(N'Vitamin C', N'Viên', N'Vitamin, khoáng chất', 800, 1),
(N'Vitamin B1-6-12', N'Viên', N'Vitamin, khoáng chất', 2000, 1),
(N'Magne B6', N'Viên', N'Vitamin, khoáng chất', 3000, 1),
(N'Canxi + Vitamin D', N'Viên', N'Vitamin, khoáng chất', 3000, 1),
(N'Ferrous fumarate', N'Viên', N'Vitamin, khoáng chất', 2000, 1),
(N'Kẽm', N'Viên', N'Vitamin, khoáng chất', 1500, 1);

-- 9️⃣ Vật tư y tế
INSERT INTO dbo.Thuoc (TenThuoc, DonVi, NhomThuoc, GiaBan, TrangThai) VALUES
(N'NaCl 0.9% 500ml', N'Chai', N'Vật tư y tế', 25000, 1),
(N'Ringer lactate 500ml', N'Chai', N'Vật tư y tế', 30000, 1),
(N'Kim tiêm', N'Cái', N'Vật tư y tế', 3000, 1),
(N'Dây truyền', N'Bộ', N'Vật tư y tế', 10000, 1),
(N'Test đường huyết', N'Que', N'Vật tư y tế', 8000, 1),
(N'Test nước tiểu', N'Que', N'Vật tư y tế', 10000, 1);

COMMIT TRANSACTION;

PRINT N'Seeding dbo.Thuoc completed.';
