# Implementation Plan: AI Medical Chatbot

## Overview

This implementation plan breaks down the AI Medical Chatbot feature into discrete, sequential coding tasks. The feature provides authenticated users with intelligent, role-based access to medical information through a conversational AI interface powered by Google Gemini 2.0 Flash. Implementation follows a two-pass AI flow (query selection → answer synthesis) with comprehensive security measures including authentication, rate limiting, input sanitization, and prompt injection prevention.

## Tasks

- [x] 1. Set up project dependencies and environment configuration
  - Install `@google/generative-ai` package for Gemini AI integration
  - Add `GEMINI_API_KEY` to `.env.example` with documentation
  - Create environment variable validation in `src/config/index.js` for GEMINI_API_KEY
  - _Requirements: 8.3, 23.4_

- [x] 2. Create database migration and model for AiChatLog
  - [x] 2.1 Create migration file for AiChatLog table
    - Create migration in `backend/database/migrations/` with table schema
    - Include all fields: user_id, user_role, user_message, ai_response, selected_query_ids, timestamp, ip_address, session_id, response_time_ms, error_message, is_blocked, is_rate_limited
    - Add indexes on user_id, timestamp, and is_blocked
    - Add foreign key constraint to Users table
    - _Requirements: 10.1, 10.2_
  
  - [x] 2.2 Create Sequelize model for AiChatLog
    - Create `src/models/AiChatLog.js` with model definition
    - Implement JSON getter/setter for selected_query_ids field
    - Configure timestamps: false (using custom timestamp field)
    - _Requirements: 10.1, 10.2_

- [x] 3. Implement core security middleware components
  - [x] 3.1 Create AI rate limiter middleware
    - Create `src/middleware/aiRateLimiter.js` with in-memory rate limiting
    - Implement user-based rate limiting (20 requests / 10 minutes)
    - Implement IP-based rate limiting (50 requests / 10 minutes)
    - Add rate limit headers: X-RateLimit-Remaining-User, X-RateLimit-Remaining-IP
    - Return 429 error with cooldown time when limits exceeded
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.9_
  
  - [x] 3.2 Write property tests for rate limiter
    - **Property 5: User Rate Limiting**
    - **Validates: Requirements 4.1, 4.3**
    - Test that 21st request from same user is rejected with 429
    - **Property 6: IP Rate Limiting**
    - **Validates: Requirements 4.2, 4.3**
    - Test that 51st request from same IP is rejected with 429
  
  - [x] 3.3 Create input sanitizer middleware
    - Create `src/middleware/aiSanitizer.js` with input validation
    - Trim whitespace and enforce 500 character limit
    - Strip HTML tags and script injection patterns
    - Detect prompt injection patterns (case-insensitive)
    - Return 400 error for invalid input with security logging
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8_
  
  - [x] 3.4 Write property tests for input sanitizer
    - **Property 7: Message Length Validation**
    - **Validates: Requirements 5.2, 5.3**
    - Test that messages over 500 characters are rejected
    - **Property 8: Prompt Injection Detection**
    - **Validates: Requirements 5.6, 5.7, 5.8**
    - Test that prompt injection patterns are detected and blocked

- [x] 4. Implement data filtering and security utilities
  - [x] 4.1 Create data filter utility
    - Create `src/utils/dataFilter.js` with sensitive field stripping
    - Filter passwords, JWT tokens, SSNs, credit cards
    - Redact phone/email for non-owner users
    - Implement 10,000 character truncation with truncation notice
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8_
  
  - [x] 4.2 Write property tests for data filter
    - **Property 12: Sensitive Data Filtering**
    - **Validates: Requirements 18.1, 18.2, 18.3, 18.4, 18.5**
    - Test that sensitive fields are stripped from query results
    - **Property 13: Data Truncation**
    - **Validates: Requirements 18.7, 18.8**
    - Test that results over 10,000 characters are truncated
  
  - [x] 4.3 Create query result parser and serializer
    - Create `src/utils/queryResultParser.js` with Sequelize result parsing
    - Handle nested associations and Date object conversion
    - Handle null/undefined values gracefully
    - Create serializer with metadata (query_id, row_count, execution_time_ms)
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.9_
  
  - [x] 4.4 Write property tests for parser round-trip
    - **Property 14: Parser Round-Trip Preservation**
    - **Validates: Requirements 21.8**
    - Test that parse → serialize → parse produces equivalent object

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement query whitelist and handler
  - [x] 6.1 Create query whitelist configuration
    - Create `src/config/queryWhitelist.js` with Map-based whitelist
    - Define patient-scoped queries: my_appointments, my_prescriptions, my_lab_results, my_medical_history
    - Define clinical queries: medicines_info, patient_medical_history, lab_tests_pending, low_stock_medicines, appointment_schedule
    - Include query_id, description, requiredRoles, and handler function for each
    - Add inline comments explaining purpose and required roles
    - _Requirements: 2.1, 2.4, 2.6, 2.7, 23.2_
  
  - [x] 6.2 Create query handler service
    - Create `src/services/queryHandler.service.js` with query execution
    - Verify query_id exists in whitelist before execution
    - Verify user role is in requiredRoles array
    - Execute queries through Sequelize models (no raw SQL)
    - Apply role-based filtering (patient data scoping)
    - Implement 5-second query timeout
    - Return parsed and filtered results
    - _Requirements: 2.2, 2.3, 2.5, 2.8, 2.9, 3.8, 17.1, 17.2, 17.6, 17.8_
  
  - [x] 6.3 Write property tests for query handler
    - **Property 2: Query Whitelist Verification**
    - **Validates: Requirements 2.2, 2.3**
    - Test that non-whitelisted queries are rejected
    - **Property 3: Patient Data Scoping**
    - **Validates: Requirements 3.1, 3.10**
    - Test that patient users only see their own data
    - **Property 4: Role Permission Enforcement**
    - **Validates: Requirements 3.7, 3.8**
    - Test that queries are rejected when role not in requiredRoles
    - **Property 11: Query Timeout Protection**
    - **Validates: Requirements 17.8**
    - Test that queries exceeding 5 seconds are timed out
  
  - [x] 6.4 Write unit tests for query handler
    - Test role-based filtering for all user roles
    - Test error handling for database errors
    - Test query result parsing and serialization
    - _Requirements: 22.4_

- [x] 7. Implement Gemini AI service
  - [x] 7.1 Create Gemini service with client initialization
    - Create `src/services/gemini.service.js` with GoogleGenerativeAI client
    - Initialize with gemini-2.0-flash model
    - Configure systemInstruction with hardcoded Dr. AI prompt
    - Implement retry logic for 429 errors (3 attempts, 2-second delay)
    - Implement internal rate limit (10 requests/minute)
    - _Requirements: 6.1, 6.2, 6.10, 6.11, 8.1, 8.2, 8.4, 8.5, 8.6, 8.7, 8.9_
  
  - [x] 7.2 Implement Pass 1: Query Selection
    - Create selectQueries method with JSON mode (responseMimeType: "application/json")
    - Provide available query_ids filtered by user role
    - Parse JSON response to extract query_ids array
    - Handle empty query_ids array gracefully
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.10_
  
  - [x] 7.3 Write property tests for JSON parsing
    - **Property 9: JSON Response Parsing**
    - **Validates: Requirements 7.4**
    - Test that valid JSON responses are parsed correctly without data loss
  
  - [x] 7.4 Implement Pass 2: Answer Synthesis
    - Create synthesizeAnswer method with conversation history
    - Include user question, query results, and last 10 messages
    - Use "user" and "model" role names in history
    - Format query results with metadata
    - _Requirements: 7.6, 7.7, 7.8, 7.9_
  
  - [x] 7.5 Write unit tests for Gemini service
    - Test retry logic for 429 errors
    - Test internal rate limiting
    - Test error handling for network failures
    - Test Pass 1 and Pass 2 integration
    - _Requirements: 22.6, 22.10_

- [x] 8. Implement conversation history manager
  - [x] 8.1 Create conversation manager service
    - Create `src/services/conversationManager.js` with in-memory storage
    - Store last 10 messages per user session
    - Remove oldest message when exceeding 10
    - Store messages with role ("user" or "model") and content
    - Implement session lifecycle management
    - _Requirements: 9.1, 9.2, 9.3, 9.5, 9.6, 9.7, 9.8, 9.9_
  
  - [x] 8.2 Write property tests for conversation history
    - **Property 10: Conversation History Bounded Queue**
    - **Validates: Requirements 9.1, 9.2**
    - Test that history never exceeds 10 messages
  
  - [x] 8.3 Write unit tests for conversation manager
    - Test session isolation between users
    - Test message appending and retrieval
    - Test history clearing
    - _Requirements: 22.8_

- [x] 9. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Implement chat logger service
  - [x] 10.1 Create chat logger service
    - Create `src/services/chatLogger.service.js` with AiChatLog integration
    - Log all interactions with required fields
    - Log security events (prompt injection, rate limits) with flags
    - Log performance metrics (response_time_ms)
    - Log errors with error_message field
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.9, 10.10_
  
  - [x] 10.2 Write unit tests for chat logger
    - Test successful interaction logging
    - Test security event logging with flags
    - Test error logging
    - Test performance metric tracking

- [x] 11. Implement AI controller with two-pass flow
  - [x] 11.1 Create AI controller with chat endpoint
    - Create `src/controllers/ai.controller.js` with asyncErrorHandler wrapper
    - Implement POST /api/ai/chat handler
    - Orchestrate two-pass flow: Pass 1 → query execution → Pass 2
    - Manage conversation history (append user message, append AI response)
    - Log interaction to AiChatLog
    - Return response with success, data.response, data.queryIds, data.remainingRequests
    - _Requirements: 7.1, 7.5, 7.6, 9.8, 9.9, 11.1, 11.2, 11.3_
  
  - [x] 11.2 Implement additional AI endpoints
    - Implement GET /api/ai/history (return last 10 messages)
    - Implement GET /api/ai/rate-status (return rate limit status)
    - Implement DELETE /api/ai/history (clear conversation history)
    - Implement GET /api/ai/metrics (admin only, return usage metrics)
    - _Requirements: 11.4, 11.5, 11.6, 11.7, 11.8, 24.4, 24.5_
  
  - [x] 11.3 Write integration tests for AI controller
    - Test complete two-pass flow for patient query
    - Test role-based access control on queries
    - Test conversation history persistence across messages
    - Test error handling (AI service down, database errors)
    - Test audit logging to AiChatLog
    - _Requirements: 22.2, 22.4, 22.6, 22.8_
  
  - [x] 11.4 Write unit tests for controller methods
    - Test endpoint input validation
    - Test error response formatting
    - Test rate limit header inclusion
    - _Requirements: 22.1_

- [x] 12. Create AI routes with middleware chain
  - [x] 12.1 Create AI routes file
    - Create `src/routes/ai.routes.js` with Express router
    - Apply middleware chain: auth → rate limiter → sanitizer → controller
    - Mount POST /chat, GET /history, GET /rate-status, DELETE /history, GET /metrics
    - Add role check for /metrics endpoint (admin only)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 11.9_
  
  - [x] 12.2 Register AI routes in main router
    - Import and mount AI routes in `src/routes/index.js` under /api/ai
    - _Requirements: 11.1_
  
  - [x] 12.3 Write property tests for authentication
    - **Property 1: JWT Token Extraction**
    - **Validates: Requirements 1.3**
    - Test that valid JWT tokens are correctly parsed for user ID and role

- [x] 13. Implement security headers and CORS
  - [x] 13.1 Configure security middleware in app.js
    - Add helmet middleware for security headers
    - Configure CORS with CORS_ORIGIN whitelist
    - Add body size limit (10KB) for AI endpoints
    - Add Content-Type validation for POST requests
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7_
  
  - [x] 13.2 Write security tests
    - Test CORS policy enforcement
    - Test Content-Type validation
    - Test body size limit
    - Test prompt injection detection and logging
    - _Requirements: 22.3, 22.7_

- [x] 14. Checkpoint - Ensure all backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Implement frontend AI service
  - [x] 15.1 Create AI service for API calls
    - Create `src/services/ai.service.js` with API wrapper methods
    - Implement sendMessage(message) method
    - Implement getHistory() method
    - Implement getRateStatus() method
    - Implement clearHistory() method
    - Use existing `api.js` wrapper for authentication and error handling
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8_
  
  - [x] 15.2 Write unit tests for AI service
    - Test API call formatting
    - Test error handling and parsing
    - Test authentication header inclusion

- [x] 16. Implement Chat Message component
  - [x] 16.1 Create ChatMessage component
    - Create `src/components/ChatMessage.jsx` with role-based styling
    - Support roles: "user", "model", "system"
    - Apply different styling for user (right-aligned, blue) vs model (left-aligned, gray)
    - Format timestamps
    - Support markdown rendering in AI responses
    - _Requirements: 13.7, 13.8_
  
  - [x] 16.2 Write unit tests for ChatMessage
    - Test role-based styling
    - Test markdown rendering
    - Test timestamp formatting

- [x] 17. Implement Chat Window component
  - [x] 17.1 Create ChatWindow component
    - Create `src/components/ChatWindow.jsx` with 400x600px dimensions
    - Include header with "Dr. AI - Medical Assistant" title and minimize/close buttons
    - Include scrollable message area with auto-scroll to latest
    - Include input field with send button (Enter key support)
    - Display loading indicator while waiting for AI response
    - Display disclaimer: "AI provides consultation only, not a substitute for official medical diagnosis"
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.9, 13.10, 13.11, 13.12_
  
  - [x] 17.2 Implement role-based welcome messages
    - Display welcome message based on user role on first open
    - Use WELCOME_MESSAGES map for role-specific greetings
    - Style welcome message differently (centered, italic)
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8_
  
  - [x] 17.3 Implement rate limit UI feedback
    - Display remaining request count in header: "X/20 questions remaining"
    - Color code: green (>50%), yellow (<50%), red (0%)
    - Display rate limit message with cooldown time when limited
    - Display reset time: "Limit resets at HH:MM"
    - Update count after each message
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8_
  
  - [x] 17.4 Implement error handling UI
    - Display user-friendly error messages for different error types
    - Style error messages distinctly (red background)
    - Allow retry after errors
    - Log errors to console for debugging
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.9, 16.10_
  
  - [x] 17.5 Write unit tests for ChatWindow
    - Test message rendering and auto-scroll
    - Test input handling and Enter key
    - Test loading state display
    - Test error message display
    - Test rate limit UI updates

- [x] 18. Implement Chat Widget component
  - [x] 18.1 Create ChatWidget component
    - Create `src/components/ChatWidget.jsx` with floating button
    - Position fixed at bottom-right (20px from edges)
    - 60x60px rounded button with medical icon (💊 or 🤖)
    - Display unread message badge when applicable
    - Toggle ChatWindow open/close on click
    - Smooth animation for open/close
    - High z-index (1000) to appear above other content
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 12.10_
  
  - [x] 18.2 Integrate ChatWidget into main layout
    - Import and render ChatWidget in appropriate layout component
    - Ensure widget is accessible on all authenticated pages
    - Use AuthContext to get user role for welcome messages
  
  - [x] 18.3 Write unit tests for ChatWidget
    - Test toggle functionality
    - Test badge display
    - Test positioning and styling
    - Test integration with ChatWindow

- [x] 19. Checkpoint - Ensure all frontend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 20. Implement monitoring and logging
  - [x] 20.1 Add structured logging for AI interactions
    - Configure winston logger for AI module
    - Log all requests with timestamp, user_id, user_role, message_length, response_time_ms
    - Log all errors with error_type, error_message, stack_trace, user_id, ip_address
    - Log security events: prompt_injection_attempts, rate_limit_violations, unauthorized_access
    - Use JSON format for structured logging
    - _Requirements: 24.1, 24.2, 24.3, 24.8_
  
  - [x] 20.2 Implement metrics collection
    - Track total_requests, average_response_time, error_rate, rate_limit_hits, active_users
    - Track Gemini API usage: requests_sent, rate_limit_errors
    - Track query execution statistics: query_id, execution_count, average_execution_time
    - Expose metrics via GET /api/ai/metrics endpoint
    - _Requirements: 24.4, 24.5, 24.6, 24.7_
  
  - [x] 20.3 Write unit tests for logging and metrics
    - Test log entry formatting
    - Test metrics calculation
    - Test metrics endpoint response

- [x] 21. Create documentation
  - [x] 21.1 Create AI chatbot README
    - Create `docs/AI_CHATBOT.md` with setup instructions
    - Document GEMINI_API_KEY environment variable setup
    - Document all AI-related environment variables
    - Include examples of adding new queries to Query_Whitelist
    - Document security architecture and threat model
    - Include example API requests and responses
    - Add troubleshooting section for common issues
    - Add changelog section for tracking updates
    - _Requirements: 23.1, 23.3, 23.4, 23.5, 23.6, 23.8, 23.9, 23.10_
  
  - [x] 21.2 Add JSDoc comments to all exported functions
    - Add JSDoc comments to Gemini service methods
    - Add JSDoc comments to query handler methods
    - Add JSDoc comments to middleware functions
    - Add JSDoc comments to utility functions
    - _Requirements: 23.7_
  
  - [x] 21.3 Update main README with AI chatbot feature
    - Add AI chatbot section to main README
    - Link to detailed AI_CHATBOT.md documentation
    - Add setup instructions for Gemini API key

- [x] 22. Performance optimization and caching
  - [x] 22.1 Implement query result caching
    - Add in-memory cache for frequently accessed queries (60-second TTL)
    - Implement cache key generation based on query_id and user context
    - Add cache hit/miss metrics
    - _Requirements: 20.2_
  
  - [x] 22.2 Implement request queuing
    - Limit concurrent Gemini API calls to 5 per server instance
    - Queue additional requests with max queue size of 20
    - Return 503 error when queue is full
    - _Requirements: 20.4, 20.5, 20.6_
  
  - [x] 22.3 Add request timeouts
    - Implement 30-second request timeout for AI endpoints
    - Handle timeout gracefully with user-friendly message
    - _Requirements: 20.7_
  
  - [x] 22.4 Write performance tests
    - Test response time under normal load (<5 seconds)
    - Test cache effectiveness
    - Test queue behavior under high load
    - _Requirements: 20.1, 20.9_

- [x] 23. Final integration and end-to-end testing
  - [x] 23.1 Write end-to-end integration tests
    - Test complete user flow: login → open chat → send message → receive response
    - Test role-based data access for all user roles
    - Test rate limiting across multiple users
    - Test error recovery and retry logic
    - Test conversation history across multiple messages
  
  - [x] 23.2 Write security integration tests
    - Test cross-patient data leakage prevention
    - Test prompt injection detection and blocking
    - Test SQL injection prevention
    - Test sensitive data filtering
    - _Requirements: 22.3, 22.4, 22.5, 22.7, 22.9_
  
  - [x] 23.3 Manual testing checklist
    - Test all user roles (admin, doctor, receptionist, pharmacist, patient, labtech)
    - Test all whitelisted queries
    - Test rate limiting behavior
    - Test error handling for various scenarios
    - Test UI responsiveness and animations
    - Test on different browsers and screen sizes

- [x] 24. Final checkpoint - Ensure all tests pass and feature is complete
  - Ensure all tests pass, ask the user if questions arise.
  - Verify all 24 requirements are implemented
  - Verify all 14 correctness properties are tested
  - Review security measures and audit logging
  - Confirm documentation is complete

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties (14 properties total)
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end flows and security
- The two-pass AI flow (Pass 1: query selection → Pass 2: answer synthesis) is central to the architecture
- All database queries use Sequelize ORM (no raw SQL) for security
- Rate limiting uses in-memory storage (consider Redis for production scaling)
- Conversation history is stored in-memory per session (not persisted to database)
- All AI interactions are logged to AiChatLog table for audit trail
- Frontend chat widget is accessible on all authenticated pages
- Role-based welcome messages and data access ensure appropriate user experience
- Comprehensive error handling provides user-friendly messages without exposing system internals

## Implementation Language

**JavaScript (Node.js + React)** - The design document uses JavaScript throughout, matching the existing tech stack (Express backend, React frontend, Sequelize ORM).

## Security Highlights

- **Authentication**: JWT token validation on all requests
- **Authorization**: Role-based query access control
- **Input Validation**: 500 char limit, HTML stripping, prompt injection detection
- **Query Security**: Whitelist-only, no raw SQL, 5-second timeout
- **Data Protection**: Sensitive field filtering, PII redaction, 10KB truncation
- **Rate Limiting**: 20/user, 50/IP per 10 minutes
- **Audit Trail**: Complete logging to AiChatLog table
- **CORS**: Strict origin whitelist with helmet security headers

## Performance Targets

- Response time: < 5 seconds under normal load
- Query timeout: 5 seconds maximum
- Request timeout: 30 seconds maximum
- Cache TTL: 60 seconds for query results
- Concurrent Gemini calls: 5 maximum per server
- Request queue: 20 maximum queued requests
- Gemini internal rate limit: 10 requests/minute
