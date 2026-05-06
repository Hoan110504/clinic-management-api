/**
 * Query Cache Service Tests
 * 
 * Tests for query result caching with 60-second TTL
 * Requirements: 20.2
 * 
 * Feature: ai-medical-chatbot
 */

import queryCache from '../queryCache.service.js';

describe('Query Cache Service - Unit Tests', () => {
  beforeEach(() => {
    // Clear cache before each test
    queryCache.clear();
  });

  afterAll(() => {
    // Clean up interval
    queryCache.destroy();
  });

  describe('Cache Key Generation', () => {
    test('should generate patient-scoped cache key for my_appointments', () => {
      const key = queryCache.generateKey('my_appointments', 123, 5);
      expect(key).toBe('my_appointments_123_5');
    });

    test('should generate patient-scoped cache key for my_prescriptions', () => {
      const key = queryCache.generateKey('my_prescriptions', 456, 5);
      expect(key).toBe('my_prescriptions_456_5');
    });

    test('should generate general cache key for medicines_info', () => {
      const key = queryCache.generateKey('medicines_info', 123, 2);
      expect(key).toBe('medicines_info');
    });

    test('should generate general cache key for lab_tests_pending', () => {
      const key = queryCache.generateKey('lab_tests_pending', 456, 6);
      expect(key).toBe('lab_tests_pending');
    });
  });

  describe('Cache Operations', () => {
    test('should return null for cache miss', () => {
      const result = queryCache.get('my_appointments', 123, 5);
      expect(result).toBeNull();
    });

    test('should store and retrieve cached data', () => {
      const testData = { query_id: 'my_appointments', data: [{ id: 1 }] };
      
      queryCache.set('my_appointments', 123, 5, testData);
      const result = queryCache.get('my_appointments', 123, 5);
      
      expect(result).toEqual(testData);
    });

    test('should return null for expired cache entry', async () => {
      const testData = { query_id: 'my_appointments', data: [{ id: 1 }] };
      
      // Set with 100ms TTL
      queryCache.set('my_appointments', 123, 5, testData, 100);
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      const result = queryCache.get('my_appointments', 123, 5);
      expect(result).toBeNull();
    });

    test('should invalidate specific cache entry', () => {
      const testData = { query_id: 'my_appointments', data: [{ id: 1 }] };
      
      queryCache.set('my_appointments', 123, 5, testData);
      const deleted = queryCache.invalidate('my_appointments', 123, 5);
      
      expect(deleted).toBe(true);
      expect(queryCache.get('my_appointments', 123, 5)).toBeNull();
    });

    test('should clear all cache entries', () => {
      queryCache.set('my_appointments', 123, 5, { data: 'test1' });
      queryCache.set('medicines_info', 456, 2, { data: 'test2' });
      
      queryCache.clear();
      
      expect(queryCache.get('my_appointments', 123, 5)).toBeNull();
      expect(queryCache.get('medicines_info', 456, 2)).toBeNull();
    });
  });

  describe('Cache Metrics', () => {
    test('should track cache hits and misses', () => {
      const testData = { query_id: 'my_appointments', data: [{ id: 1 }] };
      
      // Miss
      queryCache.get('my_appointments', 123, 5);
      
      // Set
      queryCache.set('my_appointments', 123, 5, testData);
      
      // Hit
      queryCache.get('my_appointments', 123, 5);
      queryCache.get('my_appointments', 123, 5);
      
      const stats = queryCache.getStats();
      
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(1);
      expect(stats.totalRequests).toBe(3);
      expect(stats.hitRate).toBeCloseTo(0.6667, 4);
    });

    test('should track cache size', () => {
      queryCache.set('my_appointments', 123, 5, { data: 'test1' });
      queryCache.set('medicines_info', 456, 2, { data: 'test2' });
      queryCache.set('my_prescriptions', 789, 5, { data: 'test3' });
      
      const stats = queryCache.getStats();
      expect(stats.size).toBe(3);
    });

    test('should calculate hit rate correctly', () => {
      const testData = { query_id: 'test', data: [] };
      
      queryCache.set('test', 1, 5, testData);
      
      // 5 hits, 3 misses
      for (let i = 0; i < 5; i++) {
        queryCache.get('test', 1, 5);
      }
      for (let i = 0; i < 3; i++) {
        queryCache.get('nonexistent', 1, 5);
      }
      
      const stats = queryCache.getStats();
      expect(stats.hitRate).toBeCloseTo(0.625, 4); // 5/8
    });
  });

  describe('Cache Cleanup', () => {
    test('should remove expired entries during cleanup', async () => {
      // Set entries with short TTL
      queryCache.set('test1', 1, 5, { data: 'test1' }, 100);
      queryCache.set('test2', 2, 5, { data: 'test2' }, 100);
      queryCache.set('test3', 3, 5, { data: 'test3' }, 5000); // Long TTL
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Trigger cleanup
      queryCache.cleanup();
      
      const stats = queryCache.getStats();
      expect(stats.size).toBe(1); // Only test3 should remain
    });
  });

  describe('Cache Isolation', () => {
    test('should isolate cache entries by user for patient-scoped queries', () => {
      const data1 = { query_id: 'my_appointments', data: [{ id: 1 }] };
      const data2 = { query_id: 'my_appointments', data: [{ id: 2 }] };
      
      queryCache.set('my_appointments', 123, 5, data1);
      queryCache.set('my_appointments', 456, 5, data2);
      
      expect(queryCache.get('my_appointments', 123, 5)).toEqual(data1);
      expect(queryCache.get('my_appointments', 456, 5)).toEqual(data2);
    });

    test('should share cache entries for general queries', () => {
      const data = { query_id: 'medicines_info', data: [{ id: 1 }] };
      
      queryCache.set('medicines_info', 123, 2, data);
      
      // Different user should get same cached data
      expect(queryCache.get('medicines_info', 456, 2)).toEqual(data);
    });
  });
});

describe('Query Cache Service - Performance Tests', () => {
  beforeEach(() => {
    queryCache.clear();
  });

  afterAll(() => {
    queryCache.destroy();
  });

  test('Feature: ai-medical-chatbot - Cache effectiveness reduces query execution', () => {
    const testData = { query_id: 'my_appointments', data: Array(100).fill({ id: 1 }) };
    
    // First request - cache miss
    const miss = queryCache.get('my_appointments', 123, 5);
    expect(miss).toBeNull();
    
    // Store in cache
    queryCache.set('my_appointments', 123, 5, testData);
    
    // Subsequent requests - cache hits
    for (let i = 0; i < 10; i++) {
      const hit = queryCache.get('my_appointments', 123, 5);
      expect(hit).toEqual(testData);
    }
    
    const stats = queryCache.getStats();
    expect(stats.hits).toBe(10);
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBeCloseTo(0.9091, 4);
  });

  test('Feature: ai-medical-chatbot - Cache respects 60-second TTL', async () => {
    const testData = { query_id: 'my_appointments', data: [{ id: 1 }] };
    
    // Set with default 60-second TTL (use 200ms for testing)
    queryCache.set('my_appointments', 123, 5, testData, 200);
    
    // Should be cached immediately
    expect(queryCache.get('my_appointments', 123, 5)).toEqual(testData);
    
    // Wait for expiration
    await new Promise(resolve => setTimeout(resolve, 250));
    
    // Should be expired
    expect(queryCache.get('my_appointments', 123, 5)).toBeNull();
  }, 10000);

  test('Feature: ai-medical-chatbot - Cache handles high volume', () => {
    // Store 100 different cache entries
    for (let i = 0; i < 100; i++) {
      queryCache.set(`query_${i}`, i, 5, { data: `test_${i}` });
    }
    
    const stats = queryCache.getStats();
    expect(stats.size).toBe(100);
    
    // Retrieve all entries
    for (let i = 0; i < 100; i++) {
      const result = queryCache.get(`query_${i}`, i, 5);
      expect(result).toEqual({ data: `test_${i}` });
    }
    
    const finalStats = queryCache.getStats();
    expect(finalStats.hits).toBe(100);
  });
});
