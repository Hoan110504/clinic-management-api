/**
 * Medicine Controller
 * Handles medicine and inventory operations
 */
import { Op } from 'sequelize';
import { sequelize } from '../models/database.js';
import { Medicine, InventoryTransaction, User } from '../models/index.js';
import { asyncHandler, parsePagination, parseSort } from '../utils/helpers.js';
import {
  successResponse,
  createdResponse,
  paginatedResponse,
  noContentResponse,
  errorResponse,
} from '../utils/response.js';
import { NotFoundError, BadRequestError } from '../utils/errors.js';
import { INVENTORY_TRANSACTION_TYPES } from '../config/constants.js';

const normalizeIdKey = (id) => String(id || '').trim().toLowerCase();

const formatPerformerDisplay = (name, code) => {
  if (name && code) return `${name} - ${code}`;
  return name || code || null;
};

const ROLE_PREFIX_BY_ROLE = {
  admin: 'AD',
  doctor: 'BS',
  receptionist: 'LT',
  pharmacist: 'DS',
  patient: 'BN',
};

const ROLE_PREFIX_BY_VAITRO = {
  1: 'AD',
  2: 'BS',
  3: 'LT',
  4: 'DS',
  5: 'BN',
};

const buildPerformerLookup = async (performerIds = []) => {
  const rawIds = [...new Set((performerIds || []).filter(Boolean))];
  const performerMap = new Map();
  if (!rawIds.length) return performerMap;

  const [appUsers, legacyUsers] = await Promise.all([
    User.findAll({ attributes: ['id', 'fullName', 'username', 'role', 'staffCode'], where: { id: { [Op.in]: rawIds } }, raw: true }).catch((err) => {
      console.error('buildPerformerLookup: failed to read users', err?.message || err);
      return [];
    }),
    (sequelize.models && sequelize.models.NguoiDung && typeof sequelize.models.NguoiDung.findAll === 'function'
      ? sequelize.models.NguoiDung.findAll({ attributes: ['Id', 'HoTen', 'TenDangNhap', 'VaiTro', 'MaNguoiDung'], where: { Id: { [Op.in]: rawIds } }, raw: true }).catch(() => [])
      : Promise.resolve([])),
  ]);

  // Precompute dynamic codes only for those without stored code
  const appRoles = [...new Set(appUsers.map((u) => u.role).filter(Boolean))];
  const legacyRoles = [...new Set(legacyUsers.map((u) => Number(u.VaiTro)).filter(Boolean))];

  const allAppUsersInRoles = appRoles.length
    ? await User.findAll({ attributes: ['id', 'role'], where: { role: { [Op.in]: appRoles } }, raw: true }).catch(() => [])
    : [];

  const allLegacyUsersInRoles = legacyRoles.length
    ? await (sequelize.models && sequelize.models.NguoiDung && typeof sequelize.models.NguoiDung.findAll === 'function'
        ? sequelize.models.NguoiDung.findAll({ attributes: ['Id', 'VaiTro'], where: { VaiTro: { [Op.in]: legacyRoles } }, raw: true }).catch(() => [])
        : Promise.resolve([]))
    : [];

  const appCodeMap = new Map();
  for (const role of appRoles) {
    const sameRole = allAppUsersInRoles.filter((u) => u.role === role).sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')));
    const prefix = ROLE_PREFIX_BY_ROLE[role] || 'UN';
    sameRole.forEach((u, index) => appCodeMap.set(normalizeIdKey(u.id), `${prefix}${String(index + 1).padStart(3, '0')}`));
  }

  const legacyCodeMap = new Map();
  for (const v of legacyRoles) {
    const sameRole = allLegacyUsersInRoles.filter((u) => Number(u.VaiTro) === Number(v)).sort((a, b) => String(a.Id || '').localeCompare(String(b.Id || '')));
    const prefix = ROLE_PREFIX_BY_VAITRO[v] || 'UN';
    sameRole.forEach((u, index) => legacyCodeMap.set(normalizeIdKey(u.Id), `${prefix}${String(index + 1).padStart(3, '0')}`));
  }

  for (const lu of legacyUsers) {
    const idKey = normalizeIdKey(lu.Id);
    const name = lu.HoTen || null;
    const code = lu.MaNguoiDung || legacyCodeMap.get(idKey) || lu.TenDangNhap || null;
    performerMap.set(idKey, { name, code, display: formatPerformerDisplay(name, code) });
  }

  for (const au of appUsers) {
    const idKey = normalizeIdKey(au.id);
    const name = au.fullName || null;
    const code = au.staffCode || appCodeMap.get(idKey) || au.username || null;
    performerMap.set(idKey, { name, code, display: formatPerformerDisplay(name, code) });
  }

  return performerMap;
};

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
    where.IsActive = isActive === 'true';
  } else {
    where.IsActive = true;
  }

  if (category) {
    where.Category = category;
  }

  if (search) {
    const isNumeric = /^\d+$/.test(String(search));
    where[Op.or] = isNumeric
      ? [{ Name: { [Op.like]: `%${search}%` } }, { Id: Number(search) }]
      : [{ Name: { [Op.like]: `%${search}%` } }];
  }

  // Simple ordering fallback (default to Id:desc for global descending)
  const order = parseSort(sort, ['Id', 'Name', 'Category', 'Unit', 'Price'], 'Id:desc');

  try {
    const { count, rows } = await Medicine.findAndCountAll({
      where,
      order,
      limit,
      offset,
      attributes: ['Id', 'Name', 'Unit', 'Category', 'Price', 'IsActive'],
    });

    // Normalize result shape to { id, name, category, unit, price, isActive }
    const data = (rows || []).map(r => ({
      id: r.Id,
      name: r.Name,
      category: r.Category,
      unit: r.Unit,
      price: r.Price,
      isActive: r.IsActive,
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
    Name: name,
    Unit: unit,
    Price: price,
    Category: category,
    IsActive: true,
  });

  // Create initial inventory transaction if quantity > 0
  if (quantity > 0) {
    const batch = await sequelize.models.MedicineBatch.findOne({ where: { MedicineId: medicine.Id } });
    await InventoryTransaction.create({
      MedicineBatchId: batch ? batch.Id : null,
      MedicineId: medicine.Id,
      TransactionType: InventoryTransaction.TRANSACTION_TYPE.IMPORT || 1,
      Quantity: quantity,
      QuantityBefore: 0,
      QuantityAfter: quantity,
      Reason: 'Tạo mới thuốc',
      ReferenceType: null,
      ReferenceId: null,
      PerformedByUserId: req.user.id,
      Note: null,
      CreatedAt: new Date(),
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

  let medicine = await Medicine.findByPk(id);
  if (!medicine) {
    // Try flexible lookups: numeric id, alternative keys (MaThuoc/Code/Name)
    console.warn(`adjustInventory: Medicine.findByPk(${id}) returned null, attempting fallback lookups`);
    const numId = Number(id);
    if (!Number.isNaN(numId)) {
      medicine = await Medicine.findByPk(numId).catch(() => null);
    }
    if (!medicine) {
      const rawAttrs = Medicine.rawAttributes || {};
      const altFields = ['Id', 'MaThuoc', 'Code', 'code', 'Name', 'name'];
      const orClauses = [];
      for (const f of altFields) {
        if (Object.prototype.hasOwnProperty.call(rawAttrs, f)) {
          orClauses.push({ [f]: id });
        }
      }
      if (orClauses.length) {
        medicine = await Medicine.findOne({ where: { [Op.or]: orClauses } }).catch(() => null);
      }
    }
    if (!medicine) {
      console.error(`adjustInventory: unable to resolve Medicine for id='${id}'`);
      throw new NotFoundError('Không tìm thấy thuốc');
    }
  }

  // Don't allow direct quantity update - stock is tracked by transactions
  delete updateData.quantity;

  const mappedUpdate = {};
  if (Object.prototype.hasOwnProperty.call(updateData, 'name')) mappedUpdate.Name = updateData.name;
  if (Object.prototype.hasOwnProperty.call(updateData, 'unit')) mappedUpdate.Unit = updateData.unit;
  if (Object.prototype.hasOwnProperty.call(updateData, 'category')) mappedUpdate.Category = updateData.category;
  if (Object.prototype.hasOwnProperty.call(updateData, 'price')) mappedUpdate.Price = updateData.price;
  if (Object.prototype.hasOwnProperty.call(updateData, 'isActive')) mappedUpdate.IsActive = updateData.isActive;

  await medicine.update(mappedUpdate);

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
  // Accept medicine id from route param or from request body (some clients send it in body)
  const medParam = (req.params && req.params.id) || req.body.medicineId || (req.body.medicine && req.body.medicine.id) || null;
  const { type, quantity, reason, referenceType, referenceId, notes, soLo, batchNumber, hanSuXung, hanSuDung, ngaySanXuat, giaNhap } = req.body;
  const batchCode = soLo || batchNumber || null;

  // Resolve medicine using multiple fallbacks to avoid false 404s
  let medicine = null;
  if (medParam) medicine = await Medicine.findByPk(medParam).catch(() => null);
  if (!medicine && medParam) {
    const numId = Number(medParam);
    if (!Number.isNaN(numId)) {
      medicine = await Medicine.findByPk(numId).catch(() => null);
    }
  }
  if (!medicine && medParam) {
    const rawAttrs = Medicine.rawAttributes || {};
    const altFields = ['Id', 'MaThuoc', 'Code', 'code', 'Name', 'name'];
    const orClauses = [];
    for (const f of altFields) {
      if (Object.prototype.hasOwnProperty.call(rawAttrs, f)) {
        orClauses.push({ [f]: medParam });
      }
    }
    if (orClauses.length) {
      medicine = await Medicine.findOne({ where: { [Op.or]: orClauses } }).catch(() => null);
    }
  }
  if (!medicine && req.params && req.params.id) {
    medicine = await Medicine.findByPk(req.params.id).catch(() => null);
  }
  if (!medicine) {
    console.error(`adjustInventory: unable to resolve Medicine for id param='${req.params?.id}', medParam='${medParam}'`);
    // Provide a helpful 404 with diagnostic details to assist debugging client-server mismatch
    const details = { medParam: medParam || null, paramsId: req.params?.id || null, bodyMedicineId: req.body?.medicineId || null };
    try {
      const total = await Medicine.count().catch(() => null);
      if (total !== null) details.availableMedicines = total;
    } catch {}
    return errorResponse(res, 'Không tìm thấy thuốc', 404, 'NOT_FOUND', details);
  }

  const parsedQuantity = Number(quantity);
  if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
    throw new BadRequestError('Số lượng không hợp lệ');
  }

  // Nếu là nhập kho thì bắt buộc phải có số lô (tên trường có thể là `soLo` hoặc `batchNumber` từ frontend)
  if (type === INVENTORY_TRANSACTION_TYPES.IMPORT && !batchCode) {
    throw new BadRequestError('Số lô (batchNumber) là bắt buộc khi nhập kho');
  }

  // Try to find latest transaction for this medicine (new InventoryTransaction schema).
  // If none found, fall back to medicine.quantity.
  let latestTransaction = null;
  try {
    latestTransaction = await InventoryTransaction.findOne({
      where: { MedicineId: medicine.Id },
      include: [
        { model: sequelize.models.MedicineBatch, as: 'batch', required: false },
        { model: sequelize.models.User, as: 'performedBy', required: false },
      ],
      order: [['CreatedAt', 'DESC']],
    });
  } catch (err) {
    console.warn('latestTransaction lookup failed, falling back to medicine.quantity', err?.message || err);
    latestTransaction = null;
  }

  let previousQuantity;
  if (Number.isFinite(Number(latestTransaction?.QuantityAfter))) {
    previousQuantity = Number(latestTransaction.QuantityAfter);
  } else {
    // If Medicine model has a `quantity` field use it, otherwise derive from batches
    if (Object.prototype.hasOwnProperty.call(Medicine.rawAttributes, 'quantity')) {
      previousQuantity = Number(medicine.quantity || 0);
    } else {
      try {
        const batchTotal = await sequelize.models.MedicineBatch.sum('QuantityInStock', { where: { MedicineId: medicine.Id } });
        previousQuantity = Number.isFinite(Number(batchTotal)) ? Number(batchTotal) : 0;
      } catch (sumErr) {
        console.warn('Failed to compute batch total for previousQuantity fallback', sumErr?.message || sumErr);
        previousQuantity = 0;
      }
    }
  }
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
    // Helper to safely parse dates
    const parseDateSafe = (v) => {
      if (!v) return null;
      const d = new Date(v);
      if (!Number.isFinite(d.getTime())) return null;
      return d.toISOString().slice(0, 10);
    };

    // IMPORT: find or create target batch, increment its QuantityInStock
    if (type === INVENTORY_TRANSACTION_TYPES.IMPORT && soLo) {
      batch = await sequelize.models.MedicineBatch.findOne({ where: { MedicineId: medicine.Id, BatchNumber: soLo } });
      if (!batch) {
        try {
          batch = await sequelize.models.MedicineBatch.create({
            MedicineId: medicine.Id,
            BatchNumber: soLo,
            ExpiryDate: parseDateSafe(hanSuDung),
            ManufactureDate: parseDateSafe(ngaySanXuat),
            QuantityInStock: parsedQuantity,
            ImportPrice: giaNhap || null,
            Status: 1,
          }, {
            fields: ['MedicineId', 'BatchNumber', 'ExpiryDate', 'ManufactureDate', 'QuantityInStock', 'ImportPrice', 'Status'],
          });
        } catch (createErr) {
          const msg = (createErr && createErr.parent && createErr.parent.message) ? String(createErr.parent.message).toLowerCase() : (createErr && createErr.message ? String(createErr.message).toLowerCase() : '');
          if (msg.includes('identity_insert') || msg.includes('cannot insert explicit value for identity column') || msg.includes('insert explicit value for identity')) {
            try {
              const cols = ['MedicineId','BatchNumber','ExpiryDate','ManufactureDate','QuantityInStock','ImportPrice','Status'];
              const values = [medicine.Id, soLo, parseDateSafe(hanSuDung), parseDateSafe(ngaySanXuat), parsedQuantity, giaNhap || null, 1];
              const placeholders = cols.map((c, i) => `:p${i}`).join(',');
              const colList = cols.map(c => `[${c}]`).join(',');
              const replacements = {};
              values.forEach((v, i) => { replacements[`p${i}`] = v; });
              const sql = `INSERT INTO [MedicineBatches] (${colList}) VALUES (${placeholders});`;
              await sequelize.query(sql, { replacements, type: sequelize.QueryTypes.INSERT });
              batch = await sequelize.models.MedicineBatch.findOne({ where: { MedicineId: medicine.Id, BatchNumber: soLo } });
            } catch (rawErr) {
              console.error('Fallback raw INSERT for MedicineBatches failed', rawErr?.message || rawErr);
              throw createErr;
            }
          } else {
            throw createErr;
          }
        }
      } else {
        batch.QuantityInStock = Number(batch.QuantityInStock || 0) + parsedQuantity;
        await batch.save();
      }

    // EXPORT: target a specific batch if provided, otherwise pick a batch with sufficient stock
    } else if (type === INVENTORY_TRANSACTION_TYPES.EXPORT) {
      if (soLo) {
        batch = await sequelize.models.MedicineBatch.findOne({ where: { MedicineId: medicine.Id, BatchNumber: soLo } });
        if (!batch) {
          throw new BadRequestError('Không tìm thấy lô thuốc tương ứng với soLo đã cung cấp');
        }
        const available = Number(batch.QuantityInStock || 0);
        if (available < parsedQuantity) {
          throw new BadRequestError('Số lượng xuất vượt quá số lượng tồn trong lô thuốc');
        }
        batch.QuantityInStock = available - parsedQuantity;
        await batch.save();
      } else {
        // find any batch with enough stock, prefer earliest expiry
        batch = await sequelize.models.MedicineBatch.findOne({
          where: { MedicineId: medicine.Id, QuantityInStock: { [Op.gte]: parsedQuantity } },
          order: [['ExpiryDate', 'ASC']],
        });
        if (!batch) {
          throw new BadRequestError('Không đủ tồn kho để xuất');
        }
        batch.QuantityInStock = Number(batch.QuantityInStock || 0) - parsedQuantity;
        await batch.save();
      }

    } else {
      // Default behavior: try to find any batch for this medicine
      batch = await sequelize.models.MedicineBatch.findOne({ where: { MedicineId: medicine.Id } });
    }
  } catch (err) {
    // If any error occurs during batch ops, surface it
    throw err;
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

  let created;
  try {
    created = await InventoryTransaction.create({
      MedicineBatchId: batch ? batch.Id : null,
      MedicineId: medicine.Id,
      TransactionType: mapTypeToLoai(type),
      Quantity: parsedQuantity,
      QuantityBefore: previousQuantity,
      QuantityAfter: newQuantity,
      Reason: reason,
      ReferenceType: mapRefType(referenceType),
      PerformedByUserId: req.user.id,
      // Use DB server timestamp to avoid timezone string conversion issues
      CreatedAt: sequelize.literal('GETDATE()'),
      Note: (() => {
        if (!notes && !referenceId) return null;
        const isGuid = (s) => typeof s === 'string' && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(s);
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
        if (referenceId && !isGuid(referenceId)) base.referenceText = String(referenceId);
        const keys = Object.keys(base);
        if (keys.length === 1 && keys[0] === '_raw') return base._raw || null;
        try {
          return Object.keys(base).length ? JSON.stringify(base) : null;
        } catch {
          return notes || null;
        }
      })(),
    });
  } catch (err) {
    console.error('InventoryTransaction.create failed:', err);
    // Return detailed DB error for debugging (remove or sanitize in production)
    const dbMsg = err && err.original && err.original.message ? err.original.message : (err && err.message) || 'unknown db error';
    const payload = {
      message: dbMsg,
      original: err && err.original ? err.original : null,
      sql: err && err.sql ? err.sql : null,
      stack: err && err.stack ? err.stack : null,
    };
      // Try fallback: raw INSERT without OUTPUT (some SQL Server setups fail with OUTPUT)
      try {
        const intendedCols = ['MedicineBatchId','MedicineId','TransactionType','Quantity','QuantityBefore','QuantityAfter','Reason','ReferenceType','ReferenceId','PerformedByUserId','CreatedAt','Note'];

        // Fetch actual columns from the DB for InventoryTransaction and only use existing ones
        const colRows = await sequelize.query(
          `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'InventoryTransactions' AND TABLE_SCHEMA = 'dbo'`,
          { type: sequelize.QueryTypes.SELECT }
        );
        const existingColsSet = new Set(colRows.map(r => r.COLUMN_NAME));
        const cols = intendedCols.filter(c => existingColsSet.has(c));

        const placeholders = cols.map((c, i) => `:p${i}`).join(',');
        const colList = cols.map(c => `[${c}]`).join(',');

        const valuesMap = {
          MedicineBatchId: batch ? batch.Id : null,
          MedicineId: medicine.Id,
          TransactionType: mapTypeToLoai(type),
          Quantity: parsedQuantity,
          QuantityBefore: previousQuantity,
          QuantityAfter: newQuantity,
          Reason: reason,
          ReferenceType: mapRefType(referenceType),
          ReferenceId: null,
          PerformedByUserId: req.user && req.user.id ? req.user.id : null,
          // CreatedAt: use GETDATE() in raw SQL below instead of sending a timezone string
          CreatedAt: null,
          Note: (() => {
            if (!notes && !referenceId) return null;
            let base = {};
            if (notes) {
              try {
                const parsed = JSON.parse(notes);
                if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) base = parsed;
                else base._raw = String(notes);
              } catch { base._raw = String(notes); }
            }
            if (referenceId) base.referenceText = String(referenceId);
            try { return Object.keys(base).length ? JSON.stringify(base) : null; } catch { return notes || null; }
          })(),
        };

        // Build replacements but substitute GETDATE() for CreatedAt when present
        const replacements = {};
        const finalPlaceholders = cols.map((c, i) => {
          if (c === 'CreatedAt') return 'GETDATE()';
          replacements[`p${i}`] = valuesMap[c];
          return `:p${i}`;
        }).join(',');

        const insertSql = `INSERT INTO [InventoryTransactions] (${colList}) VALUES (${finalPlaceholders}); SELECT CAST(SCOPE_IDENTITY() AS BIGINT) AS Id;`;
            const inserted = await sequelize.query(insertSql, { replacements, type: sequelize.QueryTypes.SELECT });
        const newId = inserted && inserted[0] && inserted[0].Id ? inserted[0].Id : null;
        if (newId) {
          const createdRow = await InventoryTransaction.findByPk(newId);
          if (createdRow) {
            created = createdRow;
          }
        }
        if (!created) return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'Fallback insert failed', detail: payload } });
      } catch (rawErr) {
        console.error('Fallback raw INSERT failed:', rawErr);
        return res.status(500).json({ success: false, error: { code: 'DATABASE_ERROR', message: 'DB insert failed', detail: payload } });
      }
      // continue with created if fallback succeeded
  }

  // Reload the created record to get the server-generated ThoiGianTao timestamp
  await created.reload();

  // Normalize created transaction to API shape expected by frontend
  const performerLookup = await buildPerformerLookup([created.PerformedByUserId, req.user?.id]);
  const performerKey = normalizeIdKey(created.PerformedByUserId || req.user?.id);
  const performer = performerLookup.get(performerKey) || {};

  const transaction = {
    id: created.Id,
    medicineId: medicine.Id,
    medicineName: medicine.Name,
    type,
    quantity: created.Quantity,
    previousQuantity: created.QuantityBefore,
    newQuantity: created.QuantityAfter,
    reason: created.Reason,
    referenceType: referenceType || created.ReferenceType || null,
    referenceId: referenceId || created.ReferenceId || null,
    performedById: created.PerformedByUserId,
    performedBy: performer.name || req.user.fullName,
    performerCode: performer.code || null,
    performerDisplay: performer.display || formatPerformerDisplay(performer.name || req.user.fullName, performer.code),
    notes: created.Note,
    createdAt: created.CreatedAt,
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

  // Build where clause to filter by medicine directly (new schema)
  const where = { MedicineId: id };
  
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
    where.TransactionType = mapType(type);
  }

  if (fromDate && toDate) {
    where.CreatedAt = {
      [Op.between]: [new Date(fromDate), new Date(toDate)],
    };
  }

  // Optional: include batch and medicine details for display
  const include = [
    {
      model: sequelize.models.MedicineBatch,
      as: 'batch',
      required: false,
      include: [{ model: sequelize.models.Medicine, as: 'medicine', required: false }],
    },
    { model: sequelize.models.User, as: 'performedBy', required: false },
  ];

  try {
    const { count, rows } = await InventoryTransaction.findAndCountAll({
      where,
      include,
      order: [['CreatedAt', 'DESC']],
      limit,
      offset,
    });

    const performerIds = [...new Set((rows || []).map((r) => r.PerformedByUserId).filter(Boolean))];
    const performerLookup = await buildPerformerLookup(performerIds);

    const mapped = (rows || []).map((r) => {
      const key = normalizeIdKey(r.PerformedByUserId);
      const perf = performerLookup.get(key) || {};
      return {
        id: r.Id,
        medicineId: r.MedicineId ?? id,
        medicineName: r.batch?.medicine?.Name ?? r.medicine?.Name ?? '',
        type: r.TransactionType === 1 ? INVENTORY_TRANSACTION_TYPES.IMPORT : r.TransactionType === 2 ? INVENTORY_TRANSACTION_TYPES.EXPORT : INVENTORY_TRANSACTION_TYPES.ADJUSTMENT,
        quantity: r.Quantity,
        previousQuantity: r.QuantityBefore,
        newQuantity: r.QuantityAfter,
        reason: r.Reason,
        referenceType: r.ReferenceType,
        referenceId: r.ReferenceId,
        performedById: r.PerformedByUserId,
        performedBy: perf.name || r.performedBy?.fullName || null,
        performerCode: perf.code || null,
        performerDisplay: perf.display || formatPerformerDisplay(perf.name || r.performedBy?.fullName, perf.code),
        notes: r.Note,
        createdAt: r.CreatedAt,
        updatedAt: null,
      };
    });

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
      where: { IsActive: true },
      attributes: ['Id', 'Name', 'Unit', 'Category', 'Price', 'IsActive'],
      order: [['Name', 'ASC']],
    });

    return successResponse(res, (medicines || []).map((m) => ({
      id: m.Id,
      name: m.Name,
      unit: m.Unit,
      category: m.Category,
      price: m.Price,
      isActive: m.IsActive,
    })));
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
    const batches = await sequelize.models.MedicineBatch.findAll({
      where: {
        ExpiryDate: {
          [Op.lte]: futureDate,
          [Op.gte]: new Date(),
        },
      },
      include: [{ model: sequelize.models.Medicine, as: 'medicine', required: false }],
      order: [['ExpiryDate', 'ASC']],
      raw: false,
    });

    const data = (batches || []).map((b) => ({
      id: b.Id,
      medicineId: b.MedicineId,
      medicineName: b.medicine?.Name || null,
      batchNumber: b.BatchNumber,
      expiryDate: b.ExpiryDate,
      quantityInStock: b.QuantityInStock,
    }));

    return successResponse(res, data);
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
    orClauses.push({ Name: { [Op.like]: `%${q}%` } });
    if (isNumeric) {
      orClauses.push({ Id: parseInt(q, 10) });
    }

    const medicines = await Medicine.findAll({
      where: {
        IsActive: true,
        [Op.or]: orClauses,
      },
      attributes: ['Id', 'Name', 'Unit'],
      limit: parseInt(limit, 10),
      order: [['Name', 'ASC']],
    });

    const data = (medicines || []).map((r) => ({ id: r.Id, name: r.Name, unit: r.Unit }));

    return successResponse(res, data);
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
      attributes: [[sequelize.fn('DISTINCT', sequelize.col('Category')), 'category']],
      where: {
        IsActive: true,
      },
      order: [[sequelize.col('Category'), 'ASC']],
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
    where.TransactionType = mapType(type);
  }

  // Filter by medicine ID (MaThuoc field)
  if (medicineId) {
    where.MedicineId = medicineId;
  }

  // Filter by date range (ThoiGianTao field)
  if (fromDate && toDate) {
    where.CreatedAt = {
      [Op.between]: [new Date(fromDate), new Date(toDate)],
    };
  }

  // Parse sort parameter - use CreatedAt as the allowed column for sorting
  // If client sends 'createdAt' it will be respected via the allowed fields
  const order = parseSort(sort, ['CreatedAt'], 'CreatedAt:desc');

  try {
    // Build include to optionally join to batches/medicine for display details
    const include = [
      {
        model: sequelize.models.MedicineBatch,
        as: 'batch',
        required: false,
        include: [{ model: sequelize.models.Medicine, as: 'medicine', required: false }],
      },
      { model: sequelize.models.User, as: 'performedBy', required: false },
    ];

    const { count, rows } = await InventoryTransaction.findAndCountAll({
      where,
      order,
      limit,
      offset,
      include,
    });

    console.log(`[getAllInventoryTransactions] where=${JSON.stringify(where)}, found=${rows.length} transactions`);

    const performerIds = [...new Set((rows || []).map((r) => r.PerformedByUserId).filter(Boolean))];
    const performerLookup = await buildPerformerLookup(performerIds);

    const mapped = (rows || []).map((r) => {
      const key = normalizeIdKey(r.PerformedByUserId);
      const perf = performerLookup.get(key) || {};
      return {
        id: r.Id,
        medicineId: r.MedicineId ?? null,
        medicineName: r.batch?.medicine?.Name ?? r.medicine?.Name ?? '',
        type: r.TransactionType === 1 ? INVENTORY_TRANSACTION_TYPES.IMPORT : r.TransactionType === 2 ? INVENTORY_TRANSACTION_TYPES.EXPORT : INVENTORY_TRANSACTION_TYPES.ADJUSTMENT,
        quantity: r.Quantity,
        previousQuantity: r.QuantityBefore,
        newQuantity: r.QuantityAfter,
        reason: r.Reason,
        referenceType: r.ReferenceType,
        referenceId: r.ReferenceId,
        performedById: r.PerformedByUserId,
        performedBy: perf.name || r.performedBy?.fullName || null,
        performerCode: perf.code || null,
        performerDisplay: perf.display || formatPerformerDisplay(perf.name || r.performedBy?.fullName, perf.code),
        notes: r.Note,
        createdAt: r.CreatedAt,
        updatedAt: null,
      };
    });

    console.log(`[getAllInventoryTransactions] returning ${mapped.length} mapped transactions`);

    return paginatedResponse(res, {
      data: mapped,
      page,
      limit,
      total: count,
    });
  } catch (err) {
    console.error('getAllInventoryTransactions: DB error', err.message || err);

    // Fallback: try raw SQL directly against dbo.InventoryTransactions table
    try {
      console.warn('[getAllInventoryTransactions] falling back to raw SQL query on dbo.InventoryTransactions');

      const replacements = {};
      const whereClauses = [];

      if (medicineId) {
        whereClauses.push('MedicineId = :medicineId');
        replacements.medicineId = medicineId;
      }

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
        const tnum = mapType(type);
        if (tnum) {
          whereClauses.push('TransactionType = :ttype');
          replacements.ttype = tnum;
        }
      }

      if (fromDate && toDate) {
        whereClauses.push('CreatedAt BETWEEN :fromDate AND :toDate');
        replacements.fromDate = new Date(fromDate);
        replacements.toDate = new Date(toDate);
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

      // Build order/limit/offset
      const orderSql = Array.isArray(order) && order.length > 0 ? `ORDER BY ${order.map(o=>`${o[0]} ${o[1]}`).join(',')}` : 'ORDER BY CreatedAt DESC';
      const limitSql = limit ? `OFFSET ${offset || 0} ROWS FETCH NEXT ${limit} ROWS ONLY` : '';

      const sql = `SELECT * FROM dbo.InventoryTransactions ${whereSql} ${orderSql} ${limitSql}`;

      const rawRows = await sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });

      // Map raw rows to the same shape as the model mapping above
      const mapped = (rawRows || []).map((r) => ({
        id: r.Id,
        medicineId: r.MedicineId ?? null,
        medicineName: r.MedicineName || '',
        type: r.TransactionType === 1 ? INVENTORY_TRANSACTION_TYPES.IMPORT : r.TransactionType === 2 ? INVENTORY_TRANSACTION_TYPES.EXPORT : INVENTORY_TRANSACTION_TYPES.ADJUSTMENT,
        quantity: r.Quantity,
        previousQuantity: r.QuantityBefore,
        newQuantity: r.QuantityAfter,
        reason: r.Reason,
        referenceType: r.ReferenceType,
        referenceId: r.ReferenceId,
        performedById: r.PerformedByUserId,
        performedBy: r.PerformedByName || null,
        performerCode: r.PerformedByCode || null,
        performerDisplay: r.PerformedByDisplay || null,
        notes: r.Note,
        createdAt: r.CreatedAt,
        updatedAt: r.UpdatedAt || null,
      }));

      // Count fallback - try a simple count query
      const countSql = `SELECT COUNT(1) as cnt FROM dbo.InventoryTransactions ${whereSql}`;
      const countResult = await sequelize.query(countSql, { replacements, type: sequelize.QueryTypes.SELECT });
      const totalCount = Array.isArray(countResult) && countResult[0] ? Number(countResult[0].cnt || 0) : mapped.length;

      return paginatedResponse(res, {
        data: mapped,
        page,
        limit,
        total: totalCount,
      });
    } catch (rawErr) {
      console.error('getAllInventoryTransactions raw SQL fallback failed:', rawErr.message || rawErr);
      return paginatedResponse(res, {
        data: [],
        page,
        limit,
        total: 0,
      });
    }
  }
});

/**
 * Get batches for a specific medicine
 * GET /api/medicines/:id/batches
 */
const getMedicineBatches = asyncHandler(async (req, res) => {
  const { id } = req.params;

  try {
    const batches = await sequelize.models.MedicineBatch.findAll({
      where: { MedicineId: id },
      order: [['ExpiryDate', 'ASC']],
      attributes: ['Id', 'MedicineId', 'BatchNumber', 'ExpiryDate', 'QuantityInStock'],
      raw: true,
    });

    const data = (batches || []).map((b) => ({
      id: b.Id,
      medicineId: b.MedicineId,
      batchNumber: b.BatchNumber,
      expiryDate: b.ExpiryDate,
      quantityInStock: b.QuantityInStock,
    }));

    return successResponse(res, data);
  } catch (err) {
    console.error('getMedicineBatches: DB error', err.message || err);
    return successResponse(res, []);
  }
});

/**
 * Get all medicines without pagination (for admin dropdowns etc.)
 * GET /api/medicines/all
 */
const getAllMedicinesUnpaginated = asyncHandler(async (req, res) => {
  const { category, search, isActive, sort } = req.query;
  const where = {};
  if (isActive !== undefined) where.IsActive = isActive === 'true';
  else where.IsActive = true;
  if (category) where.Category = category;
  if (search) {
    const isNumeric = /^\d+$/.test(search);
    if (isNumeric) {
      where[Op.or] = [
        { Id: parseInt(search, 10) },
        { Name: { [Op.like]: `%${search}%` } },
      ];
    } else {
      where[Op.or] = [{ Name: { [Op.like]: `%${search}%` } }];
    }
  }

  try {
    const rows = await Medicine.findAll({
      where,
      order: parseSort(sort || 'Id:desc', ['Id', 'Name', 'Category', 'Unit', 'Price']),
      attributes: ['Id', 'Name', 'Unit', 'Category', 'Price', 'IsActive'],
      raw: true,
    });

    const data = (rows || []).map(r => ({
      id: r.Id,
      name: r.Name,
      category: r.Category,
      unit: r.Unit,
      price: r.Price,
      isActive: r.IsActive,
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
  getMedicineBatches,
  getMedicineCategories,
  getAllMedicinesUnpaginated,
};
