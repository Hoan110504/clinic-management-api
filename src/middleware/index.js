/**
 * Middleware Index
 * Central export for middleware
 */

module.exports = {
  auth: require('./auth'),
  errorHandler: require('./errorHandler'),
  validate: require('./validate'),
  rateLimiter: require('./rateLimiter'),
};
