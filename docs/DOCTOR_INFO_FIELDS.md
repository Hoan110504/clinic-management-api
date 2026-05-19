# Thông tin bổ sung cho Bác sĩ - Hướng dẫn sử dụng

## Tổng quan

Hệ thống đã được bổ sung các trường thông tin tùy chọn cho tài khoản bác sĩ để chatbot AI có thể tư vấn tốt hơn cho bệnh nhân. Các trường này giúp bệnh nhân tìm được bác sĩ phù hợp với nhu cầu của mình.

## Các trường thông tin mới

### 1. **specialization** (Chuyên khoa)
- **Kiểu dữ liệu**: String (tối đa 100 ký tự)
- **Bắt buộc**: Không
- **Ví dụ**: 
  - "Tim mạch"
  - "Tiêu hóa"
  - "Hô hấp"
  - "Thần kinh"
  - "Nội tổng quát"
- **Mục đích**: Giúp bệnh nhân tìm bác sĩ chuyên khoa phù hợp

### 2. **qualifications** (Học vị/Bằng cấp)
- **Kiểu dữ liệu**: String (tối đa 255 ký tự)
- **Bắt buộc**: Không
- **Ví dụ**:
  - "Thạc sĩ Y khoa, Đại học Y Hà Nội"
  - "Bác sĩ chuyên khoa II Tim mạch"
  - "Tiến sĩ Y học, Chuyên ngành Nội tiết"
- **Mục đích**: Thể hiện trình độ chuyên môn của bác sĩ

### 3. **experienceYears** (Số năm kinh nghiệm)
- **Kiểu dữ liệu**: Integer (0-70)
- **Bắt buộc**: Không
- **Ví dụ**: 5, 10, 15, 20
- **Mục đích**: Giúp bệnh nhân đánh giá kinh nghiệm của bác sĩ

### 4. **bio** (Giới thiệu chi tiết)
- **Kiểu dữ liệu**: Text (tối đa 2000 ký tự)
- **Bắt buộc**: Không
- **Ví dụ**:
  ```
  Bác sĩ Nguyễn Văn A tốt nghiệp Đại học Y Hà Nội năm 2010. 
  Có 13 năm kinh nghiệm trong lĩnh vực tim mạch.
  Từng công tác tại Bệnh viện Bạch Mai và Bệnh viện Tim Hà Nội.
  Chuyên điều trị các bệnh lý về tim mạch, tăng huyết áp, rối loạn nhịp tim.
  ```
- **Mục đích**: Cung cấp thông tin chi tiết về bác sĩ cho bệnh nhân
- **Lưu ý**: Đây là thông tin công khai, AI chatbot sẽ hiển thị cho bệnh nhân

### 5. **consultationNote** (Ghi chú tư vấn)
- **Kiểu dữ liệu**: Text (tối đa 1000 ký tự)
- **Bắt buộc**: Không
- **Ví dụ**:
  ```
  Lịch khám: Thứ 2, 4, 6 (Sáng: 8:00-11:30, Chiều: 14:00-17:00)
  Bệnh nhân cần đặt lịch trước ít nhất 1 ngày.
  Thời gian khám trung bình: 20-30 phút/bệnh nhân.
  ```
- **Mục đích**: Thông tin hữu ích cho bệnh nhân khi đặt lịch
- **Lưu ý**: Thông tin này sẽ được chatbot sử dụng để tư vấn

## Bảo mật và quyền truy cập

### Thông tin công khai (tất cả roles có thể xem):
- ✅ Họ tên
- ✅ Mã nhân viên
- ✅ Chuyên khoa (specialization)
- ✅ Học vị (qualifications)
- ✅ Số năm kinh nghiệm (experienceYears)
- ✅ Giới thiệu (bio)
- ✅ Ghi chú tư vấn (consultationNote)

### Thông tin nhạy cảm (chỉ staff roles xem được):
- 🔒 Email (chỉ Admin, Bác sĩ, Lễ tân, Dược sĩ)
- 🔒 Số điện thoại (chỉ Admin, Bác sĩ, Lễ tân, Dược sĩ)

### Bộ lọc bảo mật trong AI Chatbot:
- Bệnh nhân **KHÔNG** thấy email và số điện thoại của bác sĩ
- Bệnh nhân **CÓ THỂ** thấy tất cả thông tin chuyên môn công khai
- AI chatbot tự động lọc thông tin nhạy cảm dựa trên role của người dùng

## API Endpoints

### 1. Tạo tài khoản bác sĩ mới
```http
POST /api/users
Authorization: Bearer {admin_token}

{
  "email": "doctor@example.com",
  "password": "password123",
  "fullName": "Bác sĩ Nguyễn Văn A",
  "role": 2,
  "phone": "0123456789",
  "specialization": "Tim mạch",
  "qualifications": "Thạc sĩ Y khoa, Bác sĩ chuyên khoa II",
  "experienceYears": 15,
  "bio": "Bác sĩ có 15 năm kinh nghiệm trong lĩnh vực tim mạch...",
  "consultationNote": "Lịch khám: Thứ 2, 4, 6 (8:00-17:00)"
}
```

### 2. Cập nhật thông tin bác sĩ
```http
PUT /api/users/:id
Authorization: Bearer {admin_token}

{
  "specialization": "Tim mạch can thiệp",
  "qualifications": "Tiến sĩ Y học",
  "experienceYears": 20,
  "bio": "Cập nhật thông tin mới...",
  "consultationNote": "Lịch khám mới..."
}
```

### 3. Lấy danh sách bác sĩ (cho bệnh nhân)
```http
GET /api/users/role/2
Authorization: Bearer {patient_token}

Response:
[
  {
    "id": 1,
    "fullName": "Bác sĩ Nguyễn Văn A",
    "staffCode": "BS001",
    "specialization": "Tim mạch",
    "qualifications": "Thạc sĩ Y khoa",
    "experienceYears": 15,
    "bio": "...",
    "consultationNote": "..."
    // Không có email và phone
  }
]
```

## AI Chatbot Queries

### Query: `available_doctors`
- **Mô tả**: Lấy danh sách tất cả bác sĩ đang hoạt động
- **Roles**: Tất cả
- **Dữ liệu trả về**: Thông tin bác sĩ với bộ lọc theo role
- **Sử dụng khi**: Bệnh nhân hỏi "Có bác sĩ nào?", "Danh sách bác sĩ"

### Query: `find_specialist_doctor`
- **Mô tả**: Tìm bác sĩ theo chuyên khoa hoặc bệnh lý
- **Roles**: Tất cả
- **Dữ liệu trả về**: Bác sĩ được nhóm theo chuyên khoa
- **Sử dụng khi**: 
  - "Bác sĩ nào chuyên về tim mạch?"
  - "Tôi bị đau bụng nên gặp bác sĩ nào?"
  - "Bác sĩ nào có kinh nghiệm nhất?"

## Ví dụ câu hỏi chatbot có thể trả lời

### Bệnh nhân hỏi:
1. **"Có bác sĩ nào chuyên về tim mạch không?"**
   - AI sẽ dùng query `find_specialist_doctor`
   - Trả về danh sách bác sĩ tim mạch với thông tin chuyên môn

2. **"Bác sĩ Nguyễn Văn A có kinh nghiệm bao nhiêu năm?"**
   - AI sẽ dùng query `available_doctors`
   - Trả về thông tin chi tiết về bác sĩ

3. **"Tôi bị đau ngực, nên gặp bác sĩ nào?"**
   - AI sẽ dùng query `find_specialist_doctor`
   - Gợi ý bác sĩ tim mạch hoặc nội tổng quát

4. **"Bác sĩ nào có lịch khám vào thứ 2?"**
   - AI sẽ dùng query `available_doctors` + `doctor_schedule`
   - Kiểm tra consultationNote và lịch hẹn

## Lưu ý khi nhập dữ liệu

### ✅ Nên làm:
- Nhập đầy đủ thông tin chuyên khoa để chatbot tư vấn chính xác
- Cập nhật số năm kinh nghiệm định kỳ
- Viết bio ngắn gọn, dễ hiểu, tập trung vào chuyên môn
- Ghi rõ lịch khám trong consultationNote

### ❌ Không nên:
- Để trống tất cả các trường (chatbot sẽ không tư vấn được tốt)
- Nhập thông tin sai lệch hoặc không chính xác
- Viết bio quá dài (> 2000 ký tự)
- Nhập thông tin nhạy cảm vào bio (số điện thoại cá nhân, địa chỉ nhà)

## Kiểm tra dữ liệu

### Xem thông tin bác sĩ trong database:
```sql
SELECT 
  id, 
  full_name, 
  specialization, 
  qualifications, 
  experience_years,
  bio,
  consultation_note
FROM users 
WHERE role = 2 AND is_active = 1;
```

### Test chatbot query:
```javascript
// Trong AI chatbot, test query
const doctors = await queryHandler.executeQuery('available_doctors', userId, userRole);
console.log(doctors);
```

## Rollback Migration (nếu cần)

Nếu cần xóa các trường mới:
```bash
npm run db:migrate:undo
```

Lệnh này sẽ xóa 5 cột: specialization, qualifications, experience_years, bio, consultation_note
