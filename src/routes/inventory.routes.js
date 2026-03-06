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

export default router;
