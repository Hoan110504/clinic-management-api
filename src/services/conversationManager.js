/**
 * Conversation Manager Service
 * 
 * Manages in-memory conversation history for AI chatbot sessions.
 * Maintains the last 10 messages per user session with automatic cleanup.
 * 
 */

/**
 * @typedef {Object} Message
 * @property {'user' | 'model'} role - The role of the message sender
 * @property {string} content - The message content
 * @property {Date} timestamp - When the message was created
 */

/**
 * @typedef {Object} Session
 * @property {number} userId - The user ID associated with this session
 * @property {Message[]} messages - Array of messages (max 10)
 * @property {Date} lastActivity - Last time this session was accessed
 */

class ConversationManager {
  constructor() {
    /**
     * In-memory storage for conversation sessions
     * Key: sessionId (string)
     * Value: Session object
     * @type {Map<string, Session>}
     */
    this.sessions = new Map();

    /**
     * Maximum number of messages to store per session
     * Requirement 9.1: Maintain last 10 messages
     */
    this.MAX_MESSAGES = 10;

    /**
     * Session timeout in milliseconds (30 minutes)
     * After this time of inactivity, sessions are eligible for cleanup
     */
    this.SESSION_TIMEOUT = 30 * 60 * 1000;

    // Start periodic cleanup of expired sessions
    this.startCleanupInterval();
  }

  /**
   * Generate a session ID for a user
   * @param {number} userId - The user ID
   * @returns {string} Session ID
   */
  generateSessionId(userId) {
    return `session_${userId}`;
  }

  /**
   * Initialize a new session for a user
   * Requirement 9.5: Initialize empty history for new sessions
   * 
   * @param {number} userId - The user ID
   * @returns {Session} The newly created session
   */
  initializeSession(userId) {
    const sessionId = this.generateSessionId(userId);
    const session = {
      userId,
      messages: [],
      lastActivity: new Date()
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  /**
   * Get or create a session for a user
   * @param {number} userId - The user ID
   * @returns {Session} The user's session
   */
  getSession(userId) {
    const sessionId = this.generateSessionId(userId);
    let session = this.sessions.get(sessionId);

    if (!session) {
      session = this.initializeSession(userId);
    } else {
      // Update last activity
      session.lastActivity = new Date();
    }

    return session;
  }

  /**
   * Append a message to the conversation history
   * 
   * @param {number} userId - The user ID
   * @param {'user' | 'model'} role - The message role
   * @param {string} content - The message content
   * @returns {Message} The appended message
   */
  appendMessage(userId, role, content) {
    const session = this.getSession(userId);

    const message = {
      role,
      content,
      timestamp: new Date()
    };

    // Add message to history
    session.messages.push(message);

    // Requirement 9.2: Remove oldest message if exceeding 10
    if (session.messages.length > this.MAX_MESSAGES) {
      session.messages.shift(); // Remove first (oldest) message
    }

    return message;
  }

  /**
   * Get conversation history for a user
   * Requirement 9.3: Store messages with role and content
   * Requirement 9.4: Include history in Pass 2 for context
   * 
   * @param {number} userId - The user ID
   * @returns {Message[]} Array of messages (max 10)
   */
  getHistory(userId) {
    const session = this.getSession(userId);
    // Return a copy to prevent external modifications
    return [...session.messages];
  }

  /**
   * Clear conversation history for a user
   * Requirement 9.7: Clear history when session expires
   * 
   * @param {number} userId - The user ID
   * @returns {boolean} True if history was cleared
   */
  clearHistory(userId) {
    const sessionId = this.generateSessionId(userId);
    const session = this.sessions.get(sessionId);

    if (session) {
      session.messages = [];
      return true;
    }

    return false;
  }

  /**
   * Delete a session completely
   * @param {number} userId - The user ID
   * @returns {boolean} True if session was deleted
   */
  deleteSession(userId) {
    const sessionId = this.generateSessionId(userId);
    return this.sessions.delete(sessionId);
  }

  /**
   * Get the number of messages in a user's history
   * @param {number} userId - The user ID
   * @returns {number} Number of messages
   */
  getMessageCount(userId) {
    const session = this.getSession(userId);
    return session.messages.length;
  }

  /**
   * Check if a session exists for a user
   * @param {number} userId - The user ID
   * @returns {boolean} True if session exists
   */
  hasSession(userId) {
    const sessionId = this.generateSessionId(userId);
    return this.sessions.has(sessionId);
  }

  /**
   * Get all active session IDs (for monitoring/debugging)
   * @returns {string[]} Array of session IDs
   */
  getActiveSessions() {
    return Array.from(this.sessions.keys());
  }

  /**
   * Get total number of active sessions
   * @returns {number} Number of active sessions
   */
  getSessionCount() {
    return this.sessions.size;
  }

  /**
   * Clean up expired sessions
   * Requirement 9.7: Clear history when session expires
   * 
   * @returns {number} Number of sessions cleaned up
   */
  cleanupExpiredSessions() {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      const timeSinceLastActivity = now - session.lastActivity;

      if (timeSinceLastActivity > this.SESSION_TIMEOUT) {
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * Start periodic cleanup of expired sessions
   * Runs every 5 minutes
   */
  startCleanupInterval() {
    // Run cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => {
      const cleaned = this.cleanupExpiredSessions();
      if (cleaned > 0) {
        console.log(`[ConversationManager] Cleaned up ${cleaned} expired sessions`);
      }
    }, 5 * 60 * 1000);

    // Prevent the interval from keeping the process alive
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Stop the cleanup interval (for testing or shutdown)
   */
  stopCleanupInterval() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clear all sessions (for testing)
   */
  clearAllSessions() {
    this.sessions.clear();
  }
}

// Export singleton instance
// Requirement 9.6: Store history in memory per session (not persisted)
const conversationManager = new ConversationManager();

export default conversationManager;
