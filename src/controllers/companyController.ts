import { Request, Response } from 'express';
import { companyService } from '../services/company.js';
import { ApiResponse } from '../types/index.js';

export const companyController = {
  /**
   * POST /api/companies
   * Create a new company
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

      const { name, industry, description, values, platforms } = req.body;

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
          error: 'At least one social platform is required'
        });
        return;
      }

      // Validate each platform
      for (const platform of platforms) {
        if (!platform.platformName || !platform.profileUrl) {
          res.status(400).json({
            success: false,
            error: 'Each platform must have platformName and profileUrl'
          });
          return;
        }
      }

      const company = await companyService.createCompany(req.user.id, {
        name,
        industry,
        description,
        values,
        profilePictureUrl: req.body.profilePictureUrl,
        platforms
      });

      const response: ApiResponse = {
        success: true,
        data: company,
        message: 'Company created successfully'
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Create company error:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create company'
      });
    }
  },

  /**
   * GET /api/companies/me
   * Get current user's company
   */
  async getMyCompany(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Not authenticated'
        });
        return;
      }

      const company = await companyService.getUserCompany(req.user.id);

      if (!company) {
        res.status(404).json({
          success: false,
          error: 'No company found for this user'
        });
        return;
      }

      res.json({
        success: true,
        data: company
      });
    } catch (error) {
      console.error('Get company error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get company'
      });
    }
  },

  /**
   * GET /api/companies/:id
   * Get company by ID
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

      const company = await companyService.getCompanyById(id, req.user.id);

      res.json({
        success: true,
        data: company
      });
    } catch (error) {
      console.error('Get company by ID error:', error);
      const statusCode = error instanceof Error && error.message === 'Company not found' ? 404 : 403;
      res.status(statusCode).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get company'
      });
    }
  },

  /**
   * POST /api/companies/:id/platforms
   * Add platform to company
   */
  async addPlatform(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Not authenticated'
        });
        return;
      }

      const { id } = req.params;
      const { platformName, profileUrl } = req.body;

      if (!platformName || !profileUrl) {
        res.status(400).json({
          success: false,
          error: 'platformName and profileUrl are required'
        });
        return;
      }

      const companyPlatform = await companyService.addPlatform(
        id,
        req.user.id,
        { platformName, profileUrl }
      );

      res.status(201).json({
        success: true,
        data: companyPlatform,
        message: 'Platform added successfully'
      });
    } catch (error) {
      console.error('Add platform error:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add platform'
      });
    }
  },

  /**
   * PATCH /api/companies/:id
   * Update company details
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Not authenticated'
        });
        return;
      }

      const { id } = req.params;
      const { name, industry, description, values, profilePictureUrl } = req.body;

      const updatedCompany = await companyService.updateCompany(
        id,
        req.user.id,
        {
          name,
          industry,
          description,
          values,
          profilePictureUrl
        }
      );

      res.json({
        success: true,
        data: updatedCompany,
        message: 'Company updated successfully'
      });
    } catch (error) {
      console.error('Update company error:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update company'
      });
    }
  }
};