/**
 * Medicine Validators
 * Input validation for medicine endpoints
 */
import { body, param, query } from 'express-validator';
import { MEDICINE_CATEGORIES } from '../config/constants.js';

const createMedicineValidator = [
  body('name')
    .notEmpty()
    .withMessage('Tên thuốc không được để trống')
    .isLength({ min: 2, max: 200 })
    .withMessage('Tên thuốc phải từ 2-200 ký tự'),
  body('unit')
    .notEmpty()
    .withMessage('Đơn vị không được để trống')
    .isLength({ max: 50 })
    .withMessage('Đơn vị không được quá 50 ký tự'),
  body('price')
    .notEmpty()
    .withMessage('Giá không được để trống')
    .isFloat({ min: 0 })
    .withMessage('Giá phải lớn hơn hoặc bằng 0'),
  body('quantity')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Số lượng phải lớn hơn hoặc bằng 0'),
  body('minQuantity')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Số lượng tối thiểu phải lớn hơn hoặc bằng 0'),
  body('category')
    .optional()
    .isIn(MEDICINE_CATEGORIES)
    .withMessage('Danh mục không hợp lệ'),
  body('supplier')
    .optional()
    .isLength({ max: 200 })
    .withMessage('Nhà cung cấp không được quá 200 ký tự'),
  body('expiryDate')
    .optional()
    .isISO8601()
    .withMessage('Ngày hết hạn không hợp lệ'),
];

const updateMedicineValidator = [
  param('id')
    .notEmpty()
    .withMessage('ID thuốc không được để trống'),
  body('name')
    .optional()
    .isLength({ min: 2, max: 200 })
    .withMessage('Tên thuốc phải từ 2-200 ký tự'),
  body('price')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Giá phải lớn hơn hoặc bằng 0'),
  body('quantity')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Số lượng phải lớn hơn hoặc bằng 0'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('Trạng thái không hợp lệ'),
];

const getMedicineValidator = [
  param('id')
    .notEmpty()
    .withMessage('ID thuốc không được để trống'),
];

const listMedicinesValidator = [
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
  query('category')
    .optional()
    .isIn(MEDICINE_CATEGORIES)
    .withMessage('Danh mục không hợp lệ'),
  query('lowStock')
    .optional()
    .isBoolean()
    .withMessage('Lọc hàng tồn kho thấp không hợp lệ'),
];

const adjustInventoryValidator = [
  param('id')
    .notEmpty()
    .withMessage('ID thuốc không được để trống'),
  body('type')
    .notEmpty()
    .withMessage('Loại giao dịch không được để trống')
    .isIn(['Nhập', 'Xuất', 'Điều chỉnh'])
    .withMessage('Loại giao dịch không hợp lệ'),
  body('quantity')
    .notEmpty()
    .withMessage('Số lượng không được để trống')
    .isInt({ min: 1 })
    .withMessage('Số lượng phải lớn hơn 0'),
  body('reason')
    .optional()
    .isString()
    .withMessage('Lý do không hợp lệ'),
  body('referenceType')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('Loại tham chiếu không hợp lệ'),
  body('referenceId')
    .optional()
    .isString()
    .isLength({ max: 50 })
    .withMessage('Mã tham chiếu không hợp lệ'),
  body('notes')
    .optional()
    .isString()
    .withMessage('Ghi chú không hợp lệ'),
];

export {
  createMedicineValidator,
  updateMedicineValidator,
  getMedicineValidator,
  listMedicinesValidator,
  adjustInventoryValidator,
};
