import { Request, Response } from 'express';
import { createBlueprint, getBlueprints, getBlueprintById, updateBlueprintTitle, deleteBlueprint } from '../services/blueprint.js';

export const blueprintController = {
  // POST /api/blueprints
  async create(req: Request, res: Response): Promise<void> {
    try {
      const blueprint = await createBlueprint(req.body);

      res.status(201).json({
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

  // GET /api/blueprints?companyId=X&platform=LinkedIn&sortBy=createdAt&sortOrder=desc&limit=20&offset=0
  async list(req: Request, res: Response): Promise<void> {
    try {
      const { companyId, platform, sortBy, sortOrder, limit, offset } = req.query;

      if (!companyId || typeof companyId !== 'string') {
        res.status(400).json({
          success: false,
          error: 'companyId is required',
        });
        return;
      }

      const result = await getBlueprints({
        companyId,
        platform: platform as string | undefined,
        sortBy: (sortBy as any) || 'createdAt',
        sortOrder: (sortOrder as any) || 'desc',
        limit: limit ? Number(limit) : 20,
        offset: offset ? Number(offset) : 0,
      });

      res.json({
        success: true,
        data: result,
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

  // PATCH /api/blueprints/:id - Update blueprint title
  async update(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { companyId, title } = req.body;

      if (!companyId || typeof companyId !== 'string') {
        res.status(400).json({
          success: false,
          error: 'companyId is required',
        });
        return;
      }

      if (!title || typeof title !== 'string' || title.length === 0 || title.length > 100) {
        res.status(400).json({
          success: false,
          error: 'title is required and must be 1-100 characters',
        });
        return;
      }

      const blueprint = await updateBlueprintTitle(id, companyId, title);

      res.json({
        success: true,
        data: blueprint,
      });
    } catch (error) {
      console.error('Update blueprint error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update blueprint',
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
        data: { message: 'Blueprint deleted successfully' },
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
