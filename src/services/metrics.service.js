/**
 * Metrics Service
 * 
 * Collects and aggregates metrics for AI chatbot monitoring.
 * Implements Requirements 24.4, 24.5, 24.6, 24.7
 * 
 * Tracks:
 * - Total requests and average response time
 * - Error rate and rate limit hits
 * - Active users
 * - Gemini API usage
 * - Query execution statistics
 */

import models from '../models/index.js';
import { Sequelize } from 'sequelize';
import queryCache from './queryCache.service.js';

const { AiChatLog } = models;

/**
 * In-memory metrics storage for real-time tracking
 */
const metricsStore = {
  // Request metrics
  totalRequests: 0,
  totalResponseTime: 0,
  errorCount: 0,
  rateLimitHits: 0,
  
  // Gemini API metrics
  geminiRequestsSent: 0,
  geminiRateLimitErrors: 0,
  
  // Query execution metrics
  queryExecutions: new Map(), // queryId -> { count, totalTime }
  
  // Active users (session-based)
  activeUsers: new Set(),
  
  // Last reset time
  lastReset: Date.now(),
};

/**
 * Record a request metric
 * 
 * @param {Object} requestData - Request data
 * @param {number} requestData.response_time_ms - Response time in milliseconds
 * @param {boolean} requestData.is_error - Whether the request resulted in an error
 * @param {boolean} requestData.is_rate_limited - Whether the request was rate limited
 * @param {number} requestData.user_id - User ID
 */
export function recordRequest(requestData) {
  const {
    response_time_ms,
    is_error = false,
    is_rate_limited = false,
    user_id,
  } = requestData;
  
  metricsStore.totalRequests++;
  metricsStore.totalResponseTime += response_time_ms || 0;
  
  if (is_error) {
    metricsStore.errorCount++;
  }
  
  if (is_rate_limited) {
    metricsStore.rateLimitHits++;
  }
  
  if (user_id) {
    metricsStore.activeUsers.add(user_id);
  }
}

/**
 * Record Gemini API usage
 * 
 * @param {Object} apiData - API usage data
 * @param {boolean} apiData.is_rate_limit_error - Whether this was a rate limit error
 */
export function recordGeminiApiUsage(apiData) {
  const { is_rate_limit_error = false } = apiData;
  
  metricsStore.geminiRequestsSent++;
  
  if (is_rate_limit_error) {
    metricsStore.geminiRateLimitErrors++;
  }
}

/**
 * Record query execution
 * 
 * @param {Object} queryData - Query execution data
 * @param {string} queryData.query_id - Query identifier
 * @param {number} queryData.execution_time_ms - Execution time in milliseconds
 */
export function recordQueryExecution(queryData) {
  const { query_id, execution_time_ms } = queryData;
  
  if (!metricsStore.queryExecutions.has(query_id)) {
    metricsStore.queryExecutions.set(query_id, {
      count: 0,
      totalTime: 0,
    });
  }
  
  const queryStats = metricsStore.queryExecutions.get(query_id);
  queryStats.count++;
  queryStats.totalTime += execution_time_ms || 0;
}

/**
 * Get current in-memory metrics
 * 
 * @returns {Object} Current metrics
 */
export function getCurrentMetrics() {
  const averageResponseTime = metricsStore.totalRequests > 0
    ? metricsStore.totalResponseTime / metricsStore.totalRequests
    : 0;
  
  const errorRate = metricsStore.totalRequests > 0
    ? metricsStore.errorCount / metricsStore.totalRequests
    : 0;
  
  // Convert query execution map to array
  const queryStats = Array.from(metricsStore.queryExecutions.entries()).map(
    ([queryId, stats]) => ({
      query_id: queryId,
      execution_count: stats.count,
      average_execution_time: stats.count > 0 ? stats.totalTime / stats.count : 0,
    })
  );
  
  // Get cache statistics
  const cacheStats = queryCache.getStats();
  
  return {
    total_requests: metricsStore.totalRequests,
    average_response_time: Math.round(averageResponseTime * 100) / 100,
    error_rate: Math.round(errorRate * 10000) / 10000,
    rate_limit_hits: metricsStore.rateLimitHits,
    active_users: metricsStore.activeUsers.size,
    gemini_api_usage: {
      requests_sent: metricsStore.geminiRequestsSent,
      rate_limit_errors: metricsStore.geminiRateLimitErrors,
    },
    query_execution_stats: queryStats,
    cache_stats: cacheStats,
    uptime_ms: Date.now() - metricsStore.lastReset,
  };
}

/**
 * Get metrics from database (historical data)
 * 
 * Requirements: 24.4, 24.5, 24.6, 24.7
 * 
 * @param {Object} options - Query options
 * @param {Date} options.startDate - Start date for metrics (default: 24 hours ago)
 * @param {Date} options.endDate - End date for metrics (default: now)
 * @returns {Promise<Object>} Aggregated metrics from database
 */
export async function getMetricsFromDatabase(options = {}) {
  const {
    startDate = new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
    endDate = new Date(),
  } = options;
  
  try {
    // Get total requests
    const totalRequests = await AiChatLog.count({
      where: {
        timestamp: {
          [Sequelize.Op.between]: [startDate, endDate],
        },
      },
    });
    
    // Get average response time
    const avgResponseTime = await AiChatLog.findOne({
      attributes: [
        [Sequelize.fn('AVG', Sequelize.col('response_time_ms')), 'avg_response_time'],
      ],
      where: {
        timestamp: {
          [Sequelize.Op.between]: [startDate, endDate],
        },
        response_time_ms: {
          [Sequelize.Op.ne]: null,
        },
      },
      raw: true,
    });
    
    // Get error count
    const errorCount = await AiChatLog.count({
      where: {
        timestamp: {
          [Sequelize.Op.between]: [startDate, endDate],
        },
        error_message: {
          [Sequelize.Op.ne]: null,
        },
      },
    });
    
    // Get rate limit hits
    const rateLimitHits = await AiChatLog.count({
      where: {
        timestamp: {
          [Sequelize.Op.between]: [startDate, endDate],
        },
        is_rate_limited: true,
      },
    });
    
    // Get active users count
    const activeUsers = await AiChatLog.findAll({
      attributes: [
        [Sequelize.fn('COUNT', Sequelize.fn('DISTINCT', Sequelize.col('user_id'))), 'active_users'],
      ],
      where: {
        timestamp: {
          [Sequelize.Op.between]: [startDate, endDate],
        },
      },
      raw: true,
    });
    
    // Get top queries
    const topQueries = await AiChatLog.findAll({
      attributes: [
        'selected_query_ids',
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
      ],
      where: {
        timestamp: {
          [Sequelize.Op.between]: [startDate, endDate],
        },
        selected_query_ids: {
          [Sequelize.Op.ne]: null,
        },
      },
      group: ['selected_query_ids'],
      order: [[Sequelize.literal('count'), 'DESC']],
      limit: 10,
      raw: true,
    });
    
    // Calculate error rate
    const errorRate = totalRequests > 0 ? errorCount / totalRequests : 0;
    
    return {
      total_requests: totalRequests,
      average_response_time: Math.round((avgResponseTime?.avg_response_time || 0) * 100) / 100,
      error_rate: Math.round(errorRate * 10000) / 10000,
      rate_limit_hits: rateLimitHits,
      active_users: activeUsers[0]?.active_users || 0,
      top_queries: topQueries.map(q => ({
        query_ids: q.selected_query_ids,
        count: parseInt(q.count, 10),
      })),
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    };
  } catch (error) {
    console.error('Failed to get metrics from database:', error);
    throw error;
  }
}

/**
 * Get combined metrics (in-memory + database)
 * 
 * Requirements: 24.4, 24.5
 * 
 * @returns {Promise<Object>} Combined metrics
 */
export async function getCombinedMetrics() {
  const currentMetrics = getCurrentMetrics();
  
  try {
    const dbMetrics = await getMetricsFromDatabase();
    
    return {
      current_session: currentMetrics,
      last_24_hours: dbMetrics,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    // If database query fails, return only current metrics
    console.error('Failed to get database metrics:', error);
    return {
      current_session: currentMetrics,
      last_24_hours: null,
      timestamp: new Date().toISOString(),
      error: 'Failed to retrieve historical metrics',
    };
  }
}

/**
 * Reset in-memory metrics
 * Useful for testing or periodic resets
 */
export function resetMetrics() {
  metricsStore.totalRequests = 0;
  metricsStore.totalResponseTime = 0;
  metricsStore.errorCount = 0;
  metricsStore.rateLimitHits = 0;
  metricsStore.geminiRequestsSent = 0;
  metricsStore.geminiRateLimitErrors = 0;
  metricsStore.queryExecutions.clear();
  metricsStore.activeUsers.clear();
  metricsStore.lastReset = Date.now();
}

/**
 * Clean up stale active users (users inactive for > 1 hour)
 * Should be called periodically
 */
export function cleanupActiveUsers() {
  // In a real implementation, we would track last activity time per user
  // For now, we just clear the set periodically
  const hoursSinceReset = (Date.now() - metricsStore.lastReset) / (1000 * 60 * 60);
  
  if (hoursSinceReset > 1) {
    metricsStore.activeUsers.clear();
  }
}

export default {
  recordRequest,
  recordGeminiApiUsage,
  recordQueryExecution,
  getCurrentMetrics,
  getMetricsFromDatabase,
  getCombinedMetrics,
  resetMetrics,
  cleanupActiveUsers,
};
