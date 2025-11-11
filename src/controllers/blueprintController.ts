import { Request, Response } from 'express';
import { createBlueprint, getBlueprints, getBlueprintById, deleteBlueprint } from '../services/blueprint.js';

export const blueprintController = {
  // POST /api/blueprints
  async create(req: Request, res: Response): Promise<void> {
    try {
      const blueprint = await createBlueprint(req.body);

      res.json({
        success: true,
        data: blueprint,
      });
    } catch (error) {
      console.error('Create blueprint error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create blueprint',
      });
    }
  },

  // GET /api/blueprints?companyId=X
  async list(req: Request, res: Response): Promise<void> {
    try {
      const { companyId } = req.query;

      if (!companyId || typeof companyId !== 'string') {
        res.status(400).json({
          success: false,
          error: 'companyId is required',
        });
        return;
      }

      const blueprints = await getBlueprints(companyId);

      res.json({
        success: true,
        data: blueprints,
      });
    } catch (error) {
      console.error('List blueprints error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch blueprints',
      });
    }
  },

  // GET /api/blueprints/:id?companyId=X
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { companyId } = req.query;

      if (!companyId || typeof companyId !== 'string') {
        res.status(400).json({
          success: false,
          error: 'companyId is required',
        });
        return;
      }

      const blueprint = await getBlueprintById(id, companyId);

      if (!blueprint) {
        res.status(404).json({
          success: false,
          error: 'Blueprint not found',
        });
        return;
      }

      res.json({
        success: true,
        data: blueprint,
      });
    } catch (error) {
      console.error('Get blueprint error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch blueprint',
      });
    }
  },

  // DELETE /api/blueprints/:id?companyId=X
  async delete(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { companyId } = req.query;

      if (!companyId || typeof companyId !== 'string') {
        res.status(400).json({
          success: false,
          error: 'companyId is required',
        });
        return;
      }

      await deleteBlueprint(id, companyId);

      res.json({
        success: true,
        data: { deleted: true },
      });
    } catch (error) {
      console.error('Delete blueprint error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete blueprint',
      });
    }
  },
};
