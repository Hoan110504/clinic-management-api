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
  // Map query params to available columns in DB (Thuoc): TenThuoc, DonVi, NhomThuoc, TrangThai
  if (isActive !== undefined) {
    where.isActive = isActive === 'true';
  } else {
    where.isActive = true;
  }

  if (category) {
    where.category = category;
  }

  if (search) {
    where[Op.or] = [
      { name: { [Op.like]: `%${search}%` } },
      { id: { [Op.like]: `%${search}%` } },
    ];
  }

  // Simple ordering fallback (default to id:desc for global descending)
  const order = parseSort(sort, ['id', 'name', 'category', 'unit', 'price'], 'id:desc');

  try {
    const { count, rows } = await Medicine.findAndCountAll({
      where,
      order,
      limit,
      offset,
      attributes: ['id', 'name', 'unit', 'category', 'price', 'isActive'],
    });

    // Normalize result shape to { id, name, category, unit, price, isActive }
    const data = (rows || []).map(r => ({
      id: r.id,
      name: r.name,
      category: r.category,
      unit: r.unit,
      price: r.price,
      isActive: r.isActive,
    }));

    return paginatedResponse(res, {
      data,
      page,
      limit,
      total: count,
    });
  } catch (err) {
    console.error('getAllMedicines: DB error', err.message || err);
    // If table doesn't exist or other DB error, return empty list to avoid 500 for caller UI
    return paginatedResponse(res, {
      data: [],
      page,
      limit,
      total: 0,
    });
  }
});

/**
 * Get medicine by ID
 * GET /api/medicines/:id
 */
const getMedicineById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
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
  } catch (err) {
    console.error('getMedicineById: DB error', err.message || err);
    // Return not found for missing table or other DB issues to avoid exposing SQL errors
    throw new NotFoundError('Không tìm thấy thuốc');
  }
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
  try {
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
  } catch (err) {
    console.error('getLowStockMedicines: DB error', err.message || err);
    return successResponse(res, []);
  }
});

/**
 * Get expiring medicines
 * GET /api/medicines/expiring
 */
const getExpiringMedicines = asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + parseInt(days, 10));

  try {
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
  } catch (err) {
    console.error('getExpiringMedicines: DB error', err.message || err);
    return successResponse(res, []);
  }
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

  try {
    const isNumeric = /^\d+$/.test(q);
    const orClauses = [];
    orClauses.push({ name: { [Op.like]: `%${q}%` } });
    if (isNumeric) {
      orClauses.push({ id: parseInt(q, 10) });
    }

    const medicines = await Medicine.findAll({
      where: {
        isActive: true,
        [Op.or]: orClauses,
      },
      attributes: ['id', 'name', 'unit'],
      limit: parseInt(limit, 10),
      order: [['name', 'ASC']],
    });

    return successResponse(res, medicines);
  } catch (err) {
    console.error('searchMedicines: DB error', err.message || err);
    return successResponse(res, []);
  }
});

/**
 * Get distinct medicine categories (NhomThuoc)
 * GET /api/medicines/categories
 */
const getMedicineCategories = asyncHandler(async (req, res) => {
  try {
    const rows = await Medicine.findAll({
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('NhomThuoc')), 'category']],
      where: {
        isActive: true,
      },
      order: [[sequelize.col('NhomThuoc'), 'ASC']],
      raw: true,
    });

    const categories = (rows || [])
      .map((r) => (r && r.category ? String(r.category).trim() : ''))
      .filter(Boolean);

    return successResponse(res, categories);
  } catch (err) {
    console.error('getMedicineCategories: DB error', err.message || err);
    return successResponse(res, []);
  }
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

  try {
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
  } catch (err) {
    console.error('getAllInventoryTransactions: DB error', err.message || err);
    return paginatedResponse(res, {
      data: [],
      page,
      limit,
      total: 0,
    });
  }
});

/**
 * Get all medicines without pagination (for admin dropdowns etc.)
 * GET /api/medicines/all
 */
const getAllMedicinesUnpaginated = asyncHandler(async (req, res) => {
  const { category, search, isActive, sort } = req.query;
  const where = {};
  if (isActive !== undefined) where.isActive = isActive === 'true';
  else where.isActive = true;
  if (category) where.category = category;
  if (search) {
    const isNumeric = /^\d+$/.test(search);
    if (isNumeric) {
      where[Op.or] = [
        { id: parseInt(search, 10) },
        { name: { [Op.like]: `%${search}%` } },
      ];
    } else {
      where[Op.or] = [{ name: { [Op.like]: `%${search}%` } }];
    }
  }

  try {
    const rows = await Medicine.findAll({
      where,
      order: parseSort(sort || 'id:desc', ['id', 'name', 'category', 'unit', 'price']),
      attributes: ['id', 'name', 'unit', 'category', 'price', 'isActive'],
      raw: true,
    });

    const data = (rows || []).map(r => ({
      id: r.id,
      name: r.name,
      category: r.category,
      unit: r.unit,
      price: r.price,
      isActive: r.isActive,
    }));

    return successResponse(res, data);
  } catch (err) {
    console.error('getAllMedicinesUnpaginated: DB error', err.message || err);
    return successResponse(res, []);
  }
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
  getMedicineCategories,
  getAllMedicinesUnpaginated,
};
