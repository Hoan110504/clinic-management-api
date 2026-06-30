/**
 * Unit tests for Metrics Service
 * 
 * Tests metrics collection and calculation functionality.
 */

import { jest } from '@jest/globals';
import metricsService from '../metrics.service.js';

describe('Metrics Service', () => {
  beforeEach(() => {
    // Reset metrics before each test
    metricsService.resetMetrics();
  });

  describe('recordRequest', () => {
    it('should record successful request metrics (Requirement 24.4)', () => {
      metricsService.recordRequest({
        response_time_ms: 1500,
        is_error: false,
        is_rate_limited: false,
        user_id: 123,
      });

      const metrics = metricsService.getCurrentMetrics();

      expect(metrics.total_requests).toBe(1);
      expect(metrics.average_response_time).toBe(1500);
      expect(metrics.error_rate).toBe(0);
      expect(metrics.rate_limit_hits).toBe(0);
      expect(metrics.active_users).toBe(1);
    });

    it('should record error metrics (Requirement 24.5)', () => {
      metricsService.recordRequest({
        response_time_ms: 500,
        is_error: true,
        is_rate_limited: false,
        user_id: 123,
      });

      const metrics = metricsService.getCurrentMetrics();

      expect(metrics.total_requests).toBe(1);
      expect(metrics.error_rate).toBe(1);
    });

    it('should record rate limit hits (Requirement 24.5)', () => {
      metricsService.recordRequest({
        response_time_ms: 100,
        is_error: false,
        is_rate_limited: true,
        user_id: 123,
      });

      const metrics = metricsService.getCurrentMetrics();

      expect(metrics.rate_limit_hits).toBe(1);
    });

    it('should calculate average response time correctly', () => {
      metricsService.recordRequest({
        response_time_ms: 1000,
        is_error: false,
        is_rate_limited: false,
        user_id: 123,
      });

      metricsService.recordRequest({
        response_time_ms: 2000,
        is_error: false,
        is_rate_limited: false,
        user_id: 124,
      });

      metricsService.recordRequest({
        response_time_ms: 3000,
        is_error: false,
        is_rate_limited: false,
        user_id: 125,
      });

      const metrics = metricsService.getCurrentMetrics();

      expect(metrics.total_requests).toBe(3);
      expect(metrics.average_response_time).toBe(2000);
    });

    it('should calculate error rate correctly', () => {
      // 2 successful, 1 error = 33.33% error rate
      metricsService.recordRequest({
        response_time_ms: 1000,
        is_error: false,
        is_rate_limited: false,
        user_id: 123,
      });

      metricsService.recordRequest({
        response_time_ms: 1000,
        is_error: false,
        is_rate_limited: false,
        user_id: 124,
      });

      metricsService.recordRequest({
        response_time_ms: 500,
        is_error: true,
        is_rate_limited: false,
        user_id: 125,
      });

      const metrics = metricsService.getCurrentMetrics();

      expect(metrics.error_rate).toBeCloseTo(0.3333, 4);
    });

    it('should track unique active users', () => {
      metricsService.recordRequest({
        response_time_ms: 1000,
        is_error: false,
        is_rate_limited: false,
        user_id: 123,
      });

      metricsService.recordRequest({
        response_time_ms: 1000,
        is_error: false,
        is_rate_limited: false,
        user_id: 123, // Same user
      });

      metricsService.recordRequest({
        response_time_ms: 1000,
        is_error: false,
        is_rate_limited: false,
        user_id: 124, // Different user
      });

      const metrics = metricsService.getCurrentMetrics();

      expect(metrics.active_users).toBe(2); // Only 2 unique users
    });
  });

  describe('recordGeminiApiUsage', () => {
    it('should record Gemini API requests (Requirement 24.6)', () => {
      metricsService.recordGeminiApiUsage({
        is_rate_limit_error: false,
      });

      metricsService.recordGeminiApiUsage({
        is_rate_limit_error: false,
      });

      const metrics = metricsService.getCurrentMetrics();

      expect(metrics.gemini_api_usage.requests_sent).toBe(2);
      expect(metrics.gemini_api_usage.rate_limit_errors).toBe(0);
    });

    it('should record Gemini API rate limit errors (Requirement 24.6)', () => {
      metricsService.recordGeminiApiUsage({
        is_rate_limit_error: true,
      });

      metricsService.recordGeminiApiUsage({
        is_rate_limit_error: false,
      });

      metricsService.recordGeminiApiUsage({
        is_rate_limit_error: true,
      });

      const metrics = metricsService.getCurrentMetrics();

      expect(metrics.gemini_api_usage.requests_sent).toBe(3);
      expect(metrics.gemini_api_usage.rate_limit_errors).toBe(2);
    });
  });

  describe('recordQueryExecution', () => {
    it('should record query execution statistics (Requirement 24.7)', () => {
      metricsService.recordQueryExecution({
        query_id: 'my_appointments',
        execution_time_ms: 150,
      });

      metricsService.recordQueryExecution({
        query_id: 'my_appointments',
        execution_time_ms: 250,
      });

      const metrics = metricsService.getCurrentMetrics();

      const queryStats = metrics.query_execution_stats.find(
        q => q.query_id === 'my_appointments'
      );

      expect(queryStats).toBeDefined();
      expect(queryStats.execution_count).toBe(2);
      expect(queryStats.average_execution_time).toBe(200); // (150 + 250) / 2
    });

    it('should track multiple different queries (Requirement 24.7)', () => {
      metricsService.recordQueryExecution({
        query_id: 'my_appointments',
        execution_time_ms: 150,
      });

      metricsService.recordQueryExecution({
        query_id: 'medicines_info',
        execution_time_ms: 300,
      });

      metricsService.recordQueryExecution({
        query_id: 'my_appointments',
        execution_time_ms: 250,
      });

      const metrics = metricsService.getCurrentMetrics();

      expect(metrics.query_execution_stats).toHaveLength(2);

      const appointmentsStats = metrics.query_execution_stats.find(
        q => q.query_id === 'my_appointments'
      );
      expect(appointmentsStats.execution_count).toBe(2);
      expect(appointmentsStats.average_execution_time).toBe(200);

      const medicinesStats = metrics.query_execution_stats.find(
        q => q.query_id === 'medicines_info'
      );
      expect(medicinesStats.execution_count).toBe(1);
      expect(medicinesStats.average_execution_time).toBe(300);
    });
  });

  describe('getCurrentMetrics', () => {
    it('should return all metrics in correct format (Requirement 24.5)', () => {
      metricsService.recordRequest({
        response_time_ms: 1500,
        is_error: false,
        is_rate_limited: false,
        user_id: 123,
      });

      metricsService.recordGeminiApiUsage({
        is_rate_limit_error: false,
      });

      metricsService.recordQueryExecution({
        query_id: 'my_appointments',
        execution_time_ms: 150,
      });

      const metrics = metricsService.getCurrentMetrics();

      expect(metrics).toMatchObject({
        total_requests: 1,
        average_response_time: 1500,
        error_rate: 0,
        rate_limit_hits: 0,
        active_users: 1,
        gemini_api_usage: {
          requests_sent: 1,
          rate_limit_errors: 0,
        },
        query_execution_stats: expect.arrayContaining([
          expect.objectContaining({
            query_id: 'my_appointments',
            execution_count: 1,
            average_execution_time: 150,
          }),
        ]),
        uptime_ms: expect.any(Number),
      });
    });

    it('should handle zero requests gracefully', () => {
      const metrics = metricsService.getCurrentMetrics();

      expect(metrics.total_requests).toBe(0);
      expect(metrics.average_response_time).toBe(0);
      expect(metrics.error_rate).toBe(0);
      expect(metrics.active_users).toBe(0);
    });
  });

  describe('resetMetrics', () => {
    it('should reset all metrics to initial state', () => {
      // Record some metrics
      metricsService.recordRequest({
        response_time_ms: 1500,
        is_error: false,
        is_rate_limited: false,
        user_id: 123,
      });

      metricsService.recordGeminiApiUsage({
        is_rate_limit_error: false,
      });

      metricsService.recordQueryExecution({
        query_id: 'my_appointments',
        execution_time_ms: 150,
      });

      // Reset
      metricsService.resetMetrics();

      // Verify all metrics are reset
      const metrics = metricsService.getCurrentMetrics();

      expect(metrics.total_requests).toBe(0);
      expect(metrics.average_response_time).toBe(0);
      expect(metrics.error_rate).toBe(0);
      expect(metrics.rate_limit_hits).toBe(0);
      expect(metrics.active_users).toBe(0);
      expect(metrics.gemini_api_usage.requests_sent).toBe(0);
      expect(metrics.gemini_api_usage.rate_limit_errors).toBe(0);
      expect(metrics.query_execution_stats).toHaveLength(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing user_id in recordRequest', () => {
      metricsService.recordRequest({
        response_time_ms: 1500,
        is_error: false,
        is_rate_limited: false,
        // user_id is missing
      });

      const metrics = metricsService.getCurrentMetrics();

      expect(metrics.total_requests).toBe(1);
      expect(metrics.active_users).toBe(0); // No user ID, so no active user
    });

    it('should handle zero response time', () => {
      metricsService.recordRequest({
        response_time_ms: 0,
        is_error: false,
        is_rate_limited: false,
        user_id: 123,
      });

      const metrics = metricsService.getCurrentMetrics();

      expect(metrics.average_response_time).toBe(0);
    });

    it('should handle very large response times', () => {
      metricsService.recordRequest({
        response_time_ms: 999999,
        is_error: false,
        is_rate_limited: false,
        user_id: 123,
      });

      const metrics = metricsService.getCurrentMetrics();

      expect(metrics.average_response_time).toBe(999999);
    });
  });
});
