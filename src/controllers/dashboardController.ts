import { Request, Response } from 'express';
import { dashboardService } from '../services/dashboard.js';
import { ApiResponse } from '../types/index.js';

export const dashboardController = {
  /**
   * GET /api/dashboard/:companyId
   * Get complete dashboard for a company
   */
  async getDashboard(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Not authenticated'
        });
        return;
      }

      const { companyId } = req.params;

      if (!companyId) {
        res.status(400).json({
          success: false,
          error: 'Company ID is required'
        });
        return;
      }

      const dashboard = await dashboardService.getDashboard(
        req.user.id,
        companyId
      );

      const response: ApiResponse = {
        success: true,
        data: dashboard
      };

      res.json(response);
    } catch (error) {
      console.error('Get dashboard error:', error);
      const statusCode =
        error instanceof Error && error.message === 'Access denied' ? 403 : 400;
      res.status(statusCode).json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get dashboard'
      });
    }
  },

  /**
   * GET /api/dashboard/me
   * Get dashboard for current user's company
   */
  async getMyDashboard(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Not authenticated'
        });
        return;
      }

      if (!req.user.companyId) {
        res.status(404).json({
          success: false,
          error: 'No company associated with this user'
        });
        return;
      }

      const dashboard = await dashboardService.getDashboard(
        req.user.id,
        req.user.companyId
      );

      const response: ApiResponse = {
        success: true,
        data: dashboard
      };

      res.json(response);
    } catch (error) {
      console.error('Get my dashboard error:', error);
      res.status(400).json({
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to get dashboard'
      });
    }
  }
};