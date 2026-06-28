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
import { INVENTORY_TRANSACTION_TYPES, ROLES, ROLE_PREFIXES } from '../config/constants.js';
import { formatToVietnamISOString } from '../utils/timezone.js';

const normalizeIdKey = (id) => String(id || '').trim().toLowerCase();

const formatPerformerDisplay = (name, code) => {
  if (name && code) return `${name} - ${code}`;
  return name || code || null;
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

  ]);

  // Precompute dynamic codes only for those without stored code
  // RBAC roleId-only: keep only numeric roleId values (1-5)
  const appRoles = [...new Set(appUsers.map((u) => Number(u.role)).filter((r) => Number.isInteger(r) && Object.values(ROLES).includes(r)))];


  const allAppUsersInRoles = appRoles.length
    ? await User.findAll({ attributes: ['id', 'role'], where: { role: { [Op.in]: appRoles } }, raw: true }).catch(() => [])
    : [];

 
  const appCodeMap = new Map();
  for (const role of appRoles) {
    const sameRole = allAppUsersInRoles.filter((u) => Number(u.role) === role).sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')));
    const prefix = ROLE_PREFIXES[role] || 'UN';
    sameRole.forEach((u, index) => appCodeMap.set(normalizeIdKey(u.id), `${prefix}${String(index + 1).padStart(3, '0')}`));
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
  // Only filter by isActive if explicitly provided and not 'all'
  // Default (undefined or 'all'): show both active and inactive medicines
  if (isActive !== undefined && isActive !== 'all' && isActive !== '') {
    where.isActive = isActive === 'true';
  }

  if (category) {
    where.category = category;
  }

  if (search) {
    const isNumeric = /^\d+$/.test(String(search));
    where[Op.or] = isNumeric
      ? [{ name: { [Op.like]: `%${search}%` } }, { id: Number(search) }]
      : [{ name: { [Op.like]: `%${search}%` } }];
  }

  const order = parseSort(sort, ['id', 'name', 'category', 'unit', 'price'], 'id:desc');

  try {
    const { count, rows } = await Medicine.findAndCountAll({
      where,
      order,
      limit,
      offset,
      attributes: ['id', 'name', 'unit', 'category', 'price', 'isActive'],
    });

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
    unit,
    price,
    category,
    isActive: true,
  });

  // Create initial inventory transaction if quantity > 0
  if (quantity > 0) {
    const batch = await sequelize.models.MedicineBatch.findOne({ where: { MedicineId: medicine.id } });
    await InventoryTransaction.create({
      MedicineBatchId: batch ? batch.id : null,
      MedicineId: medicine.id,
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

  const medicine = await Medicine.findByPk(id);
  if (!medicine) {
    throw new NotFoundError('Không tìm thấy thuốc');
  }

  // Don't allow direct quantity update - stock is tracked by transactions
  delete updateData.quantity;

  const mappedUpdate = {};
  if (Object.prototype.hasOwnProperty.call(updateData, 'name')) mappedUpdate.name = updateData.name;
  if (Object.prototype.hasOwnProperty.call(updateData, 'unit')) mappedUpdate.unit = updateData.unit;
  if (Object.prototype.hasOwnProperty.call(updateData, 'category')) mappedUpdate.category = updateData.category;
  if (Object.prototype.hasOwnProperty.call(updateData, 'price')) mappedUpdate.price = updateData.price;
  if (Object.prototype.hasOwnProperty.call(updateData, 'isActive')) mappedUpdate.isActive = updateData.isActive;

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

  // Normalize instance attribute names so legacy code referencing `.Id` or `.Name`
  // continues to work even though model attributes are `id`/`name`.
  try {
    if (medicine && typeof medicine === 'object') {
      if (medicine.Id === undefined && medicine.id !== undefined) medicine.Id = medicine.id;
      if (medicine.Name === undefined && medicine.name !== undefined) medicine.Name = medicine.name;
    }
  } catch (e) {
    // ignore
  }

  const parsedQuantity = Number(quantity);
  if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
    throw new BadRequestError('Số lượng không hợp lệ');
  }

  // Nếu là nhập kho thì bắt buộc phải có số lô (tên trường có thể là `soLo` hoặc `batchNumber` từ frontend)
  // Also trim and validate that batchCode is not empty/whitespace-only
  const trimmedBatchCode = batchCode && typeof batchCode === 'string' ? batchCode.trim() : (batchCode || null);
  if (type === INVENTORY_TRANSACTION_TYPES.IMPORT && !trimmedBatchCode) {
    throw new BadRequestError('Số lô (batchNumber) là bắt buộc khi nhập kho');
  }

  // Calculate total stock from all batches (source of truth)
  let previousQuantity = 0;
  try {
    const batchTotal = await sequelize.models.MedicineBatch.sum('QuantityInStock', { 
      where: { MedicineId: medicine.Id } 
    });
    previousQuantity = Number.isFinite(Number(batchTotal)) ? Number(batchTotal) : 0;
  } catch (sumErr) {
    console.warn('Failed to compute batch total for previousQuantity', sumErr?.message || sumErr);
    previousQuantity = 0;
  }

  let newQuantity;

  switch (type) {
    case INVENTORY_TRANSACTION_TYPES.IMPORT:
      newQuantity = previousQuantity + parsedQuantity;
      break;
    case INVENTORY_TRANSACTION_TYPES.EXPORT:
      // Skip general stock check if a specific batch is provided
      // The batch-specific check below will validate availability
      if (!trimmedBatchCode && previousQuantity < parsedQuantity) {
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
    // Helper to safely parse dates (Vietnam timezone)
    const parseDateSafe = (v) => {
      if (!v) return null;
      const d = new Date(v);
      if (!Number.isFinite(d.getTime())) return null;
      const formatted = formatToVietnamISOString(d);
      return formatted ? formatted.slice(0, 10) : null;
    };

    // IMPORT: find or create target batch, increment its QuantityInStock
    if (type === INVENTORY_TRANSACTION_TYPES.IMPORT && trimmedBatchCode) {
    batch = await sequelize.models.MedicineBatch.findOne({ where: { medicineId: medicine.Id, batchNumber: trimmedBatchCode } });
      if (!batch) {
        try {
          batch = await sequelize.models.MedicineBatch.create({
            medicineId: medicine.Id,
            batchNumber: trimmedBatchCode,
            expiryDate: parseDateSafe(hanSuDung),
            manufactureDate: parseDateSafe(ngaySanXuat),
            quantityInStock: parsedQuantity,
            importPrice: giaNhap || null,
            status: 1,
          }, {
            fields: ['medicineId', 'batchNumber', 'expiryDate', 'manufactureDate', 'quantityInStock', 'importPrice', 'status'],
          });
        } catch (createErr) {
          const msg = (createErr && createErr.parent && createErr.parent.message) ? String(createErr.parent.message).toLowerCase() : (createErr && createErr.message ? String(createErr.message).toLowerCase() : '');
          if (msg.includes('identity_insert') || msg.includes('cannot insert explicit value for identity column') || msg.includes('insert explicit value for identity')) {
            try {
              const cols = ['MedicineId','BatchNumber','ExpiryDate','ManufactureDate','QuantityInStock','ImportPrice','Status'];
              const values = [medicine.Id, trimmedBatchCode, parseDateSafe(hanSuDung), parseDateSafe(ngaySanXuat), parsedQuantity, giaNhap || null, 1];
              const placeholders = cols.map((c, i) => `:p${i}`).join(',');
              const colList = cols.map(c => `[${c}]`).join(',');
              const replacements = {};
              values.forEach((v, i) => { replacements[`p${i}`] = v; });
              const sql = `INSERT INTO [MedicineBatches] (${colList}) VALUES (${placeholders});`;
              await sequelize.query(sql, { replacements, type: sequelize.QueryTypes.INSERT });
              batch = await sequelize.models.MedicineBatch.findOne({ where: { medicineId: medicine.Id, batchNumber: trimmedBatchCode } });
            } catch (rawErr) {
              console.error('Fallback raw INSERT for MedicineBatches failed', rawErr?.message || rawErr);
              throw createErr;
            }
          } else {
            throw createErr;
          }
        }
      } else {
        const current = Number(batch.QuantityInStock ?? batch.quantityInStock ?? 0);
        const updated = current + parsedQuantity;
        try {
          if (typeof batch.set === 'function') {
            batch.set('quantityInStock', updated);
          } else {
            batch.quantityInStock = updated;
            batch.QuantityInStock = updated;
          }
          await batch.save();
        } catch (saveErr) {
          console.warn('Failed to update batch quantity after import', saveErr?.message || saveErr);
        }
      }

    // EXPORT: target a specific batch if provided, otherwise pick a batch with sufficient stock
    } else if (type === INVENTORY_TRANSACTION_TYPES.EXPORT) {
      if (trimmedBatchCode) {
      batch = await sequelize.models.MedicineBatch.findOne({ where: { medicineId: medicine.Id, batchNumber: trimmedBatchCode } });
        if (!batch) {
          throw new BadRequestError('Không tìm thấy lô thuốc tương ứng với số lô đã cung cấp');
        }
        const available = Number(batch.QuantityInStock ?? batch.quantityInStock ?? 0);
        if (available < parsedQuantity) {
          throw new BadRequestError('Số lượng xuất vượt quá số lượng tồn trong lô thuốc');
        }
        const updated = available - parsedQuantity;
        try {
          if (typeof batch.set === 'function') {
            batch.set('quantityInStock', updated);
          } else {
            batch.quantityInStock = updated;
            batch.QuantityInStock = updated;
          }
          await batch.save();
        } catch (saveErr) {
          console.warn('Failed to update batch quantity after export', saveErr?.message || saveErr);
        }
      } else {
        // find any batch with enough stock, prefer earliest expiry
        batch = await sequelize.models.MedicineBatch.findOne({
          where: { medicineId: medicine.Id, quantityInStock: { [Op.gte]: parsedQuantity } },
          order: [['ExpiryDate', 'ASC']],
        });
        if (!batch) {
          throw new BadRequestError('Không đủ tồn kho để xuất');
        }
        const available = Number(batch.QuantityInStock ?? batch.quantityInStock ?? 0);
        const updated = available - parsedQuantity;
        try {
          if (typeof batch.set === 'function') {
            batch.set('quantityInStock', updated);
          } else {
            batch.quantityInStock = updated;
            batch.QuantityInStock = updated;
          }
          await batch.save();
        } catch (saveErr) {
          console.warn('Failed to update batch quantity after export (no soLo)', saveErr?.message || saveErr);
        }
      }

    } else {
      // Default behavior: try to find any batch for this medicine
      batch = await sequelize.models.MedicineBatch.findOne({ where: { medicineId: medicine.Id } });
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
    const batchPrimaryKey = batch ? (batch.Id ?? batch.id ?? (typeof batch.get === 'function' ? (batch.get('Id') ?? batch.get('id')) : null)) : null;

    created = await InventoryTransaction.create({
      MedicineBatchId: batchPrimaryKey,
      MedicineId: medicine.Id,
      TransactionType: mapTypeToLoai(type),
      Quantity: parsedQuantity,
      QuantityBefore: previousQuantity,
      QuantityAfter: newQuantity,
      Reason: reason,
      ReferenceType: (type === INVENTORY_TRANSACTION_TYPES.EXPORT) ? 1 : mapRefType(referenceType),
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
          ReferenceType: (type === INVENTORY_TRANSACTION_TYPES.EXPORT) ? 1 : mapRefType(referenceType),
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
  const where = {};
  if (id !== undefined && id !== null && String(id).trim() !== '') {
    where.MedicineId = id;
  }
  
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
 * Get min stock report
 * GET /api/inventory/min-stock-report
 */
const getMinStockReport = asyncHandler(async (req, res) => {
  try {
    const sql = `
      WITH Usage30Days AS (
        SELECT
          pi.MedicineId,
          SUM(CAST(pi.QuantityPrescribed AS DECIMAL(18, 2))) AS TotalPrescribedQty
        FROM dbo.PrescriptionItems pi
        INNER JOIN dbo.Prescriptions p
          ON p.PrescriptionID = pi.PrescriptionID
        WHERE p.PrescriptionDate >= DATEADD(DAY, -30, CAST(GETDATE() AS DATE))
        GROUP BY pi.MedicineId
      ),
      ActiveStock AS (
        SELECT
          mb.MedicineId,
          SUM(CAST(mb.QuantityInStock AS DECIMAL(18, 2))) AS CurrentStock
        FROM dbo.MedicineBatch mb
        WHERE mb.Status = 1
          AND mb.ExpiryDate > CAST(GETDATE() AS DATE)
        GROUP BY mb.MedicineId
      )
      SELECT
        u.MedicineId AS medicineId,
        COALESCE(m.Name, '') AS medicineName,
        COALESCE(m.Unit, '') AS unit,
        CAST(u.TotalPrescribedQty AS DECIMAL(18, 2)) AS totalPrescribedQty,
        CAST(u.TotalPrescribedQty / 30.0 AS DECIMAL(18, 4)) AS avgDailyUsage,
        CAST((u.TotalPrescribedQty / 30.0) * 5 AS DECIMAL(18, 4)) AS leadTimeDemand,
        CAST((u.TotalPrescribedQty / 30.0) * 5 * 0.2 AS DECIMAL(18, 4)) AS safetyStock,
        CAST((u.TotalPrescribedQty / 30.0) * 5 * 1.2 AS DECIMAL(18, 4)) AS minStock,
        CAST(COALESCE(s.CurrentStock, 0) AS DECIMAL(18, 2)) AS currentStock,
        CAST(COALESCE(s.CurrentStock, 0) - ((u.TotalPrescribedQty / 30.0) * 5 * 1.2) AS DECIMAL(18, 4)) AS stockGap,
        CASE
          WHEN COALESCE(s.CurrentStock, 0) < ((u.TotalPrescribedQty / 30.0) * 5 * 1.2)
            THEN N'Cần bổ sung'
          ELSE N'Đạt'
        END AS stockStatus
      FROM Usage30Days u
      LEFT JOIN ActiveStock s
        ON s.MedicineId = u.MedicineId
      LEFT JOIN dbo.Medicines m
        ON m.Id = u.MedicineId
      ORDER BY minStock DESC, medicineName ASC;
    `;

    const rows = await sequelize.query(sql, { type: sequelize.QueryTypes.SELECT });

    return successResponse(res, rows || []);
  } catch (err) {
    console.error('getMinStockReport: DB error', err.message || err);
    return successResponse(res, []);
  }
});

/**
 * Get batches for a specific medicine
 * GET /api/medicines/:id/batches
 */
const getMedicineBatches = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (id === undefined || id === null || String(id).trim() === '') {
    // Invalid request - medicine id is required for batches endpoint
    return errorResponse(res, 'Thiếu tham số id thuốc', 400, 'MISSING_MEDICINE_ID');
  }

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
  // Only filter by isActive if explicitly provided and not 'all'
  // Default (undefined or 'all'): show both active and inactive medicines
  if (isActive !== undefined && isActive !== 'all' && isActive !== '') where.IsActive = isActive === 'true';
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
      attributes: [
        'Id', 
        'Name', 
        'Unit', 
        'Category', 
        'Price', 
        'IsActive',
        // Sum total stock from all batches
        [
          sequelize.literal(`(
            SELECT ISNULL(SUM(QuantityInStock), 0) 
            FROM MedicineBatches 
            WHERE MedicineBatches.MedicineId = Medicine.Id
          )`),
          'totalStock'
        ]
      ],
      raw: true,
    });

    const data = (rows || []).map(r => ({
      id: r.Id,
      name: r.Name,
      category: r.Category,
      unit: r.Unit,
      price: r.Price,
      isActive: r.IsActive,
      quantity: Number(r.totalStock || 0), // Add total stock from all batches
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
  getMinStockReport,
};
