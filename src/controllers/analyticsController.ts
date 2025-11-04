import { Request, Response } from 'express';
import { analyticsService } from '../services/analyticsService.js';
import { getAnalyticsSummary, TimeRange } from '../services/analytics.js';

export const analyticsController = {
  // GET /api/analytics/historical
  async getHistoricalMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { companyId, platform, range, ma, comparisonMode } = req.query;

      if (!companyId || !platform || !range) {
        res.status(400).json({
          success: false,
          error: 'companyId, platform, and range are required',
        });
        return;
      }

      const maValue = ma ? parseInt(ma as string) : undefined;
      const comparison = (comparisonMode as 'none' | 'top' | 'all' | 'industry') || 'none';

      const data = await analyticsService.getHistoricalMetrics(
        companyId as string,
        platform as string,
        range as '1M' | '6M' | '1Y' | 'ALL',
        maValue,
        comparison
      );

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      console.error('Get historical metrics error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch historical metrics',
      });
    }
  },

  // GET /api/analytics/recent
  async getRecentPosts(req: Request, res: Response): Promise<void> {
    try {
      const { companyId, limit } = req.query;

      if (!companyId) {
        res.status(400).json({
          success: false,
          error: 'companyId is required',
        });
        return;
      }

      const limitValue = limit ? parseInt(limit as string) : 10;
      const data = await analyticsService.getRecentPosts(companyId as string, limitValue);

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      console.error('Get recent posts error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch recent posts',
      });
    }
  },

  // GET /api/analytics/summary
  async getSummary(req: Request, res: Response): Promise<void> {
    try {
      const { companyId, range } = req.query;

      if (!companyId) {
        res.status(400).json({
          success: false,
          error: 'companyId is required',
        });
        return;
      }

      const data = await getAnalyticsSummary({
        companyId: companyId as string,
        range: (range as TimeRange) || '1M'
      });

      res.json({
        success: true,
        data,
      });
    } catch (error) {
      console.error('Get analytics summary error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch analytics summary',
      });
    }
  },
};
