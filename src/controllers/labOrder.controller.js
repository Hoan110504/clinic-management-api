import models from '../models/index.js';
import { asyncHandler } from '../utils/helpers.js';
import { createdResponse, successResponse } from '../utils/response.js';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/errors.js';

const toPositiveInt = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const raw = String(value).trim();
  if (!raw || !/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const getLabOrderModel = () => {
  if (!models?.LabOrder) {
    throw new Error('LabOrder model is not initialized');
  }
  return models.LabOrder;
};

const toLabOrderContract = (row) => {
  if (!row) return null;
  const plain = row?.get ? row.get({ plain: true }) : row;
  return {
    labOrderId: plain.LabOrderID ?? plain.labOrderId,
    examinationId: plain.ExaminationID ?? plain.examinationId,
    doctorId: plain.DoctorID ?? plain.doctorId,
    status: Number(plain.Status ?? plain.status ?? 0),
    createdAt: plain.CreatedAt ?? plain.createdAt ?? null,
  };
};

/**
 * POST /api/lab-orders/create
 * Create exactly one LabOrder per ExaminationID.
 */
const createLabOrder = asyncHandler(async (req, res) => {
  const LabOrder = getLabOrderModel();

  const doctorId = toPositiveInt(req.user?.id);
  if (!doctorId) {
    throw new BadRequestError('DoctorID khong hop le');
  }

  const examinationId = toPositiveInt(req.body?.examinationId ?? req.body?.ExaminationID);
  if (!examinationId) {
    throw new BadRequestError('ExaminationID khong hop le');
  }

  const exam = await models?.MedicalExamination?.findByPk?.(examinationId);
  if (!exam) {
    throw new NotFoundError('ExaminationID khong ton tai');
  }

  const existed = await LabOrder.findOne({
    where: { examinationId },
    order: [['createdAt', 'DESC'], ['labOrderId', 'DESC']],
  });

  if (existed) {
    throw new ConflictError('LabOrder already exists', 'LAB_ORDER_ALREADY_EXISTS');
  }

  const created = await LabOrder.create({
    examinationId,
    doctorId,
    status: 0,
    createdAt: new Date(),
  });

  return createdResponse(res, toLabOrderContract(created), 'Tao LabOrder thanh cong');
});

/**
 * GET /api/lab-orders/by-examination/:id
 * Return LabOrder by ExaminationID if exists.
 */
const getLabOrderByExamination = asyncHandler(async (req, res) => {
  const LabOrder = getLabOrderModel();
  const examinationId = toPositiveInt(req.params?.id);

  if (!examinationId) {
    throw new BadRequestError('ExaminationID khong hop le');
  }

  const row = await LabOrder.findOne({
    where: { examinationId },
    order: [['createdAt', 'DESC'], ['labOrderId', 'DESC']],
  });

  return successResponse(res, toLabOrderContract(row));
});

export {
  createLabOrder,
  getLabOrderByExamination,
};
