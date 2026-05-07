# Implementation Plan: AI Medical Record Summary

## Overview

This implementation plan covers the development of the AI Medical Record Summary feature, which provides automated 3-5 line summaries of patient medical histories using Google Gemini AI. The feature extends the existing AI chatbot infrastructure with specialized medical summarization capabilities, implementing a secure read-only architecture with pre-defined queries.

**Key Implementation Areas:**
- Database schema extension (MedicalExaminations table)
- Backend services (medicalSummary.service.js)
- Pre-defined query definitions (8 medical data queries)
- API endpoint and middleware (rate limiting, validation)
- Frontend React component (AISummaryPanel)
- Configuration and environment setup
- Testing (unit and integration tests)

**Technology Stack:** Node.js, Express, Sequelize, MSSQL, Google Gemini API, React 18, Radix UI, Tailwind CSS

## Tasks

- [x] 1. Database schema and migration
  - [x] 1.1 Create database migration for AiSummary fields
    - Create migration file `YYYYMMDDHHMMSS-add-ai-summary-fields.js`
    - Add `AiSummary` (TEXT, nullable) field to MedicalExaminations table
    - Add `AiSummaryGeneratedAt` (DATETIME, nullable) field to MedicalExaminations table
    - Include rollback logic in migration down() method
    - _Requirements: 11.2, 11.3, 11.4_
  
  - [x] 1.2 Update MedicalExamination Sequelize model
    - Add `AiSummary` field definition with DataTypes.TEXT
    - Add `AiSummaryGeneratedAt` field definition with DataTypes.DATE
    - Ensure field names match database column names (case-sensitive)
    - _Requirements: 11.2, 11.3_
  
  - [x] 1.3 Run database migration
    - Execute `npm run db:migrate` to apply schema changes
    - Verify fields added successfully in MSSQL database
    - _Requirements: 11.2_

- [x] 2. Configuration and environment setup
  - [x] 2.1 Add environment variables to .env.example
    - Add `AI_SUMMARY_RATE_LIMIT_PER_PATIENT=10`
    - Add `AI_SUMMARY_RATE_LIMIT_GLOBAL=30`
    - Add `AI_SUMMARY_TIMEOUT_MS=30000`
    - Add `AI_SUMMARY_CACHE_TTL_MS=3600000`
    - Document each variable with inline comments
    - _Requirements: 17.3, 17.4_
  
  - [x] 2.2 Update configuration file (src/config/index.js)
    - Add `ai.summary` configuration object
    - Include `rateLimit.perPatient` and `rateLimit.global` settings
    - Include `timeout` and `cacheTTL` settings
    - Add validation to warn if GEMINI_API_KEY is not set
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6_

- [x] 3. Pre-defined query definitions
  - [x] 3.1 Create medicalSummaryQueries.js configuration file
    - Create file at `src/config/medicalSummaryQueries.js`
    - Define query whitelist array with 8 query definitions
    - Each query must include: id, description, allowedRoles, handler function
    - _Requirements: 3.1, 3.2, 15.1-15.8_
  
  - [x] 3.2 Implement getPatientBasicInfo query
    - Query Patient table for: fullName, dateOfBirth, gender, phone, address, insuranceNumber, allergies, emergencyContact, emergencyPhone
    - Use parameterized query with patientId
    - Return null if patient not found
    - _Requirements: 3.5, 15.1_
  
  - [x] 3.3 Implement getMedicalHistory query
    - Query MedicalExaminations table for last 10 examinations
    - Select: ExaminationDate, Symptoms, Diagnosis, ICD10Code, TreatmentAdvice
    - Order by ExaminationDate DESC, limit 10
    - _Requirements: 15.2_
  
  - [x] 3.4 Implement getChronicDiseases query
    - Query for diagnoses appearing 2+ times in patient history
    - Group by Diagnosis and ICD10Code
    - Return occurrence count for each chronic disease
    - _Requirements: 15.3_
  
  - [x] 3.5 Implement getAllergies query
    - Query Patient table for allergies field
    - Return "Không có dị ứng ghi nhận" if null or empty
    - _Requirements: 15.4_
  
  - [x] 3.6 Implement getRecentLabTests query
    - Query lab test results from last 6 months
    - Select: testName, result, referenceRange, testDate, status
    - Order by testDate DESC
    - _Requirements: 15.5_
  
  - [x] 3.7 Implement getCurrentMedications query
    - Query active prescriptions with medicine details
    - Include: medicine name, dosage, frequency, start date
    - Limit to 5 most recent prescriptions
    - _Requirements: 15.6_
  
  - [x] 3.8 Implement getPreviousDiagnoses query
    - Query all unique diagnoses from MedicalExaminations
    - Select distinct Diagnosis and ICD10Code
    - Filter out null diagnoses
    - _Requirements: 15.7_
  
  - [x] 3.9 Implement getVitalSignsHistory query
    - Query last 5 examinations for vital signs
    - Select: ExaminationDate, BloodPressure, Pulse, Temperature, SpO2, Weight, Height, BMI
    - Order by ExaminationDate DESC, limit 5
    - _Requirements: 15.8_

- [x] 4. Medical Summary Service implementation
  - [x] 4.1 Create medicalSummary.service.js file
    - Create file at `src/services/medicalSummary.service.js`
    - Import dependencies: geminiService, queryHandler, MedicalExamination model, chatLogger
    - Define MEDICAL_SUMMARY_SYSTEM_PROMPT constant with Vietnamese medical instructions
    - _Requirements: 5.1, 6.1-6.6_
  
  - [x] 4.2 Implement generateSummary() method
    - Accept parameters: medicalRecordId, patientId, userId, userRole
    - Check for cached summary first (getCachedSummary)
    - Execute all 8 pre-defined queries in parallel
    - Format query results for AI consumption
    - Call Gemini API with system prompt and formatted data
    - Save summary to MedicalExaminations.AiSummary field
    - Log interaction to AiChatLog table
    - Return summary with metadata (queryIds, generatedAt, remainingRequests)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 11.1, 11.3, 8.1, 8.2_
  
  - [x] 4.3 Implement getCachedSummary() method
    - Query MedicalExaminations for existing AiSummary
    - Check if AiSummaryGeneratedAt is within cache TTL (1 hour)
    - Return cached summary if fresh, null otherwise
    - _Requirements: 13.4_
  
  - [x] 4.4 Implement executeAllQueries() method
    - Execute all 8 queries in parallel using Promise.all()
    - Pass patientId, userId, userRole to each query handler
    - Handle partial query failures gracefully (continue with available data)
    - Return array of query results with query IDs
    - _Requirements: 3.2, 3.3, 12.2_
  
  - [x] 4.5 Implement formatQueryResultsForAI() method
    - Convert query results array to formatted text string
    - Structure data clearly for AI consumption
    - Include section headers for each query type
    - Handle empty or null results gracefully
    - _Requirements: 5.2_
  
  - [x] 4.6 Implement error handling and retry logic
    - Add try-catch blocks for Gemini API calls
    - Implement 3 retries with exponential backoff (2s, 4s, 8s)
    - Handle timeout errors (10 second timeout)
    - Return appropriate error codes for different failure scenarios
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

- [x] 5. Rate limiter middleware
  - [x] 5.1 Create aiSummaryRateLimiter.js middleware
    - Create file at `src/middleware/aiSummaryRateLimiter.js`
    - Use in-memory Map for rate limit tracking
    - Implement automatic cleanup of expired entries
    - _Requirements: 2.1, 2.2_
  
  - [x] 5.2 Implement per-patient rate limiting (10/hour)
    - Track requests per userId:patientId combination
    - Store request timestamps in sliding window
    - Return 429 with RATE_LIMIT_EXCEEDED_PER_PATIENT if limit exceeded
    - Include resetTime in error response
    - _Requirements: 2.1, 2.3, 2.6_
  
  - [x] 5.3 Implement global rate limiting (30/minute)
    - Track requests per userId globally
    - Store request timestamps in sliding window
    - Return 429 with RATE_LIMIT_EXCEEDED_GLOBAL if limit exceeded
    - Include resetTime in error response
    - _Requirements: 2.2, 2.4, 2.7_
  
  - [x] 5.4 Add rate limit headers to responses
    - Include X-RateLimit-Limit header
    - Include X-RateLimit-Remaining header
    - Include X-RateLimit-Reset header
    - Attach remainingRequests to req object for controller use
    - _Requirements: 2.5_

- [x] 6. Input validator
  - [x] 6.1 Create aiSummary.validator.js file
    - Create file at `src/validators/aiSummary.validator.js`
    - Import express-validator functions (body, validationResult)
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_
  
  - [x] 6.2 Implement validateSummarizeRequest validation rules
    - Validate medicalRecordId is integer between 1 and 9223372036854775807
    - Validate patientId is integer between 1 and 9223372036854775807
    - Reject requests with unexpected fields
    - Sanitize string inputs to remove HTML tags
    - Validate Content-Type is application/json
    - _Requirements: 7.2, 7.3, 7.4, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_

- [x] 7. AI controller endpoint
  - [x] 7.1 Add summarizeMedicalRecord endpoint to ai.controller.js
    - Create async function `summarizeMedicalRecord(req, res, next)`
    - Extract medicalRecordId and patientId from req.body
    - Extract userId and userRole from req.user (JWT)
    - Verify user role is doctor (role === 2)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 7.1, 7.2_
  
  - [x] 7.2 Implement medical record validation
    - Query MedicalExaminations to verify record exists
    - Verify record belongs to specified patient
    - Return 404 with RECORD_NOT_FOUND if validation fails
    - _Requirements: 7.5, 7.6_
  
  - [x] 7.3 Call medicalSummary.service.generateSummary()
    - Pass medicalRecordId, patientId, userId, userRole
    - Handle service errors and map to appropriate HTTP status codes
    - Include rate limit info from req.rateLimitInfo in response
    - _Requirements: 5.1, 5.7_
  
  - [x] 7.4 Format and return success response
    - Return HTTP 200 with standardized response format
    - Include: success: true, data: { summary, queryIds, generatedAt, remainingRequests }
    - Use ISO 8601 format for generatedAt timestamp
    - _Requirements: 7.7, 16.1, 16.2, 16.3, 16.4_
  
  - [x] 7.5 Implement error response handling
    - Map service errors to HTTP status codes (401, 403, 404, 429, 500, 503, 504)
    - Return standardized error format: { success: false, error: { code, message, statusCode } }
    - Use Vietnamese error messages for user-facing errors
    - Use UPPER_SNAKE_CASE for error codes
    - _Requirements: 12.1-12.6, 16.2, 16.4, 16.5, 16.6_

- [x] 8. API route registration
  - [x] 8.1 Add route to ai.routes.js
    - Import summarizeMedicalRecord controller
    - Import aiSummaryRateLimiter middleware
    - Import validateSummarizeRequest validator
    - Register POST route: `/summarize-medical-record`
    - Apply middleware chain: auth → rateLimiter → validator → controller
    - _Requirements: 7.1_

- [x] 9. Checkpoint - Backend implementation complete
  - Ensure all backend tests pass
  - Verify database migration applied successfully
  - Test API endpoint with Postman or similar tool
  - Verify rate limiting works correctly
  - Verify authentication and authorization
  - Ask the user if questions arise

- [x] 10. Frontend AI service extension
  - [x] 10.1 Add summarizeMedicalRecord method to ai.service.js
    - Create async function `summarizeMedicalRecord(data)`
    - Accept data object with medicalRecordId and patientId
    - Call `api.post('/ai/summarize-medical-record', data)`
    - Return promise with response data
    - _Requirements: 7.1, 9.1_

- [x] 11. Frontend AISummaryPanel component
  - [x] 11.1 Create AISummaryPanel.jsx component file
    - Create file at `frontend/src/components/medical/AISummaryPanel.jsx`
    - Import required dependencies: React hooks, Radix UI components, lucide-react icons, aiService
    - Define component props: medicalRecordId, patientId, autoTrigger, onSummaryGenerated
    - _Requirements: 9.1, 9.2_
  
  - [x] 11.2 Implement component state management
    - Add state for: summary, loading, error, remainingRequests
    - Implement useEffect for autoTrigger functionality
    - _Requirements: 9.3, 10.1, 10.2, 10.3, 10.4_
  
  - [x] 11.3 Implement handleGenerateSummary function
    - Set loading state to true
    - Call aiService.summarizeMedicalRecord()
    - Update summary and remainingRequests state on success
    - Call onSummaryGenerated callback if provided
    - Show success toast notification
    - Handle errors and display Vietnamese error messages
    - _Requirements: 9.3, 9.4, 9.6_
  
  - [x] 11.4 Implement UI rendering
    - Display "Tóm tắt bệnh án bằng AI" button with Sparkles icon when no summary
    - Show loading skeleton while fetching (3 skeleton lines)
    - Display summary text in purple-themed card with proper line breaks
    - Show error alert with AlertCircle icon if request fails
    - _Requirements: 9.2, 9.3, 9.4, 9.6_
  
  - [x] 11.5 Implement copy-to-clipboard functionality
    - Add "Sao chép" button with Copy icon
    - Use navigator.clipboard.writeText() to copy summary
    - Show success toast on copy
    - _Requirements: 9.5_
  
  - [x] 11.6 Implement regenerate functionality
    - Add "Tạo lại" button with RefreshCw icon
    - Call handleGenerateSummary() on click
    - Show remaining requests count below buttons
    - _Requirements: 11.7_
  
  - [x] 11.7 Apply Radix UI and Tailwind CSS styling
    - Use Card, CardHeader, CardTitle, CardContent components
    - Use Button component with outline variant
    - Use Alert component for errors
    - Use Skeleton component for loading states
    - Apply Tailwind classes for spacing, colors, and layout
    - Ensure consistent styling with existing design system
    - _Requirements: 9.7_

- [x] 12. Frontend integration into examination workflow
  - [x] 12.1 Integrate AISummaryPanel into ExaminationPage
    - Import AISummaryPanel component
    - Add component to examination page layout
    - Pass medicalRecordId and patientId props
    - Position component prominently for doctor visibility
    - _Requirements: 9.1, 10.1_

- [x] 13. Checkpoint - Frontend implementation complete
  - Ensure frontend builds without errors (`npm run build`)
  - Test component in development mode
  - Verify button click triggers API call
  - Verify loading states display correctly
  - Verify error handling works
  - Verify copy and regenerate functionality
  - Ask the user if questions arise

- [x] 14. Unit tests for backend services
  - [ ]* 14.1 Write unit tests for medicalSummary.service.js
    - Test generateSummary() with valid medical record
    - Test getCachedSummary() returns cached data when fresh
    - Test executeAllQueries() executes all 8 queries
    - Test formatQueryResultsForAI() formats data correctly
    - Test error handling for Gemini API failures
    - Test partial query failure handling
    - Mock all external dependencies (Gemini API, database)
    - Target 80%+ code coverage
    - _Requirements: 18.1, 18.2_
  
  - [ ]* 14.2 Write unit tests for aiSummaryRateLimiter middleware
    - Test per-patient limit allows 10 requests then blocks 11th
    - Test global limit allows 30 requests then blocks 31st
    - Test rate limit counters reset after time window
    - Test rate limit headers are included in responses
    - Test multiple users don't interfere with each other's limits
    - _Requirements: 18.4_
  
  - [ ]* 14.3 Write unit tests for aiSummary.validator
    - Test validation accepts valid input
    - Test validation rejects negative integers
    - Test validation rejects non-integer values
    - Test validation rejects unexpected fields
    - Test validation rejects invalid Content-Type
    - _Requirements: 18.3_
  
  - [ ]* 14.4 Write unit tests for pre-defined queries
    - Test each of the 8 query handlers individually
    - Test queries return correct data structure
    - Test queries handle empty results gracefully
    - Test queries use parameterized statements
    - Mock database calls
    - _Requirements: 18.5_

- [x] 15. Integration tests
  - [ ]* 15.1 Write integration test for complete summary flow
    - Create test patient with full medical history
    - Mock Gemini API response
    - Execute POST /api/ai/summarize-medical-record
    - Verify summary generated and saved to database
    - Verify audit log created in AiChatLog table
    - _Requirements: 18.2_
  
  - [ ]* 15.2 Write integration tests for authentication and authorization
    - Test request without JWT returns 401
    - Test request with non-doctor role returns 403
    - Test request with valid doctor JWT succeeds
    - _Requirements: 18.3_
  
  - [ ]* 15.3 Write integration tests for rate limiting
    - Test 11th request for same patient returns 429
    - Test 31st global request returns 429
    - Test rate limits reset correctly
    - _Requirements: 18.4_
  
  - [ ]* 15.4 Write integration tests for error scenarios
    - Test invalid medicalRecordId returns 400
    - Test non-existent record returns 404
    - Test Gemini API failure returns 503
    - Test timeout returns 504
    - _Requirements: 18.3_

- [x] 16. Final checkpoint and documentation
  - Run full test suite: `npm test` in backend directory
  - Verify all tests pass
  - Check test coverage meets 80% minimum
  - Update API documentation with new endpoint
  - Document environment variables in .env.example
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- The implementation follows the existing codebase patterns (Node.js ES Modules, Express, Sequelize, React 18)
- Pre-defined queries ensure read-only access and prevent SQL injection
- Rate limiting prevents abuse and controls API costs
- All Vietnamese text in UI follows existing bilingual codebase conventions
- The feature is designed to be non-blocking - examination workflow continues even if summary generation fails
- Checkpoints ensure incremental validation at major milestones
