/**
 * Lab Test Validators - Canonical Schema Only
 * Input validation for lab test endpoints
 */
import { body, param, query } from 'express-validator';

// Create lab test - requires examinationId + serviceId from database
const createLabTestValidator = [
  body('examinationId')
    .notEmpty()
    .withMessage('ExaminationID khong duoc de trong')
    .isInt({ min: 1 })
    .withMessage('ExaminationID phai la so duong'),
  body('serviceId')
    .notEmpty()
    .withMessage('ServiceID khong duoc de trong')
    .isInt({ min: 1 })
    .withMessage('ServiceID phai la so duong'),
  body('roomId')
    .optional()
    .isInt({ min: 0 })
    .withMessage('RoomID phai la so'),
  body('status')
    .optional()
    .isInt({ min: 0, max: 3 })
    .withMessage('Status phai la 0, 1, 2, hoac 3'),
  body('note')
    .optional()
    .isString()
    .withMessage('Note phai la chuoi'),
];

// Update lab test - update canonical fields only
const updateLabTestValidator = [
  param('id')
    .notEmpty()
    .withMessage('ID xet nghiem khong duoc de trong')
    .isInt({ min: 1 })
    .withMessage('ID phai la so duong'),
  body('status')
    .optional()
    .isInt({ min: 0, max: 3 })
    .withMessage('Status phai la 0, 1, 2, hoac 3'),
  body('note')
    .optional()
    .isString()
    .withMessage('Note phai la chuoi'),
  body('roomId')
    .optional()
    .isInt({ min: 0 })
    .withMessage('RoomID phai la so'),
];

// Get lab test by ID
const getLabTestValidator = [
  param('id')
    .notEmpty()
    .withMessage('ID xet nghiem khong duoc de trong')
    .isInt({ min: 1 })
    .withMessage('ID phai la so duong'),
];

// List lab tests - use canonical fields only
const listLabTestsValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('So trang khong hop le'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('So luong moi trang phai tu 1-100'),
  query('status')
    .optional()
    .isInt({ min: 0, max: 3 })
    .withMessage('Status phai la 0, 1, 2, hoac 3'),
  query('serviceId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('ServiceID phai la so duong'),
  query('labOrderId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('LabOrderID phai la so duong'),
  query('examinationId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('ExaminationID phai la so duong'),
];

// Short name aliases for routes
const create = createLabTestValidator;
const update = updateLabTestValidator;
const getById = getLabTestValidator;
const getList = listLabTestsValidator;

export {
  create,
  update,
  getById,
  getList,
  createLabTestValidator,
  updateLabTestValidator,
  getLabTestValidator,
  listLabTestsValidator,
};
