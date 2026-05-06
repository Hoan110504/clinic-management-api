/**
 * AI Controller Integration Tests
 * 
 * Tests the complete two-pass flow, role-based access control,
 * conversation history, error handling, and audit logging.
 * 
 * Requirements: 22.2, 22.4, 22.6, 22.8
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../../src/app.js';
import config from '../../src/config/index.js';
import models from '../../src/models/index.js';
import conversationManager from '../../src/services/conversationManager.js';
import { clearAllRateLimits } from '../../src/middleware/aiRateLimiter.js';
import { ROLES } from '../../src/config/constants.js';

const { User, Patient, AiChatLog } = models;

// Helper to generate JWT token for testing
function generateTestToken(userId, role) {
  return jwt.sign({ id: userId, role }, config.jwt.secret, { expiresIn: '1h' });
}

// Test users
let adminUser, doctorUser, patientUser, patientRecord;
let adminToken, doctorToken, patientToken;

describe('AI Controller Integration Tests', () => {
  beforeAll(async () => {
    // Create test users
    adminUser = await User.create({
      username: 'admin_ai_test',
      email: 'admin_ai@test.com',
      password: 'password123',
      fullName: 'Admin AI Test',
      role: ROLES.ADMIN,
      isActive: true,
    });

    doctorUser = await User.create({
      username: 'doctor_ai_test',
      email: 'doctor_ai@test.com',
      password: 'password123',
      fullName: 'Doctor AI Test',
      role: ROLES.DOCTOR,
      isActive: true,
    });

    patientUser = await User.create({
      username: 'patient_ai_test',
      email: 'patient_ai@test.com',
      password: 'password123',
      fullName: 'Patient AI Test',
      phone: '0123456789',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'Nam',
      address: '123 Test St',
      role: ROLES.PATIENT,
      isActive: true,
    });

    // Create patient record
    patientRecord = await Patient.create({
      userId: patientUser.id,
      fullName: 'Patient AI Test',
      dateOfBirth: new Date('1990-01-01'),
      gender: 'Nam',
      phone: '0123456789',
      address: '123 Test St',
    });

    // Generate tokens
    adminToken = generateTestToken(adminUser.id, adminUser.role);
    doctorToken = generateTestToken(doctorUser.id, doctorUser.role);
    patientToken = generateTestToken(patientUser.id, patientUser.role);
  });

  afterAll(async () => {
    // Clean up test data
    await AiChatLog.destroy({ where: { user_id: [adminUser.id, doctorUser.id, patientUser.id] }, force: true });
    await Patient.destroy({ where: { id: patientRecord.id }, force: true });
    await User.destroy({ where: { id: [adminUser.id, doctorUser.id, patientUser.id] }, force: true });
  });

  beforeEach(() => {
    // Clear rate limits and conversation history before each test
    clearAllRateLimits();
    conversationManager.clearAllSessions();
  });

  describe('POST /api/ai/chat', () => {
    it('should complete two-pass flow for patient query', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ message: 'What are my upcoming appointments?' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('response');
      expect(response.body.data).toHaveProperty('queryIds');
      expect(response.body.data).toHaveProperty('remainingRequests');
      expect(typeof response.body.data.response).toBe('string');
      expect(Array.isArray(response.body.data.queryIds)).toBe(true);

      // Verify audit log was created
      const log = await AiChatLog.findOne({
        where: { user_id: patientUser.id },
        order: [['timestamp', 'DESC']],
      });

      expect(log).toBeDefined();
      expect(log.user_message).toBe('What are my upcoming appointments?');
      expect(log.ai_response).toBe(response.body.data.response);
      expect(log.is_blocked).toBe(false);
      expect(log.is_rate_limited).toBe(false);
    }, 30000); // 30 second timeout for AI calls

    it('should reject request without authentication', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .send({ message: 'Test message' });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it('should reject request with invalid message', async () => {
      const response = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ message: '' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should enforce role-based access control on queries', async () => {
      // Patient should only access patient-scoped queries
      const response = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ message: 'Show me all medicines in the system' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // The AI should not select queries that require admin/doctor/pharmacist roles
      // Patient role (5) should only have access to: my_appointments, my_prescriptions, my_lab_results, my_medical_history
      const log = await AiChatLog.findOne({
        where: { user_id: patientUser.id },
        order: [['timestamp', 'DESC']],
      });

      expect(log).toBeDefined();
      const selectedQueryIds = log.selected_query_ids || [];
      
      // Verify no unauthorized queries were selected
      const unauthorizedQueries = ['medicines_info', 'patient_medical_history', 'lab_tests_pending', 'low_stock_medicines', 'appointment_schedule'];
      const hasUnauthorizedQuery = selectedQueryIds.some(qid => unauthorizedQueries.includes(qid));
      expect(hasUnauthorizedQuery).toBe(false);
    }, 30000);

    it('should maintain conversation history across messages', async () => {
      // Send first message
      const response1 = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ message: 'Hello, I need help' });

      expect(response1.status).toBe(200);

      // Send second message
      const response2 = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ message: 'What did I just say?' });

      expect(response2.status).toBe(200);

      // Verify conversation history contains both messages
      const history = conversationManager.getHistory(patientUser.id);
      expect(history.length).toBeGreaterThanOrEqual(2);
      
      const userMessages = history.filter(msg => msg.role === 'user');
      expect(userMessages.length).toBeGreaterThanOrEqual(2);
      expect(userMessages[0].content).toBe('Hello, I need help');
      expect(userMessages[1].content).toBe('What did I just say?');
    }, 30000);

    it('should handle AI service errors gracefully', async () => {
      // Send a message that might cause issues (very long or malformed)
      const response = await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ message: 'Test error handling' });

      // Should either succeed or return a proper error response
      expect([200, 500, 503]).toContain(response.status);
      expect(response.body).toHaveProperty('success');

      if (!response.body.success) {
        expect(response.body.error).toHaveProperty('code');
        expect(response.body.error).toHaveProperty('message');
      }
    }, 30000);
  });

  describe('GET /api/ai/history', () => {
    it('should return conversation history for authenticated user', async () => {
      // Send a message first to create history
      await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ message: 'Test message for history' });

      // Get history
      const response = await request(app)
        .get('/api/ai/history')
        .set('Authorization', `Bearer ${patientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('messages');
      expect(response.body.data).toHaveProperty('count');
      expect(Array.isArray(response.body.data.messages)).toBe(true);
      expect(response.body.data.count).toBeGreaterThan(0);
    }, 30000);

    it('should return empty history for new user', async () => {
      const response = await request(app)
        .get('/api/ai/history')
        .set('Authorization', `Bearer ${doctorToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.messages).toEqual([]);
      expect(response.body.data.count).toBe(0);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/ai/history');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/ai/rate-status', () => {
    it('should return rate limit status for authenticated user', async () => {
      const response = await request(app)
        .get('/api/ai/rate-status')
        .set('Authorization', `Bearer ${patientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('userLimit');
      expect(response.body.data).toHaveProperty('userRemaining');
      expect(response.body.data).toHaveProperty('userResetTime');
      expect(response.body.data).toHaveProperty('ipLimit');
      expect(response.body.data).toHaveProperty('ipRemaining');
      expect(response.body.data).toHaveProperty('ipResetTime');
      expect(response.body.data.userLimit).toBe(20);
      expect(response.body.data.ipLimit).toBe(50);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/ai/rate-status');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/ai/history', () => {
    it('should clear conversation history for authenticated user', async () => {
      // Send a message first to create history
      await request(app)
        .post('/api/ai/chat')
        .set('Authorization', `Bearer ${patientToken}`)
        .send({ message: 'Test message to clear' });

      // Verify history exists
      let history = conversationManager.getHistory(patientUser.id);
      expect(history.length).toBeGreaterThan(0);

      // Clear history
      const response = await request(app)
        .delete('/api/ai/history')
        .set('Authorization', `Bearer ${patientToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toBe('Conversation history cleared');

      // Verify history is cleared
      history = conversationManager.getHistory(patientUser.id);
      expect(history.length).toBe(0);
    }, 30000);

    it('should require authentication', async () => {
      const response = await request(app)
        .delete('/api/ai/history');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/ai/metrics', () => {
    it('should return metrics for admin user', async () => {
      const response = await request(app)
        .get('/api/ai/metrics')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('activeSessions');
      expect(response.body.data).toHaveProperty('timestamp');
    });

    it('should reject non-admin users', async () => {
      const response = await request(app)
        .get('/api/ai/metrics')
        .set('Authorization', `Bearer ${patientToken}`);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/ai/metrics');

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });
  });
});
