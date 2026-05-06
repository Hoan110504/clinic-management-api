/**
 * Query Result Parser and Serializer
 * 
 * Parses Sequelize query results into plain JavaScript objects and serializes
 * them with metadata for AI consumption.
 * Implements Requirements 21.1-21.9 for parser and serializer functionality.
 */

/**
 * Check if a value is a Sequelize model instance
 * @param {*} value - The value to check
 * @returns {boolean} True if value is a Sequelize model instance
 */
function isSequelizeInstance(value) {
  return value && 
         typeof value === 'object' && 
         typeof value.toJSON === 'function' &&
         value.constructor &&
         value.constructor.name !== 'Object' &&
         value.constructor.name !== 'Array';
}

/**
 * Convert Date objects to ISO 8601 strings
 * @param {*} value - The value to convert
 * @returns {*} Converted value
 */
function convertDates(value) {
  if (value instanceof Date) {
    // Handle invalid dates (NaN)
    if (isNaN(value.getTime())) {
      return null;
    }
    return value.toISOString();
  }
  
  if (Array.isArray(value)) {
    return value.map(item => convertDates(item));
  }
  
  if (value && typeof value === 'object') {
    const converted = {};
    for (const [key, val] of Object.entries(value)) {
      converted[key] = convertDates(val);
    }
    return converted;
  }
  
  return value;
}

/**
 * Handle null and undefined values gracefully
 * @param {*} value - The value to handle
 * @returns {*} Handled value (null for undefined)
 */
function handleNullish(value) {
  if (value === undefined) {
    return null;
  }
  
  if (Array.isArray(value)) {
    return value.map(item => handleNullish(item));
  }
  
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const handled = {};
    for (const [key, val] of Object.entries(value)) {
      // Convert undefined values to null
      handled[key] = val === undefined ? null : handleNullish(val);
    }
    return handled;
  }
  
  return value;
}

/**
 * Parse a single Sequelize model instance to plain object
 * @param {Object} instance - The Sequelize model instance
 * @returns {Object} Plain JavaScript object
 */
function parseInstance(instance) {
  if (!instance) return null;
  
  let plain;
  
  // Convert Sequelize instance to plain object
  if (isSequelizeInstance(instance)) {
    plain = instance.toJSON ? instance.toJSON() : instance;
  } else {
    // Already a plain object, use as-is
    plain = instance;
  }
  
  // Convert dates and handle nullish values
  const converted = convertDates(plain);
  const handled = handleNullish(converted);
  
  return handled;
}

/**
 * Parse Sequelize query results to plain JavaScript objects
 * Handles single objects, arrays, and nested associations
 * 
 * @param {Object|Array|null} queryResult - The Sequelize query result
 * @returns {Object|Array|null} Parsed plain JavaScript object(s)
 */
export function parseQueryResult(queryResult) {
  // Handle null/undefined
  if (queryResult === null || queryResult === undefined) {
    return null;
  }
  
  // Handle arrays
  if (Array.isArray(queryResult)) {
    // Empty array case
    if (queryResult.length === 0) {
      return [];
    }
    
    return queryResult.map(item => parseInstance(item));
  }
  
  // Handle single object
  return parseInstance(queryResult);
}

/**
 * Serialize parsed query results with metadata for AI consumption
 * 
 * @param {Object|Array} parsedResult - The parsed query result
 * @param {string} queryId - The query identifier
 * @param {number} executionTimeMs - Query execution time in milliseconds
 * @returns {Object} Serialized result with metadata
 */
export function serializeQueryResult(parsedResult, queryId, executionTimeMs = 0) {
  // Determine row count
  let rowCount = 0;
  if (parsedResult === null || parsedResult === undefined) {
    rowCount = 0;
  } else if (Array.isArray(parsedResult)) {
    rowCount = parsedResult.length;
  } else {
    rowCount = 1;
  }
  
  return {
    query_id: queryId,
    row_count: rowCount,
    execution_time_ms: executionTimeMs,
    data: parsedResult,
    timestamp: new Date().toISOString()
  };
}

/**
 * Parse and serialize query result in one step
 * 
 * @param {Object|Array|null} queryResult - The raw Sequelize query result
 * @param {string} queryId - The query identifier
 * @param {number} executionTimeMs - Query execution time in milliseconds
 * @returns {Object} Serialized result with metadata
 */
export function parseAndSerialize(queryResult, queryId, executionTimeMs = 0) {
  const parsed = parseQueryResult(queryResult);
  return serializeQueryResult(parsed, queryId, executionTimeMs);
}

/**
 * Serialize multiple query results
 * 
 * @param {Array<Object>} queryResults - Array of query result objects
 * @returns {Array<Object>} Array of serialized results
 */
export function serializeMultipleResults(queryResults) {
  if (!Array.isArray(queryResults)) {
    return [];
  }
  
  return queryResults.map(result => {
    const { queryResult, queryId, executionTimeMs } = result;
    return parseAndSerialize(queryResult, queryId, executionTimeMs);
  });
}

/**
 * Format serialized results for AI Pass 2
 * Converts array of serialized results to a formatted string
 * 
 * @param {Array<Object>} serializedResults - Array of serialized query results
 * @returns {string} Formatted string for AI consumption
 */
export function formatForAI(serializedResults) {
  if (!Array.isArray(serializedResults) || serializedResults.length === 0) {
    return 'No query results available.';
  }
  
  const formatted = serializedResults.map(result => {
    const { query_id, row_count, execution_time_ms, data } = result;
    
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
  parseQueryResult,
  serializeQueryResult,
  parseAndSerialize,
  serializeMultipleResults,
  formatForAI
};
