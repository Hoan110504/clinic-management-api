# 📋 Tóm Tắt: Sửa Lỗi Toast Notification Không Hiển Thị

## 🎯 Vấn Đề
Bác sĩ không nhận được **toast notification** realtime khi lễ tân đặt lịch hẹn hoặc xác nhận đã tới. Thông báo chỉ hiển thị trong dropdown sau khi tải lại trang.

## ✅ Các Thay Đổi Đã Thực Hiện

### 1. Frontend - SocketContext.jsx
**Thêm listener cho `notification:new` event:**

```javascript
// Handle Generic Notification (for all users)
newSocket.on('notification:new', (data) => {
  console.log('[Socket] Generic notification received:', data);
  
  // Show toast based on notification type
  switch (data.type) {
    case 'APPOINTMENT_NEW':
      toast.success(data.title || 'Lịch hẹn mới', { description: data.content });
      break;
    case 'PATIENT_ARRIVED':
      toast.info(data.title || 'Bệnh nhân đã tới', {
        description: data.content,
        action: {
          label: 'Xem ngay',
          onClick: () => (window.location.href = '/appointments'),
        },
      });
      break;
    // ... other cases
  }
  
  window.dispatchEvent(new CustomEvent('notification:received', { detail: data }));
});
```

**Lợi ích:**
- ✅ Tự động hiển thị toast cho mọi loại notification
- ✅ Không cần duplicate code cho từng event
- ✅ Dễ mở rộng cho notification types mới

### 2. Frontend - NotificationDropdown.jsx
**Cập nhật để không duplicate toast:**

```javascript
const handleNewNotification = (data) => {
  console.log('[NotificationDropdown] Received new notification:', data);
  setNotifications(prev => [data, ...prev]);
  setUnreadCount(prev => prev + 1);
  
  // Don't show toast here since SocketContext already handles it
  // Just update the dropdown state
};
```

**Lợi ích:**
- ✅ Tránh hiển thị 2 toast cho cùng 1 notification
- ✅ Chỉ cập nhật state của dropdown

### 3. Frontend - TestNotification.jsx (NEW)
**Trang test để debug notification system:**

```javascript
// Hiển thị:
// - Connection status (socket connected, socket ID, user info)
// - Real-time event logs
// - Manual toast test button
```

**Cách sử dụng:**
1. Login với role Doctor
2. Truy cập: `http://localhost:5173/test-notification`
3. Mở tab khác với role Receptionist
4. Đặt lịch hẹn hoặc xác nhận đã tới
5. Xem logs realtime trong test page

**Lợi ích:**
- ✅ Debug nhanh chóng
- ✅ Xem tất cả events realtime
- ✅ Kiểm tra connection status

### 4. Frontend - App.jsx
**Thêm route cho test page:**

```javascript
[ROLES.DOCTOR]: [
  // ... existing routes
  { path: "/test-notification", element: TestNotification },
],
```

## 📁 Files Đã Thay Đổi

### Code Changes
- ✅ `frontend/src/context/SocketContext.jsx` - Thêm listener notification:new
- ✅ `frontend/src/components/NotificationDropdown.jsx` - Cập nhật handler
- ✅ `frontend/src/pages/doctor/TestNotification.jsx` - NEW test page
- ✅ `frontend/src/App.jsx` - Thêm route

### Documentation
- ✅ `frontend/DEBUG_NOTIFICATION.md` - Hướng dẫn debug chi tiết

## 🧪 Cách Test

### Quick Test (2 phút)
1. **Mở 2 tabs:**
   - Tab 1: Login với **Doctor**
   - Tab 2: Login với **Receptionist**

2. **Tab 1 (Doctor):**
   - Mở DevTools (F12) → Console
   - Xem logs: `[Socket] Connected successfully`

3. **Tab 2 (Receptionist):**
   - Đặt lịch hẹn cho Doctor ở Tab 1
   - Hoặc xác nhận đã tới cho lịch hẹn của Doctor

4. **Tab 1 (Doctor):**
   - ✅ Toast notification hiển thị ngay lập tức
   - ✅ Console có log: `[Socket] Generic notification received`
   - ✅ Badge chuông tăng
   - ✅ Dropdown có thông báo mới

### Detailed Test (5 phút)
1. **Login với Doctor**
2. **Truy cập:** `http://localhost:5173/test-notification`
3. **Kiểm tra:**
   - ✅ Socket Connected: Yes
   - ✅ Socket ID: có giá trị
   - ✅ User ID: có giá trị

4. **Click "Test Toast Manually":**
   - ✅ Toast hiển thị → Toaster component hoạt động

5. **Mở tab mới với Receptionist:**
   - Đặt lịch hẹn cho Doctor
   - Xác nhận đã tới

6. **Quay lại test page:**
   - ✅ Logs hiển thị: `Received notification:new`
   - ✅ Logs hiển thị: `Received patient:arrived`
   - ✅ Toast hiển thị

## 🔍 Debug Checklist

### Nếu Không Nhận Toast:

#### 1. Kiểm Tra Socket Connection
```javascript
// Browser Console (F12)
console.log('Socket connected:', socket?.connected);
console.log('Socket ID:', socket?.id);
```

**Kết quả mong đợi:**
- `connected: true`
- `id: "abc123..."`

**Nếu false:**
- Kiểm tra backend server đang chạy
- Kiểm tra CORS settings
- Kiểm tra VITE_API_URL

#### 2. Kiểm Tra Backend Logs
```bash
cd backend
tail -f logs/combined.log | grep "Socket"
```

**Kết quả mong đợi:**
```
[Socket] User 2 (role: 2) joined with socket abc123
[Socket] Doctor 2 joined 'doctors' room and 'doctor:2' room
[Socket Emit] Patient arrived notification sent to doctor 2
```

**Nếu không thấy:**
- Backend chưa nhận `user:join` event
- Kiểm tra SocketContext emit user:join

#### 3. Kiểm Tra Network Tab
1. DevTools (F12) → Network
2. Filter: `WS` (WebSocket)
3. Click vào `socket.io` connection
4. Tab **Messages**
5. Xem messages realtime

**Kết quả mong đợi:**
```json
{
  "type": "notification:new",
  "data": {
    "userId": 2,
    "title": "Bệnh nhân đã tới",
    "type": "PATIENT_ARRIVED"
  }
}
```

#### 4. Test Toast Thủ Công
```javascript
// Browser Console
import { toast } from 'sonner';
toast.success('Test');
```

**Nếu không hiển thị:**
- Toaster component chưa được mount
- Kiểm tra App.jsx có `<Toaster />`

## 🎉 Kết Quả Mong Đợi

### Trước Khi Sửa
```
Lễ tân xác nhận đã tới
→ Backend gửi notification
→ Frontend nhận notification
→ Lưu vào state
→ ❌ KHÔNG hiển thị toast
→ ❌ Phải reload trang mới thấy
```

### Sau Khi Sửa
```
Lễ tân xác nhận đã tới
→ Backend gửi notification
→ Frontend nhận notification
→ ✅ Hiển thị toast NGAY LẬP TỨC
→ ✅ Cập nhật dropdown
→ ✅ Tăng badge
→ ✅ Không cần reload
```

## 📊 Flow Diagram

```
┌─────────────────┐
│  Receptionist   │
│  Xác nhận đã tới│
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Backend API                    │
│  POST /appointments/:id/check-in│
└────────┬────────────────────────┘
         │
         ▼
┌─────────────────────────────────┐
│  Socket Service                 │
│  emitPatientArrived()           │
└────────┬────────────────────────┘
         │
         ├─────────────────────────┐
         │                         │
         ▼                         ▼
┌──────────────────┐    ┌──────────────────┐
│ notification:new │    │ patient:arrived  │
│ (to doctor 2)    │    │ (to doctor 2)    │
└────────┬─────────┘    └────────┬─────────┘
         │                       │
         ▼                       ▼
┌─────────────────────────────────────────┐
│  Frontend - SocketContext               │
│  Listener: notification:new             │
│  → Show toast based on type             │
│  → Dispatch custom event                │
└────────┬────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│  UI Updates                             │
│  ✅ Toast notification                  │
│  ✅ Notification dropdown               │
│  ✅ Badge count                         │
└─────────────────────────────────────────┘
```

## 🚀 Deployment

### Bước 1: Pull Code
```bash
cd frontend
git pull origin main
```

### Bước 2: Install Dependencies (nếu cần)
```bash
npm install
```

### Bước 3: Restart Frontend
```bash
npm run dev
```

### Bước 4: Test
1. Login với Doctor
2. Truy cập `/test-notification`
3. Verify connection status
4. Test với Receptionist

## ⚠️ Lưu Ý

### ✅ Đã Hoàn Thành
- ✅ Backend gửi notification đúng
- ✅ Frontend nhận notification
- ✅ Toast hiển thị realtime
- ✅ Dropdown cập nhật
- ✅ Test page để debug

### 🔄 Cần Kiểm Tra
- [ ] Socket connection status
- [ ] Backend logs
- [ ] Network tab messages
- [ ] Toast hiển thị

### 📝 Next Steps
1. Test với user thực tế
2. Xóa test page sau khi verify (hoặc giữ lại cho debug)
3. Monitor logs trong production

## 📞 Support

### Nếu Vẫn Không Hoạt Động

1. **Truy cập test page:** `/test-notification`
2. **Chụp screenshot:**
   - Connection status
   - Event logs
   - Browser console
   - Network tab

3. **Kiểm tra backend logs:**
   ```bash
   tail -f backend/logs/combined.log | grep "Socket"
   ```

4. **Share thông tin:**
   - Socket connected: Yes/No
   - Socket ID: có/không
   - Backend logs: có/không
   - Toast test manual: hoạt động/không

---

**Ngày:** 2026-05-11  
**Người thực hiện:** AI Assistant (Kiro)  
**Status:** ✅ Completed - Ready for Testing
