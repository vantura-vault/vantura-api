import { Router } from 'express';
import { draftController } from '../controllers/draftController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// All draft routes require authentication
router.use(authenticate);

// Get draft by blueprint ID (must be before /:id to avoid conflict)
router.get('/by-blueprint/:blueprintId', draftController.getDraftByBlueprint);

// CRUD operations
router.post('/', draftController.createDraft);
router.get('/', draftController.getDrafts);
router.get('/:id', draftController.getDraft);
router.patch('/:id', draftController.updateDraft);
router.delete('/:id', draftController.deleteDraft);

export default router;
