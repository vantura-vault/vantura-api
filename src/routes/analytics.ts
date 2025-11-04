import { Router } from 'express';
import { analyticsController } from '../controllers/analyticsController.js';

const router = Router();

router.get('/historical', analyticsController.getHistoricalMetrics);
router.get('/recent', analyticsController.getRecentPosts);
router.get('/summary', analyticsController.getSummary);

export default router;
