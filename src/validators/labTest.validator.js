/**
 * Lab Test Validators
 * Input validation for lab test endpoints
 */
const { body, param, query } = require('express-validator');
const { LAB_STATUS } = require('../config/constants');

const createLabTestValidator = [
  body('patientId')
    .notEmpty()
    .withMessage('ID bệnh nhân không được để trống'),
  body('patientName')
    .notEmpty()
    .withMessage('Tên bệnh nhân không được để trống'),
  body('testType')
    .notEmpty()
    .withMessage('Loại xét nghiệm không được để trống'),
  body('testName')
    .notEmpty()
    .withMessage('Tên xét nghiệm không được để trống'),
  body('medicalRecordId')
    .optional()
    .isString()
    .withMessage('ID phiếu khám không hợp lệ'),
];

const updateLabTestValidator = [
  param('id')
    .notEmpty()
    .withMessage('ID xét nghiệm không được để trống'),
  body('status')
    .optional()
    .isIn(Object.values(LAB_STATUS))
    .withMessage('Trạng thái không hợp lệ'),
  body('results')
    .optional()
    .isString()
    .withMessage('Kết quả không hợp lệ'),
  body('normalRange')
    .optional()
    .isString()
    .withMessage('Khoảng bình thường không hợp lệ'),
  body('notes')
    .optional()
    .isString()
    .withMessage('Ghi chú không hợp lệ'),
];

const getLabTestValidator = [
  param('id')
    .notEmpty()
    .withMessage('ID xét nghiệm không được để trống'),
];

const listLabTestsValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Số trang không hợp lệ'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Số lượng mỗi trang phải từ 1-100'),
  query('status')
    .optional()
    .isIn(Object.values(LAB_STATUS))
    .withMessage('Trạng thái không hợp lệ'),
  query('patientId')
    .optional()
    .isString()
    .withMessage('ID bệnh nhân không hợp lệ'),
];

module.exports = {
  createLabTestValidator,
  updateLabTestValidator,
  getLabTestValidator,
  listLabTestsValidator,
};
