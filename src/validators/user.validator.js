/**
 * User Validators
 * Input validation for user endpoints
 */
const { body, param, query } = require('express-validator');
const { ROLES, GENDER } = require('../config/constants');

const createUserValidator = [
  body('username')
    .notEmpty()
    .withMessage('Tên đăng nhập không được để trống')
    .isLength({ min: 3, max: 50 })
    .withMessage('Tên đăng nhập phải từ 3-50 ký tự')
    .isAlphanumeric()
    .withMessage('Tên đăng nhập chỉ được chứa chữ cái và số'),
  body('email')
    .notEmpty()
    .withMessage('Email không được để trống')
    .isEmail()
    .withMessage('Email không hợp lệ'),
  body('password')
    .notEmpty()
    .withMessage('Mật khẩu không được để trống')
    .isLength({ min: 6 })
    .withMessage('Mật khẩu phải có ít nhất 6 ký tự'),
  body('fullName')
    .notEmpty()
    .withMessage('Họ tên không được để trống')
    .isLength({ min: 2, max: 100 })
    .withMessage('Họ tên phải từ 2-100 ký tự'),
  body('role')
    .notEmpty()
    .withMessage('Vai trò không được để trống')
    .isIn(Object.values(ROLES))
    .withMessage('Vai trò không hợp lệ'),
  body('phone')
    .optional()
    .matches(/^[0-9+\-\s()]*$/)
    .withMessage('Số điện thoại không hợp lệ'),
  body('gender')
    .optional()
    .isIn(Object.values(GENDER))
    .withMessage('Giới tính không hợp lệ'),
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Ngày sinh không hợp lệ'),
];

const updateUserValidator = [
  param('id')
    .notEmpty()
    .withMessage('ID người dùng không được để trống')
    .isUUID()
    .withMessage('ID không hợp lệ'),
  body('email')
    .optional()
    .isEmail()
    .withMessage('Email không hợp lệ'),
  body('fullName')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Họ tên phải từ 2-100 ký tự'),
  body('role')
    .optional()
    .isIn(Object.values(ROLES))
    .withMessage('Vai trò không hợp lệ'),
  body('phone')
    .optional()
    .matches(/^[0-9+\-\s()]*$/)
    .withMessage('Số điện thoại không hợp lệ'),
  body('gender')
    .optional()
    .isIn(Object.values(GENDER))
    .withMessage('Giới tính không hợp lệ'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('Trạng thái không hợp lệ'),
];

const getUserValidator = [
  param('id')
    .notEmpty()
    .withMessage('ID người dùng không được để trống')
    .isUUID()
    .withMessage('ID không hợp lệ'),
];

const listUsersValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Số trang không hợp lệ'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Số lượng mỗi trang phải từ 1-100'),
  query('role')
    .optional()
    .isIn(Object.values(ROLES))
    .withMessage('Vai trò không hợp lệ'),
  query('search')
    .optional()
    .isString()
    .withMessage('Tìm kiếm không hợp lệ'),
];

module.exports = {
  createUserValidator,
  updateUserValidator,
  getUserValidator,
  listUsersValidator,
};
