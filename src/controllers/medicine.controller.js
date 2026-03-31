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
    const batch = await sequelize.models.QuanLyLoThuoc.findOne({ where: { MaThuoc: medicine.id } });
    await InventoryTransaction.create({
      MaLoThuoc: batch ? batch.Id : null,
      MaThuoc: medicine.id,  // Add direct medicine ID for easier querying
      LoaiGiaoDich: 1,
      SoLuong: quantity,
      SoLuongTruoc: 0,
      SoLuongSau: quantity,
      LyDo: 'Tạo mới thuốc',
      LoaiThamChieu: null,
      MaThamChieu: null,
      NguoiThucHienId: req.user.id,
      GhiChu: null,
      ThoiGianTao: new Date(),
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
  const { type, quantity, reason, referenceType, referenceId, notes, soLo, batchNumber, hanSuDung, ngaySanXuat, giaNhap } = req.body;
  const batchCode = soLo || batchNumber || null;

  const medicine = await Medicine.findByPk(id);
  if (!medicine) {
    throw new NotFoundError('Không tìm thấy thuốc');
  }

  const parsedQuantity = Number(quantity);
  if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
    throw new BadRequestError('Số lượng không hợp lệ');
  }

  // Nếu là nhập kho thì bắt buộc phải có số lô (tên trường có thể là `soLo` hoặc `batchNumber` từ frontend)
  if (type === INVENTORY_TRANSACTION_TYPES.IMPORT && !batchCode) {
    throw new BadRequestError('Số lô (batchNumber) là bắt buộc khi nhập kho');
  }

  // Try to find latest transaction joined to batch -> QuanLyLoThuoc to retrieve batch-level new quantity.
  // If the legacy table QuanLyLoThuoc does not exist, fall back to medicine.quantity.
  let latestTransaction = null;
  try {
    latestTransaction = await InventoryTransaction.findOne({
      include: [
        {
          model: sequelize.models.QuanLyLoThuoc,
          as: 'LoThuoc',
          where: { MaThuoc: medicine.id },
          required: true,
        },
        {
          model: sequelize.models.NguoiDung,
          as: 'NguoiThucHien',
          required: false,
        },
      ],
      order: [['ThoiGianTao', 'DESC']],
    });
  } catch (err) {
    // If the DB doesn't have the legacy batch table, log and continue with fallback
    if (err && err.message && err.message.includes('Invalid object name')) {
      console.warn('Fallback: QuanLyLoThuoc not present, using Medicine.quantity as previousQuantity');
      latestTransaction = null;
    } else {
      throw err;
    }
  }

  const previousQuantity = Number.isFinite(Number(latestTransaction?.SoLuongSau))
    ? Number(latestTransaction.SoLuongSau)
    : Number(medicine.quantity || 0);
  let newQuantity;

  switch (type) {
    case INVENTORY_TRANSACTION_TYPES.IMPORT:
      newQuantity = previousQuantity + parsedQuantity;
      break;
    case INVENTORY_TRANSACTION_TYPES.EXPORT:
      if (previousQuantity < parsedQuantity) {
        throw new BadRequestError('Số lượng xuất vượt quá tồn kho');
      }
      newQuantity = previousQuantity - parsedQuantity;
      break;
    case INVENTORY_TRANSACTION_TYPES.ADJUSTMENT:
      newQuantity = parsedQuantity;
      break;
    default:
      throw new BadRequestError('Loại giao dịch không hợp lệ');
  }

  // Persist quantity only when model contains quantity field.
  if (Object.prototype.hasOwnProperty.call(Medicine.rawAttributes, 'quantity')) {
    medicine.quantity = newQuantity;
    await medicine.save();
  }

  // Determine or create a batch (MaLoThuoc) to associate the transaction with.
  let batch = null;
  try {
    // If this is an import and a batch code (`soLo`) was provided, try to find or create that batch.
    if (type === INVENTORY_TRANSACTION_TYPES.IMPORT && soLo) {
      batch = await sequelize.models.QuanLyLoThuoc.findOne({ where: { MaThuoc: medicine.id, SoLo: soLo } });
      if (!batch) {
        // Parse incoming date strings safely into Date objects (or null) to avoid SQL conversion errors.
        const parseDateSafe = (v) => {
          if (!v) return null;
          const d = new Date(v);
          if (!Number.isFinite(d.getTime())) return null;
          // Return date-only string in ISO format to avoid SQL Server locale/format conversion issues
          return d.toISOString().slice(0, 10);
        };

        // Create a new batch record. Set SoLuongTon to parsedQuantity by default.
        batch = await sequelize.models.QuanLyLoThuoc.create({
          MaThuoc: medicine.id,
          SoLo: soLo,
          HanSuDung: parseDateSafe(hanSuDung),
          NgaySanXuat: parseDateSafe(ngaySanXuat),
          SoLuongTon: parsedQuantity,
          GiaNhap: giaNhap || null,
          TrangThai: 1,
        });
      } else {
        // If batch exists and this is import, increment its SoLuongTon
        batch.SoLuongTon = Number(batch.SoLuongTon || 0) + parsedQuantity;
        await batch.save();
      }
    } else {
      // Default behavior: try to find any batch for this medicine
      batch = await sequelize.models.QuanLyLoThuoc.findOne({ where: { MaThuoc: medicine.id } });
    }
  } catch (err) {
    if (err && err.message && err.message.includes('Invalid object name')) {
      // QuanLyLoThuoc missing — continue with null batch
      batch = null;
    } else {
      throw err;
    }
  }

  const mapTypeToLoai = (t) => {
    switch (t) {
      case INVENTORY_TRANSACTION_TYPES.IMPORT:
        return 1;
      case INVENTORY_TRANSACTION_TYPES.EXPORT:
        return 2;
      case INVENTORY_TRANSACTION_TYPES.ADJUSTMENT:
        return 3;
      default:
        return null;
    }
  };

  const mapRefType = (r) => {
    if (!r) return null;
    if (r === 'Prescription' || String(r).toUpperCase().includes('DON')) return 1;
    if (String(r).toUpperCase().includes('NHAP')) return 2;
    if (String(r).toUpperCase().includes('DIEU') || String(r).toUpperCase().includes('ADJUST')) return 3;
    return null;
  };

  // Create transaction record in legacy table fields
  if (!batch && type === INVENTORY_TRANSACTION_TYPES.IMPORT) {
    // For imports batch must exist (soLo provided and batch created/found above)
    throw new BadRequestError('Không tìm thấy lô thuốc tương ứng với soLo đã cung cấp');
  }

  const created = await InventoryTransaction.create({
    MaLoThuoc: batch ? batch.Id : null,
    MaThuoc: medicine.id,  // Add direct medicine ID for easier querying
    LoaiGiaoDich: mapTypeToLoai(type),
    SoLuong: parsedQuantity,
    SoLuongTruoc: previousQuantity,
    SoLuongSau: newQuantity,
    LyDo: reason,
    LoaiThamChieu: mapRefType(referenceType),
    // MaThamChieu is a UNIQUEIDENTIFIER. Only set it when referenceId is a valid GUID.
    // If referenceId is not a GUID, embed it in the notes JSON under `referenceText` so
    // frontend can still read metadata (expiryDate, minThreshold) without JSON parsing errors.
    MaThamChieu: (() => {
      const isGuid = (s) => typeof s === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(s);
      return isGuid(referenceId) ? referenceId : null;
    })(),
    NguoiThucHienId: req.user.id,
    GhiChu: (() => {
      if (!notes && !referenceId) return null;
      const isGuid = (s) => typeof s === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(s);
      // Try to parse incoming notes as JSON; if not JSON, keep raw text under _raw
      let base = {};
      if (notes) {
        try {
          const parsed = JSON.parse(notes);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) base = parsed;
          else base._raw = String(notes);
        } catch {
          base._raw = String(notes);
        }
      }

      // If referenceId is non-GUID, attach it to the JSON so we don't corrupt the JSON string
      if (referenceId && !isGuid(referenceId)) {
        base.referenceText = String(referenceId);
      }

      // If base contains only raw text, return the raw text; otherwise return JSON string
      const keys = Object.keys(base);
      if (keys.length === 1 && keys[0] === '_raw') return base._raw || null;
      try {
        return Object.keys(base).length ? JSON.stringify(base) : null;
      } catch {
        return notes || null;
      }
    })(),
    // Omit ThoiGianTao to use DB DEFAULT GETDATE() and avoid date conversion issues
  });

  // Reload the created record to get the server-generated ThoiGianTao timestamp
  await created.reload();

  // Normalize created transaction to API shape expected by frontend
  const transaction = {
    id: created.Id,
    medicineId: medicine.id,
    medicineName: medicine.name,
    type,
    quantity: created.SoLuong,
    previousQuantity: created.SoLuongTruoc,
    newQuantity: created.SoLuongSau,
    reason: created.LyDo,
    referenceType: referenceType || null,
    // Prefer returning the original referenceId provided by the API caller when present;
    // fallback to the stored MaThamChieu (GUID) otherwise.
    referenceId: referenceId || created.MaThamChieu,
    performedById: created.NguoiThucHienId,
    performedBy: req.user.fullName,
    notes: created.GhiChu,
    // Use the timestamp from the database (now populated after reload)
    createdAt: created.ThoiGianTao,
    updatedAt: null,
  };

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

  // Build where clause to filter by medicine directly
  const where = { MaThuoc: id };
  
  if (type) {
    // map API type string to numeric LoaiGiaoDich where possible
    const mapType = (t) => {
      switch (t) {
        case INVENTORY_TRANSACTION_TYPES.IMPORT:
          return 1;
        case INVENTORY_TRANSACTION_TYPES.EXPORT:
          return 2;
        case INVENTORY_TRANSACTION_TYPES.ADJUSTMENT:
          return 3;
        default:
          return null;
      }
    };
    where.LoaiGiaoDich = mapType(type);
  }

  if (fromDate && toDate) {
    where.ThoiGianTao = {
      [Op.between]: [new Date(fromDate), new Date(toDate)],
    };
  }

  // Optional: include batch and medicine details for display
  const include = [
    {
      model: sequelize.models.QuanLyLoThuoc,
      as: 'LoThuoc',
      required: false,  // LEFT JOIN - even transactions without batch will be returned
      include: [{ model: sequelize.models.Thuoc, as: 'Thuoc', required: false }],
    },
    { model: sequelize.models.NguoiDung, as: 'NguoiThucHien', required: false },
  ];

  try {
    const { count, rows } = await InventoryTransaction.findAndCountAll({
      where,
      include,
      order: [['ThoiGianTao', 'DESC']],
      limit,
      offset,
    });

    const mapped = (rows || []).map((r) => ({
      id: r.Id,
      medicineId: r.MaThuoc ?? id,
      medicineName: r.LoThuoc?.Thuoc?.TenThuoc ?? '',
      type: r.LoaiGiaoDich === 1 ? INVENTORY_TRANSACTION_TYPES.IMPORT : r.LoaiGiaoDich === 2 ? INVENTORY_TRANSACTION_TYPES.EXPORT : INVENTORY_TRANSACTION_TYPES.ADJUSTMENT,
      quantity: r.SoLuong,
      previousQuantity: r.SoLuongTruoc,
      newQuantity: r.SoLuongSau,
      reason: r.LyDo,
      referenceType: r.LoaiThamChieu,
      referenceId: r.MaThamChieu,
      performedById: r.NguoiThucHienId,
      performedBy: r.NguoiThucHien?.HoTen,
      notes: r.GhiChu,
      createdAt: r.ThoiGianTao,
      updatedAt: null,
    }));

    return paginatedResponse(res, {
      data: mapped,
      page,
      limit,
      total: mapped.length,  // Count only filtered results
    });
  } catch (err) {
    console.error('getInventoryTransactions error:', err.message || err);
    // Fallback: return empty list on error
    return paginatedResponse(res, {
      data: [],
      page,
      limit,
      total: 0,
    });
  }
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

  // Map API type string to numeric LoaiGiaoDich
  if (type) {
    const mapType = (t) => {
      switch (t) {
        case INVENTORY_TRANSACTION_TYPES.IMPORT:
          return 1;
        case INVENTORY_TRANSACTION_TYPES.EXPORT:
          return 2;
        case INVENTORY_TRANSACTION_TYPES.ADJUSTMENT:
          return 3;
        default:
          return null;
      }
    };
    where.LoaiGiaoDich = mapType(type);
  }

  // Filter by medicine ID (MaThuoc field)
  if (medicineId) {
    where.MaThuoc = medicineId;
  }

  // Filter by date range (ThoiGianTao field)
  if (fromDate && toDate) {
    where.ThoiGianTao = {
      [Op.between]: [new Date(fromDate), new Date(toDate)],
    };
  }

  // Parse sort parameter - use ThoiGianTao as the allowed column for sorting
  // If client sends 'createdAt' it will be ignored and ThoiGianTao will be used as fallback
  const order = parseSort(sort, ['ThoiGianTao'], 'ThoiGianTao:desc');

  try {
    // Build include to optionally join to batches/medicine for display details
    const include = [
      {
        model: sequelize.models.QuanLyLoThuoc,
        as: 'LoThuoc',
        required: false,  // LEFT JOIN even if no batch linked
        include: [{ model: sequelize.models.Thuoc, as: 'Thuoc', required: false }],
      },
      { model: sequelize.models.NguoiDung, as: 'NguoiThucHien', required: false },
    ];

    const { count, rows } = await InventoryTransaction.findAndCountAll({
      where,
      order,
      limit,
      offset,
      include,
    });

    console.log(`[getAllInventoryTransactions] where=${JSON.stringify(where)}, found=${rows.length} transactions`);

    const mapped = (rows || []).map((r) => ({
      id: r.Id,
      medicineId: r.MaThuoc ?? null,  // Use MaThuoc field directly from transaction record
      medicineName: r.LoThuoc?.Thuoc?.TenThuoc ?? '',
      type: r.LoaiGiaoDich === 1 ? INVENTORY_TRANSACTION_TYPES.IMPORT : r.LoaiGiaoDich === 2 ? INVENTORY_TRANSACTION_TYPES.EXPORT : INVENTORY_TRANSACTION_TYPES.ADJUSTMENT,
      quantity: r.SoLuong,
      previousQuantity: r.SoLuongTruoc,
      newQuantity: r.SoLuongSau,
      reason: r.LyDo,
      referenceType: r.LoaiThamChieu,
      referenceId: r.MaThamChieu,
      performedById: r.NguoiThucHienId,
      performedBy: r.NguoiThucHien?.HoTen,
      notes: r.GhiChu,
      createdAt: r.ThoiGianTao,
      updatedAt: null,
    }));

    console.log(`[getAllInventoryTransactions] returning ${mapped.length} mapped transactions`);

    return paginatedResponse(res, {
      data: mapped,
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
