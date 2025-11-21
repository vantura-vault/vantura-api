import { Router } from 'express';
import { competitorLinkedInController } from '../controllers/competitorLinkedInController.js';

const router = Router();

// POST /api/competitors/linkedin - Add competitor via LinkedIn URL
router.post('/', competitorLinkedInController.addViaLinkedIn);

export default router;
