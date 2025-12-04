import { Request, Response } from 'express';
import { authService } from '../services/auth.js';
import { dataChamberService } from '../services/dataChamberService.js';
import { prisma } from '../db.js';
import { ApiResponse } from '../types/index.js';

export const authController = {
  /**
   * POST /api/auth/register
   * Register a new user with company LinkedIn URL
   */
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, name, password, companyName, companyIndustry, linkedInUrl, linkedInType } = req.body;

      // Validate required fields
      if (!email || !name || !password || !companyName || !linkedInUrl || !linkedInType) {
        res.status(400).json({
          success: false,
          error: 'Required fields: email, name, password, companyName, linkedInUrl, linkedInType'
        });
        return;
      }

      // Validate linkedInType
      if (!['company', 'profile'].includes(linkedInType)) {
        res.status(400).json({
          success: false,
          error: 'linkedInType must be "company" or "profile"'
        });
        return;
      }

      // Validate password strength (basic)
      if (password.length < 8) {
        res.status(400).json({
          success: false,
          error: 'Password must be at least 8 characters'
        });
        return;
      }

      const result = await authService.register({
        email,
        name,
        password,
        companyName,
        companyIndustry,
        linkedInUrl,
        linkedInType,
      });

      const response: ApiResponse = {
        success: true,
        data: result,
        message: result.isNewCompany
          ? 'Account created successfully. You are the owner of this company.'
          : `Account created successfully. You have joined ${companyName} as a team member.`
      };

      res.status(201).json(response);

      // Trigger background LinkedIn sync for new companies
      if (result.isNewCompany && result.user.companyId) {
        setImmediate(async () => {
          try {
            console.log(`🔄 [Auth] Background sync for new company LinkedIn...`);
            await dataChamberService.syncLinkedIn(
              result.user.companyId!,
              linkedInUrl,
              linkedInType
            );
            console.log(`✅ [Auth] Initial LinkedIn sync complete`);
          } catch (syncError) {
            console.error(`⚠️ [Auth] Initial LinkedIn sync failed:`, syncError);
          }
        });
      }
    } catch (error) {
      console.error('Register error:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed'
      });
    }
  },

  /**
   * POST /api/auth/check-linkedin
   * Check if a LinkedIn URL is already registered (for form validation)
   */
  async checkLinkedIn(req: Request, res: Response): Promise<void> {
    try {
      const { linkedInUrl } = req.body;

      if (!linkedInUrl) {
        res.status(400).json({
          success: false,
          error: 'linkedInUrl is required'
        });
        return;
      }

      const result = await authService.checkLinkedInUrl(linkedInUrl);

      res.json({
        success: true,
        data: {
          exists: result.exists,
          companyName: result.companyName,
          message: result.exists
            ? `This LinkedIn account is already registered to "${result.companyName}". You will join as a team member.`
            : 'This LinkedIn account is not yet registered. You will be the company owner.'
        }
      });
    } catch (error) {
      console.error('Check LinkedIn error:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check LinkedIn URL'
      });
    }
  },

  /**
   * POST /api/auth/login
   */
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({
          success: false,
          error: 'Email and password are required'
        });
        return;
      }

      const result = await authService.login({ email, password });

      const response: ApiResponse = {
        success: true,
        data: result,
        message: 'Login successful'
      };

      res.json(response);

      // Trigger background LinkedIn sync if configured (non-blocking)
      if (result.user.companyId) {
        console.log(`🔄 [Auth] Initiating background sync for company: ${result.user.companyId}`);
        setImmediate(async () => {
          try {
            const company = await prisma.company.findUnique({
              where: { id: result.user.companyId! },
              select: { linkedInUrl: true, linkedInType: true, name: true }
            });

            console.log(`📋 [Auth] Company data:`, {
              name: company?.name,
              hasLinkedInUrl: !!company?.linkedInUrl,
              linkedInType: company?.linkedInType
            });

            if (company?.linkedInUrl && company?.linkedInType) {
              console.log(`🔄 [Auth] Starting LinkedIn sync for ${result.user.email} - ${company.linkedInUrl}`);
              await dataChamberService.syncLinkedIn(
                result.user.companyId!,
                company.linkedInUrl,
                company.linkedInType as 'profile' | 'company'
              );
              console.log(`✅ [Auth] Background LinkedIn sync complete for ${company.name}`);
            } else {
              console.log(`⏭️ [Auth] Skipping sync - no LinkedIn URL configured for company: ${company?.name}`);
            }
          } catch (syncError) {
            console.error(`⚠️ [Auth] Background LinkedIn sync failed:`, syncError);
          }
        });
      } else {
        console.log(`⏭️ [Auth] Skipping sync - user has no companyId`);
      }
    } catch (error) {
      console.error('Login error:', error);
      res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }
  },

  /**
   * POST /api/auth/logout
   */
  async logout(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const token = authHeader?.replace('Bearer ', '');

      if (token) {
        await authService.logout(token);
      }

      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        error: 'Logout failed'
      });
    }
  },

  /**
   * GET /api/auth/me
   */
  async me(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: 'Not authenticated'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          id: req.user.id,
          email: req.user.email,
          name: req.user.name,
          companyId: req.user.companyId,
          role: req.user.role
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get user info'
      });
    }
  }
};
