import express from 'express';
import { getTodayQueue, getAllRecords, getRecordById, createRecord, updateRecord } from '../controllers/medicalRecord.controller.js';
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

// Update record
router.put('/:id', authenticate, updateRecord);

export default router;
