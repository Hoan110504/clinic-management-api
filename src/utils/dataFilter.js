/**
 * Data Filter Utility
 * 
 * Filters sensitive data from query results before sending to AI.
 * Implements Requirements 18.1-18.8 for sensitive data filtering and truncation.
 */

/**
 * Sensitive field patterns to strip from all data
 */
const SENSITIVE_FIELDS = [
  // Password fields
  'password',
  'password_hash',
  'passwordHash',
  'hashedPassword',
  'pwd',
  
  // Token fields
  'token',
  'jwt',
  'jwtToken',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'apiKey',
  'api_key',
  'secret',
  
  // Financial fields
  'creditCard',
  'credit_card',
  'cardNumber',
  'card_number',
  'cvv',
  'ccv',
  
  // Personal identification
  'ssn',
  'socialSecurityNumber',
  'social_security_number',
  'nationalId',
  'national_id',
  'idNumber',
  'id_number',
  'taxId',
  'tax_id'
];

/**
 * PII fields that should be redacted for non-owner users
 */
const PII_FIELDS = [
  'phone',
  'phoneNumber',
  'phone_number',
  'mobile',
  'email',
  'emailAddress',
  'email_address'
];

/**
 * Maximum character limit for query results
 */
const MAX_CHARACTERS = 10000;

/**
 * Truncation notice message
 */
const TRUNCATION_NOTICE = '\n\n[DATA TRUNCATED: Result exceeded 10,000 character limit]';

/**
 * Check if a field name matches sensitive patterns
 * @param {string} fieldName - The field name to check
 * @returns {boolean} True if field is sensitive
 */
function isSensitiveField(fieldName) {
  const lowerField = fieldName.toLowerCase();
  return SENSITIVE_FIELDS.some(pattern => lowerField.includes(pattern.toLowerCase()));
}

/**
 * Check if a field name is PII that should be redacted
 * @param {string} fieldName - The field name to check
 * @returns {boolean} True if field is PII
 */
function isPIIField(fieldName) {
  const lowerField = fieldName.toLowerCase();
  return PII_FIELDS.some(pattern => lowerField.includes(pattern.toLowerCase()));
}

/**
 * Redact a PII value (show only first 2 and last 2 characters)
 * @param {string} value - The value to redact
 * @returns {string} Redacted value
 */
function redactPII(value) {
  if (!value || typeof value !== 'string') return '[REDACTED]';
  if (value.length <= 4) return '***';
  return `${value.substring(0, 2)}***${value.substring(value.length - 2)}`;
}

/**
 * Filter sensitive fields from a single object
 * @param {Object} obj - The object to filter
 * @param {number|null} ownerId - The ID of the data owner (for PII redaction)
 * @param {number|null} currentUserId - The ID of the current user
 * @returns {Object} Filtered object
 */
function filterObject(obj, ownerId = null, currentUserId = null) {
  if (!obj || typeof obj !== 'object') return obj;
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => filterObject(item, ownerId, currentUserId));
  }
  
  // Handle Date objects
  if (obj instanceof Date) {
    return obj;
  }
  
  const filtered = {};
  const isOwner = ownerId !== null && currentUserId !== null && ownerId === currentUserId;
  
  for (const [key, value] of Object.entries(obj)) {
    // Skip sensitive fields entirely
    if (isSensitiveField(key)) {
      continue;
    }
    
    // Redact PII for non-owners
    if (isPIIField(key) && !isOwner) {
      filtered[key] = redactPII(value);
      continue;
    }
    
    // Recursively filter nested objects
    if (value && typeof value === 'object') {
      filtered[key] = filterObject(value, ownerId, currentUserId);
    } else {
      filtered[key] = value;
    }
  }
  
  return filtered;
}

/**
 * Filter sensitive data from query results
 * @param {Array|Object} data - The query result data to filter
 * @param {number|null} currentUserId - The ID of the current user (for PII redaction)
 * @returns {Array|Object} Filtered data
 */
export function filterSensitiveData(data, currentUserId = null) {
  if (!data) return data;
  
  // Handle arrays of results
  if (Array.isArray(data)) {
    return data.map(item => {
      // Try to determine owner ID from common field names
      const ownerId = item.user_id || item.userId || item.patient_id || item.patientId || null;
      return filterObject(item, ownerId, currentUserId);
    });
  }
  
  // Handle single object
  const ownerId = data.user_id || data.userId || data.patient_id || data.patientId || null;
  return filterObject(data, ownerId, currentUserId);
}

/**
 * Truncate data to maximum character limit
 * @param {string} data - The data string to truncate
 * @returns {Object} Object with truncated data and truncation flag
 */
export function truncateData(data) {
  if (typeof data !== 'string') {
    data = JSON.stringify(data, null, 2);
  }
  
  if (data.length <= MAX_CHARACTERS) {
    return {
      data,
      truncated: false
    };
  }
  
  const truncatedData = data.substring(0, MAX_CHARACTERS) + TRUNCATION_NOTICE;
  
  return {
    data: truncatedData,
    truncated: true
  };
}

/**
 * Filter and truncate query results for AI consumption
 * @param {Array|Object} queryResults - The query results to process
 * @param {number|null} currentUserId - The ID of the current user
 * @returns {Object} Processed results with metadata
 */
export function filterAndTruncateResults(queryResults, currentUserId = null) {
  // Filter sensitive data
  const filtered = filterSensitiveData(queryResults, currentUserId);
  
  // Convert to string for truncation
  const dataString = JSON.stringify(filtered, null, 2);
  
  // Truncate if needed
  const { data, truncated } = truncateData(dataString);
  
  return {
    data,
    truncated,
    originalLength: dataString.length,
    filteredLength: data.length
  };
}

export default {
  filterSensitiveData,
  truncateData,
  filterAndTruncateResults
};
