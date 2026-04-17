/**
 * Validation Middleware
 * Request validation using express-validator
 */
import { validationResult } from 'express-validator';
import { ValidationError } from '../utils/errors.js';

/**
 * validate(validations)
 * Accepts an array of express-validator validation chains and returns
 * an express middleware that runs them and checks validation results.
 */
const validate = (validations) => async (req, res, next) => {
  if (!validations) return next();

  try {
    // run each validation chain
    await Promise.all(
      validations.map((validation) => {
        if (typeof validation.run === 'function') {
          return validation.run(req);
        }
        return Promise.resolve();
      })
    );

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      const errorDetails = errors.array().map((err) => ({
        field: err.path || err.param,
        message: err.msg,
        value: err.value,
      }));

      throw new ValidationError('Dữ liệu không hợp lệ', errorDetails);
    }

    return next();
  } catch (err) {
    return next(err);
  }
};

/**
 * Sanitize request body
 * Remove undefined/null values and trim strings
 */
const sanitize = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).forEach((key) => {
      const value = req.body[key];

      // Remove only undefined values. Keep explicit null so controllers
      // can detect an explicit "clear" intent (e.g., email: null).
      if (value === undefined) {
        delete req.body[key];
        return;
      }

      // Trim strings and convert empty strings to null to represent
      // explicit clearing from the frontend.
      if (typeof value === 'string') {
        const trimmed = value.trim();
        req.body[key] = trimmed === '' ? null : trimmed;
      }
    });
  }

  next();
};

export {
  validate,
  sanitize,
};
