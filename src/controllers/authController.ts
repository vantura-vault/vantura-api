import { Request, Response } from 'express';
import { authService } from '../services/auth.js';
import { dataChamberService } from '../services/dataChamberService.js';
import { prisma } from '../db.js';
import { ApiResponse } from '../types/index.js';

export const authController = {
  // POST /api/auth/register
  async register(req: Request, res:Response): Promise<void> {
    try{
      const { email, name, password, companyName, companyIndustry } = req.body;

      if (!email || !name || !password || !companyName || !companyIndustry){
        res.status(400).json({
          success: false,
          error: "email, name, password, companyName, and companyIndustry are required"
        });
        return;
      }

      const result = await authService.register({
        email,
        name,
        password,
        companyName,
        companyIndustry
      });

      const response: ApiResponse = {
        success: true,
        data: result,
        message: 'User registered successfully'
      };

      res.status(201).json(response);
    } catch (error) {
      console.error('Register error:', error);
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : 'Registration failed'
      });
    }
  },

  // POST /api/auth/login
  async login(req: Request, res: Response): Promise<void>{
    try{
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({
          success: false,
          error: 'Email and password are required'
        });
        return;
      }

      const result = await authService.login({email, password});

      const response: ApiResponse = {
        success: true,
        data: result,
        message: 'Login successful'
      };

      res.json(response);

      // Trigger background LinkedIn sync if configured (non-blocking)
      if (result.user.companyId) {
        setImmediate(async () => {
          try {
            const company = await prisma.company.findUnique({
              where: { id: result.user.companyId! },
              select: { linkedInUrl: true, linkedInType: true }
            });

            if (company?.linkedInUrl && company?.linkedInType) {
              console.log(`🔄 [Auth] Background sync for ${result.user.email}'s company LinkedIn...`);
              await dataChamberService.syncLinkedIn(
                result.user.companyId!,
                company.linkedInUrl,
                company.linkedInType as 'profile' | 'company'
              );
              console.log(`✅ [Auth] Background LinkedIn sync complete`);
            }
          } catch (syncError) {
            console.error(`⚠️ [Auth] Background LinkedIn sync failed:`, syncError);
            // Don't throw - this is non-blocking
          }
        });
      }
    } catch (error){
      console.error('Login error:', error);
      res.status(401).json({
        success: false,
        error: 'invalid email or password'
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
