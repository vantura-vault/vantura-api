import { Request, Response } from 'express';
import { adminService } from '../services/adminService.js';
import { stripeService } from '../services/stripeService.js';

export const adminController = {
  /**
   * GET /api/admin/users
   * List all users with pagination and search
   */
  async getUsers(req: Request, res: Response): Promise<void> {
    try {
      const { limit, offset, search } = req.query;

      const data = await adminService.getUsers({
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
        search: search as string,
      });

      res.json({ success: true, data });
    } catch (error) {
      console.error('[AdminController] getUsers error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch users',
      });
    }
  },

  /**
   * GET /api/admin/companies
   * List all companies with stats
   */
  async getCompanies(req: Request, res: Response): Promise<void> {
    try {
      const { limit, offset, search } = req.query;

      const data = await adminService.getCompanies({
        limit: limit ? parseInt(limit as string, 10) : undefined,
        offset: offset ? parseInt(offset as string, 10) : undefined,
        search: search as string,
      });

      res.json({ success: true, data });
    } catch (error) {
      console.error('[AdminController] getCompanies error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch companies',
      });
    }
  },

  /**
   * GET /api/admin/stats
   * Get aggregate stats for admin dashboard
   */
  async getStats(_req: Request, res: Response): Promise<void> {
    try {
      const data = await adminService.getStats();
      res.json({ success: true, data });
    } catch (error) {
      console.error('[AdminController] getStats error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch stats',
      });
    }
  },

  /**
   * POST /api/admin/users/:id/deactivate
   * Deactivate a user (invalidate all sessions)
   */
  async deactivateUser(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      // Prevent self-deactivation
      if (id === req.user?.id) {
        res.status(400).json({
          success: false,
          error: 'Cannot deactivate your own account',
        });
        return;
      }

      const data = await adminService.deactivateUser(id);
      res.json({ success: true, data });
    } catch (error) {
      console.error('[AdminController] deactivateUser error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to deactivate user',
      });
    }
  },

  /**
   * POST /api/admin/users/:id/reset-password
   * Reset a user's password (generate temporary password)
   */
  async resetPassword(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const data = await adminService.resetPassword(id);
      res.json({ success: true, data });
    } catch (error) {
      console.error('[AdminController] resetPassword error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reset password',
      });
    }
  },

  /**
   * GET /api/admin/api-usage
   * Get API usage metrics
   */
  async getApiUsage(req: Request, res: Response): Promise<void> {
    try {
      const { range } = req.query;

      const data = await adminService.getApiUsage({
        range: range as '24h' | '7d' | '30d',
      });

      res.json({ success: true, data });
    } catch (error) {
      console.error('[AdminController] getApiUsage error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch API usage',
      });
    }
  },

  /**
   * GET /api/admin/billing
   * Get Stripe billing overview
   */
  async getBilling(_req: Request, res: Response): Promise<void> {
    try {
      const data = await stripeService.getBillingOverview();
      res.json({ success: true, data });
    } catch (error) {
      console.error('[AdminController] getBilling error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch billing data',
      });
    }
  },
};
