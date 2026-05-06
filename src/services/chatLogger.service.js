/**
 * Chat Logger Service
 * 
 * Logs all AI chatbot interactions to the AiChatLog table for audit trail.
 * Implements Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.9, 10.10
 */

import models from '../models/index.js';
import logger from '../utils/logger.js';

const { AiChatLog } = models;

/**
 * Log a successful AI chat interaction
 * 
 * @param {Object} logData - The interaction data to log
 * @param {number} logData.userId - User ID from JWT token
 * @param {number} logData.userRole - User role (1-6)
 * @param {string} logData.userMessage - User's input message
 * @param {string} logData.aiResponse - AI's generated response
 * @param {Array<string>} logData.selectedQueryIds - Query IDs selected by AI in Pass 1
 * @param {string} logData.ipAddress - Client IP address
 * @param {string} logData.sessionId - User session identifier
 * @param {number} logData.responseTimeMs - Response time in milliseconds
 * @returns {Promise<Object>} Created log entry
 */
export async function logInteraction(logData) {
  try {
    const {
      userId,
      userRole,
      userMessage,
      aiResponse,
      selectedQueryIds = [],
      ipAddress = null,
      sessionId = null,
      responseTimeMs = null,
    } = logData;

    // Validate required fields
    if (!userId || !userRole || !userMessage || !aiResponse) {
      logger.warn('Chat logger: Missing required fields for interaction log', {
        userId,
        userRole,
        hasMessage: !!userMessage,
        hasResponse: !!aiResponse,
      });
      throw new Error('Missing required fields for chat log');
    }

    const logEntry = await AiChatLog.create({
      user_id: userId,
      user_role: userRole,
      user_message: userMessage,
      ai_response: aiResponse,
      selected_query_ids: selectedQueryIds,
      ip_address: ipAddress,
      session_id: sessionId,
      response_time_ms: responseTimeMs,
      is_blocked: false,
      is_rate_limited: false,
    });

    logger.info('Chat interaction logged', {
      logId: logEntry.id,
      userId,
      userRole,
      messageLength: userMessage.length,
      responseTimeMs,
      queryCount: selectedQueryIds.length,
    });

    return logEntry;
  } catch (error) {
    logger.error('Failed to log chat interaction', {
      error: error.message,
      userId: logData.userId,
    });
    // Don't throw - logging failure shouldn't break the user experience
    return null;
  }
}

/**
 * Log a blocked request (e.g., prompt injection detected)
 * 
 * @param {Object} logData - The blocked request data
 * @param {number} logData.userId - User ID from JWT token
 * @param {number} logData.userRole - User role (1-6)
 * @param {string} logData.userMessage - User's input message that was blocked
 * @param {string} logData.reason - Reason for blocking (e.g., "Prompt injection detected")
 * @param {string} logData.ipAddress - Client IP address
 * @param {string} logData.sessionId - User session identifier
 * @returns {Promise<Object>} Created log entry
 */
export async function logBlockedRequest(logData) {
  try {
    const {
      userId,
      userRole,
      userMessage,
      reason,
      ipAddress = null,
      sessionId = null,
    } = logData;

    // Validate required fields
    if (!userId || !userRole || !userMessage || !reason) {
      logger.warn('Chat logger: Missing required fields for blocked request log', {
        userId,
        userRole,
        hasMessage: !!userMessage,
        hasReason: !!reason,
      });
      throw new Error('Missing required fields for blocked request log');
    }

    const logEntry = await AiChatLog.create({
      user_id: userId,
      user_role: userRole,
      user_message: userMessage,
      ai_response: `[BLOCKED] ${reason}`,
      selected_query_ids: [],
      ip_address: ipAddress,
      session_id: sessionId,
      is_blocked: true,
      is_rate_limited: false,
    });

    logger.warn('Blocked request logged', {
      logId: logEntry.id,
      userId,
      userRole,
      reason,
      ipAddress,
    });

    return logEntry;
  } catch (error) {
    logger.error('Failed to log blocked request', {
      error: error.message,
      userId: logData.userId,
      reason: logData.reason,
    });
    // Don't throw - logging failure shouldn't break the user experience
    return null;
  }
}

/**
 * Log a rate-limited request
 * 
 * @param {Object} logData - The rate-limited request data
 * @param {number} logData.userId - User ID from JWT token
 * @param {number} logData.userRole - User role (1-6)
 * @param {string} logData.userMessage - User's input message
 * @param {string} logData.limitType - Type of rate limit hit (e.g., "user" or "ip")
 * @param {string} logData.ipAddress - Client IP address
 * @param {string} logData.sessionId - User session identifier
 * @returns {Promise<Object>} Created log entry
 */
export async function logRateLimitedRequest(logData) {
  try {
    const {
      userId,
      userRole,
      userMessage,
      limitType,
      ipAddress = null,
      sessionId = null,
    } = logData;

    // Validate required fields
    if (!userId || !userRole || !userMessage || !limitType) {
      logger.warn('Chat logger: Missing required fields for rate-limited request log', {
        userId,
        userRole,
        hasMessage: !!userMessage,
        hasLimitType: !!limitType,
      });
      throw new Error('Missing required fields for rate-limited request log');
    }

    const logEntry = await AiChatLog.create({
      user_id: userId,
      user_role: userRole,
      user_message: userMessage,
      ai_response: `[RATE LIMITED] ${limitType} rate limit exceeded`,
      selected_query_ids: [],
      ip_address: ipAddress,
      session_id: sessionId,
      is_blocked: false,
      is_rate_limited: true,
    });

    logger.warn('Rate-limited request logged', {
      logId: logEntry.id,
      userId,
      userRole,
      limitType,
      ipAddress,
    });

    return logEntry;
  } catch (error) {
    logger.error('Failed to log rate-limited request', {
      error: error.message,
      userId: logData.userId,
      limitType: logData.limitType,
    });
    // Don't throw - logging failure shouldn't break the user experience
    return null;
  }
}

/**
 * Log a failed request with error details
 * 
 * @param {Object} logData - The failed request data
 * @param {number} logData.userId - User ID from JWT token
 * @param {number} logData.userRole - User role (1-6)
 * @param {string} logData.userMessage - User's input message
 * @param {string} logData.errorMessage - Error message describing the failure
 * @param {string} logData.ipAddress - Client IP address
 * @param {string} logData.sessionId - User session identifier
 * @param {number} logData.responseTimeMs - Response time before failure (optional)
 * @returns {Promise<Object>} Created log entry
 */
export async function logError(logData) {
  try {
    const {
      userId,
      userRole,
      userMessage,
      errorMessage,
      ipAddress = null,
      sessionId = null,
      responseTimeMs = null,
    } = logData;

    // Validate required fields
    if (!userId || !userRole || !userMessage || !errorMessage) {
      logger.warn('Chat logger: Missing required fields for error log', {
        userId,
        userRole,
        hasMessage: !!userMessage,
        hasError: !!errorMessage,
      });
      throw new Error('Missing required fields for error log');
    }

    const logEntry = await AiChatLog.create({
      user_id: userId,
      user_role: userRole,
      user_message: userMessage,
      ai_response: '[ERROR] Request failed',
      selected_query_ids: [],
      ip_address: ipAddress,
      session_id: sessionId,
      response_time_ms: responseTimeMs,
      error_message: errorMessage,
      is_blocked: false,
      is_rate_limited: false,
    });

    logger.error('Failed request logged', {
      logId: logEntry.id,
      userId,
      userRole,
      errorMessage,
      responseTimeMs,
    });

    return logEntry;
  } catch (error) {
    logger.error('Failed to log error', {
      error: error.message,
      userId: logData.userId,
      originalError: logData.errorMessage,
    });
    // Don't throw - logging failure shouldn't break the user experience
    return null;
  }
}

/**
 * Get chat logs for a specific user (for admin/audit purposes)
 * 
 * @param {number} userId - User ID to retrieve logs for
 * @param {Object} options - Query options
 * @param {number} options.limit - Maximum number of logs to retrieve (default: 50)
 * @param {number} options.offset - Number of logs to skip (default: 0)
 * @returns {Promise<Array>} Array of log entries
 */
export async function getUserLogs(userId, options = {}) {
  try {
    const { limit = 50, offset = 0 } = options;

    const logs = await AiChatLog.findAll({
      where: { user_id: userId },
      order: [['timestamp', 'DESC']],
      limit,
      offset,
    });

    return logs;
  } catch (error) {
    logger.error('Failed to retrieve user logs', {
      error: error.message,
      userId,
    });
    throw error;
  }
}

/**
 * Get security event logs (blocked or rate-limited requests)
 * 
 * @param {Object} options - Query options
 * @param {number} options.limit - Maximum number of logs to retrieve (default: 100)
 * @param {number} options.offset - Number of logs to skip (default: 0)
 * @returns {Promise<Array>} Array of security event log entries
 */
export async function getSecurityLogs(options = {}) {
  try {
    const { limit = 100, offset = 0 } = options;

    const logs = await AiChatLog.findAll({
      where: {
        [models.Sequelize.Op.or]: [
          { is_blocked: true },
          { is_rate_limited: true },
        ],
      },
      order: [['timestamp', 'DESC']],
      limit,
      offset,
    });

    return logs;
  } catch (error) {
    logger.error('Failed to retrieve security logs', {
      error: error.message,
    });
    throw error;
  }
}

export default {
  logInteraction,
  logBlockedRequest,
  logRateLimitedRequest,
  logError,
  getUserLogs,
  getSecurityLogs,
};
