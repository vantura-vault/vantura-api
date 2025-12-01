import { Router } from 'express';
import { vaultController } from '../controllers/vaultController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// All vault routes require authentication
router.use(authenticate);

router.get('/competitors', vaultController.getCompetitors);
router.post('/competitors', vaultController.addCompetitor);
router.get('/competitors/:id', vaultController.getCompetitorDetails);
router.delete('/competitors/:id', vaultController.deleteCompetitor);

export default router;
