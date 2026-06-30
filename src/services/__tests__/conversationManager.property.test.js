/**
 * Property-Based Tests for Conversation Manager
 * 
 * Tests universal properties using fast-check for randomized input generation.
 * Each property test runs 100+ iterations to verify correctness across diverse inputs.
 */

import fc from 'fast-check';
import conversationManager from '../conversationManager.js';

describe('Conversation Manager - Property-Based Tests', () => {
  
  // Clean up before each test
  beforeEach(() => {
    conversationManager.clearAllSessions();
  });

  // Clean up after all tests
  afterAll(() => {
    conversationManager.stopCleanupInterval();
  });

  /**
   * Property 10: Conversation History Bounded Queue
   * 
   * For any user session, after adding N messages where N > 10,
   * the conversation history SHALL contain exactly the 10 most recent messages,
   * with the oldest messages automatically removed.
   */
  test('Feature: ai-medical-chatbot, Property 10: Conversation history bounded queue', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10000 }), // Random user ID
        fc.integer({ min: 11, max: 100 }), // Number of messages (> 10)
        fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 11, maxLength: 100 }), // Message contents
        async (userId, numMessages, messageContents) => {
          // Ensure we have enough messages
          const messages = messageContents.slice(0, numMessages);
          
          // Add messages alternating between user and model
          for (let i = 0; i < messages.length; i++) {
            const role = i % 2 === 0 ? 'user' : 'model';
            conversationManager.appendMessage(userId, role, messages[i]);
          }

          // Get history
          const history = conversationManager.getHistory(userId);

          // Property 1: History never exceeds 10 messages
          expect(history.length).toBeLessThanOrEqual(10);
          expect(history.length).toBe(10); // Should be exactly 10 since we added > 10

          // Property 2: History contains the LAST 10 messages
          const expectedMessages = messages.slice(-10);
          for (let i = 0; i < 10; i++) {
            expect(history[i].content).toBe(expectedMessages[i]);
          }

          // Property 3: Oldest messages are removed (if messages are unique)
          // Only check if first message is unique
          const firstMessage = messages[0];
          const lastTenMessages = messages.slice(-10);
          if (!lastTenMessages.includes(firstMessage)) {
            const historyContents = history.map(m => m.content);
            expect(historyContents).not.toContain(firstMessage);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10b: History maintains order
   * 
   * For any sequence of messages added to a session,
   * the conversation history SHALL maintain chronological order
   * (oldest to newest within the 10-message window).
   */
  test('Feature: ai-medical-chatbot, Property 10b: History maintains chronological order', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10000 }), // Random user ID
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 5, maxLength: 20 }), // Messages
        async (userId, messages) => {
          // Ensure we have a fresh session for this test
          conversationManager.deleteSession(userId);
          
          // Add all messages
          for (let i = 0; i < messages.length; i++) {
            const role = i % 2 === 0 ? 'user' : 'model';
            conversationManager.appendMessage(userId, role, messages[i]);
          }

          // Get history
          const history = conversationManager.getHistory(userId);

          // Verify chronological order by checking timestamps
          for (let i = 1; i < history.length; i++) {
            expect(history[i].timestamp.getTime()).toBeGreaterThanOrEqual(
              history[i - 1].timestamp.getTime()
            );
          }

          // Verify content order matches the last N messages
          const expectedCount = Math.min(messages.length, 10);
          const expectedMessages = messages.slice(-expectedCount);
          
          for (let i = 0; i < expectedCount; i++) {
            expect(history[i].content).toBe(expectedMessages[i]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10c: Exactly 10 messages after exceeding limit
   * 
   * For any user session, after adding exactly 11 messages,
   * the history SHALL contain exactly 10 messages (the last 10).
   */
  test('Feature: ai-medical-chatbot, Property 10c: Exactly 10 messages after exceeding limit', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10000 }), // Random user ID
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 11, maxLength: 11 }), // Exactly 11 messages
        async (userId, messages) => {
          // Add all 11 messages
          for (let i = 0; i < messages.length; i++) {
            const role = i % 2 === 0 ? 'user' : 'model';
            conversationManager.appendMessage(userId, role, messages[i]);
          }

          // Get history
          const history = conversationManager.getHistory(userId);

          // Should have exactly 10 messages
          expect(history.length).toBe(10);

          // Should contain messages 1-10 (0-indexed), not message 0
          expect(history[0].content).toBe(messages[1]);
          expect(history[9].content).toBe(messages[10]);

          // Should NOT contain the first message (if it's unique in the last 10)
          const firstMessage = messages[0];
          const lastTenMessages = messages.slice(1, 11);
          if (!lastTenMessages.includes(firstMessage)) {
            const historyContents = history.map(m => m.content);
            expect(historyContents).not.toContain(firstMessage);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10d: History never exceeds 10 for any number of additions
   * 
   * For any user session and any number of message additions,
   * the history SHALL never exceed 10 messages.
   */
  test('Feature: ai-medical-chatbot, Property 10d: History never exceeds 10 messages', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10000 }), // Random user ID
        fc.integer({ min: 1, max: 200 }), // Number of messages to add
        async (userId, numMessages) => {
          // Ensure we have a fresh session for this test
          conversationManager.deleteSession(userId);
          
          // Add N messages
          for (let i = 0; i < numMessages; i++) {
            const role = i % 2 === 0 ? 'user' : 'model';
            conversationManager.appendMessage(userId, role, `Message ${i}`);
          }

          // Get history
          const history = conversationManager.getHistory(userId);

          // History should never exceed 10
          expect(history.length).toBeLessThanOrEqual(10);

          // History should be exactly min(numMessages, 10)
          const expectedLength = Math.min(numMessages, 10);
          expect(history.length).toBe(expectedLength);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10e: Session isolation
   * 
   * For any two different user IDs, messages added to one user's session
   * SHALL NOT appear in the other user's session.
   */
  test('Feature: ai-medical-chatbot, Property 10e: Session isolation between users', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10000 }), // User 1 ID
        fc.integer({ min: 1, max: 10000 }), // User 2 ID
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 20 }), // User 1 messages
        fc.array(fc.string({ minLength: 1, maxLength: 50 }), { minLength: 1, maxLength: 20 }), // User 2 messages
        async (userId1, userId2, messages1, messages2) => {
          // Ensure different users
          fc.pre(userId1 !== userId2);
          
          // Ensure messages are unique to avoid false positives
          const allMessages = [...messages1, ...messages2];
          const uniqueMessages = new Set(allMessages);
          fc.pre(uniqueMessages.size === allMessages.length);

          // Ensure we have fresh sessions for this test
          conversationManager.deleteSession(userId1);
          conversationManager.deleteSession(userId2);

          // Add messages for user 1
          for (let i = 0; i < messages1.length; i++) {
            conversationManager.appendMessage(userId1, 'user', messages1[i]);
          }

          // Add messages for user 2
          for (let i = 0; i < messages2.length; i++) {
            conversationManager.appendMessage(userId2, 'model', messages2[i]);
          }

          // Get histories
          const history1 = conversationManager.getHistory(userId1);
          const history2 = conversationManager.getHistory(userId2);

          // Verify user 1's history only contains their messages
          const contents1 = history1.map(m => m.content);
          for (const msg of messages2) {
            expect(contents1).not.toContain(msg);
          }

          // Verify user 2's history only contains their messages
          const contents2 = history2.map(m => m.content);
          for (const msg of messages1) {
            expect(contents2).not.toContain(msg);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10f: Role preservation
   * 
   * For any message added with a specific role,
   * the message SHALL retain that role in the history.
   */
  test('Feature: ai-medical-chatbot, Property 10f: Role preservation in history', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10000 }), // Random user ID
        fc.array(
          fc.record({
            role: fc.constantFrom('user', 'model'),
            content: fc.string({ minLength: 1, maxLength: 100 })
          }),
          { minLength: 1, maxLength: 15 }
        ),
        async (userId, messages) => {
          // Ensure we have a fresh session for this test
          conversationManager.deleteSession(userId);
          
          // Add all messages
          for (const msg of messages) {
            conversationManager.appendMessage(userId, msg.role, msg.content);
          }

          // Get history
          const history = conversationManager.getHistory(userId);

          // Verify roles are preserved
          const expectedMessages = messages.slice(-Math.min(messages.length, 10));
          
          for (let i = 0; i < history.length; i++) {
            expect(history[i].role).toBe(expectedMessages[i].role);
            expect(history[i].content).toBe(expectedMessages[i].content);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10g: Message count accuracy
   * 
   * For any user session, the getMessageCount method SHALL return
   * the exact number of messages in the history (max 10).
   */
  test('Feature: ai-medical-chatbot, Property 10g: Message count accuracy', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10000 }), // Random user ID
        fc.integer({ min: 0, max: 50 }), // Number of messages
        async (userId, numMessages) => {
          // Ensure we have a fresh session for this test
          conversationManager.deleteSession(userId);
          
          // Add messages
          for (let i = 0; i < numMessages; i++) {
            conversationManager.appendMessage(userId, 'user', `Message ${i}`);
          }

          // Get count
          const count = conversationManager.getMessageCount(userId);
          const history = conversationManager.getHistory(userId);

          // Count should match history length
          expect(count).toBe(history.length);

          // Count should be min(numMessages, 10)
          const expectedCount = Math.min(numMessages, 10);
          expect(count).toBe(expectedCount);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10h: Clear history resets to empty
   * 
   * For any user session with messages, after clearing history,
   * the history SHALL be empty (length 0).
   */
  test('Feature: ai-medical-chatbot, Property 10h: Clear history resets to empty', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10000 }), // Random user ID
        fc.integer({ min: 1, max: 50 }), // Number of messages
        async (userId, numMessages) => {
          // Add messages
          for (let i = 0; i < numMessages; i++) {
            conversationManager.appendMessage(userId, 'user', `Message ${i}`);
          }

          // Verify messages exist
          const historyBefore = conversationManager.getHistory(userId);
          expect(historyBefore.length).toBeGreaterThan(0);

          // Clear history
          const cleared = conversationManager.clearHistory(userId);
          expect(cleared).toBe(true);

          // Verify history is empty
          const historyAfter = conversationManager.getHistory(userId);
          expect(historyAfter.length).toBe(0);

          // Message count should be 0
          const count = conversationManager.getMessageCount(userId);
          expect(count).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
