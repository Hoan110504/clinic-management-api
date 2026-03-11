/**
 * Medical Record Validators
 * Input validation for medical record endpoints
 */
import { body, param, query } from 'express-validator';
import { MEDICAL_RECORD_STATUS, GENDER } from '../config/constants.js';

const createMedicalRecordValidator = [
  body('patientId')
    .optional()
    .isString()
    .withMessage('ID bệnh nhân không hợp lệ'),
  body('patientName')
    .optional()
    .isString()
    .withMessage('Tên bệnh nhân không hợp lệ'),
  body('doctorId')
    .optional()
    .isUUID()
    .withMessage('ID bác sĩ không hợp lệ'),
  body('examType')
    .optional()
    .isString()
    .withMessage('Loại khám không hợp lệ'),
  body('purpose')
    .optional()
    .isString()
    .withMessage('Mục đích khám không hợp lệ'),
];

const updateMedicalRecordValidator = [
  param('id')
    .notEmpty()
    .withMessage('ID phiếu khám không được để trống'),
  body('symptoms')
    .optional()
    .isString()
    .withMessage('Triệu chứng không hợp lệ'),
  body('diagnosis')
    .optional()
    .isString()
    .withMessage('Chẩn đoán không hợp lệ'),
  body('treatment')
    .optional()
    .isString()
    .withMessage('Phương pháp điều trị không hợp lệ'),
  body('vitalSigns')
    .optional()
    .isObject()
    .withMessage('Dấu hiệu sinh tồn không hợp lệ'),
  body('status')
    .optional()
    .isIn(Object.values(MEDICAL_RECORD_STATUS))
    .withMessage('Trạng thái không hợp lệ'),
  body('nextAppointment')
    .optional()
    .isISO8601()
    .withMessage('Ngày tái khám không hợp lệ'),
];

const getMedicalRecordValidator = [
  param('id')
    .notEmpty()
    .withMessage('ID phiếu khám không được để trống'),
];

const listMedicalRecordsValidator = [
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
  query('status')
    .optional()
    .isIn(Object.values(MEDICAL_RECORD_STATUS))
    .withMessage('Trạng thái không hợp lệ'),
];

export {
  createMedicalRecordValidator,
  updateMedicalRecordValidator,
  getMedicalRecordValidator,
  listMedicalRecordsValidator,
};
