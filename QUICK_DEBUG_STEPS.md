# 🚀 Quick Debug Steps - Notification Issue

## Vấn Đề
Bác sĩ connect socket thành công nhưng **KHÔNG nhận được notification events**.

## ⚡ Quick Fix Steps

### Bước 1: Restart Backend (QUAN TRỌNG!)
```bash
cd backend
# Ctrl+C để dừng server hiện tại
npm run dev
```

**Lý do:** Code mới có thêm logs chi tiết để debug

### Bước 2: Login Bác Sĩ & Check Logs

**Terminal (Backend logs):**
```bash
tail -f logs/combined.log | grep "Socket"
```

**Browser (Bác sĩ):**
1. Login với role Doctor
2. Mở DevTools (F12) → Console

**Kết quả mong đợi trong backend logs:**
```
[Socket] User connected: 5oRY6385jWHmogh8AAAK
[Socket] User 2 (role: 2) joined with socket 5oRY6385jWHmogh8AAAK
[Socket] Doctor 2 joined 'doctors' room and 'doctor:2' room
```

**Nếu KHÔNG thấy logs trên:**
- ❌ Frontend không emit `user:join`
- ❌ `currentUser.id` hoặc `currentUser.role` không có giá trị

**Fix:**
```javascript
// Browser Console (Bác sĩ)
console.log('User:', currentUser);
console.log('Socket:', socket);

// Nếu currentUser undefined → Logout và login lại
// Nếu socket undefined → Reload trang
```

### Bước 3: Đặt Lịch Hẹn & Check Logs

**Browser (Lễ tân):**
1. Mở tab mới, login với Receptionist
2. Đặt lịch hẹn cho bác sĩ ở Bước 2
3. Chọn đúng bác sĩ trong dropdown

**Kết quả mong đợi trong backend logs:**
```
[Socket Emit] emitAppointmentCreated called for appointment 297
[Socket Emit] assignedDoctorId: 2, preferredDoctorId: null
[Socket Emit] Resolved doctorId: 2
[Socket Emit] Attempting to notify doctor 2
[Socket Emit] Active users: [["3","NqKggZ71..."],["2","5oRY6385..."]]
[Socket Emit] Doctor 2 socketId: 5oRY6385jWHmogh8AAAK
[Socket Emit] ✅ Appointment created notification sent to doctor 2 via socket 5oRY6385jWHmogh8AAAK
```

**Kết quả mong đợi trong browser console (Bác sĩ):**
```
[Socket] Generic notification received: Object
[Socket] New appointment: Object
```

**Kết quả mong đợi trên UI (Bác sĩ):**
- ✅ Toast notification hiển thị
- ✅ Badge chuông tăng
- ✅ Dropdown có thông báo mới

## 🔍 Troubleshooting

### Scenario 1: Backend logs KHÔNG có "User joined"

**Vấn đề:** Frontend không emit `user:join`

**Debug:**
```javascript
// Browser Console (Bác sĩ)
console.log('currentUser:', currentUser);
console.log('socket:', socket);
console.log('socket.connected:', socket?.connected);

// Manual emit
socket.emit('user:join', {
  userId: currentUser.id,
  role: currentUser.role
});
```

**Check backend logs lại** → Phải thấy "User joined"

### Scenario 2: Backend logs có "User joined" nhưng KHÔNG có "Resolved doctorId"

**Vấn đề:** Appointment không có `assignedDoctorId`

**Debug:**
```sql
-- Chạy trong SQL Server
SELECT TOP 1 
  AppointmentID,
  PatientName,
  AssignedDoctorID,
  PreferredDoctorID,
  AssignedDoctorName
FROM Appointments
ORDER BY CreatedAt DESC;
```

**Nếu `AssignedDoctorID` = NULL:**
- Lễ tân chưa chọn bác sĩ khi đặt lịch
- Đặt lại lịch hẹn và **nhớ chọn bác sĩ**

### Scenario 3: Backend logs có "Resolved doctorId: 2" nhưng "Doctor 2 socketId: undefined"

**Vấn đề:** `activeUsers` không có entry cho bác sĩ

**Debug:**
```javascript
// Backend logs
[Socket Emit] Active users: [["3","NqKggZ71..."]]
// Chỉ có lễ tân (userId: 3), không có bác sĩ (userId: 2)
```

**Fix:**
1. Bác sĩ logout
2. Bác sĩ login lại
3. Check backend logs → Phải thấy "User 2 joined"
4. Đặt lịch hẹn lại

### Scenario 4: Backend logs có "✅ Appointment created notification sent" nhưng frontend KHÔNG nhận

**Vấn đề:** Frontend listener chưa được setup

**Debug:**
```javascript
// Browser Console (Bác sĩ)
// Check listeners
console.log('Socket listeners:', socket._callbacks);

// Manual listen
socket.on('test-event', (data) => {
  console.log('Test event received:', data);
});
```

**Fix:**
1. Reload trang bác sĩ
2. Check console → Phải thấy "[Socket] Connected successfully"
3. Đặt lịch hẹn lại

## ✅ Success Criteria

### Backend Logs
```
✅ [Socket] User 2 (role: 2) joined with socket 5oRY6385...
✅ [Socket] Doctor 2 joined 'doctors' room and 'doctor:2' room
✅ [Socket Emit] Resolved doctorId: 2
✅ [Socket Emit] Doctor 2 socketId: 5oRY6385...
✅ [Socket Emit] ✅ Appointment created notification sent to doctor 2
```

### Frontend Console (Bác sĩ)
```
✅ [Socket] Connected successfully, id: 5oRY6385...
✅ [Socket] Generic notification received: Object
✅ [Socket] New appointment: Object
```

### UI (Bác sĩ)
```
✅ Toast notification hiển thị
✅ Badge chuông có số
✅ Dropdown có thông báo mới
```

## 📝 Checklist

- [ ] Backend server đã restart
- [ ] Bác sĩ login thành công
- [ ] Backend logs có "User joined"
- [ ] Backend logs có "Doctor X joined 'doctor:X' room"
- [ ] Lễ tân đặt lịch hẹn và **chọn đúng bác sĩ**
- [ ] Backend logs có "Resolved doctorId: X"
- [ ] Backend logs có "Doctor X socketId: abc..."
- [ ] Backend logs có "✅ Appointment created notification sent"
- [ ] Frontend console có "Generic notification received"
- [ ] Toast hiển thị trên UI

## 🆘 Nếu Vẫn Không Hoạt Động

**Share thông tin sau:**

1. **Backend logs** (copy toàn bộ từ khi bác sĩ login đến khi đặt lịch hẹn)
2. **Frontend console** (bác sĩ) - screenshot hoặc copy text
3. **Database query:**
   ```sql
   SELECT TOP 1 * FROM Appointments ORDER BY CreatedAt DESC;
   ```
4. **User info:**
   ```javascript
   // Browser Console (Bác sĩ)
   console.log(JSON.stringify({
     userId: currentUser?.id,
     role: currentUser?.role,
     socketId: socket?.id,
     connected: socket?.connected
   }));
   ```

---

**Thời gian ước tính:** 5-10 phút  
**Độ khó:** Dễ  
**Yêu cầu:** Backend restart + Login lại
