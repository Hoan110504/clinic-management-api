/**
 * Lab Test Controller - Canonical Implementation
 * Uses canonical SQL Server schema fields ONLY:
 * - LabOrders (LabOrderID, ExaminationID, DoctorID, Status, CreatedAt)
 * - LabOrderItems (LabOrderItemID, LabOrderID, ServiceID, RoomID, Status, Priority, Note, CreatedAt)
 * - LabResults (LabResultID, ExaminationID, ServiceID, ResultText, ImageUrl, Conclusion, Note, DoctorID, ResultDate, CreatedAt, UpdatedAt, LabOrderItemID, RoomID)
 * - LabServices (ServiceID, ServiceName, RoomID, Price, ServiceType, IsActive, CreatedAt)
 * 
 * NO fallback logic, no data enrichment from other tables, only database schema fields.
 */
import { Op } from 'sequelize';
import { MedicalExamination, sequelize } from '../models/index.js';
import models from '../models/index.js';
import { asyncHandler, parsePagination } from '../utils/helpers.js';
import { formatToVietnamISOString } from '../utils/timezone.js';
import {
  successResponse,
  createdResponse,
  paginatedResponse,
  noContentResponse,
} from '../utils/response.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors.js';
import { ROLES } from '../config/constants.js';

// Lab Item Status codes from database schema
const LAB_ITEM_STATUS = {
  ASSIGNED: 0,
  IN_PROGRESS: 1,
  COMPLETED: 2,
  CANCELLED: 3,
};

// Service Type codes from database schema (tinyint)
const SERVICE_TYPE_CODE = {
  LAB_TEST: 1,
  ULTRASOUND: 2,
  ECG: 3,
};

const getLabModels = () => {
  const LabOrder = models.LabOrder;
  const LabOrderItem = models.LabOrderItem;
  const LabResult = models.LabResult;
  const LabService = models.LabService;

  if (!LabOrder || !LabOrderItem || !LabResult || !LabService) {
    throw new Error('Lab modules are not initialized correctly (LabOrder/LabOrderItem/LabResult/LabService).');
  }

  return { LabOrder, LabOrderItem, LabResult, LabService };
};

// Parse positive integers only from request parameters
const toPositiveInt = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const raw = String(value).trim();
  if (!raw || !/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const toLabItemStatus = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isSafeInteger(n)) return null;
  return n >= 0 && n <= 3 ? n : null;
};

const toPriorityInt = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isSafeInteger(n)) return null;
  return n >= 0 && n <= 2 ? n : null;
};

// Check permission for mutations (only Admin or the DoctorID who created the order)
const ensureMutatePermission = (user, doctorIdFromOrder) => {
  const role = Number(user?.role);
  const isAdmin = role === 1; // Assuming 1 = Admin based on users table schema
  if (isAdmin) return;

  const current = toPositiveInt(user?.id);
  const owner = toPositiveInt(doctorIdFromOrder);
  if (current && owner && current === owner) return;

  throw new ForbiddenError('Ban khong co quyen thuc hien hanh dong nay', 'INSUFFICIENT_PERMISSIONS');
};

// Verify LabService exists (do NOT auto-create)
const getLabService = async (serviceId) => {
  const { LabService } = getLabModels();
  if (!serviceId) return null;
  return LabService.findByPk(serviceId);
};

// Get MedicalExamination by ID only (no fallback resolution)
const getExamination = async (examinationId) => {
  if (!examinationId) return null;
  return MedicalExamination.findByPk(examinationId);
};

// Keep DB timestamp semantics for LabOrderItems.CreatedAt in API response
// (no timezone shifting; format as SQL-like datetime2 text).
const formatDbDateTime = (value) => {
  if (value === null || value === undefined || value === '') return null;

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const year = String(date.getUTCFullYear());
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  const minute = String(date.getUTCMinutes()).padStart(2, '0');
  const second = String(date.getUTCSeconds()).padStart(2, '0');
  const fraction = `${String(date.getUTCMilliseconds()).padStart(3, '0')}0000`;

  return `${year}-${month}-${day} ${hour}:${minute}:${second}.${fraction}`;
};

// Recompute LabOrder.Status based on child LabOrderItems statuses
const recomputeLabOrderStatus = async (labOrderId) => {
  const { LabOrder, LabOrderItem } = getLabModels();
  const items = await LabOrderItem.findAll({
    where: { labOrderId },
    attributes: ['status'],
  });

  if (!items || items.length === 0) {
    await LabOrder.update({ status: LAB_ITEM_STATUS.CANCELLED }, { where: { labOrderId } });
    return;
  }

  const statuses = items.map((it) => Number(it.status));
  let nextStatus = LAB_ITEM_STATUS.ASSIGNED;

  if (statuses.every((s) => s === LAB_ITEM_STATUS.CANCELLED)) {
    nextStatus = LAB_ITEM_STATUS.CANCELLED;
  } else if (statuses.some((s) => s === LAB_ITEM_STATUS.IN_PROGRESS)) {
    nextStatus = LAB_ITEM_STATUS.IN_PROGRESS;
  } else if (statuses.some((s) => s === LAB_ITEM_STATUS.COMPLETED)) {
    nextStatus = LAB_ITEM_STATUS.COMPLETED;
  }

  await LabOrder.update({ status: nextStatus }, { where: { labOrderId } });
};

// Convert LabOrderItem row to API response contract (CANONICAL SCHEMA ONLY)
const toLabTestContract = async (item) => {
  if (!item) return null;
  
  const plain = item?.get ? item.get({ plain: true }) : item;
  const order = plain.LabOrder ? (plain.LabOrder?.get ? plain.LabOrder.get({ plain: true }) : plain.LabOrder) : {};
  const service = plain.Service ? (plain.Service?.get ? plain.Service.get({ plain: true }) : plain.Service) : {};
  const exam = order.examination ? (order.examination?.get ? order.examination.get({ plain: true }) : order.examination) : {};
  const patient = exam.patient ? (exam.patient?.get ? exam.patient.get({ plain: true }) : exam.patient) : {};

  const orderExaminationId = order.examinationId ?? order.ExaminationID ?? null;
  const itemServiceId = plain.serviceId ?? plain.ServiceID ?? null;
  const itemLabOrderItemId = plain.labOrderItemId ?? plain.LabOrderItemID ?? null;

  // Fetch related LabResult for this item+service combo
  const { LabResult } = getLabModels();
  let result = null;
  if (itemLabOrderItemId) {
    result = await LabResult.findOne({
      where: {
        labOrderItemId: itemLabOrderItemId,
      },
      order: [['resultDate', 'DESC'], ['updatedAt', 'DESC'], ['labResultId', 'DESC']],
      raw: true,
    });
  }
  if (!result && orderExaminationId && itemServiceId) {
    result = await LabResult.findOne({
      where: {
        examinationId: orderExaminationId,
        serviceId: itemServiceId,
      },
      order: [['resultDate', 'DESC'], ['updatedAt', 'DESC'], ['labResultId', 'DESC']],
      raw: true,
    });
  }

  // Return ONLY database schema fields - no enrichment from other tables
  return {
    id: plain.labOrderItemId ?? plain.LabOrderItemID,
    labOrderItemId: plain.labOrderItemId ?? plain.LabOrderItemID,
    labOrderId: plain.labOrderId ?? plain.LabOrderID,
    serviceId: plain.serviceId ?? plain.ServiceID,
    roomId: plain.roomId ?? plain.RoomID ?? null,
    status: Number(plain.status ?? plain.Status ?? 0),
    priority: Number(plain.priority ?? plain.Priority ?? 0) || 0,
    note: plain.note ?? plain.Note ?? null,
    createdAt: formatDbDateTime(plain.createdAt ?? plain.CreatedAt),

    // From LabOrder (canonical fields only)
    labOrder: {
      labOrderId: order.labOrderId ?? order.LabOrderID ?? null,
      examinationId: order.examinationId ?? order.ExaminationID ?? null,
      doctorId: order.doctorId ?? order.DoctorID ?? null,
      status: Number(order.status ?? order.Status ?? 0) || 0,
      createdAt: (order.createdAt ?? order.CreatedAt) ? formatToVietnamISOString(order.createdAt ?? order.CreatedAt) : null,
    },

    // From LabService (canonical fields only)
    service: {
      serviceId: service.serviceId ?? service.ServiceID ?? null,
      serviceName: service.serviceName ?? service.ServiceName ?? null,
      roomId: service.roomId ?? service.RoomID ?? null,
      price: Number(service.price ?? service.Price ?? 0) || 0,
      serviceType: Number(service.serviceType ?? service.ServiceType ?? 1) || 1,
      isActive: Boolean(service.isActive ?? service.IsActive),
      createdAt: (service.createdAt ?? service.CreatedAt) ? formatToVietnamISOString(service.createdAt ?? service.CreatedAt) : null,
    },

    // From MedicalExamination (canonical fields only)
    examination: {
      examinationId: exam.ExaminationID || null,
      appointmentId: exam.AppointmentID || null,
      patientId: exam.PatientId || null,
      doctorId: exam.DoctorID || null,
      examinationDate: exam.ExaminationDate ? formatToVietnamISOString(exam.ExaminationDate) : null,
      status: Number(exam.Status) || 0,
    },

    patient: {
      id: patient.id ?? null,
      fullName: patient.fullName ?? patient.full_name ?? null,
      dateOfBirth: patient.dateOfBirth ?? patient.date_of_birth ?? null,
      gender: patient.gender ?? null,
      phone: patient.phone ?? null,
      email: patient.email ?? null,
      address: patient.address ?? null,
      idNumber: patient.idNumber ?? patient.id_number ?? null,
    },

    patientId: patient.id ?? exam.PatientId ?? null,
    patientName: patient.fullName ?? patient.full_name ?? null,
    patientPhone: patient.phone ?? null,
    patientDob: patient.dateOfBirth ?? patient.date_of_birth ?? null,
    gender: patient.gender ?? null,

    // From LabResult (canonical fields only) - or null if no result
    result: result ? {
      labResultId: result.labResultId ?? result.LabResultID ?? null,
      resultText: result.resultText ?? result.ResultText ?? null,
      imageUrl: result.imageUrl ?? result.ImageUrl ?? null,
      conclusion: result.conclusion ?? result.Conclusion ?? null,
      note: result.note ?? result.Note ?? null,
      doctorId: result.doctorId ?? result.DoctorID ?? null,
      resultDate: result.resultDate ?? result.ResultDate ? formatToVietnamISOString(result.resultDate ?? result.ResultDate) : null,
      createdAt: result.createdAt ?? result.CreatedAt ? formatToVietnamISOString(result.createdAt ?? result.CreatedAt) : null,
      updatedAt: result.updatedAt ?? result.UpdatedAt ? formatToVietnamISOString(result.updatedAt ?? result.UpdatedAt) : null,
      labOrderItemId: result.labOrderItemId ?? result.LabOrderItemID ?? null,
      roomId: result.roomId ?? result.RoomID ?? null,
    } : null,
  };
};

// Get base includes for LabOrderItem queries
const getBaseItemIncludes = () => {
  return [
    {
      model: models.LabOrder,
      as: 'LabOrder',
      required: true,
      include: [
        {
          model: MedicalExamination,
          as: 'examination',
          required: false,
          include: [
            {
              model: models.Patient,
              as: 'patient',
              required: false,
            },
          ],
        },
      ],
    },
    {
      model: models.LabService,
      as: 'Service',
      required: false,
    },
  ];
};

/**
 * Get all lab tests (with pagination)
 * GET /api/lab-tests
 */
const getAllLabTests = asyncHandler(async (req, res) => {
  const { LabOrderItem } = getLabModels();
  const { page, limit, offset } = parsePagination(req.query);
  const { status, serviceId, labOrderId, examinationId } = req.query;

  const where = {};
  if (status !== undefined && status !== null && status !== '') {
    const statusNum = toLabItemStatus(status);
    if (statusNum !== null && [0, 1, 2, 3].includes(statusNum)) {
      where.status = statusNum;
    }
  }
  if (serviceId !== undefined && serviceId !== null && serviceId !== '') {
    where.serviceId = toPositiveInt(serviceId);
  }
  if (labOrderId !== undefined && labOrderId !== null && labOrderId !== '') {
    where.labOrderId = toPositiveInt(labOrderId);
  }

  const include = getBaseItemIncludes();
  
  // Add examination filter if provided
  if (examinationId !== undefined && examinationId !== null && examinationId !== '') {
    const examId = toPositiveInt(examinationId);
    if (examId && include[0] && include[0].include) {
      if (!include[0].where) include[0].where = {};
      include[0].where.examinationId = examId;
    }
  }

  const items = await LabOrderItem.findAndCountAll({
    where,
    include,
    order: [['createdAt', 'DESC'], ['labOrderItemId', 'DESC']],
    limit,
    offset,
    distinct: true,
  });

  const rows = await Promise.all(items.rows.map((item) => toLabTestContract(item)));

  return paginatedResponse(res, {
    data: rows,
    page,
    limit,
    total: items.count,
  });
});

/**
 * Get lab test by ID
 * GET /api/lab-tests/:id
 */
const getLabTestById = asyncHandler(async (req, res) => {
  const { LabOrderItem } = getLabModels();
  const itemId = toPositiveInt(req.params.id);
  if (!itemId) throw new NotFoundError('Khong tim thay xet nghiem');

  const item = await LabOrderItem.findByPk(itemId, {
    include: getBaseItemIncludes(),
  });
  if (!item) throw new NotFoundError('Khong tim thay xet nghiem');

  const row = await toLabTestContract(item);
  return successResponse(res, row);
});

/**
 * Create new lab test
 * POST /api/lab-tests
 * Required: examinationId, serviceId, must exist in database
 */
const createLabTest = asyncHandler(async (req, res) => {
  const { LabOrder, LabOrderItem } = getLabModels();
  const { examinationId, serviceId, roomId, status, note, priority } = req.body || {};

  const doctorId = toPositiveInt(req.user?.id);
  if (!doctorId) {
    throw new BadRequestError('Khong xac dinh duoc bac si chi dinh');
  }

  const resolvedExaminationId = toPositiveInt(examinationId);
  if (!resolvedExaminationId) {
    throw new BadRequestError('ExaminationID khong hop le');
  }

  const resolvedServiceId = toPositiveInt(serviceId);
  if (!resolvedServiceId) {
    throw new BadRequestError('ServiceID khong hop le');
  }

  // Verify examination exists
  const exam = await getExamination(resolvedExaminationId);
  if (!exam) {
    throw new NotFoundError('ExaminationID khong ton tai');
  }

  // Verify service exists
  const service = await getLabService(resolvedServiceId);
  if (!service) {
    throw new NotFoundError('ServiceID khong ton tai');
  }

  // Find or create LabOrder for this examination + doctor
  let labOrder = await LabOrder.findOne({
    where: {
      examinationId: resolvedExaminationId,
      doctorId,
    },
    order: [['createdAt', 'DESC'], ['labOrderId', 'DESC']],
  });

  if (!labOrder) {
    labOrder = await LabOrder.create({
      examinationId: resolvedExaminationId,
      doctorId,
      status: LAB_ITEM_STATUS.ASSIGNED,
      createdAt: sequelize.literal('GETDATE()'),
    });
  }

  // Check if item already exists for this order + service
  let item = await LabOrderItem.findOne({
    where: {
      labOrderId: labOrder.labOrderId,
      serviceId: resolvedServiceId,
    },
  });

  if (!item) {
    const priorityNum = toPriorityInt(priority);
    const statusNum = toLabItemStatus(status);
    item = await LabOrderItem.create({
      labOrderId: labOrder.labOrderId,
      serviceId: resolvedServiceId,
      roomId: toPositiveInt(roomId),
      status: statusNum !== null ? statusNum : LAB_ITEM_STATUS.ASSIGNED,
      priority: [0, 1, 2].includes(Number(priorityNum)) ? Number(priorityNum) : 0,
      note: note || null,
      createdAt: sequelize.literal('GETDATE()'),
    });
  }

  await recomputeLabOrderStatus(labOrder.labOrderId);
  const result = await LabOrderItem.findByPk(item.labOrderItemId, {
    include: getBaseItemIncludes(),
  });

  const contract = await toLabTestContract(result);
  return createdResponse(res, contract, 'Tao chi dinh can lam sang thanh cong');
});

/**
 * Update lab test item (status, note, roomId only - no enrichment)
 * PUT /api/lab-tests/:id
 */
const updateLabTest = asyncHandler(async (req, res) => {
  const { LabOrderItem } = getLabModels();
  const itemId = toPositiveInt(req.params.id);
  if (!itemId) throw new NotFoundError('Khong tim thay xet nghiem');

  const item = await LabOrderItem.findByPk(itemId, {
    include: getBaseItemIncludes(),
  });
  if (!item) throw new NotFoundError('Khong tim thay xet nghiem');

  const order = item.LabOrder;
  ensureMutatePermission(req.user, order?.doctorId ?? order?.DoctorID);

  const { status, note, roomId } = req.body || {};
  const updates = {};

  if (status !== undefined) {
    const statusNum = toLabItemStatus(status);
    if (statusNum !== null && [0, 1, 2, 3].includes(statusNum)) {
      updates.status = statusNum;
    }
  }

  if (note !== undefined) {
    updates.note = note || null;
  }

  if (roomId !== undefined) {
    updates.roomId = toPositiveInt(roomId);
  }

  if (Object.keys(updates).length > 0) {
    await item.update(updates);
  }

  const orderId = order?.labOrderId ?? order?.LabOrderID;
  await recomputeLabOrderStatus(orderId);
  const result = await LabOrderItem.findByPk(itemId, {
    include: getBaseItemIncludes(),
  });
  const contract = await toLabTestContract(result);
  return successResponse(res, contract, 'Cap nhat xet nghiem thanh cong');
});

/**
 * Update lab result (only create/update result data - canonical schema fields only)
 * PUT /api/lab-tests/:id/result
 */
const updateLabResult = asyncHandler(async (req, res) => {
  const { LabOrderItem, LabResult } = getLabModels();
  const itemId = toPositiveInt(req.params.id);
  if (!itemId) throw new NotFoundError('Khong tim thay xet nghiem');

  const item = await LabOrderItem.findByPk(itemId, {
    include: getBaseItemIncludes(),
  });
  if (!item) throw new NotFoundError('Khong tim thay xet nghiem');

  const order = item.LabOrder;
  ensureMutatePermission(req.user, order?.doctorId ?? order?.DoctorID);

  const {
    resultText,
    results,
    imageUrl,
    conclusion,
    note,
    notes,
    resultDate,
    status,
  } = req.body || {};
  
  const examinationId = toPositiveInt(order?.examinationId ?? order?.ExaminationID);
  const serviceId = toPositiveInt(item?.serviceId ?? item?.ServiceID);
  const doctorId = toPositiveInt(req.user?.id ?? req.user?.userId ?? req.user?.UserId)
    || toPositiveInt(order?.doctorId ?? order?.DoctorID);
  const resolvedResultText = typeof (resultText ?? results) === 'string'
    ? (resultText ?? results).trim()
    : (resultText ?? results ?? null);
  const resolvedNote = note !== undefined ? note : notes;

  if (!examinationId || !serviceId || !doctorId || !resolvedResultText) {
    throw new BadRequestError('Khong du du lieu de luu ket qua xet nghiem');
  }

  // Find or create LabResult for this examination + service
  let labResult = await LabResult.findOne({
    where: {
      examinationId,
      serviceId,
    },
    order: [['ResultDate', 'DESC'], ['UpdatedAt', 'DESC'], ['LabResultID', 'DESC']],
  });

  if (labResult) {
    const updates = {};
    if (resolvedResultText !== undefined) updates.resultText = resolvedResultText || null;
    if (imageUrl !== undefined) updates.imageUrl = imageUrl || null;
    if (conclusion !== undefined) updates.conclusion = conclusion || null;
    if (resolvedNote !== undefined) updates.note = resolvedNote || null;
    if (resultDate !== undefined) updates.resultDate = new Date(resultDate);
    updates.updatedAt = new Date();
    updates.doctorId = doctorId;
    updates.labOrderItemId = item.labOrderItemId ?? item.LabOrderItemID;
    updates.roomId = item.roomId ?? item.RoomID;

    if (Object.keys(updates).length > 0) {
      await labResult.update(updates);
    }
  } else {
    labResult = await LabResult.create({
      examinationId,
      serviceId,
      resultText: resolvedResultText || null,
      imageUrl: imageUrl || null,
      conclusion: conclusion || null,
      note: resolvedNote || null,
      doctorId,
      resultDate: resultDate ? new Date(resultDate) : new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      labOrderItemId: item.labOrderItemId ?? item.LabOrderItemID,
      roomId: item.roomId ?? item.RoomID,
    });
  }

  // Update item status if provided
  if (status !== undefined) {
    const statusNum = toPositiveInt(status);
    if (statusNum !== null && [0, 1, 2, 3].includes(statusNum)) {
      await item.update({ status: statusNum });
      await recomputeLabOrderStatus(order.labOrderId ?? order.LabOrderID);
    }
  }

  const result = await LabOrderItem.findByPk(itemId, {
    include: getBaseItemIncludes(),
  });
  const contract = await toLabTestContract(result);
  return successResponse(res, contract, 'Cap nhat ket qua xet nghiem thanh cong');
});

/**
 * Cancel lab test (soft delete via Status = CANCELLED)
 * DELETE /api/lab-tests/:id
 */
const deleteLabTest = asyncHandler(async (req, res) => {
  const { LabOrderItem } = getLabModels();
  const itemId = toPositiveInt(req.params.id);
  if (!itemId) throw new NotFoundError('Khong tim thay xet nghiem');

  const item = await LabOrderItem.findByPk(itemId, {
    include: getBaseItemIncludes(),
  });
  if (!item) throw new NotFoundError('Khong tim thay xet nghiem');

  const order = item.LabOrder;
  ensureMutatePermission(req.user, order?.DoctorID);

  await item.update({ Status: LAB_ITEM_STATUS.CANCELLED });
  await recomputeLabOrderStatus(order.LabOrderID);

  return noContentResponse(res);
});

/**
 * Get pending lab tests (Status = 0 items from today's MedicalExaminations)
 * GET /api/lab-tests/pending
 */
const getPendingLabTests = asyncHandler(async (req, res) => {
  const { LabOrderItem } = getLabModels();
  
  // Get today's examination IDs
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  
  const todayExaminations = await MedicalExamination.findAll({
    where: {
      ExaminationDate: {
        [Op.between]: [startOfDay, endOfDay],
      },
      Status: 0,
    },
    attributes: ['ExaminationID'],
    raw: true,
  });
  
  const todayExaminationIds = todayExaminations.map(exam => exam.ExaminationID);
  
  if (todayExaminationIds.length === 0) {
    return successResponse(res, []);
  }

  const include = getBaseItemIncludes();
  if (include[0] && !include[0].where) {
    include[0].where = {};
  }
  if (include[0]) {
    include[0].where.ExaminationID = { [Op.in]: todayExaminationIds };
  }

  const items = await LabOrderItem.findAll({
    where: {
      Status: LAB_ITEM_STATUS.ASSIGNED,
    },
    include,
    order: [['CreatedAt', 'ASC'], ['LabOrderItemID', 'ASC']],
  });

  const rows = await Promise.all(items.map((item) => toLabTestContract(item)));
  return successResponse(res, rows);
});

/**
 * Batch delete lab tests
 * POST /api/lab-tests/batch-delete
 */
const batchDeleteLabTests = asyncHandler(async (req, res) => {
  const { LabOrderItem } = getLabModels();
  const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
  if (ids.length === 0) throw new BadRequestError('ids la mang cac id can xoa');

  const results = [];
  for (const id of ids) {
    try {
      const itemId = toPositiveInt(id);
      if (!itemId) {
        results.push({ id, ok: false, status: 'error', message: 'invalid id' });
        continue;
      }

      const item = await LabOrderItem.findByPk(itemId, {
        include: getBaseItemIncludes(),
      });
      if (!item) {
        results.push({ id, ok: false, status: 'error', message: 'not found' });
        continue;
      }

      ensureMutatePermission(req.user, item?.LabOrder?.DoctorID);
      await item.update({ Status: LAB_ITEM_STATUS.CANCELLED });
      await recomputeLabOrderStatus(item.LabOrderID);

      results.push({ id, ok: true, status: 'cancelled' });
    } catch (error) {
      results.push({ id, ok: false, status: 'error', message: error?.message || 'unknown error' });
    }
  }

  const failed = results.filter((r) => !r.ok).length;
  return successResponse(res, { total: ids.length, failed, results }, 'Ket qua huy hang loat');
});

// Convert LabService row to API response
const toLabServiceContract = (service) => {
  if (!service) return null;
  const plain = service?.get ? service.get({ plain: true }) : service;
  return {
    serviceId: plain.serviceId ?? plain.ServiceID ?? null,
    serviceName: plain.serviceName ?? plain.ServiceName ?? null,
    roomId: plain.roomId ?? plain.RoomID ?? null,
    price: Number(plain.price ?? plain.Price ?? 0) || 0,
    serviceType: Number(plain.serviceType ?? plain.ServiceType ?? 1) || 1,
    isActive: Boolean(plain.isActive ?? plain.IsActive),
    createdAt: (plain.createdAt ?? plain.CreatedAt) ? formatToVietnamISOString(plain.createdAt ?? plain.CreatedAt) : null,
  };
};

/**
 * Get lab services catalog
 * GET /api/lab-services
 */
const getLabServices = asyncHandler(async (req, res) => {
  const { LabService } = getLabModels();
  const { serviceType, isActive, search } = req.query;

  const where = {};
  if (isActive !== undefined && isActive !== null && isActive !== '') {
    where.isActive = String(isActive).toLowerCase() === 'true';
  }
  if (serviceType !== undefined && serviceType !== null && serviceType !== '') {
    const typeNum = toPositiveInt(serviceType);
    if (typeNum && [1, 2, 3].includes(typeNum)) {
      where.serviceType = typeNum;
    }
  }
  if (search) {
    where.serviceName = { [Op.like]: `%${String(search).trim()}%` };
  }

  const services = await LabService.findAll({
    where,
    order: [['serviceType', 'ASC'], ['serviceName', 'ASC']],
  });

  return successResponse(res, services.map(toLabServiceContract));
});

/**
 * Get lab service by ID
 * GET /api/lab-services/:id
 */
const getLabServiceById = asyncHandler(async (req, res) => {
  const { LabService } = getLabModels();
  const serviceId = toPositiveInt(req.params.id);
  if (!serviceId) throw new NotFoundError('Khong tim thay dich vu');

  const service = await LabService.findByPk(serviceId);
  if (!service) throw new NotFoundError('Khong tim thay dich vu');

  return successResponse(res, toLabServiceContract(service));
});

/**
 * Create lab service
 * POST /api/lab-services
 */
const createLabService = asyncHandler(async (req, res) => {
  const { LabService } = getLabModels();
  const { serviceName, serviceType, roomId, price, isActive } = req.body || {};

  if (!serviceName || !String(serviceName).trim()) {
    throw new BadRequestError('Ten dich vu khong duoc de trong');
  }

  const typeNum = toPositiveInt(serviceType);
  if (!typeNum || ![1, 2, 3].includes(typeNum)) {
    throw new BadRequestError('ServiceType phai la 1, 2, hoac 3');
  }

  const service = await LabService.create({
    serviceName: String(serviceName).trim(),
    serviceType: typeNum,
    roomId: toPositiveInt(roomId),
    price: Number(price) || 0,
    isActive: isActive !== false && isActive !== 'false',
    createdAt: sequelize.literal('GETDATE()'),
  });

  return createdResponse(res, toLabServiceContract(service), 'Tao dich vu can lam sang thanh cong');
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

  const { serviceName, serviceType, roomId, price, isActive } = req.body || {};
  const updates = {};

  if (serviceName !== undefined) {
    const name = String(serviceName).trim();
    if (!name) throw new BadRequestError('Ten dich vu khong duoc de trong');
    updates.serviceName = name;
  }

  if (serviceType !== undefined) {
    const typeNum = toPositiveInt(serviceType);
    if (!typeNum || ![1, 2, 3].includes(typeNum)) {
      throw new BadRequestError('ServiceType phai la 1, 2, hoac 3');
    }
    updates.serviceType = typeNum;
  }

  if (roomId !== undefined) {
    updates.roomId = toPositiveInt(roomId);
  }

  if (price !== undefined) {
    updates.price = Number(price) || 0;
  }

  if (isActive !== undefined) {
    updates.isActive = isActive !== false && isActive !== 'false';
  }

  if (Object.keys(updates).length > 0) {
    await service.update(updates);
  }

  return successResponse(res, toLabServiceContract(service), 'Cap nhat dich vu thanh cong');
});

/**
 * Delete lab service
 * DELETE /api/lab-services/:id
 */
const deleteLabService = asyncHandler(async (req, res) => {
  const { LabService } = getLabModels();
  const serviceId = toPositiveInt(req.params.id);
  if (!serviceId) throw new NotFoundError('Khong tim thay dich vu');

  const service = await LabService.findByPk(serviceId);
  if (!service) throw new NotFoundError('Khong tim thay dich vu');

  await service.destroy();
  return noContentResponse(res);
});

export {
  getAllLabTests,
  getLabTestById,
  createLabTest,
  updateLabTest,
  updateLabResult,
  deleteLabTest,
  getPendingLabTests,
  batchDeleteLabTests,
  getLabServices,
  getLabServiceById,
  createLabService,
  updateLabService,
  deleteLabService,
};
