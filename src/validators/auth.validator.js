/**
 * Authentication Validators
 * Input validation for auth endpoints
 */
import { body, param } from 'express-validator';
import { ROLES } from '../config/constants.js';

const loginValidator = [
  body('identifier')
    .notEmpty()
    .withMessage('Số điện thoại hoặc email không được để trống')
    .custom((value) => {
      const text = String(value || '').trim();
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
      const isPhone = /^[0-9+\-\s()]{3,15}$/.test(text);
      if (!isEmail && !isPhone) {
        throw new Error('Số điện thoại hoặc email không hợp lệ');
      }
      return true;
    }),
  body('password')
    .notEmpty()
    .withMessage('Mật khẩu không được để trống')
    .isLength({ min: 6 })
    .withMessage('Mật khẩu phải có ít nhất 6 ký tự'),
];

const registerValidator = [
  body('phone')
    .notEmpty()
    .withMessage('Số điện thoại không được để trống')
    .isLength({ min: 3, max: 15 })
    .withMessage('Số điện thoại phải từ 3-15 ký tự')
    .matches(/^[0-9+\-\s()]*$/)
    .withMessage('Số điện thoại không hợp lệ'),
  body('email')
    .optional({ nullable: true, checkFalsy: true })
    .isEmail()
    .withMessage('Email không hợp lệ')
    .bail()
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
  body('role')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Vai trò phải là roleId số nguyên từ 1-5')
    .toInt()
    .isIn(Object.values(ROLES))
    .withMessage('Vai trò không hợp lệ'),
];

const passwordResetRequestValidator = [
  body('identifier')
    .notEmpty()
    .withMessage('Số điện thoại hoặc email không được để trống')
    .custom((value) => {
      const text = String(value || '').trim();
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
      const isPhone = /^[0-9+\-\s()]{3,15}$/.test(text);
      if (!isEmail && !isPhone) {
        throw new Error('Số điện thoại hoặc email không hợp lệ');
      }
      return true;
    }),
];

const passwordResetVerifyValidator = [
  body('identifier')
    .notEmpty()
    .withMessage('Số điện thoại hoặc email không được để trống')
    .custom((value) => {
      const text = String(value || '').trim();
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
      const isPhone = /^[0-9+\-\s()]{3,15}$/.test(text);
      if (!isEmail && !isPhone) {
        throw new Error('Số điện thoại hoặc email không hợp lệ');
      }
      return true;
    }),
  body('otp')
    .notEmpty()
    .withMessage('Mã OTP không được để trống')
    .matches(/^\d{6}$/)
    .withMessage('Mã OTP phải gồm 6 chữ số'),
];

const passwordResetConfirmValidator = [
  body('identifier')
    .notEmpty()
    .withMessage('Số điện thoại hoặc email không được để trống')
    .custom((value) => {
      const text = String(value || '').trim();
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
      const isPhone = /^[0-9+\-\s()]{3,15}$/.test(text);
      if (!isEmail && !isPhone) {
        throw new Error('Số điện thoại hoặc email không hợp lệ');
      }
      return true;
    }),
  body('resetToken')
    .notEmpty()
    .withMessage('Mã xác thực không được để trống'),
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

const completeChangePasswordValidator = [
  body('identifier')
    .notEmpty()
    .withMessage('Số điện thoại hoặc email không được để trống')
    .custom((value) => {
      const text = String(value || '').trim();
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
      const isPhone = /^[0-9+\-\s()]{3,15}$/.test(text);
      if (!isEmail && !isPhone) {
        throw new Error('Số điện thoại hoặc email không hợp lệ');
      }
      return true;
    }),
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

// Short name aliases for routes (e.g. authValidator.login)
const login = loginValidator;
const register = registerValidator;
const changePassword = changePasswordValidator;
const refreshToken = refreshTokenValidator;
const completeChangePassword = completeChangePasswordValidator;
const passwordResetRequest = passwordResetRequestValidator;
const passwordResetVerify = passwordResetVerifyValidator;
const passwordResetConfirm = passwordResetConfirmValidator;

export {
  // Short names
  login,
  register,
  changePassword,
  refreshToken,
  completeChangePassword,
  passwordResetRequest,
  passwordResetVerify,
  passwordResetConfirm,
  // Original names
  loginValidator,
  registerValidator,
  changePasswordValidator,
  passwordResetRequestValidator,
  passwordResetVerifyValidator,
  passwordResetConfirmValidator,
  refreshTokenValidator,
};
