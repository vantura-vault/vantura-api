import { Router } from 'express';
import { blueprintController } from '../controllers/blueprintController.js';

const router = Router();

router.post('/', blueprintController.create);
router.get('/', blueprintController.list);
router.get('/:id', blueprintController.getById);
router.patch('/:id', blueprintController.update);
router.delete('/:id', blueprintController.delete);

export default router;
