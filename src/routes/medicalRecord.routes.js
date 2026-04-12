import express from 'express';
import { getTodayQueue, getAllRecords, getRecordById, createRecord, updateRecord, startExamination, completeExamination, cancelExamination } from '../controllers/medicalRecord.controller.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// GET /api/medical-records - list / filter
router.get('/', authenticate, getAllRecords);

// GET /api/medical-records/today-queue
router.get('/today-queue', authenticate, getTodayQueue);

// GET /api/medical-records/:id
router.get('/:id', authenticate, getRecordById);

// Create record
router.post('/', authenticate, createRecord);

// Start examination
router.post('/:id/start', authenticate, startExamination);

// Complete examination
router.post('/:id/complete', authenticate, completeExamination);

// Cancel examination
router.post('/:id/cancel', authenticate, cancelExamination);

// Update record
router.put('/:id', authenticate, updateRecord);

export default router;
