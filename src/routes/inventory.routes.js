/**
 * Inventory Routes
 */
const express = require('express');
const router = express.Router();
const { medicineController } = require('../controllers');
const { authenticate, authorize } = require('../middleware/auth');
const { ROLES } = require('../config/constants');

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

module.exports = router;
