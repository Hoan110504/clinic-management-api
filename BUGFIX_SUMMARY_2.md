# Tóm tắt sửa lỗi - Phiên 2

## ✅ Yêu cầu 1: UserProfile tự động submit khi click "Chỉnh sửa hồ sơ"

### Vấn đề:
Khi click "Chỉnh sửa hồ sơ", UI nháy sang form có "Lưu thay đổi" và "Hủy" sau đó tự động submit và báo "Cập nhật hồ sơ thành công".

### Nguyên nhân:
`useEffect` trong `UserProfile.jsx` chạy lại mỗi khi `currentUser` thay đổi, bao gồm cả khi `updateUser()` được gọi sau khi submit thành công. Điều này gây ra việc form bị reset và có thể trigger submit không mong muốn.

### Giải pháp:
Thêm dependency `isEditing` vào `useEffect` để chỉ update formData khi KHÔNG ở chế độ editing:

```javascript
useEffect(() => {
  if (currentUser && !isEditing) {
    setFormData({
      fullName: currentUser.fullName || '',
      email: currentUser.email || '',
      phone: currentUser.phone || '',
      address: currentUser.address || '',
      dateOfBirth: currentUser.dateOfBirth || '',
      gender: currentUser.gender || '',
    });
  }
}, [currentUser, isEditing]);
```

### Kết quả:
✅ Khi click "Chỉnh sửa hồ sơ", form chuyển sang edit mode bình thường
✅ Không tự động submit
✅ User có thể chỉnh sửa và click "Lưu thay đổi" hoặc "Hủy"

### Files đã thay đổi:
- `frontend/src/pages/shared/UserProfile.jsx`

---

## ✅ Yêu cầu 2: ChangePassword không chuyển về trang Login

### Vấn đề:
Khi click "Đổi mật khẩu" thành công, hệ thống không chuyển về trang Login mà vẫn ở trong page của Role đó.

### Nguyên nhân:
Sau khi đổi mật khẩu thành công, code chỉ gọi `authHelpers.clearAuth()` để xóa token trong localStorage, nhưng KHÔNG gọi `logout()` từ `AuthContext`. 

Điều này dẫn đến:
1. Token bị xóa khỏi localStorage
2. Nhưng `currentUser` trong AuthContext vẫn còn
3. Khi `navigate('/login')`, `AppContent` kiểm tra `isAuthenticated` (dựa vào `currentUser`)
4. Vì `currentUser` vẫn còn, nên `isAuthenticated = true`
5. App redirect lại về dashboard thay vì hiển thị trang login

### Giải pháp:
Gọi `logout()` từ `AuthContext` để xóa cả token VÀ `currentUser`:

```javascript
// Thêm logout vào destructuring
const { currentUser, logout } = useAuth();

// Trong handleSubmit, sau khi đổi mật khẩu thành công:
if (response?.success || response?.data) {
  toast.success('Đổi mật khẩu thành công! Đang chuyển đến trang đăng nhập...');
  
  // Clear auth data and logout from context
  try {
    await logout();
  } catch (e) {
    console.error('Logout error:', e);
    // Fallback: clear manually if logout fails
    authHelpers.clearAuth();
    localStorage.removeItem('clinic_current_user');
  }

  // Redirect to login after delay
  setTimeout(() => {
    navigate('/login', { replace: true });
  }, 1500);
}
```

### Kết quả:
✅ Sau khi đổi mật khẩu thành công, hệ thống xóa token và currentUser
✅ Chuyển về trang Login sau 1.5 giây
✅ User phải đăng nhập lại với mật khẩu mới

### Files đã thay đổi:
- `frontend/src/pages/shared/ChangePassword.jsx`

---

## ✅ Yêu cầu 3: Role bệnh nhân chưa hiển thị "Hồ sơ" và "Đổi mật khẩu"

### Vấn đề:
Ở Role bệnh nhân, sidebar không hiển thị menu "Hồ sơ" và "Đổi mật khẩu".

### Nguyên nhân:
1. Trong `MENU_CONFIG[ROLES.PATIENT]`, menu "Hồ sơ" có label là "Hồ sơ cá nhân" (dài)
2. Không có menu item "Đổi mật khẩu"
3. Icon `Lock` chưa được import và map trong `PatientLayout.jsx`

### Giải pháp:

#### 1. Cập nhật MENU_CONFIG trong `permissions.js`:
```javascript
[ROLES.PATIENT]: [
  { id: 'dashboard', path: '/patient/dashboard', label: 'Tổng quan', iconName: 'LayoutDashboard' },
  { id: 'appointments', path: '/patient/appointments', label: 'Lịch hẹn', iconName: 'Calendar' },
  { id: 'profile', path: '/patient/profile', label: 'Hồ sơ', iconName: 'User' },
  { id: 'change-password', path: '/patient/change-password', label: 'Đổi mật khẩu', iconName: 'Lock' },
  { id: 'lab-results', path: '/patient/lab-results', label: 'Kết quả xét nghiệm', iconName: 'FlaskConical' },
  { id: 'prescriptions', path: '/patient/prescriptions', label: 'Đơn thuốc', iconName: 'Pill' },
  { id: 'payments', path: '/patient/payments', label: 'Lịch sử thanh toán', iconName: 'CreditCard' },
]
```

#### 2. Thêm icon `Lock` vào `PatientLayout.jsx`:
```javascript
// Import Lock icon
import { 
  LayoutDashboard, Calendar,
  FlaskConical, Pill, CreditCard, 
  User, LogOut, Menu, X, Phone, Bell, Clock, Bot, Sparkles, Lock
} from 'lucide-react';

// Thêm vào iconMap
const iconMap = {
  LayoutDashboard: <LayoutDashboard className="w-5 h-5" />,
  Calendar: <Calendar className="w-5 h-5" />,
  FlaskConical: <FlaskConical className="w-5 h-5" />,
  Pill: <Pill className="w-5 h-5" />,
  CreditCard: <CreditCard className="w-5 h-5" />,
  User: <User className="w-5 h-5" />,
  Lock: <Lock className="w-5 h-5" />,
};
```

### Kết quả:
✅ Sidebar của bệnh nhân hiển thị menu "Hồ sơ" (label ngắn gọn hơn)
✅ Sidebar hiển thị menu "Đổi mật khẩu" với icon khóa
✅ Click vào "Hồ sơ" → chuyển đến `/patient/profile`
✅ Click vào "Đổi mật khẩu" → chuyển đến `/patient/change-password`

### Files đã thay đổi:
- `frontend/src/config/permissions.js`
- `frontend/src/components/PatientLayout.jsx`

---

## Tổng kết

### Files đã sửa:
1. `frontend/src/pages/shared/UserProfile.jsx` - Fix auto-submit issue
2. `frontend/src/pages/shared/ChangePassword.jsx` - Fix login redirect issue
3. `frontend/src/config/permissions.js` - Add patient menu items
4. `frontend/src/components/PatientLayout.jsx` - Add Lock icon

### Kết quả:
✅ **Yêu cầu 1**: UserProfile không còn tự động submit
✅ **Yêu cầu 2**: ChangePassword chuyển về Login thành công
✅ **Yêu cầu 3**: Patient role hiển thị đầy đủ menu "Hồ sơ" và "Đổi mật khẩu"

### Hướng dẫn test:

#### Test Yêu cầu 1 (UserProfile):
1. Đăng nhập với bất kỳ role nào (trừ Patient)
2. Vào menu "Hồ sơ"
3. Click "Chỉnh sửa hồ sơ"
4. **Kiểm tra**: Form chuyển sang edit mode, hiển thị "Lưu thay đổi" và "Hủy"
5. **Kiểm tra**: KHÔNG tự động submit
6. Thay đổi thông tin và click "Lưu thay đổi"
7. **Kiểm tra**: Hiển thị toast "Cập nhật hồ sơ thành công"
8. **Kiểm tra**: Form chuyển về view mode

#### Test Yêu cầu 2 (ChangePassword):
1. Đăng nhập với bất kỳ role nào
2. Vào menu "Đổi mật khẩu"
3. Nhập mật khẩu hiện tại, mật khẩu mới, xác nhận mật khẩu
4. Click "Đổi mật khẩu"
5. **Kiểm tra**: Hiển thị toast "Đổi mật khẩu thành công! Đang chuyển đến trang đăng nhập..."
6. **Kiểm tra**: Sau 1.5 giây, chuyển về trang Login
7. **Kiểm tra**: Không thể quay lại dashboard (phải đăng nhập lại)
8. Đăng nhập lại với mật khẩu mới
9. **Kiểm tra**: Đăng nhập thành công

#### Test Yêu cầu 3 (Patient Menu):
1. Đăng nhập với role Patient (Bệnh nhân)
2. **Kiểm tra**: Sidebar hiển thị các menu:
   - ✅ Tổng quan
   - ✅ Lịch hẹn
   - ✅ Hồ sơ (với icon User)
   - ✅ Đổi mật khẩu (với icon Lock)
   - ✅ Kết quả xét nghiệm
   - ✅ Đơn thuốc
   - ✅ Lịch sử thanh toán
3. Click "Hồ sơ"
4. **Kiểm tra**: Chuyển đến trang `/patient/profile`
5. **Kiểm tra**: Hiển thị thông tin cá nhân của bệnh nhân
6. Click "Đổi mật khẩu"
7. **Kiểm tra**: Chuyển đến trang `/patient/change-password`
8. **Kiểm tra**: Hiển thị form đổi mật khẩu

---

## Lưu ý quan trọng:

### 1. useEffect dependencies:
- Luôn cẩn thận với dependencies của `useEffect`
- Nếu effect update state dựa trên một state khác, cần thêm state đó vào dependencies
- Trong trường hợp này, `isEditing` ngăn việc update formData khi đang editing

### 2. Auth state management:
- Khi logout, phải xóa cả token (localStorage) VÀ currentUser (context)
- Chỉ xóa token không đủ vì context vẫn giữ user state
- Luôn gọi `logout()` từ context thay vì chỉ gọi `authHelpers.clearAuth()`

### 3. Menu configuration:
- Menu items được định nghĩa trong `MENU_CONFIG` (permissions.js)
- Icon names phải match với iconMap trong Layout component
- Patient role có prefix `/patient/` trong tất cả các routes

### 4. Route structure:
- Patient routes: `/patient/*` (handled by PatientLayout)
- Other roles: `/*` (handled by Layout)
- Shared components (UserProfile, ChangePassword) được reuse cho tất cả roles
- Patient sử dụng `/patient/profile` và `/patient/change-password`
- Other roles sử dụng `/profile` và `/change-password`
