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
    .optional()
    .isEmail()
    .withMessage('Email không hợp lệ'),
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
    .optional()
    .isEmail()
    .withMessage('Email không hợp lệ'),
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
];

export {
  createPatientValidator,
  updatePatientValidator,
  getPatientValidator,
  listPatientsValidator,
};
