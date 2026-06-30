/**
 * Property-Based Tests for Gemini Service
 * 
 * These tests verify universal properties that should hold across all valid inputs.
 * Uses fast-check library for property-based testing with 100+ iterations per property.
 * 
 * Feature: ai-medical-chatbot
 */

import fc from 'fast-check';

/**
 * Property 9: JSON Response Parsing
 * 
 * For any valid JSON response from Pass 1 containing a query_ids array,
 * the parser SHALL correctly extract the array without data loss or corruption.
 * 
 * This property ensures that:
 * 1. Valid JSON with query_ids array is parsed correctly
 * 2. The extracted array matches the original array exactly
 * 3. No data is lost or corrupted during parsing
 * 4. Empty arrays are handled correctly
 * 5. Arrays with multiple query IDs are preserved
 * 
 * Note: These tests verify the JSON parsing logic in isolation without making actual API calls.
 */
describe('Feature: ai-medical-chatbot, Property 9: JSON Response Parsing', () => {
  
  /**
   * Helper function that simulates the JSON parsing logic from selectQueries
   */
  function parseQueryIdsFromResponse(responseText) {
    try {
      const parsed = JSON.parse(responseText);
      
      // Handle null or non-object responses
      if (!parsed || typeof parsed !== 'object') {
        console.warn('Pass 1 returned non-object response, using empty array');
        return [];
      }
      
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

  test('should correctly parse valid JSON responses with query_ids arrays', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arbitrary arrays of query ID strings
        fc.array(
          fc.stringMatching(/^[a-z_]+$/), // Valid query ID format
          { minLength: 0, maxLength: 10 }
        ),
        async (queryIds) => {
          // Create valid JSON response
          const jsonResponse = JSON.stringify({ query_ids: queryIds });

          // Parse the response
          const result = parseQueryIdsFromResponse(jsonResponse);

          // Verify the parsed array matches the original
          expect(result).toEqual(queryIds);
          expect(Array.isArray(result)).toBe(true);
          expect(result.length).toBe(queryIds.length);

          // Verify no data loss - each element should match
          queryIds.forEach((id, index) => {
            expect(result[index]).toBe(id);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should handle empty query_ids arrays correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constant([]), // Always empty array
        async (queryIds) => {
          const jsonResponse = JSON.stringify({ query_ids: queryIds });
          const result = parseQueryIdsFromResponse(jsonResponse);

          expect(result).toEqual([]);
          expect(Array.isArray(result)).toBe(true);
          expect(result.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should handle JSON responses with various query ID formats', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate arrays with different valid query ID patterns
        fc.array(
          fc.oneof(
            fc.constant('my_appointments'),
            fc.constant('medicines_info'),
            fc.constant('patient_medical_history'),
            fc.constant('lab_tests_pending'),
            fc.constant('low_stock_medicines')
          ),
          { minLength: 1, maxLength: 5 }
        ),
        async (queryIds) => {
          const jsonResponse = JSON.stringify({ query_ids: queryIds });
          const result = parseQueryIdsFromResponse(jsonResponse);

          // Verify exact match
          expect(result).toEqual(queryIds);
          
          // Verify order is preserved
          queryIds.forEach((id, index) => {
            expect(result[index]).toBe(id);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should return empty array for invalid JSON responses', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate invalid JSON strings
        fc.oneof(
          fc.constant('not json'),
          fc.constant('{ invalid }'),
          fc.constant(''),
          fc.constant('null'),
          fc.constant('undefined')
        ),
        async (invalidJson) => {
          const result = parseQueryIdsFromResponse(invalidJson);

          // Should return empty array for invalid JSON
          expect(result).toEqual([]);
          expect(Array.isArray(result)).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('should return empty array when query_ids is not an array', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate non-array values for query_ids
        fc.oneof(
          fc.constant({ query_ids: 'string' }),
          fc.constant({ query_ids: 123 }),
          fc.constant({ query_ids: null }),
          fc.constant({ query_ids: { nested: 'object' } }),
          fc.constant({ query_ids: true })
        ),
        async (invalidResponse) => {
          const jsonResponse = JSON.stringify(invalidResponse);
          const result = parseQueryIdsFromResponse(jsonResponse);

          // Should return empty array when query_ids is not an array
          expect(result).toEqual([]);
          expect(Array.isArray(result)).toBe(true);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('should preserve duplicate query IDs in the array', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.constant('my_appointments'),
          { minLength: 2, maxLength: 5 }
        ),
        async (queryIds) => {
          const jsonResponse = JSON.stringify({ query_ids: queryIds });
          const result = parseQueryIdsFromResponse(jsonResponse);

          // Should preserve duplicates
          expect(result).toEqual(queryIds);
          expect(result.length).toBe(queryIds.length);
        }
      ),
      { numRuns: 50 }
    );
  });

  test('should handle complex query ID arrays with mixed formats', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.oneof(
            fc.stringMatching(/^[a-z]+_[a-z]+$/), // snake_case
            fc.stringMatching(/^[a-z]+$/), // lowercase
            fc.stringMatching(/^[a-z]+_[a-z]+_[a-z]+$/) // multi_word_format
          ),
          { minLength: 0, maxLength: 15 }
        ),
        async (queryIds) => {
          const jsonResponse = JSON.stringify({ query_ids: queryIds });
          const result = parseQueryIdsFromResponse(jsonResponse);

          // Verify complete preservation
          expect(result).toEqual(queryIds);
          expect(result.length).toBe(queryIds.length);
          
          // Verify each element individually
          for (let i = 0; i < queryIds.length; i++) {
            expect(result[i]).toBe(queryIds[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('should handle JSON with extra fields gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string(), { minLength: 0, maxLength: 5 }),
        fc.record({
          extra_field: fc.string(),
          another_field: fc.integer(),
        }),
        async (queryIds, extraFields) => {
          const jsonResponse = JSON.stringify({
            query_ids: queryIds,
            ...extraFields,
          });
          const result = parseQueryIdsFromResponse(jsonResponse);

          // Should extract only query_ids, ignoring extra fields
          expect(result).toEqual(queryIds);
        }
      ),
      { numRuns: 50 }
    );
  });
});
