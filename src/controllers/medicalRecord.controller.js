/**
 * Medical Record Controller - Canonical Implementation
 * Uses MedicalExaminations table only (PascalCase schema).
 * No legacy fallbacks or alternate models.
 */
import { Op } from 'sequelize';
import { MedicalExamination, Appointment, Patient, User } from '../models/index.js';
import { asyncHandler, parsePagination, parseSort } from '../utils/helpers.js';
import { successResponse, createdResponse, paginatedResponse, errorResponse } from '../utils/response.js';
import { formatToVietnamISOString } from '../utils/timezone.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { ROLES } from '../config/constants.js';


const calculateBMI = (weight, height) => {
  if (!weight || !height) return null;
  const w = Number(weight);
  const h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  const heightMeters = h > 3 ? h / 100 : h;
  return Math.round((w / (heightMeters * heightMeters)) * 10) / 10;
};

const normalizeDateOnly = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  if (/^\d{4}-\d{2}-\d{2}T/.test(raw)) return raw.slice(0, 10);
  const viMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(raw);
  if (viMatch) {
    const [, dd, mm, yyyy] = viMatch.map(Number);
    const d = new Date(yyyy, mm - 1, dd);
    if (d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd) {
      return `${String(yyyy).padStart(4, '0')}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    }
  }
  const parsed = new Date(raw);
  return !Number.isNaN(parsed.getTime()) ? formatToVietnamISOString(parsed).slice(0, 10) : null;
};

const getVietnamTodayRange = () => {
  const now = new Date();
  const vnDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
  const [year, month, day] = vnDateStr.split('-').map(Number);
  const startOfDayUTC = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const todayUTC = new Date(startOfDayUTC.getTime() - 7 * 60 * 60 * 1000);
  const startOfTomorrowUTC = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0));
  const tomorrowUTC = new Date(startOfTomorrowUTC.getTime() - 7 * 60 * 60 * 1000);
  return { start: todayUTC, end: tomorrowUTC };
};

const formatExaminationCode = (examinationId, createdAt) => {
  if (!examinationId) return null;
  const d = createdAt ? new Date(createdAt) : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `PK-${y}${m}${day}-${String(examinationId).padStart(6, '0')}`;
};

const toMedicalExaminationContract = (row) => {
  if (!row) return null;
  const doctorName = row.doctor?.full_name || row.doctor?.fullName || row.doctorName || null;
  const patient = row.patient || {};
  return {
    id: row.ExaminationID,
    examinationId: row.ExaminationID,
    examinationCode: formatExaminationCode(row.ExaminationID, row.CreatedAt),
    appointmentId: row.AppointmentID || null,
    patientId: row.PatientId || null,
    doctorId: row.DoctorID || null,
    examinationDate: row.ExaminationDate ? formatToVietnamISOString(row.ExaminationDate) : null,
    symptoms: row.Symptoms || '',
    bloodPressure: row.BloodPressure || '',
    pulse: row.Pulse || null,
    temperature: row.Temperature || null,
    spO2: row.SpO2 || null,
    respirationRate: row.RespirationRate || null,
    weight: row.Weight || null,
    height: row.Height || null,
    bmi: row.BMI || null,
    diagnosis: row.Diagnosis || '',
    doctorName,
    patientName: patient.full_name || patient.fullName || row.patientName || null,
    patientPhone: patient.phone || row.patientPhone || null,
    patientBirthDate: patient.dateOfBirth || row.patientBirthDate || null,
    patientGender: patient.gender || row.patientGender || null,
    patientAddress: patient.address || row.patientAddress || null,
    icd10Code: row.ICD10Code || '',
    treatmentAdvice: row.TreatmentAdvice || '',
    notes: row.Notes || '',
    reExaminationDate: row.ReExaminationDate ? formatToVietnamISOString(row.ReExaminationDate) : null,
    prescriptionStatus: row.PrescriptionStatus || null,
    status: row.Status || 0,
    createdAt: row.CreatedAt ? formatToVietnamISOString(row.CreatedAt) : null,
    updatedAt: row.UpdatedAt ? formatToVietnamISOString(row.UpdatedAt) : null,
    vitalSigns: {
      bloodPressure: row.BloodPressure || '',
      pulse: row.Pulse || null,
      temperature: row.Temperature || null,
      spO2: row.SpO2 || null,
      respiratoryRate: row.RespirationRate || null,
      weight: row.Weight || null,
      height: row.Height || null,
    },
    // Whether frontend should allow creating a prescription from this exam
    canCreatePrescription: Number(row.Status) !== 1,
  };
};

const syncAppointmentCompletedFromExam = async (examinationRow, nextExamStatus) => {
  const statusNum = Number(nextExamStatus);
  // Only sync appointment when examination becomes COMPLETED (Status = 2)
  if (statusNum !== 2) return;
  const appointmentId = Number(examinationRow?.AppointmentID);
  if (!Number.isFinite(appointmentId) || appointmentId <= 0) return;

  const appointment = await Appointment.findByPk(appointmentId);
  if (!appointment) return;
  await appointment.update({ status: 3 });
};

const getTodayQueue = asyncHandler(async (req, res) => {
  const { start: today, end: tomorrow } = getVietnamTodayRange();
  const where = { CreatedAt: { [Op.gte]: today, [Op.lt]: tomorrow } };

  if (req.user && Number(req.user.role) === ROLES.DOCTOR) {
    where.DoctorID = req.user.id;
  }

  const records = await MedicalExamination.findAll({
    where,
    include: [
      { model: Patient, as: 'patient', attributes: ['id', 'full_name', 'phone'], required: false },
      { model: User, as: 'doctor', attributes: ['id', 'full_name'], required: false },
    ],
    order: [['CreatedAt', 'ASC']],
  });
  const data = (records || []).map((r) => {
    const plain = r.get ? r.get({ plain: true }) : r;
    return {
      id: plain.ExaminationID,
      examinationId: plain.ExaminationID,
      examinationCode: formatExaminationCode(plain.ExaminationID, plain.CreatedAt),
      appointmentId: plain.AppointmentID,
      patientId: plain.PatientId,
      patientName: plain.patient?.full_name || null,
      symptoms: plain.Symptoms || '',
      createdAt: plain.CreatedAt ? formatToVietnamISOString(plain.CreatedAt) : null,
      status: plain.Status || 0,
      source: 'medicalExamination',
    };
  });
  return successResponse(res, data);
});

const getAllRecords = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { patientId, status, sort } = req.query;

  const where = {};
  if (patientId) where.PatientId = patientId;
  if (status !== undefined && status !== null && status !== '') {
    const statusNum = Number(status);
    if (Number.isInteger(statusNum) && [0, 1, 2, 3].includes(statusNum)) {
      where.Status = statusNum;
    }
  }

  // If caller is a doctor, restrict to their own examinations
  if (req.user && Number(req.user.role) === ROLES.DOCTOR) {
    where.DoctorID = req.user.id;
  }

  const order = parseSort(sort, ['CreatedAt', 'ExaminationID'], 'CreatedAt:desc');

  const { count, rows } = await MedicalExamination.findAndCountAll({
    where,
    include: [
      { model: Patient, as: 'patient', attributes: ['id', 'full_name', 'phone', 'dateOfBirth', 'gender', 'address'], required: false },
      { model: User, as: 'doctor', attributes: ['id', 'full_name'], required: false },
    ],
    order,
    limit,
    offset,
  });

  const data = (rows || []).map((r) => {
    const plain = r.get ? r.get({ plain: true }) : r;
    return toMedicalExaminationContract(plain);
  });

  return paginatedResponse(res, { data, page, limit, total: count });
});

const getRecordById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const examination = await MedicalExamination.findOne({
    where: { ExaminationID: id },
    include: [
      { model: Patient, as: 'patient', attributes: ['id', 'full_name', 'phone', 'dateOfBirth', 'gender', 'address'], required: false },
      { model: User, as: 'doctor', attributes: ['id', 'full_name'], required: false },
      { model: Appointment, as: 'appointment', required: false },
    ],
  });

  if (!examination) throw new NotFoundError('Không tìm thấy phiếu khám');

  const plain = examination.get ? examination.get({ plain: true }) : examination;
  return successResponse(res, toMedicalExaminationContract(plain));
});


const createRecord = asyncHandler(async (req, res) => {
  const {
    patientId,
    appointmentId,
    doctorId,
    examinationDate,
    symptoms,
    bloodPressure,
    pulse,
    temperature,
    spO2,
    respirationRate,
    weight,
    height,
    diagnosis,
    icd10Code,
    treatmentAdvice,
    notes,
    reExaminationDate,
  } = req.body;

  if (!patientId || !doctorId) throw new BadRequestError('patientId và doctorId là bắt buộc');

  const numPatientId = Number(patientId);
  const numDoctorId = Number(doctorId);
  if (!Number.isFinite(numPatientId) || !Number.isFinite(numDoctorId)) {
    throw new BadRequestError('patientId và doctorId phải là số');
  }

  const patient = await Patient.findByPk(numPatientId);
  if (!patient) throw new NotFoundError('Không tìm thấy bệnh nhân');

  const doctor = await User.findByPk(numDoctorId);
  if (!doctor) throw new NotFoundError('Không tìm thấy bác sĩ');

  const bmi = calculateBMI(weight, height);

  const examination = await MedicalExamination.create({
    PatientId: numPatientId,
    DoctorID: numDoctorId,
    AppointmentID: appointmentId ? Number(appointmentId) : null,
    ExaminationDate: examinationDate ? new Date(examinationDate) : new Date(),
    Symptoms: symptoms || '',
    BloodPressure: bloodPressure || '',
    Pulse: pulse ? Number(pulse) : null,
    Temperature: temperature ? Number(temperature) : null,
    SpO2: spO2 ? Number(spO2) : null,
    RespirationRate: respirationRate ? Number(respirationRate) : null,
    Weight: weight ? Number(weight) : null,
    Height: height ? Number(height) : null,
    BMI: bmi,
    Diagnosis: diagnosis || '',
    ICD10Code: icd10Code || '',
    TreatmentAdvice: treatmentAdvice || '',
    Notes: notes || '',
    ReExaminationDate: reExaminationDate ? new Date(reExaminationDate) : null,
    Status: 0,
    CreatedAt: new Date(),
    UpdatedAt: new Date(),
  });

  return createdResponse(res, toMedicalExaminationContract(examination.get({ plain: true })), 'Tạo phiếu khám thành công');
});

const updateRecord = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    symptoms,
    bloodPressure,
    pulse,
    temperature,
    spO2,
    respirationRate,
    weight,
    height,
    diagnosis,
    icd10Code,
    treatmentAdvice,
    notes,
    reExaminationDate,
    status,
  } = req.body;

  const examination = await MedicalExamination.findOne({ where: { ExaminationID: id } });
  if (!examination) throw new NotFoundError('Không tìm thấy phiếu khám');

  const bmi = calculateBMI(weight ?? examination.Weight, height ?? examination.Height);

  const updates = {};
  if (symptoms !== undefined) updates.Symptoms = symptoms;
  if (bloodPressure !== undefined) updates.BloodPressure = bloodPressure;
  if (pulse !== undefined) updates.Pulse = pulse ? Number(pulse) : null;
  if (temperature !== undefined) updates.Temperature = temperature ? Number(temperature) : null;
  if (spO2 !== undefined) updates.SpO2 = spO2 ? Number(spO2) : null;
  if (respirationRate !== undefined) updates.RespirationRate = respirationRate ? Number(respirationRate) : null;
  if (weight !== undefined) updates.Weight = weight ? Number(weight) : null;
  if (height !== undefined) updates.Height = height ? Number(height) : null;
  if (bmi !== null) updates.BMI = bmi;
  if (diagnosis !== undefined) updates.Diagnosis = diagnosis;
  if (icd10Code !== undefined) updates.ICD10Code = icd10Code;
  if (treatmentAdvice !== undefined) updates.TreatmentAdvice = treatmentAdvice;
  if (notes !== undefined) updates.Notes = notes;
  if (reExaminationDate !== undefined) updates.ReExaminationDate = reExaminationDate ? new Date(reExaminationDate) : null;
  // Support status parameter (0=waiting, 1=in-progress, 2=completed, 3=cancelled)
  if (status !== undefined && [0, 1, 2, 3].includes(Number(status))) updates.Status = Number(status);
  updates.UpdatedAt = new Date();

  // Prevent reverting a COMPLETED exam back to a non-completed status by non-admins
  try {
    const currentStatus = Number(examination.Status ?? 0);
    if (currentStatus === 2 && updates.Status !== undefined) {
      const incoming = Number(updates.Status);
      if (incoming !== 2) {
        // Ignore status change that would revert completion
        delete updates.Status;
      }
    }
  } catch (e) {
    // If any error evaluating status, proceed without blocking updates
  }

  await examination.update(updates);
  // Reload to ensure we return the persisted state
  await examination.reload();
  await syncAppointmentCompletedFromExam(examination.get({ plain: true }), examination.Status);

  return successResponse(res, toMedicalExaminationContract(examination.get({ plain: true })), 'Cập nhật phiếu khám thành công');
});

const startExamination = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const examination = await MedicalExamination.findOne({ where: { ExaminationID: id } });
  if (!examination) throw new NotFoundError('Không tìm thấy phiếu khám');

  // Mark status as in-progress (Status: 1 = Đang khám)
  await examination.update({ Status: 1, UpdatedAt: new Date() });
  await examination.reload();

  return successResponse(res, toMedicalExaminationContract(examination.get({ plain: true })), 'Bắt đầu khám thành công');
});


const completeExamination = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const examination = await MedicalExamination.findOne({ where: { ExaminationID: id } });
  if (!examination) throw new NotFoundError('Không tìm thấy phiếu khám');

  // Mark status as complete (Status: 2 = Hoàn thành)
  await examination.update({ Status: 2, UpdatedAt: new Date() });
  await examination.reload();
  await syncAppointmentCompletedFromExam(examination.get({ plain: true }), 2);

  return successResponse(res, toMedicalExaminationContract(examination.get({ plain: true })), 'Hoàn thành khám thành công');
});

const cancelExamination = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const examination = await MedicalExamination.findOne({ where: { ExaminationID: id } });
  if (!examination) throw new NotFoundError('Không tìm thấy phiếu khám');

  // Mark status as cancelled (Status: 3 = Đã hủy)
  await examination.update({ Status: 3, UpdatedAt: new Date() });

  return successResponse(res, toMedicalExaminationContract(examination.get({ plain: true })), 'Hủy phiếu khám thành công');
});

export {
  getTodayQueue,
  getAllRecords,
  getRecordById,
  createRecord,
  updateRecord,
  startExamination,
  completeExamination,
  cancelExamination,
};
