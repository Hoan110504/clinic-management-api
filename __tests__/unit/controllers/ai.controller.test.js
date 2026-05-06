/**
 * AI Controller Unit Tests
 * 
 * Tests input validation, error response formatting, and rate limit headers
 * 
 * Requirements: 22.1
 */

import { jest } from '@jest/globals';

// Mock dependencies before importing controller
const mockGeminiService = {
  selectQueries: jest.fn(),
  synthesizeAnswer: jest.fn(),
};

const mockConversationManager = {
  appendMessage: jest.fn(),
  getHistory: jest.fn(),
  clearHistory: jest.fn(),
  getSessionCount: jest.fn(),
};

const mockQueryHandler = {
  executeMultipleQueries: jest.fn(),
};

const mockChatLogger = {
  logInteraction: jest.fn(),
  logError: jest.fn(),
};

const mockGetAvailableQueries = jest.fn();
const mockGetRateLimitStatus = jest.fn();

// Mock modules
jest.unstable_mockModule('../../../src/services/gemini.service.js', () => ({
  default: mockGeminiService,
}));

jest.unstable_mockModule('../../../src/services/conversationManager.js', () => ({
  default: mockConversationManager,
}));

jest.unstable_mockModule('../../../src/services/queryHandler.service.js', () => ({
  default: mockQueryHandler,
}));

jest.unstable_mockModule('../../../src/services/chatLogger.service.js', () => ({
  default: mockChatLogger,
}));

jest.unstable_mockModule('../../../src/config/queryWhitelist.js', () => ({
  getAvailableQueries: mockGetAvailableQueries,
}));

jest.unstable_mockModule('../../../src/middleware/aiRateLimiter.js', () => ({
  getRateLimitStatus: mockGetRateLimitStatus,
}));

// Import controller after mocks are set up
const { chat, getHistory, getRateStatus, clearHistory, getMetrics } = await import('../../../src/controllers/ai.controller.js');

describe('AI Controller Unit Tests', () => {
  let req, res, next;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup request, response, and next mocks
    req = {
      body: {},
      user: { id: 1, role: 5 },
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' },
      rateLimitInfo: { userRemaining: 19, ipRemaining: 49 },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    next = jest.fn();

    // Default mock implementations
    mockConversationManager.getHistory.mockReturnValue([]);
    mockGetAvailableQueries.mockReturnValue([
      { id: 'my_appointments', description: 'Get my appointments' },
    ]);
    mockGeminiService.selectQueries.mockResolvedValue(['my_appointments']);
    mockQueryHandler.executeMultipleQueries.mockResolvedValue([
      { query_id: 'my_appointments', data: [], row_count: 0, execution_time_ms: 100 },
    ]);
    mockGeminiService.synthesizeAnswer.mockResolvedValue('Test AI response');
    mockChatLogger.logInteraction.mockResolvedValue({});
    mockChatLogger.logError.mockResolvedValue({});
    mockGetRateLimitStatus.mockReturnValue({
      userLimit: 20,
      userRemaining: 19,
      ipLimit: 50,
      ipRemaining: 49,
    });
  });

  describe('chat endpoint - input validation', () => {
    it('should validate message is required', async () => {
      req.body = {};

      await chat(req, res, next);

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error).toBeDefined();
      expect(error.statusCode).toBe(400);
      expect(error.code).toBe('INVALID_INPUT');
      expect(error.message).toContain('Message field is required');
    });

    it('should validate message is a string', async () => {
      req.body = { message: 123 };

      await chat(req, res, next);

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error).toBeDefined();
      expect(error.statusCode).toBe(400);
    });

    it('should validate message is not empty', async () => {
      req.body = { message: '' };

      await chat(req, res, next);

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error).toBeDefined();
      expect(error.statusCode).toBe(400);
    });
  });

  describe('chat endpoint - conversation flow', () => {
    it('should append user message to conversation history', async () => {
      req.body = { message: 'Test message' };

      await chat(req, res, next);

      expect(mockConversationManager.appendMessage).toHaveBeenCalledWith(
        1,
        'user',
        'Test message'
      );
    });

    it('should get available queries for user role', async () => {
      req.body = { message: 'Test message' };

      await chat(req, res, next);

      expect(mockGetAvailableQueries).toHaveBeenCalledWith(5);
    });

    it('should call AI service for query selection', async () => {
      req.body = { message: 'Test message' };

      await chat(req, res, next);

      expect(mockGeminiService.selectQueries).toHaveBeenCalled();
      const callArgs = mockGeminiService.selectQueries.mock.calls[0];
      expect(callArgs[0]).toBe('Test message');
      expect(callArgs[1]).toEqual([{ id: 'my_appointments', description: 'Get my appointments' }]);
    });

    it('should execute selected queries', async () => {
      req.body = { message: 'Test message' };

      await chat(req, res, next);

      expect(mockQueryHandler.executeMultipleQueries).toHaveBeenCalledWith(
        ['my_appointments'],
        1,
        5
      );
    });

    it('should call AI service for answer synthesis', async () => {
      req.body = { message: 'Test message' };

      await chat(req, res, next);

      expect(mockGeminiService.synthesizeAnswer).toHaveBeenCalled();
    });
  });

  describe('chat endpoint - error handling', () => {
    it('should log errors when AI service fails', async () => {
      req.body = { message: 'Test message' };
      // Mock Pass 2 (synthesizeAnswer) to fail, not Pass 1
      mockGeminiService.synthesizeAnswer.mockRejectedValue(new Error('AI service error'));

      await chat(req, res, next);

      expect(mockChatLogger.logError).toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.message).toBe('AI service error. Please try again.');
    });

    it('should include error details in logs', async () => {
      req.body = { message: 'Test message' };
      const testError = new Error('Detailed error');
      // Mock Pass 2 (synthesizeAnswer) to fail, not Pass 1
      mockGeminiService.synthesizeAnswer.mockRejectedValue(testError);

      await chat(req, res, next);

      expect(mockChatLogger.logError).toHaveBeenCalled();
      const logData = mockChatLogger.logError.mock.calls[0][0];
      expect(logData.errorMessage).toContain('AI service error');
    });
  });

  describe('getHistory endpoint', () => {
    it('should return conversation history', async () => {
      const mockHistory = [
        { role: 'user', content: 'Hello', timestamp: new Date() },
        { role: 'model', content: 'Hi there', timestamp: new Date() },
      ];
      mockConversationManager.getHistory.mockReturnValue(mockHistory);

      await getHistory(req, res, next);

      expect(mockConversationManager.getHistory).toHaveBeenCalledWith(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();

      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data.messages).toEqual(mockHistory);
      expect(response.data.count).toBe(2);
    });

    it('should return empty array for new user', async () => {
      mockConversationManager.getHistory.mockReturnValue([]);

      await getHistory(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response.data.messages).toEqual([]);
      expect(response.data.count).toBe(0);
    });
  });

  describe('getRateStatus endpoint', () => {
    it('should return rate limit status', async () => {
      const mockStatus = {
        userLimit: 20,
        userRemaining: 15,
        userResetTime: new Date().toISOString(),
        ipLimit: 50,
        ipRemaining: 45,
        ipResetTime: new Date().toISOString(),
      };
      mockGetRateLimitStatus.mockReturnValue(mockStatus);

      await getRateStatus(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();

      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockStatus);
    });

    it('should call getRateLimitStatus with correct parameters', async () => {
      req.user.id = 123;
      req.ip = '192.168.1.1';

      await getRateStatus(req, res, next);

      expect(mockGetRateLimitStatus).toHaveBeenCalledWith(123, '192.168.1.1');
    });
  });

  describe('clearHistory endpoint', () => {
    it('should clear conversation history', async () => {
      mockConversationManager.clearHistory.mockReturnValue(true);

      await clearHistory(req, res, next);

      expect(mockConversationManager.clearHistory).toHaveBeenCalledWith(1);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();

      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data.message).toBe('Conversation history cleared');
      expect(response.data.cleared).toBe(true);
    });

    it('should handle case when no history exists', async () => {
      mockConversationManager.clearHistory.mockReturnValue(false);

      await clearHistory(req, res, next);

      expect(res.json).toHaveBeenCalled();
      const response = res.json.mock.calls[0][0];
      expect(response.data.cleared).toBe(false);
    });
  });

  describe('getMetrics endpoint', () => {
    it('should return metrics for admin user', async () => {
      req.user.role = 1; // Admin
      mockConversationManager.getSessionCount.mockReturnValue(5);

      await getMetrics(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();

      const response = res.json.mock.calls[0][0];
      expect(response.success).toBe(true);
      expect(response.data.activeSessions).toBe(5);
      expect(response.data.timestamp).toBeDefined();
    });

    it('should reject non-admin users', async () => {
      req.user.role = 5; // Patient

      await getMetrics(req, res, next);

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error).toBeDefined();
      expect(error.statusCode).toBe(403);
      expect(error.code).toBe('FORBIDDEN');
    });
  });
});
