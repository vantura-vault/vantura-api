import { Router } from 'express';
import { adminController } from '../controllers/adminController.js';
import { authenticate } from '../middleware/auth.js';
import { requireSuperAdmin } from '../middleware/superAdmin.js';

const router = Router();

// All admin routes require authentication + super_admin role
router.use(authenticate);
router.use(requireSuperAdmin);

// Stats
router.get('/stats', adminController.getStats);

// Users
router.get('/users', adminController.getUsers);
router.post('/users/:id/deactivate', adminController.deactivateUser);
router.post('/users/:id/reset-password', adminController.resetPassword);

// Companies
router.get('/companies', adminController.getCompanies);

// API Usage
router.get('/api-usage', adminController.getApiUsage);

// Billing
router.get('/billing', adminController.getBilling);

export default router;
