/**
 * Prescription Validators
 * Input validation for prescription endpoints
 */
import { body, param, query } from 'express-validator';

const createPrescriptionValidator = [
  body('medicalRecordId')
    .notEmpty()
    .withMessage('ID phiếu khám không được để trống'),
  body('patientId')
    .notEmpty()
    .withMessage('ID bệnh nhân không được để trống'),
  body('patientName')
    .notEmpty()
    .withMessage('Tên bệnh nhân không được để trống'),
  body('items')
    .notEmpty()
    .withMessage('Danh sách thuốc không được để trống')
    .isArray({ min: 1 })
    .withMessage('Phải có ít nhất một loại thuốc'),
  body('items.*.medicineId')
    .notEmpty()
    .withMessage('ID thuốc không được để trống'),
  body('items.*.medicineName')
    .notEmpty()
    .withMessage('Tên thuốc không được để trống'),
  body('items.*.dosage')
    .notEmpty()
    .withMessage('Liều lượng không được để trống'),
  body('items.*.quantity')
    .notEmpty()
    .withMessage('Số lượng không được để trống')
    .isInt({ min: 1 })
    .withMessage('Số lượng phải lớn hơn 0'),
  body('items.*.status')
    .optional()
    .isInt({ min: 0, max: 2 })
    .withMessage('Trạng thái thuốc không hợp lệ (0, 1 hoặc 2)'),
  body('diagnosis')
    .optional()
    .isString()
    .withMessage('Chẩn đoán không hợp lệ'),
  body('notes')
    .optional()
    .isString()
    .withMessage('Ghi chú không hợp lệ'),
];

const updatePrescriptionValidator = [
  param('id')
    .notEmpty()
    .withMessage('ID đơn thuốc không được để trống'),
  body('items')
    .optional()
    .isArray()
    .withMessage('Danh sách thuốc phải là mảng'),
  body('items.*.status')
    .optional()
    .isInt({ min: 0, max: 2 })
    .withMessage('Trạng thái thuốc không hợp lệ (0, 1 hoặc 2)'),
  body('notes')
    .optional()
    .isString()
    .withMessage('Ghi chú không hợp lệ'),
];

const getPrescriptionValidator = [
  param('id')
    .notEmpty()
    .withMessage('ID đơn thuốc không được để trống'),
];

const listPrescriptionsValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Số trang không hợp lệ'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Số lượng mỗi trang phải từ 1-100'),
  query('patientId')
    .optional()
    .isString()
    .withMessage('ID bệnh nhân không hợp lệ'),
  query('doctorId')
    .optional()
    .isUUID()
    .withMessage('ID bác sĩ không hợp lệ'),
  query('isDispensed')
    .optional()
    .isBoolean()
    .withMessage('Trạng thái phát thuốc không hợp lệ'),
];

const dispensePrescriptionValidator = [
  param('id')
    .notEmpty()
    .withMessage('ID đơn thuốc không được để trống'),
];

export {
  createPrescriptionValidator,
  updatePrescriptionValidator,
  getPrescriptionValidator,
  listPrescriptionsValidator,
  dispensePrescriptionValidator,
};
