/**
 * Inventory Routes
 */
import express from 'express';
import { medicineController } from '../controllers/index.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

/**
 * @route GET /api/inventory/transactions
 * @desc Get all inventory transactions
 * @access Admin, Pharmacist
 */
router.get(
  '/transactions',
  authorize(ROLES.ADMIN, ROLES.PHARMACIST),
  medicineController.getAllInventoryTransactions
);

/**
 * @route GET /api/inventory/min-stock-report
 * @desc Get min stock report by medicine
 * @access Admin, Pharmacist
 */
router.get(
  '/min-stock-report',
  authorize(ROLES.ADMIN, ROLES.PHARMACIST),
  medicineController.getMinStockReport
);

export default router;
