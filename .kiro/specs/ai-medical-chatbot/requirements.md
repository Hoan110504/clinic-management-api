# Requirements Document: AI Medical Chatbot

## Introduction

The AI Medical Chatbot is a conversational assistant feature for the clinic management system that provides authenticated users with intelligent, role-based access to medical information. The chatbot acts as "Dr. AI," a professional medical consultant that answers questions about diseases, medicines, and lab tests using real database information while maintaining strict security boundaries and read-only access.

This feature enhances user experience by providing instant access to medical information without requiring users to navigate complex interfaces, while ensuring data security through query whitelisting, role-based access control, rate limiting, and prompt injection prevention.

## Glossary

- **AI_Chatbot**: The conversational AI system that processes user questions and provides medical information
- **Query_Whitelist**: A predefined map of allowed database queries with associated role permissions
- **Rate_Limiter**: A security component that restricts the number of requests per user and IP address
- **Sanitizer**: A middleware component that validates and cleans user input to prevent injection attacks
- **Gemini_Client**: The Google Generative AI client using the gemini-2.0-flash model
- **System_Prompt**: The hardcoded instructions that define the AI's behavior and constraints
- **Chat_Log**: A database record of all AI interactions for audit purposes
- **Two_Pass_Flow**: The AI processing pattern where Pass 1 selects queries and Pass 2 synthesizes answers
- **JWT_Token**: JSON Web Token used for user authentication
- **Role**: User permission level (admin=1, doctor=2, receptionist=3, pharmacist=4, patient=5, labtech=6)
- **Prompt_Injection**: Malicious input attempting to override AI instructions
- **Data_Scope**: The subset of data a user role is permitted to access
- **Conversation_History**: The last 10 messages maintained for context in AI conversations
- **Query_Handler**: A backend function that executes a whitelisted query with role-based filtering

## Requirements

### Requirement 1: Authentication and Authorization

**User Story:** As a system administrator, I want all AI chatbot interactions to require valid authentication, so that only authorized users can access medical information.

#### Acceptance Criteria

1. WHEN a user sends a chat request without a valid JWT token, THEN THE AI_Chatbot SHALL return a 401 Unauthorized error
2. WHEN a user sends a chat request with an expired JWT token, THEN THE AI_Chatbot SHALL return a 401 Unauthorized error with message "Token expired"
3. WHEN a user sends a chat request with a valid JWT token, THEN THE AI_Chatbot SHALL extract the user ID and role from the token
4. THE AI_Chatbot SHALL verify JWT tokens using the same secret and algorithm as the main authentication system
5. FOR ALL authenticated requests, THE AI_Chatbot SHALL attach user context (id, role, username) to the request object

### Requirement 2: Query Whitelist Architecture

**User Story:** As a security engineer, I want the AI to only execute predefined queries from a whitelist, so that arbitrary SQL execution is prevented.

#### Acceptance Criteria

1. THE Query_Whitelist SHALL be defined as a JavaScript Map with query_id as keys and query configurations as values
2. WHEN the AI selects a query_id, THE AI_Chatbot SHALL verify the query_id exists in the Query_Whitelist before execution
3. IF a query_id is not in the Query_Whitelist, THEN THE AI_Chatbot SHALL reject the request with error "Query not allowed"
4. THE Query_Whitelist SHALL store for each query: query_id, description, requiredRoles array, and handler function
5. THE Query_Handler SHALL execute queries through Sequelize ORM or service layer functions, not raw SQL strings
6. THE Query_Whitelist SHALL include patient-scoped queries: my_appointments, my_prescriptions, my_lab_results, my_medical_history
7. THE Query_Whitelist SHALL include clinical queries: medicines_info, patient_medical_history, lab_tests_pending, low_stock_medicines, appointment_schedule
8. FOR ALL query executions, THE AI_Chatbot SHALL pass the authenticated user context to the Query_Handler
9. WHEN a query requires patient-specific data, THE Query_Handler SHALL filter results by the authenticated user's patient ID
10. THE Query_Whitelist configuration SHALL be immutable at runtime and only modifiable through code deployment

### Requirement 3: Role-Based Data Access Control

**User Story:** As a compliance officer, I want users to only access data appropriate for their role, so that patient privacy is protected.

#### Acceptance Criteria

1. WHEN a patient (role=5) requests data, THE AI_Chatbot SHALL only return data where patient_id matches the authenticated user's patient ID
2. WHEN a doctor (role=2) requests patient data, THE AI_Chatbot SHALL only return data for patients in the doctor's scheduled appointments
3. WHEN a pharmacist (role=4) requests data, THE AI_Chatbot SHALL only return medicine information and prescription data
4. WHEN a receptionist (role=3) requests data, THE AI_Chatbot SHALL only return appointment and basic patient contact information
5. WHEN a labtech (role=6) requests data, THE AI_Chatbot SHALL only return lab test information
6. WHEN an admin (role=1) requests data, THE AI_Chatbot SHALL apply appropriate scope filtering to prevent exposure of unrelated sensitive data
7. WHEN a user attempts to execute a query not permitted for their role, THEN THE AI_Chatbot SHALL return error "Insufficient permissions for this query"
8. THE Query_Handler SHALL verify the user's role is in the requiredRoles array before executing any query
9. THE AI_Chatbot SHALL strip sensitive fields (password hashes, internal system IDs, JWT secrets) from all data returned to the AI
10. FOR ALL data returned to users, THE AI_Chatbot SHALL ensure no cross-patient data leakage occurs

### Requirement 4: Rate Limiting

**User Story:** As a system administrator, I want to limit the number of AI requests per user and IP, so that system resources are protected from abuse.

#### Acceptance Criteria

1. THE Rate_Limiter SHALL enforce a limit of 20 requests per user within a 10-minute window
2. THE Rate_Limiter SHALL enforce a limit of 50 requests per IP address within a 10-minute window
3. WHEN a user exceeds their rate limit, THEN THE AI_Chatbot SHALL return a 429 Too Many Requests error
4. WHEN a rate limit is exceeded, THE AI_Chatbot SHALL include the cooldown time in seconds in the error response
5. THE Rate_Limiter SHALL store counters in-memory using a Map with TTL expiration
6. WHEN a rate limit window expires, THE Rate_Limiter SHALL automatically reset the counter for that user or IP
7. THE Rate_Limiter SHALL track user limits by user ID from the JWT token
8. THE Rate_Limiter SHALL track IP limits by the request IP address from req.ip
9. THE Rate_Limiter SHALL return remaining request count in response headers: X-RateLimit-Remaining-User and X-RateLimit-Remaining-IP
10. WHEN a user queries their rate limit status, THE AI_Chatbot SHALL return current usage and remaining requests

### Requirement 5: Input Sanitization and Validation

**User Story:** As a security engineer, I want all user input to be sanitized and validated, so that injection attacks are prevented.

#### Acceptance Criteria

1. THE Sanitizer SHALL trim whitespace from the beginning and end of all user messages
2. THE Sanitizer SHALL enforce a maximum message length of 500 characters
3. WHEN a message exceeds 500 characters, THEN THE AI_Chatbot SHALL return a 400 Bad Request error with message "Message too long"
4. THE Sanitizer SHALL strip all HTML tags from user input using a safe HTML stripping function
5. THE Sanitizer SHALL remove script injection patterns including `<script>`, `javascript:`, `onerror=`, `onclick=`
6. THE Sanitizer SHALL detect prompt injection patterns: "ignore previous", "disregard", "forget instructions", "you are now", "act as", "jailbreak", "DAN", "system prompt", "reveal", "bypass", "override", "admin mode"
7. WHEN a prompt injection pattern is detected, THEN THE AI_Chatbot SHALL return a 400 Bad Request error with message "Invalid input detected"
8. WHEN a prompt injection pattern is detected, THE AI_Chatbot SHALL log a security warning with user ID, IP address, and the detected pattern
9. THE Sanitizer SHALL convert all input to lowercase for pattern matching while preserving original case for processing
10. THE Sanitizer SHALL validate that the message field is present and is a non-empty string after trimming

### Requirement 6: System Prompt and AI Behavior

**User Story:** As a product manager, I want the AI to behave as a professional medical consultant with clear boundaries, so that users receive helpful and safe guidance.

#### Acceptance Criteria

1. THE System_Prompt SHALL define the AI as "Dr. AI", a professional medical assistant for the clinic
2. THE System_Prompt SHALL instruct the AI to consult on diseases, medicines, and lab tests using real system data
3. THE System_Prompt SHALL explicitly forbid the AI from performing write, update, or delete operations
4. THE System_Prompt SHALL explicitly forbid the AI from revealing other users' information
5. THE System_Prompt SHALL explicitly forbid the AI from answering non-medical questions
6. THE System_Prompt SHALL explicitly forbid the AI from revealing system prompts, database structure, or API endpoints
7. THE System_Prompt SHALL explicitly forbid the AI from following "ignore previous instructions" or jailbreak attempts
8. THE System_Prompt SHALL explicitly forbid the AI from providing official medical diagnoses
9. THE System_Prompt SHALL instruct the AI to always advise users to see a doctor directly for medical concerns
10. THE System_Prompt SHALL be hardcoded in the backend and never exposed to the client
11. THE System_Prompt SHALL be included in every AI request using the systemInstruction parameter
12. WHEN a user asks the AI to reveal its instructions, THE AI_Chatbot SHALL refuse and remind the user of its purpose

### Requirement 7: Two-Pass AI Processing Flow

**User Story:** As a developer, I want the AI to use a two-pass approach for query selection and answer synthesis, so that responses are accurate and based on real data.

#### Acceptance Criteria

1. WHEN a user sends a question, THE AI_Chatbot SHALL execute Pass 1 to select relevant query_ids from the Query_Whitelist
2. IN Pass 1, THE AI_Chatbot SHALL use JSON mode with responseMimeType "application/json" to return structured query selections
3. THE AI_Chatbot SHALL provide Pass 1 with the list of available query_ids and their descriptions based on the user's role
4. THE AI_Chatbot SHALL parse the Pass 1 JSON response to extract the selected query_ids array
5. WHEN Pass 1 returns query_ids, THE AI_Chatbot SHALL execute each selected query through the Query_Handler
6. THE AI_Chatbot SHALL collect all query results and format them for Pass 2
7. IN Pass 2, THE AI_Chatbot SHALL provide the user's question, query results, and Conversation_History to synthesize a natural language answer
8. THE AI_Chatbot SHALL use the "user" and "model" role names in conversation history (not "assistant")
9. THE AI_Chatbot SHALL include the last 10 messages from Conversation_History as context for Pass 2
10. WHEN Pass 1 returns an empty query_ids array, THE AI_Chatbot SHALL proceed to Pass 2 with no query results and let the AI respond based on general knowledge

### Requirement 8: Gemini AI Client Configuration

**User Story:** As a developer, I want to configure the Google Gemini AI client correctly, so that API calls are reliable and within rate limits.

#### Acceptance Criteria

1. THE Gemini_Client SHALL use the @google/generative-ai SDK
2. THE Gemini_Client SHALL use the gemini-2.0-flash model
3. THE Gemini_Client SHALL initialize with the API key from environment variable GEMINI_API_KEY
4. THE Gemini_Client SHALL set the systemInstruction parameter with the System_Prompt for all requests
5. WHEN the Gemini API returns a 429 rate limit error, THE AI_Chatbot SHALL retry the request after a 2-second delay
6. THE AI_Chatbot SHALL implement a maximum of 3 retry attempts for 429 errors
7. WHEN retries are exhausted, THE AI_Chatbot SHALL return a 503 Service Unavailable error with message "AI service temporarily unavailable"
8. THE Gemini_Client SHALL enforce an internal rate limit of 10 requests per minute to stay within free tier limits
9. WHEN the internal rate limit is reached, THE AI_Chatbot SHALL queue requests or return a 429 error with retry-after header
10. THE Gemini_Client SHALL handle network errors gracefully and return user-friendly error messages

### Requirement 9: Conversation History Management

**User Story:** As a user, I want the AI to remember recent conversation context, so that I can have natural multi-turn conversations.

#### Acceptance Criteria

1. THE AI_Chatbot SHALL maintain the last 10 messages in Conversation_History for each user session
2. WHEN a new message is added, THE AI_Chatbot SHALL remove the oldest message if the history exceeds 10 messages
3. THE Conversation_History SHALL store messages with role ("user" or "model") and content
4. THE AI_Chatbot SHALL include Conversation_History in Pass 2 to provide context for answer synthesis
5. WHEN a user starts a new session, THE AI_Chatbot SHALL initialize an empty Conversation_History
6. THE AI_Chatbot SHALL store Conversation_History in memory per user session (not persisted to database)
7. WHEN a user's session expires, THE AI_Chatbot SHALL clear the Conversation_History for that user
8. THE AI_Chatbot SHALL append the user's question to Conversation_History before Pass 1
9. THE AI_Chatbot SHALL append the AI's response to Conversation_History after Pass 2
10. THE Conversation_History SHALL not include system messages or internal processing details

### Requirement 10: Chat Logging and Audit Trail

**User Story:** As a compliance officer, I want all AI interactions to be logged, so that we have an audit trail for security and quality purposes.

#### Acceptance Criteria

1. THE Chat_Log SHALL record every AI interaction in the database table AiChatLog
2. THE Chat_Log SHALL store: user_id, user_role, user_message, ai_response, selected_query_ids, timestamp, ip_address, session_id
3. WHEN a user sends a message, THE AI_Chatbot SHALL create a Chat_Log entry after generating the response
4. WHEN a prompt injection is detected, THE Chat_Log SHALL record the attempt with a flag is_blocked=true
5. WHEN a rate limit is exceeded, THE Chat_Log SHALL record the attempt with a flag is_rate_limited=true
6. THE Chat_Log SHALL store selected_query_ids as a JSON array for analysis
7. THE Chat_Log SHALL not store sensitive data like passwords or full medical records in the log
8. THE Chat_Log SHALL be queryable by administrators for audit and analysis purposes
9. THE Chat_Log SHALL include response_time_ms to track AI performance
10. THE Chat_Log SHALL include error_message when requests fail

### Requirement 11: API Endpoints

**User Story:** As a frontend developer, I want well-defined API endpoints for chat interactions, so that I can integrate the chatbot into the UI.

#### Acceptance Criteria

1. THE AI_Chatbot SHALL expose endpoint POST /api/ai/chat for sending messages
2. THE POST /api/ai/chat endpoint SHALL accept JSON body with field "message" (string, required)
3. THE POST /api/ai/chat endpoint SHALL return JSON with fields: success (boolean), data.response (string), data.queryIds (array), data.remainingRequests (number)
4. THE AI_Chatbot SHALL expose endpoint GET /api/ai/history for retrieving conversation history
5. THE GET /api/ai/history endpoint SHALL return the last 10 messages for the authenticated user
6. THE AI_Chatbot SHALL expose endpoint GET /api/ai/rate-status for checking rate limit status
7. THE GET /api/ai/rate-status endpoint SHALL return: userLimit, userRemaining, ipLimit, ipRemaining, resetTime
8. THE AI_Chatbot SHALL expose endpoint DELETE /api/ai/history for clearing conversation history
9. ALL AI endpoints SHALL require valid JWT authentication via Authorization header
10. ALL AI endpoints SHALL return consistent error format: { success: false, error: { code, message, statusCode } }

### Requirement 12: Frontend Chat Widget

**User Story:** As a user, I want a floating chat widget that is easily accessible from any page, so that I can quickly ask medical questions.

#### Acceptance Criteria

1. THE Chat_Widget SHALL display as a floating button in the bottom-right corner of the screen
2. THE Chat_Widget SHALL use a medical icon (💊 or 🤖) to indicate its purpose
3. WHEN the Chat_Widget has unread messages, THEN THE Chat_Widget SHALL display a red badge with the count
4. WHEN a user clicks the Chat_Widget button, THEN THE Chat_Widget SHALL expand into a chat window
5. THE Chat_Widget SHALL remain accessible on all authenticated pages
6. THE Chat_Widget SHALL have a z-index high enough to appear above other page content
7. THE Chat_Widget button SHALL be 60x60 pixels with rounded corners
8. THE Chat_Widget SHALL animate smoothly when opening and closing
9. THE Chat_Widget SHALL be positioned 20px from the bottom and 20px from the right edge
10. THE Chat_Widget SHALL not obstruct critical UI elements like submit buttons

### Requirement 13: Chat Window Interface

**User Story:** As a user, I want a clean and intuitive chat interface, so that I can easily communicate with the AI.

#### Acceptance Criteria

1. THE Chat_Window SHALL be 400 pixels wide and 600 pixels tall
2. THE Chat_Window SHALL include a header with title "Dr. AI - Medical Assistant" and minimize/close buttons
3. THE Chat_Window SHALL include a scrollable message area displaying conversation history
4. THE Chat_Window SHALL include an input field at the bottom for typing messages
5. THE Chat_Window SHALL include a send button next to the input field
6. WHEN a user presses Enter in the input field, THE Chat_Window SHALL send the message
7. THE Chat_Window SHALL display user messages aligned to the right with a distinct background color
8. THE Chat_Window SHALL display AI messages aligned to the left with a different background color
9. THE Chat_Window SHALL auto-scroll to the latest message when a new message is added
10. THE Chat_Window SHALL display a loading indicator while waiting for AI response
11. THE Chat_Window SHALL display a disclaimer at the top: "AI provides consultation only, not a substitute for official medical diagnosis"
12. WHEN the Chat_Window is minimized, THE Chat_Widget SHALL collapse back to the floating button

### Requirement 14: Role-Based Welcome Messages

**User Story:** As a user, I want to see a personalized welcome message based on my role, so that I understand what the AI can help me with.

#### Acceptance Criteria

1. WHEN a patient opens the chat, THE Chat_Window SHALL display: "Hello! I can help you with your appointments, prescriptions, and lab results."
2. WHEN a doctor opens the chat, THE Chat_Window SHALL display: "Hello Doctor! I can help you with patient information, medicines, and lab tests."
3. WHEN a pharmacist opens the chat, THE Chat_Window SHALL display: "Hello! I can help you with medicine information and inventory."
4. WHEN a receptionist opens the chat, THE Chat_Window SHALL display: "Hello! I can help you with appointment scheduling and patient information."
5. WHEN a labtech opens the chat, THE Chat_Window SHALL display: "Hello! I can help you with lab test information."
6. WHEN an admin opens the chat, THE Chat_Window SHALL display: "Hello Admin! I can help you with system information and reports."
7. THE welcome message SHALL be displayed only once when the chat is first opened in a session
8. THE welcome message SHALL be styled differently from regular messages (e.g., centered, italic)

### Requirement 15: Rate Limit UI Feedback

**User Story:** As a user, I want to see how many questions I have remaining, so that I can manage my usage effectively.

#### Acceptance Criteria

1. THE Chat_Window SHALL display the remaining request count in the header: "15/20 questions remaining"
2. WHEN the remaining count drops below 5, THE Chat_Window SHALL display the count in yellow as a warning
3. WHEN the remaining count reaches 0, THE Chat_Window SHALL display the count in red
4. WHEN a user is rate-limited, THE Chat_Window SHALL display: "Rate limit reached. Please wait X minutes before asking more questions."
5. THE Chat_Window SHALL update the remaining count after each message is sent
6. THE Chat_Window SHALL fetch the rate limit status when the chat is opened
7. THE Chat_Window SHALL display the reset time when rate-limited: "Limit resets at HH:MM"
8. THE remaining count SHALL be visible but not obtrusive to the chat experience

### Requirement 16: Error Handling and User Feedback

**User Story:** As a user, I want clear error messages when something goes wrong, so that I understand what happened and what to do next.

#### Acceptance Criteria

1. WHEN the AI service is unavailable, THE Chat_Window SHALL display: "AI service is temporarily unavailable. Please try again later."
2. WHEN authentication fails, THE Chat_Window SHALL display: "Session expired. Please log in again."
3. WHEN input validation fails, THE Chat_Window SHALL display: "Message is too long. Please keep it under 500 characters."
4. WHEN prompt injection is detected, THE Chat_Window SHALL display: "Invalid input detected. Please rephrase your question."
5. WHEN a network error occurs, THE Chat_Window SHALL display: "Connection error. Please check your internet and try again."
6. WHEN a rate limit is exceeded, THE Chat_Window SHALL display the rate limit message with cooldown time
7. THE Chat_Window SHALL display error messages in a distinct style (e.g., red background)
8. THE Chat_Window SHALL allow users to retry after an error by sending a new message
9. THE Chat_Window SHALL log errors to the browser console for debugging purposes
10. THE Chat_Window SHALL not expose technical error details (stack traces, SQL errors) to users

### Requirement 17: Security - Query Execution Isolation

**User Story:** As a security engineer, I want query execution to be isolated from external API calls, so that infinite loops and security vulnerabilities are prevented.

#### Acceptance Criteria

1. THE Query_Handler SHALL execute queries through internal Sequelize model methods, not HTTP requests to /api/* endpoints
2. THE Query_Handler SHALL call service layer functions directly (e.g., appointmentService.getMyAppointments(userId))
3. THE AI_Chatbot SHALL never construct or execute raw SQL queries from user input
4. THE AI_Chatbot SHALL never call external HTTP endpoints based on AI-generated URLs
5. THE Query_Whitelist SHALL only include queries that perform SELECT operations, never INSERT, UPDATE, or DELETE
6. THE Query_Handler SHALL use parameterized queries through Sequelize to prevent SQL injection
7. THE Query_Handler SHALL enforce row-level security by filtering results based on user context
8. THE Query_Handler SHALL timeout queries that exceed 5 seconds to prevent resource exhaustion
9. WHEN a query times out, THE AI_Chatbot SHALL return error "Query took too long to execute"
10. THE Query_Handler SHALL not expose database connection strings or credentials in error messages

### Requirement 18: Security - Sensitive Data Filtering

**User Story:** As a privacy officer, I want sensitive data to be filtered before being sent to the AI, so that confidential information is protected.

#### Acceptance Criteria

1. THE AI_Chatbot SHALL strip password hashes from all data before sending to the AI
2. THE AI_Chatbot SHALL strip JWT tokens and refresh tokens from all data before sending to the AI
3. THE AI_Chatbot SHALL strip internal system IDs that are not relevant to the user's question
4. THE AI_Chatbot SHALL strip credit card numbers and payment details from all data before sending to the AI
5. THE AI_Chatbot SHALL strip social security numbers and national ID numbers from all data before sending to the AI
6. THE AI_Chatbot SHALL redact phone numbers and email addresses for users other than the authenticated user
7. THE AI_Chatbot SHALL limit the amount of data sent to the AI to prevent context overflow (max 10,000 characters per query result)
8. WHEN query results exceed the character limit, THE AI_Chatbot SHALL truncate the results and inform the AI that data was truncated
9. THE AI_Chatbot SHALL not send the System_Prompt or Query_Whitelist structure to the AI in Pass 2
10. THE AI_Chatbot SHALL validate that filtered data does not contain sensitive patterns before sending to the AI

### Requirement 19: CORS and API Security

**User Story:** As a security engineer, I want strict CORS policies on AI endpoints, so that unauthorized domains cannot access the chatbot.

#### Acceptance Criteria

1. THE AI_Chatbot endpoints SHALL enforce CORS with allowed origins from environment variable CORS_ORIGIN
2. THE AI_Chatbot endpoints SHALL reject requests from origins not in the CORS_ORIGIN whitelist
3. THE AI_Chatbot endpoints SHALL include security headers: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection
4. THE AI_Chatbot endpoints SHALL use helmet middleware for additional security headers
5. THE AI_Chatbot endpoints SHALL validate Content-Type header is application/json for POST requests
6. THE AI_Chatbot endpoints SHALL reject requests with Content-Type other than application/json
7. THE AI_Chatbot endpoints SHALL limit request body size to 10KB to prevent payload attacks
8. THE AI_Chatbot endpoints SHALL sanitize all response data to prevent XSS attacks
9. THE AI_Chatbot endpoints SHALL not expose internal server errors to clients (return generic 500 messages)
10. THE AI_Chatbot endpoints SHALL log all security violations for monitoring and alerting

### Requirement 20: Performance and Scalability

**User Story:** As a system administrator, I want the AI chatbot to perform efficiently under load, so that user experience remains smooth.

#### Acceptance Criteria

1. THE AI_Chatbot SHALL respond to user messages within 5 seconds under normal load
2. THE AI_Chatbot SHALL cache frequently accessed query results for 60 seconds to reduce database load
3. THE AI_Chatbot SHALL use database connection pooling to handle concurrent requests efficiently
4. THE AI_Chatbot SHALL limit concurrent AI API calls to 5 per server instance to prevent rate limit exhaustion
5. WHEN concurrent request limit is reached, THE AI_Chatbot SHALL queue additional requests with a maximum queue size of 20
6. WHEN the queue is full, THE AI_Chatbot SHALL return a 503 Service Unavailable error with message "Service busy, please try again"
7. THE AI_Chatbot SHALL implement request timeouts of 30 seconds to prevent hanging connections
8. THE AI_Chatbot SHALL use in-memory caching for rate limit counters to avoid database overhead
9. THE AI_Chatbot SHALL log performance metrics (response time, query execution time, AI API latency) for monitoring
10. THE AI_Chatbot SHALL gracefully degrade when the AI service is slow by showing a "Processing..." message to users

### Requirement 21: Parser and Serializer for Query Results

**User Story:** As a developer, I want a robust parser and serializer for query results, so that data is correctly formatted for the AI and responses are properly structured.

#### Acceptance Criteria

1. THE Query_Result_Parser SHALL parse Sequelize query results into plain JavaScript objects
2. THE Query_Result_Parser SHALL handle nested associations (e.g., appointments with patient details)
3. THE Query_Result_Parser SHALL convert Date objects to ISO 8601 strings for AI consumption
4. THE Query_Result_Parser SHALL handle null and undefined values gracefully
5. THE Query_Result_Serializer SHALL format parsed results into a structured JSON format for Pass 2
6. THE Query_Result_Serializer SHALL include metadata: query_id, row_count, execution_time_ms
7. THE Pretty_Printer SHALL format AI responses with proper line breaks and markdown for display in the chat UI
8. FOR ALL valid query results, parsing then serializing then parsing SHALL produce an equivalent object (round-trip property)
9. WHEN a query returns an empty result set, THE Query_Result_Parser SHALL return an empty array, not null
10. THE Query_Result_Parser SHALL validate that all required fields are present before sending to the AI

### Requirement 22: Testing and Quality Assurance

**User Story:** As a QA engineer, I want comprehensive tests for the AI chatbot, so that functionality and security are verified.

#### Acceptance Criteria

1. THE AI_Chatbot SHALL have unit tests for all middleware components (auth, rate limit, sanitizer)
2. THE AI_Chatbot SHALL have integration tests for the complete two-pass flow
3. THE AI_Chatbot SHALL have security tests for prompt injection detection
4. THE AI_Chatbot SHALL have tests for role-based access control on all whitelisted queries
5. THE AI_Chatbot SHALL have tests for rate limiting behavior (user and IP limits)
6. THE AI_Chatbot SHALL have tests for error handling (AI service down, database errors, network failures)
7. THE AI_Chatbot SHALL have tests for input validation (max length, HTML stripping, special characters)
8. THE AI_Chatbot SHALL have tests for conversation history management (10 message limit, session isolation)
9. THE AI_Chatbot SHALL have tests for query result parsing and serialization (round-trip property)
10. THE AI_Chatbot SHALL have tests for Gemini API retry logic and rate limit handling

### Requirement 23: Documentation and Developer Experience

**User Story:** As a developer, I want clear documentation for the AI chatbot, so that I can understand, maintain, and extend the feature.

#### Acceptance Criteria

1. THE AI_Chatbot SHALL include inline code comments explaining the two-pass flow
2. THE Query_Whitelist SHALL include comments for each query explaining its purpose and required roles
3. THE AI_Chatbot SHALL include a README.md file with setup instructions for the Gemini API key
4. THE README.md SHALL document all environment variables required for the AI chatbot
5. THE README.md SHALL include examples of adding new queries to the Query_Whitelist
6. THE README.md SHALL document the security architecture and threat model
7. THE AI_Chatbot SHALL include JSDoc comments for all exported functions
8. THE AI_Chatbot SHALL include example API requests and responses in the documentation
9. THE AI_Chatbot SHALL include a troubleshooting section for common issues (API key errors, rate limits)
10. THE AI_Chatbot SHALL include a changelog documenting feature additions and security updates

### Requirement 24: Monitoring and Observability

**User Story:** As a system administrator, I want monitoring and logging for the AI chatbot, so that I can track usage and diagnose issues.

#### Acceptance Criteria

1. THE AI_Chatbot SHALL log all requests with: timestamp, user_id, user_role, message_length, response_time_ms
2. THE AI_Chatbot SHALL log all errors with: error_type, error_message, stack_trace, user_id, ip_address
3. THE AI_Chatbot SHALL log all security events: prompt_injection_attempts, rate_limit_violations, unauthorized_access
4. THE AI_Chatbot SHALL expose metrics endpoint GET /api/ai/metrics for monitoring tools (requires admin role)
5. THE metrics endpoint SHALL return: total_requests, average_response_time, error_rate, rate_limit_hits, active_users
6. THE AI_Chatbot SHALL log Gemini API usage: requests_sent, tokens_used, rate_limit_errors
7. THE AI_Chatbot SHALL log query execution statistics: query_id, execution_count, average_execution_time
8. THE AI_Chatbot SHALL use structured logging (JSON format) for easy parsing by log aggregation tools
9. THE AI_Chatbot SHALL rotate log files daily and retain logs for 30 days
10. THE AI_Chatbot SHALL send alerts when error rate exceeds 10% or when Gemini API rate limits are consistently hit

---

## Summary

This requirements document defines 24 comprehensive requirements for the AI Medical Chatbot feature, covering:

- **Security**: Authentication, authorization, query whitelisting, rate limiting, input sanitization, prompt injection prevention, CORS, data filtering
- **AI Integration**: Two-pass flow, Gemini client configuration, system prompt, conversation history
- **User Experience**: Chat widget, chat window, role-based welcome messages, rate limit feedback, error handling
- **Data Access**: Role-based data scoping, query execution isolation, sensitive data filtering
- **Quality**: Testing, documentation, monitoring, performance, scalability

All requirements follow EARS patterns and INCOSE quality rules to ensure clarity, testability, and completeness. The feature maintains strict read-only access to the database while providing intelligent, context-aware medical information to authenticated users based on their roles.
