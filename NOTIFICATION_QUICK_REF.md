# Notification System - Quick Reference

## 🎯 Cách Gửi Thông Báo

### 1. Gửi Cho User Cụ Thể (Recommended)

```javascript
import * as socketService from '../socket/index.js';

// Trong controller
const io = req.app?.get?.('io');
if (io) {
  socketService.emitPatientArrived(io, appointment);
}
```

**Khi nào dùng:**
- Thông báo cho bác sĩ được gán
- Thông báo cho bệnh nhân cụ thể
- Thông báo cho user cụ thể bất kỳ

### 2. Gửi Cho Role (Broadcast)

```javascript
// Gửi cho tất cả receptionists
socketService.emitAppointmentCreated(io, appointment);
```

**Khi nào dùng:**
- Thông báo cho tất cả lễ tân
- Thông báo cho tất cả admin
- Thông báo cho tất cả dược sĩ

## 📋 Các Loại Thông Báo

| Type | Gửi Tới | Trigger | Event |
|------|---------|---------|-------|
| `APPOINTMENT_NEW` | Receptionist, Admin, **Doctor (assigned)** | Đặt lịch hẹn | `appointment:new` |
| `APPOINTMENT_CANCELLED` | Receptionist, Admin, Doctor | Hủy lịch hẹn | `appointment:cancelled` |
| `APPOINTMENT_CONFIRMED` | Receptionist, Admin, Patient | Xác nhận lịch | `appointment:status-changed` |
| `PATIENT_ARRIVED` | **Doctor (assigned only)** | Check-in | `patient:arrived` |
| `PRESCRIPTION_NEW` | Pharmacist | Kê đơn thuốc | `prescription:new` |
| `PRESCRIPTION_DISPENSED` | Doctor | Phát thuốc | `prescription:dispensed` |

## 🔧 API Functions

### emitAppointmentCreated(io, appointment)
```javascript
// Gửi khi: Tạo lịch hẹn mới
// Gửi tới: Receptionist, Admin, Bác sĩ được gán
socketService.emitAppointmentCreated(io, {
  id: 123,
  patientName: 'Nguyễn Văn A',
  assignedDoctorId: 2, // UserID của bác sĩ
  // ... other fields
});
```

### emitPatientArrived(io, appointment)
```javascript
// Gửi khi: Lễ tân xác nhận bệnh nhân đã tới
// Gửi tới: CHỈ bác sĩ được gán
socketService.emitPatientArrived(io, {
  id: 123,
  patientName: 'Nguyễn Văn A',
  assignedDoctorId: 2, // REQUIRED
  // ... other fields
});
```

### emitAppointmentCancelled(io, appointment)
```javascript
// Gửi khi: Hủy lịch hẹn
// Gửi tới: Receptionist, Admin, Doctor
socketService.emitAppointmentCancelled(io, appointment);
```

### emitPrescriptionCreated(io, prescription)
```javascript
// Gửi khi: Bác sĩ kê đơn thuốc
// Gửi tới: Pharmacist
socketService.emitPrescriptionCreated(io, prescription);
```

## 🎨 Frontend - Lắng Nghe Thông Báo

### Trong Component
```javascript
import { useSocket } from '@/hooks';

function MyComponent() {
  const { on, off } = useSocket();

  useEffect(() => {
    const handlePatientArrived = (data) => {
      console.log('Patient arrived:', data);
      // Cập nhật UI
    };

    on('patient:arrived', handlePatientArrived);

    return () => {
      off('patient:arrived', handlePatientArrived);
    };
  }, [on, off]);
}
```

### Các Event Có Sẵn
- `notification:new` - Thông báo mới (tất cả loại)
- `appointment:new` - Lịch hẹn mới
- `appointment:cancelled` - Lịch hẹn bị hủy
- `appointment:status-changed` - Trạng thái lịch hẹn thay đổi
- `patient:arrived` - Bệnh nhân đã tới
- `prescription:new` - Đơn thuốc mới
- `prescription:dispensed` - Đơn thuốc đã phát

## 🔍 Debug

### Kiểm Tra Socket Connection
```javascript
// Browser Console
console.log('Socket connected:', socket.connected);
console.log('Socket ID:', socket.id);
```

### Kiểm Tra Rooms
```javascript
// Backend logs
[Socket] Doctor 2 joined 'doctors' room and 'doctor:2' room
```

### Kiểm Tra Notification Sent
```javascript
// Backend logs
[Socket Emit] Patient arrived notification sent to doctor 2
```

## ⚠️ Common Mistakes

### ❌ Sai: Broadcast cho tất cả doctors
```javascript
io.to('doctors').emit('patient:arrived', data);
```

### ✅ Đúng: Gửi cho bác sĩ cụ thể
```javascript
const doctorSocketId = activeUsers.get(doctorId);
if (doctorSocketId) {
  io.to(doctorSocketId).emit('patient:arrived', data);
}
```

### ❌ Sai: Không kiểm tra doctorId
```javascript
socketService.emitPatientArrived(io, appointment);
// Nếu appointment.assignedDoctorId = null → Không gửi được
```

### ✅ Đúng: Kiểm tra trước khi gửi
```javascript
if (appointment.assignedDoctorId) {
  socketService.emitPatientArrived(io, appointment);
}
```

## 📊 Data Flow

```
1. User Action (Frontend)
   ↓
2. API Request (POST /api/appointments/:id/check-in)
   ↓
3. Controller (checkInAppointment)
   ↓
4. Socket Service (emitPatientArrived)
   ↓
5. Socket.IO Server
   ↓
6. Doctor's Socket (via activeUsers.get(doctorId))
   ↓
7. Frontend Listener (on('patient:arrived'))
   ↓
8. UI Update (Toast + Notification Dropdown)
```

## 🔐 Security Notes

- Thông báo chỉ gửi cho user có quyền
- Không gửi thông tin nhạy cảm qua socket
- Luôn lưu thông báo vào DB (backup nếu user offline)
- Validate userId trước khi gửi

## 📝 Best Practices

1. **Luôn kiểm tra io tồn tại:**
   ```javascript
   const io = req.app?.get?.('io');
   if (io) {
     // Send notification
   }
   ```

2. **Luôn kiểm tra userId:**
   ```javascript
   const doctorId = appointment.assignedDoctorId || appointment.preferredDoctorId;
   if (doctorId) {
     // Send notification
   }
   ```

3. **Luôn log kết quả:**
   ```javascript
   logger.info(`[Socket] Notification sent to user ${userId}`);
   ```

4. **Luôn handle error:**
   ```javascript
   try {
     socketService.emitPatientArrived(io, appointment);
   } catch (error) {
     logger.error('[Socket] Failed to send notification:', error);
   }
   ```

## 🆘 Troubleshooting

| Vấn Đề | Nguyên Nhân | Giải Pháp |
|--------|-------------|-----------|
| Không nhận thông báo | Socket chưa connect | Kiểm tra `socket.connected` |
| Tất cả doctors nhận | Dùng broadcast | Dùng `activeUsers.get(userId)` |
| Thông báo không lưu DB | Lỗi Notification.create | Kiểm tra model và DB connection |
| Badge không cập nhật | Frontend không lắng nghe | Thêm listener cho `notification:new` |

## 📚 Related Files

- `backend/src/socket/index.js` - Socket service
- `backend/src/controllers/appointment.controller.js` - Appointment controller
- `frontend/src/context/SocketContext.jsx` - Socket context
- `frontend/src/components/NotificationDropdown.jsx` - Notification UI
