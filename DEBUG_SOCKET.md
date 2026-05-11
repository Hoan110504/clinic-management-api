# 🐛 Debug Socket Connection Issue

## Vấn Đề Hiện Tại

**Lễ tân:** Nhận được notification và toast ✅  
**Bác sĩ:** Chỉ connect socket, KHÔNG nhận event ❌

## Logs Hiện Tại

### Lễ Tân (Working)
```
[Socket] Initializing connection to: http://localhost:5004
[Socket] User context: Object
[Socket] Connected successfully, id: NqKggZ71_ANucNsfAAAI
[Socket] Generic notification received: Object
[NotificationDropdown] Received new notification: Object
[Socket] New appointment: Object
[Socket] Highlighting item: 297
```

### Bác Sĩ (Not Working)
```
[Socket] Initializing connection to: http://localhost:5004
[Socket] User context: Object
[Socket] Connected successfully, id: 5oRY6385jWHmogh8AAAK
```

**Vấn đề:** Bác sĩ không nhận được `notification:new` hoặc `appointment:new`

## Các Nguyên Nhân Có Thể

### 1. Backend không gửi tới bác sĩ
- `doctorId` không có giá trị
- `activeUsers.get(doctorId)` không tìm thấy
- Backend logs không hiển thị

### 2. Frontend không lắng nghe đúng
- Listener chưa được setup
- Event name không khớp

### 3. Socket connection issue
- Bác sĩ chưa join room
- Socket ID không được lưu vào activeUsers

## Cách Debug

### Bước 1: Kiểm Tra Backend Logs

```bash
cd backend
tail -f logs/combined.log | grep "Socket"
```

**Kết quả mong đợi khi bác sĩ login:**
```
[Socket] User connected: 5oRY6385jWHmogh8AAAK
[Socket] User 2 (role: 2) joined with socket 5oRY6385jWHmogh8AAAK
[Socket] Doctor 2 joined 'doctors' room and 'doctor:2' room
```

**Kết quả mong đợi khi đặt lịch hẹn:**
```
[Socket Emit] emitAppointmentCreated called for appointment 297
[Socket Emit] assignedDoctorId: 2, preferredDoctorId: null
[Socket Emit] Resolved doctorId: 2
[Socket Emit] Attempting to notify doctor 2
[Socket Emit] Active users: [["3","NqKggZ71_ANucNsfAAAI"],["2","5oRY6385jWHmogh8AAAK"]]
[Socket Emit] Doctor 2 socketId: 5oRY6385jWHmogh8AAAK
[Socket Emit] ✅ Appointment created notification sent to doctor 2 via socket 5oRY6385jWHmogh8AAAK
```

### Bước 2: Kiểm Tra Frontend Console

**Bác sĩ - Mở DevTools (F12):**

```javascript
// Kiểm tra socket
console.log('Socket:', socket);
console.log('Connected:', socket?.connected);
console.log('ID:', socket?.id);

// Kiểm tra user
console.log('User:', currentUser);
console.log('User ID:', currentUser?.id);
console.log('User Role:', currentUser?.role);
```

**Kết quả mong đợi:**
```javascript
Socket: Socket {connected: true, ...}
Connected: true
ID: "5oRY6385jWHmogh8AAAK"
User: {id: 2, role: 2, fullName: "BS. Nguyễn Văn A"}
User ID: 2
User Role: 2
```

### Bước 3: Test Emit User:Join Manually

**Bác sĩ - Browser Console:**

```javascript
// Emit user:join manually
socket.emit('user:join', {
  userId: currentUser.id,
  role: currentUser.role
});

// Check backend logs
// Should see: [Socket] User 2 (role: 2) joined with socket ...
```

### Bước 4: Kiểm Tra activeUsers Map

**Backend - Thêm endpoint debug (temporary):**

```javascript
// backend/src/routes/debug.routes.js
import express from 'express';
import { activeUsers } from '../socket/index.js';

const router = express.Router();

router.get('/active-users', (req, res) => {
  const users = Array.from(activeUsers.entries());
  res.json({ activeUsers: users });
});

export default router;
```

**Test:**
```bash
curl http://localhost:5000/api/debug/active-users
```

**Kết quả mong đợi:**
```json
{
  "activeUsers": [
    ["3", "NqKggZ71_ANucNsfAAAI"],
    ["2", "5oRY6385jWHmogh8AAAK"]
  ]
}
```

## Các Trường Hợp

### Case 1: Backend logs không có "User joined"

**Vấn đề:** Frontend không emit `user:join`

**Giải pháp:**
```javascript
// frontend/src/context/SocketContext.jsx
newSocket.on('connect', () => {
  console.log('[Socket] Connected successfully, id:', newSocket.id);
  console.log('[Socket] Emitting user:join with:', {
    userId: currentUser.id,
    role: currentUser.role,
  });
  newSocket.emit('user:join', {
    userId: currentUser.id,
    role: currentUser.role,
  });
});
```

### Case 2: Backend logs có "User joined" nhưng không có "Appointment created notification sent"

**Vấn đề:** `doctorId` không khớp hoặc không có giá trị

**Giải pháp:**
```javascript
// Kiểm tra appointment object
console.log('Appointment:', appointment);
console.log('assignedDoctorId:', appointment.assignedDoctorId);
console.log('preferredDoctorId:', appointment.preferredDoctorId);
```

### Case 3: Backend logs có "Appointment created notification sent" nhưng frontend không nhận

**Vấn đề:** Frontend listener chưa được setup hoặc event name không khớp

**Giải pháp:**
```javascript
// frontend/src/context/SocketContext.jsx
// Thêm log trong listener
newSocket.on('notification:new', (data) => {
  console.log('[Socket] ✅ notification:new received:', data);
  // ...
});

newSocket.on('appointment:new', (data) => {
  console.log('[Socket] ✅ appointment:new received:', data);
  // ...
});
```

### Case 4: activeUsers không có entry cho bác sĩ

**Vấn đề:** `activeUsers.set()` không được gọi hoặc userId không đúng

**Giải pháp:**
```javascript
// backend/src/socket/index.js
socket.on('user:join', (data) => {
  const { userId, role } = data;
  console.log('[Socket] user:join received:', { userId, role, socketId: socket.id });
  
  // Ensure userId is a number
  const userIdNum = Number(userId);
  activeUsers.set(userIdNum, socket.id);
  
  console.log('[Socket] activeUsers after set:', Array.from(activeUsers.entries()));
  // ...
});
```

## Quick Fix Checklist

### Frontend
- [ ] SocketContext emit `user:join` on connect
- [ ] `currentUser.id` có giá trị
- [ ] `currentUser.role` = 2 (DOCTOR)
- [ ] Listener cho `notification:new` được setup
- [ ] Listener cho `appointment:new` được setup

### Backend
- [ ] Socket server đang chạy
- [ ] `user:join` handler được gọi
- [ ] `activeUsers.set()` được gọi
- [ ] `emitAppointmentCreated()` được gọi
- [ ] `doctorId` có giá trị
- [ ] `activeUsers.get(doctorId)` trả về socketId
- [ ] `io.to(socketId).emit()` được gọi

### Database
- [ ] Appointment có `assignedDoctorId` hoặc `preferredDoctorId`
- [ ] `assignedDoctorId` khớp với `currentUser.id` của bác sĩ

## Test Commands

### Test 1: Check Socket Connection
```javascript
// Browser Console (Doctor)
console.log('Socket connected:', socket?.connected);
console.log('Socket ID:', socket?.id);
console.log('User ID:', currentUser?.id);
```

### Test 2: Manual Emit
```javascript
// Browser Console (Doctor)
socket.emit('user:join', {
  userId: currentUser.id,
  role: currentUser.role
});
```

### Test 3: Manual Listen
```javascript
// Browser Console (Doctor)
socket.on('test', (data) => {
  console.log('Test event received:', data);
});

// Backend - emit test event
io.to(doctorSocketId).emit('test', { message: 'Hello Doctor' });
```

### Test 4: Check activeUsers
```bash
# Backend logs
tail -f logs/combined.log | grep "activeUsers"
```

## Expected Flow

```
1. Doctor Login
   → Frontend: SocketContext mount
   → Frontend: Socket connect
   → Frontend: Emit user:join
   → Backend: Receive user:join
   → Backend: activeUsers.set(2, "5oRY...")
   → Backend: socket.join('doctors')
   → Backend: socket.join('doctor:2')

2. Receptionist Create Appointment
   → Frontend: POST /api/appointments
   → Backend: Create appointment (assignedDoctorId: 2)
   → Backend: emitAppointmentCreated()
   → Backend: Get doctorId = 2
   → Backend: Get socketId = activeUsers.get(2)
   → Backend: io.to(socketId).emit('notification:new')
   → Backend: io.to(socketId).emit('appointment:new')
   → Frontend (Doctor): Receive events
   → Frontend (Doctor): Show toast
```

## Next Steps

1. **Restart backend server** để apply logs mới
2. **Login với bác sĩ** và check backend logs
3. **Đặt lịch hẹn** và check backend logs
4. **Share backend logs** để debug tiếp

---

**Updated:** 2026-05-11  
**Status:** Debugging in progress
