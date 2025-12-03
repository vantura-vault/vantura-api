import { Request, Response } from 'express';
import { z } from 'zod';
import { dataChamberService } from '../services/dataChamberService.js';

// Validation schemas
const updateSettingsSchema = z.object({
  values: z.array(z.string()).optional(),
  brandVoice: z.string().optional(),
  targetAudience: z.string().optional(),
  personalNotes: z.string().optional(),
  profilePictureUrl: z.string().optional(),
  linkedInUrl: z.string().optional(),
  linkedInType: z.string().optional(),
});

const syncLinkedInSchema = z.object({
  companyId: z.string(),
  url: z.string().url(),
  type: z.enum(['profile', 'company']),
});

/**
 * GET /api/data-chamber/settings
 * Get company data chamber settings
 */
export const getSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = req.query.companyId as string;

    if (!companyId) {
      res.status(400).json({
        success: false,
        error: 'companyId query parameter is required',
      });
      return;
    }

    const settings = await dataChamberService.getSettings(companyId);

    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Error fetching data chamber settings:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch settings',
    });
  }
};

/**
 * PUT /api/data-chamber/settings
 * Update company data chamber settings
 */
export const updateSettings = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = req.query.companyId as string;

    if (!companyId) {
      res.status(400).json({
        success: false,
        error: 'companyId query parameter is required',
      });
      return;
    }

    // Validate request body
    const validationResult = updateSettingsSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validationResult.error.issues,
      });
      return;
    }

    const settings = await dataChamberService.updateSettings(
      companyId,
      validationResult.data
    );

    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('Error updating data chamber settings:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update settings',
    });
  }
};

/**
 * POST /api/data-chamber/sync-linkedin
 * Sync LinkedIn profile/company data
 */
export const syncLinkedIn = async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = syncLinkedInSchema.safeParse(req.body);

    if (!validationResult.success) {
      res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validationResult.error.issues,
      });
      return;
    }

    const { companyId, url, type } = validationResult.data;

    const result = await dataChamberService.syncLinkedIn(companyId, url, type);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error syncing LinkedIn:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to sync LinkedIn data',
    });
  }
};

/**
 * GET /api/data-chamber/health
 * Get data health score and breakdown
 */
export const getDataHealth = async (req: Request, res: Response): Promise<void> => {
  try {
    const companyId = req.query.companyId as string;

    if (!companyId) {
      res.status(400).json({
        success: false,
        error: 'companyId query parameter is required',
      });
      return;
    }

    const health = await dataChamberService.calculateDataHealth(companyId);

    res.json({
      success: true,
      data: health,
    });
  } catch (error) {
    console.error('Error calculating data health:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to calculate data health',
    });
  }
};
