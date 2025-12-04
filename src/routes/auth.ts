import { Router } from 'express';
import { authController } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/check-linkedin', authController.checkLinkedIn); // Check if LinkedIn URL already registered

router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);

export default router;