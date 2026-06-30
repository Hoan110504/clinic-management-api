/**
 * Query Handler Service
 * 
 * Executes whitelisted queries with role-based access control and security measures.
 */

import { getQuery, isQueryWhitelisted, hasQueryPermission } from '../config/queryWhitelist.js';
import { parseAndSerialize } from '../utils/queryResultParser.js';
import { filterSensitiveData } from '../utils/dataFilter.js';
import { AppError } from '../utils/errors.js';
import { logQueryExecution } from '../utils/aiLogger.js';
import metricsService from './metrics.service.js';
import queryCache from './queryCache.service.js';

/**
 * Query timeout in milliseconds (5 seconds)
 */
const QUERY_TIMEOUT_MS = 5000;

/**
 * Create a timeout promise that rejects after specified milliseconds
 * @param {number} ms - Timeout in milliseconds
 * @returns {Promise} Promise that rejects with timeout error
 */
function createTimeout(ms) {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(new AppError('Query took too long to execute', 408, 'QUERY_TIMEOUT'));
    }, ms);
  });
}

/**
 * Execute a query with timeout protection
 * @param {Function} queryFn - The query function to execute
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise} Promise that resolves with query result or rejects on timeout
 */
async function executeWithTimeout(queryFn, timeoutMs) {
  return Promise.race([
    queryFn(),
    createTimeout(timeoutMs)
  ]);
}

/**
 * Execute a single whitelisted query with role-based access control
 * 
 * @param {string} queryId - The query identifier from the whitelist
 * @param {number} userId - The authenticated user's ID
 * @param {number} userRole - The authenticated user's role ID
 * @returns {Promise<Object>} Parsed and serialized query result with metadata
 * @throws {AppError} If query is not whitelisted, user lacks permission, or execution fails
 */
export async function executeQuery(queryId, userId, userRole) {
  // Verify query exists in whitelist (Requirement 2.2)
  if (!isQueryWhitelisted(queryId)) {
    throw new AppError('Query not allowed', 403, 'QUERY_NOT_WHITELISTED');
  }
  
  // Verify user role has permission (Requirement 3.8)
  if (!hasQueryPermission(queryId, userRole)) {
    throw new AppError('Insufficient permissions for this query', 403, 'INSUFFICIENT_PERMISSIONS');
  }
  
  // Check cache first (Requirement 20.2)
  const cachedResult = queryCache.get(queryId, userId, userRole);
  if (cachedResult) {
    // Cache hit - return cached result
    return cachedResult;
  }
  
  // Get query configuration
  const queryConfig = getQuery(queryId);
  
  if (!queryConfig || !queryConfig.handler) {
    throw new AppError('Query handler not found', 500, 'QUERY_HANDLER_MISSING');
  }
  
  try {
    // Track execution time
    const startTime = Date.now();
    
    // Execute query with timeout protection (Requirement 17.8)
    const queryResult = await executeWithTimeout(
      () => queryConfig.handler(userId, userRole),
      QUERY_TIMEOUT_MS
    );
    
    const executionTimeMs = Date.now() - startTime;
    
    // Parse query result to plain objects (Requirement 21.1-21.6)
    const serialized = parseAndSerialize(queryResult, queryId, executionTimeMs);
    
    // Filter sensitive data (Requirement 18.1-18.8)
    const filteredData = filterSensitiveData(serialized.data, userId);
    
    // Log successful query execution (Requirement 24.7)
    logQueryExecution({
      query_id: queryId,
      execution_time_ms: executionTimeMs,
      row_count: serialized.row_count,
      success: true,
    });
    
    // Record metrics (Requirement 24.7)
    metricsService.recordQueryExecution({
      query_id: queryId,
      execution_time_ms: executionTimeMs,
    });
    
    // Build result with filtered data
    const result = {
      ...serialized,
      data: filteredData
    };
    
    // Cache the result (Requirement 20.2)
    queryCache.set(queryId, userId, userRole, result);
    
    // Return serialized result with filtered data
    return result;
    
  } catch (error) {
    // Log failed query execution (Requirement 24.7)
    logQueryExecution({
      query_id: queryId,
      execution_time_ms: Date.now() - startTime,
      row_count: 0,
      success: false,
      error_message: error.message,
    });
    
    // If it's already an AppError (like timeout), rethrow it
    if (error instanceof AppError) {
      throw error;
    }
    
    // Handle database errors
    console.error(`Query execution error for ${queryId}:`, error);
    throw new AppError(
      'Query execution failed',
      500,
      'QUERY_EXECUTION_ERROR',
      { originalError: error.message }
    );
  }
}

/**
 * Execute multiple whitelisted queries in sequence
 * 
 * @param {Array<string>} queryIds - Array of query identifiers
 * @param {number} userId - The authenticated user's ID
 * @param {number} userRole - The authenticated user's role ID
 * @returns {Promise<Array<Object>>} Array of parsed and serialized query results
 * @throws {AppError} If any query fails (fails fast on first error)
 */
export async function executeMultipleQueries(queryIds, userId, userRole) {
  if (!Array.isArray(queryIds) || queryIds.length === 0) {
    return [];
  }
  
  const results = [];
  
  // Execute queries sequentially (not in parallel to avoid overwhelming the database)
  for (const queryId of queryIds) {
    try {
      const result = await executeQuery(queryId, userId, userRole);
      results.push(result);
    } catch (error) {
      // Log error but continue with other queries
      console.error(`Failed to execute query ${queryId}:`, error.message);
      
      // Add error result to maintain query order
      results.push({
        query_id: queryId,
        row_count: 0,
        execution_time_ms: 0,
        data: null,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }
  
  return results;
}

/**
 * Validate query IDs before execution
 * Returns arrays of valid and invalid query IDs
 * 
 * @param {Array<string>} queryIds - Array of query identifiers to validate
 * @param {number} userRole - The authenticated user's role ID
 * @returns {Object} Object with valid and invalid query ID arrays
 */
export function validateQueryIds(queryIds, userRole) {
  if (!Array.isArray(queryIds)) {
    return { valid: [], invalid: [] };
  }
  
  const valid = [];
  const invalid = [];
  
  for (const queryId of queryIds) {
    if (isQueryWhitelisted(queryId) && hasQueryPermission(queryId, userRole)) {
      valid.push(queryId);
    } else {
      invalid.push(queryId);
    }
  }
  
  return { valid, invalid };
}

/**
 * Get execution statistics for a query result
 * 
 * @param {Object} queryResult - The serialized query result
 * @returns {Object} Statistics object
 */
export function getQueryStats(queryResult) {
  return {
    queryId: queryResult.query_id,
    rowCount: queryResult.row_count,
    executionTimeMs: queryResult.execution_time_ms,
    hasData: queryResult.data !== null && queryResult.data !== undefined,
    hasError: !!queryResult.error,
    timestamp: queryResult.timestamp
  };
}

/**
 * Format multiple query results for AI consumption
 * 
 * @param {Array<Object>} queryResults - Array of serialized query results
 * @returns {string} Formatted string for AI Pass 2
 */
export function formatQueryResultsForAI(queryResults) {
  if (!Array.isArray(queryResults) || queryResults.length === 0) {
    return 'No query results available.';
  }
  
  const formatted = queryResults.map(result => {
    const { query_id, row_count, execution_time_ms, data, error } = result;
    
    if (error) {
      return `
Query: ${query_id}
Status: Error
Error: ${error}
`;
    }
    
    let dataStr;
    if (data === null || data === undefined) {
      dataStr = 'No data';
    } else if (Array.isArray(data) && data.length === 0) {
      dataStr = 'Empty result set';
    } else {
      dataStr = JSON.stringify(data, null, 2);
    }
    
    return `
Query: ${query_id}
Rows: ${row_count}
Execution Time: ${execution_time_ms}ms
Data:
${dataStr}
`;
  }).join('\n---\n');
  
  return formatted;
}

export default {
  executeQuery,
  executeMultipleQueries,
  validateQueryIds,
  getQueryStats,
  formatQueryResultsForAI
};
