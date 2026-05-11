# Sửa Lỗi Thông Báo Realtime Theo UserID Bác Sĩ

## Vấn Đề
Trước đây, khi lễ tân:
1. **Đặt lịch hẹn** → Thông báo được gửi tới **tất cả receptionists và admins** (không gửi cho bác sĩ được gán)
2. **Xác nhận đã tới** → Thông báo được gửi tới **tất cả doctors** (không phân biệt theo UserID)

## Giải Pháp
Đã sửa để thông báo được gửi **chỉ cho bác sĩ cụ thể** theo `assignedDoctorId` hoặc `preferredDoctorId`.

## Các Thay Đổi

### 1. Backend - Socket Service (`backend/src/socket/index.js`)

#### a) Cập nhật `setupSocketIO()` - Thêm room cho doctor cụ thể
```javascript
// Bác sĩ join 2 rooms:
// - 'doctors' (room chung cho tất cả bác sĩ)
// - 'doctor:{userId}' (room riêng cho bác sĩ cụ thể)
else if (Number(role) === ROLES.DOCTOR) {
  socket.join('doctors');
  socket.join(`doctor:${userId}`);
  logger.info(`[Socket] Doctor ${userId} joined 'doctors' room and 'doctor:${userId}' room`);
}
```

#### b) Cập nhật `createAndEmitNotification()` - Gửi thông báo cho user cụ thể
```javascript
if (userId) {
  // Gửi tới socket cụ thể của user
  const userSocketId = activeUsers.get(userId);
  if (userSocketId) {
    io.to(userSocketId).emit('notification:new', socketData);
    logger.info(`[Socket] Notification sent to user ${userId} via socket ${userSocketId}`);
  } else {
    logger.info(`[Socket] User ${userId} not connected, notification saved to DB only`);
  }
}
```

#### c) Cập nhật `emitAppointmentCreated()` - Gửi thông báo cho bác sĩ được gán
```javascript
// Thông báo cho receptionists và admins (như cũ)
await createAndEmitNotification(io, {
  targetRoles: [ROLES.RECEPTIONIST, ROLES.ADMIN],
  title,
  content,
  type: 'APPOINTMENT_NEW',
  relatedId: appointment.id
});

// THÊM MỚI: Thông báo cho bác sĩ được gán
const doctorId = appointment.assignedDoctorId || appointment.preferredDoctorId;
if (doctorId) {
  await createAndEmitNotification(io, {
    userId: doctorId,
    title,
    content: `Bạn có lịch hẹn mới với bệnh nhân ${appointment.patientName}.`,
    type: 'APPOINTMENT_NEW',
    relatedId: appointment.id
  });
}

// Emit event cho bác sĩ cụ thể
if (doctorId) {
  const doctorSocketId = activeUsers.get(doctorId);
  if (doctorSocketId) {
    io.to(doctorSocketId).emit('appointment:new', data);
    logger.info(`[Socket Emit] Appointment created notification sent to doctor ${doctorId}`);
  }
}
```

#### d) Cập nhật `emitPatientArrived()` - Chỉ gửi cho bác sĩ được gán
```javascript
// CHỈ gửi cho bác sĩ được gán (không broadcast cho tất cả doctors)
const doctorId = appointment.assignedDoctorId || appointment.preferredDoctorId;
if (doctorId) {
  await createAndEmitNotification(io, {
    userId: doctorId,
    title,
    content,
    type: 'PATIENT_ARRIVED',
    relatedId: appointment.id
  });

  // Emit event cho bác sĩ cụ thể
  const doctorSocketId = activeUsers.get(doctorId);
  if (doctorSocketId) {
    io.to(doctorSocketId).emit('patient:arrived', data);
    logger.info(`[Socket Emit] Patient arrived notification sent to doctor ${doctorId}`);
  } else {
    logger.warn(`[Socket Emit] Doctor ${doctorId} is not connected, notification saved to DB only`);
  }
} else {
  logger.warn(`[Socket Emit] No assigned doctor for appointment ${appointment.id}`);
}
```

### 2. Frontend - Không Cần Thay Đổi

Frontend đã sẵn sàng:
- `SocketContext.jsx` đã lắng nghe sự kiện `appointment:new` và `patient:arrived`
- `NotificationDropdown.jsx` đã lắng nghe sự kiện `notification:new`
- Tất cả đều hoạt động tự động khi nhận được thông báo từ backend

## Cách Hoạt Động

### Flow 1: Lễ Tân Đặt Lịch Hẹn
1. Lễ tân tạo lịch hẹn mới (chọn bác sĩ)
2. Backend tạo appointment record
3. Backend gửi thông báo:
   - Tới **receptionists** và **admins** (broadcast)
   - Tới **bác sĩ được gán** (theo userId cụ thể)
4. Bác sĩ nhận thông báo realtime:
   - Toast notification: "Bạn có lịch hẹn mới với bệnh nhân X"
   - Notification dropdown cập nhật
   - Highlight item trong danh sách (nếu đang xem)

### Flow 2: Lễ Tân Xác Nhận Đã Tới
1. Lễ tân click "Xác nhận đã tới" cho lịch hẹn
2. Backend cập nhật status → "Chờ khám"
3. Backend gửi thông báo:
   - **CHỈ** tới bác sĩ được gán (theo userId cụ thể)
4. Bác sĩ nhận thông báo realtime:
   - Toast notification: "Bệnh nhân X đã có mặt tại phòng khám"
   - Notification dropdown cập nhật
   - Highlight item trong danh sách (nếu đang xem)

## Lợi Ích

1. **Giảm nhiễu**: Bác sĩ chỉ nhận thông báo về bệnh nhân của mình
2. **Tăng hiệu quả**: Không cần lọc thông báo không liên quan
3. **Bảo mật**: Bác sĩ không thấy thông tin bệnh nhân của bác sĩ khác
4. **Lưu vào DB**: Nếu bác sĩ offline, thông báo vẫn được lưu và hiển thị khi login lại

## Testing

### Test Case 1: Đặt Lịch Hẹn
1. Login với role **Receptionist**
2. Đặt lịch hẹn mới, chọn bác sĩ A
3. Login với role **Doctor** (bác sĩ A)
4. Kiểm tra:
   - ✅ Nhận toast notification
   - ✅ Notification dropdown có thông báo mới
   - ✅ Badge số lượng thông báo chưa đọc tăng

### Test Case 2: Xác Nhận Đã Tới
1. Login với role **Receptionist**
2. Xem danh sách lịch hẹn hôm nay
3. Click "Xác nhận đã tới" cho lịch hẹn của bác sĩ A
4. Login với role **Doctor** (bác sĩ A)
5. Kiểm tra:
   - ✅ Nhận toast notification
   - ✅ Notification dropdown có thông báo mới
   - ✅ Badge số lượng thông báo chưa đọc tăng

### Test Case 3: Bác Sĩ Khác Không Nhận Thông Báo
1. Login với role **Receptionist**
2. Đặt lịch hẹn cho bác sĩ A
3. Login với role **Doctor** (bác sĩ B)
4. Kiểm tra:
   - ✅ KHÔNG nhận toast notification
   - ✅ KHÔNG có thông báo mới trong dropdown

## Rollback (Nếu Cần)

Nếu cần quay lại cách cũ (broadcast cho tất cả doctors):

```javascript
// Trong emitPatientArrived()
await createAndEmitNotification(io, {
  targetRoles: [ROLES.DOCTOR], // Thay vì userId: doctorId
  title,
  content,
  type: 'PATIENT_ARRIVED',
  relatedId: appointment.id
});

io.to('doctors').emit('patient:arrived', data); // Thay vì io.to(doctorSocketId)
```

## Ghi Chú

- Thông báo được lưu vào bảng `Notification` với `userId` của bác sĩ
- Nếu bác sĩ offline, thông báo vẫn được lưu và hiển thị khi login lại
- `activeUsers` Map theo dõi socketId của từng user đang online
- Sử dụng `activeUsers.get(userId)` để lấy socketId và gửi thông báo trực tiếp
