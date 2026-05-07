# AI Summary Panel Integration Guide

## Component Location
The AISummaryPanel component has been created at:
`frontend/src/components/medical/AISummaryPanel.jsx`

## Integration Steps for DoctorExamination.jsx

### 1. Import the Component
Add this import at the top of `frontend/src/pages/doctor/DoctorExamination.jsx`:

```javascript
import { AISummaryPanel } from '@/components/medical/AISummaryPanel';
```

### 2. Add the Component to the JSX
The component should be added in a prominent location where doctors can easily see it. Recommended placement options:

#### Option A: After Patient Information Section (Recommended)
Add after the patient information card (around line 4000-4100), before the examination form:

```jsx
{/* AI Summary Panel */}
{selectedPatient && selectedPatient.examinationId && selectedPatient.patientId && (
  <div className="mb-6">
    <AISummaryPanel
      medicalRecordId={selectedPatient.examinationId}
      patientId={selectedPatient.patientId}
      autoTrigger={false}
      onSummaryGenerated={(summary) => {
        console.log('Summary generated:', summary);
      }}
    />
  </div>
)}
```

#### Option B: As a Tab in the Examination Workflow
Add as a new tab alongside "Thông tin bệnh nhân", "Triệu chứng", etc.

### 3. Props Configuration

**Required Props:**
- `medicalRecordId` (number): The examination ID from `selectedPatient.examinationId`
- `patientId` (number): The patient ID from `selectedPatient.patientId`

**Optional Props:**
- `autoTrigger` (boolean): Set to `true` to automatically generate summary when component mounts
- `onSummaryGenerated` (function): Callback function called when summary is successfully generated

### 4. Conditional Rendering
Only show the component when:
- A patient is selected (`selectedPatient` is not null)
- The examination record exists (`selectedPatient.examinationId` is available)
- The user is a doctor (role === 2) - this is already enforced by the API

### 5. Example Integration Code

```jsx
{/* Somewhere in the examination form, after patient info */}
{selectedPatient && (
  <>
    {/* Existing patient information display */}
    <div className="bg-white shadow-sm rounded-lg p-6 mb-6">
      {/* ... existing patient info ... */}
    </div>

    {/* AI Summary Panel - NEW */}
    {selectedPatient.examinationId && selectedPatient.patientId && (
      <div className="mb-6">
        <AISummaryPanel
          medicalRecordId={selectedPatient.examinationId}
          patientId={selectedPatient.patientId}
          autoTrigger={false}
        />
      </div>
    )}

    {/* Rest of examination form */}
    <div className="bg-white shadow-sm rounded-lg p-6">
      {/* ... examination form fields ... */}
    </div>
  </>
)}
```

## Testing the Integration

1. **Start the backend server:**
   ```bash
   cd backend
   npm run dev
   ```

2. **Start the frontend dev server:**
   ```bash
   cd frontend
   npm run dev
   ```

3. **Test the feature:**
   - Log in as a doctor (role = 2)
   - Navigate to the examination page
   - Select a patient with an existing medical record
   - Click "Tạo tóm tắt bệnh án" button
   - Verify the summary is generated and displayed
   - Test the "Sao chép" (copy) button
   - Test the "Tạo lại" (regenerate) button

## Troubleshooting

### Component Not Showing
- Check that `selectedPatient.examinationId` and `selectedPatient.patientId` are defined
- Verify the import path is correct (adjust `@/` alias if needed)
- Check browser console for errors

### API Errors
- Verify backend server is running on port 5000
- Check that GEMINI_API_KEY is set in backend/.env
- Verify the user is logged in as a doctor (role = 2)
- Check backend console for error logs

### Rate Limiting
- The feature has rate limits: 10 requests per hour per patient
- If you hit the limit, wait 1 hour or restart the backend server (in-memory limits will reset)

## Notes

- The component is fully self-contained with its own state management
- It handles loading states, errors, and success states automatically
- The component uses Radix UI and Tailwind CSS, matching the existing design system
- All Vietnamese text is already included in the component
