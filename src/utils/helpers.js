/**
 * Utility Helpers
 * Common helper functions
 */
const config = require('../config');

/**
 * Parse pagination parameters with defaults
 * @param {Object} query - Request query object
 * @returns {Object} Pagination params
 */
const parsePagination = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || config.pagination.defaultPage);
  const limit = Math.min(
    Math.max(1, parseInt(query.limit, 10) || config.pagination.defaultLimit),
    config.pagination.maxLimit
  );
  const offset = (page - 1) * limit;

  return { page, limit, offset };
};

/**
 * Parse sort parameters
 * @param {string} sortParam - Sort string (e.g., "createdAt:desc,name:asc")
 * @param {Array} allowedFields - Allowed sort fields
 * @param {string} defaultSort - Default sort string
 * @returns {Array} Sequelize order array
 */
const parseSort = (sortParam, allowedFields = [], defaultSort = 'createdAt:desc') => {
  const sortString = sortParam || defaultSort;
  const order = [];

  sortString.split(',').forEach((part) => {
    const [field, direction] = part.split(':').map((s) => s.trim());
    if (field && (allowedFields.length === 0 || allowedFields.includes(field))) {
      order.push([field, direction?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC']);
    }
  });

  return order.length > 0 ? order : [['createdAt', 'DESC']];
};

/**
 * Build Sequelize where clause from filters
 * @param {Object} filters - Filter object
 * @param {Object} fieldMap - Map of query params to model fields
 * @returns {Object} Sequelize where clause
 */
const buildWhereClause = (filters, fieldMap = {}) => {
  const { Op } = require('sequelize');
  const where = {};

  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;

    const field = fieldMap[key] || key;

    // Handle special operators
    if (typeof value === 'object' && !Array.isArray(value)) {
      where[field] = value;
    } else if (Array.isArray(value)) {
      where[field] = { [Op.in]: value };
    } else if (typeof value === 'string' && value.includes('%')) {
      where[field] = { [Op.like]: value };
    } else {
      where[field] = value;
    }
  });

  return where;
};

/**
 * Remove undefined/null values from object
 * @param {Object} obj - Input object
 * @returns {Object} Cleaned object
 */
const cleanObject = (obj) => {
  const cleaned = {};
  Object.entries(obj).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      cleaned[key] = value;
    }
  });
  return cleaned;
};

/**
 * Sleep utility for testing/debugging
 * @param {number} ms - Milliseconds to sleep
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Format date to YYYY-MM-DD
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date
 */
const formatDate = (date) => {
  if (!date) return null;
  const d = new Date(date);
  return d.toISOString().split('T')[0];
};

/**
 * Format date to Vietnamese locale
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date
 */
const formatDateVN = (date) => {
  if (!date) return null;
  const d = new Date(date);
  return d.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

/**
 * Generate random string
 * @param {number} length - String length
 * @returns {string} Random string
 */
const generateRandomString = (length = 10) => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * Async handler wrapper to catch errors
 * @param {Function} fn - Async function
 * @returns {Function} Express middleware
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  parsePagination,
  parseSort,
  buildWhereClause,
  cleanObject,
  sleep,
  formatDate,
  formatDateVN,
  generateRandomString,
  asyncHandler,
};
