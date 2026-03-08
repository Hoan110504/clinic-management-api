# Hướng dẫn sửa lỗi giới tính

## Vấn đề
Khi thêm bệnh nhân với giới tính "Nữ", hệ thống báo lỗi:
```
The INSERT statement conflicted with the CHECK constraint "CK_patients_gender"
```

## Nguyên nhân
Cột `gender` trong database đang dùng kiểu `VARCHAR` thay vì `NVARCHAR`, gây ra vấn đề với ký tự Unicode tiếng Việt ("Nữ").

## Giải pháp

### Cách 1: Chạy script Node.js (Khuyến nghị)

1. **Dừng backend server** (nếu đang chạy)

2. **Chạy script fix**:
   ```bash
   cd backend
   node src/scripts/fix_gender_constraints.js
   ```

3. **Khởi động lại server**:
   ```bash
   npm run dev
   ```

### Cách 2: Chạy SQL trực tiếp

1. **Kiểm tra vấn đề** (không bắt buộc):
   - Mở SQL Server Management Studio
   - Kết nối vào database `ClinicManagement`
   - Chạy file: `backend/database/diagnose_gender_columns.sql`
   - Xem kết quả để hiểu rõ vấn đề

2. **Áp dụng fix**:
   - Chạy file: `backend/database/fix_gender_constraints.sql`
   - Script sẽ:
     - Xóa các constraint cũ
     - Chuyển cột từ VARCHAR → NVARCHAR(10)
     - Tạo lại constraint mới cho phép N'Nam' và N'Nữ'

3. **Khởi động lại backend server**

## Các bảng được sửa

Script sẽ tự động sửa các bảng sau:
- ✅ `patients.gender`
- ✅ `users.gender`
- ✅ `appointments.patient_gender`
- ✅ `medical_records.patient_gender`
- ✅ `payments.patient_gender`
- ✅ `service_orders.patient_gender`

## Sau khi fix

Bạn có thể thêm bệnh nhân với giới tính "Nữ" hoặc "Nam" mà không gặp lỗi.

Frontend có thể gửi:
- `"Nữ"` hoặc `"Nam"` (tiếng Việt)
- `"female"` hoặc `"male"` (tiếng Anh) - sẽ tự động chuyển đổi
- `"nu"` hoặc `"nam"` (không dấu) - sẽ tự động chuyển đổi

## Lưu ý

- ⚠️ Script an toàn - không xóa dữ liệu hiện có
- ⚠️ Nên backup database trước khi chạy (cho chắc chắn)
- ⚠️ Chỉ chạy 1 lần, không cần chạy lại

## Kiểm tra sau khi fix

Test bằng cách gửi request:
```bash
curl -X POST http://localhost:5000/api/patients \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "fullName": "Nguyễn Thị Test",
    "gender": "Nữ",
    "phone": "0123456789",
    "dateOfBirth": "1990-01-01"
  }'
```

Nếu nhận được response thành công (status 201) → Fix đã hoạt động! ✅
