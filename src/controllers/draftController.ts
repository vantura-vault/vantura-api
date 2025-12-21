import { Request, Response } from 'express';
import { draftService } from '../services/draft.js';

export const draftController = {
  /**
   * POST /api/drafts
   * Create a new draft from a blueprint
   */
  async createDraft(req: Request, res: Response): Promise<void> {
    try {
      const { blueprintId } = req.body;
      const companyId = req.user?.companyId;

      if (!companyId) {
        res.status(401).json({
          success: false,
          error: 'User must belong to a company',
        });
        return;
      }

      if (!blueprintId) {
        res.status(400).json({
          success: false,
          error: 'blueprintId is required',
        });
        return;
      }

      const draft = await draftService.createDraft({
        companyId,
        blueprintId,
      });

      res.status(201).json({
        success: true,
        data: draft,
      });
    } catch (error) {
      console.error('Create draft error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create draft',
      });
    }
  },

  /**
   * GET /api/drafts
   * List all drafts for the user's company
   */
  async getDrafts(req: Request, res: Response): Promise<void> {
    try {
      const companyId = req.user?.companyId;

      if (!companyId) {
        res.status(401).json({
          success: false,
          error: 'User must belong to a company',
        });
        return;
      }

      const drafts = await draftService.getDrafts(companyId);

      res.json({
        success: true,
        data: drafts,
      });
    } catch (error) {
      console.error('Get drafts error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get drafts',
      });
    }
  },

  /**
   * GET /api/drafts/:id
   * Get a single draft by ID
   */
  async getDraft(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const companyId = req.user?.companyId;

      if (!companyId) {
        res.status(401).json({
          success: false,
          error: 'User must belong to a company',
        });
        return;
      }

      const draft = await draftService.getDraft(id, companyId);

      if (!draft) {
        res.status(404).json({
          success: false,
          error: 'Draft not found',
        });
        return;
      }

      res.json({
        success: true,
        data: draft,
      });
    } catch (error) {
      console.error('Get draft error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get draft',
      });
    }
  },

  /**
   * PATCH /api/drafts/:id
   * Update a draft (auto-save)
   */
  async updateDraft(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const companyId = req.user?.companyId;
      const { imageUrl, caption, selectedHashtags, currentStep, status } = req.body;

      if (!companyId) {
        res.status(401).json({
          success: false,
          error: 'User must belong to a company',
        });
        return;
      }

      const draft = await draftService.updateDraft(id, companyId, {
        imageUrl,
        caption,
        selectedHashtags,
        currentStep,
        status,
      });

      res.json({
        success: true,
        data: draft,
      });
    } catch (error) {
      console.error('Update draft error:', error);

      if (error instanceof Error && error.message === 'Draft not found') {
        res.status(404).json({
          success: false,
          error: 'Draft not found',
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update draft',
      });
    }
  },

  /**
   * DELETE /api/drafts/:id
   * Delete a draft
   */
  async deleteDraft(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const companyId = req.user?.companyId;

      if (!companyId) {
        res.status(401).json({
          success: false,
          error: 'User must belong to a company',
        });
        return;
      }

      await draftService.deleteDraft(id, companyId);

      res.json({
        success: true,
        message: 'Draft deleted successfully',
      });
    } catch (error) {
      console.error('Delete draft error:', error);

      if (error instanceof Error && error.message === 'Draft not found') {
        res.status(404).json({
          success: false,
          error: 'Draft not found',
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete draft',
      });
    }
  },

  /**
   * GET /api/drafts/by-blueprint/:blueprintId
   * Get draft by blueprint ID (for "Send to Studio" resumption)
   */
  async getDraftByBlueprint(req: Request, res: Response): Promise<void> {
    try {
      const { blueprintId } = req.params;
      const companyId = req.user?.companyId;

      if (!companyId) {
        res.status(401).json({
          success: false,
          error: 'User must belong to a company',
        });
        return;
      }

      const draft = await draftService.getDraftByBlueprint(blueprintId, companyId);

      res.json({
        success: true,
        data: draft, // Can be null if no draft exists
      });
    } catch (error) {
      console.error('Get draft by blueprint error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get draft',
      });
    }
  },
};
