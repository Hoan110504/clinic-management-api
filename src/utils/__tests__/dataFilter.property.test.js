/**
 * Property-Based Tests for Data Filter
 * 
 * Tests universal properties of the data filtering utility using fast-check.
 * Validates Requirements 18.1-18.8 for sensitive data filtering and truncation.
 */

import fc from 'fast-check';
import { filterSensitiveData, truncateData, filterAndTruncateResults } from '../dataFilter.js';

describe('Data Filter - Property-Based Tests', () => {
  
  /**
   * Property 12: Sensitive Data Filtering
   * 
   * For any query result containing sensitive fields (passwords, JWT tokens, SSNs, credit cards),
   * the data filter SHALL strip those fields before sending data to the AI.
   * 
   * Validates: Requirements 18.1, 18.2, 18.3, 18.4, 18.5
   */
  test('Feature: ai-medical-chatbot, Property 12: Sensitive data filtering', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate objects with sensitive fields
        fc.record({
          id: fc.integer({ min: 1, max: 10000 }),
          username: fc.string({ minLength: 3, maxLength: 20 }),
          email: fc.emailAddress(),
          // Sensitive fields that should be stripped
          password: fc.string({ minLength: 8, maxLength: 50 }),
          password_hash: fc.string({ minLength: 32, maxLength: 128 }),
          jwt: fc.string({ minLength: 50, maxLength: 200 }),
          token: fc.string({ minLength: 32, maxLength: 128 }),
          accessToken: fc.string({ minLength: 32, maxLength: 128 }),
          refresh_token: fc.string({ minLength: 32, maxLength: 128 }),
          ssn: fc.string({ minLength: 9, maxLength: 11 }),
          creditCard: fc.string({ minLength: 13, maxLength: 19 }),
          credit_card: fc.string({ minLength: 13, maxLength: 19 }),
          nationalId: fc.string({ minLength: 9, maxLength: 12 }),
          apiKey: fc.string({ minLength: 32, maxLength: 64 }),
          secret: fc.string({ minLength: 16, maxLength: 64 })
        }),
        async (userData) => {
          const filtered = filterSensitiveData(userData);
          
          // Verify all sensitive fields are stripped
          expect(filtered.password).toBeUndefined();
          expect(filtered.password_hash).toBeUndefined();
          expect(filtered.jwt).toBeUndefined();
          expect(filtered.token).toBeUndefined();
          expect(filtered.accessToken).toBeUndefined();
          expect(filtered.refresh_token).toBeUndefined();
          expect(filtered.ssn).toBeUndefined();
          expect(filtered.creditCard).toBeUndefined();
          expect(filtered.credit_card).toBeUndefined();
          expect(filtered.nationalId).toBeUndefined();
          expect(filtered.apiKey).toBeUndefined();
          expect(filtered.secret).toBeUndefined();
          
          // Verify non-sensitive fields are preserved
          expect(filtered.id).toBe(userData.id);
          expect(filtered.username).toBe(userData.username);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property 12b: Sensitive Data Filtering in Arrays
   * 
   * For any array of query results containing sensitive fields,
   * the data filter SHALL strip those fields from all array elements.
   */
  test('Feature: ai-medical-chatbot, Property 12b: Sensitive data filtering in arrays', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.integer({ min: 1, max: 10000 }),
            name: fc.string({ minLength: 3, maxLength: 50 }),
            password: fc.string({ minLength: 8, maxLength: 50 }),
            token: fc.string({ minLength: 32, maxLength: 128 }),
            ssn: fc.string({ minLength: 9, maxLength: 11 })
          }),
          { minLength: 1, maxLength: 20 }
        ),
        async (userArray) => {
          const filtered = filterSensitiveData(userArray);
          
          // Verify it's still an array
          expect(Array.isArray(filtered)).toBe(true);
          expect(filtered.length).toBe(userArray.length);
          
          // Verify all elements have sensitive fields stripped
          filtered.forEach((item, index) => {
            expect(item.password).toBeUndefined();
            expect(item.token).toBeUndefined();
            expect(item.ssn).toBeUndefined();
            expect(item.id).toBe(userArray[index].id);
            expect(item.name).toBe(userArray[index].name);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property 12c: PII Redaction for Non-Owners
   * 
   * For any query result containing PII fields (phone, email) where the current user
   * is not the owner, the data filter SHALL redact those fields.
   * 
   * Validates: Requirements 18.6
   */
  test('Feature: ai-medical-chatbot, Property 12c: PII redaction for non-owners', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10000 }), // owner user ID
        fc.integer({ min: 1, max: 10000 }), // current user ID
        fc.record({
          user_id: fc.constant(null), // Will be set to owner ID
          name: fc.string({ minLength: 3, maxLength: 50 }),
          phone: fc.string({ minLength: 10, maxLength: 15 }),
          email: fc.emailAddress()
        }),
        async (ownerId, currentUserId, userData) => {
          // Ensure different users for non-owner test
          fc.pre(ownerId !== currentUserId);
          
          userData.user_id = ownerId;
          
          const filtered = filterSensitiveData(userData, currentUserId);
          
          // Verify PII is redacted for non-owner
          expect(filtered.phone).not.toBe(userData.phone);
          expect(filtered.email).not.toBe(userData.email);
          expect(filtered.phone).toContain('***');
          expect(filtered.email).toContain('***');
          
          // Verify non-PII fields are preserved
          expect(filtered.name).toBe(userData.name);
          expect(filtered.user_id).toBe(ownerId);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property 12d: PII Preservation for Owners
   * 
   * For any query result containing PII fields where the current user IS the owner,
   * the data filter SHALL preserve those fields without redaction.
   */
  test('Feature: ai-medical-chatbot, Property 12d: PII preservation for owners', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10000 }), // user ID (same for owner and current)
        fc.record({
          user_id: fc.constant(null), // Will be set to user ID
          name: fc.string({ minLength: 3, maxLength: 50 }),
          phone: fc.string({ minLength: 10, maxLength: 15 }),
          email: fc.emailAddress()
        }),
        async (userId, userData) => {
          userData.user_id = userId;
          
          const filtered = filterSensitiveData(userData, userId);
          
          // Verify PII is NOT redacted for owner
          expect(filtered.phone).toBe(userData.phone);
          expect(filtered.email).toBe(userData.email);
          expect(filtered.name).toBe(userData.name);
          expect(filtered.user_id).toBe(userId);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property 12e: Nested Object Filtering
   * 
   * For any query result with nested objects containing sensitive fields,
   * the data filter SHALL recursively strip sensitive fields from all levels.
   */
  test('Feature: ai-medical-chatbot, Property 12e: Nested object filtering', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.integer({ min: 1, max: 10000 }),
          name: fc.string({ minLength: 3, maxLength: 50 }),
          password: fc.string({ minLength: 8, maxLength: 50 }),
          profile: fc.record({
            bio: fc.string({ minLength: 10, maxLength: 100 }),
            token: fc.string({ minLength: 32, maxLength: 128 }),
            settings: fc.record({
              theme: fc.constantFrom('light', 'dark'),
              apiKey: fc.string({ minLength: 32, maxLength: 64 })
            })
          })
        }),
        async (userData) => {
          const filtered = filterSensitiveData(userData);
          
          // Verify top-level sensitive field is stripped
          expect(filtered.password).toBeUndefined();
          
          // Verify nested sensitive fields are stripped
          expect(filtered.profile.token).toBeUndefined();
          expect(filtered.profile.settings.apiKey).toBeUndefined();
          
          // Verify non-sensitive nested fields are preserved
          expect(filtered.id).toBe(userData.id);
          expect(filtered.name).toBe(userData.name);
          expect(filtered.profile.bio).toBe(userData.profile.bio);
          expect(filtered.profile.settings.theme).toBe(userData.profile.settings.theme);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property 13: Data Truncation
   * 
   * For any query result exceeding 10,000 characters, the system SHALL truncate
   * the result to 10,000 characters and inform the AI that data was truncated.
   * 
   * Validates: Requirements 18.7, 18.8
   */
  test('Feature: ai-medical-chatbot, Property 13: Data truncation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 10001, max: 50000 }), // Length exceeding limit
        async (targetLength) => {
          // Generate a string that exceeds the limit
          const longString = 'a'.repeat(targetLength);
          
          const result = truncateData(longString);
          
          // Verify truncation occurred
          expect(result.truncated).toBe(true);
          expect(result.data.length).toBeLessThanOrEqual(10100); // 10000 + truncation notice
          expect(result.data).toContain('[DATA TRUNCATED');
          
          // Verify the truncation notice is present
          expect(result.data).toMatch(/\[DATA TRUNCATED.*10,000 character limit\]/);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property 13b: No Truncation for Short Data
   * 
   * For any query result under 10,000 characters, the system SHALL NOT truncate
   * the result and SHALL set the truncated flag to false.
   */
  test('Feature: ai-medical-chatbot, Property 13b: No truncation for short data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10000 }), // Length within limit
        async (targetLength) => {
          const shortString = 'a'.repeat(targetLength);
          
          const result = truncateData(shortString);
          
          // Verify no truncation occurred
          expect(result.truncated).toBe(false);
          expect(result.data).toBe(shortString);
          expect(result.data.length).toBe(targetLength);
          expect(result.data).not.toContain('[DATA TRUNCATED');
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property 13c: Truncation Preserves Data Prefix
   * 
   * For any query result exceeding 10,000 characters, the truncated result
   * SHALL preserve the first 10,000 characters of the original data.
   */
  test('Feature: ai-medical-chatbot, Property 13c: Truncation preserves data prefix', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10001, maxLength: 20000 }),
        async (longString) => {
          const result = truncateData(longString);
          
          // Verify the first 10,000 characters are preserved
          const expectedPrefix = longString.substring(0, 10000);
          expect(result.data.startsWith(expectedPrefix)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property 13d: Combined Filter and Truncate
   * 
   * For any query result, the filterAndTruncateResults function SHALL
   * first filter sensitive data, then truncate if needed, and return metadata.
   */
  test('Feature: ai-medical-chatbot, Property 13d: Combined filter and truncate', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            id: fc.integer({ min: 1, max: 10000 }),
            name: fc.string({ minLength: 3, maxLength: 50 }),
            password: fc.string({ minLength: 8, maxLength: 50 }),
            description: fc.string({ minLength: 100, maxLength: 500 })
          }),
          { minLength: 1, maxLength: 100 }
        ),
        async (dataArray) => {
          const result = filterAndTruncateResults(dataArray);
          
          // Verify result has required metadata
          expect(result).toHaveProperty('data');
          expect(result).toHaveProperty('truncated');
          expect(result).toHaveProperty('originalLength');
          expect(result).toHaveProperty('filteredLength');
          
          // Verify data is a string
          expect(typeof result.data).toBe('string');
          
          // Verify sensitive fields are not in the result
          expect(result.data).not.toContain('"password"');
          
          // Verify truncation flag is boolean
          expect(typeof result.truncated).toBe('boolean');
          
          // Verify lengths are numbers
          expect(typeof result.originalLength).toBe('number');
          expect(typeof result.filteredLength).toBe('number');
        }
      ),
      { numRuns: 100 }
    );
  });
  
  /**
   * Property: Case-Insensitive Field Matching
   * 
   * For any sensitive field name with different casing (PASSWORD, Password, password),
   * the data filter SHALL strip the field regardless of case.
   */
  test('Feature: ai-medical-chatbot, Property: Case-insensitive field matching', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 8, maxLength: 50 }),
        fc.constantFrom('password', 'PASSWORD', 'Password', 'PaSsWoRd'),
        async (passwordValue, fieldName) => {
          const userData = {
            id: 123,
            username: 'testuser',
            [fieldName]: passwordValue
          };
          
          const filtered = filterSensitiveData(userData);
          
          // Verify the password field is stripped regardless of case
          expect(filtered[fieldName]).toBeUndefined();
          expect(filtered.id).toBe(123);
          expect(filtered.username).toBe('testuser');
        }
      ),
      { numRuns: 100 }
    );
  });
  
});
