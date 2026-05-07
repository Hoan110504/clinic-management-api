# Requirements Document: AI Medical Record Summary

## Introduction

Tính năng **AI Medical Record Summary** (Tóm tắt Bệnh án bằng AI) cung cấp khả năng tự động tóm tắt lịch sử bệnh án của bệnh nhân thành 3-5 dòng ngắn gọn, chuyên nghiệp để hỗ trợ bác sĩ trước khi bắt đầu khám bệnh. Hệ thống sử dụng AI (Google Gemini) với kiến trúc bảo mật cao, chỉ cho phép đọc dữ liệu thông qua các pre-defined queries đã được whitelist, đảm bảo AI không thể thực hiện bất kỳ thao tác ghi nào.

Tính năng này tích hợp vào quy trình khám bệnh hiện tại, giúp bác sĩ nhanh chóng nắm bắt thông tin quan trọng về bệnh nhân mà không cần đọc toàn bộ hồ sơ bệnh án.

## Glossary

- **AI_Summary_System**: Hệ thống tóm tắt bệnh án bằng AI, bao gồm backend API, AI service, và frontend components
- **Doctor**: Bác sĩ (role = 2), người dùng duy nhất được phép sử dụng tính năng này
- **Medical_Record**: Hồ sơ bệnh án của bệnh nhân, bao gồm thông tin cá nhân, lịch sử khám bệnh, đơn thuốc, kết quả xét nghiệm
- **Pre_Defined_Query**: Các truy vấn dữ liệu đã được định nghĩa trước và whitelist, AI chỉ được chọn từ danh sách này
- **Summary_Text**: Văn bản tóm tắt 3-5 dòng được AI tạo ra, sử dụng ngôn ngữ y khoa chuyên nghiệp bằng tiếng Việt
- **Rate_Limiter**: Cơ chế giới hạn số lượng request để ngăn chặn lạm dụng
- **JWT_Token**: JSON Web Token dùng để xác thực và phân quyền người dùng
- **Gemini_Service**: Dịch vụ AI của Google (Google Gemini API) được sử dụng để tạo tóm tắt
- **Query_Handler**: Service xử lý việc thực thi các pre-defined queries
- **Examination_Record**: Phiếu khám bệnh (MedicalExamination), chứa thông tin về một lần khám cụ thể
- **Patient**: Bệnh nhân, đối tượng có hồ sơ bệnh án cần được tóm tắt

## Requirements

### Requirement 1: Authentication and Authorization

**User Story:** As a system administrator, I want only doctors to access the AI summary feature, so that patient data remains secure and compliant with medical privacy regulations.

#### Acceptance Criteria

1. WHEN a user requests AI summary, THE AI_Summary_System SHALL verify the JWT_Token is valid and not expired
2. WHEN a user requests AI summary, THE AI_Summary_System SHALL verify the user role equals Doctor (role = 2)
3. IF the JWT_Token is invalid or expired, THEN THE AI_Summary_System SHALL return HTTP 401 with error code "UNAUTHORIZED"
4. IF the user role is not Doctor, THEN THE AI_Summary_System SHALL return HTTP 403 with error code "FORBIDDEN"
5. THE AI_Summary_System SHALL extract user ID and role from the JWT_Token for audit logging

### Requirement 2: Rate Limiting and Anti-Abuse

**User Story:** As a system administrator, I want to limit the frequency of AI summary requests, so that the system prevents abuse and controls API costs.

#### Acceptance Criteria

1. THE AI_Summary_System SHALL enforce a limit of 10 summary requests per hour per Doctor per Patient
2. THE AI_Summary_System SHALL enforce a global limit of 30 summary requests per minute per Doctor
3. WHEN a Doctor exceeds the per-patient rate limit, THE AI_Summary_System SHALL return HTTP 429 with error code "RATE_LIMIT_EXCEEDED_PER_PATIENT"
4. WHEN a Doctor exceeds the global rate limit, THE AI_Summary_System SHALL return HTTP 429 with error code "RATE_LIMIT_EXCEEDED_GLOBAL"
5. THE AI_Summary_System SHALL include rate limit information in response headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset)
6. THE AI_Summary_System SHALL reset per-patient counters after 60 minutes from first request
7. THE AI_Summary_System SHALL reset global counters after 60 seconds from first request

### Requirement 3: Pre-Defined Query Architecture

**User Story:** As a security engineer, I want AI to only execute pre-defined queries, so that the system prevents SQL injection and unauthorized data access.

#### Acceptance Criteria

1. THE AI_Summary_System SHALL maintain a whitelist of pre-defined queries for medical record summarization
2. THE AI_Summary_System SHALL provide the following pre-defined queries: getPatientBasicInfo, getMedicalHistory, getChronicDiseases, getAllergies, getRecentLabTests, getCurrentMedications, getPreviousDiagnoses, getVitalSignsHistory
3. WHEN AI selects queries, THE Query_Handler SHALL validate each query ID exists in the whitelist
4. IF a query ID is not in the whitelist, THEN THE Query_Handler SHALL skip that query and log a security warning
5. THE Query_Handler SHALL execute queries using parameterized statements with Patient ID as the only parameter
6. THE AI_Summary_System SHALL NOT allow AI to generate custom SQL queries or modify existing queries
7. THE Query_Handler SHALL apply role-based filtering to ensure Doctor can only access data for patients they are authorized to view

### Requirement 4: Read-Only Data Access

**User Story:** As a security engineer, I want to ensure AI can only read data, so that the system prevents accidental or malicious data modification.

#### Acceptance Criteria

1. THE AI_Summary_System SHALL only expose read-only endpoints (GET, POST for summary generation) to AI operations
2. THE Query_Handler SHALL execute queries using database connections with read-only permissions
3. THE AI_Summary_System SHALL NOT provide AI with access to any write operations (INSERT, UPDATE, DELETE)
4. THE Query_Handler SHALL validate all pre-defined queries contain only SELECT statements
5. IF a query contains write operations, THEN THE Query_Handler SHALL reject the query and log a critical security alert

### Requirement 5: AI Summary Generation

**User Story:** As a doctor, I want AI to generate a concise 3-5 line summary of patient medical history, so that I can quickly understand the patient's condition before examination.

#### Acceptance Criteria

1. WHEN a Doctor requests a summary for a Patient, THE AI_Summary_System SHALL retrieve relevant medical data using pre-defined queries
2. THE Gemini_Service SHALL generate a summary in Vietnamese with 3 to 5 lines of text
3. THE Gemini_Service SHALL structure the summary as: Tiền sử (Medical History) - Bệnh lý hiện tại (Current Conditions) - Điểm cần lưu ý (Important Notes)
4. THE Gemini_Service SHALL use professional medical terminology appropriate for doctors
5. THE Gemini_Service SHALL highlight dangerous symptoms or critical conditions if present in the data
6. THE Gemini_Service SHALL NOT include diagnostic conclusions or treatment recommendations (only summarize existing data)
7. THE AI_Summary_System SHALL return the summary within 10 seconds under normal load conditions

### Requirement 6: System Prompt and AI Behavior

**User Story:** As a product manager, I want AI to behave as an experienced internal medicine doctor, so that the summaries are clinically relevant and professionally written.

#### Acceptance Criteria

1. THE Gemini_Service SHALL use a system prompt that instructs AI to act as an experienced internal medicine doctor and professional consultant
2. THE Gemini_Service SHALL instruct AI to be cautious, objective, and professional in tone
3. THE Gemini_Service SHALL instruct AI to use Vietnamese language with medical terminology
4. THE Gemini_Service SHALL instruct AI to emphasize dangerous signs if present
5. THE Gemini_Service SHALL instruct AI to NOT provide diagnoses or replace doctor's judgment
6. THE Gemini_Service SHALL instruct AI to respond with "Không đủ dữ liệu để tóm tắt" (Insufficient data to summarize) if medical record is empty or incomplete

### Requirement 7: API Endpoint Implementation

**User Story:** As a frontend developer, I want a clear API endpoint to request summaries, so that I can integrate the feature into the examination workflow.

#### Acceptance Criteria

1. THE AI_Summary_System SHALL provide a POST endpoint at /api/ai/summarize-medical-record
2. WHEN a request is received, THE AI_Summary_System SHALL require a JSON body with fields: medicalRecordId (integer) and patientId (integer)
3. THE AI_Summary_System SHALL validate medicalRecordId and patientId are positive integers
4. IF validation fails, THEN THE AI_Summary_System SHALL return HTTP 400 with error code "INVALID_INPUT"
5. THE AI_Summary_System SHALL verify the Examination_Record with medicalRecordId exists and belongs to the specified Patient
6. IF the record does not exist or does not match the Patient, THEN THE AI_Summary_System SHALL return HTTP 404 with error code "RECORD_NOT_FOUND"
7. THE AI_Summary_System SHALL return HTTP 200 with JSON response containing: success (boolean), data object with summary (string), queryIds (array), generatedAt (ISO timestamp)

### Requirement 8: Audit Logging and Compliance

**User Story:** As a compliance officer, I want all AI summary requests to be logged, so that we can audit access to patient data and ensure regulatory compliance.

#### Acceptance Criteria

1. THE AI_Summary_System SHALL log every summary request to the AiChatLog table
2. THE AI_Summary_System SHALL record the following fields: user_id, user_role, user_message (request context), ai_response (summary text), selected_query_ids, timestamp, ip_address, session_id, response_time_ms
3. THE AI_Summary_System SHALL log failed requests with error_message and is_blocked flag
4. THE AI_Summary_System SHALL log rate-limited requests with is_rate_limited flag set to true
5. THE AI_Summary_System SHALL NOT log sensitive patient data (PHI) in plain text logs, only reference IDs
6. THE AI_Summary_System SHALL retain audit logs for at least 90 days for compliance purposes

### Requirement 9: Frontend Integration - Summary Panel Component

**User Story:** As a doctor, I want a clean and professional UI component to view AI summaries, so that I can easily read and copy the summary during patient examination.

#### Acceptance Criteria

1. THE AI_Summary_System SHALL provide a React component named AISummaryPanel
2. THE AISummaryPanel SHALL display a button labeled "Tóm tắt bệnh án bằng AI" with a sparkles icon
3. WHEN the button is clicked, THE AISummaryPanel SHALL display a loading skeleton while fetching the summary
4. WHEN the summary is received, THE AISummaryPanel SHALL display the text in a readable format with proper line breaks
5. THE AISummaryPanel SHALL provide a copy-to-clipboard button for the summary text
6. THE AISummaryPanel SHALL display error messages in Vietnamese if the request fails
7. THE AISummaryPanel SHALL use Radix UI components and Tailwind CSS for styling consistent with the existing design system

### Requirement 10: Automatic Trigger on Examination Start

**User Story:** As a doctor, I want the option to automatically generate a summary when I start an examination, so that I don't have to manually request it every time.

#### Acceptance Criteria

1. WHERE automatic summary is enabled, WHEN a Doctor clicks "Bắt đầu khám" (Start Examination), THE AI_Summary_System SHALL automatically trigger a summary request
2. THE AI_Summary_System SHALL provide a user preference setting to enable or disable automatic summary generation
3. THE AI_Summary_System SHALL store the user preference in the User model or browser localStorage
4. IF automatic summary is disabled, THE AISummaryPanel SHALL only show the manual trigger button
5. THE AI_Summary_System SHALL handle automatic trigger failures gracefully without blocking the examination workflow

### Requirement 11: Summary Persistence

**User Story:** As a doctor, I want generated summaries to be saved with the medical record, so that I can refer back to them later without regenerating.

#### Acceptance Criteria

1. THE AI_Summary_System SHALL save the generated Summary_Text to the MedicalExamination record
2. THE AI_Summary_System SHALL add a new field "AiSummary" (TEXT, nullable) to the MedicalExaminations table
3. WHEN a summary is generated, THE AI_Summary_System SHALL update the AiSummary field with the summary text
4. THE AI_Summary_System SHALL store the generation timestamp in a new field "AiSummaryGeneratedAt" (DATETIME, nullable)
5. THE AI_Summary_System SHALL NOT save the system prompt or query results, only the final summary text
6. WHEN displaying a medical record, THE AI_Summary_System SHALL show the saved summary if it exists
7. THE AI_Summary_System SHALL allow regeneration of the summary, which will overwrite the previous summary

### Requirement 12: Error Handling and Resilience

**User Story:** As a system administrator, I want the AI summary feature to handle errors gracefully, so that failures do not disrupt the examination workflow.

#### Acceptance Criteria

1. WHEN the Gemini_Service is unavailable, THE AI_Summary_System SHALL return HTTP 503 with error code "AI_SERVICE_UNAVAILABLE"
2. WHEN a query execution fails, THE AI_Summary_System SHALL continue with remaining queries and generate a partial summary
3. WHEN all queries fail, THE AI_Summary_System SHALL return HTTP 500 with error code "DATA_RETRIEVAL_FAILED"
4. WHEN the Gemini_Service times out after 10 seconds, THE AI_Summary_System SHALL return HTTP 504 with error code "AI_TIMEOUT"
5. THE AI_Summary_System SHALL log all errors with sufficient context for debugging (user ID, patient ID, query IDs, error message)
6. THE AI_Summary_System SHALL return user-friendly error messages in Vietnamese for all error scenarios

### Requirement 13: Performance and Scalability

**User Story:** As a system administrator, I want the AI summary feature to perform efficiently, so that it does not impact overall system performance.

#### Acceptance Criteria

1. THE AI_Summary_System SHALL complete 95% of summary requests within 5 seconds under normal load
2. THE AI_Summary_System SHALL support at least 10 concurrent summary requests without degradation
3. THE Query_Handler SHALL execute all pre-defined queries in parallel to minimize total execution time
4. THE AI_Summary_System SHALL cache query results for 60 seconds to reduce database load for repeated requests
5. THE AI_Summary_System SHALL implement request timeout of 30 seconds to prevent resource exhaustion
6. THE AI_Summary_System SHALL monitor and log response times for performance analysis

### Requirement 14: Input Validation and Sanitization

**User Story:** As a security engineer, I want all inputs to be validated and sanitized, so that the system prevents injection attacks and malformed requests.

#### Acceptance Criteria

1. THE AI_Summary_System SHALL validate medicalRecordId is an integer between 1 and 9223372036854775807
2. THE AI_Summary_System SHALL validate patientId is an integer between 1 and 9223372036854775807
3. THE AI_Summary_System SHALL reject requests with additional unexpected fields in the JSON body
4. THE AI_Summary_System SHALL sanitize all string inputs to remove HTML tags and script content
5. THE AI_Summary_System SHALL validate Content-Type header is "application/json"
6. IF Content-Type is invalid, THEN THE AI_Summary_System SHALL return HTTP 415 with error code "INVALID_CONTENT_TYPE"

### Requirement 15: Pre-Defined Query Definitions

**User Story:** As a backend developer, I want clear definitions for all pre-defined queries, so that I can implement them correctly and consistently.

#### Acceptance Criteria

1. THE Query_Handler SHALL implement getPatientBasicInfo query to return: full name, date of birth, gender, phone, address, insurance number, allergies, emergency contact
2. THE Query_Handler SHALL implement getMedicalHistory query to return: all previous Examination_Records with date, symptoms, diagnosis, treatment advice (ordered by date descending, limit 10)
3. THE Query_Handler SHALL implement getChronicDiseases query to return: distinct diagnoses marked as chronic or recurring from medical history
4. THE Query_Handler SHALL implement getAllergies query to return: allergies field from Patient record
5. THE Query_Handler SHALL implement getRecentLabTests query to return: lab test results from the last 6 months with test name, result value, reference range, date
6. THE Query_Handler SHALL implement getCurrentMedications query to return: active prescriptions with medicine name, dosage, frequency, start date
7. THE Query_Handler SHALL implement getPreviousDiagnoses query to return: all unique ICD10 codes and diagnosis text from past examinations
8. THE Query_Handler SHALL implement getVitalSignsHistory query to return: blood pressure, pulse, temperature, SpO2, weight, height, BMI from the last 5 examinations

### Requirement 16: Response Format Standardization

**User Story:** As a frontend developer, I want consistent response formats, so that I can handle responses predictably in the UI.

#### Acceptance Criteria

1. THE AI_Summary_System SHALL return all successful responses with structure: { success: true, data: { summary, queryIds, generatedAt, remainingRequests } }
2. THE AI_Summary_System SHALL return all error responses with structure: { success: false, error: { code, message, statusCode } }
3. THE AI_Summary_System SHALL use ISO 8601 format for all timestamp fields (generatedAt)
4. THE AI_Summary_System SHALL include HTTP status code in both the response status and error.statusCode field
5. THE AI_Summary_System SHALL provide error messages in Vietnamese for user-facing errors
6. THE AI_Summary_System SHALL provide error codes in UPPER_SNAKE_CASE for programmatic error handling

### Requirement 17: Configuration and Environment Variables

**User Story:** As a DevOps engineer, I want AI summary configuration to be externalized, so that I can adjust settings without code changes.

#### Acceptance Criteria

1. THE AI_Summary_System SHALL read Gemini API key from environment variable GEMINI_API_KEY
2. THE AI_Summary_System SHALL read Gemini model name from environment variable GEMINI_MODEL with default "gemini-2.0-flash"
3. THE AI_Summary_System SHALL read rate limit values from environment variables: AI_SUMMARY_RATE_LIMIT_PER_PATIENT (default 10), AI_SUMMARY_RATE_LIMIT_GLOBAL (default 30)
4. THE AI_Summary_System SHALL read request timeout from environment variable AI_SUMMARY_TIMEOUT_MS (default 30000)
5. THE AI_Summary_System SHALL validate GEMINI_API_KEY is set on application startup
6. IF GEMINI_API_KEY is not set, THEN THE AI_Summary_System SHALL log a warning and disable the summary feature

### Requirement 18: Testing and Quality Assurance

**User Story:** As a QA engineer, I want comprehensive tests for the AI summary feature, so that we can ensure reliability and catch regressions.

#### Acceptance Criteria

1. THE AI_Summary_System SHALL include unit tests for all controller functions with at least 80% code coverage
2. THE AI_Summary_System SHALL include integration tests for the complete summary generation flow
3. THE AI_Summary_System SHALL include tests for all error scenarios (unauthorized, rate limited, invalid input, service unavailable)
4. THE AI_Summary_System SHALL include tests for rate limiting behavior (per-patient and global limits)
5. THE AI_Summary_System SHALL include tests for pre-defined query execution and validation
6. THE AI_Summary_System SHALL include tests for audit logging functionality
7. THE AI_Summary_System SHALL use mocked Gemini API responses in tests to avoid external dependencies

---

## Notes

- This feature extends the existing AI chatbot infrastructure (geminiService, queryHandler, conversationManager) with specialized functionality for medical record summarization
- The pre-defined query architecture follows the same security model as the existing AI chatbot feature
- Frontend components should integrate seamlessly with the existing examination workflow pages
- All Vietnamese text in requirements reflects the bilingual nature of the codebase
- Rate limiting is more restrictive than the general AI chatbot (10/hour vs 20/10min) due to the sensitive nature of medical records
- The feature is designed to be optional and non-blocking - examination workflow continues even if summary generation fails
