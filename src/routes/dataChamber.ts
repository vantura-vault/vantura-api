import { Router } from 'express';
import { getSettings, updateSettings } from '../controllers/dataChamberController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// All data chamber routes require authentication
router.use(authenticate);

// GET /api/data-chamber/settings?companyId=xxx
router.get('/settings', getSettings);

// PUT /api/data-chamber/settings?companyId=xxx
router.put('/settings', updateSettings);

export default router;
