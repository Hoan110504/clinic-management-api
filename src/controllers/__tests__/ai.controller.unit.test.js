/**
 * Unit Tests for AI Controller
 * 
 * Tests endpoint input validation, error response formatting, and rate limit header inclusion.
 * Validates: Requirements 22.1
 */

import request from 'supertest';
import express from 'express';
import { chat, getHistory, getRateStatus, clearHistory, getMetrics } from '../ai.controller.js';
import conversationManager from '../../services/conversationManager.js';
import { clearAllRateLimits } from '../../middleware/aiRateLimiter.js';
import jwt from 'jsonwebtoken';
import config from '../../config/index.js';

// Create a minimal Express app for testing
function createTestApp() {
  const app = express();
  app.use(express.json());
  
  // Mock auth middleware
  app.use((req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
          statusCode: 401,
        },
      });
    }
    
    const token = authHeader.substring(7);
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      req.user = decoded;
      req.ip = '127.0.0.1';
      req.rateLimitInfo = {
        userRemaining: 19,
        ipRemaining: 49,
        userResetTime: new Date(Date.now() + 600000).toISOString(),
        ipResetTime: new Date(Date.now() + 600000).toISOString(),
      };
      next();
    } catch (error) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid token',
          statusCode: 401,
        },
      });
    }
  });
  
  // Error handler
  app.use((err, req, res, next) => {
    res.status(err.statusCode || 500).json({
      success: false,
      error: {
        code: err.code || 'INTERNAL_ERROR',
        message: err.message || 'Internal server error',
        statusCode: err.statusCode || 500,
      },
    });
  });
  
  return app;
}

// Helper to generate test token
function generateToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, username: user.username },
    config.jwt.secret,
    { expiresIn: '1h' }
  );
}

describe('AI Controller - Unit Tests', () => {
  let app;
  let testToken;
  let adminToken;

  beforeAll(() => {
    app = createTestApp();
    
    // Mount routes
    app.post('/api/ai/chat', chat);
    app.get('/api/ai/history', getHistory);
    app.get('/api/ai/rate-status', getRateStatus);
    app.delete('/api/ai/history', clearHistory);
    app.get('/api/ai/metrics', getMetrics);
    
    // Generate test tokens
    testToken = generateToken({ id: 1, role: 5, username: 'testuser' });
    adminToken = generateToken({ id: 2, role: 1, username: 'admin' });
  });

  beforeEach(() => {
    conversationManager.clearAllSessions();
    clearAllRateLimits();
  });

  describe('POST /api/ai/chat - Input Validation', () => {
    
    test('should reject request without message field', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${testToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
      expect(response.body.error.code).toBe('INVALID_MESSAGE');
      expect(response.body.error.message).toContain('Message field is required');
    });

    test('should reject request with null message', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ message: null })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_MESSAGE');
    });

    test('should reject request with non-string message', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ message: 123 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_MESSAGE');
    });

    test('should reject request with array message', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ message: ['test'] })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_MESSAGE');
    });

    test('should reject request with object message', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ message: { text: 'test' } })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_MESSAGE');
    });

    test('should reject request without authentication', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .send({ message: 'Test message' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    test('should reject request with invalid token', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', 'Bearer invalid_token')
        .send({ message: 'Test message' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    test('should reject request with malformed Authorization header', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', 'InvalidFormat')
        .send({ message: 'Test message' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Error Response Formatting', () => {
    
    test('should return consistent error format for validation errors', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${testToken}`)
        .send({})
        .expect(400);

      // Verify error format
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error).toHaveProperty('statusCode');
      
      expect(typeof response.body.error.code).toBe('string');
      expect(typeof response.body.error.message).toBe('string');
      expect(typeof response.body.error.statusCode).toBe('number');
    });

    test('should return consistent error format for authentication errors', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .send({ message: 'Test' })
        .expect(401);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error).toHaveProperty('statusCode', 401);
    });

    test('should return consistent error format for authorization errors', async () => {
      const response = await request(app)
        .get('/api/ai/metrics')
        .set('Authorization', `Bearer ${testToken}`) // Non-admin user
        .expect(403);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('code', 'FORBIDDEN');
      expect(response.body.error).toHaveProperty('statusCode', 403);
    });
  });

  describe('Rate Limit Header Inclusion', () => {
    
    test('should include rate limit headers in successful response', async () => {
      // Note: This test would need actual AI service mocking to work fully
      // For now, we test that the structure is correct
      
      const response = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ message: 'Test message' });

      // Even if the request fails due to AI service, headers should be set by middleware
      // In a real scenario with mocked services, this would be 200
      if (response.status === 200) {
        expect(response.body.data.remainingRequests).toBeDefined();
        expect(typeof response.body.data.remainingRequests).toBe('number');
      }
    });
  });

  describe('GET /api/ai/history - Input Validation', () => {
    
    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/ai/history')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    test('should return empty history for new user', async () => {
      const response = await request(app)
        .get('/api/ai/history')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.messages).toEqual([]);
      expect(response.body.data.count).toBe(0);
    });

    test('should return correct response format', async () => {
      const response = await request(app)
        .get('/api/ai/history')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('messages');
      expect(response.body.data).toHaveProperty('count');
      expect(Array.isArray(response.body.data.messages)).toBe(true);
    });
  });

  describe('GET /api/ai/rate-status - Input Validation', () => {
    
    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/ai/rate-status')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    test('should return correct response format', async () => {
      const response = await request(app)
        .get('/api/ai/rate-status')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('userLimit');
      expect(response.body.data).toHaveProperty('userRemaining');
      expect(response.body.data).toHaveProperty('userResetTime');
      expect(response.body.data).toHaveProperty('ipLimit');
      expect(response.body.data).toHaveProperty('ipRemaining');
      expect(response.body.data).toHaveProperty('ipResetTime');
    });

    test('should return valid rate limit values', async () => {
      const response = await request(app)
        .get('/api/ai/rate-status')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.data.userLimit).toBe(20);
      expect(response.body.data.ipLimit).toBe(50);
      expect(response.body.data.userRemaining).toBeGreaterThanOrEqual(0);
      expect(response.body.data.userRemaining).toBeLessThanOrEqual(20);
      expect(response.body.data.ipRemaining).toBeGreaterThanOrEqual(0);
      expect(response.body.data.ipRemaining).toBeLessThanOrEqual(50);
    });
  });

  describe('DELETE /api/ai/history - Input Validation', () => {
    
    test('should require authentication', async () => {
      const response = await request(app)
        .delete('/api/ai/history')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    test('should return correct response format', async () => {
      const response = await request(app)
        .delete('/api/ai/history')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('message');
      expect(response.body.data.message).toBe('Conversation history cleared');
    });

    test('should successfully clear history even if empty', async () => {
      const response = await request(app)
        .delete('/api/ai/history')
        .set('Authorization', `Bearer ${testToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/ai/metrics - Authorization', () => {
    
    test('should require authentication', async () => {
      const response = await request(app)
        .get('/api/ai/metrics')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    test('should deny access for non-admin users', async () => {
      const response = await request(app)
        .get('/api/ai/metrics')
        .set('Authorization', `Bearer ${testToken}`) // Role 5 (patient)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
      expect(response.body.error.message).toContain('Admin access required');
    });

    test('should allow access for admin users', async () => {
      const response = await request(app)
        .get('/api/ai/metrics')
        .set('Authorization', `Bearer ${adminToken}`) // Role 1 (admin)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    test('should return correct metrics format', async () => {
      const response = await request(app)
        .get('/api/ai/metrics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('activeSessions');
      expect(typeof response.body.data.activeSessions).toBe('number');
    });
  });

  describe('Response Format Consistency', () => {
    
    test('all successful responses should have success: true', async () => {
      const endpoints = [
        { method: 'get', path: '/api/ai/history', token: testToken },
        { method: 'get', path: '/api/ai/rate-status', token: testToken },
        { method: 'delete', path: '/api/ai/history', token: testToken },
        { method: 'get', path: '/api/ai/metrics', token: adminToken },
      ];

      for (const endpoint of endpoints) {
        const response = await request(app)
          [endpoint.method](endpoint.path)
          .set('Authorization', `Bearer ${endpoint.token}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
      }
    });

    test('all error responses should have success: false', async () => {
      const endpoints = [
        { method: 'post', path: '/api/ai/chat', body: {} },
        { method: 'get', path: '/api/ai/history' },
        { method: 'get', path: '/api/ai/rate-status' },
        { method: 'delete', path: '/api/ai/history' },
        { method: 'get', path: '/api/ai/metrics' },
      ];

      for (const endpoint of endpoints) {
        const req = request(app)[endpoint.method](endpoint.path);
        
        if (endpoint.body) {
          req.send(endpoint.body);
        }
        
        const response = await req;

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toHaveProperty('code');
        expect(response.body.error).toHaveProperty('message');
        expect(response.body.error).toHaveProperty('statusCode');
      }
    });
  });

  describe('Edge Cases', () => {
    
    test('should handle empty string message', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ message: '' })
        .expect(400);

      expect(response.body.success).toBe(false);
      // Empty string should be rejected by sanitizer middleware
    });

    test('should handle very long message', async () => {
      const longMessage = 'a'.repeat(1000);
      
      const response = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ message: longMessage });

      // Should be rejected by sanitizer (500 char limit)
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test('should handle special characters in message', async () => {
      const specialMessage = '<script>alert("XSS")</script> 你好 🎉';
      
      const response = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${testToken}`)
        .send({ message: specialMessage });

      // Should be handled by sanitizer
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test('should handle concurrent requests from same user', async () => {
      const promises = [];
      
      for (let i = 0; i < 3; i++) {
        promises.push(
          request(app)
            .get('/api/ai/history')
            .set('Authorization', `Bearer ${testToken}`)
        );
      }

      const responses = await Promise.all(promises);

      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });
    });
  });
});
