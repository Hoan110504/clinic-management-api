# Requirements Document

## Introduction

Hệ thống quản lý phòng khám nội khoa hiện tại được xây dựng với React 18, Vite 5, và Tailwind CSS 3, phục vụ 5 vai trò người dùng (admin, receptionist, doctor, pharmacist, patient) với hơn 30 trang giao diện khác nhau. Tuy nhiên, giao diện chưa được tối ưu hóa cho các thiết bị có kích thước màn hình khác nhau, dẫn đến trải nghiệm người dùng kém trên mobile và tablet.

Tính năng Responsive Web Design này sẽ đảm bảo toàn bộ giao diện tự động thích nghi và hiển thị tối ưu trên mọi kích thước màn hình từ điện thoại (320px+), tablet (768px+), laptop (1024px+) đến desktop (1280px+), tuân thủ các nguyên tắc thiết kế responsive hiện đại và tận dụng hệ thống breakpoint của Tailwind CSS.

## Glossary

- **Responsive_Web_Design_System**: Hệ thống thiết kế giao diện web tự động thích nghi theo kích thước màn hình
- **Layout_Engine**: Bộ xử lý bố cục sử dụng CSS Flexbox hoặc Grid
- **Breakpoint_Manager**: Hệ thống quản lý các điểm ngắt (breakpoints) theo kích thước màn hình
- **Mobile_Device**: Thiết bị di động với chiều rộng màn hình từ 320px đến 767px
- **Tablet_Device**: Thiết bị máy tính bảng với chiều rộng màn hình từ 768px đến 1023px
- **Desktop_Device**: Thiết bị máy tính để bàn với chiều rộng màn hình từ 1024px trở lên
- **Viewport**: Vùng hiển thị nội dung trên trình duyệt
- **Media_Query**: Câu truy vấn CSS để áp dụng style theo điều kiện màn hình
- **Fluid_Layout**: Bố cục linh hoạt sử dụng đơn vị tương đối (%, vw, vh)
- **Touch_Target**: Vùng tương tác có thể chạm được trên màn hình cảm ứng (tối thiểu 44x44px)
- **Navigation_Component**: Thành phần điều hướng chính (sidebar, header, menu)
- **Content_Container**: Vùng chứa nội dung chính của trang
- **Data_Table**: Bảng dữ liệu hiển thị thông tin dạng bảng
- **Form_Component**: Thành phần biểu mẫu nhập liệu
- **Chart_Component**: Thành phần biểu đồ trực quan hóa dữ liệu
- **Modal_Dialog**: Hộp thoại hiển thị trên lớp overlay
- **Dropdown_Menu**: Menu thả xuống
- **Card_Component**: Thành phần thẻ hiển thị thông tin tóm tắt
- **Image_Asset**: Tài nguyên hình ảnh (logo, icon, ảnh minh họa)
- **Typography_System**: Hệ thống kiểu chữ (font-size, line-height, font-weight)
- **Spacing_System**: Hệ thống khoảng cách (padding, margin)
- **Tailwind_Breakpoint**: Điểm ngắt được định nghĩa sẵn trong Tailwind CSS (sm: 640px, md: 768px, lg: 1024px, xl: 1280px, 2xl: 1536px)
- **Layout_Component**: Component Layout.jsx hoặc PatientLayout.jsx quản lý cấu trúc trang
- **Page_Component**: Component trang cụ thể trong thư mục pages/
- **UI_Primitive**: Component UI cơ bản từ Radix UI hoặc components/ui/
- **Horizontal_Scroll**: Cuộn ngang khi nội dung vượt quá chiều rộng viewport
- **Content_Overflow**: Tình trạng nội dung tràn ra ngoài vùng chứa
- **Layout_Shift**: Hiện tượng bố cục bị dịch chuyển đột ngột khi tải trang
- **Responsive_Image**: Hình ảnh tự động điều chỉnh kích thước theo container

## Requirements

### Requirement 1: Viewport Configuration

**User Story:** Là một người dùng truy cập hệ thống từ bất kỳ thiết bị nào, tôi muốn giao diện tự động nhận diện và hiển thị đúng tỷ lệ trên màn hình của tôi, để tôi không phải zoom hoặc cuộn ngang để xem nội dung.

#### Acceptance Criteria

1. THE Responsive_Web_Design_System SHALL include viewport meta tag with width=device-width and initial-scale=1.0 in index.html
2. THE Responsive_Web_Design_System SHALL prevent horizontal scrolling on all screen sizes
3. THE Responsive_Web_Design_System SHALL use relative units (rem, em, %, vw, vh) instead of fixed pixel values for sizing where appropriate

### Requirement 2: Breakpoint System Implementation

**User Story:** Là một developer, tôi muốn có hệ thống breakpoint nhất quán, để tôi có thể áp dụng responsive design một cách đồng nhất trên toàn bộ ứng dụng.

#### Acceptance Criteria

1. THE Breakpoint_Manager SHALL define breakpoints matching Tailwind CSS defaults: sm (640px), md (768px), lg (1024px), xl (1280px), 2xl (1536px)
2. WHEN applying responsive styles, THE Responsive_Web_Design_System SHALL use Tailwind CSS responsive prefixes (sm:, md:, lg:, xl:, 2xl:)
3. THE Responsive_Web_Design_System SHALL follow mobile-first approach where base styles apply to mobile and larger breakpoints override
4. WHERE custom breakpoints are needed, THE Responsive_Web_Design_System SHALL extend Tailwind configuration in tailwind.config.js

### Requirement 3: Navigation Component Responsiveness

**User Story:** Là một người dùng trên mobile, tôi muốn menu điều hướng tự động thu gọn và có thể mở/đóng dễ dàng, để tôi có thể truy cập các chức năng mà không bị che khuất màn hình.

#### Acceptance Criteria

1. WHEN viewport width is less than 768px, THE Navigation_Component SHALL display as a collapsible hamburger menu
2. WHEN viewport width is 768px or greater, THE Navigation_Component SHALL display as a fixed sidebar
3. WHEN user clicks hamburger menu icon on Mobile_Device, THE Navigation_Component SHALL toggle between open and closed states
4. THE Navigation_Component SHALL maintain touch-friendly target sizes of at least 44x44 pixels for all interactive elements
5. WHEN Navigation_Component is open on Mobile_Device, THE Navigation_Component SHALL overlay content with a dismissible backdrop
6. THE Navigation_Component SHALL preserve navigation state (expanded/collapsed) when viewport is resized

### Requirement 4: Header Component Responsiveness

**User Story:** Là một người dùng trên mobile, tôi muốn header hiển thị gọn gàng với các thông tin quan trọng nhất, để tôi có thể dễ dàng nhận diện và truy cập các chức năng chính.

#### Acceptance Criteria

1. WHEN viewport width is less than 640px, THE Layout_Component SHALL hide user role label and display only user avatar in header
2. WHEN viewport width is 640px or greater, THE Layout_Component SHALL display both user avatar and full name with role label
3. THE Layout_Component SHALL ensure header height remains fixed at 64px (h-16) across all breakpoints
4. THE Layout_Component SHALL stack header actions vertically on Mobile_Device if horizontal space is insufficient
5. THE Dropdown_Menu in header SHALL adjust positioning to remain within viewport boundaries on all screen sizes

### Requirement 5: Main Content Area Responsiveness

**User Story:** Là một người dùng, tôi muốn vùng nội dung chính tự động điều chỉnh padding và layout phù hợp với kích thước màn hình, để nội dung luôn dễ đọc và không bị chật chội hoặc quá rộng.

#### Acceptance Criteria

1. WHEN viewport width is less than 640px, THE Content_Container SHALL use padding of 16px (p-4)
2. WHEN viewport width is 640px or greater, THE Content_Container SHALL use padding of 24px (p-6)
3. THE Content_Container SHALL adjust left margin based on Navigation_Component state: 0px when sidebar closed, 256px (ml-64) when sidebar open on Desktop_Device
4. THE Content_Container SHALL always use 0px left margin on Mobile_Device and Tablet_Device regardless of sidebar state
5. THE Content_Container SHALL maintain top padding of 64px (pt-16) to account for fixed header across all breakpoints

### Requirement 6: Data Table Responsiveness

**User Story:** Là một người dùng xem bảng dữ liệu trên mobile, tôi muốn bảng tự động điều chỉnh cách hiển thị để tôi có thể xem được thông tin quan trọng mà không bị mất dữ liệu hoặc phải cuộn ngang quá nhiều.

#### Acceptance Criteria

1. WHEN viewport width is less than 768px, THE Data_Table SHALL enable horizontal scrolling with visible scrollbar
2. WHEN viewport width is less than 768px, THE Data_Table SHALL display minimum 2 most important columns and hide less critical columns
3. WHEN viewport width is 768px or greater, THE Data_Table SHALL display all columns without horizontal scrolling
4. THE Data_Table SHALL provide visual indicator (shadow or gradient) when horizontal scrolling is available
5. WHERE Data_Table has many columns, THE Data_Table SHALL implement column toggle feature allowing users to show/hide columns on Mobile_Device
6. THE Data_Table SHALL maintain minimum column width to ensure text readability on all devices

### Requirement 7: Form Component Responsiveness

**User Story:** Là một người dùng điền form trên mobile, tôi muốn các trường nhập liệu và nút bấm có kích thước phù hợp với màn hình cảm ứng, để tôi có thể nhập liệu chính xác và nhanh chóng.

#### Acceptance Criteria

1. WHEN viewport width is less than 768px, THE Form_Component SHALL stack all form fields vertically in single column layout
2. WHEN viewport width is 768px or greater, THE Form_Component SHALL arrange form fields in multi-column grid layout where appropriate
3. THE Form_Component SHALL ensure all input fields have minimum height of 44px for touch accessibility
4. THE Form_Component SHALL ensure all buttons have minimum dimensions of 44x44px for touch accessibility
5. WHEN viewport width is less than 640px, THE Form_Component SHALL display form action buttons (submit, cancel) as full-width stacked buttons
6. WHEN viewport width is 640px or greater, THE Form_Component SHALL display form action buttons inline with appropriate spacing
7. THE Form_Component SHALL adjust label positioning from side-by-side to stacked on Mobile_Device for better readability

### Requirement 8: Modal Dialog Responsiveness

**User Story:** Là một người dùng trên mobile, tôi muốn hộp thoại (modal) tự động điều chỉnh kích thước và vị trí phù hợp với màn hình nhỏ, để tôi có thể xem đầy đủ nội dung và tương tác dễ dàng.

#### Acceptance Criteria

1. WHEN viewport width is less than 640px, THE Modal_Dialog SHALL occupy 95% viewport width with 16px margin on each side
2. WHEN viewport width is 640px or greater, THE Modal_Dialog SHALL use fixed width appropriate to content (e.g., 500px, 700px) and center horizontally
3. WHEN Modal_Dialog height exceeds viewport height, THE Modal_Dialog SHALL enable vertical scrolling within modal content area
4. THE Modal_Dialog SHALL maintain fixed header and footer with scrollable body content on all screen sizes
5. THE Modal_Dialog SHALL ensure close button remains visible and accessible with minimum 44x44px touch target
6. WHEN viewport width is less than 640px, THE Modal_Dialog SHALL stack modal action buttons vertically at full width

### Requirement 9: Chart Component Responsiveness

**User Story:** Là một người dùng xem báo cáo trên mobile, tôi muốn biểu đồ tự động điều chỉnh kích thước và tỷ lệ phù hợp với màn hình, để tôi có thể hiểu được dữ liệu trực quan mà không bị méo hoặc quá nhỏ.

#### Acceptance Criteria

1. THE Chart_Component SHALL use ResponsiveContainer from Recharts with width="100%" and height responsive to viewport
2. WHEN viewport width is less than 640px, THE Chart_Component SHALL set minimum height of 250px for readability
3. WHEN viewport width is 640px or greater, THE Chart_Component SHALL set height of 300px or greater based on content
4. THE Chart_Component SHALL adjust font sizes for axis labels and legends proportionally to viewport size
5. WHEN viewport width is less than 640px, THE Chart_Component SHALL rotate x-axis labels or reduce label frequency to prevent overlap
6. THE Chart_Component SHALL maintain aspect ratio to prevent distortion when container resizes

### Requirement 10: Card Component Responsiveness

**User Story:** Là một người dùng xem dashboard, tôi muốn các thẻ thông tin tự động sắp xếp lại theo số cột phù hợp với màn hình, để tôi có thể xem được nhiều thông tin nhất có thể mà không bị chật chội.

#### Acceptance Criteria

1. WHEN viewport width is less than 640px, THE Card_Component SHALL display in single column layout (grid-cols-1)
2. WHEN viewport width is between 640px and 1023px, THE Card_Component SHALL display in 2-column layout (sm:grid-cols-2)
3. WHEN viewport width is 1024px or greater, THE Card_Component SHALL display in 3 or 4-column layout (lg:grid-cols-3 or lg:grid-cols-4) based on content density
4. THE Card_Component SHALL maintain consistent padding and spacing that scales with viewport size
5. THE Card_Component SHALL ensure text content wraps properly and does not overflow card boundaries on any screen size

### Requirement 11: Typography Responsiveness

**User Story:** Là một người dùng, tôi muốn kích thước chữ tự động điều chỉnh phù hợp với màn hình, để tôi có thể đọc nội dung dễ dàng mà không phải zoom hoặc nheo mắt.

#### Acceptance Criteria

1. WHEN viewport width is less than 640px, THE Typography_System SHALL use base font size of 14px (text-sm) for body text
2. WHEN viewport width is 640px or greater, THE Typography_System SHALL use base font size of 16px (text-base) for body text
3. THE Typography_System SHALL scale heading sizes proportionally across breakpoints (e.g., h1: text-2xl on mobile, text-3xl on tablet, text-4xl on desktop)
4. THE Typography_System SHALL maintain line-height ratio between 1.4 and 1.6 for optimal readability on all screen sizes
5. THE Typography_System SHALL ensure minimum font size of 12px for any text to maintain readability

### Requirement 12: Spacing System Responsiveness

**User Story:** Là một developer, tôi muốn có hệ thống khoảng cách nhất quán tự động điều chỉnh theo màn hình, để giao diện luôn cân đối và không bị chật hoặc thừa khoảng trống.

#### Acceptance Criteria

1. THE Spacing_System SHALL use Tailwind CSS spacing scale (0, 1, 2, 3, 4, 6, 8, 12, 16, 24, 32) consistently across all components
2. WHEN viewport width is less than 640px, THE Spacing_System SHALL reduce gap between elements by one scale step (e.g., gap-6 becomes gap-4)
3. WHEN viewport width is less than 640px, THE Spacing_System SHALL reduce section padding by one scale step (e.g., p-6 becomes p-4)
4. THE Spacing_System SHALL maintain minimum touch target spacing of 8px between interactive elements on Mobile_Device

### Requirement 13: Image Responsiveness

**User Story:** Là một người dùng, tôi muốn hình ảnh tự động điều chỉnh kích thước phù hợp với màn hình mà không bị méo hoặc tràn ra ngoài, để giao diện luôn đẹp và chuyên nghiệp.

#### Acceptance Criteria

1. THE Responsive_Image SHALL use max-width: 100% and height: auto to maintain aspect ratio
2. THE Responsive_Image SHALL use object-fit: cover or object-fit: contain appropriately based on use case
3. WHERE Image_Asset is decorative, THE Responsive_Image SHALL hide on Mobile_Device to save space and bandwidth
4. THE Responsive_Image SHALL use appropriate image formats (WebP with fallback) and sizes for different screen densities
5. THE Responsive_Image SHALL prevent Layout_Shift by specifying width and height attributes or using aspect-ratio CSS

### Requirement 14: Touch Interaction Optimization

**User Story:** Là một người dùng trên thiết bị cảm ứng, tôi muốn tất cả các nút bấm và vùng tương tác có kích thước đủ lớn, để tôi có thể chạm chính xác mà không bị nhầm lẫn.

#### Acceptance Criteria

1. THE Responsive_Web_Design_System SHALL ensure all interactive elements (buttons, links, inputs) have minimum Touch_Target size of 44x44 pixels on Mobile_Device
2. THE Responsive_Web_Design_System SHALL provide minimum 8px spacing between adjacent Touch_Target elements
3. THE Responsive_Web_Design_System SHALL use hover states only on Desktop_Device and use active/focus states on Mobile_Device
4. THE Responsive_Web_Design_System SHALL disable hover-triggered dropdowns on Mobile_Device and use click/tap instead

### Requirement 15: Performance Optimization for Mobile

**User Story:** Là một người dùng trên mobile với kết nối chậm, tôi muốn trang web tải nhanh và mượt mà, để tôi không phải chờ đợi lâu hoặc gặp giật lag.

#### Acceptance Criteria

1. THE Responsive_Web_Design_System SHALL lazy load images and heavy components below the fold
2. THE Responsive_Web_Design_System SHALL minimize CSS bundle size by purging unused Tailwind classes in production build
3. THE Responsive_Web_Design_System SHALL avoid Layout_Shift by reserving space for dynamic content during loading
4. THE Responsive_Web_Design_System SHALL use CSS transforms and opacity for animations instead of layout properties (width, height, top, left) for better performance
5. WHERE complex Data_Table or Chart_Component exists, THE Responsive_Web_Design_System SHALL implement virtualization or pagination on Mobile_Device to reduce DOM nodes

### Requirement 16: Cross-Browser Compatibility

**User Story:** Là một người dùng sử dụng nhiều trình duyệt khác nhau, tôi muốn giao diện hiển thị nhất quán trên tất cả các trình duyệt phổ biến, để tôi có trải nghiệm đồng nhất bất kể tôi dùng trình duyệt nào.

#### Acceptance Criteria

1. THE Responsive_Web_Design_System SHALL display correctly on Chrome, Firefox, Safari, and Edge browsers (latest 2 versions)
2. THE Responsive_Web_Design_System SHALL use CSS autoprefixer to add vendor prefixes for cross-browser compatibility
3. THE Responsive_Web_Design_System SHALL test and verify responsive behavior on iOS Safari and Chrome for Android
4. WHERE CSS features have limited browser support, THE Responsive_Web_Design_System SHALL provide fallback styles

### Requirement 17: Accessibility Compliance

**User Story:** Là một người dùng có khuyết tật, tôi muốn giao diện responsive vẫn đảm bảo khả năng truy cập, để tôi có thể sử dụng hệ thống với công cụ hỗ trợ của mình.

#### Acceptance Criteria

1. THE Responsive_Web_Design_System SHALL maintain semantic HTML structure across all breakpoints
2. THE Responsive_Web_Design_System SHALL ensure focus indicators remain visible on all interactive elements across all screen sizes
3. WHEN Navigation_Component changes layout for Mobile_Device, THE Responsive_Web_Design_System SHALL update ARIA attributes appropriately (aria-expanded, aria-hidden)
4. THE Responsive_Web_Design_System SHALL maintain keyboard navigation functionality across all breakpoints
5. THE Responsive_Web_Design_System SHALL ensure color contrast ratios meet WCAG 2.1 AA standards (4.5:1 for normal text) on all screen sizes

### Requirement 18: Layout Component Adaptation

**User Story:** Là một developer, tôi muốn Layout.jsx và PatientLayout.jsx tự động điều chỉnh cấu trúc theo màn hình, để tất cả các trang kế thừa layout đều responsive mà không cần code thêm.

#### Acceptance Criteria

1. THE Layout_Component SHALL implement responsive sidebar that collapses to hamburger menu on Mobile_Device
2. THE Layout_Component SHALL adjust main content margin-left based on sidebar state and viewport width
3. THE Layout_Component SHALL ensure header remains fixed at top with z-index higher than content across all breakpoints
4. THE Layout_Component SHALL implement responsive user menu dropdown that adjusts position to stay within viewport
5. THE Layout_Component SHALL apply consistent responsive patterns that all Page_Component instances inherit automatically

### Requirement 19: Page-Specific Responsive Patterns

**User Story:** Là một người dùng truy cập các trang khác nhau trong hệ thống, tôi muốn mỗi trang tự động tối ưu layout riêng phù hợp với nội dung và màn hình, để tôi có trải nghiệm tốt nhất cho từng chức năng.

#### Acceptance Criteria

1. WHEN Page_Component contains dashboard with multiple Card_Component, THE Page_Component SHALL use responsive grid with appropriate column counts per breakpoint
2. WHEN Page_Component contains Data_Table, THE Page_Component SHALL implement horizontal scroll on Mobile_Device with sticky first column where appropriate
3. WHEN Page_Component contains Form_Component, THE Page_Component SHALL stack form sections vertically on Mobile_Device and use multi-column on Desktop_Device
4. WHEN Page_Component contains Chart_Component, THE Page_Component SHALL adjust chart height and legend position based on viewport width
5. THE Page_Component SHALL ensure page title and action buttons remain accessible and properly sized on all screen sizes

### Requirement 20: Testing and Validation

**User Story:** Là một QA tester, tôi muốn có quy trình kiểm tra responsive design rõ ràng, để tôi có thể xác nhận giao diện hoạt động đúng trên tất cả các thiết bị mục tiêu.

#### Acceptance Criteria

1. THE Responsive_Web_Design_System SHALL be tested at minimum breakpoints: 320px, 375px, 768px, 1024px, 1280px, 1920px
2. THE Responsive_Web_Design_System SHALL verify no Content_Overflow or Horizontal_Scroll occurs at any tested breakpoint
3. THE Responsive_Web_Design_System SHALL verify all interactive elements meet minimum Touch_Target size on Mobile_Device
4. THE Responsive_Web_Design_System SHALL verify text remains readable without zoom at all breakpoints
5. THE Responsive_Web_Design_System SHALL verify images maintain aspect ratio and do not cause Layout_Shift at all breakpoints
6. THE Responsive_Web_Design_System SHALL test orientation changes (portrait to landscape) on Mobile_Device and Tablet_Device
7. THE Responsive_Web_Design_System SHALL verify responsive behavior in browser DevTools device emulation and on real devices

## Notes

- Hệ thống đã có Tailwind CSS 3 được cấu hình sẵn, nên tận dụng tối đa utility classes và responsive prefixes của Tailwind
- Radix UI primitives đã được sử dụng cho các UI components, cần đảm bảo responsive behavior tương thích với Radix
- Recharts được sử dụng cho biểu đồ, cần sử dụng ResponsiveContainer wrapper
- Hệ thống có 5 roles với layout và pages khác nhau, cần đảm bảo responsive patterns nhất quán cho tất cả
- Ưu tiên mobile-first approach: viết styles cho mobile trước, sau đó override cho màn hình lớn hơn
- Tránh sử dụng fixed width (w-[500px]), thay vào đó dùng max-width (max-w-md, max-w-lg) để linh hoạt hơn
- Sử dụng container queries nếu cần responsive dựa trên kích thước container thay vì viewport
