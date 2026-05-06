/**
 * AI Controller Performance Tests
 * 
 * Tests for performance optimization including:
 * - Response time under normal load (<5 seconds)
 * - Cache effectiveness
 * - Queue behavior under high load
 * - Request timeout (30 seconds)
 * 
 * Requirements: 20.1, 20.2, 20.4, 20.5, 20.6, 20.7, 20.9
 * 
 * Feature: ai-medical-chatbot
 */

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import config from '../../../config/index.js';
import queryCache from '../../../services/queryCache.service.js';
import requestQueue from '../../../services/requestQueue.service.js';
import metricsService from '../../../services/metrics.service.js';

// Mock dependencies
jest.mock('../../../services/gemini.service.js');
jest.mock('../../../services/queryHandler.service.js');
jest.mock('../../../services/chatLogger.service.js');
jest.mock('../../../services/conversationManager.js');

describe('AI Controller - Performance Tests', () => {
  let app;
  let testToken;
  let geminiService;
  let queryHandler;
  let chatLogger;
  let conversationManager;

  beforeAll(async () => {
    // Import mocked modules
    geminiService = (await import('../../../services/gemini.service.js')).default;
    queryHandler = (await import('../../../services/queryHandler.service.js')).default;
    chatLogger = (await import('../../../services/chatLogger.service.js')).default;
    conversationManager = (await import('../../../services/conversationManager.js')).default;

    // Setup Express app
    app = express();
    app.use(express.json());

    // Mock auth middleware
    app.use((req, res, next) => {
      req.user = { id: 1, role: 5, username: 'testpatient' };
      req.rateLimitInfo = { userRemaining: 15 };
      next();
    });

    // Import and mount AI routes
    const aiRoutes = (await import('../../../routes/ai.routes.js')).default;
    app.use('/api/ai', aiRoutes);

    // Generate test token
    testToken = jwt.sign(
      { id: 1, role: 5, username: 'testpatient' },
      config.jwt.secret,
      { expiresIn: '1h' }
    );
  });

  beforeEach(() => {
    // Clear cache and reset metrics
    queryCache.clear();
    requestQueue.resetMetrics();
    metricsService.resetMetrics();

    // Reset mocks
    jest.clearAllMocks();

    // Setup default mock implementations
    conversationManager.getHistory.mockReturnValue([]);
    conversationManager.appendMessage.mockReturnValue(undefined);
    
    chatLogger.logInteraction.mockResolvedValue(undefined);
    chatLogger.logError.mockResolvedValue(undefined);
  });

  afterAll(() => {
    queryCache.destroy();
  });

  describe('Response Time Performance', () => {
    test('Feature: ai-medical-chatbot - Response time under 5 seconds for normal request', async () => {
      // Mock fast responses
      geminiService.selectQueries.mockResolvedValue(['my_appointments']);
      queryHandler.executeMultipleQueries.mockResolvedValue([
        {
          query_id: 'my_appointments',
          data: [{ id: 1, date: '2024-01-15' }],
          row_count: 1,
          execution_time_ms: 50,
        },
      ]);
      geminiService.synthesizeAnswer.mockResolvedValue('You have 1 upcoming appointment.');

      const startTime = Date.now();

      const response = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ message: 'What are my appointments?' });

      const duration = Date.now() - startTime;

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Response should be under 5 seconds (Requirement 20.1)
      expect(duration).toBeLessThan(5000);
      
      console.log(`Response time: ${duration}ms`);
    });

    test('Feature: ai-medical-chatbot - Multiple concurrent requests complete within acceptable time', async () => {
      geminiService.selectQueries.mockResolvedValue(['medicines_info']);
      queryHandler.executeMultipleQueries.mockResolvedValue([
        {
          query_id: 'medicines_info',
          data: [{ id: 1, name: 'Paracetamol' }],
          row_count: 1,
          execution_time_ms: 30,
        },
      ]);
      geminiService.synthesizeAnswer.mockResolvedValue('We have Paracetamol in stock.');

      const startTime = Date.now();
      const requests = [];

      // Send 10 concurrent requests
      for (let i = 0; i < 10; i++) {
        requests.push(
          request(app)
            .post('/api/ai/chat')
            .set('Authorization', `Bearer ${testToken}`)
            .send({ message: 'What medicines do you have?' })
        );
      }

      const responses = await Promise.all(requests);
      const duration = Date.now() - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Total time should be reasonable (not 10x single request time)
      expect(duration).toBeLessThan(10000);
      
      console.log(`10 concurrent requests completed in ${duration}ms`);
    }, 15000);
  });

  describe('Cache Effectiveness', () => {
    test('Feature: ai-medical-chatbot - Cache reduces query execution time', async () => {
      const queryData = {
        query_id: 'my_appointments',
        data: Array(50).fill({ id: 1, date: '2024-01-15' }),
        row_count: 50,
        execution_time_ms: 100,
      };

      geminiService.selectQueries.mockResolvedValue(['my_appointments']);
      queryHandler.executeMultipleQueries.mockResolvedValue([queryData]);
      geminiService.synthesizeAnswer.mockResolvedValue('You have 50 appointments.');

      // First request - cache miss
      const firstResponse = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ message: 'Show my appointments' });

      expect(firstResponse.status).toBe(200);
      expect(queryHandler.executeMultipleQueries).toHaveBeenCalledTimes(1);

      // Second request - should use cache
      const secondResponse = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ message: 'Show my appointments again' });

      expect(secondResponse.status).toBe(200);
      
      // Query handler should be called again (cache is at query handler level)
      // But the actual database query should be cached
      const cacheStats = queryCache.getStats();
      expect(cacheStats.hits).toBeGreaterThan(0);
    });

    test('Feature: ai-medical-chatbot - Cache hit rate improves with repeated queries', async () => {
      geminiService.selectQueries.mockResolvedValue(['medicines_info']);
      queryHandler.executeMultipleQueries.mockResolvedValue([
        {
          query_id: 'medicines_info',
          data: [{ id: 1, name: 'Paracetamol' }],
          row_count: 1,
          execution_time_ms: 50,
        },
      ]);
      geminiService.synthesizeAnswer.mockResolvedValue('Medicine info response');

      // Make 10 requests for the same query
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/api/ai/chat')
          .set('Authorization', `Bearer ${testToken}`)
          .send({ message: 'Tell me about medicines' });
      }

      const cacheStats = queryCache.getStats();
      
      // Cache hit rate should be high
      expect(cacheStats.totalRequests).toBeGreaterThan(0);
      expect(cacheStats.hitRate).toBeGreaterThan(0);
      
      console.log(`Cache stats: ${cacheStats.hits} hits, ${cacheStats.misses} misses, ${(cacheStats.hitRate * 100).toFixed(2)}% hit rate`);
    });
  });

  describe('Queue Behavior Under Load', () => {
    test('Feature: ai-medical-chatbot - Queue handles burst traffic', async () => {
      // Simulate slow AI responses
      geminiService.selectQueries.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return ['my_appointments'];
      });
      queryHandler.executeMultipleQueries.mockResolvedValue([
        {
          query_id: 'my_appointments',
          data: [{ id: 1 }],
          row_count: 1,
          execution_time_ms: 50,
        },
      ]);
      geminiService.synthesizeAnswer.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'Response';
      });

      const requests = [];
      
      // Send 15 requests (5 concurrent + 10 queued)
      for (let i = 0; i < 15; i++) {
        requests.push(
          request(app)
            .post('/api/ai/chat')
            .set('Authorization', `Bearer ${testToken}`)
            .send({ message: `Request ${i}` })
            .catch(err => ({ error: err.message }))
        );
      }

      const responses = await Promise.all(requests);
      
      // Most requests should succeed
      const successCount = responses.filter(r => r.status === 200).length;
      expect(successCount).toBeGreaterThan(10);
      
      const queueStats = requestQueue.getStats();
      console.log(`Queue stats: ${queueStats.totalProcessed} processed, ${queueStats.totalQueued} queued, ${queueStats.totalRejected} rejected`);
    }, 15000);

    test('Feature: ai-medical-chatbot - Returns 503 when queue is full', async () => {
      // Simulate very slow responses to fill queue
      geminiService.selectQueries.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return [];
      });
      geminiService.synthesizeAnswer.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 2000));
        return 'Response';
      });

      const requests = [];
      
      // Send 30 requests (should exceed 5 concurrent + 20 queue limit)
      for (let i = 0; i < 30; i++) {
        requests.push(
          request(app)
            .post('/api/ai/chat')
            .set('Authorization', `Bearer ${testToken}`)
            .send({ message: `Request ${i}` })
        );
      }

      // Wait a bit for queue to fill
      await new Promise(resolve => setTimeout(resolve, 100));

      // Some requests should be rejected with 503
      const responses = await Promise.allSettled(requests);
      const rejectedCount = responses.filter(
        r => r.status === 'fulfilled' && r.value.status === 503
      ).length;

      expect(rejectedCount).toBeGreaterThan(0);
      
      console.log(`${rejectedCount} requests rejected with 503 (queue full)`);
      
      // Clean up
      requestQueue.clear();
    }, 30000);
  });

  describe('Request Timeout', () => {
    test('Feature: ai-medical-chatbot - Request times out after 30 seconds', async () => {
      // Mock extremely slow response (35 seconds)
      geminiService.selectQueries.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 35000));
        return [];
      });

      const startTime = Date.now();

      const response = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ message: 'This should timeout' });

      const duration = Date.now() - startTime;

      // Should timeout with 408 error (Requirement 20.7)
      expect(response.status).toBe(408);
      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('REQUEST_TIMEOUT');
      
      // Should timeout around 30 seconds, not 35
      expect(duration).toBeGreaterThan(29000);
      expect(duration).toBeLessThan(32000);
      
      console.log(`Request timed out after ${duration}ms`);
    }, 35000);

    test('Feature: ai-medical-chatbot - Fast requests do not timeout', async () => {
      // Mock fast response
      geminiService.selectQueries.mockResolvedValue(['my_appointments']);
      queryHandler.executeMultipleQueries.mockResolvedValue([
        {
          query_id: 'my_appointments',
          data: [{ id: 1 }],
          row_count: 1,
          execution_time_ms: 50,
        },
      ]);
      geminiService.synthesizeAnswer.mockResolvedValue('Quick response');

      const response = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ message: 'Quick question' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Performance Metrics', () => {
    test('Feature: ai-medical-chatbot - Metrics track response times', async () => {
      geminiService.selectQueries.mockResolvedValue([]);
      geminiService.synthesizeAnswer.mockResolvedValue('Response');

      // Make several requests
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/ai/chat')
          .set('Authorization', `Bearer ${testToken}`)
          .send({ message: `Request ${i}` });
      }

      const metrics = metricsService.getCurrentMetrics();
      
      expect(metrics.total_requests).toBe(5);
      expect(metrics.average_response_time).toBeGreaterThan(0);
      expect(metrics.error_rate).toBe(0);
      
      console.log(`Average response time: ${metrics.average_response_time}ms`);
    });

    test('Feature: ai-medical-chatbot - Metrics track error rate', async () => {
      // Mock some failures
      geminiService.selectQueries.mockRejectedValueOnce(new Error('AI service error'));
      geminiService.selectQueries.mockResolvedValue([]);
      geminiService.synthesizeAnswer.mockResolvedValue('Response');

      // Make requests (1 failure, 4 success)
      await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ message: 'This will fail' });

      for (let i = 0; i < 4; i++) {
        await request(app)
          .post('/api/ai/chat')
          .set('Authorization', `Bearer ${testToken}`)
          .send({ message: `Request ${i}` });
      }

      const metrics = metricsService.getCurrentMetrics();
      
      expect(metrics.total_requests).toBe(5);
      expect(metrics.error_rate).toBeCloseTo(0.2, 2); // 1/5 = 0.2
      
      console.log(`Error rate: ${(metrics.error_rate * 100).toFixed(2)}%`);
    });
  });

  describe('Performance Under Normal Load', () => {
    test('Feature: ai-medical-chatbot - System maintains <5s response time under normal load', async () => {
      geminiService.selectQueries.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return ['my_appointments'];
      });
      queryHandler.executeMultipleQueries.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return [
          {
            query_id: 'my_appointments',
            data: [{ id: 1 }],
            row_count: 1,
            execution_time_ms: 50,
          },
        ];
      });
      geminiService.synthesizeAnswer.mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'Response';
      });

      const responseTimes = [];

      // Simulate normal load: 20 requests over 10 seconds
      for (let i = 0; i < 20; i++) {
        const startTime = Date.now();
        
        await request(app)
          .post('/api/ai/chat')
          .set('Authorization', `Bearer ${testToken}`)
          .send({ message: `Request ${i}` });
        
        const duration = Date.now() - startTime;
        responseTimes.push(duration);
        
        // Wait 500ms between requests (normal load)
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // All response times should be under 5 seconds
      const allUnder5s = responseTimes.every(time => time < 5000);
      expect(allUnder5s).toBe(true);

      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);

      console.log(`Average response time: ${avgResponseTime.toFixed(2)}ms`);
      console.log(`Max response time: ${maxResponseTime}ms`);
      console.log(`All responses under 5s: ${allUnder5s}`);
    }, 30000);
  });
});
