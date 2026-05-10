/**
 * Routes Index
 * Central router configuration
 */
import express from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import patientRoutes from './patient.routes.js';
import appointmentRoutes from './appointment.routes.js';
import medicineRoutes from './medicine.routes.js';
import labTestRoutes from './labTest.routes.js';
import labOrderRoutes from './labOrder.routes.js';
import labServiceRoutes from './labService.routes.js';
import prescriptionRoutes from './prescription.routes.js';
import paymentRoutes from './payment.routes.js';
import inventoryRoutes from './inventory.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import medicalRecordRoutes from './medicalRecord.routes.js';
import aiRoutes from './ai.routes.js';
import notificationRoutes from './notification.routes.js';
import { sequelize } from '../models/database.js';
import { QueryTypes } from 'sequelize';

const router = express.Router();

import { formatToVietnamISOString } from '../utils/timezone.js';

// Health check route
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: formatToVietnamISOString(),
    environment: process.env.NODE_ENV,
  });
});

// Debug: quick DB check for Prescriptions table (returns count or error)
router.get('/debug/db-prescriptions-check', async (req, res) => {
  try {
    const rows = await sequelize.query('SELECT COUNT(*) AS cnt FROM [dbo].[Prescriptions]', { type: QueryTypes.SELECT });
    const cnt = rows && rows[0] && (rows[0].cnt || rows[0].CNT || rows[0].Cnt) ? Number(rows[0].cnt || rows[0].CNT || rows[0].Cnt) : 0;
    return res.json({ success: true, count: cnt });
  } catch (err) {
    console.error('debug/db-prescriptions-check failed', err && (err.original?.message || err.message));
    return res.status(500).json({ success: false, error: { message: 'DB check failed', details: err && (err.original?.message || err.message) } });
  }
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/patients', patientRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/medicines', medicineRoutes);
router.use('/lab-tests', labTestRoutes);
router.use('/lab-orders', labOrderRoutes);
router.use('/lab-services', labServiceRoutes);
router.use('/prescriptions', prescriptionRoutes);
router.use('/payments', paymentRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/medical-records', medicalRecordRoutes);
router.use('/ai', aiRoutes);
router.use('/notifications', notificationRoutes);

export default router;
