/**
 * Payment Validators
 * Input validation for payment endpoints
 */
const { body, param, query } = require('express-validator');
const {
  PAYMENT_STATUS,
  PAYMENT_TYPES,
  PAYMENT_METHODS,
} = require('../config/constants');

const createPaymentValidator = [
  body('type')
    .notEmpty()
    .withMessage('Loại thanh toán không được để trống')
    .isIn(Object.values(PAYMENT_TYPES))
    .withMessage('Loại thanh toán không hợp lệ'),
  body('patientName')
    .notEmpty()
    .withMessage('Tên bệnh nhân không được để trống'),
  body('services')
    .optional()
    .isArray()
    .withMessage('Dịch vụ phải là mảng'),
  body('medicines')
    .optional()
    .isArray()
    .withMessage('Thuốc phải là mảng'),
  body('consultationFee')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Phí khám phải lớn hơn hoặc bằng 0'),
  body('labTestFee')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Phí xét nghiệm phải lớn hơn hoặc bằng 0'),
  body('medicineFee')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Phí thuốc phải lớn hơn hoặc bằng 0'),
  body('discountType')
    .optional()
    .isIn(['percent', 'amount'])
    .withMessage('Loại giảm giá không hợp lệ'),
  body('discountValue')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Giá trị giảm giá phải lớn hơn hoặc bằng 0'),
];

const processPaymentValidator = [
  param('id')
    .notEmpty()
    .withMessage('ID thanh toán không được để trống'),
  body('paymentMethod')
    .notEmpty()
    .withMessage('Phương thức thanh toán không được để trống')
    .isIn(Object.values(PAYMENT_METHODS))
    .withMessage('Phương thức thanh toán không hợp lệ'),
  body('amountPaid')
    .notEmpty()
    .withMessage('Số tiền thanh toán không được để trống')
    .isFloat({ min: 0 })
    .withMessage('Số tiền phải lớn hơn hoặc bằng 0'),
];

const getPaymentValidator = [
  param('id')
    .notEmpty()
    .withMessage('ID thanh toán không được để trống'),
];

const listPaymentsValidator = [
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
    .isIn(Object.values(PAYMENT_STATUS))
    .withMessage('Trạng thái không hợp lệ'),
  query('type')
    .optional()
    .isIn(Object.values(PAYMENT_TYPES))
    .withMessage('Loại thanh toán không hợp lệ'),
  query('patientId')
    .optional()
    .isString()
    .withMessage('ID bệnh nhân không hợp lệ'),
  query('fromDate')
    .optional()
    .isISO8601()
    .withMessage('Ngày bắt đầu không hợp lệ'),
  query('toDate')
    .optional()
    .isISO8601()
    .withMessage('Ngày kết thúc không hợp lệ'),
];

module.exports = {
  createPaymentValidator,
  processPaymentValidator,
  getPaymentValidator,
  listPaymentsValidator,
};
