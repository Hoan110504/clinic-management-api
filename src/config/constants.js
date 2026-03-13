/**
 * Application Constants
 * Centralized constant definitions
 */

// User Roles
const ROLES = {
  ADMIN: 'admin',
  DOCTOR: 'doctor',
  RECEPTIONIST: 'receptionist',
  PHARMACIST: 'pharmacist',
  PATIENT: 'patient',
};

const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Quản trị viên',
  [ROLES.DOCTOR]: 'Bác sĩ',
  [ROLES.RECEPTIONIST]: 'Lễ tân',
  [ROLES.PHARMACIST]: 'Dược sĩ',
  [ROLES.PATIENT]: 'Bệnh nhân',
};

// Appointment Status
const APPOINTMENT_STATUS = {
  SCHEDULED: 'Đã đặt lịch',
  CONFIRMED: 'Đã xác nhận',
  WAITING: 'Đã đặt lịch',
  IN_PROGRESS: 'Đang khám',
  COMPLETED: 'Đã hoàn thành',
  CANCELLED: 'Đã hủy',
};

// Medical Record Status
const MEDICAL_RECORD_STATUS = {
  WAITING: 'Đã đặt lịch',
  IN_PROGRESS: 'Đang khám',
  COMPLETED: 'Hoàn thành',
};

// Lab Test Status
const LAB_STATUS = {
  PENDING: 'Chờ thực hiện',
  IN_PROGRESS: 'Đang thực hiện',
  COMPLETED: 'Hoàn thành',
};

// Payment Status
const PAYMENT_STATUS = {
  UNPAID: 'Chưa thanh toán',
  PAID: 'Đã thanh toán',
  PARTIAL: 'Thanh toán một phần',
};

// Payment Types
const PAYMENT_TYPES = {
  MEDICAL_EXAM: 'Khám bệnh',
  DRUG_SALE: 'Bán thuốc lẻ',
};

// Payment Methods
const PAYMENT_METHODS = {
  CASH: 'Tiền mặt',
  CARD: 'Thẻ',
  TRANSFER: 'Chuyển khoản',
};

// Inventory Transaction Types
const INVENTORY_TRANSACTION_TYPES = {
  IMPORT: 'Nhập',
  EXPORT: 'Xuất',
  ADJUSTMENT: 'Điều chỉnh',
};

// Gender
const GENDER = {
  MALE: 'Nam',
  FEMALE: 'Nữ',
};

// Appointment Source
const APPOINTMENT_SOURCE = {
  ONLINE: 'Online',
  OFFLINE: 'Offline',
};

// Exam Types
const EXAM_TYPES = {
  NEW: 'Khám mới',
  FOLLOWUP: 'Tái khám',
  GENERAL: 'Khám nội tổng quát',
};

// Time Slots
const TIME_SLOTS = [
  '07:30 - 08:00',
  '08:00 - 08:30',
  '08:30 - 09:00',
  '09:00 - 09:30',
  '09:30 - 10:00',
  '10:00 - 10:30',
  '10:30 - 11:00',
  '13:30 - 14:00',
  '14:00 - 14:30',
  '14:30 - 15:00',
  '15:00 - 15:30',
  '15:30 - 16:00',
  '16:00 - 16:30',
];

// Medicine Categories
const MEDICINE_CATEGORIES = [
  'Kháng sinh',
  'Giảm đau, hạ sốt',
  'Tim mạch',
  'Tiêu hóa',
  'Hô hấp',
  'Thần kinh',
  'Vitamin & khoáng chất',
  'Hạ huyết áp',
  'Đái tháo đường',
  'Dạ dày',
  'Khác',
];

export {
  ROLES,
  ROLE_LABELS,
  APPOINTMENT_STATUS,
  MEDICAL_RECORD_STATUS,
  LAB_STATUS,
  PAYMENT_STATUS,
  PAYMENT_TYPES,
  PAYMENT_METHODS,
  INVENTORY_TRANSACTION_TYPES,
  GENDER,
  APPOINTMENT_SOURCE,
  EXAM_TYPES,
  TIME_SLOTS,
  MEDICINE_CATEGORIES,
};
