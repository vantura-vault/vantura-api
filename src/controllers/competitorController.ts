import { Request, Response } from 'express';
import { competitorService } from '../services/competitor.js';
import { ApiResponse } from '../types/index.js';

export const competitorController = {
  /**
   * POST /api/competitors
   * Add a new competitor
   */
  async add(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Not authenticated'
        });
        return;
      }

      const { name, industry, description, platforms } = req.body;

      // Validate input
      if (!name) {
        res.status(400).json({
          success: false,
          error: 'Company name is required'
        });
        return;
      }

      if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
        res.status(400).json({
          success: false,
          error: 'At least one platform is required'
        });
        return;
      }

      const result = await competitorService.addCompetitor(req.user.id, {
        name,
        industry,
        description,
        platforms
      });

      const response: ApiResponse = {
        success: true,
        data: result,
        message: 'Competitor added successfully'
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Add competitor error:', error);
      res.status(400).json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to add competitor'
      });
    }
  },

  /**
   * GET /api/competitors
   * List all competitors
   */
  async list(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Not authenticated'
        });
        return;
      }

      const competitors = await competitorService.listCompetitors(req.user.id);

      res.json({
        success: true,
        data: competitors
      });
    } catch (error) {
      console.error('List competitors error:', error);
      res.status(400).json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to list competitors'
      });
    }
  },

  /**
   * GET /api/competitors/:id
   * Get single competitor
   */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Not authenticated'
        });
        return;
      }

      const { id } = req.params;

      const competitor = await competitorService.getCompetitorById(
        req.user.id,
        id
      );

      res.json({
        success: true,
        data: competitor
      });
    } catch (error) {
      console.error('Get competitor error:', error);
      res.status(404).json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get competitor'
      });
    }
  },

  /**
   * DELETE /api/competitors/:relationshipId
   * Remove a competitor
   */
  async remove(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Not authenticated'
        });
        return;
      }

      const { relationshipId } = req.params;

      await competitorService.removeCompetitor(req.user.id, relationshipId);

      res.json({
        success: true,
        message: 'Competitor removed successfully'
      });
    } catch (error) {
      console.error('Remove competitor error:', error);
      res.status(400).json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to remove competitor'
      });
    }
  },

  /**
   * GET /api/competitors/compare
   * Compare with all competitors
   */
  async compare(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Not authenticated'
        });
        return;
      }

      const comparison = await competitorService.compareWithCompetitors(
        req.user.id
      );

      res.json({
        success: true,
        data: comparison
      });
    } catch (error) {
      console.error('Compare competitors error:', error);
      res.status(400).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to compare competitors'
      });
    }
  }
};