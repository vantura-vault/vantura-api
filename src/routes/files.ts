import { Router } from 'express';
import multer from 'multer';
import { listFiles, uploadFiles, deleteFile } from '../controllers/fileController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// All file routes require authentication
router.use(authenticate);

// Configure multer for memory storage (files go directly to buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10, // Max 10 files at once
  },
});

// GET /api/files - List company files
router.get('/', listFiles);

// POST /api/files/upload - Upload files
router.post('/upload', upload.array('files', 10), uploadFiles);

// DELETE /api/files/:id - Delete a file
router.delete('/:id', deleteFile);

export default router;
