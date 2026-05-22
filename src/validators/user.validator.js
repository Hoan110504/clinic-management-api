/**
 * User Validators
 * Input validation for user endpoints
 */
import { body, param, query } from 'express-validator';
import { ROLES, GENDER } from '../config/constants.js';

const createUserValidator = [
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
    .isInt({ min: 1, max: 5 })
    .withMessage('Vai trò phải là roleId số nguyên từ 1-5')
    .toInt()
    .isIn(Object.values(ROLES))
    .withMessage('Vai trò không hợp lệ'),
  body('gender')
    .optional()
    .isIn(Object.values(GENDER))
    .withMessage('Giới tính không hợp lệ'),
  body('dateOfBirth')
    .optional()
    .isISO8601()
    .withMessage('Ngày sinh không hợp lệ'),
  body('specialization')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Chuyên khoa không được vượt quá 100 ký tự'),
  body('qualifications')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Học vị không được vượt quá 255 ký tự'),
  body('experienceYears')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 0, max: 70 })
    .withMessage('Số năm kinh nghiệm phải từ 0-70'),
  body('bio')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Giới thiệu không được vượt quá 2000 ký tự'),
  body('consultationNote')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Ghi chú tư vấn không được vượt quá 1000 ký tự'),
];

const updateUserValidator = [
  param('id')
    .notEmpty()
    .withMessage('ID người dùng không được để trống')
    .isInt({ min: 1 })
    .withMessage('ID không hợp lệ'),
  body('email')
    .optional({ nullable: true, checkFalsy: true })
    .isEmail()
    .withMessage('Email không hợp lệ'),
  body('fullName')
    .optional()
    .isLength({ min: 2, max: 100 })
    .withMessage('Họ tên phải từ 2-100 ký tự'),
  body('role')
    .optional()
    .isInt({ min: 1, max: 5 })
    .withMessage('Vai trò phải là roleId số nguyên từ 1-5')
    .toInt()
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
  body('specialization')
    .optional()
    .isLength({ max: 100 })
    .withMessage('Chuyên khoa không được vượt quá 100 ký tự'),
  body('qualifications')
    .optional()
    .isLength({ max: 255 })
    .withMessage('Học vị không được vượt quá 255 ký tự'),
  body('experienceYears')
    .optional({ nullable: true, checkFalsy: true })
    .isInt({ min: 0, max: 70 })
    .withMessage('Số năm kinh nghiệm phải từ 0-70'),
  body('bio')
    .optional()
    .isLength({ max: 2000 })
    .withMessage('Giới thiệu không được vượt quá 2000 ký tự'),
  body('consultationNote')
    .optional()
    .isLength({ max: 1000 })
    .withMessage('Ghi chú tư vấn không được vượt quá 1000 ký tự'),
];

const getUserValidator = [
  param('id')
    .notEmpty()
    .withMessage('ID người dùng không được để trống')
    .isInt({ min: 1 })
    .withMessage('ID không hợp lệ'),
];

const getUsersByRoleValidator = [
  param('role')
    .notEmpty()
    .withMessage('Vai trò không được để trống')
    .isInt({ min: 1, max: 5 })
    .withMessage('Vai trò phải là roleId số nguyên từ 1-5')
    .toInt()
    .isIn(Object.values(ROLES))
    .withMessage('Vai trò không hợp lệ'),
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
    .isInt({ min: 1, max: 5 })
    .withMessage('Vai trò phải là roleId số nguyên từ 1-5')
    .toInt()
    .isIn(Object.values(ROLES))
    .withMessage('Vai trò không hợp lệ'),
  query('search')
    .optional()
    .isString()
    .withMessage('Tìm kiếm không hợp lệ'),
];

export {
  createUserValidator,
  updateUserValidator,
  getUserValidator,
  getUsersByRoleValidator,
  listUsersValidator,
};

// Backwards-compatible aliases used by routes
export const create = createUserValidator;
export const update = updateUserValidator;
export const getById = getUserValidator;
export const getByRole = getUsersByRoleValidator;
export const getList = listUsersValidator;
