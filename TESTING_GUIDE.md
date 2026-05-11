# Hướng Dẫn Test Thông Báo Realtime Theo UserID

## Chuẩn Bị

### 1. Cài Đặt Dependencies (Nếu Chưa Có)
```bash
cd backend
npm install socket.io-client
```

### 2. Khởi Động Backend Server
```bash
cd backend
npm run dev
```

Server sẽ chạy tại `http://localhost:5000`

## Phương Pháp Test

### Phương Pháp 1: Test Thủ Công Qua UI

#### Test Case 1: Đặt Lịch Hẹn
1. **Mở 2 trình duyệt/tab:**
   - Tab 1: Login với role **Receptionist**
   - Tab 2: Login với role **Doctor** (bác sĩ A)

2. **Trong Tab 1 (Receptionist):**
   - Vào trang "Lịch hẹn"
   - Click "Đặt lịch hẹn"
   - Chọn bệnh nhân
   - Chọn **bác sĩ A** (cùng bác sĩ đang login ở Tab 2)
   - Chọn ngày/giờ
   - Click "Xác nhận"

3. **Kiểm tra Tab 2 (Doctor A):**
   - ✅ Phải xuất hiện toast notification: "Bạn có lịch hẹn mới với bệnh nhân X"
   - ✅ Icon chuông (Bell) phải có badge số lượng thông báo chưa đọc
   - ✅ Click vào icon chuông → Thấy thông báo mới trong dropdown

4. **Mở Tab 3: Login với role Doctor (bác sĩ B - khác bác sĩ A):**
   - ✅ KHÔNG có toast notification
   - ✅ KHÔNG có thông báo mới trong dropdown
   - ✅ Badge chuông không tăng

#### Test Case 2: Xác Nhận Đã Tới
1. **Trong Tab 1 (Receptionist):**
   - Vào trang "Đón tiếp"
   - Tìm lịch hẹn của **bác sĩ A**
   - Click "Xác nhận đã tới"

2. **Kiểm tra Tab 2 (Doctor A):**
   - ✅ Phải xuất hiện toast notification: "Bệnh nhân X đã có mặt tại phòng khám"
   - ✅ Badge chuông tăng thêm 1
   - ✅ Thông báo mới xuất hiện trong dropdown

3. **Kiểm tra Tab 3 (Doctor B):**
   - ✅ KHÔNG có toast notification
   - ✅ KHÔNG có thông báo mới

#### Test Case 3: Bác Sĩ Offline → Online
1. **Trong Tab 1 (Receptionist):**
   - Đặt lịch hẹn cho **bác sĩ A**
   - Xác nhận đã tới cho lịch hẹn của **bác sĩ A**

2. **Đóng Tab 2 (Doctor A offline)**

3. **Mở lại Tab 2 và login với Doctor A:**
   - ✅ Badge chuông phải hiển thị số lượng thông báo chưa đọc
   - ✅ Click vào chuông → Thấy tất cả thông báo đã lưu trong DB

### Phương Pháp 2: Test Bằng Script

#### Bước 1: Chuẩn Bị
```bash
cd backend
```

#### Bước 2: Sửa File test-socket-notification.mjs
Mở file `test-socket-notification.mjs` và thay đổi:
```javascript
const DOCTOR_USER_ID = 2; // Thay bằng ID bác sĩ thực tế trong DB
const RECEPTIONIST_USER_ID = 3; // Thay bằng ID lễ tân thực tế trong DB
```

**Cách lấy UserID:**
```sql
-- Chạy trong SQL Server Management Studio hoặc Azure Data Studio
SELECT UserID, FullName, Role FROM Users WHERE Role IN (2, 3);
-- Role 2 = Doctor, Role 3 = Receptionist
```

#### Bước 3: Chạy Script
```bash
node test-socket-notification.mjs
```

Kết quả mong đợi:
```
🔌 Connecting to Socket.IO server...
✅ Doctor connected: abc123
✅ Receptionist connected: def456

📡 Listening for notifications...
💡 Tip: Tạo lịch hẹn mới hoặc xác nhận đã tới để test
```

#### Bước 4: Tạo Lịch Hẹn Qua UI
1. Login vào UI với role Receptionist
2. Đặt lịch hẹn cho bác sĩ có UserID = DOCTOR_USER_ID
3. Kiểm tra console của script:

Kết quả mong đợi:
```
📬 [Doctor] Received notification:new: { id: 123, title: 'Lịch hẹn mới', ... }
📅 [Doctor] Received appointment:new: { appointmentId: 456, ... }
📬 [Receptionist] Received notification:new: { id: 124, title: 'Lịch hẹn mới', ... }
📅 [Receptionist] Received appointment:new: { appointmentId: 456, ... }
```

#### Bước 5: Xác Nhận Đã Tới Qua UI
1. Trong UI (Receptionist), click "Xác nhận đã tới"
2. Kiểm tra console của script:

Kết quả mong đợi:
```
📬 [Doctor] Received notification:new: { id: 125, title: 'Bệnh nhân đã tới', ... }
🏥 [Doctor] Received patient:arrived: { appointmentId: 456, ... }
```

**Lưu ý:** Receptionist KHÔNG nhận sự kiện `patient:arrived` (chỉ Doctor nhận)

### Phương Pháp 3: Test Bằng Postman/Thunder Client

#### Test 1: Tạo Lịch Hẹn
```http
POST http://localhost:5000/api/appointments
Content-Type: application/json
Authorization: Bearer <RECEPTIONIST_TOKEN>

{
  "patientId": 1,
  "patientName": "Nguyễn Văn A",
  "patientPhone": "0123456789",
  "appointmentDate": "2026-05-15",
  "timeSlot": "08:00 - 08:30",
  "assignedDoctorId": 2,
  "assignedDoctorName": "BS. Trần Thị B",
  "symptoms": "Đau đầu",
  "source": "Offline"
}
```

Kiểm tra:
- ✅ Response 201 Created
- ✅ Script console hiển thị notification cho Doctor và Receptionist

#### Test 2: Xác Nhận Đã Tới
```http
POST http://localhost:5000/api/appointments/{appointmentId}/check-in
Authorization: Bearer <RECEPTIONIST_TOKEN>
```

Kiểm tra:
- ✅ Response 200 OK
- ✅ Script console hiển thị notification CHỈ cho Doctor

## Kiểm Tra Database

### Kiểm Tra Thông Báo Đã Lưu
```sql
-- Xem thông báo của bác sĩ cụ thể
SELECT 
  NotificationID,
  UserID,
  Role,
  Title,
  Content,
  Type,
  IsRead,
  CreatedAt
FROM Notifications
WHERE UserID = 2 -- Thay bằng ID bác sĩ
ORDER BY CreatedAt DESC;
```

Kết quả mong đợi:
- Có thông báo với `Type = 'APPOINTMENT_NEW'` khi đặt lịch
- Có thông báo với `Type = 'PATIENT_ARRIVED'` khi xác nhận đã tới
- `UserID` phải khớp với ID bác sĩ được gán

### Kiểm Tra Lịch Hẹn
```sql
-- Xem lịch hẹn và bác sĩ được gán
SELECT 
  AppointmentID,
  PatientName,
  AssignedDoctorID,
  AssignedDoctorName,
  Status,
  CreatedAt
FROM Appointments
ORDER BY CreatedAt DESC;
```

## Troubleshooting

### Vấn Đề 1: Không Nhận Được Thông Báo
**Nguyên nhân:**
- Socket không kết nối
- UserID không khớp
- Backend server không chạy

**Giải pháp:**
1. Kiểm tra console browser (F12) → Tab Network → Filter "ws" → Xem WebSocket connection
2. Kiểm tra backend logs:
   ```
   [Socket] User 2 (role: 2) joined with socket abc123
   [Socket] Doctor 2 joined 'doctors' room and 'doctor:2' room
   ```
3. Kiểm tra `assignedDoctorId` trong appointment có khớp với UserID của doctor không

### Vấn Đề 2: Tất Cả Bác Sĩ Đều Nhận Thông Báo
**Nguyên nhân:**
- Code chưa được cập nhật
- Server chưa restart

**Giải pháp:**
1. Restart backend server:
   ```bash
   # Ctrl+C để dừng
   npm run dev
   ```
2. Kiểm tra file `backend/src/socket/index.js` đã có code mới chưa
3. Clear cache browser (Ctrl+Shift+Delete)

### Vấn Đề 3: Thông Báo Không Lưu Vào DB
**Nguyên nhân:**
- Database connection lỗi
- Notification model không đúng

**Giải pháp:**
1. Kiểm tra backend logs:
   ```
   [Socket] Notification sent to user 2 via socket abc123
   ```
2. Kiểm tra database connection:
   ```bash
   npm run db:migrate
   ```
3. Kiểm tra bảng Notifications có tồn tại không

## Kết Quả Mong Đợi

### ✅ Thành Công Khi:
1. Bác sĩ được gán nhận thông báo realtime
2. Bác sĩ khác KHÔNG nhận thông báo
3. Thông báo được lưu vào DB với đúng UserID
4. Badge chuông cập nhật đúng số lượng
5. Notification dropdown hiển thị đúng thông báo

### ❌ Thất Bại Khi:
1. Tất cả bác sĩ đều nhận thông báo (broadcast)
2. Không có bác sĩ nào nhận thông báo
3. Thông báo không lưu vào DB
4. Badge chuông không cập nhật
5. Toast notification không hiển thị

## Ghi Chú

- Test trên môi trường development trước khi deploy production
- Đảm bảo có ít nhất 2 user với role Doctor trong DB
- Kiểm tra CORS settings nếu test từ domain khác
- Sử dụng incognito/private mode để test với nhiều user cùng lúc
