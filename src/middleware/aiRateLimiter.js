/**
 * Giới hạn số lượt truy cập AI
 * AI Rate Limiter Middleware
 */

import { AppError } from '../utils/errors.js';
import { logSecurityEvent } from '../utils/aiLogger.js';

// Rate limit configuration
const USER_LIMIT = 20;
const IP_LIMIT = 50;
const WINDOW_MS = 10 * 60 * 1000; // 10 minutes in milliseconds

// In-memory storage for rate limit counters
// Structure: { key: { count: number, resetTime: number } }
const userLimits = new Map();
const ipLimits = new Map();

/**
 * Clean up expired entries from the rate limit store
 * @param {Map} store - The rate limit store to clean
 */

//xóa các dữ liệu hết hạn khỏi bộ nhớ
function cleanupExpiredEntries(store) {
  const now = Date.now();
  for (const [key, value] of store.entries()) {
    if (now >= value.resetTime) {
      store.delete(key);
    }
  }
}

/**
 * Get or initialize rate limit entry
 * @param {Map} store - The rate limit store
 * @param {string} key - The identifier (user ID or IP)
 * @returns {{ count: number, resetTime: number }}
 */

//lấy thông tin rate limit của một người dùng và tự động tạo mới
function getRateLimitEntry(store, key) {
  const now = Date.now();
  const entry = store.get(key);
  
  // If entry doesn't exist or has expired, create new entry
  if (!entry || now >= entry.resetTime) {
    const newEntry = {
      count: 0,
      resetTime: now + WINDOW_MS
    };
    store.set(key, newEntry);
    return newEntry;
  }
  
  return entry;
}

/**
 * Calculate remaining time until rate limit reset
 * @param {number} resetTime - The reset timestamp
 * @returns {number} Seconds until reset
 */
function getSecondsUntilReset(resetTime) {
  const now = Date.now();
  return Math.ceil((resetTime - now) / 1000);
}

/**
 * AI Rate Limiter Middleware
 * 
 * Enforces rate limits on AI chatbot requests:
 * - 20 requests per user per 10 minutes
 * - 50 requests per IP per 10 minutes
 * 
 * Adds rate limit headers to all responses:
 * - X-RateLimit-Remaining-User
 * - X-RateLimit-Remaining-IP
 * 
 * Returns 429 Too Many Requests when limits exceeded
 */
//KIểm tra số lượng request
export const aiRateLimiter = (req, res, next) => {
  try {
    // Clean up expired entries periodically (every 100 requests)
    if (Math.random() < 0.01) {
      cleanupExpiredEntries(userLimits);
      cleanupExpiredEntries(ipLimits);
    }
    
    // Extract user ID from authenticated request
    const userId = req.user?.id;
    if (!userId) {
      return next(new AppError('Authentication required', 401, 'UNAUTHORIZED'));
    }
    
    // Extract IP address
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    
    // Check user rate limit
    const userEntry = getRateLimitEntry(userLimits, userId.toString());
    
    // Check IP rate limit
    const ipEntry = getRateLimitEntry(ipLimits, ipAddress);
    
    // Check if user limit exceeded
    if (userEntry.count >= USER_LIMIT) {
      const retryAfter = getSecondsUntilReset(userEntry.resetTime);
      res.setHeader('Retry-After', retryAfter);
      res.setHeader('X-RateLimit-Remaining-User', 0);
      res.setHeader('X-RateLimit-Remaining-IP', Math.max(0, IP_LIMIT - ipEntry.count));
      
      // Structured security logging 
      logSecurityEvent({
        event_type: 'rate_limit_violation',
        user_id: userId,
        user_role: req.user?.role,
        ip_address: ipAddress,
        user_message: req.body?.message || '',
        limit_type: 'user',
      });
      
      const minutes = Math.ceil(retryAfter / 60);
      return next(
        new AppError(
          `Rate limit reached. Please wait ${minutes} minute${minutes !== 1 ? 's' : ''} before asking more questions.`,
          429,
          'TOO_MANY_REQUESTS',
          { retryAfter, resetTime: new Date(userEntry.resetTime).toISOString() }
        )
      );
    }
    
    // Check if IP limit exceeded
    if (ipEntry.count >= IP_LIMIT) {
      const retryAfter = getSecondsUntilReset(ipEntry.resetTime);
      res.setHeader('Retry-After', retryAfter);
      res.setHeader('X-RateLimit-Remaining-User', Math.max(0, USER_LIMIT - userEntry.count));
      res.setHeader('X-RateLimit-Remaining-IP', 0);
      
      // Structured security logging (Requirement 24.3)
      logSecurityEvent({
        event_type: 'rate_limit_violation',
        user_id: userId,
        user_role: req.user?.role,
        ip_address: ipAddress,
        user_message: req.body?.message || '',
        limit_type: 'ip',
      });
      
      const minutes = Math.ceil(retryAfter / 60);
      return next(
        new AppError(
          `Rate limit reached for this IP address. Please wait ${minutes} minute${minutes !== 1 ? 's' : ''} before trying again.`,
          429,
          'TOO_MANY_REQUESTS',
          { retryAfter, resetTime: new Date(ipEntry.resetTime).toISOString() }
        )
      );
    }
    
    // Increment counters
    userEntry.count++;
    ipEntry.count++;
    
    // Calculate remaining AFTER incrementing
    const userRemaining = Math.max(0, USER_LIMIT - userEntry.count);
    const ipRemaining = Math.max(0, IP_LIMIT - ipEntry.count);
    
    // Add rate limit headers (showing remaining after this request)
    res.setHeader('X-RateLimit-Remaining-User', userRemaining);
    res.setHeader('X-RateLimit-Remaining-IP', ipRemaining);
    
    // Attach rate limit info to request for use in response
    req.rateLimitInfo = {
      userRemaining,
      ipRemaining,
      userResetTime: new Date(userEntry.resetTime).toISOString(),
      ipResetTime: new Date(ipEntry.resetTime).toISOString()
    };
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Get current rate limit status for a user and IP
 * Used by the rate-status endpoint
 * 
 * @param {number|string} userId - The user ID
 * @param {string} ipAddress - The IP address
 * @returns {Object} Rate limit status
 */
export function getRateLimitStatus(userId, ipAddress) {
  const userEntry = getRateLimitEntry(userLimits, userId.toString());
  const ipEntry = getRateLimitEntry(ipLimits, ipAddress);
  
  return {
    userLimit: USER_LIMIT,
    userRemaining: Math.max(0, USER_LIMIT - userEntry.count),
    userResetTime: new Date(userEntry.resetTime).toISOString(),
    ipLimit: IP_LIMIT,
    ipRemaining: Math.max(0, IP_LIMIT - ipEntry.count),
    ipResetTime: new Date(ipEntry.resetTime).toISOString()
  };
}

/**
 * Reset rate limits for a specific user (for testing purposes)
 * @param {number|string} userId - The user ID
 */
export function resetUserRateLimit(userId) {
  userLimits.delete(userId.toString());
}

/**
 * Reset rate limits for a specific IP (for testing purposes)
 * @param {string} ipAddress - The IP address
 */
export function resetIpRateLimit(ipAddress) {
  ipLimits.delete(ipAddress);
}

/**
 * Clear all rate limit data (for testing purposes)
 */
export function clearAllRateLimits() {
  userLimits.clear();
  ipLimits.clear();
}
