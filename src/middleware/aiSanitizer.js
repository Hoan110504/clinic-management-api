/**
 * AI Input Sanitizer Middleware
 * 
 * Validates and sanitizes user input for AI chatbot endpoints:
 * - Trims whitespace
 * - Enforces 500 character limit
 * - Strips HTML tags and script injection patterns
 * - Detects prompt injection patterns
 * 
 */

import { AppError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { logSecurityEvent } from '../utils/aiLogger.js';

// Maximum message length
const MAX_MESSAGE_LENGTH = 500;

// HTML and script injection patterns to strip
const HTML_TAG_PATTERN = /<[^>]*>/g;
const SCRIPT_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /onerror\s*=/gi,
  /onclick\s*=/gi,
  /onload\s*=/gi,
  /onmouseover\s*=/gi,
  /onfocus\s*=/gi,
  /onblur\s*=/gi
];

// Prompt injection patterns (case-insensitive)
const PROMPT_INJECTION_PATTERNS = [
  'ignore previous',
  'ignore all previous',
  'disregard',
  'forget instructions',
  'forget all instructions',
  'forget previous',
  'you are now',
  'act as',
  'jailbreak',
  'dan mode',
  'dan',
  'system prompt',
  'reveal',
  'reveal your',
  'bypass',
  'override',
  'admin mode',
  'developer mode',
  'god mode',
  'sudo mode',
  'root access',
  'ignore your instructions',
  'new instructions',
  'system:',
  'assistant:',
  'user:',
  'prompt:',
  'instruction:',
  'roleplay',
  'pretend you are',
  'simulate',
  'hypothetically'
];

/**
 * Strip HTML tags from a string
 * @param {string} text - The text to sanitize
 * @returns {string} Text with HTML tags removed
 */
function stripHtmlTags(text) {
  if (!text) return text;
  return text.replace(HTML_TAG_PATTERN, '');
}

/**
 * Strip script injection patterns from a string
 * @param {string} text - The text to sanitize
 * @returns {string} Text with script patterns removed
 */
function stripScriptPatterns(text) {
  if (!text) return text;
  
  let sanitized = text;
  for (const pattern of SCRIPT_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }
  
  return sanitized;
}

/**
 * Detect prompt injection patterns in a string
 * @param {string} text - The text to check
 * @returns {{ detected: boolean, pattern: string|null }} Detection result
 */
function detectPromptInjection(text) {
  if (!text) return { detected: false, pattern: null };
  
  const lowerText = text.toLowerCase();
  
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (lowerText.includes(pattern.toLowerCase())) {
      return { detected: true, pattern };
    }
  }
  
  return { detected: false, pattern: null };
}

/**
 * AI Input Sanitizer Middleware
 * 
 * Validates and sanitizes user input for AI chatbot:
 * 1. Validates message field is present and is a string
 * 2. Trims whitespace
 * 3. Enforces 500 character limit
 * 4. Strips HTML tags
 * 5. Strips script injection patterns
 * 6. Detects prompt injection patterns
 * 
 * Returns 400 Bad Request for invalid input with security logging
 */
export const aiSanitizer = (req, res, next) => {
  try {
    // Validate message field exists
    if (!req.body || typeof req.body.message === 'undefined') {
      return next(
        new AppError(
          'Message field is required',
          400,
          'INVALID_INPUT'
        )
      );
    }
    
    // Validate message is a string
    if (typeof req.body.message !== 'string') {
      return next(
        new AppError(
          'Message must be a string',
          400,
          'INVALID_INPUT'
        )
      );
    }
    
    // Enforce maximum length BEFORE trimming (Requirement 5.2)
    if (req.body.message.length > MAX_MESSAGE_LENGTH) {
      return next(
        new AppError(
          `Message too long. Please keep it under ${MAX_MESSAGE_LENGTH} characters.`,
          400,
          'MESSAGE_TOO_LONG'
        )
      );
    }
    
    // Trim whitespace
    let message = req.body.message.trim();
    
    // Validate message is not empty after trimming
    if (message.length === 0) {
      return next(
        new AppError(
          'Message cannot be empty',
          400,
          'INVALID_INPUT'
        )
      );
    }
    
    // Strip HTML tags
    message = stripHtmlTags(message);
    
    // Strip script injection patterns
    message = stripScriptPatterns(message);
    
    // Detect prompt injection
    const injectionResult = detectPromptInjection(message);
    if (injectionResult.detected) {
      // Log security warning (Requirement 24.3)
      logger.warn('Prompt injection attempt detected', {
        userId: req.user?.id,
        username: req.user?.username,
        ipAddress: req.ip || req.connection?.remoteAddress,
        detectedPattern: injectionResult.pattern,
        message: message.substring(0, 100), // Log first 100 chars only
        timestamp: new Date().toISOString()
      });
      
      // Structured security logging 
      logSecurityEvent({
        event_type: 'prompt_injection_attempt',
        user_id: req.user?.id,
        user_role: req.user?.role,
        ip_address: req.ip || req.connection?.remoteAddress || 'unknown',
        user_message: message.substring(0, 100),
        detected_pattern: injectionResult.pattern,
      });
      
      return next(
        new AppError(
          'Invalid input detected. Please rephrase your question.',
          400,
          'INVALID_INPUT',
          { reason: 'prompt_injection_detected' }
        )
      );
    }
    
    // Update request body with sanitized message
    req.body.message = message;
    
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Export utility functions for testing
 */
export const sanitizerUtils = {
  stripHtmlTags,
  stripScriptPatterns,
  detectPromptInjection,
  MAX_MESSAGE_LENGTH,
  PROMPT_INJECTION_PATTERNS
};
