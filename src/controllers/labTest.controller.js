/**
 * Lab Test Controller
 *
 * This controller exposes the legacy /lab-tests API shape used by the frontend,
 * but stores data in the current SQL Server schema:
 * - LabOrders
 * - LabOrderItems
 * - LabResults
 * - LabServices
 */
import { Op } from 'sequelize';
import { Appointment, Patient, User, sequelize } from '../models/index.js';
import models from '../models/index.js';
import { asyncHandler, parsePagination } from '../utils/helpers.js';
import {
  successResponse,
  createdResponse,
  paginatedResponse,
  noContentResponse,
} from '../utils/response.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors.js';
import { LAB_STATUS, ROLES } from '../config/constants.js';

const LAB_ITEM_STATUS = {
  ASSIGNED: 0,
  IN_PROGRESS: 1,
  COMPLETED: 2,
  CANCELLED: 3,
};

const STATUS_CODE_TO_LABEL = {
  [LAB_ITEM_STATUS.ASSIGNED]: LAB_STATUS.PENDING || 'Da chi dinh',
  [LAB_ITEM_STATUS.IN_PROGRESS]: LAB_STATUS.IN_PROGRESS,
  [LAB_ITEM_STATUS.COMPLETED]: LAB_STATUS.COMPLETED,
  [LAB_ITEM_STATUS.CANCELLED]: LAB_STATUS.CANCELLED || 'Da huy',
};

const TYPE_CODE_TO_LABEL = {
  1: 'Siêu âm',
  2: 'Điện tim',
  3: 'Xét nghiệm',
};

const TYPE_LABEL_TO_CODE = {
  'siêu âm': 1,
  'sieu am': 1,
  'ultrasound': 1,
  'điện tim': 2,
  'dien tim': 2,
  'ecg': 2,
  'electrocardiogram': 2,
  'xét nghiệm': 3,
  'xet nghiem': 3,
  'lab': 3,
  'lab test': 3,
};

const LAB_NOTE_META_KEYS = [
  'notes',
  'normalRange',
  'cancelReason',
  'canceledBy',
  'canceledAt',
  'confirmedBy',
  'confirmedAt',
];

const getLabModels = () => {
  const LabOrder = models.LabOrder;
  const LabOrderItem = models.LabOrderItem;
  const LabResult = models.LabResult;
  const LabService = models.LabService;
  const MedicalExamination = models.MedicalExamination;

  if (!LabOrder || !LabOrderItem || !LabResult || !LabService || !MedicalExamination) {
    throw new Error('Lab modules are not initialized correctly (LabOrder/LabOrderItem/LabResult/LabService/MedicalExamination).');
  }

  return { LabOrder, LabOrderItem, LabResult, LabService, MedicalExamination };
};

const toPositiveInt = (value, { allowAppointmentPrefix = false } = {}) => {
  if (value === null || value === undefined || value === '') return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const normalized = allowAppointmentPrefix && /^APT-/i.test(raw) ? raw.replace(/^APT-/i, '') : raw;
  if (!/^\d+$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const mapTypeToCode = (value) => {
  if (value === null || value === undefined || value === '') return 3;
  if (typeof value === 'number' && [1, 2, 3].includes(value)) return value;
  const normalized = normalizeText(value);
  if (TYPE_LABEL_TO_CODE[normalized]) return TYPE_LABEL_TO_CODE[normalized];
  if (normalized.includes('siêu') || normalized.includes('sieu') || normalized.includes('ultra')) return 1;
  if (normalized.includes('điện') || normalized.includes('dien') || normalized.includes('ecg') || normalized.includes('stress')) return 2;
  return 3;
};

const mapTypeToLabel = (value) => {
  const code = typeof value === 'number' ? value : mapTypeToCode(value);
  return TYPE_CODE_TO_LABEL[code] || TYPE_CODE_TO_LABEL[3];
};

const mapStatusToCode = (value, fallback = LAB_ITEM_STATUS.ASSIGNED) => {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'number' && [0, 1, 2, 3].includes(value)) return value;
  if (Number(value) === 4) return LAB_ITEM_STATUS.CANCELLED;
  const text = normalizeText(value);
  // Accept UI shorthand 'x' or multiplication sign '×' as cancel
  if (text === 'x' || text === '×') return LAB_ITEM_STATUS.CANCELLED;
  if (/^[0-3]$/.test(text)) return Number(text);
  if (text === '4') return LAB_ITEM_STATUS.CANCELLED;
  if (text.includes('huy') || text.includes('cancel')) return LAB_ITEM_STATUS.CANCELLED;
  if (text.includes('hoan') || text.includes('complete')) return LAB_ITEM_STATUS.COMPLETED;
  if (text.includes('dang') || text.includes('progress') || text.includes('processing')) return LAB_ITEM_STATUS.IN_PROGRESS;
  if (text.includes('cho') || text.includes('pending') || text.includes('wait') || text.includes('chi dinh') || text.includes('dang cho')) return LAB_ITEM_STATUS.ASSIGNED;
  return fallback;
};

const mapStatusToLabel = (value) => {
  const code = mapStatusToCode(value, LAB_ITEM_STATUS.ASSIGNED);
  return STATUS_CODE_TO_LABEL[code] || LAB_STATUS.PENDING;
};

// Safely parse date-like inputs into Date objects; return null for invalid values
const parseDateSafe = (value) => {
  if (value === null || value === undefined || value === '') return null;
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d;
  } catch (e) {
    return null;
  }
};

const parseImages = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value !== 'string') return [];
  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
    if (parsed && typeof parsed === 'string') return [parsed];
    return [];
  } catch {
    return [trimmed];
  }
};

const serializeImages = (images, fallbackImageUrl = null) => {
  const list = Array.isArray(images) ? images.filter(Boolean) : [];
  if (list.length > 1) return JSON.stringify(list);
  if (list.length === 1) return String(list[0]);
  return fallbackImageUrl || null;
};

const parseMetaNote = (noteValue) => {
  if (!noteValue) return {};
  if (typeof noteValue !== 'string') return {};
  const trimmed = noteValue.trim();
  if (!trimmed) return {};
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      // fall through to plain note
    }
  }
  return { notes: trimmed };
};

const buildMetaNote = (existingRaw, patch = {}) => {
  const base = parseMetaNote(existingRaw);
  const merged = { ...base };
  LAB_NOTE_META_KEYS.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(patch, key)) {
      merged[key] = patch[key];
    }
  });

  Object.keys(merged).forEach((key) => {
    if (merged[key] === undefined || merged[key] === null || merged[key] === '') delete merged[key];
  });

  if (Object.keys(merged).length === 0) return null;
  if (Object.keys(merged).length === 1 && Object.prototype.hasOwnProperty.call(merged, 'notes')) {
    return String(merged.notes);
  }
  return JSON.stringify(merged);
};

const parseSortParam = (sort) => {
  const raw = String(sort || 'orderedDate:desc').trim();
  const [fieldRaw, dirRaw] = raw.split(':');
  const field = String(fieldRaw || 'orderedDate').trim();
  const dir = String(dirRaw || 'desc').trim().toLowerCase() === 'asc' ? 'asc' : 'desc';
  return { field, dir };
};

const parseDateParamSafe = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const raw = String(value).trim();
  if (!raw) return null;

  // Try native parse first (ISO, timestamps)
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return d;

  // Try dd/MM/YYYY or d/M/YYYY (common frontend format)
  const m = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const day = m[1].padStart(2, '0');
    const month = m[2].padStart(2, '0');
    const year = m[3];
    const iso = `${year}-${month}-${day}T00:00:00.000Z`;
    const d2 = new Date(iso);
    if (!Number.isNaN(d2.getTime())) return d2;
  }

  // Try YYYY-MM-DD (no time)
  const m2 = raw.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m2) {
    const iso = `${m2[1]}-${m2[2].padStart(2, '0')}-${m2[3].padStart(2, '0')}T00:00:00.000Z`;
    const d3 = new Date(iso);
    if (!Number.isNaN(d3.getTime())) return d3;
  }

  return null;
};

const toMSSQLDateTime = (date) => {
  if (!date || !(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const pad = (n) => String(n).padStart(2, '0');
  const year = date.getUTCFullYear();
  const month = pad(date.getUTCMonth() + 1);
  const day = pad(date.getUTCDate());
  const hours = pad(date.getUTCHours());
  const mins = pad(date.getUTCMinutes());
  const secs = pad(date.getUTCSeconds());
  const ms = String(date.getUTCMilliseconds()).padStart(3, '0');
  return `${year}-${month}-${day} ${hours}:${mins}:${secs}.${ms}`;
};

const ensureMutatePermission = (user, doctorIdFromOrder) => {
  const role = String(user?.role || '').toLowerCase();
  if (role === String(ROLES.ADMIN)) return;

  if (role === String(ROLES.DOCTOR)) {
    const current = toPositiveInt(user?.id);
    const owner = toPositiveInt(doctorIdFromOrder);
    if (current && owner && current === owner) return;
  }

  throw new ForbiddenError('Ban khong co quyen thuc hien hanh dong nay', 'INSUFFICIENT_PERMISSIONS');
};

const ensureLabService = async ({ testName, testType, roomId = null }) => {
  const { LabService } = getLabModels();

  const normalizedName = String(testName || '').trim();
  if (!normalizedName) {
    throw new BadRequestError('Ten xet nghiem khong duoc de trong');
  }

  let service = await LabService.findOne({ where: { ServiceName: normalizedName } });
  if (service) return service;

  const servicePayload = {
    ServiceName: normalizedName,
    RoomID: toPositiveInt(roomId),
    Price: 0,
    ServiceType: mapTypeToCode(testType),
    IsActive: true,
    CreatedAt: sequelize.literal('GETDATE()'),
  };

  try {
    // log payload types for debugging date conversion issues
    console.debug('ensureLabService: creating LabService with payload', Object.fromEntries(Object.entries(servicePayload).map(([k,v])=>[k, { value: v, type: Object.prototype.toString.call(v) }] )));
    service = await LabService.create(servicePayload);
  } catch (err) {
    console.error('ensureLabService: LabService.create failed', { payload: servicePayload, error: err && err.message });
    throw err;
  }

  return service;
};

const resolveOrCreateExamination = async ({
  medicalRecordId,
  appointmentId,
  patientId,
  doctorId,
  symptoms,
}) => {
  const { MedicalExamination } = getLabModels();

  const recordText = String(medicalRecordId || '').trim();
  let resolvedAppointmentId = toPositiveInt(appointmentId, { allowAppointmentPrefix: true });
  let examination = null;

  const recordNumeric = toPositiveInt(recordText, { allowAppointmentPrefix: true });
  if (recordNumeric) {
    examination = await MedicalExamination.findByPk(recordNumeric);
    if (!examination && !resolvedAppointmentId) {
      resolvedAppointmentId = recordNumeric;
    }
  }

  if (!examination && /^APT-/i.test(recordText)) {
    resolvedAppointmentId = toPositiveInt(recordText, { allowAppointmentPrefix: true });
  }

  if (!examination && resolvedAppointmentId) {
    examination = await MedicalExamination.findOne({
      where: { AppointmentID: resolvedAppointmentId },
      order: [['CreatedAt', 'DESC'], ['ExaminationID', 'DESC']],
    });
  }

  if (examination) return examination;

  if (!resolvedAppointmentId) {
    throw new BadRequestError('Khong xac dinh duoc phieu kham/lich hen de tao chi dinh can lam sang');
  }

  const appointment = await Appointment.findByPk(resolvedAppointmentId);
  if (!appointment) {
    throw new BadRequestError('Lich hen khong ton tai');
  }

  const resolvedPatientId = toPositiveInt(patientId) || toPositiveInt(appointment.patientId);
  if (!resolvedPatientId) {
    throw new BadRequestError('Khong xac dinh duoc benh nhan cho phieu kham');
  }

  const finalDoctorId = toPositiveInt(doctorId) || null;
  const newExamPayload = {
    AppointmentID: resolvedAppointmentId,
    PatientId: resolvedPatientId,
    DoctorID: finalDoctorId,
    ExaminationDate: new Date(),
    Symptoms: symptoms ? String(symptoms) : null,
  };

  return MedicalExamination.create(newExamPayload);
};

const recomputeLabOrderStatus = async (labOrderId) => {
  const { LabOrder, LabOrderItem } = getLabModels();
  const items = await LabOrderItem.findAll({ where: { LabOrderID: labOrderId }, attributes: ['Status'] });

  if (!items || items.length === 0) {
    await LabOrder.update({ Status: LAB_ITEM_STATUS.CANCELLED }, { where: { LabOrderID: labOrderId } });
    return;
  }

  const statuses = items.map((it) => Number(it.Status));
  let next = LAB_ITEM_STATUS.ASSIGNED;

  if (statuses.every((s) => s === LAB_ITEM_STATUS.CANCELLED)) {
    next = LAB_ITEM_STATUS.CANCELLED;
  } else if (statuses.some((s) => s === LAB_ITEM_STATUS.IN_PROGRESS)) {
    next = LAB_ITEM_STATUS.IN_PROGRESS;
  } else if (statuses.some((s) => s === LAB_ITEM_STATUS.ASSIGNED)) {
    next = LAB_ITEM_STATUS.ASSIGNED;
  } else if (statuses.some((s) => s === LAB_ITEM_STATUS.COMPLETED)) {
    next = LAB_ITEM_STATUS.COMPLETED;
  }

  await LabOrder.update({ Status: next }, { where: { LabOrderID: labOrderId } });
};

const getBaseItemIncludes = () => {
  const { LabOrder, LabService, MedicalExamination } = getLabModels();
  return [
    {
      model: LabOrder,
      as: 'LabOrder',
      required: true,
      include: [
        {
          model: MedicalExamination,
          as: 'examination',
          required: false,
        },
      ],
    },
    {
      model: LabService,
      as: 'Service',
      required: false,
    },
  ];
};

const fetchLabTestRowsByItems = async (itemsInput) => {
  const { LabResult } = getLabModels();
  const items = (itemsInput || []).map((it) => (it?.get ? it.get({ plain: true }) : it));
  if (items.length === 0) return [];

  const examIds = [];
  const serviceIds = [];
  const patientIds = [];
  const appointmentIds = [];
  const doctorIds = [];

  items.forEach((item) => {
    const order = item?.LabOrder || {};
    const exam = order?.examination || {};
    const service = item?.Service || {};

    if (order.ExaminationID) examIds.push(order.ExaminationID);
    if (item.ServiceID) serviceIds.push(item.ServiceID);
    if (exam.PatientId) patientIds.push(exam.PatientId);
    if (exam.AppointmentID) appointmentIds.push(exam.AppointmentID);
    if (order.DoctorID) doctorIds.push(order.DoctorID);
  });

  const uniq = (arr) => [...new Set(arr.map((x) => String(x)))].map((x) => Number(x)).filter((x) => Number.isFinite(x));

  const uniqueExamIds = uniq(examIds);
  const uniqueServiceIds = uniq(serviceIds);
  const uniquePatientIds = uniq(patientIds);
  const uniqueAppointmentIds = uniq(appointmentIds);

  const resultRows = uniqueExamIds.length > 0 && uniqueServiceIds.length > 0
    ? await LabResult.findAll({
      where: {
        ExaminationID: { [Op.in]: uniqueExamIds },
        ServiceID: { [Op.in]: uniqueServiceIds },
      },
      order: [['ResultDate', 'DESC'], ['UpdatedAt', 'DESC'], ['CreatedAt', 'DESC'], ['LabResultID', 'DESC']],
    })
    : [];

  const resultByPair = new Map();
  resultRows.forEach((row) => {
    const plain = row.get ? row.get({ plain: true }) : row;
    const key = `${plain.ExaminationID}::${plain.ServiceID}`;
    if (!resultByPair.has(key)) resultByPair.set(key, plain);
  });

  const patientRows = uniquePatientIds.length > 0
    ? await Patient.findAll({ where: { id: { [Op.in]: uniquePatientIds } } })
    : [];
  const patientMap = new Map(patientRows.map((p) => {
    const plain = p.get ? p.get({ plain: true }) : p;
    return [String(plain.id), plain];
  }));

  const appointmentRows = uniqueAppointmentIds.length > 0
    ? await Appointment.findAll({ where: { id: { [Op.in]: uniqueAppointmentIds } } })
    : [];
  const appointmentMap = new Map(appointmentRows.map((a) => {
    const plain = a.get ? a.get({ plain: true }) : a;
    return [String(plain.id), plain];
  }));

  const resultDoctorIds = resultRows
    .map((r) => (r?.DoctorID ?? (r?.get ? r.get('DoctorID') : null)))
    .filter((v) => v !== null && v !== undefined);
  const uniqueDoctorIds = uniq([...doctorIds, ...resultDoctorIds]);
  const doctorRows = uniqueDoctorIds.length > 0
    ? await User.findAll({ where: { id: { [Op.in]: uniqueDoctorIds } }, paranoid: false })
    : [];
  const doctorMap = new Map(doctorRows.map((d) => {
    const plain = d.get ? d.get({ plain: true }) : d;
    return [String(plain.id), plain];
  }));

  return items.map((item) => {
    const order = item?.LabOrder || {};
    const exam = order?.examination || {};
    const service = item?.Service || {};
    const patient = patientMap.get(String(exam.PatientId || '')) || {};
    const appointment = appointmentMap.get(String(exam.AppointmentID || '')) || {};
    const result = resultByPair.get(`${order.ExaminationID}::${item.ServiceID}`) || null;

    const itemMeta = parseMetaNote(item?.Note);
    const resultMeta = parseMetaNote(result?.Note);
    const meta = { ...itemMeta, ...resultMeta };

    const images = parseImages(result?.ImageUrl);
    const doctorOrder = doctorMap.get(String(order.DoctorID || '')) || null;
    const doctorResult = doctorMap.get(String(result?.DoctorID || '')) || null;

    const orderedDate = item?.CreatedAt || order?.CreatedAt || null;
    const resultDate = result?.ResultDate || null;

    return {
      id: item.LabOrderItemID,
      testId: item.LabOrderItemID,
      labOrderId: item.LabOrderID,
      serviceId: item.ServiceID,
      medicalRecordId: order.ExaminationID,
      recordId: order.ExaminationID,
      appointmentId: exam.AppointmentID || null,

      patientId: exam.PatientId || null,
      patientName: appointment.patientName || patient.fullName || '',
      patientPhone: appointment.patientPhone || patient.phone || '',
      patientDob: appointment.patientBirthDate || patient.dateOfBirth || null,
      gender: appointment.patientGender || patient.gender || '',

      testType: mapTypeToLabel(service.ServiceType),
      room: mapTypeToLabel(service.ServiceType),
      testName: service.ServiceName || '',
      status: mapStatusToLabel(item.Status),

      orderedBy: doctorOrder?.fullName || '',
      orderedById: order.DoctorID || null,
      orderedDate,

      results: result?.ResultText || '',
      normalRange: meta.normalRange || '',
      notes: meta.notes || '',
      conclusion: result?.Conclusion || '',
      images,
      imageUrl: images[0] || null,
      resultDate,
      confirmedBy: meta.confirmedBy || doctorResult?.fullName || null,
      confirmedAt: meta.confirmedAt || null,
      cancelReason: meta.cancelReason || '',
      canceledBy: meta.canceledBy || null,
      canceledAt: meta.canceledAt || null,

      createdOnServer: true,
    };
  });
};

const fetchSingleLabTestRow = async (itemId) => {
  const { LabOrderItem } = getLabModels();
  const item = await LabOrderItem.findByPk(itemId, {
    include: getBaseItemIncludes(),
  });
  if (!item) return null;
  const rows = await fetchLabTestRowsByItems([item]);
  return rows[0] || null;
};

/**
 * Get all lab tests (with pagination and filters)
 * GET /api/lab-tests
 */
const getAllLabTests = asyncHandler(async (req, res) => {
  const { LabOrderItem } = getLabModels();
  const { page, limit, offset } = parsePagination(req.query);
  const { status, patientId, medicalRecordId, fromDate, toDate, search, sort } = req.query;

  const where = {};
  if (status !== undefined && status !== null && status !== '') {
    where.Status = mapStatusToCode(status, LAB_ITEM_STATUS.PENDING);
  }

  if (fromDate || toDate) {
    const parsedFrom = parseDateParamSafe(fromDate);
    const parsedTo = parseDateParamSafe(toDate);
    if (parsedFrom || parsedTo) {
      console.debug('Date filters parsed', { fromDate, toDate, parsedFrom, parsedTo });
    } else {
      console.warn('Skipping DB date filter due to unparseable input', { query: req.query, fromDate, toDate });
    }
  }

  const include = getBaseItemIncludes();
  const parsedRecordId = toPositiveInt(medicalRecordId, { allowAppointmentPrefix: true });
  if (parsedRecordId) {
    include[0].where = { ExaminationID: parsedRecordId };
  }

  const items = await LabOrderItem.findAll({
    where,
    include,
    order: [['CreatedAt', 'DESC'], ['LabOrderItemID', 'DESC']],
  });

  let rows = await fetchLabTestRowsByItems(items);

  // Filter by date range in memory
  if (fromDate || toDate) {
    const parsedFrom = parseDateParamSafe(fromDate);
    const parsedTo = parseDateParamSafe(toDate);
    if (parsedFrom || parsedTo) {
      rows = rows.filter((row) => {
        const rowDate = row.orderedDate ? new Date(row.orderedDate).getTime() : 0;
        if (parsedFrom) {
          parsedFrom.setHours(0, 0, 0, 0);
          if (rowDate < parsedFrom.getTime()) return false;
        }
        if (parsedTo) {
          parsedTo.setHours(23, 59, 59, 999);
          if (rowDate > parsedTo.getTime()) return false;
        }
        return true;
      });
    }
  }

  if (patientId !== undefined && patientId !== null && patientId !== '') {
    const pid = String(patientId);
    rows = rows.filter((row) => String(row.patientId || '') === pid);
  }

  if (search) {
    const kw = normalizeText(search);
    rows = rows.filter((row) => {
      const haystack = [
        row.testName,
        row.patientName,
        row.id,
        row.medicalRecordId,
        row.appointmentId,
      ].map((x) => normalizeText(x)).join(' ');
      return haystack.includes(kw);
    });
  }

  const { field, dir } = parseSortParam(sort);
  rows.sort((a, b) => {
    const factor = dir === 'asc' ? 1 : -1;
    let av;
    let bv;

    if (field === 'status') {
      av = mapStatusToCode(a.status);
      bv = mapStatusToCode(b.status);
    } else if (field === 'testName') {
      av = String(a.testName || '').toLowerCase();
      bv = String(b.testName || '').toLowerCase();
    } else {
      av = new Date(a.orderedDate || 0).getTime();
      bv = new Date(b.orderedDate || 0).getTime();
    }

    if (av < bv) return -1 * factor;
    if (av > bv) return 1 * factor;
    return 0;
  });

  const total = rows.length;
  const paged = rows.slice(offset, offset + limit);

  return paginatedResponse(res, {
    data: paged,
    page,
    limit,
    total,
  });
});

/**
 * Get lab test by ID
 * GET /api/lab-tests/:id
 */
const getLabTestById = asyncHandler(async (req, res) => {
  const itemId = toPositiveInt(req.params.id);
  if (!itemId) throw new NotFoundError('Khong tim thay xet nghiem');

  const row = await fetchSingleLabTestRow(itemId);
  if (!row) throw new NotFoundError('Khong tim thay xet nghiem');

  return successResponse(res, row);
});

/**
 * Create new lab test
 * POST /api/lab-tests
 */
const createLabTest = asyncHandler(async (req, res) => {
  const { LabOrder, LabOrderItem } = getLabModels();

  const {
    patientId,
    patientName,
    testType,
    testName,
    medicalRecordId,
    appointmentId,
    notes,
    status,
    room,
    roomId,
    symptoms,
  } = req.body || {};

  const resolvedPatientId = toPositiveInt(patientId);
  if (!resolvedPatientId) {
    throw new BadRequestError('ID benh nhan khong hop le');
  }

  const doctorId = toPositiveInt(req.user?.id);
  if (!doctorId) {
    throw new BadRequestError('Khong xac dinh duoc bac si chi dinh');
  }

  const examination = await resolveOrCreateExamination({
    medicalRecordId,
    appointmentId,
    patientId: resolvedPatientId,
    doctorId,
    symptoms,
  });

  const service = await ensureLabService({
    testName,
    testType: testType || room,
    roomId,
  });

  // Resolve RoomID from provided roomId or fallback to the LabService.RoomID
  const resolvedRoomId = toPositiveInt(roomId) || toPositiveInt(service?.RoomID) || null;

  const orderWhere = {
    ExaminationID: examination.ExaminationID,
    DoctorID: doctorId,
  };

  let labOrder = await LabOrder.findOne({
    where: orderWhere,
    order: [['CreatedAt', 'DESC'], ['LabOrderID', 'DESC']],
  });

  if (!labOrder) {
    labOrder = await LabOrder.create({
      ExaminationID: examination.ExaminationID,
      DoctorID: doctorId,
      Status: LAB_ITEM_STATUS.ASSIGNED,
      CreatedAt: sequelize.literal('GETDATE()'),
    });
  }

  const noteValue = buildMetaNote(null, {
    notes: notes || null,
  });

  // Avoid creating duplicate LabOrderItems for the same LabOrder + Service combination.
  // If an item already exists, update its metadata/status instead of creating a new row
  // so the `LabOrderItemID` remains stable across edits.
  let createdItem = await LabOrderItem.findOne({
    where: {
      LabOrderID: labOrder.LabOrderID,
      ServiceID: service.ServiceID,
    },
  });

  if (createdItem) {
    const patch = {};
    const statusCode = mapStatusToCode(status, Number(createdItem.Status) || LAB_ITEM_STATUS.ASSIGNED);
    if (statusCode !== Number(createdItem.Status)) patch.Status = statusCode;
    if (noteValue !== undefined && noteValue !== null && String(noteValue).trim() !== String(createdItem.Note || '').trim()) patch.Note = noteValue;
    // Keep RoomID in sync with LabService when missing or different
    if (resolvedRoomId !== null && Number(createdItem.RoomID) !== Number(resolvedRoomId)) {
      patch.RoomID = resolvedRoomId;
    }
    if (Object.keys(patch).length > 0) {
      await createdItem.update(patch);
    }
  } else {
    createdItem = await LabOrderItem.create({
      LabOrderID: labOrder.LabOrderID,
      ServiceID: service.ServiceID,
      RoomID: resolvedRoomId,
      Status: mapStatusToCode(status, LAB_ITEM_STATUS.ASSIGNED),
      Priority: 0,
      Note: noteValue,
      CreatedAt: sequelize.literal('GETDATE()'),
    });
  }

  await recomputeLabOrderStatus(labOrder.LabOrderID);

  const createdRow = await fetchSingleLabTestRow(createdItem.LabOrderItemID);

  // Guarantee snapshot fields even when Patient/Appointment enrichment is missing
  if (createdRow && !createdRow.patientName && patientName) {
    createdRow.patientName = patientName;
  }

  return createdResponse(res, createdRow || { id: createdItem.LabOrderItemID }, 'Tao chi dinh can lam sang thanh cong');
});

/**
 * Update lab test
 * PUT /api/lab-tests/:id
 */
const updateLabTestCore = async ({ itemId, payload = {}, user }) => {
  const { LabOrderItem, LabResult } = getLabModels();
  if (!itemId) throw new NotFoundError('Khong tim thay xet nghiem');

  const item = await LabOrderItem.findByPk(itemId, { include: getBaseItemIncludes() });
  if (!item) throw new NotFoundError('Khong tim thay xet nghiem');

  const order = item.LabOrder;
  ensureMutatePermission(user, order?.DoctorID);

  const itemUpdates = {};

  if (Object.prototype.hasOwnProperty.call(payload, 'status')) {
    const statusCode = mapStatusToCode(payload.status, Number(item.Status) || LAB_ITEM_STATUS.ASSIGNED);
    // Enforce: cancellation only allowed when current status is ASSIGNED
    if (statusCode === LAB_ITEM_STATUS.CANCELLED && Number(item.Status) !== LAB_ITEM_STATUS.ASSIGNED) {
      throw new BadRequestError('Chi co the huy chi dinh khi trang thai la "da chi dinh"', 'INVALID_CANCEL');
    }
    itemUpdates.Status = statusCode;
  }

  const itemMetaPatch = {
    cancelReason: payload.cancelReason,
    canceledBy: payload.canceledBy,
    canceledAt: payload.canceledAt,
  };

  if (Object.values(itemMetaPatch).some((v) => v !== undefined)) {
    itemUpdates.Note = buildMetaNote(item.Note, itemMetaPatch);
  }

  if (Object.keys(itemUpdates).length > 0) {
    await item.update(itemUpdates);
  }

  const hasResultPayload = [
    'results',
    'resultText',
    'normalRange',
    'notes',
    'conclusion',
    'images',
    'imageUrl',
    'resultDate',
    'confirmedBy',
    'confirmedAt',
  ].some((key) => Object.prototype.hasOwnProperty.call(payload, key));

  if (hasResultPayload) {
    const existing = await LabResult.findOne({
      where: {
        ExaminationID: order.ExaminationID,
        ServiceID: item.ServiceID,
      },
      order: [['ResultDate', 'DESC'], ['UpdatedAt', 'DESC'], ['LabResultID', 'DESC']],
    });

    const resultText = payload.results ?? payload.resultText;
    const imagesInput = payload.images ?? (payload.imageUrl ? [payload.imageUrl] : undefined);
    const nextImageUrl = imagesInput !== undefined ? serializeImages(imagesInput) : undefined;
    const noteValue = buildMetaNote(existing?.Note, {
      notes: payload.notes,
      normalRange: payload.normalRange,
      cancelReason: payload.cancelReason,
      canceledBy: payload.canceledBy,
      canceledAt: payload.canceledAt,
      confirmedBy: payload.confirmedBy,
      confirmedAt: payload.confirmedAt,
    });

    if (existing) {
      const resultUpdates = {
        UpdatedAt: new Date(),
      };

      if (resultText !== undefined) {
        resultUpdates.ResultText = resultText || existing.ResultText || '-';
      }
      if (payload.conclusion !== undefined) {
        resultUpdates.Conclusion = payload.conclusion || null;
      }
      if (noteValue !== undefined) {
        resultUpdates.Note = noteValue;
      }
      if (nextImageUrl !== undefined) {
        resultUpdates.ImageUrl = nextImageUrl;
      }
      if (payload.resultDate) {
        const parsed = parseDateParamSafe(payload.resultDate);
        resultUpdates.ResultDate = parsed || new Date(payload.resultDate);
      } else if (resultText !== undefined || payload.conclusion !== undefined || nextImageUrl !== undefined) {
        resultUpdates.ResultDate = existing.ResultDate || new Date();
      }

      await existing.update(resultUpdates);
    } else if (
      resultText !== undefined ||
      payload.conclusion !== undefined ||
      payload.notes !== undefined ||
      payload.normalRange !== undefined ||
      nextImageUrl !== undefined
    ) {
      await LabResult.create({
        ExaminationID: order.ExaminationID,
        ServiceID: item.ServiceID,
        ResultText: (resultText || '-').toString(),
        ImageUrl: nextImageUrl || null,
        Conclusion: payload.conclusion || null,
        Note: noteValue,
        DoctorID: toPositiveInt(user?.id) || order.DoctorID,
        ResultDate: payload.resultDate ? (parseDateParamSafe(payload.resultDate) || new Date(payload.resultDate)) : new Date(),
        CreatedAt: new Date(),
        UpdatedAt: new Date(),
      });
    }
  }

  await recomputeLabOrderStatus(order.LabOrderID);
  return fetchSingleLabTestRow(itemId);
};

const updateLabTest = asyncHandler(async (req, res) => {
  const itemId = toPositiveInt(req.params.id);
  const row = await updateLabTestCore({ itemId, payload: req.body || {}, user: req.user });
  return successResponse(res, row, 'Cap nhat xet nghiem thanh cong');
});

/**
 * Start lab test (set to in progress)
 * POST /api/lab-tests/:id/start
 */
const startLabTest = asyncHandler(async (req, res) => {
  const { LabOrderItem } = getLabModels();
  const itemId = toPositiveInt(req.params.id);
  if (!itemId) throw new NotFoundError('Khong tim thay xet nghiem');

  const item = await LabOrderItem.findByPk(itemId, { include: getBaseItemIncludes() });
  if (!item) throw new NotFoundError('Khong tim thay xet nghiem');

  ensureMutatePermission(req.user, item?.LabOrder?.DoctorID);

  if (Number(item.Status) === LAB_ITEM_STATUS.CANCELLED) {
    throw new BadRequestError('Khong the bat dau lai xet nghiem da huy');
  }

  await item.update({ Status: LAB_ITEM_STATUS.IN_PROGRESS });
  await recomputeLabOrderStatus(item.LabOrderID);

  const row = await fetchSingleLabTestRow(itemId);
  return successResponse(res, row, 'Bat dau xet nghiem thanh cong');
});

/**
 * Complete lab test with results (save results, keep workflow in-progress)
 * POST /api/lab-tests/:id/complete
 */
const completeLabTest = asyncHandler(async (req, res) => {
  const { results, normalRange, notes, conclusion, images } = req.body || {};
  if (!results) {
    throw new BadRequestError('Ket qua khong duoc de trong');
  }

  const itemId = toPositiveInt(req.params.id);
  const payload = {
    status: LAB_ITEM_STATUS.IN_PROGRESS,
    results,
    normalRange,
    notes,
    conclusion,
    images,
    resultDate: new Date().toISOString(),
  };

  const row = await updateLabTestCore({ itemId, payload, user: req.user });
  return successResponse(res, row, 'Luu ket qua xet nghiem thanh cong');
});

/**
 * Return lab test (mark completed and attach confirmer)
 * POST /api/lab-tests/:id/return
 */
const returnLabTest = asyncHandler(async (req, res) => {
  const { LabOrderItem, LabResult } = getLabModels();
  const itemId = toPositiveInt(req.params.id);
  if (!itemId) throw new NotFoundError('Khong tim thay xet nghiem');

  const item = await LabOrderItem.findByPk(itemId, { include: getBaseItemIncludes() });
  if (!item) throw new NotFoundError('Khong tim thay xet nghiem');

  ensureMutatePermission(req.user, item?.LabOrder?.DoctorID);

  const nowIso = new Date().toISOString();
  await item.update({ Status: LAB_ITEM_STATUS.COMPLETED });

  const existing = await LabResult.findOne({
    where: {
      ExaminationID: item.LabOrder.ExaminationID,
      ServiceID: item.ServiceID,
    },
    order: [['ResultDate', 'DESC'], ['UpdatedAt', 'DESC'], ['LabResultID', 'DESC']],
  });

  if (existing) {
    const noteValue = buildMetaNote(existing.Note, {
      confirmedBy: req.user?.fullName || null,
      confirmedAt: nowIso,
    });
    await existing.update({
      Note: noteValue,
      ResultDate: existing.ResultDate || new Date(nowIso),
      UpdatedAt: new Date(nowIso),
      DoctorID: toPositiveInt(req.user?.id) || existing.DoctorID,
    });
  } else {
    await LabResult.create({
      ExaminationID: item.LabOrder.ExaminationID,
      ServiceID: item.ServiceID,
      ResultText: '-',
      ImageUrl: null,
      Conclusion: null,
      Note: buildMetaNote(null, {
        confirmedBy: req.user?.fullName || null,
        confirmedAt: nowIso,
      }),
      DoctorID: toPositiveInt(req.user?.id) || item.LabOrder.DoctorID,
      ResultDate: new Date(nowIso),
      CreatedAt: new Date(nowIso),
      UpdatedAt: new Date(nowIso),
    });
  }

  await recomputeLabOrderStatus(item.LabOrderID);
  const row = await fetchSingleLabTestRow(itemId);

  return successResponse(
    res,
    {
      id: itemId,
      returned: true,
      returnedBy: req.user?.fullName || null,
      labTest: row,
      legacyResults: null,
    },
    'Da tra ket qua'
  );
});

/**
 * Cancel lab test (soft delete via Status = CANCELLED)
 * DELETE /api/lab-tests/:id
 */
const deleteLabTestCore = async ({ itemId, user }) => {
  const { LabOrderItem } = getLabModels();
  if (!itemId) throw new NotFoundError('Khong tim thay xet nghiem');

  const item = await LabOrderItem.findByPk(itemId, { include: getBaseItemIncludes() });
  if (!item) throw new NotFoundError('Khong tim thay xet nghiem');

  ensureMutatePermission(user, item?.LabOrder?.DoctorID);

  const noteValue = buildMetaNote(item.Note, {
    cancelReason: 'Cancelled by delete action',
    canceledBy: user?.fullName || null,
    canceledAt: new Date().toISOString(),
  });

  await item.update({
    Status: LAB_ITEM_STATUS.CANCELLED,
    Note: noteValue,
  });

  await recomputeLabOrderStatus(item.LabOrderID);

  return true;
};

const deleteLabTest = asyncHandler(async (req, res) => {
  const itemId = toPositiveInt(req.params.id);
  await deleteLabTestCore({ itemId, user: req.user });

  return noContentResponse(res);
});

/**
 * Get pending lab tests
 * GET /api/lab-tests/pending
 */
const getPendingLabTests = asyncHandler(async (req, res) => {
  const { LabOrderItem } = getLabModels();
  const items = await LabOrderItem.findAll({
    where: {
      Status: {
        [Op.in]: [LAB_ITEM_STATUS.ASSIGNED, LAB_ITEM_STATUS.IN_PROGRESS],
      },
    },
    include: getBaseItemIncludes(),
    order: [['CreatedAt', 'ASC'], ['LabOrderItemID', 'ASC']],
  });

  const rows = await fetchLabTestRowsByItems(items);
  return successResponse(res, rows);
});

/**
 * Batch delete lab tests
 * POST /api/lab-tests/batch-delete
 */
const batchDeleteLabTests = asyncHandler(async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (ids.length === 0) throw new BadRequestError('ids la mang cac id can xoa');

  const results = [];
  for (const id of ids) {
    try {
      await deleteLabTestCore({ itemId: toPositiveInt(id), user: req.user });
      results.push({ id, ok: true, status: 'cancelled' });
    } catch (error) {
      results.push({ id, ok: false, status: 'error', message: error?.message || 'unknown error' });
    }
  }

  const failed = results.filter((r) => !r.ok).length;
  return successResponse(res, { total: ids.length, failed, results }, 'Ket qua huy hang loat');
});

const mapLabServiceResponse = (service) => {
  const plain = service?.get ? service.get({ plain: true }) : service;
  return {
    id: plain.ServiceID,
    serviceId: plain.ServiceID,
    name: plain.ServiceName,
    type: mapTypeToLabel(plain.ServiceType),
    typeCode: plain.ServiceType,
    roomId: plain.RoomID,
    price: plain.Price,
    isActive: Boolean(plain.IsActive),
    createdAt: plain.CreatedAt,
  };
};

/**
 * Get lab services catalog
 * GET /api/lab-services
 */
const getLabServices = asyncHandler(async (req, res) => {
  const { LabService } = getLabModels();
  const { type, search, isActive = 'true' } = req.query;

  const where = {};
  if (isActive !== undefined && isActive !== null && isActive !== '') {
    where.IsActive = String(isActive) === 'true';
  }
  if (type) {
    where.ServiceType = mapTypeToCode(type);
  }
  if (search) {
    where.ServiceName = { [Op.like]: `%${String(search).trim()}%` };
  }

  const services = await LabService.findAll({
    where,
    order: [['ServiceType', 'ASC'], ['ServiceName', 'ASC']],
  });

  return successResponse(res, services.map(mapLabServiceResponse));
});

/**
 * Create lab service
 * POST /api/lab-services
 */
const createLabService = asyncHandler(async (req, res) => {
  const { LabService } = getLabModels();
  const { name, type, price = 0, roomId = null, isActive = true } = req.body || {};

  if (!name || !String(name).trim()) {
    throw new BadRequestError('Ten dich vu khong duoc de trong');
  }

  const service = await LabService.create({
    ServiceName: String(name).trim(),
    ServiceType: mapTypeToCode(type),
    RoomID: toPositiveInt(roomId),
    Price: Number(price) || 0,
    IsActive: Boolean(isActive),
    CreatedAt: sequelize.literal('GETDATE()'),
  });

  return createdResponse(res, mapLabServiceResponse(service), 'Tao dich vu can lam sang thanh cong');
});

/**
 * Update lab service
 * PUT /api/lab-services/:id
 */
const updateLabService = asyncHandler(async (req, res) => {
  const { LabService } = getLabModels();
  const serviceId = toPositiveInt(req.params.id);
  if (!serviceId) throw new NotFoundError('Khong tim thay dich vu');

  const service = await LabService.findByPk(serviceId);
  if (!service) throw new NotFoundError('Khong tim thay dich vu');

  const payload = req.body || {};
  const updates = {};
  if (Object.prototype.hasOwnProperty.call(payload, 'name')) updates.ServiceName = String(payload.name || '').trim();
  if (Object.prototype.hasOwnProperty.call(payload, 'type')) updates.ServiceType = mapTypeToCode(payload.type);
  if (Object.prototype.hasOwnProperty.call(payload, 'price')) updates.Price = Number(payload.price) || 0;
  if (Object.prototype.hasOwnProperty.call(payload, 'roomId')) updates.RoomID = toPositiveInt(payload.roomId);
  if (Object.prototype.hasOwnProperty.call(payload, 'isActive')) updates.IsActive = Boolean(payload.isActive);

  await service.update(updates);
  return successResponse(res, mapLabServiceResponse(service), 'Cap nhat dich vu thanh cong');
});

export {
  getAllLabTests,
  getLabTestById,
  createLabTest,
  updateLabTest,
  startLabTest,
  completeLabTest,
  returnLabTest,
  deleteLabTest,
  batchDeleteLabTests,
  getPendingLabTests,
  getLabServices,
  createLabService,
  updateLabService,
};
