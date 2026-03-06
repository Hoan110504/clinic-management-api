/**
 * Lab Test Controller
 * Handles lab test operations
 */
import { Op } from 'sequelize';
import { LabTest, Patient, User, ServiceOrder, MedicalRecord, LabService } from '../models/index.js';
import { asyncHandler, parsePagination, parseSort } from '../utils/helpers.js';
import {
  successResponse,
  createdResponse,
  paginatedResponse,
  noContentResponse,
} from '../utils/response.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { LAB_STATUS, ROLES } from '../config/constants.js';

/**
 * Get all lab tests (with pagination and filters)
 * GET /api/lab-tests
 */
const getAllLabTests = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { status, patientId, testType, fromDate, toDate, search, sort } = req.query;

  // Build where clause
  const where = {};

  if (status) {
    where.status = status;
  }

  if (patientId) {
    where.patientId = patientId;
  }

  if (testType) {
    where.testType = testType;
  }

  if (fromDate && toDate) {
    where.orderedDate = {
      [Op.between]: [new Date(fromDate), new Date(toDate)],
    };
  }

  if (search) {
    where[Op.or] = [
      { patientName: { [Op.like]: `%${search}%` } },
      { testName: { [Op.like]: `%${search}%` } },
      { id: { [Op.like]: `%${search}%` } },
    ];
  }

  // Parse sort
  const order = parseSort(sort, ['orderedDate', 'status', 'createdAt']);

  const { count, rows } = await LabTest.findAndCountAll({
    where,
    order,
    limit,
    offset,
    include: [
      {
        model: Patient,
        as: 'patient',
        attributes: ['id', 'fullName', 'phone', 'dateOfBirth', 'gender'],
        required: false,
      },
    ],
  });

  return paginatedResponse(res, {
    data: rows,
    page,
    limit,
    total: count,
  });
});

/**
 * Get lab test by ID
 * GET /api/lab-tests/:id
 */
const getLabTestById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const labTest = await LabTest.findByPk(id, {
    include: [
      {
        model: Patient,
        as: 'patient',
        required: false,
      },
      {
        model: ServiceOrder,
        as: 'serviceOrder',
        required: false,
      },
      {
        model: MedicalRecord,
        as: 'medicalRecord',
        required: false,
      },
    ],
  });

  if (!labTest) {
    throw new NotFoundError('Không tìm thấy xét nghiệm');
  }

  return successResponse(res, labTest);
});

/**
 * Create new lab test
 * POST /api/lab-tests
 */
const createLabTest = asyncHandler(async (req, res) => {
  const {
    patientId,
    patientName,
    testType,
    testName,
    medicalRecordId,
    serviceOrderId,
    notes,
  } = req.body;

  const labTest = await LabTest.create({
    patientId,
    patientName,
    testType,
    testName,
    medicalRecordId,
    serviceOrderId,
    orderedBy: req.user.fullName,
    orderedById: req.user.id,
    orderedDate: new Date(),
    status: LAB_STATUS.PENDING,
    notes,
  });

  return createdResponse(res, labTest, 'Tạo xét nghiệm thành công');
});

/**
 * Update lab test
 * PUT /api/lab-tests/:id
 */
const updateLabTest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const labTest = await LabTest.findByPk(id);
  if (!labTest) {
    throw new NotFoundError('Không tìm thấy xét nghiệm');
  }

  await labTest.update(updateData);

  return successResponse(res, labTest, 'Cập nhật xét nghiệm thành công');
});

/**
 * Start lab test (set to in progress)
 * POST /api/lab-tests/:id/start
 */
const startLabTest = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const labTest = await LabTest.findByPk(id);
  if (!labTest) {
    throw new NotFoundError('Không tìm thấy xét nghiệm');
  }

  if (labTest.status !== LAB_STATUS.PENDING) {
    throw new BadRequestError('Chỉ có thể bắt đầu xét nghiệm đang chờ');
  }

  await labTest.update({
    status: LAB_STATUS.IN_PROGRESS,
  });

  return successResponse(res, labTest, 'Bắt đầu xét nghiệm thành công');
});

/**
 * Complete lab test with results
 * POST /api/lab-tests/:id/complete
 */
const completeLabTest = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { results, normalRange, notes } = req.body;

  const labTest = await LabTest.findByPk(id);
  if (!labTest) {
    throw new NotFoundError('Không tìm thấy xét nghiệm');
  }

  if (labTest.status === LAB_STATUS.COMPLETED) {
    throw new BadRequestError('Xét nghiệm đã hoàn thành');
  }

  if (!results) {
    throw new BadRequestError('Kết quả không được để trống');
  }

  await labTest.update({
    status: LAB_STATUS.COMPLETED,
    results,
    normalRange,
    notes,
    resultDate: new Date(),
    confirmedBy: req.user.fullName,
    confirmedById: req.user.id,
    confirmedAt: new Date(),
  });

  return successResponse(res, labTest, 'Hoàn thành xét nghiệm thành công');
});

/**
 * Delete lab test (soft delete)
 * DELETE /api/lab-tests/:id
 */
const deleteLabTest = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const labTest = await LabTest.findByPk(id);
  if (!labTest) {
    throw new NotFoundError('Không tìm thấy xét nghiệm');
  }

  await labTest.destroy();

  return noContentResponse(res);
});

/**
 * Get pending lab tests
 * GET /api/lab-tests/pending
 */
const getPendingLabTests = asyncHandler(async (req, res) => {
  const labTests = await LabTest.findAll({
    where: {
      status: {
        [Op.in]: [LAB_STATUS.PENDING, LAB_STATUS.IN_PROGRESS],
      },
    },
    order: [['orderedDate', 'ASC']],
    include: [
      {
        model: Patient,
        as: 'patient',
        attributes: ['id', 'fullName', 'phone', 'dateOfBirth', 'gender'],
        required: false,
      },
    ],
  });

  return successResponse(res, labTests);
});

/**
 * Get lab services catalog
 * GET /api/lab-services
 */
const getLabServices = asyncHandler(async (req, res) => {
  const { type, search, isActive = 'true' } = req.query;

  const where = {};

  if (isActive !== undefined) {
    where.isActive = isActive === 'true';
  }

  if (type) {
    where.type = type;
  }

  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { type: { [Op.like]: `%${search}%` } },
    ];
  }

  const services = await LabService.findAll({
    where,
    order: [['type', 'ASC'], ['name', 'ASC']],
  });

  return successResponse(res, services);
});

/**
 * Create lab service
 * POST /api/lab-services
 */
const createLabService = asyncHandler(async (req, res) => {
  const { name, type, price, description, room, duration, instructions } = req.body;

  const service = await LabService.create({
    name,
    type,
    price,
    description,
    room,
    duration,
    instructions,
  });

  return createdResponse(res, service, 'Tạo dịch vụ xét nghiệm thành công');
});

/**
 * Update lab service
 * PUT /api/lab-services/:id
 */
const updateLabService = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const service = await LabService.findByPk(id);
  if (!service) {
    throw new NotFoundError('Không tìm thấy dịch vụ');
  }

  await service.update(updateData);

  return successResponse(res, service, 'Cập nhật dịch vụ thành công');
});

export {
  getAllLabTests,
  getLabTestById,
  createLabTest,
  updateLabTest,
  startLabTest,
  completeLabTest,
  deleteLabTest,
  getPendingLabTests,
  getLabServices,
  createLabService,
  updateLabService,
};
