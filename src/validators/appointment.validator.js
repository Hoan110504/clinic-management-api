/**
 * Appointment Validators
 * Input validation for appointment endpoints
 */
import { body, param, query } from 'express-validator';
import {
  APPOINTMENT_STATUS,
  APPOINTMENT_SOURCE,
  GENDER,
  TIME_SLOTS,
} from '../config/constants.js';

const createAppointmentValidator = [
  body('patientName')
    .notEmpty()
    .withMessage('Tên bệnh nhân không được để trống')
    .isLength({ min: 2, max: 100 })
    .withMessage('Tên bệnh nhân phải từ 2-100 ký tự'),
  body('patientPhone')
    .notEmpty()
    .withMessage('Số điện thoại không được để trống')
    .matches(/^[0-9+\-\s()]*$/)
    .withMessage('Số điện thoại không hợp lệ'),
  body('appointmentDate')
    .notEmpty()
    .withMessage('Ngày hẹn không được để trống')
    .isISO8601()
    .withMessage('Ngày hẹn không hợp lệ')
    .custom((value) => {
      const appointmentDate = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (appointmentDate < today) {
        throw new Error('Ngày hẹn không được trong quá khứ');
      }
      return true;
    }),
  body('timeSlot')
    .notEmpty()
    .withMessage('Khung giờ không được để trống')
    .isIn(TIME_SLOTS)
    .withMessage('Khung giờ không hợp lệ'),
  body('source')
    .optional()
    .isIn(Object.values(APPOINTMENT_SOURCE))
    .withMessage('Nguồn đặt lịch không hợp lệ'),
  body('patientGender')
    .optional()
    .isIn(Object.values(GENDER))
    .withMessage('Giới tính không hợp lệ'),
  body('patientBirthDate')
    .optional()
    .isISO8601()
    .withMessage('Ngày sinh không hợp lệ'),
  body('patientEmail')
    .optional()
    .isEmail()
    .withMessage('Email không hợp lệ'),
  body('examType')
    .optional()
    .isString()
    .withMessage('Loại khám không hợp lệ'),
  body('priority')
    .optional()
    .isInt({ min: 0, max: 2 })
    .withMessage('Mức độ ưu tiên không hợp lệ'),
  body('symptoms')
    .optional()
    .isString()
    .withMessage('Triệu chứng không hợp lệ'),
  body('assignedDoctorId')
    .optional()
    .isUUID()
    .withMessage('ID bác sĩ không hợp lệ'),
  body('priority')
    .optional()
    .isInt({ min: 0, max: 2 })
    .withMessage('Mức độ ưu tiên không hợp lệ'),
];

const updateAppointmentValidator = [
  param('id')
    .notEmpty()
    .withMessage('ID lịch hẹn không được để trống'),
  body('appointmentDate')
    .optional()
    .isISO8601()
    .withMessage('Ngày hẹn không hợp lệ'),
  body('timeSlot')
    .optional()
    .isIn(TIME_SLOTS)
    .withMessage('Khung giờ không hợp lệ'),
  body('status')
    .optional()
    .custom((value) => {
      if (value === undefined || value === null) return true;
      const codes = [1, 2, 3, 4];
      const labels = Object.values(APPOINTMENT_STATUS);
      let v = value;
      if (typeof v === 'string' && /^[0-9]+$/.test(v)) v = parseInt(v, 10);
      if (codes.includes(v)) return true;
      if (labels.includes(v)) return true;
      throw new Error('Trạng thái không hợp lệ');
    }),
  body('assignedDoctorId')
    .optional()
    .isUUID()
    .withMessage('ID bác sĩ không hợp lệ'),
];

const getAppointmentValidator = [
  param('id')
    .notEmpty()
    .withMessage('ID lịch hẹn không được để trống'),
];

const listAppointmentsValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Số trang không hợp lệ'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('Số lượng mỗi trang phải từ 1-1000'),
  query('status')
    .optional()
    .custom((value) => {
      if (value === undefined || value === null) return true;
      const codes = ['1', '2', '3', '4'];
      const labels = Object.values(APPOINTMENT_STATUS);
      if (codes.includes(String(value))) return true;
      if (labels.includes(value)) return true;
      throw new Error('Trạng thái không hợp lệ');
    }),
  query('date')
    .optional()
    .isISO8601()
    .withMessage('Ngày không hợp lệ'),
  query('doctorId')
    .optional()
    .isUUID()
    .withMessage('ID bác sĩ không hợp lệ'),
];

const cancelAppointmentValidator = [
  param('id')
    .notEmpty()
    .withMessage('ID lịch hẹn không được để trống'),
  body('reason')
    .optional()
    .isString()
    .withMessage('Lý do hủy không hợp lệ'),
];

export {
  createAppointmentValidator,
  updateAppointmentValidator,
  getAppointmentValidator,
  listAppointmentsValidator,
  cancelAppointmentValidator,
};
