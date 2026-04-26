/**
 * Patient Validators
 * Input validation for patient endpoints
 */
import { body, param, query } from 'express-validator';
import { GENDER } from '../config/constants.js';

const createPatientValidator = [
  body('fullName')
    .notEmpty()
    .withMessage('Họ tên không được để trống')
    .isLength({ min: 2, max: 100 })
    .withMessage('Họ tên phải từ 2-100 ký tự'),
  body('dateOfBirth')
    .notEmpty()
    .withMessage('Ngày sinh không được để trống')
    .isISO8601()
    .withMessage('Ngày sinh không hợp lệ'),
  body('gender')
    .notEmpty()
    .withMessage('Giới tính không được để trống')
    .isIn(Object.values(GENDER))
    .withMessage('Giới tính không hợp lệ'),
  body('phone')
    .notEmpty()
    .withMessage('Số điện thoại không được để trống')
    .matches(/^[0-9+\-\s()]*$/)
    .withMessage('Số điện thoại không hợp lệ'),
  body('email')
    .optional({ nullable: true, checkFalsy: true })
    .isEmail()
    .withMessage('Email không hợp lệ')
    .bail()
    .normalizeEmail(),
  body('address')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Địa chỉ không được quá 255 ký tự'),
  body('idNumber')
    .optional()
    .isLength({ max: 20 })
    .withMessage('Số CCCD không được quá 20 ký tự'),
  body('medicalHistory')
    .optional()
    .isString()
    .withMessage('Tiền sử bệnh không hợp lệ'),
  body('allergies')
    .optional()
    .isString()
    .withMessage('Dị ứng không hợp lệ'),
];

const updatePatientValidator = [
  param('id')
    .notEmpty()
    .withMessage('ID bệnh nhân không được để trống'),
  body('fullName')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Họ tên phải từ 2-100 ký tự'),
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Ngày sinh không hợp lệ'),
  body('gender')
    .optional()
    .isIn(Object.values(GENDER))
    .withMessage('Giới tính không hợp lệ'),
  body('phone')
    .optional()
    .matches(/^[0-9+\-\s()]*$/)
    .withMessage('Số điện thoại không hợp lệ'),
  body('email')
    .optional({ nullable: true, checkFalsy: true })
    .isEmail()
    .withMessage('Email không hợp lệ')
    .bail()
    .normalizeEmail(),
  body('status')
    .optional()
    .isInt({ min: 0, max: 1 })
    .withMessage('Trạng thái bệnh nhân không hợp lệ'),
];

const getPatientValidator = [
  param('id')
    .notEmpty()
    .withMessage('ID bệnh nhân không được để trống'),
];

const listPatientsValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Số trang không hợp lệ'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Số lượng mỗi trang phải từ 1-100'),
  query('search')
    .optional()
    .isString()
    .withMessage('Tìm kiếm không hợp lệ'),
  query('status')
    .optional()
    .isInt({ min: 0, max: 1 })
    .withMessage('status phải là 0 hoặc 1'),
  query('onlyTodayAppointment')
    .optional()
    .isIn(['1', '0', 'true', 'false', 'yes', 'no', 'on', 'off'])
    .withMessage('onlyTodayAppointment không hợp lệ'),
  query('appointmentDate')
    .optional()
    .isISO8601()
    .withMessage('appointmentDate phải có định dạng YYYY-MM-DD'),
];

// Short name aliases for routes
const create = createPatientValidator;
const update = updatePatientValidator;
const getById = getPatientValidator;
const getList = listPatientsValidator;

export {
  // Short names
  create,
  update,
  getById,
  getList,
  // Original names
  createPatientValidator,
  updatePatientValidator,
  getPatientValidator,
  listPatientsValidator,
};
