/**
 * Property-Based Tests for Query Result Parser
 * 
 * Tests universal properties of the query result parser and serializer using fast-check.
 * Validates Requirements 21.1-21.9 for parser and serializer functionality.
 */

import fc from 'fast-check';
import { 
  parseQueryResult, 
  serializeQueryResult, 
  parseAndSerialize,
  serializeMultipleResults,
  formatForAI
} from '../queryResultParser.js';

/**
 * Custom arbitrary for generating plain objects that simulate query results
 */
const queryResultArbitrary = fc.record({
  id: fc.integer({ min: 1, max: 10000 }),
  name: fc.string({ minLength: 1, maxLength: 50 }),
  createdAt: fc.date(),
  updatedAt: fc.date(),
  value: fc.oneof(
    fc.integer(),
    fc.string(),
    fc.boolean(),
    fc.constant(null)
  ),
  nested: fc.option(
    fc.record({
      id: fc.integer({ min: 1, max: 1000 }),
      description: fc.string({ minLength: 0, maxLength: 100 })
    }),
    { nil: null }
  )
});

/**
 * Mock Sequelize instance for testing
 */
class MockSequelizeInstance {
  constructor(data) {
    this._data = data;
  }
  
  toJSON() {
    return this._data;
  }
}

describe('Query Result Parser - Property-Based Tests', () => {
  
  /**
   * Property 14: Parser Round-Trip Preservation
   * 
   * For any valid query result object, parsing then serializing then parsing
   * SHALL produce an equivalent object (round-trip identity property).
   * 
   * Validates: Requirements 21.8
   */
  test('Feature: ai-medical-chatbot, Property 14: Parser round-trip preservation', async () => {
    await fc.assert(
      fc.asyncProperty(
        queryResultArbitrary,
        async (originalData) => {
          // Step 1: Parse the original data
          const parsed1 = parseQueryResult(originalData);
          
          // Step 2: Serialize it
          const serialized = serializeQueryResult(parsed1, 'test_query', 100);
          
          // Step 3: Parse the serialized data
          const parsed2 = parseQueryResult(serialized.data);
          
          // Verify round-trip preservation
          expect(parsed2).toEqual(parsed1);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property 14b: Array Round-Trip Preservation
   * 
   * For any array of query results, parsing then serializing then parsing
   * SHALL produce an equivalent array.
   */
  test('Feature: ai-medical-chatbot, Property 14b: Array round-trip preservation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(queryResultArbitrary, { minLength: 0, maxLength: 20 }),
        async (originalArray) => {
          // Step 1: Parse the original array
          const parsed1 = parseQueryResult(originalArray);
          
          // Step 2: Serialize it
          const serialized = serializeQueryResult(parsed1, 'test_query', 100);
          
          // Step 3: Parse the serialized data
          const parsed2 = parseQueryResult(serialized.data);
          
          // Verify round-trip preservation
          expect(parsed2).toEqual(parsed1);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property: Date Conversion to ISO 8601
   * 
   * For any query result containing Date objects, the parser SHALL convert
   * all Date objects to ISO 8601 strings.
   * 
   * Validates: Requirements 21.3
   */
  test('Feature: ai-medical-chatbot, Property: Date conversion to ISO 8601', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.date(),
        fc.string({ minLength: 1, maxLength: 50 }),
        async (dateValue, name) => {
          const data = {
            id: 123,
            name,
            createdAt: dateValue
          };
          
          const parsed = parseQueryResult(data);
          
          // Verify Date is converted to ISO string
          expect(typeof parsed.createdAt).toBe('string');
          expect(parsed.createdAt).toBe(dateValue.toISOString());
          
          // Verify other fields are preserved
          expect(parsed.id).toBe(123);
          expect(parsed.name).toBe(name);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property: Null and Undefined Handling
   * 
   * For any query result containing null or undefined values, the parser
   * SHALL handle them gracefully (convert undefined to null).
   * 
   * Validates: Requirements 21.4
   */
  test('Feature: ai-medical-chatbot, Property: Null and undefined handling', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 50 }),
        async (name) => {
          const data = {
            id: 123,
            name,
            nullValue: null,
            undefinedValue: undefined
          };
          
          const parsed = parseQueryResult(data);
          
          // Verify null is preserved
          expect(parsed.nullValue).toBeNull();
          
          // Verify undefined is converted to null
          expect(parsed.undefinedValue).toBeNull();
          
          // Verify other fields are preserved
          expect(parsed.id).toBe(123);
          expect(parsed.name).toBe(name);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property: Empty Array Handling
   * 
   * For any empty query result array, the parser SHALL return an empty array,
   * not null or undefined.
   * 
   * Validates: Requirements 21.9
   */
  test('Feature: ai-medical-chatbot, Property: Empty array handling', async () => {
    const emptyArray = [];
    const parsed = parseQueryResult(emptyArray);
    
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(0);
    expect(parsed).toEqual([]);
  });
  
  /**
   * Property: Serializer Metadata Inclusion
   * 
   * For any parsed query result, the serializer SHALL include metadata:
   * query_id, row_count, execution_time_ms, timestamp.
   * 
   * Validates: Requirements 21.5, 21.6
   */
  test('Feature: ai-medical-chatbot, Property: Serializer metadata inclusion', async () => {
    await fc.assert(
      fc.asyncProperty(
        queryResultArbitrary,
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer({ min: 0, max: 10000 }),
        async (data, queryId, executionTime) => {
          const parsed = parseQueryResult(data);
          const serialized = serializeQueryResult(parsed, queryId, executionTime);
          
          // Verify all required metadata fields are present
          expect(serialized).toHaveProperty('query_id');
          expect(serialized).toHaveProperty('row_count');
          expect(serialized).toHaveProperty('execution_time_ms');
          expect(serialized).toHaveProperty('data');
          expect(serialized).toHaveProperty('timestamp');
          
          // Verify metadata values
          expect(serialized.query_id).toBe(queryId);
          expect(serialized.execution_time_ms).toBe(executionTime);
          expect(serialized.row_count).toBe(1); // Single object
          expect(typeof serialized.timestamp).toBe('string');
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property: Row Count Accuracy
   * 
   * For any query result, the serializer SHALL accurately count the number of rows:
   * - 0 for null/undefined
   * - array.length for arrays
   * - 1 for single objects
   */
  test('Feature: ai-medical-chatbot, Property: Row count accuracy', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(queryResultArbitrary, { minLength: 0, maxLength: 50 }),
        async (dataArray) => {
          const parsed = parseQueryResult(dataArray);
          const serialized = serializeQueryResult(parsed, 'test_query', 100);
          
          // Verify row count matches array length
          expect(serialized.row_count).toBe(dataArray.length);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property: Nested Association Handling
   * 
   * For any query result with nested associations, the parser SHALL
   * recursively parse all nested objects.
   * 
   * Validates: Requirements 21.2
   */
  test('Feature: ai-medical-chatbot, Property: Nested association handling', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.integer({ min: 1, max: 10000 }),
          name: fc.string({ minLength: 1, maxLength: 50 }),
          patient: fc.record({
            id: fc.integer({ min: 1, max: 10000 }),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            createdAt: fc.date()
          }),
          doctor: fc.record({
            id: fc.integer({ min: 1, max: 10000 }),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            specialty: fc.string({ minLength: 1, maxLength: 30 })
          })
        }),
        async (appointmentData) => {
          const parsed = parseQueryResult(appointmentData);
          
          // Verify top-level fields
          expect(parsed.id).toBe(appointmentData.id);
          expect(parsed.name).toBe(appointmentData.name);
          
          // Verify nested patient association
          expect(parsed.patient).toBeDefined();
          expect(parsed.patient.id).toBe(appointmentData.patient.id);
          expect(parsed.patient.name).toBe(appointmentData.patient.name);
          
          // Date should be converted to string or null (for invalid dates)
          const createdAtType = typeof parsed.patient.createdAt;
          expect(['string', 'object']).toContain(createdAtType);
          if (createdAtType === 'object') {
            expect(parsed.patient.createdAt).toBeNull();
          }
          
          // Verify nested doctor association
          expect(parsed.doctor).toBeDefined();
          expect(parsed.doctor.id).toBe(appointmentData.doctor.id);
          expect(parsed.doctor.name).toBe(appointmentData.doctor.name);
          expect(parsed.doctor.specialty).toBe(appointmentData.doctor.specialty);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property: Sequelize Instance Parsing
   * 
   * For any Sequelize model instance, the parser SHALL convert it to a plain
   * JavaScript object using toJSON().
   * 
   * Validates: Requirements 21.1
   */
  test('Feature: ai-medical-chatbot, Property: Sequelize instance parsing', async () => {
    await fc.assert(
      fc.asyncProperty(
        queryResultArbitrary,
        async (data) => {
          // Create a mock Sequelize instance
          const instance = new MockSequelizeInstance(data);
          
          const parsed = parseQueryResult(instance);
          
          // Verify it's converted to plain object
          expect(parsed).not.toBeInstanceOf(MockSequelizeInstance);
          expect(typeof parsed).toBe('object');
          
          // Verify data is preserved
          expect(parsed.id).toBe(data.id);
          expect(parsed.name).toBe(data.name);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property: Multiple Results Serialization
   * 
   * For any array of query results with different query IDs, the serializer
   * SHALL serialize each result with its corresponding metadata.
   */
  test('Feature: ai-medical-chatbot, Property: Multiple results serialization', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            queryResult: queryResultArbitrary,
            queryId: fc.string({ minLength: 1, maxLength: 30 }),
            executionTimeMs: fc.integer({ min: 0, max: 5000 })
          }),
          { minLength: 1, maxLength: 10 }
        ),
        async (resultsArray) => {
          const serialized = serializeMultipleResults(resultsArray);
          
          // Verify array length matches
          expect(serialized.length).toBe(resultsArray.length);
          
          // Verify each result has correct metadata
          serialized.forEach((result, index) => {
            expect(result.query_id).toBe(resultsArray[index].queryId);
            expect(result.execution_time_ms).toBe(resultsArray[index].executionTimeMs);
            expect(result).toHaveProperty('row_count');
            expect(result).toHaveProperty('data');
            expect(result).toHaveProperty('timestamp');
          });
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property: AI Formatting Non-Empty
   * 
   * For any non-empty array of serialized results, the formatForAI function
   * SHALL return a non-empty string containing query information.
   */
  test('Feature: ai-medical-chatbot, Property: AI formatting non-empty', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            queryResult: queryResultArbitrary,
            queryId: fc.string({ minLength: 1, maxLength: 30 }),
            executionTimeMs: fc.integer({ min: 0, max: 5000 })
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (resultsArray) => {
          const serialized = serializeMultipleResults(resultsArray);
          const formatted = formatForAI(serialized);
          
          // Verify formatted string is non-empty
          expect(typeof formatted).toBe('string');
          expect(formatted.length).toBeGreaterThan(0);
          
          // Verify it contains query IDs
          resultsArray.forEach(result => {
            expect(formatted).toContain(result.queryId);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property: Null Input Handling
   * 
   * For null or undefined input, the parser SHALL return null gracefully
   * without throwing errors.
   */
  test('Feature: ai-medical-chatbot, Property: Null input handling', async () => {
    const nullResult = parseQueryResult(null);
    const undefinedResult = parseQueryResult(undefined);
    
    expect(nullResult).toBeNull();
    expect(undefinedResult).toBeNull();
  });
  
  /**
   * Property: Parse and Serialize Combined
   * 
   * For any query result, the parseAndSerialize function SHALL produce
   * the same result as calling parse then serialize separately.
   */
  test('Feature: ai-medical-chatbot, Property: Parse and serialize combined', async () => {
    await fc.assert(
      fc.asyncProperty(
        queryResultArbitrary,
        fc.string({ minLength: 1, maxLength: 30 }),
        fc.integer({ min: 0, max: 5000 }),
        async (data, queryId, executionTime) => {
          // Method 1: Combined
          const combined = parseAndSerialize(data, queryId, executionTime);
          
          // Method 2: Separate
          const parsed = parseQueryResult(data);
          const serialized = serializeQueryResult(parsed, queryId, executionTime);
          
          // Verify they produce equivalent results (excluding timestamp)
          expect(combined.query_id).toBe(serialized.query_id);
          expect(combined.row_count).toBe(serialized.row_count);
          expect(combined.execution_time_ms).toBe(serialized.execution_time_ms);
          expect(combined.data).toEqual(serialized.data);
        }
      ),
      { numRuns: 100 }
    );
  });
  
});
