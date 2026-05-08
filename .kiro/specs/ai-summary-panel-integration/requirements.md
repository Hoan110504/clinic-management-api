# Requirements Document: AI Summary Panel Integration

## Introduction

Tính năng **AI Summary Panel Integration** (Tích hợp Panel Tóm tắt AI) tích hợp component AISummaryPanel đã có sẵn vào quy trình khám bệnh của bác sĩ tại trang DoctorExamination. Tính năng này cho phép bác sĩ xem tóm tắt lịch sử bệnh án của bệnh nhân được tạo bởi AI ngay trong giao diện khám bệnh, giúp bác sĩ nhanh chóng nắm bắt thông tin quan trọng trước khi bắt đầu khám.

Component AISummaryPanel đã được xây dựng hoàn chỉnh với đầy đủ chức năng (tạo tóm tắt, sao chép, tạo lại, xử lý lỗi, loading states). Backend API cho AI medical summary cũng đã được triển khai đầy đủ theo spec ai-medical-summary. Tính năng này tập trung vào việc tích hợp component vào đúng vị trí trong workflow và đảm bảo truyền props chính xác.

## Glossary

- **AISummaryPanel**: React component hiển thị tóm tắt bệnh án bằng AI, đã được xây dựng tại `frontend/src/components/medical/AISummaryPanel.jsx`
- **DoctorExamination**: Trang khám bệnh của bác sĩ tại `frontend/src/pages/doctor/DoctorExamination.jsx`
- **Doctor**: Bác sĩ (role = 2), người dùng sử dụng trang khám bệnh
- **Patient**: Bệnh nhân đang được khám
- **Medical_Record**: Hồ sơ khám bệnh (MedicalExamination record)
- **Examination_Workflow**: Quy trình khám bệnh bao gồm các bước: chọn bệnh nhân, nhập triệu chứng, chỉ định xét nghiệm, kê đơn thuốc
- **Auto_Trigger**: Chế độ tự động tạo tóm tắt khi bác sĩ bắt đầu khám bệnh nhân
- **Component_Props**: Các thuộc tính truyền vào component React (medicalRecordId, patientId, autoTrigger, onSummaryGenerated)
- **Integration_Point**: Vị trí trong UI nơi component AISummaryPanel được hiển thị

## Requirements

### Requirement 1: Component Import and Setup

**User Story:** As a frontend developer, I want to import the AISummaryPanel component into DoctorExamination page, so that I can use it in the examination workflow.

#### Acceptance Criteria

1. THE DoctorExamination SHALL import AISummaryPanel component from `@/components/medical/AISummaryPanel`
2. THE DoctorExamination SHALL import the component using named import syntax: `import { AISummaryPanel } from '@/components/medical/AISummaryPanel'`
3. THE DoctorExamination SHALL NOT modify the AISummaryPanel component source code during integration
4. THE DoctorExamination SHALL ensure the import path resolves correctly using the existing path alias configuration

### Requirement 2: Component Placement in UI

**User Story:** As a doctor, I want to see the AI summary panel in a prominent location on the examination page, so that I can easily access patient summaries while examining.

#### Acceptance Criteria

1. THE DoctorExamination SHALL display AISummaryPanel in the patient information section
2. THE DoctorExamination SHALL position AISummaryPanel below the patient basic information (name, age, gender, contact) and above the examination form
3. THE DoctorExamination SHALL display AISummaryPanel only when a patient is selected for examination
4. WHEN no patient is selected, THE DoctorExamination SHALL NOT render AISummaryPanel
5. THE DoctorExamination SHALL ensure AISummaryPanel is visible without requiring scrolling when patient information is displayed
6. THE DoctorExamination SHALL maintain consistent spacing and alignment with surrounding UI elements

### Requirement 3: Props Mapping - Medical Record ID

**User Story:** As a frontend developer, I want to correctly pass the medical record ID to AISummaryPanel, so that the component can fetch the correct summary.

#### Acceptance Criteria

1. THE DoctorExamination SHALL extract medicalRecordId from selectedPatient state
2. THE DoctorExamination SHALL map medicalRecordId from one of the following fields in priority order: `selectedPatient.ExaminationID`, `selectedPatient.examinationId`, `selectedPatient.recordId`, `selectedPatient.medicalRecordId`, `selectedPatient.id`
3. THE DoctorExamination SHALL pass medicalRecordId as a numeric prop to AISummaryPanel
4. IF medicalRecordId cannot be resolved from selectedPatient, THEN THE DoctorExamination SHALL NOT render AISummaryPanel
5. THE DoctorExamination SHALL ensure medicalRecordId is a valid positive integer before passing to AISummaryPanel

### Requirement 4: Props Mapping - Patient ID

**User Story:** As a frontend developer, I want to correctly pass the patient ID to AISummaryPanel, so that the component can verify patient data access.

#### Acceptance Criteria

1. THE DoctorExamination SHALL extract patientId from selectedPatient state
2. THE DoctorExamination SHALL map patientId from one of the following fields in priority order: `selectedPatient.patientId`, `selectedPatient.PatientId`, `selectedPatient.patient_id`
3. THE DoctorExamination SHALL pass patientId as a numeric prop to AISummaryPanel
4. IF patientId cannot be resolved from selectedPatient, THEN THE DoctorExamination SHALL NOT render AISummaryPanel
5. THE DoctorExamination SHALL ensure patientId is a valid positive integer before passing to AISummaryPanel

### Requirement 5: Auto-Trigger Configuration

**User Story:** As a doctor, I want the option to automatically generate AI summaries when I start examining a patient, so that I don't have to manually click the button every time.

#### Acceptance Criteria

1. THE DoctorExamination SHALL provide a user preference setting to enable or disable auto-trigger functionality
2. THE DoctorExamination SHALL store the auto-trigger preference in browser localStorage with key `clinic_ai_summary_auto_trigger`
3. THE DoctorExamination SHALL default auto-trigger to `false` (disabled) for first-time users
4. THE DoctorExamination SHALL pass the autoTrigger prop to AISummaryPanel based on the stored preference
5. THE DoctorExamination SHALL provide a toggle control in the UI to change the auto-trigger preference
6. WHEN auto-trigger is enabled and a patient is selected, THE AISummaryPanel SHALL automatically generate a summary
7. WHEN auto-trigger is disabled, THE AISummaryPanel SHALL only show the manual trigger button

### Requirement 6: Summary Generated Callback

**User Story:** As a frontend developer, I want to handle the summary generation event, so that I can update the UI or perform additional actions when a summary is created.

#### Acceptance Criteria

1. THE DoctorExamination SHALL define an onSummaryGenerated callback function
2. THE DoctorExamination SHALL pass the onSummaryGenerated callback to AISummaryPanel as a prop
3. WHEN AISummaryPanel generates a summary, THE callback SHALL receive the summary text as a parameter
4. THE DoctorExamination SHALL log the summary generation event to browser console for debugging
5. THE DoctorExamination SHALL NOT block the examination workflow if the callback fails

### Requirement 7: Responsive Layout Integration

**User Story:** As a doctor using different screen sizes, I want the AI summary panel to display properly on all devices, so that I can use it on desktop, tablet, or mobile.

#### Acceptance Criteria

1. THE DoctorExamination SHALL ensure AISummaryPanel is responsive and adapts to screen width
2. THE DoctorExamination SHALL use Tailwind CSS responsive classes to control AISummaryPanel layout
3. WHEN screen width is less than 768px (mobile), THE AISummaryPanel SHALL display full width
4. WHEN screen width is 768px or greater (tablet/desktop), THE AISummaryPanel SHALL display with appropriate margins and max-width
5. THE DoctorExamination SHALL ensure AISummaryPanel does not overlap with other UI elements at any screen size
6. THE DoctorExamination SHALL maintain readability of summary text on all screen sizes

### Requirement 8: State Synchronization

**User Story:** As a doctor, I want the AI summary panel to update when I switch between patients, so that I always see the correct patient's summary.

#### Acceptance Criteria

1. WHEN selectedPatient changes, THE DoctorExamination SHALL unmount and remount AISummaryPanel with new props
2. THE DoctorExamination SHALL clear any previous summary state when switching patients
3. THE DoctorExamination SHALL ensure medicalRecordId and patientId props are updated before rendering AISummaryPanel
4. THE DoctorExamination SHALL NOT display stale summary data from a previous patient
5. WHEN switching patients with auto-trigger enabled, THE AISummaryPanel SHALL automatically generate a new summary for the new patient

### Requirement 9: Error Handling Integration

**User Story:** As a doctor, I want to see clear error messages if the AI summary fails, so that I understand what went wrong and can continue my work.

#### Acceptance Criteria

1. THE DoctorExamination SHALL allow AISummaryPanel to handle its own errors internally
2. THE DoctorExamination SHALL NOT wrap AISummaryPanel in additional error boundaries that would hide component errors
3. THE DoctorExamination SHALL ensure examination workflow continues even if AISummaryPanel encounters errors
4. THE DoctorExamination SHALL NOT disable examination form inputs when AISummaryPanel is loading or has errors
5. THE DoctorExamination SHALL log AISummaryPanel errors to browser console for debugging

### Requirement 10: Performance Optimization

**User Story:** As a doctor, I want the examination page to load quickly, so that I can start examining patients without delay.

#### Acceptance Criteria

1. THE DoctorExamination SHALL lazy-load AISummaryPanel only when a patient is selected
2. THE DoctorExamination SHALL NOT fetch AI summaries until AISummaryPanel is rendered
3. THE DoctorExamination SHALL ensure AISummaryPanel loading state does not block rendering of other examination page elements
4. THE DoctorExamination SHALL limit re-renders of AISummaryPanel by using React.memo or useMemo for props
5. THE DoctorExamination SHALL ensure page remains responsive while AISummaryPanel is fetching data

### Requirement 11: Accessibility Compliance

**User Story:** As a doctor with accessibility needs, I want the AI summary panel to be accessible, so that I can use it with screen readers or keyboard navigation.

#### Acceptance Criteria

1. THE DoctorExamination SHALL ensure AISummaryPanel is keyboard accessible (tab navigation works)
2. THE DoctorExamination SHALL ensure AISummaryPanel buttons have proper ARIA labels
3. THE DoctorExamination SHALL ensure AISummaryPanel loading state is announced to screen readers
4. THE DoctorExamination SHALL ensure AISummaryPanel error messages are announced to screen readers
5. THE DoctorExamination SHALL maintain proper focus management when AISummaryPanel is rendered or updated

### Requirement 12: Visual Design Consistency

**User Story:** As a doctor, I want the AI summary panel to match the existing design system, so that the interface feels cohesive and professional.

#### Acceptance Criteria

1. THE DoctorExamination SHALL ensure AISummaryPanel uses the same Radix UI components as the rest of the page
2. THE DoctorExamination SHALL ensure AISummaryPanel uses consistent Tailwind CSS color classes (purple theme for AI features)
3. THE DoctorExamination SHALL ensure AISummaryPanel card styling matches other cards on the examination page
4. THE DoctorExamination SHALL ensure AISummaryPanel spacing and typography are consistent with the design system
5. THE DoctorExamination SHALL ensure AISummaryPanel icons (Sparkles, Copy, RefreshCw) are from lucide-react library

### Requirement 13: Auto-Trigger UI Control

**User Story:** As a doctor, I want a toggle switch to enable or disable auto-summary generation, so that I can control when summaries are created.

#### Acceptance Criteria

1. THE DoctorExamination SHALL display a toggle switch labeled "Tự động tạo tóm tắt" near the AISummaryPanel
2. THE DoctorExamination SHALL use Radix UI Switch component for the toggle control
3. WHEN the toggle is clicked, THE DoctorExamination SHALL update the localStorage preference
4. WHEN the toggle is clicked, THE DoctorExamination SHALL update the autoTrigger prop passed to AISummaryPanel
5. THE DoctorExamination SHALL display the current toggle state (on/off) visually
6. THE DoctorExamination SHALL persist the toggle state across page refreshes

### Requirement 14: Integration Testing Support

**User Story:** As a QA engineer, I want the integrated component to have proper test IDs, so that I can write automated tests for the AI summary feature.

#### Acceptance Criteria

1. THE DoctorExamination SHALL add a data-testid attribute to the AISummaryPanel container: `data-testid="ai-summary-panel-container"`
2. THE DoctorExamination SHALL add a data-testid attribute to the auto-trigger toggle: `data-testid="ai-summary-auto-trigger-toggle"`
3. THE DoctorExamination SHALL ensure AISummaryPanel component has internal test IDs for its buttons and content
4. THE DoctorExamination SHALL ensure test IDs are unique and do not conflict with other page elements
5. THE DoctorExamination SHALL document test IDs in code comments for QA reference

### Requirement 15: Conditional Rendering Logic

**User Story:** As a frontend developer, I want clear conditional rendering logic, so that the component only displays when appropriate.

#### Acceptance Criteria

1. THE DoctorExamination SHALL render AISummaryPanel only when all of the following conditions are met: selectedPatient is not null, medicalRecordId is valid, patientId is valid
2. THE DoctorExamination SHALL NOT render AISummaryPanel when the examination is in "completed" status
3. THE DoctorExamination SHALL NOT render AISummaryPanel when the examination is in "cancelled" status
4. THE DoctorExamination SHALL render AISummaryPanel when the examination is in "waiting" or "in-progress" status
5. THE DoctorExamination SHALL use clear boolean expressions for conditional rendering (avoid nested ternaries)

### Requirement 16: Props Validation

**User Story:** As a frontend developer, I want to validate props before passing them to AISummaryPanel, so that I catch errors early and prevent runtime issues.

#### Acceptance Criteria

1. THE DoctorExamination SHALL validate medicalRecordId is a number and greater than 0 before passing to AISummaryPanel
2. THE DoctorExamination SHALL validate patientId is a number and greater than 0 before passing to AISummaryPanel
3. THE DoctorExamination SHALL validate autoTrigger is a boolean before passing to AISummaryPanel
4. THE DoctorExamination SHALL validate onSummaryGenerated is a function before passing to AISummaryPanel
5. IF any prop validation fails, THEN THE DoctorExamination SHALL log a warning to console and NOT render AISummaryPanel
6. THE DoctorExamination SHALL use PropTypes or TypeScript for compile-time prop validation

### Requirement 17: Summary Display Persistence

**User Story:** As a doctor, I want to see the previously generated summary when I return to a patient, so that I don't have to regenerate it every time.

#### Acceptance Criteria

1. THE AISummaryPanel SHALL display the cached summary from the backend if it exists
2. THE DoctorExamination SHALL NOT clear the summary when navigating away from a patient and returning
3. THE DoctorExamination SHALL allow the doctor to regenerate the summary using the "Tạo lại" button
4. THE DoctorExamination SHALL ensure the summary is associated with the correct medicalRecordId
5. THE DoctorExamination SHALL display the summary generation timestamp if available

### Requirement 18: Loading State Coordination

**User Story:** As a doctor, I want to see a loading indicator while the AI summary is being generated, so that I know the system is working.

#### Acceptance Criteria

1. THE AISummaryPanel SHALL display a skeleton loader while fetching the summary
2. THE DoctorExamination SHALL NOT display a separate loading overlay for AISummaryPanel
3. THE DoctorExamination SHALL ensure other page elements remain interactive while AISummaryPanel is loading
4. THE DoctorExamination SHALL ensure the loading state does not cause layout shift
5. THE AISummaryPanel SHALL display loading state for a maximum of 10 seconds before timing out

### Requirement 19: Copy to Clipboard Integration

**User Story:** As a doctor, I want to copy the AI summary to clipboard, so that I can paste it into the diagnosis or treatment notes.

#### Acceptance Criteria

1. THE AISummaryPanel SHALL provide a "Sao chép" button to copy summary text
2. WHEN the copy button is clicked, THE AISummaryPanel SHALL copy the summary text to clipboard
3. WHEN copy succeeds, THE AISummaryPanel SHALL display a success toast notification
4. WHEN copy fails, THE AISummaryPanel SHALL display an error toast notification
5. THE DoctorExamination SHALL ensure clipboard API is available in the browser environment

### Requirement 20: Documentation and Code Comments

**User Story:** As a frontend developer, I want clear documentation for the integration, so that I can maintain and extend the feature in the future.

#### Acceptance Criteria

1. THE DoctorExamination SHALL include JSDoc comments explaining the AISummaryPanel integration
2. THE DoctorExamination SHALL document the props mapping logic with inline comments
3. THE DoctorExamination SHALL document the auto-trigger preference storage mechanism
4. THE DoctorExamination SHALL document the conditional rendering logic
5. THE DoctorExamination SHALL include a code comment referencing this requirements document
6. THE DoctorExamination SHALL document any known limitations or edge cases

---

## Notes

- This feature is purely a frontend integration task - no backend changes are required
- The AISummaryPanel component is already fully implemented and tested
- The backend API endpoint `/api/ai/summarize-medical-record` is already implemented per spec ai-medical-summary
- The integration should be minimal and non-invasive to the existing examination workflow
- Focus on correct props mapping and appropriate UI placement
- The feature should be optional and non-blocking - examination workflow continues even if summary fails
- Auto-trigger functionality should be opt-in (disabled by default) to avoid unexpected API calls
- The component uses existing design system components (Radix UI, Tailwind CSS, lucide-react)
- Rate limiting is handled by the backend (10 requests/hour per patient, 30 requests/minute per doctor)
- All Vietnamese text is already implemented in the AISummaryPanel component
