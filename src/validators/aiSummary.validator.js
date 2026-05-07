import { body, validationResult } from 'express-validator';

/**
 * Validation rules for AI medical summary request
 */
export const validateSummarizeRequest = [
  body('medicalRecordId')
    .isInt({ min: 1, max: 9223372036854775807 })
    .withMessage('medicalRecordId must be a valid positive integer'),
  
  body('patientId')
    .isInt({ min: 1, max: 9223372036854775807 })
    .withMessage('patientId must be a valid positive integer'),
  
  // Reject unexpected fields
  body()
    .custom((value, { req }) => {
      const allowedFields = ['medicalRecordId', 'patientId'];
      const extraFields = Object.keys(req.body).filter(
        key => !allowedFields.includes(key)
      );
      if (extraFields.length > 0) {
        throw new Error(`Unexpected fields: ${extraFields.join(', ')}`);
      }
      return true;
    }),
  
  // Middleware to handle validation results
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_INPUT',
          message: 'Dữ liệu đầu vào không hợp lệ',
          statusCode: 400,
          details: errors.array()
        }
      });
    }
    next();
  }
];
