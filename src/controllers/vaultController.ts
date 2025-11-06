import { Request, Response } from 'express';
import { vaultService } from '../services/vaultService.js';

export const vaultController = {
  // GET /api/vault/competitors
  async getCompetitors(req: Request, res: Response): Promise<void> {
    try {
      const { companyId } = req.query;

      if (!companyId) {
        res.status(400).json({
          success: false,
          error: 'companyId is required',
        });
        return;
      }

      const data = await vaultService.getCompetitors(companyId as string);

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      console.error('Get competitors error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch competitors',
      });
    }
  },

  // POST /api/vault/competitors
  async addCompetitor(req: Request, res: Response): Promise<void> {
    try {
      const { companyId, name, website, platforms } = req.body;

      if (!companyId || !name) {
        res.status(400).json({
          success: false,
          error: 'companyId and name are required',
        });
        return;
      }

      const data = await vaultService.addCompetitor({
        companyId,
        name,
        website,
        platforms,
      });

      res.status(201).json({
        success: true,
        data,
      });
    } catch (error) {
      console.error('Add competitor error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add competitor',
      });
    }
  },

  // GET /api/vault/competitors/:id
  async getCompetitorDetails(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { companyId } = req.query;

      if (!companyId) {
        res.status(400).json({
          success: false,
          error: 'companyId is required',
        });
        return;
      }

      const data = await vaultService.getCompetitorDetails(
        id,
        companyId as string
      );

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      console.error('Get competitor details error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch competitor details',
      });
    }
  },

  // DELETE /api/vault/competitors/:id
  async deleteCompetitor(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { companyId } = req.query;

      console.log('🗑️  DELETE request received:', {
        competitorId: id,
        companyId,
        user: req.user?.email,
        userCompanyId: req.user?.companyId
      });

      if (!companyId) {
        res.status(400).json({
          success: false,
          error: 'companyId is required',
        });
        return;
      }

      const data = await vaultService.deleteCompetitor(
        id,
        companyId as string
      );

      console.log('✅ Competitor deleted successfully');

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      console.error('❌ Delete competitor error:', error);
      const statusCode = error instanceof Error && error.message === 'Competitor relationship not found' ? 404 : 500;
      res.status(statusCode).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete competitor',
      });
    }
  },
};
