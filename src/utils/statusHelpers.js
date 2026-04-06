/**
 * Helpers to map appointment status between numeric codes and localized labels
 */
import { APPOINTMENT_STATUS } from '../config/constants.js';

// Define canonical code->label mapping (4 statuses)
const STATUS_CODE_TO_LABEL = {
  1: APPOINTMENT_STATUS.SCHEDULED || 'Đã đặt lịch',
  2: APPOINTMENT_STATUS.WAITING || 'Chờ khám',
  3: APPOINTMENT_STATUS.COMPLETED || 'Đã hoàn thành',
  4: APPOINTMENT_STATUS.CANCELLED || 'Đã hủy',
};

const STATUS_LABEL_TO_CODE = Object.entries(STATUS_CODE_TO_LABEL).reduce((acc, [k, v]) => {
  acc[v] = Number(k);
  return acc;
}, {});

// Provide aliases for other labels present in APPOINTMENT_STATUS constants
// that should map to the canonical numeric codes.
if (APPOINTMENT_STATUS) {
  if (APPOINTMENT_STATUS.CONFIRMED) STATUS_LABEL_TO_CODE[APPOINTMENT_STATUS.CONFIRMED] = 1;
  if (APPOINTMENT_STATUS.IN_PROGRESS) STATUS_LABEL_TO_CODE[APPOINTMENT_STATUS.IN_PROGRESS] = 2;
}

function codeToLabel(code) {
  if (code == null) return null;
  const n = Number(code);
  if (!Number.isNaN(n) && STATUS_CODE_TO_LABEL[n]) return STATUS_CODE_TO_LABEL[n];
  // maybe already label
  return String(code);
}

function labelToCode(label) {
  if (label == null) return null;
  const s = String(label);
  if (/^\d+$/.test(s)) return Number(s);
  if (STATUS_LABEL_TO_CODE[s]) return STATUS_LABEL_TO_CODE[s];
  // Unknown label -> return null
  return null;
}

function normalizeStatus(raw) {
  // raw may be number or label
  if (raw == null) return { code: null, label: null };
  if (typeof raw === 'number') return { code: raw, label: codeToLabel(raw) };
  if (typeof raw === 'string') {
    // numeric string?
    if (/^\d+$/.test(raw)) {
      const n = Number(raw);
      return { code: n, label: codeToLabel(n) };
    }
    // label string
    const code = labelToCode(raw);
    return { code: code || null, label: code ? codeToLabel(code) : raw };
  }
  return { code: null, label: String(raw) };
}

export { STATUS_CODE_TO_LABEL, STATUS_LABEL_TO_CODE, codeToLabel, labelToCode, normalizeStatus };
