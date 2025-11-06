import { Request, Response } from 'express';
import { z } from 'zod';
import { dataChamberService } from '../services/dataChamberService';

// Validation schemas
const strategicGoalSchema = z.object({
  label: z.string(),
  current: z.number(),
  target: z.number(),
  unit: z.string().optional(),
  achieved: z.boolean(),
});

const updateSettingsSchema = z.object({
  values: z.array(z.string()).optional(),
  brandVoice: z.string().optional(),
  targetAudience: z.string().optional(),
  strategicGoals: z.array(strategicGoalSchema).optional(),
});

/**
 * GET /api/data-chamber/settings
 * Get company data chamber settings
 */
export const getSettings = async (req: Request, res: Response) => {
  try {
    const companyId = req.query.companyId as string;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'companyId query parameter is required',
      });
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
export const updateSettings = async (req: Request, res: Response) => {
  try {
    const companyId = req.query.companyId as string;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        error: 'companyId query parameter is required',
      });
    }

    // Validate request body
    const validationResult = updateSettingsSchema.safeParse(req.body);

    if (!validationResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request data',
        details: validationResult.error.errors,
      });
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
