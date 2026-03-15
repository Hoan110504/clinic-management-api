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
import labServiceRoutes from './labService.routes.js';
import prescriptionRoutes from './prescription.routes.js';
import paymentRoutes from './payment.routes.js';
import inventoryRoutes from './inventory.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import medicalRecordRoutes from './medicalRecord.routes.js';

const router = express.Router();

// Health check route
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

// Mount routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/patients', patientRoutes);
router.use('/appointments', appointmentRoutes);
router.use('/medicines', medicineRoutes);
router.use('/lab-tests', labTestRoutes);
router.use('/lab-services', labServiceRoutes);
router.use('/prescriptions', prescriptionRoutes);
router.use('/payments', paymentRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/medical-records', medicalRecordRoutes);

export default router;
