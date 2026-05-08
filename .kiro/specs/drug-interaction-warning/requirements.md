# Requirements Document

## Introduction

Tính năng **AI cảnh báo tương tác thuốc realtime** bổ sung khả năng kiểm tra tương tác thuốc tự động vào luồng kê đơn của bác sĩ tại phòng khám nội khoa. Khi bác sĩ thêm từ thuốc thứ hai trở đi vào đơn, hệ thống sẽ tự động gọi Gemini AI (sau debounce 800ms) để phân tích các cặp tương tác nguy hiểm, rồi hiển thị cảnh báo dạng modal — không chặn việc lưu đơn, chỉ cung cấp thông tin để bác sĩ tự quyết định. Kết quả được cache in-memory theo combination hash (TTL 30 phút) để tránh gọi API trùng lặp.

## Glossary

- **DrugInteractionService**: Service backend chịu trách nhiệm kiểm tra tương tác thuốc qua Gemini AI và quản lý cache in-memory.
- **DrugInteractionController**: Controller xử lý endpoint `POST /api/ai/drug-interactions`.
- **useDrugInteractionCheck**: Custom React hook quản lý toàn bộ logic debounce, gọi API, và trạng thái cảnh báo phía frontend.
- **InteractionWarningModal**: Component modal hiển thị danh sách tương tác thuốc phát hiện được.
- **InteractionStatusBadge**: Component badge inline trong form kê đơn, hiển thị trạng thái kiểm tra.
- **PrescriptionEditor**: Component kê đơn hiện có trong `DoctorExamination.jsx`, nơi tích hợp tính năng này.
- **Combination Hash**: Chuỗi key được tạo bằng cách sort các medicine ID rồi join bằng dấu `-`, dùng làm cache key.
- **Severity**: Mức độ nghiêm trọng của tương tác thuốc — `HIGH` (nguy hiểm), `MEDIUM` (cần chú ý), `LOW` (tham khảo).
- **Debounce**: Kỹ thuật trì hoãn gọi API 800ms sau lần thêm thuốc cuối cùng để tránh gọi API liên tục.
- **AbortController**: Web API dùng để hủy fetch request đang chờ khi danh sách thuốc thay đổi hoặc component unmount.

---

## Requirements

### Requirement 1: Kiểm tra tương tác thuốc qua Gemini AI

**User Story:** Là bác sĩ, tôi muốn hệ thống tự động kiểm tra tương tác giữa các thuốc trong đơn, để tôi có thể đưa ra quyết định kê đơn an toàn hơn cho bệnh nhân.

#### Acceptance Criteria

1. WHEN bác sĩ thêm thuốc thứ hai trở đi vào đơn, THE DrugInteractionService SHALL gọi Gemini API để kiểm tra tương tác sau khoảng debounce 800ms kể từ lần thêm thuốc cuối cùng.
2. WHEN danh sách thuốc trong đơn chỉ có 1 thuốc hoặc ít hơn, THE DrugInteractionService SHALL không gọi Gemini API.
3. WHEN Gemini API trả về kết quả, THE DrugInteractionService SHALL parse response theo JSON schema chuẩn gồm các trường `has_interactions`, `interactions[]`, và `summary`.
4. WHEN Gemini API trả về lỗi hoặc timeout, THE DrugInteractionService SHALL trả về lỗi có cấu trúc để frontend hiển thị trạng thái lỗi nhẹ mà không chặn bác sĩ kê đơn.
5. THE DrugInteractionService SHALL gọi Gemini với `responseMimeType: "application/json"` để đảm bảo response là JSON hợp lệ, không phải text tự do.
6. WHEN Gemini trả về tương tác, THE DrugInteractionService SHALL đảm bảo mỗi phần tử trong `interactions[]` có đủ các trường: `drug1`, `drug2`, `severity` (HIGH/MEDIUM/LOW), `mechanism`, `clinical_effect`, `recommendation`.

---

### Requirement 2: Cache kết quả theo combination hash

**User Story:** Là bác sĩ, tôi muốn hệ thống không gọi API lặp lại khi tôi kê cùng một tập thuốc, để tránh chậm trễ và tiết kiệm quota Gemini.

#### Acceptance Criteria

1. THE DrugInteractionService SHALL duy trì một cache in-memory (Map) với TTL 30 phút cho mỗi entry.
2. WHEN nhận request kiểm tra tương tác, THE DrugInteractionService SHALL tạo cache key bằng cách sort các medicine ID theo thứ tự tăng dần rồi join bằng dấu `-`.
3. WHEN cache key đã tồn tại và chưa hết TTL, THE DrugInteractionService SHALL trả về kết quả từ cache mà không gọi Gemini API.
4. WHEN cache key không tồn tại hoặc đã hết TTL, THE DrugInteractionService SHALL gọi Gemini API rồi lưu kết quả vào cache với timestamp hiện tại.
5. FOR ALL tập thuốc giống nhau (dù thứ tự thêm khác nhau), THE DrugInteractionService SHALL trả về cùng một cache key (tính chất bất biến của sort).
6. THE DrugInteractionService SHALL không lưu kết quả tương tác vào database — đây là advisory realtime, không phải medical record.

---

### Requirement 3: API endpoint kiểm tra tương tác thuốc

**User Story:** Là bác sĩ, tôi muốn có một endpoint bảo mật để frontend gửi danh sách thuốc và nhận lại kết quả tương tác, để tích hợp vào luồng kê đơn hiện tại.

#### Acceptance Criteria

1. THE DrugInteractionController SHALL cung cấp endpoint `POST /api/ai/drug-interactions` yêu cầu Bearer token hợp lệ.
2. WHEN request không có Bearer token hoặc token không hợp lệ, THE DrugInteractionController SHALL trả về HTTP 401.
3. WHEN người dùng đã xác thực nhưng không có role `doctor` (role = 2), THE DrugInteractionController SHALL trả về HTTP 403.
4. WHEN request body thiếu trường `medicines`, hoặc `medicines` không phải array, hoặc `medicines.length < 2`, THE DrugInteractionController SHALL trả về HTTP 400 kèm thông báo lỗi rõ ràng bằng tiếng Việt.
5. WHEN mỗi phần tử trong `medicines` thiếu trường `id` hoặc `name`, THE DrugInteractionController SHALL trả về HTTP 400.
6. WHEN request hợp lệ và kiểm tra thành công, THE DrugInteractionController SHALL trả về HTTP 200 với body `{ success: true, data: { has_interactions, interactions[], summary } }`.
7. THE DrugInteractionController SHALL áp dụng rate limit 30 request/phút per user; WHEN vượt giới hạn, THE DrugInteractionController SHALL trả về HTTP 429.
8. THE DrugInteractionController SHALL không ghi nội dung tên thuốc ra file log để bảo vệ thông tin bệnh nhân.

---

### Requirement 4: Debounce và hủy request phía frontend

**User Story:** Là bác sĩ, tôi muốn hệ thống không gọi API liên tục khi tôi đang thêm nhiều thuốc nhanh, để tránh spinner nhấp nháy và tốn quota không cần thiết.

#### Acceptance Criteria

1. THE useDrugInteractionCheck SHALL chỉ trigger gọi API khi `medicines.length >= 2`.
2. WHEN bác sĩ thêm hoặc xóa thuốc, THE useDrugInteractionCheck SHALL đặt lại timer debounce 800ms; chỉ gọi API sau khi không có thay đổi nào trong 800ms.
3. WHEN danh sách thuốc thay đổi trước khi debounce timer kết thúc, THE useDrugInteractionCheck SHALL hủy timer cũ và bắt đầu timer mới.
4. WHEN một request đang chờ phản hồi và danh sách thuốc thay đổi, THE useDrugInteractionCheck SHALL hủy request đó bằng AbortController trước khi gửi request mới.
5. WHEN component unmount, THE useDrugInteractionCheck SHALL hủy timer debounce và request đang chờ để tránh memory leak.
6. WHEN bác sĩ xóa thuốc khiến đơn còn dưới 2 thuốc, THE useDrugInteractionCheck SHALL xóa kết quả tương tác hiện tại và không gọi API.

---

### Requirement 5: Hiển thị trạng thái kiểm tra inline (InteractionStatusBadge)

**User Story:** Là bác sĩ, tôi muốn thấy trạng thái kiểm tra tương tác ngay trong form kê đơn mà không cần mở modal, để nắm bắt nhanh tình trạng đơn thuốc.

#### Acceptance Criteria

1. WHILE `useDrugInteractionCheck` đang gọi API, THE InteractionStatusBadge SHALL hiển thị spinner kèm text "Đang kiểm tra tương tác...".
2. WHEN kiểm tra hoàn thành và phát hiện tương tác, THE InteractionStatusBadge SHALL hiển thị icon cảnh báo, text "X tương tác" (X là số lượng), và nút "Xem chi tiết".
3. WHEN kiểm tra hoàn thành và không phát hiện tương tác, THE InteractionStatusBadge SHALL hiển thị icon check màu xanh kèm text "Không phát hiện tương tác".
4. WHEN kiểm tra thất bại do lỗi mạng hoặc Gemini error, THE InteractionStatusBadge SHALL hiển thị icon info kèm text "Không thể kiểm tra lúc này".
5. WHEN bác sĩ click nút "Xem chi tiết" trên badge, THE InteractionStatusBadge SHALL mở lại InteractionWarningModal dù bác sĩ đã đóng modal trước đó.
6. WHEN đơn thuốc có dưới 2 thuốc, THE InteractionStatusBadge SHALL không hiển thị (hidden).

---

### Requirement 6: Modal cảnh báo tương tác thuốc (InteractionWarningModal)

**User Story:** Là bác sĩ, tôi muốn xem chi tiết từng cặp tương tác thuốc trong một modal rõ ràng, để hiểu cơ chế và đưa ra quyết định lâm sàng phù hợp.

#### Acceptance Criteria

1. WHEN `useDrugInteractionCheck` phát hiện có tương tác (`has_interactions = true`), THE InteractionWarningModal SHALL tự động mở.
2. THE InteractionWarningModal SHALL hiển thị header gồm icon ⚠️, tiêu đề "Phát hiện tương tác thuốc", và badge số lượng tương tác.
3. THE InteractionWarningModal SHALL hiển thị danh sách từng cặp tương tác, mỗi cặp gồm: badge severity (HIGH=đỏ, MEDIUM=vàng, LOW=xanh), tên 2 thuốc, cơ chế tương tác, hậu quả lâm sàng, và khuyến cáo xử trí.
4. THE InteractionWarningModal SHALL hiển thị footer gồm nút "Đã hiểu, tiếp tục kê đơn" và dòng chú thích "Quyết định cuối cùng thuộc về bác sĩ điều trị".
5. WHEN bác sĩ click nút "Đã hiểu, tiếp tục kê đơn" hoặc nhấn phím Escape, THE InteractionWarningModal SHALL đóng lại mà không chặn bác sĩ tiếp tục kê đơn.
6. WHEN InteractionWarningModal mở, THE InteractionWarningModal SHALL trap focus bên trong modal (không cho tab ra ngoài) để đảm bảo accessibility.
7. THE InteractionWarningModal SHALL được xây dựng trên Radix UI Dialog primitive để đảm bảo focus trap và keyboard navigation chuẩn WCAG.
8. WHEN bác sĩ đóng modal, THE useDrugInteractionCheck SHALL đặt trạng thái `dismissed = true`; badge "X tương tác" vẫn hiển thị để bác sĩ có thể mở lại.

---

### Requirement 7: Tích hợp vào luồng kê đơn hiện tại

**User Story:** Là bác sĩ, tôi muốn tính năng cảnh báo tương tác được tích hợp liền mạch vào màn hình kê đơn hiện tại, để không phải thay đổi thói quen làm việc.

#### Acceptance Criteria

1. THE PrescriptionEditor SHALL tích hợp `useDrugInteractionCheck` nhận vào danh sách thuốc hiện tại trong đơn (`items`).
2. THE PrescriptionEditor SHALL hiển thị `InteractionStatusBadge` trong khu vực kê đơn khi đơn có từ 2 thuốc trở lên.
3. THE PrescriptionEditor SHALL render `InteractionWarningModal` và truyền vào `interactions`, `summary`, và handler `onDismiss`.
4. WHEN bác sĩ xóa thuốc khỏi đơn, THE PrescriptionEditor SHALL truyền danh sách thuốc đã cập nhật vào `useDrugInteractionCheck` để trigger recheck tự động.
5. WHEN tính năng kiểm tra tương tác gặp lỗi bất kỳ, THE PrescriptionEditor SHALL vẫn cho phép bác sĩ lưu và xác nhận đơn thuốc bình thường.

---

### Requirement 8: Service frontend gọi API tương tác thuốc

**User Story:** Là developer, tôi muốn có một service function chuẩn để gọi endpoint kiểm tra tương tác, để đảm bảo nhất quán với các service khác trong codebase.

#### Acceptance Criteria

1. THE aiService SHALL cung cấp method `checkDrugInteractions(medicines)` gọi `POST /api/ai/drug-interactions` thông qua `api.post()` từ `services/api.js`.
2. WHEN gọi `checkDrugInteractions`, THE aiService SHALL truyền `medicines` là array các object `{ id, name, activeIngredient }`.
3. THE aiService SHALL không xử lý debounce hay cache — đó là trách nhiệm của `useDrugInteractionCheck` và `DrugInteractionService`.

---

### Requirement 9: Hiển thị tiếng Việt và accessibility

**User Story:** Là bác sĩ, tôi muốn mọi text trong tính năng cảnh báo đều bằng tiếng Việt và modal có thể thao tác bằng bàn phím, để sử dụng thuận tiện trong môi trường lâm sàng.

#### Acceptance Criteria

1. THE InteractionWarningModal SHALL hiển thị toàn bộ text bằng tiếng Việt, bao gồm tên severity (HIGH → "Nguy hiểm cao", MEDIUM → "Cần chú ý", LOW → "Tham khảo").
2. THE InteractionStatusBadge SHALL hiển thị toàn bộ text bằng tiếng Việt.
3. WHEN InteractionWarningModal mở, THE InteractionWarningModal SHALL nhận focus tự động vào nút "Đã hiểu, tiếp tục kê đơn".
4. WHEN bác sĩ nhấn phím Escape, THE InteractionWarningModal SHALL đóng lại (được xử lý tự động bởi Radix UI Dialog).
5. THE InteractionWarningModal SHALL có `aria-label` hoặc `aria-labelledby` trỏ đến tiêu đề modal để screen reader đọc đúng.
6. WHEN rate limit bị vượt (HTTP 429), THE InteractionStatusBadge SHALL hiển thị text "Thử lại sau" thay vì text lỗi kỹ thuật.
