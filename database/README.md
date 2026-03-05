# Hướng dẫn Thiết lập CSDL SQL Server

## 📋 Yêu cầu
- SQL Server 2019 hoặc mới hơn (SQL Server Express cũng được)
- SQL Server Management Studio (SSMS) hoặc Azure Data Studio

## 🚀 Cách 1: Sử dụng file SQL Script

### Bước 1: Tạo Database bằng SQL Script
1. Mở SQL Server Management Studio (SSMS)
2. Kết nối đến SQL Server instance của bạn
3. Mở file `schema.sql` trong thư mục này
4. Chạy (F5) toàn bộ script

Script sẽ tự động:
- Tạo database `ClinicManagement`
- Tạo tất cả các bảng với cấu trúc đầy đủ
- Thiết lập khóa chính, khóa ngoại và ràng buộc
- Tạo các index cần thiết

### Bước 2: Cấu hình kết nối
Chỉnh sửa file `.env` trong thư mục `backend/`:

```env
# SQL Server Authentication (Username/Password)
DB_HOST=localhost
DB_PORT=1433
DB_NAME=ClinicManagement
DB_USER=sa
DB_PASSWORD=123456
DB_TRUSTED_CONNECTION=false
DB_TRUST_SERVER_CERT=true

# Nếu dùng Named Instance (VD: SQLEXPRESS)
DB_INSTANCE=SQLEXPRESS
```

### Bước 3: Seed dữ liệu mẫu
```bash
cd backend
npm run seed:vn
```

---

## 🚀 Cách 2: Sử dụng Sequelize Auto-Sync

Sequelize có thể tự động tạo các bảng dựa trên models:

### Bước 1: Cấu hình kết nối trong `.env`
(Giống như trên)

### Bước 2: Chạy seed để tạo bảng và dữ liệu
```bash
cd backend
npm run seed:vn
```

Script `seedVietnamese.js` sẽ:
- Kết nối tới SQL Server
- Tự động tạo tất cả các bảng (nếu chưa có)
- Seed dữ liệu mẫu

---

## 📊 Cấu trúc CSDL

### Danh sách các bảng:

| STT | Tên bảng | Mô tả |
|-----|----------|-------|
| 1 | NguoiDung | Người dùng hệ thống |
| 2 | BenhNhan | Thông tin bệnh nhân |
| 3 | LichHen | Lịch hẹn khám |
| 4 | HoSoKham | Hồ sơ khám bệnh |
| 5 | ChiSoSinhTon | Chỉ số sinh tồn |
| 6 | Thuoc | Danh mục thuốc |
| 7 | QuanLyLoThuoc | Quản lý lô thuốc |
| 8 | DonThuoc | Đơn thuốc |
| 9 | ChiTietDonThuoc | Chi tiết đơn thuốc |
| 10 | DichVuCanLamSang | Dịch vụ cận lâm sàng |
| 11 | YeuCauDichVu | Yêu cầu dịch vụ |
| 12 | ChiTietYeuCauDichVu | Chi tiết yêu cầu dịch vụ |
| 13 | CanLamSang | Kết quả cận lâm sàng |
| 14 | HoaDon | Hóa đơn |
| 15 | ChiTietHoaDon | Chi tiết hóa đơn |
| 16 | GiaoDichKho | Giao dịch kho thuốc |

### Sơ đồ quan hệ:

```
NguoiDung (1) ─────────────────── (1) BenhNhan
    │                                    │
    │ (Bác sĩ)                          │
    ├───────────> LichHen <─────────────┘
    │                │
    │                ▼
    └───────────> HoSoKham
                    │
        ┌───────────┼───────────┬───────────┐
        ▼           ▼           ▼           ▼
  ChiSoSinhTon   DonThuoc   YeuCauDichVu  HoaDon
                    │           │           │
                    ▼           ▼           ▼
            ChiTietDonThuoc  ChiTietYeuCauDichVu  ChiTietHoaDon
                    │           │
                    ▼           ▼
                  Thuoc     CanLamSang
                    │      DichVuCanLamSang
                    ▼
              QuanLyLoThuoc
                    │
                    ▼
               GiaoDichKho
```

---

## 🔐 Tài khoản mẫu (sau khi seed)

| Vai trò | Username | Password |
|---------|----------|----------|
| Admin | admin | Admin@123 |
| Bác sĩ 1 | bacsi1 | BacSi@123 |
| Bác sĩ 2 | bacsi2 | BacSi@123 |
| Lễ tân | letan | LeTan@123 |
| Dược sĩ | duocsi | DuocSi@123 |
| Bệnh nhân | benhnhan1 | BenhNhan@123 |

---

## ⚠️ Lưu ý

1. **Collation**: Database sử dụng `Vietnamese_CI_AS` để hỗ trợ tiếng Việt đầy đủ

2. **Windows Authentication**: Nếu muốn dùng Windows Auth:
   ```env
   DB_TRUSTED_CONNECTION=true
   DB_DOMAIN=YOUR_DOMAIN
   DB_NTLM_USER=your_username
   DB_NTLM_PASSWORD=your_password
   ```

3. **SQL Server Express**: Nếu dùng SQL Server Express LocalDB:
   ```env
   DB_HOST=localhost
   DB_INSTANCE=SQLEXPRESS
   ```

4. **Encryption**: Trong production, nên bật encryption:
   ```env
   DB_ENCRYPT=true
   DB_TRUST_SERVER_CERT=false
   ```
