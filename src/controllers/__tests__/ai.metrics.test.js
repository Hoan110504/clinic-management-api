/**
 * Unit tests for AI Metrics Endpoint
 * 
 * Tests the GET /api/ai/metrics endpoint functionality.
 * Requirements: 24.4, 24.5
 */

import { jest } from '@jest/globals';

// Mock dependencies
const mockMetricsService = {
  getCombinedMetrics: jest.fn(),
};

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
};

jest.unstable_mockModule('../../services/metrics.service.js', () => ({
  default: mockMetricsService,
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  default: mockLogger,
}));

// Import after mocking
const { getMetrics } = await import('../../controllers/ai.controller.js');

describe('AI Metrics Endpoint', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();

    req = {
      user: {
        id: 1,
        role: 1, // Admin role
      },
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    next = jest.fn();
  });

  describe('GET /api/ai/metrics', () => {
    it('should return metrics for admin user (Requirement 24.4)', async () => {
      const mockMetrics = {
        current_session: {
          total_requests: 100,
          average_response_time: 1500,
          error_rate: 0.02,
          rate_limit_hits: 5,
          active_users: 20,
          gemini_api_usage: {
            requests_sent: 100,
            rate_limit_errors: 2,
          },
          query_execution_stats: [
            {
              query_id: 'my_appointments',
              execution_count: 50,
              average_execution_time: 150,
            },
          ],
          uptime_ms: 3600000,
        },
        last_24_hours: {
          total_requests: 1000,
          average_response_time: 1600,
          error_rate: 0.03,
          rate_limit_hits: 20,
          active_users: 150,
          top_queries: [
            { query_ids: '["my_appointments"]', count: 400 },
            { query_ids: '["medicines_info"]', count: 300 },
          ],
          period: {
            start: '2024-01-14T10:00:00.000Z',
            end: '2024-01-15T10:00:00.000Z',
          },
        },
        timestamp: '2024-01-15T10:00:00.000Z',
      };

      mockMetricsService.getCombinedMetrics.mockResolvedValue(mockMetrics);

      await getMetrics(req, res, next);

      expect(mockMetricsService.getCombinedMetrics).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockMetrics,
      });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Metrics retrieved',
        expect.objectContaining({
          userId: 1,
          timestamp: mockMetrics.timestamp,
        })
      );
    });

    it('should return all required metrics fields (Requirement 24.5)', async () => {
      const mockMetrics = {
        current_session: {
          total_requests: 100,
          average_response_time: 1500,
          error_rate: 0.02,
          rate_limit_hits: 5,
          active_users: 20,
          gemini_api_usage: {
            requests_sent: 100,
            rate_limit_errors: 2,
          },
          query_execution_stats: [],
          uptime_ms: 3600000,
        },
        last_24_hours: null,
        timestamp: '2024-01-15T10:00:00.000Z',
      };

      mockMetricsService.getCombinedMetrics.mockResolvedValue(mockMetrics);

      await getMetrics(req, res, next);

      const responseData = res.json.mock.calls[0][0].data;

      // Verify all required fields are present (Requirement 24.5)
      expect(responseData.current_session).toHaveProperty('total_requests');
      expect(responseData.current_session).toHaveProperty('average_response_time');
      expect(responseData.current_session).toHaveProperty('error_rate');
      expect(responseData.current_session).toHaveProperty('rate_limit_hits');
      expect(responseData.current_session).toHaveProperty('active_users');
      expect(responseData.current_session.gemini_api_usage).toHaveProperty('requests_sent');
      expect(responseData.current_session.gemini_api_usage).toHaveProperty('rate_limit_errors');
    });

    it('should reject non-admin users with 403', async () => {
      req.user.role = 5; // Patient role

      await getMetrics(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          code: 'FORBIDDEN',
          message: 'Insufficient permissions. Admin access required.',
        })
      );
      expect(mockMetricsService.getCombinedMetrics).not.toHaveBeenCalled();
    });

    it('should reject doctor users with 403', async () => {
      req.user.role = 2; // Doctor role

      await getMetrics(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 403,
          code: 'FORBIDDEN',
        })
      );
    });

    it('should handle metrics service errors gracefully', async () => {
      mockMetricsService.getCombinedMetrics.mockRejectedValue(
        new Error('Database connection failed')
      );

      await getMetrics(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Database connection failed',
        })
      );
    });

    it('should handle empty metrics', async () => {
      const emptyMetrics = {
        current_session: {
          total_requests: 0,
          average_response_time: 0,
          error_rate: 0,
          rate_limit_hits: 0,
          active_users: 0,
          gemini_api_usage: {
            requests_sent: 0,
            rate_limit_errors: 0,
          },
          query_execution_stats: [],
          uptime_ms: 0,
        },
        last_24_hours: {
          total_requests: 0,
          average_response_time: 0,
          error_rate: 0,
          rate_limit_hits: 0,
          active_users: 0,
          top_queries: [],
          period: {
            start: '2024-01-14T10:00:00.000Z',
            end: '2024-01-15T10:00:00.000Z',
          },
        },
        timestamp: '2024-01-15T10:00:00.000Z',
      };

      mockMetricsService.getCombinedMetrics.mockResolvedValue(emptyMetrics);

      await getMetrics(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: emptyMetrics,
      });
    });
  });

  describe('Authorization', () => {
    it('should only allow admin role (role = 1)', async () => {
      const roles = [2, 3, 4, 5, 6]; // doctor, receptionist, pharmacist, patient, labtech

      for (const role of roles) {
        jest.clearAllMocks();
        req.user.role = role;

        await getMetrics(req, res, next);

        expect(next).toHaveBeenCalledWith(
          expect.objectContaining({
            statusCode: 403,
          })
        );
        expect(mockMetricsService.getCombinedMetrics).not.toHaveBeenCalled();
      }
    });

    it('should allow admin role (role = 1)', async () => {
      req.user.role = 1;

      mockMetricsService.getCombinedMetrics.mockResolvedValue({
        current_session: {
          total_requests: 0,
          average_response_time: 0,
          error_rate: 0,
          rate_limit_hits: 0,
          active_users: 0,
          gemini_api_usage: {
            requests_sent: 0,
            rate_limit_errors: 0,
          },
          query_execution_stats: [],
          uptime_ms: 0,
        },
        last_24_hours: null,
        timestamp: '2024-01-15T10:00:00.000Z',
      });

      await getMetrics(req, res, next);

      expect(mockMetricsService.getCombinedMetrics).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
});
