/**
 * Lab Test Validators
 * Input validation for lab test endpoints
 */
import { body, param, query } from 'express-validator';
import { LAB_STATUS } from '../config/constants.js';

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
    .custom((value) => {
      if (value === null || value === undefined || value === '') return true;
      if (typeof value === 'number' && Number.isFinite(value)) return true;
      if (typeof value === 'string') return true;
      throw new Error('ID phiếu khám không hợp lệ');
    }),
];

const updateLabTestValidator = [
  param('id')
    .notEmpty()
    .withMessage('ID xét nghiệm không được để trống'),
  body('status')
    .optional()
    .custom((value) => {
      if (value === null || value === undefined || value === '') return true;
      if (Object.values(LAB_STATUS).includes(value)) return true;
      if (typeof value === 'number' && [0, 1, 2, 3].includes(value)) return true;
      if (typeof value === 'string' && (/^[0-3]$/.test(value.trim()) || value.trim().toLowerCase() === 'x' || value.trim() === '×')) return true;
      throw new Error('Trạng thái không hợp lệ');
    }),
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
  body('conclusion')
    .optional()
    .isString()
    .withMessage('Kết luận không hợp lệ'),
  body('images')
    .optional()
    .isArray()
    .withMessage('Danh sách ảnh không hợp lệ'),
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
    .custom((value) => {
      if (value === null || value === undefined || value === '') return true;
      if (Object.values(LAB_STATUS).includes(value)) return true;
      if (/^[0-3]$/.test(String(value).trim())) return true;
      throw new Error('Trạng thái không hợp lệ');
    }),
  query('patientId')
    .optional()
    .custom((value) => {
      if (value === null || value === undefined || value === '') return true;
      if (typeof value === 'number' && Number.isFinite(value)) return true;
      if (typeof value === 'string') return true;
      throw new Error('ID bệnh nhân không hợp lệ');
    }),
];

// Short name aliases for routes (e.g. labTestValidator.create)
const create = createLabTestValidator;
const update = updateLabTestValidator;
const getById = getLabTestValidator;
const getList = listLabTestsValidator;

export {
  // Short names
  create,
  update,
  getById,
  getList,
  // Original names
  createLabTestValidator,
  updateLabTestValidator,
  getLabTestValidator,
  listLabTestsValidator,
};
