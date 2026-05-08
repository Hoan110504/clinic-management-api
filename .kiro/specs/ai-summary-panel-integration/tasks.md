# Implementation Plan: AI Summary Panel Integration

## Overview

This implementation integrates the existing AISummaryPanel component into the DoctorExamination page. The component is already fully built with all functionality (generate summary, copy, regenerate, error handling, loading states). This task focuses on importing the component, placing it in the correct UI location, mapping props correctly from the examination workflow, and adding user preference controls for auto-trigger functionality.

## Tasks

- [x] 1. Import and setup AISummaryPanel component
  - Import AISummaryPanel from `@/components/medical/AISummaryPanel` using named import
  - Verify import path resolves correctly with existing path alias configuration
  - Add data-testid attributes for testing support
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 14.1, 14.2, 14.4_

- [x] 2. Implement auto-trigger preference management
  - [x] 2.1 Create state and localStorage helpers for auto-trigger preference
    - Add state variable for auto-trigger preference (default: false)
    - Create helper functions to read/write `clinic_ai_summary_auto_trigger` from localStorage
    - Initialize state from localStorage on component mount
    - _Requirements: 5.1, 5.2, 5.3, 5.6_
  
  - [x] 2.2 Create auto-trigger toggle UI control
    - Add Radix UI Switch component for toggle control
    - Position toggle near the AI summary panel with label "Tự động tạo tóm tắt"
    - Wire toggle to update both state and localStorage
    - Add data-testid="ai-summary-auto-trigger-toggle" for testing
    - _Requirements: 5.5, 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 14.2_

- [x] 3. Implement props mapping logic
  - [x] 3.1 Extract and validate medicalRecordId
    - Create helper function to extract medicalRecordId from selectedPatient
    - Check fields in priority order: ExaminationID, examinationId, recordId, medicalRecordId, id
    - Validate medicalRecordId is a positive integer
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 16.1_
  
  - [x] 3.2 Extract and validate patientId
    - Create helper function to extract patientId from selectedPatient
    - Check fields in priority order: patientId, PatientId, patient_id
    - Validate patientId is a positive integer
    - _Requirements: 4.1, 4.2, 4.3, 4.5, 16.2_
  
  - [x] 3.3 Implement props validation
    - Validate all props before rendering AISummaryPanel
    - Log validation warnings to console if props are invalid
    - Return null if required props are missing or invalid
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

- [x] 4. Implement conditional rendering logic
  - Create boolean expression to determine when to render AISummaryPanel
  - Check: selectedPatient exists, medicalRecordId is valid, patientId is valid
  - Exclude rendering when examination status is "completed" (status === 2)
  - Exclude rendering when examination status is "cancelled" (status === 3)
  - Include rendering when status is "waiting" (status === 0) or "in-progress" (status === 1)
  - _Requirements: 2.3, 2.4, 15.1, 15.2, 15.3, 15.4, 15.5_

- [x] 5. Integrate AISummaryPanel into patient information section
  - [x] 5.1 Position component in UI
    - Place AISummaryPanel below the patient info card (blue gradient card)
    - Place above the examination form ("Phiếu khám" section)
    - Wrap in conditional rendering based on validation logic from task 4
    - Add data-testid="ai-summary-panel-container" to wrapper div
    - _Requirements: 2.1, 2.2, 2.5, 14.1_
  
  - [x] 5.2 Apply responsive layout styling
    - Use Tailwind CSS responsive classes for layout
    - Full width on mobile (< 768px)
    - Appropriate margins and spacing on tablet/desktop (>= 768px)
    - Ensure consistent spacing with surrounding elements (space-y-6)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [x] 5.3 Pass props to AISummaryPanel
    - Pass medicalRecordId from extraction helper
    - Pass patientId from extraction helper
    - Pass autoTrigger from state (based on user preference)
    - Pass onSummaryGenerated callback function
    - _Requirements: 3.4, 4.4, 5.4, 6.2_

- [x] 6. Implement summary generation callback
  - Define onSummaryGenerated callback function
  - Log summary generation event to console with summary text
  - Wrap callback in try-catch to prevent workflow blocking
  - _Requirements: 6.1, 6.3, 6.4, 6.5_

- [x] 7. Implement state synchronization on patient change
  - Add useEffect to detect selectedPatient changes
  - Force remount of AISummaryPanel by using key prop with selectedPatient.id
  - Ensure medicalRecordId and patientId are updated before rendering
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 8. Add documentation and code comments
  - Add JSDoc comment block explaining the AISummaryPanel integration
  - Document props mapping logic with inline comments
  - Document auto-trigger preference storage mechanism
  - Document conditional rendering logic
  - Add comment referencing requirements document
  - Document known limitations (e.g., requires valid examination record)
  - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.5, 20.6_

- [x] 9. Checkpoint - Verify integration and test manually
  - Ensure all tests pass, ask the user if questions arise.
  - Verify component renders when patient is selected
  - Verify component does not render when no patient is selected
  - Verify auto-trigger toggle works and persists preference
  - Verify summary generation works with manual trigger
  - Verify summary generation works with auto-trigger enabled
  - Verify component updates when switching between patients
  - Test responsive layout on different screen sizes
  - Verify examination workflow continues if summary fails

## Notes

- This is a frontend-only integration task - no backend changes required
- The AISummaryPanel component is already fully implemented and tested
- Backend API endpoint `/api/ai/summarize-medical-record` is already implemented
- Focus on correct props mapping and appropriate UI placement
- The feature should be optional and non-blocking - examination workflow continues even if summary fails
- Auto-trigger functionality is opt-in (disabled by default) to avoid unexpected API calls
- Rate limiting is handled by the backend (10 requests/hour per patient, 30 requests/minute per doctor)
- All Vietnamese text is already implemented in the AISummaryPanel component
- The component uses existing design system (Radix UI, Tailwind CSS, lucide-react)
- Accessibility features (keyboard navigation, ARIA labels, screen reader support) are already built into AISummaryPanel
- Error handling is managed internally by AISummaryPanel component
- Loading states are managed internally by AISummaryPanel component
