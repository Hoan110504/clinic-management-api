# Nội Khoa Clinic Management - Backend API

Backend API server cho hệ thống quản lý phòng khám Nội Khoa.

## 🚀 Công nghệ sử dụng

- **Runtime**: Node.js >= 18.x
- **Framework**: Express.js
- **Database**: Microsoft SQL Server
- **ORM**: Sequelize
- **Authentication**: JWT (JSON Web Tokens)
- **Validation**: express-validator
- **Security**: helmet, cors, express-rate-limit
- **Logging**: winston, morgan

## 📁 Cấu trúc thư mục

```
server/
├── src/
│   ├── config/          # Cấu hình ứng dụng
│   ├── controllers/     # Xử lý request/response
│   ├── middleware/      # Express middleware
│   ├── models/          # Sequelize models
│   ├── routes/          # API routes
│   ├── seeders/         # Database seeders
│   ├── utils/           # Tiện ích
│   ├── validators/      # Validation schemas
│   ├── app.js           # Express app setup
│   └── server.js        # Entry point
├── logs/                # Log files
├── .env.example         # Environment template
├── package.json
└── README.md
```

## 🛠️ Cài đặt

### 1. Clone và cài đặt dependencies

```bash
cd server
npm install
```

### 2. Cấu hình environment

Copy file `.env.example` thành `.env` và cập nhật các giá trị:

```bash
cp .env.example .env
```

Cấu hình database SQL Server:

```env
DB_HOST=localhost
DB_PORT=1433
DB_NAME=noikhoa_db
DB_USER=sa
DB_PASSWORD=your_password
```

### 3. Tạo database

Tạo database trong SQL Server Management Studio:

```sql
CREATE DATABASE noikhoa_db;
```

### 4. Chạy seeder (tạo dữ liệu mẫu)

```bash
npm run seed
```

### 5. Khởi động server

Development mode (với hot reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

Server sẽ chạy tại: `http://localhost:5000/api`

## 🔑 Tài khoản mặc định

| Role | Username | Password |
|------|----------|----------|
| Admin | admin | admin123 |
| Bác sĩ 1 | doctor1 | doctor123 |
| Bác sĩ 2 | doctor2 | doctor123 |
| Tiếp tân | receptionist | reception123 |
| Dược sĩ | pharmacist | pharma123 |
| Kỹ thuật viên XN | labtech | labtech123 |

## 📚 API Endpoints

### Authentication
- `POST /api/auth/login` - Đăng nhập
- `POST /api/auth/register` - Đăng ký (bệnh nhân)
- `POST /api/auth/refresh` - Refresh token
- `POST /api/auth/logout` - Đăng xuất
- `GET /api/auth/me` - Thông tin user hiện tại
- `PUT /api/auth/change-password` - Đổi mật khẩu

### Users
- `GET /api/users` - Danh sách users (Admin)
- `GET /api/users/:id` - Chi tiết user
- `POST /api/users` - Tạo user mới
- `PUT /api/users/:id` - Cập nhật user
- `DELETE /api/users/:id` - Xóa user

### Patients
- `GET /api/patients` - Danh sách bệnh nhân
- `GET /api/patients/search` - Tìm kiếm nhanh
- `GET /api/patients/:id` - Chi tiết bệnh nhân
- `POST /api/patients` - Tạo bệnh nhân mới
- `PUT /api/patients/:id` - Cập nhật bệnh nhân

### Appointments
- `GET /api/appointments` - Danh sách lịch hẹn
- `GET /api/appointments/today` - Lịch hẹn hôm nay
- `GET /api/appointments/available-slots` - Khung giờ trống
- `POST /api/appointments` - Tạo lịch hẹn
- `POST /api/appointments/:id/cancel` - Hủy lịch hẹn
- `POST /api/appointments/:id/confirm` - Xác nhận lịch hẹn
- `POST /api/appointments/:id/check-in` - Check-in

### Medical Records
- `GET /api/medical-records` - Danh sách phiếu khám
- `GET /api/medical-records/today-queue` - Hàng đợi hôm nay
- `POST /api/medical-records` - Tạo phiếu khám
- `POST /api/medical-records/:id/start` - Bắt đầu khám
- `POST /api/medical-records/:id/complete` - Hoàn thành khám

### Medicines
- `GET /api/medicines` - Danh sách thuốc
- `GET /api/medicines/low-stock` - Thuốc sắp hết
- `GET /api/medicines/expiring` - Thuốc sắp hết hạn
- `POST /api/medicines` - Thêm thuốc mới
- `POST /api/medicines/:id/inventory` - Điều chỉnh tồn kho

### Lab Tests
- `GET /api/lab-tests` - Danh sách xét nghiệm
- `GET /api/lab-tests/pending` - XN chờ xử lý
- `POST /api/lab-tests/:id/start` - Bắt đầu XN
- `POST /api/lab-tests/:id/complete` - Hoàn thành XN

### Prescriptions
- `GET /api/prescriptions` - Danh sách đơn thuốc
- `GET /api/prescriptions/pending` - Đơn chờ phát
- `POST /api/prescriptions` - Tạo đơn thuốc
- `POST /api/prescriptions/:id/dispense` - Phát thuốc

### Payments
- `GET /api/payments` - Danh sách hóa đơn
- `GET /api/payments/unpaid` - Hóa đơn chờ thanh toán
- `GET /api/payments/statistics` - Thống kê doanh thu
- `POST /api/payments/:id/process` - Thanh toán

### Dashboard
- `GET /api/dashboard/admin` - Dashboard Admin
- `GET /api/dashboard/doctor` - Dashboard Bác sĩ
- `GET /api/dashboard/receptionist` - Dashboard Tiếp tân
- `GET /api/dashboard/pharmacist` - Dashboard Dược sĩ
- `GET /api/dashboard/patient` - Dashboard Bệnh nhân

## 🔒 Phân quyền

| Chức năng | Admin | Doctor | Receptionist | Pharmacist | Lab Tech | Patient |
|-----------|-------|--------|--------------|------------|----------|---------|
| Quản lý users | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Quản lý bệnh nhân | ✅ | ✅ (xem) | ✅ | ❌ | ❌ | ❌ |
| Quản lý lịch hẹn | ✅ | ✅ (của mình) | ✅ | ❌ | ❌ | ✅ (của mình) |
| Khám bệnh | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Kê đơn thuốc | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Phát thuốc | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Xét nghiệm | ❌ | ✅ (yêu cầu) | ❌ | ❌ | ✅ | ❌ |
| Thanh toán | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |

## 📝 Response Format

### Success Response
```json
{
  "success": true,
  "message": "Thao tác thành công",
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Mô tả lỗi",
  "code": "ERROR_CODE"
}
```

### Paginated Response
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "totalPages": 5,
    "totalItems": 50
  }
}
```

## 🐛 Debug & Logs

Logs được lưu trong thư mục `logs/`:
- `error.log` - Chỉ chứa lỗi
- `combined.log` - Tất cả logs

## 📄 License

MIT License
