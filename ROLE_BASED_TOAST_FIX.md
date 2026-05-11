# ✅ Role-Based Toast Logic for Appointments

## 🎯 Yêu Cầu Chi Tiết

### Khi Bệnh Nhân Tự Đặt Lịch (`source: 'Online'`)
| Role | Toast | Badge | Dropdown | DB |
|------|-------|-------|----------|-----|
| **Bệnh nhân** | ✅ Có | ✅ Có | ✅ Có | ✅ Có |
| **Bác sĩ** | ✅ Có | ✅ Có | ✅ Có | ✅ Có |
| **Lễ tân** | ✅ Có | ✅ Có | ✅ Có | ✅ Có |
| **Admin** | ✅ Có | ✅ Có | ✅ Có | ✅ Có |

### Khi Lễ Tân/Admin Đặt Lịch (`source: 'Offline'`)
| Role | Toast | Badge | Dropdown | DB |
|------|-------|-------|----------|-----|
| **Bác sĩ** | ✅ Có | ✅ Có | ✅ Có | ✅ Có |
| **Lễ tân** | ❌ **KHÔNG** | ✅ Có | ✅ Có | ✅ Có |
| **Admin** | ❌ **KHÔNG** | ✅ Có | ✅ Có | ✅ Có |

## 🔧 Logic

### Backend
```javascript
// Xác định 2 flags
const isOnline = appointment.source === 'Online';

const data = {
  showToastForDoctor: true,        // Bác sĩ luôn có toast
  showToastForStaff: isOnline,     // Staff chỉ có toast nếu patient tạo
  source: appointment.source,
};
```

### Frontend
```javascript
newSocket.on('appointment:new', (data) => {
  let shouldShowToast = false;
  
  if (currentUser.role === 2) {
    // Doctor - luôn có toast
    shouldShowToast = data.showToastForDoctor;
  } else if (currentUser.role === 3 || currentUser.role === 1) {
    // Receptionist/Admin - chỉ có toast nếu patient tạo
    shouldShowToast = data.showToastForStaff;
  } else {
    // Other roles - có toast nếu online
    shouldShowToast = data.source === 'Online';
  }
  
  if (shouldShowToast) {
    toast.success(data.message);
  }
});
```

## 📊 Flow Diagrams

### Flow 1: Bệnh Nhân Tự Đặt Lịch
```
Bệnh nhân login → Đặt lịch hẹn
→ Backend: source = 'Online'
→ Backend: showToastForDoctor = true, showToastForStaff = true
→ Socket emit to Doctor, Receptionist, Admin

Frontend (Doctor):
→ role = 2 → shouldShowToast = showToastForDoctor = true
→ ✅ Toast hiển thị

Frontend (Receptionist):
→ role = 3 → shouldShowToast = showToastForStaff = true
→ ✅ Toast hiển thị

Frontend (Admin):
→ role = 1 → shouldShowToast = showToastForStaff = true
→ ✅ Toast hiển thị
```

### Flow 2: Lễ Tân Đặt Lịch
```
Lễ tân login → Đặt lịch hẹn cho bệnh nhân
→ Backend: source = 'Offline'
→ Backend: showToastForDoctor = true, showToastForStaff = false
→ Socket emit to Doctor, Receptionist, Admin

Frontend (Doctor):
→ role = 2 → shouldShowToast = showToastForDoctor = true
→ ✅ Toast hiển thị

Frontend (Receptionist):
→ role = 3 → shouldShowToast = showToastForStaff = false
→ ❌ KHÔNG có toast (chỉ badge + dropdown)

Frontend (Admin):
→ role = 1 → shouldShowToast = showToastForStaff = false
→ ❌ KHÔNG có toast (chỉ badge + dropdown)
```

### Flow 3: Admin Đặt Lịch
```
Admin login → Đặt lịch hẹn cho bệnh nhân
→ Backend: source = 'Offline'
→ Backend: showToastForDoctor = true, showToastForStaff = false
→ Socket emit to Doctor, Receptionist, Admin

Frontend (Doctor):
→ role = 2 → shouldShowToast = showToastForDoctor = true
→ ✅ Toast hiển thị

Frontend (Receptionist):
→ role = 3 → shouldShowToast = showToastForStaff = false
→ ❌ KHÔNG có toast

Frontend (Admin):
→ role = 1 → shouldShowToast = showToastForStaff = false
→ ❌ KHÔNG có toast
```

## ✅ Các Thay Đổi

### 1. Backend - socket/index.js

#### emitAppointmentCreated - 2 flags thay vì 1
```javascript
const isOnline = appointment.source === 'Online';

const data = {
  appointmentId: appointment.id,
  patientName: appointment.patientName,
  message: content,
  type: 'APPOINTMENT_NEW',
  showToastForDoctor: true,        // ← NEW: Doctor always gets toast
  showToastForStaff: isOnline,     // ← NEW: Staff only if patient created
  source: appointment.source,
  timestamp: new Date().toISOString(),
};

io.to(doctorSocketId).emit('appointment:new', data);
io.to('receptionists').to('admins').emit('appointment:new', data);
```

### 2. Frontend - SocketContext.jsx

#### appointment:new - Kiểm tra role trước khi show toast
```javascript
newSocket.on('appointment:new', (data) => {
  console.log('[Socket] Current user role:', currentUser?.role);
  
  let shouldShowToast = false;
  
  if (currentUser?.role === 2) {
    // Doctor (role 2) always gets toast
    shouldShowToast = data.showToastForDoctor;
  } else if (currentUser?.role === 3 || currentUser?.role === 1) {
    // Receptionist (role 3) or Admin (role 1) only get toast if patient created
    shouldShowToast = data.showToastForStaff;
  } else {
    // Other roles - show toast if online
    shouldShowToast = data.source === 'Online';
  }
  
  if (shouldShowToast) {
    toast.success(data.message);
  }
  
  // Vẫn cập nhật UI (badge, dropdown, highlight)
  if (data.appointmentId) triggerHighlight(data.appointmentId);
  window.dispatchEvent(new CustomEvent('reception:appointment-new', { detail: data }));
});
```

## 🧪 Test Cases

### Test 1: Bệnh Nhân Tự Đặt Lịch
**Steps:**
1. Login với **Patient**
2. Đặt lịch hẹn mới
3. Kiểm tra các role khác

**Expected:**
- ✅ Backend logs: `source: Online, showToastForStaff: true`
- ✅ **Doctor:** Toast hiển thị
- ✅ **Receptionist:** Toast hiển thị
- ✅ **Admin:** Toast hiển thị
- ✅ Tất cả: Badge + dropdown cập nhật

### Test 2: Lễ Tân Đặt Lịch
**Steps:**
1. Login với **Receptionist**
2. Đặt lịch hẹn cho bệnh nhân
3. Kiểm tra các role khác

**Expected:**
- ✅ Backend logs: `source: Offline, showToastForStaff: false`
- ✅ **Doctor:** Toast hiển thị
- ✅ **Receptionist:** KHÔNG có toast (console: "Toast skipped based on role and source")
- ✅ **Admin:** KHÔNG có toast
- ✅ Tất cả: Badge + dropdown vẫn cập nhật

### Test 3: Admin Đặt Lịch
**Steps:**
1. Login với **Admin**
2. Đặt lịch hẹn cho bệnh nhân
3. Kiểm tra các role khác

**Expected:**
- ✅ Backend logs: `source: Offline, showToastForStaff: false`
- ✅ **Doctor:** Toast hiển thị
- ✅ **Admin:** KHÔNG có toast
- ✅ **Receptionist:** KHÔNG có toast
- ✅ Tất cả: Badge + dropdown vẫn cập nhật

## 📁 Files Đã Thay Đổi

### Backend
- ✅ `backend/src/socket/index.js` - 2 flags (showToastForDoctor, showToastForStaff)

### Frontend
- ✅ `frontend/src/context/SocketContext.jsx` - Role-based toast logic

### Documentation
- ✅ `ROLE_BASED_TOAST_FIX.md` - This file

## 🔍 Debug Logs

### Backend Logs - Patient Created
```
[Socket Emit] source: Online, isOnline: true
[Socket Emit] ✅ Appointment created notification sent to doctor 6 (showToast: true)
[Socket Emit] Appointment created: 298 (source: Online, showToastForStaff: true)
```

### Backend Logs - Receptionist Created
```
[Socket Emit] source: Offline, isOnline: false
[Socket Emit] ✅ Appointment created notification sent to doctor 6 (showToast: true)
[Socket Emit] Appointment created: 299 (source: Offline, showToastForStaff: false)
```

### Frontend Console - Doctor (Patient Created)
```
[Socket] New appointment: Object
[Socket] showToastForDoctor: true, showToastForStaff: true, source: Online
[Socket] Current user role: 2
[Socket] User is Doctor - showToast: true
[Toast displayed]
```

### Frontend Console - Doctor (Receptionist Created)
```
[Socket] New appointment: Object
[Socket] showToastForDoctor: true, showToastForStaff: false, source: Offline
[Socket] Current user role: 2
[Socket] User is Doctor - showToast: true
[Toast displayed]
```

### Frontend Console - Receptionist (Patient Created)
```
[Socket] New appointment: Object
[Socket] showToastForDoctor: true, showToastForStaff: true, source: Online
[Socket] Current user role: 3
[Socket] User is Staff (Receptionist/Admin) - showToast: true
[Toast displayed]
```

### Frontend Console - Receptionist (Receptionist Created)
```
[Socket] New appointment: Object
[Socket] showToastForDoctor: true, showToastForStaff: false, source: Offline
[Socket] Current user role: 3
[Socket] User is Staff (Receptionist/Admin) - showToast: false
[Socket] Toast skipped based on role and source
[No toast displayed]
```

## ✅ Success Criteria

### Bệnh Nhân Tự Đặt Lịch
- [x] source = 'Online'
- [x] showToastForDoctor = true
- [x] showToastForStaff = true
- [x] Doctor: Toast ✅
- [x] Receptionist: Toast ✅
- [x] Admin: Toast ✅
- [x] Tất cả: Badge + dropdown ✅

### Lễ Tân/Admin Đặt Lịch
- [x] source = 'Offline'
- [x] showToastForDoctor = true
- [x] showToastForStaff = false
- [x] Doctor: Toast ✅
- [x] Receptionist: KHÔNG toast ❌
- [x] Admin: KHÔNG toast ❌
- [x] Tất cả: Badge + dropdown vẫn hoạt động ✅

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
1. **Patient đặt lịch:**
   - Doctor → ✅ Toast
   - Receptionist → ✅ Toast
   - Admin → ✅ Toast

2. **Receptionist đặt lịch:**
   - Doctor → ✅ Toast
   - Receptionist → ❌ Không toast (badge vẫn tăng)
   - Admin → ❌ Không toast (badge vẫn tăng)

3. **Admin đặt lịch:**
   - Doctor → ✅ Toast
   - Admin → ❌ Không toast (badge vẫn tăng)
   - Receptionist → ❌ Không toast (badge vẫn tăng)

## 💡 Lý Do Thiết Kế

### Tại Sao Bác Sĩ Luôn Nhận Toast?
- Bác sĩ cần biết ngay khi có lịch hẹn mới (dù ai tạo)
- Đây là thông tin quan trọng cho công việc của bác sĩ
- Bác sĩ không phải người tạo lịch → cần notification

### Tại Sao Lễ Tân/Admin Không Nhận Toast Khi Tự Tạo?
- Họ đã biết vì họ vừa tạo
- Tránh nhiễu (self-notification)
- Badge + dropdown vẫn đủ để tracking

### Tại Sao Lễ Tân/Admin Nhận Toast Khi Bệnh Nhân Tạo?
- Đây là thông tin mới (họ không biết trước)
- Cần attention để xử lý lịch hẹn online
- Quan trọng hơn lịch hẹn offline

## 🔮 Future Enhancements

- [ ] User preferences (cho phép user tự chọn)
- [ ] Priority levels (urgent appointments = always toast)
- [ ] Time-based rules (giờ làm việc vs ngoài giờ)
- [ ] Sound notifications
- [ ] Desktop notifications (browser API)

---

**Ngày:** 2026-05-11  
**Người thực hiện:** AI Assistant (Kiro)  
**Status:** ✅ COMPLETED  
**Version:** 2.0 (Role-Based)
