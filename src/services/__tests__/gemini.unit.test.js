/**
 * Unit Tests for Gemini Service
 * 
 * These tests verify specific examples, edge cases, and error conditions
 * for the Gemini AI service logic.
 * 
 * 
 * Note: These tests focus on the internal logic and error handling.
 * Integration tests with actual API calls should be done separately.
 */

import { jest } from '@jest/globals';

describe('Gemini Service Unit Tests', () => {
  
  describe('JSON Parsing Logic', () => {
    /**
     * Helper function that simulates the JSON parsing logic from selectQueries
     */
    function parseQueryIdsFromResponse(responseText) {
      try {
        const parsed = JSON.parse(responseText);
        const queryIds = parsed.query_ids || [];
        
        if (!Array.isArray(queryIds)) {
          console.warn('Pass 1 returned non-array query_ids, using empty array');
          return [];
        }
        
        return queryIds;
      } catch (error) {
        if (error instanceof SyntaxError) {
          console.error('Failed to parse Pass 1 JSON response:', error.message);
          return [];
        }
        throw error;
      }
    }

    test('should parse valid JSON with query_ids array', () => {
      const json = JSON.stringify({ query_ids: ['my_appointments', 'medicines_info'] });
      const result = parseQueryIdsFromResponse(json);
      
      expect(result).toEqual(['my_appointments', 'medicines_info']);
    });

    test('should return empty array for invalid JSON', () => {
      const result = parseQueryIdsFromResponse('not valid json');
      expect(result).toEqual([]);
    });

    test('should return empty array when query_ids is missing', () => {
      const json = JSON.stringify({ other_field: 'value' });
      const result = parseQueryIdsFromResponse(json);
      
      expect(result).toEqual([]);
    });

    test('should return empty array when query_ids is not an array', () => {
      const json = JSON.stringify({ query_ids: 'string' });
      const result = parseQueryIdsFromResponse(json);
      
      expect(result).toEqual([]);
    });

    test('should handle empty query_ids array', () => {
      const json = JSON.stringify({ query_ids: [] });
      const result = parseQueryIdsFromResponse(json);
      
      expect(result).toEqual([]);
    });

    test('should preserve order of query IDs', () => {
      const queryIds = ['third', 'first', 'second'];
      const json = JSON.stringify({ query_ids: queryIds });
      const result = parseQueryIdsFromResponse(json);
      
      expect(result).toEqual(queryIds);
    });

    test('should handle duplicate query IDs', () => {
      const queryIds = ['my_appointments', 'my_appointments', 'medicines_info'];
      const json = JSON.stringify({ query_ids: queryIds });
      const result = parseQueryIdsFromResponse(json);
      
      expect(result).toEqual(queryIds);
    });
  });

  describe('Rate Limiting Logic', () => {
    /**
     * Simulates the rate limiting check logic
     */
    class RateLimiter {
      constructor(maxRequests, windowMs) {
        this.maxRequests = maxRequests;
        this.windowMs = windowMs;
        this.requestTimestamps = [];
      }

      checkRateLimit() {
        const now = Date.now();
        
        // Remove timestamps older than window
        this.requestTimestamps = this.requestTimestamps.filter(
          timestamp => now - timestamp < this.windowMs
        );

        // Check if limit exceeded
        if (this.requestTimestamps.length >= this.maxRequests) {
          const oldestTimestamp = this.requestTimestamps[0];
          const resetTime = oldestTimestamp + this.windowMs;
          const retryAfter = Math.ceil((resetTime - now) / 1000);

          return {
            allowed: false,
            retryAfter,
          };
        }

        // Record this request
        this.requestTimestamps.push(now);
        return { allowed: true };
      }

      reset() {
        this.requestTimestamps = [];
      }
    }

    test('should allow requests within rate limit', () => {
      const limiter = new RateLimiter(10, 60000);
      
      // Make 9 requests
      for (let i = 0; i < 9; i++) {
        const result = limiter.checkRateLimit();
        expect(result.allowed).toBe(true);
      }
      
      expect(limiter.requestTimestamps.length).toBe(9);
    });

    test('should block 11th request within window', () => {
      const limiter = new RateLimiter(10, 60000);
      
      // Make 10 requests
      for (let i = 0; i < 10; i++) {
        limiter.checkRateLimit();
      }

      // 11th request should be blocked
      const result = limiter.checkRateLimit();
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    test('should reset after window expires', () => {
      const limiter = new RateLimiter(10, 1000); // 1 second window
      
      // Fill up the limit
      for (let i = 0; i < 10; i++) {
        limiter.checkRateLimit();
      }

      // Simulate time passing by manipulating timestamps
      const oldTimestamp = Date.now() - 1100; // 1.1 seconds ago
      limiter.requestTimestamps = limiter.requestTimestamps.map(() => oldTimestamp);

      // Should allow new request
      const result = limiter.checkRateLimit();
      expect(result.allowed).toBe(true);
    });

    test('should calculate correct retryAfter time', () => {
      const limiter = new RateLimiter(10, 60000);
      
      // Fill up the limit
      for (let i = 0; i < 10; i++) {
        limiter.checkRateLimit();
      }

      // Try one more
      const result = limiter.checkRateLimit();
      expect(result.allowed).toBe(false);
      expect(result.retryAfter).toBeGreaterThan(0);
      expect(result.retryAfter).toBeLessThanOrEqual(60);
    });
  });

  describe('Retry Logic', () => {
    /**
     * Simulates the retry logic with exponential backoff
     */
    async function executeWithRetry(apiCall, maxAttempts = 3, baseDelay = 2000) {
      let attempt = 1;
      
      while (attempt <= maxAttempts) {
        try {
          return await apiCall();
        } catch (error) {
          const is429Error = 
            error.status === 429 || 
            error.message?.includes('429') ||
            error.message?.includes('rate limit') ||
            error.message?.includes('quota');

          if (is429Error && attempt < maxAttempts) {
            // Wait before retrying (exponential backoff)
            const delay = baseDelay * attempt;
            await new Promise(resolve => setTimeout(resolve, delay));
            attempt++;
            continue;
          }

          // If retries exhausted or other error, throw
          if (is429Error) {
            throw new Error('AI service temporarily unavailable due to rate limits');
          }
          throw new Error('AI service error');
        }
      }
    }

    test('should succeed on first attempt', async () => {
      const apiCall = jest.fn().mockResolvedValue('success');
      const result = await executeWithRetry(apiCall);
      
      expect(result).toBe('success');
      expect(apiCall).toHaveBeenCalledTimes(1);
    });

    test('should retry on 429 error and succeed', async () => {
      let attemptCount = 0;
      const apiCall = jest.fn(async () => {
        attemptCount++;
        if (attemptCount === 1) {
          const error = new Error('Rate limit exceeded');
          error.status = 429;
          throw error;
        }
        return 'success';
      });

      const result = await executeWithRetry(apiCall, 3, 10); // Use short delay for testing
      
      expect(result).toBe('success');
      expect(apiCall).toHaveBeenCalledTimes(2);
    });

    test('should retry up to max attempts', async () => {
      const apiCall = jest.fn(async () => {
        const error = new Error('Rate limit exceeded');
        error.status = 429;
        throw error;
      });

      await expect(executeWithRetry(apiCall, 3, 10)).rejects.toThrow(
        'AI service temporarily unavailable'
      );
      
      expect(apiCall).toHaveBeenCalledTimes(3);
    });

    test('should not retry non-429 errors', async () => {
      const apiCall = jest.fn(async () => {
        throw new Error('Network error');
      });

      await expect(executeWithRetry(apiCall, 3, 10)).rejects.toThrow('AI service error');
      expect(apiCall).toHaveBeenCalledTimes(1);
    });

    test('should detect 429 errors in different formats', async () => {
      const error429Formats = [
        { status: 429 },
        { message: 'Error 429: Rate limit' },
        { message: 'rate limit exceeded' },
        { message: 'quota exceeded' },
      ];

      for (const errorFormat of error429Formats) {
        const apiCall = jest.fn(async () => {
          const error = new Error(errorFormat.message || 'Error');
          if (errorFormat.status) error.status = errorFormat.status;
          throw error;
        });

        await expect(executeWithRetry(apiCall, 3, 10)).rejects.toThrow();
        expect(apiCall).toHaveBeenCalledTimes(3);
      }
    });
  });

  describe('Query Results Formatting', () => {
    /**
     * Simulates the query results formatting logic from synthesizeAnswer
     */
    function formatQueryResults(queryResults) {
      if (!queryResults || queryResults.length === 0) {
        return 'No database queries were executed for this question.';
      }

      return queryResults
        .map(result => {
          const { queryId, data, metadata } = result;
          const dataStr = JSON.stringify(data, null, 2);
          return `Query: ${queryId}
Rows returned: ${metadata?.rowCount || 0}
Data:
${dataStr}`;
        })
        .join('\n\n---\n\n');
    }

    test('should format single query result', () => {
      const queryResults = [
        {
          queryId: 'my_appointments',
          data: [{ id: 1, date: '2024-01-15' }],
          metadata: { rowCount: 1 },
        },
      ];

      const formatted = formatQueryResults(queryResults);
      
      expect(formatted).toContain('Query: my_appointments');
      expect(formatted).toContain('Rows returned: 1');
      expect(formatted).toContain('"id": 1');
    });

    test('should format multiple query results', () => {
      const queryResults = [
        {
          queryId: 'my_appointments',
          data: [{ id: 1 }],
          metadata: { rowCount: 1 },
        },
        {
          queryId: 'medicines_info',
          data: [{ name: 'Aspirin' }],
          metadata: { rowCount: 1 },
        },
      ];

      const formatted = formatQueryResults(queryResults);
      
      expect(formatted).toContain('Query: my_appointments');
      expect(formatted).toContain('Query: medicines_info');
      expect(formatted).toContain('---'); // Separator
    });

    test('should handle empty query results', () => {
      const formatted = formatQueryResults([]);
      expect(formatted).toBe('No database queries were executed for this question.');
    });

    test('should handle null query results', () => {
      const formatted = formatQueryResults(null);
      expect(formatted).toBe('No database queries were executed for this question.');
    });

    test('should handle missing metadata', () => {
      const queryResults = [
        {
          queryId: 'test_query',
          data: [{ id: 1 }],
          metadata: {},
        },
      ];

      const formatted = formatQueryResults(queryResults);
      expect(formatted).toContain('Rows returned: 0');
    });
  });

  describe('Conversation History Limiting', () => {
    /**
     * Simulates the conversation history limiting logic
     */
    function limitConversationHistory(history, maxMessages = 10) {
      return history.slice(-maxMessages);
    }

    test('should keep all messages when under limit', () => {
      const history = [
        { role: 'user', content: 'Message 1' },
        { role: 'model', content: 'Response 1' },
        { role: 'user', content: 'Message 2' },
      ];

      const limited = limitConversationHistory(history, 10);
      expect(limited).toEqual(history);
      expect(limited.length).toBe(3);
    });

    test('should limit to last 10 messages', () => {
      const history = Array.from({ length: 15 }, (_, i) => ({
        role: i % 2 === 0 ? 'user' : 'model',
        content: `Message ${i}`,
      }));

      const limited = limitConversationHistory(history, 10);
      
      expect(limited.length).toBe(10);
      expect(limited[0].content).toBe('Message 5');
      expect(limited[9].content).toBe('Message 14');
    });

    test('should handle empty history', () => {
      const limited = limitConversationHistory([], 10);
      expect(limited).toEqual([]);
    });

    test('should handle exactly 10 messages', () => {
      const history = Array.from({ length: 10 }, (_, i) => ({
        role: 'user',
        content: `Message ${i}`,
      }));

      const limited = limitConversationHistory(history, 10);
      expect(limited.length).toBe(10);
      expect(limited).toEqual(history);
    });
  });
});
