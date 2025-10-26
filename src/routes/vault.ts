import { Router } from 'express';
import { vaultController } from '../controllers/vaultController.js';

const router = Router();

router.get('/competitors', vaultController.getCompetitors);
router.post('/competitors', vaultController.addCompetitor);
router.get('/competitors/:id', vaultController.getCompetitorDetails);

export default router;
