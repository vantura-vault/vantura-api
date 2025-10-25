import { Router } from 'express';
import { dashboardController } from '../controllers/dashboardController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// All dashboard routes require authentication
router.use(authenticate);

// Get my dashboard (uses current user's company)
router.get('/me', dashboardController.getMyDashboard);

// Get dashboard by company ID
router.get('/:companyId', dashboardController.getDashboard);

export default router;