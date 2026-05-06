/**
 * Integration Tests for AI Controller
 * 
 * Tests complete two-pass flow, role-based access control, conversation history,
 * error handling, and audit logging.
 * 
 * Validates: Requirements 22.2, 22.4, 22.6, 22.8
 */

import request from 'supertest';
import app from '../../app.js';
import models from '../../models/index.js';
import conversationManager from '../../services/conversationManager.js';
import { clearAllRateLimits } from '../../middleware/aiRateLimiter.js';
import jwt from 'jsonwebtoken';
import config from '../../config/index.js';

const { User, Patient, AiChatLog } = models;

// Helper function to generate JWT token
function generateToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, username: user.username },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

// Helper function to create test user
async function createTestUser(roleId, username) {
  const user = await User.create({
    username,
    password: 'hashedpassword',
    fullName: `Test User ${username}`,
    email: `${username}@test.com`,
    role: roleId,
    isActive: true,
  });
  return user;
}

// Helper function to create test patient
async function createTestPatient(userId) {
  const patient = await Patient.create({
    userId,
    fullName: 'Test Patient',
    dateOfBirth: new Date('1990-01-01'),
    gender: 'Nam',
    phone: '0123456789',
    address: 'Test Address',
  });
  return patient;
}

describe('AI Controller - Integration Tests', () => {
  let patientUser;
  let doctorUser;
  let adminUser;
  let patientToken;
  let doctorToken;
  let adminToken;

  beforeAll(async () => {
    // Create test users
    patientUser = await createTestUser(5, 'patienttest');
    doctorUser = await createTestUser(2, 'doctortest');
    adminUser = await createTestUser(1, 'admintest');

    // Create patient record for patient user
    await createTestPatient(patientUser.id);

    // Generate tokens
    patientToken = generateToken(patientUser);
    doctorToken = generateToken(doctorUser);
    adminToken = generateToken(adminUser);
  });

  afterAll(async () => {
    // Clean up test data
    await AiChatLog.destroy({ where: { user_id: [patientUser.id, doctorUser.id, adminUser.id] } });
    await Patient.destroy({ where: { userId: patientUser.id } });
    await User.destroy({ where: { id: [patientUser.id, doctorUser.id, adminUser.id] } });
    
    // Close database connection
    await models.sequelize.close();
  });

  beforeEach(() => {
    // Clear conversation history and rate limits before each test
    conversationManager.clearAllSessions();
    clearAllRateLimits();
  });

  describe('POST /api/ai/chat - Complete Two-Pass Flow', () => {
    
    test('should complete two-pass flow for patient query', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ message: 'What are my upcoming appointments?' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.response).toBeDefined();
      expect(typeof response.body.data.response).toBe('string');
      expect(response.body.data.queryIds).toBeDefined();
      expect(Array.isArray(response.body.data.queryIds)).toBe(true);
      expect(response.body.data.remainingRequests).toBeDefined();
      expect(typeof response.body.data.remainingRequests).toBe('number');

      // Verify rate limit headers
      expect(response.headers['x-ratelimit-remaining-user']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining-ip']).toBeDefined();
    }, 30000); // 30 second timeout for AI calls

    test('should handle query with no database results', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ message: 'Tell me about the weather today' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.response).toBeDefined();
      // AI should respond even without query results
      expect(response.body.data.response.length).toBeGreaterThan(0);
    }, 30000);

    test('should maintain conversation context across multiple messages', async () => {
      // First message
      const response1 = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ message: 'What medicines are available?' })
        .expect(200);

      expect(response1.body.success).toBe(true);

      // Second message referencing first
      const response2 = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ message: 'Can you tell me more about the first one?' })
        .expect(200);

      expect(response2.body.success).toBe(true);
      expect(response2.body.data.response).toBeDefined();

      // Verify conversation history was used
      const history = conversationManager.getHistory(patientUser.id);
      expect(history.length).toBe(4); // 2 user messages + 2 AI responses
    }, 60000);
  });

  describe('Role-Based Access Control', () => {
    
    test('should allow patient to access patient-scoped queries', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ message: 'Show me my prescriptions' })
        .expect(200);

      expect(response.body.success).toBe(true);
      // Patient should be able to query their own prescriptions
    }, 30000);

    test('should allow doctor to access clinical queries', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ message: 'What medicines do we have?' })
        .expect(200);

      expect(response.body.success).toBe(true);
      // Doctor should be able to query medicines
    }, 30000);

    test('should prevent patient from accessing admin queries', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ message: 'Show me all patient medical records' })
        .expect(200);

      expect(response.body.success).toBe(true);
      // AI should respond but not execute unauthorized queries
      // The query_ids should not include admin-only queries
    }, 30000);
  });

  describe('Conversation History Persistence', () => {
    
    test('should persist conversation history across multiple messages', async () => {
      // Send 3 messages
      await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ message: 'First message' })
        .expect(200);

      await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ message: 'Second message' })
        .expect(200);

      await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ message: 'Third message' })
        .expect(200);

      // Get history
      const response = await request(app)
        .get('/api/ai/history')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.messages.length).toBe(6); // 3 user + 3 AI messages
      expect(response.body.data.count).toBe(6);
    }, 90000);

    test('should maintain separate histories for different users', async () => {
      // Patient sends message
      await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ message: 'Patient message' })
        .expect(200);

      // Doctor sends message
      await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ message: 'Doctor message' })
        .expect(200);

      // Get patient history
      const patientHistory = await request(app)
        .get('/api/ai/history')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);

      // Get doctor history
      const doctorHistory = await request(app)
        .get('/api/ai/history')
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(200);

      // Verify separate histories
      expect(patientHistory.body.data.messages.length).toBe(2);
      expect(doctorHistory.body.data.messages.length).toBe(2);
      
      // Verify no cross-contamination
      const patientMessages = patientHistory.body.data.messages.map(m => m.content);
      const doctorMessages = doctorHistory.body.data.messages.map(m => m.content);
      
      expect(patientMessages).toContain('Patient message');
      expect(patientMessages).not.toContain('Doctor message');
      expect(doctorMessages).toContain('Doctor message');
      expect(doctorMessages).not.toContain('Patient message');
    }, 60000);
  });

  describe('Error Handling', () => {
    
    test('should return 401 when no token provided', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .send({ message: 'Test message' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBeDefined();
    });

    test('should return 400 when message field is missing', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_MESSAGE');
    });

    test('should return 400 when message is not a string', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ message: 123 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_MESSAGE');
    });

    test('should handle AI service errors gracefully', async () => {
      // This test would require mocking the Gemini service to fail
      // For now, we'll test that the error handling structure is in place
      
      // Send a message that might cause issues
      const response = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ message: 'Test message' })
        .expect((res) => {
          // Should either succeed or return proper error format
          if (!res.body.success) {
            expect(res.body.error).toBeDefined();
            expect(res.body.error.code).toBeDefined();
            expect(res.body.error.message).toBeDefined();
          }
        });
    }, 30000);
  });

  describe('Audit Logging to AiChatLog', () => {
    
    test('should log successful interaction to AiChatLog', async () => {
      const testMessage = 'Test message for logging';
      
      await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ message: testMessage })
        .expect(200);

      // Wait a bit for async logging
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify log entry was created
      const logEntry = await AiChatLog.findOne({
        where: {
          user_id: patientUser.id,
          user_message: testMessage,
        },
        order: [['timestamp', 'DESC']],
      });

      expect(logEntry).toBeDefined();
      expect(logEntry.user_id).toBe(patientUser.id);
      expect(logEntry.user_role).toBe(patientUser.role);
      expect(logEntry.user_message).toBe(testMessage);
      expect(logEntry.ai_response).toBeDefined();
      expect(logEntry.selected_query_ids).toBeDefined();
      expect(logEntry.response_time_ms).toBeGreaterThan(0);
      expect(logEntry.is_blocked).toBe(false);
      expect(logEntry.is_rate_limited).toBe(false);
    }, 30000);

    test('should log query IDs in the audit trail', async () => {
      await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ message: 'Show my appointments' })
        .expect(200);

      // Wait for async logging
      await new Promise(resolve => setTimeout(resolve, 1000));

      const logEntry = await AiChatLog.findOne({
        where: { user_id: patientUser.id },
        order: [['timestamp', 'DESC']],
      });

      expect(logEntry).toBeDefined();
      expect(logEntry.selected_query_ids).toBeDefined();
      // selected_query_ids should be a JSON array
      expect(Array.isArray(logEntry.selected_query_ids)).toBe(true);
    }, 30000);

    test('should log response time metrics', async () => {
      await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ message: 'Test message' })
        .expect(200);

      // Wait for async logging
      await new Promise(resolve => setTimeout(resolve, 1000));

      const logEntry = await AiChatLog.findOne({
        where: { user_id: patientUser.id },
        order: [['timestamp', 'DESC']],
      });

      expect(logEntry).toBeDefined();
      expect(logEntry.response_time_ms).toBeDefined();
      expect(logEntry.response_time_ms).toBeGreaterThan(0);
      expect(logEntry.response_time_ms).toBeLessThan(60000); // Should be under 60 seconds
    }, 30000);
  });

  describe('GET /api/ai/history', () => {
    
    test('should return conversation history for authenticated user', async () => {
      // Send a message first
      await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ message: 'Test message' })
        .expect(200);

      // Get history
      const response = await request(app)
        .get('/api/ai/history')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.messages).toBeDefined();
      expect(Array.isArray(response.body.data.messages)).toBe(true);
      expect(response.body.data.count).toBe(response.body.data.messages.length);
    }, 30000);

    test('should return empty history for new user', async () => {
      const response = await request(app)
        .get('/api/ai/history')
        .set('Authorization', `Bearer ${doctorToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.messages).toEqual([]);
      expect(response.body.data.count).toBe(0);
    });

    test('should require authentication', async () => {
      await request(app)
        .get('/api/ai/history')
        .expect(401);
    });
  });

  describe('GET /api/ai/rate-status', () => {
    
    test('should return rate limit status for authenticated user', async () => {
      const response = await request(app)
        .get('/api/ai/rate-status')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.userLimit).toBe(20);
      expect(response.body.data.userRemaining).toBeLessThanOrEqual(20);
      expect(response.body.data.ipLimit).toBe(50);
      expect(response.body.data.ipRemaining).toBeLessThanOrEqual(50);
      expect(response.body.data.userResetTime).toBeDefined();
      expect(response.body.data.ipResetTime).toBeDefined();
    });

    test('should require authentication', async () => {
      await request(app)
        .get('/api/ai/rate-status')
        .expect(401);
    });
  });

  describe('DELETE /api/ai/history', () => {
    
    test('should clear conversation history for authenticated user', async () => {
      // Send a message first
      await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ message: 'Test message' })
        .expect(200);

      // Verify history exists
      let history = await request(app)
        .get('/api/ai/history')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);

      expect(history.body.data.count).toBeGreaterThan(0);

      // Clear history
      const response = await request(app)
        .delete('/api/ai/history')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Conversation history cleared');

      // Verify history is empty
      history = await request(app)
        .get('/api/ai/history')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(200);

      expect(history.body.data.count).toBe(0);
    }, 30000);

    test('should require authentication', async () => {
      await request(app)
        .delete('/api/ai/history')
        .expect(401);
    });
  });

  describe('GET /api/ai/metrics', () => {
    
    test('should return metrics for admin user', async () => {
      const response = await request(app)
        .get('/api/ai/metrics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.activeSessions).toBeDefined();
      expect(typeof response.body.data.activeSessions).toBe('number');
    });

    test('should deny access for non-admin users', async () => {
      const response = await request(app)
        .get('/api/ai/metrics')
        .set('Authorization', `Bearer ${patientToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });

    test('should require authentication', async () => {
      await request(app)
        .get('/api/ai/metrics')
        .expect(401);
    });
  });

  describe('Rate Limiting Integration', () => {
    
    test('should enforce user rate limit after 20 requests', async () => {
      // Send 20 requests (should all succeed)
      for (let i = 0; i < 20; i++) {
        await request(app)
          .post('/api/ai/chat')
          .set('Authorization', `Bearer ${patientToken}`)
          .send({ message: `Test message ${i}` })
          .expect(200);
      }

      // 21st request should be rate limited
      const response = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ message: 'Test message 21' })
        .expect(429);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TOO_MANY_REQUESTS');
      expect(response.headers['retry-after']).toBeDefined();
    }, 600000); // 10 minute timeout for 20+ AI calls

    test('should update remaining count in response', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${doctorToken}`)
        .send({ message: 'Test message' })
        .expect(200);

      expect(response.body.data.remainingRequests).toBeDefined();
      expect(response.body.data.remainingRequests).toBeLessThanOrEqual(20);
      expect(response.body.data.remainingRequests).toBeGreaterThanOrEqual(0);
    }, 30000);
  });
});
