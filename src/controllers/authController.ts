import { Request, Response } from 'express';
import { authService } from '../services/auth';
import { ApiResponse } from '../types';

export const authController = {
  // POST /api/auth/register
  async register(req: Request, res:Response): Promise<void> {
    try{
      const { email, name, password } = req.body;

      if (!email || !name || !password){
        res.status(400).json({
          success: false,
          error: "email, name, and password are required'"
        });
        return;
      }

      const result = await authService.register({email, name, password});

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
