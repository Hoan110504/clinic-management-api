/**
 * Request Queue Service Tests
 * 
 * Tests for request queuing with concurrent limit of 5 and max queue size of 20
 * 
 * Feature: ai-medical-chatbot
 */

import requestQueue from '../requestQueue.service.js';
import { AppError } from '../../utils/errors.js';

describe('Request Queue Service - Unit Tests', () => {
  beforeEach(() => {
    // Reset metrics before each test
    requestQueue.resetMetrics();
    requestQueue.clear();
  });

  describe('Configuration', () => {
    test('should have correct configuration values', () => {
      const stats = requestQueue.getStats();
      expect(stats.maxConcurrent).toBe(5);
      expect(stats.maxQueueSize).toBe(20);
    });
  });

  describe('Immediate Execution', () => {
    test('should execute task immediately when under concurrent limit', async () => {
      const task = jest.fn(async () => 'result');
      
      const result = await requestQueue.execute(task);
      
      expect(result).toBe('result');
      expect(task).toHaveBeenCalledTimes(1);
    });

    test('should execute multiple tasks concurrently up to limit', async () => {
      const tasks = [];
      const results = [];
      
      // Create 5 tasks (at the limit)
      for (let i = 0; i < 5; i++) {
        const task = async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return `result_${i}`;
        };
        tasks.push(requestQueue.execute(task));
      }
      
      // All should execute concurrently
      const allResults = await Promise.all(tasks);
      
      expect(allResults).toHaveLength(5);
      expect(allResults).toEqual(['result_0', 'result_1', 'result_2', 'result_3', 'result_4']);
    });
  });

  describe('Queue Behavior', () => {
    test('should queue requests when concurrent limit is reached', async () => {
      const executionOrder = [];
      
      // Create 7 tasks (5 concurrent + 2 queued)
      const tasks = [];
      for (let i = 0; i < 7; i++) {
        const task = async () => {
          executionOrder.push(i);
          await new Promise(resolve => setTimeout(resolve, 50));
          return `result_${i}`;
        };
        tasks.push(requestQueue.execute(task));
      }
      
      // Wait a bit to let first 5 start
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const stats = requestQueue.getStats();
      expect(stats.activeCount).toBe(5);
      expect(stats.queueSize).toBe(2);
      
      // Wait for all to complete
      await Promise.all(tasks);
      
      const finalStats = requestQueue.getStats();
      expect(finalStats.activeCount).toBe(0);
      expect(finalStats.queueSize).toBe(0);
      expect(finalStats.totalProcessed).toBe(7);
    });

    test('should process queued tasks in FIFO order', async () => {
      const executionOrder = [];
      
      // Create 8 tasks
      const tasks = [];
      for (let i = 0; i < 8; i++) {
        const task = async () => {
          executionOrder.push(i);
          await new Promise(resolve => setTimeout(resolve, 50));
          return i;
        };
        tasks.push(requestQueue.execute(task));
      }
      
      await Promise.all(tasks);
      
      // First 5 should execute immediately, then 6, 7, 8 in order
      expect(executionOrder.slice(0, 5)).toEqual([0, 1, 2, 3, 4]);
      expect(executionOrder.slice(5)).toEqual([5, 6, 7]);
    });
  });

  describe('Queue Full Behavior', () => {
    test('should reject requests when queue is full (20 queued + 5 active)', async () => {
      // Create 25 long-running tasks (5 active + 20 queued)
      const tasks = [];
      for (let i = 0; i < 25; i++) {
        const task = async () => {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return i;
        };
        tasks.push(requestQueue.execute(task));
      }
      
      // Wait for queue to fill
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // 26th request should be rejected
      const rejectedTask = async () => 'should_fail';
      
      await expect(requestQueue.execute(rejectedTask)).rejects.toThrow(AppError);
      await expect(requestQueue.execute(rejectedTask)).rejects.toThrow('Service busy, please try again');
      
      // Clean up
      requestQueue.clear();
    });

    test('should return 503 error code when queue is full', async () => {
      // Fill the queue
      const tasks = [];
      for (let i = 0; i < 25; i++) {
        const task = async () => {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return i;
        };
        tasks.push(requestQueue.execute(task));
      }
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      try {
        await requestQueue.execute(async () => 'fail');
        fail('Should have thrown error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect(error.statusCode).toBe(503);
        expect(error.code).toBe('SERVICE_BUSY');
      }
      
      requestQueue.clear();
    });
  });

  describe('Error Handling', () => {
    test('should handle task errors gracefully', async () => {
      const task = async () => {
        throw new Error('Task failed');
      };
      
      await expect(requestQueue.execute(task)).rejects.toThrow('Task failed');
      
      // Queue should still be functional
      const successTask = async () => 'success';
      const result = await requestQueue.execute(successTask);
      expect(result).toBe('success');
    });

    test('should process next queued task even if previous task fails', async () => {
      const results = [];
      
      // Create tasks where some fail
      const tasks = [];
      for (let i = 0; i < 7; i++) {
        const task = async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          if (i === 2 || i === 4) {
            throw new Error(`Task ${i} failed`);
          }
          results.push(i);
          return i;
        };
        tasks.push(requestQueue.execute(task).catch(e => `error_${i}`));
      }
      
      await Promise.all(tasks);
      
      // Successful tasks should have executed
      expect(results).toContain(0);
      expect(results).toContain(1);
      expect(results).toContain(3);
      expect(results).toContain(5);
      expect(results).toContain(6);
    });
  });

  describe('Metrics', () => {
    test('should track total processed requests', async () => {
      const tasks = [];
      for (let i = 0; i < 10; i++) {
        tasks.push(requestQueue.execute(async () => i));
      }
      
      await Promise.all(tasks);
      
      const stats = requestQueue.getStats();
      expect(stats.totalProcessed).toBe(10);
    });

    test('should track total queued requests', async () => {
      const tasks = [];
      for (let i = 0; i < 10; i++) {
        const task = async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return i;
        };
        tasks.push(requestQueue.execute(task));
      }
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const stats = requestQueue.getStats();
      expect(stats.totalQueued).toBe(5); // 5 were queued (5 executed immediately)
      
      await Promise.all(tasks);
    });

    test('should track rejected requests', async () => {
      // Fill queue
      const tasks = [];
      for (let i = 0; i < 25; i++) {
        tasks.push(requestQueue.execute(async () => {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return i;
        }));
      }
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Try to add more (should be rejected)
      for (let i = 0; i < 3; i++) {
        try {
          await requestQueue.execute(async () => 'fail');
        } catch (e) {
          // Expected
        }
      }
      
      const stats = requestQueue.getStats();
      expect(stats.totalRejected).toBe(3);
      
      requestQueue.clear();
    });

    test('should calculate utilization rate', async () => {
      const tasks = [];
      for (let i = 0; i < 3; i++) {
        tasks.push(requestQueue.execute(async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return i;
        }));
      }
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const stats = requestQueue.getStats();
      expect(stats.utilizationRate).toBe(0.6); // 3/5
      
      await Promise.all(tasks);
    });
  });

  describe('Clear Queue', () => {
    test('should reject all queued requests when cleared', async () => {
      const tasks = [];
      const errors = [];
      
      // Create 10 tasks (5 active + 5 queued)
      for (let i = 0; i < 10; i++) {
        const task = async () => {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return i;
        };
        tasks.push(requestQueue.execute(task).catch(e => {
          errors.push(e);
          return `error_${i}`;
        }));
      }
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Clear the queue
      requestQueue.clear();
      
      // Wait for promises to settle
      await Promise.all(tasks);
      
      // Queued tasks should have been rejected
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]).toBeInstanceOf(AppError);
      expect(errors[0].code).toBe('QUEUE_CLEARED');
    });
  });
});

describe('Request Queue Service - Performance Tests', () => {
  beforeEach(() => {
    requestQueue.resetMetrics();
    requestQueue.clear();
  });

  test('Feature: ai-medical-chatbot - Queue handles high load gracefully', async () => {
    const tasks = [];
    const startTime = Date.now();
    
    // Create 50 tasks
    for (let i = 0; i < 50; i++) {
      const task = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return i;
      };
      tasks.push(requestQueue.execute(task).catch(e => `error_${i}`));
    }
    
    const results = await Promise.all(tasks);
    const duration = Date.now() - startTime;
    
    const stats = requestQueue.getStats();
    
    // Should have processed or rejected all requests
    expect(results.length).toBe(50);
    
    // Some requests should have been rejected (queue full)
    const rejectedCount = results.filter(r => typeof r === 'string' && r.startsWith('error_')).length;
    expect(rejectedCount).toBeGreaterThan(0);
    
    // Processed + rejected should equal total
    expect(stats.totalProcessed + stats.totalRejected).toBe(50);
    
    console.log(`Processed ${stats.totalProcessed} requests, rejected ${stats.totalRejected} in ${duration}ms`);
  }, 10000);

  test('Feature: ai-medical-chatbot - Concurrent limit prevents API overload', async () => {
    let maxConcurrent = 0;
    let currentConcurrent = 0;
    
    const tasks = [];
    for (let i = 0; i < 20; i++) {
      const task = async () => {
        currentConcurrent++;
        maxConcurrent = Math.max(maxConcurrent, currentConcurrent);
        await new Promise(resolve => setTimeout(resolve, 50));
        currentConcurrent--;
        return i;
      };
      tasks.push(requestQueue.execute(task).catch(e => null));
    }
    
    await Promise.all(tasks);
    
    // Max concurrent should never exceed 5
    expect(maxConcurrent).toBeLessThanOrEqual(5);
  });

  test('Feature: ai-medical-chatbot - Queue processes tasks efficiently', async () => {
    const startTime = Date.now();
    
    // Create 15 tasks (5 concurrent + 10 queued)
    const tasks = [];
    for (let i = 0; i < 15; i++) {
      const task = async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return i;
      };
      tasks.push(requestQueue.execute(task));
    }
    
    const results = await Promise.all(tasks);
    const duration = Date.now() - startTime;
    
    // All tasks should complete
    expect(results.length).toBe(15);
    
    // Should take approximately 150ms (3 batches of 5 tasks at 50ms each)
    // Allow some overhead
    expect(duration).toBeGreaterThan(140);
    expect(duration).toBeLessThan(250);
    
    console.log(`Processed 15 tasks in ${duration}ms`);
  }, 10000);
});
