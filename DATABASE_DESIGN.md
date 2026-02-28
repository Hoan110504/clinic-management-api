# Thiết Kế Cơ Sở Dữ Liệu - Hệ Thống Quản Lý Phòng Khám Nội Khoa

## 📊 Tổng Quan

**Database**: Microsoft SQL Server  
**ORM**: Sequelize  
**Tên Database**: `clinic_management`

---

## 📋 Danh Sách Bảng

| STT | Tên Bảng | Mô Tả |
|-----|----------|-------|
| 1 | users | Người dùng hệ thống |
| 2 | patients | Thông tin bệnh nhân |
| 3 | appointments | Lịch hẹn khám |
| 4 | medical_records | Phiếu khám bệnh |
| 5 | service_orders | Phiếu chỉ định dịch vụ |
| 6 | lab_tests | Kết quả xét nghiệm |
| 7 | lab_services | Danh mục dịch vụ xét nghiệm |
| 8 | prescriptions | Đơn thuốc |
| 9 | medicines | Danh mục thuốc |
| 10 | inventory_transactions | Giao dịch kho thuốc |
| 11 | payments | Hóa đơn thanh toán |

---

## 🗂️ Chi Tiết Các Bảng

### 1. Users (Người dùng)

Lưu trữ thông tin tài khoản của tất cả người dùng trong hệ thống.

| Cột | Kiểu Dữ Liệu | Ràng Buộc | Mô Tả |
|-----|--------------|-----------|-------|
| id | UUID | PK | Mã định danh |
| username | VARCHAR(50) | UNIQUE, NOT NULL | Tên đăng nhập |
| email | VARCHAR(100) | UNIQUE, NOT NULL | Email |
| password | VARCHAR(255) | NOT NULL | Mật khẩu (đã hash) |
| fullName | NVARCHAR(100) | NOT NULL | Họ tên đầy đủ |
| role | ENUM | NOT NULL | Vai trò (admin/doctor/receptionist/pharmacist/lab_tech/patient) |
| phone | VARCHAR(15) | | Số điện thoại |
| dateOfBirth | DATE | | Ngày sinh |
| gender | ENUM | | Giới tính (male/female/other) |
| address | NVARCHAR(255) | | Địa chỉ |
| avatar | VARCHAR(255) | | Đường dẫn ảnh đại diện |
| idNumber | VARCHAR(20) | | Số CCCD |
| signature | NVARCHAR(100) | | Chữ ký (dùng cho bác sĩ) |
| isActive | BOOLEAN | DEFAULT true | Trạng thái hoạt động |
| refreshToken | TEXT | | Token làm mới |
| lastLoginAt | DATETIME | | Thời gian đăng nhập cuối |
| createdAt | DATETIME | | Thời gian tạo |
| updatedAt | DATETIME | | Thời gian cập nhật |
| deletedAt | DATETIME | | Thời gian xóa (soft delete) |

**Indexes:**
- `idx_users_username` (username)
- `idx_users_email` (email)
- `idx_users_role` (role)

---

### 2. Patients (Bệnh nhân)

Lưu trữ thông tin chi tiết của bệnh nhân.

| Cột | Kiểu Dữ Liệu | Ràng Buộc | Mô Tả |
|-----|--------------|-----------|-------|
| id | VARCHAR(10) | PK | Mã bệnh nhân (BN001, BN002...) |
| userId | UUID | FK → users.id | Liên kết tài khoản (nếu có) |
| fullName | NVARCHAR(100) | NOT NULL | Họ tên |
| dateOfBirth | DATE | NOT NULL | Ngày sinh |
| gender | ENUM | NOT NULL | Giới tính |
| phone | VARCHAR(15) | NOT NULL | Số điện thoại |
| email | VARCHAR(100) | | Email |
| address | NVARCHAR(255) | | Địa chỉ |
| idNumber | VARCHAR(20) | UNIQUE | Số CCCD |
| medicalHistory | TEXT | | Tiền sử bệnh |
| allergies | TEXT | | Dị ứng |
| emergencyContact | NVARCHAR(100) | | Người liên hệ khẩn cấp |
| emergencyPhone | VARCHAR(15) | | SĐT khẩn cấp |
| insuranceNumber | VARCHAR(30) | | Số thẻ BHYT |
| notes | TEXT | | Ghi chú |
| createdAt | DATETIME | | Thời gian tạo |
| updatedAt | DATETIME | | Thời gian cập nhật |
| deletedAt | DATETIME | | Thời gian xóa |

**Indexes:**
- `idx_patients_phone` (phone)
- `idx_patients_idNumber` (idNumber)
- `idx_patients_fullName` (fullName)

---

### 3. Appointments (Lịch hẹn)

Quản lý lịch hẹn khám bệnh.

| Cột | Kiểu Dữ Liệu | Ràng Buộc | Mô Tả |
|-----|--------------|-----------|-------|
| id | VARCHAR(15) | PK | Mã lịch hẹn (APT-20260301-001) |
| patientId | VARCHAR(10) | FK → patients.id | Mã bệnh nhân |
| patientName | NVARCHAR(100) | | Tên bệnh nhân |
| patientGender | ENUM | | Giới tính |
| patientBirthDate | DATE | | Ngày sinh |
| patientPhone | VARCHAR(15) | | SĐT bệnh nhân |
| patientEmail | VARCHAR(100) | | Email bệnh nhân |
| appointmentDate | DATE | NOT NULL | Ngày hẹn |
| timeSlot | VARCHAR(11) | NOT NULL | Khung giờ (08:00-08:30) |
| estimatedDuration | INT | DEFAULT 30 | Thời lượng dự kiến (phút) |
| examType | NVARCHAR(50) | | Loại khám |
| symptoms | TEXT | | Triệu chứng |
| preferredDoctorId | UUID | FK → users.id | Bác sĩ mong muốn |
| preferredDoctorName | NVARCHAR(100) | | Tên bác sĩ mong muốn |
| assignedDoctorId | UUID | FK → users.id | Bác sĩ được phân |
| assignedDoctorName | NVARCHAR(100) | | Tên bác sĩ được phân |
| status | ENUM | NOT NULL | Trạng thái |
| source | ENUM | DEFAULT 'Offline' | Nguồn đặt (Online/Offline) |
| patientNotes | TEXT | | Ghi chú của bệnh nhân |
| internalNotes | TEXT | | Ghi chú nội bộ |
| confirmedAt | DATETIME | | Thời gian xác nhận |
| cancelledAt | DATETIME | | Thời gian hủy |
| cancelReason | NVARCHAR(255) | | Lý do hủy |
| createdAt | DATETIME | | Thời gian tạo |
| updatedAt | DATETIME | | Thời gian cập nhật |
| deletedAt | DATETIME | | Thời gian xóa |

**Trạng thái lịch hẹn (status):**
- `scheduled` - Đã đặt lịch
- `confirmed` - Đã xác nhận
- `waiting` - Đang chờ khám
- `in_progress` - Đang khám
- `completed` - Hoàn thành
- `cancelled` - Đã hủy
- `no_show` - Không đến

**Indexes:**
- `idx_appointments_date` (appointmentDate)
- `idx_appointments_status` (status)
- `idx_appointments_patient` (patientId)
- `idx_appointments_doctor` (assignedDoctorId)

---

### 4. Medical Records (Phiếu khám)

Lưu trữ thông tin khám bệnh.

| Cột | Kiểu Dữ Liệu | Ràng Buộc | Mô Tả |
|-----|--------------|-----------|-------|
| id | VARCHAR(15) | PK | Mã phiếu khám (MR-20260301-001) |
| patientId | VARCHAR(10) | FK → patients.id, NOT NULL | Mã bệnh nhân |
| appointmentId | VARCHAR(15) | FK → appointments.id | Mã lịch hẹn |
| patientName | NVARCHAR(100) | | Tên bệnh nhân |
| patientGender | ENUM | | Giới tính |
| patientBirthDate | DATE | | Ngày sinh |
| patientPhone | VARCHAR(15) | | SĐT |
| patientAddress | NVARCHAR(255) | | Địa chỉ |
| examType | NVARCHAR(50) | | Loại khám |
| purpose | NVARCHAR(255) | | Lý do khám |
| receptionTime | DATETIME | | Thời gian tiếp đón |
| startedAt | DATETIME | | Thời gian bắt đầu khám |
| completedAt | DATETIME | | Thời gian kết thúc |
| doctorId | UUID | FK → users.id | Mã bác sĩ |
| doctorName | NVARCHAR(100) | | Tên bác sĩ |
| initialVitalSigns | JSON | | Chỉ số sinh tồn ban đầu |
| vitalSigns | JSON | | Chỉ số sinh tồn khi khám |
| symptoms | TEXT | | Triệu chứng |
| diagnosis | TEXT | | Chẩn đoán |
| treatment | TEXT | | Phương pháp điều trị |
| notes | TEXT | | Ghi chú |
| nextAppointment | DATE | | Ngày tái khám |
| status | ENUM | NOT NULL | Trạng thái |
| createdAt | DATETIME | | Thời gian tạo |
| updatedAt | DATETIME | | Thời gian cập nhật |
| deletedAt | DATETIME | | Thời gian xóa |

**Cấu trúc vitalSigns (JSON):**
```json
{
  "bloodPressure": "120/80",
  "heartRate": 72,
  "temperature": 36.5,
  "weight": 65,
  "height": 170,
  "respiratoryRate": 16,
  "spO2": 98
}
```

**Trạng thái phiếu khám (status):**
- `waiting` - Chờ khám
- `in_progress` - Đang khám
- `pending_lab` - Chờ kết quả XN
- `completed` - Hoàn thành
- `cancelled` - Đã hủy

---

### 5. Service Orders (Phiếu chỉ định)

Lưu trữ các chỉ định dịch vụ (xét nghiệm, siêu âm...).

| Cột | Kiểu Dữ Liệu | Ràng Buộc | Mô Tả |
|-----|--------------|-----------|-------|
| id | VARCHAR(15) | PK | Mã phiếu chỉ định |
| medicalRecordId | VARCHAR(15) | FK → medical_records.id | Mã phiếu khám |
| patientId | VARCHAR(10) | FK → patients.id | Mã bệnh nhân |
| patientName | NVARCHAR(100) | | Tên bệnh nhân |
| services | JSON | NOT NULL | Danh sách dịch vụ |
| totalAmount | DECIMAL(12,2) | | Tổng tiền |
| status | ENUM | | Trạng thái |
| notes | TEXT | | Ghi chú |
| orderedById | UUID | FK → users.id | Người chỉ định |
| orderedBy | NVARCHAR(100) | | Tên người chỉ định |
| createdAt | DATETIME | | Thời gian tạo |
| updatedAt | DATETIME | | Thời gian cập nhật |
| deletedAt | DATETIME | | Thời gian xóa |

**Cấu trúc services (JSON):**
```json
[
  {
    "serviceId": "LS001",
    "name": "Công thức máu",
    "type": "Xét nghiệm máu",
    "price": 80000,
    "room": "Phòng XN 1"
  }
]
```

---

### 6. Lab Tests (Xét nghiệm)

Lưu trữ kết quả xét nghiệm.

| Cột | Kiểu Dữ Liệu | Ràng Buộc | Mô Tả |
|-----|--------------|-----------|-------|
| id | VARCHAR(15) | PK | Mã xét nghiệm (LT-20260301-001) |
| patientId | VARCHAR(10) | FK → patients.id | Mã bệnh nhân |
| patientName | NVARCHAR(100) | | Tên bệnh nhân |
| medicalRecordId | VARCHAR(15) | FK → medical_records.id | Mã phiếu khám |
| serviceOrderId | VARCHAR(15) | FK → service_orders.id | Mã phiếu chỉ định |
| testType | NVARCHAR(50) | NOT NULL | Loại xét nghiệm |
| testName | NVARCHAR(100) | NOT NULL | Tên xét nghiệm |
| orderedById | UUID | FK → users.id | Bác sĩ yêu cầu |
| orderedBy | NVARCHAR(100) | | Tên bác sĩ yêu cầu |
| orderedDate | DATETIME | NOT NULL | Ngày yêu cầu |
| results | TEXT | | Kết quả |
| normalRange | VARCHAR(100) | | Giá trị bình thường |
| resultDate | DATETIME | | Ngày có kết quả |
| confirmedById | UUID | FK → users.id | Người xác nhận |
| confirmedBy | NVARCHAR(100) | | Tên người xác nhận |
| confirmedAt | DATETIME | | Thời gian xác nhận |
| status | ENUM | NOT NULL | Trạng thái |
| notes | TEXT | | Ghi chú |
| createdAt | DATETIME | | Thời gian tạo |
| updatedAt | DATETIME | | Thời gian cập nhật |
| deletedAt | DATETIME | | Thời gian xóa |

**Trạng thái xét nghiệm (status):**
- `pending` - Chờ thực hiện
- `in_progress` - Đang thực hiện
- `completed` - Hoàn thành
- `cancelled` - Đã hủy

---

### 7. Lab Services (Dịch vụ xét nghiệm)

Danh mục các dịch vụ xét nghiệm.

| Cột | Kiểu Dữ Liệu | Ràng Buộc | Mô Tả |
|-----|--------------|-----------|-------|
| id | VARCHAR(10) | PK | Mã dịch vụ (LS001, LS002...) |
| name | NVARCHAR(100) | NOT NULL | Tên dịch vụ |
| type | NVARCHAR(50) | NOT NULL | Loại dịch vụ |
| price | DECIMAL(12,2) | NOT NULL | Giá |
| description | TEXT | | Mô tả |
| room | VARCHAR(50) | | Phòng thực hiện |
| duration | INT | | Thời gian thực hiện (phút) |
| instructions | TEXT | | Hướng dẫn |
| isActive | BOOLEAN | DEFAULT true | Trạng thái hoạt động |
| createdAt | DATETIME | | Thời gian tạo |
| updatedAt | DATETIME | | Thời gian cập nhật |
| deletedAt | DATETIME | | Thời gian xóa |

---

### 8. Prescriptions (Đơn thuốc)

Lưu trữ đơn thuốc của bệnh nhân.

| Cột | Kiểu Dữ Liệu | Ràng Buộc | Mô Tả |
|-----|--------------|-----------|-------|
| id | VARCHAR(15) | PK | Mã đơn thuốc (RX-20260301-001) |
| medicalRecordId | VARCHAR(15) | FK → medical_records.id | Mã phiếu khám |
| patientId | VARCHAR(10) | FK → patients.id | Mã bệnh nhân |
| patientName | NVARCHAR(100) | | Tên bệnh nhân |
| doctorId | UUID | FK → users.id | Bác sĩ kê đơn |
| doctorName | NVARCHAR(100) | | Tên bác sĩ |
| prescriptionDate | DATETIME | NOT NULL | Ngày kê đơn |
| diagnosis | TEXT | | Chẩn đoán |
| items | JSON | NOT NULL | Danh sách thuốc |
| notes | TEXT | | Ghi chú |
| isDispensed | BOOLEAN | DEFAULT false | Đã phát thuốc chưa |
| dispensedAt | DATETIME | | Thời gian phát |
| dispensedById | UUID | FK → users.id | Người phát |
| dispensedByName | NVARCHAR(100) | | Tên người phát |
| createdAt | DATETIME | | Thời gian tạo |
| updatedAt | DATETIME | | Thời gian cập nhật |
| deletedAt | DATETIME | | Thời gian xóa |

**Cấu trúc items (JSON):**
```json
[
  {
    "medicineId": "MED001",
    "medicineName": "Paracetamol 500mg",
    "quantity": 20,
    "unit": "Viên",
    "dosage": "1 viên",
    "frequency": "3 lần/ngày",
    "duration": "5 ngày",
    "instructions": "Uống sau ăn",
    "price": 2000
  }
]
```

---

### 9. Medicines (Thuốc)

Danh mục thuốc và quản lý tồn kho.

| Cột | Kiểu Dữ Liệu | Ràng Buộc | Mô Tả |
|-----|--------------|-----------|-------|
| id | VARCHAR(10) | PK | Mã thuốc (MED001, MED002...) |
| name | NVARCHAR(100) | NOT NULL | Tên thuốc |
| genericName | NVARCHAR(100) | | Tên hoạt chất |
| unit | NVARCHAR(20) | NOT NULL | Đơn vị (Viên, Chai, Hộp...) |
| price | DECIMAL(12,2) | NOT NULL | Giá bán |
| quantity | INT | DEFAULT 0 | Số lượng tồn kho |
| minQuantity | INT | DEFAULT 0 | Số lượng tối thiểu |
| category | NVARCHAR(50) | | Nhóm thuốc |
| supplier | NVARCHAR(100) | | Nhà cung cấp |
| manufacturer | NVARCHAR(100) | | Nhà sản xuất |
| batchNumber | VARCHAR(50) | | Số lô |
| expiryDate | DATE | | Ngày hết hạn |
| manufacturingDate | DATE | | Ngày sản xuất |
| description | TEXT | | Mô tả |
| dosageInstructions | TEXT | | Hướng dẫn liều dùng |
| sideEffects | TEXT | | Tác dụng phụ |
| contraindications | TEXT | | Chống chỉ định |
| storageConditions | NVARCHAR(255) | | Điều kiện bảo quản |
| isActive | BOOLEAN | DEFAULT true | Trạng thái hoạt động |
| createdAt | DATETIME | | Thời gian tạo |
| updatedAt | DATETIME | | Thời gian cập nhật |
| deletedAt | DATETIME | | Thời gian xóa |

**Indexes:**
- `idx_medicines_name` (name)
- `idx_medicines_quantity` (quantity)
- `idx_medicines_expiry` (expiryDate)

---

### 10. Inventory Transactions (Giao dịch kho)

Lưu trữ lịch sử nhập/xuất kho thuốc.

| Cột | Kiểu Dữ Liệu | Ràng Buộc | Mô Tả |
|-----|--------------|-----------|-------|
| id | UUID | PK | Mã giao dịch |
| medicineId | VARCHAR(10) | FK → medicines.id | Mã thuốc |
| medicineName | NVARCHAR(100) | | Tên thuốc |
| type | ENUM | NOT NULL | Loại (import/export/adjustment) |
| quantity | INT | NOT NULL | Số lượng |
| previousQuantity | INT | NOT NULL | Số lượng trước |
| newQuantity | INT | NOT NULL | Số lượng sau |
| reason | NVARCHAR(255) | | Lý do |
| referenceType | VARCHAR(50) | | Loại tham chiếu (Prescription, PurchaseOrder...) |
| referenceId | VARCHAR(50) | | Mã tham chiếu |
| notes | TEXT | | Ghi chú |
| performedById | UUID | FK → users.id | Người thực hiện |
| performedBy | NVARCHAR(100) | | Tên người thực hiện |
| createdAt | DATETIME | | Thời gian tạo |
| updatedAt | DATETIME | | Thời gian cập nhật |

**Loại giao dịch (type):**
- `import` - Nhập kho
- `export` - Xuất kho
- `adjustment` - Điều chỉnh

---

### 11. Payments (Hóa đơn)

Quản lý thanh toán.

| Cột | Kiểu Dữ Liệu | Ràng Buộc | Mô Tả |
|-----|--------------|-----------|-------|
| id | VARCHAR(15) | PK | Mã hóa đơn (INV-20260301-001) |
| type | ENUM | NOT NULL | Loại (medical_exam, medicine, lab_test, other) |
| patientId | VARCHAR(10) | FK → patients.id | Mã bệnh nhân |
| patientName | NVARCHAR(100) | | Tên bệnh nhân |
| patientPhone | VARCHAR(15) | | SĐT |
| patientBirthDate | DATE | | Ngày sinh |
| patientGender | ENUM | | Giới tính |
| medicalRecordId | VARCHAR(15) | FK → medical_records.id | Mã phiếu khám |
| prescriptionId | VARCHAR(15) | FK → prescriptions.id | Mã đơn thuốc |
| services | JSON | | Danh sách dịch vụ |
| medicines | JSON | | Danh sách thuốc |
| consultationFee | DECIMAL(12,2) | DEFAULT 0 | Phí khám |
| labTestFee | DECIMAL(12,2) | DEFAULT 0 | Phí xét nghiệm |
| medicineFee | DECIMAL(12,2) | DEFAULT 0 | Tiền thuốc |
| subtotal | DECIMAL(12,2) | | Tạm tính |
| discountType | ENUM | | Loại giảm giá (percent/amount) |
| discountValue | DECIMAL(12,2) | | Giá trị giảm |
| discountAmount | DECIMAL(12,2) | | Số tiền giảm |
| total | DECIMAL(12,2) | NOT NULL | Tổng cộng |
| amountPaid | DECIMAL(12,2) | DEFAULT 0 | Số tiền đã trả |
| changeAmount | DECIMAL(12,2) | DEFAULT 0 | Tiền thừa |
| paymentMethod | ENUM | | Phương thức (cash/card/transfer/momo/vnpay) |
| status | ENUM | NOT NULL | Trạng thái |
| cashierId | UUID | FK → users.id | Thu ngân |
| cashierName | NVARCHAR(100) | | Tên thu ngân |
| cashierSignature | NVARCHAR(100) | | Chữ ký thu ngân |
| patientSignature | TEXT | | Chữ ký bệnh nhân |
| paidAt | DATETIME | | Thời gian thanh toán |
| notes | TEXT | | Ghi chú |
| createdAt | DATETIME | | Thời gian tạo |
| updatedAt | DATETIME | | Thời gian cập nhật |
| deletedAt | DATETIME | | Thời gian xóa |

**Trạng thái thanh toán (status):**
- `unpaid` - Chưa thanh toán
- `paid` - Đã thanh toán
- `partial` - Thanh toán một phần
- `refunded` - Đã hoàn tiền

---

## 🔗 Quan Hệ Giữa Các Bảng

### Sơ đồ quan hệ (ERD)

```
                                    ┌─────────────┐
                                    │   USERS     │
                                    │─────────────│
                                    │ id (PK)     │
                                    │ role        │
                                    │ ...         │
                                    └──────┬──────┘
                                           │
           ┌───────────────────────────────┼───────────────────────────────┐
           │                               │                               │
           │ 1:1 (optional)                │ 1:N                           │ 1:N
           ▼                               ▼                               ▼
    ┌──────────────┐              ┌───────────────────┐           ┌──────────────────┐
    │   PATIENTS   │              │   APPOINTMENTS    │           │ MEDICAL_RECORDS  │
    │──────────────│              │───────────────────│           │──────────────────│
    │ id (PK)      │◄─────────────│ patientId (FK)    │           │ id (PK)          │
    │ userId (FK)  │              │ assignedDoctorId  │───────────│ appointmentId    │
    │ ...          │              │ (FK → users)      │           │ doctorId (FK)    │
    └──────┬───────┘              │ ...               │           │ patientId (FK)   │
           │                      └───────────────────┘           │ ...              │
           │                                                      └────────┬─────────┘
           │                                                               │
           │ 1:N                                                           │ 1:N
           │                                                               │
           │    ┌──────────────────────────────────────────────────────────┤
           │    │                          │                               │
           │    │                          │ 1:N                           │ 1:N
           │    │                          ▼                               ▼
           │    │                 ┌─────────────────┐            ┌──────────────────┐
           │    │                 │  SERVICE_ORDERS │            │   PRESCRIPTIONS  │
           │    │                 │─────────────────│            │──────────────────│
           │    │                 │ id (PK)         │            │ id (PK)          │
           │    │                 │ medicalRecordId │            │ medicalRecordId  │
           │    │                 │ patientId (FK)  │            │ patientId (FK)   │
           │    │                 │ ...             │            │ doctorId (FK)    │
           │    │                 └────────┬────────┘            │ dispensedById(FK)│
           │    │                          │                     │ ...              │
           │    │                          │ 1:N                 └──────────────────┘
           │    │                          ▼
           │    │                 ┌─────────────────┐
           │    │                 │    LAB_TESTS    │
           │    │                 │─────────────────│
           │    │                 │ id (PK)         │
           │    │                 │ medicalRecordId │
           │    │                 │ serviceOrderId  │
           │    │                 │ patientId (FK)  │
           │    │                 │ orderedById(FK) │
           │    │                 │ confirmedById   │
           │    │                 │ ...             │
           │    │                 └─────────────────┘
           │    │
           │    │ 1:N                                           ┌──────────────────┐
           │    ▼                                               │   LAB_SERVICES   │
    ┌──────────────────┐                                        │──────────────────│
    │     PAYMENTS     │                                        │ id (PK)          │
    │──────────────────│                                        │ name             │
    │ id (PK)          │                                        │ type             │
    │ patientId (FK)   │                                        │ price            │
    │ medicalRecordId  │                                        │ ...              │
    │ prescriptionId   │                                        └──────────────────┘
    │ cashierId (FK)   │
    │ ...              │
    └──────────────────┘


    ┌──────────────────┐                         ┌─────────────────────────┐
    │    MEDICINES     │                         │ INVENTORY_TRANSACTIONS  │
    │──────────────────│  1:N                    │─────────────────────────│
    │ id (PK)          │◄────────────────────────│ id (PK)                 │
    │ name             │                         │ medicineId (FK)         │
    │ quantity         │                         │ type                    │
    │ price            │                         │ quantity                │
    │ ...              │                         │ performedById (FK)      │
    └──────────────────┘                         │ ...                     │
                                                 └─────────────────────────┘
```

### Chi tiết quan hệ

| Bảng A | Quan hệ | Bảng B | Mô tả |
|--------|---------|--------|-------|
| users | 1:1 | patients | User có thể có 1 patient profile (nếu role=patient) |
| users | 1:N | appointments | Bác sĩ có nhiều lịch hẹn được phân |
| users | 1:N | medical_records | Bác sĩ có nhiều phiếu khám |
| users | 1:N | prescriptions | Bác sĩ kê nhiều đơn thuốc |
| users | 1:N | lab_tests | Bác sĩ yêu cầu nhiều xét nghiệm |
| users | 1:N | payments | Thu ngân xử lý nhiều hóa đơn |
| users | 1:N | inventory_transactions | User thực hiện nhiều giao dịch kho |
| patients | 1:N | appointments | Bệnh nhân có nhiều lịch hẹn |
| patients | 1:N | medical_records | Bệnh nhân có nhiều phiếu khám |
| patients | 1:N | prescriptions | Bệnh nhân có nhiều đơn thuốc |
| patients | 1:N | lab_tests | Bệnh nhân có nhiều xét nghiệm |
| patients | 1:N | payments | Bệnh nhân có nhiều hóa đơn |
| appointments | 1:1 | medical_records | Lịch hẹn có 1 phiếu khám |
| medical_records | 1:N | service_orders | Phiếu khám có nhiều chỉ định |
| medical_records | 1:N | lab_tests | Phiếu khám có nhiều xét nghiệm |
| medical_records | 1:N | prescriptions | Phiếu khám có nhiều đơn thuốc |
| medical_records | 1:1 | payments | Phiếu khám có 1 hóa đơn |
| service_orders | 1:N | lab_tests | Phiếu chỉ định có nhiều xét nghiệm |
| prescriptions | 1:1 | payments | Đơn thuốc có 1 hóa đơn thuốc |
| medicines | 1:N | inventory_transactions | Thuốc có nhiều giao dịch kho |

---

## 📐 Constraints và Rules

### Business Rules

1. **Lịch hẹn**
   - Không được đặt trùng khung giờ cho cùng 1 bác sĩ
   - Chỉ có thể hủy lịch hẹn ở trạng thái `scheduled` hoặc `confirmed`

2. **Phiếu khám**
   - Chỉ bác sĩ mới có thể bắt đầu và hoàn thành khám
   - Phải có chẩn đoán khi hoàn thành

3. **Đơn thuốc**
   - Kiểm tra tồn kho trước khi kê đơn
   - Không thể sửa đơn thuốc đã phát

4. **Thuốc**
   - Cảnh báo khi tồn kho <= minQuantity
   - Cảnh báo thuốc hết hạn trong 30 ngày

5. **Thanh toán**
   - Không thể xóa hóa đơn đã thanh toán
   - Tự động tính tổng khi có thay đổi

---

## 🔐 Soft Delete

Tất cả các bảng chính đều hỗ trợ soft delete với cột `deletedAt`:
- Khi xóa, chỉ cập nhật `deletedAt = NOW()`
- Query mặc định sẽ lọc `WHERE deletedAt IS NULL`
- Có thể restore bằng cách set `deletedAt = NULL`

---

## 📝 Ghi Chú

1. **UUID vs Auto-increment**: 
   - `users`, `inventory_transactions` sử dụng UUID
   - Các bảng khác dùng custom ID format (VD: BN001, MR-20260301-001)

2. **JSON Fields**:
   - `vitalSigns`, `services`, `medicines`, `items` lưu dạng JSON
   - Cho phép linh hoạt trong cấu trúc dữ liệu

3. **Denormalization**:
   - Một số thông tin được lưu trùng lặp (VD: patientName trong appointments)
   - Giúp query nhanh hơn và giữ lịch sử khi dữ liệu gốc thay đổi

---

## 🛠️ SQL Script Tạo Database

```sql
-- Tạo database
CREATE DATABASE clinic_management;
GO

USE clinic_management;
GO

-- Database sẽ được tạo tự động bởi Sequelize sync
-- Chạy lệnh: npm run dev (với sync alter)
-- Hoặc: npm run seed (với sync force - reset toàn bộ)
```

---

**Cập nhật lần cuối**: 01/03/2026  
**Phiên bản**: 1.0.0
