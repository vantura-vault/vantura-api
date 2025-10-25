import { Request, Response } from 'express';
import { snapshotService } from '../services/snapshotService.js';
import { ApiResponse } from '../types/index.js';

export const snapshotController = {
  /**
   * POST /api/snapshots
   * Create a new snapshot
   */
  async create(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Not authenticated'
        });
        return;
      }

      const { companyPlatformId, followerCount, postCount } = req.body;

      // Validate input
      if (!companyPlatformId) {
        res.status(400).json({
          success: false,
          error: 'companyPlatformId is required'
        });
        return;
      }

      if (
        followerCount === undefined ||
        followerCount === null ||
        followerCount < 0
      ) {
        res.status(400).json({
          success: false,
          error: 'followerCount is required and must be >= 0'
        });
        return;
      }

      if (postCount === undefined || postCount === null || postCount < 0) {
        res.status(400).json({
          success: false,
          error: 'postCount is required and must be >= 0'
        });
        return;
      }

      const snapshot = await snapshotService.createSnapshot(req.user.id, {
        companyPlatformId,
        followerCount: parseInt(String(followerCount)),
        postCount: parseInt(String(postCount))
      });

      const response: ApiResponse = {
        success: true,
        data: snapshot,
        message: 'Snapshot created successfully'
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Create snapshot error:', error);
      res.status(400).json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to create snapshot'
      });
    }
  },

  /**
   * GET /api/snapshots/platform/:companyPlatformId
   * Get snapshots for a specific platform
   */
  async getByPlatform(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Not authenticated'
        });
        return;
      }

      const { companyPlatformId } = req.params;
      const { startDate, endDate, limit } = req.query;

      const options: any = {};

      if (startDate) {
        options.startDate = new Date(String(startDate));
      }

      if (endDate) {
        options.endDate = new Date(String(endDate));
      }

      if (limit) {
        options.limit = parseInt(String(limit));
      }

      const snapshots = await snapshotService.getSnapshotsByPlatform(
        req.user.id,
        companyPlatformId,
        options
      );

      res.json({
        success: true,
        data: snapshots
      });
    } catch (error) {
      console.error('Get snapshots error:', error);
      res.status(400).json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get snapshots'
      });
    }
  },

  /**
   * GET /api/snapshots/company/:companyId/latest
   * Get latest snapshot for each platform in company
   */
  async getLatestByCompany(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Not authenticated'
        });
        return;
      }

      const { companyId } = req.params;

      const snapshots = await snapshotService.getLatestSnapshotsByCompany(
        req.user.id,
        companyId
      );

      res.json({
        success: true,
        data: snapshots
      });
    } catch (error) {
      console.error('Get latest snapshots error:', error);
      res.status(400).json({
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to get latest snapshots'
      });
    }
  },

  /**
   * GET /api/snapshots/platform/:companyPlatformId/analytics
   * Get growth analytics for a platform
   */
  async getAnalytics(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Not authenticated'
        });
        return;
      }

      const { companyPlatformId } = req.params;
      const { startDate, endDate } = req.query;

      const options: any = {};

      if (startDate) {
        options.startDate = new Date(String(startDate));
      }

      if (endDate) {
        options.endDate = new Date(String(endDate));
      }

      const analytics = await snapshotService.getGrowthAnalytics(
        req.user.id,
        companyPlatformId,
        options
      );

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      console.error('Get analytics error:', error);
      res.status(400).json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get analytics'
      });
    }
  }
};