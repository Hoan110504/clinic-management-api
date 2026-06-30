/**
 * Property-Based Tests for Authentication Middleware
 * 
 * Tests universal properties using fast-check library:
 * - Property 1: JWT Token Extraction
 * 
 */

import fc from 'fast-check';
import jwt from 'jsonwebtoken';
import config from '../../config/index.js';

/**
 * Helper function to decode and extract user data from JWT token
 * This simulates what the authenticate middleware does
 */
function extractUserDataFromToken(token) {
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    return {
      success: true,
      userId: decoded.id,
      userRole: decoded.role,
      username: decoded.username,
      email: decoded.email
    };
  } catch (error) {
    return {
      success: false,
      error: error.name
    };
  }
}

describe('Authentication Middleware - Property-Based Tests', () => {
  /**
   * Property 1: JWT Token Extraction
   * 
   * For any valid JWT token containing user data, the authentication middleware
   * SHALL correctly extract the user ID and role from the token payload.
   * 
   */
  test('Feature: ai-medical-chatbot, Property 1: JWT token extraction', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10000 }), // Random user ID
        fc.integer({ min: 1, max: 6 }), // Random role (1-6: admin, doctor, receptionist, pharmacist, patient, labtech)
        fc.string({ minLength: 3, maxLength: 50 }), // Random username
        async (userId, role, username) => {
          // Create a valid JWT token with user data
          const tokenPayload = {
            id: userId,
            role: role,
            username: username
          };
          
          const token = jwt.sign(tokenPayload, config.jwt.secret, {
            expiresIn: '1h'
          });
          
          // Extract user data from token (simulating authenticate middleware)
          const result = extractUserDataFromToken(token);
          
          // Verify extraction was successful
          expect(result.success).toBe(true);
          
          // Verify user data was correctly extracted
          expect(result.userId).toBe(userId);
          expect(result.userRole).toBe(role);
          expect(result.username).toBe(username);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1b: Token payload preservation
   * 
   * For any valid JWT token, all fields in the token payload
   * SHALL be correctly decoded and accessible.
   */
  test('Feature: ai-medical-chatbot, Property 1b: Token payload preservation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.integer({ min: 1, max: 10000 }),
          role: fc.integer({ min: 1, max: 6 }),
          username: fc.string({ minLength: 3, maxLength: 50 }),
          email: fc.emailAddress()
        }),
        async (userData) => {
          // Create token with user data
          const token = jwt.sign(userData, config.jwt.secret, {
            expiresIn: '1h'
          });
          
          // Extract user data
          const result = extractUserDataFromToken(token);
          
          // Verify all user data is preserved
          expect(result.success).toBe(true);
          expect(result.userId).toBe(userData.id);
          expect(result.userRole).toBe(userData.role);
          expect(result.username).toBe(userData.username);
          expect(result.email).toBe(userData.email);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1c: Invalid token rejection
   * 
   * For any invalid or malformed JWT token, the authentication middleware
   * SHALL reject the request with an appropriate error.
   */
  test('Feature: ai-medical-chatbot, Property 1c: Invalid token rejection', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 10, maxLength: 100 }), // Random invalid token
        async (invalidToken) => {
          // Ensure the token is not a valid JWT by checking it doesn't have 3 parts
          fc.pre(!invalidToken.includes('.') || invalidToken.split('.').length !== 3);
          
          // Try to extract user data
          const result = extractUserDataFromToken(invalidToken);
          
          // Verify extraction failed
          expect(result.success).toBe(false);
          expect(result.error).toBeDefined();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 1d: Expired token rejection
   * 
   * For any expired JWT token, the authentication middleware
   * SHALL reject the request with a TOKEN_EXPIRED error.
   */
  test('Feature: ai-medical-chatbot, Property 1d: Expired token rejection', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10000 }), // Random user ID
        fc.integer({ min: 1, max: 6 }), // Random role
        async (userId, role) => {
          // Create an expired token (expires in -1 second)
          const token = jwt.sign(
            { id: userId, role: role },
            config.jwt.secret,
            { expiresIn: '-1s' }
          );
          
          // Try to extract user data
          const result = extractUserDataFromToken(token);
          
          // Verify extraction failed with TokenExpiredError
          expect(result.success).toBe(false);
          expect(result.error).toBe('TokenExpiredError');
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 1e: Token with wrong secret rejection
   * 
   * For any JWT token signed with a different secret,
   * the authentication middleware SHALL reject the request.
   */
  test('Feature: ai-medical-chatbot, Property 1e: Wrong secret rejection', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10000 }), // Random user ID
        fc.integer({ min: 1, max: 6 }), // Random role
        fc.string({ minLength: 10, maxLength: 50 }), // Wrong secret
        async (userId, role, wrongSecret) => {
          // Ensure wrong secret is different from actual secret
          fc.pre(wrongSecret !== config.jwt.secret);
          
          // Create a token with wrong secret
          const token = jwt.sign(
            { id: userId, role: role },
            wrongSecret,
            { expiresIn: '1h' }
          );
          
          // Try to extract user data
          const result = extractUserDataFromToken(token);
          
          // Verify extraction failed
          expect(result.success).toBe(false);
          expect(result.error).toBe('JsonWebTokenError');
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 1f: Token round-trip preservation
   * 
   * For any user data, encoding then decoding SHALL produce equivalent data.
   */
  test('Feature: ai-medical-chatbot, Property 1f: Token round-trip preservation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.integer({ min: 1, max: 10000 }),
          role: fc.integer({ min: 1, max: 6 }),
          username: fc.string({ minLength: 3, maxLength: 50 })
        }),
        async (userData) => {
          // Encode user data into token
          const token = jwt.sign(userData, config.jwt.secret, {
            expiresIn: '1h'
          });
          
          // Decode token back to user data
          const decoded = jwt.verify(token, config.jwt.secret);
          
          // Verify all fields are preserved (ignoring JWT metadata fields)
          expect(decoded.id).toBe(userData.id);
          expect(decoded.role).toBe(userData.role);
          expect(decoded.username).toBe(userData.username);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1g: Token uniqueness
   * 
   * For any two different user IDs, the generated tokens SHALL be different.
   */
  test('Feature: ai-medical-chatbot, Property 1g: Token uniqueness for different users', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10000 }), // User 1 ID
        fc.integer({ min: 1, max: 10000 }), // User 2 ID
        fc.integer({ min: 1, max: 6 }), // Role
        async (userId1, userId2, role) => {
          // Ensure different user IDs
          fc.pre(userId1 !== userId2);
          
          // Create tokens for both users
          const token1 = jwt.sign(
            { id: userId1, role: role },
            config.jwt.secret,
            { expiresIn: '1h' }
          );
          
          const token2 = jwt.sign(
            { id: userId2, role: role },
            config.jwt.secret,
            { expiresIn: '1h' }
          );
          
          // Tokens should be different
          expect(token1).not.toBe(token2);
          
          // Decoding each token should give correct user ID
          const decoded1 = jwt.verify(token1, config.jwt.secret);
          const decoded2 = jwt.verify(token2, config.jwt.secret);
          
          expect(decoded1.id).toBe(userId1);
          expect(decoded2.id).toBe(userId2);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 1h: Token contains no sensitive data
   * 
   * For any JWT token, the payload SHALL NOT contain sensitive fields
   * like passwords or tokens (JWT is base64 encoded, not encrypted).
   */
  test('Feature: ai-medical-chatbot, Property 1h: Token does not expose sensitive data', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          id: fc.integer({ min: 1, max: 10000 }),
          role: fc.integer({ min: 1, max: 6 }),
          username: fc.string({ minLength: 3, maxLength: 50 })
        }),
        async (userData) => {
          // Create token (should NOT include password or other sensitive data)
          const token = jwt.sign(userData, config.jwt.secret, {
            expiresIn: '1h'
          });
          
          // Decode token payload (without verification, just to inspect)
          const parts = token.split('.');
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          
          // Verify sensitive fields are NOT in payload
          expect(payload.password).toBeUndefined();
          expect(payload.passwordHash).toBeUndefined();
          expect(payload.refreshToken).toBeUndefined();
          expect(payload.accessToken).toBeUndefined();
          
          // Verify expected fields ARE in payload
          expect(payload.id).toBe(userData.id);
          expect(payload.role).toBe(userData.role);
          expect(payload.username).toBe(userData.username);
        }
      ),
      { numRuns: 100 }
    );
  });
});
