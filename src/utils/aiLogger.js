/**
 * AI Logger Module
 * 
 * Extends the base winston logger with structured logging specifically for AI interactions.
 * 
 * Logs all AI requests, errors, and security events in JSON format for easy parsing
 * by log aggregation tools.
 */

import winston from 'winston';
import path from 'path';
import { fileURLToPath } from 'url';
import config from '../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * JSON format for structured logging
 * Requirement 24.8: Use structured logging (JSON format)
 */
const jsonFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Create AI-specific logger with structured logging
 */
const aiLogger = winston.createLogger({
  level: config.logging.level,
  format: jsonFormat,
  defaultMeta: { service: 'ai-chatbot' },
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const metaStr = Object.keys(meta).length && meta.service !== 'ai-chatbot' 
            ? JSON.stringify(meta, null, 2) 
            : '';
          return `${timestamp} [${level}] [AI]: ${message} ${metaStr}`;
        })
      ),
    }),
  ],
});

// Add file transports in production
if (config.isProduction) {
  const logsDir = path.join(__dirname, '../../logs');
  
  // AI-specific error log
  aiLogger.add(
    new winston.transports.File({
      filename: path.join(logsDir, 'ai-error.log'),
      level: 'error',
      format: jsonFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );

  // AI-specific combined log
  aiLogger.add(
    new winston.transports.File({
      filename: path.join(logsDir, 'ai-combined.log'),
      format: jsonFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    })
  );

  // Security events log
  aiLogger.add(
    new winston.transports.File({
      filename: path.join(logsDir, 'ai-security.log'),
      level: 'warn',
      format: jsonFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 10, // Keep more security logs
    })
  );
}

/**
 * Log an AI request with structured data
 * 
 * Requirement 24.1: Log all requests with: timestamp, user_id, user_role, 
 * message_length, response_time_ms
 * 
 * @param {Object} requestData - Request data to log
 * @param {number} requestData.user_id - User ID from JWT token
 * @param {number} requestData.user_role - User role (1-6)
 * @param {number} requestData.message_length - Length of user message
 * @param {number} requestData.response_time_ms - Response time in milliseconds
 * @param {string} requestData.ip_address - Client IP address
 * @param {Array<string>} requestData.query_ids - Selected query IDs
 */
export function logRequest(requestData) {
  const {
    user_id,
    user_role,
    message_length,
    response_time_ms,
    ip_address,
    query_ids = [],
  } = requestData;

  aiLogger.info('AI request completed', {
    event_type: 'ai_request',
    user_id,
    user_role,
    message_length,
    response_time_ms,
    ip_address,
    query_ids,
    query_count: query_ids.length,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Log an AI error with structured data
 * 
 * Requirement 24.2: Log all errors with: error_type, error_message, 
 * stack_trace, user_id, ip_address
 * 
 * @param {Object} errorData - Error data to log
 * @param {string} errorData.error_type - Type of error (e.g., 'AI_SERVICE_ERROR')
 * @param {string} errorData.error_message - Error message
 * @param {string} errorData.stack_trace - Stack trace (optional)
 * @param {number} errorData.user_id - User ID from JWT token
 * @param {string} errorData.ip_address - Client IP address
 * @param {string} errorData.user_message - User's input message (optional)
 */
export function logError(errorData) {
  const {
    error_type,
    error_message,
    stack_trace,
    user_id,
    ip_address,
    user_message,
  } = errorData;

  aiLogger.error('AI request failed', {
    event_type: 'ai_error',
    error_type,
    error_message,
    stack_trace,
    user_id,
    ip_address,
    user_message,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Log a security event
 * 
 * Requirement 24.3: Log all security events: prompt_injection_attempts, 
 * rate_limit_violations, unauthorized_access
 * 
 * @param {Object} securityData - Security event data to log
 * @param {string} securityData.event_type - Type of security event
 * @param {number} securityData.user_id - User ID from JWT token
 * @param {number} securityData.user_role - User role (1-6)
 * @param {string} securityData.ip_address - Client IP address
 * @param {string} securityData.user_message - User's input message
 * @param {string} securityData.detected_pattern - Detected malicious pattern (optional)
 * @param {string} securityData.limit_type - Type of rate limit (optional)
 */
export function logSecurityEvent(securityData) {
  const {
    event_type,
    user_id,
    user_role,
    ip_address,
    user_message,
    detected_pattern,
    limit_type,
  } = securityData;

  aiLogger.warn('Security event detected', {
    event_type,
    security_event: event_type,
    user_id,
    user_role,
    ip_address,
    user_message,
    detected_pattern,
    limit_type,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Log Gemini API usage
 * 
 * Requirement 24.6: Log Gemini API usage: requests_sent, rate_limit_errors
 * 
 * @param {Object} apiData - API usage data to log
 * @param {string} apiData.operation - Operation type ('select_queries' or 'synthesize_answer')
 * @param {boolean} apiData.success - Whether the request succeeded
 * @param {number} apiData.response_time_ms - Response time in milliseconds
 * @param {boolean} apiData.is_rate_limit_error - Whether this was a rate limit error
 * @param {number} apiData.retry_count - Number of retries attempted
 */
export function logGeminiApiUsage(apiData) {
  const {
    operation,
    success,
    response_time_ms,
    is_rate_limit_error = false,
    retry_count = 0,
  } = apiData;

  const level = success ? 'info' : 'warn';
  const message = success ? 'Gemini API request completed' : 'Gemini API request failed';

  aiLogger[level](message, {
    event_type: 'gemini_api_usage',
    operation,
    success,
    response_time_ms,
    is_rate_limit_error,
    retry_count,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Log query execution statistics
 * 
 * Requirement 24.7: Log query execution statistics: query_id, execution_count, 
 * average_execution_time
 * 
 * @param {Object} queryData - Query execution data to log
 * @param {string} queryData.query_id - Query identifier
 * @param {number} queryData.execution_time_ms - Execution time in milliseconds
 * @param {number} queryData.row_count - Number of rows returned
 * @param {boolean} queryData.success - Whether the query succeeded
 * @param {string} queryData.error_message - Error message if failed (optional)
 */
export function logQueryExecution(queryData) {
  const {
    query_id,
    execution_time_ms,
    row_count,
    success,
    error_message,
  } = queryData;

  const level = success ? 'info' : 'error';
  const message = success ? 'Query executed successfully' : 'Query execution failed';

  aiLogger[level](message, {
    event_type: 'query_execution',
    query_id,
    execution_time_ms,
    row_count,
    success,
    error_message,
    timestamp: new Date().toISOString(),
  });
}

export default aiLogger;
