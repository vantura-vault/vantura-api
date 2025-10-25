import { Router } from 'express';
import { companyController } from '../controllers/companyController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.use(authenticate);

// Create company
router.post('/', companyController.create);

// Get my company
router.get('/me', companyController.getMyCompany);

// Get company by ID
router.get('/:id', companyController.getById);

// Add platform to company
router.post('/:id/platforms', companyController.addPlatform);

export default router;