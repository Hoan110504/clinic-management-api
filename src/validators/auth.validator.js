/**
 * Authentication Validators
 * Input validation for auth endpoints
 */
const { body, param } = require('express-validator');
const { ROLES } = require('../config/constants');

const loginValidator = [
  body('username')
    .notEmpty()
    .withMessage('Tên đăng nhập không được để trống')
    .isLength({ min: 3, max: 50 })
    .withMessage('Tên đăng nhập phải từ 3-50 ký tự'),
  body('password')
    .notEmpty()
    .withMessage('Mật khẩu không được để trống')
    .isLength({ min: 6 })
    .withMessage('Mật khẩu phải có ít nhất 6 ký tự'),
];

const registerValidator = [
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
    .withMessage('Email không hợp lệ')
    .normalizeEmail(),
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
  body('phone')
    .optional()
    .matches(/^[0-9+\-\s()]*$/)
    .withMessage('Số điện thoại không hợp lệ'),
  body('role')
    .optional()
    .isIn(Object.values(ROLES))
    .withMessage('Vai trò không hợp lệ'),
];

const changePasswordValidator = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Mật khẩu hiện tại không được để trống'),
  body('newPassword')
    .notEmpty()
    .withMessage('Mật khẩu mới không được để trống')
    .isLength({ min: 6 })
    .withMessage('Mật khẩu mới phải có ít nhất 6 ký tự'),
  body('confirmPassword')
    .notEmpty()
    .withMessage('Xác nhận mật khẩu không được để trống')
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error('Mật khẩu xác nhận không khớp');
      }
      return true;
    }),
];

const refreshTokenValidator = [
  body('refreshToken')
    .notEmpty()
    .withMessage('Refresh token không được để trống'),
];

module.exports = {
  loginValidator,
  registerValidator,
  changePasswordValidator,
  refreshTokenValidator,
};
