# Tóm tắt sửa lỗi

## ✅ Yêu cầu 2: UserProfile - Các field có thể chỉnh sửa

### Trạng thái: ĐÃ ĐÚNG

Code hiện tại đã hoạt động chính xác như yêu cầu:

**Khi KHÔNG ở chế độ chỉnh sửa** (`isEditing = false`):
- Tất cả các field có `disabled={!isEditing}` → disabled
- Background màu xám (`bg-gray-50`)
- Cursor `cursor-not-allowed`
- Hiển thị nút "Chỉnh sửa hồ sơ"

**Khi ĐÃ click "Chỉnh sửa hồ sơ"** (`isEditing = true`):
- Các field CÓ THỂ chỉnh sửa:
  - ✅ Tên đầy đủ
  - ✅ Email
  - ✅ Số điện thoại
  - ✅ Ngày sinh
  - ✅ Giới tính
  - ✅ Địa chỉ

- Các field KHÔNG THỂ chỉnh sửa (luôn disabled):
  - ❌ ID nhân viên (luôn có `disabled={true}`)
  - ❌ Số CCCD/CMND (luôn có `disabled={true}`)

### Code:
```javascript
{/* Các field có thể chỉnh sửa */}
<input
  disabled={!isEditing}  // Chỉ disabled khi KHÔNG editing
  className={`... ${!isEditing ? 'bg-gray-50 cursor-not-allowed' : ''}`}
/>

{/* ID nhân viên - LUÔN disabled */}
<input
  disabled  // Luôn disabled
  className="... bg-gray-100 cursor-not-allowed text-gray-600"
/>

{/* Số CCCD - LUÔN disabled */}
<input
  disabled  // Luôn disabled
  className="... bg-gray-100 cursor-not-allowed text-gray-600"
/>
```

### Kết quả:
✅ Code đã đúng như yêu cầu
✅ Khi click "Chỉnh sửa hồ sơ", có thể sửa tất cả các field trừ "ID nhân viên" và "Số CCCD"

---

## ⚠️ Yêu cầu 1: Lỗi NO_TOKEN khi đổi mật khẩu

### Lỗi:
```json
{
  "success": false,
  "error": {
    "code": "NO_TOKEN",
    "message": "Token không được cung cấp",
    "statusCode": 401,
    "timestamp": "2026-05-08T15:18:54+07:00"
  }
}
```

### Nguyên nhân có thể:

#### 1. Token không tồn tại trong localStorage
- User chưa đăng nhập
- Token đã bị xóa
- Token đã hết hạn và không refresh được

#### 2. Token không được gửi trong request header
- Vấn đề với `getHeaders()` function
- Request bị block trước khi thêm header

#### 3. Middleware authenticate không nhận được token
- Token format không đúng
- Header Authorization không đúng format

### Đã sửa:

#### 1. Cải thiện error handling trong ChangePassword.jsx:
```javascript
catch (err) {
  console.error('Change password error:', err);
  
  // Check for 401 status or token errors
  if (err?.status === 401 || err?.code === 'NO_TOKEN' || err?.code === 'INVALID_TOKEN') {
    setErrors({ currentPassword: 'Mật khẩu hiện tại không chính xác hoặc phiên đăng nhập đã hết hạn' });
    toast.error('Mật khẩu hiện tại không chính xác hoặc phiên đăng nhập đã hết hạn');
  } else {
    const errorMessage = err?.data?.error?.message || err?.message || 'Đổi mật khẩu thất bại';
    toast.error(errorMessage);
  }
}
```

#### 2. Thêm debug log để kiểm tra token:
```javascript
const handleSubmit = async (e) => {
  e.preventDefault();

  if (!validateForm()) {
    return;
  }

  setLoading(true);
  try {
    // Debug: Check if token exists before making request
    const token = localStorage.getItem('clinic_access_token');
    console.log('Token exists:', !!token);
    
    const response = await authService.changePassword(...);
    // ...
  }
}
```

### Hướng dẫn debug:

#### Bước 1: Kiểm tra token trong localStorage
Mở DevTools Console và chạy:
```javascript
console.log('Access Token:', localStorage.getItem('clinic_access_token'));
console.log('Refresh Token:', localStorage.getItem('clinic_refresh_token'));
console.log('Current User:', localStorage.getItem('clinic_current_user'));
```

**Kết quả mong đợi:**
- Access Token: Một chuỗi JWT dài
- Refresh Token: Một chuỗi JWT dài
- Current User: JSON object chứa thông tin user

**Nếu NULL hoặc undefined:**
→ User chưa đăng nhập hoặc token đã bị xóa
→ **Giải pháp**: Đăng nhập lại

#### Bước 2: Kiểm tra request header
Mở DevTools Network tab:
1. Click vào request `/api/auth/change-password`
2. Xem tab "Headers"
3. Tìm "Request Headers"
4. Kiểm tra có `Authorization: Bearer <token>` không

**Nếu KHÔNG có Authorization header:**
→ Token không được gửi đi
→ **Giải pháp**: Kiểm tra `api.js` - function `getHeaders()`

**Nếu CÓ Authorization header:**
→ Vấn đề ở backend
→ **Giải pháp**: Kiểm tra backend middleware `authenticate`

#### Bước 3: Kiểm tra token có hợp lệ không
Copy token từ localStorage và decode tại https://jwt.io

**Kiểm tra:**
- `exp` (expiration time): Token đã hết hạn chưa?
- `id`: User ID có đúng không?
- `type`: Phải là "access" (không phải "refresh")

**Nếu token đã hết hạn:**
→ Cần refresh token
→ **Giải pháp**: Đăng nhập lại hoặc kiểm tra auto-refresh logic

#### Bước 4: Test với Postman/Thunder Client
```
POST http://localhost:5000/api/auth/change-password
Headers:
  Authorization: Bearer <your_token>
  Content-Type: application/json
Body:
{
  "currentPassword": "old_password",
  "newPassword": "new_password",
  "confirmPassword": "new_password"
}
```

**Nếu Postman thành công:**
→ Vấn đề ở frontend
→ Kiểm tra lại `api.js` và `authService.changePassword()`

**Nếu Postman cũng lỗi:**
→ Vấn đề ở backend
→ Kiểm tra middleware `authenticate` và route config

### Các trường hợp thường gặp:

#### Case 1: User chưa đăng nhập
**Triệu chứng:**
- localStorage không có token
- Console log: `Token exists: false`

**Giải pháp:**
1. Đăng nhập lại
2. Kiểm tra AuthContext có lưu token không
3. Kiểm tra login flow có gọi `authHelpers.setToken()` không

#### Case 2: Token đã hết hạn
**Triệu chứng:**
- Token tồn tại nhưng đã hết hạn (check `exp` field)
- Auto-refresh không hoạt động

**Giải pháp:**
1. Đăng nhập lại
2. Kiểm tra `attemptTokenRefresh()` trong `api.js`
3. Kiểm tra refresh token còn hợp lệ không

#### Case 3: Token không được gửi trong request
**Triệu chứng:**
- Token tồn tại trong localStorage
- Nhưng không có Authorization header trong request

**Giải pháp:**
1. Kiểm tra `getHeaders()` function trong `api.js`:
```javascript
const getHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};
```

2. Kiểm tra `apiRequest()` có gọi `getHeaders()` không:
```javascript
const config = {
  headers: getHeaders(),  // ← Phải có dòng này
  ...options,
};
```

#### Case 4: Backend middleware không nhận được token
**Triệu chứng:**
- Token được gửi đi (có trong Network tab)
- Nhưng backend vẫn báo NO_TOKEN

**Giải pháp:**
Kiểm tra backend `authenticate` middleware:
```javascript
// backend/src/middleware/auth.js
const token = req.headers.authorization?.split(' ')[1];
if (!token) {
  throw new UnauthorizedError('Token không được cung cấp', 'NO_TOKEN');
}
```

### Files đã thay đổi:

1. `frontend/src/pages/shared/ChangePassword.jsx`:
   - Cải thiện error handling
   - Thêm debug log
   - Check cho NO_TOKEN và INVALID_TOKEN errors

### Kết quả:
✅ Error handling tốt hơn
✅ Debug log để kiểm tra token
✅ Message lỗi rõ ràng hơn
⚠️ Cần user kiểm tra token trong localStorage

---

## Hướng dẫn test:

### Test UserProfile:
1. Đăng nhập vào hệ thống
2. Vào trang "Hồ sơ"
3. Kiểm tra tất cả fields đều disabled (màu xám)
4. Click "Chỉnh sửa hồ sơ"
5. Kiểm tra:
   - ✅ Có thể sửa: Tên, Email, SĐT, Ngày sinh, Giới tính, Địa chỉ
   - ❌ Không thể sửa: ID nhân viên, Số CCCD (màu xám đậm hơn)
6. Thay đổi thông tin và click "Lưu thay đổi"
7. Kiểm tra dữ liệu được lưu
8. Click "Hủy" → form reset về giá trị cũ

### Test ChangePassword:
1. Đăng nhập vào hệ thống
2. Mở DevTools Console
3. Chạy: `console.log('Token:', localStorage.getItem('clinic_access_token'))`
4. **Nếu token = null:**
   - Đăng nhập lại
   - Kiểm tra lại
5. **Nếu token tồn tại:**
   - Vào trang "Đổi mật khẩu"
   - Nhập thông tin
   - Click "Đổi mật khẩu"
   - Mở Network tab
   - Kiểm tra request có Authorization header không
6. **Nếu vẫn lỗi:**
   - Copy token
   - Decode tại jwt.io
   - Kiểm tra `exp` (expiration time)
   - Nếu hết hạn → đăng nhập lại

---

## Lưu ý quan trọng:

### 1. Token lifecycle:
- Access token: Hết hạn sau 1 giờ (hoặc theo config)
- Refresh token: Hết hạn sau 7 ngày (hoặc theo config)
- Khi access token hết hạn, hệ thống tự động refresh
- Khi refresh token hết hạn, phải đăng nhập lại

### 2. Auto-refresh mechanism:
- Khi nhận 401, `api.js` tự động gọi `/auth/refresh`
- Nếu refresh thành công, retry request gốc
- Nếu refresh thất bại, redirect về login

### 3. Security:
- Token được lưu trong localStorage (không phải cookie)
- Mỗi request đều gửi token trong Authorization header
- Backend verify token trước khi xử lý request

### 4. Debugging tips:
- Luôn check Console log trước
- Luôn check Network tab
- Luôn check localStorage
- Decode JWT để xem nội dung và expiration

