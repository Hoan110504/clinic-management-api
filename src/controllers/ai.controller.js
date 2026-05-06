/**
 * AI Controller
 * 
 * Handles AI Medical Chatbot endpoints with two-pass flow orchestration.
 * 
 * Two-Pass Flow:
 * 1. Pass 1: Query Selection - AI selects relevant query_ids from whitelist
 * 2. Query Execution - Execute selected queries with role-based filtering
 * 3. Pass 2: Answer Synthesis - AI generates natural language response
 * 
 * Requirements: 7.1, 7.5, 7.6, 9.8, 9.9, 11.1, 11.2, 11.3, 20.7
 */

import geminiService from '../services/gemini.service.js';
import queryHandler from '../services/queryHandler.service.js';
import conversationManager from '../services/conversationManager.js';
import chatLogger from '../services/chatLogger.service.js';
import metricsService from '../services/metrics.service.js';
import { getAvailableQueries } from '../config/queryWhitelist.js';
import { getRateLimitStatus } from '../middleware/aiRateLimiter.js';
import { AppError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import aiLogger, { logRequest, logError as logAiError } from '../utils/aiLogger.js';

/**
 * Request timeout in milliseconds (30 seconds)
 * Requirement 20.7
 */
const REQUEST_TIMEOUT_MS = 30000;

/**
 * Create a timeout promise that rejects after specified milliseconds
 * @param {number} ms - Timeout in milliseconds
 * @returns {Promise} Promise that rejects with timeout error
 */
function createRequestTimeout(ms) {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new AppError(
        'Request timeout. Please try again.',
        408,
        'REQUEST_TIMEOUT'
      ));
    }, ms);
  });
}

/**
 * POST /api/ai/chat
 * 
 * Main chat endpoint that orchestrates the two-pass AI flow:
 * 1. Append user message to conversation history
 * 2. Pass 1: AI selects relevant query_ids
 * 3. Execute selected queries with role-based filtering
 * 4. Pass 2: AI synthesizes answer using query results
 * 5. Append AI response to conversation history
 * 6. Log interaction to AiChatLog
 * 7. Return response with remaining rate limit info
 * 
 * Requirements: 7.1, 7.5, 7.6, 9.8, 9.9, 11.1, 11.2, 11.3, 20.7
 */
export const chat = async (req, res, next) => {
  const startTime = Date.now();
  
  try {
    // Wrap the entire chat logic with timeout (Requirement 20.7)
    await Promise.race([
      chatHandler(req, res, next, startTime),
      createRequestTimeout(REQUEST_TIMEOUT_MS)
    ]);
  } catch (error) {
    // Handle timeout and other errors
    const responseTimeMs = Date.now() - startTime;
    const errorType = error.code || 'UNKNOWN_ERROR';
    const errorMessage = error.message || 'Unknown error occurred';
    const stackTrace = error.stack || '';
    
    // Structured error logging (Requirement 24.2)
    logAiError({
      error_type: errorType,
      error_message: errorMessage,
      stack_trace: stackTrace,
      user_id: req.user?.id,
      ip_address: req.ip || req.connection.remoteAddress || 'unknown',
      user_message: req.body?.message || '',
    });
    
    // Record error metrics
    metricsService.recordRequest({
      response_time_ms: responseTimeMs,
      is_error: true,
      is_rate_limited: error.statusCode === 429,
      user_id: req.user?.id,
    });
    
    try {
      await chatLogger.logError({
        userId: req.user?.id,
        userRole: req.user?.role,
        userMessage: req.body?.message || '',
        errorMessage,
        ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
        sessionId: `session_${req.user?.id}`,
        responseTimeMs,
      });
    } catch (logError) {
      logger.error('Failed to log error', {
        error: logError.message,
      });
    }
    
    next(error);
  }
};

/**
 * Internal chat handler function (separated for timeout wrapping)
 * @private
 */
async function chatHandler(req, res, next, startTime) {
  const { message } = req.body;
  const userId = req.user.id;
  const userRole = req.user.role;
  const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
  const sessionId = `session_${userId}`;
  
  // Validate message field
  if (!message || typeof message !== 'string') {
    throw new AppError('Message field is required and must be a string', 400, 'INVALID_INPUT');
  }
  
  // Get conversation history before adding new message
  const conversationHistory = conversationManager.getHistory(userId);
  
  // Append user message to conversation history (Requirement 9.8)
  conversationManager.appendMessage(userId, 'user', message);
  
  // Get available queries for user's role
  const availableQueries = getAvailableQueries(userRole);
  
  logger.info('AI chat request started', {
    userId,
    userRole,
    messageLength: message.length,
    availableQueriesCount: availableQueries.length,
  });
  
  // ========================================================================
  // PASS 1: Query Selection
  // AI selects relevant query_ids from the whitelist
  // ========================================================================
  
  let selectedQueryIds = [];
  try {
    selectedQueryIds = await geminiService.selectQueries(
      message,
      availableQueries,
      conversationHistory
    );
    
    logger.info('Pass 1 completed', {
      userId,
      selectedQueryIds,
      queryCount: selectedQueryIds.length,
    });
  } catch (error) {
    logger.error('Pass 1 failed', {
      userId,
      error: error.message,
    });
    
    // If Pass 1 fails, continue with empty query results
    // The AI can still respond based on general knowledge
    selectedQueryIds = [];
  }
  
  // ========================================================================
  // Query Execution
  // Execute selected queries with role-based filtering
  // ========================================================================
  
  let queryResults = [];
  if (selectedQueryIds.length > 0) {
    try {
      queryResults = await queryHandler.executeMultipleQueries(
        selectedQueryIds,
        userId,
        userRole
      );
      
      logger.info('Query execution completed', {
        userId,
        queryCount: queryResults.length,
        successCount: queryResults.filter(r => !r.error).length,
      });
    } catch (error) {
      logger.error('Query execution failed', {
        userId,
        error: error.message,
      });
      
      // Continue with empty results if query execution fails
      queryResults = [];
    }
  }
  
  // ========================================================================
  // PASS 2: Answer Synthesis
  // AI generates natural language response using query results
  // ========================================================================
  
  let aiResponse;
  try {
    // Format query results for Pass 2
    const formattedResults = queryResults.map(result => ({
      queryId: result.query_id,
      data: result.data,
      metadata: {
        rowCount: result.row_count,
        executionTimeMs: result.execution_time_ms,
      },
    }));
    
    aiResponse = await geminiService.synthesizeAnswer(
      message,
      formattedResults,
      conversationHistory
    );
    
    logger.info('Pass 2 completed', {
      userId,
      responseLength: aiResponse.length,
    });
  } catch (error) {
    logger.error('Pass 2 failed', {
      userId,
      error: error.message,
    });
    
    // If Pass 2 fails, return error to user
    throw new AppError(
      'AI service error. Please try again.',
      500,
      'AI_SERVICE_ERROR'
    );
  }
  
  // Append AI response to conversation history (Requirement 9.9)
  conversationManager.appendMessage(userId, 'model', aiResponse);
  
  // Calculate response time
  const responseTimeMs = Date.now() - startTime;
  
  // ========================================================================
  // Structured Logging (Requirement 24.1)
  // Log request with structured data
  // ========================================================================
  
  logRequest({
    user_id: userId,
    user_role: userRole,
    message_length: message.length,
    response_time_ms: responseTimeMs,
    ip_address: ipAddress,
    query_ids: selectedQueryIds,
  });
  
  // Record metrics (Requirement 24.4, 24.5)
  metricsService.recordRequest({
    response_time_ms: responseTimeMs,
    is_error: false,
    is_rate_limited: false,
    user_id: userId,
  });
  
  // ========================================================================
  // Audit Logging
  // Log interaction to AiChatLog table
  // ========================================================================
  
  try {
    await chatLogger.logInteraction({
      userId,
      userRole,
      userMessage: message,
      aiResponse,
      selectedQueryIds,
      ipAddress,
      sessionId,
      responseTimeMs,
    });
  } catch (error) {
    // Log error but don't fail the request
    logger.error('Failed to log chat interaction', {
      userId,
      error: error.message,
    });
  }
  
  // ========================================================================
  // Response
  // Return success response with rate limit info
  // ========================================================================
  
  // Get remaining rate limit count from request (set by middleware)
  const remainingRequests = req.rateLimitInfo?.userRemaining ?? 0;
  
  res.status(200).json({
    success: true,
    data: {
      response: aiResponse,
      queryIds: selectedQueryIds,
      remainingRequests,
    },
  });
}

/**
 * GET /api/ai/history
 * 
 * Retrieve conversation history for the authenticated user.
 * Returns the last 10 messages from the current session.
 * 
 * Requirements: 11.4, 11.5
 */
export const getHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Get conversation history from manager
    const messages = conversationManager.getHistory(userId);
    
    logger.info('History retrieved', {
      userId,
      messageCount: messages.length,
    });
    
    res.status(200).json({
      success: true,
      data: {
        messages,
        count: messages.length,
      },
    });
    
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/ai/rate-status
 * 
 * Check current rate limit status for the authenticated user.
 * Returns user and IP rate limit information.
 * 
 * Requirements: 11.6, 11.7
 */
export const getRateStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    
    // Get rate limit status from middleware
    const rateLimitStatus = getRateLimitStatus(userId, ipAddress);
    
    logger.info('Rate status retrieved', {
      userId,
      userRemaining: rateLimitStatus.userRemaining,
      ipRemaining: rateLimitStatus.ipRemaining,
    });
    
    res.status(200).json({
      success: true,
      data: rateLimitStatus,
    });
    
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/ai/history
 * 
 * Clear conversation history for the authenticated user.
 * Removes all messages from the current session.
 * 
 * Requirements: 11.8
 */
export const clearHistory = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    // Clear conversation history
    const cleared = conversationManager.clearHistory(userId);
    
    logger.info('History cleared', {
      userId,
      cleared,
    });
    
    res.status(200).json({
      success: true,
      data: {
        message: 'Conversation history cleared',
        cleared,
      },
    });
    
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/ai/metrics
 * 
 * Get AI chatbot usage metrics (Admin only).
 * Returns aggregated statistics about chatbot usage.
 * 
 * Requirements: 24.4, 24.5, 24.6, 24.7
 */
export const getMetrics = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;
    
    // Verify admin role (role = 1)
    if (userRole !== 1) {
      throw new AppError(
        'Insufficient permissions. Admin access required.',
        403,
        'FORBIDDEN'
      );
    }
    
    // Get combined metrics (current session + last 24 hours)
    const metrics = await metricsService.getCombinedMetrics();
    
    logger.info('Metrics retrieved', {
      userId,
      timestamp: metrics.timestamp,
    });
    
    res.status(200).json({
      success: true,
      data: metrics,
    });
    
  } catch (error) {
    next(error);
  }
};

export default {
  chat,
  getHistory,
  getRateStatus,
  clearHistory,
  getMetrics,
};
