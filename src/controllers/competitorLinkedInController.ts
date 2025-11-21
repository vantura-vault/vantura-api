import { Request, Response } from 'express';
import { addCompetitorViaLinkedIn } from '../services/competitorLinkedIn.js';

export const competitorLinkedInController = {
  /**
   * POST /api/competitors/linkedin
   * Add a competitor by scraping their LinkedIn profile
   */
  async addViaLinkedIn(req: Request, res: Response): Promise<void> {
    try {
      const { companyId, linkedinUrl } = req.body;

      // Validation
      if (!companyId || typeof companyId !== 'string') {
        res.status(400).json({
          success: false,
          error: 'companyId is required',
        });
        return;
      }

      if (!linkedinUrl || typeof linkedinUrl !== 'string') {
        res.status(400).json({
          success: false,
          error: 'linkedinUrl is required',
        });
        return;
      }

      // Validate LinkedIn URL format
      if (!linkedinUrl.includes('linkedin.com/company/')) {
        res.status(400).json({
          success: false,
          error: 'Invalid LinkedIn company URL. Must contain "linkedin.com/company/"',
        });
        return;
      }

      console.log(`[API] Adding competitor via LinkedIn: ${linkedinUrl} for company ${companyId}`);

      // Add competitor
      const result = await addCompetitorViaLinkedIn({
        companyId,
        linkedinUrl,
      });

      res.status(201).json({
        success: true,
        data: result,
      });
    } catch (error) {
      console.error('[API] Add competitor via LinkedIn error:', error);

      const errorMessage = error instanceof Error ? error.message : 'Failed to add competitor';

      res.status(500).json({
        success: false,
        error: errorMessage,
      });
    }
  },
};
