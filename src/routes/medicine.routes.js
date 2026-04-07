/**
 * Medicine Routes
 */
import express from 'express';
import { medicineController } from '../controllers/index.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { medicineValidator } from '../validators/index.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/medicines/search
 * @desc Quick search medicines
 * @access Admin, Doctor, Pharmacist
 */
router.get(
  '/search',
  authorize(ROLES.ADMIN, ROLES.DOCTOR, ROLES.PHARMACIST),
  medicineController.searchMedicines
);

/**
 * @route GET /api/medicines/low-stock
 * @desc Get low stock medicines
 * @access Admin, Pharmacist
 */
router.get(
  '/low-stock',
  authorize(ROLES.ADMIN, ROLES.PHARMACIST),
  medicineController.getLowStockMedicines
);

/**
 * @route GET /api/medicines/expiring
 * @desc Get expiring medicines
 * @access Admin, Pharmacist
 */
router.get(
  '/expiring',
  authorize(ROLES.ADMIN, ROLES.PHARMACIST),
  medicineController.getExpiringMedicines
);

/**
 * @route GET /api/medicines
 * @desc Get all medicines with pagination
 * @access Admin, Doctor, Pharmacist
 */
router.get(
  '/',
  authorize(ROLES.ADMIN, ROLES.DOCTOR, ROLES.PHARMACIST),
  validate(medicineValidator.getList),
  medicineController.getAllMedicines
);

/**
 * @route GET /api/medicines/categories
 * @desc Get distinct medicine categories (NhomThuoc)
 * @access Admin, Doctor, Pharmacist
 */
router.get(
  '/categories',
  authorize(ROLES.ADMIN, ROLES.DOCTOR, ROLES.PHARMACIST),
  medicineController.getMedicineCategories
);

/**
 * @route GET /api/medicines/all
 * @desc Get all medicines without pagination (for dropdowns)
 * @access Admin, Doctor, Pharmacist
 */
router.get(
  '/all',
  authorize(ROLES.ADMIN, ROLES.DOCTOR, ROLES.PHARMACIST),
  medicineController.getAllMedicinesUnpaginated
);

/**
 * @route GET /api/medicines/:id
 * @desc Get medicine by ID
 * @access Admin, Doctor, Pharmacist
 */
router.get(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.DOCTOR, ROLES.PHARMACIST),
  validate(medicineValidator.getById),
  medicineController.getMedicineById
);

/**
 * @route POST /api/medicines
 * @desc Create new medicine
 * @access Admin, Pharmacist
 */
router.post(
  '/',
  authorize(ROLES.ADMIN, ROLES.PHARMACIST),
  validate(medicineValidator.create),
  medicineController.createMedicine
);

/**
 * @route PUT /api/medicines/:id
 * @desc Update medicine
 * @access Admin, Pharmacist
 */
router.put(
  '/:id',
  authorize(ROLES.ADMIN, ROLES.PHARMACIST),
  validate(medicineValidator.update),
  medicineController.updateMedicine
);

/**
 * @route DELETE /api/medicines/:id
 * @desc Delete medicine
 * @access Admin only
 */
router.delete(
  '/:id',
  authorize(ROLES.ADMIN),
  validate(medicineValidator.getById),
  medicineController.deleteMedicine
);

/**
 * @route POST /api/medicines/:id/inventory
 * @desc Adjust inventory
 * @access Admin, Pharmacist
 */
router.post(
  '/:id/inventory',
  authorize(ROLES.ADMIN, ROLES.PHARMACIST),
  validate(medicineValidator.adjustInventory),
  medicineController.adjustInventory
);

/**
 * @route GET /api/medicines/:id/transactions
 * @desc Get medicine inventory transactions
 * @access Admin, Pharmacist
 */
router.get(
  '/:id/transactions',
  authorize(ROLES.ADMIN, ROLES.PHARMACIST),
  medicineController.getInventoryTransactions
);

/**
 * @route GET /api/medicines/:id/batches
 * @desc Get batches for a specific medicine
 * @access Admin, Pharmacist
 */
router.get(
  '/:id/batches',
  authorize(ROLES.ADMIN, ROLES.PHARMACIST),
  medicineController.getMedicineBatches
);

export default router;
