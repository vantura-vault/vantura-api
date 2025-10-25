import { Router } from 'express';
import { competitorController } from '../controllers/competitorController';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Competitor management
router.post('/', competitorController.add);
router.get('/', competitorController.list);
router.get('/compare', competitorController.compare); // Must be before /:id
router.get('/:id', competitorController.getById);
router.delete('/:relationshipId', competitorController.remove);

export default router;