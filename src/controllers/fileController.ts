import { Request, Response } from 'express';
import { prisma } from '../db.js';
import {
  uploadFileToS3,
  deleteFileFromS3,
  validateFile,
  isS3Configured,
  generateContentHash,
} from '../services/fileUploadService.js';

/**
 * GET /api/files
 * List all files for a company
 */
export const listFiles = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = req.query.companyId as string;

    if (!companyId) {
      res.status(400).json({
        success: false,
        error: 'companyId query parameter is required',
      });
      return;
    }

    const files = await prisma.companyFile.findMany({
      where: { companyId },
      orderBy: { uploadedAt: 'desc' },
    });

    res.json({
      success: true,
      data: files,
    });
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to list files',
    });
  }
};

/**
 * POST /api/files/upload
 * Upload files for a company
 */
export const uploadFiles = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = req.body.companyId as string;

    if (!companyId) {
      res.status(400).json({
        success: false,
        error: 'companyId is required',
      });
      return;
    }

    if (!isS3Configured()) {
      res.status(503).json({
        success: false,
        error: 'File storage is not configured',
      });
      return;
    }

    // req.files is populated by multer middleware
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      res.status(400).json({
        success: false,
        error: 'No files provided',
      });
      return;
    }

    const uploadedFiles = [];
    const errors = [];

    for (const file of files) {
      // Validate file (extension, MIME type, size, and magic bytes)
      const validation = validateFile(
        file.originalname,
        file.mimetype,
        file.size,
        file.buffer
      );
      if (!validation.valid) {
        errors.push({ filename: file.originalname, error: validation.error });
        continue;
      }

      // Check for duplicate by content hash
      const contentHash = generateContentHash(file.buffer);
      const existingFile = await prisma.companyFile.findFirst({
        where: {
          companyId,
          contentHash,
        },
      });

      if (existingFile) {
        errors.push({
          filename: file.originalname,
          error: `Duplicate file. Already uploaded as "${existingFile.originalName}"`,
        });
        continue;
      }

      // Upload to S3
      const result = await uploadFileToS3(
        companyId,
        file.buffer,
        file.originalname,
        file.mimetype
      );

      if (!result) {
        errors.push({ filename: file.originalname, error: 'Upload failed' });
        continue;
      }

      // Save to database with content hash
      const companyFile = await prisma.companyFile.create({
        data: {
          companyId,
          filename: result.s3Key.split('/').pop() || file.originalname,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          s3Key: result.s3Key,
          s3Url: result.s3Url,
          contentHash: result.contentHash,
        },
      });

      uploadedFiles.push(companyFile);
    }

    res.json({
      success: true,
      data: {
        uploaded: uploadedFiles,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error('Error uploading files:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to upload files',
    });
  }
};

/**
 * DELETE /api/files/:id
 * Delete a file
 */
export const deleteFile = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({
        success: false,
        error: 'File ID is required',
      });
      return;
    }

    // Get file from database
    const file = await prisma.companyFile.findUnique({
      where: { id },
    });

    if (!file) {
      res.status(404).json({
        success: false,
        error: 'File not found',
      });
      return;
    }

    // Delete from S3
    const deleted = await deleteFileFromS3(file.s3Key);

    if (!deleted) {
      console.warn(`Failed to delete file from S3: ${file.s3Key}`);
      // Continue to delete from database even if S3 delete fails
    }

    // Delete from database
    await prisma.companyFile.delete({
      where: { id },
    });

    res.json({
      success: true,
      data: { deleted: true },
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete file',
    });
  }
};
