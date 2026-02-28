/**
 * Validation Middleware
 * Request validation using express-validator
 */
const { validationResult } = require('express-validator');
const { ValidationError } = require('../utils/errors');

/**
 * Validate request middleware
 * Checks validation results and throws error if validation fails
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorDetails = errors.array().map((err) => ({
      field: err.path || err.param,
      message: err.msg,
      value: err.value,
    }));

    throw new ValidationError('Dữ liệu không hợp lệ', errorDetails);
  }

  next();
};

/**
 * Sanitize request body
 * Remove undefined/null values and trim strings
 */
const sanitize = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).forEach((key) => {
      const value = req.body[key];
      
      // Remove undefined/null values
      if (value === undefined || value === null) {
        delete req.body[key];
        return;
      }

      // Trim strings
      if (typeof value === 'string') {
        req.body[key] = value.trim();
        
        // Remove empty strings
        if (req.body[key] === '') {
          delete req.body[key];
        }
      }
    });
  }

  next();
};

module.exports = {
  validate,
  sanitize,
};
