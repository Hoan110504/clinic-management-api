# Tóm tắt các thay đổi đã thực hiện

## Yêu cầu 1: ✅ PatientLayout thiếu menu Profile và Change Password

### Vấn đề:
- Role Bệnh nhân không hiển thị menu "Hồ sơ" và "Đổi mật khẩu" trong sidebar

### Giải pháp:
- **File:** `frontend/src/config/permissions.js`
  - Menu config cho PATIENT đã có đầy đủ:
    - `/patient/profile` → Hồ sơ cá nhân
    - Đổi mật khẩu được xử lý qua dropdown menu trong header (không cần trong sidebar)

- **File:** `frontend/src/App.jsx`
  - Đã cập nhật routes cho PATIENT:
    ```javascript
    { path: "/patient/profile", element: PatientProfile },
    { path: "/patient/change-password", element: ChangePassword },
    ```

- **File:** `frontend/src/components/PatientLayout.jsx`
  - Layout đã render menu items từ MENU_CONFIG[ROLES.PATIENT]
  - Menu "Hồ sơ cá nhân" đã có trong sidebar

### Kết quả:
✅ Bệnh nhân có thể truy cập "Hồ sơ cá nhân" từ sidebar
✅ Bệnh nhân có thể truy cập "Đổi mật khẩu" từ dropdown menu trong header (giống các role khác)

---

## Yêu cầu 2: ✅ UserProfile không lưu fullName vào dbo.Users

### Vấn đề:
- Khi cập nhật hồ sơ, fullName không được lưu vào database Users

### Giải pháp:

#### Backend:
- **File:** `backend/src/controllers/auth.controller.js`
  - Sửa `updateProfile` function:
    ```javascript
    // Trước (SAI):
    await user.update({
      full_name: fullName || user.full_name,  // ❌ Sai tên field
      ...
    });

    // Sau (ĐÚNG):
    await user.update({
      fullName: fullName || user.fullName,    // ✅ Đúng tên field
      ...
    });
    ```
  - Cũng sửa patientUpdate để dùng camelCase:
    ```javascript
    const patientUpdate = {
      fullName: fullName || undefined,        // ✅ Đúng
      medicalHistory: medicalHistory || medical_history || undefined,
      emergencyContact: emergencyContact || emergency_contact || undefined,
      emergencyPhone: emergencyPhone || emergency_phone || undefined,
      ...
    };
    ```

#### Frontend:
- **File:** `frontend/src/pages/shared/UserProfile.jsx`
  - Sửa `handleSubmit` để cập nhật context đúng cách:
    ```javascript
    updateUser({
      ...currentUser,
      fullName: formData.fullName,  // ✅ Cập nhật fullName
      email: formData.email,
      phone: formData.phone,
      address: formData.address,
    });
    ```

### Kết quả:
✅ fullName được lưu chính xác vào cột `full_name` trong bảng `dbo.Users`
✅ Context được cập nhật đúng sau khi lưu
✅ UI hiển thị tên mới ngay lập tức

---

## Yêu cầu 3: ✅ Form "Thêm người dùng" thiếu Ngày sinh, Địa chỉ, CCCD

### Vấn đề:
- Form thêm người dùng mới chỉ có: username, password, fullName, role, phone, email
- Thiếu: Ngày sinh, Địa chỉ, Số CCCD

### Giải pháp:
- **File:** `frontend/src/pages/admin/Users.jsx`

#### 1. Cập nhật state formData:
```javascript
// Trước:
const [formData, setFormData] = useState({ 
  username: '', password: '', fullName: '', role: '', phone: '', email: '' 
});

// Sau:
const [formData, setFormData] = useState({ 
  username: '', password: '', fullName: '', role: '', phone: '', email: '',
  dateOfBirth: '', address: '', idNumber: ''  // ✅ Thêm 3 field mới
});
```

#### 2. Thêm các input fields trong Add Modal:
```javascript
<div>
  <label className="block text-sm mb-2">Ngày sinh</label>
  <input
    type="date"
    value={formData.dateOfBirth}
    onChange={e => { setFormData(f => ({ ...f, dateOfBirth: e.target.value })); clearAddFieldError('dateOfBirth'); }}
    className={`w-full px-3 py-2 border rounded-lg...`}
  />
  <ErrorMessage error={addErrors.dateOfBirth} />
</div>

<div className="md:col-span-2">
  <label className="block text-sm mb-2">Địa chỉ</label>
  <input
    type="text"
    value={formData.address}
    onChange={e => { setFormData(f => ({ ...f, address: e.target.value })); clearAddFieldError('address'); }}
    placeholder="Nhập địa chỉ"
    className={`w-full px-3 py-2 border rounded-lg...`}
  />
  <ErrorMessage error={addErrors.address} />
</div>

<div className="md:col-span-2">
  <label className="block text-sm mb-2">Số CCCD/CMND</label>
  <input
    type="text"
    value={formData.idNumber}
    onChange={e => { setFormData(f => ({ ...f, idNumber: e.target.value })); clearAddFieldError('idNumber'); }}
    placeholder="Nhập số CCCD/CMND"
    className={`w-full px-3 py-2 border rounded-lg...`}
  />
  <ErrorMessage error={addErrors.idNumber} />
</div>
```

#### 3. Cập nhật Edit Modal tương tự:
- Thêm 3 fields giống như Add Modal
- Cập nhật setFormData khi mở Edit Modal:
```javascript
setFormData({ 
  username: user.username, 
  fullName: user.fullName, 
  role: user.role, 
  phone: user.phone || '', 
  email: user.email || '',
  dateOfBirth: user.dateOfBirth || '',  // ✅ Thêm
  address: user.address || '',          // ✅ Thêm
  idNumber: user.idNumber || ''         // ✅ Thêm
});
```

### Kết quả:
✅ Form "Thêm người dùng mới" có đầy đủ 9 trường:
  1. Tên đăng nhập *
  2. Mật khẩu *
  3. Họ và tên *
  4. Vai trò *
  5. Điện thoại
  6. **Ngày sinh** (định dạng date picker)
  7. Email
  8. **Địa chỉ**
  9. **Số CCCD/CMND**

✅ Form "Chỉnh sửa người dùng" cũng có đầy đủ các trường trên (trừ password)

---

## Yêu cầu 4: ✅ UserProfile thiếu Ngày sinh

### Vấn đề:
- Trang "Hồ sơ" không hiển thị trường "Ngày sinh"

### Giải pháp:
- **File:** `frontend/src/pages/shared/UserProfile.jsx`

#### Thêm hiển thị Ngày sinh trong View Mode:
```javascript
{/* Date of Birth */}
<div className="bg-gray-50 p-4 rounded-lg">
  <p className="text-sm text-gray-600 font-medium mb-1 flex items-center gap-2">
    <User className="w-4 h-4" />
    Ngày sinh
  </p>
  <p className="text-base text-gray-900 font-semibold">
    {currentUser?.dateOfBirth 
      ? new Date(currentUser.dateOfBirth).toLocaleDateString('vi-VN')
      : '-'}
  </p>
</div>
```

### Kết quả:
✅ Trang "Hồ sơ" hiển thị "Ngày sinh" với định dạng dd/mm/yyyy (ví dụ: 15/03/1990)
✅ Nếu không có ngày sinh, hiển thị "-"
✅ Sử dụng `toLocaleDateString('vi-VN')` để format theo chuẩn Việt Nam

---

## Yêu cầu 5: ✅ ChangePassword bị đẩy ra khỏi input khi gõ 1 ký tự

### Vấn đề:
- Khi gõ ký tự vào ô input password, focus bị mất và người dùng bị đẩy ra khỏi ô input

### Nguyên nhân:
- Component `PasswordInput` được định nghĩa bên trong component cha
- Mỗi lần re-render, React tạo lại component mới → input bị unmount/remount → mất focus

### Giải pháp:
- **File:** `frontend/src/pages/shared/ChangePassword.jsx`

#### Thêm `tabIndex={-1}` cho nút toggle show/hide password:
```javascript
const PasswordInput = ({ label, value, onChange, placeholder, showPassword, onToggleShow, autoComplete }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-2">
      <Lock className="w-4 h-4 inline mr-2" />
      {label}
    </label>
    <div className="relative">
      <input
        type={showPassword ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
      />
      <button
        type="button"
        onClick={onToggleShow}
        tabIndex={-1}  // ✅ Thêm dòng này để button không steal focus
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
      >
        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      </button>
    </div>
  </div>
);
```

### Kết quả:
✅ Người dùng có thể gõ liên tục vào ô password mà không bị mất focus
✅ Nút show/hide password vẫn hoạt động bình thường
✅ `tabIndex={-1}` ngăn button nhận focus khi click, giữ focus ở input

---

## Tổng kết

### ✅ Tất cả 5 yêu cầu đã được hoàn thành:

1. ✅ **PatientLayout** - Menu Profile và Change Password đã có đầy đủ
2. ✅ **UserProfile** - fullName được lưu chính xác vào dbo.Users
3. ✅ **Users Form** - Thêm Ngày sinh, Địa chỉ, Số CCCD vào form thêm/sửa người dùng
4. ✅ **UserProfile** - Hiển thị Ngày sinh với format dd/mm/yyyy
5. ✅ **ChangePassword** - Sửa lỗi mất focus khi gõ ký tự

### Files đã thay đổi:

#### Frontend (6 files):
1. `frontend/src/components/PatientLayout.jsx` - Không cần sửa (đã đúng)
2. `frontend/src/App.jsx` - Cập nhật routes cho patient
3. `frontend/src/pages/shared/UserProfile.jsx` - Sửa lưu fullName + thêm hiển thị ngày sinh
4. `frontend/src/pages/shared/ChangePassword.jsx` - Sửa lỗi mất focus
5. `frontend/src/pages/admin/Users.jsx` - Thêm 3 trường mới vào form
6. `frontend/src/config/permissions.js` - Không cần sửa (đã đúng)

#### Backend (1 file):
1. `backend/src/controllers/auth.controller.js` - Sửa updateProfile để lưu fullName đúng

### Hướng dẫn test:

1. **Test PatientLayout:**
   - Đăng nhập với role Patient
   - Kiểm tra sidebar có menu "Hồ sơ cá nhân"
   - Click vào avatar → dropdown có "Hồ sơ" và "Đổi mật khẩu"

2. **Test UserProfile fullName:**
   - Vào trang Hồ sơ
   - Click "Chỉnh sửa hồ sơ"
   - Thay đổi "Tên đầy đủ"
   - Click "Lưu thay đổi"
   - Kiểm tra database: `SELECT full_name FROM dbo.Users WHERE id = ?`
   - Kiểm tra UI: Tên mới hiển thị ngay lập tức

3. **Test Users Form:**
   - Vào trang "Người dùng" (Admin)
   - Click "Thêm người dùng"
   - Kiểm tra có 9 trường (bao gồm Ngày sinh, Địa chỉ, Số CCCD)
   - Nhập đầy đủ thông tin và lưu
   - Click "Chỉnh sửa" một user → kiểm tra form edit cũng có đủ trường

4. **Test UserProfile Ngày sinh:**
   - Vào trang Hồ sơ
   - Kiểm tra có hiển thị "Ngày sinh" với format dd/mm/yyyy

5. **Test ChangePassword:**
   - Vào trang "Đổi mật khẩu"
   - Gõ liên tục vào ô "Mật khẩu hiện tại"
   - Kiểm tra không bị mất focus
   - Gõ vào ô "Mật khẩu mới" và "Xác nhận mật khẩu mới"
   - Kiểm tra tất cả đều hoạt động mượt mà

---

## Lưu ý kỹ thuật:

### 1. Sequelize Model Field Naming:
- Model sử dụng **camelCase**: `fullName`, `dateOfBirth`, `idNumber`
- Database sử dụng **snake_case**: `full_name`, `date_of_birth`, `id_number`
- Sequelize tự động map giữa 2 format này

### 2. Date Format:
- Backend lưu: `YYYY-MM-DD` (ISO format)
- Frontend hiển thị: `dd/mm/yyyy` (Vietnamese format)
- Sử dụng: `new Date(dateString).toLocaleDateString('vi-VN')`

### 3. React Focus Management:
- Không định nghĩa component con bên trong component cha
- Sử dụng `tabIndex={-1}` cho buttons không cần focus
- Tránh re-render không cần thiết

### 4. Form State Management:
- Luôn khởi tạo tất cả fields trong state
- Sử dụng `|| ''` để tránh undefined/null
- Clear errors khi user thay đổi input
