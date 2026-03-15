/**
 * MedicalRecord controller - cung cấp hàng chờ khám hôm nay
 */
import { Op } from 'sequelize';
import { Appointment, Patient, User, MedicalRecord } from '../models/index.js';
import { asyncHandler } from '../utils/helpers.js';
import { successResponse, createdResponse } from '../utils/response.js';
import { APPOINTMENT_STATUS, MEDICAL_RECORD_STATUS } from '../config/constants.js';
import { parsePagination, parseSort, buildWhereClause } from '../utils/helpers.js';
import { paginatedResponse } from '../utils/response.js';

const getTodayQueue = asyncHandler(async (req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // 1) Try to load medical records that indicate waiting/in-progress for today (if model available)
  let records = [];
  try {
    if (typeof MedicalRecord !== 'undefined' && MedicalRecord && typeof MedicalRecord.findAll === 'function') {
      // look for records created today that are not completed/cancelled
      records = await MedicalRecord.findAll({
        where: {
          createdAt: { [Op.gte]: today, [Op.lt]: tomorrow },
          status: { [Op.in]: [MEDICAL_RECORD_STATUS.WAITING, MEDICAL_RECORD_STATUS.IN_PROGRESS] },
        },
        include: [
          { model: Patient, as: 'patient', required: false },
          { model: User, as: 'doctor', required: false },
        ],
        order: [['createdAt', 'ASC']],
      });
      // normalize
      records = (records || []).map(r => (r && r.get ? r.get({ plain: true }) : r));
    }
  } catch (e) {
    console.warn('medicalRecord.controller.getTodayQueue: failed to query MedicalRecord, falling back to appointments only', e?.message || e);
    records = [];
  }

  // 2) Load today's appointments (scheduled/confirmed/waiting)
  const apptWhere = {
    appointmentDate: { [Op.gte]: today, [Op.lt]: tomorrow },
    status: { [Op.notIn]: [APPOINTMENT_STATUS.CANCELLED, APPOINTMENT_STATUS.COMPLETED] },
  };
  // If doctor role, scope to that doctor
  if (req.user && req.user.role === 'doctor') {
    apptWhere.assignedDoctorId = req.user.id;
  }

  let appointments = [];
  try {
    const appts = await Appointment.findAll({
      where: apptWhere,
      include: [
        { model: Patient, as: 'patient', required: false },
        { model: User, as: 'assignedDoctor', required: false },
      ],
      order: [['timeSlot', 'ASC']],
    });
    appointments = (appts || []).map(a => (a && a.get ? a.get({ plain: true }) : a));
  } catch (e) {
    console.warn('medicalRecord.controller.getTodayQueue: failed to load Appointment rows', e?.message || e);
    appointments = [];
  }

  // 3) Merge results: prefer records when they reference an appointmentId, otherwise include appointments
  const merged = [];
  const seenApptIds = new Set();

  for (const rec of records) {
    if (rec && rec.appointmentId) seenApptIds.add(String(rec.appointmentId));
    merged.push({
      id: rec.id || rec.Id || `REC-${rec.id || ''}`,
      _source: 'record',
      appointmentRef: rec.appointmentId ? { id: rec.appointmentId } : null,
      patientId: rec.patientId || (rec.patient && rec.patient.id),
      patientName: rec.patientName || (rec.patient && (rec.patient.fullName || rec.patient.HoTen)) || null,
      purpose: rec.symptoms || rec.purpose || '',
      createdAt: rec.createdAt,
      status: rec.status,
      raw: rec,
    });
  }

  for (const a of appointments) {
    if (a && a.id && seenApptIds.has(String(a.id))) continue;
    merged.push({
      id: `APT-${a.id}`,
      _source: 'appointment',
      appointmentRef: a,
      patientId: a.patientId || (a.patient && a.patient.id) || null,
      patientName: a.patientName || (a.patient && (a.patient.fullName || a.patient.HoTen)) || null,
      purpose: a.symptoms || a.purpose || 'Khám theo lịch hẹn',
      timeSlot: a.timeSlot,
      createdAt: a.createdAt,
      status: a.status,
      raw: a,
    });
  }

  return successResponse(res, merged);
});

// GET /api/medical-records
const getAllRecords = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { patientId, sort } = req.query;

  // If model missing, return empty paginated response
  if (typeof MedicalRecord === 'undefined' || !MedicalRecord || typeof MedicalRecord.findAndCountAll !== 'function') {
    return paginatedResponse(res, { data: [], page, limit, total: 0 });
  }

  const where = {};
  if (patientId) where.patientId = patientId;

  const order = parseSort(sort, ['createdAt', 'id', 'completedAt']);

  const result = await MedicalRecord.findAndCountAll({
    where,
    include: [
      { model: Patient, as: 'patient', required: false },
      { model: User, as: 'doctor', required: false },
    ],
    order,
    limit,
    offset,
  });

  const rows = (result.rows || []).map(r => (r && r.get ? r.get({ plain: true }) : r));
  return paginatedResponse(res, { data: rows, page, limit, total: result.count || 0 });
});

// GET /api/medical-records/:id
const getRecordById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (typeof MedicalRecord === 'undefined' || !MedicalRecord || typeof MedicalRecord.findByPk !== 'function') {
    return successResponse(res, null);
  }

  const rec = await MedicalRecord.findByPk(id, {
    include: [
      { model: Patient, as: 'patient', required: false },
      { model: User, as: 'doctor', required: false },
    ],
  });

  if (!rec) return successResponse(res, null);
  const plain = rec.get ? rec.get({ plain: true }) : rec;
  return successResponse(res, plain);
});

// Create medical record (supports DB if model exists, else returns synthetic object)
const createRecord = asyncHandler(async (req, res) => {
  const payload = req.body || {};
  // If model exists, create in DB
  if (typeof MedicalRecord !== 'undefined' && MedicalRecord && typeof MedicalRecord.create === 'function') {
    const created = await MedicalRecord.create(payload);
    const plain = created.get ? created.get({ plain: true }) : created;
    return createdResponse(res, plain, 'Đã tạo hồ sơ khám');
  }

  // Fallback: synthesize an id and return payload
  const syntheticId = `REC${Date.now()}`;
  const created = { id: syntheticId, ...payload, createdAt: new Date().toISOString() };
  return createdResponse(res, created, 'Đã tạo hồ sơ khám (tạm, không lưu DB)');
});

// Update medical record (DB if available, else echo back)
const updateRecord = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const payload = req.body || {};
  if (typeof MedicalRecord !== 'undefined' && MedicalRecord && typeof MedicalRecord.findByPk === 'function') {
    const rec = await MedicalRecord.findByPk(id);
    if (!rec) {
      return successResponse(res, null);
    }
    await rec.update(payload);
    const plain = rec.get ? rec.get({ plain: true }) : rec;
    return successResponse(res, plain);
  }

  const updated = { id, ...payload, updatedAt: new Date().toISOString() };
  return successResponse(res, updated);
});

export { getTodayQueue, getAllRecords, getRecordById, createRecord, updateRecord };
