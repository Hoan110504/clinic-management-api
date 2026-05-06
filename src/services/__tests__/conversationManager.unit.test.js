/**
 * Unit Tests for Conversation Manager
 * 
 * Tests specific examples, edge cases, and error conditions.
 * Validates: Requirements 22.8
 */

import conversationManager from '../conversationManager.js';

describe('Conversation Manager - Unit Tests', () => {
  
  // Clean up before each test
  beforeEach(() => {
    conversationManager.clearAllSessions();
  });

  // Clean up after all tests
  afterAll(() => {
    conversationManager.stopCleanupInterval();
  });

  describe('Session Initialization', () => {
    
    test('should initialize a new session for a user', () => {
      const userId = 1;
      const session = conversationManager.initializeSession(userId);

      expect(session).toBeDefined();
      expect(session.userId).toBe(userId);
      expect(session.messages).toEqual([]);
      expect(session.lastActivity).toBeInstanceOf(Date);
    });

    test('should generate consistent session IDs for the same user', () => {
      const userId = 42;
      const sessionId1 = conversationManager.generateSessionId(userId);
      const sessionId2 = conversationManager.generateSessionId(userId);

      expect(sessionId1).toBe(sessionId2);
      expect(sessionId1).toBe('session_42');
    });

    test('should create session on first getSession call', () => {
      const userId = 5;
      expect(conversationManager.hasSession(userId)).toBe(false);

      const session = conversationManager.getSession(userId);

      expect(session).toBeDefined();
      expect(conversationManager.hasSession(userId)).toBe(true);
    });
  });

  describe('Session Isolation Between Users', () => {
    
    test('should maintain separate histories for different users', () => {
      const user1 = 1;
      const user2 = 2;

      conversationManager.appendMessage(user1, 'user', 'User 1 message');
      conversationManager.appendMessage(user2, 'user', 'User 2 message');

      const history1 = conversationManager.getHistory(user1);
      const history2 = conversationManager.getHistory(user2);

      expect(history1.length).toBe(1);
      expect(history2.length).toBe(1);
      expect(history1[0].content).toBe('User 1 message');
      expect(history2[0].content).toBe('User 2 message');
    });

    test('should not leak messages between user sessions', () => {
      const user1 = 10;
      const user2 = 20;

      conversationManager.appendMessage(user1, 'user', 'Secret message for user 1');
      conversationManager.appendMessage(user2, 'model', 'Response for user 2');

      const history1 = conversationManager.getHistory(user1);
      const history2 = conversationManager.getHistory(user2);

      // User 1 should not see user 2's messages
      expect(history1.some(m => m.content === 'Response for user 2')).toBe(false);

      // User 2 should not see user 1's messages
      expect(history2.some(m => m.content === 'Secret message for user 1')).toBe(false);
    });

    test('should allow clearing one user session without affecting others', () => {
      const user1 = 1;
      const user2 = 2;

      conversationManager.appendMessage(user1, 'user', 'Message 1');
      conversationManager.appendMessage(user2, 'user', 'Message 2');

      conversationManager.clearHistory(user1);

      expect(conversationManager.getHistory(user1).length).toBe(0);
      expect(conversationManager.getHistory(user2).length).toBe(1);
    });
  });

  describe('Message Appending and Retrieval', () => {
    
    test('should append a user message to history', () => {
      const userId = 1;
      const message = conversationManager.appendMessage(userId, 'user', 'Hello AI');

      expect(message).toBeDefined();
      expect(message.role).toBe('user');
      expect(message.content).toBe('Hello AI');
      expect(message.timestamp).toBeInstanceOf(Date);

      const history = conversationManager.getHistory(userId);
      expect(history.length).toBe(1);
      expect(history[0]).toEqual(message);
    });

    test('should append a model message to history', () => {
      const userId = 1;
      const message = conversationManager.appendMessage(userId, 'model', 'Hello user');

      expect(message.role).toBe('model');
      expect(message.content).toBe('Hello user');

      const history = conversationManager.getHistory(userId);
      expect(history[0].role).toBe('model');
    });

    test('should append multiple messages in order', () => {
      const userId = 1;

      conversationManager.appendMessage(userId, 'user', 'First message');
      conversationManager.appendMessage(userId, 'model', 'Second message');
      conversationManager.appendMessage(userId, 'user', 'Third message');

      const history = conversationManager.getHistory(userId);

      expect(history.length).toBe(3);
      expect(history[0].content).toBe('First message');
      expect(history[1].content).toBe('Second message');
      expect(history[2].content).toBe('Third message');
    });

    test('should return a copy of history to prevent external modifications', () => {
      const userId = 1;
      conversationManager.appendMessage(userId, 'user', 'Original message');

      const history1 = conversationManager.getHistory(userId);
      history1.push({ role: 'user', content: 'Injected message', timestamp: new Date() });

      const history2 = conversationManager.getHistory(userId);

      // Original history should not be affected
      expect(history2.length).toBe(1);
      expect(history2[0].content).toBe('Original message');
    });
  });

  describe('History Clearing', () => {
    
    test('should clear history for a user with existing messages', () => {
      const userId = 1;

      conversationManager.appendMessage(userId, 'user', 'Message 1');
      conversationManager.appendMessage(userId, 'model', 'Message 2');

      expect(conversationManager.getHistory(userId).length).toBe(2);

      const cleared = conversationManager.clearHistory(userId);

      expect(cleared).toBe(true);
      expect(conversationManager.getHistory(userId).length).toBe(0);
    });

    test('should return false when clearing history for non-existent session', () => {
      const userId = 999;

      const cleared = conversationManager.clearHistory(userId);

      expect(cleared).toBe(false);
    });

    test('should allow adding messages after clearing history', () => {
      const userId = 1;

      conversationManager.appendMessage(userId, 'user', 'Message 1');
      conversationManager.clearHistory(userId);
      conversationManager.appendMessage(userId, 'user', 'Message 2');

      const history = conversationManager.getHistory(userId);

      expect(history.length).toBe(1);
      expect(history[0].content).toBe('Message 2');
    });
  });

  describe('Session Management', () => {
    
    test('should check if session exists', () => {
      const userId = 1;

      expect(conversationManager.hasSession(userId)).toBe(false);

      conversationManager.appendMessage(userId, 'user', 'Test');

      expect(conversationManager.hasSession(userId)).toBe(true);
    });

    test('should delete a session completely', () => {
      const userId = 1;

      conversationManager.appendMessage(userId, 'user', 'Test message');
      expect(conversationManager.hasSession(userId)).toBe(true);

      const deleted = conversationManager.deleteSession(userId);

      expect(deleted).toBe(true);
      expect(conversationManager.hasSession(userId)).toBe(false);
    });

    test('should return false when deleting non-existent session', () => {
      const userId = 999;

      const deleted = conversationManager.deleteSession(userId);

      expect(deleted).toBe(false);
    });

    test('should get message count for a session', () => {
      const userId = 1;

      expect(conversationManager.getMessageCount(userId)).toBe(0);

      conversationManager.appendMessage(userId, 'user', 'Message 1');
      expect(conversationManager.getMessageCount(userId)).toBe(1);

      conversationManager.appendMessage(userId, 'model', 'Message 2');
      expect(conversationManager.getMessageCount(userId)).toBe(2);
    });

    test('should track active sessions', () => {
      expect(conversationManager.getSessionCount()).toBe(0);

      conversationManager.appendMessage(1, 'user', 'Test 1');
      expect(conversationManager.getSessionCount()).toBe(1);

      conversationManager.appendMessage(2, 'user', 'Test 2');
      expect(conversationManager.getSessionCount()).toBe(2);

      conversationManager.deleteSession(1);
      expect(conversationManager.getSessionCount()).toBe(1);
    });

    test('should list active session IDs', () => {
      conversationManager.appendMessage(1, 'user', 'Test 1');
      conversationManager.appendMessage(2, 'user', 'Test 2');

      const sessions = conversationManager.getActiveSessions();

      expect(sessions).toContain('session_1');
      expect(sessions).toContain('session_2');
      expect(sessions.length).toBe(2);
    });
  });

  describe('10-Message Limit', () => {
    
    test('should maintain exactly 10 messages when adding 11th message', () => {
      const userId = 1;

      // Add 11 messages
      for (let i = 0; i < 11; i++) {
        conversationManager.appendMessage(userId, 'user', `Message ${i}`);
      }

      const history = conversationManager.getHistory(userId);

      expect(history.length).toBe(10);
      expect(history[0].content).toBe('Message 1'); // First message removed
      expect(history[9].content).toBe('Message 10');
    });

    test('should remove oldest message when exceeding 10', () => {
      const userId = 1;

      // Add 10 messages
      for (let i = 0; i < 10; i++) {
        conversationManager.appendMessage(userId, 'user', `Message ${i}`);
      }

      // Add 11th message
      conversationManager.appendMessage(userId, 'user', 'Message 10');

      const history = conversationManager.getHistory(userId);

      // Should not contain the first message
      expect(history.some(m => m.content === 'Message 0')).toBe(false);

      // Should contain messages 1-10
      expect(history[0].content).toBe('Message 1');
      expect(history[9].content).toBe('Message 10');
    });

    test('should handle adding many messages beyond the limit', () => {
      const userId = 1;

      // Add 50 messages
      for (let i = 0; i < 50; i++) {
        conversationManager.appendMessage(userId, 'user', `Message ${i}`);
      }

      const history = conversationManager.getHistory(userId);

      expect(history.length).toBe(10);
      expect(history[0].content).toBe('Message 40');
      expect(history[9].content).toBe('Message 49');
    });
  });

  describe('Session Lifecycle', () => {
    
    test('should update last activity when accessing session', () => {
      const userId = 1;

      conversationManager.appendMessage(userId, 'user', 'Message 1');
      const session1 = conversationManager.getSession(userId);
      const lastActivity1 = session1.lastActivity;

      // Wait a bit
      setTimeout(() => {
        conversationManager.getSession(userId);
        const session2 = conversationManager.getSession(userId);
        const lastActivity2 = session2.lastActivity;

        expect(lastActivity2.getTime()).toBeGreaterThanOrEqual(lastActivity1.getTime());
      }, 10);
    });

    test('should clean up expired sessions', () => {
      const userId = 1;

      // Create a session
      conversationManager.appendMessage(userId, 'user', 'Test message');
      expect(conversationManager.hasSession(userId)).toBe(true);

      // Manually set last activity to 31 minutes ago
      const session = conversationManager.getSession(userId);
      session.lastActivity = new Date(Date.now() - 31 * 60 * 1000);

      // Run cleanup
      const cleaned = conversationManager.cleanupExpiredSessions();

      expect(cleaned).toBe(1);
      expect(conversationManager.hasSession(userId)).toBe(false);
    });

    test('should not clean up active sessions', () => {
      const userId = 1;

      conversationManager.appendMessage(userId, 'user', 'Test message');

      const cleaned = conversationManager.cleanupExpiredSessions();

      expect(cleaned).toBe(0);
      expect(conversationManager.hasSession(userId)).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    
    test('should handle empty message content', () => {
      const userId = 1;

      conversationManager.appendMessage(userId, 'user', '');

      const history = conversationManager.getHistory(userId);

      expect(history.length).toBe(1);
      expect(history[0].content).toBe('');
    });

    test('should handle very long message content', () => {
      const userId = 1;
      const longMessage = 'a'.repeat(10000);

      conversationManager.appendMessage(userId, 'user', longMessage);

      const history = conversationManager.getHistory(userId);

      expect(history[0].content).toBe(longMessage);
      expect(history[0].content.length).toBe(10000);
    });

    test('should handle special characters in messages', () => {
      const userId = 1;
      const specialMessage = '<script>alert("XSS")</script> 你好 🎉';

      conversationManager.appendMessage(userId, 'user', specialMessage);

      const history = conversationManager.getHistory(userId);

      expect(history[0].content).toBe(specialMessage);
    });

    test('should handle rapid message additions', () => {
      const userId = 1;

      // Add 100 messages rapidly
      for (let i = 0; i < 100; i++) {
        conversationManager.appendMessage(userId, 'user', `Rapid message ${i}`);
      }

      const history = conversationManager.getHistory(userId);

      expect(history.length).toBe(10);
      expect(history[0].content).toBe('Rapid message 90');
      expect(history[9].content).toBe('Rapid message 99');
    });

    test('should handle concurrent sessions for many users', () => {
      const numUsers = 100;

      // Create sessions for 100 users
      for (let i = 1; i <= numUsers; i++) {
        conversationManager.appendMessage(i, 'user', `User ${i} message`);
      }

      expect(conversationManager.getSessionCount()).toBe(numUsers);

      // Verify each user has their own message
      for (let i = 1; i <= numUsers; i++) {
        const history = conversationManager.getHistory(i);
        expect(history.length).toBe(1);
        expect(history[0].content).toBe(`User ${i} message`);
      }
    });
  });

  describe('Cleanup Interval', () => {
    
    test('should start cleanup interval on initialization', () => {
      // The interval should be started in the constructor
      expect(conversationManager.cleanupInterval).toBeDefined();
    });

    test('should stop cleanup interval', () => {
      conversationManager.stopCleanupInterval();
      expect(conversationManager.cleanupInterval).toBeNull();

      // Restart for other tests
      conversationManager.startCleanupInterval();
    });
  });

  describe('Clear All Sessions', () => {
    
    test('should clear all sessions at once', () => {
      conversationManager.appendMessage(1, 'user', 'User 1');
      conversationManager.appendMessage(2, 'user', 'User 2');
      conversationManager.appendMessage(3, 'user', 'User 3');

      expect(conversationManager.getSessionCount()).toBe(3);

      conversationManager.clearAllSessions();

      expect(conversationManager.getSessionCount()).toBe(0);
    });
  });
});
