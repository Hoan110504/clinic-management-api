/**
 * Application Constants
 * Centralized constant definitions
 */

// User Roles (Numeric values: 1=Admin, 2=Doctor, 3=Receptionist, 4=Pharmacist, 5=Patient)
const ROLES = {
  ADMIN: 1,
  DOCTOR: 2,
  RECEPTIONIST: 3,
  PHARMACIST: 4,
  PATIENT: 5,
};

const ROLE_LABELS = {
  1: 'Quản trị viên',
  2: 'Bác sĩ',
  3: 'Lễ tân',
  4: 'Dược sĩ',
  5: 'Bệnh nhân',
};

// Role code prefixes (roleId -> staff code prefix)
const ROLE_PREFIXES = {
  1: 'TK',
  2: 'BS',
  3: 'LT',
  4: 'DS',
  5: 'BN',
};

// Appointment Status
const APPOINTMENT_STATUS = {
  SCHEDULED: 'Đã đặt lịch',
  CONFIRMED: 'Đã xác nhận',
  WAITING: 'Chờ khám',
  IN_PROGRESS: 'Đang khám',
  COMPLETED: 'Đã hoàn thành',
  CANCELLED: 'Đã hủy',
};

// Medical Record Status (mapped to dbo.MedicalExaminations.Status)
const MEDICAL_RECORD_STATUS = {
  WAITING: 'Chờ khám',           // Status 0: Đã tiếp nhận
  IN_PROGRESS: 'Đang khám',      // Status 1: Đang khám
  COMPLETED: 'Hoàn thành',       // Status 2: Hoàn thành
  CANCELLED: 'Đã hủy',           // Status 3: Đã hủy
};

// Lab Test Status
const LAB_STATUS = {
  PENDING: 'Chờ thực hiện',
  IN_PROGRESS: 'Đang thực hiện',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};

// Payment Status
const PAYMENT_STATUS = {
  UNPAID: 'Chưa thanh toán',
  PAID: 'Đã thanh toán',
  PARTIAL: 'Còn nợ',
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
  'Giảm đau, hạ sốt, kháng viêm',
  'Kháng sinh',
  'Hô hấp - ho - hen - viêm mũi xoang',
  'Tim mạch',
  'Thuốc tiêu hóa',
  'Nội tiết - đái tháo đường',
  'Thuốc tiết niệu - sinh dục',
  'Vitamin - khoáng chất - bổ trợ',
  'Vật tư y tế',
];

export {
  ROLES,
  ROLE_LABELS,
  ROLE_PREFIXES,
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
