/**
 * AI Summary Rate Limiter Middleware
 * Implements per-patient and global rate limiting for AI medical summary requests
 */
import config from '../config/index.js';

// In-memory storage for rate limit tracking
const rateLimitStore = new Map();

// Cleanup interval (run every 5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Cleanup expired entries from rate limit store
 */
function cleanupExpiredEntries() {
  const now = Date.now();
  
  for (const [key, data] of rateLimitStore.entries()) {
    // Remove entries where all timestamps are expired
    const validTimestamps = data.timestamps.filter(
      timestamp => now - timestamp < data.windowMs
    );
    
    if (validTimestamps.length === 0) {
      rateLimitStore.delete(key);
    } else {
      data.timestamps = validTimestamps;
    }
  }
}

// Start automatic cleanup
setInterval(cleanupExpiredEntries, CLEANUP_INTERVAL_MS);

/**
 * Check rate limit for a given key
 * @param {string} key - Rate limit key (e.g., "userId:patientId" or "global:userId")
 * @param {number} limit - Maximum number of requests allowed
 * @param {number} windowMs - Time window in milliseconds
 * @returns {Object} { allowed: boolean, remaining: number, resetTime: Date }
 */
function checkLimit(key, limit, windowMs) {
  const now = Date.now();
  
  // Get or create rate limit data for this key
  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, {
      timestamps: [],
      windowMs,
    });
  }
  
  const data = rateLimitStore.get(key);
  
  // Filter out expired timestamps (sliding window)
  data.timestamps = data.timestamps.filter(
    timestamp => now - timestamp < windowMs
  );
  
  // Calculate remaining requests
  const remaining = Math.max(0, limit - data.timestamps.length);
  
  // Calculate reset time (oldest timestamp + window)
  const oldestTimestamp = data.timestamps[0] || now;
  const resetTime = new Date(oldestTimestamp + windowMs);
  
  // Check if limit exceeded
  if (data.timestamps.length >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetTime,
    };
  }
  
  // Add current timestamp
  data.timestamps.push(now);
  
  return {
    allowed: true,
    remaining: remaining - 1, // Subtract 1 for current request
    resetTime,
  };
}

/**
 * AI Summary Rate Limiter Middleware
 * Enforces per-patient (10/hour) and global (30/minute) rate limits
 */
export const aiSummaryRateLimiter = (req, res, next) => {
  const userId = req.user.id;
  const patientId = req.body.patientId;
  
  // Get rate limit configuration
  const perPatientLimit = config.ai.summary.rateLimit.perPatient;
  const globalLimit = config.ai.summary.rateLimit.global;
  const perPatientWindowMs = 60 * 60 * 1000; // 1 hour
  const globalWindowMs = 60 * 1000; // 1 minute
  
  // Check per-patient rate limit (10 requests per hour per doctor per patient)
  const perPatientKey = `${userId}:${patientId}`;
  const perPatientCheck = checkLimit(perPatientKey, perPatientLimit, perPatientWindowMs);
  
  if (!perPatientCheck.allowed) {
    return res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED_PER_PATIENT',
        message: `Đã vượt quá giới hạn tóm tắt cho bệnh nhân này (${perPatientLimit} lần/giờ)`,
        statusCode: 429,
        resetTime: perPatientCheck.resetTime.toISOString(),
      },
    });
  }
  
  // Check global rate limit (30 requests per minute per doctor)
  const globalKey = `global:${userId}`;
  const globalCheck = checkLimit(globalKey, globalLimit, globalWindowMs);
  
  if (!globalCheck.allowed) {
    return res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED_GLOBAL',
        message: `Đã vượt quá giới hạn tóm tắt tổng thể (${globalLimit} lần/phút)`,
        statusCode: 429,
        resetTime: globalCheck.resetTime.toISOString(),
      },
    });
  }
  
  // Add rate limit headers to response
  res.setHeader('X-RateLimit-Limit-PerPatient', perPatientLimit);
  res.setHeader('X-RateLimit-Remaining-PerPatient', perPatientCheck.remaining);
  res.setHeader('X-RateLimit-Reset-PerPatient', perPatientCheck.resetTime.toISOString());
  
  res.setHeader('X-RateLimit-Limit-Global', globalLimit);
  res.setHeader('X-RateLimit-Remaining-Global', globalCheck.remaining);
  res.setHeader('X-RateLimit-Reset-Global', globalCheck.resetTime.toISOString());
  
  // Attach rate limit info to request for controller use
  req.rateLimitInfo = {
    perPatientRemaining: perPatientCheck.remaining,
    globalRemaining: globalCheck.remaining,
    remainingRequests: Math.min(perPatientCheck.remaining, globalCheck.remaining),
  };
  
  next();
};

/**
 * Export cleanup function for testing purposes
 */
export { cleanupExpiredEntries };
