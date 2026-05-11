# ✅ Conditional Toast Based on Appointment Source

## 🎯 Yêu Cầu

### Trước
- Tất cả appointment đều hiển thị toast khi tạo

### Sau
- **Bệnh nhân tự đặt lịch** (`source: 'Online'`) → ✅ Hiển thị toast
- **Lễ tân/Admin đặt lịch** (`source: 'Offline'`) → ❌ KHÔNG hiển thị toast
- **Tất cả trường hợp** → ✅ Vẫn lưu DB + cập nhật badge 🔔

## 🔧 Cách Hoạt Động

### Backend Logic
```javascript
// Trong createAppointment controller
if (req.user.role === ROLES.PATIENT) {
  createData.source = 'Online';  // Bệnh nhân tự đặt
} else {
  createData.source = 'Offline'; // Lễ tân/Admin đặt
}

// Trong emitAppointmentCreated
const showToast = appointment.source === 'Online';
// Truyền showToast flag vào socket event
```

### Frontend Logic
```javascript
newSocket.on('appointment:new', (data) => {
  // Chỉ show toast nếu showToast = true
  if (data.showToast) {
    toast.success(data.message);
  }
  
  // Vẫn cập nhật UI (highlight, badge, dropdown)
  triggerHighlight(data.appointmentId);
  window.dispatchEvent(new CustomEvent('reception:appointment-new'));
});
```

## 📊 Flow Diagram

### Flow 1: Bệnh Nhân Tự Đặt Lịch
```
Bệnh nhân login → Đặt lịch hẹn
→ Backend: req.user.role = PATIENT
→ Backend: source = 'Online'
→ Backend: showToast = true
→ Socket: emit('appointment:new', { showToast: true })
→ Frontend (Doctor): Receive event
→ Frontend: if (showToast) → ✅ Show toast
→ Frontend: Update badge + dropdown
```

### Flow 2: Lễ Tân Đặt Lịch
```
Lễ tân login → Đặt lịch hẹn cho bệnh nhân
→ Backend: req.user.role = RECEPTIONIST
→ Backend: source = 'Offline'
→ Backend: showToast = false
→ Socket: emit('appointment:new', { showToast: false })
→ Frontend (Doctor): Receive event
→ Frontend: if (showToast) → ❌ Skip toast
→ Frontend: Update badge + dropdown (vẫn hoạt động)
```

## ✅ Các Thay Đổi

### 1. Backend - appointment.controller.js

#### Truyền creatorRole vào emitAppointmentCreated
```javascript
socketService.emitAppointmentCreated(io, appointmentPlain, req.user?.role);
logger.info(`[Appointment] New appointment created and broadcasted: ${appointment.id}, source: ${appointmentPlain.source}`);
```

### 2. Backend - socket/index.js

#### emitAppointmentCreated - Thêm showToast flag
```javascript
export async function emitAppointmentCreated(io, appointment, creatorRole = null) {
  // Determine if toast should be shown based on source
  const showToast = appointment.source === 'Online';
  
  logger.info(`[Socket Emit] source: ${appointment.source}, showToast: ${showToast}`);
  
  // Add showToast and source to socket data
  const data = {
    appointmentId: appointment.id,
    patientName: appointment.patientName,
    message: content,
    appointment,
    type: 'APPOINTMENT_NEW',
    showToast,        // ← NEW
    source: appointment.source, // ← NEW
    timestamp: new Date().toISOString(),
  };
  
  io.to(doctorSocketId).emit('appointment:new', data);
  logger.info(`✅ Notification sent (showToast: ${showToast})`);
}
```

### 3. Frontend - SocketContext.jsx

#### appointment:new - Kiểm tra showToast trước khi hiển thị
```javascript
newSocket.on('appointment:new', (data) => {
  console.log('[Socket] New appointment:', data);
  console.log('[Socket] showToast:', data.showToast, 'source:', data.source);
  
  // Only show toast if showToast flag is true
  if (data.showToast) {
    toast.success(data.message, {
      description: `Bệnh nhân: ${data.patientName || 'N/A'}`,
      action: {
        label: 'Xem ngay',
        onClick: () => (window.location.href = '/appointments'),
      },
    });
  } else {
    console.log('[Socket] Toast skipped - appointment created by staff (Offline)');
  }
  
  // Vẫn cập nhật UI
  if (data.appointmentId) triggerHighlight(data.appointmentId);
  window.dispatchEvent(new CustomEvent('reception:appointment-new', { detail: data }));
});
```

## 🧪 Test Cases

### Test 1: Bệnh Nhân Tự Đặt Lịch
**Steps:**
1. Login với role **Patient**
2. Đặt lịch hẹn mới
3. Login với role **Doctor** (tab khác)

**Expected:**
- ✅ Backend logs: `source: Online, showToast: true`
- ✅ Frontend (Doctor) console: `showToast: true, source: Online`
- ✅ Frontend (Doctor): **Toast hiển thị**
- ✅ Frontend (Doctor): Badge tăng
- ✅ Frontend (Doctor): Dropdown cập nhật

### Test 2: Lễ Tân Đặt Lịch
**Steps:**
1. Login với role **Receptionist**
2. Đặt lịch hẹn cho bệnh nhân
3. Login với role **Doctor** (tab khác)

**Expected:**
- ✅ Backend logs: `source: Offline, showToast: false`
- ✅ Frontend (Doctor) console: `showToast: false, source: Offline`
- ✅ Frontend (Doctor) console: `Toast skipped - appointment created by staff`
- ✅ Frontend (Doctor): **KHÔNG có toast**
- ✅ Frontend (Doctor): Badge vẫn tăng
- ✅ Frontend (Doctor): Dropdown vẫn cập nhật

### Test 3: Admin Đặt Lịch
**Steps:**
1. Login với role **Admin**
2. Đặt lịch hẹn cho bệnh nhân
3. Login với role **Doctor** (tab khác)

**Expected:**
- ✅ Backend logs: `source: Offline, showToast: false`
- ✅ Frontend (Doctor): **KHÔNG có toast**
- ✅ Frontend (Doctor): Badge vẫn tăng
- ✅ Frontend (Doctor): Dropdown vẫn cập nhật

## 📁 Files Đã Thay Đổi

### Backend
- ✅ `backend/src/controllers/appointment.controller.js` - Truyền creatorRole
- ✅ `backend/src/socket/index.js` - Thêm showToast logic

### Frontend
- ✅ `frontend/src/context/SocketContext.jsx` - Kiểm tra showToast

### Documentation
- ✅ `CONDITIONAL_TOAST_FIX.md` - This file

## 🔍 Debug Logs

### Backend Logs - Patient Created
```
[Appointment] New appointment created and broadcasted: 298, source: Online
[Socket Emit] source: Online, showToast: true
[Socket Emit] ✅ Appointment created notification sent to doctor 6 (showToast: true)
```

### Backend Logs - Receptionist Created
```
[Appointment] New appointment created and broadcasted: 299, source: Offline
[Socket Emit] source: Offline, showToast: false
[Socket Emit] ✅ Appointment created notification sent to doctor 6 (showToast: false)
```

### Frontend Console - Patient Created
```
[Socket] New appointment: Object
[Socket] showToast: true, source: Online
[Toast displayed]
```

### Frontend Console - Receptionist Created
```
[Socket] New appointment: Object
[Socket] showToast: false, source: Offline
[Socket] Toast skipped - appointment created by staff (Offline)
[No toast displayed]
```

## ✅ Success Criteria

### Bệnh Nhân Tự Đặt Lịch
- [x] source = 'Online'
- [x] showToast = true
- [x] Toast hiển thị
- [x] Badge cập nhật
- [x] Dropdown cập nhật
- [x] DB lưu notification

### Lễ Tân/Admin Đặt Lịch
- [x] source = 'Offline'
- [x] showToast = false
- [x] KHÔNG có toast
- [x] Badge vẫn cập nhật
- [x] Dropdown vẫn cập nhật
- [x] DB vẫn lưu notification

## 🚀 Deployment

### Bước 1: Restart Backend
```bash
cd backend
# Ctrl+C
npm run dev
```

### Bước 2: Restart Frontend (nếu cần)
```bash
cd frontend
# Ctrl+C
npm run dev
```

### Bước 3: Clear Cache
```
Ctrl+Shift+Delete
```

### Bước 4: Test
1. Test với Patient đặt lịch → Có toast
2. Test với Receptionist đặt lịch → Không có toast
3. Verify badge và dropdown vẫn cập nhật trong cả 2 trường hợp

## 💡 Lợi Ích

### UX Improvements
- ✅ Giảm nhiễu cho bác sĩ (không toast khi lễ tân đặt lịch)
- ✅ Vẫn thông báo quan trọng (badge + dropdown)
- ✅ Chỉ toast khi bệnh nhân tự đặt (cần attention hơn)

### Technical Benefits
- ✅ Flexible control qua `showToast` flag
- ✅ Dễ mở rộng cho các điều kiện khác
- ✅ Backward compatible (vẫn lưu DB như cũ)

## 🔮 Future Enhancements

Có thể mở rộng logic này cho:
- [ ] Notification preferences (user tự chọn loại notification nào show toast)
- [ ] Priority levels (urgent = toast, normal = badge only)
- [ ] Time-based rules (giờ làm việc = toast, ngoài giờ = badge only)
- [ ] Role-based preferences (doctor có thể tắt toast cho Offline appointments)

---

**Ngày:** 2026-05-11  
**Người thực hiện:** AI Assistant (Kiro)  
**Status:** ✅ COMPLETED  
**Version:** 1.0
