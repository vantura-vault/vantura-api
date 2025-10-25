import { Router } from 'express';
import { snapshotController } from '../controllers/snapshotController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All snapshot routes require authentication
router.use(authenticate);

// Create snapshot
router.post('/', snapshotController.create);

// Get snapshots for a platform
router.get('/platform/:companyPlatformId', snapshotController.getByPlatform);

// Get latest snapshots for company
router.get('/company/:companyId/latest', snapshotController.getLatestByCompany);

// Get analytics for a platform
router.get(
  '/platform/:companyPlatformId/analytics',
  snapshotController.getAnalytics
);

export default router;