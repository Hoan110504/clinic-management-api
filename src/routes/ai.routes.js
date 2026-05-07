/**
 * AI Medical Chatbot Routes
 * 
 * Endpoints for AI-powered medical consultation chatbot.
 * All routes require authentication and apply security middleware chain:
 * - Authentication (JWT validation)
 * - Rate limiting (20/user, 50/IP per 10 minutes)
 * - Input sanitization (HTML stripping, prompt injection detection)
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 11.9
 */

import express from 'express';
import { authenticate, authorize } from '../middleware/auth.js';
import { aiRateLimiter } from '../middleware/aiRateLimiter.js';
import { aiSummaryRateLimiter } from '../middleware/aiSummaryRateLimiter.js';
import { aiSanitizer } from '../middleware/aiSanitizer.js';
import { validateSummarizeRequest } from '../validators/aiSummary.validator.js';
import aiController from '../controllers/ai.controller.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();

// All AI routes require authentication
router.use(authenticate);

/**
 * @route POST /api/ai/chat
 * @desc Send a message to the AI chatbot
 * @access All authenticated users
 * @middleware auth → rate limiter → sanitizer → controller
 * 
 * Request body:
 * {
 *   "message": "What medicines do we have for fever?"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "response": "Based on our inventory...",
 *     "queryIds": ["medicines_info"],
 *     "remainingRequests": 15
 *   }
 * }
 * 
 * Requirements: 11.1, 11.2, 11.3
 */
router.post(
  '/chat',
  aiRateLimiter,
  aiSanitizer,
  aiController.chat
);

/**
 * @route GET /api/ai/history
 * @desc Retrieve conversation history for the current user
 * @access All authenticated users
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "messages": [
 *       { "role": "user", "content": "...", "timestamp": "..." },
 *       { "role": "model", "content": "...", "timestamp": "..." }
 *     ],
 *     "count": 2
 *   }
 * }
 * 
 * Requirements: 11.4, 11.5
 */
router.get(
  '/history',
  aiController.getHistory
);

/**
 * @route GET /api/ai/rate-status
 * @desc Check current rate limit status
 * @access All authenticated users
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "userLimit": 20,
 *     "userRemaining": 15,
 *     "userResetTime": "2024-01-15T10:40:00+07:00",
 *     "ipLimit": 50,
 *     "ipRemaining": 45,
 *     "ipResetTime": "2024-01-15T10:40:00+07:00"
 *   }
 * }
 * 
 * Requirements: 11.6, 11.7
 */
router.get(
  '/rate-status',
  aiController.getRateStatus
);

/**
 * @route DELETE /api/ai/history
 * @desc Clear conversation history for the current user
 * @access All authenticated users
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "message": "Conversation history cleared",
 *     "cleared": true
 *   }
 * }
 * 
 * Requirements: 11.8
 */
router.delete(
  '/history',
  aiController.clearHistory
);

/**
 * @route GET /api/ai/metrics
 * @desc Get AI chatbot usage metrics (Admin only)
 * @access Admin only
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "activeSessions": 5,
 *     "totalRequests": 1234,
 *     "averageResponseTime": 3500,
 *     "errorRate": 0.02,
 *     "rateLimitHits": 45,
 *     "activeUsers": 23,
 *     "topQueries": [...],
 *     "geminiApiUsage": {
 *       "requestsSent": 1234,
 *       "rateLimitErrors": 5
 *     }
 *   }
 * }
 * 
 * Requirements: 24.4, 24.5
 */
router.get(
  '/metrics',
  authorize(ROLES.ADMIN),
  aiController.getMetrics
);

/**
 * @route POST /api/ai/summarize-medical-record
 * @desc Generate AI summary for a medical record
 * @access Doctors only (role = 2)
 * @middleware auth → rate limiter → validator → controller
 * 
 * Request body:
 * {
 *   "medicalRecordId": 123,
 *   "patientId": 456
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "summary": "Tiền sử: Bệnh nhân có tiền sử...",
 *     "queryIds": ["getPatientBasicInfo", "getMedicalHistory", ...],
 *     "generatedAt": "2024-01-15T10:30:00+07:00",
 *     "remainingRequests": 8,
 *     "cached": false
 *   }
 * }
 * 
 * Requirements: 7.1, 1.1, 1.2, 1.3, 1.4, 2.1, 2.2
 */
router.post(
  '/summarize-medical-record',
  aiSummaryRateLimiter,
  validateSummarizeRequest,
  aiController.summarizeMedicalRecord
);

export default router;
