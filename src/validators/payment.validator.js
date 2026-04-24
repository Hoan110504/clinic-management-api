/**
 * Payment Validators
 * Input validation for payment endpoints
 */
import { body, param, query } from 'express-validator';
import {
  PAYMENT_STATUS,
  PAYMENT_TYPES,
  PAYMENT_METHODS,
} from '../config/constants.js';

const isAllowedPaymentMethod = (value) => {
  if (value === null || value === undefined || value === '') return true;
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 2) return true;
  const normalized = String(value).trim().toLowerCase();
  return [
    'tiền mặt', 'tien mat', 'cash',
    'thẻ', 'the', 'card',
    'chuyển khoản', 'chuyen khoan', 'qr code', 'transfer', 'bank transfer',
    ...Object.values(PAYMENT_METHODS).map((item) => String(item).toLowerCase()),
  ].includes(normalized);
};

const isAllowedPaymentStatus = (value) => {
  if (value === null || value === undefined || value === '') return true;
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 2) return true;
  const normalized = String(value).trim().toLowerCase();
  return [
    'chưa thanh toán', 'chua thanh toan', 'unpaid',
    'đã thanh toán', 'da thanh toan', 'paid',
    'còn nợ', 'con no', 'thanh toán một phần', 'thanh toan mot phan', 'partial',
    ...Object.values(PAYMENT_STATUS).map((item) => String(item).toLowerCase()),
  ].includes(normalized);
};

const createPaymentValidator = [
  body('patientId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('PatientID không hợp lệ'),
  body('examinationId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('ExaminationID không hợp lệ'),
  body('prescriptionId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('PrescriptionID không hợp lệ'),
  body('labOrderId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('LabOrderID không hợp lệ'),
  body('invoiceDate')
    .optional()
    .isISO8601()
    .withMessage('InvoiceDate không hợp lệ'),
  body('totalAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('TotalAmount phải lớn hơn hoặc bằng 0'),
  body('patientName')
    .optional(),
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
  body('paidAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Số tiền đã thanh toán phải lớn hơn hoặc bằng 0'),
  body('debtAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Số tiền còn nợ phải lớn hơn hoặc bằng 0'),
  body('paymentMethod')
    .optional()
    .custom(isAllowedPaymentMethod)
    .withMessage('Phương thức thanh toán không hợp lệ'),
  body('status')
    .optional()
    .custom(isAllowedPaymentStatus)
    .withMessage('Trạng thái không hợp lệ'),
];

const processPaymentValidator = [
  param('id')
    .notEmpty()
    .withMessage('ID thanh toán không được để trống'),
  body('paymentMethod')
    .notEmpty()
    .custom(isAllowedPaymentMethod)
    .withMessage('Phương thức thanh toán không hợp lệ'),
  body().custom((_, { req }) => {
    if (req.body.amountPaid === undefined && req.body.paidAmount === undefined) {
      throw new Error('Số tiền thanh toán không được để trống');
    }
    return true;
  }),
  body('amountPaid')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Số tiền phải lớn hơn hoặc bằng 0'),
  body('paidAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Số tiền đã thanh toán phải lớn hơn hoặc bằng 0'),
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
    .custom(isAllowedPaymentStatus)
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

export {
  createPaymentValidator,
  processPaymentValidator,
  getPaymentValidator,
  listPaymentsValidator,
};
