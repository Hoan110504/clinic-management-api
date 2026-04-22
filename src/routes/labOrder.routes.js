import express from 'express';
import { labOrderController } from '../controllers/index.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { ROLES } from '../config/constants.js';

const router = express.Router();

router.use(authenticate);

router.post(
  '/create',
  authorize(ROLES.ADMIN, ROLES.DOCTOR),
  labOrderController.createLabOrder
);

router.get(
  '/by-examination/:id',
  authorize(ROLES.ADMIN, ROLES.DOCTOR),
  labOrderController.getLabOrderByExamination
);

export default router;
