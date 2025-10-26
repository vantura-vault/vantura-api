import { Router } from 'express';
import { suggestionsController } from '../controllers/suggestionsController.js';

const router = Router();

router.post('/', suggestionsController.generateSuggestions);

export default router;
