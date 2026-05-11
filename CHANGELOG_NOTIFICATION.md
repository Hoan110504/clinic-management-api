# Changelog - Realtime Notification Fix

## [2026-05-11] - Sửa Thông Báo Realtime Theo UserID Bác Sĩ

### 🎯 Mục Tiêu
Thay đổi cơ chế gửi thông báo realtime từ **broadcast cho tất cả doctors** sang **gửi cho bác sĩ cụ thể theo UserID**.

### ✨ Thay Đổi

#### Backend (`backend/src/socket/index.js`)

1. **setupSocketIO()**
   - Thêm room `doctor:{userId}` cho mỗi bác sĩ khi join
   - Bác sĩ giờ join 2 rooms: `doctors` (chung) và `doctor:{userId}` (riêng)

2. **createAndEmitNotification()**
   - Cập nhật logic gửi thông báo cho user cụ thể
   - Sử dụng `activeUsers.get(userId)` để lấy socketId
   - Gửi trực tiếp tới socket của user thay vì broadcast

3. **emitAppointmentCreated()**
   - Thêm logic gửi thông báo cho bác sĩ được gán
   - Gửi tới: Receptionists + Admins + **Bác sĩ được gán**
   - Nội dung: "Bạn có lịch hẹn mới với bệnh nhân X"

4. **emitPatientArrived()**
   - Thay đổi từ broadcast `io.to('doctors')` sang gửi cho bác sĩ cụ thể
   - Chỉ gửi tới bác sĩ có `assignedDoctorId` hoặc `preferredDoctorId`
   - Nội dung: "Bệnh nhân X đã có mặt tại phòng khám"

### 📝 Files Thay Đổi

- `backend/src/socket/index.js` - 4 functions updated
- `backend/REALTIME_NOTIFICATION_FIX.md` - Documentation
- `backend/TESTING_GUIDE.md` - Testing guide
- `backend/test-socket-notification.mjs` - Test script
- `backend/CHANGELOG_NOTIFICATION.md` - This file

### 🧪 Testing

Xem chi tiết trong `TESTING_GUIDE.md`

**Quick Test:**
1. Login với 2 bác sĩ khác nhau
2. Đặt lịch hẹn cho bác sĩ A
3. Kiểm tra: Chỉ bác sĩ A nhận thông báo, bác sĩ B không nhận

### 🔄 Migration Notes

- **Không cần migration database**
- **Không cần thay đổi frontend**
- **Chỉ cần restart backend server**

### 📊 Impact

**Before:**
- Tất cả bác sĩ nhận thông báo về mọi lịch hẹn
- Nhiễu thông tin, khó quản lý

**After:**
- Mỗi bác sĩ chỉ nhận thông báo về bệnh nhân của mình
- Giảm nhiễu, tăng hiệu quả
- Bảo mật thông tin bệnh nhân tốt hơn

### ⚠️ Breaking Changes

**KHÔNG CÓ** - Backward compatible

### 🐛 Bug Fixes

- Fix: Tất cả bác sĩ nhận thông báo khi lễ tân đặt lịch hẹn
- Fix: Tất cả bác sĩ nhận thông báo khi lễ tân xác nhận đã tới

### 🔮 Future Improvements

- [ ] Thêm notification preferences (bật/tắt từng loại thông báo)
- [ ] Thêm notification sound
- [ ] Thêm notification history page
- [ ] Thêm notification filter/search
- [ ] Thêm notification priority levels

### 👥 Contributors

- AI Assistant (Kiro)

### 📚 References

- Socket.IO Documentation: https://socket.io/docs/v4/
- Sequelize Documentation: https://sequelize.org/docs/v6/
