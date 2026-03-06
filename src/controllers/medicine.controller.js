/**
 * Medicine Controller
 * Handles medicine and inventory operations
 */
import { Op } from 'sequelize';
import { sequelize } from '../models/database.js';
import { Medicine, InventoryTransaction } from '../models/index.js';
import { asyncHandler, parsePagination, parseSort } from '../utils/helpers.js';
import {
  successResponse,
  createdResponse,
  paginatedResponse,
  noContentResponse,
} from '../utils/response.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { INVENTORY_TRANSACTION_TYPES } from '../config/constants.js';

/**
 * Get all medicines (with pagination and filters)
 * GET /api/medicines
 */
const getAllMedicines = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { search, category, lowStock, expiring, isActive, sort } = req.query;

  // Build where clause
  const where = {};

  if (isActive !== undefined) {
    where.isActive = isActive === 'true';
  } else {
    where.isActive = true;
  }

  if (category) {
    where.category = category;
  }

  if (lowStock === 'true') {
    where.quantity = {
      [Op.lte]: sequelize.col('min_quantity'),
    };
  }

  if (expiring === 'true') {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    where.expiryDate = {
      [Op.lte]: thirtyDaysFromNow,
      [Op.gte]: new Date(),
    };
  }

  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { id: { [Op.like]: `%${search}%` } },
      { genericName: { [Op.like]: `%${search}%` } },
    ];
  }

  // Parse sort
  const order = parseSort(sort, ['name', 'quantity', 'expiryDate', 'createdAt']);

  const { count, rows } = await Medicine.findAndCountAll({
    where,
    order,
    limit,
    offset,
  });

  return paginatedResponse(res, {
    data: rows,
    page,
    limit,
    total: count,
  });
});

/**
 * Get medicine by ID
 * GET /api/medicines/:id
 */
const getMedicineById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const medicine = await Medicine.findByPk(id, {
    include: [
      {
        model: InventoryTransaction,
        as: 'transactions',
        limit: 10,
        order: [['createdAt', 'DESC']],
      },
    ],
  });

  if (!medicine) {
    throw new NotFoundError('Không tìm thấy thuốc');
  }

  return successResponse(res, medicine);
});

/**
 * Create new medicine
 * POST /api/medicines
 */
const createMedicine = asyncHandler(async (req, res) => {
  const {
    name,
    genericName,
    unit,
    price,
    quantity,
    minQuantity,
    category,
    supplier,
    manufacturer,
    batchNumber,
    expiryDate,
    manufacturingDate,
    description,
    dosageInstructions,
    sideEffects,
    contraindications,
    storageConditions,
  } = req.body;

  const medicine = await Medicine.create({
    name,
    genericName,
    unit,
    price,
    quantity: quantity || 0,
    minQuantity: minQuantity || 0,
    category,
    supplier,
    manufacturer,
    batchNumber,
    expiryDate,
    manufacturingDate,
    description,
    dosageInstructions,
    sideEffects,
    contraindications,
    storageConditions,
  });

  // Create initial inventory transaction if quantity > 0
  if (quantity > 0) {
    await InventoryTransaction.create({
      medicineId: medicine.id,
      medicineName: medicine.name,
      type: INVENTORY_TRANSACTION_TYPES.IMPORT,
      quantity,
      previousQuantity: 0,
      newQuantity: quantity,
      reason: 'Tạo mới thuốc',
      performedById: req.user.id,
      performedBy: req.user.fullName,
    });
  }

  return createdResponse(res, medicine, 'Tạo thuốc thành công');
});

/**
 * Update medicine
 * PUT /api/medicines/:id
 */
const updateMedicine = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  const medicine = await Medicine.findByPk(id);
  if (!medicine) {
    throw new NotFoundError('Không tìm thấy thuốc');
  }

  // Don't allow direct quantity update - use inventory transactions
  delete updateData.quantity;

  await medicine.update(updateData);

  return successResponse(res, medicine, 'Cập nhật thuốc thành công');
});

/**
 * Delete medicine (soft delete)
 * DELETE /api/medicines/:id
 */
const deleteMedicine = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const medicine = await Medicine.findByPk(id);
  if (!medicine) {
    throw new NotFoundError('Không tìm thấy thuốc');
  }

  await medicine.destroy();

  return noContentResponse(res);
});

/**
 * Adjust inventory (import/export)
 * POST /api/medicines/:id/inventory
 */
const adjustInventory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { type, quantity, reason, referenceType, referenceId, notes } = req.body;

  const medicine = await Medicine.findByPk(id);
  if (!medicine) {
    throw new NotFoundError('Không tìm thấy thuốc');
  }

  const previousQuantity = medicine.quantity;
  let newQuantity;

  switch (type) {
    case INVENTORY_TRANSACTION_TYPES.IMPORT:
      newQuantity = previousQuantity + quantity;
      break;
    case INVENTORY_TRANSACTION_TYPES.EXPORT:
      if (previousQuantity < quantity) {
        throw new BadRequestError('Số lượng xuất vượt quá tồn kho');
      }
      newQuantity = previousQuantity - quantity;
      break;
    case INVENTORY_TRANSACTION_TYPES.ADJUSTMENT:
      newQuantity = quantity;
      break;
    default:
      throw new BadRequestError('Loại giao dịch không hợp lệ');
  }

  // Update medicine quantity
  medicine.quantity = newQuantity;
  await medicine.save();

  // Create transaction record
  const transaction = await InventoryTransaction.create({
    medicineId: medicine.id,
    medicineName: medicine.name,
    type,
    quantity,
    previousQuantity,
    newQuantity,
    reason,
    referenceType,
    referenceId,
    notes,
    performedById: req.user.id,
    performedBy: req.user.fullName,
  });

  return successResponse(
    res,
    {
      medicine,
      transaction,
    },
    `${type} kho thành công`
  );
});

/**
 * Get inventory transactions
 * GET /api/medicines/:id/transactions
 */
const getInventoryTransactions = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { page, limit, offset } = parsePagination(req.query);
  const { type, fromDate, toDate } = req.query;

  const where = { medicineId: id };

  if (type) {
    where.type = type;
  }

  if (fromDate && toDate) {
    where.createdAt = {
      [Op.between]: [new Date(fromDate), new Date(toDate)],
    };
  }

  const { count, rows } = await InventoryTransaction.findAndCountAll({
    where,
    order: [['createdAt', 'DESC']],
    limit,
    offset,
  });

  return paginatedResponse(res, {
    data: rows,
    page,
    limit,
    total: count,
  });
});

/**
 * Get low stock medicines
 * GET /api/medicines/low-stock
 */
const getLowStockMedicines = asyncHandler(async (req, res) => {
  const medicines = await Medicine.findAll({
    where: {
      isActive: true,
      quantity: {
        [Op.lte]: sequelize.col('min_quantity'),
      },
    },
    order: [['quantity', 'ASC']],
  });

  return successResponse(res, medicines);
});

/**
 * Get expiring medicines
 * GET /api/medicines/expiring
 */
const getExpiringMedicines = asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + parseInt(days, 10));

  const medicines = await Medicine.findAll({
    where: {
      isActive: true,
      expiryDate: {
        [Op.lte]: futureDate,
        [Op.gte]: new Date(),
      },
    },
    order: [['expiryDate', 'ASC']],
  });

  return successResponse(res, medicines);
});

/**
 * Search medicines (quick search)
 * GET /api/medicines/search
 */
const searchMedicines = asyncHandler(async (req, res) => {
  const { q, limit = 10 } = req.query;

  if (!q || q.length < 2) {
    return successResponse(res, []);
  }

  const medicines = await Medicine.findAll({
    where: {
      isActive: true,
      [Op.or]: [
        { name: { [Op.like]: `%${q}%` } },
        { id: { [Op.like]: `%${q}%` } },
      ],
    },
    attributes: ['id', 'name', 'unit', 'price', 'quantity'],
    limit: parseInt(limit, 10),
    order: [['name', 'ASC']],
  });

  return successResponse(res, medicines);
});

/**
 * Get all inventory transactions (admin view)
 * GET /api/inventory/transactions
 */
const getAllInventoryTransactions = asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query);
  const { type, medicineId, fromDate, toDate, sort } = req.query;

  const where = {};

  if (type) {
    where.type = type;
  }

  if (medicineId) {
    where.medicineId = medicineId;
  }

  if (fromDate && toDate) {
    where.createdAt = {
      [Op.between]: [new Date(fromDate), new Date(toDate)],
    };
  }

  const order = parseSort(sort, ['createdAt']);

  const { count, rows } = await InventoryTransaction.findAndCountAll({
    where,
    order,
    limit,
    offset,
    include: [
      {
        model: Medicine,
        as: 'medicine',
        attributes: ['id', 'name', 'unit'],
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

export {
  getAllMedicines,
  getMedicineById,
  createMedicine,
  updateMedicine,
  deleteMedicine,
  adjustInventory,
  getInventoryTransactions,
  getLowStockMedicines,
  getExpiringMedicines,
  searchMedicines,
  getAllInventoryTransactions,
};
