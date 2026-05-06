/**
 * Request Queue Service
 * 
 * Manages concurrent Gemini API calls with queuing to prevent rate limit exhaustion.
 * Limits concurrent calls to 5 per server instance with a max queue size of 20.
 * 
 * Requirements: 20.4, 20.5, 20.6
 */

import { AppError } from '../utils/errors.js';

/**
 * Queue entry structure
 * @typedef {Object} QueueEntry
 * @property {Function} task - The async function to execute
 * @property {Function} resolve - Promise resolve function
 * @property {Function} reject - Promise reject function
 * @property {number} timestamp - When the request was queued
 */

class RequestQueueService {
  constructor() {
    // Configuration
    this.MAX_CONCURRENT = 5;
    this.MAX_QUEUE_SIZE = 20;
    
    // State
    this.activeCount = 0;
    this.queue = [];
    
    // Metrics
    this.totalProcessed = 0;
    this.totalQueued = 0;
    this.totalRejected = 0;
  }
  
  /**
   * Execute a task with queue management
   * 
   * @param {Function} task - Async function to execute
   * @returns {Promise<any>} Result of the task
   * @throws {AppError} 503 error if queue is full
   */
  async execute(task) {
    // Check if we can execute immediately
    if (this.activeCount < this.MAX_CONCURRENT) {
      return this._executeTask(task);
    }
    
    // Check if queue is full
    if (this.queue.length >= this.MAX_QUEUE_SIZE) {
      this.totalRejected++;
      throw new AppError(
        'Service busy, please try again',
        503,
        'SERVICE_BUSY',
        { queueSize: this.queue.length, maxQueueSize: this.MAX_QUEUE_SIZE }
      );
    }
    
    // Queue the request
    this.totalQueued++;
    return new Promise((resolve, reject) => {
      this.queue.push({
        task,
        resolve,
        reject,
        timestamp: Date.now()
      });
    });
  }
  
  /**
   * Execute a task and manage concurrency
   * 
   * @private
   * @param {Function} task - Async function to execute
   * @returns {Promise<any>} Result of the task
   */
  async _executeTask(task) {
    this.activeCount++;
    this.totalProcessed++;
    
    try {
      const result = await task();
      return result;
    } finally {
      this.activeCount--;
      this._processQueue();
    }
  }
  
  /**
   * Process next item in queue if capacity available
   * 
   * @private
   */
  _processQueue() {
    // Check if we have capacity and queued items
    if (this.activeCount < this.MAX_CONCURRENT && this.queue.length > 0) {
      const entry = this.queue.shift();
      
      // Execute the queued task
      this._executeTask(entry.task)
        .then(entry.resolve)
        .catch(entry.reject);
    }
  }
  
  /**
   * Get queue statistics
   * 
   * @returns {Object} Queue metrics
   */
  getStats() {
    return {
      activeCount: this.activeCount,
      queueSize: this.queue.length,
      maxConcurrent: this.MAX_CONCURRENT,
      maxQueueSize: this.MAX_QUEUE_SIZE,
      totalProcessed: this.totalProcessed,
      totalQueued: this.totalQueued,
      totalRejected: this.totalRejected,
      utilizationRate: this.activeCount / this.MAX_CONCURRENT
    };
  }
  
  /**
   * Clear the queue (for testing/shutdown)
   * Rejects all queued requests
   */
  clear() {
    const error = new AppError(
      'Queue cleared',
      503,
      'QUEUE_CLEARED'
    );
    
    while (this.queue.length > 0) {
      const entry = this.queue.shift();
      entry.reject(error);
    }
  }
  
  /**
   * Reset metrics (for testing)
   */
  resetMetrics() {
    this.totalProcessed = 0;
    this.totalQueued = 0;
    this.totalRejected = 0;
  }
}

// Export singleton instance
export default new RequestQueueService();
