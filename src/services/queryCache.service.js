/**
 * Query Cache Service
 * 
 * Implements in-memory caching for frequently accessed query results.
 * Cache entries expire after 60 seconds (TTL).
 * 
 * Requirements: 20.2
 * 
 * Cache Key Format:
 * - Patient-scoped queries: `${queryId}_${userId}_${userRole}`
 * - General queries: `${queryId}`
 */

/**
 * Cache entry structure
 * @typedef {Object} CacheEntry
 * @property {any} data - Cached query result
 * @property {number} timestamp - When the entry was cached (ms since epoch)
 * @property {number} ttl - Time to live in milliseconds
 */

class QueryCacheService {
  constructor() {
    // In-memory cache storage
    this.cache = new Map();
    
    // Cache configuration
    this.TTL_MS = 60 * 1000; // 60 seconds
    
    // Metrics
    this.hits = 0;
    this.misses = 0;
    
    // Cleanup interval (every 30 seconds)
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 30 * 1000);
  }
  
  /**
   * Generate cache key based on query ID and user context
   * 
   * @param {string} queryId - Query identifier
   * @param {number} userId - User ID
   * @param {number} userRole - User role
   * @returns {string} Cache key
   */
  generateKey(queryId, userId, userRole) {
    // Patient-scoped queries include user context
    const patientScopedQueries = [
      'my_appointments',
      'my_prescriptions',
      'my_lab_results',
      'my_medical_history'
    ];
    
    if (patientScopedQueries.includes(queryId)) {
      return `${queryId}_${userId}_${userRole}`;
    }
    
    // General queries only use query ID
    return queryId;
  }
  
  /**
   * Get cached query result
   * 
   * @param {string} queryId - Query identifier
   * @param {number} userId - User ID
   * @param {number} userRole - User role
   * @returns {any|null} Cached data or null if not found/expired
   */
  get(queryId, userId, userRole) {
    const key = this.generateKey(queryId, userId, userRole);
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return null;
    }
    
    // Check if entry has expired
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      // Entry expired, remove it
      this.cache.delete(key);
      this.misses++;
      return null;
    }
    
    // Cache hit
    this.hits++;
    return entry.data;
  }
  
  /**
   * Set cached query result
   * 
   * @param {string} queryId - Query identifier
   * @param {number} userId - User ID
   * @param {number} userRole - User role
   * @param {any} data - Query result to cache
   * @param {number} [ttl] - Optional custom TTL in milliseconds
   */
  set(queryId, userId, userRole, data, ttl = this.TTL_MS) {
    const key = this.generateKey(queryId, userId, userRole);
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }
  
  /**
   * Invalidate cache entry
   * 
   * @param {string} queryId - Query identifier
   * @param {number} userId - User ID
   * @param {number} userRole - User role
   * @returns {boolean} True if entry was deleted
   */
  invalidate(queryId, userId, userRole) {
    const key = this.generateKey(queryId, userId, userRole);
    return this.cache.delete(key);
  }
  
  /**
   * Clear all cache entries
   */
  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }
  
  /**
   * Clean up expired cache entries
   * Called periodically by cleanup interval
   */
  cleanup() {
    const now = Date.now();
    const keysToDelete = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
    
    if (keysToDelete.length > 0) {
      console.log(`Query cache cleanup: removed ${keysToDelete.length} expired entries`);
    }
  }
  
  /**
   * Get cache statistics
   * 
   * @returns {Object} Cache metrics
   */
  getStats() {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? this.hits / totalRequests : 0;
    
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: Math.round(hitRate * 10000) / 10000,
      totalRequests
    };
  }
  
  /**
   * Stop cleanup interval (for testing/shutdown)
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }
}

// Export singleton instance
export default new QueryCacheService();
