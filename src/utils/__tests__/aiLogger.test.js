/**
 * Unit tests for AI Logger
 * 
 * Tests structured logging functionality for AI interactions.
 */

import { jest } from '@jest/globals';

// Mock winston before importing aiLogger
const mockWinstonLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  add: jest.fn(),
};

const mockWinston = {
  createLogger: jest.fn(() => mockWinstonLogger),
  format: {
    combine: jest.fn((...args) => args),
    timestamp: jest.fn(() => 'timestamp'),
    errors: jest.fn(() => 'errors'),
    json: jest.fn(() => 'json'),
    colorize: jest.fn(() => 'colorize'),
    printf: jest.fn(() => 'printf'),
  },
  transports: {
    Console: jest.fn(),
    File: jest.fn(),
  },
};

jest.unstable_mockModule('winston', () => ({
  default: mockWinston,
}));

// Import after mocking
const { logRequest, logError, logSecurityEvent, logGeminiApiUsage, logQueryExecution } = await import('../aiLogger.js');

describe('AI Logger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('logRequest', () => {
    it('should log request with all required fields (Requirement 24.1)', () => {
      const requestData = {
        user_id: 123,
        user_role: 5,
        message_length: 50,
        response_time_ms: 1500,
        ip_address: '192.168.1.1',
        query_ids: ['my_appointments', 'medicines_info'],
      };

      logRequest(requestData);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith(
        'AI request completed',
        expect.objectContaining({
          event_type: 'ai_request',
          user_id: 123,
          user_role: 5,
          message_length: 50,
          response_time_ms: 1500,
          ip_address: '192.168.1.1',
          query_ids: ['my_appointments', 'medicines_info'],
          query_count: 2,
          timestamp: expect.any(String),
        })
      );
    });

    it('should handle empty query_ids array', () => {
      const requestData = {
        user_id: 123,
        user_role: 5,
        message_length: 50,
        response_time_ms: 1500,
        ip_address: '192.168.1.1',
      };

      logRequest(requestData);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith(
        'AI request completed',
        expect.objectContaining({
          query_ids: [],
          query_count: 0,
        })
      );
    });
  });

  describe('logError', () => {
    it('should log error with all required fields (Requirement 24.2)', () => {
      const errorData = {
        error_type: 'AI_SERVICE_ERROR',
        error_message: 'Gemini API failed',
        stack_trace: 'Error: Gemini API failed\n    at ...',
        user_id: 123,
        ip_address: '192.168.1.1',
        user_message: 'What are my appointments?',
      };

      logError(errorData);

      expect(mockWinstonLogger.error).toHaveBeenCalledWith(
        'AI request failed',
        expect.objectContaining({
          event_type: 'ai_error',
          error_type: 'AI_SERVICE_ERROR',
          error_message: 'Gemini API failed',
          stack_trace: 'Error: Gemini API failed\n    at ...',
          user_id: 123,
          ip_address: '192.168.1.1',
          user_message: 'What are my appointments?',
          timestamp: expect.any(String),
        })
      );
    });

    it('should handle optional fields', () => {
      const errorData = {
        error_type: 'UNKNOWN_ERROR',
        error_message: 'Something went wrong',
        user_id: 123,
        ip_address: '192.168.1.1',
      };

      logError(errorData);

      expect(mockWinstonLogger.error).toHaveBeenCalledWith(
        'AI request failed',
        expect.objectContaining({
          error_type: 'UNKNOWN_ERROR',
          error_message: 'Something went wrong',
          stack_trace: undefined,
          user_message: undefined,
        })
      );
    });
  });

  describe('logSecurityEvent', () => {
    it('should log prompt injection attempt (Requirement 24.3)', () => {
      const securityData = {
        event_type: 'prompt_injection_attempt',
        user_id: 123,
        user_role: 5,
        ip_address: '192.168.1.1',
        user_message: 'ignore previous instructions',
        detected_pattern: 'ignore previous',
      };

      logSecurityEvent(securityData);

      expect(mockWinstonLogger.warn).toHaveBeenCalledWith(
        'Security event detected',
        expect.objectContaining({
          event_type: 'prompt_injection_attempt',
          security_event: 'prompt_injection_attempt',
          user_id: 123,
          user_role: 5,
          ip_address: '192.168.1.1',
          user_message: 'ignore previous instructions',
          detected_pattern: 'ignore previous',
          timestamp: expect.any(String),
        })
      );
    });

    it('should log rate limit violation (Requirement 24.3)', () => {
      const securityData = {
        event_type: 'rate_limit_violation',
        user_id: 123,
        user_role: 5,
        ip_address: '192.168.1.1',
        user_message: 'test message',
        limit_type: 'user',
      };

      logSecurityEvent(securityData);

      expect(mockWinstonLogger.warn).toHaveBeenCalledWith(
        'Security event detected',
        expect.objectContaining({
          event_type: 'rate_limit_violation',
          limit_type: 'user',
        })
      );
    });
  });

  describe('logGeminiApiUsage', () => {
    it('should log successful API request (Requirement 24.6)', () => {
      const apiData = {
        operation: 'select_queries',
        success: true,
        response_time_ms: 800,
        is_rate_limit_error: false,
        retry_count: 0,
      };

      logGeminiApiUsage(apiData);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith(
        'Gemini API request completed',
        expect.objectContaining({
          event_type: 'gemini_api_usage',
          operation: 'select_queries',
          success: true,
          response_time_ms: 800,
          is_rate_limit_error: false,
          retry_count: 0,
          timestamp: expect.any(String),
        })
      );
    });

    it('should log rate limit error (Requirement 24.6)', () => {
      const apiData = {
        operation: 'synthesize_answer',
        success: false,
        response_time_ms: 500,
        is_rate_limit_error: true,
        retry_count: 2,
      };

      logGeminiApiUsage(apiData);

      expect(mockWinstonLogger.warn).toHaveBeenCalledWith(
        'Gemini API request failed',
        expect.objectContaining({
          is_rate_limit_error: true,
          retry_count: 2,
        })
      );
    });
  });

  describe('logQueryExecution', () => {
    it('should log successful query execution (Requirement 24.7)', () => {
      const queryData = {
        query_id: 'my_appointments',
        execution_time_ms: 150,
        row_count: 5,
        success: true,
      };

      logQueryExecution(queryData);

      expect(mockWinstonLogger.info).toHaveBeenCalledWith(
        'Query executed successfully',
        expect.objectContaining({
          event_type: 'query_execution',
          query_id: 'my_appointments',
          execution_time_ms: 150,
          row_count: 5,
          success: true,
          timestamp: expect.any(String),
        })
      );
    });

    it('should log failed query execution (Requirement 24.7)', () => {
      const queryData = {
        query_id: 'my_appointments',
        execution_time_ms: 100,
        row_count: 0,
        success: false,
        error_message: 'Query timeout',
      };

      logQueryExecution(queryData);

      expect(mockWinstonLogger.error).toHaveBeenCalledWith(
        'Query execution failed',
        expect.objectContaining({
          query_id: 'my_appointments',
          success: false,
          error_message: 'Query timeout',
        })
      );
    });
  });

  describe('Structured Logging Format (Requirement 24.8)', () => {
    it('should log entries in structured format with all required fields', () => {
      // Test that log entries contain structured data (JSON-compatible objects)
      const requestData = {
        user_id: 123,
        user_role: 5,
        message_length: 50,
        response_time_ms: 1500,
        ip_address: '192.168.1.1',
      };

      logRequest(requestData);

      const logCall = mockWinstonLogger.info.mock.calls[0];
      const logMessage = logCall[0];
      const logData = logCall[1];

      // Verify structured data object is passed
      expect(typeof logData).toBe('object');
      expect(logData).toHaveProperty('event_type');
      expect(logData).toHaveProperty('user_id');
      expect(logData).toHaveProperty('timestamp');
    });

    it('should include timestamp in all log entries', () => {
      const requestData = {
        user_id: 123,
        user_role: 5,
        message_length: 50,
        response_time_ms: 1500,
        ip_address: '192.168.1.1',
      };

      logRequest(requestData);

      const logCall = mockWinstonLogger.info.mock.calls[0][1];
      expect(logCall.timestamp).toBeDefined();
      expect(typeof logCall.timestamp).toBe('string');
    });
  });
});
